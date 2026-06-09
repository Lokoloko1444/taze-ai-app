import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Href, useRouter } from 'expo-router';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { LegalConfig } from 'lib/legal-config';
import { TazeButton } from 'components/taze-button';
import { TazeCard } from 'components/taze-card';
import { TazeHero } from 'components/taze-hero';
import { TazeSectionHeader } from 'components/taze-section-header';
import { ThemedText } from 'components/themed-text';
import { ThemedView } from 'components/themed-view';
import { Brand } from 'constants/theme';

export default function CreativeArtistsScreen() {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <ThemedView style={styles.screen}>
        <TazeHero
          title="Creatieve kunstenaars"
          subtitle="Steun en promotie"
          description="Deze pagina geeft creatieve makers, kunstenaars en conceptdenkers een eigen plek in Taze. Hier koppel je steun, zichtbaarheid en publieke promotie aan elkaar."
          badgeLabel="Focus"
          badgeValue="Creatief"
          badgeText="Zet werk, verhaal en publiek sneller samen."
        />

        <TazeCard variant="accent">
          <TazeSectionHeader title="Wat deze route doet" subtitle="Creatief werk zichtbaar maken" badge="Promotie" badgeTone="success" />
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <MaterialIcons name="palette" size={20} color="#0f766e" />
              <ThemedText type="defaultSemiBold">Makers eerst</ThemedText>
              <ThemedText style={styles.meta}>
                Kunstenaars krijgen een eigen route om werk, updates en ondersteuning sneller zichtbaar te maken.
              </ThemedText>
            </View>
            <View style={styles.infoItem}>
              <MaterialIcons name="campaign" size={20} color="#0f766e" />
              <ThemedText type="defaultSemiBold">Publieke promotie</ThemedText>
              <ThemedText style={styles.meta}>
                Gebruik deze pagina om releases, tentoonstellingen of projecten actief onder de aandacht te brengen.
              </ThemedText>
            </View>
          </View>

          <View style={styles.actions}>
            <TazeButton
              label="Open ondersteuning"
              icon="support-agent"
              onPress={() => router.push(LegalConfig.supportRoute as Href)}
              variant="primary"
              style={styles.primaryBtn}
            />
            <TazeButton
              label="Open updates"
              icon="campaign"
              onPress={() => router.push('/updates' as Href)}
              variant="secondary"
              style={styles.secondaryBtn}
            />
          </View>
        </TazeCard>

        <TazeCard>
          <TazeSectionHeader title="Acties" subtitle="Werk, zichtbaarheid en publiek" badge="Route" />
          <View style={styles.steps}>
            <View style={styles.step}>
              <ThemedText type="defaultSemiBold">1. Plaats het werk centraal</ThemedText>
              <ThemedText style={styles.meta}>
                Zet de maker, het project en het verhaal bovenaan zodat de route meteen herkenbaar is.
              </ThemedText>
            </View>
            <View style={styles.step}>
              <ThemedText type="defaultSemiBold">2. Push de zichtbaarheid</ThemedText>
              <ThemedText style={styles.meta}>
                Koppel updates, nieuwsbrief en support aan dezelfde creatieve lijn.
              </ThemedText>
            </View>
            <View style={styles.step}>
              <ThemedText type="defaultSemiBold">3. Houd het praktisch</ThemedText>
              <ThemedText style={styles.meta}>
                Kunst blijft hier niet los hangen, maar krijgt een directe route naar publiek en opvolging.
              </ThemedText>
            </View>
          </View>

          <View style={styles.actions}>
            <TazeButton
              label="Open contact"
              icon="mail"
              onPress={() => router.push(LegalConfig.contactRoute as Href)}
              variant="ghost"
              style={styles.secondaryBtn}
            />
            <TazeButton
              label="Bekijk ondersteuning"
              icon="open-in-new"
              onPress={() => Linking.openURL(LegalConfig.supportUrl).catch(() => {})}
              variant="ghost"
              style={styles.secondaryBtn}
            />
          </View>
        </TazeCard>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 28,
    backgroundColor: Brand.canvas,
    alignItems: 'center',
  },
  screen: {
    width: '100%',
    maxWidth: 1080,
    gap: 18,
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  infoItem: {
    flex: 1,
    minWidth: 220,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(204,251,241,0.72)',
    backgroundColor: 'rgba(240,253,250,0.92)',
    padding: 14,
    gap: 6,
  },
  meta: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 17,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  primaryBtn: {
    flex: 1,
    minWidth: 220,
  },
  secondaryBtn: {
    flex: 1,
    minWidth: 180,
  },
  steps: {
    gap: 12,
    marginTop: 14,
  },
  step: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 14,
    gap: 4,
  },
});
