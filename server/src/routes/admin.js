const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Document = require('../models/Document');
const AccessRequest = require('../models/AccessRequest');
const Audit = require('../models/Audit');
const ActivityLog = require('../models/ActivityLog');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { verifyLedgerIntegrity, recordAudit } = require('../lib/auditLedger');
const { hashPassword } = require('../lib/crypto');

const router = express.Router();

// All admin routes require admin role
router.use(authMiddleware);
router.use(requireRole('admin'));

// 1. GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }

    const [studentCount, verifierCount, adminCount, verifiedDocs, pendingDocs, rejectedDocs, ledgerCount, activityCount] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'verifier' }),
      User.countDocuments({ role: 'admin' }),
      Document.countDocuments({ status: 'verified' }),
      Document.countDocuments({ status: 'pending' }),
      Document.countDocuments({ status: 'rejected' }),
      Audit.countDocuments(),
      ActivityLog.countDocuments()
    ]);

    const totalUsers = studentCount + verifierCount + adminCount;
    const totalDocs = verifiedDocs + pendingDocs + rejectedDocs;

    // Count logins in last 24h from activity logs
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const logins24h = await ActivityLog.countDocuments({
      action: { $in: ['LOGIN_SUCCESS', 'LOGIN_OTP'] },
      createdAt: { $gte: oneDayAgo }
    });

    res.json({
      users: { student: studentCount, verifier: verifierCount, admin: adminCount },
      documents: { verified: verifiedDocs, pending: pendingDocs, rejected: rejectedDocs },
      logins24h,
      blocks: ledgerCount,
      tampered: 0,
      totalUsers,
      totalDocs,
      pendingVerifications: pendingDocs,
      ledgerRecords: ledgerCount,
      activityLogs: activityCount,
      systemHealth: 'Tamper-Evident Ledger Active'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load admin stats.' });
  }
});

// 2. GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }

    const users = await User.find().sort({ role: 1, name: 1 });
    const formatted = users.map((u) => ({
      id: u._id.toString(),
      _id: u._id.toString(),
      name: u.name,
      email: u.email,
      role: u.role,
      studentId: u.roll || '',
      roll: u.roll || '',
      batch: u.batch,
      dept: u.dept,
      status: u.status,
      locked: Boolean(u.locked),
      lockReason: u.lockReason || '',
      failedOtpAttempts: u.failedOtpAttempts || 0,
      hasVaultPin: u.hasVaultPin,
      createdAt: u.createdAt
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load users.' });
  }
});

// 2b. POST /api/admin/users - Create user
router.post('/users', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }

    const { name, email, role = 'student', roll, studentId, dept, batch, password } = req.body || {};
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }

    // Validate email format
    const cleanEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    const targetRole = role === 'faculty' ? 'verifier' : (['student', 'verifier', 'admin'].includes(role) ? role : 'student');
    if (!password || String(password).trim().length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }
    const finalPassword = String(password).trim();
    const idCode = (roll || studentId || (
      targetRole === 'verifier' ? `FAC-${Math.floor(1000 + Math.random() * 9000)}`
        : targetRole === 'admin' ? `ADM-${Math.floor(10 + Math.random() * 90)}`
        : `26MX${Math.floor(100 + Math.random() * 900)}`
    )).toUpperCase();

    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({ error: `User with email '${cleanEmail}' already exists.` });
    }

    const created = await User.create({
      name: name.trim().substring(0, 100),
      email: cleanEmail,
      password: await hashPassword(finalPassword),
      role: targetRole,
      roll: idCode,
      batch: batch || (targetRole === 'student' ? idCode.slice(0, 4) : undefined),
      dept: dept || (targetRole === 'admin' ? 'Central Examination & Verification Cell' : 'Department of Computer Applications'),
      hasVaultPin: false
    });

    await recordAudit({
      action: 'USER_CREATE',
      detail: `Admin created ${targetRole} account for ${name} (${cleanEmail})`,
      userId: req.user._id,
      userName: req.user.name,
      ip: req.ip
    });

    res.status(201).json({
      ok: true,
      user: {
        id: created._id.toString(),
        name: created.name,
        email: created.email,
        role: created.role,
        roll: created.roll,
        status: created.status
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create user.' });
  }
});

// 3. PATCH /api/admin/users/:id
router.patch('/users/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    const { name, roll, batch, dept, role, status } = req.body || {};
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (name && typeof name === 'string') user.name = name.trim().substring(0, 100);
    if (roll && typeof roll === 'string') {
      user.roll = roll.trim().toUpperCase();
      const bm = user.roll.match(/^([0-9]{2}[A-Za-z]{1,4})/i);
      if (bm && !batch) user.batch = bm[1].toUpperCase();
    }
    if (batch && typeof batch === 'string') user.batch = batch.trim().toUpperCase();
    if (dept && typeof dept === 'string') user.dept = dept.trim().substring(0, 120);
    if (role && ['student', 'verifier', 'admin'].includes(role)) user.role = role;
    if (status && ['active', 'inactive', 'suspended'].includes(status)) user.status = status;
    await user.save();

    await recordAudit({
      action: 'USER_UPDATE',
      detail: `Admin updated user ${user.name} (role: ${user.role}, status: ${user.status})`,
      userId: req.user._id,
      userName: req.user.name,
      ip: req.ip
    });

    res.json({ ok: true, user: { id: user._id.toString(), name: user.name, role: user.role, status: user.status } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

router.post('/users/:id/reset-2fa', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    const u = await User.findById(req.params.id);
    if (u) {
      u.totpSecret = '';
      u.vaultPin = '';
      u.hasVaultPin = false;
      await u.save();
      await recordAudit({
        action: 'USER_RESET_2FA',
        detail: `Admin reset 2FA for user ${u.name}`,
        userId: req.user._id,
        userName: req.user.name,
        ip: req.ip
      });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset 2FA.' });
  }
});

router.post('/users/:id/unlock', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    const u = await User.findById(req.params.id);
    if (u) {
      u.status = 'active';
      u.locked = false;
      u.lockReason = '';
      u.failedOtpAttempts = 0;
      await u.save();
      await recordAudit({
        action: 'USER_UNLOCK',
        detail: `Admin unlocked account for ${u.name}`,
        userId: req.user._id,
        userName: req.user.name,
        ip: req.ip
      });
      await ActivityLog.create({
        userId: req.user._id,
        userName: req.user.name,
        action: 'USER_UNLOCK',
        detail: `Admin unlocked account for ${u.email}`,
        ip: req.ip
      });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unlock user.' });
  }
});

// 3b. POST /api/admin/users/:id/password - Admin assigns/resets user password
router.post('/users/:id/password', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    const { password } = req.body || {};
    if (!password || String(password).trim().length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    user.password = await hashPassword(String(password).trim());
    await user.save();

    await recordAudit({
      action: 'ADMIN_PASSWORD_SET',
      detail: `Admin set password for ${user.name} (${user.email}, ${user.role})`,
      userId: req.user._id,
      userName: req.user.name,
      ip: req.ip
    });

    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      action: 'ADMIN_PASSWORD_SET',
      detail: `Admin assigned new login password for ${user.email}`,
      ip: req.ip
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user password.' });
  }
});

// 3c. DELETE /api/admin/users/:id - Admin removes a user
router.delete('/users/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }
    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({ error: 'You cannot delete your own active admin account.' });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    await recordAudit({
      action: 'USER_DELETE',
      detail: `Admin removed ${user.role} account ${user.name} (${user.email})`,
      userId: req.user._id,
      userName: req.user.name,
      ip: req.ip
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove user.' });
  }
});

// 4. Audit & Activity Logs
router.get('/audit', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }

    const logs = await Audit.find().sort({ at: -1 }).limit(100);
    const formatted = logs.map((l) => ({
      id: l._id.toString(),
      _id: l._id.toString(),
      at: l.at,
      action: l.action.toLowerCase().replace(/_/g, '.'),
      detail: l.detail,
      user: { name: l.userName },
      ip: l.ip
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load audit logs.' });
  }
});

router.get('/activity-logs', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }

    const logs = await ActivityLog.find().sort({ createdAt: -1 }).limit(100);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load activity logs.' });
  }
});

router.get('/requests', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }

    const list = await AccessRequest.find()
      .populate('studentId', 'name roll dept')
      .populate('facultyId', 'name dept')
      .sort({ requestedAt: -1 });

    const formatted = list.map((item) => ({
      id: item._id.toString(),
      _id: item._id.toString(),
      studentName: item.studentId?.name || 'Student',
      studentRoll: item.studentId?.roll || '',
      verifierName: item.facultyId?.name || 'Faculty',
      verifierDept: item.facultyId?.dept || '',
      types: item.types,
      status: item.status,
      reason: item.reason,
      requestedAt: item.requestedAt
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load requests.' });
  }
});

// 5. Ledger & Cryptographic Integrity Check
router.get('/ledger', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }

    const blocks = await Audit.find().sort({ index: -1 }).limit(20);
    const formatted = blocks.map((b) => ({
      index: b.index,
      timestamp: b.at,
      action: b.action,
      hash: b.hash,
      prevHash: b.prevHash,
      fileHash: b.fileHash || '0'.repeat(64),
      user: b.userName
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load ledger.' });
  }
});

router.post('/integrity', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }

    const result = await verifyLedgerIntegrity();
    const docCount = await Document.countDocuments();

    await recordAudit({
      action: 'LEDGER_CHECK',
      detail: `Cryptographic audit ledger validation: ${result.message}`,
      userId: req.user._id,
      userName: req.user.name,
      ip: req.ip
    });

    res.json({
      ok: result.valid,
      blocks: result.count,
      documents: docCount,
      problems: result.valid ? [] : [{ index: result.brokenIndex, reason: result.reason }],
      message: result.message
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check integrity.' });
  }
});

// 6. Invites (placeholder)
router.get('/invites', (req, res) => {
  res.json([]);
});

router.post('/invites', (req, res) => {
  res.json({ ok: true });
});

router.delete('/invites/:id', (req, res) => {
  res.json({ ok: true });
});

module.exports = router;
