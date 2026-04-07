const express = require('express');
const router  = express.Router();

const {
  register,
  registerEmployee,
  login,
  getMe,
  changePassword,
  logout,
} = require('../controllers/authController');

const {
  authenticate,
  authorizeRoles,
} = require('../middleware/auth');

// Public
router.post('/register',          register);
router.post('/login',             login);

// Admin only — create employee accounts
router.post('/register-employee', authenticate, authorizeRoles('admin'), registerEmployee);

// Private
router.get ('/me',                authenticate, getMe);
router.put ('/change-password',   authenticate, changePassword);
router.post('/logout',            authenticate, logout);

module.exports = router;