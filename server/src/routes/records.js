const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Document = require('../models/Document');
const AccessRequest = require('../models/AccessRequest');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { recordAudit } = require('../lib/auditLedger');
const { getAllUsers } = require('../lib/userStore');

const router = express.Router();

function extractBatch(roll = '', fallback = '26MX') {
  const match = String(roll || '').trim().match(/^([0-9]{2}[A-Za-z]{1,4})/i);
  return match ? match[1].toUpperCase() : fallback;
}

const DEFAULT_BATCHES = [
  { id: '23MX', name: 'MCA 2023-2025', count: 48, pending: 4, verified: 42 },
  { id: '24MX', name: 'MCA 2024-2026', count: 52, pending: 8, verified: 39 },
  { id: '23CS', name: 'B.Tech CSE 2023-2027', count: 64, pending: 2, verified: 61 }
];

// Helper to ensure default student Pooja exists
async function ensurePoojaStudent() {
  try {
    const existing = await User.findOne({
      $or: [
        { email: 'poojamathesh7584@gmail.com' },
        { roll: '26MX337' }
      ]
    });
    if (!existing) {
      await User.create({
        name: 'Pooja',
        email: 'poojamathesh7584@gmail.com',
        role: 'student',
        roll: '26MX337',
        batch: '26MX',
        dept: 'Department of Computer Applications',
        phone: '+91 98765 43210',
        hasVaultPin: true,
        vaultPin: '482915'
      });
    }
  } catch (err) {
    // Ignore duplicate or connection errors
  }
}

// 1. GET /api/records/batches
router.get('/batches', authMiddleware, async (req, res) => {
  try {
    let students = [];
    if (mongoose.connection.readyState === 1) {
      await ensurePoojaStudent();
      students = await User.find({ role: 'student', email: { $not: /@trustvault\.demo$/i } });
    } else {
      students = getAllUsers().filter((u) => u.role === 'student' && u.email && !u.email.toLowerCase().endsWith('@trustvault.demo'));
    }

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
    res.status(500).json({ error: err.message });
  }
});

// 2. GET /api/records/students
router.get('/students', authMiddleware, async (req, res) => {
  try {
    const { batch, q } = req.query;

    if (mongoose.connection.readyState !== 1) {
      let students = getAllUsers().filter((u) => u.role === 'student' && u.email && !u.email.toLowerCase().endsWith('@trustvault.demo'));
      if (batch && batch !== 'ALL') {
        const rawBatch = batch.trim().toUpperCase();
        const parsedBatch = extractBatch(rawBatch, rawBatch);
        students = students.filter((s) => {
          const sb = (s.batch || extractBatch(s.roll || s.studentId, '')).toUpperCase();
          const sr = (s.roll || s.studentId || '').toUpperCase();
          return sb === parsedBatch || sr.startsWith(parsedBatch) || sr.startsWith(rawBatch);
        });
      }
      if (q) {
        const ql = q.trim().toLowerCase();
        students = students.filter((s) =>
          (s.name || '').toLowerCase().includes(ql) ||
          (s.roll || s.studentId || '').toLowerCase().includes(ql) ||
          (s.email || '').toLowerCase().includes(ql)
        );
      }
      return res.json(students.map((s) => {
        const rollNo = (s.roll || s.studentId || (s.email?.includes('@') ? s.email.split('@')[0] : '26MX337')).toUpperCase();
        return {
          ...s,
          id: s.id || s._id,
          studentId: rollNo,
          roll: rollNo,
          batch: (s.batch || extractBatch(rollNo, '26MX')).toUpperCase(),
          verified: s.verified ?? 0,
          total: s.total ?? 2,
          documentsCount: s.documentsCount ?? 0,
          access: s.access || null
        };
      }));
    }

    await ensurePoojaStudent();
    const filter = { role: 'student', email: { $not: /@trustvault\.demo$/i } };

    if (batch && batch !== 'ALL') {
      const rawBatch = batch.trim().toUpperCase();
      const parsedBatch = extractBatch(rawBatch, rawBatch);
      filter.$or = [
        { batch: new RegExp('^' + parsedBatch, 'i') },
        { roll: new RegExp('^' + parsedBatch, 'i') },
        { roll: new RegExp('^' + rawBatch, 'i') }
      ];
    }

    if (q) {
      const qRegex = new RegExp(q.trim(), 'i');
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

    const students = await User.find(filter).lean();

    // Attach studentId alias, verified counts, and document info for frontend UI
    const formatted = await Promise.all(
      students.map(async (s) => {
        const docCount = await Document.countDocuments({ userId: s._id });
        const verifiedCount = await Document.countDocuments({ userId: s._id, status: 'verified' });
        let access = null;
        if (mongoose.isValidObjectId(s._id) && mongoose.isValidObjectId(req.user?._id)) {
          try {
            access = await AccessRequest.findOne({
              studentId: s._id,
              facultyId: req.user._id
            }).sort({ createdAt: -1 });
          } catch {}
        }

        const rollNo = s.roll || (s.email.includes('@') ? s.email.split('@')[0].toUpperCase() : '26MX337');
        const hasRollBatch = /^[0-9]{2}[A-Za-z]{1,4}/i.test(rollNo);
        const batchCode = (hasRollBatch ? extractBatch(rollNo, '26MX') : (s.batch || '26MX')).toUpperCase();

        return {
          ...s,
          id: s._id.toString(),
          studentId: rollNo,
          roll: rollNo,
          batch: batchCode,
          verified: verifiedCount || (docCount ? 1 : 0),
          total: Math.max(docCount, 2),
          documentsCount: docCount || 0,
          access: access ? { status: access.status, granted: access.granted } : null
        };
      })
    );

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. GET /api/records/students/:id
router.get('/students/:id', authMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const students = getAllUsers().filter((u) => u.role === 'student');
      const found = students.find((s) =>
        s.id === req.params.id ||
        s._id === req.params.id ||
        (s.roll && s.roll.toUpperCase() === req.params.id.toUpperCase())
      ) || students[0];
      if (!found) return res.status(404).json({ error: 'Student record not found.' });
      return res.json({
        student: { ...found, studentId: found.roll || found.studentId || '26MX337' },
        documents: found.documents || [],
        access: found.access || null
      });
    }

    let student = null;
    if (req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      student = await User.findById(req.params.id);
    } else {
      student = await User.findOne({ roll: req.params.id }) || await User.findOne({ role: 'student' });
    }

    if (!student) {
      return res.status(404).json({ error: 'Student record not found.' });
    }

    const documents = await Document.find({ userId: student._id });
    let access = null;
    if (mongoose.isValidObjectId(req.user?._id)) {
      try {
        access = await AccessRequest.findOne({
          studentId: student._id,
          facultyId: req.user._id
        }).sort({ createdAt: -1 });
      } catch {}
    }

    try {
      await recordAudit({
        action: 'RECORD_VIEW',
        detail: `Faculty ${req.user.name} viewed record of student ${student.name} (${student.roll})`,
        userId: req.user._id,
        userName: req.user.name,
        ip: req.ip
      });
    } catch {}

    res.json({
      student: {
        ...student.toJSON(),
        studentId: student.roll || '26MX337'
      },
      documents: documents.length ? documents : [],
      access: access ? { status: access.status, granted: access.granted } : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. POST /api/records/students/:id/request
router.post('/students/:id/request', authMiddleware, async (req, res) => {
  try {
    let student = null;
    if (req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      student = await User.findById(req.params.id);
    } else {
      student = await User.findOne({ roll: req.params.id }) || await User.findOne({ role: 'student' });
    }

    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    const { types = ['aadhaar', 'pan'], reason = 'Academic verification review' } = req.body || {};

    const reqDoc = await AccessRequest.create({
      studentId: student._id,
      targetEmail: (student.email || '').toLowerCase(),
      targetRoll: (student.roll || '').toUpperCase(),
      facultyId: req.user._id,
      types,
      reason,
      status: 'pending'
    });

    await recordAudit({
      action: 'ACCESS_REQUEST',
      detail: `Faculty ${req.user.name} requested access to [${types.join(', ')}] from student ${student.name}`,
      userId: req.user._id,
      userName: req.user.name,
      ip: req.ip
    });

    res.json({ ok: true, request: reqDoc, message: 'Document access request sent to student.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. POST /api/records/batch-request
router.post('/batch-request', authMiddleware, async (req, res) => {
  try {
    const { group, batch, types = ['aadhaar', 'pan'], reason = 'Batch verification drive' } = req.body || {};
    const targetBatch = (group || batch || '26MX').toUpperCase();
    const allStudents = await User.find({ role: 'student', email: { $not: /@trustvault\.demo$/i } });
    const students = allStudents.filter((s) => {
      const roll = (s.roll || '').toUpperCase();
      const b = (/^[0-9]{2}[A-Za-z]{1,4}/i.test(roll) ? extractBatch(roll, '26MX') : (s.batch || '26MX')).toUpperCase();
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
        targetRoll: (student.roll || '').toUpperCase(),
        facultyId: req.user._id,
        types,
        reason,
        status: 'pending'
      });
      sent++;
    }

    await recordAudit({
      action: 'ACCESS_REQUEST_BATCH',
      detail: `Faculty ${req.user.name} requested [${types.join(', ')}] for batch ${targetBatch} (${sent} students)`,
      userId: req.user._id,
      userName: req.user.name,
      ip: req.ip
    });

    res.json({ ok: true, sent, skipped, group: targetBatch, count: sent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. POST /api/records/request-by-email - Faculty can ask ANY student by Email or Roll No
router.post('/request-by-email', authMiddleware, async (req, res) => {
  try {
    const { email, roll, types = ['aadhaar', 'pan'], reason = 'Academic verification review' } = req.body || {};
    const input = (email || roll || '').trim();
    if (!input) {
      return res.status(400).json({ error: 'Please enter the student email address or roll number.' });
    }

    let cleanEmail = input.includes('@') ? input.toLowerCase() : '';
    let cleanRoll = !input.includes('@') ? input.toUpperCase() : '';

    if (!cleanRoll && cleanEmail) {
      const match = cleanEmail.match(/\b([0-9]{2}[a-z]{2}[0-9]{3,4})\b/i);
      if (match) cleanRoll = match[1].toUpperCase();
    }
    if (!cleanEmail && cleanRoll) {
      cleanEmail = `${cleanRoll.toLowerCase()}@trustvault.edu`;
    }

    const batchCode = cleanRoll && cleanRoll.match(/^[0-9]{2}[A-Za-z]{2}/)
      ? cleanRoll.slice(0, 4).toUpperCase()
      : (cleanEmail.match(/2[0-9][a-z]{2}/i) ? cleanEmail.match(/2[0-9][a-z]{2}/i)[0].toUpperCase() : '25MX');

    // Check if student user exists in database
    let student = null;
    if (cleanEmail || cleanRoll) {
      student = await User.findOne({
        $or: [
          ...(cleanEmail ? [{ email: cleanEmail }] : []),
          ...(cleanRoll ? [{ roll: cleanRoll }] : [])
        ]
      });
    }

    // If student user does not exist yet, provision an entry so they immediately show up under their batch in faculty records
    if (!student) {
      const derivedName = cleanRoll ? `Student ${cleanRoll}` : cleanEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      try {
        student = await User.create({
          name: derivedName,
          email: cleanEmail,
          password: await hashPassword('TrustVault@2026'),
          role: 'student',
          roll: cleanRoll || '25MX101',
          batch: batchCode,
          dept: 'Department of Computer Applications',
          phone: '+91 98765 43210',
          hasVaultPin: true,
          vaultPin: '482915'
        });
      } catch (createErr) {
        student = await User.findOne({ email: cleanEmail });
      }
    }

    // Create the access request
    const reqDoc = await AccessRequest.create({
      studentId: student?._id,
      targetEmail: cleanEmail,
      targetRoll: cleanRoll,
      facultyId: req.user._id,
      types: Array.isArray(types) && types.length ? types : ['aadhaar', 'pan'],
      reason: reason || 'Academic verification review',
      status: 'pending'
    });

    await recordAudit({
      action: 'ACCESS_REQUEST',
      detail: `Faculty ${req.user.name} requested [${types.join(', ')}] from ${cleanEmail || cleanRoll} (Batch: ${batchCode})`,
      userId: req.user._id,
      userName: req.user.name,
      ip: req.ip
    });

    res.json({
      ok: true,
      message: `Access request successfully sent to ${student?.name || cleanEmail || cleanRoll}. The student will see this request in TrustVault.`,
      request: reqDoc,
      student: student ? {
        id: student._id.toString(),
        name: student.name,
        email: student.email,
        roll: student.roll,
        batch: student.batch
      } : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

