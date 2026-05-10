-- Migration: Add Tax Filing and Receipts Tables
-- Run this to add new tables without affecting existing data

USE rental_db;

-- Tax Filings Table for ITR-2 and other returns
CREATE TABLE IF NOT EXISTS tax_filings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  assessment_year VARCHAR(10) NOT NULL,
  financial_year VARCHAR(10) NOT NULL,
  filing_type ENUM('ITR-1', 'ITR-2', 'ITR-3', 'ITR-4', 'TDS-26AS', 'Other') DEFAULT 'ITR-2',
  tax_regime ENUM('old', 'new') DEFAULT 'new',
  
  -- Income Details
  salary_income DECIMAL(12,2) DEFAULT 0,
  house_property_income DECIMAL(12,2) DEFAULT 0,
  other_income DECIMAL(12,2) DEFAULT 0,
  gross_total_income DECIMAL(12,2) DEFAULT 0,
  
  -- Deductions (Old Regime Only)
  deduction_80c DECIMAL(12,2) DEFAULT 0,
  deduction_80d DECIMAL(12,2) DEFAULT 0,
  deduction_80g DECIMAL(12,2) DEFAULT 0,
  deduction_80tta DECIMAL(12,2) DEFAULT 0,
  other_deductions DECIMAL(12,2) DEFAULT 0,
  total_deductions DECIMAL(12,2) DEFAULT 0,
  
  -- Tax Calculation
  taxable_income DECIMAL(12,2) DEFAULT 0,
  tax_payable DECIMAL(12,2) DEFAULT 0,
  cess_amount DECIMAL(12,2) DEFAULT 0,
  total_tax_liability DECIMAL(12,2) DEFAULT 0,
  tds_credit DECIMAL(12,2) DEFAULT 0,
  advance_tax_paid DECIMAL(12,2) DEFAULT 0,
  self_assessment_tax DECIMAL(12,2) DEFAULT 0,
  tax_refund DECIMAL(12,2) DEFAULT 0,
  
  -- House Property Details (JSON for flexibility)
  property_details JSON,
  municipal_taxes_paid DECIMAL(12,2) DEFAULT 0,
  standard_deduction DECIMAL(12,2) DEFAULT 0,
  
  -- Filing Status
  status ENUM('draft', 'filed', 'verified', 'processed') DEFAULT 'draft',
  filed_date DATE,
  acknowledgement_number VARCHAR(50),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_filing_ay (assessment_year, filing_type)
);

-- Rent Receipts Table
CREATE TABLE IF NOT EXISTS receipts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  receipt_number VARCHAR(50) NOT NULL UNIQUE,
  tenant_id INT NOT NULL,
  property_id INT NOT NULL,
  collection_id INT,
  
  -- Receipt Details
  receipt_date DATE NOT NULL,
  month_year VARCHAR(20) NOT NULL,
  rent_amount DECIMAL(12,2) NOT NULL,
  maintenance_amount DECIMAL(12,2) DEFAULT 0,
  utility_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL,
  
  -- Payment Details
  payment_method ENUM('cash', 'upi', 'bank_transfer', 'cheque', 'online') NOT NULL,
  payment_date DATE,
  reference_number VARCHAR(100),
  
  -- Receipt Status
  status ENUM('generated', 'sent', 'viewed', 'downloaded') DEFAULT 'generated',
  sent_date DATE,
  
  -- Generated Receipt Content (PDF base64 or URL)
  receipt_content TEXT,
  receipt_url VARCHAR(500),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE SET NULL
);

-- Receipt History/Log Table
CREATE TABLE IF NOT EXISTS receipts_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  receipt_id INT NOT NULL,
  action ENUM('generated', 'sent_email', 'sent_whatsapp', 'viewed', 'downloaded', 'resent') NOT NULL,
  action_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  action_by VARCHAR(100),
  ip_address VARCHAR(50),
  details TEXT,
  
  FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
);

-- Tax Filing Property Breakdown Table
CREATE TABLE IF NOT EXISTS tax_filing_properties (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tax_filing_id INT NOT NULL,
  property_id INT NOT NULL,
  
  -- Property Income Details
  expected_rent DECIMAL(12,2) DEFAULT 0,
  actual_rent_collected DECIMAL(12,2) DEFAULT 0,
  gross_annual_value DECIMAL(12,2) DEFAULT 0,
  municipal_taxes DECIMAL(12,2) DEFAULT 0,
  net_annual_value DECIMAL(12,2) DEFAULT 0,
  standard_deduction DECIMAL(12,2) DEFAULT 0,
  interest_on_loan DECIMAL(12,2) DEFAULT 0,
  income_from_property DECIMAL(12,2) DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (tax_filing_id) REFERENCES tax_filings(id) ON DELETE CASCADE,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  UNIQUE KEY unique_filing_property (tax_filing_id, property_id)
);

-- Indexes for performance
CREATE INDEX idx_tax_filings_ay ON tax_filings(assessment_year);
CREATE INDEX idx_receipts_tenant ON receipts(tenant_id);
CREATE INDEX idx_receipts_month ON receipts(month_year);
CREATE INDEX idx_receipts_date ON receipts(receipt_date);

-- Add receipt_id to collections table for linking
ALTER TABLE collections 
ADD COLUMN receipt_id INT NULL AFTER reference_number,
ADD FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE SET NULL;

-- Insert default tax filing record for AY 2025-26 if not exists
INSERT INTO tax_filings (
  assessment_year, 
  financial_year, 
  filing_type, 
  tax_regime,
  status
) 
SELECT '2025-26', '2024-25', 'ITR-2', 'new', 'draft'
WHERE NOT EXISTS (
  SELECT 1 FROM tax_filings WHERE assessment_year = '2025-26' AND filing_type = 'ITR-2'
);

-- Create view for receipt summary
CREATE OR REPLACE VIEW receipt_summary AS
SELECT 
  r.id,
  r.receipt_number,
  r.receipt_date,
  r.month_year,
  r.total_amount,
  r.status,
  t.name as tenant_name,
  p.name as property_name,
  r.payment_method,
  r.payment_date
FROM receipts r
JOIN tenants t ON r.tenant_id = t.id
JOIN properties p ON r.property_id = p.id;

-- Create view for tax filing summary
CREATE OR REPLACE VIEW tax_filing_summary AS
SELECT 
  tf.id,
  tf.assessment_year,
  tf.financial_year,
  tf.filing_type,
  tf.tax_regime,
  tf.gross_total_income,
  tf.taxable_income,
  tf.total_tax_liability,
  tf.tds_credit,
  tf.tax_refund,
  tf.status,
  COUNT(tfp.property_id) as properties_count,
  SUM(tfp.income_from_property) as total_property_income
FROM tax_filings tf
LEFT JOIN tax_filing_properties tfp ON tf.id = tfp.tax_filing_id
GROUP BY tf.id;

SELECT 'Migration completed successfully' as status;
