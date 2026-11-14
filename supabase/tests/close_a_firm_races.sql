-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh close_a_firm_races
-- The firm's row as the one lock that orders closing a firm, suspending it, deciding on it and its members' writes (story CRM-P1.7, fixes 2;
-- docs/BROKER_CRM_BUILD.md D-32, D-122; 20261118111000_close_a_firm_races.sql). Each case is two real connections (dblink): the first begins
-- something and holds its transaction open; the second starts the thing that must be ordered against it and must be seen waiting; the first
-- commits; and what the second then finds is the answer. Without the lock the second is not seen waiting, and the case fails. Every migration
-- is loaded, in filename order (D-105), this story's last.
\set ON_ERROR_STOP 1
\i e2e/stack/bootstrap.sql
\i supabase/migrations/20260323215855_6110f697-3604-440a-bcc3-685413801386.sql
\i supabase/migrations/20260323224722_847cb3a9-3573-491f-ba0c-54a2ccea0340.sql
\i supabase/migrations/20260324031329_0de2017b-f5c3-4631-b280-4cfa150f3c76.sql
\i supabase/migrations/20261020180000_signup_company_and_session_submission.sql
\i supabase/migrations/20261020190000_ai_rate_limit.sql
\i supabase/migrations/20261020200000_block_guest_submission.sql
\i supabase/migrations/20261020210000_certification_events.sql
\i supabase/migrations/20261020220000_guest_abuse_limits.sql
\i supabase/migrations/20261021090000_chamber_field_provenance.sql
\i supabase/migrations/20261021100000_session_documents.sql
\i supabase/migrations/20261022090000_advisor_operations.sql
\i supabase/migrations/20261023090000_document_categories_and_storage_access.sql
\i supabase/migrations/20261024090000_document_processing_started.sql
\i supabase/migrations/20261024100000_advisor_queue.sql
\i supabase/migrations/20261025090000_submission_outbox.sql
\i supabase/migrations/20261026090000_outbox_reliability.sql
\i supabase/migrations/20261027090000_intake_validation_and_versioning.sql
\i supabase/migrations/20261027090001_outbox_operations.sql
\i supabase/migrations/20261027100000_outbox_schedule.sql
\i supabase/migrations/20261028090000_email_delivery_events.sql
\i supabase/migrations/20261029090000_document_ingestion.sql
\i supabase/migrations/20261029091000_census_advisor_review.sql
\i supabase/migrations/20261029092000_census_in_intake_validation.sql
\i supabase/migrations/20261103090000_intake_lifecycle.sql
\i supabase/migrations/20261103091000_intake_schema_version.sql
\i supabase/migrations/20261103100000_chosen_peo.sql
\i supabase/migrations/20261103110000_certification_readiness.sql
\i supabase/migrations/20261103110001_document_storage_path.sql
\i supabase/migrations/20261103120000_intake_schema_v2_workers_comp.sql
\i supabase/migrations/20261103120100_intake_schema_v2_version.sql
\i supabase/migrations/20261103120200_ai_extraction_events.sql
\i supabase/migrations/20261104090000_intake_consent.sql
\i supabase/migrations/20261104091000_ops_monitoring.sql
\i supabase/migrations/20261104092000_data_retention_and_deletion.sql
\i supabase/migrations/20261104093000_security_review_fixes.sql
\i supabase/migrations/20261104100000_certification_conflicts.sql
\i supabase/migrations/20261104101000_transcript_validation.sql
\i supabase/migrations/20261104102000_one_open_draft.sql
\i supabase/migrations/20261104103000_required_items.sql
\i supabase/migrations/20261104110000_pin_reviews_and_manuscripts_to_answers.sql
\i supabase/migrations/20261104111000_pipeline_follows_the_prospect.sql
\i supabase/migrations/20261104112000_certified_evidence.sql
\i supabase/migrations/20261104113000_share_reviewed_manuscript.sql
\i supabase/migrations/20261104114000_paged_advisor_queue.sql
\i supabase/migrations/20261104115000_advisor_review_followups.sql
\i supabase/migrations/20261104116000_intake_deletion_removes_document_history.sql
\i supabase/migrations/20261104117000_certification_snapshots.sql
\i supabase/migrations/20261104117100_alert_headcount_census.sql
\i supabase/migrations/20261104118000_open_items.sql
\i supabase/migrations/20261104120000_submission_records.sql
\i supabase/migrations/20261104121000_voice_failed_ops_kind.sql
\i supabase/migrations/20261104122000_pipeline_transitions.sql
\i supabase/migrations/20261104130000_document_scanning.sql
\i supabase/migrations/20261104131000_certification_file_id_check.sql
\i supabase/migrations/20261104132000_needs_advisor_action.sql
\i supabase/migrations/20261104133000_queue_hides_empty_guest_drafts.sql
\i supabase/migrations/20261105090000_information_requests.sql
\i supabase/migrations/20261105091000_draft_expiry_reminders.sql
\i supabase/migrations/20261105092000_intake_milestones.sql
\i supabase/migrations/20261106090000_hardening.sql
\i supabase/migrations/20261106100000_intake_sources.sql
\i supabase/migrations/20261107090000_intake_consent_v2.sql
\i supabase/migrations/20261109090000_packet_error_messages.sql
\i supabase/migrations/20261110090000_quote_requests.sql
\i supabase/migrations/20261111090000_quote_request_notes.sql
\i supabase/migrations/20261111100000_quote_request_addresses.sql
\i supabase/migrations/20261111110000_quote_request_messages.sql
\i supabase/migrations/20261111120000_quote_request_threads.sql
\i supabase/migrations/20261111130000_held_mail.sql
\i supabase/migrations/20261111140000_peo_mail_alert.sql
\i supabase/migrations/20261112090000_intake_schema_v3_version.sql
\i supabase/migrations/20261112091000_intake_schema_v3_company_identity.sql
\i supabase/migrations/20261112092000_intake_schema_v3_industry_code.sql
\i supabase/migrations/20261112093000_intake_schema_v3_current_peo.sql
\i supabase/migrations/20261112094000_intake_schema_v3_census_columns.sql
\i supabase/migrations/20261112095000_intake_schema_v3_census_worksite.sql
\i supabase/migrations/20261112096000_intake_schema_v3_owners_officers.sql
\i supabase/migrations/20261112097000_intake_schema_v3_loss_history.sql
\i supabase/migrations/20261112098000_intake_schema_v3_medical_plans.sql
\i supabase/migrations/20261112099000_intake_schema_v3_suta_rates.sql
\i supabase/migrations/20261112100000_intake_schema_v3_acord_130_questions.sql
\i supabase/migrations/20261113090000_broker_mailboxes.sql
\i supabase/migrations/20261113100000_allowed_organisations.sql
\i supabase/migrations/20261115090000_peo_requirement_profiles.sql
\i supabase/migrations/20261115100000_peo_profile_editor.sql
\i supabase/migrations/20261115110000_peo_industry_class_codes.sql
\i supabase/migrations/20261115120000_extra_answers.sql
\i supabase/migrations/20261115130000_information_request_extra_questions.sql
\i supabase/migrations/20261115140000_peo_census_templates.sql
\i supabase/migrations/20261116090000_firms.sql
\i supabase/migrations/20261116110000_firm_scoped_policies.sql
\i supabase/migrations/20261116140000_firm_address_lookup.sql
\i supabase/migrations/20261116150000_second_factor_for_password_sign_ins.sql
\i supabase/migrations/20261116160000_firm_address_member_before_second_factor.sql
\i supabase/migrations/20261116160001_firm_activity.sql
\i supabase/migrations/20261116170000_firm_signup.sql
\i supabase/migrations/20261116170001_firm_events_recorded.sql
\i supabase/migrations/20261116180000_function_firm_scope.sql
\i supabase/migrations/20261116190000_firm_invitations.sql
\i supabase/migrations/20261116190500_invitation_fixes.sql
\i supabase/migrations/20261116200000_firm_scope_unsubmitted_data.sql
\i supabase/migrations/20261116200500_firm_scope_fixes.sql
\i supabase/migrations/20261116210000_console_per_firm.sql
\i supabase/migrations/20261116210500_console_per_firm_fixes.sql
\i supabase/migrations/20261116210600_mailbox_kept_for_members.sql
\i supabase/migrations/20261116220000_remove_or_suspend_a_member.sql
\i supabase/migrations/20261116220500_remove_or_suspend_fixes.sql
\i supabase/migrations/20261116230000_firm_suspension.sql
\i supabase/migrations/20261116240000_held_mail_to_the_right_firm.sql
\i supabase/migrations/20261117090000_one_firm_at_a_time.sql
\i supabase/migrations/20261117090500_one_firm_at_a_time_fixes.sql
\i supabase/migrations/20261117100000_queue_query.sql
\i supabase/migrations/20261117100500_queue_query_fast_path.sql
\i supabase/migrations/20261117120000_table_settings.sql
\i supabase/migrations/20261117120500_table_settings_fixes.sql
\i supabase/migrations/20261117160000_epics_reconciled.sql
\i supabase/migrations/20261118090000_leave_a_firm.sql
\i supabase/migrations/20261118090500_leave_a_firm_fixes.sql
\i supabase/migrations/20261118100000_join_by_organisation.sql
\i supabase/migrations/20261118100500_join_by_organisation_fixes.sql
\i supabase/migrations/20261118110000_close_a_firm.sql
\i supabase/migrations/20261118110500_close_a_firm_fixes.sql
\i supabase/migrations/20261118111000_close_a_firm_races.sql
\i supabase/migrations/20261118120000_help_from_nevermore.sql
\i supabase/migrations/20261118120500_help_from_nevermore_fixes.sql
\i supabase/migrations/20261118130000_record_history.sql
\i supabase/migrations/20261118130500_record_history_fixes.sql
SET client_min_messages = notice;

CREATE TEMP TABLE fx (name text PRIMARY KEY, id uuid NOT NULL);
GRANT SELECT ON fx TO anon, authenticated, service_role;
CREATE FUNCTION pg_temp.id(n text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM fx WHERE name = n $$;

CREATE FUNCTION pg_temp.new_user(n text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', n || '@example.test', now(), false, now(), now());
  INSERT INTO fx VALUES (n, uid);
  RETURN uid;
END $$;

CREATE FUNCTION pg_temp.as_user(n text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', false, 'email', n || '@example.test')::text, false);
  SET LOCAL ROLE authenticated;
END $$;

CREATE FUNCTION pg_temp.as_anon() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', false);
  SET LOCAL ROLE anon;
END $$;

CREATE FUNCTION pg_temp.is(got anyelement, want anyelement, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION 'FAIL: % gave %, expected %', label, got, want; END IF;
END $$;

-- Runs stmt and always rolls it back: 'rows:<n>' for the rows it touched, or the SQLSTATE it raised.
CREATE FUNCTION pg_temp.attempt(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint; s text; m text;
BEGIN
  BEGIN
    EXECUTE stmt;
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE EXCEPTION USING ERRCODE = 'ZZ999', MESSAGE = n::text;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT;
    IF s = 'ZZ999' THEN RETURN 'rows:' || m; END IF;
    RETURN s;
  END;
END $$;

-- The SQLSTATE and message a statement raised, or 'ok' when it did not. The statement's own work is kept when it succeeds.
CREATE FUNCTION pg_temp.refusal(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE s text; m text;
BEGIN
  BEGIN
    EXECUTE stmt;
    RETURN 'ok';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT;
    RETURN s || ': ' || m;
  END;
END $$;

-- How many rows of each table closing deletes a firm holds, as one object, read as the table owner.
CREATE FUNCTION pg_temp.held(fid uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE step record; n bigint; res jsonb := '{}'::jsonb;
BEGIN
  FOR step IN SELECT p.src, p.firm_column FROM public.firm_closing_plan() p WHERE p.action = 'delete' ORDER BY p.ord LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %I = $1', substr(step.src, 8), step.firm_column) INTO n USING fid;
    res := res || jsonb_build_object(substr(step.src, 8), n);
  END LOOP;
  RETURN res;
END $$;

-- Moves a firm's open request back in time, so its 30 days have passed.
CREATE FUNCTION pg_temp.age_request(fid uuid, days integer) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.firm_closures SET asked_at = asked_at - make_interval(days => days), closes_at = closes_at - make_interval(days => days)
  WHERE firm_id = fid AND withdrawn_at IS NULL AND closed_at IS NULL
$$;

CREATE FUNCTION pg_temp.hash(t text) RETURNS text LANGUAGE sql AS $$ SELECT encode(extensions.digest(t, 'sha256'), 'hex') $$;


CREATE SCHEMA race;
CREATE EXTENSION dblink SCHEMA race;

-- dblink_exec runs commands that return nothing: a SELECT is run as a PERFORM inside an anonymous block.
CREATE FUNCTION pg_temp.as_command(stmt text) RETURNS text LANGUAGE sql AS $$
  SELECT CASE WHEN stmt ~* '^SELECT ' THEN format('DO $do$ BEGIN PERFORM %s; END $do$', substr(stmt, 8)) ELSE stmt END
$$;

-- Runs two statements in two committed-or-not transactions and says what happened: 'waited:<result>' when the second was seen waiting on
-- the first (the result is what it gave after the first committed: 'ok' or its SQLSTATE), or 'did not wait:<result>' when it finished without
-- waiting. `*_who` is a user's name, or NULL to stay as the connecting superuser. `a_late` runs in the first after the second is waiting and
-- before the first commits (its SQLSTATE, or 'ok', is appended as ' late:<it>').
CREATE FUNCTION pg_temp.race_pair(a_who text, a_stmts text[], b_who text, b_stmt text, a_late text DEFAULT NULL, a_slow text DEFAULT NULL, b_delay numeric DEFAULT 0.4) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  dsn text := format('dbname=%s user=%s port=%s host=%s', current_database(), session_user, current_setting('port'),
    split_part(current_setting('unix_socket_directories'), ',', 1));
  b_pid integer; tries integer := 0; waited boolean := false; res text; late text := ''; s text; i integer; a_async boolean := false;
BEGIN
  PERFORM race.dblink_connect('ra', dsn);
  PERFORM race.dblink_connect('rb', dsn);
  PERFORM race.dblink_exec('rb', 'SET lock_timeout = ''20s''');
  PERFORM race.dblink_exec('ra', 'SET lock_timeout = ''20s''');
  SELECT pid INTO b_pid FROM race.dblink('rb', 'SELECT pg_backend_pid()') AS t(pid integer);
  PERFORM race.dblink_exec('ra', 'BEGIN');
  IF a_who IS NOT NULL THEN
    PERFORM race.dblink_exec('ra', 'SET LOCAL ROLE authenticated');
    PERFORM race.dblink_exec('ra', format('SET LOCAL request.jwt.claims = %L',
      jsonb_build_object('sub', pg_temp.id(a_who), 'role', 'authenticated', 'is_anonymous', false, 'email', a_who || '@example.test')::text));
  END IF;
  FOR i IN 1..cardinality(a_stmts) LOOP
    IF a_slow IS NOT NULL AND i = cardinality(a_stmts) THEN
      -- The last statement runs in the background and is slowed inside (a trigger sleeps `a_slow` seconds when it updates a request), so
      -- the second starts while the first is part-way through, not after it has finished.
      PERFORM race.dblink_exec('ra', format('SET LOCAL zz.slow = %L', a_slow));
      PERFORM race.dblink_send_query('ra', a_stmts[i]);
      a_async := true;
      PERFORM pg_sleep(b_delay);
    ELSE
      PERFORM race.dblink_exec('ra', pg_temp.as_command(a_stmts[i]));
    END IF;
  END LOOP;
  PERFORM race.dblink_exec('rb', 'BEGIN');
  IF b_who IS NOT NULL THEN
    PERFORM race.dblink_exec('rb', 'SET LOCAL ROLE authenticated');
    PERFORM race.dblink_exec('rb', format('SET LOCAL request.jwt.claims = %L',
      jsonb_build_object('sub', pg_temp.id(b_who), 'role', 'authenticated', 'is_anonymous', false, 'email', b_who || '@example.test')::text));
  END IF;
  PERFORM race.dblink_send_query('rb', b_stmt);
  WHILE tries < 80 LOOP
    IF cardinality(pg_blocking_pids(b_pid)) > 0 THEN waited := true; EXIT; END IF;
    IF race.dblink_is_busy('rb') = 0 THEN EXIT; END IF;
    tries := tries + 1;
    PERFORM pg_sleep(0.05);
  END LOOP;
  IF a_async THEN
    BEGIN PERFORM * FROM race.dblink_get_result('ra') AS t(r text); EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE; late := late || ' first:' || s; END;
    BEGIN PERFORM * FROM race.dblink_get_result('ra') AS t(r text); EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  IF a_late IS NOT NULL THEN
    BEGIN
      PERFORM race.dblink_exec('ra', pg_temp.as_command(a_late));
      late := ' late:ok';
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE;
      late := ' late:' || s;
    END;
  END IF;
  BEGIN PERFORM race.dblink_exec('ra', 'COMMIT'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    PERFORM * FROM race.dblink_get_result('rb') AS t(r text);
    res := 'ok';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE;
    res := s;
  END;
  BEGIN PERFORM * FROM race.dblink_get_result('rb') AS t(r text); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM race.dblink_exec('rb', 'COMMIT'); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM race.dblink_disconnect('ra');
  PERFORM race.dblink_disconnect('rb');
  RETURN CASE WHEN waited THEN 'waited:' ELSE 'did not wait:' END || res || late;
END $$;

-- ---------- set up (committed: the two sessions must see it) ----------
-- rw1 to rw3: firms with an owner, an agent, an intake and a platform admin for the cases below.
DO $$
DECLARE f uuid; i integer; s uuid;
BEGIN
  PERFORM pg_temp.new_user(n) FROM unnest(ARRAY['rw_owner', 'rw_agent', 'rw_admin', 'rw_prospect', 'rw_prospect2', 'rw_prospect3', 'rw_prospect4',
    'sp_owner', 'wt_owner', 'cs_owner', 'ls_owner', 'st_owner', 'ss_owner', 'sl_owner']) AS n;
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('rw_admin'), 'admin'), (pg_temp.id('rw_agent'), 'advisor');
  FOR i IN 1..5 LOOP
    INSERT INTO public.firms (name, address, approved_at, decision, decided_at) VALUES ('Race Write ' || i, 'race-write-' || i, now(), 'approved', now()) RETURNING id INTO f;
    INSERT INTO fx VALUES ('rw' || i, f);
    INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (f, pg_temp.id('rw_owner'), 'owner'), (f, pg_temp.id('rw_agent'), 'agent');
    INSERT INTO public.chamber_sessions (user_id, firm_id, chamber_data) VALUES (pg_temp.id(CASE i WHEN 1 THEN 'rw_prospect' WHEN 2 THEN 'rw_prospect2' WHEN 3 THEN 'rw_prospect3' ELSE 'rw_prospect4' END), f, '{}') RETURNING id INTO s;
    INSERT INTO fx VALUES ('rw_intake' || i, s);
  END LOOP;
END $$;

CREATE FUNCTION pg_temp.open_requests(fid uuid) RETURNS bigint LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*) FROM public.firm_closures WHERE firm_id = fid AND withdrawn_at IS NULL AND closed_at IS NULL
$$;
CREATE FUNCTION pg_temp.asks(fid uuid) RETURNS text LANGUAGE sql AS $$ SELECT format($q$SELECT public.request_firm_closure(%L, (SELECT name FROM public.firms WHERE id = %L))::text$q$, fid, fid) $$;

-- ---------- 1. a close request does not overtake a member's write in progress ----------
-- Break caught: a member's write has passed the "is the firm closing" check and is still running; the request to close is made and committed;
-- the write then commits in the read-only period. The request must wait for the write (every guarded write holds the firm's row FOR KEY SHARE
-- in assert_firm_writable), so the write is before the request. Tried through a function, the notes trigger and the manuscript storage policy.
DO $$
DECLARE r text; f uuid := pg_temp.id('rw1'); s uuid := pg_temp.id('rw_intake1');
BEGIN
  r := pg_temp.race_pair('rw_agent', ARRAY[format($q$SELECT public.advisor_add_referral_partner('race-one', 'Race One', 'accounting', %L)$q$, f)], 'rw_owner', pg_temp.asks(f));
  PERFORM pg_temp.is(r, 'waited:ok', 'a request to close waits for a member''s write in flight (function)');
  PERFORM pg_temp.is((SELECT count(*) FROM public.referral_partners WHERE firm_id = f AND code = 'race-one'), 1::bigint, 'and the write is committed, before the request');
  PERFORM pg_temp.is(pg_temp.open_requests(f), 1::bigint, 'and the request is made');
  -- The same firm, now closing: the next write is refused.
  PERFORM pg_temp.as_user('rw_agent');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.advisor_add_referral_partner('race-two', 'Race Two', 'accounting', %L)$q$, f)), 'PT423', 'and a write after it is refused');
  RESET ROLE;

  f := pg_temp.id('rw2'); s := pg_temp.id('rw_intake2');
  r := pg_temp.race_pair('rw_agent', ARRAY[format($q$INSERT INTO public.advisor_notes (session_id, author_id, body) VALUES (%L, %L, 'in flight')$q$, s, pg_temp.id('rw_agent'))], 'rw_owner', pg_temp.asks(f));
  PERFORM pg_temp.is(r, 'waited:ok', 'a request to close waits for a note in flight (trigger)');
  PERFORM pg_temp.is((SELECT count(*) FROM public.advisor_notes WHERE session_id = s), 1::bigint, 'and the note is committed, before the request');

  f := pg_temp.id('rw3'); s := pg_temp.id('rw_intake3');
  r := pg_temp.race_pair('rw_agent', ARRAY[format($q$INSERT INTO storage.objects (bucket_id, name) VALUES ('manuscripts', %L)$q$, s || '/in-flight.pdf')], 'rw_owner', pg_temp.asks(f));
  PERFORM pg_temp.is(r, 'waited:ok', 'a request to close waits for a stored manuscript in flight (storage policy)');
  PERFORM pg_temp.is((SELECT count(*) FROM storage.objects WHERE bucket_id = 'manuscripts' AND name = s || '/in-flight.pdf'), 1::bigint, 'and the file is committed, before the request');
  RAISE NOTICE 'close_a_firm_races: a request waits for writes in flight';
END $$;

-- The other order: the request is made first and still uncommitted; a write that starts then waits, and when the request commits it is
-- refused, not committed in the read-only period. Break caught: a write that starts during a request's transaction commits after it.
DO $$
DECLARE r text; f uuid := pg_temp.id('rw4'); s uuid := pg_temp.id('rw_intake4');
BEGIN
  r := pg_temp.race_pair('rw_owner', ARRAY[pg_temp.asks(f)], 'rw_agent', format($q$SELECT public.advisor_add_referral_partner('late-write', 'Late', 'accounting', %L)$q$, f));
  PERFORM pg_temp.is(r, 'waited:PT423', 'a write that starts while a request is being made waits, then is refused');
  PERFORM pg_temp.is((SELECT count(*) FROM public.referral_partners WHERE firm_id = f), 0::bigint, 'and changes nothing');
  r := pg_temp.race_pair('rw_agent', ARRAY[format($q$SELECT public.advisor_add_referral_partner('late-write', 'Late', 'accounting', %L)$q$, pg_temp.id('rw5'))], 'rw_owner', 'SELECT 1');
  PERFORM pg_temp.is(r, 'did not wait:ok', 'control: two things that need no ordering do not wait on each other');
  RAISE NOTICE 'close_a_firm_races: a write after a request waits and is refused';
END $$;

-- Two members' ordinary writes never wait for each other, and a write that upgrades its lock while a request waits does not deadlock.
-- Break caught: KEY SHARE taken as SHARE (two members that both go on to take the row FOR NO KEY UPDATE, as invite_member and the last-owner
-- trigger do, would deadlock), or a waiting request that blocks a lock upgrade by a holder.
DO $$
DECLARE r text; f uuid := pg_temp.id('rw5');
BEGIN
  -- The second member's write finishes while the first is still open; the first then takes the row FOR NO KEY UPDATE (as inviting does) while the
  -- second's transaction is still open. With a SHARE lock it would wait for the second (and the second, for the first, in a real pair): a deadlock.
  r := pg_temp.race_pair('rw_agent', ARRAY[format($q$SELECT public.advisor_add_referral_partner('member-one', 'One', 'accounting', %L)$q$, f)], 'rw_owner',
    format($q$SELECT public.advisor_add_referral_partner('member-two', 'Two', 'accounting', %L)::text$q$, f),
    format($q$RESET ROLE; SET LOCAL lock_timeout = '2s'; DO $do$ BEGIN PERFORM 1 FROM public.firms WHERE id = %L FOR NO KEY UPDATE; END $do$ $q$, f));
  PERFORM pg_temp.is(r, 'did not wait:ok late:ok', 'one member''s write in flight does not make another member''s wait, nor block it from taking the row for update');
  r := pg_temp.race_pair('rw_agent', ARRAY[format($q$SELECT public.advisor_add_referral_partner('member-three', 'Three', 'accounting', %L)$q$, f)], 'rw_owner', pg_temp.asks(f),
    format($q$RESET ROLE; DO $do$ BEGIN PERFORM 1 FROM public.firms WHERE id = %L FOR NO KEY UPDATE; END $do$ $q$, f));
  PERFORM pg_temp.is(r, 'waited:ok late:ok', 'a write that takes the row FOR NO KEY UPDATE after its guard, while a request waits, is not deadlocked by it');
  RAISE NOTICE 'close_a_firm_races: no deadlock between writes and a request';
END $$;

-- ---------- 2. a suspension, a refusal, a stop or a lift does not interleave with the closing or a request ----------
-- Break caught: the closing sees no suspension while the suspension is committing, so a firm that is suspended is closed (a closed firm with an
-- open suspension); or the suspension, seeing no closing in progress, is recorded on a firm that then closes.
CREATE FUNCTION pg_temp.due_firm(n text, addr text, owner text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE fid uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at, decision, decided_at) VALUES (n, addr, now(), 'approved', now()) RETURNING id INTO fid;
  INSERT INTO fx VALUES (addr, fid);
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (fid, pg_temp.id(owner), 'owner');
  INSERT INTO public.firm_closures (firm_id, asked_at, asked_by, closes_at) VALUES (fid, now() - interval '31 days', pg_temp.id(owner), now() - interval '1 day');
  RETURN fid;
END $$;

DO $$
DECLARE f uuid;
BEGIN
  PERFORM pg_temp.due_firm('Suspend First', 'suspend-first', 'sp_owner');
  PERFORM pg_temp.due_firm('Close First', 'close-first', 'cs_owner');
  f := pg_temp.due_firm('Lift Race', 'lift-race', 'ls_owner');
  PERFORM pg_temp.due_firm('Stop Race', 'stop-race', 'st_owner');
  INSERT INTO public.firm_suspensions (firm_id, suspended_by, reason) VALUES (f, pg_temp.id('rw_admin'), 'racing');
  INSERT INTO public.firms (name, address) VALUES ('Waiting Race', 'waiting-race') RETURNING id INTO f;
  INSERT INTO fx VALUES ('waiting-race', f);
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (f, pg_temp.id('wt_owner'), 'owner');
END $$;

DO $$
DECLARE r text; f uuid;
BEGIN
  -- the suspension commits first: the closing waits, then refuses
  f := pg_temp.id('suspend-first');
  r := pg_temp.race_pair('rw_admin', ARRAY[format($q$SELECT public.admin_suspend_firm(%L, 'racing')$q$, f)], NULL, format($q$SELECT public.close_firm_now(%L)::text$q$, f));
  PERFORM pg_temp.is(r, 'waited:55000', 'a closing waits for a suspension that is committing, then refuses (a suspended firm is not closed)');
  PERFORM pg_temp.is(public.firm_is_closed(f), false, 'the firm is not closed');
  PERFORM pg_temp.is(public.firm_is_suspended(f), true, 'it is suspended');
  PERFORM pg_temp.is(pg_temp.open_requests(f), 1::bigint, 'and its request is still open');
  -- the closing commits first: the suspension waits, then is refused
  f := pg_temp.id('close-first');
  r := pg_temp.race_pair(NULL, ARRAY[format($q$SELECT public.close_firm_now(%L)::text$q$, f)], 'rw_admin', format($q$SELECT public.admin_suspend_firm(%L, 'racing')$q$, f));
  PERFORM pg_temp.is(r, 'waited:55000', 'a suspension waits for a closing that is running, then is refused (the firm is closed)');
  PERFORM pg_temp.is(public.firm_is_closed(f), true, 'the firm is closed');
  PERFORM pg_temp.is(public.firm_is_suspended(f), false, 'and not suspended: never both');
  RAISE NOTICE 'close_a_firm_races: suspending against closing';
END $$;

-- A lift and a stop against the closing. Break caught: the closing runs on the date the lift is moving, or on a request that is being stopped.
DO $$
DECLARE r text; f uuid;
BEGIN
  f := pg_temp.id('lift-race');
  r := pg_temp.race_pair('rw_admin', ARRAY[format($q$SELECT public.admin_lift_firm_suspension(%L)$q$, f)], NULL, format($q$SELECT public.close_firm_now(%L)::text$q$, f));
  PERFORM pg_temp.is(r, 'waited:55000', 'a closing waits for a lift that is committing, then finds the date moved seven days on');
  PERFORM pg_temp.is(public.firm_is_closed(f), false, 'and does not close the firm');
  PERFORM pg_temp.is((SELECT closes_at > now() + interval '6 days' FROM public.firm_closures WHERE firm_id = f AND closed_at IS NULL AND withdrawn_at IS NULL), true, 'on the later date');

  f := pg_temp.id('stop-race');
  r := pg_temp.race_pair('rw_admin', ARRAY[format($q$SELECT public.admin_stop_firm_closure(%L, 'racing')$q$, f)], NULL, format($q$SELECT public.close_firm_now(%L)::text$q$, f));
  PERFORM pg_temp.is(r, 'waited:PT404', 'a closing waits for a stop that is committing, then finds no request');
  PERFORM pg_temp.is(public.firm_is_closed(f), false, 'and the firm stays open');
  RAISE NOTICE 'close_a_firm_races: lifting and stopping against closing';
END $$;

-- The same orderings with the first session slowed part-way through its function, so the closing starts while it is running and not after it has
-- finished (after it has finished, the first session's foreign-key check on the firm's row would already hold the firm and hide a missing lock).
-- Break caught: the closing begins on a request that is being withdrawn, stopped or moved, and closes the firm anyway, or fails at the end.
CREATE FUNCTION public.zz_slow_closure_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('zz.slow', true) IS NOT NULL AND current_setting('zz.slow', true) <> '' THEN PERFORM pg_sleep(current_setting('zz.slow')::numeric); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER zz_slow BEFORE UPDATE ON public.firm_closures FOR EACH ROW WHEN (OLD.closed_at IS NULL) EXECUTE FUNCTION public.zz_slow_closure_update();

DO $$
BEGIN
  PERFORM pg_temp.due_firm('Slow Stop', 'slow-stop', 'ss_owner');
  PERFORM pg_temp.due_firm('Slow Lift', 'slow-lift', 'sl_owner');
  INSERT INTO public.firm_suspensions (firm_id, suspended_by, reason) VALUES (pg_temp.id('slow-lift'), pg_temp.id('rw_admin'), 'racing');
END $$;
DO $$
DECLARE r text; f uuid := pg_temp.id('slow-stop');
BEGIN
  r := pg_temp.race_pair('rw_admin', ARRAY[format($q$SELECT public.admin_stop_firm_closure(%L, 'racing')$q$, f)], NULL, format($q$SELECT public.close_firm_now(%L)::text$q$, f), NULL, '1.5');
  PERFORM pg_temp.is(r, 'waited:PT404', 'a closing that starts while a stop is running waits for it, then finds no request');
  PERFORM pg_temp.is(public.firm_is_closed(f), false, 'the firm stays open');
  f := pg_temp.id('slow-lift');
  r := pg_temp.race_pair('rw_admin', ARRAY[format($q$SELECT public.admin_lift_firm_suspension(%L)$q$, f)], NULL, format($q$SELECT public.close_firm_now(%L)::text$q$, f), NULL, '1.5');
  PERFORM pg_temp.is(r, 'waited:55000', 'a closing that starts while a lift is running waits for it, then finds the date moved');
  PERFORM pg_temp.is(public.firm_is_closed(f), false, 'the firm stays open');
  RAISE NOTICE 'close_a_firm_races: stop and lift against a closing that starts part-way';
END $$;
-- A withdrawal: the request's 30 days end two seconds after it is made; the withdrawal starts before that and is slowed past it; the closing starts after.
DO $$
DECLARE fw uuid;
BEGIN
  PERFORM pg_temp.new_user('wd_owner');
  INSERT INTO public.firms (name, address, approved_at, decision, decided_at) VALUES ('Slow Withdraw', 'slow-withdraw', now(), 'approved', now()) RETURNING id INTO fw;
  INSERT INTO fx VALUES ('slow-withdraw', fw);
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (fw, pg_temp.id('wd_owner'), 'owner');
  INSERT INTO public.firm_closures (firm_id, asked_at, asked_by, closes_at) VALUES (fw, now() - interval '1 day', pg_temp.id('wd_owner'), now() + interval '3 seconds');
END $$;
DO $$
DECLARE r text; f uuid := pg_temp.id('slow-withdraw');
BEGIN
  r := pg_temp.race_pair('wd_owner', ARRAY[format($q$SELECT public.withdraw_firm_closure(%L)$q$, f)], NULL, format($q$SELECT public.close_firm_now(%L)::text$q$, f), NULL, '4.5', 3.2);
  PERFORM pg_temp.is(r, 'waited:PT404', 'a closing that starts while a withdrawal is running waits for it, then finds no request');
  PERFORM pg_temp.is(public.firm_is_closed(f), false, 'the firm stays open');
  DROP TRIGGER zz_slow ON public.firm_closures;
  RAISE NOTICE 'close_a_firm_races: withdrawing against a closing that starts part-way';
END $$;

-- A refusal and a request to close. Break caught: an owner of a waiting firm asks to close while the refusal is committing, and the firm
-- is left refused with an open request.
DO $$
DECLARE r text; f uuid;
BEGIN
  f := pg_temp.id('waiting-race');
  r := pg_temp.race_pair('rw_admin', ARRAY[format($q$SELECT public.admin_decide_firm(%L, false, NULL)$q$, f)], 'wt_owner', pg_temp.asks(f));
  PERFORM pg_temp.is(r, 'waited:42501', 'a request waits for a refusal that is committing, then is refused');
  PERFORM pg_temp.is((SELECT decision FROM public.firms WHERE id = f), 'refused', 'the firm is refused');
  PERFORM pg_temp.is(pg_temp.open_requests(f), 0::bigint, 'with no open request');
  RAISE NOTICE 'close_a_firm_races: refusing against asking';
END $$;

-- ---------- 3. a firm alert that slipped in at the instant of closing is ended by the claim ----------
-- Break caught: an alert queued after the closing's own sweep took its snapshot, but before it committed, saw the firm as not yet closed, stayed
-- pending, and is skipped by the claim for ever. Simulated in one session by queuing it with the trigger off.
DO $$
DECLARE f uuid := pg_temp.id('close-first'); claimed integer;
BEGIN
  ALTER TABLE public.outbox_events DISABLE TRIGGER outbox_events_closed_firm;
  INSERT INTO public.outbox_events (kind, firm_id, dedupe_key, payload) VALUES ('member_left', f, 'slipped-in', '{}');
  ALTER TABLE public.outbox_events ENABLE TRIGGER outbox_events_closed_firm;
  PERFORM pg_temp.is((SELECT status FROM public.outbox_events WHERE dedupe_key = 'slipped-in'), 'pending', 'it is pending');
  SET LOCAL ROLE service_role;
  SELECT count(*) INTO claimed FROM public.claim_outbox_events(ARRAY['member_left', 'advisor_notification', 'prospect_confirmation'], 10, 5, 600);
  RESET ROLE;
  PERFORM pg_temp.is((SELECT status || '/' || last_error FROM public.outbox_events WHERE dedupe_key = 'slipped-in'), 'suppressed/cancelled: the firm closed', 'the claim ends it, with the same words');
  PERFORM pg_temp.is(claimed, 0, 'and claims nothing');
  RAISE NOTICE 'close_a_firm_races: a slipped-in alert is ended';
END $$;

-- ---------- 4. the repair of a request on the default firm ----------
-- Break caught: the repair leaves an open request on the firm that takes every intake; ends one with a person's name or no reason; emails
-- the owners; does anything where there is nothing to repair.
DO $$
DECLARE fd uuid := public.default_firm_id(); owner_id uuid := pg_temp.new_user('df_owner');
BEGIN
  SET LOCAL ROLE service_role;
  PERFORM pg_temp.is(public.repair_default_firm_closure(), 0, 'with no request it does nothing');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE firm_id = fd AND kind = 'closure_stopped'), 0::bigint, 'and writes nothing');
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (fd, owner_id, now() + interval '30 days');
  PERFORM pg_temp.is(public.firm_is_read_only(fd), true, 'before the repair the default firm is read-only');
  SET LOCAL ROLE service_role;
  PERFORM pg_temp.is(public.repair_default_firm_closure(), 1, 'it ends the request');
  PERFORM pg_temp.is(public.repair_default_firm_closure(), 0, 'and only once');
  RESET ROLE;
  PERFORM pg_temp.is(public.firm_is_read_only(fd), false, 'the default firm can be changed again');
  PERFORM pg_temp.is((SELECT withdrawn_by IS NULL AND stopped_by IS NULL AND stop_reason = 'The default firm can''t be closed' AND closed_at IS NULL FROM public.firm_closures WHERE firm_id = fd), true,
    'ended as stopped by Nevermore, with the reason and no person');
  PERFORM pg_temp.is((SELECT actor_id IS NULL AND actor_is_staff FROM public.firm_activity WHERE firm_id = fd AND kind = 'closure_stopped'), true, 'the firm''s record shows it as Nevermore''s');
  PERFORM pg_temp.is((SELECT count(*) FROM public.outbox_events WHERE firm_id = fd), 0::bigint, 'and no one is emailed');
  PERFORM pg_temp.is(has_function_privilege('authenticated', 'public.repair_default_firm_closure()', 'EXECUTE'), false, 'no signed-in person can run it');
  RAISE NOTICE 'close_a_firm_races: the repair passed';
END $$;

-- ---------- 5. why an owner can't ask ----------
-- Break caught: the page can't tell a firm that can't be closed from a firm that failed to load, or tell the reasons apart.
DO $$
DECLARE f uuid := pg_temp.id('rw5'); fd uuid := public.default_firm_id(); fr uuid;
BEGIN
  INSERT INTO public.firms (name, address, decision, decided_at) VALUES ('Refused Reason', 'refused-reason', 'refused', now()) RETURNING id INTO fr;
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (fr, pg_temp.id('rw_owner'), 'owner'), (fd, pg_temp.id('rw_owner'), 'owner');
  PERFORM pg_temp.as_user('rw_owner');
  PERFORM pg_temp.is((SELECT c.cannot_ask_because FROM public.my_firm_closure(f) c), 'closing', 'an owner of a firm already closing is told why');
  PERFORM pg_temp.is((SELECT c.cannot_ask_because FROM public.my_firm_closure(fd) c), 'default_firm', 'the default firm says so');
  PERFORM pg_temp.is((SELECT c.cannot_ask_because FROM public.my_firm_closure(fr) c), 'refused', 'a refused firm says so');
  PERFORM pg_temp.is((SELECT c.cannot_ask_because FROM public.my_firm_closure(pg_temp.id('rw4')) c), 'closing', 'and so on');
  PERFORM pg_temp.as_user('rw_agent');
  PERFORM pg_temp.is((SELECT c.cannot_ask_because FROM public.my_firm_closure(pg_temp.id('rw4')) c), 'not_owner', 'an agent is not an owner');
  RESET ROLE;
  RAISE NOTICE 'close_a_firm_races: reasons passed';
END $$;

SELECT 'close_a_firm_races: all cases passed' AS result;
