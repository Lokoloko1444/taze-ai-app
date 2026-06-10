/**
 * Cryptographic utilities.
 * Handles secure token generation and hashing for approval flows.
 */

const crypto = require('crypto');

/**
 * Create a cryptographically secure random approval token.
 * Used for refund approval links and similar one-time operations.
 * @returns {string} 48-character hex token
 */
function createApprovalToken() {
  return crypto.randomBytes(24).toString('hex');
}

/**
 * Hash an approval token using SHA-256.
 * Used to store hashed tokens securely without storing plaintext.
 * @param {string} token - Token to hash
 * @returns {string} SHA-256 hex digest
 */
function hashApprovalToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

module.exports = {
  createApprovalToken,
  hashApprovalToken,
};
