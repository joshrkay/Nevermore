-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh ops_monitoring
-- Operational monitoring (US-6.4): what the browser may report and what is kept of it (redacted, the path
-- only, an intake only when the caller may see it), the hourly caps, edge-function reports, the alert
-- thresholds and cooldown, and who can read any of it.
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
SET client_min_messages = notice;

-- ---------- helpers ----------
CREATE FUNCTION pg_temp.as_user(uid uuid, guest boolean DEFAULT false) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', uid, 'is_anonymous', guest, 'role', 'authenticated', 'email', uid || '@example.test')::text, false);
END $$;

CREATE FUNCTION pg_temp.signed_out() RETURNS void LANGUAGE sql AS
  $$ SELECT set_config('request.jwt.claims', '', false) $$;

CREATE FUNCTION pg_temp.new_user(email text, guest boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', CASE WHEN guest THEN NULL ELSE email END, guest, now(), now());
  RETURN uid;
END $$;

CREATE FUNCTION pg_temp.state_of(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE s text;
BEGIN
  EXECUTE stmt;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE;
  RETURN s;
END $$;

CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT COALESCE(ok, false) THEN RAISE EXCEPTION 'FAIL: %', what; END IF;
END $$;

-- Superuser only: n events of a kind, `ago` old, as if recorded then.
CREATE FUNCTION pg_temp.seed(kind text, n integer, ago interval, source text DEFAULT 'chamber-extract', code text DEFAULT 'timeout', uid uuid DEFAULT NULL)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.ops_events (kind, source, code, user_id, created_at)
  SELECT kind, source, code, uid, now() - ago FROM generate_series(1, n);
$$;

CREATE TEMP TABLE fx (name text PRIMARY KEY, id uuid);
GRANT SELECT ON fx TO authenticated, service_role, anon;

DO $$
DECLARE
  prospect uuid := pg_temp.new_user('prospect@example.test');
  other uuid := pg_temp.new_user('other@example.test');
  advisor uuid := pg_temp.new_user('advisor@example.test');
  admin uuid := pg_temp.new_user('admin@example.test');
  mine uuid;
  theirs uuid;
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (advisor, 'advisor'), (admin, 'admin');
  INSERT INTO public.chamber_sessions (user_id) VALUES (prospect) RETURNING id INTO mine;
  INSERT INTO public.chamber_sessions (user_id) VALUES (other) RETURNING id INTO theirs;
  INSERT INTO fx VALUES ('prospect', prospect), ('other', other), ('advisor', advisor), ('admin', admin), ('mine', mine), ('theirs', theirs);
END $$;

-- ---------- redaction ----------
DO $$
DECLARE
  r record;
BEGIN
  -- The same cases as src/lib/monitoring.test.ts: the two copies must agree.
  FOR r IN SELECT * FROM (VALUES
    ('Failed for pat@example.com', 'Failed for [email]'),
    ('GET https://x.supabase.co/storage/v1/object/sign/documents/a.csv?token=abc failed', 'GET [link] failed'),
    ('SSN 123-45-6789, salary 85000, DOB 1985-03-12', 'SSN [number], salary [number], DOB [number]'),
    ('phone (555) 123-4567', 'phone ([number]'),
    ('token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 here', 'token [id] here'),
    ('session 7916ade0-1b89-4e99-ba87-c520483d7fd2', 'session [id]'),
    ('status 503 and 42', 'status 503 and 42'),
    (E'  TypeError:\n  x is   undefined ', 'TypeError: x is undefined')
  ) AS t(input, expected) LOOP
    PERFORM pg_temp.check(public.ops_redact(r.input) = r.expected, format('ops_redact(%L) = %L, got %L', r.input, r.expected, public.ops_redact(r.input)));
  END LOOP;
  PERFORM pg_temp.check(length(public.ops_redact(repeat('word ', 200))) = 300, 'cut to 300');
  PERFORM pg_temp.check(public.ops_redact('   ') IS NULL AND public.ops_redact(NULL) IS NULL, 'empty is null');
  PERFORM pg_temp.check(public.ops_clean_code('storage_upload:500 <b>') = 'storage_upload:500b', 'code characters only');
  PERFORM pg_temp.check(public.ops_clean_code('') IS NULL, 'empty code is null');
  RAISE NOTICE 'ops_monitoring: redaction cases passed';
END $$;

-- ---------- reporting from the browser ----------
DO $$
DECLARE
  prospect uuid := (SELECT id FROM fx WHERE name = 'prospect');
  advisor uuid := (SELECT id FROM fx WHERE name = 'advisor');
  mine uuid := (SELECT id FROM fx WHERE name = 'mine');
  theirs uuid := (SELECT id FROM fx WHERE name = 'theirs');
  e public.ops_events;
BEGIN
  PERFORM pg_temp.as_user(prospect);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.check(pg_temp.state_of($q$SELECT public.report_client_event('made_up')$q$) = '22023', 'unknown kind');
  PERFORM pg_temp.check(pg_temp.state_of($q$SELECT public.report_client_event('deletion_failed')$q$) = '22023', 'a server-only kind');
  PERFORM pg_temp.check(pg_temp.state_of($q$SELECT public.report_client_event(NULL)$q$) = '22023', 'no kind');
  PERFORM pg_temp.check(public.report_client_event('upload_failed', 'storage_upload:500 !!', 'for pat@example.com at https://x/sign?token=abc',
    '/start?session=abc#t=secret', mine), 'a report is kept');
  PERFORM pg_temp.check(public.report_client_event('app_error', 'render_error', NULL, '/start', theirs), 'a report naming another intake');
  -- Direct writes are refused, and the caller can't read what they reported.
  PERFORM pg_temp.check(pg_temp.state_of($q$INSERT INTO public.ops_events (kind, source) VALUES ('app_error', 'browser')$q$) = '42501', 'direct insert');
  PERFORM pg_temp.check((SELECT count(*) FROM public.ops_events) = 0, 'a prospect reads no events');
  PERFORM pg_temp.check(pg_temp.state_of($q$SELECT public.record_ops_event('ai_failed', 'chamber-extract')$q$) = '42501',
    'a prospect cannot record as a function');
  RESET ROLE;

  SELECT * INTO e FROM public.ops_events WHERE kind = 'upload_failed';
  PERFORM pg_temp.check(e.source = 'browser' AND e.user_id = prospect AND e.session_id = mine, 'who and which intake');
  PERFORM pg_temp.check(e.code = 'storage_upload:500', format('code cleaned: %s', e.code));
  PERFORM pg_temp.check(e.detail = 'for [email] at [link]', format('detail redacted: %s', e.detail));
  PERFORM pg_temp.check(e.route = '/start', format('path only: %s', e.route));
  PERFORM pg_temp.check((SELECT session_id IS NULL FROM public.ops_events WHERE kind = 'app_error' AND user_id = prospect),
    'an intake the caller cannot see is dropped');

  PERFORM pg_temp.as_user(advisor);
  SET LOCAL ROLE authenticated;
  PERFORM public.report_client_event('auth_denied', 'advisor_forbidden', 'submission', '/advisor/submissions/x', theirs);
  RESET ROLE;
  PERFORM pg_temp.check((SELECT session_id = theirs FROM public.ops_events WHERE user_id = advisor), 'an advisor may name any intake');

  -- Signed-out visitors report too (an error on the landing page), without an intake.
  PERFORM pg_temp.signed_out();
  SET LOCAL ROLE anon;
  PERFORM pg_temp.check(public.report_client_event('app_error', 'window_error', 'TypeError: x', '/', mine), 'anon reports');
  RESET ROLE;
  PERFORM pg_temp.check((SELECT session_id IS NULL AND user_id IS NULL FROM public.ops_events WHERE source = 'browser' AND user_id IS NULL),
    'a signed-out report names no intake');
  DELETE FROM public.ops_events;
  RAISE NOTICE 'ops_monitoring: report cases passed';
END $$;

-- ---------- caps ----------
DO $$
DECLARE
  prospect uuid := (SELECT id FROM fx WHERE name = 'prospect');
  other uuid := (SELECT id FROM fx WHERE name = 'other');
  i integer;
BEGIN
  PERFORM pg_temp.as_user(prospect);
  SET LOCAL ROLE authenticated;
  FOR i IN 1..30 LOOP
    PERFORM pg_temp.check(public.report_client_event('app_error', 'c' || i), format('report %s kept', i));
  END LOOP;
  PERFORM pg_temp.check(NOT public.report_client_event('app_error', 'one_too_many'), 'the 31st in an hour is dropped');
  RESET ROLE;
  PERFORM pg_temp.check((SELECT count(*) FROM public.ops_events WHERE user_id = prospect) = 30, 'thirty kept');
  -- An hour later the account may report again.
  UPDATE public.ops_events SET created_at = now() - interval '61 minutes' WHERE user_id = prospect;
  PERFORM pg_temp.as_user(prospect);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.check(public.report_client_event('app_error', 'later'), 'kept after an hour');
  RESET ROLE;

  -- Another account is not held back by the first one's cap.
  PERFORM pg_temp.as_user(other);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.check(public.report_client_event('app_error', 'other'), 'another account');
  RESET ROLE;

  -- Signed-out visitors share 200 an hour.
  PERFORM pg_temp.seed('app_error', 200, interval '1 minute', 'browser', 'x');
  PERFORM pg_temp.signed_out();
  SET LOCAL ROLE anon;
  PERFORM pg_temp.check(NOT public.report_client_event('app_error', 'anon'), 'signed-out cap');
  RESET ROLE;

  -- Everyone together, 2000 an hour.
  DELETE FROM public.ops_events;
  INSERT INTO public.ops_events (kind, source, code, user_id)
  SELECT 'app_error', 'browser', 'x', gen_random_uuid() FROM generate_series(1, 2000);
  PERFORM pg_temp.as_user(other);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.check(NOT public.report_client_event('app_error', 'flood'), 'overall cap');
  RESET ROLE;
  DELETE FROM public.ops_events;
  RAISE NOTICE 'ops_monitoring: cap cases passed';
END $$;

-- ---------- reporting from edge functions ----------
DO $$
BEGIN
  SET LOCAL ROLE service_role;
  PERFORM public.record_ops_event('ai_failed', 'chamber-extract', 'timeout:-', 'provider pat@example.com', (SELECT id FROM fx WHERE name = 'prospect'));
  PERFORM pg_temp.check(pg_temp.state_of($q$SELECT public.record_ops_event('ai_failed', 'browser')$q$) = '22023', 'functions cannot pose as the browser');
  PERFORM pg_temp.check(pg_temp.state_of($q$SELECT public.record_ops_event('made_up', 'chamber-extract')$q$) = '23514', 'unknown kind');
  RESET ROLE;
  PERFORM pg_temp.check((SELECT detail = 'provider [email]' AND code = 'timeout:-' FROM public.ops_events WHERE source = 'chamber-extract'),
    'a function report is redacted too');

  PERFORM pg_temp.signed_out();
  SET LOCAL ROLE anon;
  PERFORM pg_temp.check(pg_temp.state_of($q$SELECT public.record_ops_event('ai_failed', 'chamber-extract')$q$) = '42501', 'anon');
  RESET ROLE;
  DELETE FROM public.ops_events;
  RAISE NOTICE 'ops_monitoring: function report cases passed';
END $$;

-- ---------- alerts ----------
DO $$
DECLARE
  r record;
  n integer;
BEGIN
  -- 4 AI failures in the window: under the threshold of 5. Older ones don't count.
  PERFORM pg_temp.seed('ai_failed', 4, interval '5 minutes', 'chamber-extract', 'timeout:-');
  PERFORM pg_temp.seed('ai_failed', 10, interval '20 minutes', 'chamber-extract', 'old');
  PERFORM pg_temp.seed('app_error', 9, interval '1 minute', 'browser', 'render_error');
  SET LOCAL ROLE service_role;
  SELECT count(*) INTO n FROM public.claim_ops_alerts();
  RESET ROLE;
  PERFORM pg_temp.check(n = 0, format('nothing over its threshold (%s)', n));

  -- The fifth crosses it: one alert, with the most frequent codes, recorded.
  PERFORM pg_temp.seed('ai_failed', 1, interval '1 minute', 'document-extract', 'provider_error:503');
  SET LOCAL ROLE service_role;
  SELECT count(*) INTO n FROM public.claim_ops_alerts();
  RESET ROLE;
  PERFORM pg_temp.check(n = 1, format('one alert (%s)', n));
  SELECT * INTO r FROM public.ops_alerts;
  PERFORM pg_temp.check(r.kind = 'ai_failed' AND r.event_count = 5 AND r.window_minutes = 15 AND r.threshold = 5, 'the alert as raised');
  PERFORM pg_temp.check(r.top_codes = 'timeout:- x4, provider_error:503 x1', format('top codes: %s', r.top_codes));

  -- Within its cooldown it isn't raised again, even with more events.
  PERFORM pg_temp.seed('ai_failed', 20, interval '1 minute');
  SET LOCAL ROLE service_role;
  SELECT count(*) INTO n FROM public.claim_ops_alerts();
  RESET ROLE;
  PERFORM pg_temp.check(n = 0, 'cooldown');

  -- After the cooldown, a kind still over its threshold is raised again.
  UPDATE public.ops_alerts SET raised_at = now() - interval '61 minutes';
  SET LOCAL ROLE service_role;
  SELECT count(*) INTO n FROM public.claim_ops_alerts() a WHERE a.kind = 'ai_failed' AND a.event_count = 25;
  RESET ROLE;
  PERFORM pg_temp.check(n = 1, 'raised again after the cooldown');

  -- One failed deletion is enough.
  PERFORM pg_temp.seed('deletion_failed', 1, interval '1 minute', 'purge-intakes', 'storage_remove:500');
  SET LOCAL ROLE service_role;
  SELECT count(*) INTO n FROM public.claim_ops_alerts() a WHERE a.kind = 'deletion_failed';
  RESET ROLE;
  PERFORM pg_temp.check(n = 1, 'a deletion failure alerts at once');

  -- Nobody but the service role can claim alerts.
  PERFORM pg_temp.as_user((SELECT id FROM fx WHERE name = 'admin'));
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.check(pg_temp.state_of('SELECT * FROM public.claim_ops_alerts()') = '42501', 'an admin cannot claim alerts');
  RESET ROLE;
  RAISE NOTICE 'ops_monitoring: alert cases passed';
END $$;

-- ---------- reading ----------
DO $$
DECLARE
  n integer;
BEGIN
  PERFORM pg_temp.as_user((SELECT id FROM fx WHERE name = 'admin'));
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.check((SELECT count(*) FROM public.ops_events) > 0, 'an admin reads events');
  PERFORM pg_temp.check((SELECT count(*) FROM public.ops_alerts) = 3, 'an admin reads alerts');
  SELECT count(*) INTO n FROM public.admin_ops_summary(24) s WHERE s.kind = 'ai_failed' AND s.code = 'timeout' AND s.events = 20;
  PERFORM pg_temp.check(n = 1, 'the summary counts by kind, source and code');
  PERFORM pg_temp.check(pg_temp.state_of('SELECT * FROM public.admin_ops_summary(0)') = '22023', 'p_hours too small');
  PERFORM pg_temp.check(pg_temp.state_of('SELECT * FROM public.admin_ops_summary(721)') = '22023', 'p_hours too large');
  RESET ROLE;

  FOREACH n IN ARRAY ARRAY[1, 2] LOOP
    PERFORM pg_temp.as_user((SELECT id FROM fx WHERE name = CASE n WHEN 1 THEN 'advisor' ELSE 'prospect' END));
    SET LOCAL ROLE authenticated;
    PERFORM pg_temp.check((SELECT count(*) FROM public.ops_events) = 0 AND (SELECT count(*) FROM public.ops_alerts) = 0,
      'advisors and prospects read no events or alerts');
    PERFORM pg_temp.check(pg_temp.state_of('SELECT * FROM public.admin_ops_summary()') = '42501', 'the summary is for admins');
    RESET ROLE;
  END LOOP;

  -- An admin presenting a guest token is a guest.
  PERFORM pg_temp.as_user((SELECT id FROM fx WHERE name = 'admin'), true);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.check((SELECT count(*) FROM public.ops_events) = 0, 'admin with a guest token');
  RESET ROLE;
  PERFORM pg_temp.signed_out();
  RAISE NOTICE 'ops_monitoring: reading cases passed';
END $$;

-- ---------- AI failures come from the AI call records ----------
DO $$
DECLARE
  prospect uuid := (SELECT id FROM fx WHERE name = 'prospect');
  r record;
  n integer;
BEGIN
  DELETE FROM public.ops_alerts WHERE kind = 'ai_failed';
  DELETE FROM public.ops_events WHERE kind = 'ai_failed';
  -- Refusals are the caller's limits, not failures: none of these counts.
  INSERT INTO public.ai_extraction_events (request_id, function_name, user_id, outcome, error_code, http_status)
  SELECT gen_random_uuid(), 'chamber-extract', prospect, 'error', c, 429
  FROM unnest(ARRAY['bad_request', 'unauthorized', 'not_found', 'rate_limited', 'daily_cap']) c, generate_series(1, 3);
  INSERT INTO public.ai_extraction_events (request_id, function_name, user_id, outcome, http_status)
  SELECT gen_random_uuid(), 'chamber-extract', prospect, 'ok', 200 FROM generate_series(1, 10);
  -- Three failures on our side or the provider's, and one an hour ago: under the threshold of 5.
  INSERT INTO public.ai_extraction_events (request_id, function_name, user_id, outcome, error_code, http_status, created_at)
  VALUES (gen_random_uuid(), 'chamber-extract', prospect, 'error', 'timeout', 504, now()),
         (gen_random_uuid(), 'document-extract', prospect, 'error', 'provider_error', 502, now()),
         (gen_random_uuid(), 'chamber-extract', prospect, 'error', 'unavailable', 503, now()),
         (gen_random_uuid(), 'chamber-extract', prospect, 'error', 'timeout', 504, now() - interval '1 hour');
  SET LOCAL ROLE service_role;
  SELECT count(*) INTO n FROM public.claim_ops_alerts() a WHERE a.kind = 'ai_failed';
  RESET ROLE;
  PERFORM pg_temp.check(n = 0, 'refusals, successes and old failures don''t alert');

  -- A browser report of a call that never reached the function counts with them; five in the window alert.
  INSERT INTO public.ai_extraction_events (request_id, function_name, user_id, outcome, error_code, http_status)
  VALUES (gen_random_uuid(), 'chamber-extract', prospect, 'error', 'invalid_response', 502);
  PERFORM pg_temp.as_user(prospect);
  SET LOCAL ROLE authenticated;
  PERFORM public.report_client_event('ai_failed', 'chat_unreachable');
  RESET ROLE;
  SET LOCAL ROLE service_role;
  SELECT * INTO r FROM public.claim_ops_alerts() a WHERE a.kind = 'ai_failed';
  RESET ROLE;
  PERFORM pg_temp.check(r.event_count = 5, format('five AI failures counted (%s)', r.event_count));
  PERFORM pg_temp.check(r.top_codes = 'chamber-extract:invalid_response x1, chamber-extract:timeout x1, chamber-extract:unavailable x1, chat_unreachable x1, document-extract:provider_error x1',
    format('codes: %s', r.top_codes));

  -- The admin's summary shows them too, by function.
  PERFORM pg_temp.as_user((SELECT id FROM fx WHERE name = 'admin'));
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.admin_ops_summary(1) s WHERE s.kind = 'ai_failed' AND s.source = 'document-extract' AND s.code = 'document-extract:provider_error';
  RESET ROLE;
  PERFORM pg_temp.check(n = 1, 'the summary includes AI call failures');
  PERFORM pg_temp.signed_out();
  RAISE NOTICE 'ops_monitoring: AI call record cases passed';
END $$;

DO $$ BEGIN RAISE NOTICE 'ops_monitoring: all cases passed'; END $$;
