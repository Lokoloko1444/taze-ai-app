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

const termsSections = [
  {
    title: 'Wat Taze is',
    body:
      'Taze is een B2B-platform voor scan, transport, facturatie, data, metrics, rollen, bewijs en rapportage. De publieke homepage legt uit wat het platform doet en welke routes publiek beschikbaar zijn.',
  },
  {
    title: 'Hoe de app werkt',
    body:
      'Werkvloer, chauffeur, manager, facturatie en beheer zien alleen de stappen die bij hun rol passen. De app blijft overzichtelijk: eerst zien, dan bevestigen, dan pas veranderen.',
  },
  {
    title: 'AI / RIA',
    body:
      'AI ondersteunt binnen bevoegdheid. De mens bevestigt. Rollen en rechten bepalen wat automatisch mag gebeuren. AI beslist niets, start niets en wijzigt niets zonder menselijke goedkeuring.',
  },
  {
    title: 'Bedrijfsdata',
    body:
      'Bedrijfsdata blijft gekoppeld aan de eigen organisatie. Toegang, audit en bewijs volgen de ingestelde rolrechten en de gekozen bedrijfscontext.',
  },
  {
    title: 'Publieke routes',
    body:
      'De publieke homepage, privacyroute en voorwaardenroute zijn openbaar zodat Google, gebruikers en teams kunnen zien wat Taze doet en hoe contact, support en legal werken.',
  },
  {
    title: 'Gebruiks- en distributievoorwaarden',
    body:
      'AI TAZE (hierna: "de Software") is eigendom van LGo Studio Azzy en wordt beschermd door auteursrecht en andere intellectuele eigendomswetten. De Software mag uitsluitend worden gebruikt, gedistribueerd, gepromoot, gekopieerd, gewijzigd, doorverkocht of anderszins benut door partijen die een voorafgaande schriftelijke overeenkomst hebben gesloten met LGo Studio Azzy. Zonder een dergelijke schriftelijke overeenkomst is elk gebruik, elke distributie, promotie, kopie, wijziging, doorverkoop of gebruik van de merknaam "AI TAZE" strikt verboden. Voor het verkrijgen van een schriftelijke overeenkomst dient u contact op te nemen met LGo Studio Azzy via de contactpagina. Overtreding van deze voorwaarden kan leiden tot juridische stappen, waaronder maar niet beperkt tot het vorderen van schadevergoeding en het verkrijgen van een gerechtelijk bevel.',
  },
] as const;

export default function TermsScreen() {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <ThemedView style={styles.screen}>
        <TazeHero
          title="Algemene voorwaarden"
          subtitle="Taze legal"
          description="Publieke voorwaarden voor scan, transport, facturatie, data, metrics, rollen, bewijs, rapportage en AI/RIA."
          badgeLabel="Publieke URL"
          badgeValue="taze.to/terms"
          badgeText="Gebruik deze route voor branding, verification en publieke legal checks."
        />

        <TazeCard>
          <TazeSectionHeader title="Kern" badge="Taze" />
          <View style={styles.topicRow}>
            {['Scan', 'Transport', 'Facturatie', 'Data', 'Metrics', 'AI/RIA'].map((topic) => (
              <View key={topic} style={styles.topicPill}>
                <ThemedText type="defaultSemiBold" style={styles.topicText}>
                  {topic}
                </ThemedText>
              </View>
            ))}
          </View>
        </TazeCard>

        {termsSections.map((section) => (
          <TazeCard key={section.title} variant="muted">
            <TazeSectionHeader title={section.title} badge="Voorwaarden" badgeTone="info" />
            <ThemedText style={styles.sectionBody}>{section.body}</ThemedText>
          </TazeCard>
        ))}

        <TazeCard variant="muted">
          <TazeSectionHeader title="Acties" badge="Publiek" badgeTone="info" />
          <View style={styles.actions}>
            <TazeButton label="Privacy" icon="shield" onPress={() => router.push(LegalConfig.privacyRoute as Href)} variant="secondary" />
            <TazeButton label="Support" icon="support-agent" onPress={() => router.push(LegalConfig.supportRoute as Href)} variant="primary" />
            <TazeButton label="Contact" icon="mail" onPress={() => router.push(LegalConfig.contactRoute as Href)} variant="ghost" />
            <TazeButton
              label="Policy"
              icon="open-in-new"
              onPress={() => Linking.openURL(LegalConfig.termsUrl).catch(() => {})}
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
  actions: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
