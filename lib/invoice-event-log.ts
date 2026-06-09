import { getItem, setItem } from 'lib/app-storage';
import { supabase } from 'lib/supabase';

export type InvoiceEventKind =
  | 'concept_saved'
  | 'sync_retry'
  | 'status_sent'
  | 'status_paid'
  | 'mail_sent';

export type InvoiceEventRecord = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  kind: InvoiceEventKind;
  label: string;
  detail: string;
  createdAt: string;
  syncState: 'local' | 'queued' | 'synced';
  lastSyncAt: string | null;
  syncError: string | null;
};

const STORAGE_KEY = 'invoice-event-log-v1';
const MAX_ITEMS = 240;
const TABLE = 'invoice_event_log';

let cachedInvoiceEvents: InvoiceEventRecord[] = [];
const listeners = new Set<(entries: InvoiceEventRecord[]) => void>();

function emit(entries: InvoiceEventRecord[]) {
  cachedInvoiceEvents = entries;
  listeners.forEach((listener) => listener(entries));
}

function normalizeInvoiceEvent(entry: unknown): InvoiceEventRecord | null {
  if (!entry || typeof entry !== 'object') return null;
  const value = entry as Partial<InvoiceEventRecord>;
  if (
    typeof value.id !== 'string' ||
    typeof value.invoiceId !== 'string' ||
    typeof value.invoiceNumber !== 'string' ||
    typeof value.createdAt !== 'string'
  ) {
    return null;
  }

  return {
    id: value.id,
    invoiceId: value.invoiceId,
    invoiceNumber: value.invoiceNumber,
    kind:
      value.kind === 'sync_retry' ||
      value.kind === 'status_sent' ||
      value.kind === 'status_paid' ||
      value.kind === 'mail_sent'
        ? value.kind
        : 'concept_saved',
    label: typeof value.label === 'string' ? value.label : 'Factuurevent',
    detail: typeof value.detail === 'string' ? value.detail : '',
    createdAt: value.createdAt,
    syncState: value.syncState === 'queued' || value.syncState === 'synced' ? value.syncState : 'local',
    lastSyncAt: typeof value.lastSyncAt === 'string' && value.lastSyncAt ? value.lastSyncAt : null,
    syncError: typeof value.syncError === 'string' && value.syncError ? value.syncError : null,
  };
}

function sortEvents(entries: InvoiceEventRecord[]) {
  return entries
    .slice()
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

async function persistEvents(entries: InvoiceEventRecord[]) {
  await setItem(STORAGE_KEY, JSON.stringify(entries));
  emit(entries);
}

async function syncInvoiceEvent(entry: InvoiceEventRecord): Promise<InvoiceEventRecord> {
  if (!supabase) {
    return {
      ...entry,
      syncState: 'local',
      syncError: null,
    };
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) {
      return {
        ...entry,
        syncState: 'local',
        syncError: null,
      };
    }

    const now = new Date().toISOString();
    const { error } = await supabase.from(TABLE).upsert(
      {
        id: entry.id,
        user_id: userId,
        invoice_id: entry.invoiceId,
        invoice_number: entry.invoiceNumber,
        kind: entry.kind,
        label: entry.label,
        detail: entry.detail,
        created_at: entry.createdAt,
        updated_at: now,
      },
      { onConflict: 'id' }
    );

    if (error) {
      return {
        ...entry,
        syncState: 'queued',
        syncError: error.message || 'Sync mislukt',
      };
    }

    return {
      ...entry,
      syncState: 'synced',
      lastSyncAt: now,
      syncError: null,
    };
  } catch (error) {
    return {
      ...entry,
      syncState: 'queued',
      syncError: error instanceof Error ? error.message : 'Sync mislukt',
    };
  }
}

export function getCachedInvoiceEvents() {
  return cachedInvoiceEvents;
}

export function subscribeInvoiceEvents(listener: (entries: InvoiceEventRecord[]) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function loadInvoiceEvents() {
  try {
    const raw = await getItem(STORAGE_KEY);
    const entries = raw
      ? sortEvents(
          (JSON.parse(raw) as unknown[])
            .map((entry) => normalizeInvoiceEvent(entry))
            .filter((entry): entry is InvoiceEventRecord => Boolean(entry))
        )
      : [];
    emit(entries);
    return entries;
  } catch {
    emit([]);
    return [] as InvoiceEventRecord[];
  }
}

export async function appendInvoiceEvent(
  entry: Omit<InvoiceEventRecord, 'id' | 'createdAt' | 'syncState' | 'lastSyncAt' | 'syncError'>
) {
  const current = cachedInvoiceEvents.length ? cachedInvoiceEvents : await loadInvoiceEvents();
  const nextEntry = await syncInvoiceEvent({
    ...entry,
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    syncState: 'local',
    lastSyncAt: null,
    syncError: null,
  });
  const next = sortEvents([nextEntry, ...current].slice(0, MAX_ITEMS));
  await persistEvents(next);
  return next;
}

export async function syncInvoiceEvents() {
  const current = cachedInvoiceEvents.length ? cachedInvoiceEvents : await loadInvoiceEvents();
  const next = await Promise.all(
    current.map(async (entry) => {
      if (entry.syncState === 'synced' && entry.lastSyncAt) {
        return entry;
      }
      return syncInvoiceEvent(entry);
    })
  );
  const sorted = sortEvents(next);
  await persistEvents(sorted);
  return sorted;
}
