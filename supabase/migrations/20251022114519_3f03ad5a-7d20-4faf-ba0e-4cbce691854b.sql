-- Add signature_data column to quote_signatures table for storing digital signatures
ALTER TABLE quote_signatures 
ADD COLUMN signature_data TEXT;

COMMENT ON COLUMN quote_signatures.signature_data IS 'Base64-encoded PNG image of customer digital signature';

-- Add response and message columns for tracking acceptance/rejection
ALTER TABLE quote_signatures
ADD COLUMN response TEXT CHECK (response IN ('accepted', 'rejected')),
ADD COLUMN message TEXT;

COMMENT ON COLUMN quote_signatures.response IS 'Customer response: accepted or rejected';
COMMENT ON COLUMN quote_signatures.message IS 'Optional customer message when responding to quote';
