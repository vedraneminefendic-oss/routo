-- Fix security warning: Set search_path for existing function
DROP FUNCTION IF EXISTS update_conversations_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION update_conversations_updated_at()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER update_conversations_timestamp
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_conversations_updated_at();