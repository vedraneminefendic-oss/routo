-- Create missing security infrastructure tables

-- 1. Encryption keys table for personnummer encryption
CREATE TABLE IF NOT EXISTS public.encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_data TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  key_version INTEGER DEFAULT 1
);

ALTER TABLE public.encryption_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.encryption_keys
FOR ALL USING (false);

-- Insert initial encryption key
INSERT INTO public.encryption_keys (key_data, key_version)
VALUES (encode(gen_random_bytes(32), 'base64'), 1);

-- 2. Personnummer access log for GDPR audit trail
CREATE TABLE IF NOT EXISTS public.personnummer_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  ip_address TEXT,
  accessed_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.personnummer_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own access logs" 
ON public.personnummer_access_log FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert logs"
ON public.personnummer_access_log FOR INSERT
WITH CHECK (true);

-- 3. Signature rate limits table
CREATE TABLE IF NOT EXISTS public.signature_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,
  attempt_count INTEGER DEFAULT 1,
  first_attempt_at TIMESTAMPTZ DEFAULT now(),
  last_attempt_at TIMESTAMPTZ DEFAULT now(),
  blocked_until TIMESTAMPTZ,
  UNIQUE (ip_address, quote_id)
);

ALTER TABLE public.signature_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can check own rate limits"
ON public.signature_rate_limits FOR SELECT
USING (true);

CREATE POLICY "Public can insert rate limits"
ON public.signature_rate_limits FOR INSERT
WITH CHECK (true);

CREATE POLICY "Public can update rate limits"
ON public.signature_rate_limits FOR UPDATE
USING (true);

-- Cleanup function for old rate limits (24 hour retention)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM signature_rate_limits
  WHERE last_attempt_at < NOW() - INTERVAL '24 hours';
END;
$$;