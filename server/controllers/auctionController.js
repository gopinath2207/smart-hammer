const { query, getClient } = require('../config/db');

// ─────────────────────────────────────────────
// Helper — build filter query dynamically
// ─────────────────────────────────────────────
const buildAuctionFilters = (queryParams) => {
  const conditions = ['1=1'];
  const values = [];
  let idx = 1;

  const { category, status, min_price, max_price, search, seller_id } = queryParams;

  if (category) {
    conditions.push(`c.slug = $${idx++}`);
    values.push(category);
  }
  if (status) {
    conditions.push(`a.status = $${idx++}`);
    values.push(status);
  }
  if (min_price) {
    conditions.push(`a.current_price >= $${idx++}`);
    values.push(parseFloat(min_price));
  }
  if (max_price) {
    conditions.push(`a.current_price <= $${idx++}`);
    values.push(parseFloat(max_price));
  }
  if (search) {
    conditions.push(`(a.title ILIKE $${idx++} OR a.description ILIKE $${idx++})`);
    values.push(`%${search}%`, `%${search}%`);
    idx++;
  }
  if (seller_id) {
    conditions.push(`a.seller_id = $${idx++}`);
    values.push(seller_id);
  }

  return { conditions: conditions.join(' AND '), values, idx };
};

// ─────────────────────────────────────────────
// @route   GET /api/auctions
// @access  Public
// ─────────────────────────────────────────────
const getAllAuctions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const offset = (page - 1) * limit;
    const sort = req.query.sort || 'created_at';
    const order = req.query.order === 'asc' ? 'ASC' : 'DESC';

    const allowedSorts = [
      'created_at', 'end_time', 'current_price', 'total_bids'
    ];
    const sortColumn = allowedSorts.includes(sort) ? sort : 'created_at';

    const { conditions, values, idx } = buildAuctionFilters(req.query);

    // Count total
    const countResult = await query(
      `SELECT COUNT(*) FROM auctions a
       LEFT JOIN categories c ON a.category_id = c.category_id
       WHERE ${conditions}`,
      values
    );
    const total = parseInt(countResult.rows[0].count);

    // Fetch auctions
    const auctionsResult = await query(
      `SELECT
         a.*,
         c.name        AS category_name,
         c.slug        AS category_slug,
         u.username    AS seller_username,
         u.avatar_url  AS seller_avatar,
         u.is_verified AS seller_verified,
         CASE
           WHEN a.end_time < NOW() AND a.status = 'active'
           THEN 'ended'
           ELSE a.status
         END AS computed_status
       FROM auctions a
       LEFT JOIN categories c ON a.category_id  = c.category_id
       LEFT JOIN users      u ON a.seller_id     = u.user_id
       WHERE ${conditions}
       ORDER BY a.${sortColumn} ${order}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, limit, offset]
    );

    res.status(200).json({
      success: true,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      count: auctionsResult.rows.length,
      auctions: auctionsResult.rows,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/auctions/:id
// @access  Public
// ─────────────────────────────────────────────
const getAuctionById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Increment view count
    await query(
      `UPDATE auctions SET views_count = views_count + 1
       WHERE auction_id = $1`,
      [id]
    );

    const result = await query(
      `SELECT
         a.*,
         c.name        AS category_name,
         c.slug        AS category_slug,
         u.username    AS seller_username,
         u.full_name   AS seller_fullname,
         u.avatar_url  AS seller_avatar,
         u.is_verified AS seller_verified,
         w.user_id IS NOT NULL AS is_watched
       FROM auctions a
       LEFT JOIN categories c ON a.category_id = c.category_id
       LEFT JOIN users      u ON a.seller_id    = u.user_id
       LEFT JOIN watchlist  w ON a.auction_id   = w.auction_id
         AND w.user_id = $2
       WHERE a.auction_id = $1`,
      [id, req.user?.user_id || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Auction not found.',
      });
    }

    // Fetch top 10 bids for this auction
    const bidsResult = await query(
      `SELECT
         b.bid_id,
         b.amount,
         b.is_winning,
         b.created_at,
         u.username   AS bidder_username,
         u.avatar_url AS bidder_avatar
       FROM bids b
       JOIN users u ON b.bidder_id = u.user_id
       WHERE b.auction_id = $1
       ORDER BY b.amount DESC
       LIMIT 10`,
      [id]
    );

    res.status(200).json({
      success: true,
      auction: result.rows[0],
      top_bids: bidsResult.rows,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/auctions
// @access  Seller, Admin
// ─────────────────────────────────────────────
const createAuction = async (req, res, next) => {
  const client = await getClient();
  try {
    const {
      title, description, category_id,
      starting_price, reserve_price,
      bid_increment, start_time, end_time,
    } = req.body;

    // ── Validation ───────────────────────────
    if (!title || !starting_price || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        message: 'Title, starting price, start time, and end time are required.',
      });
    }

    if (parseFloat(starting_price) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Starting price must be greater than 0.',
      });
    }

    const start = new Date(start_time);
    const end   = new Date(end_time);
    const now   = new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format.',
      });
    }

    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'End time must be after start time.',
      });
    }

    if (end <= now) {
      return res.status(400).json({
        success: false,
        message: 'End time must be in the future.',
      });
    }

    // ── Handle uploaded images ───────────────
    const image_urls = req.files
      ? req.files.map((f) => f.path)
      : req.body.image_urls || [];

    // ── Determine status in JS (avoids $9 type conflict) ──
    const status = start <= now ? 'active' : 'pending';

    const startingPrice  = parseFloat(starting_price);
    const reservePrice   = parseFloat(reserve_price  || 0);
    const bidIncrement   = parseFloat(bid_increment  || 1);

    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO auctions
         (seller_id, category_id, title, description,
          starting_price, reserve_price, current_price,
          bid_increment, image_urls, start_time, end_time, status)
       VALUES ($1, $2, $3, $4, $5, $6, $5, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        req.user.user_id,   // $1  seller_id
        category_id || null,// $2  category_id
        title,              // $3  title
        description || null,// $4  description
        startingPrice,      // $5  starting_price AND current_price
        reservePrice,       // $6  reserve_price
        bidIncrement,       // $7  bid_increment
        image_urls,         // $8  image_urls
        start,              // $9  start_time
        end,                // $10 end_time
        status,             // $11 status
      ]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success : true,
      message : 'Auction created successfully.',
      auction : result.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────
// @route   PUT /api/auctions/:id
// @access  Seller (own), Admin, Employee (can_manage_auctions)
// ─────────────────────────────────────────────
const updateAuction = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title, description, category_id,
      reserve_price, bid_increment, end_time,
    } = req.body;

    // Fetch existing auction
    const existing = await query(
      `SELECT * FROM auctions WHERE auction_id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Auction not found.',
      });
    }

    const auction = existing.rows[0];

    // Only seller, admin, or authorised employee can update
    const isOwner = auction.seller_id === req.user.user_id;
    const isAdmin = req.user.role === 'admin';
    const isEmployee = req.user.role === 'employee';

    if (!isOwner && !isAdmin && !isEmployee) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorised to update this auction.',
      });
    }

    // Cannot edit an ended or cancelled auction
    if (['ended', 'cancelled'].includes(auction.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot edit an auction that is ${auction.status}.`,
      });
    }

    // Cannot change price/time once bidding has started
    if (auction.status === 'active' && auction.total_bids > 0) {
      if (bid_increment || end_time) {
        return res.status(400).json({
          success: false,
          message: 'Cannot change bid increment or end time once bidding has started.',
        });
      }
    }

    const result = await query(
      `UPDATE auctions SET
         title         = COALESCE($1, title),
         description   = COALESCE($2, description),
         category_id   = COALESCE($3, category_id),
         reserve_price = COALESCE($4, reserve_price),
         bid_increment = COALESCE($5, bid_increment),
         end_time      = COALESCE($6, end_time),
         updated_at    = NOW()
       WHERE auction_id = $7
       RETURNING *`,
      [
        title || null,
        description || null,
        category_id || null,
        reserve_price ? parseFloat(reserve_price) : null,
        bid_increment ? parseFloat(bid_increment) : null,
        end_time ? new Date(end_time) : null,
        id,
      ]
    );

    res.status(200).json({
      success: true,
      message: 'Auction updated successfully.',
      auction: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// @route   DELETE /api/auctions/:id
// @access  Seller (own, no bids), Admin
// ─────────────────────────────────────────────
const deleteAuction = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await query(
      `SELECT * FROM auctions WHERE auction_id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Auction not found.',
      });
    }

    const auction = existing.rows[0];
    const isOwner = auction.seller_id === req.user.user_id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorised to delete this auction.',
      });
    }

    // Sellers can only delete if no bids placed yet
    if (isOwner && !isAdmin && auction.total_bids > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete an auction that already has bids.',
      });
    }

    await query(
      `DELETE FROM auctions WHERE auction_id = $1`,
      [id]
    );

    res.status(200).json({
      success: true,
      message: 'Auction deleted successfully.',
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/auctions/:id/cancel
// @access  Seller (own), Admin
// ─────────────────────────────────────────────
const cancelAuction = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await query(
      `SELECT * FROM auctions WHERE auction_id = $1`, [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Auction not found.',
      });
    }

    const auction = existing.rows[0];
    const isOwner = auction.seller_id === req.user.user_id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorised to cancel this auction.',
      });
    }

    if (auction.status === 'ended' || auction.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: `Auction is already ${auction.status}.`,
      });
    }

    const result = await query(
      `UPDATE auctions SET status = 'cancelled', updated_at = NOW()
       WHERE auction_id = $1 RETURNING *`,
      [id]
    );

    // Notify all bidders via Socket.io
    req.io.to(`auction:${id}`).emit('auction:cancelled', {
      auction_id: id,
      message: 'This auction has been cancelled.',
    });

    res.status(200).json({
      success: true,
      message: 'Auction cancelled.',
      auction: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/auctions/:id/bids
// @access  Public
// ─────────────────────────────────────────────
const getAuctionBids = async (req, res, next) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT
         b.bid_id,
         b.amount,
         b.is_winning,
         b.created_at,
         u.username   AS bidder_username,
         u.avatar_url AS bidder_avatar
       FROM bids b
       JOIN users u ON b.bidder_id = u.user_id
       WHERE b.auction_id = $1
       ORDER BY b.amount DESC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    res.status(200).json({
      success: true,
      count: result.rows.length,
      bids: result.rows,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/auctions/:id/watchlist
// @access  Private (buyer)
// ─────────────────────────────────────────────
const toggleWatchlist = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await query(
      `SELECT watchlist_id FROM watchlist
       WHERE user_id = $1 AND auction_id = $2`,
      [req.user.user_id, id]
    );

    if (existing.rows.length > 0) {
      await query(
        `DELETE FROM watchlist
         WHERE user_id = $1 AND auction_id = $2`,
        [req.user.user_id, id]
      );
      return res.status(200).json({
        success: true,
        message: 'Removed from watchlist.',
        watching: false,
      });
    }

    await query(
      `INSERT INTO watchlist (user_id, auction_id) VALUES ($1, $2)`,
      [req.user.user_id, id]
    );

    res.status(201).json({
      success: true,
      message: 'Added to watchlist.',
      watching: true,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllAuctions,
  getAuctionById,
  createAuction,
  updateAuction,
  deleteAuction,
  cancelAuction,
  getAuctionBids,
  toggleWatchlist,
};