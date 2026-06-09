import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Brand } from 'constants/theme';
import { ThemedText } from 'components/themed-text';

type Props = {
  label: string;
  active?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  activeTone?: string;
  activeSurface?: string;
};

export function TazeChip({
  label,
  active = false,
  onPress,
  onLongPress,
  accessibilityHint,
  style,
  activeTone,
  activeSurface,
}: Props) {
  const accentTone = activeTone ?? Brand.accent;
  const accentSurface = activeSurface ?? '#eff6ff';
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.base,
        active ? [styles.active, { borderColor: accentTone, backgroundColor: accentSurface }] : null,
        pressed ? styles.pressed : null,
        style,
      ]}>
      <ThemedText
        type="defaultSemiBold"
        style={active ? [styles.textActive, { color: accentTone }] : styles.text}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.07)',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 13,
    paddingVertical: 9,
    boxShadow: '0px 4px 10px rgba(15, 23, 42, 0.04)',
  },
  active: {
    borderColor: Brand.accent,
    backgroundColor: '#eff6ff',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ translateY: 1 }],
  },
  text: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 16,
  },
  textActive: {
    color: Brand.accent,
    fontSize: 12,
    lineHeight: 16,
  },
});
