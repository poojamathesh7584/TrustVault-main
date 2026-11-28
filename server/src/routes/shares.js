const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const config = require('../config');
const Share = require('../models/Share');
const Document = require('../models/Document');
const { authMiddleware } = require('../middleware/auth');
const { randomToken } = require('../lib/crypto');
const { recordAudit } = require('../lib/auditLedger');
const { logActivity } = require('../lib/activityLogger');
const { validateEmailAddress, sendShareLinkEmail, sendOtpEmail } = require('../lib/mailer');
const { getStoredOtp, setStoredOtp, isOtpMatch, deleteOtp } = require('../lib/otpStore');

const router = express.Router();
const publicRouter = express.Router();
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'data', 'uploads');

function loadSharedFile(docId, docFileData = null) {
  if (docFileData && Buffer.isBuffer(docFileData) && docFileData.length > 0) {
    return docFileData;
  }
  try {
    const safeId = String(docId).replace(/[^a-zA-Z0-9_-]/g, '');
    const p = path.join(UPLOADS_DIR, safeId);
    if (fs.existsSync(p)) return fs.readFileSync(p);
  } catch {}
  return null;
}

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

    const { label, email, recipient, docId, views = 5, hours = 24, allowDownload = false } = req.body || {};
    const rawRecipient = String(email || recipient || '').trim();
    if (!rawRecipient) {
      return res.status(400).json({ error: 'Recipient email is required.' });
    }
    const emailCheck = await validateEmailAddress(rawRecipient);
    if (!emailCheck.valid) {
      return res.status(400).json({ error: emailCheck.error || 'Invalid recipient email address.' });
    }
    const recipientEmail = emailCheck.email;

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
      recipient: recipientEmail.substring(0, 120),
      token,
      views: 0,
      maxViews: safeViews,
      allowDownload: Boolean(allowDownload),
      status: 'active',
      expiresAt
    });

    const origin = req.headers.origin || config.clientOrigin || 'http://localhost:5173';
    const shareUrl = `${String(origin).replace(/\/$/, '')}/share/${token}`;
    const mailResult = await sendShareLinkEmail({
      to: recipientEmail,
      senderName: req.user.name,
      docTitle: title,
      shareUrl,
      expiresAt,
      maxViews: safeViews
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

    res.json({
      ok: true,
      emailSent: Boolean(mailResult?.sent),
      share: { ...share.toJSON(), id: share._id.toString() }
    });
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

// 4. Public share endpoints (mounted at both /api/shares/public/:token and /api/public/share/:token)
async function handlePublicInfo(req, res) {
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
}

async function handlePublicOtp(req, res) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }

    const share = await Share.findOne({ token: req.params.token });
    if (!share) {
      return res.status(404).json({ error: 'Share link invalid or expired.' });
    }
    if (share.expiresAt && new Date() > share.expiresAt) {
      share.status = 'expired';
      await share.save();
    }
    if (share.status !== 'active') {
      return res.status(410).json({ error: 'Share link has expired or been revoked.' });
    }

    const otpCode = String(crypto.randomInt(100000, 1000000));
    const otpKey = `share:${share.token}`;
    await setStoredOtp(otpKey, {
      code: otpCode,
      role: 'recipient',
      name: share.recipient,
      expiresAt: Date.now() + 10 * 60 * 1000
    });
    await sendOtpEmail({
      to: share.recipient,
      code: otpCode,
      name: share.recipient.split('@')[0]
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send verification code.' });
  }
}

async function handlePublicView(req, res) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }

    const share = await Share.findOne({ token: req.params.token }).populate('userId', 'name');
    if (!share || share.status !== 'active') {
      return res.status(404).json({ error: 'Share link unavailable.' });
    }

    if (share.expiresAt && new Date() > share.expiresAt) {
      share.status = 'expired';
      await share.save();
      return res.status(410).json({ error: 'Share link has expired.' });
    }

    const { code } = req.body || {};
    if (!code) {
      return res.status(400).json({ error: 'Verification code is required.' });
    }

    const otpKey = `share:${share.token}`;
    const stored = await getStoredOtp(otpKey);
    if (!stored || !isOtpMatch(stored, String(code).trim())) {
      return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }
    await deleteOtp(otpKey);

    share.views += 1;
    if (share.views >= share.maxViews) {
      share.status = 'expired';
    }
    await share.save();

    await recordAudit({
      action: 'SHARE_VIEW',
      detail: `External recipient (${share.recipient}) accessed share link (${share.title})`,
      userId: share.userId?._id || share.userId,
      userName: share.recipient,
      ip: req.ip
    });

    await logActivity({
      action: 'SHARE_VIEW',
      detail: `Shared document (${share.title}) viewed by ${share.recipient}`,
      userId: share.userId?._id || share.userId,
      userName: share.recipient,
      ip: req.ip
    });

    const doc = await Document.findById(share.docId).select('+fileData');
    if (doc) {
      const savedBuf = loadSharedFile(doc._id, doc.fileData);
      if (savedBuf && savedBuf.length > 0 && doc.mime) {
        res.setHeader('Content-Type', doc.mime);
        res.setHeader('Content-Disposition', `inline; filename="${doc.originalName || 'document'}"`);
        return res.send(savedBuf);
      }
    }

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400">
  <rect width="800" height="400" fill="#0f172a"/>
  <rect x="30" y="30" width="740" height="340" rx="16" fill="#ffffff" fill-opacity="0.04" stroke="#334155" stroke-width="2"/>
  <text x="60" y="90" font-family="system-ui, sans-serif" font-size="22" font-weight="700" fill="#f8fafc">TrustVault Shared Document</text>
  <text x="60" y="150" font-family="system-ui, sans-serif" font-size="16" fill="#e2e8f0">${share.title}</text>
  <text x="60" y="190" font-family="system-ui, sans-serif" font-size="14" fill="#38bdf8">Owner: ${share.userId?.name || 'Student'}</text>
  <text x="60" y="230" font-family="system-ui, sans-serif" font-size="14" fill="#a78bfa">Recipient: ${share.recipient}</text>
  <text x="400" y="350" font-family="system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">CONFIDENTIAL · TRUSTVAULT</text>
</svg>`;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load shared document.' });
  }
}

router.get('/public/:token', handlePublicInfo);
router.post('/public/:token/otp', handlePublicOtp);
router.post('/public/:token/view', handlePublicView);

publicRouter.get('/:token', handlePublicInfo);
publicRouter.post('/:token/otp', handlePublicOtp);
publicRouter.post('/:token/view', handlePublicView);

router.publicRouter = publicRouter;
module.exports = router;
