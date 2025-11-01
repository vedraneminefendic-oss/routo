-- Add project_type column to quotes table
ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS project_type TEXT;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_quotes_project_type ON public.quotes(project_type);

-- Populate existing quotes with project_type based on description
UPDATE public.quotes
SET project_type = CASE
  WHEN description ILIKE '%badrum%' THEN 'badrum'
  WHEN description ILIKE '%kök%' THEN 'kök'
  WHEN description ILIKE '%målning%' OR description ILIKE '%måla%' THEN 'målning'
  WHEN description ILIKE '%städ%' THEN 'städning'
  WHEN description ILIKE '%trädgård%' THEN 'trädgård'
  WHEN description ILIKE '%el%' OR description ILIKE '%elektr%' THEN 'el'
  WHEN description ILIKE '%vvs%' OR description ILIKE '%rör%' THEN 'vvs'
  WHEN description ILIKE '%fönster%' THEN 'fönster'
  ELSE 'övrigt'
END
WHERE project_type IS NULL;