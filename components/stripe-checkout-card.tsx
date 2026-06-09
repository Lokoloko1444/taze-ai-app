import { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { TazeButton } from 'components/taze-button';
import { TazeCard } from 'components/taze-card';
import { ThemedText } from 'components/themed-text';
import { useAuth } from 'lib/auth-context';
import { getServerBaseUrl } from 'lib/server-url';

type StripeInterval = 'month' | 'quarter' | 'year';

type Props = {
  title: string;
  description: string;
  planId: string;
  interval: StripeInterval;
  successUrl: string;
  cancelUrl: string;
  buttonLabel?: string;
  statusLabel?: string;
  note?: string;
};

const intervalLabels: Record<StripeInterval, string> = {
  month: 'Maandelijks',
  quarter: 'Per kwartaal',
  year: 'Jaarlijks',
};

export function StripeCheckoutCard({
  title,
  description,
  planId,
  interval,
  successUrl,
  cancelUrl,
  buttonLabel = 'Start betaling',
  statusLabel = 'Stripe betaling',
  note,
}: Props) {
  const { email } = useAuth();
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const serverBaseUrl = useMemo(() => getServerBaseUrl(), []);

  const handleCheckout = useCallback(async () => {
    setState('loading');

    try {
      const response = await fetch(`${serverBaseUrl}/api/stripe/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          interval,
          successUrl,
          cancelUrl,
          email: email?.trim() || undefined,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.url) {
        throw new Error(data?.error || 'stripe_checkout_failed');
      }

      const url = String(data.url);
      if (Platform.OS === 'web') {
        window.location.href = url;
        return;
      }

      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });
      setState('done');
    } catch (error) {
      console.error('Stripe betaling fout:', error);
      setState('error');
      Alert.alert('Betaling mislukt', 'Stripe betaling kon niet worden gestart. Controleer de configuratie.');
    }
  }, [cancelUrl, email, interval, planId, serverBaseUrl, successUrl]);

  return (
    <TazeCard style={styles.card}>
      <View style={styles.header}>
        <View style={styles.copy}>
          <ThemedText type="defaultSemiBold" style={styles.status}>
            {statusLabel}
          </ThemedText>
          <ThemedText type="title">{title}</ThemedText>
          <ThemedText style={styles.description}>{description}</ThemedText>
        </View>
        <View style={styles.meta}>
          <ThemedText type="defaultSemiBold" style={styles.metaLabel}>
            Plan
          </ThemedText>
          <ThemedText style={styles.metaValue}>{planId}</ThemedText>
          <ThemedText type="defaultSemiBold" style={styles.metaLabel}>
            Interval
          </ThemedText>
          <ThemedText style={styles.metaValue}>{intervalLabels[interval]}</ThemedText>
        </View>
      </View>

      {note ? <ThemedText style={styles.note}>{note}</ThemedText> : null}

      <View style={styles.actions}>
        <TazeButton
          label={state === 'loading' ? 'Betaling openen...' : buttonLabel}
          onPress={() => {
            void handleCheckout();
          }}
          icon="payments"
          variant="primary"
        />
        <ThemedText style={styles.footer}>
          Terug naar live betaling: success- en cancel-routes staan al goed in Taze.
        </ThemedText>
      </View>

      {state === 'error' ? <ThemedText style={styles.error}>Controleer de Stripe server keys en price IDs.</ThemedText> : null}
    </TazeCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  copy: {
    flex: 1,
    minWidth: 220,
    gap: 6,
  },
  status: {
    color: '#0f766e',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 12,
  },
  description: {
    color: '#475569',
  },
  meta: {
    minWidth: 160,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#f8fafc',
    padding: 12,
    gap: 4,
  },
  metaLabel: {
    color: '#64748b',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: {
    color: '#0f172a',
    marginBottom: 6,
  },
  note: {
    color: '#334155',
  },
  actions: {
    gap: 10,
  },
  footer: {
    color: '#64748b',
    fontSize: 12,
  },
  error: {
    color: '#b91c1c',
  },
});

