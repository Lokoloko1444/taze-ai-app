import { useCallback, useEffect, useMemo, useState } from 'react';
import { Href, useRouter } from 'expo-router';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';

import { RealAiCopilotPanel } from 'components/real-ai-copilot-panel';
import { TazeBadge } from 'components/taze-badge';
import { TazeButton } from 'components/taze-button';
import { TazeCard } from 'components/taze-card';
import { TazeChip } from 'components/taze-chip';
import { TazeHero } from 'components/taze-hero';
import { TazeInput } from 'components/taze-input';
import { TazeSectionHeader } from 'components/taze-section-header';
import { ScreenAiPanel } from 'components/screen-ai-panel';
import { ThemedText } from 'components/themed-text';
import { ThemedView } from 'components/themed-view';
import { Brand } from 'constants/theme';
import { useResponsiveLayout } from 'hooks/use-responsive-layout';
import { useAuth } from 'lib/auth-context';
import { markAiAuditInteraction, markAiAuditOutcome } from 'lib/ai-audit';
import { requestRealAi, type RealAiResponse } from 'lib/real-ai';
import { logTransportAudit } from 'lib/transport-audit';
import {
  appendTraceEvent,
  getCachedTraceEvents,
  loadTraceEvents,
  subscribeTraceEvents,
  syncTraceEvents,
  type TraceEventRecord,
} from 'lib/trace-event-log';
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
import {
  consumeStock,
  persistInventoryStateToCloudNow,
  recordWaste,
  seedDemoDatabase,
  transferStock,
  updateInventoryItemCorrection,
  useInventory,
} from 'hooks/use-inventory';
import { t, type TranslationKey } from 'lib/i18n';

function formatTraceTranslation(template: string, replacements: Record<string, string | number> = {}) {
  return Object.entries(replacements).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template
  );
}

function traceT(key: TranslationKey, replacements: Record<string, string | number> = {}) {
  return formatTraceTranslation(t(key), replacements);
}

function traceQuantity(value: string | number) {
  return traceT('trace.value.quantityUnit', { quantity: value });
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('nl-BE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function labelForMovement(type: string) {
  switch (type) {
    case 'stocktake':
      return traceT('trace.movement.stocktake');
    case 'receive':
      return traceT('trace.movement.receive');
    case 'sale':
      return traceT('trace.movement.sale');
    case 'waste':
      return traceT('trace.movement.waste');
    case 'transfer':
      return traceT('trace.movement.transfer');
    case 'adjust':
      return traceT('trace.movement.adjust');
    default:
      return traceT('trace.movement.default');
  }
}

function labelForTraceEventKind(kind: string) {
  switch (kind) {
    case 'transfer':
      return traceT('trace.event.transfer');
    case 'consume':
      return traceT('trace.event.consume');
    case 'waste':
      return traceT('trace.event.waste');
    case 'inventory_mutation':
      return traceT('trace.event.inventoryMutation');
    default:
      return traceT('trace.event.scan');
  }
}

function buildTraceTransportFollowupLabel(partnerLabel: string, selectedItemName: string | null) {
  if (selectedItemName) {
    return traceT('trace.feedback.transportFollowupWithItem', { partner: partnerLabel, item: selectedItemName });
  }
  return traceT('trace.feedback.transportFollowupWithoutItem', { partner: partnerLabel });
}

function getTransportPreferenceSyncMeta(state: 'local' | 'queued' | 'synced') {
  switch (state) {
    case 'synced':
      return { label: traceT('trace.sync.synced'), tone: 'success' as const };
    case 'queued':
      return { label: traceT('trace.sync.queued'), tone: 'warning' as const };
    default:
      return { label: traceT('trace.sync.local'), tone: 'neutral' as const };
  }
}

function isLowConfidenceTraceEvent(event: TraceEventRecord) {
  return event.confidence !== null && event.confidence < 0.75;
}

function parseTraceNoteField(note: string, key: string) {
  const prefix = `${key}=`;
  const match = note
    .split('|')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : null;
}

function buildCorrectionAuditNote(input: {
  event: TraceEventRecord;
  previousName: string;
  previousCategory: string;
  previousLocation: string;
  finalName: string;
  finalCategory: string;
  finalLocation: string;
  finalQuantity: number;
  confirmedBy: string;
}) {
  const aiSuggestedLocation = parseTraceNoteField(input.event.note, 'ai_suggested_location') ?? input.event.toLocation ?? input.event.location ?? '-';
  const aiSuggestedAction = parseTraceNoteField(input.event.note, 'ai_suggested_action') ?? '-';
  const aiSuggestedReason = parseTraceNoteField(input.event.note, 'ai_reason') ?? parseTraceNoteField(input.event.note, 'ai_suggested_reason') ?? '-';
  const recognitionSource = parseTraceNoteField(input.event.note, 'recognition_source') ?? input.event.source;
  const originalConfidence = input.event.confidence !== null ? Math.round(input.event.confidence * 100) : 'unknown';

  return [
    'Menselijke correctie bevestigd',
    `original_event_id=${input.event.id}`,
    `original_barcode=${input.event.barcode ?? '-'}`,
    `original_name=${input.previousName}`,
    `original_category=${input.previousCategory}`,
    `original_location=${input.previousLocation}`,
    `product_name=${input.finalName}`,
    `category=${input.finalCategory}`,
    'source=manual',
    `status=saved`,
    `selected_location=${input.finalLocation}`,
    `suggested_location=${aiSuggestedLocation}`,
    `selected_action=Menselijke correctie`,
    `suggested_action=${aiSuggestedAction}`,
    `ai_confidence=${originalConfidence}`,
    `ai_reason=${aiSuggestedReason}`,
    `recognition_source=${recognitionSource}`,
    `recognition_confidence=${originalConfidence}`,
    `ai_suggested_location=${aiSuggestedLocation}`,
    `ai_suggested_action=${aiSuggestedAction}`,
    `ai_suggested_reason=${aiSuggestedReason}`,
    `human_corrected_name=${input.finalName}`,
    `human_corrected_category=${input.finalCategory}`,
    `confirmed_location=${input.finalLocation}`,
    `confirmed_quantity=${input.finalQuantity}`,
    `confirmed_by_user=${input.confirmedBy}`,
    `previous_location=${input.previousLocation}`,
    `ai_followed=${aiSuggestedLocation !== input.finalLocation ? 'false' : 'true'}`,
    `ai_suggestion_overridden=${aiSuggestedLocation !== input.finalLocation ? 'true' : 'false'}`,
  ].join(' | ');
}

const PHASE_TEST_LOCATIONS = ['Bar', 'Keuken', 'Koelcel', 'Transport'] as const;

function getTraceActor(note: string | null | undefined) {
  if (!note) return null;
  return parseTraceNoteField(note, 'confirmed_by_user') ?? parseTraceNoteField(note, 'confirmed_by');
}

function getSavedStatus(confidence: number | null | undefined) {
  return confidence !== null && confidence !== undefined && confidence < 0.75 ? 'needs_review' : 'saved';
}

function getTracePhotoUri(note: string, key: string) {
  const value = parseTraceNoteField(note, key);
  return value && value !== '-' ? value : null;
}

function getTraceAuditMeta(event: TraceEventRecord | null | undefined) {
  if (!event) {
    return {
      selectedLocation: null,
      suggestedLocation: null,
      selectedAction: null,
      suggestedAction: null,
      aiConfidence: null,
      aiReason: null,
      status: null,
      previousLocation: null,
      actor: null,
      userRole: null,
      sourceType: null,
      actionType: null,
      recognitionPhotoUri: null,
      proofPhotoUri: null,
      aiFollowed: null,
      humanOverride: null,
    };
  }

  const note = event.note ?? '';
  const selectedLocation =
    parseTraceNoteField(note, 'selected_location') ??
    parseTraceNoteField(note, 'confirmed_location') ??
    event.toLocation ??
    event.location ??
    null;
  const suggestedLocation =
    parseTraceNoteField(note, 'suggested_location') ??
    parseTraceNoteField(note, 'ai_suggested_location') ??
    null;
  const aiConfidence =
    parseTraceNoteField(note, 'ai_confidence') ??
    parseTraceNoteField(note, 'recognition_confidence') ??
    (event.confidence !== null ? String(Math.round(event.confidence * 100)) : null);
  const status = parseTraceNoteField(note, 'status') ?? getSavedStatus(event.confidence);
  const humanOverride =
    parseTraceNoteField(note, 'ai_suggestion_overridden') ??
    (selectedLocation && suggestedLocation ? (selectedLocation === suggestedLocation ? 'false' : 'true') : null);
  const aiFollowed =
    parseTraceNoteField(note, 'ai_followed') ??
    (humanOverride ? (humanOverride === 'true' ? 'false' : 'true') : null);

  return {
    selectedLocation,
    suggestedLocation,
    selectedAction: parseTraceNoteField(note, 'selected_action') ?? parseTraceNoteField(note, 'confirmed_action'),
    suggestedAction: parseTraceNoteField(note, 'suggested_action') ?? parseTraceNoteField(note, 'ai_suggested_action'),
    aiConfidence,
    aiReason: parseTraceNoteField(note, 'ai_reason') ?? parseTraceNoteField(note, 'ai_suggested_reason'),
    status,
    previousLocation: parseTraceNoteField(note, 'previous_location') ?? event.fromLocation,
    actor: getTraceActor(note) ?? event.source,
    userRole: parseTraceNoteField(note, 'user_role'),
    sourceType: parseTraceNoteField(note, 'source') ?? event.source,
    actionType: parseTraceNoteField(note, 'action_type'),
    recognitionPhotoUri: getTracePhotoUri(note, 'recognition_photo'),
    proofPhotoUri: getTracePhotoUri(note, 'proof_photo'),
    aiFollowed,
    humanOverride,
  };
}

type MutationDelta = {
  label: string;
  amount: number;
};

type MutationSummary = {
  itemId: string;
  actionLabel: string;
  detail: string;
  deltas: MutationDelta[];
  timestamp: string;
};

export default function TraceScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { pageMaxWidth, pagePadding } = useResponsiveLayout();
  const { items, locations, movements } = useInventory();
  const [traceEvents, setTraceEvents] = useState(() => getCachedTraceEvents());
  const [selectedLocation, setSelectedLocation] = useState<string>(traceT('trace.location.all'));
  const [query, setQuery] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [traceLookupOpen, setTraceLookupOpen] = useState(false);
  const [traceLookupValue, setTraceLookupValue] = useState('');
  const [traceLookupMessage, setTraceLookupMessage] = useState<string | null>(null);

  const [transferTarget, setTransferTarget] = useState<string>('');
  const [transferQty, setTransferQty] = useState<string>('');
  const [lastMutationSummary, setLastMutationSummary] = useState<MutationSummary | null>(null);

  const [consumeQty, setConsumeQty] = useState<string>('1');
  const [wasteQty, setWasteQty] = useState<string>('1');
  const [wasteUnitCost, setWasteUnitCost] = useState<string>('');
  const [realAiState, setRealAiState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [realAiAnswer, setRealAiAnswer] = useState<RealAiResponse | null>(null);
  const [realAiError, setRealAiError] = useState('');
  const [transportFollowupNote, setTransportFollowupNote] = useState<string | null>(null);
  const [transportPreferences, setTransportPreferences] = useState(() => getCachedTransportPreferences());
  const [correctionEvent, setCorrectionEvent] = useState<TraceEventRecord | null>(null);
  const [correctionName, setCorrectionName] = useState('');
  const [correctionCategory, setCorrectionCategory] = useState('');
  const [correctionLocation, setCorrectionLocation] = useState('');
  const [correctionQuantity, setCorrectionQuantity] = useState('1');
  const [correctionBusy, setCorrectionBusy] = useState(false);
  const [correctionMessage, setCorrectionMessage] = useState<string | null>(null);
  const locationCounts = useMemo(() => {
    const map = new Map<string, number>();
    locations.forEach((location) => map.set(location, 0));
    items.forEach((item) => {
      map.set(item.location, (map.get(item.location) ?? 0) + item.quantity);
    });
    return map;
  }, [items, locations]);

  useEffect(() => {
    let cancelled = false;
    loadTraceEvents()
      .then(async (entries) => {
        if (!cancelled) {
          setTraceEvents(entries);
        }
        const syncedEntries = await syncTraceEvents();
        if (!cancelled) {
          setTraceEvents(syncedEntries);
        }
      })
      .catch(() => {});

    const unsubscribe = subscribeTraceEvents((entries) => {
      if (!cancelled) {
        setTraceEvents(entries);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

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

  const filteredItems = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();
    return items
      .filter((item) => (selectedLocation === traceT('trace.location.all') ? true : item.location === selectedLocation))
      .filter((item) => {
        if (!trimmedQuery) return true;
        const haystack = `${item.id} ${item.name} ${item.category} ${item.location} ${item.barcode ?? ''}`.toLowerCase();
        return haystack.includes(trimmedQuery);
      })
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name, 'nl-BE'));
  }, [items, query, selectedLocation]);
  const scopedMovements = useMemo(
    () =>
      selectedLocation === traceT('trace.location.all')
        ? movements
        : movements.filter(
            (movement) =>
              movement.fromLocation === selectedLocation || movement.toLocation === selectedLocation
          ),
    [movements, selectedLocation]
  );
  const scopedTraceEvents = useMemo(
    () =>
      selectedLocation === traceT('trace.location.all')
        ? traceEvents
        : traceEvents.filter(
            (entry) =>
              entry.location === selectedLocation ||
              entry.fromLocation === selectedLocation ||
              entry.toLocation === selectedLocation
          ),
    [selectedLocation, traceEvents]
  );

  const selectedItem = useMemo(
    () => (selectedItemId ? items.find((item) => item.id === selectedItemId) ?? null : null),
    [items, selectedItemId]
  );

  const selectedTimeline = useMemo(() => {
    if (!selectedItemId) return [];
    return movements
      .filter((movement) => movement.itemId === selectedItemId)
      .slice()
      .sort((left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime());
  }, [movements, selectedItemId]);
  const selectedTraceEvents = useMemo(() => {
    if (!selectedItemId) return [];
    return traceEvents.filter((entry) => entry.itemId === selectedItemId).slice(0, 8);
  }, [selectedItemId, traceEvents]);
  const phaseTestOverview = useMemo(
    () =>
      PHASE_TEST_LOCATIONS.map((location) => {
        const locationItems = items
          .filter((item) => item.location === location)
          .slice()
          .sort((left, right) => left.name.localeCompare(right.name, 'nl-BE'))
          .map((item) => {
            const itemMovements = movements
              .filter(
                (movement) =>
                  movement.itemId === item.id ||
                  movement.itemName.trim().toLowerCase() === item.name.trim().toLowerCase()
              )
              .slice()
              .sort((left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime());
            const itemTraceEvents = traceEvents
              .filter(
                (event) =>
                  event.itemId === item.id ||
                  Boolean(item.barcode && event.barcode === item.barcode) ||
                  event.itemName.trim().toLowerCase() === item.name.trim().toLowerCase()
              )
              .slice()
              .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
            const latestMovement = itemMovements[0] ?? null;
            const latestTrace = itemTraceEvents[0] ?? null;
            const auditMeta = getTraceAuditMeta(latestTrace);
            const previousLocation =
              auditMeta.previousLocation ?? latestTrace?.fromLocation ?? latestMovement?.fromLocation ?? null;
            const timestamp = latestTrace?.createdAt ?? latestMovement?.recordedAt ?? item.capturedAt;
            const actor = auditMeta.actor ?? latestMovement?.source ?? item.source;
            const status = auditMeta.status ?? getSavedStatus(latestTrace?.confidence ?? item.confidence);

            return {
              item,
              previousLocation,
              timestamp,
              actor,
              status,
              auditMeta,
            };
          });

        return {
          location,
          totalQuantity: locationItems.reduce((sum, row) => sum + row.item.quantity, 0),
          rows: locationItems,
        };
      }),
    [items, movements, traceEvents]
  );
  const visibleMutationSummary = lastMutationSummary && lastMutationSummary.itemId === selectedItemId ? lastMutationSummary : null;
  const correctionItem = useMemo(() => {
    if (!correctionEvent) return null;
    return (
      items.find((item) => item.id === correctionEvent.itemId) ??
      items.find((item) => correctionEvent.barcode && item.barcode === correctionEvent.barcode) ??
      items.find((item) => item.name.trim().toLowerCase() === correctionEvent.itemName.trim().toLowerCase()) ??
      null
    );
  }, [correctionEvent, items]);

  const recentMovements = useMemo(() => scopedMovements.slice(0, 12), [scopedMovements]);
  const traceAnalytics = useMemo(() => {
    const wasteEvents = scopedTraceEvents.filter((entry) => entry.eventKind === 'waste');
    const transferEvents = scopedTraceEvents.filter((entry) => entry.eventKind === 'transfer');
    const lowConfidenceEvents = scopedTraceEvents.filter(
      (entry) => entry.confidence !== null && entry.confidence < 0.8
    );
    const auditMeta = scopedTraceEvents.map((entry) => getTraceAuditMeta(entry));
    const reorderEvents = auditMeta.filter((entry) => entry.status === 'needs_reorder' || entry.actionType === 'reorder_needed');
    const transportEvents = auditMeta.filter(
      (entry) => entry.actionType === 'to_transport' || entry.selectedLocation === 'Transport'
    );
    const arrivedEvents = auditMeta.filter((entry) => entry.actionType === 'arrived');
    const deliveredEvents = auditMeta.filter((entry) => entry.actionType === 'delivered');
    const itemCounts = new Map<string, number>();
    const locationCounts = new Map<string, number>();

    scopedTraceEvents.forEach((entry) => {
      itemCounts.set(entry.itemName, (itemCounts.get(entry.itemName) ?? 0) + 1);
      const locationKey = entry.location ?? entry.toLocation ?? entry.fromLocation ?? traceT('trace.value.unknown');
      locationCounts.set(locationKey, (locationCounts.get(locationKey) ?? 0) + 1);
    });

    const topItem = [...itemCounts.entries()].sort((left, right) => right[1] - left[1])[0] ?? null;
    const busiestLocation = [...locationCounts.entries()].sort((left, right) => right[1] - left[1])[0] ?? null;
    const wasteUnits = wasteEvents.reduce((sum, entry) => sum + entry.quantity, 0);

    return [
      {
        label: traceT('trace.analytics.transfers'),
        value: String(transferEvents.length),
        detail: traceT('trace.analytics.movementsInScope', { count: scopedMovements.length }),
      },
      {
        label: traceT('trace.analytics.waste'),
        value: String(wasteUnits),
        detail: wasteEvents.length > 0 ? traceT('trace.analytics.wasteLogged', { count: wasteEvents.length }) : traceT('trace.analytics.noWasteLogged'),
      },
      {
        label: traceT('trace.analytics.topItem'),
        value: topItem?.[0] ?? traceT('trace.analytics.empty'),
        detail: topItem ? traceT('trace.analytics.traceEvents', { count: topItem[1] }) : traceT('trace.analytics.noItemHistory'),
      },
      {
        label: traceT('trace.analytics.busiestLocation'),
        value: busiestLocation?.[0] ?? traceT('trace.analytics.empty'),
        detail: busiestLocation ? traceT('trace.analytics.events', { count: busiestLocation[1] }) : traceT('trace.analytics.noLocationHistory'),
      },
      {
        label: traceT('trace.analytics.aiReview'),
        value: String(lowConfidenceEvents.length),
        detail:
          lowConfidenceEvents.length > 0
            ? traceT('trace.analytics.lowConfidenceItems')
            : traceT('trace.analytics.noLowConfidence'),
      },
      {
        label: traceT('trace.analytics.reorder'),
        value: String(reorderEvents.length),
        detail: reorderEvents.length > 0 ? traceT('trace.analytics.reorderProducts') : traceT('trace.analytics.noReorder'),
      },
      {
        label: traceT('trace.analytics.transport'),
        value: String(transportEvents.length),
        detail: transportEvents.length > 0 ? traceT('trace.analytics.transportItems') : traceT('trace.analytics.noTransport'),
      },
      {
        label: traceT('trace.analytics.arrived'),
        value: String(arrivedEvents.length),
        detail: arrivedEvents.length > 0 ? traceT('trace.analytics.arrivedConfirmed') : traceT('trace.analytics.noArrived'),
      },
      {
        label: traceT('trace.analytics.delivered'),
        value: String(deliveredEvents.length),
        detail: deliveredEvents.length > 0 ? traceT('trace.analytics.deliveredConfirmed') : traceT('trace.analytics.noDelivered'),
      },
    ] as const;
  }, [scopedMovements, scopedTraceEvents]);
  const traceTransportFocus = useMemo(
    () => buildTransportAiContext({ region: 'Europa', useCase: 'Logistiek', preferences: transportPreferences }).transport,
    [transportPreferences]
  );
  const traceAiContext = useMemo(
    () => ({
      selectedLocation,
      filteredItems: filteredItems.length,
      selectedItem: selectedItem
        ? {
            name: selectedItem.name,
            location: selectedItem.location,
            quantity: selectedItem.quantity,
            category: selectedItem.category,
            barcode: selectedItem.barcode ?? null,
          }
        : null,
      recentMovements: recentMovements.slice(0, 4).map((movement) => ({
        itemName: movement.itemName,
        type: movement.type,
        quantity: movement.quantity,
        fromLocation: movement.fromLocation ?? null,
        toLocation: movement.toLocation ?? null,
      })),
      analytics: traceAnalytics,
      traceEvents: selectedTraceEvents.slice(0, 4).map((entry) => ({
        eventKind: entry.eventKind,
        itemName: entry.itemName,
        quantity: entry.quantity,
        location: entry.location,
      })),
      transportFocus: traceTransportFocus,
    }),
    [
      filteredItems.length,
      recentMovements,
      selectedItem,
      selectedLocation,
      selectedTraceEvents,
      traceAnalytics,
      traceTransportFocus,
    ]
  );
  const selectedMovement = selectedTimeline[0] ?? null;
  const selectedAuditMeta = getTraceAuditMeta(selectedTraceEvents[0]);
  const selectedStatusLabel = selectedItem
    ? traceT('trace.value.inStock')
    : selectedMovement?.type === 'sale'
      ? traceT('trace.value.sold')
      : selectedMovement?.type === 'waste'
        ? traceT('trace.movement.waste')
        : selectedMovement?.type === 'transfer'
          ? traceT('trace.value.moved')
          : selectedMovement?.type === 'receive'
            ? traceT('trace.value.purchase')
            : selectedMovement?.type === 'adjust'
              ? traceT('trace.action.consumeTitle')
              : selectedMovement
                ? traceT('trace.value.notInStock')
                : '-';

  function ensureSelected() {
    if (selectedItemId) return true;
    Alert.alert(traceT('trace.feedback.selectItemTitle'), traceT('trace.feedback.selectItemMessage'));
    return false;
  }

  function handleOpenTraceLookup() {
    setTraceLookupOpen(true);
    setTraceLookupMessage(null);
  }

  function handleOpenTraceScanner() {
    router.push('/scan');
  }

  function handleTraceLookupSelect() {
    const lookupValue = traceLookupValue.trim();
    if (!lookupValue) {
      setTraceLookupMessage(traceT('trace.lookup.empty'));
      return;
    }

    const normalizedLookup = lookupValue.toLowerCase();
    const exactMatch =
      items.find((item) => item.barcode?.trim().toLowerCase() === normalizedLookup) ??
      items.find((item) => item.id.trim().toLowerCase() === normalizedLookup) ??
      items.find((item) => item.name.trim().toLowerCase() === normalizedLookup);
    const nameMatches = exactMatch
      ? []
      : items.filter((item) => item.name.trim().toLowerCase().includes(normalizedLookup));
    const match = exactMatch ?? (nameMatches.length === 1 ? nameMatches[0] : null);

    if (!match) {
      setTraceLookupMessage(traceT('trace.lookup.notFound', { value: lookupValue }));
      return;
    }

    setSelectedItemId(match.id);
    setTransferTarget('');
    setTraceLookupOpen(false);
    setTraceLookupValue('');
    setTraceLookupMessage(null);
  }

  function openCorrectionPanel(event: TraceEventRecord) {
    const item =
      items.find((candidate) => candidate.id === event.itemId) ??
      items.find((candidate) => event.barcode && candidate.barcode === event.barcode) ??
      items.find((candidate) => candidate.name.trim().toLowerCase() === event.itemName.trim().toLowerCase()) ??
      null;
    const location = item?.location ?? event.toLocation ?? event.location ?? event.fromLocation ?? locations[0] ?? traceT('trace.value.stockFallback');

    setCorrectionEvent(event);
    setCorrectionName(item?.name ?? event.itemName);
    setCorrectionCategory(item?.category ?? traceT('trace.correction.reviewNeeded'));
    setCorrectionLocation(location);
    setCorrectionQuantity(String(item?.quantity ?? event.quantity ?? 1));
    setCorrectionMessage(null);
    if (item?.id) {
      setSelectedItemId(item.id);
    }
  }

  async function handleConfirmCorrection() {
    if (!correctionEvent || correctionBusy) return;

    const targetItem = correctionItem;
    if (!targetItem) {
      setCorrectionMessage(traceT('trace.feedback.noCorrectionItem'));
      return;
    }

    const finalName = correctionName.trim();
    const finalCategory = correctionCategory.trim();
    const finalLocation = correctionLocation.trim();
    const finalQuantity = Math.max(1, Math.round(Number(correctionQuantity)) || 1);

    if (!finalName || !finalCategory || !finalLocation) {
      setCorrectionMessage(traceT('trace.feedback.correctionRequired'));
      return;
    }

    if (!auth.ready) {
      setCorrectionMessage(traceT('trace.feedback.sessionChecking'));
      return;
    }

    if (!auth.userId) {
      setCorrectionMessage(traceT('trace.feedback.loginForCorrection'));
      return;
    }

    setCorrectionBusy(true);
    setCorrectionMessage(traceT('trace.feedback.correctionConfirming'));

    const auditNote = buildCorrectionAuditNote({
      event: correctionEvent,
      previousName: targetItem.name,
      previousCategory: targetItem.category,
      previousLocation: targetItem.location,
      finalName,
      finalCategory,
      finalLocation,
      finalQuantity,
      confirmedBy: auth.email ?? auth.userId,
    });

    try {
      const correction = updateInventoryItemCorrection({
        itemId: targetItem.id,
        name: finalName,
        category: finalCategory,
        location: finalLocation,
        quantity: finalQuantity,
        note: auditNote,
        source: 'human-correction',
      });

      if (!correction.ok) {
        setCorrectionMessage(traceT('trace.feedback.correctionLocalFailed'));
        return;
      }

      const inventorySync = await persistInventoryStateToCloudNow();
      if (!inventorySync.ok) {
        setCorrectionMessage(
          traceT('trace.feedback.appStateNotConfirmed', { reason: inventorySync.error ?? 'sync mislukt' })
        );
        return;
      }

      const traceId = `trace-correction-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      const entries = await appendTraceEvent({
        id: traceId,
        eventKind: 'inventory_mutation',
        itemId: targetItem.id,
        itemName: finalName,
        location: finalLocation,
        fromLocation: targetItem.location,
        toLocation: finalLocation,
        quantity: finalQuantity,
        source: 'human-correction',
        barcode: correctionEvent.barcode ?? targetItem.barcode ?? null,
        batchCode: correctionEvent.batchCode ?? targetItem.batchCode ?? null,
        lotNumber: correctionEvent.lotNumber ?? targetItem.lotNumber ?? null,
        confidence: correctionEvent.confidence,
        expiryDays: correctionEvent.expiryDays ?? targetItem.expiryDays ?? null,
        note: auditNote,
      });
      const synced = entries.find((entry) => entry.id === traceId && entry.syncState === 'synced');
      if (!synced) {
        setCorrectionMessage(traceT('trace.feedback.traceEventsNotConfirmed'));
        return;
      }

      setTraceEvents(entries);
      setSelectedItemId(targetItem.id);
      setLastMutationSummary({
        itemId: targetItem.id,
        actionLabel: traceT('trace.result.correctionAction'),
        detail: `${targetItem.name} -> ${finalName}`,
        deltas: [{ label: finalLocation, amount: finalQuantity }],
        timestamp: new Date().toISOString(),
      });
      setCorrectionMessage(traceT('trace.feedback.correctionSynced'));
    } finally {
      setCorrectionBusy(false);
    }
  }

  function handleTransfer() {
    if (!ensureSelected()) return;
    if (!transferTarget) {
      Alert.alert(traceT('trace.feedback.selectTargetTitle'), traceT('trace.feedback.selectTargetMessage'));
      return;
    }
    const qty = transferQty.trim() ? Number(transferQty) : undefined;
    const result = transferStock({
      itemId: selectedItemId!,
      toLocation: transferTarget,
      quantity: typeof qty === 'number' && Number.isFinite(qty) ? qty : undefined,
      note: 'Verplaatsing trace',
      source: 'trace',
    });

    if (!result.ok) {
      Alert.alert(traceT('trace.feedback.transferFailedTitle'), result.reason);
      return;
    }

    setTransferQty('');
    setLastMutationSummary({
      itemId: selectedItemId!,
      actionLabel: traceT('trace.action.transferTitle'),
      detail: traceT('trace.result.productDetail', { productName: selectedItem?.name ?? traceT('trace.value.unknownItem') }),
      deltas: [
        { label: selectedItem?.location ?? selectedMovement?.fromLocation ?? traceT('trace.value.stockFallback'), amount: -result.movedQuantity },
        { label: transferTarget, amount: result.movedQuantity },
      ],
      timestamp: new Date().toISOString(),
    });
    appendTraceEvent({
      eventKind: 'transfer',
      itemId: selectedItem?.id ?? selectedItemId!,
      itemName: selectedItem?.name ?? traceT('trace.value.unknownItem'),
      location: transferTarget,
      fromLocation: selectedItem?.location ?? null,
      toLocation: transferTarget,
      quantity: result.movedQuantity,
      source: 'trace',
      barcode: selectedItem?.barcode ?? null,
      batchCode: selectedItem?.batchCode ?? null,
      lotNumber: selectedItem?.lotNumber ?? null,
      confidence: selectedItem?.confidence ?? null,
      expiryDays: selectedItem?.expiryDays ?? null,
      note: 'Verplaatsing trace',
    }).catch(() => {});
    Alert.alert(
      traceT('trace.feedback.transferSuccessTitle'),
      traceT('trace.feedback.transferSuccessMessage', { quantity: result.movedQuantity, target: transferTarget })
    );
  }

  function handleConsume() {
    if (!ensureSelected()) return;
    const qty = Number(consumeQty);
    const result = consumeStock({
      itemId: selectedItemId!,
      quantity: Number.isFinite(qty) ? qty : 1,
      note: 'Verbruikt (keuken/bar)',
      source: 'trace',
    });
    if (!result.ok) {
      Alert.alert(traceT('trace.feedback.actionFailedTitle'), result.reason);
      return;
    }
    setLastMutationSummary({
      itemId: selectedItemId!,
      actionLabel: traceT('trace.action.consumeTitle'),
      detail: traceT('trace.result.productDetail', { productName: selectedItem?.name ?? traceT('trace.value.unknownItem') }),
      deltas: [
        { label: selectedItem?.location ?? selectedMovement?.fromLocation ?? traceT('trace.value.stockFallback'), amount: -result.usedQuantity },
        { label: traceT('trace.action.consumeTitle'), amount: result.usedQuantity },
      ],
      timestamp: new Date().toISOString(),
    });
    appendTraceEvent({
      eventKind: 'consume',
      itemId: selectedItem?.id ?? selectedItemId!,
      itemName: selectedItem?.name ?? traceT('trace.value.unknownItem'),
      location: selectedItem?.location ?? null,
      fromLocation: selectedItem?.location ?? null,
      toLocation: null,
      quantity: result.usedQuantity,
      source: 'trace',
      barcode: selectedItem?.barcode ?? null,
      batchCode: selectedItem?.batchCode ?? null,
      lotNumber: selectedItem?.lotNumber ?? null,
      confidence: selectedItem?.confidence ?? null,
      expiryDays: selectedItem?.expiryDays ?? null,
      note: 'Verbruikt (keuken/bar)',
    }).catch(() => {});
    Alert.alert(
      traceT('trace.feedback.consumeSuccessTitle'),
      traceT('trace.feedback.consumeSuccessMessage', { quantity: result.usedQuantity, remaining: result.remainingQuantity })
    );
  }

  function handleWaste() {
    if (!ensureSelected()) return;
    const qty = Number(wasteQty);
    const unitCost = wasteUnitCost.trim() ? Number(wasteUnitCost) : null;
    const result = recordWaste({
      itemId: selectedItemId!,
      quantity: Number.isFinite(qty) ? qty : 1,
      location: selectedItem?.location ?? selectedMovement?.fromLocation ?? undefined,
      unitCost: typeof unitCost === 'number' && Number.isFinite(unitCost) ? unitCost : null,
      note: 'Afboeking trace',
      source: 'trace',
    });

    if (!result.ok) {
      const reason =
        result.reason === 'location-mismatch'
          ? traceT('trace.feedback.wasteLocationMismatch')
          : result.reason;
      Alert.alert(traceT('trace.feedback.wasteFailedTitle'), reason);
      return;
    }
    setLastMutationSummary({
      itemId: selectedItemId!,
      actionLabel: traceT('trace.movement.waste'),
      detail: traceT('trace.result.productDetail', { productName: selectedItem?.name ?? traceT('trace.value.unknownItem') }),
      deltas: [
        { label: selectedItem?.location ?? selectedMovement?.fromLocation ?? traceT('trace.value.stockFallback'), amount: -result.wastedQuantity },
        { label: traceT('trace.movement.waste'), amount: result.wastedQuantity },
      ],
      timestamp: new Date().toISOString(),
    });
    appendTraceEvent({
      eventKind: 'waste',
      itemId: selectedItem?.id ?? selectedItemId!,
      itemName: selectedItem?.name ?? traceT('trace.value.unknownItem'),
      location: selectedItem?.location ?? null,
      fromLocation: selectedItem?.location ?? null,
      toLocation: null,
      quantity: result.wastedQuantity,
      source: 'trace',
      barcode: selectedItem?.barcode ?? null,
      batchCode: selectedItem?.batchCode ?? null,
      lotNumber: selectedItem?.lotNumber ?? null,
      confidence: selectedItem?.confidence ?? null,
      expiryDays: selectedItem?.expiryDays ?? null,
      note: 'Afboeking trace',
    }).catch(() => {});

    Alert.alert(
      traceT('trace.feedback.wasteSuccessTitle'),
      traceT('trace.feedback.wasteSuccessMessage', { quantity: result.wastedQuantity, remaining: result.remainingQuantity })
    );
  }

  const allLocations = [traceT('trace.location.all'), ...locations];
  const defaultTransferTarget = transferTarget || locations.find((l) => l !== selectedItem?.location) || locations[0] || '';
  const askTraceAi = useCallback(async () => {
    setRealAiState('loading');
    setRealAiAnswer(null);
    setRealAiError('');

    try {
      const answer = await requestRealAi({
        screen: 'trace',
        question: traceT('trace.ai.question'),
        context: traceAiContext,
      });
      setRealAiAnswer(answer);
      setRealAiState('done');
    } catch (error) {
      setRealAiState('error');
      setRealAiAnswer(null);
      setRealAiError(error instanceof Error ? error.message : traceT('trace.ai.unavailable'));
    }
  }, [traceAiContext]);
  const recommendedTraceTransportApp = useMemo(
    () =>
      traceTransportFocus.recommendedPartner
        ? transportApps.find((entry) => entry.id === traceTransportFocus.recommendedPartner?.id) ?? null
        : null,
    [traceTransportFocus.recommendedPartner]
  );
  const traceTransportPreferenceMeta = useMemo(() => {
    if (!recommendedTraceTransportApp) return null;
    const defaultPreference =
      getTransportPreferenceForScope(transportPreferences, {
        scopeType: 'useCase',
        scopeValue: 'Logistiek',
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
        entry.appId === recommendedTraceTransportApp.id &&
        ((entry.scopeType === 'useCase' && entry.scopeValue === 'Logistiek') ||
          (entry.scopeType === 'region' && entry.scopeValue === 'Europa'))
    ).length;
    const activePreference = defaultPreference?.appId === recommendedTraceTransportApp.id ? defaultPreference : null;
    return {
      isDefault: Boolean(activePreference),
      favoriteCount,
      syncMeta: activePreference ? getTransportPreferenceSyncMeta(activePreference.syncState) : null,
    };
  }, [recommendedTraceTransportApp, transportPreferences]);
  const openTraceTransportPartner = useCallback(async () => {
    if (!recommendedTraceTransportApp) {
      Alert.alert(traceT('trace.feedback.noPartnerTitle'), traceT('trace.feedback.noPartnerMessage'));
      return;
    }
    const followupLabel = buildTraceTransportFollowupLabel(recommendedTraceTransportApp.label, selectedItem?.name ?? null);

    await logTransportAudit({
      appId: recommendedTraceTransportApp.id,
      appLabel: recommendedTraceTransportApp.label,
      action: 'opened',
      scopeLabel: traceT('trace.feedback.auditUseCaseLogistics'),
      detail: traceT('trace.feedback.auditOpenedDetail', { partner: recommendedTraceTransportApp.label }),
    });
    await logTransportAudit({
      appId: recommendedTraceTransportApp.id,
      appLabel: recommendedTraceTransportApp.label,
      action: 'followup_logged',
      scopeLabel: traceT('trace.feedback.auditUseCaseLogistics'),
      detail: followupLabel,
    });
    await appendTraceEvent({
      eventKind: 'transfer',
      itemId: selectedItem?.id ?? null,
      itemName: selectedItem?.name ?? traceT('trace.feedback.transportFollowupItem'),
      location: selectedLocation,
      fromLocation: selectedLocation,
      toLocation: recommendedTraceTransportApp.label,
      quantity: 1,
      source: 'transport_followup',
      barcode: selectedItem?.barcode ?? null,
      batchCode: selectedItem?.batchCode ?? null,
      lotNumber: selectedItem?.lotNumber ?? null,
      confidence: selectedItem?.confidence ?? null,
      expiryDays: selectedItem?.expiryDays ?? null,
      note: followupLabel,
    });

    Linking.openURL(recommendedTraceTransportApp.url).catch(() => {
      Alert.alert(
        traceT('trace.feedback.openFailedTitle'),
        traceT('trace.feedback.openFailedMessage', { partner: recommendedTraceTransportApp.label })
      );
    });
    setTransportFollowupNote(followupLabel);
  }, [recommendedTraceTransportApp, selectedItem, selectedLocation]);
  const saveTraceTransportPreference = useCallback(
    async (kind: 'favorite' | 'default') => {
      if (!recommendedTraceTransportApp) {
        Alert.alert(traceT('trace.feedback.noPartnerTitle'), traceT('trace.feedback.noPartnerMessage'));
        return;
      }
      const preferenceKindLabel = kind === 'favorite' ? traceT('trace.feedback.preferenceFavorite') : traceT('trace.feedback.preferenceDefault');
      await saveTransportPreference({
        appId: recommendedTraceTransportApp.id,
        scopeType: 'useCase',
        scopeValue: 'Logistiek',
        kind,
      });
      await logTransportAudit({
        appId: recommendedTraceTransportApp.id,
        appLabel: recommendedTraceTransportApp.label,
        action: kind === 'favorite' ? 'favorite_saved' : 'default_saved',
        scopeLabel: traceT('trace.feedback.auditUseCaseLogistics'),
        detail: traceT('trace.feedback.auditPreferenceSavedDetail', {
          partner: recommendedTraceTransportApp.label,
          kind: preferenceKindLabel,
        }),
      }).catch(() => {});
      Alert.alert(
        traceT('trace.feedback.preferenceSavedTitle'),
        traceT('trace.feedback.preferenceSavedMessage', {
          partner: recommendedTraceTransportApp.label,
          kind: preferenceKindLabel,
        })
      );
    },
    [recommendedTraceTransportApp]
  );
  const removeTraceTransportPreference = useCallback(
    async (kind: 'favorite' | 'default') => {
      if (!recommendedTraceTransportApp) {
        Alert.alert(traceT('trace.feedback.noPartnerTitle'), traceT('trace.feedback.noPartnerMessage'));
        return;
      }
      const preferenceKindLabel = kind === 'favorite' ? traceT('trace.feedback.preferenceFavorite') : traceT('trace.feedback.preferenceDefault');
      await removeTransportPreferenceByMatch({
        appId: recommendedTraceTransportApp.id,
        scopeType: 'useCase',
        scopeValue: 'Logistiek',
        kind,
      });
      await logTransportAudit({
        appId: recommendedTraceTransportApp.id,
        appLabel: recommendedTraceTransportApp.label,
        action: kind === 'favorite' ? 'favorite_removed' : 'default_removed',
        scopeLabel: traceT('trace.feedback.auditUseCaseLogistics'),
        detail: traceT('trace.feedback.auditPreferenceRemovedDetail', {
          partner: recommendedTraceTransportApp.label,
          kind: preferenceKindLabel,
        }),
      }).catch(() => {});
      Alert.alert(
        traceT('trace.feedback.preferenceRemovedTitle'),
        traceT('trace.feedback.preferenceRemovedMessage', {
          partner: recommendedTraceTransportApp.label,
          kind: preferenceKindLabel,
        })
      );
    },
    [recommendedTraceTransportApp]
  );

  return (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        { paddingHorizontal: pagePadding },
      ]}>
      <ThemedView style={[styles.screen, { maxWidth: pageMaxWidth }]}>
        <TazeHero
          title={traceT('trace.hero.title')}
          subtitle={traceT('trace.hero.subtitle')}
          description={traceT('trace.hero.description')}
          aside={
            <Pressable
              style={({ pressed }) => [styles.seedButton, { opacity: pressed ? 0.9 : 1 }]}
              onPress={() => {
                seedDemoDatabase();
                Alert.alert(traceT('trace.hero.seedTitle'), traceT('trace.hero.seedMessage'));
              }}>
              <MaterialIcons name="auto-fix-high" size={18} color="#ffffff" />
              <ThemedText type="defaultSemiBold" style={styles.seedButtonText}>
                {traceT('trace.hero.seedButton')}
              </ThemedText>
            </Pressable>
          }
        />

        <ScreenAiPanel
          screen="trace"
          status={{
            selectedItemName: selectedItem?.name ?? selectedMovement?.itemName ?? null,
            selectedLocation,
            filteredCount: filteredItems.length,
          }}
        />

        <View style={styles.locationRow}>
          {allLocations.map((location) => {
            const active = location === selectedLocation;
            return (
              <Pressable
                key={location}
                style={[styles.locationChip, active ? styles.locationChipActive : null]}
                onPress={() => setSelectedLocation(location)}>
                <ThemedText type="defaultSemiBold" style={active ? styles.locationChipTextActive : styles.locationChipText}>
                  {location}
                </ThemedText>
                <ThemedText type="defaultSemiBold" style={active ? styles.locationChipCountActive : styles.locationChipCount}>
                  {location === traceT('trace.location.all')
                    ? items.reduce((sum, item) => sum + item.quantity, 0)
                    : locationCounts.get(location) ?? 0}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <TazeInput
          icon="search"
          placeholder={traceT('trace.search.placeholder')}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          containerStyle={styles.searchInputWrap}
        />

        <TazeCard style={styles.phaseOverviewCard}>
          <TazeSectionHeader
            title={traceT('trace.phase.title')}
            subtitle={traceT('trace.phase.subtitle')}
            badge={traceT('trace.badge.phase')}
            badgeTone="success"
          />
          <View style={styles.phaseLocationGrid}>
            {phaseTestOverview.map((group) => (
              <View key={group.location} style={styles.phaseLocationCard}>
                <View style={styles.phaseLocationHeader}>
                  <ThemedText type="defaultSemiBold">{group.location}</ThemedText>
                  <TazeBadge label={traceQuantity(group.totalQuantity)} tone="neutral" />
                </View>
                {group.rows.length > 0 ? (
                  group.rows.slice(0, 8).map((row) => (
                    <Pressable
                      key={row.item.id}
                      accessibilityRole="button"
                      accessibilityLabel={traceT('trace.phase.openItem', { productName: row.item.name })}
                      style={({ pressed }) => [styles.phaseProductRow, { opacity: pressed ? 0.9 : 1 }]}
                      onPress={() => {
                        setSelectedItemId(row.item.id);
                        setSelectedLocation(group.location);
                      }}>
                      <View style={styles.phaseProductCopy}>
                        <ThemedText type="defaultSemiBold">{traceT('trace.label.product')}: {row.item.name}</ThemedText>
                        <ThemedText style={styles.timelineMeta}>{traceT('trace.label.barcode')}: {row.item.barcode ?? '-'}</ThemedText>
                        <ThemedText style={styles.timelineMeta}>{traceT('trace.label.currentLocation')}: {row.item.location}</ThemedText>
                        <ThemedText style={styles.timelineMeta}>{traceT('trace.label.previousLocation')}: {row.previousLocation ?? '-'}</ThemedText>
                        <ThemedText style={styles.timelineMeta}>{traceT('trace.label.aiProposal')}: {row.auditMeta.suggestedLocation ?? '-'}</ThemedText>
                        <ThemedText style={styles.timelineMeta}>{traceT('trace.label.source')}: {row.auditMeta.sourceType ?? '-'}</ThemedText>
                        <ThemedText style={styles.timelineMeta}>{traceT('trace.label.lastAction')}: {row.auditMeta.selectedAction ?? row.auditMeta.actionType ?? '-'}</ThemedText>
                        <ThemedText style={styles.timelineMeta}>
                          {traceT('trace.label.humanChoice')}: {row.auditMeta.selectedLocation ?? row.item.location}
                        </ThemedText>
                        <ThemedText style={styles.timelineMeta}>
                          {traceT('trace.label.aiFollowed')}: {row.auditMeta.aiFollowed === 'true' ? traceT('trace.value.yes') : row.auditMeta.aiFollowed === 'false' ? traceT('trace.value.no') : '-'}
                        </ThemedText>
                        <ThemedText style={styles.timelineMeta}>{traceT('trace.label.confidence')}: {row.auditMeta.aiConfidence ?? '-'}</ThemedText>
                        <ThemedText style={styles.timelineMeta}>{traceT('trace.label.lastUser')}: {row.actor ?? '-'}</ThemedText>
                        <ThemedText style={styles.timelineMeta}>{traceT('trace.label.timestamp')}: {formatTimestamp(row.timestamp)}</ThemedText>
                        {row.auditMeta.proofPhotoUri ? (
                          <Image source={{ uri: row.auditMeta.proofPhotoUri }} style={styles.traceProofImage} contentFit="cover" />
                        ) : null}
                      </View>
                      <TazeBadge label={row.status} tone={row.status === 'saved' ? 'success' : 'warning'} />
                    </Pressable>
                  ))
                ) : (
                  <ThemedText style={styles.panelHint}>{traceT('trace.phase.noProducts', { location: group.location })}</ThemedText>
                )}
              </View>
            ))}
          </View>
        </TazeCard>

        <TazeCard style={styles.panel}>
          <TazeSectionHeader
            title={traceT('trace.overview.title')}
            subtitle={
              selectedLocation === traceT('trace.location.all')
                ? traceT('trace.overview.subtitleAll')
                : traceT('trace.overview.subtitleFiltered', { location: selectedLocation })
            }
            badge={traceT('trace.badge.kpi')}
            badgeTone="accent"
          />
          <View style={styles.analyticsRow}>
            {traceAnalytics.map((card) => (
              <View key={card.label} style={styles.analyticsCard}>
                <ThemedText style={styles.itemRowMeta}>{card.label}</ThemedText>
                <ThemedText type="defaultSemiBold">{card.value}</ThemedText>
                <ThemedText style={styles.panelHint}>{card.detail}</ThemedText>
              </View>
            ))}
          </View>
        </TazeCard>

        <RealAiCopilotPanel
          title={traceT('trace.ai.title')}
          hint={traceT('trace.ai.hint')}
          buttonLabel={traceT('trace.ai.button')}
          loading={realAiState === 'loading'}
          onAsk={() => askTraceAi().catch(() => {})}
          result={realAiAnswer}
          error={realAiError || null}
          onOpenTransportPartner={() => openTraceTransportPartner().catch(() => {})}
          onSaveTransportPreference={(kind) => saveTraceTransportPreference(kind).catch(() => {})}
          onRemoveTransportPreference={(kind) => removeTraceTransportPreference(kind).catch(() => {})}
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
                  label: traceT('trace.ai.transportOpened'),
                }).catch(() => {});
              }
              router.push(
                buildTransportHubPath({
                  region: 'Europa',
                  useCase: 'Logistiek',
                  partnerId: traceTransportFocus.recommendedPartner?.id ?? null,
                  source: 'trace',
                  auditId: realAiAnswer?.auditId ?? null,
                }) as Href
              );
              return;
            }

            router.push(route as Href);
          }}
        />

        {recommendedTraceTransportApp ? (
          <TazeCard style={styles.transportActionCard}>
            <TazeSectionHeader
              title={traceT('trace.transport.title')}
              subtitle={traceT('trace.transport.subtitle')}
              badge={traceT('trace.transport.badge')}
              badgeTone="success"
            />
            <View style={styles.transportActionHeader}>
              <View style={styles.transportActionCopy}>
                <ThemedText type="defaultSemiBold">{recommendedTraceTransportApp.label}</ThemedText>
                <ThemedText style={styles.muted}>{traceTransportFocus.recommendedPartner?.reason}</ThemedText>
                <View style={styles.transportActionButtons}>
                  {traceTransportPreferenceMeta?.isDefault ? (
                    <TazeBadge label={traceT('trace.transport.defaultBadge')} tone="success" />
                  ) : null}
                  {(traceTransportPreferenceMeta?.favoriteCount ?? 0) > 0 ? (
                    <TazeBadge label={traceT('trace.transport.favoriteBadge')} tone="accent" />
                  ) : null}
                  {traceTransportPreferenceMeta?.syncMeta ? (
                    <TazeBadge label={traceTransportPreferenceMeta.syncMeta.label} tone={traceTransportPreferenceMeta.syncMeta.tone} />
                  ) : null}
                </View>
              </View>
              <TazeBadge label={traceT('trace.transport.recommendedBadge')} tone="success" />
            </View>
            <View style={styles.transportActionButtons}>
              <TazeButton
                label={traceT('trace.transport.openPartner', { partner: recommendedTraceTransportApp.label })}
                icon="launch"
                variant="secondary"
                onPress={() => openTraceTransportPartner().catch(() => {})}
              />
              <TazeButton
                label={traceT('trace.transport.saveFavorite')}
                icon="favorite-border"
                variant="ghost"
                onPress={() => saveTraceTransportPreference('favorite').catch(() => {})}
              />
              {traceTransportPreferenceMeta?.favoriteCount ? (
                <TazeButton
                  label={traceT('trace.transport.removeFavorite')}
                  icon="heart-broken"
                  variant="ghost"
                  onPress={() => removeTraceTransportPreference('favorite').catch(() => {})}
                />
              ) : null}
              <TazeButton
                label={traceT('trace.transport.setDefault')}
                icon="check-circle-outline"
                variant="ghost"
                onPress={() => saveTraceTransportPreference('default').catch(() => {})}
              />
              {traceTransportPreferenceMeta?.isDefault ? (
                <TazeButton
                  label={traceT('trace.transport.removeDefault')}
                  icon="remove-circle-outline"
                  variant="ghost"
                  onPress={() => removeTraceTransportPreference('default').catch(() => {})}
                />
              ) : null}
              <TazeButton
                label={traceT('trace.transport.openHub')}
                icon="local-shipping"
                variant="ghost"
                onPress={() =>
                  router.push(
                    buildTransportHubPath({
                      region: 'Europa',
                      useCase: 'Logistiek',
                      partnerId: recommendedTraceTransportApp.id,
                      source: 'trace',
                    }) as Href
                  )
                }
              />
            </View>
            {transportFollowupNote ? <ThemedText style={styles.muted}>{transportFollowupNote}</ThemedText> : null}
          </TazeCard>
        ) : null}

        <View style={styles.grid}>
          <TazeCard style={styles.panel}>
            <TazeSectionHeader
              title={traceT('trace.inventory.title', { count: filteredItems.length })}
              subtitle={traceT('trace.inventory.subtitle')}
              badge={traceT('trace.badge.stock')}
              badgeTone="accent"
            />

            <View style={styles.itemList}>
              {filteredItems.slice(0, 80).map((item) => {
                const active = item.id === selectedItemId;
                return (
                  <Pressable
                    key={item.id}
                    style={({ pressed }) => [
                      styles.itemRow,
                      active ? styles.itemRowActive : null,
                      { opacity: pressed ? 0.92 : 1 },
                    ]}
                    onPress={() => {
                      setSelectedItemId(item.id);
                      setTransferTarget('');
                    }}>
                    <View style={styles.itemRowCopy}>
                      <ThemedText type="defaultSemiBold">
                        {item.name} - {traceQuantity(item.quantity)}
                      </ThemedText>
                      <ThemedText style={styles.itemRowMeta}>
                        {item.location} - {item.category} - ID {item.id}
                      </ThemedText>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color="#94a3b8" />
                  </Pressable>
                );
              })}
            </View>
          </TazeCard>

          <TazeCard style={styles.panel}>
          <TazeSectionHeader
            title={traceT('trace.detail.title')}
            subtitle={traceT('trace.detail.subtitle')}
            badge={traceT('trace.badge.liveOverview')}
            badgeTone="primary"
          />

            {selectedItem || selectedMovement ? (
              <View style={styles.detailBox}>
                <View style={styles.detailHeader}>
                  <View style={styles.detailHeaderCopy}>
                    <ThemedText type="defaultSemiBold">{selectedItem?.name ?? selectedMovement?.itemName ?? traceT('trace.value.unknownItem')}</ThemedText>
                    <ThemedText type="defaultSemiBold">
                      {traceT('trace.label.product')}: {selectedItem?.name ?? selectedMovement?.itemName ?? traceT('trace.value.unknownItem')}
                    </ThemedText>
                    <ThemedText style={styles.detailMeta}>
                      {(selectedItem?.location ??
                        selectedMovement?.toLocation ??
                        selectedMovement?.fromLocation ??
                        '-')}
                      {' - '}
                      {selectedItem ? traceQuantity(selectedItem.quantity) : traceT('trace.value.notInStock')}
                      {' - '}
                      {selectedItem?.category ?? selectedMovement?.category ?? '-'}
                    </ThemedText>
                    <ThemedText style={styles.detailMeta}>
                      {traceT('trace.label.currentLocation')}: {selectedItem?.location ?? selectedMovement?.toLocation ?? '-'}
                    </ThemedText>
                    <ThemedText style={styles.detailMeta}>
                      {traceT('trace.label.previousLocation')}: {selectedTimeline[0]?.fromLocation ?? selectedTraceEvents[0]?.fromLocation ?? '-'}
                    </ThemedText>
                    <ThemedText style={styles.detailMeta}>{traceT('trace.label.barcode')}: {selectedItem?.barcode ?? selectedTraceEvents[0]?.barcode ?? '-'}</ThemedText>
                    <ThemedText style={styles.detailMeta}>
                      {traceT('trace.label.lastUser')}:{' '}
                      {getTraceActor(selectedTraceEvents[0]?.note) ??
                        selectedTraceEvents[0]?.source ??
                        selectedTimeline[0]?.source ??
                        selectedItem?.source ??
                        '-'}
                    </ThemedText>
                    <ThemedText style={styles.detailMeta}>
                      {traceT('trace.label.timestamp')}: {formatTimestamp(selectedTraceEvents[0]?.createdAt ?? selectedTimeline[0]?.recordedAt ?? new Date().toISOString())}
                    </ThemedText>
                    <ThemedText style={styles.detailMeta}>
                      {traceT('trace.label.humanChoice')}: {selectedAuditMeta.selectedLocation ?? selectedItem?.location ?? '-'}
                    </ThemedText>
                    <ThemedText style={styles.detailMeta}>
                      {traceT('trace.label.aiProposal')}: {selectedAuditMeta.suggestedLocation ?? '-'}
                      {selectedAuditMeta.suggestedAction ? ` - ${selectedAuditMeta.suggestedAction}` : ''}
                    </ThemedText>
                    <ThemedText style={styles.detailMeta}>
                      {traceT('trace.label.lastAction')}: {selectedAuditMeta.selectedAction ?? selectedAuditMeta.actionType ?? '-'}
                    </ThemedText>
                    <ThemedText style={styles.detailMeta}>
                      {traceT('trace.label.aiFollowed')}: {selectedAuditMeta.aiFollowed === 'true' ? traceT('trace.value.yes') : selectedAuditMeta.aiFollowed === 'false' ? traceT('trace.value.no') : '-'}
                    </ThemedText>
                    <ThemedText style={styles.detailMeta}>
                      {traceT('trace.label.confidence')}: {selectedAuditMeta.aiConfidence ?? '-'} - {traceT('trace.label.reason')}: {selectedAuditMeta.aiReason ?? '-'}
                    </ThemedText>
                    <ThemedText style={styles.detailMeta}>{traceT('trace.label.role')}: {selectedAuditMeta.userRole ?? '-'}</ThemedText>
                    <ThemedText style={styles.detailMeta}>{traceT('trace.label.recognitionSource')}: {selectedAuditMeta.sourceType ?? '-'}</ThemedText>
                    {selectedAuditMeta.recognitionPhotoUri ? (
                      <Image source={{ uri: selectedAuditMeta.recognitionPhotoUri }} style={styles.traceProofImage} contentFit="cover" />
                    ) : null}
                    {selectedAuditMeta.proofPhotoUri ? (
                      <Image source={{ uri: selectedAuditMeta.proofPhotoUri }} style={styles.traceProofImage} contentFit="cover" />
                    ) : null}
                    <ThemedText style={styles.detailMeta}>{traceT('trace.label.traceId')}: {selectedItemId}</ThemedText>
                    <View style={styles.detailStatusRow}>
                      <ThemedText style={styles.detailMeta}>{traceT('trace.label.status')}</ThemedText>
                      <TazeBadge label={selectedAuditMeta.status ?? selectedStatusLabel} tone="info" />
                    </View>
                    </View>
                  </View>

                {visibleMutationSummary ? (
                  <View style={styles.resultCard}>
                    <View style={styles.resultHeader}>
                      <MaterialIcons name="fact-check" size={18} color={Brand.primary} />
                      <ThemedText type="defaultSemiBold">{traceT('trace.result.title')}</ThemedText>
                      <TazeBadge label={visibleMutationSummary.actionLabel} tone="success" />
                    </View>
                    <ThemedText style={styles.muted}>{visibleMutationSummary.detail}</ThemedText>
                    <View style={styles.resultDeltaRow}>
                      {visibleMutationSummary.deltas.map((delta) => (
                        <View key={`${visibleMutationSummary.itemId}-${delta.label}`} style={styles.resultDeltaChip}>
                          <ThemedText type="defaultSemiBold" style={styles.resultDeltaLabel}>
                            {delta.label}
                          </ThemedText>
                          <ThemedText type="defaultSemiBold" style={styles.resultDeltaValue}>
                            {delta.amount > 0 ? `+${delta.amount}` : `${delta.amount}`}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                    <ThemedText style={styles.timelineMeta}>
                      {traceT('trace.result.updatedAt', { timestamp: formatTimestamp(visibleMutationSummary.timestamp) })}
                    </ThemedText>
                  </View>
                ) : null}

                {correctionEvent ? (
                  <View style={styles.correctionCard}>
                    <View style={styles.resultHeader}>
                      <MaterialIcons name="edit-note" size={20} color="#b45309" />
                      <ThemedText type="defaultSemiBold">{traceT('trace.correction.title')}</ThemedText>
                      <TazeBadge
                        label={
                          correctionEvent.confidence !== null
                            ? `${Math.round(correctionEvent.confidence * 100)}%`
                            : traceT('trace.correction.confidenceUnknown')
                        }
                        tone={isLowConfidenceTraceEvent(correctionEvent) ? 'warning' : 'info'}
                      />
                    </View>
                    <View style={styles.correctionMetaGrid}>
                      <View style={styles.analyticsCard}>
                        <ThemedText style={styles.itemRowMeta}>{traceT('trace.correction.originalBarcode')}</ThemedText>
                        <ThemedText type="defaultSemiBold">{correctionEvent.barcode ?? '-'}</ThemedText>
                      </View>
                      <View style={styles.analyticsCard}>
                        <ThemedText style={styles.itemRowMeta}>{traceT('trace.correction.originalName')}</ThemedText>
                        <ThemedText type="defaultSemiBold">{correctionEvent.itemName}</ThemedText>
                      </View>
                      <View style={styles.analyticsCard}>
                        <ThemedText style={styles.itemRowMeta}>{traceT('trace.label.aiProposal')}</ThemedText>
                        <ThemedText type="defaultSemiBold">
                          {parseTraceNoteField(correctionEvent.note, 'ai_suggested_location') ??
                            correctionEvent.toLocation ??
                            correctionEvent.location ??
                            '-'}
                        </ThemedText>
                        <ThemedText style={styles.timelineMeta}>
                          {parseTraceNoteField(correctionEvent.note, 'ai_suggested_action') ?? correctionEvent.source}
                        </ThemedText>
                      </View>
                      <View style={styles.analyticsCard}>
                        <ThemedText style={styles.itemRowMeta}>{traceT('trace.label.timestamp')}</ThemedText>
                        <ThemedText type="defaultSemiBold">{formatTimestamp(correctionEvent.createdAt)}</ThemedText>
                      </View>
                    </View>
                    <View style={styles.correctionFields}>
                      <TazeInput
                        label={traceT('trace.correction.productName')}
                        value={correctionName}
                        onChangeText={setCorrectionName}
                        placeholder={traceT('trace.correction.productNamePlaceholder')}
                        fieldStyle={styles.correctionField}
                      />
                      <TazeInput
                        label={traceT('trace.correction.category')}
                        value={correctionCategory}
                        onChangeText={setCorrectionCategory}
                        placeholder={traceT('trace.correction.categoryPlaceholder')}
                        fieldStyle={styles.correctionField}
                      />
                      <TazeInput
                        label={traceT('trace.correction.location')}
                        value={correctionLocation}
                        onChangeText={setCorrectionLocation}
                        placeholder={traceT('trace.correction.locationPlaceholder')}
                        fieldStyle={styles.correctionField}
                      />
                      <TazeInput
                        label={traceT('trace.correction.quantity')}
                        value={correctionQuantity}
                        onChangeText={setCorrectionQuantity}
                        keyboardType="numeric"
                        placeholder="1"
                        fieldStyle={styles.correctionFieldSmall}
                      />
                    </View>
                    <View style={styles.chipRow}>
                      {locations.map((location) => (
                        <TazeChip
                          key={location}
                          label={location}
                          active={correctionLocation === location}
                          onPress={() => setCorrectionLocation(location)}
                        />
                      ))}
                    </View>
                    {correctionEvent.note ? (
                      <ThemedText style={styles.timelineMeta}>
                        {traceT('trace.correction.originalAudit')}: {correctionEvent.note}
                      </ThemedText>
                    ) : null}
                    {correctionMessage ? <ThemedText style={styles.correctionMessage}>{correctionMessage}</ThemedText> : null}
                    <View style={styles.actionRow}>
                      <Pressable
                        style={[styles.actionButton, correctionBusy ? styles.actionButtonDisabled : null]}
                        disabled={correctionBusy}
                        onPress={() => {
                          void handleConfirmCorrection();
                        }}>
                        <ThemedText type="defaultSemiBold" style={styles.actionButtonText}>
                          {traceT('trace.correction.confirm')}
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        style={[styles.actionButton, styles.actionButtonGhost]}
                        onPress={() => {
                          setCorrectionEvent(null);
                          setCorrectionMessage(null);
                        }}>
                        <ThemedText type="defaultSemiBold" style={styles.actionButtonGhostText}>
                          {traceT('trace.correction.close')}
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                {selectedItem ? (
                  <>
                    <View style={styles.actionGroup}>
                      <ThemedText type="defaultSemiBold">{traceT('trace.action.transferTitle')}</ThemedText>
                      <View style={styles.chipRow}>
                        {locations
                          .filter((location) => location !== selectedItem.location)
                          .map((location) => {
                            const active = (transferTarget || defaultTransferTarget) === location;
                            return (
                              <TazeChip key={location} label={location} active={active} onPress={() => setTransferTarget(location)} />
                            );
                          })}
                      </View>

                      <View style={styles.actionRow}>
                        <TazeInput
                          placeholder={traceT('trace.action.quantityAllPlaceholder')}
                          value={transferQty}
                          onChangeText={setTransferQty}
                          keyboardType="numeric"
                          containerStyle={styles.actionInputWrap}
                        />
                        <Pressable style={styles.actionButton} onPress={handleTransfer}>
                          <ThemedText type="defaultSemiBold" style={styles.actionButtonText}>
                            {traceT('trace.action.transferButton')}
                          </ThemedText>
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.actionGroup}>
                      <ThemedText type="defaultSemiBold">{traceT('trace.action.consumeTitle')}</ThemedText>
                      <View style={styles.actionRow}>
                        <TazeInput
                          placeholder={traceT('trace.action.quantityPlaceholder')}
                          value={consumeQty}
                          onChangeText={setConsumeQty}
                          keyboardType="numeric"
                          containerStyle={styles.actionInputWrap}
                        />
                        <Pressable style={[styles.actionButton, styles.actionButtonBlue]} onPress={handleConsume}>
                          <ThemedText type="defaultSemiBold" style={styles.actionButtonText}>
                            {traceT('trace.action.consumeButton')}
                          </ThemedText>
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.actionGroup}>
                      <ThemedText type="defaultSemiBold">{traceT('trace.action.profitLossTitle')}</ThemedText>
                      <View style={styles.actionRow}>
                        <TazeInput
                          placeholder={traceT('trace.action.quantityPlaceholder')}
                          value={wasteQty}
                          onChangeText={setWasteQty}
                          keyboardType="numeric"
                          containerStyle={styles.actionInputWrap}
                        />
                        <TazeInput
                          placeholder={traceT('trace.action.unitCostPlaceholder')}
                          value={wasteUnitCost}
                          onChangeText={setWasteUnitCost}
                          keyboardType="numeric"
                          containerStyle={styles.actionInputWrap}
                        />
                        <Pressable style={[styles.actionButton, styles.actionButtonRed]} onPress={handleWaste}>
                          <ThemedText type="defaultSemiBold" style={styles.actionButtonText}>
                            {traceT('trace.action.wasteButton')}
                          </ThemedText>
                        </Pressable>
                      </View>
                    </View>
                  </>
                ) : (
                  <ThemedText style={styles.panelHint}>{traceT('trace.action.notInStock')}</ThemedText>
                )}

                <View style={styles.timeline}>
                  <ThemedText type="defaultSemiBold">{traceT('trace.timeline.movementTitle')}</ThemedText>
                  {selectedTimeline.length > 0 ? (
                    selectedTimeline.slice(0, 14).map((movement) => (
                      <View key={movement.id} style={styles.timelineRow}>
                        <View style={styles.timelineDot} />
                        <View style={styles.timelineCopy}>
                          <ThemedText type="defaultSemiBold">
                            {labelForMovement(movement.type)} - {traceQuantity(movement.quantity)}
                          </ThemedText>
                          <ThemedText style={styles.timelineMeta}>
                            {formatTimestamp(movement.recordedAt)} -{' '}
                            {traceT('trace.timeline.route', { from: movement.fromLocation ?? '-', to: movement.toLocation ?? '-' })}
                            {movement.note ? ` - ${movement.note}` : ''}
                          </ThemedText>
                        </View>
                      </View>
                    ))
                  ) : (
                    <ThemedText style={styles.panelHint}>{traceT('trace.timeline.noMovements')}</ThemedText>
                  )}
                </View>

                <View style={styles.timeline}>
                  <ThemedText type="defaultSemiBold">{traceT('trace.timeline.detailTitle')}</ThemedText>
                  {selectedTraceEvents.length > 0 ? (
                    selectedTraceEvents.map((event) => (
                      <Pressable
                        key={event.id}
                        accessibilityRole="button"
                        accessibilityLabel={traceT('trace.timeline.openCorrection')}
                        style={({ pressed }) => [
                          styles.traceEventCard,
                          isLowConfidenceTraceEvent(event) ? styles.traceEventCardWarning : null,
                          { opacity: pressed ? 0.92 : 1 },
                        ]}
                        onPress={() => openCorrectionPanel(event)}>
                        <View style={styles.traceEventHeader}>
                          <View style={styles.traceEventBadgeRow}>
                            <TazeBadge
                              label={labelForTraceEventKind(event.eventKind)}
                              tone={
                                event.eventKind === 'waste'
                                  ? 'danger'
                                  : event.eventKind === 'consume'
                                    ? 'info'
                                    : event.eventKind === 'transfer'
                                      ? 'warning'
                                      : event.eventKind === 'inventory_mutation'
                                        ? 'success'
                                        : 'accent'
                              }
                            />
                            {isLowConfidenceTraceEvent(event) ? <TazeBadge label={traceT('trace.correction.reviewNeeded')} tone="warning" /> : null}
                          </View>
                          <ThemedText style={styles.timelineMeta}>{formatTimestamp(event.createdAt)}</ThemedText>
                        </View>
                        <ThemedText type="defaultSemiBold">
                          {event.itemName} - {traceQuantity(event.quantity)}
                        </ThemedText>
                        <ThemedText style={styles.timelineMeta}>
                          {traceT('trace.timeline.source', {
                            from: event.fromLocation ?? '-',
                            to: event.toLocation ?? event.location ?? '-',
                            source: event.source,
                          })}
                        </ThemedText>
                        <ThemedText style={styles.timelineMeta}>
                          {traceT('trace.timeline.barcodeBatchLot', {
                            barcode: event.barcode ?? '-',
                            batch: event.batchCode ?? '-',
                            lot: event.lotNumber ?? '-',
                          })}
                        </ThemedText>
                        <ThemedText style={styles.timelineMeta}>
                          {traceT('trace.timeline.aiExpiry', {
                            confidence: event.confidence !== null ? `${Math.round(event.confidence * 100)}%` : '-',
                            days: event.expiryDays ?? '-',
                          })}
                        </ThemedText>
                        <ThemedText style={styles.timelineMeta}>
                          {traceT('trace.timeline.humanAiChoice', {
                            human: getTraceAuditMeta(event).selectedLocation ?? event.toLocation ?? event.location ?? '-',
                            ai: getTraceAuditMeta(event).suggestedLocation ?? '-',
                          })}
                        </ThemedText>
                        <ThemedText style={styles.timelineMeta}>
                          {traceT('trace.timeline.aiFollowedStatus', {
                            followed:
                              getTraceAuditMeta(event).aiFollowed === 'true'
                                ? traceT('trace.value.yes')
                                : getTraceAuditMeta(event).aiFollowed === 'false'
                                  ? traceT('trace.value.no')
                                  : '-',
                            status: getTraceAuditMeta(event).status ?? '-',
                          })}
                        </ThemedText>
                        <ThemedText style={styles.timelineMeta}>
                          {traceT('trace.timeline.action', {
                            action: getTraceAuditMeta(event).selectedAction ?? getTraceAuditMeta(event).actionType ?? '-',
                          })}
                        </ThemedText>
                        {getTraceAuditMeta(event).aiReason ? (
                          <ThemedText style={styles.timelineMeta}>
                            {traceT('trace.timeline.reason', { reason: getTraceAuditMeta(event).aiReason ?? '-' })}
                          </ThemedText>
                        ) : null}
                        {getTraceAuditMeta(event).proofPhotoUri ? (
                          <Image source={{ uri: getTraceAuditMeta(event).proofPhotoUri ?? '' }} style={styles.traceProofImage} contentFit="cover" />
                        ) : null}
                        {event.note ? <ThemedText style={styles.timelineMeta}>{event.note}</ThemedText> : null}
                      </Pressable>
                    ))
                  ) : (
                    <ThemedText style={styles.panelHint}>{traceT('trace.timeline.noDetailEvents')}</ThemedText>
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.emptyDetail}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={traceT('trace.lookup.scanAccessibility')}
                  style={({ pressed }) => [styles.traceLookupCard, { opacity: pressed ? 0.9 : 1 }]}
                  onPress={handleOpenTraceScanner}>
                  <MaterialIcons name="qr-code-scanner" size={34} color={Brand.accent} />
                  <ThemedText type="defaultSemiBold">{traceT('trace.lookup.scanTitle')}</ThemedText>
                  <ThemedText style={styles.panelHint}>{traceT('trace.lookup.scanHint')}</ThemedText>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={traceT('trace.lookup.manualAccessibility')}
                  style={[styles.actionButton, styles.actionButtonGhost]}
                  onPress={handleOpenTraceLookup}>
                  <ThemedText type="defaultSemiBold" style={styles.actionButtonGhostText}>
                    {traceT('trace.lookup.manualButton')}
                  </ThemedText>
                </Pressable>

                {traceLookupOpen ? (
                  <View style={styles.traceLookupForm}>
                    <TazeInput
                      icon="qr-code-scanner"
                      placeholder={traceT('trace.lookup.placeholder')}
                      value={traceLookupValue}
                      onChangeText={(value) => {
                        setTraceLookupValue(value);
                        setTraceLookupMessage(null);
                      }}
                      autoCapitalize="none"
                      autoCorrect={false}
                      onSubmitEditing={handleTraceLookupSelect}
                      containerStyle={styles.traceLookupInput}
                    />
                    <View style={styles.traceLookupActions}>
                      <Pressable style={styles.actionButton} onPress={handleTraceLookupSelect}>
                        <ThemedText type="defaultSemiBold" style={styles.actionButtonText}>
                          {traceT('trace.lookup.select')}
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        style={[styles.actionButton, styles.actionButtonGhost]}
                        onPress={() => {
                          setTraceLookupOpen(false);
                          setTraceLookupMessage(null);
                        }}>
                        <ThemedText type="defaultSemiBold" style={styles.actionButtonGhostText}>
                          {traceT('trace.lookup.cancel')}
                        </ThemedText>
                      </Pressable>
                    </View>
                    {traceLookupMessage ? <ThemedText style={styles.traceLookupError}>{traceLookupMessage}</ThemedText> : null}
                  </View>
                ) : null}
              </View>
            )}
          </TazeCard>
        </View>

        <TazeCard style={styles.panel}>
          <TazeSectionHeader
            title={traceT('trace.timeline.recentTitle')}
            subtitle={traceT('trace.timeline.recentSubtitle')}
            badge={traceT('trace.timeline.badge')}
            badgeTone="neutral"
          />
          <View style={styles.timeline}>
            {recentMovements.length > 0 ? (
              recentMovements.map((movement) => (
                <Pressable
                  key={movement.id}
                  style={({ pressed }) => [styles.timelineRow, { opacity: pressed ? 0.92 : 1 }]}
                  onPress={() => {
                    if (!movement.itemId) return;
                    setSelectedItemId(movement.itemId);
                  }}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineCopy}>
                    <ThemedText type="defaultSemiBold">
                      {movement.itemName} - {labelForMovement(movement.type)} - {traceQuantity(movement.quantity)}
                    </ThemedText>
                    <ThemedText style={styles.timelineMeta}>
                      {formatTimestamp(movement.recordedAt)} -{' '}
                      {traceT('trace.timeline.route', { from: movement.fromLocation ?? '-', to: movement.toLocation ?? '-' })}
                    </ThemedText>
                  </View>
                </Pressable>
              ))
            ) : (
              <ThemedText style={styles.panelHint}>{traceT('trace.timeline.noRecentMovements')}</ThemedText>
            )}
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
    gap: 18,
  },
  hero: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    boxShadow: '0px 18px 40px rgba(15, 23, 42, 0.08)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  heroBrandRow: {
    flex: 1,
    minWidth: 240,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroCopy: {
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
    borderColor: 'rgba(153,246,228,0.32)',
    backgroundColor: Brand.dark,
  },
  heroLogo: {
    width: '100%',
    height: '100%',
  },
  seedButton: {
    backgroundColor: Brand.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seedButtonText: {
    color: '#ffffff',
  },
  locationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  locationChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(203,213,225,0.78)',
    backgroundColor: 'rgba(255,255,255,0.72)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationChipActive: {
    borderColor: Brand.accent,
    backgroundColor: 'rgba(236,254,255,0.92)',
  },
  locationChipText: {
    color: '#475569',
    fontSize: 12,
  },
  locationChipTextActive: {
    color: '#0f766e',
    fontSize: 12,
  },
  locationChipCount: {
    color: '#0f172a',
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '800',
  },
  locationChipCountActive: {
    color: '#0f766e',
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '800',
  },
  searchInputWrap: {
    minWidth: 180,
  },
  phaseOverviewCard: {
    gap: 12,
  },
  phaseLocationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  phaseLocationCard: {
    flexGrow: 1,
    flexBasis: 240,
    minWidth: 220,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    borderRadius: 16,
    backgroundColor: 'rgba(248,250,252,0.92)',
    padding: 12,
    gap: 10,
  },
  phaseLocationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  phaseProductRow: {
    borderWidth: 1,
    borderColor: 'rgba(203,213,225,0.75)',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  phaseProductCopy: {
    flex: 1,
    gap: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  analyticsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  analyticsCard: {
    flexGrow: 1,
    flexBasis: 180,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    borderRadius: 16,
    backgroundColor: 'rgba(248,250,252,0.9)',
    padding: 14,
    gap: 4,
  },
  panel: {
    flex: 1,
    minWidth: 260,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    borderRadius: 22,
    padding: 16,
    gap: 10,
  },
  panelHint: {
    color: '#64748b',
    fontSize: 12,
  },
  itemList: {
    gap: 10,
  },
  itemRow: {
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  itemRowActive: {
    borderColor: Brand.accent,
    backgroundColor: 'rgba(236,254,255,0.92)',
  },
  itemRowCopy: {
    flex: 1,
    gap: 2,
  },
  itemRowMeta: {
    color: '#64748b',
    fontSize: 12,
  },
  emptyDetail: {
    paddingVertical: 26,
    alignItems: 'center',
    gap: 10,
  },
  traceLookupCard: {
    width: '100%',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  traceLookupForm: {
    width: '100%',
    gap: 10,
  },
  traceLookupInput: {
    width: '100%',
  },
  traceLookupActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  traceLookupError: {
    color: '#b91c1c',
    fontSize: 12,
  },
  detailBox: {
    gap: 14,
  },
  detailHeader: {
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(248,250,252,0.9)',
  },
  detailHeaderCopy: {
    gap: 4,
  },
  resultCard: {
    borderWidth: 1,
    borderColor: 'rgba(191,219,254,0.7)',
    borderRadius: 18,
    padding: 14,
    gap: 10,
    backgroundColor: 'rgba(239,246,255,0.9)',
  },
  resultHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  correctionCard: {
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.7)',
    borderRadius: 18,
    padding: 14,
    gap: 12,
    backgroundColor: 'rgba(255,251,235,0.9)',
  },
  correctionMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  correctionFields: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  correctionField: {
    flexGrow: 1,
    flexBasis: 180,
  },
  correctionFieldSmall: {
    flexGrow: 1,
    flexBasis: 110,
  },
  correctionMessage: {
    color: '#92400e',
    fontSize: 12,
  },
  resultDeltaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  resultDeltaChip: {
    minWidth: 120,
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  resultDeltaLabel: {
    color: '#0f172a',
    fontSize: 12,
  },
  resultDeltaValue: {
    color: '#0f766e',
    fontSize: 14,
  },
  detailMeta: {
    color: '#475569',
    fontSize: 12,
  },
  muted: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 20,
  },
  detailStatusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  actionGroup: {
    gap: 10,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'flex-start',
  },
  actionInputWrap: {
    minWidth: 140,
    flexGrow: 1,
  },
  actionButton: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonBlue: {
    backgroundColor: Brand.primary,
  },
  actionButtonRed: {
    backgroundColor: '#dc2626',
  },
  actionButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  actionButtonGhost: {
    backgroundColor: 'rgba(248,250,252,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(203,213,225,0.86)',
  },
  actionButtonText: {
    color: '#ffffff',
  },
  actionButtonGhostText: {
    color: '#475569',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeline: {
    gap: 10,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: Brand.accent,
    marginTop: 6,
  },
  timelineCopy: {
    flex: 1,
    gap: 2,
  },
  timelineMeta: {
    color: '#64748b',
    fontSize: 12,
  },
  traceEventCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 12,
    gap: 6,
  },
  traceEventCardWarning: {
    borderColor: 'rgba(251,146,60,0.75)',
    backgroundColor: 'rgba(255,247,237,0.95)',
  },
  traceProofImage: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    marginTop: 6,
  },
  traceEventHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  traceEventBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
});



