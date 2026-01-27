const db = require('./db');
const bcrypt = require('bcryptjs');

const setup = () => {
    const adminPassword = 'admin'; // Mot de passe par défaut
    const hashedPassword = bcrypt.hashSync(adminPassword, 10);

    try {
        // Supprimer l'admin existant pour éviter les conflits lors du setup initial si besoin
        // Ou simplement mettre à jour s'il existe déjà
        const admin = db.prepare('SELECT id FROM users WHERE account_name = ?').get('admin');
        if (admin) {
            db.prepare('UPDATE users SET password = ? WHERE account_name = ?').run(hashedPassword, 'admin');
            console.log('Mot de passe admin mis à jour.');
        } else {
            db.prepare('INSERT INTO users (name, email, phone, account_name, password, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
                .run('Administrateur', 'admin@turquoise.spa', '0000', 'admin', hashedPassword, 'admin', 'active');
            console.log('Admin créé.');
        }

        // Services par défaut
        const servicesCount = db.prepare('SELECT COUNT(*) as count FROM services').get().count;
        if (servicesCount === 0) {
            db.prepare('INSERT INTO services (name, description, price) VALUES (?, ?, ?)').run('Coiffure Homme', 'Coupe simple', 10);
            db.prepare('INSERT INTO services (name, description, price) VALUES (?, ?, ?)').run('Pédicure', 'Soin complet des pieds', 20);
            db.prepare('INSERT INTO services (name, description, price) VALUES (?, ?, ?)').run('Massage', 'Massage relaxant 30min', 30);
            console.log('Services par défaut ajoutés.');
        }
    } catch (error) {
        console.error('Erreur lors de la configuration:', error);
    }
};

setup();
