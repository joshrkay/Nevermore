-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh certification_conflicts
-- A required answer in conflict blocks certification (B-2, D26, 20261104100000_certification_conflicts.sql):
-- which fields count, that the prospect can't certify while one is in conflict, that the refusal names them
-- and changes nothing, that missing answers are still named first, and that a recommended field's conflict,
-- other saves, an existing certification and privileged writes are untouched. Everything a prospect does
-- runs as `authenticated` with their JWT claims, so row security is on.
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
SET client_min_messages = notice;

-- ---------- helpers ----------
CREATE FUNCTION pg_temp.as_user(uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', uid, 'is_anonymous', false, 'role', 'authenticated', 'email', uid || '@example.test')::text, false);
END $$;

-- A verified prospect who has agreed to the intake consent, as the Chamber requires before an intake starts.
CREATE FUNCTION pg_temp.new_prospect() RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', uid || '@example.test', false, now(), now());
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');
  RESET ROLE;
  RETURN uid;
END $$;

CREATE FUNCTION pg_temp.snap(sid uuid) RETURNS jsonb LANGUAGE sql AS
  $$ SELECT to_jsonb(s) FROM public.chamber_sessions s WHERE s.id = sid $$;

CREATE FUNCTION pg_temp.certification(data jsonb) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'signer_name', 'Jo Doe', 'signer_title', 'CEO', 'signed_at', '2026-11-01T12:00:00Z', 'file_id', 'EAA-2026-TEST',
    'consent_version', '2026-10-draft-1', 'consent_text', '["I certify."]'::jsonb, 'chamber_data', data)
$$;

-- Certifies sid over its saved answers as the signed-in owner, as the Reckoning does (the provenance was saved
-- first and isn't sent). Returns 'ok', or the SQLSTATE and DETAIL it was refused with. A refusal must leave the
-- row and the certifications exactly as they were.
CREATE FUNCTION pg_temp.certify(sid uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  before_row jsonb := pg_temp.snap(sid);
  certs bigint := (SELECT count(*) FROM public.chamber_certifications WHERE session_id = sid);
  data jsonb := (SELECT chamber_data FROM public.chamber_sessions WHERE id = sid);
  s text; d text;
BEGIN
  BEGIN
    UPDATE public.chamber_sessions SET status = 'submitted', chamber_data = data, submission = pg_temp.certification(data) WHERE id = sid;
    RETURN 'ok';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, d = PG_EXCEPTION_DETAIL;
  END;
  IF pg_temp.snap(sid) IS DISTINCT FROM before_row THEN RAISE EXCEPTION 'FAIL: a refused certification changed the row'; END IF;
  IF (SELECT count(*) FROM public.chamber_certifications WHERE session_id = sid) <> certs THEN
    RAISE EXCEPTION 'FAIL: a refused certification was recorded';
  END IF;
  RETURN s || ' ' || coalesce(d, '');
END $$;

-- A field's provenance with the given status (a conflict carries its candidates, as the browser writes it).
CREATE FUNCTION pg_temp.prov(status text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT CASE WHEN status = 'conflicting' THEN jsonb_build_object(
    'status', status, 'source', '{"kind":"transcript","message_id":"m1"}'::jsonb, 'updated_at', '2026-11-01T12:00:00Z',
    'candidates', '[{"value":"Acme","source":{"kind":"transcript","message_id":"m1"}},{"value":"Acme LLC","source":{"kind":"document","document_id":"d1"}}]'::jsonb)
  ELSE jsonb_build_object('status', status, 'source', '{"kind":"prospect_edit"}'::jsonb, 'updated_at', '2026-11-01T12:00:00Z') END
$$;

-- ---------- which fields count as in conflict ----------
DO $$
DECLARE
  cases jsonb[] := ARRAY[
    '{}',
    jsonb_build_object('company_name', pg_temp.prov('conflicting')),
    jsonb_build_object('company_name', pg_temp.prov('confirmed'), 'states', pg_temp.prov('inferred'), 'pay_frequency', pg_temp.prov('incomplete')),
    jsonb_build_object('pay_frequency', pg_temp.prov('conflicting'), 'company_name', pg_temp.prov('conflicting'), 'states', pg_temp.prov('conflicting')),
    -- A recommended field in conflict is an open item, not a blocker.
    jsonb_build_object('employee_count', pg_temp.prov('conflicting'), 'industry', pg_temp.prov('conflicting')),
    jsonb_build_object('states', pg_temp.prov('conflicting'), 'industry', pg_temp.prov('conflicting')),
    -- Malformed provenance holds no conflict.
    '{"company_name":"conflicting"}', '{"company_name":{"status":["conflicting"]}}', '[]', 'null', '"text"'
  ]::jsonb[];
  expected text[] := ARRAY[
    '{}',
    '{company_name}',
    '{}',
    '{company_name,states,pay_frequency}',
    '{}',
    '{states}',
    '{}', '{}', '{}', '{}', '{}'
  ];
  got text[];
BEGIN
  FOR i IN 1 .. array_length(cases, 1) LOOP
    got := public.intake_conflicting_required(cases[i]);
    IF got IS DISTINCT FROM expected[i]::text[] THEN
      RAISE EXCEPTION 'FAIL: intake_conflicting_required(%) = %, expected %', cases[i], got, expected[i];
    END IF;
  END LOOP;
  IF public.intake_conflicting_required(NULL) IS DISTINCT FROM '{}'::text[] THEN RAISE EXCEPTION 'FAIL: NULL provenance'; END IF;
  RAISE NOTICE 'certification_conflicts: % conflict cases passed', array_length(cases, 1) + 1;
END $$;

-- ---------- the prospect can't certify until each conflict is settled ----------
DO $$
DECLARE
  uid uuid := pg_temp.new_prospect();
  sid uuid;
  complete jsonb := '{"company_name":"Acme","states":["NY"],"pay_frequency":"bi-weekly","industry":"Bookbinding"}';
  outcome text;
BEGIN
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.chamber_sessions (user_id, chamber_data, field_provenance)
  VALUES (uid, complete, jsonb_build_object('company_name', pg_temp.prov('conflicting'))) RETURNING id INTO sid;

  outcome := pg_temp.certify(sid);
  IF outcome <> 'EA008 company_name' THEN RAISE EXCEPTION 'FAIL: certifying a conflicting company name gave %', outcome; END IF;

  -- Two of them, named in the fixed order.
  UPDATE public.chamber_sessions SET field_provenance = jsonb_build_object(
    'pay_frequency', pg_temp.prov('conflicting'), 'company_name', pg_temp.prov('conflicting')) WHERE id = sid;
  outcome := pg_temp.certify(sid);
  IF outcome <> 'EA008 company_name,pay_frequency' THEN RAISE EXCEPTION 'FAIL: two conflicts gave %', outcome; END IF;

  -- A missing answer is named first, as before: the prospect adds it, then settles the conflict.
  UPDATE public.chamber_sessions SET chamber_data = '{"company_name":"Acme","states":["NY"]}' WHERE id = sid;
  outcome := pg_temp.certify(sid);
  IF outcome <> 'EA003 pay_frequency' THEN RAISE EXCEPTION 'FAIL: missing and conflicting gave %', outcome; END IF;
  UPDATE public.chamber_sessions SET chamber_data = complete WHERE id = sid;

  -- Settled: picked by the prospect, so confirmed. A conflict on a recommended field doesn't block.
  UPDATE public.chamber_sessions SET field_provenance = jsonb_build_object(
    'company_name', pg_temp.prov('confirmed'), 'pay_frequency', pg_temp.prov('inferred'), 'industry', pg_temp.prov('conflicting')) WHERE id = sid;
  outcome := pg_temp.certify(sid);
  IF outcome <> 'ok' THEN RAISE EXCEPTION 'FAIL: a settled intake could not be certified: %', outcome; END IF;
  IF (SELECT status FROM public.chamber_sessions WHERE id = sid) <> 'submitted' THEN RAISE EXCEPTION 'FAIL: not submitted'; END IF;

  -- A conflict that appears after certifying (Lenore heard a different name; the answers didn't change)
  -- is an ordinary save and leaves the certification standing.
  UPDATE public.chamber_sessions SET field_provenance = jsonb_build_object('company_name', pg_temp.prov('conflicting')) WHERE id = sid;
  IF (SELECT status FROM public.chamber_sessions WHERE id = sid) <> 'submitted' THEN RAISE EXCEPTION 'FAIL: a later conflict withdrew the certification'; END IF;

  -- But signing again over it is refused.
  outcome := pg_temp.certify(sid);
  IF outcome <> 'EA008 company_name' THEN RAISE EXCEPTION 'FAIL: re-certifying over a conflict gave %', outcome; END IF;
  RESET ROLE;
  RAISE NOTICE 'certification_conflicts: prospect cases passed';
END $$;

-- ---------- what isn't checked ----------
DO $$
DECLARE
  uid uuid := pg_temp.new_prospect();
  sid uuid;
  complete jsonb := '{"company_name":"Acme","states":["NY"],"pay_frequency":"bi-weekly"}';
BEGIN
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.chamber_sessions (user_id, chamber_data, field_provenance)
  VALUES (uid, complete, jsonb_build_object('states', pg_temp.prov('conflicting'))) RETURNING id INTO sid;
  -- Ordinary saves of an intake with a conflict are fine: only certifying is checked.
  UPDATE public.chamber_sessions SET chamber_data = complete || '{"industry":"Print"}' WHERE id = sid;
  RESET ROLE;

  -- Privileged writes (a job, a migration, an operator) are not checked.
  PERFORM set_config('request.jwt.claims', '', false);
  UPDATE public.chamber_sessions SET status = 'submitted', submission = pg_temp.certification(complete || '{"industry":"Print"}') WHERE id = sid;
  IF (SELECT status FROM public.chamber_sessions WHERE id = sid) <> 'submitted' THEN RAISE EXCEPTION 'FAIL: a privileged certification was refused'; END IF;
  RAISE NOTICE 'certification_conflicts: unchecked cases passed';
END $$;

DO $$ BEGIN RAISE NOTICE 'certification_conflicts: all cases passed'; END $$;
