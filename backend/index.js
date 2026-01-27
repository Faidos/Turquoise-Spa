require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db_adapter');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'turquoise_secret_key_2026';

app.use(cors());
app.use(express.json());

// Logger
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// INITIALISATION DU SCHEMA (PostgreSQL)
const initDb = async () => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                phone TEXT NOT NULL,
                account_name TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT CHECK(role IN ('admin', 'agent')) NOT NULL,
                status TEXT CHECK(status IN ('active', 'blocked')) DEFAULT 'active',
                specialty TEXT,
                commission_rate REAL DEFAULT 60,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS services (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                price REAL NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS clients (
                id SERIAL PRIMARY KEY,
                full_name TEXT NOT NULL,
                phone TEXT NOT NULL,
                address TEXT,
                created_by INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS operations (
                id SERIAL PRIMARY KEY,
                service_id INTEGER NOT NULL REFERENCES services(id),
                agent_id INTEGER NOT NULL REFERENCES users(id),
                client_id INTEGER NOT NULL REFERENCES clients(id),
                price_charged REAL NOT NULL,
                notes TEXT,
                status TEXT CHECK(status IN ('pending', 'validated', 'rejected')) DEFAULT 'pending',
                service_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                validation_date TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS user_services (
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
                PRIMARY KEY (user_id, service_id)
            );
        `);

        // Insert Admin if not exists
        const adminCheck = await db.query("SELECT id FROM users WHERE role = 'admin'");
        if (adminCheck.rows.length === 0) {
            const hashedAdminPass = bcrypt.hashSync('admin', 10);
            await db.query(`
                INSERT INTO users (name, email, phone, account_name, password, role)
                VALUES ('Administrateur', 'admin@turquoise.spa', '0000000000', 'admin', $1, 'admin')
            `, [hashedAdminPass]);
            console.log("Admin créé par défaut");
        }

        // Services & Clients par défaut
        const walkInCheck = await db.query("SELECT id FROM clients WHERE full_name = 'Client de passage'");
        if (walkInCheck.rows.length === 0) {
            await db.query("INSERT INTO clients (full_name, phone, address) VALUES ('Client de passage', '0000000000', 'N/A')");
        }

        const otherServiceCheck = await db.query("SELECT id FROM services WHERE name = 'Service Autre'");
        if (otherServiceCheck.rows.length === 0) {
            await db.query("INSERT INTO services (name, description, price) VALUES ('Service Autre', 'Service personnalisé ou hors catalogue', 0)");
        }

        console.log("Base de données initialisée");
    } catch (err) {
        console.error("Erreur init DB:", err);
    }
};

initDb();

// Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token manquant' });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token invalide' });
        req.user = user;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès réservé' });
    next();
};

// ACTIONS
app.post('/api/auth/login', async (req, res) => {
    const { identifier, password } = req.body;
    try {
        const result = await db.query(`
            SELECT * FROM users 
            WHERE LOWER(email) = LOWER($1) OR phone = $1 OR LOWER(account_name) = LOWER($1)
        `, [identifier.trim()]);

        const user = result.rows[0];
        if (!user) return res.status(400).json({ error: 'Utilisateur non trouvé' });
        if (user.status === 'blocked') return res.status(403).json({ error: 'Compte bloqué' });

        const validPassword = bcrypt.compareSync(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Mot de passe incorrect' });

        const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '24h' });

        const userServices = await db.query('SELECT service_id FROM user_services WHERE user_id = $1', [user.id]);

        res.json({
            token,
            user: { ...user, service_ids: userServices.rows.map(s => s.service_id), password: undefined }
        });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await db.query('SELECT id, name, email, phone, account_name, role, status, created_at FROM users');
        const users = result.rows;
        const usersWithServices = await Promise.all(users.map(async (u) => {
            const servs = await db.query('SELECT service_id FROM user_services WHERE user_id = $1', [u.id]);
            return { ...u, service_ids: servs.rows.map(s => s.service_id) };
        }));
        res.json(usersWithServices);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
    const { name, email, phone, account_name, password, service_ids } = req.body;
    try {
        const existing = await db.query('SELECT id FROM users WHERE email = $1 OR account_name = $2', [email, account_name]);
        if (existing.rows.length > 0) return res.status(400).json({ error: 'Doublon' });

        const hashedPassword = bcrypt.hashSync(password, 10);
        const result = await db.query(`
            INSERT INTO users (name, email, phone, account_name, password, role, status)
            VALUES ($1, $2, $3, $4, $5, 'agent', 'active') RETURNING id
        `, [name, email, phone, account_name, hashedPassword]);

        const userId = result.rows[0]?.id || result.lastID;

        if (service_ids && Array.isArray(service_ids)) {
            for (const sId of service_ids) {
                await db.query('INSERT INTO user_services (user_id, service_id) VALUES ($1, $2)', [userId, sId]);
            }
        }
        res.json({ message: 'Agent créé' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/admin/users/:id/status', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    await db.query('UPDATE users SET status = $1 WHERE id = $2', [status, id]);
    res.json({ message: 'OK' });
});

app.delete('/api/admin/users/:id', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const user = (await db.query('SELECT role FROM users WHERE id = $1', [id])).rows[0];
        if (!user) return res.status(404).json({ error: 'Non trouvé' });
        if (user.role === 'admin') return res.status(403).json({ error: 'Impossible' });

        const opsCount = (await db.query('SELECT COUNT(*) FROM operations WHERE agent_id = $1', [id])).rows[0].count;
        if (opsCount > 0) return res.status(400).json({ error: 'Historique existant, bloquer plutôt' });

        await db.query('UPDATE clients SET created_by = NULL WHERE created_by = $1', [id]);
        await db.query('DELETE FROM users WHERE id = $1', [id]);
        res.json({ message: 'OK' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/users/:id/wipe', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('BEGIN');
        await db.query('UPDATE users SET status = $1 WHERE id = $2', ['blocked', id]);
        await db.query('DELETE FROM operations WHERE agent_id = $1', [id]);
        await db.query('COMMIT');
        res.json({ message: 'Purge effectuée' });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/services', authenticateToken, async (req, res) => {
    const result = await db.query('SELECT * FROM services ORDER BY name ASC');
    res.json(result.rows);
});

app.post('/api/admin/services', authenticateToken, isAdmin, async (req, res) => {
    const { name, description, price } = req.body;
    await db.query('INSERT INTO services (name, description, price) VALUES ($1, $2, $3)', [name, description, price]);
    res.json({ message: 'OK' });
});

app.put('/api/admin/services/:id', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, description, price } = req.body;
    await db.query('UPDATE services SET name = $1, description = $2, price = $3 WHERE id = $4', [name, description, price, id]);
    res.json({ message: 'OK' });
});

app.delete('/api/admin/services/:id', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const opsCount = (await db.query('SELECT COUNT(*) FROM operations WHERE service_id = $1', [id])).rows[0].count;
        if (opsCount > 0) return res.status(400).json({ error: 'Facturé déjà' });
        await db.query('DELETE FROM services WHERE id = $1', [id]);
        res.json({ message: 'OK' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/clients', authenticateToken, async (req, res) => {
    const { full_name, phone, address } = req.body;
    const result = await db.query('INSERT INTO clients (full_name, phone, address, created_by) VALUES ($1, $2, $3, $4) RETURNING id', [full_name, phone, address, req.user.id]);
    res.json({ id: result.rows[0]?.id || result.lastID, message: 'OK' });
});

app.get('/api/clients', authenticateToken, async (req, res) => {
    let result;
    if (req.user.role === 'admin') {
        result = await db.query('SELECT * FROM clients');
    } else {
        result = await db.query('SELECT * FROM clients WHERE created_by = $1', [req.user.id]);
    }
    res.json(result.rows);
});

app.post('/api/operations', authenticateToken, async (req, res) => {
    let { service_id, client_id, price_charged, notes, service_date } = req.body;
    if (!client_id) {
        const walkIn = await db.query("SELECT id FROM clients WHERE full_name = 'Client de passage'");
        client_id = walkIn.rows[0].id;
    }
    const params = [service_id, req.user.id, client_id, price_charged, notes || null, 'pending'];
    let query = 'INSERT INTO operations (service_id, agent_id, client_id, price_charged, notes, status) VALUES ($1, $2, $3, $4, $5, $6)';
    if (service_date) {
        query = 'INSERT INTO operations (service_id, agent_id, client_id, price_charged, notes, status, service_date) VALUES ($1, $2, $3, $4, $5, $6, $7)';
        params.push(service_date);
    }
    await db.query(query, params);
    res.json({ message: 'OK' });
});

app.get('/api/admin/operations/pending', authenticateToken, isAdmin, async (req, res) => {
    const result = await db.query(`
        SELECT o.*, s.name as service_name, c.full_name as client_name, u.name as agent_name
        FROM operations o
        JOIN services s ON o.service_id = s.id
        JOIN clients c ON o.client_id = c.id
        JOIN users u ON o.agent_id = u.id
        WHERE o.status = 'pending'
    `);
    res.json(result.rows);
});

app.patch('/api/admin/operations/:id/validate', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    await db.query('UPDATE operations SET status = $1, validation_date = CURRENT_TIMESTAMP WHERE id = $2', [status, id]);
    res.json({ message: 'OK' });
});

app.get('/api/reports', authenticateToken, async (req, res) => {
    let { start_date, end_date, agent_id } = req.query;
    if (req.user.role === 'agent') agent_id = req.user.id;

    let query = `
        SELECT o.*, s.name as service_name, u.name as agent_name, c.full_name as client_name
        FROM operations o
        JOIN services s ON o.service_id = s.id
        JOIN users u ON o.agent_id = u.id
        JOIN clients c ON o.client_id = c.id
        WHERE o.status = 'validated'
    `;
    const params = [];
    if (start_date) {
        query += ` AND o.service_date >= $${params.length + 1}`;
        params.push(start_date);
    }
    if (end_date) {
        query += ` AND o.service_date <= $${params.length + 1}`;
        params.push(end_date);
    }
    if (agent_id) {
        query += ` AND o.agent_id = $${params.length + 1}`;
        params.push(agent_id);
    }

    const result = await db.query(query, params);
    const operations = result.rows;
    const total = operations.reduce((sum, op) => sum + op.price_charged, 0);

    res.json({
        total,
        salon_share: total * 0.4,
        agents_share: total * 0.6,
        operation_count: operations.length,
        operations
    });
});

app.get('/api/agent/history', authenticateToken, async (req, res) => {
    let { start_date, end_date } = req.query;
    const agent_id = req.user.id;
    let query = `
        SELECT o.*, s.name as service_name, c.full_name as client_name
        FROM operations o
        JOIN services s ON o.service_id = s.id
        JOIN clients c ON o.client_id = c.id
        WHERE o.agent_id = $1
    `;
    const params = [agent_id];
    if (start_date) {
        query += ` AND o.service_date >= $${params.length + 1}`;
        params.push(start_date);
    }
    if (end_date) {
        query += ` AND o.service_date <= $${params.length + 1}`;
        params.push(end_date);
    }
    const result = await db.query(query + " ORDER BY o.service_date DESC", params);
    res.json(result.rows);
});

app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});
