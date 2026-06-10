/**
 * Open Food Facts barcode lookup service.
 * Queries external API for product information by barcode.
 */

const { normalizeBarcodeValue } = require('../../utils/validation');
const { pickText } = require('../../utils/formatting');
const { deriveCategoryFromText, estimateExpiryDaysFromText } = require('../../constants/product-categories');

const OPENFOODFACTS_API = 'https://world.openfoodfacts.org/api/v2/product';
const OPENFOODFACTS_TIMEOUT_MS = 5000;

/**
 * Look up product by barcode using Open Food Facts API.
 * @param {string} barcode - Barcode to lookup
 * @returns {Promise<object|null>} Product metadata or null if not found
 */
async function lookupOpenFoodFactsBarcode(barcode) {
  const normalized = normalizeBarcodeValue(barcode);
  if (!normalized || !/^\d{8,14}$/.test(normalized)) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENFOODFACTS_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${OPENFOODFACTS_API}/${encodeURIComponent(normalized)}.json?fields=product_name,product_name_en,product_name_nl,generic_name,generic_name_en,generic_name_nl,brands,categories`,
      {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      }
    );

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
    const category = deriveCategoryFromText(categoryText || name || normalized);
    const expiryDays = estimateExpiryDaysFromText(`${name} ${categoryText}`);

    return {
      name: name || `Barcode ${normalized}`,
      category,
      quantity: 1,
      expiryDays,
      confidence: name ? 0.92 : 0.78,
      notes: 'Barcode herkend via Open Food Facts.',
      source: 'open-food-facts',
      barcode: normalized,
      batchCode: null,
      lotNumber: null,
      recallFlag: false,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  lookupOpenFoodFactsBarcode,
};
