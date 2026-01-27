const path = require('path');
require('dotenv').config();

let adapter;

if (process.env.DATABASE_URL) {
    // MODE PRODUCTION (PostgreSQL)
    const { Pool } = require('pg');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    adapter = {
        type: 'postgres',
        query: async (text, params = []) => {
            return await pool.query(text, params);
        },
        close: () => pool.end()
    };
    console.log("Using PostgreSQL Database");
} else {
    // MODE LOCAL (SQLite)
    const Database = require('better-sqlite3');
    const dbPath = path.resolve(__dirname, 'database.sqlite');
    const db = new Database(dbPath);

    adapter = {
        type: 'sqlite',
        query: async (text, params = []) => {
            // Conversions Postgres -> SQLite style
            let sqliteText = text
                .replace(/\$\d+/g, '?')
                .replace(/SERIAL PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
                .replace(/TIMESTAMP/gi, 'DATETIME')
                .replace(/RETURNING id/gi, '');

            const statements = sqliteText.trim().split(';').filter(s => s.trim().length > 0);
            let lastResult;

            for (const sql of statements) {
                const stmt = db.prepare(sql.trim());
                if (sql.trim().toUpperCase().startsWith('SELECT')) {
                    const rows = stmt.all(...params);
                    lastResult = { rows };
                } else {
                    const info = stmt.run(...params);
                    lastResult = {
                        rows: [],
                        rowCount: info.changes,
                        lastID: info.lastInsertRowid
                    };
                }
            }
            return lastResult;
        },
        close: () => db.close()
    };
    console.log("Using SQLite Database (Local Fallback)");
}

module.exports = adapter;
