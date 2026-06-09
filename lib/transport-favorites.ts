import { getItem, setItem } from 'lib/app-storage';
import { supabase } from 'lib/supabase';

export type TransportPreferenceScopeType = 'region' | 'useCase';
export type TransportPreferenceKind = 'favorite' | 'default';
export type TransportPreferenceSyncState = 'local' | 'queued' | 'synced';

export type TransportPreferenceRecord = {
  id: string;
  appId: string;
  scopeType: TransportPreferenceScopeType;
  scopeValue: string;
  kind: TransportPreferenceKind;
  createdAt: string;
  syncState: TransportPreferenceSyncState;
  lastSyncAt: string | null;
  syncError: string | null;
};

const STORAGE_KEY = 'transport-preferences-v1';
const TABLE = 'transport_preferences';
const MAX_PREFERENCES = 160;

let cachedTransportPreferences: TransportPreferenceRecord[] = [];
let hydrated = false;
const listeners = new Set<(entries: TransportPreferenceRecord[]) => void>();

function emit(entries: TransportPreferenceRecord[]) {
  cachedTransportPreferences = entries;
  listeners.forEach((listener) => listener(entries));
}

function normalizeTransportPreference(entry: unknown): TransportPreferenceRecord | null {
  if (!entry || typeof entry !== 'object') return null;
  const value = entry as Partial<TransportPreferenceRecord>;
  if (
    typeof value.id !== 'string' ||
    typeof value.appId !== 'string' ||
    typeof value.scopeValue !== 'string' ||
    typeof value.createdAt !== 'string'
  ) {
    return null;
  }

  return {
    id: value.id,
    appId: value.appId,
    scopeType: value.scopeType === 'useCase' ? 'useCase' : 'region',
    scopeValue: value.scopeValue,
    kind: value.kind === 'default' ? 'default' : 'favorite',
    createdAt: value.createdAt,
    syncState: value.syncState === 'queued' || value.syncState === 'synced' ? value.syncState : 'local',
    lastSyncAt: typeof value.lastSyncAt === 'string' && value.lastSyncAt ? value.lastSyncAt : null,
    syncError: typeof value.syncError === 'string' && value.syncError ? value.syncError : null,
  };
}

function sortPreferences(entries: TransportPreferenceRecord[]) {
  return entries
    .slice()
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

async function persistPreferences(entries: TransportPreferenceRecord[]) {
  hydrated = true;
  await setItem(STORAGE_KEY, JSON.stringify(entries));
  emit(entries);
}

async function syncTransportPreferenceRecord(entry: TransportPreferenceRecord): Promise<TransportPreferenceRecord> {
  if (!supabase) {
    return { ...entry, syncState: 'local', syncError: null };
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) {
      return { ...entry, syncState: 'local', syncError: null };
    }

    const now = new Date().toISOString();
    const { error } = await supabase.from(TABLE).upsert(
      {
        id: entry.id,
        user_id: userId,
        app_id: entry.appId,
        scope_type: entry.scopeType,
        scope_value: entry.scopeValue,
        kind: entry.kind,
        created_at: entry.createdAt,
        updated_at: now,
      },
      { onConflict: 'id' }
    );

    if (error) {
      return { ...entry, syncState: 'queued', syncError: error.message || 'Sync mislukt' };
    }

    return { ...entry, syncState: 'synced', lastSyncAt: now, syncError: null };
  } catch (error) {
    return { ...entry, syncState: 'queued', syncError: error instanceof Error ? error.message : 'Sync mislukt' };
  }
}

async function deleteTransportPreferenceFromBackend(entry: TransportPreferenceRecord) {
  if (!supabase) return;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return;
    await supabase.from(TABLE).delete().eq('id', entry.id).eq('user_id', userId);
  } catch {
    // keep local delete even if backend delete fails
  }
}

export function getCachedTransportPreferences() {
  return hydrated ? cachedTransportPreferences : [];
}

export function subscribeTransportPreferences(listener: (entries: TransportPreferenceRecord[]) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function loadTransportPreferences() {
  try {
    const raw = await getItem(STORAGE_KEY);
    const entries = raw
      ? sortPreferences(
          (JSON.parse(raw) as unknown[])
            .map((entry) => normalizeTransportPreference(entry))
        .filter((entry): entry is TransportPreferenceRecord => Boolean(entry))
      )
      : [];
    hydrated = true;
    emit(entries);
    return entries;
  } catch {
    hydrated = true;
    emit([]);
    return [] as TransportPreferenceRecord[];
  }
}

export async function saveTransportPreference(params: {
  appId: string;
  scopeType: TransportPreferenceScopeType;
  scopeValue: string;
  kind: TransportPreferenceKind;
}) {
  const current = cachedTransportPreferences.length ? cachedTransportPreferences : await loadTransportPreferences();
  const createdAt = new Date().toISOString();
  const baseEntry = await syncTransportPreferenceRecord({
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    appId: params.appId,
    scopeType: params.scopeType,
    scopeValue: params.scopeValue,
    kind: params.kind,
    createdAt,
    syncState: 'local',
    lastSyncAt: null,
    syncError: null,
  });

  const next = sortPreferences(
    [
      baseEntry,
      ...current.filter((entry) => {
        if (params.kind === 'default') {
          return !(
            entry.kind === 'default' &&
            entry.scopeType === params.scopeType &&
            entry.scopeValue === params.scopeValue
          );
        }
        return !(
          entry.kind === 'favorite' &&
          entry.scopeType === params.scopeType &&
          entry.scopeValue === params.scopeValue &&
            entry.appId === params.appId
        );
      }),
    ].slice(0, MAX_PREFERENCES)
  );

  await persistPreferences(next);
  return next;
}

export async function removeTransportPreference(id: string) {
  const current = cachedTransportPreferences.length ? cachedTransportPreferences : await loadTransportPreferences();
  const removed = current.find((entry) => entry.id === id) ?? null;
  if (removed) {
    await deleteTransportPreferenceFromBackend(removed);
  }
  const next = current.filter((entry) => entry.id !== id);
  await persistPreferences(next);
  return next;
}

export async function removeTransportPreferenceByMatch(params: {
  appId: string;
  scopeType: TransportPreferenceScopeType;
  scopeValue: string;
  kind: TransportPreferenceKind;
}) {
  const current = cachedTransportPreferences.length ? cachedTransportPreferences : await loadTransportPreferences();
  const removed = current.filter(
    (entry) =>
      entry.appId === params.appId &&
      entry.scopeType === params.scopeType &&
      entry.scopeValue === params.scopeValue &&
      entry.kind === params.kind
  );
  await Promise.all(removed.map((entry) => deleteTransportPreferenceFromBackend(entry)));
  const next = current.filter(
    (entry) =>
      !(
        entry.appId === params.appId &&
        entry.scopeType === params.scopeType &&
        entry.scopeValue === params.scopeValue &&
        entry.kind === params.kind
      )
  );
  await persistPreferences(next);
  return next;
}

export async function syncTransportPreferences() {
  const current = cachedTransportPreferences.length ? cachedTransportPreferences : await loadTransportPreferences();
  const synced = await Promise.all(
    current.map(async (entry) => {
      if (entry.syncState === 'synced' && entry.lastSyncAt) {
        return entry;
      }
      return syncTransportPreferenceRecord(entry);
    })
  );
  const merged = sortPreferences(synced.slice(0, MAX_PREFERENCES));
  await persistPreferences(merged);
  return merged;
}

export async function syncTransportPreferenceById(id: string) {
  const current = cachedTransportPreferences.length ? cachedTransportPreferences : await loadTransportPreferences();
  const synced = await Promise.all(
    current.map(async (entry) => {
      if (entry.id !== id) return entry;
      return syncTransportPreferenceRecord(entry);
    })
  );
  const merged = sortPreferences(synced.slice(0, MAX_PREFERENCES));
  await persistPreferences(merged);
  return merged;
}

export async function syncFailedTransportPreferences() {
  const current = cachedTransportPreferences.length ? cachedTransportPreferences : await loadTransportPreferences();
  const synced = await Promise.all(
    current.map(async (entry) => {
      if (!entry.syncError || entry.syncState === 'synced') return entry;
      return syncTransportPreferenceRecord(entry);
    })
  );
  const merged = sortPreferences(synced.slice(0, MAX_PREFERENCES));
  await persistPreferences(merged);
  return merged;
}

export function getTransportPreferenceForScope(
  entries: TransportPreferenceRecord[],
  params: {
    scopeType: TransportPreferenceScopeType;
    scopeValue: string;
    kind?: TransportPreferenceKind;
  }
) {
  return entries.filter((entry) => {
    if (entry.scopeType !== params.scopeType) return false;
    if (entry.scopeValue !== params.scopeValue) return false;
    if (params.kind && entry.kind !== params.kind) return false;
    return true;
  });
}

export function getDefaultTransportAppId(
  entries: TransportPreferenceRecord[],
  params: {
    scopeType: TransportPreferenceScopeType;
    scopeValue: string;
  }
) {
  return (
    getTransportPreferenceForScope(entries, { ...params, kind: 'default' })[0]?.appId ??
    null
  );
}
