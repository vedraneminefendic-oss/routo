-- Add conversation tracking to quotes and sessions
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS conversation_session_id UUID REFERENCES conversation_sessions(id) ON DELETE SET NULL;

ALTER TABLE conversation_sessions
ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE;

-- Index for better performance
CREATE INDEX IF NOT EXISTS idx_quotes_conversation_session_id ON quotes(conversation_session_id);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_quote_id ON conversation_sessions(quote_id);

COMMENT ON COLUMN quotes.conversation_session_id IS 'Links quote to the conversation that created/updated it';
COMMENT ON COLUMN conversation_sessions.quote_id IS 'Links conversation to the quote being discussed';