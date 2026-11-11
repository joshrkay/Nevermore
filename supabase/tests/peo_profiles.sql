-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh peo_profiles
-- PEOs and their requirement profiles (joshrkay/Nevermore#91, L-1.1, 20261111090000_peo_requirement_profiles.sql):
-- each PEO's ask is dated, versioned data. Admins write a draft and publish it; a published version is never
-- changed; a profile that breaks the shape can't be stored. Advisors read the published versions and contacts;
-- prospects read only peo_catalog(), which names no person at the PEO and no admin.
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
SET client_min_messages = notice;

-- ---------- helpers ----------
CREATE FUNCTION pg_temp.as_user(uid uuid, guest boolean DEFAULT false) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', uid, 'is_anonymous', guest, 'role', 'authenticated', 'email', uid || '@example.test')::text, false);
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

-- Runs stmt as `who` (signed out when null) and returns its single value as jsonb.
CREATE FUNCTION pg_temp.run(who uuid, stmt text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb;
BEGIN
  IF who IS NULL THEN
    PERFORM set_config('request.jwt.claims', '', false);
    SET LOCAL ROLE anon;
  ELSE
    PERFORM pg_temp.as_user(who);
    SET LOCAL ROLE authenticated;
  END IF;
  EXECUTE stmt INTO result;
  RESET ROLE;
  RETURN result;
END $$;

-- Fails the run unless stmt, run as `who` (the table owner when null), raises exactly `state`.
CREATE FUNCTION pg_temp.must_raise(who uuid, stmt text, state text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE raised text := NULL;
BEGIN
  IF who IS NOT NULL THEN
    PERFORM pg_temp.as_user(who);
    SET LOCAL ROLE authenticated;
  END IF;
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    raised := SQLSTATE;
  END;
  RESET ROLE;
  IF raised IS NULL THEN RAISE EXCEPTION 'FAIL: % was allowed', label; END IF;
  IF raised <> state THEN RAISE EXCEPTION 'FAIL: % raised % instead of %', label, raised, state; END IF;
END $$;

CREATE FUNCTION pg_temp.peo(name text) RETURNS bigint LANGUAGE sql AS $$
  SELECT id FROM public.peos WHERE peos.name = peo.name;
$$;

-- ---------- The five PEOs ----------
DO $$
DECLARE
  prospect uuid := pg_temp.new_user();
  catalog jsonb;
BEGIN
  -- The PEOs the app offered before profiles, alphabetically, each with an empty draft and nothing published:
  -- no fact about a PEO is guessed.
  catalog := pg_temp.run(prospect, 'SELECT public.peo_catalog()');
  IF catalog IS DISTINCT FROM jsonb_build_array(
    jsonb_build_object('id', pg_temp.peo('ADP TotalSource'), 'name', 'ADP TotalSource', 'listed', true, 'profile', NULL),
    jsonb_build_object('id', pg_temp.peo('Insperity'), 'name', 'Insperity', 'listed', true, 'profile', NULL),
    jsonb_build_object('id', pg_temp.peo('Justworks'), 'name', 'Justworks', 'listed', true, 'profile', NULL),
    jsonb_build_object('id', pg_temp.peo('Rippling'), 'name', 'Rippling', 'listed', true, 'profile', NULL),
    jsonb_build_object('id', pg_temp.peo('TriNet'), 'name', 'TriNet', 'listed', true, 'profile', NULL)
  ) THEN
    RAISE EXCEPTION 'FAIL: the catalog a prospect reads is %', catalog;
  END IF;
  IF (SELECT count(*) FROM public.peo_profile_versions v WHERE v.status = 'draft' AND v.version = 1
        AND v.needed_to_quote = '{}' AND v.needed_before_signing = '{}' AND v.census_layout IS NULL AND v.documents = '[]'
        AND v.min_headcount IS NULL AND v.states_served IS NULL AND v.excluded_industries IS NULL
        AND v.excluded_class_codes IS NULL AND v.min_enrolment_percent IS NULL AND v.extra_questions = '[]'
        AND v.sources = '{}') <> 5
     OR (SELECT count(*) FROM public.peo_profile_versions) <> 5 THEN
    RAISE EXCEPTION 'FAIL: the five PEOs don''t each start with one empty draft: %', (SELECT jsonb_agg(v) FROM public.peo_profile_versions v);
  END IF;
  RAISE NOTICE 'peo_profiles: seed cases passed';
END $$;

-- Sources: a named person at the PEO with their role, or a document by title with a link when there is one; each
-- with the date it was checked.
CREATE FUNCTION pg_temp.person(checked text DEFAULT '2026-11-02') RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('kind', 'person', 'name', 'Dana Reyes', 'role', 'Broker desk manager', 'checked_on', checked);
$$;
CREATE FUNCTION pg_temp.guide(checked text DEFAULT '2026-10-20') RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('kind', 'document', 'name', 'Broker guide 2026', 'link', 'https://trinet.example/guide.pdf', 'checked_on', checked);
$$;

-- A full profile, as the editor would send it: every rule and every section with its own source and date.
CREATE FUNCTION pg_temp.full_profile() RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'needed_to_quote', jsonb_build_array('company_name', 'states', 'census'),
    'needed_before_signing', jsonb_build_array('payroll_vendor'),
    'census_layout', jsonb_build_object('format', 'xlsx', 'template_file', NULL, 'columns', jsonb_build_array(
      jsonb_build_object('header', 'Last Name', 'from', 'last_name'),
      jsonb_build_object('header', 'First Name', 'from', 'first_name'),
      jsonb_build_object('header', 'SSN', 'from', NULL))),
    'documents', jsonb_build_array(jsonb_build_object('category', 'workers_comp_loss_runs', 'description', 'Three years of loss runs')),
    'min_headcount', 5,
    'states_served', jsonb_build_array('CA', 'NY'),
    'excluded_industries', jsonb_build_array('Trucking'),
    'excluded_class_codes', jsonb_build_array('7219'),
    'min_enrolment_percent', 75,
    'extra_questions', jsonb_build_array(
      jsonb_build_object('key', 'uses_drivers', 'text', 'Do any employees drive for work?', 'kind', 'yes_no'),
      jsonb_build_object('key', 'union', 'text', 'Which union?', 'kind', 'choice', 'choices', jsonb_build_array('None', 'Teamsters'))),
    'sources', jsonb_build_object(
      'answers', pg_temp.person(), 'census_layout', pg_temp.guide(), 'documents', pg_temp.guide(),
      'extra_questions', pg_temp.person(), 'contacts', pg_temp.person(),
      'min_headcount', pg_temp.person(), 'states_served', pg_temp.guide(), 'excluded_industries', pg_temp.guide('2026-09-01'),
      'excluded_class_codes', pg_temp.guide(), 'min_enrolment_percent', pg_temp.person()),
    'contacts', jsonb_build_array(jsonb_build_object('name', 'Dana Reyes', 'role', 'Broker desk', 'email', 'dana@trinet.example', 'phone', '555-0100')));
$$;

-- Saves and publishes as an editor opened just now would: based on the PEO's draft (its revision) and the version
-- in use as they stand (20261111090000 refuses anything else; supabase/tests/peo_profile_editor.sql tests that).
CREATE FUNCTION pg_temp.draft_revision(peo bigint) RETURNS uuid LANGUAGE sql AS $$
  SELECT revision FROM public.peo_profile_versions WHERE peo_id = peo AND status = 'draft';
$$;
CREATE FUNCTION pg_temp.save_sql(peo bigint, profile jsonb) RETURNS text LANGUAGE sql AS $$
  SELECT format('SELECT public.admin_save_peo_profile(%s, %L, %L, %L)', peo, profile, pg_temp.draft_revision(peo),
    (SELECT max(version) FROM public.peo_profile_versions WHERE peo_id = peo AND status = 'published'));
$$;
CREATE FUNCTION pg_temp.publish_sql(peo bigint) RETURNS text LANGUAGE sql AS $$
  SELECT format('SELECT public.admin_publish_peo_profile(%s, %L)', peo, pg_temp.draft_revision(peo));
$$;

CREATE FUNCTION pg_temp.save(who uuid, peo bigint, profile jsonb) RETURNS jsonb LANGUAGE sql AS $$
  SELECT pg_temp.run(who, pg_temp.save_sql(peo, profile));
$$;

CREATE FUNCTION pg_temp.publish(who uuid, peo bigint) RETURNS jsonb LANGUAGE sql AS $$
  SELECT pg_temp.run(who, pg_temp.publish_sql(peo));
$$;

-- ---------- Writing and publishing ----------
DO $$
DECLARE
  admin uuid := pg_temp.new_user('admin');
  advisor uuid := pg_temp.new_user('advisor');
  prospect uuid := pg_temp.new_user();
  trinet bigint := pg_temp.peo('TriNet');
  saved jsonb;
  v public.peo_profile_versions;
  profile jsonb;
BEGIN
  -- An admin saves TriNet's draft: its one draft, version 1, takes the profile.
  saved := pg_temp.save(admin, trinet, pg_temp.full_profile());
  SELECT * INTO v FROM public.peo_profile_versions WHERE id = (saved ->> 'id')::bigint;
  IF v.peo_id <> trinet OR v.version <> 1 OR v.status <> 'draft'
     OR v.needed_to_quote <> ARRAY['company_name', 'states', 'census'] OR v.needed_before_signing <> ARRAY['payroll_vendor']
     OR v.census_layout <> pg_temp.full_profile() -> 'census_layout' OR v.documents <> pg_temp.full_profile() -> 'documents'
     OR v.min_headcount <> 5 OR v.states_served <> ARRAY['CA', 'NY'] OR v.excluded_industries <> ARRAY['Trucking']
     OR v.excluded_class_codes <> ARRAY['7219'] OR v.min_enrolment_percent <> 75
     OR v.extra_questions <> pg_temp.full_profile() -> 'extra_questions'
     OR v.sources <> pg_temp.full_profile() -> 'sources'
     OR v.created_by IS DISTINCT FROM admin THEN
    RAISE EXCEPTION 'FAIL: the draft was saved as %', to_jsonb(v);
  END IF;
  IF (SELECT count(*) FROM public.peo_profile_versions WHERE peo_id = trinet) <> 1 THEN
    RAISE EXCEPTION 'FAIL: saving the draft made another version';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.peo_contacts c WHERE c.profile_version_id = v.id AND c.name = 'Dana Reyes'
                   AND c.role = 'Broker desk' AND c.email = 'dana@trinet.example' AND c.phone = '555-0100') THEN
    RAISE EXCEPTION 'FAIL: the draft''s contact wasn''t saved: %', (SELECT jsonb_agg(c) FROM public.peo_contacts c);
  END IF;

  -- A draft isn't in use: prospects and advisors don't see it yet.
  IF pg_temp.run(prospect, format('SELECT p -> ''profile'' FROM jsonb_array_elements(public.peo_catalog()) p WHERE p ->> ''name'' = %L', 'TriNet')) <> 'null'::jsonb THEN
    RAISE EXCEPTION 'FAIL: a prospect reads a draft';
  END IF;

  -- Publishing puts it in use, for everyone signed in.
  PERFORM pg_temp.publish(admin, trinet);
  SELECT * INTO v FROM public.peo_profile_versions WHERE id = v.id;
  IF v.status <> 'published' OR v.published_at IS NULL OR v.published_by IS DISTINCT FROM admin THEN
    RAISE EXCEPTION 'FAIL: publishing left %', to_jsonb(v);
  END IF;
  profile := pg_temp.run(prospect, format('SELECT p -> ''profile'' FROM jsonb_array_elements(public.peo_catalog()) p WHERE p ->> ''name'' = %L', 'TriNet'));
  -- A prospect reads a person at the PEO as their role and the date only, never their name; never the contacts or
  -- their source, and never which admin wrote or published it.
  IF profile ->> 'version' <> '1' OR profile ->> 'min_headcount' <> '5' OR profile -> 'states_served' <> '["CA", "NY"]'
     OR profile -> 'sources' -> 'min_headcount' <> jsonb_build_object('kind', 'person', 'role', 'Broker desk manager', 'checked_on', '2026-11-02')
     OR profile -> 'sources' -> 'excluded_industries' <> pg_temp.guide('2026-09-01')
     OR profile ? 'contacts' OR profile -> 'sources' ? 'contacts'
     OR profile ? 'created_by' OR profile ? 'published_by' OR profile::text LIKE '%Dana Reyes%' OR profile::text LIKE '%' || admin || '%' THEN
    RAISE EXCEPTION 'FAIL: a prospect reads the profile in use as %', profile;
  END IF;
  -- An advisor reads the person's name too, and the contacts' source; still no admin ids.
  profile := pg_temp.run(advisor, format('SELECT p -> ''profile'' FROM jsonb_array_elements(public.peo_catalog()) p WHERE p ->> ''name'' = %L', 'TriNet'));
  IF profile -> 'sources' -> 'min_headcount' <> pg_temp.person() OR profile -> 'sources' -> 'contacts' <> pg_temp.person()
     OR profile ? 'created_by' OR profile ? 'published_by' THEN
    RAISE EXCEPTION 'FAIL: an advisor reads the profile in use as %', profile;
  END IF;

  -- Only admins write: an advisor or a prospect is refused, and nobody writes the tables directly.
  PERFORM pg_temp.must_raise(advisor, pg_temp.save_sql(trinet, '{}'), '42501', 'an advisor saving a profile');
  PERFORM pg_temp.must_raise(prospect, pg_temp.save_sql(trinet, '{}'), '42501', 'a prospect saving a profile');
  PERFORM pg_temp.must_raise(advisor, pg_temp.publish_sql(trinet), '42501', 'an advisor publishing');
  PERFORM pg_temp.must_raise(advisor, 'SELECT public.admin_add_peo(''Acme PEO'')', '42501', 'an advisor adding a PEO');
  PERFORM pg_temp.must_raise(admin, 'INSERT INTO public.peos (name) VALUES (''Acme PEO'')', '42501', 'an admin writing a PEO directly');
  PERFORM pg_temp.must_raise(admin, format('UPDATE public.peo_profile_versions SET min_headcount = 1 WHERE peo_id = %s', trinet), '42501', 'an admin writing a profile directly');
  PERFORM pg_temp.must_raise(admin, 'DELETE FROM public.peo_contacts', '42501', 'an admin writing a contact directly');
  RAISE NOTICE 'peo_profiles: writing cases passed';
END $$;

-- ---------- A published version never changes ----------
DO $$
DECLARE
  admin uuid := pg_temp.new_user('admin');
  prospect uuid := pg_temp.new_user();
  trinet bigint := pg_temp.peo('TriNet');
  v1 bigint := (SELECT id FROM public.peo_profile_versions WHERE peo_id = pg_temp.peo('TriNet') AND version = 1);
  saved jsonb;
  profile jsonb;
BEGIN
  -- Not by the table's owner, either: the database refuses it, whoever writes.
  PERFORM pg_temp.must_raise(NULL, format('UPDATE public.peo_profile_versions SET min_headcount = 50 WHERE id = %s', v1), '55000', 'editing a published version');
  PERFORM pg_temp.must_raise(NULL, format('UPDATE public.peo_profile_versions SET status = ''draft'' WHERE id = %s', v1), '55000', 'unpublishing a version');
  PERFORM pg_temp.must_raise(NULL, format('DELETE FROM public.peo_profile_versions WHERE id = %s', v1), '55000', 'deleting a published version');
  PERFORM pg_temp.must_raise(NULL, format('UPDATE public.peo_contacts SET email = ''x@y.example'' WHERE profile_version_id = %s', v1), '55000', 'editing a published version''s contact');
  PERFORM pg_temp.must_raise(NULL, format('DELETE FROM public.peo_contacts WHERE profile_version_id = %s', v1), '55000', 'removing a published version''s contact');
  PERFORM pg_temp.must_raise(NULL, format('INSERT INTO public.peo_contacts (profile_version_id, position, name) VALUES (%s, 9, ''Added Later'')', v1), '55000', 'adding a contact to a published version');

  -- A change is a new version: saving again makes version 2, a draft, and version 1 stays in use until it is published.
  saved := pg_temp.save(admin, trinet, pg_temp.full_profile() || jsonb_build_object('min_headcount', 10,
    'sources', pg_temp.full_profile() -> 'sources' || jsonb_build_object('min_headcount', pg_temp.person('2026-11-09'))));
  IF (saved ->> 'version')::int <> 2 OR saved ->> 'status' <> 'draft' OR (saved ->> 'id')::bigint = v1 THEN
    RAISE EXCEPTION 'FAIL: a change after publishing saved as %', saved;
  END IF;
  IF (SELECT min_headcount FROM public.peo_profile_versions WHERE id = v1) <> 5 THEN
    RAISE EXCEPTION 'FAIL: the change reached the published version';
  END IF;
  profile := pg_temp.run(prospect, 'SELECT p -> ''profile'' FROM jsonb_array_elements(public.peo_catalog()) p WHERE p ->> ''name'' = ''TriNet''');
  IF profile ->> 'version' <> '1' THEN RAISE EXCEPTION 'FAIL: the draft went into use before it was published: %', profile; END IF;
  -- Not even for the admin, who can read the draft.
  profile := pg_temp.run(admin, 'SELECT p -> ''profile'' FROM jsonb_array_elements(public.peo_catalog()) p WHERE p ->> ''name'' = ''TriNet''');
  IF profile ->> 'version' <> '1' THEN RAISE EXCEPTION 'FAIL: the admin''s catalog puts the draft in use: %', profile; END IF;

  PERFORM pg_temp.publish(admin, trinet);
  profile := pg_temp.run(prospect, 'SELECT p -> ''profile'' FROM jsonb_array_elements(public.peo_catalog()) p WHERE p ->> ''name'' = ''TriNet''');
  IF profile ->> 'version' <> '2' OR profile ->> 'min_headcount' <> '10' OR profile -> 'sources' -> 'min_headcount' ->> 'checked_on' <> '2026-11-09' THEN
    RAISE EXCEPTION 'FAIL: the newest published version isn''t the one in use: %', profile;
  END IF;
  -- With no draft left, there is nothing to publish.
  PERFORM pg_temp.must_raise(admin, pg_temp.publish_sql(trinet), 'PT404', 'publishing with no draft');
  -- A draft can still be changed and dropped: it was never used. Whoever saves it, it keeps the admin who started it.
  PERFORM pg_temp.save(admin, trinet, '{}');
  PERFORM pg_temp.save(pg_temp.new_user('admin'), trinet, '{}');
  IF (SELECT created_by FROM public.peo_profile_versions WHERE peo_id = trinet AND status = 'draft') IS DISTINCT FROM admin THEN
    RAISE EXCEPTION 'FAIL: another admin''s save took over the draft''s creator';
  END IF;
  DELETE FROM public.peo_profile_versions WHERE peo_id = trinet AND status = 'draft';
  RAISE NOTICE 'peo_profiles: frozen version cases passed';
END $$;

-- ---------- A bad profile can't be stored ----------
DO $$
DECLARE
  admin uuid := pg_temp.new_user('admin');
  justworks bigint := pg_temp.peo('Justworks');
  bad record;
  cases integer := 0;
  cols jsonb;
  qs jsonb;
BEGIN
  -- 201 columns and 31 questions: one past each cap.
  SELECT jsonb_agg(jsonb_build_object('header', 'Column ' || i, 'from', NULL)) INTO cols FROM generate_series(1, 201) i;
  SELECT jsonb_agg(jsonb_build_object('key', 'q' || i, 'text', 'Question ' || i, 'kind', 'text')) INTO qs FROM generate_series(1, 31) i;
  FOR bad IN SELECT * FROM (VALUES
    ('an unknown part', '{"rating": 5}'::jsonb),
    ('an answer that isn''t an intake field', '{"needed_to_quote": ["favourite_colour"]}'),
    ('the roster''s old name', '{"needed_to_quote": ["employees"]}'),
    ('an answer listed twice', '{"needed_to_quote": ["states", "states"]}'),
    ('an answer needed both to quote and before signing', '{"needed_to_quote": ["states"], "needed_before_signing": ["states"]}'),
    ('answers that aren''t a list of text', '{"needed_to_quote": [1]}'),
    ('a census layout with no columns', '{"census_layout": {"format": "csv", "template_file": null, "columns": []}}'),
    ('a census file format we don''t make', '{"census_layout": {"format": "pdf", "template_file": null, "columns": [{"header": "Name", "from": "first_name"}]}}'),
    ('a census column from a fact we don''t hold', '{"census_layout": {"format": "csv", "template_file": null, "columns": [{"header": "SSN", "from": "ssn"}]}}'),
    ('a census column with no header', '{"census_layout": {"format": "csv", "template_file": null, "columns": [{"header": " ", "from": null}]}}'),
    ('a census header used twice', '{"census_layout": {"format": "csv", "template_file": null, "columns": [{"header": "Name", "from": "first_name"}, {"header": "name", "from": "last_name"}]}}'),
    ('a census column with an unknown part', '{"census_layout": {"format": "csv", "template_file": null, "columns": [{"header": "Name", "from": null, "width": 9}]}}'),
    ('a census layout with an unknown part', '{"census_layout": {"format": "csv", "template_file": null, "columns": [{"header": "Name", "from": null}], "sheet": "A"}}'),
    ('a template file reference that is empty', '{"census_layout": {"format": "xlsx", "template_file": "", "columns": [{"header": "Name", "from": null}]}}'),
    ('a census layout with more than 200 columns', jsonb_build_object('census_layout', jsonb_build_object('format', 'csv', 'template_file', NULL, 'columns', cols))),
    ('a document of a kind we don''t take', '{"documents": [{"category": "tax_return", "description": "Last year''s return"}]}'),
    ('a document with no description', '{"documents": [{"category": "payroll_report", "description": ""}]}'),
    ('a minimum headcount under 1', '{"min_headcount": 0}'),
    ('a minimum headcount that isn''t whole', '{"min_headcount": 2.5}'),
    ('a state that isn''t one', '{"states_served": ["XX"]}'),
    ('no states served', '{"states_served": []}'),
    ('a class code that isn''t four digits', '{"excluded_class_codes": ["88"]}'),
    ('an empty excluded industry', '{"excluded_industries": [" "]}'),
    ('a minimum enrolment over 100 percent', '{"min_enrolment_percent": 101}'),
    ('a minimum enrolment of 0', '{"min_enrolment_percent": 0}'),
    ('a question of a kind we don''t ask', '{"extra_questions": [{"key": "a", "text": "A?", "kind": "date"}]}'),
    ('a question with no text', '{"extra_questions": [{"key": "a", "text": "", "kind": "text"}]}'),
    ('a question key that isn''t a short name', '{"extra_questions": [{"key": "Has Drivers?", "text": "A?", "kind": "text"}]}'),
    ('two questions with one key', '{"extra_questions": [{"key": "a", "text": "A?", "kind": "text"}, {"key": "a", "text": "B?", "kind": "number"}]}'),
    ('a choice question with one choice', '{"extra_questions": [{"key": "a", "text": "A?", "kind": "choice", "choices": ["Yes"]}]}'),
    ('choices on a question that isn''t a choice', '{"extra_questions": [{"key": "a", "text": "A?", "kind": "yes_no", "choices": ["Yes", "No"]}]}'),
    ('more than 30 questions', jsonb_build_object('extra_questions', qs)),
    ('a source for a part a profile doesn''t have', '{"sources": {"rating": {"kind": "document", "name": "Guide", "checked_on": "2026-11-01"}}}'),
    ('a source of a kind we don''t record', '{"min_headcount": 5, "sources": {"min_headcount": {"kind": "rumour", "name": "Heard it", "checked_on": "2026-11-01"}}}'),
    ('a source with no name', '{"min_headcount": 5, "sources": {"min_headcount": {"kind": "document", "name": " ", "checked_on": "2026-11-01"}}}'),
    ('a source not named at all', '{"min_headcount": 5, "sources": {"min_headcount": {"kind": "document", "checked_on": "2026-11-01"}}}'),
    ('a person at the PEO with no role', '{"min_headcount": 5, "sources": {"min_headcount": {"kind": "person", "name": "Dana Reyes", "checked_on": "2026-11-01"}}}'),
    ('a document with a role', '{"min_headcount": 5, "sources": {"min_headcount": {"kind": "document", "name": "Guide", "role": "Broker desk", "checked_on": "2026-11-01"}}}'),
    ('a person with a link', '{"min_headcount": 5, "sources": {"min_headcount": {"kind": "person", "name": "Dana", "role": "Desk", "link": "https://trinet.example", "checked_on": "2026-11-01"}}}'),
    ('a document link that isn''t a web address', '{"min_headcount": 5, "sources": {"min_headcount": {"kind": "document", "name": "Guide", "link": "javascript:alert(1)", "checked_on": "2026-11-01"}}}'),
    ('a source with something else in it', '{"min_headcount": 5, "sources": {"min_headcount": {"kind": "document", "name": "Guide", "page": 4, "checked_on": "2026-11-01"}}}'),
    ('a source with no date', '{"min_headcount": 5, "sources": {"min_headcount": {"kind": "document", "name": "Guide"}}}'),
    ('a date that isn''t one', '{"min_headcount": 5, "sources": {"min_headcount": {"kind": "document", "name": "Guide", "checked_on": "last week"}}}'),
    ('a day that doesn''t exist', '{"min_headcount": 5, "sources": {"min_headcount": {"kind": "document", "name": "Guide", "checked_on": "2026-02-30"}}}'),
    -- An admin ahead of the database's clock may enter their own today (tomorrow, here), never the day after.
    ('a check dated in the future', jsonb_build_object('min_headcount', 5, 'sources', jsonb_build_object('min_headcount', pg_temp.guide((current_date + 2)::text)))),
    ('a source for a rule that isn''t there', jsonb_build_object('sources', jsonb_build_object('min_headcount', pg_temp.guide()))),
    ('a source for no census layout', jsonb_build_object('sources', jsonb_build_object('census_layout', pg_temp.guide()))),
    ('sources that aren''t an object', '{"sources": []}'),
    ('a contact with no name', '{"contacts": [{"name": " ", "email": "a@b.example"}]}'),
    ('a contact email that isn''t one', '{"contacts": [{"name": "Dana", "email": "dana"}]}')
  ) AS t(label, profile) LOOP
    PERFORM pg_temp.must_raise(admin, pg_temp.save_sql(justworks, bad.profile), '22023', 'saving ' || bad.label);
    cases := cases + 1;
  END LOOP;

  -- Not even the table's owner stores a bad profile.
  PERFORM pg_temp.must_raise(NULL, format('UPDATE public.peo_profile_versions SET needed_to_quote = ''{favourite_colour}'' WHERE peo_id = %s', justworks), '22023', 'the owner storing a bad profile');

  -- A published version says where each part came from and when: an empty draft, or a rule or a section with no
  -- source, can't be published.
  PERFORM pg_temp.must_raise(admin, pg_temp.publish_sql(justworks), '22023', 'publishing a profile with nothing sourced');
  PERFORM pg_temp.save(admin, justworks, jsonb_build_object('min_headcount', 5, 'documents', pg_temp.full_profile() -> 'documents',
    'sources', jsonb_build_object('min_headcount', pg_temp.person())));
  PERFORM pg_temp.must_raise(admin, pg_temp.publish_sql(justworks), '22023', 'publishing documents with no source');
  PERFORM pg_temp.save(admin, justworks, jsonb_build_object('min_headcount', 5, 'sources', jsonb_build_object('min_headcount', pg_temp.person()),
    'contacts', pg_temp.full_profile() -> 'contacts'));
  PERFORM pg_temp.must_raise(admin, pg_temp.publish_sql(justworks), '22023', 'publishing contacts with no source');

  -- What the caps allow is stored: 200 columns, 30 questions, a template file; and a section with nothing in it,
  -- sourced, says the PEO asks for none (no documents, here).
  PERFORM pg_temp.save(admin, justworks, jsonb_build_object(
    'census_layout', jsonb_build_object('format', 'csv', 'template_file', 'peo-templates/justworks.xlsx', 'columns', cols - 200),
    'extra_questions', qs - 30,
    'sources', jsonb_build_object('census_layout', pg_temp.guide((current_date + 1)::text), 'extra_questions', pg_temp.guide(), 'documents', pg_temp.guide())));
  PERFORM pg_temp.publish(admin, justworks);
  IF (SELECT sources -> 'census_layout' ->> 'link' FROM public.peo_profile_versions WHERE peo_id = justworks AND status = 'published') IS DISTINCT FROM 'https://trinet.example/guide.pdf' THEN
    RAISE EXCEPTION 'FAIL: a document''s link wasn''t kept';
  END IF;
  RAISE NOTICE 'peo_profiles: % shape cases passed', cases;
END $$;

-- ---------- Who reads what ----------
DO $$
DECLARE
  admin uuid := pg_temp.new_user('admin');
  advisor uuid := pg_temp.new_user('advisor');
  prospect uuid := pg_temp.new_user();
  guest uuid := pg_temp.new_user();
  rippling bigint := pg_temp.peo('Rippling');
  added jsonb;
  raised text;
BEGIN
  -- TriNet's published versions name Dana Reyes; Rippling's draft names someone too.
  PERFORM pg_temp.save(admin, rippling, '{"contacts": [{"name": "Sam Lee", "email": "sam@rippling.example"}]}');

  -- Advisors read the contacts of published versions, never a draft's; admins read all of them.
  IF pg_temp.run(advisor, 'SELECT to_jsonb(array_agg(DISTINCT name)) FROM public.peo_contacts') <> '["Dana Reyes"]'::jsonb THEN
    RAISE EXCEPTION 'FAIL: an advisor reads the contacts %', pg_temp.run(advisor, 'SELECT jsonb_agg(c) FROM public.peo_contacts c');
  END IF;
  IF pg_temp.run(admin, 'SELECT to_jsonb(array_agg(DISTINCT name ORDER BY name)) FROM public.peo_contacts') <> '["Dana Reyes", "Sam Lee"]'::jsonb THEN
    RAISE EXCEPTION 'FAIL: an admin doesn''t read every contact';
  END IF;
  -- Advisors read the published versions themselves, sources and all (the PEOs page shows them); admins read drafts too.
  IF pg_temp.run(advisor, 'SELECT to_jsonb(count(*)) FROM public.peo_profile_versions')::int <> 3
     OR pg_temp.run(advisor, 'SELECT to_jsonb(count(*)) FROM public.peo_profile_versions WHERE status = ''draft''')::int <> 0
     OR pg_temp.run(advisor, 'SELECT to_jsonb(count(*)) FROM public.peo_profile_versions WHERE sources ? ''contacts'' AND created_by IS NOT NULL')::int = 0
     OR pg_temp.run(advisor, 'SELECT to_jsonb(count(*)) FROM public.peos')::int <> 5
     OR pg_temp.run(admin, 'SELECT to_jsonb(count(*)) FROM public.peo_profile_versions WHERE status = ''draft''')::int < 1 THEN
    RAISE EXCEPTION 'FAIL: an advisor or admin doesn''t read the versions they need';
  END IF;
  -- Prospects, guests included, read no PEO table at all: not a contact, not a version (whose sources name people at
  -- the PEO and whose rows name admins), not a PEO row (which names the admin who added it). peo_catalog() is their
  -- only way in.
  PERFORM pg_temp.as_user(guest, true);
  SET LOCAL ROLE authenticated;
  IF (SELECT count(*) FROM public.peo_contacts) <> 0 OR (SELECT count(*) FROM public.peos) <> 0
     OR (SELECT count(*) FROM public.peo_profile_versions) <> 0 THEN
    RESET ROLE;
    RAISE EXCEPTION 'FAIL: a guest reads PEO rows directly';
  END IF;
  RESET ROLE;
  IF pg_temp.run(prospect, 'SELECT to_jsonb(count(*)) FROM public.peo_contacts')::int <> 0
     OR pg_temp.run(prospect, 'SELECT to_jsonb(count(*)) FROM public.peo_profile_versions')::int <> 0
     OR pg_temp.run(prospect, 'SELECT to_jsonb(count(*)) FROM public.peos')::int <> 0 THEN
    RAISE EXCEPTION 'FAIL: a prospect reads PEO rows directly';
  END IF;
  -- Through the catalog a guest still reads the PEOs and what is published, with no person's name and no admin id.
  PERFORM pg_temp.as_user(guest, true);
  SET LOCAL ROLE authenticated;
  IF jsonb_array_length(public.peo_catalog()) <> 5 OR public.peo_catalog()::text LIKE '%Dana Reyes%'
     OR public.peo_catalog()::text LIKE '%' || admin || '%' THEN
    RESET ROLE;
    RAISE EXCEPTION 'FAIL: a guest''s catalog is %', public.peo_catalog();
  END IF;
  RESET ROLE;
  -- An advisor's own account behind a guest token is a guest's.
  PERFORM pg_temp.as_user(advisor, true);
  SET LOCAL ROLE authenticated;
  IF (SELECT count(*) FROM public.peo_profile_versions) <> 0 OR public.peo_catalog()::text LIKE '%Dana Reyes%' THEN
    RESET ROLE;
    RAISE EXCEPTION 'FAIL: an advisor signed in as a guest reads a named person';
  END IF;
  RESET ROLE;
  -- An admin's own token as a guest is a guest's.
  PERFORM pg_temp.as_user(admin, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.admin_add_peo('Guest PEO');
  EXCEPTION WHEN OTHERS THEN raised := SQLSTATE;
  END;
  RESET ROLE;
  IF raised IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FAIL: an admin signed in as a guest added a PEO (%)', raised; END IF;

  -- Signed out, nothing: public pages never name a PEO.
  PERFORM pg_temp.must_raise(NULL, 'SET LOCAL ROLE anon; SELECT public.peo_catalog()', '42501', 'a signed-out caller reading the catalog');
  PERFORM pg_temp.must_raise(NULL, 'SET LOCAL ROLE anon; SELECT count(*) FROM public.peos', '42501', 'a signed-out caller reading the PEOs');

  -- Adding a PEO is a call, not a code change: it is listed at once, alphabetically, with no profile.
  added := pg_temp.run(admin, 'SELECT public.admin_add_peo(''  Acme PEO  '')');
  IF added ->> 'name' <> 'Acme PEO' OR (added ->> 'created_by')::uuid IS DISTINCT FROM admin THEN
    RAISE EXCEPTION 'FAIL: the PEO was added as %', added;
  END IF;
  IF pg_temp.run(prospect, 'SELECT public.peo_catalog() -> 0') <> jsonb_build_object('id', (added ->> 'id')::bigint, 'name', 'Acme PEO', 'listed', true, 'profile', NULL) THEN
    RAISE EXCEPTION 'FAIL: the new PEO isn''t first in the catalog';
  END IF;
  PERFORM pg_temp.must_raise(admin, 'SELECT public.admin_add_peo(''ACME peo'')', '23505', 'adding a PEO twice');
  BEGIN
    PERFORM pg_temp.run(admin, 'SELECT public.admin_add_peo(''ACME peo'')');
  EXCEPTION WHEN unique_violation THEN
    IF SQLERRM <> 'ACME peo is already listed' THEN RAISE EXCEPTION 'FAIL: adding a PEO twice says %', SQLERRM; END IF;
  END;
  PERFORM pg_temp.must_raise(admin, format('SELECT public.admin_add_peo(%L)', repeat('x', 81)), '22023', 'a PEO name over 80 characters');
  PERFORM pg_temp.must_raise(admin, 'SELECT public.admin_add_peo('' '')', '22023', 'a PEO with no name');
  PERFORM pg_temp.must_raise(admin, 'SELECT public.admin_save_peo_profile(999999, ''{}'', NULL, NULL)', 'PT404', 'saving a profile for no PEO');
  RAISE NOTICE 'peo_profiles: reading cases passed';
END $$;

-- ---------- Listed and not listed ----------
-- A PEO is never deleted. An admin marks it not listed: it stays in the catalog, marked so, with its profile, so old
-- packets and quote requests still read against it; the browser stops offering it.
DO $$
DECLARE
  admin uuid := pg_temp.new_user('admin');
  advisor uuid := pg_temp.new_user('advisor');
  prospect uuid := pg_temp.new_user();
  trinet bigint := pg_temp.peo('TriNet');
  entry jsonb;
BEGIN
  PERFORM pg_temp.run(admin, format('SELECT public.admin_set_peo_listed(%s, false)', trinet));
  entry := pg_temp.run(prospect, 'SELECT p FROM jsonb_array_elements(public.peo_catalog()) p WHERE p ->> ''name'' = ''TriNet''');
  IF entry ->> 'listed' <> 'false' OR entry -> 'profile' ->> 'version' <> '2' THEN
    RAISE EXCEPTION 'FAIL: a PEO not listed reads as %', entry;
  END IF;
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.admin_set_peo_listed(%s, true)', trinet), '42501', 'an advisor listing a PEO');
  PERFORM pg_temp.must_raise(admin, 'SELECT public.admin_set_peo_listed(999999, true)', 'PT404', 'listing no PEO');
  PERFORM pg_temp.run(admin, format('SELECT public.admin_set_peo_listed(%s, true)', trinet));
  IF pg_temp.run(prospect, 'SELECT p -> ''listed'' FROM jsonb_array_elements(public.peo_catalog()) p WHERE p ->> ''name'' = ''TriNet''') <> 'true'::jsonb THEN
    RAISE EXCEPTION 'FAIL: listing a PEO again didn''t';
  END IF;
  -- Never deleted, by anyone: not even a PEO with no profile, not even by the table's owner.
  PERFORM pg_temp.must_raise(NULL, 'DELETE FROM public.peos WHERE name = ''Acme PEO''', '55000', 'deleting a PEO');
  RAISE NOTICE 'peo_profiles: listing cases passed';
END $$;

-- ---------- Removing a person at a PEO who asks ----------
-- The runbook in docs/DATA_HANDLING.md ("Removing a PEO contact"), as the table's owner: it takes them out as a
-- contact and as a source of every published version, and the triggers that freeze a version are back on after.
BEGIN;
alter table public.peo_contacts disable trigger peo_contacts_frozen_once_published;
delete from public.peo_contacts where email = 'dana@trinet.example';
alter table public.peo_contacts enable trigger peo_contacts_frozen_once_published;
alter table public.peo_profile_versions disable trigger peo_profile_versions_frozen_once_published;
update public.peo_profile_versions v
set sources = (
  select jsonb_object_agg(s.key, case when s.value ->> 'kind' = 'person' and s.value ->> 'name' = 'Dana Reyes'
    then jsonb_set(s.value, '{name}', '"Removed on request"') else s.value end)
  from jsonb_each(v.sources) s)
where exists (select 1 from jsonb_each(v.sources) s where s.value ->> 'kind' = 'person' and s.value ->> 'name' = 'Dana Reyes');
alter table public.peo_profile_versions enable trigger peo_profile_versions_frozen_once_published;
COMMIT;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.peo_contacts WHERE name = 'Dana Reyes')
     OR EXISTS (SELECT 1 FROM public.peo_profile_versions WHERE sources::text LIKE '%Dana Reyes%') THEN
    RAISE EXCEPTION 'FAIL: the runbook left Dana Reyes named';
  END IF;
  IF (SELECT sources -> 'min_headcount' FROM public.peo_profile_versions WHERE peo_id = pg_temp.peo('TriNet') AND version = 2)
     <> jsonb_build_object('kind', 'person', 'name', 'Removed on request', 'role', 'Broker desk manager', 'checked_on', '2026-11-09') THEN
    RAISE EXCEPTION 'FAIL: the runbook lost the source''s role or date';
  END IF;
  PERFORM pg_temp.must_raise(NULL, format('UPDATE public.peo_profile_versions SET min_headcount = 1 WHERE peo_id = %s AND version = 2', pg_temp.peo('TriNet')), '55000', 'editing a version after the runbook');
  RAISE NOTICE 'peo_profiles: contact removal cases passed';
END $$;

\echo 'peo_profiles: all cases passed'
