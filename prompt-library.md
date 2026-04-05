# RentalManager Application - Complete Build Prompt

## Application Overview
Build a full-stack Property Rental Management System with React frontend, Node.js/Express backend, and MySQL database. The system manages properties, tenants, rent collections, expenses, and documents with OCR capabilities.

## Core Requirements

### 1. Property Management
- CRUD operations for properties (name, type, address, units, monthly rent)
- Property categorization (apartment, villa, commercial)
- Property-level analytics and occupancy tracking

### 2. Tenant Management  
- Full tenant profiles with KYC (name, phone, email, Aadhar, PAN)
- Property assignment with unit numbers
- Lease tracking (start/end dates, security deposit, status)
- Document uploads: Aadhar, PAN, Lease Agreements, ID/Address proofs
- OCR extraction from Aadhar/PAN cards to auto-fill tenant details

### 3. Rent Collections
- Record rent payments with multiple payment methods (UPI, Cash, Bank Transfer, Cheque)
- Payment categorization (rent, utilities, advance, maintenance, deposit)
- Status tracking (paid, pending, partial, overdue)
- Payment proof document uploads with reference number extraction
- Monthly/yearly filtering and reporting

### 4. Expense Management
- Track property expenses by category (maintenance, utilities, taxes, insurance, repairs, cleaning, security)
- Expense receipt uploads
- Vendor/Payee tracking
- Status tracking (paid, pending)

### 5. General Ledger (Tax Management)
- Income/expense entries with GST and TDS tracking
- Financial year and quarter categorization
- PAN/GST number tracking for vendors
- Tax summary reporting
- Returns filing data by calendar year

### 6. Document Management System (CRITICAL)
**Storage Architecture:**
- Use MySQL LONGBLOB columns for file storage (NOT filesystem)
- Document tables: `tenant_documents`, `collection_documents`, `expense_documents`
- Schema: id, entity_id (tenant/collection/expense), filename, original_name, mime_type, file_size, file_content (LONGBLOB), document_type, description, uploaded_at

**API Endpoints:**
- `POST /api/tenants/:id/documents` - Upload with multer memoryStorage
- `GET /api/tenants/:id/documents` - List documents  
- `GET /api/documents/:id/download` - Serve BLOB as file download
- `DELETE /api/documents/:id` - Delete document
- Similar endpoints for collections and expenses

**OCR Features:**
- `POST /api/documents/:id/extract` - Extract Aadhar/PAN data
- `POST /api/documents/:id/extract-content` - Generic text extraction
- `POST /api/tenants/:id/update-from-document` - Apply extracted data
- `POST /api/collections/:id/extract-reference` - Extract payment reference

### 7. Backup & Recovery System (CRITICAL)
**Auto-Backup:**
- Trigger backup on every document upload
- Trigger backup on graceful shutdown (SIGTERM)
- Store backups in JSON format with base64-encoded BLOBs
- Backup directory: `backend/backups/`

**Auto-Recovery:**
- Check for recent backups on server startup
- Restore if database is empty or out of sync
- Deserialize base64 back to Buffer for BLOB storage
- Recovery function: `autoRecoverFromBackup()`

### 8. AI Predictions & Forecasts
- 3-month revenue forecasting
- Property-level occupancy predictions
- Year-end financial projections
- Risk analysis (late payments, expiring leases)
- Smart recommendations

### 9. Dashboard & Analytics
- Overview stats (properties, tenants, monthly rent, occupancy)
- Recent activity feed
- Collection rate visualization
- Rent status pie chart
- Monthly trend charts

## Technical Architecture

### Backend (Node.js/Express)
```javascript
// Key dependencies
- express, mysql2/promise, multer (memoryStorage)
- tesseract.js (OCR), pdf-parse, xlsx
- node-cron (scheduled tasks)
- graceful shutdown handlers (SIGTERM, SIGINT, uncaughtException)
```

**Critical Implementation Details:**
1. **Multer Configuration:** Use `memoryStorage()` NOT `diskStorage`
2. **Database Queries:** Use `?` placeholders with `pool.query()`
3. **File Downloads:** Set proper headers for Content-Type, Content-Length, Content-Disposition
4. **OCR Processing:** Use tesseract.js with `eng+osd` config
5. **Error Handling:** Always wrap async functions in try-catch

### Frontend (React + Vite)
```javascript
// Structure
- Single App.jsx with functional components
- React hooks: useState, useEffect, useCallback
- No external CSS libraries - use inline styles with CSS variables
- Recharts for charts, Lucide-style icons
```

**State Management Pattern:**
```javascript
// Each component manages its own state
const [items, setItems] = useState([]);      // Main data
const [modal, setModal] = useState(null);    // Add/Edit modal
const [docModal, setDocModal] = useState(null);  // Document modal
const [selectedFile, setSelectedFile] = useState(null);  // File upload
// Use separate state for different modals to avoid conflicts
```

### Database Schema (MySQL)

**Core Tables:**
```sql
-- Properties
CREATE TABLE properties (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), type ENUM('apartment','villa','commercial'), address TEXT, units INT, monthly_rent DECIMAL(10,2), status ENUM('active','inactive') DEFAULT 'active');

-- Tenants  
CREATE TABLE tenants (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), phone VARCHAR(20), email VARCHAR(255), aadhar_number VARCHAR(20), pan_number VARCHAR(20), emergency_contact VARCHAR(20), property_id INT, unit_number VARCHAR(50), lease_start DATE, lease_end DATE, security_deposit DECIMAL(10,2), status ENUM('active','inactive','notice') DEFAULT 'active', FOREIGN KEY (property_id) REFERENCES properties(id));

-- Collections (Rent Payments)
CREATE TABLE collections (id INT AUTO_INCREMENT PRIMARY KEY, tenant_id INT, property_id INT, amount DECIMAL(10,2), payment_date DATE, payment_method ENUM('upi','cash','bank_transfer','cheque'), category ENUM('rent','utilities','advance','maintenance','deposit','other'), month_year VARCHAR(20), status ENUM('paid','pending','partial','overdue'), reference_number VARCHAR(100), notes TEXT, FOREIGN KEY (tenant_id) REFERENCES tenants(id), FOREIGN KEY (property_id) REFERENCES properties(id));

-- Expenses
CREATE TABLE expenses (id INT AUTO_INCREMENT PRIMARY KEY, property_id INT, category ENUM('maintenance','utilities','taxes','insurance','repairs','cleaning','security','other'), description TEXT, amount DECIMAL(10,2), expense_date DATE, vendor VARCHAR(255), receipt_number VARCHAR(100), status ENUM('paid','pending') DEFAULT 'paid', FOREIGN KEY (property_id) REFERENCES properties(id));

-- General Ledger
CREATE TABLE general_ledger (id INT AUTO_INCREMENT PRIMARY KEY, entry_date DATE, entry_type ENUM('income','expense'), category VARCHAR(100), description TEXT, amount DECIMAL(12,2), gst_amount DECIMAL(12,2), tds_amount DECIMAL(12,2), net_amount DECIMAL(12,2), property_id INT, tenant_id INT, vendor VARCHAR(255), pan_number VARCHAR(20), gst_number VARCHAR(20), fy_year VARCHAR(10), quarter ENUM('Q1','Q2','Q3','Q4'), notes TEXT);

-- Document Tables (CRITICAL: file_content as LONGBLOB)
CREATE TABLE tenant_documents (id INT AUTO_INCREMENT PRIMARY KEY, tenant_id INT, filename VARCHAR(500), original_name VARCHAR(500), mime_type VARCHAR(100), file_size INT, file_content LONGBLOB, document_type ENUM('aadhar','pan','lease','agreement','id_proof','address_proof','other') DEFAULT 'other', description TEXT, uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE);

CREATE TABLE collection_documents (id INT AUTO_INCREMENT PRIMARY KEY, collection_id INT, filename VARCHAR(500), original_name VARCHAR(500), mime_type VARCHAR(100), file_size INT, file_content LONGBLOB, description TEXT, uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE);

CREATE TABLE expense_documents (id INT AUTO_INCREMENT PRIMARY KEY, expense_id INT, filename VARCHAR(500), original_name VARCHAR(500), mime_type VARCHAR(100), file_size INT, file_content LONGBLOB, description TEXT, uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE);
```

### Docker Configuration
```yaml
# docker-compose.yml structure
version: '3.8'
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rentalpass123
      MYSQL_DATABASE: rental_management
    volumes:
      - mysql_data:/var/lib/mysql  # CRITICAL for persistence
  
  backend:
    build: ./backend
    ports:
      - "5000:5000"
    volumes:
      - ./backend/backups:/app/backups  # For backup persistence
  
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"

volumes:
  mysql_data:  # Named volume for DB persistence
```

## Key Implementation Patterns

### 1. Document Upload Endpoint (CRITICAL)
```javascript
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() }); // NOT diskStorage

app.post('/api/tenants/:tenantId/documents', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  try {
    const [result] = await pool.query(
      `INSERT INTO tenant_documents (tenant_id, filename, original_name, mime_type, file_size, file_content, document_type, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, req.file.originalname, req.file.originalname, req.file.mimetype, 
       req.file.size, req.file.buffer, req.body.document_type || 'other', req.body.description || '']
    );
    
    // Trigger immediate backup
    createAutoBackup('document-upload');
    
    res.json({ id: result.insertId, message: 'Document uploaded successfully' });
  } catch (err) {
    console.error('[UPLOAD] Error:', err);
    res.status(500).json({ error: err.message });
  }
});
```

### 2. Document Download Endpoint (CRITICAL)
```javascript
app.get('/api/documents/:id/download', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT original_name, mime_type, file_size, file_content FROM tenant_documents WHERE id = ?',
      [req.params.id]
    );
    
    if (!rows.length) return res.status(404).json({ error: 'Document not found' });
    
    const doc = rows[0];
    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader('Content-Length', doc.file_size);
    res.setHeader('Content-Disposition', `inline; filename="${doc.original_name}"`);
    res.send(doc.file_content); // Send BLOB directly
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### 3. Backup System (CRITICAL)
```javascript
// Serialize BLOBs to base64 for JSON storage
const createAutoBackup = async (trigger = 'manual') => {
  const [tenantDocs] = await pool.query('SELECT * FROM tenant_documents');
  
  // Convert BLOBs to base64 for JSON serialization
  const serializedDocs = tenantDocs.map(doc => ({
    ...doc,
    file_content: doc.file_content ? doc.file_content.toString('base64') : null
  }));
  
  const backup = {
    timestamp: new Date().toISOString(),
    trigger,
    tables: { tenant_documents: serializedDocs, /* ... */ }
  };
  
  fs.writeFileSync(`/app/backups/backup-${Date.now()}.json`, JSON.stringify(backup));
};

// Deserialize base64 back to Buffer on restore
const autoRecoverFromBackup = async () => {
  // Read latest backup file
  const backup = JSON.parse(fs.readFileSync(latestBackupFile, 'utf8'));
  
  // Restore tenant_documents
  for (const doc of backup.tables.tenant_documents) {
    await pool.query(
      `INSERT INTO tenant_documents (id, tenant_id, filename, original_name, mime_type, file_size, file_content, document_type, description, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [doc.id, doc.tenant_id, doc.filename, doc.original_name, doc.mime_type, 
       doc.file_size, doc.file_content ? Buffer.from(doc.file_content, 'base64') : null,
       doc.document_type, doc.description, doc.uploaded_at]
    );
  }
};
```

### 4. Graceful Shutdown Handler (CRITICAL)
```javascript
const gracefulShutdown = async (signal) => {
  console.log(`[SHUTDOWN] Received ${signal}. Starting graceful shutdown...`);
  
  // Create backup before exit
  await createAutoBackup(signal);
  
  // Close server
  server.close(() => {
    console.log('[SHUTDOWN] Server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  console.error('[SHUTDOWN] Uncaught exception:', err);
  gracefulShutdown('uncaughtException');
});
```

## Common Pitfalls to Avoid

1. **DON'T use multer diskStorage** - Always use memoryStorage for BLOB storage
2. **DON'T use filesystem paths** - All files stored as BLOBs in database
3. **DON'T use created_at** - Use uploaded_at for document timestamps
4. **DON'T forget base64 encoding** - Required for JSON backup serialization of BLOBs
5. **DON'T forget Buffer conversion** - Convert base64 back to Buffer on restore
6. **DON'T use shared state** - Use separate state variables for different modals
7. **DON'T skip backup triggers** - Backup on every document upload and shutdown
8. **DON'T use HTTP for file links** - Use proper download endpoints with correct headers

## Testing Checklist

- [ ] Create property → appears in list
- [ ] Create tenant with document → document uploads successfully
- [ ] View tenant documents → files download correctly
- [ ] Restart Docker → data persists (MySQL volume)
- [ ] Restart backend → auto-recovery restores documents from backup
- [ ] OCR extract from Aadhar → data auto-fills tenant form
- [ ] Record rent payment with proof → both saved correctly
- [ ] All sections work consistently (Tenants, Collections, Expenses)

## Build Commands
```bash
docker-compose down -v  # Clean start (removes volumes)
docker-compose up -d --build  # Build and start all services
docker logs rental-backend --tail 50  # Check backend logs
docker logs rental-frontend --tail 50   # Check frontend logs
```
