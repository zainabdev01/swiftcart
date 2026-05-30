// =============================================
// server.js — Main Server Entry Point
// =============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// ---- MIDDLEWARE ----
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// ---- ROUTES ----
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const { default: paymentRoutes } = require('./routes/extra');
const extraModule = require('./routes/extra');

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', extraModule);
app.use('/api/wishlist', extraModule.wishlistRouter);
app.use('/api/notifications', extraModule.notifRouter);

// ---- ADMIN DASHBOARD API ----
const { sql, poolPromise } = require('./db');
const { verifyToken, isAdmin } = require('./middleware/auth');

// Dashboard stats
app.get('/api/admin/stats', verifyToken, isAdmin, async (req, res) => {
    try {
        const pool = await poolPromise;

        const stats = await pool.request().query(`
            SELECT 
                (SELECT COUNT(*) FROM Users WHERE RoleID = 2) AS TotalCustomers,
                (SELECT COUNT(*) FROM Products WHERE IsDeleted = 0) AS TotalProducts,
                (SELECT COUNT(*) FROM Orders) AS TotalOrders,
                (SELECT ISNULL(SUM(TotalAmount), 0) FROM Orders WHERE OrderStatus != 'Cancelled') AS TotalRevenue,
                (SELECT COUNT(*) FROM Orders WHERE OrderStatus = 'Pending') AS PendingOrders,
                (SELECT COUNT(*) FROM Returns WHERE ReturnStatus = 'Pending') AS PendingReturns
        `);

        // Recent orders
        const recentOrders = await pool.request().query(`
            SELECT TOP 5 o.OrderID, u.FullName, o.TotalAmount, o.OrderStatus, o.OrderDate
            FROM Orders o 
            INNER JOIN Users u ON o.UserID = u.UserID
            ORDER BY o.OrderDate DESC
        `);

        // Top products
        const topProducts = await pool.request().query(`
            SELECT TOP 5 p.ProductName, SUM(od.Quantity) AS TotalSold
            FROM OrderDetails od
            INNER JOIN Products p ON od.ProductID = p.ProductID
            GROUP BY p.ProductName
            ORDER BY TotalSold DESC
        `);

        res.json({
            success: true,
            stats: stats.recordset[0],
            recentOrders: recentOrders.recordset,
            topProducts: topProducts.recordset
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// All users (Admin)
app.get('/api/admin/users', verifyToken, isAdmin, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT u.UserID, u.FullName, u.Email, u.Phone, u.IsActive, 
                   u.CreatedAt, r.RoleName,
                   (SELECT COUNT(*) FROM Orders WHERE UserID = u.UserID) AS OrderCount
            FROM Users u
            INNER JOIN Roles r ON u.RoleID = r.RoleID
            ORDER BY u.CreatedAt DESC
        `);
        res.json({ success: true, users: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Toggle user active status
app.put('/api/admin/users/:id/toggle', verifyToken, isAdmin, async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('UserID', sql.Int, req.params.id)
            .query('UPDATE Users SET IsActive = CASE WHEN IsActive=1 THEN 0 ELSE 1 END WHERE UserID=@UserID');
        res.json({ success: true, message: 'User status update ho gaya!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Add coupon (Admin)
app.post('/api/admin/coupons', verifyToken, isAdmin, async (req, res) => {
    try {
        const { couponCode, discountPercent, expiryDate } = req.body;
        const pool = await poolPromise;
        await pool.request()
            .input('CouponCode', sql.VarChar, couponCode)
            .input('DiscountPercent', sql.Int, discountPercent)
            .input('ExpiryDate', sql.Date, expiryDate)
            .query('INSERT INTO Coupons (CouponCode, DiscountPercent, ExpiryDate) VALUES (@CouponCode, @DiscountPercent, @ExpiryDate)');
        res.json({ success: true, message: 'Coupon add ho gaya!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get all coupons
app.get('/api/admin/coupons', verifyToken, isAdmin, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Coupons ORDER BY ExpiryDate DESC');
        res.json({ success: true, coupons: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Inventory logs (Admin)
app.get('/api/admin/inventory', verifyToken, isAdmin, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT il.*, p.ProductName 
            FROM InventoryLogs il
            INNER JOIN Products p ON il.ProductID = p.ProductID
            ORDER BY il.UpdatedAt DESC
        `);
        res.json({ success: true, logs: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// User profile
app.get('/api/profile', verifyToken, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.Int, req.user.userId)
            .query(`
                SELECT u.UserID, u.FullName, u.Email, u.Phone, u.CreatedAt, r.RoleName
                FROM Users u INNER JOIN Roles r ON u.RoleID = r.RoleID
                WHERE u.UserID = @UserID
            `);
        res.json({ success: true, user: result.recordset[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---- SERVE FRONTEND ----
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---- START SERVER ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server chal raha hai: http://localhost:${PORT}`);
    console.log(`📊 Admin Panel: http://localhost:${PORT}/admin.html`);
});
