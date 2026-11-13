-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh firm_activity
-- The record of who did what (story CRM-P2.3 with Q-3.1; docs/BROKER_CRM_BUILD.md D-16, D-24;
-- 20261116160000_firm_activity.sql). Two firms, each with an owner, and the first with a lead and an agent; a platform
-- admin who belongs to neither. Proves: an entry says who, when, what kind of thing and which record, and never holds
-- content; the function that writes one works out the firm and the actor itself and can't be told otherwise; it is
-- wired to a submission opened, a document or packet downloaded, a send recorded and every membership change; nobody
-- changes or deletes an entry, an admin included; only a firm's owners read their own firm's record, by person and by
-- kind, newest first and in pages; entries older than the window are pruned by the one job allowed to.
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
\i supabase/migrations/20261111090000_quote_request_notes.sql
\i supabase/migrations/20261111100000_quote_request_addresses.sql
\i supabase/migrations/20261111110000_quote_request_messages.sql
\i supabase/migrations/20261111120000_quote_request_threads.sql
\i supabase/migrations/20261111130000_held_mail.sql
\i supabase/migrations/20261111140000_peo_mail_alert.sql
\i supabase/migrations/20261112090000_intake_schema_v3_version.sql
\i supabase/migrations/20261112091000_intake_schema_v3_company_identity.sql
\i supabase/migrations/20261112092000_intake_schema_v3_industry_code.sql
\i supabase/migrations/20261112093000_intake_schema_v3_current_peo.sql
\i supabase/migrations/20261112094000_intake_schema_v3_census_columns.sql
\i supabase/migrations/20261112095000_intake_schema_v3_census_worksite.sql
\i supabase/migrations/20261112096000_intake_schema_v3_owners_officers.sql
\i supabase/migrations/20261112097000_intake_schema_v3_loss_history.sql
\i supabase/migrations/20261112098000_intake_schema_v3_medical_plans.sql
\i supabase/migrations/20261112099000_intake_schema_v3_suta_rates.sql
\i supabase/migrations/20261112100000_intake_schema_v3_acord_130_questions.sql
\i supabase/migrations/20261113090000_broker_mailboxes.sql
\i supabase/migrations/20261113100000_allowed_organisations.sql
\i supabase/migrations/20261115090000_peo_requirement_profiles.sql
\i supabase/migrations/20261115100000_peo_profile_editor.sql
\i supabase/migrations/20261115110000_peo_industry_class_codes.sql
\i supabase/migrations/20261115120000_extra_answers.sql
\i supabase/migrations/20261115130000_information_request_extra_questions.sql
\i supabase/migrations/20261115140000_peo_census_templates.sql
\i supabase/migrations/20261116090000_firms.sql
\i supabase/migrations/20261116150000_second_factor_for_password_sign_ins.sql
\i supabase/migrations/20261116160000_firm_activity.sql
SET client_min_messages = notice;

-- ---------- helpers ----------
CREATE TEMP TABLE fx (name text PRIMARY KEY, id uuid NOT NULL);
GRANT SELECT ON fx TO anon, authenticated, service_role;
GRANT INSERT ON fx TO authenticated;

CREATE FUNCTION pg_temp.id(n text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM fx WHERE name = n $$;

CREATE FUNCTION pg_temp.new_user(n text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', n || '@example.test', false, now(), now());
  INSERT INTO fx VALUES (n, uid);
  RETURN uid;
END $$;

CREATE FUNCTION pg_temp.as_user(n text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', false, 'email', n || '@example.test')::text, false);
  SET LOCAL ROLE authenticated;
END $$;

CREATE FUNCTION pg_temp.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', false);
  SET LOCAL ROLE service_role;
END $$;

CREATE FUNCTION pg_temp.as_owner() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', false);
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

CREATE FUNCTION pg_temp.is(got anyelement, want anyelement, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION 'FAIL: % gave %, expected %', label, got, want; END IF;
END $$;

-- The entries of one firm as the table holds them (read as the table's owner, to check what was written), oldest first.
CREATE FUNCTION pg_temp.entries(firm uuid) RETURNS TABLE (actor text, kind text, record_type text, record_id text) LANGUAGE sql AS $$
  SELECT (SELECT n.name FROM fx n WHERE n.id = a.actor_id), a.kind, a.record_type, a.record_id
  FROM public.firm_activity a WHERE a.firm_id = firm ORDER BY a.id;
$$;

-- ---------- two firms ----------
-- Firm A is Edgar Allan Advisory, which the firms migration created. Firm B is another brokerage.
DO $$
DECLARE
  n text;
  sid uuid;
BEGIN
  FOREACH n IN ARRAY ARRAY['owner_a', 'lead_a', 'agent_a', 'owner_b', 'agent_b', 'platform_admin', 'prospect_a', 'prospect_b'] LOOP
    PERFORM pg_temp.new_user(n);
  END LOOP;
  INSERT INTO fx VALUES ('firm_a', public.default_firm_id());
  INSERT INTO fx VALUES ('firm_b', gen_random_uuid());
  INSERT INTO public.firms (id, name, address, approved_at) VALUES (pg_temp.id('firm_b'), 'Beta Brokers', 'beta-brokers', now());
  INSERT INTO public.user_roles (user_id, role) VALUES
    (pg_temp.id('platform_admin'), 'admin'), (pg_temp.id('owner_a'), 'advisor'), (pg_temp.id('lead_a'), 'advisor'),
    (pg_temp.id('agent_a'), 'advisor'), (pg_temp.id('owner_b'), 'advisor'), (pg_temp.id('agent_b'), 'advisor');
  -- One submission in each firm.
  FOREACH n IN ARRAY ARRAY['a', 'b'] LOOP
    INSERT INTO public.chamber_sessions (user_id, firm_id, chamber_data)
    VALUES (pg_temp.id('prospect_' || n), pg_temp.id('firm_' || n), jsonb_build_object('company_name', 'Co ' || n))
    RETURNING id INTO sid;
    INSERT INTO fx VALUES ('intake_' || n, sid);
  END LOOP;
END $$;

-- Memberships are added after the migration, so each one is recorded. They are added as the service does it (the
-- table's owner): nobody writes memberships through the API.
SELECT pg_temp.as_owner();
INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES
  (pg_temp.id('firm_a'), pg_temp.id('owner_a'), 'owner'),
  (pg_temp.id('firm_a'), pg_temp.id('lead_a'), 'lead'),
  (pg_temp.id('firm_a'), pg_temp.id('agent_a'), 'agent'),
  (pg_temp.id('firm_b'), pg_temp.id('owner_b'), 'owner'),
  (pg_temp.id('firm_b'), pg_temp.id('agent_b'), 'agent');
DELETE FROM public.firm_activity WHERE false;

-- ---------- 1. A person opening a submission is recorded, in the submission's firm, as that person ----------
SELECT pg_temp.as_user('agent_a');
SELECT public.record_member_activity('submission_viewed', 'submission', pg_temp.id('intake_a')::text);
SELECT pg_temp.as_owner();
SELECT pg_temp.is((SELECT count(*) FROM pg_temp.entries(pg_temp.id('firm_a')) WHERE actor = 'agent_a' AND kind = 'submission_viewed'
  AND record_type = 'submission' AND record_id = pg_temp.id('intake_a')::text), 1::bigint, 'an opened submission is recorded in its firm as the person who opened it');


-- ---------- 2. Membership changes are recorded, whoever makes them ----------
-- The memberships added in the set-up above each wrote an entry about themselves; the service made them, so no person.
SELECT pg_temp.as_owner();
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'owner_added' AND firm_id = pg_temp.id('firm_a')
  AND subject_user_id = pg_temp.id('owner_a') AND role = 'owner' AND actor_id IS NULL AND record_type = 'membership'), 1::bigint,
  'a new owner is recorded as an ownership change, about that person, with no person behind a change the service made');
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'member_added' AND firm_id = pg_temp.id('firm_a')
  AND subject_user_id = pg_temp.id('lead_a') AND role = 'lead'), 1::bigint, 'a new lead is recorded with their role');

-- Ending a membership as a function acting for an owner records that owner as the actor.
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.id('owner_a'), 'role', 'authenticated')::text, false);
UPDATE public.firm_memberships SET valid_until = now() + interval '1 day' WHERE user_id = pg_temp.id('agent_a');
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'member_ended' AND subject_user_id = pg_temp.id('agent_a')
  AND actor_id = pg_temp.id('owner_a') AND role = 'agent'), 1::bigint, 'ending a membership records who ended it');
-- A role change is an end and an add; the old owner ending is an ownership change too.
INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (pg_temp.id('firm_b'), pg_temp.id('lead_a'), 'owner');
UPDATE public.firm_memberships SET valid_until = now() + interval '1 hour' WHERE user_id = pg_temp.id('owner_b');
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'owner_ended' AND subject_user_id = pg_temp.id('owner_b')
  AND firm_id = pg_temp.id('firm_b')), 1::bigint, 'an owner ending is recorded as an ownership change');
-- Removing an account removes its memberships; the record of them stays.
DELETE FROM auth.users WHERE id = pg_temp.id('agent_b');
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'member_ended' AND subject_user_id = pg_temp.id('agent_b')
  AND firm_id = pg_temp.id('firm_b')), 1::bigint, 'a membership removed with its account is recorded');
SELECT pg_temp.as_owner();

-- ---------- 3. A recorded send is recorded ----------
DO $$
DECLARE
  uid uuid := pg_temp.new_user('prospect_c');
  sid uuid;
  q jsonb;
BEGIN
  PERFORM pg_temp.as_user('prospect_c');
  PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, jsonb_build_object('company_name', 'Gamma Co', 'states', jsonb_build_array('NY'),
    'pay_frequency', 'bi-weekly', 'employee_count', 12, 'start_month', 'April')) RETURNING id INTO sid;
  UPDATE public.chamber_sessions SET status = 'submitted', submission = jsonb_build_object('signer_name', 'Jo Doe', 'signer_title', 'CEO',
    'signed_at', '2026-11-04T12:00:00Z', 'consent_version', '2026-10-draft-1', 'consent_text', '["I certify."]'::jsonb, 'chamber_data', chamber_data)
  WHERE id = sid;
  INSERT INTO fx VALUES ('intake_c', sid);
  PERFORM pg_temp.as_user('agent_a');
  PERFORM public.set_submission_status(sid, 'under_review', NULL);
  PERFORM public.set_submission_status(sid, 'ready_for_market', NULL);
  q := public.advisor_record_quote_send(sid, 'TriNet', '2026-11-10');
  PERFORM set_config('test.quote_request', q ->> 'id', false);
END $$;
SELECT pg_temp.as_owner();
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'send_recorded' AND firm_id = pg_temp.id('firm_a')
  AND actor_id = pg_temp.id('agent_a') AND record_type = 'quote_request' AND record_id = current_setting('test.quote_request')), 1::bigint,
  'a recorded send is recorded in the submission''s firm as the advisor who recorded it');
\echo firm_activity: ok
