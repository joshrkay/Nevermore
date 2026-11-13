-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh second_factor
-- A second factor for password sign-ins (story CRM-P1.3b, decision D-19): a sign-in that used a password gets
-- advisor and admin access only at the higher assurance level (aal2); a sign-in through Google or Microsoft
-- relies on that provider and needs none; prospects and guests are never asked for one.
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
\i supabase/migrations/20261116150000_second_factor_for_password_sign_ins.sql

SET client_min_messages = notice;

CREATE FUNCTION pg_temp.claims(uid uuid, extra jsonb DEFAULT '{}') RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    (jsonb_build_object('sub', uid, 'is_anonymous', false, 'role', 'authenticated', 'email', uid || '@example.test') || extra)::text, false);
END $$;

-- The claims Supabase Auth puts in a token: how this sign-in began (amr) and its assurance level (aal).
CREATE FUNCTION pg_temp.signed_in_with(method text, level text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('aal', level, 'amr', jsonb_build_array(jsonb_build_object('method', method, 'timestamp', 1)));
$$;

DO $$
DECLARE
  uid uuid := gen_random_uuid();
BEGIN
  -- The rule on its own, from the token's claims.
  PERFORM pg_temp.claims(uid, pg_temp.signed_in_with('password', 'aal1'));
  IF public.second_factor_rule_met() THEN RAISE EXCEPTION 'FAIL: a password sign-in with no second factor met the rule'; END IF;

  PERFORM pg_temp.claims(uid, pg_temp.signed_in_with('password', 'aal2'));
  IF NOT public.second_factor_rule_met() THEN RAISE EXCEPTION 'FAIL: a password sign-in with a second factor did not meet the rule'; END IF;

  PERFORM pg_temp.claims(uid, pg_temp.signed_in_with('oauth', 'aal1'));
  IF NOT public.second_factor_rule_met() THEN RAISE EXCEPTION 'FAIL: a Google or Microsoft sign-in was asked for a second factor'; END IF;

  RAISE NOTICE 'second_factor: all checks passed';
END $$;

CREATE FUNCTION pg_temp.new_user() RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', uid || '@example.test', false, now(), now());
  RETURN uid;
END $$;

-- Runs stmt as `uid` with extra claims and returns the SQLSTATE it raised, or 'ok'.
CREATE FUNCTION pg_temp.state_of(uid uuid, extra jsonb, stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE s text;
BEGIN
  PERFORM pg_temp.claims(uid, extra);
  SET LOCAL ROLE authenticated;
  BEGIN
    EXECUTE stmt;
    s := 'ok';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE;
  END;
  RESET ROLE;
  RETURN s;
END $$;

-- require_advisor is no longer callable by the API roles (20261104114000): other functions call it for them. Run it
-- directly, as the table owner, with the caller's token.
CREATE FUNCTION pg_temp.require_advisor_state(uid uuid, extra jsonb) RETURNS text LANGUAGE plpgsql AS $$
DECLARE s text;
BEGIN
  PERFORM pg_temp.claims(uid, extra);
  BEGIN
    PERFORM public.require_advisor();
    s := 'ok';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE;
  END;
  RETURN s;
END $$;

CREATE FUNCTION pg_temp.is_true(uid uuid, extra jsonb, expr text) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE r boolean;
BEGIN
  PERFORM pg_temp.claims(uid, extra);
  SET LOCAL ROLE authenticated;
  EXECUTE 'SELECT ' || expr INTO r;
  RESET ROLE;
  RETURN r;
END $$;

DO $$
DECLARE
  adv uuid := pg_temp.new_user();
  adm uuid := pg_temp.new_user();
  pro uuid := pg_temp.new_user();
  pw1 jsonb := pg_temp.signed_in_with('password', 'aal1');
  pw2 jsonb := pg_temp.signed_in_with('password', 'aal2');
  google jsonb := pg_temp.signed_in_with('oauth', 'aal1');
  who text;
  uid uuid;
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (adv, 'advisor'), (adm, 'admin');
  PERFORM pg_temp.claims(pro);
  SET LOCAL ROLE authenticated;
  PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (pro, '{"company_name":"Isolation Co"}');
  RESET ROLE;

  FOREACH who IN ARRAY ARRAY['advisor', 'admin'] LOOP
    uid := CASE who WHEN 'advisor' THEN adv ELSE adm END;

    -- A password sign-in without a second factor opens nothing, in any of the three places advisor access is asked.
    IF pg_temp.is_true(uid, pw1, 'public.is_advisor()') THEN RAISE EXCEPTION 'FAIL: % with a password and no second factor is an advisor', who; END IF;
    IF pg_temp.require_advisor_state(uid, pw1) <> '42501' THEN RAISE EXCEPTION 'FAIL: require_advisor let in a % with a password and no second factor', who; END IF;
    IF pg_temp.state_of(uid, pw1, 'SELECT * FROM public.advisor_list_submissions()') <> '42501' THEN RAISE EXCEPTION 'FAIL: the queue opened for a % with a password and no second factor', who; END IF;
    IF pg_temp.is_true(uid, pw1, '(SELECT count(*) FROM public.chamber_sessions) = 0') IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: a % with a password and no second factor read an intake', who; END IF;

    -- With the second factor, or with a Google or Microsoft sign-in, access is as before.
    IF NOT pg_temp.is_true(uid, pw2, 'public.is_advisor()') THEN RAISE EXCEPTION 'FAIL: % with a password and a second factor was refused', who; END IF;
    IF pg_temp.require_advisor_state(uid, pw2) <> 'ok' THEN RAISE EXCEPTION 'FAIL: require_advisor refused a % with a second factor (%)', who, pg_temp.require_advisor_state(uid, pw2); END IF;
    IF NOT pg_temp.is_true(uid, google, 'public.is_advisor()') THEN RAISE EXCEPTION 'FAIL: % signed in with Google was refused', who; END IF;
    IF pg_temp.state_of(uid, pw2, 'SELECT * FROM public.advisor_list_submissions()') <> 'ok' THEN RAISE EXCEPTION 'FAIL: the queue refused a % with a second factor', who; END IF;
    IF pg_temp.is_true(uid, pw2, '(SELECT count(*) FROM public.chamber_sessions) = 1') IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: a % with a second factor could not read the intake', who; END IF;
  END LOOP;

  -- Admin-only paths need the second factor too.
  IF pg_temp.is_true(adm, pw1, $q$public.has_role('admin')$q$) THEN RAISE EXCEPTION 'FAIL: an admin with a password and no second factor holds the admin role'; END IF;
  IF NOT pg_temp.is_true(adm, pw2, $q$public.has_role('admin')$q$) THEN RAISE EXCEPTION 'FAIL: an admin with a second factor was refused'; END IF;

  -- A prospect who signed in with a password is never asked for a second factor.
  IF pg_temp.is_true(pro, pw1, '(SELECT count(*) FROM public.chamber_sessions) = 1') IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: a prospect with a password lost their own intake'; END IF;

  -- The screen asks the database whether this person is held back only by the second factor, so a person
  -- with no role is never sent to set one up.
  IF NOT pg_temp.is_true(adv, pw1, 'public.advisor_needs_second_factor()') THEN RAISE EXCEPTION 'FAIL: an advisor with a password and no second factor is not told to add one'; END IF;
  IF NOT pg_temp.is_true(adm, pw1, 'public.advisor_needs_second_factor()') THEN RAISE EXCEPTION 'FAIL: an admin with a password and no second factor is not told to add one'; END IF;
  IF pg_temp.is_true(adv, pw2, 'public.advisor_needs_second_factor()') THEN RAISE EXCEPTION 'FAIL: an advisor with a second factor is told to add one'; END IF;
  IF pg_temp.is_true(adv, google, 'public.advisor_needs_second_factor()') THEN RAISE EXCEPTION 'FAIL: an advisor signed in with Google is told to add a second factor'; END IF;
  IF pg_temp.is_true(pro, pw1, 'public.advisor_needs_second_factor()') THEN RAISE EXCEPTION 'FAIL: a prospect is told to add a second factor'; END IF;
  IF pg_temp.is_true(pro, pg_temp.signed_in_with('password', 'aal1') || '{"is_anonymous": true}', 'public.advisor_needs_second_factor()') THEN RAISE EXCEPTION 'FAIL: a guest is told to add a second factor'; END IF;
  IF pg_temp.is_true(adv, pg_temp.signed_in_with('password', 'aal1') || '{"is_anonymous": true}', 'public.advisor_needs_second_factor()') THEN RAISE EXCEPTION 'FAIL: an advisor''s account presenting a guest token is told to add a second factor'; END IF;

  RAISE NOTICE 'second_factor: access checks passed';
END $$;
