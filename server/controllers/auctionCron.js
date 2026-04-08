const cron      = require('node-cron');
const { query } = require('../config/db');

const startAuctionCron = () => {

  // ─────────────────────────────────────────────
  // Every minute — activate pending auctions
  // ─────────────────────────────────────────────
  cron.schedule('* * * * *', async () => {
    try {
      const result = await query(
        `UPDATE auctions
         SET    status     = 'active',
                updated_at = NOW()
         WHERE  status     = 'pending'
           AND  start_time <= NOW()
         RETURNING auction_id, title`
      );

      if (result.rows.length > 0) {
        for (const { auction_id, title } of result.rows) {
          console.log(`[CRON] Auction activated: ${title}`);

          global.io.to(`auction:${auction_id}`).emit('auction:started', {
            auction_id,
            message : `"${title}" is now live! Start bidding.`,
          });

          // Notify all users watching this auction
          await query(
            `INSERT INTO notifications (user_id, auction_id, type, message)
             SELECT w.user_id, $1, 'auction_started', $2
             FROM   watchlist w
             WHERE  w.auction_id = $1`,
            [auction_id, `"${title}" has started! Place your bid now.`]
          );
        }
      }
    } catch (err) {
      console.error('[CRON] Activate error:', err.message);
    }
  });

  // ─────────────────────────────────────────────
  // Every minute — end expired active auctions
  // ─────────────────────────────────────────────
  cron.schedule('* * * * *', async () => {
    try {
      const result = await query(
        `UPDATE auctions
         SET    status     = 'ended',
                updated_at = NOW()
         WHERE  status     = 'active'
           AND  end_time   <= NOW()
         RETURNING auction_id, title, winner_id, current_price, seller_id`
      );

      if (result.rows.length > 0) {
        for (const row of result.rows) {
          const { auction_id, title, winner_id, current_price, seller_id } = row;

          console.log(`[CRON] Auction ended: ${title}`);

          // ── Notify auction room ──
          global.io.to(`auction:${auction_id}`).emit('auction:ended', {
            auction_id,
            winner_id,
            final_price : current_price,
            message     : winner_id
              ? `Auction ended! Winning bid: $${current_price}`
              : 'Auction ended with no bids.',
          });

          if (winner_id) {
            // ── Notify winner personally ──
            global.io.to(`user:${winner_id}`).emit('auction:won', {
              auction_id,
              title,
              final_price : current_price,
              message     : `You won "${title}" for $${current_price}! Please complete payment.`,
            });

            // ── Notify seller ──
            global.io.to(`user:${seller_id}`).emit('auction:sold', {
              auction_id,
              title,
              final_price : current_price,
              message     : `Your auction "${title}" was sold for $${current_price}!`,
            });

            // ── Save winner notification ──
            await query(
              `INSERT INTO notifications (user_id, auction_id, type, message)
               VALUES ($1, $2, 'auction_won', $3)`,
              [
                winner_id,
                auction_id,
                `You won "${title}" for $${current_price}. Please complete your payment.`,
              ]
            );

            // ── Save payment due notification ──
            await query(
              `INSERT INTO notifications (user_id, auction_id, type, message)
               VALUES ($1, $2, 'payment_due', $3)`,
              [
                winner_id,
                auction_id,
                `Payment of $${current_price} is due for "${title}".`,
              ]
            );

            // ── Notify all losing bidders ──
            const losers = await query(
              `SELECT DISTINCT bidder_id
               FROM   bids
               WHERE  auction_id = $1
                 AND  bidder_id != $2`,
              [auction_id, winner_id]
            );

            for (const { bidder_id } of losers.rows) {
              global.io.to(`user:${bidder_id}`).emit('auction:lost', {
                auction_id,
                title,
                message : `Auction "${title}" has ended. Better luck next time!`,
              });

              await query(
                `INSERT INTO notifications (user_id, auction_id, type, message)
                 VALUES ($1, $2, 'auction_ended', $3)`,
                [
                  bidder_id,
                  auction_id,
                  `Auction "${title}" ended. You were outbid.`,
                ]
              );
            }
          } else {
            // ── No bids — notify seller ──
            global.io.to(`user:${seller_id}`).emit('auction:no_bids', {
              auction_id,
              title,
              message : `Your auction "${title}" ended with no bids.`,
            });
          }
        }
      }
    } catch (err) {
      console.error('[CRON] End error:', err.message);
    }
  });

  // ─────────────────────────────────────────────
  // Every 5 minutes — send countdown warnings
  // ─────────────────────────────────────────────
  cron.schedule('*/5 * * * *', async () => {
    try {
      // Auctions ending in next 15 minutes
      const result = await query(
        `SELECT auction_id, title
         FROM   auctions
         WHERE  status   = 'active'
           AND  end_time BETWEEN NOW() AND NOW() + INTERVAL '15 minutes'`
      );

      for (const { auction_id, title } of result.rows) {
        global.io.to(`auction:${auction_id}`).emit('auction:ending_soon', {
          auction_id,
          message : `"${title}" is ending in less than 15 minutes!`,
        });
      }
    } catch (err) {
      console.error('[CRON] Warning error:', err.message);
    }
  });

  console.log('[CRON] Auction cron jobs started.');
};

module.exports = { startAuctionCron };