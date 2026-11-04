-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh document_scanning
-- Upload validation and malware scanning (20261104130000_document_scanning.sql, E-4.1 and E-4.3):
--   * a prospect can't store a file in the documents bucket themselves (only document-upload can), nor
--     record, change or forge a scan verdict;
--   * nobody signed in can read, list or delete a quarantined file, and a file in the documents bucket is
--     readable, by its owner or an advisor, only once its row's scan passed;
--   * the scan queue: claiming, retrying with backoff, giving up (scan_failed), a lost worker, a detection
--     (malware_detected, which ops-monitor alerts on), requeueing, and the quarantined copies to remove;
--   * deleting an intake removes its quarantined files too.
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
\i supabase/migrations/20261104130000_document_scanning.sql
SET client_min_messages = notice;

-- ---------- helpers ----------

CREATE TEMP TABLE fx (name text PRIMARY KEY, id uuid NOT NULL);
GRANT SELECT ON fx TO anon, authenticated, service_role;
CREATE FUNCTION pg_temp.id(n text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM fx WHERE name = n $$;

CREATE FUNCTION pg_temp.new_user(email text, guest boolean) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', email, guest, now(), now());
  RETURN uid;
END $$;

-- Act as a caller until the next become() or the end of the transaction.
CREATE FUNCTION pg_temp.become(who text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE uid uuid;
BEGIN
  RESET ROLE;
  IF who = 'service' THEN
    PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', false);
    SET LOCAL ROLE service_role;
    RETURN;
  END IF;
  uid := pg_temp.id(who);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', uid, 'role', 'authenticated', 'is_anonymous', who = 'guest',
      'email', CASE WHEN who = 'guest' THEN NULL ELSE who || '@example.test' END)::text, false);
  SET LOCAL ROLE authenticated;
END $$;

CREATE FUNCTION pg_temp.visible(src text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE format('SELECT count(*) FROM %s', src) INTO n;
  RETURN n;
EXCEPTION WHEN insufficient_privilege THEN RETURN 0;
END $$;

-- Runs stmt and always rolls it back: 'rows:<n>' for the rows it touched, or the SQLSTATE it raised.
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

CREATE FUNCTION pg_temp.expect(stmt text, expected text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r text := pg_temp.attempt(stmt);
BEGIN
  IF r IS DISTINCT FROM expected THEN RAISE EXCEPTION 'FAIL: % gave %, expected %', label, r, expected; END IF;
END $$;

-- A stored file, as document-upload or document-scan (the service role) would store it.
CREATE FUNCTION pg_temp.store(bucket text, path text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO storage.objects (bucket_id, name) VALUES (bucket, path);
$$;

-- ---------- fixtures ----------

DO $$
DECLARE
  g uuid := pg_temp.new_user(NULL, true);
  adv uuid := pg_temp.new_user('advisor@example.test', false);
  sid uuid;
BEGIN
  INSERT INTO fx VALUES ('guest', g), ('advisor', adv);
  INSERT INTO public.user_roles (user_id, role) VALUES (adv, 'advisor');
  PERFORM pg_temp.become('guest');
  PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (g, '{"company_name":"Guest Co"}') RETURNING id INTO sid;
  RESET ROLE;
  INSERT INTO fx VALUES ('intake', sid);
END $$;

-- ---------- 1. storing and recording ----------

DO $$
DECLARE
  g constant uuid := pg_temp.id('guest');
  sid constant uuid := pg_temp.id('intake');
  doc uuid;
  r public.documents;
  b storage.buckets;
BEGIN
  -- The buckets: quarantine exists and is private; both document buckets take only what document-upload stores.
  SELECT * INTO b FROM storage.buckets WHERE id = 'quarantine';
  IF NOT FOUND OR b.public IS DISTINCT FROM false THEN RAISE EXCEPTION 'FAIL: no private quarantine bucket'; END IF;
  IF (SELECT array_agg(DISTINCT m) FROM storage.buckets, unnest(allowed_mime_types) m WHERE id IN ('documents', 'quarantine'))
     IS DISTINCT FROM ARRAY['application/octet-stream'] THEN
    RAISE EXCEPTION 'FAIL: the document buckets take other types than application/octet-stream';
  END IF;

  PERFORM pg_temp.become('guest');
  -- Not into storage directly, in either bucket, even under their own open intake.
  PERFORM pg_temp.expect(format('INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)', 'documents', g || '/' || sid || '/x_census.csv'), '42501', 'a prospect storing a file directly');
  PERFORM pg_temp.expect(format('INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)', 'quarantine', g || '/' || sid || '/x_census.csv'), '42501', 'a prospect storing a file in quarantine');

  -- The row (as document-upload writes it, as the prospect) starts pending, due ten minutes from now.
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, category)
  VALUES (g, sid, 'census.csv', '1 KB', g || '/' || sid || '/a_census.csv', 'employee_census')
  RETURNING * INTO r;
  doc := r.id;
  IF r.scan_verdict <> 'pending' OR r.scan_next_at < now() + interval '9 minutes' OR r.scan_attempts <> 0 THEN
    RAISE EXCEPTION 'FAIL: a new document starts %, due %', r.scan_verdict, r.scan_next_at;
  END IF;

  -- No verdict from the API, however it is sent.
  PERFORM pg_temp.expect(format('INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, scan_verdict) VALUES (%L, %L, %L, %L, %L, %L)',
    g, sid, 'forged.csv', '1 KB', g || '/' || sid || '/b_forged.csv', 'clean'), '42501', 'a prospect inserting a clean verdict');
  PERFORM pg_temp.expect(format('UPDATE public.documents SET scan_verdict = %L WHERE id = %L', 'clean', doc), '42501', 'a prospect marking their file clean');
  PERFORM pg_temp.expect(format('UPDATE public.documents SET scan_attempts = 99, scan_next_at = now() + interval ''1 year'' WHERE id = %L', doc), '42501', 'a prospect delaying their scan');
  -- Everything else about their document they still change, as before; status included (document-extract
  -- writes it as them), which is why the verdict has its own columns.
  PERFORM pg_temp.expect(format('UPDATE public.documents SET category = %L, status = %L WHERE id = %L', 'payroll_report', 'extracted', doc), 'rows:1', 'a prospect changing their document');

  -- The service functions are not theirs, nor an advisor's.
  PERFORM pg_temp.expect(format('SELECT public.record_document_scan(%L, %L)', doc, 'clean'), '42501', 'a prospect recording a verdict');
  PERFORM pg_temp.expect('SELECT * FROM public.claim_document_scans(1, 60)', '42501', 'a prospect claiming scans');
  PERFORM pg_temp.expect(format('SELECT public.fail_document_scan(%L, %L, 60)', doc, 'x'), '42501', 'a prospect failing a scan');
  PERFORM pg_temp.expect('SELECT * FROM public.document_scan_orphans(10)', '42501', 'a prospect listing orphans');
  PERFORM pg_temp.expect(format('SELECT public.requeue_document_scan(%L)', doc), '42501', 'a prospect requeueing a scan');
  PERFORM pg_temp.become('advisor');
  PERFORM pg_temp.expect(format('SELECT public.record_document_scan(%L, %L)', doc, 'clean'), '42501', 'an advisor recording a verdict');
  PERFORM pg_temp.expect(format('UPDATE public.documents SET scan_verdict = %L WHERE id = %L', 'clean', doc), 'rows:0', 'an advisor marking a file clean');

  -- The service role does.
  PERFORM pg_temp.become('service');
  PERFORM pg_temp.expect(format('UPDATE public.documents SET scan_error = %L WHERE id = %L', 'probe', doc), 'rows:1', 'the service role writing a scan column');
  RESET ROLE;
  INSERT INTO fx VALUES ('doc', doc);
  RAISE NOTICE 'document_scanning: storing and recording cases passed';
END $$;

-- ---------- 2. reading files ----------

DO $$
DECLARE
  g constant uuid := pg_temp.id('guest');
  sid constant uuid := pg_temp.id('intake');
  doc constant uuid := pg_temp.id('doc');
  path constant text := g || '/' || sid || '/a_census.csv';
  who text;
BEGIN
  -- An older upload: in the documents bucket, not scanned yet. And a copy in quarantine.
  PERFORM pg_temp.store('documents', path);
  PERFORM pg_temp.store('quarantine', path);

  FOREACH who IN ARRAY ARRAY['guest', 'advisor'] LOOP
    PERFORM pg_temp.become(who);
    IF pg_temp.visible(format('storage.objects WHERE bucket_id = %L AND name = %L', 'documents', path)) <> 0 THEN
      RAISE EXCEPTION 'FAIL: % can read (and so sign a link to) a file whose scan is pending', who;
    END IF;
    IF pg_temp.visible('storage.objects WHERE bucket_id = ''quarantine''') <> 0 THEN
      RAISE EXCEPTION 'FAIL: % can see a quarantined file', who;
    END IF;
    PERFORM pg_temp.expect(format('DELETE FROM storage.objects WHERE bucket_id = %L', 'quarantine'), 'rows:0', who || ' deleting a quarantined file');
    PERFORM pg_temp.expect(format('UPDATE storage.objects SET name = name || %L WHERE bucket_id = %L', '.x', 'quarantine'), 'rows:0', who || ' moving a quarantined file');
  END LOOP;

  -- Its scan passes: the owner and an advisor read it; quarantine stays shut.
  PERFORM pg_temp.become('service');
  IF public.record_document_scan(doc, 'clean', NULL, 'document-upload') <> 'clean' THEN RAISE EXCEPTION 'FAIL: clean not recorded'; END IF;
  FOREACH who IN ARRAY ARRAY['guest', 'advisor'] LOOP
    PERFORM pg_temp.become(who);
    IF pg_temp.visible(format('storage.objects WHERE bucket_id = %L AND name = %L', 'documents', path)) <> 1 THEN
      RAISE EXCEPTION 'FAIL: % can''t read a file whose scan passed', who;
    END IF;
    IF pg_temp.visible('storage.objects WHERE bucket_id = ''quarantine''') <> 0 THEN
      RAISE EXCEPTION 'FAIL: % can see a quarantined file', who;
    END IF;
  END LOOP;

  -- skipped (no scanner configured) reads too; infected and failed don't.
  RESET ROLE;
  UPDATE public.documents SET scan_verdict = 'skipped' WHERE id = doc;
  PERFORM pg_temp.become('guest');
  IF pg_temp.visible(format('storage.objects WHERE name = %L', path)) <> 1 THEN RAISE EXCEPTION 'FAIL: a skipped file is unreadable'; END IF;
  RESET ROLE;
  UPDATE public.documents SET scan_verdict = 'failed' WHERE id = doc;
  PERFORM pg_temp.become('advisor');
  IF pg_temp.visible(format('storage.objects WHERE name = %L', path)) <> 0 THEN RAISE EXCEPTION 'FAIL: a failed scan''s file is readable'; END IF;

  -- The service role (document-scan) reads both buckets.
  PERFORM pg_temp.become('service');
  IF pg_temp.visible(format('storage.objects WHERE name = %L', path)) <> 2 THEN RAISE EXCEPTION 'FAIL: the service role can''t see both copies'; END IF;
  RESET ROLE;
  UPDATE public.documents SET scan_verdict = 'clean' WHERE id = doc;
  DELETE FROM storage.objects WHERE bucket_id = 'quarantine';
  RAISE NOTICE 'document_scanning: reading cases passed';
END $$;

-- ---------- 3. the queue ----------

DO $$
DECLARE
  g constant uuid := pg_temp.id('guest');
  sid constant uuid := pg_temp.id('intake');
  held uuid;
  missing uuid;
  c record;
  n integer;
  outcome text;
  r public.documents;
BEGIN
  PERFORM pg_temp.become('guest');
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path)
  VALUES (g, sid, 'held.pdf', '1 KB', g || '/' || sid || '/c_held.pdf') RETURNING id INTO held;
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path)
  VALUES (g, sid, 'missing.pdf', '1 KB', g || '/' || sid || '/d_missing.pdf') RETURNING id INTO missing;
  RESET ROLE;
  PERFORM pg_temp.store('quarantine', g || '/' || sid || '/c_held.pdf');

  -- A new upload isn't due yet: document-upload is still settling it.
  PERFORM pg_temp.become('service');
  IF EXISTS (SELECT 1 FROM public.claim_document_scans(10, 60)) THEN RAISE EXCEPTION 'FAIL: claimed an upload still in its first ten minutes'; END IF;

  RESET ROLE;
  UPDATE public.documents SET scan_next_at = now() - interval '1 second' WHERE id IN (held, missing);
  PERFORM pg_temp.become('service');
  n := 0;
  FOR c IN SELECT * FROM public.claim_document_scans(10, 60) LOOP
    n := n + 1;
    -- The intake comes from the row, never from the path (for an upload from before intakes, the path's second
    -- part is the file name).
    IF c.session_id IS DISTINCT FROM sid THEN RAISE EXCEPTION 'FAIL: claimed with intake %', c.session_id; END IF;
    IF c.document_id = held AND (c.bucket IS DISTINCT FROM 'quarantine' OR c.attempt <> 1) THEN
      RAISE EXCEPTION 'FAIL: held claimed as % attempt %', c.bucket, c.attempt;
    END IF;
    IF c.document_id = missing AND c.bucket IS NOT NULL THEN RAISE EXCEPTION 'FAIL: a document with no file claimed in %', c.bucket; END IF;
  END LOOP;
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL: claimed % documents, expected 2', n; END IF;
  -- Claimed documents are locked.
  IF EXISTS (SELECT 1 FROM public.claim_document_scans(10, 60)) THEN RAISE EXCEPTION 'FAIL: a claimed document was claimed again'; END IF;

  -- A scan that didn't settle is retried later, with its reason kept.
  outcome := public.fail_document_scan(missing, 'timeout', 300);
  SELECT * INTO r FROM public.documents WHERE id = missing;
  IF outcome <> 'retrying' OR r.scan_verdict <> 'pending' OR r.scan_error <> 'timeout' OR r.scan_locked_until IS NOT NULL
     OR r.scan_next_at < now() + interval '4 minutes' THEN
    RAISE EXCEPTION 'FAIL: a failed attempt left % % % %', outcome, r.scan_verdict, r.scan_error, r.scan_next_at;
  END IF;

  -- The last attempt gives up: failed, unreadable, and a scan_failed event for ops-monitor.
  RESET ROLE;
  UPDATE public.documents SET scan_attempts = public.document_scan_max_attempts() WHERE id = missing;
  PERFORM pg_temp.become('service');
  IF public.fail_document_scan(missing, 'clamd_error', 300) <> 'failed' THEN RAISE EXCEPTION 'FAIL: the last attempt didn''t give up'; END IF;
  RESET ROLE;
  IF (SELECT scan_verdict FROM public.documents WHERE id = missing) <> 'failed'
     OR NOT EXISTS (SELECT 1 FROM public.ops_events WHERE kind = 'scan_failed' AND code = 'clamd_error' AND session_id = sid AND user_id = g) THEN
    RAISE EXCEPTION 'FAIL: giving up wasn''t recorded';
  END IF;
  PERFORM pg_temp.become('service');
  IF public.fail_document_scan(missing, 'clamd_error', 300) <> 'gone' THEN RAISE EXCEPTION 'FAIL: a settled document was failed again'; END IF;

  -- A detection: recorded with its signature, and a malware_detected event (codes only, no names).
  IF public.record_document_scan(held, 'infected', 'Win.Test.EICAR_HDB-1', 'document-scan') <> 'infected' THEN RAISE EXCEPTION 'FAIL: infected not recorded'; END IF;
  RESET ROLE;
  SELECT * INTO r FROM public.documents WHERE id = held;
  IF r.scan_verdict <> 'infected' OR r.scan_signature <> 'Win.Test.EICAR_HDB-1' OR r.scanned_at IS NULL OR r.scan_locked_until IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: the detection left % %', r.scan_verdict, r.scan_signature;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ops_events WHERE kind = 'malware_detected' AND source = 'document-scan'
                 AND code = 'malware:Win.Test.EICAR_HDB-1' AND session_id = sid AND user_id = g) THEN
    RAISE EXCEPTION 'FAIL: the detection wasn''t recorded for ops';
  END IF;
  PERFORM pg_temp.become('service');
  PERFORM pg_temp.expect(format('SELECT public.record_document_scan(%L, %L)', held, 'infected'), '22023', 'an infected verdict with no signature');
  PERFORM pg_temp.expect(format('SELECT public.record_document_scan(%L, %L)', held, 'pending'), '22023', 'recording pending as a verdict');
  PERFORM pg_temp.expect(format('SELECT public.record_document_scan(%L, %L)', gen_random_uuid(), 'clean'), 'PT404', 'a verdict for a removed document');

  -- ops-monitor alerts on the first of each.
  RESET ROLE;
  IF (SELECT array_agg(kind ORDER BY kind) FROM public.ops_alert_rules() WHERE kind IN ('malware_detected', 'scan_failed') AND threshold = 1)
     IS DISTINCT FROM ARRAY['malware_detected', 'scan_failed'] THEN
    RAISE EXCEPTION 'FAIL: the scan kinds don''t alert on one event';
  END IF;
  IF (SELECT array_agg(kind ORDER BY kind) FROM public.claim_ops_alerts() WHERE kind IN ('malware_detected', 'scan_failed'))
     IS DISTINCT FROM ARRAY['malware_detected', 'scan_failed'] THEN
    RAISE EXCEPTION 'FAIL: ops-monitor wouldn''t alert on a detection and a failed scan';
  END IF;

  -- The kinds that came before still record and alert: this migration rewrites both lists, and must keep
  -- 20261104121000's voice_failed (the browser reports it through report_client_event).
  INSERT INTO public.ops_events (kind, source, code) VALUES ('voice_failed', 'browser', 'voice_error');
  IF (SELECT array_agg(kind ORDER BY kind) FROM public.ops_alert_rules())
     IS DISTINCT FROM ARRAY['ai_failed', 'app_error', 'auth_denied', 'deletion_failed', 'malware_detected', 'scan_failed', 'upload_failed', 'voice_failed'] THEN
    RAISE EXCEPTION 'FAIL: the alert rules are %', (SELECT array_agg(kind ORDER BY kind) FROM public.ops_alert_rules());
  END IF;
  DELETE FROM public.ops_events WHERE kind = 'voice_failed';

  -- An operator requeues the failed one: pending, due now, attempts reset, still unreadable.
  PERFORM pg_temp.become('service');
  PERFORM public.requeue_document_scan(missing);
  RESET ROLE;
  SELECT * INTO r FROM public.documents WHERE id = missing;
  IF r.scan_verdict <> 'pending' OR r.scan_attempts <> 0 OR r.scan_next_at > now() OR r.scan_error IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: requeue left % %', r.scan_verdict, r.scan_attempts;
  END IF;

  -- A worker that died on the last attempt: the next claim marks it failed (worker_lost) instead of taking it.
  UPDATE public.documents
  SET scan_attempts = public.document_scan_max_attempts(), scan_locked_until = now() - interval '1 second', scan_next_at = now() - interval '1 second'
  WHERE id = missing;
  PERFORM pg_temp.become('service');
  IF EXISTS (SELECT 1 FROM public.claim_document_scans(10, 60)) THEN RAISE EXCEPTION 'FAIL: claimed a document with every attempt used'; END IF;
  RESET ROLE;
  IF (SELECT scan_verdict || ':' || scan_error FROM public.documents WHERE id = missing) <> 'failed:worker_lost'
     OR NOT EXISTS (SELECT 1 FROM public.ops_events WHERE kind = 'scan_failed' AND code = 'worker_lost') THEN
    RAISE EXCEPTION 'FAIL: a lost worker wasn''t reaped and recorded';
  END IF;

  INSERT INTO fx VALUES ('held', held), ('missing', missing);
  RAISE NOTICE 'document_scanning: queue cases passed';
END $$;

-- ---------- 4. orphans and deletion ----------

DO $$
DECLARE
  g constant uuid := pg_temp.id('guest');
  sid constant uuid := pg_temp.id('intake');
  names text[];
  files text[];
BEGIN
  -- Quarantined: the infected file (held), a clean document's stale copy, and a file whose row is gone.
  PERFORM pg_temp.store('quarantine', g || '/' || sid || '/a_census.csv');
  PERFORM pg_temp.store('quarantine', g || '/' || sid || '/e_removed.csv');
  PERFORM pg_temp.become('service');
  SELECT array_agg(o.name ORDER BY o.name) INTO names FROM public.document_scan_orphans(100) o;
  IF names IS DISTINCT FROM ARRAY[g || '/' || sid || '/a_census.csv', g || '/' || sid || '/e_removed.csv'] THEN
    RAISE EXCEPTION 'FAIL: orphans were %', names;
  END IF;

  -- Deleting the intake lists its quarantined files with the rest.
  SELECT array_agg(f.bucket || ':' || split_part(f.name, '/', 3) ORDER BY 1) INTO files FROM public.intake_stored_files(sid, g) f;
  IF files IS DISTINCT FROM ARRAY['documents:a_census.csv', 'quarantine:a_census.csv', 'quarantine:c_held.pdf', 'quarantine:e_removed.csv'] THEN
    RAISE EXCEPTION 'FAIL: the intake''s stored files were %', files;
  END IF;
  RESET ROLE;
  RAISE NOTICE 'document_scanning: orphan and deletion cases passed';
END $$;

-- ---------- 5. a document with no stored file, and removing one whose scan hasn't passed ----------

DO $$
DECLARE
  g constant uuid := pg_temp.id('guest');
  sid constant uuid := pg_temp.id('intake');
  ghost uuid;
  older uuid;
  flagged uuid;
  path_older constant text := g || '/' || sid || '/f_older.csv';
  path_flagged constant text := g || '/' || sid || '/h_flagged.csv';
  who text;
  w record;
  n integer;
  p2 uuid := pg_temp.new_user('p2@example.test', false);
  sid2 uuid := gen_random_uuid();
  path_cert constant text := p2 || '/' || sid2 || '/k_certified.pdf';
BEGIN
  -- A row with no file (written straight through the API) fails at once, without waiting out six attempts.
  PERFORM pg_temp.become('guest');
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path)
  VALUES (g, sid, 'ghost.csv', '1 KB', g || '/' || sid || '/g_ghost.csv') RETURNING id INTO ghost;
  RESET ROLE;
  UPDATE public.documents SET scan_next_at = now() - interval '1 second' WHERE id = ghost;
  PERFORM pg_temp.become('service');
  SELECT count(*) INTO n FROM public.claim_document_scans(10, 60) c WHERE c.document_id = ghost AND c.bucket IS NULL AND c.attempt = 1;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: the row with no file wasn''t claimed'; END IF;
  IF public.fail_document_scan(ghost, 'file_missing', 300) <> 'failed' THEN RAISE EXCEPTION 'FAIL: a missing file was retried'; END IF;

  -- An upload from before scanning (pending, its file still in documents), removed by its prospect: the file
  -- stays withheld from them and from advisors, and is recorded for document-scan to delete.
  PERFORM pg_temp.become('guest');
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path)
  VALUES (g, sid, 'older.csv', '1 KB', path_older) RETURNING id INTO older;
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path)
  VALUES (g, sid, 'flagged.csv', '1 KB', path_flagged) RETURNING id INTO flagged;
  RESET ROLE;
  PERFORM pg_temp.store('documents', path_older);
  PERFORM pg_temp.store('documents', path_flagged);
  UPDATE public.documents SET scan_verdict = 'infected', scan_signature = 'Eicar-Signature' WHERE id = flagged;
  PERFORM pg_temp.become('guest');
  PERFORM pg_temp.expect(format('DELETE FROM storage.objects WHERE name = %L', path_older), 'rows:0', 'the prospect deleting a withheld file');
  DELETE FROM public.documents WHERE id IN (older, flagged);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL: the prospect removed % of their 2 documents', n; END IF;
  FOREACH who IN ARRAY ARRAY['guest', 'advisor'] LOOP
    PERFORM pg_temp.become(who);
    IF pg_temp.visible(format('storage.objects WHERE name IN (%L, %L)', path_older, path_flagged)) <> 0 THEN
      RAISE EXCEPTION 'FAIL: % can read a file whose document was removed before its scan passed', who;
    END IF;
    IF pg_temp.visible('public.withheld_document_files') <> 0 THEN RAISE EXCEPTION 'FAIL: % can read the withheld files', who; END IF;
    PERFORM pg_temp.expect('SELECT count(*) FROM public.withheld_files_due(10)', '42501', who || ' listing withheld files');
    PERFORM pg_temp.expect(format('SELECT public.settle_withheld_file(%L, %L)', path_older, 'removed'), '42501', who || ' settling a withheld file');
  END LOOP;
  RESET ROLE;
  IF (SELECT array_agg(verdict ORDER BY storage_path) FROM public.withheld_document_files WHERE session_id = sid)
     IS DISTINCT FROM ARRAY['pending', 'infected'] THEN
    RAISE EXCEPTION 'FAIL: the removed files were recorded as %', (SELECT array_agg(verdict) FROM public.withheld_document_files);
  END IF;

  -- document-scan deletes both (neither is a certified file), then ends their records.
  PERFORM pg_temp.become('service');
  n := 0;
  FOR w IN SELECT * FROM public.withheld_files_due(10) WHERE storage_path IN (path_older, path_flagged) LOOP
    n := n + 1;
    IF w.evidence OR w.bucket IS DISTINCT FROM 'documents' OR w.session_id IS DISTINCT FROM sid THEN
      RAISE EXCEPTION 'FAIL: withheld file listed as evidence=% bucket=% intake=%', w.evidence, w.bucket, w.session_id;
    END IF;
    PERFORM public.settle_withheld_file(w.storage_path, 'removed');
  END LOOP;
  IF n <> 2 OR EXISTS (SELECT 1 FROM public.withheld_document_files WHERE session_id = sid) THEN
    RAISE EXCEPTION 'FAIL: % withheld files were listed and settled', n;
  END IF;
  PERFORM pg_temp.expect(format('SELECT public.settle_withheld_file(%L, %L)', path_older, 'infected'), '22023', 'an infected outcome with no signature');
  RESET ROLE;
  DELETE FROM storage.objects WHERE name IN (path_older, path_flagged);

  -- A submission's certified file, removed before its scan passed: listed as evidence (scanned, never deleted),
  -- left alone by the orphan sweep, and once found infected kept withheld and not listed again.
  SET LOCAL session_replication_role = replica;
  INSERT INTO public.chamber_sessions (id, user_id, status, submission)
  VALUES (sid2, p2, 'submitted', jsonb_build_object('documents', jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'storage_path', path_cert))));
  SET LOCAL session_replication_role = origin;
  INSERT INTO public.withheld_document_files (storage_path, user_id, session_id) VALUES (path_cert, p2, sid2);
  PERFORM pg_temp.store('quarantine', path_cert);
  PERFORM pg_temp.become('service');
  SELECT * INTO w FROM public.withheld_files_due(10) WHERE storage_path = path_cert;
  IF NOT FOUND OR NOT w.evidence OR w.bucket IS DISTINCT FROM 'quarantine' THEN RAISE EXCEPTION 'FAIL: a certified file wasn''t listed as evidence'; END IF;
  IF EXISTS (SELECT 1 FROM public.document_scan_orphans(100) o WHERE o.name = path_cert) THEN
    RAISE EXCEPTION 'FAIL: the orphan sweep would delete a certified file waiting for its scan';
  END IF;
  PERFORM public.settle_withheld_file(path_cert, 'infected', 'Eicar-Signature');
  IF EXISTS (SELECT 1 FROM public.withheld_files_due(10) WHERE storage_path = path_cert) THEN
    RAISE EXCEPTION 'FAIL: an infected certified file was listed again';
  END IF;
  RESET ROLE;
  IF NOT EXISTS (SELECT 1 FROM public.ops_events WHERE kind = 'malware_detected' AND session_id = sid2 AND user_id = p2) THEN
    RAISE EXCEPTION 'FAIL: the certified file''s detection wasn''t recorded';
  END IF;

  -- An intake's deletion removes its files itself: removing its rows records nothing, and the records it has
  -- go with the intake.
  PERFORM set_config('eaa.deleting_intake', sid::text, true);
  DELETE FROM public.documents WHERE session_id = sid AND scan_verdict <> 'clean';
  PERFORM set_config('eaa.deleting_intake', '', true);
  IF EXISTS (SELECT 1 FROM public.withheld_document_files WHERE session_id = sid) THEN
    RAISE EXCEPTION 'FAIL: an intake''s deletion recorded withheld files';
  END IF;
  PERFORM set_config('eaa.deleting_intake', sid2::text, true);
  DELETE FROM public.chamber_sessions WHERE id = sid2;
  PERFORM set_config('eaa.deleting_intake', '', true);
  IF EXISTS (SELECT 1 FROM public.withheld_document_files WHERE session_id = sid2) THEN
    RAISE EXCEPTION 'FAIL: a deleted intake''s withheld files were kept';
  END IF;
  RAISE NOTICE 'document_scanning: missing file and withheld file cases passed';
END $$;

\echo 'document_scanning: all cases passed'
