-- ============================================================================
-- Migration Script: Convert file_path storage to file_content BLOB storage
-- ============================================================================
-- This script migrates the document tables from storing file paths to storing
-- actual file content as BLOB in the database.
-- 
-- IMPORTANT: This migration will REMOVE existing file_path data. Ensure you
-- have backed up your database before running this script.
-- ============================================================================

-- ============================================================================
-- MIGRATE TENANT DOCUMENTS
-- ============================================================================

-- Add file_content column (ignore error if already exists)
ALTER TABLE tenant_documents ADD COLUMN file_content LONGBLOB NULL;

-- ============================================================================
-- MIGRATE COLLECTION DOCUMENTS  
-- ============================================================================

-- Add file_content column (ignore error if already exists)
ALTER TABLE collection_documents ADD COLUMN file_content LONGBLOB NULL;

-- ============================================================================
-- MIGRATE EXPENSE DOCUMENTS
-- ============================================================================

-- Add file_content column (ignore error if already exists)
ALTER TABLE expense_documents ADD COLUMN file_content LONGBLOB NULL;

-- ============================================================================
-- NOTES FOR MANUAL MIGRATION OF EXISTING FILES
-- ============================================================================
-- If you have existing files stored on disk that need to be migrated to BLOB:
--
-- 1. Create a backup of your database first!
-- 2. Run this script to add the file_content columns
-- 3. Use a script to read existing files from disk and update the database:
--
-- Example Node.js migration helper (run separately):
/*
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function migrateFilesToBlob() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'rental_db'
  });

  // Migrate tenant_documents
  const [tenantDocs] = await pool.query('SELECT id, file_path FROM tenant_documents WHERE file_path IS NOT NULL AND file_content IS NULL');
  for (const doc of tenantDocs) {
    if (fs.existsSync(doc.file_path)) {
      const content = fs.readFileSync(doc.file_path);
      await pool.query('UPDATE tenant_documents SET file_content = ? WHERE id = ?', [content, doc.id]);
      console.log(`Migrated tenant document ${doc.id}`);
    }
  }

  // Repeat for collection_documents and expense_documents...
  
  await pool.end();
}

migrateFilesToBlob().catch(console.error);
*/

-- ============================================================================
-- OPTIMIZATION: Increase max_allowed_packet for large BLOBs
-- ============================================================================
-- If storing large files, you may need to increase max_allowed_packet:
-- SET GLOBAL max_allowed_packet = 16 * 1024 * 1024; -- 16MB
-- Or add to my.ini: max_allowed_packet=16M

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- After migration, verify the columns exist:
DESCRIBE tenant_documents;
DESCRIBE collection_documents;
DESCRIBE expense_documents;

-- Check file_content is populated (after migration):
-- SELECT 
--   'tenant_documents' as table_name,
--   COUNT(*) as total,
--   COUNT(file_content) as with_content,
--   COUNT(file_path) as with_path
-- FROM tenant_documents
-- UNION ALL
-- SELECT 
--   'collection_documents',
--   COUNT(*),
--   COUNT(file_content),
--   COUNT(file_path)
-- FROM collection_documents
-- UNION ALL
-- SELECT 
--   'expense_documents',
--   COUNT(*),
--   COUNT(file_content),
--   COUNT(file_path)
-- FROM expense_documents;
