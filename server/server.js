require("dotenv").config();
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const { initiateSTKPush, querySTKPush } = require("./mpesa");
/*const SQLiteSessionStore = require("./session-store");*/
//const SQLiteSessionStore = require("./session-store");

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const db = require("./database");

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10kb" }));
app.use(helmet());

app.use(cors({
    origin: [
        "http://localhost:5500",
        "http://127.0.0.1:5500"
    ],
    credentials: true
}));

// Ensure a session secret is configured
if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is missing from .env");
}

app.use(session({
    name: "dapfarm.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 2
    }
}));
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: "Too many login attempts. Please try again after 15 minutes."
    }
});
const orderLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: "Too many orders submitted. Please try again later."
    }
});
// Test route
app.get("/", (req, res) => {
    res.send("DapFarm backend is running!");
});
// Admin login
app.post("/api/admin/login", loginLimiter, async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            message: "Please enter your username and password."
        });
    }

    if (username !== process.env.ADMIN_USERNAME) {
        return res.status(401).json({
            message: "Invalid username or password."
        });
    }

    try {
        const passwordMatch = await bcrypt.compare(
            password,
            process.env.ADMIN_PASSWORD_HASH
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid username or password."
            });
        }

       req.session.regenerate((error) => {
    if (error) {
        return res.status(500).json({
            message: "Unable to create login session."
        });
    }

    req.session.admin = true;

    req.session.save((saveError) => {
        if (saveError) {
            return res.status(500).json({
                message: "Unable to save login session."
            });
        }

        res.json({
            message: "Login successful!"
        });
    });
});

    } catch (error) {
        console.error("Login error:", error);

        res.status(500).json({
            message: "Unable to log in."
        });
    }
});
// Admin logout
app.post("/api/admin/logout", (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            return res.status(500).json({
                message: "Unable to log out."
            });
        }

       res.clearCookie("dapfarm.sid", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
});

        res.json({
            message: "Logged out successfully!"
        });
    });
});
// Protect admin routes
function requireAdmin(req, res, next) {
    if (req.session.admin) {
        return next();
    }

    res.status(401).json({
        message: "Unauthorized. Please log in first."
    });
}

// Receive M-Pesa payment confirmation
// Receive and verify M-Pesa payment confirmation
app.post("/api/mpesa/callback", async (req, res) => {
    try {
        const callback = req.body?.Body?.stkCallback;

        if (!callback) {
            return res.status(400).json({
                message: "Invalid callback data."
            });
        }

        // Only investigate successful payment callbacks
        if (Number(callback.ResultCode) !== 0) {
            return res.json({
                ResultCode: 0,
                ResultDesc: "Callback received."
            });
        }

        const checkoutRequestId = callback.CheckoutRequestID;

        const order = db.prepare(`
            SELECT id, total, payment_status
            FROM orders
            WHERE checkout_request_id = ?
        `).get(checkoutRequestId);

        if (!order) {
            return res.json({
                ResultCode: 0,
                ResultDesc: "Order not found."
            });
        }

        if (order.payment_status === "Paid") {
            return res.json({
                ResultCode: 0,
                ResultDesc: "Payment already processed."
            });
        }

        // Verify payment directly with Safaricom
        const verification = await querySTKPush(checkoutRequestId);

        if (Number(verification.ResultCode) !== 0) {
            return res.json({
                ResultCode: 0,
                ResultDesc: "Payment is not yet confirmed."
            });
        }

        const metadata = callback.CallbackMetadata?.Item || [];

        const amount = metadata.find(
            item => item.Name === "Amount"
        )?.Value;

        const receipt = metadata.find(
            item => item.Name === "MpesaReceiptNumber"
        )?.Value;

        if (Number(amount) !== Number(order.total) || !receipt) {
            return res.json({
                ResultCode: 0,
                ResultDesc: "Payment details could not be verified."
            });
        }

        db.prepare(`
            UPDATE orders
            SET payment_status = 'Paid',
                mpesa_receipt = ?
            WHERE id = ?
        `).run(receipt, order.id);

        console.log("Verified M-Pesa payment:", receipt);

        res.json({
            ResultCode: 0,
            ResultDesc: "Payment verified successfully."
        });

    } catch (error) {
        console.error("M-Pesa callback error:", error);

        res.status(500).json({
            message: "Callback processing failed."
        });
    }
});

// Receive and save customer orders
// Official DapFarm product catalogue
const products = {
    "Strawberry Probiotic Yoghurt": 250,
    "Vanilla Probiotic Yoghurt": 250,
    "Blueberry Probiotic Yoghurt": 250,
    "Strawberry Kefir Milk": 250,
    "Vanilla Kefir Milk": 250,
    "Blueberry Kefir Milk": 250
};
app.post("/api/orders", orderLimiter, (req, res) => {

    const {
        customerName,
        phone,
        deliveryLocation,
        items
    } = req.body;

    // VALIDATE CUSTOMER DETAILS
    if (
        typeof customerName !== "string" ||
        typeof phone !== "string" ||
        typeof deliveryLocation !== "string" ||
        !customerName.trim() ||
        !phone.trim() ||
        !deliveryLocation.trim() ||
        customerName.length > 100 ||
        phone.length > 20 ||
        deliveryLocation.length > 250
    ) {
        return res.status(400).json({
            message: "Please provide valid customer details."
        });
    }

    // VALIDATE KENYAN PHONE NUMBER
    const cleanPhone = phone.trim();

    if (!/^(?:(?:\+254|254)?[17]\d{8}|0[17]\d{8})$/.test(cleanPhone)) {
        return res.status(400).json({
            message: "Please enter a valid Kenyan phone number."
        });
    }

    // VALIDATE ORDER ITEMS
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            message: "Your cart is empty or invalid."
        });
    }

    const validatedItems = [];

    for (const item of items) {

        if (!item || typeof item.name !== "string") {
            return res.status(400).json({
                message: "Invalid cart item."
            });
        }

        const price = Object.hasOwn(products, item.name)
            ? products[item.name]
            : null;

        if (
            !price ||
            !Number.isInteger(item.quantity) ||
            item.quantity < 1 ||
            item.quantity > 50
        ) {
            return res.status(400).json({
                message: "Invalid product or quantity."
            });
        }

        validatedItems.push({
            name: item.name,
            price: price,
            quantity: item.quantity
        });
    }

    // CALCULATE ORDER TOTAL
    const calculatedTotal = validatedItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
    );

    // SAVE ORDER TO DATABASE
    try {

        const statement = db.prepare(`
            INSERT INTO orders (
                customer_name,
                phone,
                delivery_location,
                items,
                total,
                payment_status
            )
            VALUES (?, ?, ?, ?, ?, 'Pending')
        `);

        const result = statement.run(
            customerName.trim(),
            cleanPhone,
            deliveryLocation.trim(),
            JSON.stringify(validatedItems),
            calculatedTotal
        );

        const orderId = result.lastInsertRowid;

        console.log("Order successfully saved:", orderId);

        res.status(201).json({
            message: "Your order has been received successfully!",
            orderId: orderId
        });

    } catch (error) {

        console.error("Order saving error:", error);

        res.status(500).json({
            message: "Unable to receive your order. Please try again."
        });
    }

});
// Retrieve orders (admin only)
app.get("/api/orders", requireAdmin, (req, res) => {
    try {
        const orders = db.prepare(`
SELECT *
FROM orders
WHERE archived = 0
ORDER BY created_at DESC
        `).all();

        res.json(orders);

    } catch (error) {
        console.error("Error retrieving orders:", error);

        res.status(500).json({
            message: "Unable to retrieve orders."
        });
    }
});
// Archive a delivered order (admin only)
app.patch("/api/orders/:id/archive", requireAdmin, (req, res) => {
    try {
        const orderId = req.params.id;

        const order = db.prepare(`
            SELECT id, status, archived
            FROM orders
            WHERE id = ?
        `).get(orderId);

        if (!order) {
            return res.status(404).json({
                message: "Order not found."
            });
        }

        if (order.status !== "Delivered") {
            return res.status(400).json({
                message: "Only delivered orders can be archived."
            });
        }

        if (order.archived === 1) {
            return res.status(400).json({
                message: "This order is already archived."
            });
        }

        db.prepare(`
            UPDATE orders
            SET archived = 1
            WHERE id = ?
        `).run(orderId);

        res.json({
            message: "Order archived successfully."
        });

    } catch (error) {
        console.error("Archive error:", error);

        res.status(500).json({
            message: "Unable to archive order."
        });
    }
});
// Update an order's status
app.put("/api/orders/:id/status", requireAdmin, (req, res) => {
    const orderId = req.params.id;
    const { status } = req.body;
    console.log("Received status:", status);

    const allowedStatuses = [
        "Pending",
        "Confirmed",
        "Delivered",
        "Cancelled"
    ];

    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
            message: "Invalid order status."
        });
    }

    const result = db.prepare(`
        UPDATE orders
        SET status = ?
        WHERE id = ?
    `).run(status, orderId);

    if (result.changes === 0) {
        return res.status(404).json({
            message: "Order not found."
        });
    }

    res.json({
        message: "Order status updated successfully!"
    });
});

app.listen(PORT, () => {
    console.log(`DapFarm server is running at http://localhost:${PORT}`);
});