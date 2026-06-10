/**
 * Input validation and normalization utilities.
 * Sanitizes, validates, and normalizes user input safely.
 */

const { trimEnv } = require('./env');

/**
 * Check if value is probably a valid email address.
 * Basic regex check; does not validate full RFC spec.
 * @param {string} value - Value to check
 * @returns {boolean} True if looks like an email
 */
function isProbablyEmail(value) {
  const trimmed = trimEnv(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(trimmed);
}

/**
 * Normalize search/query text.
 * Lowercases, trims, removes special chars, normalizes spaces.
 * @param {string} value - Text to normalize
 * @returns {string} Normalized text
 */
function normalizeSearchText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Normalize barcode value.
 * Removes spaces and special characters, keeps alphanumeric.
 * @param {string} value - Barcode to normalize
 * @returns {string} Normalized barcode
 */
function normalizeBarcodeValue(value) {
  return trimEnv(value)
    .replace(/\s+/g, '')
    .replace(/[^0-9A-Za-z]/g, '');
}

/**
 * Normalize web path/URL pathname.
 * Ensures leading slash, removes query/hash, removes double slashes.
 * @param {string} value - Path to normalize
 * @returns {string} Normalized path (always starts with /)
 */
function normalizeWebPath(value) {
  const rawValue = typeof value === 'string' ? value : '/';
  const withoutQuery = rawValue.split('?')[0].split('#')[0].trim();
  if (!withoutQuery) {
    return '/';
  }

  let normalized = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
  normalized = normalized.replace(/\/{2,}/g, '/');

  if (normalized.length > 1) {
    normalized = normalized.replace(/\/+$/g, '');
  }

  return normalized || '/';
}

/**
 * Normalize billing interval.
 * Validates and returns standard interval: month, quarter, or year.
 * @param {string} value - Billing interval value
 * @returns {string} Normalized interval or empty string if invalid
 */
function normalizeBillingInterval(value) {
  const normalized = trimEnv(value).toLowerCase();
  return normalized === 'month' || normalized === 'quarter' || normalized === 'year' ? normalized : '';
}

/**
 * Normalize question/prompt input.
 * Trims and returns empty string if falsy.
 * @param {string} question - Question to normalize
 * @returns {string} Trimmed question
 */
function normalizeQuestion(question) {
  return typeof question === 'string' ? question.trim() : '';
}

/**
 * Validate available actions array.
 * Filters to valid action objects with 'kind' and 'label' properties.
 * @param {array} availableActions - Actions to validate
 * @returns {array} Filtered valid actions
 */
function normalizeAvailableActions(availableActions) {
  return Array.isArray(availableActions)
    ? availableActions.filter((action) => action && typeof action.kind === 'string' && typeof action.label === 'string')
    : [];
}

/**
 * Check if origin is local development.
 * Matches localhost or 127.0.0.1 with optional port.
 * @param {string} origin - Origin to check
 * @returns {boolean} True if local development origin
 */
function isLocalDevelopmentOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

/**
 * Check if origin is Expo hosting domain.
 * Matches *.expo.app pattern.
 * @param {string} origin - Origin to check
 * @returns {boolean} True if Expo hosting origin
 */
function isExpoHostingOrigin(origin) {
  return /^https:\/\/[a-z0-9-]+(?:--[a-z0-9-]+)?\.expo\.app$/i.test(origin);
}

module.exports = {
  isProbablyEmail,
  normalizeSearchText,
  normalizeBarcodeValue,
  normalizeWebPath,
  normalizeBillingInterval,
  normalizeQuestion,
  normalizeAvailableActions,
  isLocalDevelopmentOrigin,
  isExpoHostingOrigin,
};
