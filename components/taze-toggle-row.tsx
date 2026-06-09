import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Brand } from 'constants/theme';
import { ThemedText } from 'components/themed-text';

type Props = {
  title: string;
  description: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
  activeLabel?: string;
  inactiveLabel?: string;
  activeIcon?: keyof typeof MaterialIcons.glyphMap;
  inactiveIcon?: keyof typeof MaterialIcons.glyphMap;
};

export function TazeToggleRow({
  title,
  description,
  active,
  disabled = false,
  onPress,
  activeLabel = 'Aan',
  inactiveLabel = 'Uit',
  activeIcon = 'toggle-on',
  inactiveIcon = 'toggle-off',
}: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <ThemedText type="defaultSemiBold">{title}</ThemedText>
        <ThemedText style={styles.meta}>{description}</ThemedText>
      </View>
      <Pressable
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.toggle,
          active ? styles.toggleActive : null,
          disabled ? styles.toggleDisabled : null,
          pressed ? styles.togglePressed : null,
        ]}>
        <MaterialIcons
          name={active ? activeIcon : inactiveIcon}
          size={18}
          color={active ? Brand.primary : Brand.inkMuted}
        />
        <ThemedText type="defaultSemiBold" style={active ? styles.textActive : styles.text}>
          {active ? activeLabel : inactiveLabel}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  copy: {
    flex: 1,
    minWidth: 200,
    gap: 2,
  },
  meta: {
    color: Brand.inkMuted,
    fontSize: 12,
  },
  toggle: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: 8,
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 14,
    paddingVertical: 11,
    boxShadow: '0px 8px 18px rgba(15, 23, 42, 0.06)',
  },
  toggleActive: {
    borderColor: Brand.primary,
    backgroundColor: '#ecfeff',
  },
  toggleDisabled: {
    opacity: 0.55,
  },
  togglePressed: {
    opacity: 0.9,
  },
  text: {
    color: Brand.ink,
    fontSize: 13,
  },
  textActive: {
    color: Brand.primary,
    fontSize: 13,
  },
});
