import { useCallback, useEffect, useMemo, useState } from 'react';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { clearLiveAlerts, completeTask, getInventoryMetrics, useInventory } from 'hooks/use-inventory';
import { TazeBadge } from 'components/taze-badge';
import { TazeButton } from 'components/taze-button';
import { TazeCard } from 'components/taze-card';
import { TazeChip } from 'components/taze-chip';
import { RealAiCopilotPanel } from 'components/real-ai-copilot-panel';
import { TazeSectionHeader } from 'components/taze-section-header';
import { TazeLogo } from 'components/taze-logo';
import { ThemedText } from 'components/themed-text';
import { ThemedView } from 'components/themed-view';
import { Brand } from 'constants/theme';
import { markAiAuditInteraction, markAiAuditOutcome } from 'lib/ai-audit';
import { logTransportAudit } from 'lib/transport-audit';
import {
  canPlaySounds,
  defaultSoundSettings,
  eventForAlertId,
  loadSoundSettings,
  playEvent,
  saveSoundSettings,
  soundPresets,
  type SoundEventId,
  type SoundPresetId,
  type SoundSettings,
} from 'lib/notification-sounds';
import { requestRealAi, type RealAiResponse } from 'lib/real-ai';
import { canTalkBack, loadTalkbackSettings, saveTalkbackSettings, talkBack } from 'lib/talkback';
import { buildTransportAiContext, buildTransportHubPath } from 'lib/transport-ai';
import { transportApps } from 'lib/transport-hub';
import {
  getCachedTransportPreferences,
  getTransportPreferenceForScope,
  loadTransportPreferences,
  removeTransportPreferenceByMatch,
  saveTransportPreference,
  subscribeTransportPreferences,
} from 'lib/transport-favorites';

type SmartAlert = {
  id: string;
  title: string;
  text: string;
  priority: 'Hoog' | 'Middel' | 'Laag';
  stat: string;
  cta: string;
  href: '/scan' | '/explore' | '/payments' | '/alerts' | '/trace';
  tone: string;
  surface: string;
  related: string[];
};

function buildAlertsTransportFollowupLabel(partnerLabel: string, useCase: string) {
  if (useCase === 'Logistiek') {
    return `${partnerLabel} geopend voor logistieke alertopvolging. Volgende stap: controleer recalls en verplaats urgente taken naar trace.`;
  }
  if (useCase === 'Zakelijk') {
    return `${partnerLabel} geopend voor zakelijke opvolging. Volgende stap: leg transportkeuze vast en stuur door naar payments.`;
  }
  return `${partnerLabel} geopend voor ${useCase.toLowerCase()} opvolging. Volgende stap: werk nu de open alerttaken af.`;
}

function getTransportPreferenceSyncMeta(state: 'local' | 'queued' | 'synced') {
  switch (state) {
    case 'synced':
      return { label: 'Synced', tone: 'success' as const };
    case 'queued':
      return { label: 'Wachtrij', tone: 'warning' as const };
    default:
      return { label: 'Lokaal', tone: 'neutral' as const };
  }
}

function formatExpiry(expiryDays: number | null) {
  if (expiryDays === null) {
    return 'controle nodig';
  }

  if (expiryDays <= 0) {
    return 'vandaag beoordelen';
  }

  if (expiryDays === 1) {
    return 'morgen vervaldag';
  }

  return `nog ${expiryDays} dagen`;
}

function buildSmartAlerts(
  items: ReturnType<typeof useInventory>['items'],
  financeEntries: ReturnType<typeof useInventory>['financeEntries'],
  movements: ReturnType<typeof useInventory>['movements']
) {
  const lowStockItems = items
    .filter((item) => item.quantity <= 1)
    .sort((left, right) => left.quantity - right.quantity);
  const expiringItems = items
    .filter((item) => item.expiryDays !== null && item.expiryDays <= 2)
    .sort((left, right) => (left.expiryDays ?? 99) - (right.expiryDays ?? 99));
  const lowConfidenceItems = items
    .filter((item) => item.confidence !== null && item.confidence < 0.8)
    .sort((left, right) => (left.confidence ?? 1) - (right.confidence ?? 1));

  const alerts: SmartAlert[] = [];

  alerts.push({
    id: 'expiry',
    title: 'Verval en afboekingen opvolgen',
    text:
      expiringItems.length > 0
        ? `${expiringItems.length} product(en) zitten in de gevarenzone. Werk eerst deze voorraad weg om afboekingen te beperken.`
        : 'Er zijn momenteel geen producten met directe vervaldruk.',
    priority: expiringItems.length > 0 ? 'Hoog' : 'Laag',
    stat: expiringItems.length > 0 ? `${expiringItems.length} acties` : 'Rustig',
    cta: 'Open inzichten',
    href: '/explore',
    tone: '#dc2626',
    surface: '#fef2f2',
    related:
      expiringItems.length > 0
        ? expiringItems.slice(0, 3).map((item) => `${item.name} - ${formatExpiry(item.expiryDays)} - gebruik eerst`)
        : ['Geen directe vervalproducten gevonden.'],
  });

  alerts.push({
    id: 'recognition',
    title: 'Herkenning bijsturen',
    text:
      lowConfidenceItems.length > 0
        ? `${lowConfidenceItems.length} product(en) hebben een lagere AI-zekerheid en verdienen controle.`
        : 'De herkenning draait stabiel. Er zijn geen duidelijke correcties nodig.',
    priority: lowConfidenceItems.length > 0 ? 'Middel' : 'Laag',
    stat:
      lowConfidenceItems.length > 0
        ? `${Math.round((lowConfidenceItems[0]?.confidence ?? 0) * 100)}% laagste score`
        : 'Sterk',
    cta: 'Open scanner',
    href: '/scan',
    tone: '#1d4ed8',
    surface: '#eff6ff',
    related:
      lowConfidenceItems.length > 0
        ? lowConfidenceItems
            .slice(0, 3)
            .map((item) => `${item.name} - ${Math.round((item.confidence ?? 0) * 100)}% - controleer naam/categorie`)
        : ['Geen producten met lage herkenningsscore.'],
  });

  alerts.push({
    id: 'restock',
    title: 'Bijbestellen of opnieuw scannen',
    text:
      lowStockItems.length > 0
        ? `${lowStockItems.length} product(en) zitten laag in stock. Bekijk of je moet bijbestellen of opnieuw inscannen.`
        : 'Er zijn geen duidelijke lage stock-signalen op dit moment.',
    priority: lowStockItems.length > 2 ? 'Hoog' : lowStockItems.length > 0 ? 'Middel' : 'Laag',
    stat:
      lowStockItems.length > 0
        ? `${Math.max(1, Math.round(lowStockItems[0].quantity))} stuks laagste stock`
        : 'Op niveau',
    cta: 'Bekijk inzichten',
    href: '/explore',
    tone: '#b45309',
    surface: '#fffbeb',
    related:
      lowStockItems.length > 0
        ? lowStockItems.slice(0, 3).map((item) => {
            const target = Math.max(1, 2 - item.quantity);
            return `${item.name} - nog ${item.quantity} st. - bestel +${target}`;
          })
        : ['Geen producten met kritieke lage stock.'],
  });

  const recentMovements = movements.slice(0, 3);
  const movementsToday = movements.filter((movement) => {
    const date = new Date(movement.recordedAt);
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }).length;

  alerts.push({
    id: 'trace',
    title: 'Live tracering',
    text:
      movements.length > 0
        ? 'Directie ziet live waar stock zich bevindt, wat verplaatst is en wat verbruikt of afgeboekt werd.'
        : 'Trace staat klaar. Registreer verplaatsingen en verbruik om historiek op te bouwen.',
    priority: movementsToday > 0 ? 'Middel' : items.length > 0 ? 'Laag' : 'Laag',
    stat: movementsToday > 0 ? `${movementsToday} beweging(en) vandaag` : movements.length > 0 ? `${movements.length} bewegingen` : 'Nog leeg',
    cta: 'Open trace',
    href: '/trace',
    tone: '#0f766e',
    surface: '#ecfeff',
    related:
      recentMovements.length > 0
        ? recentMovements.map((movement) => {
            const from = movement.fromLocation ?? '-';
            const to = movement.toLocation ?? '-';
            return `${movement.itemName} - ${movement.type} - ${movement.quantity} st. - ${from} -> ${to}`;
          })
        : ['Nog geen transfers, verbruik of afboekingen geregistreerd.'],
  });

  alerts.push({
    id: 'finance',
    title: 'Financien koppelen aan voorraad',
    text:
      financeEntries.length === 0
        ? 'Er is nog geen omzet, food cost of live winst/verlies geregistreerd. Daardoor mist het systeem financiele sturing.'
        : 'Financien zijn gekoppeld. Hou registraties actueel om trends en marges slim op te volgen.',
    priority: financeEntries.length === 0 ? 'Middel' : 'Laag',
    stat: financeEntries.length === 0 ? 'Nog leeg' : `${financeEntries.length} registraties`,
    cta: 'Open betalingen',
    href: '/payments',
    tone: '#7c3aed',
    surface: '#f5f3ff',
    related:
      financeEntries.length === 0
        ? ['Voeg omzet, food cost of live winst/verlies toe voor betere sturing.']
        : financeEntries
            .slice(0, 3)
            .map((entry) => `${entry.kind.replace('_', ' ')} - EUR ${entry.amount.toFixed(0)}`),
  });

  const priorityOrder = { Hoog: 0, Middel: 1, Laag: 2 } as const;

  return alerts.sort((left, right) => priorityOrder[left.priority] - priorityOrder[right.priority]);
}

function formatShortTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('nl-BE', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function isTaskInDateWindow(createdAt: string, filter: 'all' | 'today' | '7d') {
  if (filter === 'all') return true;

  const createdDate = new Date(createdAt);
  if (Number.isNaN(createdDate.getTime())) return false;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (filter === 'today') {
    return createdDate >= startOfToday;
  }

  const sevenDaysAgo = new Date(startOfToday);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  return createdDate >= sevenDaysAgo;
}

function getTaskGroup(task: { title: string; detail: string }) {
  const normalized = `${task.title} ${task.detail}`.toLowerCase();
  if (normalized.includes('recall')) return 'Recall';
  if (normalized.includes('verwerk vandaag') || normalized.includes('houdbaarheid') || normalized.includes('waste')) {
    return 'Vandaag verwerken';
  }
  if (normalized.includes('ai scan') || normalized.includes('controleer ai') || normalized.includes('zekerheid')) {
    return 'AI controle';
  }
  return 'Overig';
}

export default function AlertsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ taskGroup?: string }>();
  const { items, financeEntries, locations, movements, liveAlerts, tasks, purchaseOrders } = useInventory();
  const [selectedLocation, setSelectedLocation] = useState<string>('Alle vestigingen');
  const [selectedTaskGroup, setSelectedTaskGroup] = useState<string>(params.taskGroup ?? 'all');
  const [selectedTaskStatus, setSelectedTaskStatus] = useState<'all' | 'open' | 'done'>('open');
  const [selectedTaskDate, setSelectedTaskDate] = useState<'all' | 'today' | '7d'>('all');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(() => loadSoundSettings());
  const [talkbackSettings, setTalkbackSettingsState] = useState(() => loadTalkbackSettings());
  const [realAiState, setRealAiState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [realAiAnswer, setRealAiAnswer] = useState<RealAiResponse | null>(null);
  const [realAiError, setRealAiError] = useState('');
  const [transportFollowupNote, setTransportFollowupNote] = useState<string | null>(null);
  const [transportPreferences, setTransportPreferences] = useState(() => getCachedTransportPreferences());

  useEffect(() => {
    if (params.taskGroup) {
      setSelectedTaskGroup(params.taskGroup);
    }
  }, [params.taskGroup]);

  useEffect(() => {
    let cancelled = false;
    loadTransportPreferences()
      .then((entries) => {
        if (!cancelled) setTransportPreferences(entries);
      })
      .catch(() => {});
    const unsubscribe = subscribeTransportPreferences((entries) => {
      if (!cancelled) setTransportPreferences(entries);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const filteredItems = useMemo(
    () => (selectedLocation === 'Alle vestigingen' ? items : items.filter((item) => item.location === selectedLocation)),
    [items, selectedLocation]
  );
  const scopedTasks = useMemo(
    () => (selectedLocation === 'Alle vestigingen' ? tasks : tasks.filter((task) => task.location === selectedLocation)),
    [selectedLocation, tasks]
  );
  const scopedPurchaseOrders = useMemo(
    () =>
      selectedLocation === 'Alle vestigingen'
        ? purchaseOrders
        : purchaseOrders.filter((purchaseOrder) => purchaseOrder.location === selectedLocation),
    [purchaseOrders, selectedLocation]
  );
  const metrics = getInventoryMetrics(filteredItems);

  const alerts = useMemo(
    () => buildSmartAlerts(filteredItems, financeEntries, movements),
    [filteredItems, financeEntries, movements]
  );
  const topPriority = alerts.find((alert) => alert.priority === 'Hoog') ?? alerts[0];
  const recentLiveAlerts = liveAlerts.slice(0, 8);
  const groupedTaskStats = useMemo(() => {
    const counts = new Map<string, number>();
    scopedTasks
      .filter((task) => task.status !== 'done')
      .forEach((task) => {
        const key = getTaskGroup(task);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
    return ['Recall', 'Vandaag verwerken', 'AI controle', 'Overig']
      .map((label) => ({ label, count: counts.get(label) ?? 0 }))
      .filter((entry) => entry.count > 0);
  }, [scopedTasks]);
  const filteredTasks = useMemo(() => {
    return scopedTasks.filter((task) => {
      if (selectedTaskGroup !== 'all' && getTaskGroup(task) !== selectedTaskGroup) {
        return false;
      }
      if (selectedTaskStatus !== 'all' && task.status !== selectedTaskStatus) {
        return false;
      }
      if (!isTaskInDateWindow(task.createdAt, selectedTaskDate)) {
        return false;
      }
      return true;
    });
  }, [scopedTasks, selectedTaskDate, selectedTaskGroup, selectedTaskStatus]);
  const alertAnalytics = useMemo(() => {
    const openTasks = scopedTasks.filter((task) => task.status === 'open');
    const recallOpen = openTasks.filter((task) => getTaskGroup(task) === 'Recall').length;
    const aiOpen = openTasks.filter((task) => getTaskGroup(task) === 'AI controle').length;
    const doneLast7Days = scopedTasks.filter((task) => task.status === 'done' && isTaskInDateWindow(task.createdAt, '7d')).length;
    const activeOrders = scopedPurchaseOrders.filter((purchaseOrder) => purchaseOrder.status !== 'sent');

    return [
      {
        label: 'Open taken',
        value: String(openTasks.length),
        detail: `${doneLast7Days} afgerond in 7 dagen`,
        onPress: () => {
          setSelectedTaskGroup('all');
          setSelectedTaskStatus('open');
        },
      },
      {
        label: 'Recall',
        value: String(recallOpen),
        detail: recallOpen > 0 ? 'Kritieke opvolging actief' : 'Geen open recalls',
        onPress: () => {
          setSelectedTaskGroup('Recall');
          setSelectedTaskStatus('open');
        },
      },
      {
        label: 'AI controle',
        value: String(aiOpen),
        detail: aiOpen > 0 ? 'Scanzekerheid vraagt review' : 'Geen AI follow-up open',
        onPress: () => {
          setSelectedTaskGroup('AI controle');
          setSelectedTaskStatus('open');
        },
      },
      {
        label: 'Besteldruk',
        value: String(activeOrders.length),
        detail:
          activeOrders.length > 0
            ? `${activeOrders.reduce((sum, purchaseOrder) => sum + purchaseOrder.lines.length, 0)} open bestellijnen`
            : 'Geen open bestelvoorstellen',
        onPress: () => router.push('/payments'),
      },
    ] as const;
  }, [router, scopedPurchaseOrders, scopedTasks]);

  const summaryCards = [
    {
      label: 'Topprioriteit',
      value: topPriority?.title ?? 'Geen open punten',
      detail: topPriority?.stat ?? 'Rustig',
      href: (topPriority?.href ?? '/explore') as Href,
      tone: '#dc2626',
      surface: '#fef2f2',
    },
    {
      label: 'Open opvolging',
      value: `${alerts.filter((alert) => alert.priority !== 'Laag').length} actief`,
      detail: `${metrics.expiringSoon} vervalalert(s) in voorraad`,
      href: '/explore',
      tone: '#b45309',
      surface: '#fffbeb',
    },
    {
      label: 'Slimme staat',
      value: financeEntries.length > 0 ? 'Financien gekoppeld' : 'Financien ontbreekt',
      detail: `${metrics.totalProducts} producten in monitoring`,
      href: (financeEntries.length > 0 ? '/explore' : '/payments') as Href,
      tone: '#1d4ed8',
      surface: '#eff6ff',
    },
  ] satisfies { label: string; value: string; detail: string; href: Href; tone: string; surface: string }[];
  const alertsTransportUseCase = topPriority?.href === '/trace' ? 'Logistiek' : topPriority?.href === '/payments' ? 'Zakelijk' : 'Delivery';
  const alertsTransportFocus = useMemo(
    () => buildTransportAiContext({ region: 'Europa', useCase: alertsTransportUseCase, preferences: transportPreferences }).transport,
    [alertsTransportUseCase, transportPreferences]
  );
  const alertsAiContext = useMemo(
    () => ({
      selectedLocation,
      metrics: {
        totalProducts: metrics.totalProducts,
        expiringSoon: metrics.expiringSoon,
        lowStockCount: filteredItems.filter((item) => item.quantity <= 1).length,
      },
      topPriority: topPriority
        ? {
            title: topPriority.title,
            priority: topPriority.priority,
            stat: topPriority.stat,
            href: topPriority.href,
          }
        : null,
      openTasks: scopedTasks.filter((task) => task.status === 'open').length,
      groupedTaskStats,
      purchasePressure: scopedPurchaseOrders.filter((purchaseOrder) => purchaseOrder.status !== 'sent').length,
      liveAlerts: recentLiveAlerts.slice(0, 4).map((entry) => ({
        title: entry.title,
        detail: entry.detail,
        href: entry.href,
      })),
      transportFocus: alertsTransportFocus,
    }),
    [
      alertsTransportFocus,
      groupedTaskStats,
      metrics.expiringSoon,
      metrics.totalProducts,
      filteredItems,
      recentLiveAlerts,
      scopedPurchaseOrders,
      scopedTasks,
      selectedLocation,
      topPriority,
    ]
  );

  const askAlertsAi = useCallback(async () => {
    setRealAiState('loading');
    setRealAiAnswer(null);
    setRealAiError('');

    try {
      const answer = await requestRealAi({
        screen: 'alerts',
        question: 'Welke opvolging, transportpartner of volgende schermactie raad je nu aan voor deze alertcontext?',
        context: alertsAiContext,
      });
      setRealAiAnswer(answer);
      setRealAiState('done');
    } catch (error) {
      setRealAiState('error');
      setRealAiAnswer(null);
      setRealAiError(error instanceof Error ? error.message : 'De echte AI is nu niet bereikbaar.');
    }
  }, [alertsAiContext]);
  const recommendedAlertsTransportApp = useMemo(
    () =>
      alertsTransportFocus.recommendedPartner
        ? transportApps.find((entry) => entry.id === alertsTransportFocus.recommendedPartner?.id) ?? null
        : null,
    [alertsTransportFocus.recommendedPartner]
  );
  const alertsTransportPreferenceMeta = useMemo(() => {
    if (!recommendedAlertsTransportApp) return null;
    const defaultPreference =
      getTransportPreferenceForScope(transportPreferences, {
        scopeType: 'useCase',
        scopeValue: alertsTransportUseCase,
        kind: 'default',
      })[0] ??
      getTransportPreferenceForScope(transportPreferences, {
        scopeType: 'region',
        scopeValue: 'Europa',
        kind: 'default',
      })[0] ??
      null;
    const favoriteCount = transportPreferences.filter(
      (entry) =>
        entry.kind === 'favorite' &&
        entry.appId === recommendedAlertsTransportApp.id &&
        ((entry.scopeType === 'useCase' && entry.scopeValue === alertsTransportUseCase) ||
          (entry.scopeType === 'region' && entry.scopeValue === 'Europa'))
    ).length;
    const activePreference = defaultPreference?.appId === recommendedAlertsTransportApp.id ? defaultPreference : null;
    return {
      isDefault: Boolean(activePreference),
      favoriteCount,
      syncMeta: activePreference ? getTransportPreferenceSyncMeta(activePreference.syncState) : null,
    };
  }, [alertsTransportUseCase, recommendedAlertsTransportApp, transportPreferences]);
  const openAlertsTransportPartner = useCallback(async () => {
    if (!recommendedAlertsTransportApp) {
      Alert.alert('Geen partner', 'Er is nog geen transportpartner aanbevolen voor deze alertscope.');
      return;
    }
    const followupLabel = buildAlertsTransportFollowupLabel(recommendedAlertsTransportApp.label, alertsTransportUseCase);

    await logTransportAudit({
      appId: recommendedAlertsTransportApp.id,
      appLabel: recommendedAlertsTransportApp.label,
      action: 'opened',
      scopeLabel: `Use case ${alertsTransportUseCase}`,
      detail: `${recommendedAlertsTransportApp.label} direct geopend via meldingen.`,
    });
    await logTransportAudit({
      appId: recommendedAlertsTransportApp.id,
      appLabel: recommendedAlertsTransportApp.label,
      action: 'followup_logged',
      scopeLabel: `Use case ${alertsTransportUseCase}`,
      detail: followupLabel,
    });

    Linking.openURL(recommendedAlertsTransportApp.url).catch(() => {
      Alert.alert('Openen mislukt', `Kon ${recommendedAlertsTransportApp.label} niet openen.`);
    });
    setTransportFollowupNote(followupLabel);
  }, [alertsTransportUseCase, recommendedAlertsTransportApp]);
  const saveAlertsTransportPreference = useCallback(
    async (kind: 'favorite' | 'default') => {
      if (!recommendedAlertsTransportApp) {
        Alert.alert('Geen partner', 'Er is nog geen transportpartner aanbevolen voor deze alertscope.');
        return;
      }
      await saveTransportPreference({
        appId: recommendedAlertsTransportApp.id,
        scopeType: 'useCase',
        scopeValue: alertsTransportUseCase,
        kind,
      });
      await logTransportAudit({
        appId: recommendedAlertsTransportApp.id,
        appLabel: recommendedAlertsTransportApp.label,
        action: kind === 'favorite' ? 'favorite_saved' : 'default_saved',
        scopeLabel: `Use case ${alertsTransportUseCase}`,
        detail: `${recommendedAlertsTransportApp.label} ${kind === 'favorite' ? 'als favoriet' : 'als standaard'} gezet via meldingen.`,
      }).catch(() => {});
      Alert.alert(
        'Voorkeur bewaard',
        `${recommendedAlertsTransportApp.label} staat nu ${kind === 'favorite' ? 'als favoriet' : 'als standaard'} voor ${alertsTransportUseCase}.`
      );
    },
    [alertsTransportUseCase, recommendedAlertsTransportApp]
  );
  const removeAlertsTransportPreference = useCallback(
    async (kind: 'favorite' | 'default') => {
      if (!recommendedAlertsTransportApp) {
        Alert.alert('Geen partner', 'Er is nog geen transportpartner aanbevolen voor deze alertscope.');
        return;
      }
      await removeTransportPreferenceByMatch({
        appId: recommendedAlertsTransportApp.id,
        scopeType: 'useCase',
        scopeValue: alertsTransportUseCase,
        kind,
      });
      await logTransportAudit({
        appId: recommendedAlertsTransportApp.id,
        appLabel: recommendedAlertsTransportApp.label,
        action: kind === 'favorite' ? 'favorite_removed' : 'default_removed',
        scopeLabel: `Use case ${alertsTransportUseCase}`,
        detail: `${recommendedAlertsTransportApp.label} ${kind === 'favorite' ? 'als favoriet' : 'als standaard'} verwijderd via meldingen.`,
      }).catch(() => {});
      Alert.alert(
        'Voorkeur verwijderd',
        `${recommendedAlertsTransportApp.label} is verwijderd als ${kind === 'favorite' ? 'favoriet' : 'standaard'} voor ${alertsTransportUseCase}.`
      );
    },
    [alertsTransportUseCase, recommendedAlertsTransportApp]
  );

  const soundRows: { event: SoundEventId; label: string; hint: string }[] = [
    { event: 'expiry', label: 'Afboeking / verval', hint: 'Als producten bijna vervallen' },
    { event: 'restock', label: 'Stock laag', hint: 'Als bijbestellen nodig is' },
    { event: 'recognition', label: 'AI controle', hint: 'Als herkenning onzeker is' },
    { event: 'trace', label: 'Trace', hint: 'Verplaatsingen / verbruik / historiek' },
    { event: 'finance_profit', label: 'Winst (omzet)', hint: 'Bij omzet/positieve flow' },
    { event: 'finance_loss', label: 'Live verlies', hint: 'Bij live verlies, afboekingen of fees' },
  ];

  function cyclePreset(event: SoundEventId) {
    const current = soundSettings.byEvent[event] ?? defaultSoundSettings.byEvent[event] ?? 'beep';
    const idx = soundPresets.findIndex((p) => p.id === current);
    const next = soundPresets[(idx + 1) % soundPresets.length]?.id ?? 'beep';

    const nextSettings: SoundSettings = {
      ...soundSettings,
      byEvent: {
        ...soundSettings.byEvent,
        [event]: next as SoundPresetId,
      },
    };
    setSoundSettings(nextSettings);
    saveSoundSettings(nextSettings);
  }

  async function testEvent(event: SoundEventId) {
    await playEvent(event, soundSettings);
  }

  function handleCompleteTask(id: string) {
    completeTask(id);
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <ThemedView style={styles.screen}>
        <View style={styles.hero}>
          <View style={styles.heroText}>
            <View style={styles.heroBrandRow}>
              <View style={styles.heroLogoFrame}>
                <TazeLogo size={96} framed={false} />
              </View>
              <View style={styles.heroBrandCopy}>
                <ThemedText type="title">Meldingen</ThemedText>
                <ThemedText type="subtitle">Taze slimme opvolging</ThemedText>
                <ThemedText>
                  Hier zie je niet alleen meldingen, maar ook wat eerst aandacht verdient en waar je best meteen op klikt.
                </ThemedText>
              </View>
            </View>
          </View>
          <View style={styles.heroPriority}>
            <ThemedText type="defaultSemiBold" style={styles.heroPriorityTitle}>
              Eerste focus
            </ThemedText>
            <ThemedText style={styles.heroPriorityText}>
              {topPriority ? `${topPriority.title} - ${topPriority.stat}` : 'Geen open prioriteiten'}
            </ThemedText>
          </View>
        </View>

        <View style={styles.summaryRow}>
          {summaryCards.map((card) => (
            <Pressable
              key={card.label}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.summaryCard,
                { borderColor: card.tone, backgroundColor: card.surface, opacity: pressed ? 0.92 : 1 },
              ]}
              onPress={() => router.push(card.href)}>
              <ThemedText style={styles.summaryLabel}>{card.label}</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.summaryValue}>
                {card.value}
              </ThemedText>
              <ThemedText style={styles.summaryDetail}>{card.detail}</ThemedText>
            </Pressable>
          ))}
        </View>

        <TazeCard style={styles.tasksCard}>
          <TazeSectionHeader
            title="Meldingen-analyse"
            subtitle={
              selectedLocation === 'Alle vestigingen'
                ? 'Live drukte over alle vestigingen.'
                : `Focus op ${selectedLocation}.`
            }
            badge="KPI"
            badgeTone="accent"
          />
          <View style={styles.analyticsRow}>
            {alertAnalytics.map((card) => (
              <Pressable
                key={card.label}
                style={({ pressed }) => [styles.analyticsCard, pressed ? styles.analyticsCardPressed : null]}
                onPress={card.onPress}>
                <ThemedText style={styles.summaryLabel}>{card.label}</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.groupedTaskValue}>
                  {card.value}
                </ThemedText>
                <ThemedText style={styles.soundNote}>{card.detail}</ThemedText>
              </Pressable>
            ))}
          </View>
        </TazeCard>

        <RealAiCopilotPanel
          title="Echte AI op meldingen en opvolging"
          hint="Laat een echt model meekijken naar prioriteiten, logistiek, recalls en de beste transportflow."
          buttonLabel="Vraag meldingen-AI"
          loading={realAiState === 'loading'}
          onAsk={() => askAlertsAi().catch(() => {})}
          result={realAiAnswer}
          error={realAiError || null}
          onOpenTransportPartner={() => openAlertsTransportPartner().catch(() => {})}
          onSaveTransportPreference={(kind) => saveAlertsTransportPreference(kind).catch(() => {})}
          onRemoveTransportPreference={(kind) => removeAlertsTransportPreference(kind).catch(() => {})}
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
                  label: 'Transporthub geopend via meldingen-AI',
                }).catch(() => {});
              }
              router.push(
                buildTransportHubPath({
                  region: 'Europa',
                  useCase: alertsTransportUseCase,
                  partnerId: alertsTransportFocus.recommendedPartner?.id ?? null,
                  source: 'alerts',
                  auditId: realAiAnswer?.auditId ?? null,
                }) as Href
              );
              return;
            }

            router.push(route as Href);
          }}
        />

        {recommendedAlertsTransportApp ? (
          <TazeCard style={styles.transportActionCard}>
            <TazeSectionHeader
              title="Transportactie"
              subtitle="Werk meteen door vanuit de alertcontext."
              badge={alertsTransportUseCase}
              badgeTone="success"
            />
            <View style={styles.transportActionHeader}>
              <View style={styles.transportActionCopy}>
                <ThemedText type="defaultSemiBold">{recommendedAlertsTransportApp.label}</ThemedText>
                <ThemedText style={styles.soundNote}>{alertsTransportFocus.recommendedPartner?.reason}</ThemedText>
                <View style={styles.transportActionButtons}>
                  {alertsTransportPreferenceMeta?.isDefault ? <TazeBadge label="Standaard" tone="success" /> : null}
                  {(alertsTransportPreferenceMeta?.favoriteCount ?? 0) > 0 ? <TazeBadge label="Favoriet" tone="accent" /> : null}
                  {alertsTransportPreferenceMeta?.syncMeta ? (
                    <TazeBadge label={alertsTransportPreferenceMeta.syncMeta.label} tone={alertsTransportPreferenceMeta.syncMeta.tone} />
                  ) : null}
                </View>
              </View>
              <TazeBadge label="Aanbevolen" tone="success" />
            </View>
            <View style={styles.transportActionButtons}>
              <TazeButton
                label={`Open ${recommendedAlertsTransportApp.label}`}
                icon="launch"
                variant="secondary"
                onPress={() => openAlertsTransportPartner().catch(() => {})}
              />
              <TazeButton
                label="Bewaar favoriet"
                icon="favorite-border"
                variant="ghost"
                onPress={() => saveAlertsTransportPreference('favorite').catch(() => {})}
              />
              {alertsTransportPreferenceMeta?.favoriteCount ? (
                <TazeButton
                  label="Verwijder favoriet"
                  icon="heart-broken"
                  variant="ghost"
                  onPress={() => removeAlertsTransportPreference('favorite').catch(() => {})}
                />
              ) : null}
              <TazeButton
                label="Zet als standaard"
                icon="check-circle-outline"
                variant="ghost"
                onPress={() => saveAlertsTransportPreference('default').catch(() => {})}
              />
              {alertsTransportPreferenceMeta?.isDefault ? (
                <TazeButton
                  label="Verwijder standaard"
                  icon="remove-circle-outline"
                  variant="ghost"
                  onPress={() => removeAlertsTransportPreference('default').catch(() => {})}
                />
              ) : null}
              <TazeButton
                label="Open hub"
                icon="local-shipping"
                variant="ghost"
                onPress={() =>
                  router.push(
                    buildTransportHubPath({
                      region: 'Europa',
                      useCase: alertsTransportUseCase,
                      partnerId: recommendedAlertsTransportApp.id,
                      source: 'alerts',
                    }) as Href
                  )
                }
              />
            </View>
            {transportFollowupNote ? <ThemedText style={styles.transportActionNote}>{transportFollowupNote}</ThemedText> : null}
          </TazeCard>
        ) : null}

        <View style={styles.locationRow}>
          {['Alle vestigingen', ...locations].map((location) => {
            const active = location === selectedLocation;
            return (
              <Pressable
                key={location}
                style={[styles.locationChip, active ? styles.locationChipActive : null]}
                onPress={() => setSelectedLocation(location)}>
                <ThemedText
                  type="defaultSemiBold"
                  style={active ? styles.locationChipTextActive : styles.locationChipText}>
                  {location}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[styles.pushButton, pushEnabled ? styles.pushButtonActive : null]}
          onPress={() => setPushEnabled((v) => !v)}>
          <ThemedText type="defaultSemiBold" style={pushEnabled ? styles.pushButtonTextActive : styles.pushButtonText}>
            {pushEnabled ? 'Live push staat aan' : 'Zet live push aan (vestiging)'}
          </ThemedText>
        </Pressable>

        <View style={styles.soundPanel}>
          <View style={styles.soundHeader}>
            <View style={styles.soundHeaderCopy}>
              <ThemedText type="subtitle">Geluiden</ThemedText>
              <ThemedText>
                Kies per alert een toon (zoals op je gsm). Tik op een alert om de toon te horen.
              </ThemedText>
            </View>
            <Pressable
              style={[styles.soundToggle, soundSettings.enabled ? styles.soundToggleActive : null]}
              onPress={() => {
                const next = { ...soundSettings, enabled: !soundSettings.enabled };
                setSoundSettings(next);
                saveSoundSettings(next);
              }}>
              <ThemedText
                type="defaultSemiBold"
                style={soundSettings.enabled ? styles.soundToggleTextActive : styles.soundToggleText}>
                {soundSettings.enabled ? 'Geluid aan' : 'Geluid uit'}
              </ThemedText>
            </Pressable>
          </View>

          {!canPlaySounds() ? (
            <ThemedText style={styles.soundNote}>
              Geluid werkt in de browser via Web Audio. Op dit platform is het niet beschikbaar.
            </ThemedText>
          ) : null}

          <View style={styles.soundGrid}>
            {soundRows.map((row) => {
              const presetId = soundSettings.byEvent[row.event] ?? defaultSoundSettings.byEvent[row.event] ?? 'beep';
              const presetLabel = soundPresets.find((p) => p.id === presetId)?.label ?? presetId;

              return (
                <View key={row.event} style={styles.soundRow}>
                  <View style={styles.soundRowCopy}>
                    <ThemedText type="defaultSemiBold">{row.label}</ThemedText>
                    <ThemedText style={styles.soundRowHint}>{row.hint}</ThemedText>
                    <ThemedText style={styles.soundRowValue}>Toon: {presetLabel}</ThemedText>
                  </View>
                  <View style={styles.soundRowActions}>
                    <Pressable style={styles.soundButton} onPress={() => cyclePreset(row.event)}>
                      <ThemedText type="defaultSemiBold" style={styles.soundButtonText}>
                        Kies
                      </ThemedText>
                    </Pressable>
                    <Pressable style={styles.soundButton} onPress={() => testEvent(row.event)}>
                      <ThemedText type="defaultSemiBold" style={styles.soundButtonText}>
                        Test
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.soundRow}>
            <View style={styles.soundRowCopy}>
              <ThemedText type="defaultSemiBold">TalkBack</ThemedText>
              <ThemedText style={styles.soundRowHint}>Laat de app realtime meldingen voorlezen.</ThemedText>
              <ThemedText style={styles.soundRowValue}>
                {talkbackSettings.enabled ? 'Voorlezen aan' : 'Voorlezen uit'}
              </ThemedText>
            </View>
            <View style={styles.soundRowActions}>
              <Pressable
                style={styles.soundButton}
                disabled={!canTalkBack()}
                onPress={() => {
                  const next = { ...talkbackSettings, enabled: !talkbackSettings.enabled };
                  setTalkbackSettingsState(next);
                  saveTalkbackSettings(next);
                }}>
                <ThemedText type="defaultSemiBold" style={styles.soundButtonText}>
                  {talkbackSettings.enabled ? 'Uit' : 'Aan'}
                </ThemedText>
              </Pressable>
              <Pressable
                style={styles.soundButton}
                disabled={!talkbackSettings.enabled || !canTalkBack()}
                onPress={() => talkBack('Test. TalkBack staat aan.').catch(() => {})}>
                <ThemedText type="defaultSemiBold" style={styles.soundButtonText}>
                  Test
                </ThemedText>
              </Pressable>
            </View>
          </View>

          {!canTalkBack() ? (
            <ThemedText style={styles.soundNote}>TalkBack is op dit platform niet beschikbaar.</ThemedText>
          ) : null}
        </View>

        <TazeCard style={styles.livePanel}>
          <View style={styles.liveHeader}>
            <TazeSectionHeader
              title="Realtime meldingen (scan/camera)"
              subtitle="Bij elke barcode of foto komt automatisch een event binnen."
              badge="Live feed"
              badgeTone="accent"
              style={styles.liveHeaderCopy}
            />
            <Pressable
              style={[styles.liveClearButton, recentLiveAlerts.length === 0 ? styles.liveClearButtonDisabled : null]}
              disabled={recentLiveAlerts.length === 0}
              onPress={() => clearLiveAlerts()}>
              <ThemedText
                type="defaultSemiBold"
                style={recentLiveAlerts.length === 0 ? styles.liveClearTextDisabled : styles.liveClearText}>
                Wis
              </ThemedText>
            </Pressable>
          </View>

          {recentLiveAlerts.length > 0 ? (
            <View style={styles.liveList}>
              {recentLiveAlerts.map((event) => (
                <Pressable
                  key={event.id}
                  style={({ pressed }) => [styles.liveRow, { opacity: pressed ? 0.92 : 1 }]}
                  onPress={() => {
                    playEvent(event.event, soundSettings).catch(() => {});
                    router.push(event.href);
                  }}>
                  <View style={styles.liveRowCopy}>
                    <ThemedText type="defaultSemiBold">{event.title}</ThemedText>
                    <ThemedText style={styles.liveRowMeta}>
                      {formatShortTime(event.createdAt)}
                      {event.location ? ` - ${event.location}` : ''}
                    </ThemedText>
                    <ThemedText>{event.detail}</ThemedText>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <ThemedText style={styles.soundNote}>Nog geen realtime events. Scan een barcode of neem een foto.</ThemedText>
          )}
        </TazeCard>

        <View style={styles.grid}>
          {alerts.map((alert) => (
            <Pressable
              key={alert.id}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.card,
                { borderColor: alert.tone, backgroundColor: alert.surface, opacity: pressed ? 0.95 : 1 },
              ]}
              onPress={() => {
                playEvent(eventForAlertId(alert.id), soundSettings).catch(() => {});
                router.push(alert.href);
              }}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderText}>
                  <ThemedText type="defaultSemiBold">{alert.title}</ThemedText>
                  <ThemedText style={[styles.state, { color: alert.tone }]}>{alert.text}</ThemedText>
                </View>
                <TazeBadge
                  label={alert.priority}
                  tone={alert.priority === 'Hoog' ? 'danger' : alert.priority === 'Middel' ? 'warning' : 'success'}
                />
              </View>

              <View style={styles.statRow}>
                <ThemedText type="defaultSemiBold" style={[styles.statValue, { color: alert.tone }]}>
                  {alert.stat}
                </ThemedText>
                <ThemedText style={styles.statCaption}>Automatisch door het systeem gedetecteerd</ThemedText>
              </View>

              <View style={styles.relatedList}>
                {alert.related.map((item) => (
                  <View key={item} style={styles.relatedRow}>
                    <View style={[styles.relatedDot, { backgroundColor: alert.tone }]} />
                    <ThemedText style={styles.relatedText}>{item}</ThemedText>
                  </View>
                ))}
              </View>

              <View style={[styles.actionButton, { backgroundColor: alert.tone }]}>
                <ThemedText type="defaultSemiBold" style={styles.actionButtonText}>
                  {alert.cta}
                </ThemedText>
              </View>
            </Pressable>
          ))}
        </View>

        <TazeCard style={styles.tasksCard}>
          <TazeSectionHeader title="Opvolging gegroepeerd" badge="Queue" badgeTone="warning" />
          {groupedTaskStats.length === 0 ? (
            <ThemedText style={styles.soundNote}>Geen open opvolging gegroepeerd.</ThemedText>
          ) : (
            <View style={styles.groupedTaskRow}>
              {groupedTaskStats.map((group) => (
                <Pressable
                  key={group.label}
                  style={[
                    styles.groupedTaskCard,
                    selectedTaskGroup === group.label ? styles.groupedTaskCardActive : null,
                  ]}
                  onPress={() => setSelectedTaskGroup(group.label)}>
                  <ThemedText style={styles.summaryLabel}>{group.label}</ThemedText>
                  <ThemedText type="defaultSemiBold" style={styles.groupedTaskValue}>
                    {group.count}
                  </ThemedText>
                  <ThemedText style={styles.soundNote}>Open acties</ThemedText>
                </Pressable>
              ))}
              <Pressable
                style={[styles.groupedTaskCard, selectedTaskGroup === 'all' ? styles.groupedTaskCardActive : null]}
                onPress={() => setSelectedTaskGroup('all')}>
                <ThemedText style={styles.summaryLabel}>Alles</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.groupedTaskValue}>
                  {scopedTasks.filter((task) => task.status !== 'done').length}
                </ThemedText>
                <ThemedText style={styles.soundNote}>Reset filter</ThemedText>
              </Pressable>
            </View>
          )}
        </TazeCard>

        <TazeCard style={styles.tasksCard}>
          <TazeSectionHeader
            title="Taken"
            subtitle={`Groep: ${selectedTaskGroup === 'all' ? 'alles' : selectedTaskGroup} | Status: ${
              selectedTaskStatus === 'all' ? 'alles' : selectedTaskStatus === 'done' ? 'klaar' : 'open'
            } | Periode: ${
              selectedTaskDate === 'all' ? 'altijd' : selectedTaskDate === 'today' ? 'vandaag' : '7 dagen'
            }`}
            badge="Ops"
            badgeTone="primary"
          />
          <View style={styles.filterBlock}>
            <ThemedText style={styles.filterLabel}>Status</ThemedText>
            <View style={styles.filterRow}>
              <TazeChip label="Open" active={selectedTaskStatus === 'open'} onPress={() => setSelectedTaskStatus('open')} />
              <TazeChip label="Klaar" active={selectedTaskStatus === 'done'} onPress={() => setSelectedTaskStatus('done')} />
              <TazeChip label="Alles" active={selectedTaskStatus === 'all'} onPress={() => setSelectedTaskStatus('all')} />
            </View>
          </View>
          <View style={styles.filterBlock}>
            <ThemedText style={styles.filterLabel}>Periode</ThemedText>
            <View style={styles.filterRow}>
              <TazeChip label="Vandaag" active={selectedTaskDate === 'today'} onPress={() => setSelectedTaskDate('today')} />
              <TazeChip label="7 dagen" active={selectedTaskDate === '7d'} onPress={() => setSelectedTaskDate('7d')} />
              <TazeChip label="Altijd" active={selectedTaskDate === 'all'} onPress={() => setSelectedTaskDate('all')} />
            </View>
          </View>
          {filteredTasks.length === 0 ? (
            <ThemedText style={styles.soundNote}>Geen taken voor deze combinatie van filters.</ThemedText>
          ) : (
            filteredTasks.map((task) => (
              <View key={task.id} style={styles.taskRow}>
                <View style={{ flex: 1, gap: 4 }}>
                  <ThemedText type="defaultSemiBold">
                    {task.title}
                  </ThemedText>
                  <TazeBadge label={task.status === 'done' ? 'Klaar' : 'Open'} tone={task.status === 'done' ? 'success' : 'warning'} />
                  {task.detail ? <ThemedText style={styles.soundNote}>{task.detail}</ThemedText> : null}
                  <ThemedText style={styles.meta}>
                    {task.location ?? 'Algemeen'}
                    {task.dueAt ? ` - due ${formatShortTime(task.dueAt)}` : ''}
                  </ThemedText>
                </View>
                {task.status !== 'done' ? (
                  <Pressable style={styles.pillButton} onPress={() => handleCompleteTask(task.id)}>
                    <ThemedText style={styles.pillText}>Markeer</ThemedText>
                  </Pressable>
                ) : null}
              </View>
            ))
          )}
        </TazeCard>

        <TazeCard style={styles.tasksCard}>
          <TazeSectionHeader title="Bestelvoorstellen" badge="Voorstellen" badgeTone="info" />
          {purchaseOrders.length === 0 ? (
            <ThemedText style={styles.soundNote}>Nog geen bestelbonnen.</ThemedText>
          ) : (
            purchaseOrders.slice(0, 5).map((po) => (
              <View key={po.id} style={styles.poRow}>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.poHeaderRow}>
                    <ThemedText type="defaultSemiBold">{po.location ?? 'Algemeen'}</ThemedText>
                    <TazeBadge
                      label={po.status.toUpperCase()}
                      tone={po.status === 'approved' ? 'success' : po.status === 'draft' ? 'warning' : 'accent'}
                    />
                  </View>
                  <ThemedText style={styles.soundNote}>
                    {po.lines.length} lijnen - {formatShortTime(po.createdAt)}
                  </ThemedText>
                </View>
                <Pressable style={styles.pillButton} onPress={() => router.push('/payments')}>
                  <ThemedText style={styles.pillText}>Open</ThemedText>
                </Pressable>
              </View>
            ))
          )}
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
  hero: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
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
    borderColor: 'rgba(248,113,113,0.32)',
    backgroundColor: Brand.dark,
  },
  heroLogo: {
    width: '100%',
    height: '100%',
  },
  heroPriority: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 180,
    borderRadius: 20,
    padding: 16,
    backgroundColor: Brand.dark,
    justifyContent: 'center',
    gap: 4,
  },
  heroPriorityTitle: {
    color: '#cbd5e1',
  },
  heroPriorityText: {
    color: '#ffffff',
    fontSize: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'stretch',
  },
  summaryCard: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 200,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 4,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    boxShadow: '0px 12px 28px rgba(15, 23, 42, 0.06)',
  },
  summaryLabel: {
    color: '#64748b',
    fontSize: 12,
  },
  summaryValue: {
    color: '#0f172a',
  },
  summaryDetail: {
    color: '#475569',
    fontSize: 12,
  },
  groupedTaskRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  analyticsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  analyticsCard: {
    flexGrow: 1,
    flexBasis: 170,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.72)',
    padding: 14,
    gap: 4,
  },
  analyticsCardPressed: {
    opacity: 0.9,
  },
  groupedTaskCard: {
    flexGrow: 1,
    flexBasis: 180,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 14,
    gap: 4,
  },
  groupedTaskCardActive: {
    borderColor: Brand.accent,
    backgroundColor: 'rgba(236,254,245,0.92)',
  },
  groupedTaskValue: {
    color: '#0f172a',
    fontSize: 24,
  },
  filterBlock: {
    gap: 6,
  },
  filterLabel: {
    color: '#64748b',
    fontSize: 12,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pushButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.82)',
    backgroundColor: 'rgba(255,255,255,0.72)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 6,
    alignItems: 'center',
  },
  pushButtonActive: {
    borderColor: Brand.accent,
    backgroundColor: 'rgba(236,254,245,0.92)',
  },
  pushButtonText: {
    color: '#0f172a',
  },
  pushButtonTextActive: {
    color: '#0f766e',
  },
  locationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  locationChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.82)',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  locationChipActive: {
    borderColor: Brand.accent,
    backgroundColor: 'rgba(236,254,245,0.92)',
  },
  locationChipText: {
    color: '#0f172a',
  },
  locationChipTextActive: {
    color: '#0f766e',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  soundPanel: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 18,
    gap: 14,
  },
  soundHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  soundHeaderCopy: {
    flex: 1,
    minWidth: 220,
    gap: 4,
  },
  soundToggle: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.82)',
    backgroundColor: 'rgba(255,255,255,0.72)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  soundToggleActive: {
    borderColor: Brand.accent,
    backgroundColor: 'rgba(236,254,245,0.92)',
  },
  soundToggleText: {
    color: '#0f172a',
  },
  soundToggleTextActive: {
    color: '#0f766e',
  },
  soundNote: {
    color: '#64748b',
    fontSize: 12,
  },
  soundGrid: {
    gap: 10,
  },
  livePanel: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 18,
    gap: 14,
  },
  liveHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  liveHeaderCopy: {
    flex: 1,
    minWidth: 220,
    gap: 4,
  },
  liveClearButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  liveClearButtonDisabled: {
    opacity: 0.6,
  },
  liveClearText: {
    color: '#0f172a',
  },
  liveClearTextDisabled: {
    color: '#94a3b8',
  },
  liveList: {
    gap: 10,
  },
  liveRow: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(248,250,252,0.9)',
    padding: 14,
  },
  liveRowCopy: {
    gap: 4,
  },
  liveRowMeta: {
    color: '#64748b',
    fontSize: 12,
  },
  soundRow: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(248,250,252,0.9)',
    padding: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  soundRowCopy: {
    flex: 1,
    minWidth: 200,
    gap: 2,
  },
  soundRowHint: {
    color: '#64748b',
    fontSize: 12,
  },
  soundRowValue: {
    color: '#334155',
    fontSize: 12,
  },
  pillButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0f766e',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillText: {
    color: '#0f766e',
    fontWeight: '600',
  },
  soundRowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'flex-start',
  },
  soundButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.82)',
    backgroundColor: 'rgba(255,255,255,0.72)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  soundButtonText: {
    color: '#0f172a',
  },
  card: {
    flexGrow: 1,
    flexBasis: 320,
    minWidth: 240,
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    gap: 14,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    boxShadow: '0px 16px 32px rgba(15, 23, 42, 0.07)',
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardHeaderText: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  priorityBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  priorityBadgeText: {
    color: '#ffffff',
    fontSize: 11,
  },
  state: {
    fontSize: 15,
    lineHeight: 22,
  },
  statRow: {
    gap: 2,
  },
  statValue: {
    fontSize: 18,
  },
  statCaption: {
    color: '#64748b',
    fontSize: 12,
  },
  relatedList: {
    gap: 8,
  },
  relatedRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  relatedDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginTop: 7,
  },
  relatedText: {
    flex: 1,
    color: '#334155',
  },
  actionButton: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  actionButtonText: {
    color: '#ffffff',
  },
  tasksCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 18,
    gap: 10,
  },
  taskRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(226,232,240,0.72)',
  },
  poRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(226,232,240,0.72)',
  },
  poHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  meta: {
    color: '#9ca3af',
    fontSize: 12,
  },
  transportActionCard: {
    gap: 14,
  },
  transportActionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  transportActionCopy: {
    flex: 1,
    gap: 6,
  },
  transportActionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  transportActionNote: {
    color: '#0f766e',
    fontSize: 12,
    lineHeight: 18,
  },
});

