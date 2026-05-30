// =============================================
// routes/orders.js — Order APIs
// =============================================

const express = require('express');
const router = express.Router();
const { sql, poolPromise } = require('../db');
const { verifyToken, isAdmin } = require('../middleware/auth');

// ---- PLACE ORDER (calls sp_PlaceOrder) ----
router.post('/place', verifyToken, async (req, res) => {
    try {
        const { couponCode } = req.body;
        const pool = await poolPromise;

        // Check cart is not empty
        const cartCheck = await pool.request()
            .input('UserID', sql.Int, req.user.userId)
            .query('SELECT COUNT(*) AS cnt FROM Cart WHERE UserID = @UserID');

        if (cartCheck.recordset[0].cnt === 0) {
            return res.status(400).json({ success: false, message: 'Cart khali hai!' });
        }

        // Validate coupon if provided
        let couponId = null;
        let discountPercent = 0;

        if (couponCode) {
            const coupon = await pool.request()
                .input('CouponCode', sql.VarChar, couponCode)
                .query(`SELECT * FROM Coupons WHERE CouponCode = @CouponCode 
                        AND ExpiryDate >= CAST(GETDATE() AS DATE)`);

            if (coupon.recordset.length > 0) {
                couponId = coupon.recordset[0].CouponID;
                discountPercent = coupon.recordset[0].DiscountPercent;
            } else if (couponCode) {
                return res.status(400).json({ success: false, message: 'Coupon invalid ya expire ho gaya.' });
            }
        }

        // Place order using stored procedure
        await pool.request()
            .input('UserID', sql.Int, req.user.userId)
            .execute('sp_PlaceOrder');

        // Get the new order
        const newOrder = await pool.request()
            .input('UserID', sql.Int, req.user.userId)
            .query('SELECT TOP 1 * FROM Orders WHERE UserID = @UserID ORDER BY OrderDate DESC');

        const orderId = newOrder.recordset[0].OrderID;

        // Apply coupon if valid
        if (couponId && discountPercent > 0) {
            await pool.request()
                .input('OrderID', sql.Int, orderId)
                .input('CouponID', sql.Int, couponId)
                .input('Discount', sql.Decimal, discountPercent)
                .query(`UPDATE Orders 
                        SET CouponID = @CouponID, 
                            TotalAmount = TotalAmount * (1 - @Discount/100.0) 
                        WHERE OrderID = @OrderID`);
        }

        // Create shipping record
        const trackingNum = 'TRK' + Date.now();
        await pool.request()
            .input('OrderID', sql.Int, orderId)
            .input('TrackingNumber', sql.VarChar, trackingNum)
            .input('ShippingStatus', sql.VarChar, 'Processing')
            .input('ShippingDate', sql.DateTime, new Date())
            .query(`INSERT INTO Shipping (OrderID, TrackingNumber, ShippingStatus, ShippingDate) 
                    VALUES (@OrderID, @TrackingNumber, @ShippingStatus, @ShippingDate)`);

        // Create notification
        await pool.request()
            .input('UserID', sql.Int, req.user.userId)
            .input('Message', sql.VarChar, `Aapka order #${orderId} place ho gaya! Tracking: ${trackingNum}`)
            .query('INSERT INTO Notifications (UserID, Message) VALUES (@UserID, @Message)');

        res.json({
            success: true,
            message: 'Order place ho gaya!',
            orderId,
            trackingNumber: trackingNum,
            discountApplied: discountPercent > 0 ? `${discountPercent}% discount laga!` : null
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---- GET MY ORDERS ----
router.get('/my', verifyToken, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('UserID', sql.Int, req.user.userId)
            .query(`
                SELECT o.OrderID, o.OrderDate, o.TotalAmount, o.OrderStatus,
                    s.TrackingNumber, s.ShippingStatus,
                    (SELECT COUNT(*) FROM OrderDetails WHERE OrderID = o.OrderID) AS ItemCount
                FROM Orders o
                LEFT JOIN Shipping s ON o.OrderID = s.OrderID
                WHERE o.UserID = @UserID
                ORDER BY o.OrderDate DESC
            `);

        res.json({ success: true, orders: result.recordset });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---- GET ORDER DETAIL ----
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const pool = await poolPromise;

        const order = await pool.request()
            .input('OrderID', sql.Int, req.params.id)
            .input('UserID', sql.Int, req.user.userId)
            .query(`
                SELECT o.*, s.TrackingNumber, s.ShippingStatus,
                    p.PaymentMethod, p.PaymentStatus
                FROM Orders o
                LEFT JOIN Shipping s ON o.OrderID = s.OrderID
                LEFT JOIN Payments p ON o.OrderID = p.OrderID
                WHERE o.OrderID = @OrderID 
                AND (o.UserID = @UserID OR 1 = (SELECT RoleID FROM Users WHERE UserID = @UserID))
            `);

        const details = await pool.request()
            .input('OrderID', sql.Int, req.params.id)
            .query(`
                SELECT od.*, p.ProductName, p.Price AS CurrentPrice
                FROM OrderDetails od
                INNER JOIN Products p ON od.ProductID = p.ProductID
                WHERE od.OrderID = @OrderID
            `);

        res.json({
            success: true,
            order: order.recordset[0],
            items: details.recordset
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---- UPDATE ORDER STATUS (Admin) ----
router.put('/:id/status', verifyToken, isAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status.' });
        }

        const pool = await poolPromise;
        await pool.request()
            .input('OrderID', sql.Int, req.params.id)
            .input('Status', sql.VarChar, status)
            .query('UPDATE Orders SET OrderStatus = @Status WHERE OrderID = @OrderID');

        // Update shipping status too
        await pool.request()
            .input('OrderID', sql.Int, req.params.id)
            .input('ShippingStatus', sql.VarChar, status)
            .query('UPDATE Shipping SET ShippingStatus = @ShippingStatus WHERE OrderID = @OrderID');

        res.json({ success: true, message: `Order status "${status}" ho gaya!` });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---- RETURN ORDER ----
router.post('/:id/return', verifyToken, async (req, res) => {
    try {
        const { reason } = req.body;
        const pool = await poolPromise;

        // Verify order belongs to user
        const orderCheck = await pool.request()
            .input('OrderID', sql.Int, req.params.id)
            .input('UserID', sql.Int, req.user.userId)
            .query(`SELECT * FROM Orders WHERE OrderID=@OrderID AND UserID=@UserID AND OrderStatus='Delivered'`);

        if (orderCheck.recordset.length === 0) {
            return res.status(400).json({ success: false, message: 'Return sirf delivered orders ka ho sakta hai.' });
        }

        const returnResult = await pool.request()
            .input('OrderID', sql.Int, req.params.id)
            .input('Reason', sql.VarChar, reason)
            .input('ReturnStatus', sql.VarChar, 'Pending')
            .query(`INSERT INTO Returns (OrderID, Reason, ReturnStatus) 
                    OUTPUT INSERTED.ReturnID
                    VALUES (@OrderID, @Reason, @ReturnStatus)`);

        const returnId = returnResult.recordset[0].ReturnID;

        // Create refund record
        const orderAmount = orderCheck.recordset[0].TotalAmount;
        await pool.request()
            .input('ReturnID', sql.Int, returnId)
            .input('RefundAmount', sql.Decimal, orderAmount)
            .query('INSERT INTO Refunds (ReturnID, RefundAmount) VALUES (@ReturnID, @RefundAmount)');

        res.json({ success: true, message: 'Return request submit ho gaya!', returnId });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---- ALL ORDERS (Admin) ----
router.get('/', verifyToken, isAdmin, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query(`
                SELECT o.OrderID, u.FullName, u.Email, o.TotalAmount, 
                    o.OrderStatus, o.OrderDate, s.TrackingNumber
                FROM Orders o
                INNER JOIN Users u ON o.UserID = u.UserID
                LEFT JOIN Shipping s ON o.OrderID = s.OrderID
                ORDER BY o.OrderDate DESC
            `);

        res.json({ success: true, orders: result.recordset });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
