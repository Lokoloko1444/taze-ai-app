import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { TazeBadge } from 'components/taze-badge';
import { TazeButton } from 'components/taze-button';
import { TazeCard } from 'components/taze-card';
import { ThemedText } from 'components/themed-text';
import { Brand } from 'constants/theme';
import {
  getExpiryActionContext,
  getInventoryMetrics,
  getLocationBreakdown,
  getLowStockAlertsByLocation,
  getMovementValueBreakdown,
  persistInventoryStateToCloudNow,
  recordWaste,
  updateInventoryItemCorrection,
  useInventory,
  type InventoryItem,
} from 'hooks/use-inventory';
import { useAuth } from 'lib/auth-context';
import { normalizeAppRole, roleHasPermission } from 'lib/auth-model';
import { resolveAppLanguage, t, type TranslationKey } from 'lib/i18n';
import { getServerBaseUrl } from 'lib/server-url';
import { supabase } from 'lib/supabase';

const cockpitLocations = ['Bar', 'Keuken', 'Frigo', 'Diepvries', 'Koelcel', 'Stock', 'Magazijn / Stock'];
const lowStockThreshold = 5;
const expiryWarningDays = 2;
const supplierOrderEmail = 'bestelling@taze.to';

type DeliverySummary = {
  id: string;
  order_id: string | null;
  geleverd_op: string | null;
  foto_bewijs: string[] | null;
  chauffeur_id: string | null;
  klant_bevestigd: boolean | null;
  klant_bevestigd_op: string | null;
  confirm_token: string | null;
  created_at: string | null;
  invoiceCount: number;
};

type InvoiceSummary = {
  id: string;
  delivery_id: string | null;
  bedrag: number | null;
  betaald: boolean | null;
  created_at: string | null;
};

type StockMutationRow = Record<string, unknown>;

type CockpitActionMode = 'correction' | 'waste' | null;

function formatCockpitAlertTranslation(
  template: string,
  replacements: Record<string, string | number | null | undefined> = {}
) {
  return Object.entries(replacements).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, String(value ?? '')),
    template
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('nl-BE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function isWithinDays(rawDate: string, days: number) {
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return false;
  return Date.now() - parsed.getTime() <= days * 24 * 60 * 60 * 1000;
}

function formatDateTime(value: string | null) {
  if (!value) return 'Nog niet';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Onbekend';
  return new Intl.DateTimeFormat('nl-BE', { dateStyle: 'short', timeStyle: 'short' }).format(parsed);
}

function readString(row: StockMutationRow, keys: string[], fallback: string | null = null) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return fallback;
}

function readNumber(row: StockMutationRow, keys: string[], fallback: number | null = null) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return fallback;
}

function parseExpiryDate(value: string | null | undefined) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function createExpiryDateFromDays(capturedAt: string, expiryDays: number | null) {
  if (expiryDays === null || !Number.isFinite(expiryDays)) {
    return null;
  }

  const captured = new Date(capturedAt);
  if (Number.isNaN(captured.getTime())) {
    return null;
  }

  const next = new Date(captured);
  next.setDate(next.getDate() + Math.round(expiryDays));
  return next.toISOString();
}

function calculateExpiryDays(expiryDate: string | null, referenceAt: string | Date = new Date()) {
  const parsedExpiry = parseExpiryDate(expiryDate);
  if (!parsedExpiry) {
    return null;
  }

  const reference = referenceAt instanceof Date ? referenceAt : new Date(referenceAt);
  if (Number.isNaN(reference.getTime())) {
    return null;
  }

  const startOfReference = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const startOfExpiry = new Date(parsedExpiry.getFullYear(), parsedExpiry.getMonth(), parsedExpiry.getDate());
  return Math.round((startOfExpiry.getTime() - startOfReference.getTime()) / (24 * 60 * 60 * 1000));
}

function buildInventoryFromStockMutations(rows: StockMutationRow[]): InventoryItem[] {
  const grouped = new Map<string, InventoryItem>();

  rows.forEach((row, index) => {
    const itemId = readString(row, ['item_id', 'inventory_item_id', 'product_id', 'id'], `mutation-${index}`);
    const name = readString(row, ['item_name', 'product_name', 'name', 'label'], 'Onbekend product') ?? 'Onbekend product';
    const category = readString(row, ['category', 'product_category'], 'Onbekend') ?? 'Onbekend';
    const location = readString(row, ['location', 'to_location', 'destination', 'warehouse'], 'Stock') ?? 'Stock';
    const mutationType = readString(row, ['type', 'mutation_type', 'movement_type', 'action'], 'adjust')?.toLowerCase() ?? 'adjust';
    const rawQuantity = readNumber(row, ['quantity', 'qty', 'amount'], 0) ?? 0;
    const currentQuantity = readNumber(row, ['current_quantity', 'quantity_after', 'next_quantity', 'stock_after'], null);
    const unitPrice = readNumber(row, ['unit_price', 'unit_cost', 'price'], null);
    const expiryDaysFromRow = readNumber(row, ['expiry_days', 'expires_in', 'expiryDays'], null);
    const expiryDateFromRow = readString(row, ['expiry_date', 'expires_at'], null);
    const capturedAt = readString(row, ['created_at', 'recorded_at', 'updated_at'], new Date().toISOString()) ?? new Date().toISOString();
    const expiryDate = expiryDateFromRow ?? createExpiryDateFromDays(capturedAt, expiryDaysFromRow);
    const expiryDays = calculateExpiryDays(expiryDate);
    const expiryContext = getExpiryActionContext({ category, expiryDate });
    const barcode = readString(row, ['barcode', 'ean'], null);
    const quantitySign = mutationType.includes('waste') || mutationType.includes('sale') || mutationType.includes('consume') ? -1 : 1;
    const key = `${itemId}-${location}`;
    const existing = grouped.get(key);
    const nextQuantity =
      currentQuantity !== null
        ? currentQuantity
        : Math.max(0, (existing?.quantity ?? 0) + rawQuantity * quantitySign);
    const nextUnitPrice = unitPrice ?? existing?.unitPrice ?? null;

    grouped.set(key, {
      id: key,
      name,
      category,
      location,
      quantity: nextQuantity,
      expiryDays,
      expiryDate,
      expiryStatus: expiryContext.expiryStatus,
      recommendedAction: expiryContext.recommendedAction,
      recommendedReason: expiryContext.recommendedReason,
      confidence: null,
      notes: 'Geladen uit transacties.stock_mutations',
      barcode,
      photoUri: null,
      unitPrice: nextUnitPrice,
      stockValue: nextUnitPrice === null ? 0 : nextQuantity * nextUnitPrice,
      priceMissing: nextUnitPrice === null,
      source: 'supabase-realtime',
      capturedAt,
    });
  });

  return [...grouped.values()].filter((item) => item.quantity > 0);
}

export default function CockpitScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { items, locations, movements, financeEntries, dispatches, liveAlerts, lastSavedAt } = useInventory();
  const uiLanguage = useMemo(resolveAppLanguage, []);
  const cockpitAlertT = useCallback(
    (key: TranslationKey, replacements?: Record<string, string | number | null | undefined>) =>
      formatCockpitAlertTranslation(t(key, uiLanguage), replacements),
    [uiLanguage]
  );
  const serverBaseUrl = useMemo(() => getServerBaseUrl(), []);
  const [inventory, setInventory] = useState<InventoryItem[]>(items);
  const [deliveries, setDeliveries] = useState<DeliverySummary[]>([]);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [realtimeError, setRealtimeError] = useState(false);
  const [realtimeRetryKey, setRealtimeRetryKey] = useState(0);
  const [actionMode, setActionMode] = useState<CockpitActionMode>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [selectedActionItemId, setSelectedActionItemId] = useState<string | null>(null);
  const [correctionQuantity, setCorrectionQuantity] = useState('');
  const [wasteQuantity, setWasteQuantity] = useState('1');
  const [sendingOrderAdviceId, setSendingOrderAdviceId] = useState<string | null>(null);

  useEffect(() => {
    setInventory(items);
  }, [items]);

  const deferredInventory = useDeferredValue(inventory);
  const locationScope = useMemo(() => Array.from(new Set([...cockpitLocations, ...locations, ...deferredInventory.map((item) => item.location)])), [deferredInventory, locations]);
  const metrics = useMemo(() => getInventoryMetrics(deferredInventory), [deferredInventory]);
  const locationBreakdown = useMemo(() => getLocationBreakdown(deferredInventory, locationScope), [deferredInventory, locationScope]);
  const lowStockAlerts = useMemo(() => getLowStockAlertsByLocation(deferredInventory, locationScope).slice(0, 5), [deferredInventory, locationScope]);
  const lowStockItems = useMemo(
    () => deferredInventory.filter((item) => item.quantity < lowStockThreshold && item.location.toLowerCase() !== 'stock'),
    [deferredInventory]
  );
  const expirySoonItems = useMemo(
    () => deferredInventory.filter((item) => item.quantity > 0 && item.expiryDays !== null && item.expiryDays <= expiryWarningDays),
    [deferredInventory]
  );
  const openDeliveriesCount = useMemo(() => deliveries.filter((delivery) => !delivery.klant_bevestigd).length, [deliveries]);
  const hasAttention = lowStockItems.length > 0 || expirySoonItems.length > 0 || openDeliveriesCount > 0;
  const reorderAdviceItems = useMemo(() => {
    const rows = new Map<string, { item: InventoryItem; reason: 'low-stock' | 'expiry' | 'both' }>();
    lowStockItems.forEach((item) => rows.set(item.id, { item, reason: 'low-stock' }));
    expirySoonItems.forEach((item) => {
      const existing = rows.get(item.id);
      rows.set(item.id, { item, reason: existing ? 'both' : 'expiry' });
    });
    return [...rows.values()];
  }, [expirySoonItems, lowStockItems]);
  const movementValues = useMemo(() => getMovementValueBreakdown(movements, locationScope), [movements, locationScope]);
  const activeRole = useMemo(() => normalizeAppRole(auth.activeMembership?.role ?? auth.role ?? null), [auth.activeMembership?.role, auth.role]);
  const canUseCockpitActions = useMemo(
    () =>
      roleHasPermission(activeRole, 'inventory.correct', auth.permissions) ||
      roleHasPermission(activeRole, 'stockmovement.create', auth.permissions),
    [activeRole, auth.permissions]
  );
  const selectedActionItem = useMemo(
    () => inventory.find((item) => item.id === selectedActionItemId) ?? items.find((item) => item.id === selectedActionItemId) ?? null,
    [inventory, items, selectedActionItemId]
  );

  const financeTotals = useMemo(
    () =>
      financeEntries.reduce(
        (totals, entry) => {
          totals[entry.kind] += entry.amount;
          return totals;
        },
        { revenue: 0, food_cost: 0, bar_cost: 0, loss: 0 }
      ),
    [financeEntries]
  );

  const expiringItems = useMemo(
    () =>
      deferredInventory
        .filter((item) => item.quantity > 0 && item.expiryDays !== null && item.expiryDays <= 7)
        .slice()
        .sort((left, right) => (left.expiryDays ?? 999) - (right.expiryDays ?? 999))
        .slice(0, 6)
        .map((item) => ({
          item,
          context: getExpiryActionContext({ category: item.category, expiryDate: item.expiryDate }),
        })),
    [deferredInventory]
  );

  const recentWaste = useMemo(
    () => movements.filter((movement) => movement.type === 'waste').slice(0, 5),
    [movements]
  );
  const recentMovements = useMemo(() => movements.slice(0, 6), [movements]);
  const weeklyReceipts = useMemo(
    () => movements.filter((movement) => (movement.type === 'receive' || movement.type === 'stocktake') && isWithinDays(movement.recordedAt, 7)),
    [movements]
  );
  const activeDispatches = dispatches.filter((dispatch) => dispatch.finalAuditStatus !== 'complete').length;
  const wasteByLocation = movementValues.byLocation.filter((entry) => entry.wasteValue > 0 || entry.consumptionValue > 0);

  const loadInventory = useCallback(async () => {
    setInventoryError(null);

    if (!supabase) {
      setInventoryError('Supabase is niet geconfigureerd.');
      return;
    }

    const { data, error } = await supabase
      .schema('transacties')
      .from('stock_mutations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      setInventoryError(error.message);
      return;
    }

    const nextInventory = buildInventoryFromStockMutations((data ?? []) as StockMutationRow[]);
    if (nextInventory.length > 0) {
      setInventory(nextInventory);
    }
  }, []);

  const loadDeliveries = useCallback(async () => {
    setDeliveryLoading(true);
    setDeliveryError(null);

    if (!supabase) {
      setDeliveryError('Supabase is niet geconfigureerd.');
      setDeliveryLoading(false);
      return;
    }

    const [{ data: deliveries, error: deliveriesError }, { data: invoices, error: invoicesError }] = await Promise.all([
      supabase
        .schema('transacties')
        .from('deliveries')
        .select('id,order_id,geleverd_op,foto_bewijs,chauffeur_id,klant_bevestigd,klant_bevestigd_op,confirm_token,created_at')
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .schema('transacties')
        .from('invoices')
        .select('id,delivery_id,bedrag,betaald,created_at')
        .order('created_at', { ascending: false })
        .limit(25),
    ]);

    if (deliveriesError || invoicesError) {
      setDeliveryError(deliveriesError?.message ?? invoicesError?.message ?? 'Leveringen laden is mislukt.');
      setDeliveries([]);
      setDeliveryLoading(false);
      return;
    }

    const invoiceList = (invoices ?? []) as InvoiceSummary[];
    setDeliveries(
      ((deliveries ?? []) as Omit<DeliverySummary, 'invoiceCount'>[]).map((delivery) => ({
        ...delivery,
        invoiceCount: invoiceList.filter((invoice) => invoice.delivery_id === delivery.id).length,
      }))
    );
    setDeliveryLoading(false);
  }, []);

  useEffect(() => {
    loadInventory().catch((caught) => {
      setInventoryError(caught instanceof Error ? caught.message : 'Voorraad laden is mislukt.');
    });
    loadDeliveries().catch((caught) => {
      setDeliveryError(caught instanceof Error ? caught.message : 'Leveringen laden is mislukt.');
      setDeliveryLoading(false);
    });
  }, [loadDeliveries, loadInventory]);

  useEffect(() => {
    if (!supabase) return;

    let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;

    try {
      channel = supabase
        .channel('cockpit-realtime')
        .on('postgres_changes', { event: '*', schema: 'transacties', table: 'stock_mutations' }, () => {
          loadInventory().catch((caught) => {
            setRealtimeError(true);
            setInventoryError(caught instanceof Error ? caught.message : 'Voorraad laden is mislukt.');
          });
        })
        .on('postgres_changes', { event: '*', schema: 'transacties', table: 'deliveries' }, () => {
          loadDeliveries().catch((caught) => {
            setRealtimeError(true);
            setDeliveryError(caught instanceof Error ? caught.message : 'Leveringen laden is mislukt.');
            setDeliveryLoading(false);
          });
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setRealtimeError(false);
          }
          if (status === 'CHANNEL_ERROR') {
            setRealtimeError(true);
          }
        });
    } catch (caught) {
      console.error(caught);
      setRealtimeError(true);
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [loadDeliveries, loadInventory, realtimeRetryKey]);

  const openActionModal = useCallback(
    (mode: Exclude<CockpitActionMode, null>) => {
      const firstItem = inventory.find((item) => item.quantity > 0) ?? inventory[0] ?? items.find((item) => item.quantity > 0) ?? items[0] ?? null;
      setActionMode(mode);
      setSelectedActionItemId(firstItem?.id ?? null);
      setCorrectionQuantity(firstItem ? String(Math.max(0, Math.round(firstItem.quantity))) : '');
      setWasteQuantity('1');
      setActionMessage(null);
    },
    [inventory, items]
  );

  const closeActionModal = useCallback(() => {
    if (actionBusy) return;
    setActionMode(null);
    setSelectedActionItemId(null);
    setCorrectionQuantity('');
    setWasteQuantity('1');
    setActionMessage(null);
  }, [actionBusy]);

  const handleCorrection = useCallback(async () => {
    if (!selectedActionItem) {
      setActionMessage('Kies eerst een product.');
      return;
    }
    const quantity = Number(correctionQuantity);
    if (!Number.isFinite(quantity) || quantity < 0) {
      setActionMessage('Geef een geldige nieuwe voorraad in.');
      return;
    }

    setActionBusy(true);
    setActionMessage(null);
    try {
      const result = updateInventoryItemCorrection({
        itemId: selectedActionItem.id,
        name: selectedActionItem.name,
        category: selectedActionItem.category,
        location: selectedActionItem.location,
        quantity,
        note: 'Cockpit voorraadcorrectie',
        source: 'cockpit',
      });

      if (!result.ok) {
        setActionMessage(result.reason === 'missing_item' ? 'Product niet gevonden.' : 'Correctie mist verplichte velden.');
        return;
      }

      const sync = await persistInventoryStateToCloudNow();
      const detail = sync.ok ? cockpitAlertT('cockpit.alert.stockCorrectionSynced') : cockpitAlertT('cockpit.alert.stockCorrectionQueued');
      Alert.alert(cockpitAlertT('cockpit.alert.stockUpdated.title'), detail);
      setActionMode(null);
    } finally {
      setActionBusy(false);
    }
  }, [cockpitAlertT, correctionQuantity, selectedActionItem]);

  const handleWaste = useCallback(async () => {
    if (!selectedActionItem) {
      setActionMessage('Kies eerst een product.');
      return;
    }
    const quantity = Number(wasteQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setActionMessage('Geef een geldige waste-hoeveelheid in.');
      return;
    }

    setActionBusy(true);
    setActionMessage(null);
    try {
      const result = recordWaste({
        itemId: selectedActionItem.id,
        quantity,
        location: selectedActionItem.location,
        note: 'Cockpit waste registratie',
        source: 'cockpit',
      });

      if (!result.ok) {
        const message =
          result.reason === 'location-mismatch' || result.reason === 'insufficient-stock'
            ? 'Kan waste niet registreren: product niet op deze locatie of onvoldoende voorraad.'
            : 'Product niet gevonden.';
        setActionMessage(message);
        return;
      }

      const sync = await persistInventoryStateToCloudNow();
      const detail = sync.ok ? cockpitAlertT('cockpit.alert.wasteSynced') : cockpitAlertT('cockpit.alert.wasteQueued');
      Alert.alert(cockpitAlertT('cockpit.alert.wasteRegistered.title'), detail);
      setActionMode(null);
    } finally {
      setActionBusy(false);
    }
  }, [cockpitAlertT, selectedActionItem, wasteQuantity]);

  const showAttentionAlert = useCallback(() => {
    const lines = [
      lowStockItems.length ? cockpitAlertT('cockpit.alert.attention.lowStock', { count: lowStockItems.length }) : null,
      expirySoonItems.length ? cockpitAlertT('cockpit.alert.attention.expirySoon', { count: expirySoonItems.length }) : null,
      openDeliveriesCount ? cockpitAlertT('cockpit.alert.attention.openDeliveries', { count: openDeliveriesCount }) : null,
    ].filter(Boolean);

    Alert.alert(cockpitAlertT('cockpit.alert.attention.title'), lines.join('\n') || cockpitAlertT('cockpit.alert.attention.none'), [{ text: 'OK' }]);
  }, [cockpitAlertT, expirySoonItems.length, lowStockItems.length, openDeliveriesCount]);

  const retryRealtime = useCallback(() => {
    setRealtimeError(false);
    setRealtimeRetryKey((current) => current + 1);
    loadInventory().catch((caught) => {
      setRealtimeError(true);
      setInventoryError(caught instanceof Error ? caught.message : 'Voorraad laden is mislukt.');
    });
    loadDeliveries().catch((caught) => {
      setRealtimeError(true);
      setDeliveryError(caught instanceof Error ? caught.message : 'Leveringen laden is mislukt.');
      setDeliveryLoading(false);
    });
  }, [loadDeliveries, loadInventory]);

  const sendOrderAdviceEmail = useCallback(
    async (item: InventoryItem, reason: 'low-stock' | 'expiry') => {
      setSendingOrderAdviceId(item.id);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(`${serverBaseUrl}/api/order-advice/email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            productName: item.name,
            location: item.location,
            recipientEmail: supplierOrderEmail,
            reason,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          const detail = typeof data?.error === 'string' ? data.error : 'order_advice_email_failed';
          Alert.alert(cockpitAlertT('cockpit.alert.orderFailed.title'), cockpitAlertT('cockpit.alert.orderFailed.server', { detail }));
          return;
        }

        Alert.alert(
          cockpitAlertT('cockpit.alert.orderSent.title'),
          cockpitAlertT('cockpit.alert.orderSent.body', { productName: item.name, email: supplierOrderEmail })
        );
      } catch (caught) {
        clearTimeout(timeoutId);
        if (caught instanceof Error && caught.name === 'AbortError') {
          Alert.alert(cockpitAlertT('cockpit.alert.error.title'), cockpitAlertT('cockpit.alert.error.timeout'));
          return;
        }
        Alert.alert(cockpitAlertT('cockpit.alert.error.title'), cockpitAlertT('cockpit.alert.error.network'));
      } finally {
        setSendingOrderAdviceId(null);
      }
    },
    [cockpitAlertT, serverBaseUrl]
  );

  const confirmOrderAdviceEmail = useCallback(
    (item: InventoryItem, reason: 'low-stock' | 'expiry') => {
      if (sendingOrderAdviceId) return;

      Alert.alert(cockpitAlertT('cockpit.alert.confirm.title'), cockpitAlertT('cockpit.alert.confirm.orderAdvice', { productName: item.name, location: item.location }), [
        { text: cockpitAlertT('cockpit.alert.action.cancel'), style: 'cancel' },
        { text: cockpitAlertT('cockpit.alert.action.send'), onPress: () => sendOrderAdviceEmail(item, reason) },
      ]);
    },
    [cockpitAlertT, sendOrderAdviceEmail, sendingOrderAdviceId]
  );

  return (
    <ScrollView contentContainerStyle={styles.shell}>
      <TazeCard variant="panel" style={styles.heroCard}>
        <View style={styles.headerRow}>
          <View style={styles.titleBlock}>
            <TazeBadge label="Read-only cockpit" tone="primary" icon="dashboard" />
            <ThemedText type="title" style={styles.title}>
              Cockpit
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Live overzicht van voorraadwaarde, waste, vervaladvies en audit zonder mutaties uit te voeren.
            </ThemedText>
          </View>
          <TazeButton label="Terug naar Start" icon="arrow-back" variant="secondary" onPress={() => router.push('/')} />
        </View>
        <View style={styles.metricGrid}>
          <MetricCard label="Stockwaarde" value={formatCurrency(metrics.totalStockValue)} detail={`${metrics.totalUnits} eenheden`} icon="inventory-2" />
          <MetricCard label="Waste / verlies" value={formatCurrency(financeTotals.loss)} detail={`${recentWaste.length} recente waste-events`} icon="delete-outline" />
          <MetricCard label="Verbruikwaarde" value={formatCurrency(movementValues.totalConsumptionValue)} detail="Uit stock movements" icon="restaurant" />
          <MetricCard label="Ontvangsten week" value={`${weeklyReceipts.length}`} detail={`${activeDispatches} open transport/audit`} icon="local-shipping" />
        </View>
        {hasAttention ? (
          <Pressable style={styles.attentionBar} onPress={showAttentionAlert}>
            <MaterialIcons name="warning" size={18} color="#713f12" />
            <ThemedText style={styles.attentionText}>
              Aandacht: {lowStockItems.length} bijna op, {expirySoonItems.length} bijna vervallen, {openDeliveriesCount} leveringen open.
            </ThemedText>
          </Pressable>
        ) : null}
        <ThemedText style={styles.syncText}>
          Laatste sync: {lastSavedAt ? new Date(lastSavedAt).toLocaleString('nl-BE') : 'nog geen opgeslagen voorraadmoment'}
        </ThemedText>
        {inventoryError ? (
          <View style={styles.errorBox}>
            <MaterialIcons name="sync-problem" size={17} color="#b91c1c" />
            <ThemedText style={styles.errorText}>
              Realtime voorraad niet geladen: {inventoryError}. Controleer Supabase Replication voor transacties.stock_mutations.
            </ThemedText>
          </View>
        ) : null}
        {realtimeError ? (
          <View style={styles.realtimeErrorBox}>
            <MaterialIcons name="wifi-off" size={17} color="#b91c1c" />
            <ThemedText style={styles.errorText}>Realtime updates tijdelijk niet beschikbaar.</ThemedText>
            <TazeButton label="Probeer opnieuw" icon="refresh" variant="secondary" onPress={retryRealtime} />
          </View>
        ) : null}
      </TazeCard>

      <TazeCard variant="muted" style={styles.sectionCard}>
        <SectionHeader icon="place" title="Voorraad per locatie" badge="Kapitaal" />
        <View style={styles.locationGrid}>
          {locationBreakdown.map((entry) => (
            <View key={entry.location} style={styles.locationCard}>
              <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
                {entry.location}
              </ThemedText>
              <ThemedText style={styles.bigValue}>{formatCurrency(entry.stockValue)}</ThemedText>
              <ThemedText style={styles.mutedText}>
                {entry.quantity} stuks {entry.priceMissingCount > 0 ? `- ${entry.priceMissingCount} zonder prijs` : ''}
              </ThemedText>
            </View>
          ))}
        </View>
      </TazeCard>

      <TazeCard variant="muted" style={styles.sectionCard}>
        <SectionHeader icon="delete-outline" title="Waste en verbruik per locatie" badge="Loss" />
        <View style={styles.locationGrid}>
          {wasteByLocation.length > 0 ? (
            wasteByLocation.map((entry) => (
              <View key={entry.location} style={styles.locationCard}>
                <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
                  {entry.location}
                </ThemedText>
                <ThemedText style={styles.lossValue}>{formatCurrency(entry.wasteValue)}</ThemedText>
                <ThemedText style={styles.mutedText}>Waste</ThemedText>
                <ThemedText style={styles.mutedText}>Verbruik: {formatCurrency(entry.consumptionValue)}</ThemedText>
              </View>
            ))
          ) : (
            <ListLine icon="check-circle" text="Nog geen waste of verbruikwaarde per locatie." />
          )}
        </View>
        {recentWaste.length > 0 ? (
          <View style={styles.compactList}>
            {recentWaste.map((movement) => (
              <ListLine
                key={movement.id}
                icon="delete-outline"
                text={`${movement.itemName} - ${movement.quantity} - ${movement.fromLocation ?? 'Onbekend'} - ${formatCurrency((movement.unitCost ?? 0) * movement.quantity)}`}
              />
            ))}
          </View>
        ) : null}
      </TazeCard>

      <TazeCard variant="muted" style={styles.sectionCard}>
        <SectionHeader icon="warning" title="Lage stock en verval" badge="FIFO" />
        <View style={styles.twoColumn}>
          <View style={styles.columnCard}>
            <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
              Lage stock
            </ThemedText>
            {lowStockAlerts.length > 0 ? (
              lowStockAlerts.map((alert) => <ListLine key={alert.itemId} icon="priority-high" text={alert.message} />)
            ) : (
              <ListLine icon="check-circle" text="Geen directe lage-stock melding." />
            )}
          </View>
          <View style={styles.columnCard}>
            <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
              Vervaladvies
            </ThemedText>
            {expiringItems.length > 0 ? (
              expiringItems.map(({ item, context }) => (
                <View key={item.id} style={styles.expiryCard}>
                  <View style={styles.expiryTop}>
                    <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
                      {item.name}
                    </ThemedText>
                    <TazeBadge label={item.location} tone="neutral" icon="place" />
                  </View>
                  <ThemedText style={styles.listText}>
                    {context.recommendedAction} - {context.recommendedReason}
                  </ThemedText>
                  <ThemedText style={styles.mutedText}>
                    Vervaldatum: {item.expiryDate ?? 'onbekend'} · waarde {formatCurrency(item.stockValue)}
                  </ThemedText>
                </View>
              ))
            ) : (
              <ListLine icon="check-circle" text="Geen producten met acute vervaldruk." />
            )}
          </View>
        </View>
      </TazeCard>

      <TazeCard variant="muted" style={styles.sectionCard}>
        <View style={styles.deliveryHeader}>
          <SectionHeader icon="local-shipping" title="Laatste leveringen" badge="Delivery" />
          <TazeButton label="Open delivery" icon="local-shipping" variant="secondary" onPress={() => router.push('/delivery')} />
        </View>
        {deliveryError ? (
          <View style={styles.errorBox}>
            <MaterialIcons name="error-outline" size={17} color="#b91c1c" />
            <ThemedText style={styles.errorText}>{deliveryError}</ThemedText>
          </View>
        ) : deliveryLoading ? (
          <ThemedText style={styles.mutedText}>Leveringen laden...</ThemedText>
        ) : deliveries.length > 0 ? (
          <View style={styles.deliveryList}>
            {deliveries.map((delivery) => (
              <View key={delivery.id} style={styles.deliveryCard}>
                <View style={styles.deliveryCopy}>
                  <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
                    Order {delivery.order_id ?? delivery.id.slice(0, 8)}
                  </ThemedText>
                  <ThemedText style={styles.mutedText}>Aangemaakt: {formatDateTime(delivery.created_at)}</ThemedText>
                  <ThemedText style={styles.mutedText}>Geleverd: {formatDateTime(delivery.geleverd_op)}</ThemedText>
                  <ThemedText style={styles.mutedText}>
                    Foto’s: {delivery.foto_bewijs?.length ?? 0} · Facturen: {delivery.invoiceCount}
                  </ThemedText>
                </View>
                <View style={styles.deliveryBadges}>
                  <TazeBadge
                    label={delivery.geleverd_op ? 'Geleverd' : 'Open'}
                    tone={delivery.geleverd_op ? 'success' : 'warning'}
                    icon={delivery.geleverd_op ? 'check-circle' : 'pending'}
                  />
                  <TazeBadge
                    label={delivery.klant_bevestigd ? 'Klant bevestigd' : 'Wacht op klant'}
                    tone={delivery.klant_bevestigd ? 'success' : 'neutral'}
                    icon={delivery.klant_bevestigd ? 'verified' : 'mark-email-unread'}
                  />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <ListLine icon="info" text="Nog geen leveringen gevonden in transacties.deliveries." />
        )}
      </TazeCard>

      <TazeCard variant="muted" style={styles.sectionCard}>
        <SectionHeader icon="shopping-cart" title="Besteladvies" badge="Supply" />
        {reorderAdviceItems.length === 0 ? (
          <ListLine icon="check-circle" text="Alles op orde, geen besteladvies." />
        ) : (
          <View style={styles.reorderList}>
            {reorderAdviceItems.map(({ item, reason }) => {
              const orderReason = reason === 'expiry' ? 'expiry' : 'low-stock';
              const advice =
                reason === 'both'
                  ? 'Bijbestellen en spoedig gebruiken.'
                  : reason === 'expiry'
                    ? 'Spoedig gebruiken of vervangende stock bestellen.'
                    : 'Bijbestellen onder drempel.';

              return (
                <View key={`reorder-${item.id}`} style={styles.reorderItem}>
                  <View style={styles.reorderCopy}>
                    <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
                      {item.name}
                    </ThemedText>
                    <ThemedText style={styles.mutedText}>
                      Locatie {item.location} - nog {item.quantity} stuks
                      {item.expiryDays !== null ? ` - vervalt over ${item.expiryDays} dagen` : ''}
                    </ThemedText>
                    <ThemedText style={styles.listText}>{advice}</ThemedText>
                  </View>
                  <TazeButton
                    label={sendingOrderAdviceId === item.id ? 'Bezig...' : 'Bestel'}
                    icon="mail"
                    variant="primary"
                    onPress={() => confirmOrderAdviceEmail(item, orderReason)}
                    disabled={Boolean(sendingOrderAdviceId)}
                  />
                </View>
              );
            })}
          </View>
        )}
      </TazeCard>

      <TazeCard variant="muted" style={styles.sectionCard}>
        <SectionHeader icon="euro" title="Winst, kosten en verlies" badge="Finance" />
        <View style={styles.metricGrid}>
          <MetricCard label="Omzet" value={formatCurrency(financeTotals.revenue)} detail="financeEntries revenue" icon="trending-up" />
          <MetricCard label="Food cost" value={formatCurrency(financeTotals.food_cost)} detail="inkoop/food" icon="lunch-dining" />
          <MetricCard label="Bar cost" value={formatCurrency(financeTotals.bar_cost)} detail="inkoop/bar" icon="local-bar" />
          <MetricCard label="Loss" value={formatCurrency(financeTotals.loss)} detail="waste/afboeking" icon="trending-down" />
        </View>
      </TazeCard>

      <TazeCard variant="muted" style={styles.sectionCard}>
        <SectionHeader icon="edit-note" title="Cockpit acties" badge="Manager" />
        {canUseCockpitActions ? (
          <View style={styles.actionGrid}>
            <TazeButton label="Voorraad corrigeren" icon="edit" variant="primary" onPress={() => openActionModal('correction')} />
            <TazeButton label="Waste registreren" icon="delete-outline" variant="secondary" onPress={() => openActionModal('waste')} />
            <TazeButton label="Leveringen openen" icon="local-shipping" variant="secondary" onPress={() => router.push('/delivery')} />
          </View>
        ) : (
          <ListLine icon="lock" text="Acties zijn alleen beschikbaar voor rollen met voorraadcorrectie of stockmovement-rechten." />
        )}
      </TazeCard>

      <TazeCard variant="muted" style={styles.sectionCard}>
        <SectionHeader icon="timeline" title="Auditbewijs" badge="Trace" />
        {recentMovements.length > 0 ? (
          recentMovements.map((movement) => (
            <ListLine
              key={movement.id}
              icon="history"
              text={`${movement.itemName} - ${movement.actionLabel} - ${movement.quantity} - ${movement.fromLocation ?? movement.toLocation ?? 'Onbekend'}`}
            />
          ))
        ) : (
          <ListLine icon="info" text="Nog geen stock movements geregistreerd." />
        )}
        {liveAlerts.slice(0, 3).map((alert) => (
          <ListLine key={alert.id} icon="notifications" text={`${alert.title} - ${alert.detail}`} />
        ))}
      </TazeCard>

      <CockpitActionModal
        mode={actionMode}
        items={inventory}
        selectedItem={selectedActionItem}
        selectedItemId={selectedActionItemId}
        correctionQuantity={correctionQuantity}
        wasteQuantity={wasteQuantity}
        busy={actionBusy}
        message={actionMessage}
        onClose={closeActionModal}
        onSelectItem={(item) => {
          setSelectedActionItemId(item.id);
          setCorrectionQuantity(String(Math.max(0, Math.round(item.quantity))));
          setActionMessage(null);
        }}
        onChangeCorrectionQuantity={setCorrectionQuantity}
        onChangeWasteQuantity={setWasteQuantity}
        onConfirmCorrection={handleCorrection}
        onConfirmWaste={handleWaste}
      />
    </ScrollView>
  );
}

function CockpitActionModal({
  mode,
  items,
  selectedItem,
  selectedItemId,
  correctionQuantity,
  wasteQuantity,
  busy,
  message,
  onClose,
  onSelectItem,
  onChangeCorrectionQuantity,
  onChangeWasteQuantity,
  onConfirmCorrection,
  onConfirmWaste,
}: {
  mode: CockpitActionMode;
  items: InventoryItem[];
  selectedItem: InventoryItem | null;
  selectedItemId: string | null;
  correctionQuantity: string;
  wasteQuantity: string;
  busy: boolean;
  message: string | null;
  onClose: () => void;
  onSelectItem: (item: InventoryItem) => void;
  onChangeCorrectionQuantity: (value: string) => void;
  onChangeWasteQuantity: (value: string) => void;
  onConfirmCorrection: () => void;
  onConfirmWaste: () => void;
}) {
  const visible = mode !== null;
  const title = mode === 'waste' ? 'Waste registreren' : 'Voorraad corrigeren';
  const activeItems = mode === 'waste' ? items.filter((item) => item.quantity > 0) : items;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.titleBlock}>
              <TazeBadge label={mode === 'waste' ? 'Loss' : 'Correctie'} tone={mode === 'waste' ? 'warning' : 'info'} icon={mode === 'waste' ? 'delete-outline' : 'edit'} />
              <ThemedText type="defaultSemiBold" style={styles.modalTitle}>
                {title}
              </ThemedText>
            </View>
            <TazeButton label="Sluit" icon="close" variant="ghost" onPress={onClose} disabled={busy} />
          </View>

          <ThemedText style={styles.mutedText}>Kies een product uit de actuele voorraad.</ThemedText>
          <ScrollView style={styles.itemPicker} nestedScrollEnabled>
            {activeItems.length > 0 ? (
              activeItems.map((item) => {
                const active = item.id === selectedItemId;
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.itemRow, active ? styles.itemRowActive : null]}
                    onPress={() => onSelectItem(item)}
                    disabled={busy}>
                    <View style={styles.itemRowCopy}>
                      <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
                        {item.name}
                      </ThemedText>
                      <ThemedText style={styles.mutedText}>
                        {item.location} - {item.quantity} stuks - waarde {formatCurrency(item.stockValue)}
                      </ThemedText>
                    </View>
                    {active ? <MaterialIcons name="check-circle" size={20} color={Brand.primaryStrong} /> : null}
                  </Pressable>
                );
              })
            ) : (
              <ListLine icon="info" text="Geen voorraaditems beschikbaar voor deze actie." />
            )}
          </ScrollView>

          {selectedItem ? (
            <View style={styles.selectedActionBox}>
              <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
                Geselecteerd: {selectedItem.name}
              </ThemedText>
              <ThemedText style={styles.mutedText}>
                Locatie: {selectedItem.location} - huidige voorraad: {selectedItem.quantity}
              </ThemedText>
            </View>
          ) : null}

          {mode === 'correction' ? (
            <TextInput
              value={correctionQuantity}
              onChangeText={onChangeCorrectionQuantity}
              keyboardType="numeric"
              placeholder="Nieuwe voorraad"
              style={styles.input}
              editable={!busy}
            />
          ) : (
            <TextInput
              value={wasteQuantity}
              onChangeText={onChangeWasteQuantity}
              keyboardType="numeric"
              placeholder="Waste aantal"
              style={styles.input}
              editable={!busy}
            />
          )}

          {message ? <ThemedText style={styles.actionMessage}>{message}</ThemedText> : null}

          <View style={styles.modalActions}>
            <TazeButton label="Annuleren" icon="close" variant="secondary" onPress={onClose} disabled={busy} />
            <TazeButton
              label={mode === 'waste' ? 'Registreer waste' : 'Bevestig correctie'}
              icon={mode === 'waste' ? 'delete-outline' : 'check-circle'}
              variant="primary"
              onPress={mode === 'waste' ? onConfirmWaste : onConfirmCorrection}
              disabled={busy || !selectedItem}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SectionHeader({ icon, title, badge }: { icon: keyof typeof MaterialIcons.glyphMap; title: string; badge: string }) {
  return (
    <View style={styles.sectionHeader}>
      <TazeBadge label={badge} tone="info" icon={icon} />
      <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
        {title}
      </ThemedText>
    </View>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}) {
  return (
    <View style={styles.metricCard}>
      <MaterialIcons name={icon} size={20} color={Brand.primaryStrong} />
      <ThemedText style={styles.mutedText}>{label}</ThemedText>
      <ThemedText type="defaultSemiBold" style={styles.metricValue}>
        {value}
      </ThemedText>
      <ThemedText style={styles.mutedText}>{detail}</ThemedText>
    </View>
  );
}

function ListLine({ icon, text }: { icon: keyof typeof MaterialIcons.glyphMap; text: string }) {
  return (
    <View style={styles.listLine}>
      <MaterialIcons name={icon} size={17} color={Brand.primaryStrong} />
      <ThemedText style={styles.listText}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    gap: 14,
    padding: 16,
    paddingBottom: 120,
  },
  heroCard: {
    gap: 16,
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleBlock: {
    maxWidth: 760,
    gap: 8,
  },
  title: {
    color: Brand.ink,
  },
  subtitle: {
    color: Brand.inkMuted,
    lineHeight: 21,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: 190,
    gap: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 14,
  },
  metricValue: {
    color: Brand.ink,
    fontSize: 20,
  },
  syncText: {
    color: Brand.inkMuted,
    fontSize: 12,
  },
  attentionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 8,
    backgroundColor: '#ffc107',
    padding: 12,
  },
  attentionText: {
    flex: 1,
    color: '#000000',
    fontWeight: '700',
    textAlign: 'center',
  },
  sectionCard: {
    gap: 12,
    padding: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: Brand.ink,
  },
  locationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  locationCard: {
    flexGrow: 1,
    flexBasis: 180,
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(15,118,110,0.15)',
    backgroundColor: '#f8fffe',
    padding: 14,
  },
  cardTitle: {
    color: Brand.ink,
  },
  bigValue: {
    color: Brand.primaryStrong,
    fontSize: 19,
    fontWeight: '800',
  },
  lossValue: {
    color: '#b91c1c',
    fontSize: 19,
    fontWeight: '800',
  },
  mutedText: {
    color: Brand.inkMuted,
    fontSize: 12,
  },
  twoColumn: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  columnCard: {
    flexGrow: 1,
    flexBasis: 300,
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 14,
  },
  compactList: {
    gap: 2,
  },
  expiryCard: {
    gap: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.22)',
    backgroundColor: '#fffbeb',
    padding: 12,
  },
  expiryTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  deliveryHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  deliveryList: {
    gap: 10,
  },
  deliveryCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    backgroundColor: 'rgba(255,255,255,0.92)',
    padding: 14,
  },
  deliveryCopy: {
    flexGrow: 1,
    flexShrink: 1,
    gap: 5,
  },
  deliveryBadges: {
    alignItems: 'flex-start',
    gap: 6,
  },
  reorderList: {
    gap: 8,
  },
  reorderItem: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ccc',
    paddingBottom: 8,
    marginVertical: 8,
  },
  reorderCopy: {
    flex: 1,
    minWidth: 220,
    gap: 4,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    padding: 16,
  },
  modalCard: {
    maxHeight: '92%',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
    backgroundColor: '#ffffff',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalTitle: {
    color: Brand.ink,
    fontSize: 20,
  },
  itemPicker: {
    maxHeight: 220,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    backgroundColor: '#f8fafc',
    padding: 12,
    marginBottom: 8,
  },
  itemRowActive: {
    borderColor: Brand.primaryStrong,
    backgroundColor: '#ecfdf5',
  },
  itemRowCopy: {
    flex: 1,
    gap: 4,
  },
  selectedActionBox: {
    gap: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(15,118,110,0.18)',
    backgroundColor: '#f0fdfa',
    padding: 12,
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    backgroundColor: '#ffffff',
    color: Brand.ink,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  actionMessage: {
    borderRadius: 12,
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
    padding: 10,
  },
  modalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 10,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 14,
    backgroundColor: '#fef2f2',
    padding: 12,
  },
  errorText: {
    flex: 1,
    color: '#b91c1c',
  },
  realtimeErrorBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: '#fef2f2',
    padding: 12,
  },
  listLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 5,
  },
  listText: {
    flex: 1,
    color: Brand.ink,
    lineHeight: 20,
  },
});
