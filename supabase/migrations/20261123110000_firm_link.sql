-- A firm's link (slice 5.2, P-2.1; D-1704, D-1713, D-101, D-121, D-1740..D-1749).
--
-- Until now every intake belonged to the default firm, whatever address it was started at (keep_intake_firm). Now the firm is taken from
-- the address the request was made at: at a firm's address the browser sends it in the x-firm-address header (20261117090000), and
-- the database resolves it to a firm here. The browser never sends a firm id, and nothing it sends can move an intake afterwards.
--
-- Restated: public.keep_intake_firm(), from 20261116090000_firms.sql (the newest definition on the base; 20261116180000 and 20261119100000
-- only mention it in comments). Every line is kept, and one branch is added.

-- The firm whose link this address is, when that firm takes intakes now; NULL otherwise (D-1741). The one place the question is written: the trigger
-- below and firm_takes_intakes() both ask it. A firm takes intakes unless it is refused (D-31), suspended, closing or closed. A firm still waiting
-- for approval does: approval gates sending, not receiving. Internal: no API role calls it.
CREATE FUNCTION public.firm_for_intake_link(p_address text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT f.id
  FROM public.firms f
  WHERE f.address = lower(btrim(p_address))
    AND f.decision IS DISTINCT FROM 'refused'
    AND NOT public.firm_is_suspended(f.id)
    AND NOT public.firm_is_read_only(f.id)
$$;

REVOKE ALL ON FUNCTION public.firm_for_intake_link(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.firm_for_intake_link(text) TO service_role;

-- What a firm's page asks before it offers "Get a quote": does the link at this address take intakes? A yes or no, for a signed-out visitor too, and
-- nothing about the firm: not its name, not why a no is a no (a closing firm and an address nobody holds answer alike, as firm_public_name does for a refused
-- or closed one). Not rate limited, like firm_public_name: it reads one row by its exact address and answers a boolean.
CREATE FUNCTION public.firm_takes_intakes(p_address text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.firm_for_intake_link(p_address) IS NOT NULL
$$;

REVOKE ALL ON FUNCTION public.firm_takes_intakes(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.firm_takes_intakes(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.keep_intake_firm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_address text;
  v_firm uuid;
BEGIN
  -- The service role and the superuser place an intake where they like. SECURITY DEFINER runs as the owner, so the caller's role is read
  -- from the role setting the API sets (SET LOCAL ROLE), which stays the caller's.
  IF current_setting('role', true) NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    -- The address as address_admits_firm() reads it (20261118110000): a header that isn't JSON raises, so such a request is refused.
    v_address := NULLIF(lower(btrim(NULLIF(current_setting('request.headers', true), '')::jsonb ->> 'x-firm-address')), '');
    IF v_address IS NULL THEN
      NEW.firm_id := public.default_firm_id();
    ELSE
      v_firm := public.firm_for_intake_link(v_address);
      -- A link that names no firm, or a firm that takes no intakes, starts nothing, and is never filed in the default firm instead (D-1741).
      IF v_firm IS NULL THEN
        RAISE EXCEPTION 'This link doesn''t start an intake' USING ERRCODE = 'PT404';
      END IF;
      NEW.firm_id := v_firm;
    END IF;
  ELSE
    NEW.firm_id := OLD.firm_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.keep_intake_firm() FROM PUBLIC, anon, authenticated;
