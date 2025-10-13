-- Fix 1: Add SELECT policy for company_settings
CREATE POLICY "Users can view own settings"
ON public.company_settings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Fix 3: Add UPDATE policy for quote_recipients
CREATE POLICY "Users can update recipients for own quotes"
ON public.quote_recipients
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM quotes
    WHERE quotes.id = quote_recipients.quote_id
    AND quotes.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM quotes
    WHERE quotes.id = quote_recipients.quote_id
    AND quotes.user_id = auth.uid()
  )
);

-- Fix 4: Add UPDATE policy for quote_email_logs
CREATE POLICY "Users can update email logs for own quotes"
ON public.quote_email_logs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM quotes
    WHERE quotes.id = quote_email_logs.quote_id
    AND quotes.user_id = auth.uid()
  )
);