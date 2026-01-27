const { Pool } = require('pg');
require('dotenv').config();

let pool;

if (process.env.DATABASE_URL) {
    // Configuration pour la production (PostgreSQL)
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });
    console.log("Connecté à la base de données PostgreSQL");
} else {
    // On garde un fallback ou on prévient que SQLite n'est plus le moteur principal ici
    // Mais pour simplifier, on va tout passer en Postgres pour les services gratuits
    console.warn("DATABASE_URL manquante. Assurez-vous d'avoir configuré Supabase ou Neon.");
}

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool: pool
};
