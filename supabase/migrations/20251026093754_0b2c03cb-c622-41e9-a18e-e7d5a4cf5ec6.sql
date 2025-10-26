-- Fas 1: Lägg till uppföljnings-kolumner i quotes-tabellen
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS next_followup_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS followup_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS auto_followup_enabled BOOLEAN DEFAULT true;

-- Index för snabbare queries av offerter som behöver följas upp
CREATE INDEX IF NOT EXISTS idx_quotes_next_followup 
ON quotes(next_followup_at) 
WHERE status IN ('sent', 'viewed') AND auto_followup_enabled = true;

-- Index för att hitta offerter som inte fått followup
CREATE INDEX IF NOT EXISTS idx_quotes_pending_followup
ON quotes(status, sent_at, viewed_at)
WHERE status IN ('sent', 'viewed') AND auto_followup_enabled = true;