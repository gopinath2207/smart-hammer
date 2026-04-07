const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

// ─────────────────────────────────────────────
// Verify JWT Token
// ─────────────────────────────────────────────
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user from DB (catches banned/deleted users)
    const result = await query(
      `SELECT user_id, username, email, role, is_verified, is_banned
       FROM users WHERE user_id = $1`,
      [decoded.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists.',
      });
    }

    const user = result.rows[0];

    if (user.is_banned) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been banned. Contact support.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// Role-Based Access Control
// ─────────────────────────────────────────────
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}.`,
      });
    }

    next();
  };
};

// ─────────────────────────────────────────────
// Employee Permission Check
// ─────────────────────────────────────────────
const checkEmployeePermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (req.user.role === 'admin') return next(); // admin bypasses all

      if (req.user.role !== 'employee') {
        return res.status(403).json({
          success: false,
          message: 'Access denied.',
        });
      }

      const result = await query(
        `SELECT ${permission} FROM employee_details
         WHERE user_id = $1`,
        [req.user.user_id]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Employee profile not found.',
        });
      }

      if (!result.rows[0][permission]) {
        return res.status(403).json({
          success: false,
          message: `You do not have permission: ${permission}.`,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

// ─────────────────────────────────────────────
// Optional Auth (public routes that change
// behavior when logged in e.g. watchlist status)
// ─────────────────────────────────────────────
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await query(
      `SELECT user_id, username, email, role, is_verified, is_banned
       FROM users WHERE user_id = $1`,
      [decoded.user_id]
    );

    req.user = result.rows.length > 0 && !result.rows[0].is_banned
      ? result.rows[0]
      : null;

    next();
  } catch (err) {
    req.user = null;
    next();
  }
};

module.exports = {
  authenticate,
  authorizeRoles,
  checkEmployeePermission,
  optionalAuth,
};