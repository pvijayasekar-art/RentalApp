# RentFlow - Rental Management System

## Documentation

---

## Table of Contents

1. [Database Schema](#database-schema)
2. [API Reference](#api-reference)
3. [Document Upload & OCR](#document-upload--ocr)
4. [File Upload Limits](#file-upload-limits)

---

## Database Schema

### Overview

Database: `rental_db`  
Engine: MySQL 8.0+

### Tables

#### 1. properties
Stores property/real estate information.

| Column | Type | Description |
|--------|------|-------------|
| id | INT (PK) | Auto-increment primary key |
| name | VARCHAR(255) | Property name |
| address | TEXT | Full address |
| type | ENUM | `apartment`, `house`, `commercial`, `villa` |
| total_units | INT | Number of units (default: 1) |
| monthly_rent | DECIMAL(12,2) | Base rent amount |
| status | ENUM | `active`, `inactive`, `maintenance` |
| created_at | TIMESTAMP | Auto-generated |

**Sample Data:**
```sql
INSERT INTO properties (name, address, type, total_units, monthly_rent, status) VALUES
('Sunrise Apartments', '12, MG Road, Bengaluru', 'apartment', 8, 18000.00, 'active');
```

---

#### 2. tenants
Stores tenant information linked to properties.

| Column | Type | Description |
|--------|------|-------------|
| id | INT (PK) | Auto-increment primary key |
| name | VARCHAR(255) | Tenant full name |
| email | VARCHAR(255) | Email address |
| phone | VARCHAR(20) | Phone number |
| aadhar_number | VARCHAR(20) | Aadhar ID (12 digits) |
| pan_number | VARCHAR(20) | PAN number (ABCDE1234F) |
| emergency_contact | VARCHAR(20) | Emergency phone |
| property_id | INT (FK) | References `properties.id` |
| unit_number | VARCHAR(50) | Unit identifier (e.g., A-101) |
| lease_start | DATE | Lease start date |
| lease_end | DATE | Lease end date |
| security_deposit | DECIMAL(12,2) | Security deposit amount |
| status | ENUM | `active`, `inactive`, `notice` |
| created_at | TIMESTAMP | Auto-generated |

**Sample Data:**
```sql
INSERT INTO tenants (name, email, phone, aadhar_number, pan_number, 
  property_id, unit_number, lease_start, lease_end, security_deposit, status) 
VALUES
('Rajesh Kumar', 'rajesh.k@email.com', '9876543210', '2345 6789 0123', 
  'ABCPK1234D', 1, 'A-101', '2024-01-01', '2025-12-31', 36000.00, 'active');
```

---

#### 3. collections
Stores rent payments and collections from tenants.

| Column | Type | Description |
|--------|------|-------------|
| id | INT (PK) | Auto-increment primary key |
| tenant_id | INT (FK) | References `tenants.id` |
| property_id | INT (FK) | References `properties.id` |
| amount | DECIMAL(12,2) | Payment amount |
| payment_date | DATE | Date of payment |
| payment_method | ENUM | `cash`, `upi`, `bank_transfer`, `cheque` |
| category | ENUM | `rent`, `utilities`, `advance`, `maintenance`, `deposit`, `other` |
| month_year | VARCHAR(20) | Billing period (e.g., "March 2025") |
| status | ENUM | `paid`, `pending`, `partial`, `overdue` |
| notes | TEXT | Additional notes |
| reference_number | VARCHAR(100) | Payment reference (UPI/Transaction ID) |
| created_at | TIMESTAMP | Auto-generated |

**Sample Data:**
```sql
INSERT INTO collections (tenant_id, property_id, amount, payment_date, 
  payment_method, category, month_year, status, reference_number) 
VALUES
(1, 1, 18000.00, '2025-03-05', 'upi', 'rent', 'March 2025', 'paid', 'UPI20250305001');
```

---

#### 4. expenses
Tracks property-related expenses.

| Column | Type | Description |
|--------|------|-------------|
| id | INT (PK) | Auto-increment primary key |
| property_id | INT (FK) | References `properties.id` (nullable) |
| category | ENUM | `maintenance`, `utilities`, `taxes`, `insurance`, `repairs`, `cleaning`, `security`, `other` |
| description | VARCHAR(500) | Expense description |
| amount | DECIMAL(12,2) | Expense amount |
| expense_date | DATE | Date of expense |
| vendor | VARCHAR(255) | Vendor/payee name |
| status | ENUM | `paid`, `pending` |
| receipt_number | VARCHAR(100) | Receipt/invoice reference |
| created_at | TIMESTAMP | Auto-generated |

**Sample Data:**
```sql
INSERT INTO expenses (property_id, category, description, amount, expense_date, vendor, status) 
VALUES
(1, 'maintenance', 'Elevator servicing', 8500.00, '2025-03-15', 'Otis Elevator', 'paid');
```

---

#### 5. tenant_documents
Stores uploaded documents for tenants (Aadhar, PAN, Lease, etc.).

| Column | Type | Description |
|--------|------|-------------|
| id | INT (PK) | Auto-increment primary key |
| tenant_id | INT (FK) | References `tenants.id` |
| filename | VARCHAR(255) | Stored filename (unique) |
| original_name | VARCHAR(255) | Original uploaded filename |
| mime_type | VARCHAR(100) | File MIME type |
| file_size | INT | File size in bytes |
| file_path | VARCHAR(500) | Full file path on server |
| document_type | ENUM | `aadhar`, `pan`, `lease`, `agreement`, `id_proof`, `address_proof`, `other` |
| description | TEXT | Document description |
| uploaded_at | TIMESTAMP | Auto-generated |

---

#### 6. collection_documents
Stores payment proof documents for collections.

| Column | Type | Description |
|--------|------|-------------|
| id | INT (PK) | Auto-increment primary key |
| collection_id | INT (FK) | References `collections.id` |
| filename | VARCHAR(255) | Stored filename |
| original_name | VARCHAR(255) | Original filename |
| mime_type | VARCHAR(100) | File MIME type |
| file_size | INT | File size in bytes |
| file_path | VARCHAR(500) | Full file path |
| description | TEXT | Document description |
| uploaded_at | TIMESTAMP | Auto-generated |

---

#### 7. expense_documents
Stores receipt/bill documents for expenses.

| Column | Type | Description |
|--------|------|-------------|
| id | INT (PK) | Auto-increment primary key |
| expense_id | INT (FK) | References `expenses.id` |
| filename | VARCHAR(255) | Stored filename |
| original_name | VARCHAR(255) | Original filename |
| mime_type | VARCHAR(100) | File MIME type |
| file_size | INT | File size in bytes |
| file_path | VARCHAR(500) | Full file path |
| description | TEXT | Document description |
| uploaded_at | TIMESTAMP | Auto-generated |

---

#### 8. ledger_entries
Tax and accounting ledger with GST/TDS tracking.

| Column | Type | Description |
|--------|------|-------------|
| id | INT (PK) | Auto-increment primary key |
| entry_date | DATE | Transaction date |
| entry_type | ENUM | `income`, `expense` |
| category | VARCHAR(50) | Transaction category |
| description | TEXT | Entry description |
| amount | DECIMAL(12,2) | Gross amount |
| gst_amount | DECIMAL(12,2) | GST amount (default: 0) |
| tds_amount | DECIMAL(12,2) | TDS deducted (default: 0) |
| net_amount | DECIMAL(12,2) | Net after TDS |
| reference_id | INT | Linked collection/expense ID |
| reference_type | ENUM | `collection`, `expense` or NULL |
| property_id | INT (FK) | References `properties.id` |
| tenant_id | INT (FK) | References `tenants.id` |
| vendor | VARCHAR(255) | Vendor/tenant name |
| pan_number | VARCHAR(20) | PAN for TDS tracking |
| gst_number | VARCHAR(20) | GST registration number |
| fy_year | VARCHAR(9) | Financial year (2025-2026) |
| quarter | ENUM | `Q1`, `Q2`, `Q3`, `Q4` |
| notes | TEXT | Additional notes |
| created_at | TIMESTAMP | Auto-generated |

---

## API Reference

### Base URL
```
http://localhost:5000/api
```

### Response Format
All responses are JSON:
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

Errors return:
```json
{
  "error": "Error message description"
}
```

---

## Dashboard API

### GET /api/dashboard
Returns dashboard statistics and recent activity.

**Response:**
```json
{
  "stats": {
    "totalProperties": 3,
    "totalTenants": 4,
    "monthlyCollection": 116000.00,
    "monthlyExpenses": 48900.00,
    "pendingRent": 1,
    "netIncome": 67100.00
  },
  "recentCollections": [...],
  "recentExpenses": [...],
  "monthlyTrend": [
    { "month": "Oct 2024", "collections": 95000 },
    { "month": "Nov 2024", "collections": 98000 }
  ]
}
```

---

## Properties API

### GET /api/properties
List all properties with tenant counts.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Sunrise Apartments",
    "address": "12, MG Road, Bengaluru",
    "type": "apartment",
    "total_units": 8,
    "monthly_rent": 18000.00,
    "status": "active",
    "tenant_count": 2
  }
]
```

### POST /api/properties
Create a new property.

**Request Body:**
```json
{
  "name": "New Property",
  "address": "123 Street, City",
  "type": "apartment",
  "total_units": 10,
  "monthly_rent": 20000,
  "status": "active"
}
```

**Response:**
```json
{
  "id": 5,
  "message": "Property added successfully"
}
```

### PUT /api/properties/:id
Update property details.

**Request Body:** Same as POST

**Response:**
```json
{
  "message": "Property updated successfully"
}
```

### DELETE /api/properties/:id
Delete a property.

**Response:**
```json
{
  "message": "Property deleted"
}
```

---

## Tenants API

### GET /api/tenants
List all tenants with property names.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Rajesh Kumar",
    "email": "rajesh.k@email.com",
    "phone": "9876543210",
    "aadhar_number": "2345 6789 0123",
    "pan_number": "ABCPK1234D",
    "property_id": 1,
    "property_name": "Sunrise Apartments",
    "unit_number": "A-101",
    "monthly_rent": 18000,
    "status": "active"
  }
]
```

### POST /api/tenants
Create a new tenant.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@email.com",
  "phone": "9876543210",
  "aadhar_number": "1234 5678 9012",
  "pan_number": "ABCDE1234F",
  "emergency_contact": "9123456780",
  "property_id": 1,
  "unit_number": "A-102",
  "lease_start": "2025-01-01",
  "lease_end": "2026-12-31",
  "security_deposit": 36000,
  "status": "active"
}
```

### PUT /api/tenants/:id
Update tenant details.

**Request Body:** Same as POST

### DELETE /api/tenants/:id
Delete a tenant.

---

## Collections API

### GET /api/collections
List all collections with tenant and property details.

**Response:**
```json
[
  {
    "id": 1,
    "tenant_id": 1,
    "property_id": 1,
    "tenant_name": "Rajesh Kumar",
    "property_name": "Sunrise Apartments",
    "amount": 18000.00,
    "payment_date": "2025-03-05",
    "payment_method": "upi",
    "category": "rent",
    "month_year": "March 2025",
    "status": "paid",
    "reference_number": "UPI20250305001"
  }
]
```

### POST /api/collections
Record a new payment (auto-creates ledger entry).

**Request Body:**
```json
{
  "tenant_id": 1,
  "property_id": 1,
  "amount": 18000,
  "payment_date": "2025-03-05",
  "payment_method": "upi",
  "category": "rent",
  "month_year": "March 2025",
  "status": "paid",
  "notes": "Monthly rent payment",
  "reference_number": "UPI20250305001"
}
```

**Response:**
```json
{
  "id": 10,
  "message": "Collection recorded and ledger entry created"
}
```

### PUT /api/collections/:id
Update collection and linked ledger entry.

### DELETE /api/collections/:id
Delete a collection.

---

## Expenses API

### GET /api/expenses
List all expenses with property names.

**Response:**
```json
[
  {
    "id": 1,
    "property_id": 1,
    "property_name": "Sunrise Apartments",
    "category": "maintenance",
    "description": "Elevator servicing",
    "amount": 8500.00,
    "expense_date": "2025-03-15",
    "vendor": "Otis Elevator",
    "status": "paid",
    "receipt_number": "INV-001"
  }
]
```

### POST /api/expenses
Create a new expense (auto-creates ledger entry).

**Request Body:**
```json
{
  "property_id": 1,
  "category": "maintenance",
  "description": "Plumbing repair",
  "amount": 2500,
  "expense_date": "2025-03-20",
  "vendor": "Local Plumber",
  "status": "paid",
  "receipt_number": "REC-123"
}
```

### PUT /api/expenses/:id
Update expense and linked ledger entry.

### DELETE /api/expenses/:id
Delete an expense.

---

## Ledger API

### GET /api/ledger
List all ledger entries with property and tenant details.

### POST /api/ledger
Create manual ledger entry.

**Request Body:**
```json
{
  "entry_date": "2025-03-05",
  "entry_type": "income",
  "category": "rent",
  "description": "Rent payment",
  "amount": 18000,
  "gst_amount": 0,
  "tds_amount": 1800,
  "net_amount": 16200,
  "property_id": 1,
  "tenant_id": 1,
  "vendor": "Rajesh Kumar",
  "pan_number": "ABCPK1234D",
  "fy_year": "2025-2026",
  "quarter": "Q4"
}
```

### GET /api/ledger/summary/:fyYear
Get tax summary for financial year.

**Example:** `GET /api/ledger/summary/2025-2026`

**Response:**
```json
{
  "income": [
    {
      "total_income": 116000,
      "total_gst_collected": 0,
      "category": "rent",
      "quarter": "Q4"
    }
  ],
  "expense": [...],
  "fy_year": "2025-2026"
}
```

---

## Document Upload & OCR

### Tenant Documents

#### POST /api/tenants/:tenantId/documents
Upload a document for a tenant.

**Content-Type:** `multipart/form-data`

**Parameters:**
- `file` (required): File to upload (PDF, JPG, PNG, max 10MB)
- `document_type` (optional): `aadhar`, `pan`, `lease`, `agreement`, `id_proof`, `address_proof`, `other`
- `description` (optional): Document description

**Example (cURL):**
```bash
curl -X POST http://localhost:5000/api/tenants/1/documents \
  -F "file=@aadhar_card.pdf" \
  -F "document_type=aadhar" \
  -F "description=Front side"
```

**Response:**
```json
{
  "id": 5,
  "message": "Document uploaded successfully"
}
```

#### GET /api/tenants/:tenantId/documents
List all documents for a tenant.

#### DELETE /api/documents/:id
Delete a tenant document.

---

### Collection Documents (Payment Proof)

#### POST /api/collections/:collectionId/documents
Upload payment proof for a collection.

**Parameters:**
- `file` (required): Screenshot, PDF, or image
- `description` (optional): Document description

#### GET /api/collections/:collectionId/documents
List payment proofs for a collection.

#### DELETE /api/collection-documents/:id
Delete a payment proof.

---

### Expense Documents (Receipts)

#### POST /api/expenses/:expenseId/documents
Upload receipt for an expense.

#### GET /api/expenses/:expenseId/documents
List receipts for an expense.

#### DELETE /api/expense-documents/:id
Delete an expense receipt.

---

## OCR & Text Extraction

### POST /api/documents/:id/extract-content
Extract raw text from any document (tenant, collection, or expense document).

**Response:**
```json
{
  "text": "Extracted text content...",
  "method": "tesseract-ocr",
  "copyPaste": "Cleaned text for copying",
  "wordCount": 150,
  "charCount": 850
}
```

**Error Response (Scanned PDF):**
```json
{
  "text": "",
  "error": "Scanned PDF detected - no selectable text available. Upload as image for OCR.",
  "method": "pdf-parse",
  "copyPaste": ""
}
```

---

### POST /api/documents/:id/extract
Extract structured data from tenant documents (Aadhar/PAN).

**Supported Document Types:**
- Aadhar Card: Extracts name, DOB, Aadhar number, address
- PAN Card: Extracts name, DOB, PAN number

**Response:**
```json
{
  "rawText": "Full extracted text...",
  "extracted": {
    "name": "RAJESH KUMAR",
    "dateOfBirth": "15/03/1985",
    "aadharNumber": "2345 6789 0123",
    "panNumber": "ABCPK1234D",
    "address": "123, Main Street, Bengaluru"
  },
  "method": "tesseract-ocr"
}
```

---

### POST /api/collections/:collectionId/extract-reference
Extract payment reference number from payment proof.

**Extracts:**
- UPI Reference IDs
- NEFT/RTGS/IMPS UTR numbers
- Cheque numbers
- Transaction IDs

**Response:**
```json
{
  "rawText": "Full text from receipt...",
  "extractedReference": "UPI20250305001",
  "updated": true
}
```

---

### POST /api/tenants/:id/update-from-document
Update tenant with extracted document data.

**Request Body:**
```json
{
  "name": "Rajesh Kumar",
  "aadhar_number": "2345 6789 0123",
  "pan_number": "ABCPK1234D"
}
```

---

## File Access

Uploaded files are served statically:

```
GET http://localhost:5000/uploads/documents/{filename}
```

---

## File Upload Limits

| Setting | Value |
|---------|-------|
| Max File Size | 10 MB |
| Allowed Types | JPEG, PNG, GIF, PDF, DOC, DOCX |
| Storage Path | `/uploads/documents/` |

---

## System Features

### Automatic Database Backups
- Backups are created automatically on application shutdown
- Stored in `./backups/` folder
- Named: `auto-backup-{reason}-{timestamp}.json`
- Auto-recovery on startup from latest backup (< 24 hours old)

### Ledger Auto-Creation
- Collections automatically create income ledger entries with GST/TDS calculations
- Expenses automatically create expense ledger entries
- Updates to collections/expenses sync with ledger

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| DB_HOST | localhost | MySQL host |
| DB_USER | root | MySQL username |
| DB_PASS | (empty) | MySQL password |
| DB_NAME | rental_db | Database name |
| PORT | 5000 | API server port |

---

## Frontend

The React frontend runs at `http://localhost:3000`

**Pages:**
- Dashboard - Overview and statistics
- Properties - Manage properties
- Tenants - Manage tenants with document upload
- Collections - Record payments with payment proof
- Expenses - Track expenses with receipts
- Ledger - Tax management and compliance

---

*Documentation generated for RentFlow v1.0*
