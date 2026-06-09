import { useCallback } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { TazeBadge } from 'components/taze-badge';
import { TazeButton } from 'components/taze-button';
import { TazeCard } from 'components/taze-card';
import { TazeLogo } from 'components/taze-logo';
import { ThemedText } from 'components/themed-text';
import { Brand } from 'constants/theme';
import { useResponsiveLayout } from 'hooks/use-responsive-layout';
import { DomainConfig } from 'lib/domain-config';
import { LegalConfig } from 'lib/legal-config';
import { PUBLIC_CONTENT } from 'lib/public-content';

async function openUrl(url: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.assign(url);
    return;
  }

  await Linking.openURL(url);
}

export function PublicWebsitePage() {
  const { isCompact } = useResponsiveLayout();

  const openScanflow = useCallback(() => {
    void openUrl(`${DomainConfig.appOrigin}/scan`).catch(() => {});
  }, []);

  const openReference = useCallback(() => {
    void openUrl(`${DomainConfig.appOrigin}/food-chain`).catch(() => {});
  }, []);

  const openContact = useCallback(() => {
    void openUrl(`${DomainConfig.publicOrigin}/contact`).catch(() => {});
  }, []);

  const openPrivacy = useCallback(() => {
    void openUrl(LegalConfig.privacyPolicyUrl).catch(() => {});
  }, []);

  const openTerms = useCallback(() => {
    void openUrl(LegalConfig.termsUrl).catch(() => {});
  }, []);

  return (
    <ScrollView contentContainerStyle={[styles.shell, isCompact && styles.shellCompact]} showsVerticalScrollIndicator={false}>
      <View style={styles.heroStack}>
        <TazeCard variant="accent" style={[styles.heroCard, isCompact && styles.heroCardCompact]}>
          <View style={[styles.heroTop, isCompact && styles.heroTopCompact]}>
            <View style={styles.logoFrame}>
              <TazeLogo size={isCompact ? 64 : 80} framed={false} />
            </View>
            <View style={styles.heroCopy}>
              <TazeBadge label={PUBLIC_CONTENT.hero.badge} tone="primary" icon="business" />
              <ThemedText type="title" style={styles.heroTitle}>
                {PUBLIC_CONTENT.hero.title}
              </ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.heroSubtitle}>
                {PUBLIC_CONTENT.hero.subtitle}
              </ThemedText>
            </View>
          </View>

          <View style={[styles.ctaRow, isCompact && styles.ctaRowCompact]}>
            <TazeButton label="Start voorraadflow" icon="qr-code-scanner" variant="primary" onPress={openScanflow} />
            <TazeButton label="Bekijk voorbeeld" icon="hub" variant="secondary" onPress={openReference} />
          </View>
        </TazeCard>

        <View style={styles.grid}>
          {PUBLIC_CONTENT.blocks.map((block) => (
            <TazeCard
              key={block.title}
              variant={block.tone === 'primary' ? 'panel' : block.tone === 'accent' ? 'accent' : 'muted'}
              style={styles.gridCard}>
              <TazeBadge label={block.title} tone={block.tone} icon="apps" />
              <ThemedText type="defaultSemiBold" style={styles.gridTitle}>
                {block.title}
              </ThemedText>
              <ThemedText style={styles.gridBody}>{block.description}</ThemedText>
            </TazeCard>
          ))}
        </View>

        <TazeCard variant="muted" style={styles.legalCard}>
          <TazeBadge label="Google branding" tone="info" icon="shield" />
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Publieke links
          </ThemedText>
          <ThemedText style={styles.sectionBody}>
            Google verwacht dat de homepage, privacy en voorwaarden publiek zichtbaar zijn en het doel van Taze
            duidelijk uitleggen.
          </ThemedText>
          <View style={styles.legalActions}>
            <TazeButton label="Privacy" icon="shield" variant="secondary" onPress={openPrivacy} />
            <TazeButton label="Voorwaarden" icon="description" variant="ghost" onPress={openTerms} />
            <TazeButton label="Contact" icon="mail" variant="ghost" onPress={openContact} />
          </View>
        </TazeCard>

        <TazeCard variant="muted" style={styles.supportCard}>
          <TazeBadge label="Zekerheid" tone="info" icon="shield" />
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            {PUBLIC_CONTENT.support.title}
          </ThemedText>
          <ThemedText style={styles.sectionBody}>{PUBLIC_CONTENT.support.body}</ThemedText>
          <View style={styles.bulletList}>
            {PUBLIC_CONTENT.support.bullets.map((bullet) => (
              <ThemedText key={bullet} style={styles.bulletItem}>
                - {bullet}
              </ThemedText>
            ))}
          </View>
        </TazeCard>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    maxWidth: 1140,
    alignSelf: 'center',
    padding: 18,
    gap: 18,
  },
  shellCompact: {
    padding: 14,
  },
  heroStack: {
    gap: 16,
  },
  heroCard: {
    gap: 18,
  },
  heroCardCompact: {
    gap: 14,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroTopCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
  },
  logoFrame: {
    width: 90,
    height: 90,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: Brand.dark,
    boxShadow: '0px 14px 28px rgba(5, 8, 22, 0.16)',
  },
  heroCopy: {
    flex: 1,
    gap: 8,
  },
  heroTitle: {
    color: Brand.ink,
  },
  heroSubtitle: {
    color: Brand.inkMuted,
    lineHeight: 22,
  },
  ctaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  ctaRowCompact: {
    flexDirection: 'column',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridCard: {
    flexBasis: 250,
    flexGrow: 1,
    gap: 8,
  },
  gridTitle: {
    color: Brand.ink,
  },
  gridBody: {
    color: Brand.inkMuted,
    lineHeight: 20,
  },
  supportCard: {
    gap: 10,
  },
  legalCard: {
    gap: 10,
  },
  sectionTitle: {
    color: Brand.ink,
  },
  sectionBody: {
    color: Brand.inkMuted,
    lineHeight: 21,
  },
  legalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  bulletList: {
    gap: 6,
  },
  bulletItem: {
    color: Brand.ink,
    lineHeight: 20,
  },
});
