-- The possible-duplicate mark on an account's page (story CRM-S4.3a; docs/BROKER_CRM_BUILD.md D-193, D-645, D-660).
--
-- The mark has existed since CRM-Q1.1b (`accounts.possible_duplicate_of`), and merging and "keep separate" since CRM-S4.3b, but the account's page did not say it,
-- so the screen could not offer either. `account_page` now answers `possible_duplicate_of` inside `account`: null when the account carries no mark, {id, name} of the
-- marked account when the caller may see it, and {id: null, name: null} when it is another person's to see (the banner then says only that one exists, as D-603 does
-- for a match). Nothing else about the page changes: the same function, the same grant, the same one read.
CREATE OR REPLACE FUNCTION public.account_page(p_firm_id uuid, p_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  a public.accounts;
  d public.accounts;
  partner text;
  dup jsonb;
BEGIN
  IF p_firm_id IS NULL OR p_account_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT * INTO a FROM public.accounts x WHERE x.id = p_account_id AND x.firm_id = p_firm_id;
  IF a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RETURN NULL;
  END IF;
  IF a.source = 'employer_intake' THEN
    -- The account's first intake is the one on its earliest opportunity that holds one; the partner is whoever's link that intake came by, if any.
    SELECT r.name INTO partner
    FROM (SELECT o.intake_id FROM public.opportunities o WHERE o.account_id = a.id AND o.intake_id IS NOT NULL ORDER BY o.created_at, o.id LIMIT 1) first_intake
    JOIN public.chamber_sessions s ON s.id = first_intake.intake_id
    LEFT JOIN public.referral_partners r ON r.firm_id = a.firm_id AND r.code = s.referral_code;
  END IF;
  IF a.possible_duplicate_of IS NOT NULL THEN
    SELECT * INTO d FROM public.accounts x WHERE x.id = a.possible_duplicate_of AND x.firm_id = a.firm_id;
    dup := CASE WHEN d.id IS NOT NULL AND public.can_see_firm_record(d.firm_id, d.owner_id)
                THEN jsonb_build_object('id', d.id, 'name', d.name)
                ELSE jsonb_build_object('id', NULL, 'name', NULL) END;
  END IF;
  RETURN jsonb_build_object(
    'account', public.crm_account_fields(a) || jsonb_build_object(
      'status', public.account_status(a.id),
      'owner', CASE WHEN a.owner_id IS NULL THEN NULL ELSE jsonb_build_object('id', a.owner_id, 'name', public.crm_person_name(a.owner_id)) END,
      'source_partner', partner,
      'possible_duplicate_of', dup),
    'can_change', public.can_change_firm_record(a.firm_id, a.owner_id),
    'tabs', jsonb_build_object(
      'contacts', public.account_tab_rows(a.id, 'contacts', 5, 0),
      'opportunities', public.account_tab_rows(a.id, 'opportunities', 5, 0),
      'quotes', public.account_tab_rows(a.id, 'quotes', 5, 0),
      'activity', public.account_tab_rows(a.id, 'activity', 5, 0),
      'files', public.account_tab_rows(a.id, 'files', 5, 0)));
END;
$$;

REVOKE ALL ON FUNCTION public.account_page(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_page(uuid, uuid) TO authenticated;
