const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function query(text, params) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

async function initDB() {
  await query(`
    CREATE TABLE IF NOT EXISTS logs (
      id BIGINT PRIMARY KEY,
      activity_id BIGINT,
      activity_name TEXT,
      activity_meta TEXT,
      temp_f INTEGER,
      feels_f INTEGER,
      condition TEXT,
      humidity INTEGER,
      dew_point_f INTEGER,
      city TEXT,
      worn TEXT[],
      worked_well TEXT,
      would_change TEXT,
      notes TEXT,
      date TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('Database initialized');
}

module.exports = { query, initDB };