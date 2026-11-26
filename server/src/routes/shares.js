const express = require('express');
const Share = require('../models/Share');
const Document = require('../models/Document');
const { authMiddleware } = require('../middleware/auth');
const { randomToken } = require('../lib/crypto');
const { recordAudit } = require('../lib/auditLedger');

const router = express.Router();

// 1. GET /api/shares
router.get('/', authMiddleware, async (req, res) => {
  try {
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
    res.status(500).json({ error: err.message });
  }
});

// 2. POST /api/shares
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { label, recipient, docId, views = 5, hours = 24, allowDownload = false } = req.body || {};
    let doc = null;
    if (docId && docId.match(/^[0-9a-fA-F]{24}$/)) {
      doc = await Document.findById(docId);
    }
    if (!doc) {
      doc = await Document.findOne({ userId: req.user._id });
    }

    const title = label || (doc ? doc.title : 'Verified Credential');
    const token = 'share_' + randomToken(6);
    const expiresAt = new Date(Date.now() + hours * 3600000);

    const share = await Share.create({
      userId: req.user._id,
      docId: doc ? doc._id : req.user._id,
      title,
      recipient: recipient || 'admission.cell@college.edu',
      token,
      views: 0,
      maxViews: views,
      allowDownload,
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

    res.json({ ok: true, share: { ...share.toJSON(), id: share._id.toString() } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. DELETE /api/shares/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
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
    res.status(500).json({ error: err.message });
  }
});

// 4. Public endpoints: GET /api/shares/public/:token & POST /api/shares/public/:token/view
router.get('/public/:token', async (req, res) => {
  try {
    const share = await Share.findOne({ token: req.params.token }).populate('userId', 'name');
    if (!share) {
      return res.status(404).json({ error: 'Share link invalid or expired.' });
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
    res.status(500).json({ error: err.message });
  }
});

router.post('/public/:token/view', async (req, res) => {
  try {
    const share = await Share.findOne({ token: req.params.token });
    if (!share || share.status !== 'active') {
      return res.status(404).json({ error: 'Share link unavailable.' });
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
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

