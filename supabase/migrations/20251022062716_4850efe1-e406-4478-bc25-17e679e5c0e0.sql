-- FAS 5: Session Context & Learning Engine
-- Step 1: Add learned_preferences to conversation_sessions
ALTER TABLE conversation_sessions 
ADD COLUMN IF NOT EXISTS learned_preferences JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN conversation_sessions.learned_preferences IS 'Stores learned preferences during conversation: regionalMultiplier, qualityPreference, typicalMargin, preferredMaterialRatio, etc.';

-- Step 2: Create function to auto-update industry benchmarks from accepted quotes
CREATE OR REPLACE FUNCTION update_industry_benchmarks_from_quote()
RETURNS TRIGGER AS $$
DECLARE
  quote_data JSONB;
  work_category TEXT;
  area_sqm NUMERIC;
  total_cost NUMERIC;
  material_cost NUMERIC;
  work_cost NUMERIC;
  price_per_sqm NUMERIC;
  material_ratio NUMERIC;
BEGIN
  -- Only process accepted or completed quotes
  IF NEW.status NOT IN ('accepted', 'completed') THEN
    RETURN NEW;
  END IF;
  
  -- Get quote data (prefer edited over generated)
  quote_data := COALESCE(NEW.edited_quote, NEW.generated_quote);
  
  IF quote_data IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Extract metrics
  area_sqm := (quote_data->'measurements'->>'area')::NUMERIC;
  total_cost := (quote_data->'summary'->>'totalBeforeVAT')::NUMERIC;
  material_cost := (quote_data->'summary'->>'materialCost')::NUMERIC;
  work_cost := (quote_data->'summary'->>'workCost')::NUMERIC;
  
  -- Determine work category from description
  work_category := CASE
    WHEN NEW.description ILIKE '%badrum%' AND NEW.description ILIKE '%renover%' THEN 'badrum_renovering'
    WHEN NEW.description ILIKE '%kök%' AND NEW.description ILIKE '%renover%' THEN 'kok_renovering'
    WHEN NEW.description ILIKE '%målning%' OR NEW.description ILIKE '%måla%' THEN 'malning'
    WHEN NEW.description ILIKE '%städ%' THEN 'stadning'
    WHEN NEW.description ILIKE '%trädgård%' AND NEW.description ILIKE '%fäll%' THEN 'tradgard_fallning'
    WHEN NEW.description ILIKE '%trädgård%' THEN 'tradgard'
    WHEN NEW.description ILIKE '%fönster%' THEN 'fonster'
    WHEN NEW.description ILIKE '%el%' OR NEW.description ILIKE '%elektr%' THEN 'el'
    WHEN NEW.description ILIKE '%vvs%' OR NEW.description ILIKE '%rör%' THEN 'vvs'
    ELSE 'other'
  END;
  
  -- Calculate price per sqm if area exists
  IF area_sqm > 0 AND total_cost > 0 THEN
    price_per_sqm := total_cost / area_sqm;
    
    -- Upsert price_per_sqm benchmark
    INSERT INTO industry_benchmarks (
      work_category,
      metric_type,
      median_value,
      min_value,
      max_value,
      sample_size,
      last_updated
    )
    VALUES (
      work_category,
      'price_per_sqm',
      price_per_sqm,
      price_per_sqm * 0.8,
      price_per_sqm * 1.2,
      1,
      NOW()
    )
    ON CONFLICT (work_category, metric_type) 
    DO UPDATE SET
      median_value = (industry_benchmarks.median_value * industry_benchmarks.sample_size + EXCLUDED.median_value) / (industry_benchmarks.sample_size + 1),
      min_value = LEAST(industry_benchmarks.min_value, EXCLUDED.min_value),
      max_value = GREATEST(industry_benchmarks.max_value, EXCLUDED.max_value),
      sample_size = industry_benchmarks.sample_size + 1,
      last_updated = NOW();
  END IF;
  
  -- Calculate material ratio if costs exist
  IF work_cost > 0 AND material_cost >= 0 THEN
    material_ratio := material_cost / NULLIF(work_cost, 0);
    
    -- Upsert material_to_work_ratio benchmark
    INSERT INTO industry_benchmarks (
      work_category,
      metric_type,
      median_value,
      min_value,
      max_value,
      sample_size,
      last_updated
    )
    VALUES (
      work_category,
      'material_to_work_ratio',
      material_ratio,
      material_ratio * 0.7,
      material_ratio * 1.3,
      1,
      NOW()
    )
    ON CONFLICT (work_category, metric_type) 
    DO UPDATE SET
      median_value = (industry_benchmarks.median_value * industry_benchmarks.sample_size + EXCLUDED.median_value) / (industry_benchmarks.sample_size + 1),
      min_value = LEAST(industry_benchmarks.min_value, EXCLUDED.min_value),
      max_value = GREATEST(industry_benchmarks.max_value, EXCLUDED.max_value),
      sample_size = industry_benchmarks.sample_size + 1,
      last_updated = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 3: Create trigger to auto-update benchmarks
DROP TRIGGER IF EXISTS trigger_update_industry_benchmarks ON quotes;
CREATE TRIGGER trigger_update_industry_benchmarks
  AFTER INSERT OR UPDATE OF status ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_industry_benchmarks_from_quote();

-- Step 4: Add unique constraint to industry_benchmarks for upserts
ALTER TABLE industry_benchmarks 
ADD CONSTRAINT unique_work_category_metric 
UNIQUE (work_category, metric_type);