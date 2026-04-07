const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
// Allow all CORS origins for WebView compatibility
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads', 'documents');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for in-memory storage (files stored as BLOB in DB)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDF, and DOC files are allowed.'));
    }
  }
});

// MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'rental_db',
  waitForConnections: true,
  connectionLimit: 10,
});

// Helper to convert file buffer for MySQL BLOB
const toBuffer = (file) => file?.buffer || null;

// ─── DASHBOARD ─────────────────────────────────────────────────────────────
app.get('/api/dashboard', async (req, res) => {
  try {
    const [totalProperties] = await pool.query('SELECT COUNT(*) as count FROM properties');
    const [totalTenants] = await pool.query('SELECT COUNT(*) as count FROM tenants');
    const [activeTenants] = await pool.query('SELECT COUNT(*) as count FROM tenants WHERE status="active"');
    const [monthlyCollection] = await pool.query(`
      SELECT COALESCE(SUM(amount),0) as total FROM collections 
      WHERE status='paid' AND MONTH(payment_date)=MONTH(CURDATE()) AND YEAR(payment_date)=YEAR(CURDATE())
    `);
    const [monthlyExpenses] = await pool.query(`
      SELECT COALESCE(SUM(amount),0) as total FROM expenses 
      WHERE MONTH(expense_date)=MONTH(CURDATE()) AND YEAR(expense_date)=YEAR(CURDATE())
    `);
    const [pendingRent] = await pool.query(`SELECT COUNT(*) as count FROM collections WHERE status IN ('pending','overdue')`);
    const [recentCollections] = await pool.query(`
      SELECT c.*, t.name as tenant_name, p.name as property_name 
      FROM collections c 
      JOIN tenants t ON c.tenant_id=t.id 
      JOIN properties p ON c.property_id=p.id 
      ORDER BY c.created_at DESC LIMIT 5
    `);
    const [recentExpenses] = await pool.query(`
      SELECT e.*, p.name as property_name FROM expenses e 
      LEFT JOIN properties p ON e.property_id=p.id 
      ORDER BY e.created_at DESC LIMIT 5
    `);
    const [monthlyTrend] = await pool.query(`
      SELECT DATE_FORMAT(payment_date,'%b %Y') as month,
             SUM(amount) as collections,
             MONTH(payment_date) as m, YEAR(payment_date) as y
      FROM collections WHERE status='paid' 
      GROUP BY YEAR(payment_date), MONTH(payment_date), DATE_FORMAT(payment_date,'%b %Y')
      ORDER BY y DESC, m DESC LIMIT 6
    `);

    res.json({
      stats: {
        totalProperties: totalProperties[0].count,
        totalTenants: totalTenants[0].count,
        activeTenants: activeTenants[0].count,
        monthlyCollection: monthlyCollection[0].total,
        monthlyExpenses: monthlyExpenses[0].total,
        pendingRent: pendingRent[0].count,
        netIncome: monthlyCollection[0].total - monthlyExpenses[0].total
      },
      recentCollections,
      recentExpenses,
      monthlyTrend: monthlyTrend.reverse()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PROPERTIES ─────────────────────────────────────────────────────────────
app.get('/api/properties', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*, COUNT(t.id) as tenant_count 
      FROM properties p LEFT JOIN tenants t ON p.id=t.property_id AND t.status='active'
      GROUP BY p.id ORDER BY p.created_at DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/properties', async (req, res) => {
  const { name, address, type, total_units, monthly_rent, status } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO properties (name,address,type,total_units,monthly_rent,status) VALUES (?,?,?,?,?,?)',
      [name, address, type, total_units, monthly_rent, status || 'active']
    );
    res.json({ id: result.insertId, message: 'Property added successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/properties/:id', async (req, res) => {
  const { name, address, type, total_units, monthly_rent, status } = req.body;
  try {
    await pool.query(
      'UPDATE properties SET name=?,address=?,type=?,total_units=?,monthly_rent=?,status=? WHERE id=?',
      [name, address, type, total_units, monthly_rent, status, req.params.id]
    );
    res.json({ message: 'Property updated successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/properties/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM properties WHERE id=?', [req.params.id]);
    res.json({ message: 'Property deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── TENANTS ────────────────────────────────────────────────────────────────
app.get('/api/tenants', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT t.*, p.name as property_name, p.monthly_rent 
      FROM tenants t LEFT JOIN properties p ON t.property_id=p.id
      ORDER BY t.created_at DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/tenants', async (req, res) => {
  const { name, email, phone, aadhar_number, pan_number, emergency_contact,
          property_id, unit_number, start_date, end_date, security_deposit, status } = req.body;
  try {
    const [result] = await pool.query(
      `INSERT INTO tenants (name,email,phone,aadhar_number,pan_number,emergency_contact,
       property_id,unit_number,start_date,end_date,security_deposit,status) 
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [name, email, phone, aadhar_number, pan_number, emergency_contact,
       property_id, unit_number, start_date, end_date, security_deposit || 0, status || 'active']
    );
    res.json({ id: result.insertId, message: 'Tenant added successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/tenants/:id', async (req, res) => {
  const { name, email, phone, aadhar_number, pan_number, emergency_contact,
          property_id, unit_number, start_date, end_date, security_deposit, status } = req.body;
  try {
    await pool.query(
      `UPDATE tenants SET name=?,email=?,phone=?,aadhar_number=?,pan_number=?,
       emergency_contact=?,property_id=?,unit_number=?,start_date=?,
       end_date=?,security_deposit=?,status=? WHERE id=?`,
      [name, email, phone, aadhar_number, pan_number, emergency_contact,
       property_id, unit_number, start_date, end_date, security_deposit, status, req.params.id]
    );
    res.json({ message: 'Tenant updated successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/tenants/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM tenants WHERE id=?', [req.params.id]);
    res.json({ message: 'Tenant deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── COLLECTIONS ────────────────────────────────────────────────────────────
app.get('/api/collections', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.*, t.name as tenant_name, p.name as property_name 
      FROM collections c 
      JOIN tenants t ON c.tenant_id=t.id 
      JOIN properties p ON c.property_id=p.id 
      ORDER BY c.payment_date DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/collections', async (req, res) => {
  const { tenant_id, property_id, amount, payment_date, payment_method, category,
          month_year, status, notes, reference_number } = req.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Insert collection
    const [result] = await connection.query(
      `INSERT INTO collections (tenant_id,property_id,amount,payment_date,payment_method,category,
       month_year,status,notes,reference_number) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [tenant_id, property_id, amount, payment_date, payment_method, category || 'rent',
       month_year, status || 'paid', notes, reference_number]
    );
    const collectionId = result.insertId;
    
    // Get tenant details for ledger
    const [tenants] = await connection.query('SELECT name, pan_number FROM tenants WHERE id=?', [tenant_id]);
    const tenantName = tenants[0]?.name || 'Unknown';
    const panNumber = tenants[0]?.pan_number || null;
    
    // Auto-create ledger entry
    const fyYear = getFinancialYear(payment_date);
    const quarter = getQuarter(payment_date);
    const gstRate = (category || 'rent') === 'rent' ? 0.18 : 0;
    const tdsRate = (category || 'rent') === 'rent' ? 0.10 : 0;
    const gstAmount = parseFloat((amount * gstRate).toFixed(2));
    const tdsAmount = parseFloat((amount * tdsRate).toFixed(2));
    const netAmount = parseFloat((amount - tdsAmount).toFixed(2));
    
    await connection.query(
      `INSERT INTO ledger_entries (entry_date,entry_type,category,description,amount,gst_amount,tds_amount,
       net_amount,property_id,tenant_id,reference_id,reference_type,pan_number,fy_year,quarter,vendor)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [payment_date, 'income', category || 'rent', `Payment from ${tenantName} - ${month_year}`,
       amount, gstAmount, tdsAmount, netAmount, property_id, tenant_id,
       collectionId, 'collection', panNumber, fyYear, quarter, tenantName]
    );
    
    await connection.commit();
    res.json({ id: collectionId, message: 'Collection recorded and ledger entry created' });
  } catch (err) { 
    await connection.rollback();
    res.status(500).json({ error: err.message }); 
  } finally {
    connection.release();
  }
});

app.put('/api/collections/:id', async (req, res) => {
  const { tenant_id, property_id, amount, payment_date, payment_method, category,
          month_year, status, notes, reference_number } = req.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Update collection
    await connection.query(
      `UPDATE collections SET tenant_id=?,property_id=?,amount=?,payment_date=?,
       payment_method=?,category=?,month_year=?,status=?,notes=?,reference_number=? WHERE id=?`,
      [tenant_id, property_id, amount, payment_date, payment_method, category,
       month_year, status, notes, reference_number, req.params.id]
    );
    
    // Get tenant details for ledger update
    const [tenants] = await connection.query('SELECT name, pan_number FROM tenants WHERE id=?', [tenant_id]);
    const tenantName = tenants[0]?.name || 'Unknown';
    const panNumber = tenants[0]?.pan_number || null;
    
    // Update existing ledger entry or create new one
    const fyYear = getFinancialYear(payment_date);
    const quarter = getQuarter(payment_date);
    const gstRate = category === 'rent' ? 0.18 : 0;
    const tdsRate = category === 'rent' ? 0.10 : 0;
    const gstAmount = parseFloat((amount * gstRate).toFixed(2));
    const tdsAmount = parseFloat((amount * tdsRate).toFixed(2));
    const netAmount = parseFloat((amount - tdsAmount).toFixed(2));
    
    // Check if ledger entry exists
    const [existing] = await connection.query(
      'SELECT id FROM ledger_entries WHERE reference_id=? AND reference_type=?',
      [req.params.id, 'collection']
    );
    
    if (existing.length > 0) {
      // Update existing ledger entry
      await connection.query(
        `UPDATE ledger_entries SET entry_date=?,category=?,description=?,amount=?,gst_amount=?,tds_amount=?,
         net_amount=?,property_id=?,tenant_id=?,pan_number=?,fy_year=?,quarter=?,vendor=? WHERE id=?`,
        [payment_date, category, `Payment from ${tenantName} - ${month_year}`,
         amount, gstAmount, tdsAmount, netAmount, property_id, tenant_id,
         panNumber, fyYear, quarter, tenantName, existing[0].id]
      );
    } else {
      // Create new ledger entry
      await connection.query(
        `INSERT INTO ledger_entries (entry_date,entry_type,category,description,amount,gst_amount,tds_amount,
         net_amount,property_id,tenant_id,reference_id,reference_type,pan_number,fy_year,quarter,vendor)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [payment_date, 'income', category, `Payment from ${tenantName} - ${month_year}`,
         amount, gstAmount, tdsAmount, netAmount, property_id, tenant_id,
         req.params.id, 'collection', panNumber, fyYear, quarter, tenantName]
      );
    }
    
    await connection.commit();
    res.json({ message: 'Collection and ledger entry updated successfully' });
  } catch (err) { 
    await connection.rollback();
    res.status(500).json({ error: err.message }); 
  } finally {
    connection.release();
  }
});

app.delete('/api/collections/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Delete linked ledger entry
    await connection.query(
      'DELETE FROM ledger_entries WHERE reference_id=? AND reference_type=?',
      [req.params.id, 'collection']
    );
    
    // Delete collection
    await connection.query('DELETE FROM collections WHERE id=?', [req.params.id]);
    
    await connection.commit();
    res.json({ message: 'Collection and linked ledger entry deleted' });
  } catch (err) { 
    await connection.rollback();
    res.status(500).json({ error: err.message }); 
  } finally {
    connection.release();
  }
});

// ─── EXPENSES ───────────────────────────────────────────────────────────────
app.get('/api/expenses', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT e.*, p.name as property_name FROM expenses e 
      LEFT JOIN properties p ON e.property_id=p.id 
      ORDER BY e.expense_date DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/expenses', async (req, res) => {
  const { property_id, category, description, amount, expense_date,
          vendor, status, receipt_number } = req.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Insert expense
    const [result] = await connection.query(
      `INSERT INTO expenses (property_id,category,description,amount,expense_date,
       vendor,status,receipt_number) VALUES (?,?,?,?,?,?,?,?)`,
      [property_id || null, category, description, amount, expense_date,
       vendor, status || 'paid', receipt_number]
    );
    const expenseId = result.insertId;
    
    // Auto-create ledger entry for expense
    const fyYear = getFinancialYear(expense_date);
    const quarter = getQuarter(expense_date);
    
    await connection.query(
      `INSERT INTO ledger_entries (entry_date,entry_type,category,description,amount,gst_amount,tds_amount,
       net_amount,property_id,reference_id,reference_type,fy_year,quarter,vendor)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [expense_date, 'expense', category, description,
       amount, 0, 0, amount, property_id || null,
       expenseId, 'expense', fyYear, quarter, vendor || null]
    );
    
    await connection.commit();
    res.json({ id: expenseId, message: 'Expense recorded and ledger entry created' });
  } catch (err) { 
    await connection.rollback();
    res.status(500).json({ error: err.message }); 
  } finally {
    connection.release();
  }
});

app.put('/api/expenses/:id', async (req, res) => {
  const { property_id, category, description, amount, expense_date,
          vendor, status, receipt_number } = req.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Update expense
    await connection.query(
      `UPDATE expenses SET property_id=?,category=?,description=?,amount=?,
       expense_date=?,vendor=?,status=?,receipt_number=? WHERE id=?`,
      [property_id || null, category, description, amount, expense_date,
       vendor, status, receipt_number, req.params.id]
    );
    
    // Update or create ledger entry
    const fyYear = getFinancialYear(expense_date);
    const quarter = getQuarter(expense_date);
    
    const [existing] = await connection.query(
      'SELECT id FROM ledger_entries WHERE reference_id=? AND reference_type=?',
      [req.params.id, 'expense']
    );
    
    if (existing.length > 0) {
      await connection.query(
        `UPDATE ledger_entries SET entry_date=?,category=?,description=?,amount=?,
         property_id=?,fy_year=?,quarter=?,vendor=? WHERE id=?`,
        [expense_date, category, description, amount,
         property_id || null, fyYear, quarter, vendor || null, existing[0].id]
      );
    } else {
      await connection.query(
        `INSERT INTO ledger_entries (entry_date,entry_type,category,description,amount,gst_amount,tds_amount,
         net_amount,property_id,reference_id,reference_type,fy_year,quarter,vendor)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [expense_date, 'expense', category, description,
         amount, 0, 0, amount, property_id || null,
         req.params.id, 'expense', fyYear, quarter, vendor || null]
      );
    }
    
    await connection.commit();
    res.json({ message: 'Expense and ledger entry updated successfully' });
  } catch (err) { 
    await connection.rollback();
    res.status(500).json({ error: err.message }); 
  } finally {
    connection.release();
  }
});

app.delete('/api/expenses/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Delete linked ledger entry
    await connection.query(
      'DELETE FROM ledger_entries WHERE reference_id=? AND reference_type=?',
      [req.params.id, 'expense']
    );
    
    // Delete expense
    await connection.query('DELETE FROM expenses WHERE id=?', [req.params.id]);
    
    await connection.commit();
    res.json({ message: 'Expense and linked ledger entry deleted' });
  } catch (err) { 
    await connection.rollback();
    res.status(500).json({ error: err.message }); 
  } finally {
    connection.release();
  }
});

// ─── TENANT DOCUMENTS ──────────────────────────────────────────────────────
// Upload document for a tenant
app.post('/api/tenants/:tenantId/documents', upload.single('file'), async (req, res) => {
  const { tenantId } = req.params;
  const { document_type, description } = req.body;
  
  console.log(`[UPLOAD] Tenant document upload requested for tenant ${tenantId}`);
  console.log(`[UPLOAD] Request file:`, req.file ? `Yes (${req.file.originalname}, ${req.file.size} bytes)` : 'No file');
  console.log(`[UPLOAD] Request body:`, { document_type, description });
  
  if (!req.file) {
    console.error(`[UPLOAD] Error: No file uploaded`);
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  try {
    const [result] = await pool.query(
      `INSERT INTO tenant_documents (tenant_id, filename, original_name, mime_type, file_size, file_content, document_type, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, req.file.filename || req.file.originalname, req.file.originalname, req.file.mimetype, req.file.size, req.file.buffer, document_type || 'other', description || '']
    );
    console.log(`[UPLOAD] Success: Document uploaded with ID ${result.insertId}`);
    res.json({ id: result.insertId, message: 'Document uploaded successfully' });
    
    // Trigger immediate backup to preserve document record
    createAutoBackup('document-upload');
  } catch (err) {
    console.error(`[UPLOAD] Database error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get all documents for a tenant
app.get('/api/tenants/:tenantId/documents', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, tenant_id, filename, original_name, mime_type, file_size, document_type, description, uploaded_at
       FROM tenant_documents WHERE tenant_id = ? ORDER BY uploaded_at DESC`,
      [req.params.tenantId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete a document
app.delete('/api/documents/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM tenant_documents WHERE id=?', [req.params.id]);
    res.json({ message: 'Document deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── COLLECTION DOCUMENTS (Payment Proof) ───────────────────────────────────
// Upload document for a collection payment
app.post('/api/collections/:collectionId/documents', upload.single('file'), async (req, res) => {
  const { collectionId } = req.params;
  const { description } = req.body;
  
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  try {
    const [result] = await pool.query(
      `INSERT INTO collection_documents (collection_id, filename, original_name, mime_type, file_size, file_content, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [collectionId, req.file.filename || req.file.originalname, req.file.originalname, req.file.mimetype, req.file.size, req.file.buffer, description || '']
    );
    res.json({ id: result.insertId, message: 'Payment proof uploaded successfully' });
    
    // Trigger immediate backup to preserve document record
    createAutoBackup('document-upload');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all documents for a collection
app.get('/api/collections/:collectionId/documents', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, collection_id, filename, original_name, mime_type, file_size, description, uploaded_at
       FROM collection_documents WHERE collection_id = ? ORDER BY uploaded_at DESC`,
      [req.params.collectionId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete a collection document
app.delete('/api/collection-documents/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM collection_documents WHERE id=?', [req.params.id]);
    res.json({ message: 'Payment proof deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── EXPENSE DOCUMENTS ──────────────────────────────────────────────────────
// Upload document for an expense
app.post('/api/expenses/:expenseId/documents', upload.single('file'), async (req, res) => {
  const { expenseId } = req.params;
  const { description } = req.body;
  
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  try {
    const [result] = await pool.query(
      `INSERT INTO expense_documents (expense_id, filename, original_name, mime_type, file_size, file_content, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [expenseId, req.file.filename || req.file.originalname, req.file.originalname, req.file.mimetype, req.file.size, req.file.buffer, description || '']
    );
    res.json({ id: result.insertId, message: 'Expense receipt uploaded successfully' });
    
    // Trigger immediate backup to preserve document record
    createAutoBackup('document-upload');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all documents for an expense
app.get('/api/expenses/:expenseId/documents', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, expense_id, filename, original_name, mime_type, file_size, description, uploaded_at
       FROM expense_documents WHERE expense_id = ? ORDER BY uploaded_at DESC`,
      [req.params.expenseId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete an expense document
app.delete('/api/expense-documents/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM expense_documents WHERE id=?', [req.params.id]);
    res.json({ message: 'Expense receipt deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── SERVE DOCUMENTS FROM DATABASE BLOB ───────────────────────────────────
// Serve tenant document
app.get('/api/documents/:id/download', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT original_name, mime_type, file_content FROM tenant_documents WHERE id=?',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Document not found' });
    
    const doc = rows[0];
    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${doc.original_name}"`);
    res.send(doc.file_content);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Serve collection document
app.get('/api/collection-documents/:id/download', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT original_name, mime_type, file_content FROM collection_documents WHERE id=?',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Document not found' });
    
    const doc = rows[0];
    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${doc.original_name}"`);
    res.send(doc.file_content);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Serve expense document
app.get('/api/expense-documents/:id/download', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT original_name, mime_type, file_content FROM expense_documents WHERE id=?',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Document not found' });
    
    const doc = rows[0];
    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${doc.original_name}"`);
    res.send(doc.file_content);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── DOCUMENT CONTENT EXTRACTION (Copy-Paste) ─────────────────────────────
// Extract raw text content from any document for copy-paste
app.post('/api/documents/:id/extract-content', async (req, res) => {
  try {
    // Try to find document in any of the document tables
    let doc = null;
    let docTable = '';
    
    // Check tenant_documents
    const [tenantDoc] = await pool.query('SELECT file_content, mime_type, original_name FROM tenant_documents WHERE id=?', [req.params.id]);
    if (tenantDoc.length > 0) { doc = tenantDoc[0]; docTable = 'tenant_documents'; }
    
    // Check collection_documents
    if (!doc) {
      const [collectionDoc] = await pool.query('SELECT file_content, mime_type, original_name FROM collection_documents WHERE id=?', [req.params.id]);
      if (collectionDoc.length > 0) { doc = collectionDoc[0]; docTable = 'collection_documents'; }
    }
    
    // Check expense_documents
    if (!doc) {
      const [expenseDoc] = await pool.query('SELECT file_content, mime_type, original_name FROM expense_documents WHERE id=?', [req.params.id]);
      if (expenseDoc.length > 0) { doc = expenseDoc[0]; docTable = 'expense_documents'; }
    }
    
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    
    const fileContent = doc.file_content;
    const mimeType = doc.mime_type;
    const originalName = doc.original_name;
    
    if (!fileContent) return res.status(404).json({ error: 'File content not found' });
    
    let text = '';
    let extractionMethod = '';
    
    // Check if PDF or image
    if (mimeType === 'application/pdf' || originalName.toLowerCase().endsWith('.pdf')) {
      try {
        const pdfData = await pdfParse(fileContent);
        text = pdfData.text;
        extractionMethod = 'pdf-parse';
        
        if (!text || text.trim().length < 50) {
          return res.json({ 
            text: '',
            error: 'Scanned PDF detected - no selectable text available. Upload as image for OCR.',
            method: 'pdf-parse',
            copyPaste: ''
          });
        }
      } catch (pdfErr) {
        return res.json({ 
          text: '',
          error: 'Failed to extract from PDF: ' + pdfErr.message,
          method: 'pdf-parse',
          copyPaste: ''
        });
      }
    } else if (mimeType && mimeType.startsWith('image/')) {
      // Perform OCR on images using buffer
      const worker = await createWorker('eng');
      const result = await worker.recognize(fileContent);
      await worker.terminate();
      text = result.data.text;
      extractionMethod = 'tesseract-ocr';
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Only PDF and images are supported.' });
    }
    
    // Clean up text for better copy-paste experience
    const cleanText = text
      .replace(/\n{3,}/g, '\n\n')  // Remove excessive newlines
      .replace(/[ \t]+/g, ' ')     // Normalize spaces
      .trim();
    
    res.json({ 
      text: cleanText,
      method: extractionMethod,
      copyPaste: cleanText,
      wordCount: cleanText.split(/\s+/).length,
      charCount: cleanText.length
    });
  } catch (err) { 
    console.error('Content extraction error:', err);
    res.status(500).json({ error: err.message }); 
  }
});

// ─── OCR & TENANT DATA EXTRACTION ───────────────────────────────────────────
const { createWorker } = require('tesseract.js');
const pdfParse = require('pdf-parse');

// Extract text from document using OCR (images) or pdf-parse (PDFs)
app.post('/api/documents/:id/extract', async (req, res) => {
  try {
    const [doc] = await pool.query('SELECT file_content, document_type, mime_type, original_name FROM tenant_documents WHERE id=?', [req.params.id]);
    if (doc.length === 0) return res.status(404).json({ error: 'Document not found' });
    
    const fileContent = doc[0].file_content;
    const docType = doc[0].document_type;
    const mimeType = doc[0].mime_type;
    const originalName = doc[0].original_name;
    
    if (!fileContent) return res.status(404).json({ error: 'File content not found' });
    
    let text = '';
    let extractionMethod = '';
    
    // Check if PDF or image
    if (mimeType === 'application/pdf' || originalName.toLowerCase().endsWith('.pdf')) {
      // First try pdf-parse for text-based PDFs
      try {
        const pdfData = await pdfParse(fileContent);
        text = pdfData.text;
        extractionMethod = 'pdf-parse';
        
        // If text is empty or too short, it's likely a scanned PDF
        if (!text || text.trim().length < 50) {
          console.log('PDF appears to be scanned (little text extracted)');
          text = '';
        }
      } catch (pdfErr) {
        console.log('pdf-parse failed:', pdfErr.message);
        text = '';
      }
      
      // If no text extracted, PDF is likely scanned images
      if (!text) {
        return res.status(400).json({ 
          error: 'Scanned PDF detected. Please upload the document as an image (JPG/PNG) for OCR extraction, or ensure the PDF contains selectable text.',
          rawText: '',
          extracted: { name: null, dateOfBirth: null, aadharNumber: null, panNumber: null, address: null }
        });
      }
    } else if (mimeType && mimeType.startsWith('image/')) {
      // Perform OCR on images using buffer
      console.log('Running OCR on image buffer');
      const worker = await createWorker('eng');
      const result = await worker.recognize(fileContent);
      await worker.terminate();
      text = result.data.text;
      extractionMethod = 'tesseract-ocr';
      console.log('OCR extracted text length:', text.length);
    } else {
      return res.status(400).json({ error: 'Unsupported file type for extraction. Only PDF (text-based) and images are supported.' });
    }
    
    // Parse extracted text based on document type
    const extractedData = parseDocumentText(text, docType);
    
    res.json({ 
      rawText: text,
      extracted: extractedData,
      method: extractionMethod
    });
  } catch (err) { 
    console.error('Extraction error:', err);
    res.status(500).json({ error: err.message }); 
  }
});

// Parse document text to extract structured data
function parseDocumentText(text, docType) {
  const data = {
    name: null,
    dateOfBirth: null,
    aadharNumber: null,
    panNumber: null,
    address: null,
    referenceNumber: null
  };
  
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  
  // Aadhar card patterns
  if (docType === 'aadhar' || text.includes('Aadhaar') || text.includes('UIDAI')) {
    // Aadhar number: 1234 5678 9012 or XXXX XXXX XXXX
    const aadharMatch = text.match(/(\d{4}\s?\d{4}\s?\d{4})/);
    if (aadharMatch) data.aadharNumber = aadharMatch[1].replace(/\s/g, ' ').replace(/(\d{4})/g, '$1 ').trim();
    
    // DOB: DD/MM/YYYY or YYYY-MM-DD
    const dobMatch = text.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})/);
    if (dobMatch) data.dateOfBirth = dobMatch[1];
    
    // Name extraction - look for common name patterns
    const namePatterns = [/Name[\s:]*([A-Z][a-z]+\s[A-Z][a-z]+)/i, /([A-Z][a-z]+\s[A-Z][a-z]+)\s*(?:DOB|Date|Father)/i];
    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match) { data.name = match[1]; break; }
    }
    
    // Address extraction - multi-line after "Address" keyword
    const addressMatch = text.match(/Address[\s:]*(.+?)(?:\n\n|\n[A-Z]|$)/is);
    if (addressMatch) data.address = addressMatch[1].replace(/\n/g, ', ').trim();
  }
  
  // PAN card patterns
  if (docType === 'pan' || text.includes('PAN') || text.match(/[A-Z]{5}[0-9]{4}[A-Z]/)) {
    // PAN: ABCDE1234F
    const panMatch = text.match(/([A-Z]{5}\d{4}[A-Z])/);
    if (panMatch) data.panNumber = panMatch[1];
    
    // Name on PAN
    const panNameMatch = text.match(/(?:Name|Father'?'s? Name)[\s:]*([A-Z][A-Z\s]+)(?:\n|$)/i);
    if (panNameMatch) data.name = panNameMatch[1].trim();
    
    // DOB on PAN
    const panDobMatch = text.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})/);
    if (panDobMatch) data.dateOfBirth = panDobMatch[1];
  }
  
  return data;
}

// Update tenant with extracted/confirmed data
app.post('/api/tenants/:id/update-from-document', async (req, res) => {
  const { name, aadhar_number, pan_number, address } = req.body;
  try {
    const updates = [];
    const values = [];
    
    if (name) { updates.push('name=?'); values.push(name); }
    if (aadhar_number) { updates.push('aadhar_number=?'); values.push(aadhar_number); }
    if (pan_number) { updates.push('pan_number=?'); values.push(pan_number); }
    // Note: address not stored in current tenants table schema, could be extended
    
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    
    values.push(req.params.id);
    await pool.query(`UPDATE tenants SET ${updates.join(',')} WHERE id=?`, values);
    
    res.json({ message: 'Tenant updated successfully', updated: updates.map(u => u.split('=')[0]) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── LEDGER ENTRIES (Tax Management) ────────────────────────────────────────
app.get('/api/ledger', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT l.*, p.name as property_name, t.name as tenant_name
      FROM ledger_entries l
      LEFT JOIN properties p ON l.property_id=p.id
      LEFT JOIN tenants t ON l.tenant_id=t.id
      ORDER BY l.entry_date DESC, l.id DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/ledger', async (req, res) => {
  const { entry_date, entry_type, category, description, amount, gst_amount, tds_amount, 
          net_amount, property_id, tenant_id, vendor, pan_number, gst_number, fy_year, 
          quarter, notes, reference_id, reference_type } = req.body;
  try {
    const [result] = await pool.query(
      `INSERT INTO ledger_entries (entry_date,entry_type,category,description,amount,gst_amount,tds_amount,
       net_amount,property_id,tenant_id,vendor,pan_number,gst_number,fy_year,quarter,notes,reference_id,reference_type)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [entry_date, entry_type, category, description, amount, gst_amount||0, tds_amount||0,
       net_amount||amount, property_id||null, tenant_id||null, vendor||null, pan_number||null, 
       gst_number||null, fy_year||null, quarter||null, notes||null, reference_id||null, reference_type||null]
    );
    res.json({ id: result.insertId, message: 'Ledger entry created successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/ledger/:id', async (req, res) => {
  const { entry_date, entry_type, category, description, amount, gst_amount, tds_amount,
          net_amount, property_id, tenant_id, vendor, pan_number, gst_number, fy_year, quarter, notes } = req.body;
  try {
    await pool.query(
      `UPDATE ledger_entries SET entry_date=?,entry_type=?,category=?,description=?,amount=?,gst_amount=?,tds_amount=?,
       net_amount=?,property_id=?,tenant_id=?,vendor=?,pan_number=?,gst_number=?,fy_year=?,quarter=?,notes=? WHERE id=?`,
      [entry_date, entry_type, category, description, amount, gst_amount, tds_amount,
       net_amount, property_id||null, tenant_id||null, vendor||null, pan_number||null,
       gst_number||null, fy_year||null, quarter||null, notes||null, req.params.id]
    );
    res.json({ message: 'Ledger entry updated successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/ledger/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM ledger_entries WHERE id=?', [req.params.id]);
    res.json({ message: 'Ledger entry deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get ledger summary for tax purposes
app.get('/api/ledger/summary/:fyYear', async (req, res) => {
  try {
    const fyYear = req.params.fyYear;
    const [income] = await pool.query(
      `SELECT SUM(amount) as total_income, SUM(gst_amount) as total_gst_collected, 
       category, quarter FROM ledger_entries WHERE entry_type='income' AND fy_year=? GROUP BY category, quarter`,
      [fyYear]
    );
    const [expense] = await pool.query(
      `SELECT SUM(amount) as total_expense, SUM(gst_amount) as total_gst_paid,
       category, quarter FROM ledger_entries WHERE entry_type='expense' AND fy_year=? GROUP BY category, quarter`,
      [fyYear]
    );
    res.json({ income, expense, fy_year: fyYear });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get ledger summary by calendar year
app.get('/api/ledger/calendar-summary/:year', async (req, res) => {
  try {
    const year = req.params.year;
    const [income] = await pool.query(
      `SELECT SUM(amount) as total_income, SUM(gst_amount) as total_gst_collected, 
       category, MONTH(entry_date) as month FROM ledger_entries 
       WHERE entry_type='income' AND YEAR(entry_date)=? GROUP BY category, MONTH(entry_date)`,
      [year]
    );
    const [expense] = await pool.query(
      `SELECT SUM(amount) as total_expense, SUM(gst_amount) as total_gst_paid,
       category, MONTH(entry_date) as month FROM ledger_entries 
       WHERE entry_type='expense' AND YEAR(entry_date)=? GROUP BY category, MONTH(entry_date)`,
      [year]
    );
    res.json({ income, expense, calendar_year: year });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get returns filing data for calendar year (GST/TDS)
app.get('/api/ledger/returns-filing/:year', async (req, res) => {
  try {
    const year = req.params.year;
    
    // GSTR-1: Outward supplies (Income with GST) - Monthly breakdown
    const [gstr1Data] = await pool.query(
      `SELECT 
        MONTH(entry_date) as month,
        SUM(amount) as taxable_value,
        SUM(gst_amount) as gst_amount,
        category,
        COUNT(*) as invoice_count
       FROM ledger_entries 
       WHERE entry_type='income' AND YEAR(entry_date)=? AND gst_amount > 0
       GROUP BY MONTH(entry_date), category
       ORDER BY MONTH(entry_date)`,
      [year]
    );
    
    // GSTR-3B: Summary data by quarter
    const [gstr3bData] = await pool.query(
      `SELECT 
        quarter,
        SUM(CASE WHEN entry_type='income' AND gst_amount > 0 THEN amount ELSE 0 END) as outward_taxable_supply,
        SUM(CASE WHEN entry_type='income' AND gst_amount > 0 THEN gst_amount ELSE 0 END) as outward_gst,
        SUM(CASE WHEN entry_type='expense' AND gst_amount > 0 THEN amount ELSE 0 END) as inward_taxable_supply,
        SUM(CASE WHEN entry_type='expense' AND gst_amount > 0 THEN gst_amount ELSE 0 END) as inward_gst,
        SUM(CASE WHEN entry_type='income' THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN entry_type='expense' THEN amount ELSE 0 END) as total_expense
       FROM ledger_entries 
       WHERE YEAR(entry_date)=?
       GROUP BY quarter
       ORDER BY FIELD(quarter, 'Q1', 'Q2', 'Q3', 'Q4')`,
      [year]
    );
    
    // TDS Return (Form 26Q): Rent payments with TDS
    const [tdsData] = await pool.query(
      `SELECT 
        vendor as deductee_name,
        pan_number as deductee_pan,
        SUM(amount) as total_payment,
        SUM(tds_amount) as total_tds,
        COUNT(*) as transaction_count,
        MIN(entry_date) as first_payment,
        MAX(entry_date) as last_payment
       FROM ledger_entries 
       WHERE entry_type='income' AND tds_amount > 0 AND YEAR(entry_date)=?
       GROUP BY vendor, pan_number
       ORDER BY total_tds DESC`,
      [year]
    );
    
    // Monthly summary for Challan generation
    const [monthlyTDS] = await pool.query(
      `SELECT 
        MONTH(entry_date) as month,
        SUM(tds_amount) as tds_amount,
        SUM(CASE WHEN category='rent' THEN tds_amount ELSE 0 END) as rent_tds,
        COUNT(*) as transactions
       FROM ledger_entries 
       WHERE entry_type='income' AND tds_amount > 0 AND YEAR(entry_date)=?
       GROUP BY MONTH(entry_date)
       ORDER BY MONTH(entry_date)`,
      [year]
    );
    
    // Annual totals for Income Tax Return
    const [annualSummary] = await pool.query(
      `SELECT 
        SUM(CASE WHEN entry_type='income' THEN net_amount ELSE 0 END) as total_rental_income,
        SUM(CASE WHEN entry_type='income' THEN tds_amount ELSE 0 END) as total_tds_deducted,
        SUM(CASE WHEN entry_type='expense' THEN amount ELSE 0 END) as total_expenses,
        SUM(CASE WHEN entry_type='income' THEN gst_amount ELSE 0 END) as gst_collected,
        SUM(CASE WHEN entry_type='expense' THEN gst_amount ELSE 0 END) as gst_paid
       FROM ledger_entries 
       WHERE YEAR(entry_date)=?`,
      [year]
    );
    
    res.json({
      calendar_year: year,
      gst: {
        gstr1_monthly: gstr1Data,
        gstr3b_quarterly: gstr3bData
      },
      tds: {
        form26q: tdsData,
        monthly_challans: monthlyTDS
      },
      income_tax: annualSummary[0]
    });
  } catch (err) { 
    console.error('Returns filing error:', err);
    res.status(500).json({ error: err.message }); 
  }
});

// ─── PAYMENT REFERENCE EXTRACTION ───────────────────────────────────────────
// Extract reference number from payment proof and update collection
app.post('/api/collections/:collectionId/extract-reference', async (req, res) => {
  try {
    const collectionId = req.params.collectionId;
    
    // Get the most recent document for this collection
    const [docs] = await pool.query(
      'SELECT file_content, mime_type, original_name FROM collection_documents WHERE collection_id=? ORDER BY uploaded_at DESC LIMIT 1',
      [collectionId]
    );
    
    if (docs.length === 0) {
      return res.status(404).json({ error: 'No payment proof found for this collection' });
    }
    
    const doc = docs[0];
    const fileContent = doc.file_content;
    const mimeType = doc.mime_type;
    
    if (!fileContent) {
      return res.status(404).json({ error: 'File content not found' });
    }
    
    let text = '';
    
    // Extract text based on file type
    if (mimeType === 'application/pdf' || doc.original_name.toLowerCase().endsWith('.pdf')) {
      try {
        const pdfData = await pdfParse(fileContent);
        text = pdfData.text;
      } catch (e) {
        console.log('PDF parse failed:', e.message);
      }
    } else if (mimeType && mimeType.startsWith('image/')) {
      const worker = await createWorker('eng');
      const result = await worker.recognize(fileContent);
      await worker.terminate();
      text = result.data.text;
    }
    
    // Extract reference number patterns
    const extractedRef = extractPaymentReference(text);
    
    // If we found a reference number, update the collection
    if (extractedRef) {
      await pool.query('UPDATE collections SET reference_number=? WHERE id=?', [extractedRef, collectionId]);
    }
    
    res.json({
      rawText: text,
      extractedReference: extractedRef,
      updated: !!extractedRef
    });
    
  } catch (err) {
    console.error('Reference extraction error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Extract payment reference number from text
function extractPaymentReference(text) {
  if (!text) return null;
  
  // UPI reference patterns
  const upiPatterns = [
    /UPI[\/\s-]?(?:ref\.?|reference|ref no\.?|transaction id)[\s:]?(\d{12,20})/i,
    /UPI[\/\s-]?(\d{12,20})/,
    /(?:transaction|txn|ref)[\s#:]?(\d{12,20})/i,
    /(?:payment|paid)[\s#:]?(\d{10,20})/i
  ];
  
  for (const pattern of upiPatterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  
  // NEFT/RTGS/IMPS reference patterns
  const bankPatterns = [
    /(?:NEFT|RTGS|IMPS)[\/\s-]?(?:ref\.?|reference)?[\s:]?(\d{10,20})/i,
    /(?:UTR|Unique Transaction Reference)[\s:]?(\d{10,20})/i,
    /(?:reference|ref)[\s#:]?(?:no\.?)?[\s:]?(\d{10,20})/i
  ];
  
  for (const pattern of bankPatterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  
  // Cheque number
  const chequeMatch = text.match(/(?:cheque|chq)[\s#:]?(\d{6,10})/i);
  if (chequeMatch) return 'CHQ' + chequeMatch[1];
  
  // Generic alphanumeric transaction IDs
  const genericMatch = text.match(/(?:transaction|payment)[\s#:]([A-Z0-9]{8,20})/i);
  if (genericMatch) return genericMatch[1];
  
  return null;
}

// Auto-create ledger entry when collection is recorded
app.post('/api/collections/:id/ledger', async (req, res) => {
  try {
    const collectionId = req.params.id;
    
    // Get collection details
    const [collections] = await pool.query(
      `SELECT c.*, p.name as property_name, t.name as tenant_name, t.pan_number 
       FROM collections c
       JOIN properties p ON c.property_id=p.id
       JOIN tenants t ON c.tenant_id=t.id
       WHERE c.id=?`,
      [collectionId]
    );
    
    if (collections.length === 0) return res.status(404).json({ error: 'Collection not found' });
    
    const col = collections[0];
    const fyYear = getFinancialYear(col.payment_date);
    const quarter = getQuarter(col.payment_date);
    
    // Calculate GST and TDS (example: 18% GST, 10% TDS on rent)
    const gstRate = col.category === 'rent' ? 0.18 : 0;
    const tdsRate = col.category === 'rent' ? 0.10 : 0;
    const gstAmount = parseFloat((col.amount * gstRate).toFixed(2));
    const tdsAmount = parseFloat((col.amount * tdsRate).toFixed(2));
    const netAmount = parseFloat((col.amount - tdsAmount).toFixed(2));
    
    const [result] = await pool.query(
      `INSERT INTO ledger_entries (entry_date,entry_type,category,description,amount,gst_amount,tds_amount,
       net_amount,property_id,tenant_id,reference_id,reference_type,pan_number,fy_year,quarter)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [col.payment_date, 'income', col.category, `Rent from ${col.tenant_name} - ${col.month_year}`,
       col.amount, gstAmount, tdsAmount, netAmount, col.property_id, col.tenant_id,
       collectionId, 'collection', col.pan_number, fyYear, quarter]
    );
    
    res.json({ id: result.insertId, message: 'Ledger entry auto-created' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Helper function to convert ISO date to MySQL datetime format
function toMySQLDateTime(isoDate) {
  if (!isoDate) return null;
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return null;
    // Format: YYYY-MM-DD HH:MM:SS
    return date.toISOString().slice(0, 19).replace('T', ' ');
  } catch (e) {
    return null;
  }
}

// Helper functions
function getFinancialYear(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  if (month >= 4) return `${year}-${year+1}`;
  return `${year-1}-${year}`;
}

function getQuarter(date) {
  const month = new Date(date).getMonth() + 1;
  if (month <= 3) return 'Q4';
  if (month <= 6) return 'Q1';
  if (month <= 9) return 'Q2';
  return 'Q3';
}

// ─── DATABASE BACKUP & RESTORE ──────────────────────────────────────────────
const BACKUP_DIR = path.join(__dirname, 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Export all data as JSON
app.get('/api/backup/export', async (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.json`);
    
    const [properties] = await pool.query('SELECT * FROM properties');
    const [tenants] = await pool.query('SELECT * FROM tenants');
    const [collections] = await pool.query('SELECT * FROM collections');
    const [expenses] = await pool.query('SELECT * FROM expenses');
    const [ledger] = await pool.query('SELECT * FROM ledger_entries');
    const [tenantDocs] = await pool.query('SELECT * FROM tenant_documents');
    const [collectionDocs] = await pool.query('SELECT * FROM collection_documents');
    const [expenseDocs] = await pool.query('SELECT * FROM expense_documents');
    
    // Convert BLOB buffers to base64 strings for JSON serialization
    const serializeDocuments = (docs) => docs.map(d => ({
      ...d,
      file_content: d.file_content ? Buffer.from(d.file_content).toString('base64') : null
    }));
    
    const backupData = {
      exported_at: new Date().toISOString(),
      version: '1.0',
      tables: {
        properties,
        tenants,
        collections,
        expenses,
        ledger_entries: ledger,
        tenant_documents: serializeDocuments(tenantDocs),
        collection_documents: serializeDocuments(collectionDocs),
        expense_documents: serializeDocuments(expenseDocs)
      }
    };
    
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=rental-backup-${timestamp}.json`);
    res.send(JSON.stringify(backupData, null, 2));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Import data from JSON (clears existing data)
app.post('/api/backup/restore', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const backupData = req.body;
    if (!backupData.tables) {
      return res.status(400).json({ error: 'Invalid backup file format' });
    }
    
    // Clear existing data (in correct order for FK constraints)
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query('TRUNCATE TABLE collection_documents');
    await connection.query('TRUNCATE TABLE tenant_documents');
    await connection.query('TRUNCATE TABLE expense_documents');
    await connection.query('TRUNCATE TABLE ledger_entries');
    await connection.query('TRUNCATE TABLE collections');
    await connection.query('TRUNCATE TABLE expenses');
    await connection.query('TRUNCATE TABLE tenants');
    await connection.query('TRUNCATE TABLE properties');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    
    // Restore data
    const { properties, tenants, collections, expenses, ledger_entries, tenant_documents, collection_documents, expense_documents } = backupData.tables;
    
    if (properties?.length) {
      for (const p of properties) {
        await connection.query(
          'INSERT INTO properties (id,name,address,type,total_units,monthly_rent,status,created_at) VALUES (?,?,?,?,?,?,?,?)',
          [p.id, p.name, p.address, p.type, p.total_units, p.monthly_rent, p.status, p.created_at]
        );
      }
    }
    
    if (tenants?.length) {
      for (const t of tenants) {
        await connection.query(
          'INSERT INTO tenants (id,name,email,phone,aadhar_number,pan_number,emergency_contact,property_id,unit_number,start_date,end_date,security_deposit,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [t.id, t.name, t.email, t.phone, t.aadhar_number, t.pan_number, t.emergency_contact, t.property_id, t.unit_number, t.start_date, t.end_date, t.security_deposit, t.status, t.created_at]
        );
      }
    }
    
    if (collections?.length) {
      for (const c of collections) {
        await connection.query(
          'INSERT INTO collections (id,tenant_id,property_id,amount,payment_date,payment_method,category,month_year,status,notes,reference_number,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
          [c.id, c.tenant_id, c.property_id, c.amount, c.payment_date, c.payment_method, c.category, c.month_year, c.status, c.notes, c.reference_number, c.created_at]
        );
      }
    }
    
    if (expenses?.length) {
      for (const e of expenses) {
        await connection.query(
          'INSERT INTO expenses (id,property_id,category,description,amount,expense_date,vendor,status,receipt_number,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [e.id, e.property_id, e.category, e.description, e.amount, e.expense_date, e.vendor, e.status, e.receipt_number, e.created_at]
        );
      }
    }
    
    if (ledger_entries?.length) {
      for (const l of ledger_entries) {
        await connection.query(
          'INSERT INTO ledger_entries (id,entry_date,entry_type,category,description,amount,gst_amount,tds_amount,net_amount,reference_id,reference_type,property_id,tenant_id,vendor,pan_number,gst_number,fy_year,quarter,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [l.id, l.entry_date, l.entry_type, l.category, l.description, l.amount, l.gst_amount, l.tds_amount, l.net_amount, l.reference_id, l.reference_type, l.property_id, l.tenant_id, l.vendor, l.pan_number, l.gst_number, l.fy_year, l.quarter, l.notes, l.created_at]
        );
      }
    }
    
    if (tenant_documents?.length) {
      for (const d of tenant_documents) {
        // Convert file_content to Buffer if it's a base64 string
        let fileContent = d.file_content;
        if (fileContent && typeof fileContent === 'string') {
          fileContent = Buffer.from(fileContent, 'base64');
        }
        await connection.query(
          'INSERT INTO tenant_documents (id,tenant_id,filename,original_name,mime_type,file_size,file_content,document_type,description,uploaded_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [d.id, d.tenant_id, d.filename, d.original_name, d.mime_type, d.file_size, fileContent, d.document_type, d.description, toMySQLDateTime(d.uploaded_at)]
        );
      }
    }
    
    if (collection_documents?.length) {
      for (const d of collection_documents) {
        // Convert file_content to Buffer if it's a base64 string
        let fileContent = d.file_content;
        if (fileContent && typeof fileContent === 'string') {
          fileContent = Buffer.from(fileContent, 'base64');
        }
        await connection.query(
          'INSERT INTO collection_documents (id,collection_id,filename,original_name,mime_type,file_size,file_content,description,uploaded_at) VALUES (?,?,?,?,?,?,?,?,?)',
          [d.id, d.collection_id, d.filename, d.original_name, d.mime_type, d.file_size, fileContent, d.description, toMySQLDateTime(d.uploaded_at)]
        );
      }
    }
    
    if (expense_documents?.length) {
      for (const d of expense_documents) {
        // Convert file_content to Buffer if it's a base64 string
        let fileContent = d.file_content;
        if (fileContent && typeof fileContent === 'string') {
          fileContent = Buffer.from(fileContent, 'base64');
        }
        await connection.query(
          'INSERT INTO expense_documents (id,expense_id,filename,original_name,mime_type,file_size,file_content,description,uploaded_at) VALUES (?,?,?,?,?,?,?,?,?)',
          [d.id, d.expense_id, d.filename, d.original_name, d.mime_type, d.file_size, fileContent, d.description, toMySQLDateTime(d.uploaded_at)]
        );
      }
    }
    
    await connection.commit();
    res.json({ message: 'Database restored successfully', restored_at: new Date().toISOString() });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// List available backups
app.get('/api/backup/list', async (req, res) => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const stats = fs.statSync(path.join(BACKUP_DIR, f));
        return {
          filename: f,
          size: stats.size,
          created: stats.mtime
        };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── MIGRATION: Sync existing data to ledger ────────────────────────────────
app.post('/api/migrate/ledger', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    let collectionsSynced = 0;
    let expensesSynced = 0;
    
    // Sync existing collections
    const [collections] = await connection.query(`
      SELECT c.*, t.name as tenant_name, t.pan_number 
      FROM collections c
      LEFT JOIN tenants t ON c.tenant_id=t.id
      WHERE c.id NOT IN (SELECT reference_id FROM ledger_entries WHERE reference_type='collection')
    `);
    
    for (const col of collections) {
      const fyYear = getFinancialYear(col.payment_date);
      const quarter = getQuarter(col.payment_date);
      const gstRate = col.category === 'rent' ? 0.18 : 0;
      const tdsRate = col.category === 'rent' ? 0.10 : 0;
      const gstAmount = parseFloat((col.amount * gstRate).toFixed(2));
      const tdsAmount = parseFloat((col.amount * tdsRate).toFixed(2));
      const netAmount = parseFloat((col.amount - tdsAmount).toFixed(2));
      
      await connection.query(
        `INSERT INTO ledger_entries (entry_date,entry_type,category,description,amount,gst_amount,tds_amount,
         net_amount,property_id,tenant_id,reference_id,reference_type,pan_number,fy_year,quarter,vendor)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [col.payment_date, 'income', col.category || 'rent', `Payment from ${col.tenant_name || 'Unknown'} - ${col.month_year}`,
         col.amount, gstAmount, tdsAmount, netAmount, col.property_id, col.tenant_id,
         col.id, 'collection', col.pan_number, fyYear, quarter, col.tenant_name || 'Unknown']
      );
      collectionsSynced++;
    }
    
    // Sync existing expenses
    const [expenses] = await connection.query(`
      SELECT * FROM expenses
      WHERE id NOT IN (SELECT reference_id FROM ledger_entries WHERE reference_type='expense')
    `);
    
    for (const exp of expenses) {
      const fyYear = getFinancialYear(exp.expense_date);
      const quarter = getQuarter(exp.expense_date);
      
      await connection.query(
        `INSERT INTO ledger_entries (entry_date,entry_type,category,description,amount,gst_amount,tds_amount,
         net_amount,property_id,reference_id,reference_type,fy_year,quarter,vendor)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [exp.expense_date, 'expense', exp.category, exp.description,
         exp.amount, 0, 0, exp.amount, exp.property_id,
         exp.id, 'expense', fyYear, quarter, exp.vendor || null]
      );
      expensesSynced++;
    }
    
    await connection.commit();
    res.json({ 
      message: 'Migration completed',
      collectionsSynced,
      expensesSynced,
      totalSynced: collectionsSynced + expensesSynced
    });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// Get migration status
app.get('/api/migrate/ledger/status', async (req, res) => {
  try {
    const [collections] = await pool.query('SELECT COUNT(*) as total FROM collections');
    const [expenses] = await pool.query('SELECT COUNT(*) as total FROM expenses');
    const [ledgerCollections] = await pool.query("SELECT COUNT(*) as total FROM ledger_entries WHERE reference_type='collection'");
    const [ledgerExpenses] = await pool.query("SELECT COUNT(*) as total FROM ledger_entries WHERE reference_type='expense'");
    
    res.json({
      collections: { total: collections[0].total, synced: ledgerCollections[0].total, pending: collections[0].total - ledgerCollections[0].total },
      expenses: { total: expenses[0].total, synced: ledgerExpenses[0].total, pending: expenses[0].total - ledgerExpenses[0].total }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PREDICTIONS & FORECASTS ────────────────────────────────────────────────
app.get('/api/predictions', async (req, res) => {
  try {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Get active tenants and their properties
    const [activeTenants] = await pool.query(`
      SELECT t.*, p.monthly_rent, p.name as property_name
      FROM tenants t
      JOIN properties p ON t.property_id = p.id
      WHERE t.status = 'active'
    `);
    
    // Get last 6 months of collection data for trend analysis
    const [monthlyHistory] = await pool.query(`
      SELECT DATE_FORMAT(payment_date,'%Y-%m') as month,
             SUM(amount) as collected,
             COUNT(*) as payments
      FROM collections
      WHERE status = 'paid' 
        AND payment_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(payment_date,'%Y-%m')
      ORDER BY month DESC
    `);
    
    // Get tenant-specific collection data to identify partial month payments
    const [tenantCollections] = await pool.query(`
      SELECT c.tenant_id, c.amount, c.payment_date, c.month_year, p.monthly_rent, t.start_date
      FROM collections c
      JOIN tenants t ON c.tenant_id = t.id
      JOIN properties p ON c.property_id = p.id
      WHERE c.status = 'paid' 
        AND c.payment_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
    `);
    
    // Calculate normalized monthly income accounting for partial months
    // Group collections by month and identify partial payments
    const monthDetails = {};
    for (const col of tenantCollections) {
      const paymentDate = new Date(col.payment_date);
      const month = paymentDate.toISOString().substring(0, 7); // YYYY-MM
      if (!monthDetails[month]) {
        monthDetails[month] = { total: 0, fullMonths: 0, partialMonths: 0, expectedFull: 0 };
      }
      monthDetails[month].total += parseFloat(col.amount);
      
      // Check if this is a partial payment (less than 80% of monthly rent)
      const rent = parseFloat(col.monthly_rent || 0);
      const amount = parseFloat(col.amount);
      if (rent > 0 && amount < rent * 0.8) {
        monthDetails[month].partialMonths++;
        // Add the difference to normalize to full month
        monthDetails[month].expectedFull += rent;
      } else {
        monthDetails[month].fullMonths++;
        monthDetails[month].expectedFull += amount;
      }
    }
    
    // Calculate projected income based on normalized full-month equivalents
    let normalizedTotal = 0;
    let normalizedCount = 0;
    for (const month of Object.keys(monthDetails)) {
      const details = monthDetails[month];
      // If month had partial payments, use normalized value
      if (details.partialMonths > 0) {
        normalizedTotal += details.expectedFull;
      } else {
        normalizedTotal += details.total;
      }
      normalizedCount++;
    }
    
    const projectedMonthlyIncome = normalizedCount > 0 ? normalizedTotal / normalizedCount : 0;
    
    // Calculate potential income from active tenants (for comparison)
    const potentialMonthlyIncome = activeTenants.reduce((sum, t) => sum + parseFloat(t.monthly_rent || 0), 0);
    
    // Collection rate compares projected income to potential income from active tenants
    const collectionRate = potentialMonthlyIncome > 0 
      ? Math.min((projectedMonthlyIncome / potentialMonthlyIncome) * 100, 100)
      : 0;
    
    // Get expense history for trend
    const [expenseHistory] = await pool.query(`
      SELECT DATE_FORMAT(expense_date,'%Y-%m') as month,
             SUM(amount) as total,
             category,
             COUNT(*) as count
      FROM expenses
      WHERE expense_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(expense_date,'%Y-%m'), category
      ORDER BY month DESC
    `);
    
    // Calculate 3-month forecast
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const forecast = [];
    
    for (let i = 0; i < 3; i++) {
      const forecastMonth = (currentMonth + i) % 12;
      const forecastYear = currentYear + Math.floor((currentMonth + i) / 12);
      const monthKey = `${forecastYear}-${String(forecastMonth + 1).padStart(2, '0')}`;
      
      // Find historical data for this month (same month last year if available)
      const historicalData = monthlyHistory.find(h => h.month === monthKey);
      const historicalExpenses = expenseHistory.filter(e => e.month === monthKey);
      
      // Base prediction on historical or use current projected income
      const predictedIncome = historicalData?.collected || projectedMonthlyIncome;
      const predictedExpenses = historicalExpenses.reduce((sum, e) => sum + parseFloat(e.total), 0);
      
      // Apply collection rate confidence
      const adjustedIncome = predictedIncome * (collectionRate / 100);
      
      forecast.push({
        month: monthNames[forecastMonth],
        year: forecastYear,
        predictedIncome: Math.round(adjustedIncome),
        predictedExpenses: Math.round(predictedExpenses * 1.05), // 5% buffer
        predictedNet: Math.round(adjustedIncome - predictedExpenses * 1.05),
        confidence: collectionRate > 80 ? 'high' : collectionRate > 50 ? 'medium' : 'low'
      });
    }
    
    // Property-level predictions
    const [properties] = await pool.query(`
      SELECT p.*, COUNT(t.id) as tenant_count
      FROM properties p
      LEFT JOIN tenants t ON p.id = t.property_id AND t.status = 'active'
      GROUP BY p.id
    `);
    
    const propertyPredictions = properties.map(p => {
      const occupancyRate = p.total_units > 0 ? (p.tenant_count / p.total_units) * 100 : 0;
      const projectedIncome = parseFloat(p.monthly_rent || 0) * p.tenant_count;
      
      return {
        id: p.id,
        name: p.name,
        type: p.type,
        totalUnits: p.total_units,
        occupiedUnits: p.tenant_count,
        occupancyRate: Math.round(occupancyRate * 10) / 10,
        monthlyRent: p.monthly_rent,
        projectedMonthlyIncome: projectedIncome,
        vacancyRisk: occupancyRate < 50 ? 'high' : occupancyRate < 80 ? 'medium' : 'low'
      };
    });
    
    // Calculate year-end projections
    const monthsRemaining = 12 - currentMonth;
    const yearEndProjections = {
      projectedTotalIncome: Math.round(projectedMonthlyIncome * monthsRemaining * (collectionRate / 100)),
      projectedTotalExpenses: Math.round(
        expenseHistory.reduce((sum, e) => sum + parseFloat(e.total), 0) / (expenseHistory.length || 1) * monthsRemaining
      ),
      projectedNetIncome: 0,
      currentYearActuals: {
        income: monthlyHistory.reduce((sum, m) => sum + parseFloat(m.collected), 0),
        expenses: expenseHistory.reduce((sum, e) => sum + parseFloat(e.total), 0)
      }
    };
    yearEndProjections.projectedNetIncome = yearEndProjections.projectedTotalIncome - yearEndProjections.projectedTotalExpenses;
    yearEndProjections.projectedTotalIncome += yearEndProjections.currentYearActuals.income;
    yearEndProjections.projectedTotalExpenses += yearEndProjections.currentYearActuals.expenses;
    yearEndProjections.projectedNetIncome = yearEndProjections.projectedTotalIncome - yearEndProjections.projectedTotalExpenses;
    
    // Risk indicators
    const riskIndicators = {
      latePayments: await pool.query(`SELECT COUNT(*) as count FROM collections WHERE status IN ('pending', 'overdue') AND MONTH(payment_date) = MONTH(CURDATE())`),
      expiringLeases: await pool.query(`SELECT COUNT(*) as count FROM tenants WHERE status = 'active' AND end_date <= DATE_ADD(CURDATE(), INTERVAL 3 MONTH)`),
      highExpenseCategories: await pool.query(`
        SELECT category, SUM(amount) as total, AVG(amount) as avg
        FROM expenses
        WHERE expense_date >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
        GROUP BY category
        HAVING total > (SELECT AVG(amount) * 3 FROM expenses WHERE expense_date >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH))
      `)
    };
    
    res.json({
      summary: {
        activeTenants: activeTenants.length,
        projectedMonthlyIncome,
        averageCollectionRate: Math.round(collectionRate * 10) / 10,
        monthsOfHistory: monthlyHistory.length
      },
      forecast,
      propertyPredictions: propertyPredictions.sort((a, b) => b.projectedMonthlyIncome - a.projectedMonthlyIncome),
      yearEndProjections,
      risks: {
        latePayments: riskIndicators.latePayments[0][0].count,
        expiringLeases: riskIndicators.expiringLeases[0][0].count,
        expenseAlerts: riskIndicators.highExpenseCategories[0]
      },
      recommendations: generateRecommendations(collectionRate, riskIndicators, propertyPredictions)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function generateRecommendations(collectionRate, risks, properties) {
  const recommendations = [];
  
  if (collectionRate < 70) {
    recommendations.push({
      type: 'warning',
      priority: 'high',
      message: 'Collection rate is below 70%. Consider stricter payment enforcement or review tenant screening process.'
    });
  }
  
  if (risks.latePayments[0][0].count > 3) {
    recommendations.push({
      type: 'action',
      priority: 'high',
      message: `${risks.latePayments[0][0].count} late payments this month. Follow up immediately to maintain cash flow.`
    });
  }
  
  if (risks.expiringLeases[0][0].count > 0) {
    recommendations.push({
      type: 'info',
      priority: 'medium',
      message: `${risks.expiringLeases[0][0].count} leases expiring in next 3 months. Start renewal discussions early.`
    });
  }
  
  const lowOccupancy = properties.filter(p => p.occupancyRate < 50);
  if (lowOccupancy.length > 0) {
    recommendations.push({
      type: 'warning',
      priority: 'medium',
      message: `${lowOccupancy.length} properties have low occupancy (<50%). Review pricing strategy or marketing efforts.`
    });
  }
  
  if (recommendations.length === 0) {
    recommendations.push({
      type: 'success',
      priority: 'low',
      message: 'Portfolio is performing well. Continue current management practices.'
    });
  }
  
  return recommendations;
}

const PORT = process.env.PORT || 5000;

// ─── AUTO-RECOVERY FROM BACKUP ON STARTUP ───────────────────────────────────
async function autoRecoverFromBackup() {
  try {
    console.log('[RECOVERY] Checking for recent backups to recover from...');
    
    if (!fs.existsSync(BACKUP_DIR)) {
      console.log('[RECOVERY] No backups directory found, skipping recovery.');
      return;
    }
    
    // Get all backup files sorted by time (most recent first)
    const backupFiles = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const stats = fs.statSync(path.join(BACKUP_DIR, f));
        return { filename: f, path: path.join(BACKUP_DIR, f), mtime: stats.mtime };
      })
      .sort((a, b) => b.mtime - a.mtime);
    
    if (backupFiles.length === 0) {
      console.log('[RECOVERY] No backup files found, starting with fresh database.');
      return;
    }
    
    // Check the most recent backup
    const mostRecent = backupFiles[0];
    const backupAge = Date.now() - mostRecent.mtime.getTime();
    const backupAgeMinutes = Math.floor(backupAge / 60000);
    
    console.log(`[RECOVERY] Most recent backup: ${mostRecent.filename} (${backupAgeMinutes} minutes old)`);
    
    // Only recover if backup is less than 24 hours old (prevents very old data restoration)
    if (backupAge > 24 * 60 * 60 * 1000) {
      console.log('[RECOVERY] Backup is older than 24 hours, skipping auto-recovery.');
      return;
    }
    
    // Check if database has any data
    const [properties] = await pool.query('SELECT COUNT(*) as count FROM properties');
    const [tenants] = await pool.query('SELECT COUNT(*) as count FROM tenants');
    const hasData = properties[0].count > 0 || tenants[0].count > 0;
    
    if (hasData) {
      console.log('[RECOVERY] Database already has data, checking if sync needed...');
      // Check if backup is newer than database by comparing timestamps
      const [lastCollection] = await pool.query('SELECT MAX(created_at) as last_update FROM collections');
      const [lastExpense] = await pool.query('SELECT MAX(created_at) as last_update FROM expenses');
      
      const dbLastUpdate = lastCollection[0].last_update || lastExpense[0].last_update;
      if (dbLastUpdate && new Date(dbLastUpdate) > mostRecent.mtime) {
        console.log('[RECOVERY] Database is newer than backup, skipping recovery.');
        return;
      }
    }
    
    // Perform recovery
    console.log(`[RECOVERY] Starting recovery from: ${mostRecent.filename}`);
    const backupData = JSON.parse(fs.readFileSync(mostRecent.path, 'utf8'));
    
    if (!backupData.tables) {
      console.error('[RECOVERY] Invalid backup format, aborting.');
      return;
    }
    
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Clear existing data
      await connection.query('SET FOREIGN_KEY_CHECKS = 0');
      await connection.query('TRUNCATE TABLE collection_documents');
      await connection.query('TRUNCATE TABLE tenant_documents');
      await connection.query('TRUNCATE TABLE expense_documents');
      await connection.query('TRUNCATE TABLE ledger_entries');
      await connection.query('TRUNCATE TABLE collections');
      await connection.query('TRUNCATE TABLE expenses');
      await connection.query('TRUNCATE TABLE tenants');
      await connection.query('TRUNCATE TABLE properties');
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
      
      // Restore data with date conversion
      const { properties, tenants, collections, expenses, ledger_entries, tenant_documents, collection_documents, expense_documents } = backupData.tables;
      
      if (properties?.length) {
        for (const p of properties) {
          await connection.query(
            'INSERT INTO properties (id,name,address,type,total_units,monthly_rent,status,created_at) VALUES (?,?,?,?,?,?,?,?)',
            [p.id, p.name, p.address, p.type, p.total_units, p.monthly_rent, p.status, toMySQLDateTime(p.created_at)]
          );
        }
      }
      
      if (tenants?.length) {
        for (const t of tenants) {
          // Handle both old (lease_start/lease_end) and new (start_date/end_date) backup formats
          const startDate = t.start_date || t.lease_start;
          const endDate = t.end_date || t.lease_end;
          await connection.query(
            'INSERT INTO tenants (id,name,email,phone,aadhar_number,pan_number,emergency_contact,property_id,unit_number,start_date,end_date,security_deposit,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [t.id, t.name, t.email, t.phone, t.aadhar_number, t.pan_number, t.emergency_contact, t.property_id, t.unit_number, toMySQLDateTime(startDate), toMySQLDateTime(endDate), t.security_deposit, t.status, toMySQLDateTime(t.created_at)]
          );
        }
      }
      
      if (collections?.length) {
        for (const c of collections) {
          await connection.query(
            'INSERT INTO collections (id,tenant_id,property_id,amount,payment_date,payment_method,category,month_year,status,notes,reference_number,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
            [c.id, c.tenant_id, c.property_id, c.amount, toMySQLDateTime(c.payment_date), c.payment_method, c.category, c.month_year, c.status, c.notes, c.reference_number, toMySQLDateTime(c.created_at)]
          );
        }
      }
      
      if (expenses?.length) {
        for (const e of expenses) {
          await connection.query(
            'INSERT INTO expenses (id,property_id,category,description,amount,expense_date,vendor,status,receipt_number,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [e.id, e.property_id, e.category, e.description, e.amount, toMySQLDateTime(e.expense_date), e.vendor, e.status, e.receipt_number, toMySQLDateTime(e.created_at)]
          );
        }
      }
      
      if (ledger_entries?.length) {
        for (const l of ledger_entries) {
          await connection.query(
            'INSERT INTO ledger_entries (id,entry_date,entry_type,category,description,amount,gst_amount,tds_amount,net_amount,reference_id,reference_type,property_id,tenant_id,vendor,pan_number,gst_number,fy_year,quarter,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [l.id, toMySQLDateTime(l.entry_date), l.entry_type, l.category, l.description, l.amount, l.gst_amount, l.tds_amount, l.net_amount, l.reference_id, l.reference_type, l.property_id, l.tenant_id, l.vendor, l.pan_number, l.gst_number, l.fy_year, l.quarter, l.notes, toMySQLDateTime(l.created_at)]
          );
        }
      }
      
      if (tenant_documents?.length) {
        for (const d of tenant_documents) {
          // Convert file_content to Buffer if it's a base64 string from JSON backup
          let fileContent = d.file_content;
          if (fileContent && typeof fileContent === 'string') {
            fileContent = Buffer.from(fileContent, 'base64');
          }
          await connection.query(
            'INSERT INTO tenant_documents (id,tenant_id,filename,original_name,mime_type,file_size,file_content,document_type,description,uploaded_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [d.id, d.tenant_id, d.filename, d.original_name, d.mime_type, d.file_size, fileContent, d.document_type, d.description, toMySQLDateTime(d.uploaded_at)]
          );
        }
      }
      
      if (collection_documents?.length) {
        for (const d of collection_documents) {
          // Convert file_content to Buffer if it's a base64 string from JSON backup
          let fileContent = d.file_content;
          if (fileContent && typeof fileContent === 'string') {
            fileContent = Buffer.from(fileContent, 'base64');
          }
          await connection.query(
            'INSERT INTO collection_documents (id,collection_id,filename,original_name,mime_type,file_size,file_content,description,uploaded_at) VALUES (?,?,?,?,?,?,?,?,?)',
            [d.id, d.collection_id, d.filename, d.original_name, d.mime_type, d.file_size, fileContent, d.description, toMySQLDateTime(d.uploaded_at)]
          );
        }
      }
      
      if (expense_documents?.length) {
        for (const d of expense_documents) {
          // Convert file_content to Buffer if it's a base64 string from JSON backup
          let fileContent = d.file_content;
          if (fileContent && typeof fileContent === 'string') {
            fileContent = Buffer.from(fileContent, 'base64');
          }
          await connection.query(
            'INSERT INTO expense_documents (id,expense_id,filename,original_name,mime_type,file_size,file_content,description,uploaded_at) VALUES (?,?,?,?,?,?,?,?,?)',
            [d.id, d.expense_id, d.filename, d.original_name, d.mime_type, d.file_size, fileContent, d.description, toMySQLDateTime(d.uploaded_at)]
          );
        }
      }
      
      await connection.commit();
      console.log(`[RECOVERY] Successfully recovered data from: ${mostRecent.filename}`);
      console.log(`[RECOVERY] Recovered: ${properties?.length || 0} properties, ${tenants?.length || 0} tenants, ${collections?.length || 0} collections, ${expenses?.length || 0} expenses`);
      
    } catch (err) {
      await connection.rollback();
      console.error('[RECOVERY] Recovery failed:', err.message);
    } finally {
      connection.release();
    }
    
  } catch (err) {
    console.error('[RECOVERY] Error during auto-recovery:', err.message);
  }
}

// Start server after attempting recovery
async function startServer() {
  // Wait for database to be ready
  let retries = 30;
  while (retries > 0) {
    try {
      await pool.query('SELECT 1');
      console.log('[STARTUP] Database connected successfully.');
      break;
    } catch (err) {
      console.log(`[STARTUP] Waiting for database... (${retries} retries left)`);
      retries--;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  
  if (retries === 0) {
    console.error('[STARTUP] Database connection failed after 30 retries. Exiting.');
    process.exit(1);
  }
  
  // Run database migrations
  await runMigrations();
  
  // Attempt auto-recovery
  await autoRecoverFromBackup();
  
  // Start the server - bind to 0.0.0.0 to accept external connections
  const server = app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
  
  // Store server reference for shutdown handlers
  global.server = server;
  
  // Schedule daily backup housekeeping (runs every 24 hours)
  setInterval(() => {
    console.log('[BACKUP] Running scheduled daily backup housekeeping...');
    cleanupOldBackups();
  }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds
  
  // Run initial cleanup on startup
  console.log('[BACKUP] Running initial backup housekeeping...');
  await cleanupOldBackups();
}

// ─── DATABASE MIGRATIONS ────────────────────────────────────────────────────
async function runMigrations() {
  try {
    console.log('[MIGRATION] Checking for pending migrations...');
    
    // Check if tenants table has lease_start column (old schema)
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'tenants' AND COLUMN_NAME IN ('lease_start', 'lease_end')
    `);
    
    const hasLeaseStart = columns.some(c => c.COLUMN_NAME === 'lease_start');
    const hasLeaseEnd = columns.some(c => c.COLUMN_NAME === 'lease_end');
    
    if (hasLeaseStart || hasLeaseEnd) {
      console.log('[MIGRATION] Found old lease column names, running migration 002...');
      
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        
        // Rename columns
        if (hasLeaseStart) {
          await connection.query(`ALTER TABLE tenants CHANGE COLUMN lease_start start_date DATE`);
          console.log('[MIGRATION] Renamed lease_start to start_date');
        }
        if (hasLeaseEnd) {
          await connection.query(`ALTER TABLE tenants CHANGE COLUMN lease_end end_date DATE`);
          console.log('[MIGRATION] Renamed lease_end to end_date');
        }
        
        await connection.commit();
        console.log('[MIGRATION] Migration 002 completed successfully');
      } catch (err) {
        await connection.rollback();
        console.error('[MIGRATION] Migration failed:', err.message);
      } finally {
        connection.release();
      }
    } else {
      console.log('[MIGRATION] No pending migrations');
    }
  } catch (err) {
    console.error('[MIGRATION] Error checking migrations:', err.message);
  }
}

startServer();

// ─── AUTOMATIC BACKUP ON SHUTDOWN ───────────────────────────────────────────
async function createAutoBackup(reason) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `auto-backup-${reason}-${timestamp}.json`);
    
    console.log(`[BACKUP] Creating automatic backup before ${reason}...`);
    
    const [properties] = await pool.query('SELECT * FROM properties');
    const [tenants] = await pool.query('SELECT * FROM tenants');
    const [collections] = await pool.query('SELECT * FROM collections');
    const [expenses] = await pool.query('SELECT * FROM expenses');
    const [ledger] = await pool.query('SELECT * FROM ledger_entries');
    const [tenantDocs] = await pool.query('SELECT * FROM tenant_documents');
    const [collectionDocs] = await pool.query('SELECT * FROM collection_documents');
    const [expenseDocs] = await pool.query('SELECT * FROM expense_documents');
    
    // Convert BLOB buffers to base64 strings for JSON serialization
    const serializeDocuments = (docs) => docs.map(d => ({
      ...d,
      file_content: d.file_content ? Buffer.from(d.file_content).toString('base64') : null
    }));
    
    const backupData = {
      exported_at: new Date().toISOString(),
      version: '1.0',
      reason: reason,
      tables: {
        properties,
        tenants,
        collections,
        expenses,
        ledger_entries: ledger,
        tenant_documents: serializeDocuments(tenantDocs),
        collection_documents: serializeDocuments(collectionDocs),
        expense_documents: serializeDocuments(expenseDocs)
      }
    };
    
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    console.log(`[BACKUP] Automatic backup saved: ${backupFile}`);
    
    // Cleanup old backups - keep only last 3
    await cleanupOldBackups();
    
    return backupFile;
  } catch (err) {
    console.error('[BACKUP] Failed to create automatic backup:', err.message);
    return null;
  }
}

// ─── BACKUP HOUSEKEEPING - Keep only last 3 backups ─────────────────────────
async function cleanupOldBackups() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return;
    
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.json') && f.startsWith('auto-backup-'))
      .map(f => {
        const stats = fs.statSync(path.join(BACKUP_DIR, f));
        return { filename: f, path: path.join(BACKUP_DIR, f), mtime: stats.mtime };
      })
      .sort((a, b) => b.mtime - a.mtime); // Sort by time, newest first
    
    // Keep only last 3 backups
    const filesToDelete = files.slice(3);
    
    if (filesToDelete.length > 0) {
      console.log(`[BACKUP] Housekeeping: Removing ${filesToDelete.length} old backup(s), keeping last 3`);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
        console.log(`[BACKUP] Deleted old backup: ${file.filename}`);
      }
    }
  } catch (err) {
    console.error('[BACKUP] Failed to cleanup old backups:', err.message);
  }
}

// Graceful shutdown handlers
async function gracefulShutdown(signal) {
  console.log(`\n[SHUTDOWN] Received ${signal}. Starting graceful shutdown...`);
  
  // Create backup before shutdown
  await createAutoBackup(signal);
  
  // Close server
  if (global.server) {
    global.server.close(() => {
      console.log('[SHUTDOWN] Server closed.');
      
      // Close database pool
      pool.end(() => {
        console.log('[SHUTDOWN] Database pool closed.');
        process.exit(0);
      });
    });
  } else {
    pool.end(() => {
      console.log('[SHUTDOWN] Database pool closed.');
      process.exit(0);
    });
  }
}

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions and crashes
process.on('uncaughtException', async (err) => {
  console.error('[CRASH] Uncaught Exception:', err);
  await createAutoBackup('crash-uncaught-exception');
  
  // Give backup time to complete then exit
  setTimeout(() => {
    process.exit(1);
  }, 2000);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('[CRASH] Unhandled Rejection at:', promise, 'reason:', reason);
  await createAutoBackup('crash-unhandled-rejection');
  
  setTimeout(() => {
    process.exit(1);
  }, 2000);
});

// Before exit backup (fallback)
process.on('beforeExit', async () => {
  await createAutoBackup('before-exit');
});

console.log('[BACKUP] Automatic backup handlers registered for shutdown/crash events');
