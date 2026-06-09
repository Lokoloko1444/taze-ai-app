import { useCallback, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { TazeBadge } from 'components/taze-badge';
import { TazeButton } from 'components/taze-button';
import { TazeCard } from 'components/taze-card';
import { TazeLogo } from 'components/taze-logo';
import { ThemedText } from 'components/themed-text';
import { Brand } from 'constants/theme';
import { useResponsiveLayout } from 'hooks/use-responsive-layout';
import { buildOAuthLoginRequest, type OAuthProvider } from 'lib/auth-redirect';
import { type HostSurface } from 'lib/domain-config';
import { getHostAccessLabel, type HostAccessDecision } from 'lib/host-access';
import { t, type AppLanguage } from 'lib/i18n';
import { isSupabaseConfigured, supabase } from 'lib/supabase';

type Props = {
  hostSurface: HostSurface;
  decision: HostAccessDecision;
  language?: AppLanguage;
};

type ProviderOption = {
  provider: OAuthProvider;
  label: string;
  detail: string;
  active: boolean;
};

type FlowStep = {
  index: string;
  title: string;
  detail: string;
  tone: 'primary' | 'accent' | 'info' | 'warning' | 'success' | 'neutral';
};

function getProviderLoginOptions(language: AppLanguage): ProviderOption[] {
  return [
    { provider: 'google', label: t('account.providerLogin.google.label', language), detail: t('account.providerLogin.google.detail', language), active: true },
    { provider: 'azure', label: t('account.providerLogin.microsoft.label', language), detail: t('account.providerLogin.microsoft.detail', language), active: false },
    { provider: 'apple', label: t('account.providerLogin.apple.label', language), detail: t('account.providerLogin.apple.detail', language), active: false },
  ];
}

function getFoodChainSteps(language: AppLanguage): FlowStep[] {
  return [
    { index: '1', title: t('access.foodChain.step.receive.title', language), detail: t('access.foodChain.step.receive.detail', language), tone: 'primary' },
    { index: '2', title: t('access.foodChain.step.scan.title', language), detail: t('access.foodChain.step.scan.detail', language), tone: 'accent' },
    { index: '3', title: t('access.foodChain.step.ria.title', language), detail: t('access.foodChain.step.ria.detail', language), tone: 'info' },
    { index: '4', title: t('access.foodChain.step.confirm.title', language), detail: t('access.foodChain.step.confirm.detail', language), tone: 'warning' },
    { index: '5', title: t('access.foodChain.step.location.title', language), detail: t('access.foodChain.step.location.detail', language), tone: 'success' },
    { index: '6', title: t('access.foodChain.step.audit.title', language), detail: t('access.foodChain.step.audit.detail', language), tone: 'neutral' },
  ];
}

async function openUrl(url: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.assign(url);
    return;
  }

  await Linking.openURL(url);
}

export function HostAccessScreen({ hostSurface, decision, language = 'nl' }: Props) {
  const { isCompact } = useResponsiveLayout();
  const hostLabel = getHostAccessLabel(hostSurface);
  const [busyProvider, setBusyProvider] = useState<OAuthProvider | null>(null);
  const statusStyle =
    decision.statusCode === 403 ? styles.statusForbidden : decision.statusCode === 401 ? styles.statusUnauthorized : styles.statusLoading;

  const showAppLogin = (hostSurface === 'app' || hostSurface === 'platform') && decision.status === 'unauthorized';
  const configured = isSupabaseConfigured();
  const providerLoginOptions = getProviderLoginOptions(language);
  const foodChainSteps = getFoodChainSteps(language);

  const handlePrimary = useCallback(() => {
    if (!decision.primaryActionHref) return;
    void openUrl(decision.primaryActionHref).catch(() => {});
  }, [decision.primaryActionHref]);

  const handleSecondary = useCallback(() => {
    if (!decision.secondaryActionHref) return;
    void openUrl(decision.secondaryActionHref).catch(() => {});
  }, [decision.secondaryActionHref]);

  const handleProviderLogin = useCallback(
    async (provider: OAuthProvider, active: boolean) => {
      if (!active || !configured || busyProvider) {
        return;
      }

      setBusyProvider(provider);
      try {
        if (provider !== 'google') {
          return;
        }

        const { provider: oauthProvider, options } = buildOAuthLoginRequest('google');
        const { error } = await supabase.auth.signInWithOAuth({
          provider: oauthProvider,
          options,
        });

        if (error) {
          console.warn('oauth_login_failed', error.message);
        }
      } finally {
        setBusyProvider(null);
      }
    },
    [busyProvider, configured]
  );

  const showActions = Boolean(decision.primaryActionHref || decision.secondaryActionHref);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.shell, isCompact && styles.shellCompact]}
      keyboardShouldPersistTaps="handled">
      <TazeCard variant="panel" style={[styles.card, isCompact && styles.cardCompact]}>
        <View style={[styles.hero, isCompact && styles.heroCompact]}>
          <View style={styles.logoFrame}>
            <TazeLogo size={isCompact ? 64 : 80} framed={false} />
          </View>
          <View style={styles.copy}>
            <ThemedText style={styles.hostLabel}>{hostLabel}</ThemedText>
            <ThemedText type="title">{decision.title}</ThemedText>
            <ThemedText type="defaultSemiBold" style={[styles.statusBadge, statusStyle]}>
              {decision.statusCode
                ? `${decision.statusCode} ${
                    decision.reason === 'internal_admin_required' ? t('access.status.admin', language) : t('access.status.access', language)
                  }`
                : t('access.status.loading', language)}
            </ThemedText>
            <ThemedText style={styles.description}>{decision.message}</ThemedText>
          </View>
        </View>

        {showActions ? (
          <View style={[styles.actions, isCompact && styles.actionsCompact]}>
            {decision.primaryActionHref && decision.primaryActionLabel ? (
              <TazeButton label={decision.primaryActionLabel} onPress={handlePrimary} variant="primary" style={styles.primaryButton} />
            ) : null}
            {decision.secondaryActionHref && decision.secondaryActionLabel ? (
              <TazeButton
                label={decision.secondaryActionLabel}
                onPress={handleSecondary}
                variant="secondary"
                style={styles.secondaryButton}
              />
            ) : null}
          </View>
        ) : null}

        <ThemedText style={styles.helper}>
          {decision.status === 'forbidden'
            ? t('access.helper.forbidden', language)
            : decision.status === 'unauthorized'
              ? t('access.helper.unauthorized', language)
              : t('access.helper.loading', language)}
        </ThemedText>
      </TazeCard>

      {showAppLogin ? (
        <>
          <TazeCard variant="muted" style={[styles.sectionCard, isCompact && styles.sectionCardCompact]}>
            <View style={styles.sectionHeader}>
              <TazeBadge label={t('account.providerLogin.title', language)} tone="primary" icon="person" />
              <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                {t('access.providerLogin.title', language)}
              </ThemedText>
            </View>
            <ThemedText style={styles.sectionCopy}>
              {t('account.providerLogin.body', language)}
            </ThemedText>
            <View style={[styles.providerGrid, isCompact && styles.providerGridCompact]}>
              {providerLoginOptions.map((item) => {
                const disabled = !configured || busyProvider !== null || !item.active;
                return (
                  <View key={item.provider} style={styles.providerCard}>
                    <ThemedText type="defaultSemiBold">{item.label}</ThemedText>
                    <ThemedText style={styles.providerDetail}>{item.detail}</ThemedText>
                    <TazeButton
                      label={item.label}
                      onPress={() => handleProviderLogin(item.provider, item.active).catch(() => {})}
                      disabled={disabled}
                      variant={item.active ? 'primary' : 'secondary'}
                      style={styles.providerButton}
                    />
                  </View>
                );
              })}
            </View>
          </TazeCard>

          <TazeCard variant="muted" style={[styles.sectionCard, isCompact && styles.sectionCardCompact]}>
            <View style={styles.sectionHeader}>
              <TazeBadge label={t('access.foodChain.badge', language)} tone="accent" icon="timeline" />
              <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                {t('access.foodChain.title', language)}
              </ThemedText>
            </View>
            <ThemedText style={styles.sectionCopy}>
              {t('access.foodChain.body', language)}
            </ThemedText>
            <View style={[styles.flowGrid, isCompact && styles.flowGridCompact]}>
              {foodChainSteps.map((step) => (
                <View key={step.index} style={styles.flowCard}>
                  <View style={styles.flowCardHeader}>
                    <TazeBadge label={step.index} tone={step.tone} />
                    <ThemedText type="defaultSemiBold" style={styles.flowCardTitle}>
                      {step.title}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.flowCardDetail}>{step.detail}</ThemedText>
                </View>
              ))}
            </View>
            <ThemedText style={styles.flowNote}>
              {t('access.foodChain.note', language)}
            </ThemedText>
          </TazeCard>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  shell: {
    width: '100%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
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
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: Brand.white,
  },
  statusUnauthorized: {
    backgroundColor: '#f59e0b',
  },
  statusForbidden: {
    backgroundColor: '#dc2626',
  },
  statusLoading: {
    backgroundColor: '#334155',
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
  sectionCard: {
    width: '100%',
    maxWidth: 760,
    gap: 12,
    padding: 18,
  },
  sectionCardCompact: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: Brand.ink,
  },
  sectionCopy: {
    color: Brand.inkMuted,
    lineHeight: 20,
  },
  providerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  providerGridCompact: {
    flexDirection: 'column',
  },
  providerCard: {
    flexGrow: 1,
    flexBasis: 180,
    gap: 8,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  providerDetail: {
    color: Brand.inkMuted,
    lineHeight: 18,
  },
  providerButton: {
    alignSelf: 'stretch',
  },
  flowGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  flowGridCompact: {
    flexDirection: 'column',
  },
  flowCard: {
    flexGrow: 1,
    flexBasis: 180,
    gap: 6,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  flowCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flowCardTitle: {
    color: Brand.ink,
  },
  flowCardDetail: {
    color: Brand.inkMuted,
    lineHeight: 18,
  },
  flowNote: {
    color: Brand.inkMuted,
    fontSize: 12,
    lineHeight: 18,
  },
});
