-- Enable pg_cron and pg_net extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule aggregate-industry-data to run daily at 03:00 UTC
-- This ensures industry benchmarks are updated regularly with latest data
SELECT cron.schedule(
  'aggregate-industry-data-daily',
  '0 3 * * *', -- Every day at 3 AM UTC
  $$
  SELECT net.http_post(
    url := 'https://jttvujmznirmwdtvmyom.supabase.co/functions/v1/aggregate-industry-data',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0dHZ1am16bmlybXdkdHZteW9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMzkyODksImV4cCI6MjA3NTgxNTI4OX0.-7WZxzj5IutS9xPTT15U_3XrPDIC_1hbp6SVGkJZ96o"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);