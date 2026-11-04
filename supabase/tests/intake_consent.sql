-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh intake_consent
-- Intake consent (US-6.2): recording an agreement (who, which wording, the server's time, once per version),
-- the database refusing a new intake or document from the browser without one, the intake keeping the
-- agreement it was started under, intakes from before consent existed, and who can read the records.
-- Everything a prospect does runs as `authenticated` with their JWT claims, so row security is on.
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
\i supabase/migrations/20261027090100_outbox_operations.sql
\i supabase/migrations/20261027100000_outbox_schedule.sql
\i supabase/migrations/20261028090000_email_delivery_events.sql
\i supabase/migrations/20261029090000_document_ingestion.sql
\i supabase/migrations/20261029091000_census_advisor_review.sql
\i supabase/migrations/20261029092000_census_in_intake_validation.sql
\i supabase/migrations/20261103090000_intake_lifecycle.sql
\i supabase/migrations/20261103091000_intake_schema_version.sql
\i supabase/migrations/20261103100000_chosen_peo.sql
\i supabase/migrations/20261103110000_certification_readiness.sql
\i supabase/migrations/20261103110100_document_storage_path.sql
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

-- The SQLSTATE stmt raises, or 'ok'. The statement runs as whatever role and claims are current.
CREATE FUNCTION pg_temp.state_of(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE s text;
BEGIN
  EXECUTE stmt;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE;
  RETURN s;
END $$;

-- The DETAIL stmt raises with, or null.
CREATE FUNCTION pg_temp.detail_of(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE d text;
BEGIN
  EXECUTE stmt;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS d = PG_EXCEPTION_DETAIL;
  RETURN d;
END $$;

CREATE FUNCTION pg_temp.check(ok boolean, what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT COALESCE(ok, false) THEN RAISE EXCEPTION 'FAIL: %', what; END IF;
END $$;

CREATE TEMP TABLE fx (name text PRIMARY KEY, id uuid);
GRANT SELECT ON fx TO authenticated, service_role, anon;

DO $$
DECLARE
  advisor uuid := pg_temp.new_user('advisor@example.test');
BEGIN
  INSERT INTO fx VALUES
    ('guest', pg_temp.new_user('guest', true)),
    ('prospect', pg_temp.new_user('prospect@example.test')),
    ('other', pg_temp.new_user('other@example.test')),
    ('advisor', advisor);
  INSERT INTO public.user_roles (user_id, role) VALUES (advisor, 'advisor');
  -- An intake started before consent existed: written by a privileged role, so it has no agreement.
  WITH r AS (
    INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES ((SELECT id FROM fx WHERE name = 'prospect'), '{"company_name":"Legacy Co"}')
    RETURNING id)
  INSERT INTO fx SELECT 'legacy', id FROM r;
END $$;

-- ---------- the version in force ----------
DO $$
BEGIN
  PERFORM pg_temp.check(public.intake_consent_version() = '2026-11-draft-1', 'intake_consent_version');
  PERFORM pg_temp.check((SELECT intake_consent_id IS NULL FROM public.chamber_sessions WHERE id = (SELECT id FROM fx WHERE name = 'legacy')),
    'an intake written by a privileged role gets no agreement');
  RAISE NOTICE 'intake_consent: version cases passed';
END $$;

-- ---------- nothing starts without an agreement ----------
DO $$
DECLARE
  guest uuid := (SELECT id FROM fx WHERE name = 'guest');
  prospect uuid := (SELECT id FROM fx WHERE name = 'prospect');
  legacy uuid := (SELECT id FROM fx WHERE name = 'legacy');
BEGIN
  PERFORM pg_temp.as_user(guest, true);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.check(pg_temp.state_of(format('INSERT INTO public.chamber_sessions (user_id) VALUES (%L)', guest)) = 'EA004',
    'a guest with no agreement starts an intake');
  PERFORM pg_temp.check(pg_temp.detail_of(format('INSERT INTO public.chamber_sessions (user_id) VALUES (%L)', guest)) = '2026-11-draft-1',
    'EA004 names the version needed');
  RESET ROLE;

  -- The prospect's own old intake still saves, and still takes no document, without an agreement.
  PERFORM pg_temp.as_user(prospect);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.check(pg_temp.state_of(format(
    'UPDATE public.chamber_sessions SET chamber_data = %L WHERE id = %L', '{"company_name":"Legacy Co, edited"}', legacy)) = 'ok',
    'an intake from before consent existed saves');
  PERFORM pg_temp.check((SELECT intake_consent_id IS NULL FROM public.chamber_sessions WHERE id = legacy), 'it still has no agreement');
  PERFORM pg_temp.check(pg_temp.state_of(format(
    'INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path) VALUES (%L, %L, %L, %L, %L)',
    prospect, legacy, 'census.csv', '1 KB', prospect || '/' || legacy || '/a_census.csv')) = 'EA004',
    'a document without an agreement');
  -- The file itself, which the browser stores before its row, is refused too.
  PERFORM pg_temp.check(pg_temp.state_of(format('INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)',
    'documents', prospect || '/' || legacy || '/a_census.csv')) = '42501', 'a stored file without an agreement');
  RESET ROLE;

  -- Someone else's row is row security's to refuse, with nothing said about agreements.
  PERFORM pg_temp.as_user(guest, true);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.check(pg_temp.state_of(format('INSERT INTO public.chamber_sessions (user_id) VALUES (%L)', prospect)) = '42501',
    'an intake for another account is refused by row security');
  RESET ROLE;
  PERFORM pg_temp.signed_out();
  RAISE NOTICE 'intake_consent: refusal cases passed';
END $$;

-- ---------- recording an agreement ----------
DO $$
DECLARE
  guest uuid := (SELECT id FROM fx WHERE name = 'guest');
  first_at timestamptz;
  again_at timestamptz;
  c public.intake_consents;
BEGIN
  PERFORM pg_temp.signed_out();
  SET LOCAL ROLE anon;
  PERFORM pg_temp.check(pg_temp.state_of($q$SELECT public.record_intake_consent('2026-11-draft-1', 'I agree')$q$) = '42501',
    'anon cannot call record_intake_consent');
  RESET ROLE;
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.check(pg_temp.state_of($q$SELECT public.record_intake_consent('2026-11-draft-1', 'I agree')$q$) = '42501',
    'signed out');
  RESET ROLE;

  PERFORM pg_temp.as_user(guest, true);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.check(pg_temp.state_of($q$SELECT public.record_intake_consent('2026-10-draft-0', 'I agree')$q$) = 'EA005',
    'an older wording is refused');
  PERFORM pg_temp.check(pg_temp.detail_of($q$SELECT public.record_intake_consent('2026-10-draft-0', 'I agree')$q$) = '2026-11-draft-1',
    'EA005 names the version in force');
  PERFORM pg_temp.check(pg_temp.state_of($q$SELECT public.record_intake_consent(NULL, 'I agree')$q$) = 'EA005', 'no version');
  PERFORM pg_temp.check(pg_temp.state_of($q$SELECT public.record_intake_consent('2026-11-draft-1', '   ')$q$) = '22023', 'no wording');
  PERFORM pg_temp.check(pg_temp.state_of(format('SELECT public.record_intake_consent(%L, %L)', '2026-11-draft-1', repeat('x', 20001))) = '22023',
    'wording too long');

  first_at := public.record_intake_consent('2026-11-draft-1', '  Who we are: ...  I agree.  ');
  PERFORM pg_temp.check(first_at BETWEEN now() - interval '1 minute' AND clock_timestamp(), 'the server stamps the time');
  PERFORM pg_sleep(0.01);
  again_at := public.record_intake_consent('2026-11-draft-1', 'Different words');
  PERFORM pg_temp.check(again_at = first_at, 'agreeing again returns the first time');
  SELECT * INTO c FROM public.intake_consents WHERE user_id = guest;
  PERFORM pg_temp.check((SELECT count(*) FROM public.intake_consents WHERE user_id = guest) = 1, 'one row per account and version');
  PERFORM pg_temp.check(c.consent_text = 'Who we are: ...  I agree.' AND c.consent_version = '2026-11-draft-1', 'the first wording is kept, trimmed');

  -- The table itself takes no writes from the browser.
  PERFORM pg_temp.check(pg_temp.state_of(format(
    'INSERT INTO public.intake_consents (user_id, consent_version, consent_text) VALUES (%L, %L, %L)', guest, 'x', 'y')) = '42501',
    'direct insert');
  PERFORM pg_temp.check(pg_temp.state_of($q$UPDATE public.intake_consents SET accepted_at = now() - interval '1 year'$q$) = '42501', 'direct update');
  PERFORM pg_temp.check(pg_temp.state_of($q$DELETE FROM public.intake_consents$q$) = '42501', 'direct delete');
  RESET ROLE;
  PERFORM pg_temp.signed_out();
  RAISE NOTICE 'intake_consent: recording cases passed';
END $$;

-- ---------- an intake keeps the agreement it was started under ----------
DO $$
DECLARE
  guest uuid := (SELECT id FROM fx WHERE name = 'guest');
  prospect uuid := (SELECT id FROM fx WHERE name = 'prospect');
  legacy uuid := (SELECT id FROM fx WHERE name = 'legacy');
  agreed uuid := (SELECT id FROM public.intake_consents WHERE user_id = (SELECT id FROM fx WHERE name = 'guest'));
  sid uuid;
  prospect_agreed uuid;
BEGIN
  PERFORM pg_temp.as_user(guest, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.chamber_sessions (user_id, intake_consent_id) VALUES (guest, gen_random_uuid()) RETURNING id INTO sid;
  PERFORM pg_temp.check((SELECT intake_consent_id FROM public.chamber_sessions WHERE id = sid) = agreed,
    'the new intake records the agreement, whatever the browser sends');
  UPDATE public.chamber_sessions SET intake_consent_id = NULL, chamber_data = '{"company_name":"Guest Co"}' WHERE id = sid;
  PERFORM pg_temp.check((SELECT intake_consent_id FROM public.chamber_sessions WHERE id = sid) = agreed,
    'the browser cannot clear or change it');
  PERFORM pg_temp.check(pg_temp.state_of(format(
    'INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path) VALUES (%L, %L, %L, %L, %L)',
    guest, sid, 'census.csv', '1 KB', guest || '/' || sid || '/a_census.csv')) = 'ok',
    'a document once agreed');
  RESET ROLE;
  INSERT INTO fx VALUES ('guest_intake', sid);

  -- The legacy intake takes its owner's agreement on the first save after it.
  PERFORM pg_temp.as_user(prospect);
  SET LOCAL ROLE authenticated;
  PERFORM public.record_intake_consent('2026-11-draft-1', 'I agree');
  SELECT id INTO prospect_agreed FROM public.intake_consents WHERE user_id = prospect;
  UPDATE public.chamber_sessions SET chamber_data = '{"company_name":"Legacy Co, again"}' WHERE id = legacy;
  PERFORM pg_temp.check((SELECT intake_consent_id FROM public.chamber_sessions WHERE id = legacy) = prospect_agreed,
    'an old intake records the agreement on its next save');
  PERFORM pg_temp.check(pg_temp.state_of(format('INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)',
    'documents', prospect || '/' || legacy || '/a_census.csv')) = 'ok', 'a stored file once agreed');
  RESET ROLE;

  -- Privileged writers are not asked: the service role starts an intake for an account with no agreement.
  SET LOCAL ROLE service_role;
  INSERT INTO public.chamber_sessions (user_id) VALUES ((SELECT id FROM fx WHERE name = 'other')) RETURNING id INTO sid;
  RESET ROLE;
  PERFORM pg_temp.check((SELECT intake_consent_id IS NULL FROM public.chamber_sessions WHERE id = sid), 'a service-role intake');
  PERFORM pg_temp.signed_out();
  RAISE NOTICE 'intake_consent: stamping cases passed';
END $$;

-- ---------- who can read agreements ----------
DO $$
DECLARE
  n integer;
BEGIN
  PERFORM pg_temp.as_user((SELECT id FROM fx WHERE name = 'guest'), true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.intake_consents;
  RESET ROLE;
  PERFORM pg_temp.check(n = 1, format('the guest sees their own agreement only (%s)', n));

  PERFORM pg_temp.as_user((SELECT id FROM fx WHERE name = 'other'));
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.intake_consents;
  RESET ROLE;
  PERFORM pg_temp.check(n = 0, format('an account with none sees none (%s)', n));

  PERFORM pg_temp.as_user((SELECT id FROM fx WHERE name = 'advisor'));
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.intake_consents;
  RESET ROLE;
  PERFORM pg_temp.check(n = 2, format('an advisor sees every agreement (%s)', n));

  -- An advisor role presented with a guest token counts for nothing.
  PERFORM pg_temp.as_user((SELECT id FROM fx WHERE name = 'advisor'), true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.intake_consents;
  RESET ROLE;
  PERFORM pg_temp.check(n = 0, format('an advisor with a guest token (%s)', n));

  PERFORM pg_temp.signed_out();
  SET LOCAL ROLE anon;
  PERFORM pg_temp.check(pg_temp.state_of('SELECT count(*) FROM public.intake_consents') IN ('ok', '42501'), 'anon read');
  SELECT count(*) INTO n FROM public.intake_consents;
  RESET ROLE;
  PERFORM pg_temp.check(n = 0, 'anon sees none');
  RAISE NOTICE 'intake_consent: visibility cases passed';
END $$;

-- ---------- deleting an account ----------
DO $$
DECLARE
  guest uuid := (SELECT id FROM fx WHERE name = 'guest');
  sid uuid := (SELECT id FROM fx WHERE name = 'guest_intake');
BEGIN
  DELETE FROM public.documents WHERE user_id = guest;
  DELETE FROM auth.users WHERE id = guest;
  PERFORM pg_temp.check(NOT EXISTS (SELECT 1 FROM public.intake_consents WHERE user_id = guest), 'the agreements go with the account');
  PERFORM pg_temp.check((SELECT intake_consent_id IS NULL FROM public.chamber_sessions WHERE id = sid),
    'an intake left behind no longer points at them');
  RAISE NOTICE 'intake_consent: account deletion cases passed';
END $$;

DO $$ BEGIN RAISE NOTICE 'intake_consent: all cases passed'; END $$;
