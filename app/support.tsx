import { Href, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { RealAiCopilotPanel } from 'components/real-ai-copilot-panel';
import { CopyableMailBlock } from 'components/copyable-mail-block';
import { LegalSuitePanel } from 'components/legal-suite-panel';
import { ScreenAiPanel } from 'components/screen-ai-panel';
import { TazeButton } from 'components/taze-button';
import { TazeCard } from 'components/taze-card';
import { TazeHero } from 'components/taze-hero';
import { TazeSectionHeader } from 'components/taze-section-header';
import { ThemedText } from 'components/themed-text';
import { ThemedView } from 'components/themed-view';
import { Brand } from 'constants/theme';
import { useAuth } from 'lib/auth-context';
import { markAiAuditInteraction, markAiAuditOutcome } from 'lib/ai-audit';
import { LegalConfig } from 'lib/legal-config';
import { requestRealAi, type RealAiResponse } from 'lib/real-ai';
import { isSupabaseConfigured } from 'lib/supabase';

const supportChannels = [
  {
    title: 'Ria helpdesk',
    body: 'Voor snelle operationele vragen, AI-advies en directe routes naar scan, meldingen, trace en support.',
    actionLabel: 'Open Ria',
    route: '/helpdesk',
  },
  {
    title: 'Betalingen en terugbetaling',
    body: 'Voor checkout, facturen, terugbetalingsaanvragen en de directe route naar de supportinbox.',
    actionLabel: 'Open betalingen',
    route: '/payments',
  },
  {
    title: 'Nieuwsbrief en updates',
    body: 'Voor productupdates, releases, supportnotities en communicatie met je team of klant.',
    actionLabel: 'Open nieuwsbrief',
    route: '/newsletter',
  },
  {
    title: 'Publieke ondersteuning',
    body: 'Voor ondersteuningspagina, refund approvals, ondersteuningsmail en formele communicatie buiten de app.',
    actionLabel: 'Open publieke ondersteuning',
    route: LegalConfig.supportUrl,
  },
  {
    title: 'Creatieve kunstenaars',
    body: 'Voor makers, kunstprojecten en publieke push van zichtbaarheid en updates.',
    actionLabel: 'Open creatieve route',
    route: LegalConfig.creativeArtistsRoute,
  },
] as const;

export default function HulpScreen() {
  const router = useRouter();
  const { email } = useAuth();
  const [realAiState, setRealAiState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [realAiAnswer, setRealAiAnswer] = useState<RealAiResponse | null>(null);
  const [realAiError, setRealAiError] = useState('');
  const supportAiContext = useMemo(
    () => ({
      supportEmail: LegalConfig.supportEmail,
      supportUrl: LegalConfig.supportUrl,
      channels: supportChannels.map((channel) => ({
        title: channel.title,
        route: channel.route,
      })),
      accountState: {
        configured: isSupabaseConfigured(),
        sessionEmail: email ?? null,
      },
    }),
    [email]
  );
  const askHulpAi = useCallback(async () => {
    setRealAiState('loading');
    setRealAiAnswer(null);
    setRealAiError('');
    try {
      const answer = await requestRealAi({
        screen: 'support',
        question: 'Welke ondersteuning-, helpdesk- of contactactie raad je nu aan voor deze Taze supportcontext?',
        context: supportAiContext,
        availableActions: [
          { kind: 'open_helpdesk_route', label: 'Open Ria', description: 'Open de helpdesk.' },
          { kind: 'open_newsletter_route', label: 'Open nieuwsbrief', description: 'Open nieuwsbrief en updates.' },
          { kind: 'open_creative_artists_route', label: 'Open creatieve route', description: 'Open de route voor kunstenaars en makers.' },
          { kind: 'open_contact_route', label: 'Open contact', description: 'Open de contactpagina.' },
        ],
      });
      setRealAiAnswer(answer);
      setRealAiState('done');
    } catch (error) {
      setRealAiState('error');
      setRealAiAnswer(null);
      setRealAiError(error instanceof Error ? error.message : 'De echte AI is nu niet bereikbaar.');
    }
  }, [supportAiContext]);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <ThemedView style={styles.screen}>
        <TazeHero
          title="Ondersteuning"
          subtitle="Taze ondersteuning"
          description="Alle Taze-ondersteuningskanalen voor helpdesk, betalingen, terugbetaling, publieke ondersteuning en direct contact staan hier samen."
          badgeLabel="Ondersteuningsmail"
          badgeValue={LegalConfig.supportEmail}
          badgeText="Gebruik dit voor support, refunds, approvalmails en publieke opvolging."
        />

        <ScreenAiPanel
          screen="support"
          status={{
            configured: isSupabaseConfigured(),
            sessionEmail: email ?? null,
          }}
        />

        <CopyableMailBlock
          title="Ondersteuningsmail kopiëren"
          subtitle="Tik op het adres om het direct te kopiëren of open meteen je mailapp."
          email={LegalConfig.supportEmail}
          badge="Support"
        />

        <LegalSuitePanel currentScreen="support" configured={isSupabaseConfigured()} sessionEmail={email ?? null} />

        <RealAiCopilotPanel
          title="Echte AI op ondersteuning en service"
          hint="Laat een echt model kiezen of Ria, nieuwsbrief, contact of privacy nu de juiste route is."
          buttonLabel="Vraag hulp-AI"
          loading={realAiState === 'loading'}
          onAsk={() => askHulpAi().catch(() => {})}
          result={realAiAnswer}
          error={realAiError || null}
          onOpenRoute={(route) => {
            if (realAiAnswer?.auditId) {
              markAiAuditInteraction(realAiAnswer.auditId, {
                kind: 'route_opened',
                label: realAiAnswer.recommendedLabel,
              }).catch(() => {});
              markAiAuditOutcome(realAiAnswer.auditId, {
                kind: 'success',
                label: `Route geopend via ondersteunings-AI: ${route}`,
              }).catch(() => {});
            }
            router.push(route as Href);
          }}
          onApplyAction={(action) => {
            if (realAiAnswer?.auditId) {
              markAiAuditInteraction(realAiAnswer.auditId, {
                kind: 'action_applied',
                label: action.label,
              }).catch(() => {});
              markAiAuditOutcome(realAiAnswer.auditId, {
                kind: 'success',
                label: `Actie toegepast via ondersteunings-AI: ${action.label}`,
              }).catch(() => {});
            }

            if (action.kind === 'open_helpdesk_route') {
              router.push('/helpdesk' as Href);
              return;
            }
            if (action.kind === 'open_newsletter_route') {
              router.push('/newsletter' as Href);
              return;
            }
            if (action.kind === 'open_creative_artists_route') {
              router.push(LegalConfig.creativeArtistsRoute as Href);
              return;
            }
            if (action.kind === 'open_contact_route') {
              router.push(LegalConfig.contactRoute as Href);
            }
          }}
        />

        <TazeCard>
          <TazeSectionHeader title="Kanalen" subtitle="Kies het juiste ondersteuningpad per type vraag." badge="Ondersteuning" />
          <View style={styles.channelList}>
            {supportChannels.map((channel) => (
              <View key={channel.title} style={styles.channelCard}>
                <ThemedText type="defaultSemiBold">{channel.title}</ThemedText>
                <ThemedText>{channel.body}</ThemedText>
                <TazeButton
                  label={channel.actionLabel}
                  icon={channel.route.startsWith('/') ? 'arrow-forward' : 'open-in-new'}
                  onPress={() => {
                    if (channel.route.startsWith('/')) {
                      router.push(channel.route as Href);
                      return;
                    }

                    Linking.openURL(channel.route).catch(() => {});
                  }}
                  variant="secondary"
                />
              </View>
            ))}
          </View>
        </TazeCard>

        <TazeCard variant="muted">
          <TazeSectionHeader title="Direct contact" subtitle="Spring meteen naar mail, betalingen, privacy of contact." badge="Snel" badgeTone="info" />
          <View style={styles.actions}>
            <TazeButton
              label="Mail ondersteuning"
              icon="mail"
              onPress={() => Linking.openURL(`mailto:${LegalConfig.supportEmail}`).catch(() => {})}
              variant="primary"
            />
            <TazeButton label="Betalingen" icon="arrow-forward" onPress={() => router.push('/payments' as Href)} variant="secondary" />
            <TazeButton label="Privacy" icon="shield" onPress={() => router.push(LegalConfig.privacyRoute as Href)} variant="ghost" />
            <TazeButton label="Contact" icon="call" onPress={() => router.push(LegalConfig.contactRoute as Href)} variant="ghost" />
          </View>
        </TazeCard>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 28,
    backgroundColor: Brand.canvas,
    alignItems: 'center',
  },
  screen: {
    width: '100%',
    maxWidth: 1080,
    gap: 18,
  },
  channelList: {
    gap: 12,
    marginTop: 14,
  },
  channelCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 14,
    gap: 8,
  },
  actions: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});

