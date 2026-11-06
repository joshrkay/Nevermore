-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh hardening
-- The hardening pass (20261106090000_hardening.sql), each check as the real API role:
-- * S-1: the prospect can't write `submission` except by certifying; the queue's File ID and signer come from
--   the database's own records; a certification records the provenance the row holds.
-- * S-2: a prospect can't pile up document rows with no stored file, and a row whose file never arrived is
--   removed once the upload window has passed instead of being retried into a scan_failed alert.
-- * S-3: size caps on what a prospect can write, generous enough for the largest real intake; the queue
--   clips what it lists.
-- * S-6: a lapsed outbox claim is cancelled like a pending one when reminders are off or the address is suppressed.
-- * S-8: an intake's id and created_at are the server's.
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
\i supabase/migrations/20261105092000_intake_milestones.sql
\i supabase/migrations/20261106090000_hardening.sql
SET client_min_messages = warning;

-- ---------- helpers ----------
-- Every check is recorded, so one run reports all of them; the file fails at the end if any did.
CREATE TEMP TABLE results (n serial, label text, ok boolean, detail text);
CREATE FUNCTION pg_temp.check(ok boolean, label text, detail text DEFAULT NULL) RETURNS void LANGUAGE sql AS
  $$ INSERT INTO results (label, ok, detail) VALUES (label, COALESCE(ok, false), detail) $$;

CREATE FUNCTION pg_temp.as_user(uid uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE guest boolean := (SELECT is_anonymous FROM auth.users WHERE id = uid);
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', uid, 'is_anonymous', guest, 'role', 'authenticated',
                       'email', CASE WHEN guest THEN NULL ELSE uid || '@example.test' END)::text, false);
END $$;

-- A new account (a guest unless told otherwise) that has agreed to the intake consent.
CREATE FUNCTION pg_temp.new_user(guest boolean DEFAULT true) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', CASE WHEN guest THEN NULL ELSE uid || '@example.test' END, guest, now(), now());
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');
  RESET ROLE;
  RETURN uid;
END $$;

-- What a statement does as the signed-in user: 'ok', or the SQLSTATE and message it was refused with.
CREATE FUNCTION pg_temp.try_as(uid uuid, stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE s text; m text;
BEGIN
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  BEGIN
    EXECUTE stmt;
    RESET ROLE;
    RETURN 'ok';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT;
    RESET ROLE;
    RETURN s || ' ' || m;
  END;
END $$;

CREATE FUNCTION pg_temp.as_advisor() RETURNS void LANGUAGE plpgsql AS $$
DECLARE uid uuid := (SELECT user_id FROM public.user_roles WHERE role = 'advisor' LIMIT 1);
BEGIN
  IF uid IS NULL THEN
    uid := gen_random_uuid();
    INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at)
    VALUES (uid, 'authenticated', 'authenticated', 'adv-' || uid || '@example.test', false, now(), now());
    INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'advisor');
  END IF;
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', uid, 'is_anonymous', false, 'role', 'authenticated', 'email', 'adv@example.test')::text, false);
END $$;

-- ---------- S-1: submission is written only by certifying ----------
DO $$
DECLARE
  victim uuid := pg_temp.new_user(false);
  attacker uuid := pg_temp.new_user(true);
  victim_sid uuid;
  victim_file text;
  forged_sid uuid;
  got jsonb;
  signed jsonb;
  listed int;
  rows_shown jsonb;
  d constant jsonb := '{"company_name":"Real Victim Co","states":["CA"],"pay_frequency":"biweekly","employee_count":50}';
BEGIN
  -- The victim certifies; the database gives the intake a File ID.
  PERFORM pg_temp.as_user(victim);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.chamber_sessions (user_id, chamber_data, field_provenance, status, submission)
  VALUES (victim, d, '{"company_name":{"status":"confirmed"}}', 'submitted',
          jsonb_build_object('signer_name', 'Vera Victim', 'signer_title', 'CFO', 'consent_text', 'I certify',
                             'consent_version', 'v1', 'signed_at', now(), 'chamber_data', d,
                             'field_provenance', '{"company_name":{"status":"forged by the browser"}}'::jsonb))
  RETURNING id, file_id INTO victim_sid, victim_file;
  RESET ROLE;
  SELECT submission -> 'field_provenance' INTO got FROM public.chamber_sessions WHERE id = victim_sid;
  PERFORM pg_temp.check(got = '{"company_name":{"status":"confirmed"}}', 'S-1 a certification records the provenance the row holds, not the browser''s copy', got::text);

  -- A guest's draft can't carry a submission of its own making.
  PERFORM pg_temp.as_user(attacker);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.chamber_sessions (user_id, chamber_data, submission)
  VALUES (attacker, '{"company_name":"Attacker LLC"}', jsonb_build_object('file_id', victim_file, 'signer_name', 'Vera Victim'))
  RETURNING id INTO forged_sid;
  RESET ROLE;
  SELECT submission INTO got FROM public.chamber_sessions WHERE id = forged_sid;
  PERFORM pg_temp.check(got IS NULL, 'S-1 a draft inserted with a submission keeps none', got::text);
  PERFORM pg_temp.check(pg_temp.try_as(attacker, format($q$UPDATE public.chamber_sessions SET submission = '{"file_id":"%s","signer_name":"Vera Victim"}' WHERE id = '%s'$q$, victim_file, forged_sid)) = 'ok',
    'S-1 (control) the draft''s own update runs');
  SELECT submission INTO got FROM public.chamber_sessions WHERE id = forged_sid;
  PERFORM pg_temp.check(got IS NULL, 'S-1 a draft updated with a submission keeps none', got::text);

  -- Withdrawn by an answer change, then rewritten: the record of what was signed stands.
  SELECT submission INTO signed FROM public.chamber_sessions WHERE id = victim_sid;
  PERFORM pg_temp.check(pg_temp.try_as(victim, format($q$UPDATE public.chamber_sessions SET chamber_data = chamber_data || '{"employee_count":55}' WHERE id = '%s'$q$, victim_sid)) = 'ok',
    'S-1 (control) an answer change after certifying is saved');
  PERFORM pg_temp.check((SELECT status FROM public.chamber_sessions WHERE id = victim_sid) = 'in_progress', 'S-1 (control) the answer change withdrew the certification');
  PERFORM pg_temp.check(pg_temp.try_as(victim, format($q$UPDATE public.chamber_sessions SET submission = submission || '{"signer_name":"Somebody Else","certified_at":"2025-11-01T00:00:00Z","chamber_data":{"employee_count":500}}' WHERE id = '%s'$q$, victim_sid)) = 'ok',
    'S-1 (control) the rewrite runs without error');
  SELECT submission INTO got FROM public.chamber_sessions WHERE id = victim_sid;
  PERFORM pg_temp.check(got = signed, 'S-1 a withdrawn certification''s submission can''t be rewritten', got ->> 'signer_name');

  -- Data written before the fix: the queue doesn't take a File ID or signer from submission.
  UPDATE public.chamber_sessions SET submission = jsonb_build_object('file_id', victim_file, 'signer_name', 'Vera Victim')
  WHERE id = forged_sid;
  PERFORM pg_temp.as_advisor();
  SET LOCAL ROLE authenticated;
  SELECT count(*), jsonb_agg(jsonb_build_object('company', q.company_name, 'file_id', q.file_id, 'signer', q.signer_name))
    INTO listed, rows_shown FROM public.advisor_list_submissions(p_search => victim_file) q;
  RESET ROLE;
  PERFORM pg_temp.check(listed = 1, 'S-1 searching the queue for a File ID finds only the intake that holds it', rows_shown::text);
  PERFORM pg_temp.as_advisor();
  SET LOCAL ROLE authenticated;
  SELECT jsonb_agg(jsonb_build_object('file_id', q.file_id, 'signer', q.signer_name)) INTO rows_shown
    FROM public.advisor_list_submissions(p_search => 'Attacker') q;
  RESET ROLE;
  PERFORM pg_temp.check(rows_shown -> 0 ->> 'file_id' IS NULL AND rows_shown -> 0 ->> 'signer' IS NULL,
    'S-1 a never-certified intake shows no File ID or signer in the queue', rows_shown::text);
  PERFORM pg_temp.as_advisor();
  SET LOCAL ROLE authenticated;
  SELECT jsonb_agg(jsonb_build_object('file_id', q.file_id, 'signer', q.signer_name)) INTO rows_shown
    FROM public.advisor_list_submissions(p_search => 'Real Victim') q;
  RESET ROLE;
  PERFORM pg_temp.check(rows_shown -> 0 ->> 'file_id' = victim_file AND rows_shown -> 0 ->> 'signer' = 'Vera Victim',
    'S-1 (control) a withdrawn certification still shows its File ID and the signer on record', rows_shown::text);
END $$;

-- ---------- S-2: document rows with no stored file ----------
DO $$
DECLARE
  guest uuid := pg_temp.new_user(true);
  first_sid uuid;
  second_sid uuid;
  r text;
  old_doc uuid;
  young_doc uuid;
  stored_doc uuid;
  events_before bigint;
BEGIN
  PERFORM pg_temp.as_user(guest);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (guest, '{"company_name":"Flood One"}') RETURNING id INTO first_sid;
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, category)
  SELECT guest, first_sid, 'f' || g || '.pdf', '1 KB', guest || '/' || first_sid || '/f' || g || '.pdf', 'other' FROM generate_series(1, 25) g;
  PERFORM public.archive_chamber_session(first_sid);
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (guest, '{"company_name":"Flood Two"}') RETURNING id INTO second_sid;
  RESET ROLE;
  r := pg_temp.try_as(guest, format($q$INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, category) VALUES ('%s', '%s', 'g.pdf', '1 KB', '%s/%s/g.pdf', 'other')$q$, guest, second_sid, guest, second_sid));
  PERFORM pg_temp.check(r LIKE '23514%', 'S-2 a prospect holding 25 documents with no stored file can''t add another, on any intake', r);

  -- A file that arrived lets the next one in: the cap counts only rows whose file never came.
  INSERT INTO storage.objects (bucket_id, name, owner) SELECT 'quarantine', storage_path, guest FROM public.documents WHERE session_id = first_sid LIMIT 1;
  r := pg_temp.try_as(guest, format($q$INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, category) VALUES ('%s', '%s', 'h.pdf', '1 KB', '%s/%s/h.pdf', 'other')$q$, guest, second_sid, guest, second_sid));
  PERFORM pg_temp.check(r = 'ok', 'S-2 (control) once a file is stored the prospect can upload again', r);

  -- The scanner: a row whose file never arrived and whose upload window has passed is removed, with no alert.
  SELECT id INTO old_doc FROM public.documents d WHERE d.session_id = first_sid
    AND NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.name = d.storage_path) LIMIT 1;
  UPDATE public.documents SET created_at = now() - interval '2 hours', scan_attempts = public.document_scan_max_attempts() WHERE id = old_doc;
  SELECT count(*) INTO events_before FROM public.ops_events WHERE kind = 'scan_failed';
  SET LOCAL ROLE service_role;
  r := public.fail_document_scan(old_doc, 'file_missing', 300);
  RESET ROLE;
  PERFORM pg_temp.check(r = 'gone' AND NOT EXISTS (SELECT 1 FROM public.documents WHERE id = old_doc),
    'S-2 a document whose file never arrived is removed once the upload window has passed', r);
  PERFORM pg_temp.check((SELECT count(*) FROM public.ops_events WHERE kind = 'scan_failed') = events_before,
    'S-2 removing it raises no scan_failed alert');

  -- An upload still in flight (its row is minutes old) is left to finish.
  SELECT id INTO young_doc FROM public.documents d WHERE d.session_id = second_sid LIMIT 1;
  SET LOCAL ROLE service_role;
  r := public.fail_document_scan(young_doc, 'file_missing', 300);
  RESET ROLE;
  PERFORM pg_temp.check(r = 'retrying' AND EXISTS (SELECT 1 FROM public.documents WHERE id = young_doc),
    'S-2 (control) a document whose upload may still be running is retried, not removed', r);

  -- A stored file that can't be scanned still fails and alerts, as before.
  SELECT d.id INTO stored_doc FROM public.documents d JOIN storage.objects o ON o.name = d.storage_path WHERE d.session_id = first_sid LIMIT 1;
  UPDATE public.documents SET created_at = now() - interval '2 hours', scan_attempts = public.document_scan_max_attempts() WHERE id = stored_doc;
  SET LOCAL ROLE service_role;
  r := public.fail_document_scan(stored_doc, 'storage_download:500', 300);
  RESET ROLE;
  PERFORM pg_temp.check(r = 'failed' AND (SELECT count(*) FROM public.ops_events WHERE kind = 'scan_failed') = events_before + 1,
    'S-2 (control) a stored file that can''t be scanned still fails with an alert', r);
END $$;

-- ---------- S-3: size caps ----------
DO $$
DECLARE
  p uuid := pg_temp.new_user(false);
  sid uuid;
  r text;
  signup uuid := gen_random_uuid();
  heavy jsonb;
  doc uuid;
  listed jsonb;
BEGIN
  -- Profiles
  PERFORM pg_temp.check(pg_temp.try_as(p, format($q$UPDATE public.profiles SET company_name = '%s' WHERE user_id = '%s'$q$, repeat('c', 200), p)) = 'ok',
    'S-3 (control) a 200-character company name is kept');
  r := pg_temp.try_as(p, format($q$UPDATE public.profiles SET company_name = '%s' WHERE user_id = '%s'$q$, repeat('c', 201), p));
  PERFORM pg_temp.check(r LIKE '23514%', 'S-3 a company name over 200 characters is refused', r);
  r := pg_temp.try_as(p, format($q$UPDATE public.profiles SET contact_name = '%s' WHERE user_id = '%s'$q$, repeat('c', 201), p));
  PERFORM pg_temp.check(r LIKE '23514%', 'S-3 a contact name over 200 characters is refused', r);
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, raw_user_meta_data, created_at, updated_at)
  VALUES (signup, 'authenticated', 'authenticated', 'long@example.test', false, jsonb_build_object('company_name', repeat('n', 500)), now(), now());
  PERFORM pg_temp.check((SELECT char_length(company_name) FROM public.profiles WHERE user_id = signup) = 200,
    'S-3 a sign-up''s company name is clipped to 200 characters, not refused');

  -- The intake: a heavy real census is kept; what no intake needs is refused.
  SELECT jsonb_build_object('company_name', 'Heavy Co', 'census', jsonb_agg(jsonb_build_object(
      'id', 'e' || g, 'first_name', 'Firstname' || g, 'last_name', 'Lastname-Hyphenated-' || g, 'dob', '1980-01-01',
      'job_title', 'Senior Operations Coordinator, Northeast Region', 'work_state', 'CA', 'zip_code', '94107',
      'annual_salary', 123456, 'compensation_type', 'salary')))
    INTO heavy FROM generate_series(1, 5000) g;
  PERFORM pg_temp.as_user(p);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (p, heavy) RETURNING id INTO sid;
  RESET ROLE;
  PERFORM pg_temp.check(sid IS NOT NULL, 'S-3 (control) a 5,000-employee census is saved');

  r := pg_temp.try_as(p, format($q$UPDATE public.chamber_sessions SET field_provenance = jsonb_build_object('company_name', jsonb_build_object('status', 'confirmed', 'pad', repeat('x', 1100000))) WHERE id = '%s'$q$, sid));
  PERFORM pg_temp.check(r LIKE '23514%', 'S-3 provenance over 1 MB is refused', left(r, 200));
  r := pg_temp.try_as(p, format($q$UPDATE public.chamber_sessions SET transcript = (SELECT jsonb_agg(jsonb_build_object('id', 'm' || g, 'sender', 'user', 'text', 'hi')) FROM generate_series(1, 2001) g) WHERE id = '%s'$q$, sid));
  PERFORM pg_temp.check(r LIKE '23514%', 'S-3 a conversation of more than 2,000 messages is refused', left(r, 200));
  r := pg_temp.try_as(p, format($q$UPDATE public.chamber_sessions SET transcript = (SELECT jsonb_agg(jsonb_build_object('id', 'm' || g, 'sender', 'user', 'text', repeat('w', 20000))) FROM generate_series(1, 500) g) WHERE id = '%s'$q$, sid));
  PERFORM pg_temp.check(r LIKE '23514%', 'S-3 a conversation over 8 MB is refused', left(r, 200));
  r := pg_temp.try_as(p, format($q$UPDATE public.chamber_sessions SET transcript = (SELECT jsonb_agg(jsonb_build_object('id', 'm' || g, 'sender', CASE WHEN g %% 2 = 0 THEN 'user' ELSE 'lenore' END, 'text', repeat('w', 2000))) FROM generate_series(1, 1000) g) WHERE id = '%s'$q$, sid));
  PERFORM pg_temp.check(r = 'ok', 'S-3 (control) a long conversation (1,000 messages of 2,000 characters) is kept', left(r, 200));
  r := pg_temp.try_as(p, format($q$UPDATE public.chamber_sessions SET chamber_data = jsonb_build_object('company_name', 'Huge', 'census', (SELECT jsonb_agg(jsonb_build_object('first_name', 'F' || g, 'notes', repeat('z', 4000))) FROM generate_series(1, 5000) g)) WHERE id = '%s'$q$, sid));
  PERFORM pg_temp.check(r LIKE '23514%' AND r LIKE '%chamber_data%', 'S-3 answers over 16 MB are refused', left(r, 200));

  -- Documents
  PERFORM pg_temp.as_user(p);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, category)
  VALUES (p, sid, 'census.csv', '1 KB', p || '/' || sid || '/census.csv', 'employee_census') RETURNING id INTO doc;
  RESET ROLE;
  r := pg_temp.try_as(p, format($q$INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, category) VALUES ('%s', '%s', '%s', '1 KB', '%s/%s/x.pdf', 'other')$q$, p, sid, repeat('f', 256), p, sid));
  PERFORM pg_temp.check(r LIKE '23514%', 'S-3 a file name over 255 characters is refused', left(r, 200));
  r := pg_temp.try_as(p, format($q$UPDATE public.documents SET extraction = jsonb_build_object('pad', repeat('x', 17000000)) WHERE id = '%s'$q$, doc));
  PERFORM pg_temp.check(r LIKE '23514%', 'S-3 an extraction over 16 MB is refused', left(r, 200));

  -- The queue clips what it lists: a contact stored before the cap (which applies to every new write, so it
  -- is dropped here to store one; nothing after this block writes a profile).
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_contact_name_length;
  UPDATE public.profiles SET contact_name = repeat('k', 5000) WHERE user_id = p;
  PERFORM pg_temp.as_advisor();
  SET LOCAL ROLE authenticated;
  SELECT jsonb_agg(char_length(q.contact_name)) INTO listed FROM public.advisor_list_submissions(p_search => 'Heavy') q;
  RESET ROLE;
  PERFORM pg_temp.check((listed ->> 0)::int <= 200, 'S-3 the queue lists at most 200 characters of a contact', listed::text);
END $$;

-- ---------- S-6: lapsed claims are cancelled like pending ones ----------
DO $$
DECLARE
  p uuid := pg_temp.new_user(false);
  sid uuid;
  reminder uuid;
  confirmation uuid;
  alert uuid;
  claimed uuid[];
BEGIN
  PERFORM pg_temp.as_user(p);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (p, '{"company_name":"Lapsed Co"}') RETURNING id INTO sid;
  RESET ROLE;
  -- Reminders off (draft_reminders_at null), and the address bounced.
  UPDATE public.profiles SET draft_reminders_at = NULL WHERE user_id = p;
  INSERT INTO public.email_suppressions (address, reason) VALUES ('bounced-' || p || '@example.test', 'bounced');
  INSERT INTO public.outbox_events (kind, session_id, dedupe_key, payload, status, attempts, claimed_at, locked_until, next_attempt_at)
  VALUES ('draft_expiry_reminder', sid, 'r-' || sid, jsonb_build_object('recipient_email', p || '@example.test', 'expires_at', '2026-12-01T00:00:00Z'),
          'claimed', 1, now() - interval '20 minutes', now() - interval '10 minutes', now() - interval '1 hour')
  RETURNING id INTO reminder;
  INSERT INTO public.outbox_events (kind, session_id, dedupe_key, payload, status, attempts, claimed_at, locked_until, next_attempt_at)
  VALUES ('prospect_confirmation', sid, 'c-' || sid, jsonb_build_object('recipient_email', 'bounced-' || p || '@example.test'),
          'claimed', 1, now() - interval '20 minutes', now() - interval '10 minutes', now() - interval '1 hour')
  RETURNING id INTO confirmation;
  INSERT INTO public.outbox_events (kind, session_id, dedupe_key, payload, status, attempts, claimed_at, locked_until, next_attempt_at)
  VALUES ('advisor_notification', sid, 'a-' || sid, jsonb_build_object('recipient_email', 'team@example.test'),
          'claimed', 1, now() - interval '20 minutes', now() - interval '10 minutes', now() - interval '1 hour')
  RETURNING id INTO alert;

  SET LOCAL ROLE service_role;
  SELECT array_agg(c.id) INTO claimed FROM public.claim_outbox_events(
    ARRAY['draft_expiry_reminder', 'prospect_confirmation', 'advisor_notification'], 10, 5, 600) c;
  RESET ROLE;
  PERFORM pg_temp.check(NOT (reminder = ANY (COALESCE(claimed, '{}'))) AND (SELECT status FROM public.outbox_events WHERE id = reminder) = 'suppressed',
    'S-6 a lapsed reminder claim whose owner turned reminders off is cancelled', claimed::text);
  PERFORM pg_temp.check(NOT (confirmation = ANY (COALESCE(claimed, '{}'))) AND (SELECT status FROM public.outbox_events WHERE id = confirmation) = 'suppressed',
    'S-6 a lapsed claim to a suppressed address is cancelled', claimed::text);
  PERFORM pg_temp.check(alert = ANY (COALESCE(claimed, '{}')), 'S-6 (control) any other lapsed claim is claimed again', claimed::text);
END $$;

-- ---------- S-8: id and created_at are the server's ----------
DO $$
DECLARE
  g uuid := pg_temp.new_user(true);
  chosen constant uuid := '1a2b3c4d-0000-4000-8000-000000000001';
  sid uuid;
  made timestamptz;
BEGIN
  PERFORM pg_temp.as_user(g);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.chamber_sessions (id, user_id, chamber_data, created_at)
  VALUES (chosen, g, '{"company_name":"Backdated"}', '2026-01-15T00:00:00Z') RETURNING id, created_at INTO sid, made;
  RESET ROLE;
  PERFORM pg_temp.check(sid <> chosen, 'S-8 the browser can''t choose an intake''s id', sid::text);
  PERFORM pg_temp.check(made > now() - interval '1 minute', 'S-8 the browser can''t backdate an intake', made::text);
  PERFORM pg_temp.check(pg_temp.try_as(g, format($q$UPDATE public.chamber_sessions SET created_at = '2025-06-01T00:00:00Z', chamber_data = '{"company_name":"Backdated later"}' WHERE id = '%s'$q$, sid)) = 'ok',
    'S-8 (control) the update runs');
  PERFORM pg_temp.check((SELECT created_at FROM public.chamber_sessions WHERE id = sid) = made, 'S-8 the browser can''t move created_at later');
  PERFORM pg_temp.check((SELECT chamber_data ->> 'company_name' FROM public.chamber_sessions WHERE id = sid) = 'Backdated later',
    'S-8 (control) the rest of the update is kept');
END $$;

-- ---------- outcome ----------
SELECT n, CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, label, left(detail, 160) AS detail FROM results ORDER BY n;
DO $$
DECLARE failed int := (SELECT count(*) FROM results WHERE NOT ok);
BEGIN
  IF failed > 0 THEN RAISE EXCEPTION '% hardening check(s) failed', failed; END IF;
END $$;
