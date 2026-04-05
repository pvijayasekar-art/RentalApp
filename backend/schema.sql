-- Rental Management System - MySQL Schema

CREATE DATABASE IF NOT EXISTS rental_db;
USE rental_db;

CREATE TABLE IF NOT EXISTS properties (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  type ENUM('apartment','house','commercial','villa') DEFAULT 'apartment',
  total_units INT DEFAULT 1,
  monthly_rent DECIMAL(12,2) NOT NULL,
  status ENUM('active','inactive','maintenance') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tenants (
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

CREATE TABLE IF NOT EXISTS collections (
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

CREATE TABLE IF NOT EXISTS expenses (
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

CREATE TABLE IF NOT EXISTS tenant_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  file_size INT,
  file_path VARCHAR(500),
  file_content LONGBLOB,
  document_type ENUM('aadhar','pan','lease','agreement','id_proof','address_proof','other') DEFAULT 'other',
  description TEXT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS collection_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  collection_id INT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  file_size INT,
  file_path VARCHAR(500),
  file_content LONGBLOB,
  description TEXT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS expense_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  expense_id INT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  file_size INT,
  file_path VARCHAR(500),
  file_content LONGBLOB,
  description TEXT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ledger_entries (
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

-- Sample data
INSERT INTO properties (name, address, type, total_units, monthly_rent, status) VALUES
('Sunrise Apartments', '12, MG Road, Bengaluru, Karnataka 560001', 'apartment', 8, 18000.00, 'active'),
('Green Villa', '45, Anna Nagar, Chennai, Tamil Nadu 600040', 'villa', 1, 45000.00, 'active'),
('Sharma Commercial', '78, Connaught Place, New Delhi 110001', 'commercial', 4, 35000.00, 'active');

INSERT INTO tenants (name, email, phone, aadhar_number, pan_number, property_id, unit_number, lease_start, lease_end, security_deposit, status) VALUES
('Rajesh Kumar', 'rajesh.kumar@email.com', '9876543210', '2345 6789 0123', 'ABCPK1234D', 1, 'A-101', '2024-01-01', '2025-12-31', 36000.00, 'active'),
('Priya Sharma', 'priya.s@email.com', '9123456780', '3456 7890 1234', 'BCQPS5678E', 1, 'A-102', '2024-03-01', '2025-02-28', 36000.00, 'active'),
('Amit Singh', 'amit.singh@email.com', '9988776655', '4567 8901 2345', 'CDRQA9012F', 2, 'Villa', '2023-06-01', '2024-05-31', 90000.00, 'notice'),
('Sunita Reddy', 'sunita.r@email.com', '9977665544', '5678 9012 3456', 'DESRB3456G', 3, 'Shop-1', '2024-02-01', '2025-01-31', 70000.00, 'active');

INSERT INTO collections (tenant_id, property_id, amount, payment_date, payment_method, month_year, status, reference_number) VALUES
(1, 1, 18000.00, '2025-03-05', 'upi', 'March 2025', 'paid', 'UPI20250305001'),
(2, 1, 18000.00, '2025-03-02', 'bank_transfer', 'March 2025', 'paid', 'NEFT20250302002'),
(3, 2, 45000.00, '2025-03-10', 'cheque', 'March 2025', 'paid', 'CHQ20250310003'),
(4, 3, 35000.00, '2025-02-28', 'upi', 'March 2025', 'pending', NULL),
(1, 1, 18000.00, '2025-02-04', 'upi', 'February 2025', 'paid', 'UPI20250204001'),
(2, 1, 18000.00, '2025-02-06', 'cash', 'February 2025', 'paid', NULL);

INSERT INTO expenses (property_id, category, description, amount, expense_date, vendor, status) VALUES
(1, 'maintenance', 'Elevator servicing - quarterly maintenance', 8500.00, '2025-03-15', 'Otis Elevator Services', 'paid'),
(1, 'utilities', 'Common area electricity bill - March', 3200.00, '2025-03-31', 'BESCOM', 'paid'),
(2, 'repairs', 'Plumbing repair - kitchen sink', 2500.00, '2025-03-20', 'Local Plumber', 'paid'),
(3, 'taxes', 'Property tax Q1 2025', 15000.00, '2025-03-01', 'Municipal Corporation', 'paid'),
(NULL, 'insurance', 'Annual building insurance renewal', 22000.00, '2025-01-01', 'LIC Property Insurance', 'paid');
