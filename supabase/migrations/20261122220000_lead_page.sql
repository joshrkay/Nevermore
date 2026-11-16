-- A lead's page, the database side (story CRM-L2.1, slice 8.5, screen 15; docs/BROKER_CRM_BUILD.md D-803, D-806 to D-810, D-1650 to D-1659; GLOSSARY.md
-- "Lead"; ADR 0007, ADR 0023, ADR 0024; 20261121090000_leads.sql, 20261121100000_create_lead.sql, 20261119180000_calls_notes_tasks.sql,
-- 20261119240000_contact_page.sql; supabase/tests/lead_page.sql).
--
-- What this is. What a lead's page draws, asked of the database, and every write the page makes. A lead is seen and changed by the level rule on its own owner
-- (D-809, can_see_firm_record and can_change_firm_record, as the leads table's row security reads it); one in the bin only by an owner or support (D-806).
--
--   lead_page(firm, lead)                    The page in one read. NULL, the same as for a lead that is not there, to anyone who may not see it.

-- ---------- 1. Who sees a lead ----------
-- The leads table's own row rule (20261121090000, leads_visible), for the functions here that read past row security: the level rule on its owner, and one in
-- the bin only for an owner of the firm or a support session. Internal.
CREATE FUNCTION public.lead_visible(l public.leads)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT l.id IS NOT NULL AND public.can_see_firm_record(l.firm_id, l.owner_id)
    AND (l.deleted_at IS NULL OR public.firm_role(l.firm_id) = 'owner' OR public.is_support_session(l.firm_id))
$$;

REVOKE ALL ON FUNCTION public.lead_visible(public.leads) FROM PUBLIC, anon, authenticated, service_role;

-- When a lead last became a status, from its history (D-808: every status change is one entry), or NULL when it never did. Internal.
CREATE FUNCTION public.lead_status_began(l public.leads, p_status text)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT max(h.at) FROM public.record_history h
  WHERE h.firm_id = l.firm_id AND h.table_name = 'leads' AND h.record_key = l.id::text AND h.kind = 'changed' AND h.field = 'status'
    AND h.new_value = to_jsonb(p_status)
$$;

REVOKE ALL ON FUNCTION public.lead_status_began(public.leads, text) FROM PUBLIC, anon, authenticated, service_role;

-- Why a lead can be read and not changed, in words, or NULL when it can be changed (CRM-L1.1): one in the bin, a converted one (for good), and a Not a fit
-- one (which only Reopen moves). Internal.
CREATE FUNCTION public.lead_read_only_reason(l public.leads)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN l.deleted_at IS NOT NULL THEN 'This lead is in the bin. Restore it to change it.'
    WHEN l.status = 'converted' THEN 'This lead was converted. Change its account or contact instead.'
    WHEN l.status = 'not_fit' THEN 'This lead is Not a fit. Reopen it to change it.'
  END
$$;

REVOKE ALL ON FUNCTION public.lead_read_only_reason(public.leads) FROM PUBLIC, anon, authenticated, service_role;

-- The lead's own fields as the page and a save answer them: crm_lead_fields with its owner named. Internal.
CREATE FUNCTION public.lead_page_fields(l public.leads)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT public.crm_lead_fields(l)
    || jsonb_build_object('owner', CASE WHEN l.owner_id IS NULL THEN NULL ELSE jsonb_build_object('id', l.owner_id, 'name', public.crm_person_name(l.owner_id)) END)
$$;

REVOKE ALL ON FUNCTION public.lead_page_fields(public.leads) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 2. The page ----------
-- {lead: <crm_lead_fields> with owner {id, name} | null, can_change, can_add, in_bin, can_reopen, converted, stages: {new, working, not_fit, converted}}. The stages are when each status the status bar
-- shows began: New when the lead was made, Working and Not a fit when it last became so (none while it is New, or for Not a fit while it is not), Converted
-- when it was converted.
CREATE FUNCTION public.lead_page(p_firm_id uuid, p_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  l public.leads;
BEGIN
  IF p_firm_id IS NULL OR p_lead_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT * INTO l FROM public.leads x WHERE x.id = p_lead_id AND x.firm_id = p_firm_id;
  IF l.id IS NULL OR NOT public.lead_visible(l) THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'lead', public.lead_page_fields(l),
    'can_change', public.can_change_firm_record(l.firm_id, l.owner_id) AND public.lead_read_only_reason(l) IS NULL,
    -- Whether a call, a note or a task can be logged: by anyone who sees it, on a lead that is not read only (log_lead_activity's own rule).
    'can_add', public.lead_read_only_reason(l) IS NULL,
    'in_bin', l.deleted_at IS NOT NULL,
    -- Reopen (reopen_lead's own rule): a Not a fit lead, not in the bin, that the level rule lets the caller change.
    'can_reopen', l.status = 'not_fit' AND l.deleted_at IS NULL AND public.can_change_firm_record(l.firm_id, l.owner_id),
    'stages', jsonb_build_object(
      'new', l.created_at,
      'working', CASE WHEN l.status <> 'new' THEN public.lead_status_began(l, 'working') END,
      'not_fit', CASE WHEN l.status = 'not_fit' THEN public.lead_status_began(l, 'not_fit') END,
      'converted', l.converted_at),
    -- What converting made, each {id, name} and only where the caller may see the account it is on (the account's own visibility, as its page has it); a
    -- record since deleted is gone from the lead too (its link clears itself). NULL for a lead not converted.
    'converted', CASE WHEN l.status = 'converted' THEN jsonb_build_object(
      'account', (SELECT jsonb_build_object('id', a.id, 'name', a.name) FROM public.accounts a
                  WHERE a.id = l.converted_account_id AND a.firm_id = l.firm_id AND public.can_see_firm_record(a.firm_id, a.owner_id)),
      'contact', (SELECT jsonb_build_object('id', c.id, 'name', public.crm_contact_name(c)) FROM public.contacts c JOIN public.accounts a ON a.id = c.account_id
                  WHERE c.id = l.converted_contact_id AND a.firm_id = l.firm_id AND public.can_see_firm_record(a.firm_id, a.owner_id)),
      'opportunity', (SELECT jsonb_build_object('id', o.id, 'name', o.name) FROM public.opportunities o JOIN public.accounts a ON a.id = o.account_id
                      WHERE o.id = l.converted_opportunity_id AND a.firm_id = l.firm_id AND public.can_see_firm_record(a.firm_id, a.owner_id))) END);
END;
$$;

REVOKE ALL ON FUNCTION public.lead_page(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lead_page(uuid, uuid) TO authenticated;

-- The lead the caller acts on, held for the change: seen (PT404, one answer for not there and not theirs), then changed by the level rule (42501). Internal: the
-- writes below call it after the write guard.
CREATE FUNCTION public.lead_to_change(p_firm_id uuid, p_lead_id uuid)
RETURNS public.leads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  cur public.leads;
BEGIN
  SELECT * INTO cur FROM public.leads x WHERE x.id = p_lead_id AND x.firm_id = p_firm_id FOR NO KEY UPDATE;
  IF NOT COALESCE(public.lead_visible(cur), false) THEN
    RAISE EXCEPTION 'That lead isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF NOT public.can_change_firm_record(cur.firm_id, cur.owner_id) THEN
    RAISE EXCEPTION '%', CASE WHEN cur.owner_id IS NULL
      THEN 'A lead with no owner can only be changed by an owner of the firm.'
      ELSE 'Only the lead''s owner, a lead of the owner''s team or an owner of the firm can change it.' END
      USING ERRCODE = '42501';
  END IF;
  RETURN cur;
END;
$$;

REVOKE ALL ON FUNCTION public.lead_to_change(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 3. The save of a lead's own fields ----------
-- Saves the lead's own fields (every one is sent; a blank one is cleared) from the version the person started from (D-46), as update_contact saves a contact's.
-- Answers {conflict: false, record: <the fields, with the new version>} or, when someone saved first and nothing was saved, {conflict: true, currentVersion,
-- current: {the fields a person edits}, changed: [{field, value, who, at}]}. A saved change makes a New lead Working in the same step (D-808).
CREATE FUNCTION public.update_lead(
  p_lead_id uuid, p_name text, p_title text DEFAULT NULL, p_business text DEFAULT NULL, p_email text DEFAULT NULL, p_phone text DEFAULT NULL,
  p_city text DEFAULT NULL, p_state text DEFAULT NULL, p_employees integer DEFAULT NULL, p_current_provider text DEFAULT NULL, p_note text DEFAULT NULL,
  p_owner_id uuid DEFAULT NULL, p_firm_id uuid DEFAULT NULL, p_version integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  name_in text := NULLIF(btrim(p_name), '');
  title_in text := NULLIF(btrim(p_title), '');
  business_in text := NULLIF(btrim(p_business), '');
  email_in text := NULLIF(btrim(p_email), '');
  phone_in text := NULLIF(btrim(p_phone), '');
  city_in text := NULLIF(btrim(p_city), '');
  state_in text := upper(NULLIF(btrim(p_state), ''));
  provider_in text := NULLIF(btrim(p_current_provider), '');
  note_in text := NULLIF(btrim(p_note), '');
  cur public.leads;
  changed public.leads;
  problem text;
  owner uuid;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  cur := public.lead_to_change(firm, p_lead_id);
  IF public.lead_read_only_reason(cur) IS NOT NULL THEN
    RAISE EXCEPTION '%', public.lead_read_only_reason(cur) USING ERRCODE = '55000';
  END IF;
  problem := public.lead_input_error(name_in, title_in, business_in, email_in, phone_in, city_in, state_in, p_employees, provider_in, note_in);
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  IF p_version IS NULL OR p_version < 1 THEN
    RAISE EXCEPTION 'This save did not say which version of the lead it started from, so it was refused. Reload the page and try again.' USING ERRCODE = '22023';
  END IF;
  -- A version the lead has never had is not "someone else changed it": nobody did.
  IF p_version > cur.version THEN
    RAISE EXCEPTION 'This save names a version of the lead that does not exist, so it was refused. Reload the page and try again.' USING ERRCODE = '22023';
  END IF;
  -- p_owner_id NULL leaves the owner as it is (so a lead whose owner has left can be saved without choosing one); a person chosen must be a current member
  -- whom the level rule lets the caller give the lead to (create_lead's rule), held FOR SHARE to the end.
  owner := COALESCE(p_owner_id, cur.owner_id);
  IF owner IS DISTINCT FROM cur.owner_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.firm_memberships m WHERE m.firm_id = firm AND m.user_id = owner AND public.membership_is_current(m.valid_from, m.valid_until) FOR SHARE) THEN
      RAISE EXCEPTION 'Choose one of the firm''s people as the owner.' USING ERRCODE = '22023';
    END IF;
    IF NOT public.can_change_firm_record(firm, owner) THEN
      RAISE EXCEPTION 'You can give a lead only to yourself and, as a lead, to people on your teams.' USING ERRCODE = '42501';
    END IF;
  END IF;
  -- The row is held, so its version is the current one: a save from an older version changes nothing and is answered with what is there now.
  IF p_version < cur.version THEN
    RETURN jsonb_build_object(
      'conflict', true,
      'currentVersion', cur.version,
      'current', jsonb_build_object(
        'name', cur.name, 'title', cur.title, 'business', cur.business, 'email', cur.email, 'phone', cur.phone, 'city', cur.city, 'state', cur.state,
        'employees', cur.employees, 'current_provider', cur.current_provider, 'note', cur.note, 'owner_id', cur.owner_id),
      'changed', public.record_version_changes(cur.firm_id, 'leads', cur.id::text, p_version, cur.version));
  END IF;
  UPDATE public.leads SET
    name = name_in, title = title_in, business = business_in, email = email_in, phone = phone_in, city = city_in, state = state_in, employees = p_employees,
    current_provider = provider_in, note = note_in, owner_id = owner,
    -- Working only when a field changed: pressing Save on what is there is not a change (D-808).
    status = CASE WHEN cur.status = 'new' AND (name_in, title_in, business_in, email_in, phone_in, city_in, state_in, p_employees, provider_in, note_in, owner)
                       IS DISTINCT FROM (cur.name, cur.title, cur.business, cur.email, cur.phone, cur.city, cur.state, cur.employees, cur.current_provider, cur.note, cur.owner_id)
                  THEN 'working' ELSE cur.status END
  WHERE id = cur.id AND version = p_version
  RETURNING * INTO changed;
  RETURN jsonb_build_object('conflict', false, 'record', public.lead_page_fields(changed));
END;
$$;

REVOKE ALL ON FUNCTION public.update_lead(uuid, text, text, text, text, text, text, text, integer, text, text, uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_lead(uuid, text, text, text, text, text, text, text, integer, text, text, uuid, uuid, integer) TO authenticated;

-- ---------- 4. Not a fit and Reopen ----------
-- Marks a New or Working lead Not a fit with one reason from the short list (CRM-L1.3): too_small, wrong_industry, not_interested, bad_contact_details, other.
-- The lead and its history stay. Answers the lead's fields. Refused, in this order: not a member (42501), a closing firm or support (PT423), what is wrong
-- with the reason (22023), not there or not theirs (PT404), the level rule (42501), a lead in the bin, converted or already Not a fit (55000).
CREATE FUNCTION public.mark_lead_not_fit(p_lead_id uuid, p_reason text, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  cur public.leads;
  saved public.leads;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  IF p_reason IS NULL OR p_reason NOT IN ('too_small', 'wrong_industry', 'not_interested', 'bad_contact_details', 'other') THEN
    RAISE EXCEPTION 'Choose why it isn''t a fit.' USING ERRCODE = '22023';
  END IF;
  cur := public.lead_to_change(firm, p_lead_id);
  IF public.lead_read_only_reason(cur) IS NOT NULL THEN
    RAISE EXCEPTION '%', public.lead_read_only_reason(cur) USING ERRCODE = '55000';
  END IF;
  UPDATE public.leads SET status = 'not_fit', not_fit_reason = p_reason WHERE id = cur.id RETURNING * INTO saved;
  RETURN public.lead_page_fields(saved);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_lead_not_fit(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_lead_not_fit(uuid, text, uuid) TO authenticated;

-- Reopens a Not a fit lead (CRM-L1.1: the one change a Not a fit lead takes). It is Working again, being one an agent is working on, and its reason is
-- cleared; the history keeps both moves (D-1652). Answers the lead's fields. Refused as mark_lead_not_fit is, and with 55000 for a lead that is not Not a fit.
CREATE FUNCTION public.reopen_lead(p_lead_id uuid, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  cur public.leads;
  saved public.leads;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  cur := public.lead_to_change(firm, p_lead_id);
  IF cur.status <> 'not_fit' OR cur.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION '%', COALESCE(public.lead_read_only_reason(cur), 'Only a lead that is Not a fit can be reopened.') USING ERRCODE = '55000';
  END IF;
  UPDATE public.leads SET status = 'working', not_fit_reason = NULL WHERE id = cur.id RETURNING * INTO saved;
  RETURN public.lead_page_fields(saved);
END;
$$;

REVOKE ALL ON FUNCTION public.reopen_lead(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_lead(uuid, uuid) TO authenticated;

-- ---------- 5. Calls, notes and tasks on a lead (D-807) ----------
-- Logs a call, a note or a task on a lead, as log_activity (20261119180000) logs one on an account, with the same words for what is wrong with it. A lead has
-- no contact or opportunity to name. Answers {activity, follow_up}. The first call logged on a New lead makes it Working in the same step; a note or a task
-- does not (D-808).
CREATE FUNCTION public.log_lead_activity(
  p_kind text, p_lead_id uuid, p_at timestamptz DEFAULT NULL, p_outcome text DEFAULT NULL, p_body text DEFAULT NULL, p_title text DEFAULT NULL,
  p_due_on date DEFAULT NULL, p_for uuid DEFAULT NULL, p_follow_up_title text DEFAULT NULL, p_follow_up_due_on date DEFAULT NULL,
  p_follow_up_for uuid DEFAULT NULL, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  l public.leads;
  body_in text := NULLIF(btrim(p_body), '');
  title_in text := NULLIF(btrim(p_title), '');
  fu_title text := NULLIF(btrim(p_follow_up_title), '');
  made public.activities;
  follow public.activities;
  who uuid := auth.uid();
  problem text;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  IF p_kind IS NULL OR p_kind NOT IN ('call', 'note', 'task') THEN
    RAISE EXCEPTION 'Choose a call, a note or a task.' USING ERRCODE = '22023';
  END IF;
  -- Held, so the call that makes a New lead Working is ordered with any other change of its status.
  SELECT * INTO l FROM public.leads x WHERE x.id = p_lead_id AND x.firm_id = firm FOR NO KEY UPDATE;
  IF NOT COALESCE(public.lead_visible(l), false) THEN
    RAISE EXCEPTION 'That lead isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF public.lead_read_only_reason(l) IS NOT NULL THEN
    RAISE EXCEPTION '%', public.lead_read_only_reason(l) USING ERRCODE = '55000';
  END IF;
  -- log_activity's own checks, in its order and words.
  problem := public.activity_input_error(p_kind, p_outcome, body_in, title_in, p_due_on);
  IF problem IS NULL AND p_kind = 'call' AND p_at IS NOT NULL AND p_at > now() + interval '5 minutes' THEN
    problem := 'A call can''t be in the future.';
  END IF;
  IF problem IS NULL AND p_kind = 'task' AND p_for IS NOT NULL AND NOT public.crm_is_current_member(firm, p_for) THEN
    problem := 'Choose someone from the firm for the task.';
  END IF;
  IF problem IS NULL AND p_kind <> 'call' AND (fu_title IS NOT NULL OR p_follow_up_due_on IS NOT NULL OR p_follow_up_for IS NOT NULL) THEN
    problem := 'Only a call can add a follow-up task.';
  END IF;
  IF problem IS NULL AND (p_follow_up_due_on IS NOT NULL OR p_follow_up_for IS NOT NULL) AND fu_title IS NULL THEN
    problem := 'Say what the follow-up task is.';
  END IF;
  IF problem IS NULL AND fu_title IS NOT NULL THEN
    problem := public.activity_input_error('task', NULL, NULL, fu_title, p_follow_up_due_on);
    IF problem IS NOT NULL THEN problem := replace(problem, 'the task', 'the follow-up task'); END IF;
    IF problem IS NULL AND p_follow_up_for IS NOT NULL AND NOT public.crm_is_current_member(firm, p_follow_up_for) THEN
      problem := 'Choose someone from the firm for the follow-up task.';
    END IF;
  END IF;
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.activities (firm_id, lead_id, kind, author_id, at, outcome, body, title, due_on, assignee_id)
  VALUES (firm, l.id, p_kind, who,
          CASE WHEN p_kind = 'call' THEN COALESCE(p_at, now()) ELSE now() END,
          CASE WHEN p_kind = 'call' THEN p_outcome END,
          CASE WHEN p_kind IN ('call', 'note') THEN body_in END,
          CASE WHEN p_kind = 'task' THEN title_in END,
          CASE WHEN p_kind = 'task' THEN p_due_on END,
          CASE WHEN p_kind = 'task' THEN COALESCE(p_for, who) END)
  RETURNING * INTO made;
  IF fu_title IS NOT NULL THEN
    INSERT INTO public.activities (firm_id, lead_id, kind, author_id, title, due_on, assignee_id)
    VALUES (firm, l.id, 'task', who, fu_title, p_follow_up_due_on, COALESCE(p_follow_up_for, who))
    RETURNING * INTO follow;
  END IF;
  IF p_kind = 'call' AND l.status = 'new' THEN
    UPDATE public.leads SET status = 'working' WHERE id = l.id;
  END IF;
  RETURN jsonb_build_object('activity', public.crm_activity_row(made), 'follow_up', CASE WHEN follow.id IS NULL THEN NULL ELSE public.crm_activity_row(follow) END);
END;
$$;

REVOKE ALL ON FUNCTION public.log_lead_activity(text, uuid, timestamptz, text, text, text, date, uuid, text, date, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_lead_activity(text, uuid, timestamptz, text, text, text, date, uuid, text, date, uuid, uuid) TO authenticated;

-- {count, rows} of the lead's calls, notes and tasks, newest first (when a call took place, when a note or a task was made, ties by id: the account's own
-- order), a page of at most 100. p_filter is 'all', 'calls', 'notes' or 'tasks' (22023 otherwise). The rows are crm_activity_row's, the account's Activity
-- tab's, so they are drawn by the same code (contact_activity's shape, 20261119240000). NULL for anyone who may not see the lead, and for a lead not there.
CREATE FUNCTION public.lead_activity(p_firm_id uuid, p_lead_id uuid, p_filter text DEFAULT 'all', p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  l public.leads;
  want text;
  n bigint;
  r jsonb;
BEGIN
  IF p_limit IS NULL OR p_limit < 0 OR p_limit > 100 OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'A page is 0 to 100 rows, from a place that is not before the first' USING ERRCODE = '22023';
  END IF;
  IF p_filter IS NULL OR p_filter NOT IN ('all', 'calls', 'notes', 'tasks') THEN
    RAISE EXCEPTION 'A lead''s activity is all, calls, notes or tasks' USING ERRCODE = '22023';
  END IF;
  IF p_firm_id IS NULL OR p_lead_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT * INTO l FROM public.leads x WHERE x.id = p_lead_id AND x.firm_id = p_firm_id;
  IF NOT COALESCE(public.lead_visible(l), false) THEN
    RETURN NULL;
  END IF;
  want := CASE p_filter WHEN 'calls' THEN 'call' WHEN 'notes' THEN 'note' WHEN 'tasks' THEN 'task' END;
  SELECT count(*) INTO n FROM public.activities t WHERE t.lead_id = l.id AND (want IS NULL OR t.kind = want);
  SELECT COALESCE(jsonb_agg(public.crm_activity_row(x) ORDER BY x.at DESC, x.id DESC), '[]'::jsonb) INTO r FROM (
    SELECT t.* FROM public.activities t WHERE t.lead_id = l.id AND (want IS NULL OR t.kind = want)
    ORDER BY t.at DESC, t.id DESC OFFSET p_offset LIMIT p_limit) x;
  RETURN jsonb_build_object('count', n, 'rows', r);
END;
$$;

REVOKE ALL ON FUNCTION public.lead_activity(uuid, uuid, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lead_activity(uuid, uuid, text, integer, integer) TO authenticated;

-- ---------- 6. Changing a lead's call, note or task: the account's four functions restated ----------
-- can_edit_activity, update_activity, add_to_note and set_task_done are restated from 20261119180000_calls_notes_tasks.sql (their newest and only definition)
-- with every line kept. Each read only the account a row is on, so every row on a lead (D-807: on exactly one of an account or a lead) was "not available".
-- Now a row on a lead is seen as its lead is (lead_visible) and changed by the lead's level rule; and since a Converted, Not a fit or binned lead is read, not
-- changed (CRM-L1.1), none of its rows is changed, added to or marked done (55000 in words), and none says it can be edited.

-- Whether the caller may see the record a row is on: its account (can_see_firm_record on the account's owner) or its lead (lead_visible). Internal.
CREATE FUNCTION public.activity_record_seen(a public.activities)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN a.lead_id IS NOT NULL
    THEN COALESCE((SELECT public.lead_visible(l) FROM public.leads l WHERE l.id = a.lead_id AND l.firm_id = a.firm_id), false)
    ELSE EXISTS (SELECT 1 FROM public.accounts x WHERE x.id = a.account_id AND public.can_see_firm_record(x.firm_id, x.owner_id))
  END
$$;

REVOKE ALL ON FUNCTION public.activity_record_seen(public.activities) FROM PUBLIC, anon, authenticated, service_role;

-- Why a row on a lead can't be changed, in words (the lead is read, not changed), or NULL; always NULL for a row on an account. Internal.
CREATE FUNCTION public.activity_lead_read_only(a public.activities)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.lead_read_only_reason(l) FROM public.leads l WHERE l.id = a.lead_id AND l.firm_id = a.firm_id
$$;

REVOKE ALL ON FUNCTION public.activity_lead_read_only(public.activities) FROM PUBLIC, anon, authenticated, service_role;

-- Whether the caller may change THIS call, note or task as its own (the account is already known to be one they may see). A note: its writer, for 24 hours.
-- A call or a task: whoever logged it, the person a task is for, or whoever may change the account (the level rule, D-209). Marking a task done and
-- adding to a note are not changing, and need only sight of the account.
-- Restated (8.5): a row on a lead the same, with the lead's level rule in the account's place; and nothing on a lead that is read, not changed.
CREATE OR REPLACE FUNCTION public.can_edit_activity(a public.activities)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.activity_lead_read_only(a) IS NULL AND CASE a.kind
    WHEN 'note' THEN a.author_id IS NOT NULL AND a.author_id = auth.uid() AND now() < a.created_at + interval '24 hours'
    ELSE (a.author_id IS NOT NULL AND a.author_id = auth.uid())
      OR (a.assignee_id IS NOT NULL AND a.assignee_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.accounts x WHERE x.id = a.account_id AND public.can_change_firm_record(x.firm_id, x.owner_id))
      OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = a.lead_id AND l.firm_id = a.firm_id AND public.can_change_firm_record(l.firm_id, l.owner_id))
  END
$$;

REVOKE ALL ON FUNCTION public.can_edit_activity(public.activities) FROM PUBLIC, anon, authenticated, service_role;

-- Saves a call or a task as sent (every field is sent; a call's contact, opportunity and what was said may be blank), or a note's text. A note's other
-- fields are not its to send and are ignored. Answers the row. Refused, in this order: not a member (42501), a closing firm or Nevermore support (PT423),
-- an activity the caller may not see or that is not there (PT404), what is wrong with what was sent (22023), an activity the caller may not change (42501):
-- a note by anyone but its writer, or after a day (D-200); a call or a task by someone who did not log it, is not it's for and may not change the account.
-- Restated (8.5): a row on a lead is seen through its lead, refused on a lead that is read, not changed (55000, after PT404), and names no contact or
-- opportunity (a lead has none: "Choose a contact of this account" as for one of another account).
CREATE OR REPLACE FUNCTION public.update_activity(
  p_activity_id uuid, p_contact_id uuid DEFAULT NULL, p_opportunity_id uuid DEFAULT NULL, p_at timestamptz DEFAULT NULL, p_outcome text DEFAULT NULL,
  p_body text DEFAULT NULL, p_title text DEFAULT NULL, p_due_on date DEFAULT NULL, p_for uuid DEFAULT NULL, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  cur public.activities;
  acc public.accounts;
  body_in text := NULLIF(btrim(p_body), '');
  title_in text := NULLIF(btrim(p_title), '');
  problem text;
  saved public.activities;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  SELECT * INTO cur FROM public.activities x WHERE x.id = p_activity_id AND x.firm_id = firm FOR NO KEY UPDATE;
  SELECT * INTO acc FROM public.accounts x WHERE x.id = cur.account_id;
  IF cur.id IS NULL OR NOT public.activity_record_seen(cur) THEN
    RAISE EXCEPTION 'That isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF public.activity_lead_read_only(cur) IS NOT NULL THEN
    RAISE EXCEPTION '%', public.activity_lead_read_only(cur) USING ERRCODE = '55000';
  END IF;
  problem := public.activity_input_error(cur.kind, p_outcome, body_in, title_in, p_due_on);
  IF problem IS NULL AND cur.kind = 'call' AND p_at IS NOT NULL AND p_at > now() + interval '5 minutes' THEN
    problem := 'A call can''t be in the future.';
  END IF;
  IF problem IS NULL AND cur.kind <> 'note' AND p_contact_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = p_contact_id AND c.account_id = acc.id) THEN
    problem := 'Choose a contact of this account.';
  END IF;
  IF problem IS NULL AND cur.kind <> 'note' AND p_opportunity_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = p_opportunity_id AND o.account_id = acc.id) THEN
    problem := 'Choose an opportunity of this account.';
  END IF;
  IF problem IS NULL AND cur.kind = 'task' AND p_for IS NOT NULL AND p_for IS DISTINCT FROM cur.assignee_id AND NOT public.crm_is_current_member(firm, p_for) THEN
    problem := 'Choose someone from the firm for the task.';
  END IF;
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  IF NOT public.can_edit_activity(cur) THEN
    RAISE EXCEPTION '%', CASE
      WHEN cur.kind = 'note' AND cur.author_id IS NOT DISTINCT FROM auth.uid() THEN 'A note can''t be changed after a day. Add to it instead.'
      WHEN cur.kind = 'note' THEN 'Only the person who wrote a note can change it.'
      WHEN cur.lead_id IS NOT NULL THEN 'Only whoever logged it, whoever it is for, the lead''s owner, a lead of the owner''s team or an owner of the firm can change it.'
      ELSE 'Only whoever logged it, whoever it is for, the account''s owner, a lead of the owner''s team or an owner of the firm can change it.' END
      USING ERRCODE = '42501';
  END IF;
  IF cur.kind = 'note' THEN
    UPDATE public.activities SET body = body_in WHERE id = cur.id RETURNING * INTO saved;
  ELSIF cur.kind = 'call' THEN
    UPDATE public.activities SET contact_id = p_contact_id, opportunity_id = p_opportunity_id, at = COALESCE(p_at, cur.at), outcome = p_outcome, body = body_in
    WHERE id = cur.id RETURNING * INTO saved;
  ELSE
    UPDATE public.activities SET contact_id = p_contact_id, opportunity_id = p_opportunity_id, title = title_in, due_on = p_due_on,
      assignee_id = COALESCE(p_for, cur.assignee_id)
    WHERE id = cur.id RETURNING * INTO saved;
  END IF;
  RETURN public.crm_activity_row(saved);
END;
$$;

REVOKE ALL ON FUNCTION public.update_activity(uuid, uuid, uuid, timestamptz, text, text, text, date, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_activity(uuid, uuid, uuid, timestamptz, text, text, text, date, uuid, uuid) TO authenticated;

-- Appends a dated addition to a note (D-200): "Add to note". Anyone who may see the account can, whenever, and it is dated and signed. Answers the row.
-- Refused as update_activity is, with 55000 for an archived account, and with 22023 for something that is not a note or an empty addition.
-- Restated (8.5): a note on a lead is seen through its lead, and refused on a lead that is read, not changed (55000), as on an archived account.
CREATE OR REPLACE FUNCTION public.add_to_note(p_activity_id uuid, p_text text, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  cur public.activities;
  acc public.accounts;
  text_in text := NULLIF(btrim(p_text), '');
  saved public.activities;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  SELECT * INTO cur FROM public.activities x WHERE x.id = p_activity_id AND x.firm_id = firm FOR NO KEY UPDATE;
  SELECT * INTO acc FROM public.accounts x WHERE x.id = cur.account_id;
  IF cur.id IS NULL OR NOT public.activity_record_seen(cur) THEN
    RAISE EXCEPTION 'That isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF acc.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'This account is archived. Nothing can be added to it.' USING ERRCODE = '55000';
  END IF;
  IF public.activity_lead_read_only(cur) IS NOT NULL THEN
    RAISE EXCEPTION '%', public.activity_lead_read_only(cur) USING ERRCODE = '55000';
  END IF;
  IF cur.kind <> 'note' THEN
    RAISE EXCEPTION 'Only a note can be added to.' USING ERRCODE = '22023';
  END IF;
  IF text_in IS NULL THEN
    RAISE EXCEPTION 'Write what to add.' USING ERRCODE = '22023';
  END IF;
  IF char_length(text_in) > 5000 THEN
    RAISE EXCEPTION 'Keep what you add to 5,000 characters.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.activities SET additions = additions || jsonb_build_array(jsonb_build_object('at', now(), 'by', auth.uid(), 'text', text_in))
  WHERE id = cur.id RETURNING * INTO saved;
  RETURN public.crm_activity_row(saved);
END;
$$;

REVOKE ALL ON FUNCTION public.add_to_note(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_to_note(uuid, text, uuid) TO authenticated;

-- Marks a task done, or open again (p_done false). Anyone who may see its account can (D-200). It is the first time it was done that is kept: marking a
-- done task done again changes nothing. Answers the row.
-- Restated (8.5): a task on a lead is seen through its lead, and refused on a lead that is read, not changed (55000).
CREATE OR REPLACE FUNCTION public.set_task_done(p_activity_id uuid, p_done boolean, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  cur public.activities;
  acc public.accounts;
  saved public.activities;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  SELECT * INTO cur FROM public.activities x WHERE x.id = p_activity_id AND x.firm_id = firm FOR NO KEY UPDATE;
  SELECT * INTO acc FROM public.accounts x WHERE x.id = cur.account_id;
  IF cur.id IS NULL OR NOT public.activity_record_seen(cur) THEN
    RAISE EXCEPTION 'That isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF public.activity_lead_read_only(cur) IS NOT NULL THEN
    RAISE EXCEPTION '%', public.activity_lead_read_only(cur) USING ERRCODE = '55000';
  END IF;
  IF cur.kind <> 'task' THEN
    RAISE EXCEPTION 'Only a task can be marked done.' USING ERRCODE = '22023';
  END IF;
  IF p_done IS NULL THEN
    RAISE EXCEPTION 'Say whether the task is done.' USING ERRCODE = '22023';
  END IF;
  IF p_done AND cur.done_at IS NULL THEN
    UPDATE public.activities SET done_at = now(), done_by = auth.uid() WHERE id = cur.id RETURNING * INTO saved;
  ELSIF NOT p_done AND cur.done_at IS NOT NULL THEN
    UPDATE public.activities SET done_at = NULL, done_by = NULL WHERE id = cur.id RETURNING * INTO saved;
  ELSE
    saved := cur;
  END IF;
  RETURN public.crm_activity_row(saved);
END;
$$;

REVOKE ALL ON FUNCTION public.set_task_done(uuid, boolean, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_task_done(uuid, boolean, uuid) TO authenticated;

-- ---------- 7. What the log form offers on a lead ----------
-- account_activity_options' shape for a lead the caller may see: no contacts and no opportunities (a lead has none, D-807), and the firm's current members a
-- task can be for, named as there. NULL, as for a lead that is not there, for anyone else.
CREATE FUNCTION public.lead_activity_options(p_firm_id uuid, p_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  l public.leads;
BEGIN
  IF p_firm_id IS NULL OR p_lead_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT * INTO l FROM public.leads x WHERE x.id = p_lead_id AND x.firm_id = p_firm_id;
  IF NOT COALESCE(public.lead_visible(l), false) THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'contacts', '[]'::jsonb,
    'opportunities', '[]'::jsonb,
    'people', COALESCE((SELECT jsonb_agg(x.j ORDER BY lower(x.n), x.u) FROM (
      SELECT DISTINCT m.user_id AS u, public.person_display_name(pu.raw_user_meta_data, pu.email::text) AS n,
             jsonb_build_object('id', m.user_id, 'name', public.person_display_name(pu.raw_user_meta_data, pu.email::text)) AS j
      FROM public.firm_memberships m JOIN auth.users pu ON pu.id = m.user_id
      WHERE m.firm_id = l.firm_id AND public.membership_is_current(m.valid_from, m.valid_until)) x), '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.lead_activity_options(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lead_activity_options(uuid, uuid) TO authenticated;
