-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh peo_census_templates
-- A PEO template workbook (joshrkay/Nevermore#91, L-3.1, 20261114090000_peo_census_templates.sql): an upload like
-- any other (docs/adr/0002). An admin's upload is recorded pending, and only the service role (census-template-upload,
-- after the malware scan) records it clean, blocked or failed, once. A census layout names a template of its own PEO,
-- and a version that names one is published only once that template is clean. Advisors read the templates' records;
-- anyone signed in reads a clean template's file, and nobody but the service role reads the quarantine.
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
\i supabase/migrations/20261106100000_intake_sources.sql
\i supabase/migrations/20261107090000_intake_consent_v2.sql
\i supabase/migrations/20261109090000_packet_error_messages.sql
\i supabase/migrations/20261110090000_quote_requests.sql
\i supabase/migrations/20261111090000_peo_requirement_profiles.sql
\i supabase/migrations/20261111100000_peo_profile_editor.sql
\i supabase/migrations/20261112090000_peo_industry_class_codes.sql
\i supabase/migrations/20261113090000_extra_answers.sql
\i supabase/migrations/20261113100000_information_request_extra_questions.sql
\i supabase/migrations/20261114090000_peo_census_templates.sql
SET client_min_messages = notice;

-- ---------- helpers ----------
CREATE FUNCTION pg_temp.as_user(uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', uid, 'is_anonymous', false, 'role', 'authenticated', 'email', uid || '@example.test')::text, false);
END $$;

CREATE FUNCTION pg_temp.new_user(role text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', uid || '@example.test', false, now(), now());
  IF role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (uid, role::public.app_role);
  END IF;
  RETURN uid;
END $$;

-- Runs stmt as `who` (the service role for 'service') and returns its single value as jsonb.
CREATE FUNCTION pg_temp.run(who uuid, stmt text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb;
BEGIN
  PERFORM pg_temp.as_user(who);
  SET LOCAL ROLE authenticated;
  EXECUTE stmt INTO result;
  RESET ROLE;
  RETURN result;
END $$;

-- 'ok', or the SQLSTATE stmt raised, run as `who` (as the service role when who is null).
CREATE FUNCTION pg_temp.try(who uuid, stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE s text;
BEGIN
  IF who IS NULL THEN
    SET LOCAL ROLE service_role;
  ELSE
    PERFORM pg_temp.as_user(who);
    SET LOCAL ROLE authenticated;
  END IF;
  BEGIN
    EXECUTE stmt;
    RESET ROLE;
    RETURN 'ok';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE;
  END;
  RESET ROLE;
  RETURN s;
END $$;

-- How many rows of `rel` (a table or a WHERE clause on one) `who` sees.
CREATE FUNCTION pg_temp.visible(who uuid, rel text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  PERFORM pg_temp.as_user(who);
  SET LOCAL ROLE authenticated;
  EXECUTE 'SELECT count(*) FROM ' || rel INTO n;
  RESET ROLE;
  RETURN n;
END $$;

CREATE FUNCTION pg_temp.peo(name text) RETURNS bigint LANGUAGE sql AS $$
  SELECT id FROM public.peos WHERE peos.name = peo.name;
$$;

-- An admin's upload, as census-template-upload records it before the scan: the new row's id and storage path.
CREATE FUNCTION pg_temp.register(who uuid, peo bigint, file_name text DEFAULT 'TriNet census template.xlsx') RETURNS jsonb LANGUAGE sql AS $$
  SELECT pg_temp.run(who, format('SELECT public.admin_register_census_template(%s, %L, %s, %L)', peo, file_name, 2048, repeat('a', 64)));
$$;

CREATE FUNCTION pg_temp.scanned(id bigint, verdict text, signature text DEFAULT NULL) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.try(NULL, format('SELECT public.record_census_template_scan(%s, %L, %L)', id, verdict, signature));
$$;

-- A census layout filling template `id`.
CREATE FUNCTION pg_temp.layout(id bigint) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('format', 'xlsx', 'template_file', jsonb_build_object('id', id, 'sheet', 'Census', 'header_row', 3, 'first_row', 4),
    'columns', '[{"header": "Last Name", "from": "last_name"}, {"header": "Employee ID", "from": null}]'::jsonb);
$$;

CREATE FUNCTION pg_temp.save_sql(peo bigint, layout jsonb) RETURNS text LANGUAGE sql AS $$
  SELECT format('SELECT public.admin_save_peo_profile(%s, %L, %L, %L)', peo,
    jsonb_build_object('census_layout', layout, 'sources', jsonb_build_object('census_layout',
      '{"kind":"document","name":"Broker guide 2026","checked_on":"2026-11-01"}'::jsonb)),
    (SELECT revision FROM public.peo_profile_versions WHERE peo_id = peo AND status = 'draft'),
    (SELECT max(version) FROM public.peo_profile_versions WHERE peo_id = peo AND status = 'published'));
$$;

CREATE FUNCTION pg_temp.publish_sql(peo bigint) RETURNS text LANGUAGE sql AS $$
  SELECT format('SELECT public.admin_publish_peo_profile(%s, %L)', peo, (SELECT revision FROM public.peo_profile_versions WHERE peo_id = peo AND status = 'draft'));
$$;

-- ---------- Uploading: admins only, recorded pending ----------
DO $$
DECLARE
  admin uuid := pg_temp.new_user('admin');
  advisor uuid := pg_temp.new_user('advisor');
  prospect uuid := pg_temp.new_user();
  trinet bigint := pg_temp.peo('TriNet');
  added jsonb;
  t public.peo_census_templates;
BEGIN
  IF pg_temp.try(advisor, format('SELECT public.admin_register_census_template(%s, %L, 1, %L)', trinet, 'x.xlsx', repeat('a', 64))) <> '42501'
     OR pg_temp.try(prospect, format('SELECT public.admin_register_census_template(%s, %L, 1, %L)', trinet, 'x.xlsx', repeat('a', 64))) <> '42501' THEN
    RAISE EXCEPTION 'FAIL: someone but an admin registered a template';
  END IF;
  IF pg_temp.try(admin, format('SELECT public.admin_register_census_template(%s, %L, 1, %L)', 999999, 'x.xlsx', repeat('a', 64))) <> 'P0002' THEN
    RAISE EXCEPTION 'FAIL: a template for a PEO that isn''t there';
  END IF;
  IF pg_temp.try(admin, format('SELECT public.admin_register_census_template(%s, %L, 1, %L)', trinet, ' ', repeat('a', 64))) <> '22023'
     OR pg_temp.try(admin, format('SELECT public.admin_register_census_template(%s, %L, 1, %L)', trinet, repeat('x', 301), repeat('a', 64))) <> '22023'
     OR pg_temp.try(admin, format('SELECT public.admin_register_census_template(%s, %L, 1, %L)', trinet, 'x.xlsx', 'not a hash')) <> '22023'
     OR pg_temp.try(admin, format('SELECT public.admin_register_census_template(%s, %L, 0, %L)', trinet, 'x.xlsx', repeat('a', 64))) <> '22023' THEN
    RAISE EXCEPTION 'FAIL: a template with no name, too long a name, no hash or no bytes was registered';
  END IF;

  added := pg_temp.register(admin, trinet);
  SELECT * INTO t FROM public.peo_census_templates WHERE id = (added ->> 'id')::bigint;
  IF t.peo_id <> trinet OR t.scan_status <> 'pending' OR t.file_name <> 'TriNet census template.xlsx' OR t.uploaded_by <> admin
     OR added ->> 'storage_path' <> trinet || '/' || t.id || '.xlsx' OR t.storage_path <> added ->> 'storage_path' THEN
    RAISE EXCEPTION 'FAIL: the template was recorded as % (answer %)', to_jsonb(t), added;
  END IF;

  -- Nobody writes the table directly, not even an admin.
  IF pg_temp.try(admin, format('UPDATE public.peo_census_templates SET scan_status = %L WHERE id = %s', 'clean', t.id)) <> '42501' THEN
    RAISE EXCEPTION 'FAIL: an admin marked a template clean';
  END IF;
  IF pg_temp.try(admin, format('INSERT INTO public.peo_census_templates (peo_id, file_name, size_bytes, file_sha256, storage_path) VALUES (%s, %L, 1, %L, %L)', trinet, 'y.xlsx', repeat('b', 64), 'y')) <> '42501' THEN
    RAISE EXCEPTION 'FAIL: an admin inserted a template row directly';
  END IF;

  -- Advisors read the records; prospects don't.
  IF pg_temp.visible(advisor, 'public.peo_census_templates') <> 1 OR pg_temp.visible(prospect, 'public.peo_census_templates') <> 0 THEN
    RAISE EXCEPTION 'FAIL: who reads the templates'' records';
  END IF;
  RAISE NOTICE 'peo_census_templates: registered by admins only, pending until scanned';
END $$;

-- ---------- The scan: the service role, once ----------
DO $$
DECLARE
  admin uuid := pg_temp.new_user('admin');
  trinet bigint := pg_temp.peo('TriNet');
  clean bigint := (pg_temp.register(admin, trinet) ->> 'id')::bigint;
  blocked bigint := (pg_temp.register(admin, trinet) ->> 'id')::bigint;
BEGIN
  IF pg_temp.try(admin, format('SELECT public.record_census_template_scan(%s, %L, NULL)', clean, 'clean')) <> '42501' THEN
    RAISE EXCEPTION 'FAIL: an admin recorded a scan';
  END IF;
  IF pg_temp.scanned(clean, 'great') <> '22023' OR pg_temp.scanned(clean, 'clean', 'EICAR') <> '22023' OR pg_temp.scanned(blocked, 'blocked') <> '22023' THEN
    RAISE EXCEPTION 'FAIL: a verdict that isn''t one, a signature on a clean file, or a block with no signature was recorded';
  END IF;
  IF pg_temp.scanned(clean, 'clean') <> 'ok' OR pg_temp.scanned(blocked, 'blocked', 'Eicar-Test-Signature') <> 'ok' THEN
    RAISE EXCEPTION 'FAIL: the scans weren''t recorded';
  END IF;
  -- Once only: a clean template stays clean, a blocked one blocked.
  IF pg_temp.scanned(clean, 'blocked', 'X') <> '22023' OR pg_temp.scanned(blocked, 'clean') <> '22023' THEN
    RAISE EXCEPTION 'FAIL: a scan was recorded twice';
  END IF;
  IF (SELECT scan_status || '/' || COALESCE(scan_signature, '-') FROM public.peo_census_templates WHERE id = blocked) <> 'blocked/Eicar-Test-Signature'
     OR (SELECT scanned_at FROM public.peo_census_templates WHERE id = clean) IS NULL THEN
    RAISE EXCEPTION 'FAIL: the scans read %', (SELECT jsonb_agg(t) FROM public.peo_census_templates t);
  END IF;
  -- A record is kept for good, as the profile versions that name it are: not even the service role deletes or edits one.
  IF pg_temp.try(NULL, format('DELETE FROM public.peo_census_templates WHERE id = %s', (pg_temp.register(admin, trinet) ->> 'id')::bigint)) <> '42501'
     OR pg_temp.try(NULL, format('DELETE FROM public.peo_census_templates WHERE id = %s', clean)) <> '42501'
     OR pg_temp.try(NULL, format('UPDATE public.peo_census_templates SET file_name = %L WHERE id = %s', 'other.xlsx', clean)) = 'ok' THEN
    RAISE EXCEPTION 'FAIL: a template record was deleted or edited';
  END IF;
  RAISE NOTICE 'peo_census_templates: the scan is recorded once, by the service role';
END $$;

-- ---------- A layout names its own PEO's template, published only once clean ----------
DO $$
DECLARE
  admin uuid := pg_temp.new_user('admin');
  trinet bigint := pg_temp.peo('TriNet');
  justworks bigint := pg_temp.peo('Justworks');
  theirs bigint := (pg_temp.register(admin, justworks) ->> 'id')::bigint;
  pending bigint := (pg_temp.register(admin, trinet) ->> 'id')::bigint;
  failed bigint := (pg_temp.register(admin, trinet) ->> 'id')::bigint;
  clean bigint := (pg_temp.register(admin, trinet) ->> 'id')::bigint;
BEGIN
  PERFORM pg_temp.scanned(failed, 'failed');
  PERFORM pg_temp.scanned(clean, 'clean');
  PERFORM pg_temp.scanned(theirs, 'clean');
  IF pg_temp.try(admin, pg_temp.save_sql(trinet, pg_temp.layout(theirs))) <> '22023' THEN RAISE EXCEPTION 'FAIL: another PEO''s template was saved'; END IF;
  IF pg_temp.try(admin, pg_temp.save_sql(trinet, pg_temp.layout(424242))) <> '22023' THEN RAISE EXCEPTION 'FAIL: a template that isn''t there was saved'; END IF;

  -- A draft can name one still being checked; publishing waits for it to be clean.
  IF pg_temp.try(admin, pg_temp.save_sql(trinet, pg_temp.layout(pending))) <> 'ok' THEN RAISE EXCEPTION 'FAIL: a pending template couldn''t be saved in a draft'; END IF;
  IF pg_temp.try(admin, pg_temp.publish_sql(trinet)) <> '22023' THEN RAISE EXCEPTION 'FAIL: a version was published with its template still being checked'; END IF;
  IF pg_temp.try(admin, pg_temp.save_sql(trinet, pg_temp.layout(failed))) <> 'ok' OR pg_temp.try(admin, pg_temp.publish_sql(trinet)) <> '22023' THEN
    RAISE EXCEPTION 'FAIL: a version was published with a template that couldn''t be checked';
  END IF;
  IF pg_temp.try(admin, pg_temp.save_sql(trinet, pg_temp.layout(clean))) <> 'ok' OR pg_temp.try(admin, pg_temp.publish_sql(trinet)) <> 'ok' THEN
    RAISE EXCEPTION 'FAIL: a version with a clean template wasn''t published';
  END IF;
  IF (SELECT census_layout #>> '{template_file,id}' FROM public.peo_profile_versions WHERE peo_id = trinet AND status = 'published') <> clean::text THEN
    RAISE EXCEPTION 'FAIL: the published layout doesn''t name its template';
  END IF;
  RAISE NOTICE 'peo_census_templates: a layout names its own PEO''s template, published once clean';
END $$;

-- ---------- The files: a clean template is read by anyone signed in; the quarantine by nobody ----------
DO $$
DECLARE
  admin uuid := pg_temp.new_user('admin');
  prospect uuid := pg_temp.new_user();
  trinet bigint := pg_temp.peo('TriNet');
  clean jsonb := pg_temp.register(admin, trinet);
  pending jsonb := pg_temp.register(admin, trinet);
BEGIN
  PERFORM pg_temp.scanned((clean ->> 'id')::bigint, 'clean');
  INSERT INTO storage.objects (bucket_id, name) VALUES ('peo-templates', clean ->> 'storage_path'), ('peo-templates', pending ->> 'storage_path'),
    ('quarantine', 'templates/' || (pending ->> 'storage_path'));
  IF pg_temp.visible(prospect, format('storage.objects WHERE bucket_id = %L AND name = %L', 'peo-templates', clean ->> 'storage_path')) <> 1 THEN
    RAISE EXCEPTION 'FAIL: a signed-in reader can''t read a clean template';
  END IF;
  IF pg_temp.visible(admin, format('storage.objects WHERE bucket_id = %L AND name = %L', 'peo-templates', pending ->> 'storage_path')) <> 0
     OR pg_temp.visible(admin, 'storage.objects WHERE bucket_id = ''quarantine''') <> 0 THEN
    RAISE EXCEPTION 'FAIL: a template not yet clean, or the quarantine, can be read';
  END IF;
  IF pg_temp.try(admin, format('INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)', 'peo-templates', trinet || '/99.xlsx')) <> '42501' THEN
    RAISE EXCEPTION 'FAIL: an admin stored a template file directly';
  END IF;
  RAISE NOTICE 'peo_census_templates: only a clean template''s file is read';

  -- Where a clean template workbook's file is, for anyone signed in to read it (the browser never builds the path):
  -- only a clean one, and only under the PEO it belongs to.
  IF pg_temp.run(prospect, format('SELECT to_jsonb(public.clean_template_workbook_path(%s, %s))', trinet, clean ->> 'id')) <> to_jsonb(clean ->> 'storage_path') THEN
    RAISE EXCEPTION 'FAIL: a clean template workbook''s path wasn''t given';
  END IF;
  IF pg_temp.run(prospect, format('SELECT to_jsonb(public.clean_template_workbook_path(%s, %s))', trinet, pending ->> 'id')) <> 'null'::jsonb
     OR pg_temp.run(prospect, format('SELECT to_jsonb(public.clean_template_workbook_path(%s, %s))', pg_temp.peo('Justworks'), clean ->> 'id')) <> 'null'::jsonb THEN
    RAISE EXCEPTION 'FAIL: the path of a template workbook not clean, or under another PEO, was given';
  END IF;
  IF pg_temp.try(NULL, 'SET LOCAL ROLE anon; SELECT public.clean_template_workbook_path(1, 1)') <> '42501' THEN
    RAISE EXCEPTION 'FAIL: someone not signed in was given a template workbook''s path';
  END IF;
  RAISE NOTICE 'peo_census_templates: a clean template workbook''s path, from the database alone';
END $$;

DO $$ BEGIN RAISE NOTICE 'peo_census_templates: all cases passed'; END $$;
