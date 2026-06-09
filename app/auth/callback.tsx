import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { TazeButton } from 'components/taze-button';
import { TazeLogo } from 'components/taze-logo';
import { ThemedText } from 'components/themed-text';
import { ThemedView } from 'components/themed-view';
import { Brand } from 'constants/theme';
import {
    getAuthCallbackDestination,
    hasAuthCallbackFragment,
    hasAuthCallbackSessionData,
    parseAuthCallbackHash,
} from 'lib/auth-redirect';
import { resolveAppLanguage, t, type AppLanguage } from 'lib/i18n';
import { supabase } from 'lib/supabase';

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function clearBrowserHash() {
  if (typeof window === 'undefined') return;
  const nextUrl = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState({}, document.title, nextUrl);
}

function resolveCallbackLanguage(): AppLanguage {
  return resolveAppLanguage();
}

function friendlyCallbackError(raw: string, language: AppLanguage) {
  const message = raw.toLowerCase();
  if (message.includes('missing') || message.includes('code')) {
    return t('auth.callback.error.missingCode', language);
  }
  if (message.includes('invalid') || message.includes('grant') || message.includes('flow state')) {
    return t('auth.callback.error.invalidSession', language);
  }
  return t('auth.callback.error.oauthFailed', language);
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams<{
    code?: string | string[];
    state?: string | string[];
    error?: string | string[];
    error_description?: string | string[];
    invite?: string | string[];
  }>();
  const code = useMemo(() => firstParam(searchParams.code).trim(), [searchParams.code]);
  const state = useMemo(() => firstParam(searchParams.state).trim(), [searchParams.state]);
  const error = useMemo(() => firstParam(searchParams.error).trim(), [searchParams.error]);
  const errorDescription = useMemo(() => firstParam(searchParams.error_description).trim(), [searchParams.error_description]);
  const inviteToken = useMemo(() => firstParam(searchParams.invite).trim(), [searchParams.invite]);
  const language = useMemo(resolveCallbackLanguage, []);
  const [message, setMessage] = useState(() => t('auth.callback.loading', language));
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function completeAuth() {
      if (!supabase) {
        if (!cancelled) {
          setBusy(false);
          setMessage(t('auth.callback.supabaseMissing', language));
        }
        return;
      }

      if (error) {
        if (!cancelled) {
          setBusy(false);
          setMessage(friendlyCallbackError(errorDescription || error, language));
          console.error('[auth/callback] oauth error', { error, errorDescription });
        }
        return;
      }

      const { data: existingSession } = await supabase.auth.getSession();
      const hashState =
        typeof window === 'undefined' ? parseAuthCallbackHash('') : parseAuthCallbackHash(window.location.hash);
      const hasCallbackPayload = hasAuthCallbackSessionData({
        code,
        hash: hashState,
        sessionPresent: Boolean(existingSession?.session),
      });
      const hasOAuthFragment = hasAuthCallbackFragment(hashState);

      const pathname = typeof window !== 'undefined' ? new URL(window.location.href).pathname : '/auth/callback';
      console.info('[auth/callback] url params', {
        code_present: Boolean(code),
        state_present: Boolean(state),
        error: error || hashState.error || null,
        fragment_session_present: hasCallbackPayload,
        pathname,
      });

      if (existingSession?.session) {
        if (!cancelled) {
          setMessage(t('auth.callback.success', language));
          setBusy(false);
          clearBrowserHash();
          router.replace(getAuthCallbackDestination(inviteToken) as Href);
        }
        return;
      }

      if (hashState.error || hashState.errorDescription) {
        if (!cancelled) {
          setBusy(false);
          setMessage(friendlyCallbackError(hashState.errorDescription || hashState.error, language));
          console.error('[auth/callback] oauth error fragment', {
            fragmentError: hashState.error,
            fragmentErrorDescription: hashState.errorDescription,
          });
        }
        return;
      }

      try {
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          console.info('[auth/callback] exchange done', {
            ok: !exchangeError,
            exchangeError: exchangeError?.message ?? null,
            flow: 'pkce',
          });
          if (exchangeError) {
            throw exchangeError;
          }
        } else if (hasOAuthFragment && hashState.accessToken && hashState.refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: hashState.accessToken,
            refresh_token: hashState.refreshToken,
          });
          console.info('[auth/callback] exchange done', {
            ok: !sessionError,
            exchangeError: sessionError?.message ?? null,
            flow: 'hash',
          });
          if (sessionError) {
            throw sessionError;
          }

          const { data: sessionData, error: sessionErrorAfterHash } = await supabase.auth.getSession();
          console.info('[auth/callback] getSession', {
            ok: !sessionErrorAfterHash,
            user_present: Boolean(sessionData?.session?.user),
            sessionError: sessionErrorAfterHash?.message ?? null,
          });

          if (sessionErrorAfterHash || !sessionData?.session) {
            if (!cancelled) {
              setBusy(false);
              setMessage(t('auth.callback.error.noValidSession', language));
            }
            return;
          }

          if (!cancelled) {
            setMessage(t('auth.callback.success', language));
            setBusy(false);
            clearBrowserHash();
            router.replace(getAuthCallbackDestination(inviteToken) as Href);
          }
          return;
        } else {
          if (!cancelled) {
            setBusy(false);
            setMessage(
              t(
                hasOAuthFragment
                  ? 'auth.callback.error.invalidSession'
                  : 'auth.callback.error.missingCodeOrSession',
                language
              )
            );
            console.error('[auth/callback] missing code or session in callback URL');
          }
          return;
        }

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        console.info('[auth/callback] getSession', {
          ok: !sessionError,
          user_present: Boolean(sessionData?.session?.user),
          sessionError: sessionError?.message ?? null,
        });

        if (sessionError || !sessionData?.session) {
          if (!cancelled) {
            setBusy(false);
            setMessage(t('auth.callback.error.noValidSession', language));
          }
          return;
        }

        if (!cancelled) {
          setMessage(t('auth.callback.success', language));
          setBusy(false);
          clearBrowserHash();
          router.replace(getAuthCallbackDestination(inviteToken) as Href);
        }
      } catch (exchangeError) {
        if (!cancelled) {
          const raw = exchangeError instanceof Error ? exchangeError.message : t('auth.callback.error.oauthFailed', language);
          setBusy(false);
          setMessage(friendlyCallbackError(raw, language));
          console.error('[auth/callback] exchange failed', raw);
        }
      }
    }

    completeAuth().catch(() => {
      if (!cancelled) {
        setBusy(false);
        setMessage(t('auth.callback.error.finishFailed', language));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [code, error, errorDescription, inviteToken, language, router]);

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.logoFrame}>
          <TazeLogo size={84} framed={false} />
        </View>
        <View style={styles.copy}>
          <ThemedText type="title">{t('auth.callback.title', language)}</ThemedText>
          <ThemedText style={styles.subtle}>{message}</ThemedText>
        </View>
        {busy ? <ActivityIndicator color={Brand.primary} /> : null}
        {!busy ? (
          <View style={styles.buttonRow}>
            <TazeButton label={t('auth.callback.action.backToLogin', language)} variant="primary" onPress={() => router.replace('/account')} />
          </View>
        ) : null}
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
    maxWidth: 440,
    alignItems: 'center',
    gap: 18,
    padding: 24,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    backgroundColor: 'rgba(255,255,255,0.92)',
    shadowColor: Brand.dark,
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 2,
    boxShadow: '0px 18px 40px rgba(15, 23, 42, 0.08)',
  },
  logoFrame: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
  },
  copy: {
    alignItems: 'center',
    gap: 8,
  },
  subtle: {
    color: '#475569',
    textAlign: 'center',
  },
  buttonRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'center',
  },
});

