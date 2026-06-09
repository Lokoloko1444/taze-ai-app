import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Brand, Fonts } from 'constants/theme';
import { useResponsiveLayout } from 'hooks/use-responsive-layout';
import { ThemedText } from 'components/themed-text';
import { TazeLogo } from 'components/taze-logo';

type Props = {
  title: string;
  subtitle?: string;
  description: string;
  badgeLabel?: string;
  badgeValue?: string | number;
  badgeText?: string;
  aside?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function TazeHero({
  title,
  subtitle,
  description,
  badgeLabel,
  badgeValue,
  badgeText,
  aside,
  style,
}: Props) {
  const { isCompact } = useResponsiveLayout();

  return (
    <View style={[styles.hero, isCompact && styles.heroCompact, style]}>
      <View style={[styles.brandRow, isCompact && styles.brandRowCompact]}>
        <View style={[styles.logoFrame, isCompact && styles.logoFrameCompact]}>
          <TazeLogo size={isCompact ? 56 : 72} />
        </View>
        <View style={styles.copy}>
          <ThemedText type="title">{title}</ThemedText>
          {subtitle ? <ThemedText type="subtitle">{subtitle}</ThemedText> : null}
          <ThemedText>{description}</ThemedText>
        </View>
      </View>
      {aside ? (
        <View style={[styles.aside, isCompact && styles.asideCompact]}>{aside}</View>
      ) : badgeLabel || badgeValue || badgeText ? (
        <View style={[styles.badgeCard, isCompact && styles.badgeCardCompact]}>
          {badgeLabel ? <ThemedText style={styles.badgeLabel}>{badgeLabel}</ThemedText> : null}
          {badgeValue !== undefined ? (
            <ThemedText type="defaultSemiBold" style={styles.badgeValue}>
              {badgeValue}
            </ThemedText>
          ) : null}
          {badgeText ? <ThemedText style={styles.badgeText}>{badgeText}</ThemedText> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.07)',
    backgroundColor: 'rgba(255,255,255,0.89)',
    padding: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    alignItems: 'stretch',
    justifyContent: 'space-between',
    shadowColor: Brand.dark,
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 1,
    boxShadow: '0px 12px 30px rgba(15, 23, 42, 0.05)',
  },
  heroCompact: {
    padding: 16,
  },
  brandRow: {
    flex: 1,
    minWidth: 240,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  brandRowCompact: {
    width: '100%',
    minWidth: 0,
    alignItems: 'flex-start',
  },
  logoFrame: {
    width: 76,
    height: 76,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: Brand.dark,
    boxShadow: '0px 10px 22px rgba(15, 23, 42, 0.12)',
  },
  logoFrameCompact: {
    width: 60,
    height: 60,
    borderRadius: 18,
  },
  copy: {
    flex: 1,
    minWidth: 180,
    gap: 8,
  },
  aside: {
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  asideCompact: {
    width: '100%',
  },
  badgeCard: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 180,
    borderRadius: 24,
    padding: 18,
    backgroundColor: Brand.dark,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 6,
    justifyContent: 'space-between',
    boxShadow: '0px 12px 26px rgba(5, 8, 22, 0.18)',
  },
  badgeCardCompact: {
    width: '100%',
    minWidth: 0,
    flexBasis: 'auto',
  },
  badgeLabel: {
    color: Brand.glow,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  badgeValue: {
    color: Brand.white,
    fontSize: 24,
    lineHeight: 30,
    fontFamily: Fonts.display,
  },
  badgeText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    lineHeight: 18,
  },
});
