import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Brand } from 'constants/theme';
import { TazeButton } from 'components/taze-button';
import { TazeCard } from 'components/taze-card';
import { TazeSectionHeader } from 'components/taze-section-header';
import { ThemedText } from 'components/themed-text';

type Props = {
  title: string;
  subtitle: string;
  email: string;
  badge?: string;
};

export function CopyableMailBlock({ title, subtitle, email, badge = 'Mail' }: Props) {
  const trimmedEmail = useMemo(() => email.trim(), [email]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(timer);
  }, [copied]);

  const copyEmail = useCallback(async () => {
    if (!trimmedEmail) return;

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(trimmedEmail);
      setCopied(true);
      return;
    }

    Alert.alert('Kopiëren niet beschikbaar', trimmedEmail);
  }, [trimmedEmail]);

  const openMail = useCallback(() => {
    if (!trimmedEmail) return;
    Linking.openURL(`mailto:${trimmedEmail}`).catch(() => {
      Alert.alert('Mail openen mislukt', trimmedEmail);
    });
  }, [trimmedEmail]);

  return (
    <TazeCard variant="muted" style={styles.card}>
      <TazeSectionHeader title={title} subtitle={subtitle} badge={badge} badgeTone="info" />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Kopieer ${trimmedEmail}`}
        accessibilityHint="Tik om het e-mailadres te kopiëren"
        onPress={() => copyEmail().catch(() => {})}
        style={({ pressed }) => [styles.emailBlock, pressed ? styles.emailBlockPressed : null]}>
        <View style={styles.emailIconWrap}>
          <MaterialIcons name="content-copy" size={20} color={Brand.primary} />
        </View>
        <View style={styles.emailCopy}>
          <ThemedText style={styles.emailLabel}>E-mailadres</ThemedText>
          <ThemedText type="defaultSemiBold" selectable style={styles.emailValue}>
            {trimmedEmail}
          </ThemedText>
          <ThemedText style={styles.emailHint}>{copied ? 'Gekopieerd' : 'Tik om te kopiëren'}</ThemedText>
        </View>
      </Pressable>

      <View style={styles.actions}>
        <TazeButton
          label={copied ? 'Gekopieerd' : 'Kopieer mail'}
          icon={copied ? 'check' : 'content-copy'}
          onPress={() => copyEmail().catch(() => {})}
          variant="secondary"
        />
        <TazeButton label="Mail openen" icon="mail" onPress={openMail} variant="primary" />
      </View>
    </TazeCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
  },
  emailBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 14,
  },
  emailBlockPressed: {
    opacity: 0.92,
    transform: [{ translateY: 1 }],
  },
  emailIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailCopy: {
    flex: 1,
    gap: 2,
  },
  emailLabel: {
    color: '#64748b',
    fontSize: 12,
  },
  emailValue: {
    fontSize: 16,
    lineHeight: 22,
  },
  emailHint: {
    color: '#64748b',
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
