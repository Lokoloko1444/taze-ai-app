import { useSyncExternalStore } from 'react';
import { eventForFinanceKind, loadSoundSettings, playEvent, type SoundEventId } from 'lib/notification-sounds';
import { getItem, getItemSyncWeb, hasSyncWebStorage, setItem } from 'lib/app-storage';
import { talkBack } from 'lib/talkback';
import { pullCloudState, pushCloudState, pushCloudStateWithResult, type CloudSyncResult } from 'lib/cloud-sync';
import { enqueueCloudState, flushCloudQueue } from 'lib/cloud-queue';
import { supabase } from 'lib/supabase';

export type ExpiryStatus = 'OK' | 'Soon' | 'Critical' | 'Expired' | 'Unknown';

export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  location: string;
  quantity: number;
  expiryDays: number | null;
  expiryDate: string | null;
  expiryStatus: ExpiryStatus;
  recommendedAction: string;
  recommendedReason: string;
  confidence: number | null;
  notes: string;
  barcode: string | null;
  photoUri: string | null;
  unitPrice: number | null;
  stockValue: number;
  priceMissing: boolean;
  lowStockThreshold?: number;
  unitLabel?: string;
  batchCode?: string | null;
  lotNumber?: string | null;
  recallFlag?: boolean;
  source: string;
  capturedAt: string;
};

export type FinanceEntryKind = 'revenue' | 'food_cost' | 'bar_cost' | 'loss';
export type FinanceEntryPeriod = 'day' | 'week' | 'month';

export type FinanceEntry = {
  id: string;
  kind: FinanceEntryKind;
  period: FinanceEntryPeriod;
  amount: number;
  note: string;
  recordedAt: string;
  location: string | null;
};

export type SaleEntry = {
  id: string;
  itemId: string | null;
  itemName: string;
  category: string;
  location: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  barcode: string | null;
  source: string;
  soldAt: string;
};

export type StockMovementType = 'stocktake' | 'receive' | 'sale' | 'consumption' | 'waste' | 'transfer' | 'adjust';

export type StockMovement = {
  id: string;
  type: StockMovementType;
  itemId: string | null;
  itemName: string;
  category: string;
  actionLabel: string;
  quantity: number;
  fromLocation: string | null;
  toLocation: string | null;
  unitCost: number | null;
  note: string;
  recordedAt: string;
  source: string;
  expiryDate: string | null;
  expiryStatus: ExpiryStatus;
  recommendedAction: string;
  recommendedReason: string;
};

export type Supplier = {
  id: string;
  name: string;
  contact: string;
  leadTimeDays: number;
  createdAt: string;
};

export type ReorderRule = {
  id: string;
  location: string | null;
  category: string | null;
  itemName: string | null;
  minQuantity: number;
  targetQuantity: number;
  unitCost: number | null;
  supplierId: string | null;
  updatedAt: string;
};

export type LiveAlertEvent = {
  id: string;
  event: SoundEventId;
  title: string;
  detail: string;
  href: '/scan' | '/explore' | '/alerts' | '/payments' | '/trace';
  createdAt: string;
  location: string | null;
  itemId: string | null;
};

export type DispatchStatus =
  | 'picked_from_stock'
  | 'ready_for_departure'
  | 'photo_proof_added'
  | 'driver_confirmed'
  | 'manager_confirmed'
  | 'departure_confirmed'
  | 'customer_receiving'
  | 'customer_confirmed'
  | 'invoice_released'
  | 'invoice_ready'
  | 'goods_closed'
  | 'dossier_complete';

export type DispatchReceiptStatus = 'pending' | 'awaiting_customer' | 'received';

export type DispatchInvoiceStatus = 'pending' | 'released' | 'ready';

export type DispatchFinalAuditStatus = 'open' | 'complete';

export type DispatchAuditEventKind =
  | 'created'
  | 'floor_confirmed'
  | 'photo_added'
  | 'driver_confirmed'
  | 'manager_confirmed'
  | 'departure_confirmed'
  | 'customer_receiving'
  | 'customer_confirmed'
  | 'invoice_released'
  | 'invoice_ready'
  | 'goods_closed'
  | 'dossier_complete';

export type DispatchAuditEvent = {
  id: string;
  kind: DispatchAuditEventKind;
  label: string;
  detail: string;
  createdAt: string;
};

export type DispatchRecord = {
  id: string;
  dispatchId: string;
  product: string;
  category: string;
  quantity: number;
  fromLocation: string;
  destination: string;
  customerName: string;
  customerConfirmedAt: string | null;
  customerReceiptStatus: DispatchReceiptStatus;
  invoiceStatus: DispatchInvoiceStatus;
  invoiceReleasedAt: string | null;
  invoiceReference: string | null;
  goodsClosedAt: string | null;
  finalAuditStatus: DispatchFinalAuditStatus;
  driverName: string;
  managerName: string;
  floorConfirmedAt: string | null;
  driverConfirmedAt: string | null;
  managerConfirmedAt: string | null;
  departureConfirmedAt: string | null;
  photoUri: string | null;
  photoPlaceholder: string | null;
  status: DispatchStatus;
  auditEvents: DispatchAuditEvent[];
  receiptAuditEvents: DispatchAuditEvent[];
  createdAt: string;
  updatedAt: string;
  sourceMovementId: string | null;
};

type InventoryState = {
  items: InventoryItem[];
  locations: string[];
  financeEntries: FinanceEntry[];
  salesEntries: SaleEntry[];
  movements: StockMovement[];
  dispatches: DispatchRecord[];
  suppliers: Supplier[];
  reorderRules: ReorderRule[];
  liveAlerts: LiveAlertEvent[];
  tasks: TaskItem[];
  purchaseOrders: PurchaseOrder[];
  lastSavedAt: string | null;
  manualStockSeeded: boolean;
};

type InventoryDraft = Omit<
  InventoryItem,
  | 'id'
  | 'capturedAt'
  | 'location'
  | 'expiryDate'
  | 'expiryStatus'
  | 'recommendedAction'
  | 'recommendedReason'
  | 'unitPrice'
  | 'stockValue'
  | 'priceMissing'
> & {
  capturedAt?: string;
  location?: string;
  unitPrice?: number | null;
  unitCost?: number | null;
};

type FinanceEntryDraft = {
  kind: FinanceEntryKind;
  period: FinanceEntryPeriod;
  amount: number;
  note?: string;
  recordedAt?: string;
  location?: string | null;
};

type SaleEntryDraft = {
  itemId?: string | null;
  itemName: string;
  category: string;
  location: string;
  quantity: number;
  unitPrice: number;
  barcode?: string | null;
  source?: string;
  soldAt?: string;
  costBucket?: 'food_cost' | 'bar_cost' | 'unknown';
};

type ReceiptPurchaseEntryDraft = {
  itemId?: string | null;
  itemName: string;
  category: string;
  location: string;
  quantity: number;
  unitPrice: number;
  barcode?: string | null;
  source?: string;
  recordedAt?: string;
  costBucket?: 'food_cost' | 'bar_cost' | 'unknown';
};

type MovementDraft = {
  type: StockMovementType;
  itemId?: string | null;
  itemName: string;
  category: string;
  quantity: number;
  fromLocation?: string | null;
  toLocation?: string | null;
  unitCost?: number | null;
  note?: string;
  recordedAt?: string;
  source?: string;
};

export type TaskItem = {
  id: string;
  title: string;
  detail: string;
  location: string | null;
  dueAt: string | null;
  status: 'open' | 'done';
  createdAt: string;
};

export type PurchaseOrderLine = {
  id: string;
  itemName: string;
  category: string;
  quantity: number;
  unitCost: number | null;
  supplierId: string | null;
};

export type PurchaseOrder = {
  id: string;
  createdAt: string;
  status: 'draft' | 'approved' | 'sent';
  location: string | null;
  lines: PurchaseOrderLine[];
};

type DispatchDraft = {
  product: string;
  category: string;
  quantity: number;
  fromLocation: string;
  destination: string;
  customerName?: string;
  driverName?: string;
  managerName?: string;
  createdAt?: string;
  sourceMovementId?: string | null;
  photoUri?: string | null;
  photoPlaceholder?: string | null;
};

type SupplierDraft = {
  name: string;
  contact?: string;
  leadTimeDays?: number;
};

type ReorderRuleDraft = {
  id?: string;
  location?: string | null;
  category?: string | null;
  itemName?: string | null;
  minQuantity: number;
  targetQuantity: number;
  unitCost?: number | null;
  supplierId?: string | null;
};

const STORAGE_KEY = 'stock-ai-inventory-v1';
const DEMO_MODE_ENABLED = false; // Geforceerd uit voor live test.
export const defaultInventoryLocations = ['Hoofdvestiging', 'Keuken', 'Magazijn', 'Bar', 'Frigo', 'Diepvries', 'Transport'] as const;
const MANUAL_STOCK_REQUIRED_LOCATIONS = ['Stock', 'Bar', 'Frigo', 'Keuken', 'Koelcel', 'Diepvries', 'Afval'] as const;
const MANUAL_STOCK_SEEDS: Array<{
  id: string;
  name: string;
  category: string;
  location: string;
  quantity: number;
  expiryDays: number;
  notes: string;
}> = [];

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

export function formatExpiryDateLabel(expiryDate: string | null) {
  const parsed = parseExpiryDate(expiryDate);
  if (!parsed) {
    return 'Onbekend';
  }

  return new Intl.DateTimeFormat('nl-BE', { dateStyle: 'medium' }).format(parsed);
}

export function formatExpiryStatusLabel(status: ExpiryStatus) {
  switch (status) {
    case 'OK':
      return 'OK';
    case 'Soon':
      return 'Bijna vervallen';
    case 'Critical':
      return 'Vervalt vandaag';
    case 'Expired':
      return 'Vervallen';
    default:
      return 'Onbekend';
  }
}

export function getExpiryActionContext(input: {
  category: string;
  expiryDate: string | null;
  referenceAt?: string | Date;
}) {
  const expiryStatus = getExpiryStatus(input.expiryDate, input.referenceAt);
  const normalizedCategory = input.category.trim().toLowerCase();
  const isDrank = normalizedCategory.includes('drank');
  const isBroodOrEten = normalizedCategory.includes('brood') || normalizedCategory.includes('eten');
  const isZuivelOrVlees = normalizedCategory.includes('zuivel') || normalizedCategory.includes('vlees');

  if (expiryStatus === 'Unknown') {
    return {
      expiryDate: input.expiryDate,
      expiryStatus,
      recommendedAction: 'Mens kiest actie',
      recommendedReason: 'De vervaldatum is onbekend, dus kies de actie handmatig.',
    };
  }

  if (expiryStatus === 'Expired') {
    return {
      expiryDate: input.expiryDate,
      expiryStatus,
      recommendedAction: 'Afboeken / Afval',
      recommendedReason: 'Product is vervallen en moet uit voorraad.',
    };
  }

  if (isDrank) {
    return {
      expiryDate: input.expiryDate,
      expiryStatus,
      recommendedAction: 'Naar Bar',
      recommendedReason:
        expiryStatus === 'OK'
          ? 'Drank is in orde en kan naar Bar.'
          : 'Drank is nog bruikbaar en kan naar Bar worden gestuurd.',
    };
  }

  if (isBroodOrEten && (expiryStatus === 'Soon' || expiryStatus === 'Critical')) {
    return {
      expiryDate: input.expiryDate,
      expiryStatus,
      recommendedAction: 'Eerst gebruiken in Keuken',
      recommendedReason:
        expiryStatus === 'Critical'
          ? 'Brood of eten vervalt vandaag, dus direct in de keuken gebruiken.'
          : 'Brood of eten is bijna vervallen, dus eerst in de keuken gebruiken.',
    };
  }

  if (isBroodOrEten) {
    return {
      expiryDate: input.expiryDate,
      expiryStatus,
      recommendedAction: 'Naar Keuken',
      recommendedReason: 'Brood of eten hoort in de keukenrotatie.',
    };
  }

  if (isZuivelOrVlees && (expiryStatus === 'Soon' || expiryStatus === 'Critical')) {
    return {
      expiryDate: input.expiryDate,
      expiryStatus,
      recommendedAction: 'Naar Koelcel of vandaag gebruiken',
      recommendedReason:
        expiryStatus === 'Critical'
          ? 'Zuivel of vlees vervalt vandaag, dus vandaag gebruiken of koel bewaren.'
          : 'Zuivel of vlees is bijna vervallen, dus koel bewaren of vandaag gebruiken.',
    };
  }

  if (isZuivelOrVlees) {
    return {
      expiryDate: input.expiryDate,
      expiryStatus,
      recommendedAction: 'Naar Koelcel',
      recommendedReason: 'Zuivel en vlees horen koel bewaard te worden.',
    };
  }

  return {
    expiryDate: input.expiryDate,
    expiryStatus,
    recommendedAction: 'Mens kiest actie',
    recommendedReason: 'Geen vaste voorraadregel gevonden voor deze combinatie.',
  };
}

function getExpiryStatus(expiryDate: string | null, referenceAt: string | Date = new Date()): ExpiryStatus {
  const parsed = parseExpiryDate(expiryDate);
  if (!parsed) {
    return 'Unknown';
  }

  const reference = referenceAt instanceof Date ? referenceAt : new Date(referenceAt);
  if (Number.isNaN(reference.getTime())) {
    return 'Unknown';
  }

  const startOfReference = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const startOfExpiry = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const dayDiff = Math.round((startOfExpiry.getTime() - startOfReference.getTime()) / (24 * 60 * 60 * 1000));

  if (dayDiff < 0) return 'Expired';
  if (dayDiff === 0) return 'Critical';
  if (dayDiff <= 2) return 'Soon';
  return 'OK';
}

function normalizePublicSource(source: unknown, fallback: string) {
  if (typeof source !== 'string') {
    return fallback;
  }

  const normalized = source.trim();
  if (!normalized) {
    return fallback;
  }

  const lower = normalized.toLowerCase();
  if (lower === 'demo' || lower === 'voorbeeld' || lower === 'sample' || lower === 'mock' || lower === 'manual-seed') {
    return fallback;
  }

  return normalized;
}

function createEmptyInventoryState(): InventoryState {
  return {
    items: [],
    locations: [...defaultInventoryLocations],
    financeEntries: [],
    salesEntries: [],
    movements: [],
    dispatches: [],
    suppliers: [],
    reorderRules: [],
    liveAlerts: [],
    tasks: [],
    purchaseOrders: [],
    lastSavedAt: null,
    manualStockSeeded: false,
  };
}

function seedManualStockState(state: InventoryState) {
  const nextLocations = Array.from(new Set([...state.locations, ...MANUAL_STOCK_REQUIRED_LOCATIONS]));
  const existingKeySet = new Set(
    state.items.map((item) =>
      `${item.name.trim().toLowerCase()}::${item.category.trim().toLowerCase()}::${item.location.trim().toLowerCase()}`
    )
  );

  let nextItems = state.items.slice();
  let changed = !state.manualStockSeeded || nextLocations.length !== state.locations.length;
  const seedRefreshAt = new Date().toISOString();

  MANUAL_STOCK_SEEDS.forEach((seed) => {
    const key = `${seed.name.toLowerCase()}::${seed.category.toLowerCase()}::${seed.location.toLowerCase()}`;
    if (existingKeySet.has(key)) {
      const existingIndex = nextItems.findIndex(
        (item) =>
          item.name.trim().toLowerCase() === seed.name.toLowerCase() &&
          item.category.trim().toLowerCase() === seed.category.toLowerCase() &&
          item.location.trim().toLowerCase() === seed.location.toLowerCase()
      );
      const existingItem = existingIndex >= 0 ? nextItems[existingIndex] : null;
      if (existingItem && existingItem.source === 'manual-seed' && existingItem.expiryDate === null) {
        nextItems[existingIndex] = normalizeInventoryItem(
          {
            ...existingItem,
            expiryDays: seed.expiryDays,
            capturedAt: seedRefreshAt,
          },
          nextLocations
        );
        changed = true;
      }
      return;
    }

    nextItems.push(
      normalizeInventoryItem(
        {
          id: seed.id,
          name: seed.name,
          category: seed.category,
          location: seed.location,
          quantity: seed.quantity,
          expiryDays: seed.expiryDays,
          confidence: null,
          notes: seed.notes,
          barcode: null,
          photoUri: null,
          batchCode: null,
          lotNumber: null,
          recallFlag: false,
          source: 'manual-seed',
          capturedAt: seedRefreshAt,
        },
        nextLocations
      )
    );
    changed = true;
  });

  if (!state.manualStockSeeded) {
    changed = true;
  }

  return {
    state: {
      ...state,
      items: nextItems,
      locations: nextLocations,
      manualStockSeeded: true,
    },
    changed,
  };
}

function isSeedId(id: string | null | undefined) {
  return typeof id === 'string' && id.trim().startsWith('seed-');
}

function isDemoSource(source: string | null | undefined) {
  if (typeof source !== 'string') {
    return false;
  }

  const normalized = source.trim().toLowerCase();
  return normalized === 'demo' || normalized === 'voorbeeld' || normalized === 'manual-seed' || normalized === 'mock' || normalized === 'sample';
}

function isSeededDemoProductName(name: string | null | undefined) {
  const normalized = (name ?? '').trim().toLowerCase();
  return normalized === 'brood' || normalized === 'wit brood' || normalized === 'limonade';
}

function isDemoInventoryEntry(entry: Partial<InventoryItem> | Partial<StockMovement> | Partial<SaleEntry>) {
  const id = typeof entry.id === 'string' ? entry.id : null;
  const source = typeof entry.source === 'string' ? entry.source : null;
  const name =
    'name' in entry && typeof entry.name === 'string'
      ? entry.name
      : 'itemName' in entry && typeof entry.itemName === 'string'
        ? entry.itemName
        : null;
  const barcode = 'barcode' in entry && typeof entry.barcode === 'string' ? entry.barcode.trim() : '';

  return Boolean(isSeedId(id) || isDemoSource(source) || (isSeededDemoProductName(name) && !barcode));
}

function stripDemoSeedData(state: InventoryState): InventoryState {
  return {
    ...state,
    items: state.items.filter((item) => !isDemoInventoryEntry(item)),
    financeEntries: state.financeEntries.filter((entry) => !isSeedId(entry.id)),
    salesEntries: state.salesEntries.filter((entry) => !isDemoInventoryEntry(entry)),
    movements: state.movements.filter((entry) => !isDemoInventoryEntry(entry)),
    dispatches: state.dispatches.filter((entry) => !isSeedId(entry.id)),
    suppliers: state.suppliers.filter((entry) => !isSeedId(entry.id)),
    reorderRules: state.reorderRules.filter((entry) => !isSeedId(entry.id)),
    liveAlerts: state.liveAlerts.filter((entry) => !isSeedId(entry.id)),
    tasks: state.tasks.filter((entry) => !isSeedId(entry.id)),
    purchaseOrders: state.purchaseOrders.filter((entry) => !isSeedId(entry.id)),
  };
}

function getInitialInventoryState(): InventoryState {
  return createEmptyInventoryState();
}

const listeners = new Set<() => void>();

function canUseStorage() {
  return hasSyncWebStorage();
}

function normalizeInventoryItem(
  item: Partial<InventoryItem> & Pick<InventoryItem, 'id' | 'name' | 'category'>,
  locations: string[]
): InventoryItem {
  const fallbackLocation = locations[0] ?? 'Hoofdvestiging';
  const normalizedLocation =
    item.location && locations.includes(item.location) ? item.location : fallbackLocation;
  const capturedAt = item.capturedAt ?? new Date().toISOString();
  const preservedExpiryDate = parseExpiryDate(item.expiryDate)?.toISOString() ?? null;
  const derivedExpiryDate = createExpiryDateFromDays(capturedAt, item.expiryDays ?? null);
  const expiryDate = preservedExpiryDate ?? derivedExpiryDate;
  const expiryDays = calculateExpiryDays(expiryDate);
  const expiryContext = getExpiryActionContext({
    category: item.category,
    expiryDate,
  });
  const quantity =
    typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? Math.max(0, Math.round(item.quantity)) : 1;
  const unitPrice =
    typeof item.unitPrice === 'number' && Number.isFinite(item.unitPrice) && item.unitPrice > 0 ? item.unitPrice : null;
  const stockValue = unitPrice === null ? 0 : quantity * unitPrice;

  return {
    id: item.id,
    name: item.name,
    category: item.category,
    location: normalizedLocation,
    quantity,
    expiryDays,
    expiryDate,
    expiryStatus: expiryContext.expiryStatus,
    recommendedAction: expiryContext.recommendedAction,
    recommendedReason: expiryContext.recommendedReason,
    confidence: item.confidence ?? null,
    notes: item.notes ?? '',
    barcode: item.barcode ?? null,
    photoUri: item.photoUri ?? null,
    unitPrice,
    stockValue,
    priceMissing: unitPrice === null || Boolean(item.priceMissing),
    lowStockThreshold:
      typeof item.lowStockThreshold === 'number' && Number.isFinite(item.lowStockThreshold) && item.lowStockThreshold > 1
        ? Math.round(item.lowStockThreshold)
        : undefined,
    unitLabel: typeof item.unitLabel === 'string' && item.unitLabel.trim() ? item.unitLabel.trim() : undefined,
    batchCode: item.batchCode ?? null,
    lotNumber: item.lotNumber ?? null,
    recallFlag: item.recallFlag ?? false,
    source: normalizePublicSource(item.source, 'scan'),
    capturedAt,
  };
}

function normalizeFinanceEntry(entry: Partial<FinanceEntry> & Pick<FinanceEntry, 'id' | 'kind' | 'amount'>, locations: string[]) {
  const normalizedKind: FinanceEntryKind =
    entry.kind === 'food_cost' || entry.kind === 'bar_cost' || entry.kind === 'loss' ? entry.kind : 'revenue';
  const normalizedPeriod: FinanceEntryPeriod =
    entry.period === 'week' || entry.period === 'month' ? entry.period : 'day';
  const normalizedLocation =
    typeof entry.location === 'string' && entry.location.trim() && locations.includes(entry.location.trim())
      ? entry.location.trim()
      : null;

  return {
    id: entry.id,
    kind: normalizedKind,
    period: normalizedPeriod,
    amount: typeof entry.amount === 'number' && Number.isFinite(entry.amount) ? Math.max(entry.amount, 0) : 0,
    note: entry.note ?? '',
    recordedAt: entry.recordedAt ?? new Date().toISOString(),
    location: normalizedLocation,
  };
}

function normalizeSaleEntry(
  entry: Partial<SaleEntry> & Pick<SaleEntry, 'id' | 'itemName' | 'category' | 'quantity' | 'unitPrice'>,
  locations: string[]
): SaleEntry {
  const fallbackLocation = locations[0] ?? 'Hoofdvestiging';
  const normalizedLocation =
    typeof entry.location === 'string' && entry.location.trim() && locations.includes(entry.location.trim())
      ? entry.location.trim()
      : fallbackLocation;
  const quantity =
    typeof entry.quantity === 'number' && Number.isFinite(entry.quantity) ? Math.max(1, Math.round(entry.quantity)) : 1;
  const unitPrice =
    typeof entry.unitPrice === 'number' && Number.isFinite(entry.unitPrice) ? Math.max(entry.unitPrice, 0) : 0;

  return {
    id: entry.id,
    itemId: typeof entry.itemId === 'string' && entry.itemId.trim() ? entry.itemId.trim() : null,
    itemName: entry.itemName,
    category: entry.category,
    location: normalizedLocation,
    quantity,
    unitPrice,
    totalAmount:
      typeof entry.totalAmount === 'number' && Number.isFinite(entry.totalAmount)
        ? Math.max(entry.totalAmount, 0)
        : quantity * unitPrice,
    barcode: entry.barcode ?? null,
    source: normalizePublicSource(entry.source, 'cash-register'),
    soldAt: entry.soldAt ?? new Date().toISOString(),
  };
}

function normalizeLocations(locations: unknown, ...sources: unknown[]) {
  const merged = new Set<string>(defaultInventoryLocations);

  if (Array.isArray(locations)) {
    locations.forEach((location) => {
      if (typeof location === 'string' && location.trim()) {
        merged.add(location.trim());
      }
    });
  }

  sources.forEach((source) => {
    if (!Array.isArray(source)) return;
    source.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      const candidate = entry as Record<string, unknown>;
      const location = candidate.location;
      const fromLocation = candidate.fromLocation;
      const toLocation = candidate.toLocation;

      [location, fromLocation, toLocation].forEach((value) => {
        if (typeof value === 'string' && value.trim()) {
          merged.add(value.trim());
        }
      });
    });
  });

  return [...merged];
}

function normalizeSupplier(entry: Partial<Supplier> & Pick<Supplier, 'id' | 'name'>): Supplier {
  const leadTime =
    typeof entry.leadTimeDays === 'number' && Number.isFinite(entry.leadTimeDays) ? Math.max(0, entry.leadTimeDays) : 1;

  return {
    id: entry.id,
    name: entry.name,
    contact: entry.contact ?? '',
    leadTimeDays: leadTime,
    createdAt: entry.createdAt ?? new Date().toISOString(),
  };
}

function normalizeReorderRule(
  entry: Partial<ReorderRule> & Pick<ReorderRule, 'id' | 'minQuantity' | 'targetQuantity'>,
  locations: string[],
  suppliers: Supplier[]
): ReorderRule {
  const normalizedLocation =
    typeof entry.location === 'string' && entry.location.trim() && locations.includes(entry.location.trim())
      ? entry.location.trim()
      : null;
  const supplierId =
    typeof entry.supplierId === 'string' &&
    entry.supplierId.trim() &&
    suppliers.some((supplier) => supplier.id === entry.supplierId)
      ? entry.supplierId
      : null;

  return {
    id: entry.id,
    location: normalizedLocation,
    category: typeof entry.category === 'string' && entry.category.trim() ? entry.category.trim() : null,
    itemName: typeof entry.itemName === 'string' && entry.itemName.trim() ? entry.itemName.trim() : null,
    minQuantity:
      typeof entry.minQuantity === 'number' && Number.isFinite(entry.minQuantity) ? Math.max(0, entry.minQuantity) : 0,
    targetQuantity:
      typeof entry.targetQuantity === 'number' && Number.isFinite(entry.targetQuantity)
        ? Math.max(1, entry.targetQuantity)
        : 1,
    unitCost: typeof entry.unitCost === 'number' && Number.isFinite(entry.unitCost) ? Math.max(0, entry.unitCost) : null,
    supplierId,
    updatedAt: entry.updatedAt ?? new Date().toISOString(),
  };
}

function normalizeMovement(
  entry: Partial<StockMovement> & Pick<StockMovement, 'id' | 'type' | 'itemName' | 'quantity'>,
  locations: string[]
): StockMovement {
  const normalizedType: StockMovementType =
    entry.type === 'receive' ||
    entry.type === 'sale' ||
    entry.type === 'consumption' ||
    entry.type === 'waste' ||
    entry.type === 'transfer' ||
    entry.type === 'adjust' ||
    entry.type === 'stocktake'
      ? entry.type
      : 'adjust';
  const fromLocation =
    typeof entry.fromLocation === 'string' && entry.fromLocation.trim() && locations.includes(entry.fromLocation.trim())
      ? entry.fromLocation.trim()
      : null;
  const toLocation =
    typeof entry.toLocation === 'string' && entry.toLocation.trim() && locations.includes(entry.toLocation.trim())
      ? entry.toLocation.trim()
      : null;
  const recordedAt = entry.recordedAt ?? new Date().toISOString();
  const expiryDate = parseExpiryDate(entry.expiryDate)?.toISOString() ?? null;
  const expiryContext = getExpiryActionContext({
    category: typeof entry.category === 'string' ? entry.category : 'Onbekend',
    expiryDate,
    referenceAt: recordedAt,
  });
  const actionLabel =
    typeof entry.actionLabel === 'string' && entry.actionLabel.trim()
      ? entry.actionLabel.trim()
      : normalizedType === 'transfer'
        ? 'Verplaatsing'
        : normalizedType === 'receive'
          ? 'Ontvangst'
          : normalizedType === 'sale'
            ? 'Verkoop'
            : normalizedType === 'consumption'
              ? 'Verbruik'
              : normalizedType === 'waste'
                ? 'Afval'
                : normalizedType === 'stocktake'
                  ? 'Stocktelling'
                  : 'Aanpassing';

  return {
    id: entry.id,
    type: normalizedType,
    itemId: typeof entry.itemId === 'string' && entry.itemId.trim() ? entry.itemId.trim() : null,
    itemName: entry.itemName,
    category: typeof entry.category === 'string' && entry.category.trim() ? entry.category.trim() : 'Onbekend',
    actionLabel,
    quantity:
      typeof entry.quantity === 'number' && Number.isFinite(entry.quantity) ? Math.max(1, Math.round(entry.quantity)) : 1,
    fromLocation,
    toLocation,
    unitCost: typeof entry.unitCost === 'number' && Number.isFinite(entry.unitCost) ? Math.max(0, entry.unitCost) : null,
    note: entry.note ?? '',
    recordedAt,
    source: normalizePublicSource(entry.source, 'system'),
    expiryDate,
    expiryStatus: expiryContext.expiryStatus,
    recommendedAction:
      typeof entry.recommendedAction === 'string' && entry.recommendedAction.trim()
        ? entry.recommendedAction.trim()
        : expiryContext.recommendedAction,
    recommendedReason:
      typeof entry.recommendedReason === 'string' && entry.recommendedReason.trim()
        ? entry.recommendedReason.trim()
        : expiryContext.recommendedReason,
  };
}

const allowedLiveAlertEvents: SoundEventId[] = [
  'expiry',
  'restock',
  'recognition',
  'trace',
  'finance_profit',
  'finance_loss',
  'finance_neutral',
];

const allowedLiveAlertHrefs: LiveAlertEvent['href'][] = ['/scan', '/explore', '/alerts', '/payments', '/trace'];

function normalizeLiveAlert(
  entry: Partial<LiveAlertEvent> & Pick<LiveAlertEvent, 'id' | 'event' | 'title'>,
  locations: string[]
): LiveAlertEvent {
  const event = allowedLiveAlertEvents.includes(entry.event) ? entry.event : 'trace';
  const href = typeof entry.href === 'string' && allowedLiveAlertHrefs.includes(entry.href as any) ? (entry.href as LiveAlertEvent['href']) : '/alerts';
  const location =
    typeof entry.location === 'string' && entry.location.trim() && locations.includes(entry.location.trim())
      ? entry.location.trim()
      : null;

  return {
    id: entry.id,
    event,
    title: entry.title,
    detail: entry.detail ?? '',
    href,
    createdAt: entry.createdAt ?? new Date().toISOString(),
    location,
    itemId: typeof entry.itemId === 'string' && entry.itemId.trim() ? entry.itemId.trim() : null,
  };
}

function isDispatchStatus(value: unknown): value is DispatchStatus {
  return (
    value === 'picked_from_stock' ||
    value === 'ready_for_departure' ||
    value === 'photo_proof_added' ||
    value === 'driver_confirmed' ||
    value === 'manager_confirmed' ||
    value === 'departure_confirmed'
  );
}

function isDispatchAuditEventKind(value: unknown): value is DispatchAuditEventKind {
  return (
    value === 'created' ||
    value === 'floor_confirmed' ||
    value === 'photo_added' ||
    value === 'driver_confirmed' ||
    value === 'manager_confirmed' ||
    value === 'departure_confirmed'
  );
}

function normalizeDispatchAuditEvent(
  entry: Partial<DispatchAuditEvent> & Pick<DispatchAuditEvent, 'id' | 'label'>,
  fallbackCreatedAt?: string
): DispatchAuditEvent {
  return {
    id: entry.id,
    kind: isDispatchAuditEventKind(entry.kind) ? entry.kind : 'created',
    label: entry.label,
    detail: typeof entry.detail === 'string' ? entry.detail : '',
    createdAt: entry.createdAt ?? fallbackCreatedAt ?? new Date().toISOString(),
  };
}

function normalizeDispatchAuditEvents(
  entries: unknown,
  fallbackCreatedAt?: string,
  fallbackWhenMissing: DispatchAuditEvent[] = []
) {
  if (!Array.isArray(entries)) {
    return fallbackWhenMissing;
  }

  return entries
    .filter((event) => {
      const candidate = event as Partial<DispatchAuditEvent>;
      return typeof candidate?.id === 'string' && typeof candidate?.label === 'string';
    })
    .map((event) =>
      normalizeDispatchAuditEvent(event as Partial<DispatchAuditEvent> & Pick<DispatchAuditEvent, 'id' | 'label'>, fallbackCreatedAt)
    );
}

function normalizeDispatchRecord(
  entry: Partial<DispatchRecord> & Pick<DispatchRecord, 'id' | 'dispatchId' | 'product' | 'category' | 'quantity' | 'fromLocation' | 'destination'>,
  _locations: string[]
): DispatchRecord {
  const createdAt = entry.createdAt ?? new Date().toISOString();
  const updatedAt = entry.updatedAt ?? createdAt;
  const auditEvents = normalizeDispatchAuditEvents(entry.auditEvents, createdAt);
  const receiptAuditEvents = normalizeDispatchAuditEvents(
    entry.receiptAuditEvents,
    createdAt,
    auditEvents.filter((event) =>
      [
        'departure_confirmed',
        'customer_receiving',
        'customer_confirmed',
        'invoice_released',
        'invoice_ready',
        'goods_closed',
        'dossier_complete',
      ].includes(event.kind)
    )
  );

  const nextAuditEvents =
    auditEvents.length > 0
      ? auditEvents
      : [
          normalizeDispatchAuditEvent(
            {
              id: `${entry.id}-created`,
              kind: 'created',
              label: 'Uit Stock gehaald',
              detail: 'Vertrekcontrole gestart.',
              createdAt,
            },
            createdAt
          ),
        ];

  return {
    id: entry.id,
    dispatchId: typeof entry.dispatchId === 'string' && entry.dispatchId.trim() ? entry.dispatchId.trim() : entry.id,
    product: typeof entry.product === 'string' && entry.product.trim() ? entry.product.trim() : 'Onbekend product',
    category: typeof entry.category === 'string' && entry.category.trim() ? entry.category.trim() : 'Onbekend',
    quantity:
      typeof entry.quantity === 'number' && Number.isFinite(entry.quantity) ? Math.max(1, Math.round(entry.quantity)) : 1,
    fromLocation: typeof entry.fromLocation === 'string' && entry.fromLocation.trim() ? entry.fromLocation.trim() : 'Onbekend',
    destination: typeof entry.destination === 'string' && entry.destination.trim() ? entry.destination.trim() : 'Onbekend',
    customerName: typeof entry.customerName === 'string' && entry.customerName.trim() ? entry.customerName.trim() : 'Klant',
    customerConfirmedAt:
      typeof entry.customerConfirmedAt === 'string' && entry.customerConfirmedAt.trim() ? entry.customerConfirmedAt.trim() : null,
    customerReceiptStatus:
      entry.customerReceiptStatus === 'awaiting_customer' || entry.customerReceiptStatus === 'received'
        ? entry.customerReceiptStatus
        : 'pending',
    invoiceStatus:
      entry.invoiceStatus === 'released' || entry.invoiceStatus === 'ready' ? entry.invoiceStatus : 'pending',
    invoiceReleasedAt:
      typeof entry.invoiceReleasedAt === 'string' && entry.invoiceReleasedAt.trim() ? entry.invoiceReleasedAt.trim() : null,
    invoiceReference:
      typeof entry.invoiceReference === 'string' && entry.invoiceReference.trim() ? entry.invoiceReference.trim() : null,
    goodsClosedAt: typeof entry.goodsClosedAt === 'string' && entry.goodsClosedAt.trim() ? entry.goodsClosedAt.trim() : null,
    finalAuditStatus: entry.finalAuditStatus === 'complete' ? 'complete' : 'open',
    driverName:
      typeof entry.driverName === 'string' && entry.driverName.trim() ? entry.driverName.trim() : 'Chauffeur',
    managerName:
      typeof entry.managerName === 'string' && entry.managerName.trim() ? entry.managerName.trim() : 'Manager',
    floorConfirmedAt: typeof entry.floorConfirmedAt === 'string' && entry.floorConfirmedAt.trim() ? entry.floorConfirmedAt.trim() : null,
    driverConfirmedAt:
      typeof entry.driverConfirmedAt === 'string' && entry.driverConfirmedAt.trim() ? entry.driverConfirmedAt.trim() : null,
    managerConfirmedAt:
      typeof entry.managerConfirmedAt === 'string' && entry.managerConfirmedAt.trim() ? entry.managerConfirmedAt.trim() : null,
    departureConfirmedAt:
      typeof entry.departureConfirmedAt === 'string' && entry.departureConfirmedAt.trim() ? entry.departureConfirmedAt.trim() : null,
    photoUri: typeof entry.photoUri === 'string' && entry.photoUri.trim() ? entry.photoUri.trim() : null,
    photoPlaceholder:
      typeof entry.photoPlaceholder === 'string' && entry.photoPlaceholder.trim() ? entry.photoPlaceholder.trim() : null,
    status: isDispatchStatus(entry.status) ? entry.status : 'picked_from_stock',
    auditEvents: nextAuditEvents,
    receiptAuditEvents,
    createdAt,
    updatedAt,
    sourceMovementId:
      typeof entry.sourceMovementId === 'string' && entry.sourceMovementId.trim() ? entry.sourceMovementId.trim() : null,
  };
}

function sortDispatchRecords(records: DispatchRecord[]) {
  return records
    .slice()
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

function normalizeState(parsed: Partial<InventoryState>): InventoryState {
  if (!Array.isArray(parsed.items)) {
    return getInitialInventoryState();
  }

  const locations = normalizeLocations(
    parsed.locations,
    parsed.items,
    parsed.salesEntries,
    parsed.financeEntries,
    (parsed as Partial<InventoryState> & { movements?: unknown }).movements,
    (parsed as Partial<InventoryState> & { reorderRules?: unknown }).reorderRules
  );

  const suppliers = Array.isArray((parsed as Partial<InventoryState> & { suppliers?: unknown }).suppliers)
    ? ((parsed as Partial<InventoryState> & { suppliers?: unknown }).suppliers as unknown[])
        .filter((entry) => {
          const candidate = entry as Partial<Supplier>;
          return typeof candidate?.id === 'string' && typeof candidate?.name === 'string';
        })
        .map((entry) => normalizeSupplier(entry as Partial<Supplier> & Pick<Supplier, 'id' | 'name'>))
    : [];

  const liveAlerts = Array.isArray((parsed as Partial<InventoryState> & { liveAlerts?: unknown }).liveAlerts)
    ? ((parsed as Partial<InventoryState> & { liveAlerts?: unknown }).liveAlerts as unknown[])
        .filter((entry) => {
          const candidate = entry as Partial<LiveAlertEvent>;
          return typeof candidate?.id === 'string' && typeof candidate?.event === 'string' && typeof candidate?.title === 'string';
        })
        .map((entry) =>
          normalizeLiveAlert(entry as Partial<LiveAlertEvent> & Pick<LiveAlertEvent, 'id' | 'event' | 'title'>, locations)
        )
    : [];

  const rawItems = parsed.items.filter((item) => !isDemoInventoryEntry(item as Partial<InventoryItem>));

  const normalizedState: InventoryState = {
    items: rawItems.map((item) =>
      normalizeInventoryItem(
        item as Partial<InventoryItem> & Pick<InventoryItem, 'id' | 'name' | 'category'>,
        locations
      )
    ),
    locations,
    financeEntries: Array.isArray(parsed.financeEntries)
      ? parsed.financeEntries
          .filter((entry) => {
            const candidate = entry as Partial<FinanceEntry>;
            return (
              typeof candidate?.id === 'string' &&
              typeof candidate?.kind === 'string' &&
              typeof candidate?.amount === 'number'
            );
          })
          .map((entry) =>
            normalizeFinanceEntry(
              entry as Partial<FinanceEntry> & Pick<FinanceEntry, 'id' | 'kind' | 'amount'>,
              locations
            )
          )
      : [],
    salesEntries: Array.isArray(parsed.salesEntries)
      ? parsed.salesEntries
          .filter((entry) => {
            const candidate = entry as Partial<SaleEntry>;
            return (
              typeof candidate?.id === 'string' &&
              typeof candidate?.itemName === 'string' &&
              typeof candidate?.category === 'string' &&
              typeof candidate?.quantity === 'number' &&
              typeof candidate?.unitPrice === 'number'
            );
          })
          .map((entry) =>
            normalizeSaleEntry(
              entry as Partial<SaleEntry> &
                Pick<SaleEntry, 'id' | 'itemName' | 'category' | 'quantity' | 'unitPrice'>,
              locations
            )
          )
      : [],
    movements: Array.isArray((parsed as Partial<InventoryState> & { movements?: unknown }).movements)
      ? ((parsed as Partial<InventoryState> & { movements?: unknown }).movements as unknown[])
          .filter((entry) => {
            const candidate = entry as Partial<StockMovement>;
            return (
              typeof candidate?.id === 'string' &&
              typeof candidate?.type === 'string' &&
              typeof candidate?.itemName === 'string' &&
              typeof candidate?.quantity === 'number'
            );
          })
          .map((entry) =>
            normalizeMovement(
              entry as Partial<StockMovement> &
                Pick<StockMovement, 'id' | 'type' | 'itemName' | 'quantity'>,
              locations
            )
          )
      : [],
    dispatches: Array.isArray((parsed as Partial<InventoryState> & { dispatches?: unknown }).dispatches)
      ? ((parsed as Partial<InventoryState> & { dispatches?: unknown }).dispatches as unknown[])
          .filter((entry) => {
            const candidate = entry as Partial<DispatchRecord>;
            return (
              typeof candidate?.id === 'string' &&
              typeof candidate?.dispatchId === 'string' &&
              typeof candidate?.product === 'string' &&
              typeof candidate?.category === 'string' &&
              typeof candidate?.quantity === 'number' &&
              typeof candidate?.fromLocation === 'string' &&
              typeof candidate?.destination === 'string'
            );
          })
          .map((entry) =>
            normalizeDispatchRecord(
              entry as Partial<DispatchRecord> &
                Pick<DispatchRecord, 'id' | 'dispatchId' | 'product' | 'category' | 'quantity' | 'fromLocation' | 'destination'>,
              locations
            )
          )
      : [],
    suppliers,
    reorderRules: Array.isArray((parsed as Partial<InventoryState> & { reorderRules?: unknown }).reorderRules)
      ? ((parsed as Partial<InventoryState> & { reorderRules?: unknown }).reorderRules as unknown[])
          .filter((entry) => {
            const candidate = entry as Partial<ReorderRule>;
            return (
              typeof candidate?.id === 'string' &&
              typeof candidate?.minQuantity === 'number' &&
              typeof candidate?.targetQuantity === 'number'
            );
          })
          .map((entry) =>
            normalizeReorderRule(
              entry as Partial<ReorderRule> & Pick<ReorderRule, 'id' | 'minQuantity' | 'targetQuantity'>,
              locations,
              suppliers
            )
          )
      : [],
    liveAlerts,
    tasks: Array.isArray((parsed as Partial<InventoryState> & { tasks?: unknown }).tasks)
      ? ((parsed as Partial<InventoryState> & { tasks?: unknown }).tasks as unknown[])
          .filter((entry) => typeof (entry as TaskItem | null)?.id === 'string')
          .map((entry) => {
            const task = entry as Partial<TaskItem> & Pick<TaskItem, 'id' | 'title'>;
            return {
              id: task.id,
              title: task.title ?? 'Taak',
              detail: task.detail ?? '',
              location: typeof task.location === 'string' ? task.location : null,
              dueAt: task.dueAt ?? null,
              status: task.status === 'done' ? 'done' : 'open',
              createdAt: task.createdAt ?? new Date().toISOString(),
            };
          })
      : [],
    purchaseOrders: Array.isArray((parsed as Partial<InventoryState> & { purchaseOrders?: unknown }).purchaseOrders)
      ? ((parsed as Partial<InventoryState> & { purchaseOrders?: unknown }).purchaseOrders as unknown[])
          .filter((entry) => typeof (entry as PurchaseOrder | null)?.id === 'string')
          .map((entry) => {
            const po = entry as Partial<PurchaseOrder> & Pick<PurchaseOrder, 'id'>;
            const lines = Array.isArray(po.lines)
              ? po.lines
                  .filter((line) => typeof (line as PurchaseOrderLine | null)?.id === 'string')
                  .map((line) => {
                    const l = line as Partial<PurchaseOrderLine> & Pick<PurchaseOrderLine, 'id' | 'itemName'>;
                    return {
                      id: l.id,
                      itemName: l.itemName ?? 'Onbekend',
                      category: l.category ?? 'Onbekend',
                      quantity: typeof l.quantity === 'number' ? l.quantity : 0,
                      unitCost: typeof l.unitCost === 'number' ? l.unitCost : null,
                      supplierId: typeof l.supplierId === 'string' ? l.supplierId : null,
                    };
                  })
              : [];
            return {
              id: po.id,
              createdAt: po.createdAt ?? new Date().toISOString(),
              status: po.status === 'approved' || po.status === 'sent' ? po.status : 'draft',
              location: typeof po.location === 'string' ? po.location : null,
              lines,
            };
          })
      : [],
    lastSavedAt: parsed.lastSavedAt ?? null,
    manualStockSeeded: parsed.manualStockSeeded === true,
  };

  if (DEMO_MODE_ENABLED) {
    const seededState = seedManualStockState(normalizedState);
    manualStockSeedNeedsPersist = manualStockSeedNeedsPersist || seededState.changed;
    return seededState.state;
  }

  return stripDemoSeedData(normalizedState);
}

function loadState(): InventoryState {
  if (!canUseStorage()) {
    if (DEMO_MODE_ENABLED) {
      const seeded = seedManualStockState(getInitialInventoryState());
      manualStockSeedNeedsPersist = seeded.changed;
      return seeded.state;
    }
    return getInitialInventoryState();
  }

  try {
    const raw = getItemSyncWeb(STORAGE_KEY);
    if (!raw) {
      if (DEMO_MODE_ENABLED) {
        const seeded = seedManualStockState(getInitialInventoryState());
        manualStockSeedNeedsPersist = seeded.changed;
        return seeded.state;
      }
      return getInitialInventoryState();
    }

    const parsed = JSON.parse(raw) as Partial<InventoryState>;
    const normalized = normalizeState(parsed);
    manualStockSeedNeedsPersist = manualStockSeedNeedsPersist || parsed.manualStockSeeded !== true;
    return normalized;
  } catch {
    if (DEMO_MODE_ENABLED) {
      const seeded = seedManualStockState(getInitialInventoryState());
      manualStockSeedNeedsPersist = seeded.changed;
      return seeded.state;
    }
    return getInitialInventoryState();
  }
}

let manualStockSeedNeedsPersist = false;
let state = loadState();

let hydrationStarted = false;
let hasUserMutation = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let cloudRealtimeStarted = false;
let cloudChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
let cloudFlushTimer: ReturnType<typeof setInterval> | null = null;

async function mergeCloudStateFromCurrentSession() {
  const cloud = await pullCloudState();
  if (!cloud) {
    return false;
  }

  const nextState = normalizeState(cloud as Partial<InventoryState>);
  const currentSavedAt = state.lastSavedAt ? new Date(state.lastSavedAt).getTime() : 0;
  const incomingSavedAt = nextState.lastSavedAt ? new Date(nextState.lastSavedAt).getTime() : 0;

  if (!currentSavedAt || !incomingSavedAt || incomingSavedAt >= currentSavedAt) {
    state = nextState;
    listeners.forEach((listener) => listener());
    await setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  }

  const ok = await pushCloudState(state);
  if (!ok) {
    await enqueueCloudState(state);
  }
  return false;
}

function startCloudFlushLoop() {
  if (cloudFlushTimer) return;
  cloudFlushTimer = setInterval(() => {
    flushCloudQueue(pushCloudState).catch(() => {});
  }, 15_000);
}

async function hydrateState() {
  if (hydrationStarted) return;
  hydrationStarted = true;

  const webLoadedSynchronously = canUseStorage();

  if (!webLoadedSynchronously) {
    const raw = await getItem(STORAGE_KEY);
    if (!raw) {
      if (DEMO_MODE_ENABLED) {
        const seeded = seedManualStockState(getInitialInventoryState());
        state = seeded.state;
        manualStockSeedNeedsPersist = seeded.changed;
      } else {
        state = getInitialInventoryState();
      }
      listeners.forEach((listener) => listener());
    } else if (!hasUserMutation) {
      try {
        const parsed = JSON.parse(raw) as Partial<InventoryState>;
        if (Array.isArray(parsed.items)) {
          state = normalizeState(parsed);
          listeners.forEach((listener) => listener());
        }
      } catch {
        // ignore
      }
    }
  }

  // Optional cloud sync (Supabase). This is best-effort and never blocks startup.
  try {
    if (!hasUserMutation) {
      await mergeCloudStateFromCurrentSession();
    }
  } catch {
    // ignore
  }

  if (manualStockSeedNeedsPersist && !hasUserMutation) {
    await persistState();
    manualStockSeedNeedsPersist = false;
  }

  startCloudRealtime().catch(() => {});
  startCloudFlushLoop();
}

hydrateState().catch(() => {});

if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session?.user?.id) return;
    mergeCloudStateFromCurrentSession()
      .then(() => startCloudRealtime())
      .then(() => startCloudFlushLoop())
      .catch(() => {});
  });
}

async function startCloudRealtime() {
  if (cloudRealtimeStarted) return;
  if (!supabase) return;
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return;
  cloudRealtimeStarted = true;

  cloudChannel = supabase
    .channel('app_state_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'app_state', filter: `user_id=eq.${userId}` },
      async () => {
        try {
          const cloud = await pullCloudState();
          if (!cloud) return;
          const next = normalizeState(cloud as Partial<InventoryState>);
          const currentSavedAt = state.lastSavedAt ? new Date(state.lastSavedAt).getTime() : 0;
          const incomingSavedAt = next.lastSavedAt ? new Date(next.lastSavedAt).getTime() : 0;
          if (incomingSavedAt && incomingSavedAt > currentSavedAt) {
            state = next;
            listeners.forEach((listener) => listener());
          }
        } catch {
          // ignore realtime errors
        }
      }
    )
    .subscribe();
}

async function persistState() {
  state = { ...state, lastSavedAt: new Date().toISOString() };
  await setItem(STORAGE_KEY, JSON.stringify(state));
  manualStockSeedNeedsPersist = false;
  const ok = await pushCloudState(state);
  if (!ok) {
    await enqueueCloudState(state);
  } else {
    flushCloudQueue(pushCloudState).catch(() => {});
  }
}

export async function persistInventoryStateToCloudNow(): Promise<CloudSyncResult> {
  state = { ...state, lastSavedAt: new Date().toISOString() };
  await setItem(STORAGE_KEY, JSON.stringify(state));
  manualStockSeedNeedsPersist = false;
  const result = await pushCloudStateWithResult(state);
  if (!result.ok) {
    await enqueueCloudState(state);
  }
  return result;
}

function emitChange() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistState().catch(() => {});
  }, 200);
  listeners.forEach((listener) => listener());
}

function notifyFinance(kind: FinanceEntryKind) {
  try {
    const settings = loadSoundSettings();
    if (!settings.enabled) return;
    playEvent(eventForFinanceKind(kind), settings).catch(() => {});
  } catch {
    // ignore
  }
}

function notifyTrace() {
  try {
    const settings = loadSoundSettings();
    if (!settings.enabled) return;
    playEvent('trace', settings).catch(() => {});
  } catch {
    // ignore
  }
}

function notifyLiveAlert(event: SoundEventId) {
  try {
    const settings = loadSoundSettings();
    if (!settings.enabled) return;
    playEvent(event, settings).catch(() => {});
  } catch {
    // ignore
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

function setState(nextState: InventoryState) {
  state = nextState;
  hasUserMutation = true;
  emitChange();
}

export function useInventory() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function addInventoryItem(item: InventoryDraft) {
  const nextId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const location = item.location?.trim() || state.locations[0] || 'Hoofdvestiging';
  const nextLocations = state.locations.includes(location) ? state.locations : [...state.locations, location];
  const recordedAt = item.capturedAt ?? new Date().toISOString();
  const unitPrice =
    typeof item.unitPrice === 'number' && Number.isFinite(item.unitPrice) && item.unitPrice > 0
      ? item.unitPrice
      : typeof item.unitCost === 'number' && Number.isFinite(item.unitCost) && item.unitCost > 0
        ? item.unitCost
        : null;

  const movement = normalizeMovement(
    {
      id: `${nextId}-stocktake`,
      type: 'stocktake',
      itemId: nextId,
      itemName: item.name,
      category: item.category,
      quantity: typeof item.quantity === 'number' ? item.quantity : 1,
      fromLocation: null,
      toLocation: location,
      unitCost: unitPrice,
      note: unitPrice === null ? 'Nieuwe scan / stocktake - prijs ontbreekt' : 'Nieuwe scan / stocktake',
      recordedAt,
      source: item.source ?? 'scan',
    },
    nextLocations
  );

  setState({
    ...state,
    items: [
      normalizeInventoryItem(
        {
          ...item,
          id: nextId,
          location,
          unitPrice,
          priceMissing: unitPrice === null,
          capturedAt: recordedAt,
        },
        nextLocations
      ),
      ...state.items,
    ],
    locations: nextLocations,
    movements: [movement, ...state.movements],
    lastSavedAt: new Date().toISOString(),
  });
}

export function addOrMergeInventoryItem(item: InventoryDraft) {
  const location = item.location?.trim() || state.locations[0] || 'Hoofdvestiging';
  const nextLocations = state.locations.includes(location) ? state.locations : [...state.locations, location];
  const recordedAt = item.capturedAt ?? new Date().toISOString();
  const normalizedName = item.name.trim().toLowerCase().replace(/\s+/g, ' ');
  const normalizedCategory = item.category.trim().toLowerCase().replace(/\s+/g, ' ');
  const normalizedBarcode = item.barcode?.trim() || '';
  const quantity = typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? Math.max(1, Math.round(item.quantity)) : 1;
  const incomingUnitPrice =
    typeof item.unitPrice === 'number' && Number.isFinite(item.unitPrice) && item.unitPrice > 0
      ? item.unitPrice
      : typeof item.unitCost === 'number' && Number.isFinite(item.unitCost) && item.unitCost > 0
        ? item.unitCost
        : null;
  const incomingStockValue = incomingUnitPrice === null ? 0 : quantity * incomingUnitPrice;

  let matchedBy: 'barcode' | 'name' | null = null;
  const matchIndex = state.items.findIndex((entry) => {
    if (entry.location !== location) return false;
    if (normalizedBarcode && entry.barcode?.trim() === normalizedBarcode) {
      matchedBy = 'barcode';
      return true;
    }

    const matchesByName =
      entry.name.trim().toLowerCase().replace(/\s+/g, ' ') === normalizedName &&
      entry.category.trim().toLowerCase().replace(/\s+/g, ' ') === normalizedCategory;
    if (matchesByName) {
      matchedBy = 'name';
      return true;
    }

    return false;
  });

  if (matchIndex === -1) {
    addInventoryItem({
      ...item,
      location,
      capturedAt: recordedAt,
      quantity,
    });
    return {
      ok: true as const,
      mode: 'created' as const,
      itemId: state.items[0]?.id ?? null,
      quantity,
      nextQuantity: quantity,
      matchedBy: null,
    };
  }

  const matchedItem = state.items[matchIndex];
  const nextQuantity = matchedItem.quantity + quantity;
  const nextStockValue = matchedItem.stockValue + incomingStockValue;
  const nextUnitPrice = nextStockValue > 0 && nextQuantity > 0 ? nextStockValue / nextQuantity : incomingUnitPrice;
  const nextConfidence =
    typeof item.confidence === 'number' && Number.isFinite(item.confidence)
      ? typeof matchedItem.confidence === 'number' && Number.isFinite(matchedItem.confidence)
        ? Math.max(matchedItem.confidence, item.confidence)
        : item.confidence
      : matchedItem.confidence;
  const nextExpiryDays =
    typeof item.expiryDays === 'number' && Number.isFinite(item.expiryDays)
      ? typeof matchedItem.expiryDays === 'number' && Number.isFinite(matchedItem.expiryDays)
        ? Math.min(matchedItem.expiryDays, item.expiryDays)
        : item.expiryDays
      : matchedItem.expiryDays;
  const mergedNotes =
    item.notes?.trim() && item.notes.trim() !== matchedItem.notes.trim()
      ? matchedItem.notes.trim()
        ? `${matchedItem.notes.trim()} | ${item.notes.trim()}`
        : item.notes.trim()
      : matchedItem.notes;

  const nextItems = state.items.map((entry, index) =>
    index === matchIndex
      ? normalizeInventoryItem(
          {
            ...entry,
            quantity: nextQuantity,
            unitPrice: nextUnitPrice,
            priceMissing: matchedItem.priceMissing || incomingUnitPrice === null,
            confidence: nextConfidence ?? null,
            expiryDays: nextExpiryDays ?? null,
            expiryDate: matchedItem.expiryDate,
            notes: mergedNotes,
            barcode: normalizedBarcode || entry.barcode,
            photoUri: item.photoUri ?? entry.photoUri,
            batchCode: item.batchCode ?? entry.batchCode,
            lotNumber: item.lotNumber ?? entry.lotNumber,
            recallFlag: entry.recallFlag || Boolean(item.recallFlag),
            source: item.source ?? entry.source,
            capturedAt: recordedAt,
          },
          nextLocations
        )
      : entry
  );

  const movement = normalizeMovement(
    {
      id: `${matchedItem.id}-${Date.now()}-stocktake`,
      type: 'stocktake',
      itemId: matchedItem.id,
      itemName: matchedItem.name,
      category: matchedItem.category,
      quantity,
      fromLocation: null,
      toLocation: location,
      unitCost: incomingUnitPrice,
      note:
        `${matchedBy === 'barcode' ? 'Scan toegevoegd aan bestaande stock (barcode match)' : 'Scan toegevoegd aan bestaande stock (naam match)'}${
          incomingUnitPrice === null ? ' - prijs ontbreekt' : ''
        }`,
      recordedAt,
      source: item.source ?? matchedItem.source,
    },
    nextLocations
  );

  setState({
    ...state,
    items: nextItems,
    locations: nextLocations,
    movements: [movement, ...state.movements],
    lastSavedAt: new Date().toISOString(),
  });

  return {
    ok: true as const,
    mode: 'merged' as const,
    itemId: matchedItem.id,
    quantity,
    nextQuantity,
    matchedBy: matchedBy ?? ('name' as const),
  };
}

export function addFinanceEntry(entry: FinanceEntryDraft) {
  const nextId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  setState({
    ...state,
    financeEntries: [
      normalizeFinanceEntry(
        {
          ...entry,
          id: nextId,
          note: entry.note ?? '',
          recordedAt: entry.recordedAt ?? new Date().toISOString(),
        },
        state.locations
      ),
      ...state.financeEntries,
    ],
    lastSavedAt: new Date().toISOString(),
  });

  notifyFinance(entry.kind);
}

export function addSaleEntry(entry: SaleEntryDraft) {
  const nextId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const normalizedSale = normalizeSaleEntry(
    {
      ...entry,
      id: nextId,
      soldAt: entry.soldAt ?? new Date().toISOString(),
      barcode: entry.barcode ?? null,
      source: entry.source ?? 'cash-register',
    },
    state.locations
  );

  setState({
    ...state,
    salesEntries: [normalizedSale, ...state.salesEntries],
    lastSavedAt: new Date().toISOString(),
  });

  return normalizedSale;
}

export function registerPointOfSaleSale(entry: SaleEntryDraft) {
  const nextId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const normalizedSale = normalizeSaleEntry(
    {
      ...entry,
      id: nextId,
      soldAt: entry.soldAt ?? new Date().toISOString(),
      barcode: entry.barcode ?? null,
      source: entry.source ?? 'cash-register',
    },
    state.locations
  );

  const matchedItemId = normalizedSale.itemId;
  let matchedStock = false;
  let remainingQuantity: number | null = null;

  const nextItems = state.items.flatMap((item) => {
    if (matchedItemId && item.id === matchedItemId) {
      matchedStock = true;
      const nextQuantity = Math.max(item.quantity - normalizedSale.quantity, 0);
      remainingQuantity = nextQuantity;

      if (nextQuantity <= 0) {
        return [];
      }

      return [{ ...item, quantity: nextQuantity }];
    }

    return [item];
  });

  const revenueEntry = normalizeFinanceEntry(
    {
      id: `${nextId}-revenue`,
      kind: 'revenue',
      amount: normalizedSale.totalAmount,
      period: 'day',
      note: `Kassaverkoop ${normalizedSale.itemName}`,
      recordedAt: normalizedSale.soldAt,
      location: normalizedSale.location,
    },
    state.locations
  );

  const movement = normalizeMovement(
    {
      id: `${nextId}-sale`,
      type: 'sale',
      itemId: normalizedSale.itemId ?? null,
      itemName: normalizedSale.itemName,
      category: normalizedSale.category,
      quantity: normalizedSale.quantity,
      fromLocation: normalizedSale.location,
      toLocation: null,
      unitCost: null,
      note: 'Kassaverkoop',
      recordedAt: normalizedSale.soldAt,
      source: normalizedSale.source,
    },
    state.locations
  );

  setState({
    ...state,
    items: nextItems,
    salesEntries: [normalizedSale, ...state.salesEntries],
    financeEntries: [revenueEntry, ...state.financeEntries],
    movements: [movement, ...state.movements],
    lastSavedAt: new Date().toISOString(),
  });

  notifyFinance('revenue');

  return {
    ok: true as const,
    sale: normalizedSale,
    matchedStock,
    remainingQuantity,
  };
}

export function registerBatchPointOfSaleSales(entries: SaleEntryDraft[]) {
  if (!entries.length) {
    return {
      ok: false as const,
      count: 0,
      matchedCount: 0,
      totalRevenue: 0,
    };
  }

  let nextItems = [...state.items];
  const nextSales: SaleEntry[] = [];
  const nextFinanceEntries: FinanceEntry[] = [];
  const nextMovements: StockMovement[] = [];
  let matchedCount = 0;
  let totalRevenue = 0;
  let totalFoodCost = 0;
  let totalBarCost = 0;
  let totalUnknownCost = 0;

  entries.forEach((entry, index) => {
    const nextId = `${Date.now()}-${index}-${Math.random().toString(16).slice(2, 8)}`;
    const normalizedSale = normalizeSaleEntry(
      {
        ...entry,
        id: nextId,
        soldAt: entry.soldAt ?? new Date().toISOString(),
        barcode: entry.barcode ?? null,
        source: entry.source ?? 'cash-register-batch',
      },
      state.locations
    );

    let matchedStock = false;

    nextItems = nextItems.flatMap((item) => {
      if (normalizedSale.itemId && item.id === normalizedSale.itemId) {
        matchedStock = true;
        const nextQuantity = Math.max(item.quantity - normalizedSale.quantity, 0);

        if (nextQuantity <= 0) {
          return [];
        }

        return [{ ...item, quantity: nextQuantity }];
      }

      return [item];
    });

    if (matchedStock) {
      matchedCount += 1;
    }

    totalRevenue += normalizedSale.totalAmount;
    if (entry.costBucket === 'food_cost') {
      totalFoodCost += normalizedSale.totalAmount;
    } else if (entry.costBucket === 'bar_cost') {
      totalBarCost += normalizedSale.totalAmount;
    } else {
      totalUnknownCost += normalizedSale.totalAmount;
    }
    nextSales.push(normalizedSale);
    nextFinanceEntries.push(
      normalizeFinanceEntry(
        {
          id: `${nextId}-revenue`,
          kind: 'revenue',
          amount: normalizedSale.totalAmount,
          period: 'day',
          note: `Kassaticket ${normalizedSale.itemName}`,
          recordedAt: normalizedSale.soldAt,
          location: normalizedSale.location,
        },
        state.locations
      )
    );
    if (entry.costBucket === 'food_cost' || entry.costBucket === 'bar_cost') {
      nextFinanceEntries.push(
        normalizeFinanceEntry(
          {
            id: `${nextId}-${entry.costBucket}`,
            kind: entry.costBucket,
            amount: normalizedSale.totalAmount,
            period: 'day',
            note: `Kassaticket cost split ${normalizedSale.itemName}`,
            recordedAt: normalizedSale.soldAt,
            location: normalizedSale.location,
          },
          state.locations
        )
      );
    }

    nextMovements.push(
      normalizeMovement(
        {
          id: `${nextId}-sale`,
          type: 'sale',
          itemId: normalizedSale.itemId ?? null,
          itemName: normalizedSale.itemName,
          category: normalizedSale.category,
          quantity: normalizedSale.quantity,
          fromLocation: normalizedSale.location,
          toLocation: null,
          unitCost: null,
          note: 'Batch kassaticket',
          recordedAt: normalizedSale.soldAt,
          source: normalizedSale.source,
        },
        state.locations
      )
    );
  });

  setState({
    ...state,
    items: nextItems,
    salesEntries: [...nextSales.reverse(), ...state.salesEntries],
    financeEntries: [...nextFinanceEntries.reverse(), ...state.financeEntries],
    movements: [...nextMovements.reverse(), ...state.movements],
    lastSavedAt: new Date().toISOString(),
  });

  if (totalRevenue > 0) {
    notifyFinance('revenue');
  }

  return {
    ok: true as const,
    count: nextSales.length,
    matchedCount,
    totalRevenue,
    totalFoodCost,
    totalBarCost,
    totalUnknownCost,
  };
}

export function registerBatchReceiptPurchases(entries: ReceiptPurchaseEntryDraft[]) {
  if (!entries.length) {
    return {
      ok: false as const,
      count: 0,
      matchedCount: 0,
      createdCount: 0,
      totalFoodCost: 0,
      totalBarCost: 0,
      totalUnknownCost: 0,
    };
  }

  let nextItems = [...state.items];
  let nextLocations = [...state.locations];
  const nextFinanceEntries: FinanceEntry[] = [];
  const nextMovements: StockMovement[] = [];
  let matchedCount = 0;
  let createdCount = 0;
  let totalFoodCost = 0;
  let totalBarCost = 0;
  let totalUnknownCost = 0;

  entries.forEach((entry, index) => {
    const nextId = `${Date.now()}-${index}-${Math.random().toString(16).slice(2, 8)}`;
    const location = entry.location?.trim() || nextLocations[0] || 'Stock';
    if (!nextLocations.includes(location)) {
      nextLocations = [...nextLocations, location];
    }

    const recordedAt = entry.recordedAt ?? new Date().toISOString();
    const quantity =
      typeof entry.quantity === 'number' && Number.isFinite(entry.quantity)
        ? Math.max(1, Math.round(entry.quantity))
        : 1;
    const unitPrice =
      typeof entry.unitPrice === 'number' && Number.isFinite(entry.unitPrice) ? Math.max(0, entry.unitPrice) : 0;
    const totalAmount = quantity * unitPrice;
    const barcode = entry.barcode?.trim() || null;
    const normalizedName = entry.itemName.trim().toLowerCase().replace(/\s+/g, ' ');
    const normalizedCategory = entry.category.trim().toLowerCase().replace(/\s+/g, ' ');
    const matchedIndex = nextItems.findIndex((item) => {
      if (item.location !== location) return false;
      if (entry.itemId && item.id === entry.itemId) return true;
      if (barcode && item.barcode?.trim() === barcode) return true;
      return (
        item.name.trim().toLowerCase().replace(/\s+/g, ' ') === normalizedName &&
        item.category.trim().toLowerCase().replace(/\s+/g, ' ') === normalizedCategory
      );
    });

    let itemId: string;
    if (matchedIndex >= 0) {
      const matchedItem = nextItems[matchedIndex];
      const nextQuantity = matchedItem.quantity + quantity;
      const nextStockValue = matchedItem.stockValue + totalAmount;
      const nextUnitPrice = nextStockValue > 0 && nextQuantity > 0 ? nextStockValue / nextQuantity : null;
      itemId = matchedItem.id;
      matchedCount += 1;
      nextItems[matchedIndex] = normalizeInventoryItem(
        {
          ...matchedItem,
          quantity: nextQuantity,
          unitPrice: nextUnitPrice,
          priceMissing: matchedItem.priceMissing || unitPrice <= 0,
          barcode: barcode ?? matchedItem.barcode,
          source: entry.source ?? matchedItem.source,
          capturedAt: recordedAt,
          notes: matchedItem.notes?.trim()
            ? `${matchedItem.notes.trim()} | Inkoop toegevoegd via kassabon`
            : 'Inkoop toegevoegd via kassabon',
        },
        nextLocations
      );
    } else {
      itemId = nextId;
      createdCount += 1;
      nextItems = [
        normalizeInventoryItem(
          {
            id: itemId,
            name: entry.itemName,
            category: entry.category,
            location,
            quantity,
            expiryDays: null,
            expiryDate: null,
            expiryStatus: 'Unknown',
            recommendedAction: 'Controleer voorraad',
            recommendedReason: 'Inkoop toegevoegd via kassabon.',
            confidence: null,
            notes: 'Inkoop toegevoegd via kassabon',
            barcode,
            photoUri: null,
            unitPrice: unitPrice > 0 ? unitPrice : null,
            priceMissing: unitPrice <= 0,
            source: entry.source ?? 'receipt-purchase',
            capturedAt: recordedAt,
          },
          nextLocations
        ),
        ...nextItems,
      ];
    }

    if (entry.costBucket === 'food_cost') {
      totalFoodCost += totalAmount;
    } else if (entry.costBucket === 'bar_cost') {
      totalBarCost += totalAmount;
    } else {
      totalUnknownCost += totalAmount;
    }

    if (entry.costBucket === 'food_cost' || entry.costBucket === 'bar_cost') {
      nextFinanceEntries.push(
        normalizeFinanceEntry(
          {
            id: `${nextId}-${entry.costBucket}`,
            kind: entry.costBucket,
            amount: totalAmount,
            period: 'day',
            note: `Inkoop kassabon ${entry.itemName}`,
            recordedAt,
            location,
          },
          nextLocations
        )
      );
    }

    nextMovements.push(
      normalizeMovement(
        {
          id: `${nextId}-receive`,
          type: 'receive',
          itemId,
          itemName: entry.itemName,
          category: entry.category,
          actionLabel: 'Inkoop',
          quantity,
          fromLocation: null,
          toLocation: location,
          unitCost: unitPrice,
          note: 'Inkoop / stock intake via kassabon',
          recordedAt,
          source: entry.source ?? 'receipt-purchase',
        },
        nextLocations
      )
    );
  });

  setState({
    ...state,
    items: nextItems,
    locations: nextLocations,
    financeEntries: [...nextFinanceEntries.reverse(), ...state.financeEntries],
    movements: [...nextMovements.reverse(), ...state.movements],
    lastSavedAt: new Date().toISOString(),
  });

  if (totalFoodCost > 0) {
    notifyFinance('food_cost');
  }
  if (totalBarCost > 0) {
    notifyFinance('bar_cost');
  }

  return {
    ok: true as const,
    count: entries.length,
    matchedCount,
    createdCount,
    totalFoodCost,
    totalBarCost,
    totalUnknownCost,
  };
}

export function removeFinanceEntry(id: string) {
  setState({
    ...state,
    financeEntries: state.financeEntries.filter((entry) => entry.id !== id),
    lastSavedAt: new Date().toISOString(),
  });
}

export function updateInventoryQuantity(id: string, delta: number) {
  const item = state.items.find((candidate) => candidate.id === id) ?? null;
  const normalizedDelta = typeof delta === 'number' && Number.isFinite(delta) ? Math.round(delta) : 0;
  const recordedAt = new Date().toISOString();

  const movement =
    item && normalizedDelta !== 0
      ? normalizeMovement(
          {
            id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}-adjust`,
            type: 'adjust',
            itemId: item.id,
            itemName: item.name,
            category: item.category,
            quantity: Math.abs(normalizedDelta),
            fromLocation: item.location,
            toLocation: item.location,
            unitCost: null,
            note: normalizedDelta > 0 ? `Handmatig +${normalizedDelta}` : `Handmatig ${normalizedDelta}`,
            recordedAt,
            source: 'manual',
          },
          state.locations
        )
      : null;

  setState({
    ...state,
    items: state.items.map((item) =>
      item.id === id
        ? {
            ...item,
            quantity: Math.max(1, item.quantity + delta),
          }
        : item
    ),
    movements: movement ? [movement, ...state.movements] : state.movements,
    lastSavedAt: new Date().toISOString(),
  });
}

export function updateInventoryLocation(id: string, location: string) {
  const nextLocation = state.locations.includes(location) ? location : state.locations[0] || 'Hoofdvestiging';
  const item = state.items.find((candidate) => candidate.id === id) ?? null;
  const recordedAt = new Date().toISOString();
  const movement =
    item && item.location !== nextLocation
      ? normalizeMovement(
          {
            id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}-transfer`,
            type: 'transfer',
            itemId: item.id,
            itemName: item.name,
            category: item.category,
            quantity: item.quantity,
            fromLocation: item.location,
            toLocation: nextLocation,
            unitCost: null,
            note: 'Locatie aangepast',
            recordedAt,
            source: 'manual',
          },
          state.locations
        )
      : null;

  setState({
    ...state,
    items: state.items.map((item) => (item.id === id ? { ...item, location: nextLocation } : item)),
    movements: movement ? [movement, ...state.movements] : state.movements,
    lastSavedAt: new Date().toISOString(),
  });
}

export function updateInventoryItemCorrection(input: {
  itemId: string;
  name: string;
  category: string;
  location: string;
  quantity: number;
  note: string;
  source?: string;
}) {
  const item = state.items.find((candidate) => candidate.id === input.itemId) ?? null;
  if (!item) {
    return { ok: false as const, reason: 'missing_item' as const };
  }

  const nextName = input.name.trim();
  const nextCategory = input.category.trim();
  const nextLocation = input.location.trim();
  const nextQuantity = Math.max(1, Math.round(input.quantity));

  if (!nextName || !nextCategory || !nextLocation) {
    return { ok: false as const, reason: 'missing_fields' as const };
  }

  const nextLocations = state.locations.includes(nextLocation) ? state.locations : [...state.locations, nextLocation];
  const recordedAt = new Date().toISOString();
  const correctionNote = input.note.trim() || 'Menselijke correctie bevestigd';
  const correctedItem = normalizeInventoryItem(
    {
      ...item,
      name: nextName,
      category: nextCategory,
      location: nextLocation,
      quantity: nextQuantity,
      notes: item.notes.trim() ? `${item.notes.trim()} | ${correctionNote}` : correctionNote,
      source: input.source ?? 'human-correction',
      capturedAt: recordedAt,
    },
    nextLocations
  );
  const movement = normalizeMovement(
    {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}-correction`,
      type: 'adjust',
      itemId: item.id,
      itemName: correctedItem.name,
      category: correctedItem.category,
      quantity: correctedItem.quantity,
      fromLocation: item.location,
      toLocation: correctedItem.location,
      unitCost: null,
      note: correctionNote,
      recordedAt,
      source: input.source ?? 'human-correction',
    },
    nextLocations
  );

  setState({
    ...state,
    items: state.items.map((candidate) => (candidate.id === item.id ? correctedItem : candidate)),
    locations: nextLocations,
    movements: [movement, ...state.movements],
    lastSavedAt: recordedAt,
  });

  return {
    ok: true as const,
    previous: item,
    item: correctedItem,
    movement,
  };
}

export function addInventoryLocation(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, reason: 'empty' as const };
  }

  const exists = state.locations.some((location) => location.toLowerCase() === trimmed.toLowerCase());
  if (exists) {
    return { ok: false, reason: 'duplicate' as const };
  }

  setState({
    ...state,
    locations: [...state.locations, trimmed],
    lastSavedAt: new Date().toISOString(),
  });

  return { ok: true as const };
}

export function renameInventoryLocation(currentName: string, nextName: string) {
  const trimmed = nextName.trim();
  if (!trimmed) {
    return { ok: false, reason: 'empty' as const };
  }

  const duplicate = state.locations.some(
    (location) => location !== currentName && location.toLowerCase() === trimmed.toLowerCase()
  );
  if (duplicate) {
    return { ok: false, reason: 'duplicate' as const };
  }

  setState({
    ...state,
    items: state.items.map((item) =>
      item.location === currentName ? { ...item, location: trimmed } : item
    ),
    locations: state.locations.map((location) => (location === currentName ? trimmed : location)),
    lastSavedAt: new Date().toISOString(),
  });

  return { ok: true as const };
}

export function removeInventoryLocation(name: string) {
  if (state.locations.length <= 1) {
    return { ok: false, reason: 'last-location' as const };
  }

  const remainingLocations = state.locations.filter((location) => location !== name);
  const fallbackLocation = remainingLocations[0] ?? 'Hoofdvestiging';

  setState({
    ...state,
    items: state.items.map((item) =>
      item.location === name ? { ...item, location: fallbackLocation } : item
    ),
    locations: remainingLocations,
    lastSavedAt: new Date().toISOString(),
  });

  return { ok: true as const, fallbackLocation };
}

export function removeInventoryItem(id: string) {
  setState({
    ...state,
    items: state.items.filter((item) => item.id !== id),
    lastSavedAt: new Date().toISOString(),
  });
}

export function clearInventory() {
  setState({
    ...state,
    items: [],
    lastSavedAt: new Date().toISOString(),
  });
}

export function transferStock(options: {
  itemId: string;
  toLocation: string;
  quantity?: number;
  note?: string;
  recordedAt?: string;
  source?: string;
}) {
  const item = state.items.find((candidate) => candidate.id === options.itemId);
  if (!item) return { ok: false as const, reason: 'not-found' as const };

  const fromLocation = item.location;
  const requestedToLocation = options.toLocation.trim() || state.locations[0] || 'Hoofdvestiging';
  const toLocation = requestedToLocation;
  const nextLocations = state.locations.includes(toLocation) ? state.locations : [...state.locations, toLocation];
  if (toLocation === fromLocation) return { ok: false as const, reason: 'same-location' as const };

  const requestedQty =
    typeof options.quantity === 'number' && Number.isFinite(options.quantity) ? Math.max(1, Math.round(options.quantity)) : item.quantity;
  const movedQuantity = Math.min(item.quantity, requestedQty);
  const remainingQuantity = Math.max(item.quantity - movedQuantity, 0);
  const recordedAt = options.recordedAt ?? new Date().toISOString();
  const expiryDate = item.expiryDate ?? createExpiryDateFromDays(item.capturedAt, item.expiryDays);
  const expiryContext = getExpiryActionContext({
    category: item.category,
    expiryDate,
    referenceAt: recordedAt,
  });

  const splitId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  const movedItem = {
    ...item,
    location: toLocation,
    quantity: movedQuantity,
    capturedAt: recordedAt,
    source: options.source ?? 'transfer',
    expiryDate,
  };

  const remainderItem =
    remainingQuantity > 0
      ? {
          ...item,
          id: `${item.id}-rest-${splitId}`,
          quantity: remainingQuantity,
          capturedAt: recordedAt,
          source: options.source ?? 'transfer',
          expiryDate,
        }
      : null;

  const movement = normalizeMovement(
    {
      id: `${splitId}-transfer`,
      type: 'transfer',
      itemId: item.id,
      itemName: item.name,
      category: item.category,
      quantity: movedQuantity,
      fromLocation,
      toLocation,
      unitCost: null,
      note: options.note ?? 'Transfer',
      recordedAt,
      source: options.source ?? 'manual',
      expiryDate,
      expiryStatus: expiryContext.expiryStatus,
      recommendedAction: expiryContext.recommendedAction,
      recommendedReason: expiryContext.recommendedReason,
    },
    nextLocations
  );

  setState({
    ...state,
    items: [
      normalizeInventoryItem(movedItem, nextLocations),
      ...(remainderItem ? [normalizeInventoryItem(remainderItem, nextLocations)] : []),
      ...state.items.filter((candidate) => candidate.id !== item.id),
    ],
    locations: nextLocations,
    movements: [movement, ...state.movements],
    lastSavedAt: new Date().toISOString(),
  });

  notifyTrace();

  return { ok: true as const, movedQuantity, remainingQuantity };
}

function createDispatchAuditEvent(
  kind: DispatchAuditEventKind,
  label: string,
  detail: string,
  createdAt?: string
): DispatchAuditEvent {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    kind,
    label,
    detail,
    createdAt: createdAt ?? new Date().toISOString(),
  };
}

function updateDispatchRecord(
  dispatchId: string,
  updater: (record: DispatchRecord, recordedAt: string) => DispatchRecord
) {
  const recordedAt = new Date().toISOString();
  let found = false;
  let updatedRecord: DispatchRecord | null = null;

  const nextDispatches = state.dispatches.map((record) => {
    if (record.id !== dispatchId && record.dispatchId !== dispatchId) {
      return record;
    }

    found = true;
    const nextRecord = updater(record, recordedAt);
    updatedRecord = nextRecord;
    return nextRecord;
  });

  if (!found || !updatedRecord) {
    return { ok: false as const, reason: 'not-found' as const };
  }

  setState({
    ...state,
    dispatches: sortDispatchRecords(nextDispatches),
    lastSavedAt: new Date().toISOString(),
  });

  return { ok: true as const, dispatch: updatedRecord };
}

export function createDispatchRecord(options: DispatchDraft & { sourceMovementId?: string | null }) {
  const createdAt = options.createdAt ?? new Date().toISOString();
  const nextId = `dispatch-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const dispatch = normalizeDispatchRecord(
    {
      id: nextId,
      dispatchId: nextId,
      product: options.product,
      category: options.category,
      quantity: options.quantity,
      fromLocation: options.fromLocation,
      destination: options.destination,
      customerName: options.customerName ?? 'Klant',
      customerConfirmedAt: null,
      customerReceiptStatus: 'pending',
      invoiceStatus: 'pending',
      invoiceReleasedAt: null,
      invoiceReference: null,
      goodsClosedAt: null,
      finalAuditStatus: 'open',
      driverName: options.driverName ?? 'Chauffeur',
      managerName: options.managerName ?? 'Manager',
      floorConfirmedAt: null,
      driverConfirmedAt: null,
      managerConfirmedAt: null,
      departureConfirmedAt: null,
      photoUri: options.photoUri ?? null,
      photoPlaceholder: options.photoPlaceholder ?? null,
      status: 'picked_from_stock',
      auditEvents: [
        createDispatchAuditEvent(
          'created',
          'Uit Stock gehaald',
          `${options.product} is verplaatst van ${options.fromLocation} naar ${options.destination}.`,
          createdAt
        ),
      ],
      receiptAuditEvents: [],
      createdAt,
      updatedAt: createdAt,
      sourceMovementId: options.sourceMovementId ?? null,
    },
    state.locations
  );

  setState({
    ...state,
    dispatches: sortDispatchRecords([dispatch, ...state.dispatches]),
    lastSavedAt: new Date().toISOString(),
  });

  return { ok: true as const, dispatch };
}

export function confirmDispatchWorkfloor(dispatchId: string) {
  return updateDispatchRecord(dispatchId, (record, recordedAt) => {
    if (record.floorConfirmedAt) {
      return record;
    }

    const auditEvents = [
      ...record.auditEvents,
      createDispatchAuditEvent('floor_confirmed', 'Klaar voor vertrek', 'Werkvloer bevestigt klaar voor vertrek.', recordedAt),
    ];

    return normalizeDispatchRecord(
      {
        ...record,
        floorConfirmedAt: recordedAt,
        status: 'ready_for_departure',
        auditEvents,
        updatedAt: recordedAt,
      },
      state.locations
    );
  });
}

export function addDispatchPhotoProof(dispatchId: string, options?: { photoUri?: string | null; photoPlaceholder?: string | null }) {
  return updateDispatchRecord(dispatchId, (record, recordedAt) => {
    if (!record.floorConfirmedAt || record.photoUri || record.photoPlaceholder) {
      return record;
    }

    const hasRealPhoto = typeof options?.photoUri === 'string' && options.photoUri.trim().length > 0;
    const auditEvents = [
      ...record.auditEvents,
      createDispatchAuditEvent(
        'photo_added',
        'Foto goederen toegevoegd',
        hasRealPhoto ? 'Echte foto gekoppeld aan de dispatch.' : 'Foto bewijs toegevoegd als placeholder.',
        recordedAt
      ),
    ];

    return normalizeDispatchRecord(
      {
        ...record,
        photoUri: hasRealPhoto ? options?.photoUri?.trim() ?? null : null,
        photoPlaceholder: hasRealPhoto ? null : options?.photoPlaceholder?.trim() ?? 'Foto bewijs toegevoegd',
        status: 'photo_proof_added',
        auditEvents,
        updatedAt: recordedAt,
      },
      state.locations
    );
  });
}

export function confirmDispatchDriver(dispatchId: string, options?: { driverName?: string }) {
  return updateDispatchRecord(dispatchId, (record, recordedAt) => {
    if (!record.floorConfirmedAt || !(record.photoUri || record.photoPlaceholder) || record.driverConfirmedAt) {
      return record;
    }

    const driverName = typeof options?.driverName === 'string' && options.driverName.trim() ? options.driverName.trim() : record.driverName;
    const auditEvents = [
      ...record.auditEvents,
      createDispatchAuditEvent('driver_confirmed', 'Chauffeur bevestigd', `${driverName} bevestigt ontvangst.`, recordedAt),
    ];

    return normalizeDispatchRecord(
      {
        ...record,
        driverName,
        driverConfirmedAt: recordedAt,
        status: 'driver_confirmed',
        auditEvents,
        updatedAt: recordedAt,
      },
      state.locations
    );
  });
}

export function confirmDispatchManager(dispatchId: string, options?: { managerName?: string }) {
  return updateDispatchRecord(dispatchId, (record, recordedAt) => {
    if (!record.floorConfirmedAt || !(record.photoUri || record.photoPlaceholder) || record.managerConfirmedAt) {
      return record;
    }

    const managerName =
      typeof options?.managerName === 'string' && options.managerName.trim() ? options.managerName.trim() : record.managerName;
    const auditEvents = [
      ...record.auditEvents,
      createDispatchAuditEvent('manager_confirmed', 'Manager bevestigd', `${managerName} bevestigt goederen.`, recordedAt),
    ];

    return normalizeDispatchRecord(
      {
        ...record,
        managerName,
        managerConfirmedAt: recordedAt,
        status: 'manager_confirmed',
        auditEvents,
        updatedAt: recordedAt,
      },
      state.locations
    );
  });
}

export function confirmDispatchDeparture(dispatchId: string) {
  return updateDispatchRecord(dispatchId, (record, recordedAt) => {
    if (!record.driverConfirmedAt || !record.managerConfirmedAt || record.departureConfirmedAt) {
      return record;
    }

    const auditEvents = [
      ...record.auditEvents,
      createDispatchAuditEvent(
        'departure_confirmed',
        'Vertrek bevestigd',
        `${record.product} (${record.quantity}) is vertrokken richting ${record.destination}.`,
        recordedAt
      ),
      createDispatchAuditEvent(
        'customer_receiving',
        'Klant ontvangt goederen',
        `${record.customerName} ontvangt ${record.quantity} ${record.product}.`,
        recordedAt
      ),
    ];

    const receiptAuditEvents = [
      ...record.receiptAuditEvents,
      createDispatchAuditEvent(
        'departure_confirmed',
        'Vertrek bevestigd',
        `${record.product} (${record.quantity}) is onderweg naar ${record.customerName}.`,
        recordedAt
      ),
      createDispatchAuditEvent(
        'customer_receiving',
        'Klant ontvangt goederen',
        `${record.customerName} ontvangt ${record.quantity} ${record.product}.`,
        recordedAt
      ),
    ];

    return normalizeDispatchRecord(
      {
        ...record,
        departureConfirmedAt: recordedAt,
        customerReceiptStatus: 'awaiting_customer',
        status: 'customer_receiving',
        auditEvents,
        receiptAuditEvents,
        updatedAt: recordedAt,
      },
      state.locations
    );
  });
}

export function confirmDispatchCustomerReceipt(dispatchId: string, options?: { customerName?: string }) {
  return updateDispatchRecord(dispatchId, (record, recordedAt) => {
    if (!record.departureConfirmedAt || record.customerConfirmedAt) {
      return record;
    }

    const customerName =
      typeof options?.customerName === 'string' && options.customerName.trim() ? options.customerName.trim() : record.customerName;
    const auditEvents = [
      ...record.auditEvents,
      createDispatchAuditEvent(
        'customer_confirmed',
        'Klant bevestigt ontvangst',
        `${customerName} bevestigt ontvangst van ${record.quantity} ${record.product}.`,
        recordedAt
      ),
    ];
    const receiptAuditEvents = [
      ...record.receiptAuditEvents,
      createDispatchAuditEvent(
        'customer_confirmed',
        'Klant bevestigt ontvangst',
        `${customerName} bevestigt ontvangst van ${record.quantity} ${record.product}.`,
        recordedAt
      ),
    ];

    return normalizeDispatchRecord(
      {
        ...record,
        customerName,
        customerConfirmedAt: recordedAt,
        customerReceiptStatus: 'received',
        status: 'customer_confirmed',
        auditEvents,
        receiptAuditEvents,
        updatedAt: recordedAt,
      },
      state.locations
    );
  });
}

function createInvoiceReference(dispatch: DispatchRecord) {
  return `INV-${dispatch.dispatchId.replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase() || '00000000'}`;
}

export function releaseDispatchInvoice(dispatchId: string) {
  return updateDispatchRecord(dispatchId, (record, recordedAt) => {
    if (!record.customerConfirmedAt || record.invoiceStatus !== 'pending') {
      return record;
    }

    const invoiceReference = record.invoiceReference ?? createInvoiceReference(record);
    const auditEvents = [
      ...record.auditEvents,
      createDispatchAuditEvent(
        'invoice_released',
        'Facturatie vrijgegeven',
        `Facturatie vrijgegeven voor ${record.product} (${record.quantity}). Referentie ${invoiceReference}.`,
        recordedAt
      ),
    ];
    const receiptAuditEvents = [
      ...record.receiptAuditEvents,
      createDispatchAuditEvent(
        'invoice_released',
        'Facturatie vrijgegeven',
        `Facturatie vrijgegeven voor ${record.product} (${record.quantity}).`,
        recordedAt
      ),
    ];

    return normalizeDispatchRecord(
      {
        ...record,
        invoiceStatus: 'released',
        invoiceReleasedAt: recordedAt,
        invoiceReference,
        status: 'invoice_released',
        auditEvents,
        receiptAuditEvents,
        updatedAt: recordedAt,
      },
      state.locations
    );
  });
}

export function prepareDispatchInvoice(dispatchId: string) {
  return updateDispatchRecord(dispatchId, (record, recordedAt) => {
    if (!record.invoiceReleasedAt || record.invoiceStatus !== 'released') {
      return record;
    }

    const invoiceReference = record.invoiceReference ?? createInvoiceReference(record);
    const auditEvents = [
      ...record.auditEvents,
      createDispatchAuditEvent(
        'invoice_ready',
        'Factuur klaarzetten',
        `Factuur ${invoiceReference} staat klaar voor verwerking.`,
        recordedAt
      ),
    ];
    const receiptAuditEvents = [
      ...record.receiptAuditEvents,
      createDispatchAuditEvent(
        'invoice_ready',
        'Factuur klaarzetten',
        `Factuur ${invoiceReference} staat klaar voor verwerking.`,
        recordedAt
      ),
    ];

    return normalizeDispatchRecord(
      {
        ...record,
        invoiceStatus: 'ready',
        invoiceReference,
        status: 'invoice_ready',
        auditEvents,
        receiptAuditEvents,
        updatedAt: recordedAt,
      },
      state.locations
    );
  });
}

export function offbookDispatchGoods(dispatchId: string) {
  return updateDispatchRecord(dispatchId, (record, recordedAt) => {
    if (record.invoiceStatus !== 'ready' || record.goodsClosedAt) {
      return record;
    }

    const invoiceReference = record.invoiceReference ?? createInvoiceReference(record);
    const auditEvents = [
      ...record.auditEvents,
      createDispatchAuditEvent(
        'goods_closed',
        'Goederen afboeken',
        `Goederen administratief afgeboekt voor ${record.product} (${record.quantity}).`,
        recordedAt
      ),
    ];
    const receiptAuditEvents = [
      ...record.receiptAuditEvents,
      createDispatchAuditEvent(
        'goods_closed',
        'Goederen afboeken',
        `Goederen administratief afgeboekt voor ${record.product} (${record.quantity}).`,
        recordedAt
      ),
    ];

    return normalizeDispatchRecord(
      {
        ...record,
        invoiceReference,
        goodsClosedAt: recordedAt,
        status: 'goods_closed',
        auditEvents,
        receiptAuditEvents,
        updatedAt: recordedAt,
      },
      state.locations
    );
  });
}

export function closeDispatchDossier(dispatchId: string) {
  return updateDispatchRecord(dispatchId, (record, recordedAt) => {
    if (!record.goodsClosedAt || record.finalAuditStatus === 'complete') {
      return record;
    }

    const invoiceReference = record.invoiceReference ?? createInvoiceReference(record);
    const auditEvents = [
      ...record.auditEvents,
      createDispatchAuditEvent(
        'dossier_complete',
        'Dossier afsluiten',
        `Dossier afgerond voor ${record.product} (${record.quantity}).`,
        recordedAt
      ),
    ];
    const receiptAuditEvents = [
      ...record.receiptAuditEvents,
      createDispatchAuditEvent(
        'dossier_complete',
        'Dossier afsluiten',
        `Dossier afgerond voor ${record.product} (${record.quantity}).`,
        recordedAt
      ),
    ];

    return normalizeDispatchRecord(
      {
        ...record,
        invoiceReference,
        finalAuditStatus: 'complete',
        status: 'dossier_complete',
        auditEvents,
        receiptAuditEvents,
        updatedAt: recordedAt,
      },
      state.locations
    );
  });
}

export function consumeStock(options: {
  itemId: string;
  quantity?: number;
  note?: string;
  recordedAt?: string;
  source?: string;
}) {
  const item = state.items.find((candidate) => candidate.id === options.itemId);
  if (!item) return { ok: false as const, reason: 'not-found' as const };

  const quantity =
    typeof options.quantity === 'number' && Number.isFinite(options.quantity) ? Math.max(1, Math.round(options.quantity)) : 1;
  if (item.quantity < quantity) {
    return { ok: false as const, reason: 'insufficient-stock' as const, availableQuantity: item.quantity };
  }

  const usedQuantity = Math.min(item.quantity, quantity);
  const remainingQuantity = Math.max(item.quantity - usedQuantity, 0);
  const recordedAt = options.recordedAt ?? new Date().toISOString();
  const nextId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  const movement = normalizeMovement(
    {
      id: `${nextId}-consume`,
      type: 'consumption',
      itemId: item.id,
      itemName: item.name,
      category: item.category,
      quantity: usedQuantity,
      fromLocation: item.location,
      toLocation: null,
      unitCost: item.unitPrice,
      note: options.note ?? 'Verbruikt',
      recordedAt,
      source: options.source ?? 'manual',
    },
    state.locations
  );

  setState({
    ...state,
    items:
      remainingQuantity > 0
        ? state.items.map((candidate) =>
            candidate.id === item.id
              ? normalizeInventoryItem({ ...candidate, quantity: remainingQuantity }, state.locations)
              : candidate
          )
        : state.items.filter((candidate) => candidate.id !== item.id),
    movements: [movement, ...state.movements],
    lastSavedAt: new Date().toISOString(),
  });

  notifyTrace();

  return { ok: true as const, usedQuantity, remainingQuantity };
}

export function recordWaste(options: {
  itemId: string;
  quantity?: number;
  location?: string;
  unitCost?: number | null;
  note?: string;
  recordedAt?: string;
  source?: string;
}) {
  const item = state.items.find((candidate) => candidate.id === options.itemId);
  if (!item) {
    console.error('recordWaste blocked: item not found', { itemId: options.itemId });
    return { ok: false as const, reason: 'not-found' as const };
  }

  const expectedLocation = typeof options.location === 'string' ? options.location.trim() : '';
  if (expectedLocation && item.location !== expectedLocation) {
    console.error('recordWaste blocked: item location mismatch', {
      itemId: options.itemId,
      itemLocation: item.location,
      requestedLocation: expectedLocation,
    });
    return {
      ok: false as const,
      reason: 'location-mismatch' as const,
      itemLocation: item.location,
      requestedLocation: expectedLocation,
    };
  }

  const quantity =
    typeof options.quantity === 'number' && Number.isFinite(options.quantity) ? Math.max(1, Math.round(options.quantity)) : 1;
  if (item.quantity <= 0) {
    console.error('recordWaste blocked: no stock at location', {
      itemId: options.itemId,
      location: item.location,
      availableQuantity: item.quantity,
    });
    return { ok: false as const, reason: 'insufficient-stock' as const, availableQuantity: item.quantity };
  }
  if (item.quantity < quantity) {
    console.error('recordWaste blocked: insufficient stock at location', {
      itemId: options.itemId,
      location: item.location,
      requestedQuantity: quantity,
      availableQuantity: item.quantity,
    });
    return { ok: false as const, reason: 'insufficient-stock' as const, availableQuantity: item.quantity };
  }

  const wastedQuantity = Math.min(item.quantity, quantity);
  const remainingQuantity = Math.max(item.quantity - wastedQuantity, 0);
  const recordedAt = options.recordedAt ?? new Date().toISOString();
  const unitCost = options.unitCost ?? item.unitPrice ?? null;
  const wasteValue = unitCost === null ? 0 : wastedQuantity * unitCost;
  const nextId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  const movement = normalizeMovement(
    {
      id: `${nextId}-waste`,
      type: 'waste',
      itemId: item.id,
      itemName: item.name,
      category: item.category,
      quantity: wastedQuantity,
      fromLocation: item.location,
      toLocation: null,
      unitCost,
      note: options.note ?? 'Waste / afboeking',
      recordedAt,
      source: options.source ?? 'manual',
    },
    state.locations
  );

  const financeEntry = normalizeFinanceEntry(
    {
      id: `${nextId}-loss`,
      kind: 'loss',
      amount: wasteValue,
      period: 'day',
      note: `Waste ${item.name}${options.note ? ` · ${options.note}` : ''}`,
      recordedAt,
      location: item.location,
    },
    state.locations
  );

  setState({
    ...state,
    items:
      remainingQuantity > 0
        ? state.items.map((candidate) =>
            candidate.id === item.id
              ? normalizeInventoryItem({ ...candidate, quantity: remainingQuantity }, state.locations)
              : candidate
          )
        : state.items.filter((candidate) => candidate.id !== item.id),
    movements: [movement, ...state.movements],
    financeEntries: [financeEntry, ...state.financeEntries],
    lastSavedAt: new Date().toISOString(),
  });

  notifyFinance('loss');

  return { ok: true as const, wastedQuantity, remainingQuantity };
}

export function getItemTrace(itemId: string) {
  const item = state.items.find((candidate) => candidate.id === itemId) ?? null;
  const timeline = state.movements
    .filter((movement) => movement.itemId === itemId)
    .slice()
    .sort((left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime());

  const last = timeline[0] ?? null;
  const status =
    item
      ? ({ label: 'In stock', tone: '#0f766e' } as const)
      : last?.type === 'consumption'
        ? ({ label: 'Verbruikt', tone: '#1d4ed8' } as const)
        : last?.type === 'sale'
        ? ({ label: 'Verkocht / verbruikt', tone: '#1d4ed8' } as const)
        : last?.type === 'waste'
          ? ({ label: 'Afgeboekt (waste)', tone: '#dc2626' } as const)
          : last?.type === 'transfer'
            ? ({ label: 'Verplaatst', tone: '#b45309' } as const)
            : ({ label: 'Onbekend', tone: '#64748b' } as const);

  return {
    item,
    status,
    lastMovement: last,
    timeline,
  };
}

export function seedDemoDatabase() {
  return { ok: false as const, seeded: false as const, reason: 'demo_seed_removed' as const };
}

export function addLiveAlertEvent(event: {
  event: SoundEventId;
  title: string;
  detail: string;
  href: LiveAlertEvent['href'];
  location?: string | null;
  itemId?: string | null;
  createdAt?: string;
}) {
  const nextId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const createdAt = event.createdAt ?? new Date().toISOString();

  const normalized = normalizeLiveAlert(
    {
      id: nextId,
      event: event.event,
      title: event.title,
      detail: event.detail,
      href: event.href,
      location: event.location ?? null,
      itemId: event.itemId ?? null,
      createdAt,
    },
    state.locations
  );

  const last = state.liveAlerts[0] ?? null;
  if (last && last.event === normalized.event && last.title === normalized.title && last.location === normalized.location) {
    const delta = Math.abs(new Date(createdAt).getTime() - new Date(last.createdAt).getTime());
    if (delta < 15_000) {
      return { ok: true as const, skipped: true as const };
    }
  }

  setState({
    ...state,
    liveAlerts: [normalized, ...state.liveAlerts].slice(0, 60),
    lastSavedAt: new Date().toISOString(),
  });

  notifyLiveAlert(normalized.event);
  talkBack(`${normalized.title}. ${normalized.detail}`).catch(() => {});
  return { ok: true as const, skipped: false as const };
}

export function addTask(task: Partial<TaskItem> & Pick<TaskItem, 'title'>) {
  const newTask: TaskItem = {
    id: crypto.randomUUID(),
    title: task.title,
    detail: task.detail ?? '',
    location: task.location ?? null,
    dueAt: task.dueAt ?? null,
    status: 'open',
    createdAt: task.createdAt ?? new Date().toISOString(),
  };
  setState({
    ...state,
    tasks: [newTask, ...state.tasks].slice(0, 100),
    lastSavedAt: new Date().toISOString(),
  });
}

export function registerInventoryIntakeFollowUps(input: {
  itemId?: string | null;
  itemName: string;
  location: string;
  expiryDays: number | null;
  confidence: number | null;
  recallFlag?: boolean;
  mode: 'created' | 'merged';
  matchedBy?: 'barcode' | 'name' | null;
}) {
  const createdAt = new Date().toISOString();
  const baseDetail =
    input.mode === 'merged'
      ? `${input.itemName} is bijgewerkt in ${input.location}${input.matchedBy ? ` via ${input.matchedBy}` : ''}.`
      : `${input.itemName} is opgeslagen in ${input.location}.`;

  addLiveAlertEvent({
    event: 'trace',
    title: input.mode === 'merged' ? 'Track & trace bijgewerkt' : 'Nieuwe stockscan geregistreerd',
    detail: baseDetail,
    href: '/trace',
    location: input.location,
    itemId: input.itemId ?? null,
    createdAt,
  });

  const hasFreshOpenTask = (title: string) =>
    state.tasks.some((task) => {
      if (task.status !== 'open') return false;
      if (task.title !== title) return false;
      if ((task.location ?? null) !== input.location) return false;
      const delta = Math.abs(new Date(createdAt).getTime() - new Date(task.createdAt).getTime());
      return delta < 6 * 60 * 60 * 1000;
    });

  if (input.recallFlag) {
    addLiveAlertEvent({
      event: 'expiry',
      title: 'Recall / blokkering nodig',
      detail: `${input.itemName} is als recall-risico gemarkeerd. Blokkeer en controleer stock onmiddellijk.`,
      href: '/alerts',
      location: input.location,
      itemId: input.itemId ?? null,
      createdAt,
    });

    const title = `Recall opvolgen: ${input.itemName}`;
    if (!hasFreshOpenTask(title)) {
      addTask({
        title,
        detail: 'Controleer barcode, blokkeer gebruik en plan retour of afboeking.',
        location: input.location,
        dueAt: createdAt,
        createdAt,
      });
    }
  }

  if (typeof input.expiryDays === 'number' && Number.isFinite(input.expiryDays) && input.expiryDays <= 1) {
    addLiveAlertEvent({
      event: 'expiry',
      title: 'Korte houdbaarheid na scan',
      detail: `${input.itemName} heeft ${input.expiryDays <= 0 ? 'vandaag' : 'binnen 1 dag'} opvolging nodig.`,
      href: '/alerts',
      location: input.location,
      itemId: input.itemId ?? null,
      createdAt,
    });

    const title = `Verwerk vandaag: ${input.itemName}`;
    if (!hasFreshOpenTask(title)) {
      addTask({
        title,
        detail: 'Plan verwerking, transfer of afboeking om waste te voorkomen.',
        location: input.location,
        dueAt: createdAt,
        createdAt,
      });
    }
  }

  if (typeof input.confidence === 'number' && Number.isFinite(input.confidence) && input.confidence < 0.75) {
    addLiveAlertEvent({
      event: 'recognition',
      title: 'AI scancontrole nodig',
      detail: `${input.itemName} werd opgeslagen met ${Math.round(input.confidence * 100)}% zekerheid.`,
      href: '/alerts',
      location: input.location,
      itemId: input.itemId ?? null,
      createdAt,
    });

    const title = `Controleer AI scan: ${input.itemName}`;
    if (!hasFreshOpenTask(title)) {
      addTask({
        title,
        detail: 'Controleer naam, categorie, barcode en houdbaarheid van deze scan.',
        location: input.location,
        dueAt: createdAt,
        createdAt,
      });
    }
  }
}

export function completeTask(id: string) {
  setState({
    ...state,
    tasks: state.tasks.map((task) => (task.id === id ? { ...task, status: 'done' } : task)),
    lastSavedAt: new Date().toISOString(),
  });
}

export function flagRecallByBarcode(barcode: string) {
  const updated = state.items.map((item) =>
    item.barcode === barcode ? { ...item, recallFlag: true } : item
  );
  if (updated === state.items) return;
  setState({ ...state, items: updated, lastSavedAt: new Date().toISOString() });
  addLiveAlertEvent({
    event: 'expiry',
    title: `Recall voor barcode ${barcode}`,
    detail: 'Markeer items en plan retour/afboeking.',
    href: '/alerts',
  });
}

export function createPurchaseOrder(draft: { location?: string | null; lines: PurchaseOrderLine[] }) {
  const po: PurchaseOrder = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: 'draft',
    location: draft.location ?? null,
    lines: draft.lines.map((line) => ({
      ...line,
      id: line.id ?? crypto.randomUUID(),
      quantity: Math.max(1, line.quantity),
      unitCost: typeof line.unitCost === 'number' ? line.unitCost : null,
      supplierId: typeof line.supplierId === 'string' ? line.supplierId : null,
    })),
  };
  setState({
    ...state,
    purchaseOrders: [po, ...state.purchaseOrders].slice(0, 50),
    lastSavedAt: new Date().toISOString(),
  });
  return po;
}

export function clearLiveAlerts() {
  setState({
    ...state,
    liveAlerts: [],
    lastSavedAt: new Date().toISOString(),
  });
}

export function getInventoryMetrics(items: InventoryItem[]) {
  const totalProducts = items.length;
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalStockValue = items.reduce((sum, item) => sum + item.stockValue, 0);
  const priceMissingCount = items.filter((item) => item.priceMissing).length;
  const expiringSoon = items.filter((item) => item.expiryDays !== null && item.expiryDays <= 2).length;
  const scannedToday = items.filter((item) => {
    const created = new Date(item.capturedAt);
    const today = new Date();

    return (
      created.getFullYear() === today.getFullYear() &&
      created.getMonth() === today.getMonth() &&
      created.getDate() === today.getDate()
    );
  }).length;
  const averageConfidence =
    items.length > 0
      ? items.reduce((sum, item) => sum + (item.confidence ?? 0), 0) / items.length
      : 0;

  return {
    totalProducts,
    totalUnits,
    totalStockValue,
    priceMissingCount,
    expiringSoon,
    scannedToday,
    averageConfidence,
    latestItem: items[0] ?? null,
  };
}

export function getSalesOverviewByMonth(entries: SaleEntry[], year: number) {
  const monthly = Array.from({ length: 12 }, (_, month) => ({
    month,
    quantity: 0,
    revenue: 0,
  }));

  entries.forEach((entry) => {
    const soldAt = new Date(entry.soldAt);
    if (Number.isNaN(soldAt.getTime()) || soldAt.getFullYear() !== year) {
      return;
    }

    const bucket = monthly[soldAt.getMonth()];
    if (!bucket) {
      return;
    }

    bucket.quantity += entry.quantity;
    bucket.revenue += entry.totalAmount;
  });

  return monthly;
}

export function getFinanceOverviewByMonth(entries: FinanceEntry[], year: number) {
  const monthly = Array.from({ length: 12 }, (_, month) => ({
    month,
    revenue: 0,
    foodCost: 0,
    barCost: 0,
    loss: 0,
  }));

  entries.forEach((entry) => {
    const recordedAt = new Date(entry.recordedAt);
    if (Number.isNaN(recordedAt.getTime()) || recordedAt.getFullYear() !== year) {
      return;
    }

    const bucket = monthly[recordedAt.getMonth()];
    if (!bucket) {
      return;
    }

    if (entry.kind === 'revenue') {
      bucket.revenue += entry.amount;
      return;
    }

    if (entry.kind === 'food_cost') {
      bucket.foodCost += entry.amount;
      return;
    }

    if (entry.kind === 'bar_cost') {
      bucket.barCost += entry.amount;
      return;
    }

    bucket.loss += entry.amount;
  });

  return monthly;
}

export function getCategoryBreakdown(items: InventoryItem[]) {
  const grouped = new Map<string, number>();

  items.forEach((item) => {
    grouped.set(item.category, (grouped.get(item.category) ?? 0) + item.quantity);
  });

  return [...grouped.entries()]
    .map(([category, quantity]) => ({ category, quantity }))
    .sort((left, right) => right.quantity - left.quantity);
}

export function getInventoryUnitLabel(item: Pick<InventoryItem, 'name' | 'category' | 'unitLabel'>) {
  if (item.unitLabel?.trim()) {
    return item.unitLabel.trim();
  }

  const normalized = `${item.name} ${item.category}`.toLowerCase();
  if (
    normalized.includes('cola') ||
    normalized.includes('water') ||
    normalized.includes('bier') ||
    normalized.includes('beer') ||
    normalized.includes('wijn') ||
    normalized.includes('wine') ||
    normalized.includes('cava') ||
    normalized.includes('fles') ||
    normalized.includes('bottle')
  ) {
    return 'fles';
  }
  if (normalized.includes('doos') || normalized.includes('box') || normalized.includes('krat')) {
    return 'doos';
  }
  if (normalized.includes('kg') || normalized.includes('kilo')) {
    return 'kg';
  }
  if (normalized.includes('liter') || normalized.includes('litre') || normalized.includes('l ')) {
    return 'liter';
  }
  return 'stuk';
}

export function getInventoryLowStockThreshold(item: Pick<InventoryItem, 'lowStockThreshold'>) {
  return typeof item.lowStockThreshold === 'number' && Number.isFinite(item.lowStockThreshold) && item.lowStockThreshold > 1
    ? Math.round(item.lowStockThreshold)
    : 2;
}

export function getLowStockAlertsByLocation(
  items: InventoryItem[],
  locations: string[] = ['Bar', 'Keuken', 'Frigo', 'Diepvries', 'Koelcel', 'Stock']
) {
  const allowedLocations = new Set(locations);

  return items
    .filter((item) => allowedLocations.has(item.location))
    .map((item) => {
      const quantity = Math.max(0, Math.round(item.quantity));
      const threshold = getInventoryLowStockThreshold(item);
      if (quantity <= 0 || quantity > threshold) {
        return null;
      }

      const unit = getInventoryUnitLabel(item);
      const status = quantity <= 1 ? 'last' : 'low';
      const message =
        status === 'last'
          ? `Aandacht: laatste ${unit} ${item.name} in ${item.location}`
          : `Aandacht: ${item.name} is bijna op in ${item.location} (${quantity} ${unit})`;

      return {
        itemId: item.id,
        productName: item.name,
        quantity,
        unit,
        location: item.location,
        threshold,
        status,
        message,
      };
    })
    .filter((alert): alert is NonNullable<typeof alert> => Boolean(alert))
    .sort((left, right) => {
      if (left.quantity !== right.quantity) return left.quantity - right.quantity;
      return left.location.localeCompare(right.location);
    });
}

export function getLocationBreakdown(items: InventoryItem[], locations?: string[]) {
  const grouped = new Map<string, { quantity: number; stockValue: number; priceMissingCount: number }>();

  (locations ?? []).forEach((location) => grouped.set(location, { quantity: 0, stockValue: 0, priceMissingCount: 0 }));

  items.forEach((item) => {
    const current = grouped.get(item.location) ?? { quantity: 0, stockValue: 0, priceMissingCount: 0 };
    grouped.set(item.location, {
      quantity: current.quantity + item.quantity,
      stockValue: current.stockValue + item.stockValue,
      priceMissingCount: current.priceMissingCount + (item.priceMissing ? 1 : 0),
    });
  });

  return [...grouped.entries()]
    .map(([location, totals]) => ({ location, ...totals }))
    .sort((left, right) => right.quantity - left.quantity);
}

export function getMovementValueBreakdown(movements: StockMovement[], locations?: string[]) {
  const grouped = new Map<string, { consumptionValue: number; wasteValue: number }>();

  (locations ?? []).forEach((location) => grouped.set(location, { consumptionValue: 0, wasteValue: 0 }));

  let totalConsumptionValue = 0;
  let totalWasteValue = 0;

  movements.forEach((movement) => {
    if (movement.type !== 'consumption' && movement.type !== 'waste') {
      return;
    }

    const location = movement.fromLocation ?? movement.toLocation ?? null;
    if (!location) {
      return;
    }

    const value = movement.unitCost === null ? 0 : movement.quantity * movement.unitCost;
    const current = grouped.get(location) ?? { consumptionValue: 0, wasteValue: 0 };

    if (movement.type === 'consumption') {
      totalConsumptionValue += value;
      grouped.set(location, { ...current, consumptionValue: current.consumptionValue + value });
      return;
    }

    totalWasteValue += value;
    grouped.set(location, { ...current, wasteValue: current.wasteValue + value });
  });

  return {
    totalConsumptionValue,
    totalWasteValue,
    byLocation: [...grouped.entries()]
      .map(([location, totals]) => ({ location, ...totals }))
      .sort((left, right) => left.location.localeCompare(right.location)),
  };
}

export type FinanciënEntry = FinanceEntry;
export type FinanciënEntryKind = FinanceEntryKind;
export type FinanciënEntryPeriod = FinanceEntryPeriod;

export const useVoorraad = useInventory;
export const addFinanciënEntry = addFinanceEntry;
export const removeFinanciënEntry = removeFinanceEntry;
export const getVoorraadMetrics = getInventoryMetrics;
export const getFinanciënOverviewByMonth = getFinanceOverviewByMonth;
