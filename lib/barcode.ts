export type BarcodeLookupResult = {
  name: string;
  category: string;
  expiryDays: number | null;
  notes?: string;
  source?: string;
  confidence?: number;
};

const barcodeLookupCache = new Map<string, { result: BarcodeLookupResult | null; expiresAt: number }>();
const BARCODE_LOOKUP_TTL_MS = 6 * 60 * 60 * 1000;
const BARCODE_LOOKUP_MAX = 150;

function normalizeBarcodeValue(barcode: string) {
  return barcode.trim().replace(/\s+/g, '').replace(/[^0-9A-Za-z]/g, '');
}

function getCachedBarcodeLookup(barcode: string) {
  const now = Date.now();
  const entry = barcodeLookupCache.get(barcode);
  if (!entry) {
    return undefined;
  }
  if (entry.expiresAt <= now) {
    barcodeLookupCache.delete(barcode);
    return undefined;
  }
  return entry.result;
}

function setCachedBarcodeLookup(barcode: string, result: BarcodeLookupResult | null) {
  barcodeLookupCache.set(barcode, {
    result,
    expiresAt: Date.now() + BARCODE_LOOKUP_TTL_MS,
  });

  if (barcodeLookupCache.size > BARCODE_LOOKUP_MAX) {
    const oldest = barcodeLookupCache.keys().next().value as string | undefined;
    if (oldest) {
      barcodeLookupCache.delete(oldest);
    }
  }
}

function pickText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (trimmed) {
      return trimmed;
    }
  }
  return '';
}

function estimateExpiryDaysFromText(value: string) {
  const text = value.toLowerCase();

  if (
    text.includes('melk') ||
    text.includes('yoghurt') ||
    text.includes('kaas') ||
    text.includes('room') ||
    text.includes('boter') ||
    text.includes('zuivel')
  ) {
    return 5;
  }

  if (
    text.includes('brood') ||
    text.includes('bakker') ||
    text.includes('croissant') ||
    text.includes('brioche') ||
    text.includes('baguette') ||
    text.includes('gebak')
  ) {
    return 1;
  }

  if (
    text.includes('salade') ||
    text.includes('sla') ||
    text.includes('fruit') ||
    text.includes('groente') ||
    text.includes('groenten') ||
    text.includes('bessen') ||
    text.includes('vers')
  ) {
    return 3;
  }

  if (
    text.includes('vlees') ||
    text.includes('kip') ||
    text.includes('rund') ||
    text.includes('vis') ||
    text.includes('zalm') ||
    text.includes('tonijn')
  ) {
    return 2;
  }

  if (
    text.includes('drank') ||
    text.includes('water') ||
    text.includes('sap') ||
    text.includes('cola') ||
    text.includes('fris') ||
    text.includes('koffie') ||
    text.includes('thee')
  ) {
    return 7;
  }

  if (text.includes('diepvries') || text.includes('frozen') || text.includes('vries')) {
    return 30;
  }

  if (text.includes('pasta') || text.includes('rijst') || text.includes('droog') || text.includes('blik')) {
    return 90;
  }

  return 7;
}

function deriveCategoryFromProduct(text: string) {
  const value = text.toLowerCase();

  if (value.includes('zuivel') || value.includes('milk') || value.includes('yoghurt') || value.includes('cheese')) {
    return 'Zuivel';
  }
  if (value.includes('bakery') || value.includes('brood') || value.includes('bread') || value.includes('croissant')) {
    return 'Bakkerij';
  }
  if (value.includes('drank') || value.includes('drink') || value.includes('water') || value.includes('juice') || value.includes('cola')) {
    return 'Dranken';
  }
  if (value.includes('fruit') || value.includes('groente') || value.includes('vegetable') || value.includes('salade')) {
    return 'Groente & fruit';
  }
  if (value.includes('vlees') || value.includes('fish') || value.includes('kip') || value.includes('meat')) {
    return 'Vers';
  }
  if (value.includes('diepvries') || value.includes('frozen')) {
    return 'Diepvries';
  }
  if (value.includes('pasta') || value.includes('rijst') || value.includes('dry') || value.includes('blik')) {
    return 'Droogwaren';
  }

  return 'Algemeen';
}

async function lookupOpenFoodFactsBarcode(barcode: string): Promise<BarcodeLookupResult | null> {
  const normalized = normalizeBarcodeValue(barcode);
  if (!normalized || !/^\d{8,14}$/.test(normalized)) {
    return null;
  }

  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(normalized)}.json?fields=product_name,product_name_en,product_name_nl,generic_name,generic_name_en,generic_name_nl,brands,categories`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null);
    if (!payload || payload.status !== 1 || !payload.product) {
      return null;
    }

    const product = payload.product;
    const name = pickText(
      product.product_name_nl,
      product.product_name,
      product.product_name_en,
      product.generic_name_nl,
      product.generic_name,
      product.generic_name_en,
      product.brands
    );
    const categoryText = pickText(product.categories, product.product_name, product.generic_name, product.brands);
    const category = deriveCategoryFromProduct(categoryText || name || normalized);
    const expiryDays = estimateExpiryDaysFromText(`${name} ${categoryText}`);

    return {
      name: name || `Barcode ${normalized}`,
      category,
      expiryDays,
      notes: 'Barcode herkend via Open Food Facts.',
      source: 'open-food-facts',
      confidence: name ? 0.92 : 0.78,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function lookupBarcode(barcode: string): Promise<BarcodeLookupResult | null> {
  const trimmed = normalizeBarcodeValue(barcode);
  if (!trimmed) return null;

  const cachedLookup = getCachedBarcodeLookup(trimmed);
  if (cachedLookup !== undefined) {
    return cachedLookup;
  }

  // Production lookup only uses external/live sources here. Static catalog entries
  // must not appear as trusted recognition results on /scan.
  const external = await lookupOpenFoodFactsBarcode(trimmed);
  if (external) {
    setCachedBarcodeLookup(trimmed, external);
    return external;
  }

  setCachedBarcodeLookup(trimmed, null);
  return null;
}
