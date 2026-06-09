import Constants from 'expo-constants';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, Share, StyleSheet, View } from 'react-native';

import { ScreenAiPanel } from 'components/screen-ai-panel';
import { TazeButton } from 'components/taze-button';
import { TazeLogo } from 'components/taze-logo';
import { ThemedText } from 'components/themed-text';
import { ThemedView } from 'components/themed-view';
import { Brand } from 'constants/theme';
import { clearBarcodeOverrides, listBarcodeOverrides } from 'lib/barcode-overrides';

export default function UpdatesScreen() {
  const [items, setItems] = useState<Awaited<ReturnType<typeof listBarcodeOverrides>>>([]);
  const [refreshing, setRefreshing] = useState(false);
  const updateAlertShownRef = useRef(false);

  const appVersion = Constants.expoConfig?.version ?? '-';
  const sdkVersion = Constants.expoConfig?.sdkVersion ?? '-';

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const next = await listBarcodeOverrides();
      setItems(next);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  useEffect(() => {
    if (items.length > 0 && !updateAlertShownRef.current) {
      updateAlertShownRef.current = true;
      Alert.alert('Update klaar', `Er staat ${items.length} geleerde update${items.length === 1 ? '' : 's'} klaar.`);
    }
  }, [items.length]);

  const exportPayload = useMemo(() => {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        overrides: items.map((entry) => ({
          barcode: entry.barcode,
          ...entry.override,
        })),
      },
      null,
      2
    );
  }, [items]);

  const handleExport = useCallback(async () => {
    if (!items.length) {
      Alert.alert('Niets te exporteren', 'Er zijn nog geen barcode-correcties opgeslagen.');
      return;
    }

    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(exportPayload);
          Alert.alert('Gekopieerd', 'Export JSON staat in je clipboard.');
          return;
        } catch {
          // ignore and fallback to alert
        }
      }

      Alert.alert('Export JSON', exportPayload.slice(0, 1800));
      return;
    }

    try {
      await Share.share({ message: exportPayload });
    } catch {
      // ignore
    }
  }, [exportPayload, items.length]);

  const handleClear = useCallback(() => {
    if (!items.length) return;
    Alert.alert('Alles wissen?', 'Dit verwijdert alle geleerde barcodes op dit toestel.', [
      { text: 'Annuleer', style: 'cancel' },
      {
        text: 'Wis',
        style: 'destructive',
        onPress: () => {
          clearBarcodeOverrides()
            .then(() => refresh())
            .catch(() => {});
        },
      },
    ]);
  }, [items.length, refresh]);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <ThemedView style={styles.screen}>
        <View style={styles.hero}>
            <View style={styles.heroBrandRow}>
              <View style={styles.heroLogoFrame}>
                <TazeLogo size={96} framed={false} />
              </View>
            <View style={styles.heroCopy}>
              <ThemedText type="title">Updates</ThemedText>
              <ThemedText>
                Hier zie je wat de app geleerd heeft (barcode-correcties) en kan je dat exporteren als backlink.
              </ThemedText>
            </View>
          </View>
          <View style={styles.heroBadge}>
            <ThemedText style={styles.heroBadgeLabel}>Versie</ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.heroBadgeValue}>
              v{appVersion}
            </ThemedText>
            <ThemedText style={styles.heroBadgeText}>App versie {sdkVersion}</ThemedText>
          </View>
        </View>

        {items.length > 0 ? (
          <View style={styles.updateAlert}>
            <ThemedText type="defaultSemiBold" style={styles.updateAlertTitle}>
              Update-alert actief
            </ThemedText>
            <ThemedText style={styles.updateAlertText}>
              Er staan {items.length} geleerde barcode-correctie{items.length === 1 ? '' : 's'} klaar.
            </ThemedText>
          </View>
        ) : null}

        <ScreenAiPanel
          screen="updates"
          status={{
            barcodeLearningCount: items.length,
          }}
        />

        <View style={styles.actions}>
          <TazeButton icon="refresh" label="Refresh" onPress={refresh} disabled={refreshing} variant="secondary" style={styles.secondaryBtn} />
          <TazeButton icon="share" label="Export JSON" onPress={handleExport} variant="primary" style={styles.primaryBtn} />
          <TazeButton icon="delete" label="Wis alles" onPress={handleClear} disabled={!items.length} variant="danger" style={styles.dangerBtn} />
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <ThemedText type="subtitle">Geleerde barcodes</ThemedText>
            <ThemedText style={styles.panelMeta}>{items.length} item(s)</ThemedText>
          </View>

          {items.length ? (
            <View style={styles.list}>
              {items.map((entry) => (
                <View key={entry.barcode} style={styles.row}>
                  <View style={styles.rowText}>
                    <ThemedText type="defaultSemiBold">{entry.override.name}</ThemedText>
                    <ThemedText style={styles.rowMeta}>
                      {entry.barcode} - {entry.override.category}
                      {entry.override.expiryDays === null ? '' : ` - ${entry.override.expiryDays}d`}
                    </ThemedText>
                  </View>
                  <View style={styles.rowBadge}>
                    <ThemedText style={styles.rowBadgeText}>learned</ThemedText>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <ThemedText style={styles.emptyText}>
              Nog geen correcties opgeslagen. Ga naar Scan - Corrigeer - Leer barcode.
            </ThemedText>
          )}
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
  heroBrandRow: {
    flex: 1,
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroLogoFrame: {
    width: 72,
    height: 72,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.4)',
    backgroundColor: Brand.dark,
  },
  heroLogo: {
    width: '100%',
    height: '100%',
  },
  heroBadge: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 180,
    borderRadius: 20,
    padding: 16,
    backgroundColor: Brand.primary,
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
  updateAlert: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(251,146,60,0.28)',
    backgroundColor: 'rgba(255,247,237,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  updateAlertTitle: {
    color: '#9a3412',
  },
  updateAlertText: {
    color: '#7c2d12',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryBtn: {
    flexGrow: 1,
    flexBasis: 160,
  },
  secondaryBtn: {
    flexGrow: 1,
    flexBasis: 160,
  },
  dangerBtn: {
    flexGrow: 1,
    flexBasis: 160,
  },
  panel: {
    gap: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 18,
    boxShadow: '0px 16px 34px rgba(15, 23, 42, 0.07)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.07,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 10,
  },
  panelMeta: {
    color: '#64748b',
    fontSize: 12,
  },
  list: {
    gap: 10,
  },
  row: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(248,250,252,0.9)',
    padding: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  rowText: {
    flex: 1,
    minWidth: 200,
    gap: 2,
  },
  rowMeta: {
    color: '#64748b',
    fontSize: 12,
  },
  rowBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Brand.primary,
  },
  rowBadgeText: {
    color: '#ffffff',
    fontSize: 11,
  },
  emptyText: {
    color: '#64748b',
  },
});
