import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ScreenAiPanel } from 'components/screen-ai-panel';
import { TazeBadge } from 'components/taze-badge';
import { TazeCard } from 'components/taze-card';
import { TazeLogo } from 'components/taze-logo';
import { ThemedText } from 'components/themed-text';
import { ThemedView } from 'components/themed-view';
import { Brand } from 'constants/theme';
import { t, type AppLanguage, type TranslationKey, resolveAppLanguage } from 'lib/i18n';
import { getInventoryMetrics, useInventory } from 'hooks/use-inventory';
import { getTransportRecommendation, transportApps } from 'lib/transport-hub';
import {
  getCachedTransportPreferences,
  getDefaultTransportAppId,
  loadTransportPreferences,
  subscribeTransportPreferences,
} from 'lib/transport-favorites';
import { buildTransportHubPath } from 'lib/transport-ai';

type ServiceCardDefinition = {
  id: string;
  name?: string;
  nameKey?: TranslationKey;
  role?: string;
  roleKey?: TranslationKey;
  detail?: string;
  detailKey?: TranslationKey;
  url?: string;
  tone: string;
  surface: string;
};

function resolveServiceText(service: ServiceCardDefinition, language: AppLanguage) {
  return {
    name: service.nameKey ? t(service.nameKey, language) : service.name ?? '',
    role: service.roleKey ? t(service.roleKey, language) : service.role ?? '',
    detail: service.detailKey ? t(service.detailKey, language) : service.detail ?? '',
  };
}

function formatServiceTranslation(template: string, replacements: Record<string, string | number> = {}) {
  return Object.entries(replacements).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template
  );
}

const serviceCatalog: ServiceCardDefinition[] = [
  {
    id: 'pickup',
    nameKey: 'services.card.pickup.name',
    roleKey: 'services.card.pickup.role',
    detailKey: 'services.card.pickup.detail',
    tone: '#0f766e',
    surface: '#ecfeff',
  },
  {
    id: 'uber-eats',
    nameKey: 'services.card.uberEats.name',
    roleKey: 'services.card.uberEats.role',
    detailKey: 'services.card.uberEats.detail',
    url: 'https://www.ubereats.com',
    tone: '#111827',
    surface: '#f3f4f6',
  },
  {
    id: 'deliveroo',
    nameKey: 'services.card.deliveroo.name',
    roleKey: 'services.card.deliveroo.role',
    detailKey: 'services.card.deliveroo.detail',
    url: 'https://deliveroo.be',
    tone: '#0ea5e9',
    surface: '#f0f9ff',
  },
  {
    id: 'takeaway',
    nameKey: 'services.card.takeaway.name',
    roleKey: 'services.card.takeaway.role',
    detailKey: 'services.card.takeaway.detail',
    url: 'https://www.takeaway.com',
    tone: '#ea580c',
    surface: '#fff7ed',
  },
  {
    id: 'courier',
    nameKey: 'services.card.courier.name',
    roleKey: 'services.card.courier.role',
    detailKey: 'services.card.courier.detail',
    tone: '#7c3aed',
    surface: '#f5f3ff',
  },
];

export default function ServicesScreen() {
  const router = useRouter();
  const { items, locations } = useInventory();
  const [transportPreferences, setTransportPreferences] = useState(() => getCachedTransportPreferences());
  const metrics = getInventoryMetrics(items);
  const expiringItems = items.filter((item) => item.expiryDays !== null && item.expiryDays <= 2);

  const readiness = useMemo(() => {
    const base = 42 + Math.min(24, locations.length * 4) + (metrics.totalProducts > 0 ? 18 : 6);
    const urgency = expiringItems.length > 0 ? Math.min(16, expiringItems.length * 4) : 0;
    return Math.max(40, Math.min(98, Math.round(base + urgency)));
  }, [expiringItems.length, locations.length, metrics.totalProducts]);
  useEffect(() => {
    let cancelled = false;
    loadTransportPreferences()
      .then((entries) => {
        if (!cancelled) {
          setTransportPreferences(entries);
        }
      })
      .catch(() => {});

    const unsubscribe = subscribeTransportPreferences((entries) => {
      if (!cancelled) {
        setTransportPreferences(entries);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);
  const recommendedTransport = useMemo(
    () => {
      const preferredAppId =
        getDefaultTransportAppId(transportPreferences, { scopeType: 'useCase', scopeValue: 'Last-mile' }) ??
        getDefaultTransportAppId(transportPreferences, { scopeType: 'region', scopeValue: 'Europa' });

      if (preferredAppId) {
        const preferredApp = transportApps.find((app) => app.id === preferredAppId);
        if (preferredApp) {
          return {
            ...preferredApp,
            reason: `${preferredApp.label} wordt nu als standaard gebruikt voor services (${preferredApp.useCases.includes('Last-mile') ? 'Last-mile' : 'Europa'}).`,
          };
        }
      }

      return getTransportRecommendation('Europa', 'Last-mile');
    },
    [transportPreferences]
  );

  const uiLanguage = useMemo(() => resolveAppLanguage(), []);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <ThemedView style={styles.screen}>
        <View style={styles.hero}>
          <View style={styles.heroBrandRow}>
            <View style={styles.heroLogoFrame}>
              <TazeLogo size={96} framed={false} />
            </View>
            <View style={styles.heroCopy}>
              <ThemedText type="title">{t('services.hero.title', uiLanguage)}</ThemedText>
              <ThemedText>
                {t('services.hero.description', uiLanguage)}
              </ThemedText>
            </View>
          </View>
          <View style={styles.heroBadge}>
            <ThemedText style={styles.heroBadgeLabel}>{t('services.hero.badgeLabel', uiLanguage)}</ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.heroBadgeValue}>
              {readiness}%
            </ThemedText>
            <ThemedText style={styles.heroBadgeText}>
              {expiringItems.length > 0
                ? formatServiceTranslation(t('services.hero.expiringItems', uiLanguage), { count: expiringItems.length })
                : formatServiceTranslation(t('services.hero.activeProducts', uiLanguage), { count: metrics.totalProducts })}
            </ThemedText>
            <Pressable
              style={styles.transportHubButton}
              onPress={() =>
                router.push(
                  buildTransportHubPath({
                    region: 'Europa',
                    useCase: 'Last-mile',
                    partnerId: recommendedTransport?.id ?? null,
                    source: 'services',
                  }) as never
                )
              }>
              <ThemedText type="defaultSemiBold" style={styles.transportHubButtonText}>
                {t('services.hero.openTransportHub', uiLanguage)}
              </ThemedText>
            </Pressable>
          </View>
        </View>

        <ScreenAiPanel
          screen="services"
          status={{
            readiness,
          }}
        />

        {recommendedTransport ? (
          <TazeCard style={[styles.recommendationCard, { borderColor: recommendedTransport.tone, backgroundColor: recommendedTransport.surface }]}>
            <View style={styles.recommendationHeader}>
              <View style={styles.recommendationCopy}>
                <ThemedText type="defaultSemiBold">{t('services.recommendation.title', uiLanguage)}</ThemedText>
                <ThemedText style={styles.recommendationMeta}>{t('services.recommendation.meta', uiLanguage)}</ThemedText>
              </View>
              <TazeBadge label={recommendedTransport.label} tone="success" />
            </View>
            <ThemedText>{recommendedTransport.reason}</ThemedText>
          </TazeCard>
        ) : null}

        <View style={styles.grid}>
          {serviceCatalog.map((service) => {
            const serviceText = resolveServiceText(service, uiLanguage);
            return (
              <TazeCard
                key={service.id}
                style={[styles.card, { borderColor: service.tone, backgroundColor: service.surface }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderText}>
                  <ThemedText type="defaultSemiBold">{serviceText.name}</ThemedText>
                  <TazeBadge label={serviceText.role} tone="neutral" />
                </View>
                <View style={[styles.iconBadge, { backgroundColor: service.tone }]}>
                  <MaterialIcons name="local-shipping" size={18} color="#fff" />
                </View>
              </View>

              <ThemedText>{serviceText.detail}</ThemedText>

              {service.url ? (
                <Pressable
                  style={[styles.linkButton, { backgroundColor: service.tone }]}
                  accessibilityRole="button"
                  accessibilityLabel={formatServiceTranslation(
                    t('services.card.openAccessibility', uiLanguage),
                    { serviceName: serviceText.name }
                  )}
                  onPress={() => Linking.openURL(service.url!).catch(() => {})}>
                  <ThemedText type="defaultSemiBold" style={styles.linkButtonText}>
                    {t('services.card.openIntegration', uiLanguage)}
                  </ThemedText>
                </Pressable>
              ) : null}
            </TazeCard>
            );
          })}
        </View>
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
  hero: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    boxShadow: '0px 18px 40px rgba(15, 23, 42, 0.08)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  heroCopy: {
    flex: 1,
    minWidth: 220,
    gap: 6,
  },
  heroBrandRow: {
    flex: 1,
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroLogoFrame: {
    width: 72,
    height: 72,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(153,246,228,0.32)',
    backgroundColor: Brand.dark,
  },
  heroLogo: {
    width: '100%',
    height: '100%',
  },
  heroBadge: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 180,
    borderRadius: 20,
    padding: 16,
    backgroundColor: Brand.accent,
    gap: 4,
  },
  heroBadgeLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
  },
  heroBadgeValue: {
    color: '#ffffff',
    fontSize: 28,
  },
  heroBadgeText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
  },
  transportHubButton: {
    alignSelf: 'flex-start',
    marginTop: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  transportHubButtonText: {
    color: '#ffffff',
    fontSize: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  recommendationCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    gap: 8,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  recommendationHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  recommendationCopy: {
    flex: 1,
    minWidth: 180,
    gap: 2,
  },
  recommendationMeta: {
    color: '#64748b',
    fontSize: 12,
  },
  card: {
    flexGrow: 1,
    flexBasis: 280,
    minWidth: 220,
    borderRadius: 20,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  cardHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardHeaderText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  role: {
    fontSize: 14,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkButton: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  linkButtonText: {
    color: '#ffffff',
  },
});
