-- Schedule update-industry-standards edge function to run weekly
-- This keeps industry knowledge fresh by periodically updating standards

SELECT cron.schedule(
  'update-industry-standards-weekly',
  '0 2 * * 0', -- Every Sunday at 2 AM
  $$
  SELECT
    net.http_post(
        url:='https://jttvujmznirmwdtvmyom.supabase.co/functions/v1/update-industry-standards',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0dHZ1am16bmlybXdkdHZteW9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMzkyODksImV4cCI6MjA3NTgxNTI4OX0.-7WZxzj5IutS9xPTT15U_3XrPDIC_1hbp6SVGkJZ96o"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);