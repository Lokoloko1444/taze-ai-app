import { StyleSheet, View } from 'react-native';

import { Brand, BrandIdentity } from 'constants/theme';
import { ThemedText } from 'components/themed-text';
import { TazeLogo } from 'components/taze-logo';

export function HeaderBrandBadge() {
  return (
    <View style={styles.wrap}>
      <View style={styles.logoFrame}>
        <TazeLogo size={34} framed={false} />
      </View>
      <View style={styles.copy}>
        <ThemedText type="defaultSemiBold" style={styles.title}>
          {BrandIdentity.appName}
        </ThemedText>
        <ThemedText style={styles.caption}>Live voorraad</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    backgroundColor: 'rgba(255,255,255,0.88)',
    shadowColor: Brand.dark,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
    boxShadow: '0px 10px 22px rgba(15, 23, 42, 0.06)',
  },
  logoFrame: {
    width: 32,
    height: 32,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: Brand.dark,
  },
  copy: {
    alignItems: 'flex-start',
  },
  title: {
    color: Brand.ink,
    fontSize: 13.5,
    lineHeight: 16,
    letterSpacing: -0.2,
  },
  caption: {
    color: Brand.inkMuted,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
});

