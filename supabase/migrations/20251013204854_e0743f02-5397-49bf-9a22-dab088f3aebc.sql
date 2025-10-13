-- Create function to get time series data for quotes
CREATE OR REPLACE FUNCTION public.get_quotes_time_series(
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  interval_type TEXT DEFAULT 'day'
)
RETURNS TABLE (
  period_start TIMESTAMP WITH TIME ZONE,
  period_label TEXT,
  total_quotes BIGINT,
  total_value NUMERIC,
  accepted_value NUMERIC,
  draft_count BIGINT,
  sent_count BIGINT,
  viewed_count BIGINT,
  accepted_count BIGINT,
  rejected_count BIGINT,
  completed_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    date_trunc(interval_type, q.created_at) AS period_start,
    to_char(date_trunc(interval_type, q.created_at), 
      CASE interval_type
        WHEN 'day' THEN 'DD Mon'
        WHEN 'week' THEN 'WW, YYYY'
        WHEN 'month' THEN 'Mon YYYY'
        ELSE 'DD Mon'
      END
    ) AS period_label,
    COUNT(*)::BIGINT AS total_quotes,
    COALESCE(SUM(
      COALESCE((q.edited_quote->'summary'->>'customerPays')::numeric,
               (q.generated_quote->'summary'->>'customerPays')::numeric, 0)
    ), 0) AS total_value,
    COALESCE(SUM(
      CASE WHEN q.status IN ('accepted', 'completed')
      THEN COALESCE((q.edited_quote->'summary'->>'customerPays')::numeric,
                    (q.generated_quote->'summary'->>'customerPays')::numeric, 0)
      ELSE 0 END
    ), 0) AS accepted_value,
    COUNT(*) FILTER (WHERE q.status = 'draft')::BIGINT AS draft_count,
    COUNT(*) FILTER (WHERE q.status = 'sent')::BIGINT AS sent_count,
    COUNT(*) FILTER (WHERE q.status = 'viewed')::BIGINT AS viewed_count,
    COUNT(*) FILTER (WHERE q.status = 'accepted')::BIGINT AS accepted_count,
    COUNT(*) FILTER (WHERE q.status = 'rejected')::BIGINT AS rejected_count,
    COUNT(*) FILTER (WHERE q.status = 'completed')::BIGINT AS completed_count
  FROM quotes q
  WHERE q.user_id = auth.uid()
    AND q.created_at >= start_date
    AND q.created_at <= end_date
  GROUP BY date_trunc(interval_type, q.created_at)
  ORDER BY period_start;
END;
$$;