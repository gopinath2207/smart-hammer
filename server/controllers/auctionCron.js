const cron         = require('node-cron');
const { query }    = require('../config/db');

const startAuctionCron = () => {

  // ── Every minute: activate pending auctions ──
  cron.schedule('* * * * *', async () => {
    try {
      const result = await query(
        `UPDATE auctions
         SET status = 'active', updated_at = NOW()
         WHERE status = 'pending'
           AND start_time <= NOW()
         RETURNING auction_id, title`
      );

      if (result.rows.length > 0) {
        result.rows.forEach(({ auction_id, title }) => {
          console.log(`Auction activated: ${title} (${auction_id})`);
          global.io.to(`auction:${auction_id}`).emit('auction:started', {
            auction_id,
            message: 'This auction is now live!',
          });
        });
      }
    } catch (err) {
      console.error('Cron (activate) error:', err.message);
    }
  });

  // ── Every minute: end expired active auctions ──
  cron.schedule('* * * * *', async () => {
    try {
      const result = await query(
        `UPDATE auctions
         SET status = 'ended', updated_at = NOW()
         WHERE status = 'active'
           AND end_time <= NOW()
         RETURNING auction_id, title, winner_id, current_price`
      );

      if (result.rows.length > 0) {
        for (const row of result.rows) {
          const { auction_id, title, winner_id, current_price } = row;

          console.log(`Auction ended: ${title} (${auction_id})`);

          // Notify auction room
          global.io.to(`auction:${auction_id}`).emit('auction:ended', {
            auction_id,
            winner_id,
            final_price : current_price,
            message     : winner_id
              ? `Auction ended. Winner: ${winner_id}`
              : 'Auction ended with no bids.',
          });

          // Notify winner personally
          if (winner_id) {
            global.io.to(`user:${winner_id}`).emit('auction:won', {
              auction_id,
              title,
              final_price : current_price,
              message     : `Congratulations! You won "${title}" for $${current_price}`,
            });

            // Save winner notification to DB
            await query(
              `INSERT INTO notifications
                 (user_id, auction_id, type, message)
               VALUES ($1, $2, 'auction_won', $3)`,
              [
                winner_id,
                auction_id,
                `You won "${title}" for $${current_price}. Please complete your payment.`,
              ]
            );
          }
        }
      }
    } catch (err) {
      console.error('Cron (end) error:', err.message);
    }
  });

  console.log('Auction cron jobs started.');
};

module.exports = { startAuctionCron };