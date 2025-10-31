-- Åtgärda säkerhetsvarning: Flytta pg_net från public till extensions schema
-- Detta följer Supabase best practices för extensions

-- 1. Ta bort från public schema
DROP EXTENSION IF EXISTS pg_net CASCADE;

-- 2. Installera i extensions schema (Supabase-rekommenderat)
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 3. Uppdatera trigger-funktionen att använda extensions.net
CREATE OR REPLACE FUNCTION trigger_learn_from_accepted_quote()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supabase_url TEXT;
  supabase_key TEXT;
  request_id BIGINT;
BEGIN
  -- Kolla om offerten precis accepterades
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    
    -- Hämta Supabase URL och nyckel från secrets
    supabase_url := current_setting('app.settings.supabase_url', true);
    supabase_key := current_setting('app.settings.supabase_service_role_key', true);
    
    -- Om secrets inte finns, använd environment variables
    IF supabase_url IS NULL THEN
      supabase_url := 'https://jttvujmznirmwdtvmyom.supabase.co';
    END IF;
    
    -- Gör asynkront HTTP POST-anrop till edge function via extensions schema
    SELECT INTO request_id extensions.net.http_post(
      url := supabase_url || '/functions/v1/learn-from-accepted-quote',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(supabase_key, '')
      ),
      body := jsonb_build_object(
        'quoteId', NEW.id::text
      )
    );
    
    -- Logga för debugging
    RAISE NOTICE '📚 Triggered learning from accepted quote: % (request_id: %)', NEW.id, request_id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;