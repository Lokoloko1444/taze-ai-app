import { getItem, setItem } from 'lib/app-storage';

export type TransportAuditAction =
  | 'recommended'
  | 'opened'
  | 'followup_logged'
  | 'copied'
  | 'favorite_saved'
  | 'default_saved'
  | 'favorite_removed'
  | 'default_removed';

export type TransportAuditEntry = {
  id: string;
  appId: string;
  appLabel: string;
  action: TransportAuditAction;
  scopeLabel: string;
  detail: string;
  createdAt: string;
};

const STORAGE_KEY = 'transport-audit-v1';
const MAX_ITEMS = 160;

let cachedTransportAudit: TransportAuditEntry[] = [];
const listeners = new Set<(entries: TransportAuditEntry[]) => void>();

function emit(entries: TransportAuditEntry[]) {
  cachedTransportAudit = entries;
  listeners.forEach((listener) => listener(entries));
}

function sortEntries(entries: TransportAuditEntry[]) {
  return entries
    .slice()
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

function normalizeTransportAuditEntry(entry: unknown): TransportAuditEntry | null {
  if (!entry || typeof entry !== 'object') return null;
  const value = entry as Partial<TransportAuditEntry>;
  if (
    typeof value.id !== 'string' ||
    typeof value.appId !== 'string' ||
    typeof value.appLabel !== 'string' ||
    typeof value.createdAt !== 'string'
  ) {
    return null;
  }

  return {
    id: value.id,
    appId: value.appId,
    appLabel: value.appLabel,
    action:
      value.action === 'opened' ||
      value.action === 'followup_logged' ||
      value.action === 'copied' ||
      value.action === 'favorite_saved' ||
      value.action === 'default_saved' ||
      value.action === 'favorite_removed' ||
      value.action === 'default_removed'
        ? value.action
        : 'recommended',
    scopeLabel: typeof value.scopeLabel === 'string' ? value.scopeLabel : 'transport',
    detail: typeof value.detail === 'string' ? value.detail : '',
    createdAt: value.createdAt,
  };
}

async function persist(entries: TransportAuditEntry[]) {
  await setItem(STORAGE_KEY, JSON.stringify(entries));
  emit(entries);
}

export function getCachedTransportAudit() {
  return cachedTransportAudit;
}

export function subscribeTransportAudit(listener: (entries: TransportAuditEntry[]) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function loadTransportAudit() {
  try {
    const raw = await getItem(STORAGE_KEY);
    const entries = raw
      ? sortEntries(
          (JSON.parse(raw) as unknown[])
            .map((entry) => normalizeTransportAuditEntry(entry))
            .filter((entry): entry is TransportAuditEntry => Boolean(entry))
        )
      : [];
    emit(entries);
    return entries;
  } catch {
    emit([]);
    return [] as TransportAuditEntry[];
  }
}

export async function logTransportAudit(input: Omit<TransportAuditEntry, 'id' | 'createdAt'>) {
  const current = cachedTransportAudit.length ? cachedTransportAudit : await loadTransportAudit();
  const entry: TransportAuditEntry = {
    ...input,
    id: `transport-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  const next = sortEntries([entry, ...current].slice(0, MAX_ITEMS));
  await persist(next);
  return entry;
}

export async function clearTransportAudit() {
  await persist([]);
}
