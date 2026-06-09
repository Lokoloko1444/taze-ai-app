import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { resolveAppLanguage, t } from 'lib/i18n';
import { useNetworkMode } from 'lib/network-mode';

export default function OfflineIndicator() {
  const { mode } = useNetworkMode();
  const uiLanguage = useMemo(resolveAppLanguage, []);

  if (mode === 'online') return null;

  const bannerText =
    mode === 'bluetooth'
      ? `${t('offline.banner.text', uiLanguage)} (Bluetooth fallback ingeschakeld)`
      : t('offline.banner.text', uiLanguage);

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{bannerText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  text: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
