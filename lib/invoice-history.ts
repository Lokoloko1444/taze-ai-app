import { getItem, setItem } from 'lib/app-storage';
import { supabase } from 'lib/supabase';

export type InvoiceDraftStatus = 'concept' | 'ready' | 'sent' | 'paid';
export type InvoiceDraftSyncState = 'local' | 'queued' | 'synced';

export type InvoiceDraftRecord = {
  id: string;
  savedAt: string;
  invoiceNumber: string;
  paymentReference: string;
  checkoutSessionId: string | null;
  dueDate: string;
  invoiceTo: string;
  invoiceVat: string;
  invoiceEmail: string;
  invoiceCountry: string;
  invoiceVatRate: number;
  billingCycle: string;
  customerType: string;
  selectedPlanId: string;
  selectedMethodId: string;
  monthRevenue: number;
  monthFoodCost: number;
  monthLoss: number;
  monthVatAmount: number;
  monthInvoiceTotal: number;
  previewText: string;
  savedFrom: 'manual' | 'copy' | 'mail' | 'pdf' | 'checkout';
  status: InvoiceDraftStatus;
  syncState: InvoiceDraftSyncState;
  lastSyncAt: string | null;
  syncError: string | null;
};

const STORAGE_KEY = 'invoice-history-v1';
const MAX_HISTORY_ITEMS = 20;
const TABLE = 'invoice_history';

function buildInvoiceNumber(savedAt: string, id: string) {
  const date = new Date(savedAt);
  const year = Number.isNaN(date.getTime()) ? '0000' : String(date.getFullYear());
  const month = Number.isNaN(date.getTime()) ? '00' : String(date.getMonth() + 1).padStart(2, '0');
  const suffix = id.slice(-4).toUpperCase();
  return `TAZE-${year}${month}-${suffix}`;
}

function buildPaymentReference(id: string) {
  return `RF-${id.replace(/[^a-z0-9]/gi, '').slice(-10).toUpperCase()}`;
}

function buildDueDate(savedAt: string) {
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  date.setDate(date.getDate() + 30);
  return date.toISOString();
}

function normalizeInvoiceStatus(value: unknown): InvoiceDraftStatus {
  return value === 'ready' || value === 'sent' || value === 'paid' ? value : 'concept';
}

function normalizeInvoiceSyncState(value: unknown): InvoiceDraftSyncState {
  return value === 'queued' || value === 'synced' ? value : 'local';
}

function normalizeInvoiceDraftRecord(entry: unknown): InvoiceDraftRecord | null {
  if (!entry || typeof entry !== 'object') return null;
  const value = entry as Partial<InvoiceDraftRecord>;
  if (typeof value.id !== 'string' || typeof value.savedAt !== 'string' || typeof value.previewText !== 'string') {
    return null;
  }

  return {
    id: value.id,
    savedAt: value.savedAt,
    invoiceNumber:
      typeof value.invoiceNumber === 'string' && value.invoiceNumber ? value.invoiceNumber : buildInvoiceNumber(value.savedAt, value.id),
    paymentReference:
      typeof value.paymentReference === 'string' && value.paymentReference ? value.paymentReference : buildPaymentReference(value.id),
    checkoutSessionId:
      typeof value.checkoutSessionId === 'string' && value.checkoutSessionId.trim() ? value.checkoutSessionId.trim() : null,
    dueDate: typeof value.dueDate === 'string' && value.dueDate ? value.dueDate : buildDueDate(value.savedAt),
    invoiceTo: typeof value.invoiceTo === 'string' ? value.invoiceTo : 'Klantbedrijf BV',
    invoiceVat: typeof value.invoiceVat === 'string' ? value.invoiceVat : '',
    invoiceEmail: typeof value.invoiceEmail === 'string' ? value.invoiceEmail : '',
    invoiceCountry: typeof value.invoiceCountry === 'string' ? value.invoiceCountry : 'BE',
    invoiceVatRate: typeof value.invoiceVatRate === 'number' && Number.isFinite(value.invoiceVatRate) ? value.invoiceVatRate : 21,
    billingCycle: typeof value.billingCycle === 'string' ? value.billingCycle : 'Maandelijks',
    customerType: typeof value.customerType === 'string' ? value.customerType : 'Bedrijven',
    selectedPlanId: typeof value.selectedPlanId === 'string' ? value.selectedPlanId : '',
    selectedMethodId: typeof value.selectedMethodId === 'string' ? value.selectedMethodId : '',
    monthRevenue: typeof value.monthRevenue === 'number' && Number.isFinite(value.monthRevenue) ? value.monthRevenue : 0,
    monthFoodCost: typeof value.monthFoodCost === 'number' && Number.isFinite(value.monthFoodCost) ? value.monthFoodCost : 0,
    monthLoss: typeof value.monthLoss === 'number' && Number.isFinite(value.monthLoss) ? value.monthLoss : 0,
    monthVatAmount: typeof value.monthVatAmount === 'number' && Number.isFinite(value.monthVatAmount) ? value.monthVatAmount : 0,
    monthInvoiceTotal:
      typeof value.monthInvoiceTotal === 'number' && Number.isFinite(value.monthInvoiceTotal) ? value.monthInvoiceTotal : 0,
    previewText: value.previewText,
    savedFrom:
      value.savedFrom === 'copy' ||
      value.savedFrom === 'mail' ||
      value.savedFrom === 'pdf' ||
      value.savedFrom === 'checkout'
        ? value.savedFrom
        : 'manual',
    status: normalizeInvoiceStatus(value.status),
    syncState: normalizeInvoiceSyncState(value.syncState),
    lastSyncAt: typeof value.lastSyncAt === 'string' && value.lastSyncAt ? value.lastSyncAt : null,
    syncError: typeof value.syncError === 'string' && value.syncError ? value.syncError : null,
  };
}

async function saveInvoiceHistory(records: InvoiceDraftRecord[]) {
  await setItem(STORAGE_KEY, JSON.stringify(records));
}

async function syncInvoiceDraftRecord(record: InvoiceDraftRecord): Promise<InvoiceDraftRecord> {
  if (!supabase) {
    return {
      ...record,
      syncState: 'local',
      lastSyncAt: null,
      syncError: null,
    };
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) {
      return {
        ...record,
        syncState: 'local',
        syncError: null,
      };
    }

    const now = new Date().toISOString();
    const { error } = await supabase.from(TABLE).upsert(
      {
        id: record.id,
        user_id: userId,
        status: record.status,
        sync_state: 'synced',
        saved_from: record.savedFrom,
        saved_at: record.savedAt,
        updated_at: now,
        payload: {
          invoiceNumber: record.invoiceNumber,
          paymentReference: record.paymentReference,
          checkoutSessionId: record.checkoutSessionId,
          dueDate: record.dueDate,
          invoiceTo: record.invoiceTo,
          invoiceVat: record.invoiceVat,
          invoiceEmail: record.invoiceEmail,
          invoiceCountry: record.invoiceCountry,
          invoiceVatRate: record.invoiceVatRate,
          billingCycle: record.billingCycle,
          customerType: record.customerType,
          selectedPlanId: record.selectedPlanId,
          selectedMethodId: record.selectedMethodId,
          monthRevenue: record.monthRevenue,
          monthFoodCost: record.monthFoodCost,
          monthLoss: record.monthLoss,
          monthVatAmount: record.monthVatAmount,
          monthInvoiceTotal: record.monthInvoiceTotal,
          previewText: record.previewText,
        },
      },
      { onConflict: 'id' }
    );

    if (error) {
      return {
        ...record,
        syncState: 'queued',
        syncError: error.message || 'Sync mislukt',
      };
    }

    return {
      ...record,
      syncState: 'synced',
      lastSyncAt: now,
      syncError: null,
    };
  } catch (error) {
    return {
      ...record,
      syncState: 'queued',
      syncError: error instanceof Error ? error.message : 'Sync mislukt',
    };
  }
}

function sortInvoiceHistory(records: InvoiceDraftRecord[]) {
  return records
    .slice()
    .sort((left, right) => new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime());
}

export async function loadInvoiceHistory() {
  try {
    const raw = await getItem(STORAGE_KEY);
    if (!raw) return [] as InvoiceDraftRecord[];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [] as InvoiceDraftRecord[];
    return sortInvoiceHistory(
      parsed
        .map((entry) => normalizeInvoiceDraftRecord(entry))
        .filter((entry): entry is InvoiceDraftRecord => Boolean(entry))
    );
  } catch {
    return [] as InvoiceDraftRecord[];
  }
}

export async function saveInvoiceDraft(
  entry: Omit<
    InvoiceDraftRecord,
    'id' | 'savedAt' | 'invoiceNumber' | 'paymentReference' | 'checkoutSessionId' | 'dueDate' | 'syncState' | 'lastSyncAt' | 'syncError'
  > &
    Partial<Pick<InvoiceDraftRecord, 'status'>>
) {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const savedAt = new Date().toISOString();
  const nextItem = await syncInvoiceDraftRecord({
    ...entry,
    id,
    savedAt,
    invoiceNumber: buildInvoiceNumber(savedAt, id),
    paymentReference: buildPaymentReference(id),
    checkoutSessionId: null,
    dueDate: buildDueDate(savedAt),
    status: normalizeInvoiceStatus(entry.status),
    syncState: 'local',
    lastSyncAt: null,
    syncError: null,
  });
  const current = await loadInvoiceHistory();
  const deduped = current.filter(
    (item) =>
      !(
        item.invoiceTo.trim().toLowerCase() === nextItem.invoiceTo.trim().toLowerCase() &&
        item.invoiceVat.trim().toLowerCase() === nextItem.invoiceVat.trim().toLowerCase() &&
        item.previewText.trim() === nextItem.previewText.trim()
      )
  );
  const next = sortInvoiceHistory([nextItem, ...deduped].slice(0, MAX_HISTORY_ITEMS));
  await saveInvoiceHistory(next);
  return next;
}

export async function updateInvoiceDraft(
  id: string,
  patch: Partial<Pick<InvoiceDraftRecord, 'status' | 'syncState' | 'syncError' | 'lastSyncAt' | 'checkoutSessionId'>>
) {
  const current = await loadInvoiceHistory();
  const next = await Promise.all(
    current.map(async (record) => {
      if (record.id !== id) return record;
      const patchedRecord = {
        ...record,
        ...patch,
        status: patch.status ? normalizeInvoiceStatus(patch.status) : record.status,
      };
      return syncInvoiceDraftRecord(patchedRecord);
    })
  );
  const sorted = sortInvoiceHistory(next);
  await saveInvoiceHistory(sorted);
  return sorted;
}

export async function syncInvoiceHistory() {
  const current = await loadInvoiceHistory();
  const next = await Promise.all(
    current.map(async (record) => {
      if (record.syncState === 'synced' && record.lastSyncAt) {
        return record;
      }
      return syncInvoiceDraftRecord(record);
    })
  );
  const sorted = sortInvoiceHistory(next);
  await saveInvoiceHistory(sorted);
  return sorted;
}
