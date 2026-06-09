import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { LayoutAnimation, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { TazeBadge } from 'components/taze-badge';
import { TazeCard } from 'components/taze-card';
import { TazeLogo } from 'components/taze-logo';
import { ThemedText } from 'components/themed-text';
import { ThemedView } from 'components/themed-view';
import { Brand } from 'constants/theme';
import { useResponsiveLayout } from 'hooks/use-responsive-layout';

type Destination = 'Top Bar' | 'Kitchen';
type StepIndex = 1 | 2 | 3 | 4 | 5 | 6;

type ProductDraft = {
  name: string;
  category: string;
  barcode: string;
  quantity: number;
  receivedBy: string;
};

type ScannedProduct = ProductDraft & {
  scannedAt: string;
};

type Suggestion = {
  destination: Destination;
  alternative: Destination;
  reason: string;
  confidence: number;
  drivers: string[];
};

type TimelineEntry = {
  title: string;
  detail: string;
  timestamp: string | null;
  done: boolean;
};

type DemoMode = 'idle' | 'running' | 'paused';

// Local-state demo only: no backend, no recognition integration.
// This screen is intentionally a presentation-ready operational prototype.
const SAMPLE_PRODUCT: ProductDraft = {
  name: 'Whole Milk 1L',
  category: 'Dairy',
  barcode: 'TAZE-MILK-001',
  quantity: 12,
  receivedBy: 'Staff Member',
};

const FLOW_STEPS: { index: StepIndex; title: string; detail: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { index: 1, title: 'Delivery Received', detail: 'Capture the inbound delivery.', icon: 'inventory' },
  { index: 2, title: 'Product Scanned', detail: 'Read the barcode or simulate the scan.', icon: 'qr-code-scanner' },
  { index: 3, title: 'AI Suggests Destination', detail: 'Generate a controlled recommendation.', icon: 'psychology' },
  { index: 4, title: 'Staff Confirms', detail: 'Human approval is mandatory.', icon: 'verified' },
  { index: 5, title: 'Sent to Bar or Kitchen', detail: 'Route the product to the chosen place.', icon: 'local-shipping' },
  { index: 6, title: 'Audit Proof Created', detail: 'Store the proof trail with timestamps.', icon: 'history' },
];

const FLOW_NARRATION: { step: StepIndex; label: string }[] = [
  { step: 1, label: 'Product enters operation' },
  { step: 2, label: 'AI evaluates historical usage' },
  { step: 3, label: 'Human approval required' },
  { step: 4, label: 'Destination confirmed' },
  { step: 5, label: 'Audit proof generated' },
];

function createStamp() {
  return new Date().toISOString();
}

function animateWorkflowTransition() {
  try {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  } catch {
    // LayoutAnimation is a best-effort polish layer.
  }
}

function formatStamp(value: string | null) {
  if (!value) {
    return 'Pending';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function buildSuggestion(product: ProductDraft): Suggestion {
  const normalized = `${product.name} ${product.category}`.toLowerCase();
  const topBar = normalized.includes('milk') || normalized.includes('dairy') || normalized.includes('fresh');

  return {
    destination: topBar ? 'Top Bar' : 'Kitchen',
    alternative: topBar ? 'Kitchen' : 'Top Bar',
    reason: 'Historical use, stock level, freshness and demand.',
    confidence: topBar ? 92 : 88,
    drivers: ['Historical use', 'Stock level', 'Freshness', 'Demand'],
  };
}

function stepIndexFromState(receivedAt: string | null, scannedAt: string | null, suggestedAt: string | null, confirmedAt: string | null, sentAt: string | null): StepIndex {
  if (!receivedAt) return 1;
  if (!scannedAt) return 2;
  if (!suggestedAt) return 3;
  if (!confirmedAt) return 4;
  if (!sentAt) return 5;
  return 6;
}

function StepRail({
  activeStep,
  completed,
  presentationMode,
}: {
  activeStep: StepIndex;
  completed: StepIndex[];
  presentationMode: boolean;
}) {
  return (
    <TazeCard variant="muted" style={[styles.stepRailCard, presentationMode ? styles.stepRailCardPresentation : null]}>
      <View style={styles.sectionHeader}>
        <TazeBadge label="6-step flow" tone="primary" icon="timeline" />
        <ThemedText type="defaultSemiBold" style={[styles.sectionTitle, presentationMode ? styles.sectionTitlePresentation : null]}>
          Delivery to audit proof
        </ThemedText>
      </View>

      <View style={[styles.stepRail, presentationMode ? styles.stepRailPresentation : null]}>
        {FLOW_STEPS.map((step, index) => {
          const done = completed.includes(step.index);
          const active = activeStep === step.index;

          return (
            <View
              key={step.index}
              style={[
                styles.stepChip,
                presentationMode ? styles.stepChipPresentation : null,
                done ? styles.stepChipDone : active ? styles.stepChipActive : styles.stepChipIdle,
                presentationMode && done ? styles.stepChipDonePresentation : null,
                presentationMode && active ? styles.stepChipActivePresentation : null,
                presentationMode && !done && !active ? styles.stepChipIdlePresentation : null,
              ]}>
              <View style={[styles.stepCircle, done ? styles.stepCircleDone : active ? styles.stepCircleActive : styles.stepCircleIdle]}>
                {done ? (
                  <MaterialIcons name="check" size={16} color={Brand.white} />
                ) : (
                  <ThemedText type="defaultSemiBold" style={[styles.stepCircleText, presentationMode ? styles.stepCircleTextPresentation : null]}>
                    {step.index}
                  </ThemedText>
                )}
              </View>
              <View style={styles.stepChipCopy}>
                <ThemedText
                  type="defaultSemiBold"
                  style={[styles.stepChipTitle, presentationMode ? styles.stepChipTitlePresentation : null, active ? styles.stepChipTitleActive : null]}>
                  {step.title}
                </ThemedText>
                <ThemedText style={[styles.stepChipDetail, presentationMode ? styles.stepChipDetailPresentation : null]}>{step.detail}</ThemedText>
              </View>
              {index < FLOW_STEPS.length - 1 ? <MaterialIcons name="arrow-forward" size={presentationMode ? 20 : 18} color="#64748b" /> : null}
            </View>
          );
        })}
      </View>
    </TazeCard>
  );
}

function NarrationStrip({
  activeStep,
  presentationMode,
}: {
  activeStep: StepIndex;
  presentationMode: boolean;
}) {
  if (!presentationMode) {
    return null;
  }

  return (
    <TazeCard variant="muted" style={styles.narrationCard}>
      <View style={styles.narrationRow}>
        {FLOW_NARRATION.map((item) => {
          const active = activeStep === item.step;
          const done = activeStep > item.step;
          return (
            <View
              key={item.step}
              style={[
                styles.narrationPill,
                done ? styles.narrationPillDone : null,
                active ? styles.narrationPillActive : null,
              ]}>
              <ThemedText type="defaultSemiBold" style={[styles.narrationStep, active ? styles.narrationStepActive : null]}>
                {item.label}
              </ThemedText>
            </View>
          );
        })}
      </View>
    </TazeCard>
  );
}

function FlowSectionTitle({
  index,
  label,
  tone,
  icon,
}: {
  index: StepIndex;
  label: string;
  tone: 'primary' | 'accent' | 'success' | 'warning' | 'neutral' | 'info';
  icon: keyof typeof MaterialIcons.glyphMap;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionNumberWrap}>
        <ThemedText type="defaultSemiBold" style={styles.sectionNumber}>
          {index}
        </ThemedText>
      </View>
      <TazeBadge label={label} tone={tone} icon={icon} />
    </View>
  );
}

function StatPill({
  label,
  value,
  tone = 'primary',
}: {
  label: string;
  value: string;
  tone?: 'primary' | 'accent' | 'success';
}) {
  return (
    <View style={[styles.statPill, tone === 'accent' ? styles.statPillAccent : tone === 'success' ? styles.statPillSuccess : null]}>
      <ThemedText style={styles.statLabel}>{label}</ThemedText>
      <ThemedText type="defaultSemiBold" style={styles.statValue}>
        {value}
      </ThemedText>
    </View>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, value))}%` }]} />
    </View>
  );
}

function MetricRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metricRow}>
      <ThemedText style={styles.metricLabel}>{label}</ThemedText>
      <ThemedText type="defaultSemiBold" style={styles.metricValue}>
        {value}
      </ThemedText>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  icon,
  accessibilityLabel,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionButton,
        variant === 'primary' ? styles.actionButtonPrimary : variant === 'secondary' ? styles.actionButtonSecondary : styles.actionButtonGhost,
        disabled ? styles.actionButtonDisabled : null,
        pressed && !disabled ? styles.actionButtonPressed : null,
      ]}>
      {icon ? <MaterialIcons name={icon} size={18} color={variant === 'primary' ? Brand.white : Brand.primary} /> : null}
      <ThemedText type="defaultSemiBold" style={[styles.actionButtonText, variant === 'primary' ? styles.actionButtonTextPrimary : null]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function StepCard({
  index,
  title,
  label,
  tone,
  icon,
  active,
  done,
  presentationMode,
  children,
  style,
}: {
  index: StepIndex;
  title: string;
  label: string;
  tone: 'primary' | 'accent' | 'success' | 'warning' | 'neutral' | 'info';
  icon: keyof typeof MaterialIcons.glyphMap;
  active: boolean;
  done: boolean;
  presentationMode: boolean;
  children: ReactNode;
  style?: object;
}) {
  return (
    <TazeCard
      variant="panel"
      style={[
        styles.stepCard,
        presentationMode ? styles.stepCardPresentation : null,
        done ? styles.stepCardDone : active ? styles.stepCardActive : styles.stepCardIdle,
        presentationMode && done ? styles.stepCardDonePresentation : null,
        presentationMode && active ? styles.stepCardActivePresentation : null,
        presentationMode && !done && !active ? styles.stepCardIdlePresentation : null,
        style,
      ]}>
      <FlowSectionTitle index={index} label={label} tone={tone} icon={icon} />
      <ThemedText type="defaultSemiBold" style={[styles.stepCardTitle, presentationMode ? styles.stepCardTitlePresentation : null]}>
        {title}
      </ThemedText>
      {children}
    </TazeCard>
  );
}

function CartonIllustration({
  title,
  barcode,
  quantity,
}: {
  title: string;
  barcode: string;
  quantity: number;
}) {
  return (
    <View style={styles.cartonWrap}>
      <View style={styles.cartonBody}>
        <View style={styles.cartonCap} />
        <ThemedText type="defaultSemiBold" style={styles.cartonBrand}>
          TAZE
        </ThemedText>
        <ThemedText type="defaultSemiBold" style={styles.cartonTitle}>
          {title}
        </ThemedText>
        <ThemedText style={styles.cartonQuantity}>{quantity} units</ThemedText>
        <View style={styles.barcodeBand}>
          <View style={styles.barcodeBars}>
            <View style={[styles.barLine, styles.barLineNarrow]} />
            <View style={styles.barLine} />
            <View style={styles.barLineWide} />
            <View style={styles.barLine} />
            <View style={[styles.barLine, styles.barLineNarrow]} />
            <View style={styles.barLineWide} />
            <View style={styles.barLine} />
          </View>
          <ThemedText style={styles.barcodeText}>{barcode}</ThemedText>
        </View>
        <View style={styles.cartonCheck}>
          <MaterialIcons name="check" size={20} color={Brand.white} />
        </View>
      </View>
    </View>
  );
}

function DeliveryCard({
  product,
  onChangeName,
  onChangeCategory,
  onChangeBarcode,
  onChangeQuantity,
  onChangeReceivedBy,
  onReceive,
  onReset,
  canReceive,
  receivedAt,
  presentationMode,
}: {
  product: ProductDraft;
  onChangeName: (value: string) => void;
  onChangeCategory: (value: string) => void;
  onChangeBarcode: (value: string) => void;
  onChangeQuantity: (value: string) => void;
  onChangeReceivedBy: (value: string) => void;
  onReceive: () => void;
  onReset: () => void;
  canReceive: boolean;
  receivedAt: string | null;
  presentationMode: boolean;
}) {
  return (
    <StepCard
      index={1}
      title="Delivery Received"
      label="Delivery Received"
      tone="primary"
      icon="inventory"
      active={!receivedAt}
      done={Boolean(receivedAt)}
      presentationMode={presentationMode}>
      <ThemedText style={[styles.stepBody, presentationMode ? styles.stepBodyPresentation : null]}>
        Capture the inbound delivery first. One product, one controlled start.
      </ThemedText>

      <View style={styles.twoColumnGrid}>
        <View style={styles.inputColumn}>
          <View style={styles.field}>
            <ThemedText style={[styles.fieldLabel, presentationMode ? styles.fieldLabelPresentation : null]}>Product name</ThemedText>
            <TextInput
              accessibilityLabel="Product name"
              value={product.name}
              onChangeText={onChangeName}
              placeholder="Whole Milk 1L"
              placeholderTextColor="rgba(71, 85, 105, 0.55)"
              style={styles.input}
            />
          </View>
          <View style={styles.field}>
            <ThemedText style={[styles.fieldLabel, presentationMode ? styles.fieldLabelPresentation : null]}>Category</ThemedText>
            <TextInput
              accessibilityLabel="Category"
              value={product.category}
              onChangeText={onChangeCategory}
              placeholder="Dairy"
              placeholderTextColor="rgba(71, 85, 105, 0.55)"
              style={styles.input}
            />
          </View>
          <View style={styles.field}>
            <ThemedText style={[styles.fieldLabel, presentationMode ? styles.fieldLabelPresentation : null]}>Barcode / ID</ThemedText>
            <TextInput
              accessibilityLabel="Barcode / ID"
              value={product.barcode}
              onChangeText={onChangeBarcode}
              placeholder="TAZE-MILK-001"
              placeholderTextColor="rgba(71, 85, 105, 0.55)"
              style={styles.input}
            />
          </View>
          <View style={styles.inlineFieldRow}>
            <View style={[styles.field, styles.inlineField]}>
              <ThemedText style={[styles.fieldLabel, presentationMode ? styles.fieldLabelPresentation : null]}>Quantity</ThemedText>
              <TextInput
                accessibilityLabel="Quantity"
                value={String(product.quantity)}
                onChangeText={onChangeQuantity}
                keyboardType="number-pad"
                placeholder="12"
                placeholderTextColor="rgba(71, 85, 105, 0.55)"
                style={styles.input}
              />
            </View>
            <View style={[styles.field, styles.inlineField]}>
              <ThemedText style={[styles.fieldLabel, presentationMode ? styles.fieldLabelPresentation : null]}>Received by</ThemedText>
              <TextInput
                accessibilityLabel="Received by"
                value={product.receivedBy}
                onChangeText={onChangeReceivedBy}
                placeholder="Staff Member"
                placeholderTextColor="rgba(71, 85, 105, 0.55)"
                style={styles.input}
              />
            </View>
          </View>
          <View style={styles.actionRow}>
            <ActionButton label="Mark delivery received" icon="inventory" onPress={onReceive} disabled={!canReceive} />
            <ActionButton label="Reset demo" icon="restart-alt" onPress={onReset} variant="ghost" />
          </View>
        </View>

        <View style={styles.previewColumn}>
          <CartonIllustration title={product.name} barcode={product.barcode} quantity={product.quantity} />
          <View style={[styles.previewFacts, presentationMode ? styles.previewFactsPresentation : null]}>
            <MetricRow label="Category" value={product.category} />
            <MetricRow label="Barcode" value={product.barcode} />
            <MetricRow label="Quantity" value={String(product.quantity)} />
            <MetricRow label="Received by" value={product.receivedBy} />
            <MetricRow label="Status" value={receivedAt ? 'Received' : 'Ready to receive'} />
          </View>
        </View>
      </View>
    </StepCard>
  );
}

function ProductScanCard({
  product,
  receivedAt,
  scannedProduct,
  scannedAt,
  onScan,
  presentationMode,
}: {
  product: ProductDraft;
  receivedAt: string | null;
  scannedProduct: ScannedProduct | null;
  scannedAt: string | null;
  onScan: () => void;
  presentationMode: boolean;
}) {
  return (
    <StepCard
      index={2}
      title="Product Scanned"
      label="Product Scanned"
      tone="accent"
      icon="qr-code-scanner"
      active={Boolean(receivedAt) && !scannedAt}
      done={Boolean(scannedAt)}
      presentationMode={presentationMode}>
      <ThemedText style={[styles.stepBody, presentationMode ? styles.stepBodyPresentation : null]}>
        Press one button to simulate the scan. The barcode and details become visible immediately.
      </ThemedText>

      <View style={styles.twoColumnGrid}>
        <View style={styles.scanColumn}>
          <View style={[styles.scanBanner, presentationMode ? styles.scanBannerPresentation : null]}>
            <MaterialIcons name="qr-code-scanner" size={24} color={Brand.primary} />
            <View style={styles.scanBannerCopy}>
              <ThemedText type="defaultSemiBold" style={[styles.scanBannerTitle, presentationMode ? styles.scanBannerTitlePresentation : null]}>
                Scan Product
              </ThemedText>
              <ThemedText style={[styles.scanBannerText, presentationMode ? styles.scanBannerTextPresentation : null]}>
                Simulate a barcode scan and load the product into the workflow.
              </ThemedText>
            </View>
          </View>

          <View style={[styles.scanDisplay, presentationMode ? styles.scanDisplayPresentation : null]}>
            <View style={styles.scanDisplayTop}>
              <TazeBadge label={scannedAt ? 'Barcode detected' : 'Ready to scan'} tone={scannedAt ? 'success' : 'neutral'} icon="qr-code-scanner" />
              <ThemedText style={styles.scanTime}>{scannedAt ? formatStamp(scannedAt) : 'Waiting for scan'}</ThemedText>
            </View>
            <View style={styles.scanDisplayGrid}>
              <View style={[styles.scanDisplayItem, presentationMode ? styles.scanDisplayItemPresentation : null]}>
                <ThemedText style={[styles.scanDisplayLabel, presentationMode ? styles.scanDisplayLabelPresentation : null]}>Product name</ThemedText>
                <ThemedText type="defaultSemiBold" style={[styles.scanDisplayValue, presentationMode ? styles.scanDisplayValuePresentation : null]}>
                  {scannedProduct?.name ?? product.name}
                </ThemedText>
              </View>
              <View style={[styles.scanDisplayItem, presentationMode ? styles.scanDisplayItemPresentation : null]}>
                <ThemedText style={[styles.scanDisplayLabel, presentationMode ? styles.scanDisplayLabelPresentation : null]}>Category</ThemedText>
                <ThemedText type="defaultSemiBold" style={[styles.scanDisplayValue, presentationMode ? styles.scanDisplayValuePresentation : null]}>
                  {scannedProduct?.category ?? product.category}
                </ThemedText>
              </View>
              <View style={[styles.scanDisplayItem, presentationMode ? styles.scanDisplayItemPresentation : null]}>
                <ThemedText style={[styles.scanDisplayLabel, presentationMode ? styles.scanDisplayLabelPresentation : null]}>Barcode / ID</ThemedText>
                <ThemedText type="defaultSemiBold" style={[styles.scanDisplayValue, presentationMode ? styles.scanDisplayValuePresentation : null]}>
                  {scannedProduct?.barcode ?? product.barcode}
                </ThemedText>
              </View>
              <View style={[styles.scanDisplayItem, presentationMode ? styles.scanDisplayItemPresentation : null]}>
                <ThemedText style={[styles.scanDisplayLabel, presentationMode ? styles.scanDisplayLabelPresentation : null]}>Quantity</ThemedText>
                <ThemedText type="defaultSemiBold" style={[styles.scanDisplayValue, presentationMode ? styles.scanDisplayValuePresentation : null]}>
                  {String(scannedProduct?.quantity ?? product.quantity)}
                </ThemedText>
              </View>
            </View>
            <ThemedText style={[styles.helperText, presentationMode ? styles.helperTextPresentation : null]}>
              No backend, no hidden step. The scan is captured in local state and becomes the start of the audit trail.
            </ThemedText>
          </View>
        </View>

        <View style={styles.previewColumn}>
          <View style={[styles.scanStatusBox, presentationMode ? styles.scanStatusBoxPresentation : null]}>
            <ThemedText style={[styles.fieldLabel, presentationMode ? styles.fieldLabelPresentation : null]}>Scan status</ThemedText>
            <ThemedText type="defaultSemiBold" style={[styles.scanStatusValue, presentationMode ? styles.scanStatusValuePresentation : null]}>
              {scannedAt ? 'Product scanned' : 'Waiting for scan'}
            </ThemedText>
            <ThemedText style={[styles.helperText, presentationMode ? styles.helperTextPresentation : null]}>
              {scannedAt ? 'Product details are now part of the controlled workflow.' : 'Initial state: product not scanned yet.'}
            </ThemedText>
          </View>
          <ActionButton label="Scan Product" icon="qr-code-scanner" onPress={onScan} disabled={!receivedAt} />
          <CartonIllustration
            title={scannedProduct?.name ?? product.name}
            barcode={scannedProduct?.barcode ?? product.barcode}
            quantity={scannedProduct?.quantity ?? product.quantity}
          />
        </View>
      </View>
    </StepCard>
  );
}

function AISuggestionCard({
  ready,
  suggestion,
  scannedAt,
  confirmedAt,
  presentationMode,
}: {
  ready: boolean;
  suggestion: Suggestion;
  scannedAt: string | null;
  confirmedAt: string | null;
  presentationMode: boolean;
}) {
  return (
    <StepCard
      index={3}
      title="AI Suggests Destination"
      label="AI Suggests Destination"
      tone="success"
      icon="psychology"
      active={Boolean(scannedAt) && !confirmedAt}
      done={Boolean(confirmedAt)}
      presentationMode={presentationMode}>
      <ThemedText style={[styles.stepBody, presentationMode ? styles.stepBodyPresentation : null]}>
        AI suggests. Staff decides. Human confirmation is required before any routing action.
      </ThemedText>

      <View style={[styles.suggestionCard, presentationMode ? styles.suggestionCardPresentation : null]}>
        <View style={styles.suggestionTopRow}>
          <View>
            <ThemedText style={[styles.suggestionLabel, presentationMode ? styles.suggestionLabelPresentation : null]}>Suggested destination</ThemedText>
            <ThemedText type="defaultSemiBold" style={[styles.suggestionValue, presentationMode ? styles.suggestionValuePresentation : null]}>
              {ready ? suggestion.destination : 'Scan the product first'}
            </ThemedText>
          </View>
          <TazeBadge label={`Confidence ${ready ? `${suggestion.confidence}%` : '0%'}`} tone={ready ? 'success' : 'neutral'} icon="insights" />
        </View>

        <ProgressBar value={ready ? suggestion.confidence : 0} />

        <ThemedText style={[styles.suggestionReason, presentationMode ? styles.suggestionReasonPresentation : null]}>
          {ready ? suggestion.reason : 'The recommendation is prepared once the barcode is scanned.'}
        </ThemedText>

        <View style={styles.suggestionGrid}>
          <View style={[styles.suggestionMiniCard, presentationMode ? styles.suggestionMiniCardPresentation : null]}>
            <ThemedText style={[styles.fieldLabel, presentationMode ? styles.fieldLabelPresentation : null]}>Alternative destination</ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.metricValue}>
              {ready ? suggestion.alternative : 'Kitchen'}
            </ThemedText>
          </View>
          <View style={[styles.suggestionMiniCard, presentationMode ? styles.suggestionMiniCardPresentation : null]}>
            <ThemedText style={[styles.fieldLabel, presentationMode ? styles.fieldLabelPresentation : null]}>Product</ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.metricValue}>
              {ready ? 'Whole Milk 1L' : 'Waiting for scan'}
            </ThemedText>
          </View>
        </View>

        <View style={styles.driverRow}>
          {suggestion.drivers.map((driver) => (
            <TazeBadge key={driver} label={driver} tone="neutral" icon="check" />
          ))}
        </View>

        <ThemedText style={[styles.helperText, presentationMode ? styles.helperTextPresentation : null]}>
          Every decision is recorded and stays visible in the audit trail.
        </ThemedText>
      </View>
    </StepCard>
  );
}

function ConfirmationCard({
  ready,
  suggestion,
  selectedDestination,
  onConfirm,
  onChangeDestination,
  scannedAt,
  confirmedAt,
  presentationMode,
}: {
  ready: boolean;
  suggestion: Suggestion;
  selectedDestination: Destination;
  onConfirm: () => void;
  onChangeDestination: () => void;
  scannedAt: string | null;
  confirmedAt: string | null;
  presentationMode: boolean;
}) {
  return (
    <StepCard
      index={4}
      title="Staff Confirms"
      label="Staff Confirms"
      tone="warning"
      icon="verified"
      active={Boolean(scannedAt) && !confirmedAt}
      done={Boolean(confirmedAt)}
      presentationMode={presentationMode}>
      <ThemedText style={[styles.stepBody, presentationMode ? styles.stepBodyPresentation : null]}>
        Human confirmation required before action. AI suggests, but it cannot act on its own.
      </ThemedText>

      <View style={[styles.confirmationBox, presentationMode ? styles.confirmationBoxPresentation : null]}>
        <ThemedText style={[styles.fieldLabel, presentationMode ? styles.fieldLabelPresentation : null]}>Current choice</ThemedText>
        <ThemedText type="defaultSemiBold" style={[styles.confirmationValue, presentationMode ? styles.confirmationValuePresentation : null]}>
          {selectedDestination}
        </ThemedText>
        <ThemedText style={[styles.confirmationDetail, presentationMode ? styles.confirmationDetailPresentation : null]}>
          Suggested by AI: {ready ? `${suggestion.destination} (${suggestion.confidence}%)` : 'Scan first'}.
        </ThemedText>
      </View>

      <View style={styles.actionRow}>
        <ActionButton label="Confirm" icon="check-circle" onPress={onConfirm} disabled={!ready} />
        <ActionButton label="Change destination" icon="swap-horiz" onPress={onChangeDestination} variant="secondary" disabled={!ready} />
      </View>

      <ThemedText style={[styles.helperText, presentationMode ? styles.helperTextPresentation : null]}>
        AI suggests. Staff decides. Every decision is recorded.
      </ThemedText>
    </StepCard>
  );
}

function DestinationCard({
  suggestion,
  selectedDestination,
  confirmedAt,
  sentAt,
  onSelect,
  onSend,
  staffOverrideAt,
  staffOverrideFrom,
  staffOverrideTo,
  presentationMode,
}: {
  suggestion: Suggestion;
  selectedDestination: Destination;
  confirmedAt: string | null;
  sentAt: string | null;
  onSelect: (destination: Destination) => void;
  onSend: () => void;
  staffOverrideAt: string | null;
  staffOverrideFrom: Destination | null;
  staffOverrideTo: Destination | null;
  presentationMode: boolean;
}) {
  const suggestionLabel = `AI suggests ${suggestion.destination} at ${suggestion.confidence}% confidence`;
  return (
    <StepCard
      index={5}
      title="Sent to Bar or Kitchen"
      label="Sent to Bar or Kitchen"
      tone="success"
      icon="local-shipping"
      active={Boolean(confirmedAt) && !sentAt}
      done={Boolean(sentAt)}
      presentationMode={presentationMode}>
      <ThemedText style={[styles.stepBody, presentationMode ? styles.stepBodyPresentation : null]}>
        Choose the final destination and send the product to the selected operational area.
      </ThemedText>

      <View style={[styles.destinationMetaCard, presentationMode ? styles.destinationMetaCardPresentation : null]}>
        <View style={styles.destinationMetaRow}>
          <TazeBadge label="AI suggestion" tone="accent" icon="psychology" />
          <ThemedText style={[styles.destinationMetaText, presentationMode ? styles.destinationMetaTextPresentation : null]}>{suggestionLabel}</ThemedText>
        </View>
        <ThemedText style={[styles.destinationMetaHint, presentationMode ? styles.destinationMetaHintPresentation : null]}>
          {staffOverrideAt && staffOverrideFrom && staffOverrideTo
            ? `Staff overrode the AI suggestion: ${staffOverrideFrom} -> ${staffOverrideTo}.`
            : 'Staff can select a different destination before confirming.'}
        </ThemedText>
      </View>

      <View style={styles.destinationGrid}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Top Bar"
          onPress={() => onSelect('Top Bar')}
          style={({ pressed }) => [
            styles.destinationTile,
            selectedDestination === 'Top Bar' ? styles.destinationTileSelected : null,
            suggestion.destination === 'Top Bar' ? styles.destinationTileSuggested : null,
            pressed ? styles.destinationTilePressed : null,
          ]}>
          <View style={styles.destinationTopRow}>
            <MaterialIcons name="local-bar" size={22} color={selectedDestination === 'Top Bar' ? Brand.primary : Brand.inkMuted} />
            <TazeBadge
              label={
                selectedDestination === 'Top Bar'
                  ? 'Selected'
                  : suggestion.destination === 'Top Bar'
                    ? 'AI suggests'
                    : 'Top Bar'
              }
              tone={selectedDestination === 'Top Bar' ? 'success' : suggestion.destination === 'Top Bar' ? 'accent' : 'neutral'}
            />
          </View>
          <ThemedText type="defaultSemiBold" style={[styles.destinationTitle, presentationMode ? styles.destinationTitlePresentation : null]}>
            Top Bar
          </ThemedText>
          <ThemedText style={[styles.destinationDetail, presentationMode ? styles.destinationDetailPresentation : null]}>
            Best for fast-moving chilled items and beverage service.
          </ThemedText>
          {suggestion.destination === 'Top Bar' ? (
            <ThemedText style={[styles.destinationSuggestedText, presentationMode ? styles.destinationSuggestedTextPresentation : null]}>
              Highlighted by the AI recommendation.
            </ThemedText>
          ) : null}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kitchen"
          onPress={() => onSelect('Kitchen')}
          style={({ pressed }) => [
            styles.destinationTile,
            selectedDestination === 'Kitchen' ? styles.destinationTileSelected : null,
            suggestion.destination === 'Kitchen' ? styles.destinationTileSuggested : null,
            pressed ? styles.destinationTilePressed : null,
          ]}>
          <View style={styles.destinationTopRow}>
            <MaterialIcons name="restaurant" size={22} color={selectedDestination === 'Kitchen' ? Brand.primary : Brand.inkMuted} />
            <TazeBadge
              label={
                selectedDestination === 'Kitchen'
                  ? 'Selected'
                  : suggestion.destination === 'Kitchen'
                    ? 'AI suggests'
                    : 'Kitchen'
              }
              tone={selectedDestination === 'Kitchen' ? 'success' : suggestion.destination === 'Kitchen' ? 'accent' : 'neutral'}
            />
          </View>
          <ThemedText type="defaultSemiBold" style={[styles.destinationTitle, presentationMode ? styles.destinationTitlePresentation : null]}>
            Kitchen
          </ThemedText>
          <ThemedText style={[styles.destinationDetail, presentationMode ? styles.destinationDetailPresentation : null]}>
            Best for prep, cooking and controlled back-of-house use.
          </ThemedText>
          {suggestion.destination === 'Kitchen' ? (
            <ThemedText style={[styles.destinationSuggestedText, presentationMode ? styles.destinationSuggestedTextPresentation : null]}>
              Highlighted by the AI recommendation.
            </ThemedText>
          ) : null}
        </Pressable>
      </View>

      <View style={styles.actionRow}>
        <ActionButton label="Send to destination" icon="arrow-forward" onPress={onSend} disabled={!confirmedAt} />
      </View>
    </StepCard>
  );
}

function AuditTrail({
  timeline,
  completion,
  confirmedAt,
  storedAt,
  sentAt,
  onReset,
  selectedDestination,
  displayProduct,
  staffOverrideAt,
  staffOverrideFrom,
  staffOverrideTo,
  presentationMode,
}: {
  timeline: TimelineEntry[];
  completion: number;
  confirmedAt: string | null;
  storedAt: string | null;
  sentAt: string | null;
  onReset: () => void;
  selectedDestination: Destination;
  displayProduct: ScannedProduct | ProductDraft;
  staffOverrideAt: string | null;
  staffOverrideFrom: Destination | null;
  staffOverrideTo: Destination | null;
  presentationMode: boolean;
}) {
  const auditComplete = Boolean(storedAt);

  return (
    <StepCard
      index={6}
      title="Audit Proof Created"
      label="Audit Proof Created"
      tone="success"
      icon="history"
      active={Boolean(sentAt) && !storedAt}
      done={auditComplete}
      presentationMode={presentationMode}>
      <ThemedText style={[styles.stepBody, presentationMode ? styles.stepBodyPresentation : null]}>
        Every action creates an audit record. The proof trail stays visible from delivery to storage.
      </ThemedText>

      {auditComplete ? (
        <View style={[styles.auditCompleteBanner, presentationMode ? styles.auditCompleteBannerPresentation : null]}>
          <View style={styles.auditCompleteHeader}>
            <TazeBadge label="Audit Proof Complete" tone="success" icon="check-circle" />
            <ThemedText type="defaultSemiBold" style={[styles.auditCompleteTitle, presentationMode ? styles.auditCompleteTitlePresentation : null]}>
              100% Traceable Workflow
            </ThemedText>
          </View>
          <ThemedText style={[styles.auditCompleteCopy, presentationMode ? styles.auditCompleteCopyPresentation : null]}>
            The product, routing decision and final proof are stored together for review.
          </ThemedText>
          <View style={styles.auditCompleteSummaryGrid}>
            <View style={[styles.auditCompleteSummaryCard, presentationMode ? styles.auditCompleteSummaryCardPresentation : null]}>
              <ThemedText style={[styles.fieldLabel, presentationMode ? styles.fieldLabelPresentation : null]}>Product</ThemedText>
              <ThemedText type="defaultSemiBold" style={[styles.auditSummaryValue, presentationMode ? styles.auditSummaryValuePresentation : null]}>
                {displayProduct.name}
              </ThemedText>
            </View>
            <View style={[styles.auditCompleteSummaryCard, presentationMode ? styles.auditCompleteSummaryCardPresentation : null]}>
              <ThemedText style={[styles.fieldLabel, presentationMode ? styles.fieldLabelPresentation : null]}>Final destination</ThemedText>
              <ThemedText type="defaultSemiBold" style={[styles.auditSummaryValue, presentationMode ? styles.auditSummaryValuePresentation : null]}>
                {selectedDestination}
              </ThemedText>
            </View>
            <View style={[styles.auditCompleteSummaryCard, presentationMode ? styles.auditCompleteSummaryCardPresentation : null]}>
              <ThemedText style={[styles.fieldLabel, presentationMode ? styles.fieldLabelPresentation : null]}>Confirmed by staff</ThemedText>
              <ThemedText type="defaultSemiBold" style={[styles.auditSummaryValue, presentationMode ? styles.auditSummaryValuePresentation : null]}>
                {staffOverrideAt && staffOverrideFrom && staffOverrideTo ? 'Staff override recorded' : 'Staff confirmation recorded'}
              </ThemedText>
            </View>
            <View style={[styles.auditCompleteSummaryCard, presentationMode ? styles.auditCompleteSummaryCardPresentation : null]}>
              <ThemedText style={[styles.fieldLabel, presentationMode ? styles.fieldLabelPresentation : null]}>Timestamp</ThemedText>
              <ThemedText type="defaultSemiBold" style={[styles.auditSummaryValue, presentationMode ? styles.auditSummaryValuePresentation : null]}>
                {formatStamp(storedAt)}
              </ThemedText>
            </View>
            <View style={[styles.auditCompleteSummaryCard, presentationMode ? styles.auditCompleteSummaryCardPresentation : null]}>
              <ThemedText style={[styles.fieldLabel, presentationMode ? styles.fieldLabelPresentation : null]}>Audit status</ThemedText>
              <ThemedText type="defaultSemiBold" style={[styles.auditSummaryValue, presentationMode ? styles.auditSummaryValuePresentation : null]}>
                100% Traceable Workflow
              </ThemedText>
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.auditSummaryRow}>
        <View style={[styles.auditSummaryCard, presentationMode ? styles.auditSummaryCardPresentation : null]}>
          <ThemedText style={styles.fieldLabel}>Audit proof</ThemedText>
          <ThemedText type="defaultSemiBold" style={[styles.auditSummaryValue, presentationMode ? styles.auditSummaryValuePresentation : null]}>
            {auditComplete ? 'Audit Proof: 100% complete' : `${completion}% complete`}
          </ThemedText>
        </View>
        <View style={[styles.auditSummaryCard, presentationMode ? styles.auditSummaryCardPresentation : null]}>
          <ThemedText style={styles.fieldLabel}>Confirmed at</ThemedText>
          <ThemedText type="defaultSemiBold" style={[styles.auditSummaryValue, presentationMode ? styles.auditSummaryValuePresentation : null]}>
            {formatStamp(confirmedAt)}
          </ThemedText>
        </View>
        <View style={[styles.auditSummaryCard, presentationMode ? styles.auditSummaryCardPresentation : null]}>
          <ThemedText style={styles.fieldLabel}>Stored at</ThemedText>
          <ThemedText type="defaultSemiBold" style={[styles.auditSummaryValue, presentationMode ? styles.auditSummaryValuePresentation : null]}>
            {formatStamp(storedAt)}
          </ThemedText>
        </View>
      </View>

      <View style={styles.auditTrail}>
        {timeline.map((item) => (
          <View key={item.title} style={[styles.timelineItem, presentationMode ? styles.timelineItemPresentation : null]}>
            <View style={[styles.timelineIconWrap, item.done ? styles.timelineIconWrapDone : styles.timelineIconWrapPending]}>
              <MaterialIcons name={item.done ? 'check-circle' : 'radio-button-unchecked'} size={18} color={item.done ? '#16a34a' : '#94a3b8'} />
            </View>
            <View style={styles.timelineCopy}>
              <View style={styles.timelineRow}>
                <ThemedText type="defaultSemiBold" style={[styles.timelineTitle, presentationMode ? styles.timelineTitlePresentation : null]}>
                  {item.title}
                </ThemedText>
                <ThemedText style={[styles.timelineTime, presentationMode ? styles.timelineTimePresentation : null]}>{formatStamp(item.timestamp)}</ThemedText>
              </View>
              <ThemedText style={[styles.timelineDetail, presentationMode ? styles.timelineDetailPresentation : null]}>{item.detail}</ThemedText>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.auditActionRow}>
        <ActionButton label="Reset demo" icon="restart-alt" variant="ghost" onPress={onReset} />
      </View>
    </StepCard>
  );
}

function IdeaBanner({ presentationMode }: { presentationMode: boolean }) {
  return (
    <TazeCard variant="muted" style={[styles.ideaBanner, presentationMode ? styles.ideaBannerPresentation : null]}>
      <View style={styles.ideaHeader}>
        <TazeBadge label="Our idea" tone="primary" icon="lightbulb" />
        <ThemedText type="defaultSemiBold" style={[styles.ideaTitle, presentationMode ? styles.ideaTitlePresentation : null]}>
          Bounded AI for real operations
        </ThemedText>
      </View>
      <ThemedText style={[styles.ideaCopy, presentationMode ? styles.ideaCopyPresentation : null]}>
        Our idea: Bounded AI for real operations - not hype, not chaos, but control, proof, and value.
      </ThemedText>
      <View style={styles.ideaColumns}>
        <View style={styles.ideaColumn}>
          <MaterialIcons name="shield" size={20} color={Brand.primary} />
          <ThemedText type="defaultSemiBold" style={[styles.ideaColumnTitle, presentationMode ? styles.ideaColumnTitlePresentation : null]}>
            Control with structure
          </ThemedText>
          <ThemedText style={[styles.ideaColumnCopy, presentationMode ? styles.ideaColumnCopyPresentation : null]}>
            AI works within clear roles and rules, so operations stay aligned with the business.
          </ThemedText>
        </View>
        <View style={styles.ideaColumn}>
          <MaterialIcons name="lock" size={20} color={Brand.primary} />
          <ThemedText type="defaultSemiBold" style={[styles.ideaColumnTitle, presentationMode ? styles.ideaColumnTitlePresentation : null]}>
            Privacy by design
          </ThemedText>
          <ThemedText style={[styles.ideaColumnCopy, presentationMode ? styles.ideaColumnCopyPresentation : null]}>
            Data stays inside the control boundary and nothing acts without human approval.
          </ThemedText>
        </View>
        <View style={styles.ideaColumn}>
          <MaterialIcons name="trending-up" size={20} color={Brand.primary} />
          <ThemedText type="defaultSemiBold" style={[styles.ideaColumnTitle, presentationMode ? styles.ideaColumnTitlePresentation : null]}>
            Value that lasts
          </ThemedText>
          <ThemedText style={[styles.ideaColumnCopy, presentationMode ? styles.ideaColumnCopyPresentation : null]}>
            Lower risk, better traceability and a foundation for scalable, responsible AI.
          </ThemedText>
        </View>
      </View>
    </TazeCard>
  );
}

function DemoSummary({
  displayProduct,
  suggestion,
  selectedDestination,
  confirmedAt,
  storedAt,
  presentationMode,
}: {
  displayProduct: ScannedProduct | ProductDraft;
  suggestion: Suggestion;
  selectedDestination: Destination;
  confirmedAt: string | null;
  storedAt: string | null;
  presentationMode: boolean;
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const auditComplete = Boolean(storedAt);

  const summaryText = useMemo(
    () =>
      [
        'Taze AI Demo Summary',
        `Product: ${displayProduct.name}`,
        `Category: ${displayProduct.category}`,
        `Quantity: ${displayProduct.quantity}`,
        `AI suggestion: ${suggestion.destination}`,
        `Final destination: ${selectedDestination}`,
        `Human confirmation: completed`,
        `Audit status: ${auditComplete ? '100% traceable' : 'in progress'}`,
        'Mode: Local-state prototype',
        'Core value: bounded AI for operational control, proof, and less chaos.',
      ].join('\n'),
    [auditComplete, displayProduct.category, displayProduct.name, displayProduct.quantity, selectedDestination, suggestion.destination]
  );

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const styleId = 'food-chain-print-style';
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @media print {
        body {
          background: #ffffff !important;
        }

        body * {
          visibility: hidden !important;
        }

        #food-chain-summary,
        #food-chain-summary * {
          visibility: visible !important;
        }

        #food-chain-summary {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          box-shadow: none !important;
          break-inside: avoid;
        }

        #food-chain-summary button,
        #food-chain-summary [role='button'] {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    };
  }, []);

  useEffect(() => {
    if (copyState !== 'copied') {
      return;
    }

    const timeout = setTimeout(() => setCopyState('idle'), 2200);
    return () => clearTimeout(timeout);
  }, [copyState]);

  const handlePrint = () => {
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  };

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summaryText);
      } else if (typeof document !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = summaryText;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setCopyState('copied');
    } catch {
      setCopyState('copied');
    }
  };

  if (!auditComplete) {
    return null;
  }

  return (
    <TazeCard
      nativeID="food-chain-summary"
      testID="food-chain-summary"
      variant="panel"
      style={[styles.demoSummary, presentationMode ? styles.demoSummaryPresentation : null]}>
      <View style={styles.demoSummaryHeader}>
        <View style={styles.demoSummaryHeaderCopy}>
          <TazeBadge label="Shareable export" tone="success" icon="article" />
          <ThemedText type="title" style={[styles.demoSummaryTitle, presentationMode ? styles.demoSummaryTitlePresentation : null]}>
            Taze Demo Summary
          </ThemedText>
          <ThemedText style={[styles.demoSummarySubtitle, presentationMode ? styles.demoSummarySubtitlePresentation : null]}>
            One product. One scan. One controlled decision. Full audit proof.
          </ThemedText>
        </View>

        <View style={styles.demoSummaryHeaderAside}>
          <TazeBadge label="Audit Proof Complete" tone="success" icon="check-circle" />
          <ThemedText style={[styles.demoSummaryStatus, presentationMode ? styles.demoSummaryStatusPresentation : null]}>
            100% traceable workflow
          </ThemedText>
        </View>
      </View>

      <View style={styles.demoSummaryGrid}>
        <View style={[styles.demoSummaryCard, presentationMode ? styles.demoSummaryCardPresentation : null]}>
          <ThemedText style={styles.fieldLabel}>Product</ThemedText>
          <ThemedText type="defaultSemiBold" style={[styles.demoSummaryValue, presentationMode ? styles.demoSummaryValuePresentation : null]}>
            {displayProduct.name}
          </ThemedText>
        </View>
        <View style={[styles.demoSummaryCard, presentationMode ? styles.demoSummaryCardPresentation : null]}>
          <ThemedText style={styles.fieldLabel}>Category</ThemedText>
          <ThemedText type="defaultSemiBold" style={[styles.demoSummaryValue, presentationMode ? styles.demoSummaryValuePresentation : null]}>
            {displayProduct.category}
          </ThemedText>
        </View>
        <View style={[styles.demoSummaryCard, presentationMode ? styles.demoSummaryCardPresentation : null]}>
          <ThemedText style={styles.fieldLabel}>Quantity</ThemedText>
          <ThemedText type="defaultSemiBold" style={[styles.demoSummaryValue, presentationMode ? styles.demoSummaryValuePresentation : null]}>
            {displayProduct.quantity}
          </ThemedText>
        </View>
        <View style={[styles.demoSummaryCard, presentationMode ? styles.demoSummaryCardPresentation : null]}>
          <ThemedText style={styles.fieldLabel}>AI suggestion</ThemedText>
          <ThemedText type="defaultSemiBold" style={[styles.demoSummaryValue, presentationMode ? styles.demoSummaryValuePresentation : null]}>
            {suggestion.destination}
          </ThemedText>
        </View>
        <View style={[styles.demoSummaryCard, presentationMode ? styles.demoSummaryCardPresentation : null]}>
          <ThemedText style={styles.fieldLabel}>Final destination</ThemedText>
          <ThemedText type="defaultSemiBold" style={[styles.demoSummaryValue, presentationMode ? styles.demoSummaryValuePresentation : null]}>
            {selectedDestination}
          </ThemedText>
        </View>
        <View style={[styles.demoSummaryCard, presentationMode ? styles.demoSummaryCardPresentation : null]}>
          <ThemedText style={styles.fieldLabel}>Human confirmation</ThemedText>
          <ThemedText type="defaultSemiBold" style={[styles.demoSummaryValue, presentationMode ? styles.demoSummaryValuePresentation : null]}>
            Required and completed
          </ThemedText>
        </View>
        <View style={[styles.demoSummaryCard, presentationMode ? styles.demoSummaryCardPresentation : null]}>
          <ThemedText style={styles.fieldLabel}>Audit status</ThemedText>
          <ThemedText type="defaultSemiBold" style={[styles.demoSummaryValue, presentationMode ? styles.demoSummaryValuePresentation : null]}>
            100% traceable
          </ThemedText>
        </View>
        <View style={[styles.demoSummaryCard, presentationMode ? styles.demoSummaryCardPresentation : null]}>
          <ThemedText style={styles.fieldLabel}>Mode</ThemedText>
          <ThemedText type="defaultSemiBold" style={[styles.demoSummaryValue, presentationMode ? styles.demoSummaryValuePresentation : null]}>
            Local-state prototype
          </ThemedText>
        </View>
      </View>

      <View style={styles.demoValuePanel}>
        <View style={styles.demoValuePanelHeader}>
          <TazeBadge label="Why this matters" tone="primary" icon="trending-up" />
          <ThemedText type="defaultSemiBold" style={[styles.demoValuePanelTitle, presentationMode ? styles.demoValuePanelTitlePresentation : null]}>
            Why this matters
          </ThemedText>
        </View>
        <View style={styles.demoValueList}>
          {[
            'Less operational chaos',
            'Faster product routing',
            'Human-controlled AI decisions',
            'Clear proof for audits',
            'Practical AI without black-box automation',
          ].map((bullet) => (
            <View key={bullet} style={styles.demoValueBullet}>
              <MaterialIcons name="check-circle" size={18} color="#16a34a" />
              <ThemedText style={[styles.demoValueBulletText, presentationMode ? styles.demoValueBulletTextPresentation : null]}>{bullet}</ThemedText>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.demoSummaryActions}>
        <ActionButton label="Print summary" icon="print" onPress={handlePrint} variant="secondary" />
        <ActionButton label="Copy summary" icon="content-copy" onPress={handleCopy} />
        {copyState === 'copied' ? (
          <View style={styles.demoCopySuccess}>
            <TazeBadge label="Summary copied" tone="success" icon="check-circle" />
          </View>
        ) : null}
      </View>
    </TazeCard>
  );
}

function Header({
  activeStep,
  selectedDestination,
  completion,
  status,
  presentationMode,
}: {
  activeStep: StepIndex;
  selectedDestination: Destination;
  completion: number;
  status: string;
  presentationMode: boolean;
}) {
  return (
    <TazeCard variant="panel" style={[styles.heroCard, presentationMode ? styles.heroCardPresentation : null]}>
      <View style={styles.heroRow}>
        <View style={styles.heroBrand}>
          <View style={styles.logoFrame}>
            <TazeLogo size={72} framed={false} />
          </View>
          <View style={styles.heroCopy}>
            <TazeBadge label="Taze AI" tone="success" icon="verified" />
            <ThemedText type="title" style={[styles.heroTitle, presentationMode ? styles.heroTitlePresentation : null]}>
              Taze AI: From Delivery to Audit Proof
            </ThemedText>
            <ThemedText style={[styles.heroSubtitle, presentationMode ? styles.heroSubtitlePresentation : null]}>
              One product. One scan. One controlled decision.
            </ThemedText>
            <ThemedText style={[styles.heroDescription, presentationMode ? styles.heroDescriptionPresentation : null]}>
              AI suggests the route. Staff confirms it. The audit trail keeps control visible.
            </ThemedText>
          </View>
        </View>

        <View style={styles.heroStats}>
          <StatPill label="Current step" value={`${activeStep} / 6`} />
          <StatPill label="Selected destination" value={selectedDestination} tone="accent" />
          <StatPill label="Audit proof" value={`${completion}%`} tone="success" />
        </View>
      </View>

      <View style={styles.heroPills}>
        <TazeBadge label="1 product" tone="primary" icon="inventory" />
        <TazeBadge label="1 scan" tone="accent" icon="qr-code-scanner" />
        <TazeBadge label="1 controlled decision" tone="warning" icon="verified" />
        <TazeBadge label="Audit proof" tone="success" icon="history" />
      </View>

      <View style={styles.heroStatusRow}>
        <TazeBadge label="Status" tone="info" icon="info" />
        <ThemedText style={styles.statusText}>{status}</ThemedText>
      </View>

      <View style={styles.controlStrip}>
        <TazeBadge label="AI suggests" tone="accent" icon="psychology" />
        <TazeBadge label="Staff decides" tone="warning" icon="verified" />
        <TazeBadge label="Every decision is recorded" tone="success" icon="history" />
      </View>
    </TazeCard>
  );
}

function PresentationControls({
  presentationMode,
  autoDemoMode,
  onTogglePresentationMode,
  onStartAutoDemo,
  onPauseAutoDemo,
  onResetPresentation,
}: {
  presentationMode: boolean;
  autoDemoMode: DemoMode;
  onTogglePresentationMode: () => void;
  onStartAutoDemo: () => void;
  onPauseAutoDemo: () => void;
  onResetPresentation: () => void;
}) {
  return (
    <TazeCard variant="muted" style={[styles.presentationBar, presentationMode ? styles.presentationBarActive : null]}>
      <View style={styles.presentationBarCopy}>
        <View style={styles.presentationBarHeader}>
          <TazeBadge label="Presentation" tone={presentationMode ? 'success' : 'neutral'} icon="slideshow" />
          <ThemedText type="defaultSemiBold" style={styles.presentationBarTitle}>
            Presentation Mode
          </ThemedText>
        </View>
        <ThemedText style={styles.presentationBarText}>
          {presentationMode ? 'Presentation mode active. Readable from a distance.' : 'Turn this on for live meetings, investor pitches and shared screens.'}
        </ThemedText>
        <View style={styles.presentationStateRow}>
          <TazeBadge label={presentationMode ? 'Presentation mode active' : 'Presentation mode off'} tone={presentationMode ? 'success' : 'neutral'} icon={presentationMode ? 'visibility' : 'visibility-off'} />
          <TazeBadge
            label={autoDemoMode === 'running' ? 'Auto demo running' : autoDemoMode === 'paused' ? 'Auto demo paused' : 'Auto demo idle'}
            tone={autoDemoMode === 'running' ? 'success' : autoDemoMode === 'paused' ? 'warning' : 'neutral'}
            icon="play-circle"
          />
        </View>
      </View>

      <View style={styles.presentationActions}>
        <ActionButton
          label="Presentation Mode"
          icon="slideshow"
          onPress={onTogglePresentationMode}
          variant={presentationMode ? 'primary' : 'secondary'}
        />
        {autoDemoMode === 'running' ? (
          <ActionButton label="Pause Auto Demo" icon="pause-circle" onPress={onPauseAutoDemo} variant="secondary" />
        ) : autoDemoMode === 'paused' ? (
          <ActionButton label="Resume Auto Demo" icon="play-circle" onPress={onStartAutoDemo} variant="primary" />
        ) : (
          <ActionButton label="Start Auto Demo" icon="play-circle" onPress={onStartAutoDemo} variant="primary" />
        )}
        <ActionButton label="Reset presentation" icon="restart-alt" onPress={onResetPresentation} variant="ghost" />
      </View>
    </TazeCard>
  );
}

export default function FoodChainScreen() {
  const { pagePadding, pageMaxWidth, isWide, isTablet } = useResponsiveLayout();

  const [productName, setProductName] = useState(SAMPLE_PRODUCT.name);
  const [productCategory, setProductCategory] = useState(SAMPLE_PRODUCT.category);
  const [productBarcode, setProductBarcode] = useState(SAMPLE_PRODUCT.barcode);
  const [productQuantity, setProductQuantity] = useState(String(SAMPLE_PRODUCT.quantity));
  const [receivedBy, setReceivedBy] = useState(SAMPLE_PRODUCT.receivedBy);

  const [receivedAt, setReceivedAt] = useState<string | null>(null);
  const [scannedAt, setScannedAt] = useState<string | null>(null);
  const [suggestedAt, setSuggestedAt] = useState<string | null>(null);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [storedAt, setStoredAt] = useState<string | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<Destination>('Top Bar');
  const [scannedProduct, setScannedProduct] = useState<ScannedProduct | null>(null);
  const [staffOverrideAt, setStaffOverrideAt] = useState<string | null>(null);
  const [staffOverrideFrom, setStaffOverrideFrom] = useState<Destination | null>(null);
  const [staffOverrideTo, setStaffOverrideTo] = useState<Destination | null>(null);
  const [status, setStatus] = useState('Mark the delivery received to begin.');
  const [presentationMode, setPresentationMode] = useState(false);
  const [autoDemoMode, setAutoDemoMode] = useState<DemoMode>('idle');

  const currentDraft: ProductDraft = useMemo(
    () => ({
      name: productName.trim() || SAMPLE_PRODUCT.name,
      category: productCategory.trim() || SAMPLE_PRODUCT.category,
      barcode: productBarcode.trim() || SAMPLE_PRODUCT.barcode,
      quantity: Number(productQuantity) || SAMPLE_PRODUCT.quantity,
      receivedBy: receivedBy.trim() || SAMPLE_PRODUCT.receivedBy,
    }),
    [productBarcode, productCategory, productName, productQuantity, receivedBy]
  );

  const displayProduct = scannedProduct ?? currentDraft;
  const suggestion = useMemo(() => buildSuggestion(displayProduct), [displayProduct]);
  const activeStep = stepIndexFromState(receivedAt, scannedAt, suggestedAt, confirmedAt, sentAt);

  const timeline = useMemo<TimelineEntry[]>(
    () => [
      {
        title: 'Delivery received',
        detail: `${displayProduct.receivedBy} registered the inbound delivery.`,
        timestamp: receivedAt,
        done: Boolean(receivedAt),
      },
      {
        title: 'Product scanned',
        detail: `${displayProduct.name} - ${displayProduct.barcode}`,
        timestamp: scannedAt,
        done: Boolean(scannedAt),
      },
      {
        title: 'AI suggestion generated',
        detail: `${suggestion.destination} suggested with ${suggestion.confidence}% confidence.`,
        timestamp: suggestedAt,
        done: Boolean(suggestedAt),
      },
      {
        title: staffOverrideAt ? 'Staff changed destination' : 'Staff confirmed',
        detail: staffOverrideAt && staffOverrideFrom && staffOverrideTo
          ? `Staff overrode the AI suggestion: ${staffOverrideFrom} -> ${staffOverrideTo}.`
          : `Staff confirmed ${selectedDestination} with no override.`,
        timestamp: confirmedAt,
        done: Boolean(confirmedAt),
      },
      {
        title: 'Sent to destination',
        detail: `${selectedDestination} received ${displayProduct.quantity} unit${displayProduct.quantity === 1 ? '' : 's'}.`,
        timestamp: sentAt,
        done: Boolean(sentAt),
      },
      {
        title: 'Audit record stored',
        detail: 'Audit proof is complete and ready to review.',
        timestamp: storedAt,
        done: Boolean(storedAt),
      },
    ],
    [confirmedAt, displayProduct.barcode, displayProduct.name, displayProduct.quantity, displayProduct.receivedBy, receivedAt, scannedAt, selectedDestination, sentAt, staffOverrideAt, staffOverrideFrom, staffOverrideTo, storedAt, suggestion.confidence, suggestion.destination, suggestedAt]
  );

  const completion = useMemo(() => Math.round((timeline.filter((item) => item.done).length / timeline.length) * 100), [timeline]);
  const auditComplete = Boolean(storedAt);
  const canReceive = Boolean(productName.trim() && productCategory.trim() && productBarcode.trim() && productQuantity.trim() && receivedBy.trim());
  const canScan = Boolean(receivedAt);
  const canConfirm = Boolean(scannedAt && suggestedAt);
  const canSend = Boolean(confirmedAt);
  const completedSteps: StepIndex[] = [
    receivedAt ? 1 : null,
    scannedAt ? 2 : null,
    suggestedAt ? 3 : null,
    confirmedAt ? 4 : null,
    sentAt ? 5 : null,
    storedAt ? 6 : null,
  ].filter(Boolean) as StepIndex[];

  const resetWorkflow = () => {
    animateWorkflowTransition();
    setProductName(SAMPLE_PRODUCT.name);
    setProductCategory(SAMPLE_PRODUCT.category);
    setProductBarcode(SAMPLE_PRODUCT.barcode);
    setProductQuantity(String(SAMPLE_PRODUCT.quantity));
    setReceivedBy(SAMPLE_PRODUCT.receivedBy);

    setReceivedAt(null);
    setScannedAt(null);
    setSuggestedAt(null);
    setConfirmedAt(null);
    setSentAt(null);
    setStoredAt(null);
    setSelectedDestination('Top Bar');
    setScannedProduct(null);
    setStaffOverrideAt(null);
    setStaffOverrideFrom(null);
    setStaffOverrideTo(null);
    setAutoDemoMode('idle');
    setStatus('Mark the delivery received to begin.');
  };

  const resetPresentation = () => {
    resetWorkflow();
    setPresentationMode(false);
    setAutoDemoMode('idle');
    setStatus('Presentation mode reset. Ready for a new demo.');
  };

  const handleReceive = () => {
    if (!canReceive) {
      setStatus('Fill in the delivery details first.');
      return;
    }

    animateWorkflowTransition();
    setReceivedAt(createStamp());
    setStatus('Delivery received. Scan the product next.');
  };

  const handleScan = () => {
    if (!canScan) {
      setStatus('Receive the delivery before scanning the product.');
      return;
    }

    animateWorkflowTransition();
    const now = createStamp();
    const snapshot: ScannedProduct = {
      ...currentDraft,
      scannedAt: now,
    };
    const nextSuggestion = buildSuggestion(snapshot);

    setScannedProduct(snapshot);
    setScannedAt(now);
    setSuggestedAt(now);
    setSelectedDestination(nextSuggestion.destination);
    setConfirmedAt(null);
    setSentAt(null);
    setStoredAt(null);
    setStaffOverrideAt(null);
    setStaffOverrideFrom(null);
    setStaffOverrideTo(null);
    setStatus(`Product scanned. AI suggests ${nextSuggestion.destination}. Human confirmation is next.`);
  };

  const handleSelectDestination = (destination: Destination) => {
    if (!scannedAt) {
      setStatus('Scan the product before changing the destination.');
      return;
    }

    if (destination === selectedDestination) {
      setStatus(destination === suggestion.destination ? 'Destination matches the AI suggestion.' : `Destination set to ${destination}.`);
      return;
    }

    animateWorkflowTransition();
    if (!staffOverrideAt && destination !== suggestion.destination) {
      setStaffOverrideAt(createStamp());
      setStaffOverrideFrom(selectedDestination);
      setStaffOverrideTo(destination);
    } else if (staffOverrideAt && destination !== suggestion.destination) {
      setStaffOverrideTo(destination);
    }

    setSelectedDestination(destination);
    setConfirmedAt(null);
    setSentAt(null);
    setStoredAt(null);

    if (destination === suggestion.destination) {
      setStatus(`Destination aligned with the AI suggestion: ${destination}.`);
    } else {
      setStatus(`Staff changed the AI suggestion to ${destination}.`);
    }
  };

  const handleConfirm = () => {
    if (!canConfirm) {
      setStatus('Scan the product before confirming.');
      return;
    }

    animateWorkflowTransition();
    setConfirmedAt(createStamp());
    setStatus(`AI suggests. Staff decides. ${selectedDestination} is approved for routing.`);
  };

  const handleChangeDestination = () => {
    handleSelectDestination(selectedDestination === 'Top Bar' ? 'Kitchen' : 'Top Bar');
  };

  const handleSend = () => {
    if (!canSend) {
      setStatus('Confirm the destination before sending.');
      return;
    }

    animateWorkflowTransition();
    const now = createStamp();
    setSentAt(now);
    setStoredAt(now);
    setStatus(`Routed to ${selectedDestination}. Audit proof created and stored.`);
  };

  const togglePresentationMode = () => {
    animateWorkflowTransition();
    const next = !presentationMode;
    setPresentationMode(next);
    setStatus(next ? 'Presentation mode active. Use the demo controls to guide the room.' : 'Interactive mode restored.');
  };

  const startAutoDemo = () => {
    animateWorkflowTransition();

    if (autoDemoMode === 'paused') {
      setAutoDemoMode('running');
      setStatus('Auto demo resumed. AI suggests. Staff decides.');
      return;
    }

    resetWorkflow();
    setAutoDemoMode('running');
    setStatus('Auto demo started. The workflow will progress step by step.');
  };

  const pauseAutoDemo = () => {
    animateWorkflowTransition();
    setAutoDemoMode('paused');
    setStatus('Auto demo paused. Resume or reset to continue.');
  };

  useEffect(() => {
    if (autoDemoMode !== 'running') {
      return;
    }

    if (storedAt) {
      setAutoDemoMode('idle');
      return;
    }

    const timeout = setTimeout(() => {
      if (!receivedAt) {
        handleReceive();
        return;
      }

      if (!scannedAt) {
        handleScan();
        return;
      }

      if (!confirmedAt) {
        handleConfirm();
        return;
      }

      if (!sentAt) {
        handleSend();
        return;
      }

      if (!storedAt) {
        setAutoDemoMode('idle');
      }
    }, presentationMode ? 2500 : 1800);

    return () => clearTimeout(timeout);
  }, [autoDemoMode, confirmedAt, handleConfirm, handleReceive, handleScan, handleSend, presentationMode, receivedAt, scannedAt, sentAt, storedAt]);

  const shellMaxWidth = presentationMode ? (isWide ? 1440 : isTablet ? 1280 : 1160) : pageMaxWidth;
  const shellPadding = presentationMode ? pagePadding + 8 : pagePadding;

  return (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingHorizontal: shellPadding }]}>
      <ThemedView style={[styles.page, { maxWidth: shellMaxWidth }, presentationMode ? styles.pagePresentation : null]}>
        <Header
          activeStep={activeStep}
          selectedDestination={selectedDestination}
          completion={auditComplete ? 100 : completion}
          status={status}
          presentationMode={presentationMode}
        />

        <PresentationControls
          presentationMode={presentationMode}
          autoDemoMode={autoDemoMode}
          onTogglePresentationMode={togglePresentationMode}
          onStartAutoDemo={startAutoDemo}
          onPauseAutoDemo={pauseAutoDemo}
          onResetPresentation={resetPresentation}
        />

        <StepRail activeStep={activeStep} completed={completedSteps} presentationMode={presentationMode} />

        <NarrationStrip activeStep={activeStep} presentationMode={presentationMode} />

        <View style={[styles.grid, presentationMode ? styles.gridPresentation : null]}>
          <DeliveryCard
            product={currentDraft}
            onChangeName={setProductName}
            onChangeCategory={setProductCategory}
            onChangeBarcode={setProductBarcode}
            onChangeQuantity={setProductQuantity}
            onChangeReceivedBy={setReceivedBy}
            onReceive={handleReceive}
            onReset={resetWorkflow}
            canReceive={canReceive}
            receivedAt={receivedAt}
            presentationMode={presentationMode}
          />

          <ProductScanCard
            product={currentDraft}
            receivedAt={receivedAt}
            scannedProduct={scannedProduct}
            scannedAt={scannedAt}
            onScan={handleScan}
            presentationMode={presentationMode}
          />

          <AISuggestionCard
            ready={Boolean(scannedAt)}
            suggestion={suggestion}
            scannedAt={scannedAt}
            confirmedAt={confirmedAt}
            presentationMode={presentationMode}
          />

          <ConfirmationCard
            ready={Boolean(scannedAt)}
            suggestion={suggestion}
            selectedDestination={selectedDestination}
            onConfirm={handleConfirm}
            onChangeDestination={handleChangeDestination}
            scannedAt={scannedAt}
            confirmedAt={confirmedAt}
            presentationMode={presentationMode}
          />

          <DestinationCard
            suggestion={suggestion}
            selectedDestination={selectedDestination}
            confirmedAt={confirmedAt}
            sentAt={sentAt}
            onSelect={handleSelectDestination}
            onSend={handleSend}
            staffOverrideAt={staffOverrideAt}
            staffOverrideFrom={staffOverrideFrom}
            staffOverrideTo={staffOverrideTo}
            presentationMode={presentationMode}
          />

          <AuditTrail
            timeline={timeline}
            completion={auditComplete ? 100 : completion}
            confirmedAt={confirmedAt}
            storedAt={storedAt}
            sentAt={sentAt}
            onReset={resetWorkflow}
            selectedDestination={selectedDestination}
            displayProduct={displayProduct}
            staffOverrideAt={staffOverrideAt}
            staffOverrideFrom={staffOverrideFrom}
            staffOverrideTo={staffOverrideTo}
            presentationMode={presentationMode}
          />
        </View>

        <DemoSummary
          displayProduct={displayProduct}
          suggestion={suggestion}
          selectedDestination={selectedDestination}
          confirmedAt={confirmedAt}
          storedAt={storedAt}
          presentationMode={presentationMode}
        />

        <IdeaBanner presentationMode={presentationMode} />

        <ThemedText style={[styles.footerNote, presentationMode ? styles.footerNotePresentation : null]}>
          AI must serve the operation - not create another black box.
        </ThemedText>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    backgroundColor: '#f7f9fc',
    alignItems: 'center',
  },
  page: {
    width: '100%',
    maxWidth: 1280,
    gap: 16,
  },
  heroCard: {
    gap: 18,
    padding: 24,
    backgroundColor: '#ffffff',
  },
  heroCardPresentation: {
    gap: 20,
    padding: 28,
  },
  heroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  heroBrand: {
    flexDirection: 'row',
    flex: 1,
    gap: 16,
    minWidth: 320,
    alignItems: 'flex-start',
  },
  logoFrame: {
    width: 80,
    height: 80,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: Brand.dark,
    boxShadow: '0px 14px 28px rgba(5, 8, 22, 0.16)',
  },
  heroCopy: {
    flex: 1,
    gap: 8,
  },
  heroTitle: {
    color: '#0f1f3b',
  },
  heroTitlePresentation: {
    fontSize: 42,
    lineHeight: 48,
  },
  heroSubtitle: {
    color: '#163055',
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
  },
  heroSubtitlePresentation: {
    fontSize: 22,
    lineHeight: 30,
  },
  heroDescription: {
    color: '#475569',
    maxWidth: 760,
  },
  heroDescriptionPresentation: {
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 860,
  },
  heroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    minWidth: 280,
    justifyContent: 'flex-end',
    flex: 1,
  },
  statPill: {
    minWidth: 160,
    flexGrow: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dbe7f2',
    backgroundColor: '#f8fbff',
    padding: 16,
    gap: 6,
  },
  statPillAccent: {
    borderColor: 'rgba(37, 99, 235, 0.18)',
    backgroundColor: '#f4f7ff',
  },
  statPillSuccess: {
    borderColor: 'rgba(22, 163, 74, 0.18)',
    backgroundColor: '#f0fdf4',
  },
  statLabel: {
    color: '#64748b',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statValue: {
    color: '#0f1f3b',
    fontSize: 18,
    lineHeight: 22,
  },
  heroPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroStatusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#f8fbff',
    borderWidth: 1,
    borderColor: '#dbe7f2',
  },
  statusText: {
    color: '#0f1f3b',
    flex: 1,
    minWidth: 220,
  },
  controlStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stepRailCard: {
    gap: 14,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  sectionTitle: {
    color: '#0f1f3b',
  },
  stepRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'stretch',
  },
  stepChip: {
    flex: 1,
    minWidth: 210,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    backgroundColor: '#ffffff',
  },
  stepChipIdle: {
    borderColor: '#dbe7f2',
    backgroundColor: '#fbfdff',
    opacity: 0.96,
  },
  stepChipActive: {
    borderColor: 'rgba(37, 99, 235, 0.24)',
    backgroundColor: '#f8fbff',
  },
  stepChipDone: {
    borderColor: 'rgba(22, 163, 74, 0.22)',
    backgroundColor: '#f0fdf4',
  },
  stepCircle: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleIdle: {
    backgroundColor: '#172554',
  },
  stepCircleActive: {
    backgroundColor: Brand.primary,
  },
  stepCircleDone: {
    backgroundColor: '#16a34a',
  },
  stepCircleText: {
    color: Brand.white,
    fontSize: 12,
  },
  stepChipCopy: {
    flex: 1,
    gap: 3,
  },
  stepChipTitle: {
    color: '#0f1f3b',
    fontSize: 14,
    lineHeight: 18,
  },
  stepChipTitleActive: {
    color: Brand.primary,
  },
  stepChipDetail: {
    color: '#64748b',
    fontSize: 12.5,
    lineHeight: 18,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  stepCard: {
    flexGrow: 1,
    flexBasis: 380,
    minWidth: 320,
    gap: 14,
    boxShadow: '0px 12px 26px rgba(15, 23, 42, 0.04)',
  },
  stepCardIdle: {
    backgroundColor: '#ffffff',
  },
  stepCardActive: {
    backgroundColor: '#f8fbff',
  },
  stepCardDone: {
    backgroundColor: '#f0fdf4',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  sectionNumberWrap: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#172554',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionNumber: {
    color: Brand.white,
    fontSize: 12,
  },
  stepCardTitle: {
    color: '#0f1f3b',
    fontSize: 22,
    lineHeight: 28,
  },
  stepBody: {
    color: '#475569',
  },
  twoColumnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  inputColumn: {
    flexGrow: 1,
    flexBasis: 320,
    gap: 12,
  },
  previewColumn: {
    flexGrow: 1,
    flexBasis: 260,
    gap: 12,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: '#334155',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d9e3ee',
    backgroundColor: '#ffffff',
    color: '#0f1f3b',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  inlineFieldRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  inlineField: {
    flexGrow: 1,
    flexBasis: 140,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  actionButton: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
  },
  actionButtonPrimary: {
    backgroundColor: Brand.primary,
    borderColor: Brand.primary,
  },
  actionButtonSecondary: {
    backgroundColor: '#f8fbff',
    borderColor: '#dbe7f2',
  },
  actionButtonGhost: {
    backgroundColor: '#ffffff',
    borderColor: '#dbe7f2',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonPressed: {
    opacity: 0.92,
  },
  actionButtonText: {
    color: '#0f1f3b',
  },
  actionButtonTextPrimary: {
    color: Brand.white,
  },
  cartonWrap: {
    borderRadius: 22,
    backgroundColor: '#f8fbff',
    borderWidth: 1,
    borderColor: '#dbe7f2',
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartonBody: {
    width: '100%',
    minHeight: 188,
    borderRadius: 24,
    backgroundColor: '#172554',
    padding: 16,
    gap: 10,
    boxShadow: '0px 16px 28px rgba(15, 23, 42, 0.18)',
  },
  cartonCap: {
    width: 52,
    height: 18,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    alignSelf: 'center',
    backgroundColor: '#dbeafe',
  },
  cartonBrand: {
    color: '#dbeafe',
    fontSize: 14,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  cartonTitle: {
    color: Brand.white,
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'center',
  },
  cartonQuantity: {
    color: '#dbeafe',
    textAlign: 'center',
  },
  barcodeBand: {
    marginTop: 4,
    borderRadius: 18,
    backgroundColor: '#f8fbff',
    padding: 12,
    gap: 8,
  },
  barcodeBars: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  barLine: {
    width: 3,
    height: 28,
    backgroundColor: '#172554',
    borderRadius: 999,
  },
  barLineWide: {
    width: 5,
    height: 28,
    backgroundColor: '#172554',
    borderRadius: 999,
  },
  barLineNarrow: {
    width: 2,
  },
  barcodeText: {
    color: '#0f1f3b',
    textAlign: 'center',
    fontSize: 12,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  cartonCheck: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  previewFacts: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dbe7f2',
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 10,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  metricLabel: {
    color: '#64748b',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    color: '#0f1f3b',
    textAlign: 'right',
    flexShrink: 1,
  },
  scanColumn: {
    flexGrow: 1,
    flexBasis: 320,
    gap: 12,
  },
  scanBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 20,
    backgroundColor: '#f4f7ff',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.18)',
    padding: 14,
  },
  scanBannerCopy: {
    flex: 1,
    gap: 4,
  },
  scanBannerTitle: {
    color: '#163055',
    fontSize: 18,
  },
  scanBannerText: {
    color: '#475569',
  },
  scanDisplay: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dbe7f2',
    backgroundColor: '#f8fbff',
    padding: 14,
    gap: 12,
  },
  scanDisplayTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  scanTime: {
    color: '#64748b',
    fontSize: 12.5,
  },
  scanDisplayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  scanDisplayItem: {
    flexBasis: 140,
    flexGrow: 1,
    gap: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbe7f2',
    backgroundColor: '#ffffff',
    padding: 12,
  },
  scanDisplayLabel: {
    color: '#64748b',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  scanDisplayValue: {
    color: '#0f1f3b',
  },
  helperText: {
    color: '#64748b',
    fontStyle: 'italic',
  },
  scanStatusBox: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dbe7f2',
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 8,
  },
  scanStatusValue: {
    color: '#0f1f3b',
    fontSize: 18,
  },
  suggestionCard: {
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.18)',
    backgroundColor: '#f4f7ff',
    padding: 16,
  },
  suggestionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  suggestionLabel: {
    color: '#64748b',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  suggestionValue: {
    color: '#163055',
    fontSize: 24,
    lineHeight: 30,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#dbe7f2',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#16a34a',
  },
  suggestionReason: {
    color: '#334155',
  },
  suggestionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  suggestionMiniCard: {
    flexBasis: 160,
    flexGrow: 1,
    gap: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbe7f2',
    backgroundColor: '#ffffff',
    padding: 12,
  },
  driverRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  confirmationBox: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dbe7f2',
    backgroundColor: '#f8fbff',
    padding: 16,
    gap: 6,
  },
  confirmationValue: {
    color: '#0f1f3b',
    fontSize: 24,
    lineHeight: 30,
  },
  confirmationDetail: {
    color: '#475569',
  },
  destinationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  destinationMetaCard: {
    gap: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.18)',
    backgroundColor: '#f8fbff',
    padding: 14,
  },
  destinationMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  destinationMetaText: {
    color: '#163055',
    flex: 1,
    minWidth: 220,
  },
  destinationMetaHint: {
    color: '#475569',
  },
  destinationTile: {
    flexBasis: 180,
    flexGrow: 1,
    gap: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dbe7f2',
    backgroundColor: '#ffffff',
    padding: 14,
  },
  destinationTileSelected: {
    borderColor: 'rgba(22, 163, 74, 0.5)',
    backgroundColor: '#f0fdf4',
  },
  destinationTileSuggested: {
    borderColor: 'rgba(37, 99, 235, 0.3)',
    backgroundColor: '#f4f7ff',
  },
  destinationTilePressed: {
    opacity: 0.92,
  },
  destinationTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  destinationTitle: {
    color: '#0f1f3b',
    fontSize: 18,
  },
  destinationDetail: {
    color: '#475569',
  },
  destinationSuggestedText: {
    color: '#0f766e',
    fontSize: 12.5,
    fontStyle: 'italic',
  },
  auditSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  auditSummaryCard: {
    flexBasis: 140,
    flexGrow: 1,
    gap: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#dbe7f2',
    backgroundColor: '#ffffff',
    padding: 14,
  },
  auditSummaryCardPresentation: {
    minWidth: 180,
    padding: 16,
  },
  auditSummaryValue: {
    color: '#0f1f3b',
  },
  auditTrail: {
    gap: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#dbe7f2',
    backgroundColor: '#ffffff',
    padding: 14,
  },
  timelineIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fbff',
    borderWidth: 1,
  },
  timelineIconWrapDone: {
    borderColor: 'rgba(22, 163, 74, 0.2)',
  },
  timelineIconWrapPending: {
    borderColor: '#dbe7f2',
  },
  timelineCopy: {
    flex: 1,
    gap: 4,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  timelineTitle: {
    color: '#0f1f3b',
  },
  timelineTime: {
    color: '#64748b',
    fontSize: 12.5,
  },
  timelineDetail: {
    color: '#475569',
  },
  auditActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  ideaBanner: {
    gap: 14,
    padding: 20,
  },
  ideaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  ideaTitle: {
    color: '#0f1f3b',
  },
  ideaCopy: {
    color: '#475569',
  },
  ideaColumns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  ideaColumn: {
    flexBasis: 240,
    flexGrow: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dbe7f2',
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 8,
  },
  ideaColumnTitle: {
    color: '#0f1f3b',
  },
  ideaColumnCopy: {
    color: '#475569',
  },
  demoSummary: {
    gap: 16,
    padding: 22,
    backgroundColor: '#ffffff',
  },
  demoSummaryPresentation: {
    padding: 28,
    gap: 18,
  },
  demoSummaryHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  demoSummaryHeaderCopy: {
    flex: 1,
    minWidth: 280,
    gap: 8,
  },
  demoSummaryHeaderAside: {
    gap: 6,
    alignItems: 'flex-end',
    minWidth: 220,
  },
  demoSummaryTitle: {
    color: '#0f1f3b',
  },
  demoSummaryTitlePresentation: {
    fontSize: 30,
    lineHeight: 36,
  },
  demoSummarySubtitle: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 820,
  },
  demoSummarySubtitlePresentation: {
    fontSize: 18,
    lineHeight: 26,
    maxWidth: 920,
  },
  demoSummaryStatus: {
    color: '#16a34a',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  demoSummaryStatusPresentation: {
    fontSize: 14,
    lineHeight: 20,
  },
  demoSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  demoSummaryCard: {
    flexBasis: 160,
    flexGrow: 1,
    gap: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#dbe7f2',
    backgroundColor: '#f8fbff',
    padding: 14,
  },
  demoSummaryCardPresentation: {
    minWidth: 190,
    padding: 16,
  },
  demoSummaryValue: {
    color: '#0f1f3b',
    fontSize: 18,
    lineHeight: 24,
  },
  demoSummaryValuePresentation: {
    fontSize: 20,
    lineHeight: 26,
  },
  demoValuePanel: {
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.18)',
    backgroundColor: '#f4f7ff',
    padding: 18,
  },
  demoValuePanelHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  demoValuePanelTitle: {
    color: '#0f1f3b',
  },
  demoValuePanelTitlePresentation: {
    fontSize: 18,
    lineHeight: 24,
  },
  demoValueList: {
    gap: 10,
  },
  demoValueBullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  demoValueBulletText: {
    flex: 1,
    color: '#334155',
  },
  demoValueBulletTextPresentation: {
    fontSize: 15,
    lineHeight: 22,
  },
  demoSummaryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  demoCopySuccess: {
    justifyContent: 'center',
  },
  presentationBar: {
    gap: 12,
    padding: 18,
  },
  presentationBarActive: {
    backgroundColor: '#f0fdf4',
  },
  presentationBarCopy: {
    gap: 8,
    flex: 1,
  },
  presentationBarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  presentationBarTitle: {
    color: '#0f1f3b',
    fontSize: 18,
    lineHeight: 24,
  },
  presentationBarText: {
    color: '#475569',
  },
  presentationStateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presentationActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  pagePresentation: {
    gap: 20,
  },
  gridPresentation: {
    gap: 20,
  },
  stepRailCardPresentation: {
    padding: 24,
  },
  sectionTitlePresentation: {
    fontSize: 18,
    lineHeight: 24,
  },
  stepRailPresentation: {
    gap: 14,
  },
  stepChipPresentation: {
    minWidth: 240,
    padding: 18,
    gap: 12,
  },
  stepChipIdlePresentation: {
    opacity: 0.75,
  },
  stepChipActivePresentation: {
    borderColor: 'rgba(37, 99, 235, 0.34)',
    backgroundColor: '#eff6ff',
    opacity: 1,
  },
  stepChipDonePresentation: {
    borderColor: 'rgba(22, 163, 74, 0.32)',
    backgroundColor: '#ecfdf5',
    opacity: 1,
  },
  stepCircleTextPresentation: {
    fontSize: 13,
  },
  stepChipTitlePresentation: {
    fontSize: 15,
    lineHeight: 20,
  },
  stepChipDetailPresentation: {
    fontSize: 13,
    lineHeight: 19,
  },
  narrationCard: {
    padding: 16,
    gap: 10,
  },
  narrationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  narrationPill: {
    flexBasis: 180,
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbe7f2',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  narrationPillDone: {
    borderColor: 'rgba(22, 163, 74, 0.18)',
    backgroundColor: '#f0fdf4',
  },
  narrationPillActive: {
    borderColor: 'rgba(37, 99, 235, 0.24)',
    backgroundColor: '#eff6ff',
  },
  narrationStep: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
  },
  narrationStepActive: {
    color: '#0f1f3b',
  },
  stepCardPresentation: {
    minWidth: 360,
  },
  stepCardIdlePresentation: {
    opacity: 0.9,
  },
  stepCardActivePresentation: {
    borderColor: 'rgba(37, 99, 235, 0.24)',
    shadowOpacity: 0.08,
  },
  stepCardDonePresentation: {
    borderColor: 'rgba(22, 163, 74, 0.24)',
    shadowOpacity: 0.08,
  },
  stepCardTitlePresentation: {
    fontSize: 24,
    lineHeight: 30,
  },
  stepBodyPresentation: {
    fontSize: 15,
    lineHeight: 22,
  },
  fieldLabelPresentation: {
    fontSize: 12.5,
    letterSpacing: 0.7,
  },
  previewFactsPresentation: {
    padding: 16,
    gap: 12,
  },
  scanBannerPresentation: {
    padding: 18,
    gap: 14,
  },
  scanBannerTitlePresentation: {
    fontSize: 20,
  },
  scanBannerTextPresentation: {
    fontSize: 15,
    lineHeight: 22,
  },
  scanDisplayPresentation: {
    padding: 18,
    gap: 14,
  },
  scanDisplayItemPresentation: {
    padding: 14,
    borderRadius: 18,
  },
  scanDisplayLabelPresentation: {
    fontSize: 12.5,
  },
  scanDisplayValuePresentation: {
    fontSize: 16,
    lineHeight: 22,
  },
  helperTextPresentation: {
    fontSize: 14,
    lineHeight: 20,
  },
  scanStatusBoxPresentation: {
    padding: 18,
    gap: 10,
  },
  scanStatusValuePresentation: {
    fontSize: 20,
  },
  suggestionCardPresentation: {
    padding: 18,
    gap: 14,
  },
  suggestionLabelPresentation: {
    fontSize: 12.5,
  },
  suggestionValuePresentation: {
    fontSize: 28,
    lineHeight: 34,
  },
  suggestionReasonPresentation: {
    fontSize: 15,
    lineHeight: 22,
  },
  suggestionMiniCardPresentation: {
    padding: 14,
    borderRadius: 18,
  },
  confirmationBoxPresentation: {
    padding: 18,
    gap: 8,
  },
  confirmationValuePresentation: {
    fontSize: 28,
    lineHeight: 34,
  },
  confirmationDetailPresentation: {
    fontSize: 15,
    lineHeight: 22,
  },
  destinationMetaCardPresentation: {
    padding: 16,
    gap: 10,
  },
  destinationMetaTextPresentation: {
    fontSize: 15,
    lineHeight: 22,
  },
  destinationMetaHintPresentation: {
    fontSize: 14,
    lineHeight: 20,
  },
  destinationTitlePresentation: {
    fontSize: 20,
    lineHeight: 26,
  },
  destinationDetailPresentation: {
    fontSize: 15,
    lineHeight: 22,
  },
  destinationSuggestedTextPresentation: {
    fontSize: 13,
    lineHeight: 18,
  },
  auditCompleteBanner: {
    gap: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.18)',
    backgroundColor: '#f0fdf4',
    padding: 18,
  },
  auditCompleteBannerPresentation: {
    padding: 20,
  },
  auditCompleteHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  auditCompleteTitle: {
    color: '#0f1f3b',
    fontSize: 20,
    lineHeight: 26,
  },
  auditCompleteTitlePresentation: {
    fontSize: 24,
    lineHeight: 30,
  },
  auditCompleteCopy: {
    color: '#334155',
  },
  auditCompleteCopyPresentation: {
    fontSize: 15,
    lineHeight: 22,
  },
  auditCompleteSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  auditCompleteSummaryCard: {
    flexBasis: 150,
    flexGrow: 1,
    gap: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#dbe7f2',
    backgroundColor: '#ffffff',
    padding: 14,
  },
  auditCompleteSummaryCardPresentation: {
    minWidth: 200,
    padding: 16,
  },
  auditSummaryValuePresentation: {
    fontSize: 17,
    lineHeight: 22,
  },
  timelineItemPresentation: {
    padding: 16,
  },
  timelineTitlePresentation: {
    fontSize: 15,
    lineHeight: 20,
  },
  timelineTimePresentation: {
    fontSize: 13,
  },
  timelineDetailPresentation: {
    fontSize: 14,
    lineHeight: 20,
  },
  ideaBannerPresentation: {
    padding: 24,
    gap: 16,
  },
  ideaTitlePresentation: {
    fontSize: 20,
    lineHeight: 26,
  },
  ideaCopyPresentation: {
    fontSize: 15,
    lineHeight: 22,
  },
  ideaColumnTitlePresentation: {
    fontSize: 15,
    lineHeight: 21,
  },
  ideaColumnCopyPresentation: {
    fontSize: 14,
    lineHeight: 20,
  },
  footerNotePresentation: {
    fontSize: 20,
    lineHeight: 28,
  },
  footerNote: {
    textAlign: 'center',
    color: '#163055',
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
    paddingBottom: 8,
  },
});
