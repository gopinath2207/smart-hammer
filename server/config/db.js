const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                  // max connections in pool
  idleTimeoutMillis: 30000, // close idle connections after 30s
  connectionTimeoutMillis: 2000, // error if connection takes > 2s
});

// Test connection on startup
const connectDB = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    console.log('PostgreSQL Connected:', result.rows[0].current_time);
    client.release();
  } catch (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1); // kill the server if DB fails
  }
};

// Helper — run a query directly
const query = (text, params) => pool.query(text, params);

// Helper — get a client for transactions
const getClient = () => pool.connect();

module.exports = { pool, connectDB, query, getClient };