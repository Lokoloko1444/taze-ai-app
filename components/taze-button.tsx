import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Platform, Pressable, StyleSheet, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { Brand } from 'constants/theme';
import { ThemedText } from 'components/themed-text';

type TazeButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

type Props = {
  label: string;
  onPress: () => void;
  icon?: keyof typeof MaterialIcons.glyphMap;
  disabled?: boolean;
  variant?: TazeButtonVariant;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: PressableProps['accessibilityLabel'];
  accessibilityRole?: PressableProps['accessibilityRole'];
};

const variantStyles: Record<
  TazeButtonVariant,
  {
    backgroundColor: string;
    borderColor: string;
    textColor: string;
    iconColor: string;
  }
> = {
  primary: {
    backgroundColor: Brand.primary,
    borderColor: Brand.primaryStrong,
    textColor: Brand.white,
    iconColor: Brand.white,
  },
  secondary: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderColor: 'rgba(15, 23, 42, 0.07)',
    textColor: Brand.ink,
    iconColor: Brand.primary,
  },
  danger: {
    backgroundColor: '#fff8f2',
    borderColor: '#fed7aa',
    textColor: '#9a3412',
    iconColor: '#c2410c',
  },
  ghost: {
    backgroundColor: '#f4f7ff',
    borderColor: 'rgba(37, 99, 235, 0.18)',
    textColor: Brand.accent,
    iconColor: Brand.accent,
  },
};

export function TazeButton({
  label,
  onPress,
  icon,
  disabled = false,
  variant = 'secondary',
  style,
  accessibilityLabel,
  accessibilityRole = 'button',
}: Props) {
  const palette = variantStyles[variant];
  const buttonStyle = StyleSheet.flatten([
    styles.base,
    style,
    {
      backgroundColor: palette.backgroundColor,
      borderColor: palette.borderColor,
      opacity: disabled ? 0.5 : 1,
    },
  ]) as Record<string, string | number>;

  if (Platform.OS === 'web') {
    return (
      <button
        aria-label={accessibilityLabel ?? label}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            onPress();
          }
        }}
        type="button"
        style={{
          ...buttonStyle,
          appearance: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          borderStyle: 'solid',
          textAlign: 'left',
          textDecoration: 'none',
          userSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
          transform: 'none',
          boxShadow: '0px 6px 16px rgba(15, 23, 42, 0.05)',
        }}>
        {icon ? <MaterialIcons name={icon} size={18} color={palette.iconColor} /> : null}
        <ThemedText type="defaultSemiBold" style={[styles.text as TextStyle, { color: palette.textColor }]}>
          {label}
        </ThemedText>
      </button>
    );
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) =>
        [
          styles.base,
          style,
          {
            backgroundColor: palette.backgroundColor,
            borderColor: palette.borderColor,
            opacity: disabled ? 0.5 : pressed ? 0.92 : 1,
          },
          pressed ? styles.pressed : null,
        ] as StyleProp<ViewStyle>
      }>
      {icon ? <MaterialIcons name={icon} size={18} color={palette.iconColor} /> : null}
      <ThemedText type="defaultSemiBold" style={[styles.text as TextStyle, { color: palette.textColor }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: Brand.dark,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 0,
    boxShadow: '0px 6px 16px rgba(15, 23, 42, 0.05)',
  },
  pressed: {
    transform: [{ translateY: 1 }, { scale: 0.985 }],
  },
  text: {
    fontSize: 13.5,
    lineHeight: 18,
  },
});
