-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh queue_query
-- The queue's query in the database (story CRM-S3.3b; docs/BROKER_CRM_BUILD.md D-38, D-39, D-43, D-44;
-- 20261117100000_queue_query.sql). Two firms: Edgar Allan Advisory ("everyone sees everything") with 58 intakes, enough
-- for two pages of 50, and a second firm that sees by level, whose two agents and owner see only its 3. Proves:
--   1. advisor_list_submissions returns exactly what it returned before the migration, for every argument today's page
--      sends, to every kind of caller (the snapshot is taken before the migration is loaded);
--   2. queue_list_submissions with today's status, action, waiting, sort and search as filters returns the same rows;
--   3. every operator of every kind, with its edges, and the refusals of a filter that isn't one;
--   4. sorting: case ignored, empty values last both ways, stages in pipeline order, stable pages over equal values;
--   5. pages: 50 a page, a page past the end, the total equal to what matches;
--   6. view counts, equal to what the list totals;
--   7. the firm rule through every filter, sort, search and count: the other firm's members, a former member, a
--      platform admin and a member with no firm get none of a firm's rows, and learn nothing of their existence;
--   8. what a caller sends is data or a refusal, never SQL.
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
\i supabase/migrations/20261116210000_console_per_firm.sql
\i supabase/migrations/20261116210500_console_per_firm_fixes.sql
\i supabase/migrations/20261116210600_mailbox_kept_for_members.sql
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

CREATE FUNCTION pg_temp.as_user(n text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', false, 'email', n || '@example.test')::text, false);
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

-- ---------- two firms ----------
-- Firm A is Edgar Allan Advisory (everyone sees everything, D-15); firm B sees by level. agent_a1 and agent_b1 hold the
-- advisor role as Edgar Allan Advisory's people did before firms; agent_a2, agent_b2 and owner_b hold none.
DO $$
DECLARE
  n text;
BEGIN
  FOREACH n IN ARRAY ARRAY['agent_a1', 'agent_a2', 'owner_b', 'agent_b1', 'agent_b2', 'outsider', 'platform_admin', 'former_a', 'nobody'] LOOP
    PERFORM pg_temp.new_user(n);
  END LOOP;
  INSERT INTO fx VALUES ('firm_a', public.default_firm_id()), ('firm_b', gen_random_uuid());
  INSERT INTO public.firms (id, name, address, visibility, approved_at) VALUES (pg_temp.id('firm_b'), 'Beta Brokers', 'beta-brokers', 'by_level', now());
  INSERT INTO public.user_roles (user_id, role) VALUES
    (pg_temp.id('agent_a1'), 'advisor'), (pg_temp.id('agent_b1'), 'advisor'), (pg_temp.id('outsider'), 'advisor'),
    (pg_temp.id('platform_admin'), 'admin'), (pg_temp.id('former_a'), 'advisor');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES
    (pg_temp.id('firm_a'), pg_temp.id('agent_a1'), 'agent'), (pg_temp.id('firm_a'), pg_temp.id('agent_a2'), 'agent'),
    (pg_temp.id('firm_b'), pg_temp.id('owner_b'), 'owner'), (pg_temp.id('firm_b'), pg_temp.id('agent_b1'), 'agent'),
    (pg_temp.id('firm_b'), pg_temp.id('agent_b2'), 'agent');
  INSERT INTO public.firm_memberships (firm_id, user_id, role, valid_from, valid_until)
  VALUES (pg_temp.id('firm_a'), pg_temp.id('former_a'), 'agent', now() - interval '10 days', now() - interval '1 day');

  -- Firm A: five drafts that the filters and sorts below tell apart, one certified intake, and 52 alike ("fillers": the
  -- same employee count, state and dates) so a sort over equal values runs across two pages.
  PERFORM pg_temp.intake('acme_upper', 'firm_a', '{"company_name":"Acme Tools","employee_count":12,"states":["CA","NV"]}');
  PERFORM pg_temp.intake('acme_lower', 'firm_a', '{"company_name":"acme tools","employee_count":12,"states":["NV"]}');
  PERFORM pg_temp.intake('zeta', 'firm_a', '{"company_name":"zeta Labs","employee_count":300,"states":["TX"]}');
  PERFORM pg_temp.intake('beta', 'firm_a', '{"company_name":"Beta & Co %_","states":[]}');
  PERFORM pg_temp.intake('noname', 'firm_a', '{}');
  PERFORM pg_temp.certified('cert_a', 'firm_a', 'Certified Alpha', 'Pat Signer');
  FOR i IN 1..52 LOOP
    PERFORM pg_temp.intake('f' || lpad(i::text, 2, '0'), 'firm_a',
      jsonb_build_object('company_name', 'Filler ' || lpad(i::text, 2, '0'), 'employee_count', 5, 'states', jsonb_build_array('WA')));
  END LOOP;
  -- Firm B: three.
  PERFORM pg_temp.intake('b_acme', 'firm_b', '{"company_name":"Acme West","employee_count":40,"states":["OR"]}');
  PERFORM pg_temp.intake('secret_b', 'firm_b', '{"company_name":"Secret Bravo Corp","employee_count":999,"states":["AK"]}');
  PERFORM pg_temp.certified('cert_b', 'firm_b', 'Certified Bravo', 'Bo Signer');
END $$;

-- Stages, marks, quote requests, mail and dates, written as the superuser with the triggers off so each is exactly as set.
DO $$
DECLARE
  today constant date := (now() AT TIME ZONE 'UTC')::date;
  q bigint;
BEGIN
  SET LOCAL session_replication_role = replica;
  UPDATE public.submission_workflow SET status = 'under_review', needs_action = true, needs_action_note = 'Call the CFO'
  WHERE session_id = pg_temp.id('acme_upper');
  UPDATE public.submission_workflow SET status = 'quoted' WHERE session_id = pg_temp.id('zeta');
  UPDATE public.submission_workflow SET status = 'ready_for_market' WHERE session_id = pg_temp.id('cert_a');
  UPDATE public.submission_workflow SET needs_action = true, needs_action_note = 'B secret note' WHERE session_id = pg_temp.id('secret_b');

  -- Waiting on a PEO: acme_upper since ten days ago; beta with no day recorded (still waiting). An automatic reply is no new mail.
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_version, sent_on)
  VALUES (pg_temp.id('acme_upper'), 'TriNet', 'sent', 1, today - 10) RETURNING id INTO q;
  INSERT INTO public.quote_request_messages (provider_message_id, quote_request_id, session_id, direction, is_automatic, from_address, recorded_at, firm_id)
  VALUES ('m-auto', q, pg_temp.id('acme_upper'), 'received', true, 'auto@trinet.test', now() - interval '1 hour', pg_temp.id('firm_a'));
  -- beta has new PEO mail: a person at the PEO wrote and nobody has opened the thread.
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_on)
  VALUES (pg_temp.id('beta'), 'Justworks', 'sent', NULL) RETURNING id INTO q;
  INSERT INTO public.quote_request_messages (provider_message_id, quote_request_id, session_id, direction, from_address, recorded_at, firm_id)
  VALUES ('m-new', q, pg_temp.id('beta'), 'received', 'rep@justworks.test', now() - interval '1 hour', pg_temp.id('firm_a'));
  -- zeta: quoted, expiring in five days; its mail was opened after it came.
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_version, sent_on, quote_received_on, quote_expires_on)
  VALUES (pg_temp.id('zeta'), 'Insperity', 'quoted', 1, today - 20, today - 2, today + 5) RETURNING id INTO q;
  INSERT INTO public.quote_request_messages (provider_message_id, quote_request_id, session_id, direction, from_address, recorded_at, firm_id)
  VALUES ('m-read', q, pg_temp.id('zeta'), 'received', 'rep@insperity.test', now() - interval '2 days', pg_temp.id('firm_a'));
  INSERT INTO public.quote_request_thread_reads (quote_request_id, last_opened_at, last_opened_by)
  VALUES (q, now() - interval '1 day', pg_temp.id('agent_a1'));
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_on) VALUES (pg_temp.id('zeta'), 'Rippling', 'declined', today - 20);
  -- cert_a: quoted on a version older than its certification, expiring today.
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_version, sent_on, quote_expires_on)
  VALUES (pg_temp.id('cert_a'), 'TriNet', 'quoted', 0, today - 5, today);
  -- secret_b: waiting since three days ago, with new mail.
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_on)
  VALUES (pg_temp.id('secret_b'), 'TriNet', 'sent', today - 3) RETURNING id INTO q;
  INSERT INTO public.quote_request_messages (provider_message_id, quote_request_id, session_id, direction, from_address, recorded_at, firm_id)
  VALUES ('m-secret', q, pg_temp.id('secret_b'), 'received', 'rep@trinet.test', now() - interval '1 hour', pg_temp.id('firm_b'));

  -- Dates. acme_upper was started at 02:30 UTC on 11 March 2026, which is the evening of 10 March in New York; acme_lower at
  -- midnight UTC on 12 March. The fillers share one start and one last change.
  UPDATE public.chamber_sessions SET created_at = '2026-01-15 12:00:00+00', updated_at = '2026-01-20 12:00:00+00'
  WHERE id IN (SELECT id FROM fx WHERE name ~ '^f\d\d$');
  UPDATE public.chamber_sessions SET created_at = '2026-03-11 02:30:00+00', updated_at = now() - interval '1 day' WHERE id = pg_temp.id('acme_upper');
  UPDATE public.chamber_sessions SET created_at = '2026-03-12 00:00:00+00', updated_at = now() - interval '2 days' WHERE id = pg_temp.id('acme_lower');
  UPDATE public.chamber_sessions SET created_at = now() - interval '3 days', updated_at = now() WHERE id = pg_temp.id('zeta');
  UPDATE public.chamber_sessions SET created_at = now() - interval '40 days', updated_at = now() - interval '40 days' WHERE id = pg_temp.id('beta');
  UPDATE public.chamber_sessions SET created_at = '2026-03-10 12:00:00+00', updated_at = '2026-03-10 12:00:00+00' WHERE id = pg_temp.id('noname');
END $$;

-- ---------- 1. Before the migration: what advisor_list_submissions returns today ----------
-- Every argument today's page sends (src/lib/advisorApi.ts listSubmissions), and a few it could, as every kind of caller.
CREATE TEMP TABLE old_calls (label text PRIMARY KEY, args text NOT NULL);
GRANT SELECT ON old_calls TO authenticated, anon;
INSERT INTO old_calls VALUES
  ('page 1', 'NULL, NULL, 25, 0'), ('page 2', 'NULL, NULL, 25, 25'), ('page 3', 'NULL, NULL, 25, 50'), ('page 4', 'NULL, NULL, 25, 75'),
  ('unpaged', 'NULL, NULL, NULL, 0'), ('500', 'NULL, NULL, 500, 0'),
  ('status', '''under_review'', NULL, 25, 0'), ('status quoted', '''quoted'', NULL, 25, 0'),
  ('search', 'NULL, ''acme'', 25, 0'), ('search two words', 'NULL, ''tools acme'', 25, 0'), ('search reference', 'NULL, ''eaa-2026'', 25, 0'),
  ('action', 'NULL, NULL, 25, 0, true'), ('no action', 'NULL, NULL, 25, 0, false'),
  ('waiting', 'NULL, NULL, 25, 0, NULL, true'), ('not waiting', 'NULL, NULL, 25, 0, NULL, false'),
  ('oldest waiting', 'NULL, NULL, 25, 0, NULL, NULL, ''oldest_waiting'''),
  ('earliest expiry', 'NULL, NULL, 25, 0, NULL, NULL, ''earliest_expiry'''),
  ('everything', '''under_review'', ''acme'', 25, 0, true, true, ''oldest_waiting''');

CREATE TEMP TABLE old_out (label text, who text, snap text, PRIMARY KEY (label, who));

CREATE FUNCTION pg_temp.old_call(args text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE out text;
BEGIN
  EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY o), ''[]'')::text FROM public.advisor_list_submissions(' || args || ') WITH ORDINALITY l(session_id, company_name, contact_name, employee_count, pipeline_status, intake_status, signer_name, submitted_at, created_at, updated_at, missing_required, open_fields, flagged_fields, verified_fields, file_id, states, needs_action, needs_action_note, quote_requests_sent, quotes_received, oldest_waiting_on, earliest_quote_expires_on, sent_older_version, new_peo_mail_requests, start_month, total_count, o)'
  INTO out;
  RETURN out;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;

CREATE FUNCTION pg_temp.old_snapshot() RETURNS TABLE (label text, who text, snap text) LANGUAGE plpgsql AS $$
DECLARE
  c record;
  w text;
BEGIN
  FOREACH w IN ARRAY ARRAY['agent_a1', 'agent_a2', 'owner_b', 'agent_b2', 'outsider', 'platform_admin', 'former_a', 'nobody'] LOOP
    PERFORM pg_temp.as_user(w);
    FOR c IN SELECT * FROM old_calls ORDER BY 1 LOOP
      label := c.label; who := w; snap := pg_temp.old_call(c.args);
      RETURN NEXT;
    END LOOP;
  END LOOP;
  PERFORM pg_temp.as_owner();
END $$;

INSERT INTO old_out SELECT * FROM pg_temp.old_snapshot();
SELECT pg_temp.as_owner();
-- The snapshot holds real rows: firm A's 58 on four pages of 25, firm B's 3, and the refusal for a person with no firm.
SELECT pg_temp.is((SELECT jsonb_array_length(snap::jsonb) FROM old_out WHERE label = 'unpaged' AND who = 'agent_a1'), 58, 'setup: firm A''s queue');
SELECT pg_temp.is((SELECT jsonb_array_length(snap::jsonb) FROM old_out WHERE label = 'unpaged' AND who = 'agent_b2'), 3, 'setup: firm B''s queue');
SELECT pg_temp.is((SELECT snap FROM old_out WHERE label = 'page 1' AND who = 'nobody'), '42501', 'setup: a person with no firm is refused');

-- ---------- the migration ----------
\i supabase/migrations/20261117100000_queue_query.sql

-- ---------- 1. ...and after it: exactly the same ----------
DO $$
DECLARE
  d record;
BEGIN
  FOR d IN SELECT b.label, b.who, b.snap AS before, a.snap AS after FROM old_out b JOIN pg_temp.old_snapshot() a USING (label, who) LOOP
    IF d.before IS DISTINCT FROM d.after THEN
      RAISE EXCEPTION 'FAIL: advisor_list_submissions(%) as % changed: % then %', d.label, d.who, left(d.before, 300), left(d.after, 300);
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM old_out) <> 8 * (SELECT count(*) FROM old_calls) THEN RAISE EXCEPTION 'FAIL: the snapshot is short'; END IF;
END $$;
SELECT pg_temp.as_owner();

-- ---------- reading the new call ----------
CREATE FUNCTION pg_temp.q(filters jsonb, sort text DEFAULT NULL, dir text DEFAULT 'asc', page integer DEFAULT 1,
  search text DEFAULT NULL, tz text DEFAULT 'UTC') RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.queue_list_submissions(filters, sort, dir, page, search, tz)
$$;

-- The fx names of a page's rows, in order.
CREATE FUNCTION pg_temp.names(res jsonb) RETURNS text[] LANGUAGE sql AS $$
  SELECT COALESCE(array_agg(COALESCE(fx.name, e.row ->> 'session_id') ORDER BY e.ord), '{}')
  FROM jsonb_array_elements(res -> 'rows') WITH ORDINALITY e(row, ord) LEFT JOIN fx ON fx.id = (e.row ->> 'session_id')::uuid
$$;

-- Every row that matches, across pages, by name in order; the fillers left out (each test says how many there are).
CREATE FUNCTION pg_temp.found(filters jsonb, tz text DEFAULT 'UTC') RETURNS text[] LANGUAGE sql AS $$
  SELECT COALESCE(array_agg(n ORDER BY n), '{}') FROM (
    SELECT unnest(pg_temp.names(pg_temp.q(filters, NULL, 'asc', p, NULL, tz))) n FROM generate_series(1, 3) p
  ) x WHERE n !~ '^f\d\d$'
$$;

CREATE FUNCTION pg_temp.total(filters jsonb, tz text DEFAULT 'UTC') RETURNS bigint LANGUAGE sql AS $$
  SELECT (pg_temp.q(filters, NULL, 'asc', 1, NULL, tz) ->> 'total')::bigint
$$;

-- The fillers, in the order equal values keep: by id, since they share every date.
CREATE FUNCTION pg_temp.fillers() RETURNS text[] LANGUAGE sql AS $$
  SELECT array_agg(name ORDER BY id) FROM fx WHERE name ~ '^f\d\d$'
$$;

-- ---------- 2. Today's arguments, as filters, give today's rows ----------
-- Each pair: the old call's arguments, and the new call's filters and sort. Page 1 of 50 against the old call's first 50,
-- page 2 against its next 50; the rows match field for field (the new row adds has_new_peo_mail and waiting_on_peo) and
-- the total is the old total_count.
CREATE TEMP TABLE same_as_old (old_args text, filters jsonb, sort text, search text);
GRANT SELECT ON same_as_old TO authenticated;
INSERT INTO same_as_old VALUES
  ('NULL, NULL', '[]', NULL, NULL),
  ('''under_review'', NULL', '[{"field":"pipeline_status","op":"any_of","value":["under_review"]}]', NULL, NULL),
  ('''draft'', NULL', '[{"field":"pipeline_status","op":"any_of","value":["draft"]}]', NULL, NULL),
  ('NULL, ''acme''', '[]', NULL, 'acme'),
  ('NULL, ''eaa-2026''', '[]', NULL, 'eaa-2026'),
  ('NULL, NULL, %s, %s, true', '[{"field":"needs_action","op":"is","value":true}]', NULL, NULL),
  ('NULL, NULL, %s, %s, false', '[{"field":"needs_action","op":"is","value":false}]', NULL, NULL),
  ('NULL, NULL, %s, %s, NULL, true', '[{"field":"waiting_on_peo","op":"is","value":true}]', NULL, NULL),
  ('NULL, NULL, %s, %s, NULL, false', '[{"field":"waiting_on_peo","op":"is","value":false}]', NULL, NULL),
  ('NULL, NULL, %s, %s, NULL, NULL, ''oldest_waiting''', '[]', 'oldest_waiting_on', NULL),
  ('NULL, NULL, %s, %s, NULL, NULL, ''earliest_expiry''', '[]', 'earliest_quote_expires_on', NULL);

DO $$
DECLARE
  c record;
  w text;
  p integer;
  args text;
  old_rows jsonb;
  new_res jsonb;
  cases integer := 0;
BEGIN
  FOREACH w IN ARRAY ARRAY['agent_a1', 'agent_a2', 'owner_b', 'agent_b2'] LOOP
    FOR c IN SELECT * FROM same_as_old LOOP
      FOREACH p IN ARRAY ARRAY[1, 2] LOOP
        args := CASE WHEN c.old_args LIKE '%\%s%' THEN replace(replace(c.old_args, '%s, %s', '50, ' || ((p - 1) * 50))::text, '%s', '')
                     ELSE c.old_args || ', 50, ' || ((p - 1) * 50) END;
        PERFORM pg_temp.as_user(w);
        old_rows := pg_temp.old_call(args)::jsonb;
        new_res := pg_temp.q(c.filters, c.sort, 'asc', p, c.search);
        PERFORM pg_temp.as_owner();
        IF (SELECT COALESCE(jsonb_agg(r - 'total_count' - 'o' ORDER BY o), '[]') FROM jsonb_array_elements(old_rows) WITH ORDINALITY x(r, o))
           IS DISTINCT FROM
           (SELECT COALESCE(jsonb_agg(r - 'has_new_peo_mail' - 'waiting_on_peo' ORDER BY o), '[]') FROM jsonb_array_elements(new_res -> 'rows') WITH ORDINALITY x(r, o)) THEN
          RAISE EXCEPTION 'FAIL: as %, the new call with % / sort % / search % (page %) differs from advisor_list_submissions(%)',
            w, c.filters, c.sort, c.search, p, args;
        END IF;
        IF (new_res ->> 'total')::bigint <> COALESCE((old_rows -> 0 ->> 'total_count')::bigint, (new_res ->> 'total')::bigint) THEN
          RAISE EXCEPTION 'FAIL: as %, the total for % is %, the old call''s %', w, c.filters, new_res ->> 'total', old_rows -> 0 ->> 'total_count';
        END IF;
        cases := cases + 1;
      END LOOP;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'queue_query: % comparisons with advisor_list_submissions passed', cases;
END $$;
-- The comparison isn't empty: firm A's second page holds its last 8, and waiting is two of them.
SELECT pg_temp.as_user('agent_a1');
SELECT pg_temp.is(jsonb_array_length(pg_temp.q('[]', NULL, 'asc', 2) -> 'rows'), 8, 'page 2 of firm A holds its last 8');
SELECT pg_temp.is(pg_temp.found('[{"field":"waiting_on_peo","op":"is","value":true}]'), ARRAY['acme_upper', 'beta'],
  'waiting on a PEO: a request sent and not answered, with or without a day (beta''s has none)');

-- ---------- 3. Filters, kind by kind ----------
-- text
SELECT pg_temp.is(pg_temp.found('[{"field":"company_name","op":"contains","value":"ACME"}]'), ARRAY['acme_lower', 'acme_upper'], 'text contains, ignoring case');
SELECT pg_temp.is(pg_temp.found('[{"field":"company_name","op":"contains","value":"  acme "}]'), ARRAY['acme_lower', 'acme_upper'], 'text contains, ignoring surrounding spaces');
SELECT pg_temp.is(pg_temp.found('[{"field":"company_name","op":"contains","value":"%"}]'), ARRAY['beta'], 'a % is a character, not a wildcard');
SELECT pg_temp.is(pg_temp.found('[{"field":"company_name","op":"contains","value":"_"}]'), ARRAY['beta'], 'an _ is a character, not a wildcard');
SELECT pg_temp.is(pg_temp.found('[{"field":"company_name","op":"is","value":"ACME TOOLS"}]'), ARRAY['acme_lower', 'acme_upper'], 'text is, ignoring case');
SELECT pg_temp.is(pg_temp.found('[{"field":"company_name","op":"is","value":"acme"}]'), '{}'::text[], 'text is: the whole value, not a part');
SELECT pg_temp.is(pg_temp.found('[{"field":"company_name","op":"is_empty"}]'), ARRAY['noname'], 'text is empty');
SELECT pg_temp.is(pg_temp.found('[{"field":"company_name","op":"is_empty","value":null}]'), ARRAY['noname'], 'is empty with a null value');
SELECT pg_temp.is(pg_temp.total('[{"field":"contact_name","op":"is_empty"}]'), 57::bigint, 'a contact is empty on every draft (the certified one has its signer)');
SELECT pg_temp.is(pg_temp.found('[{"field":"signer_name","op":"contains","value":"pat"}]'), ARRAY['cert_a'], 'the signer');
SELECT pg_temp.is(pg_temp.found('[{"field":"needs_action_note","op":"contains","value":"cfo"}]'), ARRAY['acme_upper'], 'the note on needs action');
SELECT pg_temp.is(pg_temp.found('[{"field":"file_id","op":"contains","value":"eaa-2026-"}]'), ARRAY['cert_a'], 'the File ID');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"company_name","op":"contains","value":""}]')$$, '22023', 'needs some text', 'contains an empty string is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"company_name","op":"is","value":"   "}]')$$, '22023', 'use is_empty', 'is a blank string is refused, pointing at is_empty');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"company_name","op":"contains"}]')$$, '22023', 'needs some text', 'contains with no value is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"company_name","op":"contains","value":5}]')$$, '22023', 'needs some text', 'contains a number is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"company_name","op":"is_empty","value":"x"}]')$$, '22023', 'takes no value', 'is empty with a value is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q(jsonb_build_array(jsonb_build_object('field', 'company_name', 'op', 'contains', 'value', repeat('a', 201))))$$,
  '22023', 'at most 200', 'more than 200 characters is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"company_name","op":"more_than","value":3}]')$$, '22023', 'A text field can''t be filtered with "more_than"', 'a number operator on text is refused');
-- Empty string against null, at the matcher: both are empty; neither contains or is anything.
SELECT pg_temp.as_owner();
SELECT pg_temp.is(ARRAY[public.workspace_filter_match_text(NULL, '{"op":"is_empty"}'), public.workspace_filter_match_text('', '{"op":"is_empty"}'),
  public.workspace_filter_match_text('  ', '{"op":"is_empty"}'), public.workspace_filter_match_text('x', '{"op":"is_empty"}')],
  ARRAY[true, true, true, false], 'null, an empty string and spaces are empty; text is not');
SELECT pg_temp.is(ARRAY[public.workspace_filter_match_text(NULL, '{"op":"contains","v":"a"}'), public.workspace_filter_match_text(NULL, '{"op":"is","v":"a"}'),
  public.workspace_filter_match_text('', '{"op":"contains","v":"a"}')], ARRAY[false, false, false], 'an empty value contains and is nothing');
SELECT pg_temp.is(public.workspace_filter_match_text('x', '{"op":"unheard_of","v":"x"}'), false, 'an operator the matcher doesn''t know keeps nothing');
SELECT pg_temp.as_user('agent_a1');

-- number
SELECT pg_temp.is(pg_temp.found('[{"field":"employee_count","op":"is","value":12}]'), ARRAY['acme_lower', 'acme_upper'], 'number is');
SELECT pg_temp.is(pg_temp.found('[{"field":"employee_count","op":"more_than","value":12}]'), ARRAY['zeta'], 'number more than (not equal)');
SELECT pg_temp.is(pg_temp.found('[{"field":"employee_count","op":"less_than","value":12}]'), ARRAY['cert_a'], 'number less than (not equal)');
SELECT pg_temp.is(pg_temp.total('[{"field":"employee_count","op":"less_than","value":12}]'), 53::bigint, 'number less than: the certified one and the 52 fillers; no empty one');
SELECT pg_temp.is(pg_temp.found('[{"field":"employee_count","op":"between","value":[300,12]}]'), ARRAY['acme_lower', 'acme_upper', 'zeta'], 'between with its ends swapped, both included');
SELECT pg_temp.is(pg_temp.found('[{"field":"employee_count","op":"between","value":[12,12]}]'), ARRAY['acme_lower', 'acme_upper'], 'between one number and itself');
SELECT pg_temp.is(pg_temp.found('[{"field":"employee_count","op":"between","value":[12.5,299.5]}]'), '{}'::text[], 'between fractions');
SELECT pg_temp.is(pg_temp.found('[{"field":"new_peo_mail_requests","op":"more_than","value":0}]'), ARRAY['beta'], 'quote requests with new PEO mail, counted');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"employee_count","op":"is","value":"12"}]')$$, '22023', 'needs a number', 'a number as text is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"employee_count","op":"between","value":[1]}]')$$, '22023', 'needs two numbers', 'between one number is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"employee_count","op":"between","value":[1,"2"]}]')$$, '22023', 'needs two numbers', 'between a number and text is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"employee_count","op":"is_empty"}]')$$, '22023', 'A number field can''t be filtered with "is_empty"', 'a number has no is empty (CRM-S3.3)');

-- date: a moment is compared as the day it falls on in the caller's time zone
SELECT pg_temp.is(pg_temp.found('[{"field":"created_at","op":"on","value":"2026-03-11"}]'), ARRAY['acme_upper'], 'on a day, in UTC');
SELECT pg_temp.is(pg_temp.found('[{"field":"created_at","op":"on","value":"2026-03-11"}]', 'America/New_York'), ARRAY['acme_lower'],
  'in New York, 02:30 UTC on the 11th is the 10th and midnight UTC on the 12th is the 11th');
SELECT pg_temp.is(pg_temp.found('[{"field":"created_at","op":"on","value":"2026-03-10"}]', 'America/New_York'), ARRAY['acme_upper', 'noname'], 'the evening before, in New York');
SELECT pg_temp.is(pg_temp.found('[{"field":"created_at","op":"on","value":"2026-03-12"}]'), ARRAY['acme_lower'], 'midnight is the start of its day');
SELECT pg_temp.is(pg_temp.found('[{"field":"created_at","op":"before","value":"2026-03-12"}]'), ARRAY['acme_upper', 'noname'], 'before a day: not the day itself, midnight included');
SELECT pg_temp.is(pg_temp.total('[{"field":"created_at","op":"before","value":"2026-03-12"}]'), 54::bigint, 'before: the fillers too');
SELECT pg_temp.is(pg_temp.found('[{"field":"created_at","op":"after","value":"2026-03-11"}]'), ARRAY['acme_lower', 'beta', 'cert_a', 'zeta'], 'after a day: not the day itself');
SELECT pg_temp.is(pg_temp.found('[{"field":"created_at","op":"between","value":["2026-03-12","2026-03-10"]}]'), ARRAY['acme_lower', 'acme_upper', 'noname'],
  'between two days with the ends swapped, both included');
SELECT pg_temp.is(pg_temp.found('[{"field":"created_at","op":"in_last_days","value":3}]'), ARRAY['cert_a', 'zeta'], 'in the last 3 days');
SELECT pg_temp.is(pg_temp.found('[{"field":"created_at","op":"in_last_days","value":2}]'), ARRAY['cert_a'], 'in the last 2 days');
SELECT pg_temp.is(pg_temp.found('[{"field":"created_at","op":"in_last_days","value":0}]'), ARRAY['cert_a'], 'in the last 0 days is today');
SELECT pg_temp.is(pg_temp.found('[{"field":"earliest_quote_expires_on","op":"in_next_days","value":0}]'), ARRAY['cert_a'], 'in the next 0 days is today');
SELECT pg_temp.is(pg_temp.found('[{"field":"earliest_quote_expires_on","op":"in_next_days","value":4}]'), ARRAY['cert_a'], 'in the next 4 days');
SELECT pg_temp.is(pg_temp.found('[{"field":"earliest_quote_expires_on","op":"in_next_days","value":5}]'), ARRAY['cert_a', 'zeta'], 'in the next 5 days');
SELECT pg_temp.is(pg_temp.found('[{"field":"oldest_waiting_on","op":"in_last_days","value":10}]'), ARRAY['acme_upper'], 'a day field: in the last 10 days');
SELECT pg_temp.is(pg_temp.found('[{"field":"oldest_waiting_on","op":"in_last_days","value":9}]'), '{}'::text[], 'in the last 9 days');
SELECT pg_temp.is(pg_temp.found('[{"field":"oldest_waiting_on","op":"in_next_days","value":10}]'), '{}'::text[], 'the next days are not the last');
SELECT pg_temp.is(pg_temp.found('[{"field":"submitted_at","op":"after","value":"2000-01-01"}]'), ARRAY['cert_a'], 'an empty date matches no date operator');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"created_at","op":"on","value":"2026-02-30"}]')$$, '22023', 'doesn''t exist', 'a day that doesn''t exist is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"created_at","op":"on","value":"2026/03/11"}]')$$, '22023', 'YYYY-MM-DD', 'a day written another way is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"created_at","op":"on","value":"2026-03-11T00:00:00Z"}]')$$, '22023', 'YYYY-MM-DD', 'a moment is not a day');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"created_at","op":"on","value":20260311}]')$$, '22023', 'YYYY-MM-DD', 'a number is not a day');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"created_at","op":"between","value":["2026-03-11"]}]')$$, '22023', 'two days', 'between one day is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"created_at","op":"in_last_days","value":-1}]')$$, '22023', 'whole number of days', 'a negative N is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"created_at","op":"in_last_days","value":1.5}]')$$, '22023', 'whole number of days', 'a fraction of a day is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"created_at","op":"in_last_days","value":"3"}]')$$, '22023', 'whole number of days', 'N as text is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"created_at","op":"in_last_days","value":3661}]')$$, '22023', 'whole number of days', 'more than ten years of days is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"created_at","op":"contains","value":"2026"}]')$$, '22023', 'A date field can''t be filtered with "contains"', 'a text operator on a date is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('[]', NULL, 'asc', 1, NULL, 'Mars/Olympus_Mons')$$, '22023', 'Unknown time zone', 'an unknown time zone is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('[]', NULL, 'asc', 1, NULL, 'UTC+5')$$, '22023', 'Unknown time zone', 'an offset that reads backwards (POSIX) is refused');
SELECT pg_temp.is(pg_temp.total('[]', NULL), 58::bigint, 'no time zone is UTC');

-- one choice
SELECT pg_temp.is(pg_temp.found('[{"field":"pipeline_status","op":"any_of","value":["under_review","QUOTED"]}]'), ARRAY['acme_upper', 'zeta'], 'a stage is any of, ignoring case');
SELECT pg_temp.is(pg_temp.found('[{"field":"pipeline_status","op":"none_of","value":["draft"]}]'), ARRAY['acme_upper', 'cert_a', 'zeta'], 'a stage is none of');
SELECT pg_temp.is(pg_temp.found('[{"field":"pipeline_status","op":"is_empty"}]'), '{}'::text[], 'no submission is without a stage');
SELECT pg_temp.is(pg_temp.found('[{"field":"intake_status","op":"any_of","value":["submitted"]}]'), ARRAY['cert_a'], 'the intake''s status');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"pipeline_status","op":"any_of","value":[]}]')$$, '22023', '1 to 100 values', 'an empty any-of list is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"pipeline_status","op":"none_of","value":[]}]')$$, '22023', '1 to 100 values', 'an empty none-of list is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"pipeline_status","op":"any_of","value":["bogus"]}]')$$, '22023', 'isn''t one of the field''s values', 'a stage that doesn''t exist is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"pipeline_status","op":"any_of","value":"draft"}]')$$, '22023', 'list of values', 'one value, not in a list, is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"pipeline_status","op":"any_of","value":[1]}]')$$, '22023', '1 to 200 characters', 'a number in the list is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"pipeline_status","op":"is","value":"draft"}]')$$, '22023', 'A choice field can''t be filtered with "is"', 'is on a choice is refused');
SELECT pg_temp.as_owner();
SELECT pg_temp.is(ARRAY[public.workspace_filter_match_choice(NULL, '{"op":"none_of","vs":["a"]}'), public.workspace_filter_match_choice(NULL, '{"op":"any_of","vs":["a"]}'),
  public.workspace_filter_match_choice('', '{"op":"is_empty"}')], ARRAY[true, false, true], 'an empty choice is none of anything, any of nothing, and empty');
SELECT pg_temp.as_user('agent_a1');

-- several choices
SELECT pg_temp.is(pg_temp.found('[{"field":"states","op":"any_of","value":["nv"]}]'), ARRAY['acme_lower', 'acme_upper'], 'states holds any of, ignoring case');
SELECT pg_temp.is(pg_temp.found('[{"field":"states","op":"any_of","value":["CA","TX"]}]'), ARRAY['acme_upper', 'cert_a', 'zeta'], 'states holds any of two');
SELECT pg_temp.is(pg_temp.found('[{"field":"states","op":"none_of","value":["WA","CA"]}]'), ARRAY['acme_lower', 'beta', 'noname', 'zeta'], 'states holds none of (an empty list holds none)');
SELECT pg_temp.is(pg_temp.found('[{"field":"states","op":"is_empty"}]'), ARRAY['beta', 'noname'], 'states is empty');
SELECT pg_temp.is(pg_temp.total('[{"field":"missing_required","op":"none_of","value":["Something no intake misses"]}]'), 58::bigint, 'missing items: free text');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"states","op":"any_of","value":["ZZ"]}]')$$, '22023', 'state codes', 'a state that doesn''t exist is refused');

-- yes or no
SELECT pg_temp.is(pg_temp.found('[{"field":"needs_action","op":"is","value":true}]'), ARRAY['acme_upper'], 'needs action: yes');
SELECT pg_temp.is(pg_temp.total('[{"field":"needs_action","op":"is","value":false}]'), 57::bigint, 'needs action: no');
SELECT pg_temp.is(pg_temp.found('[{"field":"has_new_peo_mail","op":"is","value":true}]'), ARRAY['beta'],
  'has new PEO mail (D-38): a person at the PEO wrote and no one opened it; an automatic reply and opened mail are not');
SELECT pg_temp.is(pg_temp.total('[{"field":"has_new_peo_mail","op":"is","value":false}]'), 57::bigint, 'has new PEO mail: no');
SELECT pg_temp.is(pg_temp.found('[{"field":"sent_older_version","op":"is","value":true}]'), ARRAY['cert_a'], 'sent an older version');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"needs_action","op":"is","value":"true"}]')$$, '22023', 'true or false', 'yes as text is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"needs_action","op":"is"}]')$$, '22023', 'true or false', 'yes or no with no value is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"needs_action","op":"is_not","value":true}]')$$, '22023', 'A yes_no field can''t be filtered with "is_not"', 'an operator no kind has is refused');

-- person: the shape takes it; the queue has no owner yet (D-15), so it is refused until CRM-A1.1
SELECT pg_temp.as_owner();
SELECT pg_temp.refused($$SELECT public.workspace_filter_check('person', '{"field":"owner","op":"me"}')$$, '0A000', 'CRM-A1.1', 'a "me" filter waits for CRM-A1.1');
SELECT pg_temp.refused($$SELECT public.workspace_filter_check('person', '{"field":"owner","op":"my_team"}')$$, '0A000', 'CRM-A1.1', 'a "my team" filter waits for CRM-A1.1');
SELECT pg_temp.refused($$SELECT public.workspace_filter_check('person', '{"field":"owner","op":"any_of","value":["x"]}')$$, '0A000', 'CRM-A1.1', 'a person filter waits for CRM-A1.1');
SELECT pg_temp.refused($$SELECT public.workspace_filter_check('person', '{"field":"owner","op":"me","value":"x"}')$$, '22023', 'takes no value', '"me" takes no value');
SELECT pg_temp.refused($$SELECT public.workspace_filter_check('colour', '{"field":"x","op":"is"}')$$, '22023', 'No field is of the kind', 'an unknown kind is refused');
SELECT pg_temp.as_user('agent_a1');

-- filters together, and filters that aren't
SELECT pg_temp.is(pg_temp.found('[{"field":"company_name","op":"contains","value":"acme"},{"field":"states","op":"any_of","value":["CA"]}]'), ARRAY['acme_upper'], 'filters combine with and');
SELECT pg_temp.is(pg_temp.total(NULL), 58::bigint, 'no filters is every row');
SELECT pg_temp.is(pg_temp.total('null'), 58::bigint, 'a JSON null is no filters');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"firm_id","op":"is","value":"x"}]')$$, '22023', 'The queue has no field "firm_id"', 'a column not in the list is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"session_id","op":"is","value":"x"}]')$$, '22023', 'no field "session_id"', 'the intake''s id is not a field');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"Company_Name","op":"is","value":"x"}]')$$, '22023', 'no field "Company_Name"', 'a field''s name is exact');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"company_name","op":"like","value":"x"}]')$$, '22023', 'can''t be filtered with "like"', 'an unknown operator is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"company_name","value":"x"}]')$$, '22023', 'names no operator', 'a filter with no operator is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"op":"is","value":"x"}]')$$, '22023', 'names a field', 'a filter with no field is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"company_name","op":"is","values":"x"}]')$$, '22023', 'nothing else', 'a misspelt key is refused, not ignored');
SELECT pg_temp.refused($$SELECT pg_temp.q('["company_name"]')$$, '22023', 'names a field', 'a filter that isn''t an object is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('{"field":"company_name","op":"is_empty"}')$$, '22023', 'Filters are a list', 'filters that aren''t a list are refused');
SELECT pg_temp.refused($$SELECT pg_temp.q((SELECT jsonb_agg('{"field":"company_name","op":"is_empty"}'::jsonb) FROM generate_series(1, 21)))$$, '22023', 'at most 20', 'more than 20 filters are refused');

-- ---------- 4. Sorting ----------
-- By company: case ignored; the two Acmes are equal and keep the queue's order (acme_upper changed last); no name last.
SELECT pg_temp.is(pg_temp.names(pg_temp.q('[]', 'company_name', 'asc', 1)) || pg_temp.names(pg_temp.q('[]', 'company_name', 'asc', 2)),
  ARRAY['acme_upper', 'acme_lower', 'beta', 'cert_a'] || (SELECT array_agg(name ORDER BY name) FROM fx WHERE name ~ '^f\d\d$') || ARRAY['zeta', 'noname'],
  'text sorts ignoring case, an empty one last');
SELECT pg_temp.is(pg_temp.names(pg_temp.q('[]', 'company_name', 'desc', 1)) || pg_temp.names(pg_temp.q('[]', 'company_name', 'desc', 2)),
  ARRAY['zeta'] || (SELECT array_agg(name ORDER BY name DESC) FROM fx WHERE name ~ '^f\d\d$') || ARRAY['cert_a', 'beta', 'acme_upper', 'acme_lower', 'noname'],
  'reversed, the empty one is still last and equal values keep the queue''s order');
-- By headcount: 52 fillers share 5, across both pages, ordered by id; the two without one last, both ways.
SELECT pg_temp.is(pg_temp.names(pg_temp.q('[]', 'employee_count', 'asc', 1)) || pg_temp.names(pg_temp.q('[]', 'employee_count', 'asc', 2)),
  ARRAY['cert_a'] || pg_temp.fillers() || ARRAY['acme_upper', 'acme_lower', 'zeta', 'beta', 'noname'],
  'numbers ascending, equal values by the queue''s order then id, empties last');
SELECT pg_temp.is(pg_temp.names(pg_temp.q('[]', 'employee_count', 'desc', 1)) || pg_temp.names(pg_temp.q('[]', 'employee_count', 'desc', 2)),
  ARRAY['zeta', 'acme_upper', 'acme_lower'] || pg_temp.fillers() || ARRAY['cert_a', 'beta', 'noname'],
  'numbers descending, empties still last');
SELECT pg_temp.is(cardinality(pg_temp.names(pg_temp.q('[]', 'employee_count', 'asc', 1))), 50, 'a page is 50 rows');
SELECT pg_temp.is((SELECT count(DISTINCT n) FROM unnest(pg_temp.names(pg_temp.q('[]', 'employee_count', 'asc', 1)) || pg_temp.names(pg_temp.q('[]', 'employee_count', 'asc', 2))) n),
  58::bigint, 'paging over equal values neither repeats nor skips a row');
-- Moments as moments; days as days.
SELECT pg_temp.is(pg_temp.names(pg_temp.q('[]', 'created_at', 'asc', 1)) || pg_temp.names(pg_temp.q('[]', 'created_at', 'asc', 2)),
  pg_temp.fillers() || ARRAY['noname', 'acme_upper', 'acme_lower', 'beta', 'zeta', 'cert_a'], 'moments sort by time');
SELECT pg_temp.is((pg_temp.names(pg_temp.q('[]', 'earliest_quote_expires_on', 'desc', 1)))[1:2], ARRAY['zeta', 'cert_a'], 'days sort by day, latest first');
SELECT pg_temp.is((pg_temp.names(pg_temp.q('[]', 'oldest_waiting_on', 'desc', 1)))[1], 'acme_upper', 'the one day waited sorts first, descending');
SELECT pg_temp.is((pg_temp.names(pg_temp.q('[]', 'oldest_waiting_on', 'desc', 2)))[8], (pg_temp.fillers())[52], 'empty days after it, in the queue''s order');
-- A stage sorts by where it is in the pipeline, not alphabetically: under review, then ready for market, then quoted.
SELECT pg_temp.is((pg_temp.names(pg_temp.q('[]', 'pipeline_status', 'asc', 2)))[6:8], ARRAY['acme_upper', 'cert_a', 'zeta'], 'stages in pipeline order');
SELECT pg_temp.is((pg_temp.names(pg_temp.q('[]', 'pipeline_status', 'desc', 1)))[1:3], ARRAY['zeta', 'cert_a', 'acme_upper'], 'stages in pipeline order, reversed');
SELECT pg_temp.is((pg_temp.names(pg_temp.q('[]', 'states', 'asc', 1)))[1:2], ARRAY['cert_a', 'acme_upper'], 'a list of values by its text (CA before CA, NV)');
SELECT pg_temp.is((pg_temp.names(pg_temp.q('[]', 'states', 'desc', 2)))[7:8], ARRAY['beta', 'noname'], 'an empty list last, descending');
SELECT pg_temp.is((pg_temp.names(pg_temp.q('[]', 'has_new_peo_mail', 'desc', 1)))[1], 'beta', 'yes first, descending');
SELECT pg_temp.is(pg_temp.names(pg_temp.q('[]', NULL, 'asc', 1)), pg_temp.names(pg_temp.q('[]', NULL, 'desc', 1)), 'no sort is the queue''s own order');
SELECT pg_temp.refused($$SELECT pg_temp.q('[]', 'firm_id')$$, '22023', 'The queue has no field "firm_id" to sort by', 'a sort column not in the list is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('[]', 'company_name', 'up')$$, '22023', 'asc or desc', 'a direction that isn''t asc or desc is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('[]', 'company_name', NULL)$$, '22023', 'asc or desc', 'no direction is refused');

-- ---------- 5. Pages ----------
SELECT pg_temp.is(pg_temp.q('[]', NULL, 'asc', 3) - 'rows', '{"total":58,"page":3,"page_size":50}'::jsonb, 'a page past the end has no rows and the total');
SELECT pg_temp.is(pg_temp.q('[]', NULL, 'asc', 3) -> 'rows', '[]'::jsonb, 'a page past the end has no rows');
SELECT pg_temp.is(pg_temp.q('[{"field":"company_name","op":"contains","value":"filler"}]', NULL, 'asc', 2) ->> 'total', '52', 'the total is what matches');
SELECT pg_temp.is(jsonb_array_length(pg_temp.q('[{"field":"company_name","op":"contains","value":"filler"}]', NULL, 'asc', 2) -> 'rows'), 2, 'and its last page holds the rest');
SELECT pg_temp.is(pg_temp.q('[]', NULL, 'asc', NULL) ->> 'page', '1', 'no page is the first');
SELECT pg_temp.refused($$SELECT pg_temp.q('[]', NULL, 'asc', 0)$$, '22023', 'page number', 'page 0 is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('[]', NULL, 'asc', -1)$$, '22023', 'page number', 'a negative page is refused');
SELECT pg_temp.refused($$SELECT pg_temp.q('[]', NULL, 'asc', 2147483647)$$, '22023', 'page number', 'a page too far to count is refused');
-- A row carries every column of today's queue row and the two marks.
SELECT pg_temp.is((SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(pg_temp.q('[{"field":"company_name","op":"is","value":"zeta labs"}]') -> 'rows' -> 0) k),
  ARRAY['company_name', 'contact_name', 'created_at', 'earliest_quote_expires_on', 'employee_count', 'file_id', 'flagged_fields', 'has_new_peo_mail',
        'intake_status', 'missing_required', 'needs_action', 'needs_action_note', 'new_peo_mail_requests', 'oldest_waiting_on', 'open_fields',
        'pipeline_status', 'quote_requests_sent', 'quotes_received', 'sent_older_version', 'session_id', 'signer_name', 'start_month', 'states',
        'submitted_at', 'updated_at', 'verified_fields', 'waiting_on_peo'], 'a row''s fields');

-- ---------- 6. View counts ----------
SELECT pg_temp.is((SELECT array_agg(view_name || '=' || total ORDER BY o) FROM public.queue_view_counts(
  '[{"name":"All","filters":[]},{"name":"Needs action","filters":[{"field":"needs_action","op":"is","value":true}]},
    {"name":"Inbox","filters":[{"field":"has_new_peo_mail","op":"is","value":true}]},
    {"name":"Waiting","filters":[{"field":"waiting_on_peo","op":"is","value":true}]},
    {"name":"Acme in CA","filters":[{"field":"company_name","op":"contains","value":"acme"},{"field":"states","op":"any_of","value":["CA"]}]},
    {"name":"No filters key"}]') WITH ORDINALITY x(view_name, total, o)),
  ARRAY['All=58', 'Needs action=1', 'Inbox=1', 'Waiting=2', 'Acme in CA=1', 'No filters key=58'], 'each view''s count, in the order asked');
SELECT pg_temp.is((SELECT array_agg(total ORDER BY view_name) FROM public.queue_view_counts('[{"name":"All","filters":[]},{"name":"Drafts","filters":[{"field":"pipeline_status","op":"any_of","value":["draft"]}]}]', 'acme')),
  ARRAY[2::bigint, 1::bigint], 'counts under the search');
-- Each count is what the list totals for the same filters.
DO $$
DECLARE
  f jsonb;
BEGIN
  FOR f IN SELECT unnest(ARRAY['[]', '[{"field":"employee_count","op":"less_than","value":12}]', '[{"field":"created_at","op":"before","value":"2026-03-12"}]',
                               '[{"field":"states","op":"none_of","value":["WA"]}]', '[{"field":"contact_name","op":"is_empty"}]']::jsonb[]) LOOP
    IF (SELECT total FROM public.queue_view_counts(jsonb_build_array(jsonb_build_object('name', 'v', 'filters', f)))) <> pg_temp.total(f) THEN
      RAISE EXCEPTION 'FAIL: the count of % isn''t the list''s total', f;
    END IF;
  END LOOP;
END $$;
SELECT pg_temp.refused($$SELECT * FROM public.queue_view_counts('[]')$$, '22023', '1 to 20', 'no views is refused');
SELECT pg_temp.refused($$SELECT * FROM public.queue_view_counts((SELECT jsonb_agg(jsonb_build_object('name', 'v' || i)) FROM generate_series(1, 21) i))$$, '22023', '1 to 20', 'more than 20 views are refused');
SELECT pg_temp.refused($$SELECT * FROM public.queue_view_counts('[{"name":"A"},{"name":"A"}]')$$, '22023', 'Two views are named "A"', 'two views with one name are refused');
SELECT pg_temp.refused($$SELECT * FROM public.queue_view_counts('[{"name":""}]')$$, '22023', '1 to 100 characters', 'a view with no name is refused');
SELECT pg_temp.refused($$SELECT * FROM public.queue_view_counts('[{"name":"A","filter":[]}]')$$, '22023', 'a name and its filters', 'a misspelt key in a view is refused');
SELECT pg_temp.refused($$SELECT * FROM public.queue_view_counts('[{"name":"Bad","filters":[{"field":"firm_id","op":"is","value":"x"}]}]')$$, '22023',
  'View "Bad": The queue has no field "firm_id"', 'a bad filter refuses the call, naming the view');
SELECT pg_temp.refused($$SELECT * FROM public.queue_view_counts('[{"name":"A"}]', NULL, 'Nowhere/Here')$$, '22023', 'Unknown time zone', 'counts refuse an unknown time zone');

-- ---------- 7. The firm rule ----------
-- Firm B's people see firm B's three, whatever they filter, sort, search or count; an agent of a firm that sees by level
-- sees what today's queue shows them (submissions have no owner yet, D-15).
CREATE TEMP TABLE probes (filters jsonb);
GRANT SELECT ON probes TO authenticated;
INSERT INTO probes VALUES ('[]'), ('[{"field":"company_name","op":"contains","value":"acme"}]'), ('[{"field":"company_name","op":"is","value":"zeta labs"}]'),
  ('[{"field":"company_name","op":"is_empty"}]'), ('[{"field":"states","op":"any_of","value":["NV","TX","WA"]}]'), ('[{"field":"employee_count","op":"is","value":12}]'),
  ('[{"field":"needs_action","op":"is","value":true}]'), ('[{"field":"has_new_peo_mail","op":"is","value":true}]'),
  ('[{"field":"created_at","op":"on","value":"2026-03-11"}]'), ('[{"field":"pipeline_status","op":"any_of","value":["quoted","under_review"]}]'),
  ('[{"field":"waiting_on_peo","op":"is","value":true}]'), ('[{"field":"employee_count","op":"more_than","value":0}]');

DO $$
DECLARE
  w text;
  p jsonb;
  s text;
  res jsonb;
  mine uuid[];
  got uuid[];
  cases integer := 0;
BEGIN
  FOREACH w IN ARRAY ARRAY['owner_b', 'agent_b1', 'agent_b2', 'agent_a1', 'agent_a2', 'outsider', 'platform_admin', 'former_a'] LOOP
    PERFORM pg_temp.as_owner();
    mine := CASE WHEN w IN ('owner_b', 'agent_b1', 'agent_b2') THEN ARRAY[pg_temp.id('b_acme'), pg_temp.id('secret_b'), pg_temp.id('cert_b')]
                 WHEN w IN ('agent_a1', 'agent_a2') THEN ARRAY(SELECT s.id FROM public.chamber_sessions s WHERE s.firm_id = pg_temp.id('firm_a'))
                 ELSE '{}' END;
    PERFORM pg_temp.as_user(w);
    FOR p IN SELECT filters FROM probes LOOP
      FOR s IN SELECT unnest(ARRAY[NULL, 'company_name', 'employee_count', 'created_at', 'states', 'has_new_peo_mail']) LOOP
        FOR res IN SELECT pg_temp.q(p, s, 'asc', 1, NULL) UNION ALL SELECT pg_temp.q(p, s, 'desc', 2, NULL)
                   UNION ALL SELECT pg_temp.q(p, s, 'asc', 1, srch) FROM unnest(ARRAY['acme', 'zeta', 'eaa']) srch WHERE s IS NULL LOOP
          SELECT array_agg((r ->> 'session_id')::uuid) INTO got FROM jsonb_array_elements(res -> 'rows') r;
          IF NOT COALESCE(got, '{}') <@ mine THEN
            RAISE EXCEPTION 'FAIL: % filtering % sorted by % got a row of another firm', w, p, s;
          END IF;
          cases := cases + 1;
        END LOOP;
      END LOOP;
      IF (SELECT total FROM public.queue_view_counts(jsonb_build_array(jsonb_build_object('name', 'v', 'filters', p)))) <> (pg_temp.q(p) ->> 'total')::bigint THEN
        RAISE EXCEPTION 'FAIL: % counts % differently from what they list', w, p;
      END IF;
    END LOOP;
  END LOOP;
  PERFORM pg_temp.as_owner();
  RAISE NOTICE 'queue_query: % firm-rule cases passed', cases;
END $$;

-- The exact answers, each firm to the other.
SELECT pg_temp.as_user('owner_b');
SELECT pg_temp.is(pg_temp.found('[]'), ARRAY['b_acme', 'cert_b', 'secret_b'], 'firm B''s owner lists firm B''s three');
SELECT pg_temp.is(pg_temp.q('[{"field":"company_name","op":"is","value":"zeta labs"}]'), pg_temp.q('[{"field":"company_name","op":"is","value":"nothing at all"}]'),
  'a filter that matches only firm A''s row answers as one that matches nothing');
SELECT pg_temp.is(pg_temp.q('[]', NULL, 'asc', 1, 'zeta'), pg_temp.q('[]', NULL, 'asc', 1, 'nothing at all'), 'so does a search');
SELECT pg_temp.is(pg_temp.found('[{"field":"company_name","op":"contains","value":"acme"}]'), ARRAY['b_acme'], 'acme is firm B''s own Acme West only');
SELECT pg_temp.is(pg_temp.found('[{"field":"has_new_peo_mail","op":"is","value":true}]'), ARRAY['secret_b'], 'firm B''s Inbox is its own new mail');
SELECT pg_temp.is((SELECT array_agg(view_name || '=' || total) FROM public.queue_view_counts('[{"name":"All"},{"name":"Zeta","filters":[{"field":"company_name","op":"is","value":"zeta labs"}]},{"name":"Acme","filters":[{"field":"company_name","op":"contains","value":"acme"}]}]')),
  ARRAY['All=3', 'Zeta=0', 'Acme=1'], 'firm B''s counts are of firm B');
-- A refusal reads the filter, never a row: the same message whichever firm asks.
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"pipeline_status","op":"any_of","value":["bogus"]}]')$$, '22023', 'isn''t one of the field''s values', 'firm B is refused as firm A is');
SELECT pg_temp.as_user('agent_b2');
SELECT pg_temp.is(pg_temp.found('[]'), ARRAY['b_acme', 'cert_b', 'secret_b'], 'a second agent of a by-level firm sees what today''s queue shows them');
SELECT pg_temp.as_user('agent_a1');
SELECT pg_temp.is(pg_temp.found('[{"field":"company_name","op":"contains","value":"secret"}]'), '{}'::text[], 'firm A sees nothing of firm B''s');
SELECT pg_temp.is(pg_temp.found('[{"field":"needs_action_note","op":"contains","value":"b secret"}]'), '{}'::text[], 'not even through a note');
SELECT pg_temp.is((SELECT total FROM public.queue_view_counts('[{"name":"Big","filters":[{"field":"employee_count","op":"more_than","value":900}]}]')), 0::bigint, 'nor through a count');
SELECT pg_temp.as_user('agent_a2');
SELECT pg_temp.is(pg_temp.total('[]'), 58::bigint, 'a member with no platform role lists their firm''s');

-- People with no firm get nothing; people who aren't members are refused, as by today's queue.
SELECT pg_temp.as_user('outsider');
SELECT pg_temp.is(pg_temp.q('[]'), '{"rows":[],"total":0,"page":1,"page_size":50}'::jsonb, 'the advisor role without a firm lists nothing');
SELECT pg_temp.is((SELECT total FROM public.queue_view_counts('[{"name":"All"}]')), 0::bigint, 'and counts nothing');
SELECT pg_temp.as_user('platform_admin');
SELECT pg_temp.is(pg_temp.total('[]'), 0::bigint, 'a platform admin who belongs to no firm lists nothing (D-16)');
SELECT pg_temp.as_user('former_a');
SELECT pg_temp.is(pg_temp.total('[]'), 0::bigint, 'a former member lists nothing');
SELECT pg_temp.as_user('nobody');
SELECT pg_temp.expect($$SELECT public.queue_list_submissions()$$, '42501', 'a person with no role and no firm is refused the list');
SELECT pg_temp.expect($$SELECT * FROM public.queue_view_counts('[{"name":"All"}]')$$, '42501', 'and the counts');
-- Refused before anything it sent is read: a caller who isn't let in learns nothing, not even whether a filter would be taken.
SELECT pg_temp.expect($$SELECT public.queue_list_submissions('[{"field":"firm_id","op":"is","value":"x"}]')$$, '42501', 'the list refuses an outsider before reading the filters');
SELECT pg_temp.expect($$SELECT * FROM public.queue_view_counts('[{"name":"Bad","filters":[{"field":"firm_id","op":"is","value":"x"}]}]')$$, '42501', 'so do the counts');
SELECT pg_temp.as_user_with('agent_a2', 'password', 'aal1');
SELECT pg_temp.expect($$SELECT public.queue_list_submissions()$$, '42501', 'a password sign-in that owes its second factor is refused (D-19)');
SELECT pg_temp.expect($$SELECT * FROM public.queue_view_counts('[{"name":"All"}]')$$, '42501', 'and its counts');
SELECT pg_temp.as_user_with('agent_a1', 'anonymous', 'aal1', true);
SELECT pg_temp.expect($$SELECT public.queue_list_submissions()$$, '42501', 'a guest session is refused');
SELECT pg_temp.as_signed_out();
SELECT pg_temp.expect($$SELECT public.queue_list_submissions()$$, '42501', 'a signed-out caller can''t call the list');
SELECT pg_temp.expect($$SELECT * FROM public.queue_view_counts('[{"name":"All"}]')$$, '42501', 'or the counts');
-- The helpers are the two functions' alone.
SELECT pg_temp.as_user('agent_a1');
SELECT pg_temp.expect($$SELECT * FROM public.queue_rows(NULL)$$, '42501', 'a member can''t read the unfiltered rows directly');
SELECT pg_temp.expect($$SELECT public.workspace_filter_check('text', '{"field":"x","op":"is_empty"}')$$, '42501', 'or call a filter helper');

-- ---------- 8. What a caller sends is data, never SQL ----------
SELECT pg_temp.as_owner();
CREATE TEMP TABLE before_injection AS SELECT count(*) AS n FROM public.chamber_sessions;
SELECT pg_temp.as_user('agent_a1');
SELECT pg_temp.is(pg_temp.total($$[{"field":"company_name","op":"contains","value":"'); DROP TABLE public.chamber_sessions; --"}]$$), 0::bigint, 'a value is text to look for');
SELECT pg_temp.is(pg_temp.total($$[{"field":"company_name","op":"is","value":"x' OR '1'='1"}]$$), 0::bigint, 'a value can''t widen the filter');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"company_name''); DROP TABLE public.chamber_sessions; --","op":"is_empty"}]')$$, '22023', 'The queue has no field', 'a field is a name from the list');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"company_name","op":"is_empty OR true"}]')$$, '22023', 'can''t be filtered with', 'an operator is a name from the list');
SELECT pg_temp.refused($$SELECT pg_temp.q('[{"field":"states","op":"any_of","value":["CA'' OR ''1''=''1"]}]')$$, '22023', 'state codes', 'a choice is a value from the list');
SELECT pg_temp.refused($$SELECT pg_temp.q('[]', 'company_name; DROP TABLE public.chamber_sessions', 'asc')$$, '22023', 'to sort by', 'a sort is a name from the list');
SELECT pg_temp.refused($$SELECT pg_temp.q('[]', 'company_name', 'asc; DROP TABLE public.chamber_sessions')$$, '22023', 'asc or desc', 'a direction is asc or desc');
SELECT pg_temp.refused($$SELECT pg_temp.q('[]', NULL, 'asc', 1, NULL, 'UTC''; DROP TABLE public.chamber_sessions; --')$$, '22023', 'Unknown time zone', 'a time zone is a name');
SELECT pg_temp.is(pg_temp.total('[]') , 58::bigint, 'setup: firm A still lists 58');
SELECT pg_temp.is((pg_temp.q('[]', NULL, 'asc', 1, $$'); DROP TABLE public.chamber_sessions; --$$) ->> 'total')::bigint, 0::bigint, 'a search is words to look for');
SELECT pg_temp.is((SELECT view_name FROM public.queue_view_counts($$[{"name":"x'); DROP TABLE public.chamber_sessions; --"}]$$)),
  $$x'); DROP TABLE public.chamber_sessions; --$$, 'a view''s name comes back as it was sent');
SELECT pg_temp.as_owner();
SELECT pg_temp.is((SELECT count(*) FROM public.chamber_sessions), (SELECT n FROM before_injection), 'every intake is still there');

\echo queue_query: ok
