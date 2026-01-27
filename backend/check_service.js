
const db = require('./db');
try {
    const s = db.prepare("SELECT * FROM services WHERE name = 'Service Autre'").get();
    console.log(s ? 'FOUND: ' + s.id : 'NOT FOUND');
} catch (e) {
    console.error('ERROR:', e.message);
}
