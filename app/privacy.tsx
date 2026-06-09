import { Href, useRouter } from 'expo-router';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { TazeButton } from 'components/taze-button';
import { TazeCard } from 'components/taze-card';
import { TazeHero } from 'components/taze-hero';
import { TazeSectionHeader } from 'components/taze-section-header';
import { ThemedText } from 'components/themed-text';
import { ThemedView } from 'components/themed-view';
import { Brand } from 'constants/theme';
import { LegalConfig } from 'lib/legal-config';

const privacyTopics = ['Account', 'Camera', 'Data', 'Support'] as const;

const privacySections = [
  {
    title: 'Wat we verwerken',
    body:
      'Taze verwerkt alleen gegevens die nodig zijn voor accountbeheer, login, camera- en barcodeflows, voorraadopslag, facturatie, support en interne audit. Dat kan productdata, locatie, tijdstempels, rolinformatie en bedrijfscontacten omvatten.',
  },
  {
    title: 'Waarom we dit doen',
    body:
      'We gebruiken deze gegevens om producten te herkennen, voorraad live bij te werken, meldingen te maken bij lage voorraad of korte houdbaarheid, betalingen af te handelen en RIA een juiste volgende stap te laten voorstellen.',
  },
  {
    title: 'Bewaren en beveiligen',
    body:
      'Data blijft alleen bewaard zolang dat nodig is voor de dienst, rapportage of wettelijke verplichtingen. Toegang is bedoeld voor bevoegde gebruikers per rol. Camera en scans worden niet gebruikt om mensen permanent te volgen.',
  },
  {
    title: 'Jouw rechten',
    body:
      'Je kan een overzicht, correctie, export of verwijdering van relevante gegevens vragen via support of contact. Voor privacyvragen, verwerkersafspraken of verwijderverzoeken gebruik je de publieke support- en contactroute.',
  },
] as const;

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <ThemedView style={styles.screen}>
        <TazeHero
          title="Privacy"
          subtitle="Taze legal"
          description="Publieke privacytekst voor account, camera, scans, support, data en metrics."
          badgeLabel="Publieke URL"
          badgeValue="taze.to/privacy"
          badgeText="Gebruik deze route ook voor publicatie, store en compliance."
        />

        <TazeCard>
          <TazeSectionHeader title="Kern" badge="Privacy" />
          <View style={styles.topicRow}>
            {privacyTopics.map((topic) => (
              <View key={topic} style={styles.topicPill}>
                <ThemedText type="defaultSemiBold" style={styles.topicText}>
                  {topic}
                </ThemedText>
              </View>
            ))}
          </View>
        </TazeCard>

        {privacySections.map((section) => (
          <TazeCard key={section.title} variant="muted">
            <TazeSectionHeader title={section.title} badge="AVG" badgeTone="info" />
            <ThemedText style={styles.sectionBody}>{section.body}</ThemedText>
          </TazeCard>
        ))}

        <TazeCard>
          <TazeSectionHeader title="Voorwaarden in het kort" badge="Mens beslist" badgeTone="warning" />
          <View style={styles.ruleList}>
            <ThemedText style={styles.ruleText}>AI adviseert, maar de bevoegde gebruiker beslist altijd over de actie.</ThemedText>
            <ThemedText style={styles.ruleText}>Bedrijfsdata blijft gekoppeld aan de eigen organisatie en rolrechten.</ThemedText>
            <ThemedText style={styles.ruleText}>Support en contact blijven publiek bereikbaar voor vragen, correcties en verwijderverzoeken.</ThemedText>
          </View>
        </TazeCard>

        <TazeCard variant="muted">
          <TazeSectionHeader title="Acties" badge="Acties" badgeTone="info" />
          <View style={styles.actions}>
            <TazeButton label="Support" icon="support-agent" onPress={() => router.push(LegalConfig.supportRoute as Href)} variant="primary" />
            <TazeButton label="Contact" icon="mail" onPress={() => router.push(LegalConfig.contactRoute as Href)} variant="secondary" />
            <TazeButton label="Voorwaarden" icon="description" onPress={() => router.push(LegalConfig.termsRoute as Href)} variant="ghost" />
            <TazeButton
              label="Policy"
              icon="open-in-new"
              onPress={() => Linking.openURL(LegalConfig.privacyPolicyUrl).catch(() => {})}
              variant="ghost"
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
  topicRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  topicPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topicText: {
    color: Brand.ink,
    fontSize: 13,
  },
  sectionBody: {
    marginTop: 12,
    color: Brand.inkMuted,
    lineHeight: 21,
  },
  ruleList: {
    marginTop: 12,
    gap: 10,
  },
  ruleText: {
    color: Brand.inkMuted,
    lineHeight: 21,
  },
  actions: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
