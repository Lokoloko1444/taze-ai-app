import { useCallback, useMemo, useState } from 'react';
import { Href, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { RealAiCopilotPanel } from 'components/real-ai-copilot-panel';
import { TazeBadge } from 'components/taze-badge';
import { TazeCard } from 'components/taze-card';
import { TazeLogo } from 'components/taze-logo';
import { getInventoryMetrics, useInventory } from 'hooks/use-inventory';
import { ThemedText } from 'components/themed-text';
import { ThemedView } from 'components/themed-view';
import { Brand } from 'constants/theme';
import { markAiAuditInteraction, markAiAuditOutcome } from 'lib/ai-audit';
import { requestRealAi, type RealAiResponse } from 'lib/real-ai';
import { buildTransportAiContext, buildTransportHubPath } from 'lib/transport-ai';

type PartnerCard = {
  id: string;
  name: string;
  role: string;
  note: string;
  focus: string;
  cta: string;
  href: Href;
  tone: string;
  surface: string;
};

const partnerCatalog: PartnerCard[] = [
  {
    id: 'freshflow',
    name: 'FreshFlow Supply',
    role: 'Leverancier verse producten',
    note: 'Koppeling voor automatische levering en voorraadrotatie.',
    focus: 'Aankoop en verse aanvulling',
    cta: 'Open inzichten',
    href: '/explore',
    tone: '#0f766e',
    surface: '#ecfeff',
  },
  {
    id: 'ecowaste',
    name: 'EcoWaste Collect',
    role: 'Waste en retourstroom',
    note: 'Ondersteunt slim ophalen van bijna-vervallen producten.',
    focus: 'Waste-reductie en retourplanning',
    cta: 'Open alerts',
    href: '/alerts',
    tone: '#c2410c',
    surface: '#fff7ed',
  },
  {
    id: 'retailvision',
    name: 'Retail Vision Hub',
    role: 'Analyse en rapportage',
    note: 'Deelt inzichten over doorloopsnelheid en productprestaties.',
    focus: 'Inzichten en rapportage',
    cta: 'Bekijk stockhub',
    href: '/explore',
    tone: '#1d4ed8',
    surface: '#eff6ff',
  },
  {
    id: 'invoicebridge',
    name: 'Invoice Bridge',
    role: 'Facturatie en abonnementsflow',
    note: 'Helpt bedrijven met partnerfacturen, abonnementen en jaarlijkse contracten.',
    focus: 'Financiën en contracten',
    cta: 'Open betalingen',
    href: '/payments',
    tone: '#7c3aed',
    surface: '#f5f3ff',
  },
];

export default function PartnersScreen() {
  const router = useRouter();
  const { items, financeEntries, locations } = useInventory();
  const [realAiState, setRealAiState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [realAiAnswer, setRealAiAnswer] = useState<RealAiResponse | null>(null);
  const [realAiError, setRealAiError] = useState('');
  const metrics = getInventoryMetrics(items);

  const expiringItems = items.filter((item) => item.expiryDays !== null && item.expiryDays <= 2);
  const lowStockItems = items.filter((item) => item.quantity <= 1);
  const currentYear = new Date().getFullYear();
  const currentYearFinanciënEntries = financeEntries.filter((entry) => {
    const recordedAt = new Date(entry.recordedAt);
    return !Number.isNaN(recordedAt.getTime()) && recordedAt.getFullYear() === currentYear;
  });

  const partnerFitScore = Math.max(
    40,
    Math.min(
      97,
      Math.round(
        (metrics.totalProducts > 0 ? 24 : 10) +
          Math.min(20, locations.length * 5) +
          (expiringItems.length > 0 ? 18 : 10) +
          (lowStockItems.length > 0 ? 18 : 10) +
          (currentYearFinanciënEntries.length > 0 ? 17 : 6)
      )
    )
  );

  const primaryPartnerAdvice = useMemo(() => {
    if (expiringItems.length > 0) {
      return {
        title: 'EcoWaste Collect eerst inschakelen',
        detail: `${expiringItems.length} product(en) zitten dicht op verval. Een wastepartner heeft nu de hoogste impact.`,
        cta: 'Open alerts',
        href: '/alerts' as Href,
        tone: '#c2410c',
        surface: '#fff7ed',
      };
    }

    if (lowStockItems.length > 0) {
      return {
        title: 'FreshFlow Supply is logisch',
        detail: `${lowStockItems.length} product(en) staan laag in stock. Slimme aanvulling levert direct winst op.`,
        cta: 'Bekijk inzichten',
        href: '/explore' as Href,
        tone: '#0f766e',
        surface: '#ecfeff',
      };
    }

    if (currentYearFinanciënEntries.length === 0) {
      return {
        title: 'Invoice Bridge toevoegen',
        detail: 'Je voorraad is actief, maar finance is nog niet gekoppeld. Een facturatiepartner maakt de flow completer.',
        cta: 'Open betalingen',
        href: '/payments' as Href,
        tone: '#7c3aed',
        surface: '#f5f3ff',
      };
    }

    return {
      title: 'Retail Vision Hub benutten',
      detail: 'Voorraad en finance draaien al. Nu is rapportage de slimste volgende partnerlaag.',
      cta: 'Open stockhub',
      href: '/explore' as Href,
      tone: '#1d4ed8',
      surface: '#eff6ff',
    };
  }, [currentYearFinanciënEntries.length, expiringItems.length, lowStockItems.length]);

  const smartSignals = useMemo(
    () => [
      {
        label: 'Partnerfit',
        value: `${partnerFitScore}%`,
        detail: 'Hoe sterk je partnerflow nu aansluit',
        href: '/explore' as Href,
      },
      {
        label: 'Vestigingen',
        value: `${locations.length}`,
        detail: 'Locaties die mee in de flow zitten',
        href: '/explore' as Href,
      },
      {
        label: 'Open kansen',
        value: `${expiringItems.length + lowStockItems.length}`,
        detail: 'Waste en lage stock samen',
        href: '/alerts' as Href,
      },
    ],
    [expiringItems.length, locations.length, lowStockItems.length, partnerFitScore]
  );

  const partnerCards = partnerCatalog.map((partner) => {
    const liveSignal =
      partner.id === 'ecowaste'
        ? expiringItems.length > 0
          ? `${expiringItems.length} product(en) dicht op verval`
          : 'Geen directe waste-druk'
        : partner.id === 'freshflow'
          ? lowStockItems.length > 0
            ? `${lowStockItems.length} lage stock-signalen`
            : 'Voorraad is stabiel'
          : partner.id === 'invoicebridge'
            ? currentYearFinanciënEntries.length > 0
              ? `${currentYearFinanciënEntries.length} finance-registraties actief`
              : 'Financiën nog niet gekoppeld'
            : metrics.totalProducts > 0
              ? `${metrics.totalProducts} producten in analyse`
              : 'Nog geen stockdata beschikbaar';

    const actionHint =
      partner.id === 'ecowaste'
        ? expiringItems.length > 0
          ? 'Geschikt om waste-opvolging nu te versnellen.'
          : 'Kan later weer geactiveerd worden zodra vervaldruk stijgt.'
        : partner.id === 'freshflow'
          ? lowStockItems.length > 0
            ? 'Ideaal om bijbestellen te automatiseren.'
            : 'Interessant zodra je bestellijst groeit.'
          : partner.id === 'invoicebridge'
            ? currentYearFinanciënEntries.length > 0
              ? 'Goede match voor contracten en abonnementsflow.'
              : 'Voeg eerst finance-data toe voor een sterkere match.'
            : 'Sterk voor rapportage en partnerinzichten.';

    return {
      ...partner,
      liveSignal,
      actionHint,
    };
  });
  const partnersTransportFocus = useMemo(
    () => buildTransportAiContext({ region: 'Europa', useCase: 'Zakelijk' }).transport,
    []
  );
  const partnersAiContext = useMemo(
    () => ({
      partnerFitScore,
      locations: locations.length,
      totalProducts: metrics.totalProducts,
      expiringItems: expiringItems.length,
      lowStockItems: lowStockItems.length,
      currentYearFinanciënEntries: currentYearFinanciënEntries.length,
      primaryPartnerAdvice,
      smartSignals,
      partnerCards: partnerCards.map((partner) => ({
        name: partner.name,
        role: partner.role,
        focus: partner.focus,
        liveSignal: partner.liveSignal,
      })),
      transportFocus: partnersTransportFocus,
    }),
    [
      currentYearFinanciënEntries.length,
      expiringItems.length,
      locations.length,
      lowStockItems.length,
      metrics.totalProducts,
      partnerCards,
      partnerFitScore,
      partnersTransportFocus,
      primaryPartnerAdvice,
      smartSignals,
    ]
  );
  const askPartnersAi = useCallback(async () => {
    setRealAiState('loading');
    setRealAiAnswer(null);
    setRealAiError('');

    try {
      const answer = await requestRealAi({
        screen: 'partners',
        question: 'Welke partner- of transportactie raad je nu aan voor deze supply-, waste- en financecontext?',
        context: partnersAiContext,
      });
      setRealAiAnswer(answer);
      setRealAiState('done');
    } catch (error) {
      setRealAiState('error');
      setRealAiAnswer(null);
      setRealAiError(error instanceof Error ? error.message : 'De echte AI is nu niet bereikbaar.');
    }
  }, [partnersAiContext]);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <ThemedView style={styles.screen}>
        <View style={styles.hero}>
          <View style={styles.heroText}>
            <View style={styles.heroBrandRow}>
              <View style={styles.heroLogoFrame}>
                <TazeLogo size={72} framed={false} />
              </View>
              <View style={styles.heroBrandCopy}>
                <ThemedText type="title">Partners</ThemedText>
                <ThemedText type="subtitle">Taze partnerhub</ThemedText>
                <ThemedText>
                  Zie welke partners het best passen bij je actuele voorraad, waste, logistiek en finance.
                </ThemedText>
              </View>
            </View>
          </View>
          <View style={styles.heroBadge}>
            <ThemedText type="defaultSemiBold" style={styles.heroBadgeLabel}>
              Partnerfit
            </ThemedText>
            <ThemedText style={styles.heroBadgeValue}>{partnerFitScore}%</ThemedText>
            <ThemedText style={styles.heroBadgeText}>Live op basis van je huidige flow</ThemedText>
          </View>
        </View>

        <View style={styles.signalRow}>
          {smartSignals.map((signal) => (
            <Pressable key={signal.label} style={styles.signalCard} onPress={() => router.push(signal.href)}>
              <ThemedText style={styles.signalLabel}>{signal.label}</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.signalValue}>
                {signal.value}
              </ThemedText>
              <ThemedText style={styles.signalDetail}>{signal.detail}</ThemedText>
            </Pressable>
          ))}
        </View>

        <TazeCard
          style={[
            styles.primaryAdvice,
            {
              borderColor: primaryPartnerAdvice.tone,
              backgroundColor: primaryPartnerAdvice.surface,
            },
          ]}>
          <View style={styles.primaryAdviceCopy}>
            <ThemedText type="defaultSemiBold">{primaryPartnerAdvice.title}</ThemedText>
            <ThemedText>{primaryPartnerAdvice.detail}</ThemedText>
          </View>
          <Pressable
            style={[styles.primaryAdviceButton, { backgroundColor: primaryPartnerAdvice.tone }]}
            onPress={() => router.push(primaryPartnerAdvice.href)}>
            <ThemedText type="defaultSemiBold" style={styles.primaryAdviceButtonText}>
              {primaryPartnerAdvice.cta}
            </ThemedText>
          </Pressable>
        </TazeCard>

        <RealAiCopilotPanel
          title="Echte AI op partners en ecosystem"
          hint="Laat een echt model meekijken naar partnerfit, logistiek en welke operationele koppeling nu het meeste oplevert."
          buttonLabel="Vraag partner-AI"
          loading={realAiState === 'loading'}
          onAsk={() => askPartnersAi().catch(() => {})}
          result={realAiAnswer}
          error={realAiError || null}
          onOpenRoute={(route) => {
            if (realAiAnswer?.auditId) {
              markAiAuditInteraction(realAiAnswer.auditId, {
                kind: 'route_opened',
                label: realAiAnswer.recommendedLabel,
              }).catch(() => {});
            }

            if (route === '/transport') {
              if (realAiAnswer?.auditId) {
                markAiAuditOutcome(realAiAnswer.auditId, {
                  kind: 'success',
                  label: 'Transporthub geopend via partners-AI',
                }).catch(() => {});
              }
              router.push(
                buildTransportHubPath({
                  region: 'Europa',
                  useCase: 'Zakelijk',
                  partnerId: partnersTransportFocus.recommendedPartner?.id ?? null,
                  source: 'partners',
                  auditId: realAiAnswer?.auditId ?? null,
                }) as Href
              );
              return;
            }

            router.push(route as Href);
          }}
        />

        <View style={styles.grid}>
          {partnerCards.map((partner) => (
            <Pressable key={partner.name} onPress={() => router.push(partner.href)}>
              <TazeCard style={[styles.card, { borderColor: partner.tone, backgroundColor: partner.surface }]}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderText}>
                    <ThemedText type="defaultSemiBold">{partner.name}</ThemedText>
                    <ThemedText style={[styles.role, { color: partner.tone }]}>{partner.role}</ThemedText>
                  </View>
                  <TazeBadge label={partner.focus} tone="accent" />
                </View>

                <ThemedText>{partner.note}</ThemedText>

                <View style={styles.partnerMetaBox}>
                  <ThemedText style={styles.partnerMetaLabel}>Live signaal</ThemedText>
                  <ThemedText type="defaultSemiBold" style={[styles.partnerMetaValue, { color: partner.tone }]}>
                    {partner.liveSignal}
                  </ThemedText>
                  <ThemedText style={styles.partnerMetaText}>{partner.actionHint}</ThemedText>
                </View>

                <Pressable
                  style={[styles.partnerButton, { backgroundColor: partner.tone }]}
                  onPress={() => router.push(partner.href)}>
                  <ThemedText type="defaultSemiBold" style={styles.partnerButtonText}>
                    {partner.cta}
                  </ThemedText>
                </Pressable>
              </TazeCard>
            </Pressable>
          ))}
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    alignItems: 'stretch',
    padding: 18,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    boxShadow: '0px 18px 40px rgba(15, 23, 42, 0.08)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  heroText: {
    flex: 1,
    minWidth: 220,
    gap: 6,
  },
  heroBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroBrandCopy: {
    flex: 1,
    minWidth: 220,
    gap: 6,
  },
  heroLogoFrame: {
    width: 76,
    height: 76,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(191,219,254,0.32)',
    backgroundColor: Brand.dark,
  },
  heroLogo: {
    width: '100%',
    height: '100%',
  },
  heroBadge: {
    flexGrow: 1,
    flexBasis: 210,
    minWidth: 180,
    borderRadius: 20,
    padding: 16,
    backgroundColor: Brand.primary,
    gap: 4,
    justifyContent: 'center',
  },
  heroBadgeLabel: {
    color: 'rgba(255,255,255,0.78)',
  },
  heroBadgeValue: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
  },
  heroBadgeText: {
    color: 'rgba(255,255,255,0.78)',
  },
  signalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'stretch',
  },
  signalCard: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 200,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    gap: 4,
  },
  signalLabel: {
    color: '#64748b',
    fontSize: 12,
  },
  signalValue: {
    color: '#0f172a',
    fontSize: 18,
  },
  signalDetail: {
    color: '#475569',
    fontSize: 12,
  },
  primaryAdvice: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 14,
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  primaryAdviceCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  primaryAdviceButton: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: Brand.primary,
  },
  primaryAdviceButtonText: {
    color: '#ffffff',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    flexGrow: 1,
    flexBasis: 300,
    minWidth: 240,
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
  focusBadge: {
    maxWidth: '100%',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  focusBadgeText: {
    color: '#ffffff',
    fontSize: 11,
  },
  partnerMetaBox: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.72)',
    gap: 3,
  },
  partnerMetaLabel: {
    color: '#64748b',
    fontSize: 12,
  },
  partnerMetaValue: {
    fontSize: 16,
  },
  partnerMetaText: {
    color: '#475569',
    fontSize: 12,
  },
  partnerButton: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  partnerButtonText: {
    color: '#ffffff',
  },
});

