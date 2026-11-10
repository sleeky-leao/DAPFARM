const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing from .env");
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function initDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS orders (
            id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            customer_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            delivery_location TEXT NOT NULL,
            items JSONB NOT NULL,
            total NUMERIC(10, 2) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            status TEXT NOT NULL DEFAULT 'Pending',
            payment_status TEXT DEFAULT 'Unpaid',
            mpesa_receipt TEXT,
            checkout_request_id TEXT,
            archived BOOLEAN NOT NULL DEFAULT FALSE
        )
    `);

    console.log("DapFarm Neon database is ready!");
}

module.exports = { pool, initDatabase };