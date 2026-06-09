type AsyncStorageLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

function isWebRuntime() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function getWebStorage() {
  if (!isWebRuntime()) return null;
  return window.localStorage;
}

let asyncStoragePromise: Promise<AsyncStorageLike | null> | null = null;

async function getAsyncStorage(): Promise<AsyncStorageLike | null> {
  if (isWebRuntime()) return null;
  if (!asyncStoragePromise) {
    asyncStoragePromise = import('@react-native-async-storage/async-storage')
      .then((mod) => (mod.default ?? mod) as unknown as AsyncStorageLike)
      .catch(() => null);
  }
  return asyncStoragePromise;
}

export function hasSyncWebStorage() {
  return Boolean(getWebStorage());
}

export function getItemSyncWeb(key: string): string | null {
  const storage = getWebStorage();
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export async function getItem(key: string): Promise<string | null> {
  const webStorage = getWebStorage();
  if (webStorage) {
    try {
      return webStorage.getItem(key);
    } catch {
      return null;
    }
  }

  const asyncStorage = await getAsyncStorage();
  if (!asyncStorage) return null;
  try {
    return await asyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  const webStorage = getWebStorage();
  if (webStorage) {
    try {
      webStorage.setItem(key, value);
    } catch {
      // ignore
    }
    return;
  }

  const asyncStorage = await getAsyncStorage();
  if (!asyncStorage) return;
  try {
    await asyncStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export async function removeItem(key: string): Promise<void> {
  const webStorage = getWebStorage();
  if (webStorage) {
    try {
      webStorage.removeItem(key);
    } catch {
      // ignore
    }
    return;
  }

  const asyncStorage = await getAsyncStorage();
  if (!asyncStorage) return;
  try {
    await asyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}
