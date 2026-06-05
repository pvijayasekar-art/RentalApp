-- Add item_type column to existing tenant_handover_items table
USE rental_db;

ALTER TABLE tenant_handover_items 
ADD COLUMN item_type ENUM('original', 'duplicate', 'both') DEFAULT 'original' 
AFTER quantity;
