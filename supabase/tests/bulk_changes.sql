-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh bulk_changes
-- Bulk changes in the database (story CRM-S3.7b; docs/BROKER_CRM_BUILD.md D-198, D-202, D-209, D-214, D-218, D-219, D-222; 20261119210000_bulk_changes.sql).
-- Two firms: Acme sees by level, Zenith shows everyone everything. Every migration is loaded, in order.
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
\i supabase/migrations/20261119180000_calls_notes_tasks.sql
\i supabase/migrations/20261119210000_bulk_changes.sql
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
-- Runs a statement that returns one text value as a person (at a firm's address when one is named) and says what it answered, or the SQLSTATE and words it
-- raised as "STATE: words". A refusal rolls its own work back; an answer keeps it.
CREATE FUNCTION pg_temp.run(who text, stmt text, addr text DEFAULT NULL) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text; s text; m text;
BEGIN
  PERFORM pg_temp.as_user(who, addr);
  BEGIN
    EXECUTE stmt INTO r;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT;
    RESET ROLE;
    RETURN s || ': ' || m;
  END;
  RESET ROLE;
  RETURN r;
END $$;


-- ---------- helpers ----------
CREATE FUNCTION pg_temp.arr(names text[]) RETURNS jsonb LANGUAGE sql AS $$ SELECT COALESCE(jsonb_agg(pg_temp.id(n)), '[]'::jsonb) FROM unnest(names) n $$;
-- A bulk call as a person: 'preview' | 'change', the action, its params (names of people are replaced by ids), the accounts by name; the text it answered or "STATE: words".
CREATE FUNCTION pg_temp.bulk(fn text, who text, action text, params jsonb, accts text[], firm text DEFAULT 'acme', filters jsonb DEFAULT NULL) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.run(who, format('SELECT public.bulk_accounts_%s(%L, %L, %L, %L, %L)::text', fn, pg_temp.id(firm), action, params::text,
    filters::text, CASE WHEN accts IS NULL THEN NULL ELSE pg_temp.arr(accts)::text END))
$$;
CREATE FUNCTION pg_temp.owner_p(to_who text, opps boolean DEFAULT false) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('owner_id', pg_temp.id(to_who), 'change_open_opportunities', opps)
$$;
CREATE FUNCTION pg_temp.undo(who text, change text, firm text DEFAULT 'acme') RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.run(who, format('SELECT public.bulk_accounts_undo(%L, %L)::text', change, pg_temp.id(firm)))
$$;
CREATE FUNCTION pg_temp.names_of(j jsonb) RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(string_agg(x ->> 'name', ',' ORDER BY x ->> 'name'), '') FROM jsonb_array_elements(j) x
$$;
CREATE FUNCTION pg_temp.labels_of(n text) RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(string_agg(l.name, ',' ORDER BY l.name), '') FROM public.account_labels al JOIN public.labels l ON l.id = al.label_id WHERE al.account_id = pg_temp.id(n)
$$;
CREATE FUNCTION pg_temp.owner_of(tbl text, n text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  EXECUTE format('SELECT (SELECT name FROM fx WHERE id = t.owner_id) FROM public.%I t WHERE t.id = %L', tbl, pg_temp.id(n)) INTO r;
  RETURN r;
END $$;
CREATE FUNCTION pg_temp.history(n text, fld text) RETURNS bigint LANGUAGE sql AS $$
  SELECT count(*) FROM public.record_history h WHERE h.record_key = pg_temp.id(n)::text AND h.field = fld
$$;

DO $$
BEGIN
  RESET ROLE;
  -- Acme: b1, b2, b3 are agent1's; b4 is agent2's (team Sales); b5 has no owner; b6 is west's (under Sales). Zenith: y1 (agent), y2 (agent2).
  PERFORM pg_temp.account('b1', 'acme', 'acme_agent1');
  PERFORM pg_temp.account('b2', 'acme', 'acme_agent1');
  PERFORM pg_temp.account('b3', 'acme', 'acme_agent1');
  PERFORM pg_temp.account('b4', 'acme', 'acme_agent2');
  PERFORM pg_temp.account('b5', 'acme', NULL);
  PERFORM pg_temp.account('b6', 'acme', 'acme_west');
  PERFORM pg_temp.account('y1', 'zenith', 'zenith_agent');
  PERFORM pg_temp.account('y2', 'zenith', 'zenith_agent2');
  PERFORM pg_temp.opportunity('ob1', 'b1', 'acme_agent1');
  PERFORM pg_temp.opportunity('ob1b', 'b1', 'acme_agent2');
  PERFORM pg_temp.opportunity('ob2', 'b2', 'acme_agent1');
  PERFORM pg_temp.intake('ib3', 'acme');
  PERFORM pg_temp.opportunity('ob3won', 'b3', 'acme_agent1', 'ib3');
  UPDATE public.submission_workflow SET status = 'won' WHERE session_id = pg_temp.id('ib3');
END $$;

-- ---------- the refusals that come first ----------
-- Break caught: a non-member, a former member, a closing firm or Nevermore support changes or previews; an unknown action or key, a name, a required or
-- worked-out field, or a value a field would not hold, goes through; both ids and filters, or neither, are taken; the preview changes or locks anything.
DO $$
DECLARE r text; sess uuid;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.bulk('change', 'nobody', 'archive', '{}', ARRAY['b1']), '42501: Not a member of that firm', 'a person with no firm is refused');
  PERFORM pg_temp.is(pg_temp.bulk('preview', 'acme_removed', 'archive', '{}', ARRAY['b1']), '42501: Not a member of that firm', 'so is a former member, even to preview');
  PERFORM pg_temp.is(pg_temp.bulk('change', 'zenith_owner', 'archive', '{}', ARRAY['b1'], 'acme'), '42501: Not a member of that firm', 'another firm''s owner is refused');
  PERFORM pg_temp.is(left(pg_temp.bulk('change', 'acme_agent1', 'delete', '{}', ARRAY['b1']), 6), '22023:', 'an action that is not one of the five');
  PERFORM pg_temp.is(pg_temp.bulk('change', 'acme_agent1', 'archive', '{"x":1}', ARRAY['b1']), '22023: That change does not take "x".', 'a key the action does not take');
  PERFORM pg_temp.is(pg_temp.bulk('change', 'acme_agent1', 'field', '{"field":"name","value":"X"}', ARRAY['b1']), '22023: The name is required on every account, so it can''t be set on many at once.', 'the name is never set in bulk');
  PERFORM pg_temp.is(left(pg_temp.bulk('change', 'acme_agent1', 'field', '{"field":"source","value":"lead"}', ARRAY['b1']), 6), '22023:', 'nor the source the product sets');
  PERFORM pg_temp.is(left(pg_temp.bulk('change', 'acme_agent1', 'field', '{"field":"status","value":"client"}', ARRAY['b1']), 6), '22023:', 'nor a status, which is worked out');
  PERFORM pg_temp.is(left(pg_temp.bulk('change', 'acme_agent1', 'field', '{"field":"last_activity_at","value":"x"}', ARRAY['b1']), 6), '22023:', 'nor the last activity');
  PERFORM pg_temp.is(pg_temp.bulk('change', 'acme_agent1', 'field', '{"field":"state","value":"ZZ"}', ARRAY['b1']), '22023: Choose a state from the list.', 'a state is one of the fifty and DC');
  PERFORM pg_temp.is(pg_temp.bulk('change', 'acme_agent1', 'field', '{"field":"employees","value":-3}', ARRAY['b1']), '22023: Employees must be a whole number, 0 or more.', 'employees are not negative');
  PERFORM pg_temp.is(pg_temp.bulk('change', 'acme_agent1', 'field', jsonb_build_object('field','city','value',repeat('x',101)), ARRAY['b1']), '22023: Keep the city to 100 characters.', 'a value too long for its field is refused in the account''s own words');
  PERFORM pg_temp.is(pg_temp.bulk('change', 'acme_agent1', 'label_add', '{"name":"   "}', ARRAY['b1']), '22023: Type a label.', 'a blank label');
  PERFORM pg_temp.is(pg_temp.bulk('change', 'acme_agent1', 'label_add', jsonb_build_object('name', repeat('x', 41)), ARRAY['b1']), '22023: Keep a label to 40 characters.', 'a label of 41 characters');
  PERFORM pg_temp.is(pg_temp.bulk('change', 'acme_agent1', 'owner', '{}', ARRAY['b1']), '22023: Choose who will own these accounts.', 'an owner change names nobody');
  PERFORM pg_temp.is(pg_temp.bulk('change', 'acme_agent1', 'owner', pg_temp.owner_p('acme_removed'), ARRAY['b1']), '22023: Choose a current member of the firm.', 'a former member can''t be given accounts');
  PERFORM pg_temp.is(pg_temp.bulk('change', 'acme_agent1', 'owner', pg_temp.owner_p('zenith_agent'), ARRAY['b1']), '22023: Choose a current member of the firm.', 'nor another firm''s member');
  PERFORM pg_temp.is(pg_temp.bulk('change', 'acme_agent1', 'label_remove', '{"name":"Nothing"}', ARRAY['b1']), '22023: The firm has no label called "Nothing".', 'a label the firm does not have can''t be taken off');
  PERFORM pg_temp.is(pg_temp.run('acme_agent1', format($q$SELECT public.bulk_accounts_change(%L, 'archive', '{}', NULL, NULL)::text$q$, pg_temp.id('acme'))), '22023: Choose the accounts to change.', 'neither ids nor filters');
  PERFORM pg_temp.is(pg_temp.run('acme_agent1', format($q$SELECT public.bulk_accounts_change(%L, 'archive', '{}', '{}', %L)::text$q$, pg_temp.id('acme'), pg_temp.arr(ARRAY['b1'])::text)),
    '22023: Choose the accounts by their ids or by the table''s filters, not both.', 'both');
  PERFORM pg_temp.is(pg_temp.run('acme_agent1', format($q$SELECT public.bulk_accounts_change(%L, 'archive', '{}', NULL, '[]')::text$q$, pg_temp.id('acme'))), '22023: Choose at least one account.', 'an empty list');
  PERFORM pg_temp.is(pg_temp.run('acme_agent1', format($q$SELECT public.bulk_accounts_change(%L, 'archive', '{}', '{"sql":"1"}', NULL)::text$q$, pg_temp.id('acme'))), '22023: Those filters don''t apply to this table', 'a key the filters do not have (D-44: nothing is built from it)');
  -- A closing firm and Nevermore support.
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (pg_temp.id('acme'), pg_temp.id('acme_owner'), now() + interval '30 days');
  PERFORM pg_temp.is(left(pg_temp.bulk('change', 'acme_owner', 'archive', '{}', ARRAY['b1']), 5), 'PT423', 'a closing firm changes nothing in bulk');
  PERFORM pg_temp.is(left(pg_temp.bulk('preview', 'acme_owner', 'archive', '{}', ARRAY['b1']), 5), 'PT423', 'nor previews');
  DELETE FROM public.firm_closures WHERE firm_id = pg_temp.id('acme');
  PERFORM pg_temp.as_user('platform_admin');
  sess := (SELECT t.session_id FROM public.start_support_session(pg_temp.id('acme'), 'Looking at accounts the firm asked about') t);
  PERFORM pg_temp.is(left(pg_temp.run('platform_admin', format($q$SELECT public.bulk_accounts_change(%L, 'archive', '{}', NULL, %L)::text$q$, pg_temp.id('acme'), pg_temp.arr(ARRAY['b1'])::text), 'acme-brokers'), 5), 'PT423', 'Nevermore support changes nothing in bulk');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.end_support_session(sess);
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.bulk_changes), 0::bigint, 'no refusal left a record of a change');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE archived_at IS NOT NULL), 0::bigint, 'and nothing was archived');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.bulk_accounts_change(%L, 'archive')$q$, pg_temp.id('acme'))), '42501', 'signed out has no right to run it');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.labels'), '42501', 'nor to read the labels');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.bulk_changes'), '42501', 'a member reads no bulk change but through the functions');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.account_labels'), '42501', 'nor the labels on accounts');
  RESET ROLE;
  RAISE NOTICE 'bulk_changes: refusals passed';
END $$;

-- ---------- change owner ----------
-- Break caught: the level rule is skipped or read from visibility (a lead changes an agent outside the team; an agent changes a colleague's); a skipped account
-- is not named with the reason; a skip stops the others (or the others stop on one); an owner who is not a current member is accepted; the open-opportunities
-- option changes a won opportunity, a colleague's one it may not, or counts wrongly; a refusal leaves part done; the history lacks one entry per record.
DO $$
DECLARE r jsonb; p jsonb;
BEGIN
  RESET ROLE;
  -- An agent: their own three change, the colleague's (b4) is not even seen (an id not available), no one else's is touched.
  p := pg_temp.bulk('preview', 'acme_agent1', 'owner', pg_temp.owner_p('acme_agent3', true), ARRAY['b1', 'b2', 'b3', 'b4', 'b5'])::jsonb;
  PERFORM pg_temp.is((p ->> 'will_change')::int, 3, 'the preview: three will change');
  PERFORM pg_temp.is((p ->> 'unavailable')::int, 2, 'two are not available to an agent (a colleague''s, one with no owner)');
  PERFORM pg_temp.is((p #>> '{owner,name}'), 'acme_agent3@example.test', 'it names the new owner');
  PERFORM pg_temp.is((p #>> '{opportunities,will_change}')::int, 2, 'two open opportunities of their own would go with them');
  PERFORM pg_temp.is((p #>> '{opportunities,skipped}')::int, 1, 'one of a colleague''s would be left (the won one is never in it)');
  PERFORM pg_temp.is(pg_temp.owner_of('accounts', 'b1'), 'acme_agent1', 'a preview changes nothing');
  PERFORM pg_temp.is((SELECT count(*) FROM public.bulk_changes), 0::bigint, 'and leaves no record');
  r := pg_temp.bulk('change', 'acme_agent1', 'owner', pg_temp.owner_p('acme_agent3', true), ARRAY['b1', 'b2', 'b3', 'b4', 'b5'])::jsonb;
  PERFORM pg_temp.is((r ->> 'changed')::int, 3, 'three accounts changed');
  PERFORM pg_temp.is(r -> 'change_id' IS NOT NULL AND r ->> 'undo_until' IS NOT NULL, true, 'with a change to undo, until a time');
  PERFORM pg_temp.is(pg_temp.owner_of('accounts', 'b1') || pg_temp.owner_of('accounts', 'b2') || pg_temp.owner_of('accounts', 'b3'), 'acme_agent3acme_agent3acme_agent3', 'all are agent3''s');
  PERFORM pg_temp.is(pg_temp.owner_of('accounts', 'b4') || '/' || COALESCE(pg_temp.owner_of('accounts', 'b5'), 'nobody'), 'acme_agent2/nobody', 'the others are as they were');
  PERFORM pg_temp.is(pg_temp.owner_of('opportunities', 'ob1') || pg_temp.owner_of('opportunities', 'ob2'), 'acme_agent3acme_agent3', 'their own open opportunities went too');
  PERFORM pg_temp.is(pg_temp.owner_of('opportunities', 'ob1b'), 'acme_agent2', 'a colleague''s did not');
  PERFORM pg_temp.is(pg_temp.owner_of('opportunities', 'ob3won'), 'acme_agent1', 'nor a won one');
  PERFORM pg_temp.is((r #>> '{opportunities,changed}')::int || '/' || (r #>> '{opportunities,skipped}'), '2/1', 'and the answer counts them');
  PERFORM pg_temp.is(pg_temp.history('b1', 'owner_id') || '/' || pg_temp.history('b2', 'owner_id') || '/' || pg_temp.history('b3', 'owner_id'), '1/1/1', 'one history entry for each account''s owner');
  PERFORM pg_temp.is((SELECT count(DISTINCT change_id) FROM public.record_history h WHERE h.record_key IN (pg_temp.id('b1')::text, pg_temp.id('b2')::text) AND h.field = 'owner_id'), 2::bigint, 'each its own change');
  PERFORM pg_temp.is((SELECT h.new_value #>> '{}' FROM public.record_history h WHERE h.record_key = pg_temp.id('b1')::text AND h.field = 'owner_id'), pg_temp.id('acme_agent3')::text, 'saying what it went to');
  PERFORM pg_temp.is((SELECT h.old_value #>> '{}' FROM public.record_history h WHERE h.record_key = pg_temp.id('b1')::text AND h.field = 'owner_id'), pg_temp.id('acme_agent1')::text, 'and what it came from');
  PERFORM pg_temp.is((SELECT h.actor_id FROM public.record_history h WHERE h.record_key = pg_temp.id('b1')::text AND h.field = 'owner_id'), pg_temp.id('acme_agent1'), 'and who');
  -- Undo what we did, to leave the fixture as it was (the undo has its own tests below).
  PERFORM pg_temp.undo('acme_agent1', r ->> 'change_id');

  -- A lead: their team's (b4, b6 under Sales West) change; an agent outside the team (b1) and an unowned account (b5) are skipped with the reason... but the lead does not see b5 (it has no owner): not available.
  r := pg_temp.bulk('change', 'acme_lead', 'owner', pg_temp.owner_p('acme_lead'), ARRAY['b1', 'b4', 'b5', 'b6'])::jsonb;
  PERFORM pg_temp.is((r ->> 'changed')::int, 2, 'a lead changes their team''s two');
  PERFORM pg_temp.is(pg_temp.names_of(r -> 'skipped'), '', 'what a lead does not see is not named as skipped (it is not available to them)');
  PERFORM pg_temp.is((r ->> 'unavailable')::int, 2, 'it is counted');
  PERFORM pg_temp.is(pg_temp.owner_of('accounts', 'b4') || pg_temp.owner_of('accounts', 'b6'), 'acme_leadacme_lead', 'both are the lead''s');
  PERFORM pg_temp.undo('acme_lead', r ->> 'change_id');
  PERFORM pg_temp.is(pg_temp.owner_of('accounts', 'b4') || pg_temp.owner_of('accounts', 'b6'), 'acme_agent2acme_west', 'and the undo puts them back');

  -- Where everyone sees everything (Zenith), an agent sees a colleague's account and may not change it: it is SKIPPED, named, with the reason.
  r := pg_temp.bulk('change', 'zenith_agent', 'owner', pg_temp.owner_p('zenith_agent'), ARRAY['y1', 'y2'], 'zenith')::jsonb;
  PERFORM pg_temp.is((r ->> 'changed')::int, 0, 'an agent where all is shown changes none (y1 is already theirs)');
  PERFORM pg_temp.is((r ->> 'unchanged')::int, 1, 'one is already theirs: no change, no history');
  PERFORM pg_temp.is(pg_temp.names_of(r -> 'skipped'), 'y2', 'the colleague''s is named as skipped');
  PERFORM pg_temp.is(r #>> '{skipped,0,reason}', 'Only the account''s owner, a lead of the owner''s team or an owner of the firm can change it.', 'with the words of a single change');
  PERFORM pg_temp.is(r #>> '{skipped,0,code}', 'level', 'and a code');
  PERFORM pg_temp.is(r -> 'change_id', 'null'::jsonb, 'nothing changed, so nothing to undo');
  r := pg_temp.bulk('change', 'zenith_owner', 'owner', pg_temp.owner_p('zenith_agent'), ARRAY['y1', 'y2'], 'zenith')::jsonb;
  PERFORM pg_temp.is((r ->> 'changed')::int, 1, 'an owner of the firm changes the colleague''s');
  PERFORM pg_temp.undo('zenith_owner', r ->> 'change_id', 'zenith');
  -- An owner assigns an unowned account.
  r := pg_temp.bulk('change', 'acme_owner', 'owner', pg_temp.owner_p('acme_lead'), ARRAY['b5'])::jsonb;
  PERFORM pg_temp.is((r ->> 'changed')::int, 1, 'an owner of the firm assigns an unowned account');
  PERFORM pg_temp.undo('acme_owner', r ->> 'change_id');
  PERFORM pg_temp.is(pg_temp.owner_of('accounts', 'b5') IS NULL, true, 'and undoes it');
  RAISE NOTICE 'bulk_changes: owner change passed';
END $$;

-- ---------- all or none ----------
-- Break caught: a failure part way (an owner who is removed while the change waits, a value the table's constraint refuses) leaves some accounts changed.
DO $$
DECLARE r text;
BEGIN
  RESET ROLE;
  -- The database's own check fails on the last account's row: a constraint added for the test makes the third one refuse, after two were updated.
  ALTER TABLE public.accounts ADD CONSTRAINT zz_test_refuse CHECK (name <> 'b3-poison' OR city IS NULL);
  UPDATE public.accounts SET name = 'b3-poison' WHERE id = pg_temp.id('b3');
  r := pg_temp.bulk('change', 'acme_agent1', 'field', '{"field":"city","value":"Austin"}', ARRAY['b1', 'b2', 'b3']);
  PERFORM pg_temp.is(left(r, 6), '23514:', 'the third account''s own check refuses');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE city IS NOT NULL), 0::bigint, 'and none of the three changed');
  PERFORM pg_temp.is((SELECT count(*) FROM public.bulk_changes WHERE action = 'field'), 0::bigint, 'with no record of a change');
  PERFORM pg_temp.is(pg_temp.history('b1', 'city'), 0::bigint, 'and no history');
  ALTER TABLE public.accounts DROP CONSTRAINT zz_test_refuse;
  UPDATE public.accounts SET name = 'b3' WHERE id = pg_temp.id('b3');
  RAISE NOTICE 'bulk_changes: all or none passed';
END $$;

-- ---------- the cap and the selection ----------
-- Break caught: more than 1,000 is taken (by ids or by filters); the cap is applied to what the browser says it counted, not to what the database counts; the
-- filters select what the table would not show (archived accounts, another firm's, one the caller may not see); "all" and ids both accepted.
DO $$
DECLARE r jsonb; many text;
BEGIN
  RESET ROLE;
  SELECT string_agg(quote_literal(gen_random_uuid()::text), ',') INTO many FROM generate_series(1, 1001);
  r := pg_temp.run('acme_owner', format('SELECT public.bulk_accounts_preview(%L, ''archive'', ''{}'', NULL, to_jsonb(ARRAY[%s]))::text', pg_temp.id('acme'), many))::jsonb;
  PERFORM pg_temp.is(r ->> 'too_many', 'true', 'the preview says 1,001 ids are too many');
  PERFORM pg_temp.is((r ->> 'limit')::int, 1000, 'and the limit');
  PERFORM pg_temp.is(pg_temp.run('acme_owner', format('SELECT public.bulk_accounts_change(%L, ''archive'', ''{}'', NULL, to_jsonb(ARRAY[%s]))::text', pg_temp.id('acme'), many)),
    'PT413: That is 1001 accounts. A bulk change takes at most 1,000: narrow the selection and try again.', 'the change refuses in words');
  r := pg_temp.run('acme_owner', format('SELECT public.bulk_accounts_preview(%L, ''archive'', ''{}'', NULL, to_jsonb(ARRAY[%s]))::text', pg_temp.id('acme'), replace(many, ',', ',') ))::jsonb;
  -- 1,000 is the most that is taken: 1,000 made-up ids are all unavailable.
  r := pg_temp.run('acme_owner', format('SELECT public.bulk_accounts_preview(%L, ''archive'', ''{}'', NULL, to_jsonb(ARRAY[%s]))::text', pg_temp.id('acme'),
    (SELECT string_agg(quote_literal(gen_random_uuid()::text), ',') FROM generate_series(1, 1000))))::jsonb;
  PERFORM pg_temp.is(r ->> 'too_many', 'false', '1,000 is taken');
  PERFORM pg_temp.is((r ->> 'unavailable')::int, 1000, 'and counted unavailable when none is an account');
  -- By filters: the database counts. A third firm with 1,001 accounts.
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Big Brokers', 'big-brokers', now());
  INSERT INTO fx SELECT 'big', id FROM public.firms WHERE address = 'big-brokers';
  PERFORM pg_temp.new_user('big_owner');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (pg_temp.id('big'), pg_temp.id('big_owner'), 'owner');
  INSERT INTO public.accounts (firm_id, name, source, owner_id) SELECT pg_temp.id('big'), 'Big ' || g, 'added_by_hand', pg_temp.id('big_owner') FROM generate_series(1, 1001) g;
  r := pg_temp.bulk('preview', 'big_owner', 'archive', '{}', NULL, 'big', '{"filters":[]}')::jsonb;
  PERFORM pg_temp.is(r ->> 'too_many', 'true', 'all that match, counted by the database, are 1,001: too many');
  PERFORM pg_temp.is((r ->> 'selected')::int, 1001, 'and it says how many');
  PERFORM pg_temp.is(left(pg_temp.bulk('change', 'big_owner', 'archive', '{}', NULL, 'big', '{"filters":[]}'), 5), 'PT413', 'the change is refused');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE firm_id = pg_temp.id('big') AND archived_at IS NOT NULL), 0::bigint, 'and nothing was archived');
  -- Narrowed by a filter (name contains "Big 99": 99, 990 to 999 = 11), it goes.
  r := pg_temp.bulk('change', 'big_owner', 'archive', '{}', NULL, 'big', '{"filters":[{"field":"name","op":"contains","value":"Big 99"}]}')::jsonb;
  PERFORM pg_temp.is((r ->> 'changed')::int, 11, 'a narrowed selection changes what it matches');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE firm_id = pg_temp.id('big') AND archived_at IS NOT NULL), 11::bigint, 'and only that');
  -- The table's rule: archived accounts are not in "all that match" unless a filter asks.
  r := pg_temp.bulk('preview', 'big_owner', 'archive', '{}', NULL, 'big', '{"filters":[{"field":"name","op":"contains","value":"Big 99"}]}')::jsonb;
  PERFORM pg_temp.is((r ->> 'selected')::int, 0, 'the archived ones are not selected again by the same filters');
  r := pg_temp.bulk('preview', 'big_owner', 'archive', '{}', NULL, 'big', '{"filters":[{"field":"archived","op":"is","value":true}]}')::jsonb;
  PERFORM pg_temp.is((r ->> 'selected')::int || '/' || (r ->> 'unchanged'), '11/11', 'unless a filter asks for them; they are already as asked');
  r := pg_temp.bulk('preview', 'big_owner', 'archive', '{}', NULL, 'big', '{"filters":[{"field":"name","op":"contains","value":"Big 99"}],"search":"zzz"}')::jsonb;
  PERFORM pg_temp.is((r ->> 'selected')::int, 0, 'the search narrows it as the table''s does');
  -- Another firm's accounts are never selected by filters.
  r := pg_temp.bulk('preview', 'acme_owner', 'archive', '{}', NULL, 'acme', '{"filters":[]}')::jsonb;
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE firm_id = pg_temp.id('acme') AND archived_at IS NULL)::int, (r ->> 'selected')::int, 'the owner''s "all" is the firm''s own accounts');
  -- The ids may name accounts of another firm: they are not available.
  r := pg_temp.bulk('preview', 'acme_owner', 'archive', '{}', ARRAY['b1', 'y1'])::jsonb;
  PERFORM pg_temp.is((r ->> 'will_change')::int || '/' || (r ->> 'unavailable'), '1/1', 'another firm''s account is just not available');
  RAISE NOTICE 'bulk_changes: cap and selection passed';
END $$;

-- ---------- archive ----------
-- Break caught: archiving changes more than archived_at (an opportunity's owner, the owner), or touches an account already archived (a second history entry).
DO $$
DECLARE r jsonb; h bigint;
BEGIN
  RESET ROLE;
  r := pg_temp.bulk('change', 'acme_agent1', 'archive', '{}', ARRAY['b1', 'b2'])::jsonb;
  PERFORM pg_temp.is((r ->> 'changed')::int, 2, 'two archived');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE archived_at IS NOT NULL AND id IN (pg_temp.id('b1'), pg_temp.id('b2'))), 2::bigint, 'archived_at is set');
  PERFORM pg_temp.is(pg_temp.owner_of('accounts', 'b1') || pg_temp.owner_of('opportunities', 'ob1'), 'acme_agent1acme_agent1', 'and nothing else moved');
  PERFORM pg_temp.is(pg_temp.history('b1', 'archived_at'), 1::bigint, 'one history entry each');
  h := (SELECT count(*) FROM public.record_history);
  PERFORM pg_temp.is((pg_temp.bulk('change', 'acme_agent1', 'archive', '{}', ARRAY['b1', 'b2', 'b3'])::jsonb ->> 'unchanged')::int, 2, 'archiving the archived again changes nothing');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history) - h, 1::bigint, 'and writes one entry only: for the third');
  UPDATE public.accounts SET archived_at = NULL WHERE id IN (pg_temp.id('b1'), pg_temp.id('b2'), pg_temp.id('b3'));
  RAISE NOTICE 'bulk_changes: archive passed';
END $$;

-- ---------- set a field ----------
DO $$
DECLARE r jsonb; v0 integer;
BEGIN
  RESET ROLE;
  v0 := (SELECT version FROM public.accounts WHERE id = pg_temp.id('b1'));
  r := pg_temp.bulk('change', 'acme_agent1', 'field', '{"field":"city","value":"  Austin "}', ARRAY['b1', 'b2'])::jsonb;
  PERFORM pg_temp.is((r ->> 'changed')::int, 2, 'a field is set on two accounts');
  PERFORM pg_temp.is((SELECT string_agg(city, ',') FROM public.accounts WHERE id IN (pg_temp.id('b1'), pg_temp.id('b2'))), 'Austin,Austin', 'trimmed, as the account''s form does');
  PERFORM pg_temp.is(pg_temp.history('b1', 'city') || '/' || (SELECT h.old_value IS NULL FROM public.record_history h WHERE h.record_key = pg_temp.id('b1')::text AND h.field = 'city')::text, '1/true', 'one entry, from nothing');
  PERFORM pg_temp.is((SELECT version FROM public.accounts WHERE id = pg_temp.id('b1')), v0 + 1, 'the version moved, so an open edit form conflicts rather than overwrites');
  PERFORM pg_temp.is((pg_temp.bulk('change', 'acme_agent1', 'field', '{"field":"city","value":"Austin"}', ARRAY['b1', 'b2'])::jsonb ->> 'unchanged')::int, 2, 'the same value again is no change');
  r := pg_temp.bulk('change', 'acme_agent1', 'field', '{"field":"state","value":"tx"}', ARRAY['b1'])::jsonb;
  PERFORM pg_temp.is((SELECT state FROM public.accounts WHERE id = pg_temp.id('b1')), 'TX', 'a state is kept in capitals');
  r := pg_temp.bulk('change', 'acme_agent1', 'field', '{"field":"employees","value":45}', ARRAY['b1'])::jsonb;
  PERFORM pg_temp.is((SELECT employees FROM public.accounts WHERE id = pg_temp.id('b1')), 45, 'employees');
  r := pg_temp.bulk('change', 'acme_agent1', 'field', '{"field":"states_of_operation","value":["tx"," ca","TX"]}', ARRAY['b1'])::jsonb;
  PERFORM pg_temp.is((SELECT array_to_string(states_of_operation, ',') FROM public.accounts WHERE id = pg_temp.id('b1')), 'TX,CA', 'states of operation, once each');
  r := pg_temp.bulk('change', 'acme_agent1', 'field', '{"field":"city","value":""}', ARRAY['b1'])::jsonb;
  PERFORM pg_temp.is((SELECT city IS NULL FROM public.accounts WHERE id = pg_temp.id('b1')), true, 'a blank value clears an optional field');
  r := pg_temp.bulk('change', 'acme_agent1', 'field', '{"field":"employees","value":null}', ARRAY['b1'])::jsonb;
  PERFORM pg_temp.is((SELECT employees IS NULL FROM public.accounts WHERE id = pg_temp.id('b1')), true, 'so does null');
  -- The level rule: the lead sets it on their team's and skips an agent's outside it where all is shown.
  r := pg_temp.bulk('change', 'zenith_agent', 'field', '{"field":"city","value":"Reno"}', ARRAY['y1', 'y2'], 'zenith')::jsonb;
  PERFORM pg_temp.is((r ->> 'changed')::int || '/' || pg_temp.names_of(r -> 'skipped'), '1/y2', 'where all is shown a colleague''s is skipped and named');
  RAISE NOTICE 'bulk_changes: set a field passed';
END $$;

-- ---------- labels ----------
-- Break caught: a label made twice (differing in case); a label of another firm on an account; an archived account takes a label (D-222); removing a label
-- from an archived account is refused; no history entry for a label; the skipped are not named; a label put on twice.
DO $$
DECLARE r jsonb; p jsonb;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.is(public.firm_labels(pg_temp.id('acme')) IS NOT NULL, true, 'set-up: (called as the superuser it is refused below)');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
DECLARE r jsonb; p jsonb;
BEGIN
  RESET ROLE;
  p := pg_temp.bulk('preview', 'acme_agent1', 'label_add', '{"name":"VIP"}', ARRAY['b1', 'b2', 'b3'])::jsonb;
  PERFORM pg_temp.is((SELECT count(*) FROM public.labels), 0::bigint, 'a preview makes no label');
  PERFORM pg_temp.is(p ->> 'label', 'VIP', 'it names it');
  r := pg_temp.bulk('change', 'acme_agent1', 'label_add', '{"name":"  VIP "}', ARRAY['b1', 'b2'])::jsonb;
  PERFORM pg_temp.is((r ->> 'changed')::int, 2, 'a label is put on two accounts, made by typing it');
  PERFORM pg_temp.is((SELECT string_agg(name, ',') FROM public.labels WHERE firm_id = pg_temp.id('acme')), 'VIP', 'one label, tidied');
  PERFORM pg_temp.is(pg_temp.labels_of('b1') || '/' || pg_temp.labels_of('b2'), 'VIP/VIP', 'on both');
  PERFORM pg_temp.is(pg_temp.history('b1', 'labels'), 1::bigint, 'one history entry for the account');
  PERFORM pg_temp.is((SELECT h.old_value::text || ' -> ' || h.new_value::text FROM public.record_history h WHERE h.record_key = pg_temp.id('b1')::text AND h.field = 'labels'), '[] -> ["VIP"]', 'from none to VIP');
  r := pg_temp.bulk('change', 'acme_agent1', 'label_add', '{"name":"vip"}', ARRAY['b1', 'b2', 'b3'])::jsonb;
  PERFORM pg_temp.is((r ->> 'changed')::int || '/' || (r ->> 'unchanged'), '1/2', 'the same word in other letters is the same label: two already have it');
  PERFORM pg_temp.is((SELECT count(*) FROM public.labels WHERE firm_id = pg_temp.id('acme')), 1::bigint, 'still one label');
  r := pg_temp.bulk('change', 'acme_agent1', 'label_add', '{"name":"East"}', ARRAY['b1'])::jsonb;
  PERFORM pg_temp.is((SELECT h.old_value::text || ' -> ' || h.new_value::text FROM public.record_history h WHERE h.record_key = pg_temp.id('b1')::text AND h.field = 'labels' ORDER BY h.at DESC LIMIT 1), '["VIP"] -> ["East", "VIP"]', 'a second label: the list before and after');
  -- Another firm's labels are its own.
  r := pg_temp.bulk('change', 'zenith_owner', 'label_add', '{"name":"VIP"}', ARRAY['y1'], 'zenith')::jsonb;
  PERFORM pg_temp.is((SELECT count(*) FROM public.labels WHERE lower(name) = 'vip'), 2::bigint, 'each firm has its own VIP');
  PERFORM pg_temp.is((SELECT al.label_id = (SELECT l.id FROM public.labels l WHERE l.firm_id = pg_temp.id('zenith')) FROM public.account_labels al WHERE al.account_id = pg_temp.id('y1')), true, 'y1 carries Zenith''s');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.account_labels (firm_id, account_id, label_id) VALUES (%L, %L, (SELECT id FROM public.labels WHERE firm_id = %L))$q$,
    pg_temp.id('acme'), pg_temp.id('b3'), pg_temp.id('zenith'))), '23503', 'the database refuses another firm''s label on an account');
  -- An archived account takes no new label (D-222), and is named, with the reason; a label can be taken off it.
  PERFORM pg_temp.bulk('change', 'acme_agent1', 'archive', '{}', ARRAY['b2']);
  r := pg_temp.bulk('change', 'acme_agent1', 'label_add', '{"name":"Hot"}', ARRAY['b2', 'b3'])::jsonb;
  PERFORM pg_temp.is((r ->> 'changed')::int || '/' || pg_temp.names_of(r -> 'skipped'), '1/b2', 'the archived account is skipped and named');
  PERFORM pg_temp.is(r #>> '{skipped,0,code}', 'archived', 'with its code');
  PERFORM pg_temp.is(pg_temp.labels_of('b2'), 'VIP', 'and has no new label');
  r := pg_temp.bulk('change', 'acme_agent1', 'label_remove', '{"name":"vip"}', ARRAY['b1', 'b2', 'b3'])::jsonb;
  PERFORM pg_temp.is((r ->> 'changed')::int || '/' || (r ->> 'unchanged'), '3/0', 'a label comes off three accounts, the archived one too');
  PERFORM pg_temp.is(pg_temp.labels_of('b1') || '/' || pg_temp.labels_of('b2'), 'East/', 'taken off');
  PERFORM pg_temp.is((SELECT h.old_value::text || ' -> ' || h.new_value::text FROM public.record_history h WHERE h.record_key = pg_temp.id('b2')::text AND h.field = 'labels' ORDER BY h.at DESC LIMIT 1), '["VIP"] -> []', 'the history says so');
  -- The level rule.
  r := pg_temp.bulk('change', 'zenith_agent', 'label_add', '{"name":"Warm"}', ARRAY['y1', 'y2'], 'zenith')::jsonb;
  PERFORM pg_temp.is((r ->> 'changed')::int || '/' || pg_temp.names_of(r -> 'skipped'), '1/y2', 'a colleague''s account is skipped where all is shown');
  -- firm_labels: the firm's own, alphabetically, to a member only.
  PERFORM pg_temp.is(pg_temp.run('acme_agent3', format('SELECT (SELECT string_agg(x ->> ''name'', '','') FROM jsonb_array_elements(public.firm_labels(%L)) x)', pg_temp.id('acme'))), 'East,Hot,VIP', 'a member reads the firm''s labels, alphabetically');
  PERFORM pg_temp.is(pg_temp.run('zenith_agent', format('SELECT public.firm_labels(%L)::text', pg_temp.id('acme'))), '42501: Not a member of that firm', 'another firm''s member does not');
  -- Deleting an account takes its labels and its history with it; no entry is left for it.
  PERFORM pg_temp.account('del', 'acme', 'acme_agent1');
  PERFORM pg_temp.bulk('change', 'acme_agent1', 'label_add', '{"name":"East"}', ARRAY['del']);
  PERFORM pg_temp.run('acme_agent1', format('SELECT public.delete_account(%L, %L)::text', pg_temp.id('del'), pg_temp.id('acme')));
  PERFORM pg_temp.is((SELECT count(*) FROM public.account_labels WHERE account_id = pg_temp.id('del')) + (SELECT count(*) FROM public.record_history WHERE record_key = pg_temp.id('del')::text), 0::bigint, 'a deleted account leaves no label and no history');
  RAISE NOTICE 'bulk_changes: labels passed';
END $$;

-- ---------- undo ----------
-- Break caught: undo restores a record someone changed since (their change is lost); is offered to someone else, twice, or after ten minutes; asks the level
-- rule again, so an agent who gave accounts away can't undo (they can no longer change them); puts back an owner who has left; does not name what it skipped;
-- changes a closing firm; adds a label to an archived account.
DO $$
DECLARE r jsonb; c text; u jsonb;
BEGIN
  RESET ROLE;
  -- Owner: a1 gives three to agent3; one is then given by an owner to the lead; undo restores two and names the third.
  PERFORM pg_temp.account('u1', 'acme', 'acme_agent1'); PERFORM pg_temp.account('u2', 'acme', 'acme_agent1'); PERFORM pg_temp.account('u3', 'acme', 'acme_agent1');
  PERFORM pg_temp.opportunity('uo1', 'u1', 'acme_agent1');
  r := pg_temp.bulk('change', 'acme_agent1', 'owner', pg_temp.owner_p('acme_agent3', true), ARRAY['u1', 'u2', 'u3'])::jsonb;
  c := r ->> 'change_id';
  -- The agent can no longer see the accounts they gave away.
  PERFORM pg_temp.is(pg_temp.bulk('preview', 'acme_agent1', 'archive', '{}', ARRAY['u1'])::jsonb ->> 'unavailable', '1', 'set-up: the giver no longer sees u1');
  PERFORM pg_temp.is(pg_temp.undo('acme_agent2', c), 'PT404: That change isn''t available to undo', 'another person can''t undo it');
  PERFORM pg_temp.is(pg_temp.undo('acme_owner', c), 'PT404: That change isn''t available to undo', 'not even an owner of the firm');
  PERFORM pg_temp.is(pg_temp.undo('zenith_owner', c, 'zenith'), 'PT404: That change isn''t available to undo', 'nor another firm''s member');
  PERFORM pg_temp.is(left(pg_temp.undo('acme_agent1', gen_random_uuid()::text), 5), 'PT404', 'a change that is not there');
  -- someone changes u3 since
  RESET ROLE;
  PERFORM pg_temp.is((pg_temp.bulk('change', 'acme_owner', 'owner', pg_temp.owner_p('acme_lead'), ARRAY['u3'])::jsonb ->> 'changed')::int, 1, 'set-up: an owner moves u3 on');
  u := pg_temp.undo('acme_agent1', c)::jsonb;
  PERFORM pg_temp.is((u ->> 'restored')::int, 2, 'the undo puts back two accounts');
  PERFORM pg_temp.is(pg_temp.names_of(u -> 'skipped'), 'u3', 'and names the one changed since');
  PERFORM pg_temp.is(u #>> '{skipped,0,code}', 'changed_since', 'with a code');
  PERFORM pg_temp.is(pg_temp.owner_of('accounts', 'u1') || pg_temp.owner_of('accounts', 'u2') || '/' || pg_temp.owner_of('accounts', 'u3'), 'acme_agent1acme_agent1/acme_lead', 'the giver''s two are theirs again; the later change stands');
  PERFORM pg_temp.is(pg_temp.owner_of('opportunities', 'uo1'), 'acme_agent1', 'the opportunity went back too');
  PERFORM pg_temp.is((u #>> '{opportunities,restored}')::int, 1, 'and is counted');
  PERFORM pg_temp.is(pg_temp.history('u1', 'owner_id'), 2::bigint, 'the undo is itself one history entry for each record');
  PERFORM pg_temp.is(pg_temp.undo('acme_agent1', c), 'PT409: That change was already undone.', 'a second undo is refused');
  -- Ten minutes.
  r := pg_temp.bulk('change', 'acme_agent1', 'owner', pg_temp.owner_p('acme_agent3'), ARRAY['u1'])::jsonb;
  c := r ->> 'change_id';
  PERFORM pg_temp.is(((r ->> 'undo_until')::timestamptz - now()) BETWEEN interval '9 minutes 50 seconds' AND interval '10 minutes 5 seconds', true, 'an undo lasts ten minutes');
  UPDATE public.bulk_changes SET undo_until = now() - interval '1 second' WHERE id = c::uuid;
  PERFORM pg_temp.is(pg_temp.undo('acme_agent1', c), 'PT410: That change was made more than 10 minutes ago, so it can no longer be undone.', 'after ten minutes it is refused in words');
  PERFORM pg_temp.is(pg_temp.owner_of('accounts', 'u1'), 'acme_agent3', 'and nothing was put back');
  UPDATE public.accounts SET owner_id = pg_temp.id('acme_agent1') WHERE id = pg_temp.id('u1');
  -- A previous owner who has left: their accounts are not handed back to them.
  PERFORM pg_temp.new_user('acme_leaver');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (pg_temp.id('acme'), pg_temp.id('acme_leaver'), 'agent');
  PERFORM pg_temp.account('l1', 'acme', 'acme_leaver'); PERFORM pg_temp.account('l2', 'acme', 'acme_leaver');
  r := pg_temp.bulk('change', 'acme_owner', 'owner', pg_temp.owner_p('acme_agent3'), ARRAY['l1', 'l2'])::jsonb;
  UPDATE public.firm_memberships SET valid_until = now() WHERE user_id = pg_temp.id('acme_leaver');
  u := pg_temp.undo('acme_owner', r ->> 'change_id')::jsonb;
  PERFORM pg_temp.is((u ->> 'restored')::int || '/' || pg_temp.names_of(u -> 'skipped'), '0/l1,l2', 'accounts of someone who has left are skipped and named');
  PERFORM pg_temp.is(u #>> '{skipped,0,reason}', 'Its previous owner is no longer a member of the firm.', 'with the reason');
  PERFORM pg_temp.is(pg_temp.owner_of('accounts', 'l1'), 'acme_agent3', 'and stay with their new owner');
  -- Archive: restored while still archived the same time; skipped when restored and archived again since.
  r := pg_temp.bulk('change', 'acme_owner', 'archive', '{}', ARRAY['u1', 'u2'])::jsonb;
  PERFORM pg_temp.run('acme_owner', format('SELECT public.restore_account(%L, %L)::text', pg_temp.id('u2'), pg_temp.id('acme')));
  UPDATE public.accounts SET archived_at = clock_timestamp() + interval '1 second' WHERE id = pg_temp.id('u2');   -- a later moment: this test is one transaction
  u := pg_temp.undo('acme_owner', r ->> 'change_id')::jsonb;
  PERFORM pg_temp.is((u ->> 'restored')::int || '/' || pg_temp.names_of(u -> 'skipped'), '1/u2', 'archive: the one archived again since is skipped');
  PERFORM pg_temp.is((SELECT archived_at IS NULL FROM public.accounts WHERE id = pg_temp.id('u1')), true, 'and the other is back');
  PERFORM pg_temp.run('acme_owner', format('SELECT public.restore_account(%L, %L)::text', pg_temp.id('u2'), pg_temp.id('acme')));
  -- A field: restored to what it was; a field edited since is kept.
  PERFORM pg_temp.is((pg_temp.bulk('change', 'acme_owner', 'field', '{"field":"industry","value":"Retail"}', ARRAY['u1', 'u2'])::jsonb ->> 'changed')::int, 2, 'set-up: industry');
  UPDATE public.accounts SET industry = 'Mining' WHERE id = pg_temp.id('u2');
  r := (SELECT jsonb_build_object('id', id) FROM public.bulk_changes WHERE action = 'field' ORDER BY made_at DESC, id LIMIT 1);
  u := pg_temp.undo('acme_owner', r ->> 'id')::jsonb;
  PERFORM pg_temp.is((u ->> 'restored')::int || '/' || pg_temp.names_of(u -> 'skipped'), '1/u2', 'field: the one edited since is skipped');
  PERFORM pg_temp.is((SELECT industry IS NULL FROM public.accounts WHERE id = pg_temp.id('u1')) AND (SELECT industry = 'Mining' FROM public.accounts WHERE id = pg_temp.id('u2')), true, 'u1 is as it was; u2 keeps the later edit');
  -- Labels: an added label comes off; a removed one goes back unless the account was archived since.
  PERFORM pg_temp.bulk('change', 'acme_owner', 'label_add', '{"name":"Keep"}', ARRAY['u1', 'u2']);
  r := pg_temp.bulk('change', 'acme_owner', 'label_remove', '{"name":"Keep"}', ARRAY['u1', 'u2'])::jsonb;
  PERFORM pg_temp.bulk('change', 'acme_owner', 'archive', '{}', ARRAY['u2']);
  u := pg_temp.undo('acme_owner', r ->> 'change_id')::jsonb;
  PERFORM pg_temp.is((u ->> 'restored')::int || '/' || pg_temp.names_of(u -> 'skipped'), '1/u2', 'label: not put back on an account archived since');
  PERFORM pg_temp.is(pg_temp.labels_of('u1') || '/' || pg_temp.labels_of('u2'), 'Keep/', 'u1 has it again, u2 not');
  PERFORM pg_temp.run('acme_owner', format('SELECT public.restore_account(%L, %L)::text', pg_temp.id('u2'), pg_temp.id('acme')));
  r := pg_temp.bulk('change', 'acme_owner', 'label_add', '{"name":"Fresh"}', ARRAY['u1', 'u2'])::jsonb;
  DELETE FROM public.account_labels WHERE account_id = pg_temp.id('u2') AND label_id = (SELECT id FROM public.labels WHERE name = 'Fresh');
  u := pg_temp.undo('acme_owner', r ->> 'change_id')::jsonb;
  PERFORM pg_temp.is((u ->> 'restored')::int || '/' || pg_temp.names_of(u -> 'skipped'), '1/u2', 'label: one removed since is skipped');
  PERFORM pg_temp.is(pg_temp.labels_of('u1'), 'Keep', 'and the other''s label is off');
  -- A closing firm undoes nothing.
  r := pg_temp.bulk('change', 'acme_owner', 'archive', '{}', ARRAY['u1'])::jsonb;
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (pg_temp.id('acme'), pg_temp.id('acme_owner'), now() + interval '30 days');
  PERFORM pg_temp.is(left(pg_temp.undo('acme_owner', r ->> 'change_id'), 5), 'PT423', 'a closing firm undoes nothing');
  DELETE FROM public.firm_closures WHERE firm_id = pg_temp.id('acme');
  PERFORM pg_temp.undo('acme_owner', r ->> 'change_id');
  RAISE NOTICE 'bulk_changes: undo passed';
END $$;

-- ---------- an old change is cleared; a closed firm's are deleted ----------
DO $$
BEGIN
  RESET ROLE;
  UPDATE public.bulk_changes SET made_at = now() - interval '2 days' WHERE firm_id = pg_temp.id('acme');
  PERFORM pg_temp.bulk('change', 'acme_owner', 'archive', '{}', ARRAY['b3']);
  PERFORM pg_temp.is((SELECT count(*) FROM public.bulk_changes WHERE firm_id = pg_temp.id('acme') AND made_at < now() - interval '1 day'), 0::bigint, 'changes older than a day are cleared by the next one');
  PERFORM pg_temp.is((SELECT count(*) FROM public.bulk_change_records r WHERE NOT EXISTS (SELECT 1 FROM public.bulk_changes c WHERE c.id = r.change_id)), 0::bigint, 'with their records');
  PERFORM pg_temp.is((SELECT string_agg(p.src || ':' || p.action, ',' ORDER BY p.ord) FROM public.firm_closing_plan() p WHERE p.src IN ('public.bulk_change_records', 'public.bulk_changes', 'public.account_labels', 'public.accounts', 'public.labels')),
    'public.bulk_change_records:delete,public.bulk_changes:delete,public.account_labels:delete,public.accounts:delete,public.labels:delete', 'closing a firm deletes them, the labels on accounts before the accounts and the labels after');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_closing_plan() WHERE src = 'public.activities') + (SELECT count(*) FROM public.firm_closing_plan() WHERE src IN ('public.record_history', 'public.referral_partners', 'public.contacts', 'public.opportunities')), 5::bigint, 'and every line it had is kept');
  RAISE NOTICE 'bulk_changes: clearing passed';
END $$;

-- ---------- export the selection ----------
-- "Export the selection" is export_rows(firm, 'accounts', filters, ids) (CRM-S3.8b, D-218): no second export. Break caught: the bulk bar's selection by ids exports
-- more than the ids, an account the person may not see, or above 1,000; "all that match" by filters exports archived ones or another firm's.
DO $$
DECLARE r jsonb;
BEGIN
  RESET ROLE;
  r := pg_temp.run('acme_agent1', format($q$SELECT public.export_rows(%L, 'accounts', '{}', %L)::text$q$, pg_temp.id('acme'), pg_temp.arr(ARRAY['b1', 'b2', 'b4', 'y1'])::text))::jsonb;
  PERFORM pg_temp.is((r ->> 'count')::int || '/' || (r ->> 'skipped'), '2/2', 'a selection by ids exports the person''s own accounts and counts the rest as skipped');
  PERFORM pg_temp.is((SELECT string_agg(x ->> 'name', ',' ORDER BY x ->> 'name') FROM jsonb_array_elements(r -> 'rows') x), 'b1,b2', 'exactly those');
  PERFORM pg_temp.is(left(pg_temp.run('acme_agent1', format($q$SELECT public.export_rows(%L, 'accounts', '{}', (SELECT jsonb_agg(gen_random_uuid()) FROM generate_series(1, 1001))::jsonb)::text$q$, pg_temp.id('acme'))), 6), '22023:', 'over 1,000 ids is refused');
  -- "Select all N that match" goes as filters with no ids: the whole-table path, which asks for a sign-in within 12 hours (D-218) and takes no 1,000 cap.
  PERFORM pg_temp.is(left(pg_temp.run('acme_owner', format($q$SELECT public.export_rows(%L, 'accounts', '{"filters":[]}', NULL)::text$q$, pg_temp.id('acme'))), 5), 'PT401', 'all that match asks for a recent sign-in');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.id('acme_owner'), 'role', 'authenticated', 'is_anonymous', false, 'email', 'acme_owner@example.test',
    'amr', jsonb_build_array(jsonb_build_object('method', 'oauth', 'timestamp', extract(epoch FROM now())::bigint)))::text, false);
  r := public.export_rows(pg_temp.id('acme'), 'accounts', '{"filters":[{"field":"archived","op":"is","value":true}]}', NULL);
  RESET ROLE;
  PERFORM pg_temp.is((r ->> 'count')::int, (SELECT count(*) FROM public.accounts WHERE firm_id = pg_temp.id('acme') AND archived_at IS NOT NULL)::int, 'by filters, the archived ones when the filter asks');
  RAISE NOTICE 'bulk_changes: export passed';
END $$;

-- ---------- two bulk changes over overlapping accounts can't deadlock ----------
-- Break caught: the accounts are locked in the order the person named them (or one at a time as the loop meets them) and not all at once in id order. Session A
-- holds p1 and p2 (its first call, not yet committed). Session B asks for p3, p2, p1 in that order: held in id order B waits at p1 and holds NOTHING, so A's
-- second call, on p3, goes through and A commits; B then finishes. Locked in B's order B would hold p3 while waiting for p2, and A's second call would wait for B:
-- a ring (40P01, or the 20-second lock timeout below). Also: a new label named by two bulk changes at once is made once.
CREATE SCHEMA race;
CREATE EXTENSION dblink SCHEMA race;

CREATE FUNCTION pg_temp.as_claims(who text) RETURNS text LANGUAGE sql AS $$
  SELECT format('SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = %L', jsonb_build_object('sub', pg_temp.id(who), 'role', 'authenticated', 'is_anonymous', false, 'email', who || '@example.test')::text)
$$;

CREATE FUNCTION pg_temp.race_two(a1 text, a2 text, b1 text, a_as text DEFAULT 'acme_owner') RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  dsn text := format('dbname=%s user=%s port=%s host=%s', current_database(), session_user, current_setting('port'), split_part(current_setting('unix_socket_directories'), ',', 1));
  b_pid integer; tries integer := 0; waited boolean := false; ra2 text; rb text;
BEGIN
  PERFORM race.dblink_connect('ra', dsn);
  PERFORM race.dblink_connect('rb', dsn);
  PERFORM race.dblink_exec('ra', 'SET lock_timeout = ''20s''');
  PERFORM race.dblink_exec('rb', 'SET lock_timeout = ''20s''');
  SELECT pid INTO b_pid FROM race.dblink('rb', 'SELECT pg_backend_pid()') AS t(pid integer);
  PERFORM race.dblink_exec('ra', 'BEGIN');
  IF a_as IS NOT NULL THEN PERFORM race.dblink_exec('ra', pg_temp.as_claims(a_as)); END IF;
  PERFORM race.dblink_exec('rb', 'BEGIN');
  PERFORM race.dblink_exec('rb', pg_temp.as_claims('acme_owner'));
  PERFORM * FROM race.dblink('ra', a1) AS t(r text);
  PERFORM race.dblink_send_query('rb', b1);
  WHILE tries < 80 LOOP
    IF cardinality(pg_blocking_pids(b_pid)) > 0 THEN waited := true; EXIT; END IF;
    IF race.dblink_is_busy('rb') = 0 THEN EXIT; END IF;
    tries := tries + 1;
    PERFORM pg_sleep(0.05);
  END LOOP;
  BEGIN
    PERFORM * FROM race.dblink('ra', a2) AS t(r text);
    ra2 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS ra2 = RETURNED_SQLSTATE;
  END;
  PERFORM race.dblink_exec('ra', 'COMMIT');
  BEGIN
    SELECT r INTO rb FROM race.dblink_get_result('rb') AS t(r text);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS rb = RETURNED_SQLSTATE;
  END;
  BEGIN PERFORM * FROM race.dblink_get_result('rb') AS t(r text); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM race.dblink_exec('rb', 'COMMIT');
  PERFORM race.dblink_disconnect('ra');
  PERFORM race.dblink_disconnect('rb');
  RETURN CASE WHEN waited THEN 'waited' ELSE 'did not wait' END || '|' || ra2 || '|' || COALESCE(rb, '<null>');
END $$;

-- The accounts must be committed for the other sessions to see them: made in a statement of their own.
DO $$
BEGIN
  RESET ROLE;
  PERFORM pg_temp.account('p1', 'acme', 'acme_agent1'); PERFORM pg_temp.account('p2', 'acme', 'acme_agent1'); PERFORM pg_temp.account('p3', 'acme', 'acme_agent1');
END $$;
-- p1 < p2 < p3 by id, whatever the names: the order is explicit, from the sorted ids.
CREATE TEMP TABLE pq AS SELECT row_number() OVER (ORDER BY id) AS n, id FROM public.accounts WHERE id IN (pg_temp.id('p1'), pg_temp.id('p2'), pg_temp.id('p3'));

DO $$
DECLARE r text; firm uuid := pg_temp.id('acme');
BEGIN
  RESET ROLE;
  r := pg_temp.race_two(
    format($q$SELECT public.bulk_accounts_change(%L, 'field', '{"field":"city","value":"A"}', NULL, %L)::text$q$, firm, (SELECT jsonb_agg(id ORDER BY n) FROM pq WHERE n <= 2)::text),
    format($q$SELECT public.bulk_accounts_change(%L, 'field', '{"field":"city","value":"A"}', NULL, %L)::text$q$, firm, (SELECT jsonb_agg(id) FROM pq WHERE n = 3)::text),
    format($q$SELECT public.bulk_accounts_change(%L, 'field', '{"field":"industry","value":"B"}', NULL, %L)::text$q$, firm, (SELECT jsonb_agg(id ORDER BY n DESC) FROM pq)::text));
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'the second change waits for the first at the account they share');
  PERFORM pg_temp.is(split_part(r, '|', 2), 'ok', 'the first, asking for a third account meanwhile, is not made to wait for the second: no ring');
  PERFORM pg_temp.is(left(split_part(r, '|', 3), 1), '{', 'and the second then completes, with no deadlock');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE industry = 'B' AND city = 'A' AND id IN (SELECT id FROM pq)), 3::bigint, 'both changes took effect on all three');
  RAISE NOTICE 'bulk_changes: lock order passed';
END $$;

-- A word made by two bulk changes at once is one label.
DO $$
DECLARE r text; firm uuid := pg_temp.id('acme');
BEGIN
  RESET ROLE;
  r := pg_temp.race_two(
    format($q$SELECT public.bulk_accounts_change(%L, 'label_add', '{"name":"Twice"}', NULL, %L)::text$q$, firm, pg_temp.arr(ARRAY['p1'])::text),
    'SELECT 1',
    format($q$SELECT public.bulk_accounts_change(%L, 'label_add', '{"name":"twice"}', NULL, %L)::text$q$, firm, pg_temp.arr(ARRAY['p2'])::text));
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'the second change waits for the first to make the word');
  PERFORM pg_temp.is(left(split_part(r, '|', 3), 1), '{', 'and then uses it');
  PERFORM pg_temp.is((SELECT count(*) FROM public.labels WHERE firm_id = pg_temp.id('acme') AND lower(name) = 'twice'), 1::bigint, 'one label, made once');
  PERFORM pg_temp.is(pg_temp.labels_of('p1') || '/' || pg_temp.labels_of('p2'), 'Twice/Twice', 'on both accounts, in the first spelling');
  RAISE NOTICE 'bulk_changes: label race passed';
END $$;

-- ---------- the Label column and filter on the accounts table ----------
-- Break caught: a row without its labels; a filter on a label that ignores case, or matches another firm's label of the same word; "none of" / "is empty" wrong;
-- a sort on labels that does nothing; "all that match" by a label filter selecting more than the table shows.
DO $$
DECLARE r jsonb; names text;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.bulk('change', 'acme_owner', 'label_add', '{"name":"Zed"}', ARRAY['b6', 'b4']);
  PERFORM pg_temp.bulk('change', 'acme_owner', 'label_add', '{"name":"East"}', ARRAY['b4']);
  r := pg_temp.run('acme_owner', format($q$SELECT public.accounts_list(%L, '[{"field":"labels","op":"any_of","value":["EAST"]}]')::text$q$, pg_temp.id('acme')))::jsonb;
  PERFORM pg_temp.is((SELECT string_agg(x ->> 'name', ',' ORDER BY x ->> 'name') FROM jsonb_array_elements(r -> 'rows') x), 'b1,b4', 'a filter on a label, ignoring case, finds the accounts that carry it');
  PERFORM pg_temp.is((SELECT x -> 'labels' FROM jsonb_array_elements(r -> 'rows') x WHERE x ->> 'name' = 'b4'), '["East", "Zed"]'::jsonb, 'each row carries its labels, alphabetically');
  r := pg_temp.run('acme_owner', format($q$SELECT public.accounts_list(%L, '[{"field":"labels","op":"none_of","value":["east"]},{"field":"name","op":"contains","value":"b"}]')::text$q$, pg_temp.id('acme')))::jsonb;
  PERFORM pg_temp.is((SELECT bool_and((x -> 'labels') <> '["East"]'::jsonb AND NOT (x -> 'labels') @> '["East"]'::jsonb) FROM jsonb_array_elements(r -> 'rows') x), true, 'none of leaves out the accounts that carry it');
  r := pg_temp.run('acme_owner', format($q$SELECT public.accounts_list(%L, '[{"field":"labels","op":"is_empty"},{"field":"name","op":"contains","value":"b"}]')::text$q$, pg_temp.id('acme')))::jsonb;
  PERFORM pg_temp.is((SELECT bool_and(jsonb_array_length(x -> 'labels') = 0) FROM jsonb_array_elements(r -> 'rows') x), true, 'is empty finds the accounts with none');
  r := pg_temp.run('zenith_owner', format($q$SELECT public.accounts_list(%L, '[{"field":"labels","op":"any_of","value":["East"]}]')::text$q$, pg_temp.id('zenith')))::jsonb;
  PERFORM pg_temp.is((r ->> 'total')::int, 0, 'another firm''s accounts do not carry this firm''s label');
  r := pg_temp.run('acme_owner', format($q$SELECT public.accounts_list(%L, '[{"field":"name","op":"contains","value":"b"},{"field":"labels","op":"any_of","value":["east","zed"]}]', 'labels', 'asc')::text$q$, pg_temp.id('acme')))::jsonb;
  names := (SELECT string_agg(x ->> 'name', ',' ORDER BY ord) FROM jsonb_array_elements(r -> 'rows') WITH ORDINALITY AS t (x, ord));
  PERFORM pg_temp.is(names, 'b1,b4,b6', 'sorted by labels as a line of text: East, then East Zed, then Zed');
  -- "Select all that match" by the label filter: the same accounts the table shows.
  r := pg_temp.bulk('preview', 'acme_owner', 'field', '{"field":"city","value":"Oslo"}', NULL, 'acme', '{"filters":[{"field":"labels","op":"any_of","value":["east"]}]}')::jsonb;
  PERFORM pg_temp.is((r ->> 'selected')::int, 2, 'the bulk selection by a label filter is the table''s');
  RAISE NOTICE 'bulk_changes: label column and filter passed';
END $$;


-- ---------- the undo's locks (D-32) ----------
-- Break caught, one for each lock the undo takes: without the change's row held, two undos of one change at once both put it back; without the accounts held, an
-- undo overwrites a change another person is making to the same account; without the previous owners' memberships held (FOR SHARE), an undo gives an account back
-- to a person whose removal has not committed; without the opportunities held, it overwrites an opportunity's owner being changed. Each is seen WAITING (a
-- pg_blocking_pids barrier) and then answering as if the other had come first. The changes below are made, and committed, before each race.
DO $$
BEGIN
  RESET ROLE;
  PERFORM pg_temp.new_user('acme_prev'); PERFORM pg_temp.new_user('acme_other');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (pg_temp.id('acme'), pg_temp.id('acme_prev'), 'agent'), (pg_temp.id('acme'), pg_temp.id('acme_other'), 'agent');
  PERFORM pg_temp.account('k1', 'acme', 'acme_prev'); PERFORM pg_temp.account('k2', 'acme', 'acme_agent1'); PERFORM pg_temp.account('k3', 'acme', 'acme_agent1');
  PERFORM pg_temp.account('k4', 'acme', 'acme_agent1');
  PERFORM pg_temp.opportunity('ko4', 'k4', 'acme_agent1');
END $$;
DO $$
BEGIN
  RESET ROLE;
  CREATE TEMP TABLE kc (n text PRIMARY KEY, id text);
  INSERT INTO kc VALUES
    ('prev', pg_temp.bulk('change', 'acme_owner', 'owner', pg_temp.owner_p('acme_agent3'), ARRAY['k1'])::jsonb ->> 'change_id'),
    ('other', pg_temp.bulk('change', 'acme_owner', 'owner', pg_temp.owner_p('acme_agent3'), ARRAY['k2'])::jsonb ->> 'change_id'),
    ('twice', pg_temp.bulk('change', 'acme_owner', 'owner', pg_temp.owner_p('acme_agent3'), ARRAY['k3'])::jsonb ->> 'change_id'),
    ('opp', pg_temp.bulk('change', 'acme_owner', 'owner', pg_temp.owner_p('acme_agent3', true), ARRAY['k4'])::jsonb ->> 'change_id');
  GRANT SELECT ON kc TO PUBLIC;
END $$;
-- (the change's rows are committed by now: the DO blocks above ended)
CREATE TEMP TABLE kc2 AS SELECT * FROM kc;

DO $$
DECLARE r text; firm uuid := pg_temp.id('acme'); u text;
BEGIN
  RESET ROLE;
  -- The previous owner's removal not yet committed.
  u := format($q$SELECT public.bulk_accounts_undo(%L, %L)::text$q$, (SELECT id FROM kc2 WHERE n = 'prev'), firm);
  r := pg_temp.race_two(format($q$SELECT public.remove_member(%L, %L)::text$q$, firm, pg_temp.id('acme_prev')), 'SELECT 1', u);
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'the undo waits for the removal of the previous owner');
  PERFORM pg_temp.is(split_part(r, '|', 3) LIKE '%"restored": 0%' AND split_part(r, '|', 3) LIKE '%owner_left%', true, 'and, once it has committed, names the account and gives it back to no one');
  PERFORM pg_temp.is(pg_temp.owner_of('accounts', 'k1'), 'acme_agent3', 'the account is not handed to a former member');
  -- Another change to the same account, not yet committed.
  u := format($q$SELECT public.bulk_accounts_undo(%L, %L)::text$q$, (SELECT id FROM kc2 WHERE n = 'other'), firm);
  r := pg_temp.race_two(format($q$SELECT public.change_account_owner(%L, %L, false, %L)::text$q$, pg_temp.id('k2'), pg_temp.id('acme_other'), firm), 'SELECT 1', u);
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'the undo waits for a change to the same account');
  PERFORM pg_temp.is(split_part(r, '|', 3) LIKE '%"restored": 0%' AND split_part(r, '|', 3) LIKE '%changed_since%', true, 'and names the account: the later change is not undone');
  PERFORM pg_temp.is(pg_temp.owner_of('accounts', 'k2'), 'acme_other', 'the other change stands');
  -- A second undo of one change, while the first is not committed.
  u := format($q$SELECT public.bulk_accounts_undo(%L, %L)::text$q$, (SELECT id FROM kc2 WHERE n = 'twice'), firm);
  r := pg_temp.race_two(u, 'SELECT 1', u);
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'a second undo waits for the first');
  PERFORM pg_temp.is(split_part(r, '|', 3), 'PT409', 'and is told it was already undone');
  PERFORM pg_temp.is(pg_temp.owner_of('accounts', 'k3'), 'acme_agent1', 'the first put the account back, once');
  -- An opportunity's owner being changed, not yet committed (by the superuser: no function changes one alone).
  u := format($q$SELECT public.bulk_accounts_undo(%L, %L)::text$q$, (SELECT id FROM kc2 WHERE n = 'opp'), firm);
  r := pg_temp.race_two(format($q$WITH x AS (UPDATE public.opportunities SET owner_id = %L WHERE id = %L RETURNING 1) SELECT count(*)::text FROM x$q$, pg_temp.id('acme_other'), pg_temp.id('ko4')),
    'SELECT 1', u, NULL);
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'the undo waits for a change to an opportunity it would put back');
  PERFORM pg_temp.is(split_part(r, '|', 3) LIKE '%"opportunities": {"skipped": 1, "restored": 0}%', true, 'and leaves it, counted');
  PERFORM pg_temp.is(pg_temp.owner_of('opportunities', 'ko4'), 'acme_other', 'the later change to the opportunity stands');
  RAISE NOTICE 'bulk_changes: undo locks passed';
END $$;

-- ---------- review fixes ----------
-- Break caught: "changed since" judged by value alone (B to C and back to B is put back over); an undo by someone no longer at the level they made the change at;
-- a label an undone change made left in the firm's list (or taken from under another account that carries it); a deleted account's names and old values kept.
DO $$
DECLARE r jsonb; u jsonb; c text;
BEGIN
  RESET ROLE;
  -- B to C to B.
  PERFORM pg_temp.account('h1', 'acme', 'acme_agent1'); PERFORM pg_temp.account('h2', 'acme', 'acme_agent1');
  r := pg_temp.bulk('change', 'acme_owner', 'owner', pg_temp.owner_p('acme_agent3'), ARRAY['h1', 'h2'])::jsonb;
  UPDATE public.accounts SET owner_id = pg_temp.id('acme_lead') WHERE id = pg_temp.id('h1');
  UPDATE public.accounts SET owner_id = pg_temp.id('acme_agent3') WHERE id = pg_temp.id('h1');
  u := pg_temp.undo('acme_owner', r ->> 'change_id')::jsonb;
  PERFORM pg_temp.is((u ->> 'restored')::int || '/' || pg_temp.names_of(u -> 'skipped'), '1/h1', 'an owner changed and put back since is skipped and named, not put back over');
  PERFORM pg_temp.is(pg_temp.owner_of('accounts', 'h1') || '/' || pg_temp.owner_of('accounts', 'h2'), 'acme_agent3/acme_agent1', 'the other is back');
  -- A field set, changed and put back.
  r := pg_temp.bulk('change', 'acme_owner', 'field', '{"field":"industry","value":"Retail"}', ARRAY['h1', 'h2'])::jsonb;
  UPDATE public.accounts SET industry = 'Mining' WHERE id = pg_temp.id('h2');
  UPDATE public.accounts SET industry = 'Retail' WHERE id = pg_temp.id('h2');
  u := pg_temp.undo('acme_owner', r ->> 'change_id')::jsonb;
  PERFORM pg_temp.is((u ->> 'restored')::int || '/' || pg_temp.names_of(u -> 'skipped'), '1/h2', 'the same for a field');
  -- The maker's level: made an agent since, with a new membership.
  PERFORM pg_temp.new_user('acme_boss');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (pg_temp.id('acme'), pg_temp.id('acme_boss'), 'owner');
  r := pg_temp.bulk('change', 'acme_boss', 'archive', '{}', ARRAY['h1'])::jsonb;
  c := r ->> 'change_id';
  UPDATE public.firm_memberships SET valid_until = now() WHERE user_id = pg_temp.id('acme_boss');
  INSERT INTO public.firm_memberships (firm_id, user_id, role, valid_from) VALUES (pg_temp.id('acme'), pg_temp.id('acme_boss'), 'agent', now());
  PERFORM pg_temp.is(pg_temp.undo('acme_boss', c), 'PT404: That change isn''t available to undo', 'someone made an agent since can not undo what they did as an owner');
  PERFORM pg_temp.is((SELECT archived_at IS NOT NULL FROM public.accounts WHERE id = pg_temp.id('h1')), true, 'and the account stays archived');
  PERFORM pg_temp.is(pg_temp.run('acme_boss', format('SELECT public.restore_account(%L, %L)::text', pg_temp.id('h1'), pg_temp.id('acme'))), 'PT404: That account isn''t available', 'as the single restore refuses them too');
  -- An agent who gave their accounts away keeps the right to undo it (they made it at the level they still hold).
  PERFORM pg_temp.account('h3', 'acme', 'acme_agent2');
  r := pg_temp.bulk('change', 'acme_agent2', 'owner', pg_temp.owner_p('acme_agent3'), ARRAY['h3'])::jsonb;
  u := pg_temp.undo('acme_agent2', r ->> 'change_id')::jsonb;
  PERFORM pg_temp.is((u ->> 'restored')::int, 1, 'an agent who gave an account away can still undo it');
  -- A label an undone change made.
  PERFORM pg_temp.account('h4', 'acme', 'acme_agent1'); PERFORM pg_temp.account('h5', 'acme', 'acme_agent1');
  r := pg_temp.bulk('change', 'acme_owner', 'label_add', '{"name":"Brand new"}', ARRAY['h4', 'h5'])::jsonb;
  PERFORM pg_temp.undo('acme_owner', r ->> 'change_id');
  PERFORM pg_temp.is((SELECT count(*) FROM public.labels WHERE firm_id = pg_temp.id('acme') AND name = 'Brand new'), 0::bigint, 'undoing the change that made a label takes it out of the list');
  PERFORM pg_temp.bulk('change', 'acme_owner', 'label_add', '{"name":"Old word"}', ARRAY['h4']);
  r := pg_temp.bulk('change', 'acme_owner', 'label_add', '{"name":"Old word"}', ARRAY['h5'])::jsonb;
  PERFORM pg_temp.undo('acme_owner', r ->> 'change_id');
  PERFORM pg_temp.is((SELECT count(*) FROM public.labels WHERE firm_id = pg_temp.id('acme') AND name = 'Old word'), 1::bigint, 'a label that was already there stays');
  r := pg_temp.bulk('change', 'acme_owner', 'label_add', '{"name":"Made here"}', ARRAY['h4'])::jsonb;
  PERFORM pg_temp.bulk('change', 'acme_owner', 'label_add', '{"name":"Made here"}', ARRAY['h5']);
  PERFORM pg_temp.undo('acme_owner', r ->> 'change_id');
  PERFORM pg_temp.is((SELECT count(*) FROM public.labels WHERE firm_id = pg_temp.id('acme') AND name = 'Made here'), 1::bigint, 'and so does one another account carries');
  PERFORM pg_temp.is(pg_temp.labels_of('h5'), 'Made here', 'with its account');
  -- Deleting an account deletes what the changes kept of it.
  PERFORM pg_temp.account('h6', 'acme', 'acme_agent1');
  PERFORM pg_temp.bulk('change', 'acme_owner', 'field', '{"field":"city","value":"Reno"}', ARRAY['h6']);
  PERFORM pg_temp.is((SELECT count(*) FROM public.bulk_change_records WHERE account_id = pg_temp.id('h6')), 1::bigint, 'set-up: a record of the change');
  DELETE FROM public.accounts WHERE id = pg_temp.id('h6');
  PERFORM pg_temp.is((SELECT count(*) FROM public.bulk_change_records WHERE record_id = pg_temp.id('h6')), 0::bigint, 'deleting the account takes its rows with it');
  PERFORM pg_temp.opportunity('ho7', 'h4', 'acme_agent1');
  PERFORM pg_temp.bulk('change', 'acme_owner', 'owner', pg_temp.owner_p('acme_agent3', true), ARRAY['h4']);
  PERFORM pg_temp.is((SELECT count(*) FROM public.bulk_change_records WHERE opportunity_id = pg_temp.id('ho7')), 1::bigint, 'set-up: a record of an opportunity handed over');
  DELETE FROM public.opportunities WHERE id = pg_temp.id('ho7');
  PERFORM pg_temp.is((SELECT count(*) FROM public.bulk_change_records WHERE opportunity_id = pg_temp.id('ho7')), 0::bigint, 'and deleting the opportunity takes its row');
  RAISE NOTICE 'bulk_changes: review fixes passed';
END $$;
