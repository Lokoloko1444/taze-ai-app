import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { TazeButton } from 'components/taze-button';
import { TazeLogo } from 'components/taze-logo';
import { ThemedText } from 'components/themed-text';
import { ThemedView } from 'components/themed-view';
import { Brand } from 'constants/theme';
import { supabase } from 'lib/supabase';

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default function OAuthConsentScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams<{
    code?: string | string[];
    error?: string | string[];
    error_description?: string | string[];
    invite?: string | string[];
  }>();
  const code = useMemo(() => firstParam(searchParams.code).trim(), [searchParams.code]);
  const error = useMemo(() => firstParam(searchParams.error).trim(), [searchParams.error]);
  const errorDescription = useMemo(() => firstParam(searchParams.error_description).trim(), [searchParams.error_description]);
  const inviteToken = useMemo(() => firstParam(searchParams.invite).trim(), [searchParams.invite]);
  const [busy, setBusy] = useState(Boolean(code));
  const [message, setMessage] = useState('Supabase toestemming afronden...');

  useEffect(() => {
    let cancelled = false;

    async function completeConsent() {
      if (!supabase) {
        if (!cancelled) {
          setBusy(false);
          setMessage('Supabase is nog niet gekoppeld.');
        }
        return;
      }

      if (error) {
        if (!cancelled) {
          setBusy(false);
          setMessage(errorDescription || error);
        }
        return;
      }

      if (supabase) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          if (!cancelled) {
            setMessage('Toestemming bevestigd. We openen je account...');
            setBusy(false);
            router.replace(inviteToken ? `/account?invite=${encodeURIComponent(inviteToken)}` : '/account');
          }
          return;
        }
      }

      if (!code) {
        if (!cancelled) {
          setBusy(false);
          setMessage('Open de login opnieuw om Supabase-toestemming te starten.');
        }
        return;
      }

      try {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          throw exchangeError;
        }
        if (!cancelled) {
          setMessage('Toestemming bevestigd. We openen je account...');
          setBusy(false);
          router.replace(inviteToken ? `/account?invite=${encodeURIComponent(inviteToken)}` : '/account');
        }
      } catch (exchangeError) {
        if (!cancelled) {
          const raw = exchangeError instanceof Error ? exchangeError.message : 'Supabase login mislukt.';
          setBusy(false);
          setMessage(raw);
        }
      }
    }

    completeConsent().catch(() => {
      if (!cancelled) {
        setBusy(false);
        setMessage('Supabase toestemming afronden mislukt.');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [code, error, errorDescription, inviteToken, router]);

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.logoFrame}>
          <TazeLogo size={84} framed={false} />
        </View>

        <View style={styles.copy}>
          <ThemedText type="title">Supabase toestemming</ThemedText>
          <ThemedText style={styles.description}>
            Deze stap hoort bij de Supabase-login voor je Taze-account. Je kiest hier bewust of je verder wilt gaan
            met aanmelden.
          </ThemedText>
          <ThemedText style={styles.description}>{message}</ThemedText>
        </View>

        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <ThemedText type="defaultSemiBold" style={styles.badgeText}>
              app.taze.to/oauth/consent
            </ThemedText>
          </View>
          <View style={styles.badge}>
            <ThemedText type="defaultSemiBold" style={styles.badgeText}>
              Supabase loginstap
            </ThemedText>
          </View>
          <View style={styles.badge}>
            <ThemedText type="defaultSemiBold" style={styles.badgeText}>
              Menselijke bevestiging
            </ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="defaultSemiBold">Wat gebeurt hier?</ThemedText>
          <ThemedText style={styles.sectionText}>
            Supabase verzorgt de loginhandshake. Taze wijzigt hier geen data en voert geen automatische acties uit.
            Na bevestiging ga je verder naar de accountroute.
          </ThemedText>
        </View>

        <View style={styles.actions}>
          <TazeButton
            label={busy ? 'Supabase laden...' : 'Ga naar Supabase login'}
            variant="primary"
            onPress={() => router.replace('/account')}
            disabled={busy}
            style={styles.primaryButton}
          />
          <TazeButton
            label="Terug naar Taze"
            variant="secondary"
            onPress={() => router.replace('/')}
            style={styles.secondaryButton}
          />
        </View>
        {busy ? <ActivityIndicator color={Brand.primary} /> : null}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Brand.canvas,
  },
  card: {
    width: '100%',
    maxWidth: 760,
    alignItems: 'center',
    gap: 18,
    padding: 28,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.07)',
    backgroundColor: 'rgba(255,255,255,0.92)',
    boxShadow: '0px 18px 40px rgba(15, 23, 42, 0.08)',
  },
  logoFrame: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    backgroundColor: 'rgba(15, 23, 42, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
  },
  copy: {
    alignItems: 'center',
    gap: 8,
  },
  description: {
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 118, 110, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.16)',
  },
  badgeText: {
    color: '#0f766e',
    fontSize: 12,
    letterSpacing: 0.2,
  },
  section: {
    width: '100%',
    gap: 8,
    padding: 18,
    borderRadius: 22,
    backgroundColor: 'rgba(248, 250, 252, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
  },
  sectionText: {
    color: '#334155',
    lineHeight: 22,
  },
  actions: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    minWidth: 0,
  },
  secondaryButton: {
    flex: 1,
    minWidth: 0,
  },
});
