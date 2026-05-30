// =============================================
// routes/products.js — Product APIs
// =============================================

const express = require('express');
const router = express.Router();
const { sql, poolPromise } = require('../db');
const { verifyToken, isAdmin } = require('../middleware/auth');

// ---- GET ALL PRODUCTS (with filters) ----
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const { category, brand, search, minPrice, maxPrice } = req.query;

        let query = `
            SELECT p.ProductID, p.ProductName, p.Description, p.Price, 
                   p.StockQuantity, c.CategoryName, b.BrandName, p.CreatedAt
            FROM Products p
            INNER JOIN Categories c ON p.CategoryID = c.CategoryID
            INNER JOIN Brands b ON p.BrandID = b.BrandID
            WHERE p.IsDeleted = 0
        `;

        const request = pool.request();

        if (category) {
            query += ' AND c.CategoryName = @Category';
            request.input('Category', sql.VarChar, category);
        }
        if (brand) {
            query += ' AND b.BrandName = @Brand';
            request.input('Brand', sql.VarChar, brand);
        }
        if (search) {
            query += ' AND p.ProductName LIKE @Search';
            request.input('Search', sql.VarChar, `%${search}%`);
        }
        if (minPrice) {
            query += ' AND p.Price >= @MinPrice';
            request.input('MinPrice', sql.Decimal, parseFloat(minPrice));
        }
        if (maxPrice) {
            query += ' AND p.Price <= @MaxPrice';
            request.input('MaxPrice', sql.Decimal, parseFloat(maxPrice));
        }

        query += ' ORDER BY p.CreatedAt DESC';

        const result = await request.query(query);
        res.json({ success: true, products: result.recordset });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---- GET SINGLE PRODUCT ----
router.get('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('ProductID', sql.Int, req.params.id)
            .query(`
                SELECT p.*, c.CategoryName, b.BrandName, v.VendorName,
                    (SELECT AVG(CAST(Rating AS FLOAT)) FROM Reviews WHERE ProductID = p.ProductID) AS AvgRating,
                    (SELECT COUNT(*) FROM Reviews WHERE ProductID = p.ProductID) AS ReviewCount
                FROM Products p
                INNER JOIN Categories c ON p.CategoryID = c.CategoryID
                INNER JOIN Brands b ON p.BrandID = b.BrandID
                INNER JOIN Vendors v ON p.VendorID = v.VendorID
                WHERE p.ProductID = @ProductID AND p.IsDeleted = 0
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Product nahi mila.' });
        }

        // Get variants
        const variants = await pool.request()
            .input('ProductID', sql.Int, req.params.id)
            .query('SELECT * FROM ProductVariants WHERE ProductID = @ProductID');

        // Get reviews
        const reviews = await pool.request()
            .input('ProductID', sql.Int, req.params.id)
            .query(`
                SELECT r.*, u.FullName 
                FROM Reviews r 
                INNER JOIN Users u ON r.UserID = u.UserID 
                WHERE r.ProductID = @ProductID
            `);

        res.json({
            success: true,
            product: result.recordset[0],
            variants: variants.recordset,
            reviews: reviews.recordset
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---- ADD PRODUCT (Admin only) ----
router.post('/', verifyToken, isAdmin, async (req, res) => {
    try {
        const { productName, description, price, stockQuantity, categoryId, brandId, vendorId } = req.body;

        const pool = await poolPromise;
        await pool.request()
            .input('ProductName', sql.VarChar, productName)
            .input('Description', sql.VarChar, description)
            .input('Price', sql.Decimal, price)
            .input('StockQuantity', sql.Int, stockQuantity)
            .input('CategoryID', sql.Int, categoryId)
            .input('BrandID', sql.Int, brandId)
            .input('VendorID', sql.Int, vendorId)
            .execute('sp_AddProduct');

        res.json({ success: true, message: 'Product add ho gaya!' });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---- UPDATE PRODUCT (Admin only) ----
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const { productName, price, stockQuantity, description } = req.body;
        const pool = await poolPromise;

        await pool.request()
            .input('ProductID', sql.Int, req.params.id)
            .input('ProductName', sql.VarChar, productName)
            .input('Price', sql.Decimal, price)
            .input('StockQuantity', sql.Int, stockQuantity)
            .input('Description', sql.VarChar, description)
            .query(`UPDATE Products SET ProductName=@ProductName, Price=@Price, 
                    StockQuantity=@StockQuantity, Description=@Description 
                    WHERE ProductID=@ProductID`);

        res.json({ success: true, message: 'Product update ho gaya!' });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---- SOFT DELETE PRODUCT (Admin only) ----
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('ProductID', sql.Int, req.params.id)
            .query('UPDATE Products SET IsDeleted = 1 WHERE ProductID = @ProductID');

        res.json({ success: true, message: 'Product delete ho gaya!' });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---- ADD REVIEW ----
router.post('/:id/review', verifyToken, async (req, res) => {
    try {
        const { rating, comment } = req.body;
        const pool = await poolPromise;

        await pool.request()
            .input('UserID', sql.Int, req.user.userId)
            .input('ProductID', sql.Int, req.params.id)
            .input('Rating', sql.Int, rating)
            .input('Comment', sql.VarChar, comment)
            .query('INSERT INTO Reviews (UserID, ProductID, Rating, Comment) VALUES (@UserID, @ProductID, @Rating, @Comment)');

        res.json({ success: true, message: 'Review submit ho gaya!' });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---- GET CATEGORIES ----
router.get('/meta/categories', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Categories');
        res.json({ success: true, categories: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---- GET BRANDS ----
router.get('/meta/brands', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Brands');
        res.json({ success: true, brands: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
