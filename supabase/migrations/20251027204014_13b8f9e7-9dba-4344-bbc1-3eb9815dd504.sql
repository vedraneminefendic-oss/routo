-- Create table for tracking accepted work patterns (user learning)
CREATE TABLE public.accepted_work_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_type TEXT NOT NULL,
  work_item_name TEXT NOT NULL,
  was_explicitly_mentioned BOOLEAN NOT NULL DEFAULT false,
  was_kept_by_ai BOOLEAN NOT NULL DEFAULT false,
  customer_accepted BOOLEAN NOT NULL DEFAULT true,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE CASCADE,
  confidence_score NUMERIC,
  ai_reasoning TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_accepted_work_patterns_user_id ON public.accepted_work_patterns(user_id);
CREATE INDEX idx_accepted_work_patterns_project_type ON public.accepted_work_patterns(project_type);
CREATE INDEX idx_accepted_work_patterns_created_at ON public.accepted_work_patterns(created_at DESC);

-- Enable RLS
ALTER TABLE public.accepted_work_patterns ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own patterns"
  ON public.accepted_work_patterns
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own patterns"
  ON public.accepted_work_patterns
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create table for industry knowledge (web search results)
CREATE TABLE public.industry_knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  project_type TEXT NOT NULL,
  content JSONB NOT NULL,
  source TEXT NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_industry_knowledge_category ON public.industry_knowledge(category);
CREATE INDEX idx_industry_knowledge_project_type ON public.industry_knowledge(project_type);

-- Enable RLS
ALTER TABLE public.industry_knowledge ENABLE ROW LEVEL SECURITY;

-- RLS policies (read-only for all authenticated users)
CREATE POLICY "Anyone can view industry knowledge"
  ON public.industry_knowledge
  FOR SELECT
  USING (true);