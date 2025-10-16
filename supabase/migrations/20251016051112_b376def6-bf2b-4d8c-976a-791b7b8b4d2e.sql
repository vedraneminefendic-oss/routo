-- Skapa tabell för bransch-benchmarks
CREATE TABLE IF NOT EXISTS public.industry_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_category text NOT NULL,
  metric_type text NOT NULL,
  min_value numeric,
  max_value numeric,
  median_value numeric,
  sample_size integer,
  last_updated timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_industry_benchmarks_category ON public.industry_benchmarks(work_category);

-- RLS policies för industry_benchmarks
ALTER TABLE public.industry_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view benchmarks" ON public.industry_benchmarks
  FOR SELECT USING (true);

-- Funktion för att hitta liknande offerter
CREATE OR REPLACE FUNCTION public.find_similar_quotes(
  user_id_param uuid,
  description_param text,
  limit_param int DEFAULT 3
)
RETURNS TABLE (
  quote_id uuid,
  title text,
  description text,
  quote_data jsonb,
  similarity_score float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    q.id,
    q.title,
    q.description,
    COALESCE(q.edited_quote, q.generated_quote) as quote_data,
    (
      CASE 
        WHEN q.description ILIKE '%badrum%' AND description_param ILIKE '%badrum%' THEN 1.0
        WHEN q.description ILIKE '%kök%' AND description_param ILIKE '%kök%' THEN 1.0
        WHEN q.description ILIKE '%målning%' AND description_param ILIKE '%målning%' THEN 0.8
        WHEN q.description ILIKE '%städning%' AND description_param ILIKE '%städning%' THEN 1.0
        WHEN q.description ILIKE '%trädgård%' AND description_param ILIKE '%trädgård%' THEN 0.9
        WHEN q.description ILIKE '%fälla%' AND description_param ILIKE '%fälla%' THEN 1.0
        WHEN q.description ILIKE '%träd%' AND description_param ILIKE '%träd%' THEN 0.9
        ELSE 0.3
      END
    ) as similarity
  FROM quotes q
  WHERE q.user_id = user_id_param
    AND q.status IN ('accepted', 'completed', 'sent')
    AND q.created_at > NOW() - INTERVAL '2 years'
    AND COALESCE(q.edited_quote, q.generated_quote) IS NOT NULL
  ORDER BY similarity DESC, q.created_at DESC
  LIMIT limit_param;
END;
$$;