-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh peo_profile_editor
-- The PEOs page's admin actions (joshrkay/Nevermore#91, L-1.2, 20261111100000_peo_profile_editor.sql): "Checked
-- again, nothing changed" publishes a new version with the same content and new sources for the parts re-checked,
-- and a draft can be discarded. A published version is never touched by either.
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
CREATE FUNCTION pg_temp.person(checked text DEFAULT '2026-11-02') RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('kind', 'person', 'name', 'Dana Reyes', 'role', 'Broker desk manager', 'checked_on', checked);
$$;
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

-- The message stmt fails with, run as `who`; null when it doesn't fail.
CREATE FUNCTION pg_temp.refusal(who uuid, stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE message text := NULL;
BEGIN
  PERFORM pg_temp.as_user(who);
  SET LOCAL ROLE authenticated;
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    message := SQLSTATE || ' ' || SQLERRM;
  END;
  RESET ROLE;
  RETURN message;
END $$;


CREATE FUNCTION pg_temp.recheck(who uuid, peo bigint, sources jsonb) RETURNS jsonb LANGUAGE sql AS $$
  SELECT pg_temp.run(who, format('SELECT public.admin_recheck_peo_profile(%s, %L)', peo, sources));
$$;

-- ---------- Checked again, nothing changed ----------
DO $$
DECLARE
  admin uuid := pg_temp.new_user('admin');
  advisor uuid := pg_temp.new_user('advisor');
  prospect uuid := pg_temp.new_user();
  trinet bigint := pg_temp.peo('TriNet');
  v1 public.peo_profile_versions;
  v2 public.peo_profile_versions;
  rechecked jsonb;
  profile jsonb;
  new_source jsonb := jsonb_build_object('kind', 'document', 'name', 'Broker guide 2027', 'checked_on', '2026-11-10');
BEGIN
  PERFORM pg_temp.save(admin, trinet, pg_temp.full_profile());
  PERFORM pg_temp.publish(admin, trinet);
  SELECT * INTO v1 FROM public.peo_profile_versions WHERE peo_id = trinet AND version = 1;

  -- The admin re-checks the minimum headcount and the answers: version 2 is published at once, holding what version 1
  -- held, with the new source and date on those two parts and every other part's source as it was.
  rechecked := pg_temp.recheck(admin, trinet, jsonb_build_object('min_headcount', new_source, 'answers', new_source));
  SELECT * INTO v2 FROM public.peo_profile_versions WHERE id = (rechecked ->> 'id')::bigint;
  IF v2.peo_id <> trinet OR v2.version <> 2 OR v2.status <> 'published' OR v2.published_at IS NULL
     OR v2.published_by IS DISTINCT FROM admin OR v2.created_by IS DISTINCT FROM admin
     OR v2.needed_to_quote <> v1.needed_to_quote OR v2.needed_before_signing <> v1.needed_before_signing
     OR v2.census_layout <> v1.census_layout OR v2.documents <> v1.documents OR v2.min_headcount <> v1.min_headcount
     OR v2.states_served <> v1.states_served OR v2.excluded_industries <> v1.excluded_industries
     OR v2.excluded_class_codes <> v1.excluded_class_codes OR v2.min_enrolment_percent <> v1.min_enrolment_percent
     OR v2.extra_questions <> v1.extra_questions
     OR v2.sources <> v1.sources || jsonb_build_object('min_headcount', new_source, 'answers', new_source) THEN
    RAISE EXCEPTION 'FAIL: the re-check published %', to_jsonb(v2);
  END IF;
  -- Its contacts come with it; version 1 keeps its own, unchanged.
  IF (SELECT jsonb_agg(jsonb_build_array(position, name, role, email, phone) ORDER BY position) FROM public.peo_contacts WHERE profile_version_id = v2.id)
     IS DISTINCT FROM (SELECT jsonb_agg(jsonb_build_array(position, name, role, email, phone) ORDER BY position) FROM public.peo_contacts WHERE profile_version_id = v1.id)
     OR (SELECT count(*) FROM public.peo_contacts WHERE profile_version_id = v1.id) <> 1 THEN
    RAISE EXCEPTION 'FAIL: the re-check didn''t carry the contacts over';
  END IF;
  IF (SELECT to_jsonb(v) FROM public.peo_profile_versions v WHERE id = v1.id) <> to_jsonb(v1) THEN
    RAISE EXCEPTION 'FAIL: the re-check changed version 1';
  END IF;
  -- It is the profile in use, for everyone: the profile is as current as its new oldest check.
  profile := pg_temp.run(prospect, 'SELECT p -> ''profile'' FROM jsonb_array_elements(public.peo_catalog()) p WHERE p ->> ''name'' = ''TriNet''');
  IF profile ->> 'version' <> '2' OR profile -> 'sources' -> 'min_headcount' <> new_source THEN
    RAISE EXCEPTION 'FAIL: the re-checked version isn''t in use: %', profile;
  END IF;

  -- Only admins re-check.
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.admin_recheck_peo_profile(%s, %L)', trinet, jsonb_build_object('min_headcount', new_source)), '42501', 'an advisor re-checking');
  PERFORM pg_temp.must_raise(prospect, format('SELECT public.admin_recheck_peo_profile(%s, %L)', trinet, jsonb_build_object('min_headcount', new_source)), '42501', 'a prospect re-checking');
  -- What a re-check must name: at least one part, each with a source the shape accepts, of a part the profile holds.
  PERFORM pg_temp.must_raise(admin, format('SELECT public.admin_recheck_peo_profile(%s, %L)', trinet, '{}'), '22023', 're-checking nothing');
  PERFORM pg_temp.must_raise(admin, format('SELECT public.admin_recheck_peo_profile(%s, %L)', trinet, '[]'), '22023', 're-checking with sources that aren''t an object');
  PERFORM pg_temp.must_raise(admin, format('SELECT public.admin_recheck_peo_profile(%s, %L)', trinet, jsonb_build_object('rating', new_source)), '22023', 're-checking a part a profile doesn''t have');
  PERFORM pg_temp.must_raise(admin, format('SELECT public.admin_recheck_peo_profile(%s, %L)', trinet, jsonb_build_object('min_headcount', new_source - 'checked_on')), '22023', 're-checking with no date');
  PERFORM pg_temp.must_raise(admin, format('SELECT public.admin_recheck_peo_profile(%s, %L)', trinet, jsonb_build_object('min_headcount', new_source || jsonb_build_object('checked_on', (current_date + 2)::text))), '22023', 're-checking on a day that hasn''t come');
  -- A PEO with nothing published has nothing to re-check; no PEO, nothing at all.
  PERFORM pg_temp.must_raise(admin, format('SELECT public.admin_recheck_peo_profile(%s, %L)', pg_temp.peo('Insperity'), jsonb_build_object('min_headcount', new_source)), 'PT404', 're-checking a PEO with no profile in use');
  PERFORM pg_temp.must_raise(admin, format('SELECT public.admin_recheck_peo_profile(%s, %L)', 999999, jsonb_build_object('min_headcount', new_source)), 'PT404', 're-checking no PEO');
  -- A part the profile in use doesn't hold can't be re-checked.
  PERFORM pg_temp.save(admin, pg_temp.peo('Rippling'), jsonb_build_object('min_headcount', 5, 'sources', jsonb_build_object('min_headcount', pg_temp.person())));
  PERFORM pg_temp.publish(admin, pg_temp.peo('Rippling'));
  PERFORM pg_temp.must_raise(admin, format('SELECT public.admin_recheck_peo_profile(%s, %L)', pg_temp.peo('Rippling'), jsonb_build_object('states_served', new_source)), '22023', 're-checking a rule that isn''t set');

  -- While a draft is open, the admin publishes or discards it first: the re-check would take its version number.
  PERFORM pg_temp.save(admin, trinet, pg_temp.full_profile() || jsonb_build_object('min_headcount', 12));
  PERFORM pg_temp.must_raise(admin, format('SELECT public.admin_recheck_peo_profile(%s, %L)', trinet, jsonb_build_object('min_headcount', new_source)), '55000', 're-checking with a draft open');
  RAISE NOTICE 'peo_profile_editor: re-check cases passed';
END $$;

-- ---------- Discarding a draft ----------
DO $$
DECLARE
  admin uuid := pg_temp.new_user('admin');
  advisor uuid := pg_temp.new_user('advisor');
  trinet bigint := pg_temp.peo('TriNet');
  draft_id bigint := (SELECT id FROM public.peo_profile_versions WHERE peo_id = pg_temp.peo('TriNet') AND status = 'draft');
  saved jsonb;
BEGIN
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.admin_discard_peo_draft(%s)', trinet), '42501', 'an advisor discarding a draft');
  -- The draft and its contacts go; the published versions stay as they were.
  PERFORM pg_temp.run(admin, format('SELECT to_jsonb(true) FROM public.admin_discard_peo_draft(%s)', trinet));
  IF EXISTS (SELECT 1 FROM public.peo_profile_versions WHERE id = draft_id) OR EXISTS (SELECT 1 FROM public.peo_contacts WHERE profile_version_id = draft_id) THEN
    RAISE EXCEPTION 'FAIL: the draft is still there';
  END IF;
  IF (SELECT array_agg(version ORDER BY version) FROM public.peo_profile_versions WHERE peo_id = trinet) <> ARRAY[1, 2] THEN
    RAISE EXCEPTION 'FAIL: discarding touched a published version';
  END IF;
  PERFORM pg_temp.must_raise(admin, format('SELECT public.admin_discard_peo_draft(%s)', trinet), 'PT404', 'discarding with no draft');
  -- With the draft gone, a re-check copies the newest published version (2, whose minimum headcount was re-checked).
  saved := pg_temp.recheck(admin, trinet, jsonb_build_object('states_served', pg_temp.guide('2026-11-11')));
  IF (saved ->> 'version')::int <> 3 OR saved -> 'sources' -> 'min_headcount' ->> 'name' <> 'Broker guide 2027'
     OR saved -> 'sources' -> 'states_served' <> pg_temp.guide('2026-11-11') THEN
    RAISE EXCEPTION 'FAIL: the second re-check published %', saved;
  END IF;
  -- The next change is the next version after the newest published one.
  saved := pg_temp.save(admin, trinet, '{}');
  IF (saved ->> 'version')::int <> 4 THEN RAISE EXCEPTION 'FAIL: the next draft is version %', saved ->> 'version'; END IF;
  RAISE NOTICE 'peo_profile_editor: discard cases passed';
END $$;

-- ---------- A save or a publish names the draft it was based on ----------
-- Two admins, or one admin in two tabs, edit the same PEO. Each save and publish says which draft it was based on (its
-- revision, or no draft and the version in use), and the database refuses one based on anything else, so old content
-- is never written back over newer and a draft nobody reviewed is never published.
DO $$
DECLARE
  ana uuid := pg_temp.new_user('admin');
  ben uuid := pg_temp.new_user('admin');
  justworks bigint := pg_temp.peo('Justworks');
  opened uuid;
  saved jsonb;
  stale constant text := 'PT409 This draft changed since you opened it. Reload to see the latest';
BEGIN
  -- Both open Justworks' draft. Ana saves first; Ben's save, based on the draft as he opened it, is refused, with
  -- words the editor shows, and changes nothing.
  opened := pg_temp.draft_revision(justworks);
  saved := pg_temp.run(ana, pg_temp.save_sql(justworks, jsonb_build_object('min_headcount', 5), opened, NULL));
  IF (saved ->> 'revision')::uuid = opened THEN RAISE EXCEPTION 'FAIL: a save kept the draft''s revision'; END IF;
  IF pg_temp.refusal(ben, pg_temp.save_sql(justworks, jsonb_build_object('min_headcount', 9), opened, NULL)) IS DISTINCT FROM stale THEN
    RAISE EXCEPTION 'FAIL: a save based on an older draft was %', COALESCE(pg_temp.refusal(ben, pg_temp.save_sql(justworks, jsonb_build_object('min_headcount', 9), opened, NULL)), 'allowed');
  END IF;
  IF (SELECT min_headcount FROM public.peo_profile_versions WHERE peo_id = justworks AND status = 'draft') <> 5 THEN
    RAISE EXCEPTION 'FAIL: the refused save changed the draft';
  END IF;
  -- Once Ben reloads, he saves on top of Ana's draft.
  PERFORM pg_temp.run(ben, pg_temp.save_sql(justworks, jsonb_build_object('min_headcount', 9), (saved ->> 'revision')::uuid, NULL));

  -- Publishing names the draft that was reviewed: Ana reviews it, Ben saves again, and Ana's publish is refused.
  opened := pg_temp.draft_revision(justworks);
  PERFORM pg_temp.save(ben, justworks, jsonb_build_object('min_headcount', 12, 'sources', jsonb_build_object('min_headcount', pg_temp.person())));
  IF pg_temp.refusal(ana, format('SELECT public.admin_publish_peo_profile(%s, %L)', justworks, opened)) IS DISTINCT FROM stale THEN
    RAISE EXCEPTION 'FAIL: publishing a draft other than the one reviewed was not refused as stale';
  END IF;
  PERFORM pg_temp.must_raise(ana, format('SELECT public.admin_publish_peo_profile(%s, NULL)', justworks), 'PT409', 'publishing without naming the draft');
  IF EXISTS (SELECT 1 FROM public.peo_profile_versions WHERE peo_id = justworks AND status = 'published') THEN
    RAISE EXCEPTION 'FAIL: a refused publish published';
  END IF;
  PERFORM pg_temp.publish(ana, justworks);

  -- With no draft, a save is based on the version in use. Both open version 1; Ana's save makes the draft, so Ben's,
  -- still based on no draft, is refused rather than written over hers.
  PERFORM pg_temp.run(ana, pg_temp.save_sql(justworks, jsonb_build_object('min_headcount', 15), NULL, 1));
  PERFORM pg_temp.must_raise(ben, pg_temp.save_sql(justworks, jsonb_build_object('min_headcount', 3), NULL, 1), 'PT409', 'a save based on no draft when one was made since');
  -- Ana publishes it (version 2). Ben, still on version 1 with no draft, is refused: his save would bring version 1's
  -- content back.
  PERFORM pg_temp.save(ana, justworks, jsonb_build_object('min_headcount', 15, 'sources', jsonb_build_object('min_headcount', pg_temp.person())));
  PERFORM pg_temp.publish(ana, justworks);
  PERFORM pg_temp.must_raise(ben, pg_temp.save_sql(justworks, jsonb_build_object('min_headcount', 3), NULL, 1), 'PT409', 'a save based on a version no longer in use');
  -- A re-check publishes a version too: an editor opened before it is stale.
  PERFORM pg_temp.recheck(ana, justworks, jsonb_build_object('min_headcount', pg_temp.guide('2026-11-10')));
  PERFORM pg_temp.must_raise(ben, pg_temp.save_sql(justworks, jsonb_build_object('min_headcount', 3), NULL, 2), 'PT409', 'a save based on the version before a re-check');
  -- A draft discarded and started again is a different draft, whatever its version number.
  saved := pg_temp.save(ana, justworks, jsonb_build_object('min_headcount', 20));
  PERFORM pg_temp.run(ana, format('SELECT to_jsonb(true) FROM public.admin_discard_peo_draft(%s)', justworks));
  PERFORM pg_temp.save(ana, justworks, jsonb_build_object('min_headcount', 21));
  PERFORM pg_temp.must_raise(ben, pg_temp.save_sql(justworks, jsonb_build_object('min_headcount', 3), (saved ->> 'revision')::uuid, NULL), 'PT409', 'a save based on a discarded draft');
  PERFORM pg_temp.must_raise(ben, format('SELECT public.admin_publish_peo_profile(%s, %L)', justworks, saved ->> 'revision'), 'PT409', 'publishing a discarded draft');
  -- A save based on a draft when there is none is stale too, and a publish with no draft has nothing to publish.
  PERFORM pg_temp.run(ana, format('SELECT to_jsonb(true) FROM public.admin_discard_peo_draft(%s)', justworks));
  PERFORM pg_temp.must_raise(ben, pg_temp.save_sql(justworks, '{}', (saved ->> 'revision')::uuid, 3), 'PT409', 'a save based on a draft that is gone');
  PERFORM pg_temp.must_raise(ben, format('SELECT public.admin_publish_peo_profile(%s, %L)', justworks, saved ->> 'revision'), 'PT404', 'publishing with no draft');
  -- The catalog never shows a revision: it is the editor's business.
  IF (SELECT bool_or(p -> 'profile' ? 'revision') FROM jsonb_array_elements(public.peo_catalog()) p) THEN
    RAISE EXCEPTION 'FAIL: the catalog shows a revision';
  END IF;
  RAISE NOTICE 'peo_profile_editor: stale save and publish cases passed';
END $$;

\echo 'peo_profile_editor: all cases passed'
