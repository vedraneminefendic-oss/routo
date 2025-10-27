-- Create market_data_logs table for tracking updates
CREATE TABLE IF NOT EXISTS public.market_data_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'warning')),
  records_updated INTEGER DEFAULT 0,
  source TEXT NOT NULL CHECK (source IN ('cron', 'manual-refresh', 'scheduled-cron')),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.market_data_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role to insert logs
CREATE POLICY "Service role can insert logs"
ON public.market_data_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- Allow authenticated users to view logs
CREATE POLICY "Users can view logs"
ON public.market_data_logs
FOR SELECT
TO authenticated
USING (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_market_data_logs_created_at 
ON public.market_data_logs(created_at DESC);