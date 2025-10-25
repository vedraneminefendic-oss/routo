-- Åtgärd #3: Uppdatera deduction_limits tabellen för 2026

-- Uppdatera nuvarande regler med valid_to datum
UPDATE deduction_limits 
SET valid_to = '2025-12-31'
WHERE valid_from = '2024-01-01' AND valid_to IS NULL;

-- Lägg till nya regler för 2026 med 30% sats
INSERT INTO deduction_limits (deduction_type, deduction_percentage, max_amount_per_year, valid_from, valid_to, description)
VALUES 
  ('rot', 0.30, 50000, '2026-01-01', NULL, 'ROT-avdrag från 2026 - permanent sänkning till 30%'),
  ('rut', 0.30, 75000, '2026-01-01', NULL, 'RUT-avdrag från 2026 - permanent sänkning till 30%')
ON CONFLICT DO NOTHING;