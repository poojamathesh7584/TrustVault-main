const mongoose = require('mongoose');
const Audit = require('../models/Audit');
const { computeAuditHash } = require('./crypto');

const GENESIS_PREV_HASH = '0'.repeat(64);

async function recordAudit({ action, detail, userId, userName, fileHash = '', ip = '127.0.0.1' }) {
  if (mongoose.connection.readyState !== 1) {
    return { action, detail, at: new Date() };
  }
  try {
    const lastBlock = await Audit.findOne().sort({ index: -1 });

    const index = lastBlock ? lastBlock.index + 1 : 0;
    const prevHash = lastBlock ? lastBlock.hash : GENESIS_PREV_HASH;
    const at = new Date();

    const hash = computeAuditHash({
      index,
      at,
      action,
      detail,
      prevHash,
      fileHash
    });

    const entry = await Audit.create({
      index,
      at,
      action,
      detail,
      userId,
      userName: userName || 'System',
      fileHash,
      prevHash,
      hash,
      ip
    });

    return entry;
  } catch (err) {
    console.error('Audit ledger record error:', err.message);
    return null;
  }
}

async function verifyLedgerIntegrity() {
  const blocks = await Audit.find().sort({ index: 1 });
  if (blocks.length === 0) {
    return { valid: true, count: 0, message: 'Ledger is empty.' };
  }

  for (let i = 0; i < blocks.length; i++) {
    const curr = blocks[i];
    const expectedPrev = i === 0 ? GENESIS_PREV_HASH : blocks[i - 1].hash;

    if (curr.prevHash !== expectedPrev) {
      return {
        valid: false,
        brokenIndex: curr.index,
        reason: `Previous hash mismatch at index ${curr.index}`
      };
    }

    const recomputed = computeAuditHash({
      index: curr.index,
      at: curr.at,
      action: curr.action,
      detail: curr.detail,
      prevHash: curr.prevHash,
      fileHash: curr.fileHash
    });

    if (recomputed !== curr.hash) {
      return {
        valid: false,
        brokenIndex: curr.index,
        reason: `Cryptographic digest mismatch at index ${curr.index}`
      };
    }
  }

  return {
    valid: true,
    count: blocks.length,
    latestHash: blocks[blocks.length - 1].hash,
    message: `All ${blocks.length} audit ledger blocks verified cryptographically intact.`
  };
}

module.exports = {
  recordAudit,
  verifyLedgerIntegrity,
  GENESIS_PREV_HASH
};

