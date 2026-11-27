const express = require('express');
const mongoose = require('mongoose');
const Share = require('../models/Share');
const Document = require('../models/Document');
const { authMiddleware } = require('../middleware/auth');
const { randomToken } = require('../lib/crypto');
const { recordAudit } = require('../lib/auditLedger');
const { logActivity } = require('../lib/activityLogger');

const router = express.Router();

// 1. GET /api/shares
router.get('/', authMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }
    const list = await Share.find({ userId: req.user._id }).sort({ createdAt: -1 });
    const formatted = list.map((s) => ({
      id: s._id.toString(),
      _id: s._id.toString(),
      title: s.title,
      recipient: s.recipient,
      token: s.token,
      views: s.views,
      maxViews: s.maxViews,
      status: s.status,
      expiresAt: s.expiresAt,
      createdAt: s.createdAt
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load shares.' });
  }
});

// 2. POST /api/shares
router.post('/', authMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }

    const { label, recipient, docId, views = 5, hours = 24, allowDownload = false } = req.body || {};
    let doc = null;
    if (docId && mongoose.isValidObjectId(docId)) {
      doc = await Document.findOne({ _id: docId, userId: req.user._id });
    }
    if (!doc) {
      doc = await Document.findOne({ userId: req.user._id, status: 'verified' });
    }
    if (!doc) {
      return res.status(400).json({ error: 'Document not found.' });
    }
    if (doc.status !== 'verified') {
      return res.status(400).json({ error: 'Only verified documents can be shared.' });
    }

    const safeViews = Math.min(Math.max(Number(views) || 5, 1), 100);
    const safeHours = Math.min(Math.max(Number(hours) || 24, 1), 720);
    const title = String(label || (doc ? doc.title : 'Verified Credential')).trim().substring(0, 120);
    const token = 'share_' + randomToken(16);
    const expiresAt = new Date(Date.now() + safeHours * 3600000);

    const share = await Share.create({
      userId: req.user._id,
      docId: doc ? doc._id : req.user._id,
      title,
      recipient: String(recipient || 'admission.cell@college.edu').trim().substring(0, 120),
      token,
      views: 0,
      maxViews: safeViews,
      allowDownload: Boolean(allowDownload),
      status: 'active',
      expiresAt
    });

    await recordAudit({
      action: 'SHARE_CREATE',
      detail: `Created time-limited share token (${title}) for ${share.recipient}`,
      userId: req.user._id,
      userName: req.user.name,
      ip: req.ip
    });

    await logActivity({
      action: 'SHARE_CREATE',
      detail: `Created share link (${title}) for ${share.recipient}`,
      userId: req.user._id,
      userName: req.user.name,
      ip: req.ip
    });

    res.json({ ok: true, share: { ...share.toJSON(), id: share._id.toString() } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create share link.' });
  }
});

// 3. DELETE /api/shares/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid share ID.' });
    }

    const share = await Share.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!share) return res.status(404).json({ error: 'Share link not found.' });

    await recordAudit({
      action: 'SHARE_REVOKE',
      detail: `Revoked external share link for ${share.recipient}`,
      userId: req.user._id,
      userName: req.user.name,
      ip: req.ip
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke share link.' });
  }
});

// 4. Public endpoints: GET /api/shares/public/:token & POST /api/shares/public/:token/view
router.get('/public/:token', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }

    const share = await Share.findOne({ token: req.params.token }).populate('userId', 'name');
    if (!share) {
      return res.status(404).json({ error: 'Share link invalid or expired.' });
    }

    if (share.expiresAt && new Date() > share.expiresAt && share.status === 'active') {
      share.status = 'expired';
      await share.save();
    }

    if (share.status !== 'active') {
      return res.status(410).json({ error: 'Share link has expired or been revoked.' });
    }

    res.json({
      title: share.title,
      owner: share.userId?.name || 'Student',
      status: share.status,
      recipient: share.recipient,
      viewsLeft: Math.max(0, share.maxViews - share.views),
      expiresAt: share.expiresAt
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load share link.' });
  }
});

router.post('/public/:token/view', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }

    const share = await Share.findOne({ token: req.params.token });
    if (!share || share.status !== 'active') {
      return res.status(404).json({ error: 'Share link unavailable.' });
    }

    if (share.expiresAt && new Date() > share.expiresAt) {
      share.status = 'expired';
      await share.save();
      return res.status(410).json({ error: 'Share link has expired.' });
    }

    share.views += 1;
    if (share.views >= share.maxViews) {
      share.status = 'expired';
    }
    await share.save();

    await recordAudit({
      action: 'SHARE_VIEW',
      detail: `External recipient accessed share link (${share.title})`,
      userId: share.userId,
      ip: req.ip
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record share view.' });
  }
});

module.exports = router;
