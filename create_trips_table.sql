-- SQL Command to create the trips table in Supabase
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id TEXT NOT NULL,
    driver_name TEXT,
    vehicle_id TEXT NOT NULL,
    from_loc TEXT,
    to_dest TEXT,
    start_time TIMESTAMPTZ DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    start_lat NUMERIC,
    start_lng NUMERIC,
    end_lat NUMERIC,
    end_lng NUMERIC,
    start_odometer NUMERIC,
    end_odometer NUMERIC,
    rate NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'In Transit',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and grant permissions
ALTER TABLE trips DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE trips TO anon, authenticated, service_role;
