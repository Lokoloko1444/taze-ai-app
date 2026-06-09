import { getItem, removeItem, setItem } from 'lib/app-storage';
import { supabase } from 'lib/supabase';

export type TraceEventKind = 'scan_saved' | 'transfer' | 'consume' | 'waste' | 'inventory_mutation';
export type TraceEventSyncState = 'local' | 'queued' | 'synced';

export type TraceEventRecord = {
  id: string;
  createdAt: string;
  eventKind: TraceEventKind;
  itemId: string | null;
  itemName: string;
  location: string | null;
  fromLocation: string | null;
  toLocation: string | null;
  quantity: number;
  source: string;
  barcode: string | null;
  batchCode: string | null;
  lotNumber: string | null;
  confidence: number | null;
  expiryDays: number | null;
  note: string;
  syncState: TraceEventSyncState;
  lastSyncAt: string | null;
  syncError: string | null;
};

const STORAGE_KEY = 'trace-events-v1';
const TABLE = 'trace_events';
const MAX_TRACE_EVENTS = 120;

type TraceEventWriteConfirmation = {
  id: string;
  user_id: string;
  item_name: string | null;
  location: string | null;
  to_location: string | null;
  barcode: string | null;
  updated_at: string | null;
};

let cachedTraceEvents: TraceEventRecord[] = [];
const listeners = new Set<(entries: TraceEventRecord[]) => void>();

function emitTraceEvents(entries: TraceEventRecord[]) {
  cachedTraceEvents = entries;
  listeners.forEach((listener) => listener(entries));
}

function normalizeTraceEvent(entry: unknown): TraceEventRecord | null {
  if (!entry || typeof entry !== 'object') return null;
  const value = entry as Partial<TraceEventRecord>;
  if (typeof value.id !== 'string' || typeof value.createdAt !== 'string' || typeof value.itemName !== 'string') {
    return null;
  }

  return {
    id: value.id,
    createdAt: value.createdAt,
    eventKind:
      value.eventKind === 'transfer' ||
      value.eventKind === 'consume' ||
      value.eventKind === 'waste' ||
      value.eventKind === 'inventory_mutation'
        ? value.eventKind
        : 'scan_saved',
    itemId: typeof value.itemId === 'string' && value.itemId ? value.itemId : null,
    itemName: value.itemName,
    location: typeof value.location === 'string' && value.location ? value.location : null,
    fromLocation: typeof value.fromLocation === 'string' && value.fromLocation ? value.fromLocation : null,
    toLocation: typeof value.toLocation === 'string' && value.toLocation ? value.toLocation : null,
    quantity: typeof value.quantity === 'number' && Number.isFinite(value.quantity) ? value.quantity : 1,
    source: typeof value.source === 'string' ? value.source : 'unknown',
    barcode: typeof value.barcode === 'string' && value.barcode ? value.barcode : null,
    batchCode: typeof value.batchCode === 'string' && value.batchCode ? value.batchCode : null,
    lotNumber: typeof value.lotNumber === 'string' && value.lotNumber ? value.lotNumber : null,
    confidence: typeof value.confidence === 'number' && Number.isFinite(value.confidence) ? value.confidence : null,
    expiryDays: typeof value.expiryDays === 'number' && Number.isFinite(value.expiryDays) ? value.expiryDays : null,
    note: typeof value.note === 'string' ? value.note : '',
    syncState: value.syncState === 'queued' || value.syncState === 'synced' ? value.syncState : 'local',
    lastSyncAt: typeof value.lastSyncAt === 'string' && value.lastSyncAt ? value.lastSyncAt : null,
    syncError: typeof value.syncError === 'string' && value.syncError ? value.syncError : null,
  };
}

function sortTraceEvents(entries: TraceEventRecord[]) {
  return entries
    .slice()
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

function mergeTraceEvents(localEntries: TraceEventRecord[], cloudEntries: TraceEventRecord[]) {
  const byId = new Map<string, TraceEventRecord>();
  sortTraceEvents(localEntries).forEach((entry) => byId.set(entry.id, entry));
  sortTraceEvents(cloudEntries).forEach((entry) => byId.set(entry.id, entry));
  return sortTraceEvents([...byId.values()]).slice(0, MAX_TRACE_EVENTS);
}

function queuedTraceEvent(entry: TraceEventRecord, syncError: string): TraceEventRecord {
  return {
    ...entry,
    syncState: 'queued',
    syncError,
    lastSyncAt: null,
  };
}

function normalizeNullableText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function validateTraceEventForCloud(entry: TraceEventRecord) {
  if (!entry.itemName.trim()) {
    return 'missing_item_name';
  }

  if (!normalizeNullableText(entry.location) && !normalizeNullableText(entry.toLocation)) {
    return 'missing_location';
  }

  return null;
}

async function persistTraceEvents(entries: TraceEventRecord[]) {
  await setItem(STORAGE_KEY, JSON.stringify(entries));
  emitTraceEvents(entries);
}

function normalizeCloudTraceEvent(row: Record<string, unknown>): TraceEventRecord | null {
  if (typeof row.id !== 'string' || typeof row.item_name !== 'string') {
    return null;
  }

  const quantity = Number(row.quantity);
  const confidence = row.confidence === null || row.confidence === undefined ? null : Number(row.confidence);
  const expiryDays = row.expiry_days === null || row.expiry_days === undefined ? null : Number(row.expiry_days);

  return normalizeTraceEvent({
    id: row.id,
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
    eventKind: row.event_kind,
    itemId: typeof row.item_id === 'string' ? row.item_id : null,
    itemName: row.item_name,
    location: typeof row.location === 'string' ? row.location : null,
    fromLocation: typeof row.from_location === 'string' ? row.from_location : null,
    toLocation: typeof row.to_location === 'string' ? row.to_location : null,
    quantity: Number.isFinite(quantity) ? quantity : 1,
    source: typeof row.source === 'string' ? row.source : 'unknown',
    barcode: typeof row.barcode === 'string' ? row.barcode : null,
    batchCode: typeof row.batch_code === 'string' ? row.batch_code : null,
    lotNumber: typeof row.lot_number === 'string' ? row.lot_number : null,
    confidence: confidence !== null && Number.isFinite(confidence) ? confidence : null,
    expiryDays: expiryDays !== null && Number.isFinite(expiryDays) ? expiryDays : null,
    note: typeof row.note === 'string' ? row.note : '',
    syncState: 'synced',
    lastSyncAt: typeof row.updated_at === 'string' ? row.updated_at : new Date().toISOString(),
    syncError: null,
  });
}

async function pullCloudTraceEvents(): Promise<TraceEventRecord[]> {
  if (!supabase) return [];

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return [];

    const { data, error } = await supabase
      .from(TABLE)
      .select(
        'id,event_kind,created_at,updated_at,item_id,item_name,location,from_location,to_location,quantity,source,barcode,batch_code,lot_number,confidence,expiry_days,note'
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(MAX_TRACE_EVENTS);

    if (error || !Array.isArray(data)) return [];
    return data
      .map((row) => normalizeCloudTraceEvent(row as Record<string, unknown>))
      .filter((entry): entry is TraceEventRecord => Boolean(entry));
  } catch {
    return [];
  }
}

async function syncTraceEvent(entry: TraceEventRecord): Promise<TraceEventRecord> {
  if (!supabase) {
    return queuedTraceEvent(entry, 'supabase_not_configured');
  }

  const validationError = validateTraceEventForCloud(entry);
  if (validationError) {
    return queuedTraceEvent(entry, validationError);
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) {
      return queuedTraceEvent(entry, 'missing_session');
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from(TABLE)
      .upsert(
        {
          id: entry.id,
          user_id: userId,
          event_kind: entry.eventKind,
          created_at: entry.createdAt,
          updated_at: now,
          item_id: entry.itemId,
          item_name: entry.itemName.trim(),
          location: normalizeNullableText(entry.location),
          from_location: normalizeNullableText(entry.fromLocation),
          to_location: normalizeNullableText(entry.toLocation),
          quantity: entry.quantity,
          source: entry.source,
          barcode: normalizeNullableText(entry.barcode),
          batch_code: normalizeNullableText(entry.batchCode),
          lot_number: normalizeNullableText(entry.lotNumber),
          confidence: entry.confidence,
          expiry_days: entry.expiryDays,
          note: normalizeNullableText(entry.note),
        },
        { onConflict: 'id' }
      )
      .select('id,user_id,item_name,location,to_location,barcode,updated_at')
      .single<TraceEventWriteConfirmation>();

    if (error) {
      return queuedTraceEvent(entry, error.message || 'trace_events_upsert_failed');
    }

    if (
      !data ||
      data.id !== entry.id ||
      data.user_id !== userId ||
      !data.item_name?.trim() ||
      (!data.location?.trim() && !data.to_location?.trim())
    ) {
      return queuedTraceEvent(entry, 'trace_events_insert_not_confirmed');
    }

    return {
      ...entry,
      itemName: data.item_name,
      location: data.location,
      toLocation: data.to_location,
      barcode: data.barcode || entry.barcode,
      syncState: 'synced',
      lastSyncAt: data.updated_at || now,
      syncError: null,
    };
  } catch (error) {
    return queuedTraceEvent(entry, error instanceof Error ? error.message : 'Sync mislukt');
  }
}

export function getCachedTraceEvents() {
  return cachedTraceEvents;
}

export function subscribeTraceEvents(listener: (entries: TraceEventRecord[]) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function loadTraceEvents() {
  try {
    const raw = await getItem(STORAGE_KEY);
    const localEntries = raw
      ? sortTraceEvents(
          (JSON.parse(raw) as unknown[])
            .map((entry) => normalizeTraceEvent(entry))
            .filter((entry): entry is TraceEventRecord => Boolean(entry))
        )
      : [];
    const cloudEntries = await pullCloudTraceEvents();
    const entries = cloudEntries.length ? mergeTraceEvents(localEntries, cloudEntries) : localEntries;
    await persistTraceEvents(entries);
    return entries;
  } catch {
    emitTraceEvents([]);
    return [] as TraceEventRecord[];
  }
}

export async function appendTraceEvent(
  entry: Omit<TraceEventRecord, 'syncState' | 'lastSyncAt' | 'syncError' | 'id' | 'createdAt'> & {
    id?: string;
    createdAt?: string;
  }
) {
  const next = await syncTraceEvent({
    ...entry,
    id: entry.id ?? `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    createdAt: entry.createdAt ?? new Date().toISOString(),
    syncState: 'local',
    lastSyncAt: null,
    syncError: null,
  });
  const current = cachedTraceEvents.length ? cachedTraceEvents : await loadTraceEvents();
  const merged = sortTraceEvents([next, ...current].slice(0, MAX_TRACE_EVENTS));
  await persistTraceEvents(merged);
  return merged;
}

export async function syncTraceEvents() {
  const current = cachedTraceEvents.length ? cachedTraceEvents : await loadTraceEvents();
  const synced = await Promise.all(
    current.map(async (entry) => {
      if (entry.syncState === 'synced' && entry.lastSyncAt) return entry;
      return syncTraceEvent(entry);
    })
  );
  const cloudEntries = await pullCloudTraceEvents();
  const merged = mergeTraceEvents(synced, cloudEntries);
  await persistTraceEvents(merged);
  return merged;
}

export async function clearTraceEventsForTests() {
  cachedTraceEvents = [];
  listeners.clear();
  try {
    await removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
