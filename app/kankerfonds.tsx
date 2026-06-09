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

export default function KankerfondsScreen() {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <ThemedView style={styles.screen}>
        <TazeHero
          title="Kankerfonds UZ Gent"
          subtitle="Steunroute"
          description="Deze pagina verwijst naar de officiële UZ Gent-pagina voor het Kankercentrum. Gebruik ze als transparante steunroute voor zorg, ondersteuning en onderzoek."
          badgeLabel="Steunadvies"
          badgeValue="Vanaf €1"
          badgeText="Open de officiële pagina en kies daar je bijdrage."
        />

        <TazeCard variant="accent">
          <TazeSectionHeader title="Officiële steun" subtitle="UZ Gent Kankercentrum" badge="Kankerfonds" badgeTone="warning" />
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <MaterialIcons name="volunteer-activism" size={20} color="#b91c1c" />
              <ThemedText type="defaultSemiBold">Transparant</ThemedText>
              <ThemedText style={styles.meta}>We sturen je alleen door naar de officiële UZ Gent-pagina.</ThemedText>
            </View>
            <View style={styles.infoItem}>
              <MaterialIcons name="verified-user" size={20} color="#b91c1c" />
              <ThemedText type="defaultSemiBold">Zorggericht</ThemedText>
              <ThemedText style={styles.meta}>Het Kankercentrum ondersteunt onder meer hemato-oncologie en aanverwante zorg.</ThemedText>
            </View>
          </View>

          <View style={styles.actions}>
            <TazeButton
              label="Open officiële UZ Gent-pagina"
              icon="open-in-new"
              onPress={() => Linking.openURL(LegalConfig.cancerFundUrl).catch(() => {})}
              variant="danger"
              style={styles.primaryBtn}
            />
            <TazeButton
              label="Terug naar regie"
              icon="arrow-back"
              onPress={() => router.push('/account' as Href)}
              variant="ghost"
              style={styles.secondaryBtn}
            />
          </View>
        </TazeCard>

        <TazeCard>
          <TazeSectionHeader title="Wat je hier doet" subtitle="Kleine stap, direct zichtbaar" badge="1 euro" badgeTone="success" />
          <View style={styles.steps}>
            <View style={styles.step}>
              <ThemedText type="defaultSemiBold">1. Open de officiële pagina</ThemedText>
              <ThemedText style={styles.meta}>De knop opent de UZ Gent-pagina waar de steun aan het Kankercentrum start.</ThemedText>
            </View>
            <View style={styles.step}>
              <ThemedText type="defaultSemiBold">2. Kies je bijdrage</ThemedText>
              <ThemedText style={styles.meta}>Je kunt daar zelf je steunbedrag instellen. Als vaste start kun je 1 euro gebruiken.</ThemedText>
            </View>
            <View style={styles.step}>
              <ThemedText type="defaultSemiBold">3. Houd het transparant</ThemedText>
              <ThemedText style={styles.meta}>Zo blijft de app intern duidelijk en loopt de steunroute via de officiële bron.</ThemedText>
            </View>
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
    borderColor: 'rgba(254,205,211,0.72)',
    backgroundColor: 'rgba(255,241,242,0.92)',
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
