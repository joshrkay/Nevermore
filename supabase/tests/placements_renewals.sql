-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh placements_renewals
-- Placements and renewals (story CRM-A2.4a; docs/BROKER_CRM_BUILD.md D-446 to D-454, D-520 to D-528; 20261120110000_placements_renewals.sql).
-- A renewal added, edited and deleted by hand with the placement a PEO renewal makes; the account's renewals with days away; the opportunity working a
-- renewal; "Didn't renew" and Former client; the Renewal column and the 120-day view in the accounts table's query. Two firms are used throughout.
-- Every migration is loaded, in filename order (D-105), this story's last.
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
\i supabase/migrations/20261119210000_bulk_changes.sql
\i supabase/migrations/20261119230000_search_everywhere.sql
\i supabase/migrations/20261119240000_contact_page.sql
\i supabase/migrations/20261120090000_opportunity_stage.sql
\i supabase/migrations/20261120110000_placements_renewals.sql
SET client_min_messages = notice;

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
CREATE FUNCTION pg_temp.account(n text, firm text, p_owner text, nm text DEFAULT NULL, site text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r uuid;
BEGIN
  INSERT INTO public.accounts (source, firm_id, owner_id, name, website) VALUES ('added_by_hand', pg_temp.id(firm), pg_temp.id(p_owner), COALESCE(nm, n), site) RETURNING id INTO r;
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


-- ---------- set up: two firms, each with an owner and an agent ----------
DO $$
DECLARE acme uuid; zenith uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Acme Brokers', 'acme-brokers', now()) RETURNING id INTO acme;
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Zenith Benefits', 'zenith-benefits', now()) RETURNING id INTO zenith;
  INSERT INTO fx VALUES ('acme', acme), ('zenith', zenith);
  PERFORM pg_temp.new_user('acme_owner'); PERFORM pg_temp.new_user('acme_agent'); PERFORM pg_temp.new_user('zenith_owner'); PERFORM pg_temp.new_user('nobody');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES
    (acme, pg_temp.id('acme_owner'), 'owner'), (acme, pg_temp.id('acme_agent'), 'agent'), (zenith, pg_temp.id('zenith_owner'), 'owner');
END $$;



-- Today, as the database's default time zone reads it, and a day some days from it.
CREATE FUNCTION pg_temp.today() RETURNS date LANGUAGE sql AS $$ SELECT (now() AT TIME ZONE 'UTC')::date $$;
CREATE FUNCTION pg_temp.d(n integer) RETURNS date LANGUAGE sql AS $$ SELECT pg_temp.today() + n $$;

-- A reading helper acts as the firm's owner when nobody is signed in (the superuser's claims are empty), so a test can read after making fixtures.
CREATE FUNCTION pg_temp.read_as(firm text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '') = '' THEN PERFORM pg_temp.claims_of(firm || '_owner'); END IF;
END $$;

-- The accounts table's row for an account, as the caller reads it (or NULL).
CREATE FUNCTION pg_temp.row_of(firm text, acct text, filters text DEFAULT '[]') RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.read_as(firm);
  SELECT x INTO r FROM jsonb_array_elements(public.accounts_list(pg_temp.id(firm), filters::jsonb) -> 'rows') x WHERE x ->> 'id' = pg_temp.id(acct)::text;
  RETURN r;
END $$;

-- The names of the accounts a call of the table's query lists, in its order.
CREATE FUNCTION pg_temp.listed(firm text, filters text, sort text DEFAULT NULL, dir text DEFAULT 'asc') RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  PERFORM pg_temp.read_as(firm);
  SELECT COALESCE(string_agg(x ->> 'name', ',' ORDER BY ord), '') INTO r
  FROM jsonb_array_elements(public.accounts_list(pg_temp.id(firm), filters::jsonb, sort, dir) -> 'rows') WITH ORDINALITY AS t (x, ord);
  RETURN r;
END $$;

-- An account's renewal row, by the with-whom it carries, as the account's renewals read it.
CREATE FUNCTION pg_temp.renewal(firm text, acct text, whom text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.read_as(firm);
  SELECT x INTO r FROM jsonb_array_elements(public.account_renewals(pg_temp.id(firm), pg_temp.id(acct)) -> 'rows') x WHERE x ->> 'with_whom' = whom;
  RETURN r;
END $$;

-- ---------- set up: two firms ----------
-- acme (level rule): acme_owner owns firm; acme_agent and acme_agent2 are agents. zenith shows everyone everything: zenith_owner owns, zenith_agent is an agent.
DO $$
DECLARE zenith uuid := pg_temp.id('zenith');
BEGIN
  PERFORM pg_temp.new_user('acme_agent2'); PERFORM pg_temp.new_user('zenith_agent');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES
    (pg_temp.id('acme'), pg_temp.id('acme_agent2'), 'agent'), (zenith, pg_temp.id('zenith_agent'), 'agent');
  UPDATE public.firms SET visibility = 'everyone' WHERE id = zenith;
  PERFORM pg_temp.account('a_agent', 'acme', 'acme_agent');
  PERFORM pg_temp.account('a_other', 'acme', 'acme_agent2');
  PERFORM pg_temp.account('a_owner', 'acme', 'acme_owner');
  PERFORM pg_temp.account('a_arch', 'acme', 'acme_agent');
  UPDATE public.accounts SET archived_at = now() WHERE id = pg_temp.id('a_arch');
  PERFORM pg_temp.account('z1', 'zenith', 'zenith_owner');
END $$;

-- ---------- The tables ----------
-- Break caught: a table is missing a column the later stories write (the quote taken, the broker of record, the commission, the date it ended, the
-- opportunity working a renewal, "Didn't renew"); an API role can write a row; a row of one firm is seen by another firm, or by a person who may not see its
-- account; the history and the version are not there.
DO $$
BEGIN
  PERFORM pg_temp.is((SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'placements'),
    'account_id,broker_of_record,commission_basis,commission_rate,commission_yearly,created_at,ended_on,firm_id,id,opportunity_id,peo_name,quote_request_id,start_date,updated_at,version',
    'a placement keeps the account, the opportunity, the quote, the PEO, the start, the broker of record, when it ended and the commission');
  PERFORM pg_temp.is((SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'renewals'),
    'account_id,created_at,firm_id,id,kind,not_renewed_on,opportunity_id,placement_id,renews_on,updated_at,version,with_whom',
    'a renewal keeps what renews, with whom, the date, the placement it came from, the opportunity working it and the day it did not renew');
  PERFORM pg_temp.is((SELECT bool_and(c.relrowsecurity) FROM pg_class c WHERE c.oid IN ('public.placements'::regclass, 'public.renewals'::regclass)), true, 'row security is on for both');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_trigger WHERE tgrelid IN ('public.placements'::regclass, 'public.renewals'::regclass) AND tgname LIKE '%history%'), 4::bigint,
    'both tables have a history trigger and the guard against truncation (D-453)');
END $$;

-- ---------- Adding a renewal by hand (D-447, D-452) ----------
-- Break caught: a PEO placement added by hand makes no placement (so the account is no client and can't end), or makes one with an opportunity or a quote it
-- never had, or without the PEO, the start date and the broker of record; the employer's current plan makes a placement; the date is not asked or may
-- come before the start; the words refused are not the words the form says; an agent who may see an account but not change it can't add (D-452 says anyone
-- who may see it can); a person who may not see the account adds to it, or learns it exists; an archived account takes one.
DO $$
DECLARE r jsonb; pl public.placements; n bigint;
BEGIN
  PERFORM pg_temp.as_user('acme_agent');
  r := public.renewal_add(pg_temp.id('a_agent'), 'peo_placement', '  Gusto PEO ', pg_temp.d(200), pg_temp.d(-165), pg_temp.id('acme'));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(r -> 'record' ->> 'with_whom', 'Gusto PEO', 'the PEO is trimmed');
  PERFORM pg_temp.is(r -> 'record' ->> 'kind', 'peo_placement', 'what renews');
  PERFORM pg_temp.is((r -> 'record' ->> 'version')::integer, 1, 'its version starts at 1');
  SELECT * INTO pl FROM public.placements WHERE id = (r ->> 'placement_id')::uuid;
  PERFORM pg_temp.is(pl.account_id, pg_temp.id('a_agent'), 'the placement is on the account');
  PERFORM pg_temp.is(pl.peo_name, 'Gusto PEO', 'the placement names the PEO');
  PERFORM pg_temp.is(pl.start_date, pg_temp.d(-165), 'and the start date given');
  PERFORM pg_temp.is(pl.broker_of_record, 'Acme Brokers', 'and the firm as the broker of record');
  PERFORM pg_temp.is((pl.opportunity_id IS NULL AND pl.quote_request_id IS NULL AND pl.ended_on IS NULL AND pl.commission_basis IS NULL), true, 'no opportunity, no quote, not ended, no commission');
  PERFORM pg_temp.is((SELECT placement_id FROM public.renewals WHERE id = (r -> 'record' ->> 'id')::uuid), pl.id, 'the renewal comes from it');

  PERFORM pg_temp.as_user('acme_agent');
  r := public.renewal_add(pg_temp.id('a_agent'), 'current_plan', 'Current carrier', pg_temp.d(30), NULL, pg_temp.id('acme'));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(r ->> 'placement_id', NULL, 'the employer''s current plan makes no placement');
  SELECT count(*) INTO n FROM public.placements WHERE account_id = pg_temp.id('a_agent');
  PERFORM pg_temp.is(n, 1::bigint, 'only the PEO placement is on the account');
  PERFORM pg_temp.is((SELECT count(*) FROM public.renewals WHERE account_id = pg_temp.id('a_agent')), 2::bigint, 'and two renewals');

  PERFORM pg_temp.as_user('acme_agent');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.renewal_add(%L, 'peo_placement', '   ', %L, NULL, %L)$q$, pg_temp.id('a_agent'), pg_temp.d(5), pg_temp.id('acme'))),
    '22023: Enter who the renewal is with.', 'a blank "with whom" is refused in words');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.renewal_add(%L, 'peo_placement', %L, %L, NULL, %L)$q$, pg_temp.id('a_agent'), repeat('x', 81), pg_temp.d(5), pg_temp.id('acme'))),
    '22023: Keep who it is with to 80 characters.', 'at most 80 characters');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.renewal_add(%L, 'peo_placement', 'X', NULL, NULL, %L)$q$, pg_temp.id('a_agent'), pg_temp.id('acme'))),
    '22023: Enter the renewal date.', 'the date is required');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.renewal_add(%L, 'other', 'X', %L, NULL, %L)$q$, pg_temp.id('a_agent'), pg_temp.d(5), pg_temp.id('acme'))),
    '22023: Choose what renews: a PEO placement or the employer''s current plan.', 'what renews is one of the two');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.renewal_add(%L, 'peo_placement', 'X', %L, %L, %L)$q$, pg_temp.id('a_agent'), pg_temp.d(5), pg_temp.d(5), pg_temp.id('acme'))),
    '22023: The renewal date must come after the start date.', 'the renewal comes after the start');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.renewal_add(%L, 'current_plan', 'X', %L, %L, %L)$q$, pg_temp.id('a_agent'), pg_temp.d(5), pg_temp.d(-5), pg_temp.id('acme'))),
    '22023: A start date goes with a PEO placement, not the employer''s current plan.', 'a start date goes with a PEO placement only');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.renewal_add(%L, 'current_plan', 'X', %L, NULL, %L)$q$, pg_temp.id('a_arch'), pg_temp.d(5), pg_temp.id('acme'))),
    '55000: This account is archived. Nothing can be added to it.', 'an archived account takes none');
  -- Another agent's account is as not there, the same as an account that is not.
  PERFORM pg_temp.is(left(pg_temp.refusal(format($q$SELECT public.renewal_add(%L, 'current_plan', 'X', %L, NULL, %L)$q$, pg_temp.id('a_other'), pg_temp.d(5), pg_temp.id('acme'))), 5), 'PT404',
    'an account the caller may not see is not available');
  PERFORM pg_temp.is(left(pg_temp.refusal(format($q$SELECT public.renewal_add(%L, 'current_plan', 'X', %L, NULL, %L)$q$, gen_random_uuid(), pg_temp.d(5), pg_temp.id('acme'))), 5), 'PT404',
    'and so is one that is not there');
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM pg_temp.is(left(pg_temp.refusal(format($q$SELECT public.renewal_add(%L, 'current_plan', 'X', %L, NULL, %L)$q$, pg_temp.id('a_agent'), pg_temp.d(5), pg_temp.id('zenith'))), 5), 'PT404',
    'another firm''s account is not available either');
  PERFORM pg_temp.is(left(pg_temp.refusal(format($q$SELECT public.renewal_add(%L, 'current_plan', 'X', %L, NULL, %L)$q$, pg_temp.id('a_agent'), pg_temp.d(5), pg_temp.id('acme'))), 5), '42501',
    'a person who is not a member of the firm is refused');
  -- Anyone who may see the account may add a renewal to it, though they may not change the account.
  PERFORM pg_temp.as_user('zenith_agent');
  PERFORM pg_temp.is(public.renewal_add(pg_temp.id('z1'), 'current_plan', 'Their plan', pg_temp.d(90), NULL, pg_temp.id('zenith')) -> 'record' ->> 'with_whom', 'Their plan',
    'an agent who sees an owner''s account adds a renewal to it (D-452)');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- The account's renewals, with days away (D-448, D-454) ----------
-- Break caught: days away is stored, or counted from the wrong day (in 45 days, today, 12 days ago); a past renewal not done isn't overdue; the done ones
-- sit among the open; the count is wrong; a person who may not see the account reads its renewals, or another firm's; "can change" is not the level rule's.
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.renewal_add(pg_temp.id('a_owner'), 'current_plan', 'in 45', pg_temp.d(45), NULL, pg_temp.id('acme'));
  PERFORM pg_temp.as_owner();
  INSERT INTO public.renewals (firm_id, account_id, kind, with_whom, renews_on)
    VALUES (pg_temp.id('acme'), pg_temp.id('a_owner'), 'current_plan', 'today', pg_temp.d(0)), (pg_temp.id('acme'), pg_temp.id('a_owner'), 'current_plan', 'ago', pg_temp.d(-12)),
           (pg_temp.id('acme'), pg_temp.id('a_owner'), 'current_plan', 'done', pg_temp.d(-400));
  UPDATE public.renewals SET not_renewed_on = pg_temp.d(-400) WHERE with_whom = 'done';
  PERFORM pg_temp.as_user('acme_owner');
  r := public.account_renewals(pg_temp.id('acme'), pg_temp.id('a_owner'));
  PERFORM pg_temp.is((r ->> 'count')::integer, 4, 'the count');
  PERFORM pg_temp.is((SELECT string_agg(x ->> 'with_whom', ',' ORDER BY ord) FROM jsonb_array_elements(r -> 'rows') WITH ORDINALITY t (x, ord)), 'ago,today,in 45,done',
    'not done first, nearest first (the overdue one first); the done ones after');
  PERFORM pg_temp.is((pg_temp.renewal('acme', 'a_owner', 'in 45') ->> 'days_away')::integer, 45, 'in 45 days');
  PERFORM pg_temp.is((pg_temp.renewal('acme', 'a_owner', 'today') ->> 'days_away')::integer, 0, 'today');
  PERFORM pg_temp.is((pg_temp.renewal('acme', 'a_owner', 'ago') ->> 'days_away')::integer, -12, '12 days ago');
  PERFORM pg_temp.is((pg_temp.renewal('acme', 'a_owner', 'ago') ->> 'overdue')::boolean, true, 'a past renewal not done is overdue');
  PERFORM pg_temp.is((pg_temp.renewal('acme', 'a_owner', 'today') ->> 'overdue')::boolean, false, 'today is not overdue');
  PERFORM pg_temp.is((pg_temp.renewal('acme', 'a_owner', 'done') ->> 'overdue')::boolean, false, 'a past renewal that is done is not overdue');
  PERFORM pg_temp.is(pg_temp.renewal('acme', 'a_owner', 'done') ->> 'state', 'not_renewed', 'marked "Didn''t renew" is its state');
  PERFORM pg_temp.is((pg_temp.renewal('acme', 'a_owner', 'in 45') ->> 'done')::boolean, false, 'an open renewal is not done');
  PERFORM pg_temp.is((r ->> 'can_change')::boolean, true, 'the firm''s owner can change it');
  -- The time zone of the caller decides the day: the same renewal, a day ahead of UTC.
  PERFORM pg_temp.is(((SELECT x FROM jsonb_array_elements(public.account_renewals(pg_temp.id('acme'), pg_temp.id('a_owner'), 'Pacific/Kiritimati') -> 'rows') x WHERE x ->> 'with_whom' = 'today') ->> 'days_away')::integer,
    pg_temp.today() - (now() AT TIME ZONE 'Pacific/Kiritimati')::date, 'days away follows the caller''s time zone');
  PERFORM pg_temp.as_user('acme_agent');
  PERFORM pg_temp.is(public.account_renewals(pg_temp.id('acme'), pg_temp.id('a_owner')), NULL::jsonb, 'an agent who may not see the account reads nothing, as for one that is not there');
  PERFORM pg_temp.is(public.account_renewals(pg_temp.id('acme'), pg_temp.id('a_agent')) ->> 'count', '2', 'an agent reads their own account''s');
  PERFORM pg_temp.is((public.account_renewals(pg_temp.id('acme'), pg_temp.id('a_agent')) ->> 'can_change')::boolean, true, 'and may change it');
  PERFORM pg_temp.as_user('zenith_agent');
  PERFORM pg_temp.is((public.account_renewals(pg_temp.id('zenith'), pg_temp.id('z1')) ->> 'can_add')::boolean, true, 'an agent who sees an owner''s account may add');
  PERFORM pg_temp.is((public.account_renewals(pg_temp.id('zenith'), pg_temp.id('z1')) ->> 'can_change')::boolean, false, 'but may not change it (D-452)');
  PERFORM pg_temp.is(public.account_renewals(pg_temp.id('zenith'), pg_temp.id('a_owner')), NULL::jsonb, 'another firm''s account has none to read');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is((public.account_renewals(pg_temp.id('acme'), pg_temp.id('a_arch')) ->> 'can_add')::boolean, false, 'an archived account cannot take one');
  PERFORM pg_temp.is((public.account_renewals(pg_temp.id('acme'), pg_temp.id('a_arch')) ->> 'archived')::boolean, true, 'and says why');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- Row security: who reads a renewal or a placement ----------
-- Break caught: a renewal or a placement is read by someone who may not see its account, or by another firm; an API role writes one.
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_agent');
  PERFORM pg_temp.is((SELECT count(*) FROM public.renewals WHERE account_id = pg_temp.id('a_agent')), 2::bigint, 'an agent reads the renewals of their own account');
  PERFORM pg_temp.is((SELECT count(*) FROM public.renewals WHERE account_id = pg_temp.id('a_owner')), 0::bigint, 'and none of an account they may not see');
  PERFORM pg_temp.is((SELECT count(*) FROM public.placements), 1::bigint, 'the one placement they may see');
  PERFORM pg_temp.is(pg_temp.attempt('INSERT INTO public.renewals (firm_id, account_id, kind, with_whom, renews_on) SELECT firm_id, id, ''current_plan'', ''x'', current_date FROM public.accounts LIMIT 1'), '42501', 'nobody writes a renewal through the API');
  PERFORM pg_temp.is(pg_temp.attempt('UPDATE public.placements SET peo_name = ''x'''), '42501', 'or changes a placement');
  PERFORM pg_temp.is(pg_temp.attempt('DELETE FROM public.renewals'), '42501', 'or deletes a renewal');
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM pg_temp.is((SELECT count(*) FROM public.renewals WHERE account_id IN (pg_temp.id('a_agent'), pg_temp.id('a_owner'))), 0::bigint, 'another firm reads none');
  PERFORM pg_temp.is((SELECT count(*) FROM public.renewals), 1::bigint, 'only its own renewal');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.renewals'), '42501', 'a signed-out visitor reads nothing');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.placements'), '42501', 'of either table');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- Editing, and "Didn't renew" (D-451, D-452) ----------
-- Break caught: an edit is saved without the version it started from, or over one made since without saying so; the version isn't raised; what renews can be
-- changed; an agent who may not change the account edits its renewal; "Didn't renew" doesn't end the placement or end it on the wrong day, or a day before it
-- began; Undo doesn't bring the placement back; the renewal still counts as open after it is marked.
DO $$
DECLARE rid uuid; r jsonb; v integer;
BEGIN
  PERFORM pg_temp.as_owner();
  SELECT id, version INTO rid, v FROM public.renewals WHERE account_id = pg_temp.id('a_agent') AND kind = 'peo_placement';
  INSERT INTO fx VALUES ('r_peo', rid);
  PERFORM pg_temp.as_user('acme_agent');
  r := public.renewal_update(rid, ' Gusto 2 ', pg_temp.d(210), NULL, pg_temp.id('acme'), v);
  PERFORM pg_temp.is((r ->> 'conflict')::boolean, false, 'saved');
  PERFORM pg_temp.is(r -> 'record' ->> 'with_whom', 'Gusto 2', 'with whom, trimmed');
  PERFORM pg_temp.is(r -> 'record' ->> 'renews_on', pg_temp.d(210)::text, 'the date');
  PERFORM pg_temp.is((r -> 'record' ->> 'version')::integer, v + 1, 'the version is raised');
  PERFORM pg_temp.is(public.renewal_update(rid, 'Gusto 2', pg_temp.d(210), NULL, pg_temp.id('acme'), v + 1) -> 'record' ->> 'version', (v + 1)::text, 'a save that changes nothing raises nothing');
  -- A save from the old version is a conflict, with what is there and who changed it, and changes nothing.
  r := public.renewal_update(rid, 'Mine', pg_temp.d(220), NULL, pg_temp.id('acme'), v);
  PERFORM pg_temp.is((r ->> 'conflict')::boolean, true, 'a save from an old version is a conflict');
  PERFORM pg_temp.is((r ->> 'currentVersion')::integer, v + 1, 'it names the version that is there');
  PERFORM pg_temp.is(r -> 'current' ->> 'with_whom', 'Gusto 2', 'and what is there');
  PERFORM pg_temp.is((SELECT string_agg(x ->> 'field', ',' ORDER BY x ->> 'field') FROM jsonb_array_elements(r -> 'changed') x), 'renews_on,with_whom', 'and the fields that changed since');
  PERFORM pg_temp.is((SELECT with_whom FROM public.renewals WHERE id = rid), 'Gusto 2', 'nothing was saved');
  PERFORM pg_temp.is(left(pg_temp.refusal(format($q$SELECT public.renewal_update(%L, 'X', %L, NULL, %L, NULL)$q$, rid, pg_temp.d(5), pg_temp.id('acme'))), 6), '22023:', 'a save with no version is refused');
  PERFORM pg_temp.is(left(pg_temp.refusal(format($q$SELECT public.renewal_update(%L, 'X', %L, NULL, %L, 99)$q$, rid, pg_temp.d(5), pg_temp.id('acme'))), 6), '22023:', 'and so is one naming a version it never had');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.renewal_update(%L, ' ', %L, NULL, %L, %s)$q$, rid, pg_temp.d(5), pg_temp.id('acme'), v + 1)), '22023: Enter who the renewal is with.', 'a blank "with whom" is refused');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.renewal_update(%L, 'X', %L, NULL, %L, %s)$q$, rid, pg_temp.d(-165), pg_temp.id('acme'), v + 1)),
    format('22023: The renewal date must come after the start date, %s.', to_char(pg_temp.d(-165), 'FMMon FMDD, YYYY')), 'the date must come after the placement''s start');
  -- Another firm's renewal, and an agent who may not see it.
  PERFORM pg_temp.as_user('acme_agent2');
  PERFORM pg_temp.is(left(pg_temp.refusal(format($q$SELECT public.renewal_update(%L, 'X', %L, NULL, %L, %s)$q$, rid, pg_temp.d(5), pg_temp.id('acme'), v + 1)), 5), 'PT404', 'an agent who may not see the account finds no renewal');
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM pg_temp.is(left(pg_temp.refusal(format($q$SELECT public.renewal_update(%L, 'X', %L, NULL, %L, %s)$q$, rid, pg_temp.d(5), pg_temp.id('zenith'), v + 1)), 5), 'PT404', 'another firm finds none');
  -- Seen but not changeable (zenith shows everyone everything).
  PERFORM pg_temp.as_owner();
  INSERT INTO fx SELECT 'r_z', id FROM public.renewals WHERE account_id = pg_temp.id('z1');
  PERFORM pg_temp.as_user('zenith_agent');
  PERFORM pg_temp.is(left(pg_temp.refusal(format($q$SELECT public.renewal_update(%L, 'X', %L, NULL, %L, 1)$q$, pg_temp.id('r_z'), pg_temp.d(5), pg_temp.id('zenith'))), 5), '42501', 'a person who sees it but may not change the account is refused (D-452)');
  PERFORM pg_temp.as_owner();
END $$;

DO $$
DECLARE rid uuid := pg_temp.id('r_peo'); r jsonb; v integer; pl uuid;
BEGIN
  PERFORM pg_temp.as_owner();
  SELECT version, placement_id INTO v, pl FROM public.renewals WHERE id = rid;
  PERFORM pg_temp.is(pg_temp.row_of('acme', 'a_agent') ->> 'status', 'client', 'the account is a client while the placement stands');
  PERFORM pg_temp.as_user('acme_agent');
  -- A day before the placement began is refused.
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.renewal_update(%L, 'Gusto 2', %L, %L, %L, %s)$q$, rid, pg_temp.d(210), pg_temp.d(-170), pg_temp.id('acme'), v)),
    format('22023: It can''t end before it started, %s.', to_char(pg_temp.d(-165), 'FMMon FMDD, YYYY')), 'it can''t end before it began');
  -- Didn't renew, on a day to come: the renewal is done at once, the placement ends that day, and the account is a client until then (D-520).
  r := public.renewal_update(rid, 'Gusto 2', pg_temp.d(210), pg_temp.d(30), pg_temp.id('acme'), v);
  PERFORM pg_temp.is((r ->> 'conflict')::boolean, false, 'marked "Didn''t renew"');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT ended_on FROM public.placements WHERE id = pl), pg_temp.d(30), 'the placement it came from ends on that date');
  PERFORM pg_temp.is(pg_temp.row_of('acme', 'a_agent') ->> 'status', 'client', 'a placement that ends on a day to come keeps its account a client until then (D-520)');
  PERFORM pg_temp.is(pg_temp.renewal('acme', 'a_agent', 'Gusto 2') ->> 'state', 'not_renewed', 'the renewal is not renewed');
  PERFORM pg_temp.is((pg_temp.renewal('acme', 'a_agent', 'Gusto 2') ->> 'done')::boolean, true, 'and done');
  -- On a day already past: a former client.
  PERFORM pg_temp.as_user('acme_agent');
  r := public.renewal_update(rid, 'Gusto 2', pg_temp.d(210), pg_temp.d(-1), pg_temp.id('acme'), (r -> 'record' ->> 'version')::integer);
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT ended_on FROM public.placements WHERE id = pl), pg_temp.d(-1), 'the date can be changed, and the placement follows');
  PERFORM pg_temp.is(pg_temp.row_of('acme', 'a_agent') ->> 'status', 'former_client', 'an account whose every placement has ended is a former client (D-451)');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('a_agent')), 'former_client', 'account_status says the same');
  -- Undo clears the date, which brings both back.
  PERFORM pg_temp.as_user('acme_agent');
  r := public.renewal_update(rid, 'Gusto 2', pg_temp.d(210), NULL, pg_temp.id('acme'), (r -> 'record' ->> 'version')::integer);
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT ended_on FROM public.placements WHERE id = pl), NULL::date, 'Undo brings the placement back');
  PERFORM pg_temp.is(pg_temp.row_of('acme', 'a_agent') ->> 'status', 'client', 'and the account is a client again');
  PERFORM pg_temp.is(pg_temp.renewal('acme', 'a_agent', 'Gusto 2') ->> 'state', 'open', 'and the renewal is open again');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('a_agent')), 'client', 'account_status says the same');
  -- A renewal of the employer's current plan can be marked too, and touches no placement.
  PERFORM pg_temp.as_user('acme_agent');
  SELECT x.version, x.id INTO v, rid FROM public.renewals x WHERE x.account_id = pg_temp.id('a_agent') AND x.kind = 'current_plan';
  r := public.renewal_update(rid, 'Current carrier', pg_temp.d(30), pg_temp.d(30), pg_temp.id('acme'), v);
  PERFORM pg_temp.is((r ->> 'conflict')::boolean, false, 'the employer''s current plan can be marked "Didn''t renew"');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*) FROM public.placements WHERE account_id = pg_temp.id('a_agent') AND ended_on IS NOT NULL), 0::bigint, 'and it ends no placement');
END $$;

-- The renewal's kind is not an edit: nothing can change what renews.
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.attempt('SELECT 1 FROM pg_proc WHERE proname = ''renewal_update'' AND pronargs = 6'), 'rows:1', 'one save, six arguments: no kind among them');
END $$;

-- ---------- The history and the version (D-453) ----------
-- Break caught: a renewal's creation or a change of its fields is not in its history, or is shown to a person who may not see the account; a placement's
-- end is not in its own.
DO $$
DECLARE pl uuid;
BEGIN
  PERFORM pg_temp.as_user('acme_agent');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history_list(pg_temp.id('acme'), 'renewals', pg_temp.id('r_peo')::text) WHERE kind = 'created'), 1::bigint, 'the renewal''s creation is in its history');
  PERFORM pg_temp.is((SELECT string_agg(DISTINCT field, ',' ORDER BY field) FROM public.record_history_list(pg_temp.id('acme'), 'renewals', pg_temp.id('r_peo')::text) WHERE kind = 'changed'),
    'not_renewed_on,renews_on,with_whom', 'and each change of its own fields');
  PERFORM pg_temp.as_owner();
  SELECT placement_id INTO pl FROM public.renewals WHERE id = pg_temp.id('r_peo');
  PERFORM pg_temp.as_user('acme_agent');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history_list(pg_temp.id('acme'), 'placements', pl::text) WHERE field = 'ended_on'), 3::bigint, 'the placement''s ending, the change of its day and its undoing are in its history');
  PERFORM pg_temp.as_user('acme_agent2');
  PERFORM pg_temp.is(left(pg_temp.refusal(format($q$SELECT * FROM public.record_history_list(%L, 'renewals', %L)$q$, pg_temp.id('acme'), pg_temp.id('r_peo')::text)), 5), 'PT404', 'a person who may not see the account reads no history');
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM pg_temp.is(left(pg_temp.refusal(format($q$SELECT * FROM public.record_history_list(%L, 'renewals', %L)$q$, pg_temp.id('zenith'), pg_temp.id('r_peo')::text)), 5), 'PT404', 'nor does another firm');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- Deleting a renewal (D-452) ----------
-- Break caught: a hand-made PEO renewal is deleted and leaves its placement, so the account stays a client of nothing; the placement is deleted while
-- something else stands on it; a renewal made by a win is deleted by hand; an agent who may not change the account deletes; another firm's renewal is deleted.
DO $$
DECLARE r jsonb; rid uuid; pl uuid; opp uuid; won_pl uuid;
BEGIN
  PERFORM pg_temp.as_user('acme_agent');
  r := public.renewal_add(pg_temp.id('a_agent'), 'peo_placement', 'Mistake PEO', pg_temp.d(100), pg_temp.d(-200), pg_temp.id('acme'));
  rid := (r -> 'record' ->> 'id')::uuid; pl := (r ->> 'placement_id')::uuid;
  PERFORM pg_temp.as_user('acme_agent2');
  PERFORM pg_temp.is(left(pg_temp.refusal(format($q$SELECT public.renewal_delete(%L, %L)$q$, rid, pg_temp.id('acme'))), 5), 'PT404', 'an agent who may not see it can''t delete it');
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM pg_temp.is(left(pg_temp.refusal(format($q$SELECT public.renewal_delete(%L, %L)$q$, rid, pg_temp.id('zenith'))), 5), 'PT404', 'nor can another firm');
  PERFORM pg_temp.as_user('acme_agent');
  r := public.renewal_delete(rid, pg_temp.id('acme'));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((r ->> 'deleted')::boolean, true, 'deleted');
  PERFORM pg_temp.is((r ->> 'placement_deleted')::boolean, true, 'and the placement it made with it');
  PERFORM pg_temp.is((SELECT count(*) FROM public.placements WHERE id = pl), 0::bigint, 'the placement is gone');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE table_name = 'renewals' AND record_key = rid::text), 0::bigint, 'and the renewal''s history goes with it');

  -- Seen but not changeable.
  PERFORM pg_temp.as_user('zenith_agent');
  PERFORM pg_temp.is(left(pg_temp.refusal(format($q$SELECT public.renewal_delete(%L, %L)$q$, pg_temp.id('r_z'), pg_temp.id('zenith'))), 5), '42501', 'a person who may see but not change the account is refused');

  -- A placement with a commission, or a second renewal on it, stays.
  PERFORM pg_temp.as_owner();
  INSERT INTO public.placements (firm_id, account_id, peo_name, broker_of_record, commission_basis, commission_rate, commission_yearly)
    VALUES (pg_temp.id('acme'), pg_temp.id('a_owner'), 'Paid PEO', 'Acme Brokers', 'flat_year', 1200, 1200) RETURNING id INTO pl;
  INSERT INTO public.renewals (firm_id, account_id, kind, with_whom, renews_on, placement_id)
    VALUES (pg_temp.id('acme'), pg_temp.id('a_owner'), 'peo_placement', 'Paid PEO', pg_temp.d(300), pl) RETURNING id INTO rid;
  PERFORM pg_temp.as_user('acme_owner');
  r := public.renewal_delete(rid, pg_temp.id('acme'));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((r ->> 'placement_deleted')::boolean, false, 'a placement with a commission stays');
  PERFORM pg_temp.is((SELECT count(*) FROM public.placements WHERE id = pl), 1::bigint, 'it is still there');

  -- A renewal a win made is not deleted by hand: only reopening the win removes it (D-452).
  opp := pg_temp.opportunity('o_won_del', 'a_owner', 'acme_owner');
  INSERT INTO public.placements (firm_id, account_id, opportunity_id, peo_name, broker_of_record)
    VALUES (pg_temp.id('acme'), pg_temp.id('a_owner'), opp, 'Won PEO', 'Acme Brokers') RETURNING id INTO won_pl;
  INSERT INTO public.renewals (firm_id, account_id, kind, with_whom, renews_on, placement_id)
    VALUES (pg_temp.id('acme'), pg_temp.id('a_owner'), 'peo_placement', 'Won PEO', pg_temp.d(365), won_pl) RETURNING id INTO rid;
  PERFORM pg_temp.is((pg_temp.renewal('acme', 'a_owner', 'Won PEO') ->> 'from_win')::boolean, true, 'the renewal says it came from a win');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.renewal_delete(%L, %L)$q$, rid, pg_temp.id('acme'))), 'PT409: This renewal came from a win. Reopen the win to remove it.', 'a renewal made by a win is refused');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*) FROM public.renewals WHERE id = rid), 1::bigint, 'and kept');
  -- Editing its date is allowed, for the date asked at the win can be corrected.
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(public.renewal_update(rid, 'Won PEO', pg_temp.d(366), NULL, pg_temp.id('acme'), 1) -> 'record' ->> 'renews_on', pg_temp.d(366)::text, 'its date can be edited');
  PERFORM pg_temp.as_owner();
  -- Cleanup of what these made, so later sections count what they add.
  DELETE FROM public.renewals WHERE with_whom IN ('Paid PEO', 'Won PEO');
  DELETE FROM public.placements WHERE peo_name IN ('Paid PEO', 'Won PEO');
END $$;

-- ---------- The opportunity working a renewal (D-449) ----------
-- Break caught: a renewal's opportunity is another account's; a closed opportunity works a renewal; one opportunity works two renewals; a renewal being
-- worked is worked by a second; a renewal done is worked again; a Lost opportunity leaves the renewal stuck (it should offer Start the renewal again); a
-- Won one leaves it open (it is done: Renewed); a renewal's state and the Renewal column disagree.
DO $$
DECLARE rid uuid; o1 uuid; o2 uuid; o3 uuid; ox uuid; r2 uuid; intake1 uuid; r jsonb;
BEGIN
  PERFORM pg_temp.as_owner();
  INSERT INTO public.renewals (firm_id, account_id, kind, with_whom, renews_on) VALUES (pg_temp.id('acme'), pg_temp.id('a_agent'), 'current_plan', 'Work me', pg_temp.d(60)) RETURNING id INTO rid;
  INSERT INTO public.renewals (firm_id, account_id, kind, with_whom, renews_on) VALUES (pg_temp.id('acme'), pg_temp.id('a_agent'), 'current_plan', 'Other renewal', pg_temp.d(70)) RETURNING id INTO r2;
  o1 := pg_temp.opportunity('o1', 'a_agent', 'acme_agent');
  o2 := pg_temp.opportunity('o2', 'a_agent', 'acme_agent');
  ox := pg_temp.opportunity('ox', 'a_owner', 'acme_owner');
  PERFORM pg_temp.is((pg_temp.renewal('acme', 'a_agent', 'Work me') ->> 'state'), 'open', 'nobody is working it: open');
  PERFORM pg_temp.as_user('acme_agent');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.renewal_link_opportunity(%L, %L, %L)$q$, rid, ox, pg_temp.id('acme'))), '22023: Choose an opportunity of this account.', 'an opportunity of another account can''t work it');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.renewal_link_opportunity(%L, %L, %L)$q$, rid, gen_random_uuid(), pg_temp.id('acme'))), '22023: Choose an opportunity of this account.', 'nor one that is not there');
  r := public.renewal_link_opportunity(rid, o1, pg_temp.id('acme'));
  PERFORM pg_temp.is(r -> 'record' ->> 'opportunity_id', o1::text, 'linked');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.renewal('acme', 'a_agent', 'Work me') ->> 'state', 'working', 'while the opportunity is open the renewal shows it');
  PERFORM pg_temp.is(pg_temp.renewal('acme', 'a_agent', 'Work me') -> 'opportunity' ->> 'name', 'PEO search o1', 'by name');
  PERFORM pg_temp.is(pg_temp.renewal('acme', 'a_agent', 'Work me') -> 'opportunity' ->> 'stage', 'qualifying', 'and its stage');
  PERFORM pg_temp.as_user('acme_agent');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.renewal_link_opportunity(%L, %L, %L)$q$, rid, o2, pg_temp.id('acme'))), '22023: This renewal is being worked by PEO search o1.', 'a renewal being worked is not worked by a second');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.renewal_link_opportunity(%L, %L, %L)$q$, r2, o1, pg_temp.id('acme'))), '22023: That opportunity already works another renewal.', 'one opportunity works one renewal');
  -- The opportunity is lost: the renewal shows it, and the new one replaces it.
  PERFORM pg_temp.as_owner();
  UPDATE public.opportunities SET lost_at = now(), lost_by = pg_temp.id('acme_agent') WHERE id = o1;
  PERFORM pg_temp.is(pg_temp.renewal('acme', 'a_agent', 'Work me') ->> 'state', 'lost', 'a Lost opportunity: the renewal shows "lost"');
  PERFORM pg_temp.is((pg_temp.renewal('acme', 'a_agent', 'Work me') ->> 'done')::boolean, false, 'it is not done');
  PERFORM pg_temp.is(pg_temp.row_of('acme', 'a_agent') ->> 'renewal_on', pg_temp.d(60)::text, 'and still the account''s nearest renewal (the Renewal column)');
  PERFORM pg_temp.as_user('acme_agent');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.renewal_link_opportunity(%L, %L, %L)$q$, r2, o1, pg_temp.id('acme'))), '22023: That opportunity is closed, so it can''t work a renewal.', 'a closed opportunity can''t work a renewal');
  r := public.renewal_link_opportunity(rid, o2, pg_temp.id('acme'));
  PERFORM pg_temp.is(r -> 'record' ->> 'opportunity_id', o2::text, 'Start the renewal again links the new opportunity');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE table_name = 'renewals' AND record_key = rid::text AND field = 'opportunity_id'), 2::bigint, 'each link is in the renewal''s history');
  -- Won: the renewal is done, Renewed, and leaves the column.
  intake1 := pg_temp.intake('i_renew', 'acme');
  UPDATE public.opportunities SET intake_id = intake1 WHERE id = o2;
  UPDATE public.submission_workflow SET status = 'won' WHERE session_id = intake1;
  PERFORM pg_temp.is(pg_temp.renewal('acme', 'a_agent', 'Work me') ->> 'state', 'renewed', 'a Won opportunity: Renewed');
  PERFORM pg_temp.is((pg_temp.renewal('acme', 'a_agent', 'Work me') ->> 'done')::boolean, true, 'and done');
  PERFORM pg_temp.is(pg_temp.row_of('acme', 'a_agent') ->> 'renewal_on', pg_temp.d(70)::text, 'the Renewal column moves on to the next renewal not done');
  PERFORM pg_temp.as_user('acme_agent');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.renewal_link_opportunity(%L, %L, %L)$q$, rid, o2, pg_temp.id('acme'))), '22023: That opportunity is closed, so it can''t work a renewal.', 'a won opportunity is closed');
  PERFORM pg_temp.as_owner();
  -- Marked "Didn't renew" is done too, and so refused a link.
  UPDATE public.renewals SET not_renewed_on = pg_temp.d(70) WHERE id = r2;
  o3 := pg_temp.opportunity('o3', 'a_agent', 'acme_agent');
  PERFORM pg_temp.as_user('acme_agent');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.renewal_link_opportunity(%L, %L, %L)$q$, r2, o3, pg_temp.id('acme'))), '22023: This renewal is done.', 'a renewal marked "Didn''t renew" is not worked');
  PERFORM pg_temp.as_user('acme_agent2');
  PERFORM pg_temp.is(left(pg_temp.refusal(format($q$SELECT public.renewal_link_opportunity(%L, %L, %L)$q$, r2, o3, pg_temp.id('acme'))), 5), 'PT404', 'an agent who may not see the account can''t link');
  PERFORM pg_temp.as_owner();
  -- The database refuses what the function would: an opportunity of another account, directly.
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.renewals SET opportunity_id = %L WHERE id = %L$q$, ox, rid)), '23503', 'a renewal can''t name another account''s opportunity');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.renewals SET opportunity_id = %L WHERE id = %L$q$, o3, r2)), 'rows:1', 'but its own account''s is let through');
  UPDATE public.renewals SET opportunity_id = NULL WHERE id = r2;
END $$;

-- ---------- The Renewal column and the 120-day view in the accounts table's query (D-450) ----------
-- Break caught: the column shows a renewal that is done, or the farthest instead of the nearest, or misses an overdue one; the 120-day view drops an
-- overdue renewal, includes one 121 days away, or includes an account with no renewal or only done ones; it isn't sorted by the date; a filter on the date
-- or the days is refused or matches the wrong accounts; another firm's renewal shows; a person sees the renewal of an account they may not see.
DO $$
DECLARE ids uuid;
BEGIN
  PERFORM pg_temp.as_owner();
  -- A fresh set of accounts, so nothing earlier is counted: r_soon (in 20 and in 300: the nearest shows), r_late (121 days away), r_edge (120),
  -- r_over (overdue by 9), r_none (no renewal), r_done (its only renewal is done), r_hidden (its renewal is not the agent's to see).
  PERFORM pg_temp.account('r_soon', 'acme', 'acme_owner', 'Soon');
  PERFORM pg_temp.account('r_late', 'acme', 'acme_owner', 'Late');
  PERFORM pg_temp.account('r_edge', 'acme', 'acme_owner', 'Edge');
  PERFORM pg_temp.account('r_over', 'acme', 'acme_owner', 'Over');
  PERFORM pg_temp.account('r_none', 'acme', 'acme_owner', 'None');
  PERFORM pg_temp.account('r_done', 'acme', 'acme_owner', 'Done');
  INSERT INTO public.renewals (firm_id, account_id, kind, with_whom, renews_on, not_renewed_on) VALUES
    (pg_temp.id('acme'), pg_temp.id('r_soon'), 'current_plan', 'a', pg_temp.d(300), NULL),
    (pg_temp.id('acme'), pg_temp.id('r_soon'), 'current_plan', 'b', pg_temp.d(20), NULL),
    (pg_temp.id('acme'), pg_temp.id('r_soon'), 'current_plan', 'c', pg_temp.d(5), pg_temp.d(5)),
    (pg_temp.id('acme'), pg_temp.id('r_late'), 'current_plan', 'a', pg_temp.d(121), NULL),
    (pg_temp.id('acme'), pg_temp.id('r_edge'), 'current_plan', 'a', pg_temp.d(120), NULL),
    (pg_temp.id('acme'), pg_temp.id('r_over'), 'current_plan', 'a', pg_temp.d(-9), NULL),
    (pg_temp.id('acme'), pg_temp.id('r_done'), 'current_plan', 'a', pg_temp.d(10), pg_temp.d(10));
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(pg_temp.row_of('acme', 'r_soon') ->> 'renewal_on', pg_temp.d(20)::text, 'the column is the nearest renewal not done (not the farthest, not a done one)');
  PERFORM pg_temp.is(pg_temp.row_of('acme', 'r_over') ->> 'renewal_on', pg_temp.d(-9)::text, 'an overdue renewal shows');
  PERFORM pg_temp.is(pg_temp.row_of('acme', 'r_none') ->> 'renewal_on', NULL, 'an account with none shows none');
  PERFORM pg_temp.is(pg_temp.row_of('acme', 'r_done') ->> 'renewal_on', NULL, 'and one whose only renewal is done shows none');
  -- The 120-day view: renewal_days_away less than 121, sorted by the date. a_owner's nearest is overdue by 12 days; its others are not what shows.
  PERFORM pg_temp.is(pg_temp.listed('acme', '[{"field":"renewal_days_away","op":"less_than","value":121}]', 'renewal_on', 'asc'), 'a_owner,Over,Soon,Edge',
    'Renewing in 120 days: overdue included, 120 days in, 121 out, nobody with no renewal or only done ones, sorted by the date');
  PERFORM pg_temp.is(pg_temp.listed('acme', '[{"field":"renewal_days_away","op":"less_than","value":121}]', 'renewal_on', 'desc'), 'Edge,Soon,Over,a_owner', 'and the other way round');
  PERFORM pg_temp.is(pg_temp.listed('acme', '[{"field":"renewal_days_away","op":"less_than","value":121}]', 'renewal_days_away', 'asc'), 'a_owner,Over,Soon,Edge', 'sorted by the days away is the same order');
  PERFORM pg_temp.is(pg_temp.listed('acme', '[{"field":"renewal_days_away","op":"between","value":[0,30]}]'), 'Soon', 'days away between 0 and 30');
  PERFORM pg_temp.is(pg_temp.listed('acme', format('[{"field":"renewal_on","op":"on","value":"%s"}]', pg_temp.d(120))::text), 'Edge', 'the date itself is a field: on a day');
  PERFORM pg_temp.is(pg_temp.listed('acme', '[{"field":"renewal_on","op":"in_next_days","value":30}]'), 'Soon', 'in the next 30 days (an overdue one is before today)');
  PERFORM pg_temp.is(pg_temp.listed('acme', '[{"field":"renewal_days_away","op":"more_than","value":120}]', 'name', 'asc'), 'a_agent,Late', 'more than 120 days away');
  -- The agent sees only accounts they may see, and so only their renewals.
  PERFORM pg_temp.as_user('acme_agent');
  PERFORM pg_temp.is(pg_temp.listed('acme', '[{"field":"renewal_days_away","op":"less_than","value":9999}]'), 'a_agent', 'an agent''s view holds their own accounts'' renewals only');
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM pg_temp.is(pg_temp.listed('zenith', '[{"field":"renewal_days_away","op":"less_than","value":9999}]'), 'z1', 'another firm''s holds its own');
  PERFORM pg_temp.is(pg_temp.refusal($q$SELECT pg_temp.listed('zenith', '[{"field":"renewal_days_away","op":"is_empty"}]')$q$) LIKE '22023%', true, 'a number field has no is_empty operator');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- Former client (D-197, D-451) ----------
-- Break caught: an account with a placement not ended isn't a client; one with every placement ended isn't a former client, or one with a live placement
-- is; a won opportunity with no placement (before Epic 4) isn't a client; a won opportunity whose placement has ended is still a client; a prospect becomes a
-- former client with no placement; the table's status and account_status() disagree; the status can't be filtered by the new value.
DO $$
DECLARE o_new uuid; i_old uuid; i_new uuid;
BEGIN
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.account('s_prospect', 'acme', 'acme_owner', 'Prospect');
  PERFORM pg_temp.account('s_client', 'acme', 'acme_owner', 'Client');
  PERFORM pg_temp.account('s_former', 'acme', 'acme_owner', 'Former');
  PERFORM pg_temp.account('s_mixed', 'acme', 'acme_owner', 'Mixed');
  PERFORM pg_temp.account('s_old_win', 'acme', 'acme_owner', 'OldWin');
  PERFORM pg_temp.account('s_won_ended', 'acme', 'acme_owner', 'WonEnded');
  INSERT INTO public.placements (firm_id, account_id, peo_name, broker_of_record, start_date, ended_on) VALUES
    (pg_temp.id('acme'), pg_temp.id('s_client'), 'P', 'B', pg_temp.d(-300), NULL),
    (pg_temp.id('acme'), pg_temp.id('s_former'), 'P', 'B', pg_temp.d(-300), pg_temp.d(-100)),
    (pg_temp.id('acme'), pg_temp.id('s_former'), 'Q', 'B', pg_temp.d(-90), pg_temp.d(0)),
    (pg_temp.id('acme'), pg_temp.id('s_mixed'), 'P', 'B', pg_temp.d(-300), pg_temp.d(-100)),
    (pg_temp.id('acme'), pg_temp.id('s_mixed'), 'Q', 'B', pg_temp.d(-90), pg_temp.d(40));
  -- A won opportunity from before Epic 4 has no placement; a won one with a placement that has ended does.
  i_old := pg_temp.intake('i_old_win', 'acme');
  PERFORM pg_temp.opportunity('o_old_win', 's_old_win', 'acme_owner', 'i_old_win');
  UPDATE public.submission_workflow SET status = 'won' WHERE session_id = i_old;
  i_new := pg_temp.intake('i_won_ended', 'acme');
  o_new := pg_temp.opportunity('o_won_ended', 's_won_ended', 'acme_owner', 'i_won_ended');
  UPDATE public.submission_workflow SET status = 'won' WHERE session_id = i_new;
  INSERT INTO public.placements (firm_id, account_id, opportunity_id, peo_name, broker_of_record, start_date, ended_on)
    VALUES (pg_temp.id('acme'), pg_temp.id('s_won_ended'), o_new, 'P', 'B', pg_temp.d(-300), pg_temp.d(-1));
  PERFORM pg_temp.is(pg_temp.row_of('acme', 's_prospect') ->> 'status', 'prospect', 'no placement: a prospect');
  PERFORM pg_temp.is(pg_temp.row_of('acme', 's_client') ->> 'status', 'client', 'a placement not ended: a client');
  PERFORM pg_temp.is(pg_temp.row_of('acme', 's_former') ->> 'status', 'former_client', 'every placement ended (the last today): a former client');
  PERFORM pg_temp.is(pg_temp.row_of('acme', 's_mixed') ->> 'status', 'client', 'one ended and one to end later: still a client');
  PERFORM pg_temp.is(pg_temp.row_of('acme', 's_old_win') ->> 'status', 'client', 'a won opportunity with no placement is a client (won before Epic 4)');
  PERFORM pg_temp.is(pg_temp.row_of('acme', 's_won_ended') ->> 'status', 'former_client', 'a won opportunity whose placement has ended is a former client');
  PERFORM pg_temp.is((SELECT bool_and(public.account_status(pg_temp.id(n)) = pg_temp.row_of('acme', n) ->> 'status')
    FROM unnest(ARRAY['s_prospect', 's_client', 's_former', 's_mixed', 's_old_win', 's_won_ended', 'a_agent', 'a_owner']) n), true,
    'account_status() says what the table says, for each');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(pg_temp.listed('acme', '[{"field":"status","op":"any_of","value":["former_client"]}]', 'name', 'asc'), 'Former,WonEnded', 'the status can be filtered by Former client');
  PERFORM pg_temp.is(pg_temp.refusal($q$SELECT pg_temp.listed('acme', '[{"field":"status","op":"any_of","value":["lapsed"]}]')$q$) LIKE '22023%', true, 'a status outside the list is refused');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- Deleting an account that has renewals or placements ----------
-- Break caught: an account with a renewal is deleted and its renewals are lost in silence (or the foreign key's own error is shown).
DO $$
BEGIN
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.account('d_empty', 'acme', 'acme_owner');
  PERFORM pg_temp.account('d_renewal', 'acme', 'acme_owner');
  INSERT INTO public.renewals (firm_id, account_id, kind, with_whom, renews_on) VALUES (pg_temp.id('acme'), pg_temp.id('d_renewal'), 'current_plan', 'x', pg_temp.d(5));
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.delete_account(%L, %L)$q$, pg_temp.id('d_renewal'), pg_temp.id('acme'))),
    'PT409: This account has renewals or placements, so it can''t be deleted. Archive it instead.', 'an account with a renewal is not deleted');
  PERFORM pg_temp.is((public.delete_account(pg_temp.id('d_empty'), pg_temp.id('acme')) ->> 'deleted')::boolean, true, 'an account with none still is');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- The database's own rules ----------
-- Break caught: a placement may name a quote or commission that makes no sense; an opportunity makes two placements; a PEO's name is blank; a placement
-- ends before it began; a renewal of the employer's current plan names a placement; a renewal comes from another account's placement.
DO $$
DECLARE o uuid; pl uuid;
BEGIN
  PERFORM pg_temp.as_owner();
  o := pg_temp.opportunity('o_rules', 'a_owner', 'acme_owner');
  INSERT INTO public.placements (firm_id, account_id, opportunity_id, peo_name, broker_of_record) VALUES (pg_temp.id('acme'), pg_temp.id('a_owner'), o, 'P', 'B') RETURNING id INTO pl;
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.placements (firm_id, account_id, opportunity_id, peo_name, broker_of_record) VALUES (%L, %L, %L, 'P2', 'B')$q$, pg_temp.id('acme'), pg_temp.id('a_owner'), o)), '23505', 'an opportunity makes one placement');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.placements (firm_id, account_id, peo_name, broker_of_record) VALUES (%L, %L, '  ', 'B')$q$, pg_temp.id('acme'), pg_temp.id('a_owner'))), '23514', 'a PEO has a name');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.placements (firm_id, account_id, peo_name, broker_of_record) VALUES (%L, %L, 'P', repeat('x', 121))$q$, pg_temp.id('acme'), pg_temp.id('a_owner'))), '23514', 'the broker of record is at most 120');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.placements (firm_id, account_id, peo_name, broker_of_record, start_date, ended_on) VALUES (%L, %L, 'P', 'B', current_date, current_date - 1)$q$, pg_temp.id('acme'), pg_temp.id('a_owner'))), '23514', 'a placement does not end before it started');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.placements (firm_id, account_id, peo_name, broker_of_record, commission_basis) VALUES (%L, %L, 'P', 'B', 'flat_year')$q$, pg_temp.id('acme'), pg_temp.id('a_owner'))), '23514', 'a commission basis comes with its number');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.placements (firm_id, account_id, peo_name, broker_of_record, commission_basis, commission_rate, commission_yearly) VALUES (%L, %L, 'P', 'B', 'share_of_fee', 100.01, 10)$q$, pg_temp.id('acme'), pg_temp.id('a_owner'))), '23514', 'a share is at most 100 percent');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.placements (firm_id, account_id, peo_name, broker_of_record, commission_basis, commission_rate, commission_yearly) VALUES (%L, %L, 'P', 'B', 'share_of_fee', 20, 1234.50)$q$, pg_temp.id('acme'), pg_temp.id('a_owner'))), 'rows:1', 'a share of 20 percent with its yearly figure is let through');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.placements (firm_id, account_id, peo_name, broker_of_record, commission_basis, commission_rate, commission_yearly) VALUES (%L, %L, 'P', 'B', 'per_employee_month', 0, 0)$q$, pg_temp.id('acme'), pg_temp.id('a_owner'))), '23514', 'dollars above zero');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.placements (firm_id, account_id, peo_name, broker_of_record) VALUES (%L, %L, 'P', 'B')$q$, pg_temp.id('zenith'), pg_temp.id('a_owner'))), '23503', 'a placement is on an account of its own firm');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.renewals (firm_id, account_id, kind, with_whom, renews_on, placement_id) VALUES (%L, %L, 'current_plan', 'x', current_date, %L)$q$, pg_temp.id('acme'), pg_temp.id('a_owner'), pl)), '23514', 'the employer''s current plan names no placement');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.renewals (firm_id, account_id, kind, with_whom, renews_on, placement_id) VALUES (%L, %L, 'peo_placement', 'x', current_date, %L)$q$, pg_temp.id('acme'), pg_temp.id('a_agent'), pl)), '23503', 'a renewal comes from a placement of its own account');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.renewals (firm_id, account_id, kind, with_whom, renews_on) VALUES (%L, %L, 'current_plan', ' padded ', current_date)$q$, pg_temp.id('acme'), pg_temp.id('a_owner'))), '23514', 'with whom is trimmed');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.renewals (firm_id, account_id, kind, with_whom, renews_on) VALUES (%L, %L, 'sometimes', 'x', current_date)$q$, pg_temp.id('acme'), pg_temp.id('a_owner'))), '23514', 'what renews is one of two');
  -- An opportunity's deletion clears the link and leaves the placement (CRM-O1.3a reopens through its own function).
  PERFORM pg_temp.is(pg_temp.attempt(format($q$DELETE FROM public.opportunities WHERE id = %L$q$, o)), 'rows:1', 'an opportunity can still be deleted');
END $$;

-- ---------- Closing a firm ----------
-- Break caught: closing the firm leaves its renewals or placements behind (close_a_firm.sql checks the plan's list against every firm table); the plan
-- deletes the placements after the account they stand on.
DO $$
BEGIN
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_closing_plan() p WHERE p.src IN ('public.renewals', 'public.placements') AND p.action = 'delete' AND p.firm_column = 'firm_id'), 2::bigint, 'the closing deletes both');
  PERFORM pg_temp.is((SELECT max(p.ord) FROM public.firm_closing_plan() p WHERE p.src IN ('public.renewals', 'public.placements')) < (SELECT p.ord FROM public.firm_closing_plan() p WHERE p.src = 'public.accounts'), true, 'and before the accounts');
  RAISE NOTICE 'placements_renewals: passed';
END $$;
