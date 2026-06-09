import { StyleSheet, Text, type TextProps } from 'react-native';

import { Brand, Fonts } from 'constants/theme';
import { useThemeColor } from 'hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

const APP_FONT_FAMILY = Fonts?.body ?? 'Avenir Next';
const APP_DISPLAY_FONT_FAMILY = Fonts?.display ?? APP_FONT_FAMILY;

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontFamily: APP_FONT_FAMILY,
    fontWeight: '400',
    fontSize: 16.5,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontFamily: APP_FONT_FAMILY,
    fontSize: 16.5,
    lineHeight: 24,
    fontWeight: '600',
  },
  title: {
    fontFamily: APP_DISPLAY_FONT_FAMILY,
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 42,
    letterSpacing: -0.65,
  },
  subtitle: {
    fontFamily: APP_DISPLAY_FONT_FAMILY,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.25,
  },
  link: {
    fontFamily: APP_FONT_FAMILY,
    fontWeight: '600',
    lineHeight: 28,
    fontSize: 16,
    color: Brand.accent,
    textDecorationLine: 'underline',
    textDecorationColor: Brand.accent,
  },
});
