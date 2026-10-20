-- Carry the company name entered at sign-up into the profile row.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, company_name)
  VALUES (NEW.id, NULLIF(trim(NEW.raw_user_meta_data ->> 'company_name'), ''));
  RETURN NEW;
END;
$$;

-- Signed attestation captured in The Reckoning (signer, title, timestamp, file id).
ALTER TABLE public.chamber_sessions
  ADD COLUMN submission jsonb;
