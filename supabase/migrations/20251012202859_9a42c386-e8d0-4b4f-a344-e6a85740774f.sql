-- Create quote_views table if not exists
CREATE TABLE IF NOT EXISTS public.quote_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

-- Create quote_signatures table if not exists
CREATE TABLE IF NOT EXISTS public.quote_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  signer_personnummer TEXT,
  property_designation TEXT,
  response TEXT NOT NULL CHECK (response IN ('accepted', 'rejected')),
  signed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  message TEXT
);

-- Enable RLS
ALTER TABLE public.quote_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_signatures ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quote_views
-- Anyone can insert views (for tracking)
DROP POLICY IF EXISTS "Anyone can insert views" ON public.quote_views;
CREATE POLICY "Anyone can insert views"
  ON public.quote_views
  FOR INSERT
  WITH CHECK (true);

-- Users can view logs for own quotes
DROP POLICY IF EXISTS "Users can view logs for own quotes" ON public.quote_views;
CREATE POLICY "Users can view logs for own quotes"
  ON public.quote_views
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes
      WHERE quotes.id = quote_views.quote_id
      AND quotes.user_id = auth.uid()
    )
  );

-- RLS Policies for quote_signatures
-- Anyone can sign (insert)
DROP POLICY IF EXISTS "Anyone can sign" ON public.quote_signatures;
CREATE POLICY "Anyone can sign"
  ON public.quote_signatures
  FOR INSERT
  WITH CHECK (true);

-- Users can view signatures for own quotes
DROP POLICY IF EXISTS "Users can view signatures for own quotes" ON public.quote_signatures;
CREATE POLICY "Users can view signatures for own quotes"
  ON public.quote_signatures
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes
      WHERE quotes.id = quote_signatures.quote_id
      AND quotes.user_id = auth.uid()
    )
  );

-- Create public function to get quote by token (without authentication)
CREATE OR REPLACE FUNCTION public.get_quote_by_token(token_param TEXT)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  generated_quote JSONB,
  edited_quote JSONB,
  is_edited BOOLEAN,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  company_name TEXT,
  company_email TEXT,
  company_phone TEXT,
  company_address TEXT,
  company_logo_url TEXT
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    q.id,
    q.title,
    q.description,
    q.generated_quote,
    q.edited_quote,
    q.is_edited,
    q.status,
    q.created_at,
    cs.company_name,
    cs.email as company_email,
    cs.phone as company_phone,
    cs.address as company_address,
    cs.logo_url as company_logo_url
  FROM public.quotes q
  LEFT JOIN public.company_settings cs ON cs.user_id = q.user_id
  WHERE q.unique_token = token_param;
END;
$$;

-- Grant execute permission to anon and authenticated users
GRANT EXECUTE ON FUNCTION public.get_quote_by_token(TEXT) TO anon, authenticated;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_quotes_unique_token ON public.quotes(unique_token);
CREATE INDEX IF NOT EXISTS idx_quote_views_quote_id ON public.quote_views(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_signatures_quote_id ON public.quote_signatures(quote_id);