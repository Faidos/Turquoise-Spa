const db = require('./db');
const bcrypt = require('bcryptjs');

const addAgent = () => {
    const password = 'agent';
    const hashedPassword = bcrypt.hashSync(password, 10);
    try {
        db.prepare('INSERT INTO users (name, email, phone, account_name, password, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run('Marie Coiffeuse', 'marie@turquoise.spa', '0102030405', 'marie', hashedPassword, 'agent', 'active');
        console.log('Agent Marie créé.');
    } catch (e) {
        console.log('Agent déjà existant ou erreur:', e.message);
    }
};

addAgent();
