-- Add patta_number field to properties table
ALTER TABLE properties ADD COLUMN patta_number VARCHAR(100) AFTER water_connection_number;
