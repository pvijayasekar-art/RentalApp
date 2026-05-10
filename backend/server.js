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
      'INSERT INTO properties (name,address,type,total_units,monthly_rent,status,eb_service_number,property_assessment_number,water_connection_number,patta_number) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [name, address, type, total_units, monthly_rent, status || 'active', req.body.eb_service_number || null, req.body.property_assessment_number || null, req.body.water_connection_number || null, req.body.patta_number || null]
    );
    res.json({ id: result.insertId, message: 'Property added successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/properties/:id', async (req, res) => {
  const { name, address, type, total_units, monthly_rent, status } = req.body;
  try {
    await pool.query(
      'UPDATE properties SET name=?,address=?,type=?,total_units=?,monthly_rent=?,status=?,eb_service_number=?,property_assessment_number=?,water_connection_number=?,patta_number=? WHERE id=?',
      [name, address, type, total_units, monthly_rent, status, req.body.eb_service_number || null, req.body.property_assessment_number || null, req.body.water_connection_number || null, req.body.patta_number || null, req.params.id]
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

// ─── PROFIT & LOSS REPORT ─────────────────────────────────────────────────────
app.get('/api/reports/profit-loss', async (req, res) => {
  try {
    const { startDate, endDate, propertyId, format = 'json', period = 'monthly' } = req.query;
    
    // Build date filter
    let dateFilter = '';
    let params = [];
    
    if (startDate && endDate) {
      dateFilter = 'WHERE payment_date BETWEEN ? AND ?';
      params = [startDate, endDate];
    } else if (startDate) {
      dateFilter = 'WHERE payment_date >= ?';
      params = [startDate];
    } else if (endDate) {
      dateFilter = 'WHERE payment_date <= ?';
      params = [endDate];
    }
    
    // Build property filter
    let propertyFilter = '';
    if (propertyId && propertyId !== 'all') {
      if (propertyId === 'vilankurichi-all') {
        propertyFilter = 'AND p.name LIKE "%Vilankurichi%"';
      } else {
        propertyFilter = 'AND c.property_id = ?';
        params.push(propertyId);
      }
    }
    
    // Get income data
    let incomeQuery = `
      SELECT 
        c.category,
        SUM(c.amount) as total,
        COUNT(*) as count,
        DATE_FORMAT(MIN(c.payment_date), '%Y-%m-%d') as earliest_date,
        DATE_FORMAT(MAX(c.payment_date), '%Y-%m-%d') as latest_date
      FROM collections c
    `;
    
    let incomeParams = [];
    
    // Add property join if needed
    if (propertyId === 'vilankurichi-all') {
      incomeQuery += 'LEFT JOIN properties p ON c.property_id = p.id AND p.name LIKE "%Vilankurichi%" ';
    } else if (propertyId) {
      incomeQuery += 'INNER JOIN properties p ON c.property_id = p.id ';
    }
    
    // Add date filter
    if (dateFilter) {
      incomeQuery += dateFilter.replace('payment_date', 'c.payment_date') + ' ';
    } else {
      incomeQuery += 'WHERE 1=1 ';
    }
    
    incomeQuery += 'AND c.status=\'paid\' ';
    
    // Add property filter
    if (propertyId === 'vilankurichi-all') {
      incomeQuery += 'AND p.name LIKE "%Vilankurichi%" ';
    } else if (propertyId) {
      incomeQuery += 'AND c.property_id = ? ';
      incomeParams.push(propertyId);
    }
    
    incomeQuery += 'GROUP BY c.category ORDER BY total DESC';
    
    const [incomeData] = await pool.query(incomeQuery, [...params, ...incomeParams]);
    
    // Get expense data
    let expenseQuery = `
      SELECT 
        e.category,
        SUM(e.amount) as total,
        COUNT(*) as count,
        DATE_FORMAT(MIN(e.expense_date), '%Y-%m-%d') as earliest_date,
        DATE_FORMAT(MAX(e.expense_date), '%Y-%m-%d') as latest_date
      FROM expenses e
    `;
    
    let expenseParams = [];
    
    // Add property join if needed
    if (propertyId === 'vilankurichi-all') {
      expenseQuery += 'LEFT JOIN properties p ON e.property_id = p.id AND p.name LIKE "%Vilankurichi%" ';
    } else if (propertyId) {
      expenseQuery += 'INNER JOIN properties p ON e.property_id = p.id ';
    }
    
    // Add date filter
    if (dateFilter) {
      expenseQuery += dateFilter.replace('payment_date', 'e.expense_date') + ' ';
    } else {
      expenseQuery += 'WHERE 1=1 ';
    }
    
    expenseQuery += 'AND e.status=\'paid\' ';
    
    // Add property filter
    if (propertyId === 'vilankurichi-all') {
      expenseQuery += 'AND p.name LIKE "%Vilankurichi%" ';
    } else if (propertyId) {
      expenseQuery += 'AND e.property_id = ? ';
      expenseParams.push(propertyId);
    }
    
    expenseQuery += 'GROUP BY e.category ORDER BY total DESC';
    
    const [expenseData] = await pool.query(expenseQuery, [...params, ...expenseParams]);
    
    // Calculate totals
    const totalIncome = incomeData.reduce((sum, item) => sum + parseFloat(item.total), 0);
    const totalExpenses = expenseData.reduce((sum, item) => sum + parseFloat(item.total), 0);
    const netProfit = totalIncome - totalExpenses;
    const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(2) : 0;
    
    // Get pending payments data
    let pendingPaymentsQuery = `
      SELECT 
        SUM(CASE WHEN c.status='pending' THEN c.amount ELSE 0 END) as total_pending,
        COUNT(CASE WHEN c.status='pending' THEN 1 ELSE NULL END) as pending_count
      FROM collections c
    `;
    
    let pendingPaymentsParams = [];
    
    // Add property join if needed
    if (propertyId === 'vilankurichi-all') {
      pendingPaymentsQuery += 'LEFT JOIN properties p ON c.property_id = p.id AND p.name LIKE "%Vilankurichi%" ';
    } else if (propertyId) {
      pendingPaymentsQuery += 'INNER JOIN properties p ON c.property_id = p.id ';
    }
    
    // Add date filter
    if (dateFilter) {
      pendingPaymentsQuery += dateFilter.replace('payment_date', 'c.payment_date') + ' ';
    } else {
      pendingPaymentsQuery += 'WHERE 1=1 ';
    }
    
    pendingPaymentsQuery += 'GROUP BY c.property_id';
    
    const [pendingPaymentsData] = await pool.query(pendingPaymentsQuery, [...params, ...pendingPaymentsParams]);
    
    // Get monthly trends
    let trendsQuery = `
      SELECT 
        DATE_FORMAT(c.payment_date, '%b %Y') as month,
        SUM(CASE WHEN c.status='paid' THEN c.amount ELSE 0 END) as income,
        0 as expenses
      FROM collections c
    `;
    
    let trendsParams = [];
    
    // Add property join if needed
    if (propertyId === 'vilankurichi-all') {
      trendsQuery += 'LEFT JOIN properties p ON c.property_id = p.id AND p.name LIKE "%Vilankurichi%" ';
    }
    
    // Add date filter
    if (dateFilter) {
      trendsQuery += dateFilter.replace('payment_date', 'c.payment_date') + ' ';
    } else {
      trendsQuery += 'WHERE 1=1 ';
    }
    
    trendsQuery += 'AND c.status=\'paid\' ';
    
    // Add property filter
    if (propertyId === 'vilankurichi-all') {
      trendsQuery += 'AND p.name LIKE "%Vilankurichi%" ';
    }
    
    trendsQuery += 'GROUP BY YEAR(c.payment_date), MONTH(c.payment_date), DATE_FORMAT(c.payment_date, \'%b %Y\') ';
    
    trendsQuery += `
      UNION ALL
      
      SELECT 
        DATE_FORMAT(e.expense_date, '%b %Y') as month,
        0 as income,
        SUM(e.amount) as expenses
      FROM expenses e
    `;
    
    // Add property join if needed
    if (propertyId === 'vilankurichi-all') {
      trendsQuery += 'LEFT JOIN properties p ON e.property_id = p.id AND p.name LIKE "%Vilankurichi%" ';
    }
    
    // Add date filter for expenses
    if (dateFilter) {
      trendsQuery += dateFilter.replace('payment_date', 'e.expense_date') + ' ';
    } else {
      trendsQuery += 'WHERE 1=1 ';
    }
    
    trendsQuery += 'AND e.status=\'paid\' ';
    
    // Add property filter for expenses
    if (propertyId === 'vilankurichi-all') {
      trendsQuery += 'AND p.name LIKE "%Vilankurichi%" ';
    }
    
    trendsQuery += 'GROUP BY YEAR(e.expense_date), MONTH(e.expense_date), DATE_FORMAT(e.expense_date, \'%b %Y\') ORDER BY month';
    
    const [monthlyTrends] = await pool.query(trendsQuery, [...params, ...trendsParams]);
    
    // Generate report data
    const totalPending = pendingPaymentsData.length > 0 ? parseFloat(pendingPaymentsData[0].total_pending) : 0;
    const pendingCount = pendingPaymentsData.length > 0 ? parseInt(pendingPaymentsData[0].pending_count) : 0;
    
    // Get properties for occupancy calculation
    const [properties] = await pool.query('SELECT id FROM properties');
    const totalUnits = properties.length || 0;
    
    // Get active tenants to calculate occupied units
    const [tenantsData] = await pool.query('SELECT property_id FROM tenants WHERE status = "active"');
    const occupiedProperties = new Set(tenantsData.map(t => t.property_id));
    const occupiedUnits = occupiedProperties.size || 0;
    const vacantUnits = totalUnits - occupiedUnits;
    const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits * 100).toFixed(2) : 0;
    
    const reportData = {
      generated_at: new Date().toISOString(),
      period: {
        start_date: startDate || null,
        end_date: endDate || null,
        type: period
      },
      property_filter: propertyId || 'all',
      summary: {
        total_income: totalIncome,
        total_expenses: totalExpenses,
        net_profit: netProfit,
        profit_margin: parseFloat(profitMargin),
        total_pending: totalPending,
        pending_count: pendingCount,
        // Occupancy data
        total_units: totalUnits,
        occupied_units: occupiedUnits,
        vacant_units: vacantUnits,
        occupancy_rate: parseFloat(occupancyRate)
      },
      income_breakdown: incomeData,
      expense_breakdown: expenseData,
      monthly_trends: monthlyTrends,
      pending_payments: pendingPaymentsData
    };
    
    // Handle different export formats
    if (format === 'pdf') {
      // For PDF export, you would need a PDF library like puppeteer or jsPDF
      res.setHeader('Content-Type', 'application/json');
      res.json({ 
        message: 'PDF export not yet implemented',
        data: reportData 
      });
    } else if (format === 'excel') {
      // For Excel export, you would need a library like exceljs
      res.setHeader('Content-Type', 'application/json');
      res.json({ 
        message: 'Excel export not yet implemented',
        data: reportData 
      });
    } else {
      // JSON format (default)
      res.json(reportData);
    }
    
  } catch (err) {
    console.error('[P&L REPORT] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
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
          property_id, unit_number, start_date, end_date, security_deposit, monthly_rent, status,
          tds_applicable, tds_rate, tds_section } = req.body;
  
  // Auto-calculate TDS applicability if monthly rent > 50000
  const autoTdsApplicable = monthly_rent > 50000;
  const finalTdsApplicable = tds_applicable !== undefined ? tds_applicable : autoTdsApplicable;
  const finalTdsRate = tds_rate || (finalTdsApplicable ? 5.00 : 0);
  const finalTdsSection = tds_section || '194-IB';
  
  try {
    const [result] = await pool.query(
      `INSERT INTO tenants (name,email,phone,aadhar_number,pan_number,emergency_contact,
       property_id,unit_number,start_date,end_date,security_deposit,monthly_rent,status,
       tds_applicable,tds_rate,tds_section) 
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [name, email, phone, aadhar_number, pan_number, emergency_contact,
       property_id, unit_number, start_date, end_date, security_deposit || 0, monthly_rent || 0, status || 'active',
       finalTdsApplicable, finalTdsRate, finalTdsSection]
    );
    res.json({ id: result.insertId, message: 'Tenant added successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/tenants/:id', async (req, res) => {
  const { name, email, phone, aadhar_number, pan_number, emergency_contact,
          property_id, unit_number, start_date, end_date, security_deposit, monthly_rent, status,
          tds_applicable, tds_rate, tds_section } = req.body;
  
  // Auto-calculate TDS applicability if monthly rent > 50000
  const autoTdsApplicable = monthly_rent > 50000;
  const finalTdsApplicable = tds_applicable !== undefined ? tds_applicable : autoTdsApplicable;
  const finalTdsRate = tds_rate || (finalTdsApplicable ? 5.00 : 0);
  const finalTdsSection = tds_section || '194-IB';
  
  try {
    await pool.query(
      `UPDATE tenants SET name=?,email=?,phone=?,aadhar_number=?,pan_number=?,
       emergency_contact=?,property_id=?,unit_number=?,start_date=?,
       end_date=?,security_deposit=?,monthly_rent=?,status=?,
       tds_applicable=?,tds_rate=?,tds_section=? WHERE id=?`,
      [name, email, phone, aadhar_number, pan_number, emergency_contact,
       property_id, unit_number, start_date, end_date, security_deposit, monthly_rent, status,
       finalTdsApplicable, finalTdsRate, finalTdsSection, req.params.id]
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

// ─── TDS (Section 194-IB) ───────────────────────────────────────────────────
// Get TDS deposits for a tenant
app.get('/api/tenants/:id/tds', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT td.*, t.name as tenant_name, p.name as property_name
       FROM tds_deposits td
       JOIN tenants t ON td.tenant_id = t.id
       LEFT JOIN properties p ON td.property_id = p.id
       WHERE td.tenant_id = ?
       ORDER BY td.month_year DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Add TDS deposit record
app.post('/api/tenants/:id/tds', async (req, res) => {
  const { month_year, rent_amount, tds_amount, tds_rate, deposit_date, challan_number, notes } = req.body;
  try {
    // Get tenant info for property_id
    const [tenant] = await pool.query('SELECT property_id FROM tenants WHERE id = ?', [req.params.id]);
    const property_id = tenant[0]?.property_id || null;
    
    const [result] = await pool.query(
      `INSERT INTO tds_deposits (tenant_id, property_id, month_year, rent_amount, tds_amount, tds_rate, status, deposit_date, challan_number, notes)
       VALUES (?, ?, ?, ?, ?, ?, 'deposited', ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       rent_amount = VALUES(rent_amount),
       tds_amount = VALUES(tds_amount),
       tds_rate = VALUES(tds_rate),
       status = 'deposited',
       deposit_date = VALUES(deposit_date),
       challan_number = VALUES(challan_number),
       notes = VALUES(notes)`,
      [req.params.id, property_id, month_year, rent_amount, tds_amount, tds_rate || 5.00, deposit_date, challan_number, notes]
    );
    res.json({ id: result.insertId || result.affectedRows, message: 'TDS deposit recorded' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get all TDS summary report
app.get('/api/tds-report', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        t.id as tenant_id,
        t.name as tenant_name,
        t.monthly_rent,
        t.tds_applicable,
        t.tds_rate,
        p.name as property_name,
        COUNT(td.id) as deposits_count,
        SUM(CASE WHEN td.status = 'pending' THEN td.tds_amount ELSE 0 END) as pending_tds,
        SUM(CASE WHEN td.status = 'deposited' THEN td.tds_amount ELSE 0 END) as deposited_tds
      FROM tenants t
      LEFT JOIN properties p ON t.property_id = p.id
      LEFT JOIN tds_deposits td ON t.id = td.tenant_id
      WHERE t.tds_applicable = TRUE
      GROUP BY t.id
      ORDER BY t.name
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── COLLECTIONS ────────────────────────────────────────────────────────────
app.get('/api/collections', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.*, t.name as tenant_name, p.name as property_name,
             COALESCE(c.receipt_id, r.id) as receipt_id,
             r.receipt_number,
             r.status as receipt_status
      FROM collections c 
      JOIN tenants t ON c.tenant_id=t.id 
      JOIN properties p ON c.property_id=p.id 
      LEFT JOIN receipts r ON r.collection_id = c.id 
                         OR (r.tenant_id = c.tenant_id AND r.month_year = c.month_year AND r.collection_id IS NULL)
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
    
    // Auto-generate receipt if collection is marked as paid
    let autoReceipt = null;
    const collectionStatus = status || 'paid';
    if (collectionStatus === 'paid' && (category || 'rent') === 'rent') {
      autoReceipt = await autoGenerateReceipt(connection, {
        id: collectionId, tenant_id, property_id, amount,
        month_year, payment_method, payment_date, reference_number,
        category: category || 'rent'
      });
    }
    
    await connection.commit();
    
    res.json({ 
      id: collectionId, 
      message: autoReceipt 
        ? 'Collection recorded, ledger entry created, and receipt generated' 
        : 'Collection recorded and ledger entry created',
      receipt: autoReceipt
    });
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
    
    // Check if collection status changed to paid and no receipt exists
    let autoReceipt = null;
    if (status === 'paid' && category === 'rent') {
      // Check if receipt already exists for this collection
      const [[collection]] = await connection.query(
        'SELECT receipt_id FROM collections WHERE id = ?',
        [req.params.id]
      );
      
      if (!collection || !collection.receipt_id) {
        autoReceipt = await autoGenerateReceipt(connection, {
          id: parseInt(req.params.id), tenant_id, property_id, amount,
          month_year, payment_method, payment_date, reference_number,
          category, receipt_id: null
        });
      }
    }
    
    await connection.commit();
    res.json({ 
      message: autoReceipt 
        ? 'Collection updated, ledger entry updated, and receipt generated' 
        : 'Collection and ledger entry updated successfully',
      receipt: autoReceipt
    });
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
      SELECT l.*, p.name as property_name, t.name as tenant_name,
             COALESCE(c.status, e.status, 'paid') as status
      FROM ledger_entries l
      LEFT JOIN properties p ON l.property_id=p.id
      LEFT JOIN tenants t ON l.tenant_id=t.id
      LEFT JOIN collections c ON l.reference_id=c.id AND l.reference_type='collection'
      LEFT JOIN expenses e ON l.reference_id=e.id AND l.reference_type='expense'
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

// ─── INCOME TAX CALCULATION ─────────────────────────────────────────────────
// Calculate income tax under new regime for financial year
app.get('/api/tax/calculate-financial-year/:financialYear', async (req, res) => {
  try {
    const { financialYear } = req.params;
    const { municipalTaxes = 0, deductions80C = 0 } = req.query;
    
    console.log(`[TAX-CALC] Calculating tax for financial year: ${financialYear}`);
    
    // Get Gross Annual Value from rent collections for the financial year (exclude deposits)
    const [collectionsData] = await pool.query(
      `SELECT 
        COALESCE(SUM(amount), 0) as gross_annual_value,
        COUNT(*) as collection_count
       FROM collections 
       WHERE payment_date >= ? 
         AND payment_date <= ?
         AND status = 'paid' 
         AND category = 'rent'`,
      [`${financialYear.split('-')[0]}-04-01`, `${parseInt(financialYear.split('-')[0]) + 1}-03-31`]
    );
    
    console.log(`[TAX-CALC] Collections query result:`, collectionsData[0]);
    
    // Get property taxes from expenses for the financial year
    const [expensesData] = await pool.query(
      `SELECT 
        COALESCE(SUM(amount), 0) as property_taxes,
        COUNT(*) as expense_count
       FROM expenses 
       WHERE expense_date >= ? 
         AND expense_date <= ? 
         AND category = 'taxes'`,
      [`${financialYear.split('-')[0]}-04-01`, `${parseInt(financialYear.split('-')[0]) + 1}-03-31`]
    );
    
    console.log(`[TAX-CALC] Expenses query result:`, expensesData[0]);
    
    const grossAnnualValue = parseFloat(collectionsData[0]?.gross_annual_value || 0);
    const propertyTaxPaid = parseFloat(expensesData[0]?.property_taxes || 0);
    const deduction80C = parseFloat(deductions80C) || 0;
    
    // Standard deduction for new regime
    const standardDeduction = 50000;
    
    // Calculate taxable income
    const netRentalIncome = grossAnnualValue - propertyTaxPaid;
    const taxableIncome = Math.max(0, netRentalIncome - standardDeduction);
    
    console.log(`[TAX-CALC] Final - GAV: ${grossAnnualValue}, Property Tax: ${propertyTaxPaid}, Net: ${netRentalIncome}, Taxable: ${taxableIncome}`);
    
    // New Tax Regime slabs for FY 2026-27 (AY 2027-28)
    let tax = 0;
    let slabDetails = [];
    const remainingIncome = taxableIncome;
    
    if (remainingIncome <= 300000) {
      slabDetails.push({ slab: "0 - 3,00,000", rate: "0%", amount: remainingIncome, tax: 0 });
    } else {
      slabDetails.push({ slab: "0 - 3,00,000", rate: "0%", amount: 300000, tax: 0 });
    }
    
    if (remainingIncome > 300000) {
      const slab2Amount = Math.min(300000, remainingIncome - 300000);
      const slab2Tax = slab2Amount * 0.05;
      tax += slab2Tax;
      slabDetails.push({ slab: "3,00,001 - 6,00,000", rate: "5%", amount: slab2Amount, tax: slab2Tax });
    }
    
    if (remainingIncome > 600000) {
      const slab3Amount = Math.min(300000, remainingIncome - 600000);
      const slab3Tax = slab3Amount * 0.10;
      tax += slab3Tax;
      slabDetails.push({ slab: "6,00,001 - 9,00,000", rate: "10%", amount: slab3Amount, tax: slab3Tax });
    }
    
    if (remainingIncome > 900000) {
      const slab4Amount = Math.min(300000, remainingIncome - 900000);
      const slab4Tax = slab4Amount * 0.15;
      tax += slab4Tax;
      slabDetails.push({ slab: "9,00,001 - 12,00,000", rate: "15%", amount: slab4Amount, tax: slab4Tax });
    }
    
    if (remainingIncome > 1200000) {
      const slab5Amount = Math.min(300000, remainingIncome - 1200000);
      const slab5Tax = slab5Amount * 0.20;
      tax += slab5Tax;
      slabDetails.push({ slab: "12,00,001 - 15,00,000", rate: "20%", amount: slab5Amount, tax: slab5Tax });
    }
    
    if (remainingIncome > 1500000) {
      const slab6Amount = remainingIncome - 1500000;
      const slab6Tax = slab6Amount * 0.30;
      tax += slab6Tax;
      slabDetails.push({ slab: "Above 15,00,000", rate: "30%", amount: slab6Amount, tax: slab6Tax });
    }
    
    // Health and Education Cess @ 4%
    const cess = tax * 0.04;
    const totalTaxLiability = tax + cess;
    
    // Total tax payable
    const taxPayable = totalTaxLiability;
    
    // Calculate assessment year from financial year
    const assessmentYear = `${parseInt(financialYear.split('-')[0]) + 1}-${(parseInt(financialYear.split('-')[0]) + 2).toString().slice(-2)}`;
    
    res.json({
      financial_year: financialYear,
      assessment_year: assessmentYear,
      tax_regime: "New Regime",
      income_details: {
        gross_annual_value: grossAnnualValue,
        property_tax_paid: propertyTaxPaid,
        net_rental_income: netRentalIncome,
        standard_deduction: standardDeduction,
        deductions_80c: deduction80C,
        taxable_income: taxableIncome
      },
      tax_calculation: {
        slab_details: slabDetails,
        base_tax: tax,
        health_education_cess_4_percent: cess,
        total_tax_liability: totalTaxLiability,
        tax_payable: taxPayable
      },
      itr_form: "ITR-2",
      due_date: `July 31, ${parseInt(financialYear.split('-')[0]) + 1}`
    });
  } catch (err) {
    console.error('Tax calculation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Calculate income tax under new regime for calendar year
app.get('/api/tax/calculate-calendar-year/:calendarYear', async (req, res) => {
  try {
    const { calendarYear } = req.params;
    const { deductions80C = 0 } = req.query;
    
    const year = parseInt(calendarYear);
    
    console.log(`[TAX-CALC] Calculating tax for calendar year: ${year}`);
    
    // Get Gross Annual Value from rent collections for the calendar year (exclude deposits)
    const [collectionsData] = await pool.query(
      `SELECT 
        COALESCE(SUM(amount), 0) as gross_annual_value,
        COUNT(*) as collection_count
       FROM collections 
       WHERE YEAR(payment_date) = ? 
         AND status = 'paid' 
         AND category = 'rent'`,
      [year]
    );
    
    console.log(`[TAX-CALC] Collections query result:`, collectionsData[0]);
    
    // Get property taxes from expenses for the calendar year
    const [expensesData] = await pool.query(
      `SELECT 
        COALESCE(SUM(amount), 0) as property_taxes,
        COUNT(*) as expense_count
       FROM expenses 
       WHERE YEAR(expense_date) = ? AND category = 'taxes'`,
      [year]
    );
    
    console.log(`[TAX-CALC] Expenses query result:`, expensesData[0]);
    
    const grossAnnualValue = parseFloat(collectionsData[0]?.gross_annual_value || 0);
    const propertyTaxPaid = parseFloat(expensesData[0]?.property_taxes || 0);
    const deduction80C = parseFloat(deductions80C) || 0;
    
    // Standard deduction for FY 2026-27 under new regime
    const standardDeduction = 50000;
    
    // Calculate taxable income
    const netRentalIncome = grossAnnualValue - propertyTaxPaid;
    const taxableIncome = Math.max(0, netRentalIncome - standardDeduction);
    
    console.log(`[TAX-CALC] GAV: ${grossAnnualValue}, Property Tax: ${propertyTaxPaid}, Net: ${netRentalIncome}, Taxable: ${taxableIncome}`);
    
    // New Tax Regime slabs for FY 2026-27 (AY 2027-28)
    let tax = 0;
    let slabDetails = [];
    const remainingIncome = taxableIncome;
    
    if (remainingIncome <= 300000) {
      slabDetails.push({ slab: "0 - 3,00,000", rate: "0%", amount: remainingIncome, tax: 0 });
    } else {
      slabDetails.push({ slab: "0 - 3,00,000", rate: "0%", amount: 300000, tax: 0 });
    }
    
    if (remainingIncome > 300000) {
      const slab2Amount = Math.min(300000, remainingIncome - 300000);
      const slab2Tax = slab2Amount * 0.05;
      tax += slab2Tax;
      slabDetails.push({ slab: "3,00,001 - 6,00,000", rate: "5%", amount: slab2Amount, tax: slab2Tax });
    }
    
    if (remainingIncome > 600000) {
      const slab3Amount = Math.min(300000, remainingIncome - 600000);
      const slab3Tax = slab3Amount * 0.10;
      tax += slab3Tax;
      slabDetails.push({ slab: "6,00,001 - 9,00,000", rate: "10%", amount: slab3Amount, tax: slab3Tax });
    }
    
    if (remainingIncome > 900000) {
      const slab4Amount = Math.min(300000, remainingIncome - 900000);
      const slab4Tax = slab4Amount * 0.15;
      tax += slab4Tax;
      slabDetails.push({ slab: "9,00,001 - 12,00,000", rate: "15%", amount: slab4Amount, tax: slab4Tax });
    }
    
    if (remainingIncome > 1200000) {
      const slab5Amount = Math.min(300000, remainingIncome - 1200000);
      const slab5Tax = slab5Amount * 0.20;
      tax += slab5Tax;
      slabDetails.push({ slab: "12,00,001 - 15,00,000", rate: "20%", amount: slab5Amount, tax: slab5Tax });
    }
    
    if (remainingIncome > 1500000) {
      const slab6Amount = remainingIncome - 1500000;
      const slab6Tax = slab6Amount * 0.30;
      tax += slab6Tax;
      slabDetails.push({ slab: "Above 15,00,000", rate: "30%", amount: slab6Amount, tax: slab6Tax });
    }
    
    // Health and Education Cess @ 4%
    const cess = tax * 0.04;
    const totalTaxLiability = tax + cess;
    
    // Total tax payable
    const taxPayable = totalTaxLiability;
    
    res.json({
      calendar_year: calendarYear,
      financial_year: `${year}-${(year + 1).toString().slice(-2)}`,
      assessment_year: `${year + 1}-${(year + 2).toString().slice(-2)}`,
      tax_regime: "New Regime",
      income_details: {
        gross_annual_value: grossAnnualValue,
        property_tax_paid: propertyTaxPaid,
        net_rental_income: netRentalIncome,
        standard_deduction: standardDeduction,
        deductions_80c: deduction80C,
        taxable_income: taxableIncome
      },
      tax_calculation: {
        slab_details: slabDetails,
        base_tax: tax,
        health_education_cess_4_percent: cess,
        total_tax_liability: totalTaxLiability,
        tax_payable: taxPayable
      },
      itr_form: "ITR-2",
      due_date: `July 31, ${year + 1}`
    });
  } catch (err) {
    console.error('Tax calculation error:', err);
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
    const [tdsDeposits] = await pool.query('SELECT * FROM tds_deposits');
    const [ledger] = await pool.query('SELECT * FROM ledger_entries');
    const [tenantDocs] = await pool.query('SELECT * FROM tenant_documents');
    const [collectionDocs] = await pool.query('SELECT * FROM collection_documents');
    const [expenseDocs] = await pool.query('SELECT * FROM expense_documents');
    const [taxFilings] = await pool.query('SELECT * FROM tax_filings');
    const [receipts] = await pool.query('SELECT * FROM receipts');
    const [receiptsHistory] = await pool.query('SELECT * FROM receipts_history');
    const [taxFilingProps] = await pool.query('SELECT * FROM tax_filing_properties');
    
    // Convert BLOB buffers to base64 strings for JSON serialization
    const serializeDocuments = (docs) => docs.map(d => ({
      ...d,
      file_content: d.file_content ? Buffer.from(d.file_content).toString('base64') : null
    }));
    
    const backupData = {
      exported_at: new Date().toISOString(),
      version: '3.0_with_tax_receipts',
      tables: {
        properties,
        tenants,
        collections,
        expenses,
        tds_deposits: tdsDeposits,
        ledger_entries: ledger,
        tenant_documents: serializeDocuments(tenantDocs),
        collection_documents: serializeDocuments(collectionDocs),
        expense_documents: serializeDocuments(expenseDocs),
        tax_filings: taxFilings,
        receipts: receipts,
        receipts_history: receiptsHistory,
        tax_filing_properties: taxFilingProps
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
    await connection.query('TRUNCATE TABLE receipts_history');
    await connection.query('TRUNCATE TABLE receipts');
    await connection.query('TRUNCATE TABLE tax_filing_properties');
    await connection.query('TRUNCATE TABLE tax_filings');
    await connection.query('TRUNCATE TABLE tds_deposits');
    await connection.query('TRUNCATE TABLE collections');
    await connection.query('TRUNCATE TABLE expenses');
    await connection.query('TRUNCATE TABLE tenants');
    await connection.query('TRUNCATE TABLE properties');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    
    // Restore data
    const { properties, tenants, collections, expenses, tds_deposits, ledger_entries, tenant_documents, collection_documents, expense_documents, tax_filings, receipts, receipts_history, tax_filing_properties } = backupData.tables;
    
    if (properties?.length) {
      for (const p of properties) {
        await connection.query(
          'INSERT INTO properties (id,name,address,type,total_units,monthly_rent,status,created_at,eb_service_number,property_assessment_number,water_connection_number) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
          [p.id, p.name, p.address, p.type, p.total_units, p.monthly_rent, p.status, p.created_at, p.eb_service_number || null, p.property_assessment_number || null, p.water_connection_number || null]
        );
      }
    }
    
    if (tenants?.length) {
      for (const t of tenants) {
        await connection.query(
          'INSERT INTO tenants (id,name,email,phone,aadhar_number,pan_number,emergency_contact,property_id,unit_number,start_date,end_date,security_deposit,monthly_rent,status,tds_applicable,tds_rate,tds_section,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [t.id, t.name, t.email, t.phone, t.aadhar_number, t.pan_number, t.emergency_contact, t.property_id, t.unit_number, t.start_date, t.end_date, t.security_deposit, t.monthly_rent || 0, t.status, t.tds_applicable || false, t.tds_rate || 5.00, t.tds_section || '194-IB', t.created_at]
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
    
    if (tds_deposits?.length) {
      for (const td of tds_deposits) {
        await connection.query(
          'INSERT INTO tds_deposits (id,tenant_id,property_id,month_year,rent_amount,tds_amount,tds_rate,status,deposit_date,challan_number,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
          [td.id, td.tenant_id, td.property_id, td.month_year, td.rent_amount, td.tds_amount, td.tds_rate, td.status, td.deposit_date, td.challan_number, td.notes, td.created_at]
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
    
    // Restore tax filings (if available in backup)
    if (tax_filings?.length) {
      for (const tf of tax_filings) {
        await connection.query(
          `INSERT INTO tax_filings (id,assessment_year,financial_year,filing_type,tax_regime,salary_income,house_property_income,other_income,gross_total_income,municipal_taxes_paid,standard_deduction,deduction_80c,deduction_80d,deduction_80g,deduction_80tta,other_deductions,total_deductions,taxable_income,tax_payable,cess_amount,total_tax_liability,tds_credit,advance_tax_paid,self_assessment_tax,tax_refund,property_details,status,filed_date,acknowledgement_number,created_at,updated_at) 
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [tf.id, tf.assessment_year, tf.financial_year, tf.filing_type, tf.tax_regime, tf.salary_income, tf.house_property_income, tf.other_income, tf.gross_total_income, tf.municipal_taxes_paid, tf.standard_deduction, tf.deduction_80c, tf.deduction_80d, tf.deduction_80g, tf.deduction_80tta, tf.other_deductions, tf.total_deductions, tf.taxable_income, tf.tax_payable, tf.cess_amount, tf.total_tax_liability, tf.tds_credit, tf.advance_tax_paid, tf.self_assessment_tax, tf.tax_refund, tf.property_details, tf.status, tf.filed_date, tf.acknowledgement_number, tf.created_at, tf.updated_at]
        );
      }
    }
    
    // Restore receipts (if available in backup)
    if (receipts?.length) {
      for (const r of receipts) {
        await connection.query(
          `INSERT INTO receipts (id,receipt_number,tenant_id,property_id,collection_id,receipt_date,month_year,rent_amount,maintenance_amount,utility_amount,total_amount,payment_method,payment_date,reference_number,status,sent_date,receipt_content,receipt_url,created_at,updated_at) 
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [r.id, r.receipt_number, r.tenant_id, r.property_id, r.collection_id, r.receipt_date, r.month_year, r.rent_amount, r.maintenance_amount, r.utility_amount, r.total_amount, r.payment_method, r.payment_date, r.reference_number, r.status, r.sent_date, r.receipt_content, r.receipt_url, r.created_at, r.updated_at]
        );
      }
    }
    
    // Restore receipts history (if available in backup)
    if (receipts_history?.length) {
      for (const rh of receipts_history) {
        await connection.query(
          `INSERT INTO receipts_history (id,receipt_id,action,action_date,action_by,ip_address,details) 
           VALUES (?,?,?,?,?,?,?)`,
          [rh.id, rh.receipt_id, rh.action, rh.action_date, rh.action_by, rh.ip_address, rh.details]
        );
      }
    }
    
    // Restore tax filing properties (if available in backup)
    if (tax_filing_properties?.length) {
      for (const tfp of tax_filing_properties) {
        await connection.query(
          `INSERT INTO tax_filing_properties (id,tax_filing_id,property_id,expected_rent,actual_rent_collected,gross_annual_value,municipal_taxes,net_annual_value,standard_deduction,interest_on_loan,income_from_property,created_at) 
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          [tfp.id, tfp.tax_filing_id, tfp.property_id, tfp.expected_rent, tfp.actual_rent_collected, tfp.gross_annual_value, tfp.municipal_taxes, tfp.net_annual_value, tfp.standard_deduction, tfp.interest_on_loan, tfp.income_from_property, tfp.created_at]
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
    let activeTenants;
    try {
      [activeTenants] = await pool.query(`
        SELECT t.*, p.monthly_rent, p.name as property_name
        FROM tenants t
        JOIN properties p ON t.property_id = p.id
        WHERE t.status = 'active'
      `);
    } catch (dbError) {
      console.error('Database error fetching active tenants:', dbError);
      throw new Error('Failed to fetch active tenants from database');
    }
    
    // Get last 6 months of collection data for trend analysis - only rent payments
    const [monthlyHistory] = await pool.query(`
      SELECT DATE_FORMAT(payment_date,'%Y-%m') as month,
             SUM(amount) as collected,
             COUNT(*) as payments
      FROM collections
      WHERE status = 'paid' 
        AND payment_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        AND (category = 'rent' OR category IS NULL)
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
    
    // Calculate actual monthly income - use real collected amounts only
    const monthDetails = {};
    for (const col of tenantCollections) {
      const paymentDate = new Date(col.payment_date);
      const month = paymentDate.toISOString().substring(0, 7); // YYYY-MM
      if (!monthDetails[month]) {
        monthDetails[month] = { total: 0, count: 0 };
      }
      monthDetails[month].total += parseFloat(col.amount);
      monthDetails[month].count++;
    }
    
    // Calculate actual average monthly income from collected data
    let actualTotal = 0;
    let actualCount = 0;
    for (const month of Object.keys(monthDetails)) {
      actualTotal += monthDetails[month].total;
      actualCount++;
    }
    
    // Calculate potential income from active tenants
    const potentialMonthlyIncome = activeTenants.reduce((sum, t) => sum + parseFloat(t.monthly_rent || 0), 0);
    
    // Apply pro-rata logic for rent payment timing
    // Rent is typically paid at beginning of month, so current month's income 
    // comes from rent that was paid at start of current month
    // For more accurate projection, use current month's actual collections
    
    // Get current month's actual collections
    const currentMonthCollections = tenantCollections
      .filter(col => {
        const paymentDate = new Date(col.payment_date);
        return paymentDate.getMonth() === currentMonth && 
               paymentDate.getFullYear() === currentYear;
      })
      .reduce((sum, col) => sum + parseFloat(col.amount), 0);
    
    // Use hybrid approach: combine historical data with future projections
    const actualAverageMonthlyIncome = actualCount > 0 ? actualTotal / actualCount : 0;
    
    // Initialize forecast array early to prevent access errors
    const forecast = [];
    
    // Calculate hybrid projected monthly income for summary (will be updated after forecast is populated)
    let hybridProjectedIncome = 0;
    
    // Real collection rate based on actual vs potential
    const collectionRate = potentialMonthlyIncome > 0 && actualAverageMonthlyIncome > 0
      ? Math.min((actualAverageMonthlyIncome / potentialMonthlyIncome) * 100, 90)
      : 0;
    
    // Get expense history for trend - include maintenance, taxes, and utilities
    const [expenseHistory] = await pool.query(`
      SELECT DATE_FORMAT(expense_date,'%Y-%m') as month,
             SUM(amount) as total,
             category,
             COUNT(*) as count
      FROM expenses
      WHERE expense_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        AND category IN ('maintenance', 'taxes', 'utilities')
      GROUP BY DATE_FORMAT(expense_date,'%Y-%m'), category
      ORDER BY month DESC
    `);
    
    // Calculate pro-rated rent for each active tenant based on start date
    const calculateProRatedRent = (tenant, targetMonth, targetYear) => {
      const startDate = new Date(tenant.start_date);
      const targetDate = new Date(targetYear, targetMonth, 1);
      
            
      // If tenant started before target month, they pay full rent
      if (startDate <= targetDate) {
        console.log(`Full rent: ${parseFloat(tenant.monthly_rent || 0)}`);
        return parseFloat(tenant.monthly_rent || 0);
      }
      
      // If tenant starts in the target month, calculate pro-rated amount
      if (startDate.getMonth() === targetMonth && startDate.getFullYear() === targetYear) {
        const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
        const daysOccupied = daysInMonth - startDate.getDate() + 1;
        const proRatedAmount = parseFloat(tenant.monthly_rent || 0) * (daysOccupied / daysInMonth);
        return proRatedAmount;
      }
      
      // Tenant starts after target month, no rent
      return 0;
    };

    // Calculate current financial year forecast (April to March)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Validate required variables are available
    if (!monthNames || !Array.isArray(monthNames)) {
      throw new Error('monthNames array not properly initialized');
    }
    
    // Determine financial year start and end
    const financialYearStart = currentMonth >= 3 ? currentYear : currentYear - 1; // April start
    const startMonth = 3; // April
    
    for (let i = 0; i < 12; i++) {
      const forecastMonth = (startMonth + i) % 12;
      const forecastYear = financialYearStart + Math.floor((startMonth + i) / 12);
      
      // Show complete financial year from April to March
      // Don't filter by current date - show all months of the financial year
      
      const monthKey = `${forecastYear}-${String(forecastMonth + 1).padStart(2, '0')}`;
      
      // Use historical collections for past months, predict for future months
      const monthlyCollections = monthlyHistory.find(h => h.month === monthKey);
      let predictedIncome;
      
      if (monthlyCollections) {
        // Use actual collections for months that have historical data
        predictedIncome = monthlyCollections.collected;
      } else {
        // Predict future months based on current active tenants
        predictedIncome = activeTenants.reduce((sum, tenant) => {
          return sum + calculateProRatedRent(tenant, forecastMonth, forecastYear);
        }, 0);
      }
      
      // Use historical expenses for past months, predict for future months
      const monthlyExpenses = expenseHistory.filter(e => {
        const expenseMonth = new Date(e.month + '-01').getMonth();
        return expenseMonth === forecastMonth;
      });
      
      let predictedExpenses;
      if (monthlyExpenses.length > 0) {
        // Use actual expenses for months that have historical data
        predictedExpenses = monthlyExpenses.reduce((sum, e) => sum + parseFloat(e.total), 0);
      } else {
        // Predict future expenses based on monthly average
        const monthlyAverage = expenseHistory.length > 0
          ? expenseHistory.reduce((sum, e) => sum + parseFloat(e.total), 0) / expenseHistory.length
          : 0;
        predictedExpenses = monthlyAverage;
      }
      
      forecast.push({
        month: monthNames[forecastMonth],
        year: forecastYear,
        predictedIncome: Math.round(predictedIncome),
        predictedExpenses: Math.round(predictedExpenses),
        predictedNet: Math.round(predictedIncome - predictedExpenses),
        confidence: predictedIncome > 0 ? 'high' : 'low'
      });
    }
    
    // Update hybrid projected income now that forecast is populated
    hybridProjectedIncome = forecast.length > 0 ? forecast.reduce((sum, f) => sum + f.predictedIncome, 0) / forecast.length : 0;
    
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
    
    // Calculate year-end projections using hybrid forecasting data
    const forecastIncome = forecast.reduce((sum, f) => sum + f.predictedIncome, 0);
    const forecastExpenses = forecast.reduce((sum, f) => sum + f.predictedExpenses, 0);
    
    const yearEndProjections = {
      projectedTotalIncome: Math.round(forecastIncome),
      projectedTotalExpenses: Math.round(forecastExpenses),
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
    
    // Risk indicators with safety checks
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
    
    // Safety checks for risk indicators
    const safeRiskIndicators = {
      latePayments: riskIndicators.latePayments && riskIndicators.latePayments[0] && riskIndicators.latePayments[0][0] ? riskIndicators.latePayments[0][0].count : 0,
      expiringLeases: riskIndicators.expiringLeases && riskIndicators.expiringLeases[0] && riskIndicators.expiringLeases[0][0] ? riskIndicators.expiringLeases[0][0].count : 0,
      highExpenseCategories: riskIndicators.highExpenseCategories && riskIndicators.highExpenseCategories[0] ? riskIndicators.highExpenseCategories[0] : null
    };
    
    // Calculate occupancy data for summary
    const [allProperties] = await pool.query('SELECT COUNT(*) as total FROM properties');
    const totalProperties = allProperties[0].total;
    const occupiedProperties = activeTenants.length;
    const vacantProperties = totalProperties - occupiedProperties;
    const occupancyRate = totalProperties > 0 ? (occupiedProperties / totalProperties * 100).toFixed(2) : 0;

    res.json({
      summary: {
        activeTenants: activeTenants.length,
        projectedMonthlyIncome: Math.round(hybridProjectedIncome),
        averageCollectionRate: Math.round(collectionRate * 10) / 10,
        monthsOfHistory: monthlyHistory.length,
        // Occupancy data
        total_units: totalProperties,
        occupied_units: occupiedProperties,
        vacant_units: vacantProperties,
        occupancy_rate: parseFloat(occupancyRate)
      },
      forecast,
      propertyPredictions: propertyPredictions.sort((a, b) => b.projectedMonthlyIncome - a.projectedMonthlyIncome),
      yearEndProjections,
      risks: {
        latePayments: safeRiskIndicators.latePayments,
        expiringLeases: safeRiskIndicators.expiringLeases,
        expenseAlerts: safeRiskIndicators.highExpenseCategories
      },
      recommendations: generateRecommendations(collectionRate, safeRiskIndicators, propertyPredictions)
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
  
  if (risks.latePayments > 3) {
    recommendations.push({
      type: 'action',
      priority: 'high',
      message: `${risks.latePayments} late payments this month. Follow up immediately to maintain cash flow.`
    });
  }
  
  if (risks.expiringLeases > 0) {
    recommendations.push({
      type: 'info',
      priority: 'medium',
      message: `${risks.expiringLeases} leases expiring in next 3 months. Start renewal discussions early.`
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
            'INSERT INTO properties (id,name,address,type,total_units,monthly_rent,status,created_at,eb_service_number,property_assessment_number,water_connection_number) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
            [p.id, p.name, p.address, p.type, p.total_units, p.monthly_rent, p.status, toMySQLDateTime(p.created_at), p.eb_service_number || null, p.property_assessment_number || null, p.water_connection_number || null]
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
    const [tdsDeposits] = await pool.query('SELECT * FROM tds_deposits');
    const [ledger] = await pool.query('SELECT * FROM ledger_entries');
    const [tenantDocs] = await pool.query('SELECT * FROM tenant_documents');
    const [collectionDocs] = await pool.query('SELECT * FROM collection_documents');
    const [expenseDocs] = await pool.query('SELECT * FROM expense_documents');
    const [taxFilings] = await pool.query('SELECT * FROM tax_filings');
    const [receipts] = await pool.query('SELECT * FROM receipts');
    const [receiptsHistory] = await pool.query('SELECT * FROM receipts_history');
    const [taxFilingProps] = await pool.query('SELECT * FROM tax_filing_properties');
    
    // Convert BLOB buffers to base64 strings for JSON serialization
    const serializeDocuments = (docs) => docs.map(d => ({
      ...d,
      file_content: d.file_content ? Buffer.from(d.file_content).toString('base64') : null
    }));
    
    const backupData = {
      exported_at: new Date().toISOString(),
      version: '3.0_with_tax_receipts',
      reason: reason,
      tables: {
        properties,
        tenants,
        collections,
        expenses,
        tds_deposits: tdsDeposits,
        ledger_entries: ledger,
        tenant_documents: serializeDocuments(tenantDocs),
        collection_documents: serializeDocuments(collectionDocs),
        expense_documents: serializeDocuments(expenseDocs),
        tax_filings: taxFilings,
        receipts: receipts,
        receipts_history: receiptsHistory,
        tax_filing_properties: taxFilingProps
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

// ─────────────────────────────────────────────────────────────────────────────
// INCOME TAX CALCULATION & RECEIPTS SECTION
// ─────────────────────────────────────────────────────────────────────────────

// Calculate Income Tax for AY 2025-26 (New Tax Regime)
app.get('/api/tax/calculate/:assessmentYear', async (req, res) => {
  const { assessmentYear } = req.params;
  const { financialYear = '2024-25', municipalTaxes = 0, deductions80C = 0, deductions80D = 0 } = req.query;
  
  try {
    // Get all collections for the financial year
    const fyStart = `${financialYear.split('-')[0]}-04-01`;
    const endYear = financialYear.split('-')[0];
    const fyEnd = `${parseInt(endYear) + 1}-03-31`;
    
    const [collections] = await pool.query(`
      SELECT 
        p.id as property_id,
        p.name as property_name,
        p.monthly_rent as expected_rent,
        c.tenant_id,
        t.name as tenant_name,
        c.amount,
        c.payment_date,
        c.month_year,
        c.category
      FROM collections c
      JOIN properties p ON c.property_id = p.id
      JOIN tenants t ON c.tenant_id = t.id
      WHERE c.status = 'paid'
        AND c.payment_date >= ?
        AND c.payment_date <= ?
      ORDER BY p.name, c.payment_date
    `, [fyStart, fyEnd]);
    
    // Get all expenses for the financial year
    const [expenses] = await pool.query(`
      SELECT 
        p.id as property_id,
        p.name as property_name,
        e.amount,
        e.expense_date,
        e.category
      FROM expenses e
      LEFT JOIN properties p ON e.property_id = p.id
      WHERE e.expense_date >= ?
        AND e.expense_date <= ?
    `, [fyStart, fyEnd]);
    
    // Calculate property-wise income
    const propertyIncome = {};
    const propertyExpenses = {};
    
    collections.forEach(col => {
      const pid = col.property_id;
      if (!propertyIncome[pid]) {
        propertyIncome[pid] = {
          property_id: pid,
          property_name: col.property_name,
          expected_rent: parseFloat(col.expected_rent) || 0,
          actual_rent: 0,
          months_collected: new Set(),
          tenant_details: []
        };
      }
      propertyIncome[pid].actual_rent += parseFloat(col.amount);
      propertyIncome[pid].months_collected.add(col.month_year);
      propertyIncome[pid].tenant_details.push({
        tenant_name: col.tenant_name,
        amount: col.amount,
        month_year: col.month_year,
        payment_date: col.payment_date
      });
    });
    
    expenses.forEach(exp => {
      const pid = exp.property_id || 'unallocated';
      if (!propertyExpenses[pid]) {
        propertyExpenses[pid] = { total: 0, details: [] };
      }
      propertyExpenses[pid].total += parseFloat(exp.amount);
      propertyExpenses[pid].details.push({
        amount: exp.amount,
        category: exp.category,
        date: exp.expense_date
      });
    });
    
    // Calculate GAV and NAV for each property
    const propertyTaxDetails = Object.values(propertyIncome).map(prop => {
      const expectedAnnual = prop.expected_rent * 12;
      const gav = Math.max(prop.actual_rent, expectedAnnual);
      const propMunicipalTax = Math.min(municipalTaxes * (prop.actual_rent / Object.values(propertyIncome).reduce((sum, p) => sum + p.actual_rent, 0)), municipalTaxes);
      const nav = gav - propMunicipalTax;
      const standardDeduction = nav * 0.30;
      const incomeFromProperty = nav - standardDeduction;
      
      return {
        property_id: prop.property_id,
        property_name: prop.property_name,
        expected_rent: prop.expected_rent,
        expected_annual_rent: expectedAnnual,
        actual_rent_collected: prop.actual_rent,
        months_collected: prop.months_collected.size,
        gross_annual_value: gav,
        municipal_taxes: propMunicipalTax,
        net_annual_value: nav,
        standard_deduction_30: standardDeduction,
        income_from_property: incomeFromProperty,
        tenant_details: prop.tenant_details,
        expenses: propertyExpenses[prop.property_id]?.total || 0
      };
    });
    
    // Total calculations
    const totalGAV = propertyTaxDetails.reduce((sum, p) => sum + p.gross_annual_value, 0);
    const totalNAV = propertyTaxDetails.reduce((sum, p) => sum + p.net_annual_value, 0);
    const totalStandardDeduction = propertyTaxDetails.reduce((sum, p) => sum + p.standard_deduction_30, 0);
    const totalHousePropertyIncome = propertyTaxDetails.reduce((sum, p) => sum + p.income_from_property, 0);
    
    // Tax Calculation (New Regime)
    const grossTotalIncome = totalHousePropertyIncome;
    const taxableIncome = grossTotalIncome;
    
    let taxPayable = 0;
    if (taxableIncome > 300000) {
      if (taxableIncome <= 600000) {
        taxPayable = (taxableIncome - 300000) * 0.05;
      } else if (taxableIncome <= 900000) {
        taxPayable = 300000 * 0.05 + (taxableIncome - 600000) * 0.10;
      } else if (taxableIncome <= 1200000) {
        taxPayable = 300000 * 0.05 + 300000 * 0.10 + (taxableIncome - 900000) * 0.15;
      } else if (taxableIncome <= 1500000) {
        taxPayable = 300000 * 0.05 + 300000 * 0.10 + 300000 * 0.15 + (taxableIncome - 1200000) * 0.20;
      } else {
        taxPayable = 300000 * 0.05 + 300000 * 0.10 + 300000 * 0.15 + 300000 * 0.20 + (taxableIncome - 1500000) * 0.30;
      }
    }
    
    // Rebate under Section 87A (for income up to ₹7,00,000)
    let rebate87A = 0;
    if (taxableIncome <= 700000 && taxPayable > 0) {
      rebate87A = Math.min(taxPayable, 25000);
    }
    
    const taxAfterRebate = taxPayable - rebate87A;
    const cess = taxAfterRebate * 0.04;
    const totalTaxLiability = taxAfterRebate + cess;
    
    // Get TDS deposited
    const [tdsDeposited] = await pool.query(`
      SELECT COALESCE(SUM(tds_amount), 0) as total_tds
      FROM tds_deposits
      WHERE deposit_date >= ? AND deposit_date <= ?
    `, [fyStart, fyEnd]);
    
    const tdsCredit = parseFloat(tdsDeposited[0].total_tds) || 0;
    const taxRefund = Math.max(0, tdsCredit - totalTaxLiability);
    const taxPayableAfterTDS = Math.max(0, totalTaxLiability - tdsCredit);
    
    res.json({
      assessment_year: assessmentYear,
      financial_year: financialYear,
      tax_regime: 'new',
      
      property_breakdown: propertyTaxDetails,
      
      summary: {
        total_gross_annual_value: totalGAV,
        total_municipal_taxes: parseFloat(municipalTaxes),
        total_net_annual_value: totalNAV,
        total_standard_deduction: totalStandardDeduction,
        house_property_income: totalHousePropertyIncome,
        gross_total_income: grossTotalIncome,
        taxable_income: taxableIncome
      },
      
      tax_calculation: {
        tax_before_rebate: taxPayable,
        rebate_87a: rebate87A,
        tax_after_rebate: taxAfterRebate,
        cess_4_percent: cess,
        total_tax_liability: totalTaxLiability,
        tds_credit: tdsCredit,
        tax_payable: taxPayableAfterTDS,
        tax_refund: taxRefund
      },
      
      tax_slabs_applied: [
        { slab: '0 - 3,00,000', rate: '0%', amount: Math.min(taxableIncome, 300000), tax: 0 },
        { slab: '3,00,001 - 6,00,000', rate: '5%', amount: Math.max(0, Math.min(taxableIncome, 600000) - 300000), tax: Math.max(0, Math.min(taxableIncome - 300000, 300000)) * 0.05 },
        { slab: '6,00,001 - 9,00,000', rate: '10%', amount: Math.max(0, Math.min(taxableIncome, 900000) - 600000), tax: Math.max(0, Math.min(taxableIncome - 600000, 300000)) * 0.10 },
        { slab: '9,00,001 - 12,00,000', rate: '15%', amount: Math.max(0, Math.min(taxableIncome, 1200000) - 900000), tax: Math.max(0, Math.min(taxableIncome - 900000, 300000)) * 0.15 },
        { slab: '12,00,001 - 15,00,000', rate: '20%', amount: Math.max(0, Math.min(taxableIncome, 1500000) - 1200000), tax: Math.max(0, Math.min(taxableIncome - 1200000, 300000)) * 0.20 },
        { slab: 'Above 15,00,000', rate: '30%', amount: Math.max(0, taxableIncome - 1500000), tax: Math.max(0, taxableIncome - 1500000) * 0.30 }
      ].filter(s => s.amount > 0)
    });
    
  } catch (err) {
    console.error('[TAX] Error calculating tax:', err);
    res.status(500).json({ error: err.message });
  }
});

// Save tax filing
app.post('/api/tax/filing', async (req, res) => {
  const {
    assessment_year,
    financial_year = '2024-25',
    filing_type = 'ITR-2',
    tax_regime = 'new',
    salary_income = 0,
    house_property_income = 0,
    other_income = 0,
    municipal_taxes_paid = 0,
    standard_deduction = 0,
    deduction_80c = 0,
    deduction_80d = 0,
    taxable_income = 0,
    tax_payable = 0,
    cess_amount = 0,
    total_tax_liability = 0,
    tds_credit = 0,
    property_details = null
  } = req.body;
  
  try {
    const [result] = await pool.query(`
      INSERT INTO tax_filings (
        assessment_year, financial_year, filing_type, tax_regime,
        salary_income, house_property_income, other_income,
        gross_total_income, municipal_taxes_paid, standard_deduction,
        deduction_80c, deduction_80d, taxable_income,
        tax_payable, cess_amount, total_tax_liability, tds_credit,
        property_details, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
      ON DUPLICATE KEY UPDATE
        salary_income = VALUES(salary_income),
        house_property_income = VALUES(house_property_income),
        other_income = VALUES(other_income),
        gross_total_income = VALUES(gross_total_income),
        municipal_taxes_paid = VALUES(municipal_taxes_paid),
        standard_deduction = VALUES(standard_deduction),
        deduction_80c = VALUES(deduction_80c),
        deduction_80d = VALUES(deduction_80d),
        taxable_income = VALUES(taxable_income),
        tax_payable = VALUES(tax_payable),
        cess_amount = VALUES(cess_amount),
        total_tax_liability = VALUES(total_tax_liability),
        tds_credit = VALUES(tds_credit),
        property_details = VALUES(property_details),
        updated_at = CURRENT_TIMESTAMP
    `, [
      assessment_year, financial_year, filing_type, tax_regime,
      salary_income, house_property_income, other_income,
      salary_income + house_property_income + other_income,
      municipal_taxes_paid, standard_deduction,
      deduction_80c, deduction_80d, taxable_income,
      tax_payable, cess_amount, total_tax_liability, tds_credit,
      property_details ? JSON.stringify(property_details) : null
    ]);
    
    res.json({ 
      id: result.insertId || result.affectedRows,
      message: 'Tax filing saved successfully',
      assessment_year,
      status: 'draft'
    });
  } catch (err) {
    console.error('[TAX] Error saving tax filing:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get tax filings list
app.get('/api/tax/filings', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        id,
        assessment_year,
        financial_year,
        filing_type,
        tax_regime,
        gross_total_income,
        taxable_income,
        total_tax_liability,
        tds_credit,
        tax_refund,
        status,
        filed_date,
        created_at
      FROM tax_filings
      ORDER BY assessment_year DESC, created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get specific tax filing
app.get('/api/tax/filing/:id', async (req, res) => {
  try {
    const [filing] = await pool.query('SELECT * FROM tax_filings WHERE id = ?', [req.params.id]);
    if (filing.length === 0) {
      return res.status(404).json({ error: 'Tax filing not found' });
    }
    
    const [properties] = await pool.query(`
      SELECT tfp.*, p.name as property_name, p.address as property_address
      FROM tax_filing_properties tfp
      JOIN properties p ON tfp.property_id = p.id
      WHERE tfp.tax_filing_id = ?
    `, [req.params.id]);
    
    res.json({
      ...filing[0],
      property_details: properties
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── RENT RECEIPTS ──────────────────────────────────────────────────────────

// Generate receipt for a collection
app.post('/api/receipts/generate', async (req, res) => {
  const { collection_id, receipt_date = new Date() } = req.body;
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Get collection details
    const [collection] = await connection.query(`
      SELECT c.*, t.name as tenant_name, t.email as tenant_email, t.phone as tenant_phone,
             p.name as property_name, p.address as property_address
      FROM collections c
      JOIN tenants t ON c.tenant_id = t.id
      JOIN properties p ON c.property_id = p.id
      WHERE c.id = ?
    `, [collection_id]);
    
    if (collection.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Collection not found' });
    }
    
    const col = collection[0];
    
    // Generate receipt number
    const receiptNumber = `RCPT-${Date.now()}-${col.tenant_id}`;
    
    // Calculate amounts
    const rentAmount = col.category === 'rent' ? col.amount : 0;
    const maintenanceAmount = col.category === 'maintenance' ? col.amount : 0;
    const utilityAmount = col.category === 'utilities' ? col.amount : 0;
    
    // Create receipt
    const [receiptResult] = await connection.query(`
      INSERT INTO receipts (
        receipt_number, tenant_id, property_id, collection_id,
        receipt_date, month_year, rent_amount, maintenance_amount, utility_amount, total_amount,
        payment_method, payment_date, reference_number, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'generated')
    `, [
      receiptNumber, col.tenant_id, col.property_id, collection_id,
      receipt_date, col.month_year, rentAmount, maintenanceAmount, utilityAmount, col.amount,
      col.payment_method, col.payment_date, col.reference_number
    ]);
    
    const receiptId = receiptResult.insertId;
    
    // Update collection with receipt_id
    await connection.query('UPDATE collections SET receipt_id = ? WHERE id = ?', [receiptId, collection_id]);
    
    // Log receipt generation
    await connection.query(`
      INSERT INTO receipts_history (receipt_id, action, details)
      VALUES (?, 'generated', ?)
    `, [receiptId, `Receipt generated for collection #${collection_id}`]);
    
    await connection.commit();
    
    res.json({
      id: receiptId,
      receipt_number: receiptNumber,
      message: 'Receipt generated successfully',
      receipt: {
        id: receiptId,
        receipt_number: receiptNumber,
        tenant_name: col.tenant_name,
        property_name: col.property_name,
        property_address: col.property_address,
        month_year: col.month_year,
        rent_amount: rentAmount,
        maintenance_amount: maintenanceAmount,
        utility_amount: utilityAmount,
        total_amount: col.amount,
        payment_method: col.payment_method,
        payment_date: col.payment_date,
        reference_number: col.reference_number,
        receipt_date: receipt_date
      }
    });
  } catch (err) {
    await connection.rollback();
    console.error('[RECEIPT] Error generating receipt:', err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// Get all receipts
app.get('/api/receipts', async (req, res) => {
  const { tenant_id, month_year, status, limit = 1000, offset = 0 } = req.query;
  
  try {
    // Convert YYYY-MM format to "Month Year" format if needed
    let monthYearFilter = month_year;
    if (month_year && month_year.includes('-')) {
      const [year, month] = month_year.split('-');
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthName = monthNames[parseInt(month) - 1];
      if (monthName) {
        monthYearFilter = `${monthName} ${year}`;
      }
    }
    
    let query = `
      SELECT 
        r.id,
        r.receipt_number,
        r.receipt_date,
        r.month_year,
        r.rent_amount,
        r.maintenance_amount,
        r.utility_amount,
        r.total_amount,
        r.status,
        r.payment_method,
        r.payment_date,
        r.tenant_id,
        r.property_id,
        t.name as tenant_name,
        t.phone,
        t.emergency_contact,
        p.name as property_name
      FROM receipts r
      JOIN tenants t ON r.tenant_id = t.id
      JOIN properties p ON r.property_id = p.id
      WHERE 1=1
    `;
    const params = [];
    
    if (tenant_id) {
      query += ' AND r.tenant_id = ?';
      params.push(tenant_id);
    }
    if (monthYearFilter) {
      query += ' AND r.month_year = ?';
      params.push(monthYearFilter);
    }
    if (status) {
      query += ' AND r.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY r.receipt_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get receipt details
app.get('/api/receipts/:id', async (req, res) => {
  try {
    const [receipt] = await pool.query(`
      SELECT 
        r.*,
        t.name as tenant_name,
        t.email as tenant_email,
        t.phone as tenant_phone,
        t.pan_number as tenant_pan,
        p.name as property_name,
        p.address as property_address,
        p.monthly_rent as property_monthly_rent
      FROM receipts r
      JOIN tenants t ON r.tenant_id = t.id
      JOIN properties p ON r.property_id = p.id
      WHERE r.id = ?
    `, [req.params.id]);
    
    if (receipt.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    
    const [history] = await pool.query(`
      SELECT * FROM receipts_history WHERE receipt_id = ? ORDER BY action_date DESC
    `, [req.params.id]);
    
    res.json({
      ...receipt[0],
      history
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update receipt status (sent, viewed, downloaded)
app.put('/api/receipts/:id/status', async (req, res) => {
  const { status, action_by = 'system' } = req.body;
  
  try {
    await pool.query('UPDATE receipts SET status = ? WHERE id = ?', [status, req.params.id]);
    
    await pool.query(`
      INSERT INTO receipts_history (receipt_id, action, action_by, details)
      VALUES (?, ?, ?, ?)
    `, [req.params.id, status, action_by, `Receipt status updated to ${status}`]);
    
    res.json({ message: 'Receipt status updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete receipt
app.delete('/api/receipts/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Get receipt info to clear collection link
    const [receipt] = await connection.query('SELECT collection_id FROM receipts WHERE id = ?', [req.params.id]);
    
    if (receipt.length > 0 && receipt[0].collection_id) {
      // Clear receipt_id from collection
      await connection.query('UPDATE collections SET receipt_id = NULL WHERE id = ?', [receipt[0].collection_id]);
    }
    
    // Delete receipt history first (foreign key constraint)
    await connection.query('DELETE FROM receipts_history WHERE receipt_id = ?', [req.params.id]);
    
    // Delete receipt
    await connection.query('DELETE FROM receipts WHERE id = ?', [req.params.id]);
    
    await connection.commit();
    res.json({ message: 'Receipt deleted successfully' });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// Generate receipts for all collections in a month
app.post('/api/receipts/generate-bulk', async (req, res) => {
  const { month_year, property_id, tenant_ids } = req.body;
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Convert YYYY-MM format to "Month Year" format for matching
    let monthYearFilter = month_year;
    if (month_year && month_year.includes('-')) {
      const [year, month] = month_year.split('-');
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthName = monthNames[parseInt(month) - 1];
      if (monthName) {
        monthYearFilter = `${monthName} ${year}`;
      }
    }
    
    // Find all paid collections without receipts for the given month
    let query = `
      SELECT c.*, t.name as tenant_name, t.email as tenant_email, p.name as property_name, p.address as property_address
      FROM collections c
      JOIN tenants t ON c.tenant_id = t.id
      JOIN properties p ON c.property_id = p.id
      WHERE c.status = 'paid' AND c.month_year = ? AND (c.receipt_id IS NULL OR c.receipt_id = 0)
    `;
    const params = [monthYearFilter];
    
    if (property_id) {
      query += ' AND c.property_id = ?';
      params.push(property_id);
    }
    
    // Filter by specific tenants if provided
    if (tenant_ids && Array.isArray(tenant_ids) && tenant_ids.length > 0) {
      query += ` AND c.tenant_id IN (${tenant_ids.map(() => '?').join(',')})`;
      params.push(...tenant_ids);
    }
    
    const [collections] = await connection.query(query, params);
    
    // If no collections found for the specific month, try matching by payment_date month
    let finalCollections = collections;
    if (collections.length === 0 && month_year && month_year.includes('-')) {
      const [year, month] = month_year.split('-');
      const dateQuery = `
        SELECT c.*, t.name as tenant_name, t.email as tenant_email, p.name as property_name, p.address as property_address
        FROM collections c
        JOIN tenants t ON c.tenant_id = t.id
        JOIN properties p ON c.property_id = p.id
        WHERE c.status = 'paid' 
          AND YEAR(c.payment_date) = ? 
          AND MONTH(c.payment_date) = ?
          AND (c.receipt_id IS NULL OR c.receipt_id = 0)
        ${property_id ? ' AND c.property_id = ?' : ''}
        ${tenant_ids && tenant_ids.length > 0 ? ` AND c.tenant_id IN (${tenant_ids.map(() => '?').join(',')})` : ''}
      `;
      let dateParams = property_id ? [year, month, property_id] : [year, month];
      if (tenant_ids && tenant_ids.length > 0) {
        dateParams = dateParams.concat(tenant_ids);
      }
      const [dateCollections] = await connection.query(dateQuery, dateParams);
      finalCollections = dateCollections;
    }
    
    const generatedReceipts = [];
    const errors = [];
    
    for (const col of finalCollections) {
      try {
        const receiptNumber = `RCPT-${Date.now()}-${col.tenant_id}-${col.id}`;
        
        const [result] = await connection.query(`
          INSERT INTO receipts (
            receipt_number, tenant_id, property_id, collection_id,
            receipt_date, month_year, rent_amount, total_amount,
            payment_method, payment_date, reference_number, status
          ) VALUES (?, ?, ?, ?, CURRENT_DATE, ?, ?, ?, ?, ?, ?, 'generated')
        `, [
          receiptNumber, col.tenant_id, col.property_id, col.id,
          col.month_year, col.category === 'rent' ? col.amount : 0, col.amount,
          col.payment_method, col.payment_date, col.reference_number
        ]);
        
        await connection.query('UPDATE collections SET receipt_id = ? WHERE id = ?', [result.insertId, col.id]);
        
        generatedReceipts.push({
          id: result.insertId,
          receipt_number: receiptNumber,
          tenant_name: col.tenant_name,
          amount: col.amount
        });
      } catch (err) {
        errors.push({ collection_id: col.id, error: err.message });
      }
    }
    
    await connection.commit();
    
    res.json({
      message: `Generated ${generatedReceipts.length} receipts for ${month_year}`,
      generated: generatedReceipts,
      errors: errors,
      total_processed: finalCollections.length
    });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// Auto-generate receipt for a single collection when paid
async function autoGenerateReceipt(connection, collection) {
  try {
    // Check if receipt already exists
    if (collection.receipt_id && collection.receipt_id > 0) {
      return null;
    }
    
    // Only generate receipts for rent payments (not for maintenance/advance)
    if (collection.category !== 'rent') {
      return null;
    }
    
    // Get tenant and property details
    const [[tenant]] = await connection.query('SELECT name, email FROM tenants WHERE id = ?', [collection.tenant_id]);
    const [[property]] = await connection.query('SELECT name, address FROM properties WHERE id = ?', [collection.property_id]);
    
    if (!tenant || !property) {
      return null;
    }
    
    const receiptNumber = `RCPT-${Date.now()}-${collection.tenant_id}-${collection.id}`;
    
    const [result] = await connection.query(`
      INSERT INTO receipts (
        receipt_number, tenant_id, property_id, collection_id,
        receipt_date, month_year, rent_amount, total_amount,
        payment_method, payment_date, reference_number, status
      ) VALUES (?, ?, ?, ?, CURRENT_DATE, ?, ?, ?, ?, ?, ?, 'auto')
    `, [
      receiptNumber, collection.tenant_id, collection.property_id, collection.id,
      collection.month_year, collection.amount, collection.amount,
      collection.payment_method, collection.payment_date, collection.reference_number
    ]);
    
    await connection.query('UPDATE collections SET receipt_id = ? WHERE id = ?', [result.insertId, collection.id]);
    
    return {
      id: result.insertId,
      receipt_number: receiptNumber,
      tenant_name: tenant.name,
      amount: collection.amount
    };
  } catch (err) {
    console.error('Auto-receipt generation failed:', err.message);
    return null;
  }
}

// Updated TDS Report with Income Tax Summary
app.get('/api/tds-report-detailed', async (req, res) => {
  const { fy_year = '2024-25' } = req.query;
  
  try {
    // Get TDS details by tenant (all tenants, not just TDS applicable)
    const [tdsDetails] = await pool.query(`
      SELECT 
        t.id as tenant_id,
        t.name as tenant_name,
        t.pan_number,
        t.monthly_rent,
        t.tds_applicable,
        t.tds_rate,
        p.name as property_name,
        COALESCE(COUNT(td.id), 0) as deposits_count,
        COALESCE(SUM(CASE WHEN td.status = 'pending' THEN td.tds_amount ELSE 0 END), 0) as pending_tds,
        COALESCE(SUM(CASE WHEN td.status = 'deposited' THEN td.tds_amount ELSE 0 END), 0) as deposited_tds,
        COALESCE(SUM(td.tds_amount), 0) as total_tds_liability
      FROM tenants t
      LEFT JOIN properties p ON t.property_id = p.id
      LEFT JOIN tds_deposits td ON t.id = td.tenant_id
      GROUP BY t.id, t.name, t.pan_number, t.monthly_rent, t.tds_applicable, t.tds_rate, p.name
      ORDER BY t.name
    `);
    
    // Get monthly TDS breakdown
    const [monthlyBreakdown] = await pool.query(`
      SELECT 
        td.month_year,
        SUM(td.tds_amount) as total_tds,
        COUNT(*) as tenant_count
      FROM tds_deposits td
      WHERE td.status = 'deposited'
      GROUP BY td.month_year
      ORDER BY td.month_year
    `);
    
    // Get total TDS deposited for FY
    const [fyTotal] = await pool.query(`
      SELECT 
        SUM(tds_amount) as total_deposited,
        COUNT(DISTINCT tenant_id) as tenants_count,
        COUNT(*) as transactions_count
      FROM tds_deposits
      WHERE status = 'deposited'
        AND deposit_date >= ? AND deposit_date <= ?
    `, [`${fy_year.split('-')[0]}-04-01`, `20${fy_year.split('-')[1]}-03-31`]);
    
    res.json({
      financial_year: fy_year,
      summary: {
        total_tds_deposited: fyTotal[0].total_deposited || 0,
        tenants_count: fyTotal[0].tenants_count || 0,
        transactions_count: fyTotal[0].transactions_count || 0
      },
      tenant_wise_details: tdsDetails,
      monthly_breakdown: monthlyBreakdown
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Migration: Link existing receipts to collections
app.post('/api/migrate/link-receipts', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Find receipts that aren't linked to collections
    const [unlinkedReceipts] = await connection.query(`
      SELECT r.id as receipt_id, r.tenant_id, r.month_year, r.collection_id
      FROM receipts r
      WHERE r.collection_id IS NULL
    `);
    
    let linked = 0;
    let errors = [];
    
    for (const receipt of unlinkedReceipts) {
      try {
        // Find matching collection by tenant + month
        const [collections] = await connection.query(`
          SELECT c.id 
          FROM collections c
          WHERE c.tenant_id = ? 
            AND c.month_year = ?
            AND (c.receipt_id IS NULL OR c.receipt_id = 0)
          LIMIT 1
        `, [receipt.tenant_id, receipt.month_year]);
        
        if (collections.length > 0) {
          const collectionId = collections[0].id;
          
          // Link receipt to collection
          await connection.query(`
            UPDATE receipts SET collection_id = ? WHERE id = ?
          `, [collectionId, receipt.receipt_id]);
          
          // Link collection to receipt
          await connection.query(`
            UPDATE collections SET receipt_id = ? WHERE id = ?
          `, [receipt.receipt_id, collectionId]);
          
          linked++;
        }
      } catch (err) {
        errors.push({ receipt_id: receipt.receipt_id, error: err.message });
      }
    }
    
    await connection.commit();
    
    res.json({
      message: `Linked ${linked} receipts to collections`,
      total_unlinked: unlinkedReceipts.length,
      linked,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// Before exit backup (fallback)
process.on('beforeExit', async () => {
  await createAutoBackup('before-exit');
});

console.log('[BACKUP] Automatic backup handlers registered for shutdown/crash events');
