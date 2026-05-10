-- Rental Manager Restore Script with TDS Support
-- This script restores data from backup tables including TDS data
-- WARNING: This will replace all existing data!

SET FOREIGN_KEY_CHECKS = 0;
SET @restore_time = NOW();

-- Check if backup tables exist
SET @backup_exists = (
  SELECT COUNT(*) 
  FROM information_schema.tables 
  WHERE table_schema = DATABASE() 
  AND table_name IN ('backup_properties', 'backup_tenants', 'backup_collections', 'backup_expenses', 'backup_tds_deposits')
);

IF @backup_exists = 0 THEN
  SELECT 'ERROR: No backup tables found! Please run backup first.' as error;
ELSE
  -- Clear existing data (preserve structure)
  SELECT '=== CLEARING EXISTING DATA ===' as message;
  DELETE FROM documents;
  DELETE FROM tds_deposits;
  DELETE FROM collections;
  DELETE FROM expenses;
  DELETE FROM tenants;
  DELETE FROM properties;
  DELETE FROM backup_info;
  
  -- Restore Properties
  SELECT '=== RESTORING PROPERTIES ===' as message;
  INSERT INTO properties (
    id, name, address, type, total_units, monthly_rent, status, created_at
  ) SELECT 
    id, name, address, type, total_units, monthly_rent, status, created_at
  FROM backup_properties;
  
  -- Restore Tenants (with TDS fields)
  SELECT '=== RESTORING TENANTS ===' as message;
  INSERT INTO tenants (
    id, name, email, phone, aadhar_number, pan_number, emergency_contact,
    property_id, unit_number, start_date, end_date, security_deposit,
    monthly_rent, status, tds_applicable, tds_rate, tds_section, created_at
  ) SELECT 
    id, name, email, phone, aadhar_number, pan_number, emergency_contact,
    property_id, unit_number, start_date, end_date, security_deposit,
    monthly_rent, status, tds_applicable, tds_rate, tds_section, created_at
  FROM backup_tenants;
  
  -- Restore Collections
  SELECT '=== RESTORING COLLECTIONS ===' as message;
  INSERT INTO collections (
    id, tenant_id, property_id, amount, payment_date, payment_method,
    category, month_year, status, notes, reference_number, created_at
  ) SELECT 
    id, tenant_id, property_id, amount, payment_date, payment_method,
    category, month_year, status, notes, reference_number, created_at
  FROM backup_collections;
  
  -- Restore Expenses
  SELECT '=== RESTORING EXPENSES ===' as message;
  INSERT INTO expenses (
    id, property_id, category, description, amount, date, receipt_number,
    notes, created_at
  ) SELECT 
    id, property_id, category, description, amount, date, receipt_number,
    notes, created_at
  FROM backup_expenses;
  
  -- Restore TDS Deposits (NEW)
  SELECT '=== RESTORING TDS DEPOSITS ===' as message;
  INSERT INTO tds_deposits (
    id, tenant_id, property_id, month_year, rent_amount, tds_amount,
    tds_rate, status, deposit_date, challan_number, notes, created_at
  ) SELECT 
    id, tenant_id, property_id, month_year, rent_amount, tds_amount,
    tds_rate, status, deposit_date, challan_number, notes, created_at
  FROM backup_tds_deposits;
  
  -- Restore Documents (if exists)
  SELECT '=== RESTORING DOCUMENTS ===' as message;
  INSERT INTO documents (
    id, tenant_id, filename, file_path, file_size, mime_type,
    document_type, description, uploaded_at
  ) SELECT 
    id, tenant_id, filename, file_path, file_size, mime_type,
    document_type, description, uploaded_at
  FROM backup_documents;
  
  -- Record restore operation
  INSERT INTO backup_info (
    backup_time, backup_type, schema_version,
    total_tenants, total_properties, total_collections,
    total_expenses, total_tds_deposits, notes
  ) VALUES (
    @restore_time, 'RESTORE', 'v2.0_with_tds',
    (SELECT COUNT(*) FROM tenants),
    (SELECT COUNT(*) FROM properties),
    (SELECT COUNT(*) FROM collections),
    (SELECT COUNT(*) FROM expenses),
    (SELECT COUNT(*) FROM tds_deposits),
    'Data restored from backup with TDS support'
  );
  
  -- Show restore summary
  SELECT '=== RESTORE COMPLETED ===' as message;
  SELECT CONCAT('Restore Time: ', @restore_time) as info;
  SELECT CONCAT('Schema Version: v2.0_with_tds') as info;
  SELECT CONCAT('Properties Restored: ', (SELECT COUNT(*) FROM properties)) as info;
  SELECT CONCAT('Tenants Restored: ', (SELECT COUNT(*) FROM tenants)) as info;
  SELECT CONCAT('Tenants with TDS: ', (SELECT COUNT(*) FROM tenants WHERE tds_applicable = TRUE)) as info;
  SELECT CONCAT('Collections Restored: ', (SELECT COUNT(*) FROM collections)) as info;
  SELECT CONCAT('Expenses Restored: ', (SELECT COUNT(*) FROM expenses)) as info;
  SELECT CONCAT('TDS Deposits Restored: ', (SELECT COUNT(*) FROM tds_deposits)) as info;
  SELECT CONCAT('Documents Restored: ', (SELECT COUNT(*) FROM documents)) as info;
  
  -- Clean up backup tables after successful restore (optional)
  -- Uncomment the following lines to auto-clean backup tables after restore
  -- DROP TABLE IF EXISTS backup_properties;
  -- DROP TABLE IF EXISTS backup_tenants;
  -- DROP TABLE IF EXISTS backup_collections;
  -- DROP TABLE IF EXISTS backup_expenses;
  -- DROP TABLE IF EXISTS backup_tds_deposits;
  -- DROP TABLE IF EXISTS backup_documents;
  
END IF;

SET FOREIGN_KEY_CHECKS = 1;
