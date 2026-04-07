-- Migration: Rename lease_start/lease_end to start_date/end_date
ALTER TABLE tenants CHANGE COLUMN lease_start start_date DATE;
ALTER TABLE tenants CHANGE COLUMN lease_end end_date DATE;
