-- Create enum for quote status
CREATE TYPE quote_status AS ENUM ('draft', 'sent', 'signed');

-- Create company_settings table
CREATE TABLE public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  org_number TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  vat_number TEXT,
  has_f_skatt BOOLEAN DEFAULT true,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own settings" ON public.company_settings
  FOR ALL USING (auth.uid() = user_id);

-- Create hourly_rates table
CREATE TABLE public.hourly_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  work_type TEXT NOT NULL,
  rate INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, work_type)
);

ALTER TABLE public.hourly_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own rates" ON public.hourly_rates
  FOR ALL USING (auth.uid() = user_id);

-- Create quote_recipients table
CREATE TABLE public.quote_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES public.quotes(id) ON DELETE CASCADE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_address TEXT,
  customer_personnummer TEXT,
  property_designation TEXT,
  ownership_share DECIMAL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.quote_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view recipients for own quotes" ON public.quote_recipients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quotes 
      WHERE quotes.id = quote_recipients.quote_id 
      AND quotes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert recipients for own quotes" ON public.quote_recipients
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quotes 
      WHERE quotes.id = quote_recipients.quote_id 
      AND quotes.user_id = auth.uid()
    )
  );

CREATE POLICY "Public can update recipients" ON public.quote_recipients
  FOR UPDATE USING (true);

-- Create quote_views table for tracking
CREATE TABLE public.quote_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES public.quotes(id) ON DELETE CASCADE NOT NULL,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

ALTER TABLE public.quote_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert views" ON public.quote_views 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view logs for own quotes" ON public.quote_views
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quotes 
      WHERE quotes.id = quote_views.quote_id 
      AND quotes.user_id = auth.uid()
    )
  );

-- Create quote_signatures table
CREATE TABLE public.quote_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES public.quotes(id) ON DELETE CASCADE NOT NULL,
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  signer_personnummer TEXT,
  property_designation TEXT,
  ip_address TEXT NOT NULL,
  signed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  user_agent TEXT
);

ALTER TABLE public.quote_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can sign" ON public.quote_signatures 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view signatures for own quotes" ON public.quote_signatures
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quotes 
      WHERE quotes.id = quote_signatures.quote_id 
      AND quotes.user_id = auth.uid()
    )
  );

-- Create quote_payments table
CREATE TABLE public.quote_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES public.quotes(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stripe_payment_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.quote_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own payments" ON public.quote_payments
  FOR ALL USING (auth.uid() = user_id);

-- Update quotes table with new columns
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS edited_quote JSONB;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT false;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS unique_token TEXT UNIQUE;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS quote_status quote_status DEFAULT 'draft';

-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for logos
CREATE POLICY "Users can upload own logo" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'company-logos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own logo" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'company-logos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own logo" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'company-logos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Logos are publicly readable" ON storage.objects
  FOR SELECT USING (bucket_id = 'company-logos');

-- Triggers for updated_at
CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hourly_rates_updated_at
  BEFORE UPDATE ON public.hourly_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quote_recipients_updated_at
  BEFORE UPDATE ON public.quote_recipients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();