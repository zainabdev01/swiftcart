// =============================================
// routes/cart.js — Cart APIs
// =============================================

const express = require('express');
const router = express.Router();
const { sql, poolPromise } = require('../db');
const { verifyToken } = require('../middleware/auth');

// ---- GET MY CART ----
router.get('/', verifyToken, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.Int, req.user.userId)
            .query(`
                SELECT c.CartID, c.Quantity, p.ProductID, p.ProductName, 
                       p.Price, (c.Quantity * p.Price) AS SubTotal,
                       cat.CategoryName, b.BrandName
                FROM Cart c
                INNER JOIN Products p ON c.ProductID = p.ProductID
                INNER JOIN Categories cat ON p.CategoryID = cat.CategoryID
                INNER JOIN Brands b ON p.BrandID = b.BrandID
                WHERE c.UserID = @UserID AND p.IsDeleted = 0
            `);

        const total = result.recordset.reduce((sum, item) => sum + item.SubTotal, 0);
        res.json({ success: true, cart: result.recordset, totalAmount: total });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---- ADD TO CART ----
router.post('/add', verifyToken, async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const pool = await poolPromise;

        // Check stock
        const stock = await pool.request()
            .input('ProductID', sql.Int, productId)
            .query('SELECT StockQuantity FROM Products WHERE ProductID = @ProductID');

        if (stock.recordset[0].StockQuantity < quantity) {
            return res.status(400).json({ success: false, message: 'Itna stock nahi hai.' });
        }

        // Check if already in cart
        const existing = await pool.request()
            .input('UserID', sql.Int, req.user.userId)
            .input('ProductID', sql.Int, productId)
            .query('SELECT CartID, Quantity FROM Cart WHERE UserID=@UserID AND ProductID=@ProductID');

        if (existing.recordset.length > 0) {
            // Update quantity
            await pool.request()
                .input('CartID', sql.Int, existing.recordset[0].CartID)
                .input('Quantity', sql.Int, existing.recordset[0].Quantity + quantity)
                .query('UPDATE Cart SET Quantity = @Quantity WHERE CartID = @CartID');
        } else {
            await pool.request()
                .input('UserID', sql.Int, req.user.userId)
                .input('ProductID', sql.Int, productId)
                .input('Quantity', sql.Int, quantity)
                .query('INSERT INTO Cart (UserID, ProductID, Quantity) VALUES (@UserID, @ProductID, @Quantity)');
        }

        res.json({ success: true, message: 'Cart mein add ho gaya!' });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---- REMOVE FROM CART ----
router.delete('/:cartId', verifyToken, async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('CartID', sql.Int, req.params.cartId)
            .input('UserID', sql.Int, req.user.userId)
            .query('DELETE FROM Cart WHERE CartID = @CartID AND UserID = @UserID');

        res.json({ success: true, message: 'Cart se remove ho gaya!' });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---- CLEAR CART ----
router.delete('/', verifyToken, async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('UserID', sql.Int, req.user.userId)
            .query('DELETE FROM Cart WHERE UserID = @UserID');

        res.json({ success: true, message: 'Cart khali ho gaya!' });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
