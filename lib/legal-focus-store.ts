import { getItem, setItem } from 'lib/app-storage';

export type LegalFocusScreen = 'privacy' | 'support' | 'contact';

export type LegalFocusState = {
  selectedRouteKey: string | null;
  historyKeys: string[];
};

type LegalFocusStore = Record<LegalFocusScreen, LegalFocusState>;

const STORAGE_KEY = 'legal-focus-state-v1';
const MAX_HISTORY = 5;

const listeners = new Map<LegalFocusScreen, Set<(state: LegalFocusState) => void>>([
  ['privacy', new Set()],
  ['support', new Set()],
  ['contact', new Set()],
]);

let cache: LegalFocusStore = createDefaultStore();
let hydratePromise: Promise<LegalFocusStore> | null = null;

function createDefaultState(): LegalFocusState {
  return {
    selectedRouteKey: null,
    historyKeys: [],
  };
}

function createDefaultStore(): LegalFocusStore {
  return {
    privacy: createDefaultState(),
    support: createDefaultState(),
    contact: createDefaultState(),
  };
}

function normalizeRouteKey(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, 240);
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeHistoryKeys(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .map((entry) => normalizeRouteKey(entry))
    .filter((entry): entry is string => Boolean(entry))
    .filter((entry) => {
      if (seen.has(entry)) return false;
      seen.add(entry);
      return true;
    })
    .slice(0, MAX_HISTORY);
}

function normalizeState(value: unknown): LegalFocusState {
  if (!value || typeof value !== 'object') return createDefaultState();
  const candidate = value as Partial<LegalFocusState>;
  const selectedRouteKey = normalizeRouteKey(candidate.selectedRouteKey);
  const historyKeys = normalizeHistoryKeys(candidate.historyKeys);

  return {
    selectedRouteKey,
    historyKeys,
  };
}

function normalizeStore(value: unknown): LegalFocusStore {
  if (!value || typeof value !== 'object') return createDefaultStore();
  const candidate = value as Partial<Record<LegalFocusScreen, LegalFocusState>>;

  return {
    privacy: normalizeState(candidate.privacy),
    support: normalizeState(candidate.support),
    contact: normalizeState(candidate.contact),
  };
}

function emit(screen: LegalFocusScreen) {
  const nextState = cache[screen];
  listeners.get(screen)?.forEach((listener) => listener(nextState));
}

async function persist(next: LegalFocusStore) {
  cache = next;
  emit('privacy');
  emit('support');
  emit('contact');
  try {
    await setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // keep in-memory state even if persistence fails
  }
}

async function updateScreenState(
  screen: LegalFocusScreen,
  updater: (state: LegalFocusState) => LegalFocusState
) {
  const currentStore = await loadLegalFocusStore();
  const nextState = updater(currentStore[screen]);
  const nextStore: LegalFocusStore = {
    ...currentStore,
    [screen]: {
      selectedRouteKey: normalizeRouteKey(nextState.selectedRouteKey),
      historyKeys: normalizeHistoryKeys(nextState.historyKeys),
    },
  };
  await persist(nextStore);
  return nextStore[screen];
}

export async function loadLegalFocusStore() {
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    try {
      const raw = await getItem(STORAGE_KEY);
      cache = raw ? normalizeStore(JSON.parse(raw)) : createDefaultStore();
      emit('privacy');
      emit('support');
      emit('contact');
      return cache;
    } catch {
      cache = createDefaultStore();
      return cache;
    } finally {
      hydratePromise = null;
    }
  })();

  return hydratePromise;
}

export function getCachedLegalFocusState(screen: LegalFocusScreen) {
  return cache[screen];
}

export function subscribeLegalFocusState(screen: LegalFocusScreen, listener: (state: LegalFocusState) => void) {
  listeners.get(screen)?.add(listener);
  return () => listeners.get(screen)?.delete(listener);
}

export async function setLegalFocusRoute(screen: LegalFocusScreen, routeKey: string) {
  const safeRouteKey = normalizeRouteKey(routeKey);
  if (!safeRouteKey) return getCachedLegalFocusState(screen);

  return updateScreenState(screen, (state) => ({
    selectedRouteKey: safeRouteKey,
    historyKeys: [safeRouteKey, ...state.historyKeys.filter((key) => key !== safeRouteKey)].slice(0, MAX_HISTORY),
  }));
}

export async function clearLegalFocusRoute(screen: LegalFocusScreen) {
  return updateScreenState(screen, (state) => ({
    ...state,
    selectedRouteKey: null,
  }));
}

export async function removeLegalFocusHistoryRoute(screen: LegalFocusScreen, routeKey: string) {
  const safeRouteKey = normalizeRouteKey(routeKey);
  if (!safeRouteKey) return getCachedLegalFocusState(screen);

  return updateScreenState(screen, (state) => ({
    selectedRouteKey: state.selectedRouteKey === safeRouteKey ? null : state.selectedRouteKey,
    historyKeys: state.historyKeys.filter((key) => key !== safeRouteKey),
  }));
}

export async function clearLegalFocusHistory(screen: LegalFocusScreen) {
  return updateScreenState(screen, (state) => ({
    ...state,
    historyKeys: [],
  }));
}

export async function syncLegalFocusHistory(screen: LegalFocusScreen, validKeys: string[]) {
  const safeValidKeys = new Set(normalizeHistoryKeys(validKeys));

  return updateScreenState(screen, (state) => {
    const nextSelectedRouteKey =
      state.selectedRouteKey && safeValidKeys.has(state.selectedRouteKey) ? state.selectedRouteKey : null;

    return {
      selectedRouteKey: nextSelectedRouteKey,
      historyKeys: state.historyKeys.filter((key) => safeValidKeys.has(key)),
    };
  });
}
