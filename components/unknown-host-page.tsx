import { StyleSheet, View } from 'react-native';

import { TazeBadge } from 'components/taze-badge';
import { TazeCard } from 'components/taze-card';
import { TazeLogo } from 'components/taze-logo';
import { ThemedText } from 'components/themed-text';
import { Brand } from 'constants/theme';
import { useResponsiveLayout } from 'hooks/use-responsive-layout';

export function UnknownHostPage() {
  const { isCompact } = useResponsiveLayout();

  return (
    <View style={[styles.shell, isCompact && styles.shellCompact]}>
      <TazeCard variant="muted" style={[styles.card, isCompact && styles.cardCompact]}>
        <View style={[styles.hero, isCompact && styles.heroCompact]}>
          <View style={styles.logoFrame}>
            <TazeLogo size={isCompact ? 60 : 76} framed={false} />
          </View>
          <View style={styles.copy}>
            <TazeBadge label="onbekende host" tone="warning" icon="warning" />
            <ThemedText type="title">Deze Taze-host is niet geconfigureerd</ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.subtitle}>
              Geen web UI, geen app-shell, geen marketinglaag
            </ThemedText>
            <ThemedText style={styles.description}>
              Deze host is niet gekoppeld aan een publieke of beveiligde Taze-omgeving. Gebruik de officiële Taze-
              domeinen om de juiste site te openen.
            </ThemedText>
          </View>
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
    maxWidth: 640,
    gap: 14,
    padding: 22,
  },
  cardCompact: {
    padding: 16,
    gap: 12,
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
    width: 80,
    height: 80,
    borderRadius: 22,
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
});
