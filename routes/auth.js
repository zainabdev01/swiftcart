// =============================================
// routes/auth.js — Login & Register
// =============================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql, poolPromise } = require('../db');

// ---- REGISTER ----
router.post('/register', async (req, res) => {
    try {
        const { fullName, email, password, phone } = req.body;

        if (!fullName || !email || !password) {
            return res.status(400).json({ success: false, message: 'Sab fields zarori hain.' });
        }

        const pool = await poolPromise;

        // Check if email already exists
        const existing = await pool.request()
            .input('Email', sql.VarChar, email)
            .query('SELECT UserID FROM Users WHERE Email = @Email');

        if (existing.recordset.length > 0) {
            return res.status(400).json({ success: false, message: 'Yeh email pehle se registered hai.' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.request()
            .input('FullName', sql.VarChar, fullName)
            .input('Email', sql.VarChar, email)
            .input('PasswordHash', sql.VarChar, hashedPassword)
            .input('Phone', sql.VarChar, phone || null)
            .input('RoleID', sql.Int, 2) // Default: Customer
            .query(`INSERT INTO Users (FullName, Email, PasswordHash, Phone, RoleID) 
                    VALUES (@FullName, @Email, @PasswordHash, @Phone, @RoleID)`);

        res.json({ success: true, message: 'Account ban gaya! Ab login karein.' });

    } catch (err) {
        console.error('Register Error:', err);
        res.status(500).json({ success: false, message: 'Server error: ' + err.message });
    }
});

// ---- LOGIN ----
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email aur password dono chahiye.' });
        }

        const pool = await poolPromise;

        const result = await pool.request()
            .input('Email', sql.VarChar, email)
            .query('SELECT * FROM Users WHERE Email = @Email AND IsActive = 1');

        if (result.recordset.length === 0) {
            return res.status(401).json({ success: false, message: 'Email ya password galat hai.' });
        }

        const user = result.recordset[0];

        // Compare password (supports both hashed and plain for existing data)
        let isMatch = false;
        if (user.PasswordHash.startsWith('$2')) {
            isMatch = await bcrypt.compare(password, user.PasswordHash);
        } else {
            isMatch = (password === user.PasswordHash); // Legacy plain text
        }

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Password galat hai.' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.UserID, email: user.Email, roleId: user.RoleID, name: user.FullName },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            message: 'Login ho gaye!',
            token,
            user: {
                id: user.UserID,
                name: user.FullName,
                email: user.Email,
                roleId: user.RoleID
            }
        });

    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ success: false, message: 'Server error: ' + err.message });
    }
});
// Temporary — admin password reset
router.get('/reset-admin', async (req, res) => {
    try {
        const pool = await poolPromise;
        const hash = await bcrypt.hash('admin123', 10);
        await pool.request()
            .input('Hash', sql.VarChar, hash)
            .input('Email', sql.VarChar, 'admin@swiftcart.com')
            .query('UPDATE Users SET PasswordHash = @Hash WHERE Email = @Email');
        res.json({ success: true, message: 'Password reset ho gaya! Password: admin123' });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});
module.exports = router;
