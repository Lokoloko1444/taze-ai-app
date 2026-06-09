import { secureGetItem, secureSetItem } from 'lib/secure-storage';

export type SecuritySettings = {
  appLockEnabled: boolean;
  preventScreenCapture: boolean;
  unlockTtlMs: number;
};

export type BeveiligingSettings = SecuritySettings;

const STORAGE_KEY = 'security-settings-v1';

export const defaultSecuritySettings: SecuritySettings = {
  appLockEnabled: process.env.NODE_ENV === 'production',
  preventScreenCapture: process.env.NODE_ENV === 'production',
  unlockTtlMs: 5 * 60 * 1000,
};

export const defaultBeveiligingSettings = defaultSecuritySettings;

let cached: SecuritySettings = defaultSecuritySettings;
let hydratePromise: Promise<SecuritySettings> | null = null;
const listeners = new Set<(next: SecuritySettings) => void>();

function emit(next: SecuritySettings) {
  listeners.forEach((listener) => listener(next));
}

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export async function loadSecuritySettings(): Promise<SecuritySettings> {
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    try {
      const raw = await secureGetItem(STORAGE_KEY);
      if (!raw) return cached;
      const parsed = JSON.parse(raw) as Partial<SecuritySettings>;
      cached = {
        appLockEnabled: typeof parsed.appLockEnabled === 'boolean' ? parsed.appLockEnabled : defaultSecuritySettings.appLockEnabled,
        preventScreenCapture:
          typeof parsed.preventScreenCapture === 'boolean'
            ? parsed.preventScreenCapture
            : defaultSecuritySettings.preventScreenCapture,
        unlockTtlMs: clampInt(Number(parsed.unlockTtlMs ?? defaultSecuritySettings.unlockTtlMs), 10_000, 6 * 60 * 60 * 1000),
      };
      emit(cached);
      return cached;
    } catch {
      return cached;
    } finally {
      hydratePromise = null;
    }
  })();

  return hydratePromise;
}

export const loadBeveiligingSettings = loadSecuritySettings;

export function getCachedSecuritySettings() {
  return cached;
}

export async function saveSecuritySettings(next: SecuritySettings) {
  cached = next;
  await secureSetItem(STORAGE_KEY, JSON.stringify(next));
  emit(cached);
}

export const saveBeveiligingSettings = saveSecuritySettings;

export function subscribeSecuritySettings(listener: (next: SecuritySettings) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
