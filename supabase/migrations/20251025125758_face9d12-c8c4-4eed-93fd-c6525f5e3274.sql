-- Add new columns to conversation_sessions for conversation intelligence
ALTER TABLE conversation_sessions 
ADD COLUMN IF NOT EXISTS answered_questions JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS conversation_stage TEXT DEFAULT 'gathering_details' CHECK (conversation_stage IN ('gathering_details', 'ready_to_quote', 'refinement', 'quote_generated')),
ADD COLUMN IF NOT EXISTS readiness_score INTEGER DEFAULT 0 CHECK (readiness_score >= 0 AND readiness_score <= 100);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_stage ON conversation_sessions(conversation_stage);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_readiness ON conversation_sessions(readiness_score);