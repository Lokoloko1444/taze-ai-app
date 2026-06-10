/**
 * Environment variable utilities.
 * Handles reading, parsing, and validating environment variables safely.
 */

const { RUNTIME_ENV_KEYS } = require('../constants/config');

/**
 * Trim and safely extract string environment variable.
 * @param {string|undefined} value - Raw environment variable value
 * @returns {string} Trimmed string or empty string
 */
function trimEnv(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Parse comma-separated environment variable into array.
 * @param {string|undefined} value - CSV value
 * @returns {string[]} Array of trimmed, non-empty values
 */
function parseCsvEnv(value) {
  return trimEnv(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Check if environment variable is truthy.
 * Accepts: '1', 'true', 'yes', 'on' (case-insensitive)
 * @param {string|undefined} value - Value to check
 * @returns {boolean} True if value is considered truthy
 */
function isTruthyEnv(value) {
  const normalized = trimEnv(value).toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

/**
 * Apply runtime environment variables to process.env.
 * Only sets keys that are explicitly allowed (whitelist).
 * @param {object} env - Environment object to apply
 */
function applyRuntimeEnv(env) {
  if (!env || typeof env !== 'object') {
    return;
  }

  const keys = new Set([
    ...Object.keys(env),
    ...Reflect.ownKeys(env).filter((key) => typeof key === 'string'),
    ...RUNTIME_ENV_KEYS,
  ]);

  for (const key of keys) {
    const value = env[key];
    if (typeof value === 'string') {
      process.env[key] = value;
    }
  }
}

/**
 * Get environment variable with trimming.
 * @param {string} key - Environment variable key
 * @param {string} [defaultValue] - Default value if not found
 * @returns {string} Trimmed value or default
 */
function getEnv(key, defaultValue = '') {
  return trimEnv(process.env[key] || defaultValue);
}

/**
 * Get integer environment variable.
 * @param {string} key - Environment variable key
 * @param {number} [defaultValue] - Default if not found or invalid
 * @returns {number} Parsed integer or default
 */
function getIntEnv(key, defaultValue = 0) {
  const value = trimEnv(process.env[key]);
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

/**
 * Normalize string to uppercase key format.
 * Useful for environment variable key matching.
 * @param {string} value - Value to normalize
 * @returns {string} Uppercase with underscores, trimmed edges
 */
function normalizeKey(value) {
  return trimEnv(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

module.exports = {
  trimEnv,
  parseCsvEnv,
  isTruthyEnv,
  applyRuntimeEnv,
  getEnv,
  getIntEnv,
  normalizeKey,
};
