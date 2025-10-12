-- Fix security issues in quote_recipients table

-- 1. Remove the dangerous public update policy
DROP POLICY IF EXISTS "Public can update recipients" ON public.quote_recipients;

-- 2. Add secure DELETE policy for quote owners (GDPR compliance)
CREATE POLICY "Users can delete recipients for own quotes" 
ON public.quote_recipients
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.quotes 
    WHERE quotes.id = quote_recipients.quote_id 
    AND quotes.user_id = auth.uid()
  )
);

-- 3. Add unique constraint to prevent multiple signatures per quote (drop first if exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_quote_signature'
  ) THEN
    ALTER TABLE public.quote_signatures 
    ADD CONSTRAINT unique_quote_signature 
    UNIQUE (quote_id, signer_email);
  END IF;
END $$;

-- 4. Add index for rate limiting checks
CREATE INDEX IF NOT EXISTS idx_quote_signatures_quote_id_signed_at 
ON public.quote_signatures(quote_id, signed_at DESC);