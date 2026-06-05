-- Add tenant handover checklist table
USE rental_db;

CREATE TABLE IF NOT EXISTS tenant_handover_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  item_description TEXT,
  quantity INT DEFAULT 1,
  item_type ENUM('original', 'duplicate', 'both') DEFAULT 'original',
  status ENUM('handed_over', 'pending', 'returned') DEFAULT 'handed_over',
  handover_date DATE,
  return_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Add index for faster queries
CREATE INDEX idx_tenant_handover_tenant_id ON tenant_handover_items(tenant_id);
