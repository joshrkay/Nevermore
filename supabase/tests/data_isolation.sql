-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then EVERY migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh data_isolation
--
-- Authorization and data isolation (US-6.3; docs/SECURITY_REVIEW.md). Every caller the product has reads and
-- writes every kind of data it stores, with row security, grants and triggers exactly as the migrations leave
-- them:
--   signed_out        no token (the `anon` role)
--   guest_a, guest_b  anonymous-auth guests, each with their own intakes and files
--   prospect_a/_b     email-verified prospects, each with a certified intake and a draft
--   advisor, admin    hold a role; own no intake
--   advisor_as_guest  the advisor's account presenting a guest token (must count as a guest)
--   service           the service role (what the scheduled jobs and edge functions use)
--
-- 1. The matrix: how many rows of each table and bucket each caller can see, exactly.
-- 2. Guests and prospects against someone else's intake: by its id, with their own token or none, nothing
--    reads, changes, deletes or attaches to it. The owner can (positive controls, rolled back).
-- 3. Closed intakes: the owner can't see an archived or revoked one or its files, and can read but not
--    change an expired one.
-- 4. Prospects against advisor records and functions; advisors against admin-only, service-only and
--    prospect-owned data.
-- 5. Catalogue checks, so the matrix can't fall behind the schema: every public table has row security and
--    a row in the matrix; every function the API roles can execute is in the allowlist below with a reason;
--    every bucket is private; the API roles hold no TRUNCATE, REFERENCES or TRIGGER; every SECURITY DEFINER
--    function pins its search_path.
--
-- When you add a migration, add it to the list below and bump the count after it. When you add a table,
-- bucket or API-callable function, the catalogue checks fail until you add it to the matrix or allowlist.
\set ON_ERROR_STOP 1
\set migration_files `ls supabase/migrations/*.sql | wc -l | tr -d ' '`
\set migrations_loaded `grep -c '^.i supabase/migrations/' supabase/tests/data_isolation.sql`
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
SET client_min_messages = notice;

-- The list above is every migration: a new one that isn't loaded here would go untested, so the number of
-- files in supabase/migrations must equal the number of lines above that load one.
SELECT set_config('test.migration_files', :'migration_files', false) \gset
SELECT set_config('test.migrations_loaded', :'migrations_loaded', false) \gset
DO $$
BEGIN
  IF current_setting('test.migration_files') <> current_setting('test.migrations_loaded') THEN
    RAISE EXCEPTION 'FAIL: supabase/migrations holds % files but data_isolation.sql loads %; add the new ones to its list',
      current_setting('test.migration_files'), current_setting('test.migrations_loaded');
  END IF;
END $$;

-- ---------- helpers ----------

CREATE TEMP TABLE fx (name text PRIMARY KEY, id uuid NOT NULL);
GRANT SELECT ON fx TO anon, authenticated, service_role;

CREATE FUNCTION pg_temp.id(n text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM fx WHERE name = n $$;

-- Superuser only: an account as GoTrue would create it (handle_new_user gives it a profile).
CREATE FUNCTION pg_temp.new_user(email text, guest boolean) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', email, guest, now(), now());
  RETURN uid;
END $$;

-- Act as one of the callers above until the next become() or the end of the transaction.
CREATE FUNCTION pg_temp.become(who text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  uid uuid;
  guest boolean;
BEGIN
  RESET ROLE;
  IF who = 'signed_out' THEN
    PERFORM set_config('request.jwt.claims', '', false);
    SET LOCAL ROLE anon;
    RETURN;
  END IF;
  IF who = 'service' THEN
    PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', false);
    SET LOCAL ROLE service_role;
    RETURN;
  END IF;
  uid := pg_temp.id(CASE WHEN who = 'advisor_as_guest' THEN 'advisor' ELSE who END);
  IF uid IS NULL THEN RAISE EXCEPTION 'unknown caller %', who; END IF;
  guest := who IN ('guest_a', 'guest_b', 'advisor_as_guest');
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', uid, 'role', 'authenticated', 'is_anonymous', guest,
      'email', CASE WHEN guest THEN NULL ELSE who || '@example.test' END)::text, false);
  SET LOCAL ROLE authenticated;
END $$;

-- Rows the caller can see. A table the caller may not read at all counts as none.
CREATE FUNCTION pg_temp.visible(src text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE format('SELECT count(*) FROM %s', src) INTO n;
  RETURN n;
EXCEPTION WHEN insufficient_privilege THEN RETURN 0;
END $$;

-- Runs stmt and always rolls it back. 'rows:<n>' for the rows it touched (1 for a SELECT of one value), or
-- the SQLSTATE it raised.
CREATE FUNCTION pg_temp.attempt(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  n bigint;
  s text;
  m text;
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

-- stmt changes nothing: it is refused, or matches no row the caller may touch.
CREATE FUNCTION pg_temp.changes_nothing(stmt text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r text := pg_temp.attempt(stmt);
BEGIN
  IF r LIKE 'rows:%' AND r <> 'rows:0' THEN RAISE EXCEPTION 'FAIL: % (% touched)', label, r; END IF;
END $$;

-- stmt is refused (any error), not merely matched to no row.
CREATE FUNCTION pg_temp.refused(stmt text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r text := pg_temp.attempt(stmt);
BEGIN
  IF r LIKE 'rows:%' THEN RAISE EXCEPTION 'FAIL: % was not refused (%)', label, r; END IF;
END $$;

CREATE FUNCTION pg_temp.expect(stmt text, expected text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r text := pg_temp.attempt(stmt);
BEGIN
  IF r IS DISTINCT FROM expected THEN RAISE EXCEPTION 'FAIL: % gave %, expected %', label, r, expected; END IF;
END $$;

-- A file as document-upload stores it: with the service role (prospects can't store files themselves since
-- 20261104130000_document_scanning.sql), then back to whoever was acting.
CREATE FUNCTION pg_temp.store_file(bucket text, path text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  claims text := current_setting('request.jwt.claims', true);
  acting text := current_user;
BEGIN
  RESET ROLE;
  INSERT INTO storage.objects (bucket_id, name) VALUES (bucket, path);
  IF acting <> session_user THEN
    EXECUTE format('SET LOCAL ROLE %I', acting);
    PERFORM set_config('request.jwt.claims', claims, false);
  END IF;
END $$;

-- The callers that must never reach someone else's intake.
CREATE FUNCTION pg_temp.outsiders(owner text) RETURNS SETOF text LANGUAGE sql AS $$
  SELECT c FROM unnest(ARRAY['signed_out', 'guest_a', 'guest_b', 'prospect_a', 'prospect_b', 'advisor_as_guest']) c WHERE c <> owner
$$;

-- ---------- data for everyone to protect ----------
DO $$
DECLARE
  ga uuid := pg_temp.new_user(NULL, true);
  gb uuid := pg_temp.new_user(NULL, true);
  pa uuid := pg_temp.new_user('prospect_a@example.test', false);
  pb uuid := pg_temp.new_user('prospect_b@example.test', false);
  adv uuid := pg_temp.new_user('advisor@example.test', false);
  adm uuid := pg_temp.new_user('admin@example.test', false);
  ready constant text := '{"company_name":"%s","states":["CA"],"pay_frequency":"Bi-weekly","employee_count":3}';
  ga_open uuid; ga_expired uuid; ga_archived uuid; ga_revoked uuid;
  gb_open uuid; pa_cert uuid; pa_open uuid; pb_cert uuid; pb_open uuid;
  who text;
  latest bigint;
  r text;
BEGIN
  INSERT INTO fx VALUES ('guest_a', ga), ('guest_b', gb), ('prospect_a', pa), ('prospect_b', pb), ('advisor', adv), ('admin', adm);
  INSERT INTO public.user_roles (user_id, role) VALUES (adv, 'advisor'), (adm, 'admin');

  -- Everyone who starts an intake agrees first, from the browser.
  FOREACH who IN ARRAY ARRAY['guest_a', 'guest_b', 'prospect_a', 'prospect_b'] LOOP
    PERFORM pg_temp.become(who);
    PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');
  END LOOP;

  -- Guest A: an open draft with a conversation and a file, and three that will close, each with a file.
  -- A person has one open draft at a time (20261104102000_one_open_draft.sql), so each intake below is
  -- started from the browser once the one before it is closed or certified.

  -- Guest A: three drafts that close the three ways a draft closes (two with a file), then an open draft
  -- with a conversation and a file.
  PERFORM pg_temp.become('guest_a');
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (ga, '{"company_name":"Guest A Expired"}') RETURNING id INTO ga_expired;
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, category)
  VALUES (ga, ga_expired, 'payroll.pdf', '1 KB', ga || '/' || ga_expired || '/payroll.pdf', 'payroll_report');
  PERFORM pg_temp.store_file('documents', ga || '/' || ga_expired || '/payroll.pdf');
  RESET ROLE;
  UPDATE public.chamber_sessions SET last_activity_at = now() - interval '40 days' WHERE id = ga_expired;
  PERFORM pg_temp.become('service');
  IF public.expire_idle_intakes() <> 1 THEN RAISE EXCEPTION 'setup: expected exactly one draft to expire'; END IF;

  PERFORM pg_temp.become('guest_a');
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (ga, '{"company_name":"Guest A Archived"}') RETURNING id INTO ga_archived;
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, category)
  VALUES (ga, ga_archived, 'loss-runs.pdf', '1 KB', ga || '/' || ga_archived || '/loss-runs.pdf', 'workers_comp_loss_runs');
  PERFORM pg_temp.store_file('documents', ga || '/' || ga_archived || '/loss-runs.pdf');
  IF public.archive_chamber_session(ga_archived) <> 'archived' THEN RAISE EXCEPTION 'setup: archive failed'; END IF;

  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (ga, '{"company_name":"Guest A Revoked"}') RETURNING id INTO ga_revoked;
  PERFORM pg_temp.become('admin');
  IF public.revoke_chamber_session(ga_revoked, 'Shared by mistake') <> 'revoked' THEN RAISE EXCEPTION 'setup: revoke failed'; END IF;

  PERFORM pg_temp.become('guest_a');
  INSERT INTO public.chamber_sessions (user_id, chamber_data, transcript, field_provenance)
  VALUES (ga, '{"company_name":"Guest A Co"}',
          '[{"id":"m1","sender":"user","text":"We have 12 staff in Fresno"}]',
          '{"company_name":{"status":"confirmed","source":"transcript"}}')
  RETURNING id INTO ga_open;
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, category)
  VALUES (ga, ga_open, 'census.csv', '1 KB', ga || '/' || ga_open || '/census.csv', 'employee_census');
  PERFORM pg_temp.store_file('documents', ga || '/' || ga_open || '/census.csv');

  -- Guest B: one open draft with a file.
  PERFORM pg_temp.become('guest_b');
  INSERT INTO public.chamber_sessions (user_id, chamber_data, transcript)
  VALUES (gb, '{"company_name":"Guest B Co"}', '[{"id":"m1","sender":"user","text":"Our census is attached"}]')
  RETURNING id INTO gb_open;
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path)
  VALUES (gb, gb_open, 'roster.xlsx', '1 KB', gb || '/' || gb_open || '/roster.xlsx');
  PERFORM pg_temp.store_file('documents', gb || '/' || gb_open || '/roster.xlsx');

  -- Prospects A and B each certify one intake from the browser, then keep a draft; A's certified one has a file.
  PERFORM pg_temp.become('prospect_a');
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (pa, format(ready, 'Prospect A Co')::jsonb) RETURNING id INTO pa_cert;
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path)
  VALUES (pa, pa_cert, 'benefits.pdf', '1 KB', pa || '/' || pa_cert || '/benefits.pdf');
  PERFORM pg_temp.store_file('documents', pa || '/' || pa_cert || '/benefits.pdf');
  UPDATE public.chamber_sessions
  SET status = 'submitted',
      submission = jsonb_build_object('signer_name', 'Pat A', 'signer_title', 'CEO', 'signed_at', '2026-11-01T12:00:00Z',
        'file_id', 'EAA-2026-AAAAAAAA', 'consent_version', 'v1', 'consent_text', 'I certify.', 'chamber_data', chamber_data)
  WHERE id = pa_cert;
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (pa, '{"company_name":"Prospect A Draft"}') RETURNING id INTO pa_open;

  PERFORM pg_temp.become('prospect_b');
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (pb, format(ready, 'Prospect B Co')::jsonb) RETURNING id INTO pb_cert;
  UPDATE public.chamber_sessions
  SET status = 'submitted',
      submission = jsonb_build_object('signer_name', 'Bo B', 'signer_title', 'COO', 'signed_at', '2026-11-01T12:00:00Z',
        'file_id', 'EAA-2026-BBBBBBBB', 'consent_version', 'v1', 'consent_text', 'I certify.', 'chamber_data', chamber_data)
  WHERE id = pb_cert;
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (pb, '{"company_name":"Prospect B Draft"}') RETURNING id INTO pb_open;

  -- A file planted in guest B's folder under guest A's intake: neither of them may read it.
  RESET ROLE;
  PERFORM pg_temp.store_file('documents', gb || '/' || ga_open || '/planted.csv');

  -- The advisor works on prospect A's submission, so every advisor-side table has a row to protect.
  PERFORM pg_temp.become('advisor');
  PERFORM public.set_submission_status(pa_cert, 'under_review', 'Picked up');
  INSERT INTO public.advisor_notes (session_id, body) VALUES (pa_cert, 'Loss runs look thin');
  PERFORM public.review_submission_field(pa_cert, 'company_name', 'verified');
  SELECT max(id) INTO latest FROM public.advisor_review_events WHERE session_id = pa_cert;
  INSERT INTO storage.objects (bucket_id, name) VALUES ('manuscripts', pa_cert || '/v1-matrix.pdf');
  PERFORM public.record_manuscript_version(pa_cert, 1, pa_cert || '/v1-matrix.pdf', repeat('c', 64), latest, 0, false,
    (SELECT s.submission ->> 'data_sha256' FROM public.chamber_sessions s WHERE s.id = pa_cert),
    (SELECT (s.submission ->> 'certified_at')::timestamptz FROM public.chamber_sessions s WHERE s.id = pa_cert));

  -- Monitoring: a guest's report, a signed-out visitor's, and a function's; and one alert.
  PERFORM pg_temp.become('guest_a');
  IF NOT public.report_client_event('upload_failed', 'storage_upload', 'Upload failed', '/start?session=x', ga_open) THEN RAISE EXCEPTION 'setup: report dropped'; END IF;
  PERFORM pg_temp.become('signed_out');
  IF NOT public.report_client_event('app_error', 'render_error', 'TypeError', '/', NULL) THEN RAISE EXCEPTION 'setup: report dropped'; END IF;
  PERFORM pg_temp.become('service');
  PERFORM public.record_ops_event('ai_failed', 'chamber-extract', 'timeout', NULL, pa, NULL);
  RESET ROLE;
  INSERT INTO public.ops_alerts (kind, event_count, window_minutes, threshold, top_codes) VALUES ('ai_failed', 5, 15, 5, 'timeout x5');
  -- The record chamber-extract keeps of a call (US-2.4a), on prospect A's submission.
  INSERT INTO public.ai_extraction_events (request_id, function_name, user_id, session_id, outcome, error_code, http_status)
  VALUES (gen_random_uuid(), 'chamber-extract', pa, pa_cert, 'error', 'timeout', 504);

  -- The admin asks for prospect B's draft to be deleted (it stays until purge-intakes runs).
  PERFORM pg_temp.become('admin');
  PERFORM public.request_intake_deletion(pb_open, 'The owner asked by email; verified from the account address');

  -- Email delivery, and the AI rate-limit counters.
  PERFORM pg_temp.become('service');
  PERFORM public.record_email_delivery_event('evt_matrix_1', 'email.bounced', 'msg_matrix_1', ARRAY['prospect_a@example.test'], 'Permanent', 'Mailbox does not exist', now());
  IF NOT public.consume_ip_quota(repeat('a', 64), 20, 400) THEN RAISE EXCEPTION 'setup: ip quota refused'; END IF;
  IF NOT public.consume_global_ai_budget(2000) THEN RAISE EXCEPTION 'setup: global budget refused'; END IF;
  PERFORM pg_temp.become('prospect_a');
  IF NOT public.consume_ai_quota(15, 300) THEN RAISE EXCEPTION 'setup: ai quota refused'; END IF;

  RESET ROLE;
  -- Every file above passed its malware scan, as document-upload records it (20261104130000); a file whose
  -- scan hasn't is withheld, which document_scanning.sql checks. One more upload waits in quarantine.
  UPDATE public.documents SET scan_verdict = 'clean', scanned_at = now();
  INSERT INTO storage.objects (bucket_id, name) VALUES ('quarantine', ga || '/' || ga_open || '/held.pdf');
  PERFORM set_config('request.jwt.claims', '', false);
  INSERT INTO fx VALUES
    ('ga_open', ga_open), ('ga_expired', ga_expired), ('ga_archived', ga_archived), ('ga_revoked', ga_revoked),
    ('gb_open', gb_open), ('pa_cert', pa_cert), ('pa_open', pa_open), ('pb_cert', pb_cert), ('pb_open', pb_open);

  -- The setup did what it says.
  IF (SELECT string_agg(s.status, ',' ORDER BY s.status) FROM public.chamber_sessions s WHERE s.user_id = ga) <> 'archived,expired,in_progress,revoked' THEN
    RAISE EXCEPTION 'setup: guest A''s intakes are %', (SELECT string_agg(status, ',') FROM public.chamber_sessions WHERE user_id = ga);
  END IF;
  IF (SELECT count(*) FROM public.chamber_sessions WHERE intake_consent_id IS NULL) <> 0 THEN RAISE EXCEPTION 'setup: an intake has no consent recorded'; END IF;
  IF (SELECT count(*) FROM public.chamber_certifications) <> 2 THEN RAISE EXCEPTION 'setup: expected two certifications'; END IF;
END $$;

-- ---------- 1. the matrix ----------
-- Rows each caller sees of each source. A missing caller key means 0; "all" means every row there is. Every
-- source must hold at least one row, or the check would prove nothing.
CREATE TEMP TABLE matrix (src text PRIMARY KEY, expect jsonb NOT NULL);
GRANT SELECT ON matrix TO anon, authenticated, service_role;
INSERT INTO matrix VALUES
  -- Guest A sees its open and expired drafts, not the archived or revoked ones.
  ('public.chamber_sessions',                           '{"guest_a":2,"guest_b":1,"prospect_a":2,"prospect_b":2,"advisor":"all","admin":"all"}'),
  ('public.chamber_certifications',                     '{"prospect_a":1,"prospect_b":1,"advisor":"all","admin":"all"}'),
  ('public.documents',                                  '{"guest_a":2,"guest_b":1,"prospect_a":1,"advisor":"all","admin":"all"}'),
  ('storage.objects WHERE bucket_id = ''documents''',   '{"guest_a":2,"guest_b":1,"prospect_a":1,"advisor":"all","admin":"all"}'),
  -- A prospect reads one stored Manuscript: their final one (the latest version, built from their current
  -- certification; prospect_final_manuscript). Every other file in the bucket is the advisors'.
  ('storage.objects WHERE bucket_id = ''manuscripts''', '{"prospect_a":1,"advisor":"all","admin":"all"}'),
  -- Uploads whose malware scan hasn't passed (20261104130000): the service role's alone.
  ('storage.objects WHERE bucket_id = ''quarantine''',  '{}'),
  ('storage.buckets',                                   '{}'),
  -- Everyone sees their own profile; the advisor's account behind a guest token is still that account.
  ('public.profiles',                                   '{"guest_a":1,"guest_b":1,"prospect_a":1,"prospect_b":1,"advisor":"all","admin":"all","advisor_as_guest":1}'),
  ('public.user_roles',                                 '{"advisor":1,"admin":1,"advisor_as_guest":1}'),
  ('public.intake_consents',                            '{"guest_a":1,"guest_b":1,"prospect_a":1,"prospect_b":1,"advisor":"all","admin":"all"}'),
  ('public.submission_workflow',                        '{"advisor":"all","admin":"all"}'),
  ('public.submission_status_history',                  '{"advisor":"all","admin":"all"}'),
  ('public.advisor_notes',                              '{"advisor":"all","admin":"all"}'),
  ('public.advisor_field_reviews',                      '{"advisor":"all","admin":"all"}'),
  ('public.advisor_review_events',                      '{"advisor":"all","admin":"all"}'),
  ('public.manuscript_versions',                        '{"advisor":"all","admin":"all"}'),
  -- Who added, removed, renamed or re-categorised each document, and when: the advisors' audit trail.
  ('public.document_events',                            '{"advisor":"all","admin":"all"}'),
  ('public.intake_lifecycle_events',                    '{"advisor":"all","admin":"all"}'),
  ('public.intake_deletions',                           '{"advisor":"all","admin":"all"}'),
  -- Monitoring is the admin's: advisors don't need failure codes, routes or account ids.
  ('public.ops_events',                                 '{"admin":"all"}'),
  ('public.ops_alerts',                                 '{"admin":"all"}'),
  -- AI call records (US-2.4a) are for advisors investigating an intake.
  ('public.ai_extraction_events',                       '{"advisor":"all","admin":"all"}'),
  -- Reached only through SECURITY DEFINER functions, by nobody directly.
  ('public.outbox_events',                              '{}'),
  -- The File ID sequence (20261104110000): taken by the certification trigger, read by nobody.
  ('public.submission_reference_counters',              '{}'),
  ('public.email_delivery_events',                      '{}'),
  ('public.email_suppressions',                         '{}'),
  ('public.ai_request_log',                             '{}'),
  ('public.ai_ip_log',                                  '{}'),
  ('public.ai_global_usage',                            '{}');

DO $$
DECLARE
  m record;
  who text;
  total bigint;
  want bigint;
  seen bigint;
  cases integer := 0;
BEGIN
  FOR m IN SELECT * FROM matrix ORDER BY src LOOP
    RESET ROLE;
    total := pg_temp.visible(m.src);
    IF total = 0 THEN RAISE EXCEPTION 'FAIL: % holds no rows, so the matrix proves nothing for it', m.src; END IF;
    FOREACH who IN ARRAY ARRAY['signed_out', 'guest_a', 'guest_b', 'prospect_a', 'prospect_b', 'advisor', 'admin', 'advisor_as_guest', 'service'] LOOP
      want := CASE
        WHEN who = 'service' THEN total  -- the service role bypasses row security
        WHEN m.expect ->> who = 'all' THEN total
        ELSE COALESCE((m.expect ->> who)::bigint, 0)
      END;
      PERFORM pg_temp.become(who);
      seen := pg_temp.visible(m.src);
      RESET ROLE;
      IF seen <> want THEN
        RAISE EXCEPTION 'FAIL: % sees % row(s) of %, expected %', who, seen, m.src, want;
      END IF;
      cases := cases + 1;
    END LOOP;
  END LOOP;
  PERFORM set_config('request.jwt.claims', '', false);
  RAISE NOTICE 'data_isolation: % matrix cases passed', cases;
END $$;

-- ---------- 2. someone else's intake ----------
-- Each intake is attacked by everyone who doesn't own it, by its id: with their own token, or none.
DO $$
DECLARE
  t record;
  who text;
  me uuid;
  cases integer := 0;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('guest_a', 'ga_open', 'census.csv'),
      ('guest_b', 'gb_open', 'roster.xlsx'),
      ('prospect_a', 'pa_cert', 'benefits.pdf')
    ) AS v(owner, intake, file)
  LOOP
    DECLARE
      owner_id constant uuid := pg_temp.id(t.owner);
      sid constant uuid := pg_temp.id(t.intake);
      path constant text := owner_id || '/' || sid || '/' || t.file;
      doc uuid;
    BEGIN
      SELECT d.id INTO doc FROM public.documents d WHERE d.session_id = sid;

      FOR who IN SELECT pg_temp.outsiders(t.owner) LOOP
        me := CASE WHEN who = 'signed_out' THEN NULL ELSE pg_temp.id(CASE WHEN who = 'advisor_as_guest' THEN 'advisor' ELSE who END) END;
        PERFORM pg_temp.become(who);

        -- Nothing of it reads: the row (answers, conversation, provenance), its documents and files, its
        -- certification, its owner's agreement.
        IF pg_temp.visible(format('public.chamber_sessions WHERE id = %L', sid)) <> 0
           OR pg_temp.visible(format('public.chamber_sessions WHERE id = %L AND transcript IS NOT NULL AND field_provenance IS NOT NULL', sid)) <> 0 THEN
          RAISE EXCEPTION 'FAIL: % can read %''s intake by its id', who, t.owner;
        END IF;
        IF pg_temp.visible(format('public.documents WHERE session_id = %L OR id = %L', sid, doc)) <> 0 THEN
          RAISE EXCEPTION 'FAIL: % can read %''s documents', who, t.owner;
        END IF;
        IF pg_temp.visible(format('storage.objects WHERE name LIKE %L', '%' || sid || '%')) <> 0 THEN
          RAISE EXCEPTION 'FAIL: % can read (and so sign a link to) a file stored under %''s intake', who, t.owner;
        END IF;
        IF pg_temp.visible(format('public.chamber_certifications WHERE session_id = %L', sid)) <> 0
           OR pg_temp.visible(format('public.intake_consents WHERE user_id = %L', owner_id)) <> 0
           OR pg_temp.visible(format('public.profiles WHERE user_id = %L', owner_id)) <> 0 THEN
          RAISE EXCEPTION 'FAIL: % can read %''s certification, consent or profile', who, t.owner;
        END IF;

        -- Nothing of it changes.
        PERFORM pg_temp.changes_nothing(format('UPDATE public.chamber_sessions SET chamber_data = %L WHERE id = %L', '{"company_name":"Hijacked"}', sid), who || ' changed ' || t.owner || '''s answers');
        PERFORM pg_temp.changes_nothing(format('UPDATE public.chamber_sessions SET transcript = %L, field_provenance = %L WHERE id = %L', '[]', '{}', sid), who || ' changed ' || t.owner || '''s conversation');
        PERFORM pg_temp.changes_nothing(format('UPDATE public.chamber_sessions SET user_id = %L WHERE id = %L', COALESCE(me, gen_random_uuid()), sid), who || ' took ' || t.owner || '''s intake');
        PERFORM pg_temp.changes_nothing(format('DELETE FROM public.chamber_sessions WHERE id = %L', sid), who || ' deleted ' || t.owner || '''s intake');
        PERFORM pg_temp.changes_nothing(format('UPDATE public.documents SET status = %L, category = %L WHERE id = %L', 'extracted', 'other', doc), who || ' changed ' || t.owner || '''s document');
        PERFORM pg_temp.changes_nothing(format('DELETE FROM public.documents WHERE id = %L', doc), who || ' deleted ' || t.owner || '''s document');
        PERFORM pg_temp.changes_nothing(format('UPDATE storage.objects SET name = name || %L WHERE name = %L', '.moved', path), who || ' moved ' || t.owner || '''s file');
        PERFORM pg_temp.changes_nothing(format('DELETE FROM storage.objects WHERE name = %L', path), who || ' deleted ' || t.owner || '''s file');
        PERFORM pg_temp.changes_nothing(format('UPDATE public.chamber_certifications SET signer_name = %L WHERE session_id = %L', 'Forged', sid), who || ' changed ' || t.owner || '''s certification');
        PERFORM pg_temp.changes_nothing(format('UPDATE public.profiles SET contact_name = %L WHERE user_id = %L', 'Forged', owner_id), who || ' changed ' || t.owner || '''s profile');

        -- Nothing attaches to it: no document row (in their own name or the owner's) and no stored file
        -- (in their own folder or the owner's).
        PERFORM pg_temp.refused(format('INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path) VALUES (%L, %L, %L, %L, %L)',
          COALESCE(me, gen_random_uuid()), sid, 'x.csv', '1 KB', COALESCE(me::text, 'anon') || '/' || sid || '/x.csv'), who || ' attached a document to ' || t.owner || '''s intake');
        PERFORM pg_temp.refused(format('INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path) VALUES (%L, %L, %L, %L, %L)',
          owner_id, sid, 'x.csv', '1 KB', owner_id || '/' || sid || '/x.csv'), who || ' attached a document in ' || t.owner || '''s name');
        PERFORM pg_temp.refused(format('INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)', 'documents', COALESCE(me::text, 'anon') || '/' || sid || '/x.csv'), who || ' stored a file under ' || t.owner || '''s intake');
        PERFORM pg_temp.refused(format('INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)', 'documents', owner_id || '/' || sid || '/x.csv'), who || ' stored a file in ' || t.owner || '''s folder');
        PERFORM pg_temp.refused(format('INSERT INTO public.intake_consents (user_id, consent_version, consent_text) VALUES (%L, %L, %L)', owner_id, 'forged', 'x'), who || ' recorded a consent for ' || t.owner);

        -- The functions that act on an intake by its id say nothing about it.
        IF who = 'signed_out' THEN
          PERFORM pg_temp.expect(format('SELECT public.archive_chamber_session(%L)', sid), '42501', 'a signed-out archive');
          PERFORM pg_temp.expect(format('SELECT public.prospect_submission_status(%L)', sid), '42501', 'a signed-out status read');
        ELSE
          PERFORM pg_temp.expect(format('SELECT public.archive_chamber_session(%L)', sid), 'PT404', who || ' archiving ' || t.owner || '''s intake');
          IF public.prospect_submission_status(sid) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: % read %''s pipeline status', who, t.owner; END IF;
          IF public.current_intake_consent_id(owner_id) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: % read %''s consent', who, t.owner; END IF;
        END IF;
        cases := cases + 1;
      END LOOP;

      -- Positive controls: the owner can do what the others couldn't (rolled back), so the refusals
      -- above are row security at work, not a broken table.
      PERFORM pg_temp.become(t.owner);
      IF pg_temp.visible(format('public.chamber_sessions WHERE id = %L AND transcript IS NOT NULL', sid)) <> 1
         OR pg_temp.visible(format('public.documents WHERE session_id = %L', sid)) <> 1
         OR pg_temp.visible(format('storage.objects WHERE name = %L', path)) <> 1 THEN
        RAISE EXCEPTION 'FAIL: % can''t read their own intake, document or file', t.owner;
      END IF;
      PERFORM pg_temp.expect(format('UPDATE public.chamber_sessions SET chosen_peo = %L WHERE id = %L', 'A PEO', sid), 'rows:1', t.owner || ' saving their own intake');
      PERFORM pg_temp.expect(format('UPDATE public.documents SET category = %L WHERE id = %L', 'other', doc), 'rows:1', t.owner || ' changing their own document');
      -- Not even the owner stores a file directly: document-upload checks its bytes and stores it (20261104130000).
      PERFORM pg_temp.expect(format('INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)', 'documents', owner_id || '/' || sid || '/new.csv'), '42501', t.owner || ' storing a file directly');
      PERFORM pg_temp.expect(format('INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path) VALUES (%L, %L, %L, %L, %L)',
        owner_id, sid, 'new.csv', '1 KB', owner_id || '/' || sid || '/new.csv'), 'rows:1', t.owner || ' adding a document');
      -- A certified intake keeps the file it was certified with, for the advisor (20261104112000); removing the
      -- document still succeeds for its owner. Any other file of theirs they can remove.
      PERFORM pg_temp.expect(format('DELETE FROM storage.objects WHERE name = %L', path),
        CASE WHEN t.intake = 'pa_cert' THEN 'rows:0' ELSE 'rows:1' END, t.owner || ' removing their own file');
      RESET ROLE;
    END;
  END LOOP;

  -- The planted file in guest B's folder under guest A's intake belongs to neither.
  FOREACH who IN ARRAY ARRAY['guest_a', 'guest_b'] LOOP
    PERFORM pg_temp.become(who);
    IF pg_temp.visible(format('storage.objects WHERE name LIKE %L', '%/planted.csv')) <> 0 THEN
      RAISE EXCEPTION 'FAIL: % can read a file planted across folders', who;
    END IF;
  END LOOP;

  -- A guest reporting a failure can't tie it to someone else's intake; its own sticks.
  PERFORM pg_temp.become('guest_b');
  IF NOT public.report_client_event('upload_failed', 'probe', NULL, '/start', pg_temp.id('ga_open')) THEN RAISE EXCEPTION 'setup: report dropped'; END IF;
  IF NOT public.report_client_event('upload_failed', 'own', NULL, '/start', pg_temp.id('gb_open')) THEN RAISE EXCEPTION 'setup: report dropped'; END IF;
  RESET ROLE;
  IF (SELECT session_id FROM public.ops_events WHERE code = 'probe') IS NOT NULL
     OR (SELECT session_id FROM public.ops_events WHERE code = 'own') IS DISTINCT FROM pg_temp.id('gb_open') THEN
    RAISE EXCEPTION 'FAIL: a report kept a session id the reporter can''t see, or dropped its own';
  END IF;
  DELETE FROM public.ops_events WHERE code IN ('probe', 'own');

  PERFORM set_config('request.jwt.claims', '', false);
  RAISE NOTICE 'data_isolation: % outsider cases passed (3 intakes x their outsiders)', cases;
END $$;

-- ---------- 3. closed intakes, from their owner ----------
DO $$
DECLARE
  ga constant uuid := pg_temp.id('guest_a');
  closed text;
  sid uuid;
  doc uuid;
BEGIN
  PERFORM pg_temp.become('guest_a');

  -- Archived ("Start over") and revoked: gone, with their documents and files, and nothing changes them.
  FOREACH closed IN ARRAY ARRAY['ga_archived', 'ga_revoked'] LOOP
    sid := pg_temp.id(closed);
    IF pg_temp.visible(format('public.chamber_sessions WHERE id = %L', sid)) <> 0
       OR pg_temp.visible(format('public.documents WHERE session_id = %L', sid)) <> 0
       OR pg_temp.visible(format('storage.objects WHERE name LIKE %L', '%' || sid || '%')) <> 0 THEN
      RAISE EXCEPTION 'FAIL: the owner can still read the % intake, its documents or files', closed;
    END IF;
    PERFORM pg_temp.changes_nothing(format('UPDATE public.chamber_sessions SET chamber_data = %L WHERE id = %L', '{"company_name":"Back"}', sid), 'the owner changed the ' || closed || ' intake');
    PERFORM pg_temp.changes_nothing(format('UPDATE public.chamber_sessions SET status = %L WHERE id = %L', 'in_progress', sid), 'the owner reopened the ' || closed || ' intake');
    PERFORM pg_temp.changes_nothing(format('DELETE FROM storage.objects WHERE name LIKE %L', '%' || sid || '%'), 'the owner reached a file of the ' || closed || ' intake');
    PERFORM pg_temp.refused(format('INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path) VALUES (%L, %L, %L, %L, %L)',
      ga, sid, 'late.csv', '1 KB', ga || '/' || sid || '/late.csv'), 'a document added to the ' || closed || ' intake');
    PERFORM pg_temp.refused(format('INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)', 'documents', ga || '/' || sid || '/late.csv'), 'a file stored under the ' || closed || ' intake');
  END LOOP;

  -- Expired: readable, so the Chamber can say it expired, but nothing about it changes. Its documents can
  -- still be removed: that only removes the owner's own data ahead of the retention deletion (SR-5).
  sid := pg_temp.id('ga_expired');
  SELECT d.id INTO doc FROM public.documents d WHERE d.session_id = sid;
  IF pg_temp.visible(format('public.chamber_sessions WHERE id = %L AND status = %L', sid, 'expired')) <> 1
     OR pg_temp.visible(format('public.documents WHERE session_id = %L', sid)) <> 1
     OR pg_temp.visible(format('storage.objects WHERE name LIKE %L', '%' || sid || '%')) <> 1 THEN
    RAISE EXCEPTION 'FAIL: the owner can''t read their expired intake, its document or file';
  END IF;
  PERFORM pg_temp.changes_nothing(format('UPDATE public.chamber_sessions SET chamber_data = %L WHERE id = %L', '{"company_name":"Back"}', sid), 'the owner changed an expired intake');
  PERFORM pg_temp.changes_nothing(format('UPDATE public.chamber_sessions SET status = %L WHERE id = %L', 'in_progress', sid), 'the owner reopened an expired intake');
  PERFORM pg_temp.changes_nothing(format('UPDATE public.documents SET category = %L, status = %L WHERE id = %L', 'other', 'extracted', doc), 'the owner changed a document of an expired intake (SR-5)');
  PERFORM pg_temp.expect(format('INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path) VALUES (%L, %L, %L, %L, %L)',
    ga, sid, 'late.csv', '1 KB', ga || '/' || sid || '/late.csv'), 'EA002', 'a document added to an expired intake');
  PERFORM pg_temp.expect(format('INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)', 'documents', ga || '/' || sid || '/late.csv'), '42501', 'a file stored under an expired intake');
  PERFORM pg_temp.expect(format('DELETE FROM public.documents WHERE id = %L', doc), 'rows:1', 'the owner removing a document from an expired intake');

  -- Advisors still see every closed intake, read-only.
  PERFORM pg_temp.become('advisor');
  IF pg_temp.visible(format('public.chamber_sessions WHERE user_id = %L', ga)) <> 4 THEN RAISE EXCEPTION 'FAIL: an advisor can''t see every closed intake'; END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', false);
  RAISE NOTICE 'data_isolation: closed intake cases passed';
END $$;

-- ---------- 4. functions: who may call what ----------
-- Every function anon or authenticated can execute, why, and for the ones that are only for advisors or
-- admins, a call that must be refused (42501) for everyone else. %1$s is a real certified intake's id and
-- %2$s an id that matches nothing. The catalogue check in part 5 keeps this list complete.
--   anyone        callable signed out; reads nothing about anyone but the caller
--   own           signed-in callers, acting only on their own rows
--   helper        called as the signed-in user by a trigger or an invoker function; holds no data itself
--   advisor       refuses anyone who isn't an advisor or admin
--   admin         refuses anyone who isn't an admin, advisors included
CREATE TEMP TABLE callable (fn text PRIMARY KEY, audience text NOT NULL, call text, why text NOT NULL);
GRANT SELECT ON callable TO anon, authenticated, service_role;
INSERT INTO callable VALUES
  ('has_role(_role app_role)',                 'anyone',  NULL, 'row security policies call it as the caller; answers about the caller only'),
  ('is_advisor()',                             'anyone',  NULL, 'row security policies and RequireAdvisor call it; answers about the caller only'),
  ('report_client_event(p_kind text, p_code text, p_detail text, p_route text, p_session_id uuid)', 'anyone', NULL,
                                                                     'browser failure reports, signed-out visitors included; redacted, capped, keeps only a session the caller can see'),
  ('intake_consent_version()',                 'anyone',  NULL, 'a constant: the consent wording in force'),
  ('intake_missing_required(d jsonb)',         'helper',  NULL, 'the certification gate''s trigger calls it as the signed-in prospect; pure: required answers missing from the jsonb it is given'),
  ('intake_answers_present(p_data jsonb)',     'helper',  NULL, 'pure: which answers the jsonb it is given holds; behind intake_missing_required and intake_required_items'),
  ('intake_required_items(p_data jsonb, p_provenance jsonb, p_verified text[])', 'helper', NULL, 'pure: each required item''s state for the jsonb it is given; behind the advisor queue (B-2.2)'),
  ('provenance_entry_status(p_entry jsonb)',   'helper',  NULL, 'pure: a stored provenance entry''s status, as the browser reads it'),
  ('provenance_source_is_valid(p_source jsonb)', 'helper', NULL, 'pure: whether a provenance source is well formed'),
  ('session_verified_fields(p_session_id uuid)', 'own',   NULL, 'the field names an advisor verified on the caller''s own intake (any intake, for advisors); empty for anyone else''s'),
  ('intake_conflicting_required(p jsonb)',     'anyone',  NULL, 'pure: required fields in conflict in the provenance it is given'),
  ('is_prospect_visible_status(s text)',       'anyone',  NULL, 'pure: whether a status name is shared with prospects'),
  ('is_reviewable_field(f text)',              'anyone',  NULL, 'pure: whether a field name can be reviewed'),
  ('ops_clean_code(p_code text)',              'anyone',  NULL, 'pure: cleans a failure code'),
  ('ops_redact(p_text text, p_max integer)',   'anyone',  NULL, 'pure: redacts free text'),
  ('ops_event_retention()',                    'anyone',  NULL, 'a constant: how long monitoring events are kept'),
  ('archive_chamber_session(p_session_id uuid)', 'own',   NULL, 'the prospect''s Start over; PT404 for anyone else''s intake'),
  ('record_intake_consent(p_version text, p_text text)', 'own', NULL, 'records the caller''s own agreement'),
  ('prospect_submission_status(p_session_id uuid)', 'own', NULL, 'the caller''s own certified intake''s shared status; null for anyone else''s'),
  ('prospect_final_manuscript(p_session_id uuid)', 'own', NULL, 'the caller''s own certified intake''s final Manuscript (latest version, current certification); nothing for anyone else''s'),
  ('is_own_final_manuscript(p_name text)',     'helper',  NULL, 'the manuscripts read policy calls it as the caller; true only for the file of the caller''s own final Manuscript'),
  ('is_certified_evidence(p_name text)',       'helper',  NULL, 'the documents delete policy calls it as the caller; answers only about the caller''s own certified intakes'),
  ('is_withheld_document_file(p_name text)',   'helper',  NULL, 'the documents read policies call it as the reader; answers only whether the document stored at that exact path has a scan that hasn''t passed'),
  ('consume_ai_quota(per_minute integer, per_day integer)', 'own', NULL, 'the AI functions call it with the caller''s token; spends only the caller''s own allowance (SR-6)'),
  ('current_intake_consent_id(p_user_id uuid)', 'helper', NULL, 'the consent triggers call it as the caller; row security limits it to the caller''s own agreement (all, for advisors)'),
  ('chamber_data_census_row_error(census_row jsonb, base text, OUT path text, OUT reason text)', 'helper', NULL, 'intake validation trigger; pure'),
  ('chamber_data_error(d jsonb, OUT path text, OUT reason text)', 'helper', NULL, 'intake validation trigger; pure'),
  ('chamber_data_field_kind(field text)',      'helper',  NULL, 'intake validation trigger; pure'),
  ('chamber_transcript_error(t jsonb, OUT path text, OUT reason text)', 'helper', NULL, 'transcript validation trigger; pure'),
  ('chamber_data_is_text(v jsonb, max_length integer)', 'helper', NULL, 'intake validation trigger; pure'),
  ('chamber_data_is_whole_number(v jsonb, max_value numeric)', 'helper', NULL, 'intake validation trigger; pure'),
  ('chamber_data_person_error(person jsonb, base text, OUT path text, OUT reason text)', 'helper', NULL, 'intake validation trigger; pure'),
  ('is_us_state_code(code text)',              'helper',  NULL, 'intake and profile validation; pure'),
  ('is_valid_phone(phone text)',               'helper',  NULL, 'intake and profile validation; pure'),
  ('intake_draft_retention()',                 'helper',  NULL, 'the lifecycle trigger reads the window as the caller; a constant'),
  ('closed_draft_retention()',                 'helper',  NULL, 'a constant: the closed-draft window'),
  ('submitted_record_retention()',             'helper',  NULL, 'a constant: the submitted-record window'),
  ('email_event_retention()',                  'helper',  NULL, 'a constant: the email event window'),
  ('intake_deletion_max_attempts()',           'helper',  NULL, 'a constant: purge attempts before an alert'),
  ('ai_event_retention()',                     'anyone',  NULL, 'a constant: how long AI call records are kept'),
  ('ai_event_names_ok(names text[], paths boolean)', 'helper', NULL, 'pure: the AI call records'' check constraint'),
  ('intake_accepts_files(p_session text)',     'helper',  NULL, 'the upload policies call it as the uploader; answers only whether an intake exists with no deletion open (and holds the row against one)'),
  ('ops_alert_rules()',                        'helper',  NULL, 'constants: the alert thresholds'),
  ('advisor_list_submissions(p_status text, p_search text, p_limit integer, p_offset integer, p_needs_action boolean)', 'advisor',
                                                                     'SELECT count(*) FROM public.advisor_list_submissions(NULL, NULL, 25, 0, true)', 'the queue: one page, searched, filtered'),
  ('advisor_email_problems()',                 'advisor', 'SELECT count(*) FROM public.advisor_email_problems()', 'email problems on the queue'),
  ('advisor_list_outbox_events(p_status text, p_limit integer)', 'advisor', 'SELECT count(*) FROM public.advisor_list_outbox_events(NULL, 10)', 'the outbox page'),
  ('advisor_outbox_summary()',                 'advisor', 'SELECT count(*) FROM public.advisor_outbox_summary()', 'the outbox page'),
  ('advisor_requeue_outbox_event(event_id uuid, rebuild_payload boolean)', 'advisor', 'SELECT public.advisor_requeue_outbox_event(%2$L, false)', 'retrying a dead email'),
  ('set_submission_status(p_session_id uuid, p_status text, p_note text)', 'advisor', 'SELECT public.set_submission_status(%1$L, ''information_requested'', ''probe'')', 'the pipeline'),
  ('set_submission_needs_action(p_session_id uuid, p_needs_action boolean, p_note text)', 'advisor',
                                                                     'SELECT public.set_submission_needs_action(%1$L, true, ''probe'')', 'needs advisor action'),
  ('review_submission_field(p_session_id uuid, p_field text, p_review_state text, p_correction text, p_value jsonb, p_reason text, p_answer jsonb)', 'advisor',
                                                                     'SELECT public.review_submission_field(%1$L, ''company_name'', ''flagged'')', 'field review'),
  ('record_manuscript_version(p_session_id uuid, p_version integer, p_storage_path text, p_pdf_sha256 text, p_review_event_id bigint, p_corrections_applied integer, p_sensitive_revealed boolean, p_certified_data_hash text, p_certified_at timestamp with time zone)', 'advisor',
                                                                     'SELECT public.record_manuscript_version(%1$L, 2, %1$L || ''/probe.pdf'', repeat(''d'', 64), 0, 0, false, NULL, NULL)', 'storing a Manuscript version'),
  ('retention_review_due(p_limit integer)',    'advisor', 'SELECT count(*) FROM public.retention_review_due(10)', 'submitted records due for review'),
  ('revoke_chamber_session(p_session_id uuid, p_reason text)', 'admin', 'SELECT public.revoke_chamber_session(%2$L, ''probe'')', 'closing a draft for good'),
  ('request_intake_deletion(p_session_id uuid, p_reason text)', 'admin', 'SELECT public.request_intake_deletion(%2$L, ''probe'')', 'asking for a deletion'),
  ('retry_intake_deletion(p_deletion_id uuid)', 'admin',  'SELECT public.retry_intake_deletion(%2$L)', 'retrying a failed deletion'),
  ('admin_ops_summary(p_hours integer)',       'admin',   'SELECT count(*) FROM public.admin_ops_summary(24)', 'monitoring counts');

DO $$
DECLARE
  c record;
  who text;
  stmt text;
  r text;
  cases integer := 0;
  sid constant uuid := pg_temp.id('pa_cert');
  nobody constant uuid := gen_random_uuid();
BEGIN
  FOR c IN SELECT * FROM callable WHERE audience IN ('advisor', 'admin') ORDER BY fn LOOP
    stmt := format(c.call, sid, nobody);
    FOREACH who IN ARRAY ARRAY['signed_out', 'guest_a', 'prospect_a', 'prospect_b', 'advisor_as_guest', 'advisor', 'admin'] LOOP
      PERFORM pg_temp.become(who);
      r := pg_temp.attempt(stmt);
      RESET ROLE;
      IF (c.audience = 'advisor' AND who IN ('advisor', 'admin')) OR (c.audience = 'admin' AND who = 'admin') THEN
        IF r = '42501' THEN RAISE EXCEPTION 'FAIL: % was refused % (%)', who, c.fn, stmt; END IF;
      ELSIF r <> '42501' THEN
        RAISE EXCEPTION 'FAIL: % calling % gave %, expected 42501', who, c.fn, r;
      END IF;
      cases := cases + 1;
    END LOOP;
  END LOOP;

  -- Service-only work: refused to every API role but the service role. A sample by call; part 5 checks the
  -- privilege of every function.
  FOREACH stmt IN ARRAY ARRAY[
    'SELECT public.expire_idle_intakes(1)',
    'SELECT count(*) FROM public.claim_outbox_events(ARRAY[''advisor_notification''], 1, 5, 600)',
    'SELECT public.reconcile_outbox_events(1)',
    'SELECT public.consume_ip_quota(repeat(''b'', 64), 20, 400)',
    'SELECT public.consume_global_ai_budget(2000)',
    'SELECT public.record_ops_event(''ai_failed'', ''probe'', NULL, NULL, NULL, NULL)',
    'SELECT count(*) FROM public.claim_ops_alerts()',
    'SELECT public.run_retention()',
    'SELECT public.queue_retention_deletions(1)',
    'SELECT count(*) FROM public.claim_intake_deletions(1, 600)',
    'SELECT count(*) FROM public.claim_document_scans(1, 60)',
    'SELECT count(*) FROM public.document_scan_orphans(10)',
    format('SELECT count(*) FROM public.intake_stored_files(%L, %L)', sid, pg_temp.id('prospect_a')),
    format('SELECT public.complete_intake_deletion(%L, 0)', nobody),
    format('SELECT public.fail_intake_deletion(%L, ''probe'', 60)', nobody)
  ] LOOP
    FOREACH who IN ARRAY ARRAY['signed_out', 'guest_a', 'prospect_a', 'advisor', 'admin'] LOOP
      PERFORM pg_temp.become(who);
      r := pg_temp.attempt(stmt);
      RESET ROLE;
      IF r <> '42501' THEN RAISE EXCEPTION 'FAIL: % running % gave %, expected 42501', who, stmt, r; END IF;
      cases := cases + 1;
    END LOOP;
    PERFORM pg_temp.become('service');
    r := pg_temp.attempt(stmt);
    RESET ROLE;
    IF r = '42501' THEN RAISE EXCEPTION 'FAIL: the service role was refused %', stmt; END IF;
    cases := cases + 1;
  END LOOP;
  PERFORM set_config('request.jwt.claims', '', false);
  RAISE NOTICE 'data_isolation: % function cases passed', cases;
END $$;

-- ---------- 4b. prospects against advisor records; advisors against everything they don't own ----------
DO $$
DECLARE
  sid constant uuid := pg_temp.id('pa_cert');
  pa constant uuid := pg_temp.id('prospect_a');
  adv constant uuid := pg_temp.id('advisor');
  doc uuid := (SELECT d.id FROM public.documents d WHERE d.session_id = pg_temp.id('pa_cert'));
  ms text := (SELECT v.storage_path FROM public.manuscript_versions v WHERE v.session_id = pg_temp.id('pa_cert'));
  t text;
  who text;
BEGIN
  -- The prospect whose submission it is sees none of the advisor's work on it, and can't add to it.
  FOREACH who IN ARRAY ARRAY['prospect_a', 'guest_a', 'signed_out'] LOOP
    PERFORM pg_temp.become(who);
    FOREACH t IN ARRAY ARRAY['advisor_notes', 'advisor_field_reviews', 'advisor_review_events', 'submission_workflow',
                             'submission_status_history', 'manuscript_versions', 'intake_lifecycle_events', 'outbox_events',
                             'intake_deletions', 'ops_events', 'ai_extraction_events', 'document_events'] LOOP
      IF pg_temp.visible(format('public.%I WHERE session_id = %L', t, sid)) <> 0 THEN
        RAISE EXCEPTION 'FAIL: % can read % about prospect A''s submission', who, t;
      END IF;
    END LOOP;
    -- Only their own final Manuscript's file, for the prospect whose submission it is.
    IF pg_temp.visible(format('storage.objects WHERE bucket_id = %L AND name IS DISTINCT FROM %L', 'manuscripts',
                              CASE WHEN who = 'prospect_a' THEN ms END)) <> 0 THEN
      RAISE EXCEPTION 'FAIL: % can read a stored Manuscript that isn''t their final one', who;
    END IF;
    PERFORM pg_temp.refused(format('INSERT INTO public.advisor_notes (session_id, author_id, body) VALUES (%L, %L, %L)', sid, COALESCE(pa, adv), 'x'), who || ' adding an advisor note');
    PERFORM pg_temp.refused(format('INSERT INTO public.user_roles (user_id, role) VALUES (%L, %L)', pa, 'advisor'), who || ' granting a role');
    PERFORM pg_temp.refused(format('INSERT INTO public.ops_events (kind, source) VALUES (%L, %L)', 'app_error', 'forged'), who || ' writing an ops event directly');
    PERFORM pg_temp.refused(format('INSERT INTO public.intake_deletions (session_id, trigger, reason) VALUES (%L, %L, %L)', sid, 'request', 'x'), who || ' queueing a deletion directly');
    PERFORM pg_temp.refused(format('INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)', 'manuscripts', sid || '/forged.pdf'), who || ' storing a Manuscript');
  END LOOP;
  -- What the prospect is meant to see: the shared status of their own submission, and its final Manuscript.
  PERFORM pg_temp.become('prospect_a');
  IF public.prospect_submission_status(sid) IS DISTINCT FROM 'under_review' THEN RAISE EXCEPTION 'FAIL: prospect A can''t see their own shared status'; END IF;
  IF (SELECT f.storage_path FROM public.prospect_final_manuscript(sid) f) IS DISTINCT FROM ms
     OR pg_temp.visible(format('storage.objects WHERE bucket_id = %L AND name = %L', 'manuscripts', ms)) <> 1 THEN
    RAISE EXCEPTION 'FAIL: prospect A can''t fetch their own final Manuscript';
  END IF;

  -- Advisors: read the operational data they work with, nothing beyond it, and change nothing a prospect owns.
  FOREACH who IN ARRAY ARRAY['advisor', 'advisor_as_guest'] LOOP
    PERFORM pg_temp.become(who);
    IF pg_temp.visible('public.ops_events') <> 0 OR pg_temp.visible('public.ops_alerts') <> 0 THEN RAISE EXCEPTION 'FAIL: % can read monitoring events', who; END IF;
    IF pg_temp.visible(format('public.user_roles WHERE user_id <> %L', adv)) <> 0 THEN RAISE EXCEPTION 'FAIL: % can read other people''s roles', who; END IF;
    PERFORM pg_temp.changes_nothing(format('UPDATE public.chamber_sessions SET chamber_data = %L WHERE id = %L', '{"company_name":"Advisor edit"}', sid), who || ' changed a prospect''s answers');
    PERFORM pg_temp.changes_nothing(format('UPDATE public.chamber_sessions SET transcript = %L WHERE id = %L', '[]', sid), who || ' changed a prospect''s conversation');
    PERFORM pg_temp.changes_nothing(format('DELETE FROM public.chamber_sessions WHERE id = %L', sid), who || ' deleted an intake');
    PERFORM pg_temp.changes_nothing(format('UPDATE public.documents SET status = %L WHERE id = %L', 'extracted', doc), who || ' changed a prospect''s document');
    PERFORM pg_temp.changes_nothing(format('DELETE FROM public.documents WHERE id = %L', doc), who || ' deleted a prospect''s document');
    PERFORM pg_temp.changes_nothing(format('DELETE FROM storage.objects WHERE bucket_id = %L', 'documents'), who || ' deleted a prospect''s file');
    PERFORM pg_temp.changes_nothing(format('UPDATE storage.objects SET name = name || %L WHERE bucket_id = %L', '.x', 'documents'), who || ' moved a prospect''s file');
    PERFORM pg_temp.refused(format('INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)', 'documents', pa || '/' || sid || '/advisor.csv'), who || ' storing a file in a prospect''s folder');
    PERFORM pg_temp.refused(format('INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path) VALUES (%L, %L, %L, %L, %L)',
      adv, sid, 'a.csv', '1 KB', adv || '/' || sid || '/a.csv'), who || ' attaching a document to a prospect''s intake');
    PERFORM pg_temp.changes_nothing(format('UPDATE public.profiles SET contact_name = %L WHERE user_id = %L', 'x', pa), who || ' changed a prospect''s profile');
    PERFORM pg_temp.changes_nothing(format('UPDATE public.chamber_certifications SET signer_name = %L WHERE session_id = %L', 'x', sid), who || ' changed a certification');
    PERFORM pg_temp.changes_nothing(format('DELETE FROM public.chamber_certifications WHERE session_id = %L', sid), who || ' deleted a certification');
    PERFORM pg_temp.changes_nothing(format('UPDATE public.intake_consents SET consent_text = %L', 'x'), who || ' changed a consent record');
    -- Delete nothing, even of their own records.
    PERFORM pg_temp.changes_nothing(format('DELETE FROM public.advisor_notes WHERE session_id = %L', sid), who || ' deleted a note');
    PERFORM pg_temp.changes_nothing(format('UPDATE public.advisor_notes SET body = %L WHERE session_id = %L', 'x', sid), who || ' edited a note');
    PERFORM pg_temp.changes_nothing(format('DELETE FROM public.submission_status_history WHERE session_id = %L', sid), who || ' deleted status history');
    PERFORM pg_temp.changes_nothing(format('DELETE FROM public.advisor_review_events WHERE session_id = %L', sid), who || ' deleted review history');
    PERFORM pg_temp.changes_nothing(format('DELETE FROM public.manuscript_versions WHERE session_id = %L', sid), who || ' deleted a Manuscript version');
    PERFORM pg_temp.changes_nothing(format('DELETE FROM storage.objects WHERE bucket_id = %L AND name = %L', 'manuscripts', ms), who || ' deleted a recorded Manuscript');
    PERFORM pg_temp.changes_nothing('DELETE FROM public.intake_lifecycle_events', who || ' deleted lifecycle records');
    PERFORM pg_temp.changes_nothing('DELETE FROM public.intake_deletions', who || ' deleted deletion records');
    PERFORM pg_temp.changes_nothing(format('UPDATE public.intake_deletions SET status = %L', 'done'), who || ' marked a deletion done');
    -- Grant no roles, to anyone.
    PERFORM pg_temp.refused(format('INSERT INTO public.user_roles (user_id, role) VALUES (%L, %L)', adv, 'admin'), who || ' making themselves admin');
    PERFORM pg_temp.changes_nothing(format('UPDATE public.user_roles SET role = %L WHERE user_id = %L', 'admin', adv), who || ' promoting themselves');
    PERFORM pg_temp.changes_nothing(format('DELETE FROM public.user_roles WHERE user_id <> %L', adv), who || ' revoking someone''s role');
  END LOOP;

  -- The advisor's account behind a guest token is a guest: none of the advisor-only data.
  PERFORM pg_temp.become('advisor_as_guest');
  IF pg_temp.visible('public.chamber_sessions') <> 0 OR pg_temp.visible('public.advisor_notes') <> 0
     OR pg_temp.visible('public.intake_consents') <> 0 OR pg_temp.visible('storage.objects') <> 0 THEN
    RAISE EXCEPTION 'FAIL: a guest token on an advisor''s account reads advisor data';
  END IF;

  -- Nobody but the service role makes a bucket public or adds one.
  FOREACH who IN ARRAY ARRAY['signed_out', 'guest_a', 'prospect_a', 'advisor', 'admin'] LOOP
    PERFORM pg_temp.become(who);
    PERFORM pg_temp.changes_nothing('UPDATE storage.buckets SET public = true', who || ' made a bucket public');
    PERFORM pg_temp.refused('INSERT INTO storage.buckets (id, name, public) VALUES (''open'', ''open'', true)', who || ' added a public bucket');
  END LOOP;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', false);
  RAISE NOTICE 'data_isolation: advisor record and advisor limit cases passed';
END $$;

-- ---------- 5. catalogue checks ----------
DO $$
DECLARE
  missing text;
  extra text;
  r record;
  n integer;
BEGIN
  -- (a) Every public table has row security on and a row in the matrix.
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO missing
  FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity;
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'FAIL: public tables without row security: %', missing; END IF;

  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO missing
  FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p')
    AND NOT EXISTS (SELECT 1 FROM matrix m WHERE m.src = 'public.' || c.relname);
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'FAIL: public tables missing from the data_isolation matrix: %', missing; END IF;

  -- (b) Every function the API roles can execute is in the allowlist, for the audience it says, and the
  --     allowlist names nothing that is gone.
  SELECT string_agg(f.sig, E'\n  ' ORDER BY f.sig) INTO missing
  FROM (
    SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS sig, p.oid, p.prosecdef
    FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
  ) f
  WHERE (has_function_privilege('anon', f.oid, 'EXECUTE') OR has_function_privilege('authenticated', f.oid, 'EXECUTE'))
    AND NOT EXISTS (SELECT 1 FROM callable c WHERE c.fn = f.sig);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION E'FAIL: functions the API roles can execute that the data_isolation allowlist doesn''t cover (revoke them, or list them with a reason):\n  %', missing;
  END IF;

  SELECT string_agg(c.fn, ', ') INTO extra
  FROM callable c
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' = c.fn
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  );
  IF extra IS NOT NULL THEN RAISE EXCEPTION 'FAIL: the allowlist names functions signed-in callers can''t execute (or that are gone): %', extra; END IF;

  -- Signed-out callers reach exactly the 'anyone' functions; that includes every SECURITY DEFINER one they reach.
  FOR r IN
    SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS sig, p.prosecdef,
           has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can, c.audience
    FROM pg_proc p JOIN callable c ON c.fn = p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
    WHERE p.pronamespace = 'public'::regnamespace
  LOOP
    IF r.anon_can <> (r.audience = 'anyone') THEN
      RAISE EXCEPTION 'FAIL: % is % to signed-out callers but listed for %', r.sig, CASE WHEN r.anon_can THEN 'executable' ELSE 'not executable' END, r.audience;
    END IF;
  END LOOP;
  SELECT string_agg(c.fn, ', ' ORDER BY c.fn) INTO missing
  FROM callable c JOIN pg_proc p ON p.pronamespace = 'public'::regnamespace AND p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' = c.fn
  WHERE p.prosecdef AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF missing IS DISTINCT FROM 'has_role(_role app_role), is_advisor(), report_client_event(p_kind text, p_code text, p_detail text, p_route text, p_session_id uuid)' THEN
    RAISE EXCEPTION 'FAIL: SECURITY DEFINER functions signed-out callers can run changed: %', missing;
  END IF;

  -- No trigger function is callable through the API (SR-1).
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO missing
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.prorettype = 'trigger'::regtype
    AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'FAIL: trigger functions the API roles can execute: %', missing; END IF;

  -- (c) Every bucket is private.
  SELECT string_agg(id, ', ') INTO missing FROM storage.buckets WHERE public IS DISTINCT FROM false;
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'FAIL: public storage buckets: %', missing; END IF;
  IF (SELECT array_agg(id ORDER BY id) FROM storage.buckets) IS DISTINCT FROM ARRAY['documents', 'manuscripts', 'quarantine'] THEN
    RAISE EXCEPTION 'FAIL: expected exactly the documents, manuscripts and quarantine buckets';
  END IF;

  -- (d) The API roles hold no TRUNCATE (it ignores row security), REFERENCES or TRIGGER on any public table
  --     (SR-3), and nothing at all on the AI rate-limit tables (SR-4).
  SELECT string_agg(format('%s:%s:%s', c.relname, api.rolname, pr.priv), ', ' ORDER BY c.relname, api.rolname, pr.priv) INTO missing
  FROM pg_class c
  CROSS JOIN (VALUES ('anon'), ('authenticated')) api(rolname)
  CROSS JOIN (VALUES ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) pr(priv)
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p') AND has_table_privilege(api.rolname, c.oid, pr.priv);
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'FAIL: API roles hold table privileges they never need: %', missing; END IF;

  SELECT string_agg(format('%s:%s', c.relname, api.rolname), ', ') INTO missing
  FROM pg_class c CROSS JOIN (VALUES ('anon'), ('authenticated')) api(rolname)
  WHERE c.relnamespace = 'public'::regnamespace AND c.relname IN ('ai_request_log', 'ai_ip_log', 'ai_global_usage')
    AND (has_table_privilege(api.rolname, c.oid, 'SELECT') OR has_table_privilege(api.rolname, c.oid, 'INSERT')
         OR has_table_privilege(api.rolname, c.oid, 'UPDATE') OR has_table_privilege(api.rolname, c.oid, 'DELETE'));
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'FAIL: API roles can still reach the AI rate-limit tables: %', missing; END IF;

  -- A table created after the fix doesn't hand TRUNCATE back to the API roles.
  CREATE TABLE public.isolation_probe (id int);
  IF has_table_privilege('authenticated', 'public.isolation_probe', 'TRUNCATE') OR has_table_privilege('anon', 'public.isolation_probe', 'TRUNCATE') THEN
    RAISE EXCEPTION 'FAIL: a new table hands TRUNCATE to the API roles';
  END IF;
  DROP TABLE public.isolation_probe;

  -- (e) Every SECURITY DEFINER function pins its search_path, so a caller's schema can't redirect it.
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO missing
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
    AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, '{}')) cfg WHERE cfg LIKE 'search_path=%');
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'FAIL: SECURITY DEFINER functions without a fixed search_path: %', missing; END IF;

  -- Revoking EXECUTE on trigger functions left the triggers working: a new account still gets its profile
  -- when the auth server (supabase_auth_admin) creates it, and prospects' writes in parts 1 to 3 fired the rest.
  SET LOCAL ROLE supabase_auth_admin;
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-00000000beef', 'authenticated', 'authenticated', 'new@example.test', false, now(), now());
  RESET ROLE;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = '00000000-0000-0000-0000-00000000beef') THEN
    RAISE EXCEPTION 'FAIL: handle_new_user no longer gives a new account its profile';
  END IF;

  SELECT count(*) INTO n FROM callable;
  RAISE NOTICE 'data_isolation: catalogue cases passed (% tables and buckets in the matrix, % callable functions allowlisted)', (SELECT count(*) FROM matrix), n;
END $$;

\echo 'data_isolation: all cases passed'
