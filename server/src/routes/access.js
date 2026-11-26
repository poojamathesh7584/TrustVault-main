const express = require('express');
const AccessRequest = require('../models/AccessRequest');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { recordAudit } = require('../lib/auditLedger');

const router = express.Router();

// 1. GET /api/access - List access requests
router.get('/', authMiddleware, async (req, res) => {
  try {
    const isStudent = req.user.role === 'student';
    let filter;

    if (isStudent) {
      const userEmail = (req.user.email || '').toLowerCase().trim();
      const userRoll = (req.user.roll || '').toUpperCase().trim();
      filter = {
        $or: [
          { studentId: req.user._id },
          ...(userEmail ? [{ targetEmail: userEmail }] : []),
          ...(userRoll ? [{ targetRoll: userRoll }] : [])
        ]
      };

      // Automatically link any unlinked requests sent to this student's email/roll
      if (userEmail || userRoll) {
        await AccessRequest.updateMany(
          {
            $or: [
              ...(userEmail ? [{ targetEmail: userEmail }] : []),
              ...(userRoll ? [{ targetRoll: userRoll }] : [])
            ],
            studentId: { $ne: req.user._id }
          },
          { $set: { studentId: req.user._id } }
        );
      }
    } else {
      filter = { facultyId: req.user._id };
    }

    const list = await AccessRequest.find(filter)
      .populate('studentId', 'name email roll dept')
      .populate('facultyId', 'name email dept')
      .sort({ requestedAt: -1 });

    const formatted = list.map((item) => ({
      id: item._id.toString(),
      _id: item._id.toString(),
      student: item.studentId || {
        name: item.targetRoll ? `Student ${item.targetRoll}` : (item.targetEmail ? item.targetEmail.split('@')[0] : 'Student'),
        email: item.targetEmail || 'student@trustvault.edu',
        roll: item.targetRoll || '26MX337'
      },
      faculty: item.facultyId,
      verifier: {
        name: item.facultyId?.name || 'Dr. Priya Raman',
        email: item.facultyId?.email || 'priya.raman@trustvault.demo',
        role: 'verifier',
        dept: item.facultyId?.dept || 'Department of Computer Applications'
      },
      verifierDept: item.facultyId?.dept || 'Department of Computer Applications',
      types: item.types,
      granted: item.granted,
      reason: item.reason,
      status: item.status,
      opened: item.opened || 0,
      requestedAt: item.requestedAt,
      expiresAt: item.expiresAt
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. POST /api/access/:id - Respond to access request (approve, deny, revoke)
router.post('/:id', authMiddleware, async (req, res) => {
  try {
    const { decision = 'approve', types } = req.body || {};
    let status = 'approved';
    if (decision === 'deny') status = 'denied';
    if (decision === 'revoke') status = 'revoked';

    const reqDoc = await AccessRequest.findById(req.params.id).populate('facultyId', 'name');
    if (!reqDoc) {
      return res.status(404).json({ error: 'Access request not found.' });
    }

    reqDoc.status = status;
    reqDoc.respondedAt = new Date();
    if (status === 'approved') {
      reqDoc.granted = types && types.length ? types : reqDoc.types;
      reqDoc.expiresAt = new Date(Date.now() + 7 * 86400000);
    }
    await reqDoc.save();

    await recordAudit({
      action: `ACCESS_${status.toUpperCase()}`,
      detail: `Student ${req.user.name} set access to ${status} for ${reqDoc.facultyId?.name || 'Faculty'}`,
      userId: req.user._id,
      userName: req.user.name,
      ip: req.ip
    });

    res.json({ ok: true, request: reqDoc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

