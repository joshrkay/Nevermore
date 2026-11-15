-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh add_contact
-- Adding a contact to an account and moving one to another (story CRM-A2.2; docs/BROKER_CRM_BUILD.md D-29, D-209, D-219, D-222, D-233; 20261119170000_add_contact.sql).
-- Who may add one (anyone who may see the account), the account that is not archived, every field rule in the database, the owner by the level rule, one main
-- contact per account held by a constraint and by the new main taking over in one transaction (two sessions), and the move: the level rule on the contact and on both
-- accounts, the contact's calls, notes and tasks going with it, an activity that also names an opportunity left behind, the history, and the refusals (not a
-- member, another firm, a closing firm, Nevermore support). Two firms: Acme sees by level, Zenith shows everyone everything.
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
\i supabase/migrations/20261119160000_account_archive_delete_owner.sql
\i supabase/migrations/20261119170000_add_contact.sql
\i supabase/migrations/20261119180000_calls_notes_tasks.sql
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


-- ---------- helpers ----------
-- Adds a contact as a person: `patch` overlays the fields (named as the columns), `owner_name` is the owner chosen, if any.
CREATE FUNCTION pg_temp.add(who text, acct text, patch jsonb DEFAULT '{}', owner_name text DEFAULT NULL, firm text DEFAULT 'acme', addr text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  IF who = 'anon' THEN PERFORM pg_temp.as_anon(); ELSE PERFORM pg_temp.as_user(who, addr); END IF;
  r := public.add_contact(pg_temp.id(acct),
    CASE WHEN patch ? 'first' THEN patch ->> 'first' ELSE 'Owen' END, CASE WHEN patch ? 'last' THEN patch ->> 'last' ELSE 'Park' END, patch ->> 'title',
    CASE WHEN patch ? 'email' THEN patch ->> 'email' ELSE 'owen@harborview.example' END, patch ->> 'phone', patch ->> 'mobile',
    CASE WHEN owner_name IS NULL THEN NULL ELSE pg_temp.id(owner_name) END, COALESCE((patch ->> 'main')::boolean, false), COALESCE((patch ->> 'dne')::boolean, false),
    CASE WHEN firm IS NULL THEN NULL ELSE pg_temp.id(firm) END);
  RESET ROLE;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RAISE;
END $$;

CREATE FUNCTION pg_temp.add_refusal(who text, acct text, patch jsonb DEFAULT '{}', owner_name text DEFAULT NULL, firm text DEFAULT 'acme', addr text DEFAULT NULL) RETURNS text LANGUAGE plpgsql AS $$
DECLARE s text; m text;
BEGIN
  PERFORM pg_temp.add(who, acct, patch, owner_name, firm, addr);
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT;
  RESET ROLE;
  RETURN s || ': ' || m;
END $$;

-- Moves a contact as a person: the answer, or the SQLSTATE and words it raised.
CREATE FUNCTION pg_temp.move(who text, c text, dest text, confirm boolean DEFAULT false, firm text DEFAULT 'acme') RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user(who);
  r := public.move_contact(pg_temp.id(c), pg_temp.id(dest), confirm, pg_temp.id(firm));
  RESET ROLE;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RAISE;
END $$;

CREATE FUNCTION pg_temp.move_refusal(who text, c text, dest text, confirm boolean DEFAULT false, firm text DEFAULT 'acme') RETURNS text LANGUAGE plpgsql AS $$
DECLARE s text; m text;
BEGIN
  PERFORM pg_temp.move(who, c, dest, confirm, firm);
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT;
  RESET ROLE;
  RETURN s || ': ' || m;
END $$;

CREATE FUNCTION pg_temp.activity(n text, kind text, p_account text, p_contact text, p_opp text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r uuid;
BEGIN
  INSERT INTO public.activities (firm_id, account_id, kind, contact_id, opportunity_id, outcome, body, title, due_on)
  SELECT a.firm_id, a.id, kind, pg_temp.id(p_contact), pg_temp.id(p_opp), CASE kind WHEN 'call' THEN 'spoke' END, CASE kind WHEN 'task' THEN NULL ELSE 'Said ' || n END,
    CASE kind WHEN 'task' THEN 'Do ' || n END, CASE kind WHEN 'task' THEN current_date END
  FROM public.accounts a WHERE a.id = pg_temp.id(p_account) RETURNING id INTO r;
  INSERT INTO fx VALUES (n, r);
  RETURN r;
END $$;

CREATE FUNCTION pg_temp.acct_of(tbl text, n text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r uuid;
BEGIN
  EXECUTE format('SELECT account_id FROM public.%I WHERE id = $1', tbl) INTO r USING pg_temp.id(n);
  RETURN r;
END $$;

DO $$
BEGIN
  RESET ROLE;
  PERFORM pg_temp.account('h1', 'acme', 'acme_agent1', 'Harborview Dental');
  PERFORM pg_temp.account('h2', 'acme', 'acme_agent1', 'Harborview East');
  PERFORM pg_temp.account('hl', 'acme', 'acme_lead', 'Lead''s account');
  PERFORM pg_temp.account('ha2', 'acme', 'acme_agent2', 'Team agent''s account');
  PERFORM pg_temp.account('hl2', 'acme', 'acme_lead2', 'Other lead''s account');
  PERFORM pg_temp.account('hn', 'acme', NULL, 'Nobody''s account');
  PERFORM pg_temp.account('harch', 'acme', 'acme_agent1', 'Archived account');
  UPDATE public.accounts SET archived_at = now() WHERE id = pg_temp.id('harch');
  PERFORM pg_temp.account('z1', 'zenith', 'zenith_agent', 'Zenith one');
  PERFORM pg_temp.account('z2', 'zenith', 'zenith_agent2', 'Zenith two');
  PERFORM pg_temp.account('z3', 'zenith', 'zenith_agent', 'Zenith three');
END $$;

-- ---------- what adding makes ----------
-- Break caught: the contact is not made on the account named, in its firm, owned by its maker; a field is not kept trimmed, a blank is not nothing; the answer is
-- not the made contact (id, first version, owner); its making is not in the history under the maker; or a colleague who may not see the account can add to it.
DO $$
DECLARE r jsonb; c public.contacts;
BEGIN
  r := pg_temp.add('acme_agent1', 'h1', jsonb_build_object('first', ' Owen ', 'last', ' Park ', 'title', ' Owner ', 'email', ' owen@harborview.example ', 'phone', '(503) 555-0140', 'mobile', '', 'dne', true));
  SELECT * INTO c FROM public.contacts WHERE id = (r #>> '{record,id}')::uuid;
  PERFORM pg_temp.is(c.account_id, pg_temp.id('h1'), 'on the account named');
  PERFORM pg_temp.is(c.firm_id, pg_temp.id('acme'), 'in its firm');
  PERFORM pg_temp.is(c.owner_id, pg_temp.id('acme_agent1'), 'owned by its maker');
  PERFORM pg_temp.is(c.first_name, 'Owen', 'first name trimmed');
  PERFORM pg_temp.is(c.last_name, 'Park', 'last name trimmed');
  PERFORM pg_temp.is(c.title, 'Owner', 'title trimmed');
  PERFORM pg_temp.is(c.email, 'owen@harborview.example', 'email trimmed');
  PERFORM pg_temp.is(c.phone, '(503) 555-0140', 'the phone is kept as typed');
  PERFORM pg_temp.is(c.mobile, NULL::text, 'a blank is nothing');
  PERFORM pg_temp.is(c.do_not_email, true, 'Do not email is kept');
  PERFORM pg_temp.is(c.is_main, false, 'not the main contact unless asked');
  PERFORM pg_temp.is((r #>> '{record,version}')::int, 1, 'the answer is at its first version');
  PERFORM pg_temp.is(r -> 'previous_main', 'null'::jsonb, 'no one was displaced');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history h WHERE h.table_name = 'contacts' AND h.record_key = c.id::text AND h.kind = 'created'), 1::bigint, 'its making is in the history');
  PERFORM pg_temp.is((SELECT h.actor_id FROM public.record_history h WHERE h.table_name = 'contacts' AND h.record_key = c.id::text AND h.kind = 'created'), pg_temp.id('acme_agent1'), 'under the maker');
  -- A phone alone, a mobile alone, and an email alone are each enough; no first name is needed.
  PERFORM pg_temp.is(pg_temp.add_refusal('acme_agent1', 'h1', '{"email": null, "phone": "503 555 0141", "first": ""}'), 'ok', 'a phone alone is enough, and no first name');
  PERFORM pg_temp.is(pg_temp.add_refusal('acme_agent1', 'h1', '{"email": null, "mobile": "503 555 0142"}'), 'ok', 'a mobile alone is enough');
  -- The same email twice is a warning later (CRM-S4.2), never a refusal here.
  PERFORM pg_temp.is(pg_temp.add_refusal('acme_agent1', 'h1', '{"email": "owen@harborview.example"}'), 'ok', 'an email already on another contact is not refused');
  -- The lead sees a team agent's account (a lead sees the team's) and may add to it, owning the contact themselves.
  PERFORM pg_temp.is(pg_temp.add_refusal('acme_lead', 'ha2', '{}'), 'ok', 'a lead adds to a team member''s account');
  PERFORM pg_temp.is((SELECT owner_id FROM public.contacts WHERE account_id = pg_temp.id('ha2')), pg_temp.id('acme_lead'), 'owned by the lead');
  -- Adding is open to anyone who may see the account (D-209), so an agent adds to a colleague's account where the firm shows everyone everything.
  PERFORM pg_temp.is(pg_temp.add_refusal('zenith_agent2', 'z1', '{}', NULL, 'zenith'), 'ok', 'anyone who may see the account may add (Zenith shows everyone everything)');
  RAISE NOTICE 'add_contact: what it makes passed';
END $$;

-- ---------- refusals ----------
-- Break caught: an account the caller may not see is answered differently from one that is not there (PT404 for both); an archived account takes a contact; a field
-- rule is not asked, or asked in the wrong order; another firm's account is reachable; a person of no firm is served; the function is callable signed out.
DO $$
DECLARE n bigint;
BEGIN
  PERFORM pg_temp.is(pg_temp.add_refusal('acme_agent1', 'hl2'), 'PT404: That account isn''t available', 'an account the caller may not see reads as not there');
  PERFORM pg_temp.is(pg_temp.add_refusal('acme_agent1', 'z1'), 'PT404: That account isn''t available', 'another firm''s account reads as not there');
  PERFORM pg_temp.is(pg_temp.add_refusal('acme_agent1', 'h1', '{}', NULL, 'zenith'), '42501: Not a member of that firm', 'naming a firm the person is not in is refused');
  PERFORM pg_temp.is(pg_temp.add_refusal('nobody', 'h1'), '42501: Not a member of that firm', 'a person of no firm is refused');
  PERFORM pg_temp.is(pg_temp.add_refusal('anon', 'h1') LIKE '42501: %', true, 'signed out is refused');
  PERFORM pg_temp.is(pg_temp.add_refusal('acme_agent1', 'harch'), '55000: This account is archived. Nothing can be added to it.', 'an archived account takes nothing new (D-222)');
  SELECT count(*) INTO n FROM public.contacts WHERE account_id = pg_temp.id('harch');
  PERFORM pg_temp.is(n, 0::bigint, 'and none was made');
  PERFORM pg_temp.is(pg_temp.add_refusal('acme_agent1', 'h1', '{"last": "  "}'), '22023: Enter the contact''s last name.', 'a last name is required');
  PERFORM pg_temp.is(pg_temp.add_refusal('acme_agent1', 'h1', '{"last": null}'), '22023: Enter the contact''s last name.', 'a missing last name too');
  PERFORM pg_temp.is(pg_temp.add_refusal('acme_agent1', 'h1', '{"email": null}'), '22023: Enter an email or a phone number.', 'an email or a phone is required');
  PERFORM pg_temp.is(pg_temp.add_refusal('acme_agent1', 'h1', '{"email": "  ", "phone": " "}'), '22023: Enter an email or a phone number.', 'blanks are nothing');
  PERFORM pg_temp.is(pg_temp.add_refusal('acme_agent1', 'h1', '{"email": "not an email"}'), '22023: Enter an email address like name@example.com.', 'an email must look like one');
  PERFORM pg_temp.is(pg_temp.add_refusal('acme_agent1', 'h1', '{"email": "a@b"}'), '22023: Enter an email address like name@example.com.', 'with a domain');
  PERFORM pg_temp.is(pg_temp.add_refusal('acme_agent1', 'h1', '{"phone": "12345"}'), '22023: Enter a phone number like (503) 555-0142. An extension can follow, like x12.', 'a phone follows the repository''s rule (6 digits fails)');
  PERFORM pg_temp.is(pg_temp.add_refusal('acme_agent1', 'h1', '{"mobile": "call me"}'), '22023: Enter a mobile number like (503) 555-0142. An extension can follow, like x12.', 'a mobile too, in its own words');
  PERFORM pg_temp.is(pg_temp.add_refusal('acme_agent1', 'h1', '{"phone": "503 555 0143 x12"}'), 'ok', 'an extension is allowed');
  PERFORM pg_temp.is(pg_temp.add_refusal('acme_agent1', 'h1', jsonb_build_object('first', repeat('a', 101))), '22023: Keep the first name to 100 characters.', 'first name length');
  PERFORM pg_temp.is(pg_temp.add_refusal('acme_agent1', 'h1', jsonb_build_object('last', repeat('a', 101))), '22023: Keep the last name to 100 characters.', 'last name length');
  PERFORM pg_temp.is(pg_temp.add_refusal('acme_agent1', 'h1', jsonb_build_object('title', repeat('a', 101))), '22023: Keep the title to 100 characters.', 'title length');
  PERFORM pg_temp.is(pg_temp.add_refusal('acme_agent1', 'h1', jsonb_build_object('email', repeat('a', 250) || '@b.co')), '22023: Enter an email address like name@example.com.', 'email length');
  RAISE NOTICE 'add_contact: refusals passed';
END $$;

-- ---------- the owner ----------
-- Break caught: any member is made the owner (a person who left, one of another firm), the level rule is not asked (an agent hands a contact to a colleague, a lead
-- to someone outside their teams), or the chosen owner is ignored.
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.add_refusal('acme_owner', 'h1', '{}', 'acme_agent3'), 'ok', 'an owner of the firm gives a contact to anyone in it');
  PERFORM pg_temp.is((SELECT owner_id FROM public.contacts WHERE account_id = pg_temp.id('h1') ORDER BY created_at DESC, id LIMIT 1), pg_temp.id('acme_agent3'), 'and it is theirs');
  PERFORM pg_temp.is(pg_temp.add_refusal('acme_lead', 'ha2', '{}', 'acme_agent2'), 'ok', 'a lead gives one to their team''s agent');
  PERFORM pg_temp.is(pg_temp.add_refusal('acme_lead', 'ha2', '{}', 'acme_agent1'), '42501: You can add a contact only for yourself and, as a lead, for people on your teams.', 'a lead may not give one outside their teams');
  PERFORM pg_temp.is(pg_temp.add_refusal('zenith_agent2', 'z1', '{}', 'zenith_agent', 'zenith'), '42501: You can add a contact only for yourself and, as a lead, for people on your teams.', 'an agent may not give one to a colleague');
  PERFORM pg_temp.is(pg_temp.add_refusal('acme_owner', 'h1', '{}', 'acme_removed'), '22023: Choose one of the firm''s people as the owner.', 'a person who has left is not a choice');
  PERFORM pg_temp.is(pg_temp.add_refusal('acme_owner', 'h1', '{}', 'zenith_owner'), '22023: Choose one of the firm''s people as the owner.', 'nor a person of another firm');
  RAISE NOTICE 'add_contact: the owner passed';
END $$;

-- ---------- one main contact ----------
-- Break caught: the constraint is dropped (two mains can be written by any other path), a new main does not displace the old (the call fails or both stay),
-- the displaced one is not named in the answer (the screen cannot say so), the displacing is not in the old main's history, or an unticked contact changes the main.
DO $$
DECLARE r jsonb; first_main uuid; second_main uuid;
BEGIN
  r := pg_temp.add('acme_agent1', 'h2', '{"main": true, "first": "Ada", "last": "Main", "email": "ada@e.example"}');
  first_main := (r #>> '{record,id}')::uuid;
  PERFORM pg_temp.is((r #>> '{record,is_main}')::boolean, true, 'the first main contact');
  PERFORM pg_temp.is(r -> 'previous_main', 'null'::jsonb, 'displaces no one');
  r := pg_temp.add('acme_agent1', 'h2', '{"first": "Bo", "last": "Plain", "email": "bo@e.example"}');
  PERFORM pg_temp.is((SELECT is_main FROM public.contacts WHERE id = first_main), true, 'a contact added without the tick leaves the main alone');
  r := pg_temp.add('acme_agent1', 'h2', '{"main": true, "first": "Cy", "last": "NewMain", "email": "cy@e.example"}');
  second_main := (r #>> '{record,id}')::uuid;
  PERFORM pg_temp.is(r #>> '{previous_main,id}', first_main::text, 'the displaced main contact is named in the answer');
  PERFORM pg_temp.is(r #>> '{previous_main,name}', 'Ada Main', 'by name');
  PERFORM pg_temp.is((SELECT is_main FROM public.contacts WHERE id = first_main), false, 'the old main is unticked');
  PERFORM pg_temp.is((SELECT is_main FROM public.contacts WHERE id = second_main), true, 'the new one is main');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = pg_temp.id('h2') AND is_main), 1::bigint, 'one main contact');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history h WHERE h.table_name = 'contacts' AND h.record_key = first_main::text AND h.field = 'is_main'), 1::bigint, 'the old main''s change is in the history');
  -- The constraint, whoever writes.
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.contacts (firm_id, account_id, last_name, email, is_main) VALUES (%L, %L, 'Second', 'x@e.example', true)$q$, pg_temp.id('acme'), pg_temp.id('h2'))), '23505', 'a second main contact on one account is refused by the constraint');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.contacts SET is_main = true WHERE id = %L$q$, first_main)), '23505', 'and so is ticking another by a plain update');
  -- Another account is its own: each has its own main contact.
  r := pg_temp.add('acme_agent1', 'h1', '{"main": true, "first": "Di", "last": "Other", "email": "di@e.example"}');
  PERFORM pg_temp.is((r #>> '{record,is_main}')::boolean, true, 'another account has its own main contact');
  PERFORM pg_temp.is(r -> 'previous_main', 'null'::jsonb, 'displacing no one there');
  RAISE NOTICE 'add_contact: one main contact passed';
END $$;

-- ---------- taking over as main contact follows the level rule ----------
-- Adding is open to anyone who may see the account (D-209), but unticking the old main contact changes that contact's record, which the level rule governs.
-- Break caught: a person who may see an account and not change a colleague's main contact there ticks "Main contact" and unticks it anyway.
DO $$
DECLARE r jsonb;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.account('z4', 'zenith', 'zenith_agent', 'Zenith four');
  PERFORM pg_temp.contact('z4main', 'z4', 'zenith_agent', 'z4main@e.example', NULL, true);
  PERFORM pg_temp.is(pg_temp.add_refusal('zenith_agent2', 'z4', '{"main": true, "first": "Cy", "last": "Take"}', NULL, 'zenith'),
    '42501: Only someone who may change First z4main Last z4main can make another contact the main one.', 'a colleague may not take the main place of a contact they may not change');
  PERFORM pg_temp.is((SELECT is_main FROM public.contacts WHERE id = pg_temp.id('z4main')), true, 'and the main contact is still main');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = pg_temp.id('z4')), 1::bigint, 'and nothing was added');
  PERFORM pg_temp.is(pg_temp.add_refusal('zenith_agent2', 'z4', '{"first": "Cy", "last": "Plain"}', NULL, 'zenith'), 'ok', 'the same person can still add the contact, unticked');
  r := pg_temp.add('zenith_agent', 'z4', '{"main": true, "first": "Di", "last": "Own"}', NULL, 'zenith');
  PERFORM pg_temp.is(r #>> '{previous_main,name}', 'First z4main Last z4main', 'the main contact''s own owner may hand the place over');
  RAISE NOTICE 'add_contact: taking over main follows the level rule passed';
END $$;

-- ---------- two people tick "main" at once ----------
-- Break caught: the account is not held while the old main is unticked, so two sessions that each tick the box both see the old main, both unset it and the
-- second insert meets the unique index (an error that names no reason). The second is seen WAITING for the first, then wins: one main contact, the later one's.
CREATE SCHEMA race;
CREATE EXTENSION dblink SCHEMA race;

CREATE FUNCTION pg_temp.race(first_stmt text, b_who text, b_stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  dsn text := format('dbname=%s user=%s port=%s host=%s', current_database(), session_user, current_setting('port'),
    split_part(current_setting('unix_socket_directories'), ',', 1));
  b_pid integer; tries integer := 0; waited boolean := false; rb text;
BEGIN
  PERFORM race.dblink_connect('ra', dsn);
  PERFORM race.dblink_connect('rb', dsn);
  PERFORM race.dblink_exec('ra', 'SET lock_timeout = ''20s''');
  PERFORM race.dblink_exec('rb', 'SET lock_timeout = ''20s''');
  SELECT pid INTO b_pid FROM race.dblink('rb', 'SELECT pg_backend_pid()') AS t(pid integer);
  PERFORM race.dblink_exec('ra', 'BEGIN');
  PERFORM race.dblink_exec('ra', first_stmt);
  PERFORM race.dblink_exec('rb', 'BEGIN');
  PERFORM race.dblink_exec('rb', 'SET LOCAL ROLE authenticated');
  PERFORM race.dblink_exec('rb', format('SET LOCAL request.jwt.claims = %L',
    jsonb_build_object('sub', pg_temp.id(b_who), 'role', 'authenticated', 'is_anonymous', false, 'email', b_who || '@example.test')::text));
  PERFORM race.dblink_send_query('rb', b_stmt);
  WHILE tries < 80 LOOP
    IF cardinality(pg_blocking_pids(b_pid)) > 0 THEN waited := true; EXIT; END IF;
    IF race.dblink_is_busy('rb') = 0 THEN EXIT; END IF;
    tries := tries + 1;
    PERFORM pg_sleep(0.05);
  END LOOP;
  PERFORM race.dblink_exec('ra', 'COMMIT');
  BEGIN
    SELECT r INTO rb FROM race.dblink_get_result('rb') AS t(r text);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS rb = RETURNED_SQLSTATE;
  END;
  -- The connection is drained (a second read gives no more rows) and then B's transaction is committed, so what B did is seen.
  BEGIN
    PERFORM r FROM race.dblink_get_result('rb') AS t(r text);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN PERFORM race.dblink_exec('rb', 'COMMIT'); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM race.dblink_disconnect('ra');
  PERFORM race.dblink_disconnect('rb');
  RETURN CASE WHEN waited THEN 'waited' ELSE 'did not wait' END || '|' || COALESCE(rb, '<null>');
END $$;

DO $$
BEGIN
  RESET ROLE;
  PERFORM pg_temp.account('r1', 'acme', 'acme_agent1', 'Race account');
  PERFORM pg_temp.contact('r1old', 'r1', 'acme_agent1', 'old@e.example', NULL, true);
  PERFORM pg_temp.account('r2', 'acme', 'acme_agent1', 'Race archive');
  PERFORM pg_temp.contact('rc', 'h1', 'acme_agent1', 'rc@e.example');
END $$;

DO $$
DECLARE r text; firm uuid := pg_temp.id('acme');
BEGIN
  RESET ROLE;
  -- A adds a main contact as agent1 (left open); B, agent1 again in another session, adds another main contact.
  r := pg_temp.race(
    format($q$SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = %L; DO $d$ BEGIN PERFORM public.add_contact(%L, 'A', 'First', NULL, 'a@e.example', NULL, NULL, NULL, true, false, %L); END $d$ $q$,
      jsonb_build_object('sub', pg_temp.id('acme_agent1'), 'role', 'authenticated', 'is_anonymous', false, 'email', 'acme_agent1@example.test')::text, pg_temp.id('r1'), firm),
    'acme_agent1',
    format($q$SELECT public.add_contact(%L, 'B', 'Second', NULL, 'b@e.example', NULL, NULL, NULL, true, false, %L)::text$q$, pg_temp.id('r1'), firm));
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'the second session waits for the first to commit');
  PERFORM pg_temp.is(split_part(r, '|', 2) LIKE '{%', true, 'and then is served, not met by the unique index: ' || r);
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = pg_temp.id('r1') AND is_main), 1::bigint, 'one main contact');
  PERFORM pg_temp.is((SELECT first_name FROM public.contacts WHERE account_id = pg_temp.id('r1') AND is_main), 'B', 'the later one''s');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = pg_temp.id('r1')), 3::bigint, 'and both were made');
  RAISE NOTICE 'add_contact: the two-session race passed';
END $$;

-- ---------- adding races archiving ----------
-- Break caught: add_contact reads the account's archived state without holding the row, so a contact is added to an account whose archiving is not yet committed.
-- The add is seen waiting for the archiving, then refused in words.
DO $$
DECLARE r text; firm uuid := pg_temp.id('acme');
BEGIN
  RESET ROLE;
  r := pg_temp.race(
    format($q$UPDATE public.accounts SET archived_at = now() WHERE id = %L$q$, pg_temp.id('r2')),
    'acme_agent1',
    format($q$SELECT public.add_contact(%L, 'A', 'Late', NULL, 'late@e.example', NULL, NULL, NULL, false, false, %L)::text$q$, pg_temp.id('r2'), firm));
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'the add waits for an archiving in flight');
  PERFORM pg_temp.is(split_part(r, '|', 2), '55000', 'and is then refused');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = pg_temp.id('r2')), 0::bigint, 'nothing was added');
  RAISE NOTICE 'add_contact: the archive race passed';
END $$;

-- ---------- moving a contact: what goes with it ----------
-- Break caught: the contact's calls, notes and tasks stay behind (the contact moves and its history does not), another contact's go with it, the contact arrives
-- as the account's main contact and displaces the one there, its move is not one entry per change in the history, or it is not under the mover's name.
DO $$
DECLARE r jsonb; ch bigint;
BEGIN
  RESET ROLE;
  UPDATE public.contacts SET is_main = false WHERE account_id IN (pg_temp.id('h1'), pg_temp.id('h2'));
  PERFORM pg_temp.contact('m1', 'h1', 'acme_agent1', 'm1@e.example', NULL, true);
  PERFORM pg_temp.contact('m1other', 'h1', 'acme_agent1', 'm1o@e.example');
  PERFORM pg_temp.contact('h2main', 'h2', 'acme_agent1', 'h2main@e.example');
  PERFORM pg_temp.activity('m1call', 'call', 'h1', 'm1');
  PERFORM pg_temp.activity('m1note', 'note', 'h1', 'm1');
  PERFORM pg_temp.activity('m1task', 'task', 'h1', 'm1');
  PERFORM pg_temp.activity('m1otherNote', 'note', 'h1', 'm1other');
  PERFORM pg_temp.activity('h1plain', 'note', 'h1', NULL);
  ch := (SELECT count(DISTINCT change_id) FROM public.record_history WHERE table_name = 'contacts' AND record_key = pg_temp.id('m1')::text);
  r := pg_temp.move('acme_agent1', 'm1', 'h2');
  PERFORM pg_temp.is(pg_temp.acct_of('contacts', 'm1'), pg_temp.id('h2'), 'the contact is on the new account');
  PERFORM pg_temp.is(pg_temp.acct_of('activities', 'm1call'), pg_temp.id('h2'), 'its call went with it');
  PERFORM pg_temp.is(pg_temp.acct_of('activities', 'm1note'), pg_temp.id('h2'), 'its note went with it');
  PERFORM pg_temp.is(pg_temp.acct_of('activities', 'm1task'), pg_temp.id('h2'), 'its task went with it');
  PERFORM pg_temp.is(pg_temp.acct_of('activities', 'm1otherNote'), pg_temp.id('h1'), 'another contact''s note stayed');
  PERFORM pg_temp.is(pg_temp.acct_of('activities', 'h1plain'), pg_temp.id('h1'), 'and an account''s own note');
  PERFORM pg_temp.is((SELECT contact_id FROM public.activities WHERE id = pg_temp.id('m1call')), pg_temp.id('m1'), 'the call is still with the contact');
  PERFORM pg_temp.is((r ->> 'activities_moved')::int, 3, 'the answer counts the three');
  PERFORM pg_temp.is(r #>> '{from,name}', 'Harborview Dental', 'and names the account it left');
  PERFORM pg_temp.is(r #>> '{to,name}', 'Harborview East', 'and the one it joined');
  PERFORM pg_temp.is((r ->> 'was_main')::boolean, true, 'it was the main contact of the account it left');
  PERFORM pg_temp.is((SELECT is_main FROM public.contacts WHERE id = pg_temp.id('m1')), false, 'and arrives as no one''s main contact');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = pg_temp.id('h1') AND is_main), 0::bigint, 'the account it left has no main contact now');
  PERFORM pg_temp.is((r #>> '{record,id}')::uuid, pg_temp.id('m1'), 'the answer is the contact');
  PERFORM pg_temp.is((SELECT count(DISTINCT change_id) FROM public.record_history WHERE table_name = 'contacts' AND record_key = pg_temp.id('m1')::text), ch + 1, 'one entry per change in the history');
  PERFORM pg_temp.is((SELECT h.actor_id FROM public.record_history h WHERE h.table_name = 'contacts' AND h.record_key = pg_temp.id('m1')::text AND h.field = 'account_id'), pg_temp.id('acme_agent1'), 'under the mover');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history h WHERE h.table_name = 'contacts' AND h.record_key = pg_temp.id('m1')::text AND h.field = 'account_id'), 1::bigint, 'the account change is one row');
  PERFORM pg_temp.is((SELECT version FROM public.contacts WHERE id = pg_temp.id('m1')), 2, 'the contact''s version moved on');
  -- A main contact moving onto an account with a main contact does not displace it.
  UPDATE public.contacts SET is_main = true WHERE id = pg_temp.id('h2main');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.contacts SET is_main = false WHERE id = %L$q$, pg_temp.id('m1'))), 'rows:1', 'fixture');
  PERFORM pg_temp.contact('m1b', 'h1', 'acme_agent1', 'm1b@e.example', NULL, true);
  PERFORM pg_temp.move('acme_agent1', 'm1b', 'h2');
  PERFORM pg_temp.is((SELECT is_main FROM public.contacts WHERE id = pg_temp.id('h2main')), true, 'the account''s own main contact stays main');
  PERFORM pg_temp.is((SELECT is_main FROM public.contacts WHERE id = pg_temp.id('m1b')), false, 'and the one that arrived is not');
  RAISE NOTICE 'add_contact: a move passed';
END $$;

-- ---------- moving a contact: an opportunity that stays behind ----------
-- DECISION (D-209, D-233): the contact moves with its history, so a call, note or task naming the contact AND an opportunity of the account it leaves cannot stay
-- on both. It follows the contact and loses its link to the opportunity (the other choice, keeping it on the old account, would take the contact's history away
-- from it). A contact that is the main contact of an opportunity there stops being it. Neither is done in silence: without p_confirm the move is refused in
-- words with PT409, saying how many; with it the answer says how many were done. Break caught: an activity ends up on one account with a contact or an
-- opportunity of the other (the deferred keys), the move goes through without the question, the counts are wrong, an opportunity the caller may not change loses
-- its main contact, or the opportunity itself is touched.
DO $$
DECLARE r jsonb;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.contact('m2', 'h1', 'acme_agent1', 'm2@e.example');
  PERFORM pg_temp.opportunity('o2', 'h1', 'acme_agent1', NULL, 'm2');
  PERFORM pg_temp.opportunity('o2b', 'h1', 'acme_agent1');
  PERFORM pg_temp.activity('splitcall', 'call', 'h1', 'm2', 'o2');
  PERFORM pg_temp.activity('splittask', 'task', 'h1', 'm2', 'o2b');
  PERFORM pg_temp.activity('m2note', 'note', 'h1', 'm2');
  PERFORM pg_temp.activity('o2only', 'note', 'h1', NULL, 'o2');
  PERFORM pg_temp.is(pg_temp.move_refusal('acme_agent1', 'm2', 'h2'),
    'PT409: Moving First m2 Last m2 takes 2 calls, notes and tasks off an opportunity on Harborview Dental and removes them as the main contact of 1 opportunity there. Move anyway?',
    'without confirming, refused in words that count both');
  PERFORM pg_temp.is(pg_temp.acct_of('contacts', 'm2'), pg_temp.id('h1'), 'and nothing moved');
  PERFORM pg_temp.is((SELECT opportunity_id FROM public.activities WHERE id = pg_temp.id('splitcall')), pg_temp.id('o2'), 'nor was a link dropped');
  PERFORM pg_temp.is((SELECT main_contact_id FROM public.opportunities WHERE id = pg_temp.id('o2')), pg_temp.id('m2'), 'nor a main contact cleared');
  r := pg_temp.move('acme_agent1', 'm2', 'h2', true);
  PERFORM pg_temp.is(pg_temp.acct_of('contacts', 'm2'), pg_temp.id('h2'), 'confirmed, the contact moves');
  PERFORM pg_temp.is(pg_temp.acct_of('activities', 'splitcall'), pg_temp.id('h2'), 'the call follows the contact');
  PERFORM pg_temp.is((SELECT opportunity_id FROM public.activities WHERE id = pg_temp.id('splitcall')), NULL::uuid, 'and is no longer about the opportunity left behind');
  PERFORM pg_temp.is(pg_temp.acct_of('activities', 'splittask'), pg_temp.id('h2'), 'the task too');
  PERFORM pg_temp.is((SELECT opportunity_id FROM public.activities WHERE id = pg_temp.id('splittask')), NULL::uuid, 'with its link dropped');
  PERFORM pg_temp.is(pg_temp.acct_of('activities', 'm2note'), pg_temp.id('h2'), 'a note with no opportunity just follows');
  PERFORM pg_temp.is(pg_temp.acct_of('activities', 'o2only'), pg_temp.id('h1'), 'an activity of the opportunity alone stays with it');
  PERFORM pg_temp.is((SELECT opportunity_id FROM public.activities WHERE id = pg_temp.id('o2only')), pg_temp.id('o2'), 'still about it');
  PERFORM pg_temp.is((r ->> 'activities_moved')::int, 3, 'three moved');
  PERFORM pg_temp.is((r ->> 'opportunity_links_dropped')::int, 2, 'two links to an opportunity dropped');
  PERFORM pg_temp.is((r ->> 'main_contact_cleared')::int, 1, 'one opportunity lost its main contact');
  PERFORM pg_temp.is((SELECT main_contact_id FROM public.opportunities WHERE id = pg_temp.id('o2')), NULL::uuid, 'the opportunity has no main contact now');
  PERFORM pg_temp.is(pg_temp.acct_of('opportunities', 'o2'), pg_temp.id('h1'), 'and itself stayed on its account');
  -- Nothing is ever split: no activity names a contact or an opportunity of another account.
  PERFORM pg_temp.is((SELECT count(*) FROM public.activities a WHERE a.contact_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = a.contact_id AND c.account_id = a.account_id)), 0::bigint, 'no activity is split from its contact');
  PERFORM pg_temp.is((SELECT count(*) FROM public.activities a WHERE a.opportunity_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = a.opportunity_id AND o.account_id = a.account_id)), 0::bigint, 'nor from its opportunity');
  -- An opportunity the caller may not change keeps its main contact: the move is refused (the caller may move the contact, not change that opportunity).
  PERFORM pg_temp.contact('m3', 'h1', 'acme_agent1', 'm3@e.example');
  PERFORM pg_temp.opportunity('o3', 'h1', 'acme_agent3', NULL, 'm3');
  PERFORM pg_temp.is(pg_temp.move_refusal('acme_agent1', 'm3', 'h2', true) LIKE '42501: %', true, 'a main contact of an opportunity the mover may not change is refused, even confirmed');
  PERFORM pg_temp.is(pg_temp.acct_of('contacts', 'm3'), pg_temp.id('h1'), 'and not moved');
  -- The same for a call that names an opportunity the mover may not change: its link would be dropped, which changes that opportunity's record.
  PERFORM pg_temp.contact('m4', 'h1', 'acme_agent1', 'm4@e.example');
  PERFORM pg_temp.opportunity('o4', 'h1', 'acme_agent3');
  PERFORM pg_temp.activity('m4call', 'call', 'h1', 'm4', 'o4');
  PERFORM pg_temp.is(pg_temp.move_refusal('acme_agent1', 'm4', 'h2', true) LIKE '42501: %', true, 'a call about an opportunity the mover may not change is refused, even confirmed');
  PERFORM pg_temp.is(pg_temp.acct_of('contacts', 'm4'), pg_temp.id('h1'), 'and nothing moved');
  PERFORM pg_temp.is((SELECT opportunity_id FROM public.activities WHERE id = pg_temp.id('m4call')), pg_temp.id('o4'), 'nor was its link dropped');
  PERFORM pg_temp.is(pg_temp.move_refusal('acme_owner', 'm4', 'h2', true), 'ok', 'an owner of the firm may');
  RAISE NOTICE 'add_contact: the opportunity left behind passed';
END $$;

-- ---------- moving a contact: who may ----------
-- DECISION (D-209): moving takes three yeses by the level rule: the contact (its owner's level), the account it leaves and the account it joins. Each must be
-- seen (else PT404, as not there) and changeable (else 42501 in words). An archived account takes nothing new, so it cannot be joined (55000); it can be left.
-- Break caught: any one of the three checks is missing, a contact with no owner is moved by a non-owner, a lead moves one outside their teams, an archived
-- account is joined, another firm's account is reachable, the same account is "moved" to, or one person ends up on an account twice (a prospect).
DO $$
BEGIN
  RESET ROLE;
  PERFORM pg_temp.contact('w1', 'h1', 'acme_agent1', 'w1@e.example');
  PERFORM pg_temp.contact('wn', 'h1', NULL, 'wn@e.example');
  PERFORM pg_temp.contact('wn2', 'hl', NULL, 'wn2@e.example');
  PERFORM pg_temp.contact('wt', 'ha2', 'acme_agent2', 'wt@e.example');
  PERFORM pg_temp.contact('wl2', 'hl2', 'acme_lead2', 'wl2@e.example');
  PERFORM pg_temp.contact('zc', 'z1', 'zenith_agent', 'zc@e.example');
  PERFORM pg_temp.contact('zc2', 'z2', 'zenith_agent', 'zc2@e.example');
  PERFORM pg_temp.is(pg_temp.move_refusal('acme_agent3', 'w1', 'h2'), 'PT404: That contact isn''t available', 'a contact on an account the caller may not see reads as not there');
  PERFORM pg_temp.is(pg_temp.move_refusal('acme_agent1', 'w1', 'hl2'), 'PT404: That account isn''t available', 'an account to join that the caller may not see reads as not there');
  PERFORM pg_temp.is(pg_temp.move_refusal('acme_agent1', 'w1', 'z1'), 'PT404: That account isn''t available', 'another firm''s account too');
  PERFORM pg_temp.is(pg_temp.move_refusal('acme_agent1', 'w1', 'h1'), '22023: That contact is already on this account.', 'the same account');
  PERFORM pg_temp.is(pg_temp.move_refusal('acme_agent1', 'w1', 'harch'), '55000: This account is archived. Nothing can be moved onto it.', 'an archived account is not joined');
  PERFORM pg_temp.is(pg_temp.acct_of('contacts', 'w1'), pg_temp.id('h1'), 'and nothing moved');
  PERFORM pg_temp.is(pg_temp.move_refusal('acme_agent1', 'wn', 'h2') LIKE '42501: %', true, 'a contact with no owner is an owner of the firm''s to move');
  PERFORM pg_temp.is(pg_temp.move_refusal('acme_lead', 'wn2', 'ha2'), '42501: Only an owner of the firm can move a contact that has no owner.', 'a lead is told so in words');
  PERFORM pg_temp.is(pg_temp.move_refusal('acme_owner', 'wn', 'h2'), 'ok', 'an owner of the firm moves it');
  PERFORM pg_temp.is(pg_temp.move_refusal('acme_lead', 'wt', 'hl'), 'ok', 'a lead moves their team''s contact between accounts they may change');
  PERFORM pg_temp.is(pg_temp.move_refusal('acme_lead', 'wl2', 'hl'), 'PT404: That contact isn''t available', 'but not one on an account outside their teams (not seen)');
  -- Zenith shows everyone everything, so seen and not changeable can be told apart.
  PERFORM pg_temp.is(pg_temp.move_refusal('zenith_agent2', 'zc', 'z3', false, 'zenith'), '42501: Only the contact''s owner, a lead of the owner''s team or an owner of the firm can move this contact.', 'a contact the caller may see but not change');
  PERFORM pg_temp.is(pg_temp.move_refusal('zenith_agent', 'zc2', 'z3', false, 'zenith'), '42501: You can''t change the account this contact is on, so you can''t move it off.', 'the account it leaves is not the caller''s to change');
  PERFORM pg_temp.is(pg_temp.move_refusal('zenith_agent', 'zc', 'z2', false, 'zenith'), '42501: You can''t change Zenith two, so you can''t move a contact onto it.', 'the account it joins is not the caller''s to change');
  PERFORM pg_temp.is(pg_temp.move_refusal('zenith_agent', 'zc', 'z3', false, 'zenith'), 'ok', 'all three the caller''s: moved');
  PERFORM pg_temp.is(pg_temp.move_refusal('acme_agent1', 'zc', 'h2'), 'PT404: That contact isn''t available', 'another firm''s contact reads as not there');
  PERFORM pg_temp.is(pg_temp.move_refusal('acme_agent1', 'w1', 'h2', false, 'zenith'), '42501: Not a member of that firm', 'naming a firm the person is not in');
  PERFORM pg_temp.is(pg_temp.move_refusal('nobody', 'w1', 'h2'), '42501: Not a member of that firm', 'a person of no firm');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.move_contact(%L, %L, false, %L)$q$, pg_temp.id('w1'), pg_temp.id('h2'), pg_temp.id('acme'))), '42501', 'signed out');
  RESET ROLE;
  -- A person is at most one contact of an account (D-194): a contact made from a prospect does not join an account that has that prospect already.
  PERFORM pg_temp.new_user('prospect1');
  WITH ins AS (INSERT INTO public.contacts (firm_id, account_id, owner_id, last_name, email, prospect_user_id)
    VALUES (pg_temp.id('acme'), pg_temp.id('h1'), pg_temp.id('acme_agent1'), 'Prospect', 'p@e.example', pg_temp.id('prospect1')) RETURNING id)
  INSERT INTO fx SELECT 'pc1', id FROM ins;
  INSERT INTO public.contacts (firm_id, account_id, owner_id, last_name, email, prospect_user_id)
    VALUES (pg_temp.id('acme'), pg_temp.id('h2'), pg_temp.id('acme_agent1'), 'Prospect', 'p@e.example', pg_temp.id('prospect1'));
  PERFORM pg_temp.is(pg_temp.move_refusal('acme_agent1', 'pc1', 'h2'), '22023: That account already has this person as a contact.', 'the same prospect is not a contact of one account twice');
  PERFORM pg_temp.is(pg_temp.acct_of('contacts', 'pc1'), pg_temp.id('h1'), 'and nothing moved');
  RAISE NOTICE 'add_contact: who may move passed';
END $$;

-- ---------- moving races a call being logged ----------
-- Break caught: the contact is not held while its activities are moved, so a call logged for it at the same moment (not yet committed) is left on the old
-- account with a contact that moved: the deferred key then fails at commit with no reason, or the call is lost. The move is seen WAITING for the call, then
-- takes it along.
DO $$
DECLARE r text; firm uuid := pg_temp.id('acme');
BEGIN
  RESET ROLE;
  r := pg_temp.race(
    format($q$INSERT INTO public.activities (firm_id, account_id, kind, contact_id, outcome, body) VALUES (%L, %L, 'call', %L, 'spoke', 'in flight')$q$, firm, pg_temp.id('h1'), pg_temp.id('rc')),
    'acme_agent1',
    format($q$SELECT public.move_contact(%L, %L, false, %L)::text$q$, pg_temp.id('rc'), pg_temp.id('h2'), firm));
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'the move waits for a call being logged for the contact');
  PERFORM pg_temp.is(split_part(r, '|', 2) LIKE '{%', true, 'and then goes through: ' || r);
  PERFORM pg_temp.is((SELECT account_id FROM public.activities WHERE body = 'in flight'), pg_temp.id('h2'), 'the call went with the contact');
  RAISE NOTICE 'add_contact: the move race passed';
END $$;

-- ---------- moving races an archiving ----------
-- Break caught: move_contact does not hold the accounts, so a move that runs while the account it joins is being archived (not yet committed) reads it as live
-- and puts the contact on an archived account. The move is seen WAITING for the archiving, then refused in words (55000).
DO $$
BEGIN
  RESET ROLE;
  PERFORM pg_temp.account('rd', 'acme', 'acme_agent1', 'Race destination');
  PERFORM pg_temp.contact('rdc', 'h1', 'acme_agent1', 'rdc@e.example');
  PERFORM pg_temp.new_user('acme_mover1'); PERFORM pg_temp.new_user('acme_mover2');
  INSERT INTO public.firm_memberships (firm_id, user_id, role, team_id) VALUES
    (pg_temp.id('acme'), pg_temp.id('acme_mover1'), 'agent', NULL), (pg_temp.id('acme'), pg_temp.id('acme_mover2'), 'agent', NULL);
END $$;

DO $$
DECLARE r text; firm uuid := pg_temp.id('acme');
BEGIN
  RESET ROLE;
  r := pg_temp.race(
    format($q$UPDATE public.accounts SET archived_at = now() WHERE id = %L$q$, pg_temp.id('rd')),
    'acme_agent1',
    format($q$SELECT public.move_contact(%L, %L, false, %L)::text$q$, pg_temp.id('rdc'), pg_temp.id('rd'), firm));
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'the move waits for an archiving of the account it joins');
  PERFORM pg_temp.is(split_part(r, '|', 2), '55000', 'and is then refused');
  PERFORM pg_temp.is(pg_temp.acct_of('contacts', 'rdc'), pg_temp.id('h1'), 'the contact did not move');
  RAISE NOTICE 'add_contact: the move/archive race passed';
END $$;

-- ---------- adding races the removal of the owner chosen ----------
-- Break caught: add_contact asks "is the chosen person a current member" without holding their membership row (FOR SHARE), so a removal that commits after the
-- question leaves the contact owned by a former member. A removal not yet committed makes the add wait and then be refused in words (22023); an add not yet
-- committed makes the removal (an update of the membership's end) wait.
DO $$
DECLARE r text; firm uuid := pg_temp.id('acme');
BEGIN
  RESET ROLE;
  r := pg_temp.race(
    format($q$UPDATE public.firm_memberships SET valid_until = now() WHERE user_id = %L$q$, pg_temp.id('acme_mover1')),
    'acme_owner',
    format($q$SELECT public.add_contact(%L, 'A', 'Owned', NULL, 'owned@e.example', NULL, NULL, %L, false, false, %L)::text$q$, pg_temp.id('h2'), pg_temp.id('acme_mover1'), firm));
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'the add waits for the removal of the person it names');
  PERFORM pg_temp.is(split_part(r, '|', 2), '22023', 'and, once it has committed, is refused: not a current member');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE email = 'owned@e.example'), 0::bigint, 'nothing was added');
  r := pg_temp.race(
    format($q$SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = %L; DO $d$ BEGIN PERFORM public.add_contact(%L, 'B', 'Owned', NULL, 'owned2@e.example', NULL, NULL, %L, false, false, %L); END $d$ $q$,
      jsonb_build_object('sub', pg_temp.id('acme_owner'), 'role', 'authenticated', 'is_anonymous', false, 'email', 'acme_owner@example.test')::text, pg_temp.id('h2'), pg_temp.id('acme_mover2'), firm),
    'acme_owner',
    format($q$SELECT public.remove_member(%L, %L)::text$q$, firm, pg_temp.id('acme_mover2')));
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'the removal waits for an add that names the person');
  PERFORM pg_temp.is((SELECT owner_id FROM public.contacts WHERE email = 'owned2@e.example'), pg_temp.id('acme_mover2'), 'and the add stands');
  RAISE NOTICE 'add_contact: the removal races passed';
END $$;

-- ---------- where a contact may go, and the form's context ----------
-- Break caught: the picker offers an account the move would refuse (archived, not seen, not changeable, the one the contact is on, another firm's), is not
-- narrowed by what was typed, or answers more than a page; the form's context names an account the caller may not see, or misses the current main contact.
DO $$
DECLARE r jsonb;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.contact('pk', 'h1', 'acme_agent1', 'pk@e.example');
  PERFORM pg_temp.as_user('acme_agent1');
  PERFORM pg_temp.is((SELECT string_agg(name, ',' ORDER BY name) FROM public.contact_move_choices(pg_temp.id('acme'), pg_temp.id('pk'), '')), 'Harborview East,Race account', 'an agent may move a contact only to their own other, live accounts');
  PERFORM pg_temp.is((SELECT string_agg(name, ',') FROM public.contact_move_choices(pg_temp.id('acme'), pg_temp.id('pk'), 'zzz')), NULL::text, 'narrowed by what was typed');
  PERFORM pg_temp.is((SELECT string_agg(name, ',') FROM public.contact_move_choices(pg_temp.id('acme'), pg_temp.id('pk'), 'east')), 'Harborview East', 'in any case');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contact_move_choices(pg_temp.id('acme'), pg_temp.id('pk'), '')) >= 5, true, 'an owner of the firm may move to any of the firm''s live accounts');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contact_move_choices(pg_temp.id('acme'), pg_temp.id('pk'), '') WHERE name IN ('Harborview Dental', 'Archived account')), 0::bigint, 'but not the one it is on or an archived one');
  PERFORM pg_temp.as_user('acme_agent3');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.contact_move_choices(%L, %L, '')$q$, pg_temp.id('acme'), pg_temp.id('pk'))), 'PT404: That contact isn''t available', 'a contact the caller may not see');
  PERFORM pg_temp.as_user('acme_agent1');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.contact_move_choices(%L, %L, '')$q$, pg_temp.id('zenith'), pg_temp.id('pk'))), '42501: Not a member of that firm', 'another firm');
  -- The form's context: the account's name, whether it takes more, and who is main now.
  RESET ROLE;
  PERFORM pg_temp.contact('ctxmain', 'h2', 'acme_agent1', 'ctx@e.example', NULL, false);
  UPDATE public.contacts SET is_main = false WHERE account_id = pg_temp.id('h2');
  PERFORM pg_temp.as_user('acme_agent1');
  r := public.add_contact_context(pg_temp.id('acme'), pg_temp.id('h2'));
  PERFORM pg_temp.is(r #>> '{account,name}', 'Harborview East', 'the account''s name');
  PERFORM pg_temp.is((r #>> '{account,archived}')::boolean, false, 'not archived');
  PERFORM pg_temp.is(r -> 'main_contact', 'null'::jsonb, 'no main contact yet');
  RESET ROLE;
  UPDATE public.contacts SET is_main = true WHERE id = pg_temp.id('ctxmain');
  PERFORM pg_temp.as_user('acme_agent1');
  r := public.add_contact_context(pg_temp.id('acme'), pg_temp.id('h2'));
  PERFORM pg_temp.is(r #>> '{main_contact,name}', 'First ctxmain Last ctxmain', 'the main contact is named');
  PERFORM pg_temp.is((public.add_contact_context(pg_temp.id('acme'), pg_temp.id('harch')) #>> '{account,archived}')::boolean, true, 'an archived account says so');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.add_contact_context(%L, %L)$q$, pg_temp.id('acme'), pg_temp.id('hl2'))), 'PT404: That account isn''t available', 'an account the caller may not see');
  RESET ROLE;
  RAISE NOTICE 'add_contact: choices and context passed';
END $$;

-- ---------- the whole thing, as the API roles see it ----------
-- Break caught: the functions are open to anon or to any signed-in person without a firm, or an API role may write a contact directly.
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_agent1');
  PERFORM pg_temp.is(pg_temp.attempt($q$INSERT INTO public.contacts (firm_id, account_id, last_name, email) VALUES (gen_random_uuid(), gen_random_uuid(), 'x', 'x@e.example')$q$), '42501', 'no API role writes a contact directly');
  PERFORM pg_temp.is(pg_temp.attempt($q$UPDATE public.contacts SET account_id = account_id$q$), '42501', 'nor changes one');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.add_contact_context(%L, %L)$q$, pg_temp.id('acme'), pg_temp.id('h1'))), '42501', 'the context is not served signed out');
  RESET ROLE;
  RAISE NOTICE 'add_contact: all passed';
END $$;
