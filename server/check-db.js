require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const client = await pool.connect();
  try {
    // Check tables
    const tables = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
    );
    console.log('Tables:', tables.rows.map(r => r.tablename).join(', '));

    // Check admin user
    const admin = await client.query(
      "SELECT user_id, username, email, role, password_hash FROM users WHERE role='admin'"
    );
    console.log('\nAdmin users:', admin.rows.length);
    if (admin.rows.length > 0) {
      const row = admin.rows[0];
      console.log('  user:', row.username, '|', row.email);
      const match = await bcrypt.compare('Admin@123', row.password_hash);
      console.log('  Admin@123 matches:', match);
    }

    // Check employees
    const emp = await client.query(
      "SELECT u.user_id, u.username, u.role, ed.employee_code FROM users u LEFT JOIN employee_details ed ON u.user_id=ed.user_id WHERE u.role='employee'"
    );
    console.log('\nEmployees:', emp.rows.length);
    emp.rows.forEach(r => console.log('  ', r.username, '| code:', r.employee_code));

  } finally {
    client.release();
    pool.end();
  }
}

check().catch(console.error);
