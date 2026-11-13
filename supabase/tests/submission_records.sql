-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh submission_records
-- Submission records (20261104120000_submission_records.sql): the File ID is assigned by the database from
-- a per-year sequence and kept for good, each certification is a numbered, immutable copy of what was
-- certified, a repeat of the same certification records nothing (sent after the first or at the same time,
-- on two connections through dblink), a required answer that is conflicting or incomplete blocks certifying,
-- nobody but the owner or an advisor can read a packet by its File ID, and a certification can only ever
-- carry its own intake's File ID (20261104131000).
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
\i supabase/migrations/20261104131000_certification_file_id_check.sql
SET client_min_messages = notice;

-- ---------- helpers ----------
CREATE FUNCTION pg_temp.as_user(uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', uid, 'is_anonymous', false, 'role', 'authenticated', 'email', uid || '@example.test')::text, false);
END $$;

-- A prospect who has agreed to the intake consent (20261104090000), which creating an intake requires.
CREATE FUNCTION pg_temp.agree() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');
END $$;

CREATE FUNCTION pg_temp.new_user() RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', uid || '@example.test', false, now(), now());
  RETURN uid;
END $$;

CREATE FUNCTION pg_temp.snap(sid uuid) RETURNS jsonb LANGUAGE sql AS
  $$ SELECT to_jsonb(s) FROM public.chamber_sessions s WHERE s.id = sid $$;

-- A certification of `data`, as the Reckoning sends it, with a File ID the browser made up.
CREATE FUNCTION pg_temp.certification(data jsonb, signed_at text DEFAULT '2026-11-04T12:00:00Z', peo text DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'signer_name', 'Jo Doe', 'signer_title', 'CEO', 'signed_at', signed_at, 'file_id', 'EAA-2026-CLIENT',
    'consent_version', '2026-10-draft-1', 'consent_text', '["I certify."]'::jsonb, 'chamber_data', data)
    || CASE WHEN peo IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('peo', peo) END
$$;

-- Certifies sid over `data` as the signed-in owner. Returns 'ok', or the SQLSTATE and DETAIL it was refused with.
-- A refusal must leave the row and the certifications exactly as they were.
CREATE FUNCTION pg_temp.certify(sid uuid, data jsonb, signed_at text DEFAULT '2026-11-04T12:00:00Z', peo text DEFAULT NULL) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  before_row jsonb := pg_temp.snap(sid);
  certs bigint := (SELECT count(*) FROM public.chamber_certifications WHERE session_id = sid);
  s text; d text;
BEGIN
  BEGIN
    UPDATE public.chamber_sessions SET status = 'submitted', chamber_data = data, submission = pg_temp.certification(data, signed_at, peo) WHERE id = sid;
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

-- Fails the run unless stmt raises exactly `state`.
CREATE FUNCTION pg_temp.must_raise(stmt text, state text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE raised text := NULL;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    raised := SQLSTATE;
  END;
  IF raised IS NULL THEN RAISE EXCEPTION 'FAIL: % was allowed', label; END IF;
  IF raised <> state THEN RAISE EXCEPTION 'FAIL: % raised % instead of %', label, raised, state; END IF;
END $$;

-- ---------- the reference and the record ----------
DO $$
DECLARE
  uid uuid := pg_temp.new_user();
  other uuid := pg_temp.new_user();
  sid uuid;
  sid2 uuid;
  sid3 uuid;
  this_year text := to_char(now() AT TIME ZONE 'UTC', 'YYYY');
  complete jsonb := '{"company_name":"Acme","states":["NY"],"pay_frequency":"bi-weekly"}';
  row_ public.chamber_sessions;
  cert public.chamber_certifications;
  recorded jsonb;
  outcome text;
  certs bigint;
BEGIN
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.agree();
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, complete) RETURNING id INTO sid;
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, category, status)
  VALUES (uid, sid, 'census.csv', '1 KB', uid || '/' || sid || '/census.csv', 'employee_census', 'extracted');

  -- A draft has no File ID, and the browser can't give it one.
  UPDATE public.chamber_sessions SET file_id = 'EAA-2026-MINE' WHERE id = sid;
  SELECT * INTO row_ FROM public.chamber_sessions WHERE id = sid;
  IF row_.file_id IS NOT NULL THEN RAISE EXCEPTION 'FAIL: the browser set a File ID (%)', row_.file_id; END IF;

  outcome := pg_temp.certify(sid, complete);
  IF outcome <> 'ok' THEN RAISE EXCEPTION 'FAIL: could not certify: %', outcome; END IF;
  SELECT * INTO row_ FROM public.chamber_sessions WHERE id = sid;
  IF row_.file_id <> 'EAA-' || this_year || '-0001' THEN RAISE EXCEPTION 'FAIL: first File ID is %', row_.file_id; END IF;
  IF row_.submission ->> 'file_id' <> row_.file_id THEN RAISE EXCEPTION 'FAIL: submission.file_id is %, not the server''s', row_.submission ->> 'file_id'; END IF;
  IF (row_.submission ->> 'version')::integer <> 1 THEN RAISE EXCEPTION 'FAIL: submission.version is %', row_.submission ->> 'version'; END IF;
  IF (row_.submission ->> 'data_version')::integer <> row_.data_version THEN
    RAISE EXCEPTION 'FAIL: submission.data_version % differs from the row''s %', row_.submission ->> 'data_version', row_.data_version;
  END IF;
  IF (row_.submission ->> 'schema_version')::integer <> row_.schema_version THEN RAISE EXCEPTION 'FAIL: schema_version not stamped'; END IF;
  IF jsonb_array_length(row_.submission -> 'documents') <> 1 OR row_.submission -> 'documents' -> 0 ->> 'file_name' <> 'census.csv'
     OR row_.submission -> 'documents' -> 0 ->> 'status' <> 'extracted' THEN
    RAISE EXCEPTION 'FAIL: documents not stamped: %', row_.submission -> 'documents';
  END IF;

  SELECT * INTO cert FROM public.chamber_certifications WHERE session_id = sid;
  IF cert.file_id <> row_.file_id OR cert.version <> 1 OR cert.data_version <> row_.data_version
     OR cert.schema_version <> row_.schema_version OR cert.chamber_data <> complete
     OR cert.field_provenance IS DISTINCT FROM row_.field_provenance OR cert.chosen_peo IS NOT NULL
     OR jsonb_array_length(cert.documents) <> 1 THEN
    RAISE EXCEPTION 'FAIL: the certification row does not hold the submission: %', to_jsonb(cert);
  END IF;

  -- The next intake takes the next number, and a File ID is never shared.
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, complete) RETURNING id INTO sid2;
  outcome := pg_temp.certify(sid2, complete);
  IF outcome <> 'ok' THEN RAISE EXCEPTION 'FAIL: could not certify the second intake: %', outcome; END IF;
  IF (SELECT file_id FROM public.chamber_sessions WHERE id = sid2) <> 'EAA-' || this_year || '-0002' THEN
    RAISE EXCEPTION 'FAIL: second File ID is %', (SELECT file_id FROM public.chamber_sessions WHERE id = sid2);
  END IF;

  -- Past 9999 in a year the number keeps every digit: nothing is cut down to a File ID already taken.
  RESET ROLE;
  UPDATE public.submission_reference_counters SET last = 9999 WHERE year = this_year::integer;
  SET LOCAL ROLE authenticated;
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, complete) RETURNING id INTO sid3;
  outcome := pg_temp.certify(sid3, complete);
  IF outcome <> 'ok' THEN RAISE EXCEPTION 'FAIL: could not certify the ten-thousandth intake: %', outcome; END IF;
  IF (SELECT file_id FROM public.chamber_sessions WHERE id = sid3) <> 'EAA-' || this_year || '-10000' THEN
    RAISE EXCEPTION 'FAIL: the ten-thousandth File ID is %', (SELECT file_id FROM public.chamber_sessions WHERE id = sid3);
  END IF;

  -- The same certification sent again (a second click, a retry): nothing new is recorded.
  recorded := row_.submission;
  UPDATE public.chamber_sessions SET status = 'submitted', chamber_data = complete, submission = pg_temp.certification(complete) WHERE id = sid;
  SELECT * INTO row_ FROM public.chamber_sessions WHERE id = sid;
  IF row_.status <> 'submitted' OR row_.submission <> recorded THEN
    RAISE EXCEPTION 'FAIL: a repeat changed the submission';
  END IF;
  IF (row_.submission ->> 'certified_at') IS NULL OR (row_.submission ->> 'version')::integer <> 1 THEN RAISE EXCEPTION 'FAIL: a repeat re-stamped the submission'; END IF;
  SELECT count(*) INTO certs FROM public.chamber_certifications WHERE session_id = sid;
  IF certs <> 1 THEN RAISE EXCEPTION 'FAIL: a repeat recorded a second certification (% rows)', certs; END IF;
  RESET ROLE;
  IF (SELECT count(*) FROM public.outbox_events WHERE session_id = sid) <> 2 THEN
    RAISE EXCEPTION 'FAIL: a repeat queued more notifications (%)', (SELECT count(*) FROM public.outbox_events WHERE session_id = sid);
  END IF;
  SET LOCAL ROLE authenticated;

  -- Signing the same answers again, with a new signature: a new version under the same File ID.
  outcome := pg_temp.certify(sid, complete, '2026-11-04T12:30:00Z');
  IF outcome <> 'ok' THEN RAISE EXCEPTION 'FAIL: could not sign again: %', outcome; END IF;
  SELECT * INTO row_ FROM public.chamber_sessions WHERE id = sid;
  IF row_.file_id <> 'EAA-' || this_year || '-0001' OR (row_.submission ->> 'version')::integer <> 2 THEN
    RAISE EXCEPTION 'FAIL: a second signature gave File ID % version %', row_.file_id, row_.submission ->> 'version';
  END IF;
  IF (SELECT count(*) FROM public.chamber_certifications WHERE session_id = sid AND superseded_at IS NULL AND version = 2) <> 1
     OR (SELECT superseded_reason FROM public.chamber_certifications WHERE session_id = sid AND version = 1) <> 'recertified' THEN
    RAISE EXCEPTION 'FAIL: versions not recorded as expected';
  END IF;

  -- Changing an answer withdraws the certification, keeps the File ID, and leaves the record untouched.
  UPDATE public.chamber_sessions SET chamber_data = complete || '{"company_name":"Acme Inc"}' WHERE id = sid;
  SELECT * INTO row_ FROM public.chamber_sessions WHERE id = sid;
  IF row_.status <> 'in_progress' OR row_.file_id <> 'EAA-' || this_year || '-0001' THEN
    RAISE EXCEPTION 'FAIL: the edit left status % and File ID %', row_.status, row_.file_id;
  END IF;
  SELECT * INTO cert FROM public.chamber_certifications WHERE session_id = sid AND version = 2;
  IF cert.superseded_reason <> 'data_changed' OR cert.chamber_data <> complete THEN
    RAISE EXCEPTION 'FAIL: the withdrawn certification lost its copy of the answers';
  END IF;

  -- Certifying the changed answers, with a PEO this time: version 3, same File ID, every version recoverable.
  outcome := pg_temp.certify(sid, complete || '{"company_name":"Acme Inc"}', '2026-11-05T09:00:00Z', 'Acme PEO');
  IF outcome <> 'ok' THEN RAISE EXCEPTION 'FAIL: could not certify the changed answers: %', outcome; END IF;
  SELECT * INTO row_ FROM public.chamber_sessions WHERE id = sid;
  IF row_.file_id <> 'EAA-' || this_year || '-0001' OR (row_.submission ->> 'version')::integer <> 3 THEN
    RAISE EXCEPTION 'FAIL: the third certification gave File ID % version %', row_.file_id, row_.submission ->> 'version';
  END IF;
  IF (SELECT array_agg(chamber_data ->> 'company_name' ORDER BY version) FROM public.chamber_certifications WHERE session_id = sid)
     <> ARRAY['Acme', 'Acme', 'Acme Inc'] THEN
    RAISE EXCEPTION 'FAIL: not every submitted version is recoverable';
  END IF;
  -- The record holds the PEO the signer certified, even when the intake's saved choice is empty (an older
  -- front end sends the PEO with the certification alone).
  IF (SELECT chosen_peo FROM public.chamber_sessions WHERE id = sid) IS NOT NULL
     OR (SELECT chosen_peo FROM public.chamber_certifications WHERE session_id = sid AND version = 3) IS DISTINCT FROM 'Acme PEO' THEN
    RAISE EXCEPTION 'FAIL: the record does not hold the PEO the signer certified';
  END IF;
  RESET ROLE;

  -- Only the owner and advisors can read a packet by its File ID; a guessed one shows nobody else anything.
  PERFORM pg_temp.as_user(other);
  SET LOCAL ROLE authenticated;
  IF EXISTS (SELECT 1 FROM public.chamber_sessions WHERE file_id = 'EAA-' || this_year || '-0001')
     OR EXISTS (SELECT 1 FROM public.chamber_certifications WHERE file_id = 'EAA-' || this_year || '-0001') THEN
    RAISE EXCEPTION 'FAIL: another prospect can read a packet by its File ID';
  END IF;
  RESET ROLE;
  INSERT INTO public.user_roles (user_id, role) VALUES (other, 'advisor');
  SET LOCAL ROLE authenticated;
  IF (SELECT count(*) FROM public.chamber_sessions WHERE file_id = 'EAA-' || this_year || '-0001') <> 1
     OR (SELECT count(*) FROM public.chamber_certifications WHERE file_id = 'EAA-' || this_year || '-0001') <> 3 THEN
    RAISE EXCEPTION 'FAIL: an advisor cannot read the packet by its File ID';
  END IF;
  RESET ROLE;

  RAISE NOTICE 'submission_records: reference and record cases passed';
END $$;

-- ---------- append-only ----------
DO $$
DECLARE
  uid uuid := pg_temp.new_user();
  sid uuid;
  cid uuid;
  complete jsonb := '{"company_name":"Fixed Co","states":["NY"],"pay_frequency":"weekly"}';
BEGIN
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.agree();
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, complete) RETURNING id INTO sid;
  IF pg_temp.certify(sid, complete) <> 'ok' THEN RAISE EXCEPTION 'FAIL: could not certify'; END IF;
  SELECT id INTO cid FROM public.chamber_certifications WHERE session_id = sid;

  -- The owner can read, and that is all.
  PERFORM pg_temp.must_raise(format('UPDATE public.chamber_certifications SET signer_name = ''X'' WHERE id = %L', cid), '42501', 'the owner changing a certification');
  PERFORM pg_temp.must_raise(format('DELETE FROM public.chamber_certifications WHERE id = %L', cid), '42501', 'the owner deleting a certification');
  RESET ROLE;

  -- Neither can the service role, nor a migration or an operator: the record is fixed.
  SET LOCAL ROLE service_role;
  PERFORM pg_temp.must_raise(format('UPDATE public.chamber_certifications SET signer_name = ''X'' WHERE id = %L', cid), '42501', 'the service role changing a signer');
  PERFORM pg_temp.must_raise(format('UPDATE public.chamber_certifications SET chamber_data = ''{}'' WHERE id = %L', cid), '42501', 'the service role changing the certified answers');
  PERFORM pg_temp.must_raise(format('UPDATE public.chamber_certifications SET file_id = ''EAA-X'' WHERE id = %L', cid), '42501', 'the service role changing the File ID');
  PERFORM pg_temp.must_raise(format('DELETE FROM public.chamber_certifications WHERE id = %L', cid), '42501', 'the service role deleting a certification');
  -- The outbox's markers may change (the worker and an operator use them).
  UPDATE public.chamber_certifications SET outbox_queued_at = NULL, outbox_failures = outbox_failures + 1, outbox_last_failed_at = now(), outbox_last_sqlstate = 'XX000' WHERE id = cid;
  UPDATE public.chamber_certifications SET outbox_queued_at = now() WHERE id = cid;
  RESET ROLE;
  PERFORM pg_temp.must_raise(format('UPDATE public.chamber_certifications SET signed_at = now() WHERE id = %L', cid), '42501', 'a superuser changing the signing time');
  PERFORM pg_temp.must_raise(format('DELETE FROM public.chamber_certifications WHERE id = %L', cid), '42501', 'a superuser deleting a certification');

  -- Superseding is one way.
  UPDATE public.chamber_certifications SET superseded_at = now(), superseded_reason = 'recertified' WHERE id = cid;
  PERFORM pg_temp.must_raise(format('UPDATE public.chamber_certifications SET superseded_at = NULL, superseded_reason = NULL WHERE id = %L', cid), '42501', 'un-superseding a certification');

  -- The record outlives the intake row.
  DELETE FROM public.chamber_sessions WHERE id = sid;
  IF NOT EXISTS (SELECT 1 FROM public.chamber_certifications WHERE id = cid) THEN RAISE EXCEPTION 'FAIL: deleting the intake deleted its certification'; END IF;

  RAISE NOTICE 'submission_records: append-only cases passed';
END $$;

-- ---------- deleting an intake on purpose takes its records with it ----------
DO $$
DECLARE
  uid uuid := pg_temp.new_user();
  adm uuid := pg_temp.new_user();
  sid uuid;
  did uuid;
  complete jsonb := '{"company_name":"Gone Co","states":["NY"],"pay_frequency":"weekly"}';
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (adm, 'admin');
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.agree();
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, complete) RETURNING id INTO sid;
  IF pg_temp.certify(sid, complete) <> 'ok' THEN RAISE EXCEPTION 'FAIL: could not certify'; END IF;
  RESET ROLE;

  -- An admin asks (20261104092000); the purge worker claims and completes it, as the service role.
  PERFORM pg_temp.as_user(adm);
  SET LOCAL ROLE authenticated;
  did := public.request_intake_deletion(sid, 'Owner asked; verified from the account address');
  RESET ROLE;
  SET LOCAL ROLE service_role;
  IF (SELECT count(*) FROM public.claim_intake_deletions(5, 600)) <> 1 THEN RAISE EXCEPTION 'FAIL: the deletion was not claimed'; END IF;
  PERFORM public.complete_intake_deletion(did, 0);
  RESET ROLE;
  IF EXISTS (SELECT 1 FROM public.chamber_certifications WHERE session_id = sid) THEN RAISE EXCEPTION 'FAIL: the purge left the certification records'; END IF;
  IF EXISTS (SELECT 1 FROM public.chamber_sessions WHERE id = sid) THEN RAISE EXCEPTION 'FAIL: the purge left the intake'; END IF;
  IF (SELECT status FROM public.intake_deletions WHERE id = did) <> 'done' THEN RAISE EXCEPTION 'FAIL: the deletion is not done'; END IF;
  RAISE NOTICE 'submission_records: deletion cases passed';
END $$;

-- ---------- a required answer must be settled ----------
-- The gate is 20261104100000_certification_conflicts.sql's (missing answers EA003, then a required answer
-- given two ways EA008); this checks it still runs ahead of the submission record, and that nothing is
-- recorded when it refuses.
DO $$
DECLARE
  uid uuid := pg_temp.new_user();
  sid uuid;
  complete jsonb := '{"company_name":"Acme","states":["NY"],"pay_frequency":"bi-weekly"}';
  conflicting jsonb := '{"company_name":{"status":"conflicting","source":{"kind":"transcript","message_id":"m1"},"updated_at":"2026-11-04T00:00:00Z","candidates":[]}}';
  incomplete jsonb := '{"states":{"status":"incomplete","source":{"kind":"transcript","message_id":"m1"},"updated_at":"2026-11-04T00:00:00Z"}}';
  inferred jsonb := '{"pay_frequency":{"status":"inferred","source":{"kind":"transcript","message_id":"m1"},"updated_at":"2026-11-04T00:00:00Z"},"industry":{"status":"conflicting","source":{"kind":"transcript","message_id":"m1"},"updated_at":"2026-11-04T00:00:00Z","candidates":[]}}';
  outcome text;
BEGIN
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.agree();
  INSERT INTO public.chamber_sessions (user_id, chamber_data, field_provenance) VALUES (uid, complete, conflicting) RETURNING id INTO sid;
  outcome := pg_temp.certify(sid, complete);
  IF outcome <> 'EA008 company_name' THEN RAISE EXCEPTION 'FAIL: certifying with a conflicting company name gave %', outcome; END IF;
  outcome := pg_temp.certify(sid, '{"states":["NY"],"pay_frequency":"bi-weekly"}');
  IF outcome <> 'EA003 company_name' THEN RAISE EXCEPTION 'FAIL: a missing answer is refused before a conflicting one: %', outcome; END IF;
  IF EXISTS (SELECT 1 FROM public.chamber_certifications WHERE session_id = sid)
     OR (SELECT file_id FROM public.chamber_sessions WHERE id = sid) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: a refused certification recorded something';
  END IF;
  UPDATE public.chamber_sessions SET field_provenance = incomplete || inferred WHERE id = sid;
  outcome := pg_temp.certify(sid, complete);
  IF outcome <> 'ok' THEN RAISE EXCEPTION 'FAIL: an incomplete or inferred required answer, or a conflicting recommended one, blocked certification: %', outcome; END IF;
  RESET ROLE;
  RAISE NOTICE 'submission_records: readiness cases passed';
END $$;

-- ---------- a File ID another intake carries is never taken back from history ----------
-- The backfill leaves two intakes whose certifications recorded the same File ID with the older one
-- carrying it and the other carrying none; the other's next certification takes a fresh one.
DO $$
DECLARE
  uid uuid := pg_temp.new_user();
  a uuid;
  b uuid;
  complete jsonb := '{"company_name":"Acme","states":["NY"],"pay_frequency":"bi-weekly"}';
  this_year text := to_char(now() AT TIME ZONE 'UTC', 'YYYY');
  shared text;
  fresh text;
  outcome text;
BEGIN
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.agree();
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, complete) RETURNING id INTO a;
  IF pg_temp.certify(a, complete) <> 'ok' THEN RAISE EXCEPTION 'FAIL: setup could not certify the first intake'; END IF;
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, complete) RETURNING id INTO b;
  IF pg_temp.certify(b, complete) <> 'ok' THEN RAISE EXCEPTION 'FAIL: setup could not certify the second intake'; END IF;
  RESET ROLE;

  shared := (SELECT file_id FROM public.chamber_sessions WHERE id = b);
  ALTER TABLE public.chamber_sessions DISABLE TRIGGER USER;
  UPDATE public.chamber_sessions SET file_id = NULL WHERE id = b;
  UPDATE public.chamber_sessions SET file_id = shared WHERE id = a;
  ALTER TABLE public.chamber_sessions ENABLE TRIGGER USER;

  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  UPDATE public.chamber_sessions SET chamber_data = complete || '{"industry":"Print"}' WHERE id = b;
  outcome := pg_temp.certify(b, complete || '{"industry":"Print"}', '2026-11-06T09:00:00Z');
  IF outcome <> 'ok' THEN RAISE EXCEPTION 'FAIL: re-certifying the intake whose recorded File ID another intake carries gave %', outcome; END IF;
  fresh := (SELECT file_id FROM public.chamber_sessions WHERE id = b);
  IF fresh IS NULL OR fresh = shared OR fresh !~ ('^EAA-' || this_year || '-[0-9]{4,}$') THEN
    RAISE EXCEPTION 'FAIL: the intake got % instead of a fresh File ID', fresh;
  END IF;
  IF (SELECT file_id FROM public.chamber_sessions WHERE id = a) <> shared THEN RAISE EXCEPTION 'FAIL: the older intake lost its File ID'; END IF;
  IF (SELECT submission ->> 'file_id' FROM public.chamber_sessions WHERE id = b) <> fresh THEN RAISE EXCEPTION 'FAIL: the submission names another File ID'; END IF;
  RESET ROLE;
  RAISE NOTICE 'submission_records: shared File ID cases passed';
END $$;

-- ---------- a certification carries its own intake's File ID ----------
-- 20261104131000: the File ID on a certification is its intake's, the one the unique index keeps to one intake.
-- A row with another intake's File ID, a made-up one or none is refused, whoever writes it.
DO $$
DECLARE
  uid uuid := pg_temp.new_user();
  a uuid;
  b uuid;
  complete jsonb := '{"company_name":"Acme","states":["NY"],"pay_frequency":"bi-weekly"}';
  fid_a text;
  fid_b text;
  insert_as text := $f$INSERT INTO public.chamber_certifications
    (session_id, user_id, signer_name, signer_title, consent_version, consent_text, file_id, signed_at, data_sha256, version)
    VALUES (%L, %L, 'Mallory', 'CEO', '2026-10-draft-1', 'I certify.', %L, now(), 'not-a-hash', 99)$f$;
  inserted boolean := false;
BEGIN
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.agree();
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, complete) RETURNING id INTO a;
  IF pg_temp.certify(a, complete) <> 'ok' THEN RAISE EXCEPTION 'FAIL: setup could not certify the first intake'; END IF;
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, complete) RETURNING id INTO b;
  IF pg_temp.certify(b, complete) <> 'ok' THEN RAISE EXCEPTION 'FAIL: setup could not certify the second intake'; END IF;
  -- The owner can't write a certification at all; certifying is the only way one is recorded.
  PERFORM pg_temp.must_raise(format(insert_as, a, uid, (SELECT file_id FROM public.chamber_sessions WHERE id = a)), '42501', 'the owner writing a certification row');
  RESET ROLE;

  fid_a := (SELECT file_id FROM public.chamber_sessions WHERE id = a);
  fid_b := (SELECT file_id FROM public.chamber_sessions WHERE id = b);
  IF fid_a IS NULL OR fid_b IS NULL OR fid_a = fid_b THEN RAISE EXCEPTION 'FAIL: setup expected two File IDs, got % and %', fid_a, fid_b; END IF;
  IF EXISTS (SELECT 1 FROM public.chamber_certifications c JOIN public.chamber_sessions s ON s.id = c.session_id
             WHERE c.session_id IN (a, b) AND c.file_id IS DISTINCT FROM s.file_id) THEN
    RAISE EXCEPTION 'FAIL: a certification carries a File ID that is not its intake''s';
  END IF;

  SET LOCAL ROLE service_role;
  PERFORM pg_temp.must_raise(format(insert_as, a, uid, fid_b), '23514', 'the service role recording a certification under another intake''s File ID');
  PERFORM pg_temp.must_raise(format(insert_as, a, uid, 'EAA-2026-9999'), '23514', 'the service role recording a certification under a made-up File ID');
  PERFORM pg_temp.must_raise(format(insert_as, a, uid, NULL), '23514', 'the service role recording a certification with no File ID');
  PERFORM pg_temp.must_raise(format(insert_as, a, uid, ' '), '23514', 'the service role recording a certification with a blank File ID');
  RESET ROLE;
  PERFORM pg_temp.must_raise(format(insert_as, b, uid, fid_a), '23514', 'a superuser recording a certification under another intake''s File ID');

  -- The intake's own File ID passes the check (so it refuses only what it should); undone straight after.
  BEGIN
    EXECUTE format(insert_as, a, uid, fid_a);
    inserted := true;
    RAISE EXCEPTION 'undo' USING ERRCODE = 'P0001';
  EXCEPTION WHEN raise_exception THEN
    NULL;
  END;
  IF NOT inserted THEN RAISE EXCEPTION 'FAIL: a certification under its own intake''s File ID was refused'; END IF;
  IF (SELECT count(*) FROM public.chamber_certifications WHERE session_id IN (a, b)) <> 2 THEN
    RAISE EXCEPTION 'FAIL: a refused certification row was recorded';
  END IF;
  RAISE NOTICE 'submission_records: File ID check cases passed';
END $$;

-- ---------- the same certification sent twice at once ----------
-- Two requests in flight together: a second click that got past the button's guard, a retry sent before the
-- first response came back, the same PATCH from two tabs. The cases above send the repeat after the first
-- has committed; here two real connections (dblink) race. The first certifies and holds its transaction
-- open until the second is seen waiting on it, then commits. The second must find the first's certification
-- and record nothing, whether it carries the browser's version check (it then matches no row) or not (the
-- database's repeat check keeps the record as it is). Two intakes certified at once take different File IDs.
CREATE SCHEMA race;
CREATE EXTENSION dblink SCHEMA race;

-- The UPDATE the Reckoning sends to certify sid over `data` (at_version: the version check the browser adds),
-- returning '<File ID> v<version>'.
CREATE FUNCTION pg_temp.certify_stmt(sid uuid, data jsonb, at_version integer DEFAULT NULL) RETURNS text LANGUAGE sql AS $$
  SELECT format(
    'UPDATE public.chamber_sessions SET status = %L, chamber_data = %L::jsonb, submission = %L::jsonb WHERE id = %L%s'
    || ' RETURNING file_id || %L || (submission ->> %L)',
    'submitted', data, pg_temp.certification(data), sid,
    CASE WHEN at_version IS NULL THEN '' ELSE format(' AND data_version = %s', at_version) END,
    ' v', 'version')
$$;

-- Runs first_stmt as first_uid and second_stmt as second_uid, each on its own connection with the user's JWT
-- claims, at the same time: the first holds its transaction open until the second is blocked on it, then
-- commits. Returns the text each statement returned (null for no row).
CREATE FUNCTION pg_temp.race(first_uid uuid, first_stmt text, second_uid uuid, second_stmt text,
                             OUT first_result text, OUT second_result text) LANGUAGE plpgsql AS $$
DECLARE
  dsn text := format('dbname=%s user=%s port=%s host=%s', current_database(), session_user, current_setting('port'),
    split_part(current_setting('unix_socket_directories'), ',', 1));
  second_pid integer;
  tries integer := 0;
BEGIN
  PERFORM race.dblink_connect('race_first', dsn);
  PERFORM race.dblink_connect('race_second', dsn);
  PERFORM race.dblink_exec('race_first', format('SELECT set_config(%L, %L, false); SET ROLE authenticated', 'request.jwt.claims',
    jsonb_build_object('sub', first_uid, 'is_anonymous', false, 'role', 'authenticated', 'email', first_uid || '@example.test')::text));
  PERFORM race.dblink_exec('race_second', format('SELECT set_config(%L, %L, false); SET ROLE authenticated; SET lock_timeout = %L', 'request.jwt.claims',
    jsonb_build_object('sub', second_uid, 'is_anonymous', false, 'role', 'authenticated', 'email', second_uid || '@example.test')::text, '20s'));
  SELECT pid INTO second_pid FROM race.dblink('race_second', 'SELECT pg_backend_pid()') AS t(pid integer);

  PERFORM race.dblink_exec('race_first', 'BEGIN');
  SELECT r INTO first_result FROM race.dblink('race_first', first_stmt) AS t(r text);
  PERFORM race.dblink_send_query('race_second', second_stmt);
  WHILE cardinality(pg_blocking_pids(second_pid)) = 0 LOOP
    tries := tries + 1;
    IF tries > 400 THEN RAISE EXCEPTION 'FAIL: the second request never waited for the first'; END IF;
    PERFORM pg_sleep(0.05);
  END LOOP;
  PERFORM race.dblink_exec('race_first', 'COMMIT');
  SELECT r INTO second_result FROM race.dblink_get_result('race_second') AS t(r text);
  PERFORM * FROM race.dblink_get_result('race_second') AS t(r text); -- the empty result that ends the query
  PERFORM race.dblink_disconnect('race_first');
  PERFORM race.dblink_disconnect('race_second');
END $$;

-- Each case its own prospect (one open draft each), committed so the other connections can see it.
CREATE TEMP TABLE race_case (name text PRIMARY KEY, uid uuid NOT NULL, sid uuid NOT NULL, data_version integer NOT NULL);
DO $$
DECLARE
  complete jsonb := '{"company_name":"Acme","states":["NY"],"pay_frequency":"bi-weekly"}';
  name text;
  uid uuid;
  sid uuid;
BEGIN
  FOREACH name IN ARRAY ARRAY['versioned', 'unversioned', 'first_intake', 'second_intake'] LOOP
    uid := pg_temp.new_user();
    PERFORM pg_temp.as_user(uid);
    SET LOCAL ROLE authenticated;
    PERFORM pg_temp.agree();
    INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, complete) RETURNING id INTO sid;
    RESET ROLE;
    INSERT INTO pg_temp.race_case VALUES (name, uid, sid, (SELECT data_version FROM public.chamber_sessions WHERE id = sid));
  END LOOP;
END $$;

DO $$
DECLARE
  complete jsonb := '{"company_name":"Acme","states":["NY"],"pay_frequency":"bi-weekly"}';
  this_year text := to_char(now() AT TIME ZONE 'UTC', 'YYYY');
  c pg_temp.race_case;
  d pg_temp.race_case;
  r record;
  first_n integer;
  second_n integer;
BEGIN
  -- As the browser sends it, at the version it last saw: the second matches no row once the first has moved
  -- the version on (the client then reads the row back and finds its own certification).
  SELECT * INTO c FROM pg_temp.race_case WHERE name = 'versioned';
  r := pg_temp.race(c.uid, pg_temp.certify_stmt(c.sid, complete, c.data_version), c.uid, pg_temp.certify_stmt(c.sid, complete, c.data_version));
  IF r.first_result IS NULL OR r.first_result !~ ('^EAA-' || this_year || '-[0-9]{4,} v1$') THEN
    RAISE EXCEPTION 'FAIL: the first of two versioned certifications gave %', r.first_result;
  END IF;
  IF r.second_result IS NOT NULL THEN RAISE EXCEPTION 'FAIL: the second versioned certification also landed (%)', r.second_result; END IF;
  IF (SELECT count(*) FROM public.chamber_certifications WHERE session_id = c.sid) <> 1 THEN
    RAISE EXCEPTION 'FAIL: two versioned certifications at once recorded % rows', (SELECT count(*) FROM public.chamber_certifications WHERE session_id = c.sid);
  END IF;
  IF (SELECT count(*) FROM public.outbox_events WHERE session_id = c.sid) <> 2 THEN
    RAISE EXCEPTION 'FAIL: two versioned certifications at once queued % notifications', (SELECT count(*) FROM public.outbox_events WHERE session_id = c.sid);
  END IF;

  -- No version check (a bare REST retry): the second lands on the first's row and the repeat check keeps
  -- the record as it is, so both get back the same File ID and version.
  SELECT * INTO c FROM pg_temp.race_case WHERE name = 'unversioned';
  r := pg_temp.race(c.uid, pg_temp.certify_stmt(c.sid, complete), c.uid, pg_temp.certify_stmt(c.sid, complete));
  IF r.first_result IS NULL OR r.first_result !~ ('^EAA-' || this_year || '-[0-9]{4,} v1$') THEN
    RAISE EXCEPTION 'FAIL: the first of two unversioned certifications gave %', r.first_result;
  END IF;
  IF r.second_result IS DISTINCT FROM r.first_result THEN
    RAISE EXCEPTION 'FAIL: the repeat sent at the same time came back as % after %', r.second_result, r.first_result;
  END IF;
  IF (SELECT count(*) FROM public.chamber_certifications WHERE session_id = c.sid) <> 1
     OR NOT EXISTS (SELECT 1 FROM public.chamber_certifications WHERE session_id = c.sid AND version = 1 AND superseded_at IS NULL) THEN
    RAISE EXCEPTION 'FAIL: two unversioned certifications at once recorded %',
      (SELECT jsonb_agg(jsonb_build_object('version', version, 'superseded', superseded_reason)) FROM public.chamber_certifications WHERE session_id = c.sid);
  END IF;
  IF (SELECT count(*) FROM public.outbox_events WHERE session_id = c.sid) <> 2 THEN
    RAISE EXCEPTION 'FAIL: two unversioned certifications at once queued % notifications', (SELECT count(*) FROM public.outbox_events WHERE session_id = c.sid);
  END IF;

  -- Two intakes certified at once: the second waits on the year's counter and takes the next number.
  SELECT * INTO c FROM pg_temp.race_case WHERE name = 'first_intake';
  SELECT * INTO d FROM pg_temp.race_case WHERE name = 'second_intake';
  r := pg_temp.race(c.uid, pg_temp.certify_stmt(c.sid, complete), d.uid, pg_temp.certify_stmt(d.sid, complete));
  first_n := substring(r.first_result FROM '^EAA-' || this_year || '-([0-9]{4,}) v1$')::integer;
  second_n := substring(r.second_result FROM '^EAA-' || this_year || '-([0-9]{4,}) v1$')::integer;
  IF first_n IS NULL OR second_n IS NULL OR second_n <> first_n + 1 THEN
    RAISE EXCEPTION 'FAIL: two intakes certified at once got % and %', r.first_result, r.second_result;
  END IF;
  RAISE NOTICE 'submission_records: concurrent certification cases passed';
END $$;

DO $$ BEGIN RAISE NOTICE 'submission_records: all cases passed'; END $$;
