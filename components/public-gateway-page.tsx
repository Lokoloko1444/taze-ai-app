import { useCallback } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from 'components/themed-text';
import { TazeButton } from 'components/taze-button';
import { TazeCard } from 'components/taze-card';
import { TazeLogo } from 'components/taze-logo';
import { Brand } from 'constants/theme';
import { useResponsiveLayout } from 'hooks/use-responsive-layout';
import { PublicGatewayConfig, type PublicGatewayVariant } from 'lib/public-host';

type Props = {
  variant: PublicGatewayVariant;
};

async function openUrl(url: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.assign(url);
    return;
  }

  await Linking.openURL(url);
}

export function PublicGatewayPage({ variant }: Props) {
  const { isCompact } = useResponsiveLayout();
  const copy = PublicGatewayConfig[variant];

  const handlePrimary = useCallback(() => {
    void openUrl(copy.primaryHref).catch(() => {});
  }, [copy.primaryHref]);

  const handleFallback = useCallback(() => {
    void openUrl(copy.fallbackHref).catch(() => {});
  }, [copy.fallbackHref]);

  return (
    <View style={[styles.shell, isCompact && styles.shellCompact]}>
      <TazeCard variant={variant === 'scan' ? 'accent' : 'panel'} style={[styles.card, isCompact && styles.cardCompact]}>
        <View style={[styles.hero, isCompact && styles.heroCompact]}>
          <View style={styles.logoFrame}>
            <TazeLogo size={isCompact ? 64 : 80} framed={false} />
          </View>
          <View style={styles.copy}>
            <ThemedText style={styles.hostLabel}>{copy.hostLabel}</ThemedText>
            <ThemedText type="title">{copy.title}</ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.subtitle}>
              {copy.subtitle}
            </ThemedText>
            <ThemedText style={styles.description}>{copy.description}</ThemedText>
          </View>
        </View>

        <View style={[styles.actions, isCompact && styles.actionsCompact]}>
          <TazeButton label={copy.primaryLabel} onPress={handlePrimary} variant="primary" style={styles.primaryButton} />
          <TazeButton
            label={copy.fallbackLabel}
            onPress={handleFallback}
            variant="secondary"
            style={styles.secondaryButton}
          />
        </View>

        <ThemedText style={styles.helper}>{copy.helper}</ThemedText>
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
  hostLabel: {
    color: Brand.accent,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
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
