// =============================================
// middleware/auth.js — JWT Token Verification
// =============================================

const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ success: false, message: 'Token nahi mila. Please login karein.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ success: false, message: 'Token invalid ya expire ho gaya.' });
    }
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.roleId === 1) {
        next();
    } else {
        return res.status(403).json({ success: false, message: 'Sirf Admin access kar sakta hai.' });
    }
};

module.exports = { verifyToken, isAdmin };
