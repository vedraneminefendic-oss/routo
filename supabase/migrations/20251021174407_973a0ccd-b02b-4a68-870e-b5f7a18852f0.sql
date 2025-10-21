-- Fas 14D: Schemalägg automatisk aggregering av branschdata

-- Aktivera pg_cron och pg_net extensions (om de inte redan är aktiverade)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schemalägg aggregering att köras varje måndag klockan 03:00
SELECT cron.schedule(
  'aggregate-industry-data-weekly',
  '0 3 * * 1', -- Varje måndag kl 03:00
  $$
  SELECT
    net.http_post(
        url:='https://jttvujmznirmwdtvmyom.supabase.co/functions/v1/aggregate-industry-data',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0dHZ1am16bmlybXdkdHZteW9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMzkyODksImV4cCI6MjA3NTgxNTI4OX0.-7WZxzj5IutS9xPTT15U_3XrPDIC_1hbp6SVGkJZ96o"}'::jsonb,
        body:=concat('{"scheduled_run": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);