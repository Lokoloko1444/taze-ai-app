import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { Brand } from 'constants/theme';
import { ThemedText } from 'components/themed-text';

type Props = TextInputProps & {
  icon?: keyof typeof MaterialIcons.glyphMap;
  containerStyle?: StyleProp<ViewStyle>;
  fieldStyle?: StyleProp<ViewStyle>;
  label?: string;
};

export const TazeInput = forwardRef<TextInput, Props>(function TazeInput(
  { icon, containerStyle, fieldStyle, label, style, multiline, ...props },
  ref
) {
  const inputControl = (
    <View style={[styles.container, multiline ? styles.containerMultiline : null, containerStyle]}>
      {icon ? <MaterialIcons name={icon} size={18} color="#64748b" /> : null}
      <TextInput
        ref={ref}
        multiline={multiline}
        placeholderTextColor="#94a3b8"
        style={[styles.input, multiline ? styles.inputMultiline : null, style]}
        {...props}
      />
    </View>
  );

  if (!label) {
    return inputControl;
  }

  return (
    <View style={[styles.field, fieldStyle]}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      {inputControl}
    </View>
  );
});

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  label: {
    color: Brand.inkMuted,
    fontSize: 11.5,
    letterSpacing: 0.2,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    boxShadow: '0px 10px 22px rgba(15, 23, 42, 0.05)',
  },
  containerMultiline: {
    alignItems: 'flex-start',
  },
  input: {
    flex: 1,
    minWidth: 160,
    color: Brand.ink,
    paddingVertical: 0,
  },
  inputMultiline: {
    minHeight: 96,
    paddingTop: 2,
    textAlignVertical: 'top',
  },
});
