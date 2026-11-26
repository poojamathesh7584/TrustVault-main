const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/**
 * Generate SHA-256 hex digest of a string or buffer
 */
function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate cryptographic hash for audit ledger entry
 */
function computeAuditHash({ index, at, action, detail, prevHash, fileHash }) {
  const payload = `${index}|${new Date(at).toISOString()}|${action}|${detail || ''}|${prevHash || ''}|${fileHash || ''}`;
  return sha256(payload);
}

/**
 * Hash password with bcrypt
 */
async function hashPassword(plainText) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainText, salt);
}

/**
 * Verify password with bcrypt
 */
async function comparePassword(plainText, hashed) {
  if (!plainText || !hashed) return false;
  return bcrypt.compare(plainText, hashed);
}

/**
 * Generate random hex token
 */
function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('hex');
}

module.exports = {
  sha256,
  computeAuditHash,
  hashPassword,
  comparePassword,
  randomToken
};

