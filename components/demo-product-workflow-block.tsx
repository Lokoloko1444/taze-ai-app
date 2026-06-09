import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { TazeBadge } from 'components/taze-badge';
import { TazeButton } from 'components/taze-button';
import { TazeCard } from 'components/taze-card';
import { ThemedText } from 'components/themed-text';
import { Brand } from 'constants/theme';
import { useResponsiveLayout } from 'hooks/use-responsive-layout';
import { DEMO_CONTENT, getDemoContent } from 'lib/demo-content';
import { resolveAppLanguage } from 'lib/i18n';

type Props = {
  onStartDemo: () => void;
};

export function DemoProductWorkflowBlock({ onStartDemo }: Props) {
  const { isCompact } = useResponsiveLayout();
  useLocalSearchParams<{ lang?: string; language?: string; locale?: string }>();
  const demoContent = getDemoContent(resolveAppLanguage());
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const activeStep = DEMO_CONTENT.stepper.steps[activeStepIndex];
  const totalSteps = DEMO_CONTENT.stepper.steps.length;
  const isFirstStep = activeStepIndex === 0;
  const isLastStep = activeStepIndex === totalSteps - 1;

  const goToPreviousStep = () => {
    setActiveStepIndex((currentIndex) => Math.max(0, currentIndex - 1));
  };

  const goToNextStep = () => {
    setActiveStepIndex((currentIndex) => Math.min(totalSteps - 1, currentIndex + 1));
  };

  const resetDemo = () => {
    setActiveStepIndex(0);
  };

  return (
    <TazeCard variant="accent" style={[styles.shell, isCompact && styles.shellCompact]}>
      <View style={styles.heroBlock}>
        <TazeBadge label={demoContent.hero.badge} tone="primary" icon="layers" />
        <ThemedText type="title" style={styles.heroTitle}>
          {demoContent.hero.title}
        </ThemedText>
        <ThemedText type="defaultSemiBold" style={styles.heroSubtitle}>
          {demoContent.hero.subtitle}
        </ThemedText>
        <ThemedText style={styles.heroKeyLine}>{demoContent.hero.keyLine}</ThemedText>
        <View style={[styles.heroActions, isCompact && styles.heroActionsCompact]}>
          <TazeButton label={demoContent.hero.primaryCta} icon="arrow-forward" variant="primary" onPress={onStartDemo} />
          <TazeButton label={demoContent.hero.secondaryCta} icon="chevron-right" variant="secondary" onPress={onStartDemo} />
        </View>
      </View>

      <TazeCard
        variant="muted"
        style={styles.imageCard}
        accessibilityLabel={DEMO_CONTENT.visual.alt}
        accessibilityRole="image">
        <View style={styles.imageTopRow}>
          <TazeBadge label="Proof-overzicht" tone="primary" icon="photo" />
          <ThemedText type="defaultSemiBold" style={styles.imageTitle}>
            {DEMO_CONTENT.visual.title}
          </ThemedText>
        </View>

        <View style={[styles.flowRow, isCompact && styles.flowRowCompact]}>
          {DEMO_CONTENT.visual.flow.map((item, index) => (
            <View key={item} style={styles.flowItem}>
              <ThemedText type="defaultSemiBold" style={styles.flowText}>
                {item}
              </ThemedText>
              {index < DEMO_CONTENT.visual.flow.length - 1 ? <ThemedText style={styles.flowArrow}>→</ThemedText> : null}
            </View>
          ))}
        </View>

        <ThemedText style={styles.caption}>{DEMO_CONTENT.visual.caption}</ThemedText>
      </TazeCard>

      <TazeCard variant="panel" style={styles.productCard}>
        <View style={styles.productHeader}>
          <TazeBadge label="15 producten" tone="primary" icon="inventory" />
          <ThemedText type="title" style={styles.productTitle}>
            15 proof-producten
          </ThemedText>
          <ThemedText style={styles.productSubtitle}>
            {DEMO_CONTENT.visual.title}
          </ThemedText>
        </View>

        <View style={[styles.productGrid, isCompact && styles.productGridCompact]}>
          {DEMO_CONTENT.products.map((product) => (
            <View key={product} style={styles.productChip}>
              <ThemedText style={styles.productChipText}>{product}</ThemedText>
            </View>
          ))}
        </View>
      </TazeCard>

      <TazeCard variant="panel" style={styles.stepperCard}>
        <View style={styles.stepperHeader}>
          <TazeBadge label="7 stappen" tone="primary" icon="layers" />
          <ThemedText type="title" style={styles.stepperTitle}>
            {DEMO_CONTENT.stepper.title}
          </ThemedText>
          <ThemedText style={styles.stepperSubtitle}>{DEMO_CONTENT.stepper.subtitle}</ThemedText>
        </View>

        <View style={styles.stepCard} accessibilityLabel={`Huidige proof stap: ${activeStep.title}`}>
          <TazeBadge label={activeStep.stepLabel} tone="primary" icon="radio-button-checked" />
          <ThemedText type="subtitle" style={styles.stepTitle}>
            {activeStep.title}
          </ThemedText>
          <ThemedText style={styles.stepSubtitle}>{activeStep.subtitle}</ThemedText>
          <ThemedText type="defaultSemiBold" style={styles.stepKeyLine}>
            {activeStep.keyLine}
          </ThemedText>

          <View style={styles.detailList}>
            {activeStep.details.map((detail) => (
              <View key={detail} style={styles.detailRow}>
                <ThemedText style={styles.detailText}>{detail}</ThemedText>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.controlsRow, isCompact && styles.controlsRowCompact]}>
          <TazeButton
            label={DEMO_CONTENT.stepper.previousCta}
            icon="chevron-left"
            variant="secondary"
            disabled={isFirstStep}
            onPress={goToPreviousStep}
          />
          <TazeButton
            label={DEMO_CONTENT.stepper.primaryCta}
            icon="chevron-right"
            variant="primary"
            disabled={isLastStep}
            onPress={goToNextStep}
          />
          <TazeButton label={DEMO_CONTENT.stepper.resetCta} icon="replay" variant="ghost" onPress={resetDemo} />
        </View>
      </TazeCard>

      <TazeCard variant="muted" style={styles.packageCard}>
        <View style={styles.packageHeader}>
          <TazeBadge label="Pakketkeuze" tone="primary" icon="local-offer" />
          <ThemedText type="title" style={styles.packageTitle}>
            {DEMO_CONTENT.packageChoice.title}
          </ThemedText>
          <ThemedText style={styles.packageSubtitle}>{DEMO_CONTENT.packageChoice.subtitle}</ThemedText>
        </View>

        <View style={[styles.packageGrid, isCompact && styles.packageGridCompact]}>
          {DEMO_CONTENT.packageChoice.packages.map((item) => (
            <View key={item.title} style={styles.packageItem}>
              <ThemedText type="subtitle" style={styles.packageItemTitle}>
                {item.title}
              </ThemedText>
              <ThemedText style={styles.packageItemSubtitle}>{item.subtitle}</ThemedText>
              <ThemedText style={styles.packageItemDetail}>{item.detail}</ThemedText>
            </View>
          ))}
        </View>

        <View style={[styles.packageActions, isCompact && styles.packageActionsCompact]}>
          <TazeButton label={DEMO_CONTENT.packageChoice.ctaLine} icon="chevron-right" variant="secondary" onPress={onStartDemo} />
          <TazeButton label={DEMO_CONTENT.packageChoice.primaryCta} icon="arrow-forward" variant="primary" onPress={onStartDemo} />
        </View>
      </TazeCard>

      <View style={styles.footerBlock}>
        <ThemedText type="defaultSemiBold" style={styles.proofLine}>
          {DEMO_CONTENT.footer.proof}
        </ThemedText>
        <ThemedText style={styles.safetyLine}>{DEMO_CONTENT.footer.safety}</ThemedText>
      </View>
    </TazeCard>
  );
}

const styles = StyleSheet.create({
  shell: {
    gap: 16,
    padding: 18,
  },
  shellCompact: {
    padding: 14,
    gap: 14,
  },
  heroBlock: {
    gap: 10,
  },
  heroTitle: {
    color: Brand.ink,
  },
  heroSubtitle: {
    color: Brand.primaryStrong,
  },
  heroKeyLine: {
    color: Brand.inkMuted,
    lineHeight: 22,
    maxWidth: 840,
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
  },
  heroActionsCompact: {
    flexDirection: 'column',
  },
  imageCard: {
    gap: 12,
    padding: 18,
  },
  imageTopRow: {
    gap: 8,
  },
  imageTitle: {
    color: Brand.ink,
  },
  flowRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  flowRowCompact: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  flowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flowText: {
    color: Brand.ink,
  },
  flowArrow: {
    color: Brand.primaryStrong,
  },
  caption: {
    color: Brand.inkMuted,
    lineHeight: 20,
  },
  productCard: {
    gap: 14,
    padding: 18,
  },
  productHeader: {
    gap: 8,
  },
  productTitle: {
    color: Brand.ink,
  },
  productSubtitle: {
    color: Brand.inkMuted,
    lineHeight: 22,
    maxWidth: 820,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'stretch',
  },
  productGridCompact: {
    gap: 8,
  },
  productChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  productChipText: {
    color: Brand.ink,
  },
  stepperCard: {
    gap: 14,
    padding: 18,
  },
  stepperHeader: {
    gap: 8,
  },
  stepperTitle: {
    color: Brand.ink,
  },
  stepperSubtitle: {
    color: Brand.inkMuted,
    lineHeight: 22,
    maxWidth: 780,
  },
  stepCard: {
    gap: 10,
    padding: 18,
    borderRadius: 22,
    backgroundColor: '#f7fbff',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  stepTitle: {
    color: Brand.ink,
  },
  stepSubtitle: {
    color: Brand.inkMuted,
    lineHeight: 22,
  },
  stepKeyLine: {
    color: Brand.primaryStrong,
    lineHeight: 22,
  },
  detailList: {
    gap: 8,
    marginTop: 4,
  },
  detailRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(15, 23, 42, 0.06)',
    paddingTop: 8,
  },
  detailText: {
    color: Brand.ink,
    lineHeight: 20,
  },
  controlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  controlsRowCompact: {
    flexDirection: 'column',
  },
  packageCard: {
    gap: 14,
    padding: 18,
  },
  packageHeader: {
    gap: 8,
  },
  packageTitle: {
    color: Brand.ink,
  },
  packageSubtitle: {
    color: Brand.inkMuted,
    lineHeight: 22,
    maxWidth: 820,
  },
  packageGrid: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  packageGridCompact: {
    flexDirection: 'column',
    gap: 10,
  },
  packageItem: {
    flex: 1,
    minWidth: 0,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    backgroundColor: '#fff',
    padding: 14,
    gap: 6,
  },
  packageItemTitle: {
    color: Brand.ink,
  },
  packageItemSubtitle: {
    color: Brand.primaryStrong,
    lineHeight: 20,
  },
  packageItemDetail: {
    color: Brand.inkMuted,
    lineHeight: 20,
  },
  packageActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  packageActionsCompact: {
    flexDirection: 'column',
  },
  footerBlock: {
    gap: 8,
    paddingTop: 2,
  },
  proofLine: {
    color: Brand.primaryStrong,
  },
  safetyLine: {
    color: Brand.inkMuted,
    lineHeight: 20,
  },
});
