const Database = require("better-sqlite3");

const db = new Database("dapfarm.db");

// Create orders table
db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        delivery_location TEXT NOT NULL,
        items TEXT NOT NULL,
        total REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// Check whether the status column exists
const columns = db.prepare("PRAGMA table_info(orders)").all();

const statusExists = columns.some(function(column) {
    return column.name === "status";
});

// Add status column if missing
if (!statusExists) {
    db.exec(`
        ALTER TABLE orders
        ADD COLUMN status TEXT NOT NULL DEFAULT 'Pending'
    `);
}

// Add payment tracking columns
if (!columns.some(column => column.name === "payment_status")) {
    db.exec(`
        ALTER TABLE orders
        ADD COLUMN payment_status TEXT DEFAULT 'Unpaid'
    `);
}

if (!columns.some(column => column.name === "mpesa_receipt")) {
    db.exec(`
        ALTER TABLE orders
        ADD COLUMN mpesa_receipt TEXT
    `);
}

if (!columns.some(column => column.name === "checkout_request_id")) {
    db.exec(`
        ALTER TABLE orders
        ADD COLUMN checkout_request_id TEXT
    `);
}
// Add archive tracking to orders
const archiveExists = db.prepare("PRAGMA table_info(orders)").all()
    .some(column => column.name === "archived");

if (!archiveExists) {
    db.exec(`
        ALTER TABLE orders
        ADD COLUMN archived INTEGER NOT NULL DEFAULT 0
    `);
}
console.log("DapFarm database is ready!");

module.exports = db;