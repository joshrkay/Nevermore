-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then EVERY migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh data_isolation
--
-- Authorization and data isolation (US-6.3; docs/SECURITY_REVIEW.md). Every caller the product has reads and
-- writes every kind of data it stores, with row security, grants and triggers exactly as the migrations leave
-- them:
--   signed_out        no token (the `anon` role)
--   guest_a, guest_b  anonymous-auth guests, each with their own intakes and files
--   prospect_a/_b     email-verified prospects, each with a certified intake and a draft
--   advisor, admin    hold a role and a membership of the first firm (Edgar Allan Advisory: an agent and an owner); own no intake
--   agent_2, lead_1   members of the first firm with no advisor role: an agent and a team lead
--   agent_b, owner_b  the second firm's agent (who also holds the advisor role) and owner
--   platform_admin    holds the admin role and a membership of no firm (D-16)
--   former_agent      holds the advisor role; their membership of the first firm has ended
--   advisor_pw        the advisor signed in with a password and no second factor; advisor_pw_mfa, with one (D-19)
--   advisor_as_guest  the advisor's account presenting a guest token (must count as a guest)
--   service           the service role (what the scheduled jobs and edge functions use)
--
-- 1. The matrix: how many rows of each table and bucket each caller can see, exactly.
-- 2. Guests and prospects against someone else's intake: by its id, with their own token or none, nothing
--    reads, changes, deletes or attaches to it. The owner can (positive controls, rolled back).
-- 3. Closed intakes: the owner can't see an archived or revoked one or its files, and can read but not
--    change an expired one.
-- 4. Prospects against advisor records and functions; advisors against admin-only, service-only and
--    prospect-owned data.
-- 4c. One firm against the other, table by table, on the matrix's rows: what a member of one can read, change or delete of the other's.
-- 4e. Functions, one firm against the other: every function that runs as its owner and reads or changes a firm's data is called by
--    the other firm's members, a platform admin, a former member and a non-member, by id and by listing, and gets none of it (D-16, D-18).
-- 4d. A deletion record keeps its firm after its intake is gone.
-- 5. The gate and the catalogue checks, so the matrix can't fall behind the schema:
--    5a every public table and storage bucket is in the registry with what it holds (a firm's data, platform-wide data, a
--       person's own data, or nothing the API reaches); a table or bucket missing from it fails (D-28);
--    5b every firm table and bucket is probed: a row is made for each of two firms and every caller (the other firm's members,
--       a non-member, a former member, a platform admin) reads, counts, changes, deletes none of it, inserts none into it, and a
--       member can neither move their firm's row to the other firm nor take the other firm's for their own. Only a refusal
--       (no row matched, or insufficient privilege) counts as safe; no policy text is read;
--    5c the gate's own negative cases: the two shapes a text check was fooled by, a second open policy, an open insert, an open
--       update, a delete a foreign key stops, a rule that shows nothing to the firm, a table with no way to make a row, a maker
--       that finds no row, one whose probe cannot run, a platform table with a firm column, a closed table with a policy, an
--       unregistered table and bucket;
--    5d every function that runs as its owner or that the API roles can execute is registered, by name, as firm-scoped (and then
--       probed in 4e), platform-wide by design, a person's own, public, service-only, a trigger, or deferred to a named story;
--       a new one that isn't registered fails (by the catalogue, never by reading a function's text);
--    then: every public table has row security and a row in the matrix; every function the API roles can execute is in the
--    allowlist below with a reason; every bucket is private; the API roles hold no TRUNCATE, REFERENCES or TRIGGER; every
--    SECURITY DEFINER function pins its search_path.

-- When you add a migration, add it to the list below and bump the count after it. When you add a table,
-- bucket or API-callable function, the catalogue checks fail until you add it to the matrix or allowlist.
\set ON_ERROR_STOP 1
\set migration_files `ls supabase/migrations/*.sql | wc -l | tr -d ' '`
\set migrations_loaded `grep -c '^.i supabase/migrations/' supabase/tests/data_isolation.sql`
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
\i supabase/migrations/20261116110000_firm_scoped_policies.sql
\i supabase/migrations/20261116140000_firm_address_lookup.sql
\i supabase/migrations/20261116150000_second_factor_for_password_sign_ins.sql
\i supabase/migrations/20261116160000_firm_address_member_before_second_factor.sql
\i supabase/migrations/20261116170000_firm_signup.sql
\i supabase/migrations/20261116180000_function_firm_scope.sql
\i supabase/migrations/20261116200000_firm_scope_unsubmitted_data.sql
SET client_min_messages = notice;

-- The list above is every migration: a new one that isn't loaded here would go untested, so the number of
-- files in supabase/migrations must equal the number of lines above that load one.
SELECT set_config('test.migration_files', :'migration_files', false) \gset
SELECT set_config('test.migrations_loaded', :'migrations_loaded', false) \gset
DO $$
BEGIN
  IF current_setting('test.migration_files') <> current_setting('test.migrations_loaded') THEN
    RAISE EXCEPTION 'FAIL: supabase/migrations holds % files but data_isolation.sql loads %; add the new ones to its list',
      current_setting('test.migration_files'), current_setting('test.migrations_loaded');
  END IF;
END $$;

-- ---------- helpers ----------

CREATE TEMP TABLE fx (name text PRIMARY KEY, id uuid NOT NULL);
GRANT SELECT ON fx TO anon, authenticated, service_role;

CREATE FUNCTION pg_temp.id(n text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM fx WHERE name = n $$;

-- Superuser only: an account as GoTrue would create it (handle_new_user gives it a profile).
CREATE FUNCTION pg_temp.new_user(email text, guest boolean) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', email, guest, now(), now());
  RETURN uid;
END $$;

-- Act as one of the callers above until the next become() or the end of the transaction.
CREATE FUNCTION pg_temp.become(who text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  uid uuid;
  guest boolean;
BEGIN
  RESET ROLE;
  IF who = 'signed_out' THEN
    PERFORM set_config('request.jwt.claims', '', false);
    SET LOCAL ROLE anon;
    RETURN;
  END IF;
  IF who = 'service' THEN
    PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', false);
    SET LOCAL ROLE service_role;
    RETURN;
  END IF;
  uid := pg_temp.id(CASE WHEN who IN ('advisor_as_guest', 'advisor_pw', 'advisor_pw_mfa') THEN 'advisor' ELSE who END);
  IF uid IS NULL THEN RAISE EXCEPTION 'unknown caller %', who; END IF;
  guest := who IN ('guest_a', 'guest_b', 'advisor_as_guest');
  PERFORM set_config('request.jwt.claims',
    (jsonb_build_object('sub', uid, 'role', 'authenticated', 'is_anonymous', guest,
      'email', CASE WHEN guest THEN NULL ELSE who || '@example.test' END)
     -- A sign-in that used a password, with and without the second factor completed (D-19, CRM-P1.3b).
     || CASE WHEN who IN ('advisor_pw', 'advisor_pw_mfa')
          THEN jsonb_build_object('amr', jsonb_build_array(jsonb_build_object('method', 'password', 'timestamp', 1)),
                                  'aal', CASE WHEN who = 'advisor_pw' THEN 'aal1' ELSE 'aal2' END)
          ELSE '{}'::jsonb END)::text, false);
  SET LOCAL ROLE authenticated;
END $$;

-- Rows the caller can see. A table the caller may not read at all counts as none.
CREATE FUNCTION pg_temp.visible(src text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE format('SELECT count(*) FROM %s', src) INTO n;
  RETURN n;
EXCEPTION WHEN insufficient_privilege THEN RETURN 0;
END $$;

-- Runs stmt and always rolls it back. 'rows:<n>' for the rows it touched (1 for a SELECT of one value), or
-- the SQLSTATE it raised.
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

-- stmt changes nothing: it is refused, or matches no row the caller may touch.
CREATE FUNCTION pg_temp.changes_nothing(stmt text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r text := pg_temp.attempt(stmt);
BEGIN
  IF r LIKE 'rows:%' AND r <> 'rows:0' THEN RAISE EXCEPTION 'FAIL: % (% touched)', label, r; END IF;
END $$;

-- stmt is refused (any error), not merely matched to no row.
CREATE FUNCTION pg_temp.refused(stmt text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r text := pg_temp.attempt(stmt);
BEGIN
  IF r LIKE 'rows:%' THEN RAISE EXCEPTION 'FAIL: % was not refused (%)', label, r; END IF;
END $$;

CREATE FUNCTION pg_temp.expect(stmt text, expected text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r text := pg_temp.attempt(stmt);
BEGIN
  IF r IS DISTINCT FROM expected THEN RAISE EXCEPTION 'FAIL: % gave %, expected %', label, r, expected; END IF;
END $$;

-- A file as document-upload stores it: with the service role (prospects can't store files themselves since
-- 20261104130000_document_scanning.sql), then back to whoever was acting.
CREATE FUNCTION pg_temp.store_file(bucket text, path text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  claims text := current_setting('request.jwt.claims', true);
  acting text := current_user;
BEGIN
  RESET ROLE;
  INSERT INTO storage.objects (bucket_id, name) VALUES (bucket, path);
  IF acting <> session_user THEN
    EXECUTE format('SET LOCAL ROLE %I', acting);
    PERFORM set_config('request.jwt.claims', claims, false);
  END IF;
END $$;

-- The callers that must never reach someone else's intake: signed out, guests, prospects, an advisor's account behind a
-- guest token, a platform admin (a member of no firm), a former member, and every member of the other firm. The first
-- firm's own members read its intakes, so they are outsiders only to the second firm's.
CREATE FUNCTION pg_temp.outsiders(owner text, firm text) RETURNS SETOF text LANGUAGE sql AS $$
  SELECT c
  FROM unnest(ARRAY['signed_out', 'guest_a', 'guest_b', 'prospect_a', 'prospect_b', 'advisor_as_guest', 'platform_admin', 'former_agent']
              || CASE WHEN firm = 'a' THEN ARRAY['agent_b', 'owner_b'] ELSE ARRAY['advisor', 'admin', 'agent_2', 'lead_1'] END) c
  WHERE c <> owner
$$;

-- ---------- data for everyone to protect ----------
DO $$
DECLARE
  ga uuid := pg_temp.new_user(NULL, true);
  gb uuid := pg_temp.new_user(NULL, true);
  pa uuid := pg_temp.new_user('prospect_a@example.test', false);
  pb uuid := pg_temp.new_user('prospect_b@example.test', false);
  adv uuid := pg_temp.new_user('advisor@example.test', false);
  adm uuid := pg_temp.new_user('admin@example.test', false);
  -- Firms (20261116090000, 20261116110000). Firm A is Edgar Allan Advisory (everyone sees everything): the advisor is
  -- an agent, agent_2 another agent and lead_1 a lead, the admin an owner. Firm B is a second firm: agent_b an agent
  -- and owner_b its owner; prospect B's intakes are its. platform_admin holds the admin role and no membership;
  -- former_agent holds the advisor role and a membership that ended.
  firm_a constant uuid := '00000000-0000-4000-8000-00000000eaa1';
  firm_b constant uuid := '00000000-0000-4000-8000-0000000000b2';
  ag2 uuid := pg_temp.new_user('agent_2@example.test', false);
  ld1 uuid := pg_temp.new_user('lead_1@example.test', false);
  agb uuid := pg_temp.new_user('agent_b@example.test', false);
  owb uuid := pg_temp.new_user('owner_b@example.test', false);
  pad uuid := pg_temp.new_user('platform_admin@example.test', false);
  fag uuid := pg_temp.new_user('former_agent@example.test', false);
  team_a uuid := gen_random_uuid();
  team_b uuid := gen_random_uuid();
  ready constant text := '{"company_name":"%s","states":["CA"],"pay_frequency":"Bi-weekly","employee_count":3}';
  ga_open uuid; ga_expired uuid; ga_archived uuid; ga_revoked uuid;
  gb_open uuid; pa_cert uuid; pa_open uuid; pb_cert uuid; pb_open uuid;
  who text;
  latest bigint;
  r text;
BEGIN
  INSERT INTO fx VALUES ('guest_a', ga), ('guest_b', gb), ('prospect_a', pa), ('prospect_b', pb), ('advisor', adv), ('admin', adm),
    ('agent_2', ag2), ('lead_1', ld1), ('agent_b', agb), ('owner_b', owb), ('platform_admin', pad), ('former_agent', fag),
    ('firm_a', firm_a), ('firm_b', firm_b);
  INSERT INTO public.user_roles (user_id, role) VALUES (adv, 'advisor'), (adm, 'admin'), (agb, 'advisor'), (pad, 'admin'), (fag, 'advisor');
  INSERT INTO public.firms (id, name, address, visibility, approved_at) VALUES (firm_b, 'Second Brokers', 'second-brokers', 'by_level', now());
  INSERT INTO public.firm_teams (id, firm_id, name) VALUES (team_a, firm_a, 'Sales'), (team_b, firm_b, 'Brokers');
  INSERT INTO public.firm_memberships (firm_id, user_id, role, team_id) VALUES
    (firm_a, adm, 'owner', NULL), (firm_a, adv, 'agent', NULL), (firm_a, ag2, 'agent', team_a), (firm_a, ld1, 'lead', team_a),
    (firm_b, owb, 'owner', NULL), (firm_b, agb, 'agent', team_b);
  INSERT INTO public.firm_memberships (firm_id, user_id, role, valid_from, valid_until)
  VALUES (firm_a, fag, 'agent', now() - interval '30 days', now() - interval '1 day');

  -- Everyone who starts an intake agrees first, from the browser.
  FOREACH who IN ARRAY ARRAY['guest_a', 'guest_b', 'prospect_a', 'prospect_b'] LOOP
    PERFORM pg_temp.become(who);
    PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');
  END LOOP;

  -- Guest A: an open draft with a conversation and a file, and three that will close, each with a file.
  -- A person has one open draft at a time (20261104102000_one_open_draft.sql), so each intake below is
  -- started from the browser once the one before it is closed or certified.

  -- Guest A: three drafts that close the three ways a draft closes (two with a file), then an open draft
  -- with a conversation and a file.
  PERFORM pg_temp.become('guest_a');
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (ga, '{"company_name":"Guest A Expired"}') RETURNING id INTO ga_expired;
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, category)
  VALUES (ga, ga_expired, 'payroll.pdf', '1 KB', ga || '/' || ga_expired || '/payroll.pdf', 'payroll_report');
  PERFORM pg_temp.store_file('documents', ga || '/' || ga_expired || '/payroll.pdf');
  RESET ROLE;
  UPDATE public.chamber_sessions SET last_activity_at = now() - interval '40 days' WHERE id = ga_expired;
  PERFORM pg_temp.become('service');
  IF public.expire_idle_intakes() <> 1 THEN RAISE EXCEPTION 'setup: expected exactly one draft to expire'; END IF;

  PERFORM pg_temp.become('guest_a');
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (ga, '{"company_name":"Guest A Archived"}') RETURNING id INTO ga_archived;
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, category)
  VALUES (ga, ga_archived, 'loss-runs.pdf', '1 KB', ga || '/' || ga_archived || '/loss-runs.pdf', 'workers_comp_loss_runs');
  PERFORM pg_temp.store_file('documents', ga || '/' || ga_archived || '/loss-runs.pdf');
  IF public.archive_chamber_session(ga_archived) <> 'archived' THEN RAISE EXCEPTION 'setup: archive failed'; END IF;

  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (ga, '{"company_name":"Guest A Revoked"}') RETURNING id INTO ga_revoked;
  PERFORM pg_temp.become('admin');
  IF public.revoke_chamber_session(ga_revoked, 'Shared by mistake') <> 'revoked' THEN RAISE EXCEPTION 'setup: revoke failed'; END IF;

  PERFORM pg_temp.become('guest_a');
  INSERT INTO public.chamber_sessions (user_id, chamber_data, transcript, field_provenance)
  VALUES (ga, '{"company_name":"Guest A Co"}',
          '[{"id":"m1","sender":"user","text":"We have 12 staff in Fresno"}]',
          '{"company_name":{"status":"confirmed","source":"transcript"}}')
  RETURNING id INTO ga_open;
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, category)
  VALUES (ga, ga_open, 'census.csv', '1 KB', ga || '/' || ga_open || '/census.csv', 'employee_census');
  PERFORM pg_temp.store_file('documents', ga || '/' || ga_open || '/census.csv');

  -- Guest B: one open draft with a file.
  PERFORM pg_temp.become('guest_b');
  INSERT INTO public.chamber_sessions (user_id, chamber_data, transcript)
  VALUES (gb, '{"company_name":"Guest B Co"}', '[{"id":"m1","sender":"user","text":"Our census is attached"}]')
  RETURNING id INTO gb_open;
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path)
  VALUES (gb, gb_open, 'roster.xlsx', '1 KB', gb || '/' || gb_open || '/roster.xlsx');
  PERFORM pg_temp.store_file('documents', gb || '/' || gb_open || '/roster.xlsx');

  -- Prospects A and B each certify one intake from the browser, then keep a draft; A's certified one has a file.
  PERFORM pg_temp.become('prospect_a');
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (pa, format(ready, 'Prospect A Co')::jsonb) RETURNING id INTO pa_cert;
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path)
  VALUES (pa, pa_cert, 'benefits.pdf', '1 KB', pa || '/' || pa_cert || '/benefits.pdf');
  PERFORM pg_temp.store_file('documents', pa || '/' || pa_cert || '/benefits.pdf');
  UPDATE public.chamber_sessions
  SET status = 'submitted',
      submission = jsonb_build_object('signer_name', 'Pat A', 'signer_title', 'CEO', 'signed_at', '2026-11-01T12:00:00Z',
        'file_id', 'EAA-2026-AAAAAAAA', 'consent_version', 'v1', 'consent_text', 'I certify.', 'chamber_data', chamber_data)
  WHERE id = pa_cert;
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (pa, '{"company_name":"Prospect A Draft"}') RETURNING id INTO pa_open;

  PERFORM pg_temp.become('prospect_b');
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (pb, format(ready, 'Prospect B Co')::jsonb) RETURNING id INTO pb_cert;
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path)
  VALUES (pb, pb_cert, 'payroll.csv', '1 KB', pb || '/' || pb_cert || '/payroll.csv');
  PERFORM pg_temp.store_file('documents', pb || '/' || pb_cert || '/payroll.csv');
  UPDATE public.chamber_sessions
  SET status = 'submitted',
      submission = jsonb_build_object('signer_name', 'Bo B', 'signer_title', 'COO', 'signed_at', '2026-11-01T12:00:00Z',
        'file_id', 'EAA-2026-BBBBBBBB', 'consent_version', 'v1', 'consent_text', 'I certify.', 'chamber_data', chamber_data)
  WHERE id = pb_cert;
  -- Prospect B starts over once, so a closed intake of the second firm leaves its lifecycle event, then keeps a new draft.
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (pb, '{"company_name":"Prospect B First Draft"}') RETURNING id INTO pb_open;
  IF public.archive_chamber_session(pb_open) <> 'archived' THEN RAISE EXCEPTION 'setup: archive failed'; END IF;
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (pb, '{"company_name":"Prospect B Draft"}') RETURNING id INTO pb_open;
  -- Prospect B's intakes belong to the second firm. The API can't choose a firm (an intake always starts in Edgar Allan
  -- Advisory's, keep_intake_firm); here the superuser places them, as the address a prospect arrives at will.
  RESET ROLE;
  UPDATE public.chamber_sessions SET firm_id = firm_b WHERE user_id = pb;

  -- A file planted in guest B's folder under guest A's intake: neither of them may read it.
  RESET ROLE;
  PERFORM pg_temp.store_file('documents', gb || '/' || ga_open || '/planted.csv');

  -- The advisor works on prospect A's submission, so every advisor-side table has a row to protect.
  PERFORM pg_temp.become('advisor');
  PERFORM public.set_submission_status(pa_cert, 'under_review', 'Picked up');
  INSERT INTO public.advisor_notes (session_id, body) VALUES (pa_cert, 'Loss runs look thin');
  PERFORM public.review_submission_field(pa_cert, 'company_name', 'verified');
  -- A quote request on prospect A's submission, once it is ready for market (20261110090000), so it and its
  -- history have rows to protect.
  PERFORM public.set_submission_status(pa_cert, 'ready_for_market', 'Reviewed');
  PERFORM public.advisor_record_quote_send(pa_cert, 'TriNet', NULL);
  -- A note on it (20261111090000), so the notes have a row to protect.
  PERFORM public.advisor_add_quote_request_note(
    (SELECT id FROM public.quote_requests WHERE session_id = pa_cert), 'call', current_date, 'Their rep called');
  -- A referral partner (20261106100000), so its table has a row to protect.
  PERFORM public.advisor_add_referral_partner('acme-cfo', 'Acme CFO Partners', 'accounting');

  SELECT max(id) INTO latest FROM public.advisor_review_events WHERE session_id = pa_cert;
  INSERT INTO storage.objects (bucket_id, name) VALUES ('manuscripts', pa_cert || '/v1-matrix.pdf');
  PERFORM public.record_manuscript_version(pa_cert, 1, pa_cert || '/v1-matrix.pdf', repeat('c', 64), latest, 0, false,
    (SELECT s.submission ->> 'data_sha256' FROM public.chamber_sessions s WHERE s.id = pa_cert),
    (SELECT (s.submission ->> 'certified_at')::timestamptz FROM public.chamber_sessions s WHERE s.id = pa_cert));

  -- The second firm's agent works prospect B's submission the same way, so every advisor-side table has a row of the
  -- second firm's to protect too: a request for information (20261105090000), status, a note, a field review, a quote
  -- request with a note, and a stored Manuscript.
  PERFORM pg_temp.become('agent_b');
  PERFORM public.advisor_request_information(pb_cert, 'Please confirm the pay frequency', ARRAY['pay_frequency']);
  -- The second firm's own referral partner, under the same code the first firm's has (a code is a firm's own).
  PERFORM public.advisor_add_referral_partner('acme-cfo', 'Beta CFO Partners', 'accounting');
  PERFORM public.advisor_add_referral_partner('beta-cfo', 'Beta Second Partners', 'other');
  PERFORM public.set_submission_status(pb_cert, 'under_review', 'Picked up');
  INSERT INTO public.advisor_notes (session_id, body) VALUES (pb_cert, 'Payroll looks complete');
  PERFORM public.review_submission_field(pb_cert, 'company_name', 'verified');
  PERFORM public.set_submission_status(pb_cert, 'ready_for_market', 'Reviewed');
  PERFORM public.advisor_record_quote_send(pb_cert, 'Justworks', NULL);
  PERFORM public.advisor_add_quote_request_note(
    (SELECT id FROM public.quote_requests WHERE session_id = pb_cert), 'call', current_date, 'Their rep emailed');
  SELECT max(id) INTO latest FROM public.advisor_review_events WHERE session_id = pb_cert;
  INSERT INTO storage.objects (bucket_id, name) VALUES ('manuscripts', pb_cert || '/v1-matrix.pdf');
  PERFORM public.record_manuscript_version(pb_cert, 1, pb_cert || '/v1-matrix.pdf', repeat('d', 64), latest, 0, false,
    (SELECT s.submission ->> 'data_sha256' FROM public.chamber_sessions s WHERE s.id = pb_cert),
    (SELECT (s.submission ->> 'certified_at')::timestamptz FROM public.chamber_sessions s WHERE s.id = pb_cert));

  -- Monitoring: a guest's report, a signed-out visitor's, and a function's; and one alert.
  PERFORM pg_temp.become('guest_a');
  IF NOT public.report_client_event('upload_failed', 'storage_upload', 'Upload failed', '/start?session=x', ga_open) THEN RAISE EXCEPTION 'setup: report dropped'; END IF;
  PERFORM pg_temp.become('signed_out');
  IF NOT public.report_client_event('app_error', 'render_error', 'TypeError', '/', NULL) THEN RAISE EXCEPTION 'setup: report dropped'; END IF;
  PERFORM pg_temp.become('service');
  PERFORM public.record_ops_event('ai_failed', 'chamber-extract', 'timeout', NULL, pa, NULL);
  RESET ROLE;
  INSERT INTO public.ops_alerts (kind, event_count, window_minutes, threshold, top_codes) VALUES ('ai_failed', 5, 15, 5, 'timeout x5');
  -- The record chamber-extract keeps of a call (US-2.4a), on prospect A's submission.
  INSERT INTO public.ai_extraction_events (request_id, function_name, user_id, session_id, outcome, error_code, http_status)
  VALUES (gen_random_uuid(), 'chamber-extract', pa, pa_cert, 'error', 'timeout', 504),
         (gen_random_uuid(), 'chamber-extract', pb, pb_cert, 'error', 'timeout', 504),
         -- A call that failed before it knew which intake it was for: no firm's, a platform admin's.
         (gen_random_uuid(), 'chamber-extract', NULL, NULL, 'error', 'bad_request', 400);

  -- The admin asks for prospect B's draft to be deleted (it stays until purge-intakes runs).
  PERFORM pg_temp.become('admin');
  -- (Prospect B's is the second firm's: the admin is no member of it, so it is written here, as the superuser, as a request
  -- by that firm's own owner would be.)
  RESET ROLE;
  INSERT INTO public.intake_deletions (session_id, user_id, trigger, reason, requested_by, requested_by_email)
  VALUES (pb_open, pb, 'request', 'The owner asked by email; verified from the account address', owb, 'owner_b@example.test');
  PERFORM pg_temp.become('admin');
  PERFORM public.request_intake_deletion(pa_open, 'The owner asked by email; verified from the account address');
  -- The admin publishes TriNet's requirement profile, naming a contact (20261115090000); the other four PEOs keep
  -- their empty drafts.
  PERFORM public.admin_save_peo_profile((SELECT id FROM public.peos WHERE name = 'TriNet'), jsonb_build_object(
    'min_headcount', 5, 'sources', jsonb_build_object(
      'min_headcount', jsonb_build_object('kind', 'person', 'name', 'Dana Reyes', 'role', 'Broker desk', 'checked_on', '2026-11-02'),
      'contacts', jsonb_build_object('kind', 'person', 'name', 'Dana Reyes', 'role', 'Broker desk', 'checked_on', '2026-11-02')),
    'contacts', jsonb_build_array(jsonb_build_object('name', 'Dana Reyes', 'email', 'dana@trinet.example'))),
    (SELECT revision FROM public.peo_profile_versions v JOIN public.peos p ON p.id = v.peo_id WHERE p.name = 'TriNet' AND v.status = 'draft'), NULL);
  PERFORM public.admin_publish_peo_profile((SELECT id FROM public.peos WHERE name = 'TriNet'),
    (SELECT revision FROM public.peo_profile_versions v JOIN public.peos p ON p.id = v.peo_id WHERE p.name = 'TriNet' AND v.status = 'draft'));

  -- The admin uploads TriNet's template workbook (20261115140000), which its scan finds clean.
  PERFORM public.admin_register_census_template((SELECT id FROM public.peos WHERE name = 'TriNet'), 'TriNet census.xlsx', 2048, repeat('c', 64));

  -- Email delivery, and the AI rate-limit counters.
  PERFORM pg_temp.become('service');
  PERFORM public.record_census_template_scan((SELECT max(id) FROM public.peo_census_templates), 'clean', NULL);
  PERFORM public.record_email_delivery_event('evt_matrix_1', 'email.bounced', 'msg_matrix_1', ARRAY['prospect_a@example.test'], 'Permanent', 'Mailbox does not exist', now());
  IF NOT public.consume_ip_quota(repeat('a', 64), 20, 400) THEN RAISE EXCEPTION 'setup: ip quota refused'; END IF;
  IF NOT public.consume_global_ai_budget(2000) THEN RAISE EXCEPTION 'setup: global budget refused'; END IF;
  PERFORM pg_temp.become('prospect_a');
  IF NOT public.consume_ai_quota(15, 300) THEN RAISE EXCEPTION 'setup: ai quota refused'; END IF;

  RESET ROLE;
  -- Every file above passed its malware scan, as document-upload records it (20261104130000); a file whose
  -- scan hasn't is withheld, which document_scanning.sql checks. One more upload waits in quarantine.
  UPDATE public.documents SET scan_verdict = 'clean', scanned_at = now();
  INSERT INTO storage.objects (bucket_id, name) VALUES ('quarantine', ga || '/' || ga_open || '/held.pdf');
  -- PEO mail (20261111110000): a message on prospect A's quote request with a stored attachment, an attachment still
  -- pending (its file is in no bucket yet), and a held message that belongs to no intake. The receive-mail function
  -- writes these as the service role; here they are written directly, as the superuser.
  INSERT INTO public.quote_request_messages (provider_message_id, quote_request_id, session_id, direction, from_address, body_text)
  SELECT 'matrix_1', q.id, q.session_id, 'received', 'dana@trinet.example', 'Proposal attached'
  FROM public.quote_requests q WHERE q.session_id = pa_cert;
  INSERT INTO public.quote_request_messages (provider_message_id, held_reason, direction, from_address)
  VALUES ('matrix_held', 'unknown_address', 'received', 'stranger@example.test');
  INSERT INTO public.quote_request_message_attachments (message_id, provider_attachment_id, file_name, size_bytes, status, scan_verdict, storage_bucket, storage_path)
  SELECT m.id, 'att_1', 'proposal.pdf', 100, 'stored', 'clean', 'peo-mail', pa_cert || '/' || m.id || '/1-proposal.pdf'
  FROM public.quote_request_messages m WHERE m.provider_message_id = 'matrix_1';
  INSERT INTO public.quote_request_message_attachments (message_id, provider_attachment_id, file_name, size_bytes, status)
  SELECT m.id, 'att_2', 'waiting.pdf', 100, 'pending' FROM public.quote_request_messages m WHERE m.provider_message_id = 'matrix_1';
  INSERT INTO storage.objects (bucket_id, name)
  SELECT 'peo-mail', pa_cert || '/' || m.id || '/1-proposal.pdf' FROM public.quote_request_messages m WHERE m.provider_message_id = 'matrix_1';
  -- The same on prospect B's quote request, the second firm's mail.
  INSERT INTO public.quote_request_messages (provider_message_id, quote_request_id, session_id, direction, from_address, body_text)
  SELECT 'matrix_b1', q.id, q.session_id, 'received', 'sam@justworks.example', 'Our terms attached'
  FROM public.quote_requests q WHERE q.session_id = pb_cert;
  INSERT INTO public.quote_request_message_attachments (message_id, provider_attachment_id, file_name, size_bytes, status, scan_verdict, storage_bucket, storage_path)
  SELECT m.id, 'att_b1', 'terms.pdf', 100, 'stored', 'clean', 'peo-mail', pb_cert || '/' || m.id || '/1-terms.pdf'
  FROM public.quote_request_messages m WHERE m.provider_message_id = 'matrix_b1';
  INSERT INTO public.quote_request_message_attachments (message_id, provider_attachment_id, file_name, size_bytes, status)
  SELECT m.id, 'att_b2', 'waiting.pdf', 100, 'pending' FROM public.quote_request_messages m WHERE m.provider_message_id = 'matrix_b1';
  INSERT INTO storage.objects (bucket_id, name)
  SELECT 'peo-mail', pb_cert || '/' || m.id || '/1-terms.pdf' FROM public.quote_request_messages m WHERE m.provider_message_id = 'matrix_b1';
  -- An advisor opened each thread (20261111120000), so the mark has a row to protect.
  INSERT INTO public.quote_request_thread_reads (quote_request_id, last_opened_at)
  SELECT q.id, now() FROM public.quote_requests q WHERE q.session_id IN (pa_cert, pb_cert);
  -- An advisor's connected mailbox (20261113090000): the encrypted token, which no API role reads. The mailbox function writes it.
  INSERT INTO public.broker_mailboxes (user_id, provider, address, scope, token_ciphertext, token_iv)
  SELECT adv, 'google', 'advisor@example.test', 'https://www.googleapis.com/auth/gmail.send', 'ciphertext', 'iv';
  -- A request for information on prospect A's submission too (20261105090000; written here, as the superuser, so the
  -- pipeline stays where the cases below expect it), so its table has a row of each firm's to protect.
  INSERT INTO public.information_requests (session_id, message, fields) VALUES (pa_cert, 'Please send the latest loss runs', ARRAY['workers_comp_loss_runs']);
  -- An allowed organisation and the log of its being added (20261113100000), which only admins read. The admin functions write
  -- them; here they are written directly, as the superuser.
  INSERT INTO public.allowed_organisations (provider, org_id, label, added_by, added_by_email)
  VALUES ('google', 'advisory.example', 'Edgar Allan Advisory', adm, 'admin@example.test');
  INSERT INTO public.advisor_role_events (kind, provider, org_id, org_label, actor_id, actor_email)
  VALUES ('org_added', 'google', 'advisory.example', 'Edgar Allan Advisory', adm, 'admin@example.test');
  -- A file in the bucket that no stored attachment names stays the service role's alone.
  INSERT INTO storage.objects (bucket_id, name) VALUES ('peo-mail', pa_cert || '/0/unrecorded.pdf');
  INSERT INTO storage.objects (bucket_id, name) SELECT 'peo-templates', storage_path FROM public.peo_census_templates;
  PERFORM set_config('request.jwt.claims', '', false);
  INSERT INTO fx VALUES
    ('ga_open', ga_open), ('ga_expired', ga_expired), ('ga_archived', ga_archived), ('ga_revoked', ga_revoked),
    ('gb_open', gb_open), ('pa_cert', pa_cert), ('pa_open', pa_open), ('pb_cert', pb_cert), ('pb_open', pb_open);

  -- The setup did what it says.
  IF (SELECT string_agg(s.status, ',' ORDER BY s.status) FROM public.chamber_sessions s WHERE s.user_id = ga) <> 'archived,expired,in_progress,revoked' THEN
    RAISE EXCEPTION 'setup: guest A''s intakes are %', (SELECT string_agg(status, ',') FROM public.chamber_sessions WHERE user_id = ga);
  END IF;
  IF (SELECT count(*) FROM public.chamber_sessions WHERE intake_consent_id IS NULL) <> 0 THEN RAISE EXCEPTION 'setup: an intake has no consent recorded'; END IF;
  IF (SELECT count(*) FROM public.chamber_certifications) <> 2 THEN RAISE EXCEPTION 'setup: expected two certifications'; END IF;
END $$;

-- ---------- 1. the matrix ----------
-- Rows each caller sees of each source. A missing caller key means 0; "all" means every row there is. Every
-- source must hold at least one row, or the check would prove nothing.
CREATE TEMP TABLE matrix (src text PRIMARY KEY, expect jsonb NOT NULL, firm_rows jsonb);
GRANT SELECT ON matrix TO anon, authenticated, service_role;
-- A table that holds a firm's data says how many rows each of the two firms has, in firm_rows. For it, the members of
-- Edgar Allan Advisory (advisor, admin, agent_2, lead_1: "A") see exactly the first firm's rows and the second firm's
-- members (agent_b, owner_b: "B") exactly the second's, unless expect says otherwise for one of them. Nobody else, the
-- platform admin and a former member included, sees a row of either unless expect names them.
INSERT INTO matrix VALUES
  -- Guest A sees its open and expired drafts, not the archived or revoked ones.
  ('public.chamber_sessions',                           '{"guest_a":2,"guest_b":1,"prospect_a":2,"prospect_b":2}', '{"A":7,"B":3}'),
  ('public.chamber_certifications',                     '{"prospect_a":1,"prospect_b":1}', '{"A":1,"B":1}'),
  ('public.documents',                                  '{"guest_a":2,"guest_b":1,"prospect_a":1,"prospect_b":1}', '{"A":5,"B":1}'),
  ('storage.objects WHERE bucket_id = ''documents''',   '{"guest_a":2,"guest_b":1,"prospect_a":1,"prospect_b":1}', '{"A":6,"B":1}'),
  -- A prospect reads one stored Manuscript: their final one (the latest version, built from their current
  -- certification; prospect_final_manuscript). Every other file in the bucket is the firm's members'.
  ('storage.objects WHERE bucket_id = ''manuscripts''', '{"prospect_a":1,"prospect_b":1}', '{"A":1,"B":1}'),
  -- Uploads whose malware scan hasn't passed (20261104130000): the service role's alone.
  ('storage.objects WHERE bucket_id = ''quarantine''',  '{}', NULL),
  -- PEO mail attachments: a firm's members read the ones recorded as stored on their own firm's quote requests; nobody else reads any.
  ('storage.objects WHERE bucket_id = ''peo-mail''',     '{}', '{"A":1,"B":1}'),
  ('storage.buckets',                                   '{}', NULL),
  -- Everyone sees their own profile (the advisor's account behind a guest token is still that account); a firm's
  -- members also see the profiles of its current members and of the owners of its intakes, no one else's.
  ('public.profiles',                                   '{"guest_a":1,"guest_b":1,"prospect_a":1,"prospect_b":1,"advisor_as_guest":1,"platform_admin":1,"former_agent":1}', '{"A":7,"B":3}'),
  ('public.user_roles',                                 '{"advisor":1,"admin":1,"advisor_as_guest":1,"agent_b":1,"platform_admin":1,"former_agent":1}', NULL),
  ('public.intake_consents',                            '{"guest_a":1,"guest_b":1,"prospect_a":1,"prospect_b":1}', '{"A":3,"B":1}'),
  ('public.submission_workflow',                        '{}', '{"A":7,"B":3}'),
  ('public.submission_status_history',                  '{}', '{"A":10,"B":7}'),
  ('public.advisor_notes',                              '{}', '{"A":1,"B":1}'),
  ('public.advisor_field_reviews',                      '{}', '{"A":1,"B":1}'),
  ('public.advisor_review_events',                      '{}', '{"A":1,"B":1}'),
  ('public.manuscript_versions',                        '{}', '{"A":1,"B":1}'),
  -- Who added, removed, renamed or re-categorised each document, and when: the firm's members' audit trail.
  ('public.document_events',                            '{}', '{"A":5,"B":1}'),
  -- What advisors asked prospects for (20261105090000): the prospect reads their own open request only through
  -- prospect_information_request(), never the table.
  ('public.information_requests',                       '{}', '{"A":1,"B":1}'),
  -- Which PEOs each submission went to and what they answered (20261110090000), with every change: the firm's
  -- members' alone. The prospect never sees a quote request, even on their own submission.
  ('public.quote_requests',                             '{}', '{"A":1,"B":1}'),
  ('public.quote_request_events',                       '{}', '{"A":5,"B":5}'),
  ('public.quote_request_notes',                        '{}', '{"A":1,"B":1}'),
  ('public.quote_request_addresses',                    '{}', '{"A":1,"B":1}'),
  -- Mail on a quote request reaches the firm's members; held mail (one here, and it belongs to no firm) only platform admins,
  -- the admin here included. The prospect reads none.
  ('public.quote_request_messages',                     '{"admin":2,"platform_admin":1}', '{"A":1,"B":1}'),
  ('public.quote_request_message_attachments',          '{}', '{"A":2,"B":2}'),
  ('public.quote_request_thread_reads',                 '{}', '{"A":1,"B":1}'),
  -- A broker's connected mailbox (20261113090000): the encrypted token. Nobody reads it through the API, admins included;
  -- the broker learns only whether it is connected, through my_mailbox().
  ('public.broker_mailboxes',                           '{}', NULL),
  -- Who may get the advisor role without an admin (20261113100000), and the log of grants: admins' alone.
  ('public.allowed_organisations',                      '{"admin":"all","platform_admin":"all"}', NULL),
  ('public.advisor_role_events',                        '{"admin":"all","platform_admin":"all"}', NULL),
  -- The pilot funnel's steps (20261105092000): read only through advisor_intake_funnel(), as counts.
  ('public.intake_milestones',                          '{}', NULL),
  -- Who refers employers, by the code in their link (20261106100000): each firm's own (CRM-P2.1c), read by its members and
  -- written only through advisor_add_referral_partner() and advisor_update_referral_partner(). The first firm has one, the second two.
  ('public.referral_partners',                          '{}', '{"A":1,"B":2}'),
  -- PEOs and their requirement profiles (20261115090000) are the platform's, the same for every firm: advisors read the PEOs,
  -- the published version (one here) and its contacts; drafts are the admin's. Prospects, guests included, read none of
  -- these tables (a version names people at the PEO and admins): peo_catalog() is their only way in, checked in part 4.
  -- Signed-out callers read nothing: public pages never name a PEO. They hold no firm's data, so a platform admin reads
  -- them and an advisor of either firm does.
  ('public.peos',                                       '{"advisor":"all","admin":"all","agent_b":"all","platform_admin":"all","former_agent":"all"}', NULL),
  ('public.peo_profile_versions',                       '{"advisor":1,"admin":"all","agent_b":1,"platform_admin":"all","former_agent":1}', NULL),
  ('public.peo_contacts',                               '{"advisor":"all","admin":"all","agent_b":"all","platform_admin":"all","former_agent":"all"}', NULL),
  -- PEO template workbooks (20261115140000): advisors read the records; anyone signed in reads a clean one's file
  -- (a PEO's blank form, filled in the reader's browser), nobody signed out.
  ('public.peo_census_templates',                       '{"advisor":"all","admin":"all","agent_b":"all","platform_admin":"all","former_agent":"all"}', NULL),
  ('storage.objects WHERE bucket_id = ''peo-templates''', '{"guest_a":"all","guest_b":"all","prospect_a":"all","prospect_b":"all","advisor":"all","admin":"all","advisor_as_guest":"all","agent_2":"all","lead_1":"all","agent_b":"all","owner_b":"all","platform_admin":"all","former_agent":"all"}', NULL),
  -- Firms, their teams and dated memberships (20261116090000): a current member reads their own firm and its teams, and
  -- their own membership; nobody else, prospects, guests and platform admins included.
  ('public.firms',                                      '{"advisor":1,"admin":1,"agent_2":1,"lead_1":1,"agent_b":1,"owner_b":1}', NULL),
  ('public.firm_teams',                                 '{"advisor":1,"admin":1,"agent_2":1,"lead_1":1,"agent_b":1,"owner_b":1}', NULL),
  ('public.firm_memberships',                           '{"advisor":1,"admin":1,"agent_2":1,"lead_1":1,"agent_b":1,"owner_b":1}', NULL),
  ('public.intake_lifecycle_events',                    '{}', '{"A":3,"B":1}'),
  ('public.intake_deletions',                           '{}', '{"A":1,"B":1}'),
  -- Monitoring is the platform admin's: advisors don't need failure codes, routes or account ids.
  ('public.ops_events',                                 '{"admin":"all","platform_admin":"all"}', NULL),
  ('public.ops_alerts',                                 '{"admin":"all","platform_admin":"all"}', NULL),
  -- AI call records (US-2.4a) are for a firm's members investigating its intake.
  ('public.ai_extraction_events',                       '{"admin":2,"platform_admin":1}', '{"A":1,"B":1}'),
  -- Reached only through SECURITY DEFINER functions, by nobody directly.
  ('public.outbox_events',                              '{}', NULL),
  -- The File ID sequence (20261104110000): taken by the certification trigger, read by nobody.
  ('public.submission_reference_counters',              '{}', NULL),
  ('public.email_delivery_events',                      '{}', NULL),
  ('public.email_suppressions',                         '{}', NULL),
  ('public.ai_request_log',                             '{}', NULL),
  ('public.ai_ip_log',                                  '{}', NULL),
  ('public.ai_global_usage',                            '{}', NULL);

CREATE FUNCTION pg_temp.matrix_callers() RETURNS text[] LANGUAGE sql AS $$
  SELECT ARRAY['signed_out', 'guest_a', 'guest_b', 'prospect_a', 'prospect_b', 'advisor', 'admin', 'advisor_as_guest',
               'agent_2', 'lead_1', 'agent_b', 'owner_b', 'platform_admin', 'former_agent', 'advisor_pw', 'advisor_pw_mfa', 'service']
$$;

DO $$
DECLARE
  m record;
  who text;
  total bigint;
  want bigint;
  seen bigint;
  token text;
  expect jsonb;
  cases integer := 0;
  wrong text := '';
BEGIN
  FOR m IN SELECT * FROM matrix ORDER BY src LOOP
    RESET ROLE;
    total := pg_temp.visible(m.src);
    IF total = 0 THEN RAISE EXCEPTION 'FAIL: % holds no rows, so the matrix proves nothing for it', m.src; END IF;
    IF m.firm_rows IS NOT NULL AND (LEAST((m.firm_rows ->> 'A')::bigint, (m.firm_rows ->> 'B')::bigint) < 1) THEN
      RAISE EXCEPTION 'FAIL: % holds no rows of one of the two firms, so the matrix proves nothing for it', m.src;
    END IF;
    expect := CASE WHEN m.firm_rows IS NULL THEN '{}'::jsonb
      ELSE '{"advisor":"A","admin":"A","agent_2":"A","lead_1":"A","agent_b":"B","owner_b":"B"}'::jsonb END || m.expect;
    FOREACH who IN ARRAY pg_temp.matrix_callers() LOOP
      token := CASE
        -- The advisor with a second factor is the advisor; without one they are a signed-in person with no role and no
        -- firm: their own profile and role row, and the PEO template workbooks everyone signed in reads.
        WHEN who = 'advisor_pw_mfa' THEN expect ->> 'advisor'
        WHEN who = 'advisor_pw' THEN CASE WHEN m.src IN ('public.profiles', 'public.user_roles') THEN '1'
                                          WHEN m.src LIKE '%peo-templates%' THEN 'all' ELSE '0' END
        ELSE expect ->> who
      END;
      want := CASE
        WHEN who = 'service' THEN total  -- the service role bypasses row security
        WHEN token = 'all' THEN total
        WHEN token IN ('A', 'B') THEN (m.firm_rows ->> token)::bigint
        ELSE COALESCE(token::bigint, 0)
      END;
      PERFORM pg_temp.become(who);
      seen := pg_temp.visible(m.src);
      RESET ROLE;
      IF seen <> want THEN
        wrong := wrong || format(E'\n  %s sees %s row(s) of %s, expected %s', who, seen, m.src, want);
      END IF;
      cases := cases + 1;
    END LOOP;
  END LOOP;
  IF wrong <> '' THEN RAISE EXCEPTION 'FAIL: the matrix is wrong for:%', wrong; END IF;
  PERFORM set_config('request.jwt.claims', '', false);
  RAISE NOTICE 'data_isolation: % matrix cases passed', cases;
END $$;

-- ---------- 2. someone else's intake ----------
-- Each intake is attacked by everyone who doesn't own it, by its id: with their own token, or none.
DO $$
DECLARE
  t record;
  who text;
  me uuid;
  cases integer := 0;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('guest_a', 'ga_open', 'census.csv', 'a'),
      ('guest_b', 'gb_open', 'roster.xlsx', 'a'),
      ('prospect_a', 'pa_cert', 'benefits.pdf', 'a'),
      ('prospect_b', 'pb_cert', 'payroll.csv', 'b')
    ) AS v(owner, intake, file, firm)
  LOOP
    DECLARE
      owner_id constant uuid := pg_temp.id(t.owner);
      sid constant uuid := pg_temp.id(t.intake);
      path constant text := owner_id || '/' || sid || '/' || t.file;
      doc uuid;
    BEGIN
      SELECT d.id INTO doc FROM public.documents d WHERE d.session_id = sid;

      FOR who IN SELECT pg_temp.outsiders(t.owner, t.firm) LOOP
        me := CASE WHEN who = 'signed_out' THEN NULL ELSE pg_temp.id(CASE WHEN who = 'advisor_as_guest' THEN 'advisor' ELSE who END) END;
        PERFORM pg_temp.become(who);

        -- Nothing of it reads: the row (answers, conversation, provenance), its documents and files, its
        -- certification, its owner's agreement.
        IF pg_temp.visible(format('public.chamber_sessions WHERE id = %L', sid)) <> 0
           OR pg_temp.visible(format('public.chamber_sessions WHERE id = %L AND transcript IS NOT NULL AND field_provenance IS NOT NULL', sid)) <> 0 THEN
          RAISE EXCEPTION 'FAIL: % can read %''s intake by its id', who, t.owner;
        END IF;
        IF pg_temp.visible(format('public.documents WHERE session_id = %L OR id = %L', sid, doc)) <> 0 THEN
          RAISE EXCEPTION 'FAIL: % can read %''s documents', who, t.owner;
        END IF;
        IF pg_temp.visible(format('storage.objects WHERE name LIKE %L', '%' || sid || '%')) <> 0 THEN
          RAISE EXCEPTION 'FAIL: % can read (and so sign a link to) a file stored under %''s intake', who, t.owner;
        END IF;
        IF pg_temp.visible(format('public.chamber_certifications WHERE session_id = %L', sid)) <> 0
           OR pg_temp.visible(format('public.intake_consents WHERE user_id = %L', owner_id)) <> 0
           OR pg_temp.visible(format('public.profiles WHERE user_id = %L', owner_id)) <> 0 THEN
          RAISE EXCEPTION 'FAIL: % can read %''s certification, consent or profile', who, t.owner;
        END IF;

        -- Nothing of it changes.
        PERFORM pg_temp.changes_nothing(format('UPDATE public.chamber_sessions SET chamber_data = %L WHERE id = %L', '{"company_name":"Hijacked"}', sid), who || ' changed ' || t.owner || '''s answers');
        PERFORM pg_temp.changes_nothing(format('UPDATE public.chamber_sessions SET transcript = %L, field_provenance = %L WHERE id = %L', '[]', '{}', sid), who || ' changed ' || t.owner || '''s conversation');
        PERFORM pg_temp.changes_nothing(format('UPDATE public.chamber_sessions SET user_id = %L WHERE id = %L', COALESCE(me, gen_random_uuid()), sid), who || ' took ' || t.owner || '''s intake');
        PERFORM pg_temp.changes_nothing(format('DELETE FROM public.chamber_sessions WHERE id = %L', sid), who || ' deleted ' || t.owner || '''s intake');
        PERFORM pg_temp.changes_nothing(format('UPDATE public.documents SET status = %L, category = %L WHERE id = %L', 'extracted', 'other', doc), who || ' changed ' || t.owner || '''s document');
        PERFORM pg_temp.changes_nothing(format('DELETE FROM public.documents WHERE id = %L', doc), who || ' deleted ' || t.owner || '''s document');
        PERFORM pg_temp.changes_nothing(format('UPDATE storage.objects SET name = name || %L WHERE name = %L', '.moved', path), who || ' moved ' || t.owner || '''s file');
        PERFORM pg_temp.changes_nothing(format('DELETE FROM storage.objects WHERE name = %L', path), who || ' deleted ' || t.owner || '''s file');
        PERFORM pg_temp.changes_nothing(format('UPDATE public.chamber_certifications SET signer_name = %L WHERE session_id = %L', 'Forged', sid), who || ' changed ' || t.owner || '''s certification');
        PERFORM pg_temp.changes_nothing(format('UPDATE public.profiles SET contact_name = %L WHERE user_id = %L', 'Forged', owner_id), who || ' changed ' || t.owner || '''s profile');

        -- Nothing attaches to it: no document row (in their own name or the owner's) and no stored file
        -- (in their own folder or the owner's).
        PERFORM pg_temp.refused(format('INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path) VALUES (%L, %L, %L, %L, %L)',
          COALESCE(me, gen_random_uuid()), sid, 'x.csv', '1 KB', COALESCE(me::text, 'anon') || '/' || sid || '/x.csv'), who || ' attached a document to ' || t.owner || '''s intake');
        PERFORM pg_temp.refused(format('INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path) VALUES (%L, %L, %L, %L, %L)',
          owner_id, sid, 'x.csv', '1 KB', owner_id || '/' || sid || '/x.csv'), who || ' attached a document in ' || t.owner || '''s name');
        PERFORM pg_temp.refused(format('INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)', 'documents', COALESCE(me::text, 'anon') || '/' || sid || '/x.csv'), who || ' stored a file under ' || t.owner || '''s intake');
        PERFORM pg_temp.refused(format('INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)', 'documents', owner_id || '/' || sid || '/x.csv'), who || ' stored a file in ' || t.owner || '''s folder');
        PERFORM pg_temp.refused(format('INSERT INTO public.intake_consents (user_id, consent_version, consent_text) VALUES (%L, %L, %L)', owner_id, 'forged', 'x'), who || ' recorded a consent for ' || t.owner);

        -- The functions that act on an intake by its id say nothing about it.
        IF who = 'signed_out' THEN
          PERFORM pg_temp.expect(format('SELECT public.archive_chamber_session(%L)', sid), '42501', 'a signed-out archive');
          PERFORM pg_temp.expect(format('SELECT public.prospect_submission_status(%L)', sid), '42501', 'a signed-out status read');
        ELSE
          PERFORM pg_temp.expect(format('SELECT public.archive_chamber_session(%L)', sid), 'PT404', who || ' archiving ' || t.owner || '''s intake');
          IF public.prospect_submission_status(sid) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: % read %''s pipeline status', who, t.owner; END IF;
          IF public.current_intake_consent_id(owner_id) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: % read %''s consent', who, t.owner; END IF;
        END IF;
        cases := cases + 1;
      END LOOP;

      -- Positive controls: the owner can do what the others couldn't (rolled back), so the refusals
      -- above are row security at work, not a broken table.
      PERFORM pg_temp.become(t.owner);
      IF pg_temp.visible(format('public.chamber_sessions WHERE id = %L AND transcript IS NOT NULL', sid)) <> 1
         OR pg_temp.visible(format('public.documents WHERE session_id = %L', sid)) <> 1
         OR pg_temp.visible(format('storage.objects WHERE name = %L', path)) <> 1 THEN
        RAISE EXCEPTION 'FAIL: % can''t read their own intake, document or file', t.owner;
      END IF;
      PERFORM pg_temp.expect(format('UPDATE public.chamber_sessions SET chosen_peo = %L WHERE id = %L', 'A PEO', sid), 'rows:1', t.owner || ' saving their own intake');
      PERFORM pg_temp.expect(format('UPDATE public.documents SET category = %L WHERE id = %L', 'other', doc), 'rows:1', t.owner || ' changing their own document');
      -- Not even the owner stores a file directly: document-upload checks its bytes and stores it (20261104130000).
      PERFORM pg_temp.expect(format('INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)', 'documents', owner_id || '/' || sid || '/new.csv'), '42501', t.owner || ' storing a file directly');
      PERFORM pg_temp.expect(format('INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path) VALUES (%L, %L, %L, %L, %L)',
        owner_id, sid, 'new.csv', '1 KB', owner_id || '/' || sid || '/new.csv'), 'rows:1', t.owner || ' adding a document');
      -- A certified intake keeps the file it was certified with, for the advisor (20261104112000); removing the
      -- document still succeeds for its owner. Any other file of theirs they can remove.
      PERFORM pg_temp.expect(format('DELETE FROM storage.objects WHERE name = %L', path),
        CASE WHEN t.intake IN ('pa_cert', 'pb_cert') THEN 'rows:0' ELSE 'rows:1' END, t.owner || ' removing their own file');
      RESET ROLE;
    END;
  END LOOP;

  -- The planted file in guest B's folder under guest A's intake belongs to neither.
  FOREACH who IN ARRAY ARRAY['guest_a', 'guest_b'] LOOP
    PERFORM pg_temp.become(who);
    IF pg_temp.visible(format('storage.objects WHERE name LIKE %L', '%/planted.csv')) <> 0 THEN
      RAISE EXCEPTION 'FAIL: % can read a file planted across folders', who;
    END IF;
  END LOOP;

  -- A guest reporting a failure can't tie it to someone else's intake; its own sticks.
  PERFORM pg_temp.become('guest_b');
  IF NOT public.report_client_event('upload_failed', 'probe', NULL, '/start', pg_temp.id('ga_open')) THEN RAISE EXCEPTION 'setup: report dropped'; END IF;
  IF NOT public.report_client_event('upload_failed', 'own', NULL, '/start', pg_temp.id('gb_open')) THEN RAISE EXCEPTION 'setup: report dropped'; END IF;
  RESET ROLE;
  IF (SELECT session_id FROM public.ops_events WHERE code = 'probe') IS NOT NULL
     OR (SELECT session_id FROM public.ops_events WHERE code = 'own') IS DISTINCT FROM pg_temp.id('gb_open') THEN
    RAISE EXCEPTION 'FAIL: a report kept a session id the reporter can''t see, or dropped its own';
  END IF;
  DELETE FROM public.ops_events WHERE code IN ('probe', 'own');

  PERFORM set_config('request.jwt.claims', '', false);
  RAISE NOTICE 'data_isolation: % outsider cases passed (4 intakes x their outsiders)', cases;
END $$;

-- ---------- 3. closed intakes, from their owner ----------
DO $$
DECLARE
  ga constant uuid := pg_temp.id('guest_a');
  closed text;
  sid uuid;
  doc uuid;
BEGIN
  PERFORM pg_temp.become('guest_a');

  -- Archived ("Start over") and revoked: gone, with their documents and files, and nothing changes them.
  FOREACH closed IN ARRAY ARRAY['ga_archived', 'ga_revoked'] LOOP
    sid := pg_temp.id(closed);
    IF pg_temp.visible(format('public.chamber_sessions WHERE id = %L', sid)) <> 0
       OR pg_temp.visible(format('public.documents WHERE session_id = %L', sid)) <> 0
       OR pg_temp.visible(format('storage.objects WHERE name LIKE %L', '%' || sid || '%')) <> 0 THEN
      RAISE EXCEPTION 'FAIL: the owner can still read the % intake, its documents or files', closed;
    END IF;
    PERFORM pg_temp.changes_nothing(format('UPDATE public.chamber_sessions SET chamber_data = %L WHERE id = %L', '{"company_name":"Back"}', sid), 'the owner changed the ' || closed || ' intake');
    PERFORM pg_temp.changes_nothing(format('UPDATE public.chamber_sessions SET status = %L WHERE id = %L', 'in_progress', sid), 'the owner reopened the ' || closed || ' intake');
    PERFORM pg_temp.changes_nothing(format('DELETE FROM storage.objects WHERE name LIKE %L', '%' || sid || '%'), 'the owner reached a file of the ' || closed || ' intake');
    PERFORM pg_temp.refused(format('INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path) VALUES (%L, %L, %L, %L, %L)',
      ga, sid, 'late.csv', '1 KB', ga || '/' || sid || '/late.csv'), 'a document added to the ' || closed || ' intake');
    PERFORM pg_temp.refused(format('INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)', 'documents', ga || '/' || sid || '/late.csv'), 'a file stored under the ' || closed || ' intake');
  END LOOP;

  -- Expired: readable, so the Chamber can say it expired, but nothing about it changes. Its documents can
  -- still be removed: that only removes the owner's own data ahead of the retention deletion (SR-5).
  sid := pg_temp.id('ga_expired');
  SELECT d.id INTO doc FROM public.documents d WHERE d.session_id = sid;
  IF pg_temp.visible(format('public.chamber_sessions WHERE id = %L AND status = %L', sid, 'expired')) <> 1
     OR pg_temp.visible(format('public.documents WHERE session_id = %L', sid)) <> 1
     OR pg_temp.visible(format('storage.objects WHERE name LIKE %L', '%' || sid || '%')) <> 1 THEN
    RAISE EXCEPTION 'FAIL: the owner can''t read their expired intake, its document or file';
  END IF;
  PERFORM pg_temp.changes_nothing(format('UPDATE public.chamber_sessions SET chamber_data = %L WHERE id = %L', '{"company_name":"Back"}', sid), 'the owner changed an expired intake');
  PERFORM pg_temp.changes_nothing(format('UPDATE public.chamber_sessions SET status = %L WHERE id = %L', 'in_progress', sid), 'the owner reopened an expired intake');
  PERFORM pg_temp.changes_nothing(format('UPDATE public.documents SET category = %L, status = %L WHERE id = %L', 'other', 'extracted', doc), 'the owner changed a document of an expired intake (SR-5)');
  PERFORM pg_temp.expect(format('INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path) VALUES (%L, %L, %L, %L, %L)',
    ga, sid, 'late.csv', '1 KB', ga || '/' || sid || '/late.csv'), 'EA002', 'a document added to an expired intake');
  PERFORM pg_temp.expect(format('INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)', 'documents', ga || '/' || sid || '/late.csv'), '42501', 'a file stored under an expired intake');
  PERFORM pg_temp.expect(format('DELETE FROM public.documents WHERE id = %L', doc), 'rows:1', 'the owner removing a document from an expired intake');

  -- Advisors still see every closed intake, read-only.
  PERFORM pg_temp.become('advisor');
  IF pg_temp.visible(format('public.chamber_sessions WHERE user_id = %L', ga)) <> 4 THEN RAISE EXCEPTION 'FAIL: an advisor can''t see every closed intake'; END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', false);
  RAISE NOTICE 'data_isolation: closed intake cases passed';
END $$;

-- ---------- 4. functions: who may call what ----------
-- Every function anon or authenticated can execute, why, and for the ones that are only for advisors or
-- admins, a call that must be refused (42501) for everyone else. %1$s is a real certified intake's id and
-- %2$s an id that matches nothing. The catalogue check in part 5 keeps this list complete.
--   anyone        callable signed out; reads nothing about anyone but the caller
--   own           signed-in callers, acting only on their own rows
--   helper        called as the signed-in user by a trigger or an invoker function; holds no data itself
--   advisor       refuses anyone who isn't an advisor or admin
--   admin         refuses anyone who isn't an admin, advisors included
--   signed_in     any signed-in caller, guests included; reads only what row security lets the caller read
CREATE TEMP TABLE callable (fn text PRIMARY KEY, audience text NOT NULL, call text, why text NOT NULL);
GRANT SELECT ON callable TO anon, authenticated, service_role;
INSERT INTO callable VALUES
  ('has_role(_role app_role)',                 'anyone',  NULL, 'row security policies call it as the caller; answers about the caller only'),
  ('is_advisor()',                             'anyone',  NULL, 'row security policies and RequireAdvisor call it; answers about the caller only'),
  ('firm_role(p_firm_id uuid)',               'own',     NULL, 'the caller''s own current role in a firm, NULL for anyone not a member; signed-out callers can''t call it'),
  ('is_firm_member(p_firm_id uuid)',          'own',     NULL, 'whether the caller is a current member of a firm; about the caller only; signed-out callers can''t call it'),
  ('can_see_firm_record(p_firm_id uuid, p_owner_id uuid)', 'own', NULL, 'whether the caller may see a record of a firm that a person owns: a current member of the firm, by level; about the caller only; signed-out callers can''t call it'),
  ('intake_in_my_firm(p_session_id uuid)',    'own',     NULL, 'row security policies call it as the caller: whether an intake is of a firm the caller currently belongs to; false for anyone else'),
  ('intake_folder_in_my_firm(p_folder text)', 'own',     NULL, 'the storage policies call it as the caller: the same for the intake a folder names; false for anything that is not an intake''s id'),
  ('quote_request_in_my_firm(p_quote_request_id bigint)', 'own', NULL, 'row security policies call it as the caller: whether a quote request is on an intake of a firm the caller currently belongs to'),
  ('can_read_peo_mail(p_quote_request_id bigint)', 'own', NULL, 'the mail policies call it as the caller: a message on a quote request is its firm''s members''; held mail (none) is a platform admin''s'),
  ('intake_owner_in_my_firm(p_user_id uuid)', 'own',     NULL, 'the consent and profile policies call it as the caller: whether a person owns an intake of a firm the caller currently belongs to'),
  ('colleague_in_my_firm(p_user_id uuid)',    'own',     NULL, 'the profile policy calls it as the caller: whether a person is a current member of a firm the caller currently belongs to'),
  ('firm_public_name(p_address text)',       'anyone',  NULL, 'what a firm address shows before sign-in: the name of any firm that exists (approved or waiting), NULL only for an address no firm holds; nothing else'),
  ('is_member_of_firm_address(p_address text)', 'own',   NULL, 'whether the caller is a current member of the firm at an address; about the caller only; signed-out callers can''t call it'),
  ('sign_up_firm(p_name text, p_address text)', 'own',     NULL, 'a signed-in person with a verified email makes a firm of their own and becomes its owner; refuses guests and unverified accounts; acts only for the caller'),
  ('admin_waiting_firms()',                  'admin',   'SELECT * FROM public.admin_waiting_firms()', 'the firms waiting for approval, for platform admins only (D-16: an admin is no firm member)'),
  ('admin_decide_firm(p_firm_id uuid, p_approve boolean, p_note text)', 'admin', 'SELECT public.admin_decide_firm(%2$L, true, NULL)', 'a platform admin approves or refuses a waiting firm, once (Q-1.2)'),
  ('default_firm_id()',                      'anyone',  NULL, 'a constant: Edgar Allan Advisory''s id; the intake firm column default calls it as the writer'),
  ('membership_is_current(p_valid_from timestamp with time zone, p_valid_until timestamp with time zone)', 'anyone', NULL,
                                                                     'pure: whether a membership has begun and not ended, as of now; reads nothing'),
  ('second_factor_rule_met()',                'anyone',  NULL, 'has_role calls it as the caller; answers from the caller''s own token claims only (supabase/tests/second_factor.sql)'),
  ('advisor_needs_second_factor()',            'own',     NULL, 'whether the caller''s own password sign-in is all that holds back their role; false for anyone else'),
  ('my_mailbox()',                             'own',     NULL, 'whether the caller''s own mailbox is connected, and to whom; never the token; "not connected" for anyone else'),
  ('report_client_event(p_kind text, p_code text, p_detail text, p_route text, p_session_id uuid)', 'anyone', NULL,
                                                                     'browser failure reports, signed-out visitors included; redacted, capped, keeps only a session the caller can see'),
  ('intake_consent_version()',                 'anyone',  NULL, 'a constant: the consent wording in force'),
  ('is_source_code(p_code text)',              'anyone',  NULL, 'pure: whether a referral or campaign code is well formed; the intake source check constraints call it as the writer'),
  ('intake_missing_required(d jsonb)',         'helper',  NULL, 'the certification gate''s trigger calls it as the signed-in prospect; pure: required answers missing from the jsonb it is given'),
  ('intake_answers_present(p_data jsonb)',     'helper',  NULL, 'pure: which answers the jsonb it is given holds; behind intake_missing_required and intake_required_items'),
  ('intake_required_items(p_data jsonb, p_provenance jsonb, p_verified text[])', 'helper', NULL, 'pure: each required item''s state for the jsonb it is given; behind the advisor queue (B-2.2)'),
  ('provenance_entry_status(p_entry jsonb)',   'helper',  NULL, 'pure: a stored provenance entry''s status, as the browser reads it'),
  ('provenance_source_is_valid(p_source jsonb)', 'helper', NULL, 'pure: whether a provenance source is well formed'),
  ('session_verified_fields(p_session_id uuid)', 'own',   NULL, 'the field names an advisor verified on the caller''s own intake (any intake, for advisors); empty for anyone else''s'),
  ('intake_conflicting_required(p jsonb)',     'anyone',  NULL, 'pure: required fields in conflict in the provenance it is given'),
  ('is_prospect_visible_status(s text)',       'anyone',  NULL, 'pure: whether a status name is shared with prospects'),
  ('is_reviewable_field(f text)',              'helper',  NULL, 'pure: whether a field name can be reviewed; reads chamber_data_field_kind, so closed to anon with it'),
  ('ops_clean_code(p_code text)',              'anyone',  NULL, 'pure: cleans a failure code'),
  ('ops_redact(p_text text, p_max integer)',   'anyone',  NULL, 'pure: redacts free text'),
  ('ops_event_retention()',                    'anyone',  NULL, 'a constant: how long monitoring events are kept'),
  ('archive_chamber_session(p_session_id uuid)', 'own',   NULL, 'the prospect''s Start over; PT404 for anyone else''s intake'),
  ('record_intake_consent(p_version text, p_text text)', 'own', NULL, 'records the caller''s own agreement'),
  ('prospect_submission_status(p_session_id uuid)', 'own', NULL, 'the caller''s own certified intake''s shared status; null for anyone else''s'),
  ('prospect_information_request(p_session_id uuid)', 'own', NULL, 'the advisor''s open request on the caller''s own intake; null for anyone else''s'),
  ('record_manuscript_download(p_session_id uuid)', 'own', NULL, 'records a download of the caller''s own certified intake''s Manuscript; nothing for anyone else''s'),
  ('prospect_final_manuscript(p_session_id uuid)', 'own', NULL, 'the caller''s own certified intake''s final Manuscript (latest version, current certification); nothing for anyone else''s'),
  ('is_own_final_manuscript(p_name text)',     'helper',  NULL, 'the manuscripts read policy calls it as the caller; true only for the file of the caller''s own final Manuscript'),
  ('is_certified_evidence(p_name text)',       'helper',  NULL, 'the documents delete policy calls it as the caller; answers only about the caller''s own certified intakes'),
  ('is_withheld_document_file(p_name text)',   'helper',  NULL, 'the documents read policies call it as the reader; answers only whether the document stored at that exact path has a scan that hasn''t passed'),
  ('consume_ai_quota(per_minute integer, per_day integer)', 'own', NULL, 'the AI functions call it with the caller''s token; spends only the caller''s own allowance (SR-6)'),
  ('current_intake_consent_id(p_user_id uuid)', 'helper', NULL, 'the consent triggers call it as the caller; row security limits it to the caller''s own agreement (all, for advisors)'),
  ('chamber_data_census_row_error(census_row jsonb, base text, OUT path text, OUT reason text)', 'helper', NULL, 'intake validation trigger; pure'),
  ('chamber_data_error(d jsonb, OUT path text, OUT reason text)', 'helper', NULL, 'intake validation trigger; pure'),
  ('extra_answers_error(p jsonb, OUT path text, OUT reason text)', 'helper', NULL, 'extra answers validation trigger; pure'),
  ('extra_answer_value_is_valid(v jsonb, kind text)', 'helper', NULL, 'pure: whether a value answers a question of that kind'),
  ('chamber_data_field_kind(field text)',      'helper',  NULL, 'intake validation trigger; pure'),
  ('chamber_data_scalar_reason(kind text, val jsonb)', 'helper', NULL, 'intake validation trigger; pure'),
  ('chamber_data_row_field_kind(list text, key text)', 'helper', NULL, 'intake validation trigger; pure'),
  ('chamber_data_row_list_max(list text)',     'helper',  NULL, 'intake validation trigger; pure'),
  ('chamber_transcript_error(t jsonb, OUT path text, OUT reason text)', 'helper', NULL, 'transcript validation trigger; pure'),
  ('chamber_data_is_text(v jsonb, max_length integer)', 'helper', NULL, 'intake validation trigger; pure'),
  ('chamber_data_is_whole_number(v jsonb, max_value numeric)', 'helper', NULL, 'intake validation trigger; pure'),
  ('chamber_data_person_error(person jsonb, base text, OUT path text, OUT reason text)', 'helper', NULL, 'intake validation trigger; pure'),
  ('is_us_state_code(code text)',              'helper',  NULL, 'intake and profile validation; pure'),
  ('is_valid_phone(phone text)',               'helper',  NULL, 'intake and profile validation; pure'),
  ('intake_draft_retention()',                 'helper',  NULL, 'the lifecycle trigger reads the window as the caller; a constant'),
  ('closed_draft_retention()',                 'helper',  NULL, 'a constant: the closed-draft window'),
  ('submitted_record_retention()',             'helper',  NULL, 'a constant: the submitted-record window'),
  ('email_event_retention()',                  'helper',  NULL, 'a constant: the email event window'),
  ('intake_deletion_max_attempts()',           'helper',  NULL, 'a constant: purge attempts before an alert'),
  ('ai_event_retention()',                     'anyone',  NULL, 'a constant: how long AI call records are kept'),
  ('ai_event_names_ok(names text[], paths boolean)', 'helper', NULL, 'pure: the AI call records'' check constraint'),
  ('intake_accepts_files(p_session text)',     'helper',  NULL, 'the upload policies call it as the uploader; answers only whether an intake exists with no deletion open (and holds the row against one)'),
  ('ops_alert_rules()',                        'helper',  NULL, 'constants: the alert thresholds'),
  ('advisor_list_submissions(p_status text, p_search text, p_limit integer, p_offset integer, p_needs_action boolean, p_waiting boolean, p_sort text)', 'advisor',
                                                                     'SELECT count(*) FROM public.advisor_list_submissions(NULL, NULL, 25, 0, true, true, ''oldest_waiting'')', 'the queue: one page, searched, filtered, sorted'),
  ('advisor_record_quote_send(p_session_id uuid, p_peo text, p_sent_on date)', 'advisor',
                                                                     'SELECT public.advisor_record_quote_send(%1$L, ''Justworks'', NULL)', 'recording a send to a PEO'),
  ('advisor_update_quote_request(p_quote_request_id bigint, p_status text, p_received_on date, p_expires_on date, p_start_on date, p_admin_fee_pepm numeric, p_note text)', 'advisor',
                                                                     'SELECT public.advisor_update_quote_request(0, ''declined'')', 'recording a PEO''s answer'),
  ('advisor_note_underwriter_question(p_quote_request_id bigint, p_question text)', 'advisor',
                                                                     'SELECT public.advisor_note_underwriter_question(0, ''probe'')', 'noting an underwriter''s question'),
  ('advisor_open_quote_request_thread(p_quote_request_id bigint, p_seen_through timestamp with time zone)', 'advisor',
                                                                     'SELECT public.advisor_open_quote_request_thread(0)', 'marking a PEO thread as opened'),
  ('advisor_add_quote_request_note(p_quote_request_id bigint, p_kind text, p_noted_on date, p_body text)', 'advisor',
                                                                     'SELECT public.advisor_add_quote_request_note(0, ''call'', current_date, ''probe'')', 'adding a note to a quote request'),
  ('advisor_correct_quote_request_note(p_note_id bigint, p_kind text, p_noted_on date, p_body text)', 'advisor',
                                                                     'SELECT public.advisor_correct_quote_request_note(0, ''call'', current_date, ''probe'')', 'correcting a quote request note'),
  ('advisor_reissue_quote_request_address(p_quote_request_id bigint)', 'advisor',
                                                                     'SELECT public.advisor_reissue_quote_request_address(0)', 'revoking and reissuing a quote request''s reply address'),
  ('advisor_email_problems()',                 'advisor', 'SELECT count(*) FROM public.advisor_email_problems()', 'email problems on the queue'),
  ('advisor_list_outbox_events(p_status text, p_limit integer)', 'advisor', 'SELECT count(*) FROM public.advisor_list_outbox_events(NULL, 10)', 'the outbox page'),
  ('advisor_outbox_summary()',                 'advisor', 'SELECT count(*) FROM public.advisor_outbox_summary()', 'the outbox page'),
  ('advisor_requeue_outbox_event(event_id uuid, rebuild_payload boolean)', 'advisor', 'SELECT public.advisor_requeue_outbox_event(%2$L, false)', 'retrying a dead email'),
  ('set_submission_status(p_session_id uuid, p_status text, p_note text, p_won_quote_request_id bigint)', 'advisor', 'SELECT public.set_submission_status(%1$L, ''information_requested'', ''probe'')', 'the pipeline'),
  ('set_submission_needs_action(p_session_id uuid, p_needs_action boolean, p_note text)', 'advisor',
                                                                     'SELECT public.set_submission_needs_action(%1$L, true, ''probe'')', 'needs advisor action'),
  ('review_submission_field(p_session_id uuid, p_field text, p_review_state text, p_correction text, p_value jsonb, p_reason text, p_answer jsonb)', 'advisor',
                                                                     'SELECT public.review_submission_field(%1$L, ''company_name'', ''flagged'')', 'field review'),
  ('record_manuscript_version(p_session_id uuid, p_version integer, p_storage_path text, p_pdf_sha256 text, p_review_event_id bigint, p_corrections_applied integer, p_sensitive_revealed boolean, p_certified_data_hash text, p_certified_at timestamp with time zone)', 'advisor',
                                                                     'SELECT public.record_manuscript_version(%1$L, 2, %1$L || ''/probe.pdf'', repeat(''d'', 64), 0, 0, false, NULL, NULL)', 'storing a Manuscript version'),
  ('retention_review_due(p_limit integer)',    'advisor', 'SELECT count(*) FROM public.retention_review_due(10)', 'submitted records due for review'),
  ('advisor_request_information(p_session_id uuid, p_message text, p_fields text[], p_extra_questions jsonb)', 'advisor',
                                                                     'SELECT public.advisor_request_information(%1$L, ''probe'', ''{}'')', 'asking the prospect for information'),
  ('advisor_intake_funnel(p_from timestamp with time zone, p_to timestamp with time zone)', 'advisor',
                                                                     'SELECT count(*) FROM public.advisor_intake_funnel(now() - interval ''1 day'', now())', 'the pilot funnel'),
  ('advisor_intake_sources(p_from timestamp with time zone, p_to timestamp with time zone)', 'advisor',
                                                                     'SELECT count(*) FROM public.advisor_intake_sources(now() - interval ''1 day'', now())', 'the funnel by source'),
  ('advisor_add_referral_partner(p_code text, p_name text, p_kind text, p_firm_id uuid)', 'advisor',
                                                                     'SELECT public.advisor_add_referral_partner(''probe-partner'', ''Probe'', ''other'')', 'adding a referral partner'),
  ('advisor_update_referral_partner(p_code text, p_name text, p_kind text, p_firm_id uuid)', 'advisor',
                                                                     'SELECT public.advisor_update_referral_partner(''acme-cfo'', ''Probe'', ''other'')', 'renaming a referral partner'),
  ('revoke_chamber_session(p_session_id uuid, p_reason text)', 'admin', 'SELECT public.revoke_chamber_session(%2$L, ''probe'')', 'closing a draft for good'),
  ('admin_add_allowed_organisation(p_provider text, p_org_id text, p_label text)', 'admin', 'SELECT public.admin_add_allowed_organisation(''probe'', ''probe'', ''probe'')', 'adding an organisation whose members get the advisor role'),
  ('admin_remove_allowed_organisation(p_id bigint)', 'admin', 'SELECT public.admin_remove_allowed_organisation(0)', 'removing one'),
  ('claim_advisor_role_by_organisation()', 'own', NULL, 'the advisor role for a sign-in whose provider-vouched organisation an admin allowed; reads only the caller''s own sign-in claims, grants nothing to a guest or anyone else'),
  ('request_intake_deletion(p_session_id uuid, p_reason text)', 'admin', 'SELECT public.request_intake_deletion(%2$L, ''probe'')', 'asking for a deletion'),
  ('retry_intake_deletion(p_deletion_id uuid)', 'admin',  'SELECT public.retry_intake_deletion(%2$L)', 'retrying a failed deletion'),
  ('admin_ops_summary(p_hours integer)',       'admin',   'SELECT count(*) FROM public.admin_ops_summary(24)', 'monitoring counts'),
  ('peo_catalog()',                            'signed_in', NULL, 'the PEOs and each one''s published profile; never a contact or an admin''s id, and for anyone but an advisor no person''s name'),
  ('admin_add_peo(p_name text)',               'admin',   'SELECT public.admin_add_peo(''Probe PEO'')', 'adding a PEO'),
  ('admin_save_peo_profile(p_peo_id bigint, p_profile jsonb, p_draft_revision uuid, p_in_use_version integer)', 'admin', 'SELECT public.admin_save_peo_profile(0, ''{}'', NULL, NULL)', 'saving a PEO''s draft profile, based on the draft as the editor opened it'),
  ('admin_publish_peo_profile(p_peo_id bigint, p_draft_revision uuid)', 'admin', 'SELECT public.admin_publish_peo_profile(0, NULL)', 'publishing the draft the admin reviewed'),
  ('admin_set_peo_listed(p_peo_id bigint, p_listed boolean)', 'admin', 'SELECT public.admin_set_peo_listed(0, true)', 'listing a PEO, or not'),
  ('admin_recheck_peo_profile(p_peo_id bigint, p_sources jsonb)', 'admin', 'SELECT public.admin_recheck_peo_profile(0, ''{"answers": {}}'')', 'checked again: a new published version with new sources'),
  ('admin_discard_peo_draft(p_peo_id bigint)', 'admin', 'SELECT public.admin_discard_peo_draft(0)', 'discarding a PEO''s draft profile'),
  ('admin_register_census_template(p_peo_id bigint, p_file_name text, p_size_bytes integer, p_sha256 text)', 'admin',
                                                                     'SELECT public.admin_register_census_template(0, ''x.xlsx'', 1, NULL)', 'recording an upload of a PEO template workbook, before its scan'),
  ('is_clean_census_template_file(p_name text)', 'signed_in', NULL, 'the storage policy on peo-templates: whether a file is a clean template''s; names no one'),
  ('clean_template_workbook_path(p_peo_id bigint, p_template_id bigint)', 'signed_in', NULL, 'where a clean PEO template workbook''s file is, to read it; a PEO''s blank form, names no one');

DO $$
DECLARE
  c record;
  who text;
  stmt text;
  r text;
  cases integer := 0;
  sid constant uuid := pg_temp.id('pa_cert');
  nobody constant uuid := gen_random_uuid();
BEGIN
  FOR c IN SELECT * FROM callable WHERE audience IN ('advisor', 'admin') ORDER BY fn LOOP
    stmt := format(c.call, sid, nobody);
    FOREACH who IN ARRAY ARRAY['signed_out', 'guest_a', 'prospect_a', 'prospect_b', 'advisor_as_guest', 'advisor', 'admin'] LOOP
      PERFORM pg_temp.become(who);
      r := pg_temp.attempt(stmt);
      RESET ROLE;
      IF (c.audience = 'advisor' AND who IN ('advisor', 'admin')) OR (c.audience = 'admin' AND who = 'admin') THEN
        IF r = '42501' THEN RAISE EXCEPTION 'FAIL: % was refused % (%)', who, c.fn, stmt; END IF;
      ELSIF r <> '42501' THEN
        RAISE EXCEPTION 'FAIL: % calling % gave %, expected 42501', who, c.fn, r;
      END IF;
      cases := cases + 1;
    END LOOP;
  END LOOP;

  -- Service-only work: refused to every API role but the service role. A sample by call; part 5 checks the
  -- privilege of every function.
  FOREACH stmt IN ARRAY ARRAY[
    'SELECT public.expire_idle_intakes(1)',
    'SELECT count(*) FROM public.claim_outbox_events(ARRAY[''advisor_notification''], 1, 5, 600)',
    'SELECT public.reconcile_outbox_events(1)',
    'SELECT public.consume_ip_quota(repeat(''b'', 64), 20, 400)',
    'SELECT public.consume_global_ai_budget(2000)',
    'SELECT public.record_ops_event(''ai_failed'', ''probe'', NULL, NULL, NULL, NULL)',
    'SELECT count(*) FROM public.claim_ops_alerts()',
    'SELECT public.run_retention()',
    'SELECT public.queue_draft_expiry_reminders(1)',
    format('SELECT public.record_document_uploaded(%L)', nobody),
    'SELECT public.record_inbound_mail(''probe'', ARRAY[''x''], ''a@b.example'', NULL, NULL, NULL, NULL, NULL, false, NULL, false, NULL)',
    'SELECT public.record_inbound_attachment(0, ''probe'', ''x.pdf'', NULL, 1, NULL)',
    'SELECT public.finish_inbound_attachment(0, ''clean'', NULL, ''peo-mail'', ''x'')',
    format('SELECT public.plan_mail_move(0, NULL, %L)', nobody),
    format('SELECT public.apply_mail_move(0, NULL, %L, NULL)', nobody),
    format('SELECT public.plan_held_mail_discard(0, %L)', nobody),
    format('SELECT public.finish_held_mail_discard(0, %L)', nobody),
    'SELECT count(*) FROM public.held_mail_due(1)',
    format('SELECT public.mailbox_store(%L, ''google'', ''advisor@example.test'', ''https://www.googleapis.com/auth/gmail.send'', ''ciphertext'', ''iv'')', pg_temp.id('advisor')),
    format('SELECT public.mailbox_secret(%L)', nobody),
    format('SELECT public.mailbox_delete(%L)', nobody),
    'SELECT public.queue_retention_deletions(1)',
    'SELECT count(*) FROM public.claim_intake_deletions(1, 600)',
    'SELECT count(*) FROM public.claim_document_scans(1, 60)',
    'SELECT count(*) FROM public.document_scan_orphans(10)',
    format('SELECT count(*) FROM public.intake_stored_files(%L, %L)', sid, pg_temp.id('prospect_a')),
    format('SELECT public.complete_intake_deletion(%L, 0)', nobody),
    format('SELECT public.fail_intake_deletion(%L, ''probe'', 60)', nobody),
    'SELECT public.record_census_template_scan(0, ''failed'', NULL)'
  ] LOOP
    FOREACH who IN ARRAY ARRAY['signed_out', 'guest_a', 'prospect_a', 'advisor', 'admin'] LOOP
      PERFORM pg_temp.become(who);
      r := pg_temp.attempt(stmt);
      RESET ROLE;
      IF r <> '42501' THEN RAISE EXCEPTION 'FAIL: % running % gave %, expected 42501', who, stmt, r; END IF;
      cases := cases + 1;
    END LOOP;
    PERFORM pg_temp.become('service');
    r := pg_temp.attempt(stmt);
    RESET ROLE;
    IF r = '42501' THEN RAISE EXCEPTION 'FAIL: the service role was refused %', stmt; END IF;
    cases := cases + 1;
  END LOOP;
  PERFORM set_config('request.jwt.claims', '', false);
  RAISE NOTICE 'data_isolation: % function cases passed', cases;
END $$;

-- ---------- 4b. prospects against advisor records; advisors against everything they don't own ----------
DO $$
DECLARE
  sid constant uuid := pg_temp.id('pa_cert');
  pa constant uuid := pg_temp.id('prospect_a');
  adv constant uuid := pg_temp.id('advisor');
  doc uuid := (SELECT d.id FROM public.documents d WHERE d.session_id = pg_temp.id('pa_cert'));
  ms text := (SELECT v.storage_path FROM public.manuscript_versions v WHERE v.session_id = pg_temp.id('pa_cert'));
  t text;
  who text;
BEGIN
  -- The prospect whose submission it is sees none of the advisor's work on it, and can't add to it.
  FOREACH who IN ARRAY ARRAY['prospect_a', 'guest_a', 'signed_out'] LOOP
    PERFORM pg_temp.become(who);
    FOREACH t IN ARRAY ARRAY['advisor_notes', 'advisor_field_reviews', 'advisor_review_events', 'submission_workflow',
                             'submission_status_history', 'manuscript_versions', 'intake_lifecycle_events', 'outbox_events',
                             'intake_deletions', 'ops_events', 'ai_extraction_events', 'document_events'] LOOP
      IF pg_temp.visible(format('public.%I WHERE session_id = %L', t, sid)) <> 0 THEN
        RAISE EXCEPTION 'FAIL: % can read % about prospect A''s submission', who, t;
      END IF;
    END LOOP;
    -- Only their own final Manuscript's file, for the prospect whose submission it is.
    IF pg_temp.visible(format('storage.objects WHERE bucket_id = %L AND name IS DISTINCT FROM %L', 'manuscripts',
                              CASE WHEN who = 'prospect_a' THEN ms END)) <> 0 THEN
      RAISE EXCEPTION 'FAIL: % can read a stored Manuscript that isn''t their final one', who;
    END IF;
    PERFORM pg_temp.refused(format('INSERT INTO public.advisor_notes (session_id, author_id, body) VALUES (%L, %L, %L)', sid, COALESCE(pa, adv), 'x'), who || ' adding an advisor note');
    PERFORM pg_temp.refused(format('INSERT INTO public.user_roles (user_id, role) VALUES (%L, %L)', pa, 'advisor'), who || ' granting a role');
    PERFORM pg_temp.refused(format('INSERT INTO public.ops_events (kind, source) VALUES (%L, %L)', 'app_error', 'forged'), who || ' writing an ops event directly');
    PERFORM pg_temp.refused(format('INSERT INTO public.intake_deletions (session_id, trigger, reason) VALUES (%L, %L, %L)', sid, 'request', 'x'), who || ' queueing a deletion directly');
    PERFORM pg_temp.refused(format('INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)', 'manuscripts', sid || '/forged.pdf'), who || ' storing a Manuscript');
  END LOOP;
  -- What the prospect is meant to see: the shared status of their own submission, and its final Manuscript.
  PERFORM pg_temp.become('prospect_a');
  IF public.prospect_submission_status(sid) IS DISTINCT FROM 'under_review' THEN RAISE EXCEPTION 'FAIL: prospect A can''t see their own shared status'; END IF;
  IF (SELECT f.storage_path FROM public.prospect_final_manuscript(sid) f) IS DISTINCT FROM ms
     OR pg_temp.visible(format('storage.objects WHERE bucket_id = %L AND name = %L', 'manuscripts', ms)) <> 1 THEN
    RAISE EXCEPTION 'FAIL: prospect A can''t fetch their own final Manuscript';
  END IF;

  -- Advisors: read the operational data they work with, nothing beyond it, and change nothing a prospect owns.
  FOREACH who IN ARRAY ARRAY['advisor', 'advisor_as_guest'] LOOP
    PERFORM pg_temp.become(who);
    IF pg_temp.visible('public.ops_events') <> 0 OR pg_temp.visible('public.ops_alerts') <> 0 THEN RAISE EXCEPTION 'FAIL: % can read monitoring events', who; END IF;
    IF pg_temp.visible(format('public.user_roles WHERE user_id <> %L', adv)) <> 0 THEN RAISE EXCEPTION 'FAIL: % can read other people''s roles', who; END IF;
    PERFORM pg_temp.changes_nothing(format('UPDATE public.chamber_sessions SET chamber_data = %L WHERE id = %L', '{"company_name":"Advisor edit"}', sid), who || ' changed a prospect''s answers');
    PERFORM pg_temp.changes_nothing(format('UPDATE public.chamber_sessions SET transcript = %L WHERE id = %L', '[]', sid), who || ' changed a prospect''s conversation');
    PERFORM pg_temp.changes_nothing(format('DELETE FROM public.chamber_sessions WHERE id = %L', sid), who || ' deleted an intake');
    PERFORM pg_temp.changes_nothing(format('UPDATE public.documents SET status = %L WHERE id = %L', 'extracted', doc), who || ' changed a prospect''s document');
    PERFORM pg_temp.changes_nothing(format('DELETE FROM public.documents WHERE id = %L', doc), who || ' deleted a prospect''s document');
    PERFORM pg_temp.changes_nothing(format('DELETE FROM storage.objects WHERE bucket_id = %L', 'documents'), who || ' deleted a prospect''s file');
    PERFORM pg_temp.changes_nothing(format('UPDATE storage.objects SET name = name || %L WHERE bucket_id = %L', '.x', 'documents'), who || ' moved a prospect''s file');
    PERFORM pg_temp.refused(format('INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)', 'documents', pa || '/' || sid || '/advisor.csv'), who || ' storing a file in a prospect''s folder');
    PERFORM pg_temp.refused(format('INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path) VALUES (%L, %L, %L, %L, %L)',
      adv, sid, 'a.csv', '1 KB', adv || '/' || sid || '/a.csv'), who || ' attaching a document to a prospect''s intake');
    PERFORM pg_temp.changes_nothing(format('UPDATE public.profiles SET contact_name = %L WHERE user_id = %L', 'x', pa), who || ' changed a prospect''s profile');
    PERFORM pg_temp.changes_nothing(format('UPDATE public.chamber_certifications SET signer_name = %L WHERE session_id = %L', 'x', sid), who || ' changed a certification');
    PERFORM pg_temp.changes_nothing(format('DELETE FROM public.chamber_certifications WHERE session_id = %L', sid), who || ' deleted a certification');
    PERFORM pg_temp.changes_nothing(format('UPDATE public.intake_consents SET consent_text = %L', 'x'), who || ' changed a consent record');
    -- Delete nothing, even of their own records.
    PERFORM pg_temp.changes_nothing(format('DELETE FROM public.advisor_notes WHERE session_id = %L', sid), who || ' deleted a note');
    PERFORM pg_temp.changes_nothing(format('UPDATE public.advisor_notes SET body = %L WHERE session_id = %L', 'x', sid), who || ' edited a note');
    PERFORM pg_temp.changes_nothing(format('DELETE FROM public.submission_status_history WHERE session_id = %L', sid), who || ' deleted status history');
    PERFORM pg_temp.changes_nothing(format('DELETE FROM public.advisor_review_events WHERE session_id = %L', sid), who || ' deleted review history');
    PERFORM pg_temp.changes_nothing(format('DELETE FROM public.manuscript_versions WHERE session_id = %L', sid), who || ' deleted a Manuscript version');
    PERFORM pg_temp.changes_nothing(format('DELETE FROM storage.objects WHERE bucket_id = %L AND name = %L', 'manuscripts', ms), who || ' deleted a recorded Manuscript');
    PERFORM pg_temp.changes_nothing('DELETE FROM public.intake_lifecycle_events', who || ' deleted lifecycle records');
    PERFORM pg_temp.changes_nothing('DELETE FROM public.intake_deletions', who || ' deleted deletion records');
    PERFORM pg_temp.changes_nothing(format('UPDATE public.intake_deletions SET status = %L', 'done'), who || ' marked a deletion done');
    -- Grant no roles, to anyone.
    PERFORM pg_temp.refused(format('INSERT INTO public.user_roles (user_id, role) VALUES (%L, %L)', adv, 'admin'), who || ' making themselves admin');
    PERFORM pg_temp.changes_nothing(format('UPDATE public.user_roles SET role = %L WHERE user_id = %L', 'admin', adv), who || ' promoting themselves');
    PERFORM pg_temp.changes_nothing(format('DELETE FROM public.user_roles WHERE user_id <> %L', adv), who || ' revoking someone''s role');
  END LOOP;

  -- The advisor's account behind a guest token is a guest: none of the advisor-only data.
  PERFORM pg_temp.become('advisor_as_guest');
  IF pg_temp.visible('public.chamber_sessions') <> 0 OR pg_temp.visible('public.advisor_notes') <> 0
     -- A clean PEO template workbook is anyone's who is signed in (the matrix above); no other file is a guest's.
     OR pg_temp.visible('public.intake_consents') <> 0 OR pg_temp.visible('storage.objects WHERE bucket_id <> ''peo-templates''') <> 0 THEN
    RAISE EXCEPTION 'FAIL: a guest token on an advisor''s account reads advisor data';
  END IF;

  -- The PEO catalog (20261115090000), the only way a prospect reads a PEO: as each caller, it never holds a PEO
  -- contact or an admin's id, and only advisors read the name of the person at the PEO a source names (TriNet's
  -- minimum headcount was checked with Dana Reyes) or the contacts' source. Signed out, it is refused.
  FOREACH who IN ARRAY ARRAY['signed_out', 'guest_a', 'guest_b', 'prospect_a', 'prospect_b', 'advisor_as_guest', 'advisor', 'admin'] LOOP
    PERFORM pg_temp.become(who);
    IF who = 'signed_out' THEN
      PERFORM pg_temp.refused('SELECT public.peo_catalog()', 'a signed-out caller reading the PEO catalog');
      CONTINUE;
    END IF;
    DECLARE
      catalog constant text := public.peo_catalog()::text;
      trinet constant jsonb := (SELECT p -> 'profile' FROM jsonb_array_elements(public.peo_catalog()) p WHERE p ->> 'name' = 'TriNet');
    BEGIN
      RESET ROLE;
      IF catalog LIKE '%dana@trinet.example%' OR catalog LIKE '%' || pg_temp.id('admin') || '%' OR catalog LIKE '%' || pg_temp.id('advisor') || '%' THEN
        RAISE EXCEPTION 'FAIL: % reads a PEO contact or an admin''s id in the catalog: %', who, catalog;
      END IF;
      IF trinet ->> 'min_headcount' <> '5' OR trinet -> 'sources' -> 'min_headcount' ->> 'role' <> 'Broker desk'
         OR trinet -> 'sources' -> 'min_headcount' ->> 'checked_on' <> '2026-11-02' THEN
        RAISE EXCEPTION 'FAIL: % doesn''t read TriNet''s profile in use: %', who, trinet;
      END IF;
      IF (catalog LIKE '%Dana Reyes%' OR trinet -> 'sources' ? 'contacts') <> (who IN ('advisor', 'admin')) THEN
        RAISE EXCEPTION 'FAIL: % % the name of a person at the PEO: %', who, CASE WHEN who IN ('advisor', 'admin') THEN 'doesn''t read' ELSE 'reads' END, catalog;
      END IF;
    END;
  END LOOP;

  -- Nobody but the service role makes a bucket public or adds one.
  FOREACH who IN ARRAY ARRAY['signed_out', 'guest_a', 'prospect_a', 'advisor', 'admin'] LOOP
    PERFORM pg_temp.become(who);
    PERFORM pg_temp.changes_nothing('UPDATE storage.buckets SET public = true', who || ' made a bucket public');
    PERFORM pg_temp.refused('INSERT INTO storage.buckets (id, name, public) VALUES (''open'', ''open'', true)', who || ' added a public bucket');
  END LOOP;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', false);
  RAISE NOTICE 'data_isolation: advisor record and advisor limit cases passed';
END $$;

-- ---------- 4c. one firm against the other's rows, table by table ----------
-- For every table and bucket that holds a firm's data, each member of one firm and each member of the other: the rows
-- each can see share none (read), the same member counting finds only their own firm's (count: the matrix), and
-- changing or deleting the other's rows touches nothing (change, delete), whatever the table's grants.
CREATE FUNCTION pg_temp.row_ids(src text) RETURNS text[] LANGUAGE plpgsql AS $$
DECLARE ids text[];
BEGIN
  EXECUTE format('SELECT COALESCE(array_agg(ctid::text), ''{}'') FROM %s', src) INTO ids;
  RETURN ids;
EXCEPTION WHEN insufficient_privilege THEN
  -- A table readable column by column (public.firms) gives no access to ctid: its rows are named by its first column.
  BEGIN
    EXECUTE format('SELECT COALESCE(array_agg(%I::text), ''{}'') FROM %s', pg_temp.src_column(src), src) INTO ids;
    RETURN ids;
  EXCEPTION WHEN insufficient_privilege THEN RETURN '{}';
  END;
END $$;

-- The table a matrix source names, and a column to write back to it.
CREATE FUNCTION pg_temp.src_table(src text) RETURNS text LANGUAGE sql AS $$ SELECT split_part(src, ' WHERE ', 1) $$;
CREATE FUNCTION pg_temp.src_column(src text) RETURNS text LANGUAGE sql AS $$
  SELECT attname::text FROM pg_attribute
  WHERE attrelid = pg_temp.src_table(src)::regclass AND attnum > 0 AND NOT attisdropped AND attidentity = '' AND attgenerated = ''
  ORDER BY attnum LIMIT 1
$$;

DO $$
DECLARE
  m record;
  a text;
  b text;
  mine text[];
  theirs text[];
  tbl text;
  col text;
  cases integer := 0;
  pairs text[][] := ARRAY[['advisor', 'agent_b'], ['agent_2', 'owner_b'], ['lead_1', 'agent_b'], ['admin', 'owner_b']];
  i integer;
  swap integer;
BEGIN
  FOR m IN SELECT * FROM matrix WHERE firm_rows IS NOT NULL ORDER BY src LOOP
    tbl := pg_temp.src_table(m.src);
    col := pg_temp.src_column(m.src);
    FOR i IN 1 .. array_length(pairs, 1) LOOP
      FOR swap IN 0 .. 1 LOOP
        a := pairs[i][1 + swap];
        b := pairs[i][2 - swap];
        PERFORM pg_temp.become(a);
        mine := pg_temp.row_ids(m.src);
        PERFORM pg_temp.become(b);
        theirs := pg_temp.row_ids(m.src);
        RESET ROLE;
        IF cardinality(mine) = 0 OR cardinality(theirs) = 0 THEN
          RAISE EXCEPTION 'FAIL: % or % reads nothing of %, so the comparison proves nothing', a, b, m.src;
        END IF;
        IF mine && theirs THEN RAISE EXCEPTION 'FAIL: % and % of different firms both read a row of %', a, b, m.src; END IF;
        PERFORM pg_temp.become(a);
        PERFORM pg_temp.changes_nothing(format('UPDATE %s SET %I = %I WHERE ctid::text = ANY (%L)', tbl, col, col, theirs), a || ' changed a row of ' || b || '''s firm in ' || m.src);
        PERFORM pg_temp.changes_nothing(format('DELETE FROM %s WHERE ctid::text = ANY (%L)', tbl, theirs), a || ' deleted a row of ' || b || '''s firm in ' || m.src);
        RESET ROLE;
        cases := cases + 1;
      END LOOP;
    END LOOP;
  END LOOP;

  -- What a member can add. A note on an intake of the other firm, or a Manuscript in its folder, is refused.
  PERFORM pg_temp.become('advisor');
  PERFORM pg_temp.refused(format('INSERT INTO public.advisor_notes (session_id, author_id, body) VALUES (%L, auth.uid(), %L)', pg_temp.id('pb_cert'), 'x'), 'a member adding a note to another firm''s intake');
  PERFORM pg_temp.expect(format('INSERT INTO public.advisor_notes (session_id, author_id, body) VALUES (%L, auth.uid(), %L)', pg_temp.id('pa_cert'), 'x'), 'rows:1', 'a member adding a note to their own firm''s intake');
  PERFORM pg_temp.expect(format('INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)', 'manuscripts', pg_temp.id('pb_cert') || '/v9-other.pdf'), '42501', 'a member storing a Manuscript for another firm''s intake');
  PERFORM pg_temp.expect(format('INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)', 'manuscripts', pg_temp.id('pa_cert') || '/v9-own.pdf'), 'rows:1', 'a member storing a Manuscript for their own firm''s intake');
  PERFORM pg_temp.refused(format('INSERT INTO public.advisor_notes (session_id, author_id, body) VALUES (%L, %L, %L)', pg_temp.id('pa_cert'), pg_temp.id('agent_2'), 'x'), 'a member adding a note in a colleague''s name');
  -- No Manuscript is stored for an intake whose deletion is pending (prospect A's open draft).
  PERFORM pg_temp.expect(format('INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)', 'manuscripts', pg_temp.id('pa_open') || '/v1-pending.pdf'), '42501', 'a member storing a Manuscript for an intake being deleted');
  PERFORM pg_temp.become('agent_b');
  PERFORM pg_temp.refused(format('INSERT INTO public.advisor_notes (session_id, author_id, body) VALUES (%L, auth.uid(), %L)', pg_temp.id('pa_cert'), 'x'), 'the other firm''s member adding a note to an intake');
  PERFORM pg_temp.expect(format('INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)', 'manuscripts', pg_temp.id('pa_cert') || '/v9-other.pdf'), '42501', 'the other firm''s member storing a Manuscript');
  -- An unrecorded Manuscript upload is removable by its own firm's members only.
  RESET ROLE;
  INSERT INTO storage.objects (bucket_id, name) VALUES ('manuscripts', pg_temp.id('pa_cert') || '/v8-unrecorded.pdf');
  PERFORM pg_temp.become('agent_b');
  PERFORM pg_temp.changes_nothing(format('DELETE FROM storage.objects WHERE name = %L', pg_temp.id('pa_cert') || '/v8-unrecorded.pdf'), 'the other firm''s member removing an unrecorded Manuscript upload');
  PERFORM pg_temp.become('advisor');
  PERFORM pg_temp.expect(format('DELETE FROM storage.objects WHERE name = %L', pg_temp.id('pa_cert') || '/v8-unrecorded.pdf'), 'rows:1', 'a member removing their firm''s unrecorded Manuscript upload');
  RESET ROLE;
  DELETE FROM storage.objects WHERE name = pg_temp.id('pa_cert') || '/v8-unrecorded.pdf';

  -- Odd files in the buckets (a folder that is no intake's id, a file with no folder) are read by no firm's member and
  -- never make a read fail.
  RESET ROLE;
  INSERT INTO storage.objects (bucket_id, name) VALUES ('documents', 'loose.csv'), ('documents', 'x/y/odd.csv'), ('manuscripts', 'notes/odd.pdf'), ('manuscripts', 'odd.pdf');
  FOREACH a IN ARRAY ARRAY['advisor', 'agent_b', 'platform_admin'] LOOP
    PERFORM pg_temp.become(a);
    IF pg_temp.visible('storage.objects WHERE name IN (''loose.csv'', ''x/y/odd.csv'', ''notes/odd.pdf'', ''odd.pdf'')') <> 0 THEN
      RAISE EXCEPTION 'FAIL: % reads a file in no intake''s folder', a;
    END IF;
  END LOOP;
  RESET ROLE;
  DELETE FROM storage.objects WHERE name IN ('loose.csv', 'x/y/odd.csv', 'notes/odd.pdf', 'odd.pdf');

  -- A file that has not passed its malware scan stays withheld from the firm's members too, until it does.
  UPDATE public.documents SET scan_verdict = 'pending' WHERE storage_path = pg_temp.id('guest_a') || '/' || pg_temp.id('ga_open') || '/census.csv';
  PERFORM pg_temp.become('advisor');
  IF pg_temp.visible(format('storage.objects WHERE name = %L', pg_temp.id('guest_a') || '/' || pg_temp.id('ga_open') || '/census.csv')) <> 0 THEN
    RAISE EXCEPTION 'FAIL: a member reads a file whose malware scan hasn''t passed';
  END IF;
  RESET ROLE;
  UPDATE public.documents SET scan_verdict = 'clean' WHERE storage_path = pg_temp.id('guest_a') || '/' || pg_temp.id('ga_open') || '/census.csv';
  PERFORM pg_temp.become('advisor');
  IF pg_temp.visible(format('storage.objects WHERE name = %L', pg_temp.id('guest_a') || '/' || pg_temp.id('ga_open') || '/census.csv')) <> 1 THEN
    RAISE EXCEPTION 'FAIL: a member can''t read a file whose malware scan has passed';
  END IF;
  RESET ROLE;

  -- A platform admin is a member of no firm (D-16): their role opens nothing of either firm's; held mail, which belongs to no firm, is theirs.
  PERFORM pg_temp.become('platform_admin');
  IF pg_temp.visible('public.chamber_sessions') + pg_temp.visible('public.documents') + pg_temp.visible('public.advisor_notes')
     + pg_temp.visible('public.quote_requests') + pg_temp.visible('public.profiles WHERE user_id <> auth.uid()')
     + pg_temp.visible('storage.objects WHERE bucket_id IN (''documents'', ''manuscripts'', ''peo-mail'')') <> 0 THEN
    RAISE EXCEPTION 'FAIL: a platform admin who is a member of no firm reads a firm''s intakes, notes, quote requests, profiles or files';
  END IF;
  IF pg_temp.visible('public.quote_request_messages WHERE quote_request_id IS NULL') <> 1 THEN
    RAISE EXCEPTION 'FAIL: a platform admin can''t read held mail';
  END IF;
  -- A former member, with the advisor role still, reads nothing either.
  PERFORM pg_temp.become('former_agent');
  IF pg_temp.visible('public.chamber_sessions') + pg_temp.visible('public.advisor_notes') + pg_temp.visible('public.firms') <> 0 THEN
    RAISE EXCEPTION 'FAIL: a former member reads their old firm''s records';
  END IF;
  -- A membership that ends closes the firm to its member at once, and a new one opens it again.
  RESET ROLE;
  UPDATE public.firm_memberships SET valid_until = now() WHERE user_id = pg_temp.id('agent_2') AND valid_until IS NULL;
  PERFORM pg_temp.become('agent_2');
  IF pg_temp.visible('public.chamber_sessions') <> 0 OR pg_temp.visible('public.firms') <> 0 THEN
    RAISE EXCEPTION 'FAIL: a member whose membership just ended still reads the firm''s intakes';
  END IF;
  RESET ROLE;
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (pg_temp.id('firm_a'), pg_temp.id('agent_2'), 'agent');
  PERFORM pg_temp.become('agent_2');
  IF pg_temp.visible('public.chamber_sessions') <> 7 THEN RAISE EXCEPTION 'FAIL: a member whose membership begins again doesn''t read the firm''s intakes'; END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', false);
  RAISE NOTICE 'data_isolation: % cross-firm table cases passed', cases;
END $$;

-- ---------- 4e. functions: one firm against the other (CRM-P2.1b) ----------
-- A function that runs as its owner, not as the caller, sees every firm's rows whatever row security says, so each advisor or
-- admin function that reads or changes a firm's data must ask the firm itself (D-18). Each is probed here with the two firms'
-- data from the matrix. A function the policies don't cover is called, as every caller, against the row of a firm the caller
-- is not a current member of:
--   by_id   a call naming one row (an intake, a quote request, a note, an outbox event, a deletion) of the firm under test. A
--           caller who is not a member of that firm (the other firm's members, a platform admin, a former member, a prospect, a
--           guest, signed out) is refused or told there is no such row, never served: `refused` lists the answers that count.
--           A member of the firm under test is not (the positive control: without it a function that refused everyone would pass).
--   list    a call that lists: every caller gets only their own firm's intakes, and a caller who is no firm's member gets none.
--   count   the same for a call that only counts, which must equal what the caller's own firm has, exactly.
-- The call is a statement that returns one text value; {sid} {draft} {qr} {note} {evt} {del} stand for the firm's row of each kind.
CREATE TEMP TABLE fprobe (
  fn text PRIMARY KEY,
  who text NOT NULL,
  shape text NOT NULL CHECK (shape IN ('by_id', 'list', 'count')),
  call text NOT NULL,
  refused text[] NOT NULL DEFAULT ARRAY['42501', 'PT404', 'P0002'],
  member_ok text,
  expected text,
  positive text[] NOT NULL DEFAULT ARRAY['advisor', 'agent_b']
);
CREATE TEMP TABLE fprobe_ids (firm text, k text, v text, PRIMARY KEY (firm, k));
GRANT SELECT ON fprobe, fprobe_ids TO anon, authenticated, service_role;

-- What a call does as one caller, rolled back: 'ok:<value>' or the SQLSTATE it raised.
CREATE FUNCTION pg_temp.call_as(who text, stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v text;
  s text;
  m text;
BEGIN
  PERFORM pg_temp.become(who);
  BEGIN
    EXECUTE stmt INTO v;
    RAISE EXCEPTION USING ERRCODE = 'ZZ999', MESSAGE = COALESCE(v, '<null>');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT;
    RESET ROLE;
    IF s = 'ZZ999' THEN RETURN 'ok:' || m; END IF;
    RETURN s;
  END;
END $$;

-- A probe's statement with a firm's rows named in it.
CREATE FUNCTION pg_temp.fill(stmt text, firm text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT k, v FROM fprobe_ids WHERE fprobe_ids.firm = fill.firm LOOP
    stmt := replace(stmt, '{' || r.k || '}', quote_literal(r.v));
  END LOOP;
  RETURN stmt;
END $$;

-- The firms the intakes in a comma-separated list belong to, as text, '' when there are none.
CREATE FUNCTION pg_temp.firms_of(ids text) RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(string_agg(DISTINCT s.firm_id::text, ',' ORDER BY s.firm_id::text), '')
  FROM public.chamber_sessions s WHERE s.id = ANY (string_to_array(NULLIF(ids, ''), ',')::uuid[])
$$;

-- Which firm a caller belongs to now: 'a', 'b' or neither.
CREATE FUNCTION pg_temp.caller_firm(who text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN who IN ('advisor', 'admin', 'agent_2', 'lead_1') THEN 'a' WHEN who IN ('agent_b', 'owner_b') THEN 'b' END
$$;

-- The callers every function is tried as; the first firm's, the second's, and nobody's.
CREATE FUNCTION pg_temp.every_caller() RETURNS text[] LANGUAGE sql AS $$
  SELECT ARRAY['signed_out', 'guest_a', 'prospect_a', 'advisor_as_guest', 'advisor', 'admin', 'agent_2', 'lead_1', 'agent_b', 'owner_b',
               'platform_admin', 'former_agent']
$$;

INSERT INTO fprobe (fn, who, shape, call) VALUES
  ('advisor_record_quote_send', 'advisor', 'by_id', $$SELECT public.advisor_record_quote_send({sid}, 'Probe PEO', NULL)::text$$),
  ('advisor_update_quote_request', 'advisor', 'by_id', $$SELECT public.advisor_update_quote_request({qr}, 'declined')::text$$),
  ('advisor_note_underwriter_question', 'advisor', 'by_id', $$SELECT public.advisor_note_underwriter_question({qr}, 'probe')::text$$),
  ('advisor_open_quote_request_thread', 'advisor', 'by_id', $$SELECT public.advisor_open_quote_request_thread({qr})::text$$),
  ('advisor_add_quote_request_note', 'advisor', 'by_id', $$SELECT public.advisor_add_quote_request_note({qr}, 'call', current_date, 'probe')::text$$),
  ('advisor_correct_quote_request_note', 'advisor', 'by_id', $$SELECT public.advisor_correct_quote_request_note({note}, 'call', current_date, 'probe')::text$$),
  ('advisor_reissue_quote_request_address', 'advisor', 'by_id', $$SELECT public.advisor_reissue_quote_request_address({qr})::text$$),
  ('set_submission_status', 'advisor', 'by_id', $$SELECT public.set_submission_status({sid}, 'under_review', 'probe')::text$$),
  ('set_submission_needs_action', 'advisor', 'by_id', $$SELECT public.set_submission_needs_action({sid}, true, 'probe')::text$$),
  ('review_submission_field', 'advisor', 'by_id', $$SELECT public.review_submission_field({sid}, 'company_name', 'follow_up')::text$$),
  ('record_manuscript_version', 'advisor', 'by_id',
   $$SELECT public.record_manuscript_version({sid}, 2, {sid} || '/probe.pdf', repeat('d', 64), 0, 0, false, NULL, NULL)::text$$),
  ('advisor_request_information', 'advisor', 'by_id', $$SELECT public.advisor_request_information({sid}, 'probe', '{}')::text$$),
  -- Their own intake's verified fields are the prospect's to read (the owner is no outsider); another firm's advisor gets none.
  ('session_verified_fields', 'advisor', 'by_id', $$SELECT public.session_verified_fields({sid})::text$$),
  ('request_intake_deletion', 'admin', 'by_id', $$SELECT public.request_intake_deletion({draft}, 'probe reason')::text$$),
  ('revoke_chamber_session', 'admin', 'by_id', $$SELECT public.revoke_chamber_session({draft}, 'probe reason')::text$$),
  ('retry_intake_deletion', 'admin', 'by_id', $$SELECT public.retry_intake_deletion({del})::text$$),
  -- A referral partner is its firm's own: adding one to a firm, or changing one by its code, is that firm's members' alone.
  ('advisor_add_referral_partner', 'advisor', 'by_id', $$SELECT public.advisor_add_referral_partner('probe-added', 'Probe', 'other', {firm})::text$$),
  ('advisor_update_referral_partner', 'advisor', 'by_id', $$SELECT public.advisor_update_referral_partner({partner}, 'Probe', 'other', {firm})::text$$);
INSERT INTO fprobe (fn, who, shape, call, positive) VALUES
  ('advisor_list_submissions', 'advisor', 'list',
   $$SELECT COALESCE(string_agg(session_id::text, ','), '') FROM public.advisor_list_submissions(NULL, NULL, 500, 0, NULL, NULL, NULL)$$, ARRAY['advisor', 'agent_b']),
  ('advisor_list_outbox_events', 'advisor', 'list',
   $$SELECT COALESCE(string_agg(session_id::text, ','), '') FROM public.advisor_list_outbox_events(NULL, 500)$$, ARRAY['advisor', 'agent_b']),
  -- Only the first firm's prospect has a bounced address on record (the matrix's email delivery event).
  ('advisor_email_problems', 'advisor', 'list',
   $$SELECT COALESCE(string_agg(session_id::text, ','), '') FROM public.advisor_email_problems()$$, ARRAY['advisor']),
  ('retention_review_due', 'advisor', 'list',
   $$SELECT COALESCE(string_agg(session_id::text, ','), '') FROM public.retention_review_due(1000)$$, ARRAY['advisor', 'agent_b']);
INSERT INTO fprobe (fn, who, shape, call, expected) VALUES
  ('advisor_outbox_summary', 'advisor', 'count', $$SELECT COALESCE(sum(events), 0)::text FROM public.advisor_outbox_summary()$$,
   $$SELECT count(*)::text FROM public.outbox_events e JOIN public.chamber_sessions s ON s.id = e.session_id WHERE s.firm_id = {firm}$$),
  ('advisor_intake_funnel', 'advisor', 'count',
   $$SELECT COALESCE(sum(intakes), 0)::text FROM public.advisor_intake_funnel(now() - interval '300 days', now() + interval '1 day')$$,
   $$SELECT count(*)::text FROM public.intake_milestones m JOIN public.chamber_sessions s ON s.id = m.session_id
     WHERE s.firm_id = {firm} AND m.started_at >= now() - interval '300 days' AND m.started_at < now() + interval '1 day'$$),
  ('advisor_intake_sources', 'advisor', 'count',
   $$SELECT COALESCE(sum(started + answered + document_uploaded + census_provided + ready_to_certify + email_verified + certified + manuscript_downloaded), 0)::text
     FROM public.advisor_intake_sources(now() - interval '300 days', now() + interval '1 day')$$,
   $$SELECT count(*)::text FROM public.intake_milestones m JOIN public.chamber_sessions s ON s.id = m.session_id
     WHERE s.firm_id = {firm} AND m.started_at >= now() - interval '300 days' AND m.started_at < now() + interval '1 day'$$);
INSERT INTO fprobe (fn, who, shape, call, refused, member_ok) VALUES
  ('advisor_requeue_outbox_event', 'advisor', 'by_id', $$SELECT public.advisor_requeue_outbox_event({evt}, false)::text$$,
   ARRAY['42501', 'ok:false'], '^ok:true$');
UPDATE fprobe SET refused = ARRAY['42501', 'ok:{}'], member_ok = '^ok:\{company_name\}$' WHERE fn = 'session_verified_fields';
UPDATE fprobe SET refused = ARRAY['42501', 'ok:false'], member_ok = '^ok:true$' WHERE fn = 'retry_intake_deletion';

-- Retention review is of certifications past the retention window: both firms' certifications are aged, and restored below.
DO $$
BEGIN
  SET LOCAL session_replication_role = replica;
  UPDATE public.chamber_certifications SET recorded_at = recorded_at - interval '30 years';
END $$;

DO $$
DECLARE
  f text;
  qr text;
BEGIN
  FOREACH f IN ARRAY ARRAY['a', 'b'] LOOP
    qr := (SELECT q.id::text FROM public.quote_requests q WHERE q.session_id = pg_temp.id(CASE f WHEN 'a' THEN 'pa_cert' ELSE 'pb_cert' END));
    INSERT INTO fprobe_ids VALUES
      (f, 'sid', pg_temp.id(CASE f WHEN 'a' THEN 'pa_cert' ELSE 'pb_cert' END)::text),
      (f, 'draft', pg_temp.id(CASE f WHEN 'a' THEN 'pa_open' ELSE 'pb_open' END)::text),
      (f, 'qr', qr),
      (f, 'firm', pg_temp.id(CASE f WHEN 'a' THEN 'firm_a' ELSE 'firm_b' END)::text),
      (f, 'partner', CASE f WHEN 'a' THEN 'acme-cfo' ELSE 'beta-cfo' END),
      (f, 'note', (SELECT n.id::text FROM public.quote_request_notes n WHERE n.quote_request_id = qr::bigint ORDER BY n.id LIMIT 1));
    -- A deletion that failed, to retry, on an archived intake of the firm (so no certification is hidden from retention review by
    -- an open deletion): written as the superuser, and taken away again below.
    INSERT INTO public.intake_deletions (session_id, trigger, reason, status)
    VALUES (CASE f WHEN 'a' THEN pg_temp.id('ga_archived')
                   ELSE (SELECT s.id FROM public.chamber_sessions s WHERE s.user_id = pg_temp.id('prospect_b') AND s.status = 'archived') END,
            'request', 'probe', 'failed')
    RETURNING id::text INTO qr;
    INSERT INTO fprobe_ids VALUES (f, 'del', qr);
    -- An email that gave up, to retry: written the same way.
    INSERT INTO public.outbox_events (kind, session_id, dedupe_key, payload, status)
    VALUES ('advisor_notification', pg_temp.id(CASE f WHEN 'a' THEN 'pa_cert' ELSE 'pb_cert' END), 'probe-dead-' || f, '{}', 'dead')
    RETURNING id::text INTO qr;
    INSERT INTO fprobe_ids VALUES (f, 'evt', qr);
  END LOOP;
END $$;

DO $$
DECLARE
  e record;
  f text;
  who text;
  stmt text;
  r text;
  ids text;
  expected text;
  member text;
  cases integer := 0;
BEGIN
  -- The second firm's owner is a platform admin for these calls only (the matrix above has them as none), so every admin
  -- function must also succeed for an authorized member of the second firm, on that firm's own row.
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('owner_b'), 'admin');
  FOR e IN SELECT * FROM fprobe ORDER BY fn LOOP
    IF e.shape = 'by_id' THEN
      FOREACH f IN ARRAY ARRAY['a', 'b'] LOOP
        stmt := pg_temp.fill(e.call, f);
        FOR who IN SELECT pg_temp.outsiders(CASE f WHEN 'a' THEN 'prospect_a' ELSE 'prospect_b' END, f) LOOP
          r := pg_temp.call_as(who, stmt);
          IF NOT r = ANY (e.refused) THEN
            RAISE EXCEPTION 'FAIL: % calling % on the % firm''s row gave %, expected a refusal (%)', who, e.fn, f, r, e.refused;
          END IF;
          cases := cases + 1;
        END LOOP;
        member := CASE WHEN e.who = 'admin' THEN CASE f WHEN 'a' THEN 'admin' ELSE 'owner_b' END ELSE CASE f WHEN 'a' THEN 'advisor' ELSE 'agent_b' END END;
        IF member IS NOT NULL THEN
          r := pg_temp.call_as(member, stmt);
          IF r = ANY (e.refused) OR (e.member_ok IS NOT NULL AND r !~ e.member_ok) THEN
            RAISE EXCEPTION 'FAIL: % (a member) calling % on their own firm''s row gave %', member, e.fn, r;
          END IF;
          cases := cases + 1;
        END IF;
      END LOOP;
    ELSE
      FOREACH who IN ARRAY pg_temp.every_caller() LOOP
        r := pg_temp.call_as(who, e.call);
        IF r NOT LIKE 'ok:%' THEN
          IF r <> '42501' THEN RAISE EXCEPTION 'FAIL: % calling % gave %', who, e.fn, r; END IF;
          IF who = ANY (e.positive) THEN RAISE EXCEPTION 'FAIL: % was refused %', who, e.fn; END IF;
        ELSE
          f := pg_temp.caller_firm(who);
          IF e.shape = 'list' THEN
            ids := substr(r, 4);
            IF pg_temp.firms_of(ids) IS DISTINCT FROM COALESCE((SELECT id::text FROM fx WHERE name = CASE f WHEN 'a' THEN 'firm_a' WHEN 'b' THEN 'firm_b' END), '')
               AND ids <> '' THEN
              RAISE EXCEPTION 'FAIL: % listing with % got intakes of firm(s) %, their firm is %', who, e.fn, pg_temp.firms_of(ids), COALESCE(f, 'none');
            END IF;
            IF ids = '' AND who = ANY (e.positive) THEN RAISE EXCEPTION 'FAIL: % got none of their own firm''s rows from %', who, e.fn; END IF;
          ELSE
            expected := '0';
            IF f IS NOT NULL THEN
              EXECUTE replace(e.expected, '{firm}', quote_literal((SELECT id FROM fx WHERE name = CASE f WHEN 'a' THEN 'firm_a' ELSE 'firm_b' END))) INTO expected;
            END IF;
            IF substr(r, 4) <> expected THEN RAISE EXCEPTION 'FAIL: % counting with % got %, expected %', who, e.fn, substr(r, 4), expected; END IF;
            IF expected = '0' AND who = ANY (e.positive) THEN RAISE EXCEPTION 'FAIL: % has nothing to count for %: the probe proves nothing', who, e.fn; END IF;
          END IF;
        END IF;
        cases := cases + 1;
      END LOOP;
    END IF;
  END LOOP;
  RESET ROLE;
  DELETE FROM public.user_roles WHERE user_id = pg_temp.id('owner_b') AND role = 'admin';
  PERFORM set_config('request.jwt.claims', '', false);
  RAISE NOTICE 'data_isolation: % function probe cases passed', cases;
END $$;

DO $$
BEGIN
  SET LOCAL session_replication_role = replica;
  UPDATE public.chamber_certifications SET recorded_at = recorded_at + interval '30 years';
END $$;
DELETE FROM public.intake_deletions WHERE id::text IN (SELECT v FROM fprobe_ids WHERE k = 'del');
DELETE FROM public.outbox_events WHERE id::text IN (SELECT v FROM fprobe_ids WHERE k = 'evt');

-- ---------- 4d. a deletion record keeps its firm after its intake is gone ----------
DO $$
DECLARE
  d uuid;
  gone uuid;
  sid constant uuid := pg_temp.id('pb_open');
  r text;
BEGIN
  -- The record takes the firm of the intake it is about, whatever the writer says; nobody moves it afterwards.
  SELECT id INTO d FROM public.intake_deletions WHERE session_id = sid;
  IF (SELECT firm_id FROM public.intake_deletions WHERE id = d) <> pg_temp.id('firm_b') THEN
    RAISE EXCEPTION 'FAIL: a deletion record of the second firm''s intake isn''t the second firm''s';
  END IF;
  -- One for an intake that isn't there (it was never the second firm's to name) is Edgar Allan Advisory's, as every record was.
  INSERT INTO public.intake_deletions (session_id, trigger, reason) VALUES (gen_random_uuid(), 'request', 'x') RETURNING id INTO gone;
  IF (SELECT firm_id FROM public.intake_deletions WHERE id = gone) <> pg_temp.id('firm_a') THEN
    RAISE EXCEPTION 'FAIL: a deletion record of an intake that is gone isn''t Edgar Allan Advisory''s';
  END IF;
  DELETE FROM public.intake_deletions WHERE id = gone;
  UPDATE public.intake_deletions SET firm_id = pg_temp.id('firm_a') WHERE id = d;
  IF (SELECT firm_id FROM public.intake_deletions WHERE id = d) <> pg_temp.id('firm_b') THEN
    RAISE EXCEPTION 'FAIL: a deletion record was moved to another firm';
  END IF;
  -- The purge removes the intake and keeps the record, which its firm's members still read and the other's don't.
  PERFORM pg_temp.become('service');
  PERFORM public.claim_intake_deletions(10, 600);
  PERFORM public.complete_intake_deletion(d, 0);
  RESET ROLE;
  IF EXISTS (SELECT 1 FROM public.chamber_sessions WHERE id = sid) THEN RAISE EXCEPTION 'FAIL: setup: the purge left the intake'; END IF;
  PERFORM pg_temp.become('owner_b');
  IF pg_temp.visible(format('public.intake_deletions WHERE id = %L AND status = %L', d, 'done')) <> 1 THEN
    RAISE EXCEPTION 'FAIL: the firm''s members can''t read a deletion record once its intake is gone';
  END IF;
  FOREACH r IN ARRAY ARRAY['advisor', 'platform_admin', 'former_agent', 'prospect_b'] LOOP
    PERFORM pg_temp.become(r);
    IF pg_temp.visible(format('public.intake_deletions WHERE id = %L', d)) <> 0 THEN
      RAISE EXCEPTION 'FAIL: % reads another firm''s deletion record', r;
    END IF;
  END LOOP;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', false);
  RAISE NOTICE 'data_isolation: deletion record cases passed';
END $$;

-- ---------- 4f. the funnel keeps an intake's steps after the intake is deleted, in its firm ----------
DO $$
DECLARE
  sid uuid;
  before_b bigint;
  before_a bigint;
  src_b bigint;
BEGIN
  SELECT id INTO sid FROM public.chamber_sessions WHERE firm_id = pg_temp.id('firm_b') LIMIT 1;
  IF sid IS NULL THEN RAISE EXCEPTION 'FAIL: setup: the second firm has no intake'; END IF;
  PERFORM public.note_intake_milestone(sid, 'answered');
  PERFORM pg_temp.become('agent_b');
  SELECT COALESCE(sum(intakes), 0) INTO before_b FROM public.advisor_intake_funnel(now() - interval '300 days', now() + interval '1 day');
  SELECT COALESCE(sum(started + answered + document_uploaded + census_provided + ready_to_certify + email_verified + certified + manuscript_downloaded), 0)
    INTO src_b FROM public.advisor_intake_sources(now() - interval '300 days', now() + interval '1 day');
  PERFORM pg_temp.become('advisor');
  SELECT COALESCE(sum(intakes), 0) INTO before_a FROM public.advisor_intake_funnel(now() - interval '300 days', now() + interval '1 day');
  RESET ROLE;
  -- What deleting an intake does to its steps: the link goes, the rows stay.
  UPDATE public.intake_milestones SET session_id = NULL WHERE session_id = sid;
  PERFORM pg_temp.become('agent_b');
  IF (SELECT COALESCE(sum(intakes), 0) FROM public.advisor_intake_funnel(now() - interval '300 days', now() + interval '1 day')) <> before_b THEN
    RAISE EXCEPTION 'FAIL: the funnel lost the steps of a deleted intake of its firm';
  END IF;
  IF (SELECT COALESCE(sum(started + answered + document_uploaded + census_provided + ready_to_certify + email_verified + certified + manuscript_downloaded), 0)
        FROM public.advisor_intake_sources(now() - interval '300 days', now() + interval '1 day')) <> src_b THEN
    RAISE EXCEPTION 'FAIL: the source report lost the steps of a deleted intake of its firm';
  END IF;
  PERFORM pg_temp.become('advisor');
  IF (SELECT COALESCE(sum(intakes), 0) FROM public.advisor_intake_funnel(now() - interval '300 days', now() + interval '1 day')) <> before_a THEN
    RAISE EXCEPTION 'FAIL: the steps of a deleted intake of the second firm reached the first firm''s funnel';
  END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', false);
  RAISE NOTICE 'data_isolation: deleted-intake funnel cases passed';
END $$;

-- ---------- 4g. a step follows its intake's firm; deleting a firm that has steps works ----------
DO $$
DECLARE
  sid uuid;
  fb uuid := pg_temp.id('firm_b');
  tmp uuid := gen_random_uuid();
  old_step bigint;
  kept_step bigint;
BEGIN
  -- Steps of intakes deleted before the firm column existed have no firm and no link: the backfill gives them to the default
  -- firm (without it, the default firm's funnel and source report silently lose them).
  -- A window wholly in the past around this step: no fixture row (all made now) can fall in it, so the counts below can
  -- only come from this step.
  INSERT INTO public.intake_milestones (session_id, started_at, milestone) VALUES (NULL, now() - interval '200 days', 'started') RETURNING id INTO old_step;
  IF (SELECT firm_id FROM public.intake_milestones WHERE id = old_step) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: setup: an unlinked step got a firm on insert';
  END IF;
  IF (SELECT count(*) FROM public.intake_milestones WHERE started_at < now() - interval '199 days' AND firm_id IS NOT NULL) <> 0 THEN
    RAISE EXCEPTION 'FAIL: setup: another step falls in the past window';
  END IF;
  PERFORM public.backfill_intake_milestone_firms();
  IF (SELECT firm_id FROM public.intake_milestones WHERE id = old_step) IS DISTINCT FROM public.default_firm_id() THEN
    RAISE EXCEPTION 'FAIL: the backfill did not give an old unlinked step to the default firm';
  END IF;
  PERFORM pg_temp.become('advisor');
  IF (SELECT COALESCE(sum(intakes), 0) FROM public.advisor_intake_funnel(now() - interval '201 days', now() - interval '199 days')) <> 1 THEN
    RAISE EXCEPTION 'FAIL: the default firm''s funnel does not count a backfilled old step exactly once';
  END IF;
  IF (SELECT COALESCE(sum(started), 0) FROM public.advisor_intake_sources(now() - interval '201 days', now() - interval '199 days')) <> 1 THEN
    RAISE EXCEPTION 'FAIL: the default firm''s source report does not count a backfilled old step exactly once';
  END IF;
  PERFORM pg_temp.become('agent_b');
  IF (SELECT COALESCE(sum(intakes), 0) FROM public.advisor_intake_funnel(now() - interval '201 days', now() - interval '199 days')) <> 0 THEN
    RAISE EXCEPTION 'FAIL: the second firm''s funnel counts the default firm''s backfilled step';
  END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', false);
  DELETE FROM public.intake_milestones WHERE id = old_step;
  -- An intake moved to another firm (the service role does this) takes its steps with it.
  SELECT id INTO sid FROM public.chamber_sessions WHERE firm_id = public.default_firm_id() LIMIT 1;
  PERFORM public.note_intake_milestone(sid, 'answered');
  UPDATE public.chamber_sessions SET firm_id = fb WHERE id = sid;
  IF EXISTS (SELECT 1 FROM public.intake_milestones WHERE session_id = sid AND firm_id IS DISTINCT FROM fb) THEN
    RAISE EXCEPTION 'FAIL: the steps of a moved intake stayed in the old firm';
  END IF;
  UPDATE public.chamber_sessions SET firm_id = public.default_firm_id() WHERE id = sid;
  IF EXISTS (SELECT 1 FROM public.intake_milestones WHERE session_id = sid AND firm_id IS DISTINCT FROM public.default_firm_id()) THEN
    RAISE EXCEPTION 'FAIL: the steps of an intake moved back stayed in the other firm';
  END IF;
  -- A firm that has steps can be deleted: the steps keep their rows.
  INSERT INTO public.firms (id, name, address) VALUES (tmp, 'Temp Firm', 'temp-firm-4g');
  UPDATE public.chamber_sessions SET firm_id = tmp WHERE id = sid;
  IF NOT EXISTS (SELECT 1 FROM public.intake_milestones WHERE session_id = sid AND firm_id = tmp) THEN
    RAISE EXCEPTION 'FAIL: setup: the steps did not follow the intake to the new firm';
  END IF;
  -- Deleting an intake keeps its steps without the link (the intake goes first, then the firm).
  SELECT id INTO kept_step FROM public.intake_milestones WHERE session_id = sid AND milestone = 'answered';
  UPDATE public.intake_milestones SET session_id = NULL WHERE session_id = sid;
  UPDATE public.chamber_sessions SET firm_id = public.default_firm_id() WHERE id = sid;
  DELETE FROM public.firms WHERE id = tmp;
  IF NOT EXISTS (SELECT 1 FROM public.intake_milestones WHERE id = kept_step AND session_id IS NULL AND firm_id IS NULL) THEN
    RAISE EXCEPTION 'FAIL: deleting a firm lost its steps';
  END IF;
  RAISE NOTICE 'data_isolation: step firm cases passed';
END $$;

-- ---------- 4h. a failure report keeps only an intake of the reporter's own firm ----------
DO $$
DECLARE
  other uuid;
  r text;
BEGIN
  SELECT id INTO other FROM public.chamber_sessions WHERE firm_id = pg_temp.id('firm_b') LIMIT 1;
  FOREACH r IN ARRAY ARRAY['advisor', 'platform_admin', 'former_agent', 'guest_a'] LOOP
    PERFORM pg_temp.become(r);
    IF NOT public.report_client_event('app_error', 'xfirm_' || r, NULL, '/x', other) THEN RAISE EXCEPTION 'setup: report dropped'; END IF;
  END LOOP;
  PERFORM pg_temp.become('agent_b');
  IF NOT public.report_client_event('app_error', 'xfirm_own', NULL, '/x', other) THEN RAISE EXCEPTION 'setup: report dropped'; END IF;
  RESET ROLE;
  IF EXISTS (SELECT 1 FROM public.ops_events WHERE code IN ('xfirm_advisor', 'xfirm_platform_admin', 'xfirm_former_agent', 'xfirm_guest_a') AND session_id IS NOT NULL) THEN
    RAISE EXCEPTION 'FAIL: a failure report was tied to another firm''s intake';
  END IF;
  IF (SELECT session_id FROM public.ops_events WHERE code = 'xfirm_own') IS DISTINCT FROM other THEN
    RAISE EXCEPTION 'FAIL: a member''s failure report lost its own firm''s intake';
  END IF;
  DELETE FROM public.ops_events WHERE code LIKE 'xfirm_%';
  PERFORM set_config('request.jwt.claims', '', false);
  RAISE NOTICE 'data_isolation: failure report cases passed';
END $$;

-- ---------- 4i. what has no submission behind it (CRM-P2.1c) ----------
-- Referral partners, the advisor alert's recipients, held mail and mailboxes: reached through no intake, so each carries its own firm
-- and every function over it asks the caller's membership of that firm.

-- 4i-1. Referral partners: a code is a firm's own, and a call that names no firm acts for the caller's only firm.
DO $$
DECLARE
  r text;
  who text;
  fa constant uuid := pg_temp.id('firm_a');
  fb constant uuid := pg_temp.id('firm_b');
BEGIN
  -- The two firms hold the same code under their own partner, each its own: neither was told the other had it.
  IF (SELECT count(*) FROM public.referral_partners WHERE code = 'acme-cfo') <> 2
     OR (SELECT name FROM public.referral_partners WHERE code = 'acme-cfo' AND firm_id = fa) <> 'Acme CFO Partners'
     OR (SELECT name FROM public.referral_partners WHERE code = 'acme-cfo' AND firm_id = fb) <> 'Beta CFO Partners' THEN
    RAISE EXCEPTION 'FAIL: the two firms do not each hold their own partner under the same code';
  END IF;

  -- A call that names no firm adds to the caller's own: never to the other firm.
  r := pg_temp.call_as('advisor', $q$SELECT firm_id::text FROM public.advisor_add_referral_partner('own-firm-test', 'Own', 'other')$q$);
  IF r <> 'ok:' || fa THEN RAISE EXCEPTION 'FAIL: the first firm''s advisor added a partner to %', r; END IF;
  r := pg_temp.call_as('agent_b', $q$SELECT firm_id::text FROM public.advisor_add_referral_partner('own-firm-test', 'Own', 'other')$q$);
  IF r <> 'ok:' || fb THEN RAISE EXCEPTION 'FAIL: the second firm''s agent added a partner to %', r; END IF;

  -- No firm, no partner: a platform admin who belongs to none (D-16), a former member, a prospect, a guest, signed out.
  FOREACH who IN ARRAY ARRAY['platform_admin', 'former_agent', 'prospect_a', 'guest_a', 'signed_out', 'advisor_as_guest'] LOOP
    r := pg_temp.call_as(who, $q$SELECT firm_id::text FROM public.advisor_add_referral_partner('nobody-test', 'Nobody', 'other')$q$);
    IF r <> '42501' THEN RAISE EXCEPTION 'FAIL: % adding a partner with no firm named gave %, expected a refusal', who, r; END IF;
    r := pg_temp.call_as(who, $q$SELECT code FROM public.advisor_update_referral_partner('acme-cfo', 'Nobody', 'other')$q$);
    IF r <> '42501' THEN RAISE EXCEPTION 'FAIL: % renaming a partner with no firm named gave %, expected a refusal', who, r; END IF;
  END LOOP;

  -- A change by code reaches the caller's own firm's partner only, though the other firm holds the same code.
  r := pg_temp.call_as('agent_b', $q$SELECT name FROM public.advisor_update_referral_partner('acme-cfo', 'Renamed by B', 'other')$q$);
  IF r <> 'ok:Renamed by B' THEN RAISE EXCEPTION 'FAIL: the second firm''s agent could not rename their own partner (%)', r; END IF;
  RESET ROLE;
  IF (SELECT name FROM public.referral_partners WHERE code = 'acme-cfo' AND firm_id = fa) <> 'Acme CFO Partners' THEN
    RAISE EXCEPTION 'FAIL: the second firm''s rename reached the first firm''s partner';
  END IF;

  -- A person who belongs to two firms must say which: the database does not guess.
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (fa, pg_temp.id('agent_b'), 'agent');
  r := pg_temp.call_as('agent_b', $q$SELECT firm_id::text FROM public.advisor_add_referral_partner('two-firms-test', 'Two', 'other')$q$);
  IF r <> '22023' THEN RAISE EXCEPTION 'FAIL: a member of two firms adding a partner without naming one gave %, expected 22023', r; END IF;
  r := pg_temp.call_as('agent_b', format($q$SELECT firm_id::text FROM public.advisor_add_referral_partner('two-firms-test', 'Two', 'other', %L)$q$, fa));
  IF r <> 'ok:' || fa THEN RAISE EXCEPTION 'FAIL: a member of two firms naming the first gave %', r; END IF;
  RESET ROLE;
  DELETE FROM public.firm_memberships WHERE firm_id = fa AND user_id = pg_temp.id('agent_b');

  -- One partner per code per firm is the database's rule, not a function's (D-29): a second insert is refused in one session.
  BEGIN
    INSERT INTO public.referral_partners (firm_id, code, name, kind) VALUES (fa, 'acme-cfo', 'Twin', 'other');
    RAISE EXCEPTION 'FAIL: a firm holds two partners under one code';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  -- A partner belongs to a firm.
  BEGIN
    INSERT INTO public.referral_partners (code, name, kind) VALUES ('no-firm-test', 'Orphan', 'other');
    RAISE EXCEPTION 'FAIL: a partner with no firm was accepted';
  EXCEPTION WHEN not_null_violation THEN NULL;
  END;

  -- The funnel by source names each firm's own partner behind a shared code, never the other firm's.
  SET LOCAL session_replication_role = replica;
  UPDATE public.intake_milestones SET referral_code = 'acme-cfo' WHERE milestone = 'started' AND firm_id IN (fa, fb) AND session_id IS NOT NULL;
  RESET session_replication_role;
  r := pg_temp.call_as('advisor', $q$SELECT string_agg(DISTINCT partner_name, ',') FROM public.advisor_intake_sources(now() - interval '300 days', now() + interval '1 day') WHERE referral_code = 'acme-cfo'$q$);
  IF r <> 'ok:Acme CFO Partners' THEN RAISE EXCEPTION 'FAIL: the first firm''s funnel named partner(s) %', r; END IF;
  r := pg_temp.call_as('agent_b', $q$SELECT string_agg(DISTINCT partner_name, ',') FROM public.advisor_intake_sources(now() - interval '300 days', now() + interval '1 day') WHERE referral_code = 'acme-cfo'$q$);
  IF r <> 'ok:Beta CFO Partners' THEN RAISE EXCEPTION 'FAIL: the second firm''s funnel named partner(s) %', r; END IF;
  RESET ROLE;
  SET LOCAL session_replication_role = replica;
  UPDATE public.intake_milestones SET referral_code = NULL WHERE referral_code = 'acme-cfo';
  RESET session_replication_role;
  PERFORM set_config('request.jwt.claims', '', false);
  RAISE NOTICE 'data_isolation: referral partner cases passed';
END $$;

-- ---------- 5a. every table and bucket says what it holds, and every firm's data is probed with two firms (D-28) ----------
-- The check that a table "has a firm rule" is by behaviour, never by reading a policy's text: a policy can mention a firm
-- helper without tying it to the row being read, and a text check passes on a table that is open across firms.
-- Every public table and every storage bucket is registered here with what its rows are:
--   firm       a firm's data. It carries make_row, how to make one row that belongs to a firm: a statement that inserts the row
--              (or selects an existing one) and returns its ctid::text. {firm} is the firm's id, {intake} a new intake of that
--              firm owned by a new person {u}, {qr} a new quote request on it, {msg} a new message on that, {tag} a unique word.
--              The probe (5b) makes one row for each of the two firms and proves the other firm's members, a non-member, a
--              former member and a platform admin read, count, change and delete none of it.
--   platform   nothing of any firm's: the same for every firm, kept by platform admins; no firm_id, session_id or
--              quote_request_id column unless names_intakes says a failure report may name the intake
--   own        a person's own rows only (the matrix shows each caller reads just theirs)
--   closed     no policy at all: the API roles read and write nothing, only functions and the service role do
-- A table or bucket that isn't registered fails the build, as does a firm one with no make_row, one whose probe did not run,
-- and one the probe finds open across firms.
CREATE TEMP TABLE registry (src text PRIMARY KEY, scope text NOT NULL CHECK (scope IN ('firm', 'platform', 'own', 'closed')), why text NOT NULL,
  names_intakes boolean NOT NULL DEFAULT false,
  make_row text,
  -- false when a member of the firm legitimately reads only some rows of it (a membership: their own)
  member_reads boolean NOT NULL DEFAULT true,
  -- true when only Edgar Allan Advisory can have such a row until a later story gives the table a firm
  firm_a_only boolean NOT NULL DEFAULT false,
  -- an INSERT a caller who is not a member of the firm tries into that firm's records ({intake}, {qr}, {msg}, {firm}, {u} are the
  -- firm's); it must be refused. Defaults to make_row when that is an INSERT, without its RETURNING (which row security would
  -- check against the caller's read rule and so refuse an insert whose write rule is open).
  foreign_insert text,
  -- a SET clause that moves a row to the other firm ({intake}, {qr}, {msg}, {firm}, {u} are the other firm's); a member of the
  -- row's firm must be refused. It names no column of the table on its right side, so it is a write that reads nothing.
  move_to text);
CREATE TEMP TABLE probe_ran (src text PRIMARY KEY, ran boolean NOT NULL, detail text);

INSERT INTO registry (src, scope, why, make_row) VALUES
  ('public.advisor_field_reviews', 'firm', 'by intake',
   $m$INSERT INTO public.advisor_field_reviews (session_id, field, review_state, updated_by) VALUES ({intake}, 'company_name', 'verified', {u}) RETURNING ctid::text$m$),
  ('public.advisor_notes', 'firm', 'by intake',
   $m$INSERT INTO public.advisor_notes (session_id, author_id, body) VALUES ({intake}, {u}, 'probe {tag}') RETURNING ctid::text$m$),
  ('public.advisor_review_events', 'firm', 'by intake',
   $m$INSERT INTO public.advisor_review_events (session_id, field, correction_changed, had_correction, has_correction, actor_id) VALUES ({intake}, 'company_name', false, false, false, {u}) RETURNING ctid::text$m$),
  ('public.ai_extraction_events', 'firm', 'by intake; a call with no intake is a platform admin''s',
   $m$INSERT INTO public.ai_extraction_events (request_id, function_name, session_id, outcome, http_status) VALUES (gen_random_uuid(), 'chamber-extract', {intake}, 'ok', 200) RETURNING ctid::text$m$),
  ('public.chamber_certifications', 'firm', 'by intake',
   $m$SELECT pg_temp.make_certification({intake}, {u}, '{tag}')$m$),
  ('public.chamber_sessions', 'firm', 'its own firm_id',
   $m$SELECT ctid::text FROM public.chamber_sessions WHERE id = {intake}$m$),
  ('public.document_events', 'firm', 'by intake',
   $m$INSERT INTO public.document_events (session_id, document_id, kind, file_name) VALUES ({intake}, gen_random_uuid(), 'added', 'probe.csv') RETURNING ctid::text$m$),
  ('public.documents', 'firm', 'by intake',
   $m$INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path) VALUES ({u}, {intake}, 'probe.csv', '1 KB', {u} || '/' || {intake} || '/probe.csv') RETURNING ctid::text$m$),
  ('public.firm_teams', 'firm', 'its own firm_id',
   $m$INSERT INTO public.firm_teams (firm_id, name) VALUES ({firm}, 'Probe {tag}') RETURNING ctid::text$m$),
  ('public.information_requests', 'firm', 'by intake',
   $m$INSERT INTO public.information_requests (session_id, message) VALUES ({intake}, 'probe {tag}') RETURNING ctid::text$m$),
  ('public.intake_consents', 'firm', 'by the owner of an intake of the firm; a person reads their own',
   $m$SELECT ctid::text FROM public.intake_consents WHERE user_id = {u}$m$),
  ('public.intake_deletions', 'firm', 'its own firm_id, kept after the intake is gone',
   $m$INSERT INTO public.intake_deletions (session_id, user_id, trigger, reason, firm_id) VALUES ({intake}, {u}, 'request', 'probe', {firm}) RETURNING ctid::text$m$),
  ('public.intake_lifecycle_events', 'firm', 'by intake',
   $m$INSERT INTO public.intake_lifecycle_events (session_id, user_id, from_status, to_status) VALUES ({intake}, {u}, 'in_progress', 'archived') RETURNING ctid::text$m$),
  ('public.manuscript_versions', 'firm', 'by intake',
   $m$INSERT INTO public.manuscript_versions (session_id, version, file_id, storage_path, pdf_sha256, certified_data_hash, certified_signed_at, generated_by)
      VALUES ({intake}, 99, 'EAA-PROBE', {intake} || '/v99-probe.pdf', repeat('a', 64), 'h', now(), {u}) RETURNING ctid::text$m$),
  ('public.profiles', 'firm', 'by the owner of an intake of the firm, or a colleague; a person reads their own',
   $m$SELECT ctid::text FROM public.profiles WHERE user_id = {u}$m$),
  ('public.quote_request_addresses', 'firm', 'by quote request',
   $m$INSERT INTO public.quote_request_addresses (quote_request_id, session_id, local_part) VALUES ({qr}, {intake}, 'probe-{tag}') RETURNING ctid::text$m$),
  ('public.quote_request_events', 'firm', 'by quote request',
   $m$INSERT INTO public.quote_request_events (quote_request_id, session_id, field) VALUES ({qr}, {intake}, 'note') RETURNING ctid::text$m$),
  ('public.quote_request_message_attachments', 'firm', 'by message',
   $m$INSERT INTO public.quote_request_message_attachments (message_id, provider_attachment_id, file_name, size_bytes, status) VALUES ({msg}, 'probe-{tag}', 'probe.pdf', 1, 'pending') RETURNING ctid::text$m$),
  ('public.quote_request_messages', 'firm', 'by quote request; held mail is a platform admin''s',
   $m$SELECT ctid::text FROM public.quote_request_messages WHERE id = {msg}$m$),
  ('public.quote_request_notes', 'firm', 'by quote request',
   $m$INSERT INTO public.quote_request_notes (quote_request_id, session_id, kind, noted_on, body) VALUES ({qr}, {intake}, 'call', current_date, 'probe {tag}') RETURNING ctid::text$m$),
  ('public.quote_request_thread_reads', 'firm', 'by quote request',
   $m$INSERT INTO public.quote_request_thread_reads (quote_request_id, last_opened_at) VALUES ({qr}, now()) RETURNING ctid::text$m$),
  ('public.quote_requests', 'firm', 'by intake',
   $m$SELECT ctid::text FROM public.quote_requests WHERE id = {qr}$m$),
  ('public.submission_status_history', 'firm', 'by intake',
   $m$INSERT INTO public.submission_status_history (session_id, to_status) VALUES ({intake}, 'under_review') RETURNING ctid::text$m$),
  ('public.submission_workflow', 'firm', 'by intake',
   $m$SELECT ctid::text FROM public.submission_workflow WHERE session_id = {intake}$m$),
  -- A firm's own row, and a membership of it: a member reads their own firm, their own membership and nobody else's.
  ('public.firms', 'firm', 'a member reads their own firm',
   $m$SELECT id::text FROM public.firms WHERE id = {firm}$m$),
  -- Storage: a file is a firm's by the intake its folder names.
  ('storage.objects WHERE bucket_id = ''documents''', 'firm', 'by the intake in the folder',
   $m$INSERT INTO storage.objects (bucket_id, name) VALUES ('documents', {u} || '/' || {intake} || '/probe-{tag}.csv') RETURNING ctid::text$m$),
  ('storage.objects WHERE bucket_id = ''manuscripts''', 'firm', 'by the intake in the folder',
   $m$INSERT INTO storage.objects (bucket_id, name) VALUES ('manuscripts', {intake} || '/v99-probe-{tag}.pdf') RETURNING ctid::text$m$),
  ('storage.objects WHERE bucket_id = ''peo-mail''', 'firm', 'by the quote request of the attachment recorded as stored',
   $m$SELECT pg_temp.store_peo_mail({msg}, {intake}, '{tag}')$m$);
INSERT INTO registry (src, scope, why, make_row, member_reads) VALUES
  ('public.firm_memberships', 'firm', 'a member reads their own membership of a firm they belong to',
   $m$INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES ({firm}, {u}, 'agent') RETURNING ctid::text$m$, false);
INSERT INTO registry (src, scope, why, make_row) VALUES
  ('public.referral_partners', 'firm', 'its own firm_id',
   $m$INSERT INTO public.referral_partners (firm_id, code, name, kind) VALUES ({firm}, 'probe-{tag}', 'Probe', 'accounting') RETURNING ctid::text$m$);
-- How a caller who is not a member writes into a firm's records (foreign_insert, when make_row is not itself an INSERT), and the
-- SET clause that moves a row to another firm (move_to). Both are tried as callers who must be refused (5b).
UPDATE registry SET move_to = 'session_id = {intake}' WHERE src IN ('public.advisor_field_reviews', 'public.advisor_notes', 'public.advisor_review_events',
  'public.ai_extraction_events', 'public.chamber_certifications', 'public.document_events', 'public.documents', 'public.information_requests',
  'public.intake_lifecycle_events', 'public.manuscript_versions', 'public.submission_status_history', 'public.submission_workflow', 'public.quote_requests');
UPDATE registry SET move_to = 'firm_id = {firm}' WHERE src IN ('public.chamber_sessions', 'public.firm_teams', 'public.firm_memberships', 'public.intake_deletions', 'public.referral_partners');
UPDATE registry SET move_to = 'quote_request_id = {qr}' WHERE src IN ('public.quote_request_addresses', 'public.quote_request_events', 'public.quote_request_notes',
  'public.quote_request_thread_reads', 'public.quote_request_messages');
UPDATE registry SET move_to = 'user_id = {u}' WHERE src IN ('public.intake_consents', 'public.profiles');
UPDATE registry SET move_to = 'message_id = {msg}' WHERE src = 'public.quote_request_message_attachments';
UPDATE registry SET move_to = 'id = {firm}' WHERE src = 'public.firms';
UPDATE registry SET move_to = 'name = {u} || ''/'' || {intake} || ''/moved-{tag}.csv''' WHERE src = 'storage.objects WHERE bucket_id = ''documents''';
UPDATE registry SET move_to = 'name = {intake} || ''/v99-moved-{tag}.pdf''' WHERE src = 'storage.objects WHERE bucket_id = ''manuscripts''';
UPDATE registry SET move_to = 'name = {intake} || ''/'' || {msg} || ''/moved-{tag}.pdf''' WHERE src = 'storage.objects WHERE bucket_id = ''peo-mail''';
UPDATE registry SET foreign_insert = $m$INSERT INTO public.chamber_certifications (session_id, user_id, signer_name, signer_title, consent_version, consent_text, signed_at, data_sha256, file_id)
  VALUES ({intake}, {u}, 'Probe', 'CEO', 'v1', 'I certify.', now(), 'x{tag}', 'EAA-9998-' || upper('{tag}'))$m$ WHERE src = 'public.chamber_certifications';
UPDATE registry SET foreign_insert = $m$INSERT INTO public.chamber_sessions (user_id, firm_id, chamber_data) VALUES ({u}, {firm}, '{}')$m$ WHERE src = 'public.chamber_sessions';
UPDATE registry SET foreign_insert = $m$INSERT INTO public.intake_consents (user_id, consent_version, consent_text) VALUES ({u}, 'v1', 'I agree.')$m$ WHERE src = 'public.intake_consents';
UPDATE registry SET foreign_insert = $m$INSERT INTO public.profiles (user_id, company_name) VALUES ({u}, 'Probe')$m$ WHERE src = 'public.profiles';
UPDATE registry SET foreign_insert = $m$INSERT INTO public.quote_requests (session_id, peo_name, status) VALUES ({intake}, 'Probe PEO', 'sent')$m$ WHERE src = 'public.quote_requests';
UPDATE registry SET foreign_insert = $m$INSERT INTO public.quote_request_messages (provider_message_id, quote_request_id, session_id, direction, from_address)
  VALUES ('x-{tag}', {qr}, {intake}, 'received', 'probe@example.test')$m$ WHERE src = 'public.quote_request_messages';
UPDATE registry SET foreign_insert = $m$INSERT INTO public.submission_workflow (session_id) VALUES ({intake})$m$ WHERE src = 'public.submission_workflow';
UPDATE registry SET foreign_insert = $m$INSERT INTO public.firms (name, address) VALUES ('Probe {tag}', 'probe-{tag}')$m$ WHERE src = 'public.firms';
UPDATE registry SET foreign_insert = $m$INSERT INTO storage.objects (bucket_id, name) VALUES ('peo-mail', {intake} || '/' || {msg} || '/x-{tag}.pdf')$m$
  WHERE src = 'storage.objects WHERE bucket_id = ''peo-mail''';
INSERT INTO registry (src, scope, why, names_intakes) VALUES
  ('public.allowed_organisations', 'platform', 'who may claim the advisor role: a platform admin''s', false),
  ('public.advisor_role_events', 'platform', 'the log of those grants: a platform admin''s', false),
  ('public.ops_alerts', 'platform', 'monitoring: a platform admin''s', false),
  -- A failure report can name the intake it happened in, for a platform admin investigating it; it holds no answer, name or file.
  ('public.ops_events', 'platform', 'monitoring: a platform admin''s', true),
  ('public.peo_census_templates', 'platform', 'the PEO list and what each asks for: the same for every firm', false),
  ('public.peo_contacts', 'platform', 'the PEO list and what each asks for: the same for every firm', false),
  ('public.peo_profile_versions', 'platform', 'the PEO list and what each asks for: the same for every firm', false),
  ('public.peos', 'platform', 'the PEO list and what each asks for: the same for every firm', false),
  ('storage.objects WHERE bucket_id = ''peo-templates''', 'platform', 'PEO template workbooks: the same for every firm', false),
  ('public.user_roles', 'own', 'a person reads their own roles', false),
  ('public.ai_global_usage', 'closed', 'rate limits', false), ('public.ai_ip_log', 'closed', 'rate limits', false), ('public.ai_request_log', 'closed', 'rate limits', false),
  ('public.broker_mailboxes', 'closed', 'encrypted tokens', false), ('public.email_delivery_events', 'closed', 'delivery log', false),
  ('public.email_suppressions', 'closed', 'do-not-send list', false), ('public.intake_milestones', 'closed', 'read as counts through a function', false),
  ('public.outbox_events', 'closed', 'queued email', false), ('public.submission_reference_counters', 'closed', 'File ID sequence', false),
  ('storage.objects WHERE bucket_id = ''quarantine''', 'closed', 'uploads whose malware scan has not passed: the service role''s', false);

-- ---------- 5b. the probe: two firms, one row each, from every caller ----------
-- Makes a row of the registry's make_row for one firm ('a' or 'b') as the superuser and returns its ctid. Each row hangs off a
-- new intake of that firm owned by a new person, so no caller owns anything the probe makes.
CREATE FUNCTION pg_temp.store_peo_mail(msg bigint, intake uuid, tag text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE path text := intake || '/' || msg || '/probe-' || tag || '.pdf'; r text;
BEGIN
  INSERT INTO public.quote_request_message_attachments (message_id, provider_attachment_id, file_name, size_bytes, status, scan_verdict, storage_bucket, storage_path)
  VALUES (msg, 'probe-' || tag, 'probe.pdf', 1, 'stored', 'clean', 'peo-mail', path);
  INSERT INTO storage.objects (bucket_id, name) VALUES ('peo-mail', path) RETURNING ctid::text INTO r;
  RETURN r;
END $$;

-- A certification as certifying leaves it, with the triggers that guard how one is made switched off for this one row.
CREATE FUNCTION pg_temp.make_certification(intake uuid, u uuid, tag text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);
  INSERT INTO public.chamber_certifications (session_id, user_id, signer_name, signer_title, consent_version, consent_text, signed_at, data_sha256, superseded_at, file_id)
  VALUES (intake, u, 'Probe', 'CEO', 'v1', 'I certify.', now(), 'h' || tag, now(), 'EAA-9999-' || upper(tag)) RETURNING ctid::text INTO r;
  PERFORM set_config('session_replication_role', 'origin', true);
  RETURN r;
END $$;

-- What a firm's probe row hangs off, as one firm's context: a new person {u}, a new intake of the firm owned by them, and what the
-- statements in `need` ask for: a quote request on it ({qr}), a message on that ({msg}). Made as the superuser.
CREATE FUNCTION pg_temp.make_ctx(need text, firm text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  tag text := substr(md5(random()::text), 1, 10);
  fid uuid := pg_temp.id('firm_' || firm);
  u uuid;
  s uuid;
  q bigint;
  m bigint;
BEGIN
  RESET ROLE;
  u := pg_temp.new_user('probe_' || tag || '@example.test', false);
  IF need LIKE '%{intake}%' OR need LIKE '%{qr}%' OR need LIKE '%{msg}%' OR need LIKE '%intake_consents%' OR need LIKE '%chamber_sessions%' OR need LIKE '%profiles%' THEN
    INSERT INTO public.intake_consents (user_id, consent_version, consent_text) VALUES (u, 'v1', 'I agree.');
    INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (u, '{"company_name":"Probe"}') RETURNING id INTO s;
    UPDATE public.chamber_sessions SET firm_id = fid WHERE id = s;
  END IF;
  IF need LIKE '%{qr}%' OR need LIKE '%{msg}%' THEN
    INSERT INTO public.quote_requests (session_id, peo_name, status) VALUES (s, 'Probe PEO', 'sent') RETURNING id INTO q;
  END IF;
  IF need LIKE '%{msg}%' THEN
    INSERT INTO public.quote_request_messages (provider_message_id, quote_request_id, session_id, direction, from_address)
    VALUES ('probe-' || tag, q, s, 'received', 'probe@example.test') RETURNING id INTO m;
  END IF;
  RETURN jsonb_build_object('firm', fid, 'u', u, 'intake', s, 'qr', q, 'msg', m, 'tag', tag);
END $$;

-- A statement with a firm's context filled in. A fresh tag keeps what a caller tries from colliding with the probe's own rows.
CREATE FUNCTION pg_temp.fill(stmt text, ctx jsonb, fresh_tag boolean DEFAULT false) RETURNS text LANGUAGE sql AS $$
  SELECT replace(replace(replace(replace(replace(replace(stmt,
    '{firm}', quote_literal(ctx ->> 'firm')), '{u}', quote_literal(ctx ->> 'u')),
    '{intake}', COALESCE(quote_literal(ctx ->> 'intake'), 'NULL')), '{qr}', COALESCE(ctx ->> 'qr', 'NULL')),
    '{msg}', COALESCE(ctx ->> 'msg', 'NULL')),
    '{tag}', CASE WHEN fresh_tag THEN 'x' || substr(md5(random()::text), 1, 9) ELSE ctx ->> 'tag' END)
$$;

-- Makes the row of the registry's make_row for one firm as the superuser and returns its ctid. A maker that returns no row is a
-- failure: the probe would have nothing to test.
CREATE FUNCTION pg_temp.make_row(make text, ctx jsonb) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  RESET ROLE;
  EXECUTE pg_temp.fill(make, ctx) INTO r;
  IF r IS NULL THEN RAISE EXCEPTION 'the statement that makes a row returned none'; END IF;
  RETURN r;
END $$;

-- Which firm's members a caller is, as the matrix has it: the first firm's, the second's, or neither (a non-member, a former
-- member, a platform admin, a guest, a prospect, an advisor behind a guest token or with no second factor, signed out).
CREATE FUNCTION pg_temp.member_of(who text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN who IN ('advisor', 'admin', 'agent_2', 'lead_1', 'advisor_pw_mfa') THEN 'a'
              WHEN who IN ('agent_b', 'owner_b') THEN 'b' END
$$;

-- Runs a statement that names no row (so row security applies only the write rule, not the read rule a WHERE would also invoke)
-- as the caller, then, as the superuser, whether any of the rows at ids was touched: a deleted or updated row is no longer at its
-- ctid. Rolls it back. 'touched', 'untouched', or the SQLSTATE the statement raised.
CREATE FUNCTION pg_temp.touches(stmt text, tbl text, ids text[]) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  n bigint;
  s text;
  m text;
BEGIN
  BEGIN
    EXECUTE stmt;
    RESET ROLE;
    EXECUTE format('SELECT count(*) FROM %s WHERE ctid::text = ANY (%L)', tbl, ids) INTO n;
    RAISE EXCEPTION USING ERRCODE = 'ZZ999', MESSAGE = CASE WHEN n < cardinality(ids) THEN 'touched' ELSE 'untouched' END;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT;
    IF s = 'ZZ999' THEN RETURN m; END IF;
    RETURN s;
  END;
END $$;

CREATE FUNCTION pg_temp.count_ids(tbl text, ids text[]) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE format('SELECT count(*) FROM %s WHERE ctid::text = ANY (%L)', tbl, ids) INTO n;
  RETURN n;
EXCEPTION WHEN insufficient_privilege THEN RETURN 0;
END $$;

-- Makes a row for each firm in one registered table or bucket, then as every caller: reads it, counts it, tries to change it,
-- to delete it, to insert into the firm's records and (for a member) to move the firm's own row to the other firm. Only a current
-- member of the row's own firm may read it. Only an explicit refusal counts as safe: no row matched, or insufficient privilege;
-- any other error (a foreign key, a unique index) was raised after row security let the statement through, so it is a problem.
-- Nothing is left behind. Returns what is wrong, or NULL; sets ran when the probe reached its end.
CREATE FUNCTION pg_temp.probe_firm(p_src text, p_make text, p_member_reads boolean, p_firm_a_only boolean, p_foreign_insert text, p_move_to text,
  OUT problems text, OUT ran boolean)
LANGUAGE plpgsql AS $$
DECLARE
  tbl text := pg_temp.src_table(p_src);
  need text := p_make || COALESCE(p_foreign_insert, '') || COALESCE(p_move_to, '');
  ctx_of jsonb := '{}';
  rows_of jsonb := '{}';
  f text;
  o text;
  who text;
  side text;
  ids text[];
  one text[];
  res text;
  firm_name text;
  other_name text;
BEGIN
  problems := '';
  ran := false;
  BEGIN
    FOREACH f IN ARRAY ARRAY['a', 'b'] LOOP
      IF f = 'b' AND p_firm_a_only THEN CONTINUE; END IF;
      ctx_of := ctx_of || jsonb_build_object(f, pg_temp.make_ctx(need, f));
      rows_of := rows_of || jsonb_build_object(f, pg_temp.make_row(p_make, ctx_of -> f));
    END LOOP;
    FOREACH who IN ARRAY pg_temp.matrix_callers() LOOP
      CONTINUE WHEN who = 'service';
      side := pg_temp.member_of(who);
      PERFORM pg_temp.become(who);
      ids := pg_temp.row_ids(p_src);
      FOREACH f IN ARRAY ARRAY['a', 'b'] LOOP
        CONTINUE WHEN f = 'b' AND p_firm_a_only;
        firm_name := CASE f WHEN 'a' THEN 'first' ELSE 'second' END;
        one := ARRAY[rows_of ->> f];
        IF f IS DISTINCT FROM side THEN
          IF (rows_of ->> f) = ANY (ids) THEN problems := problems || format(E'\n    %s reads a row of the %s firm', who, firm_name); END IF;
          IF pg_temp.count_ids(tbl, one) <> 0 THEN problems := problems || format(E'\n    %s counts a row of the %s firm', who, firm_name); END IF;
          -- Changing and deleting name no row: a WHERE on a column would also invoke the read rule, which hides rows from a
          -- caller whose write rule is open. The statements run over the whole table and the row must come out untouched.
          res := pg_temp.touches(format('UPDATE %s SET %s', tbl, pg_temp.fill(p_move_to, ctx_of -> f, true)), tbl, one);
          IF res = 'untouched' OR res = '42501' THEN NULL;
          ELSIF res = 'touched' THEN problems := problems || format(E'\n    %s changes a row of the %s firm', who, firm_name);
          ELSE problems := problems || format(E'\n    %s''s change of a row of the %s firm raised %s rather than being refused', who, firm_name, res); END IF;
          res := pg_temp.touches(format('DELETE FROM %s', tbl), tbl, one);
          IF res = 'untouched' OR res = '42501' THEN NULL;
          ELSIF res = 'touched' THEN problems := problems || format(E'\n    %s deletes a row of the %s firm', who, firm_name);
          ELSE problems := problems || format(E'\n    %s''s delete of a row of the %s firm raised %s rather than being refused', who, firm_name, res); END IF;
          -- A member taking another firm's row for their own firm: the same write, with their firm's context.
          IF side IS NOT NULL AND ctx_of ? side THEN
            res := pg_temp.touches(format('UPDATE %s SET %s', tbl, pg_temp.fill(p_move_to, ctx_of -> side, true)), tbl, one);
            IF res = 'untouched' OR res = '42501' THEN NULL;
            ELSIF res = 'touched' THEN problems := problems || format(E'\n    %s takes a row of the %s firm for their own', who, firm_name);
            ELSE problems := problems || format(E'\n    %s''s taking of a row of the %s firm for their own raised %s rather than being refused', who, firm_name, res); END IF;
          END IF;
          -- A row put into the firm's records: the insert must be refused by privilege or row security, never run.
          res := pg_temp.attempt(pg_temp.fill(p_foreign_insert, ctx_of -> f, true));
          IF res = '42501' THEN NULL;
          ELSIF res LIKE 'rows:%' THEN problems := problems || format(E'\n    %s inserts into the %s firm''s records', who, firm_name);
          ELSE problems := problems || format(E'\n    %s''s insert into the %s firm''s records raised %s rather than being refused', who, firm_name, res); END IF;
        ELSE
          IF p_member_reads AND NOT (rows_of ->> f) = ANY (ids) THEN
            -- A positive control: a rule that shows a firm's rows to nobody would pass every check above.
            problems := problems || format(E'\n    %s, a member of the %s firm, cannot read its row', who, firm_name);
          END IF;
          -- A member moving their firm's own row onto the other firm: the new row must be refused too.
          o := CASE f WHEN 'a' THEN 'b' ELSE 'a' END;
          IF ctx_of ? o THEN
            other_name := CASE o WHEN 'a' THEN 'first' ELSE 'second' END;
            res := pg_temp.touches(format('UPDATE %s SET %s', tbl, pg_temp.fill(p_move_to, ctx_of -> o, true)), tbl, one);
            IF res = 'untouched' OR res = '42501' THEN NULL;
            ELSIF res = 'touched' THEN problems := problems || format(E'\n    %s moves a row of the %s firm to the %s firm', who, firm_name, other_name);
            ELSE problems := problems || format(E'\n    %s''s move of a row of the %s firm to the %s firm raised %s rather than being refused', who, firm_name, other_name, res); END IF;
          END IF;
        END IF;
      END LOOP;
      RESET ROLE;
    END LOOP;
    RAISE EXCEPTION USING ERRCODE = 'ZZ998', MESSAGE = 'probe finished; roll its rows back';
  EXCEPTION
    WHEN SQLSTATE 'ZZ998' THEN ran := true;
    WHEN OTHERS THEN problems := problems || format(E'\n    the probe could not run: %s', SQLERRM);
  END;
  RESET ROLE;
  problems := NULLIF(problems, '');
END $$;

-- Everything wrong with how the database separates firms, one per line, or NULL. It registers nothing itself: it checks
-- the registry against the catalogue, then runs the probe of every firm table and bucket.
CREATE FUNCTION pg_temp.isolation_gaps() RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  gaps text := '';
  c record;
  r record;
  pr record;
  holds_firm_data boolean;
BEGIN
  DELETE FROM probe_ran;
  -- Every public table and every bucket is registered, and nothing registered is gone.
  FOR c IN SELECT cl.oid, cl.relname FROM pg_class cl WHERE cl.relnamespace = 'public'::regnamespace AND cl.relkind IN ('r', 'p') ORDER BY cl.relname LOOP
    IF NOT EXISTS (SELECT 1 FROM registry WHERE src = 'public.' || c.relname) THEN
      gaps := gaps || format(E'\n  public.%s is not in the registry: say whether it holds a firm''s data, and if so how to make a row of it', c.relname);
    END IF;
  END LOOP;
  FOR c IN SELECT b.id FROM storage.buckets b ORDER BY b.id LOOP
    IF NOT EXISTS (SELECT 1 FROM registry WHERE src = format('storage.objects WHERE bucket_id = %L', c.id)) THEN
      gaps := gaps || format(E'\n  bucket %s is not in the registry: say whether it holds a firm''s files, and if so how to make one', c.id);
    END IF;
  END LOOP;
  FOR r IN SELECT * FROM registry ORDER BY src LOOP
    IF r.src LIKE 'public.%' AND NOT EXISTS (SELECT 1 FROM pg_class cl WHERE cl.relnamespace = 'public'::regnamespace AND cl.relkind IN ('r', 'p') AND 'public.' || cl.relname = r.src) THEN
      gaps := gaps || format(E'\n  %s is in the registry but there is no such table', r.src);
      CONTINUE;
    END IF;
    IF r.src LIKE 'storage.objects%' AND NOT EXISTS (SELECT 1 FROM storage.buckets b WHERE format('storage.objects WHERE bucket_id = %L', b.id) = r.src) THEN
      gaps := gaps || format(E'\n  %s is in the registry but there is no such bucket', r.src);
      CONTINUE;
    END IF;
    IF r.scope = 'firm' THEN
      IF r.make_row IS NULL THEN
        gaps := gaps || format(E'\n  %s holds a firm''s data and has no way to make a row, so no probe', r.src);
        CONTINUE;
      END IF;
      IF COALESCE(r.foreign_insert, CASE WHEN r.make_row ~* '^\s*INSERT' THEN r.make_row END) IS NULL THEN
        gaps := gaps || format(E'\n  %s has no way to insert into a firm''s records as someone else, so its writes are not probed', r.src);
        CONTINUE;
      END IF;
      IF r.move_to IS NULL THEN
        gaps := gaps || format(E'\n  %s has no way to move a row to another firm, so its updates are not probed', r.src);
        CONTINUE;
      END IF;
      SELECT * INTO pr FROM pg_temp.probe_firm(r.src, r.make_row, r.member_reads, r.firm_a_only,
        COALESCE(r.foreign_insert, regexp_replace(r.make_row, '\s+RETURNING\s+ctid::text\s*$', '', 'i')), r.move_to);
      INSERT INTO probe_ran VALUES (r.src, pr.ran, pr.problems);
      IF pr.ran AND pr.problems IS NOT NULL THEN gaps := gaps || format(E'\n  %s is open across firms:%s', r.src, pr.problems); END IF;
    ELSIF r.scope = 'closed' AND r.src LIKE 'public.%' THEN
      IF EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = substr(r.src, 8)) THEN
        gaps := gaps || format(E'\n  %s is declared closed but has a policy', r.src);
      END IF;
    ELSIF r.scope IN ('platform', 'own') AND r.src LIKE 'public.%' THEN
      holds_firm_data := EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = r.src::regclass AND a.attnum > 0 AND NOT a.attisdropped
                                   AND a.attname IN ('firm_id', 'session_id', 'quote_request_id'));
      IF holds_firm_data AND NOT r.names_intakes THEN
        gaps := gaps || format(E'\n  %s has a firm_id, session_id or quote_request_id column but is declared %s', r.src, r.scope);
      END IF;
    END IF;
  END LOOP;
  -- A firm table whose probe did not run fails, whatever else is true.
  FOR r IN SELECT g.src, p.detail FROM registry g LEFT JOIN probe_ran p ON p.src = g.src
           WHERE g.scope = 'firm' AND g.make_row IS NOT NULL AND p.ran IS NOT TRUE LOOP
    gaps := gaps || format(E'\n  %s: no probe ran%s', r.src, COALESCE(E'\n  ' || r.detail, ''));
  END LOOP;
  RETURN NULLIF(gaps, '');
END $$;

DO $$
DECLARE gaps text := pg_temp.isolation_gaps();
BEGIN
  IF gaps IS NOT NULL THEN RAISE EXCEPTION E'FAIL: the firms are not kept apart:%', gaps; END IF;
  RAISE NOTICE 'data_isolation: % firm tables and buckets probed with two firms', (SELECT count(*) FROM probe_ran WHERE ran);
END $$;

-- ---------- 5c. the gate can fail ----------
-- Each of these is a table (or bucket) the gate must refuse, and one the gate must accept. The first two are the shapes
-- reviewers used to fool a check that read policy text: the policy mentions a firm helper, never ties it to the row read.
DO $$
DECLARE
  g text;
BEGIN
  IF pg_temp.isolation_gaps() IS NOT NULL THEN RAISE EXCEPTION E'FAIL: before the negative cases, the gate is not clean:%', pg_temp.isolation_gaps(); END IF;

  CREATE TABLE public.probe_exists_firms (id int, firm_id uuid);
  CREATE TABLE public.probe_exists_session (id int, session_id uuid);
  CREATE TABLE public.probe_second_policy (id int, session_id uuid);
  CREATE TABLE public.probe_no_maker (id int, session_id uuid);
  CREATE TABLE public.probe_shows_nobody (id int, session_id uuid);
  CREATE TABLE public.probe_unregistered (id int, session_id uuid);
  CREATE TABLE public.probe_bad_maker (id int, session_id uuid);
  CREATE TABLE public.probe_fine (id int, session_id uuid);
  CREATE TABLE public.probe_empty_maker (id int, session_id uuid);
  CREATE TABLE public.probe_platform (id int, firm_id uuid);
  CREATE TABLE public.probe_closed (id int);
  CREATE TABLE public.probe_insert_open (id int, session_id uuid);
  CREATE TABLE public.probe_update_open (id int, session_id uuid);
  CREATE TABLE public.probe_takeover (id int, session_id uuid);
  CREATE TABLE public.probe_delete_fk (id int PRIMARY KEY, session_id uuid);
  CREATE TABLE public.probe_delete_fk_child (id int, parent_id int REFERENCES public.probe_delete_fk (id));
  ALTER TABLE public.probe_exists_firms ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.probe_exists_session ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.probe_second_policy ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.probe_no_maker ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.probe_shows_nobody ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.probe_unregistered ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.probe_bad_maker ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.probe_fine ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.probe_empty_maker ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.probe_platform ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.probe_closed ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.probe_insert_open ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.probe_update_open ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.probe_takeover ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.probe_delete_fk ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.probe_delete_fk_child ENABLE ROW LEVEL SECURITY;
  GRANT ALL ON public.probe_takeover, public.probe_empty_maker, public.probe_insert_open, public.probe_update_open, public.probe_delete_fk, public.probe_delete_fk_child TO anon, authenticated;
  GRANT ALL ON public.probe_exists_firms, public.probe_exists_session, public.probe_second_policy, public.probe_no_maker,
    public.probe_shows_nobody, public.probe_bad_maker, public.probe_unregistered, public.probe_fine TO anon, authenticated;
  -- Any member of any firm reads every firm's rows: the helper is asked about firms the caller can see, not about the row.
  CREATE POLICY p ON public.probe_exists_firms FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM firms f WHERE is_firm_member(f.id)));
  -- The same through the intakes the caller can see.
  CREATE POLICY p ON public.probe_exists_session FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM chamber_sessions s WHERE intake_in_my_firm(s.id)));
  -- One policy is tied to the row; a second, permissive one opens the table to anyone with a session on it.
  CREATE POLICY p_read ON public.probe_second_policy FOR ALL TO authenticated USING (intake_in_my_firm(session_id));
  CREATE POLICY p_extra ON public.probe_second_policy FOR ALL TO authenticated USING (session_id IS NOT NULL);
  CREATE POLICY p ON public.probe_no_maker FOR ALL TO authenticated USING (intake_in_my_firm(session_id));
  -- A rule that shows a firm's rows to no one passes every check that the other firm sees nothing; the positive control catches it.
  CREATE POLICY p ON public.probe_shows_nobody FOR ALL TO authenticated USING (false);
  CREATE POLICY p ON public.probe_unregistered FOR ALL TO authenticated USING (true);
  CREATE POLICY p ON public.probe_bad_maker FOR ALL TO authenticated USING (intake_in_my_firm(session_id));
  -- What the real schema does: the helper is given the row's own column.
  CREATE POLICY p ON public.probe_fine FOR ALL TO authenticated USING (intake_in_my_firm(session_id));
  -- A maker that finds no row: the probe never had a row to test, so it did not run.
  CREATE POLICY p ON public.probe_empty_maker FOR ALL TO authenticated USING (true);
  CREATE POLICY p ON public.probe_platform FOR ALL TO authenticated USING (true);
  CREATE POLICY p ON public.probe_closed FOR ALL TO authenticated USING (true);
  -- Reads are tied to the row; a caller can still put a row into another firm's records.
  CREATE POLICY p_read ON public.probe_insert_open FOR SELECT TO authenticated USING (intake_in_my_firm(session_id));
  CREATE POLICY p_ins ON public.probe_insert_open FOR INSERT TO authenticated WITH CHECK (true);
  -- The new row of an update must pass the read policy too, so a rule that lets a member move a row to another firm is one whose
  -- read policy shows it there: both are open here, and the probe must name the move as well as the read.
  CREATE POLICY p_read ON public.probe_update_open FOR SELECT TO authenticated USING (true);
  CREATE POLICY p_upd ON public.probe_update_open FOR UPDATE TO authenticated USING (intake_in_my_firm(session_id)) WITH CHECK (true);
  -- Reads are tied to the row, and so is the new row of an update; but any member may update any firm's row, so a member can
  -- take another firm's row for their own firm.
  CREATE POLICY p_read ON public.probe_takeover FOR SELECT TO authenticated USING (intake_in_my_firm(session_id));
  CREATE POLICY p_upd ON public.probe_takeover FOR UPDATE TO authenticated USING (true) WITH CHECK (intake_in_my_firm(session_id));
  -- Anyone may delete the row, but another table's foreign key stops it: that error is not a refusal by row security, and
  -- must not be read as one.
  CREATE POLICY p ON public.probe_delete_fk FOR ALL TO authenticated USING (true);
  INSERT INTO registry (src, scope, why, make_row) VALUES
    ('public.probe_empty_maker', 'firm', 'probe', $m$SELECT ctid::text FROM public.probe_empty_maker WHERE session_id = {intake}$m$),
    ('public.probe_takeover', 'firm', 'probe', $m$INSERT INTO public.probe_takeover (id, session_id) VALUES (1, {intake}) RETURNING ctid::text$m$),
    ('public.probe_insert_open', 'firm', 'probe', $m$INSERT INTO public.probe_insert_open (id, session_id) VALUES (1, {intake}) RETURNING ctid::text$m$),
    ('public.probe_update_open', 'firm', 'probe', $m$INSERT INTO public.probe_update_open (id, session_id) VALUES (1, {intake}) RETURNING ctid::text$m$),
    ('public.probe_delete_fk', 'firm', 'probe',
     $m$WITH p AS (INSERT INTO public.probe_delete_fk (id, session_id) VALUES (abs(hashtext('{tag}')), {intake}) RETURNING id, ctid::text AS c),
        k AS (INSERT INTO public.probe_delete_fk_child (id, parent_id) SELECT 1, id FROM p) SELECT c FROM p$m$),
    ('public.probe_exists_firms', 'firm', 'probe', $m$INSERT INTO public.probe_exists_firms (id, firm_id) VALUES (1, {firm}) RETURNING ctid::text$m$),
    ('public.probe_exists_session', 'firm', 'probe', $m$INSERT INTO public.probe_exists_session (id, session_id) VALUES (1, {intake}) RETURNING ctid::text$m$),
    ('public.probe_second_policy', 'firm', 'probe', $m$INSERT INTO public.probe_second_policy (id, session_id) VALUES (1, {intake}) RETURNING ctid::text$m$),
    ('public.probe_no_maker', 'firm', 'probe', NULL),
    -- Its way to make a row fails (no such column), so the probe never ran: that fails the gate, not passes it.
    ('public.probe_bad_maker', 'firm', 'probe', $m$INSERT INTO public.probe_bad_maker (id, nothing) VALUES (1, {intake}) RETURNING ctid::text$m$),
    ('public.probe_shows_nobody', 'firm', 'probe', $m$INSERT INTO public.probe_shows_nobody (id, session_id) VALUES (1, {intake}) RETURNING ctid::text$m$),
    ('public.probe_fine', 'firm', 'probe', $m$INSERT INTO public.probe_fine (id, session_id) VALUES (1, {intake}) RETURNING ctid::text$m$);
  -- A firm_id column on a table registered as platform-wide, and a policy on one registered as closed.
  INSERT INTO registry (src, scope, why) VALUES ('public.probe_platform', 'platform', 'probe'), ('public.probe_closed', 'closed', 'probe'),
    ('public.probe_delete_fk_child', 'closed', 'probe');
  -- How the probe writes into each, and moves a row of each to the other firm.
  UPDATE registry SET move_to = 'session_id = {intake}' WHERE src LIKE 'public.probe\_%' AND src NOT IN ('public.probe_exists_firms', 'public.probe_platform', 'public.probe_closed', 'public.probe_delete_fk_child');
  UPDATE registry SET move_to = 'firm_id = {firm}' WHERE src = 'public.probe_exists_firms';
  UPDATE registry SET foreign_insert = $m$INSERT INTO public.probe_delete_fk (id, session_id) VALUES (abs(hashtext('{tag}')), {intake})$m$ WHERE src = 'public.probe_delete_fk';
  UPDATE registry SET foreign_insert = $m$INSERT INTO public.probe_empty_maker (id, session_id) VALUES (1, {intake})$m$ WHERE src = 'public.probe_empty_maker';
  g := pg_temp.isolation_gaps();
  IF g IS NULL
     -- Each case is matched on its own table's whole gap, so a probe that did not run cannot satisfy it.
     OR g NOT LIKE '%public.probe_exists_firms is open across firms:%agent_b reads a row of the first firm%'
     OR g NOT LIKE '%public.probe_exists_session is open across firms:%agent_b reads a row of the first firm%'
     OR g NOT LIKE '%public.probe_second_policy is open across firms:%agent_b reads a row of the first firm%'
     OR g NOT LIKE '%probe_no_maker holds a firm''s data and has no way to make a row%'
     OR g NOT LIKE '%probe_bad_maker: no probe ran%'
     OR g NOT LIKE '%probe_empty_maker: no probe ran%'
     OR g NOT LIKE '%public.probe_insert_open is open across firms:%agent_b inserts into the first firm''s records%'
     OR g NOT LIKE '%public.probe_update_open is open across firms:%agent_b moves a row of the second firm to the first firm%'
     OR g NOT LIKE '%public.probe_takeover is open across firms:%agent_b takes a row of the first firm for their own%'
     OR g NOT LIKE '%public.probe_delete_fk is open across firms:%advisor''s delete of a row of the second firm raised 23503 rather than being refused%'
     OR g NOT LIKE '%public.probe_platform has a firm_id, session_id or quote_request_id column but is declared platform%'
     OR g NOT LIKE '%public.probe_closed is declared closed but has a policy%'
     OR g NOT LIKE '%public.probe_shows_nobody is open across firms:%advisor, a member of the first firm, cannot read its row%'
     OR g NOT LIKE '%public.probe_exists_firms is open across firms:%advisor reads a row of the second firm%advisor counts a row of the second firm%advisor changes a row of the second firm%advisor deletes a row of the second firm%'
     OR g NOT LIKE '%platform_admin reads a row of the first firm%'
     OR g NOT LIKE '%former_agent reads a row of the first firm%'
     OR g NOT LIKE '%prospect_a reads a row of the first firm%'
     OR g NOT LIKE '%probe_unregistered%'
     OR g LIKE '%probe_fine%' THEN
    RAISE EXCEPTION E'FAIL: the gate did not name exactly the open, unprobed and unregistered tables:%', g;
  END IF;
  -- Each alone makes it fail.
  DELETE FROM registry WHERE src IN ('public.probe_exists_session', 'public.probe_second_policy', 'public.probe_no_maker', 'public.probe_shows_nobody', 'public.probe_bad_maker',
    'public.probe_empty_maker', 'public.probe_insert_open', 'public.probe_update_open', 'public.probe_takeover', 'public.probe_delete_fk', 'public.probe_delete_fk_child', 'public.probe_platform', 'public.probe_closed');
  DROP TABLE public.probe_exists_session, public.probe_second_policy, public.probe_no_maker, public.probe_shows_nobody, public.probe_bad_maker, public.probe_unregistered,
    public.probe_empty_maker, public.probe_insert_open, public.probe_update_open, public.probe_takeover, public.probe_delete_fk_child, public.probe_delete_fk, public.probe_platform, public.probe_closed;
  g := pg_temp.isolation_gaps();
  IF g IS NULL OR g NOT LIKE '%probe_exists_firms%' OR g LIKE '%probe_fine%' THEN RAISE EXCEPTION E'FAIL: the gate passed a policy that asks is_firm_member about the firms the caller can see:%', g; END IF;
  DELETE FROM registry WHERE src = 'public.probe_exists_firms';
  DROP TABLE public.probe_exists_firms;
  IF pg_temp.isolation_gaps() IS NOT NULL THEN RAISE EXCEPTION E'FAIL: the gate flags a table that ties the helper to its row:%', pg_temp.isolation_gaps(); END IF;
  -- A bucket that isn't registered, and a registered one that is gone.
  INSERT INTO storage.buckets (id, name, public) VALUES ('probe-bucket', 'probe-bucket', false);
  g := pg_temp.isolation_gaps();
  IF g IS NULL OR g NOT LIKE '%probe-bucket%' THEN RAISE EXCEPTION E'FAIL: the gate passed a bucket that is not registered:%', g; END IF;
  DELETE FROM storage.buckets WHERE id = 'probe-bucket';
  INSERT INTO registry (src, scope, why) VALUES ('public.probe_gone', 'platform', 'probe');
  g := pg_temp.isolation_gaps();
  IF g IS NULL OR g NOT LIKE '%probe_gone%' THEN RAISE EXCEPTION E'FAIL: the gate passed a registered table that does not exist:%', g; END IF;
  DELETE FROM registry WHERE src = 'public.probe_gone';
  -- A probe that did not run is a failure too.
  DELETE FROM registry WHERE src = 'public.probe_fine';
  DROP TABLE public.probe_fine;
  IF pg_temp.isolation_gaps() IS NOT NULL THEN RAISE EXCEPTION E'FAIL: the probes were left behind:%', pg_temp.isolation_gaps(); END IF;
  RAISE NOTICE 'data_isolation: the gate fails on the open, unprobed and unregistered tables it should';
END $$;

-- ---------- 5d. every privileged function says what it does with a firm's data (CRM-P2.1b) ----------
-- Every function in public that runs as its owner (SECURITY DEFINER) or that anon or authenticated can execute is registered here,
-- by name, with what it does with a firm's data. The catalogue (pg_proc and the privileges, never a function's text) is compared
-- with the registry, so a new privileged function that isn't registered fails the build, as a new table does (5a):
--   firm_scoped   reads or changes a firm's data on behalf of a person. It carries a two-firm probe in part 4e (fprobe): a member of
--                 the other firm, a platform admin, a former member and a non-member get none of the firm's rows and change none,
--                 by id and by listing
--   platform_wide by design: the same for every firm, kept by platform admins, or about no firm's data (the reason says which)
--   own           a person's own rows, or an answer about the caller only (what row security policies ask as the caller)
--   public        a constant, a pure check, or a name or word that shows no one's data
--   service_only  not executable by anon or authenticated: the service role's work (the scheduled jobs, the edge functions), or a
--                 helper the firm-scoped functions above call
--   trigger       a trigger function, not executable by anon or authenticated
--   deferred      not yet scoped to a firm, by the story named in `story`
-- Names are unique in public (an overloaded name must be registered by signature, which this check refuses until the registry says so).
CREATE TEMP TABLE fn_class (
  fn text PRIMARY KEY,
  class text NOT NULL CHECK (class IN ('firm_scoped', 'platform_wide', 'own', 'public', 'service_only', 'trigger', 'deferred')),
  story text,
  why text NOT NULL
);
GRANT SELECT ON fn_class TO anon, authenticated, service_role;

INSERT INTO fn_class (fn, class, why)
SELECT unnest(ARRAY[
  'advisor_add_quote_request_note', 'advisor_correct_quote_request_note', 'advisor_email_problems', 'advisor_intake_funnel',
  'advisor_intake_sources', 'advisor_list_outbox_events', 'advisor_list_submissions', 'advisor_note_underwriter_question',
  'advisor_add_referral_partner', 'advisor_update_referral_partner',
  'advisor_open_quote_request_thread', 'advisor_outbox_summary', 'advisor_record_quote_send', 'advisor_reissue_quote_request_address',
  'advisor_request_information', 'advisor_requeue_outbox_event', 'advisor_update_quote_request', 'record_manuscript_version',
  'request_intake_deletion', 'retention_review_due', 'retry_intake_deletion', 'review_submission_field', 'revoke_chamber_session',
  'session_verified_fields', 'set_submission_needs_action', 'set_submission_status'
]), 'firm_scoped', 'an advisor''s or admin''s read or change of a firm''s submissions, quote requests, outbox or records: the caller''s own firm only (4e)';

INSERT INTO fn_class (fn, class, why) VALUES
  ('admin_add_allowed_organisation', 'platform_wide', 'the organisations whose members get the advisor role: the platform''s, kept by platform admins'),
  ('admin_remove_allowed_organisation', 'platform_wide', 'the same'),
  ('claim_advisor_role_by_organisation', 'platform_wide', 'grants the advisor role to the caller''s own sign-in from an allowed organisation; reads no firm''s data'),
  ('admin_add_peo', 'platform_wide', 'the PEO list is the same for every firm, kept by platform admins'),
  ('admin_discard_peo_draft', 'platform_wide', 'a PEO''s requirement profile: the same for every firm'),
  ('admin_publish_peo_profile', 'platform_wide', 'the same'),
  ('admin_recheck_peo_profile', 'platform_wide', 'the same'),
  ('admin_save_peo_profile', 'platform_wide', 'the same'),
  ('admin_set_peo_listed', 'platform_wide', 'the same'),
  ('admin_register_census_template', 'platform_wide', 'a PEO''s blank template workbook: the same for every firm'),
  ('clean_template_workbook_path', 'platform_wide', 'where a PEO''s blank template workbook is; names no one'),
  ('is_clean_census_template_file', 'platform_wide', 'the storage policy on the template bucket; names no one'),
  ('peo_catalog', 'platform_wide', 'the PEOs and their published profiles: the same for every firm'),
  ('admin_waiting_firms', 'platform_wide', 'the firms waiting for a platform admin''s decision: no firm''s member sees them by row security, so only platform admins read this list'),
  ('admin_decide_firm', 'platform_wide', 'a platform admin approves or refuses a waiting firm'),
  ('sign_up_firm', 'own', 'a signed-in person with a verified email makes a firm of their own and becomes its owner; acts only for the caller'),
  ('admin_ops_summary', 'platform_wide', 'counts of the platform''s own monitoring events by kind, source and code, for platform admins; no firm''s row and no id'),
  ('report_client_event', 'platform_wide', 'a browser failure report from anyone, kept in the platform''s monitoring; keeps only an intake the caller owns or is a firm member of (4h)'),
  ('archive_chamber_session', 'own', 'the prospect''s Start over, on their own intake'),
  ('record_intake_consent', 'own', 'the caller''s own agreement'),
  ('prospect_final_manuscript', 'own', 'the prospect''s own final Manuscript'),
  ('prospect_information_request', 'own', 'the advisor''s open request on the prospect''s own intake'),
  ('prospect_submission_status', 'own', 'the prospect''s own submission''s shared status'),
  ('record_manuscript_download', 'own', 'a download of the prospect''s own Manuscript'),
  ('consume_ai_quota', 'own', 'the caller''s own AI allowance'),
  ('my_mailbox', 'own', 'whether the caller''s own mailbox is connected; never its token'),
  ('advisor_needs_second_factor', 'own', 'whether the caller''s own password sign-in is all that holds back their role'),
  ('firm_role', 'own', 'the caller''s own role in a firm'),
  ('is_firm_member', 'own', 'whether the caller is a current member of a firm'),
  ('is_member_of_firm_address', 'own', 'whether the caller is a current member of the firm at an address'),
  ('can_see_firm_record', 'own', 'the visibility helper: whether the caller may see a firm''s record that a person owns'),
  ('intake_in_my_firm', 'own', 'row security helper: whether an intake is of a firm the caller belongs to'),
  ('intake_folder_in_my_firm', 'own', 'storage policy helper: the same for the intake a folder names'),
  ('quote_request_in_my_firm', 'own', 'row security helper: whether a quote request is on an intake of a firm the caller belongs to'),
  ('intake_owner_in_my_firm', 'own', 'row security helper: whether a person owns an intake of a firm the caller belongs to'),
  ('colleague_in_my_firm', 'own', 'row security helper: whether a person is a current member of a firm the caller belongs to'),
  ('has_role', 'own', 'whether the caller''s own token holds a role'),
  ('is_advisor', 'own', 'whether the caller''s own token holds the advisor or admin role'),
  ('is_own_final_manuscript', 'own', 'storage policy helper: the file of the caller''s own final Manuscript'),
  ('is_certified_evidence', 'own', 'storage policy helper: a file of the caller''s own certified intake'),
  ('is_withheld_document_file', 'own', 'storage policy helper: whether the document at a path has a scan that hasn''t passed'),
  ('current_intake_consent_id', 'own', 'consent trigger helper, as the caller: row security limits it to the caller''s own agreement'),
  ('firm_public_name', 'public', 'what a firm address shows before sign-in: the name of a firm that exists, nothing else (D-27)'),
  ('intake_accepts_files', 'deferred', 'upload policy helper: answers for any intake of any firm, not the caller''s; the file stories scope it'),
  ('can_read_peo_mail', 'deferred', 'held mail belongs to no firm yet: a platform admin''s until it is assigned'),
  ('apply_mail_move', 'deferred', 'held mail: assigning it to a firm''s quote request'),
  ('plan_mail_move', 'deferred', 'held mail'),
  ('plan_held_mail_discard', 'deferred', 'held mail'),
  ('finish_held_mail_discard', 'deferred', 'held mail'),
  ('held_mail_due', 'deferred', 'held mail'),
  ('held_mail_actor_has', 'deferred', 'held mail'),
  ('mailbox_store', 'deferred', 'mailboxes'),
  ('mailbox_secret', 'deferred', 'mailboxes'),
  ('mailbox_delete', 'deferred', 'mailboxes');
UPDATE fn_class SET story = 'CRM-P2.1c' WHERE class = 'deferred';
UPDATE fn_class SET story = 'CRM-P2.2' WHERE fn = 'intake_accepts_files';

INSERT INTO fn_class (fn, class, why)
SELECT unnest(ARRAY[
  'ai_event_names_ok', 'ai_event_retention', 'chamber_data_census_row_error', 'chamber_data_error', 'chamber_data_field_kind',
  'chamber_data_is_text', 'chamber_data_is_whole_number', 'chamber_data_person_error', 'chamber_data_row_field_kind',
  'chamber_data_row_list_max', 'chamber_data_scalar_reason', 'chamber_transcript_error', 'closed_draft_retention', 'default_firm_id',
  'email_event_retention', 'extra_answer_value_is_valid', 'extra_answers_error', 'intake_answers_present', 'intake_conflicting_required',
  'intake_consent_version', 'intake_deletion_max_attempts', 'intake_draft_retention', 'intake_missing_required', 'intake_required_items',
  'is_prospect_visible_status', 'is_reviewable_field', 'is_source_code', 'is_us_state_code', 'is_valid_phone', 'membership_is_current',
  'ops_alert_rules', 'ops_clean_code', 'ops_event_retention', 'ops_redact', 'provenance_entry_status', 'provenance_source_is_valid',
  'second_factor_rule_met', 'submitted_record_retention'
]), 'public', 'a constant or a pure check of what it is given; reads no one''s data';

INSERT INTO fn_class (fn, class, why)
SELECT unnest(ARRAY[
  'claim_document_scans', 'claim_intake_deletions', 'claim_ops_alerts', 'claim_outbox_events', 'complete_intake_deletion',
  'complete_outbox_event', 'consume_global_ai_budget', 'consume_ip_quota', 'document_scan_orphans', 'enqueue_certification_notifications',
  'expire_idle_intakes', 'fail_document_scan', 'fail_intake_deletion', 'fail_outbox_event', 'finish_inbound_attachment',
  'freeze_outbox_message', 'intake_deletion_files', 'intake_owner_verified', 'intake_stored_files', 'issue_quote_request_address',
  'next_submission_reference', 'note_intake_milestone', 'note_outbox_config_problem', 'ops_alert_events', 'prune_ai_extraction_events',
  'queue_draft_expiry_reminders', 'queue_retention_deletions', 'reap_outbox_events', 'reconcile_outbox_events', 'record_census_template_scan',
  'record_document_scan', 'record_document_uploaded', 'record_email_delivery_event', 'record_inbound_attachment', 'record_inbound_mail',
  'record_ops_event', 'requeue_document_scan', 'requeue_outbox_event', 'run_retention'
]), 'service_only', 'not executable through the API: the service role''s work (the scheduled jobs and edge functions), or a helper the firm-scoped functions call after their own check';

INSERT INTO fn_class (fn, class, why)
SELECT unnest(ARRAY[
  'certify_extra_answers', 'documents_limit_unstored', 'documents_refuse_deleting_intake', 'drop_mailbox_without_role',
  'enqueue_submission_notifications', 'handle_new_user', 'keep_deletion_firm', 'keep_firm_owner', 'log_quote_request_change',
  'log_quote_request_note_change', 'note_held_mail', 'peo_profile_template_check', 'queue_peo_mail_alert', 'record_certification',
  'record_certified_extra_answers', 'record_document_event', 'refuse_peo_firm_address', 'reset_reviews_on_answer_change',
  'snapshot_certified_evidence', 'sync_submission_workflow', 'track_certification_milestone', 'track_email_verified',
  'track_intake_milestones', 'validate_certification'
]), 'trigger', 'a trigger function: not executable through the API';

-- Everything wrong between the registry and the catalogue, one per line, or NULL. It reads which functions exist and who may
-- execute them, never what a function says.
CREATE FUNCTION pg_temp.function_gate_problems() RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  found text;
  out text[] := '{}';
BEGIN
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO found
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace
    AND (p.prosecdef OR has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
    AND NOT EXISTS (SELECT 1 FROM fn_class c WHERE c.fn = p.proname);
  IF found IS NOT NULL THEN out := out || ('privileged functions not in the registry: ' || found); END IF;

  SELECT string_agg(c.fn, ', ' ORDER BY c.fn) INTO found
  FROM fn_class c
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.proname = c.fn
      AND (p.prosecdef OR has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
  );
  IF found IS NOT NULL THEN out := out || ('registered functions that are gone or no longer privileged: ' || found); END IF;

  SELECT string_agg(DISTINCT p.proname, ', ' ORDER BY p.proname) INTO found
  FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
    AND p.proname IN (SELECT fn FROM fn_class) AND (SELECT count(*) FROM pg_proc q WHERE q.pronamespace = 'public'::regnamespace AND q.proname = p.proname) > 1;
  IF found IS NOT NULL THEN out := out || ('registered names that are overloaded: ' || found); END IF;

  SELECT string_agg(c.fn, ', ' ORDER BY c.fn) INTO found
  FROM fn_class c JOIN pg_proc p ON p.pronamespace = 'public'::regnamespace AND p.proname = c.fn
  WHERE c.class IN ('service_only', 'trigger')
    AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  IF found IS NOT NULL THEN out := out || ('registered as not callable through the API but executable by anon or authenticated: ' || found); END IF;

  SELECT string_agg(c.fn, ', ' ORDER BY c.fn) INTO found
  FROM fn_class c JOIN pg_proc p ON p.pronamespace = 'public'::regnamespace AND p.proname = c.fn
  WHERE c.class = 'trigger' AND p.prorettype <> 'trigger'::regtype;
  IF found IS NOT NULL THEN out := out || ('registered as triggers but not trigger functions: ' || found); END IF;

  SELECT string_agg(c.fn, ', ' ORDER BY c.fn) INTO found
  FROM fn_class c WHERE c.class = 'firm_scoped' AND NOT EXISTS (SELECT 1 FROM fprobe f WHERE f.fn = c.fn);
  IF found IS NOT NULL THEN out := out || ('firm-scoped functions with no two-firm probe: ' || found); END IF;

  SELECT string_agg(f.fn, ', ' ORDER BY f.fn) INTO found
  FROM fprobe f WHERE NOT EXISTS (SELECT 1 FROM fn_class c WHERE c.fn = f.fn AND c.class = 'firm_scoped');
  IF found IS NOT NULL THEN out := out || ('probed functions not registered as firm-scoped: ' || found); END IF;

  SELECT string_agg(c.fn, ', ' ORDER BY c.fn) INTO found
  FROM fn_class c WHERE c.class = 'deferred' AND c.story IS NULL;
  IF found IS NOT NULL THEN out := out || ('deferred functions that name no story: ' || found); END IF;

  -- A function the API lists for advisors or admins only can't be registered as a person's own, a constant or the service's.
  SELECT string_agg(c.fn, ', ' ORDER BY c.fn) INTO found
  FROM fn_class c JOIN callable k ON k.fn LIKE c.fn || '(%' WHERE k.audience IN ('advisor', 'admin') AND c.class NOT IN ('firm_scoped', 'platform_wide', 'deferred');
  IF found IS NOT NULL THEN out := out || ('advisor or admin functions registered as neither firm-scoped, platform-wide nor deferred: ' || found); END IF;

  RETURN array_to_string(out, E'\n');
END $$;

DO $$
DECLARE problems text := pg_temp.function_gate_problems();
BEGIN
  IF problems <> '' THEN RAISE EXCEPTION E'FAIL: privileged functions and the registry disagree:\n%', problems; END IF;
  RAISE NOTICE 'data_isolation: % privileged functions registered (% firm-scoped, each probed with two firms)',
    (SELECT count(*) FROM fn_class), (SELECT count(*) FROM fn_class WHERE class = 'firm_scoped');
END $$;

-- The gate can fail: each of these is a function it must refuse, put in and taken out again.
DO $$
DECLARE
  problems text;
  case_name text;
  stmt text;
  wanted text;
BEGIN
  FOR case_name, stmt, wanted IN VALUES
    ('a new SECURITY DEFINER function nobody registered',
     'CREATE FUNCTION public.zz_unregistered() RETURNS int LANGUAGE sql SECURITY DEFINER SET search_path = public AS $f$ SELECT 1 $f$',
     'not in the registry: zz_unregistered'),
    ('a new function the API roles can execute, nobody registered',
     'CREATE FUNCTION public.zz_callable() RETURNS int LANGUAGE sql SET search_path = public AS $f$ SELECT 1 $f$; GRANT EXECUTE ON FUNCTION public.zz_callable() TO authenticated',
     'not in the registry: zz_callable'),
    ('a registered function that is gone',
     'INSERT INTO fn_class VALUES (''zz_gone'', ''public'', NULL, ''x'')',
     'gone or no longer privileged: zz_gone'),
    ('a service-only function the API roles can execute',
     'UPDATE fn_class SET class = ''service_only'' WHERE fn = ''has_role''',
     'not callable through the API but executable by anon or authenticated: has_role'),
    ('a firm-scoped function with no two-firm probe',
     'DELETE FROM fprobe WHERE fn = ''set_submission_status''',
     'with no two-firm probe: set_submission_status'),
    ('a probe of a function registered as something else',
     'UPDATE fn_class SET class = ''platform_wide'' WHERE fn = ''set_submission_status''',
     'probed functions not registered as firm-scoped: set_submission_status'),
    ('an advisor-only function registered as a person''s own',
     'UPDATE fn_class SET class = ''own'' WHERE fn = ''advisor_list_submissions''',
     'registered as neither firm-scoped, platform-wide nor deferred: advisor_list_submissions'),
    ('a deferred function naming no story',
     'UPDATE fn_class SET story = NULL WHERE fn = ''mailbox_store''',
     'name no story: mailbox_store'),
    ('an overloaded name',
     'CREATE FUNCTION public.has_role(x int) RETURNS int LANGUAGE sql AS $f$ SELECT 1 $f$',
     'overloaded: has_role')
  LOOP
    BEGIN
      EXECUTE stmt;
      problems := pg_temp.function_gate_problems();
      IF problems NOT LIKE '%' || wanted || '%' THEN
        RAISE EXCEPTION 'FAIL: the function gate accepted %: %', case_name, COALESCE(NULLIF(problems, ''), 'no problem at all');
      END IF;
      RAISE EXCEPTION USING ERRCODE = 'ZZ999', MESSAGE = 'rolled back';
    EXCEPTION WHEN OTHERS THEN
      IF SQLSTATE <> 'ZZ999' THEN RAISE; END IF;
    END;
  END LOOP;
  RAISE NOTICE 'data_isolation: the function gate fails on the unregistered, unprobed and misregistered functions it should';
END $$;

-- ---------- 5. catalogue checks ----------
DO $$
DECLARE
  missing text;
  extra text;
  r record;
  n integer;
BEGIN
  -- (a) Every public table has row security on and a row in the matrix.
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO missing
  FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity;
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'FAIL: public tables without row security: %', missing; END IF;

  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO missing
  FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p')
    AND NOT EXISTS (SELECT 1 FROM matrix m WHERE m.src = 'public.' || c.relname);
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'FAIL: public tables missing from the data_isolation matrix: %', missing; END IF;

  -- (b) Every function the API roles can execute is in the allowlist, for the audience it says, and the
  --     allowlist names nothing that is gone.
  SELECT string_agg(f.sig, E'\n  ' ORDER BY f.sig) INTO missing
  FROM (
    SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS sig, p.oid, p.prosecdef
    FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
  ) f
  WHERE (has_function_privilege('anon', f.oid, 'EXECUTE') OR has_function_privilege('authenticated', f.oid, 'EXECUTE'))
    AND NOT EXISTS (SELECT 1 FROM callable c WHERE c.fn = f.sig);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION E'FAIL: functions the API roles can execute that the data_isolation allowlist doesn''t cover (revoke them, or list them with a reason):\n  %', missing;
  END IF;

  SELECT string_agg(c.fn, ', ') INTO extra
  FROM callable c
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' = c.fn
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  );
  IF extra IS NOT NULL THEN RAISE EXCEPTION 'FAIL: the allowlist names functions signed-in callers can''t execute (or that are gone): %', extra; END IF;

  -- Signed-out callers reach exactly the 'anyone' functions; that includes every SECURITY DEFINER one they reach.
  FOR r IN
    SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS sig, p.prosecdef,
           has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can, c.audience
    FROM pg_proc p JOIN callable c ON c.fn = p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
    WHERE p.pronamespace = 'public'::regnamespace
  LOOP
    IF r.anon_can <> (r.audience = 'anyone') THEN
      RAISE EXCEPTION 'FAIL: % is % to signed-out callers but listed for %', r.sig, CASE WHEN r.anon_can THEN 'executable' ELSE 'not executable' END, r.audience;
    END IF;
  END LOOP;
  SELECT string_agg(c.fn, ', ' ORDER BY c.fn) INTO missing
  FROM callable c JOIN pg_proc p ON p.pronamespace = 'public'::regnamespace AND p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' = c.fn
  -- firm_public_name is on the list on purpose (CRM-P1.3a): it is the one thing a firm address shows before sign-in: a firm's name, and nothing else (D-27).
  WHERE p.prosecdef AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF missing IS DISTINCT FROM 'firm_public_name(p_address text), has_role(_role app_role), is_advisor(), report_client_event(p_kind text, p_code text, p_detail text, p_route text, p_session_id uuid)' THEN
    RAISE EXCEPTION 'FAIL: SECURITY DEFINER functions signed-out callers can run changed: %', missing;
  END IF;

  -- No trigger function is callable through the API (SR-1).
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO missing
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.prorettype = 'trigger'::regtype
    AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'FAIL: trigger functions the API roles can execute: %', missing; END IF;

  -- (c) Every bucket is private.
  SELECT string_agg(id, ', ') INTO missing FROM storage.buckets WHERE public IS DISTINCT FROM false;
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'FAIL: public storage buckets: %', missing; END IF;
  IF (SELECT array_agg(id ORDER BY id) FROM storage.buckets) IS DISTINCT FROM ARRAY['documents', 'manuscripts', 'peo-mail', 'peo-templates', 'quarantine'] THEN
    RAISE EXCEPTION 'FAIL: expected exactly the documents, manuscripts, peo-mail, peo-templates and quarantine buckets';
  END IF;

  -- (d) The API roles hold no TRUNCATE (it ignores row security), REFERENCES or TRIGGER on any public table
  --     (SR-3), and nothing at all on the AI rate-limit tables (SR-4).
  SELECT string_agg(format('%s:%s:%s', c.relname, api.rolname, pr.priv), ', ' ORDER BY c.relname, api.rolname, pr.priv) INTO missing
  FROM pg_class c
  CROSS JOIN (VALUES ('anon'), ('authenticated')) api(rolname)
  CROSS JOIN (VALUES ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) pr(priv)
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p') AND has_table_privilege(api.rolname, c.oid, pr.priv);
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'FAIL: API roles hold table privileges they never need: %', missing; END IF;

  SELECT string_agg(format('%s:%s', c.relname, api.rolname), ', ') INTO missing
  FROM pg_class c CROSS JOIN (VALUES ('anon'), ('authenticated')) api(rolname)
  WHERE c.relnamespace = 'public'::regnamespace AND c.relname IN ('ai_request_log', 'ai_ip_log', 'ai_global_usage')
    AND (has_table_privilege(api.rolname, c.oid, 'SELECT') OR has_table_privilege(api.rolname, c.oid, 'INSERT')
         OR has_table_privilege(api.rolname, c.oid, 'UPDATE') OR has_table_privilege(api.rolname, c.oid, 'DELETE'));
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'FAIL: API roles can still reach the AI rate-limit tables: %', missing; END IF;

  -- A table created after the fix doesn't hand TRUNCATE back to the API roles.
  CREATE TABLE public.isolation_probe (id int);
  IF has_table_privilege('authenticated', 'public.isolation_probe', 'TRUNCATE') OR has_table_privilege('anon', 'public.isolation_probe', 'TRUNCATE') THEN
    RAISE EXCEPTION 'FAIL: a new table hands TRUNCATE to the API roles';
  END IF;
  DROP TABLE public.isolation_probe;

  -- (e) Every SECURITY DEFINER function pins its search_path, so a caller's schema can't redirect it.
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO missing
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
    AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, '{}')) cfg WHERE cfg LIKE 'search_path=%');
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'FAIL: SECURITY DEFINER functions without a fixed search_path: %', missing; END IF;

  -- Revoking EXECUTE on trigger functions left the triggers working: a new account still gets its profile
  -- when the auth server (supabase_auth_admin) creates it, and prospects' writes in parts 1 to 3 fired the rest.
  SET LOCAL ROLE supabase_auth_admin;
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-00000000beef', 'authenticated', 'authenticated', 'new@example.test', false, now(), now());
  RESET ROLE;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = '00000000-0000-0000-0000-00000000beef') THEN
    RAISE EXCEPTION 'FAIL: handle_new_user no longer gives a new account its profile';
  END IF;

  SELECT count(*) INTO n FROM callable;
  RAISE NOTICE 'data_isolation: catalogue cases passed (% tables and buckets in the matrix, % callable functions allowlisted)', (SELECT count(*) FROM matrix), n;
END $$;

\echo 'data_isolation: all cases passed'
