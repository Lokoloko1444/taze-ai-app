import * as ExpoLinking from 'expo-linking';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { StripeCheckoutCard } from 'components/stripe-checkout-card';
import { TazeCard } from 'components/taze-card';
import { TazeHero } from 'components/taze-hero';
import { TazeSectionHeader } from 'components/taze-section-header';
import { ThemedText } from 'components/themed-text';
import { ThemedView } from 'components/themed-view';
import { Brand } from 'constants/theme';
import { useResponsiveLayout } from 'hooks/use-responsive-layout';

const currentWebOrigin = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : null;

function getSuccessUrl() {
  if (currentWebOrigin) {
    return `${currentWebOrigin}/payments?checkout=success`;
  }
  return ExpoLinking.createURL('payments', { queryParams: { checkout: 'success' } });
}

function getCancelUrl() {
  if (currentWebOrigin) {
    return `${currentWebOrigin}/payments?checkout=cancel`;
  }
  return ExpoLinking.createURL('payments', { queryParams: { checkout: 'cancel' } });
}

export default function StripeCheckoutScreen() {
  const { pageMaxWidth, pagePadding } = useResponsiveLayout();

  return (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingHorizontal: pagePadding }]}>
      <ThemedView style={[styles.screen, { maxWidth: pageMaxWidth }]}>
        <TazeHero
          title="Live betaling"
          subtitle="Taze betaalroute"
          description="Deze pagina gebruikt dezelfde betaal-API als de live betaalpagina. Gebruik dit scherm om de echte betaalroute te controleren."
          badgeLabel="Betaling"
          badgeValue="Live route"
          badgeText="Van app naar live betaling via de serverroute."
        />

        <TazeCard style={styles.card}>
          <TazeSectionHeader
            title="Hoe het werkt"
            subtitle="Pakket-ID en interval gaan naar de server. De server kiest de juiste prijs-ID en geeft Stripe terug."
          />
          <View style={styles.steps}>
            <View style={styles.stepRow}>
              <View style={styles.stepIcon}>
                <MaterialIcons name="assignment" size={16} color="#0f766e" />
              </View>
              <ThemedText style={styles.stepText}>Plan-ID bepaalt welk pakket je start.</ThemedText>
            </View>
            <View style={styles.stepRow}>
              <View style={styles.stepIcon}>
                <MaterialIcons name="schedule" size={16} color="#0f766e" />
              </View>
              <ThemedText style={styles.stepText}>Interval bepaalt maand, kwartaal of jaar.</ThemedText>
            </View>
            <View style={styles.stepRow}>
              <View style={styles.stepIcon}>
                <MaterialIcons name="open-in-new" size={16} color="#0f766e" />
              </View>
              <ThemedText style={styles.stepText}>De server stuurt je daarna door naar de betaal-URL.</ThemedText>
            </View>
          </View>
        </TazeCard>

        <StripeCheckoutCard
          title="Taze Werkvloer"
          description="Voor teams die scan, foto-bewijs, acties, manageroverzicht en rapport per locatie operationeel willen testen."
          planId="werkvloer"
          interval="month"
          successUrl={getSuccessUrl()}
          cancelUrl={getCancelUrl()}
          buttonLabel="Activeer pakket"
          note="Als je price IDs nog niet gevuld zijn, toont Stripe hier een nette foutmelding."
        />
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 32,
    backgroundColor: Brand.canvas,
    alignItems: 'center',
  },
  screen: {
    width: '100%',
    gap: 18,
  },
  card: {
    gap: 12,
  },
  steps: {
    gap: 10,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepIcon: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(236,254,245,0.92)',
  },
  stepText: {
    flex: 1,
    color: '#0f172a',
  },
});


