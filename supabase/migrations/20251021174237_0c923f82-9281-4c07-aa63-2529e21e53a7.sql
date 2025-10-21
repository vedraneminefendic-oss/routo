-- Fas 14A: Skapa user_quote_patterns tabell för personlig inlärning

CREATE TABLE public.user_quote_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Aggregerad data (GDPR-säker - ingen PII)
  total_quotes INTEGER NOT NULL DEFAULT 0,
  avg_quote_value NUMERIC,
  preferred_detail_level TEXT,
  
  -- Arbetstyper och timpriser (JSON för flexibilitet)
  work_type_distribution JSONB, -- {"Snickare": 45, "Målare": 30, "Städning": 25} (procent)
  avg_hourly_rates JSONB, -- {"Snickare": 650, "Målare": 550}
  
  -- Material/arbete-ratio
  avg_material_to_work_ratio NUMERIC,
  
  -- Projekttyper
  common_project_types JSONB, -- ["trädfällning", "målning", "renovering"]
  
  -- Stil och preferenser
  uses_emojis BOOLEAN DEFAULT false,
  avg_description_length INTEGER,
  
  -- Metadata
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sample_size INTEGER NOT NULL DEFAULT 0, -- Antal offerter analyserade
  
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_quote_patterns ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own patterns"
  ON public.user_quote_patterns
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own patterns"
  ON public.user_quote_patterns
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own patterns"
  ON public.user_quote_patterns
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Index för snabbare queries
CREATE INDEX idx_user_quote_patterns_user_id ON public.user_quote_patterns(user_id);
CREATE INDEX idx_user_quote_patterns_updated ON public.user_quote_patterns(last_updated);

-- Trigger för automatisk uppdatering av last_updated
CREATE TRIGGER update_user_quote_patterns_updated_at
  BEFORE UPDATE ON public.user_quote_patterns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();