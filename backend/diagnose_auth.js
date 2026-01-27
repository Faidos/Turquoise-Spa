
const db = require('./db');
const bcrypt = require('bcryptjs');

console.log('--- DIAGNOSTIC START ---');

const user = db.prepare("SELECT * FROM users WHERE account_name = 'admin'").get();

if (!user) {
    console.log('ERROR: User admin not found!');
} else {
    console.log('User found:', user.id, user.name, user.email);
    console.log('Stored Hash:', user.password);

    const testPass = 'admin';
    const isValid = bcrypt.compareSync(testPass, user.password);

    console.log(`Testing password '${testPass}': ${isValid ? 'VALID' : 'INVALID'}`);

    if (!isValid) {
        console.log('Attempting to re-hash and update...');
        const newHash = bcrypt.hashSync(testPass, 10);
        console.log('New Hash:', newHash);
        db.prepare("UPDATE users SET password = ? WHERE id = ?").run(newHash, user.id);
        console.log('Database updated. Re-testing...');
        const recheck = bcrypt.compareSync(testPass, newHash);
        console.log(`Re-test: ${recheck ? 'VALID' : 'INVALID'}`);
    }
}
console.log('--- DIAGNOSTIC END ---');
