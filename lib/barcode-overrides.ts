import { getItem, removeItem, setItem } from 'lib/app-storage';

export type BarcodeOverride = {
  name: string;
  category: string;
  expiryDays: number | null;
  updatedAt: string;
};

const STORAGE_KEY = 'barcode-overrides-v1';

let cache: Record<string, BarcodeOverride> | null = null;
let loadPromise: Promise<Record<string, BarcodeOverride>> | null = null;

function normalizeBarcode(raw: string) {
  return raw.trim();
}

async function loadAll(): Promise<Record<string, BarcodeOverride>> {
  if (cache) return cache;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const raw = await getItem(STORAGE_KEY);
    if (!raw) {
      cache = {};
      return cache;
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, Partial<BarcodeOverride>>;
      const normalized: Record<string, BarcodeOverride> = {};

      Object.entries(parsed ?? {}).forEach(([barcode, value]) => {
        if (!value || typeof value !== 'object') return;
        const name = typeof value.name === 'string' ? value.name : '';
        const category = typeof value.category === 'string' ? value.category : '';
        if (!name.trim() || !category.trim()) return;

        const expiryDays = typeof value.expiryDays === 'number' && Number.isFinite(value.expiryDays) ? value.expiryDays : null;
        const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString();

        normalized[normalizeBarcode(barcode)] = {
          name: name.trim(),
          category: category.trim(),
          expiryDays,
          updatedAt,
        };
      });

      cache = normalized;
      return normalized;
    } catch {
      cache = {};
      return cache;
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

export async function getBarcodeOverride(barcode: string): Promise<BarcodeOverride | null> {
  const normalizedBarcode = normalizeBarcode(barcode);
  if (!normalizedBarcode) return null;
  const all = await loadAll();
  return all[normalizedBarcode] ?? null;
}

export async function setBarcodeOverride(barcode: string, override: Omit<BarcodeOverride, 'updatedAt'> & { updatedAt?: string }) {
  const normalizedBarcode = normalizeBarcode(barcode);
  if (!normalizedBarcode) return;

  const all = await loadAll();
  all[normalizedBarcode] = {
    name: override.name.trim(),
    category: override.category.trim(),
    expiryDays: typeof override.expiryDays === 'number' && Number.isFinite(override.expiryDays) ? override.expiryDays : null,
    updatedAt: override.updatedAt ?? new Date().toISOString(),
  };
  cache = all;
  await setItem(STORAGE_KEY, JSON.stringify(all));
}

export async function listBarcodeOverrides(): Promise<Array<{ barcode: string; override: BarcodeOverride }>> {
  const all = await loadAll();
  return Object.entries(all)
    .map(([barcode, override]) => ({ barcode, override }))
    .sort((a, b) => new Date(b.override.updatedAt).getTime() - new Date(a.override.updatedAt).getTime());
}

export async function clearBarcodeOverrides() {
  cache = {};
  await removeItem(STORAGE_KEY);
}

