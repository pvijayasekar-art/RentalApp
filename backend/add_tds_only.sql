-- Add TDS functionality to existing database
-- This script adds TDS columns and table without affecting existing data

USE rental_db;

-- Add TDS columns to tenants table (if not already present)
ALTER TABLE tenants 
  ADD COLUMN tds_applicable BOOLEAN DEFAULT FALSE AFTER status,
  ADD COLUMN tds_rate DECIMAL(5,2) DEFAULT 5.00 AFTER tds_applicable,
  ADD COLUMN tds_section VARCHAR(20) DEFAULT '194-IB' AFTER tds_rate;

-- Create TDS deposits tracking table
CREATE TABLE IF NOT EXISTS tds_deposits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  property_id INT,
  month_year VARCHAR(20) NOT NULL,
  rent_amount DECIMAL(12,2) NOT NULL,
  tds_amount DECIMAL(12,2) NOT NULL,
  tds_rate DECIMAL(5,2) DEFAULT 5.00,
  status ENUM('pending','deposited') DEFAULT 'pending',
  deposit_date DATE,
  challan_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL,
  UNIQUE KEY unique_tds_month (tenant_id, month_year)
);

-- Update existing tenants with monthly_rent > 50000 to have TDS applicable
UPDATE tenants 
SET tds_applicable = TRUE, 
    tds_rate = 5.00, 
    tds_section = '194-IB'
WHERE monthly_rent > 50000 AND tds_applicable = FALSE;

-- Show results
SELECT 'TDS Migration Completed' as message;
SELECT COUNT(*) as total_tenants FROM tenants;
SELECT COUNT(*) as tds_tenants FROM tenants WHERE tds_applicable = TRUE;
