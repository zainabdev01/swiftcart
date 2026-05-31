// =============================================
// routes/wishlist.js — Wishlist APIs
// =============================================

const express = require('express');
const router = express.Router();
const { sql, poolPromise } = require('../db');
const { verifyToken } = require('../middleware/auth');

// ---- GET MY WISHLIST ----
router.get('/', verifyToken, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.Int, req.user.userId)
            .query(`
                SELECT w.WishlistID, p.ProductID, p.ProductName, p.Price,
                       cat.CategoryName, b.BrandName
                FROM Wishlist w
                INNER JOIN Products p ON w.ProductID = p.ProductID
                INNER JOIN Categories cat ON p.CategoryID = cat.CategoryID
                INNER JOIN Brands b ON p.BrandID = b.BrandID
                WHERE w.UserID = @UserID AND p.IsDeleted = 0
            `);
        res.json({ success: true, wishlist: result.recordset });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---- ADD TO WISHLIST ----
router.post('/add', verifyToken, async (req, res) => {
    try {
        const { productId } = req.body;
        if (!productId) return res.status(400).json({ success: false, message: 'Product ID chahiye.' });

        const pool = await poolPromise;

        // Check product exists
        const product = await pool.request()
            .input('ProductID', sql.Int, productId)
            .query('SELECT ProductID FROM Products WHERE ProductID = @ProductID AND IsDeleted = 0');

        if (!product.recordset || product.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Product nahi mila.' });
        }

        // Check already in wishlist
        const existing = await pool.request()
            .input('UserID', sql.Int, req.user.userId)
            .input('ProductID', sql.Int, productId)
            .query('SELECT WishlistID FROM Wishlist WHERE UserID=@UserID AND ProductID=@ProductID');

        if (existing.recordset.length > 0) {
            return res.json({ success: false, message: 'Pehle se wishlist mein hai!' });
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

// ---- REMOVE FROM WISHLIST ----
router.delete('/:id', verifyToken, async (req, res) => {
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

module.exports = router;
