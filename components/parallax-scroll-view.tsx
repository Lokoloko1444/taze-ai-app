import type { PropsWithChildren, ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollOffset,
} from 'react-native-reanimated';

import { Brand } from 'constants/theme';
import { ThemedView } from 'components/themed-view';
import { useResponsiveLayout } from 'hooks/use-responsive-layout';
import { useColorScheme } from 'hooks/use-color-scheme';
import { useThemeColor } from 'hooks/use-theme-color';

const HEADER_HEIGHT = 250;

type Props = PropsWithChildren<{
  headerImage: ReactElement;
  headerBackgroundColor: { dark: string; light: string };
  headerHeight?: number;
}>;

export default function ParallaxScrollView({
  children,
  headerImage,
  headerBackgroundColor,
  headerHeight = HEADER_HEIGHT,
}: Props) {
  const { isCompact, pageMaxWidth, pagePadding } = useResponsiveLayout();
  const backgroundColor = useThemeColor({}, 'background');
  const colorScheme = useColorScheme() ?? 'light';
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollOffset(scrollRef);
  const headerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            scrollOffset.value,
            [-headerHeight, 0, headerHeight],
            [-headerHeight / 2, 0, headerHeight * 0.75]
          ),
        },
        {
          scale: interpolate(scrollOffset.value, [-headerHeight, 0, headerHeight], [2, 1, 1]),
        },
      ] as any,
    };
  }) as any;

  return (
    <Animated.ScrollView
      ref={scrollRef}
      style={{ backgroundColor: backgroundColor, flex: 1 }}
      scrollEventThrottle={16}>
      <Animated.View
        style={[
          styles.header,
          { height: headerHeight, backgroundColor: headerBackgroundColor[colorScheme] },
          headerAnimatedStyle,
        ]}>
        <View style={[styles.headerGlow, styles.headerGlowPrimary]} />
        <View style={[styles.headerGlow, styles.headerGlowSecondary]} />
        <View style={[styles.headerGlow, styles.headerGlowAccent]} />
        {headerImage}
      </Animated.View>
      <ThemedView style={[styles.content, { paddingHorizontal: pagePadding }]}>
        <ThemedView
          style={[
            styles.contentInner,
            { maxWidth: pageMaxWidth },
            isCompact && styles.contentInnerCompact,
          ]}>
          {children}
        </ThemedView>
      </ThemedView>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    overflow: 'hidden',
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    shadowColor: Brand.dark,
    shadowOpacity: 0.16,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 16 },
    elevation: 4,
    boxShadow: '0px 24px 48px rgba(15, 23, 42, 0.16)',
  },
  content: {
    flex: 1,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 18,
    overflow: 'hidden',
  },
  contentInner: {
    width: '100%',
    alignSelf: 'center',
    gap: 18,
  },
  contentInnerCompact: {
    gap: 14,
  },
  headerGlow: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.9,
  },
  headerGlowPrimary: {
    width: 260,
    height: 260,
    top: -120,
    right: -40,
    backgroundColor: 'rgba(45, 212, 191, 0.18)',
  },
  headerGlowSecondary: {
    width: 220,
    height: 220,
    bottom: -120,
    left: -60,
    backgroundColor: 'rgba(37, 99, 235, 0.14)',
  },
  headerGlowAccent: {
    width: 160,
    height: 160,
    top: 24,
    left: '40%',
    backgroundColor: 'rgba(168, 85, 247, 0.08)',
  },
});
