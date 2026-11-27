const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Minizip = require('minizip-asm.js');
const Document = require('../models/Document');
const { authMiddleware } = require('../middleware/auth');
const { sha256, comparePassword } = require('../lib/crypto');
const { maskNumber, verifyDocumentUpload } = require('../lib/verify');
const { recordAudit } = require('../lib/auditLedger');
const { logActivity } = require('../lib/activityLogger');
const { sendExportZipEmail } = require('../lib/mailer');

const router = express.Router();
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'data', 'uploads');

// Privacy guard: Admin cannot access student documents
router.use(authMiddleware, (req, res, next) => {
  if (req.user?.role === 'admin') {
    return res.status(403).json({
      error: 'Privacy Policy: Administrators cannot view or access student documents.'
    });
  }
  next();
});

function saveUploadedFile(docId, buffer) {
  try {
    if (!buffer || buffer.length === 0) return;
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    const safeId = String(docId).replace(/[^a-zA-Z0-9_-]/g, '');
    fs.writeFileSync(path.join(UPLOADS_DIR, safeId), buffer);
  } catch {}
}

function loadUploadedFile(docId, docFileData = null) {
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

const ALLOWED_MIMES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp'
];

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type '${file.mimetype}' is not allowed. Use PDF, PNG, JPEG, or WebP.`));
    }
  }
});

const TYPE_TITLES = {
  aadhaar: 'Aadhaar Card',
  pan: 'PAN Card',
  tenth: '10th Marksheet',
  class10: '10th Marksheet',
  twelfth: '12th Marksheet',
  class12: '12th Marksheet',
  degree: 'Degree Certificate',
  marksheet: 'Semester Marksheet',
  certificate: 'College Certificate',
  income: 'Income Certificate',
  community: 'Community Certificate',
  license: 'Driving Licence',
  other: 'Academic Document'
};

const VALID_TYPES = Object.keys(TYPE_TITLES);

// 1. GET /api/documents - List documents
router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database is currently unavailable.' });
    }
    const docs = await Document.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve documents.' });
  }
});

// 2. POST /api/documents - Upload document with verification & DB persistence
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database is currently unavailable.' });
    }

    const type = VALID_TYPES.includes(req.body?.type) ? req.body.type : 'other';
    const number = req.body?.number || '';
    const title = (req.body?.title && String(req.body.title).trim()) || TYPE_TITLES[type] || 'Academic Document';
    const file = req.file;

    if (!file || !file.buffer || file.buffer.length === 0) {
      return res.status(400).json({ error: 'Please upload a valid document file.' });
    }

    const originalName = file.originalname;
    const size = file.size;
    const mime = file.mimetype;
    const fileBuffer = file.buffer;
    const fileHash = sha256(fileBuffer);

    const cleanNum = String(number || '').trim().toUpperCase();
    const masked = number ? maskNumber(number, type) : `DOC-${Math.floor(100000 + Math.random() * 900000)}`;

    const existingSameHash = await Document.findOne({ userId: req.user._id, fileHash });
    const existingSameNumber = cleanNum
      ? await Document.findOne({ userId: req.user._id, type, numberMasked: masked })
      : null;
    const isDuplicate = Boolean(existingSameHash || existingSameNumber);

    const verification = await verifyDocumentUpload({
      type,
      number,
      fileBuffer,
      originalName,
      mime,
      user: req.user,
      isDuplicate
    });

    const newDoc = await Document.create({
      userId: req.user._id,
      title,
      type,
      originalName,
      numberMasked: masked,
      size: size || fileBuffer.length,
      mime,
      fileHash,
      sha256: fileHash,
      fileData: fileBuffer,
      status: verification.status,
      reviewNote: verification.reviewNote,
      autoCheck: {
        state: 'done',
        passed: verification.passed,
        details: verification.details,
        score: verification.score,
        checks: verification.checks
      }
    });

    saveUploadedFile(newDoc._id, fileBuffer);

    await recordAudit({
      action: verification.passed ? 'DOCUMENT_VERIFIED' : 'DOCUMENT_REJECTED',
      detail: `${verification.passed ? 'Verified' : 'Rejected'} ${title} (${masked}): score ${verification.score}%`,
      userId: req.user._id,
      userName: req.user.name,
      fileHash,
      ip: req.ip
    });

    await logActivity({
      action: 'DOCUMENT_UPLOAD',
      detail: `Uploaded ${title} (${masked}) — ${verification.status.toUpperCase()} (${verification.score}%)`,
      userId: req.user._id,
      userName: req.user.name,
      ip: req.ip
    });

    // Exclude raw binary fileData from JSON response
    const docOut = newDoc.toJSON();
    delete docOut.fileData;
    res.status(201).json({ ok: true, doc: docOut });
  } catch (err) {
    console.error('[Documents] Upload error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to upload document.' });
  }
});

// 3. GET & POST /api/documents/:id/view - Serve uploaded file from DB or disk
async function handleDocView(req, res) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid document ID.' });
    }

    const doc = await Document.findOne({ _id: req.params.id, userId: req.user._id }).select('+fileData');
    if (!doc) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    await logActivity({
      action: 'DOCUMENT_VIEW',
      detail: `Viewed ${doc.title} (${doc.numberMasked})`,
      userId: req.user._id,
      userName: req.user.name,
      ip: req.ip
    });

    const savedBuf = loadUploadedFile(doc._id, doc.fileData);
    if (savedBuf && savedBuf.length > 0 && doc.mime) {
      res.setHeader('Content-Type', doc.mime);
      res.setHeader('Content-Disposition', `inline; filename="${doc.originalName || 'document'}"`);
      return res.send(savedBuf);
    }

    // Watermarked SVG fallback
    const docTitle = doc.title || 'TrustVault Document';
    const masked = doc.numberMasked || '-';
    const hash = doc.fileHash || doc.sha256 || '';
    const isVerified = doc.status === 'verified' || doc.status === 'stored';
    const statusText = isVerified ? '✓ Verification Passed' : '⚠ Verification Failed / Pending';
    const statusColor = isVerified ? '#10b981' : '#f59e0b';
    const userName = req.user?.name || 'Authorized Holder';

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400">
  <rect width="800" height="400" fill="#0f172a"/>
  <rect x="30" y="30" width="740" height="340" rx="16" fill="#ffffff" fill-opacity="0.04" stroke="#334155" stroke-width="2"/>
  <text x="60" y="80" font-family="system-ui, sans-serif" font-size="22" font-weight="700" fill="#f8fafc">TrustVault Document Preview</text>
  <text x="60" y="140" font-family="system-ui, sans-serif" font-size="16" fill="#e2e8f0">${docTitle}</text>
  <text x="60" y="180" font-family="system-ui, sans-serif" font-size="14" fill="#38bdf8">${masked}</text>
  <text x="60" y="220" font-family="system-ui, sans-serif" font-size="14" fill="#a78bfa">${userName}</text>
  <text x="60" y="280" font-family="system-ui, sans-serif" font-size="12" fill="${statusColor}">${statusText}</text>
  <text x="60" y="310" font-family="monospace" font-size="10" fill="#94a3b8">SHA-256: ${hash.substring(0, 48)}...</text>
  <text x="400" y="350" font-family="system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">CONFIDENTIAL · TRUSTVAULT</text>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve document.' });
  }
}

router.get('/:id/view', handleDocView);
router.post('/:id/view', handleDocView);

// 4. PATCH /api/documents/:id/type - Reclassify document
router.patch('/:id/type', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid document ID.' });
    }

    const { type, number = '' } = req.body || {};
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Invalid document type.' });
    }

    const doc = await Document.findOne({ _id: req.params.id, userId: req.user._id });
    if (!doc) return res.status(404).json({ error: 'Document not found.' });

    doc.type = type;
    doc.title = TYPE_TITLES[type] || doc.title;

    const cleanNum = String(number || '').trim().toUpperCase();
    if (cleanNum) {
      doc.numberMasked = maskNumber(cleanNum, type);
    }

    const fileBuffer = loadUploadedFile(doc._id, doc.fileData);
    if (fileBuffer) {
      const verification = await verifyDocumentUpload({
        type,
        number: cleanNum,
        fileBuffer,
        originalName: doc.originalName,
        mime: doc.mime,
        user: req.user,
        isDuplicate: false
      });
      doc.status = verification.status;
      doc.reviewNote = verification.reviewNote;
      doc.autoCheck = {
        state: 'done',
        passed: verification.passed,
        details: verification.details,
        score: verification.score,
        checks: verification.checks
      };
    }

    await doc.save();

    await recordAudit({
      action: 'DOCUMENT_RETYPE',
      detail: `Reclassified document to ${doc.title}`,
      userId: req.user._id,
      userName: req.user.name,
      fileHash: doc.fileHash,
      ip: req.ip
    });

    res.json({ ok: true, doc });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reclassify document.' });
  }
});

// 5. DELETE /api/documents/:id
router.delete('/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid document ID.' });
    }

    const doc = await Document.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!doc) return res.status(404).json({ error: 'Document not found.' });

    try {
      const safeId = String(doc._id).replace(/[^a-zA-Z0-9_-]/g, '');
      const filePath = path.join(UPLOADS_DIR, safeId);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {}

    await recordAudit({
      action: 'DOCUMENT_DELETE',
      detail: `Deleted document ${doc.title} (${doc.numberMasked})`,
      userId: req.user._id,
      userName: req.user.name,
      fileHash: doc.fileHash,
      ip: req.ip
    });

    await logActivity({
      action: 'DOCUMENT_DELETE',
      detail: `Deleted ${doc.title} (${doc.numberMasked})`,
      userId: req.user._id,
      userName: req.user.name,
      ip: req.ip
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete document.' });
  }
});

// 6. POST /api/documents/export - AES-256 Encrypted ZIP protected with user's login password
router.post('/export', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }

    const { ids = [], password } = req.body || {};
    if (!password) {
      return res.status(400).json({ error: 'Please enter your login password to encrypt and export your ZIP.' });
    }

    const isPasswordValid = await comparePassword(String(password), req.user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Incorrect login password. Please enter your account login password.' });
    }

    const recipientEmail = req.user.email;
    const recipientName = req.user.name;

    // Only export VERIFIED documents
    const query = { userId: req.user._id, status: 'verified' };
    if (Array.isArray(ids) && ids.length > 0) {
      const validIds = ids.filter((id) => mongoose.isValidObjectId(id));
      if (validIds.length === 0) {
        return res.status(400).json({ error: 'No valid document IDs provided.' });
      }
      query._id = { $in: validIds };
    }

    const docs = await Document.find(query).select('+fileData');
    if (!docs || docs.length === 0) {
      return res.status(400).json({ error: 'No verified documents found to export. Only verified documents can be exported.' });
    }

    // Create password-protected ZIP using the user's login password
    const zipPassword = String(password);
    const mz = new Minizip();

    const docTitles = [];
    const sizes = [];

    for (const d of docs) {
      const safeName = (d.originalName || `${(d.title || 'Document').replace(/\s+/g, '-')}.pdf`).replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileBuf = loadUploadedFile(d._id, d.fileData);
      if (fileBuf && fileBuf.length > 0) {
        mz.append(safeName, fileBuf, { password: zipPassword });
      } else {
        const docHeader = `TRUSTVAULT VERIFIED DOCUMENT\n` +
                          `============================\n` +
                          `Document Title : ${d.title}\n` +
                          `Masked Number  : ${d.numberMasked || 'N/A'}\n` +
                          `Holder         : ${recipientName} (${recipientEmail})\n` +
                          `Fingerprint    : ${d.fileHash || ''}\n` +
                          `Status         : VERIFIED\n` +
                          `Timestamp      : ${new Date().toISOString()}\n`;
        mz.append(safeName.replace(/\.[^.]+$/, '.txt'), Buffer.from(docHeader), { password: zipPassword });
      }
      docTitles.push(`${d.title} (${d.numberMasked || 'Verified'})`);
      sizes.push(`${d.title} (${Math.max(1, Math.round((d.size || 1024) / 1024))} KB)`);
    }

    mz.append(
      'SECURITY-AUDIT-CERTIFICATE.txt',
      Buffer.from(
        `TRUSTVAULT VAULT EXPORT AUDIT TRAIL\n` +
        `====================================\n` +
        `Exported By : ${recipientName} <${recipientEmail}>\n` +
        `Timestamp   : ${new Date().toISOString()}\n` +
        `Encryption  : Protected with your TrustVault login password\n` +
        `Documents   : ${docs.length}\n` +
        `Audit Hash  : ${sha256(Buffer.from(recipientEmail + Date.now()))}\n`
      ),
      { password: zipPassword }
    );

    const zipBuffer = Buffer.from(mz.zip());

    const mailResult = await sendExportZipEmail({
      to: recipientEmail,
      name: recipientName,
      zipBuffer,
      zipPassword: 'Your TrustVault login password',
      docCount: docs.length,
      docTitles
    });

    await recordAudit({
      action: 'DOCUMENTS_EXPORT',
      detail: `Exported AES-256 encrypted ZIP (${docs.length} verified documents) to ${recipientEmail}`,
      userId: req.user._id,
      userName: recipientName,
      ip: req.ip
    });

    await logActivity({
      action: 'DOCUMENTS_EXPORT',
      detail: `Exported ${docs.length} verified document(s) as password-protected ZIP to ${recipientEmail}`,
      userId: req.user._id,
      userName: recipientName,
      ip: req.ip
    });

    res.json({
      ok: true,
      sentTo: recipientEmail,
      summary: `Compressed and encrypted ${docs.length} verified document(s) with AES-256 using your login password.`,
      sizes,
      emailSent: mailResult.sent
    });
  } catch (err) {
    console.error('[Documents] Export error:', err.message);
    res.status(500).json({ error: 'Failed to export documents.' });
  }
});

module.exports = router;
