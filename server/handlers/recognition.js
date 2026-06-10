/**
 * Product recognition request handler.
 * Main endpoint for barcode scanning, image recognition, and product lookup.
 */

const { trimEnv } = require('../../utils/env');
const {
  normalizeBarcodeValue,
  normalizeQuestion,
  normalizeAvailableActions,
} = require('../../utils/validation');
const { RECOGNITION } = require('../../constants/config');
const {
  normalizeRecognition,
  coerceRecognitionSeed,
  inferRecognition,
} = require('../../services/recognition/inference');
const { lookupOpenFoodFactsBarcode } = require('../../services/recognition/openfoodfacts');
const BarcodeCache = require('../../services/recognition/cache');

const barcodeCache = new BarcodeCache();

/**
 * Build recognition response object.
 * @param {object} normalized - Normalized recognition result
 * @param {string} method - Recognition method used (barcode, vision, etc)
 * @param {object} input - Original input
 * @param {string} [reasonOverride] - Override reason text
 * @returns {object} API response
 */
function buildRecognizeResponse(normalized, method, input, reasonOverride) {
  const barcodeProduct = findProductByBarcode(normalized.barcode || input.barcode || '');
  const productId = barcodeProduct?.id ?? null;
  const productName = barcodeProduct?.name ?? normalized.name ?? null;
  const label = normalized.name || normalized.category || 'Onbekend product';
  const confidence = Number.isFinite(Number(normalized.confidence)) ? Number(normalized.confidence) : 0;
  const candidates = findProductCandidates(`${normalized.name || ''} ${normalized.category || ''} ${input.ocrText || ''}`);
  const reason = reasonOverride || normalized.notes || (confidence >= 0.7 ? 'Herkenning afgerond' : 'Onzeker resultaat');
  const ok = Boolean(productId) || confidence >= 0.65;

  const response = {
    ok,
    method,
    label,
    productId,
    productName,
    confidence,
    candidates,
    reason,
    result: {
      ...normalized,
      barcode: normalized.barcode ?? input.barcode ?? null,
    },
  };

  console.log(`Recognition: method=${method}, confidence=${confidence.toFixed(2)}, candidates=${candidates.length}, reason=${reason}, ok=${ok}`);
  return response;
}

/**
 * Find product by barcode from product database.
 * @param {string} barcode - Barcode to search
 * @returns {object|null} Product or null
 */
function findProductByBarcode(barcode) {
  if (!barcode) return null;
  const { SERVER_PRODUCTS } = require('../../../lib/products-server');
  const normalizedBarcode = normalizeBarcodeValue(barcode);
  return SERVER_PRODUCTS.find((product) => product.barcode === normalizedBarcode) || null;
}

/**
 * Find product candidates by search text.
 * @param {string} text - Search text
 * @returns {array} Top 3 candidates with scores
 */
function findProductCandidates(text) {
  const { normalizeSearchText } = require('../../utils/validation');
  const { SERVER_PRODUCTS } = require('../../../lib/products-server');
  const normalizedText = normalizeSearchText(text);
  if (!normalizedText) return [];

  const terms = normalizedText.split(' ').filter(Boolean);
  return SERVER_PRODUCTS.map((product) => {
    const name = normalizeSearchText(product.name);
    const category = normalizeSearchText(product.category);
    let score = 0;

    for (const term of terms) {
      if (name.includes(term)) score += 2;
      if (category.includes(term)) score += 1;
    }

    return { product, score };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.product.confidence - a.product.confidence)
    .slice(0, 3)
    .map(({ product, score }) => ({
      productId: product.id,
      productName: product.name,
      confidence: Math.min(0.98, Math.max(0.35, score / 4)),
      reason: `Match op ${product.category}`,
    }));
}

/**
 * Send error response for recognition failures.
 * @param {object} res - Express response
 * @param {number} status - HTTP status code
 * @param {string} error - Error code
 * @param {string} message - Error message
 * @param {object} [details] - Additional details
 */
function sendRecognitionUnavailable(res, status, error, message, details = {}) {
  return res.status(status).json({
    ok: false,
    error,
    message,
    ...details,
  });
}

/**
 * Rate limit check for recognition requests.
 * @param {string} userId - User ID
 * @param {string} companyId - Company ID
 * @returns {boolean} True if allowed
 */
function checkRecognitionRateLimit(userId) {
  // TODO: Implement rate limiting with per-user tracking
  return true;
}

/**
 * Handle POST /recognize endpoint.
 * Main product recognition endpoint.
 * @param {object} req - Express request
 * @param {object} res - Express response
 */
async function handleRecognizeRequest(req, res) {
  const body = req.body ?? {};
  const rawBarcode = typeof body.barcode === 'string' ? body.barcode : '';
  const rawImageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : '';
  const rawImageUri = typeof body.imageUri === 'string' ? body.imageUri : '';
  const rawOcrText = typeof body.ocrText === 'string' ? body.ocrText : '';

  // Validate input sizes
  if (rawBarcode.length > RECOGNITION.MAX_BARCODE_LENGTH) {
    return res.status(400).json({ ok: false, error: 'barcode_too_long' });
  }

  if (rawImageUri.length > RECOGNITION.MAX_IMAGE_URI_LENGTH) {
    return res.status(400).json({ ok: false, error: 'image_uri_too_long' });
  }

  if (rawImageBase64.length > RECOGNITION.MAX_IMAGE_BASE64_LENGTH) {
    return res.status(400).json({ ok: false, error: 'image_base64_too_long' });
  }

  // TODO: Add authentication check
  // TODO: Add rate limit check
  // TODO: Add AI kill switch check

  if (!rawBarcode && !rawImageBase64 && !rawImageUri) {
    return res.status(400).json({ ok: false, error: 'recognition_input_missing' });
  }

  const input = {
    barcode: rawBarcode,
    imageBase64: rawImageBase64,
    imageUri: rawImageUri,
    ocrText: rawOcrText,
  };

  const inputSeed = coerceRecognitionSeed(body.catalogSeed, input);
  const barcode = normalizeBarcodeValue(input.barcode);
  const cachedBarcode = barcode ? barcodeCache.get(barcode) : undefined;

  // Return cached result if available
  if (cachedBarcode !== undefined) {
    return res.json(buildRecognizeResponse(cachedBarcode, cachedBarcode?.source || 'barcode', input));
  }

  // Try to find in local known barcodes or external lookup
  let seed = inputSeed;

  if (barcode && !seed) {
    // Check local database
    const { KNOWN_BARCODES } = require('../../../lib/products-server');
    const localMatch = KNOWN_BARCODES[barcode];
    if (localMatch) {
      seed = normalizeRecognition(localMatch, input);
    }
  }

  // Try Open Food Facts lookup
  if (barcode && !seed && !input.imageBase64 && !input.imageUri) {
    const external = await lookupOpenFoodFactsBarcode(barcode);
    if (external) {
      const normalized = normalizeRecognition(external, input);
      barcodeCache.set(barcode, normalized);
      return res.json(buildRecognizeResponse(normalized, 'barcode', input));
    }
  }

  // If still no seed and we have image, would use OpenAI here (TODO)
  // For now, use fallback inference
  if (!seed) {
    seed = normalizeRecognition(inferRecognition(input, false), input);
  }

  if (barcode) {
    barcodeCache.set(barcode, seed);
  }

  return res.json(buildRecognizeResponse(seed, 'barcode', input));
}

module.exports = {
  handleRecognizeRequest,
  buildRecognizeResponse,
  findProductByBarcode,
  findProductCandidates,
};
