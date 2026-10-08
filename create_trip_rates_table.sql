-- SQL Command to create the trip_rates table in Supabase
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS trip_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_loc TEXT NOT NULL,
    to_dest TEXT NOT NULL,
    trip_tip_rate NUMERIC DEFAULT 0,
    vehicle_rent NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(from_loc, to_dest)
);

-- Enable RLS and grant permissions
ALTER TABLE trip_rates DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE trip_rates TO anon, authenticated, service_role;

-- Insert some sample data based on the provided image
INSERT INTO trip_rates (from_loc, to_dest, trip_tip_rate, vehicle_rent) VALUES 
('10 TON PICKUP', 'RETURN', 20, 0),
('10 TON PICKUP', 'LOCAL', 10, 0),
('GI PLANT', 'NOBLE STEEL', 10, 165),
('HABSAN', 'ICAD', 100, 1325),
('HALIMA', 'JEBEL ALI', 25, 305)
ON CONFLICT (from_loc, to_dest) DO NOTHING;
