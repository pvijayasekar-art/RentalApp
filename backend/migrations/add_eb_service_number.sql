-- Add EB Service number field to properties table
ALTER TABLE properties 
ADD COLUMN eb_service_number VARCHAR(50) NULL 
AFTER address;
