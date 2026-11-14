-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh record_version
-- The version for the conflict check (story CRM-S2.4b; docs/BROKER_CRM_BUILD.md D-24, D-29, D-32, D-33, D-45, D-46, D-104, D-105, D-115;
-- 20261118160000_record_version.sql). A record carries a whole-number version that a trigger raises when one of its own fields really changes;
-- a save names the version it started from; a stale save changes nothing and is answered with the current values and, for each field that
-- differs from what the person started from, who changed it last and when (named the way the record's history names people). Applied to
-- referral partners. Two firms are used throughout. Every migration is loaded, in filename order (D-105), this story's last.
\set ON_ERROR_STOP 1
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
-- Stand-in for pg_cron (same names and signature as supabase/tests/outbox_schedule.sql uses), holding the daily job of the firm's record
-- as 20261116160001 made it, so the fixes migration can be seen to add the outbox clean-up to that same job.
CREATE SCHEMA cron;
CREATE TABLE cron.job (jobid serial PRIMARY KEY, jobname text UNIQUE, schedule text NOT NULL, command text NOT NULL);
CREATE FUNCTION cron.schedule(job_name text, schedule text, command text) RETURNS bigint LANGUAGE sql AS $$
  INSERT INTO cron.job (jobname, schedule, command) VALUES (job_name, schedule, command)
  ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command
  RETURNING jobid::bigint
$$;
INSERT INTO cron.job (jobname, schedule, command) VALUES ('prune-firm-activity', '53 3 * * *', 'select public.prune_firm_activity();');
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
\i supabase/migrations/20261118140000_menu_counts.sql
\i supabase/migrations/20261118140500_menu_counts_fixes.sql
\i supabase/migrations/20261118150000_queue_sort_collation.sql
\i supabase/migrations/20261118160000_record_version.sql
\i supabase/migrations/20261118160500_record_version_fixes.sql
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

-- Signs in as a person, at a firm's address when one is named (D-40). `how` 'password' is a sign-in with a password and no second factor.
CREATE FUNCTION pg_temp.as_user(n text, addr text DEFAULT NULL, how text DEFAULT 'google') RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    (jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', false, 'email', n || '@example.test')
     || CASE WHEN how = 'password'
          THEN jsonb_build_object('amr', jsonb_build_array(jsonb_build_object('method', 'password', 'timestamp', 1)), 'aal', 'aal1')
          ELSE '{}'::jsonb END)::text, false);
  PERFORM set_config('request.headers', CASE WHEN addr IS NULL THEN '' ELSE jsonb_build_object('x-firm-address', addr)::text END, false);
  SET LOCAL ROLE authenticated;
END $$;

-- The same person's claims with the superuser's rights: what a trigger sees when a function writes on their behalf, without the function.
CREATE FUNCTION pg_temp.claims_of(n text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', false, 'email', n || '@example.test')::text, false);
  PERFORM set_config('request.headers', '', false);
END $$;

CREATE FUNCTION pg_temp.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', false);
  PERFORM set_config('request.headers', '', false);
  SET LOCAL ROLE service_role;
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

-- The SQLSTATE and message a statement raised, or 'ok' when it did not. Nothing is rolled back.
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

-- What the history holds of one record, read as the table's owner (the tests see every firm's rows), oldest first.
CREATE FUNCTION pg_temp.held(fid uuid, k text) RETURNS SETOF public.record_history LANGUAGE sql SECURITY DEFINER AS $$
  SELECT * FROM public.record_history WHERE firm_id = fid AND table_name = 'referral_partners' AND record_key = k ORDER BY at, id
$$;

-- The caller's reading of one record's history, as the function gives it: one text per entry, newest first.
CREATE FUNCTION pg_temp.read_as(fid uuid, k text, lim integer DEFAULT 50) RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(string_agg(concat_ws('|', h.kind, h.who, h.who_kind, COALESCE(h.field, '-'), COALESCE(h.from_value::text, '~'), COALESCE(h.to_value::text, '~')), E'\n' ORDER BY h.at DESC, h.entry_key DESC), '')
  FROM public.record_history_list(fid, 'referral_partners', k, lim) h
$$;


-- Saves a partner as the signed-in caller; the answer is the function's jsonb.
CREATE FUNCTION pg_temp.save(code text, nm text, kd text, fid uuid, ver integer) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.advisor_update_referral_partner(code, nm, kd, fid, ver)
$$;

-- The row as it stands, read as the table's owner (the tests see every firm's rows).
CREATE FUNCTION pg_temp.row_of(fid uuid, k text) RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$
  SELECT to_jsonb(r) - 'created_at' - 'updated_at' FROM public.referral_partners r WHERE r.firm_id = fid AND r.code = k
$$;
CREATE FUNCTION pg_temp.version_of(fid uuid, k text) RETURNS integer LANGUAGE sql SECURITY DEFINER AS $$
  SELECT version FROM public.referral_partners WHERE firm_id = fid AND code = k
$$;
CREATE FUNCTION pg_temp.history_count(fid uuid, k text) RETURNS bigint LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*) FROM public.record_history WHERE firm_id = fid AND table_name = 'referral_partners' AND record_key = k
$$;

-- Tables whose version trigger watches different fields from the history trigger's list (empty when none).
CREATE FUNCTION pg_temp.versions_that_disagree() RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(c.relname, ',' ORDER BY c.relname)
  FROM pg_trigger h
  JOIN pg_class c ON c.oid = h.tgrelid
  JOIN pg_trigger v ON v.tgrelid = h.tgrelid AND v.tgfoid = 'public.record_version_bump'::regproc AND NOT v.tgisinternal
  WHERE h.tgfoid = 'public.record_history_capture'::regproc AND NOT h.tgisinternal AND c.relnamespace = 'public'::regnamespace
    AND (string_to_array(rtrim(replace(encode(h.tgargs, 'escape'), '\000', ','), ','), ','))[3:]
        IS DISTINCT FROM string_to_array(rtrim(replace(encode(v.tgargs, 'escape'), '\000', ','), ','), ',')
$$;

-- ---------- 1. set up: two firms, two partners ----------
DO $$
DECLARE acme uuid; zenith uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Acme Brokers', 'acme-brokers', now()) RETURNING id INTO acme;
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Zenith Benefits', 'zenith-benefits', now()) RETURNING id INTO zenith;
  INSERT INTO fx VALUES ('acme', acme), ('zenith', zenith);
  PERFORM pg_temp.new_user('acme_owner'); PERFORM pg_temp.new_user('acme_agent'); PERFORM pg_temp.new_user('acme_removed');
  PERFORM pg_temp.new_user('acme_suspended'); PERFORM pg_temp.new_user('acme_admin_member');
  PERFORM pg_temp.new_user('zenith_owner'); PERFORM pg_temp.new_user('platform_admin'); PERFORM pg_temp.new_user('nobody');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES
    (acme, pg_temp.id('acme_owner'), 'owner'), (acme, pg_temp.id('acme_agent'), 'agent'),
    (acme, pg_temp.id('acme_suspended'), 'agent'), (acme, pg_temp.id('acme_admin_member'), 'agent'), (zenith, pg_temp.id('zenith_owner'), 'owner');
  INSERT INTO public.firm_memberships (firm_id, user_id, role, valid_from, valid_until)
  VALUES (acme, pg_temp.id('acme_removed'), 'agent', now() - interval '3 days', now() - interval '1 day');
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('platform_admin'), 'admin'), (pg_temp.id('acme_admin_member'), 'admin'),
    (pg_temp.id('acme_agent'), 'advisor');
END $$;

-- ---------- 2. a new record starts at 1; a table that already has rows starts them at 1 ----------
-- Break caught: a record is born at 0 or at a value the caller chose; giving a table a version leaves its existing rows without one (or at 0);
-- the trigger lets an insert name its own version.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); zenith uuid := pg_temp.id('zenith'); added public.referral_partners;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  added := public.advisor_add_referral_partner('acme-cfo', 'Acme CFO', 'accounting', acme);
  PERFORM pg_temp.is(added.version, 1, 'a partner is born at version 1 and the add says so');
  RESET ROLE;
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  PERFORM public.advisor_add_referral_partner('zen-partner', 'Zenith Secret Partner', 'law_firm', zenith);
  RESET ROLE;
  INSERT INTO public.referral_partners (firm_id, code, name, kind, version) VALUES (acme, 'inserted-with-version', 'Inserted', 'event', 7);
  PERFORM pg_temp.is(pg_temp.version_of(acme, 'inserted-with-version'), 1, 'an insert that names a version of its own is given 1');
  -- A table that already holds rows: attaching gives it the column, every row at 1.
  CREATE TABLE public.version_probe (firm_id uuid NOT NULL, code text NOT NULL, a text, b text, stamp timestamptz DEFAULT now(), PRIMARY KEY (firm_id, code));
  INSERT INTO public.version_probe (firm_id, code, a) VALUES (acme, 'old-1', 'x'), (acme, 'old-2', 'y');
  PERFORM public.record_track('public.version_probe', 'referral_partners', ARRAY['code'], ARRAY['a', 'b']);
  PERFORM pg_temp.is((SELECT string_agg(version::text, ',' ORDER BY code) FROM public.version_probe), '1,1', 'rows that were there before start at version 1');
  UPDATE public.version_probe SET a = 'x2' WHERE code = 'old-1';
  PERFORM pg_temp.is((SELECT version FROM public.version_probe WHERE code = 'old-1'), 2, 'and a real change raises one of them');
  UPDATE public.version_probe SET stamp = now() + interval '1 day' WHERE code = 'old-1';
  PERFORM pg_temp.is((SELECT version FROM public.version_probe WHERE code = 'old-1'), 2, 'a change to a field that is not listed (a stamp) raises nothing');
  DROP TABLE public.version_probe;
  RAISE NOTICE 'record_version: start passed';
END $$;

-- ---------- 3. a save from the current version succeeds and returns the next ----------
-- Break caught: the save does not raise the version, raises it by more than one, or returns the old one; the save answers with a row instead
-- of an answer that says whether it was a conflict; the history does not say which version a change produced.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  r := pg_temp.save('acme-cfo', 'Acme Finance', 'law_firm', acme, 1);
  RESET ROLE;
  PERFORM pg_temp.is((r ->> 'conflict')::boolean, false, 'a save from the current version is not a conflict');
  PERFORM pg_temp.is((r -> 'record' ->> 'version')::integer, 2, 'it answers with the next version');
  PERFORM pg_temp.is(r -> 'record' ->> 'name', 'Acme Finance', 'and the saved partner');
  PERFORM pg_temp.is(pg_temp.version_of(acme, 'acme-cfo'), 2, 'the row is at version 2');
  PERFORM pg_temp.is((SELECT string_agg(coalesce(field, '-') || '@' || version, ',' ORDER BY id) FROM public.record_history WHERE firm_id = acme AND record_key = 'acme-cfo'),
    '-@1,name@2,kind@2', 'the history says which version each entry produced: the creation 1, both fields of the save 2');
  RAISE NOTICE 'record_version: save passed';
END $$;

-- ---------- 4. a save from a stale version changes nothing and says what is there now ----------
-- Break caught: a stale save overwrites; it changes the version or the history anyway; its answer leaves out the current values, a changed field
-- or who and when; it lists a field nobody changed; it names a person by id.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); r jsonb; before_row jsonb; before_hist bigint; txt text;
BEGIN
  -- Two people loaded version 2. The agent saves a new name first (-> 3).
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  r := pg_temp.save('acme-cfo', 'Acme Finance Group', 'law_firm', acme, 2);
  PERFORM pg_temp.is((r -> 'record' ->> 'version')::integer, 3, 'the first of two saves from version 2 wins');
  RESET ROLE;
  before_row := pg_temp.row_of(acme, 'acme-cfo'); before_hist := pg_temp.history_count(acme, 'acme-cfo');
  -- The owner, still on version 2, changes the kind.
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  r := pg_temp.save('acme-cfo', 'Acme Finance', 'event', acme, 2);
  RESET ROLE;
  PERFORM pg_temp.is((r ->> 'conflict')::boolean, true, 'the second is a conflict');
  PERFORM pg_temp.is(pg_temp.row_of(acme, 'acme-cfo'), before_row, 'it changed nothing in the row (not the values, not the version, not who saved)');
  PERFORM pg_temp.is(pg_temp.history_count(acme, 'acme-cfo'), before_hist, 'and nothing in the history');
  PERFORM pg_temp.is((r ->> 'currentVersion')::integer, 3, 'the answer carries the current version');
  PERFORM pg_temp.is(r -> 'current', '{"name": "Acme Finance Group", "kind": "law_firm"}'::jsonb, 'and the current values of the editable fields');
  PERFORM pg_temp.is(jsonb_array_length(r -> 'changed'), 1, 'one field differs from what the owner started from: the name (the kind did not change)');
  PERFORM pg_temp.is(r -> 'changed' -> 0 ->> 'field', 'name', 'it names the field');
  PERFORM pg_temp.is(r -> 'changed' -> 0 -> 'value', '"Acme Finance Group"'::jsonb, 'its current value');
  PERFORM pg_temp.is(r -> 'changed' -> 0 ->> 'who', 'acme_agent@example.test', 'who changed it last: a member, by email');
  PERFORM pg_temp.is((r -> 'changed' -> 0 ->> 'at')::timestamptz > now() - interval '1 minute', true, 'and when');
  PERFORM pg_temp.is(r -> 'changed' -> 0 ->> 'at', (SELECT to_jsonb(h.at) #>> '{}' FROM public.record_history h WHERE h.firm_id = acme AND h.record_key = 'acme-cfo' AND h.field = 'name' AND h.version = 3), 'the time is the history''s own');
  -- Nobody's id appears anywhere in the answer.
  txt := r::text;
  PERFORM pg_temp.is((SELECT count(*) FROM fx WHERE position(id::text IN txt) > 0), 0::bigint, 'no id of any person or firm is in the answer');
  RAISE NOTICE 'record_version: conflict passed';
END $$;

-- ---------- 5. who: a member's email, "Nevermore" for staff, the same naming as the history ----------
-- Break caught: the conflict names staff by email or id (D-33); a member who also holds a platform role is hidden; the service role is shown as
-- a person; the conflict names people by a second rule that disagrees with the history's.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); r jsonb; v integer; hist text;
BEGIN
  v := pg_temp.version_of(acme, 'acme-cfo');
  -- A platform admin who is no member changes the kind (what a trigger sees when Nevermore changes a record; staff cannot save through the partner functions).
  PERFORM pg_temp.claims_of('platform_admin');
  UPDATE public.referral_partners SET kind = 'other' WHERE firm_id = acme AND code = 'acme-cfo';
  PERFORM pg_temp.is(pg_temp.version_of(acme, 'acme-cfo'), v + 1, 'staff''s change raises the version too');
  -- The service role changes the name.
  PERFORM pg_temp.as_service(); RESET ROLE;
  UPDATE public.referral_partners SET name = 'Acme (service)' WHERE firm_id = acme AND code = 'acme-cfo';
  -- An admin who is a member acts as a member.
  PERFORM pg_temp.as_user('acme_admin_member', 'acme-brokers');
  PERFORM pg_temp.save('acme-cfo', 'Acme (member admin)', 'other', acme, v + 2);
  RESET ROLE;
  -- A stale save from v: every field now differs; each is named by its last changer.
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  r := pg_temp.save('acme-cfo', 'Mine', 'event', acme, v);
  RESET ROLE;
  PERFORM pg_temp.is((r ->> 'conflict')::boolean, true, 'stale again');
  PERFORM pg_temp.is((SELECT x ->> 'who' FROM jsonb_array_elements(r -> 'changed') x WHERE x ->> 'field' = 'name'), 'acme_admin_member@example.test', 'a member who holds a platform role is shown as themselves');
  PERFORM pg_temp.is((SELECT x ->> 'who' FROM jsonb_array_elements(r -> 'changed') x WHERE x ->> 'field' = 'kind'), 'Nevermore', 'staff is shown as Nevermore');
  PERFORM pg_temp.is(position('platform_admin' IN r::text), 0, 'with no id and no email of the staff member anywhere');
  -- From the version before the service change: the service role is "System".
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  r := pg_temp.save('acme-cfo', 'Mine', 'event', acme, v + 1);
  RESET ROLE;
  PERFORM pg_temp.is((SELECT x ->> 'who' FROM jsonb_array_elements(r -> 'changed') x WHERE x ->> 'field' = 'name'), 'acme_admin_member@example.test', 'last changer wins when several changed one field');
  -- The history's own reading names them the same way.
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  hist := pg_temp.read_as(acme, 'acme-cfo');
  RESET ROLE;
  PERFORM pg_temp.is(position('changed|Nevermore|nevermore|kind' IN hist) > 0 AND position('changed|System|system|name' IN hist) > 0, true, 'the history says Nevermore and System in the same words');
  RAISE NOTICE 'record_version: who passed';
END $$;

-- ---------- 6. a field changed and changed back is not a difference ----------
-- Break caught: the conflict lists every field anyone touched since the version, even one that is back to what the person saw.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); r jsonb; v integer; k text;
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  v := pg_temp.version_of(acme, 'acme-cfo');
  SELECT p ->> 'kind' INTO k FROM (SELECT pg_temp.row_of(acme, 'acme-cfo') p) x;
  PERFORM pg_temp.save('acme-cfo', 'Acme (member admin)', 'accounting', acme, v);
  PERFORM pg_temp.save('acme-cfo', 'Acme (member admin)', k, acme, v + 1);
  r := pg_temp.save('acme-cfo', 'Mine', 'event', acme, v);
  RESET ROLE;
  PERFORM pg_temp.is((r ->> 'conflict')::boolean, true, 'two saves since: still a conflict');
  PERFORM pg_temp.is(jsonb_array_length(r -> 'changed'), 0, 'but the kind went to accounting and back, so no field differs from what the person saw');
  PERFORM pg_temp.is(r -> 'current' ->> 'kind', k, 'and the current values are given');
  RAISE NOTICE 'record_version: changed back passed';
END $$;

-- ---------- 7. a save that changes nothing does not raise the version ----------
-- Break caught: the version rises on every UPDATE, so saving the form twice without changing it fails the second time for no reason.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); r jsonb; v integer; nm text; kd text; h bigint;
BEGIN
  v := pg_temp.version_of(acme, 'acme-cfo');
  SELECT name, kind INTO nm, kd FROM public.referral_partners WHERE firm_id = acme AND code = 'acme-cfo';
  h := pg_temp.history_count(acme, 'acme-cfo');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  r := pg_temp.save('acme-cfo', nm, kd, acme, v);
  PERFORM pg_temp.is((r ->> 'conflict')::boolean, false, 'saving the same values is not a conflict');
  PERFORM pg_temp.is((r -> 'record' ->> 'version')::integer, v, 'and the version stays');
  r := pg_temp.save('acme-cfo', nm, kd, acme, v);
  PERFORM pg_temp.is((r ->> 'conflict')::boolean, false, 'so saving them again from the same version still works');
  r := pg_temp.save('acme-cfo', nm || ' II', kd, acme, v);
  PERFORM pg_temp.is((r -> 'record' ->> 'version')::integer, v + 1, 'and a real change after them works from that version');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.history_count(acme, 'acme-cfo'), h + 1, 'the history recorded the one real change once');
  -- Direct statements as the owner: only the stamps change.
  UPDATE public.referral_partners SET updated_at = now(), updated_by_email = 'x@example.test' WHERE firm_id = acme AND code = 'acme-cfo';
  PERFORM pg_temp.is(pg_temp.version_of(acme, 'acme-cfo'), v + 1, 'changing only the stamps raises nothing');
  RAISE NOTICE 'record_version: no change passed';
END $$;

-- ---------- 8. nobody sets the version ----------
-- Break caught: a statement that writes `version` changes it (to lower it so a stale save passes, or raise it so another is refused).
DO $$
DECLARE acme uuid := pg_temp.id('acme'); v integer := pg_temp.version_of(pg_temp.id('acme'), 'acme-cfo');
BEGIN
  UPDATE public.referral_partners SET version = 1 WHERE firm_id = acme AND code = 'acme-cfo';
  PERFORM pg_temp.is(pg_temp.version_of(acme, 'acme-cfo'), v, 'writing the version alone is ignored (even by the table''s owner)');
  UPDATE public.referral_partners SET version = 1, name = 'Direct rename' WHERE firm_id = acme AND code = 'acme-cfo';
  PERFORM pg_temp.is(pg_temp.version_of(acme, 'acme-cfo'), v + 1, 'writing it with a real change still raises it by one, whatever was written');
  UPDATE public.referral_partners SET version = 500, name = 'Direct rename 2' WHERE firm_id = acme AND code = 'acme-cfo';
  PERFORM pg_temp.is(pg_temp.version_of(acme, 'acme-cfo'), v + 2, 'also when higher');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.attempt($q$UPDATE public.referral_partners SET version = 1$q$), '42501', 'and the people of the product can''t write the table directly (only through the function)');
  RESET ROLE;
  RAISE NOTICE 'record_version: not settable passed';
END $$;

-- ---------- 9. a save with no version is refused ----------
-- Break caught: a save that names no version overwrites silently (the old way), or is treated as "from the current one".
DO $$
DECLARE acme uuid := pg_temp.id('acme'); before_row jsonb := pg_temp.row_of(pg_temp.id('acme'), 'acme-cfo'); before_hist bigint := pg_temp.history_count(pg_temp.id('acme'), 'acme-cfo');
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.advisor_update_referral_partner('acme-cfo', 'No version', 'other', %L)$q$, acme)), '22023', 'the old four-argument call (no version) is refused');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.advisor_update_referral_partner('acme-cfo', 'No version', 'other', %L, NULL)$q$, acme)), '22023', 'so is an explicit null');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.advisor_update_referral_partner('acme-cfo', 'No version', 'other', %L, 0)$q$, acme)), '22023', 'and a version that can''t exist');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.advisor_update_referral_partner('acme-cfo', 'No version', 'other', %L)$q$, acme)),
    '22023: This save did not say which version of the partner it started from, so it was refused. Reload the page and try again.', 'with words a person can follow');
  -- A version the partner has never had is no conflict (nobody changed anything): it is refused like a missing one.
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.advisor_update_referral_partner('acme-cfo', 'Ahead', 'other', %L, %s)$q$, acme, pg_temp.version_of(acme, 'acme-cfo') + 1)),
    '22023: This save names a version of the partner that does not exist, so it was refused. Reload the page and try again.', 'a version above the current one is refused, not answered with an empty conflict');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.advisor_update_referral_partner('acme-cfo', 'Ahead', 'other', %L, 100000)$q$, acme)), '22023', 'however far ahead');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.advisor_update_referral_partner('no-such-code', 'Ahead', 'other', %L, 100000)$q$, acme)), 'PT404', 'and a code no partner has is still not found first');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.row_of(acme, 'acme-cfo'), before_row, 'none of them changed the row');
  PERFORM pg_temp.is(pg_temp.history_count(acme, 'acme-cfo'), before_hist, 'or the history');
  -- The input check still comes first (a bad name is told so).
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.advisor_update_referral_partner('acme-cfo', '', 'other', %L, 1)$q$, acme)), '22023', 'a blank name is refused as before');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.advisor_update_referral_partner('no-such-code', 'X', 'other', %L, 1)$q$, acme)), 'PT404', 'a code no partner has is refused as before, whatever version is sent');
  RESET ROLE;
  RAISE NOTICE 'record_version: no version passed';
END $$;

-- ---------- 10. who may learn what: refusals come first and are the same, whatever version is sent ----------
-- Break caught: a stale version sent to another firm's partner is answered with a conflict (its current values, who changed it); a removed or
-- suspended member, a non-member or a person at the wrong address gets a different refusal for a stale version than for a current one.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); zenith uuid := pg_temp.id('zenith'); zv integer := pg_temp.version_of(pg_temp.id('zenith'), 'zen-partner');
  who text; stmt_stale text; stmt_ok text; a text; b text; before_row jsonb := pg_temp.row_of(pg_temp.id('zenith'), 'zen-partner');
BEGIN
  -- Give the other firm's partner a history so a leak would have something to show.
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  PERFORM pg_temp.save('zen-partner', 'Zenith Secret Partner Two', 'law_firm', zenith, zv);
  RESET ROLE;
  zv := zv + 1;
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM public.suspend_member(acme, pg_temp.id('acme_suspended'));
  RESET ROLE;
  FOREACH who IN ARRAY ARRAY['nobody', 'acme_removed', 'acme_agent', 'platform_admin'] LOOP
    PERFORM pg_temp.as_user(who, 'acme-brokers');
    stmt_stale := format($q$SELECT public.advisor_update_referral_partner('zen-partner', 'Leak', 'other', %L, 1)$q$, zenith);
    stmt_ok := format($q$SELECT public.advisor_update_referral_partner('zen-partner', 'Leak', 'other', %L, %s)$q$, zenith, zv);
    a := pg_temp.refusal(stmt_stale); b := pg_temp.refusal(stmt_ok);
    PERFORM pg_temp.is(a, b, who || ' gets the same refusal for a stale version as for the current one');
    PERFORM pg_temp.is(a <> 'ok', true, who || ' is refused');
    PERFORM pg_temp.is(position('Zenith' IN a), 0, 'and the refusal holds nothing of the other firm');
    RESET ROLE;
  END LOOP;
  -- By code alone, from inside one's own firm: another firm's partner is "no partner has that code", stale or not.
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  a := pg_temp.refusal($q$SELECT public.advisor_update_referral_partner('zen-partner', 'Leak', 'other', NULL, 1)$q$);
  b := pg_temp.refusal($q$SELECT public.advisor_update_referral_partner('made-up-code', 'Leak', 'other', NULL, 1)$q$);
  PERFORM pg_temp.is(a, b, 'another firm''s partner reads exactly like one that was never made');
  PERFORM pg_temp.is(split_part(a, ':', 1), 'PT404', 'refused as not found');
  RESET ROLE;
  -- A suspended member (and a removed one) at their own firm's address: refused the same for a stale and a current version.
  PERFORM pg_temp.as_user('acme_suspended', 'acme-brokers');
  a := pg_temp.refusal(format($q$SELECT public.advisor_update_referral_partner('acme-cfo', 'Leak', 'other', %L, 1)$q$, acme));
  b := pg_temp.refusal(format($q$SELECT public.advisor_update_referral_partner('acme-cfo', 'Leak', 'other', %L, %s)$q$, acme, pg_temp.version_of(acme, 'acme-cfo')));
  PERFORM pg_temp.is(a, b, 'a suspended member gets the same refusal for either');
  PERFORM pg_temp.is(split_part(a, ':', 1), '42501', 'and it is a refusal');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.row_of(zenith, 'zen-partner') - 'version' - 'updated_by_email', before_row - 'version' - 'updated_by_email' || '{"name": "Zenith Secret Partner Two"}'::jsonb, 'and the other firm''s partner is as its own owner left it');
  RAISE NOTICE 'record_version: refusals passed';
END $$;

-- ---------- 11. a support session and a closing firm are refused before any conflict ----------
-- Break caught: the version check runs before the write guard, so a support session or a member of a closing firm is told "someone else changed
-- it" (a conflict with values in it) instead of the refusal.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); zenith uuid := pg_temp.id('zenith'); gamma uuid; before_row jsonb; r text;
BEGIN
  -- Support.
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.start_support_session(acme, 'Looking at a partner for the owner');
  PERFORM pg_temp.as_user('platform_admin', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.advisor_update_referral_partner('acme-cfo', 'By support', 'other', %L, 1)$q$, acme)), 'PT423: Nevermore support can look, not change', 'a support session with a stale version is refused (PT423), not given a conflict');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.advisor_update_referral_partner('acme-cfo', 'By support', 'other', %L, %s)$q$, acme, pg_temp.version_of(acme, 'acme-cfo'))), 'PT423', 'and with the current one');
  RESET ROLE;
  -- A closing firm: owner and member alike get the read-only message.
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Gamma Closing', 'gamma-closing', now()) RETURNING id INTO gamma;
  INSERT INTO fx VALUES ('gamma', gamma);
  PERFORM pg_temp.new_user('gamma_owner');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (gamma, pg_temp.id('gamma_owner'), 'owner');
  PERFORM pg_temp.as_user('gamma_owner', 'gamma-closing');
  PERFORM public.advisor_add_referral_partner('gamma-p', 'Gamma P', 'event', gamma);
  RESET ROLE;
  INSERT INTO public.firm_closures (firm_id, asked_at, closes_at) VALUES (gamma, now(), now() + interval '30 days');
  before_row := pg_temp.row_of(gamma, 'gamma-p');
  PERFORM pg_temp.as_user('gamma_owner', 'gamma-closing');
  r := pg_temp.refusal(format($q$SELECT public.advisor_update_referral_partner('gamma-p', 'Late', 'other', %L, 1)$q$, gamma));
  RESET ROLE;
  PERFORM pg_temp.is(r, 'PT423: This firm is closing and can''t be changed', 'a closing firm''s member with a stale version gets the read-only message');
  PERFORM pg_temp.is(pg_temp.row_of(gamma, 'gamma-p'), before_row, 'and nothing changed');
  RAISE NOTICE 'record_version: support and closing passed';
END $$;

-- ---------- 12. history and the closing keep working ----------
-- Break caught: the version trigger breaks the history (an entry per version bump, or a lost entry); closing a firm no longer deletes a
-- partner (the version trigger refuses its delete) or its history.
DO $$
DECLARE zenith uuid := pg_temp.id('zenith'); counts jsonb;
BEGIN
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE firm_id = zenith AND record_key = 'zen-partner' AND kind = 'changed'), 1::bigint, 'one real change, one history entry, with a version of its own');
  PERFORM pg_temp.is((SELECT version FROM public.record_history WHERE firm_id = zenith AND record_key = 'zen-partner' AND kind = 'changed'), 2, 'the version it produced');
  INSERT INTO public.firm_closures (firm_id, asked_at, closes_at) VALUES (zenith, now() - interval '31 days', now() - interval '1 day');
  counts := public.close_firm_now(zenith);
  PERFORM pg_temp.is((SELECT count(*) FROM public.referral_partners WHERE firm_id = zenith), 0::bigint, 'closing a firm still deletes its partners');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE firm_id = zenith), 0::bigint, 'and their history');
  RAISE NOTICE 'record_version: history and closing passed';
END $$;

-- ---------- 13. a later table adds it in one line, and cannot half-add it ----------
-- Break caught: the helper accepts a table without the fields it was told to watch, or the version itself as a watched field; a table with a
-- history but no version slips in unnoticed.
DO $$
BEGIN
  CREATE TABLE public.version_probe2 (firm_id uuid NOT NULL, code text NOT NULL, a text, PRIMARY KEY (firm_id, code));
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.record_version_track('public.version_probe2', ARRAY['no_such_column'])$q$), '42703', 'a field that is not a column is refused when it is attached');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.record_version_track('public.version_probe2', ARRAY['version'])$q$), '22023', 'the version can''t be one of the fields it watches');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.record_version_track('public.version_probe2', ARRAY[]::text[])$q$), '22023', 'and at least one field is needed');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.record_version_track('information_schema.tables', ARRAY['table_name'])$q$), '42809', 'only an ordinary table of the public schema can be given a version');
  PERFORM public.record_track('public.version_probe2', 'referral_partners', ARRAY['code'], ARRAY['a']);
  PERFORM pg_temp.is((SELECT count(*) FROM pg_trigger t WHERE t.tgrelid = 'public.version_probe2'::regclass AND NOT t.tgisinternal), 3::bigint, 'one call gives the history trigger, the truncate guard and the version trigger');
  DROP TABLE public.version_probe2;
  -- The standing check: every table that keeps a history also keeps a version, unless it is listed here as meaning not to (none).
  PERFORM pg_temp.is((SELECT string_agg(c.relname, ',') FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relnamespace = 'public'::regnamespace AND t.tgfoid = 'public.record_history_capture'::regproc AND NOT t.tgisinternal
        AND NOT EXISTS (SELECT 1 FROM pg_trigger v WHERE v.tgrelid = t.tgrelid AND v.tgfoid = 'public.record_version_bump'::regproc)), NULL::text,
    'every table with a history has a version trigger (use record_track)');
  PERFORM pg_temp.is((SELECT string_agg(c.relname, ',') FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relnamespace = 'public'::regnamespace AND t.tgfoid = 'public.record_version_bump'::regproc AND NOT t.tgisinternal
        AND NOT EXISTS (SELECT 1 FROM pg_trigger v WHERE v.tgrelid = t.tgrelid AND v.tgfoid = 'public.record_history_capture'::regproc)), NULL::text,
    'and every table with a version trigger has a history');
  PERFORM pg_temp.is((SELECT replace(encode(t.tgargs, 'escape'), '\000', ',') FROM pg_trigger t WHERE t.tgrelid = 'public.referral_partners'::regclass AND t.tgname = 'referral_partners_version'),
    'name,kind,', 'referral partners: the fields that raise the version are name and kind');
  -- The standing check: on EVERY table that carries both triggers, the version watches exactly the fields the history tracks.
  PERFORM pg_temp.is(pg_temp.versions_that_disagree(), NULL::text, 'on every table the version watches the very fields the history tracks');
  CREATE TABLE public.version_probe3 (firm_id uuid NOT NULL, code text NOT NULL, a text, b text, PRIMARY KEY (firm_id, code));
  PERFORM public.record_history_track('public.version_probe3', 'referral_partners', ARRAY['code'], ARRAY['a', 'b']);
  PERFORM public.record_version_track('public.version_probe3', ARRAY['a']);
  PERFORM pg_temp.is(pg_temp.versions_that_disagree(), 'version_probe3', 'a table that attaches the two separately with different lists is named (the check goes red)');
  PERFORM public.record_version_track('public.version_probe3', ARRAY['a', 'b']);
  PERFORM pg_temp.is(pg_temp.versions_that_disagree(), NULL::text, 'and is not once the lists agree');
  DROP TABLE public.version_probe3;
  PERFORM pg_temp.is((SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'advisor_update_referral_partner'), 1::bigint, 'and there is one way to save a partner');
  RAISE NOTICE 'record_version: attaching passed';
END $$;

-- ---------- 14. two saves from the same version: exactly one wins (two real sessions) ----------
-- Break caught: the version check is a read and then a write (or is missing), so two saves from the same version both succeed and the second
-- silently overwrites the first. The second session is seen WAITING on the first's row, and after it commits is answered with the conflict.
CREATE SCHEMA race;
CREATE EXTENSION dblink SCHEMA race;

-- Two sessions save the same partner from the same version. The first leaves its transaction open after its save; the second starts and must be
-- seen waiting; the first commits; the second's answer is then read. Returns both answers and whether the second waited.
CREATE FUNCTION pg_temp.race_saves(a_who text, a_stmt text, b_who text, b_stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  dsn text := format('dbname=%s user=%s port=%s host=%s', current_database(), session_user, current_setting('port'),
    split_part(current_setting('unix_socket_directories'), ',', 1));
  b_pid integer; tries integer := 0; waited boolean := false; ra text; rb text;
BEGIN
  PERFORM race.dblink_connect('ra', dsn);
  PERFORM race.dblink_connect('rb', dsn);
  PERFORM race.dblink_exec('ra', 'SET lock_timeout = ''20s''');
  PERFORM race.dblink_exec('rb', 'SET lock_timeout = ''20s''');
  SELECT pid INTO b_pid FROM race.dblink('rb', 'SELECT pg_backend_pid()') AS t(pid integer);
  PERFORM race.dblink_exec('ra', 'BEGIN');
  PERFORM race.dblink_exec('ra', 'SET LOCAL ROLE authenticated');
  PERFORM race.dblink_exec('ra', format('SET LOCAL request.jwt.claims = %L',
    jsonb_build_object('sub', pg_temp.id(a_who), 'role', 'authenticated', 'is_anonymous', false, 'email', a_who || '@example.test')::text));
  SELECT r INTO ra FROM race.dblink('ra', a_stmt) AS t(r text);
  PERFORM race.dblink_exec('rb', 'BEGIN');
  PERFORM race.dblink_exec('rb', 'SET LOCAL ROLE authenticated');
  PERFORM race.dblink_exec('rb', format('SET LOCAL request.jwt.claims = %L',
    jsonb_build_object('sub', pg_temp.id(b_who), 'role', 'authenticated', 'is_anonymous', false, 'email', b_who || '@example.test')::text));
  PERFORM race.dblink_send_query('rb', b_stmt);
  WHILE tries < 80 LOOP
    IF cardinality(pg_blocking_pids(b_pid)) > 0 THEN waited := true; EXIT; END IF;
    IF race.dblink_is_busy('rb') = 0 THEN EXIT; END IF;
    tries := tries + 1;
    PERFORM pg_sleep(0.05);
  END LOOP;
  PERFORM race.dblink_exec('ra', 'COMMIT');
  SELECT r INTO rb FROM race.dblink_get_result('rb') AS t(r text);
  BEGIN PERFORM * FROM race.dblink_get_result('rb') AS t(r text); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM race.dblink_exec('rb', 'COMMIT');
  PERFORM race.dblink_disconnect('ra');
  PERFORM race.dblink_disconnect('rb');
  RETURN CASE WHEN waited THEN 'waited' ELSE 'did not wait' END || '|' || ra || '|' || rb;
END $$;

-- The partner is committed first: the two sessions must see it.
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM public.advisor_add_referral_partner('race-partner', 'Race Partner', 'event', pg_temp.id('acme'));
  RESET ROLE;
END $$;

DO $$
DECLARE acme uuid := pg_temp.id('acme'); v integer; r text; a jsonb; b jsonb; h bigint;
BEGIN
  v := pg_temp.version_of(acme, 'race-partner');
  h := pg_temp.history_count(acme, 'race-partner');
  r := pg_temp.race_saves('acme_owner', format($q$SELECT public.advisor_update_referral_partner('race-partner', 'From owner', 'event', %L, %s)::text$q$, acme, v),
                          'acme_agent', format($q$SELECT public.advisor_update_referral_partner('race-partner', 'From agent', 'law_firm', %L, %s)::text$q$, acme, v));
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'the second save from the same version is seen waiting for the first');
  a := split_part(r, '|', 2)::jsonb; b := split_part(r, '|', 3)::jsonb;
  PERFORM pg_temp.is((a ->> 'conflict')::boolean, false, 'the first wins');
  PERFORM pg_temp.is((b ->> 'conflict')::boolean, true, 'the second is answered with the conflict, not an overwrite');
  PERFORM pg_temp.is((b ->> 'currentVersion')::integer, v + 1, 'which carries the first''s version');
  PERFORM pg_temp.is(b -> 'current' ->> 'name', 'From owner', 'and the first''s values');
  PERFORM pg_temp.is(b -> 'changed' -> 0 ->> 'who', 'acme_owner@example.test', 'and who made them');
  PERFORM pg_temp.is(pg_temp.version_of(acme, 'race-partner'), v + 1, 'exactly one save raised the version');
  PERFORM pg_temp.is((SELECT name || '/' || kind FROM public.referral_partners WHERE firm_id = acme AND code = 'race-partner'), 'From owner/event', 'the row holds the first save only: the second changed nothing, not even its kind');
  PERFORM pg_temp.is(pg_temp.history_count(acme, 'race-partner'), h + 1, 'and the history holds one change');
  RAISE NOTICE 'record_version: race passed';
END $$;
