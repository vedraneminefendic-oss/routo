-- Create triggers to automatically encrypt personnummer on INSERT/UPDATE

-- Trigger for customers table
CREATE OR REPLACE FUNCTION public.auto_encrypt_customer_personnummer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only encrypt if not already encrypted (base64 encrypted data contains ==)
  IF NEW.personnummer IS NOT NULL 
     AND NEW.personnummer != '' 
     AND NEW.personnummer NOT LIKE '%==%' THEN
    NEW.personnummer := public.encrypt_personnummer(NEW.personnummer);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER encrypt_customer_personnummer
BEFORE INSERT OR UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.auto_encrypt_customer_personnummer();

-- Trigger for quote_recipients table
CREATE OR REPLACE FUNCTION public.auto_encrypt_recipient_personnummer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_personnummer IS NOT NULL 
     AND NEW.customer_personnummer != '' 
     AND NEW.customer_personnummer NOT LIKE '%==%' THEN
    NEW.customer_personnummer := public.encrypt_personnummer(NEW.customer_personnummer);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER encrypt_recipient_personnummer
BEFORE INSERT OR UPDATE ON public.quote_recipients
FOR EACH ROW
EXECUTE FUNCTION public.auto_encrypt_recipient_personnummer();

-- Trigger for quote_signatures table
CREATE OR REPLACE FUNCTION public.auto_encrypt_signature_personnummer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.signer_personnummer IS NOT NULL 
     AND NEW.signer_personnummer != '' 
     AND NEW.signer_personnummer NOT LIKE '%==%' THEN
    NEW.signer_personnummer := public.encrypt_personnummer(NEW.signer_personnummer);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER encrypt_signature_personnummer
BEFORE INSERT OR UPDATE ON public.quote_signatures
FOR EACH ROW
EXECUTE FUNCTION public.auto_encrypt_signature_personnummer();

-- Create helper RPC function for client-side decryption (only for authorized users)
CREATE OR REPLACE FUNCTION public.decrypt_customer_personnummer(customer_id_param UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encrypted_value TEXT;
  decrypted_value TEXT;
BEGIN
  -- Verify user owns this customer
  SELECT personnummer INTO encrypted_value
  FROM public.customers
  WHERE id = customer_id_param AND user_id = auth.uid();
  
  IF encrypted_value IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Decrypt and log access
  decrypted_value := public.decrypt_personnummer(encrypted_value);
  
  INSERT INTO public.personnummer_access_log (user_id, table_name, record_id, action, ip_address)
  VALUES (auth.uid(), 'customers', customer_id_param, 'decrypt', inet_client_addr()::TEXT);
  
  RETURN decrypted_value;
END;
$$;

-- Similar function for quote recipients
CREATE OR REPLACE FUNCTION public.decrypt_recipient_personnummer(recipient_id_param UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encrypted_value TEXT;
  decrypted_value TEXT;
  quote_owner UUID;
BEGIN
  -- Verify user owns the quote this recipient belongs to
  SELECT qr.customer_personnummer, q.user_id INTO encrypted_value, quote_owner
  FROM public.quote_recipients qr
  JOIN public.quotes q ON q.id = qr.quote_id
  WHERE qr.id = recipient_id_param;
  
  IF encrypted_value IS NULL OR quote_owner != auth.uid() THEN
    RETURN NULL;
  END IF;
  
  -- Decrypt and log access
  decrypted_value := public.decrypt_personnummer(encrypted_value);
  
  INSERT INTO public.personnummer_access_log (user_id, table_name, record_id, action, ip_address)
  VALUES (auth.uid(), 'quote_recipients', recipient_id_param, 'decrypt', inet_client_addr()::TEXT);
  
  RETURN decrypted_value;
END;
$$;