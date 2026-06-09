import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Brand, StatusColors } from 'constants/theme';
import { ThemedText } from 'components/themed-text';

type TazeStatusKind = 'pending' | 'opened' | 'applied' | 'success' | 'failed' | 'warning' | 'info' | 'neutral';

type Props = {
  label: string;
  kind?: TazeStatusKind;
  style?: StyleProp<ViewStyle>;
};

const kindStyles: Record<
  TazeStatusKind,
  {
    backgroundColor: string;
    borderColor: string;
    textColor: string;
  }
> = {
  pending: {
    backgroundColor: StatusColors.pending.background,
    borderColor: StatusColors.pending.border,
    textColor: StatusColors.pending.text,
  },
  opened: {
    backgroundColor: StatusColors.opened.background,
    borderColor: StatusColors.opened.border,
    textColor: StatusColors.opened.text,
  },
  applied: {
    backgroundColor: StatusColors.applied.background,
    borderColor: StatusColors.applied.border,
    textColor: StatusColors.applied.text,
  },
  success: {
    backgroundColor: StatusColors.success.background,
    borderColor: StatusColors.success.border,
    textColor: StatusColors.success.text,
  },
  failed: {
    backgroundColor: StatusColors.failed.background,
    borderColor: StatusColors.failed.border,
    textColor: StatusColors.failed.text,
  },
  warning: {
    backgroundColor: StatusColors.warning.background,
    borderColor: StatusColors.warning.border,
    textColor: StatusColors.warning.text,
  },
  info: {
    backgroundColor: StatusColors.info.background,
    borderColor: StatusColors.info.border,
    textColor: StatusColors.info.text,
  },
  neutral: {
    backgroundColor: Brand.surface,
    borderColor: '#dbe4ee',
    textColor: Brand.inkMuted,
  },
};

export function TazeStatusPill({ label, kind = 'neutral', style }: Props) {
  const palette = kindStyles[kind];

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
      <ThemedText type="defaultSemiBold" style={[styles.label, { color: palette.textColor }]}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
    boxShadow: '0px 6px 14px rgba(15, 23, 42, 0.05)',
  },
  label: {
    fontSize: 11.5,
    lineHeight: 16,
    letterSpacing: 0.15,
  },
});
