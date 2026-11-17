-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh account_page
-- An account's page, the database side (story CRM-A2.1a; docs/BROKER_CRM_BUILD.md D-24, D-28, D-33, D-44, D-46, D-186, D-187, D-197, D-199, D-206, D-209,
-- D-211, D-212, D-213, D-216; 20261119140000_account_page.sql; the tabs' pages, CRM-A2.1b, 20261119145000_account_tab.sql). The level rule for changes, the page's one read (the account, each tab's count and first
-- five rows), the Files list, the save of an account's own fields with its version, and a submission's account. Two firms are used throughout: Acme sees
-- by level, Zenith shows everyone everything. Every migration is loaded, in filename order (D-105), this story's last.
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
\i supabase/migrations/20261120111000_accounts_status_one_read.sql
\i supabase/migrations/20261120120000_opportunity_page.sql
\i supabase/migrations/20261120121000_won_lost_commission.sql
\i supabase/migrations/20261120130000_opportunity_create.sql
\i supabase/migrations/20261121085500_leads.sql
\i supabase/migrations/20261121090000_spot_a_duplicate.sql
\i supabase/migrations/20261121095500_create_lead.sql
\i supabase/migrations/20261121100000_merge_records.sql
\i supabase/migrations/20261121110000_account_page_duplicate_mark.sql
\i supabase/migrations/20261121110500_leads_table_query.sql
\i supabase/migrations/20261121140000_leads_keep_commission_history.sql
\i supabase/migrations/20261121150000_epic4_after_merge_records.sql
\i supabase/migrations/20261121160000_start_the_renewal.sql
\i supabase/migrations/20261121170000_opportunity_outcome.sql
\i supabase/migrations/20261122090000_conversations.sql
\i supabase/migrations/20261122100000_peo_authorizations.sql
\i supabase/migrations/20261122100500_conversations_closing.sql
\i supabase/migrations/20261122110000_bundle_links.sql
\i supabase/migrations/20261122130000_conversation_replies.sql
\i supabase/migrations/20261122130500_closing_list_merged.sql
\i supabase/migrations/20261122140000_peo_send.sql
\i supabase/migrations/20261122150000_inbox.sql
\i supabase/migrations/20261122160000_conversation_files.sql
\i supabase/migrations/20261122180000_peo_update.sql
\i supabase/migrations/20261122190000_follow_up_and_withdraw.sql
\i supabase/migrations/20261122200000_peo_registrations.sql
\i supabase/migrations/20261122200500_main_merged.sql
\i supabase/migrations/20261122210000_leads_bulk_and_bin.sql
\i supabase/migrations/20261122220000_lead_page.sql
\i supabase/migrations/20261122230000_request_contact.sql
\i supabase/migrations/20261122240000_lead_alert_and_captcha.sql
\i supabase/migrations/20261122250000_convert_lead.sql
\i supabase/migrations/20261123090000_opportunity_close_withdraw.sql
\i supabase/migrations/20261123100000_quote_statuses.sql
\i supabase/migrations/20261123110000_firm_link.sql
\i supabase/migrations/20261123130000_new_quote_account.sql
\i supabase/migrations/20261123190000_intake_teaches_account.sql
\i supabase/migrations/20261123200000_employer_ends_access.sql
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

-- ---------- the level rule ----------
-- Break caught: the rule that says who may change a record is read from the firm's visibility setting (so "everyone sees everything" lets an agent change a
-- colleague's record); an agent changes a colleague's record; a lead reaches an agent outside their team or a record with no owner; a lead does not reach
-- the team under theirs, or a lead is given a record whose owner has left even from the lead's own team (also in a firm that shows everyone everything); an
-- owner is refused a record with no owner or one whose owner left; a person who is no member of the firm, a former member, a platform
-- admin or Nevermore support changes anything; or no API role can run it by hand (it is the write functions' to ask, and the page answers it as can_change).
-- The rule is asked as each person, with the superuser's rights, as a write function asks it.
CREATE FUNCTION pg_temp.may_change(who text, firm text, p_owner text) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE r boolean;
BEGIN
  IF who = 'signed_out' THEN PERFORM pg_temp.as_owner(); ELSE PERFORM pg_temp.claims_of(who); END IF;
  r := public.can_change_firm_record(pg_temp.id(firm), pg_temp.id(p_owner));
  RESET ROLE;
  RETURN r;
END $$;

DO $$
DECLARE
  c record;
  sess uuid;
BEGIN
  -- caller, firm, owner of the record, whether the caller may change it. A null owner is "no owner".
  FOR c IN SELECT * FROM (VALUES
    -- an owner: the firm's, those with no owner and those whose owner left
    ('acme_owner', 'acme', 'acme_agent1', true), ('acme_owner', 'acme', 'acme_lead', true), ('acme_owner', 'acme', 'acme_owner', true),
    ('acme_owner', 'acme', NULL, true), ('acme_owner', 'acme', 'acme_removed', true), ('acme_owner', 'acme', 'zenith_agent', true),
    -- an agent: their own and nothing else
    ('acme_agent1', 'acme', 'acme_agent1', true), ('acme_agent1', 'acme', 'acme_agent3', false), ('acme_agent1', 'acme', 'acme_agent2', false),
    ('acme_agent1', 'acme', 'acme_lead', false), ('acme_agent1', 'acme', 'acme_owner', false), ('acme_agent1', 'acme', NULL, false),
    ('acme_agent1', 'acme', 'acme_removed', false),
    ('acme_agent2', 'acme', 'acme_agent2', true), ('acme_agent2', 'acme', 'acme_lead', false), ('acme_agent2', 'acme', 'acme_west', false),
    ('acme_west', 'acme', 'acme_west', true), ('acme_west', 'acme', 'acme_agent2', false),
    -- a lead: their own, their team's and the teams under it; not an agent with no team, another lead, an owner, no owner, or someone who left
    ('acme_lead', 'acme', 'acme_lead', true), ('acme_lead', 'acme', 'acme_agent2', true), ('acme_lead', 'acme', 'acme_west', true),
    ('acme_lead', 'acme', 'acme_agent1', false), ('acme_lead', 'acme', 'acme_agent3', false), ('acme_lead', 'acme', 'acme_lead2', false),
    ('acme_lead', 'acme', 'acme_owner', false), ('acme_lead', 'acme', NULL, false), ('acme_lead', 'acme', 'acme_removed', false),
    ('acme_lead', 'acme', 'acme_gone', false),
    ('acme_lead2', 'acme', 'acme_lead2', true), ('acme_lead2', 'acme', 'acme_agent2', false), ('acme_lead2', 'acme', 'acme_west', false),
    ('acme_lead2', 'acme', NULL, false),
    -- a firm that shows everyone everything: seeing is not changing
    ('zenith_agent', 'zenith', 'zenith_agent', true), ('zenith_agent', 'zenith', 'zenith_agent2', false), ('zenith_agent', 'zenith', 'zenith_owner', false),
    ('zenith_agent', 'zenith', NULL, false), ('zenith_lead', 'zenith', 'zenith_lead', true), ('zenith_lead', 'zenith', 'zenith_agent', false),
    ('zenith_lead', 'zenith', NULL, false), ('zenith_lead', 'zenith', 'zenith_gone', false), ('zenith_owner', 'zenith', 'zenith_gone', true), ('zenith_owner', 'zenith', 'zenith_agent', true), ('zenith_owner', 'zenith', NULL, true),
    -- nobody else
    ('zenith_owner', 'acme', 'acme_agent1', false), ('zenith_owner', 'acme', NULL, false), ('zenith_agent', 'acme', 'zenith_agent', false),
    ('acme_removed', 'acme', 'acme_removed', false), ('acme_removed', 'acme', NULL, false), ('platform_admin', 'acme', 'acme_agent1', false),
    ('platform_admin', 'acme', NULL, false), ('nobody', 'acme', 'nobody', false), ('nobody', 'acme', NULL, false), ('signed_out', 'acme', 'acme_agent1', false),
    ('signed_out', 'acme', NULL, false)
  ) AS t (who, firm, owner, want) LOOP
    PERFORM pg_temp.is(pg_temp.may_change(c.who, c.firm, c.owner), c.want,
      c.who || ' changing a record of ' || c.firm || ' that ' || COALESCE(c.owner, 'nobody') || ' owns');
  END LOOP;

  -- A firm named by nobody (NULL) is no firm: nothing is changeable.
  PERFORM pg_temp.claims_of('acme_owner');
  PERFORM pg_temp.is(public.can_change_firm_record(NULL, pg_temp.id('acme_agent1')), false, 'no firm, nothing to change');
  PERFORM pg_temp.is(public.can_change_firm_record(gen_random_uuid(), NULL), false, 'a firm that does not exist neither');
  RESET ROLE;

  -- Closed to every API role.
  PERFORM pg_temp.as_user('acme_owner', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.can_change_firm_record(%L, NULL)$q$, pg_temp.id('acme'))), '42501', 'no API role runs the rule by hand');
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.can_change_firm_record(%L, NULL)$q$, pg_temp.id('acme'))), '42501', 'the service role neither');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.can_change_firm_record(%L, NULL)$q$, pg_temp.id('acme'))), '42501', 'nor a signed-out caller');
  RESET ROLE;

  -- Nevermore support (ADR 0024) reads what an owner reads and changes nothing: the rule says no to a platform admin with an open session, at the address.
  PERFORM pg_temp.as_user('platform_admin');
  sess := (SELECT t.session_id FROM public.start_support_session(pg_temp.id('acme'), 'Looking at an account the firm asked about') t);
  PERFORM pg_temp.as_user('platform_admin', 'acme-brokers');
  PERFORM pg_temp.is(public.firm_role(pg_temp.id('acme')), 'support', 'the session is open at the address');
  PERFORM pg_temp.is(public.can_see_firm_record(pg_temp.id('acme'), NULL), true, 'support sees a record with no owner, as an owner does');
  -- (the rule is asked with the superuser's rights and the same claims and header, as a write function asks it)
  RESET ROLE;
  PERFORM pg_temp.is(public.can_change_firm_record(pg_temp.id('acme'), NULL), false, 'but may not change one');
  PERFORM pg_temp.is(public.can_change_firm_record(pg_temp.id('acme'), pg_temp.id('acme_agent1')), false, 'nor one an agent owns');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.end_support_session(sess);
  RESET ROLE;
  RAISE NOTICE 'account_page: the level rule passed';
END $$;

-- ---------- an account with everything on its page ----------
-- Harborview Dental Group (a1), agent1's, made from an employer's intake that came by Kline CPA's link: seven contacts (Elena Marsh the main one), seven
-- opportunities (one holding an intake that is sent to PEOs with three quote requests, one holding an intake that is lost with two, and five with none),
-- files on its two intakes, and a history of its own. A second account (a2) is agent2's, in the team Sales, with nothing on it; a3 has no owner.
CREATE FUNCTION pg_temp.intake_via(n text, firm text, referral text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := pg_temp.new_user('p_' || n); sid uuid;
BEGIN
  INSERT INTO public.chamber_sessions (user_id, chamber_data, referral_code) VALUES (uid, jsonb_build_object('company_name', n), referral) RETURNING id INTO sid;
  UPDATE public.chamber_sessions SET firm_id = pg_temp.id(firm) WHERE id = sid;
  INSERT INTO fx VALUES (n, sid);
  RETURN sid;
END $$;

CREATE FUNCTION pg_temp.document(n text, p_intake text, p_verdict text, p_name text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r uuid; sid uuid := pg_temp.id(p_intake); uid uuid;
BEGIN
  SELECT user_id INTO uid FROM public.chamber_sessions WHERE id = sid;
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, category, size_bytes, mime_type, scan_verdict, extraction, created_at)
  VALUES (uid, sid, p_name, '1 KB', uid || '/' || sid || '/' || p_name, 'other', 1024, 'text/csv', p_verdict, jsonb_build_object('secret', 'zz-read-out-of-a-file'),
          now() - (SELECT count(*) FROM public.documents) * interval '1 minute')
  RETURNING id INTO r;
  INSERT INTO fx VALUES (n, r);
  RETURN r;
END $$;

DO $$
DECLARE
  acme uuid := pg_temp.id('acme'); a1 uuid; i1 uuid; i2 uuid; k int;
BEGIN
  UPDATE auth.users SET raw_user_meta_data = jsonb_build_object('full_name', 'Dana Reyes') WHERE id = pg_temp.id('acme_agent1');
  INSERT INTO public.referral_partners (firm_id, code, name, kind) VALUES (acme, 'kline-cpa', 'Kline CPA', 'accounting');
  a1 := pg_temp.account('a1', 'acme', 'acme_agent1', 'Harborview Dental Group', 'https://www.HarborviewDental.example/about', 'employer_intake');
  UPDATE public.accounts SET trade_name = 'Harborview Dental', phone = '(503) 555-0140', street = '410 SW Alder St', city = 'Portland',
    state = 'OR', postal_code = '97204', industry = 'Dental practice', employees = 45, states_of_operation = ARRAY['OR', 'WA'], current_provider = 'Payroll vendor, carrier health plan'
  WHERE id = a1;
  PERFORM pg_temp.account('a2', 'acme', 'acme_agent2', 'Second Account');
  PERFORM pg_temp.account('a3', 'acme', NULL, 'Nobody''s Account');
  PERFORM pg_temp.account('za', 'zenith', 'zenith_agent', 'Zenith Account');
  PERFORM pg_temp.contact('c1', 'a1', 'acme_agent1', 'elena@harborview.example', '(503) 555-0142', true);
  UPDATE public.contacts SET first_name = 'Elena', last_name = 'Marsh', title = 'Practice Manager' WHERE id = pg_temp.id('c1');
  PERFORM pg_temp.contact('c2', 'a1', 'acme_agent1', 'owen@harborview.example', '(503) 555-0140');
  UPDATE public.contacts SET first_name = 'Owen', last_name = 'Park', title = 'Owner', do_not_email = true WHERE id = pg_temp.id('c2');
  FOR k IN 3..7 LOOP
    PERFORM pg_temp.contact('c' || k, 'a1', 'acme_agent1', 'c' || k || '@harborview.example');
    UPDATE public.contacts SET first_name = 'Staff', last_name = 'Abel ' || k WHERE id = pg_temp.id('c' || k);
  END LOOP;
  i1 := pg_temp.intake_via('i1', 'acme', 'kline-cpa');
  i2 := pg_temp.intake_via('i2', 'acme', NULL);
  PERFORM pg_temp.opportunity('o1', 'a1', 'acme_agent1', 'i1', 'c1');
  UPDATE public.opportunities SET name = 'January 2027 PEO search', target_start = '2027-01-01', created_at = now() - interval '10 days' WHERE id = pg_temp.id('o1');
  PERFORM pg_temp.opportunity('o2', 'a1', 'acme_agent1', 'i2', 'c1');
  UPDATE public.opportunities SET name = '2025 PEO search', target_start = '2025-01-01' WHERE id = pg_temp.id('o2');
  FOR k IN 3..7 LOOP
    PERFORM pg_temp.opportunity('o' || k, 'a1', 'acme_agent1');
  END LOOP;
  UPDATE public.opportunities SET name = 'A search with no start' WHERE id = pg_temp.id('o3');
  UPDATE public.submission_workflow SET status = 'sent_to_carrier' WHERE session_id = i1;
  UPDATE public.submission_workflow SET status = 'lost' WHERE session_id = i2;
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_on, quote_received_on, quote_expires_on) VALUES
    (i1, 'PEO A', 'quoted', '2026-10-29', '2026-11-03', '2026-12-05'), (i1, 'PEO B', 'sent', '2026-11-06', NULL, NULL), (i1, 'PEO C', 'sent', '2026-11-06', NULL, NULL),
    (i2, 'PEO A', 'quoted', '2024-11-01', '2024-11-10', '2024-12-10'), (i2, 'PEO D', 'declined', '2024-11-01', NULL, NULL);
  -- Files: three that passed on the first intake and one on the second; and one of each of the others, which are never listed.
  PERFORM pg_temp.document('f1', 'i1', 'clean', 'census.csv');
  PERFORM pg_temp.document('f2', 'i1', 'clean', 'loss-runs.pdf');
  PERFORM pg_temp.document('f3', 'i1', 'clean', 'invoice.pdf');
  PERFORM pg_temp.document('f4', 'i2', 'clean', 'old-census.csv');
  PERFORM pg_temp.document('fp', 'i1', 'pending', 'waiting.pdf');
  PERFORM pg_temp.document('fi', 'i1', 'infected', 'infected.pdf');
  PERFORM pg_temp.document('ff', 'i1', 'failed', 'failed.pdf');
  PERFORM pg_temp.document('fs', 'i1', 'skipped', 'unscanned.pdf');
  -- A document of an intake no opportunity of the account holds is not the account's.
  PERFORM pg_temp.intake_via('i3', 'acme', NULL);
  PERFORM pg_temp.document('fx', 'i3', 'clean', 'someone-elses.pdf');
END $$;

CREATE FUNCTION pg_temp.page(who text, firm text, account text, addr text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  IF who = 'anon' THEN PERFORM pg_temp.as_anon(); ELSE PERFORM pg_temp.as_user(who, addr); END IF;
  r := public.account_page(pg_temp.id(firm), COALESCE(pg_temp.id(account), gen_random_uuid()));
  RESET ROLE;
  RETURN r;
END $$;

-- ---------- the page: what it holds ----------
-- Break caught: the account's details are missing a field the page draws, its status or source is not worked out, its owner is an id and no name, or a tab
-- has the wrong count, rows that are not its own, rows in the wrong order, more than five rows, or something the page must not show (what was read out of a
-- file, a file that did not pass the check, a file of another intake); a Renewals tab is there (D-186).
DO $$
DECLARE p jsonb;
BEGIN
  p := pg_temp.page('acme_agent1', 'acme', 'a1');
  PERFORM pg_temp.is(jsonb_typeof(p), 'object', 'the owner of an account gets its page');
  PERFORM pg_temp.is((SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(p) k), 'account,can_change,tabs', 'whose parts are the account, whether the person may change it and the tabs');
  PERFORM pg_temp.is((SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(p -> 'tabs') k), 'activity,contacts,files,opportunities,quotes', 'the tabs are these five, with no renewals (D-186)');
  PERFORM pg_temp.is((SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(p -> 'account') k),
    'archived_at,city,created_at,current_provider,employees,id,industry,name,owner,phone,possible_duplicate_of,postal_code,source,source_partner,state,states_of_operation,status,street,trade_name,updated_at,version,web_domain,website',
    'the account: its fields, its version, the worked-out status and source, its owner, its possible-duplicate mark');
  PERFORM pg_temp.is(p #>> '{account,id}', pg_temp.id('a1')::text, 'it is the account asked for');
  PERFORM pg_temp.is(p #>> '{account,name}', 'Harborview Dental Group', 'its name');
  PERFORM pg_temp.is(p #>> '{account,trade_name}', 'Harborview Dental', 'trade name');
  PERFORM pg_temp.is(p #>> '{account,website}', 'https://www.HarborviewDental.example/about', 'website as typed');
  PERFORM pg_temp.is(p #>> '{account,web_domain}', 'harborviewdental.example', 'and its domain worked out');
  PERFORM pg_temp.is(p #>> '{account,phone}', '(503) 555-0140', 'phone as typed');
  PERFORM pg_temp.is((p #>> '{account,street}') || '|' || (p #>> '{account,city}') || '|' || (p #>> '{account,state}') || '|' || (p #>> '{account,postal_code}'),
    '410 SW Alder St|Portland|OR|97204', 'the address');
  PERFORM pg_temp.is(p #>> '{account,industry}', 'Dental practice', 'industry');
  PERFORM pg_temp.is((p #>> '{account,employees}')::int, 45, 'employees');
  PERFORM pg_temp.is(p #> '{account,states_of_operation}', '["OR","WA"]'::jsonb, 'states of operation');
  PERFORM pg_temp.is(p #>> '{account,current_provider}', 'Payroll vendor, carrier health plan', 'current provider');
  PERFORM pg_temp.is((p #>> '{account,version}')::int, (SELECT version FROM public.accounts WHERE id = pg_temp.id('a1')), 'the version to start a save from');
  PERFORM pg_temp.is(p #>> '{account,status}', 'prospect', 'a prospect account until a submission is won (D-197)');
  PERFORM pg_temp.is(p #>> '{account,source}', 'employer_intake', 'its source, the product''s (D-211)');
  PERFORM pg_temp.is(p #>> '{account,source_partner}', 'Kline CPA', 'with the partner''s name when the intake came by a partner''s link');
  PERFORM pg_temp.is(p #> '{account,owner}', jsonb_build_object('id', pg_temp.id('acme_agent1'), 'name', 'Dana Reyes'), 'its owner, by the name they gave');
  PERFORM pg_temp.is(p -> 'can_change', 'true'::jsonb, 'its owner may change it');
  PERFORM pg_temp.is((p #>> '{account,archived_at}') IS NULL, true, 'it is not archived');

  -- Contacts: seven; five rows, the main contact first, then by name.
  PERFORM pg_temp.is((p #>> '{tabs,contacts,count}')::int, 7, 'seven contacts');
  PERFORM pg_temp.is(jsonb_array_length(p #> '{tabs,contacts,rows}'), 5, 'the first five are shown');
  PERFORM pg_temp.is(p #>> '{tabs,contacts,rows,0,last_name}', 'Marsh', 'the main contact first');
  PERFORM pg_temp.is(p #>> '{tabs,contacts,rows,0,is_main}', 'true', 'marked as the main contact');
  PERFORM pg_temp.is(p #>> '{tabs,contacts,rows,0,title}', 'Practice Manager', 'with their title');
  PERFORM pg_temp.is(p #>> '{tabs,contacts,rows,0,email}', 'elena@harborview.example', 'email');
  PERFORM pg_temp.is(p #>> '{tabs,contacts,rows,0,phone}', '(503) 555-0142', 'and phone');
  PERFORM pg_temp.is(p #>> '{tabs,contacts,rows,1,last_name}', 'Abel 3', 'then the rest by last name');
  PERFORM pg_temp.is((SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(p #> '{tabs,contacts,rows,0}') k), 'do_not_email,email,first_name,id,is_main,last_name,mobile,phone,title',
    'a contact row says only what the list draws');

  -- Opportunities: seven; the newest start first, those with no start last.
  PERFORM pg_temp.is((p #>> '{tabs,opportunities,count}')::int, 7, 'seven opportunities');
  PERFORM pg_temp.is(jsonb_array_length(p #> '{tabs,opportunities,rows}'), 5, 'five shown');
  PERFORM pg_temp.is(p #>> '{tabs,opportunities,rows,0,name}', 'January 2027 PEO search', 'the one starting soonest ahead first');
  PERFORM pg_temp.is(p #>> '{tabs,opportunities,rows,0,stage}', 'in_market', 'its stage is worked out from its submission: sent to PEOs is In market (D-206)');
  PERFORM pg_temp.is(p #>> '{tabs,opportunities,rows,0,target_start}', '2027-01-01', 'with its target start');
  PERFORM pg_temp.is(p #>> '{tabs,opportunities,rows,0,submission_id}', pg_temp.id('i1')::text, 'and the submission its name opens (D-187)');
  PERFORM pg_temp.is(p #>> '{tabs,opportunities,rows,1,name}', '2025 PEO search', 'the older one next');
  PERFORM pg_temp.is(p #>> '{tabs,opportunities,rows,1,stage}', 'lost', 'lost is Lost');
  PERFORM pg_temp.is(p #>> '{tabs,opportunities,rows,2,stage}', 'qualifying', 'one with no submission is Qualifying');
  PERFORM pg_temp.is((p #>> '{tabs,opportunities,rows,2,submission_id}') IS NULL, true, 'and opens nothing, so its name is plain text');
  PERFORM pg_temp.is((SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(p #> '{tabs,opportunities,rows,0}') k), 'id,name,stage,submission_id,target_start', 'an opportunity row');

  -- Quotes: five, those of both intakes, the latest sent first.
  PERFORM pg_temp.is((p #>> '{tabs,quotes,count}')::int, 5, 'five quote requests, on both intakes');
  PERFORM pg_temp.is(jsonb_array_length(p #> '{tabs,quotes,rows}'), 5, 'all five shown');
  PERFORM pg_temp.is((SELECT string_agg(q ->> 'peo_name' || ':' || (q ->> 'status'), ',' ORDER BY ord) FROM jsonb_array_elements(p #> '{tabs,quotes,rows}') WITH ORDINALITY AS e (q, ord)),
    'PEO C:sent,PEO B:sent,PEO A:quoted,PEO D:declined,PEO A:quoted', 'newest sent first, then those sent earlier');
  PERFORM pg_temp.is((p #>> '{tabs,quotes,rows,2,sent_on}') || '|' || (p #>> '{tabs,quotes,rows,2,quote_received_on}') || '|' || (p #>> '{tabs,quotes,rows,2,quote_expires_on}'),
    '2026-10-29|2026-11-03|2026-12-05', 'with its sent date and its quote dates');
  PERFORM pg_temp.is(p #>> '{tabs,quotes,rows,2,opportunity_name}', 'January 2027 PEO search', 'and the opportunity it is on');
  PERFORM pg_temp.is(p #>> '{tabs,quotes,rows,2,submission_id}', pg_temp.id('i1')::text, 'and the submission it opens');
  PERFORM pg_temp.is((SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(p #> '{tabs,quotes,rows,0}') k),
    'id,opportunity_id,opportunity_name,peo_name,quote_expires_on,quote_received_on,sent_on,status,submission_id', 'a quote row');

  -- Files: the four that passed, newest first; none that is pending, infected, failed or unscanned, none of another intake, nothing read out of one.
  PERFORM pg_temp.is((p #>> '{tabs,files,count}')::int, 4, 'four files passed the virus check');
  PERFORM pg_temp.is((SELECT string_agg(f ->> 'file_name', ',' ORDER BY ord) FROM jsonb_array_elements(p #> '{tabs,files,rows}') WITH ORDINALITY AS e (f, ord)),
    'census.csv,loss-runs.pdf,invoice.pdf,old-census.csv', 'those, and only those');
  PERFORM pg_temp.is((SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(p #> '{tabs,files,rows,0}') k), 'category,created_at,file_name,id,mime_type,size_bytes,storage_path,submission_id',
    'a file row names the file and where it is stored, and nothing read out of it');
  PERFORM pg_temp.is(position('zz-read-out' IN p::text), 0, 'nothing read out of a file is anywhere on the page');

  -- Activity: the account's own history (its creation and the fields set after) and each contact's creation, newest first.
  PERFORM pg_temp.is((p #>> '{tabs,activity,count}')::bigint, (SELECT count(*) FROM public.record_history h WHERE h.table_name = 'accounts' AND h.record_key = pg_temp.id('a1')::text)
    + (SELECT count(*) FROM public.record_history h JOIN public.contacts c ON h.table_name = 'contacts' AND h.record_key = c.id::text WHERE c.account_id = pg_temp.id('a1')), 'every history entry of the account and its contacts');
  PERFORM pg_temp.is(jsonb_array_length(p #> '{tabs,activity,rows}'), 5, 'five shown');
  PERFORM pg_temp.is((SELECT bool_and((e.v ->> 'at')::timestamptz >= (e.next ->> 'at')::timestamptz) FROM (
      SELECT x.v, lead(x.v) OVER (ORDER BY x.ord) AS next FROM jsonb_array_elements(p #> '{tabs,activity,rows}') WITH ORDINALITY AS x (v, ord)) e WHERE e.next IS NOT NULL), true, 'newest first');
  PERFORM pg_temp.is((SELECT string_agg(DISTINCT v ->> 'type', ',') FROM jsonb_array_elements(p #> '{tabs,activity,rows}') v), 'change', 'every row is a change (calls, notes and tasks come with CRM-E1.5)');
  PERFORM pg_temp.is((SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(p #> '{tabs,activity,rows,0}') k),
    'at,change_id,entry_key,field,from_value,kind,record_id,record_name,record_table,to_value,type,who,who_kind', 'an entry, as the history gives it, with the record it is about');
  RAISE NOTICE 'account_page: the page passed';
END $$;

-- ---------- the page: a new account, status, owner and the partner ----------
-- Break caught: an account with nothing on it has no tabs or counts that are not zero; the status stays a prospect when a submission is won; an owner with no
-- name given shows no name at all; a source partner is shown for an account that did not come by a partner's link.
DO $$
DECLARE p jsonb;
BEGIN
  p := pg_temp.page('acme_agent2', 'acme', 'a2');
  PERFORM pg_temp.is((SELECT string_agg(k || '=' || (p #>> ARRAY['tabs', k, 'count']) || '/' || jsonb_array_length(p #> ARRAY['tabs', k, 'rows']), ',' ORDER BY k) FROM jsonb_object_keys(p -> 'tabs') k),
    'activity=1/1,contacts=0/0,files=0/0,opportunities=0/0,quotes=0/0', 'a new account: every list is empty but its history, which holds its creation');
  PERFORM pg_temp.is(p #>> '{tabs,activity,rows,0,kind}', 'created', 'whose one entry is its creation');
  PERFORM pg_temp.is(p #>> '{tabs,activity,rows,0,record_table}' || '|' || (p #>> '{tabs,activity,rows,0,record_name}'), 'accounts|Second Account', 'of the account');
  PERFORM pg_temp.is(p #>> '{account,owner,name}', 'acme_agent2@example.test', 'an owner who has given no name is shown by their email (D-42)');
  PERFORM pg_temp.is(p #>> '{account,source}' || '|' || COALESCE(p #>> '{account,source_partner}', 'none'), 'added_by_hand|none', 'an account added by hand has no partner');
  PERFORM pg_temp.is(p #>> '{account,status}', 'prospect', 'a prospect with nothing');
  PERFORM pg_temp.is((p #>> '{account,owner}') IS NULL, false, 'it has an owner');
  p := pg_temp.page('acme_owner', 'acme', 'a3');
  PERFORM pg_temp.is(p #> '{account,owner}', 'null'::jsonb, 'an account with no owner has none');
  -- A submission won makes the account a client, on its page too; reopened, a prospect again.
  RESET ROLE;
  UPDATE public.submission_workflow SET status = 'won' WHERE session_id = pg_temp.id('i1');
  PERFORM pg_temp.is(pg_temp.page('acme_agent1', 'acme', 'a1') #>> '{account,status}', 'client', 'an account whose submission is won is a client');
  PERFORM pg_temp.is(pg_temp.page('acme_agent1', 'acme', 'a1') #>> '{tabs,opportunities,rows,0,stage}', 'won', 'and its opportunity is Won');
  UPDATE public.submission_workflow SET status = 'sent_to_carrier' WHERE session_id = pg_temp.id('i1');
  PERFORM pg_temp.is(pg_temp.page('acme_agent1', 'acme', 'a1') #>> '{account,status}', 'prospect', 'a prospect again when it is not won');
  -- A partner's name is for an account made from an employer's intake only: one added by hand, with an intake that came by the partner's link put on it later, has none.
  PERFORM pg_temp.account('a4', 'acme', 'acme_agent1', 'Added By Hand');
  PERFORM pg_temp.intake_via('i4', 'acme', 'kline-cpa');
  PERFORM pg_temp.opportunity('o8', 'a4', 'acme_agent1', 'i4');
  p := pg_temp.page('acme_agent1', 'acme', 'a4');
  PERFORM pg_temp.is(p #>> '{account,source}' || '|' || COALESCE(p #>> '{account,source_partner}', 'none'), 'added_by_hand|none', 'an account added by hand shows no partner, whatever came onto it later');
  -- The partner is the one whose link the account's FIRST intake came by: with the first direct and a later one by a partner, there is none.
  PERFORM pg_temp.account('a5', 'acme', 'acme_agent1', 'First Direct', NULL, 'employer_intake');
  PERFORM pg_temp.intake_via('i5', 'acme', NULL);
  PERFORM pg_temp.intake_via('i6', 'acme', 'kline-cpa');
  PERFORM pg_temp.opportunity('o9', 'a5', 'acme_agent1', 'i5');
  PERFORM pg_temp.opportunity('o10', 'a5', 'acme_agent1', 'i6');
  UPDATE public.opportunities SET created_at = now() - interval '2 days' WHERE id = pg_temp.id('o9');
  UPDATE public.opportunities SET created_at = now() - interval '1 day' WHERE id = pg_temp.id('o10');
  PERFORM pg_temp.is(COALESCE(pg_temp.page('acme_agent1', 'acme', 'a5') #>> '{account,source_partner}', 'none'), 'none', 'the first intake came direct, so a later one by a partner does not name one');
  UPDATE public.opportunities SET created_at = now() - interval '3 days' WHERE id = pg_temp.id('o10');
  PERFORM pg_temp.is(pg_temp.page('acme_agent1', 'acme', 'a5') #>> '{account,source_partner}', 'Kline CPA', 'and when the partner''s intake is the first, it does');
  RAISE NOTICE 'account_page: a new account and a client passed';
END $$;

-- ---------- the page: only for someone who may see the account ----------
-- Break caught: an account's page is given to a person who may not see the account (another firm's member, someone with no firm, a platform admin, a former
-- member, an agent whose level does not reach it, a guest, a signed-out caller); or it says that the account is there, by an error or by a different answer
-- from the one for an account that is not (the answer is the same, nothing); or the firm the caller names is not the account's firm; or a firm is not asked.
DO $$
DECLARE c record; nothing jsonb := pg_temp.page('acme_owner', 'acme', 'not-an-account');
BEGIN
  PERFORM pg_temp.is(nothing, NULL::jsonb, 'an account that is not there gives nothing');
  FOR c IN SELECT * FROM (VALUES
    -- who, firm they name, account, whether they get the page
    ('acme_owner', 'acme', 'a1', true), ('acme_owner', 'acme', 'a2', true), ('acme_owner', 'acme', 'a3', true),
    ('acme_agent1', 'acme', 'a1', true), ('acme_agent1', 'acme', 'a2', false), ('acme_agent1', 'acme', 'a3', false),
    ('acme_agent2', 'acme', 'a2', true), ('acme_agent2', 'acme', 'a1', false),
    ('acme_lead', 'acme', 'a2', true), ('acme_lead', 'acme', 'a1', false), ('acme_lead', 'acme', 'a3', false),
    ('acme_west', 'acme', 'a2', false),
    ('acme_removed', 'acme', 'a1', false), ('acme_removed', 'acme', 'a3', false),
    ('platform_admin', 'acme', 'a1', false), ('nobody', 'acme', 'a1', false),
    ('zenith_owner', 'acme', 'a1', false), ('zenith_owner', 'zenith', 'a1', false), ('zenith_agent', 'acme', 'a1', false), ('acme_owner', 'zenith', 'a1', false),
    ('acme_owner', 'zenith', 'za', false), ('zenith_owner', 'acme', 'za', false), ('zenith_owner', 'zenith', 'za', true)
  ) AS t (who, firm, account, want) LOOP
    PERFORM pg_temp.is(pg_temp.page(c.who, c.firm, c.account) IS NOT NULL, c.want, c.who || ' asking at ' || c.firm || ' for ' || c.account);
  END LOOP;
  -- A firm that shows everyone everything shows every member its accounts: the other agent sees za, and may not change it.
  PERFORM pg_temp.is(pg_temp.page('zenith_agent2', 'zenith', 'za') #> '{can_change}', 'false'::jsonb, 'a member who sees an account because the firm shows everyone everything may not change it');
  PERFORM pg_temp.is(pg_temp.page('zenith_agent', 'zenith', 'za') #> '{can_change}', 'true'::jsonb, 'its owner may');
  PERFORM pg_temp.is(pg_temp.page('zenith_owner', 'zenith', 'za') #> '{can_change}', 'true'::jsonb, 'and an owner of the firm');
  PERFORM pg_temp.is(pg_temp.page('acme_lead', 'acme', 'a2') #> '{can_change}', 'true'::jsonb, 'a lead may change an account of their team');
  PERFORM pg_temp.is(pg_temp.page('acme_owner', 'acme', 'a3') #> '{can_change}', 'true'::jsonb, 'an owner may change one with no owner');
  -- Not asked, not given.
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(public.account_page(NULL, pg_temp.id('a1')), NULL::jsonb, 'no firm named gives nothing');
  PERFORM pg_temp.is(public.account_page(pg_temp.id('acme'), NULL), NULL::jsonb, 'no account named gives nothing');
  RESET ROLE;
  -- A signed-out caller can't call it at all.
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.account_page(%L, %L)$q$, pg_temp.id('acme'), pg_temp.id('a1'))), '42501', 'a signed-out caller may not call it');
  RESET ROLE;
  RAISE NOTICE 'account_page: who gets the page passed';
END $$;

-- ---------- the page: the possible-duplicate mark (story CRM-S4.3a, D-660) ----------
-- Break caught: the page says nothing of the mark (so the banner could not be drawn), says it for an account that carries none, names an account the caller may not
-- see (a person learns that one exists but never its name), or loses the mark's name when the person may see it.
DO $$
DECLARE p jsonb;
BEGIN
  PERFORM pg_temp.is(pg_temp.page('acme_owner', 'acme', 'a1') #> '{account,possible_duplicate_of}', 'null'::jsonb, 'an account with no mark says null');
  RESET ROLE;
  UPDATE public.accounts SET possible_duplicate_of = pg_temp.id('a2') WHERE id = pg_temp.id('a1');
  p := pg_temp.page('acme_owner', 'acme', 'a1');
  PERFORM pg_temp.is(p #>> '{account,possible_duplicate_of,id}', pg_temp.id('a2')::text, 'a marked account names the account it may duplicate');
  PERFORM pg_temp.is(p #>> '{account,possible_duplicate_of,name}', (SELECT name FROM public.accounts WHERE id = pg_temp.id('a2')), 'with its name, to someone who may see it');
  p := pg_temp.page('acme_agent1', 'acme', 'a1');
  PERFORM pg_temp.is(jsonb_typeof(p #> '{account,possible_duplicate_of}'), 'object', 'someone who may not see the other account is still told the mark is there');
  PERFORM pg_temp.is(p #> '{account,possible_duplicate_of,id}', 'null'::jsonb, 'without its id');
  PERFORM pg_temp.is(p #> '{account,possible_duplicate_of,name}', 'null'::jsonb, 'or its name');
  PERFORM pg_temp.is(pg_temp.page('acme_owner', 'acme', 'a2') #> '{account,possible_duplicate_of}', 'null'::jsonb, 'the other account carries no mark of its own');
  RESET ROLE;
  UPDATE public.accounts SET possible_duplicate_of = NULL WHERE id = pg_temp.id('a1');
  RAISE NOTICE 'account_page: the possible-duplicate mark passed';
END $$;

-- ---------- the page: one firm at a time, and Nevermore support ----------
-- Break caught: a person who belongs to two firms is given one firm's account at the other firm's address (ADR 0016, D-40); a support session reads nothing, or
-- more than an owner reads, or may change what it reads.
DO $$
DECLARE dual uuid := pg_temp.new_user('dual'); sess uuid;
BEGIN
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (pg_temp.id('acme'), dual, 'owner'), (pg_temp.id('zenith'), dual, 'owner');
  PERFORM pg_temp.is(pg_temp.page('dual', 'acme', 'a1', 'acme-brokers') IS NOT NULL, true, 'a member of two firms is given the account at its own firm''s address');
  PERFORM pg_temp.is(pg_temp.page('dual', 'acme', 'a1', 'zenith-benefits'), NULL::jsonb, 'and nothing of it at the other firm''s address');
  PERFORM pg_temp.is(pg_temp.page('dual', 'zenith', 'za', 'zenith-benefits') IS NOT NULL, true, 'and the other firm''s at its own');
  PERFORM pg_temp.is(pg_temp.page('dual', 'zenith', 'za', 'acme-brokers'), NULL::jsonb, 'but not at this one');
  PERFORM pg_temp.is(pg_temp.page('dual', 'zenith', 'a1', 'zenith-benefits'), NULL::jsonb, 'and naming the other firm for this firm''s account gives nothing');
  DELETE FROM public.firm_memberships WHERE user_id = dual;

  PERFORM pg_temp.is(pg_temp.page('platform_admin', 'acme', 'a1', 'acme-brokers'), NULL::jsonb, 'a platform admin with no session reads nothing');
  PERFORM pg_temp.as_user('platform_admin');
  sess := (SELECT t.session_id FROM public.start_support_session(pg_temp.id('acme'), 'Looking at an account the firm asked about') t);
  PERFORM pg_temp.is(pg_temp.page('platform_admin', 'acme', 'a1', 'acme-brokers') IS NOT NULL, true, 'with a session, at the firm''s address, it reads the page as an owner does');
  PERFORM pg_temp.is(pg_temp.page('platform_admin', 'acme', 'a3', 'acme-brokers') IS NOT NULL, true, 'an account with no owner too');
  PERFORM pg_temp.is(pg_temp.page('platform_admin', 'acme', 'a1', 'acme-brokers') -> 'can_change', 'false'::jsonb, 'but may not change it');
  PERFORM pg_temp.is(pg_temp.page('platform_admin', 'acme', 'a1'), NULL::jsonb, 'and at no address, reads nothing');
  PERFORM pg_temp.is(pg_temp.page('platform_admin', 'zenith', 'za', 'zenith-benefits'), NULL::jsonb, 'nor another firm''s');
  PERFORM pg_temp.is((pg_temp.page('platform_admin', 'acme', 'a1', 'acme-brokers') #>> '{tabs,activity,rows,0,who}') IS NOT NULL, true, 'the history says who by the history''s own rule');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.end_support_session(sess);
  PERFORM pg_temp.is(pg_temp.page('platform_admin', 'acme', 'a1', 'acme-brokers'), NULL::jsonb, 'when the session ends it reads nothing again');
  RESET ROLE;
  RAISE NOTICE 'account_page: one firm at a time and support passed';
END $$;

-- ---------- the Files list ----------
-- Break caught: the list holds a file that is pending, infected, failed or unscanned, or one of an intake the account's opportunities do not hold, or
-- something read out of a file; a page is not a page (too long, a place before the first, no order); a person who may not see the account is given its
-- files; or a file is reachable by someone its own access rule refuses: the list gives a name and a place, and Storage's row security, not this list,
-- decides who is given a link (a member of the firm reads it, another firm's member and Nevermore support do not, a file still pending is withheld from all).
CREATE FUNCTION pg_temp.files(who text, firm text, account text, lim integer DEFAULT 50, off integer DEFAULT 0, addr text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user(who, addr);
  r := public.account_files(pg_temp.id(firm), COALESCE(pg_temp.id(account), gen_random_uuid()), lim, off);
  RESET ROLE;
  RETURN r;
END $$;

DO $$
DECLARE f jsonb; names text; doc text; sess uuid;
BEGIN
  f := pg_temp.files('acme_agent1', 'acme', 'a1');
  PERFORM pg_temp.is((f ->> 'count')::int, 4, 'four files in all');
  names := (SELECT string_agg(r ->> 'file_name', ',' ORDER BY ord) FROM jsonb_array_elements(f -> 'rows') WITH ORDINALITY AS e (r, ord));
  PERFORM pg_temp.is(names, 'census.csv,loss-runs.pdf,invoice.pdf,old-census.csv', 'the ones that passed, newest first');
  PERFORM pg_temp.is(f #>> '{rows,0,submission_id}', pg_temp.id('i1')::text, 'each says which submission it came with');
  PERFORM pg_temp.is(f #>> '{rows,0,mime_type}' || '|' || (f #>> '{rows,0,size_bytes}') || '|' || (f #>> '{rows,0,category}'), 'text/csv|1024|other', 'its type, size and category');
  PERFORM pg_temp.is(position('zz-read-out' IN f::text), 0, 'nothing read out of a file');
  -- pages
  PERFORM pg_temp.is((SELECT string_agg(r ->> 'file_name', ',' ORDER BY ord) FROM jsonb_array_elements(pg_temp.files('acme_agent1', 'acme', 'a1', 2, 0) -> 'rows') WITH ORDINALITY AS e (r, ord)),
    'census.csv,loss-runs.pdf', 'a page of two');
  PERFORM pg_temp.is((SELECT string_agg(r ->> 'file_name', ',' ORDER BY ord) FROM jsonb_array_elements(pg_temp.files('acme_agent1', 'acme', 'a1', 2, 2) -> 'rows') WITH ORDINALITY AS e (r, ord)),
    'invoice.pdf,old-census.csv', 'and the next');
  PERFORM pg_temp.is(pg_temp.files('acme_agent1', 'acme', 'a1', 2, 4), jsonb_build_object('count', 4, 'rows', '[]'::jsonb), 'a page past the end has no rows and the same count');
  PERFORM pg_temp.is(pg_temp.files('acme_agent2', 'acme', 'a2'), jsonb_build_object('count', 0, 'rows', '[]'::jsonb), 'an account with no intake has no files');
  PERFORM pg_temp.as_user('acme_agent1');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.account_files(%L, %L, 101, 0)$q$, pg_temp.id('acme'), pg_temp.id('a1'))), '22023: A page is 0 to 100 rows, from a place that is not before the first', 'a page is at most 100');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.account_files(%L, %L, 10, -1)$q$, pg_temp.id('acme'), pg_temp.id('a1'))), '22023', 'and does not start before the first');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.account_files(%L, %L, NULL, 0)$q$, pg_temp.id('acme'), pg_temp.id('a1'))), '22023', 'and has a size');
  RESET ROLE;
  -- who may be given the list
  PERFORM pg_temp.is(pg_temp.files('acme_agent2', 'acme', 'a1'), NULL::jsonb, 'an agent who may not see the account gets nothing');
  PERFORM pg_temp.is(pg_temp.files('acme_removed', 'acme', 'a1'), NULL::jsonb, 'nor a former member');
  PERFORM pg_temp.is(pg_temp.files('zenith_owner', 'acme', 'a1'), NULL::jsonb, 'nor another firm''s owner');
  PERFORM pg_temp.is(pg_temp.files('zenith_owner', 'zenith', 'a1'), NULL::jsonb, 'naming their own firm does not help');
  PERFORM pg_temp.is(pg_temp.files('platform_admin', 'acme', 'a1', 50, 0, 'acme-brokers'), NULL::jsonb, 'nor a platform admin');
  PERFORM pg_temp.is(pg_temp.files('acme_owner', 'acme', 'not-an-account'), NULL::jsonb, 'an account that is not there gives the same');
  PERFORM pg_temp.is(pg_temp.files('acme_owner', 'acme', 'a1') IS NOT NULL, true, 'an owner of the firm is given it');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.account_files(%L, %L)$q$, pg_temp.id('acme'), pg_temp.id('a1'))), '42501', 'a signed-out caller may not call it');
  RESET ROLE;

  -- Each file stays under its own access rule: Storage's. A stored object for a listed file and for one that is still pending.
  INSERT INTO storage.objects (bucket_id, name) SELECT 'documents', d.storage_path FROM public.documents d WHERE d.id IN (pg_temp.id('f1'), pg_temp.id('fp'));
  doc := (SELECT d.storage_path FROM public.documents d WHERE d.id = pg_temp.id('f1'));
  PERFORM pg_temp.as_user('acme_agent3');
  PERFORM pg_temp.is((SELECT count(*) FROM storage.objects WHERE bucket_id = 'documents' AND name = doc), 1::bigint, 'any member of the firm may be given a link to a file that passed (the file rule is the firm''s, not the account''s level)');
  PERFORM pg_temp.is((SELECT count(*) FROM storage.objects WHERE bucket_id = 'documents' AND name = (SELECT d.storage_path FROM public.documents d WHERE d.id = pg_temp.id('fp'))), 0::bigint, 'a file still being checked is withheld from a member');
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM pg_temp.is((SELECT count(*) FROM storage.objects WHERE bucket_id = 'documents' AND name = doc), 0::bigint, 'another firm''s owner is given no link');
  PERFORM pg_temp.as_user('acme_removed');
  PERFORM pg_temp.is((SELECT count(*) FROM storage.objects WHERE bucket_id = 'documents' AND name = doc), 0::bigint, 'nor a former member');
  PERFORM pg_temp.as_user('platform_admin');
  sess := (SELECT t.session_id FROM public.start_support_session(pg_temp.id('acme'), 'Looking at an account the firm asked about') t);
  PERFORM pg_temp.is(jsonb_typeof(pg_temp.files('platform_admin', 'acme', 'a1', 50, 0, 'acme-brokers')), 'object', 'Nevermore support is given the list');
  PERFORM pg_temp.as_user('platform_admin', 'acme-brokers');
  PERFORM pg_temp.is((SELECT count(*) FROM storage.objects WHERE bucket_id = 'documents' AND name = doc), 0::bigint, 'but no link: a download leaves the product and the hour (ADR 0024)');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.end_support_session(sess);
  RESET ROLE;
  RAISE NOTICE 'account_page: the files passed';
END $$;

-- ---------- a tab beyond its first five rows ----------
-- Break caught: a tab of the page is a different list from the first five rows of the same tab on the page (the two are built by one function); a page of
-- a tab is not a page (a place before the first, too long, no size) or leaves out rows beyond the fifth; a tab that does not exist is answered with
-- rows; or a person who may not see the account is given its rows (another firm's member, a former member, a platform admin, a signed-out caller).
CREATE FUNCTION pg_temp.tab(who text, firm text, account text, tabname text, lim integer DEFAULT 50, off integer DEFAULT 0, addr text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user(who, addr);
  r := public.account_tab(pg_temp.id(firm), COALESCE(pg_temp.id(account), gen_random_uuid()), tabname, lim, off);
  RESET ROLE;
  RETURN r;
END $$;

DO $$
DECLARE p jsonb; t jsonb; tabname text;
BEGIN
  p := pg_temp.page('acme_agent1', 'acme', 'a1');
  -- the first five rows of every tab are the same rows the page holds
  FOREACH tabname IN ARRAY ARRAY['contacts', 'opportunities', 'quotes', 'activity', 'files'] LOOP
    t := pg_temp.tab('acme_agent1', 'acme', 'a1', tabname, 5, 0);
    PERFORM pg_temp.is(t, p #> ARRAY['tabs', tabname], 'the first five of ' || tabname || ' are the page''s own');
  END LOOP;
  -- the whole of a tab
  t := pg_temp.tab('acme_agent1', 'acme', 'a1', 'contacts');
  PERFORM pg_temp.is((t ->> 'count')::int, 7, 'seven contacts in all');
  PERFORM pg_temp.is(jsonb_array_length(t -> 'rows'), 7, 'and all seven are given, past the fifth');
  PERFORM pg_temp.is(t #>> '{rows,0,last_name}', 'Marsh', 'the main contact still first');
  t := pg_temp.tab('acme_agent1', 'acme', 'a1', 'opportunities');
  PERFORM pg_temp.is(jsonb_array_length(t -> 'rows'), 7, 'all seven opportunities');
  PERFORM pg_temp.is(jsonb_array_length(pg_temp.tab('acme_agent1', 'acme', 'a1', 'quotes') -> 'rows'), 5, 'and the five quote requests');
  t := pg_temp.tab('acme_agent1', 'acme', 'a1', 'activity');
  PERFORM pg_temp.is(jsonb_array_length(t -> 'rows')::bigint, (t ->> 'count')::bigint, 'every history entry, as many rows as the count says');
  PERFORM pg_temp.is((t ->> 'count')::bigint > 5, true, 'more than five of them');
  -- pages
  PERFORM pg_temp.is((SELECT string_agg(r ->> 'last_name', ',' ORDER BY ord) FROM jsonb_array_elements(pg_temp.tab('acme_agent1', 'acme', 'a1', 'contacts', 2, 5) -> 'rows') WITH ORDINALITY AS e (r, ord)),
    (SELECT string_agg(r ->> 'last_name', ',' ORDER BY ord) FROM jsonb_array_elements(pg_temp.tab('acme_agent1', 'acme', 'a1', 'contacts') -> 'rows') WITH ORDINALITY AS e (r, ord) WHERE ord > 5),
    'a page from the sixth row is the rows after the fifth');
  PERFORM pg_temp.is(pg_temp.tab('acme_agent1', 'acme', 'a1', 'contacts', 2, 7), jsonb_build_object('count', 7, 'rows', '[]'::jsonb), 'a page past the end has no rows and the same count');
  PERFORM pg_temp.as_user('acme_agent1');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.account_tab(%L, %L, 'contacts', 101, 0)$q$, pg_temp.id('acme'), pg_temp.id('a1'))), '22023: A page is 0 to 100 rows, from a place that is not before the first', 'a page is at most 100');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.account_tab(%L, %L, 'contacts', 10, -1)$q$, pg_temp.id('acme'), pg_temp.id('a1'))), '22023', 'and does not start before the first');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.account_tab(%L, %L, 'contacts', NULL, 0)$q$, pg_temp.id('acme'), pg_temp.id('a1'))), '22023', 'and has a size');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.account_tab(%L, %L, 'renewals', 5, 0)$q$, pg_temp.id('acme'), pg_temp.id('a1'))), '22023: An account has no tab called "renewals"', 'there is no Renewals tab (D-186)');
  RESET ROLE;
  -- who may be given the rows
  PERFORM pg_temp.is(pg_temp.tab('acme_agent2', 'acme', 'a1', 'contacts'), NULL::jsonb, 'an agent who may not see the account gets nothing');
  PERFORM pg_temp.is(pg_temp.tab('acme_removed', 'acme', 'a1', 'contacts'), NULL::jsonb, 'nor a former member');
  PERFORM pg_temp.is(pg_temp.tab('zenith_owner', 'acme', 'a1', 'contacts'), NULL::jsonb, 'nor another firm''s owner');
  PERFORM pg_temp.is(pg_temp.tab('zenith_owner', 'zenith', 'a1', 'contacts'), NULL::jsonb, 'naming their own firm does not help');
  PERFORM pg_temp.is(pg_temp.tab('platform_admin', 'acme', 'a1', 'contacts', 50, 0, 'acme-brokers'), NULL::jsonb, 'nor a platform admin with no session');
  PERFORM pg_temp.is(pg_temp.tab('acme_owner', 'acme', 'not-an-account', 'contacts'), NULL::jsonb, 'an account that is not there gives the same');
  PERFORM pg_temp.is(jsonb_typeof(pg_temp.tab('acme_owner', 'acme', 'a1', 'contacts')), 'object', 'an owner of the firm is given the rows');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.account_tab(%L, %L, 'contacts')$q$, pg_temp.id('acme'), pg_temp.id('a1'))), '42501', 'a signed-out caller may not call it');
  RESET ROLE;
  RAISE NOTICE 'account_page: the tabs passed';
END $$;

-- ---------- a submission's account ----------
-- Break caught: a submission's page is given an account its reader may not see (the name of an account is the firm's, seen by level); or a submission of
-- another firm is told; or one on no account is answered with an error that says so.
CREATE FUNCTION pg_temp.account_of(who text, firm text, intake text, addr text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user(who, addr);
  r := public.submission_account(pg_temp.id(firm), COALESCE(pg_temp.id(intake), gen_random_uuid()));
  RESET ROLE;
  RETURN r;
END $$;

DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.account_of('acme_agent1', 'acme', 'i1'), jsonb_build_object('id', pg_temp.id('a1'), 'name', 'Harborview Dental Group'), 'the account of a submission, to someone who may see it');
  PERFORM pg_temp.is(pg_temp.account_of('acme_agent1', 'acme', 'i2'), jsonb_build_object('id', pg_temp.id('a1'), 'name', 'Harborview Dental Group'), 'the other submission on it too');
  PERFORM pg_temp.is(pg_temp.account_of('acme_owner', 'acme', 'i1') IS NOT NULL, true, 'an owner of the firm');
  PERFORM pg_temp.is(pg_temp.account_of('acme_agent2', 'acme', 'i1'), NULL::jsonb, 'nothing for an agent who may not see the account');
  PERFORM pg_temp.is(pg_temp.account_of('acme_lead', 'acme', 'i1'), NULL::jsonb, 'nor a lead whose team does not hold it');
  PERFORM pg_temp.is(pg_temp.account_of('acme_removed', 'acme', 'i1'), NULL::jsonb, 'nor a former member');
  PERFORM pg_temp.is(pg_temp.account_of('zenith_owner', 'acme', 'i1'), NULL::jsonb, 'nor another firm''s owner');
  PERFORM pg_temp.is(pg_temp.account_of('zenith_owner', 'zenith', 'i1'), NULL::jsonb, 'naming their own firm does not help');
  PERFORM pg_temp.is(pg_temp.account_of('platform_admin', 'acme', 'i1', 'acme-brokers'), NULL::jsonb, 'nor a platform admin');
  PERFORM pg_temp.is(pg_temp.account_of('acme_owner', 'acme', 'i3'), NULL::jsonb, 'a submission on no account has none');
  PERFORM pg_temp.is(pg_temp.account_of('acme_owner', 'acme', 'no-submission'), NULL::jsonb, 'and one that is not there is answered the same');
  PERFORM pg_temp.is(pg_temp.account_of('acme_owner', 'zenith', 'i1'), NULL::jsonb, 'the firm named is the submission''s firm');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.submission_account(%L, %L)$q$, pg_temp.id('acme'), pg_temp.id('i1'))), '42501', 'a signed-out caller may not call it');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(public.submission_account(NULL, pg_temp.id('i1')), NULL::jsonb, 'with no firm named, nothing');
  RESET ROLE;
  RAISE NOTICE 'account_page: a submission''s account passed';
END $$;

-- ---------- saving an account's own fields ----------
-- The save, as a person, with the account's current fields overlaid by `patch` (a field named in it, a JSON null included, is sent as given; one not named is
-- sent as the account now has it). `ver` is the version the person started from. Answers the function's jsonb, or raises what it raises.
CREATE FUNCTION pg_temp.save(who text, acct text, ver integer, patch jsonb DEFAULT '{}', firm text DEFAULT 'acme', addr text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE a public.accounts; r jsonb;
BEGIN
  RESET ROLE;
  SELECT * INTO a FROM public.accounts WHERE id = pg_temp.id(acct);
  IF who = 'anon' THEN PERFORM pg_temp.as_anon(); ELSE PERFORM pg_temp.as_user(who, addr); END IF;
  r := public.update_account(
    COALESCE(pg_temp.id(acct), gen_random_uuid()),
    CASE WHEN patch ? 'name' THEN patch ->> 'name' ELSE COALESCE(a.name, 'Name') END, CASE WHEN patch ? 'trade_name' THEN patch ->> 'trade_name' ELSE a.trade_name END,
    CASE WHEN patch ? 'website' THEN patch ->> 'website' ELSE a.website END, CASE WHEN patch ? 'phone' THEN patch ->> 'phone' ELSE a.phone END,
    CASE WHEN patch ? 'street' THEN patch ->> 'street' ELSE a.street END, CASE WHEN patch ? 'city' THEN patch ->> 'city' ELSE a.city END,
    CASE WHEN patch ? 'state' THEN patch ->> 'state' ELSE a.state END, CASE WHEN patch ? 'postal_code' THEN patch ->> 'postal_code' ELSE a.postal_code END,
    CASE WHEN patch ? 'industry' THEN patch ->> 'industry' ELSE a.industry END, CASE WHEN patch ? 'employees' THEN (patch ->> 'employees')::int ELSE a.employees END,
    CASE WHEN patch ? 'states' THEN ARRAY(SELECT jsonb_array_elements_text(patch -> 'states')) ELSE a.states_of_operation END,
    CASE WHEN patch ? 'provider' THEN patch ->> 'provider' ELSE a.current_provider END,
    CASE WHEN firm IS NULL THEN NULL ELSE pg_temp.id(firm) END, ver);
  RESET ROLE;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RAISE;
END $$;

CREATE FUNCTION pg_temp.save_refusal(who text, acct text, ver integer, patch jsonb DEFAULT '{}', firm text DEFAULT 'acme', addr text DEFAULT NULL) RETURNS text LANGUAGE plpgsql AS $$
DECLARE s text; m text;
BEGIN
  PERFORM pg_temp.save(who, acct, ver, patch, firm, addr);
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT;
  RESET ROLE;
  RETURN s || ': ' || m;
END $$;

CREATE FUNCTION pg_temp.ver(acct text) RETURNS integer LANGUAGE sql AS $$ SELECT version FROM public.accounts WHERE id = pg_temp.id(acct) $$;

-- ---------- the save: what it writes and what it answers ----------
-- Break caught: the save does not write what was sent, keeps a blank or a state in lower case, a state of operation twice, loses its version, answers a
-- success with something other than the saved record and its new version, touches a field it must not (the owner, archiving or the source, D-211) or
-- another account, writes no history or history that names the wrong person, or a save that changes nothing raises the version.
DO $$
DECLARE r jsonb; v int := pg_temp.ver('a1'); h bigint; before public.accounts; a2 public.accounts;
BEGIN
  SELECT * INTO before FROM public.accounts WHERE id = pg_temp.id('a1');
  SELECT * INTO a2 FROM public.accounts WHERE id = pg_temp.id('a2');
  r := pg_temp.save('acme_agent1', 'a1', v, jsonb_build_object('name', '  Harborview Dental Group LLC ', 'trade_name', '   ', 'website', 'harborviewdental.example', 'phone', '503-555-0199',
    'state', ' wa ', 'employees', 52, 'states', jsonb_build_array('wa', 'OR', ' or ', 'ID'), 'provider', 'Acme Payroll'));
  PERFORM pg_temp.is(r ->> 'conflict', 'false', 'a save from the current version goes through');
  PERFORM pg_temp.is((r #>> '{record,version}')::int, v + 1, 'and raises the version');
  PERFORM pg_temp.is(r #>> '{record,name}', 'Harborview Dental Group LLC', 'a name is trimmed');
  PERFORM pg_temp.is(r #> '{record,trade_name}', 'null'::jsonb, 'a blank field is cleared');
  PERFORM pg_temp.is(r #>> '{record,website}' || '|' || (r #>> '{record,web_domain}'), 'harborviewdental.example|harborviewdental.example', 'a website and its worked-out domain');
  PERFORM pg_temp.is(r #>> '{record,state}', 'WA', 'a state is in capitals');
  PERFORM pg_temp.is(r #> '{record,states_of_operation}', '["WA","OR","ID"]'::jsonb, 'each state of operation once, in capitals, in the order sent');
  PERFORM pg_temp.is((r #>> '{record,employees}')::int, 52, 'employees');
  PERFORM pg_temp.is(r #>> '{record,current_provider}', 'Acme Payroll', 'current provider');
  PERFORM pg_temp.is(r #>> '{record,street}' || '|' || (r #>> '{record,city}'), '410 SW Alder St|Portland', 'what was sent as it was stays');
  PERFORM pg_temp.is((SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(r -> 'record') k),
    'archived_at,city,created_at,current_provider,employees,id,industry,name,phone,postal_code,source,state,states_of_operation,street,trade_name,updated_at,version,web_domain,website',
    'the record is the account''s own fields, with its version and no owner');
  PERFORM pg_temp.is((SELECT a.owner_id IS NOT DISTINCT FROM before.owner_id AND a.archived_at IS NOT DISTINCT FROM before.archived_at AND a.source = before.source
    AND a.possible_duplicate_of IS NOT DISTINCT FROM before.possible_duplicate_of FROM public.accounts a WHERE a.id = pg_temp.id('a1')), true, 'the owner, archiving, source and duplicate mark are not touched');
  PERFORM pg_temp.is((SELECT a.name = a2.name AND a.version = a2.version AND a.employees IS NOT DISTINCT FROM a2.employees FROM public.accounts a WHERE a.id = a2.id), true, 'another account is not touched');
  PERFORM pg_temp.is((SELECT string_agg(h.field, ',' ORDER BY h.field) FROM public.record_history h WHERE h.table_name = 'accounts' AND h.record_key = pg_temp.id('a1')::text AND h.version = v + 1),
    'current_provider,employees,name,phone,state,states_of_operation,trade_name,website', 'the history has one entry for each field that changed, and none for one that did not');
  PERFORM pg_temp.is((SELECT DISTINCT h.actor_id FROM public.record_history h WHERE h.table_name = 'accounts' AND h.record_key = pg_temp.id('a1')::text AND h.version = v + 1), pg_temp.id('acme_agent1'), 'by the person who saved');
  -- The same save again changes nothing and keeps the version, so a form saved twice is not refused the second time.
  r := pg_temp.save('acme_agent1', 'a1', v + 1, jsonb_build_object('name', 'Harborview Dental Group LLC'));
  PERFORM pg_temp.is(r ->> 'conflict', 'false', 'a save that changes nothing goes through');
  PERFORM pg_temp.is((r #>> '{record,version}')::int, v + 1, 'and leaves the version');
  SELECT count(*) INTO h FROM public.record_history x WHERE x.table_name = 'accounts' AND x.record_key = pg_temp.id('a1')::text AND x.version = v + 1;
  PERFORM pg_temp.is(h, 8::bigint, 'and the history');
  -- Clearing what is optional, and keeping an account with no states
  r := pg_temp.save('acme_agent1', 'a1', v + 1, jsonb_build_object('website', NULL, 'phone', NULL, 'employees', NULL, 'states', '[]'::jsonb, 'state', NULL));
  PERFORM pg_temp.is(r #>> '{record,website}' IS NULL AND r #>> '{record,employees}' IS NULL AND r #>> '{record,state}' IS NULL AND r #> '{record,states_of_operation}' = '[]'::jsonb, true, 'everything optional can be cleared');
  RAISE NOTICE 'account_page: the save passed';
END $$;

-- ---------- the save: what is wrong with the fields ----------
-- Break caught: the database takes a name that is blank or too long, a state that is not one, a negative number of employees, states of operation that are not
-- states, or a field too long; or says it in a code and no words; or looks at the account before the fields (the answer would tell a stranger it is there).
DO $$
DECLARE v int := pg_temp.ver('a1');
BEGIN
  PERFORM pg_temp.is(pg_temp.save_refusal('acme_agent1', 'a1', v, '{"name": ""}'), '22023: Give the account a name.', 'a name is required');
  PERFORM pg_temp.is(pg_temp.save_refusal('acme_agent1', 'a1', v, '{"name": "   "}'), '22023: Give the account a name.', 'not blank spaces');
  PERFORM pg_temp.is(pg_temp.save_refusal('acme_agent1', 'a1', v, jsonb_build_object('name', repeat('x', 201))), '22023: Keep the account''s name to 200 characters.', 'a name is at most 200 characters');
  PERFORM pg_temp.is(pg_temp.save_refusal('acme_agent1', 'a1', v, '{"state": "ZZ"}'), '22023: Choose a state from the list.', 'a state is a state');
  PERFORM pg_temp.is(pg_temp.save_refusal('acme_agent1', 'a1', v, '{"employees": -1}'), '22023: Employees can''t be a negative number.', 'employees are not negative');
  PERFORM pg_temp.is(pg_temp.save_refusal('acme_agent1', 'a1', v, '{"states": ["OR", "XX"]}'), '22023: Choose the states of operation from the list.', 'nor are states of operation made up');
  PERFORM pg_temp.is(pg_temp.save_refusal('acme_agent1', 'a1', v, jsonb_build_object('website', repeat('w', 301))), '22023: Keep the website to 300 characters.', 'a website is at most 300');
  PERFORM pg_temp.is(pg_temp.save_refusal('acme_agent1', 'a1', v, jsonb_build_object('phone', repeat('1', 41))), '22023: Enter a phone number like (503) 555-0142. An extension can follow, like x12.', 'a phone is the repository''s rule (is_valid_phone), not a length of its own');
  PERFORM pg_temp.is(pg_temp.save_refusal('acme_agent1', 'a1', v, jsonb_build_object('city', repeat('c', 101))), '22023: Keep the city to 100 characters.', 'a city at most 100');
  -- The input is looked at before the account, so a stranger learns nothing of it: the same words whether or not the account is theirs.
  PERFORM pg_temp.is(pg_temp.save_refusal('acme_agent2', 'a1', v, '{"name": ""}'), '22023: Give the account a name.', 'the words are the same for an account the person may not see');
  PERFORM pg_temp.is((SELECT version FROM public.accounts WHERE id = pg_temp.id('a1')), v, 'and nothing was saved');
  RAISE NOTICE 'account_page: the fields'' rules passed';
END $$;

-- ---------- the save: the version, and who changed what ----------
-- Break caught: a save from an old version overwrites what someone else saved (nothing is written and the answer carries what is there now, who changed it and
-- when); a save names no version, or one the account never had, and is answered as though someone had changed it; the answer names a person by an id.
DO $$
DECLARE v int := pg_temp.ver('a1'); r jsonb; before public.accounts;
BEGIN
  -- Two people start from the same version. The owner of the firm saves first.
  r := pg_temp.save('acme_owner', 'a1', v, '{"name": "Harborview Dental", "employees": 60}');
  PERFORM pg_temp.is(r ->> 'conflict', 'false', 'the first save goes through');
  SELECT * INTO before FROM public.accounts WHERE id = pg_temp.id('a1');
  r := pg_temp.save('acme_agent1', 'a1', v, '{"name": "Harborview Group", "industry": "Dental"}');
  PERFORM pg_temp.is(r ->> 'conflict', 'true', 'the second, from the version both started from, is a conflict and not an error');
  PERFORM pg_temp.is((r ->> 'currentVersion')::int, v + 1, 'it names the version to start from now');
  PERFORM pg_temp.is((SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(r) k), 'changed,conflict,current,currentVersion', 'in the shape every save answers a conflict in');
  PERFORM pg_temp.is(r #>> '{current,name}', 'Harborview Dental', 'with the name as it is now');
  PERFORM pg_temp.is((r #>> '{current,employees}')::int, 60, 'and the employees');
  PERFORM pg_temp.is((SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(r -> 'current') k),
    'city,current_provider,employees,industry,name,phone,postal_code,state,states_of_operation,street,trade_name,website', 'every field a person edits, and no other');
  PERFORM pg_temp.is((SELECT string_agg(c ->> 'field', ',' ORDER BY c ->> 'field') FROM jsonb_array_elements(r -> 'changed') c), 'employees,name', 'the fields that differ from what the second person started from');
  PERFORM pg_temp.is(r #>> '{changed,0,who}', 'acme_owner@example.test', 'and who changed them, by the history''s own rule, never an id');
  PERFORM pg_temp.is(r #>> '{changed,0,at}' IS NOT NULL, true, 'and when');
  PERFORM pg_temp.is((SELECT a.name = before.name AND a.industry IS NOT DISTINCT FROM before.industry AND a.version = before.version FROM public.accounts a WHERE a.id = pg_temp.id('a1')), true, 'nothing was written');
  -- From the version now current, the second person's save goes through.
  r := pg_temp.save('acme_agent1', 'a1', v + 1, '{"name": "Harborview Group", "industry": "Dental"}');
  PERFORM pg_temp.is(r ->> 'conflict', 'false', 'a save from the version now current goes through');
  PERFORM pg_temp.is((r #>> '{record,version}')::int, v + 2, 'and raises it again');
  -- A version missing, not a version, or never reached
  PERFORM pg_temp.is(pg_temp.save_refusal('acme_agent1', 'a1', NULL), '22023: This save did not say which version of the account it started from, so it was refused. Reload the page and try again.', 'no version is refused in words');
  PERFORM pg_temp.is(pg_temp.save_refusal('acme_agent1', 'a1', 0), '22023: This save did not say which version of the account it started from, so it was refused. Reload the page and try again.', 'and so is zero');
  PERFORM pg_temp.is(pg_temp.save_refusal('acme_agent1', 'a1', -3), '22023: This save did not say which version of the account it started from, so it was refused. Reload the page and try again.', 'and a negative one');
  PERFORM pg_temp.is(pg_temp.save_refusal('acme_agent1', 'a1', v + 9), '22023: This save names a version of the account that does not exist, so it was refused. Reload the page and try again.', 'a version the account never had is not "someone else changed it"');
  RAISE NOTICE 'account_page: the version passed';
END $$;

-- ---------- the save: who may ----------
-- Break caught: a person saves an account the level rule does not give them (a colleague's, one with no owner, one the firm shows them but is not theirs); a
-- person who may not see the account is told it is there; a member of another firm, a former member, a platform admin, a guest or a signed-out caller changes
-- it; the firm the call names is not the account's; a member of two firms is guessed for; Nevermore support or a person at another firm's address changes it.
DO $$
DECLARE
  c record; v1 int := pg_temp.ver('a1'); got text; dual uuid := pg_temp.new_user('dual2'); sess uuid;
  nothere text := 'PT404: That account isn''t available';
  notmine text := '42501: Only the account''s owner, a lead of the owner''s team or an owner of the firm can change it.';
  noowner text := '42501: An account with no owner can only be changed by an owner of the firm.';
BEGIN
  FOR c IN SELECT * FROM (VALUES
    -- who, account, firm named, expected answer ('ok' for a save that goes through)
    ('acme_agent2', 'a2', 'acme', 'ok'),                       -- an agent: their own
    ('acme_lead', 'a2', 'acme', 'ok'),                         -- a lead: their team's
    ('acme_owner', 'a2', 'acme', 'ok'),                        -- an owner: the firm's
    ('acme_owner', 'a3', 'acme', 'ok'),                        -- an owner: one with no owner
    ('acme_agent1', 'a2', 'acme', nothere),                    -- an agent can't see a colleague's, so is told it is not there
    ('acme_agent1', 'a3', 'acme', nothere),                    -- nor one with no owner
    ('acme_lead', 'a1', 'acme', nothere),                      -- a lead can't see an agent's with no team
    ('acme_west', 'a2', 'acme', nothere),                      -- an agent in a team under it can't see the lead's team's
    ('acme_agent1', 'no-such', 'acme', nothere),               -- the same words for an account that is not there
    ('acme_removed', 'a1', 'acme', '42501: Not a member of that firm'),
    ('zenith_owner', 'a1', 'acme', '42501: Not a member of that firm'),
    ('zenith_owner', 'a1', 'zenith', nothere),                 -- naming their own firm for another firm's account
    ('platform_admin', 'a1', 'acme', '42501: Not a member of that firm'),
    ('nobody', 'a1', 'acme', '42501: Not a member of that firm'),
    ('anon', 'a1', 'acme', '42501'),
    -- a firm that shows everyone everything: seen is not changeable
    ('zenith_agent2', 'za', 'zenith', notmine),
    ('zenith_lead', 'za', 'zenith', notmine),
    ('zenith_agent', 'za', 'zenith', 'ok'),
    ('zenith_owner', 'za', 'zenith', 'ok')
  ) AS t (who, account, firm, want) LOOP
    got := pg_temp.save_refusal(c.who, c.account,
      CASE c.account WHEN 'a1' THEN v1 WHEN 'a2' THEN pg_temp.ver('a2') WHEN 'a3' THEN pg_temp.ver('a3') WHEN 'za' THEN pg_temp.ver('za') ELSE 1 END,
      jsonb_build_object('industry', 'Set by ' || c.who), c.firm);
    IF c.want = 'ok' OR c.want = '42501' THEN
      PERFORM pg_temp.is(CASE WHEN c.want = 'ok' THEN got ELSE substr(got, 1, 5) END, CASE WHEN c.want = 'ok' THEN 'ok' ELSE '42501' END, c.who || ' saving ' || c.account || ' naming ' || c.firm);
    ELSE
      PERFORM pg_temp.is(got, c.want, c.who || ' saving ' || c.account || ' naming ' || c.firm);
    END IF;
  END LOOP;
  PERFORM pg_temp.is((SELECT industry FROM public.accounts WHERE id = pg_temp.id('a1')) LIKE 'Set by %', false, 'an account nobody could change was not changed');
  -- An unowned account in the firm that shows everyone everything: seen by every member, changed only by an owner.
  RESET ROLE;
  PERFORM pg_temp.account('za2', 'zenith', NULL, 'Zenith Unowned');
  PERFORM pg_temp.is(pg_temp.save_refusal('zenith_agent', 'za2', 1, '{}', 'zenith'), noowner, 'an agent sees an account with no owner in this firm and is told only an owner changes it');
  PERFORM pg_temp.is(pg_temp.save_refusal('zenith_lead', 'za2', 1, '{}', 'zenith'), noowner, 'and so is a lead');
  PERFORM pg_temp.is(pg_temp.save_refusal('zenith_owner', 'za2', 1, '{}', 'zenith'), 'ok', 'an owner changes it');

  -- The firm the call acts for: named, or the person's only one. Never guessed for a member of two.
  PERFORM pg_temp.is(pg_temp.save_refusal('acme_agent2', 'a2', pg_temp.ver('a2'), '{"industry": "Firm not named"}', NULL), 'ok', 'a person with one firm need not name it');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (pg_temp.id('acme'), dual, 'owner'), (pg_temp.id('zenith'), dual, 'owner');
  PERFORM pg_temp.is(pg_temp.save_refusal('dual2', 'a2', pg_temp.ver('a2'), '{"industry": "Which firm?"}', NULL), '22023: You belong to more than one firm: say which', 'a member of two must say which');
  PERFORM pg_temp.is(pg_temp.save_refusal('dual2', 'a2', pg_temp.ver('a2'), '{"industry": "At the other address"}', 'acme', 'zenith-benefits'), '42501: Not a member of that firm', 'at the other firm''s address, the firm named is not theirs to act for');
  PERFORM pg_temp.is(pg_temp.save_refusal('dual2', 'a2', pg_temp.ver('a2'), '{"industry": "At its own address"}', 'acme', 'acme-brokers'), 'ok', 'at its own address, it is');
  DELETE FROM public.firm_memberships WHERE user_id = dual;

  -- Nevermore support reads an account and changes nothing (ADR 0024).
  PERFORM pg_temp.as_user('platform_admin');
  sess := (SELECT t.session_id FROM public.start_support_session(pg_temp.id('acme'), 'Looking at an account the firm asked about') t);
  PERFORM pg_temp.is(pg_temp.save_refusal('platform_admin', 'a2', pg_temp.ver('a2'), '{"industry": "By support"}', 'acme', 'acme-brokers'), 'PT423: Nevermore support can look, not change', 'a support session changes nothing');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.end_support_session(sess);
  RESET ROLE;
  PERFORM pg_temp.is((SELECT industry FROM public.accounts WHERE id = pg_temp.id('a2')), 'At its own address', 'and nothing was written by it');

  -- A signed-out caller and a guest can't call it: the privilege is the signed-in role's.
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.update_account(%L, 'X', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', NULL, %L, 1)$q$, pg_temp.id('a1'), pg_temp.id('acme'))), '42501', 'a signed-out caller may not call it');
  RESET ROLE;
  RAISE NOTICE 'account_page: who may save passed';
END $$;

-- ---------- the save: two sessions save from the same version ----------
-- Break caught: the save reads the account without holding its row, so a second save from the same version, waiting behind the first, reads the account as it
-- was before the first and answers a conflict that names the version it sent, with the old values and nothing in `changed` (the save that went through is
-- not named). The second session is seen WAITING on the first's row, and after it commits is answered with the first save's version, values and author.
CREATE SCHEMA race;
CREATE EXTENSION dblink SCHEMA race;

CREATE FUNCTION pg_temp.race_saves(a_who text, a_stmt text, b_who text, b_stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  dsn text := format('dbname=%s user=%s port=%s host=%s', current_database(), session_user, current_setting('port'),
    split_part(current_setting('unix_socket_directories'), ',', 1));
  b_pid integer; tries integer := 0; waited boolean := false; ra text; rb text;
BEGIN
  PERFORM race.dblink_connect('ra', dsn);
  PERFORM race.dblink_connect('rb', dsn);
  PERFORM race.dblink_exec('ra', 'SET lock_timeout = ''20s''');
  PERFORM race.dblink_exec('rb', 'SET lock_timeout = ''20s''');
  SELECT pid INTO b_pid FROM race.dblink('rb', 'SELECT pg_backend_pid()') AS t(pid integer);
  PERFORM race.dblink_exec('ra', 'BEGIN');
  PERFORM race.dblink_exec('ra', 'SET LOCAL ROLE authenticated');
  PERFORM race.dblink_exec('ra', format('SET LOCAL request.jwt.claims = %L',
    jsonb_build_object('sub', pg_temp.id(a_who), 'role', 'authenticated', 'is_anonymous', false, 'email', a_who || '@example.test')::text));
  SELECT r INTO ra FROM race.dblink('ra', a_stmt) AS t(r text);
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
  SELECT r INTO rb FROM race.dblink_get_result('rb') AS t(r text);
  BEGIN PERFORM * FROM race.dblink_get_result('rb') AS t(r text); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM race.dblink_exec('rb', 'COMMIT');
  PERFORM race.dblink_disconnect('ra');
  PERFORM race.dblink_disconnect('rb');
  RETURN CASE WHEN waited THEN 'waited' ELSE 'did not wait' END || '|' || ra || '|' || rb;
END $$;

DO $$
DECLARE
  acme uuid := pg_temp.id('acme'); a2 uuid := pg_temp.id('a2'); v integer := pg_temp.ver('a2'); r text; a jsonb; b jsonb; h bigint;
BEGIN
  RESET ROLE;
  SELECT count(*) INTO h FROM public.record_history x WHERE x.table_name = 'accounts' AND x.record_key = a2::text;
  r := pg_temp.race_saves(
    'acme_owner', format($q$SELECT public.update_account(%L, 'From owner', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', NULL, %L, %s)::text$q$, a2, acme, v),
    'acme_agent2', format($q$SELECT public.update_account(%L, 'From agent', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', NULL, %L, %s)::text$q$, a2, acme, v));
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'the second save from the same version is seen waiting for the first');
  a := split_part(r, '|', 2)::jsonb; b := split_part(r, '|', 3)::jsonb;
  PERFORM pg_temp.is((a ->> 'conflict')::boolean, false, 'the first wins');
  PERFORM pg_temp.is((b ->> 'conflict')::boolean, true, 'the second is answered with the conflict, not an overwrite');
  PERFORM pg_temp.is((b ->> 'currentVersion')::integer, v + 1, 'which carries the first''s version, not the one the second sent');
  PERFORM pg_temp.is(b -> 'current' ->> 'name', 'From owner', 'and the first''s values');
  PERFORM pg_temp.is((SELECT string_agg(c ->> 'field', ',' ORDER BY c ->> 'field') FROM jsonb_array_elements(b -> 'changed') c), 'industry,name', 'and says which fields the first save changed (its name, and the industry it cleared)');
  PERFORM pg_temp.is((SELECT string_agg(DISTINCT c ->> 'who', ',') FROM jsonb_array_elements(b -> 'changed') c), 'acme_owner@example.test', 'and who made them');
  PERFORM pg_temp.is(pg_temp.ver('a2'), v + 1, 'exactly one save raised the version');
  PERFORM pg_temp.is((SELECT name FROM public.accounts WHERE id = a2), 'From owner', 'the row holds the first save only');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history x WHERE x.table_name = 'accounts' AND x.record_key = a2::text), h + 2, 'and the history holds the first save''s two changes only');
  RAISE NOTICE 'account_page: the race passed';
END $$;

-- ---------- Indexes the page's lookups use (the account is looked up without its firm) ----------
DO $$
BEGIN
  PERFORM pg_temp.is((SELECT count(*) FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid
                       JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = i.indkey[0]
                      WHERE c.relname = 'contacts' AND c.relnamespace = 'public'::regnamespace AND a.attname = 'account_id'
                        AND i.indpred IS NULL)::int >= 1, true,
                     'contacts has a full index that leads with the account (the partial main-contact one serves only the main contact)');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid
                       JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = i.indkey[0]
                      WHERE c.relname = 'opportunities' AND c.relnamespace = 'public'::regnamespace AND a.attname = 'account_id'
                        AND i.indpred IS NULL)::int >= 1, true,
                     'opportunities has a full index that leads with the account');
  RAISE NOTICE 'account_page: the indexes passed';
END $$;
