-- DEL 2.1: Auto-trigger för learn-from-accepted-quote
-- Denna migration skapar en trigger som automatiskt kallar på edge function
-- learn-from-accepted-quote när en offert accepteras

-- 1. Aktivera pg_net extension för HTTP-anrop från databasen
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Skapa funktion som triggar edge function när offert accepteras
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
    
    -- Gör asynkront HTTP POST-anrop till edge function
    SELECT INTO request_id net.http_post(
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

-- 3. Skapa trigger som körs efter varje uppdatering av quotes
DROP TRIGGER IF EXISTS auto_learn_from_accepted ON quotes;

CREATE TRIGGER auto_learn_from_accepted
AFTER UPDATE ON quotes
FOR EACH ROW
WHEN (NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted'))
EXECUTE FUNCTION trigger_learn_from_accepted_quote();

-- 4. Kommentar för dokumentation
COMMENT ON FUNCTION trigger_learn_from_accepted_quote() IS 
'Automatiskt triggar learn-from-accepted-quote edge function när en offert accepteras. 
Detta skapar accepted_work_patterns som används för AI-learning.';

COMMENT ON TRIGGER auto_learn_from_accepted ON quotes IS
'Triggar automatisk learning när quotes.status ändras till accepted';