-- FAS 24: Add refinement tracking columns to conversation_sessions
ALTER TABLE conversation_sessions 
ADD COLUMN IF NOT EXISTS refinement_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_questions_count INTEGER DEFAULT 0;