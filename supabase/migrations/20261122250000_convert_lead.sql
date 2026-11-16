-- Converting a lead (story CRM-L2.2, slice 8.6; docs/BROKER_CRM_BUILD.md D-803, D-807, D-810, D-1653, D-1680 to D-1689).

-- ---------- 1. A lead's calls, notes and tasks may join the account a conversion made ----------
-- activities_guard restated from 20261121100000_merge_records.sql, its newest definition, with every line kept, and one way added for an activity's account to change:
-- a lead's row (no account until now) takes the account its conversion made or chose, while convert_lead says so for its own transaction (as merge_accounts does).
CREATE OR REPLACE FUNCTION public.activities_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  n integer;
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.firm_id IS DISTINCT FROM OLD.firm_id
     OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'A call, note or task can''t be moved to another firm or made into another kind' USING ERRCODE = '42501';
  END IF;
  -- Its account changes only by following its contact or its opportunity, which has already moved there (the same transaction, an earlier statement), and which
  -- the row still names: a different contact or opportunity of the new account in its place is not following. Or by a merge of its account into the new one.
  IF NEW.account_id IS DISTINCT FROM OLD.account_id AND NOT (
       (NEW.contact_id IS NOT NULL AND NEW.contact_id IS NOT DISTINCT FROM OLD.contact_id AND EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = NEW.contact_id AND c.firm_id = NEW.firm_id AND c.account_id = NEW.account_id))
    OR (NEW.opportunity_id IS NOT NULL AND NEW.opportunity_id IS NOT DISTINCT FROM OLD.opportunity_id AND EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = NEW.opportunity_id AND o.firm_id = NEW.firm_id AND o.account_id = NEW.account_id))
    OR COALESCE(current_setting('nevermore.merging_accounts', true), '') = OLD.account_id::text || '>' || NEW.account_id::text
    -- Or a lead's, which had no account, joining the one converting that lead made or chose (convert_lead, D-1681): the lead's id and the account's, together.
    OR (OLD.account_id IS NULL AND OLD.lead_id IS NOT NULL AND NEW.lead_id IS NULL
        AND COALESCE(current_setting('nevermore.converting_lead', true), '') = OLD.lead_id::text || '>' || NEW.account_id::text)) THEN
    RAISE EXCEPTION 'A call, note or task moves to another account only with its contact or its opportunity' USING ERRCODE = '42501';
  END IF;
  IF NEW.author_id IS DISTINCT FROM OLD.author_id AND NEW.author_id IS NOT NULL THEN
    RAISE EXCEPTION 'Who logged a call, note or task can''t be changed' USING ERRCODE = '42501';
  END IF;
  IF OLD.kind = 'note' THEN
    IF NEW.body IS DISTINCT FROM OLD.body OR NEW.at IS DISTINCT FROM OLD.at THEN
      IF OLD.author_id IS NULL OR OLD.author_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Only the person who wrote a note can change it' USING ERRCODE = '42501';
      END IF;
      IF now() >= OLD.created_at + interval '24 hours' THEN
        RAISE EXCEPTION 'A note can''t be changed after a day. Add to it instead.' USING ERRCODE = '42501';
      END IF;
    END IF;
    IF NEW.additions IS DISTINCT FROM OLD.additions THEN
      n := jsonb_array_length(OLD.additions);
      IF jsonb_array_length(NEW.additions) < n OR COALESCE((
           SELECT jsonb_agg(x.e ORDER BY x.i) FROM jsonb_array_elements(NEW.additions) WITH ORDINALITY AS x (e, i) WHERE x.i <= n), '[]'::jsonb)
         IS DISTINCT FROM OLD.additions THEN
        RAISE EXCEPTION 'What was added to a note can''t be changed or taken away' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.activities_guard() FROM PUBLIC, anon, authenticated;

-- ---------- 2. Converting ----------
CREATE FUNCTION public.convert_lead(
  p_lead_id uuid, p_account_id uuid DEFAULT NULL, p_make_contact boolean DEFAULT NULL, p_first_name text DEFAULT NULL, p_last_name text DEFAULT NULL, p_contact_email text DEFAULT NULL, p_contact_phone text DEFAULT NULL,
  p_make_opportunity boolean DEFAULT true, p_opportunity_name text DEFAULT NULL, p_target_start date DEFAULT NULL, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  cur public.leads;
  a public.accounts;
  owner uuid;
  names text[];
  make_contact boolean;
  no_person boolean;
  contact_email text;
  contact_phone text;
  problem text;
  made_account boolean := p_account_id IS NULL;
  c public.contacts;
  opp jsonb;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  cur := public.lead_to_change(firm, p_lead_id);
  -- The bin, Not a fit (reopened first, D-810) and Converted are read, not converted (D-1651).
  IF cur.status = 'converted' AND cur.deleted_at IS NULL THEN
    RAISE EXCEPTION 'This lead was converted already.' USING ERRCODE = '55000';
  ELSIF cur.status = 'not_fit' AND cur.deleted_at IS NULL THEN
    RAISE EXCEPTION 'This lead is Not a fit. Reopen it before converting it.' USING ERRCODE = '55000';
  ELSIF public.lead_read_only_reason(cur) IS NOT NULL THEN
    RAISE EXCEPTION '%', public.lead_read_only_reason(cur) USING ERRCODE = '55000';
  END IF;
  -- What it makes belongs to the lead's owner, or to the person converting when it has none or theirs has left (D-1682). Their membership is held FOR SHARE to the
  -- end of this transaction, as create_account holds an owner's, so a removal either committed first or waits.
  owner := auth.uid();
  IF cur.owner_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.firm_memberships m WHERE m.firm_id = firm AND m.user_id = cur.owner_id AND public.membership_is_current(m.valid_from, m.valid_until) FOR SHARE) THEN
    owner := cur.owner_id;
  END IF;
  -- A business and no person (D-1653): the lead's name is its business's, so there is no one to make a contact of.
  -- Made unless the agent unticked it; with no say, made for a person and not for a business with none.
  no_person := NULLIF(btrim(cur.business), '') IS NOT NULL AND lower(btrim(cur.name)) = lower(btrim(cur.business));
  make_contact := COALESCE(p_make_contact, NOT no_person);
  IF make_contact THEN
    -- What the agent typed on the form, else the lead's own: the last word of its name is the last name (crm_split_person_name, as the chain splits a prospect's).
    names := CASE WHEN no_person THEN ARRAY[NULL, NULL]::text[] ELSE public.crm_split_person_name(cur.name) END;
    IF NULLIF(btrim(p_last_name), '') IS NOT NULL THEN
      names := ARRAY[NULLIF(btrim(p_first_name), ''), NULLIF(btrim(p_last_name), '')];
    END IF;
    contact_email := COALESCE(NULLIF(btrim(p_contact_email), ''), NULLIF(btrim(cur.email), ''));
    contact_phone := COALESCE(NULLIF(btrim(p_contact_phone), ''), NULLIF(btrim(cur.phone), ''));
    problem := public.contact_input_error(names[1], names[2], NULLIF(btrim(cur.title), ''), contact_email, contact_phone, NULL);
    IF problem IS NOT NULL THEN
      RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
    END IF;
  END IF;
  IF made_account THEN
    INSERT INTO public.accounts (firm_id, owner_id, name, city, state, employees, current_provider, source)
    VALUES (firm, owner, COALESCE(NULLIF(btrim(cur.business), ''), cur.name), cur.city, cur.state, cur.employees, cur.current_provider, 'lead')
    RETURNING * INTO a;
  ELSE
    -- An account the agent may see (PT404 for any other), held FOR SHARE as add_contact holds it; what is on it is the agent's to add to, not the lead's to overwrite.
    SELECT * INTO a FROM public.accounts x WHERE x.id = p_account_id AND x.firm_id = firm FOR SHARE;
    IF a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
      RAISE EXCEPTION 'That account isn''t available' USING ERRCODE = 'PT404';
    END IF;
    IF a.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'This account is archived. Nothing can be added to it.' USING ERRCODE = '55000';
    END IF;
    owner := auth.uid();
  END IF;
  IF make_contact THEN
    INSERT INTO public.contacts (firm_id, account_id, owner_id, first_name, last_name, title, email, phone, is_main)
    VALUES (firm, a.id, owner, names[1], names[2], NULLIF(btrim(cur.title), ''), contact_email, contact_phone,
            NOT EXISTS (SELECT 1 FROM public.contacts m WHERE m.account_id = a.id AND m.is_main))
    RETURNING * INTO c;
  END IF;
  IF COALESCE(p_make_opportunity, true) THEN
    opp := public.opportunity_create(a.id, COALESCE(NULLIF(btrim(p_opportunity_name), ''), a.name || ' – PEO search'), p_target_start, cur.employees, c.id, NULL::date, NULL::numeric, NULL::text, NULL::text, NULL::text, owner, firm);
  END IF;
  -- The lead's calls, notes and tasks, and their contact when it has one (D-1681). Added to, nothing replaced (ADR 0007).
  PERFORM set_config('nevermore.converting_lead', cur.id::text || '>' || a.id::text, true);
  UPDATE public.activities SET account_id = a.id, contact_id = c.id, lead_id = NULL WHERE lead_id = cur.id AND firm_id = firm;
  PERFORM set_config('nevermore.converting_lead', '', true);
  -- The lead's own note (what a visitor asked, what an agent jotted) is a field, not a row, so it is carried over as a note on the account and the contact (D-1681).
  IF NULLIF(btrim(cur.note), '') IS NOT NULL THEN
    INSERT INTO public.activities (firm_id, account_id, contact_id, kind, author_id, body) VALUES (firm, a.id, c.id, 'note', auth.uid(), btrim(cur.note));
  END IF;
  -- Its conversation, with its reply address, goes to the contact (D-606): the messages stay on it. With no contact made it stays on the lead.
  IF c.id IS NOT NULL THEN
    UPDATE public.conversations SET contact_id = c.id, lead_id = NULL WHERE lead_id = cur.id AND firm_id = firm;
  END IF;
  -- Its labels, from the firm's one list (D-805).
  INSERT INTO public.account_labels (firm_id, account_id, label_id, added_by)
  SELECT ll.firm_id, a.id, ll.label_id, ll.added_by FROM public.lead_labels ll WHERE ll.lead_id = cur.id ON CONFLICT (account_id, label_id) DO NOTHING;
  UPDATE public.leads SET status = 'converted', converted_account_id = a.id, converted_contact_id = c.id, converted_opportunity_id = (opp -> 'record' ->> 'id')::uuid,
    converted_at = now() WHERE id = cur.id;
  RETURN jsonb_build_object('account', public.crm_account_fields(a) || jsonb_build_object('created', made_account), 'contact', CASE WHEN c.id IS NULL THEN NULL ELSE public.crm_contact_fields(c) END, 'opportunity', opp -> 'record');
END;
$$;

REVOKE ALL ON FUNCTION public.convert_lead(uuid, uuid, boolean, text, text, text, text, boolean, text, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_lead(uuid, uuid, boolean, text, text, text, text, boolean, text, date, uuid) TO authenticated;

-- ---------- 3. What the Convert dialog needs ----------
-- {matches: [{id, name, city, state, reasons}]}: the firm's accounts that may be the same business as the lead (the duplicate match, D-193, by duplicates_of_account: the
-- same name and state, or a contact with the lead's email), each only where the caller may see it and not one that is archived (it takes nothing new, D-222), the
-- earliest first and at most ten. A match the caller may not see is never named: "use an existing account" offers what they could use. A read, so a closing firm and
-- a support session may ask it as they ask every other read; the lead must be one the caller sees (PT404 otherwise, as for one that is not there).
CREATE FUNCTION public.lead_convert_context(p_firm_id uuid, p_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  l public.leads;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  SELECT * INTO l FROM public.leads x WHERE x.id = p_lead_id AND x.firm_id = firm;
  IF NOT COALESCE(public.lead_visible(l), false) THEN
    RAISE EXCEPTION 'That lead isn''t available' USING ERRCODE = 'PT404';
  END IF;
  RETURN jsonb_build_object('matches', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'city', m.city, 'state', m.state, 'reasons', to_jsonb(m.reasons)) ORDER BY m.created_at, m.id)
    FROM (
      SELECT a.id, a.name, a.city, a.state, a.created_at, d.reasons
      FROM public.duplicates_of_account(firm, NULL, COALESCE(NULLIF(btrim(l.business), ''), l.name), l.state, NULLIF(btrim(l.email), '')) d
      JOIN public.accounts a ON a.id = d.account_id
      WHERE a.archived_at IS NULL AND public.can_see_firm_record(a.firm_id, a.owner_id)
      ORDER BY a.created_at, a.id LIMIT 10) m), '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.lead_convert_context(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lead_convert_context(uuid, uuid) TO authenticated;
