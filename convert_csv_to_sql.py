import csv
import sys

csv_file = "NSGT_Trip_Rates.csv"
sql_file = "insert_trip_rates.sql"

sql_content = """-- 1. Create the table
CREATE TABLE IF NOT EXISTS nsgt_trip_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_loc TEXT NOT NULL,
    to_dest TEXT NOT NULL,
    trip_tip_rate NUMERIC DEFAULT 0,
    vehicle_rent NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(from_loc, to_dest)
);

-- 2. Clear existing rates if re-running
TRUNCATE TABLE nsgt_trip_rates;

-- 3. Insert new rates
INSERT INTO nsgt_trip_rates (from_loc, to_dest, trip_tip_rate, vehicle_rent) VALUES 
"""

values = []

with open(csv_file, mode='r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        from_loc = row['From Location'].strip().replace("'", "''")
        to_dest = row['To Destination'].strip().replace("'", "''")
        tip = row['Trip Tip Rate'].strip() or "0"
        rent = row['Vechile Rental'].strip() or "0"
        
        values.append(f"('{from_loc}', '{to_dest}', {tip}, {rent})")

sql_content += ",\n".join(values) + "\n"
sql_content += "ON CONFLICT (from_loc, to_dest) DO UPDATE \n"
sql_content += "SET trip_tip_rate = EXCLUDED.trip_tip_rate, vehicle_rent = EXCLUDED.vehicle_rent;\n\n"

sql_content += "-- Enable RLS\n"
sql_content += "ALTER TABLE nsgt_trip_rates DISABLE ROW LEVEL SECURITY;\n"
sql_content += "GRANT ALL ON TABLE nsgt_trip_rates TO anon, authenticated, service_role;\n"

with open(sql_file, mode='w', encoding='utf-8') as f:
    f.write(sql_content)

print(f"Successfully generated {sql_file}")
