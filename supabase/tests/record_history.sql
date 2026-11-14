-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh leave_a_firm
-- The history of a record (story CRM-S5.2; docs/BROKER_CRM_BUILD.md D-24, D-28, D-33, D-45, D-105, D-115, D-117;
-- 20261118130000_record_history.sql). Every record keeps who created it and when, and every change to its own fields: who, when, the
-- field, from and to. Nobody can edit that, and nothing but a field named in the migration that attaches the trigger can enter it.
-- Applied to referral partners. Two firms are used throughout. Every migration is loaded, in filename order (D-105), this story's last.
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

-- ---------- set up: two firms; each has an owner and an agent; a platform admin; an admin who is also a member; people with no firm ----------
DO $$
DECLARE acme uuid; zenith uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Acme Brokers', 'acme-brokers', now()) RETURNING id INTO acme;
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Zenith Benefits', 'zenith-benefits', now()) RETURNING id INTO zenith;
  INSERT INTO fx VALUES ('acme', acme), ('zenith', zenith);
  PERFORM pg_temp.new_user('acme_owner'); PERFORM pg_temp.new_user('acme_agent'); PERFORM pg_temp.new_user('acme_lead');
  PERFORM pg_temp.new_user('acme_removed'); PERFORM pg_temp.new_user('acme_suspended'); PERFORM pg_temp.new_user('acme_admin_member');
  PERFORM pg_temp.new_user('zenith_owner'); PERFORM pg_temp.new_user('platform_admin'); PERFORM pg_temp.new_user('nobody');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES
    (acme, pg_temp.id('acme_owner'), 'owner'), (acme, pg_temp.id('acme_agent'), 'agent'), (acme, pg_temp.id('acme_lead'), 'lead'),
    (acme, pg_temp.id('acme_suspended'), 'agent'), (acme, pg_temp.id('acme_admin_member'), 'agent'), (zenith, pg_temp.id('zenith_owner'), 'owner');
  INSERT INTO public.firm_memberships (firm_id, user_id, role, valid_from, valid_until)
  VALUES (acme, pg_temp.id('acme_removed'), 'agent', now() - interval '3 days', now() - interval '1 day');
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('platform_admin'), 'admin'), (pg_temp.id('acme_admin_member'), 'admin'),
    (pg_temp.id('acme_agent'), 'advisor');
END $$;

-- ---------- creation: one entry, who and when ----------
-- Break caught: a creation is not recorded; it is recorded once per field instead of once; it names no one or the wrong person; it
-- carries values that are not there; it is dated wrongly.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); n bigint; h public.record_history;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.advisor_add_referral_partner('acme-cfo', 'Acme CFO', 'accounting', acme);
  RESET ROLE;
  SELECT count(*) INTO n FROM pg_temp.held(acme, 'acme-cfo');
  PERFORM pg_temp.is(n, 1::bigint, 'adding a partner writes one entry, not one per field');
  SELECT * INTO h FROM pg_temp.held(acme, 'acme-cfo');
  PERFORM pg_temp.is(h.kind, 'created', 'it is a creation');
  PERFORM pg_temp.is(h.field IS NULL AND h.old_value IS NULL AND h.new_value IS NULL, true, 'with no field and no values');
  PERFORM pg_temp.is(h.actor_id, pg_temp.id('acme_agent'), 'by the person who added it');
  PERFORM pg_temp.is(h.actor_is_staff, false, 'not as Nevermore');
  PERFORM pg_temp.is(h.at <= clock_timestamp() AND h.at > clock_timestamp() - interval '1 minute', true, 'and it is dated now');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.read_as(acme, 'acme-cfo'), 'created|acme_agent@example.test|member|-|~|~', 'the member reads who created it');
  RESET ROLE;
  RAISE NOTICE 'record_history: creation passed';
END $$;

-- ---------- a change: one row per changed field, from and to ----------
-- Break caught: a change writes nothing, or one row for the record, or a row for a field that did not change; from and to are swapped or
-- lost; the fields of one save are not told apart from another save; newest is not first.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); r text; n bigint;
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM public.advisor_update_referral_partner('acme-cfo', 'Acme Finance', 'law_firm', acme, 1);
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.held(acme, 'acme-cfo')), 3::bigint, 'two fields changed: two new rows beside the creation');
  PERFORM pg_temp.is((SELECT count(DISTINCT change_id) FROM pg_temp.held(acme, 'acme-cfo') WHERE kind = 'changed'), 1::bigint, 'the two belong to one save');
  PERFORM pg_temp.is((SELECT count(DISTINCT change_id) FROM pg_temp.held(acme, 'acme-cfo')), 2::bigint, 'and the creation to another');
  PERFORM pg_temp.is((SELECT old_value::text || '>' || new_value::text FROM pg_temp.held(acme, 'acme-cfo') WHERE field = 'name'), '"Acme CFO">"Acme Finance"', 'the name, from and to');
  PERFORM pg_temp.is((SELECT old_value::text || '>' || new_value::text FROM pg_temp.held(acme, 'acme-cfo') WHERE field = 'kind'), '"accounting">"law_firm"', 'the kind, from and to');
  -- Only one field changes: one row.
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM public.advisor_update_referral_partner('acme-cfo', 'Acme Finance Group', 'law_firm', acme, 2);
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.held(acme, 'acme-cfo')), 4::bigint, 'one field changed: one new row');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  r := pg_temp.read_as(acme, 'acme-cfo');
  PERFORM pg_temp.is(split_part(r, E'\n', 1), 'changed|acme_owner@example.test|member|name|"Acme Finance"|"Acme Finance Group"', 'newest first, with who');
  PERFORM pg_temp.is(split_part(r, E'\n', 4), 'created|acme_agent@example.test|member|-|~|~', 'and the creation last');
  RESET ROLE;
  RAISE NOTICE 'record_history: changes passed';
END $$;

-- ---------- nothing tracked changed: nothing written ----------
-- Break caught: a save that changes nothing, or only the created or updated stamps, adds noise to the history.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); before_rows bigint;
BEGIN
  SELECT count(*) INTO before_rows FROM pg_temp.held(acme, 'acme-cfo');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM public.advisor_update_referral_partner('acme-cfo', 'Acme Finance Group', 'law_firm', acme, 3);
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.held(acme, 'acme-cfo')), before_rows, 'saving the same values writes nothing (although the updated stamp moved)');
  UPDATE public.referral_partners SET created_by_email = 'someone@example.test', updated_at = now(), updated_by_email = 'x@example.test' WHERE firm_id = acme AND code = 'acme-cfo';
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.held(acme, 'acme-cfo')), before_rows, 'changing only the stamps and who saved writes nothing');
  RAISE NOTICE 'record_history: no change passed';
END $$;

-- ---------- an untracked column never appears ----------
-- Break caught: the trigger records every column (or a column it was not told to), so the history holds what it was never meant to.
DO $$
DECLARE acme uuid := pg_temp.id('acme');
BEGIN
  PERFORM pg_temp.is((SELECT string_agg(DISTINCT field, ',' ORDER BY field) FROM public.record_history WHERE table_name = 'referral_partners' AND kind = 'changed'), 'kind,name',
    'across every partner only the two listed fields ever appear');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE field IN ('code', 'created_at', 'updated_at', 'created_by_email', 'updated_by_email', 'firm_id')), 0::bigint,
    'never the code, the stamps, who saved or the firm');
  -- The trigger's list is the one written where it is attached, and nothing else.
  PERFORM pg_temp.is((SELECT replace(encode(t.tgargs, 'escape'), '\000', ',') FROM pg_trigger t WHERE t.tgrelid = 'public.referral_partners'::regclass AND t.tgname = 'referral_partners_history'),
    'referral_partners,code,name,kind,', 'the list is written in the trigger''s arguments: name and kind');
  RAISE NOTICE 'record_history: untracked columns passed';
END $$;

-- ---------- how a value reads back: null, number, date, true or false, text ----------
-- Break caught: a null reads back as the word "null" or an empty text; a number or a date reads back as text of the wrong shape; a column the
-- trigger was not told to track enters because it is on the table. Uses a scratch table, taken away at the end.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); h record;
BEGIN
  CREATE TABLE public.history_probe (firm_id uuid NOT NULL, code text NOT NULL, a text, n numeric, d date, b boolean, secret text, PRIMARY KEY (firm_id, code));
  PERFORM public.record_history_track('public.history_probe', 'referral_partners', ARRAY['code'], ARRAY['a', 'n', 'd', 'b']);
  INSERT INTO public.history_probe VALUES (acme, 'typed', 'text', 12.50, DATE '2026-11-18', true, 's1');
  UPDATE public.history_probe SET a = NULL, n = 7, d = DATE '2027-01-02', b = false, secret = 's2' WHERE code = 'typed';
  UPDATE public.history_probe SET a = 'back', n = NULL, d = NULL, b = NULL WHERE code = 'typed';
  PERFORM pg_temp.is((SELECT old_value::text || '>' || COALESCE(new_value::text, '~') FROM pg_temp.held(acme, 'typed') WHERE field = 'a' ORDER BY at LIMIT 1), '"text">~', 'text to nothing reads back as a text and no value, never "null"');
  PERFORM pg_temp.is((SELECT COALESCE(old_value::text, '~') || '>' || new_value::text FROM pg_temp.held(acme, 'typed') WHERE field = 'a' ORDER BY at DESC LIMIT 1), '~>"back"', 'and nothing to text');
  PERFORM pg_temp.is((SELECT old_value::text || '>' || new_value::text FROM pg_temp.held(acme, 'typed') WHERE field = 'n' ORDER BY at LIMIT 1), '12.50>7', 'a number is a number');
  PERFORM pg_temp.is((SELECT jsonb_typeof(old_value) FROM pg_temp.held(acme, 'typed') WHERE field = 'n' ORDER BY at LIMIT 1), 'number', 'a JSON number, not text');
  PERFORM pg_temp.is((SELECT old_value::text || '>' || new_value::text FROM pg_temp.held(acme, 'typed') WHERE field = 'd' ORDER BY at LIMIT 1), '"2026-11-18">"2027-01-02"', 'a date is its ISO text');
  PERFORM pg_temp.is((SELECT old_value::text || '>' || new_value::text FROM pg_temp.held(acme, 'typed') WHERE field = 'b' ORDER BY at LIMIT 1), 'true>false', 'a true or false is a boolean');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.held(acme, 'typed') WHERE field = 'secret'), 0::bigint, 'a column the trigger was not told about never enters');
  -- A field named in the trigger that is not a column is a mistake that shows at the first change, not a silent gap.
  CREATE TRIGGER history_probe_typo AFTER UPDATE ON public.history_probe
    FOR EACH ROW EXECUTE FUNCTION public.record_history_capture('referral_partners', 'code', 'no_such_column');
  PERFORM pg_temp.is(pg_temp.attempt($q$UPDATE public.history_probe SET a = 'again' WHERE code = 'typed'$q$), '42703', 'a field that is not a column is refused when a change is made');
  DROP TRIGGER history_probe_typo ON public.history_probe;
  -- The key and the firm of a record with a history can't change: its history would be left behind.
  PERFORM pg_temp.is(pg_temp.attempt($q$UPDATE public.history_probe SET code = 'renamed' WHERE code = 'typed'$q$), '23514', 'the key of a tracked record can''t change');
  -- Attaching is checked then, not at the first change: a table that is not on the list, a field or key that is not a column, a repeat.
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.record_history_track('public.history_probe', 'chamber_sessions', ARRAY['code'], ARRAY['a'])$q$), '22023', 'a table name that is not on the list can''t be given a history');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.record_history_track('public.history_probe', 'referral_partners', ARRAY['code'], ARRAY['a', 'no_such_column'])$q$), '42703', 'a field that is not a column is refused when it is attached');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.record_history_track('public.history_probe', 'referral_partners', ARRAY['no_such_key'], ARRAY['a'])$q$), '42703', 'and a key column that is not one');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.record_history_track('public.history_probe', 'referral_partners', ARRAY['code'], ARRAY['a', 'code'])$q$), '22023', 'and a field that is also the key');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.record_history_track('public.firms', 'referral_partners', ARRAY['id'], ARRAY['name'])$q$), '42703', 'and a table with no firm');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.record_history_track('public.history_probe', 'referral_partners', ARRAY['code'], ARRAY[]::text[])$q$), '22023', 'and no field at all');
  -- Emptying a tracked table is refused, so a record made later with the same key can't inherit a history.
  PERFORM pg_temp.is(pg_temp.attempt($q$TRUNCATE public.history_probe$q$), '42501', 'a table with a history can''t be emptied');
  DELETE FROM public.history_probe WHERE code = 'typed';
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.held(acme, 'typed')), 0::bigint, 'deleting the record takes its history with it');
  DROP TABLE public.history_probe;
  RAISE NOTICE 'record_history: values passed';
END $$;

-- ---------- who is recorded: a member, the service role, a platform admin, an admin acting as a member ----------
-- Break caught: the actor is taken from the wrong place (the table's owner, a parameter); the service role is shown as a person; a platform
-- admin who is not a member is shown by name or email (D-33), or a member who also holds a platform role is hidden as Nevermore.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); r text;
BEGIN
  -- The service role (what the scheduled jobs and server functions use): no person, shown as the system.
  PERFORM pg_temp.as_service();
  RESET ROLE;
  UPDATE public.referral_partners SET name = 'Acme Finance Group (service)' WHERE firm_id = acme AND code = 'acme-cfo';
  PERFORM pg_temp.is((SELECT actor_id IS NULL AND NOT actor_is_staff FROM pg_temp.held(acme, 'acme-cfo') WHERE new_value = '"Acme Finance Group (service)"'), true, 'the service role is stored with no actor');
  -- A platform admin who is no member of the firm: the real actor is stored, for the platform only, and stamped as staff.
  PERFORM pg_temp.claims_of('platform_admin');
  UPDATE public.referral_partners SET name = 'Acme Finance Group (staff)' WHERE firm_id = acme AND code = 'acme-cfo';
  PERFORM pg_temp.is((SELECT actor_id = pg_temp.id('platform_admin') AND actor_is_staff FROM pg_temp.held(acme, 'acme-cfo') WHERE new_value = '"Acme Finance Group (staff)"'), true,
    'a platform admin''s change is stored with the real actor and stamped as staff');
  -- An admin who is also a member acts as a member: shown as themselves.
  PERFORM pg_temp.as_user('acme_admin_member', 'acme-brokers');
  PERFORM public.advisor_update_referral_partner('acme-cfo', 'Acme Finance Group (member admin)', 'law_firm', acme, (SELECT version FROM public.referral_partners WHERE firm_id = acme AND code = 'acme-cfo'));
  RESET ROLE;
  PERFORM pg_temp.is((SELECT actor_is_staff FROM pg_temp.held(acme, 'acme-cfo') WHERE new_value = '"Acme Finance Group (member admin)"'), false, 'an admin who is a member of the firm acts as a member');

  -- What the firm reads: Nevermore with no id or email; the system; the member's own email.
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  r := pg_temp.read_as(acme, 'acme-cfo');
  PERFORM pg_temp.is(split_part(r, E'\n', 1), 'changed|acme_admin_member@example.test|member|name|"Acme Finance Group (staff)"|"Acme Finance Group (member admin)"', 'a member who holds a platform role is shown as themselves');
  PERFORM pg_temp.is(split_part(r, E'\n', 2), 'changed|Nevermore|nevermore|name|"Acme Finance Group (service)"|"Acme Finance Group (staff)"', 'a platform admin from outside is shown as Nevermore');
  PERFORM pg_temp.is(split_part(r, E'\n', 3), 'changed|System|system|name|"Acme Finance Group"|"Acme Finance Group (service)"', 'the service role is shown as System');
  PERFORM pg_temp.is(position('platform_admin' IN r), 0, 'nothing in what the firm reads names the platform admin: no id, no email');
  RESET ROLE;
  RAISE NOTICE 'record_history: who passed';
END $$;

-- The reading function's columns hold no user id at all.
DO $$
BEGIN
  PERFORM pg_temp.is((SELECT string_agg(arg, ',') FROM (SELECT unnest(p.proargnames) arg FROM pg_proc p WHERE p.oid = 'public.record_history_list(uuid,text,text,integer,timestamptz,uuid)'::regprocedure) x WHERE arg ~ '(^|_)(id|email)$' AND arg NOT IN ('p_firm_id', 'change_id')),
    NULL::text, 'the function returns no actor id and no email column');
  RAISE NOTICE 'record_history: columns passed';
END $$;

-- ---------- nobody writes, edits or deletes a row ----------
-- Break caught: an API role is granted a write or a read of the table; a policy opens it; the table's owner edits or deletes a row, or empties
-- it; the deletion allowed for a record's removal or a firm's closing is allowed for anything else.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); zenith uuid := pg_temp.id('zenith'); who text; stmt text; n bigint;
BEGIN
  FOREACH who IN ARRAY ARRAY['acme_owner', 'acme_agent', 'platform_admin', 'nobody'] LOOP
    PERFORM pg_temp.as_user(who, 'acme-brokers');
    PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.record_history (firm_id, table_name, record_key, change_id, kind) VALUES (%L, 'referral_partners', 'acme-cfo', gen_random_uuid(), 'created')$q$, acme)), '42501', who || ' can''t insert');
    PERFORM pg_temp.is(pg_temp.attempt($q$UPDATE public.record_history SET new_value = '"x"'$q$), '42501', who || ' can''t update');
    PERFORM pg_temp.is(pg_temp.attempt($q$DELETE FROM public.record_history$q$), '42501', who || ' can''t delete');
    PERFORM pg_temp.is(pg_temp.attempt($q$SELECT count(*) FROM public.record_history$q$), '42501', who || ' can''t read the table: reads go through the function');
    PERFORM pg_temp.is(pg_temp.attempt($q$TRUNCATE public.record_history$q$), '42501', who || ' can''t empty it');
  END LOOP;
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.record_history (firm_id, table_name, record_key, change_id, kind) VALUES (%L, 'referral_partners', 'acme-cfo', gen_random_uuid(), 'created')$q$, acme)), '42501', 'the service role can''t insert');
  PERFORM pg_temp.is(pg_temp.attempt($q$UPDATE public.record_history SET new_value = '"x"'$q$), '42501', 'nor update');
  PERFORM pg_temp.is(pg_temp.attempt($q$DELETE FROM public.record_history$q$), '42501', 'nor delete');
  PERFORM pg_temp.is(pg_temp.attempt($q$TRUNCATE public.record_history$q$), '42501', 'nor empty it');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT count(*) FROM public.record_history$q$), '42501', 'a signed-out caller reads nothing');
  RESET ROLE;
  -- The table's owner (the superuser here): the trigger refuses, whatever the statement.
  PERFORM pg_temp.is(pg_temp.attempt($q$UPDATE public.record_history SET new_value = '"x"'$q$), '42501', 'the owner can''t update a row: the trigger refuses');
  PERFORM pg_temp.is(pg_temp.attempt($q$UPDATE public.record_history SET actor_id = NULL, actor_is_staff = false$q$), '42501', 'nor take away who did it');
  PERFORM pg_temp.is(pg_temp.attempt($q$DELETE FROM public.record_history$q$), '42501', 'nor delete one');
  PERFORM pg_temp.is(pg_temp.attempt($q$TRUNCATE public.record_history$q$), '42501', 'nor empty the table');
  RAISE NOTICE 'record_history: nobody edits passed';
END $$;

-- Break caught: a setting a caller can make lets the owner (or anyone who can run a statement) delete a history, as ADR 0012 rejected for the
-- firm's record; the function that deletes works for a record that still exists, or for a firm that is not closing; the role that deletes can
-- log in, belongs to an API role or holds more than read and delete.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); n bigint;
BEGIN
  PERFORM set_config('nevermore.closing_firm', acme::text, true);
  PERFORM set_config('nevermore.record_history_cleanup', acme::text || '/referral_partners/acme-cfo', true);
  PERFORM pg_temp.is(pg_temp.attempt(format($q$DELETE FROM public.record_history WHERE firm_id = %L$q$, acme)), '42501', 'the owner can''t delete with either setting set');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$DELETE FROM public.record_history WHERE firm_id = %L AND record_key = 'acme-cfo'$q$, acme)), '42501', 'not even the one record the setting names');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.record_history_remove(%L)$q$, acme)), '42501', 'nor through the function, for a firm that is not closing, whatever is set');
  PERFORM set_config('nevermore.closing_firm', '', true);
  PERFORM set_config('nevermore.record_history_cleanup', '', true);
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.record_history_remove(%L, 'referral_partners', 'acme-cfo')$q$, acme)), '42501', 'nor the history of a record that still exists');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.record_history_remove(%L, 'referral_partners', NULL)$q$, acme)), '22023', 'a record is named by its table and key together');
  SELECT count(*) INTO n FROM pg_temp.held(acme, 'acme-cfo');
  PERFORM pg_temp.is(n > 0, true, 'and nothing was lost by those tries');
  -- The role.
  PERFORM pg_temp.is((SELECT r.rolcanlogin OR r.rolsuper OR r.rolbypassrls OR r.rolinherit FROM pg_roles r WHERE r.rolname = 'record_history_remover'), false, 'the removing role can''t log in, bypasses nothing and inherits nothing');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_auth_members m JOIN pg_roles g ON g.oid = m.roleid JOIN pg_roles u ON u.oid = m.member
                      WHERE g.rolname = 'record_history_remover' AND u.rolname IN ('anon', 'authenticated', 'service_role', 'authenticator')), 0::bigint, 'no API role belongs to it');
  PERFORM pg_temp.is((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants WHERE grantee = 'record_history_remover' AND table_schema = 'public'), 'DELETE,SELECT', 'it holds read and delete on this table and nothing on any other');
  PERFORM pg_temp.is((SELECT string_agg(p.proname, ',') FROM pg_proc p WHERE p.proowner = 'record_history_remover'::regrole), 'record_history_remove', 'and owns the one function that deletes');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_proc p WHERE p.proname = 'record_history_remove' AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE') OR has_function_privilege('service_role', p.oid, 'EXECUTE'))), 0::bigint, 'no API role can run it');
  RAISE NOTICE 'record_history: deleting is by a role, not a setting';
END $$;

-- The table is closed by the catalogue too, not only by what the tests tried.
DO $$
BEGIN
  PERFORM pg_temp.is((SELECT count(*) FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'record_history' AND grantee IN ('anon', 'authenticated', 'PUBLIC')), 0::bigint, 'no browser role holds any privilege on the table');
  PERFORM pg_temp.is((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'record_history' AND grantee = 'service_role'), 'SELECT', 'the service role may read it and nothing else');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'record_history' AND roles && ARRAY['public', 'anon', 'authenticated', 'service_role']::name[]), 0::bigint, 'and no policy opens it to a browser role or the service role');
  PERFORM pg_temp.is((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.record_history'::regclass), true, 'row security is on');
END $$;

-- ---------- who may read ----------
-- Break caught: another firm's member, a former or suspended member, a platform admin with no session, a password sign-in without its second
-- factor, or a member at another firm's address reads a firm's history; or the refusal tells a real record from a made-up one.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); zenith uuid := pg_temp.id('zenith'); real_one text; made_up text; own_made_up text;
BEGIN
  -- Members read: an agent, a lead and an owner.
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history_list(acme, 'referral_partners', 'acme-cfo')) > 0, true, 'an agent of the firm reads it');
  PERFORM pg_temp.as_user('acme_lead', 'acme-brokers');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history_list(acme, 'referral_partners', 'acme-cfo')) > 0, true, 'a lead reads it');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history_list(acme, 'referral_partners', 'acme-cfo')) > 0, true, 'an owner reads it on the bare domain too');
  RESET ROLE;

  -- Zenith has a partner of the same code: another firm's record of the same name is not this one.
  PERFORM set_config('request.jwt.claims', '', false);
  INSERT INTO public.referral_partners (firm_id, code, name, kind) VALUES (zenith, 'acme-cfo', 'Zenith''s own', 'other');
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.read_as(zenith, 'acme-cfo'), 'created|System|system|-|~|~', 'a code is a firm''s own: the other firm reads its own record of that code, and only that');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.record_history_list(%L, 'referral_partners', 'acme-cfo')$q$, acme)), 'PT404: That record isn''t available', 'another firm''s record is refused in plain words');
  real_one := pg_temp.refusal(format($q$SELECT * FROM public.record_history_list(%L, 'referral_partners', 'acme-cfo')$q$, acme));
  made_up := pg_temp.refusal(format($q$SELECT * FROM public.record_history_list(%L, 'referral_partners', 'no-such-partner')$q$, acme));
  own_made_up := pg_temp.refusal(format($q$SELECT * FROM public.record_history_list(%L, 'referral_partners', 'no-such-partner')$q$, zenith));
  PERFORM pg_temp.is(real_one, made_up, 'the same refusal for another firm''s record as for a made-up one');
  PERFORM pg_temp.is(own_made_up, made_up, 'and for a member''s own firm''s made-up one');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.record_history_list(%L, 'referral_partners', 'acme-cfo')$q$, gen_random_uuid())), made_up, 'and for a firm that does not exist');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.record_history_list(%L, 'referral_partners', NULL)$q$, zenith)), made_up, 'and for no key');

  -- Everyone else with an acme record to ask about.
  PERFORM pg_temp.as_user('acme_removed', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.record_history_list(%L, 'referral_partners', 'acme-cfo')$q$, acme)), made_up, 'a removed member reads nothing');
  RESET ROLE;
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM public.suspend_member(acme, pg_temp.id('acme_suspended'));
  PERFORM pg_temp.as_user('acme_suspended', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.record_history_list(%L, 'referral_partners', 'acme-cfo')$q$, acme)), made_up, 'a suspended member reads nothing');
  PERFORM pg_temp.as_user('platform_admin', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.record_history_list(%L, 'referral_partners', 'acme-cfo')$q$, acme)), made_up, 'a platform admin with no session reads nothing (D-16)');
  PERFORM pg_temp.as_user('nobody', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.record_history_list(%L, 'referral_partners', 'acme-cfo')$q$, acme)), made_up, 'a person with no firm reads nothing');
  PERFORM pg_temp.as_user('acme_lead', 'acme-brokers', 'password');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.record_history_list(%L, 'referral_partners', 'acme-cfo')$q$, acme)), made_up, 'a password sign-in that has not done its second factor reads nothing (D-19)');
  PERFORM pg_temp.as_user('acme_agent', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.record_history_list(%L, 'referral_partners', 'acme-cfo')$q$, acme)), made_up, 'a member at another firm''s address reads nothing: the address narrows (D-40)');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, 'referral_partners', 'acme-cfo')$q$, acme)), '42501', 'a signed-out caller can''t run it');
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.record_history_list(%L, 'referral_partners', 'acme-cfo')$q$, acme)), made_up, 'the service role is no member and reads nothing through it');
  RESET ROLE;
  RAISE NOTICE 'record_history: who may read passed';
END $$;

-- ---------- support reads and writes nothing ----------
-- Break caught: a support session can't read the history (the doorway is shut), reads it at the wrong address, or changes a record through the
-- partner functions; or the support read shows who at Nevermore acted.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); r text; before_rows bigint;
BEGIN
  SELECT count(*) INTO before_rows FROM public.record_history WHERE firm_id = acme;
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.start_support_session(acme, 'Looking at a partner for the owner');
  PERFORM pg_temp.as_user('platform_admin', 'acme-brokers');
  r := pg_temp.read_as(acme, 'acme-cfo');
  PERFORM pg_temp.is(r <> '' AND position('platform_admin' IN r) = 0, true, 'a support session reads the history, and sees the staff change as Nevermore');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.advisor_update_referral_partner('acme-cfo', 'By support', 'other', %L, 1)$q$, acme)), 'PT423', 'and changes no partner');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.advisor_add_referral_partner('by-support', 'By support', 'other', %L)$q$, acme)), 'PT423', 'and adds none');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT count(*) FROM public.record_history$q$), '42501', 'and reads the table no more than anyone');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.record_history_list(%L, 'referral_partners', 'acme-cfo')$q$, acme)), 'PT404: That record isn''t available', 'on the bare domain the session reads nothing');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE firm_id = acme), before_rows, 'nothing was written by looking');
  RAISE NOTICE 'record_history: support passed';
END $$;

-- ---------- paging ----------
-- Break caught: a page repeats or skips an entry; the order is not newest first; the page size is not respected or not limited; a half cursor is
-- taken; an entry that arrives between two pages shifts the next one.
DO $$
DECLARE
  acme uuid := pg_temp.id('acme'); i integer; page record; seen text[] := '{}'; last_at timestamptz; last_key uuid; got integer; pages integer := 0; total integer; prev timestamptz := 'infinity';
  e record;
BEGIN
  INSERT INTO public.referral_partners (firm_id, code, name, kind) VALUES (acme, 'paged', 'Paged 0', 'other');
  FOR i IN 1..6 LOOP
    UPDATE public.referral_partners SET name = 'Paged ' || i WHERE firm_id = acme AND code = 'paged';
  END LOOP;
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  total := (SELECT count(*) FROM public.record_history_list(acme, 'referral_partners', 'paged', 100));
  PERFORM pg_temp.is(total, 7, 'the creation and six changes');
  LOOP
    got := 0;
    FOR e IN SELECT * FROM public.record_history_list(acme, 'referral_partners', 'paged', 3, last_at, last_key) LOOP
      got := got + 1;
      IF e.entry_key::text = ANY (seen) THEN RAISE EXCEPTION 'FAIL: a page repeated an entry'; END IF;
      IF e.at > prev THEN RAISE EXCEPTION 'FAIL: the entries are not newest first'; END IF;
      seen := seen || e.entry_key::text;
      prev := e.at;
      last_at := e.at;
      last_key := e.entry_key;
    END LOOP;
    EXIT WHEN got = 0;
    pages := pages + 1;
    IF pages = 1 THEN
      -- An entry arrives after the first page: the next page continues where the reader was, and does not move.
      RESET ROLE;
      UPDATE public.referral_partners SET name = 'Paged late' WHERE firm_id = acme AND code = 'paged';
      PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
    END IF;
  END LOOP;
  PERFORM pg_temp.is(cardinality(seen), 7, 'every entry that was there when the reader began is read once, across pages of three');
  PERFORM pg_temp.is(pages, 3, 'in three pages');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, 'referral_partners', 'paged', 0)$q$, acme)), '22023', 'a page of none is refused');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, 'referral_partners', 'paged', 101)$q$, acme)), '22023', 'a page of 101 is refused');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, 'referral_partners', 'paged', 5, now(), NULL)$q$, acme)), '22023', 'half a cursor is refused');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history_list(acme, 'referral_partners', 'paged', 2)), 2::bigint, 'a page holds at most what was asked');
  RESET ROLE;
  RAISE NOTICE 'record_history: paging passed';
END $$;

-- ---------- a table that is not on the list ----------
-- Break caught: a table name outside the list is answered (and so a history could be asked of any table), or the refusal is in database words.
DO $$
DECLARE acme uuid := pg_temp.id('acme');
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.record_history_list(%L, 'chamber_sessions', %L)$q$, acme, gen_random_uuid()::text)), '22023: There is no history for a table called "chamber_sessions"', 'an intake''s table has no history');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, 'nonsense', 'x')$q$, acme)), '22023', 'nor a made-up name');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, NULL, 'x')$q$, acme)), '22023', 'nor none');
  RESET ROLE;
  RAISE NOTICE 'record_history: unknown table passed';
END $$;

-- ---------- an intake's answers cannot enter (the second criterion of CRM-S5.2) ----------
-- Break caught: the trigger is attached to the intake table, or to something whose list names the answers, so an intake's answers (or the
-- firm's other fields) enter a history that is read by the firm.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); sid uuid; before_rows bigint;
BEGIN
  SELECT count(*) INTO before_rows FROM public.record_history;
  INSERT INTO public.chamber_sessions (user_id, firm_id, chamber_data) VALUES (pg_temp.id('nobody'), acme, '{"company_name":"One"}') RETURNING id INTO sid;
  UPDATE public.chamber_sessions SET chamber_data = '{"company_name":"Two"}' WHERE id = sid;
  DELETE FROM public.chamber_sessions WHERE id = sid;
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history), before_rows, 'creating, answering and deleting an intake writes nothing to the history');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_trigger t WHERE t.tgrelid = 'public.chamber_sessions'::regclass AND t.tgfoid = 'public.record_history_capture()'::regprocedure), 0::bigint,
    'the intake table has no history trigger');
  PERFORM pg_temp.is((SELECT string_agg(c.relname, ',' ORDER BY c.relname) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE t.tgfoid = 'public.record_history_capture()'::regprocedure AND NOT t.tgisinternal), 'referral_partners',
    'the only table with the trigger is referral partners');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_trigger t WHERE t.tgfoid = 'public.record_history_capture()'::regprocedure AND encode(t.tgargs, 'escape') ~ 'chamber_data'), 0::bigint, 'and no list names an intake''s answers');
  -- Nothing else writes the history: the only function that inserts into it is the capture trigger.
  PERFORM pg_temp.is((SELECT string_agg(p.proname, ',' ORDER BY p.proname) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prosrc ~* 'insert into public\.record_history'), 'record_history_capture',
    'and the capture trigger is the only function that writes a row');
  RAISE NOTICE 'record_history: an intake''s answers passed';
END $$;

-- ---------- a record's own deletion removes its history ----------
-- Break caught: deleting a record leaves its history behind (read by no one, kept for good), or removes another record's. Referral partners
-- can't be deleted through the product today (no function does it), so this is the table's own DELETE, as the owner.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); zenith uuid := pg_temp.id('zenith'); other_before bigint;
BEGIN
  SELECT count(*) INTO other_before FROM public.record_history WHERE NOT (firm_id = acme AND record_key = 'paged');
  DELETE FROM public.referral_partners WHERE firm_id = acme AND code = 'paged';
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.held(acme, 'paged')), 0::bigint, 'the deleted partner''s history goes with it');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE NOT (firm_id = acme AND record_key = 'paged')), other_before, 'and nobody else''s');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.held(zenith, 'acme-cfo')), 1::bigint, 'not even a partner of another firm with the same code');
  RAISE NOTICE 'record_history: a record''s deletion passed';
END $$;

-- ---------- the firm's closing deletes it ----------
-- Break caught: closing a firm leaves its history behind, or deletes another firm's; the closing fails because the history refuses to be deleted.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); zenith uuid := pg_temp.id('zenith'); counts jsonb; acme_before bigint;
BEGIN
  INSERT INTO public.referral_partners (firm_id, code, name, kind) VALUES (zenith, 'second', 'Second', 'event');
  UPDATE public.referral_partners SET name = 'Second renamed' WHERE firm_id = zenith AND code = 'second';
  SELECT count(*) INTO acme_before FROM public.record_history WHERE firm_id = acme;
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE firm_id = zenith) > 0, true, 'the firm has a history to delete');
  PERFORM pg_temp.is((SELECT p.action FROM public.firm_closing_plan() p WHERE p.src = 'public.record_history'), 'delete', 'the closing''s list deletes it');
  PERFORM pg_temp.is((SELECT p.ord < q.ord FROM public.firm_closing_plan() p, public.firm_closing_plan() q WHERE p.src = 'public.record_history' AND q.src = 'public.referral_partners'), true, 'before the records it belongs to');
  INSERT INTO public.firm_closures (firm_id, asked_at, closes_at) VALUES (zenith, now() - interval '31 days', now() - interval '1 day');
  counts := public.close_firm_now(zenith);
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE firm_id = zenith), 0::bigint, 'closing deletes the firm''s history');
  PERFORM pg_temp.is((counts ->> 'record_history')::integer > 0, true, 'and says how many, without saying what');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE firm_id = acme), acme_before, 'another firm''s history is untouched');
  PERFORM pg_temp.is(current_setting('nevermore.closing_firm', true), '', 'and the closing''s permission to delete is not left on');
  PERFORM pg_temp.is(pg_temp.attempt($q$DELETE FROM public.record_history$q$), '42501', 'so the owner is refused again afterwards');
  RAISE NOTICE 'record_history: closing passed';
END $$;

-- ---------- a composite key can't be confused ----------
-- Break caught: ('a/b','c') and ('a','b/c') are stored under one key, so two records share a history (or one reads the other's).
DO $$
DECLARE acme uuid := pg_temp.id('acme');
BEGIN
  CREATE TABLE public.history_probe2 (firm_id uuid NOT NULL, a text NOT NULL, b text NOT NULL, x text, PRIMARY KEY (firm_id, a, b));
  PERFORM public.record_history_track('public.history_probe2', 'referral_partners', ARRAY['a', 'b'], ARRAY['x']);
  INSERT INTO public.history_probe2 VALUES (acme, 'a/b', 'c', '1'), (acme, 'a', 'b/c', '1');
  UPDATE public.history_probe2 SET x = '2' WHERE b = 'c';
  PERFORM pg_temp.is((SELECT string_agg(DISTINCT record_key, ' ' ORDER BY record_key) FROM public.record_history WHERE firm_id = acme AND record_key LIKE '[%'), '["a","b/c"] ["a/b","c"]', 'two records, two keys: the parts of a composite key are a JSON array');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.held(acme, '["a/b","c"]')), 2::bigint, 'one record has its creation and its change');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.held(acme, '["a","b/c"]')), 1::bigint, 'and the other only its creation');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.record_history_list(%L, 'referral_partners', %L)$q$, acme, '["a/b","c"]')), 'PT404: That record isn''t available', 'asked for through the function, a record that is not a partner is not available');
  RESET ROLE;
  DELETE FROM public.history_probe2;
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE firm_id = acme AND record_key LIKE '[%'), 0::bigint, 'both are cleaned up with their records');
  DROP TABLE public.history_probe2;
  RAISE NOTICE 'record_history: composite keys passed';
END $$;

-- ---------- timestamps and jsonb nulls ----------
-- Break caught: the same instant reads differently depending on the writer's time zone; a JSON null and SQL null in a jsonb column are
-- recorded as a change (they are the same to the history, and the glossary says so).
DO $$
DECLARE acme uuid := pg_temp.id('acme');
BEGIN
  CREATE TABLE public.history_probe3 (firm_id uuid NOT NULL, code text NOT NULL, at_time timestamptz, doc jsonb, PRIMARY KEY (firm_id, code));
  PERFORM public.record_history_track('public.history_probe3', 'referral_partners', ARRAY['code'], ARRAY['at_time', 'doc']);
  SET LOCAL timezone = 'America/New_York';
  INSERT INTO public.history_probe3 VALUES (acme, 'tz', '2026-11-18 05:00:00-05', NULL);
  UPDATE public.history_probe3 SET at_time = '2026-11-18 11:00:00+01' WHERE code = 'tz';
  SET LOCAL timezone = 'Asia/Tokyo';
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.held(acme, 'tz') WHERE field = 'at_time'), 0::bigint, 'the same instant written from another zone is no change');
  UPDATE public.history_probe3 SET at_time = '2026-11-19 19:00:00+09' WHERE code = 'tz';
  PERFORM pg_temp.is((SELECT old_value::text || '>' || new_value::text FROM pg_temp.held(acme, 'tz') WHERE field = 'at_time'), '"2026-11-18T10:00:00+00:00">"2026-11-19T10:00:00+00:00"', 'a time is stored in UTC, in one fixed form, whatever the writer''s zone');
  SET LOCAL timezone = 'UTC';
  UPDATE public.history_probe3 SET doc = 'null'::jsonb WHERE code = 'tz';
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.held(acme, 'tz') WHERE field = 'doc'), 0::bigint, 'a JSON null and no value are the same to the history');
  UPDATE public.history_probe3 SET doc = '{"k":1}' WHERE code = 'tz';
  PERFORM pg_temp.is((SELECT COALESCE(old_value::text, '~') || '>' || new_value::text FROM pg_temp.held(acme, 'tz') WHERE field = 'doc'), '~>{"k": 1}', 'and a real value is recorded from nothing');
  DELETE FROM public.history_probe3;
  DROP TABLE public.history_probe3;
  RAISE NOTICE 'record_history: timestamps passed';
END $$;

-- ---------- a table with a history can't be emptied ----------
-- Break caught: the service role (which holds TRUNCATE on referral partners) or the owner empties the table and a partner made later with the
-- same code inherits the old history.
DO $$
DECLARE acme uuid := pg_temp.id('acme');
BEGIN
  PERFORM pg_temp.is(pg_temp.attempt($q$TRUNCATE public.referral_partners$q$), '42501', 'referral partners can''t be emptied');
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(pg_temp.attempt($q$TRUNCATE public.referral_partners$q$), '42501', 'not by the service role either');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.referral_partners WHERE firm_id = acme AND code = 'acme-cfo'), 1::bigint, 'and the partners are still there');
  RAISE NOTICE 'record_history: no emptying passed';
END $$;

-- ---------- standing: every table with a history is attached whole ----------
-- Break caught: a later migration attaches the capture trigger by hand and leaves out the truncate guard, or names a field or key that is not a
-- column (which would fail only at the first change, and then block every update of the table), or a table that is not on the list.
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO bad
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  WHERE t.tgfoid = 'public.record_history_capture()'::regprocedure AND NOT t.tgisinternal
    AND NOT EXISTS (SELECT 1 FROM pg_trigger g WHERE g.tgrelid = t.tgrelid AND NOT g.tgisinternal AND g.tgfoid = 'public.record_history_refuse_truncate()'::regprocedure
                    AND (g.tgtype & 32) = 32 AND (g.tgtype & 1) = 0);
  PERFORM pg_temp.is(bad, NULL::text, 'every table that carries the capture trigger also carries the guard that refuses TRUNCATE (attach both with record_history_track)');
  SELECT string_agg(c.relname || ' (' || x.col || ')', ', ' ORDER BY c.relname, x.col) INTO bad
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  CROSS JOIN LATERAL (
    SELECT unnest(ARRAY['firm_id'] || string_to_array((string_to_array(encode(t.tgargs, 'escape'), '\000'))[2], ',') || (string_to_array(encode(t.tgargs, 'escape'), '\000'))[3:]) AS col) x
  WHERE t.tgfoid = 'public.record_history_capture()'::regprocedure AND NOT t.tgisinternal AND x.col <> ''
    AND NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = t.tgrelid AND a.attname = x.col AND a.attnum > 0 AND NOT a.attisdropped);
  PERFORM pg_temp.is(bad, NULL::text, 'every key column and tracked field a capture trigger names is a column of its table');
  SELECT string_agg(c.relname, ', ') INTO bad
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  WHERE t.tgfoid = 'public.record_history_capture()'::regprocedure AND NOT t.tgisinternal
    AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.contypid = 'public.record_history_table'::regtype AND pg_get_constraintdef(k.oid) LIKE '%''' || (string_to_array(encode(t.tgargs, 'escape'), '\000'))[1] || '''%');
  PERFORM pg_temp.is(bad, NULL::text, 'and its table name is on the list');
  RAISE NOTICE 'record_history: standing attachment checks passed';
END $$;

SELECT 'record_history: all cases passed' AS result;
