// =============================================
// routes/payments.js
// =============================================

const express = require('express');
const router = express.Router();
const { sql, poolPromise } = require('../db');
const { verifyToken } = require('../middleware/auth');

// ---- RECORD PAYMENT ----
router.post('/', verifyToken, async (req, res) => {
    try {
        const { orderId, paymentMethod } = req.body;
        const pool = await poolPromise;

        // Verify order belongs to this user
        const orderCheck = await pool.request()
            .input('OrderID', sql.Int, orderId)
            .input('UserID', sql.Int, req.user.userId)
            .query('SELECT * FROM Orders WHERE OrderID = @OrderID AND UserID = @UserID');

        if (orderCheck.recordset.length === 0) {
            return res.status(400).json({ success: false, message: 'Order nahi mila.' });
        }

        const transactionId = 'TXN' + Date.now() + Math.floor(Math.random() * 1000);

        await pool.request()
            .input('OrderID', sql.Int, orderId)
            .input('PaymentMethod', sql.VarChar, paymentMethod)
            .input('TransactionID', sql.VarChar, transactionId)
            .input('PaymentStatus', sql.VarChar, 'Completed')
            .query(`INSERT INTO Payments (OrderID, PaymentMethod, TransactionID, PaymentStatus)
                    VALUES (@OrderID, @PaymentMethod, @TransactionID, @PaymentStatus)`);

        // Update order status to Processing
        await pool.request()
            .input('OrderID', sql.Int, orderId)
            .query("UPDATE Orders SET OrderStatus = 'Processing' WHERE OrderID = @OrderID");

        res.json({
            success: true,
            message: 'Payment complete!',
            transactionId
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;

// =============================================
// routes/wishlist.js
// =============================================

const wishlistRouter = express.Router();

// GET wishlist
wishlistRouter.get('/', verifyToken, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.Int, req.user.userId)
            .query(`
                SELECT w.WishlistID, p.ProductID, p.ProductName, p.Price,
                    c.CategoryName, b.BrandName
                FROM Wishlist w
                INNER JOIN Products p ON w.ProductID = p.ProductID
                INNER JOIN Categories c ON p.CategoryID = c.CategoryID
                INNER JOIN Brands b ON p.BrandID = b.BrandID
                WHERE w.UserID = @UserID AND p.IsDeleted = 0
            `);
        res.json({ success: true, wishlist: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Add to wishlist
wishlistRouter.post('/add', verifyToken, async (req, res) => {
    try {
        const { productId } = req.body;
        const pool = await poolPromise;

        const existing = await pool.request()
            .input('UserID', sql.Int, req.user.userId)
            .input('ProductID', sql.Int, productId)
            .query('SELECT * FROM Wishlist WHERE UserID=@UserID AND ProductID=@ProductID');

        if (existing.recordset.length > 0) {
            return res.json({ success: false, message: 'Pehle se wishlist mein hai.' });
        }

        await pool.request()
            .input('UserID', sql.Int, req.user.userId)
            .input('ProductID', sql.Int, productId)
            .query('INSERT INTO Wishlist (UserID, ProductID) VALUES (@UserID, @ProductID)');

        res.json({ success: true, message: 'Wishlist mein add ho gaya!' });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Remove from wishlist
wishlistRouter.delete('/:id', verifyToken, async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('WishlistID', sql.Int, req.params.id)
            .input('UserID', sql.Int, req.user.userId)
            .query('DELETE FROM Wishlist WHERE WishlistID=@WishlistID AND UserID=@UserID');

        res.json({ success: true, message: 'Wishlist se remove ho gaya!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports.wishlistRouter = wishlistRouter;

// =============================================
// routes/notifications.js
// =============================================

const notifRouter = express.Router();

// GET notifications
notifRouter.get('/', verifyToken, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.Int, req.user.userId)
            .query('SELECT * FROM Notifications WHERE UserID=@UserID ORDER BY CreatedAt DESC');

        res.json({ success: true, notifications: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Mark as read
notifRouter.put('/:id/read', verifyToken, async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('NotificationID', sql.Int, req.params.id)
            .input('UserID', sql.Int, req.user.userId)
            .query('UPDATE Notifications SET IsRead=1 WHERE NotificationID=@NotificationID AND UserID=@UserID');

        res.json({ success: true, message: 'Read mark ho gaya!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports.notifRouter = notifRouter;
