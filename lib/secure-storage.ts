import { Platform } from 'react-native';

import { getItem, removeItem, setItem } from 'lib/app-storage';

type SecureStoreModule = typeof import('expo-secure-store');

let secureStorePromise: Promise<SecureStoreModule | null> | null = null;

async function getSecureStore(): Promise<SecureStoreModule | null> {
  if (Platform.OS === 'web') return null;
  if (!secureStorePromise) {
    secureStorePromise = import('expo-secure-store')
      .then((mod) => mod as SecureStoreModule)
      .catch(() => null);
  }
  return secureStorePromise;
}

const FALLBACK_PREFIX = 'secure-fallback:';

export async function secureGetItem(key: string): Promise<string | null> {
  const mod = await getSecureStore();
  if (mod) {
    try {
      return await mod.getItemAsync(key);
    } catch {
      // ignore
    }
  }

  return await getItem(`${FALLBACK_PREFIX}${key}`);
}

export async function secureSetItem(key: string, value: string): Promise<void> {
  const mod = await getSecureStore();
  if (mod) {
    try {
      await mod.setItemAsync(key, value, {
        keychainAccessible: mod.AFTER_FIRST_UNLOCK,
      });
      return;
    } catch {
      // ignore
    }
  }

  await setItem(`${FALLBACK_PREFIX}${key}`, value);
}

export async function secureRemoveItem(key: string): Promise<void> {
  const mod = await getSecureStore();
  if (mod) {
    try {
      await mod.deleteItemAsync(key);
      return;
    } catch {
      // ignore
    }
  }

  await removeItem(`${FALLBACK_PREFIX}${key}`);
}

