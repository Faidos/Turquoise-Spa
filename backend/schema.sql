CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    account_name TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'agent')) NOT NULL,
    status TEXT CHECK(status IN ('active', 'blocked')) DEFAULT 'active',
    specialty TEXT,
    commission_rate REAL DEFAULT 60,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL,
    agent_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    price_charged REAL NOT NULL,
    status TEXT CHECK(status IN ('pending', 'validated', 'rejected')) DEFAULT 'pending',
    service_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    validation_date DATETIME,
    FOREIGN KEY (service_id) REFERENCES services(id),
    FOREIGN KEY (agent_id) REFERENCES users(id),
    FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS user_services (
    user_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, service_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- Insert default admin
-- Password is 'admin'
INSERT INTO users (name, email, phone, account_name, password, role, status)
VALUES ('Administrateur', 'admin@turquoise.spa', '0000000000', 'admin', '$2b$10$/yp1ZXDYRy.MZBkEQy91bOVGG0U94cSXpqjXBddvacUlXFpRRZx.S', 'admin', 'active');
