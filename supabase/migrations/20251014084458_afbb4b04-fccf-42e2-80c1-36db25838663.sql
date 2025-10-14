-- Add deduction_type to quotes table
ALTER TABLE quotes 
ADD COLUMN deduction_type TEXT CHECK (deduction_type IN ('rot', 'rut', 'none')) DEFAULT 'rot';

-- Add default_deduction_type to company_settings
ALTER TABLE company_settings 
ADD COLUMN default_deduction_type TEXT CHECK (default_deduction_type IN ('rot', 'rut', 'none')) DEFAULT 'rot';

-- Create deduction_limits table for dynamic deduction rules
CREATE TABLE deduction_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deduction_type TEXT NOT NULL CHECK (deduction_type IN ('rot', 'rut')),
  max_amount_per_year INTEGER NOT NULL,
  deduction_percentage NUMERIC(3,2) NOT NULL,
  valid_from DATE NOT NULL,
  valid_to DATE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on deduction_limits
ALTER TABLE deduction_limits ENABLE ROW LEVEL SECURITY;

-- Public read access for deduction limits
CREATE POLICY "Anyone can view deduction limits"
ON deduction_limits FOR SELECT
USING (true);

-- Insert current Swedish tax deduction rules (2024/2025)
INSERT INTO deduction_limits (deduction_type, max_amount_per_year, deduction_percentage, valid_from, description)
VALUES 
  ('rot', 50000, 0.50, '2024-01-01', 'Reparation, Ombyggnad, Tillbyggnad - gäller renovering, reparation och ombyggnation av bostad'),
  ('rut', 75000, 0.50, '2024-01-01', 'Rengöring, Underhåll, Trädgård - gäller städning, hemservice och trädgårdsarbete');