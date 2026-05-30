// =============================================
// db.js — SQL Server Connection
// =============================================

require('dotenv').config();
const sql = require('mssql');

const config = {
    server: 'DESKTOP-MMKUS2U',
    database: 'AdvancedECommerceDB',
    user: 'sa',
    password: 'zainab123',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
        console.log('✅ SQL Server se Connected ho gaye!');
        return pool;
    })
    .catch(err => {
        console.error('❌ DB Connection Error:', err.message);
        process.exit(1);
    });

module.exports = { sql, poolPromise };