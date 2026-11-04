-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh queue_empty_guest_drafts
-- The advisor queue leaves out empty guest drafts (F-2.1, 20261104133000_queue_hides_empty_guest_drafts.sql): a
-- guest's never-certified intake holding nothing the prospect did. Anything the prospect did keeps it listed (a
-- message, an answer, even an explicit false, provenance, a PEO choice, a document, a voice-call note), and a
-- verified prospect's empty draft stays listed. Everyone runs as `authenticated` with their JWT claims.
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
SET client_min_messages = notice;

-- ---------- helpers ----------
CREATE FUNCTION pg_temp.as_user(uid uuid, guest boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', uid, 'is_anonymous', guest, 'role', 'authenticated', 'email', CASE WHEN guest THEN NULL ELSE uid || '@example.test' END)::text, false);
END $$;

-- An intake of its own new owner (one open draft each), a guest unless told otherwise, created as that owner.
CREATE FUNCTION pg_temp.intake(guest boolean, data jsonb DEFAULT '{}', transcript jsonb DEFAULT '[]',
                               provenance jsonb DEFAULT '{}', peo text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  uid uuid := gen_random_uuid();
  sid uuid;
BEGIN
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', CASE WHEN guest THEN NULL ELSE uid || '@example.test' END, guest, now(), now());
  PERFORM pg_temp.as_user(uid, guest);
  SET LOCAL ROLE authenticated;
  PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');
  INSERT INTO public.chamber_sessions (user_id, chamber_data, transcript, field_provenance, chosen_peo)
  VALUES (uid, data, transcript, provenance, peo) RETURNING id INTO sid;
  RESET ROLE;
  RETURN sid;
END $$;

DO $$
DECLARE
  advisor uuid := gen_random_uuid();
  greeting constant jsonb := '[{"id":"g1","sender":"lenore","kind":"greeting","text":"Hello, I''m Lenore."}]';
  blank uuid := pg_temp.intake(true);
  greeted uuid := pg_temp.intake(true, '{"company_name":"   ","states":[],"census":[]}', greeting);
  said uuid := pg_temp.intake(true, '{}', greeting || '[{"id":"u1","sender":"user","text":"Hi"}]');
  called uuid := pg_temp.intake(true, '{}', greeting || '[{"id":"s1","sender":"system","text":"Voice call started"}]');
  answered uuid := pg_temp.intake(true, '{"company_name":"Acme"}');
  said_no uuid := pg_temp.intake(true, '{"has_1099":false}');
  traced uuid := pg_temp.intake(true, '{}', '[]', '{"company_name":{"status":"unknown","source":{"kind":"prospect_edit"},"updated_at":"2026-11-04T12:00:00Z"}}');
  chose uuid := pg_temp.intake(true, '{}', '[]', '{}', 'Justworks');
  uploaded uuid := pg_temp.intake(true);
  verified_empty uuid := pg_temp.intake(false);
  listed uuid[];
  total bigint;
  hidden constant uuid[] := ARRAY[blank, greeted];
  kept uuid[];
BEGIN
  kept := ARRAY[said, called, answered, said_no, traced, chose, uploaded, verified_empty];
  -- A document the guest uploaded, as the upload path stores it.
  PERFORM pg_temp.as_user((SELECT user_id FROM public.chamber_sessions WHERE id = uploaded), true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, category)
  SELECT user_id, id, 'census.csv', '1 KB', user_id || '/' || id || '/census.csv', 'employee_census'
  FROM public.chamber_sessions WHERE id = uploaded;
  RESET ROLE;

  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at)
  VALUES (advisor, 'authenticated', 'authenticated', 'adv@example.test', false, now(), now());
  INSERT INTO public.user_roles (user_id, role) VALUES (advisor, 'advisor');
  PERFORM pg_temp.as_user(advisor, false);
  SET LOCAL ROLE authenticated;
  SELECT array_agg(q.session_id), max(q.total_count) INTO listed, total FROM public.advisor_list_submissions() q;
  RESET ROLE;

  IF listed && hidden THEN
    RAISE EXCEPTION 'FAIL: the queue listed an empty guest draft: %', ARRAY(SELECT unnest(listed) INTERSECT SELECT unnest(hidden));
  END IF;
  IF NOT listed @> kept THEN
    RAISE EXCEPTION 'FAIL: the queue left out an intake the prospect did something in: %', ARRAY(SELECT unnest(kept) EXCEPT SELECT unnest(listed));
  END IF;
  IF total <> cardinality(kept) OR cardinality(listed) <> cardinality(kept) THEN
    RAISE EXCEPTION 'FAIL: the queue counted % (listed %), expected %', total, cardinality(listed), cardinality(kept);
  END IF;

  -- The rows are hidden from the queue, not changed: the intake is still there for the advisor to open.
  PERFORM pg_temp.as_user(advisor, false);
  SET LOCAL ROLE authenticated;
  IF (SELECT count(*) FROM public.chamber_sessions WHERE id = ANY (hidden)) <> 2 THEN RAISE EXCEPTION 'FAIL: an advisor can''t read a hidden draft'; END IF;
  -- Once the guest says something, the draft is listed.
  RESET ROLE;
  PERFORM pg_temp.as_user((SELECT user_id FROM public.chamber_sessions WHERE id = greeted), true);
  SET LOCAL ROLE authenticated;
  UPDATE public.chamber_sessions SET transcript = transcript || '[{"id":"u2","sender":"user","text":"We have 12 staff"}]' WHERE id = greeted;
  PERFORM pg_temp.as_user(advisor, false);
  IF NOT EXISTS (SELECT 1 FROM public.advisor_list_submissions() WHERE session_id = greeted) THEN
    RAISE EXCEPTION 'FAIL: a draft stayed hidden after the guest wrote';
  END IF;
  -- The helper is the database's own: API roles can't call it.
  BEGIN
    PERFORM public.intake_holds_nothing('{}', '{}', '[]', NULL);
    RAISE EXCEPTION 'FAIL: an advisor called intake_holds_nothing';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', false);
  RAISE NOTICE 'queue_empty_guest_drafts: all cases passed';
END $$;
