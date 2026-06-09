import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from 'components/themed-text';
import { ThemedView } from 'components/themed-view';
import { Brand } from 'constants/theme';

export default function ModalScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.sheet}>
        <ThemedText type="title" style={styles.title}>This is a modal</ThemedText>
        <ThemedText style={styles.body}>
          Deze overlay gebruikt nu dezelfde rustige shell als de rest van de app.
        </ThemedText>
        <Link href="/" dismissTo style={styles.link}>
          <ThemedText type="link">Go to home screen</ThemedText>
        </Link>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: Brand.canvas,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    backgroundColor: 'rgba(255,255,255,0.82)',
    padding: 24,
    gap: 10,
    alignItems: 'center',
    boxShadow: '0px 18px 40px rgba(15, 23, 42, 0.12)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
  },
  title: {
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
    color: '#475569',
    lineHeight: 22,
  },
  link: {
    marginTop: 15,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(239,246,255,0.92)',
  },
});
