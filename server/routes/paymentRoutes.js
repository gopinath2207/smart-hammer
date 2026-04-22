const express = require('express');
const router  = express.Router();

const { createPayment, getPaymentStatus } = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');

// POST /api/payments/create  — process (fake) payment for won auction
router.post('/create', authenticate, createPayment);

// GET  /api/payments/:auctionId — get payment status / checkout info
router.get('/:auctionId', authenticate, getPaymentStatus);

module.exports = router;
