-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh menu_counts
-- The menu's counts (story CRM-S1.1c; docs/BROKER_CRM_BUILD.md D-38, D-39, D-40, D-44; 20261118140000_menu_counts.sql). Proves:
--   1. Quotes counts quote requests with status 'sent' on intakes the caller may see; Inbox counts intakes with new PEO mail;
--   2. Inbox equals the number of rows the queue's "has new PEO mail" filter shows (queue_list_submissions) and what
--      queue_view_counts says, before and after a thread is opened: the mark and the count are one rule;
--   3. one firm at a time: a member of two firms counts the address's firm only; a former member, a platform admin with
--      no support session, and an advisor with no firm get zeros in the same shape; people not let in are refused;
--   4. a support session reads the counts; a closing firm still shows them; asking writes nothing.
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
\i supabase/migrations/20261118170000_export.sql
SET client_min_messages = notice;

-- ---------- helpers ----------
CREATE TEMP TABLE fx (name text PRIMARY KEY, id uuid NOT NULL);
GRANT SELECT ON fx TO anon, authenticated, service_role;

CREATE FUNCTION pg_temp.id(n text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM fx WHERE name = n $$;

CREATE FUNCTION pg_temp.new_user(n text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', n || '@example.test', false, now(), now());
  INSERT INTO fx VALUES (n, uid);
  RETURN uid;
END $$;

CREATE FUNCTION pg_temp.as_user(n text, addr text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', false, 'email', n || '@example.test')::text, false);
  PERFORM set_config('request.headers', CASE WHEN addr IS NULL THEN '' ELSE jsonb_build_object('x-firm-address', addr)::text END, false);
  PERFORM set_config('role', 'authenticated', false);
END $$;

-- Signed-in claims for a sign-in method and assurance level (what Supabase Auth puts in a token).
CREATE FUNCTION pg_temp.as_user_with(n text, method text, level text, anon boolean DEFAULT false) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', anon, 'email', n || '@example.test',
      'aal', level, 'amr', jsonb_build_array(jsonb_build_object('method', method, 'timestamp', 1)))::text, false);
  PERFORM set_config('role', 'authenticated', false);
END $$;

CREATE FUNCTION pg_temp.as_signed_out() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', false);
  PERFORM set_config('role', 'anon', false);
END $$;

CREATE FUNCTION pg_temp.as_owner() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', false);
END $$;

-- Runs stmt and always rolls it back: 'ok' or the SQLSTATE it raised, with its message after a colon.
CREATE FUNCTION pg_temp.attempt(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  s text;
  m text;
BEGIN
  BEGIN
    EXECUTE stmt;
    RAISE EXCEPTION USING ERRCODE = 'ZZ999';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT;
    IF s = 'ZZ999' THEN RETURN 'ok'; END IF;
    RETURN s || ':' || m;
  END;
END $$;

-- The SQLSTATE a statement raises, or 'ok'.
CREATE FUNCTION pg_temp.expect(stmt text, expected text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r text := split_part(pg_temp.attempt(stmt), ':', 1);
BEGIN
  IF r IS DISTINCT FROM expected THEN RAISE EXCEPTION 'FAIL: % gave %, expected %', label, pg_temp.attempt(stmt), expected; END IF;
END $$;

-- A refusal with that SQLSTATE whose message contains `words`.
CREATE FUNCTION pg_temp.refused(stmt text, code text, words text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r text := pg_temp.attempt(stmt);
BEGIN
  IF r NOT LIKE code || ':%' OR strpos(r, words) = 0 THEN
    RAISE EXCEPTION 'FAIL: % gave %, expected % with "%"', label, r, code, words;
  END IF;
END $$;

CREATE FUNCTION pg_temp.is(got anyelement, want anyelement, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION 'FAIL: % gave %, expected %', label, got, want; END IF;
END $$;

-- An intake of a firm, started by its own prospect (a person has one open draft at a time), placed by the superuser.
CREATE FUNCTION pg_temp.intake(n text, firm text, data jsonb) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  uid uuid := pg_temp.new_user('p_' || n);
  sid uuid;
BEGIN
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, data) RETURNING id INTO sid;
  UPDATE public.chamber_sessions SET firm_id = pg_temp.id(firm) WHERE id = sid;
  INSERT INTO fx VALUES (n, sid);
  RETURN sid;
END $$;

-- An intake its prospect certified from the browser.
CREATE FUNCTION pg_temp.certified(n text, firm text, company text, signer text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  uid uuid := pg_temp.new_user('p_' || n);
  sid uuid;
BEGIN
  PERFORM pg_temp.as_user('p_' || n);
  PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');
  INSERT INTO public.chamber_sessions (user_id, chamber_data)
  VALUES (uid, jsonb_build_object('company_name', company, 'states', jsonb_build_array('CA'), 'pay_frequency', 'Bi-weekly', 'employee_count', 3))
  RETURNING id INTO sid;
  UPDATE public.chamber_sessions
  SET status = 'submitted',
      submission = jsonb_build_object('signer_name', signer, 'signer_title', 'CEO', 'signed_at', '2026-11-01T12:00:00Z',
        'file_id', 'EAA-2026-' || upper(left(replace(sid::text, '-', ''), 8)), 'consent_version', 'v1', 'consent_text', 'I certify.',
        'chamber_data', chamber_data)
  WHERE id = sid;
  PERFORM pg_temp.as_owner();
  UPDATE public.chamber_sessions SET firm_id = pg_temp.id(firm) WHERE id = sid;
  INSERT INTO fx VALUES (n, sid);
  RETURN sid;
END $$;


CREATE FUNCTION pg_temp.menu() RETURNS jsonb LANGUAGE sql AS $$ SELECT public.menu_counts() $$;
-- What the queue shows for the filter Inbox opens (D-38): the rows, and the total.
CREATE FUNCTION pg_temp.queue_inbox_total() RETURNS bigint LANGUAGE sql AS $$
  SELECT (public.queue_list_submissions('[{"field":"has_new_peo_mail","op":"is","value":true}]') ->> 'total')::bigint $$;
CREATE FUNCTION pg_temp.queue_inbox_rows() RETURNS bigint LANGUAGE sql AS $$
  SELECT jsonb_array_length(public.queue_list_submissions('[{"field":"has_new_peo_mail","op":"is","value":true}]') -> 'rows') $$;
CREATE FUNCTION pg_temp.queue_inbox_view() RETURNS bigint LANGUAGE sql AS $$
  SELECT total FROM public.queue_view_counts('[{"name":"Inbox","filters":[{"field":"has_new_peo_mail","op":"is","value":true}]}]') $$;
-- Every way of asking the queue for new mail gives one number; the menu's Inbox must be it.
CREATE FUNCTION pg_temp.inbox_agrees() RETURNS void LANGUAGE plpgsql AS $$
DECLARE m bigint := (public.menu_counts() ->> 'inbox')::bigint;
BEGIN
  IF m IS DISTINCT FROM pg_temp.queue_inbox_total() OR m IS DISTINCT FROM pg_temp.queue_inbox_rows() OR m IS DISTINCT FROM pg_temp.queue_inbox_view() THEN
    RAISE EXCEPTION 'FAIL: the menu says % with new mail, the queue filter says % (rows %, view tab %)', m, pg_temp.queue_inbox_total(), pg_temp.queue_inbox_rows(), pg_temp.queue_inbox_view();
  END IF;
END $$;

-- ---------- two firms ----------
DO $$
DECLARE
  n text;
BEGIN
  FOREACH n IN ARRAY ARRAY['a1', 'both', 'owner_b', 'b1', 'outsider', 'platform_admin', 'former_a', 'nobody'] LOOP
    PERFORM pg_temp.new_user(n);
  END LOOP;
  INSERT INTO fx VALUES ('firm_a', public.default_firm_id()), ('firm_b', gen_random_uuid());
  INSERT INTO public.firms (id, name, address, visibility, approved_at) VALUES (pg_temp.id('firm_b'), 'Beta Brokers', 'beta-brokers', 'by_level', now());
  INSERT INTO public.user_roles (user_id, role) VALUES
    (pg_temp.id('a1'), 'advisor'), (pg_temp.id('both'), 'advisor'), (pg_temp.id('b1'), 'advisor'), (pg_temp.id('outsider'), 'advisor'),
    (pg_temp.id('platform_admin'), 'admin'), (pg_temp.id('former_a'), 'advisor');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES
    (pg_temp.id('firm_a'), pg_temp.id('a1'), 'agent'), (pg_temp.id('firm_a'), pg_temp.id('both'), 'agent'),
    (pg_temp.id('firm_b'), pg_temp.id('both'), 'agent'),
    (pg_temp.id('firm_b'), pg_temp.id('owner_b'), 'owner'), (pg_temp.id('firm_b'), pg_temp.id('b1'), 'agent');
  INSERT INTO public.firm_memberships (firm_id, user_id, role, valid_from, valid_until)
  VALUES (pg_temp.id('firm_a'), pg_temp.id('former_a'), 'agent', now() - interval '10 days', now() - interval '1 day');
  UPDATE public.firms SET address = 'alpha-brokers' WHERE id = pg_temp.id('firm_a');
  PERFORM pg_temp.intake('s1', 'firm_a', '{"company_name":"One Co"}');
  PERFORM pg_temp.intake('s2', 'firm_a', '{"company_name":"Two Co"}');
  PERFORM pg_temp.intake('s3', 'firm_a', '{"company_name":"Three Co"}');
  PERFORM pg_temp.intake('s4', 'firm_a', '{"company_name":"Four Co"}');
  PERFORM pg_temp.intake('s5', 'firm_a', '{"company_name":"Five Co"}');
  PERFORM pg_temp.intake('s_b', 'firm_b', '{"company_name":"Bravo Co"}');
END $$;

-- Firm A: s1 sent to two PEOs, both with unread mail (one intake, two requests); s2 quoted with unread mail; s3 sent with only an
-- automatic reply; s4 sent with mail that was opened after it came; s5 declined with nothing. Firm B: one sent, with unread mail.
DO $$
DECLARE
  q bigint;
  fa uuid := pg_temp.id('firm_a');
BEGIN
  SET LOCAL session_replication_role = replica;
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_on) VALUES (pg_temp.id('s1'), 'TriNet', 'sent', current_date - 3) RETURNING id INTO q;
  INSERT INTO fx VALUES ('q_s1_trinet', gen_random_uuid());
  INSERT INTO public.quote_request_messages (provider_message_id, quote_request_id, session_id, direction, from_address, recorded_at, firm_id)
  VALUES ('s1-trinet', q, pg_temp.id('s1'), 'received', 'rep@trinet.test', now() - interval '1 hour', fa);
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_on) VALUES (pg_temp.id('s1'), 'Justworks', 'sent', current_date - 3);
  INSERT INTO public.quote_request_messages (provider_message_id, quote_request_id, session_id, direction, from_address, recorded_at, firm_id)
  SELECT 's1-justworks', id, session_id, 'received', 'rep@justworks.test', now() - interval '1 hour', fa FROM public.quote_requests WHERE session_id = pg_temp.id('s1') AND peo_name = 'Justworks';
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_version, sent_on, quote_expires_on)
  VALUES (pg_temp.id('s2'), 'Insperity', 'quoted', 1, current_date - 9, current_date + 5) RETURNING id INTO q;
  INSERT INTO public.quote_request_messages (provider_message_id, quote_request_id, session_id, direction, from_address, recorded_at, firm_id)
  VALUES ('s2-insp', q, pg_temp.id('s2'), 'received', 'rep@insperity.test', now() - interval '2 hours', fa);
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_on) VALUES (pg_temp.id('s3'), 'TriNet', 'sent', current_date - 1) RETURNING id INTO q;
  INSERT INTO public.quote_request_messages (provider_message_id, quote_request_id, session_id, direction, is_automatic, from_address, recorded_at, firm_id)
  VALUES ('s3-auto', q, pg_temp.id('s3'), 'received', true, 'auto@trinet.test', now() - interval '1 hour', fa);
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_on) VALUES (pg_temp.id('s4'), 'Rippling', 'sent', current_date - 1) RETURNING id INTO q;
  INSERT INTO public.quote_request_messages (provider_message_id, quote_request_id, session_id, direction, from_address, recorded_at, firm_id)
  VALUES ('s4-read', q, pg_temp.id('s4'), 'received', 'rep@rippling.test', now() - interval '2 days', fa);
  INSERT INTO public.quote_request_thread_reads (quote_request_id, last_opened_at, last_opened_by) VALUES (q, now() - interval '1 day', pg_temp.id('a1'));
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_on) VALUES (pg_temp.id('s5'), 'TriNet', 'declined', current_date - 5);
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_on) VALUES (pg_temp.id('s_b'), 'TriNet', 'sent', current_date - 2) RETURNING id INTO q;
  INSERT INTO public.quote_request_messages (provider_message_id, quote_request_id, session_id, direction, from_address, recorded_at, firm_id)
  VALUES ('b-new', q, pg_temp.id('s_b'), 'received', 'rep@trinet.test', now() - interval '1 hour', pg_temp.id('firm_b'));
END $$;

-- ---------- 1. what the numbers are ----------
-- Catches: a count that includes quoted or declined requests as open, that counts held or automatic mail as new, or that counts mail already opened.
SELECT pg_temp.as_user('a1', 'alpha-brokers');
SELECT pg_temp.is(pg_temp.menu(), '{"quotes":4,"inbox":2}'::jsonb, 'firm A: four sent requests (two on s1), two intakes with new mail (s1, s2)');
-- Catches: a count that grew a key a caller does not know, or lost one: later stories add keys; callers read by name.
SELECT pg_temp.is((SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(pg_temp.menu()) k), ARRAY['inbox', 'quotes'], 'the answer holds exactly the counts the menu shows today');
-- Catches: the count and the queue's mark drifting apart (the reason the rule is defined once).
SELECT pg_temp.inbox_agrees();
SELECT pg_temp.is((SELECT count(*) FROM jsonb_array_elements(public.queue_list_submissions('[]', NULL, 'asc', 1) -> 'rows') r WHERE (r ->> 'has_new_peo_mail')::boolean), 2::bigint, 'the queue marks the same two rows');
-- Quotes against the queue: the "waiting on a PEO" filter shows intakes with a sent request: s1, s3, s4 (three rows) for four requests.
SELECT pg_temp.is((public.queue_list_submissions('[{"field":"waiting_on_peo","op":"is","value":true}]') ->> 'total')::bigint, 3::bigint, 'the queue lists three intakes waiting on a PEO');

-- ---------- 2. opening a thread moves both together ----------
-- Catches: opening a thread that leaves the menu counting it; or the menu counting a thread the queue no longer marks.
SELECT pg_temp.as_user('a1', 'alpha-brokers');
SELECT public.advisor_open_quote_request_thread(id) FROM public.quote_requests WHERE session_id = pg_temp.id('s2');
SELECT pg_temp.is(pg_temp.menu(), '{"quotes":4,"inbox":1}'::jsonb, 'opening s2''s thread takes it out of the Inbox');
SELECT pg_temp.inbox_agrees();
SELECT public.advisor_open_quote_request_thread(id) FROM public.quote_requests WHERE session_id = pg_temp.id('s1') AND peo_name = 'TriNet';
SELECT pg_temp.is(pg_temp.menu(), '{"quotes":4,"inbox":1}'::jsonb, 's1 stays: its other request still has unread mail (one intake, counted once)');
SELECT pg_temp.inbox_agrees();
SELECT public.advisor_open_quote_request_thread(id) FROM public.quote_requests WHERE session_id = pg_temp.id('s1') AND peo_name = 'Justworks';
SELECT pg_temp.is(pg_temp.menu(), '{"quotes":4,"inbox":0}'::jsonb, 'once every thread is opened the Inbox is empty and the quotes stay');
SELECT pg_temp.inbox_agrees();
-- New mail arrives again.
SELECT pg_temp.as_owner();
INSERT INTO public.quote_request_messages (provider_message_id, quote_request_id, session_id, direction, from_address, recorded_at, firm_id)
SELECT 's2-again', id, session_id, 'received', 'rep@insperity.test', now() + interval '1 second', pg_temp.id('firm_a') FROM public.quote_requests WHERE session_id = pg_temp.id('s2');
SELECT pg_temp.as_user('a1', 'alpha-brokers');
SELECT pg_temp.is(pg_temp.menu(), '{"quotes":4,"inbox":1}'::jsonb, 'a message after the last opening counts again');
SELECT pg_temp.inbox_agrees();

-- ---------- 3. one firm at a time; membership is the lock ----------
-- Catches: a member of two firms seeing both firms' numbers at one firm's address, or another firm's numbers leaking.
SELECT pg_temp.as_user('b1', 'beta-brokers');
SELECT pg_temp.is(pg_temp.menu(), '{"quotes":1,"inbox":1}'::jsonb, 'firm B''s member counts firm B only');
SELECT pg_temp.inbox_agrees();
SELECT pg_temp.as_user('both', 'alpha-brokers');
SELECT pg_temp.is(pg_temp.menu(), '{"quotes":4,"inbox":1}'::jsonb, 'a member of both, at A''s address, counts A only');
SELECT pg_temp.inbox_agrees();
SELECT pg_temp.as_user('both', 'beta-brokers');
SELECT pg_temp.is(pg_temp.menu(), '{"quotes":1,"inbox":1}'::jsonb, 'at B''s address, B only');
SELECT pg_temp.inbox_agrees();
SELECT pg_temp.as_user('both', 'nowhere-brokers');
SELECT pg_temp.is(pg_temp.menu(), '{"quotes":0,"inbox":0}'::jsonb, 'at an address no firm of theirs holds, nothing');
-- Catches: "no firm" answering differently from zero (an error, a null or a missing key) so a caller can tell a firm exists.
SELECT pg_temp.as_user('outsider');
SELECT pg_temp.is(pg_temp.menu(), '{"quotes":0,"inbox":0}'::jsonb, 'the advisor role with no firm: zeros in the same shape');
SELECT pg_temp.as_user('platform_admin', 'alpha-brokers');
SELECT pg_temp.is(pg_temp.menu(), '{"quotes":0,"inbox":0}'::jsonb, 'a platform admin with no support session counts nothing (D-16)');
SELECT pg_temp.as_user('former_a', 'alpha-brokers');
SELECT pg_temp.is(pg_temp.menu(), '{"quotes":0,"inbox":0}'::jsonb, 'a former member who still holds the advisor role counts nothing, as the queue lists nothing');
-- Catches: a caller the console does not let in learning a number.
SELECT pg_temp.as_user('nobody');
SELECT pg_temp.expect($$SELECT public.menu_counts()$$, '42501', 'a person with no role and no firm is refused');
SELECT pg_temp.as_user_with('a1', 'password', 'aal1');
SELECT pg_temp.expect($$SELECT public.menu_counts()$$, '42501', 'a password sign-in that owes its second factor is refused (D-19)');
SELECT pg_temp.as_user_with('a1', 'anonymous', 'aal1', true);
SELECT pg_temp.expect($$SELECT public.menu_counts()$$, '42501', 'a guest session is refused');
SELECT pg_temp.as_signed_out();
SELECT pg_temp.expect($$SELECT public.menu_counts()$$, '42501', 'a signed-out caller can''t call it');

-- ---------- 4. support reads; a closing firm still shows its counts; asking writes nothing ----------
-- Catches: counts hidden from a support session, which reads (ADR 0024).
SELECT pg_temp.as_user('platform_admin');
SELECT 1 FROM public.start_support_session(pg_temp.id('firm_a'), 'looking at the menu counts');
SELECT pg_temp.as_user('platform_admin', 'alpha-brokers');
SELECT pg_temp.is(pg_temp.menu(), '{"quotes":4,"inbox":1}'::jsonb, 'a support session at A''s address sees A''s counts');
SELECT pg_temp.as_user('platform_admin', 'beta-brokers');
SELECT pg_temp.is(pg_temp.menu(), '{"quotes":0,"inbox":0}'::jsonb, 'and nothing at another firm''s address');
-- Catches: a read-only (closing) firm losing its counts: its members still read (ADR 0023).
SELECT pg_temp.as_user('owner_b', 'beta-brokers');
SELECT public.request_firm_closure(pg_temp.id('firm_b'), 'Beta Brokers');
SELECT pg_temp.is(pg_temp.menu(), '{"quotes":1,"inbox":1}'::jsonb, 'a firm that is closing still shows its counts');
-- Catches: the counting function writing (it must stay a read: STABLE, and no row changes).
SELECT pg_temp.as_owner();
SELECT pg_temp.is((SELECT provolatile::text FROM pg_proc WHERE proname = 'menu_counts' AND pronamespace = 'public'::regnamespace), 's', 'menu_counts is declared a read');
CREATE TEMP TABLE before_rows AS SELECT
  (SELECT count(*) FROM public.firm_activity) AS activity, (SELECT count(*) FROM public.quote_request_thread_reads) AS reads;
SELECT pg_temp.as_user('a1', 'alpha-brokers');
SELECT pg_temp.menu();
SELECT pg_temp.as_owner();
SELECT pg_temp.is((SELECT activity FROM before_rows), (SELECT count(*) FROM public.firm_activity), 'asking for counts adds nothing to the firm''s record');
SELECT pg_temp.is((SELECT reads FROM before_rows), (SELECT count(*) FROM public.quote_request_thread_reads), 'and marks no thread read');
-- ---------- 5. an intake the queue hides is not counted either ----------
-- Catches: the menu counting an empty guest draft (anonymous, never certified, nothing in it) that has a sent quote request with unread mail,
-- which the queue hides, so the menu said 3 while the queue's filter said 2. Both counts share the queue's own test for "an intake it shows".
SELECT pg_temp.as_owner();
DO $$
DECLARE
  uid uuid := gen_random_uuid();
  sid uuid;
  q bigint;
BEGIN
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at) VALUES (uid, 'authenticated', 'authenticated', NULL, true, now(), now());
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, '{}') RETURNING id INTO sid;
  UPDATE public.chamber_sessions SET firm_id = pg_temp.id('firm_a') WHERE id = sid;
  INSERT INTO fx VALUES ('ghost', sid);
  SET LOCAL session_replication_role = replica;
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_on) VALUES (sid, 'TriNet', 'sent', current_date) RETURNING id INTO q;
  INSERT INTO public.quote_request_messages (provider_message_id, quote_request_id, session_id, direction, from_address, recorded_at, firm_id)
  VALUES ('ghost-new', q, sid, 'received', 'rep@trinet.test', now() - interval '1 hour', pg_temp.id('firm_a'));
END $$;
SELECT pg_temp.as_user('a1', 'alpha-brokers');
SELECT pg_temp.is(pg_temp.menu(), '{"quotes":4,"inbox":1}'::jsonb, 'the hidden empty draft counts in neither Quotes nor Inbox');
SELECT pg_temp.inbox_agrees();
SELECT pg_temp.is((public.queue_list_submissions('[{"field":"waiting_on_peo","op":"is","value":true}]') ->> 'total')::bigint, 3::bigint, 'and the queue does not list it as waiting on a PEO either');
-- A prospect who then does something with it (a PEO chosen) makes it a real row: the queue shows it, and so do both counts.
SELECT pg_temp.as_owner();
UPDATE public.chamber_sessions SET chosen_peo = 'TriNet' WHERE id = pg_temp.id('ghost');
SELECT pg_temp.as_user('a1', 'alpha-brokers');
SELECT pg_temp.is(pg_temp.menu(), '{"quotes":5,"inbox":2}'::jsonb, 'once the draft holds something, both counts include it');
SELECT pg_temp.inbox_agrees();
SELECT 'menu_counts: all passed' AS result;
