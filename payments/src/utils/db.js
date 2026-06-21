const { Pool } = require("pg");
const config = require("../config");

const pool = new Pool({
  host: config.postgres.host,
  port: config.postgres.port,
  user: config.postgres.user,
  password: config.postgres.password,
  database: config.postgres.database,
});

async function initDB() {
  const client = await pool.connect();
  try {
    console.log("Initializing PostgreSQL database...");
    
    // Create payments table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        order_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'INR',
        method VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        idempotency_key VARCHAR(255) UNIQUE NOT NULL,
        provider_reference VARCHAR(255),
        failure_reason TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        processed_at TIMESTAMP,
        refunded_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes if not exists
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_payments_order_user ON payments(order_id, user_id);
    `);
    
    console.log("PostgreSQL database initialized successfully.");
  } catch (err) {
    console.error("Failed to initialize PostgreSQL database:", err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  initDB,
  query: (text, params) => pool.query(text, params),
};
