import { useCallback, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { TazeBadge } from 'components/taze-badge';
import { TazeButton } from 'components/taze-button';
import { TazeCard } from 'components/taze-card';
import { TazeLogo } from 'components/taze-logo';
import { ThemedText } from 'components/themed-text';
import { Brand } from 'constants/theme';
import { useResponsiveLayout } from 'hooks/use-responsive-layout';
import {
  assignInvoiceNumber,
  canAssignInvoiceNumber,
  canPrepareInvoicePaymentStatus,
  canQueueInvoiceCustomerMail,
  canRunFinalInvoiceControl,
  canReviewInvoiceConcept,
  createInvoiceConcept,
  prepareInvoicePaymentStatus,
  queueInvoiceCustomerMail,
  runFinalInvoiceControl,
  reviewInvoiceConcept,
  type InvoiceConcept,
} from 'lib/invoice-model';

async function openUrl(url: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.assign(url);
    return;
  }

  await Linking.openURL(url);
}

export function InvoiceGatewayPage() {
  const { isCompact } = useResponsiveLayout();
  const [invoiceConcept, setInvoiceConcept] = useState<InvoiceConcept>(() => createInvoiceConcept());

  const openPublic = useCallback(() => {
    void openUrl('https://taze.to/').catch(() => {});
  }, []);

  const handleReviewInvoiceConcept = useCallback(() => {
    setInvoiceConcept((current) => reviewInvoiceConcept(current));
  }, []);

  const handleAssignInvoiceNumber = useCallback(() => {
    setInvoiceConcept((current) => assignInvoiceNumber(current));
  }, []);

  const handlePreparePaymentStatus = useCallback(() => {
    setInvoiceConcept((current) => prepareInvoicePaymentStatus(current));
  }, []);

  const handleQueueCustomerMail = useCallback(() => {
    setInvoiceConcept((current) => queueInvoiceCustomerMail(current));
  }, []);

  const handleRunFinalInvoiceControl = useCallback(() => {
    setInvoiceConcept((current) => runFinalInvoiceControl(current));
  }, []);

  const isReviewed = invoiceConcept.statusLabel === 'gecontroleerd';
  const isAssigned = invoiceConcept.invoiceNumberStatusLabel === 'toegewezen';
  const isPaymentPrepared = invoiceConcept.paymentStatusLabel === 'Klaar voor betaling';
  const isMailQueued = invoiceConcept.mailStatusLabel === 'Klaar voor verzending';
  const isFinalReady = invoiceConcept.executionStatusLabel === 'klaar voor uitvoering';
  const controlDisplayLabel = isReviewed ? 'Uitgevoerd' : 'Vereist';
  const workflowStageLabel = isFinalReady
    ? 'Klaar voor uitvoering'
    : isMailQueued
      ? 'Laatste controle'
      : isPaymentPrepared
        ? 'Klantmail klaarzetten'
        : isAssigned
          ? 'Bereid betaalstatus voor'
          : isReviewed
            ? 'Wijs factuurnummer toe'
            : 'Controleer factuurconcept';
  const workflowStageHint = isFinalReady
    ? 'Facturatie is klaar om verder te gaan.'
    : isMailQueued
      ? 'De laatste controle staat nu klaar.'
      : isPaymentPrepared
        ? 'De mailstap kan nu worden klaargezet.'
        : isAssigned
          ? 'De betaalstatus kan nu worden voorbereid.'
          : isReviewed
            ? 'Nu kan een factuurnummer worden toegewezen.'
            : 'Begin met het controleren van het factuurconcept.';

  return (
    <View style={[styles.shell, isCompact && styles.shellCompact]}>
      <TazeCard variant="panel" style={[styles.card, isCompact && styles.cardCompact]}>
        <View style={[styles.hero, isCompact && styles.heroCompact]}>
          <View style={styles.logoFrame}>
            <TazeLogo size={isCompact ? 64 : 80} framed={false} />
          </View>
          <View style={styles.copy}>
            <TazeBadge label="invoice.taze.to" tone="info" />
            <ThemedText type="title">5. Facturatie</ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.subtitle}>
              Concept, nummer, betaalstatus en mail
            </ThemedText>
            <ThemedText style={styles.description}>
              Facturatie blijft apart van scan, transport en voorraad. Je ziet elke stap in volgorde, zonder echte
              betaling of echte mail.
            </ThemedText>
            <View style={styles.workflowSummary}>
              <TazeBadge label="Volgende stap" tone="success" />
              <ThemedText type="defaultSemiBold" style={styles.workflowStageLabel}>
                {workflowStageLabel}
              </ThemedText>
              <ThemedText style={styles.workflowStageHint}>{workflowStageHint}</ThemedText>
            </View>
          </View>
        </View>

        <TazeCard variant="muted" style={[styles.sectionCard, isCompact && styles.sectionCardCompact]}>
          <View style={styles.sectionHeader}>
            <TazeBadge label="Stap 1-2" tone="info" />
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              Factuurconcept en nummer
            </ThemedText>
          </View>

          <View style={[styles.fieldGrid, isCompact && styles.fieldGridCompact]}>
            <Field label="Referentie" value={invoiceConcept.reference} compact={isCompact} />
            <Field label="Klant" value={invoiceConcept.customerLabel} compact={isCompact} />
            <Field label="Bron" value={invoiceConcept.sourceLabel} compact={isCompact} />
            <Field label="Status" value={isReviewed ? 'Concept gecontroleerd' : 'Concept'} compact={isCompact} />
            <Field label="Bedrag" value={invoiceConcept.amountLabel} compact={isCompact} />
            <Field label="Bevoegde controle" value={controlDisplayLabel} compact={isCompact} />
            <Field
              label="Factuurnummerstatus"
              value={isAssigned ? 'Toegewezen' : 'Nog niet toegewezen'}
              compact={isCompact}
            />
            <Field label="Factuurnummer" value={invoiceConcept.invoiceNumberLabel} compact={isCompact} />
          </View>

          <TazeButton
            label="Controleer factuurconcept"
            onPress={handleReviewInvoiceConcept}
            disabled={!canReviewInvoiceConcept(invoiceConcept)}
            variant="primary"
            style={styles.primaryButton}
          />

          <TazeButton
            label="Wijs factuurnummer toe"
            onPress={handleAssignInvoiceNumber}
            disabled={!canAssignInvoiceNumber(invoiceConcept)}
            variant="secondary"
            style={styles.primaryButton}
          />

          {isReviewed ? (
            <ThemedText style={styles.notice}>Factuurconcept gecontroleerd.</ThemedText>
          ) : null}
          {isAssigned ? <ThemedText style={styles.notice}>Factuurnummer toegewezen.</ThemedText> : null}
        </TazeCard>

        <TazeCard variant="muted" style={[styles.sectionCard, isCompact && styles.sectionCardCompact]}>
          <View style={styles.sectionHeader}>
            <TazeBadge label="Stap 3" tone="info" />
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              Betaalstatus
            </ThemedText>
          </View>

          <View style={[styles.fieldGrid, isCompact && styles.fieldGridCompact]}>
            <Field label="Factuurnummer" value={invoiceConcept.invoiceNumberLabel} compact={isCompact} />
            <Field label="Betaalstatus" value={invoiceConcept.paymentStatusLabel} compact={isCompact} />
            <Field label="Stripe" value={invoiceConcept.stripeStatusLabel} compact={isCompact} />
          </View>

          <TazeButton
            label="Bereid betaalstatus voor"
            onPress={handlePreparePaymentStatus}
            disabled={!canPrepareInvoicePaymentStatus(invoiceConcept)}
            variant="secondary"
            style={styles.primaryButton}
          />

          {isPaymentPrepared ? (
            <ThemedText style={styles.notice}>Betaalstatus voorbereid. Betaling is nog niet gestart.</ThemedText>
          ) : null}
        </TazeCard>

        <TazeCard variant="muted" style={[styles.sectionCard, isCompact && styles.sectionCardCompact]}>
          <View style={styles.sectionHeader}>
            <TazeBadge label="Stap 4" tone="info" />
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              Mail
            </ThemedText>
          </View>

          <View style={[styles.fieldGrid, isCompact && styles.fieldGridCompact]}>
            <Field label="Betaalstatus" value={invoiceConcept.paymentStatusLabel} compact={isCompact} />
            <Field label="Mailstatus" value={invoiceConcept.mailStatusLabel} compact={isCompact} />
            <Field label="Verzending" value={invoiceConcept.dispatchStatusLabel} compact={isCompact} />
          </View>

          <TazeButton
            label="Zet klantmail klaar"
            onPress={handleQueueCustomerMail}
            disabled={!canQueueInvoiceCustomerMail(invoiceConcept)}
            variant="secondary"
            style={styles.primaryButton}
          />

          {isMailQueued ? (
            <ThemedText style={styles.notice}>Klantmail staat klaar voor verzending.</ThemedText>
          ) : null}
        </TazeCard>

        <TazeCard variant="muted" style={[styles.sectionCard, isCompact && styles.sectionCardCompact]}>
          <View style={styles.sectionHeader}>
            <TazeBadge label="Stap 5" tone="info" />
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              Laatste controle
            </ThemedText>
          </View>

          <View style={[styles.fieldGrid, isCompact && styles.fieldGridCompact]}>
            <Field label="Factuurnummer" value={invoiceConcept.invoiceNumberLabel} compact={isCompact} />
            <Field label="Betaalstatus" value={invoiceConcept.paymentStatusLabel} compact={isCompact} />
            <Field label="Mailstatus" value={invoiceConcept.mailStatusLabel} compact={isCompact} />
            <Field label="Verzending" value={invoiceConcept.dispatchStatusLabel} compact={isCompact} />
          </View>

          <TazeButton
            label="Laatste invoice-controle"
            onPress={handleRunFinalInvoiceControl}
            disabled={!canRunFinalInvoiceControl(invoiceConcept)}
            variant="primary"
            style={styles.primaryButton}
          />

          {isFinalReady ? (
            <ThemedText style={styles.notice}>
              Facturatie klaar voor uitvoering. Klaar voor betaling en verzending na bevoegde uitvoering.
            </ThemedText>
          ) : null}
        </TazeCard>

        <TazeCard variant="panel" style={[styles.reportCard, isCompact && styles.reportCardCompact]}>
          <ThemedText type="defaultSemiBold" style={styles.reportTitle}>
            Facturatierapport
          </ThemedText>

          <View style={styles.reportList}>
            <ReportRow label="Factuurconcept" value={isReviewed ? 'gecontroleerd' : 'concept'} />
            <ReportRow label="Bevoegde controle" value={controlDisplayLabel} />
            <ReportRow label="Factuurnummerstatus" value={isAssigned ? 'Toegewezen' : 'Nog niet toegewezen'} />
            <ReportRow label="Factuurnummer" value={invoiceConcept.invoiceNumberLabel} />
            <ReportRow label="Betaalstatus" value={invoiceConcept.paymentStatusLabel} />
            <ReportRow label="Stripe" value={invoiceConcept.stripeStatusLabel} />
            <ReportRow label="Mailstatus" value={invoiceConcept.mailStatusLabel} />
            <ReportRow label="Verzending" value={invoiceConcept.dispatchStatusLabel} />
            <ReportRow label="Laatste controle" value={invoiceConcept.lastControlStatusLabel} />
            <ReportRow label="Eindstatus" value={invoiceConcept.executionStatusLabel} />
            <ReportRow label="Audit" value={invoiceConcept.auditStatusLabel} />
          </View>
        </TazeCard>

        <View style={[styles.actions, isCompact && styles.actionsCompact]}>
          <TazeButton label="Terug naar taze.to" onPress={openPublic} variant="primary" style={styles.primaryButton} />
        </View>

        <ThemedText style={styles.helper}>
          Facturatie volgt in een eigen surface. Deze pagina houdt facturatie los van scan, transport en voorraad.
        </ThemedText>
      </TazeCard>
    </View>
  );
}

function Field({ label, value, compact }: { label: string; value: string; compact: boolean }) {
  return (
    <View style={[styles.field, compact && styles.fieldCompact]}>
      <ThemedText style={styles.fieldLabel}>{label}</ThemedText>
      <ThemedText type="defaultSemiBold" style={styles.fieldValue}>
        {value}
      </ThemedText>
    </View>
  );
}

function ReportRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reportRow}>
      <ThemedText style={styles.reportLabel}>{label}</ThemedText>
      <ThemedText type="defaultSemiBold" style={styles.reportValue}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  shellCompact: {
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 760,
    gap: 16,
    padding: 22,
  },
  cardCompact: {
    padding: 16,
    gap: 14,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
  },
  logoFrame: {
    width: 84,
    height: 84,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: Brand.dark,
    boxShadow: '0px 14px 28px rgba(5, 8, 22, 0.16)',
  },
  copy: {
    flex: 1,
    gap: 6,
  },
  subtitle: {
    color: Brand.ink,
  },
  description: {
    color: Brand.inkMuted,
    lineHeight: 20,
  },
  workflowSummary: {
    gap: 6,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.18)',
  },
  workflowStageLabel: {
    color: Brand.ink,
  },
  workflowStageHint: {
    color: Brand.inkMuted,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionsCompact: {
    flexDirection: 'column',
  },
  sectionCard: {
    gap: 14,
    padding: 18,
  },
  sectionCardCompact: {
    padding: 14,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  sectionTitle: {
    color: Brand.ink,
  },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  fieldGridCompact: {
    gap: 10,
  },
  field: {
    minWidth: 180,
    flexGrow: 1,
    flexBasis: '48%',
    gap: 4,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.07)',
  },
  fieldCompact: {
    flexBasis: '100%',
    minWidth: 0,
  },
  fieldLabel: {
    color: Brand.inkMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  fieldValue: {
    color: Brand.ink,
  },
  notice: {
    color: Brand.accent,
    fontSize: 13,
    lineHeight: 19,
  },
  reportCard: {
    gap: 14,
    padding: 18,
  },
  reportCardCompact: {
    padding: 14,
    gap: 12,
  },
  reportTitle: {
    color: Brand.ink,
  },
  reportList: {
    gap: 10,
  },
  reportRow: {
    gap: 2,
  },
  reportLabel: {
    color: Brand.inkMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  reportValue: {
    color: Brand.ink,
  },
  primaryButton: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
  },
  secondaryButton: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
  },
  helper: {
    color: Brand.inkMuted,
    fontSize: 12,
    lineHeight: 18,
  },
});
