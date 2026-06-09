export type ParsedReceiptLine = {
  name: string;
  quantity: number;
  unitPrice: number;
  costBucket: ReceiptCostBucket;
};

export type ReceiptCostBucket = 'food_cost' | 'bar_cost' | 'unknown';

const priceTokenRegex = /-?\d+(?:[,.]\d{1,2})?/g;

const barCostTerms = [
  'drank',
  'drink',
  'alcohol',
  'coffee',
  'koffie',
  'soda',
  'fris',
  'cola',
  'limonade',
  'beer',
  'bier',
  'wine',
  'wijn',
  'cocktail',
  'water',
  'bar',
  'tap',
  'tonic',
  'gin',
  'rum',
  'vodka',
  'whisky',
];

const foodCostTerms = [
  'food',
  'eten',
  'ingredient',
  'ingrediënt',
  'meal',
  'maaltijd',
  'kitchen',
  'keuken',
  'grocery',
  'groceries',
  'brood',
  'bread',
  'kip',
  'chicken',
  'vlees',
  'meat',
  'vis',
  'fish',
  'groente',
  'fruit',
  'salade',
  'kaas',
  'cheese',
  'pasta',
  'rijst',
  'rice',
  'sauce',
  'saus',
  'mayonaise',
  'mayonnaise',
  'mayo',
  'ketchup',
  'mosterd',
  'mustard',
  'dijon',
  'piccalilly',
  'pickle',
  'condiment',
  'olie',
  'oil',
];

export function classifyReceiptLineCost(name: string, category = ''): ReceiptCostBucket {
  const normalized = `${category} ${name}`.trim().toLowerCase();
  if (!normalized) {
    return 'unknown';
  }

  if (barCostTerms.some((term) => normalized.includes(term))) {
    return 'bar_cost';
  }

  if (foodCostTerms.some((term) => normalized.includes(term))) {
    return 'food_cost';
  }

  return 'unknown';
}

export function parseReceiptText(input: string): ParsedReceiptLine[] {
  if (!input.trim()) {
    return [];
  }

  const lines: ParsedReceiptLine[] = [];
  const rows = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  rows.forEach((raw) => {
    const lower = raw.toLowerCase();
    if (
      lower.includes('totaal') ||
      lower.includes('total') ||
      lower.includes('subtotaal') ||
      lower.includes('btw') ||
      lower.includes('vat') ||
      lower.includes('korting')
    ) {
      return;
    }

    let quantity = 1;
    let lineBody = raw;

    const qtyMatch = raw.match(/^(\d+)[xX]?\s+(.+)$/);
    if (qtyMatch) {
      quantity = Math.max(1, Number.parseInt(qtyMatch[1], 10));
      lineBody = qtyMatch[2];
    }

    const priceMatch = findLastPriceToken(lineBody);
    const unitPrice = priceMatch ? parsePrice(priceMatch[0]) : Number.NaN;
    if (Number.isFinite(unitPrice) && unitPrice < 0) {
      return; // sla negatieve bedragen/kortingen over
    }
    const name = removePriceToken(lineBody, priceMatch);

    if (!name) {
      return;
    }

    lines.push({
      name,
      quantity,
      unitPrice: Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : Number.NaN,
      costBucket: classifyReceiptLineCost(name),
    });
  });

  return lines;
}

function parsePrice(value: string) {
  const normalized = value.replace(',', '.').replace(/[^0-9.-]/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function findLastPriceToken(value: string) {
  const matches = Array.from(value.matchAll(priceTokenRegex));
  return matches[matches.length - 1] ?? null;
}

function removePriceToken(value: string, priceMatch: RegExpMatchArray | null) {
  if (!priceMatch || typeof priceMatch.index !== 'number') {
    return value.replace(/[€]/g, '').replace(/\beur\b/gi, '').trim();
  }

  const before = value.slice(0, priceMatch.index);
  const after = value.slice(priceMatch.index + priceMatch[0].length);
  return `${before}${after}`.replace(/[€]/g, '').replace(/\beur\b/gi, '').trim();
}
