import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Href, useRouter } from 'expo-router';

import { markAiAuditInteraction, markAiAuditOutcome } from 'lib/ai-audit';
import { getItem, setItem } from 'lib/app-storage';
import { TazeLogo } from 'components/taze-logo';
import {
  addFinanciënEntry,
  type FinanciënEntry,
  type FinanciënEntryKind,
  type FinanciënEntryPeriod,
  addInventoryLocation,
  getFinanciënOverviewByMonth,
  getCategoryBreakdown,
  getInventoryMetrics,
  getLocationBreakdown,
  removeFinanciënEntry,
  removeInventoryItem,
  removeInventoryLocation,
  renameInventoryLocation,
  updateInventoryLocation,
  updateInventoryQuantity,
  useInventory,
} from 'hooks/use-inventory';
import ParallaxScrollView from 'components/parallax-scroll-view';
import { RealAiCopilotPanel } from 'components/real-ai-copilot-panel';
import { StockhubCamera } from 'components/stockhub-camera';
import { ThemedText } from 'components/themed-text';
import { ThemedView } from 'components/themed-view';
import { requestRealAi, type RealAiAvailableAction, type RealAiResponse } from 'lib/real-ai';
import { buildTransportAiContext, buildTransportHubPath } from 'lib/transport-ai';
import { IconSymbol } from 'components/ui/icon-symbol';

type Audience = 'Restaurant' | 'Bedrijf';
type LocationFilter = 'Alle vestigingen' | string;
type FinanciënFormState = Record<
  FinanciënEntryKind,
  {
    amount: string;
    note: string;
    period: FinanciënEntryPeriod;
  }
>;

const audienceContent: Record<
  Audience,
  {
    title: string;
    body: string;
    primaryAction: string;
    secondaryAction: string;
  }
> = {
  Restaurant: {
    title: 'Restaurant',
    body: 'Houd voorraad, versheid en service in één blik bij.',
    primaryAction: 'Start scan',
    secondaryAction: 'Bekijk wat opraakt',
  },
  Bedrijf: {
    title: 'Bedrijf',
    body: 'Gebruik dezelfde voorraad- en cijferlaag voor teams en logistiek.',
    primaryAction: 'Nieuwe stockscan',
    secondaryAction: 'Open partners',
  },
};

const tazeManifest = {
  eyebrow: 'Taze live platform',
  title: 'Taze — slimme bedrijfscontrole met AI, maar de mens beslist',
  subtitle: 'Mobiele SaaS-oplossing voor voorraad, materiaal, vervoer, levering en facturatie.',
  paragraphs: [
    'Taze is meer dan een scanner of voorraadapp. Het is een mobiele SaaS-oplossing waarmee bedrijven hun voorraad, materiaal, vervoer, levering en facturatie live opvolgen via bedrijfstelefoons.',
    'Elke werknemer registreert bedrijfsacties zoals scannen, stock verplaatsen, schade melden, levering bevestigen of een taak afronden. Zo krijgt het bedrijf meer controle zonder werknemers permanent te filmen of te volgen.',
    'AI is binnen Taze geen beslisser, maar een slimme toevoeging. De AI helpt bij productherkenning, afwijkingen, lage voorraad, vervaldata, schadepatronen, leveringsstatus en facturatiecontrole.',
    'Elke belangrijke actie blijft onder menselijke controle: AI stelt voor, de verantwoordelijke beslist, en het systeem legt alles vast.',
    'Kaderleden en bedrijfsverantwoordelijken kunnen overal live zien wat er gebeurt binnen hun organisatie. Ze zien welke voorraad bijna op is, welk materiaal schade heeft, welke levering onderweg is, welke klantbevestiging ontbreekt en welke factuur klaarstaat voor controle.',
  ],
  closing:
    'Taze brengt slimme technologie naar de werkvloer, maar houdt verantwoordelijkheid bij de mens. Dat maakt Taze geen gewone AI-app, maar een controleerbaar bedrijfsplatform voor de toekomst. In samenwerking met AI maakt Taze deze controle zichtbaar in de app.',
  pillars: ['Mens beslist', 'AI stelt voor', 'Live controle'],
};

function formatConfidence(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatExpiryLabel(expiryDays: number | null) {
  if (expiryDays === null) {
    return 'Controle nodig';
  }

  if (expiryDays <= 0) {
    return 'Vandaag opvolgen';
  }

  if (expiryDays === 1) {
    return 'Morgen vervaldag';
  }

  return `${expiryDays} dagen houdbaar`;
}

function getSmartStockState(item: {
  quantity: number;
  expiryDays: number | null;
  confidence: number | null;
  category: string;
}) {
  if (item.expiryDays !== null && item.expiryDays <= 0) {
    return {
      label: 'Over datum',
      detail: 'Vandaag afboeken of meteen verwerken.',
      tone: '#dc2626',
      surface: '#fef2f2',
    };
  }

  if (item.expiryDays !== null && item.expiryDays <= 2) {
    return {
      label: 'Vervalrisico',
      detail: 'Eerst gebruiken of afprijzen.',
      tone: '#b45309',
      surface: '#fffbeb',
    };
  }

  if (item.quantity <= getReorderThreshold(item.category)) {
    return {
      label: 'Bijbestellen',
      detail: 'Stock zit op of onder de drempel.',
      tone: '#c2410c',
      surface: '#fff7ed',
    };
  }

  if ((item.confidence ?? 1) < 0.8) {
    return {
      label: 'Controle',
      detail: 'Naam of categorie nog even nakijken.',
      tone: '#1d4ed8',
      surface: '#eff6ff',
    };
  }

  return {
    label: 'Stabiel',
    detail: 'Geen directe actie nodig.',
    tone: '#0f766e',
    surface: '#ecfeff',
  };
}

function getReorderThreshold(category: string) {
  const normalized = category.toLowerCase();

  if (normalized.includes('vers') || normalized.includes('fruit') || normalized.includes('groente')) {
    return 3;
  }

  if (normalized.includes('zuivel') || normalized.includes('drank')) {
    return 2;
  }

  return 1;
}

function getStockBucket(category: string, name: string) {
  const normalized = `${category} ${name}`.toLowerCase();

  if (
    normalized.includes('drank') ||
    normalized.includes('water') ||
    normalized.includes('sap') ||
    normalized.includes('cola') ||
    normalized.includes('fris') ||
    normalized.includes('bier') ||
    normalized.includes('wijn') ||
    normalized.includes('koffie') ||
    normalized.includes('thee') ||
    normalized.includes('bar')
  ) {
    return 'Dranken';
  }

  return 'Voedselkost';
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('nl-BE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function getRouteCtaLabel(href: Href) {
  const path = String(href);
  if (path === '/scan') return 'Start scan';
  if (path === '/alerts') return 'Bekijk wat opraakt';
  if (path === '/payments') return 'Open cijfers';
  if (path === '/partners') return 'Open partners';
  if (path === '/trace') return 'Open trace';
  if (path === '/explore') return 'Open inzichten';
  return 'Open';
}

const annualMonthLabels = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
const financePeriods: FinanciënEntryPeriod[] = ['day', 'week', 'month'];

const financePeriodLabels: Record<FinanciënEntryPeriod, string> = {
  day: 'Dag',
  week: 'Week',
  month: 'Maand',
};

const financeEntryLabels: Record<FinanciënEntryKind, string> = {
  revenue: 'Omzet',
  food_cost: 'Voedselkost',
  bar_cost: 'Barkost',
  loss: 'Verlies',
};

const financeEntryDescriptions: Record<FinanciënEntryKind, string> = {
  revenue: 'Voer hier gerealiseerde verkoop in voor dag, week of maand.',
  food_cost: 'Registreer hier de echte inkoop- of voedselkostbedragen.',
  bar_cost: 'Registreer hier drank-, bar- en tapkosten apart van food cost.',
  loss: 'Leg hier echte verspilling, afboekingen of over-datum verlies vast.',
};

const initialFinanciënForms: FinanciënFormState = {
  revenue: { amount: '', note: '', period: 'day' },
  food_cost: { amount: '', note: '', period: 'day' },
  bar_cost: { amount: '', note: '', period: 'day' },
  loss: { amount: '', note: '', period: 'day' },
};

function getNextLocation(currentLocation: string, locations: string[]) {
  const currentIndex = locations.findIndex((location) => location === currentLocation);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % locations.length : 0;
  return locations[nextIndex] ?? currentLocation;
}

function parseAmountInput(value: string) {
  const normalized = value.trim().replace(',', '.').replace(/[^0-9.]/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function formatFinanciënEntryMeta(entry: FinanciënEntry) {
  const dateLabel = new Date(entry.recordedAt).toLocaleDateString('nl-BE');
  const scopeLabel = entry.location ?? 'Alle vestigingen';
  return `${financePeriodLabels[entry.period]} - ${dateLabel} - ${scopeLabel}`;
}

export default function InsightsScreen() {
  const router = useRouter();
  const [audience, setAudience] = useState<Audience>('Restaurant');
  const [selectedLocation, setSelectedLocation] = useState<LocationFilter>('Alle vestigingen');
  const [newLocationName, setNewLocationName] = useState('');
  const [editingLocation, setEditingLocation] = useState<string | null>(null);
  const [editedLocationName, setEditedLocationName] = useState('');
  const [financeForms, setFinanciënForms] = useState<FinanciënFormState>(initialFinanciënForms);
  const [orderedToday, setOrderedToday] = useState<string[]>([]);
  const [targetFoodCostPercent, setTargetFoodCostPercent] = useState(32);
  const [targetLossBudget, setTargetLossBudget] = useState(0);
  const [bookkeeperEmail, setBookkeeperEmail] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [monthlyReady, setMonthlyReady] = useState(false);
  const [realAiState, setRealAiState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [realAiAnswer, setRealAiAnswer] = useState<RealAiResponse | null>(null);
  const [realAiError, setRealAiError] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const rawTargets = await getItem('finance-targets-v1');
        if (cancelled) return;
        if (rawTargets) {
          const parsed = JSON.parse(rawTargets) as Partial<{ foodCost: number; loss: number }>;
          if (typeof parsed.foodCost === 'number') setTargetFoodCostPercent(parsed.foodCost);
          if (typeof parsed.loss === 'number') setTargetLossBudget(parsed.loss);
        }

        const rawRecipients = await getItem('finance-recipients-v1');
        if (cancelled) return;
        if (rawRecipients) {
          const parsedRecipients = JSON.parse(rawRecipients) as Partial<{ bookkeeper: string; company: string }>;
          if (typeof parsedRecipients.bookkeeper === 'string') setBookkeeperEmail(parsedRecipients.bookkeeper);
          if (typeof parsedRecipients.company === 'string') setCompanyEmail(parsedRecipients.company);
        }

        const rawLastSent = await getItem('finance-last-sent-month');
        if (cancelled) return;
        const now = new Date();
        const tag = `${now.getFullYear()}-${now.getMonth() + 1}`;
        if (now.getDate() === 1 && rawLastSent !== tag) {
          setMonthlyReady(true);
        }
      } catch {
        // ignore parse issues
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const payload = { foodCost: targetFoodCostPercent, loss: targetLossBudget };
    setItem('finance-targets-v1', JSON.stringify(payload)).catch(() => {});
  }, [targetFoodCostPercent, targetLossBudget]);

  useEffect(() => {
    const payload = { bookkeeper: bookkeeperEmail, company: companyEmail };
    setItem('finance-recipients-v1', JSON.stringify(payload)).catch(() => {});
  }, [bookkeeperEmail, companyEmail]);
  const { items, locations, financeEntries, salesEntries, lastSavedAt } = useInventory();
  const currentYear = new Date().getFullYear();

  const visibleItems = useMemo(
    () =>
      selectedLocation === 'Alle vestigingen'
        ? items
        : items.filter((item) => item.location === selectedLocation),
    [items, selectedLocation]
  );

  const metrics = getInventoryMetrics(visibleItems);
  const categoryBreakdown = getCategoryBreakdown(visibleItems).slice(0, 5);
  const locationBreakdown = getLocationBreakdown(items, locations);
  const expiringItems = visibleItems
    .filter((item) => item.expiryDays !== null && item.expiryDays <= 2)
    .slice(0, 4);
  const latest = visibleItems[0] ?? null;
  const currentAudience = audienceContent[audience];
  const visibleSalesEntries = useMemo(
    () =>
      selectedLocation === 'Alle vestigingen'
        ? salesEntries
        : salesEntries.filter((entry) => entry.location === selectedLocation),
    [salesEntries, selectedLocation]
  );

  const liveLocationSnapshots = useMemo(() => {
    const todayTag = new Date().toDateString();

    const isToday = (raw: string) => {
      const date = new Date(raw);
      return !Number.isNaN(date.getTime()) && date.toDateString() === todayTag;
    };

    const allScopes: LocationFilter[] = ['Alle vestigingen', ...locations];

    return allScopes.map((location) => {
      const scopedItems =
        location === 'Alle vestigingen' ? items : items.filter((item) => item.location === location);
      const scopedSales =
        location === 'Alle vestigingen' ? salesEntries : salesEntries.filter((sale) => sale.location === location);
      const scopedFinanciën =
        location === 'Alle vestigingen' ? financeEntries : financeEntries.filter((entry) => entry.location === location);

      const stockUnits = scopedItems.reduce((sum, item) => sum + item.quantity, 0);
      const expiringCount = scopedItems.filter((item) => item.expiryDays !== null && item.expiryDays <= 2).length;
      const lowStockItems = scopedItems.filter((item) => item.quantity <= getReorderThreshold(item.category));
      const lowStockCount = lowStockItems.length;
      const topReorder = [...lowStockItems]
        .sort((a, b) => a.quantity - b.quantity)
        .slice(0, 2)
        .map((item) => item.name);

      const todaySales = scopedSales.filter((sale) => isToday(sale.soldAt));
      const soldUnitsToday = todaySales.reduce((sum, sale) => sum + sale.quantity, 0);
      const soldRevenueToday = todaySales.reduce((sum, sale) => sum + sale.totalAmount, 0);

      const todayFinanciën = scopedFinanciën.filter((entry) => isToday(entry.recordedAt));
      const revenueToday = todayFinanciën.reduce((sum, entry) => (entry.kind === 'revenue' ? sum + entry.amount : sum), 0);
      const lossToday = todayFinanciën.reduce((sum, entry) => (entry.kind === 'loss' ? sum + entry.amount : sum), 0);

      const tone = expiringCount > 0 ? '#dc2626' : lowStockCount > 0 ? '#b45309' : '#0f766e';
      const surface = expiringCount > 0 ? '#fef2f2' : lowStockCount > 0 ? '#fffbeb' : '#ecfeff';

      return {
        location,
        stockUnits,
        stockProducts: scopedItems.length,
        expiringCount,
        lowStockCount,
        topReorder,
        soldUnitsToday,
        soldRevenueToday,
        revenueToday,
        lossToday,
        tone,
        surface,
      };
    });
  }, [financeEntries, items, locations, salesEntries]);

  const locationFilters: { label: LocationFilter; count: number }[] = [
    {
      label: 'Alle vestigingen',
      count: items.reduce((sum, item) => sum + item.quantity, 0),
    },
    ...locationBreakdown.map((entry) => ({
      label: entry.location,
      count: entry.quantity,
    })),
  ];

  const recommendations = [
    audience === 'Restaurant'
      ? {
          title: 'Keukenvoorraad per shift volgen',
          detail:
            metrics.expiringSoon > 0
              ? `${metrics.expiringSoon} producten vragen vandaag aandacht voor service en verspillingsbeperking.`
              : 'De keukenvoorraad oogt stabiel. Plan gerust een nieuwe scanronde voor de volgende shift.',
          href: '/scan' as Href,
        }
      : {
          title: 'Stock centraal houden voor teams',
          detail:
            metrics.totalProducts > 0
              ? `${metrics.totalProducts} producten staan al in dit systeem. Zo werkt aankoop en logistiek met dezelfde data.`
              : 'Start met een eerste stockscan zodat teams hetzelfde voorraadbeeld delen.',
          href: '/scan' as Href,
        },
    latest
      ? {
          title: `Laatste item: ${latest.name}`,
          detail: `Herkenning ${formatConfidence(latest.confidence ?? 0)} · ${latest.location}.`,
          href: '/trace' as Href,
        }
      : {
          title: 'Nog geen voorraad opgeslagen',
          detail: 'Scan of fotografeer een product om te starten.',
          href: '/scan' as Href,
        },
    {
      title: audience === 'Restaurant' ? 'Dagverse producten' : 'Aankoop en voorraad',
      detail:
        categoryBreakdown.length > 0
          ? `Topcategorie: ${categoryBreakdown[0].category}.`
          : 'Na je eerste scan verschijnt de topcategorie hier.',
      href: '/alerts' as Href,
    },
  ];

  const companyAvailableItems = [...visibleItems]
    .sort((left, right) => right.quantity - left.quantity)
    .slice(0, 5);
  const companyLiveFlow = [...visibleItems]
    .map((item) => {
      const soldQuantity = visibleSalesEntries
        .filter((entry) => entry.itemId === item.id || entry.itemName.toLowerCase() === item.name.toLowerCase())
        .reduce((sum, entry) => sum + entry.quantity, 0);
      const baseTarget = getReorderThreshold(item.category) + 2;
      const estimatedGone = soldQuantity > 0 ? soldQuantity : Math.max(baseTarget - item.quantity, 0);
      const flowRatio = baseTarget > 0 ? estimatedGone / Math.max(baseTarget, 1) : 0;

      return {
        id: item.id,
        name: item.name,
        location: item.location,
        remaining: item.quantity,
        estimatedGone,
        category: item.category,
        flowRatio,
        hasLiveSales: soldQuantity > 0,
      };
    })
    .sort((left, right) => right.estimatedGone - left.estimatedGone);
  const companyRemainingUnits = companyLiveFlow.reduce((sum, item) => sum + item.remaining, 0);
  const companyEstimatedGoneUnits = companyLiveFlow.reduce((sum, item) => sum + item.estimatedGone, 0);
  const companyReorderSource = [...visibleItems]
    .filter((item) => item.quantity <= getReorderThreshold(item.category))
    .sort((left, right) => left.quantity - right.quantity);
  const companyReorderItems = companyReorderSource.slice(0, 5);
  const companyExpiredItems = visibleItems
    .filter((item) => item.expiryDays !== null && item.expiryDays <= 0)
    .slice(0, 5);
  const companyExpiringItems = visibleItems
    .filter((item) => item.expiryDays !== null && item.expiryDays > 0 && item.expiryDays <= 2)
    .slice(0, 5);
  const companyOrderList = [...companyReorderSource.reduce((grouped, item) => {
    const key = `${item.name.toLowerCase()}|${item.category.toLowerCase()}`;
    const reorderTarget = getReorderThreshold(item.category) + 1;
    const suggestedOrder = Math.max(reorderTarget - item.quantity, 1);
    const existing = grouped.get(key);

    if (existing) {
      existing.currentQuantity += item.quantity;
      existing.suggestedOrder += suggestedOrder;
      existing.locations.add(item.location);
      return grouped;
    }

    grouped.set(key, {
      name: item.name,
      category: item.category,
      currentQuantity: item.quantity,
      suggestedOrder,
      locations: new Set([item.location]),
    });

    return grouped;
  }, new Map<string, {
    name: string;
    category: string;
    currentQuantity: number;
    suggestedOrder: number;
    locations: Set<string>;
  }>()).values()]
    .map((entry) => ({
      ...entry,
      locations: [...entry.locations],
      bucket: getStockBucket(entry.category, entry.name),
    }))
    .sort((left, right) => right.suggestedOrder - left.suggestedOrder);
  const companyFoodItems = visibleItems.filter((item) => getStockBucket(item.category, item.name) === 'Voedselkost');
  const companyDrinkItems = visibleItems.filter((item) => getStockBucket(item.category, item.name) === 'Dranken');
  const companyFoodOrderList = companyOrderList.filter((item) => item.bucket === 'Voedselkost');
  const companyDrinkOrderList = companyOrderList.filter((item) => item.bucket === 'Dranken');
  const companyOrderPerLocation = useMemo(() => {
    const grouped = new Map<
      string,
      {
        items: typeof companyOrderList;
        total: number;
      }
    >();

    companyOrderList.forEach((item) => {
      item.locations.forEach((location) => {
        const existing = grouped.get(location) ?? { items: [], total: 0 };
        existing.items.push(item);
        existing.total += item.suggestedOrder;
        grouped.set(location, existing);
      });
    });

    return [...grouped.entries()]
      .map(([location, payload]) => ({
        location,
        total: payload.total,
        items: payload.items.slice(0, 4),
        allItems: payload.items,
      }))
      .sort((left, right) => right.total - left.total);
  }, [companyOrderList]);
  const visibleFinanciënEntries = useMemo(
    () =>
      selectedLocation === 'Alle vestigingen'
        ? financeEntries
        : financeEntries.filter((entry) => entry.location === selectedLocation),
    [financeEntries, selectedLocation]
  );
  const currentYearFinanciënEntries = useMemo(
    () =>
      visibleFinanciënEntries.filter((entry) => {
        const recordedAt = new Date(entry.recordedAt);
        return !Number.isNaN(recordedAt.getTime()) && recordedAt.getFullYear() === currentYear;
      }),
    [currentYear, visibleFinanciënEntries]
  );
  const companyFoodCostValue = currentYearFinanciënEntries.reduce(
    (sum, entry) => (entry.kind === 'food_cost' ? sum + entry.amount : sum),
    0
  );
  const companyRevenueTotal = currentYearFinanciënEntries.reduce(
    (sum, entry) => (entry.kind === 'revenue' ? sum + entry.amount : sum),
    0
  );
  const companyLossValue = currentYearFinanciënEntries.reduce(
    (sum, entry) => (entry.kind === 'loss' ? sum + entry.amount : sum),
    0
  );
  const companyFoodCostPercent =
    companyRevenueTotal > 0 ? (companyFoodCostValue / companyRevenueTotal) * 100 : 0;
  const companyMarginValue = Math.max(companyRevenueTotal - companyFoodCostValue, 0);
  const companyNetResultValue = companyRevenueTotal - companyFoodCostValue - companyLossValue;
  const now = new Date();
  const monthFinanciënEntries = visibleFinanciënEntries.filter((entry) => {
    const recordedAt = new Date(entry.recordedAt);
    return (
      !Number.isNaN(recordedAt.getTime()) &&
      recordedAt.getFullYear() === now.getFullYear() &&
      recordedAt.getMonth() === now.getMonth()
    );
  });
  const monthRevenueTotal = monthFinanciënEntries.reduce(
    (sum, entry) => (entry.kind === 'revenue' ? sum + entry.amount : sum),
    0
  );
  const monthFoodCostValue = monthFinanciënEntries.reduce(
    (sum, entry) => (entry.kind === 'food_cost' ? sum + entry.amount : sum),
    0
  );
  const monthLossValue = monthFinanciënEntries.reduce(
    (sum, entry) => (entry.kind === 'loss' ? sum + entry.amount : sum),
    0
  );
  const monthNetResultValue = monthRevenueTotal - monthFoodCostValue - monthLossValue;
  const currentQuarter = Math.floor(now.getMonth() / 3);
  const quarterFinanciënEntries = visibleFinanciënEntries.filter((entry) => {
    const recordedAt = new Date(entry.recordedAt);
    return (
      !Number.isNaN(recordedAt.getTime()) &&
      recordedAt.getFullYear() === now.getFullYear() &&
      Math.floor(recordedAt.getMonth() / 3) === currentQuarter
    );
  });
  const quarterRevenueTotal = quarterFinanciënEntries.reduce(
    (sum, entry) => (entry.kind === 'revenue' ? sum + entry.amount : sum),
    0
  );
  const quarterFoodCostValue = quarterFinanciënEntries.reduce(
    (sum, entry) => (entry.kind === 'food_cost' ? sum + entry.amount : sum),
    0
  );
  const quarterLossValue = quarterFinanciënEntries.reduce(
    (sum, entry) => (entry.kind === 'loss' ? sum + entry.amount : sum),
    0
  );
  const quarterNetResultValue = quarterRevenueTotal - quarterFoodCostValue - quarterLossValue;
  const monthFoodCostPercent = monthRevenueTotal > 0 ? (monthFoodCostValue / monthRevenueTotal) * 100 : 0;
  const monthFoodCostGapPercent = Math.max(0, monthFoodCostPercent - targetFoodCostPercent);
  const potentialFoodCostSavings = Math.max(0, (monthFoodCostGapPercent / 100) * monthRevenueTotal);
  const potentialLossSavings = Math.max(0, monthLossValue - targetLossBudget);
  const potentialTotalSavings = potentialFoodCostSavings + potentialLossSavings;
  const liveYearLabel = companyNetResultValue >= 0 ? 'Live winst (jaar)' : 'Live verlies (jaar)';
  const liveQuarterLabel = quarterNetResultValue >= 0 ? 'Live winst (kwartaal)' : 'Live verlies (kwartaal)';
  const liveMonthLabel = monthNetResultValue >= 0 ? 'Live winst (maand)' : 'Live verlies (maand)';
  const annualOverviewData = getFinanciënOverviewByMonth(visibleFinanciënEntries, currentYear).map((month, index) => ({
    label: annualMonthLabels[index] ?? `${index + 1}`,
    revenue: month.revenue,
    foodCost: month.foodCost,
    loss: month.loss,
  }));
  const annualOverviewMax = Math.max(
    1,
    ...annualOverviewData.flatMap((month) => [month.revenue, month.foodCost, month.loss])
  );
  const hasAnnualOverviewData = annualOverviewData.some(
    (month) => month.revenue > 0 || month.foodCost > 0 || month.loss > 0
  );
  const recentFinanciënEntries = [...visibleFinanciënEntries]
    .sort(
      (left, right) =>
        new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime()
    )
    .slice(0, 6);
  const totalRecordedRevenue = visibleFinanciënEntries
    .filter((entry) => entry.kind === 'revenue')
    .reduce((sum, entry) => sum + entry.amount, 0);

  function handleLinkRevenue() {
    const totalAmount = salesEntries.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const amount = Math.max(1, Math.round(totalAmount));

    addFinanciënEntry({
      kind: 'revenue',
      period: 'day',
      amount,
      note: 'Koppeling kassaverkoop',
      location: selectedLocation === 'Alle vestigingen' ? null : selectedLocation,
    });
    return true;
  }

  function handleRegisterLoss() {
    const goneUnits = companyEstimatedGoneUnits;
    if (goneUnits <= 0) {
      return false;
    }

    const avgUnitPrice = 3.8;
    const amount = Math.max(1, Math.round(goneUnits * avgUnitPrice));

    addFinanciënEntry({
      kind: 'loss',
      period: 'day',
      amount,
      note: 'Verliesregistratie op basis van weg/rest',
      location: selectedLocation === 'Alle vestigingen' ? null : selectedLocation,
    });
    return true;
  }

  const monthAdvice = (() => {
    const advice: { title: string; detail: string; tone: string; href: Href }[] = [];

    if (monthFoodCostPercent > 35) {
      advice.push({
      title: 'Voedselkost omlaag',
      detail: 'Controleer inkoopprijzen, porties en derving; maandelijkse voedselkost ligt hoog.',
        tone: '#dc2626',
        href: '/payments' as Href,
      });
    }

    if (monthLossValue > 0) {
      advice.push({
      title: 'Live verlies beperken',
        detail: 'Boek verliesregels na en koppel ze aan voorraad zodat marges herstellen.',
        tone: '#b45309',
        href: '/alerts' as Href,
      });
    }

    if (monthRevenueTotal === 0) {
      advice.push({
        title: 'Omzet toevoegen',
        detail: 'Voeg kassaverkoop toe of koppel een integratie zodat de maand compleet is.',
        tone: '#1d4ed8',
        href: '/payments' as Href,
      });
    }

    if (advice.length === 0) {
      advice.push({
        title: 'Maand op koers',
      detail: 'Omzet, voedselkost en live winst/verlies liggen in lijn met je invoer.',
        tone: '#0f766e',
        href: '/explore' as Href,
      });
    }

    return advice.slice(0, 3);
  })();
  const smartSignals = [
    companyReorderItems.length > 0
      ? {
          title: 'Bijbestellen slim plannen',
          detail: `${companyReorderItems.length} product(en) zitten op of onder hun drempel.`,
          tone: '#b45309',
          surface: '#fffbeb',
          href: '/explore' as Href,
        }
      : {
          title: 'Stock goed verdeeld',
          detail: 'Er zijn momenteel geen directe bijbestelpunten in deze selectie.',
          tone: '#0f766e',
          surface: '#ecfeff',
          href: '/scan' as Href,
        },
    currentYearFinanciënEntries.length === 0
      ? {
          title: 'Financiën actief',
          detail: 'Voeg omzet of verlies toe om de grafiek te vullen.',
          tone: '#7c3aed',
          surface: '#f5f3ff',
          href: '/payments' as Href,
        }
      : {
          title: 'Historiek actief',
          detail: `${currentYearFinanciënEntries.length} registraties sturen je rapportage.`,
          tone: '#1d4ed8',
          surface: '#eff6ff',
          href: '/payments' as Href,
        },
    companyFoodCostPercent > 35
      ? {
          title: 'Voedselkost hoog',
          detail: 'Controleer verspilling, porties en inkoop.',
          tone: '#dc2626',
          surface: '#fef2f2',
          href: '/payments' as Href,
        }
      : {
          title: 'Marge stabiel',
          detail: 'Omzet en voedselkost liggen in balans.',
          tone: '#0f766e',
          surface: '#ecfeff',
          href: '/payments' as Href,
        },
  ];

  const insightHealthScore = Math.max(
    35,
    Math.min(
      97,
      Math.round(
        (metrics.totalProducts > 0 ? 24 : 10) +
          Math.min(28, Math.round(metrics.averageConfidence * 30)) +
          (companyReorderItems.length === 0 ? 16 : Math.max(4, 16 - companyReorderItems.length * 3)) +
          (metrics.expiringSoon === 0 ? 16 : Math.max(5, 16 - metrics.expiringSoon * 4)) +
          (currentYearFinanciënEntries.length > 0 ? 14 : 6)
      )
    )
  );

  const insightPrimaryAction =
    metrics.expiringSoon > 0
      ? {
          title: 'Bekijk wat opraakt',
          detail: `${metrics.expiringSoon} product(en) vragen vandaag actie.`,
          cta: 'Neem actie',
          href: '/alerts' as Href,
          tone: '#dc2626',
          surface: '#fef2f2',
        }
      : companyReorderItems.length > 0
        ? {
            title: 'Vul lage stock aan',
            detail: `${companyReorderItems.length} product(en) zitten op of onder hun drempel.`,
            cta: 'Open bestellijst',
            href: '/explore' as Href,
            tone: '#b45309',
            surface: '#fffbeb',
          }
        : currentYearFinanciënEntries.length === 0
          ? {
              title: 'Cijfers toevoegen',
              detail: 'Zonder omzet of verlies kan het systeem nog niet sturen.',
              cta: 'Open cijfers',
              href: '/payments' as Href,
              tone: '#7c3aed',
              surface: '#f5f3ff',
            }
          : {
              title: 'Inzicht actief',
              detail: 'Voorraad, herkenning en historiek werken samen.',
              cta: 'Start scan',
              href: '/scan' as Href,
              tone: '#0f766e',
              surface: '#ecfeff',
            };

  const locationRecommendations = locationBreakdown.slice(0, 3).map((entry) => {
    const locationItems = items.filter((item) => item.location === entry.location);
    const locationExpiring = locationItems.filter((item) => item.expiryDays !== null && item.expiryDays <= 2).length;
    const locationLowStock = locationItems.filter(
      (item) => item.quantity <= getReorderThreshold(item.category)
    ).length;

    return {
      location: entry.location,
      quantity: entry.quantity,
      action:
        locationExpiring > 0
          ? `${locationExpiring} vervalalert(s) eerst opvolgen`
          : locationLowStock > 0
            ? `${locationLowStock} product(en) slim bijbestellen`
            : 'Stock is hier momenteel stabiel',
      tone: locationExpiring > 0 ? '#dc2626' : locationLowStock > 0 ? '#b45309' : '#0f766e',
      surface: locationExpiring > 0 ? '#fef2f2' : locationLowStock > 0 ? '#fffbeb' : '#ecfeff',
      href: locationExpiring > 0 ? ('/alerts' as Href) : locationLowStock > 0 ? ('/scan' as Href) : ('/explore' as Href),
    };
  });

  const insightDrivers = useMemo(
    () => [
      {
        label: 'Slimme score',
        value: `${insightHealthScore}%`,
        detail: 'Combinatie van stock, herkenning en opvolging',
        href: '/explore' as Href,
      },
      {
        label: 'Vestigingen actief',
        value: `${locations.length}`,
        detail:
          selectedLocation === 'Alle vestigingen' ? 'Alle locaties in beeld' : `${selectedLocation} geselecteerd`,
        href: '/explore' as Href,
      },
      {
        label: 'Topcategorie',
        value: categoryBreakdown[0]?.category ?? 'Nog geen categorie',
        detail: categoryBreakdown[0]
          ? `${categoryBreakdown[0].quantity} stuks in focus`
          : 'Na je eerste scan verschijnt de topcategorie hier.',
        href: '/scan' as Href,
      },
    ],
    [categoryBreakdown, insightHealthScore, locations.length, selectedLocation]
  );

  const exploreAiActions = useMemo<RealAiAvailableAction[]>(() => {
    const actions: RealAiAvailableAction[] = [
      {
        kind: 'explore_link_revenue',
        label: 'Koppel omzet',
        description: 'Voeg omzet toe vanuit kassadata of live bedrijfsflow.',
      },
      {
        kind: 'explore_register_loss',
        label: 'Registreer verlies',
        description: 'Boek geschat verlies op basis van weg/rest en voorraadbeweging.',
      },
      {
        kind: 'explore_focus_restaurant',
        label: 'Zet op restaurant',
        description: 'Schakel de cockpit naar restaurantlogica en keukenflow.',
      },
      {
        kind: 'explore_focus_business',
        label: 'Zet op bedrijf',
        description: 'Schakel de cockpit naar bedrijfslogica en distributieflow.',
      },
    ];

    if (locationRecommendations[0]?.location) {
      actions.push({
        kind: 'explore_focus_top_location',
        label: `Focus op ${locationRecommendations[0].location}`,
        description: 'Spring direct naar de vestiging met de hoogste actuele relevantie.',
      });
    }

    return actions;
  }, [locationRecommendations]);
  const exploreTransportFocus = useMemo(
    () =>
      buildTransportAiContext({
        region: 'Europa',
        useCase: audience === 'Bedrijf' ? 'Zakelijk' : 'Delivery',
      }).transport,
    [audience]
  );

  const exploreAiContext = useMemo(
    () => ({
      screen: 'explore',
      audience,
      selectedLocation,
      insightHealthScore,
      primaryAction: {
        title: insightPrimaryAction.title,
        detail: insightPrimaryAction.detail,
        cta: insightPrimaryAction.cta,
        href: insightPrimaryAction.href,
      },
      drivers: insightDrivers.map((driver) => ({
        label: driver.label,
        value: driver.value,
        detail: driver.detail,
        href: driver.href,
      })),
      locations: locationRecommendations.map((location) => ({
        location: location.location,
        quantity: location.quantity,
        action: location.action,
        href: location.href,
      })),
      metrics: {
        totalProducts: metrics.totalProducts,
        totalUnits: metrics.totalUnits,
        averageConfidence: metrics.averageConfidence,
        expiringSoon: metrics.expiringSoon,
      },
      finance: {
        currentYearEntries: currentYearFinanciënEntries.length,
        currentYearRevenue: companyRevenueTotal,
        currentYearFoodCost: companyFoodCostValue,
        currentYearLoss: companyLossValue,
        monthRevenueTotal,
        monthFoodCostValue,
        monthLossValue,
        monthNetResultValue,
        companyFoodCostPercent,
        potentialTotalSavings,
      },
      transportFocus: exploreTransportFocus,
      topCategory: categoryBreakdown[0]?.category ?? null,
    }),
    [
      audience,
      categoryBreakdown,
      companyFoodCostValue,
      companyFoodCostPercent,
      companyLossValue,
      companyRevenueTotal,
      currentYearFinanciënEntries.length,
      insightDrivers,
      insightHealthScore,
      insightPrimaryAction.cta,
      insightPrimaryAction.detail,
      insightPrimaryAction.href,
      insightPrimaryAction.title,
      locationRecommendations,
      metrics.averageConfidence,
      metrics.expiringSoon,
      metrics.totalProducts,
      metrics.totalUnits,
      monthFoodCostValue,
      monthLossValue,
      monthNetResultValue,
      monthRevenueTotal,
      exploreTransportFocus,
      potentialTotalSavings,
      selectedLocation,
    ]
  );

  useEffect(() => {
    setRealAiState('idle');
    setRealAiAnswer(null);
    setRealAiError('');
  }, [
    audience,
    currentYearFinanciënEntries.length,
    insightHealthScore,
    metrics.expiringSoon,
    metrics.totalProducts,
    metrics.totalUnits,
    monthFoodCostValue,
    monthLossValue,
    monthRevenueTotal,
    selectedLocation,
  ]);

  const askExploreAi = useCallback(async () => {
    setRealAiState('loading');
    setRealAiAnswer(null);
    setRealAiError('');

    try {
      const answer = await requestRealAi({
        screen: 'explore',
         question: 'Wat is nu de belangrijkste operationele actie voor deze voorraad- en financiestatus?',
        context: exploreAiContext,
        availableActions: exploreAiActions,
      });
      setRealAiAnswer(answer);
      setRealAiState('done');
    } catch (error) {
      setRealAiState('error');
      setRealAiAnswer(null);
      setRealAiError(error instanceof Error ? error.message : 'De echte AI is nu niet bereikbaar.');
    }
  }, [exploreAiActions, exploreAiContext]);

  function applyExploreAiAction(action: NonNullable<RealAiResponse['action']>) {
    if (realAiAnswer?.auditId) {
      markAiAuditInteraction(realAiAnswer.auditId, {
        kind: 'action_applied',
        label: action.label,
      }).catch(() => {});
    }

    let success = false;

    switch (action.kind) {
      case 'explore_link_revenue':
        success = handleLinkRevenue();
        break;
      case 'explore_register_loss':
        success = handleRegisterLoss();
        break;
      case 'explore_focus_restaurant':
        setAudience('Restaurant');
        success = true;
        break;
      case 'explore_focus_business':
        setAudience('Bedrijf');
        success = true;
        break;
      case 'explore_focus_top_location':
        if (locationRecommendations[0]?.location) {
          setSelectedLocation(locationRecommendations[0].location);
          success = true;
        }
        break;
      default:
        success = false;
        break;
    }

    if (realAiAnswer?.auditId) {
      markAiAuditOutcome(realAiAnswer.auditId, {
        kind: success ? 'success' : 'failed',
        label: success ? `${action.label} voltooid` : `${action.label} niet uitgevoerd`,
      }).catch(() => {});
    }
  }

  const businessPartnerAdvice = [
    {
      title: 'Partnerroute',
      detail:
        metrics.expiringSoon > 0
          ? 'Verspillingspartner eerst.'
          : companyReorderItems.length > 0
            ? 'Leverancierspartner eerst.'
            : 'Rapportagepartner eerst.',
      cta: 'Open partners',
      href: '/partners' as Href,
      tone: '#1d4ed8',
      surface: '#eff6ff',
    },
    {
      title: 'Aankoopadvies',
      detail:
        companyOrderList.length > 0
          ? `${companyOrderList[0]?.name ?? 'Product'} staat bovenaan.`
          : 'Geen directe bestelaanbeveling in deze selectie.',
      cta: companyOrderList.length > 0 ? 'Open bestellijst' : 'Start scan',
      href: companyOrderList.length > 0 ? ('/explore' as Href) : ('/scan' as Href),
      tone: '#b45309',
      surface: '#fffbeb',
    },
    {
      title: 'Cijfers',
      detail:
        currentYearFinanciënEntries.length > 0
          ? 'Voorraad en cijfers werken samen.'
          : 'Voeg omzet of verlies toe om te starten.',
      cta: currentYearFinanciënEntries.length > 0 ? 'Open cijfers' : 'Financiën actief',
      href: '/payments' as Href,
      tone: '#7c3aed',
      surface: '#f5f3ff',
    },
  ];

  const companyOperatingSignals = [
    {
      label: 'Partnerfit',
      value: `${Math.max(42, Math.min(98, Math.round(insightHealthScore * 0.92)))}%`,
      detail: 'Match tussen partnerflow en actuele stockdruk',
      href: '/partners' as Href,
    },
    {
      label: 'Besteldruk',
      value: companyOrderList.length > 0 ? `${companyOrderList.length} regels` : 'Rustig',
      detail: companyOrderList.length > 0 ? 'Slimme bestellijst staat klaar' : 'Geen acute bijbestelling',
      href: '/explore' as Href,
    },
    {
      label: 'Vestigingsfocus',
      value: selectedLocation === 'Alle vestigingen' ? 'Centraal' : selectedLocation,
      detail: selectedLocation === 'Alle vestigingen' ? 'Overzicht over alle locaties' : 'Gefilterde bedrijfsweergave',
      href: '/explore' as Href,
    },
  ];

  const companyLiveScore = Math.max(
    40,
    Math.min(
      98,
      Math.round(
        (companyRemainingUnits > 0 ? 22 : 8) +
          (companyEstimatedGoneUnits > 0 ? Math.max(8, 22 - companyEstimatedGoneUnits * 2) : 18) +
          (metrics.expiringSoon === 0 ? 18 : Math.max(4, 18 - metrics.expiringSoon * 4)) +
          (companyReorderItems.length === 0 ? 18 : Math.max(4, 18 - companyReorderItems.length * 3)) +
          (currentYearFinanciënEntries.length > 0 ? 16 : 8)
      )
    )
  );

  const liveBusinessAction =
    metrics.expiringSoon > 0
      ? {
          title: 'Bekijk wat opraakt',
          detail: `${metrics.expiringSoon} product(en) vragen vandaag actie.`,
          tone: '#dc2626',
          surface: '#fef2f2',
          cta: 'Neem actie',
          href: '/alerts' as Href,
        }
      : companyEstimatedGoneUnits > companyRemainingUnits
        ? {
            title: 'Vul voorraad aan',
            detail: 'Er gaat meer uit dan er terugkomt.',
            tone: '#b45309',
            surface: '#fffbeb',
            cta: 'Open bestellijst',
            href: '/explore' as Href,
          }
        : currentYearFinanciënEntries.length === 0
          ? {
              title: 'Financiën actief',
              detail: 'Voeg omzet of verlies toe om de cijfers te laten sturen.',
              tone: '#7c3aed',
              surface: '#f5f3ff',
              cta: 'Open cijfers',
              href: '/payments' as Href,
            }
          : {
              title: 'Flow stabiel',
              detail: 'Voorraad, verbruik en registraties lopen mee.',
              tone: '#0f766e',
              surface: '#ecfeff',
              cta: 'Start scan',
              href: '/scan' as Href,
            };

  const liveBusinessSignals = [
    {
      label: 'Live score',
      value: `${companyLiveScore}%`,
      detail: 'Gezondheid van je bedrijfsflow nu',
      href: '/explore' as Href,
    },
    {
      label: 'Reststock',
      value: `${companyRemainingUnits} stuks`,
      detail: 'Wat nog live beschikbaar is',
      href: '/scan' as Href,
    },
    {
      label: 'Verbruik',
      value: `${companyEstimatedGoneUnits} stuks`,
      detail: visibleSalesEntries.length > 0 ? 'Gebaseerd op echte kassaverkoop' : 'Slimme inschatting van wat al weg is',
      href: '/trace' as Href,
    },
    {
      label: 'Druk nu',
      value:
        metrics.expiringSoon > 0
          ? 'Verspilling'
          : companyReorderItems.length > 0
            ? 'Bijbestellen'
            : 'Stabiel',
      detail:
        metrics.expiringSoon > 0
          ? 'Korte houdbaarheid'
          : companyReorderItems.length > 0
            ? 'Lage stock'
            : 'Geen acute blokkade',
      href: metrics.expiringSoon > 0 ? ('/alerts' as Href) : ('/explore' as Href),
    },
  ];

  const stockLowItems = visibleItems.filter(
    (item) => item.quantity <= getReorderThreshold(item.category)
  );
  const stockReviewItems = visibleItems.filter(
    (item) => item.confidence !== null && item.confidence < 0.8
  );
  const stockHealthScore = Math.max(
    38,
    Math.min(
      98,
      Math.round(
        (metrics.totalProducts > 0 ? 24 : 8) +
          Math.min(28, Math.round(metrics.averageConfidence * 30)) +
          (metrics.expiringSoon === 0 ? 18 : Math.max(4, 18 - metrics.expiringSoon * 4)) +
          (stockLowItems.length === 0 ? 16 : Math.max(5, 16 - stockLowItems.length * 3)) +
          (stockReviewItems.length === 0 ? 12 : Math.max(4, 12 - stockReviewItems.length * 2))
      )
    )
  );

  const stockPrimaryAction =
    metrics.expiringSoon > 0
      ? {
          title: 'Bekijk wat opraakt',
          detail: `${metrics.expiringSoon} product(en) vragen vandaag actie.`,
          cta: 'Neem actie',
          href: '/alerts' as Href,
          tone: '#dc2626',
          surface: '#fef2f2',
        }
      : stockLowItems.length > 0
        ? {
            title: 'Vul lage stock aan',
            detail: `${stockLowItems.length} product(en) zitten op of onder hun drempel.`,
            cta: 'Neem actie',
            href: '/explore' as Href,
            tone: '#b45309',
            surface: '#fffbeb',
          }
        : stockReviewItems.length > 0
          ? {
              title: 'Controleer herkenning',
              detail: `${stockReviewItems.length} product(en) vragen nog controle.`,
              cta: 'Start scan',
              href: '/scan' as Href,
              tone: '#1d4ed8',
              surface: '#eff6ff',
            }
          : {
              title: 'Voorraad stabiel',
              detail: 'Er is nu geen directe actie nodig.',
              cta: 'Start scan',
              href: '/scan' as Href,
              tone: '#0f766e',
              surface: '#ecfeff',
            };

  const stockSignals = [
    {
      label: 'Voorraadfit',
      value: `${stockHealthScore}%`,
      detail: 'Gezondheid van je actuele stock',
      href: '/explore' as Href,
    },
    {
      label: 'Lage stock',
      value: stockLowItems.length ? `${stockLowItems.length}` : '0',
      detail: stockLowItems.length ? 'Producten vragen aanvulling' : 'Geen directe tekorten',
      href: '/alerts' as Href,
    },
    {
      label: 'Controle nodig',
      value: stockReviewItems.length ? `${stockReviewItems.length}` : '0',
      detail: stockReviewItems.length ? 'Herkenning of data nakijken' : 'Data oogt stabiel',
      href: '/scan' as Href,
    },
  ];

  const dailySuggestions = stockLowItems
    .slice()
    .sort((left, right) => left.quantity - right.quantity)
    .slice(0, 5)
    .map((item) => ({
      ...item,
      suggestedOrder: getSuggestedOrderForItem(item),
      isDone: orderedToday.includes(item.id),
    }));

  const operationsCards = [
    {
      title: audience === 'Restaurant' ? 'Gebruik in keuken' : 'Operationele voorraad',
      body:
        audience === 'Restaurant'
          ? 'Chefs en zaal kunnen live zien wat beschikbaar is voor de dagkaart, prep en service.'
           : 'Magazijn, aankoop en backoffice kijken naar dezelfde voorraaddata en vermijden dubbel werk.',
      href: '/scan' as Href,
    },
    {
      title: audience === 'Restaurant' ? 'Verval en verspilling' : 'Levering en aanvulling',
      body:
        expiringItems.length > 0
          ? expiringItems.map((item) => `${item.name} (${formatExpiryLabel(item.expiryDays)})`).join(', ')
          : audience === 'Restaurant'
            ? 'Er staan momenteel geen directe vervalproducten klaar in de keukenvoorraad.'
            : 'Er zijn geen kritieke stockitems met directe opvolging nodig.',
      href: '/alerts' as Href,
    },
    {
      title: 'Laatste sync',
      body: lastSavedAt
        ? `Laatste opslagmoment: ${new Date(lastSavedAt).toLocaleString('nl-BE')}.`
        : 'Nog geen opgeslagen voorraadmoment beschikbaar.',
      href: '/trace' as Href,
    },
  ];

  const financeSummaryCards = [
    {
      title: liveYearLabel,
      value: formatCurrency(companyNetResultValue),
      meta: `Jaar tot nu toe in ${currentYear}.`,
      href: '/payments' as Href,
    },
    {
      title: liveQuarterLabel,
      value: formatCurrency(quarterNetResultValue),
      meta: `Q${currentQuarter + 1} live in ${currentYear}.`,
      href: '/payments' as Href,
    },
    {
      title: 'Omzet',
      value: formatCurrency(companyRevenueTotal),
      meta: `Gerealiseerde omzetregistraties in ${currentYear}.`,
      href: '/payments' as Href,
    },
    {
      title: 'Live verlies',
      value: formatCurrency(companyLossValue),
      meta: 'Echte verspilling, afboekingen en over-datum live verlies.',
      href: '/alerts' as Href,
    },
    {
      title: 'Voedselkost %',
      value: `${Math.round(companyFoodCostPercent)}%`,
      meta:
        companyFoodCostPercent > 35
          ? 'Hoge voedselkost. Controleer verspilling, porties en aankoopprijzen.'
          : 'Gezonde verhouding tegenover de ingevoerde omzet.',
      warn: companyFoodCostPercent > 35,
      href: '/payments' as Href,
    },
    {
      title: 'Brutomarge',
      value: formatCurrency(companyMarginValue),
      meta: 'Omzet min voedselkost, voor live verlies wordt apart afgeboekt.',
      href: '/payments' as Href,
    },
  ];

  const savingsSummaryCards = [
    {
      label: 'Huidige voedselkost % (maand)',
      value: `${Math.round(monthFoodCostPercent)}%`,
      meta: `Gap: ${Math.round(monthFoodCostGapPercent)}% boven doel`,
      href: '/payments' as Href,
    },
    {
      label: 'potentiele besparing (voedselkost)',
      value: formatCurrency(potentialFoodCostSavings),
      meta: 'Bij behalen van het doel % dit bedrag vrijspelen',
      href: '/explore' as Href,
    },
    {
      label: 'Live verlies t.o.v. budget',
      value: formatCurrency(Math.max(0, monthLossValue - targetLossBudget)),
      meta: `Budget: ${formatCurrency(targetLossBudget)} - Actueel: ${formatCurrency(monthLossValue)}`,
      href: '/alerts' as Href,
    },
    {
      label: 'Totale potentiele besparing',
      value: formatCurrency(potentialTotalSavings),
      meta: 'Door voedselkost naar doel + live verlies binnen budget',
      href: '/explore' as Href,
    },
  ];

  type FinanciënMonthlyCard = {
    title: string;
    value: string;
    meta: string;
    href: Href;
    warn?: boolean;
  };

  const financeMonthlyCards: FinanciënMonthlyCard[] = [
    {
      title: liveMonthLabel,
      value: formatCurrency(monthNetResultValue),
      meta: `${annualMonthLabels[now.getMonth()]} - omzet ${formatCurrency(monthRevenueTotal)} - voedselkost ${formatCurrency(monthFoodCostValue)} - verlies ${formatCurrency(monthLossValue)}`,
      href: '/payments' as Href,
    },
    {
      title: liveQuarterLabel,
      value: formatCurrency(quarterNetResultValue),
      meta:
        `Q${currentQuarter + 1} - omzet ${formatCurrency(quarterRevenueTotal)} - voedselkost ${formatCurrency(quarterFoodCostValue)} - verlies ${formatCurrency(quarterLossValue)}`,
      href: '/explore' as Href,
    },
  ];

  const bucketSummaryCards = [
    {
      title: 'Voedselkost',
      value: `${companyFoodItems.reduce((sum, item) => sum + item.quantity, 0)} stuks`,
      detail: `${companyFoodItems.length} producten in voedselkost.`,
      href: '/scan' as Href,
    },
    {
      title: 'Dranken',
      value: `${companyDrinkItems.reduce((sum, item) => sum + item.quantity, 0)} stuks`,
      detail: `${companyDrinkItems.length} producten in dranken.`,
      href: '/scan' as Href,
    },
  ];

  const orderSummaryCards = [
    {
      title: 'Bestelregels',
      value: `${companyOrderList.length}`,
      href: '/explore' as Href,
    },
    {
      title: 'Te bestellen stuks',
      value: `${companyOrderList.reduce((sum, item) => sum + item.suggestedOrder, 0)}`,
      href: '/scan' as Href,
    },
  ];

  function handleRemoveItem(id: string, name: string) {
    const confirmed =
      typeof window === 'undefined' || typeof window.confirm !== 'function'
        ? true
        : window.confirm(`${name} uit de stock verwijderen?`);

    if (confirmed) {
      removeInventoryItem(id);
    }
  }

  function handleAddLocation() {
    const result = addInventoryLocation(newLocationName);
    if (result.ok) {
      setNewLocationName('');
      return;
    }

    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(
        result.reason === 'duplicate'
          ? 'Deze vestiging bestaat al.'
          : 'Geef eerst een naam voor de vestiging in.'
      );
    }
  }

  function buildOrderCsv(entries: typeof companyOrderList) {
    const header = ['Naam', 'Categorie', 'Vestigingen', 'Huidig', 'Bestel'].join(',');
    const rows = entries.map((item) =>
      [
        `"${item.name.replace(/"/g, '""')}"`,
        `"${item.category.replace(/"/g, '""')}"`,
        `"${item.locations.join(' | ').replace(/"/g, '""')}"`,
        item.currentQuantity,
        item.suggestedOrder,
      ].join(',')
    );
    return [header, ...rows].join('\n');
  }

  function triggerCsvDownload(csv: string, filename: string) {
    const uri = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    Linking.openURL(uri).catch(() => {});
  }

  async function copyCsvToClipboard(csv: string) {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
    try {
      await navigator.clipboard.writeText(csv);
      return true;
    } catch {
      return false;
    }
  }

  function buildFinanciënCsv(entries: FinanciënEntry[], label: string) {
    const header = ['Datum', 'Soort', 'Periode', 'Locatie', 'Bedrag (EUR)', 'Notitie'].join(',');
    const rows = entries.map((entry) => {
      const dateLabel = new Date(entry.recordedAt).toLocaleDateString('nl-BE');
      const kindLabel = financeEntryLabels[entry.kind] ?? entry.kind;
      const periodLabel = financePeriodLabels[entry.period] ?? entry.period;
      const locationLabel = entry.location ?? 'Centraal';
      return [
        dateLabel,
        kindLabel,
        periodLabel,
        `"${locationLabel.replace(/"/g, '""')}"`,
        entry.amount.toFixed(2),
        `"${(entry.note ?? '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    return [`Rapport: ${label}`, `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`, '', header, ...rows].join('\n');
  }

  function buildFinanciënByLocationCsv(entries: FinanciënEntry[], label: string) {
    const grouped = new Map<
      string,
      { revenue: number; foodCost: number; loss: number }
    >();

    entries.forEach((entry) => {
      const key = entry.location ?? 'Centraal';
      const bucket = grouped.get(key) ?? { revenue: 0, foodCost: 0, loss: 0 };
      if (entry.kind === 'revenue') bucket.revenue += entry.amount;
      if (entry.kind === 'food_cost') bucket.foodCost += entry.amount;
      if (entry.kind === 'loss') bucket.loss += entry.amount;
      grouped.set(key, bucket);
    });

    const header = ['Locatie', 'Omzet', 'Voedselkost', 'Verlies', 'Netto'].join(',');
    const rows = [...grouped.entries()].map(([location, vals]) => {
      const net = vals.revenue - vals.foodCost - vals.loss;
      return [
        `"${location.replace(/"/g, '""')}"`,
        vals.revenue.toFixed(2),
        vals.foodCost.toFixed(2),
        vals.loss.toFixed(2),
        net.toFixed(2),
      ].join(',');
    });

    return [`Rapport: ${label}`, `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`, '', header, ...rows].join('\n');
  }

  function handleExportFinanciënCsv(scope: 'month' | 'year') {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const scopedEntries = financeEntries.filter((entry) => {
      const recorded = new Date(entry.recordedAt);
      if (Number.isNaN(recorded.getTime())) return false;
      if (scope === 'month') {
        return recorded.getFullYear() === year && recorded.getMonth() === month;
      }
      return recorded.getFullYear() === year;
    });

    const label =
      scope === 'month'
        ? `Maandrapport ${year}-${String(month + 1).padStart(2, '0')}`
        : `Jaaroverzicht ${year}`;
    const filename =
      scope === 'month'
        ? `finance-${year}-${String(month + 1).padStart(2, '0')}.csv`
        : `finance-${year}.csv`;

    const csv = buildFinanciënCsv(scopedEntries, label);
    triggerCsvDownload(csv, filename);
  }

  function handleExportFinanciënByLocation(scope: 'month' | 'year') {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const scopedEntries = financeEntries.filter((entry) => {
      const recorded = new Date(entry.recordedAt);
      if (Number.isNaN(recorded.getTime())) return false;
      if (scope === 'month') {
        return recorded.getFullYear() === year && recorded.getMonth() === month;
      }
      return recorded.getFullYear() === year;
    });

    const label =
      scope === 'month'
        ? `Maandrapport per locatie ${year}-${String(month + 1).padStart(2, '0')}`
        : `Jaaroverzicht per locatie ${year}`;
    const filename =
      scope === 'month'
        ? `finance-location-${year}-${String(month + 1).padStart(2, '0')}.csv`
        : `finance-location-${year}.csv`;

    const csv = buildFinanciënByLocationCsv(scopedEntries, label);
    triggerCsvDownload(csv, filename);
  }

  function buildFinanciënTextSummary() {
    const monthLabel = annualMonthLabels[now.getMonth()] ?? `${now.getMonth() + 1}`;
    const adviceLines = monthAdvice.map((item, idx) => `${idx + 1}. ${item.title}: ${item.detail}`);
    const dashboardUrl =
      Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : null;
    return [
      `Maandrapport ${monthLabel} ${now.getFullYear()}`,
      `Omzet: ${formatCurrency(monthRevenueTotal)}`,
      `Voedselkost: ${formatCurrency(monthFoodCostValue)} (${Math.round(monthFoodCostPercent)}%)`,
      `Verlies: ${formatCurrency(monthLossValue)}`,
      `Netto resultaat: ${formatCurrency(monthNetResultValue)}`,
      '',
      'Stuuradvies:',
      ...adviceLines,
      '',
      ...(dashboardUrl ? [`Live overzicht: ${dashboardUrl}`] : []),
    ].join('\n');
  }

  async function handleDownloadFinanciënPdf() {
    if (Platform.OS !== 'web') {
      Alert.alert('PDF export werkt in de webversie', 'Gebruik de webapp om een PDF te downloaden. TXT/CSV kan wel.');
      return;
    }

    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const monthLabel = annualMonthLabels[now.getMonth()] ?? `${now.getMonth() + 1}`;
      const lines = [
        `Maandrapport ${monthLabel} ${now.getFullYear()}`,
        '',
        `Omzet: ${formatCurrency(monthRevenueTotal)}`,
        `Voedselkost: ${formatCurrency(monthFoodCostValue)} (${Math.round(monthFoodCostPercent)}%)`,
        `Verlies: ${formatCurrency(monthLossValue)}`,
        `Netto resultaat: ${formatCurrency(monthNetResultValue)}`,
        '',
        'Stuuradvies:',
        ...monthAdvice.map((item, idx) => `${idx + 1}. ${item.title} - ${item.detail}`),
      ];

      doc.setFontSize(12);
      lines.forEach((line, index) => {
        doc.text(line, 14, 20 + index * 8);
      });

      doc.save(`maandrapport-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.pdf`);
    } catch {
      Alert.alert('PDF export mislukt', 'Gebruik voorlopig de TXT/CSV export. (Fout in PDF generator)');
    }
  }

  function handleDownloadFinanciënSummary() {
    const text = buildFinanciënTextSummary();
    const filename = `maandrapport-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.txt`;
    const uri = `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`;
    Linking.openURL(uri).catch(() => {});
    triggerCsvDownload(text, filename);
  }

  function handleShareWithBookkeeper() {
    const subject = encodeURIComponent(
      `Maandrapport ${annualMonthLabels[now.getMonth()]} ${now.getFullYear()} - Netto ${formatCurrency(monthNetResultValue)}`
    );
    const body = encodeURIComponent(buildFinanciënTextSummary());
    const recipient = bookkeeperEmail ? `mailto:${encodeURIComponent(bookkeeperEmail)}` : 'mailto:';
    const mailto = `${recipient}?subject=${subject}&body=${body}`;
    Linking.openURL(mailto).catch(() => {});
  }

  function handleShareWithCompany() {
    const subject = encodeURIComponent(
      `Bedrijfsrapport ${annualMonthLabels[now.getMonth()]} ${now.getFullYear()} - Netto ${formatCurrency(monthNetResultValue)}`
    );
    const body = encodeURIComponent(
      `${buildFinanciënTextSummary()}\n\nCSV/PDF staan klaar in het dashboard.`
    );
    const recipient = companyEmail ? `mailto:${encodeURIComponent(companyEmail)}` : 'mailto:';
    const mailto = `${recipient}?subject=${subject}&body=${body}`;
    Linking.openURL(mailto).catch(() => {});
  }

  function handleRunMonthlyClosing() {
    const now = new Date();
    const tag = `${now.getFullYear()}-${now.getMonth() + 1}`;
    handleShareWithBookkeeper();
    handleShareWithCompany();
    setItem('finance-last-sent-month', tag).catch(() => {});
    setMonthlyReady(false);
  }

  function handleExportAllOrdersCsv() {
    if (!companyOrderList.length) return;
    const csv = buildOrderCsv(companyOrderList);
    triggerCsvDownload(csv, 'bestelbonnen.csv');
  }

  async function handleCopyOrdersClipboard() {
    if (!companyOrderList.length) return;
    const csv = buildOrderCsv(companyOrderList);
    const ok = await copyCsvToClipboard(csv);
    if (!ok) {
      Alert.alert('Kopieren mislukt', 'Clipboard niet beschikbaar. Download de CSV en deel die.');
    }
  }

  function parseTargetNumber(value: string, fallback: number) {
    const normalized = value.trim().replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function handleSetTargetFoodCost(value: string) {
    setTargetFoodCostPercent(parseTargetNumber(value, targetFoodCostPercent));
  }

  function handleSetTargetLoss(value: string) {
    setTargetLossBudget(parseTargetNumber(value, targetLossBudget));
  }

  function handleExportLocationCsv(location: string, items: typeof companyOrderList) {
    const csv = buildOrderCsv(items);
    triggerCsvDownload(csv, `bestelbon-${location}.csv`);
  }

  function handleStartEdit(location: string) {
    setEditingLocation(location);
    setEditedLocationName(location);
  }

  function handleSaveEdit(location: string) {
    const result = renameInventoryLocation(location, editedLocationName);
    if (result.ok) {
      if (selectedLocation === location) {
        setSelectedLocation(editedLocationName.trim());
      }
      setEditingLocation(null);
      setEditedLocationName('');
      return;
    }

    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(
        result.reason === 'duplicate'
          ? 'Er bestaat al een vestiging met die naam.'
          : 'De vestigingsnaam mag niet leeg zijn.'
      );
    }
  }

  function handleRemoveLocation(location: string) {
    const confirmed =
      typeof window === 'undefined' || typeof window.confirm !== 'function'
        ? true
        : window.confirm(`${location} verwijderen als vestiging? Producten worden verplaatst.`);

    if (!confirmed) {
      return;
    }

    const result = removeInventoryLocation(location);
    if (result.ok) {
      if (selectedLocation === location) {
        setSelectedLocation('Alle vestigingen');
      }
      if (editingLocation === location) {
        setEditingLocation(null);
        setEditedLocationName('');
      }
      return;
    }

    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert('Je moet minstens 1 vestiging behouden.');
    }
  }

  function updateFinanciënForm(
    kind: FinanciënEntryKind,
    patch: Partial<FinanciënFormState[FinanciënEntryKind]>
  ) {
    setFinanciënForms((current) => ({
      ...current,
      [kind]: {
        ...current[kind],
        ...patch,
      },
    }));
  }

  function handleSaveFinanciënEntry(kind: FinanciënEntryKind) {
    const currentForm = financeForms[kind];
    const amount = parseAmountInput(currentForm.amount);

    if (!(amount > 0)) {
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(`Geef een geldig bedrag in voor ${financeEntryLabels[kind].toLowerCase()}.`);
      }
      return;
    }

    addFinanciënEntry({
      kind,
      period: currentForm.period,
      amount,
      note: currentForm.note.trim(),
      location: selectedLocation === 'Alle vestigingen' ? null : selectedLocation,
    });

    setFinanciënForms((current) => ({
      ...current,
      [kind]: {
        ...current[kind],
        amount: '',
        note: '',
      },
    }));
  }

  function handleRemoveFinanciënEntry(entry: FinanciënEntry) {
    const confirmed =
      typeof window === 'undefined' || typeof window.confirm !== 'function'
        ? true
        : window.confirm(`${financeEntryLabels[entry.kind]} van ${formatCurrency(entry.amount)} verwijderen?`);

    if (confirmed) {
      removeFinanciënEntry(entry.id);
    }
  }

  function getSuggestedOrderForItem(item: (typeof visibleItems)[number]) {
    return Math.max(getReorderThreshold(item.category) + 1 - item.quantity, 1);
  }

  function handleMarkOrdered(item: (typeof visibleItems)[number]) {
    const delta = getSuggestedOrderForItem(item);
    updateInventoryQuantity(item.id, delta);
    setOrderedToday((current) => (current.includes(item.id) ? current : [...current, item.id]));
  }

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#e8f5f2', dark: '#172033' }}
      headerImage={
        <View style={styles.headerWrap}>
          <View style={styles.headerCircle}>
            <IconSymbol size={98} color="#0f766e" name="chart.bar.fill" />
          </View>
          <View style={styles.headerBadge}>
            <ThemedText type="defaultSemiBold" style={styles.headerBadgeText}>
              Stockhub
            </ThemedText>
            <ThemedText style={styles.headerBadgeSubtext}>
              {items.length ? `${items.length} producten live in stock` : 'Klaar voor eerste opslag'}
            </ThemedText>
          </View>
        </View>
      }>
      <ThemedView style={styles.intro}>
        <View style={styles.introBrandRow}>
          <View style={styles.introLogoFrame}>
            <TazeLogo size={72} framed={false} />
          </View>
          <View style={styles.introBrandCopy}>
            <ThemedText style={styles.manifestEyebrow}>{tazeManifest.eyebrow}</ThemedText>
            <ThemedText type="title">{tazeManifest.title}</ThemedText>
            <ThemedText type="subtitle">{tazeManifest.subtitle}</ThemedText>
            {tazeManifest.paragraphs.map((paragraph) => (
              <ThemedText key={paragraph} style={styles.manifestParagraph}>
                {paragraph}
              </ThemedText>
            ))}
            <View style={styles.manifestPillRow}>
              {tazeManifest.pillars.map((pillar) => (
                <View key={pillar} style={styles.manifestPill}>
                  <ThemedText type="defaultSemiBold" style={styles.manifestPillText}>
                    {pillar}
                  </ThemedText>
                </View>
              ))}
            </View>
            <ThemedText type="defaultSemiBold" style={styles.manifestClosing}>
              {tazeManifest.closing}
            </ThemedText>
          </View>
        </View>
      </ThemedView>

      <Pressable
        style={[
          styles.liveHighlightBar,
          metrics.expiringSoon > 0 ? styles.liveHighlightCritical : styles.liveHighlightStable,
        ]}
        onPress={() => router.push(metrics.expiringSoon > 0 ? ('/alerts' as Href) : ('/explore' as Href))}>
        <View style={styles.liveHighlightMain}>
          <View
            style={[
              styles.liveHighlightDot,
              metrics.expiringSoon > 0 ? styles.liveHighlightDotCritical : null,
            ]}
          />
          <View style={styles.liveHighlightTextWrap}>
            <ThemedText type="defaultSemiBold">Direct aandacht</ThemedText>
            <ThemedText style={styles.liveHighlightText}>
              {metrics.expiringSoon > 0
                ? `${metrics.expiringSoon} product(en) vragen vandaag actie.`
                : `${metrics.totalProducts} product(en) lopen mee in de huidige flow.`}
            </ThemedText>
          </View>
        </View>
        <View style={styles.liveHighlightCta}>
          <ThemedText type="defaultSemiBold" style={styles.liveHighlightCtaText}>
            {metrics.expiringSoon > 0 ? 'Bekijk wat opraakt' : 'Open cockpit'}
          </ThemedText>
        </View>
      </Pressable>

      <ThemedView style={styles.audiencePanel}>
        <View style={styles.audienceHeader}>
          <View style={styles.audienceCopy}>
            <ThemedText type="subtitle">{currentAudience.title}</ThemedText>
            <ThemedText>{currentAudience.body}</ThemedText>
          </View>
          <View style={styles.audienceSwitchRow}>
            {(['Restaurant', 'Bedrijf'] as Audience[]).map((option) => {
              const active = option === audience;

              return (
                <Pressable
                  key={option}
                  style={[styles.audienceChip, active && styles.audienceChipActive]}
                  onPress={() => setAudience(option)}>
                  <ThemedText
                    type="defaultSemiBold"
                    style={active ? styles.audienceChipTextActive : styles.audienceChipText}>
                    {option}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.audienceActions}>
          <Pressable style={styles.primaryAction} onPress={() => router.push('/scan')}>
            <ThemedText type="defaultSemiBold" style={styles.primaryActionText}>
              {currentAudience.primaryAction}
            </ThemedText>
          </Pressable>
          <Pressable
            style={styles.secondaryAction}
            onPress={() => router.push(audience === 'Restaurant' ? '/alerts' : '/partners')}>
            <ThemedText type="defaultSemiBold" style={styles.secondaryActionText}>
              {currentAudience.secondaryAction}
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>

      <ThemedView style={styles.metricGrid}>
        <MetricCard label="Producten" value={`${metrics.totalProducts}`} tone="#0f766e" />
        <MetricCard label="Stuks in stock" value={`${metrics.totalUnits}`} tone="#1d4ed8" />
        <MetricCard label="Gem. herkenning" value={formatConfidence(metrics.averageConfidence)} tone="#7c3aed" />
      </ThemedView>

      <StockhubCamera
        locations={locations}
        defaultLocation={selectedLocation === 'Alle vestigingen' ? locations[0] ?? null : selectedLocation}
      />

      <ThemedView style={styles.livePanel}>
        <View style={styles.liveHeader}>
          <View style={styles.liveCopy}>
            <ThemedText type="subtitle">Live stock per locatie</ThemedText>
            <ThemedText>
              Wat weg is, wat rest en wat bijbesteld moet worden. Tik op een kaart om te filteren.
            </ThemedText>
          </View>
          <Pressable style={styles.liveAction} onPress={() => router.push('/alerts')}>
            <ThemedText type="defaultSemiBold" style={styles.liveActionText}>
              Bekijk wat opraakt
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.liveGrid}>
          {liveLocationSnapshots.map((snapshot) => (
            <Pressable
              key={snapshot.location}
              style={[
                styles.liveCard,
                { borderColor: snapshot.tone, backgroundColor: snapshot.surface },
                snapshot.location === selectedLocation ? styles.liveCardActive : null,
              ]}
              onPress={() => setSelectedLocation(snapshot.location)}>
              <View style={styles.liveCardTopRow}>
                <ThemedText type="defaultSemiBold" style={styles.liveCardTitle}>
                  {snapshot.location}
                </ThemedText>
                <ThemedText style={styles.liveCardMeta}>
                  {snapshot.soldUnitsToday > 0 ? `${snapshot.soldUnitsToday} weg vandaag` : 'Geen weg vandaag'}
                </ThemedText>
              </View>

              <View style={[styles.liveCardCountBadge, { borderColor: snapshot.tone, backgroundColor: snapshot.surface }]}>
                <ThemedText style={styles.liveCardCountLabel}>Totaal in vestiging</ThemedText>
                <ThemedText
                  type="defaultSemiBold"
                  style={[
                    styles.liveCardCountValue,
                    { color: snapshot.stockUnits > 0 ? '#0f766e' : '#0f172a' },
                  ]}>
                  {snapshot.stockUnits}
                </ThemedText>
                <ThemedText style={styles.liveCardCountMeta}>{snapshot.stockProducts} producten live</ThemedText>
              </View>

              <View style={styles.liveMetricsRow}>
                <View style={styles.liveMetricChip}>
                  <ThemedText style={styles.liveMetricLabel}>Op voorraad</ThemedText>
                  <ThemedText type="defaultSemiBold">{snapshot.stockUnits} st.</ThemedText>
                  <ThemedText style={styles.liveMetricMeta}>{snapshot.stockProducts} producten</ThemedText>
                </View>
                <View style={styles.liveMetricChip}>
                  <ThemedText style={styles.liveMetricLabel}>Bijbestellen</ThemedText>
                  <ThemedText type="defaultSemiBold">{snapshot.lowStockCount}</ThemedText>
                  <ThemedText style={styles.liveMetricMeta}>
                    {snapshot.lowStockCount > 0 ? snapshot.topReorder.join(', ') : 'Stabiel'}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.liveMetricsRow}>
                <View style={styles.liveMetricChip}>
                  <ThemedText style={styles.liveMetricLabel}>Verval (max 2d)</ThemedText>
                  <ThemedText type="defaultSemiBold">{snapshot.expiringCount}</ThemedText>
                  <ThemedText style={styles.liveMetricMeta}>
                    {snapshot.expiringCount > 0 ? 'Verspillingsrisico' : 'Rustig'}
                  </ThemedText>
                </View>
                <View style={styles.liveMetricChip}>
                  <ThemedText style={styles.liveMetricLabel}>Omzet vandaag</ThemedText>
                  <ThemedText type="defaultSemiBold">{formatCurrency(snapshot.revenueToday || snapshot.soldRevenueToday)}</ThemedText>
                  <ThemedText style={styles.liveMetricMeta}>
                    {snapshot.lossToday > 0 ? `verlies ${formatCurrency(snapshot.lossToday)}` : 'Financiën live'}
                  </ThemedText>
                </View>
              </View>

              {snapshot.soldRevenueToday > 0 && snapshot.revenueToday === 0 ? (
                <Pressable
                  style={[styles.liveLinkButton, { borderColor: snapshot.tone }]}
                  onPress={() => {
                    addFinanciënEntry({
                      kind: 'revenue',
                      period: 'day',
                      amount: Math.max(1, Math.round(snapshot.soldRevenueToday)),
                      note: `Koppeling kassaverkoop (live) - ${snapshot.location}`,
                      location: snapshot.location === 'Alle vestigingen' ? null : snapshot.location,
                    });
                  }}>
                  <ThemedText type="defaultSemiBold" style={[styles.liveLinkButtonText, { color: snapshot.tone }]}>
                    Koppel omzet vandaag
                  </ThemedText>
                </Pressable>
              ) : null}
            </Pressable>
          ))}
        </View>

        <ThemedText style={styles.liveFooter}>
          Laatste update: {lastSavedAt ? new Date(lastSavedAt).toLocaleString('nl-BE') : 'nog geen opslag'}.
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.commandPanel}>
        <View style={styles.commandHeader}>
          <View style={styles.commandCopy}>
            <ThemedText type="subtitle">Slimme cockpit</ThemedText>
            <ThemedText>
              Deze laag kijkt naar voorraad, vestigingen, herkenning en financien en zet de slimste volgende stap klaar.
            </ThemedText>
          </View>
          <View style={[styles.commandScoreBadge, { backgroundColor: insightPrimaryAction.surface, borderColor: insightPrimaryAction.tone }]}>
            <ThemedText type="defaultSemiBold" style={[styles.commandScoreValue, { color: insightPrimaryAction.tone }]}>
              {insightHealthScore}%
            </ThemedText>
            <ThemedText style={styles.commandScoreLabel}>Inzichtscore</ThemedText>
          </View>
        </View>

        <View style={[styles.commandPrimaryCard, { borderColor: insightPrimaryAction.tone, backgroundColor: insightPrimaryAction.surface }]}>
          <View style={styles.commandPrimaryCopy}>
            <ThemedText type="defaultSemiBold">{insightPrimaryAction.title}</ThemedText>
            <ThemedText>{insightPrimaryAction.detail}</ThemedText>
          </View>
          <Pressable
            style={[styles.commandPrimaryButton, { backgroundColor: insightPrimaryAction.tone }]}
            onPress={() => router.push(insightPrimaryAction.href)}>
            <ThemedText type="defaultSemiBold" style={styles.commandPrimaryButtonText}>
              {insightPrimaryAction.cta}
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.commandDriverRow}>
          {insightDrivers.map((driver) => (
            <Pressable key={driver.label} style={styles.commandDriverCard} onPress={() => router.push(driver.href)}>
              <ThemedText style={styles.commandDriverLabel}>{driver.label}</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.commandDriverValue}>
                {driver.value}
              </ThemedText>
              <ThemedText style={styles.commandDriverDetail}>{driver.detail}</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.commandDriverCta}>
                {getRouteCtaLabel(driver.href)}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <View style={styles.commandLocationRow}>
          {locationRecommendations.map((location) => (
            <Pressable
              key={location.location}
              style={[styles.commandLocationCard, { borderColor: location.tone, backgroundColor: location.surface }]}
              onPress={() => router.push(location.href)}>
              <View style={[styles.commandLocationBadge, { borderColor: location.tone, backgroundColor: '#ffffff' }]}>
                <ThemedText style={styles.commandLocationBadgeLabel}>In deze vestiging</ThemedText>
                <ThemedText type="defaultSemiBold" style={[styles.commandLocationValue, { color: location.tone }]}>
                  {location.quantity}
                </ThemedText>
                <ThemedText style={styles.commandLocationBadgeMeta}>stuks live</ThemedText>
              </View>
              <ThemedText type="defaultSemiBold">{location.location}</ThemedText>
              <ThemedText>{location.action}</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.inlineCardCta}>
                {getRouteCtaLabel(location.href)}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <RealAiCopilotPanel
          title="Echte AI op voorraad en financien"
          hint="Laat een echt model meekijken naar je live score, vestigingen, voedselkost en directe vervolgstap."
          buttonLabel="Vraag insight-AI"
          loading={realAiState === 'loading'}
          onAsk={() => askExploreAi().catch(() => {})}
          result={realAiAnswer}
          error={realAiError || null}
          onApplyAction={applyExploreAiAction}
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
                  label: 'Transporthub geopend via explore-AI',
                }).catch(() => {});
              }
              router.push(
                buildTransportHubPath({
                  region: 'Europa',
                  useCase: audience === 'Bedrijf' ? 'Zakelijk' : 'Delivery',
                  partnerId: exploreTransportFocus.recommendedPartner?.id ?? null,
                  source: 'explore',
                  auditId: realAiAnswer?.auditId ?? null,
                }) as Href
              );
              return;
            }
            router.push(route as Href);
          }}
        />
      </ThemedView>

      <ThemedView style={styles.recommendationPanel}>
        <ThemedText type="subtitle">Aanbevolen acties</ThemedText>
        {recommendations.map((item, index) => (
          <Pressable key={item.title} style={styles.recommendationRow} onPress={() => router.push(item.href)}>
            <View style={styles.recommendationIndex}>
              <ThemedText type="defaultSemiBold" style={styles.recommendationIndexText}>
                {index + 1}
              </ThemedText>
            </View>
            <View style={styles.recommendationText}>
              <ThemedText type="defaultSemiBold">{item.title}</ThemedText>
              <ThemedText>{item.detail}</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.inlineCardCta}>
                {getRouteCtaLabel(item.href)}
              </ThemedText>
            </View>
          </Pressable>
        ))}
      </ThemedView>

      {monthlyReady ? (
        <View style={styles.monthlyBanner}>
          <ThemedText type="defaultSemiBold">Maandafsluiting klaar</ThemedText>
          <ThemedText>
            Het is de 1e van de maand. Verstuur nu automatisch PDF/TXT/CSV naar boekhouder en management.
          </ThemedText>
          <Pressable style={styles.monthlyButton} onPress={handleRunMonthlyClosing}>
            <ThemedText type="defaultSemiBold" style={styles.monthlyButtonText}>
              Verstuur maandrapport nu
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      <ThemedView style={styles.smartSignalsPanel}>
        <ThemedText type="subtitle">Slimme sturing</ThemedText>
        <View style={styles.smartSignalsGrid}>
          {smartSignals.map((signal) => (
            <Pressable
              key={signal.title}
              style={[styles.smartSignalCard, { borderColor: signal.tone, backgroundColor: signal.surface }]}
              onPress={() => router.push(signal.href)}>
              <ThemedText type="defaultSemiBold">{signal.title}</ThemedText>
              <ThemedText>{signal.detail}</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.inlineCardCta}>
                {getRouteCtaLabel(signal.href)}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </ThemedView>

      <ThemedView style={styles.suggestionPanel}>
        <View style={styles.suggestionHeader}>
          <ThemedText type="subtitle">Suggesties vandaag</ThemedText>
          {dailySuggestions.length ? (
            <Pressable style={styles.suggestionExport} onPress={handleExportAllOrdersCsv}>
              <ThemedText type="defaultSemiBold" style={styles.suggestionExportText}>
                Exporteer bestellijst (CSV)
              </ThemedText>
            </Pressable>
          ) : null}
          {dailySuggestions.length ? (
            <Pressable style={styles.suggestionExport} onPress={handleCopyOrdersClipboard}>
              <ThemedText type="defaultSemiBold" style={styles.suggestionExportText}>
                Kopieer voor bestellingen
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
        {dailySuggestions.length ? (
          <View style={styles.suggestionList}>
            {dailySuggestions.map((item) => (
              <View key={item.id} style={styles.suggestionCard}>
                <View style={styles.suggestionCopy}>
                  <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                  <ThemedText style={styles.suggestionMeta}>
                    {item.category} - {item.quantity} stuks in {item.location}
                  </ThemedText>
                  <ThemedText style={styles.suggestionDetail}>
                    Bestel +{item.suggestedOrder} om drempel te halen.
                  </ThemedText>
                </View>
                <Pressable
                  disabled={item.isDone}
                  style={[
                    styles.suggestionAction,
                    item.isDone ? styles.suggestionActionDone : styles.suggestionActionActive,
                  ]}
                  onPress={() => handleMarkOrdered(item)}>
                  <ThemedText
                    type="defaultSemiBold"
                    style={item.isDone ? styles.suggestionActionTextDone : styles.suggestionActionText}>
                    {item.isDone ? 'Gemarkeerd' : 'Markeer als besteld'}
                  </ThemedText>
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <ThemedText>Geen lage stock vandaag. Alles staat stabiel.</ThemedText>
        )}
      </ThemedView>

      {audience === 'Bedrijf' ? (
        <>
          <ThemedView style={styles.businessCommandPanel}>
            <View style={styles.businessCommandHeader}>
              <View style={styles.businessCommandCopy}>
                <ThemedText type="subtitle">Bedrijfscommandocentrum</ThemedText>
                <ThemedText>
                  Dit blok vertaalt voorraad, vestigingen, bestellingen en financien naar de slimste partner- en aankoopstappen.
                </ThemedText>
              </View>
            </View>

            <View style={styles.businessCommandSignalRow}>
              {companyOperatingSignals.map((signal) => (
                <Pressable
                  key={signal.label}
                  style={styles.businessCommandSignalCard}
                  onPress={() => router.push(signal.href)}>
                  <ThemedText style={styles.businessCommandSignalLabel}>{signal.label}</ThemedText>
                  <ThemedText type="defaultSemiBold" style={styles.businessCommandSignalValue}>
                    {signal.value}
                  </ThemedText>
                  <ThemedText style={styles.businessCommandSignalDetail}>{signal.detail}</ThemedText>
                  <ThemedText type="defaultSemiBold" style={styles.inlineCardCta}>
                    {getRouteCtaLabel(signal.href)}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <View style={styles.businessCommandActionRow}>
              {businessPartnerAdvice.map((action) => (
                <Pressable
                  key={action.title}
                  style={[
                    styles.businessCommandActionCard,
                    { borderColor: action.tone, backgroundColor: action.surface },
                  ]}
                  onPress={() => router.push(action.href)}>
                  <ThemedText type="defaultSemiBold">{action.title}</ThemedText>
                  <ThemedText>{action.detail}</ThemedText>
                  <View style={[styles.businessCommandActionButton, { backgroundColor: action.tone }]}>
                    <ThemedText type="defaultSemiBold" style={styles.businessCommandActionButtonText}>
                      {action.cta}
                    </ThemedText>
                  </View>
                </Pressable>
              ))}
            </View>
          </ThemedView>

          <ThemedView style={styles.financePanel}>
            <View style={styles.financeHeader}>
              <ThemedText type="subtitle">Live winst/verlies tegenover omzet</ThemedText>
              <ThemedText>
                Werk hier met echte historische registraties per dag, week, maand, kwartaal of jaar.
                De grafiek en de metrics hieronder rekenen alleen nog met opgeslagen cijfers.
              </ThemedText>
            </View>

            <View style={styles.financeInputGrid}>
              {(['revenue', 'food_cost', 'loss'] as FinanciënEntryKind[]).map((kind) => (
                <FinanciënFormCard
                  key={kind}
                  title={financeEntryLabels[kind]}
                  description={financeEntryDescriptions[kind]}
                  amount={financeForms[kind].amount}
                  note={financeForms[kind].note}
                  period={financeForms[kind].period}
                  onAmountChange={(value) => updateFinanciënForm(kind, { amount: value })}
                  onNoteChange={(value) => updateFinanciënForm(kind, { note: value })}
                  onPeriodChange={(value) => updateFinanciënForm(kind, { period: value })}
                  onSave={() => handleSaveFinanciënEntry(kind)}
                />
              ))}
            </View>

            <View style={styles.financeGrid}>
              {financeSummaryCards.map((card) => (
                <Pressable key={card.title} style={styles.financeCard} onPress={() => router.push(card.href)}>
                  <ThemedText type="defaultSemiBold">{card.title}</ThemedText>
                  <ThemedText style={styles.financeValue}>{card.value}</ThemedText>
                  <ThemedText style={[styles.financeMeta, card.warn ? styles.financeMetaWarning : null]}>
                    {card.meta}
                  </ThemedText>
                  <ThemedText type="defaultSemiBold" style={styles.inlineCardCta}>
                    {getRouteCtaLabel(card.href)}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <View style={styles.financeQuickRow}>
              <Pressable style={styles.financeQuickButton} onPress={handleLinkRevenue}>
                <MaterialIcons name="sync" size={18} color="#0f766e" />
                <View style={styles.financeQuickText}>
                  <ThemedText type="defaultSemiBold">Koppel omzet aan kassa</ThemedText>
                  <ThemedText style={styles.financeMeta}>
                    Haal laatste kassaverkoop binnen. Al gekoppeld: {formatCurrency(totalRecordedRevenue)}.
                  </ThemedText>
                </View>
              </Pressable>

              <Pressable style={styles.financeQuickButton} onPress={handleRegisterLoss}>
                <MaterialIcons name="do-not-disturb" size={18} color="#dc2626" />
            <View style={styles.financeQuickText}>
              <ThemedText type="defaultSemiBold">Boek verlies</ThemedText>
              <ThemedText style={styles.financeMeta}>
                Registreer verlies op basis van Weg/Rest.
              </ThemedText>
            </View>
          </Pressable>
        </View>

        <View style={styles.financeExportRow}>
          <Pressable style={styles.financeExportButton} onPress={() => handleExportFinanciënCsv('month')}>
            <MaterialIcons name="file-download" size={18} color="#0f172a" />
            <ThemedText type="defaultSemiBold" style={styles.financeExportText}>
              Exporteer maandrapport (CSV)
            </ThemedText>
          </Pressable>
          <Pressable style={styles.financeExportButton} onPress={() => handleExportFinanciënCsv('year')}>
            <MaterialIcons name="file-download" size={18} color="#0f172a" />
            <ThemedText type="defaultSemiBold" style={styles.financeExportText}>
              Exporteer jaaroverzicht (CSV)
            </ThemedText>
          </Pressable>
          <Pressable style={styles.financeExportButton} onPress={() => handleExportFinanciënByLocation('month')}>
            <MaterialIcons name="file-download" size={18} color="#0f172a" />
            <ThemedText type="defaultSemiBold" style={styles.financeExportText}>
              Maand per vestiging (CSV)
            </ThemedText>
          </Pressable>
          <Pressable style={styles.financeExportButton} onPress={() => handleExportFinanciënByLocation('year')}>
            <MaterialIcons name="file-download" size={18} color="#0f172a" />
            <ThemedText type="defaultSemiBold" style={styles.financeExportText}>
              Jaar per vestiging (CSV)
            </ThemedText>
          </Pressable>
          <Pressable style={styles.financeExportButton} onPress={handleDownloadFinanciënPdf}>
            <MaterialIcons name="picture-as-pdf" size={18} color="#0f172a" />
            <ThemedText type="defaultSemiBold" style={styles.financeExportText}>
              Download maandrapport (PDF)
            </ThemedText>
          </Pressable>
          <Pressable style={styles.financeExportButton} onPress={handleDownloadFinanciënSummary}>
            <MaterialIcons name="description" size={18} color="#0f172a" />
            <ThemedText type="defaultSemiBold" style={styles.financeExportText}>
              Download maandrapport (TXT)
            </ThemedText>
          </Pressable>
          <Pressable style={styles.financeExportButton} onPress={handleShareWithBookkeeper}>
            <MaterialIcons name="send" size={18} color="#0f172a" />
            <ThemedText type="defaultSemiBold" style={styles.financeExportText}>
              Deel met boekhouder
            </ThemedText>
          </Pressable>
          <Pressable style={styles.financeExportButton} onPress={handleShareWithCompany}>
            <MaterialIcons name="email" size={18} color="#0f172a" />
            <ThemedText type="defaultSemiBold" style={styles.financeExportText}>
              Deel met bedrijf
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.recipientRow}>
          <View style={styles.recipientCard}>
            <ThemedText style={styles.recipientLabel}>E-mail boekhouder</ThemedText>
            <TextInput
              value={bookkeeperEmail}
              onChangeText={setBookkeeperEmail}
              style={styles.recipientInput}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          <View style={styles.recipientCard}>
            <ThemedText style={styles.recipientLabel}>E-mail bedrijf/management</ThemedText>
            <TextInput
              value={companyEmail}
              onChangeText={setCompanyEmail}
              style={styles.recipientInput}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>

        <ThemedView style={styles.savingsPanel}>
          <ThemedText type="subtitle">Besparingscockpit</ThemedText>
          <ThemedText>
            Stel je doelen voor voedselkost en verlies. We schatten direct de potentiele besparing op basis van de huidige maand.
          </ThemedText>

          <View style={styles.savingsInputRow}>
            <View style={styles.savingsInputCard}>
              <ThemedText style={styles.savingsLabel}>Doel voedselkost %</ThemedText>
              <TextInput
                value={String(targetFoodCostPercent)}
                onChangeText={handleSetTargetFoodCost}
                keyboardType="numeric"
                style={styles.savingsInput}
              />
            </View>
            <View style={styles.savingsInputCard}>
              <ThemedText style={styles.savingsLabel}>Verliesbudget (EUR)</ThemedText>
              <TextInput
                value={String(targetLossBudget)}
                onChangeText={handleSetTargetLoss}
                keyboardType="numeric"
                style={styles.savingsInput}
              />
            </View>
          </View>

          <View style={styles.savingsGrid}>
            {savingsSummaryCards.map((card) => (
              <Pressable key={card.label} style={styles.savingsCard} onPress={() => router.push(card.href)}>
                <ThemedText style={styles.savingsLabel}>{card.label}</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.savingsValue}>
                  {card.value}
                </ThemedText>
                <ThemedText style={styles.savingsMeta}>{card.meta}</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.inlineCardCta}>
                  {getRouteCtaLabel(card.href)}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <View style={styles.savingsActionRow}>
            <Pressable style={styles.savingsActionButton} onPress={() => router.push('/alerts')}>
              <ThemedText type="defaultSemiBold" style={styles.savingsActionText}>
                Pak verval en verspilling eerst aan
              </ThemedText>
            </Pressable>
            <Pressable style={styles.savingsActionButton} onPress={() => router.push('/explore')}>
              <ThemedText type="defaultSemiBold" style={styles.savingsActionText}>
                Optimaliseer bijbestellingen
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>

        <View style={styles.financeMonthlyPanel}>
          <View style={styles.financeMonthlyRow}>
            {financeMonthlyCards.map((card) => (
              <Pressable key={card.title} style={styles.financeMonthlyCard} onPress={() => router.push(card.href)}>
                <ThemedText type="defaultSemiBold">{card.title}</ThemedText>
                <ThemedText style={styles.financeValue}>{card.value}</ThemedText>
                <ThemedText style={[styles.financeMeta, card.warn ? styles.financeMetaWarning : null]}>
                  {card.meta}
                </ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.inlineCardCta}>
                  {getRouteCtaLabel(card.href)}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <View style={styles.financeAdviceRow}>
            {monthAdvice.map((item) => (
              <Pressable
                key={item.title}
                style={[styles.financeAdviceCard, { borderColor: item.tone, backgroundColor: '#f8fafc' }]}
                onPress={() => router.push(item.href)}>
                <ThemedText type="defaultSemiBold" style={{ color: item.tone }}>
                  {item.title}
                </ThemedText>
                <ThemedText>{item.detail}</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.inlineCardCta}>
                  {getRouteCtaLabel(item.href)}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.chartPanel}>
          <View style={styles.chartHeader}>
            <ThemedText type="defaultSemiBold">Jaaroverzicht {currentYear}</ThemedText>
                <ThemedText style={styles.chartHeaderText}>
                  Historische cijfers op basis van opgeslagen omzet, voedselkost en live verlies.
                </ThemedText>
              </View>

              <View style={styles.chartLegend}>
                <LegendItem label="Omzet" color="#0f766e" />
                <LegendItem label="Voedselkost" color="#f59e0b" />
                <LegendItem label="Verlies" color="#dc2626" />
              </View>

              {hasAnnualOverviewData ? (
                <View style={styles.chartGrid}>
                  {annualOverviewData.map((month) => (
                    <View key={month.label} style={styles.chartMonth}>
                      <View style={styles.chartBars}>
                        <View
                          style={[
                            styles.chartBar,
                            styles.chartBarRevenue,
                            { height: `${(month.revenue / annualOverviewMax) * 100}%` },
                          ]}
                        />
                        <View
                          style={[
                            styles.chartBar,
                            styles.chartBarFoodCost,
                            { height: `${(month.foodCost / annualOverviewMax) * 100}%` },
                          ]}
                        />
                        <View
                          style={[
                            styles.chartBar,
                            styles.chartBarLoss,
                            { height: `${(month.loss / annualOverviewMax) * 100}%` },
                          ]}
                        />
                      </View>
                      <ThemedText style={styles.chartMonthLabel}>{month.label}</ThemedText>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.financeEmptyState}>
                  <ThemedText type="defaultSemiBold">Nog geen historische cijfers</ThemedText>
                  <ThemedText>
                    Voeg hierboven je eerste dag-, week- of maandregistraties toe om de jaartrend op te
                    bouwen.
                  </ThemedText>
                </View>
              )}
            </View>

            <View style={styles.financeHistory}>
              <View style={styles.chartHeader}>
                <ThemedText type="defaultSemiBold">Laatste registraties</ThemedText>
                <ThemedText style={styles.chartHeaderText}>
                  Hier corrigeer je snel een foutieve omzet-, voedselkost- of verliesboeking.
                </ThemedText>
              </View>

              {recentFinanciënEntries.length ? (
                recentFinanciënEntries.map((entry) => (
                  <FinanciënHistoryRow
                    key={entry.id}
                    entry={entry}
                    onRemove={() => handleRemoveFinanciënEntry(entry)}
                  />
                ))
              ) : (
                <ThemedText style={styles.financeMeta}>
                  Nog geen registraties zichtbaar voor deze selectie.
                </ThemedText>
              )}
            </View>
          </ThemedView>

          <ThemedView style={styles.bucketPanel}>
            <View style={styles.bucketHeader}>
              <ThemedText type="subtitle">Voedselkost en dranken</ThemedText>
              <ThemedText>
                Voor bedrijven staan voedselkost en dranken nu apart zodat voorraad en bestellingen niet
                door elkaar lopen.
              </ThemedText>
            </View>

            <View style={styles.bucketGrid}>
              {bucketSummaryCards.map((card) => (
                <Pressable key={card.title} style={styles.bucketCard} onPress={() => router.push(card.href)}>
                  <ThemedText type="defaultSemiBold">{card.title}</ThemedText>
                  <ThemedText style={styles.bucketValue}>{card.value}</ThemedText>
                  <ThemedText>{card.detail}</ThemedText>
                  <ThemedText type="defaultSemiBold" style={styles.inlineCardCta}>
                    {getRouteCtaLabel(card.href)}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </ThemedView>

          <ThemedView style={styles.companyPanel}>
            <View style={styles.companyHeader}>
              <ThemedText type="subtitle">Bedrijfsopvolging</ThemedText>
              <ThemedText>
                Zie direct wat nog in stock is, wat moet worden bijbesteld en welke producten over datum
                komen.
              </ThemedText>
            </View>

            <View style={styles.companyLivePanel}>
              <View
                style={[
                  styles.companyLivePrimaryCard,
                  { borderColor: liveBusinessAction.tone, backgroundColor: liveBusinessAction.surface },
                ]}>
                <View style={styles.companyLivePrimaryCopy}>
                  <ThemedText type="defaultSemiBold">{liveBusinessAction.title}</ThemedText>
                  <ThemedText>{liveBusinessAction.detail}</ThemedText>
                </View>
                <Pressable
                  style={[styles.companyLivePrimaryButton, { backgroundColor: liveBusinessAction.tone }]}
                  onPress={() => router.push(liveBusinessAction.href)}>
                  <ThemedText type="defaultSemiBold" style={styles.companyLivePrimaryButtonText}>
                    {liveBusinessAction.cta}
                  </ThemedText>
                </Pressable>
              </View>

              <View style={styles.companyLiveSignalRow}>
                {liveBusinessSignals.map((signal) => (
                  <Pressable
                    key={signal.label}
                    style={styles.companyLiveSignalCard}
                    onPress={() => router.push(signal.href)}>
                    <ThemedText style={styles.companyLiveSignalLabel}>{signal.label}</ThemedText>
                    <ThemedText type="defaultSemiBold" style={styles.companyLiveSignalValue}>
                      {signal.value}
                    </ThemedText>
                    <ThemedText style={styles.companyLiveSignalDetail}>{signal.detail}</ThemedText>
                    <ThemedText type="defaultSemiBold" style={styles.inlineCardCta}>
                      {getRouteCtaLabel(signal.href)}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.companyGrid}>
              <Pressable style={styles.companyCard} onPress={() => router.push('/scan')}>
                <ThemedText type="defaultSemiBold">Nog in stock</ThemedText>
                {companyAvailableItems.length ? (
                  companyAvailableItems.map((item) => (
                    <View key={`stock-${item.id}`} style={styles.companyRow}>
                      <View style={styles.companyRowText}>
                        <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                        <ThemedText style={styles.companyMeta}>{item.location}</ThemedText>
                      </View>
                      <ThemedText>{item.quantity} stuks</ThemedText>
                    </View>
                  ))
                ) : (
                  <ThemedText>Nog geen beschikbare stock in deze filter.</ThemedText>
                )}
                <ThemedText type="defaultSemiBold" style={styles.inlineCardCta}>
                  {getRouteCtaLabel('/scan' as Href)}
                </ThemedText>
              </Pressable>

              <Pressable style={styles.companyCard} onPress={() => router.push('/explore')}>
                <ThemedText type="defaultSemiBold">Bijbestellen</ThemedText>
                {companyReorderItems.length ? (
                  companyReorderItems.map((item) => (
                    <View key={`reorder-${item.id}`} style={styles.companyRow}>
                      <View style={styles.companyRowText}>
                        <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                        <ThemedText style={styles.companyMeta}>
                          {item.quantity} stuks resterend in {item.location}
                        </ThemedText>
                      </View>
                      <ThemedText style={styles.companyWarning}>Bestellen</ThemedText>
                    </View>
                  ))
                ) : (
                  <ThemedText>Er zijn momenteel geen producten met direct bijbesteladvies.</ThemedText>
                )}
                <ThemedText type="defaultSemiBold" style={styles.inlineCardCta}>
                  {getRouteCtaLabel('/explore' as Href)}
                </ThemedText>
              </Pressable>

              <Pressable style={styles.companyCard} onPress={() => router.push('/alerts')}>
                <ThemedText type="defaultSemiBold">Vervalrisico</ThemedText>
                {companyExpiredItems.length ? (
                  companyExpiredItems.map((item) => (
                    <View key={`expired-${item.id}`} style={styles.companyRow}>
                      <View style={styles.companyRowText}>
                        <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                        <ThemedText style={styles.companyMeta}>{item.location}</ThemedText>
                      </View>
                      <ThemedText style={styles.companyDanger}>Over datum</ThemedText>
                    </View>
                  ))
                ) : companyExpiringItems.length ? (
                  companyExpiringItems.map((item) => (
                    <View key={`expiring-${item.id}`} style={styles.companyRow}>
                      <View style={styles.companyRowText}>
                        <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                        <ThemedText style={styles.companyMeta}>{item.location}</ThemedText>
                      </View>
                      <ThemedText style={styles.companyWarning}>{formatExpiryLabel(item.expiryDays)}</ThemedText>
                    </View>
                  ))
                ) : (
                  <ThemedText>Geen producten met direct vervalrisico in deze selectie.</ThemedText>
                )}
                <ThemedText type="defaultSemiBold" style={styles.inlineCardCta}>
                  {getRouteCtaLabel('/alerts' as Href)}
                </ThemedText>
              </Pressable>

              <Pressable style={styles.companyCard} onPress={() => router.push('/trace')}>
                <ThemedText type="defaultSemiBold">Live weg en rest</ThemedText>
                <View style={styles.liveFlowSummary}>
                  <View style={styles.liveFlowMetric}>
                    <ThemedText style={styles.liveFlowLabel}>Rest</ThemedText>
                    <ThemedText type="defaultSemiBold" style={styles.liveFlowValue}>
                      {companyRemainingUnits} stuks
                    </ThemedText>
                  </View>
                  <View style={styles.liveFlowMetric}>
                    <ThemedText style={styles.liveFlowLabel}>Weg</ThemedText>
                    <ThemedText type="defaultSemiBold" style={styles.liveFlowDanger}>
                      {companyEstimatedGoneUnits} stuks
                    </ThemedText>
                  </View>
                </View>

                {companyLiveFlow.slice(0, 5).map((item) => (
                  <View key={`flow-${item.id}`} style={styles.companyRow}>
                    <View style={styles.companyRowText}>
                      <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                      <ThemedText style={styles.companyMeta}>
                        {item.location} - {item.category}
                      </ThemedText>
                    </View>
                    <View style={styles.liveFlowRowValues}>
                      <ThemedText style={styles.liveFlowRest}>Rest {item.remaining}</ThemedText>
                      <ThemedText style={styles.liveFlowGone}>
                        Weg {item.estimatedGone}{item.hasLiveSales ? ' live' : ''}
                      </ThemedText>
                    </View>
                  </View>
                ))}

                <ThemedText style={styles.liveFlowFootnote}>
                  {visibleSalesEntries.length > 0
                    ? 'Live weg gebruikt nu echte kassaverkoop waar die beschikbaar is en valt anders terug op slimme inschatting.'
                    : 'Live weg is momenteel een slimme verbruiksinschatting op basis van drempelstock per product.'}
                </ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.inlineCardCta}>
                  {getRouteCtaLabel('/trace' as Href)}
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>

          <ThemedView style={styles.orderPanel}>
            <View style={styles.orderHeader}>
              <ThemedText type="subtitle">Bestellijst</ThemedText>
              <ThemedText>
                Deze lijst bundelt automatisch alle producten uit Bijbestellen in aparte overzichten
                voor voedselkost en dranken.
              </ThemedText>
            </View>

            <View style={styles.orderSummary}>
              {orderSummaryCards.map((card) => (
                <Pressable key={card.title} style={styles.orderSummaryCard} onPress={() => router.push(card.href)}>
                  <ThemedText type="defaultSemiBold">{card.title}</ThemedText>
                  <ThemedText style={styles.orderSummaryValue}>{card.value}</ThemedText>
                  <ThemedText type="defaultSemiBold" style={styles.inlineCardCta}>
                    {getRouteCtaLabel(card.href)}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            {companyOrderList.length ? (
              <View style={styles.orderSplitGrid}>
                <View style={styles.orderSection}>
                  <ThemedText type="defaultSemiBold">Voedselkost</ThemedText>
                  {companyFoodOrderList.length ? (
                    <View style={styles.orderList}>
                      {companyFoodOrderList.map((item) => (
                        <View key={`${item.name}-${item.category}`} style={styles.orderRow}>
                          <View style={styles.orderText}>
                            <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                            <ThemedText style={styles.orderMeta}>
                              {item.category} - {item.locations.join(', ')}
                            </ThemedText>
                            <ThemedText style={styles.orderMeta}>
                              Huidig: {item.currentQuantity} stuks
                            </ThemedText>
                          </View>
                          <View style={styles.orderBadge}>
                            <ThemedText type="defaultSemiBold" style={styles.orderBadgeText}>
                              Bestel {item.suggestedOrder}
                            </ThemedText>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <ThemedText>Geen voedselkostproducten op de bestellijst.</ThemedText>
                  )}
                </View>

                <View style={styles.orderSection}>
                  <ThemedText type="defaultSemiBold">Dranken</ThemedText>
                  {companyDrinkOrderList.length ? (
                    <View style={styles.orderList}>
                      {companyDrinkOrderList.map((item) => (
                        <View key={`${item.name}-${item.category}`} style={styles.orderRow}>
                          <View style={styles.orderText}>
                            <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                            <ThemedText style={styles.orderMeta}>
                              {item.category} - {item.locations.join(', ')}
                            </ThemedText>
                            <ThemedText style={styles.orderMeta}>
                              Huidig: {item.currentQuantity} stuks
                            </ThemedText>
                          </View>
                          <View style={styles.orderBadge}>
                            <ThemedText type="defaultSemiBold" style={styles.orderBadgeText}>
                              Bestel {item.suggestedOrder}
                            </ThemedText>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <ThemedText>Geen dranken op de bestellijst.</ThemedText>
                  )}
                </View>
              </View>
            ) : (
              <ThemedText>Er zijn momenteel geen producten die op de bestellijst moeten komen.</ThemedText>
            )}

            {companyOrderPerLocation.length ? (
              <View style={styles.orderLocationPanel}>
                <ThemedText type="defaultSemiBold">Bestelbon per vestiging</ThemedText>
                <ThemedText style={styles.orderMeta}>Automatisch gegroepeerd zodat elke locatie een eigen bestelbon heeft.</ThemedText>
                <View style={styles.orderExportRow}>
                  <Pressable style={styles.orderExportButton} onPress={handleExportAllOrdersCsv}>
                    <ThemedText type="defaultSemiBold" style={styles.orderExportText}>Exporteer alle bestelbonnen (CSV)</ThemedText>
                  </Pressable>
                </View>
                <View style={styles.orderLocationGrid}>
                  {companyOrderPerLocation.map((entry) => (
                    <View key={entry.location} style={styles.orderLocationCard}>
                      <View style={styles.orderLocationHeader}>
                        <ThemedText type="defaultSemiBold">{entry.location}</ThemedText>
                        <ThemedText style={styles.orderLocationBadge}>Bestel {entry.total}</ThemedText>
                      </View>
                      <Pressable style={styles.orderExportMini} onPress={() => handleExportLocationCsv(entry.location, entry.allItems)}>
                        <ThemedText style={styles.orderExportMiniText}>Export CSV</ThemedText>
                      </Pressable>
                      {entry.items.map((item) => (
                        <View key={`${entry.location}-${item.name}`} style={styles.orderLocationRow}>
                          <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                          <ThemedText style={styles.orderMeta}>
                            {item.category} - {item.suggestedOrder} st.
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

          </ThemedView>
        </>
      ) : null}

      <ThemedView style={styles.locationPanel}>
        <ThemedText type="subtitle">Vestigingen</ThemedText>
        <ThemedText>
          Filter de stock per vestiging en beheer producten voor keuken, magazijn of hoofdlocatie.
        </ThemedText>
        <View style={styles.locationRow}>
          {locationFilters.map((entry) => {
            const active = entry.label === selectedLocation;

            return (
              <Pressable
                key={entry.label}
                style={[styles.locationChip, active && styles.locationChipActive]}
                onPress={() => setSelectedLocation(entry.label)}>
                <ThemedText
                  type="defaultSemiBold"
                  style={active ? styles.locationChipTextActive : styles.locationChipText}>
                  {entry.label}
                </ThemedText>
                <ThemedText style={active ? styles.locationCountActive : styles.locationCount}>
                  {entry.count}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </ThemedView>

      <ThemedView style={styles.managementPanel}>
        <ThemedText type="subtitle">Vestiging aanmaken en bewerken</ThemedText>
        <ThemedText>
          Voeg nieuwe vestigingen toe, wijzig namen en verwijder locaties die je niet meer gebruikt.
        </ThemedText>

        <View style={styles.createRow}>
          <TextInput
            value={newLocationName}
            onChangeText={setNewLocationName}
            style={styles.input}
          />
          <Pressable style={styles.addButton} onPress={handleAddLocation}>
            <ThemedText type="defaultSemiBold" style={styles.addButtonText}>
              Toevoegen
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.managementList}>
          {locations.map((location) => {
            const count = items
              .filter((item) => item.location === location)
              .reduce((sum, item) => sum + item.quantity, 0);
            const isEditing = editingLocation === location;

            return (
              <View key={location} style={styles.managementCard}>
                <View style={styles.managementHeader}>
                  <View style={styles.managementText}>
                    {isEditing ? (
                      <TextInput
                        value={editedLocationName}
                        onChangeText={setEditedLocationName}
                        style={styles.input}
                      />
                    ) : (
                      <>
                        <ThemedText type="defaultSemiBold">{location}</ThemedText>
                        <ThemedText style={styles.managementMeta}>{count} stuks in stock</ThemedText>
                      </>
                    )}
                  </View>
                  <View style={styles.managementActions}>
                    {isEditing ? (
                      <Pressable style={styles.saveSmallButton} onPress={() => handleSaveEdit(location)}>
                        <ThemedText type="defaultSemiBold" style={styles.saveSmallButtonText}>
                          Opslaan
                        </ThemedText>
                      </Pressable>
                    ) : (
                      <Pressable style={styles.editButton} onPress={() => handleStartEdit(location)}>
                        <ThemedText type="defaultSemiBold" style={styles.editButtonText}>
                          Bewerk
                        </ThemedText>
                      </Pressable>
                    )}
                    <Pressable style={styles.deleteButton} onPress={() => handleRemoveLocation(location)}>
                      <ThemedText type="defaultSemiBold" style={styles.deleteButtonText}>
                        Verwijder
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ThemedView>

      <ThemedView style={styles.stockPanel}>
        <View style={styles.stockHeader}>
          <View style={styles.stockHeaderCopy}>
            <ThemedText type="subtitle">Live stocklijst</ThemedText>
            <ThemedText>
              {audience === 'Restaurant'
                ? 'Wat nu in voorraad staat.'
                : 'Wat nu in stock staat.'}
            </ThemedText>
          </View>
          <Pressable style={styles.scanButton} onPress={() => router.push('/scan')}>
            <ThemedText type="defaultSemiBold" style={styles.scanButtonText}>
              Start scan
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.stockCommandPanel}>
          <View
            style={[
              styles.stockPrimaryCard,
              { borderColor: stockPrimaryAction.tone, backgroundColor: stockPrimaryAction.surface },
            ]}>
            <View style={styles.stockPrimaryCopy}>
              <ThemedText type="defaultSemiBold">{stockPrimaryAction.title}</ThemedText>
              <ThemedText>{stockPrimaryAction.detail}</ThemedText>
            </View>
            <Pressable
              style={[styles.stockPrimaryButton, { backgroundColor: stockPrimaryAction.tone }]}
              onPress={() => router.push(stockPrimaryAction.href)}>
              <ThemedText type="defaultSemiBold" style={styles.stockPrimaryButtonText}>
                {stockPrimaryAction.cta}
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.stockSignalRow}>
            {stockSignals.map((signal) => (
              <Pressable key={signal.label} style={styles.stockSignalCard} onPress={() => router.push(signal.href)}>
                <ThemedText style={styles.stockSignalLabel}>{signal.label}</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.stockSignalValue}>
                  {signal.value}
                </ThemedText>
                <ThemedText style={styles.stockSignalDetail}>{signal.detail}</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.inlineCardCta}>
                  {getRouteCtaLabel(signal.href)}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        {visibleItems.length ? (
          visibleItems.slice(0, 8).map((item) => {
            const stockState = getSmartStockState(item);

            return (
              <View key={item.id} style={styles.stockCard}>
                <View style={styles.stockTopRow}>
                  <View style={styles.stockInfo}>
                    <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                    <ThemedText style={styles.stockMeta}>
                      {item.category} - {item.source}
                    </ThemedText>
                  </View>
                  <View style={styles.stockMetrics}>
                    <ThemedText
                      type="defaultSemiBold"
                      style={[styles.stockQuantityValue, { color: item.quantity > 0 ? '#0f766e' : '#0f172a' }]}>
                      {item.quantity} stuks
                    </ThemedText>
                    <ThemedText style={styles.stockExpiry}>{formatExpiryLabel(item.expiryDays)}</ThemedText>
                  </View>
                </View>

                <View style={styles.stockSmartRow}>
                  <View
                    style={[
                      styles.stockStateBadge,
                      { borderColor: stockState.tone, backgroundColor: stockState.surface },
                    ]}>
                    <ThemedText
                      type="defaultSemiBold"
                      style={[
                        styles.stockStateText,
                        { color: stockState.label === 'Stabiel' ? stockState.tone : '#0f172a' },
                      ]}>
                      {stockState.label}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.stockStateDetail}>{stockState.detail}</ThemedText>
                </View>

                <View style={styles.stockBottomRow}>
                  <Pressable
                    style={styles.locationBadge}
                    onPress={() => updateInventoryLocation(item.id, getNextLocation(item.location, locations))}>
                    <ThemedText type="defaultSemiBold" style={styles.locationBadgeText}>
                      {item.location}
                    </ThemedText>
                  </Pressable>

                  <View style={styles.stockActions}>
                    <Pressable style={styles.qtyButton} onPress={() => updateInventoryQuantity(item.id, -1)}>
                      <ThemedText type="defaultSemiBold" style={styles.qtyButtonText}>
                        -1
                      </ThemedText>
                    </Pressable>
                    <Pressable style={styles.qtyButton} onPress={() => updateInventoryQuantity(item.id, 1)}>
                      <ThemedText type="defaultSemiBold" style={styles.qtyButtonText}>
                        +1
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      style={styles.moveButton}
                      onPress={() => updateInventoryLocation(item.id, getNextLocation(item.location, locations))}>
                      <ThemedText type="defaultSemiBold" style={styles.moveButtonText}>
                        Verplaats
                      </ThemedText>
                    </Pressable>
                    <Pressable style={styles.deleteButton} onPress={() => handleRemoveItem(item.id, item.name)}>
                      <ThemedText type="defaultSemiBold" style={styles.deleteButtonText}>
                        Verwijder
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          <ThemedText>Na je eerste scan verschijnt de volledige stock hier automatisch.</ThemedText>
        )}
      </ThemedView>

      <ThemedView style={styles.categoryPanel}>
        <View style={styles.categoryHeader}>
          <ThemedText type="subtitle">Categorieen in stock</ThemedText>
          <Pressable style={styles.inlineLinkButton} onPress={() => router.push('/payments')}>
            <ThemedText type="defaultSemiBold" style={styles.inlineLinkText}>
              Betalingen
            </ThemedText>
          </Pressable>
        </View>

        {categoryBreakdown.length ? (
          categoryBreakdown.map((entry) => (
            <Pressable key={entry.category} style={styles.categoryRow} onPress={() => router.push('/scan')}>
              <ThemedText type="defaultSemiBold">{entry.category}</ThemedText>
              <View style={styles.categoryRowMeta}>
                <ThemedText>{entry.quantity} stuks</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.inlineCardCta}>
                  {getRouteCtaLabel('/scan' as Href)}
                </ThemedText>
              </View>
            </Pressable>
          ))
        ) : (
          <ThemedText>Na je eerste opslag verschijnt hier automatisch de verdeling per categorie.</ThemedText>
        )}
      </ThemedView>

      <ThemedView style={styles.insightGrid}>
        {operationsCards.map((group) => (
          <Pressable key={group.title} style={styles.insightCard} onPress={() => router.push(group.href)}>
            <ThemedText type="subtitle">{group.title}</ThemedText>
            <ThemedText>{group.body}</ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.inlineCardCta}>
              {getRouteCtaLabel(group.href)}
            </ThemedText>
          </Pressable>
        ))}
      </ThemedView>
    </ParallaxScrollView>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <View style={styles.metricCard}>
      <ThemedText type="defaultSemiBold">{label}</ThemedText>
      <ThemedText style={[styles.metricValue, { color: tone }]}>{value}</ThemedText>
    </View>
  );
}

function LegendItem({ label, color }: { label: string; color: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <ThemedText style={styles.legendText}>{label}</ThemedText>
    </View>
  );
}

function FinanciënFormCard({
  title,
  description,
  amount,
  note,
  period,
  onAmountChange,
  onNoteChange,
  onPeriodChange,
  onSave,
}: {
  title: string;
  description: string;
  amount: string;
  note: string;
  period: FinanciënEntryPeriod;
  onAmountChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onPeriodChange: (value: FinanciënEntryPeriod) => void;
  onSave: () => void;
}) {
  return (
    <View style={styles.financeEntryCard}>
      <View style={styles.financeEntryHeader}>
        <ThemedText type="defaultSemiBold">{title}</ThemedText>
        <ThemedText style={styles.financeMeta}>{description}</ThemedText>
      </View>

      <View style={styles.financeEntryInputs}>
        <TextInput
          value={amount}
          onChangeText={onAmountChange}
          keyboardType="decimal-pad"
          style={styles.financeInput}
        />
        <TextInput
          value={note}
          onChangeText={onNoteChange}
          style={[styles.financeInput, styles.financeNoteInput]}
        />
      </View>

      <View style={styles.financePeriodRow}>
        {financePeriods.map((option) => {
          const active = option === period;

          return (
            <Pressable
              key={`${title}-${option}`}
              style={[styles.financePeriodChip, active && styles.financePeriodChipActive]}
              onPress={() => onPeriodChange(option)}>
              <ThemedText
                type="defaultSemiBold"
                style={active ? styles.financePeriodTextActive : styles.financePeriodText}>
                {financePeriodLabels[option]}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <Pressable style={styles.financeSaveButton} onPress={onSave}>
        <ThemedText type="defaultSemiBold" style={styles.financeSaveButtonText}>
          {title} opslaan
        </ThemedText>
      </Pressable>
    </View>
  );
}

function FinanciënHistoryRow({
  entry,
  onRemove,
}: {
  entry: FinanciënEntry;
  onRemove: () => void;
}) {
  return (
    <View style={styles.financeHistoryRow}>
      <View style={styles.financeHistoryText}>
        <ThemedText type="defaultSemiBold">
          {financeEntryLabels[entry.kind]} - {formatCurrency(entry.amount)}
        </ThemedText>
        <ThemedText style={styles.financeHistoryMeta}>{formatFinanciënEntryMeta(entry)}</ThemedText>
        {entry.note ? <ThemedText style={styles.financeHistoryMeta}>{entry.note}</ThemedText> : null}
      </View>

      <Pressable style={styles.financeRemoveButton} onPress={onRemove}>
        <ThemedText type="defaultSemiBold" style={styles.financeRemoveButtonText}>
          Verwijder
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCircle: {
    width: 170,
    height: 170,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadge: {
    position: 'absolute',
    bottom: 24,
    right: 28,
    backgroundColor: '#0f766e',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerBadgeText: {
    color: '#fff',
  },
  headerBadgeSubtext: {
    color: '#d1fae5',
  },
  intro: {
    gap: 12,
  },
  introBrandRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  introBrandCopy: {
    flex: 1,
    minWidth: 220,
    gap: 8,
  },
  introLogoFrame: {
    width: 74,
    height: 74,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#99f6e4',
    backgroundColor: '#020617',
  },
  manifestEyebrow: {
    color: '#0f766e',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  manifestParagraph: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 19,
  },
  manifestPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  manifestPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#99f6e4',
    backgroundColor: '#ecfeff',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  manifestPillText: {
    color: '#0f766e',
    fontSize: 12,
  },
  manifestClosing: {
    color: '#0f172a',
    fontSize: 13,
    lineHeight: 19,
  },
  introLogo: {
    width: '100%',
    height: '100%',
  },
  liveHighlightBar: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  liveHighlightStable: {
    borderColor: '#99f6e4',
    backgroundColor: '#ecfeff',
  },
  liveHighlightCritical: {
    borderColor: '#fecaca',
    backgroundColor: '#fff1f2',
  },
  liveHighlightMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  liveHighlightDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#0f766e',
    marginTop: 6,
  },
  liveHighlightDotCritical: {
    backgroundColor: '#dc2626',
  },
  liveHighlightTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  liveHighlightText: {
    color: '#334155',
    fontSize: 13,
  },
  liveHighlightCta: {
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  liveHighlightCtaText: {
    color: '#0f172a',
    fontSize: 12,
  },
  audiencePanel: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#fffaf4',
    borderWidth: 1,
    borderColor: '#fed7aa',
    gap: 14,
  },
  audienceHeader: {
    gap: 12,
  },
  audienceCopy: {
    gap: 4,
  },
  audienceSwitchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  audienceChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  audienceChipActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  audienceChipText: {
    color: '#0f172a',
  },
  audienceChipTextActive: {
    color: '#ffffff',
  },
  audienceActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryAction: {
    backgroundColor: '#0f766e',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  primaryActionText: {
    color: '#ffffff',
  },
  secondaryAction: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#0f766e',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  secondaryActionText: {
    color: '#0f766e',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  livePanel: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4ee',
    gap: 14,
  },
  liveHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveCopy: {
    flex: 1,
    minWidth: 260,
    gap: 4,
  },
  liveAction: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fdba74',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  liveActionText: {
    color: '#9a3412',
  },
  liveGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'stretch',
  },
  liveCard: {
    flexGrow: 1,
    flexBasis: 320,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  liveCardActive: {
    borderWidth: 2,
  },
  liveCardTopRow: {
    gap: 2,
  },
  liveCardTitle: {
    color: '#0f172a',
  },
  liveCardMeta: {
    color: '#475569',
    fontSize: 12,
  },
  liveCardCountBadge: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
    alignItems: 'center',
  },
  liveCardCountLabel: {
    color: '#64748b',
    fontSize: 11,
  },
  liveCardCountValue: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '800',
  },
  liveCardCountMeta: {
    color: '#475569',
    fontSize: 12,
  },
  liveMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'stretch',
  },
  liveMetricChip: {
    flexGrow: 1,
    flexBasis: 140,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.10)',
    backgroundColor: 'rgba(255,255,255,0.8)',
    padding: 12,
    gap: 2,
  },
  liveMetricLabel: {
    color: '#64748b',
    fontSize: 11,
  },
  liveMetricMeta: {
    color: '#475569',
    fontSize: 12,
  },
  liveLinkButton: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  liveLinkButtonText: {
    fontSize: 13,
  },
  liveFooter: {
    color: '#64748b',
    fontSize: 12,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: 220,
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4ee',
    gap: 8,
  },
  metricValue: {
    fontSize: 30,
    fontWeight: '700',
  },
  commandPanel: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4ee',
    gap: 14,
  },
  commandHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    alignItems: 'flex-start',
  },
  commandCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  commandScoreBadge: {
    minWidth: 116,
    alignSelf: 'flex-start',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  commandScoreValue: {
    fontSize: 28,
  },
  commandScoreLabel: {
    color: '#64748b',
    fontSize: 11,
  },
  commandPrimaryCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  commandPrimaryCopy: {
    gap: 4,
  },
  commandPrimaryButton: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  commandPrimaryButtonText: {
    color: '#ffffff',
  },
  commandDriverRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'stretch',
  },
  commandDriverCard: {
    flexGrow: 1,
    flexBasis: 220,
    minHeight: 132,
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4ee',
    gap: 4,
    alignItems: 'flex-start',
  },
  commandDriverLabel: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'left',
  },
  commandDriverValue: {
    color: '#0f172a',
    fontSize: 17,
    textAlign: 'left',
  },
  commandDriverDetail: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'left',
    minHeight: 32,
  },
  commandDriverCta: {
    marginTop: 'auto',
    alignSelf: 'flex-start',
    color: '#1d4ed8',
    fontSize: 12,
  },
  commandLocationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'stretch',
  },
  commandLocationCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  commandLocationBadge: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 1,
  },
  commandLocationBadgeLabel: {
    color: '#64748b',
    fontSize: 11,
  },
  commandLocationBadgeMeta: {
    color: '#475569',
    fontSize: 12,
  },
  commandLocationValue: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '800',
  },
  recommendationPanel: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#fffaf0',
    borderWidth: 1,
    borderColor: '#fed7aa',
    gap: 14,
  },
  smartSignalsPanel: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4ee',
    gap: 14,
  },
  smartSignalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  smartSignalCard: {
    flexGrow: 1,
    flexBasis: 220,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  suggestionPanel: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbe4ee',
    gap: 12,
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  suggestionExport: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#0f766e',
    backgroundColor: '#ecfeff',
  },
  suggestionExportText: {
    color: '#0f766e',
  },
  suggestionList: {
    gap: 10,
  },
  suggestionCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  suggestionCopy: {
    flex: 1,
    minWidth: 200,
    gap: 2,
  },
  suggestionMeta: {
    color: '#64748b',
  },
  suggestionDetail: {
    color: '#0f172a',
  },
  suggestionAction: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  suggestionActionActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  suggestionActionDone: {
    backgroundColor: '#e2e8f0',
    borderColor: '#cbd5e1',
  },
  suggestionActionText: {
    color: '#ffffff',
  },
  suggestionActionTextDone: {
    color: '#475569',
  },
  recommendationRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  recommendationIndex: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  recommendationIndexText: {
    color: '#fff',
  },
  recommendationText: {
    flex: 1,
    gap: 3,
  },
  inlineCardCta: {
    marginTop: 6,
    alignSelf: 'flex-start',
    color: '#1d4ed8',
    fontSize: 12,
  },
  financePanel: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4ee',
    gap: 14,
  },
  financeExportRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  financeExportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  financeExportText: {
    color: '#0f172a',
  },
  savingsPanel: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 12,
  },
  savingsInputRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  savingsInputCard: {
    flexGrow: 1,
    flexBasis: 180,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    gap: 4,
  },
  savingsLabel: {
    color: '#475569',
  },
  savingsInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#0f172a',
  },
  savingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  savingsCard: {
    flexGrow: 1,
    flexBasis: 200,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 4,
    backgroundColor: '#f8fafc',
  },
  savingsValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  savingsMeta: {
    color: '#64748b',
    fontSize: 12,
  },
  savingsActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  savingsActionButton: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#0f172a',
    backgroundColor: '#0f172a',
  },
  savingsActionText: {
    color: '#ffffff',
  },
  recipientRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  recipientCard: {
    flexGrow: 1,
    flexBasis: 220,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 4,
    backgroundColor: '#ffffff',
  },
  recipientLabel: {
    color: '#475569',
  },
  recipientInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#0f172a',
  },
  monthlyBanner: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#0f766e',
    backgroundColor: '#ecfeff',
    padding: 16,
    gap: 8,
    marginBottom: 10,
  },
  monthlyButton: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#0f766e',
  },
  monthlyButtonText: {
    color: '#ffffff',
  },
  financeMonthlyPanel: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    gap: 12,
    backgroundColor: '#ffffff',
  },
  financeMonthlyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  financeMonthlyCard: {
    flexGrow: 1,
    flexBasis: 220,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    padding: 12,
    gap: 4,
  },
  financeAdviceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  financeAdviceCard: {
    flexGrow: 1,
    flexBasis: 220,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  businessCommandPanel: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4ee',
    gap: 14,
  },
  businessCommandHeader: {
    gap: 4,
  },
  businessCommandCopy: {
    gap: 4,
  },
  businessCommandSignalRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  businessCommandSignalCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#fffaf4',
    borderWidth: 1,
    borderColor: '#fed7aa',
    gap: 4,
  },
  businessCommandSignalLabel: {
    color: '#64748b',
    fontSize: 11,
  },
  businessCommandSignalValue: {
    color: '#0f172a',
    fontSize: 17,
  },
  businessCommandSignalDetail: {
    color: '#475569',
    fontSize: 12,
  },
  businessCommandActionRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  businessCommandActionCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  businessCommandActionButton: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  businessCommandActionButtonText: {
    color: '#ffffff',
  },
  financeHeader: {
    gap: 4,
  },
  financeInputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  financeEntryCard: {
    flexGrow: 1,
    flexBasis: 260,
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#fffaf4',
    borderWidth: 1,
    borderColor: '#fed7aa',
    gap: 12,
  },
  financeEntryHeader: {
    gap: 4,
  },
  financeEntryInputs: {
    gap: 10,
  },
  financeInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    color: '#0f172a',
  },
  financeNoteInput: {
    minHeight: 48,
  },
  financePeriodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  financePeriodChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  financePeriodChipActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  financePeriodText: {
    color: '#0f172a',
  },
  financePeriodTextActive: {
    color: '#ffffff',
  },
  financeSaveButton: {
    borderRadius: 12,
    backgroundColor: '#0f766e',
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  financeSaveButtonText: {
    color: '#ffffff',
  },
  financeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  financeQuickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  financeQuickButton: {
    flex: 1,
    flexBasis: 240,
    minWidth: 0,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: 12,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  financeQuickText: {
    flex: 1,
    gap: 2,
  },
  financeCard: {
    flexGrow: 1,
    flexBasis: 220,
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbe4ee',
    gap: 6,
  },
  financeValue: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f766e',
  },
  financeMeta: {
    color: '#64748b',
    fontSize: 13,
  },
  financeMetaWarning: {
    color: '#dc2626',
  },
  financeEmptyState: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 4,
  },
  financeHistory: {
    gap: 10,
  },
  financeHistoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbe4ee',
    padding: 14,
  },
  financeHistoryText: {
    flex: 1,
    minWidth: 220,
    gap: 3,
  },
  financeHistoryMeta: {
    color: '#64748b',
    fontSize: 13,
  },
  financeRemoveButton: {
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  financeRemoveButtonText: {
    color: '#dc2626',
  },
  chartPanel: {
    gap: 12,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbe4ee',
    padding: 16,
  },
  chartHeader: {
    gap: 2,
  },
  chartHeaderText: {
    color: '#64748b',
    fontSize: 13,
  },
  chartLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  legendText: {
    fontSize: 13,
    color: '#475569',
  },
  chartGrid: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
    minHeight: 220,
    paddingTop: 12,
  },
  chartMonth: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  chartBars: {
    width: '100%',
    maxWidth: 28,
    height: 180,
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexDirection: 'row',
    gap: 3,
  },
  chartBar: {
    width: 7,
    minHeight: 4,
    borderRadius: 999,
  },
  chartBarRevenue: {
    backgroundColor: '#0f766e',
  },
  chartBarFoodCost: {
    backgroundColor: '#f59e0b',
  },
  chartBarLoss: {
    backgroundColor: '#dc2626',
  },
  chartMonthLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  bucketPanel: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#fffaf4',
    borderWidth: 1,
    borderColor: '#fed7aa',
    gap: 14,
  },
  bucketHeader: {
    gap: 4,
  },
  bucketGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  bucketCard: {
    flexGrow: 1,
    flexBasis: 220,
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fde68a',
    gap: 6,
  },
  bucketValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#b45309',
  },
  companyPanel: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4ee',
    gap: 14,
  },
  companyHeader: {
    gap: 4,
  },
  companyLivePanel: {
    gap: 12,
  },
  companyLivePrimaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  companyLivePrimaryCopy: {
    gap: 4,
  },
  companyLivePrimaryButton: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  companyLivePrimaryButtonText: {
    color: '#ffffff',
  },
  companyLiveSignalRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  companyLiveSignalCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4ee',
    gap: 4,
  },
  companyLiveSignalLabel: {
    color: '#64748b',
    fontSize: 11,
  },
  companyLiveSignalValue: {
    color: '#0f172a',
    fontSize: 17,
  },
  companyLiveSignalDetail: {
    color: '#475569',
    fontSize: 12,
  },
  companyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  companyCard: {
    flexGrow: 1,
    flexBasis: 240,
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbe4ee',
    gap: 10,
  },
  companyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  companyRowText: {
    flex: 1,
    gap: 2,
  },
  companyMeta: {
    color: '#64748b',
    fontSize: 13,
  },
  companyWarning: {
    color: '#b45309',
    fontWeight: '600',
  },
  companyDanger: {
    color: '#dc2626',
    fontWeight: '600',
  },
  liveFlowSummary: {
    flexDirection: 'row',
    gap: 12,
  },
  liveFlowMetric: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4ee',
    gap: 3,
  },
  liveFlowLabel: {
    color: '#64748b',
    fontSize: 12,
  },
  liveFlowValue: {
    color: '#0f766e',
  },
  liveFlowDanger: {
    color: '#dc2626',
  },
  liveFlowRowValues: {
    alignItems: 'flex-end',
    gap: 3,
  },
  liveFlowRest: {
    color: '#0f766e',
    fontWeight: '600',
  },
  liveFlowGone: {
    color: '#dc2626',
    fontWeight: '600',
  },
  liveFlowFootnote: {
    color: '#64748b',
    fontSize: 12,
  },
  orderPanel: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#fffaf4',
    borderWidth: 1,
    borderColor: '#fed7aa',
    gap: 14,
  },
  orderHeader: {
    gap: 4,
  },
  orderSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  orderSummaryCard: {
    flexGrow: 1,
    flexBasis: 180,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fde68a',
    padding: 14,
    gap: 4,
  },
  orderSummaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#b45309',
  },
  orderList: {
    gap: 10,
  },
  orderSplitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  orderSection: {
    flexGrow: 1,
    flexBasis: 280,
    gap: 10,
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fde68a',
    padding: 14,
  },
  orderText: {
    flex: 1,
    gap: 2,
  },
  orderMeta: {
    color: '#64748b',
    fontSize: 13,
  },
  orderBadge: {
    borderRadius: 999,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  orderBadgeText: {
    color: '#92400e',
  },
  orderLocationPanel: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 12,
    gap: 10,
  },
  orderLocationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  orderExportRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  orderExportButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#0f766e',
    backgroundColor: '#ecfeff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  orderExportText: {
    color: '#0f172a',
  },
  orderLocationCard: {
    flexBasis: 230,
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#ffffff',
    padding: 12,
    gap: 6,
  },
  orderLocationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderExportMini: {
    alignSelf: 'flex-start',
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
  },
  orderExportMiniText: {
    color: '#0f172a',
    fontSize: 12,
  },
  orderLocationBadge: {
    backgroundColor: '#0f766e',
    color: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  orderLocationRow: {
    gap: 2,
  },
  locationPanel: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbe4ee',
    gap: 12,
  },
  locationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  locationChip: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4ee',
  },
  locationChipActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  locationChipText: {
    color: '#0f172a',
  },
  locationChipTextActive: {
    color: '#ffffff',
  },
  locationCount: {
    color: '#64748b',
    fontSize: 13,
  },
  locationCountActive: {
    color: '#d1fae5',
    fontSize: 13,
  },
  managementPanel: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4ee',
    gap: 14,
  },
  createRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  input: {
    flex: 1,
    minWidth: 220,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
  },
  addButton: {
    backgroundColor: '#0f766e',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#ffffff',
  },
  managementList: {
    gap: 10,
  },
  managementCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    padding: 14,
  },
  managementHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  managementText: {
    flex: 1,
    minWidth: 220,
    gap: 2,
  },
  managementMeta: {
    color: '#64748b',
  },
  managementActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  editButton: {
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  editButtonText: {
    color: '#1d4ed8',
  },
  saveSmallButton: {
    borderRadius: 10,
    backgroundColor: '#ecfeff',
    borderWidth: 1,
    borderColor: '#99f6e4',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  saveSmallButtonText: {
    color: '#0f766e',
  },
  stockPanel: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4ee',
    gap: 12,
  },
  stockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    flexWrap: 'wrap',
  },
  stockHeaderCopy: {
    flex: 1,
    minWidth: 240,
    gap: 4,
  },
  stockCommandPanel: {
    gap: 12,
  },
  stockPrimaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  stockPrimaryCopy: {
    gap: 4,
  },
  stockPrimaryButton: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  stockPrimaryButtonText: {
    color: '#ffffff',
  },
  stockSignalRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  stockSignalCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4ee',
    gap: 4,
  },
  stockSignalLabel: {
    color: '#64748b',
    fontSize: 11,
  },
  stockSignalValue: {
    color: '#0f172a',
    fontSize: 17,
  },
  stockSignalDetail: {
    color: '#475569',
    fontSize: 12,
  },
  scanButton: {
    backgroundColor: '#0f766e',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  scanButtonText: {
    color: '#ffffff',
  },
  stockCard: {
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  stockTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 14,
    flexWrap: 'wrap',
  },
  stockInfo: {
    flex: 1,
    minWidth: 180,
    gap: 2,
  },
  stockMeta: {
    color: '#64748b',
  },
  stockSmartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  stockStateBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  stockStateText: {
    fontSize: 11,
  },
  stockStateDetail: {
    flex: 1,
    minWidth: 180,
    color: '#475569',
    fontSize: 12,
  },
  stockMetrics: {
    alignItems: 'flex-end',
    gap: 2,
    minWidth: 120,
  },
  stockQuantityValue: {
    fontSize: 18,
    lineHeight: 22,
  },
  stockExpiry: {
    color: '#0f172a',
  },
  stockBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  locationBadge: {
    backgroundColor: '#ecfeff',
    borderWidth: 1,
    borderColor: '#99f6e4',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  locationBadgeText: {
    color: '#0f766e',
  },
  stockActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  qtyButton: {
    minWidth: 46,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  qtyButtonText: {
    color: '#0f172a',
  },
  moveButton: {
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  moveButtonText: {
    color: '#1d4ed8',
  },
  deleteButton: {
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  deleteButtonText: {
    color: '#dc2626',
  },
  categoryPanel: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4ee',
    gap: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  inlineLinkButton: {
    borderWidth: 1,
    borderColor: '#7c3aed',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f5f3ff',
  },
  inlineLinkText: {
    color: '#7c3aed',
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  categoryRowMeta: {
    alignItems: 'flex-end',
    gap: 2,
  },
  insightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  insightCard: {
    flexGrow: 1,
    flexBasis: 240,
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbe4ee',
    gap: 8,
  },
});
