-- The duplicate warning for a new lead (CRM-S4.2 for leads; docs/BROKER_READINESS_PRD.md BR-5.4; docs/BROKER_CRM_BUILD.md "## Leads catch up", D-2340 on;
-- supabase/tests/lead_duplicates.sql). While a person types a new lead, the database says which of the firm's leads and accounts may be the same, as it
-- does for a new account (20261121090000_spot_a_duplicate.sql): one the person may see is named, one they may not is only said to exist, with whom to ask.
-- Advice only: it never stops a save. No table is added.

SET lock_timeout = '5s';

-- A lead of the firm that is not in the bin matches by its email, whatever its capitals, or by its name and business together, whatever their capitals
-- and spacing. An account matches as a new account's warning finds one, given the lead's business as its name: the same name and state, or a contact
-- with that email.
CREATE FUNCTION public.duplicate_lead_check(p_firm_id uuid, p_name text, p_business text, p_email text, p_state text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  name_in text := lower(regexp_replace(btrim(COALESCE(p_name, '')), '\s+', ' ', 'g'));
  business_in text := lower(regexp_replace(btrim(COALESCE(p_business, '')), '\s+', ' ', 'g'));
  email_in text := NULLIF(lower(btrim(COALESCE(p_email, ''))), '');
  seen jsonb;
  more integer;
  masked jsonb;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  WITH found AS (
    SELECT 'lead'::text AS kind, l.id, l.name, NULLIF(btrim(l.business), '') AS business, l.status, l.owner_id, l.created_at,
           ARRAY_REMOVE(ARRAY[CASE WHEN email_in IS NOT NULL AND lower(l.email) = email_in THEN 'email' END,
                              CASE WHEN name_in <> '' AND business_in <> '' AND lower(regexp_replace(btrim(l.name), '\s+', ' ', 'g')) = name_in
                                        AND lower(regexp_replace(btrim(COALESCE(l.business, '')), '\s+', ' ', 'g')) = business_in THEN 'name' END], NULL) AS reasons
    FROM public.leads l
    WHERE l.firm_id = firm AND l.deleted_at IS NULL
    UNION ALL
    SELECT 'account', a.id, a.name, NULL, CASE WHEN a.archived_at IS NULL THEN NULL ELSE 'archived' END, a.owner_id, a.created_at, d.reasons
    FROM public.duplicates_of_account(firm, NULL, NULLIF(btrim(COALESCE(p_business, '')), ''), upper(NULLIF(btrim(COALESCE(p_state, '')), '')), email_in) d
    JOIN public.accounts a ON a.id = d.account_id
  ), hits AS (
    SELECT f.*, public.can_see_firm_record(firm, f.owner_id) AS visible FROM found f WHERE cardinality(f.reasons) > 0
  ), ranked AS (
    SELECT h.*, row_number() OVER (ORDER BY h.created_at, h.id) AS n FROM hits h WHERE h.visible
  )
  SELECT COALESCE((SELECT jsonb_agg(jsonb_build_object('kind', r.kind, 'visible', true, 'id', r.id, 'name', r.name, 'business', r.business, 'status', r.status,
                                                       'reasons', to_jsonb(r.reasons), 'owner', public.crm_person_name(r.owner_id)) ORDER BY r.n)
                   FROM ranked r WHERE r.n <= 5), '[]'::jsonb),
         GREATEST((SELECT count(*) FROM ranked) - 5, 0)::integer,
         -- The ones the person may not see: one mask for each kind and each set of people to ask. Nothing of the record is read but whom to ask.
         COALESCE((SELECT jsonb_agg(jsonb_build_object('kind', q.kind, 'visible', false, 'ask', q.ask) ORDER BY q.first_at)
                   FROM (SELECT h.kind, public.duplicate_who_to_ask(firm, h.owner_id) AS ask, min(h.created_at) AS first_at FROM hits h WHERE NOT h.visible GROUP BY 1, 2) q), '[]'::jsonb)
  INTO seen, more, masked;
  RETURN jsonb_build_object('matches', seen || masked, 'more', more);
END;
$$;

REVOKE ALL ON FUNCTION public.duplicate_lead_check(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicate_lead_check(uuid, text, text, text, text) TO authenticated;
