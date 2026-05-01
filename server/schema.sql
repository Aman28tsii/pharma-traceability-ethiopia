-- ============================================
-- PHARMACEUTICAL TRACEABILITY SYSTEM
-- COMPLETE SCHEMA FOR EFDA COMPLIANCE
-- ============================================

-- 1. USERS TABLE (Role-based)
DROP TABLE IF EXISTS users CASCADE;
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) CHECK (role IN ('admin', 'importer', 'distributor', 'pharmacy', 'auditor')),
    gln VARCHAR(13),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. PRODUCTS TABLE (GTIN-based)
DROP TABLE IF EXISTS products CASCADE;
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    gtin VARCHAR(14) UNIQUE NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    manufacturer VARCHAR(200),
    manufacturer_gln VARCHAR(13),
    dosage_form VARCHAR(100),
    strength VARCHAR(50),
    pack_size INTEGER,
    prescription_required BOOLEAN DEFAULT false,
    image_url TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. BATCHES TABLE
DROP TABLE IF EXISTS batches CASCADE;
CREATE TABLE batches (
    id SERIAL PRIMARY KEY,
    batch_number VARCHAR(50) NOT NULL,
    product_id INTEGER REFERENCES products(id),
    manufacturer_date DATE,
    expiry_date DATE NOT NULL,
    quantity INTEGER NOT NULL,
    total_units INTEGER,
    status VARCHAR(20) DEFAULT 'active',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, batch_number)
);

-- 4. SERIALIZED UNITS TABLE
DROP TABLE IF EXISTS serialized_units CASCADE;
CREATE TABLE serialized_units (
    id SERIAL PRIMARY KEY,
    gtin VARCHAR(14) NOT NULL,
    serial_number VARCHAR(50) UNIQUE NOT NULL,
    batch_number VARCHAR(50) NOT NULL,
    expiry_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    current_owner_gln VARCHAR(13),
    current_location VARCHAR(200),
    last_scanned_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. TRACE EVENTS TABLE
DROP TABLE IF EXISTS trace_events CASCADE;
CREATE TABLE trace_events (
    id SERIAL PRIMARY KEY,
    gtin VARCHAR(14) NOT NULL,
    serial_number VARCHAR(50) NOT NULL,
    event_type VARCHAR(50) CHECK (event_type IN ('manufacturing', 'import', 'distribute', 'receive', 'dispense', 'recall', 'destroy')),
    from_gln VARCHAR(13),
    to_gln VARCHAR(13),
    event_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. RECALLS TABLE
DROP TABLE IF EXISTS recalls CASCADE;
CREATE TABLE recalls (
    id SERIAL PRIMARY KEY,
    batch_number VARCHAR(50) NOT NULL,
    reason TEXT,
    severity VARCHAR(20) CHECK (severity IN ('Class I', 'Class II', 'Class III')),
    initiated_date DATE,
    status VARCHAR(20) DEFAULT 'active',
    affected_locations TEXT[],
    completion_date DATE,
    report_url TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. SCAN HISTORY TABLE
DROP TABLE IF EXISTS scan_history CASCADE;
CREATE TABLE scan_history (
    id SERIAL PRIMARY KEY,
    serial_number VARCHAR(50) NOT NULL,
    gtin VARCHAR(14) NOT NULL,
    scanned_by_gln VARCHAR(13),
    scan_result VARCHAR(50),
    ip_address VARCHAR(45),
    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. INVENTORY TABLE
DROP TABLE IF EXISTS inventory CASCADE;
CREATE TABLE inventory (
    id SERIAL PRIMARY KEY,
    owner_gln VARCHAR(13) NOT NULL,
    serial_number VARCHAR(50) REFERENCES serialized_units(serial_number),
    quantity INTEGER DEFAULT 1,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. OFFLINE QUEUE TABLE
DROP TABLE IF EXISTS offline_queue CASCADE;
CREATE TABLE offline_queue (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100),
    payload JSONB,
    retry_count INTEGER DEFAULT 0,
    synced BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. AUDIT LOGS TABLE
DROP TABLE IF EXISTS audit_logs CASCADE;
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100),
    entity_type VARCHAR(50),
    entity_id INTEGER,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_products_gtin ON products(gtin);
CREATE INDEX idx_batches_product ON batches(product_id);
CREATE INDEX idx_batches_expiry ON batches(expiry_date);
CREATE INDEX idx_serial_units_serial ON serialized_units(serial_number);
CREATE INDEX idx_serial_units_status ON serialized_units(status);
CREATE INDEX idx_serial_units_batch ON serialized_units(batch_number);
CREATE INDEX idx_trace_events_serial ON trace_events(serial_number);
CREATE INDEX idx_trace_events_date ON trace_events(event_date);
CREATE INDEX idx_scan_history_serial ON scan_history(serial_number);
CREATE INDEX idx_scan_history_date ON scan_history(scanned_at);
CREATE INDEX idx_inventory_owner ON inventory(owner_gln);
CREATE INDEX idx_offline_queue_synced ON offline_queue(synced);

-- ============================================
-- INSERT DEFAULT USERS (password: admin123)
-- ============================================

-- Admin User
INSERT INTO users (name, email, password, role, is_active, gln) VALUES 
('Admin User', 'admin@pharma.com', '..xgMhH0hIkzUbbC47wNxXRvSahp6SL82', 'admin', true, '6130000000001')
ON CONFLICT (email) DO NOTHING;

-- Importer User
INSERT INTO users (name, email, password, role, is_active, gln) VALUES 
('Sample Importer', 'importer@pharma.com', '..xgMhH0hIkzUbbC47wNxXRvSahp6SL82', 'importer', true, '6130000000002')
ON CONFLICT (email) DO NOTHING;

-- Distributor User
INSERT INTO users (name, email, password, role, is_active, gln) VALUES 
('Sample Distributor', 'distributor@pharma.com', '..xgMhH0hIkzUbbC47wNxXRvSahp6SL82', 'distributor', true, '6130000000003')
ON CONFLICT (email) DO NOTHING;

-- Pharmacy User
INSERT INTO users (name, email, password, role, is_active, gln) VALUES 
('Sample Pharmacy', 'pharmacy@pharma.com', '..xgMhH0hIkzUbbC47wNxXRvSahp6SL82', 'pharmacy', true, '6130000000004')
ON CONFLICT (email) DO NOTHING;

-- Auditor User
INSERT INTO users (name, email, password, role, is_active, gln) VALUES 
('Sample Auditor', 'auditor@pharma.com', '..xgMhH0hIkzUbbC47wNxXRvSahp6SL82', 'auditor', true, '6130000000005')
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- INSERT SAMPLE PRODUCTS
-- ============================================

INSERT INTO products (gtin, product_name, manufacturer, manufacturer_gln, dosage_form, strength, pack_size, prescription_required) VALUES
('06130000010001', 'Paracetamol 500mg', 'Ethio Pharma PLC', '6130000000010', 'Tablet', '500mg', 100, false),
('06130000010002', 'Amoxicillin 250mg', 'Addis Pharma', '6130000000011', 'Capsule', '250mg', 50, true),
('06130000010003', 'Artemether/Lumefantrine', 'Zamra Pharmaceuticals', '6130000000012', 'Tablet', '20/120mg', 24, true),
('06130000010004', 'Metformin 500mg', 'Ethio Pharma PLC', '6130000000010', 'Tablet', '500mg', 60, true),
('06130000010005', 'Vitamin C 1000mg', 'Adama Pharma', '6130000000013', 'Tablet', '1000mg', 30, false)
ON CONFLICT (gtin) DO NOTHING;

-- ============================================
-- INSERT SAMPLE BATCHES
-- ============================================

INSERT INTO batches (batch_number, product_id, manufacturer_date, expiry_date, quantity, total_units, status, created_by) 
SELECT 
    'BATCH001', 
    (SELECT id FROM products WHERE gtin = '06130000010001'), 
    '2024-01-01', 
    '2026-01-01', 
    1000, 
    1000, 
    'active', 
    (SELECT id FROM users WHERE email = 'admin@pharma.com')
WHERE EXISTS (SELECT 1 FROM products WHERE gtin = '06130000010001');

INSERT INTO batches (batch_number, product_id, manufacturer_date, expiry_date, quantity, total_units, status, created_by) 
SELECT 
    'BATCH002', 
    (SELECT id FROM products WHERE gtin = '06130000010002'), 
    '2024-02-01', 
    '2025-12-01', 
    500, 
    500, 
    'active', 
    (SELECT id FROM users WHERE email = 'admin@pharma.com')
WHERE EXISTS (SELECT 1 FROM products WHERE gtin = '06130000010002');

-- ============================================
-- INSERT SAMPLE SERIALIZED UNITS
-- ============================================

INSERT INTO serialized_units (gtin, serial_number, batch_number, expiry_date, status, current_owner_gln) VALUES
('06130000010001', '61300000010001000001', 'BATCH001', '2026-01-01', 'active', '6130000000001'),
('06130000010001', '61300000010001000002', 'BATCH001', '2026-01-01', 'distributed', '6130000000003'),
('06130000010002', '61300000010002000001', 'BATCH002', '2025-12-01', 'active', '6130000000001'),
('06130000010002', '61300000010002000002', 'BATCH002', '2025-12-01', 'sold', '6130000000004')
ON CONFLICT (serial_number) DO NOTHING;

-- ============================================
-- VERIFICATION QUERY
-- ============================================

SELECT 'Database Setup Complete!' as Status;
SELECT COUNT(*) as Total_Users FROM users;
SELECT COUNT(*) as Total_Products FROM products;
SELECT COUNT(*) as Total_Batches FROM batches;
SELECT COUNT(*) as Total_Serialized_Units FROM serialized_units;

-- Show all users
SELECT id, name, email, role, gln, is_active FROM users;
