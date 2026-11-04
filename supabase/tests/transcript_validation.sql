-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh transcript_validation
-- The transcript's shape (A-3, 20261104101000_transcript_validation.sql): what a message may hold, that a
-- refused write names the path and changes nothing, that the text is never echoed, and that a save which
-- leaves the transcript alone isn't checked. The prospect writes as `authenticated`, so row security is on.
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
SET client_min_messages = notice;

-- ---------- which transcripts are refused, and where ----------
DO $$
DECLARE
  ok jsonb := '{"id":"m1","sender":"user","text":"We have 12 people","timestamp":"2026-11-04T14:34:05.123Z"}';
  cases text[][] := ARRAY[
    -- transcript, expected path ('' for valid)
    ARRAY['[]', ''],
    ARRAY[format('[%s]', ok), ''],
    ARRAY['[{"id":"m1","sender":"lenore","text":"Hello.","kind":"greeting","timestamp":"02:34 PM"}]', ''],
    ARRAY['[{"id":"m1","sender":"system","text":"Voice call started","timestamp":"2026-11-04T14:34:05Z"}]', ''],
    ARRAY['[{"id":"m1","sender":"user","text":"twelve","spoken":true},{"id":"m2","sender":"lenore","text":"","spoken":false}]', ''],
    ARRAY['[{"id":"m1","sender":"user","text":"no timestamp at all"}]', ''],
    ARRAY['{}', 'transcript'],
    ARRAY['"text"', 'transcript'],
    ARRAY['["hello"]', 'transcript[0]'],
    ARRAY[format('[%s, {"id":"m2","sender":"assistant","text":"hi"}]', ok), 'transcript[1].sender'],
    ARRAY['[{"role":"user","content":"hello"}]', 'transcript[0].role'],
    ARRAY['[{"sender":"user","text":"hi"}]', 'transcript[0].id'],
    ARRAY['[{"id":"  ","sender":"user","text":"hi"}]', 'transcript[0].id'],
    ARRAY[format('[{"id":"%s","sender":"user","text":"hi"}]', repeat('x', 101)), 'transcript[0].id'],
    ARRAY['[{"id":7,"sender":"user","text":"hi"}]', 'transcript[0].id'],
    ARRAY['[{"id":"m1","text":"hi"}]', 'transcript[0].sender'],
    ARRAY['[{"id":"m1","sender":"user"}]', 'transcript[0].text'],
    ARRAY['[{"id":"m1","sender":"user","text":42}]', 'transcript[0].text'],
    ARRAY[format('[{"id":"m1","sender":"user","text":"%s"}]', repeat('a', 20001)), 'transcript[0].text'],
    ARRAY[format('[{"id":"m1","sender":"user","text":"%s"}]', repeat('a', 20000)), ''],
    ARRAY['[{"id":"m1","sender":"user","text":"hi","timestamp":1730730845}]', 'transcript[0].timestamp'],
    ARRAY[format('[{"id":"m1","sender":"user","text":"hi","timestamp":"%s"}]', repeat('9', 65)), 'transcript[0].timestamp'],
    ARRAY['[{"id":"m1","sender":"user","text":"hi","kind":"reply"}]', 'transcript[0].kind'],
    ARRAY['[{"id":"m1","sender":"user","text":"hi","spoken":"yes"}]', 'transcript[0].spoken'],
    ARRAY['[{"id":"m1","sender":"user","text":"hi","extraction":{"company_name":"Acme"}}]', 'transcript[0].extraction']
  ];
  got record;
BEGIN
  FOR i IN 1 .. array_length(cases, 1) LOOP
    SELECT * INTO got FROM public.chamber_transcript_error(cases[i][1]::jsonb);
    IF coalesce(got.path, '') <> cases[i][2] THEN
      RAISE EXCEPTION 'FAIL: chamber_transcript_error(%) = %, expected %', left(cases[i][1], 80), got.path, cases[i][2];
    END IF;
  END LOOP;
  SELECT * INTO got FROM public.chamber_transcript_error(NULL);
  IF got.path IS DISTINCT FROM 'transcript' THEN RAISE EXCEPTION 'FAIL: a NULL transcript passed'; END IF;
  RAISE NOTICE 'transcript_validation: % shape cases passed', array_length(cases, 1) + 1;
END $$;

-- ---------- what the prospect's writes get ----------
DO $$
DECLARE
  uid uuid := gen_random_uuid();
  sid uuid;
  before_row jsonb;
  s text; d text; h text; msg text;
  good jsonb := '[{"id":"m1","sender":"user","text":"SECRET-WORDS 12 staff","timestamp":"2026-11-04T14:34:05Z","spoken":true},{"id":"m2","sender":"system","text":"Voice call ended","timestamp":"2026-11-04T14:35:00Z"}]';
BEGIN
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', uid || '@example.test', false, now(), now());
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', uid, 'is_anonymous', false, 'role', 'authenticated', 'email', uid || '@example.test')::text, false);
  SET LOCAL ROLE authenticated;
  PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');

  -- An insert is checked too.
  BEGIN
    INSERT INTO public.chamber_sessions (user_id, transcript) VALUES (uid, '[{"id":"m1","sender":"bot","text":"hi"}]');
    RAISE EXCEPTION 'FAIL: an insert with an invalid message went through';
  EXCEPTION WHEN SQLSTATE 'EA001' THEN
    GET STACKED DIAGNOSTICS d = PG_EXCEPTION_DETAIL;
    IF d <> 'transcript[0].sender' THEN RAISE EXCEPTION 'FAIL: insert refused at %', d; END IF;
  END;

  INSERT INTO public.chamber_sessions (user_id, transcript) VALUES (uid, good) RETURNING id INTO sid;
  before_row := (SELECT to_jsonb(c) FROM public.chamber_sessions c WHERE c.id = sid);

  -- A refused save changes nothing, names the path and never repeats the message's words.
  BEGIN
    UPDATE public.chamber_sessions SET transcript = good || '[{"id":"m3","sender":"user","text":"SECRET-WORDS again","note":"x"}]',
      chamber_data = '{"company_name":"Acme"}' WHERE id = sid;
    RAISE EXCEPTION 'FAIL: an invalid message was saved';
  EXCEPTION WHEN SQLSTATE 'EA001' THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, d = PG_EXCEPTION_DETAIL, h = PG_EXCEPTION_HINT, msg = MESSAGE_TEXT;
  END;
  IF d <> 'transcript[2].note' THEN RAISE EXCEPTION 'FAIL: refused at %', d; END IF;
  IF position('SECRET' in msg || d || h) > 0 THEN RAISE EXCEPTION 'FAIL: the refusal repeated the message text'; END IF;
  IF (SELECT to_jsonb(c) FROM public.chamber_sessions c WHERE c.id = sid) IS DISTINCT FROM before_row THEN
    RAISE EXCEPTION 'FAIL: a refused save changed the row';
  END IF;

  -- Appending a valid message saves, in the order sent.
  UPDATE public.chamber_sessions SET transcript = good || '[{"id":"m3","sender":"lenore","text":"Thank you."}]' WHERE id = sid;
  IF (SELECT array_agg(e ->> 'id' ORDER BY n) FROM public.chamber_sessions c, jsonb_array_elements(c.transcript) WITH ORDINALITY AS t(e, n) WHERE c.id = sid)
     IS DISTINCT FROM ARRAY['m1', 'm2', 'm3'] THEN
    RAISE EXCEPTION 'FAIL: the transcript was not kept in the order sent';
  END IF;
  RESET ROLE;

  -- A row whose stored transcript breaks a rule (saved before this check) stays editable in its other columns.
  PERFORM set_config('request.jwt.claims', '', false);
  ALTER TABLE public.chamber_sessions DISABLE TRIGGER chamber_sessions_transcript_validate;
  UPDATE public.chamber_sessions SET transcript = '[{"role":"user","content":"old shape"}]' WHERE id = sid;
  ALTER TABLE public.chamber_sessions ENABLE TRIGGER chamber_sessions_transcript_validate;
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', uid, 'is_anonymous', false, 'role', 'authenticated', 'email', uid || '@example.test')::text, false);
  SET LOCAL ROLE authenticated;
  UPDATE public.chamber_sessions SET chamber_data = '{"company_name":"Still Editable"}' WHERE id = sid;
  IF (SELECT chamber_data ->> 'company_name' FROM public.chamber_sessions WHERE id = sid) <> 'Still Editable' THEN
    RAISE EXCEPTION 'FAIL: a row with an old transcript could not be edited';
  END IF;
  RESET ROLE;
  RAISE NOTICE 'transcript_validation: write cases passed';
END $$;

DO $$ BEGIN RAISE NOTICE 'transcript_validation: all cases passed'; END $$;
