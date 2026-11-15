-- The opportunity's page in the database (story CRM-O1.1a, Epic 4 build order row 2; docs/BROKER_CRM_BUILD.md D-24, D-28, D-29, D-33, D-44, D-45, D-46, D-200,
-- D-201, D-209, D-212, D-222, D-407, D-408, D-413, D-416, D-421 to D-432; GLOSSARY.md "The broker's CRM"; ADR 0016, ADR 0023, ADR 0024, ADR 0026;
-- 20261119100000_crm_records.sql, 20261119140000_account_page.sql, 20261119180000_calls_notes_tasks.sql, 20261119240000_contact_page.sql,
-- 20261120090000_opportunity_stage.sql). The page itself is CRM-O1.1b.
--
-- The timestamp. The build order gave this story 20261120100000. Migrations up to 20261120111000 had already merged when it was built, and a migration is
-- never edited or slipped in before one that has run, so it takes 20261120120000.
--
-- What this is. What the opportunity's page (screen 19) draws, asked of the database, and the save of the opportunity's own fields. Three things:
--
--   opportunity_page(firm, id)       The page in one read (D-423): the opportunity's own fields with its stage (opportunity_stage, called here after the
--                                    caller is known to see it, D-416), its account (id, name, archived), owner and main contact, `can_change` (the level
--                                    rule on the opportunity's own owner, D-422, and never on an archived account, D-432) and `can_add` (the account is not
--                                    archived), its quote requests (one row per PEO), its intake's summary and its contacts (D-429). Seen by whoever sees its
--                                    account (D-422): the one refusal, PT404, for an opportunity that is not there, is another firm's or may not be seen.
--   update_opportunity(...)          The save of the opportunity's own fields with its version (D-46), the level rule (D-209, D-222) and the conflict
--                                    dialog's shape (D-183), modelled on update_account and update_contact. The stage and the account are never edited here (D-428).
--   opportunity_activity(...)        The activity read (D-427, D-212): the opportunity's calls, notes and tasks, its quote requests' events and its record
--                                    history with its stage changes, newest first, filtered All, Calls, Notes, Tasks or Changes.
--
-- Calls, notes and tasks on an opportunity need no new write: CRM-E1.5's log_activity has taken an opportunity of the account (p_opportunity_id) since it
-- was built (a call's "About"), for a call, a note and a task, under the rules of the account: anyone who may see the account may add; a note's text is its
-- writer's for a day and is added to after that (D-200); an archived account takes nothing more. This story adds the read of them, and its test pins the rules
-- for an opportunity. Last activity (D-201) already counts them: account_activity_times reads every activity of the account, whichever record it names.
-- Nothing is restated: record_history_list, log_activity and account_activity_times are used as they stand.

-- ---------- 1. The opportunity's own fields, as the page and a save answer them ----------
-- The fields a person edits in place, the intake the product attached, and the version to start the next save from. Internal.
CREATE FUNCTION public.crm_opportunity_fields(o public.opportunities)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', o.id, 'version', o.version, 'account_id', o.account_id, 'owner_id', o.owner_id, 'name', o.name, 'target_start', o.target_start,
    'employees', o.employees, 'main_contact_id', o.main_contact_id, 'expected_close', o.expected_close, 'value', o.value, 'source', o.source,
    'next_step', o.next_step, 'submission_id', o.intake_id, 'created_at', o.created_at, 'updated_at', o.updated_at)
$$;

REVOKE ALL ON FUNCTION public.crm_opportunity_fields(public.opportunities) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 2. The intake's summary ----------
-- The open items of one intake, counted as the advisor queue counts them (advisor_list_submissions, 20261118140500): the required answers still missing, in
-- order, less any an advisor supplied through a verified correction; and the other open items, as Review and The Manuscript list them
-- (src/data/openItems.ts), less a required answer still missing, less the census when none is uploaded, and less any field an advisor verified. The copy
-- the advisor sees: the certified snapshot while certified, otherwise the answers as they stand (the queue's own test). The queue answers for a whole firm
-- and cannot be asked for one intake, so its two counts are written once more here for one; supabase/tests/opportunity_page.sql holds the two together.
-- Internal.
CREATE FUNCTION public.intake_open_items(p_session_id uuid)
RETURNS TABLE (missing_required text[], open_fields integer, missing_fields text[], open_field_keys text[])
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  WITH s AS (
    SELECT x.id,
           CASE WHEN snap.used THEN x.submission -> 'chamber_data' ELSE x.chamber_data END AS shown,
           CASE WHEN snap.used THEN x.submission -> 'field_provenance' ELSE x.field_provenance END AS prov
    FROM public.chamber_sessions x
    CROSS JOIN LATERAL (
      SELECT x.status = 'submitted' AND jsonb_typeof(x.submission) = 'object' AND btrim(COALESCE(x.submission ->> 'signer_name', '')) <> ''
         AND x.submission ? 'chamber_data' AS used) snap
    WHERE x.id = p_session_id
  ), m AS (
    SELECT s.id,
           CASE WHEN jsonb_typeof(s.shown) = 'object' THEN s.shown ELSE '{}'::jsonb END AS d,
           CASE WHEN jsonb_typeof(s.prov) = 'object' THEN s.prov ELSE '{}'::jsonb END AS fp
    FROM s
  ), r AS (
    SELECT m.*, CASE WHEN jsonb_typeof(m.d -> 'census') = 'array' THEN m.d -> 'census' WHEN jsonb_typeof(m.d -> 'employees') = 'array' THEN m.d -> 'employees'
                     ELSE '[]'::jsonb END AS roster
    FROM m
  ), req AS (
    SELECT r.id, ri.item ->> 'label' AS label, ri.item ->> 'field' AS field, ri.ord
    FROM r, jsonb_array_elements(public.intake_required_items(r.d, r.fp, '{}'::text[])) WITH ORDINALITY AS ri (item, ord)
    WHERE ri.item ->> 'state' = 'missing' AND (ri.item ->> 'required')::boolean AND NOT public.advisor_supplied(r.id, ri.item ->> 'field')
  ), o AS (
    SELECT f.key
    FROM r, jsonb_each(r.fp) f
    WHERE f.value ->> 'status' IN (
        -- sync:begin open_item_statuses
        'conflicting', 'incomplete', 'unknown', 'inferred'
        -- sync:end open_item_statuses
      )
      AND public.is_reviewable_field(f.key)
      AND NOT (f.key IN ('census', 'employees') AND jsonb_array_length(r.roster) = 0)
      AND NOT EXISTS (SELECT 1 FROM req WHERE req.field = f.key)
      AND NOT EXISTS (
        SELECT 1 FROM public.advisor_field_reviews v
        WHERE v.session_id = r.id AND v.review_state = 'verified'
          AND (v.field = f.key OR (v.field IN ('census', 'employees') AND f.key IN ('census', 'employees'))))
  )
  -- The labels and the field keys of the required answers still missing, in the same order; how many other open items there are, and their field keys, by key.
  SELECT ARRAY(SELECT req.label FROM req ORDER BY req.ord),
         (SELECT count(*)::integer FROM o),
         ARRAY(SELECT req.field FROM req ORDER BY req.ord),
         ARRAY(SELECT o.key FROM o ORDER BY o.key)
$$;

REVOKE ALL ON FUNCTION public.intake_open_items(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- The intake an opportunity holds, summarised (D-425): its submission, File ID, pipeline stage, the last certification (who signed, when, which version) and
-- the census rows in that version, and its open items (how many, and the label of the first required answer still missing; the other open items name a
-- field the page labels itself). NULL when there is no intake. Everything about a certification is NULL for an intake never certified; the answers so far
-- and who is filling it in (D-426's "Intake under way") are NULL once it is certified. Internal: the
-- caller has already decided the person may see the opportunity.
CREATE FUNCTION public.opportunity_intake_summary(p_intake_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'submission_id', s.id, 'file_id', NULLIF(btrim(s.file_id), ''), 'pipeline_status', w.status,
    'certified_by', NULLIF(btrim(c.signer_name), ''), 'certified_at', c.recorded_at, 'version', c.version,
    'census_size', CASE WHEN c.id IS NULL THEN NULL
                        WHEN jsonb_typeof(c.chamber_data -> 'census') = 'array' THEN jsonb_array_length(c.chamber_data -> 'census')
                        WHEN jsonb_typeof(c.chamber_data -> 'employees') = 'array' THEN jsonb_array_length(c.chamber_data -> 'employees') END,
    -- While the draft is live (not certified): how many answers it holds, counted as the queue tells an intake that holds nothing from one that holds something
    -- (intake_holds_nothing, 20261104133000: an answer is any value that is not null, blank text, an empty list or an empty object, so an explicit false is
    -- one), and the name the prospect gave (the profile's contact name, as the chain names the contact made from them), never their email or id (D-33).
    'answered', CASE WHEN s.status = 'submitted' THEN NULL ELSE (
      SELECT count(*)::integer FROM jsonb_each(CASE WHEN jsonb_typeof(s.chamber_data) = 'object' THEN s.chamber_data ELSE '{}'::jsonb END) a
      WHERE NOT (jsonb_typeof(a.value) = 'null' OR (jsonb_typeof(a.value) = 'string' AND (a.value #>> '{}') ~ '^[[:space:]]*$')
                 OR a.value IN ('[]'::jsonb, '{}'::jsonb))) END,
    'prospect_name', CASE WHEN s.status = 'submitted' THEN NULL ELSE (SELECT NULLIF(btrim(p.contact_name), '') FROM public.profiles p WHERE p.user_id = s.user_id) END,
    -- first_field names the first open item whatever it is (a required answer first, then the other open items by field key), first_label its label when
    -- it is a required answer (the queue's own label), so the page can always name one.
    'open_items', jsonb_build_object('count', COALESCE(cardinality(i.missing_required), 0) + COALESCE(i.open_fields, 0), 'first_label', i.missing_required[1],
                                     'first_field', COALESCE(i.missing_fields[1], i.open_field_keys[1])))
  FROM public.chamber_sessions s
  LEFT JOIN public.submission_workflow w ON w.session_id = s.id
  LEFT JOIN LATERAL (
    SELECT x.* FROM public.chamber_certifications x WHERE x.session_id = s.id ORDER BY x.recorded_at DESC, x.version DESC, x.id DESC LIMIT 1) c ON true
  CROSS JOIN LATERAL public.intake_open_items(s.id) i
  WHERE s.id = p_intake_id
$$;

REVOKE ALL ON FUNCTION public.opportunity_intake_summary(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 3. The page ----------
CREATE FUNCTION public.opportunity_page(p_firm_id uuid, p_opportunity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  o public.opportunities;
  a public.accounts;
  intake_user uuid;
BEGIN
  IF p_firm_id IS NOT NULL AND p_opportunity_id IS NOT NULL THEN
    SELECT * INTO o FROM public.opportunities x WHERE x.id = p_opportunity_id AND x.firm_id = p_firm_id;
    SELECT * INTO a FROM public.accounts x WHERE x.id = o.account_id AND x.firm_id = o.firm_id;
  END IF;
  IF o.id IS NULL OR a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RAISE EXCEPTION 'That opportunity isn''t available' USING ERRCODE = 'PT404';
  END IF;
  SELECT s.user_id INTO intake_user FROM public.chamber_sessions s WHERE s.id = o.intake_id;
  RETURN jsonb_build_object(
    'opportunity', public.crm_opportunity_fields(o) || jsonb_build_object('stage', public.opportunity_stage(o.id)),
    'account', jsonb_build_object('id', a.id, 'name', a.name, 'archived', a.archived_at IS NOT NULL),
    'owner', CASE WHEN o.owner_id IS NULL THEN NULL ELSE jsonb_build_object('id', o.owner_id, 'name', public.crm_person_name(o.owner_id)) END,
    'main_contact', (SELECT jsonb_build_object('id', c.id, 'name', btrim(concat_ws(' ', c.first_name, c.last_name))) FROM public.contacts c
                     WHERE c.id = o.main_contact_id AND c.account_id = a.id),
    'can_change', a.archived_at IS NULL AND public.can_change_firm_record(o.firm_id, o.owner_id),
    'can_add', a.archived_at IS NULL,
    -- One row per quote request of the intake it holds, PEO by PEO. A close reason is CRM-O1.3a's column: it is not here yet.
    'quotes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', q.id, 'peo_name', q.peo_name, 'status', q.status, 'sent_on', q.sent_on, 'quote_received_on', q.quote_received_on,
        'quote_expires_on', q.quote_expires_on, 'admin_fee_pepm', q.admin_fee_pepm) ORDER BY lower(q.peo_name), q.id)
      FROM public.quote_requests q WHERE q.session_id = o.intake_id), '[]'::jsonb),
    'intake', public.opportunity_intake_summary(o.intake_id),
    -- The contacts on this search (D-429): the opportunity's main contact and the contact made from the intake's prospect, one row each, so the usual case,
    -- where they are one person, is one row with both marks. The main one first.
    'contacts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', btrim(concat_ws(' ', c.first_name, c.last_name)), 'title', c.title, 'email', c.email, 'phone', COALESCE(c.phone, c.mobile),
        'main', c.id IS NOT DISTINCT FROM o.main_contact_id, 'fills_in_intake', c.prospect_user_id IS NOT NULL AND c.prospect_user_id = intake_user)
        ORDER BY (c.id IS NOT DISTINCT FROM o.main_contact_id) DESC, lower(c.last_name), c.id)
      FROM public.contacts c
      WHERE c.account_id = a.id AND (c.id = o.main_contact_id OR (c.prospect_user_id IS NOT NULL AND c.prospect_user_id = intake_user))), '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.opportunity_page(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.opportunity_page(uuid, uuid) TO authenticated;

-- ---------- 4. The save of the opportunity's own fields ----------
-- Whether another person, a current member of the firm, would see a record that p_record_owner owns: can_see_firm_record's rule asked of them and not of the
-- caller (an owner of the firm sees all; at a firm that shows everyone everything, every member; the record's own owner; a lead, the people of their team and
-- the teams under it). Used to refuse giving an opportunity to someone who could not then open it, as visibility follows the account (D-422). Internal.
CREATE FUNCTION public.crm_person_sees_record(p_firm_id uuid, p_record_owner uuid, p_person uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.firm_memberships m
    JOIN public.firms f ON f.id = m.firm_id
    WHERE m.firm_id = p_firm_id AND m.user_id = p_person AND public.membership_is_current(m.valid_from, m.valid_until)
      AND (m.role = 'owner'
           OR f.visibility = 'everyone'
           OR p_record_owner IS NOT DISTINCT FROM p_person
           OR (m.role = 'lead' AND EXISTS (
                 WITH RECURSIVE their_teams (id) AS (
                   SELECT x.team_id FROM public.firm_memberships x
                   WHERE x.firm_id = p_firm_id AND x.user_id = p_person AND x.team_id IS NOT NULL AND public.membership_is_current(x.valid_from, x.valid_until)
                   UNION
                   SELECT t.id FROM public.firm_teams t JOIN their_teams ON t.parent_team_id = their_teams.id
                 )
                 SELECT 1 FROM public.firm_memberships o
                 WHERE o.firm_id = p_firm_id AND o.user_id = p_record_owner AND public.membership_is_current(o.valid_from, o.valid_until)
                   AND o.team_id IN (SELECT id FROM their_teams))))
  )
$$;

REVOKE ALL ON FUNCTION public.crm_person_sees_record(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- The first thing wrong with what was sent, in words, or NULL. Plain: the form shows what it can itself and the database says the rest; the columns' own checks
-- say the same (opportunities_*_check), this says it in words. Inputs already trimmed, a blank as NULL. Internal.
CREATE FUNCTION public.opportunity_input_error(p_name text, p_employees integer, p_value numeric, p_source text, p_next_step text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_name IS NULL THEN 'Give the opportunity a name.'
    WHEN char_length(p_name) > 200 THEN 'Keep the opportunity''s name to 200 characters.'
    WHEN p_employees < 0 THEN 'Employees can''t be a negative number.'
    WHEN p_value < 0 THEN 'The value can''t be a negative number.'
    WHEN p_value >= 1000000000000 THEN 'Keep the value under a trillion.'
    WHEN char_length(p_source) > 100 THEN 'Keep the source to 100 characters.'
    WHEN char_length(p_next_step) > 2000 THEN 'Keep the next step to 2,000 characters.'
  END
$$;

REVOKE ALL ON FUNCTION public.opportunity_input_error(text, integer, numeric, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- Saves the opportunity's own fields (every one is sent; a blank one is cleared) from the version the person started from: name, target start, employees, main
-- contact, expected close, value, source, next step and owner. The stage and the account are never edited here (D-428): the stage moves only by the intake, a
-- send, a quote, and won or lost (D-408, D-411), and an opportunity changes account only by a move (CRM-A2.2). Answers
--   {conflict: false, record: <the opportunity's own fields, with its new version>}  or, when someone saved first and nothing was saved,
--   {conflict: true, currentVersion, current: {the fields a person edits}, changed: [{field, value, who, at}]}.
-- p_owner_id NULL leaves the owner as it is (so an opportunity whose owner has left, or who has none, can be saved without choosing one); the owner is never
-- cleared here (owners assign unowned records, as change_account_owner has it), and a new one must be a current member of the firm, held to the end of the
-- transaction as change_account_owner holds it, and who the caller could change a record of (update_contact's rule: an agent gives it to no one else, a lead to
-- themselves and their teams, an owner of the firm to anyone) and who sees the account (visibility follows it, D-422). The main contact must be a contact of the opportunity's own account (22023 otherwise).
-- Refused, in this order and before the version is looked at: not a member of the firm (42501), a closing firm or Nevermore support (PT423), what is wrong
-- with the fields (22023), no version (22023), an opportunity the caller may not see or that is not there (PT404, one answer for both: whoever sees its account
-- sees it, D-422), an archived account (55000, D-432), an opportunity the level rule does not give the caller (42501: D-209 on the opportunity's own owner; with
-- no owner, a firm owner only), an owner who is not a current member (22023), an owner the caller could not give it to (42501) or who could not see the account (22023), a version the
-- opportunity never had (22023); then, for a save from the current
-- version, a main contact that is not the account's (22023). A stale save is answered with the conflict before its main contact is looked at.
-- Locks, in the order every write on an account's records takes them (renewal_to_change, change_account_owner, archive and delete): the ACCOUNT first (FOR NO
-- KEY UPDATE, which conflicts with the archive's and the owner change's and the delete's), then the opportunity; the level rule is judged on the rows as held,
-- not on ones an owner change is about to replace, and an archive that commits first is seen. An opportunity that moved to another account while this waited
-- is refused (40001).
CREATE FUNCTION public.update_opportunity(
  p_opportunity_id uuid, p_name text, p_target_start date, p_employees integer, p_main_contact_id uuid, p_expected_close date, p_value numeric,
  p_source text, p_next_step text, p_owner_id uuid DEFAULT NULL, p_firm_id uuid DEFAULT NULL, p_version integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  name_in text := NULLIF(btrim(p_name), '');
  source_in text := NULLIF(btrim(p_source), '');
  next_in text := NULLIF(btrim(p_next_step), '');
  problem text;
  acct uuid;
  a public.accounts;
  cur public.opportunities;
  changed public.opportunities;
  owner uuid;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  problem := public.opportunity_input_error(name_in, p_employees, p_value, source_in, next_in);
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  IF p_version IS NULL OR p_version < 1 THEN
    RAISE EXCEPTION 'This save did not say which version of the opportunity it started from, so it was refused. Reload the page and try again.'
      USING ERRCODE = '22023';
  END IF;
  -- The account first (an opportunity's account is found without a lock, then held), then the opportunity.
  SELECT x.account_id INTO acct FROM public.opportunities x WHERE x.id = p_opportunity_id AND x.firm_id = firm;
  IF acct IS NOT NULL THEN
    SELECT * INTO a FROM public.accounts y WHERE y.id = acct AND y.firm_id = firm FOR NO KEY UPDATE;
  END IF;
  IF a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RAISE EXCEPTION 'That opportunity isn''t available' USING ERRCODE = 'PT404';
  END IF;
  -- The row is held from here, so that a save waiting behind another save of the same opportunity, from the same version, reads what that save left: its
  -- version, its values and its author.
  SELECT * INTO cur FROM public.opportunities x WHERE x.id = p_opportunity_id AND x.firm_id = firm FOR NO KEY UPDATE;
  IF cur.id IS NULL THEN
    RAISE EXCEPTION 'That opportunity isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF cur.account_id <> a.id THEN
    RAISE EXCEPTION 'That opportunity was moved while you were working. Try again.' USING ERRCODE = '40001';
  END IF;
  IF a.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'This account is archived. Nothing on its opportunities can be changed.' USING ERRCODE = '55000';
  END IF;
  IF NOT public.can_change_firm_record(cur.firm_id, cur.owner_id) THEN
    RAISE EXCEPTION '%', CASE WHEN cur.owner_id IS NULL
      THEN 'An opportunity with no owner can only be changed by an owner of the firm.'
      ELSE 'Only the opportunity''s owner, a lead of the owner''s team or an owner of the firm can change it.' END
      USING ERRCODE = '42501';
  END IF;
  owner := COALESCE(p_owner_id, cur.owner_id);
  IF owner IS DISTINCT FROM cur.owner_id THEN
    PERFORM 1 FROM public.firm_memberships m
    WHERE m.firm_id = cur.firm_id AND m.user_id = owner AND public.membership_is_current(m.valid_from, m.valid_until)
    FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Choose one of the firm''s people as the owner.' USING ERRCODE = '22023';
    END IF;
    -- update_contact's rule: a new owner the caller could not themselves change a record of (an agent: only themselves; a lead: themselves and their teams).
    IF NOT public.can_change_firm_record(cur.firm_id, owner) THEN
      RAISE EXCEPTION 'You can give an opportunity only to yourself and, as a lead, to people on your teams.' USING ERRCODE = '42501';
    END IF;
    -- And one who can see the account: visibility follows it (D-422), so anyone else would be given an opportunity they could not open.
    IF NOT public.crm_person_sees_record(cur.firm_id, a.owner_id, owner) THEN
      RAISE EXCEPTION 'Choose someone who can see this account.' USING ERRCODE = '22023';
    END IF;
  END IF;
  -- A version the opportunity has never had is not "someone else changed it": nobody did.
  IF p_version > cur.version THEN
    RAISE EXCEPTION 'This save names a version of the opportunity that does not exist, so it was refused. Reload the page and try again.'
      USING ERRCODE = '22023';
  END IF;
  -- The row is held, so its version is the current one: a save from an older version changes nothing and is answered below.
  IF p_version = cur.version THEN
    -- Asked only of a save that will be written: a stale one is answered with the conflict whatever contact it names (it may since have moved), as its
    -- other fields are not judged against the opportunity either.
    IF p_main_contact_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = p_main_contact_id AND c.account_id = a.id) THEN
      RAISE EXCEPTION 'Choose a contact of this account.' USING ERRCODE = '22023';
    END IF;
    BEGIN
      UPDATE public.opportunities SET
        name = name_in, target_start = p_target_start, employees = p_employees, main_contact_id = p_main_contact_id, expected_close = p_expected_close,
        value = p_value, source = source_in, next_step = next_in, owner_id = owner
      WHERE id = cur.id AND version = p_version
      RETURNING * INTO changed;
    EXCEPTION WHEN foreign_key_violation THEN
      -- The contact was deleted between the look above and the write.
      RAISE EXCEPTION 'Choose a contact of this account.' USING ERRCODE = '22023';
    END;
    RETURN jsonb_build_object('conflict', false, 'record', public.crm_opportunity_fields(changed));
  END IF;
  RETURN jsonb_build_object(
    'conflict', true,
    'currentVersion', cur.version,
    'current', jsonb_build_object(
      'name', cur.name, 'target_start', cur.target_start, 'employees', cur.employees, 'main_contact_id', cur.main_contact_id,
      'expected_close', cur.expected_close, 'value', cur.value, 'source', cur.source, 'next_step', cur.next_step, 'owner_id', cur.owner_id),
    'changed', public.record_version_changes(cur.firm_id, 'opportunities', cur.id::text, p_version, cur.version));
END;
$$;

REVOKE ALL ON FUNCTION public.update_opportunity(uuid, text, date, integer, uuid, date, numeric, text, text, uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_opportunity(uuid, text, date, integer, uuid, date, numeric, text, text, uuid, uuid, integer) TO authenticated;

-- ---------- 5. The opportunity's activity ----------
-- {count, rows}: a page of everything that happened on the opportunity, newest first (when a call took place, when a note or a task was made, when a change or a
-- quote request's event was recorded; ties by key, so a page is the same each time), at most 100 from a place that is not before the first. p_filter is 'all',
-- 'calls', 'notes', 'tasks' or 'changes' (22023 otherwise), as D-212 filters an account's. What it holds:
--   calls, notes, tasks   the activities that name this opportunity (CRM-E1.5's log_activity with an opportunity), as crm_activity_row gives them, so the page
--                         draws them with the account's code; not the account's own, nor another opportunity's, nor a contact's
--   changes               its record history as record_history_list gives it, entry by entry (type 'change': entry_key, at, change_id, kind, who, who_kind, field,
--                         from_value, to_value, cause, cause_peo, with record_table, record_id and record_name), the stage changes of its intake among them
--                         (kind 'stage_changed', field 'stage', D-413); and its quote requests' events (type 'quote': entry_key, at, who, who_kind,
--                         quote_request_id, peo_name and event, which is sent, quoted, declined or closed), each one a change of the record's quotes, so the
--                         Changes filter holds them with the rest
-- 'all' is all of it. record_history_list is read page by page until it is empty, never restated (D-413: nothing but the capture trigger writes the history,
-- and nothing here copies it). The one refusal, PT404, is the page's: an opportunity that is not there, is another firm's or whose account the caller may not see.
CREATE FUNCTION public.opportunity_activity(p_firm_id uuid, p_opportunity_id uuid, p_filter text DEFAULT 'all', p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  o public.opportunities;
  a public.accounts;
  want text;
  hist jsonb := '[]'::jsonb;
  chunk jsonb;
  after_at timestamptz;
  after_key uuid;
  n bigint;
  r jsonb;
BEGIN
  IF p_limit IS NULL OR p_limit < 0 OR p_limit > 100 OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'A page is 0 to 100 rows, from a place that is not before the first' USING ERRCODE = '22023';
  END IF;
  IF p_filter IS NULL OR p_filter NOT IN ('all', 'calls', 'notes', 'tasks', 'changes') THEN
    RAISE EXCEPTION 'An opportunity''s activity is all, calls, notes, tasks or changes' USING ERRCODE = '22023';
  END IF;
  IF p_firm_id IS NOT NULL AND p_opportunity_id IS NOT NULL THEN
    SELECT * INTO o FROM public.opportunities x WHERE x.id = p_opportunity_id AND x.firm_id = p_firm_id;
    SELECT * INTO a FROM public.accounts x WHERE x.id = o.account_id AND x.firm_id = o.firm_id;
  END IF;
  IF o.id IS NULL OR a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RAISE EXCEPTION 'That opportunity isn''t available' USING ERRCODE = 'PT404';
  END IF;
  want := CASE p_filter WHEN 'calls' THEN 'call' WHEN 'notes' THEN 'note' WHEN 'tasks' THEN 'task' END;
  IF p_filter IN ('all', 'changes') THEN
    LOOP
      SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY l.at DESC, l.entry_key DESC), '[]'::jsonb) INTO chunk
      FROM public.record_history_list(o.firm_id, 'opportunities', o.id::text, 100, after_at, after_key) l;
      hist := hist || chunk;
      EXIT WHEN jsonb_array_length(chunk) < 100;
      after_at := (chunk -> 99 ->> 'at')::timestamptz;
      after_key := (chunk -> 99 ->> 'entry_key')::uuid;
    END LOOP;
  END IF;
  WITH entries AS (
    SELECT h.e ->> 'entry_key' AS entry_key, (h.e ->> 'at')::timestamptz AS at,
           h.e || jsonb_build_object('type', 'change', 'record_table', 'opportunities', 'record_id', o.id, 'record_name', o.name) AS j
    FROM jsonb_array_elements(hist) AS h (e)
    UNION ALL
    SELECT 'quote_request_event:' || e.id, e.changed_at,
           jsonb_build_object('type', 'quote', 'entry_key', 'quote_request_event:' || e.id, 'at', e.changed_at, 'quote_request_id', e.quote_request_id,
                              'peo_name', q.peo_name, 'event', e.new_value, 'who', public.record_history_who(e.changed_by, public.firm_actor_is_staff(e.changed_by, o.firm_id)),
                              'who_kind', CASE WHEN public.firm_actor_is_staff(e.changed_by, o.firm_id) THEN 'nevermore' WHEN e.changed_by IS NULL THEN 'system' ELSE 'member' END)
    FROM public.quote_request_events e JOIN public.quote_requests q ON q.id = e.quote_request_id
    WHERE p_filter IN ('all', 'changes') AND o.intake_id IS NOT NULL AND e.session_id = o.intake_id AND e.field = 'status'
      AND e.new_value IN ('sent', 'quoted', 'declined', 'closed')
    UNION ALL
    -- Only the key is taken here: the row is built below, for the page's rows alone.
    SELECT t.id::text, t.at, NULL::jsonb
    FROM public.activities t
    WHERE p_filter IN ('all', 'calls', 'notes', 'tasks') AND t.opportunity_id = o.id AND t.account_id = o.account_id AND (want IS NULL OR t.kind = want)
  )
  SELECT (SELECT count(*) FROM entries),
         COALESCE((SELECT jsonb_agg(x.j ORDER BY x.o) FROM (
           SELECT row_number() OVER (ORDER BY e.at DESC, e.entry_key DESC) AS o,
                  COALESCE(e.j, (SELECT public.crm_activity_row(t) FROM public.activities t WHERE t.id = e.entry_key::uuid)) AS j
           FROM (SELECT * FROM entries ORDER BY at DESC, entry_key DESC OFFSET p_offset LIMIT p_limit) e) x), '[]'::jsonb)
  INTO n, r;
  RETURN jsonb_build_object('count', n, 'rows', r);
END;
$$;

REVOKE ALL ON FUNCTION public.opportunity_activity(uuid, uuid, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.opportunity_activity(uuid, uuid, text, integer, integer) TO authenticated;
