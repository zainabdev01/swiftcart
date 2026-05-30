require('dotenv').config();
const sql = require('mssql');

const config = {
    server: process.env.swiftcart-server.database.windows.net,
    database: process.env.free-sql-db-3637408,
    user: process.env.swiftadmin,
    password: process.env.Swift1234!,
    options: {
        encrypt: true,
        trustServerCertificate: false,
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
        console.log('✅ Azure SQL se Connected ho gaye!');
        return pool;
    })
    .catch(err => {
        console.error('❌ DB Connection Error:', err.message);
        process.exit(1);
    });

module.exports = { sql, poolPromise };