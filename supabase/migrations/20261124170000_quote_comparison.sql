-- The broker's comparison of an opportunity's quotes, and the notes on it (N-3.1, N-3.2, slice 7.7; docs/BROKER_CRM_BUILD.md "### 7.7 N-3.1, N-3.2 decisions",
-- D-770 to D-779; supabase/tests/quote_comparison.sql).

-- ---------- 1. The comparison ----------
-- One column for each quote request of the opportunity's intake, alphabetical by PEO (as opportunity_page lists them), read as opportunity_page is: by whoever sees
-- the opportunity's account, one refusal (PT404) for an opportunity that is not there, is another firm's or may not be seen.
CREATE FUNCTION public.opportunity_quote_comparison(p_firm_id uuid, p_opportunity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  o public.opportunities;
  a public.accounts;
BEGIN
  IF p_firm_id IS NOT NULL AND p_opportunity_id IS NOT NULL THEN
    SELECT * INTO o FROM public.opportunities x WHERE x.id = p_opportunity_id AND x.firm_id = p_firm_id;
    SELECT * INTO a FROM public.accounts x WHERE x.id = o.account_id AND x.firm_id = o.firm_id;
  END IF;
  IF o.id IS NULL OR a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RAISE EXCEPTION 'That opportunity isn''t available' USING ERRCODE = 'PT404';
  END IF;
  RETURN jsonb_build_object(
    'columns', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('quote_request_id', q.id, 'peo_name', q.peo_name, 'status', q.status, 'quote', NULL::jsonb)
                       ORDER BY lower(q.peo_name), q.id)
      FROM public.quote_requests q WHERE q.session_id = o.intake_id), '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.opportunity_quote_comparison(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.opportunity_quote_comparison(uuid, uuid) TO authenticated;
