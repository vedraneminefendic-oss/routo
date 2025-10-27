-- Add refinement_requested column to conversation_sessions table
-- This enables the two-stage quote generation process where users can optionally refine draft quotes

ALTER TABLE conversation_sessions 
ADD COLUMN IF NOT EXISTS refinement_requested boolean DEFAULT false;