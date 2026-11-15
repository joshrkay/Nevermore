-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh create_account
-- Creating an account, the database side (story CRM-A1.2; docs/BROKER_CRM_BUILD.md D-29, D-193, D-209, D-211, D-214, D-222; 20261119150000_create_account.sql).
-- Who may make one and for whom (the level rule), the owner is its maker, the source the product's, every field rule in the database (the phone, the state, the
-- name), the history of its making, and the refusals (not a member, another firm, Nevermore support). Two firms: Acme sees by level, Zenith shows everyone
-- everything. Every migration is loaded, in filename order (D-105), this story's last.
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
\i supabase/migrations/20261116160001_firm_activity.sql
\i supabase/migrations/20261116170000_firm_signup.sql
\i supabase/migrations/20261116170001_firm_events_recorded.sql
\i supabase/migrations/20261116180000_function_firm_scope.sql
\i supabase/migrations/20261116190000_firm_invitations.sql
\i supabase/migrations/20261116190500_invitation_fixes.sql
\i supabase/migrations/20261116200000_firm_scope_unsubmitted_data.sql
\i supabase/migrations/20261116200500_firm_scope_fixes.sql
\i supabase/migrations/20261116210000_console_per_firm.sql
\i supabase/migrations/20261116210500_console_per_firm_fixes.sql
\i supabase/migrations/20261116210600_mailbox_kept_for_members.sql
\i supabase/migrations/20261116220000_remove_or_suspend_a_member.sql
\i supabase/migrations/20261116220500_remove_or_suspend_fixes.sql
\i supabase/migrations/20261116230000_firm_suspension.sql
\i supabase/migrations/20261116240000_held_mail_to_the_right_firm.sql
\i supabase/migrations/20261117090000_one_firm_at_a_time.sql
\i supabase/migrations/20261117090500_one_firm_at_a_time_fixes.sql
\i supabase/migrations/20261117100000_queue_query.sql
\i supabase/migrations/20261117100500_queue_query_fast_path.sql
\i supabase/migrations/20261117120000_table_settings.sql
\i supabase/migrations/20261117120500_table_settings_fixes.sql
\i supabase/migrations/20261117160000_epics_reconciled.sql
\i supabase/migrations/20261118090000_leave_a_firm.sql
\i supabase/migrations/20261118090500_leave_a_firm_fixes.sql
\i supabase/migrations/20261118100000_join_by_organisation.sql
\i supabase/migrations/20261118100500_join_by_organisation_fixes.sql
\i supabase/migrations/20261118110000_close_a_firm.sql
\i supabase/migrations/20261118110500_close_a_firm_fixes.sql
\i supabase/migrations/20261118111000_close_a_firm_races.sql
\i supabase/migrations/20261118120000_help_from_nevermore.sql
\i supabase/migrations/20261118120500_help_from_nevermore_fixes.sql
\i supabase/migrations/20261118130000_record_history.sql
\i supabase/migrations/20261118130500_record_history_fixes.sql
\i supabase/migrations/20261118140000_menu_counts.sql
\i supabase/migrations/20261118140500_menu_counts_fixes.sql
\i supabase/migrations/20261118150000_queue_sort_collation.sql
\i supabase/migrations/20261118160000_record_version.sql
\i supabase/migrations/20261118160500_record_version_fixes.sql
\i supabase/migrations/20261118170000_export.sql
\i supabase/migrations/20261118170500_export_fixes.sql
\i supabase/migrations/20261118171000_export_fixes_again.sql
\i supabase/migrations/20261118180000_epic3_export_supersedes.sql
\i supabase/migrations/20261118180500_epic3_export_pause.sql
\i supabase/migrations/20261119090000_export.sql
\i supabase/migrations/20261119090500_epic3_export_carried.sql
\i supabase/migrations/20261119090600_epic3_export_pause_end.sql
\i supabase/migrations/20261119100000_crm_records.sql
\i supabase/migrations/20261119110000_chain_at_certification.sql
\i supabase/migrations/20261119120000_bring_submissions_in.sql
\i supabase/migrations/20261119130000_accounts_table_query.sql
\i supabase/migrations/20261119140000_account_page.sql
\i supabase/migrations/20261119145000_account_tab.sql
\i supabase/migrations/20261119150000_create_account.sql
SET client_min_messages = notice;

CREATE TEMP TABLE fx (name text PRIMARY KEY, id uuid NOT NULL);
GRANT SELECT ON fx TO anon, authenticated, service_role;
CREATE FUNCTION pg_temp.id(n text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM fx WHERE name = n $$;

CREATE FUNCTION pg_temp.new_user(n text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', n || '@example.test', now(), false, now(), now());
  INSERT INTO fx VALUES (n, uid);
  RETURN uid;
END $$;

-- Signs in as a person, at a firm's address when one is named (D-40).
CREATE FUNCTION pg_temp.as_user(n text, addr text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', false, 'email', n || '@example.test')::text, false);
  PERFORM set_config('request.headers', CASE WHEN addr IS NULL THEN '' ELSE jsonb_build_object('x-firm-address', addr)::text END, false);
  SET LOCAL ROLE authenticated;
END $$;

-- The same person's claims with the superuser's rights: what a trigger sees when a function writes on their behalf.
CREATE FUNCTION pg_temp.claims_of(n text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', false, 'email', n || '@example.test')::text, false);
  PERFORM set_config('request.headers', '', false);
END $$;

CREATE FUNCTION pg_temp.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', false);
  PERFORM set_config('request.headers', '', false);
  SET LOCAL ROLE service_role;
END $$;

CREATE FUNCTION pg_temp.as_anon() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', false);
  PERFORM set_config('request.headers', '', false);
  SET LOCAL ROLE anon;
END $$;

CREATE FUNCTION pg_temp.as_owner() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', false);
  PERFORM set_config('request.headers', '', false);
END $$;

CREATE FUNCTION pg_temp.is(got anyelement, want anyelement, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION 'FAIL: % gave %, expected %', label, got, want; END IF;
END $$;

-- Runs stmt and always rolls it back: 'rows:<n>' for the rows it touched, or the SQLSTATE it raised.
CREATE FUNCTION pg_temp.attempt(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint; s text; m text;
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

-- The SQLSTATE and message a statement raised, or 'ok' when it did not. Nothing is rolled back.
CREATE FUNCTION pg_temp.refusal(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE s text; m text;
BEGIN
  BEGIN
    EXECUTE stmt;
    RETURN 'ok';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT;
    RETURN s || ': ' || m;
  END;
END $$;

-- Which of the test's named records the current caller reads from a table (row security applies), by name; 'denied' for a table it may not read.
CREATE FUNCTION pg_temp.seen(tbl text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  EXECUTE format('SELECT COALESCE(string_agg(f.name, '','' ORDER BY f.name), '''') FROM %s t JOIN fx f ON f.id = t.id', tbl) INTO r;
  RETURN r;
EXCEPTION WHEN insufficient_privilege THEN RETURN 'denied';
END $$;

-- An intake of a firm, started by its own prospect, placed by the superuser.
CREATE FUNCTION pg_temp.intake(n text, firm text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := pg_temp.new_user('p_' || n); sid uuid;
BEGIN
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, jsonb_build_object('company_name', n)) RETURNING id INTO sid;
  UPDATE public.chamber_sessions SET firm_id = pg_temp.id(firm) WHERE id = sid;
  INSERT INTO fx VALUES (n, sid);
  RETURN sid;
END $$;

-- Records, made as the superuser (no API role can write them). Each is named in fx.
CREATE FUNCTION pg_temp.account(n text, firm text, p_owner text, nm text DEFAULT NULL, site text DEFAULT NULL, src text DEFAULT 'added_by_hand') RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r uuid;
BEGIN
  INSERT INTO public.accounts (source, firm_id, owner_id, name, website) VALUES (src, pg_temp.id(firm), pg_temp.id(p_owner), COALESCE(nm, n), site) RETURNING id INTO r;
  INSERT INTO fx VALUES (n, r);
  RETURN r;
END $$;

CREATE FUNCTION pg_temp.contact(n text, p_account text, p_owner text, p_email text DEFAULT NULL, p_phone text DEFAULT NULL, p_main boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r uuid;
BEGIN
  INSERT INTO public.contacts (firm_id, account_id, owner_id, first_name, last_name, email, phone, is_main)
  SELECT a.firm_id, a.id, pg_temp.id(p_owner), 'First ' || n, 'Last ' || n, p_email, p_phone, p_main FROM public.accounts a WHERE a.id = pg_temp.id(p_account) RETURNING id INTO r;
  INSERT INTO fx VALUES (n, r);
  RETURN r;
END $$;

CREATE FUNCTION pg_temp.opportunity(n text, p_account text, p_owner text, p_intake text DEFAULT NULL, p_main_contact text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r uuid;
BEGIN
  INSERT INTO public.opportunities (firm_id, account_id, owner_id, name, intake_id, main_contact_id)
  SELECT a.firm_id, a.id, pg_temp.id(p_owner), 'PEO search ' || n, pg_temp.id(p_intake), pg_temp.id(p_main_contact) FROM public.accounts a WHERE a.id = pg_temp.id(p_account) RETURNING id INTO r;
  INSERT INTO fx VALUES (n, r);
  RETURN r;
END $$;


-- ---------- set up: two firms; Acme sees by level, Zenith shows everyone everything; people at each level ----------
-- Acme: an owner; a lead of Sales with an agent in it and a team under it (Sales West, with an agent); a second lead with no team; two agents with no team; and
-- a person whose membership ended. Zenith: an owner and an agent.
DO $$
DECLARE acme uuid; zenith uuid; sales uuid; west uuid; zsales uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Acme Brokers', 'acme-brokers', now()) RETURNING id INTO acme;
  INSERT INTO public.firms (name, address, approved_at, visibility) VALUES ('Zenith Benefits', 'zenith-benefits', now(), 'everyone') RETURNING id INTO zenith;
  INSERT INTO fx VALUES ('acme', acme), ('zenith', zenith);
  PERFORM pg_temp.new_user('acme_owner'); PERFORM pg_temp.new_user('acme_lead'); PERFORM pg_temp.new_user('acme_lead2'); PERFORM pg_temp.new_user('acme_agent1');
  PERFORM pg_temp.new_user('acme_agent2'); PERFORM pg_temp.new_user('acme_agent3'); PERFORM pg_temp.new_user('acme_west'); PERFORM pg_temp.new_user('acme_removed');
  PERFORM pg_temp.new_user('zenith_owner'); PERFORM pg_temp.new_user('zenith_lead'); PERFORM pg_temp.new_user('zenith_agent'); PERFORM pg_temp.new_user('zenith_agent2');
  PERFORM pg_temp.new_user('acme_gone'); PERFORM pg_temp.new_user('zenith_gone');
  PERFORM pg_temp.new_user('platform_admin'); PERFORM pg_temp.new_user('nobody');
  INSERT INTO public.firm_teams (firm_id, name) VALUES (acme, 'Sales') RETURNING id INTO sales;
  INSERT INTO public.firm_teams (firm_id, name, parent_team_id) VALUES (acme, 'Sales West', sales) RETURNING id INTO west;
  INSERT INTO public.firm_teams (firm_id, name) VALUES (zenith, 'Zenith Sales') RETURNING id INTO zsales;
  INSERT INTO public.firm_memberships (firm_id, user_id, role, team_id) VALUES
    (acme, pg_temp.id('acme_owner'), 'owner', NULL), (acme, pg_temp.id('acme_lead'), 'lead', sales), (acme, pg_temp.id('acme_lead2'), 'lead', NULL),
    (acme, pg_temp.id('acme_agent1'), 'agent', NULL), (acme, pg_temp.id('acme_agent2'), 'agent', sales), (acme, pg_temp.id('acme_agent3'), 'agent', NULL),
    (acme, pg_temp.id('acme_west'), 'agent', west),
    (zenith, pg_temp.id('zenith_owner'), 'owner', NULL), (zenith, pg_temp.id('zenith_lead'), 'lead', zsales), (zenith, pg_temp.id('zenith_agent'), 'agent', NULL),
    (zenith, pg_temp.id('zenith_agent2'), 'agent', NULL);
  -- People whose membership ended: one with no team, and one in each lead's own team (a departed teammate is no one's to change but an owner's).
  INSERT INTO public.firm_memberships (firm_id, user_id, role, team_id, valid_from, valid_until) VALUES
    (acme, pg_temp.id('acme_removed'), 'agent', NULL, now() - interval '3 days', now() - interval '1 day'),
    (acme, pg_temp.id('acme_gone'), 'agent', sales, now() - interval '3 days', now() - interval '1 day'),
    (zenith, pg_temp.id('zenith_gone'), 'agent', zsales, now() - interval '3 days', now() - interval '1 day');
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('platform_admin'), 'admin');
END $$;

-- ---------- making an account ----------
-- Makes an account as a person: the fields overlay `patch` (named as the columns; states is a JSON list); `owner_name` is the person chosen as its owner, if
-- any. Answers the function's jsonb, or raises what it raises.
CREATE FUNCTION pg_temp.make(who text, patch jsonb DEFAULT '{}', owner_name text DEFAULT NULL, firm text DEFAULT 'acme', addr text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  IF who = 'anon' THEN PERFORM pg_temp.as_anon(); ELSE PERFORM pg_temp.as_user(who, addr); END IF;
  r := public.create_account(
    CASE WHEN patch ? 'name' THEN patch ->> 'name' ELSE 'Harborview Dental East' END, patch ->> 'trade_name', patch ->> 'website', patch ->> 'phone',
    patch ->> 'street', patch ->> 'city', patch ->> 'state', patch ->> 'postal_code', patch ->> 'industry', (patch ->> 'employees')::int,
    CASE WHEN patch ? 'states' THEN ARRAY(SELECT jsonb_array_elements_text(patch -> 'states')) ELSE '{}'::text[] END, patch ->> 'provider',
    CASE WHEN owner_name IS NULL THEN NULL ELSE pg_temp.id(owner_name) END,
    CASE WHEN firm IS NULL THEN NULL ELSE pg_temp.id(firm) END);
  RESET ROLE;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RAISE;
END $$;

CREATE FUNCTION pg_temp.make_refusal(who text, patch jsonb DEFAULT '{}', owner_name text DEFAULT NULL, firm text DEFAULT 'acme', addr text DEFAULT NULL) RETURNS text LANGUAGE plpgsql AS $$
DECLARE s text; m text;
BEGIN
  PERFORM pg_temp.make(who, patch, owner_name, firm, addr);
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT;
  RESET ROLE;
  RETURN s || ': ' || m;
END $$;

CREATE FUNCTION pg_temp.accounts_in(firm text) RETURNS bigint LANGUAGE sql AS $$ SELECT count(*) FROM public.accounts WHERE firm_id = pg_temp.id(firm) $$;

-- ---------- what it makes ----------
-- Break caught: the account is not made in the firm the person acts for, its owner is not its maker (D-214), its source is anything but Added by hand (D-211),
-- a field is not kept as typed (trimmed; a blank is nothing; the state and each state of operation in capitals, each once), the answer is not the made
-- record with its id and first version, the making is not in the history under the maker's name, or the maker is not then allowed to see and change it.
DO $$
DECLARE r jsonb; a public.accounts; n bigint := pg_temp.accounts_in('acme');
BEGIN
  r := pg_temp.make('acme_agent1', jsonb_build_object('name', '  Harborview Dental East ', 'trade_name', '', 'website', ' harborviewdental.example ', 'phone', '(503) 555-0142 x12',
    'street', '12 Main St', 'city', 'Gresham', 'state', 'or', 'postal_code', '97030', 'industry', 'Dental practice', 'employees', 12, 'states', '["or", " WA", "OR"]'::jsonb,
    'provider', 'Paychex'));
  PERFORM pg_temp.is(r ->> 'conflict', NULL::text, 'the answer is the record, not a save answer');
  PERFORM pg_temp.is((r ->> 'version')::int, 1, 'at its first version');
  SELECT * INTO a FROM public.accounts WHERE id = (r ->> 'id')::uuid;
  PERFORM pg_temp.is(a.firm_id, pg_temp.id('acme'), 'in the firm the person acts for');
  PERFORM pg_temp.is(a.owner_id, pg_temp.id('acme_agent1'), 'owned by its maker');
  PERFORM pg_temp.is(a.source, 'added_by_hand', 'Added by hand');
  PERFORM pg_temp.is(a.name, 'Harborview Dental East', 'the name is trimmed');
  PERFORM pg_temp.is(a.trade_name, NULL::text, 'a blank is nothing');
  PERFORM pg_temp.is(a.website, 'harborviewdental.example', 'the website is trimmed');
  PERFORM pg_temp.is(a.web_domain, 'harborviewdental.example', 'and its domain worked out');
  PERFORM pg_temp.is(a.phone, '(503) 555-0142 x12', 'the phone is kept as typed');
  PERFORM pg_temp.is(a.state, 'OR', 'the state is in capitals');
  PERFORM pg_temp.is(a.states_of_operation, ARRAY['OR', 'WA'], 'the states of operation are in capitals, each once');
  PERFORM pg_temp.is(a.employees, 12, 'employees');
  PERFORM pg_temp.is(a.current_provider, 'Paychex', 'the provider');
  PERFORM pg_temp.is(a.archived_at, NULL::timestamptz, 'not archived');
  PERFORM pg_temp.is(pg_temp.accounts_in('acme'), n + 1, 'one account was made');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history h WHERE h.table_name = 'accounts' AND h.record_key = a.id::text AND h.kind = 'created'), 1::bigint, 'its making is in the history');
  PERFORM pg_temp.is((SELECT h.actor_id FROM public.record_history h WHERE h.table_name = 'accounts' AND h.record_key = a.id::text AND h.kind = 'created'), pg_temp.id('acme_agent1'), 'under the maker');
  PERFORM pg_temp.as_user('acme_agent1');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE id = a.id), 1::bigint, 'the maker sees it');
  PERFORM pg_temp.is((public.account_page(pg_temp.id('acme'), a.id) ->> 'can_change')::boolean, true, 'and may change it');
  PERFORM pg_temp.as_user('acme_agent2');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE id = a.id), 0::bigint, 'a colleague at agent level does not see it (the firm sees by level)');
  RESET ROLE;
  -- A name alone is enough, and the same name twice makes two accounts: a likeness is a warning (D-193), never a refusal.
  r := pg_temp.make('acme_agent1', '{"name": "Name only"}');
  PERFORM pg_temp.is(r ->> 'name', 'Name only', 'a name alone is enough');
  PERFORM pg_temp.is(pg_temp.make_refusal('acme_agent1', '{"name": "Name only"}'), 'ok', 'a second with the same name is not refused');
  -- Whoever acts with one firm and names none acts for it
  PERFORM pg_temp.is(pg_temp.make_refusal('acme_agent1', '{"name": "No firm named"}', NULL, NULL), 'ok', 'with no firm named, the person''s only firm');
  RAISE NOTICE 'create_account: what it makes passed';
END $$;

-- ---------- whose it is ----------
-- Break caught: any member may give an account to anyone (an agent makes one a colleague cannot reach, a lead one outside their team), a person who has left
-- or who is in another firm is made its owner, an owner cannot give it to anyone in the firm, or the owner asked for is ignored (the maker is kept).
DO $$
DECLARE r jsonb;
BEGIN
  r := pg_temp.make('acme_owner', '{"name": "Given by an owner"}', 'acme_agent1');
  PERFORM pg_temp.is((SELECT owner_id FROM public.accounts WHERE id = (r ->> 'id')::uuid), pg_temp.id('acme_agent1'), 'an owner makes one for an agent');
  r := pg_temp.make('acme_owner', '{"name": "Given to a lead"}', 'acme_lead');
  PERFORM pg_temp.is((SELECT owner_id FROM public.accounts WHERE id = (r ->> 'id')::uuid), pg_temp.id('acme_lead'), 'or for a lead');
  r := pg_temp.make('acme_owner', '{"name": "Own"}', 'acme_owner');
  PERFORM pg_temp.is((SELECT owner_id FROM public.accounts WHERE id = (r ->> 'id')::uuid), pg_temp.id('acme_owner'), 'or for themselves, said out');
  r := pg_temp.make('acme_lead', '{"name": "Lead for team"}', 'acme_agent2');
  PERFORM pg_temp.is((SELECT owner_id FROM public.accounts WHERE id = (r ->> 'id')::uuid), pg_temp.id('acme_agent2'), 'a lead makes one for their team''s agent');
  r := pg_temp.make('acme_lead', '{"name": "Lead for team below"}', 'acme_west');
  PERFORM pg_temp.is((SELECT owner_id FROM public.accounts WHERE id = (r ->> 'id')::uuid), pg_temp.id('acme_west'), 'or one in the team under theirs');
  PERFORM pg_temp.is(pg_temp.make_refusal('acme_lead', '{"name": "Outside"}', 'acme_agent1'), '42501: You can make an account only for yourself and, as a lead, for people on your teams.', 'a lead is refused a person outside their teams');
  PERFORM pg_temp.is(pg_temp.make_refusal('acme_lead', '{"name": "Outside"}', 'acme_owner'), '42501: You can make an account only for yourself and, as a lead, for people on your teams.', 'and the firm''s owner');
  PERFORM pg_temp.is(pg_temp.make_refusal('acme_agent1', '{"name": "Other"}', 'acme_agent2'), '42501: You can make an account only for yourself and, as a lead, for people on your teams.', 'an agent is refused anyone else');
  PERFORM pg_temp.is(pg_temp.make_refusal('acme_agent1', '{"name": "Self"}', 'acme_agent1'), 'ok', 'but not themselves');
  PERFORM pg_temp.is(pg_temp.make_refusal('acme_owner', '{"name": "Gone"}', 'acme_removed'), '22023: Choose one of the firm''s people as the owner.', 'nobody who has left the firm is its owner');
  PERFORM pg_temp.is(pg_temp.make_refusal('acme_owner', '{"name": "Other firm"}', 'zenith_agent'), '22023: Choose one of the firm''s people as the owner.', 'nor a person of another firm');
  PERFORM pg_temp.is(pg_temp.make_refusal('acme_owner', '{"name": "Not a person"}', 'nobody'), '22023: Choose one of the firm''s people as the owner.', 'nor someone with no firm');
  RAISE NOTICE 'create_account: whose it is passed';
END $$;

-- ---------- the fields' rules, in the database ----------
-- Break caught: a name that is blank or too long, a state that is not one, a state of operation that is not one, a phone that is not one (letters, too few or too
-- many digits, a plus in the middle), a negative number of employees, or a field over its length is saved; or a refusal is not in words. Nothing is made by a
-- refused call. The phone rule is also the table's: a row written directly with a bad phone is refused.
DO $$
DECLARE n bigint := pg_temp.accounts_in('acme'); p text;
BEGIN
  PERFORM pg_temp.is(pg_temp.make_refusal('acme_agent1', '{"name": "   "}'), '22023: Give the account a name.', 'a name of spaces');
  PERFORM pg_temp.is(pg_temp.make_refusal('acme_agent1', jsonb_build_object('name', repeat('x', 201))), '22023: Keep the account''s name to 200 characters.', 'a name too long');
  PERFORM pg_temp.is(pg_temp.make_refusal('acme_agent1', '{"state": "ZZ"}'), '22023: Choose a state from the list.', 'a state that is not one');
  PERFORM pg_temp.is(pg_temp.make_refusal('acme_agent1', '{"states": ["OR", "XX"]}'), '22023: Choose the states of operation from the list.', 'a state of operation that is not one');
  PERFORM pg_temp.is(pg_temp.make_refusal('acme_agent1', '{"employees": -1}'), '22023: Employees can''t be a negative number.', 'negative employees');
  PERFORM pg_temp.is(pg_temp.make_refusal('acme_agent1', jsonb_build_object('website', repeat('w', 301))), '22023: Keep the website to 300 characters.', 'a website too long');
  FOREACH p IN ARRAY ARRAY['call me', '555-0142', '12345678901234567', '503+555+0142', '(503) 555-0142 ext', '503-555-0142 x1234567', '++15035550142'] LOOP
    PERFORM pg_temp.is(pg_temp.make_refusal('acme_agent1', jsonb_build_object('phone', p)), '22023: Enter a phone number like (503) 555-0142, with its area code. An extension can follow, like x12.', 'phone ' || p);
  END LOOP;
  FOREACH p IN ARRAY ARRAY['(503) 555-0142', '503-555-0142', '503.555.0142', '+1 503 555 0142', '5035550142', '503 555 0142 x12', '503 555 0142 ext. 345', '+44 20 7946 0958'] LOOP
    PERFORM pg_temp.is(pg_temp.make_refusal('acme_agent1', jsonb_build_object('phone', p)), 'ok', 'phone ' || p);
  END LOOP;
  PERFORM pg_temp.is(pg_temp.accounts_in('acme'), n + 8, 'only the eight good phones made accounts');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.attempt($q$INSERT INTO public.accounts (source, firm_id, name, phone) VALUES ('added_by_hand', pg_temp.id('acme'), 'Bad phone', 'call me')$q$), '23514', 'the table refuses a bad phone');
  PERFORM pg_temp.is(pg_temp.attempt($q$INSERT INTO public.accounts (source, firm_id, name, phone) VALUES ('added_by_hand', pg_temp.id('acme'), 'Good phone', '(503) 555-0142')$q$), 'rows:1', 'and takes a good one');
  -- The save of an account's own fields asks the same rule.
  PERFORM pg_temp.account('a1', 'acme', 'acme_owner');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.update_account(%L, 'Renamed', NULL, NULL, 'call me', NULL, NULL, NULL, NULL, NULL, NULL, '{}', NULL, %L, 1)$q$,
    pg_temp.id('a1'), pg_temp.id('acme'))), '22023: Enter a phone number like (503) 555-0142, with its area code. An extension can follow, like x12.', 'saving an account asks the same phone rule');
  RESET ROLE;
  RAISE NOTICE 'create_account: the fields'' rules passed';
END $$;

-- ---------- who may make one ----------
-- Break caught: a person who is no member of the firm (a former member, a platform admin, another firm's owner, someone with no firm), a signed-out caller or
-- Nevermore support (ADR 0024) makes an account; an account is made in a firm the person did not name and is not a member of; or a person of two firms is
-- given one without saying which.
DO $$
DECLARE sess uuid; n bigint := pg_temp.accounts_in('acme'); z bigint := pg_temp.accounts_in('zenith');
BEGIN
  PERFORM pg_temp.is(pg_temp.make_refusal('acme_removed', '{"name": "Former"}'), '42501: Advisor access required', 'a former member (naming the firm)');
  PERFORM pg_temp.is(pg_temp.make_refusal('acme_removed', '{"name": "Former"}', NULL, NULL), '42501: Advisor access required', 'a former member (naming none)');
  PERFORM pg_temp.is(pg_temp.make_refusal('nobody', '{"name": "Nobody"}'), '42501: Advisor access required', 'someone with no firm');
  PERFORM pg_temp.is(pg_temp.make_refusal('zenith_owner', '{"name": "Zenith into Acme"}'), '42501: Not a member of that firm', 'another firm''s owner, naming Acme');
  PERFORM pg_temp.is(left(pg_temp.make_refusal('platform_admin', '{"name": "Admin"}'), 5), '42501', 'a platform admin who is no member');
  PERFORM pg_temp.is(left(pg_temp.make_refusal('anon', '{"name": "Anon"}'), 5), '42501', 'a signed-out caller');
  PERFORM pg_temp.is(pg_temp.accounts_in('acme'), n, 'nothing was made in Acme');
  PERFORM pg_temp.is(pg_temp.accounts_in('zenith'), z, 'or in Zenith');
  -- Nevermore support reads a firm and changes nothing (ADR 0024).
  PERFORM pg_temp.as_user('platform_admin');
  sess := (SELECT t.session_id FROM public.start_support_session(pg_temp.id('acme'), 'Looking at an account the firm asked about') t);
  PERFORM pg_temp.is(pg_temp.make_refusal('platform_admin', '{"name": "By support"}', NULL, 'acme', 'acme-brokers'), 'PT423: Nevermore support can look, not change', 'a support session makes nothing');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.end_support_session(sess);
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.accounts_in('acme'), n, 'and nothing was made by it');
  RAISE NOTICE 'create_account: who may make one passed';
END $$;

-- ---------- the call's own grants ----------
-- Break caught: a signed-out caller or the service role can call it, or the internal pieces (the phone check) are callable through the API.
DO $$
BEGIN
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.create_account('X', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', NULL, NULL, %L)$q$, pg_temp.id('acme'))), '42501', 'a signed-out caller may not call it');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.crm_phone_ok('(503) 555-0142')$q$), '42501', 'the phone check is internal');
  RESET ROLE;
  RAISE NOTICE 'create_account: grants passed';
END $$;

SELECT 'create_account: all passed' AS result;
