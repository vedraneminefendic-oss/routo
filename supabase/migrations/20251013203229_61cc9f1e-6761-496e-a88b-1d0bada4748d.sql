-- Skapa tabell för att logga påminnelser
CREATE TABLE IF NOT EXISTS public.quote_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reminder_type TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  email_sent BOOLEAN DEFAULT true
);

-- Index för bättre prestanda
CREATE INDEX IF NOT EXISTS idx_quote_reminders_quote_id ON public.quote_reminders(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_reminders_user_id ON public.quote_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_quote_reminders_sent_at ON public.quote_reminders(sent_at);

-- Index på quotes för snabbare queries
CREATE INDEX IF NOT EXISTS idx_quotes_sent_at ON public.quotes(sent_at);
CREATE INDEX IF NOT EXISTS idx_quotes_viewed_at ON public.quotes(viewed_at);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(status);

-- RLS policies
ALTER TABLE public.quote_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reminders"
  ON public.quote_reminders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reminders"
  ON public.quote_reminders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Aktivera pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Aktivera pg_net extension för HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schemalägg daglig körning kl 09:00
SELECT cron.schedule(
  'check-pending-quotes-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://jttvujmznirmwdtvmyom.supabase.co/functions/v1/check-pending-quotes',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0dHZ1am16bmlybXdkdHZteW9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMzkyODksImV4cCI6MjA3NTgxNTI4OX0.-7WZxzj5IutS9xPTT15U_3XrPDIC_1hbp6SVGkJZ96o"}'::jsonb,
    body := '{"scheduled": true}'::jsonb
  ) as request_id;
  $$
);