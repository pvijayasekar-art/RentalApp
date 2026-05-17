-- Add rental agreement date fields to tenant_documents table
-- This allows linking rental agreements with specific start and end dates

USE rental_db;

-- Add agreement_start_date column
ALTER TABLE tenant_documents 
ADD COLUMN agreement_start_date DATE NULL COMMENT 'Start date of the rental agreement';

-- Add agreement_end_date column
ALTER TABLE tenant_documents 
ADD COLUMN agreement_end_date DATE NULL COMMENT 'End date of the rental agreement';

-- Add index for faster queries on agreement dates
CREATE INDEX idx_agreement_dates ON tenant_documents(agreement_start_date, agreement_end_date);
