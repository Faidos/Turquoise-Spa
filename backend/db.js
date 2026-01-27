const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new Database(dbPath);

// On ne réexécute pas schema.sql à chaque fois s'il contient des INSERT sans IF NOT EXISTS
const schema = fs.readFileSync(path.resolve(__dirname, 'schema.sql'), 'utf8');
const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);

for (const stmt of statements) {
    try {
        db.exec(stmt);
    } catch (err) {
        // Ignorer les erreurs d'insertion de doublons au démarrage
        if (!err.message.includes('UNIQUE constraint failed')) {
            console.error('Erreur schema:', err.message);
        }
    }
}

module.exports = db;
