/**
 * Smart Hammer — DB Trigger Repair
 * Ensures the bid trigger (auto-update auction on bid) exists.
 * Run: node server/repair-triggers.js
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function repairTriggers() {
  const client = await pool.connect();
  try {
    console.log('🔧 Repairing DB triggers...\n');

    // Function: update_auction_on_bid
    await client.query(`
      CREATE OR REPLACE FUNCTION update_auction_on_bid()
      RETURNS TRIGGER AS $$
      BEGIN
          -- Reset previous winning bid
          UPDATE bids
          SET is_winning = FALSE
          WHERE auction_id = NEW.auction_id AND is_winning = TRUE;

          -- Mark new bid as winning
          NEW.is_winning = TRUE;

          -- Update auction current price and bid count
          UPDATE auctions
          SET current_price = NEW.amount,
              total_bids = total_bids + 1,
              updated_at = NOW()
          WHERE auction_id = NEW.auction_id;

          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Drop and recreate trigger
    await client.query(`DROP TRIGGER IF EXISTS trigger_bid_placed ON bids`);
    await client.query(`
      CREATE TRIGGER trigger_bid_placed
      BEFORE INSERT ON bids
      FOR EACH ROW EXECUTE FUNCTION update_auction_on_bid();
    `);
    console.log('✅ trigger_bid_placed created');

    // Function: set_auction_winner
    await client.query(`
      CREATE OR REPLACE FUNCTION set_auction_winner()
      RETURNS TRIGGER AS $$
      BEGIN
          IF NEW.status = 'ended' AND OLD.status != 'ended' THEN
              UPDATE auctions
              SET winner_id = (
                  SELECT bidder_id FROM bids
                  WHERE auction_id = NEW.auction_id AND is_winning = TRUE
                  LIMIT 1
              )
              WHERE auction_id = NEW.auction_id;
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Drop and recreate auction ended trigger
    await client.query(`DROP TRIGGER IF EXISTS trigger_auction_ended ON auctions`);
    await client.query(`
      CREATE TRIGGER trigger_auction_ended
      AFTER UPDATE ON auctions
      FOR EACH ROW EXECUTE FUNCTION set_auction_winner();
    `);
    console.log('✅ trigger_auction_ended created');

    console.log('\n🎉 All triggers are healthy!');
  } catch (err) {
    console.error('❌ Trigger repair failed:', err.message);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
}

repairTriggers().catch((err) => {
  console.error(err);
  process.exit(1);
});
