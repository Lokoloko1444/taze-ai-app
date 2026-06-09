import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Brand, StatusColors } from 'constants/theme';
import { ThemedText } from 'components/themed-text';

type TazeBadgeTone = 'primary' | 'accent' | 'neutral' | 'warning' | 'success' | 'danger' | 'info';

type Props = {
  label: string;
  tone?: TazeBadgeTone;
  icon?: keyof typeof MaterialIcons.glyphMap;
  style?: StyleProp<ViewStyle>;
};

const badgeTones: Record<
  TazeBadgeTone,
  {
    backgroundColor: string;
    borderColor: string;
    textColor: string;
    iconColor: string;
  }
> = {
  primary: {
    backgroundColor: 'rgba(236, 253, 248, 0.9)',
    borderColor: 'rgba(47, 212, 191, 0.22)',
    textColor: Brand.primaryStrong,
    iconColor: Brand.primary,
  },
  accent: {
    backgroundColor: '#f4f7ff',
    borderColor: 'rgba(37, 99, 235, 0.18)',
    textColor: '#1e40af',
    iconColor: Brand.accent,
  },
  neutral: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderColor: '#d8e2ed',
    textColor: '#475569',
    iconColor: '#64748b',
  },
  warning: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    textColor: '#9a3412',
    iconColor: '#c2410c',
  },
  success: {
    backgroundColor: StatusColors.success.background,
    borderColor: StatusColors.success.border,
    textColor: StatusColors.success.text,
    iconColor: StatusColors.success.text,
  },
  danger: {
    backgroundColor: StatusColors.failed.background,
    borderColor: StatusColors.failed.border,
    textColor: StatusColors.failed.text,
    iconColor: StatusColors.failed.text,
  },
  info: {
    backgroundColor: StatusColors.info.background,
    borderColor: StatusColors.info.border,
    textColor: StatusColors.info.text,
    iconColor: StatusColors.info.text,
  },
};

export function TazeBadge({ label, tone = 'primary', icon, style }: Props) {
  const palette = badgeTones[tone];

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
        },
        style,
      ]}>
      {icon ? <MaterialIcons name={icon} size={14} color={palette.iconColor} /> : null}
      <ThemedText type="defaultSemiBold" style={[styles.label, { color: palette.textColor }]}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
    boxShadow: '0px 4px 10px rgba(15, 23, 42, 0.04)',
  },
  label: {
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.2,
  },
});
