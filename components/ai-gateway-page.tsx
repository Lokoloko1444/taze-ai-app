import { StyleSheet, View } from 'react-native';

import { TazeBadge } from 'components/taze-badge';
import { TazeCard } from 'components/taze-card';
import { TazeLogo } from 'components/taze-logo';
import { ThemedText } from 'components/themed-text';
import { Brand } from 'constants/theme';
import { useResponsiveLayout } from 'hooks/use-responsive-layout';

const guardrails = [
  {
    title: 'Read-only advies',
    description: 'AI kijkt, analyseert en signaleert binnen bevoegdheid, maar wijzigt niets.',
  },
  {
    title: 'Menselijke bevestiging vereist',
    description: 'Bevoegde personen blijven beslissen over uitvoering, bevestiging en opvolging.',
  },
  {
    title: 'Geen automatische acties',
    description: 'AI start niets, wijst niets toe en verstuurt niets zonder menselijke goedkeuring.',
  },
  {
    title: 'Geen datawijzigingen',
    description: 'Data blijft ongewijzigd; AI geeft alleen advies, waarschuwingen en samenvattingen.',
  },
];

export function AiGatewayPage() {
  const { isCompact } = useResponsiveLayout();

  return (
    <View style={[styles.shell, isCompact && styles.shellCompact]}>
      <TazeCard variant="muted" style={[styles.card, isCompact && styles.cardCompact]}>
        <View style={[styles.hero, isCompact && styles.heroCompact]}>
          <View style={styles.logoFrame}>
            <TazeLogo size={isCompact ? 64 : 80} framed={false} />
          </View>
          <View style={styles.copy}>
            <TazeBadge label="ai.taze.to" tone="info" />
            <ThemedText type="title">RIA / AI advieslijn</ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.subtitle}>
              AI ondersteunt. De mens bevestigt.
            </ThemedText>
            <ThemedText style={styles.description}>
              RIA geeft alleen read-only advies binnen bevoegdheid. AI ondersteunt, de mens bevestigt. Rollen en
              rechten begrenzen wat automatisch mag gebeuren. Taze gebruikt data en metrics om vooruit te kijken, maar
              AI beslist niets en voert niets uit.
            </ThemedText>
            <ThemedText style={styles.kicker}>Klaar voor de toekomst met menselijk beslissingsrecht.</ThemedText>
          </View>
        </View>

        <View style={[styles.guardrailList, isCompact && styles.guardrailListCompact]}>
          {guardrails.map((item) => (
            <View key={item.title} style={styles.guardrailItem}>
              <ThemedText type="defaultSemiBold" style={styles.guardrailTitle}>
                {item.title}
              </ThemedText>
              <ThemedText style={styles.guardrailDescription}>{item.description}</ThemedText>
            </View>
          ))}
        </View>
      </TazeCard>
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
  kicker: {
    color: Brand.ink,
    lineHeight: 20,
    fontWeight: '600',
  },
  guardrailList: {
    gap: 12,
  },
  guardrailListCompact: {
    gap: 10,
  },
  guardrailItem: {
    borderRadius: 20,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    gap: 4,
  },
  guardrailTitle: {
    color: Brand.ink,
  },
  guardrailDescription: {
    color: Brand.inkMuted,
    lineHeight: 20,
  },
});
