import { StyleSheet, View } from 'react-native';

import { Brand } from 'constants/theme';

type Props = {
  variant?: 'light' | 'dark';
};

export function AppBackdrop({ variant = 'light' }: Props) {
  const isDark = variant === 'dark';

  return (
    <View pointerEvents="none" style={[styles.base, isDark ? styles.baseDark : styles.baseLight]}>
      <View style={[styles.orb, isDark ? styles.orbDarkPrimary : styles.orbLightPrimary]} />
      <View style={[styles.orb, isDark ? styles.orbDarkAccent : styles.orbLightAccent]} />
      <View style={[styles.orb, isDark ? styles.orbDarkGlow : styles.orbLightGlow]} />
      <View style={[styles.horizon, isDark ? styles.horizonDark : styles.horizonLight]} />
      <View style={[styles.mesh, isDark ? styles.meshDark : styles.meshLight]} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  baseLight: {
    backgroundColor: Brand.canvas,
  },
  baseDark: {
    backgroundColor: Brand.dark,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbLightPrimary: {
    width: 360,
    height: 360,
    top: -140,
    right: -120,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
  },
  orbLightAccent: {
    width: 300,
    height: 300,
    top: 190,
    left: -120,
    backgroundColor: 'rgba(37, 99, 235, 0.07)',
  },
  orbLightGlow: {
    width: 460,
    height: 460,
    bottom: -220,
    right: -160,
    backgroundColor: 'rgba(45, 212, 191, 0.08)',
  },
  orbDarkPrimary: {
    width: 360,
    height: 360,
    top: -150,
    right: -120,
    backgroundColor: 'rgba(45, 212, 191, 0.08)',
  },
  orbDarkAccent: {
    width: 300,
    height: 300,
    top: 190,
    left: -120,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
  },
  orbDarkGlow: {
    width: 460,
    height: 460,
    bottom: -220,
    right: -160,
    backgroundColor: 'rgba(168, 85, 247, 0.06)',
  },
  horizon: {
    position: 'absolute',
    left: -80,
    right: -80,
    top: 120,
    height: 1,
    opacity: 0.55,
  },
  horizonLight: {
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
  },
  horizonDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  mesh: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    opacity: 0.14,
  },
  meshLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  meshDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
});
