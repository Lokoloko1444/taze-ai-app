import Constants from 'expo-constants';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from 'components/themed-text';
import { ThemedView } from 'components/themed-view';
import { Brand } from 'constants/theme';
import { defaultSoundSettings, saveSoundSettings } from 'lib/notification-sounds';
import { useAuth } from 'lib/auth-context';
import { clearBarcodeOverrides } from 'lib/barcode-overrides';
import { secureRemoveItem } from 'lib/secure-storage';
import { removeItem } from 'lib/app-storage';
import { seedDemoDatabase } from 'hooks/use-inventory';
import { getPermissionMessage, hasPermission } from 'lib/role-permissions';
import { getServerBaseUrl } from 'lib/server-url';

function getHealthUrl() {
  return `${getServerBaseUrl()}/health`;
}

export default function DevtoolsScreen() {
  const { email, role } = useAuth();
  const [busy, setBusy] = useState(false);
  const canManageDevtools = useMemo(
    () => hasPermission({ permission: 'manage_devtools', role, email }),
    [email, role]
  );

  const env = useMemo(() => {
    return {
      version: Constants.expoConfig?.version ?? '-',
      sdk: Constants.expoConfig?.sdkVersion ?? '-',
      platform: Platform.OS,
    };
  }, []);

  const handleHealthCheck = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(getHealthUrl());
      const json = await res.json().catch(() => ({}));
      Alert.alert('Health', `${res.ok ? 'OK' : `Niet OK (${res.status})`}\n${JSON.stringify(json).slice(0, 800)}`);
    } catch {
      Alert.alert('Health', `Server niet bereikbaar\n${getHealthUrl()}`);
    } finally {
      setBusy(false);
    }
  }, []);

  const handleResetDemo = useCallback(() => {
    seedDemoDatabase();
    Alert.alert('Herstel', 'Data is teruggezet.');
  }, []);

  const handleClearLearning = useCallback(() => {
    setBusy(true);
    clearBarcodeOverrides()
      .then(() => Alert.alert('Leren gewist', 'Alle barcode-correcties zijn verwijderd.'))
      .finally(() => setBusy(false));
  }, []);

  const handleClearPayout = useCallback(() => {
    setBusy(true);
    secureRemoveItem('payout-account-v1')
      .then(() => Alert.alert('Rekening verwijderd', 'Payout account is gewist uit SecureStore.'))
      .finally(() => setBusy(false));
  }, []);

  const handleResetSounds = useCallback(() => {
    saveSoundSettings(defaultSoundSettings);
    Alert.alert('Geluiden', 'Sound instellingen zijn teruggezet naar standaard.');
  }, []);

  const handleClearInventoryStorage = useCallback(() => {
    setBusy(true);
    removeItem('stock-ai-inventory-v1')
      .then(() => Alert.alert('Storage', 'Opslagsleutel van voorraad is verwijderd. Herstart de app of herstel de data opnieuw.'))
      .finally(() => setBusy(false));
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <ThemedView style={styles.screen}>
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <ThemedText type="title">Beheer</ThemedText>
            <ThemedText>Debug & beheer voor live/production klaar te maken.</ThemedText>
          </View>
          <View style={styles.heroBadge}>
            <ThemedText style={styles.heroBadgeLabel}>Env</ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.heroBadgeValue}>
              {env.platform}
            </ThemedText>
            <ThemedText style={styles.heroBadgeText}>v{env.version} - SDK {env.sdk}</ThemedText>
          </View>
        </View>

        {!canManageDevtools ? (
          <View style={styles.notice}>
            <ThemedText type="defaultSemiBold">Alleen-lezen</ThemedText>
            <ThemedText style={styles.cardMeta}>{getPermissionMessage('manage_devtools')}</ThemedText>
          </View>
        ) : null}

        <View style={styles.grid}>
          <Pressable style={styles.card} onPress={handleHealthCheck} disabled={busy || !canManageDevtools} accessibilityRole="button">
            <MaterialIcons name="health-and-safety" size={20} color="#0f172a" />
            <View style={styles.cardText}>
              <ThemedText type="defaultSemiBold">Health check</ThemedText>
              <ThemedText style={styles.cardMeta}>Ping `/health` op de AI server.</ThemedText>
            </View>
          </Pressable>

          <Pressable style={styles.card} onPress={handleResetDemo} disabled={busy || !canManageDevtools} accessibilityRole="button">
            <MaterialIcons name="restore" size={20} color="#0f172a" />
            <View style={styles.cardText}>
              <ThemedText type="defaultSemiBold">Herstel data</ThemedText>
              <ThemedText style={styles.cardMeta}>Zet voorraad en financien terug naar de startstatus.</ThemedText>
            </View>
          </Pressable>

          <Pressable style={styles.card} onPress={handleResetSounds} disabled={busy || !canManageDevtools} accessibilityRole="button">
            <MaterialIcons name="volume-up" size={20} color="#0f172a" />
            <View style={styles.cardText}>
              <ThemedText type="defaultSemiBold">Reset geluiden</ThemedText>
              <ThemedText style={styles.cardMeta}>Zet sound settings terug naar default.</ThemedText>
            </View>
          </Pressable>

          <Pressable style={styles.cardDanger} onPress={handleClearLearning} disabled={busy || !canManageDevtools} accessibilityRole="button">
            <MaterialIcons name="delete" size={20} color="#fff" />
            <View style={styles.cardText}>
              <ThemedText type="defaultSemiBold" style={styles.cardDangerText}>Wis learned barcodes</ThemedText>
              <ThemedText style={styles.cardDangerMeta}>Verwijdert lokale overrides (backlink).</ThemedText>
            </View>
          </Pressable>

          <Pressable style={styles.cardDanger} onPress={handleClearPayout} disabled={busy || !canManageDevtools} accessibilityRole="button">
            <MaterialIcons name="lock-reset" size={20} color="#fff" />
            <View style={styles.cardText}>
              <ThemedText type="defaultSemiBold" style={styles.cardDangerText}>Wis payout account</ThemedText>
              <ThemedText style={styles.cardDangerMeta}>Verwijdert `payout-account-v1` uit SecureStore.</ThemedText>
            </View>
          </Pressable>

          <Pressable
            style={styles.cardDanger}
            onPress={handleClearInventoryStorage}
            disabled={busy || !canManageDevtools}
            accessibilityRole="button">
            <MaterialIcons name="delete-sweep" size={20} color="#fff" />
            <View style={styles.cardText}>
              <ThemedText type="defaultSemiBold" style={styles.cardDangerText}>Wis inventory storage</ThemedText>
              <ThemedText style={styles.cardDangerMeta}>Verwijdert `stock-ai-inventory-v1` key.</ThemedText>
            </View>
          </Pressable>
        </View>
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
  hero: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    boxShadow: '0px 18px 40px rgba(15, 23, 42, 0.08)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  heroCopy: {
    flex: 1,
    minWidth: 220,
    gap: 6,
  },
  heroBadge: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 180,
    borderRadius: 20,
    padding: 16,
    backgroundColor: Brand.accent,
    gap: 4,
  },
  heroBadgeLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
  },
  heroBadgeValue: {
    color: '#ffffff',
    fontSize: 28,
  },
  heroBadgeText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  notice: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(254,202,202,0.72)',
    backgroundColor: 'rgba(255,241,242,0.92)',
    padding: 14,
    gap: 4,
  },
  card: {
    flexGrow: 1,
    flexBasis: 280,
    minWidth: 220,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  cardText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  cardMeta: {
    color: '#64748b',
    fontSize: 12,
  },
  cardDanger: {
    flexGrow: 1,
    flexBasis: 280,
    minWidth: 220,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.78)',
    backgroundColor: 'rgba(220,38,38,0.92)',
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  cardDangerText: {
    color: '#ffffff',
  },
  cardDangerMeta: {
    color: '#fee2e2',
    fontSize: 12,
  },
});

