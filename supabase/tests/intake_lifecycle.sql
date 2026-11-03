-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh intake_lifecycle
-- Intake lifecycle (A-1.5): the upgrade of existing rows, the server-owned activity and expiry times, the
-- expiry job (only uncertified drafts, one audit row each), the prospect's archive ("Start over"), an
-- admin's revocation, and what the prospect can still read, change or upload once an intake is closed.
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

-- Superuser only: a draft for uid, written as uid would (the lifecycle trigger stamps it as a privileged write).
CREATE FUNCTION pg_temp.new_draft(uid uuid, company text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE sid uuid;
BEGIN
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, jsonb_build_object('company_name', company)) RETURNING id INTO sid;
  RETURN sid;
END $$;

-- Superuser only: makes a draft look idle since `ago`, as a privileged write (the job and operators may set it).
CREATE FUNCTION pg_temp.idle_since(sid uuid, ago interval) RETURNS void LANGUAGE plpgsql AS
  $$ BEGIN UPDATE public.chamber_sessions SET last_activity_at = now() - ago WHERE id = sid; END $$;

-- Superuser only: certifies sid as its owner would.
CREATE FUNCTION pg_temp.certify(sid uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE intake public.chamber_sessions;
BEGIN
  SELECT * INTO intake FROM public.chamber_sessions WHERE id = sid;
  UPDATE public.chamber_sessions
  SET status = 'submitted',
      submission = jsonb_build_object('signer_name', 'Jo Doe', 'signer_title', 'CEO', 'signed_at', '2026-11-01T12:00:00Z',
        'file_id', 'EAA-T', 'consent_version', 'v1', 'consent_text', 'I certify.', 'chamber_data', intake.chamber_data)
  WHERE id = sid;
END $$;

CREATE FUNCTION pg_temp.snap(sid uuid) RETURNS jsonb LANGUAGE sql AS
  $$ SELECT to_jsonb(s) FROM public.chamber_sessions s WHERE s.id = sid $$;

-- Rows a statement matched (what PostgREST returns with .select(): 0 is "no such row for you").
CREATE FUNCTION pg_temp.rows_changed(stmt text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE stmt;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
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

-- ---------- rows from before the migration ----------
CREATE TEMP TABLE fx (name text PRIMARY KEY, id uuid);
GRANT SELECT ON fx TO authenticated, service_role;
DO $$
DECLARE
  owner uuid := pg_temp.new_user('legacy@example.test');
  old_draft uuid;
  certified uuid;
  withdrawn uuid;
BEGIN
  PERFORM pg_temp.as_user(owner);
  old_draft := pg_temp.new_draft(owner, 'Old Draft Co');
  certified := pg_temp.new_draft(owner, 'Certified Co');
  withdrawn := pg_temp.new_draft(owner, 'Withdrawn Co');
  PERFORM pg_temp.certify(certified);
  PERFORM pg_temp.certify(withdrawn);
  UPDATE public.chamber_sessions SET chamber_data = '{"company_name":"Withdrawn Co, edited"}' WHERE id = withdrawn;
  -- Idle for 90 days, as far as updated_at can tell.
  PERFORM set_config('session_replication_role', 'replica', true);
  UPDATE public.chamber_sessions SET updated_at = now() - interval '90 days' WHERE user_id = owner;
  PERFORM set_config('session_replication_role', 'origin', true);
  INSERT INTO fx VALUES ('legacy_owner', owner), ('old_draft', old_draft), ('old_certified', certified), ('old_withdrawn', withdrawn);
  PERFORM pg_temp.signed_out();
END $$;

CREATE TEMP TABLE before_upgrade AS SELECT id, data_version, updated_at FROM public.chamber_sessions;

\i supabase/migrations/20261103090000_intake_lifecycle.sql
\i supabase/migrations/20261103091000_intake_schema_version.sql
\i supabase/migrations/20261103120100_intake_schema_v2_version.sql
SET client_min_messages = notice;

-- ---------- what the migration installed, and the upgrade ----------
DO $$
DECLARE
  before_triggers text;
  r record;
BEGIN
  -- The lifecycle trigger sees the status the certification trigger leaves, and runs before updated_at.
  SELECT string_agg(tgname, ' < ' ORDER BY tgname) INTO before_triggers
    FROM pg_trigger
   WHERE tgrelid = 'public.chamber_sessions'::regclass AND NOT tgisinternal
     AND (tgtype & 2) = 2 AND (tgtype & 16) = 16;
  IF before_triggers IS DISTINCT FROM 'chamber_sessions_block_guest_submission < chamber_sessions_certification_validate'
      || ' < chamber_sessions_data_validate < chamber_sessions_data_version < chamber_sessions_lifecycle < update_chamber_sessions_updated_at' THEN
    RAISE EXCEPTION 'FAIL: BEFORE UPDATE order is %', before_triggers;
  END IF;

  -- The backfill was not a save: versions and updated_at are as they were.
  IF EXISTS (
    SELECT 1 FROM public.chamber_sessions s JOIN before_upgrade b USING (id)
    WHERE s.data_version <> b.data_version OR s.updated_at <> b.updated_at
  ) THEN
    RAISE EXCEPTION 'FAIL: the backfill moved a version or updated_at';
  END IF;
  -- Activity comes from updated_at; an existing draft gets a full window from today, never less.
  FOR r IN SELECT s.*, b.updated_at AS was FROM public.chamber_sessions s JOIN before_upgrade b USING (id) LOOP
    IF r.last_activity_at <> r.was THEN RAISE EXCEPTION 'FAIL: last_activity_at of % is %, not updated_at %', r.id, r.last_activity_at, r.was; END IF;
  END LOOP;
  SELECT * INTO r FROM public.chamber_sessions WHERE id = (SELECT id FROM fx WHERE name = 'old_draft');
  IF r.expires_at < now() + interval '29 days 23 hours' THEN
    RAISE EXCEPTION 'FAIL: a 90-day-idle draft was given expires_at %, before a full window from the deploy', r.expires_at;
  END IF;
  IF (SELECT expires_at FROM public.chamber_sessions WHERE id = (SELECT id FROM fx WHERE name = 'old_certified')) IS NOT NULL
     OR (SELECT expires_at FROM public.chamber_sessions WHERE id = (SELECT id FROM fx WHERE name = 'old_withdrawn')) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: an intake that was certified got an expiry';
  END IF;

  -- The status set is enforced and was validated against the existing rows.
  IF NOT (SELECT convalidated FROM pg_constraint WHERE conname = 'chamber_sessions_status_check') THEN
    RAISE EXCEPTION 'FAIL: the status constraint was not validated';
  END IF;
  IF pg_temp.state_of(format('UPDATE public.chamber_sessions SET status = %L WHERE id = %L', 'paused', (SELECT id FROM fx WHERE name = 'old_draft'))) <> '23514' THEN
    RAISE EXCEPTION 'FAIL: a status outside the set was accepted';
  END IF;

  -- Every session follows intake schema v2 (v1 plus the workers' comp block), old rows included, and no
  -- other version can be stored. Moving rows to 2 was not a save: before_upgrade is checked below.
  IF EXISTS (SELECT 1 FROM public.chamber_sessions WHERE schema_version <> 2) THEN RAISE EXCEPTION 'FAIL: a row is not at schema version 2'; END IF;
  IF (SELECT column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chamber_sessions' AND column_name = 'schema_version') <> '2' THEN
    RAISE EXCEPTION 'FAIL: new rows do not default to schema version 2';
  END IF;
  IF pg_temp.state_of(format('UPDATE public.chamber_sessions SET schema_version = 1 WHERE id = %L', (SELECT id FROM fx WHERE name = 'old_draft'))) <> '23514' THEN
    RAISE EXCEPTION 'FAIL: schema version 1 was accepted';
  END IF;
  IF pg_temp.state_of(format('UPDATE public.chamber_sessions SET schema_version = 3 WHERE id = %L', (SELECT id FROM fx WHERE name = 'old_draft'))) <> '23514' THEN
    RAISE EXCEPTION 'FAIL: schema version 3 was accepted';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.chamber_sessions'::regclass AND NOT tgisinternal AND tgenabled = 'D') THEN
    RAISE EXCEPTION 'FAIL: a chamber_sessions trigger was left disabled';
  END IF;

  -- Without pg_cron the schedule is skipped, quietly.
  IF to_regnamespace('cron') IS NOT NULL THEN RAISE EXCEPTION 'FAIL: the migration invented a cron schema'; END IF;

  -- Who may call what.
  IF has_function_privilege('authenticated', 'public.expire_idle_intakes(integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.expire_idle_intakes(integer)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.expire_idle_intakes(integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: expire_idle_intakes is not service_role only';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.archive_chamber_session(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.archive_chamber_session(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.revoke_chamber_session(uuid, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.revoke_chamber_session(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: archive/revoke are not open to signed-in users only';
  END IF;
  IF has_function_privilege('authenticated', 'public.stamp_intake_lifecycle()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.documents_refuse_closed_intake()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: a trigger function is executable by clients';
  END IF;
  RAISE NOTICE 'intake_lifecycle: installation and upgrade cases passed';
END $$;

-- ---------- fixtures ----------
DO $$
DECLARE
  prospect uuid := pg_temp.new_user('prospect@example.test');
  guest uuid := pg_temp.new_user('guest@example.test', true);
  other uuid := pg_temp.new_user('other@example.test');
  advisor uuid := pg_temp.new_user('advisor@example.test');
  admin uuid := pg_temp.new_user('admin@example.test');
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (advisor, 'advisor'), (admin, 'admin');
  INSERT INTO fx VALUES ('prospect', prospect), ('guest', guest), ('other', other), ('advisor', advisor), ('admin', admin);
END $$;

-- ---------- the server owns last_activity_at and expires_at ----------
DO $$
DECLARE
  guest uuid := (SELECT id FROM fx WHERE name = 'guest');
  sid uuid;
  r public.chamber_sessions;
  n bigint;
BEGIN
  PERFORM pg_temp.as_user(guest, true);
  SET LOCAL ROLE authenticated;
  -- A client can't back-date or extend its own draft.
  INSERT INTO public.chamber_sessions (user_id, chamber_data, last_activity_at, expires_at)
  VALUES (guest, '{"company_name":"Guest Co"}', '2020-01-01', '2999-01-01')
  RETURNING * INTO r;
  sid := r.id;
  IF r.last_activity_at < now() - interval '1 minute' OR r.expires_at <> r.last_activity_at + interval '30 days' THEN
    RAISE EXCEPTION 'FAIL: a new draft got last_activity_at % and expires_at %', r.last_activity_at, r.expires_at;
  END IF;
  -- Nor close one itself, on insert or update.
  IF pg_temp.state_of(format('INSERT INTO public.chamber_sessions (user_id, status) VALUES (%L, %L)', guest, 'archived')) <> '42501' THEN
    RAISE EXCEPTION 'FAIL: a client inserted an archived intake';
  END IF;
  IF pg_temp.state_of(format('UPDATE public.chamber_sessions SET status = %L WHERE id = %L', 'expired', sid)) <> '42501'
     OR pg_temp.state_of(format('UPDATE public.chamber_sessions SET status = %L WHERE id = %L', 'archived', sid)) <> '42501'
     OR pg_temp.state_of(format('UPDATE public.chamber_sessions SET status = %L WHERE id = %L', 'revoked', sid)) <> '42501' THEN
    RAISE EXCEPTION 'FAIL: a client closed its own intake without archive_chamber_session';
  END IF;
  RESET ROLE;
  IF (SELECT status FROM public.chamber_sessions WHERE id = sid) <> 'in_progress' THEN RAISE EXCEPTION 'FAIL: the status changed'; END IF;

  -- Idle for 31 days (a privileged write may set it): due a day ago.
  PERFORM pg_temp.idle_since(sid, interval '31 days');
  SELECT * INTO r FROM public.chamber_sessions WHERE id = sid;
  IF r.expires_at > now() - interval '23 hours' OR r.expires_at <> r.last_activity_at + interval '30 days' THEN
    RAISE EXCEPTION 'FAIL: back-dated activity left expires_at %', r.expires_at;
  END IF;
  -- Any save by the prospect is activity, and moves the expiry a full window on.
  SET LOCAL ROLE authenticated;
  n := pg_temp.rows_changed(format('UPDATE public.chamber_sessions SET transcript = %L WHERE id = %L AND data_version = %s', '[{"sender":"user","text":"hi"}]', sid, r.data_version));
  RESET ROLE;
  SELECT * INTO r FROM public.chamber_sessions WHERE id = sid;
  IF n <> 1 OR r.last_activity_at < now() - interval '1 minute' OR r.expires_at < now() + interval '29 days 23 hours' THEN
    RAISE EXCEPTION 'FAIL: a save did not count as activity (% rows, %, %)', n, r.last_activity_at, r.expires_at;
  END IF;
  -- A privileged write may set the expiry directly (an operator extending a draft) and it is kept.
  UPDATE public.chamber_sessions SET expires_at = now() + interval '90 days' WHERE id = sid;
  IF (SELECT expires_at FROM public.chamber_sessions WHERE id = sid) < now() + interval '89 days' THEN
    RAISE EXCEPTION 'FAIL: a privileged expires_at was not kept';
  END IF;
  INSERT INTO fx VALUES ('guest_draft', sid);
  PERFORM pg_temp.signed_out();
  RAISE NOTICE 'intake_lifecycle: activity cases passed';
END $$;

-- ---------- certifying ends the expiry; withdrawing doesn't bring it back ----------
DO $$
DECLARE
  prospect uuid := (SELECT id FROM fx WHERE name = 'prospect');
  sid uuid;
  r public.chamber_sessions;
BEGIN
  PERFORM pg_temp.as_user(prospect);
  sid := pg_temp.new_draft(prospect, 'Cert Co');
  SET LOCAL ROLE authenticated;
  UPDATE public.chamber_sessions
  SET status = 'submitted',
      submission = jsonb_build_object('signer_name', 'Jo Doe', 'signer_title', 'CEO', 'signed_at', '2026-11-01T12:00:00Z',
        'file_id', 'EAA-C', 'consent_version', 'v1', 'consent_text', 'I certify.', 'chamber_data', '{"company_name":"Cert Co"}'::jsonb)
  WHERE id = sid;
  RESET ROLE;
  SELECT * INTO r FROM public.chamber_sessions WHERE id = sid;
  IF r.status <> 'submitted' OR r.expires_at IS NOT NULL THEN RAISE EXCEPTION 'FAIL: a certified intake has status % and expiry %', r.status, r.expires_at; END IF;
  SET LOCAL ROLE authenticated;
  UPDATE public.chamber_sessions SET chamber_data = '{"company_name":"Cert Co, edited"}' WHERE id = sid;
  RESET ROLE;
  SELECT * INTO r FROM public.chamber_sessions WHERE id = sid;
  IF r.status <> 'in_progress' OR r.expires_at IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: a withdrawn certification left status % and expiry %', r.status, r.expires_at;
  END IF;
  INSERT INTO fx VALUES ('withdrawn', sid);
  PERFORM pg_temp.signed_out();
  RAISE NOTICE 'intake_lifecycle: certification cases passed';
END $$;

-- ---------- the expiry job ----------
DO $$
DECLARE
  prospect uuid := (SELECT id FROM fx WHERE name = 'prospect');
  other uuid := (SELECT id FROM fx WHERE name = 'other');
  idle uuid;
  recent uuid;
  idle_other uuid;
  submitted uuid;
  withdrawn uuid := (SELECT id FROM fx WHERE name = 'withdrawn');
  untouched jsonb;
  untouched_withdrawn jsonb;
  due timestamptz;
  moved integer;
  r public.chamber_sessions;
  e public.intake_lifecycle_events;
BEGIN
  idle := pg_temp.new_draft(prospect, 'Idle Co');
  recent := pg_temp.new_draft(prospect, 'Recent Co');
  idle_other := pg_temp.new_draft(other, 'Other Idle Co');
  submitted := pg_temp.new_draft(prospect, 'Submitted Co');
  PERFORM pg_temp.certify(submitted);
  PERFORM pg_temp.idle_since(idle, interval '31 days');
  PERFORM pg_temp.idle_since(recent, interval '29 days');
  PERFORM pg_temp.idle_since(idle_other, interval '400 days');
  -- Certified or once certified, and idle for a year: never expired. The trigger never gives such an intake an
  -- expiry, so the once-certified one gets an overdue expiry with triggers off (a row written some other
  -- way), which the job must still refuse to act on.
  UPDATE public.chamber_sessions SET last_activity_at = now() - interval '365 days' WHERE id IN (submitted, withdrawn);
  PERFORM set_config('session_replication_role', 'replica', true);
  UPDATE public.chamber_sessions SET expires_at = now() - interval '335 days' WHERE id = withdrawn;
  PERFORM set_config('session_replication_role', 'origin', true);
  untouched := pg_temp.snap(submitted);
  untouched_withdrawn := pg_temp.snap(withdrawn);
  due := (SELECT expires_at FROM public.chamber_sessions WHERE id = idle);
  -- Drafts from the earlier blocks are not due; leave them out of the count.

  SET LOCAL ROLE service_role;
  moved := public.expire_idle_intakes();
  RESET ROLE;
  IF moved <> 2 THEN RAISE EXCEPTION 'FAIL: the job moved % intakes, expected 2', moved; END IF;

  SELECT * INTO r FROM public.chamber_sessions WHERE id = idle;
  IF r.status <> 'expired' OR r.expires_at <> due THEN RAISE EXCEPTION 'FAIL: the idle draft is % with expiry % (was due %)', r.status, r.expires_at, due; END IF;
  IF (SELECT status FROM public.chamber_sessions WHERE id = idle_other) <> 'expired' THEN RAISE EXCEPTION 'FAIL: another prospect''s idle draft did not expire'; END IF;
  IF (SELECT status FROM public.chamber_sessions WHERE id = recent) <> 'in_progress' THEN RAISE EXCEPTION 'FAIL: a draft inside its window expired'; END IF;
  IF pg_temp.snap(submitted) IS DISTINCT FROM untouched THEN RAISE EXCEPTION 'FAIL: the job changed a submitted intake'; END IF;
  IF pg_temp.snap(withdrawn) IS DISTINCT FROM untouched_withdrawn THEN RAISE EXCEPTION 'FAIL: the job changed a once-certified intake'; END IF;
  IF EXISTS (SELECT 1 FROM public.chamber_sessions WHERE id IN (SELECT id FROM fx WHERE name IN ('old_certified', 'old_withdrawn')) AND status = 'expired') THEN
    RAISE EXCEPTION 'FAIL: the job expired a certified intake from before the migration';
  END IF;

  -- One audit row per intake it changed, from the system.
  IF (SELECT count(*) FROM public.intake_lifecycle_events WHERE to_status = 'expired') <> 2 THEN
    RAISE EXCEPTION 'FAIL: % expiry events, expected 2', (SELECT count(*) FROM public.intake_lifecycle_events WHERE to_status = 'expired');
  END IF;
  SELECT * INTO e FROM public.intake_lifecycle_events WHERE session_id = idle;
  IF e.user_id <> prospect OR e.from_status <> 'in_progress' OR e.actor_id IS NOT NULL OR e.reason NOT LIKE 'No activity since %' THEN
    RAISE EXCEPTION 'FAIL: the expiry event was %', to_jsonb(e);
  END IF;

  -- A second run finds nothing more to do.
  SET LOCAL ROLE service_role;
  moved := public.expire_idle_intakes();
  RESET ROLE;
  IF moved <> 0 OR (SELECT count(*) FROM public.intake_lifecycle_events WHERE to_status = 'expired') <> 2 THEN
    RAISE EXCEPTION 'FAIL: a second run moved % and logged again', moved;
  END IF;

  -- The batch limit holds, and the rest wait for the next run.
  PERFORM pg_temp.idle_since(pg_temp.new_draft(other, 'Batch ' || i), interval '45 days') FROM generate_series(1, 3) i;
  IF public.expire_idle_intakes(2) <> 2 OR public.expire_idle_intakes(2) <> 1 THEN RAISE EXCEPTION 'FAIL: the batch limit was not kept'; END IF;
  IF pg_temp.state_of('SELECT public.expire_idle_intakes(0)') <> '22023' THEN RAISE EXCEPTION 'FAIL: a zero limit was accepted'; END IF;

  -- Not for prospects.
  PERFORM pg_temp.as_user(prospect);
  SET LOCAL ROLE authenticated;
  IF pg_temp.state_of('SELECT public.expire_idle_intakes()') <> '42501' THEN RAISE EXCEPTION 'FAIL: a prospect ran the expiry job'; END IF;
  RESET ROLE;
  PERFORM pg_temp.signed_out();

  INSERT INTO fx VALUES ('expired', idle), ('recent', recent), ('submitted', submitted);
  RAISE NOTICE 'intake_lifecycle: expiry job cases passed';
END $$;

-- ---------- an expired intake: readable, not changeable, takes no documents ----------
DO $$
DECLARE
  prospect uuid := (SELECT id FROM fx WHERE name = 'prospect');
  sid uuid := (SELECT id FROM fx WHERE name = 'expired');
  before_row jsonb := pg_temp.snap(sid);
  v integer := (SELECT data_version FROM public.chamber_sessions WHERE id = sid);
  n bigint;
BEGIN
  PERFORM pg_temp.as_user(prospect);
  SET LOCAL ROLE authenticated;
  IF (SELECT status FROM public.chamber_sessions WHERE id = sid) IS DISTINCT FROM 'expired' THEN
    RAISE EXCEPTION 'FAIL: the prospect cannot read their expired intake';
  END IF;
  -- A save from the version the tab holds matches nothing (the browser then reads the row back).
  n := pg_temp.rows_changed(format('UPDATE public.chamber_sessions SET chamber_data = %L WHERE id = %L AND data_version = %s', '{"company_name":"Late"}', sid, v));
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: a save to an expired intake matched % rows', n; END IF;
  n := pg_temp.rows_changed(format('UPDATE public.chamber_sessions SET status = %L WHERE id = %L', 'in_progress', sid));
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: the prospect reopened an expired intake'; END IF;
  -- No new documents, in the table or in storage.
  IF pg_temp.state_of(format(
       'INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path) VALUES (%L, %L, %L, %L, %L)',
       prospect, sid, 'late.pdf', '1 KB', prospect || '/' || sid || '/late.pdf')) <> 'EA002' THEN
    RAISE EXCEPTION 'FAIL: a document was added to an expired intake';
  END IF;
  IF pg_temp.state_of(format('INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)', 'documents', prospect || '/' || sid || '/late.pdf')) <> '42501' THEN
    RAISE EXCEPTION 'FAIL: a file was stored under an expired intake';
  END IF;
  -- An open draft still takes both.
  IF pg_temp.state_of(format('INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)', 'documents',
       prospect || '/' || (SELECT id FROM fx WHERE name = 'recent') || '/ok.pdf')) <> 'ok' THEN
    RAISE EXCEPTION 'FAIL: a file could not be stored under an open draft';
  END IF;
  RESET ROLE;
  -- The backstop: even without row security a browser role can't change a closed intake.
  ALTER TABLE public.chamber_sessions DISABLE ROW LEVEL SECURITY;
  SET LOCAL ROLE authenticated;
  IF pg_temp.state_of(format('UPDATE public.chamber_sessions SET chamber_data = %L WHERE id = %L', '{"company_name":"Late"}', sid)) <> 'EA002' THEN
    RAISE EXCEPTION 'FAIL: the trigger let a browser role change an expired intake';
  END IF;
  RESET ROLE;
  ALTER TABLE public.chamber_sessions ENABLE ROW LEVEL SECURITY;
  IF pg_temp.snap(sid) IS DISTINCT FROM before_row THEN RAISE EXCEPTION 'FAIL: the expired intake changed'; END IF;
  PERFORM pg_temp.signed_out();
  RAISE NOTICE 'intake_lifecycle: expired intake cases passed';
END $$;

-- ---------- Start over: the prospect archives a draft ----------
DO $$
DECLARE
  prospect uuid := (SELECT id FROM fx WHERE name = 'prospect');
  other uuid := (SELECT id FROM fx WHERE name = 'other');
  advisor uuid := (SELECT id FROM fx WHERE name = 'advisor');
  sid uuid;
  doc uuid;
  submitted uuid := (SELECT id FROM fx WHERE name = 'submitted');
  withdrawn uuid := (SELECT id FROM fx WHERE name = 'withdrawn');
  expired uuid := (SELECT id FROM fx WHERE name = 'expired');
  kept jsonb;
  result text;
  e public.intake_lifecycle_events;
BEGIN
  sid := pg_temp.new_draft(prospect, 'Start Over Co');
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path)
  VALUES (prospect, sid, 'census.csv', '1 KB', prospect || '/' || sid || '/census.csv') RETURNING id INTO doc;
  INSERT INTO storage.objects (bucket_id, name) VALUES ('documents', prospect || '/' || sid || '/census.csv');

  -- Nobody else can archive it, and they can't tell it exists.
  PERFORM pg_temp.as_user(other);
  SET LOCAL ROLE authenticated;
  IF pg_temp.state_of(format('SELECT public.archive_chamber_session(%L)', sid)) <> 'PT404' THEN RAISE EXCEPTION 'FAIL: another prospect could archive the draft'; END IF;
  RESET ROLE;
  PERFORM pg_temp.signed_out();
  SET LOCAL ROLE authenticated;
  IF pg_temp.state_of(format('SELECT public.archive_chamber_session(%L)', sid)) <> '42501' THEN RAISE EXCEPTION 'FAIL: a signed-out caller was not refused'; END IF;
  RESET ROLE;
  IF (SELECT status FROM public.chamber_sessions WHERE id = sid) <> 'in_progress' THEN RAISE EXCEPTION 'FAIL: the draft changed'; END IF;

  -- Its owner archives it.
  PERFORM pg_temp.as_user(prospect);
  SET LOCAL ROLE authenticated;
  result := public.archive_chamber_session(sid);
  IF result <> 'archived' THEN RAISE EXCEPTION 'FAIL: archiving a draft returned %', result; END IF;
  -- Gone from the Chamber: the row, its documents and its stored file.
  IF EXISTS (SELECT 1 FROM public.chamber_sessions WHERE id = sid) THEN RAISE EXCEPTION 'FAIL: the prospect can still read the archived draft'; END IF;
  IF EXISTS (SELECT 1 FROM public.documents WHERE id = doc) THEN RAISE EXCEPTION 'FAIL: the prospect can still read its documents'; END IF;
  IF EXISTS (SELECT 1 FROM storage.objects WHERE name LIKE '%' || sid || '%') THEN RAISE EXCEPTION 'FAIL: the prospect can still read its stored files'; END IF;
  IF pg_temp.rows_changed(format('UPDATE public.chamber_sessions SET chamber_data = %L WHERE id = %L', '{"company_name":"Back"}', sid)) <> 0 THEN
    RAISE EXCEPTION 'FAIL: the prospect changed an archived draft';
  END IF;
  -- A retry after a lost response reads as done.
  IF pg_temp.state_of(format('SELECT public.archive_chamber_session(%L)', sid)) <> 'PT404' THEN RAISE EXCEPTION 'FAIL: archiving twice did not answer PT404'; END IF;

  -- Certified, once certified, and expired intakes are kept as they are.
  kept := pg_temp.snap(submitted);
  IF public.archive_chamber_session(submitted) <> 'kept' THEN RAISE EXCEPTION 'FAIL: a submitted intake was not kept'; END IF;
  IF public.archive_chamber_session(withdrawn) <> 'kept' THEN RAISE EXCEPTION 'FAIL: a once-certified intake was not kept'; END IF;
  IF public.archive_chamber_session(expired) <> 'kept' THEN RAISE EXCEPTION 'FAIL: an expired intake was not kept'; END IF;
  RESET ROLE;
  IF pg_temp.snap(submitted) IS DISTINCT FROM kept THEN RAISE EXCEPTION 'FAIL: archiving changed a submitted intake'; END IF;
  IF (SELECT status FROM public.chamber_sessions WHERE id = withdrawn) <> 'in_progress' OR (SELECT status FROM public.chamber_sessions WHERE id = expired) <> 'expired' THEN
    RAISE EXCEPTION 'FAIL: archiving changed a kept intake';
  END IF;

  -- One audit row, naming the prospect.
  SELECT * INTO e FROM public.intake_lifecycle_events WHERE session_id = sid;
  IF e.to_status <> 'archived' OR e.from_status <> 'in_progress' OR e.actor_id <> prospect OR e.actor_email <> prospect || '@example.test'
     OR (SELECT count(*) FROM public.intake_lifecycle_events WHERE session_id IN (sid, submitted, withdrawn, expired) AND to_status = 'archived') <> 1 THEN
    RAISE EXCEPTION 'FAIL: the archive event was %', to_jsonb(e);
  END IF;

  -- Advisors still see it, and the expiry job leaves it alone.
  PERFORM pg_temp.as_user(advisor);
  SET LOCAL ROLE authenticated;
  IF (SELECT status FROM public.chamber_sessions WHERE id = sid) IS DISTINCT FROM 'archived' THEN RAISE EXCEPTION 'FAIL: an advisor cannot see the archived draft'; END IF;
  RESET ROLE;
  PERFORM pg_temp.idle_since(sid, interval '400 days');
  PERFORM public.expire_idle_intakes();
  IF (SELECT status FROM public.chamber_sessions WHERE id = sid) <> 'archived' THEN RAISE EXCEPTION 'FAIL: the job changed an archived draft'; END IF;
  PERFORM pg_temp.signed_out();
  INSERT INTO fx VALUES ('archived', sid);
  RAISE NOTICE 'intake_lifecycle: archive cases passed';
END $$;

-- ---------- revocation ----------
DO $$
DECLARE
  prospect uuid := (SELECT id FROM fx WHERE name = 'prospect');
  advisor uuid := (SELECT id FROM fx WHERE name = 'advisor');
  admin uuid := (SELECT id FROM fx WHERE name = 'admin');
  sid uuid;
  doc uuid;
  submitted uuid := (SELECT id FROM fx WHERE name = 'submitted');
  expired uuid := (SELECT id FROM fx WHERE name = 'expired');
  e public.intake_lifecycle_events;
BEGIN
  sid := pg_temp.new_draft(prospect, 'Revoked Co');
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path)
  VALUES (prospect, sid, 'payroll.pdf', '1 KB', prospect || '/' || sid || '/payroll.pdf') RETURNING id INTO doc;

  -- Prospects and advisors can't revoke.
  PERFORM pg_temp.as_user(prospect);
  SET LOCAL ROLE authenticated;
  IF pg_temp.state_of(format('SELECT public.revoke_chamber_session(%L, %L)', sid, 'mine')) <> '42501' THEN RAISE EXCEPTION 'FAIL: a prospect revoked an intake'; END IF;
  RESET ROLE;
  PERFORM pg_temp.as_user(advisor);
  SET LOCAL ROLE authenticated;
  IF pg_temp.state_of(format('SELECT public.revoke_chamber_session(%L, %L)', sid, 'advisor')) <> '42501' THEN RAISE EXCEPTION 'FAIL: an advisor revoked an intake'; END IF;
  RESET ROLE;

  PERFORM pg_temp.as_user(admin);
  SET LOCAL ROLE authenticated;
  IF pg_temp.state_of(format('SELECT public.revoke_chamber_session(%L, %L)', sid, '   ')) <> '22023' THEN RAISE EXCEPTION 'FAIL: a blank reason was accepted'; END IF;
  IF pg_temp.state_of(format('SELECT public.revoke_chamber_session(%L, %L)', gen_random_uuid(), 'gone')) <> 'PT404' THEN RAISE EXCEPTION 'FAIL: an unknown intake was not PT404'; END IF;
  IF pg_temp.state_of(format('SELECT public.revoke_chamber_session(%L, %L)', submitted, 'no')) <> '55000' THEN RAISE EXCEPTION 'FAIL: a submitted intake was revoked'; END IF;
  IF public.revoke_chamber_session(sid, '  Link shared by mistake  ') <> 'revoked' THEN RAISE EXCEPTION 'FAIL: revoking a draft did not answer revoked'; END IF;
  IF public.revoke_chamber_session(sid, 'again') <> 'revoked' THEN RAISE EXCEPTION 'FAIL: revoking again did not answer revoked'; END IF;
  IF public.revoke_chamber_session(expired, 'Expired and reported') <> 'revoked' THEN RAISE EXCEPTION 'FAIL: an expired draft could not be revoked'; END IF;
  RESET ROLE;
  IF (SELECT status FROM public.chamber_sessions WHERE id = submitted) <> 'submitted' THEN RAISE EXCEPTION 'FAIL: the submitted intake changed'; END IF;

  SELECT * INTO e FROM public.intake_lifecycle_events WHERE session_id = sid;
  IF (SELECT count(*) FROM public.intake_lifecycle_events WHERE session_id = sid) <> 1 OR e.to_status <> 'revoked'
     OR e.reason <> 'Link shared by mistake' OR e.actor_id <> admin THEN
    RAISE EXCEPTION 'FAIL: revocation events were %', (SELECT jsonb_agg(to_jsonb(x)) FROM public.intake_lifecycle_events x WHERE session_id = sid);
  END IF;

  -- The prospect loses all access: row, documents, changes, and archiving it.
  PERFORM pg_temp.as_user(prospect);
  SET LOCAL ROLE authenticated;
  IF EXISTS (SELECT 1 FROM public.chamber_sessions WHERE id IN (sid, expired)) THEN RAISE EXCEPTION 'FAIL: the prospect can read a revoked intake'; END IF;
  IF EXISTS (SELECT 1 FROM public.documents WHERE id = doc) THEN RAISE EXCEPTION 'FAIL: the prospect can read a revoked intake''s documents'; END IF;
  IF pg_temp.rows_changed(format('UPDATE public.chamber_sessions SET chamber_data = %L WHERE id = %L', '{"company_name":"Back"}', sid)) <> 0 THEN
    RAISE EXCEPTION 'FAIL: the prospect changed a revoked intake';
  END IF;
  IF pg_temp.state_of(format('SELECT public.archive_chamber_session(%L)', sid)) <> 'PT404' THEN RAISE EXCEPTION 'FAIL: a revoked intake could be archived'; END IF;
  RESET ROLE;
  PERFORM pg_temp.signed_out();
  RAISE NOTICE 'intake_lifecycle: revocation cases passed';
END $$;

-- ---------- the audit trail ----------
DO $$
DECLARE
  prospect uuid := (SELECT id FROM fx WHERE name = 'prospect');
  advisor uuid := (SELECT id FROM fx WHERE name = 'advisor');
BEGIN
  IF pg_temp.state_of('UPDATE public.intake_lifecycle_events SET reason = ''edited''') <> '42501'
     OR pg_temp.state_of('DELETE FROM public.intake_lifecycle_events') <> '42501' THEN
    RAISE EXCEPTION 'FAIL: lifecycle events can be changed or deleted';
  END IF;
  PERFORM pg_temp.as_user(prospect);
  SET LOCAL ROLE authenticated;
  IF EXISTS (SELECT 1 FROM public.intake_lifecycle_events) THEN RAISE EXCEPTION 'FAIL: a prospect can read lifecycle events'; END IF;
  IF pg_temp.state_of(format('INSERT INTO public.intake_lifecycle_events (session_id, user_id, from_status, to_status) VALUES (%L, %L, %L, %L)',
       gen_random_uuid(), prospect, 'in_progress', 'archived')) <> '42501' THEN
    RAISE EXCEPTION 'FAIL: a prospect wrote a lifecycle event';
  END IF;
  RESET ROLE;
  PERFORM pg_temp.as_user(advisor);
  SET LOCAL ROLE authenticated;
  IF (SELECT count(*) FROM public.intake_lifecycle_events) < 5 THEN RAISE EXCEPTION 'FAIL: an advisor cannot read lifecycle events'; END IF;
  RESET ROLE;
  PERFORM pg_temp.signed_out();
  RAISE NOTICE 'intake_lifecycle: audit cases passed';
END $$;

-- ---------- with pg_cron: scheduled once, hourly, never over an existing job ----------
CREATE SCHEMA cron;
CREATE TABLE cron.job (jobid serial PRIMARY KEY, jobname text UNIQUE, schedule text NOT NULL, command text NOT NULL);
CREATE FUNCTION cron.schedule(job_name text, schedule text, command text) RETURNS bigint LANGUAGE sql AS $$
  INSERT INTO cron.job (jobname, schedule, command) VALUES (job_name, schedule, command)
  ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command
  RETURNING jobid::bigint
$$;
\i supabase/migrations/20261103090000_intake_lifecycle.sql
\i supabase/migrations/20261103090000_intake_lifecycle.sql
SET client_min_messages = notice;
DO $$
DECLARE
  job cron.job;
BEGIN
  IF (SELECT count(*) FROM cron.job) <> 1 THEN RAISE EXCEPTION 'FAIL: expected one job, found %', (SELECT count(*) FROM cron.job); END IF;
  SELECT * INTO job FROM cron.job WHERE jobname = 'expire-idle-intakes';
  IF job.schedule <> '17 * * * *' OR job.command <> 'select public.expire_idle_intakes();' THEN
    RAISE EXCEPTION 'FAIL: the job is % %', job.schedule, job.command;
  END IF;
  -- Applying the migration again changed nothing it had already set up.
  IF (SELECT count(*) FROM public.chamber_sessions WHERE last_activity_at IS NULL) <> 0 THEN RAISE EXCEPTION 'FAIL: a row lost its activity time'; END IF;
  RAISE NOTICE 'intake_lifecycle: schedule cases passed';
  RAISE NOTICE 'intake_lifecycle: all cases passed';
END $$;
