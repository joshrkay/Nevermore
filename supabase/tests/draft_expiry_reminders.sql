-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh draft_expiry_reminders
-- The reminder before an idle draft closes (20261105091000_draft_expiry_reminders.sql): queued once per closing time
-- for a draft inside the week before it closes, whose owner has a verified email and asked for reminders, and which
-- holds something the prospect did; never for a guest, an owner who didn't ask, an empty draft, a certified intake, a
-- closed one or one further off; the server stamps when the owner asked, and clearing it stops them; a draft that
-- changes and goes idle again gets one for its new closing time; one already queued is cancelled, not sent, once
-- its owner stops reminders or the draft no longer closes when it says; suppression holds it back; only the service
-- role may queue them.
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
\i supabase/migrations/20261104121000_voice_failed_ops_kind.sql
\i supabase/migrations/20261104122000_pipeline_transitions.sql
\i supabase/migrations/20261104130000_document_scanning.sql
\i supabase/migrations/20261104131000_certification_file_id_check.sql
\i supabase/migrations/20261104132000_needs_advisor_action.sql
\i supabase/migrations/20261104133000_queue_hides_empty_guest_drafts.sql
\i supabase/migrations/20261105090000_information_requests.sql
\i supabase/migrations/20261105091000_draft_expiry_reminders.sql
SET client_min_messages = notice;

CREATE FUNCTION pg_temp.as_user(uid uuid, guest boolean DEFAULT false) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', uid, 'is_anonymous', guest, 'role', 'authenticated', 'email', CASE WHEN guest THEN '' ELSE uid || '@example.test' END)::text, false);
END $$;

-- A new prospect (a guest when told so) with one draft holding `data`, idle for `idle`, who asked for reminders unless
-- told not to (as their own profile update). Returns the draft.
CREATE FUNCTION pg_temp.draft(data jsonb, idle interval, guest boolean DEFAULT false, remind boolean DEFAULT true) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  uid uuid := gen_random_uuid();
  sid uuid;
BEGIN
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', CASE WHEN guest THEN NULL ELSE uid || '@example.test' END, guest, now(), now());
  UPDATE public.profiles SET contact_name = 'Jo Doe' WHERE user_id = uid;
  PERFORM pg_temp.as_user(uid, guest);
  SET LOCAL ROLE authenticated;
  PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, data) RETURNING id INTO sid;
  IF remind THEN
    UPDATE public.profiles SET draft_reminders_at = '2020-01-01T00:00:00Z' WHERE user_id = uid;
  END IF;
  RESET ROLE;
  UPDATE public.chamber_sessions SET last_activity_at = now() - idle WHERE id = sid;
  RETURN sid;
END $$;

CREATE FUNCTION pg_temp.queue() RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role', 'service_role')::text, false);
  SET LOCAL ROLE service_role;
  n := public.queue_draft_expiry_reminders();
  RESET ROLE;
  RETURN n;
END $$;

DO $$
DECLARE
  answers constant jsonb := '{"company_name":"Acme Co","pay_frequency":"weekly"}';
  due uuid := pg_temp.draft(answers, interval '25 days');
  guest uuid := pg_temp.draft(answers, interval '25 days', true);
  later uuid := pg_temp.draft(answers, interval '10 days');
  empty uuid := pg_temp.draft('{}', interval '25 days');
  gone uuid := pg_temp.draft(answers, interval '31 days');
  certified uuid := pg_temp.draft('{"company_name":"Acme Co","states":["NY"],"pay_frequency":"weekly"}', interval '1 day');
  unasked uuid := pg_temp.draft(answers, interval '25 days', false, false);
  owner uuid := (SELECT user_id FROM public.chamber_sessions WHERE id = due);
  e public.outbox_events;
  expires timestamptz;
  n integer;
BEGIN
  -- The time an owner asked is the server's, not what their browser said.
  IF (SELECT draft_reminders_at FROM public.profiles WHERE user_id = owner) < now() - interval '1 minute' THEN
    RAISE EXCEPTION 'FAIL: a browser back-dated when it asked for reminders';
  END IF;
  -- The certified intake: certify it, then let its activity age as the others did. It has no closing time.
  PERFORM pg_temp.as_user((SELECT user_id FROM public.chamber_sessions WHERE id = certified));
  SET LOCAL ROLE authenticated;
  UPDATE public.chamber_sessions SET status = 'submitted', submission = jsonb_build_object(
    'signer_name', 'Jo Doe', 'signer_title', 'CEO', 'signed_at', '2026-11-04T12:00:00Z',
    'consent_version', '2026-10-draft-1', 'consent_text', '["I certify."]'::jsonb,
    'chamber_data', '{"company_name":"Acme Co","states":["NY"],"pay_frequency":"weekly"}'::jsonb)
  WHERE id = certified;
  RESET ROLE;
  -- The one past its closing time is expired by the hourly job, as it would be.
  PERFORM set_config('request.jwt.claims', '', false);
  IF public.expire_idle_intakes() <> 1 THEN RAISE EXCEPTION 'setup: expected one draft to expire'; END IF;

  -- ---------- Only the draft that is due, of a verified owner, holding something ----------
  n := pg_temp.queue();
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: queued % reminders, expected 1', n; END IF;
  SELECT * INTO e FROM public.outbox_events WHERE kind = 'draft_expiry_reminder';
  SELECT s.expires_at INTO expires FROM public.chamber_sessions s WHERE s.id = due;
  IF e.session_id <> due OR e.status <> 'pending'
     OR e.dedupe_key <> due || ':' || to_char(expires AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
     OR e.payload ->> 'recipient_email' <> owner || '@example.test'
     OR e.payload ->> 'recipient_name' <> 'Jo Doe'
     OR e.payload ->> 'company_name' <> 'Acme Co'
     OR e.payload ->> 'expires_at' <> to_char(expires AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') THEN
    RAISE EXCEPTION 'FAIL: the reminder was %', e;
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(e.payload) k WHERE k NOT IN ('company_name', 'recipient_name', 'recipient_email', 'expires_at')) THEN
    RAISE EXCEPTION 'FAIL: the reminder carries more than it should: %', e.payload;
  END IF;

  -- ---------- Never twice for the same closing time ----------
  IF pg_temp.queue() <> 0 THEN RAISE EXCEPTION 'FAIL: a second run queued another reminder'; END IF;

  -- ---------- A change moves the closing time; idle again, the draft gets a reminder for the new one ----------
  UPDATE public.chamber_sessions SET last_activity_at = now() - interval '24 days' WHERE id = due;
  n := pg_temp.queue();
  IF n <> 1 OR (SELECT count(*) FROM public.outbox_events WHERE kind = 'draft_expiry_reminder' AND session_id = due) <> 2 THEN
    RAISE EXCEPTION 'FAIL: a draft idle again wasn''t reminded of its new closing time';
  END IF;

  -- ---------- Clearing it stops them ----------
  PERFORM pg_temp.as_user(owner);
  SET LOCAL ROLE authenticated;
  UPDATE public.profiles SET draft_reminders_at = NULL WHERE user_id = owner;
  RESET ROLE;
  UPDATE public.chamber_sessions SET last_activity_at = now() - interval '23 days' WHERE id = due;
  n := pg_temp.queue();
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: an owner who stopped reminders got another'; END IF;

  -- ---------- Suppression holds it back ----------
  INSERT INTO public.email_suppressions (address, reason) VALUES (lower(owner || '@example.test'), 'bounced');
  IF (SELECT count(*) FROM public.claim_outbox_events(ARRAY['draft_expiry_reminder'], 10, 5, 600)) <> 0 THEN
    RAISE EXCEPTION 'FAIL: a reminder to a suppressed address was claimed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.outbox_events WHERE kind = 'draft_expiry_reminder' AND status <> 'suppressed') THEN
    RAISE EXCEPTION 'FAIL: a reminder to a suppressed address wasn''t held back';
  END IF;

  -- ---------- Who may queue them ----------
  BEGIN
    PERFORM public.queue_draft_expiry_reminders(0);
    RAISE EXCEPTION 'FAIL: a limit of 0 was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  PERFORM pg_temp.as_user(owner);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.queue_draft_expiry_reminders();
    RAISE EXCEPTION 'FAIL: a prospect could queue reminders';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;

  -- The other drafts: nothing.
  IF EXISTS (SELECT 1 FROM public.outbox_events WHERE kind = 'draft_expiry_reminder' AND session_id IN (guest, later, empty, gone, certified, unasked)) THEN
    RAISE EXCEPTION 'FAIL: a reminder was queued for a draft that isn''t due';
  END IF;

  -- ---------- A queued reminder whose reason has gone is cancelled, not sent ----------
  DECLARE
    stopping uuid := pg_temp.draft(answers, interval '25 days');
    editing uuid := pg_temp.draft(answers, interval '25 days');
    stopper uuid := (SELECT user_id FROM public.chamber_sessions WHERE id = stopping);
  BEGIN
    n := pg_temp.queue();
    IF n <> 2 THEN RAISE EXCEPTION 'FAIL: expected two new reminders, queued %', n; END IF;
    -- One owner stops reminders; the other draft changes, so it no longer closes when its reminder says.
    PERFORM pg_temp.as_user(stopper);
    SET LOCAL ROLE authenticated;
    UPDATE public.profiles SET draft_reminders_at = NULL WHERE user_id = stopper;
    RESET ROLE;
    UPDATE public.chamber_sessions SET last_activity_at = now() WHERE id = editing;
    IF (SELECT count(*) FROM public.claim_outbox_events(ARRAY['draft_expiry_reminder'], 10, 5, 600)) <> 0 THEN
      RAISE EXCEPTION 'FAIL: a reminder whose reason had gone was claimed';
    END IF;
    IF (SELECT last_error FROM public.outbox_events WHERE kind = 'draft_expiry_reminder' AND session_id = stopping AND status = 'suppressed')
       IS DISTINCT FROM 'cancelled: reminders turned off' THEN
      RAISE EXCEPTION 'FAIL: a reminder its owner stopped wasn''t cancelled as such';
    END IF;
    IF (SELECT last_error FROM public.outbox_events WHERE kind = 'draft_expiry_reminder' AND session_id = editing AND status = 'suppressed')
       IS DISTINCT FROM 'cancelled: the draft changed' THEN
      RAISE EXCEPTION 'FAIL: a reminder for a draft that changed wasn''t cancelled as such';
    END IF;
  END;
  -- A reminder that still holds is claimed as before.
  DECLARE
    holding uuid := pg_temp.draft(answers, interval '25 days');
  BEGIN
    IF pg_temp.queue() <> 1 THEN RAISE EXCEPTION 'FAIL: the reminder that holds wasn''t queued'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.claim_outbox_events(ARRAY['draft_expiry_reminder'], 10, 5, 600) c WHERE c.session_id = holding) THEN
      RAISE EXCEPTION 'FAIL: a reminder that still holds wasn''t claimed';
    END IF;
  END;

  RAISE NOTICE 'draft_expiry_reminders: all cases passed';
END $$;
