import { useCallback } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { TazeBadge } from 'components/taze-badge';
import { TazeButton } from 'components/taze-button';
import { TazeCard } from 'components/taze-card';
import { TazeLogo } from 'components/taze-logo';
import { ThemedText } from 'components/themed-text';
import { Brand } from 'constants/theme';
import { useResponsiveLayout } from 'hooks/use-responsive-layout';
import { DomainConfig } from 'lib/domain-config';

async function openUrl(url: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.assign(url);
    return;
  }

  await Linking.openURL(url);
}

export function AdminGatewayPage() {
  const { isCompact } = useResponsiveLayout();

  const openApp = useCallback(() => {
    void openUrl(DomainConfig.appOrigin).catch(() => {});
  }, []);

  const openPublic = useCallback(() => {
    void openUrl(DomainConfig.publicOrigin).catch(() => {});
  }, []);

  return (
    <View style={[styles.shell, isCompact && styles.shellCompact]}>
      <TazeCard variant="muted" style={[styles.card, isCompact && styles.cardCompact]}>
        <View style={[styles.hero, isCompact && styles.heroCompact]}>
          <View style={styles.logoFrame}>
            <TazeLogo size={isCompact ? 64 : 80} framed={false} />
          </View>
          <View style={styles.copy}>
            <TazeBadge label="admin.taze.to" tone="info" icon="security" />
            <ThemedText type="title">Intern Taze beheer</ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.subtitle}>
              Beheerrollen, audits en interne toegang
            </ThemedText>
            <ThemedText style={styles.description}>
              Dit is de interne beheerlaag van Taze. Er is nog geen volledige AdminShell, dus je blijft hier binnen
              een veilige beheerplaceholder na login en admin-autorisatie.
            </ThemedText>
          </View>
        </View>

        <View style={[styles.actions, isCompact && styles.actionsCompact]}>
          <TazeButton label="Open bedrijfsplatform" onPress={openApp} variant="primary" style={styles.primaryButton} />
          <TazeButton
            label="Terug naar taze.to"
            onPress={openPublic}
            variant="secondary"
            style={styles.secondaryButton}
          />
        </View>

        <ThemedText style={styles.helper}>
          Hier horen later rollen, audits, instellingen, interne toegang en beheeracties. Geen marketing UI en geen
          bedrijfsdata zonder expliciete autorisatie.
        </ThemedText>
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
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionsCompact: {
    flexDirection: 'column',
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
