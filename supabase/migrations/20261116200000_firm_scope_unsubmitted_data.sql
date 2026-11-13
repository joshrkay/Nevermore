-- What has no submission behind it is scoped to the firm (story CRM-P2.1c).
--
-- CRM-P2.1a scoped the tables that hang off an intake, and CRM-P2.1b the functions over them. Four kinds of data are
-- reached through no intake, so neither story could scope them by the intake's firm: a firm's referral partners, who is
-- told about a new submission, held mail (inbound mail that matched no quote request) and the broker's own mailbox. Each
-- is given its firm here, and every function over it asks the caller's membership of that firm (D-18), taking the firm
-- from the row and never from the browser. The new-mail mark (quote_request_thread_reads) is the firm's, shared by its
-- members as the thread is (CRM-H1: "opening the record clears a new-mail line for everyone who can see it"), and is
-- scoped by its quote request already (CRM-P2.1a, CRM-P2.1b), so nothing here changes it.

-- The firm a function acts for. A call may name the firm; the caller must be a current member of it. A call that names
-- none acts for the caller's only current firm, and a caller with none, or with several, is told so: the database never
-- guesses a firm for a person who belongs to more than one. Called by functions that run as their owner, never through the API.
CREATE FUNCTION public.firm_to_act_for(p_firm_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  firms uuid[];
BEGIN
  IF p_firm_id IS NOT NULL THEN
    IF NOT public.is_firm_member(p_firm_id) THEN
      RAISE EXCEPTION 'Not a member of that firm' USING ERRCODE = '42501';
    END IF;
    RETURN p_firm_id;
  END IF;
  SELECT array_agg(DISTINCT m.firm_id) INTO firms
  FROM public.firm_memberships m
  WHERE m.user_id = auth.uid() AND public.is_firm_member(m.firm_id);
  IF firms IS NULL THEN
    RAISE EXCEPTION 'Not a member of a firm' USING ERRCODE = '42501';
  END IF;
  IF cardinality(firms) > 1 THEN
    RAISE EXCEPTION 'You belong to more than one firm: say which' USING ERRCODE = '22023';
  END IF;
  RETURN firms[1];
END;
$$;
REVOKE ALL ON FUNCTION public.firm_to_act_for(uuid) FROM PUBLIC, anon, authenticated;

-- ---------- 1. Referral partners ----------
-- A partner and its link code are a firm's own. Every partner so far is Edgar Allan Advisory's (every intake was, before
-- P-1.1). A code is unique within a firm, never across firms: a firm is not told another firm has a partner under a code.
ALTER TABLE public.referral_partners ADD COLUMN firm_id uuid REFERENCES public.firms (id);
UPDATE public.referral_partners SET firm_id = public.default_firm_id();
ALTER TABLE public.referral_partners ALTER COLUMN firm_id SET NOT NULL;
ALTER TABLE public.referral_partners DROP CONSTRAINT referral_partners_pkey;
ALTER TABLE public.referral_partners ADD PRIMARY KEY (firm_id, code);

DROP POLICY referral_partners_firm_read ON public.referral_partners;
CREATE POLICY referral_partners_firm_read ON public.referral_partners
  FOR SELECT TO authenticated USING (public.is_firm_member(firm_id));

DROP FUNCTION public.advisor_add_referral_partner(text, text, text);
CREATE FUNCTION public.advisor_add_referral_partner(p_code text, p_name text, p_kind text, p_firm_id uuid DEFAULT NULL)
RETURNS public.referral_partners
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code_in text := lower(btrim(COALESCE(p_code, '')));
  problem text := public.referral_partner_input_error(p_name, p_kind);
  firm uuid;
  added public.referral_partners;
BEGIN
  PERFORM public.require_advisor();
  firm := public.firm_to_act_for(p_firm_id);
  IF NOT COALESCE(public.is_source_code(code_in), false) THEN
    RAISE EXCEPTION 'A referral code is 1 to 64 lowercase letters, digits, dots, hyphens or underscores, starting with a letter or digit.'
      USING ERRCODE = '22023';
  END IF;
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.referral_partners (firm_id, code, name, kind, created_by_email, updated_by_email)
  VALUES (firm, code_in, btrim(p_name), p_kind, auth.jwt() ->> 'email', auth.jwt() ->> 'email')
  ON CONFLICT (firm_id, code) DO NOTHING
  RETURNING * INTO added;
  IF added.code IS NULL THEN
    RAISE EXCEPTION 'The code % is already a partner''s. Choose another.', code_in USING ERRCODE = '23505', DETAIL = code_in;
  END IF;
  RETURN added;
END;
$$;
REVOKE ALL ON FUNCTION public.advisor_add_referral_partner(text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_add_referral_partner(text, text, text, uuid) TO authenticated;

DROP FUNCTION public.advisor_update_referral_partner(text, text, text);
CREATE FUNCTION public.advisor_update_referral_partner(p_code text, p_name text, p_kind text, p_firm_id uuid DEFAULT NULL)
RETURNS public.referral_partners
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  problem text := public.referral_partner_input_error(p_name, p_kind);
  firm uuid;
  changed public.referral_partners;
BEGIN
  PERFORM public.require_advisor();
  firm := public.firm_to_act_for(p_firm_id);
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  UPDATE public.referral_partners
  SET name = btrim(p_name), kind = p_kind, updated_at = now(), updated_by_email = auth.jwt() ->> 'email'
  WHERE firm_id = firm AND code = lower(btrim(COALESCE(p_code, '')))
  RETURNING * INTO changed;
  IF changed.code IS NULL THEN
    RAISE EXCEPTION 'No partner has that code' USING ERRCODE = 'PT404';
  END IF;
  RETURN changed;
END;
$$;
REVOKE ALL ON FUNCTION public.advisor_update_referral_partner(text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_update_referral_partner(text, text, text, uuid) TO authenticated;

-- The funnel by source names the partner behind a code: the firm's own partner, never another firm's under the same code.
CREATE OR REPLACE FUNCTION public.advisor_intake_sources(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS TABLE(referral_code text, partner_name text, utm_source text, utm_medium text, utm_campaign text, started bigint, answered bigint, document_uploaded bigint, census_provided bigint, ready_to_certify bigint, email_verified bigint, certified bigint, manuscript_downloaded bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
BEGIN
  PERFORM public.require_advisor();
  IF p_from IS NULL OR p_to IS NULL OR p_from >= p_to THEN
    RAISE EXCEPTION 'The period must start before it ends' USING ERRCODE = '22023';
  END IF;
  IF p_to - p_from > interval '366 days' THEN
    RAISE EXCEPTION 'The funnel covers at most a year at once' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT m.referral_code, p.name, m.utm_source, m.utm_medium, m.utm_campaign,
           count(*) FILTER (WHERE m.milestone = 'started'),
           count(*) FILTER (WHERE m.milestone = 'answered'),
           count(*) FILTER (WHERE m.milestone = 'document_uploaded'),
           count(*) FILTER (WHERE m.milestone = 'census_provided'),
           count(*) FILTER (WHERE m.milestone = 'ready_to_certify'),
           count(*) FILTER (WHERE m.milestone = 'email_verified'),
           count(*) FILTER (WHERE m.milestone = 'certified'),
           count(*) FILTER (WHERE m.milestone = 'manuscript_downloaded')
    FROM public.intake_milestones m
    LEFT JOIN public.referral_partners p ON p.code = m.referral_code AND p.firm_id = m.firm_id
    WHERE m.started_at >= p_from AND m.started_at < p_to AND public.is_firm_member(m.firm_id)
    GROUP BY m.referral_code, p.name, m.utm_source, m.utm_medium, m.utm_campaign
    ORDER BY count(*) FILTER (WHERE m.milestone = 'started') DESC,
             m.referral_code NULLS LAST, m.utm_source NULLS LAST, m.utm_medium NULLS LAST, m.utm_campaign NULLS LAST
    LIMIT 200;
END;
$function$;
