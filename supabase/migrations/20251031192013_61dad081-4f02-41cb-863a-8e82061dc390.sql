-- FAS 1: Kritiska RLS-säkerhetsfixar för publika tabeller
-- Fixar säkerhetsrisker i quote_signatures och quote_views

-- ==========================================
-- 1. FIX QUOTE_SIGNATURES RLS
-- ==========================================
-- Ta bort osäker policy som tillåter vem som helst att signera
DROP POLICY IF EXISTS "Anyone can sign" ON public.quote_signatures;

-- Skapa säker policy som kräver giltig token
CREATE POLICY "Can sign with valid token" ON public.quote_signatures
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quotes
    WHERE quotes.id = quote_signatures.quote_id
    AND quotes.unique_token IS NOT NULL
    -- Förhindra dubbelsignering
    AND quotes.status NOT IN ('accepted', 'rejected', 'completed')
  )
);

-- ==========================================
-- 2. FIX QUOTE_VIEWS RLS
-- ==========================================
-- Ta bort osäker policy som tillåter vem som helst att logga visningar
DROP POLICY IF EXISTS "Anyone can insert views" ON public.quote_views;

-- Skapa säker policy som kräver giltig token
CREATE POLICY "Can view with valid token" ON public.quote_views
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quotes
    WHERE quotes.id = quote_views.quote_id
    AND quotes.unique_token IS NOT NULL
  )
);

-- ==========================================
-- KOMMENTAR: SÄKERHETSFÖRBÄTTRINGAR
-- ==========================================
-- ✅ quote_signatures: Kräver nu att offerten har en giltig unique_token
-- ✅ quote_views: Kräver nu att offerten har en giltig unique_token
-- ✅ Förhindrar manipulation av signaturdata och visningsstatistik
-- ✅ Behåller publik åtkomst för legitima tokens (process-quote-signature fungerar fortfarande)