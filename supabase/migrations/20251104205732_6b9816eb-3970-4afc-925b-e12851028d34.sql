-- ============================================
-- FAS 4: FIX - Uppdatera deduction_percentage kolumn
-- ============================================

-- Ändra deduction_percentage för att hantera värden 0-100
ALTER TABLE deduction_limits 
ALTER COLUMN deduction_percentage TYPE numeric(5,2);

-- Rensa eventuella gamla regler
DELETE FROM deduction_limits;

-- Lägg till ROT-avdrag 2025 (50%)
INSERT INTO deduction_limits (
  deduction_type,
  deduction_percentage,
  max_amount_per_year,
  valid_from,
  valid_to,
  description
) VALUES (
  'rot',
  50.00,
  50000,
  '2025-01-01',
  '2025-12-31',
  'ROT-avdrag 50% på arbetskostnad under 2025. Max 50 000 kr per person och år.'
);

-- Lägg till ROT-avdrag 2026+ (30%)
INSERT INTO deduction_limits (
  deduction_type,
  deduction_percentage,
  max_amount_per_year,
  valid_from,
  valid_to,
  description
) VALUES (
  'rot',
  30.00,
  50000,
  '2026-01-01',
  NULL,
  'ROT-avdrag 30% på arbetskostnad från 2026. Max 50 000 kr per person och år.'
);

-- Lägg till RUT-avdrag (50%)
INSERT INTO deduction_limits (
  deduction_type,
  deduction_percentage,
  max_amount_per_year,
  valid_from,
  valid_to,
  description
) VALUES (
  'rut',
  50.00,
  75000,
  '2024-01-01',
  NULL,
  'RUT-avdrag 50% på arbetskostnad. Max 75 000 kr per person och år.'
);