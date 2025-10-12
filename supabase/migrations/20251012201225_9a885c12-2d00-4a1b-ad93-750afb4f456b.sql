-- Add timestamp columns to quotes table for status tracking
ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS viewed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS responded_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;

-- Create quote_status_history table for tracking all status changes
CREATE TABLE IF NOT EXISTS public.quote_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  note text
);

-- Enable RLS for quote_status_history
ALTER TABLE public.quote_status_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view status history for their own quotes
CREATE POLICY "Users can view status history for own quotes"
ON public.quote_status_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.quotes
    WHERE quotes.id = quote_status_history.quote_id
    AND quotes.user_id = auth.uid()
  )
);

-- Policy: Users can insert status history for their own quotes
CREATE POLICY "Users can insert status history for own quotes"
ON public.quote_status_history
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quotes
    WHERE quotes.id = quote_status_history.quote_id
    AND quotes.user_id = auth.uid()
  )
);

-- Create quote_email_logs table for future email integration
CREATE TABLE IF NOT EXISTS public.quote_email_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  email_type text NOT NULL,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  opened_at timestamp with time zone,
  clicked_at timestamp with time zone,
  email_provider_id text
);

-- Enable RLS for quote_email_logs
ALTER TABLE public.quote_email_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view email logs for their own quotes
CREATE POLICY "Users can view email logs for own quotes"
ON public.quote_email_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.quotes
    WHERE quotes.id = quote_email_logs.quote_id
    AND quotes.user_id = auth.uid()
  )
);

-- Policy: Users can insert email logs for their own quotes
CREATE POLICY "Users can insert email logs for own quotes"
ON public.quote_email_logs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quotes
    WHERE quotes.id = quote_email_logs.quote_id
    AND quotes.user_id = auth.uid()
  )
);

-- Update existing quotes to have unique_token if they don't have one
UPDATE public.quotes 
SET unique_token = gen_random_uuid()::text 
WHERE unique_token IS NULL;

-- Create index on unique_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_quotes_unique_token ON public.quotes(unique_token);

-- Create index on quote_status_history for faster queries
CREATE INDEX IF NOT EXISTS idx_quote_status_history_quote_id ON public.quote_status_history(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_status_history_changed_at ON public.quote_status_history(changed_at DESC);

-- Create index on quote_email_logs for faster queries
CREATE INDEX IF NOT EXISTS idx_quote_email_logs_quote_id ON public.quote_email_logs(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_email_logs_sent_at ON public.quote_email_logs(sent_at DESC);