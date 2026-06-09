import { getItem, setItem } from 'lib/app-storage';
import { supabase } from 'lib/supabase';

export type TemperatureSource = 'manual' | 'sensor' | 'import';
export type TemperatureSyncState = 'local' | 'queued' | 'synced';

export type TemperatureLogRecord = {
  id: string;
  traceEventId: string | null;
  location: string;
  temperatureCelsius: number;
  temperatureSource: TemperatureSource;
  recordedAt: string;
  note: string;
  syncState: TemperatureSyncState;
  lastSyncAt: string | null;
  syncError: string | null;
};

const STORAGE_KEY = 'temperature-logs-v1';
const TABLE = 'temperature_logs';
const MAX_TEMPERATURE_LOGS = 200;

let cachedTemperatureLogs: TemperatureLogRecord[] = [];

function queuedTemperatureLog(entry: TemperatureLogRecord, syncError: string): TemperatureLogRecord {
  return {
    ...entry,
    syncState: 'queued',
    syncError,
    lastSyncAt: null,
  };
}

function sortTemperatureLogs(entries: TemperatureLogRecord[]) {
  return entries
    .slice()
    .sort((left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime());
}

function normalizeNullableText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeTemperatureLog(entry: unknown): TemperatureLogRecord | null {
  if (!entry || typeof entry !== 'object') return null;
  const value = entry as Partial<TemperatureLogRecord>;
  if (typeof value.id !== 'string' || typeof value.location !== 'string' || typeof value.recordedAt !== 'string') {
    return null;
  }

  const temperature = Number(value.temperatureCelsius);
  if (!Number.isFinite(temperature)) return null;

  return {
    id: value.id,
    traceEventId: typeof value.traceEventId === 'string' && value.traceEventId ? value.traceEventId : null,
    location: value.location,
    temperatureCelsius: temperature,
    temperatureSource:
      value.temperatureSource === 'sensor' || value.temperatureSource === 'import' ? value.temperatureSource : 'manual',
    recordedAt: value.recordedAt,
    note: typeof value.note === 'string' ? value.note : '',
    syncState: value.syncState === 'queued' || value.syncState === 'synced' ? value.syncState : 'local',
    lastSyncAt: typeof value.lastSyncAt === 'string' && value.lastSyncAt ? value.lastSyncAt : null,
    syncError: typeof value.syncError === 'string' && value.syncError ? value.syncError : null,
  };
}

async function persistTemperatureLogs(entries: TemperatureLogRecord[]) {
  cachedTemperatureLogs = sortTemperatureLogs(entries).slice(0, MAX_TEMPERATURE_LOGS);
  await setItem(STORAGE_KEY, JSON.stringify(cachedTemperatureLogs));
}

async function loadLocalTemperatureLogs() {
  const raw = await getItem(STORAGE_KEY);
  return raw
    ? sortTemperatureLogs(
        (JSON.parse(raw) as unknown[])
          .map((entry) => normalizeTemperatureLog(entry))
          .filter((entry): entry is TemperatureLogRecord => Boolean(entry))
      )
    : [];
}

async function syncTemperatureLog(entry: TemperatureLogRecord): Promise<TemperatureLogRecord> {
  if (!supabase) {
    return queuedTemperatureLog(entry, 'supabase_not_configured');
  }

  if (!entry.location.trim()) {
    return queuedTemperatureLog(entry, 'missing_location');
  }

  if (!Number.isFinite(entry.temperatureCelsius)) {
    return queuedTemperatureLog(entry, 'invalid_temperature');
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) {
      return queuedTemperatureLog(entry, 'missing_session');
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from(TABLE)
      .upsert(
        {
          id: entry.id,
          user_id: userId,
          trace_event_id: normalizeNullableText(entry.traceEventId),
          location: entry.location.trim(),
          temperature_celsius: entry.temperatureCelsius,
          temperature_source: entry.temperatureSource,
          recorded_at: entry.recordedAt,
          updated_at: now,
          note: normalizeNullableText(entry.note) ?? '',
        },
        { onConflict: 'id' }
      )
      .select('id,user_id,location,temperature_celsius,updated_at')
      .single<{
        id: string;
        user_id: string;
        location: string | null;
        temperature_celsius: number | string | null;
        updated_at: string | null;
      }>();

    if (error) {
      return queuedTemperatureLog(entry, error.message || 'temperature_logs_upsert_failed');
    }

    if (!data || data.id !== entry.id || data.user_id !== userId || !data.location?.trim()) {
      return queuedTemperatureLog(entry, 'temperature_logs_insert_not_confirmed');
    }

    return {
      ...entry,
      location: data.location,
      temperatureCelsius: Number(data.temperature_celsius),
      syncState: 'synced',
      lastSyncAt: data.updated_at || now,
      syncError: null,
    };
  } catch (error) {
    return queuedTemperatureLog(entry, error instanceof Error ? error.message : 'temperature_sync_failed');
  }
}

export async function appendTemperatureLog(
  entry: Omit<TemperatureLogRecord, 'id' | 'recordedAt' | 'syncState' | 'lastSyncAt' | 'syncError'> & {
    id?: string;
    recordedAt?: string;
  }
) {
  const next = await syncTemperatureLog({
    ...entry,
    id: entry.id ?? `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    recordedAt: entry.recordedAt ?? new Date().toISOString(),
    syncState: 'local',
    lastSyncAt: null,
    syncError: null,
  });
  const current = cachedTemperatureLogs.length ? cachedTemperatureLogs : await loadLocalTemperatureLogs();
  const merged = sortTemperatureLogs([next, ...current]).slice(0, MAX_TEMPERATURE_LOGS);
  await persistTemperatureLogs(merged);
  return next;
}

export async function syncTemperatureLogs() {
  const current = cachedTemperatureLogs.length ? cachedTemperatureLogs : await loadLocalTemperatureLogs();
  const synced = await Promise.all(
    current.map(async (entry) => {
      if (entry.syncState === 'synced' && entry.lastSyncAt) return entry;
      return syncTemperatureLog(entry);
    })
  );
  await persistTemperatureLogs(synced);
  return cachedTemperatureLogs;
}
