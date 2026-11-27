const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const config = require('../config');
const User = require('../models/User');

async function authMiddleware(req, res, next) {
  try {
    let token = null;

    // Extract token from Authorization header or cookie
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      const parts = req.headers.authorization.split(' ');
      if (parts[1] && parts[1] !== 'null' && parts[1] !== 'undefined') {
        token = parts[1];
      }
    } else if (req.cookies && req.cookies.token && req.cookies.token !== 'null' && req.cookies.token !== 'undefined') {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (tokenErr) {
      if (tokenErr.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Session expired. Please sign in again.' });
      }
      return res.status(401).json({ error: 'Invalid authentication token.' });
    }

    if (!decoded?.id) {
      return res.status(401).json({ error: 'Invalid token payload.' });
    }

    // Retrieve user from database
    if (mongoose.connection.readyState === 1) {
      const user = await User.findById(decoded.id);
      if (!user) {
        return res.status(401).json({ error: 'User account not found.' });
      }
      if (user.locked || user.status === 'suspended') {
        return res.status(403).json({ error: 'Account is locked or suspended. Contact an administrator to unlock.' });
      }
      req.user = user;
      return next();
    }

    // DB disconnected — use token claims only for read-only ops
    req.user = {
      _id: decoded.id,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role,
      save: async () => { throw new Error('Database is disconnected.'); }
    };
    return next();
  } catch (err) {
    console.error('[Auth] Middleware error:', err.message);
    return res.status(500).json({ error: 'Authentication service error.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden: requires ${roles.join(' or ')} role.` });
    }
    next();
  };
}

module.exports = {
  authMiddleware,
  requireRole
};
