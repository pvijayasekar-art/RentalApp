# RentFlow - Complete Application Generation Prompt

Use this consolidated prompt to regenerate the entire Rental Management System from scratch.

---

## System Overview

Build a comprehensive **Rental Property Management System** for the Indian market with the following name and branding:
- **Application Name:** RentFlow
- **Tagline:** "Property Manager"
- **Currency:** Indian Rupees (₹ INR)

The system must handle end-to-end rental operations: property management, tenant onboarding with KYC document processing, rent collection tracking, expense management, and automatic tax compliance (GST/TDS) ledger generation.

---

## Technology Stack

**Frontend:**
- React 18 with functional components and hooks
- Vite as build tool
- Single Page Application (SPA) architecture
- CSS-in-JS styling (inline styles in components)
- Dark theme UI (charcoal/carbon color scheme)
- DM Sans font family
- Lucide-style icons (create custom Icon component)

**Backend:**
- Node.js 20 with Express.js
- MySQL 8.0 with mysql2/promise
- Connection pooling (limit: 10)
- CORS enabled
- Multer for file uploads (10MB limit)
- Static file serving for uploads

**OCR & Document Processing:**
- Tesseract.js for image OCR
- pdf-parse for PDF text extraction

**Deployment:**
- Docker Compose with 3 services:
  - rental-mysql (MySQL 8.0)
  - rental-backend (Node.js API)
  - rental-frontend (React app)

---

## Database Schema

Create MySQL schema with 8 tables:

### 1. properties
```sql
id INT AUTO_INCREMENT PRIMARY KEY,
name VARCHAR(255) NOT NULL,
address TEXT NOT NULL,
type ENUM('apartment','house','commercial','villa') DEFAULT 'apartment',
total_units INT DEFAULT 1,
monthly_rent DECIMAL(12,2) NOT NULL,
status ENUM('active','inactive','maintenance') DEFAULT 'active',
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

### 2. tenants
```sql
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
```

### 3. collections
```sql
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
```

### 4. expenses
```sql
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
```

### 5. tenant_documents
```sql
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
```

### 6. collection_documents
```sql
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
```

### 7. expense_documents
```sql
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
```

### 8. ledger_entries
```sql
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
```

**Insert Sample Data:**
- 3 properties: Sunrise Apartments, Green Villa, Sharma Commercial
- 4 tenants with Indian names and valid Aadhar/PAN formats
- 6 collection records with various payment methods
- 5 expense records across different categories

---

## Backend API Requirements

### Core CRUD Endpoints
Create REST endpoints for all entities with proper error handling:

**Properties:**
- GET /api/properties - List with tenant counts
- POST /api/properties - Create
- PUT /api/properties/:id - Update
- DELETE /api/properties/:id - Delete

**Tenants:**
- GET /api/tenants - List with property names
- POST /api/tenants - Create
- PUT /api/tenants/:id - Update
- DELETE /api/tenants/:id - Delete

**Collections:**
- GET /api/collections - List with tenant/property details
- POST /api/collections - Create (with auto-ledger entry)
- PUT /api/collections/:id - Update (sync ledger)
- DELETE /api/collections/:id - Delete

**Expenses:**
- GET /api/expenses - List with property names
- POST /api/expenses - Create (with auto-ledger entry)
- PUT /api/expenses/:id - Update (sync ledger)
- DELETE /api/expenses/:id - Delete

**Ledger:**
- GET /api/ledger - List with property/tenant details
- POST /api/ledger - Create manual entry
- PUT /api/ledger/:id - Update
- DELETE /api/ledger/:id - Delete
- GET /api/ledger/summary/:fyYear - Tax summary by financial year

**Dashboard:**
- GET /api/dashboard - Aggregated stats, recent activity, monthly trends

### Document Upload Endpoints

**Tenant Documents:**
- POST /api/tenants/:tenantId/documents - Upload (multipart/form-data, field: 'file')
- GET /api/tenants/:tenantId/documents - List documents
- DELETE /api/documents/:id - Delete tenant document

**Collection Documents:**
- POST /api/collections/:collectionId/documents - Upload payment proof
- GET /api/collections/:collectionId/documents - List payment proofs
- DELETE /api/collection-documents/:id - Delete payment proof

**Expense Documents:**
- POST /api/expenses/:expenseId/documents - Upload receipt
- GET /api/expenses/:expenseId/documents - List receipts
- DELETE /api/expense-documents/:id - Delete receipt

### OCR & Extraction Endpoints

**Generic Text Extraction:**
- POST /api/documents/:id/extract-content
  - Check tenant_documents, collection_documents, expense_documents tables
  - For PDFs: use pdf-parse
  - For images: use Tesseract.js OCR
  - Return: { text, method, copyPaste, wordCount, charCount }
  - Handle scanned PDFs gracefully with error message

**Structured Data Extraction (Tenant Documents):**
- POST /api/documents/:id/extract
  - Extract from tenant_documents only
  - For Aadhar: extract name, DOB, Aadhar number, address
  - For PAN: extract name, DOB, PAN number
  - Return: { rawText, extracted: { name, dateOfBirth, aadharNumber, panNumber, address }, method }

**Apply Extracted Data:**
- POST /api/tenants/:id/update-from-document
  - Update tenant with extracted name, aadhar_number, pan_number

**Payment Reference Extraction:**
- POST /api/collections/:collectionId/extract-reference
  - Extract UPI reference, NEFT UTR, cheque numbers
  - Auto-update collection.reference_number if found
  - Return: { rawText, extractedReference, updated }

### Helper Functions

**Financial Year Calculation:**
```javascript
function getFinancialYear(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  if (month >= 4) return `${year}-${year + 1}`;
  return `${year - 1}-${year}`;
}
```

**Quarter Calculation:**
```javascript
function getQuarter(date) {
  const month = new Date(date).getMonth() + 1;
  if (month <= 3) return 'Q4';
  if (month <= 6) return 'Q1';
  if (month <= 9) return 'Q2';
  return 'Q3';
}
```

**Ledger Auto-Creation for Collections:**
- GST: 18% for rent category
- TDS: 10% for rent category
- Net: amount - TDS
- Auto-populate: fy_year, quarter, vendor (tenant name), pan_number

**Ledger Auto-Creation for Expenses:**
- No GST/TDS for expenses
- Net = amount
- Auto-populate: fy_year, quarter, vendor

---

## Frontend Requirements

### Layout & Navigation

**Sidebar Navigation (Fixed, 220px width):**
- Logo: Orange gradient (#f97316 to #ea580c) with home icon
- App name: "RentFlow" with "Property Manager" subtitle
- Navigation items: Dashboard, Properties, Tenants, Collections, Expenses, Ledger
- Active state: Orange background tint, orange text
- Footer: Version info, currency note

**Main Content Area:**
- Margin-left: 220px
- Padding: 32px
- Max-width: calc(100vw - 220px)

### Color Scheme

```css
:root {
  --bg: #0f1117;        /* Deep charcoal background */
  --card: #1a1d27;      /* Card background */
  --border: #2a2d3d;    /* Borders */
  --text: #e8eaf0;      /* Primary text */
  --muted: #6b7280;     /* Secondary text */
  --accent: #f97316;    /* Orange accent */
}
```

**Category Colors:**
- Rent/Income: #22c55e (green)
- Expenses: #ef4444 (red)
- Maintenance: #3b82f6 (blue)
- Utilities: #06b6d4 (cyan)
- Taxes: #f59e0b (amber)
- Insurance: #8b5cf6 (purple)

### Pages & Components

**1. Dashboard Page:**
- 4 stat cards: Properties, Tenants, Monthly Collection, Monthly Expenses
- Net income calculation
- Recent collections table (last 5)
- Recent expenses table (last 5)
- 6-month trend chart (simple bar/line visualization)

**2. Properties Page:**
- Header with "Add Property" button
- Table columns: Name, Address, Type, Units, Rent, Status, Occupancy, Actions
- Actions: Edit, Delete
- Modal: Add/Edit with form fields

**3. Tenants Page:**
- Header with "Add Tenant" button
- Table columns: Name, Property, Unit, Phone, Rent, Lease End, Status, Actions
- Actions: Edit, Documents (file icon), Delete
- Modal: Add/Edit with property picker (auto-fills rent)
- Document Modal: Upload, view, extract, delete documents
- Extract modal for Aadhar/PAN data review

**4. Collections Page:**
- Filter tabs: All, Paid, Pending, Partial, Overdue
- Table columns: Tenant, Property, Category, Month, Date, Method, Ref#, Amount, Status, Actions
- Actions: Edit, Payment Proof (file icon), Delete
- Modal: Record payment with tenant picker (auto-fills property and rent)
- Document Modal: Upload payment proof, extract reference number

**5. Expenses Page:**
- Header with "Add Expense" button
- Table columns: Category, Description, Property, Vendor, Date, Receipt#, Amount, Status, Actions
- Category badges with color coding
- Actions: Edit, Receipts (file icon), Delete
- Modal: Add/Edit expense with file upload
- Document Modal: Upload receipts, extract text

**6. Ledger Page:**
- 4 summary cards: Total Income, Total Expense, GST Collected, TDS Deducted
- Filter tabs: All Entries, Income, Expense
- Table columns: Date, Type, Category, Description, Amount, GST, TDS, Net, FY, Quarter, Actions
- Type badges: Green for income, red for expense
- "Tax Summary" button for FY reports

### Reusable Components

**Modal Component:**
- Dark overlay backdrop
- White text on dark card background
- Close button (X) in top-right
- Title in header
- Scrollable content area

**Form Components:**
- Input: Dark background, light border, orange focus ring
- Select: Styled dropdown with custom arrow
- Field label: Above input, muted color
- Buttons: Primary (orange), Secondary (gray), Danger (red)

**Badge Component:**
- Status badges: Paid (green), Pending (amber), Overdue (red), etc.
- Category badges with category-specific colors

**Icon Component:**
Custom Icon component with name prop supporting:
- dashboard, building, users, rupee, expense, file, home
- plus, edit, trash, file-text, check, x, search
- Size and color props

### Document Handling UI

**Document Upload:**
- File input with custom styling
- Selected file preview (name, size)
- Document type dropdown for tenant documents
- Upload button (disabled until file selected)

**Document List:**
- File name (bold)
- Size and upload date (muted)
- Actions: Extract Text, View (link), Delete (trash icon)
- For tenant documents: Show Extract button for Aadhar/PAN types
- For all documents: Show Extract Text button for generic OCR

**Extract Text Modal:**
- Textarea with extracted content
- Copy to Clipboard button
- Word and character count display

**Extract Data Modal (Tenants):**
- Form fields pre-filled with extracted data
- Raw text display (collapsible)
- Apply to Tenant button
- Cancel button

---

## Document Upload & OCR System

**File Upload Configuration:**
- Storage: Disk storage with unique filenames (doc-timestamp-random.ext)
- Path: /uploads/documents/
- Max size: 10MB
- Allowed types: image/jpeg, image/png, image/gif, application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document

**OCR Implementation:**

1. **Text-based PDFs:**
   - Use pdf-parse library
   - Extract selectable text directly
   - Handle scanned PDFs with graceful error

2. **Images:**
   - Use Tesseract.js with English language pack
   - Create worker, recognize, terminate
   - Return extracted text

3. **Text Cleaning:**
   - Remove excessive newlines (\n{3,} → \n\n)
   - Normalize spaces ([ \t]+ → single space)
   - Trim whitespace

**Document Type Parsing:**

**Aadhar Card Patterns:**
- Aadhar number: \d{4}\s?\d{4}\s?\d{4} → format as XXXX XXXX XXXX
- DOB: \d{2}[\/\-]\d{2}[\/\-]\d{4}
- Name: Look for "Name" keyword followed by capitalized words
- Address: Multi-line text after "Address" keyword

**PAN Card Patterns:**
- PAN number: [A-Z]{5}\d{4}[A-Z]
- Name: Text after "Name" or "Father's Name"
- DOB: Date pattern matching

**Payment Reference Patterns:**
- UPI: UPI[\/\s-]?(\d{12,20})
- NEFT/RTGS/IMPS: (NEFT|RTGS|IMPS)[\/\s-]?(\d{10,20})
- UTR: UTR[\s:]?(\d{10,20})
- Cheque: (cheque|chq)[\s#:]?(\d{6,10})

---

## Automatic Backup & Recovery System

**Backup Triggers:**
- process.on('SIGTERM')
- process.on('SIGINT')
- process.on('uncaughtException')
- process.on('unhandledRejection')
- process.on('beforeExit')

**Backup Process:**
1. Query all tables: properties, tenants, collections, expenses, tenant_documents, collection_documents, expense_documents, ledger_entries
2. Convert to JSON format
3. Save to ./backups/ folder
4. Filename format: auto-backup-{reason}-{timestamp}.json

**Recovery Process:**
1. On startup, check ./backups/ folder
2. Find latest backup (< 24 hours old)
3. If found: truncate all tables, restore from JSON
4. If not found or stale: proceed with empty database

**Docker Volume:**
- Mount ./backups to /app/backups in container
- Ensures persistence across container restarts

---

## Docker Compose Configuration

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

---

## File Structure

```
RentalManager/
├── docker-compose.yml
├── .env.example
├── DOCUMENTATION.md
├── SPEAKER_NOTES.md
├── PROMPT.md (this file)
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
        ├── App.jsx (main application file)
        ├── main.jsx
        └── index.html
```

---

## Development Guidelines

**Code Style:**
- Use async/await for all asynchronous operations
- Consistent error handling with try/catch
- JSON responses for all API endpoints
- Proper HTTP status codes (200, 201, 400, 404, 500)

**Frontend Patterns:**
- useState for component state
- useEffect for data loading
- useCallback for memoized functions
- Single file for all components (App.jsx)
- Inline styles with JavaScript objects

**Database:**
- Always use parameterized queries
- Foreign key constraints with CASCADE or SET NULL
- Timestamps for audit trails
- DECIMAL for monetary values

**Security:**
- File type validation by MIME type
- File size limits
- No SQL injection (parameterized queries)
- Self-hosted (no cloud dependencies)

---

## Testing Checklist

After generation, verify:

- [ ] Docker compose builds successfully
- [ ] All containers start without errors
- [ ] Database initializes with sample data
- [ ] Frontend loads at http://localhost:3000
- [ ] API responds at http://localhost:5000/api/dashboard
- [ ] File upload works for all three document types
- [ ] OCR extracts text from images
- [ ] PDF text extraction works
- [ ] Reference number extraction works on payment proofs
- [ ] Aadhar/PAN data extraction works
- [ ] Ledger entries auto-create on collection/expense
- [ ] Tax summary API returns correct data
- [ ] Backup file generates on shutdown
- [ ] Auto-recovery works on startup

---

## Deployment Commands

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

*Use this prompt with an AI coding assistant to regenerate the complete RentFlow application.*
