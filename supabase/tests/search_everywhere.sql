-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh search_everywhere
-- Search in the database (story CRM-S1.2b; docs/BROKER_CRM_BUILD.md D-24, D-28, D-43, D-44, D-185, D-186, D-187, D-214, D-219, D-226, D-227;
-- 20261119230000_search_everywhere.sql). Two firms are used throughout: Acme (sees by level) and Zenith. Proves, through what the browser calls:
--   1. what is found, by which field, of which kind, and in which order (accounts, contacts, opportunities, quotes);
--   2. what is never found: an intake's answers (FEIN, census, chamber answers);
--   3. five per kind and whether there are more; every word must match; odd input is only letters;
--   4. who is found: by level, with two firms' probes, and one firm at a time;
--   5. recent records: per person and per firm, moved to the top, capped, shown only while seen, none for support, deleted when a firm closes;
--   6. a firm of thousands answers reading a few rows.
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
\i supabase/migrations/20261119180000_calls_notes_tasks.sql
\i supabase/migrations/20261119230000_search_everywhere.sql


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
SET client_min_messages = notice;

SET client_min_messages = notice;

-- What the search shows of one kind: the records' own names (a quote's PEO), in the order given.
CREATE FUNCTION pg_temp.sr(u text, addr text, q text, firm text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE j jsonb;
BEGIN
  PERFORM pg_temp.as_user(u, addr);
  j := public.search_records(CASE WHEN firm IS NULL THEN NULL ELSE pg_temp.id(firm) END, q);
  RETURN j;
END $$;
CREATE FUNCTION pg_temp.names(j jsonb, kind text) RETURNS text[] LANGUAGE sql AS $$
  SELECT COALESCE(array_agg(COALESCE(r ->> 'peo_name', r ->> 'name') ORDER BY n), '{}')
  FROM jsonb_array_elements(j -> kind -> 'rows') WITH ORDINALITY AS t (r, n)
$$;
-- The four kinds at once, as 'accounts: a, b | contacts: ... | opportunities: ... | quotes: ...' for a failure message and a compact check.
CREATE FUNCTION pg_temp.all4(j jsonb) RETURNS text LANGUAGE sql AS $$
  SELECT 'accounts: ' || array_to_string(pg_temp.names(j, 'accounts'), ', ') || ' | contacts: ' || array_to_string(pg_temp.names(j, 'contacts'), ', ')
      || ' | opportunities: ' || array_to_string(pg_temp.names(j, 'opportunities'), ', ') || ' | quotes: ' || array_to_string(pg_temp.names(j, 'quotes'), ', ')
$$;
CREATE FUNCTION pg_temp.none(j jsonb) RETURNS boolean LANGUAGE sql AS $$
  SELECT pg_temp.all4(j) = 'accounts:  | contacts:  | opportunities:  | quotes: '
$$;

-- ---------- set up: two firms; Acme sees by level; teams; one person in both firms; one whose membership ended ----------
DO $$
DECLARE acme uuid; zenith uuid; sales uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Acme Brokers', 'acme-brokers', now()) RETURNING id INTO acme;
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Zenith Benefits', 'zenith-benefits', now()) RETURNING id INTO zenith;
  INSERT INTO fx VALUES ('acme', acme), ('zenith', zenith);
  PERFORM pg_temp.new_user('acme_owner'); PERFORM pg_temp.new_user('acme_lead'); PERFORM pg_temp.new_user('acme_agent1'); PERFORM pg_temp.new_user('acme_agent2');
  PERFORM pg_temp.new_user('acme_agent3'); PERFORM pg_temp.new_user('acme_removed'); PERFORM pg_temp.new_user('zenith_owner'); PERFORM pg_temp.new_user('both');
  PERFORM pg_temp.new_user('platform_admin'); PERFORM pg_temp.new_user('nobody');
  INSERT INTO public.firm_teams (firm_id, name) VALUES (acme, 'Sales') RETURNING id INTO sales;
  INSERT INTO public.firm_memberships (firm_id, user_id, role, team_id) VALUES
    (acme, pg_temp.id('acme_owner'), 'owner', NULL), (acme, pg_temp.id('acme_lead'), 'lead', sales), (acme, pg_temp.id('acme_agent1'), 'agent', NULL),
    (acme, pg_temp.id('acme_agent2'), 'agent', sales), (acme, pg_temp.id('acme_agent3'), 'agent', NULL), (acme, pg_temp.id('both'), 'owner', NULL),
    (zenith, pg_temp.id('zenith_owner'), 'owner', NULL), (zenith, pg_temp.id('both'), 'agent', NULL);
  INSERT INTO public.firm_memberships (firm_id, user_id, role, valid_from, valid_until)
  VALUES (acme, pg_temp.id('acme_removed'), 'agent', now() - interval '3 days', now() - interval '1 day');
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('platform_admin'), 'admin');
END $$;

-- An account with the fields a search reads, made as the superuser; named in fx by its first argument.
CREATE FUNCTION pg_temp.acct(n text, firm text, p_owner text, p_name text, p_trade text DEFAULT NULL, p_site text DEFAULT NULL, p_phone text DEFAULT NULL,
                             p_archived boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r uuid;
BEGIN
  INSERT INTO public.accounts (source, firm_id, owner_id, name, trade_name, website, phone, archived_at)
  VALUES ('added_by_hand', pg_temp.id(firm), pg_temp.id(p_owner), p_name, p_trade, p_site, p_phone, CASE WHEN p_archived THEN now() END) RETURNING id INTO r;
  INSERT INTO fx VALUES (n, r);
  RETURN r;
END $$;
CREATE FUNCTION pg_temp.cont(n text, p_account text, p_first text, p_last text, p_email text DEFAULT NULL, p_phone text DEFAULT NULL, p_mobile text DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE r uuid;
BEGIN
  INSERT INTO public.contacts (firm_id, account_id, first_name, last_name, email, phone, mobile)
  SELECT a.firm_id, a.id, p_first, p_last, p_email, p_phone, p_mobile FROM public.accounts a WHERE a.id = pg_temp.id(p_account) RETURNING id INTO r;
  INSERT INTO fx VALUES (n, r);
  RETURN r;
END $$;
-- An opportunity, with an intake of its own (the intake holds a FEIN and a census, which no search may find) and the PEOs asked for a quote.
CREATE FUNCTION pg_temp.opp(n text, p_account text, p_name text, p_file text DEFAULT NULL, p_peos text[] DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r uuid; i uuid; peo text;
BEGIN
  IF p_file IS NOT NULL THEN
    i := pg_temp.intake('intake_' || n, (SELECT CASE WHEN a.firm_id = pg_temp.id('acme') THEN 'acme' ELSE 'zenith' END FROM public.accounts a WHERE a.id = pg_temp.id(p_account)));
    SET LOCAL session_replication_role = replica;   -- the File ID is the database's (20261104120000); a fixture places one
    UPDATE public.chamber_sessions SET file_id = p_file,
      chamber_data = jsonb_build_object('company_name', 'Answers Only Inc', 'fein', '123456789', 'current_carrier', 'Quokka Mutual', 'key_challenges', 'Holdings trouble',
                                        'census', jsonb_build_array(jsonb_build_object('first_name', 'Zorblax', 'last_name', 'Employee', 'dob', '1980-01-01')))
    WHERE id = i;
    SET LOCAL session_replication_role = origin;
  END IF;
  INSERT INTO public.opportunities (firm_id, account_id, name, intake_id)
  SELECT a.firm_id, a.id, p_name, i FROM public.accounts a WHERE a.id = pg_temp.id(p_account) RETURNING id INTO r;
  FOREACH peo IN ARRAY p_peos LOOP
    INSERT INTO public.quote_requests (session_id, peo_name, status, sent_on) VALUES (i, peo, 'sent', date '2026-10-01');
  END LOOP;
  INSERT INTO fx VALUES (n, r);
  RETURN r;
END $$;

DO $$
BEGIN
  PERFORM pg_temp.acct('alpine', 'acme', 'acme_agent1', 'Alpine Roofing', 'Summit Roof Co', 'https://www.alpine-roof.com/about', '(503) 555-0142');
  PERFORM pg_temp.acct('beta', 'acme', 'acme_agent2', 'Beta Bakery', NULL, 'betabakery.example', '541-555-0100');
  PERFORM pg_temp.acct('gamma', 'acme', 'acme_agent3', 'Gamma Gravel', NULL, NULL, NULL, true);
  PERFORM pg_temp.acct('nobody_acct', 'acme', NULL, 'Nobody Nursery');
  PERFORM pg_temp.acct('archive', 'acme', 'acme_agent1', 'Alpine Archive Ltd', NULL, NULL, NULL, true);
  PERFORM pg_temp.acct('pct', 'acme', 'acme_owner', '100% Roofing');
  PERFORM pg_temp.acct('under', 'acme', 'acme_owner', 'Under_score Inc');
  PERFORM pg_temp.acct('underless', 'acme', 'acme_owner', 'Underscore Inc');
  PERFORM pg_temp.acct('crew' || n, 'acme', 'acme_owner', 'Crew Mountain ' || n) FROM generate_series(1, 7) n;
  PERFORM pg_temp.cont('casey', 'alpine', 'Casey', 'Contactson', 'casey@alpine-roof.com', '503-555-0199', '541 555 0177');
  PERFORM pg_temp.cont('bella', 'beta', 'Bella', 'Baker', 'bella@betabakery.example');
  PERFORM pg_temp.opp('alpine_opp', 'alpine', 'Alpine 2027 renewal', 'NV-4821', ARRAY['Paychex Prime', 'Gusto Select']);
  PERFORM pg_temp.opp('beta_opp', 'beta', 'Beta payroll search');

  PERFORM pg_temp.acct('zen_twin', 'zenith', 'zenith_owner', 'Alpine Zenith Twin', NULL, 'https://www.alpine-roof.com', '(503) 555-0142');
  PERFORM pg_temp.acct('zen_both', 'zenith', 'both', 'Zenith Both Co');
  PERFORM pg_temp.cont('zen_casey', 'zen_twin', 'Casey', 'Zenith', 'casey@alpine-roof.com');
  PERFORM pg_temp.opp('zen_opp', 'zen_twin', 'Zenith only search', 'NV-9955', ARRAY['Zenith Only PEO']);
END $$;
ANALYZE public.accounts, public.contacts, public.opportunities, public.quote_requests, public.chamber_sessions;

-- ---------- what is found, and by which field ----------
-- Break caught: a field is left out of the search (name, business, email, phone in any marks, web domain, File ID, PEO), the account's contacts, opportunities and
-- quotes are not found by their business, a word is case-sensitive, a web address finds nothing, or a word typed in another order finds nothing.
DO $$
DECLARE r text;
BEGIN
  r := pg_temp.all4(pg_temp.sr('acme_owner', 'acme-brokers', 'alpine'));
  PERFORM pg_temp.is(r, 'accounts: Alpine Roofing, Alpine Archive Ltd | contacts: Casey Contactson | opportunities: Alpine 2027 renewal | quotes: Gusto Select, Paychex Prime',
                     'the business name finds the account (live before archived), and its contact, opportunity and quotes');
  PERFORM pg_temp.is(pg_temp.all4(pg_temp.sr('acme_owner', 'acme-brokers', 'ALPINE roofing')), 'accounts: Alpine Roofing | contacts: Casey Contactson | opportunities: Alpine 2027 renewal | quotes: Gusto Select, Paychex Prime', 'in any case');
  PERFORM pg_temp.is(pg_temp.all4(pg_temp.sr('acme_owner', 'acme-brokers', 'roofing alpine')), pg_temp.all4(pg_temp.sr('acme_owner', 'acme-brokers', 'alpine roofing')), 'and any order');
  PERFORM pg_temp.is(pg_temp.none(pg_temp.sr('acme_owner', 'acme-brokers', 'alpine bakery')), true, 'every word must be found');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.sr('acme_owner', 'acme-brokers', 'summit'), 'accounts'), ARRAY['Alpine Roofing'], 'a trade name finds the account');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.sr('acme_owner', 'acme-brokers', 'alpine-roof.com'), 'accounts'), ARRAY['Alpine Roofing'], 'a web domain finds the account');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.sr('acme_owner', 'acme-brokers', 'https://www.alpine-roof.com/about'), 'accounts'), ARRAY['Alpine Roofing'], 'a web address finds it by its domain');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.sr('acme_owner', 'acme-brokers', 'www.alpine-roof.com'), 'contacts'), ARRAY['Casey Contactson'], 'and its contacts');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.sr('acme_owner', 'acme-brokers', '555-0142'), 'accounts'), ARRAY['Alpine Roofing'], 'a phone finds the account');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.sr('acme_owner', 'acme-brokers', '5035550142'), 'accounts'), ARRAY['Alpine Roofing'], 'whatever its marks');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.sr('acme_owner', 'acme-brokers', '(503) 555-0142'), 'accounts'), ARRAY['Alpine Roofing'], 'typed whole');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.sr('acme_owner', 'acme-brokers', '503-555-0199'), 'contacts'), ARRAY['Casey Contactson'], 'a contact''s phone finds the contact');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.sr('acme_owner', 'acme-brokers', '5415550177'), 'contacts'), ARRAY['Casey Contactson'], 'and its mobile');
  PERFORM pg_temp.is(pg_temp.all4(pg_temp.sr('acme_owner', 'acme-brokers', 'casey@alpine-roof.com')), 'accounts:  | contacts: Casey Contactson | opportunities:  | quotes: ', 'an email finds the contact only');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.sr('acme_owner', 'acme-brokers', 'Contactson'), 'contacts'), ARRAY['Casey Contactson'], 'a contact''s name finds it');
  PERFORM pg_temp.is(pg_temp.all4(pg_temp.sr('acme_owner', 'acme-brokers', 'NV-4821')), 'accounts:  | contacts:  | opportunities: Alpine 2027 renewal | quotes: Gusto Select, Paychex Prime', 'a File ID finds its opportunity and quotes');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.sr('acme_owner', 'acme-brokers', 'nv-48'), 'opportunities'), ARRAY['Alpine 2027 renewal'], 'in part and in lower case');
  PERFORM pg_temp.is(pg_temp.all4(pg_temp.sr('acme_owner', 'acme-brokers', 'paychex')), 'accounts:  | contacts:  | opportunities: Alpine 2027 renewal | quotes: Paychex Prime', 'a PEO finds its quote and the opportunity it is asked on');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.sr('acme_owner', 'acme-brokers', 'renewal'), 'opportunities'), ARRAY['Alpine 2027 renewal'], 'an opportunity''s name finds it');
  PERFORM pg_temp.is((pg_temp.sr('acme_owner', 'acme-brokers', 'alpine') -> 'accounts' -> 'rows' -> 1 ->> 'archived')::boolean, true, 'an archived account says so');
  PERFORM pg_temp.is((pg_temp.sr('acme_owner', 'acme-brokers', 'alpine') -> 'opportunities' -> 'rows' -> 0 ->> 'file_id'), 'NV-4821', 'an opportunity shows its File ID');
  RAISE NOTICE 'search_everywhere: what is found passed';
END $$;

-- ---------- what is never found: an intake's answers ----------
-- Break caught: the search reads an intake's answers (the FEIN, a census name, a chamber answer, the company name the employer typed) as well as the CRM's fields.
DO $$
DECLARE w text;
BEGIN
  RESET ROLE;
  FOREACH w IN ARRAY ARRAY['123456789', '12345678', '3456789', 'zorblax', 'employee', '1980-01-01', 'quokka', 'holdings', 'answers only', 'fein'] LOOP
    PERFORM pg_temp.is(pg_temp.none(pg_temp.sr('acme_owner', 'acme-brokers', w)), true, 'the intake''s answer "' || w || '" finds nothing: ' || pg_temp.all4(pg_temp.sr('acme_owner', 'acme-brokers', w)));
  END LOOP;
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_sessions WHERE chamber_data::text LIKE '%Zorblax%'), 2::bigint, 'control: the answers are there to be found');
  RAISE NOTICE 'search_everywhere: no answers passed';
END $$;

-- ---------- five per kind, odd input ----------
-- Break caught: more than five rows of a kind, "more" wrong; one character searched; % and _ and \ act as wildcards; a quote in the words is run as SQL.
DO $$
DECLARE j jsonb;
BEGIN
  j := pg_temp.sr('acme_owner', 'acme-brokers', 'mountain');
  PERFORM pg_temp.is(pg_temp.names(j, 'accounts'), ARRAY['Crew Mountain 1', 'Crew Mountain 2', 'Crew Mountain 3', 'Crew Mountain 4', 'Crew Mountain 5'], 'five accounts, in name order');
  PERFORM pg_temp.is((j -> 'accounts' ->> 'more')::boolean, true, 'and there are more');
  j := pg_temp.sr('acme_owner', 'acme-brokers', 'mountain 7');
  PERFORM pg_temp.is(pg_temp.names(j, 'accounts'), ARRAY['Crew Mountain 7'], 'every word narrows');
  PERFORM pg_temp.is((j -> 'accounts' ->> 'more')::boolean, false, 'with no more');
  j := pg_temp.sr('acme_owner', 'acme-brokers', 'crew');
  PERFORM pg_temp.is(jsonb_array_length(j -> 'accounts' -> 'rows'), 5, 'a kind is cut at five on its own');
  PERFORM pg_temp.is(jsonb_array_length(j -> 'contacts' -> 'rows'), 0, 'the others are not');
  PERFORM pg_temp.is(pg_temp.none(pg_temp.sr('acme_owner', 'acme-brokers', 'a')), true, 'one character finds nothing');
  PERFORM pg_temp.is(pg_temp.none(pg_temp.sr('acme_owner', 'acme-brokers', '   ')), true, 'nor spaces');
  PERFORM pg_temp.is(pg_temp.none(pg_temp.sr('acme_owner', 'acme-brokers', '')), true, 'nor nothing');
  PERFORM pg_temp.is(pg_temp.none(pg_temp.sr('acme_owner', 'acme-brokers', NULL)), true, 'nor null');
  PERFORM pg_temp.is(pg_temp.sr('acme_owner', 'acme-brokers', '') ? 'quotes', true, 'the answer keeps its four groups');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.sr('acme_owner', 'acme-brokers', '100%'), 'accounts'), ARRAY['100% Roofing'], '% is a letter');
  PERFORM pg_temp.is(pg_temp.none(pg_temp.sr('acme_owner', 'acme-brokers', '%%')), true, 'two of them find nothing');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.sr('acme_owner', 'acme-brokers', 'under_score'), 'accounts'), ARRAY['Under_score Inc'], '_ is a letter');
  PERFORM pg_temp.is(pg_temp.none(pg_temp.sr('acme_owner', 'acme-brokers', '\\')), true, 'a backslash alone finds nothing');
  PERFORM pg_temp.is(pg_temp.none(pg_temp.sr('acme_owner', 'acme-brokers', $q$'; DROP TABLE public.accounts; --$q$)), true, 'SQL typed in is only letters');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE firm_id = pg_temp.id('acme')) > 10, true, 'and the table is there');
  PERFORM pg_temp.is(pg_temp.none(pg_temp.sr('acme_owner', 'acme-brokers', repeat('x', 5000))), true, 'a very long search is cut, not refused');
  RAISE NOTICE 'search_everywhere: five per kind and odd input passed';
END $$;

-- ---------- who is found ----------
-- Break caught: a member finds what their level hides (an agent finds a colleague's account, contact, opportunity or quote), a lead misses their team's, an unowned
-- account is found by an agent, a search reads another firm (a second firm's account, contact, File ID or PEO), or a firm that is not named by the address is searched.
DO $$
DECLARE who text; a record; seen boolean; found boolean; j jsonb;
BEGIN
  PERFORM pg_temp.is(pg_temp.all4(pg_temp.sr('acme_agent1', 'acme-brokers', 'alpine')),
                     'accounts: Alpine Roofing, Alpine Archive Ltd | contacts: Casey Contactson | opportunities: Alpine 2027 renewal | quotes: Gusto Select, Paychex Prime', 'an agent finds their own');
  PERFORM pg_temp.is(pg_temp.none(pg_temp.sr('acme_agent1', 'acme-brokers', 'beta')), true, 'but not a colleague''s account, contact or opportunity');
  PERFORM pg_temp.is(pg_temp.none(pg_temp.sr('acme_agent1', 'acme-brokers', 'bakery')), true, 'by its business either');
  PERFORM pg_temp.is(pg_temp.none(pg_temp.sr('acme_agent1', 'acme-brokers', 'nobody')), true, 'nor an account no one owns');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.sr('acme_owner', 'acme-brokers', 'nobody'), 'accounts'), ARRAY['Nobody Nursery'], 'an owner does');
  PERFORM pg_temp.is(pg_temp.none(pg_temp.sr('acme_agent2', 'acme-brokers', 'alpine')), true, 'an agent of another team finds none of it');
  PERFORM pg_temp.is(pg_temp.all4(pg_temp.sr('acme_agent2', 'acme-brokers', 'beta')), 'accounts: Beta Bakery | contacts: Bella Baker | opportunities: Beta payroll search | quotes: ', 'and their own');
  PERFORM pg_temp.is(pg_temp.all4(pg_temp.sr('acme_lead', 'acme-brokers', 'beta')), 'accounts: Beta Bakery | contacts: Bella Baker | opportunities: Beta payroll search | quotes: ', 'a lead finds their team''s');
  PERFORM pg_temp.is(pg_temp.none(pg_temp.sr('acme_lead', 'acme-brokers', 'alpine')), true, 'and not another team''s');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.sr('acme_owner', 'acme-brokers', 'gamma'), 'accounts'), ARRAY['Gamma Gravel'], 'an owner finds an archived account');
  -- Firm by firm.
  PERFORM pg_temp.is(pg_temp.none(pg_temp.sr('acme_owner', 'acme-brokers', 'zenith')), true, 'Acme''s owner finds no account of Zenith''s');
  PERFORM pg_temp.is(pg_temp.none(pg_temp.sr('acme_owner', 'acme-brokers', 'NV-9955')), true, 'nor its File ID');
  PERFORM pg_temp.is(pg_temp.none(pg_temp.sr('acme_owner', 'acme-brokers', 'Zenith Only PEO')), true, 'nor its PEO');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.sr('acme_owner', 'acme-brokers', '555-0142'), 'accounts'), ARRAY['Alpine Roofing'], 'a phone both firms hold finds only Acme''s');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.sr('acme_owner', 'acme-brokers', 'casey'), 'contacts'), ARRAY['Casey Contactson'], 'and a contact''s email too');
  PERFORM pg_temp.is(pg_temp.all4(pg_temp.sr('zenith_owner', 'zenith-benefits', 'alpine')), 'accounts: Alpine Zenith Twin | contacts: Casey Zenith | opportunities: Zenith only search | quotes: Zenith Only PEO', 'Zenith''s owner finds Zenith''s');
  PERFORM pg_temp.is(pg_temp.none(pg_temp.sr('zenith_owner', 'zenith-benefits', 'NV-4821')), true, 'and none of Acme''s File IDs');
  PERFORM pg_temp.is(pg_temp.none(pg_temp.sr('zenith_owner', 'zenith-benefits', 'paychex')), true, 'or PEOs');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.search_records(%L, 'alpine')$q$, pg_temp.id('zenith'))) LIKE '42501:%', true, 'naming another firm is refused');
  PERFORM pg_temp.as_user('both');
  PERFORM pg_temp.is(pg_temp.refusal('SELECT public.search_records(NULL, ''alpine'')') LIKE '22023:%', true, 'a person in two firms must say which');
  PERFORM pg_temp.as_user('both', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.names(public.search_records(NULL, 'zenith'), 'accounts'), ARRAY['Zenith Both Co'], 'the address says which, and an agent finds their own account there');
  PERFORM pg_temp.is(pg_temp.none(public.search_records(NULL, 'alpine')), true, 'and not the owner''s');
  PERFORM pg_temp.as_user('both', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.names(public.search_records(NULL, 'alpine'), 'accounts'), ARRAY['Alpine Roofing', 'Alpine Archive Ltd'], 'at Acme the same person is an owner');
  PERFORM pg_temp.as_user('acme_removed', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal('SELECT public.search_records(NULL, ''alpine'')') LIKE '42501:%', true, 'a member whose membership ended finds nothing');
  PERFORM pg_temp.as_user('nobody');
  PERFORM pg_temp.is(pg_temp.refusal('SELECT public.search_records(NULL, ''alpine'')') LIKE '42501:%', true, 'a person in no firm finds nothing');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.search_records(NULL, 'alpine')$q$), '42501', 'a visitor may not search');
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.search_records(NULL, 'alpine')$q$), '42501', 'nor the service role');
  -- Search finds exactly the accounts row security shows, for every person and every account of Acme.
  FOREACH who IN ARRAY ARRAY['acme_owner', 'acme_lead', 'acme_agent1', 'acme_agent2', 'acme_agent3', 'both'] LOOP
    FOR a IN SELECT f.name AS fx, x.name AS nm, x.id FROM fx f JOIN public.accounts x ON x.id = f.id WHERE x.firm_id = pg_temp.id('acme') ORDER BY x.name LOOP
      PERFORM pg_temp.as_user(who, 'acme-brokers');
      seen := EXISTS (SELECT 1 FROM public.accounts t WHERE t.id = a.id);
      j := public.search_records(NULL, a.nm);
      found := EXISTS (SELECT 1 FROM jsonb_array_elements(j -> 'accounts' -> 'rows') r WHERE r ->> 'id' = a.id::text);
      PERFORM pg_temp.is(found, seen, who || ' searching for "' || a.nm || '" finds it exactly when row security shows it');
    END LOOP;
  END LOOP;
  RESET ROLE;
  RAISE NOTICE 'search_everywhere: who is found passed';
END $$;

-- ---------- each person's recent records ----------
-- Break caught: a record is noted that the person may not see (so noting tells whether it exists), another firm's or another person's list is shown, opening
-- again does not move a record to the top, more than 20 are kept, a record the person can no longer see is still shown, an archived one is dropped, or the
-- list takes a kind or a number that is no record's.
CREATE FUNCTION pg_temp.recent(u text, addr text, lim integer DEFAULT 5) RETURNS text[] LANGUAGE plpgsql AS $$
DECLARE j jsonb;
BEGIN
  PERFORM pg_temp.as_user(u, addr);
  j := public.my_recent_records(NULL, lim);
  RETURN COALESCE((SELECT array_agg(COALESCE(r ->> 'peo_name', r ->> 'name') ORDER BY n) FROM jsonb_array_elements(j -> 'rows') WITH ORDINALITY AS t (r, n)), '{}');
END $$;
CREATE FUNCTION pg_temp.note(u text, addr text, kind text, id text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_temp.as_user(u, addr);
  RETURN public.note_recent_record(kind, id, NULL)::text;
END $$;
CREATE FUNCTION pg_temp.stored(u text, firm text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  RESET ROLE;
  SELECT count(*) INTO n FROM public.recent_records r WHERE r.user_id = pg_temp.id(u) AND r.firm_id = pg_temp.id(firm);
  RETURN n;
END $$;
CREATE FUNCTION pg_temp.qid(peo text) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$ SELECT q.id::text FROM public.quote_requests q WHERE q.peo_name = peo $$;

DO $$
DECLARE r text; ids text[]; n integer;
BEGIN
  PERFORM pg_temp.is(pg_temp.recent('acme_owner', 'acme-brokers'), '{}'::text[], 'nothing is recent at first');
  PERFORM pg_temp.is(pg_temp.note('acme_owner', 'acme-brokers', 'account', pg_temp.id('alpine')::text), 'true', 'opening an account notes it');
  PERFORM pg_temp.is(pg_temp.note('acme_owner', 'acme-brokers', 'contact', pg_temp.id('casey')::text), 'true', 'and a contact');
  PERFORM pg_temp.is(pg_temp.recent('acme_owner', 'acme-brokers'), ARRAY['Casey Contactson', 'Alpine Roofing'], 'newest first');
  PERFORM pg_temp.is(pg_temp.note('acme_owner', 'acme-brokers', 'account', pg_temp.id('alpine')::text), 'true', 'opening one again');
  PERFORM pg_temp.is(pg_temp.recent('acme_owner', 'acme-brokers'), ARRAY['Alpine Roofing', 'Casey Contactson'], 'moves it to the top');
  PERFORM pg_temp.is(pg_temp.stored('acme_owner', 'acme'), 2::bigint, 'without a second row');
  PERFORM pg_temp.note('acme_owner', 'acme-brokers', 'opportunity', pg_temp.id('alpine_opp')::text);
  PERFORM pg_temp.is(pg_temp.note('acme_owner', 'acme-brokers', 'quote', pg_temp.qid('Paychex Prime')), 'true', 'and a quote, by its number');
  PERFORM pg_temp.is(pg_temp.recent('acme_owner', 'acme-brokers'), ARRAY['Paychex Prime', 'Alpine 2027 renewal', 'Alpine Roofing', 'Casey Contactson'], 'each as the box shows it');
  PERFORM pg_temp.is(pg_temp.recent('acme_owner', 'acme-brokers', 2), ARRAY['Paychex Prime', 'Alpine 2027 renewal'], 'as many as asked');
  r := (public.my_recent_records(NULL, 1) -> 'rows' -> 0 ->> 'opened_at');
  PERFORM pg_temp.is(r IS NOT NULL, true, 'each says when it was opened');
  -- per person and per firm
  PERFORM pg_temp.is(pg_temp.recent('acme_agent1', 'acme-brokers'), '{}'::text[], 'another person has none of them');
  PERFORM pg_temp.is(pg_temp.note('acme_agent1', 'acme-brokers', 'account', pg_temp.id('alpine')::text), 'true', 'an agent notes their own');
  PERFORM pg_temp.is(pg_temp.recent('acme_agent1', 'acme-brokers'), ARRAY['Alpine Roofing'], 'and has their own list');
  PERFORM pg_temp.is(pg_temp.note('acme_agent1', 'acme-brokers', 'account', pg_temp.id('beta')::text), 'false', 'a colleague''s account is not noted');
  PERFORM pg_temp.is(pg_temp.note('acme_agent1', 'acme-brokers', 'contact', pg_temp.id('bella')::text), 'false', 'nor its contact');
  PERFORM pg_temp.is(pg_temp.note('acme_agent1', 'acme-brokers', 'opportunity', pg_temp.id('beta_opp')::text), 'false', 'nor its opportunity');
  PERFORM pg_temp.is(pg_temp.note('acme_agent1', 'acme-brokers', 'account', gen_random_uuid()::text), 'false', 'a record that is not there says the same');
  PERFORM pg_temp.is(pg_temp.note('acme_agent1', 'acme-brokers', 'account', pg_temp.id('zen_twin')::text), 'false', 'another firm''s account is not noted');
  PERFORM pg_temp.is(pg_temp.note('acme_owner', 'acme-brokers', 'quote', pg_temp.qid('Zenith Only PEO')), 'false', 'nor its quote');
  PERFORM pg_temp.is(pg_temp.note('acme_owner', 'acme-brokers', 'account', pg_temp.id('zen_both')::text), 'false', 'even for an owner of another firm''s address');
  PERFORM pg_temp.is(pg_temp.stored('acme_agent1', 'acme'), 1::bigint, 'and nothing was stored for them');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.note_recent_record('lead', %L, NULL)$q$, pg_temp.id('alpine'))) LIKE '22023:%', true, 'a kind that is not one is refused');
  PERFORM pg_temp.is(pg_temp.refusal($q$SELECT public.note_recent_record('account', 'not a number', NULL)$q$) LIKE '22023:%', true, 'and a number that is no record''s');
  PERFORM pg_temp.is(pg_temp.refusal($q$SELECT public.note_recent_record('quote', '12x', NULL)$q$) LIKE '22023:%', true, 'a quote''s too');
  PERFORM pg_temp.is(pg_temp.refusal($q$SELECT public.my_recent_records(NULL, 0)$q$) LIKE '22023:%', true, 'a list of none is refused');
  PERFORM pg_temp.is(pg_temp.refusal($q$SELECT public.my_recent_records(NULL, 21)$q$) LIKE '22023:%', true, 'and of more than 20');
  -- per firm: the person in two firms
  PERFORM pg_temp.is(pg_temp.note('both', 'acme-brokers', 'account', pg_temp.id('alpine')::text), 'true', 'an owner at Acme notes an account');
  PERFORM pg_temp.is(pg_temp.note('both', 'zenith-benefits', 'account', pg_temp.id('zen_both')::text), 'true', 'and an agent at Zenith their own');
  PERFORM pg_temp.is(pg_temp.note('both', 'zenith-benefits', 'account', pg_temp.id('zen_twin')::text), 'false', 'not another''s there');
  PERFORM pg_temp.is(pg_temp.recent('both', 'acme-brokers'), ARRAY['Alpine Roofing'], 'each firm has its own list (Acme)');
  PERFORM pg_temp.is(pg_temp.recent('both', 'zenith-benefits'), ARRAY['Zenith Both Co'], 'each firm has its own list (Zenith)');
  PERFORM pg_temp.is(pg_temp.stored('both', 'acme'), 1::bigint, 'one stored at Acme');
  PERFORM pg_temp.is(pg_temp.stored('both', 'zenith'), 1::bigint, 'one at Zenith');
  -- closed to the API
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.recent_records'), '42501', 'the table is not read through the API');
  PERFORM pg_temp.is(pg_temp.attempt('INSERT INTO public.recent_records (firm_id, user_id, kind, record_id) SELECT firm_id, user_id, kind, record_id FROM public.recent_records'), '42501', 'nor written');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.my_recent_records(NULL, 5)$q$), '42501', 'a visitor has none');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.note_recent_record('account', 'x', NULL)$q$), '42501', 'and notes none');
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.my_recent_records(NULL, 5)$q$), '42501', 'the service role has none');
  RESET ROLE;
  RAISE NOTICE 'search_everywhere: recent records passed';
END $$;

-- ---------- the last twenty; shown only while seen ----------
-- Break caught: the cap is not kept (or keeps the oldest), a record that was handed to a colleague, deleted or moved is still listed, a hidden record uses up
-- the five asked for, or an archived account drops out.
DO $$
DECLARE i integer;
BEGIN
  PERFORM pg_temp.acct('cap' || n, 'acme', 'acme_owner', 'Cap Fodder ' || lpad(n::text, 2, '0')) FROM generate_series(1, 25) n;
  FOR i IN 1..25 LOOP
    PERFORM pg_temp.note('acme_owner', 'acme-brokers', 'account', pg_temp.id('cap' || i)::text);
  END LOOP;
  PERFORM pg_temp.is(pg_temp.stored('acme_owner', 'acme'), 20::bigint, 'only the last 20 of a person in a firm are kept');
  PERFORM pg_temp.is(pg_temp.recent('acme_owner', 'acme-brokers'), ARRAY['Cap Fodder 25', 'Cap Fodder 24', 'Cap Fodder 23', 'Cap Fodder 22', 'Cap Fodder 21'], 'the newest five');
  PERFORM pg_temp.is(cardinality(pg_temp.recent('acme_owner', 'acme-brokers', 20)), 20, 'and 20 when asked');
  PERFORM pg_temp.is((pg_temp.recent('acme_owner', 'acme-brokers', 20))[20], 'Cap Fodder 06', 'with the oldest dropped');
  PERFORM pg_temp.is(pg_temp.stored('acme_agent1', 'acme'), 1::bigint, 'and another person''s are not pruned');
  -- Handed to a colleague: the agent no longer sees it, and the next record fills the five.
  PERFORM pg_temp.acct('handover', 'acme', 'acme_agent1', 'Handover Ltd');
  PERFORM pg_temp.note('acme_agent1', 'acme-brokers', 'account', pg_temp.id('handover')::text);
  PERFORM pg_temp.is(pg_temp.recent('acme_agent1', 'acme-brokers'), ARRAY['Handover Ltd', 'Alpine Roofing'], 'a record the person owns is listed');
  RESET ROLE;
  UPDATE public.accounts SET owner_id = pg_temp.id('acme_agent2') WHERE id = pg_temp.id('handover');
  PERFORM pg_temp.is(pg_temp.recent('acme_agent1', 'acme-brokers'), ARRAY['Alpine Roofing'], 'handed to a colleague, it is not shown');
  PERFORM pg_temp.is(pg_temp.stored('acme_agent1', 'acme'), 2::bigint, 'though the row stays');
  RESET ROLE;
  UPDATE public.accounts SET owner_id = pg_temp.id('acme_agent1') WHERE id = pg_temp.id('handover');
  PERFORM pg_temp.is(pg_temp.recent('acme_agent1', 'acme-brokers'), ARRAY['Handover Ltd', 'Alpine Roofing'], 'handed back, it is shown again');
  RESET ROLE;
  UPDATE public.accounts SET archived_at = now() WHERE id = pg_temp.id('handover');
  PERFORM pg_temp.is(pg_temp.recent('acme_agent1', 'acme-brokers'), ARRAY['Handover Ltd', 'Alpine Roofing'], 'an archived account is still shown');
  PERFORM pg_temp.is((public.my_recent_records(NULL, 1) -> 'rows' -> 0 ->> 'archived')::boolean, true, 'and says so');
  RESET ROLE;
  UPDATE public.accounts SET archived_at = NULL WHERE id = pg_temp.id('handover');
  -- A contact follows its account's owner; a deleted record is passed over.
  PERFORM pg_temp.note('acme_agent1', 'acme-brokers', 'contact', pg_temp.id('casey')::text);
  PERFORM pg_temp.is(pg_temp.recent('acme_agent1', 'acme-brokers', 1), ARRAY['Casey Contactson'], 'the contact is the newest');
  RESET ROLE;
  UPDATE public.accounts SET owner_id = pg_temp.id('acme_agent2') WHERE id = pg_temp.id('alpine');
  PERFORM pg_temp.is(pg_temp.recent('acme_agent1', 'acme-brokers', 2), ARRAY['Handover Ltd'], 'an account moved away takes its contact with it, and the five go on');
  RESET ROLE;
  UPDATE public.accounts SET owner_id = pg_temp.id('acme_agent1') WHERE id = pg_temp.id('alpine');
  DELETE FROM public.accounts WHERE id = pg_temp.id('handover');
  PERFORM pg_temp.is(pg_temp.recent('acme_agent1', 'acme-brokers'), ARRAY['Casey Contactson', 'Alpine Roofing'], 'a deleted account is not shown');
  RAISE NOTICE 'search_everywhere: the last twenty passed';
END $$;

-- ---------- Nevermore support ----------
-- Break caught: a support session cannot read what a member reads (at the firm's address), reads at another address, notes a recent record, or is shown one.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); n bigint;
BEGIN
  RESET ROLE;
  INSERT INTO public.support_sessions (firm_id, admin_id, admin_email, reason, started_at, ends_at)
  VALUES (acme, pg_temp.id('platform_admin'), 'platform_admin@example.test', 'Looking at a stuck quote', now(), now() + interval '1 hour');
  n := (SELECT count(*) FROM public.recent_records);
  PERFORM pg_temp.is(pg_temp.all4(pg_temp.sr('platform_admin', 'acme-brokers', 'alpine', 'acme')),
                     'accounts: Alpine Roofing, Alpine Archive Ltd | contacts: Casey Contactson | opportunities: Alpine 2027 renewal | quotes: Gusto Select, Paychex Prime', 'a support session reads what an owner reads, at the firm''s address');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.sr('platform_admin', 'acme-brokers', 'nobody', 'acme'), 'accounts'), ARRAY['Nobody Nursery'], 'unowned records too');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.note_recent_record('account', %L, %L)$q$, pg_temp.id('alpine'), acme)), 'PT423: Nevermore support can look, not change', 'it notes nothing');
  PERFORM pg_temp.as_user('platform_admin', 'acme-brokers');
  PERFORM pg_temp.is(public.my_recent_records(acme, 5) -> 'rows', '[]'::jsonb, 'and is shown none');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.recent_records), n, 'no row was written');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.search_records(%L, 'alpine')$q$, acme)) LIKE '42501:%', true, 'on the bare domain it finds none');
  PERFORM pg_temp.as_user('platform_admin', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.search_records(%L, 'alpine')$q$, acme)) LIKE '42501:%', true, 'nor at another firm''s address');
  RESET ROLE;
  DELETE FROM public.support_sessions WHERE firm_id = acme;
  RAISE NOTICE 'search_everywhere: support passed';
END $$;

-- ---------- a firm that is closing; closing deletes the recent records ----------
-- Break caught: a closing firm still notes recent records (ADR 0023), closing leaves a person's recent records behind, or the closing's list loses a line it had.
DO $$
DECLARE c uuid; ids text; kept bigint;
BEGIN
  RESET ROLE;
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Closing Co', 'closing-co', now()) RETURNING id INTO c;
  INSERT INTO fx VALUES ('closing', c);
  PERFORM pg_temp.new_user('closer');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (c, pg_temp.id('closer'), 'owner');
  PERFORM pg_temp.acct('closing_acct', 'closing', 'closer', 'Closing Account');
  PERFORM pg_temp.is(pg_temp.note('closer', 'closing-co', 'account', pg_temp.id('closing_acct')::text), 'true', 'before the request, a record is noted');
  PERFORM public.request_firm_closure(c, 'Closing Co');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.note_recent_record('account', %L, NULL)$q$, pg_temp.id('closing_acct'))) LIKE 'PT%', true, 'a closing firm notes nothing more');
  PERFORM pg_temp.is(pg_temp.recent('closer', 'closing-co'), ARRAY['Closing Account'], 'but it can still read and search (read-only)');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.sr('closer', 'closing-co', 'closing'), 'accounts'), ARRAY['Closing Account'], 'search too');
  RESET ROLE;
  UPDATE public.firm_closures SET asked_at = asked_at - interval '40 days', closes_at = closes_at - interval '40 days' WHERE firm_id = c AND withdrawn_at IS NULL AND closed_at IS NULL;
  SET LOCAL ROLE service_role;
  PERFORM public.close_firm_now(c);
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.recent_records WHERE firm_id = c), 0::bigint, 'closing the firm deleted its recent records');
  PERFORM pg_temp.is((SELECT count(*) FROM public.recent_records WHERE firm_id = pg_temp.id('acme')) > 0, true, 'and no other firm''s');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_closing_plan()), 47::bigint, 'the closing''s list has every line it had, and this one');
  PERFORM pg_temp.is((SELECT action FROM public.firm_closing_plan() WHERE src = 'public.recent_records'), 'delete', 'recent records are deleted');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_closing_plan() WHERE src IN ('public.activities', 'public.accounts', 'public.contacts', 'public.opportunities', 'public.record_history', 'public.referral_partners') AND action = 'delete'), 6::bigint, 'with the others still deleted');
  RAISE NOTICE 'search_everywhere: closing passed';
END $$;

-- ---------- a firm of thousands answers fast, and a small firm reads a few rows, not every firm's ----------
-- Break caught: the search scans a kind (an index that does not lead with the firm, a planner override, a join of whole tables), so a firm of 10 accounts reads
-- every firm's accounts, contacts, opportunities, quotes and intakes: asked by what each table gives up. A second firm holds 3,000 accounts, each with a
-- contact and an opportunity, and 400 quotes on one intake; Acme's owner searches for a word one Acme account holds, and each table must give up only a few
-- rows (a scan of the big firm gives 3,000). The big firm's own owner then searches for a rare and for a common word within half a second.
CREATE FUNCTION pg_temp.rows_read(t text) RETURNS bigint LANGUAGE sql AS $$
  SELECT s.seq_tup_read + COALESCE(s.idx_tup_fetch, 0) FROM pg_stat_xact_user_tables s WHERE s.relid = ('public.' || t)::regclass
$$;
DO $$
DECLARE big uuid; i uuid; t text; q text; before bigint; used bigint; j jsonb; started timestamptz; ms numeric; limit_ms numeric;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.acct('zebra', 'acme', 'acme_owner', 'Zebra Farm', NULL, 'zebrafarm.example', '(971) 555-0111');
  PERFORM pg_temp.cont('zebra_c', 'zebra', 'Zed', 'Zebrowski', 'zed@zebrafarm.example');
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Big Brokers', 'big-brokers', now()) RETURNING id INTO big;
  INSERT INTO fx VALUES ('big', big);
  PERFORM pg_temp.new_user('big_owner');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (big, pg_temp.id('big_owner'), 'owner');
  INSERT INTO public.accounts (source, firm_id, owner_id, name, website, phone)
  SELECT 'import', big, pg_temp.id('big_owner'), 'Big Account ' || lpad(n::text, 4, '0') || CASE WHEN n = 1234 THEN ' Quokkarama' ELSE '' END,
         'https://big' || n || '.example', '(503) 555-' || lpad(n::text, 4, '0')
  FROM generate_series(1, 3000) n;
  INSERT INTO public.contacts (firm_id, account_id, first_name, last_name, email) SELECT big, a.id, 'Bob', 'Big contact', 'bob-' || a.id || '@big.example' FROM public.accounts a WHERE a.firm_id = big;
  INSERT INTO public.opportunities (firm_id, account_id, name) SELECT big, a.id, 'Big search ' || a.name FROM public.accounts a WHERE a.firm_id = big;
  i := pg_temp.intake('big_intake', 'big');
  SET LOCAL session_replication_role = replica;
  UPDATE public.chamber_sessions SET file_id = 'NV-7777' WHERE id = i;
  SET LOCAL session_replication_role = origin;
  UPDATE public.opportunities SET intake_id = i WHERE id = (SELECT o.id FROM public.opportunities o WHERE o.firm_id = big ORDER BY o.account_id LIMIT 1);
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_on) SELECT i, 'Big PEO ' || n, 'sent', date '2026-10-01' FROM generate_series(1, 400) n;
  ANALYZE public.accounts; ANALYZE public.contacts; ANALYZE public.opportunities; ANALYZE public.quote_requests; ANALYZE public.chamber_sessions;

  PERFORM set_config('enable_seqscan', 'off', true);
  PERFORM set_config('plan_cache_mode', 'force_generic_plan', true);
  PERFORM pg_temp.is(pg_temp.names(pg_temp.sr('acme_owner', 'acme-brokers', 'zebra'), 'accounts'), ARRAY['Zebra Farm'], 'a rare word is found (and the plan is made)');
  FOREACH q IN ARRAY ARRAY['zebra', 'zebrafarm.example', '555-0111', 'zed@zebrafarm', 'NV-4821', 'paychex', 'zebrowski zed'] LOOP
    FOREACH t IN ARRAY ARRAY['accounts', 'contacts', 'opportunities', 'quote_requests', 'chamber_sessions'] LOOP
      PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
      PERFORM public.search_records(NULL, q);
      before := pg_temp.rows_read(t);
      PERFORM public.search_records(NULL, q);
      used := pg_temp.rows_read(t) - before;
      PERFORM pg_temp.is(used < 250, true, 'searching for "' || q || '" in a small firm read ' || used || ' rows of ' || t || ', not every firm''s');
    END LOOP;
  END LOOP;
  -- The measure sees a scan: the big firm's own count of contacts reads its 3,000.
  RESET ROLE;
  before := pg_temp.rows_read('contacts');
  PERFORM count(*) FROM public.contacts c WHERE c.firm_id = big;
  PERFORM pg_temp.is(pg_temp.rows_read('contacts') - before >= 3000, true, 'a scan of the big firm''s contacts is seen by the count');

  PERFORM set_config('enable_seqscan', 'on', true);
  PERFORM set_config('plan_cache_mode', 'auto', true);
  -- A word few records hold is found through the index (about 30 ms); a word every one of the 3,000 accounts, contacts and opportunities holds must be read
  -- and put in order whole (about half a second), and still comes in under a second.
  FOREACH q IN ARRAY ARRAY['quokkarama', 'big1234.example', '555-1234', 'NV-7777', 'big peo 17', 'quokkarama big', 'big account', 'big', 'bob big'] LOOP
    PERFORM pg_temp.as_user('big_owner', 'big-brokers');
    PERFORM public.search_records(NULL, q);
    started := clock_timestamp();
    j := public.search_records(NULL, q);
    ms := extract(epoch FROM clock_timestamp() - started) * 1000;
    limit_ms := CASE WHEN q IN ('big account', 'big', 'bob big') THEN 1000 ELSE 250 END;
    PERFORM pg_temp.is(ms < limit_ms, true, 'the big firm''s search for "' || q || '" took ' || round(ms) || ' ms, over ' || limit_ms);
    RAISE NOTICE 'search_everywhere: the big firm''s search for "%" took % ms', q, round(ms);
  END LOOP;
  PERFORM pg_temp.is(pg_temp.names(pg_temp.sr('big_owner', 'big-brokers', 'quokkarama'), 'accounts'), ARRAY['Big Account 1234 Quokkarama'], 'the big firm finds its rare word');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.sr('big_owner', 'big-brokers', '555-1234'), 'accounts'), ARRAY['Big Account 1234 Quokkarama'], 'and its phone');
  RESET ROLE;
  RAISE NOTICE 'search_everywhere: few rows read passed';
END $$;

DO $$ BEGIN RAISE NOTICE 'search_everywhere: all passed'; END $$;
