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

const contactFacts = [
  ['Hulpmail', LegalConfig.supportEmail],
  ['Publieke support', LegalConfig.supportUrl],
  ['Privacy', LegalConfig.privacyPolicyUrl],
  ['Contact', LegalConfig.contactUrl],
] as const;

export default function ContactScreen() {
  const router = useRouter();
  const { email } = useAuth();
  const [realAiState, setRealAiState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [realAiAnswer, setRealAiAnswer] = useState<RealAiResponse | null>(null);
  const [realAiError, setRealAiError] = useState('');
  const contactAiContext = useMemo(
    () => ({
      supportEmail: LegalConfig.supportEmail,
      supportUrl: LegalConfig.supportUrl,
      privacyUrl: LegalConfig.privacyPolicyUrl,
      contactUrl: LegalConfig.contactUrl,
      facts: contactFacts.map(([label, value]) => ({ label, value })),
      accountState: {
        configured: isSupabaseConfigured(),
        sessionEmail: email ?? null,
      },
    }),
    [email]
  );
  const askContactAi = useCallback(async () => {
    setRealAiState('loading');
    setRealAiAnswer(null);
    setRealAiError('');
    try {
      const answer = await requestRealAi({
        screen: 'contact',
        question: 'Welke contact-, support- of privacyroute raad je nu aan voor deze Taze contactcontext?',
        context: contactAiContext,
        availableActions: [
          { kind: 'mail_support', label: 'Mail Taze', description: 'Open een mail naar Taze.' },
          { kind: 'open_support_route', label: 'Open support', description: 'Open de supportpagina.' },
          { kind: 'open_privacy_route', label: 'Open privacy', description: 'Open de privacypagina.' },
        ],
      });
      setRealAiAnswer(answer);
      setRealAiState('done');
    } catch (error) {
      setRealAiState('error');
      setRealAiAnswer(null);
      setRealAiError(error instanceof Error ? error.message : 'De echte AI is nu niet bereikbaar.');
    }
  }, [contactAiContext]);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <ThemedView style={styles.screen}>
        <TazeHero
          title="Contact"
          subtitle="Taze connect"
          description="Gebruik deze contactpagina als centrale plek voor supportmail, betalingen, publieke routes en juridische contactpunten."
          badgeLabel="Hoofdkanaal"
          badgeValue={LegalConfig.supportEmail}
          badgeText="Centraal support-, refund-, betalings- en contactpunt voor Taze."
        />

        <ScreenAiPanel
          screen="contact"
          status={{
            configured: isSupabaseConfigured(),
            sessionEmail: email ?? null,
          }}
        />

        <CopyableMailBlock
          title="Kopieer e-mail"
          subtitle="Gebruik dit blok om het supportadres snel te kopiëren of meteen een mail te openen."
          email={LegalConfig.supportEmail}
          badge="Mail"
        />

        <LegalSuitePanel currentScreen="contact" configured={isSupabaseConfigured()} sessionEmail={email ?? null} />

        <RealAiCopilotPanel
          title="Echte AI op contact en bereikbaarheid"
          hint="Laat een echt model meedenken over support, privacy, account of de beste Taze-route voor deze contactcontext."
          buttonLabel="Vraag contact-AI"
          loading={realAiState === 'loading'}
          onAsk={() => askContactAi().catch(() => {})}
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
                label: `Route geopend via contact-AI: ${route}`,
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
                label: `Actie toegepast via contact-AI: ${action.label}`,
              }).catch(() => {});
            }

            if (action.kind === 'mail_support') {
              Linking.openURL(`mailto:${LegalConfig.supportEmail}`).catch(() => {});
              return;
            }
            if (action.kind === 'open_support_route') {
              router.push(LegalConfig.supportRoute as Href);
              return;
            }
            if (action.kind === 'open_privacy_route') {
              router.push(LegalConfig.privacyRoute as Href);
            }
          }}
        />

        <TazeCard>
          <TazeSectionHeader title="Contactgegevens" subtitle="Alle kernroutes op een plaats." badge="Contact" />
          <View style={styles.factList}>
            {contactFacts.map(([label, value]) => (
              <View key={label} style={styles.factRow}>
                <ThemedText style={styles.factLabel}>{label}</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.factValue}>
                  {value}
                </ThemedText>
              </View>
            ))}
          </View>
        </TazeCard>

        <TazeCard variant="muted">
          <TazeSectionHeader title="Open direct" subtitle="Vanuit hier kun je meteen naar mail, betalingen, support of privacy." badge="Acties" badgeTone="info" />
          <View style={styles.actions}>
            <TazeButton
              label="Mail Taze"
              icon="mail"
              onPress={() => Linking.openURL(`mailto:${LegalConfig.supportEmail}`).catch(() => {})}
              variant="primary"
            />
            <TazeButton label="Betalingen" icon="arrow-forward" onPress={() => router.push('/payments' as Href)} variant="secondary" />
            <TazeButton
              label="Publieke contactpagina"
              icon="open-in-new"
              onPress={() => Linking.openURL(LegalConfig.contactUrl).catch(() => {})}
              variant="secondary"
            />
            <TazeButton label="Hulp" icon="support-agent" onPress={() => router.push(LegalConfig.supportRoute as Href)} variant="ghost" />
            <TazeButton label="Privacy" icon="shield" onPress={() => router.push(LegalConfig.privacyRoute as Href)} variant="ghost" />
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
  factList: {
    gap: 12,
    marginTop: 14,
  },
  factRow: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 14,
    gap: 4,
  },
  factLabel: {
    color: '#64748b',
    fontSize: 12,
  },
  factValue: {
    fontSize: 15,
    lineHeight: 22,
  },
  actions: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});

