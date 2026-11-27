const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const AccessRequest = require('../models/AccessRequest');
const { authMiddleware } = require('../middleware/auth');
const { hashPassword, comparePassword } = require('../lib/crypto');
const { recordAudit } = require('../lib/auditLedger');
const { logActivity } = require('../lib/activityLogger');
const { validateEmailAddress, sendOtpEmail } = require('../lib/mailer');
const { getStoredOtp, setStoredOtp, isOtpMatch, deleteOtp } = require('../lib/otpStore');

const router = express.Router();

const AUTHORIZED_FACULTY_EMAILS = [
  'priya.raman@trustvault.demo',
  'faculty@college.edu',
  'verifier@trustvault.demo'
];
const AUTHORIZED_ADMIN_EMAILS = [
  'poojamatheshwaran6363@gmail.com',
  'admin@trustvault.demo'
];

// --- Rate Limiting (in-memory, per-IP) ---
const loginAttempts = new Map();
const OTP_RATE_LIMIT = 5;    // max OTP sends per 15 min
const LOGIN_RATE_LIMIT = 10;  // max login attempts per 15 min
const RATE_WINDOW_MS = 15 * 60 * 1000;

function checkRateLimit(key, limit) {
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (!record || (now - record.windowStart) > RATE_WINDOW_MS) {
    loginAttempts.set(key, { windowStart: now, count: 1 });
    return true;
  }
  if (record.count >= limit) {
    return false;
  }
  record.count++;
  return true;
}

// Clean up rate limiter every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of loginAttempts) {
    if (now - val.windowStart > RATE_WINDOW_MS) loginAttempts.delete(key);
  }
}, 30 * 60 * 1000);

async function ensureStaffAccount(email, role = 'verifier', name) {
  const cleanEmail = email.toLowerCase().trim();
  let user = await User.findOne({ email: cleanEmail });
  if (!user) {
    const hashedPass = await hashPassword('TrustVault@2026');
    if (role === 'verifier') {
      user = await User.create({
        name: name || 'Faculty Member',
        email: cleanEmail,
        password: hashedPass,
        role: 'verifier',
        dept: 'Department of Computer Applications',
        hasVaultPin: false
      });
    } else if (role === 'admin') {
      user = await User.create({
        name: name || 'System Administrator',
        email: cleanEmail,
        password: hashedPass,
        role: 'admin',
        dept: 'Central Examination & Verification Cell',
        hasVaultPin: false
      });
    }
  }
  return user;
}

function createToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role, name: user.name },
    config.jwtSecret,
    { expiresIn: '60m' }
  );
}

function sanitizeUserOutput(user) {
  const obj = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
  delete obj.password;
  delete obj.vaultPin;
  delete obj.__v;
  return obj;
}

// 1. Session check: GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    let pendingAccess = 0;
    if (user.role === 'student' && mongoose.connection.readyState === 1) {
      const userEmail = (user.email || '').toLowerCase().trim();
      const userRoll = (user.roll || user.studentId || '').toUpperCase().trim();
      try {
        pendingAccess = await AccessRequest.countDocuments({
          status: 'pending',
          $or: [
            ...(mongoose.isValidObjectId(user._id) ? [{ studentId: user._id }] : []),
            ...(userEmail ? [{ targetEmail: userEmail }] : []),
            ...(userRoll ? [{ targetRoll: userRoll }] : [])
          ]
        });
      } catch {}
    }

    res.json({
      user: sanitizeUserOutput(user),
      expiresAt: Date.now() + 60 * 60 * 1000,
      pendingAccess,
      vaultUnlocked: false,
      elevatedUntil: null
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve session.' });
  }
});

// 2. Student-Only Sign Up: POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, roll, email, password, dept } = req.body || {};

    if (!name || !roll || !email || !password) {
      return res.status(400).json({ error: 'Full name, roll number, email, and password are required.' });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    const rateLimitKey = `register:${req.ip}`;
    if (!checkRateLimit(rateLimitKey, LOGIN_RATE_LIMIT)) {
      return res.status(429).json({ error: 'Too many registration attempts. Please try again later.' });
    }

    const validation = await validateEmailAddress(email);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database is currently unavailable. Please try again later.' });
    }

    const cleanEmail = validation.email;
    const cleanRoll = String(roll).trim().toUpperCase();
    const cleanName = String(name).trim().substring(0, 100);
    const batchMatch = cleanRoll.match(/^([0-9]{2}[A-Za-z]{1,4})/i);
    const batchCode = batchMatch ? batchMatch[1].toUpperCase() : '26MX';

    const existing = await User.findOne({
      $or: [{ email: cleanEmail }, { roll: cleanRoll }]
    });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email or roll number already exists. Please sign in.' });
    }

    const user = await User.create({
      name: cleanName,
      email: cleanEmail,
      password: await hashPassword(password),
      role: 'student',
      roll: cleanRoll,
      batch: batchCode,
      dept: (dept && String(dept).trim()) || 'Department of Computer Applications',
      hasVaultPin: false
    });

    const token = createToken(user);
    res.cookie('token', token, {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000
    });

    await logActivity({
      action: 'STUDENT_REGISTER',
      detail: `New student registered: ${user.name} (${user.roll})`,
      userId: user._id,
      userName: user.name,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || ''
    });

    await recordAudit({
      action: 'STUDENT_REGISTER',
      detail: `Student self-registration: ${user.name} (${user.email}, ${user.roll})`,
      userId: user._id,
      userName: user.name,
      ip: req.ip
    });

    res.status(201).json({
      ok: true,
      next: 'enter',
      token,
      user: sanitizeUserOutput(user)
    });
  } catch (err) {
    console.error('[Auth] Register error:', err.message);
    res.status(500).json({ error: 'Registration service error. Please try again.' });
  }
});

// 3. Regular Login (Email + Password for Student, Faculty, Admin): POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password, as } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Rate limiting
    const rateLimitKey = `login:${req.ip}`;
    if (!checkRateLimit(rateLimitKey, LOGIN_RATE_LIMIT)) {
      return res.status(429).json({ error: 'Too many login attempts. Please try again in 15 minutes.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const normalizedEmail = cleanEmail.includes('@') ? cleanEmail : `${cleanEmail}@trustvault.edu`;

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database is currently unavailable. Please try again later.' });
    }

    const user = await User.findOne({
      $or: [
        { email: cleanEmail },
        { email: normalizedEmail },
        { roll: new RegExp(`^${cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      ]
    });

    if (!user) {
      return res.status(401).json({
        error: as === 'verifier' || as === 'faculty'
          ? 'Invalid faculty credentials. Contact your administrator for your assigned email and password.'
          : as === 'admin'
            ? 'Invalid administrator credentials.'
            : 'Invalid email or password. New students can create an account on Sign Up.'
      });
    }

    if (user.locked || user.status === 'suspended') {
      return res.status(403).json({
        error: 'Account is locked due to too many failed OTP attempts. Contact the Administrator to unlock your account.',
        locked: true
      });
    }

    // Verify password
    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      await logActivity({
        action: 'LOGIN_FAILED',
        detail: `Failed login attempt for ${user.email}`,
        userId: user._id,
        userName: user.name,
        ip: req.ip,
        userAgent: req.headers['user-agent'] || ''
      });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Role check
    if (as) {
      const requestedRole = as === 'faculty' ? 'verifier' : as.toLowerCase();
      if (user.role !== requestedRole) {
        return res.status(403).json({
          error: `Access Denied: This account is registered as ${user.role === 'verifier' ? 'Faculty' : user.role}, not ${requestedRole === 'verifier' ? 'Faculty' : requestedRole}.`
        });
      }
    }

    // Generate 6-digit OTP and send to the user's registered email
    const crypto = require('crypto');
    const code = String(crypto.randomInt(100000, 999999));
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    await setStoredOtp(user.email, {
      code,
      expiresAt,
      role: user.role,
      name: user.name,
      roll: user.roll || ''
    });

    const mailResult = await sendOtpEmail({ to: user.email, code, name: user.name });

    await logActivity({
      action: 'OTP_SENT',
      detail: `Sign-in OTP dispatched to ${user.email} (${user.role})`,
      userId: user._id,
      userName: user.name,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || ''
    });

    const responseData = {
      ok: true,
      next: 'otp',
      email: user.email,
      role: user.role,
      sent: mailResult.sent,
      message: mailResult.sent
        ? `A 6-digit verification code has been sent to ${user.email}.`
        : `Verification code generated for ${user.email}. Check server logs or SMTP settings.`,
      expiresIn: 600
    };

    if (config.env === 'development') {
      responseData.code = code;
    }

    res.json(responseData);
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    res.status(500).json({ error: 'Login service error. Please try again.' });
  }
});

// 3. Send OTP: POST /api/auth/otp/send
router.post('/otp/send', async (req, res) => {
  try {
    const { email, password, role = 'student', name, roll } = req.body || {};

    // Rate limiting for OTP
    const rateLimitKey = `otp:${req.ip}`;
    if (!checkRateLimit(rateLimitKey, OTP_RATE_LIMIT)) {
      return res.status(429).json({ error: 'Too many OTP requests. Please try again in 15 minutes.' });
    }

    const validation = await validateEmailAddress(email);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const cleanEmail = validation.email;
    const detectedRoll = roll || validation.roll || cleanEmail.split('@')[0].toUpperCase();

    const targetRole = role === 'faculty' ? 'verifier' : (role || 'student').toLowerCase();

    // Faculty & Admin authorization check
    if (targetRole === 'verifier' || targetRole === 'admin') {
      let dbStaff = null;
      if (mongoose.connection.readyState === 1) {
        dbStaff = await User.findOne({ email: cleanEmail });
      }
      const isAllowed = targetRole === 'admin'
        ? (AUTHORIZED_ADMIN_EMAILS.includes(cleanEmail) || dbStaff?.role === 'admin')
        : (AUTHORIZED_FACULTY_EMAILS.includes(cleanEmail) || dbStaff?.role === 'verifier');
      if (!isAllowed) {
        return res.status(403).json({
          error: `Access Denied: '${cleanEmail}' is not authorized as ${targetRole === 'admin' ? 'administrator' : 'faculty'}.`
        });
      }
      if (mongoose.connection.readyState === 1 && !dbStaff) {
        await ensureStaffAccount(cleanEmail, targetRole, name);
      }
    }

    // Verify password if provided
    if (password && mongoose.connection.readyState === 1) {
      const dbUser = await User.findOne({ email: cleanEmail });
      if (dbUser) {
        const isMatch = await comparePassword(password, dbUser.password);
        if (!isMatch) {
          return res.status(401).json({ error: 'Incorrect password.' });
        }
      }
    }

    // Generate secure 6-digit OTP using crypto
    const crypto = require('crypto');
    const code = String(crypto.randomInt(100000, 999999));
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes (reduced from 15)

    const otpData = { code, expiresAt, role: targetRole, name: name || '', roll: detectedRoll };
    await setStoredOtp(cleanEmail, otpData);
    if (detectedRoll) {
      await setStoredOtp(detectedRoll.toLowerCase(), otpData);
    }

    // Send OTP email
    const mailResult = await sendOtpEmail({ to: cleanEmail, code, name });

    await logActivity({
      action: 'OTP_SENT',
      detail: `Verification code dispatched to ${cleanEmail} (${targetRole})`,
      userName: name || cleanEmail,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || ''
    });

    // Don't expose the OTP code in the API response in production!
    const responseData = {
      ok: true,
      sent: mailResult.sent,
      delivery: mailResult.mode,
      message: mailResult.sent
        ? `A 6-digit verification code has been sent to ${cleanEmail}.`
        : `Verification code generated for ${cleanEmail}.`,
      email: cleanEmail,
      roll: detectedRoll,
      expiresIn: 600
    };

    // Only include OTP code in development mode for testing
    if (config.env === 'development') {
      responseData.code = code;
    }

    res.json(responseData);
  } catch (err) {
    console.error('[Auth] OTP send error:', err.message);
    res.status(500).json({ error: 'Failed to send verification code.' });
  }
});

// 4. Verify OTP: POST /api/auth/otp/verify
router.post('/otp/verify', async (req, res) => {
  try {
    const { email, code, role: reqRole = 'student', name, roll } = req.body || {};
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required.' });
    }

    // Rate limiting
    const rateLimitKey = `otp-verify:${req.ip}`;
    if (!checkRateLimit(rateLimitKey, LOGIN_RATE_LIMIT)) {
      return res.status(429).json({ error: 'Too many verification attempts. Please try again later.' });
    }

    let cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail.includes('@')) {
      cleanEmail = `${cleanEmail}@trustvault.edu`;
    }

    const cleanCode = String(code).trim();
    const cleanRoll = roll ? String(roll).trim().toUpperCase() : '';

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database is currently unavailable.' });
    }

    // Verify OTP from database with 5-attempt lockout
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser && (existingUser.locked || existingUser.status === 'suspended')) {
      return res.status(403).json({
        error: 'Account is locked due to 5 failed OTP attempts. Please contact the Administrator to unlock.',
        locked: true
      });
    }

    const recordByEmail = await getStoredOtp(cleanEmail);
    const recordByRoll = cleanRoll ? await getStoredOtp(cleanRoll.toLowerCase()) : null;
    const isCodeValid = isOtpMatch(recordByEmail, cleanCode) || isOtpMatch(recordByRoll, cleanCode);

    if (!isCodeValid) {
      if (existingUser) {
        existingUser.failedOtpAttempts = (existingUser.failedOtpAttempts || 0) + 1;
        if (existingUser.failedOtpAttempts >= 5) {
          existingUser.locked = true;
          existingUser.lockReason = 'Locked after 5 consecutive failed OTP attempts';
          await existingUser.save();
          await deleteOtp(cleanEmail);

          await logActivity({
            action: 'ACCOUNT_LOCKED',
            detail: `Account locked after 5 failed OTP attempts for ${cleanEmail}`,
            userId: existingUser._id,
            userName: existingUser.name,
            ip: req.ip,
            userAgent: req.headers['user-agent'] || ''
          });
          await recordAudit({
            action: 'ACCOUNT_LOCKED',
            detail: `Account ${cleanEmail} locked after 5 failed OTP attempts`,
            userId: existingUser._id,
            userName: existingUser.name,
            ip: req.ip
          });

          return res.status(403).json({
            error: 'Account locked after 5 failed OTP attempts. Contact the Administrator to unlock.',
            locked: true
          });
        }
        await existingUser.save();
        const left = 5 - existingUser.failedOtpAttempts;
        await logActivity({
          action: 'OTP_FAILED',
          detail: `Invalid OTP attempt (${existingUser.failedOtpAttempts}/5) for ${cleanEmail}`,
          userId: existingUser._id,
          userName: existingUser.name,
          ip: req.ip,
          userAgent: req.headers['user-agent'] || ''
        });
        return res.status(400).json({
          error: `Invalid or expired verification code. ${left} attempt${left === 1 ? '' : 's'} remaining before lock.`,
          attemptsLeft: left
        });
      }

      await logActivity({
        action: 'OTP_FAILED',
        detail: `Invalid OTP attempt for ${cleanEmail}`,
        ip: req.ip,
        userAgent: req.headers['user-agent'] || ''
      });
      return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }

    // Reset failed OTP attempts on success
    if (existingUser && existingUser.failedOtpAttempts > 0) {
      existingUser.failedOtpAttempts = 0;
      await existingUser.save();
    }

    // Delete used OTP to prevent reuse
    await deleteOtp(cleanEmail);
    if (cleanRoll) await deleteOtp(cleanRoll.toLowerCase());

    const record = recordByEmail || recordByRoll;
    const targetRole = record?.role || reqRole || 'student';
    const normalizedRole = targetRole === 'faculty' ? 'verifier' : targetRole.toLowerCase();

    // Faculty & Admin authorization check
    if (normalizedRole === 'verifier' || normalizedRole === 'admin') {
      const dbStaff = await User.findOne({ email: cleanEmail });
      const isAllowed = normalizedRole === 'admin'
        ? (AUTHORIZED_ADMIN_EMAILS.includes(cleanEmail) || dbStaff?.role === 'admin')
        : (AUTHORIZED_FACULTY_EMAILS.includes(cleanEmail) || dbStaff?.role === 'verifier');
      if (!isAllowed) {
        return res.status(403).json({
          error: `Access Denied: '${cleanEmail}' is not authorized as ${normalizedRole}.`
        });
      }
      if (!dbStaff) {
        await ensureStaffAccount(cleanEmail, normalizedRole, name || record?.name);
      }
    }

    // Find or create user
    let user = await User.findOne({ email: cleanEmail });

    const derivedRoll = (roll || record?.roll || cleanEmail.split('@')[0].toUpperCase()).toUpperCase();
    const derivedName = name || record?.name || cleanEmail.split('@')[0].replace(/[._]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const batchMatch = derivedRoll.match(/^([0-9]{2}[A-Za-z]{1,4})/i);
    const batchCode = batchMatch ? batchMatch[1].toUpperCase() : '26MX';

    if (!user) {
      user = await User.create({
        name: derivedName,
        email: cleanEmail,
        password: await hashPassword('TrustVault@2026'),
        role: normalizedRole,
        roll: derivedRoll,
        batch: batchCode,
        dept: 'Department of Computer Applications',
        hasVaultPin: false
      });
    }

    const token = createToken(user);
    res.cookie('token', token, {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000
    });

    await logActivity({
      action: 'LOGIN_OTP',
      detail: `Signed in via OTP as ${user.name} (${user.role})`,
      userId: user._id,
      userName: user.name,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || ''
    });

    await recordAudit({
      action: 'LOGIN_OTP',
      detail: `Signed in via OTP as ${user.name} (${user.role})`,
      userId: user._id,
      userName: user.name,
      ip: req.ip
    });

    res.json({
      ok: true,
      token,
      user: sanitizeUserOutput(user)
    });
  } catch (err) {
    console.error('[Auth] OTP verify error:', err.message);
    res.status(500).json({ error: 'Verification service error.' });
  }
});

// 5. 2FA TOTP verification: POST /api/auth/login/totp
router.post('/login/totp', async (req, res) => {
  try {
    const { code, email } = req.body || {};
    if (!code || !email) {
      return res.status(400).json({ error: '2FA code and email are required.' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database is currently unavailable.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'User not found.' });
    }

    // Verify the user has a vault PIN and it matches
    if (user.hasVaultPin && user.vaultPin) {
      if (code !== user.vaultPin) {
        return res.status(400).json({ error: 'Invalid 2FA code.' });
      }
    }

    const token = createToken(user);
    res.cookie('token', token, {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000
    });

    res.json({
      ok: true,
      token,
      user: sanitizeUserOutput(user)
    });
  } catch (err) {
    res.status(500).json({ error: 'Authentication error.' });
  }
});

// 6. Logout: POST /api/auth/logout
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    await logActivity({
      action: 'LOGOUT',
      detail: `User ${req.user.name} logged out`,
      userId: req.user._id,
      userName: req.user.name,
      ip: req.ip
    });
  } catch {}

  res.clearCookie('token', { httpOnly: true, sameSite: 'lax' });
  res.json({ ok: true });
});

// 7. Activity Log: GET /api/auth/activity
router.get('/activity', authMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const Audit = require('../models/Audit');
      const ActivityLog = require('../models/ActivityLog');

      // Combine audit ledger entries and activity logs
      const filter = req.user.role === 'admin' ? {} : { userId: req.user._id };
      const [auditLogs, activityLogs] = await Promise.all([
        Audit.find(filter).sort({ at: -1 }).limit(50),
        ActivityLog.find(filter).sort({ createdAt: -1 }).limit(50)
      ]);

      // Merge and sort by timestamp
      const combined = [
        ...auditLogs.map(l => ({
          id: l._id.toString(),
          action: l.action,
          detail: l.detail,
          user: { name: l.userName },
          ip: l.ip,
          at: l.at,
          source: 'audit'
        })),
        ...activityLogs.map(l => ({
          id: l._id.toString(),
          action: l.action,
          detail: l.detail,
          user: { name: l.userName },
          ip: l.ip,
          at: l.createdAt,
          source: 'activity'
        }))
      ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 50);

      return res.json(combined);
    }
    res.json([]);
  } catch (err) {
    console.error('[Auth] Activity error:', err.message);
    res.json([]);
  }
});

// 8. Sessions: GET /api/auth/sessions
router.get('/sessions', authMiddleware, (req, res) => {
  res.json([
    {
      id: 'sess_curr',
      ip: req.ip || '127.0.0.1',
      device: req.headers['user-agent'] || 'Browser Session',
      active: true,
      current: true,
      location: 'Current Network',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      at: new Date().toISOString()
    }
  ]);
});

router.delete('/sessions/:id', authMiddleware, (req, res) => {
  res.json({ ok: true });
});

// 9. Vault Lock / Unlock / PIN
router.post('/vault/unlock', authMiddleware, async (req, res) => {
  const { pin } = req.body || {};
  if (!pin || !req.user.vaultPin) {
    return res.status(400).json({ ok: false, error: 'Vault PIN is required. Please set a PIN first.' });
  }
  if (pin !== req.user.vaultPin) {
    await logActivity({
      action: 'VAULT_UNLOCK_FAILED',
      detail: `Failed vault unlock attempt`,
      userId: req.user._id,
      userName: req.user.name,
      ip: req.ip
    });
    return res.status(400).json({ ok: false, error: 'Incorrect 6-digit Vault PIN.' });
  }

  await logActivity({
    action: 'VAULT_UNLOCKED',
    detail: `Vault unlocked by ${req.user.name}`,
    userId: req.user._id,
    userName: req.user.name,
    ip: req.ip
  });

  res.json({ ok: true, unlocked: true });
});

router.post('/vault/lock', authMiddleware, (req, res) => {
  res.json({ ok: true, unlocked: false });
});

router.post('/vault/pin', authMiddleware, async (req, res) => {
  const { pin } = req.body || {};
  if (!pin || !/^\d{6}$/.test(pin)) {
    return res.status(400).json({ error: 'PIN must be exactly 6 digits.' });
  }
  req.user.vaultPin = pin;
  req.user.hasVaultPin = true;
  await req.user.save();
  res.json({ ok: true });
});

// 10. Security actions
router.post('/password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword, next } = req.body || {};
  const finalPass = newPassword || next;

  if (!finalPass || finalPass.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  // Verify current password before allowing change
  if (currentPassword && mongoose.connection.readyState === 1) {
    const isMatch = await comparePassword(currentPassword, req.user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }
  }

  if (mongoose.connection.readyState === 1 && typeof req.user.save === 'function') {
    req.user.password = await hashPassword(finalPass);
    await req.user.save();
  }

  await recordAudit({
    action: 'PASSWORD_CHANGE',
    detail: `User ${req.user.name} changed security credentials`,
    userId: req.user._id,
    userName: req.user.name,
    ip: req.ip
  });

  await logActivity({
    action: 'PASSWORD_CHANGE',
    detail: `Password changed by ${req.user.name}`,
    userId: req.user._id,
    userName: req.user.name,
    ip: req.ip
  });

  res.json({ ok: true });
});

router.post('/backup-codes', authMiddleware, async (req, res) => {
  // Generate cryptographically random backup codes
  const crypto = require('crypto');
  const codes = Array.from({ length: 8 }, () => {
    const a = crypto.randomInt(1000, 9999);
    const b = crypto.randomInt(1000, 9999);
    return `${a}-${b}`;
  });
  req.user.backupCodes = codes;
  await req.user.save();
  res.json({ codes });
});

router.post('/forget-devices', authMiddleware, (req, res) => {
  res.json({ ok: true });
});

router.patch('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, phone, dept } = req.body || {};
    // Input validation
    if (name && (typeof name !== 'string' || name.length > 100)) {
      return res.status(400).json({ error: 'Invalid name.' });
    }
    if (phone && (typeof phone !== 'string' || phone.length > 20)) {
      return res.status(400).json({ error: 'Invalid phone number.' });
    }
    if (name) req.user.name = name.trim();
    if (phone) req.user.phone = phone.trim();
    if (dept) req.user.dept = dept.trim();
    await req.user.save();
    res.json({ ok: true, user: sanitizeUserOutput(req.user) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

module.exports = router;
