const { query, getClient } = require('../config/db');

// ─────────────────────────────────────────────
// @route   POST /api/bids
// @access  Private (buyer only)
// ─────────────────────────────────────────────
const placeBid = async (req, res, next) => {
  const client = await getClient();
  try {
    const { auction_id, amount } = req.body;

    if (!auction_id || !amount) {
      return res.status(400).json({
        success : false,
        message : 'Auction ID and bid amount are required.',
      });
    }

    const bidAmount = parseFloat(amount);

    if (isNaN(bidAmount) || bidAmount <= 0) {
      return res.status(400).json({
        success : false,
        message : 'Bid amount must be a positive number.',
      });
    }

    // ── Lock auction row to prevent race conditions ──
    await client.query('BEGIN');

    const auctionResult = await client.query(
      `SELECT * FROM auctions WHERE auction_id = $1 FOR UPDATE`,
      [auction_id]
    );

    if (auctionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success : false,
        message : 'Auction not found.',
      });
    }

    const auction = auctionResult.rows[0];

    // ── Validation ────────────────────────────

    // 1. Cannot bid on own auction
    if (auction.seller_id === req.user.user_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success : false,
        message : 'You cannot bid on your own auction.',
      });
    }

    // 2. Auction must be active
    if (auction.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success : false,
        message : `This auction is ${auction.status}. Bidding is not allowed.`,
      });
    }

    // 3. Auction must not be expired
    if (new Date() > new Date(auction.end_time)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success : false,
        message : 'This auction has already ended.',
      });
    }

    // 4. Bid must meet minimum required amount
    const minBid = parseFloat(auction.current_price) === 0
      ? parseFloat(auction.starting_price)
      : parseFloat(auction.current_price) + parseFloat(auction.bid_increment);

    if (bidAmount < minBid) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success : false,
        message : `Bid must be at least $${minBid.toFixed(2)}.`,
        min_bid : minBid,
      });
    }

    // 5. Cannot outbid yourself
    const currentWinner = await client.query(
      `SELECT bidder_id, amount
       FROM   bids
       WHERE  auction_id = $1
         AND  is_winning = TRUE`,
      [auction_id]
    );

    if (
      currentWinner.rows.length > 0 &&
      currentWinner.rows[0].bidder_id === req.user.user_id
    ) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success : false,
        message : 'You are already the highest bidder.',
      });
    }

    // ── Place the bid ─────────────────────────
    const bidResult = await client.query(
      `INSERT INTO bids (auction_id, bidder_id, amount)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [auction_id, req.user.user_id, bidAmount]
    );

    const newBid = bidResult.rows[0];
    await client.query('COMMIT');

    // ── Build bid payload ─────────────────────
    const bidPayload = {
      bid_id          : newBid.bid_id,
      auction_id,
      amount          : bidAmount,
      bidder_username : req.user.username,
      bidder_id       : req.user.user_id,
      min_next_bid    : bidAmount + parseFloat(auction.bid_increment),
      total_bids      : auction.total_bids + 1,
      created_at      : newBid.created_at,
    };

    // ── Emit to entire auction room ───────────
    req.io.to(`auction:${auction_id}`).emit('bid:new', bidPayload);

    // ── Notify outbid user privately ──────────
    if (currentWinner.rows.length > 0) {
      const outbidUser = currentWinner.rows[0];

      req.io.to(`user:${outbidUser.bidder_id}`).emit('bid:outbid', {
        auction_id,
        auction_title : auction.title,
        your_bid      : parseFloat(outbidUser.amount),
        new_bid       : bidAmount,
        message       : `You were outbid on "${auction.title}". New bid: $${bidAmount}`,
      });

      // Save outbid notification to DB
      await query(
        `INSERT INTO notifications (user_id, auction_id, type, message)
         VALUES ($1, $2, 'outbid', $3)`,
        [
          outbidUser.bidder_id,
          auction_id,
          `You were outbid on "${auction.title}". Current price: $${bidAmount}`,
        ]
      );
    }

    res.status(201).json({
      success : true,
      message : 'Bid placed successfully.',
      bid     : bidPayload,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/bids/my-bids
// @access  Private
// ─────────────────────────────────────────────
const getMyBids = async (req, res, next) => {
  try {
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT
         b.bid_id,
         b.amount,
         b.is_winning,
         b.created_at,
         a.auction_id,
         a.title         AS auction_title,
         a.current_price,
         a.end_time,
         a.status        AS auction_status,
         a.image_urls,
         CASE
           WHEN b.is_winning AND a.status = 'ended' THEN 'won'
           WHEN b.is_winning                         THEN 'winning'
           WHEN a.status = 'ended'                   THEN 'lost'
           ELSE 'outbid'
         END AS bid_status
       FROM      bids     b
       JOIN      auctions a ON b.auction_id = a.auction_id
       WHERE     b.bidder_id = $1
       ORDER BY  b.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.user_id, limit, offset]
    );

    res.status(200).json({
      success : true,
      count   : result.rows.length,
      bids    : result.rows,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/bids/won
// @access  Private (buyer)
// ─────────────────────────────────────────────
const getWonAuctions = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT
         a.auction_id,
         a.title,
         a.current_price  AS winning_amount,
         a.end_time,
         a.image_urls,
         u.username       AS seller_username,
         p.status         AS payment_status
       FROM      auctions a
       JOIN      users    u ON a.seller_id  = u.user_id
       LEFT JOIN payments p
              ON a.auction_id = p.auction_id
             AND p.payer_id   = $1
       WHERE  a.winner_id = $1
         AND  a.status    = 'ended'
       ORDER BY a.end_time DESC`,
      [req.user.user_id]
    );

    res.status(200).json({
      success      : true,
      count        : result.rows.length,
      won_auctions : result.rows,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/bids/notifications
// @access  Private
// ─────────────────────────────────────────────
const getNotifications = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT
         n.notification_id,
         n.type,
         n.message,
         n.is_read,
         n.created_at,
         a.title      AS auction_title,
         a.image_urls AS auction_images
       FROM      notifications n
       LEFT JOIN auctions      a ON n.auction_id = a.auction_id
       WHERE     n.user_id = $1
       ORDER BY  n.created_at DESC
       LIMIT 50`,
      [req.user.user_id]
    );

    res.status(200).json({
      success       : true,
      count         : result.rows.length,
      notifications : result.rows,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/bids/notifications/read
// @access  Private
// ─────────────────────────────────────────────
const markNotificationsRead = async (req, res, next) => {
  try {
    await query(
      `UPDATE notifications
       SET    is_read = TRUE
       WHERE  user_id = $1`,
      [req.user.user_id]
    );

    res.status(200).json({
      success : true,
      message : 'All notifications marked as read.',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  placeBid,
  getMyBids,
  getWonAuctions,
  getNotifications,
  markNotificationsRead,
};