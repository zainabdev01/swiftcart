// =============================================
// server.js — Main Server Entry Point (FIXED)
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
app.use(express.static(path.join(__dirname, 'public')));

// ---- ROUTES ----
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const wishlistRoutes = require('./routes/wishlist');  // ✅ FIXED

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/wishlist', wishlistRoutes);  // ✅ FIXED

// ---- EXTRA routes (payments) — only if file exists ----
try {
    const extraModule = require('./routes/extra');
    if (extraModule.paymentRouter) app.use('/api/payments', extraModule.paymentRouter);
    else app.use('/api/payments', extraModule);
} catch (e) {
    console.log('ℹ️ routes/extra.js nahi mila, skip.');
}

// ---- DB & AUTH ----
const { sql, poolPromise } = require('./db');
const { verifyToken, isAdmin } = require('./middleware/auth');

// ---- ADMIN: Dashboard Stats ----
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
        const recentOrders = await pool.request().query(`
            SELECT TOP 5 o.OrderID, u.FullName, o.TotalAmount, o.OrderStatus, o.OrderDate
            FROM Orders o INNER JOIN Users u ON o.UserID = u.UserID
            ORDER BY o.OrderDate DESC
        `);
        res.json({ success: true, stats: stats.recordset[0], recentOrders: recentOrders.recordset });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---- ADMIN: All Orders ----
app.get('/api/admin/orders', verifyToken, isAdmin, async (req, res) => {
    try {
        const pool = await poolPromise;
        const { status } = req.query;
        const request = pool.request();
        let query = `
            SELECT o.OrderID, u.FullName, u.Email, o.TotalAmount, 
                   o.OrderStatus, o.OrderDate, o.PaymentMethod
            FROM Orders o INNER JOIN Users u ON o.UserID = u.UserID
        `;
        if (status) {
            request.input('Status', sql.VarChar, status);
            query += ' WHERE o.OrderStatus = @Status';
        }
        query += ' ORDER BY o.OrderDate DESC';
        const result = await request.query(query);
        res.json({ success: true, orders: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---- ADMIN: Update Order Status ----
app.put('/api/orders/:orderId/status', verifyToken, isAdmin, async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('OrderID', sql.Int, req.params.orderId)
            .input('Status', sql.VarChar, req.body.status)
            .query('UPDATE Orders SET OrderStatus = @Status WHERE OrderID = @OrderID');
        res.json({ success: true, message: 'Order status update ho gaya!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---- ADMIN: Customers ----
app.get('/api/admin/customers', verifyToken, isAdmin, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT u.UserID, u.FullName, u.Email, u.Phone, u.IsActive, u.CreatedAt,
                   (SELECT COUNT(*) FROM Orders WHERE UserID = u.UserID) AS TotalOrders,
                   (SELECT ISNULL(SUM(TotalAmount),0) FROM Orders WHERE UserID = u.UserID AND OrderStatus != 'Cancelled') AS TotalSpent
            FROM Users u WHERE u.RoleID = 2
            ORDER BY u.CreatedAt DESC
        `);
        res.json({ success: true, customers: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---- ADMIN: Add Coupon ----
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

// ---- PROFILE ----
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