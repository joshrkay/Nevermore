-- Merging main's Epic 4 (20261121150000, D-1719a). Main's 20261121150000_epic4_after_merge_records checks, before it does anything else, that the history's two
-- questions still know the commission payments, as they did on main. On this line leads (20261121085500) restated both from a text without them, and the
-- statement that puts them back (20261122200500_main_merged, D-1717) is dated after main's file, so a database built in order stopped at that check. This file
-- is dated just before main's and restates, with both kept, exactly what 20261122200500 restates in its parts 1 and 2: the tables a history may name, and
-- record_history_can_see / record_history_record_exists with main's renewals, placements and commission payments and this line's leads. 20261122200500 states
-- them again, in the same words; nothing else about the history changes. (Main's file stays as it is: it is already applied there.)

-- 1. The tables a history may name: leads (20261121085500) wrote the list out and so dropped renewals, placements and commission_payments.
DO $$
DECLARE
  names text[];
  n text;
BEGIN
  SELECT COALESCE(array_agg(m[1] ORDER BY m[1]), '{}') INTO names
  FROM pg_constraint c, regexp_matches(pg_get_constraintdef(c.oid), '''([a-z0-9_]+)''', 'g') AS m
  WHERE c.contypid = 'public.record_history_table'::regtype AND c.conname = 'record_history_table_known';
  FOREACH n IN ARRAY ARRAY['renewals', 'placements', 'commission_payments', 'leads'] LOOP
    IF NOT n = ANY (names) THEN names := names || n; END IF;
  END LOOP;
  ALTER DOMAIN public.record_history_table DROP CONSTRAINT record_history_table_known;
  EXECUTE format('ALTER DOMAIN public.record_history_table ADD CONSTRAINT record_history_table_known CHECK (VALUE IN (%s))',
    (SELECT string_agg(quote_literal(x), ', ' ORDER BY x) FROM unnest(names) x));
END $$;

-- 2. Who may read a record's history, and whether its record still exists: main's renewals and placements (20261120110000) and commission
-- payments (20261120121000, which spliced its branch into the definition it found) with this line's leads (20261121085500). Leaving the
-- payments branch out made record_exists answer "still there" for a deleted payment, so deleting one was refused (42501).
CREATE OR REPLACE FUNCTION public.record_history_can_see(p_firm_id uuid, p_table public.record_history_table, p_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_firm_id IS NULL OR p_key IS NULL THEN
    RETURN false;
  END IF;
  IF p_table = 'referral_partners' THEN
    RETURN public.is_firm_member(p_firm_id)
      AND EXISTS (SELECT 1 FROM public.referral_partners r WHERE r.firm_id = p_firm_id AND r.code = p_key);
  ELSIF p_table = 'accounts' THEN
    RETURN EXISTS (SELECT 1 FROM public.accounts a WHERE a.firm_id = p_firm_id AND a.id = public.record_history_key_uuid(p_key) AND public.can_see_firm_record(a.firm_id, a.owner_id));
  ELSIF p_table = 'contacts' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.contacts c JOIN public.accounts a ON a.id = c.account_id
      WHERE c.firm_id = p_firm_id AND c.id = public.record_history_key_uuid(p_key) AND public.can_see_firm_record(a.firm_id, a.owner_id));
  ELSIF p_table = 'opportunities' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.opportunities o JOIN public.accounts a ON a.id = o.account_id
      WHERE o.firm_id = p_firm_id AND o.id = public.record_history_key_uuid(p_key) AND public.can_see_firm_record(a.firm_id, a.owner_id));
  ELSIF p_table = 'renewals' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.renewals r JOIN public.accounts a ON a.id = r.account_id
      WHERE r.firm_id = p_firm_id AND r.id = public.record_history_key_uuid(p_key) AND public.can_see_firm_record(a.firm_id, a.owner_id));
  ELSIF p_table = 'placements' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.placements l JOIN public.accounts a ON a.id = l.account_id
      WHERE l.firm_id = p_firm_id AND l.id = public.record_history_key_uuid(p_key) AND public.can_see_firm_record(a.firm_id, a.owner_id));
  ELSIF p_table = 'commission_payments' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.commission_payments p JOIN public.accounts a ON a.id = p.account_id
      WHERE p.firm_id = p_firm_id AND p.id = public.record_history_key_uuid(p_key) AND public.can_see_firm_record(a.firm_id, a.owner_id));
  ELSIF p_table = 'leads' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.firm_id = p_firm_id AND l.id = public.record_history_key_uuid(p_key) AND public.can_see_firm_record(l.firm_id, l.owner_id)
        AND (l.deleted_at IS NULL OR public.firm_role(l.firm_id) = 'owner' OR public.is_support_session(l.firm_id)));
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_history_record_exists(p_firm_id uuid, p_table public.record_history_table, p_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_table = 'referral_partners' THEN
    RETURN EXISTS (SELECT 1 FROM public.referral_partners r WHERE r.firm_id = p_firm_id AND r.code = p_key);
  ELSIF p_table = 'accounts' THEN
    RETURN EXISTS (SELECT 1 FROM public.accounts a WHERE a.firm_id = p_firm_id AND a.id = public.record_history_key_uuid(p_key));
  ELSIF p_table = 'contacts' THEN
    RETURN EXISTS (SELECT 1 FROM public.contacts c WHERE c.firm_id = p_firm_id AND c.id = public.record_history_key_uuid(p_key));
  ELSIF p_table = 'opportunities' THEN
    RETURN EXISTS (SELECT 1 FROM public.opportunities o WHERE o.firm_id = p_firm_id AND o.id = public.record_history_key_uuid(p_key));
  ELSIF p_table = 'renewals' THEN
    RETURN EXISTS (SELECT 1 FROM public.renewals r WHERE r.firm_id = p_firm_id AND r.id = public.record_history_key_uuid(p_key));
  ELSIF p_table = 'placements' THEN
    RETURN EXISTS (SELECT 1 FROM public.placements l WHERE l.firm_id = p_firm_id AND l.id = public.record_history_key_uuid(p_key));
  ELSIF p_table = 'commission_payments' THEN
    RETURN EXISTS (SELECT 1 FROM public.commission_payments p WHERE p.firm_id = p_firm_id AND p.id = public.record_history_key_uuid(p_key));
  ELSIF p_table = 'leads' THEN
    RETURN EXISTS (SELECT 1 FROM public.leads l WHERE l.firm_id = p_firm_id AND l.id = public.record_history_key_uuid(p_key));
  END IF;
  RETURN true;
END;
$$;

