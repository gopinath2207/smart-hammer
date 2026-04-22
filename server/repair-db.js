/**
 * Smart Hammer — Full DB Repair Script
 * Run: node server/repair-db.js
 *
 * 1. Creates missing 'bids' table if needed
 * 2. Resets admin password to Admin@123
 * 3. Resets employee1 password to Employee@123
 * 4. Ensures employee_details row exists
 */
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function repair() {
  const client = await pool.connect();
  try {
    console.log('🔧 Smart Hammer DB Repair\n');

    // ── 1. Create bids table if missing ──────────
    const hasBids = await client.query(
      "SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='bids'"
    );
    if (hasBids.rows.length === 0) {
      console.log('⚠️  bids table missing — creating...');
      await client.query(`
        CREATE TABLE bids (
          bid_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          auction_id    UUID NOT NULL REFERENCES auctions(auction_id) ON DELETE CASCADE,
          bidder_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
          amount        NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
          is_winning    BOOLEAN DEFAULT FALSE,
          created_at    TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_bids_auction  ON bids(auction_id);
        CREATE INDEX IF NOT EXISTS idx_bids_bidder   ON bids(bidder_id);
        CREATE INDEX IF NOT EXISTS idx_bids_amount   ON bids(auction_id, amount DESC);
        CREATE INDEX IF NOT EXISTS idx_bids_created  ON bids(created_at DESC);
      `);
      console.log('   ✅ bids table created');
    } else {
      console.log('✅ bids table exists');
    }

    // ── 2. Reset admin password ───────────────────
    const adminResult = await client.query(
      "SELECT user_id FROM users WHERE email = 'admin@smarthammer.com'"
    );

    const adminHash = await bcrypt.hash('Admin@123', 12);

    if (adminResult.rows.length === 0) {
      // Insert admin if missing
      await client.query(`
        INSERT INTO users (username, email, password_hash, full_name, role, is_verified)
        VALUES ('admin', 'admin@smarthammer.com', $1, 'Smart Hammer Admin', 'admin', TRUE)
      `, [adminHash]);
      console.log('✅ Admin user created (admin@smarthammer.com / Admin@123)');
    } else {
      await client.query(
        "UPDATE users SET password_hash = $1 WHERE email = 'admin@smarthammer.com'",
        [adminHash]
      );
      console.log('✅ Admin password reset to Admin@123');
    }

    // ── 3. Reset employee password ────────────────
    const empResult = await client.query(
      "SELECT user_id FROM users WHERE email = 'employee1@smarthammer.com'"
    );

    const empHash = await bcrypt.hash('Employee@123', 12);

    if (empResult.rows.length === 0) {
      // Insert employee if missing
      const insertEmp = await client.query(`
        INSERT INTO users (username, email, password_hash, full_name, role, is_verified)
        VALUES ('employee1', 'employee1@smarthammer.com', $1, 'Smart Hammer Employee', 'employee', TRUE)
        RETURNING user_id
      `, [empHash]);

      const empId = insertEmp.rows[0].user_id;
      await client.query(`
        INSERT INTO employee_details (user_id, department, designation, employee_code,
          can_manage_auctions, can_manage_users, can_manage_payments, can_view_reports)
        VALUES ($1, 'Operations', 'Auction Moderator', 'EMP-001', TRUE, FALSE, FALSE, TRUE)
      `, [empId]);
      console.log('✅ Employee user created (employee1@smarthammer.com / Employee@123)');
    } else {
      await client.query(
        "UPDATE users SET password_hash = $1 WHERE email = 'employee1@smarthammer.com'",
        [empHash]
      );
      console.log('✅ Employee password reset to Employee@123');

      // Ensure employee_details exists
      const empId = empResult.rows[0].user_id;
      const edCheck = await client.query(
        "SELECT employee_id FROM employee_details WHERE user_id = $1", [empId]
      );
      if (edCheck.rows.length === 0) {
        await client.query(`
          INSERT INTO employee_details (user_id, department, designation, employee_code,
            can_manage_auctions, can_manage_users, can_manage_payments, can_view_reports)
          VALUES ($1, 'Operations', 'Auction Moderator', 'EMP-001', TRUE, FALSE, FALSE, TRUE)
          ON CONFLICT (user_id) DO NOTHING
        `, [empId]);
        console.log('   ✅ employee_details row created');
      } else {
        console.log('   ✅ employee_details row exists');
      }
    }

    // ── 4. Verify passwords ───────────────────────
    const verifyAdmin = await client.query(
      "SELECT password_hash FROM users WHERE email = 'admin@smarthammer.com'"
    );
    const adminOk = await bcrypt.compare('Admin@123', verifyAdmin.rows[0].password_hash);
    console.log(`\n🔑 Admin login test:    Admin@123     → ${adminOk ? '✅ PASS' : '❌ FAIL'}`);

    const verifyEmp = await client.query(
      "SELECT password_hash FROM users WHERE email = 'employee1@smarthammer.com'"
    );
    const empOk = await bcrypt.compare('Employee@123', verifyEmp.rows[0].password_hash);
    console.log(`👔 Employee login test: Employee@123  → ${empOk ? '✅ PASS' : '❌ FAIL'}`);

    console.log('\n🎉 Repair complete!');
    console.log('\n📋 Credentials:');
    console.log('   Admin    : admin@smarthammer.com     / Admin@123');
    console.log('   Employee : employee1@smarthammer.com / Employee@123');
  } catch (err) {
    console.error('\n❌ Repair failed:', err.message);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
}

repair().catch((err) => {
  console.error(err);
  process.exit(1);
});
