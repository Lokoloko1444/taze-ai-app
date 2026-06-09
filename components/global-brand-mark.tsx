import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from 'constants/theme';
import { TazeLogo } from 'components/taze-logo';

export function GlobalBrandMark() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scale = useRef(new Animated.Value(1)).current;
  const navigateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (navigateTimer.current) {
        clearTimeout(navigateTimer.current);
      }
    };
  }, []);

  const handlePress = () => {
    if (navigateTimer.current) {
      clearTimeout(navigateTimer.current);
    }

    Animated.sequence([
      Animated.spring(scale, {
        toValue: 0.88,
        useNativeDriver: true,
        speed: 24,
        bounciness: 4,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 5,
      }),
    ]).start();

    navigateTimer.current = setTimeout(() => {
      router.replace('/');
    }, 95);
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 12 }]}>
      <Pressable onPress={handlePress} accessibilityRole="button" accessibilityLabel="Taze, terug naar home">
        <Animated.View style={[styles.shell, { transform: [{ scale }] }]}>
          <TazeLogo size={28} framed={false} />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  shell: {
    width: 30,
    height: 30,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(5, 8, 22, 0.82)',
    shadowColor: Brand.dark,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    boxShadow: '0px 8px 18px rgba(5, 8, 22, 0.18)',
  },
});
