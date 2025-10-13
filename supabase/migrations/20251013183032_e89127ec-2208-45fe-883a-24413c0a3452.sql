-- Create RPC function to get quote statistics
CREATE OR REPLACE FUNCTION public.get_quote_statistics(
  start_date timestamptz DEFAULT '1970-01-01'::timestamptz,
  end_date timestamptz DEFAULT now()
)
RETURNS TABLE (
  total_quotes bigint,
  total_value numeric,
  avg_quote_value numeric,
  draft_count bigint,
  sent_count bigint,
  viewed_count bigint,
  accepted_count bigint,
  rejected_count bigint,
  completed_count bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total_quotes,
    COALESCE(SUM((COALESCE(edited_quote, generated_quote)->'summary'->>'customerPays')::numeric), 0) as total_value,
    COALESCE(AVG((COALESCE(edited_quote, generated_quote)->'summary'->>'customerPays')::numeric), 0) as avg_quote_value,
    COUNT(*) FILTER (WHERE status = 'draft')::bigint as draft_count,
    COUNT(*) FILTER (WHERE status = 'sent')::bigint as sent_count,
    COUNT(*) FILTER (WHERE status = 'viewed')::bigint as viewed_count,
    COUNT(*) FILTER (WHERE status = 'accepted')::bigint as accepted_count,
    COUNT(*) FILTER (WHERE status = 'rejected')::bigint as rejected_count,
    COUNT(*) FILTER (WHERE status = 'completed')::bigint as completed_count
  FROM quotes
  WHERE user_id = auth.uid()
    AND created_at BETWEEN start_date AND end_date;
END;
$$;