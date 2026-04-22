/**
 * Smart Hammer — DB Fix Script
 * Run: node server/fix-employee-seed.js
 *
 * Repairs missing employee_details rows for existing employee users.
 * Safe to run multiple times.
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixEmployeeSeed() {
  const client = await pool.connect();
  try {
    console.log('🔧 Checking employee records...\n');

    // Find employees without employee_details rows
    const orphanedResult = await client.query(`
      SELECT u.user_id, u.username, u.email
      FROM users u
      LEFT JOIN employee_details ed ON u.user_id = ed.user_id
      WHERE u.role = 'employee' AND ed.employee_id IS NULL
    `);

    if (orphanedResult.rows.length === 0) {
      console.log('✅ All employee accounts have complete profiles. No fix needed.');
      return;
    }

    console.log(`⚠️  Found ${orphanedResult.rows.length} employee(s) with missing profile:\n`);
    orphanedResult.rows.forEach((u) => console.log(`   - ${u.username} (${u.email})`));
    console.log('');

    await client.query('BEGIN');

    for (const user of orphanedResult.rows) {
      // Generate a unique employee code
      const code = `EMP-FIX-${user.username.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}`;

      // Check code uniqueness
      const codeCheck = await client.query(
        `SELECT employee_id FROM employee_details WHERE employee_code = $1`, [code]
      );

      const finalCode = codeCheck.rows.length > 0 ? `${code}-${Date.now().toString().slice(-4)}` : code;

      await client.query(`
        INSERT INTO employee_details
          (user_id, department, designation, employee_code,
           can_manage_auctions, can_manage_users, can_manage_payments, can_view_reports)
        VALUES ($1, 'Operations', 'Auction Moderator', $2, TRUE, FALSE, FALSE, TRUE)
        ON CONFLICT (user_id) DO NOTHING
      `, [user.user_id, finalCode]);

      console.log(`   ✅ Created employee_details for ${user.username} (code: ${finalCode})`);
    }

    await client.query('COMMIT');
    console.log('\n🎉 Fix complete! All employee accounts now have complete profiles.');
    console.log('\nDefault credentials:');
    console.log('   Admin    → admin@smarthammer.com    / Admin@123');
    console.log('   Employee → employee1@smarthammer.com / Employee@123');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Fix failed:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

fixEmployeeSeed();
