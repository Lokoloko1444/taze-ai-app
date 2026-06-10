/**
 * Formatting utilities.
 * Handles currency, billing intervals, and text formatting for output.
 */

const { trimEnv } = require('./env');

/**
 * Format amount in minor currency units (cents) to localized string.
 * @param {number} amountMinor - Amount in cents (e.g., 1299 = €12.99)
 * @param {string} currency - Currency code (e.g., 'EUR', 'USD')
 * @returns {string} Formatted currency string
 */
function formatMinorCurrency(amountMinor, currency) {
  const amount = Number.isFinite(amountMinor) ? Number(amountMinor) / 100 : 0;
  const normalizedCurrency = String(currency || 'EUR').trim().toUpperCase() || 'EUR';

  try {
    return new Intl.NumberFormat('nl-BE', {
      style: 'currency',
      currency: normalizedCurrency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${normalizedCurrency}`;
  }
}

/**
 * Format billing interval to user-friendly label.
 * @param {string} interval - Billing interval (month, quarter, year)
 * @returns {string} Formatted label
 */
function formatBillingIntervalLabel(interval) {
  if (interval === 'month') return 'Maandelijks';
  if (interval === 'quarter') return 'Kwartaal';
  if (interval === 'year') return 'Jaarlijks';
  return interval;
}

/**
 * Escape HTML special characters for safe output in HTML content.
 * Prevents XSS by escaping: &, <, >, ", '
 * @param {string} value - Value to escape
 * @returns {string} HTML-escaped value
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Pick first non-empty trimmed value from list.
 * Useful for fallback chains: pick(nl, en, fallback)
 * @param {...string} values - Values to check in order
 * @returns {string} First non-empty trimmed value or empty string
 */
function pickText(...values) {
  for (const value of values) {
    const trimmed = trimEnv(value);
    if (trimmed) {
      return trimmed;
    }
  }
  return '';
}

module.exports = {
  formatMinorCurrency,
  formatBillingIntervalLabel,
  escapeHtml,
  pickText,
};
