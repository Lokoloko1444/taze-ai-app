/**
 * Barcode recognition cache management.
 * Caches barcode lookup results with TTL to reduce API calls.
 */

const { RECOGNITION } = require('../../constants/config');

class BarcodeCache {
  constructor(maxSize = RECOGNITION.BARCODE_CACHE_MAX, ttlMs = require('../../constants/config').TIMEOUTS.BARCODE_CACHE_TTL_MS) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  /**
   * Get cached barcode recognition if not expired.
   * @param {string} barcode - Normalized barcode
   * @returns {object|undefined} Cached result or undefined if expired/missing
   */
  get(barcode) {
    const now = Date.now();
    const entry = this.cache.get(barcode);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= now) {
      this.cache.delete(barcode);
      return undefined;
    }

    return entry.result;
  }

  /**
   * Set cached barcode recognition with TTL.
   * Removes oldest entry if cache exceeds max size.
   * @param {string} barcode - Normalized barcode
   * @param {object} result - Recognition result to cache
   */
  set(barcode, result) {
    this.cache.set(barcode, {
      result,
      expiresAt: Date.now() + this.ttlMs,
    });

    if (this.cache.size > this.maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest) {
        this.cache.delete(oldest);
      }
    }
  }

  /**
   * Clear all cached entries.
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache statistics.
   * @returns {object} Cache stats
   */
  stats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
    };
  }
}

module.exports = BarcodeCache;
