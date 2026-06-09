import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { TazeBadge } from 'components/taze-badge';
import { TazeButton } from 'components/taze-button';
import { TazeCard } from 'components/taze-card';
import { TazeLogo } from 'components/taze-logo';
import { ThemedText } from 'components/themed-text';
import { ThemedView } from 'components/themed-view';
import { Brand } from 'constants/theme';
import { useResponsiveLayout } from 'hooks/use-responsive-layout';
import { DomainConfig } from 'lib/domain-config';
import { getServerBaseUrl } from 'lib/server-url';

type HealthSnapshot = {
  ok?: boolean;
  mode?: 'live' | 'demo';
  demo?: boolean;
  apiConnected?: boolean;
  databaseConnected?: boolean;
  runtime?: string;
  aiConfigured?: boolean;
  aiReady?: boolean;
  aiStatus?: string;
  aiDetail?: string;
  supabaseConfigured?: boolean;
  supabasePublicConfigured?: boolean;
  supabaseServerConfigured?: boolean;
  stripeConfigured?: boolean;
  stripeCheckoutReady?: boolean;
  stripePublishableConfigured?: boolean;
  stripePublishableMode?: string | null;
  stripeSecretMode?: string | null;
  newsletterEnabled?: boolean;
  newsletterConfigured?: boolean;
  newsletterReady?: boolean;
  serveWebUi?: boolean;
};

type StatusTone = 'success' | 'warning' | 'danger' | 'accent' | 'neutral';

type StatusEntry = {
  label: string;
  detail: string;
  tone: StatusTone;
  icon: keyof typeof MaterialIcons.glyphMap;
};

function toneFor(value: boolean | undefined, fallback: StatusTone = 'warning'): StatusTone {
  if (value === true) return 'success';
  if (value === false) return 'danger';
  return fallback;
}

export default function HealthScreen() {
  const router = useRouter();
  const { isCompact } = useResponsiveLayout();
  const serverBaseUrl = useMemo(() => getServerBaseUrl(), []);
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHealth = useCallback(async () => {
    setError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`${serverBaseUrl}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as HealthSnapshot | null;

      if (!response.ok || !payload?.ok) {
        throw new Error('De live /health endpoint antwoordt niet goed.');
      }

      setSnapshot(payload);
    } catch (cause) {
      setSnapshot(null);
      setError(cause instanceof Error ? cause.message : 'De live status kon niet worden opgehaald.');
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      setRefreshing(false);
    }
  }, [serverBaseUrl]);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  const statusItems = useMemo<StatusEntry[]>(
    () => [
      {
        label: 'API / health',
        detail: snapshot?.ok ? 'Live en bereikbaar' : snapshot?.demo ? 'Testmodus actief' : 'Nog niet bevestigd',
        tone: snapshot?.ok ? 'success' : snapshot?.demo ? 'warning' : 'warning',
        icon: snapshot?.ok ? 'check-circle' : snapshot?.demo ? 'science' : 'sync-problem',
      },
      {
        label: 'Modus',
        detail: snapshot?.mode === 'demo' ? 'Testbuild' : snapshot?.ok ? 'Productiebuild' : 'Niet bevestigd',
        tone: snapshot?.mode === 'demo' ? 'warning' : snapshot?.ok ? 'success' : 'neutral',
        icon: snapshot?.mode === 'demo' ? 'visibility-off' : snapshot?.ok ? 'cloud-done' : 'sync-problem',
      },
      {
        label: 'AI',
        detail:
          snapshot?.aiDetail ??
          (snapshot?.aiReady
            ? 'OpenAI key werkt'
            : snapshot?.aiConfigured
              ? 'OpenAI secret aanwezig'
              : 'Secret ontbreekt'),
        tone: snapshot?.aiReady ? 'success' : toneFor(snapshot?.aiConfigured, 'warning'),
        icon: snapshot?.aiReady ? 'smart-toy' : 'key',
      },
      {
        label: 'Supabase',
        detail:
          snapshot?.databaseConnected ||
          (snapshot?.supabaseConfigured && snapshot?.supabasePublicConfigured && snapshot?.supabaseServerConfigured)
            ? 'Database live'
            : 'Nog niet volledig klaar',
        tone:
          snapshot?.databaseConnected ||
          (snapshot?.supabaseConfigured && snapshot?.supabasePublicConfigured && snapshot?.supabaseServerConfigured)
            ? 'success'
            : 'warning',
        icon:
          snapshot?.databaseConnected ||
          (snapshot?.supabaseConfigured && snapshot?.supabasePublicConfigured && snapshot?.supabaseServerConfigured)
            ? 'storage'
            : 'cloud-off',
      },
      {
        label: 'Stripe',
        detail: snapshot?.stripeCheckoutReady ? 'Checkout klaar' : 'Checkout nog niet volledig',
        tone: toneFor(snapshot?.stripeCheckoutReady, 'warning'),
        icon: snapshot?.stripeCheckoutReady ? 'payments' : 'credit-card',
      },
      {
        label: 'Nieuwsbrief',
        detail: snapshot?.newsletterReady ? 'Mailflow klaar' : 'Nog niet volledig',
        tone: snapshot?.newsletterReady ? 'success' : snapshot?.newsletterConfigured ? 'warning' : 'neutral',
        icon: snapshot?.newsletterReady ? 'mark-email-read' : 'mark-email-unread',
      },
      {
        label: 'Web UI',
        detail: snapshot?.serveWebUi ? 'Server serveert web' : 'Alleen API zichtbaar',
        tone: toneFor(snapshot?.serveWebUi, 'neutral'),
        icon: snapshot?.serveWebUi ? 'web' : 'visibility-off',
      },
    ],
    [snapshot]
  );

  const openRoute = useCallback(
    (route: string) => {
      router.push(route as Href);
    },
    [router]
  );

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, isCompact && styles.contentCompact]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadHealth()} />}>
        <TazeCard style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.logoFrame}>
              <TazeLogo size={72} framed={false} />
            </View>
            <View style={styles.heroCopy}>
              <TazeBadge
                label={snapshot?.ok ? 'Live status' : snapshot?.mode === 'demo' ? 'Testmodus actief' : 'Status onbekend'}
                tone={snapshot?.ok ? 'success' : snapshot?.mode === 'demo' ? 'warning' : 'warning'}
                icon={snapshot?.ok ? 'router' : snapshot?.mode === 'demo' ? 'science' : 'sync-problem'}
              />
              <ThemedText type="title" style={styles.title}>
                Gezondheidscheck
              </ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.subtitle}>
                Dit scherm leest de echte serverstatus, zodat je direct ziet of AI, Stripe en Supabase live staan.
              </ThemedText>
              <ThemedText style={styles.helper}>
                Modus: {snapshot?.ok ? 'live' : snapshot?.mode === 'demo' ? 'test' : 'onbekend'}
              </ThemedText>
              <ThemedText style={styles.helper}>
                Server: {serverBaseUrl}
                {'\n'}
                Commerciële website: {DomainConfig.publicOrigin}
                {'\n'}
                Demo: {DomainConfig.demoOrigin}
                {'\n'}
                Bedrijfsplatform: {DomainConfig.appOrigin}
              </ThemedText>
            </View>
          </View>

          <View style={styles.actionRow}>
            <TazeButton label="Open app" icon="home" variant="primary" onPress={() => openRoute('/')} />
            <TazeButton label="Open scanner" icon="qr-code-scanner" variant="secondary" onPress={() => openRoute('/scan')} />
            <TazeButton label="Open support" icon="support-agent" variant="secondary" onPress={() => openRoute('/support')} />
            <TazeButton label="Open betalingen" icon="payments" variant="secondary" onPress={() => openRoute('/payments')} />
          </View>
        </TazeCard>

        {loading && !snapshot && !error ? (
          <TazeCard style={styles.loadingCard}>
            <ActivityIndicator />
              <ThemedText type="defaultSemiBold">Productiestatus laden...</ThemedText>
          </TazeCard>
        ) : null}

        {error ? (
          <TazeCard variant="muted" style={styles.errorCard}>
            <View style={styles.errorHeader}>
              <MaterialIcons name="error-outline" size={22} color="#b91c1c" />
              <ThemedText type="defaultSemiBold" style={styles.errorTitle}>
                Systeemstatus niet bereikbaar
              </ThemedText>
            </View>
            <ThemedText style={styles.errorBody}>{error}</ThemedText>
            <ThemedText style={styles.helper}>
              Controleer of de API-host live staat. Deze pagina hoort de echte /health respons te tonen.
            </ThemedText>
            <View style={styles.errorActions}>
              <TazeButton label="Opnieuw laden" icon="refresh" variant="primary" onPress={() => void loadHealth()} />
            </View>
          </TazeCard>
        ) : null}

        <View style={styles.grid}>
          {statusItems.map((item) => (
            <TazeCard key={item.label} variant="panel" style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <TazeBadge label={item.label} tone={item.tone} icon={item.icon} />
              </View>
              <ThemedText type="defaultSemiBold" style={styles.statusDetail}>
                {item.detail}
              </ThemedText>
            </TazeCard>
          ))}
        </View>

        <TazeCard variant="accent" style={styles.footerCard}>
          <ThemedText type="defaultSemiBold">Snel testen</ThemedText>
          <ThemedText style={styles.helper}>
            1. Open scanner
            {'\n'}
            2. Scan of plak een barcode
            {'\n'}
            3. Vraag AI
            {'\n'}
            4. Bekijk het resultaat
          </ThemedText>
          <View style={styles.footerActions}>
            <TazeButton label="Herlaad status" icon="refresh" variant="secondary" onPress={() => void loadHealth()} />
            <TazeButton label="Naar scan" icon="qr-code-scanner" variant="primary" onPress={() => openRoute('/scan')} />
          </View>
        </TazeCard>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Brand.canvas,
  },
  content: {
    padding: 20,
    gap: 16,
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
  },
  contentCompact: {
    padding: 14,
  },
  hero: {
    gap: 16,
  },
  heroTop: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  logoFrame: {
    width: 86,
    height: 86,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: Brand.dark,
    boxShadow: '0px 14px 28px rgba(5, 8, 22, 0.16)',
  },
  heroCopy: {
    flex: 1,
    gap: 8,
  },
  title: {
    color: Brand.ink,
  },
  subtitle: {
    color: Brand.inkMuted,
  },
  helper: {
    color: Brand.inkMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 24,
  },
  errorCard: {
    gap: 10,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorTitle: {
    color: '#991b1b',
  },
  errorBody: {
    color: '#7f1d1d',
  },
  errorActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statusCard: {
    flexGrow: 1,
    flexBasis: 220,
    gap: 8,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDetail: {
    color: Brand.ink,
  },
  footerCard: {
    gap: 12,
  },
  footerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
