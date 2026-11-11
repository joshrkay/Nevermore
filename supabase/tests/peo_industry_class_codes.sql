-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh peo_industry_class_codes
-- The class codes an admin maps each of a PEO's excluded industries to (joshrkay/Nevermore#91, L-2.1,
-- 20261112090000_peo_industry_class_codes.sql): the eligibility check compares them with the census's class codes,
-- never with the intake's free-text industry. The PEO's own wording stays for people to read.
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

-- Sources: a named person at the PEO with their role, or a document by title with a link when there is one; each
-- with the date it was checked.
CREATE FUNCTION pg_temp.guide(checked text DEFAULT '2026-10-20') RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('kind', 'document', 'name', 'Broker guide 2026', 'link', 'https://trinet.example/guide.pdf', 'checked_on', checked);
$$;

-- What an editor opened on a PEO was based on: its draft's revision (null with no draft) and the version in use (null
-- with none). Read as the table's owner, as the page would have read it when it was opened.
CREATE FUNCTION pg_temp.draft_revision(peo bigint) RETURNS uuid LANGUAGE sql AS $$
  SELECT revision FROM public.peo_profile_versions WHERE peo_id = peo AND status = 'draft';
$$;
CREATE FUNCTION pg_temp.in_use(peo bigint) RETURNS integer LANGUAGE sql AS $$
  SELECT max(version) FROM public.peo_profile_versions WHERE peo_id = peo AND status = 'published';
$$;

-- Saves and publishes as an editor opened just now would: based on the draft and version in use as they stand.
CREATE FUNCTION pg_temp.save_sql(peo bigint, profile jsonb, revision uuid, in_use integer) RETURNS text LANGUAGE sql AS $$
  SELECT format('SELECT public.admin_save_peo_profile(%s, %L, %L, %L)', peo, profile, revision, in_use);
$$;
CREATE FUNCTION pg_temp.save(who uuid, peo bigint, profile jsonb) RETURNS jsonb LANGUAGE sql AS $$
  SELECT pg_temp.run(who, pg_temp.save_sql(peo, profile, pg_temp.draft_revision(peo), pg_temp.in_use(peo)));
$$;

CREATE FUNCTION pg_temp.publish(who uuid, peo bigint) RETURNS jsonb LANGUAGE sql AS $$
  SELECT pg_temp.run(who, format('SELECT public.admin_publish_peo_profile(%s, %L)', peo, pg_temp.draft_revision(peo)));
$$;


CREATE FUNCTION pg_temp.recheck(who uuid, peo bigint, sources jsonb) RETURNS jsonb LANGUAGE sql AS $$
  SELECT pg_temp.run(who, format('SELECT public.admin_recheck_peo_profile(%s, %L)', peo, sources));
$$;

-- What a mapping must be (saved by an admin as `rules` with a different mapping), refused with 22023.
CREATE FUNCTION pg_temp.bad_mapping(who uuid, peo bigint, profile jsonb, label text) RETURNS void LANGUAGE sql AS $$
  SELECT pg_temp.must_raise(who, pg_temp.save_sql(peo, profile, pg_temp.draft_revision(peo), pg_temp.in_use(peo)), '22023', label);
$$;

DO $$
DECLARE
  admin uuid := pg_temp.new_user('admin');
  prospect uuid := pg_temp.new_user();
  trinet bigint := pg_temp.peo('TriNet');
  saved jsonb;
  profile jsonb;
  mapped constant jsonb := '{"Roofing": ["5551", "5645"], "Trucking": ["7219"]}';
  rules jsonb := jsonb_build_object('excluded_industries', jsonb_build_array('Roofing', 'Trucking', 'Cannabis dispensaries'),
    'excluded_industry_codes', '{"Roofing": ["5551", "5645"], "Trucking": ["7219"]}'::jsonb,
    'sources', jsonb_build_object('excluded_industries', pg_temp.guide()));
  codes jsonb;
BEGIN
  -- The admin maps two of TriNet's three excluded industries to class codes; the third keeps only its wording.
  saved := pg_temp.save(admin, trinet, rules);
  IF saved -> 'excluded_industry_codes' <> mapped THEN RAISE EXCEPTION 'FAIL: saved %', saved -> 'excluded_industry_codes'; END IF;
  -- With nothing mapped, the mapping is empty, never null.
  saved := pg_temp.save(admin, trinet, rules - 'excluded_industry_codes');
  IF saved -> 'excluded_industry_codes' <> '{}'::jsonb THEN RAISE EXCEPTION 'FAIL: no mapping saved as %', saved -> 'excluded_industry_codes'; END IF;
  saved := pg_temp.save(admin, trinet, rules || '{"excluded_industry_codes": null}'::jsonb);
  IF saved -> 'excluded_industry_codes' <> '{}'::jsonb THEN RAISE EXCEPTION 'FAIL: a null mapping saved as %', saved -> 'excluded_industry_codes'; END IF;

  -- Each key is one of the PEO's excluded industries, as worded; each value 1 to 100 different four-digit codes.
  PERFORM pg_temp.bad_mapping(admin, trinet, rules || '{"excluded_industry_codes": {"Mining": ["1164"]}}', 'mapping an industry the PEO doesn''t exclude');
  PERFORM pg_temp.bad_mapping(admin, trinet, rules || '{"excluded_industry_codes": {"Roofing": ["55"]}}', 'a class code that isn''t four digits');
  PERFORM pg_temp.bad_mapping(admin, trinet, rules || '{"excluded_industry_codes": {"Roofing": []}}', 'an industry mapped to no codes');
  PERFORM pg_temp.bad_mapping(admin, trinet, rules || '{"excluded_industry_codes": {"Roofing": ["5551", "5551"]}}', 'a code mapped twice');
  PERFORM pg_temp.bad_mapping(admin, trinet, rules || '{"excluded_industry_codes": {"Roofing": "5551"}}', 'codes that aren''t a list');
  PERFORM pg_temp.bad_mapping(admin, trinet, rules || '{"excluded_industry_codes": ["5551"]}', 'a mapping that isn''t an object');
  PERFORM pg_temp.bad_mapping(admin, trinet, '{"excluded_industry_codes": {"Roofing": ["5551"]}}', 'a mapping with no excluded industries');
  codes := (SELECT jsonb_agg(lpad(n::text, 4, '0')) FROM generate_series(1, 101) n);
  PERFORM pg_temp.bad_mapping(admin, trinet, rules || jsonb_build_object('excluded_industry_codes', jsonb_build_object('Roofing', codes)), 'more than 100 codes for an industry');
  PERFORM pg_temp.must_raise(NULL, format('UPDATE public.peo_profile_versions SET excluded_industry_codes = %L WHERE peo_id = %s AND status = %L', '{"Mining": ["1164"]}', trinet, 'draft'), '22023', 'the owner storing a bad mapping');
  -- 100 codes is the most.
  PERFORM pg_temp.save(admin, trinet, rules || jsonb_build_object('excluded_industry_codes', jsonb_build_object('Roofing', codes - 0)));

  -- Published, it is frozen with the version, and every signed-in reader reads it in the catalog.
  PERFORM pg_temp.save(admin, trinet, rules);
  PERFORM pg_temp.publish(admin, trinet);
  PERFORM pg_temp.must_raise(NULL, format('UPDATE public.peo_profile_versions SET excluded_industry_codes = %L WHERE peo_id = %s', '{}', trinet), '55000', 'changing a published mapping');
  profile := pg_temp.run(prospect, 'SELECT p -> ''profile'' FROM jsonb_array_elements(public.peo_catalog()) p WHERE p ->> ''name'' = ''TriNet''');
  IF profile -> 'excluded_industry_codes' IS DISTINCT FROM mapped OR profile -> 'excluded_industries' <> '["Roofing", "Trucking", "Cannabis dispensaries"]'::jsonb THEN
    RAISE EXCEPTION 'FAIL: the catalog shows %', profile;
  END IF;
  -- A re-check carries the mapping into the new version.
  saved := pg_temp.recheck(admin, trinet, jsonb_build_object('excluded_industries', pg_temp.guide('2026-11-10')));
  IF saved -> 'excluded_industry_codes' IS DISTINCT FROM mapped THEN RAISE EXCEPTION 'FAIL: the re-check dropped the mapping: %', saved; END IF;

  -- Minimum participation is named so wherever an admin reads it (GLOSSARY.md: never "minimum enrolment").
  BEGIN
    PERFORM pg_temp.save(admin, trinet, '{"min_enrolment_percent": "58"}');
    RAISE EXCEPTION 'FAIL: a participation that isn''t a number was saved';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM <> 'The minimum participation must be a plain number' THEN RAISE EXCEPTION 'FAIL: said %', SQLERRM; END IF;
  END;
  BEGIN
    PERFORM pg_temp.save(admin, trinet, '{"min_enrolment_percent": 101}');
    RAISE EXCEPTION 'FAIL: a participation over 100 percent was saved';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM <> 'A minimum participation is a percentage above 0 and up to 100' THEN RAISE EXCEPTION 'FAIL: said %', SQLERRM; END IF;
  END;
  RAISE NOTICE 'peo_industry_class_codes: all cases passed';
END $$;
