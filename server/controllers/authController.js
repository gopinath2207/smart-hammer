const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { query, getClient } = require('../config/db');

// ─────────────────────────────────────────────
// Helper — generate JWT
// ─────────────────────────────────────────────
const generateToken = (user) => {
  return jwt.sign(
    {
      user_id  : user.user_id,
      email    : user.email,
      role     : user.role,
      username : user.username,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// ─────────────────────────────────────────────
// Helper — sanitize user for response
// ─────────────────────────────────────────────
const sanitizeUser = (user) => {
  const { password_hash, ...safe } = user;
  return safe;
};

// ─────────────────────────────────────────────
// @route   POST /api/auth/register
// @access  Public
// ─────────────────────────────────────────────
const register = async (req, res, next) => {
  const client = await getClient();
  try {
    const { username, email, password, full_name, phone, role } = req.body;

    // ── Validation ──────────────────────────
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required.',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters.',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
    }

    // Only admin can register employees
    const allowedPublicRoles = ['buyer', 'seller'];
    const assignedRole = allowedPublicRoles.includes(role) ? role : 'buyer';

    // ── Check duplicates ─────────────────────
    const existing = await query(
      `SELECT user_id FROM users
       WHERE email = $1 OR username = $2`,
      [email.toLowerCase(), username.toLowerCase()]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email or username already in use.',
      });
    }

    // ── Hash password ────────────────────────
    const salt          = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);

    // ── Insert user ──────────────────────────
    await client.query('BEGIN');

    const userResult = await client.query(
      `INSERT INTO users
         (username, email, password_hash, full_name, phone, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        username.toLowerCase(),
        email.toLowerCase(),
        password_hash,
        full_name || null,
        phone     || null,
        assignedRole,
      ]
    );

    const newUser = userResult.rows[0];
    await client.query('COMMIT');

    const token = generateToken(newUser);

    res.status(201).json({
      success : true,
      message : 'Account created successfully.',
      token,
      user    : sanitizeUser(newUser),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/auth/register-employee
// @access  Admin only
// ─────────────────────────────────────────────
const registerEmployee = async (req, res, next) => {
  const client = await getClient();
  try {
    const {
      username, email, password, full_name, phone,
      department, designation, employee_code,
      can_manage_auctions, can_manage_users,
      can_manage_payments, can_view_reports,
    } = req.body;

    if (!username || !email || !password || !employee_code) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, password, and employee code are required.',
      });
    }

    // Check duplicates
    const existing = await query(
      `SELECT user_id FROM users WHERE email = $1 OR username = $2`,
      [email.toLowerCase(), username.toLowerCase()]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email or username already in use.',
      });
    }

    const codeCheck = await query(
      `SELECT employee_id FROM employee_details WHERE employee_code = $1`,
      [employee_code]
    );
    if (codeCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Employee code already in use.',
      });
    }

    const salt          = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);

    await client.query('BEGIN');

    // Insert user
    const userResult = await client.query(
      `INSERT INTO users
         (username, email, password_hash, full_name, phone, role, is_verified)
       VALUES ($1, $2, $3, $4, $5, 'employee', TRUE)
       RETURNING *`,
      [
        username.toLowerCase(),
        email.toLowerCase(),
        password_hash,
        full_name || null,
        phone     || null,
      ]
    );

    const newUser = userResult.rows[0];

    // Insert employee details
    await client.query(
      `INSERT INTO employee_details
         (user_id, department, designation, employee_code,
          can_manage_auctions, can_manage_users,
          can_manage_payments, can_view_reports)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        newUser.user_id,
        department          || null,
        designation         || null,
        employee_code,
        can_manage_auctions  ?? true,
        can_manage_users     ?? false,
        can_manage_payments  ?? false,
        can_view_reports     ?? true,
      ]
    );

    await client.query('COMMIT');

    const token = generateToken(newUser);

    res.status(201).json({
      success : true,
      message : 'Employee account created successfully.',
      token,
      user    : sanitizeUser(newUser),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/auth/login
// @access  Public
// ─────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    // Fetch user
    const result = await query(
      `SELECT * FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const user = result.rows[0];

    if (user.is_banned) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been banned. Contact support.',
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // If employee — also fetch permissions
    let employeeDetails = null;
    if (user.role === 'employee') {
      const empResult = await query(
        `SELECT department, designation, employee_code,
                can_manage_auctions, can_manage_users,
                can_manage_payments, can_view_reports
         FROM employee_details WHERE user_id = $1`,
        [user.user_id]
      );
      employeeDetails = empResult.rows[0] || null;
    }

    const token = generateToken(user);

    res.status(200).json({
      success : true,
      message : 'Login successful.',
      token,
      user    : {
        ...sanitizeUser(user),
        ...(employeeDetails && { employee: employeeDetails }),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/auth/me
// @access  Private
// ─────────────────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.*,
              ed.department, ed.designation, ed.employee_code,
              ed.can_manage_auctions, ed.can_manage_users,
              ed.can_manage_payments, ed.can_view_reports
       FROM users u
       LEFT JOIN employee_details ed ON u.user_id = ed.user_id
       WHERE u.user_id = $1`,
      [req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    res.status(200).json({
      success : true,
      user    : sanitizeUser(result.rows[0]),
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// @route   PUT /api/auth/change-password
// @access  Private
// ─────────────────────────────────────────────
const changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        message: 'Current and new password are required.',
      });
    }

    if (new_password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters.',
      });
    }

    const result = await query(
      `SELECT password_hash FROM users WHERE user_id = $1`,
      [req.user.user_id]
    );

    const isMatch = await bcrypt.compare(
      current_password,
      result.rows[0].password_hash
    );

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect.',
      });
    }

    const salt     = await bcrypt.genSalt(12);
    const newHash  = await bcrypt.hash(new_password, salt);

    await query(
      `UPDATE users SET password_hash = $1 WHERE user_id = $2`,
      [newHash, req.user.user_id]
    );

    res.status(200).json({
      success : true,
      message : 'Password changed successfully.',
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/auth/logout
// @access  Private
// ─────────────────────────────────────────────
const logout = (req, res) => {
  // JWT is stateless — client deletes the token
  // If you add a token blacklist (Redis) later, invalidate here
  res.status(200).json({
    success : true,
    message : 'Logged out successfully.',
  });
};

module.exports = {
  register,
  registerEmployee,
  login,
  getMe,
  changePassword,
  logout,
};