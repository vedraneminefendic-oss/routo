-- Add work_address column to quotes table
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS work_address TEXT;

-- Add index for faster searching
CREATE INDEX IF NOT EXISTS idx_quotes_work_address ON quotes(work_address);
CREATE INDEX IF NOT EXISTS idx_quotes_project_type ON quotes(project_type);

-- Update existing quotes with address from customer if available
UPDATE quotes q
SET work_address = c.address
FROM customers c
WHERE q.customer_id = c.id 
AND q.work_address IS NULL
AND c.address IS NOT NULL;