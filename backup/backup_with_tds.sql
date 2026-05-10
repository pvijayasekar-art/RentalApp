-- Rental Manager Backup Script with TDS Support
-- This script creates a complete backup with all data including TDS tables

SET FOREIGN_KEY_CHECKS = 0;
SET @backup_time = NOW();

-- Create backup info table
CREATE TABLE IF NOT EXISTS backup_info (
  id INT AUTO_INCREMENT PRIMARY KEY,
  backup_time TIMESTAMP,
  backup_type VARCHAR(50),
  schema_version VARCHAR(20),
  total_tenants INT,
  total_properties INT,
  total_collections INT,
  total_expenses INT,
  total_tds_deposits INT,
  notes TEXT
);

-- Get statistics before backup
SET @tenant_count = (SELECT COUNT(*) FROM tenants);
SET @property_count = (SELECT COUNT(*) FROM properties);
SET @collection_count = (SELECT COUNT(*) FROM collections);
SET @expense_count = (SELECT COUNT(*) FROM expenses);
SET @tds_count = (SELECT COUNT(*) FROM tds_deposits);

-- Insert backup record
INSERT INTO backup_info (
  backup_time, backup_type, schema_version, 
  total_tenants, total_properties, total_collections, 
  total_expenses, total_tds_deposits, notes
) VALUES (
  @backup_time, 'FULL_BACKUP', 'v2.0_with_tds',
  @tenant_count, @property_count, @collection_count,
  @expense_count, @tds_count, 'Complete backup with TDS support'
);

-- Backup Properties
DROP TABLE IF EXISTS backup_properties;
CREATE TABLE backup_properties AS SELECT * FROM properties;

-- Backup Tenants (with TDS fields)
DROP TABLE IF EXISTS backup_tenants;
CREATE TABLE backup_tenants AS 
SELECT 
  id, name, email, phone, aadhar_number, pan_number, emergency_contact,
  property_id, unit_number, start_date, end_date, security_deposit,
  monthly_rent, status, tds_applicable, tds_rate, tds_section, created_at
FROM tenants;

-- Backup Collections
DROP TABLE IF EXISTS backup_collections;
CREATE TABLE backup_collections AS SELECT * FROM collections;

-- Backup Expenses
DROP TABLE IF EXISTS backup_expenses;
CREATE TABLE backup_expenses AS SELECT * FROM expenses;

-- Backup TDS Deposits (NEW)
DROP TABLE IF EXISTS backup_tds_deposits;
CREATE TABLE backup_tds_deposits AS SELECT * FROM tds_deposits;

-- Backup Documents (if exists)
DROP TABLE IF EXISTS backup_documents;
CREATE TABLE backup_documents AS SELECT * FROM documents;

-- Create backup summary view
CREATE OR REPLACE VIEW backup_summary AS
SELECT 
  'Backup Summary' as info,
  @backup_time as backup_time,
  (SELECT COUNT(*) FROM backup_properties) as properties_count,
  (SELECT COUNT(*) FROM backup_tenants) as tenants_count,
  (SELECT COUNT(*) FROM backup_tenants WHERE tds_applicable = TRUE) as tds_tenants_count,
  (SELECT COUNT(*) FROM backup_collections) as collections_count,
  (SELECT SUM(amount) FROM backup_collections) as total_collections_amount,
  (SELECT COUNT(*) FROM backup_expenses) as expenses_count,
  (SELECT SUM(amount) FROM backup_expenses) as total_expenses_amount,
  (SELECT COUNT(*) FROM backup_tds_deposits) as tds_deposits_count,
  (SELECT SUM(tds_amount) FROM backup_tds_deposits) as total_tds_amount;

-- Generate backup file
SELECT '=== BACKUP COMPLETED ===' as message;
SELECT CONCAT('Backup Time: ', @backup_time) as info;
SELECT CONCAT('Schema Version: v2.0_with_tds') as info;
SELECT CONCAT('Properties: ', @property_count) as info;
SELECT CONCAT('Tenants: ', @tenant_count) as info;
SELECT CONCAT('Tenants with TDS: ', (SELECT COUNT(*) FROM tenants WHERE tds_applicable = TRUE)) as info;
SELECT CONCAT('Collections: ', @collection_count) as info;
SELECT CONCAT('Expenses: ', @expense_count) as info;
SELECT CONCAT('TDS Deposits: ', @tds_count) as info;
SELECT '=== BACKUP TABLES READY ===' as message;

SET FOREIGN_KEY_CHECKS = 1;
