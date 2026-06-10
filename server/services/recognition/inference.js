/**
 * Product recognition inference logic.
 * Infers product metadata from barcodes, images, and text patterns.
 */

const { BARCODE_PATTERNS } = require('../../constants/barcode-patterns');
const { deriveCategoryFromText, estimateExpiryDaysFromText } = require('../../constants/product-categories');
const { normalizeBarcodeValue } = require('../../utils/validation');
const { trimEnv, parseCsvEnv } = require('../../utils/env');

/**
 * Infer product metadata from barcode pattern prefix.
 * @param {string} barcode - Normalized barcode
 * @returns {object|null} Inferred metadata or null
 */
function inferFromBarcodePattern(barcode) {
  return BARCODE_PATTERNS.inferFromBarcode(barcode);
}

/**
 * Infer product metadata from image.
 * Returns generic fallback when AI recognition is unavailable.
 * @param {string} imageBase64 - Base64 encoded image
 * @returns {object} Generic product metadata
 */
function inferFromImage(imageBase64) {
  const size = imageBase64?.length ?? 0;

  return {
    name: 'Onbekend product',
    category: 'Controle nodig',
    quantity: 1,
    expiryDays: null,
    confidence: 0.35,
    notes: 'Geen live herkenning beschikbaar. Gebruik barcode, foto of handmatige invoer om het product te bepalen.',
    source: 'live-fallback',
  };
}

/**
 * Infer recognition when live AI is unavailable.
 * Uses barcode pattern matching and image fallback.
 * @param {object} input - Recognition input {barcode, imageBase64, imageUri, ocrText}
 * @returns {object} Inferred recognition result
 */
function inferRecognition(input, demoModeEnabled = false) {
  if (!demoModeEnabled) {
    return buildLiveUnknownRecognition(
      input,
      'Live herkenning is niet beschikbaar. Controleer api.taze.to/health en je backendconfig.'
    );
  }

  const barcode = input.barcode?.trim() || null;
  const barcodePatternMatch = barcode ? inferFromBarcodePattern(barcode) : null;
  const visualMatch = inferFromImage(input.imageBase64);

  if (barcode) {
    const mergedBase = barcodePatternMatch ?? visualMatch;
    const combinedConfidence = input.imageBase64
      ? Math.min(0.9, Math.max(mergedBase.confidence, visualMatch.confidence) + 0.08)
      : mergedBase.confidence;

    return {
      ...mergedBase,
      barcode,
      source: input.imageBase64 ? 'foto + barcode' : mergedBase.source,
      confidence: combinedConfidence,
      notes: input.imageBase64
        ? `Onbekende barcode ${barcode}. Barcode en foto samen geven deze inschatting. ${mergedBase.notes}`
        : `Onbekende barcode ${barcode}. ${mergedBase.notes}`,
      batchCode: null,
      lotNumber: null,
      recallFlag: false,
    };
  }

  return {
    ...visualMatch,
    barcode: null,
    batchCode: null,
    lotNumber: null,
    recallFlag: false,
  };
}

/**
 * Build unknown recognition response when live lookup fails.
 * @param {object} input - Recognition input
 * @param {string} reason - Why recognition failed
 * @returns {object} Unknown product metadata
 */
function buildLiveUnknownRecognition(input, reason) {
  const barcode = normalizeBarcodeValue(input.barcode);

  return {
    name: barcode ? `Onbekende barcode ${barcode}` : 'Onbekend product',
    category: 'Controle nodig',
    quantity: 1,
    expiryDays: null,
    confidence: 0.2,
    notes: reason || 'Live herkenning is niet beschikbaar.',
    source: barcode ? 'barcode-unknown' : 'live-unavailable',
    barcode: barcode || null,
    batchCode: null,
    lotNumber: null,
    recallFlag: false,
  };
}

/**
 * Normalize recognition data.
 * Validates and clamps values to safe ranges.
 * @param {object} data - Raw recognition data
 * @param {object} input - Original recognition input
 * @returns {object} Normalized recognition result
 */
function normalizeRecognition(data, input) {
  const fallback = inferRecognition(input);

  return {
    name: data.name ?? fallback.name,
    category: data.category ?? fallback.category,
    quantity: Math.max(1, Number(data.quantity ?? fallback.quantity ?? 1)),
    expiryDays: data.expiryDays ?? data.expiry ?? fallback.expiryDays ?? null,
    confidence: Math.min(0.99, Math.max(0.25, Number(data.confidence ?? fallback.confidence ?? 0.6))),
    notes: data.notes ?? fallback.notes,
    source: data.source ?? fallback.source,
    barcode: data.barcode ?? input.barcode ?? fallback.barcode,
    batchCode: data.batchCode ?? fallback.batchCode ?? null,
    lotNumber: data.lotNumber ?? fallback.lotNumber ?? null,
    recallFlag: data.recallFlag ?? fallback.recallFlag ?? false,
  };
}

/**
 * Coerce seed data from API input into valid recognition object.
 * @param {object} seed - Seed data from request
 * @param {object} input - Recognition input
 * @returns {object|null} Normalized recognition or null
 */
function coerceRecognitionSeed(seed, input) {
  if (!seed || typeof seed !== 'object') {
    return null;
  }

  const payload = {};

  if (typeof seed.name === 'string' && seed.name.trim()) payload.name = seed.name.trim();
  if (typeof seed.category === 'string' && seed.category.trim()) payload.category = seed.category.trim();
  if (seed.quantity !== undefined && Number.isFinite(Number(seed.quantity))) payload.quantity = Number(seed.quantity);
  if (seed.expiryDays !== undefined) payload.expiryDays = seed.expiryDays;
  if (seed.expiry !== undefined) payload.expiry = seed.expiry;
  if (seed.confidence !== undefined && Number.isFinite(Number(seed.confidence))) {
    payload.confidence = Number(seed.confidence);
  }
  if (typeof seed.notes === 'string' && seed.notes.trim()) payload.notes = seed.notes.trim();
  if (typeof seed.source === 'string' && seed.source.trim()) payload.source = seed.source.trim();
  if (typeof seed.barcode === 'string' && seed.barcode.trim()) payload.barcode = seed.barcode.trim();
  if (typeof seed.batchCode === 'string' && seed.batchCode.trim()) payload.batchCode = seed.batchCode.trim();
  if (typeof seed.lotNumber === 'string' && seed.lotNumber.trim()) payload.lotNumber = seed.lotNumber.trim();
  if (typeof seed.recallFlag === 'boolean') payload.recallFlag = seed.recallFlag;

  if (Object.keys(payload).length === 0) {
    return null;
  }

  return normalizeRecognition(payload, input);
}

module.exports = {
  inferFromBarcodePattern,
  inferFromImage,
  inferRecognition,
  buildLiveUnknownRecognition,
  normalizeRecognition,
  coerceRecognitionSeed,
};
