# RentalManager

## Executive Summary

RentalManager is a full-stack rental property management application built for the Indian market. It features a React frontend with a Node.js/Express backend, MySQL database persistence, Docker containerization, and comprehensive property management capabilities including AI-powered rent recommendations, tax filing support, and document OCR processing.

**Technology Stack:**
- **Frontend:** React 18 + Vite, inline CSS (no external UI framework)
- **Backend:** Node.js + Express, MySQL2 (promise-based)
- **Database:** MySQL 8.0 with 14 tables
- **AI Integration:** Ollama (qwen2.5-coder:7b) for rent recommendations
- **OCR:** Tesseract.js for document text extraction
- **PDF Processing:** pdf-parse for PDF content extraction
- **Deployment:** Docker + Docker Compose

---

## 1. Core Application Architecture

### 1.1 Backend Server (`backend/server.js`)
**File Size:** 171KB (4,140 lines)
**Key Characteristics:**
- Single-file monolithic Express application
- MySQL connection pooling (limit: 10)
- CORS enabled for all origins
- Multer for in-memory file uploads (10MB limit)
- Transaction-based database operations
- Automatic backup/recovery system

**File Upload Configuration:**
```javascript
allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 
               'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
```

### 1.2 Frontend Application (`frontend/src/App.jsx`)
**File Size:** 224KB (3,867 lines)
**Key Characteristics:**
- Single-file React application with all components
- Custom SVG icon system (15 icons)
- CSS-in-JS styling with CSS variables
- No external component libraries
- Responsive grid layouts

### 1.3 Database Schema (`backend/schema.sql`)
**14 Tables:**
1. `properties` - Property listings
2. `tenants` - Tenant records with TDS support
3. `collections` - Rent payments
4. `expenses` - Property expenses
5. `tds_deposits` - TDS tracking (Section 194-IB)
6. `tenant_documents` - Tenant document storage (BLOB)
7. `collection_documents` - Payment proof storage
8. `expense_documents` - Expense receipt storage
9. `ledger_entries` - Accounting/tax ledger
10. `receipts` - Auto-generated rent receipts
11. `receipts_history` - Receipt audit trail
12. `tax_filings` - Income tax calculations
13. `tax_filing_properties` - Property-wise tax details

---

## 2. Feature Modules

### 2.1 Dashboard Module
**Backend Endpoint:** `GET /api/dashboard`

**Statistics Provided:**
- Total Properties count
- Total Tenants / Active Tenants
- Monthly Collection (current month)
- Monthly Expenses (current month)
- Net Income (collection - expenses)
- Pending Payments count

**Visualizations:**
- 6-month collection trend chart (MiniChart component)
- Recent collections table (5 records)
- Recent expenses list (5 records)

**Frontend Component:** `Dashboard()`

---

### 2.2 Properties Module

**Backend Endpoints:**
```
GET    /api/properties          - List all with tenant count
POST   /api/properties        - Create new property
PUT    /api/properties/:id    - Update property
DELETE /api/properties/:id     - Delete property
```

**Property Entity Fields:**
| Field | Type | Notes |
|-------|------|-------|
| id | INT | Auto-increment PK |
| name | VARCHAR(255) | Property name |
| address | TEXT | Full address |
| type | ENUM | apartment, house, villa, commercial |
| total_units | INT | Default: 1 |
| monthly_rent | DECIMAL(12,2) | Base rent amount |
| status | ENUM | active, inactive, maintenance |
| eb_service_number | VARCHAR | Electricity board ID |
| property_assessment_number | VARCHAR | Tax assessment ID |
| water_connection_number | VARCHAR | Water connection ID |
| patta_number | VARCHAR | Land title number |
| created_at | TIMESTAMP | Auto-set |

**Computed Field:** `tenant_count` (via JOIN query)

**Frontend Component:** `Properties()`
- Grid card layout (responsive)
- Modal-based add/edit form
- Badge display for type/status
- Stats panel (rent, units, tenants)

---

### 2.3 Tenants Module

**Backend Endpoints:**
```
GET    /api/tenants                    - List with property info
POST   /api/tenants                    - Create tenant
PUT    /api/tenants/:id                - Update tenant
DELETE /api/tenants/:id                - Delete tenant
GET    /api/tenants/:id/tds            - Get TDS deposits
POST   /api/tenants/:id/tds            - Record TDS deposit
POST   /api/tenants/:id/documents      - Upload document (multipart)
GET    /api/tenants/:id/documents      - List documents
POST   /api/tenants/:id/update-from-document - Apply OCR data
```

**Tenant Entity Fields:**
| Field | Type | Notes |
|-------|------|-------|
| id | INT | Auto-increment PK |
| name | VARCHAR(255) | Full name |
| email | VARCHAR(255) | Optional |
| phone | VARCHAR(20) | Required |
| aadhar_number | VARCHAR(20) | Indian ID format XXXX XXXX XXXX |
| pan_number | VARCHAR(20) | Indian tax ID format ABCDE1234F |
| emergency_contact | VARCHAR(20) | Phone number |
| property_id | INT | FK to properties |
| unit_number | VARCHAR(50) | Unit/flat number |
| start_date | DATE | Lease start |
| end_date | DATE | Lease end |
| security_deposit | DECIMAL(12,2) | Deposit amount |
| monthly_rent | DECIMAL(12,2) | Agreed rent |
| status | ENUM | active, inactive, notice |
| tds_applicable | BOOLEAN | Auto-calculated (rent > 50,000) |
| tds_rate | DECIMAL(5,2) | Default: 5.00% |
| tds_section | VARCHAR(20) | Default: 194-IB |

**Frontend Component:** `Tenants()`
- Data table with sorting/filtering
- Search by name, phone, Aadhar
- Tenure calculation (years/months remaining)
- Document management modal
- OCR extraction for Aadhar/PAN

---

### 2.4 Collections (Rent Payments) Module

**Backend Endpoints:**
```
GET    /api/collections                    - List with tenant/property info
POST   /api/collections                    - Create collection + ledger entry + receipt
PUT    /api/collections/:id                - Update with ledger sync
DELETE /api/collections/:id                - Delete with ledger cleanup
POST   /api/collections/:id/documents      - Upload payment proof
GET    /api/collections/:id/documents      - List payment proofs
POST   /api/collections/:id/extract-reference - Auto-extract UPI/ref number
POST   /api/collections/:id/ledger         - Manual ledger entry creation
```

**Collection Entity Fields:**
| Field | Type | Notes |
|-------|------|-------|
| id | INT | Auto-increment PK |
| tenant_id | INT | FK to tenants |
| property_id | INT | FK to properties |
| amount | DECIMAL(12,2) | Payment amount |
| payment_date | DATE | When paid |
| payment_method | ENUM | cash, upi, bank_transfer, cheque |
| category | ENUM | rent, utilities, advance, maintenance, deposit, other |
| month_year | VARCHAR(20) | Format: "March 2025" |
| status | ENUM | paid, pending, partial, overdue |
| notes | TEXT | Additional info |
| reference_number | VARCHAR(100) | Transaction ID |
| receipt_id | INT | FK to receipts (auto-generated) |

**Auto-Generated on Create:**
1. Ledger entry (income type, with GST/TDS calculations)
2. Receipt (if status=paid and category=rent)

**Payment Reference Extraction Patterns:**
- UPI: `/UPI[\/\s-]?(?:ref\.?|reference)?[\s:]?(\d{12,20})/i`
- NEFT/RTGS/IMPS: `/(?:NEFT|RTGS|IMPS)[\/\s-]?(?:ref)?[\s:]?(\d{10,20})/i`
- UTR: `/(?:UTR)[\s:]?(\d{10,20})/i`
- Cheque: `/(?:cheque|chq)[\s#:]?(\d{6,10})/i`

**Frontend Component:** `Collections()`
- Advanced filtering (tenant, status, month, FY, property)
- Payment proof upload modal
- Receipt generation trigger
- Financial year calculations

---

### 2.5 Expenses Module

**Backend Endpoints:**
```
GET    /api/expenses               - List with property info
POST   /api/expenses               - Create with ledger entry
PUT    /api/expenses/:id           - Update with ledger sync
DELETE /api/expenses/:id           - Delete with ledger cleanup
POST   /api/expenses/:id/documents - Upload receipt
GET    /api/expenses/:id/documents - List receipts
```

**Expense Entity Fields:**
| Field | Type | Notes |
|-------|------|-------|
| id | INT | Auto-increment PK |
| property_id | INT | FK to properties (nullable) |
| category | ENUM | maintenance, utilities, taxes, insurance, repairs, cleaning, security, other |
| description | VARCHAR(500) | Details |
| amount | DECIMAL(12,2) | Expense amount |
| expense_date | DATE | When incurred |
| vendor | VARCHAR(255) | Service provider |
| status | ENUM | paid, pending |
| receipt_number | VARCHAR(100) | External ref |

**Auto-Generated:** Ledger entry (expense type)

**Frontend Component:** `Expenses()`

---

### 2.6 TDS (Tax Deducted at Source) Module

**Section 194-IB Compliance:**
- Applies when monthly rent > ₹50,000
- TDS Rate: 5% (auto-calculated)
- Must be deposited monthly to government

**Backend Endpoints:**
```
GET /api/tenants/:id/tds    - Get deposits for tenant
POST /api/tenants/:id/tds   - Record deposit
GET /api/tds-report         - Summary across all tenants
```

**TDS Deposit Entity Fields:**
| Field | Type | Notes |
|-------|------|-------|
| id | INT | Auto-increment PK |
| tenant_id | INT | FK to tenants |
| property_id | INT | FK to properties |
| month_year | VARCHAR(20) | Format: "March 2025" |
| rent_amount | DECIMAL(12,2) | Original rent |
| tds_amount | DECIMAL(12,2) | Calculated TDS |
| tds_rate | DECIMAL(5,2) | Applied rate |
| status | ENUM | pending, deposited |
| deposit_date | DATE | When deposited |
| challan_number | VARCHAR(100) | Government challan |
| notes | TEXT | |

**Frontend Component:** Integrated in Tenants modal with warning banner when TDS applicable

---

### 2.7 Document Management Module

**Storage Strategy:** MySQL BLOB (not filesystem)
- Files stored as binary in `file_content` column
- Base64 encoding for JSON backup/restore
- 10MB file size limit

**Supported Document Types:**
- aadhar - Aadhar Card
- pan - PAN Card
- lease - Lease Agreement
- agreement - Rental Agreement
- id_proof - Other ID
- address_proof - Address verification
- other - Uncategorized

**Backend Endpoints:**
```
# Tenant Documents
POST   /api/tenants/:tenantId/documents     - Upload
GET    /api/tenants/:tenantId/documents     - List
DELETE /api/documents/:id                    - Delete
GET    /api/documents/:id/download          - View/Download
POST   /api/documents/:id/extract           - OCR extract (Aadhar/PAN)
POST   /api/documents/:id/extract-content   - Generic text extraction

# Collection Documents
POST   /api/collections/:collectionId/documents
GET    /api/collections/:collectionId/documents
DELETE /api/collection-documents/:id
GET    /api/collection-documents/:id/download

# Expense Documents
POST   /api/expenses/:expenseId/documents
GET    /api/expenses/:expenseId/documents
DELETE /api/expense-documents/:id
GET    /api/expense-documents/:id/download
```

**OCR Capabilities:**
- Aadhar: Extracts number (XXXX XXXX XXXX), DOB, name, address
- PAN: Extracts number (ABCDE1234F), name, DOB
- UPI/Bank: Extracts reference numbers from payment screenshots
- Uses Tesseract.js for images, pdf-parse for PDFs

---

### 2.8 Ledger (Tax Management) Module

**Purpose:** Automated accounting for GST/TDS/ITR compliance

**Backend Endpoints:**
```
GET /api/ledger                    - All entries with joins
POST /api/ledger                   - Manual entry
PUT /api/ledger/:id                - Update entry
DELETE /api/ledger/:id             - Delete entry
GET /api/ledger/summary/:fyYear    - FY summary by quarter
GET /api/ledger/calendar-summary/:year - Calendar year summary
GET /api/ledger/returns-filing/:year - GST/TDS/ITR data
```

**Ledger Entry Fields:**
| Field | Type | Notes |
|-------|------|-------|
| id | INT | Auto-increment PK |
| entry_date | DATE | Transaction date |
| entry_type | ENUM | income, expense |
| category | VARCHAR(50) | rent, maintenance, etc. |
| description | TEXT | Narration |
| amount | DECIMAL(12,2) | Gross amount |
| gst_amount | DECIMAL(12,2) | 18% for rent income |
| tds_amount | DECIMAL(12,2) | 10% for rent income |
| net_amount | DECIMAL(12,2) | amount - TDS |
| reference_id | INT | Links to collections/expenses |
| reference_type | ENUM | collection, expense |
| property_id | INT | FK |
| tenant_id | INT | FK |
| vendor | VARCHAR(255) | For expenses |
| pan_number | VARCHAR(20) | Tenant's PAN |
| gst_number | VARCHAR(20) | Vendor's GST |
| fy_year | VARCHAR(9) | Format: 2025-26 |
| quarter | ENUM | Q1, Q2, Q3, Q4 |

**Auto-Calculation Rules:**
- Income category 'rent': GST 18%, TDS 10%
- Other income: 0% GST/TDS
- Expenses: No GST/TDS by default

---

### 2.9 Income Tax Calculator Module

**Supports:** ITR-2 Form (House Property Income)

**Backend Endpoints:**
```
GET /api/tax/calculate/:assessmentYear          - Detailed calculation
GET /api/tax/calculate-financial-year/:fy       - FY based calculation
GET /api/tax/calculate-calendar-year/:year      - Calendar year calculation
POST /api/tax/filing                            - Save filing
GET /api/tax/filings                            - List filings
GET /api/tax/filing/:id                         - Get specific filing
```

**Tax Calculation (New Regime FY 2026-27):**
```
0 - 3,00,000: 0%
3,00,001 - 6,00,000: 5%
6,00,001 - 9,00,000: 10%
9,00,001 - 12,00,000: 15%
12,00,001 - 15,00,000: 20%
Above 15,00,000: 30%
+ 4% Health & Education Cess
```

**Deductions:**
- Standard Deduction: ₹50,000 (flat)
- Municipal Taxes: Actual paid
- Section 80C: User input

**Property Income Calculation:**
```
GAV (Gross Annual Value) = Higher of (Actual Rent, Expected Rent)
NAV (Net Annual Value) = GAV - Municipal Taxes
Standard Deduction = 30% of NAV
Income from House Property = NAV - Standard Deduction
```

**Frontend Component:** `TaxFiling()`

---

### 2.10 Receipts Module

**Auto-Generation:** Triggered when collection status=paid and category=rent

**Backend Endpoints:**
```
POST /api/receipts/generate          - Create for single collection
POST /api/receipts/generate-bulk     - Create for all collections in month
GET /api/receipts                    - List receipts
GET /api/receipts/:id                - Get receipt details
PUT /api/receipts/:id/status         - Update status (sent/viewed/downloaded)
DELETE /api/receipts/:id             - Delete receipt
POST /api/receipts/:id/send-email    - Email receipt
```

**Receipt Entity Fields:**
| Field | Type | Notes |
|-------|------|-------|
| id | INT | Auto-increment PK |
| receipt_number | VARCHAR(50) | Unique (RCPT-{timestamp}-{tenant_id}) |
| tenant_id | INT | FK |
| property_id | INT | FK |
| collection_id | INT | FK (nullable) |
| receipt_date | DATE | Generation date |
| month_year | VARCHAR(20) | Rent month |
| rent_amount | DECIMAL(12,2) | Principal |
| maintenance_amount | DECIMAL(12,2) | Add-on |
| utility_amount | DECIMAL(12,2) | Add-on |
| total_amount | DECIMAL(12,2) | Grand total |
| payment_method | ENUM | cash, upi, bank_transfer, cheque, online |
| payment_date | DATE | When paid |
| reference_number | VARCHAR(100) | Transaction ID |
| status | ENUM | generated, sent, viewed, downloaded |
| sent_date | DATE | When shared |
| receipt_content | TEXT | HTML/template |
| receipt_url | VARCHAR(500) | Public link |

**Frontend Component:** `Receipts()`
- Year/tenant/property filtering
- Download as text or PNG (canvas-based)
- Email sending (if tenant email available)
- WhatsApp integration (if phone valid)

---

### 2.11 Reports Module

**Backend Endpoint:** `GET /api/reports/profit-loss`

**Query Parameters:**
- startDate, endDate - Date range
- propertyId - Filter by property (or 'vilankurichi-all' for group)
- format - json (default), pdf, excel (not implemented)
- period - monthly (default)

**Report Output:**
```json
{
  "summary": {
    "total_income", "total_expenses", "net_profit", "profit_margin",
    "total_pending", "pending_count",
    "total_units", "occupied_units", "vacant_units", "occupancy_rate"
  },
  "income_breakdown": [{"category", "total", "count", "earliest_date", "latest_date"}],
  "expense_breakdown": [{"category", "total", "count", "earliest_date", "latest_date"}],
  "monthly_trends": [{"month", "income", "expenses"}],
  "pending_payments": [{"total_pending", "pending_count"}]
}
```

---

### 2.12 AI Recommendations Module

**Ollama Integration:**
- URL: `process.env.OLLAMA_URL || 'http://localhost:11434'`
- Model: `qwen2.5-coder:7b`
- Timeout: 60 seconds
- Cache TTL: 24 hours

**Backend Endpoint:** `GET /api/ai-recommendations`

**Logic:**
1. Identifies properties with <60% occupancy
2. Sends property details to Ollama
3. Parses JSON response for rent recommendations
4. Caches result for 24 hours

**Prompt Template:**
```
Rent expert. Property: {name}, {type}, {occupancy}% occupied, current ₹{rent}. 
Suggest new rent range in INR with reasoning. 
JSON: {"recommendedRentRange":"₹X-₹Y","reasoning":"brief","confidence":"high|medium|low","action":"increase|decrease|maintain"}
```

**Response Format:**
```json
{
  "loading": false,
  "recommendations": [{
    "type": "success|warning|info",
    "priority": "high|medium",
    "message": "📈 Property: AI suggests rent ₹X-₹Y. Reasoning...",
    "ai": true,
    "propertyId": 1,
    "aiData": { /* parsed Ollama response */ }
  }],
  "analyzedCount": 3,
  "ollamaConnected": true,
  "cached": false
}
```

---

### 2.13 Predictions & Forecasts Module

**Backend Endpoint:** `GET /api/predictions`

**Output:**
```json
{
  "summary": {
    "activeTenants": 10,
    "projectedMonthlyIncome": 150000,
    "averageCollectionRate": 85.5,
    "monthsOfHistory": 6,
    "total_units", "occupied_units", "vacant_units", "occupancy_rate"
  },
  "forecast": [{
    "month": "Apr",
    "year": 2025,
    "predictedIncome": 150000,
    "predictedExpenses": 25000,
    "predictedNet": 125000,
    "confidence": "high|medium|low"
  }],
  "propertyPredictions": [{
    "id", "name", "type",
    "occupancyRate", "projectedMonthlyIncome",
    "vacancyRisk": "high|medium|low"
  }],
  "yearEndProjections": {
    "projectedTotalIncome", "projectedTotalExpenses", "projectedNetIncome",
    "currentYearActuals": {"income", "expenses"},
    "remainingForecast": {"income", "expenses"}
  },
  "risks": {
    "latePayments": 2,
    "expiringLeases": 3,
    "expenseAlerts": [...]
  },
  "recommendations": [...]
}
```

**Pro-Rata Calculation:**
- New tenants pay proportionally based on move-in date
- Formula: `monthly_rent × (days_occupied / days_in_month)`

---

### 2.14 Backup & Recovery Module

**Automatic Backups:**
- Triggers: SIGTERM, SIGINT, uncaughtException, unhandledRejection, document upload
- Location: `backend/backups/`
- Format: JSON with base64-encoded BLOBs
- Retention: Last 3 backups only

**Backend Endpoints:**
```
GET /api/backup/export       - Download backup JSON
POST /api/backup/restore     - Restore from JSON (destructive)
GET /api/backup/list         - List available backups
```

**Auto-Recovery on Startup:**
1. Waits for database connection (30 retries, 2s interval)
2. Runs pending migrations
3. Checks for recent backup (<24 hours)
4. Compares backup vs database timestamps
5. Restores if backup is newer than database

**Migration System:**
- Checks `INFORMATION_SCHEMA.COLUMNS`
- Auto-renames old columns (lease_start→start_date)
- Logs to console with [MIGRATION] prefix

---

## 3. Frontend Navigation Structure

**Sidebar Pages (PAGES array):**
```javascript
[
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'properties', label: 'Properties', icon: 'building' },
  { id: 'tenants', label: 'Tenants', icon: 'users' },
  { id: 'collections', label: 'Collections', icon: 'rupee' },
  { id: 'expenses', label: 'Expenses', icon: 'expense' },
  { id: 'receipts', label: 'Receipts', icon: 'receipt' },
  { id: 'ledger', label: 'Ledger', icon: 'book' },
  { id: 'tax', label: 'Tax Filing', icon: 'calculator' },
  { id: 'reports', label: 'Reports', icon: 'report' },
  { id: 'predictions', label: 'Predictions', icon: 'chart' }
]
```

**UI Theme (CSS Variables):**
```javascript
'--bg': '#0f172a',
'--bg-secondary': '#1e293b',
'--card': '#1e293b',
'--text': '#f1f5f9',
'--text-secondary': '#94a3b8',
'--text-muted': '#64748b',
'--border': '#334155',
'--accent': '#06b6d4',
'--success': '#22c55e',
'--warning': '#f59e0b',
'--danger': '#ef4444',
```

---

## 4. Data Flow Patterns

### 4.1 Collection Creation Flow
1. User submits collection form
2. Backend begins transaction
3. Insert collection record
4. Get tenant details
5. Calculate GST (18%) and TDS (10%) if rent category
6. Create ledger entry (income type)
7. If status=paid and category=rent:
   - Generate receipt with unique number
   - Link receipt_id to collection
   - Log to receipts_history
8. Commit transaction
9. Return response with receipt info

### 4.2 Document Upload Flow
1. User selects file (<10MB)
2. Multer stores in memory buffer
3. File converted to MySQL BLOB
4. Document record created with metadata
5. Triggers automatic backup
6. Response returns document ID

### 4.3 OCR Extraction Flow
1. User clicks "Extract" on Aadhar/PAN document
2. Backend loads BLOB from database
3. Detects file type (PDF or image)
4. PDF: Uses pdf-parse
5. Image: Uses Tesseract.js OCR
6. Regex patterns extract structured data
7. Returns extracted + raw text
8. User reviews and applies to tenant

---

## 5. Configuration & Environment

**Environment Variables:**
```
# Database
DB_HOST=localhost|mysql (Docker)
DB_USER=root
DB_PASS=rentalpass123
DB_NAME=rental_db

# Backend
PORT=5000

# Frontend (Vite)
VITE_API_URL=http://localhost:5000/api

# AI (Optional)
OLLAMA_URL=http://localhost:11434
```

**Docker Services:**
```yaml
# docker-compose.yml
- mysql:3306
- backend:5000
- frontend:3000 (nginx)
```

---

## 6. Key Business Rules

### Rent Collection
- Monthly rent threshold for TDS: ₹50,000
- TDS Rate: 5% (Section 194-IB)
- Financial Year: April-March
- Receipt auto-generated only for: status=paid + category=rent

### Tax Calculation
- Standard Deduction: ₹50,000 (flat, new regime)
- Property Standard Deduction: 30% of NAV
- Cess: 4% on tax liability
- GST on rent income: 18% (in ledger calculations)

### Document Handling
- Max file size: 10MB
- Allowed: JPG, PNG, GIF, PDF, DOC, DOCX
- Storage: MySQL BLOB (not filesystem)
- Backup: Base64 encoded in JSON

---

## 7. Statistics & Calculations

### Dashboard Metrics
```javascript
netIncome = monthlyCollection - monthlyExpenses
occupancyRate = (activeTenants / totalProperties) × 100
collectionRate = (actualCollections / expectedRent) × 100
```

### Predictions
```javascript
proRatedRent = monthlyRent × (daysOccupied / daysInMonth)
seasonalExpenseAvg = sameMonthHistory.reduce(sum) / sameMonthHistory.length
```

### Tax
```javascript
// GAV = Higher of actual rent or expected annual rent
GAV = Math.max(actualRentCollected, expectedRent × 12)
NAV = GAV - municipalTaxes
standardDeduction30 = NAV × 0.30
incomeFromProperty = NAV - standardDeduction30
taxableIncome = incomeFromProperty - 50000 // standard deduction
```

---

## 8. Mobile Support

**Files:**
- `App.mobile.jsx` - Mobile-optimized version
- `main.mobile.jsx` - Mobile entry point
- Uses responsive CSS with media queries
- Touch-friendly button sizes

---

## 9. Development & Deployment

**Build Commands:**
```bash
# Development
cd backend && npm install && npm start
cd frontend && npm install && npm run dev

# Docker (Production)
docker-compose up -d --build

# Database migration
node backend/migrations/002_migrate_files_to_blob.js
```

**Port Mapping:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- MySQL: localhost:3306

---

## 10. Feature Completeness Matrix

| Feature | Status | Notes |
|---------|--------|-------|
| Property CRUD | ✅ Complete | With utility IDs |
| Tenant CRUD | ✅ Complete | With TDS logic |
| Rent Collection | ✅ Complete | Auto ledger + receipt |
| Expense Tracking | ✅ Complete | With categories |
| TDS Management | ✅ Complete | Section 194-IB |
| Document Upload | ✅ Complete | BLOB storage |
| OCR (Aadhar/PAN) | ✅ Complete | Tesseract.js |
| Payment Ref Extraction | ✅ Complete | Regex patterns |
| Ledger/Accounting | ✅ Complete | Auto-generated |
| Tax Calculator | ✅ Complete | ITR-2 support |
| Receipt Generation | ✅ Complete | Auto + Manual |
| Receipt Email | ✅ Complete | With validation |
| Receipt WhatsApp | ✅ Complete | Link generation |
| P&L Reports | ✅ Complete | With trends |
| AI Recommendations | ✅ Complete | Ollama integration |
| Predictions | ✅ Complete | 12-month forecast |
| Backup/Restore | ✅ Complete | Auto + Manual |
| Auto-Recovery | ✅ Complete | Startup check |
| Mobile UI | ✅ Complete | Responsive |
| GST Returns Filing | 🟡 Partial | Data only, no filing |
| PDF Export | 🟡 Planned | Returns data structure |
| Excel Export | 🟡 Planned | Returns data structure |

---

*Document generated by reverse engineering analysis*
*Date: May 2026*
*Application Version: 3.0_with_tax_receipts*
