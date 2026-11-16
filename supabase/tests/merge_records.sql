-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh merge_records
-- Merging in the database (story CRM-S4.3b; docs/BROKER_CRM_BUILD.md D-203, D-209, D-210, D-193, D-640 to D-652; 20261121100000_merge_records.sql).
-- Two accounts (their contacts, opportunities with their intakes and quotes, calls, notes, tasks, labels, placements, renewals, history), two contacts of one account,
-- "keep separate", the level rule, the kept record's old address, the recent records, and the refusals. Two firms are used throughout.
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
\i supabase/migrations/20261120111000_accounts_status_one_read.sql
\i supabase/migrations/20261120120000_opportunity_page.sql
\i supabase/migrations/20261120121000_won_lost_commission.sql
\i supabase/migrations/20261120130000_opportunity_create.sql
\i supabase/migrations/20261121090000_spot_a_duplicate.sql
\i supabase/migrations/20261121100000_merge_records.sql
\i supabase/migrations/20261121150000_epic4_after_merge_records.sql
\i supabase/migrations/20261121160000_start_the_renewal.sql
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


-- ---------- set up: two firms ----------
DO $$
DECLARE acme uuid; zenith uuid; sales uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Acme Brokers', 'acme-brokers', now()) RETURNING id INTO acme;
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Zenith Benefits', 'zenith-benefits', now()) RETURNING id INTO zenith;
  INSERT INTO fx VALUES ('acme', acme), ('zenith', zenith);
  PERFORM pg_temp.new_user('acme_owner'); PERFORM pg_temp.new_user('acme_lead'); PERFORM pg_temp.new_user('acme_agent1'); PERFORM pg_temp.new_user('acme_agent2');
  PERFORM pg_temp.new_user('acme_mate'); PERFORM pg_temp.new_user('zenith_owner'); PERFORM pg_temp.new_user('platform_admin'); PERFORM pg_temp.new_user('nobody');
  INSERT INTO public.firm_teams (firm_id, name) VALUES (acme, 'Sales') RETURNING id INTO sales;
  INSERT INTO public.firm_memberships (firm_id, user_id, role, team_id) VALUES
    (acme, pg_temp.id('acme_owner'), 'owner', NULL), (acme, pg_temp.id('acme_lead'), 'lead', sales), (acme, pg_temp.id('acme_agent1'), 'agent', NULL),
    (acme, pg_temp.id('acme_agent2'), 'agent', NULL), (acme, pg_temp.id('acme_mate'), 'agent', sales), (zenith, pg_temp.id('zenith_owner'), 'owner', NULL);
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('platform_admin'), 'admin');
END $$;

-- Runs a statement that answers text as a person; answers it, or "<sqlstate>: <message>" when it raised. Nothing the statement did before raising is kept.
CREATE FUNCTION pg_temp.as_call(who text, stmt text, addr text DEFAULT NULL) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text; s text; m text;
BEGIN
  PERFORM pg_temp.as_user(who, addr);
  BEGIN
    EXECUTE stmt INTO r;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT;
    r := s || ': ' || m;
  END;
  RESET ROLE;
  RETURN r;
END $$;

CREATE FUNCTION pg_temp.code(r text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN r ~ '^[0-9A-Z]{5}: ' THEN left(r, 5) ELSE 'ok' END $$;

-- The version of a record now.
CREATE FUNCTION pg_temp.ver(tbl text, n text) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v integer;
BEGIN
  EXECUTE format('SELECT version FROM public.%I WHERE id = %L', tbl, pg_temp.id(n)) INTO v;
  RETURN v;
END $$;

-- Merges two accounts as a person, from the versions they are at now unless told; answers the jsonb text or "<sqlstate>: <message>".
CREATE FUNCTION pg_temp.merge_a(who text, kept text, removed text, choices jsonb DEFAULT '{}', kv integer DEFAULT NULL, rv integer DEFAULT NULL, firm text DEFAULT 'acme') RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  RETURN pg_temp.as_call(who, format($q$SELECT public.merge_accounts(%L, %L, %L::jsonb, %s, %s, %L)::text$q$, pg_temp.id(kept), pg_temp.id(removed), choices,
    COALESCE(kv, pg_temp.ver('accounts', kept), 1), COALESCE(rv, pg_temp.ver('accounts', removed), 1), pg_temp.id(firm)));
END $$;

CREATE FUNCTION pg_temp.merge_c(who text, kept text, removed text, choices jsonb DEFAULT '{}', kv integer DEFAULT NULL, rv integer DEFAULT NULL, firm text DEFAULT 'acme') RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  RETURN pg_temp.as_call(who, format($q$SELECT public.merge_contacts(%L, %L, %L::jsonb, %s, %s, %L)::text$q$, pg_temp.id(kept), pg_temp.id(removed), choices,
    COALESCE(kv, pg_temp.ver('contacts', kept), 1), COALESCE(rv, pg_temp.ver('contacts', removed), 1), pg_temp.id(firm)));
END $$;

CREATE FUNCTION pg_temp.resolve(who text, kind text, n text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  r := pg_temp.as_call(who, format($q$SELECT public.resolve_merged_record(%L, %L, %L)::text$q$, pg_temp.id('acme'), kind, pg_temp.id(n)));
  RETURN r::jsonb;
END $$;

CREATE FUNCTION pg_temp.quote(intake text, peo text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_on) VALUES (pg_temp.id(intake), peo, 'sent', '2026-11-10');
$$;

-- A call, a note or a task, as the superuser, on an account and optionally a contact and an opportunity of it.
CREATE FUNCTION pg_temp.act(n text, p_kind text, p_account text, p_contact text DEFAULT NULL, p_opp text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r uuid;
BEGIN
  INSERT INTO public.activities (firm_id, account_id, kind, contact_id, opportunity_id, author_id, outcome, body, title, due_on)
  SELECT a.firm_id, a.id, p_kind, pg_temp.id(p_contact), pg_temp.id(p_opp), pg_temp.id('acme_owner'),
         CASE WHEN p_kind = 'call' THEN 'spoke' END, CASE WHEN p_kind = 'note' THEN 'Note ' || n END, CASE WHEN p_kind = 'task' THEN 'Task ' || n END,
         CASE WHEN p_kind = 'task' THEN current_date + 3 END
  FROM public.accounts a WHERE a.id = pg_temp.id(p_account) RETURNING id INTO r;
  INSERT INTO fx VALUES (n, r);
  RETURN r;
END $$;

CREATE FUNCTION pg_temp.label(p_account text, nm text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.labels (firm_id, name) SELECT a.firm_id, nm FROM public.accounts a WHERE a.id = pg_temp.id(p_account) ON CONFLICT DO NOTHING;
  INSERT INTO public.account_labels (firm_id, account_id, label_id)
  SELECT a.firm_id, a.id, l.id FROM public.accounts a JOIN public.labels l ON l.firm_id = a.firm_id AND lower(l.name) = lower(nm) WHERE a.id = pg_temp.id(p_account);
END $$;

-- How many rows the records and their history hold, to show that a refusal changed nothing.
CREATE FUNCTION pg_temp.census() RETURNS text LANGUAGE sql AS $$
  SELECT (SELECT count(*) FROM public.accounts) || '/' || (SELECT count(*) FROM public.contacts) || '/' || (SELECT count(*) FROM public.opportunities) || '/'
      || (SELECT count(*) FROM public.activities) || '/' || (SELECT count(*) FROM public.record_history) || '/' || (SELECT count(*) FROM public.merged_records)
      || '/' || (SELECT count(*) FROM public.recent_records) || '/' || (SELECT COALESCE(sum(version), 0) FROM public.accounts)
$$;

-- ---------- 1. Two accounts become one ----------
-- Break caught, one at a time: a contact, an opportunity, a call/note/task, a label, a placement or a renewal left on the removed account (or lost with it); an intake
-- or a quote request that no longer stands on its opportunity; the removed account's history not on the kept one, or not marked as from it; no "merged" entry (or two);
-- the removed account still there; its old address not leading to the kept one; a recent record left on the removed one; a mark of "possible duplicate of the removed
-- one" left to point at nothing; a main contact lost or two; a chosen value ignored, or an unchosen one changed; the version not moving.
DO $$
DECLARE
  r text; j jsonb; k_before integer; n_hist bigint;
BEGIN
  PERFORM pg_temp.account('hv', 'acme', 'acme_agent1', 'Harborview Marine', 'https://harborview.example');
  PERFORM pg_temp.account('hv2', 'acme', 'acme_agent1', 'Harborview Marine LLC');
  PERFORM pg_temp.account('third', 'acme', 'acme_agent1', 'Harborview Marine Co');
  UPDATE public.accounts SET phone = '(503) 555-0100', state = 'OR', employees = 20, industry = 'Shipping' WHERE id = pg_temp.id('hv');
  UPDATE public.accounts SET street = '1 Dock Street', city = 'Portland', employees = 25, industry = 'Marine', trade_name = 'Harborview', states_of_operation = ARRAY['OR', 'WA']
    WHERE id = pg_temp.id('hv2');
  -- The kept account is marked a possible duplicate of the removed one (as a later intake's account is, D-193); a third is marked a duplicate of the removed one too.
  UPDATE public.accounts SET possible_duplicate_of = pg_temp.id('hv2') WHERE id IN (pg_temp.id('hv'), pg_temp.id('third'));
  -- Contacts: the kept account's main contact, the removed account's main contact, and one person who is a contact of both (the same prospect).
  PERFORM pg_temp.new_user('prospect');
  PERFORM pg_temp.contact('ck_main', 'hv', 'acme_agent1', 'main@harborview.example', NULL, true);
  PERFORM pg_temp.contact('ck_pros', 'hv', 'acme_agent1', 'pat@harborview.example');
  UPDATE public.contacts SET prospect_user_id = pg_temp.id('prospect') WHERE id = pg_temp.id('ck_pros');
  PERFORM pg_temp.contact('cr_main', 'hv2', 'acme_agent1', 'boss@harborview.example', NULL, true);
  PERFORM pg_temp.contact('cr_pros', 'hv2', 'acme_agent1', 'pat@harbor.example', '(503) 555-0199');
  UPDATE public.contacts SET prospect_user_id = pg_temp.id('prospect'), title = 'Controller' WHERE id = pg_temp.id('cr_pros');
  PERFORM pg_temp.contact('cr_plain', 'hv2', 'acme_agent1', 'plain@harborview.example');
  -- Opportunities: one on the kept account, and two on the removed account, one holding its own intake with two quote requests.
  PERFORM pg_temp.intake('i_keep', 'acme'); PERFORM pg_temp.intake('i_rem', 'acme');
  PERFORM pg_temp.opportunity('o_keep', 'hv', 'acme_agent1', 'i_keep');
  PERFORM pg_temp.opportunity('o_rem', 'hv2', 'acme_agent1', 'i_rem', 'cr_pros');
  PERFORM pg_temp.opportunity('o_plain', 'hv2', 'acme_agent1', NULL, 'cr_main');
  PERFORM pg_temp.quote('i_keep', 'TriNet'); PERFORM pg_temp.quote('i_rem', 'Justworks'); PERFORM pg_temp.quote('i_rem', 'Gusto');
  -- Calls, notes and tasks: on the removed account itself, on a contact of it, on its opportunity, on a contact and an opportunity both.
  PERFORM pg_temp.act('n_acct', 'note', 'hv2'); PERFORM pg_temp.act('c_contact', 'call', 'hv2', 'cr_pros'); PERFORM pg_temp.act('t_opp', 'task', 'hv2', NULL, 'o_rem');
  PERFORM pg_temp.act('c_both', 'call', 'hv2', 'cr_main', 'o_plain'); PERFORM pg_temp.act('n_keep', 'note', 'hv');
  -- Labels (one in common), a placement from an opportunity, the renewal it made worked by the other opportunity, and recent records for three people.
  PERFORM pg_temp.label('hv', 'Marine'); PERFORM pg_temp.label('hv2', 'Marine'); PERFORM pg_temp.label('hv2', 'Priority');
  INSERT INTO public.placements (firm_id, account_id, opportunity_id, peo_name, broker_of_record) VALUES (pg_temp.id('acme'), pg_temp.id('hv2'), pg_temp.id('o_rem'), 'Alpha PEO', 'Acme');
  INSERT INTO public.renewals (firm_id, account_id, kind, with_whom, renews_on, placement_id, opportunity_id)
  SELECT pg_temp.id('acme'), pg_temp.id('hv2'), 'peo_placement', 'Alpha PEO', current_date + 60, p.id, pg_temp.id('o_plain') FROM public.placements p WHERE p.account_id = pg_temp.id('hv2');
  INSERT INTO public.recent_records (firm_id, user_id, slot, kind, record_id) VALUES
    (pg_temp.id('acme'), pg_temp.id('acme_owner'), 0, 'account', pg_temp.id('hv2')::text), (pg_temp.id('acme'), pg_temp.id('acme_agent1'), 0, 'account', pg_temp.id('hv2')::text),
    (pg_temp.id('acme'), pg_temp.id('acme_agent1'), 1, 'account', pg_temp.id('hv')::text), (pg_temp.id('acme'), pg_temp.id('acme_lead'), 0, 'account', pg_temp.id('hv')::text);
  SELECT count(*) INTO n_hist FROM public.record_history WHERE table_name = 'accounts' AND record_key = pg_temp.id('hv2')::text;
  PERFORM pg_temp.is(n_hist > 5, true, 'the removed account has a history to bring across');
  k_before := pg_temp.ver('accounts', 'hv');

  -- The merge, by the owner of the firm: the removed account's industry is chosen, the kept account's employees and owner.
  r := pg_temp.merge_a('acme_owner', 'hv', 'hv2', '{"industry": "removed", "employees": "kept", "owner": "kept"}');
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'the owner merges the two: ' || r);
  j := r::jsonb;
  PERFORM pg_temp.is(j -> 'record' ->> 'id', pg_temp.id('hv')::text, 'the answer is the kept account');
  PERFORM pg_temp.is(j -> 'removed' ->> 'name', 'Harborview Marine LLC', 'and names the removed one');
  PERFORM pg_temp.is(j -> 'moved', jsonb_build_object('contacts', 2, 'contacts_merged', 1, 'opportunities', 2, 'activities', 4, 'placements', 1, 'renewals', 1, 'labels', 1, 'commission_payments', 0),
    'and counts what moved: two contacts, one more merged into its twin, two opportunities, four calls/notes/tasks, a placement, a renewal, one label, no commission payments');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE id = pg_temp.id('hv2')), 0::bigint, 'the removed account is gone');
  -- Fields: the kept account's, but a blank takes the removed one's (street, city, trade name, states), the chosen industry is the removed one's, employees the kept one's.
  PERFORM pg_temp.is((SELECT row(name, phone, state, street, city, trade_name, industry, employees, states_of_operation)::text FROM public.accounts WHERE id = pg_temp.id('hv')),
    row('Harborview Marine', '(503) 555-0100', 'OR', '1 Dock Street', 'Portland', 'Harborview', 'Marine', 20, ARRAY['OR', 'WA'])::text, 'the kept account holds the chosen values and fills its blanks from the removed one');
  PERFORM pg_temp.is(pg_temp.ver('accounts', 'hv') > k_before, true, 'its version moved');
  PERFORM pg_temp.is((SELECT owner_id FROM public.accounts WHERE id = pg_temp.id('hv')), pg_temp.id('acme_agent1'), 'its owner is still its own (owner: kept)');
  -- Contacts: the main contact stays the kept account's; the removed account's main contact arrives as nobody's main; the twin is one contact holding both's details.
  PERFORM pg_temp.is((SELECT string_agg(f.name || CASE WHEN c.is_main THEN '*' ELSE '' END, ',' ORDER BY f.name) FROM public.contacts c JOIN fx f ON f.id = c.id WHERE c.account_id = pg_temp.id('hv')),
    'ck_main*,ck_pros,cr_main,cr_plain', 'the account holds its own contacts and the two that moved; one main contact');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE id = pg_temp.id('cr_pros')), 0::bigint, 'the twin that was the same prospect is gone');
  PERFORM pg_temp.is((SELECT row(email, phone, title)::text FROM public.contacts WHERE id = pg_temp.id('ck_pros')), row('pat@harborview.example', '(503) 555-0199', 'Controller')::text,
    'the kept twin keeps its email and takes the phone and title it lacked');
  PERFORM pg_temp.is((SELECT count(*) FROM public.activities WHERE contact_id = pg_temp.id('ck_pros')), 1::bigint, 'and the removed twin''s call');
  PERFORM pg_temp.is((SELECT main_contact_id FROM public.opportunities WHERE id = pg_temp.id('o_rem')), pg_temp.id('ck_pros'), 'the opportunity that named the removed twin names the kept one');
  -- Opportunities, with their intakes and quotes.
  PERFORM pg_temp.is((SELECT string_agg(f.name, ',' ORDER BY f.name) FROM public.opportunities o JOIN fx f ON f.id = o.id WHERE o.account_id = pg_temp.id('hv')), 'o_keep,o_plain,o_rem', 'all three opportunities are on the account');
  PERFORM pg_temp.is((SELECT string_agg(f.name, ',' ORDER BY f.name) FROM public.opportunities o JOIN fx f ON f.id = o.intake_id WHERE o.account_id = pg_temp.id('hv')), 'i_keep,i_rem', 'each intake stays on its own opportunity');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quote_requests q JOIN public.opportunities o ON o.intake_id = q.session_id WHERE o.account_id = pg_temp.id('hv')), 3::bigint, 'and its quotes');
  -- Calls, notes and tasks, placements, renewals, labels.
  PERFORM pg_temp.is((SELECT count(*) FROM public.activities WHERE account_id = pg_temp.id('hv')), 5::bigint, 'all five calls, notes and tasks are on the account, the one on the account itself too');
  PERFORM pg_temp.is((SELECT count(*) FROM public.placements WHERE account_id = pg_temp.id('hv')), 1::bigint, 'the placement');
  PERFORM pg_temp.is((SELECT count(*) FROM public.renewals WHERE account_id = pg_temp.id('hv') AND opportunity_id = pg_temp.id('o_plain') AND placement_id IS NOT NULL), 1::bigint, 'and the renewal, still tied to its opportunity and its placement');
  PERFORM pg_temp.is((SELECT string_agg(l.name, ',' ORDER BY l.name) FROM public.account_labels al JOIN public.labels l ON l.id = al.label_id WHERE al.account_id = pg_temp.id('hv')), 'Marine,Priority', 'the labels, the one in common once');
  -- The duplicate marks.
  PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE id = pg_temp.id('third')), pg_temp.id('hv'), 'an account marked a duplicate of the removed one is marked a duplicate of the kept one');
  PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE id = pg_temp.id('hv')), NULL::uuid, 'and the kept account''s own mark, which named the removed one, is gone');
  -- History: the removed account's, marked; one "merged" entry; each moved record one change of its own.
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE table_name = 'accounts' AND record_key = pg_temp.id('hv')::text AND merged_from_name = 'Harborview Marine LLC' AND kind <> 'merged'), n_hist,
    'every entry of the removed account''s history is on the kept one, each marked as from it');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE table_name = 'accounts' AND record_key = pg_temp.id('hv')::text AND merged_from_name = 'Harborview Marine LLC' AND kind = 'created'), 1::bigint,
    'its creation among them');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE table_name = 'accounts' AND record_key = pg_temp.id('hv')::text AND kind = 'merged'), 1::bigint, 'and the kept account has one "merged" entry');
  PERFORM pg_temp.is((SELECT merged_from_key FROM public.record_history WHERE table_name = 'accounts' AND record_key = pg_temp.id('hv')::text AND kind = 'merged'), pg_temp.id('hv2')::text, 'naming the removed record');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE record_key = pg_temp.id('hv2')::text), 0::bigint, 'the removed account''s own history went with it');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE table_name = 'opportunities' AND record_key = pg_temp.id('o_rem')::text AND field = 'account_id'), 1::bigint, 'a moved opportunity has one entry for the move');
  PERFORM pg_temp.is((SELECT count(DISTINCT change_id) FROM public.record_history WHERE table_name = 'contacts' AND record_key = pg_temp.id('cr_main')::text AND kind = 'changed'), 1::bigint, 'and a moved contact one change');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE table_name = 'accounts' AND record_key = pg_temp.id('hv')::text AND field = 'labels' AND merged_from_name IS NULL AND new_value = '["Marine", "Priority"]'::jsonb), 1::bigint, 'the label added is one entry on the kept account');
  PERFORM pg_temp.is((SELECT actor_id FROM public.record_history WHERE table_name = 'accounts' AND record_key = pg_temp.id('hv')::text AND kind = 'merged'), pg_temp.id('acme_owner'), 'by the person who merged');
  -- The old address, and the recent records.
  PERFORM pg_temp.is(pg_temp.resolve('acme_agent1', 'account', 'hv2'), jsonb_build_object('kind', 'account', 'id', pg_temp.id('hv'), 'name', 'Harborview Marine'), 'the old address of the removed account leads to the kept one');
  PERFORM pg_temp.is(pg_temp.resolve('acme_agent1', 'account', 'hv'), NULL::jsonb, 'a record that was never merged away resolves to nothing');
  PERFORM pg_temp.is(pg_temp.resolve('acme_agent2', 'account', 'hv2'), NULL::jsonb, 'and so does the old address to someone who may not see the kept account: nobody learns it exists');
  PERFORM pg_temp.is((SELECT string_agg(f.name || ':' || x.slot || ':' || (x.record_id = pg_temp.id('hv')::text), ',' ORDER BY f.name, x.slot) FROM public.recent_records x JOIN fx f ON f.id = x.user_id WHERE x.kind = 'account'),
    'acme_agent1:1:true,acme_lead:0:true,acme_owner:0:true', 'a recent record leads to the kept account; a person who had both has it once; no row names the removed one');
END $$;

-- ---------- 2. A record merged into one that is merged later ----------
-- Break caught: the old address of the first removed record stops at a record that is itself gone; its creation is lost on the way.
DO $$
BEGIN
  PERFORM pg_temp.account('ch_a', 'acme', 'acme_owner'); PERFORM pg_temp.account('ch_b', 'acme', 'acme_owner'); PERFORM pg_temp.account('ch_c', 'acme', 'acme_owner');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.merge_a('acme_owner', 'ch_b', 'ch_a')), 'ok', 'a into b');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.merge_a('acme_owner', 'ch_c', 'ch_b')), 'ok', 'b into c');
  PERFORM pg_temp.is(pg_temp.resolve('acme_owner', 'account', 'ch_a') ->> 'id', pg_temp.id('ch_c')::text, 'the first address leads to the last record');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE table_name = 'accounts' AND record_key = pg_temp.id('ch_c')::text AND merged_from_name = 'ch_a' AND kind = 'created'), 1::bigint,
    'and the first one''s creation is on the last, still marked as from it');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE table_name = 'accounts' AND record_key = pg_temp.id('ch_c')::text AND kind = 'merged'), 2::bigint, 'with a "merged" entry for each merge');
END $$;

-- ---------- 3. The level rule (D-209) ----------
-- Break caught: a merge by someone who may change only one of the two, or neither; a lead outside the team; an owner-less account merged by an agent.
DO $$
DECLARE r text;
BEGIN
  PERFORM pg_temp.account('l_own1', 'acme', 'acme_agent1'); PERFORM pg_temp.account('l_own1b', 'acme', 'acme_agent1'); PERFORM pg_temp.account('l_own2', 'acme', 'acme_agent2');
  PERFORM pg_temp.account('l_team', 'acme', 'acme_mate'); PERFORM pg_temp.account('l_team2', 'acme', 'acme_mate'); PERFORM pg_temp.account('l_none', 'acme', 'acme_owner');
  UPDATE public.accounts SET owner_id = NULL WHERE id = pg_temp.id('l_none');
  r := pg_temp.merge_a('acme_agent1', 'l_own1', 'l_own2');
  PERFORM pg_temp.is(pg_temp.code(r), 'PT404', 'an agent can''t even see another agent''s account: ' || r);
  UPDATE public.firms SET visibility = 'everyone' WHERE id = pg_temp.id('acme');
  r := pg_temp.merge_a('acme_agent1', 'l_own1', 'l_own2');
  PERFORM pg_temp.is(r, '42501: You can''t change l_own2, so you can''t merge it.', 'an agent who sees both but owns one is told which one, in words');
  r := pg_temp.merge_a('acme_agent1', 'l_own2', 'l_own1');
  PERFORM pg_temp.is(r, '42501: You can''t change l_own2, so you can''t merge it.', 'whichever way round');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.merge_a('acme_agent1', 'l_own1', 'l_none')), '42501', 'an agent can''t merge an account with no owner');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.merge_a('acme_lead', 'l_team', 'l_own1')), '42501', 'a lead can''t merge an account outside their team');
  r := pg_temp.merge_a('acme_lead', 'l_team', 'l_team2');
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'a lead merges two of their team''s: ' || r);
  r := pg_temp.merge_a('acme_agent1', 'l_own1', 'l_own1b');
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'an agent merges two of their own: ' || r);
  r := pg_temp.merge_a('acme_owner', 'l_own1', 'l_none');
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'an owner of the firm merges an account with no owner: ' || r);
  UPDATE public.firms SET visibility = 'by_level' WHERE id = pg_temp.id('acme');
END $$;

-- ---------- 4. Refusals, in order, and that a refusal changes nothing ----------
-- Break caught: a stranger, another firm's account, the same account twice, an archived kept account, stale versions, choices that mean nothing, a value no account may
-- hold; anything written before a refusal.
DO $$
DECLARE r text; c0 text;
BEGIN
  PERFORM pg_temp.account('r_a', 'acme', 'acme_agent1', 'Refusal A'); PERFORM pg_temp.account('r_b', 'acme', 'acme_agent1', 'Refusal B'); PERFORM pg_temp.account('r_z', 'zenith', 'zenith_owner', 'Zenith Z');
  PERFORM pg_temp.contact('r_ca', 'r_a', 'acme_agent1', 'a@example.test'); PERFORM pg_temp.contact('r_cb', 'r_b', 'acme_agent1', 'b@example.test');
  c0 := pg_temp.census();
  PERFORM pg_temp.is(pg_temp.code(pg_temp.merge_a('nobody', 'r_a', 'r_b')), '42501', 'a stranger to the firm is refused');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.merge_a('acme_owner', 'r_a', 'r_z')), 'PT404', 'another firm''s account is as not there');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.merge_a('acme_owner', 'r_z', 'r_a')), 'PT404', 'either way round');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.merge_a('acme_owner', 'r_a', 'r_z', '{}', NULL, NULL, 'zenith')), '42501', 'and naming that firm, a stranger to it');
  PERFORM pg_temp.is(pg_temp.merge_a('acme_owner', 'r_a', 'r_a'), '22023: Choose two different accounts to merge.', 'the same account twice');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.merge_a('acme_owner', 'r_a', 'r_b', '{"phone": "both"}')), '22023', 'a choice that is neither kept nor removed');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.merge_a('acme_owner', 'r_a', 'r_b', '{"nickname": "kept"}')), '22023', 'a field that can''t be chosen');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.merge_a('acme_owner', 'r_a', 'r_b', '[1]')), '22023', 'choices that are not a list of fields');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.merge_a('acme_owner', 'r_a', 'r_b', '{}', NULL, 99)), '40001', 'a version the removed account is not at');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.merge_a('acme_owner', 'r_a', 'r_b', '{}', 99, NULL)), '40001', 'or the kept one is not at');
  PERFORM pg_temp.is(pg_temp.as_call('acme_owner', format($q$SELECT public.merge_accounts(%L, %L, '{}'::jsonb, NULL, NULL, %L)::text$q$, pg_temp.id('r_a'), pg_temp.id('r_b'), pg_temp.id('acme'))) LIKE '22023: This merge did not say%', true,
    'a merge that names no versions');
  UPDATE public.accounts SET archived_at = now() WHERE id = pg_temp.id('r_a');
  c0 := pg_temp.census();
  PERFORM pg_temp.is(pg_temp.code(pg_temp.merge_a('acme_owner', 'r_a', 'r_b')), '55000', 'the account to keep can''t be archived');
  PERFORM pg_temp.is(c0, pg_temp.census(), 'every one of those changed nothing: not a record, not a history entry, not a version');
  -- A value the kept account may not hold (the removed account's phone is a legacy value the rule no longer accepts) is refused in words, before anything moves.
  UPDATE public.accounts SET archived_at = NULL WHERE id = pg_temp.id('r_a');
  ALTER TABLE public.accounts DISABLE TRIGGER accounts_phone_valid;
  UPDATE public.accounts SET phone = 'ring ring' WHERE id = pg_temp.id('r_b');
  ALTER TABLE public.accounts ENABLE TRIGGER accounts_phone_valid;
  c0 := pg_temp.census();
  r := pg_temp.merge_a('acme_owner', 'r_a', 'r_b', '{"phone": "removed"}');
  PERFORM pg_temp.is(r LIKE '22023: Enter a phone number like%', true, 'a phone the rule refuses is refused in its words, chosen or filled in: ' || r);
  PERFORM pg_temp.is(c0, pg_temp.census(), 'and nothing was merged');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.merge_a('acme_owner', 'r_a', 'r_b', '{"phone": "kept"}')), 'ok', 'merging and keeping the kept account''s blank phone goes through');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.merge_a('acme_owner', 'r_a', 'r_b')), 'PT404', 'and a removed account is as not there');
  -- An archived account can be the one removed.
  PERFORM pg_temp.account('r_arch', 'acme', 'acme_agent1'); UPDATE public.accounts SET archived_at = now() WHERE id = pg_temp.id('r_arch');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.merge_a('acme_owner', 'r_a', 'r_arch')), 'ok', 'the one to remove can be archived');
  -- Signed out, and with no right to the function.
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.merge_accounts(%L, %L)$q$, pg_temp.id('r_a'), pg_temp.id('r_b'))), '42501', 'signed out: refused');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.merge_contacts(%L, %L)$q$, pg_temp.id('r_ca'), pg_temp.id('r_cb'))), '42501', 'signed out, contacts: refused');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.account_keep_separate(%L)$q$, pg_temp.id('r_a'))), '42501', 'signed out, keep separate: refused');
  RESET ROLE;
END $$;

-- ---------- 5. Nevermore support looks and changes nothing (ADR 0024) ----------
DO $$
DECLARE r text; c0 text; j jsonb;
BEGIN
  PERFORM pg_temp.account('s_a', 'acme', 'acme_agent1'); PERFORM pg_temp.account('s_b', 'acme', 'acme_agent1');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.start_support_session(pg_temp.id('acme'), 'Customer asked for help merging two accounts');
  RESET ROLE;
  c0 := pg_temp.census();
  r := pg_temp.as_call('platform_admin', format($q$SELECT public.merge_accounts(%L, %L, '{}'::jsonb, 1, 1, %L)::text$q$, pg_temp.id('s_a'), pg_temp.id('s_b'), pg_temp.id('acme')), 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.code(r), 'PT423', 'a support session''s merge is refused: ' || r);
  r := pg_temp.as_call('platform_admin', format($q$SELECT public.account_keep_separate(%L, %L)::text$q$, pg_temp.id('s_a'), pg_temp.id('acme')), 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.code(r), 'PT423', 'and so is keeping separate: ' || r);
  j := pg_temp.as_call('platform_admin', format($q$SELECT public.merge_preview(%L, 'account', %L, %L)::text$q$, pg_temp.id('acme'), pg_temp.id('s_a'), pg_temp.id('s_b')), 'acme-brokers')::jsonb;
  PERFORM pg_temp.is(j ->> 'problem', 'You can''t change s_a, so you can''t merge it.', 'but it can read the preview, which says it may not merge');
  PERFORM pg_temp.is(c0, pg_temp.census(), 'nothing changed');
END $$;

-- ---------- 6. The preview ----------
DO $$
DECLARE j jsonb;
BEGIN
  PERFORM pg_temp.account('p_a', 'acme', 'acme_agent1', 'Preview A'); PERFORM pg_temp.account('p_b', 'acme', 'acme_agent1', 'Preview B');
  UPDATE public.accounts SET phone = '(503) 555-0111', industry = 'Retail' WHERE id = pg_temp.id('p_a');
  UPDATE public.accounts SET phone = '(503) 555-0222', industry = 'Retail' WHERE id = pg_temp.id('p_b');
  PERFORM pg_temp.contact('p_cb', 'p_b', 'acme_agent1', 'x@example.test'); PERFORM pg_temp.opportunity('p_ob', 'p_b', 'acme_agent1');
  j := pg_temp.as_call('acme_agent1', format($q$SELECT public.merge_preview(%L, 'account', %L, %L)::text$q$, pg_temp.id('acme'), pg_temp.id('p_a'), pg_temp.id('p_b')))::jsonb;
  PERFORM pg_temp.is(j ->> 'problem', NULL, 'the preview of two accounts the caller may merge has no problem');
  PERFORM pg_temp.is(j -> 'differs', '["name", "phone"]'::jsonb, 'it names the fields that differ');
  PERFORM pg_temp.is(j -> 'kept' ->> 'version', pg_temp.ver('accounts', 'p_a')::text, 'and the version of each to merge from');
  PERFORM pg_temp.is(j -> 'moves' ->> 'contacts', '1', 'what would move');
  PERFORM pg_temp.is(j -> 'moves' ->> 'opportunities', '1', 'opportunities too');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('acme_agent2', format($q$SELECT public.merge_preview(%L, 'account', %L, %L)::text$q$, pg_temp.id('acme'), pg_temp.id('p_a'), pg_temp.id('p_b')))), 'PT404',
    'a person who may not see the accounts is told they are not there');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('nobody', format($q$SELECT public.merge_preview(%L, 'account', %L, %L)::text$q$, pg_temp.id('acme'), pg_temp.id('p_a'), pg_temp.id('p_b')))), '42501', 'a stranger to the firm is refused');
  j := pg_temp.as_call('acme_owner', format($q$SELECT public.merge_preview(%L, 'contact', %L, %L)::text$q$, pg_temp.id('acme'), pg_temp.id('p_cb'), pg_temp.id('p_cb')))::jsonb;
  PERFORM pg_temp.is(j ->> 'problem', 'Choose two different contacts to merge.', 'the preview of a contact with itself says so');
END $$;

-- ---------- 7. Two contacts of one account (D-210) ----------
-- Break caught: a contact left behind with calls pointing at nothing; an opportunity whose main contact is the deleted one; the main contact lost; a "do not email" lost;
-- two contacts of two accounts merged; the level rule skipped; a contact left with no email and no phone; the removed contact's history not on the kept one.
DO $$
DECLARE r text; j jsonb; n_hist bigint; c0 text;
BEGIN
  PERFORM pg_temp.account('cm_a', 'acme', 'acme_agent1', 'Contacts A'); PERFORM pg_temp.account('cm_b', 'acme', 'acme_agent1', 'Contacts B');
  PERFORM pg_temp.contact('k1', 'cm_a', 'acme_agent1', 'kept@example.test', NULL, false);
  PERFORM pg_temp.contact('r1', 'cm_a', 'acme_agent1', 'removed@example.test', '(503) 555-0133', true);
  UPDATE public.contacts SET title = 'CFO', do_not_email = true WHERE id = pg_temp.id('r1');
  UPDATE public.contacts SET title = 'Controller' WHERE id = pg_temp.id('k1');
  PERFORM pg_temp.contact('other', 'cm_b', 'acme_agent1', 'other@example.test');
  PERFORM pg_temp.opportunity('cm_o', 'cm_a', 'acme_agent1', NULL, 'r1');
  PERFORM pg_temp.act('cm_call', 'call', 'cm_a', 'r1'); PERFORM pg_temp.act('cm_note', 'note', 'cm_a', 'r1', 'cm_o'); PERFORM pg_temp.act('cm_task', 'task', 'cm_a', 'k1');
  INSERT INTO public.recent_records (firm_id, user_id, slot, kind, record_id) VALUES (pg_temp.id('acme'), pg_temp.id('acme_agent1'), 5, 'contact', pg_temp.id('r1')::text);
  SELECT count(*) INTO n_hist FROM public.record_history WHERE table_name = 'contacts' AND record_key = pg_temp.id('r1')::text;

  PERFORM pg_temp.is(pg_temp.merge_c('acme_owner', 'k1', 'other'), '22023: Only two contacts on the same account can be merged. Move one onto the other''s account first, or merge their accounts.',
    'two contacts of two accounts are not merged, and the words say what to do');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.merge_c('acme_owner', 'k1', 'k1')), '22023', 'nor a contact with itself');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.merge_c('acme_agent2', 'k1', 'r1')), 'PT404', 'a person who may not see the account is told the contact is not there');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.merge_c('nobody', 'k1', 'r1')), '42501', 'a stranger to the firm is refused');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.merge_c('acme_owner', 'k1', 'r1', '{"phone": "maybe"}')), '22023', 'nonsense choices are refused');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.merge_c('acme_owner', 'k1', 'r1', '{}', 99)), '40001', 'a stale version is refused');
  r := pg_temp.merge_c('acme_owner', 'k1', 'r1', '{"email": "removed", "phone": "kept"}');
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'the owner merges the two: ' || r);
  j := r::jsonb;
  PERFORM pg_temp.is(j -> 'moved', '{"activities_moved": 2, "opportunities_repointed": 1}'::jsonb, 'two calls/notes and one opportunity moved to the kept contact');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE id = pg_temp.id('r1')), 0::bigint, 'the removed contact is gone');
  PERFORM pg_temp.is((SELECT row(email, phone, title, is_main, do_not_email)::text FROM public.contacts WHERE id = pg_temp.id('k1')), row('removed@example.test', NULL, 'Controller', true, true)::text,
    'the kept one holds the chosen email, its own blank phone (chosen), its title, the main-contact mark and "do not email" of either');
  PERFORM pg_temp.is((SELECT count(*) FROM public.activities WHERE contact_id = pg_temp.id('k1')), 3::bigint, 'it holds all three calls, notes and tasks');
  PERFORM pg_temp.is((SELECT main_contact_id FROM public.opportunities WHERE id = pg_temp.id('cm_o')), pg_temp.id('k1'), 'and is the opportunity''s main contact');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE table_name = 'contacts' AND record_key = pg_temp.id('k1')::text AND merged_from_name = 'First r1 Last r1' AND kind <> 'merged'), n_hist,
    'the removed contact''s history is on the kept one, marked as from it');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE table_name = 'contacts' AND record_key = pg_temp.id('k1')::text AND kind = 'merged'), 1::bigint, 'with one "merged" entry');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE table_name = 'opportunities' AND record_key = pg_temp.id('cm_o')::text AND field = 'main_contact_id'), 1::bigint,
    'the opportunity''s history shows its main contact changed once');
  PERFORM pg_temp.is(pg_temp.resolve('acme_agent1', 'contact', 'r1') ->> 'id', pg_temp.id('k1')::text, 'the removed contact''s old address leads to the kept one');
  PERFORM pg_temp.is(pg_temp.resolve('acme_agent1', 'contact', 'r1') ->> 'account_id', pg_temp.id('cm_a')::text, 'and says which account it is on');
  PERFORM pg_temp.is((SELECT record_id FROM public.recent_records WHERE kind = 'contact'), pg_temp.id('k1')::text, 'a recent record of the removed contact leads to the kept one');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE id = pg_temp.id('cm_a')), 1::bigint, 'the account is still there');

  -- The kept contact would be left with nothing to reach it by: refused in words, and nothing is merged.
  PERFORM pg_temp.contact('nothing_k', 'cm_a', 'acme_agent1', 'a@example.test'); PERFORM pg_temp.contact('nothing_r', 'cm_a', 'acme_agent1', NULL, '(503) 555-0155');
  c0 := pg_temp.census();
  r := pg_temp.merge_c('acme_owner', 'nothing_k', 'nothing_r', '{"email": "removed", "phone": "kept"}');
  PERFORM pg_temp.is(r, '22023: Enter an email or a phone number.', 'choosing two blanks is refused in the form''s words');
  PERFORM pg_temp.is(c0, pg_temp.census(), 'and nothing changed');
  r := pg_temp.merge_c('acme_owner', 'nothing_k', 'nothing_r', '{"email": "removed"}');
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'a blank chosen while the other field is filled from the removed contact goes through: ' || r);
  PERFORM pg_temp.is((SELECT email IS NULL AND phone = '(503) 555-0155' FROM public.contacts WHERE id = pg_temp.id('nothing_k')), true, 'the kept contact has no email now and the removed one''s phone');
END $$;

-- The level rule (D-209), and an opportunity the removed contact is main contact of.
DO $$
DECLARE r text; c0 text;
BEGIN
  PERFORM pg_temp.account('lv_a', 'acme', 'acme_agent1');
  PERFORM pg_temp.contact('lv_k', 'lv_a', 'acme_agent1', 'k@example.test'); PERFORM pg_temp.contact('lv_r', 'lv_a', 'acme_agent2', 'r@example.test'); PERFORM pg_temp.contact('lv_n', 'lv_a', NULL, 'n@example.test');
  PERFORM pg_temp.contact('lv_t', 'lv_a', 'acme_agent1', 't@example.test'); PERFORM pg_temp.opportunity('lv_o', 'lv_a', 'acme_agent2', NULL, 'lv_t');
  c0 := pg_temp.census();
  r := pg_temp.merge_c('acme_agent1', 'lv_k', 'lv_r');
  PERFORM pg_temp.is(r, '42501: Only the contact''s owner, a lead of the owner''s team or an owner of the firm can merge First lv_r Last lv_r.', 'an agent can''t merge a contact another agent owns');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.merge_c('acme_agent1', 'lv_r', 'lv_k')), '42501', 'whichever way round');
  PERFORM pg_temp.is(pg_temp.merge_c('acme_agent1', 'lv_k', 'lv_n'), '42501: Only an owner of the firm can merge a contact that has no owner.', 'nor one with no owner');
  r := pg_temp.merge_c('acme_agent1', 'lv_k', 'lv_t');
  PERFORM pg_temp.is(r LIKE '42501: First lv_t Last lv_t is the main contact of an opportunity you can''t change%', true, 'nor one that is the main contact of an opportunity they can''t change: ' || r);
  PERFORM pg_temp.is(c0, pg_temp.census(), 'all of that changed nothing');
  r := pg_temp.merge_c('acme_owner', 'lv_k', 'lv_t');
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'an owner of the firm may: ' || r);
  PERFORM pg_temp.is((SELECT main_contact_id FROM public.opportunities WHERE id = pg_temp.id('lv_o')), pg_temp.id('lv_k'), 'and the opportunity''s main contact is the kept one');
END $$;

-- ---------- 8. Keep separate ----------
-- Break caught: the mark left on; the other account touched; a person who may not change the account clearing it; an account with no mark "cleared"; no history of it.
DO $$
DECLARE r text; j jsonb; c0 text;
BEGIN
  PERFORM pg_temp.account('ks_old', 'acme', 'acme_agent1', 'Keep Old'); PERFORM pg_temp.account('ks_new', 'acme', 'acme_agent1', 'Keep Old Inc');
  UPDATE public.accounts SET possible_duplicate_of = pg_temp.id('ks_old') WHERE id = pg_temp.id('ks_new');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('acme_agent2', format($q$SELECT public.account_keep_separate(%L, %L)::text$q$, pg_temp.id('ks_new'), pg_temp.id('acme')))), 'PT404', 'a person who may not see the account is told it is not there');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('nobody', format($q$SELECT public.account_keep_separate(%L, %L)::text$q$, pg_temp.id('ks_new'), pg_temp.id('acme')))), '42501', 'a stranger is refused');
  UPDATE public.firms SET visibility = 'everyone' WHERE id = pg_temp.id('acme');
  r := pg_temp.as_call('acme_agent2', format($q$SELECT public.account_keep_separate(%L, %L)::text$q$, pg_temp.id('ks_new'), pg_temp.id('acme')));
  PERFORM pg_temp.is(pg_temp.code(r), '42501', 'someone who sees it but may not change it is refused (D-209): ' || r);
  UPDATE public.firms SET visibility = 'by_level' WHERE id = pg_temp.id('acme');
  c0 := pg_temp.census();
  r := pg_temp.as_call('acme_agent1', format($q$SELECT public.account_keep_separate(%L, %L)::text$q$, pg_temp.id('ks_old'), pg_temp.id('acme')));
  PERFORM pg_temp.is(r, '22023: This account isn''t marked as a possible duplicate.', 'an account with no mark has nothing to clear');
  PERFORM pg_temp.is(c0, pg_temp.census(), 'and nothing changed');
  r := pg_temp.as_call('acme_agent1', format($q$SELECT public.account_keep_separate(%L, %L)::text$q$, pg_temp.id('ks_new'), pg_temp.id('acme')));
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'the owner of the account keeps the two separate: ' || r);
  j := r::jsonb;
  PERFORM pg_temp.is(j -> 'was_duplicate_of' ->> 'name', 'Keep Old', 'the answer names the account it was a possible duplicate of');
  PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE id = pg_temp.id('ks_new')), NULL::uuid, 'the mark is gone');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE id IN (pg_temp.id('ks_old'), pg_temp.id('ks_new'))), 2::bigint, 'both accounts are still there');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE table_name = 'accounts' AND record_key = pg_temp.id('ks_new')::text AND field = 'possible_duplicate_of' AND new_value IS NULL), 1::bigint,
    'its history shows the mark taken off, once');
  PERFORM pg_temp.is(pg_temp.ver('accounts', 'ks_old'), 1, 'the other account is untouched');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('acme_agent1', format($q$SELECT public.account_keep_separate(%L, %L)::text$q$, pg_temp.id('ks_new'), pg_temp.id('acme')))), '22023', 'and clearing it again says there is no mark');
END $$;

-- A kept account with no mark takes the removed account's (the question about the third account is still open).
DO $$
BEGIN
  PERFORM pg_temp.account('in_x', 'acme', 'acme_owner'); PERFORM pg_temp.account('in_k', 'acme', 'acme_owner'); PERFORM pg_temp.account('in_r', 'acme', 'acme_owner');
  UPDATE public.accounts SET possible_duplicate_of = pg_temp.id('in_x') WHERE id = pg_temp.id('in_r');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.merge_a('acme_owner', 'in_k', 'in_r')), 'ok', 'merged');
  PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE id = pg_temp.id('in_k')), pg_temp.id('in_x'), 'the kept account takes the removed account''s open question');
END $$;

-- ---------- 9. The record of where records went is closed ----------
-- Break caught: a table the browser can read or write.
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.merged_records'), '42501', 'a member can''t read the record of merges directly');
  PERFORM pg_temp.is(pg_temp.attempt('DELETE FROM public.merged_records'), '42501', 'or delete from it');
  PERFORM pg_temp.is(pg_temp.attempt('UPDATE public.record_history SET merged_from_name = ''x'''), '42501', 'or change a history');
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.merged_records') LIKE 'rows:%', true, 'the service role reads it');
  PERFORM pg_temp.is(pg_temp.attempt('DELETE FROM public.merged_records'), '42501', 'and writes nothing');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.merged_records'::regclass), true, 'row security is on');
END $$;

-- The history reads back with where an entry came from.
DO $$
DECLARE j text;
BEGIN
  j := pg_temp.as_call('acme_owner', format($q$SELECT (SELECT jsonb_agg(jsonb_build_object('kind', kind, 'from', merged_from)) FROM public.record_history_list(%L, 'accounts', %L, 100)
    WHERE merged_from IS NOT NULL)::text$q$, pg_temp.id('acme'), pg_temp.id('ch_c')));
  PERFORM pg_temp.is(j LIKE '%"merged"%' AND j LIKE '%"ch_a"%' AND j LIKE '%"ch_b"%', true, 'a page of the history says which entries came from which merged record: ' || j);
END $$;

-- ---------- 10. A merge is one transaction ----------
-- Break caught: a failure part-way leaving half the contacts on one account and half on the other.
DO $$
DECLARE c0 text; r text;
BEGIN
  PERFORM pg_temp.account('tx_k', 'acme', 'acme_owner'); PERFORM pg_temp.account('tx_r', 'acme', 'acme_owner');
  PERFORM pg_temp.contact('tx_c1', 'tx_r', 'acme_owner', 'c1@example.test'); PERFORM pg_temp.contact('tx_c2', 'tx_r', 'acme_owner', 'c2@example.test');
  PERFORM pg_temp.opportunity('tx_o', 'tx_r', 'acme_owner');
  -- A rule that fails once the contacts have moved: an opportunity can't be on the kept account (added for this test only).
  EXECUTE format('ALTER TABLE public.opportunities ADD CONSTRAINT tx_fail CHECK (account_id <> %L)', pg_temp.id('tx_k'));
  c0 := pg_temp.census();
  r := pg_temp.merge_a('acme_owner', 'tx_k', 'tx_r');
  PERFORM pg_temp.is(pg_temp.code(r), '23514', 'a failure while the opportunities move: ' || r);
  PERFORM pg_temp.is(c0, pg_temp.census(), 'leaves everything as it was');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = pg_temp.id('tx_r')), 2::bigint, 'both contacts are still on the removed account');
  ALTER TABLE public.opportunities DROP CONSTRAINT tx_fail;
END $$;

-- ---------- 11. The removed record's copied history is not the kept record's "someone saved first" ----------
-- Break caught: record_version_changes (the conflict dialog's "what changed") picks history by the version a change was made at; a copied entry carrying the removed
-- record's own version number would be reported as a change to the kept record that never happened (its phone said to have become the removed account's).
DO $$
DECLARE r text; j jsonb; v_open integer; c jsonb;
BEGIN
  PERFORM pg_temp.account('vc_k', 'acme', 'acme_owner', 'Version Keep'); PERFORM pg_temp.account('vc_r', 'acme', 'acme_owner', 'Version Remove');
  UPDATE public.accounts SET phone = '(503) 555-0100' WHERE id = pg_temp.id('vc_k');
  UPDATE public.accounts SET phone = '(503) 555-0111' WHERE id = pg_temp.id('vc_r');
  UPDATE public.accounts SET phone = '(503) 555-0122' WHERE id = pg_temp.id('vc_r');
  PERFORM pg_temp.contact('vc_ck', 'vc_k', 'acme_owner', 'ck@example.test'); PERFORM pg_temp.contact('vc_cr', 'vc_k', 'acme_owner', 'cr@example.test');
  UPDATE public.contacts SET phone = '(503) 555-0133' WHERE id = pg_temp.id('vc_cr');
  UPDATE public.contacts SET phone = '(503) 555-0144' WHERE id = pg_temp.id('vc_cr');
  r := pg_temp.merge_a('acme_owner', 'vc_k', 'vc_r', '{"phone": "kept"}');
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'merged: ' || r);
  v_open := pg_temp.ver('accounts', 'vc_k');
  -- Someone else saves the name; a person who opened the account before that saves from the version they opened.
  r := pg_temp.as_call('acme_owner', format($q$SELECT public.update_account(%L, 'Version Keep Inc', NULL, NULL, '(503) 555-0100', NULL, NULL, NULL, NULL, NULL, NULL, '{}', NULL, %L, %s)::text$q$,
    pg_temp.id('vc_k'), pg_temp.id('acme'), v_open));
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'the first save: ' || r);
  r := pg_temp.as_call('acme_owner', format($q$SELECT public.update_account(%L, 'Version Keep Ltd', NULL, NULL, '(503) 555-0100', NULL, NULL, NULL, NULL, NULL, NULL, '{}', NULL, %L, %s)::text$q$,
    pg_temp.id('vc_k'), pg_temp.id('acme'), v_open));
  j := r::jsonb;
  PERFORM pg_temp.is(j ->> 'conflict', 'true', 'the second save, from the version it opened, is a conflict');
  PERFORM pg_temp.is((SELECT string_agg(e ->> 'field', ',' ORDER BY e ->> 'field') FROM jsonb_array_elements(j -> 'changed') e), 'name',
    'and is told only that the name changed, not the phone the removed account had changed to');
  -- The same for a contact: nothing the removed contact changed is reported against the kept one.
  r := pg_temp.merge_c('acme_owner', 'vc_ck', 'vc_cr', '{"phone": "kept"}');
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'contacts merged: ' || r);
  c := public.record_version_changes(pg_temp.id('acme'), 'contacts', pg_temp.id('vc_ck')::text, 0, 1000);
  PERFORM pg_temp.is(c, '[]'::jsonb, 'no change of the removed contact is reported as a change of the kept one');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE table_name = 'contacts' AND record_key = pg_temp.id('vc_ck')::text AND merged_from_name IS NOT NULL AND kind = 'changed'), 2::bigint,
    'while its history still lists them, marked as from it');
END $$;

-- ---------- 12. Choosing the removed record's owner follows the owner writers' rules ----------
-- Break caught: "owner: removed" giving the kept record a person who has left the firm, or no owner at all, which change_account_owner and update_contact refuse.
DO $$
DECLARE r text; c0 text;
BEGIN
  PERFORM pg_temp.new_user('gone_owner');
  INSERT INTO public.firm_memberships (firm_id, user_id, role, team_id, valid_from, valid_until)
  VALUES (pg_temp.id('acme'), pg_temp.id('gone_owner'), 'agent', NULL, now() - interval '3 days', now() - interval '1 day');
  PERFORM pg_temp.account('ow_k', 'acme', 'acme_owner'); PERFORM pg_temp.account('ow_r', 'acme', 'gone_owner'); PERFORM pg_temp.account('ow_n', 'acme', 'acme_owner');
  UPDATE public.accounts SET owner_id = NULL WHERE id = pg_temp.id('ow_n');
  c0 := pg_temp.census();
  r := pg_temp.merge_a('acme_owner', 'ow_k', 'ow_r', '{"owner": "removed"}');
  PERFORM pg_temp.is(r, '22023: Choose a current member of the firm.', 'a departed owner can''t be chosen for the kept account, in change_account_owner''s words');
  r := pg_temp.merge_a('acme_owner', 'ow_k', 'ow_n', '{"owner": "removed"}');
  PERFORM pg_temp.is(r, '22023: Choose who will own this account.', 'nor no owner at all');
  PERFORM pg_temp.is(c0, pg_temp.census(), 'and nothing was merged');
  r := pg_temp.merge_a('acme_owner', 'ow_k', 'ow_r');
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'merging without choosing it goes through: ' || r);
  PERFORM pg_temp.is((SELECT owner_id FROM public.accounts WHERE id = pg_temp.id('ow_k')), pg_temp.id('acme_owner'), 'and the kept account keeps its own owner');
  -- Contacts
  PERFORM pg_temp.account('ow_a', 'acme', 'acme_owner');
  PERFORM pg_temp.contact('ow_ck', 'ow_a', 'acme_owner', 'k@example.test'); PERFORM pg_temp.contact('ow_cr', 'ow_a', 'gone_owner', 'r@example.test'); PERFORM pg_temp.contact('ow_cn', 'ow_a', NULL, 'n@example.test');
  c0 := pg_temp.census();
  r := pg_temp.merge_c('acme_owner', 'ow_ck', 'ow_cr', '{"owner": "removed"}');
  PERFORM pg_temp.is(r, '22023: Choose one of the firm''s people as the owner.', 'a departed owner can''t be chosen for the kept contact, in update_contact''s words');
  r := pg_temp.merge_c('acme_owner', 'ow_ck', 'ow_cn', '{"owner": "removed"}');
  PERFORM pg_temp.is(r, '22023: Choose one of the firm''s people as the owner.', 'nor no owner at all');
  PERFORM pg_temp.is(c0, pg_temp.census(), 'and nothing was merged');
  r := pg_temp.merge_c('acme_owner', 'ow_ck', 'ow_cr', '{"owner": "kept"}');
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'keeping the kept contact''s owner goes through: ' || r);
  -- A current member is fine.
  PERFORM pg_temp.account('ow_k2', 'acme', 'acme_owner'); PERFORM pg_temp.account('ow_r2', 'acme', 'acme_owner');
  UPDATE public.accounts SET owner_id = pg_temp.id('acme_agent1') WHERE id = pg_temp.id('ow_r2');
  r := pg_temp.merge_a('acme_owner', 'ow_k2', 'ow_r2', '{"owner": "removed"}');
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'a current member can: ' || r);
  PERFORM pg_temp.is((SELECT owner_id FROM public.accounts WHERE id = pg_temp.id('ow_k2')), pg_temp.id('acme_agent1'), 'and becomes the owner');
END $$;

-- ---------- 13. A certification that matches an account being merged away waits for the merge ----------
-- Two real connections (dblink): the first merges and holds the removed account FOR UPDATE without committing, the second certifies an intake of the same business and is
-- seen waiting, the first commits. Break caught: the chain's new account naming the matched account at its insert, after the merge deleted it: 23503
-- accounts_possible_duplicate_of_fkey out of a trigger on the intake, so the employer's certification fails. Its helpers are chain_at_certification.sql's.
CREATE SCHEMA race;
CREATE EXTENSION dblink SCHEMA race;

CREATE FUNCTION pg_temp.new_prospect(n text, p_contact_name text DEFAULT NULL, p_phone text DEFAULT NULL, p_email text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  PERFORM pg_temp.as_owner();
  INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', COALESCE(p_email, n || '@example.test'), now(), false, now(), now());
  INSERT INTO fx VALUES (n, uid);
  UPDATE public.profiles SET contact_name = p_contact_name, phone = p_phone WHERE user_id = uid;
  PERFORM pg_temp.as_user(n);
  PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');
  RESET ROLE;
  RETURN uid;
END $$;

CREATE FUNCTION pg_temp.answers(p_company text, p_state text DEFAULT 'TX', p_extra jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'company_name', p_company, 'hq_state', p_state, 'states', jsonb_build_array(p_state, 'CA'), 'employee_count', 12, 'pay_frequency', 'bi-weekly',
    'industry', 'Dental practice', 'street_address', '500 Harbor Street, Suite 300, Austin, TX 78701', 'website', 'https://www.Harborview.example/about',
    'start_month', 'March 2027', 'in_peo', true, 'current_peo', 'Paychex PEO', 'fein', '123456789',
    'census', jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'first_name', 'Zelda', 'last_name', 'Censusperson', 'dob', '1988-03-15')))
  || p_extra
$$;

CREATE FUNCTION pg_temp.start_intake(n text, p_prospect text, p_data jsonb, p_firm text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE sid uuid;
BEGIN
  PERFORM pg_temp.as_user(p_prospect);
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (pg_temp.id(p_prospect), p_data) RETURNING id INTO sid;
  PERFORM pg_temp.as_owner();
  IF p_firm IS NOT NULL THEN UPDATE public.chamber_sessions SET firm_id = pg_temp.id(p_firm) WHERE id = sid; END IF;
  INSERT INTO fx VALUES (n, sid);
  RETURN sid;
END $$;

CREATE FUNCTION pg_temp.as_command(stmt text) RETURNS text LANGUAGE sql AS $$
  SELECT CASE WHEN stmt ~* '^SELECT ' THEN format('DO $do$ BEGIN PERFORM %s; END $do$', substr(stmt, 8)) ELSE stmt END
$$;

CREATE FUNCTION pg_temp.race_pair(a_who text, a_stmts text[], b_who text, b_stmt text, a_late text DEFAULT NULL, a_slow text DEFAULT NULL, b_delay numeric DEFAULT 0.4) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  dsn text := format('dbname=%s user=%s port=%s host=%s', current_database(), session_user, current_setting('port'),
    split_part(current_setting('unix_socket_directories'), ',', 1));
  b_pid integer; tries integer := 0; waited boolean := false; res text; late text := ''; s text; i integer; a_async boolean := false;
BEGIN
  PERFORM race.dblink_connect('ra', dsn);
  PERFORM race.dblink_connect('rb', dsn);
  PERFORM race.dblink_exec('rb', 'SET lock_timeout = ''20s''');
  PERFORM race.dblink_exec('ra', 'SET lock_timeout = ''20s''');
  SELECT pid INTO b_pid FROM race.dblink('rb', 'SELECT pg_backend_pid()') AS t(pid integer);
  PERFORM race.dblink_exec('ra', 'BEGIN');
  IF a_who IS NOT NULL THEN
    PERFORM race.dblink_exec('ra', 'SET LOCAL ROLE authenticated');
    PERFORM race.dblink_exec('ra', format('SET LOCAL request.jwt.claims = %L',
      jsonb_build_object('sub', pg_temp.id(a_who), 'role', 'authenticated', 'is_anonymous', false, 'email', a_who || '@example.test')::text));
  END IF;
  FOR i IN 1..cardinality(a_stmts) LOOP
    IF a_slow IS NOT NULL AND i = cardinality(a_stmts) THEN
      -- The last statement runs in the background and is slowed inside (a trigger sleeps `a_slow` seconds when it updates a request), so
      -- the second starts while the first is part-way through, not after it has finished.
      PERFORM race.dblink_exec('ra', format('SET LOCAL zz.slow = %L', a_slow));
      PERFORM race.dblink_send_query('ra', a_stmts[i]);
      a_async := true;
      PERFORM pg_sleep(b_delay);
    ELSE
      PERFORM race.dblink_exec('ra', pg_temp.as_command(a_stmts[i]));
    END IF;
  END LOOP;
  PERFORM race.dblink_exec('rb', 'BEGIN');
  IF b_who IS NOT NULL THEN
    PERFORM race.dblink_exec('rb', 'SET LOCAL ROLE authenticated');
    PERFORM race.dblink_exec('rb', format('SET LOCAL request.jwt.claims = %L',
      jsonb_build_object('sub', pg_temp.id(b_who), 'role', 'authenticated', 'is_anonymous', false, 'email', b_who || '@example.test')::text));
  END IF;
  PERFORM race.dblink_send_query('rb', b_stmt);
  WHILE tries < 80 LOOP
    IF cardinality(pg_blocking_pids(b_pid)) > 0 THEN waited := true; EXIT; END IF;
    IF race.dblink_is_busy('rb') = 0 THEN EXIT; END IF;
    tries := tries + 1;
    PERFORM pg_sleep(0.05);
  END LOOP;
  IF a_async THEN
    BEGIN PERFORM * FROM race.dblink_get_result('ra') AS t(r text); EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE; late := late || ' first:' || s; END;
    BEGIN PERFORM * FROM race.dblink_get_result('ra') AS t(r text); EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  IF a_late IS NOT NULL THEN
    BEGIN
      PERFORM race.dblink_exec('ra', pg_temp.as_command(a_late));
      late := ' late:ok';
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE;
      late := ' late:' || s;
    END;
  END IF;
  BEGIN PERFORM race.dblink_exec('ra', 'COMMIT'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    PERFORM * FROM race.dblink_get_result('rb') AS t(r text);
    res := 'ok';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE;
    res := s;
  END;
  BEGIN PERFORM * FROM race.dblink_get_result('rb') AS t(r text); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM race.dblink_exec('rb', 'COMMIT'); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM race.dblink_disconnect('ra');
  PERFORM race.dblink_disconnect('rb');
  RETURN CASE WHEN waited THEN 'waited:' ELSE 'did not wait:' END || res || late;
END $$;

CREATE FUNCTION pg_temp.certify_stmt(n text, p_signer text DEFAULT 'Jo Doe') RETURNS text LANGUAGE sql AS $$
  SELECT format($q$UPDATE public.chamber_sessions SET status = 'submitted', submission = jsonb_build_object('signer_name', %L, 'signer_title', 'CEO',
    'signed_at', '2026-11-01T12:00:00Z', 'consent_version', '2026-10-draft-1', 'consent_text', '["I certify."]'::jsonb, 'chamber_data', chamber_data) WHERE id = %L$q$,
    p_signer, pg_temp.id(n))
$$;


DO $$
BEGIN
  RESET ROLE;
  PERFORM pg_temp.account('rc_k', 'acme', 'acme_owner', 'Race Keep', 'https://keepsite.example');
  PERFORM pg_temp.account('rc_r', 'acme', 'acme_owner', 'Race Merge Target', 'https://www.racemerge.example');
  PERFORM pg_temp.new_prospect('rc_p');
  PERFORM pg_temp.start_intake('i_rc', 'rc_p', pg_temp.answers('Race Merge Inc', 'TX', '{"website":"https://racemerge.example/about"}'), 'acme');
END $$;

DO $$
DECLARE r text; made public.accounts;
BEGIN
  RESET ROLE;
  r := pg_temp.race_pair('acme_owner',
    ARRAY[format($q$SELECT public.merge_accounts(%L, %L, '{}'::jsonb, %s, %s, %L)$q$, pg_temp.id('rc_k'), pg_temp.id('rc_r'), pg_temp.ver('accounts', 'rc_k'), pg_temp.ver('accounts', 'rc_r'), pg_temp.id('acme'))],
    NULL, pg_temp.certify_stmt('i_rc'));
  PERFORM pg_temp.is(r, 'waited:ok', 'the certification waits for the merge and then succeeds: ' || r);
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE id = pg_temp.id('rc_r')), 0::bigint, 'the merge went through');
  PERFORM pg_temp.is((SELECT status FROM public.chamber_sessions WHERE id = pg_temp.id('i_rc')), 'submitted', 'the intake is certified');
  SELECT a.* INTO made FROM public.accounts a JOIN public.opportunities o ON o.account_id = a.id WHERE o.intake_id = pg_temp.id('i_rc');
  PERFORM pg_temp.is(made.id IS NOT NULL, true, 'and has its account');
  PERFORM pg_temp.is(made.possible_duplicate_of, pg_temp.id('rc_k'), 'which is marked a possible duplicate of the account the matched one became');
END $$;

-- ---------- Commission payments ride a merge (Epic 4's CRM-O1.3a meets this story) ----------
-- Break caught: a merge of two accounts whose removed one has a won placement with commission payments that either fails on the payments' (account, placement) key when the placement
-- moves, or deletes the payments with the removed account (money lost); a payment that arrives with another version or without its history; a preview or an answer that does not count them.
DO $$
DECLARE r text; j jsonb; pv jsonb; pl uuid; p1 uuid; p2 uuid; v_before integer[]; h_before bigint[]; sum_before numeric;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.account('cp_k', 'acme', 'acme_owner', 'Payments Keep');
  PERFORM pg_temp.account('cp_r', 'acme', 'acme_owner', 'Payments Remove');
  PERFORM pg_temp.opportunity('o_cp', 'cp_r', 'acme_owner');
  INSERT INTO public.placements (firm_id, account_id, opportunity_id, peo_name, broker_of_record) VALUES (pg_temp.id('acme'), pg_temp.id('cp_r'), pg_temp.id('o_cp'), 'Alpha PEO', 'Acme') RETURNING id INTO pl;
  INSERT INTO fx VALUES ('cp_pl', pl);
  INSERT INTO public.renewals (firm_id, account_id, kind, with_whom, renews_on, placement_id, opportunity_id)
  VALUES (pg_temp.id('acme'), pg_temp.id('cp_r'), 'peo_placement', 'Alpha PEO', current_date + 90, pl, pg_temp.id('o_cp'));
  -- Two payments through the function, the second corrected once so that its version is 2.
  r := pg_temp.as_call('acme_owner', format($q$SELECT public.record_commission_payment(%L, current_date - 20, 1200.50, 'first', %L)::text$q$, pl, pg_temp.id('acme')));
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'a payment is recorded: ' || r);
  p1 := (r::jsonb -> 'payment' ->> 'id')::uuid;
  r := pg_temp.as_call('acme_owner', format($q$SELECT public.record_commission_payment(%L, current_date - 10, 300, 'second', %L)::text$q$, pl, pg_temp.id('acme')));
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'and a second: ' || r);
  p2 := (r::jsonb -> 'payment' ->> 'id')::uuid;
  r := pg_temp.as_call('acme_owner', format($q$SELECT public.update_commission_payment(%L, current_date - 10, 350, 'second, corrected', %L, 1)::text$q$, p2, pg_temp.id('acme')));
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'the second is corrected: ' || r);
  RESET ROLE;
  SELECT array_agg(version ORDER BY id), sum(amount) INTO v_before, sum_before FROM public.commission_payments WHERE placement_id = pl;
  SELECT array_agg((SELECT count(*) FROM public.record_history h WHERE h.table_name = 'commission_payments' AND h.record_key = x.id::text) ORDER BY x.id) INTO h_before FROM public.commission_payments x WHERE x.placement_id = pl;
  PERFORM pg_temp.is(h_before[1] > 0 AND h_before[2] > 0, true, 'each payment has a history');
  PERFORM pg_temp.is(sum_before, 1550.50::numeric, 'the payments add up to what was recorded');

  -- The preview counts them.
  pv := pg_temp.as_call('acme_owner', format($q$SELECT public.merge_preview(%L, 'account', %L, %L)::text$q$, pg_temp.id('acme'), pg_temp.id('cp_k'), pg_temp.id('cp_r')))::jsonb;
  PERFORM pg_temp.is(pv -> 'moves' ->> 'commission_payments', '2', 'the preview counts the commission payments that would move');

  -- The merge keeps the money.
  r := pg_temp.merge_a('acme_owner', 'cp_k', 'cp_r');
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'two accounts merge, the removed one with a won placement and its payments: ' || r);
  j := r::jsonb;
  PERFORM pg_temp.is(j -> 'moved' ->> 'commission_payments', '2', 'the answer counts the payments that moved');
  PERFORM pg_temp.is(j -> 'moved' ->> 'placements', '1', 'and the placement');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE id = pg_temp.id('cp_r')), 0::bigint, 'the removed account is gone');
  PERFORM pg_temp.is((SELECT count(*) FROM public.commission_payments WHERE account_id = pg_temp.id('cp_k') AND placement_id = pl), 2::bigint, 'both payments survive, on the kept account and its placement');
  PERFORM pg_temp.is((SELECT sum(amount) FROM public.commission_payments WHERE placement_id = pl), sum_before, 'for the same total');
  PERFORM pg_temp.is((SELECT array_agg(version ORDER BY id) FROM public.commission_payments WHERE placement_id = pl), v_before, 'with the versions they had');
  PERFORM pg_temp.is((SELECT array_agg((SELECT count(*) FROM public.record_history h WHERE h.table_name = 'commission_payments' AND h.record_key = x.id::text) ORDER BY x.id)
    FROM public.commission_payments x WHERE x.placement_id = pl), h_before, 'and every entry of their history');
  PERFORM pg_temp.is((SELECT account_id FROM public.placements WHERE id = pl), pg_temp.id('cp_k'), 'the placement is on the kept account');
  -- They are still the kept account's to see and to change, by the functions that change them.
  r := pg_temp.as_call('acme_owner', format($q$SELECT public.update_commission_payment(%L, current_date - 20, 1300, 'first, corrected', %L, 1)::text$q$, p1, pg_temp.id('acme')));
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'a payment that moved can still be corrected: ' || r);
END $$;

SELECT 'All merge_records checks passed' AS result;
