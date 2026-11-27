const mongoose = require('mongoose');
const OTP = require('../models/OTP');

/**
 * Database-backed OTP store — replaces the old JSON file-based otpStore.json.
 * All OTP data is stored in MongoDB with automatic TTL cleanup.
 */

async function getStoredOtp(key) {
  if (!key || mongoose.connection.readyState !== 1) return null;
  const k = String(key).trim().toLowerCase();

  try {
    const record = await OTP.findOne({ key: k });
    if (!record) return null;
    if (Date.now() > record.expiresAt) {
      // Expired — clean up
      await OTP.deleteOne({ _id: record._id });
      return null;
    }
    return record.toJSON();
  } catch (err) {
    console.error('[OTPStore] getStoredOtp error:', err.message);
    return null;
  }
}

async function setStoredOtp(key, data) {
  if (!key || mongoose.connection.readyState !== 1) return;
  const k = String(key).trim().toLowerCase();

  try {
    const existing = await getStoredOtp(k);
    const prevCodes = Array.isArray(existing?.recentCodes)
      ? existing.recentCodes
      : (existing?.code ? [existing.code] : []);
    const recentCodes = [data.code, ...prevCodes.filter((c) => c !== data.code)].slice(0, 5);

    await OTP.findOneAndUpdate(
      { key: k },
      {
        key: k,
        code: data.code,
        recentCodes,
        role: data.role || 'student',
        name: data.name || '',
        roll: data.roll || '',
        expiresAt: data.expiresAt
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error('[OTPStore] setStoredOtp error:', err.message);
  }
}

function isOtpMatch(record, cleanCode) {
  if (!record || Date.now() > record.expiresAt) return false;
  if (record.code === cleanCode) return true;
  if (Array.isArray(record.recentCodes) && record.recentCodes.includes(cleanCode)) return true;
  return false;
}

async function deleteOtp(key) {
  if (!key || mongoose.connection.readyState !== 1) return;
  const k = String(key).trim().toLowerCase();
  try {
    await OTP.deleteOne({ key: k });
  } catch (err) {
    console.error('[OTPStore] deleteOtp error:', err.message);
  }
}

module.exports = {
  getStoredOtp,
  setStoredOtp,
  isOtpMatch,
  deleteOtp
};
