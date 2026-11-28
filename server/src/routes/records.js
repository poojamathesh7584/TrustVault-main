const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Document = require('../models/Document');
const AccessRequest = require('../models/AccessRequest');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { recordAudit } = require('../lib/auditLedger');
const { logActivity } = require('../lib/activityLogger');

const router = express.Router();
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'data', 'uploads');

function extractBatch(roll = '', fallback = '26MX') {
  const match = String(roll || '').trim().match(/^([0-9]{2}[A-Za-z]{1,4})/i);
  return match ? match[1].toUpperCase() : fallback;
}

function normalizeReason(reason, fallback) {
  return String(reason || '').trim().substring(0, 500) || fallback;
}

// 1. GET /api/records/batches - Dynamic batch counts for all registered students
router.get('/batches', authMiddleware, requireRole('verifier'), async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }

    const students = await User.find({ role: 'student' });

    const batchMap = {};
    students.forEach((s) => {
      const roll = s.roll || s.studentId || '';
      const hasRollBatch = /^[0-9]{2}[A-Za-z]{1,4}/i.test(roll);
      const b = (hasRollBatch ? extractBatch(roll, '26MX') : (s.batch || '26MX')).toUpperCase();
      if (!batchMap[b]) {
        batchMap[b] = { group: b, students: 0, id: b, name: `Batch ${b}`, count: 0 };
      }
      batchMap[b].students++;
      batchMap[b].count++;
    });

    res.json(Object.values(batchMap).sort((a, b) => b.group.localeCompare(a.group)));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load batches.' });
  }
});

// 2. GET /api/records/students - List all registered students with accurate counts & faculty access status
router.get('/students', authMiddleware, requireRole('verifier'), async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }

    const { batch, q } = req.query;
    const filter = { role: 'student' };

    if (batch && batch !== 'ALL') {
      const rawBatch = batch.trim().toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const parsedBatch = extractBatch(rawBatch, rawBatch);
      filter.$or = [
        { batch: new RegExp('^' + parsedBatch, 'i') },
        { roll: new RegExp('^' + parsedBatch, 'i') },
        { roll: new RegExp('^' + rawBatch, 'i') }
      ];
    }

    if (q) {
      const escapedQ = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const qRegex = new RegExp(escapedQ, 'i');
      if (filter.$or) {
        filter.$and = [
          { $or: filter.$or },
          { $or: [{ name: qRegex }, { roll: qRegex }, { email: qRegex }] }
        ];
        delete filter.$or;
      } else {
        filter.$or = [{ name: qRegex }, { roll: qRegex }, { email: qRegex }];
      }
    }

    const students = await User.find(filter).sort({ roll: 1, createdAt: -1 });
    const formatted = await Promise.all(students.map(async (s) => {
      const rollNo = (s.roll || '').toUpperCase();
      const [documentsCount, verifiedCount, latestAccess] = await Promise.all([
        Document.countDocuments({ userId: s._id }),
        Document.countDocuments({ userId: s._id, status: 'verified' }),
        AccessRequest.findOne({ studentId: s._id, facultyId: req.user._id }).sort({ requestedAt: -1 })
      ]);

      return {
        id: s._id.toString(),
        _id: s._id.toString(),
        name: s.name,
        email: s.email,
        studentId: rollNo,
        roll: rollNo,
        batch: (s.batch || extractBatch(rollNo, '26MX')).toUpperCase(),
        dept: s.dept,
        status: s.status,
        verified: verifiedCount,
        total: documentsCount,
        documentsCount,
        access: latestAccess ? {
          id: latestAccess._id.toString(),
          status: latestAccess.status,
          granted: latestAccess.granted,
          types: latestAccess.types,
          expiresAt: latestAccess.expiresAt
        } : null,
        createdAt: s.createdAt
      };
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load students.' });
  }
});

// 3. GET /api/records/students/:id - Only returns VERIFIED documents with STUDENT CONSENT
router.get('/students/:id', authMiddleware, requireRole('verifier'), async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid student ID.' });
    }

    const student = await User.findById(req.params.id);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ error: 'Student not found.' });
    }

    // Check if faculty has approved (and unexpired) student consent
    const access = await AccessRequest.findOne({
      studentId: student._id,
      facultyId: req.user._id,
      status: 'approved'
    }).sort({ respondedAt: -1 });

    const isConsentValid = Boolean(access && (!access.expiresAt || new Date() <= access.expiresAt));

    let documents = [];
    if (isConsentValid) {
      // ONLY verified documents in the student's granted types
      documents = await Document.find({
        userId: student._id,
        status: 'verified',
        type: { $in: access.granted && access.granted.length ? access.granted : access.types }
      }).sort({ createdAt: -1 });
    }

    res.json({
      student: {
        id: student._id.toString(),
        name: student.name,
        email: student.email,
        roll: student.roll,
        studentId: student.roll,
        batch: student.batch,
        dept: student.dept,
        status: student.status,
        createdAt: student.createdAt
      },
      documents,
      access: access ? {
        id: access._id.toString(),
        status: isConsentValid ? access.status : 'expired',
        granted: access.granted,
        types: access.types,
        expiresAt: access.expiresAt
      } : null
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load student record.' });
  }
});

// 3b. View a student's consented, verified document (Faculty only)
async function handleFacultyDocView(req, res) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.docId)) {
      return res.status(400).json({ error: 'Invalid ID.' });
    }

    const student = await User.findById(req.params.id);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ error: 'Student not found.' });
    }

    const access = await AccessRequest.findOne({
      studentId: student._id,
      facultyId: req.user._id,
      status: 'approved'
    }).sort({ respondedAt: -1 });

    if (!access || (access.expiresAt && new Date() > access.expiresAt)) {
      return res.status(403).json({ error: 'Student consent is required or has expired.' });
    }

    const doc = await Document.findOne({
      _id: req.params.docId,
      userId: student._id
    }).select('+fileData');

    if (!doc) {
      return res.status(404).json({ error: 'Document not found.' });
    }
    if (doc.status !== 'verified') {
      return res.status(403).json({ error: 'Only verified documents can be viewed by faculty.' });
    }
    const allowedTypes = access.granted && access.granted.length ? access.granted : access.types;
    if (!allowedTypes.includes(doc.type)) {
      return res.status(403).json({ error: 'Student did not grant consent for this document type.' });
    }

    await recordAudit({
      action: 'FACULTY_VIEW_DOCUMENT',
      detail: `Faculty ${req.user.name} viewed verified ${doc.title} of ${student.name} (${student.roll})`,
      userId: req.user._id,
      userName: req.user.name,
      fileHash: doc.fileHash,
      ip: req.ip
    });

    await logActivity({
      action: 'FACULTY_VIEW_DOCUMENT',
      detail: `Viewed ${doc.title} of ${student.name} (${student.roll})`,
      userId: req.user._id,
      userName: req.user.name,
      ip: req.ip
    });

    let buf = doc.fileData && Buffer.isBuffer(doc.fileData) && doc.fileData.length > 0 ? doc.fileData : null;
    if (!buf) {
      try {
        const safeId = String(doc._id).replace(/[^a-zA-Z0-9_-]/g, '');
        const p = path.join(UPLOADS_DIR, safeId);
        if (fs.existsSync(p)) buf = fs.readFileSync(p);
      } catch {}
    }

    if (buf && buf.length > 0 && doc.mime) {
      res.setHeader('Content-Type', doc.mime);
      res.setHeader('Content-Disposition', `inline; filename="${doc.originalName || 'document'}"`);
      return res.send(buf);
    }

    return res.status(404).json({ error: 'Document file unavailable.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to view document.' });
  }
}

router.get('/students/:id/documents/:docId/view', authMiddleware, requireRole('verifier'), handleFacultyDocView);
router.post('/students/:id/documents/:docId/view', authMiddleware, requireRole('verifier'), handleFacultyDocView);

// 4. POST /api/records/request-access - Faculty request document access
router.post('/request-access', authMiddleware, requireRole('verifier'), async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }

    const { studentId, types = ['aadhaar', 'pan'], reason = 'Academic verification' } = req.body || {};
    if (!studentId || !mongoose.isValidObjectId(studentId)) {
      return res.status(400).json({ error: 'Valid student ID is required.' });
    }

    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ error: 'Student not found.' });
    }

    const existing = await AccessRequest.findOne({
      studentId: student._id,
      facultyId: req.user._id,
      status: 'pending'
    });
    if (existing) {
      return res.status(400).json({ error: 'An access request is already pending for this student.' });
    }

    const reqDoc = await AccessRequest.create({
      studentId: student._id,
      targetEmail: student.email,
      targetRoll: (student.roll || '').toUpperCase(),
      facultyId: req.user._id,
      types: Array.isArray(types) && types.length ? types : ['aadhaar', 'pan'],
      reason: normalizeReason(reason, 'Academic verification review'),
      status: 'pending'
    });

    await recordAudit({
      action: 'ACCESS_REQUEST',
      detail: `Faculty ${req.user.name} requested [${types.join(', ')}] from ${student.name}`,
      userId: req.user._id,
      userName: req.user.name,
      ip: req.ip
    });

    await logActivity({
      action: 'ACCESS_REQUEST',
      detail: `Requested [${types.join(', ')}] from ${student.name} (${student.roll})`,
      userId: req.user._id,
      userName: req.user.name,
      ip: req.ip
    });

    res.json({ ok: true, request: reqDoc });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create access request.' });
  }
});

// 5. POST /api/records/request-batch - Batch access request
router.post('/request-batch', authMiddleware, requireRole('verifier'), async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }

    const { group, batch, types, reason } = req.body || {};
    const targetBatch = (group || batch || '26MX').toUpperCase();
    const requestedTypes = Array.isArray(types) && types.length > 0 ? types : ['aadhaar', 'pan'];
    const cleanReason = normalizeReason(reason, `Batch ${targetBatch} verification drive`);

    const allStudents = await User.find({ role: 'student' });
    const students = allStudents.filter((s) => {
      const roll = (s.roll || s.studentId || '').toUpperCase();
      const b = (/^[0-9]{2}[A-Za-z]{1,4}/i.test(roll)
        ? extractBatch(roll, '26MX')
        : (s.batch || '26MX')).toUpperCase();
      return targetBatch === 'ALL' || b === targetBatch || roll.startsWith(targetBatch);
    });

    let sent = 0;
    let skipped = 0;
    for (const student of students) {
      const existing = await AccessRequest.findOne({
        studentId: student._id,
        facultyId: req.user._id,
        status: 'pending'
      });
      if (existing) {
        skipped++;
        continue;
      }
      await AccessRequest.create({
        studentId: student._id,
        targetEmail: (student.email || '').toLowerCase(),
        targetRoll: (student.roll || student.studentId || '').toUpperCase(),
        facultyId: req.user._id,
        types: requestedTypes,
        reason: cleanReason,
        status: 'pending'
      });
      sent++;
    }

    await recordAudit({
      action: 'ACCESS_REQUEST_BATCH',
      detail: `Faculty ${req.user.name} requested [${requestedTypes.join(', ')}] for batch ${targetBatch} (${sent} students)`,
      userId: req.user._id,
      userName: req.user.name,
      ip: req.ip
    });

    await logActivity({
      action: 'ACCESS_REQUEST_BATCH',
      detail: `Batch request for ${targetBatch}: sent to ${sent} student(s)`,
      userId: req.user._id,
      userName: req.user.name,
      ip: req.ip
    });

    res.json({ ok: true, sent, skipped, group: targetBatch, count: sent });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process batch request.' });
  }
});

// 6. POST /api/records/request-by-email - Faculty request by email/roll
router.post('/request-by-email', authMiddleware, requireRole('verifier'), async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }

    const { email, roll, types = ['aadhaar', 'pan'], reason = 'Academic verification review' } = req.body || {};
    const input = (email || roll || '').trim();
    if (!input) {
      return res.status(400).json({ error: 'Please enter the student email or roll number.' });
    }

    let cleanEmail = input.includes('@') ? input.toLowerCase() : '';
    let cleanRoll = !input.includes('@') ? input.toUpperCase() : '';

    if (!cleanRoll && cleanEmail) {
      const match = cleanEmail.match(/\b([0-9]{2}[a-z]{2}[0-9]{3,4})\b/i);
      if (match) cleanRoll = match[1].toUpperCase();
    }

    const student = await User.findOne({
      role: 'student',
      $or: [
        ...(cleanEmail ? [{ email: cleanEmail }] : []),
        ...(cleanRoll ? [{ roll: cleanRoll }] : [])
      ]
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found. The student must sign up first.' });
    }

    const reqDoc = await AccessRequest.create({
      studentId: student._id,
      targetEmail: student.email,
      targetRoll: student.roll,
      facultyId: req.user._id,
      types: Array.isArray(types) && types.length ? types : ['aadhaar', 'pan'],
      reason: normalizeReason(reason, 'Academic verification review'),
      status: 'pending'
    });

    await recordAudit({
      action: 'ACCESS_REQUEST',
      detail: `Faculty ${req.user.name} requested [${types.join(', ')}] from ${student.name}`,
      userId: req.user._id,
      userName: req.user.name,
      ip: req.ip
    });

    await logActivity({
      action: 'ACCESS_REQUEST',
      detail: `Requested [${types.join(', ')}] from ${student.name} (${student.email})`,
      userId: req.user._id,
      userName: req.user.name,
      ip: req.ip
    });

    res.json({
      ok: true,
      message: `Access request sent to ${student.name}.`,
      request: reqDoc,
      student: {
        id: student._id.toString(),
        name: student.name,
        email: student.email,
        roll: student.roll,
        batch: student.batch
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create access request.' });
  }
});

module.exports = router;
