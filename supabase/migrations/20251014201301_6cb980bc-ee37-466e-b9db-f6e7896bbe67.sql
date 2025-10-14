-- Remove PII exposure from public quote function
-- This prevents customer personal information from being exposed to anyone with the quote token

DROP FUNCTION IF EXISTS public.get_quote_by_token(text);

CREATE OR REPLACE FUNCTION public.get_quote_by_token(token_param text)
RETURNS TABLE(
  id uuid,
  title text,
  description text,
  generated_quote jsonb,
  edited_quote jsonb,
  is_edited boolean,
  status text,
  created_at timestamp with time zone,
  company_name text,
  company_email text,
  company_phone text,
  company_address text,
  company_logo_url text,
  customer_id uuid,
  customer_name text,
  -- REMOVED: customer_email, customer_phone, customer_address to protect PII
  -- REMOVED: customer_personnummer (highly sensitive - GDPR protected)
  customer_property_designation text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    cs.logo_url as company_logo_url,
    q.customer_id,
    c.name as customer_name,
    -- PII fields removed for security - customers must enter their own details when signing
    c.property_designation as customer_property_designation
  FROM public.quotes q
  LEFT JOIN public.company_settings cs ON cs.user_id = q.user_id
  LEFT JOIN public.customers c ON c.id = q.customer_id
  WHERE q.unique_token = token_param;
END;
$$;