-- SQL to Create Vehicle Requests Table in Supabase
-- Run this in your Supabase SQL Editor

create table vechile_requests (
  id text primary key,
  created_at timestamptz default now(),
  requester_name text,
  requester_emp_id text,
  from_location text,
  to_location text,
  trip_date date,
  trip_time time,
  vehicle_type text,
  quantity int default 1,
  notes text,
  status text default 'Pending',
  assignments jsonb default '[]'::jsonb,
  estimated_duration_min int default 60
);

-- Basic RLS Policy (Allowing public demo access)
alter table vechile_requests enable row level security;
create policy "Public Access" on vechile_requests for all using (true) with check (true);
