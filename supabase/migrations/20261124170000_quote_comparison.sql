-- The broker's comparison of an opportunity's quotes, and the notes on it (N-3.1, N-3.2, slice 7.7; docs/BROKER_CRM_BUILD.md "### 7.7 N-3.1, N-3.2 decisions",
-- D-770 to D-779; supabase/tests/quote_comparison.sql).

-- ---------- 1. The broker's notes on a comparison ----------
-- A note is about an opportunity's comparison (D-774): optionally about one PEO's column (quote_request_id) and, within it, one cost area, marked internal or for the
-- client (N-3.2). No API role reads or writes the table: the comparison reads its notes and add_comparison_note writes them, both SECURITY DEFINER.
CREATE TABLE public.quote_comparison_notes (
  id bigserial PRIMARY KEY,
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities (id) ON DELETE CASCADE,
  quote_request_id bigint REFERENCES public.quote_requests (id) ON DELETE CASCADE,
  area text,
  visibility text NOT NULL,
  body text NOT NULL,
  author_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quote_comparison_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_comparison_notes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.quote_comparison_notes_id_seq FROM PUBLIC, anon, authenticated;
CREATE INDEX quote_comparison_notes_opportunity_idx ON public.quote_comparison_notes (opportunity_id, id DESC);

CREATE FUNCTION public.add_comparison_note(
  p_firm_id uuid, p_opportunity_id uuid, p_quote_request_id bigint, p_area text, p_visibility text, p_body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  n public.quote_comparison_notes;
BEGIN
  INSERT INTO public.quote_comparison_notes (firm_id, opportunity_id, quote_request_id, area, visibility, body, author_id)
  VALUES (p_firm_id, p_opportunity_id, p_quote_request_id, p_area, p_visibility, btrim(p_body), auth.uid())
  RETURNING * INTO n;
  RETURN jsonb_build_object('id', n.id, 'body', n.body);
END;
$$;

REVOKE ALL ON FUNCTION public.add_comparison_note(uuid, uuid, bigint, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_comparison_note(uuid, uuid, bigint, text, text, text) TO authenticated;

-- ---------- 2. The comparison ----------
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
      SELECT jsonb_agg(jsonb_build_object('quote_request_id', q.id, 'peo_name', q.peo_name, 'status', q.status,
                                          'quote', CASE WHEN cq.id IS NULL THEN NULL ELSE jsonb_build_object(
                                            'id', cq.id, 'kind', cq.kind, 'received_on', cq.received_on, 'expires_on', cq.expires_on, 'proposed_start_on', cq.proposed_start_on,
                                            'admin_fee', cq.admin_fee, 'admin_fee_basis', cq.admin_fee_basis,
                                            -- A cost area left out is NULL and stays JSON null here, never [] or 0 (D-721); the screen reads "Not quoted" from it.
                                            'one_off_fees', cq.one_off_fees, 'workers_comp', cq.workers_comp, 'unemployment', cq.unemployment, 'medical', cq.medical,
                                            'note', cq.note) END)
                       ORDER BY lower(q.peo_name), q.id)
      FROM public.quote_requests q
      -- The current quote is the newest row of the quote request (D-720).
      LEFT JOIN LATERAL (SELECT x.* FROM public.quotes x WHERE x.quote_request_id = q.id ORDER BY x.id DESC LIMIT 1) cq ON true
      WHERE q.session_id = o.intake_id), '[]'::jsonb),
    -- The notes on it, newest first.
    'notes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', n.id, 'quote_request_id', n.quote_request_id, 'area', n.area, 'visibility', n.visibility, 'body', n.body,
                                          'author', public.crm_person_name(n.author_id), 'created_at', n.created_at) ORDER BY n.id DESC)
      FROM public.quote_comparison_notes n WHERE n.opportunity_id = o.id), '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.opportunity_quote_comparison(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.opportunity_quote_comparison(uuid, uuid) TO authenticated;
