# RentFlow - Rental Management System

## Complete Application Documentation

---

## 1. System Overview

**RentFlow** is a comprehensive rental property management system designed for the Indian market with GST/TDS compliance.

**Core Modules:**
- Property Management
- Tenant Onboarding with KYC Document Processing
- Rent Collection Tracking with Payment Proof
- Expense Management with Receipts
- Tax Compliance Ledger (GST/TDS)
- Document OCR & Text Extraction

---

## 2. Technology Stack

**Frontend:**
- React 18 (Functional Components + Hooks)
- Vite Build Tool
- Single Page Application (SPA)
- CSS-in-JS Styling (Inline Styles)
- Dark Theme UI (Charcoal/Carbon)
- DM Sans Font Family
- Custom SVG Icons

**Backend:**
- Node.js 20 + Express.js
- MySQL 8.0 with mysql2/promise
- Connection Pooling (limit: 10)
- Multer for File Uploads (10MB limit)
- CORS enabled

**OCR & Document Processing:**
- Tesseract.js (Image OCR)
- pdf-parse (PDF text extraction)

**Deployment:**
- Docker Compose (3 services)
- MySQL, Node.js API, React Frontend

---

## 3. Database Schema

### 3.1 Properties
```sql
CREATE TABLE properties (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  type ENUM('apartment','house','commercial','villa') DEFAULT 'apartment',
  total_units INT DEFAULT 1,
  monthly_rent DECIMAL(12,2) NOT NULL,
  status ENUM('active','inactive','maintenance') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3.2 Tenants
```sql
CREATE TABLE tenants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20) NOT NULL,
  aadhar_number VARCHAR(20),
  pan_number VARCHAR(20),
  emergency_contact VARCHAR(20),
  property_id INT,
  unit_number VARCHAR(50),
  lease_start DATE,
  lease_end DATE,
  security_deposit DECIMAL(12,2) DEFAULT 0,
  status ENUM('active','inactive','notice') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL
);
```

### 3.3 Collections
```sql
CREATE TABLE collections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  property_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method ENUM('cash','upi','bank_transfer','cheque') DEFAULT 'cash',
  category ENUM('rent','utilities','advance','maintenance','deposit','other') DEFAULT 'rent',
  month_year VARCHAR(20) NOT NULL,
  status ENUM('paid','pending','partial','overdue') DEFAULT 'paid',
  notes TEXT,
  reference_number VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);
```

### 3.4 Expenses
```sql
CREATE TABLE expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT,
  category ENUM('maintenance','utilities','taxes','insurance','repairs','cleaning','security','other') DEFAULT 'maintenance',
  description VARCHAR(500) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  expense_date DATE NOT NULL,
  vendor VARCHAR(255),
  status ENUM('paid','pending') DEFAULT 'paid',
  receipt_number VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL
);
```

### 3.5 Tenant Documents
```sql
CREATE TABLE tenant_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  file_size INT,
  file_path VARCHAR(500) NOT NULL,
  document_type ENUM('aadhar','pan','lease','agreement','id_proof','address_proof','other') DEFAULT 'other',
  description TEXT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
```

### 3.6 Collection Documents (Payment Proof)
```sql
CREATE TABLE collection_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  collection_id INT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  file_size INT,
  file_path VARCHAR(500) NOT NULL,
  description TEXT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);
```

### 3.7 Expense Documents (Receipts)
```sql
CREATE TABLE expense_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  expense_id INT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  file_size INT,
  file_path VARCHAR(500) NOT NULL,
  description TEXT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE
);
```

### 3.8 Ledger Entries (Tax Management)
```sql
CREATE TABLE ledger_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entry_date DATE NOT NULL,
  entry_type ENUM('income','expense') NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  gst_amount DECIMAL(12,2) DEFAULT 0,
  tds_amount DECIMAL(12,2) DEFAULT 0,
  net_amount DECIMAL(12,2) NOT NULL,
  reference_id INT,
  reference_type ENUM('collection','expense') NULL,
  property_id INT,
  tenant_id INT,
  vendor VARCHAR(255),
  pan_number VARCHAR(20),
  gst_number VARCHAR(20),
  fy_year VARCHAR(9),
  quarter ENUM('Q1','Q2','Q3','Q4'),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
);
```

---

## 4. API Reference

### 4.1 Dashboard
```
GET /api/dashboard
Response: {
  stats: { totalProperties, totalTenants, activeTenants, monthlyCollection, monthlyExpenses, pendingRent, netIncome },
  recentCollections: [...],
  recentExpenses: [...],
  monthlyTrend: [...]
}
```

### 4.2 Properties
```
GET    /api/properties        # List all with tenant counts
POST   /api/properties        # Create property
PUT    /api/properties/:id    # Update property
DELETE /api/properties/:id    # Delete property
```

### 4.3 Tenants
```
GET    /api/tenants              # List all with property names
POST   /api/tenants              # Create tenant
PUT    /api/tenants/:id          # Update tenant
DELETE /api/tenants/:id          # Delete tenant
GET    /api/tenants/:id/documents # List tenant documents
POST   /api/tenants/:id/documents # Upload tenant document
```

### 4.4 Collections
```
GET    /api/collections              # List all with details
POST   /api/collections              # Create + auto-ledger entry
PUT    /api/collections/:id          # Update + sync ledger
DELETE /api/collections/:id          # Delete + delete linked ledger
GET    /api/collections/:id/documents # List payment proofs
POST   /api/collections/:id/documents # Upload payment proof
POST   /api/collections/:id/extract-reference # Extract payment ref
```

### 4.5 Expenses
```
GET    /api/expenses              # List all with property names
POST   /api/expenses              # Create + auto-ledger entry
PUT    /api/expenses/:id           # Update + sync ledger
DELETE /api/expenses/:id           # Delete + delete linked ledger
GET    /api/expenses/:id/documents # List receipts
POST   /api/expenses/:id/documents # Upload receipt
```

### 4.6 Ledger
```
GET    /api/ledger                  # List all entries
POST   /api/ledger                   # Create manual entry
PUT    /api/ledger/:id               # Update entry
DELETE /api/ledger/:id               # Delete entry
GET    /api/ledger/summary/:fyYear   # Tax summary by FY
GET    /api/ledger/calendar-summary/:year # Summary by calendar year
```

### 4.7 Document OCR
```
POST /api/documents/:id/extract-content  # Extract text for copy-paste
POST /api/documents/:id/extract          # Extract structured data (Aadhar/PAN)
POST /api/tenants/:id/update-from-document # Apply extracted data to tenant
```

### 4.8 Backup
```
GET    /api/backup/export    # Export all data as JSON
POST   /api/backup/restore   # Restore from JSON
GET    /api/backup/list      # List available backups
```

---

## 5. Document Upload & OCR

### 5.1 File Upload Configuration
- **Max Size:** 10MB
- **Storage Path:** `/uploads/documents/`
- **Allowed Types:**
  - Images: JPEG, PNG, GIF
  - Documents: PDF, DOC, DOCX

### 5.2 OCR Capabilities

**Text-based PDFs:**
- Uses `pdf-parse` library
- Extracts selectable text directly

**Images (JPG/PNG):**
- Uses Tesseract.js with English language pack
- Creates worker, recognizes text, terminates worker

**Text Cleaning:**
- Removes excessive newlines (`\n{3,}` → `\n\n`)
- Normalizes spaces (`[ \t]+` → single space)
- Trims whitespace

### 5.3 Document Type Parsing

**Aadhar Card:**
- Number pattern: `\d{4}\s?\d{4}\s?\d{4}`
- DOB pattern: `\d{2}[\/\-]\d{2}[\/\-]\d{4}`
- Name: After "Name" keyword
- Address: Multi-line after "Address"

**PAN Card:**
- Number pattern: `[A-Z]{5}\d{4}[A-Z]`
- Name: After "Name" or "Father's Name"
- DOB: Date pattern matching

**Payment Reference:**
- UPI: UPI ref numbers (12-20 digits)
- NEFT/RTGS/IMPS: UTR numbers (10-20 digits)
- Cheque: 6-10 digit numbers

---

## 6. Ledger Auto-Creation & Sync

### 6.1 Collections → Ledger (Income)
**On Create:**
- Auto-creates income ledger entry
- GST: 18% for rent category
- TDS: 10% for rent category
- Net: Amount - TDS
- Populates: fy_year, quarter, vendor (tenant name), pan_number

**On Update:**
- Finds existing ledger by reference_id + reference_type
- Updates all fields (amount, GST, TDS, dates, etc.)
- Creates new ledger if not exists

**On Delete:**
- Deletes linked ledger entry (reference_id=collection_id, reference_type='collection')
- Deletes collection record

### 6.2 Expenses → Ledger (Expense)
**On Create:**
- Auto-creates expense ledger entry
- No GST/TDS for expenses
- Net = Amount
- Populates: fy_year, quarter, vendor

**On Update:**
- Finds existing ledger by reference_id + reference_type
- Updates all fields
- Creates new ledger if not exists

**On Delete:**
- Deletes linked ledger entry (reference_id=expense_id, reference_type='expense')
- Deletes expense record

---

## 7. Automatic Backup & Recovery

### 7.1 Backup Triggers
- SIGTERM (graceful shutdown)
- SIGINT (Ctrl+C)
- uncaughtException
- unhandledRejection
- beforeExit

### 7.2 Backup Process
1. Query all 8 tables
2. Convert to JSON format
3. Save to `./backups/` folder
4. Filename: `auto-backup-{reason}-{timestamp}.json`

### 7.3 Recovery Process
1. On startup, check `./backups/` folder
2. Find latest backup (< 24 hours old)
3. If found: truncate all tables, restore from JSON
4. If not found or stale: proceed with empty database

### 7.4 Docker Volume
- Backups folder mounted as Docker volume
- Persists across container restarts

---

## 8. Frontend Components

### 8.1 Layout Structure
```
┌─────────────────────────────────────────┐
│  Sidebar (220px fixed)                │
│  ├── Logo (RentFlow)                    │
│  ├── Navigation                         │
│  │   ├── Dashboard                      │
│  │   ├── Properties                     │
│  │   ├── Tenants                        │
│  │   ├── Collections                    │
│  │   ├── Expenses                       │
│  │   └── Ledger                         │
│  └── Footer (Version)                  │
│                                         │
│  Main Content (calc(100vw - 220px))     │
│  └── Page-specific content              │
└─────────────────────────────────────────┘
```

### 8.2 Color Scheme
```css
:root {
  --bg: #0f1117;        /* Deep charcoal */
  --card: #1a1d27;      /* Card background */
  --border: #2a2d3d;    /* Borders */
  --text: #e8eaf0;      /* Primary text */
  --muted: #6b7280;     /* Secondary text */
  --accent: #f97316;    /* Orange accent */
}
```

### 8.3 Reusable Components
- **Modal:** Dark overlay, scrollable content, close button
- **Form Fields:** Dark inputs, orange focus ring
- **Badges:** Status/category with color coding
- **Stat Cards:** 6-column grid, icon + value + label
- **Tables:** Sortable headers, action buttons

---

## 9. Calendar System Functions

### 9.1 Helper Functions (Frontend)
```javascript
// Get current year as string
const getCurrentYear = () => new Date().getFullYear().toString();

// Get current month/year (e.g., "April 2025")
const getCurrentMonthYear = () => {
  return new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

// Get current financial year (Indian FY: April-March)
const getCurrentFinancialYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 4) return `${year}-${year + 1}`;
  return `${year - 1}-${year}`;
};

// Get current quarter
const getCurrentQuarter = () => {
  const month = new Date().getMonth() + 1;
  if (month <= 3) return 'Q4';
  if (month <= 6) return 'Q1';
  if (month <= 9) return 'Q2';
  return 'Q3';
};
```

---

## 10. Docker Deployment

### 10.1 Docker Compose Configuration
```yaml
version: '3.8'
services:
  mysql:
    image: mysql:8.0
    container_name: rental-mysql
    environment:
      MYSQL_ROOT_PASSWORD: password
      MYSQL_DATABASE: rental_db
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]

  backend:
    build: ./backend
    container_name: rental-backend
    environment:
      DB_HOST: mysql
      DB_USER: root
      DB_PASS: password
      DB_NAME: rental_db
      PORT: 5000
    ports:
      - "5000:5000"
    volumes:
      - ./backups:/app/backups
      - uploads_data:/app/uploads
    depends_on:
      mysql:
        condition: service_healthy

  frontend:
    build: ./frontend
    container_name: rental-frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  mysql_data:
  uploads_data:
```

### 10.2 Commands
```bash
# Start all services
docker-compose up --build -d

# View logs
docker logs rental-backend
docker logs rental-frontend
docker logs rental-mysql

# Restart specific service
docker-compose restart frontend

# Stop all
docker-compose down

# Reset database (WARNING: deletes all data)
docker-compose down -v
docker-compose up --build -d
```

---

## 11. File Structure

```
RentalManager/
├── docker-compose.yml
├── .env.example
├── DOCUMENTATION.md
├── backups/
│   └── (auto-generated JSON backups)
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── schema.sql
│   ├── server.js
│   └── uploads/documents/
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx (main application)
        ├── main.jsx
        └── index.html
```

---

## 12. Testing Checklist

After deployment, verify:

- [ ] Docker compose builds successfully
- [ ] All containers start without errors
- [ ] Database initializes with sample data
- [ ] Frontend loads at http://localhost:3000
- [ ] API responds at http://localhost:5000/api/dashboard
- [ ] File upload works for all document types
- [ ] OCR extracts text from images
- [ ] PDF text extraction works
- [ ] Reference number extraction works on payment proofs
- [ ] Aadhar/PAN data extraction works
- [ ] Ledger entries auto-create on collection/expense
- [ ] Ledger entries update when collection/expense updated
- [ ] Ledger entries delete when collection/expense deleted
- [ ] Tax summary API returns correct data
- [ ] Backup file generates on shutdown
- [ ] Auto-recovery works on startup

---

## 13. Sample API Calls

### Create Tenant with Document
```bash
# Create tenant
curl -X POST http://localhost:5000/api/tenants \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo","phone":"9876543210","property_id":1}'

# Upload Aadhar
curl -X POST http://localhost:5000/api/tenants/5/documents \
  -F "file=@aadhar.pdf" -F "document_type=aadhar"

# Extract data
curl -X POST http://localhost:5000/api/documents/6/extract
```

### Record Payment with Proof
```bash
# Create collection (auto-creates ledger)
curl -X POST http://localhost:5000/api/collections \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":1,"amount":18000,"payment_method":"upi"}'

# Upload payment proof
curl -X POST http://localhost:5000/api/collections/10/documents \
  -F "file=@upi_screenshot.png"

# Extract reference
curl -X POST http://localhost:5000/api/collections/10/extract-reference
```

### Get Tax Summary
```bash
curl http://localhost:5000/api/ledger/summary/2025-2026
```

---

## 14. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| DB_HOST | mysql | MySQL host |
| DB_USER | root | MySQL username |
| DB_PASS | password | MySQL password |
| DB_NAME | rental_db | Database name |
| PORT | 5000 | API server port |

---

*Documentation for RentFlow v1.0 - Complete Rental Management System*
