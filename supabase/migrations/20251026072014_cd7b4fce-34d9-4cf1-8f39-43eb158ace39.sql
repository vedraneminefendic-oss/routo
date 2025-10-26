-- Add question tracking and conversation summary to conversation_sessions
ALTER TABLE conversation_sessions 
ADD COLUMN IF NOT EXISTS asked_questions TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS answered_topics TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS conversation_summary JSONB DEFAULT '{}'::jsonb;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_asked_questions ON conversation_sessions USING GIN(asked_questions);

COMMENT ON COLUMN conversation_sessions.asked_questions IS 'Array of exact questions asked by AI to prevent repetition';
COMMENT ON COLUMN conversation_sessions.answered_topics IS 'Array of topics that have been discussed';
COMMENT ON COLUMN conversation_sessions.conversation_summary IS 'Rolling summary of key information: project_type, requirements, inclusions, exclusions';