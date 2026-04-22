const { query, getClient } = require('../config/db');

// ─────────────────────────────────────────────
// @route   POST /api/payments/create
// @access  Private (winner only)
// ─────────────────────────────────────────────
const createPayment = async (req, res, next) => {
  const client = await getClient();
  try {
    const { auction_id, card_number, card_name, expiry, cvv } = req.body;

    if (!auction_id) {
      return res.status(400).json({
        success: false,
        message: 'Auction ID is required.',
      });
    }

    // Validate auction exists and user is the winner
    const auctionResult = await query(
      `SELECT auction_id, title, current_price, winner_id, status
       FROM auctions WHERE auction_id = $1`,
      [auction_id]
    );

    if (auctionResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Auction not found.' });
    }

    const auction = auctionResult.rows[0];

    if (auction.status !== 'ended') {
      return res.status(400).json({
        success: false,
        message: 'This auction has not ended yet.',
      });
    }

    if (auction.winner_id !== req.user.user_id) {
      return res.status(403).json({
        success: false,
        message: 'You are not the winner of this auction.',
      });
    }

    // Check if payment already exists
    const existing = await query(
      `SELECT payment_id, status FROM payments
       WHERE auction_id = $1 AND payer_id = $2`,
      [auction_id, req.user.user_id]
    );

    if (existing.rows.length > 0 && existing.rows[0].status === 'completed') {
      return res.status(409).json({
        success: false,
        message: 'Payment already completed for this auction.',
      });
    }

    await client.query('BEGIN');

    let paymentId;

    if (existing.rows.length > 0) {
      // Update existing pending payment to completed
      const updateResult = await client.query(
        `UPDATE payments
         SET status = 'completed',
             paid_at = NOW(),
             stripe_payment_id = $1
         WHERE payment_id = $2
         RETURNING payment_id`,
        [`FAKE_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`, existing.rows[0].payment_id]
      );
      paymentId = updateResult.rows[0].payment_id;
    } else {
      // Insert new completed payment
      const insertResult = await client.query(
        `INSERT INTO payments
           (auction_id, payer_id, amount, currency, status, stripe_payment_id, paid_at)
         VALUES ($1, $2, $3, 'USD', 'completed', $4, NOW())
         RETURNING payment_id`,
        [
          auction_id,
          req.user.user_id,
          parseFloat(auction.current_price),
          `FAKE_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        ]
      );
      paymentId = insertResult.rows[0].payment_id;
    }

    // Insert payment confirmation notification
    await client.query(
      `INSERT INTO notifications (user_id, auction_id, type, message)
       VALUES ($1, $2, 'payment_confirmed', $3)`,
      [
        req.user.user_id,
        auction_id,
        `Payment of $${parseFloat(auction.current_price).toLocaleString()} confirmed for "${auction.title}". Thank you!`,
      ]
    );

    await client.query('COMMIT');

    res.status(200).json({
      success    : true,
      message    : 'Payment completed successfully.',
      payment_id : paymentId,
      amount     : parseFloat(auction.current_price),
      auction_title : auction.title,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/payments/:auctionId
// @access  Private
// ─────────────────────────────────────────────
const getPaymentStatus = async (req, res, next) => {
  try {
    const { auctionId } = req.params;

    const result = await query(
      `SELECT
         p.payment_id,
         p.amount,
         p.status,
         p.currency,
         p.paid_at,
         p.created_at,
         a.title       AS auction_title,
         a.current_price,
         a.image_urls,
         u.username    AS seller_username
       FROM      payments p
       JOIN      auctions a ON p.auction_id = a.auction_id
       JOIN      users    u ON a.seller_id  = u.user_id
       WHERE     p.auction_id = $1
         AND     p.payer_id   = $2`,
      [auctionId, req.user.user_id]
    );

    if (result.rows.length === 0) {
      // No payment yet — return auction info for checkout
      const auctionResult = await query(
        `SELECT
           a.auction_id,
           a.title,
           a.current_price,
           a.image_urls,
           a.winner_id,
           a.status,
           u.username AS seller_username
         FROM auctions a
         JOIN users   u ON a.seller_id = u.user_id
         WHERE a.auction_id = $1`,
        [auctionId]
      );

      if (auctionResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Auction not found.' });
      }

      const auction = auctionResult.rows[0];

      if (auction.winner_id !== req.user.user_id) {
        return res.status(403).json({ success: false, message: 'You are not the winner of this auction.' });
      }

      return res.status(200).json({
        success        : true,
        payment_status : 'pending',
        auction        : auction,
      });
    }

    res.status(200).json({
      success        : true,
      payment_status : result.rows[0].status,
      payment        : result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { createPayment, getPaymentStatus };
