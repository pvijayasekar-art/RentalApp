const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const UPLOADS_DIR = '/app/uploads/documents';

async function migrateFilesToBlob() {
  console.log('[MIGRATION] Starting file migration to BLOB storage...');
  
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'mysql',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || 'rentalpass123',
    database: process.env.DB_NAME || 'rental_db',
    waitForConnections: true,
    connectionLimit: 5,
  });

  try {
    // Migrate tenant_documents
    console.log('[MIGRATION] Checking tenant_documents...');
    const [tenantDocs] = await pool.query(
      'SELECT id, filename, file_path FROM tenant_documents WHERE file_content IS NULL AND file_path IS NOT NULL'
    );
    console.log(`[MIGRATION] Found ${tenantDocs.length} tenant documents to migrate`);
    
    for (const doc of tenantDocs) {
      const filePath = doc.file_path;
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath);
          await pool.query(
            'UPDATE tenant_documents SET file_content = ? WHERE id = ?',
            [content, doc.id]
          );
          console.log(`[MIGRATION] ✓ Migrated tenant document ${doc.id}: ${path.basename(filePath)} (${content.length} bytes)`);
        } catch (err) {
          console.error(`[MIGRATION] ✗ Failed to migrate tenant document ${doc.id}:`, err.message);
        }
      } else {
        console.log(`[MIGRATION] ⚠ File not found for tenant document ${doc.id}: ${filePath}`);
      }
    }

    // Migrate collection_documents
    console.log('[MIGRATION] Checking collection_documents...');
    const [collectionDocs] = await pool.query(
      'SELECT id, filename, file_path FROM collection_documents WHERE file_content IS NULL AND file_path IS NOT NULL'
    );
    console.log(`[MIGRATION] Found ${collectionDocs.length} collection documents to migrate`);
    
    for (const doc of collectionDocs) {
      const filePath = doc.file_path;
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath);
          await pool.query(
            'UPDATE collection_documents SET file_content = ? WHERE id = ?',
            [content, doc.id]
          );
          console.log(`[MIGRATION] ✓ Migrated collection document ${doc.id}: ${path.basename(filePath)} (${content.length} bytes)`);
        } catch (err) {
          console.error(`[MIGRATION] ✗ Failed to migrate collection document ${doc.id}:`, err.message);
        }
      } else {
        console.log(`[MIGRATION] ⚠ File not found for collection document ${doc.id}: ${filePath}`);
      }
    }

    // Migrate expense_documents
    console.log('[MIGRATION] Checking expense_documents...');
    const [expenseDocs] = await pool.query(
      'SELECT id, filename, file_path FROM expense_documents WHERE file_content IS NULL AND file_path IS NOT NULL'
    );
    console.log(`[MIGRATION] Found ${expenseDocs.length} expense documents to migrate`);
    
    for (const doc of expenseDocs) {
      const filePath = doc.file_path;
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath);
          await pool.query(
            'UPDATE expense_documents SET file_content = ? WHERE id = ?',
            [content, doc.id]
          );
          console.log(`[MIGRATION] ✓ Migrated expense document ${doc.id}: ${path.basename(filePath)} (${content.length} bytes)`);
        } catch (err) {
          console.error(`[MIGRATION] ✗ Failed to migrate expense document ${doc.id}:`, err.message);
        }
      } else {
        console.log(`[MIGRATION] ⚠ File not found for expense document ${doc.id}: ${filePath}`);
      }
    }

    // Summary
    const [totalTenant] = await pool.query('SELECT COUNT(*) as count FROM tenant_documents WHERE file_content IS NOT NULL');
    const [totalCollection] = await pool.query('SELECT COUNT(*) as count FROM collection_documents WHERE file_content IS NOT NULL');
    const [totalExpense] = await pool.query('SELECT COUNT(*) as count FROM expense_documents WHERE file_content IS NOT NULL');
    
    console.log('\n[MIGRATION] === SUMMARY ===');
    console.log(`[MIGRATION] Tenant documents with BLOB: ${totalTenant[0].count}`);
    console.log(`[MIGRATION] Collection documents with BLOB: ${totalCollection[0].count}`);
    console.log(`[MIGRATION] Expense documents with BLOB: ${totalExpense[0].count}`);
    console.log('[MIGRATION] Migration complete!');
    
  } catch (err) {
    console.error('[MIGRATION] Fatal error:', err.message);
  } finally {
    await pool.end();
  }
}

migrateFilesToBlob();
