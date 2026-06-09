import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { TazeBadge } from 'components/taze-badge';
import { TazeCard } from 'components/taze-card';
import { ThemedText } from 'components/themed-text';
import { Brand } from 'constants/theme';
import { supabase } from 'lib/supabase';

type ConfirmStatus = 'loading' | 'success' | 'error';

function normalizeToken(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' ? raw.trim() : '';
}

export default function ConfirmDeliveryScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = useMemo(() => normalizeToken(params.token), [params.token]);
  const [status, setStatus] = useState<ConfirmStatus>('loading');
  const [message, setMessage] = useState('Levering wordt gecontroleerd...');

  useEffect(() => {
    let cancelled = false;

    async function confirmDelivery() {
      if (!token) {
        setStatus('error');
        setMessage('Geen bevestigingstoken gevonden.');
        return;
      }

      if (!supabase) {
        setStatus('error');
        setMessage('Supabase is niet geconfigureerd.');
        return;
      }

      try {
        const { error } = await supabase
          .schema('transacties')
          .rpc('confirm_delivery_by_token', { p_token: token });

        if (error) {
          throw error;
        }

        if (!cancelled) {
          setStatus('success');
          setMessage('Levering bevestigd. Bedankt voor uw bevestiging.');
        }
      } catch (caught) {
        if (!cancelled) {
          setStatus('error');
          setMessage(caught instanceof Error ? caught.message : 'Levering bevestigen is mislukt.');
        }
      }
    }

    confirmDelivery();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <View style={styles.shell}>
      <TazeCard variant="panel" style={styles.card}>
        <TazeBadge label="Klantbevestiging" tone={status === 'success' ? 'success' : status === 'error' ? 'warning' : 'info'} icon="verified" />
        <View style={styles.iconCircle}>
          {status === 'loading' ? (
            <ActivityIndicator color={Brand.primaryStrong} />
          ) : (
            <MaterialIcons name={status === 'success' ? 'check-circle' : 'error-outline'} size={42} color={status === 'success' ? Brand.primaryStrong : '#b91c1c'} />
          )}
        </View>
        <ThemedText type="title" style={styles.title}>
          {status === 'success' ? 'Levering bevestigd' : status === 'error' ? 'Bevestiging mislukt' : 'Even controleren'}
        </ThemedText>
        <ThemedText style={styles.message}>{message}</ThemedText>
      </TazeCard>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  card: {
    alignItems: 'center',
    gap: 16,
    padding: 24,
  },
  iconCircle: {
    width: 74,
    height: 74,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 37,
    backgroundColor: '#ecfeff',
  },
  title: {
    color: Brand.ink,
    textAlign: 'center',
  },
  message: {
    maxWidth: 540,
    color: Brand.inkMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});
