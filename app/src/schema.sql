CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    owner_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (username, email, password, role)
VALUES
    ('alice', 'alice@example.com', 'password123', 'user'),
    ('bob', 'bob@example.com', 'password456', 'user'),
    ('admin', 'admin@example.com', 'admin123', 'admin')
ON CONFLICT (username) DO NOTHING;

INSERT INTO products (name, description, price, owner_id)
SELECT 'Blue Jacket', 'Blue winter jacket', 129.90, id
FROM users
WHERE username = 'alice'
AND NOT EXISTS (
    SELECT 1 FROM products WHERE name = 'Blue Jacket'
);

INSERT INTO products (name, description, price, owner_id)
SELECT 'Red Shoes', 'Red running shoes', 89.90, id
FROM users
WHERE username = 'bob'
AND NOT EXISTS (
    SELECT 1 FROM products WHERE name = 'Red Shoes'
);