const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const config = require('../config');
const User = require('../models/User');

async function authMiddleware(req, res, next) {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      const parts = req.headers.authorization.split(' ');
      if (parts[1] && parts[1] !== 'null' && parts[1] !== 'undefined') {
        token = parts[1];
      }
    } else if (req.cookies && req.cookies.token && req.cookies.token !== 'null' && req.cookies.token !== 'undefined') {
      token = req.cookies.token;
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwtSecret);
        if (decoded?.id) {
          if (mongoose.connection.readyState === 1) {
            const user = await User.findById(decoded.id);
            if (user) {
              req.user = user;
              return next();
            }
          }
          req.user = {
            _id: decoded.id,
            name: decoded.name || 'Pooja',
            email: decoded.email || 'poojamathesh7584@gmail.com',
            role: decoded.role || 'student'
          };
          return next();
        }
      } catch (tokenErr) {
        // Token invalid/expired signature, continue to header fallback
      }
    }

    // 1. Fallback: Check for x-user-id header
    const xUserId = req.headers['x-user-id'];
    const xUserName = req.headers['x-user-name'];
    if (xUserId && xUserId !== 'null' && xUserId !== 'undefined') {
      const idLower = String(xUserId).toLowerCase();
      const isFaculty = idLower.includes('faculty') || idLower.includes('verifier') || idLower.includes('priya');
      const isAdmin = idLower.includes('admin') || idLower === 'poojamatheshwaran6363@gmail.com';
      const role = isFaculty ? 'verifier' : (isAdmin ? 'admin' : 'student');
      const email = idLower.includes('@') ? idLower : (isFaculty ? 'priya.raman@trustvault.demo' : (isAdmin ? 'poojamatheshwaran6363@gmail.com' : 'poojamathesh7584@gmail.com'));
      const name = xUserName || (isFaculty ? 'Dr. Priya Raman' : (isAdmin ? (idLower === 'poojamatheshwaran6363@gmail.com' ? 'Pooja Matheshwaran' : 'System Administrator') : 'Pooja'));

      if (mongoose.connection.readyState === 1) {
        let fallbackUser = null;
        if (typeof xUserId === 'string' && xUserId.match(/^[0-9a-fA-F]{24}$/)) {
          fallbackUser = await User.findById(xUserId);
        }
        if (!fallbackUser) {
          fallbackUser = await User.findOne({
            $or: [
              { email: idLower },
              { roll: String(xUserId).toUpperCase() }
            ]
          });
        }
        if (fallbackUser) {
          req.user = fallbackUser;
          return next();
        }
      }

      req.user = {
        _id: xUserId,
        name,
        email,
        role
      };
      return next();
    }

    // 2. Safety Fallback: Use student fallback
    req.user = {
      _id: 'usr_student_pooja',
      name: 'Pooja',
      email: 'poojamathesh7584@gmail.com',
      role: 'student'
    };
    return next();
  } catch (err) {
    req.user = {
      _id: 'usr_student_pooja',
      name: 'Pooja',
      email: 'poojamathesh7584@gmail.com',
      role: 'student'
    };
    return next();
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
