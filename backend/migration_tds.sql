-- Safe TDS Migration Script - Preserves Existing Data
-- Run this to add TDS fields without losing any data

USE rental_db;

-- Add TDS columns to tenants table (if they don't exist)
ALTER TABLE tenants 
  ADD COLUMN IF NOT EXISTS monthly_rent DECIMAL(12,2) DEFAULT 0 AFTER security_deposit,
  ADD COLUMN IF NOT EXISTS tds_applicable BOOLEAN DEFAULT FALSE AFTER status,
  ADD COLUMN IF NOT EXISTS tds_rate DECIMAL(5,2) DEFAULT 5.00 AFTER tds_applicable,
  ADD COLUMN IF NOT EXISTS tds_section VARCHAR(20) DEFAULT '194-IB' AFTER tds_rate;

-- Create TDS deposits tracking table (if it doesn't exist)
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

-- Auto-update existing tenants with monthly_rent > 50000 to have TDS applicable
UPDATE tenants 
SET tds_applicable = TRUE, 
    tds_rate = 5.00, 
    tds_section = '194-IB'
WHERE monthly_rent > 50000 AND tds_applicable = FALSE;

-- Verify migration
SELECT 'Tenants with TDS applicable:' AS info, COUNT(*) AS count 
FROM tenants 
WHERE tds_applicable = TRUE;
