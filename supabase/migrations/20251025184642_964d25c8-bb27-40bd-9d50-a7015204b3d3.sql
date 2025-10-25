-- Lägg till conversation_feedback kolumn för att cacha conversationFeedback och readiness
ALTER TABLE conversation_sessions 
ADD COLUMN IF NOT EXISTS conversation_feedback JSONB;

COMMENT ON COLUMN conversation_sessions.conversation_feedback IS 
'Cached conversation feedback to ensure consistent readiness scores. Format: { message_count: number, data: ConversationFeedback }';