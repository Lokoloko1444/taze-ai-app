import { AppState, type AppStateStatus, Platform } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { loadSecuritySettings, subscribeSecuritySettings, type SecuritySettings } from 'lib/security-settings';

type AuthResult = {
  ok: boolean;
  reason?: string;
};

async function authenticate(): Promise<AuthResult> {
  if (Platform.OS === 'web') {
    return { ok: true };
  }

  try {
    const LocalAuth = await import('expo-local-authentication');
    const hasHardware = await LocalAuth.hasHardwareAsync().catch(() => false);
    const isEnrolled = await LocalAuth.isEnrolledAsync().catch(() => false);
    if (!hasHardware || !isEnrolled) {
      return { ok: false, reason: 'Biometrie niet beschikbaar of niet ingesteld.' };
    }

    const result = await LocalAuth.authenticateAsync({
      promptMessage: 'App ontgrendelen',
      cancelLabel: 'Annuleer',
      disableDeviceFallback: false,
      requireConfirmation: false,
    });

    return { ok: Boolean(result.success) };
  } catch {
    return { ok: false, reason: 'Authenticatie mislukt.' };
  }
}

async function setScreenCaptureBlocked(blocked: boolean) {
  if (Platform.OS === 'web') return;
  try {
    const ScreenCapture = await import('expo-screen-capture');
    if (blocked) {
      await ScreenCapture.preventScreenCaptureAsync();
    } else {
      await ScreenCapture.allowScreenCaptureAsync();
    }
  } catch {
    // ignore
  }
}

export function useSecurityGuard() {
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const lastUnlockAtRef = useRef<number>(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    let cancelled = false;
    loadSecuritySettings()
      .then((value) => {
        if (cancelled) return;
        setSettings(value);
      })
      .catch(() => {
        if (cancelled) return;
        setSettings(null);
      });
    const unsub = subscribeSecuritySettings((next) => setSettings(next));
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!settings) return;
    setScreenCaptureBlocked(settings.preventScreenCapture).catch(() => {});
  }, [settings]);

  const shouldRequireUnlock = useCallback(() => {
    if (Platform.OS === 'web') return false;
    if (!settings?.appLockEnabled) return false;
    const now = Date.now();
    const ttl = settings.unlockTtlMs;
    return now - lastUnlockAtRef.current > ttl;
  }, [settings]);

  const lockIfNeeded = useCallback(() => {
    if (Platform.OS === 'web') {
      setLastError(null);
      setLocked(false);
      return;
    }

    if (!settings?.appLockEnabled) {
      setLastError(null);
      setLocked(false);
      return;
    }

    if (shouldRequireUnlock()) {
      setLocked(true);
    }
  }, [settings, shouldRequireUnlock]);

  useEffect(() => {
    lockIfNeeded();
  }, [lockIfNeeded]);

  useEffect(() => {
    if (!settings?.appLockEnabled) return;

    const sub = AppState.addEventListener('change', (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (prev.match(/inactive|background/) && next === 'active') {
        lockIfNeeded();
      }
    });
    return () => sub.remove();
  }, [lockIfNeeded, settings?.appLockEnabled]);

  const unlock = useCallback(async () => {
    if (Platform.OS === 'web') {
      lastUnlockAtRef.current = Date.now();
      setLastError(null);
      setLocked(false);
      return;
    }

    if (!settings?.appLockEnabled) {
      setLocked(false);
      return;
    }
    setBusy(true);
    setLastError(null);
    try {
      const result = await authenticate();
      if (!result.ok) {
        setLastError(result.reason ?? 'Ontgrendelen mislukt.');
        setLocked(true);
        return;
      }
      lastUnlockAtRef.current = Date.now();
      setLocked(false);
    } finally {
      setBusy(false);
    }
  }, [settings?.appLockEnabled]);

  const state = useMemo(
    () => ({
      ready: settings !== null,
      locked,
      busy,
      lastError,
      settings,
      unlock,
    }),
    [busy, lastError, locked, settings, unlock]
  );

  return state;
}
