import { getItem, getItemSyncWeb, hasSyncWebStorage, setItem } from 'lib/app-storage';

export const FREE_SCAN_LIMIT = 15;
const SCAN_ACCESS_STORAGE_KEY = 'taze-scan-access-v1';

export type ScanAccessState = {
  freeScansUsed: number;
  unlocked: boolean;
  updatedAt: string;
  lastScanAt: string | null;
};

export type ScanAccessSummary = {
  freeScansUsed: number;
  freeScansLeft: number;
  unlocked: boolean;
  isLocked: boolean;
  updatedAt: string;
  lastScanAt: string | null;
};

function createDefaultScanAccessState(): ScanAccessState {
  return {
    freeScansUsed: 0,
    unlocked: false,
    updatedAt: new Date().toISOString(),
    lastScanAt: null,
  };
}

function parseScanAccessState(value: string | null): ScanAccessState {
  if (!value) return createDefaultScanAccessState();

  try {
    const parsed = JSON.parse(value) as Partial<ScanAccessState>;
    const freeScansUsed = Number(parsed.freeScansUsed ?? 0);
    const unlocked = Boolean(parsed.unlocked);
    const updatedAt = typeof parsed.updatedAt === 'string' && parsed.updatedAt ? parsed.updatedAt : new Date().toISOString();
    const lastScanAt = typeof parsed.lastScanAt === 'string' && parsed.lastScanAt ? parsed.lastScanAt : null;

    return {
      freeScansUsed: Number.isFinite(freeScansUsed) ? Math.max(0, Math.min(FREE_SCAN_LIMIT, Math.floor(freeScansUsed))) : 0,
      unlocked,
      updatedAt,
      lastScanAt,
    };
  } catch {
    return createDefaultScanAccessState();
  }
}

function getStoredScanAccessStateSync() {
  if (!hasSyncWebStorage()) return createDefaultScanAccessState();
  return parseScanAccessState(getItemSyncWeb(SCAN_ACCESS_STORAGE_KEY));
}

async function saveScanAccessState(state: ScanAccessState) {
  await setItem(SCAN_ACCESS_STORAGE_KEY, JSON.stringify(state));
}

export function getScanAccessSummary(state: ScanAccessState | null | undefined): ScanAccessSummary {
  const nextState = state ?? createDefaultScanAccessState();
  const freeScansUsed = nextState.unlocked ? FREE_SCAN_LIMIT : Math.max(0, Math.min(FREE_SCAN_LIMIT, nextState.freeScansUsed));
  const freeScansLeft = nextState.unlocked ? 0 : Math.max(0, FREE_SCAN_LIMIT - freeScansUsed);

  return {
    freeScansUsed,
    freeScansLeft,
    unlocked: nextState.unlocked,
    isLocked: !nextState.unlocked && freeScansLeft === 0,
    updatedAt: nextState.updatedAt,
    lastScanAt: nextState.lastScanAt,
  };
}

export async function loadScanAccessState() {
  if (hasSyncWebStorage()) {
    return getStoredScanAccessStateSync();
  }

  const raw = await getItem(SCAN_ACCESS_STORAGE_KEY);
  return parseScanAccessState(raw);
}

export async function recordScanAccessUsage(previousState?: ScanAccessState | null) {
  const currentState = previousState ?? (await loadScanAccessState());
  const summary = getScanAccessSummary(currentState);

  if (summary.unlocked) {
    return currentState;
  }

  const nextState: ScanAccessState = {
    freeScansUsed: Math.min(FREE_SCAN_LIMIT, summary.freeScansUsed + 1),
    unlocked: false,
    updatedAt: new Date().toISOString(),
    lastScanAt: new Date().toISOString(),
  };

  await saveScanAccessState(nextState);
  return nextState;
}

export async function unlockScanAccess() {
  const nextState: ScanAccessState = {
    freeScansUsed: FREE_SCAN_LIMIT,
    unlocked: true,
    updatedAt: new Date().toISOString(),
    lastScanAt: new Date().toISOString(),
  };

  await saveScanAccessState(nextState);
  return nextState;
}

