import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Brand } from 'constants/theme';
import { ThemedText } from 'components/themed-text';
import { ThemedView } from 'components/themed-view';
import { useResponsiveLayout } from 'hooks/use-responsive-layout';

export function SecurityLockScreen(props: { busy: boolean; error: string | null; onUnlock: () => void }) {
  const { isCompact } = useResponsiveLayout();

  return (
    <ThemedView style={styles.screen}>
      <View style={[styles.card, isCompact && styles.cardCompact]}>
        <View style={[styles.iconWrap, isCompact && styles.iconWrapCompact]}>
          <MaterialIcons name="lock" size={isCompact ? 24 : 28} color="#0f766e" />
        </View>
        <ThemedText type="title" style={styles.title}>
          App vergrendeld
        </ThemedText>
        <ThemedText style={styles.body}>
          Ontgrendel met biometrie of toestelcode om je data te beschermen.
        </ThemedText>
        {props.error ? <ThemedText style={styles.error}>{props.error}</ThemedText> : null}
        <Pressable
          style={[styles.button, isCompact && styles.buttonCompact, props.busy ? styles.buttonDisabled : null]}
          disabled={props.busy}
          accessibilityRole="button"
          accessibilityLabel="Ontgrendel"
          onPress={props.onUnlock}>
          <ThemedText type="defaultSemiBold" style={styles.buttonText}>
            {props.busy ? 'Bezig...' : 'Ontgrendel'}
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: Brand.canvas,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    borderRadius: 32,
    padding: 24,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    gap: 12,
    alignItems: 'center',
    shadowColor: Brand.dark,
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 2,
    boxShadow: '0px 18px 40px rgba(15, 23, 42, 0.08)',
  },
  cardCompact: {
    padding: 18,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: '#ecfeff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapCompact: {
    width: 60,
    height: 60,
  },
  title: {
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
    color: Brand.inkMuted,
  },
  error: {
    textAlign: 'center',
    color: '#dc2626',
  },
  button: {
    marginTop: 6,
    borderRadius: 16,
    backgroundColor: Brand.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: 180,
    alignItems: 'center',
    shadowColor: Brand.dark,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  buttonCompact: {
    width: '100%',
    minWidth: 0,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
  },
});
