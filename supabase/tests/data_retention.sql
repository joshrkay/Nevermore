-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh data_retention
-- Data retention and deletion (US-6.1, migration 20261104092000): the windows; the retention job queues only
-- closed drafts that were never certified, once each; only an admin asks for a deletion; purge-intakes'
-- claim, file listing, completion and failure functions; a completed deletion removes every row of its intake
-- and nothing else, and only after its files are gone; the append-only tables still refuse changes outside a
-- deletion; run_retention prunes what has aged out; retention_review_due lists submitted records past their
-- window for advisors only. Callers run as `authenticated` (with their JWT claims) or `service_role`.
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

-- Superuser only: a draft for uid (a privileged write, so it needs no consent and the lifecycle trigger stamps it).
CREATE FUNCTION pg_temp.new_draft(uid uuid, company text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE sid uuid;
BEGIN
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, jsonb_build_object('company_name', company)) RETURNING id INTO sid;
  RETURN sid;
END $$;

-- Superuser only: certifies sid as its owner would.
CREATE FUNCTION pg_temp.certify(sid uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE intake public.chamber_sessions;
BEGIN
  SELECT * INTO intake FROM public.chamber_sessions WHERE id = sid;
  PERFORM pg_temp.as_user(intake.user_id);
  UPDATE public.chamber_sessions
  SET status = 'submitted',
      submission = jsonb_build_object('signer_name', 'Jo Doe', 'signer_title', 'CEO', 'signed_at', '2026-11-01T12:00:00Z',
        'file_id', 'EAA-T', 'consent_version', 'v1', 'consent_text', 'I certify.', 'chamber_data', intake.chamber_data)
  WHERE id = sid;
  PERFORM pg_temp.signed_out();
END $$;

-- Superuser only: closes sid as `status`, `ago` in the past, with the lifecycle record the real paths write.
CREATE FUNCTION pg_temp.closed(sid uuid, status text, ago interval) RETURNS void LANGUAGE plpgsql AS $$
DECLARE owner uuid := (SELECT user_id FROM public.chamber_sessions WHERE id = sid);
BEGIN
  UPDATE public.chamber_sessions SET status = closed.status WHERE id = sid;
  INSERT INTO public.intake_lifecycle_events (session_id, user_id, from_status, to_status, reason, created_at)
  VALUES (sid, owner, 'in_progress', closed.status, 'test', now() - ago);
END $$;

-- Superuser only: n documents (rows and stored files) in sid's folder, and one generated Manuscript.
CREATE FUNCTION pg_temp.add_files(sid uuid, n integer) RETURNS void LANGUAGE plpgsql AS $$
DECLARE owner uuid := (SELECT user_id FROM public.chamber_sessions WHERE id = sid);
BEGIN
  FOR i IN 1..n LOOP
    INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, file_sha256)
    VALUES (owner, sid, format('Jane Doe payroll %s.csv', i), '1 KB', format('%s/%s/%s_payroll.csv', owner, sid, i), md5(sid::text || i) || md5(i::text || sid));
    INSERT INTO storage.objects (bucket_id, name) VALUES ('documents', format('%s/%s/%s_payroll.csv', owner, sid, i));
  END LOOP;
  INSERT INTO storage.objects (bucket_id, name) VALUES ('manuscripts', sid || '/v1-x.pdf');
END $$;

-- The SQLSTATE stmt raises, or 'ok'.
CREATE FUNCTION pg_temp.state_of(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE s text;
BEGIN
  EXECUTE stmt;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE;
  RETURN s;
END $$;

-- Every row an intake has, table by table (sessions, documents, certifications, outbox, workflow, history,
-- notes, reviews, review events, Manuscript versions, lifecycle events, AI call records).
CREATE FUNCTION pg_temp.footprint(sid uuid) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'chamber_sessions', (SELECT count(*) FROM public.chamber_sessions WHERE id = sid),
    'documents', (SELECT count(*) FROM public.documents WHERE session_id = sid),
    'chamber_certifications', (SELECT count(*) FROM public.chamber_certifications WHERE session_id = sid),
    'outbox_events', (SELECT count(*) FROM public.outbox_events WHERE session_id = sid),
    'submission_workflow', (SELECT count(*) FROM public.submission_workflow WHERE session_id = sid),
    'submission_status_history', (SELECT count(*) FROM public.submission_status_history WHERE session_id = sid),
    'advisor_notes', (SELECT count(*) FROM public.advisor_notes WHERE session_id = sid),
    'advisor_field_reviews', (SELECT count(*) FROM public.advisor_field_reviews WHERE session_id = sid),
    'advisor_review_events', (SELECT count(*) FROM public.advisor_review_events WHERE session_id = sid),
    'manuscript_versions', (SELECT count(*) FROM public.manuscript_versions WHERE session_id = sid),
    'intake_lifecycle_events', (SELECT count(*) FROM public.intake_lifecycle_events WHERE session_id = sid),
    'ai_extraction_events', (SELECT count(*) FROM public.ai_extraction_events WHERE session_id = sid)
  );
$$;

-- Superuser only: advisor work on sid (a note, a field review and its event, a Manuscript version, a lifecycle record).
CREATE FUNCTION pg_temp.advisor_work(sid uuid, advisor uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_temp.as_user(advisor);
  INSERT INTO public.advisor_notes (session_id, author_id, body) VALUES (sid, advisor, 'Called the CFO.');
  INSERT INTO public.advisor_field_reviews (session_id, field, review_state, updated_by) VALUES (sid, 'company_name', 'verified', advisor);
  INSERT INTO public.advisor_review_events (session_id, field, to_state, correction_changed, had_correction, has_correction, actor_id)
  VALUES (sid, 'company_name', 'verified', false, false, false, advisor);
  INSERT INTO public.manuscript_versions (session_id, version, file_id, storage_path, pdf_sha256, certified_data_hash, certified_signed_at, generated_by)
  VALUES (sid, 1, 'EAA-T', sid || '/v1-x.pdf', repeat('a', 64), 'hash', now(), advisor);
  INSERT INTO public.intake_lifecycle_events (session_id, user_id, from_status, to_status, reason)
  VALUES (sid, (SELECT user_id FROM public.chamber_sessions WHERE id = sid), 'in_progress', 'in_progress', 'test record');
  INSERT INTO public.ai_extraction_events (request_id, function_name, user_id, session_id, outcome, http_status)
  VALUES (gen_random_uuid(), 'chamber-extract', (SELECT user_id FROM public.chamber_sessions WHERE id = sid), sid, 'ok', 200);
  PERFORM pg_temp.signed_out();
END $$;

CREATE TEMP TABLE fx (name text PRIMARY KEY, id uuid);
GRANT SELECT ON fx TO authenticated, service_role;

DO $$
DECLARE
  prospect uuid := pg_temp.new_user('prospect@example.test');
  other uuid := pg_temp.new_user('other@example.test');
  guest uuid := pg_temp.new_user('guest@example.test', true);
  advisor uuid := pg_temp.new_user('advisor@example.test');
  admin uuid := pg_temp.new_user('admin@example.test');
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (advisor, 'advisor'), (admin, 'admin');
  INSERT INTO fx VALUES ('prospect', prospect), ('other', other), ('guest', guest), ('advisor', advisor), ('admin', admin);
END $$;

-- ---------- the windows ----------
DO $$
BEGIN
  IF public.closed_draft_retention() <> interval '30 days' THEN RAISE EXCEPTION 'FAIL: closed drafts are kept %', public.closed_draft_retention(); END IF;
  IF public.submitted_record_retention() <> interval '3 years' THEN RAISE EXCEPTION 'FAIL: submitted records are kept %', public.submitted_record_retention(); END IF;
  IF public.email_event_retention() <> interval '365 days' THEN RAISE EXCEPTION 'FAIL: email events are kept %', public.email_event_retention(); END IF;
  IF public.ops_event_retention() <> interval '90 days' THEN RAISE EXCEPTION 'FAIL: ops events are kept %', public.ops_event_retention(); END IF;
  IF public.intake_draft_retention() <> interval '30 days' THEN RAISE EXCEPTION 'FAIL: drafts expire after %', public.intake_draft_retention(); END IF;
  IF public.intake_deletion_max_attempts() <> 5 THEN RAISE EXCEPTION 'FAIL: deletions are tried % times', public.intake_deletion_max_attempts(); END IF;
  RAISE NOTICE 'data_retention: window cases passed';
END $$;

-- ---------- the retention job queues closed, never-certified drafts past their window ----------
DO $$
DECLARE
  prospect uuid := (SELECT id FROM fx WHERE name = 'prospect');
  admin uuid := (SELECT id FROM fx WHERE name = 'admin');
  old_expired uuid := pg_temp.new_draft(prospect, 'Old Expired Co');
  old_archived uuid := pg_temp.new_draft(prospect, 'Old Archived Co');
  old_revoked uuid := pg_temp.new_draft(prospect, 'Old Revoked Co');
  no_record uuid := pg_temp.new_draft(prospect, 'No Record Co');
  recent_expired uuid := pg_temp.new_draft(prospect, 'Recent Expired Co');
  idle_draft uuid := pg_temp.new_draft(prospect, 'Idle Draft Co');
  submitted uuid := pg_temp.new_draft(prospect, 'Submitted Co');
  edited uuid := pg_temp.new_draft(prospect, 'Edited Co');
  certified_closed uuid := pg_temp.new_draft(prospect, 'Certified Closed Co');
  requested uuid := pg_temp.new_draft(prospect, 'Requested Co');
  queued integer;
  d public.intake_deletions;
BEGIN
  PERFORM pg_temp.closed(old_expired, 'expired', interval '31 days');
  PERFORM pg_temp.closed(old_archived, 'archived', interval '40 days');
  PERFORM pg_temp.closed(old_revoked, 'revoked', interval '31 days');
  PERFORM pg_temp.closed(recent_expired, 'expired', interval '10 days');
  -- Closed with no lifecycle record (from before the audit table): its last update is when it closed.
  PERFORM set_config('session_replication_role', 'replica', true);
  UPDATE public.chamber_sessions SET status = 'archived', updated_at = now() - interval '35 days' WHERE id = no_record;
  PERFORM set_config('session_replication_role', 'origin', true);
  -- Idle for 100 days but still open: the expiry job's to close, not this one's to delete.
  UPDATE public.chamber_sessions SET last_activity_at = now() - interval '100 days' WHERE id = idle_draft;
  PERFORM pg_temp.certify(submitted);
  PERFORM pg_temp.certify(edited);
  UPDATE public.chamber_sessions SET chamber_data = '{"company_name":"Edited Co, changed"}' WHERE id = edited;
  -- Certified, then closed by hand: anything ever certified is out of the job's reach.
  PERFORM pg_temp.certify(certified_closed);
  PERFORM pg_temp.closed(certified_closed, 'archived', interval '400 days');
  PERFORM set_config('session_replication_role', 'replica', true);
  UPDATE public.chamber_sessions SET updated_at = now() - interval '5 years' WHERE id IN (submitted, edited, certified_closed, idle_draft);
  PERFORM set_config('session_replication_role', 'origin', true);
  -- Already asked for by an admin: not queued again.
  PERFORM pg_temp.closed(requested, 'archived', interval '60 days');
  PERFORM pg_temp.as_user(admin);
  SET LOCAL ROLE authenticated;
  PERFORM public.request_intake_deletion(requested, 'Owner asked; verified from the account address');
  RESET ROLE;
  PERFORM pg_temp.signed_out();

  -- Only the service role runs it.
  PERFORM pg_temp.as_user(admin);
  SET LOCAL ROLE authenticated;
  IF pg_temp.state_of('SELECT public.queue_retention_deletions()') <> '42501' THEN RAISE EXCEPTION 'FAIL: an admin ran the retention queue'; END IF;
  IF pg_temp.state_of('SELECT public.run_retention()') <> '42501' THEN RAISE EXCEPTION 'FAIL: an admin ran the retention job'; END IF;
  RESET ROLE;
  PERFORM pg_temp.signed_out();

  SET LOCAL ROLE service_role;
  IF pg_temp.state_of('SELECT public.queue_retention_deletions(0)') <> '22023' THEN RAISE EXCEPTION 'FAIL: a zero limit was accepted'; END IF;
  queued := public.queue_retention_deletions();
  RESET ROLE;
  IF queued <> 4 THEN RAISE EXCEPTION 'FAIL: the job queued % deletions, not 4', queued; END IF;
  IF (SELECT array_agg(session_id ORDER BY session_id) FROM public.intake_deletions WHERE trigger = 'retention')
     IS DISTINCT FROM (SELECT array_agg(x ORDER BY x) FROM unnest(ARRAY[old_expired, old_archived, old_revoked, no_record]) x) THEN
    RAISE EXCEPTION 'FAIL: the job queued the wrong intakes';
  END IF;
  SELECT * INTO d FROM public.intake_deletions WHERE session_id = old_expired;
  IF d.status <> 'pending' OR d.user_id <> prospect OR d.requested_by IS NOT NULL OR d.attempts <> 0
     OR d.reason <> 'Draft expired and never certified; kept 30 days after it closed' THEN
    RAISE EXCEPTION 'FAIL: the queued deletion was %', to_jsonb(d);
  END IF;
  IF (SELECT count(*) FROM public.intake_deletions WHERE session_id = requested) <> 1 THEN RAISE EXCEPTION 'FAIL: a requested intake was queued again'; END IF;

  -- Once each.
  SET LOCAL ROLE service_role;
  queued := public.queue_retention_deletions();
  RESET ROLE;
  IF queued <> 0 OR (SELECT count(*) FROM public.intake_deletions) <> 5 THEN RAISE EXCEPTION 'FAIL: a second run queued % more', queued; END IF;
  -- The limit holds.
  DELETE FROM public.intake_deletions WHERE trigger = 'retention';
  SET LOCAL ROLE service_role;
  queued := public.queue_retention_deletions(2);
  RESET ROLE;
  IF queued <> 2 THEN RAISE EXCEPTION 'FAIL: a limit of 2 queued %', queued; END IF;

  -- Leave these intakes alone for the cases below.
  DELETE FROM public.intake_deletions;
  UPDATE public.chamber_sessions SET status = 'in_progress' WHERE id IN (old_expired, old_archived, old_revoked, no_record, recent_expired, requested);
  INSERT INTO fx VALUES ('submitted', submitted);
  RAISE NOTICE 'data_retention: retention queue cases passed';
END $$;

-- ---------- only an admin asks for a deletion ----------
DO $$
DECLARE
  prospect uuid := (SELECT id FROM fx WHERE name = 'prospect');
  guest uuid := (SELECT id FROM fx WHERE name = 'guest');
  advisor uuid := (SELECT id FROM fx WHERE name = 'advisor');
  admin uuid := (SELECT id FROM fx WHERE name = 'admin');
  submitted uuid := (SELECT id FROM fx WHERE name = 'submitted');
  stmt text := format('SELECT public.request_intake_deletion(%L, %L)', submitted, 'Owner asked by email');
  first uuid;
  again uuid;
  d public.intake_deletions;
BEGIN
  FOREACH guest IN ARRAY ARRAY[prospect, advisor, guest] LOOP
    PERFORM pg_temp.as_user(guest, guest = (SELECT id FROM fx WHERE name = 'guest'));
    SET LOCAL ROLE authenticated;
    IF pg_temp.state_of(stmt) <> '42501' THEN RAISE EXCEPTION 'FAIL: % could ask for a deletion', guest; END IF;
    RESET ROLE;
  END LOOP;
  -- An admin presenting a guest token is a guest.
  PERFORM pg_temp.as_user(admin, true);
  SET LOCAL ROLE authenticated;
  IF pg_temp.state_of(stmt) <> '42501' THEN RAISE EXCEPTION 'FAIL: an admin on a guest token could ask for a deletion'; END IF;
  RESET ROLE;
  PERFORM pg_temp.signed_out();
  SET LOCAL ROLE anon;
  IF pg_temp.state_of(stmt) <> '42501' THEN RAISE EXCEPTION 'FAIL: a signed-out caller could ask for a deletion'; END IF;
  RESET ROLE;
  IF EXISTS (SELECT 1 FROM public.intake_deletions) THEN RAISE EXCEPTION 'FAIL: a refused request left a row'; END IF;

  PERFORM pg_temp.as_user(admin);
  SET LOCAL ROLE authenticated;
  IF pg_temp.state_of(format('SELECT public.request_intake_deletion(%L, NULL)', submitted)) <> '22023' THEN RAISE EXCEPTION 'FAIL: no reason was accepted'; END IF;
  IF pg_temp.state_of(format('SELECT public.request_intake_deletion(%L, %L)', submitted, '   ')) <> '22023' THEN RAISE EXCEPTION 'FAIL: a blank reason was accepted'; END IF;
  IF pg_temp.state_of(format('SELECT public.request_intake_deletion(%L, %L)', submitted, repeat('x', 501))) <> '22023' THEN RAISE EXCEPTION 'FAIL: a 501-character reason was accepted'; END IF;
  IF pg_temp.state_of(format('SELECT public.request_intake_deletion(%L, %L)', gen_random_uuid(), 'x')) <> 'PT404' THEN RAISE EXCEPTION 'FAIL: an unknown intake was not PT404'; END IF;
  -- Any status, certified included.
  first := public.request_intake_deletion(submitted, '  Owner asked by email; verified from the account address  ');
  again := public.request_intake_deletion(submitted, 'Asked again');
  RESET ROLE;
  PERFORM pg_temp.signed_out();
  IF first IS NULL OR again IS DISTINCT FROM first THEN RAISE EXCEPTION 'FAIL: asking again gave % then %', first, again; END IF;
  SELECT * INTO d FROM public.intake_deletions WHERE id = first;
  IF d.trigger <> 'request' OR d.status <> 'pending' OR d.session_id <> submitted OR d.user_id <> prospect
     OR d.requested_by <> admin OR d.requested_by_email <> admin || '@example.test'
     OR d.reason <> 'Owner asked by email; verified from the account address' THEN
    RAISE EXCEPTION 'FAIL: the request was %', to_jsonb(d);
  END IF;
  IF (SELECT count(*) FROM public.intake_deletions) <> 1 THEN RAISE EXCEPTION 'FAIL: asking twice made two deletions'; END IF;
  -- Nobody reads the queue but advisors and admins.
  PERFORM pg_temp.as_user(prospect);
  SET LOCAL ROLE authenticated;
  IF EXISTS (SELECT 1 FROM public.intake_deletions) THEN RAISE EXCEPTION 'FAIL: a prospect can read deletions'; END IF;
  IF pg_temp.state_of(format('UPDATE public.intake_deletions SET status = %L', 'done')) <> '42501' THEN RAISE EXCEPTION 'FAIL: a prospect could change a deletion'; END IF;
  RESET ROLE;
  PERFORM pg_temp.as_user(advisor);
  SET LOCAL ROLE authenticated;
  IF (SELECT count(*) FROM public.intake_deletions) <> 1 THEN RAISE EXCEPTION 'FAIL: an advisor cannot read deletions'; END IF;
  IF pg_temp.state_of('DELETE FROM public.intake_deletions') <> '42501' THEN RAISE EXCEPTION 'FAIL: an advisor could delete a deletion record'; END IF;
  RESET ROLE;
  PERFORM pg_temp.signed_out();
  DELETE FROM public.intake_deletions;
  RAISE NOTICE 'data_retention: request cases passed';
END $$;

-- ---------- claiming deletions ----------
DO $$
DECLARE
  admin uuid := (SELECT id FROM fx WHERE name = 'admin');
  d1 uuid := gen_random_uuid();
  d2 uuid := gen_random_uuid();
  d3 uuid := gen_random_uuid();
  got uuid[];
  attempt integer;
  lock_ends timestamptz;
BEGIN
  INSERT INTO public.intake_deletions (id, session_id, trigger, reason, next_attempt_at) VALUES
    (d1, gen_random_uuid(), 'retention', 'x', now() - interval '2 minutes'),
    (d2, gen_random_uuid(), 'retention', 'x', now() - interval '1 minute'),
    (d3, gen_random_uuid(), 'retention', 'x', now() + interval '1 hour');

  PERFORM pg_temp.as_user(admin);
  SET LOCAL ROLE authenticated;
  IF pg_temp.state_of('SELECT * FROM public.claim_intake_deletions()') <> '42501' THEN RAISE EXCEPTION 'FAIL: an admin could claim deletions'; END IF;
  IF pg_temp.state_of(format('SELECT * FROM public.intake_deletion_files(%L)', d1)) <> '42501' THEN RAISE EXCEPTION 'FAIL: an admin could list deletion files'; END IF;
  IF pg_temp.state_of(format('SELECT public.complete_intake_deletion(%L)', d1)) <> '42501' THEN RAISE EXCEPTION 'FAIL: an admin could complete a deletion'; END IF;
  IF pg_temp.state_of(format('SELECT public.fail_intake_deletion(%L, %L)', d1, 'x')) <> '42501' THEN RAISE EXCEPTION 'FAIL: an admin could fail a deletion'; END IF;
  RESET ROLE;
  PERFORM pg_temp.signed_out();

  SET LOCAL ROLE service_role;
  IF pg_temp.state_of('SELECT * FROM public.claim_intake_deletions(0)') <> '22023' THEN RAISE EXCEPTION 'FAIL: a zero batch was accepted'; END IF;
  IF pg_temp.state_of('SELECT * FROM public.claim_intake_deletions(5, 10)') <> '22023' THEN RAISE EXCEPTION 'FAIL: a 10-second lock was accepted'; END IF;
  -- Due ones only, oldest first, one attempt each.
  SELECT array_agg(c.id ORDER BY c.id), max(c.attempt) INTO got, attempt FROM public.claim_intake_deletions(5, 600) c;
  RESET ROLE;
  IF got IS DISTINCT FROM (SELECT array_agg(x ORDER BY x) FROM unnest(ARRAY[d1, d2]) x) OR attempt <> 1 THEN RAISE EXCEPTION 'FAIL: the first claim got % (attempt %)', got, attempt; END IF;
  SELECT locked_until INTO lock_ends FROM public.intake_deletions WHERE id = d1;
  IF (SELECT status FROM public.intake_deletions WHERE id = d1) <> 'claimed' OR lock_ends < now() + interval '590 seconds' OR lock_ends > now() + interval '610 seconds' THEN
    RAISE EXCEPTION 'FAIL: the claim was not locked for 10 minutes';
  END IF;
  SET LOCAL ROLE service_role;
  IF EXISTS (SELECT 1 FROM public.claim_intake_deletions(5, 600)) THEN RAISE EXCEPTION 'FAIL: a locked claim was claimed again'; END IF;
  RESET ROLE;
  -- A claim whose worker was lost lapses and is taken again, as the next attempt.
  UPDATE public.intake_deletions SET locked_until = now() - interval '1 second' WHERE id = d1;
  SET LOCAL ROLE service_role;
  SELECT array_agg(c.id), max(c.attempt) INTO got, attempt FROM public.claim_intake_deletions(5, 600) c;
  RESET ROLE;
  IF got IS DISTINCT FROM ARRAY[d1] OR attempt <> 2 THEN RAISE EXCEPTION 'FAIL: the lapsed claim gave % (attempt %)', got, attempt; END IF;
  DELETE FROM public.intake_deletions;
  RAISE NOTICE 'data_retention: claim cases passed';
END $$;

-- ---------- which files a deletion removes ----------
DO $$
DECLARE
  prospect uuid := (SELECT id FROM fx WHERE name = 'prospect');
  other uuid := (SELECT id FROM fx WHERE name = 'other');
  target uuid := pg_temp.new_draft(prospect, 'Target Co');
  sibling uuid := pg_temp.new_draft(prospect, 'Sibling Co');
  d uuid;
  listed text[];
BEGIN
  PERFORM pg_temp.add_files(target, 2);
  PERFORM pg_temp.add_files(sibling, 1);
  -- Distractors: another user's folder named after the target, a target-named path in the wrong bucket,
  -- and a legacy row pointing at someone else's file.
  INSERT INTO storage.objects (bucket_id, name) VALUES
    ('documents', other || '/' || target || '/planted.csv'),
    ('documents', target || '/v1-x.pdf'),
    ('documents', other || '/elsewhere/victim.csv');
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path)
  VALUES (prospect, target, 'stray.csv', '1 KB', other || '/elsewhere/victim.csv');
  INSERT INTO public.intake_deletions (session_id, user_id, trigger, reason, status) VALUES (target, prospect, 'request', 'x', 'claimed') RETURNING id INTO d;

  SET LOCAL ROLE service_role;
  SELECT array_agg(f.bucket || ':' || f.name ORDER BY f.bucket, f.name) INTO listed FROM public.intake_deletion_files(d) f;
  IF pg_temp.state_of(format('SELECT * FROM public.intake_deletion_files(%L)', gen_random_uuid())) <> 'PT404' THEN RAISE EXCEPTION 'FAIL: an unknown deletion was not PT404'; END IF;
  RESET ROLE;
  IF listed IS DISTINCT FROM ARRAY[
    format('documents:%s/%s/1_payroll.csv', prospect, target),
    format('documents:%s/%s/2_payroll.csv', prospect, target),
    format('manuscripts:%s/v1-x.pdf', target)
  ] THEN
    RAISE EXCEPTION 'FAIL: the deletion would remove %', listed;
  END IF;

  INSERT INTO fx VALUES ('target', target), ('sibling', sibling), ('target_deletion', d);
  RAISE NOTICE 'data_retention: file listing cases passed';
END $$;

-- ---------- completing a deletion ----------
DO $$
DECLARE
  prospect uuid := (SELECT id FROM fx WHERE name = 'prospect');
  advisor uuid := (SELECT id FROM fx WHERE name = 'advisor');
  target uuid := (SELECT id FROM fx WHERE name = 'target');
  sibling uuid := (SELECT id FROM fx WHERE name = 'sibling');
  d uuid := (SELECT id FROM fx WHERE name = 'target_deletion');
  pending uuid;
  gone uuid;
  before_target jsonb;
  before_sibling jsonb;
  removed jsonb;
  remaining integer;
  detail text;
  row_ public.intake_deletions;
  ops_id bigint;
BEGIN
  PERFORM pg_temp.certify(target);
  PERFORM pg_temp.certify(sibling);
  PERFORM pg_temp.advisor_work(target, advisor);
  PERFORM pg_temp.advisor_work(sibling, advisor);
  INSERT INTO public.ops_events (kind, source, code, session_id) VALUES ('upload_failed', 'browser', 'storage_upload', target) RETURNING id INTO ops_id;
  before_target := pg_temp.footprint(target);
  before_sibling := pg_temp.footprint(sibling);
  -- Every kind of row is there to delete.
  IF EXISTS (SELECT 1 FROM jsonb_each_text(before_target) WHERE value::integer < 1) THEN RAISE EXCEPTION 'FAIL: the fixture lacks rows: %', before_target; END IF;

  -- Only a claimed deletion completes.
  INSERT INTO public.intake_deletions (session_id, trigger, reason) VALUES (gen_random_uuid(), 'retention', 'x') RETURNING id INTO pending;
  SET LOCAL ROLE service_role;
  IF pg_temp.state_of(format('SELECT public.complete_intake_deletion(%L)', pending)) <> '55000' THEN RAISE EXCEPTION 'FAIL: a pending deletion completed'; END IF;
  IF pg_temp.state_of(format('SELECT public.complete_intake_deletion(%L)', gen_random_uuid())) <> 'PT404' THEN RAISE EXCEPTION 'FAIL: an unknown deletion was not PT404'; END IF;
  -- Not while any file is still stored.
  BEGIN
    PERFORM public.complete_intake_deletion(d, 0);
    RAISE EXCEPTION 'FAIL: the rows were deleted while files were stored';
  EXCEPTION WHEN SQLSTATE 'EA006' THEN
    GET STACKED DIAGNOSTICS detail = PG_EXCEPTION_DETAIL;
  END;
  RESET ROLE;
  IF detail <> '3' THEN RAISE EXCEPTION 'FAIL: EA006 said % files remain, not 3', detail; END IF;
  IF pg_temp.footprint(target) IS DISTINCT FROM before_target THEN RAISE EXCEPTION 'FAIL: a refused completion deleted rows'; END IF;

  -- The worker removes the files (the Storage API removes the storage.objects rows), then completes.
  DELETE FROM storage.objects WHERE (bucket_id = 'documents' AND name LIKE prospect || '/' || target || '/%')
    OR (bucket_id = 'manuscripts' AND name LIKE target || '/%');
  SET LOCAL ROLE service_role;
  removed := public.complete_intake_deletion(d, 3);
  IF NULLIF(current_setting('eaa.deleting_intake', true), '') IS NOT NULL THEN RAISE EXCEPTION 'FAIL: the deletion setting outlived the deletion'; END IF;
  RESET ROLE;

  -- Every row it had, counted table by table, and nothing of it left.
  IF removed IS DISTINCT FROM before_target THEN RAISE EXCEPTION 'FAIL: it reported % but the intake had %', removed, before_target; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_each_text(pg_temp.footprint(target)) WHERE value::integer <> 0) THEN RAISE EXCEPTION 'FAIL: rows remain: %', pg_temp.footprint(target); END IF;
  IF pg_temp.footprint(sibling) IS DISTINCT FROM before_sibling THEN RAISE EXCEPTION 'FAIL: another intake changed: %', pg_temp.footprint(sibling); END IF;
  IF (SELECT count(*) FROM storage.objects WHERE name LIKE '%' || sibling || '%') <> 2 THEN RAISE EXCEPTION 'FAIL: the other intake lost files'; END IF;
  -- The record stays, done, with what it removed.
  SELECT * INTO row_ FROM public.intake_deletions WHERE id = d;
  IF row_.status <> 'done' OR row_.files_deleted <> 3 OR row_.rows_deleted IS DISTINCT FROM removed OR row_.completed_at IS NULL
     OR row_.locked_until IS NOT NULL OR row_.last_error IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: the deletion record is %', to_jsonb(row_);
  END IF;
  -- Monitoring keeps its count but loses the link.
  IF (SELECT session_id FROM public.ops_events WHERE id = ops_id) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: an ops event still points at the deleted intake'; END IF;
  SET LOCAL ROLE service_role;
  IF pg_temp.state_of(format('SELECT public.complete_intake_deletion(%L)', d)) <> '55000' THEN RAISE EXCEPTION 'FAIL: a done deletion completed again'; END IF;
  RESET ROLE;

  -- An intake that is already gone is done, with nothing to delete.
  INSERT INTO public.intake_deletions (session_id, user_id, trigger, reason, status) VALUES (gen_random_uuid(), prospect, 'request', 'x', 'claimed') RETURNING id INTO gone;
  SET LOCAL ROLE service_role;
  removed := public.complete_intake_deletion(gone);
  RESET ROLE;
  IF EXISTS (SELECT 1 FROM jsonb_each_text(removed) WHERE value::integer <> 0) OR (SELECT status FROM public.intake_deletions WHERE id = gone) <> 'done' THEN
    RAISE EXCEPTION 'FAIL: a gone intake gave %', removed;
  END IF;
  DELETE FROM public.intake_deletions WHERE id IN (pending, gone);
  RAISE NOTICE 'data_retention: completion cases passed';
END $$;

-- ---------- the audit tables still refuse changes outside a deletion ----------
DO $$
DECLARE
  sibling uuid := (SELECT id FROM fx WHERE name = 'sibling');
  advisor uuid := (SELECT id FROM fx WHERE name = 'advisor');
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['submission_status_history', 'advisor_review_events', 'advisor_notes', 'manuscript_versions', 'intake_lifecycle_events'] LOOP
    -- An advisor: no grant, and the trigger behind it.
    PERFORM pg_temp.as_user(advisor);
    SET LOCAL ROLE authenticated;
    IF pg_temp.state_of(format('DELETE FROM public.%I WHERE session_id = %L', t, sibling)) <> '42501' THEN RAISE EXCEPTION 'FAIL: an advisor deleted from %', t; END IF;
    RESET ROLE;
    PERFORM pg_temp.signed_out();
    -- The service role, even naming the intake in the deletion setting.
    SET LOCAL ROLE service_role;
    PERFORM set_config('eaa.deleting_intake', sibling::text, true);
    IF pg_temp.state_of(format('DELETE FROM public.%I WHERE session_id = %L', t, sibling)) <> '42501' THEN RAISE EXCEPTION 'FAIL: the service role deleted from %', t; END IF;
    RESET ROLE;
    -- The superuser without the setting, with it naming another intake, and updating with it set.
    PERFORM set_config('eaa.deleting_intake', '', true);
    IF pg_temp.state_of(format('DELETE FROM public.%I WHERE session_id = %L', t, sibling)) <> '42501' THEN RAISE EXCEPTION 'FAIL: postgres deleted from % without the setting', t; END IF;
    PERFORM set_config('eaa.deleting_intake', gen_random_uuid()::text, true);
    IF pg_temp.state_of(format('DELETE FROM public.%I WHERE session_id = %L', t, sibling)) <> '42501' THEN RAISE EXCEPTION 'FAIL: postgres deleted from % under another intake''s setting', t; END IF;
    PERFORM set_config('eaa.deleting_intake', sibling::text, true);
    IF pg_temp.state_of(format('UPDATE public.%I SET session_id = session_id WHERE session_id = %L', t, sibling)) <> '42501' THEN RAISE EXCEPTION 'FAIL: postgres updated % under the setting', t; END IF;
    PERFORM set_config('eaa.deleting_intake', '', true);
  END LOOP;
  IF (pg_temp.footprint(sibling) ->> 'submission_status_history')::integer < 1 OR (pg_temp.footprint(sibling) ->> 'advisor_notes')::integer <> 1 THEN
    RAISE EXCEPTION 'FAIL: audit rows went missing';
  END IF;
  RAISE NOTICE 'data_retention: append-only cases passed';
END $$;

-- ---------- failed attempts, giving up, and an admin's retry ----------
DO $$
DECLARE
  prospect uuid := (SELECT id FROM fx WHERE name = 'prospect');
  advisor uuid := (SELECT id FROM fx WHERE name = 'advisor');
  admin uuid := (SELECT id FROM fx WHERE name = 'admin');
  sid uuid := gen_random_uuid();
  d uuid;
  outcome text;
  row_ public.intake_deletions;
  ev public.ops_events;
BEGIN
  INSERT INTO public.intake_deletions (session_id, user_id, trigger, reason) VALUES (sid, prospect, 'retention', 'x') RETURNING id INTO d;
  SET LOCAL ROLE service_role;
  IF pg_temp.state_of(format('SELECT public.fail_intake_deletion(%L, %L)', d, 'x')) <> '55000' THEN RAISE EXCEPTION 'FAIL: a pending deletion failed'; END IF;
  IF pg_temp.state_of(format('SELECT public.fail_intake_deletion(%L, %L)', gen_random_uuid(), 'x')) <> 'PT404' THEN RAISE EXCEPTION 'FAIL: an unknown deletion was not PT404'; END IF;
  PERFORM public.claim_intake_deletions(5, 600);
  outcome := public.fail_intake_deletion(d, 'storage_remove:500', 300);
  RESET ROLE;
  SELECT * INTO row_ FROM public.intake_deletions WHERE id = d;
  IF outcome <> 'pending' OR row_.status <> 'pending' OR row_.attempts <> 1 OR row_.last_error <> 'storage_remove:500' OR row_.locked_until IS NOT NULL
     OR row_.next_attempt_at < now() + interval '295 seconds' OR row_.next_attempt_at > now() + interval '305 seconds' THEN
    RAISE EXCEPTION 'FAIL: a first failure left %', to_jsonb(row_);
  END IF;
  -- Not due again until its backoff has passed.
  SET LOCAL ROLE service_role;
  IF EXISTS (SELECT 1 FROM public.claim_intake_deletions(5, 600)) THEN RAISE EXCEPTION 'FAIL: a deletion was claimed inside its backoff'; END IF;
  RESET ROLE;
  -- The reason is a code: anything else is stripped out.
  UPDATE public.intake_deletions SET status = 'claimed' WHERE id = d;
  SET LOCAL ROLE service_role;
  PERFORM public.fail_intake_deletion(d, 'files remain: <Jane Doe.csv>', 60);
  RESET ROLE;
  IF (SELECT last_error FROM public.intake_deletions WHERE id = d) <> 'filesremain:JaneDoe.csv' THEN
    RAISE EXCEPTION 'FAIL: the reason was stored as %', (SELECT last_error FROM public.intake_deletions WHERE id = d);
  END IF;

  -- The last attempt gives up, and records a deletion_failed event so ops-monitor alerts.
  UPDATE public.intake_deletions SET status = 'claimed', attempts = 5 WHERE id = d;
  SET LOCAL ROLE service_role;
  outcome := public.fail_intake_deletion(d, 'files_remain:2', 300);
  RESET ROLE;
  SELECT * INTO row_ FROM public.intake_deletions WHERE id = d;
  SELECT * INTO ev FROM public.ops_events WHERE kind = 'deletion_failed' AND session_id = sid;
  IF outcome <> 'failed' OR row_.status <> 'failed' OR row_.last_error <> 'files_remain:2' THEN RAISE EXCEPTION 'FAIL: the last failure left %', to_jsonb(row_); END IF;
  IF ev.id IS NULL OR ev.source <> 'purge-intakes' OR ev.code <> 'files_remain:2' THEN RAISE EXCEPTION 'FAIL: the give-up event was %', to_jsonb(ev); END IF;
  SET LOCAL ROLE service_role;
  IF EXISTS (SELECT 1 FROM public.claim_intake_deletions(5, 600)) THEN RAISE EXCEPTION 'FAIL: a failed deletion was claimed'; END IF;
  RESET ROLE;

  -- Only an admin puts it back.
  FOREACH sid IN ARRAY ARRAY[prospect, advisor] LOOP
    PERFORM pg_temp.as_user(sid);
    SET LOCAL ROLE authenticated;
    IF pg_temp.state_of(format('SELECT public.retry_intake_deletion(%L)', d)) <> '42501' THEN RAISE EXCEPTION 'FAIL: % could retry a deletion', sid; END IF;
    RESET ROLE;
  END LOOP;
  PERFORM pg_temp.as_user(admin);
  SET LOCAL ROLE authenticated;
  IF public.retry_intake_deletion(d) IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: the admin retry was refused'; END IF;
  IF public.retry_intake_deletion(d) IS NOT FALSE THEN RAISE EXCEPTION 'FAIL: retrying a pending deletion answered true'; END IF;
  RESET ROLE;
  PERFORM pg_temp.signed_out();
  SELECT * INTO row_ FROM public.intake_deletions WHERE id = d;
  IF row_.status <> 'pending' OR row_.attempts <> 0 OR row_.next_attempt_at > now() THEN RAISE EXCEPTION 'FAIL: the retry left %', to_jsonb(row_); END IF;
  DELETE FROM public.intake_deletions WHERE id = d;
  RAISE NOTICE 'data_retention: failure cases passed';
END $$;

-- ---------- a worker lost on its last attempt is escalated, not retried for ever ----------
DO $$
DECLARE
  prospect uuid := (SELECT id FROM fx WHERE name = 'prospect');
  lost uuid; retried uuid; held uuid;
  lost_sid uuid := gen_random_uuid();
  got uuid[];
  row_ public.intake_deletions;
  ev public.ops_events;
BEGIN
  -- Park every other deletion, so the claims below can only take these three.
  CREATE TEMP TABLE parked ON COMMIT DROP AS
    SELECT id, status, next_attempt_at, locked_until FROM public.intake_deletions WHERE status IN ('pending', 'claimed');
  UPDATE public.intake_deletions SET next_attempt_at = 'infinity', locked_until = 'infinity' WHERE id IN (SELECT id FROM parked);

  -- Its worker was killed (or timed out) every time, so fail_intake_deletion never ran: lapsed, every attempt used.
  INSERT INTO public.intake_deletions (session_id, user_id, trigger, reason, status, attempts, locked_until)
  VALUES (lost_sid, prospect, 'retention', 'x', 'claimed', 5, now() - interval '1 second') RETURNING id INTO lost;
  -- Lapsed with attempts left: claimed again. Still locked with every attempt used: its worker may be running.
  INSERT INTO public.intake_deletions (session_id, user_id, trigger, reason, status, attempts, locked_until)
  VALUES (gen_random_uuid(), prospect, 'retention', 'x', 'claimed', 2, now() - interval '1 second') RETURNING id INTO retried;
  INSERT INTO public.intake_deletions (session_id, user_id, trigger, reason, status, attempts, locked_until)
  VALUES (gen_random_uuid(), prospect, 'retention', 'x', 'claimed', 5, now() + interval '5 minutes') RETURNING id INTO held;

  SET LOCAL ROLE service_role;
  SELECT array_agg(c.id) INTO got FROM public.claim_intake_deletions(5, 600) c;
  RESET ROLE;
  IF got IS DISTINCT FROM ARRAY[retried] THEN RAISE EXCEPTION 'FAIL: the claim took %, expected only the one with attempts left', got; END IF;
  IF (SELECT attempts FROM public.intake_deletions WHERE id = retried) <> 3 THEN RAISE EXCEPTION 'FAIL: the reclaimed deletion did not count an attempt'; END IF;

  SELECT * INTO row_ FROM public.intake_deletions WHERE id = lost;
  IF row_.status <> 'failed' OR row_.last_error <> 'worker_lost' OR row_.locked_until IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: the lost worker''s deletion was left %', to_jsonb(row_);
  END IF;
  SELECT * INTO ev FROM public.ops_events WHERE kind = 'deletion_failed' AND session_id = lost_sid;
  IF ev.id IS NULL OR ev.source <> 'purge-intakes' OR ev.code <> 'worker_lost' THEN RAISE EXCEPTION 'FAIL: no alert for the lost worker (%)', to_jsonb(ev); END IF;
  IF (SELECT status FROM public.intake_deletions WHERE id = held) <> 'claimed' THEN RAISE EXCEPTION 'FAIL: a claim still locked was reaped'; END IF;

  DELETE FROM public.intake_deletions WHERE id IN (lost, retried, held);
  DELETE FROM public.ops_events WHERE session_id = lost_sid;
  UPDATE public.intake_deletions d SET next_attempt_at = p.next_attempt_at, locked_until = p.locked_until
  FROM parked p WHERE d.id = p.id;
  RAISE NOTICE 'data_retention: lost worker cases passed';
END $$;

-- ---------- no new files once a deletion is open ----------
DO $$
DECLARE
  owner uuid := pg_temp.new_user('uploader@example.test');
  advisor uuid := (SELECT id FROM fx WHERE name = 'advisor');
  admin uuid := (SELECT id FROM fx WHERE name = 'admin');
  sid uuid;
  d uuid;
  file_ text;
  row_ text;
BEGIN
  PERFORM pg_temp.as_user(owner);
  SET LOCAL ROLE authenticated;
  PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree');
  INSERT INTO public.chamber_sessions (user_id) VALUES (owner) RETURNING id INTO sid;
  file_ := 'INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)';
  row_ := 'INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path) VALUES (%L, %L, %L, %L, %L)';

  -- Before: the owner stores a file and its row, and an advisor a Manuscript.
  IF pg_temp.state_of(format(file_, 'documents', owner || '/' || sid || '/a.csv')) <> 'ok' THEN RAISE EXCEPTION 'FAIL: the owner could not upload'; END IF;
  IF pg_temp.state_of(format(row_, owner, sid, 'a.csv', '1 KB', owner || '/' || sid || '/a.csv')) <> 'ok' THEN RAISE EXCEPTION 'FAIL: the owner could not add the row'; END IF;
  RESET ROLE;
  PERFORM pg_temp.as_user(advisor);
  SET LOCAL ROLE authenticated;
  IF pg_temp.state_of(format(file_, 'manuscripts', sid || '/v1-a.pdf')) <> 'ok' THEN RAISE EXCEPTION 'FAIL: the advisor could not store a Manuscript'; END IF;
  RESET ROLE;

  PERFORM pg_temp.as_user(admin);
  SET LOCAL ROLE authenticated;
  d := public.request_intake_deletion(sid, 'The owner asked by email');
  RESET ROLE;

  -- After: nothing more for that intake, in either bucket or as a row.
  PERFORM pg_temp.as_user(owner);
  SET LOCAL ROLE authenticated;
  IF pg_temp.state_of(format(file_, 'documents', owner || '/' || sid || '/b.csv')) <> '42501' THEN RAISE EXCEPTION 'FAIL: a file was stored after the deletion was asked for'; END IF;
  IF pg_temp.state_of(format(row_, owner, sid, 'a2.csv', '1 KB', owner || '/' || sid || '/a2.csv')) <> 'EA007' THEN RAISE EXCEPTION 'FAIL: a document row was added after the deletion was asked for'; END IF;
  RESET ROLE;
  PERFORM pg_temp.as_user(advisor);
  SET LOCAL ROLE authenticated;
  IF pg_temp.state_of(format(file_, 'manuscripts', sid || '/v2-a.pdf')) <> '42501' THEN RAISE EXCEPTION 'FAIL: a Manuscript was stored after the deletion was asked for'; END IF;
  -- A folder that names no intake is refused too.
  IF pg_temp.state_of(format(file_, 'manuscripts', gen_random_uuid() || '/v1-a.pdf')) <> '42501' THEN RAISE EXCEPTION 'FAIL: a Manuscript for no intake was stored'; END IF;
  IF pg_temp.state_of(format(file_, 'manuscripts', 'not-an-id/v1-a.pdf')) <> '42501' THEN RAISE EXCEPTION 'FAIL: a Manuscript under a made-up folder was stored'; END IF;
  RESET ROLE;
  PERFORM pg_temp.signed_out();
  IF public.intake_accepts_files(sid::text) OR public.intake_accepts_files(NULL) OR public.intake_accepts_files('x') THEN
    RAISE EXCEPTION 'FAIL: intake_accepts_files said yes';
  END IF;

  -- Once it is done, the intake is gone, and so is the right to store anything under it.
  DELETE FROM storage.objects WHERE name LIKE '%' || sid || '%';
  UPDATE public.intake_deletions SET status = 'claimed', locked_until = now() + interval '10 minutes' WHERE id = d;
  SET LOCAL ROLE service_role;
  PERFORM public.complete_intake_deletion(d, 2);
  RESET ROLE;
  IF public.intake_accepts_files(sid::text) THEN RAISE EXCEPTION 'FAIL: a deleted intake accepts files'; END IF;
  RAISE NOTICE 'data_retention: upload-during-deletion cases passed';
END $$;

-- ---------- run_retention prunes what has aged out ----------
DO $$
DECLARE
  prospect uuid := (SELECT id FROM fx WHERE name = 'prospect');
  closed_draft uuid := pg_temp.new_draft(prospect, 'Closed Long Ago Co');
  old_event uuid;
  result jsonb;
BEGIN
  PERFORM pg_temp.closed(closed_draft, 'expired', interval '45 days');
  DELETE FROM public.ops_events;
  INSERT INTO public.ops_events (kind, source, code, created_at) VALUES
    ('app_error', 'browser', 'old', now() - interval '91 days'),
    ('app_error', 'browser', 'recent', now() - interval '89 days');
  INSERT INTO public.email_delivery_events (provider_event_id, type, recipients, outcome, occurred_at, received_at)
  VALUES ('evt_old', 'email.bounced', ARRAY['bounced@example.test'], 'suppressed', now() - interval '400 days', now() - interval '400 days')
  RETURNING id INTO old_event;
  INSERT INTO public.email_delivery_events (provider_event_id, type, recipients, outcome, occurred_at, received_at)
  VALUES ('evt_new', 'email.bounced', ARRAY['new@example.test'], 'recorded', now() - interval '10 days', now() - interval '10 days');
  INSERT INTO public.email_suppressions (address, reason, first_event_id) VALUES ('bounced@example.test', 'bounced', old_event);
  INSERT INTO public.ai_request_log (user_id, created_at) VALUES (prospect, now() - interval '25 hours'), (prospect, now() - interval '1 hour');
  INSERT INTO public.ai_ip_log (ip_hash, created_at) VALUES ('h-old', now() - interval '25 hours'), ('h-new', now() - interval '1 hour');
  INSERT INTO public.ai_global_usage (day, calls) VALUES ((now() - interval '100 days')::date, 7), (now()::date, 3)
    ON CONFLICT (day) DO UPDATE SET calls = excluded.calls;

  SET LOCAL ROLE service_role;
  result := public.run_retention();
  RESET ROLE;
  IF result IS DISTINCT FROM jsonb_build_object(
       'deletions_queued', 1, 'ops_events_pruned', 1, 'email_events_pruned', 1,
       'ai_request_log_pruned', 1, 'ai_ip_log_pruned', 1, 'ai_global_usage_pruned', 1) THEN
    RAISE EXCEPTION 'FAIL: run_retention reported %', result;
  END IF;
  IF (SELECT array_agg(code) FROM public.ops_events) IS DISTINCT FROM ARRAY['recent'] THEN RAISE EXCEPTION 'FAIL: the wrong ops events were pruned'; END IF;
  IF (SELECT array_agg(provider_event_id) FROM public.email_delivery_events) IS DISTINCT FROM ARRAY['evt_new'] THEN RAISE EXCEPTION 'FAIL: the wrong email events were pruned'; END IF;
  IF (SELECT first_event_id FROM public.email_suppressions WHERE address = 'bounced@example.test') IS NOT NULL
     OR NOT EXISTS (SELECT 1 FROM public.email_suppressions WHERE address = 'bounced@example.test') THEN
    RAISE EXCEPTION 'FAIL: the suppression was lost, or still points at its pruned event';
  END IF;
  IF (SELECT count(*) FROM public.ai_request_log WHERE user_id = prospect) <> 1 OR (SELECT array_agg(ip_hash) FROM public.ai_ip_log) IS DISTINCT FROM ARRAY['h-new'] THEN
    RAISE EXCEPTION 'FAIL: the AI rate-limit records were not pruned';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ai_global_usage WHERE day < (now() - interval '90 days')::date) OR NOT EXISTS (SELECT 1 FROM public.ai_global_usage WHERE day = now()::date) THEN
    RAISE EXCEPTION 'FAIL: the daily AI totals were pruned wrong';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.intake_deletions WHERE session_id = closed_draft AND trigger = 'retention' AND status = 'pending') THEN
    RAISE EXCEPTION 'FAIL: run_retention did not queue the closed draft';
  END IF;
  DELETE FROM public.intake_deletions WHERE session_id = closed_draft;
  RAISE NOTICE 'data_retention: run_retention cases passed';
END $$;

-- ---------- submitted records past their window are listed for advisors ----------
DO $$
DECLARE
  prospect uuid := (SELECT id FROM fx WHERE name = 'prospect');
  guest uuid := (SELECT id FROM fx WHERE name = 'guest');
  advisor uuid := (SELECT id FROM fx WHERE name = 'advisor');
  admin uuid := (SELECT id FROM fx WHERE name = 'admin');
  fresh uuid := pg_temp.new_draft(prospect, 'Fresh Co');
  aged uuid := pg_temp.new_draft(prospect, 'Aged Co');
  aged_requested uuid := pg_temp.new_draft(prospect, 'Aged Requested Co');
  old_draft uuid := pg_temp.new_draft(prospect, 'Old Draft Co');
  got uuid[];
  last_at timestamptz;
  due_at timestamptz;
BEGIN
  PERFORM pg_temp.certify(fresh);
  PERFORM pg_temp.certify(aged);
  PERFORM pg_temp.certify(aged_requested);
  -- Only the submitted record from this fixture past the window counts; earlier fixtures' certifications are recent.
  UPDATE public.chamber_certifications SET recorded_at = now() - interval '3 years 1 day' WHERE session_id IN (aged, aged_requested);
  UPDATE public.chamber_sessions SET last_activity_at = now() - interval '5 years' WHERE id = old_draft;
  INSERT INTO public.intake_deletions (session_id, trigger, reason) VALUES (aged_requested, 'request', 'x');

  PERFORM pg_temp.as_user(prospect);
  SET LOCAL ROLE authenticated;
  IF pg_temp.state_of('SELECT * FROM public.retention_review_due()') <> '42501' THEN RAISE EXCEPTION 'FAIL: a prospect could list records due for review'; END IF;
  RESET ROLE;
  PERFORM pg_temp.as_user(guest, true);
  SET LOCAL ROLE authenticated;
  IF pg_temp.state_of('SELECT * FROM public.retention_review_due()') <> '42501' THEN RAISE EXCEPTION 'FAIL: a guest could list records due for review'; END IF;
  RESET ROLE;
  PERFORM pg_temp.signed_out();
  SET LOCAL ROLE anon;
  IF pg_temp.state_of('SELECT * FROM public.retention_review_due()') <> '42501' THEN RAISE EXCEPTION 'FAIL: a signed-out caller could list records due for review'; END IF;
  RESET ROLE;

  FOREACH guest IN ARRAY ARRAY[advisor, admin] LOOP
    PERFORM pg_temp.as_user(guest);
    SET LOCAL ROLE authenticated;
    IF pg_temp.state_of('SELECT * FROM public.retention_review_due(0)') <> '22023' THEN RAISE EXCEPTION 'FAIL: a zero limit was accepted'; END IF;
    SELECT array_agg(r.session_id), max(r.last_certified_at), max(r.review_due_at) INTO got, last_at, due_at FROM public.retention_review_due() r;
    RESET ROLE;
    IF got IS DISTINCT FROM ARRAY[aged] THEN RAISE EXCEPTION 'FAIL: % saw % due for review', guest, got; END IF;
    IF due_at <> last_at + interval '3 years' OR last_at > now() - interval '3 years' THEN RAISE EXCEPTION 'FAIL: the review dates were % and %', last_at, due_at; END IF;
  END LOOP;
  PERFORM pg_temp.signed_out();
  RAISE NOTICE 'data_retention: review cases passed';
END $$;

-- ---------- catalogue: nothing that belongs to an intake is left behind ----------
-- Every public table with a session_id column holds something about an intake, so complete_intake_deletion
-- must delete it (or, for monitoring events, unlink it). intake_deletions is the record of the deletion
-- itself and is kept on purpose. A new table fails here until the deletion handles it.
DO $$
DECLARE
  body text := pg_get_functiondef('public.complete_intake_deletion(uuid, integer)'::regprocedure);
  missing text;
BEGIN
  SELECT string_agg(c.table_name, ', ' ORDER BY c.table_name) INTO missing
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.column_name = 'session_id'
    AND c.table_name NOT IN ('intake_deletions')
    AND c.table_name IN (SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE')
    AND position('public.' || c.table_name || ' ' IN body) = 0;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: complete_intake_deletion does not handle: %', missing;
  END IF;
  IF position('DELETE FROM public.chamber_sessions' IN body) = 0 THEN
    RAISE EXCEPTION 'FAIL: complete_intake_deletion does not delete the intake itself';
  END IF;
  RAISE NOTICE 'data_retention: catalogue cases passed';
END $$;

DO $$ BEGIN RAISE NOTICE 'data_retention: all cases passed'; END $$;
