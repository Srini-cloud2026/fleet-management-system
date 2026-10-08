-- ============================================================
-- SQL SCRIPT: Create 'admin_users' Table for Admin Authentication
-- Run this script in your Supabase SQL Editor
-- ============================================================

-- 1. Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    emp_id TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'super',       -- 'super', 'admin', 'dispatcher'
    email TEXT,
    phone TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- 2. Configure Row Level Security & Permissions
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE admin_users TO anon, authenticated, service_role;

-- 3. Seed Default Admin Accounts
INSERT INTO admin_users (emp_id, password, name, role, is_active)
VALUES 
    ('EMP-001', 'admin123', 'Admin User', 'super', true),
    ('EMP-8705', 'admin123', 'Super Admin', 'super', true)
ON CONFLICT (emp_id) DO UPDATE 
SET password = EXCLUDED.password, 
    name = EXCLUDED.name, 
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active;

-- 4. Verification Query
SELECT id, emp_id, name, role, is_active, created_at FROM admin_users;
