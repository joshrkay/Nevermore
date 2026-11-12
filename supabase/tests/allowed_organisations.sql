-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh allowed_organisations
-- The advisor role by organisation (joshrkay/Nevermore#92 story M-4.2, 20261113100000_allowed_organisations.sql): only admins keep
-- the list, no free-mail domain or personal-account tenant can be on it, a sign-in gets the advisor role only when the
-- provider's own claim matches an organisation on it (never the email text, never a claim the caller supplies), nobody
-- but admins reads the list or the log, and every change and grant is logged for good.
-- holds the advisor or admin role; only an advisor can connect one.
-- only the service role may call any of it.
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
SET client_min_messages = notice;

-- ---------- helpers ----------
CREATE FUNCTION pg_temp.as_user(uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', uid, 'is_anonymous', false, 'role', 'authenticated', 'email', uid || '@example.test')::text, false);
END $$;

CREATE FUNCTION pg_temp.new_user() RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', uid || '@example.test', false, now(), now());
  RETURN uid;
END $$;

CREATE FUNCTION pg_temp.answers(company text, employees integer DEFAULT 12) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('company_name', company, 'states', jsonb_build_array('NY'), 'pay_frequency', 'bi-weekly',
    'employee_count', employees, 'start_month', 'April');
$$;

CREATE FUNCTION pg_temp.cert(data jsonb, signed_at text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'signer_name', 'Jo Doe', 'signer_title', 'CEO', 'signed_at', signed_at,
    'consent_version', '2026-10-draft-1', 'consent_text', '["I certify."]'::jsonb, 'chamber_data', data);
$$;

-- A new intake of its own prospect, certified unless told not to. Runs as that prospect.
CREATE FUNCTION pg_temp.new_intake(company text, certify boolean DEFAULT true) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  uid uuid := pg_temp.new_user();
  sid uuid;
BEGIN
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, pg_temp.answers(company)) RETURNING id INTO sid;
  IF certify THEN
    UPDATE public.chamber_sessions
    SET status = 'submitted', submission = pg_temp.cert(pg_temp.answers(company), '2026-11-04T12:00:00Z')
    WHERE id = sid;
  END IF;
  RESET ROLE;
  RETURN sid;
END $$;

-- The prospect changes an answer and certifies again: the submission's next version.
CREATE FUNCTION pg_temp.recertify(sid uuid, employees integer) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  uid uuid := (SELECT user_id FROM public.chamber_sessions WHERE id = sid);
  company text := (SELECT chamber_data ->> 'company_name' FROM public.chamber_sessions WHERE id = sid);
BEGIN
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  UPDATE public.chamber_sessions SET chamber_data = pg_temp.answers(company, employees) WHERE id = sid;
  UPDATE public.chamber_sessions
  SET status = 'submitted', submission = pg_temp.cert(pg_temp.answers(company, employees), '2026-11-05T12:00:00Z')
  WHERE id = sid;
  RESET ROLE;
END $$;

-- Runs stmt as `who` and returns its single value as jsonb.
CREATE FUNCTION pg_temp.run(who uuid, stmt text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb;
BEGIN
  PERFORM pg_temp.as_user(who);
  SET LOCAL ROLE authenticated;
  EXECUTE stmt INTO result;
  RESET ROLE;
  RETURN result;
END $$;

-- How many rows `who` reads from a source; -1 when they can't read it at all.
CREATE FUNCTION pg_temp.count_as(who uuid, src text) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  PERFORM pg_temp.as_user(who);
  SET LOCAL ROLE authenticated;
  BEGIN
    EXECUTE 'SELECT count(*) FROM ' || src INTO n;
  EXCEPTION WHEN insufficient_privilege THEN
    n := -1;
  END;
  RESET ROLE;
  RETURN n;
END $$;

-- Fails the run unless stmt, run as `who`, raises exactly `state`.
CREATE FUNCTION pg_temp.must_raise(who uuid, stmt text, state text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE raised text := NULL;
BEGIN
  PERFORM pg_temp.as_user(who);
  SET LOCAL ROLE authenticated;
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    raised := SQLSTATE;
  END;
  RESET ROLE;
  IF raised IS NULL THEN RAISE EXCEPTION 'FAIL: % was allowed', label; END IF;
  IF raised <> state THEN RAISE EXCEPTION 'FAIL: % raised % instead of %', label, raised, state; END IF;
END $$;

-- Moves the pipeline as an advisor, one allowed step at a time.
CREATE FUNCTION pg_temp.move(advisor uuid, sid uuid, VARIADIC stages text[]) RETURNS void LANGUAGE plpgsql AS $$
DECLARE st text;
BEGIN
  FOREACH st IN ARRAY stages LOOP
    PERFORM pg_temp.as_user(advisor);
    SET LOCAL ROLE authenticated;
    PERFORM public.set_submission_status(sid, st, NULL);
    RESET ROLE;
  END LOOP;
END $$;

CREATE FUNCTION pg_temp.send(advisor uuid, sid uuid, peo text, sent_on date DEFAULT '2026-11-10') RETURNS jsonb LANGUAGE sql AS $$
  SELECT pg_temp.run(advisor, format('SELECT public.advisor_record_quote_send(%L, %L, %L)', sid, peo, sent_on));
$$;

-- Sets a quote request's status and quote, as the panel's form sends them.
CREATE FUNCTION pg_temp.answer(advisor uuid, id bigint, status text, received date DEFAULT NULL, expires date DEFAULT NULL,
    starts date DEFAULT NULL, fee numeric DEFAULT NULL, note text DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
  SELECT pg_temp.run(advisor, format('SELECT public.advisor_update_quote_request(%s, %L, %L, %L, %L, %L, %L)',
    id, status, received, expires, starts, fee, note));
$$;

CREATE FUNCTION pg_temp.qr(id bigint) RETURNS public.quote_requests LANGUAGE sql AS $$
  SELECT * FROM public.quote_requests WHERE quote_requests.id = qr.id;
$$;


-- Runs stmt as the service role (the receive-mail function) and returns its value as jsonb.
CREATE FUNCTION pg_temp.svc(stmt text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', false);
  SET LOCAL ROLE service_role;
  EXECUTE stmt INTO result;
  RESET ROLE;
  RETURN result;
END $$;

-- Runs stmt as the service role and fails the run unless it raises exactly `state`.
CREATE FUNCTION pg_temp.svc_must_raise(stmt text, state text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE raised text := NULL;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', false);
  SET LOCAL ROLE service_role;
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    raised := SQLSTATE;
  END;
  RESET ROLE;
  IF raised IS NULL THEN RAISE EXCEPTION 'FAIL: % was allowed', label; END IF;
  IF raised <> state THEN RAISE EXCEPTION 'FAIL: % raised % instead of %', label, raised, state; END IF;
END $$;

-- A message to the given local parts, as the function receives it.
CREATE FUNCTION pg_temp.mail(id text, locals text[], from_addr text, to_addrs text[] DEFAULT '{}', auto boolean DEFAULT false,
    body text DEFAULT 'Hello') RETURNS jsonb LANGUAGE sql AS $$
  SELECT pg_temp.svc(format(
    'SELECT public.record_inbound_mail(%L, %L::text[], %L, %L, %L::text[], %L::text[], %L, %L, false, %L::jsonb, %L, %L)',
    id, locals, from_addr, 'Sender', to_addrs, '{}'::text[], 'Re: Harbor Street', body, '{"message-id":"<x@y>"}', auto, '2026-11-10T15:00:00Z'));
$$;






-- A sign-in as the provider's token would have recorded it.
CREATE FUNCTION pg_temp.signin(uid uuid, provider text, data jsonb) RETURNS void LANGUAGE sql AS $$
  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
  VALUES (gen_random_uuid()::text, uid, data, provider, now(), now());
$$;
CREATE FUNCTION pg_temp.claim(who uuid) RETURNS jsonb LANGUAGE sql AS $$
  SELECT pg_temp.run(who, 'SELECT public.claim_advisor_role_by_organisation()');
$$;
CREATE FUNCTION pg_temp.roles_of(uid uuid) RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(string_agg(role::text, ',' ORDER BY role::text), 'none') FROM public.user_roles WHERE user_id = uid;
$$;
CREATE FUNCTION pg_temp.new_anon() RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at) VALUES (uid, 'authenticated', 'authenticated', NULL, true, now(), now());
  RETURN uid;
END $$;

DO $$
DECLARE
  admin uuid := pg_temp.new_user();
  advisor uuid := pg_temp.new_user();
  g1 uuid := pg_temp.new_user();
  g2 uuid := pg_temp.new_user();
  g3 uuid := pg_temp.new_user();
  g4 uuid := pg_temp.new_user();
  m1 uuid := pg_temp.new_user();
  m2 uuid := pg_temp.new_user();
  m3 uuid := pg_temp.new_user();
  anon uuid := pg_temp.new_anon();
  prospect uuid := pg_temp.new_user();
  tenant constant text := '0f9f1d5c-3a64-4d6e-9f47-1c2b8f7e5a10';
  other_tenant constant text := '7a1d2c3e-4b5f-4a6b-8c7d-9e0f1a2b3c4d';
  res jsonb;
  n integer;
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (admin, 'admin'), (advisor, 'advisor');

  -- ---------- What the rule reads ----------
  IF public.identity_organisation('google', '{"email_verified": true, "hd": "Advisory.Example"}') <> 'advisory.example' THEN RAISE EXCEPTION 'FAIL: google hd'; END IF;
  IF public.identity_organisation('google', '{"email_verified": "true", "hd": "advisory.example"}') <> 'advisory.example' THEN RAISE EXCEPTION 'FAIL: google hd with a string flag'; END IF;
  IF public.identity_organisation('google', '{"email_verified": false, "hd": "advisory.example"}') IS NOT NULL
     OR public.identity_organisation('google', '{"hd": "advisory.example"}') IS NOT NULL
     OR public.identity_organisation('google', '{"email_verified": true, "email": "x@advisory.example"}') IS NOT NULL
     OR public.identity_organisation('google', '{"email_verified": true, "hd": "not a domain"}') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: google vouched for an organisation it should not have';
  END IF;
  IF public.identity_organisation('microsoft', format('{"tid": "%s"}', upper(tenant))::jsonb) <> tenant
     OR public.identity_organisation('microsoft', format('{"custom_claims": {"tid": "%s"}}', tenant)::jsonb) <> tenant
     OR public.identity_organisation('microsoft', format('{"iss": "https://login.microsoftonline.com/%s/v2.0"}', tenant)::jsonb) <> tenant THEN
    RAISE EXCEPTION 'FAIL: microsoft tenant was not read';
  END IF;
  IF public.identity_organisation('microsoft', '{"email": "x@advisory.example", "iss": "https://evil.example/0f9f1d5c-3a64-4d6e-9f47-1c2b8f7e5a10/v2.0"}') IS NOT NULL
     OR public.identity_organisation('microsoft', '{"tid": "advisory.example"}') IS NOT NULL
     OR public.identity_organisation('github', '{"hd": "advisory.example"}') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: microsoft or another provider vouched for an organisation it should not have';
  END IF;

  -- ---------- Only an admin keeps the list ----------
  PERFORM pg_temp.must_raise(advisor, 'SELECT public.admin_add_allowed_organisation(''google'', ''advisory.example'', ''Advisory'')', '42501', 'an advisor adding an organisation');
  PERFORM pg_temp.must_raise(prospect, 'SELECT public.admin_add_allowed_organisation(''google'', ''advisory.example'', ''Advisory'')', '42501', 'a prospect adding an organisation');
  PERFORM pg_temp.must_raise(advisor, 'SELECT public.admin_remove_allowed_organisation(1)', '42501', 'an advisor removing an organisation');
  FOR n IN 1..3 LOOP
    DECLARE who uuid := (ARRAY[admin, advisor, prospect])[n];
    BEGIN
      PERFORM pg_temp.must_raise(who, 'INSERT INTO public.allowed_organisations (provider, org_id, label) VALUES (''google'', ''x.example'', ''X'')', '42501', 'inserting into the list directly');
      PERFORM pg_temp.must_raise(who, 'INSERT INTO public.advisor_role_events (kind, provider, org_id) VALUES (''role_granted'', ''google'', ''x.example'')', '42501', 'writing the log directly');
    END;
  END LOOP;

  -- ---------- What can be added ----------
  PERFORM pg_temp.must_raise(admin, 'SELECT public.admin_add_allowed_organisation(''google'', ''gmail.com'', ''Everyone'')', '22023', 'gmail.com');
  PERFORM pg_temp.must_raise(admin, 'SELECT public.admin_add_allowed_organisation(''google'', ''Outlook.COM'', ''Everyone'')', '22023', 'outlook.com in capitals');
  PERFORM pg_temp.must_raise(admin, 'SELECT public.admin_add_allowed_organisation(''microsoft'', ''9188040d-6c67-4c5b-b112-36a304b66dad'', ''Personal accounts'')', '22023', 'Microsoft personal-account tenant');
  PERFORM pg_temp.must_raise(admin, 'SELECT public.admin_add_allowed_organisation(''microsoft'', ''advisory.example'', ''By domain'')', '22023', 'a Microsoft organisation by domain');
  PERFORM pg_temp.must_raise(admin, 'SELECT public.admin_add_allowed_organisation(''google'', ''person@advisory.example'', ''By address'')', '22023', 'a Google organisation by address');
  PERFORM pg_temp.must_raise(admin, 'SELECT public.admin_add_allowed_organisation(''google'', ''advisory'', ''No dot'')', '22023', 'a bare word');
  PERFORM pg_temp.must_raise(admin, 'SELECT public.admin_add_allowed_organisation(''yahoo'', ''advisory.example'', ''Other'')', '22023', 'another provider');
  PERFORM pg_temp.must_raise(admin, 'SELECT public.admin_add_allowed_organisation(''google'', ''advisory.example'', '''')', '22023', 'no name');
  IF (SELECT count(*) FROM public.allowed_organisations) <> 0 THEN RAISE EXCEPTION 'FAIL: a refused organisation was added'; END IF;
  PERFORM pg_temp.run(admin, 'SELECT public.admin_add_allowed_organisation(''google'', ''  Advisory.Example '', ''  Edgar Allan Advisory '')');
  PERFORM pg_temp.run(admin, format('SELECT public.admin_add_allowed_organisation(''microsoft'', %L, ''Edgar Allan Advisory (Microsoft)'')', upper(tenant)));
  IF (SELECT array_agg(org_id ORDER BY org_id) FROM public.allowed_organisations) IS DISTINCT FROM ARRAY[tenant, 'advisory.example'] THEN RAISE EXCEPTION 'FAIL: the list holds %', (SELECT array_agg(org_id) FROM public.allowed_organisations); END IF;
  IF (SELECT label FROM public.allowed_organisations WHERE org_id = 'advisory.example') <> 'Edgar Allan Advisory' THEN RAISE EXCEPTION 'FAIL: the label was not trimmed'; END IF;
  PERFORM pg_temp.must_raise(admin, 'SELECT public.admin_add_allowed_organisation(''google'', ''advisory.example'', ''Again'')', '23505', 'adding one twice');

  -- ---------- Who reads the list and the log ----------
  IF pg_temp.count_as(admin, 'public.allowed_organisations') <> 2 OR pg_temp.count_as(admin, 'public.advisor_role_events') <> 2 THEN RAISE EXCEPTION 'FAIL: an admin does not read the list and the log'; END IF;
  IF pg_temp.count_as(advisor, 'public.allowed_organisations') <> 0 OR pg_temp.count_as(advisor, 'public.advisor_role_events') <> 0
     OR pg_temp.count_as(prospect, 'public.allowed_organisations') <> 0 OR pg_temp.count_as(prospect, 'public.advisor_role_events') <> 0 THEN
    RAISE EXCEPTION 'FAIL: a non-admin read the list or the log';
  END IF;

  -- ---------- Claiming the role ----------
  PERFORM pg_temp.signin(g1, 'google', '{"email": "new@advisory.example", "email_verified": true, "hd": "advisory.example"}');
  res := pg_temp.claim(g1);
  IF (res ->> 'granted')::boolean IS NOT TRUE OR pg_temp.roles_of(g1) <> 'advisor' THEN RAISE EXCEPTION 'FAIL: a Google Workspace member of an allowed organisation got %, %', res, pg_temp.roles_of(g1); END IF;
  res := pg_temp.claim(g1);
  IF res ->> 'reason' <> 'already_has_role' OR (SELECT count(*) FROM public.advisor_role_events WHERE kind = 'role_granted') <> 1 THEN RAISE EXCEPTION 'FAIL: claiming twice granted twice: %', res; END IF;
  -- An email at the right domain with no hosted-domain claim is only text.
  PERFORM pg_temp.signin(g2, 'google', '{"email": "sneaky@advisory.example", "email_verified": true}');
  IF (pg_temp.claim(g2) ->> 'granted')::boolean IS NOT FALSE OR pg_temp.roles_of(g2) <> 'none' THEN RAISE EXCEPTION 'FAIL: an email domain alone granted the role'; END IF;
  PERFORM pg_temp.signin(g3, 'google', '{"email": "x@advisory.example", "email_verified": false, "hd": "advisory.example"}');
  IF (pg_temp.claim(g3) ->> 'granted')::boolean IS NOT FALSE OR pg_temp.roles_of(g3) <> 'none' THEN RAISE EXCEPTION 'FAIL: an unverified email granted the role'; END IF;
  PERFORM pg_temp.signin(g4, 'google', '{"email": "x@other.example", "email_verified": true, "hd": "other.example"}');
  IF (pg_temp.claim(g4) ->> 'reason') <> 'no_match' THEN RAISE EXCEPTION 'FAIL: an organisation not on the list matched'; END IF;
  -- Microsoft: the tenant that issued the token, never the address.
  PERFORM pg_temp.signin(m1, 'azure', format('{"email": "ms@advisory.example", "tid": "%s"}', tenant)::jsonb);
  IF (pg_temp.claim(m1) ->> 'granted')::boolean IS NOT TRUE OR pg_temp.roles_of(m1) <> 'advisor' THEN RAISE EXCEPTION 'FAIL: a member of an allowed Microsoft tenant did not get the role'; END IF;
  PERFORM pg_temp.signin(m2, 'azure', format('{"email": "ceo@advisory.example", "tid": "%s"}', other_tenant)::jsonb);
  IF (pg_temp.claim(m2) ->> 'granted')::boolean IS NOT FALSE OR pg_temp.roles_of(m2) <> 'none' THEN RAISE EXCEPTION 'FAIL: an email at the right domain from another tenant got the role'; END IF;
  PERFORM pg_temp.signin(m3, 'azure', '{"email": "ms3@advisory.example"}');
  IF (pg_temp.claim(m3) ->> 'granted')::boolean IS NOT FALSE THEN RAISE EXCEPTION 'FAIL: a Microsoft sign-in with no tenant claim got the role'; END IF;
  IF (pg_temp.claim(prospect) ->> 'reason') <> 'no_match' THEN RAISE EXCEPTION 'FAIL: an account with no provider sign-in matched'; END IF;
  -- A guest session.
  PERFORM pg_temp.signin(anon, 'google', '{"email_verified": true, "hd": "advisory.example"}');
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', anon, 'is_anonymous', true, 'role', 'authenticated')::text, false);
  SET LOCAL ROLE authenticated;
  res := public.claim_advisor_role_by_organisation();
  RESET ROLE;
  IF (res ->> 'reason') <> 'not_signed_in' OR pg_temp.roles_of(anon) <> 'none' THEN RAISE EXCEPTION 'FAIL: a guest session got the role: %', res; END IF;
  -- A signed-out caller can't call it at all.
  PERFORM set_config('request.jwt.claims', '', false);
  SET LOCAL ROLE anon;
  BEGIN
    PERFORM public.claim_advisor_role_by_organisation();
    RESET ROLE;
    RAISE EXCEPTION 'FAIL: a signed-out caller could call the claim';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
  END;
  -- Someone who already has a role is left as they are, and the rule never grants admin.
  PERFORM pg_temp.signin(advisor, 'google', '{"email_verified": true, "hd": "advisory.example"}');
  IF (pg_temp.claim(advisor) ->> 'reason') <> 'already_has_role' OR pg_temp.roles_of(advisor) <> 'advisor' THEN RAISE EXCEPTION 'FAIL: an advisor was changed'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin' AND user_id IN (g1, m1)) THEN RAISE EXCEPTION 'FAIL: the rule granted admin'; END IF;

  -- ---------- The log ----------
  SELECT count(*) INTO n FROM public.advisor_role_events WHERE kind = 'role_granted' AND actor_id IN (g1, m1) AND org_id IN ('advisory.example', tenant);
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL: the two grants were logged % times', n; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.advisor_role_events WHERE kind = 'role_granted' AND actor_id = g1 AND actor_email = 'new@advisory.example' AND org_label = 'Edgar Allan Advisory' AND provider = 'google') THEN RAISE EXCEPTION 'FAIL: the grant did not log who and what matched'; END IF;
  PERFORM pg_temp.must_raise(admin, 'UPDATE public.advisor_role_events SET org_id = ''x''', '42501', 'editing the log as an admin');
  PERFORM pg_temp.must_raise(admin, 'DELETE FROM public.advisor_role_events', '42501', 'deleting from the log as an admin');
  BEGIN
    UPDATE public.advisor_role_events SET org_id = 'x';
    RAISE EXCEPTION 'FAIL: the log can be edited by its owner';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- ---------- Removing an organisation stops later grants, and keeps the role already given ----------
  PERFORM pg_temp.run(admin, format('SELECT public.admin_remove_allowed_organisation(%s)', (SELECT id FROM public.allowed_organisations WHERE org_id = 'advisory.example')));
  IF pg_temp.roles_of(g1) <> 'advisor' THEN RAISE EXCEPTION 'FAIL: removing an organisation took a role away'; END IF;
  PERFORM pg_temp.signin(g2, 'google', '{"email": "late@advisory.example", "email_verified": true, "hd": "advisory.example"}');
  IF (pg_temp.claim(g2) ->> 'reason') <> 'no_match' THEN RAISE EXCEPTION 'FAIL: a removed organisation still matched'; END IF;
  PERFORM pg_temp.must_raise(admin, 'SELECT public.admin_remove_allowed_organisation(999999)', 'PT404', 'removing one that is not there');
  IF NOT EXISTS (SELECT 1 FROM public.advisor_role_events WHERE kind = 'org_removed' AND org_id = 'advisory.example' AND actor_id = admin) THEN RAISE EXCEPTION 'FAIL: the removal was not logged'; END IF;

  -- ---------- Nothing a caller passes decides it ----------
  PERFORM pg_temp.must_raise(g4, 'SELECT public.claim_advisor_role_by_organisation(''advisory.example'')', '42883', 'passing an organisation to the claim');

  RAISE NOTICE 'allowed_organisations: all checks passed';
END $$;
