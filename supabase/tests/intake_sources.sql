-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh intake_sources
-- Where each intake came from (20261106100000_intake_sources.sql): the browser sets an intake's referral code and
-- campaign tags when it creates it, only as short codes, and nobody changes them afterwards; each milestone row
-- copies them, so a deleted intake still counts towards its source; advisors alone list and name referral partners,
-- whose codes never change; and only advisors read the funnel by source, which counts each step per source.
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
SET client_min_messages = notice;

CREATE FUNCTION pg_temp.as_user(uid uuid, guest boolean DEFAULT false) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', uid, 'is_anonymous', guest, 'role', 'authenticated', 'email', CASE WHEN guest THEN '' ELSE uid || '@example.test' END)::text, false);
END $$;

CREATE FUNCTION pg_temp.new_user(guest boolean) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', CASE WHEN guest THEN NULL ELSE uid || '@example.test' END, guest, now(), now());
  RETURN uid;
END $$;

-- A new account that has agreed to the intake consent, so it can start an intake.
CREATE FUNCTION pg_temp.consenting_user() RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := pg_temp.new_user(false);
BEGIN
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');
  RESET ROLE;
  RETURN uid;
END $$;

-- A new intake of `owner`, written as the owner's browser writes it, with the source codes given.
CREATE FUNCTION pg_temp.new_intake(owner uuid, data jsonb, ref text, src text, med text, camp text, guest boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE sid uuid;
BEGIN
  PERFORM pg_temp.as_user(owner, guest);
  SET LOCAL ROLE authenticated;
  PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');
  INSERT INTO public.chamber_sessions (user_id, chamber_data, referral_code, utm_source, utm_medium, utm_campaign)
  VALUES (owner, data, ref, src, med, camp) RETURNING id INTO sid;
  RESET ROLE;
  RETURN sid;
END $$;

CREATE FUNCTION pg_temp.certify(owner uuid, sid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_temp.as_user(owner);
  SET LOCAL ROLE authenticated;
  UPDATE public.chamber_sessions SET status = 'submitted', submission = jsonb_build_object(
    'signer_name', 'Jo Doe', 'signer_title', 'CEO', 'signed_at', '2026-11-04T12:00:00Z',
    'consent_version', '2026-10-draft-1', 'consent_text', '["I certify."]'::jsonb, 'chamber_data', chamber_data)
  WHERE id = sid;
  RESET ROLE;
END $$;

-- The SQLSTATE `stmt` fails with as `uid` (null: it ran), rolled back either way.
CREATE FUNCTION pg_temp.state_of(uid uuid, stmt text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_temp.as_user(uid);
  BEGIN
    SET LOCAL ROLE authenticated;
    EXECUTE stmt;
    RESET ROLE;
    RAISE EXCEPTION USING ERRCODE = 'ZZ000';
  EXCEPTION
    WHEN SQLSTATE 'ZZ000' THEN RESET ROLE; RETURN NULL;
    WHEN OTHERS THEN RESET ROLE; RETURN SQLSTATE;
  END;
END $$;

-- The source codes on every milestone row of an intake, as one distinct set.
CREATE FUNCTION pg_temp.milestone_sources(sid uuid) RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(DISTINCT concat_ws('|', COALESCE(referral_code, '-'), COALESCE(utm_source, '-'), COALESCE(utm_medium, '-'), COALESCE(utm_campaign, '-')), ',')
  FROM public.intake_milestones WHERE session_id = sid;
$$;

DO $$
DECLARE
  ready constant jsonb := '{"company_name":"Ready Co","states":["NY"],"pay_frequency":"weekly"}';
  owner uuid := pg_temp.new_user(false);
  guest uuid := pg_temp.new_user(true);
  other uuid := pg_temp.new_user(false);
  stranger uuid := pg_temp.new_user(false);
  advisor uuid := pg_temp.new_user(false);
  from_partner uuid;
  from_campaign uuid;
  direct uuid;
  unlisted uuid;
  r record;
  n integer;
  st text;
  p public.referral_partners;
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (advisor, 'advisor');

  -- ---------- The browser sets the source when it creates the intake ----------
  from_partner := pg_temp.new_intake(owner, ready, 'acme-cfo', 'partner', 'referral', NULL);
  SELECT referral_code, utm_source, utm_medium, utm_campaign INTO r FROM public.chamber_sessions WHERE id = from_partner;
  IF r.referral_code IS DISTINCT FROM 'acme-cfo' OR r.utm_source IS DISTINCT FROM 'partner' OR r.utm_medium IS DISTINCT FROM 'referral'
     OR r.utm_campaign IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: the intake didn''t keep the source it was created with: %', r;
  END IF;
  IF pg_temp.milestone_sources(from_partner) IS DISTINCT FROM 'acme-cfo|partner|referral|-' THEN
    RAISE EXCEPTION 'FAIL: the milestones didn''t copy the source: %', pg_temp.milestone_sources(from_partner);
  END IF;

  from_campaign := pg_temp.new_intake(guest, '{}', NULL, 'newsletter', 'email', 'renewals-2027', true);
  direct := pg_temp.new_intake(other, '{"company_name":"Direct Co"}', NULL, NULL, NULL, NULL);
  unlisted := pg_temp.new_intake(stranger, '{}', 'not-a-partner', NULL, NULL, NULL);

  -- ---------- Only short codes ----------
  -- Each from an account that agreed to the consent and has no open draft, so nothing but the code can refuse it.
  FOR st IN SELECT unnest(ARRAY['Acme', 'acme cfo', '-acme', 'jo@example.com', 'https://x.test', repeat('a', 65), '', 'acme/cfo', 'çfo']) LOOP
    IF pg_temp.state_of(pg_temp.consenting_user(), format(
         'INSERT INTO public.chamber_sessions (user_id, chamber_data, referral_code) VALUES ((SELECT auth.uid()), ''{}'', %L)', st)) IS DISTINCT FROM '23514' THEN
      RAISE EXCEPTION 'FAIL: the referral code % was not refused', st;
    END IF;
    IF pg_temp.state_of(pg_temp.consenting_user(), format(
         'INSERT INTO public.chamber_sessions (user_id, chamber_data, utm_campaign) VALUES ((SELECT auth.uid()), ''{}'', %L)', st)) IS DISTINCT FROM '23514' THEN
      RAISE EXCEPTION 'FAIL: the campaign % was not refused', st;
    END IF;
  END LOOP;
  -- The longest and the shortest codes are accepted (rolled back by state_of either way).
  IF pg_temp.state_of(pg_temp.consenting_user(), format(
       'INSERT INTO public.chamber_sessions (user_id, chamber_data, referral_code, utm_source, utm_medium, utm_campaign) SELECT (auth.uid()), ''{}'', %L, %L, ''a'', ''x.y_z-1''',
       repeat('a', 64), '0')) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: well-formed codes were refused';
  END IF;

  -- ---------- Nobody changes it afterwards ----------
  PERFORM pg_temp.as_user(owner);
  SET LOCAL ROLE authenticated;
  UPDATE public.chamber_sessions SET referral_code = 'someone-else', utm_source = NULL, chamber_data = chamber_data || '{"industry":"Software"}'
  WHERE id = from_partner;
  GET DIAGNOSTICS n = ROW_COUNT;
  RESET ROLE;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: the owner''s save was refused'; END IF;
  SELECT referral_code, utm_source, chamber_data ->> 'industry' AS industry INTO r FROM public.chamber_sessions WHERE id = from_partner;
  IF r.referral_code IS DISTINCT FROM 'acme-cfo' OR r.utm_source IS DISTINCT FROM 'partner' THEN
    RAISE EXCEPTION 'FAIL: the owner changed the source: %', r;
  END IF;
  IF r.industry IS DISTINCT FROM 'Software' THEN RAISE EXCEPTION 'FAIL: the rest of the save was lost'; END IF;
  -- Not the server either.
  UPDATE public.chamber_sessions SET referral_code = 'someone-else', utm_campaign = 'x' WHERE id = from_partner;
  IF (SELECT referral_code FROM public.chamber_sessions WHERE id = from_partner) IS DISTINCT FROM 'acme-cfo'
     OR (SELECT utm_campaign FROM public.chamber_sessions WHERE id = from_partner) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: the service changed the source';
  END IF;

  -- Every later step carries the same source.
  PERFORM pg_temp.certify(owner, from_partner);
  IF NOT EXISTS (SELECT 1 FROM public.intake_milestones WHERE session_id = from_partner AND milestone = 'certified') THEN
    RAISE EXCEPTION 'setup: the certification wasn''t recorded';
  END IF;
  IF pg_temp.milestone_sources(from_partner) IS DISTINCT FROM 'acme-cfo|partner|referral|-' THEN
    RAISE EXCEPTION 'FAIL: a later milestone lost the source: %', pg_temp.milestone_sources(from_partner);
  END IF;

  -- ---------- Referral partners: advisors only ----------
  IF pg_temp.state_of(owner, 'SELECT public.advisor_add_referral_partner(''mine'', ''My Firm'', ''other'')') IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'FAIL: a prospect added a referral partner';
  END IF;
  IF pg_temp.state_of(owner, 'INSERT INTO public.referral_partners (code, name, kind) VALUES (''mine'', ''My Firm'', ''other'')') IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'FAIL: a prospect wrote the partners table';
  END IF;

  PERFORM pg_temp.as_user(advisor);
  SET LOCAL ROLE authenticated;
  -- The code is taken as typed, tidied to lower case.
  p := public.advisor_add_referral_partner('  ACME-CFO ', '  Acme CFO Partners ', 'accounting');
  RESET ROLE;
  IF p.code <> 'acme-cfo' OR p.name <> 'Acme CFO Partners' OR p.kind <> 'accounting' OR p.created_by_email <> advisor || '@example.test' THEN
    RAISE EXCEPTION 'FAIL: the partner wasn''t added as given: %', p;
  END IF;

  IF pg_temp.state_of(advisor, 'SELECT public.advisor_add_referral_partner(''acme-cfo'', ''Someone Else'', ''other'')') IS DISTINCT FROM '23505' THEN
    RAISE EXCEPTION 'FAIL: a taken code was reused';
  END IF;
  FOR st IN SELECT unnest(ARRAY[
    'SELECT public.advisor_add_referral_partner(''acme cfo'', ''Name'', ''other'')',
    'SELECT public.advisor_add_referral_partner('''', ''Name'', ''other'')',
    'SELECT public.advisor_add_referral_partner(''ok-code'', ''  '', ''other'')',
    'SELECT public.advisor_add_referral_partner(''ok-code'', repeat(''n'', 121), ''other'')',
    'SELECT public.advisor_add_referral_partner(''ok-code'', ''Name'', ''vendor'')',
    'SELECT public.advisor_update_referral_partner(''acme-cfo'', '''', ''other'')',
    'SELECT public.advisor_update_referral_partner(''acme-cfo'', ''Name'', NULL)'
  ]) LOOP
    IF pg_temp.state_of(advisor, st) IS DISTINCT FROM '22023' THEN RAISE EXCEPTION 'FAIL: not refused as bad input: %', st; END IF;
  END LOOP;
  IF pg_temp.state_of(advisor, 'SELECT public.advisor_update_referral_partner(''nobody'', ''Name'', ''other'')') IS DISTINCT FROM 'PT404' THEN
    RAISE EXCEPTION 'FAIL: renaming a missing partner wasn''t refused';
  END IF;
  -- An advisor can't write the table around the functions either.
  IF pg_temp.state_of(advisor, 'UPDATE public.referral_partners SET code = ''other-code''') IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'FAIL: an advisor changed a partner''s code directly';
  END IF;

  PERFORM pg_temp.as_user(advisor);
  SET LOCAL ROLE authenticated;
  p := public.advisor_update_referral_partner('Acme-CFO', 'Acme Fractional CFOs', 'accounting');
  SELECT count(*) INTO n FROM public.referral_partners;
  RESET ROLE;
  IF p.code <> 'acme-cfo' OR p.name <> 'Acme Fractional CFOs' OR p.updated_at < p.created_at THEN
    RAISE EXCEPTION 'FAIL: the partner wasn''t renamed: %', p;
  END IF;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: an advisor sees % partners, expected 1', n; END IF;

  -- Prospects and guests see no partner.
  PERFORM pg_temp.as_user(owner);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.referral_partners;
  RESET ROLE;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: a prospect sees % partners', n; END IF;

  -- ---------- The funnel by source ----------
  IF pg_temp.state_of(owner, 'SELECT * FROM public.advisor_intake_sources(now() - interval ''1 day'', now() + interval ''1 day'')') IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'FAIL: a prospect read the funnel by source';
  END IF;
  IF pg_temp.state_of(advisor, 'SELECT * FROM public.advisor_intake_sources(now(), now() - interval ''1 day'')') IS DISTINCT FROM '22023'
     OR pg_temp.state_of(advisor, 'SELECT * FROM public.advisor_intake_sources(now() - interval ''400 days'', now())') IS DISTINCT FROM '22023' THEN
    RAISE EXCEPTION 'FAIL: a bad period wasn''t refused';
  END IF;

  -- A deleted intake still counts towards its source.
  DELETE FROM public.chamber_sessions WHERE id = from_campaign;
  IF NOT EXISTS (SELECT 1 FROM public.intake_milestones WHERE session_id IS NULL AND utm_campaign = 'renewals-2027' AND milestone = 'started') THEN
    RAISE EXCEPTION 'FAIL: deleting the intake lost its source';
  END IF;

  PERFORM pg_temp.as_user(advisor);
  SET LOCAL ROLE authenticated;
  CREATE TEMP TABLE got ON COMMIT DROP AS
    SELECT * FROM public.advisor_intake_sources(now() - interval '1 day', now() + interval '1 day');
  RESET ROLE;

  IF (SELECT count(*) FROM got) <> 4 THEN RAISE EXCEPTION 'FAIL: expected 4 sources, got %', (SELECT count(*) FROM got); END IF;
  SELECT * INTO r FROM got WHERE referral_code = 'acme-cfo';
  IF r.partner_name IS DISTINCT FROM 'Acme Fractional CFOs' OR r.utm_source IS DISTINCT FROM 'partner' OR r.started <> 1
     OR r.answered <> 1 OR r.ready_to_certify <> 1 OR r.email_verified <> 1 OR r.certified <> 1 OR r.census_provided <> 0
     OR r.manuscript_downloaded <> 0 THEN
    RAISE EXCEPTION 'FAIL: the partner''s row: %', r;
  END IF;
  SELECT * INTO r FROM got WHERE utm_campaign = 'renewals-2027';
  IF r.referral_code IS NOT NULL OR r.partner_name IS NOT NULL OR r.utm_source <> 'newsletter' OR r.utm_medium <> 'email'
     OR r.started <> 1 OR r.answered <> 0 OR r.certified <> 0 THEN
    RAISE EXCEPTION 'FAIL: the deleted campaign intake''s row: %', r;
  END IF;
  SELECT * INTO r FROM got WHERE referral_code = 'not-a-partner';
  IF r.partner_name IS NOT NULL OR r.started <> 1 THEN RAISE EXCEPTION 'FAIL: the unlisted code''s row: %', r; END IF;
  SELECT * INTO r FROM got WHERE referral_code IS NULL AND utm_source IS NULL;
  IF r.started <> 1 OR r.answered <> 1 THEN RAISE EXCEPTION 'FAIL: the intakes with no source: %', r; END IF;

  -- Intakes started outside the period don't count.
  PERFORM pg_temp.as_user(advisor);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.advisor_intake_sources(now() - interval '30 days', now() - interval '1 day');
  RESET ROLE;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: a period with no intakes listed % sources', n; END IF;

  RAISE NOTICE 'intake_sources: all cases passed';
END $$;
