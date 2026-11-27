const mongoose = require('mongoose');
const ActivityLog = require('../models/ActivityLog');

/**
 * Records an activity log entry in MongoDB.
 * Falls back gracefully if DB is disconnected.
 */
async function logActivity({ action, detail = '', userId = null, userName = 'System', ip = '127.0.0.1', userAgent = '', metadata = {} }) {
  if (mongoose.connection.readyState !== 1) {
    console.warn(`[ActivityLog] DB disconnected — skipped: ${action} | ${detail}`);
    return null;
  }

  try {
    const entry = await ActivityLog.create({
      userId,
      userName,
      action,
      detail,
      ip,
      userAgent,
      metadata
    });
    return entry;
  } catch (err) {
    console.error('[ActivityLog] Error recording activity:', err.message);
    return null;
  }
}

/**
 * Fetches activity logs with optional filters.
 */
async function getActivityLogs({ userId = null, limit = 50, action = null } = {}) {
  if (mongoose.connection.readyState !== 1) {
    return [];
  }

  try {
    const filter = {};
    if (userId) filter.userId = userId;
    if (action) filter.action = action;

    return await ActivityLog.find(filter).sort({ createdAt: -1 }).limit(limit);
  } catch (err) {
    console.error('[ActivityLog] Error fetching logs:', err.message);
    return [];
  }
}

module.exports = {
  logActivity,
  getActivityLogs
};
