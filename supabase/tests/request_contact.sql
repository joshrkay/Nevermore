-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh request_contact
-- A visitor on a firm's public link asks to be contacted (story CRM-L1.2b, slice 8.7; docs/BROKER_CRM_BUILD.md D-804, D-1660 to D-1669; 20261122230000_request_contact.sql).
-- request_contact: a signed-out or guest visitor at a firm's address becomes a lead of that firm, source Firm's link. Two firms: Acme sees by level, Zenith shows everyone everything.
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
\i supabase/migrations/20261121085500_leads.sql
\i supabase/migrations/20261121090000_spot_a_duplicate.sql
\i supabase/migrations/20261121095500_create_lead.sql
\i supabase/migrations/20261121100000_merge_records.sql
\i supabase/migrations/20261121110000_account_page_duplicate_mark.sql
\i supabase/migrations/20261121110500_leads_table_query.sql
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
\i supabase/migrations/20261122230000_request_contact.sql
\i supabase/migrations/20261122240000_lead_alert_and_captcha.sql
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


-- ---------- 1. A signed-out visitor at a firm's address asks to be contacted ----------
-- Break caught: the link's "contact me" makes no lead, or one of the wrong firm, source or status.
DO $$
DECLARE r jsonb; l public.leads;
BEGIN
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(public.request_contact('acme-brokers', 'Pat Visitor', 'pat@visitor.test', '(503) 555-0142', 'Visitor Co', 'Please call me about a PEO.'), 'taken', 'the answer');
  PERFORM pg_temp.as_owner();
  SELECT * INTO l FROM public.leads WHERE email = 'pat@visitor.test';
  PERFORM pg_temp.is(l.firm_id, pg_temp.id('acme'), 'the lead is the firm at the address''s');
  PERFORM pg_temp.is(l.source, 'firms_link', 'its source is the firm''s link');
  PERFORM pg_temp.is(l.status, 'new', 'it starts New');
  PERFORM pg_temp.is(l.owner_id, NULL::uuid, 'it has no owner: no agent''s link was used');
  PERFORM pg_temp.is(l.name, 'Pat Visitor', 'the name');
  PERFORM pg_temp.is(l.business, 'Visitor Co', 'the business');
  PERFORM pg_temp.is(l.note, 'Asked to be contacted: Please call me about a PEO.', 'the message is kept in the note');
END $$;

-- ---------- 2. A name is needed ----------
-- Break caught: a request with no name makes a nameless lead (or dies on a table constraint the visitor can't read).
DO $$
DECLARE before int := (SELECT count(*) FROM public.leads);
BEGIN
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(pg_temp.refusal($q$SELECT public.request_contact('acme-brokers', '  ', 'a@visitor.test')$q$),
    '22023: Enter your name.', 'no name');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.leads), before, 'no lead was made');
END $$;

-- ---------- 3. A way to be reached is needed ----------
-- Break caught: a request with neither an email nor a phone becomes a lead nobody can contact.
DO $$
DECLARE before int := (SELECT count(*) FROM public.leads);
BEGIN
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(pg_temp.refusal($q$SELECT public.request_contact('acme-brokers', 'Pat', NULL, '  ', 'Visitor Co', 'Hi')$q$),
    '22023: Enter an email address or a phone number so the firm can reach you.', 'neither');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.leads), before, 'no lead was made');
END $$;

-- ---------- 4. What is wrong with a field is said in the lead form's words ----------
-- Break caught: a visitor's email that is not an address is kept as a lead's email (the same words as the hand form give it).
DO $$
DECLARE before int := (SELECT count(*) FROM public.leads);
BEGIN
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(pg_temp.refusal($q$SELECT public.request_contact('acme-brokers', 'Pat', 'not an email')$q$),
    '22023: Enter an email address like name@example.com.', 'a bad email');
  PERFORM pg_temp.is(pg_temp.refusal($q$SELECT public.request_contact('acme-brokers', 'Pat', NULL, '12')$q$),
    '22023: Enter a phone number like (503) 555-0142. An extension can follow, like x12.', 'a bad phone');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.leads), before, 'no lead was made');
END $$;

-- ---------- 5. An address no firm holds takes nothing ----------
-- Break caught: a request to an address nobody holds (or a wildcard that matches a firm) is taken, or dies on a table error.
DO $$
DECLARE before int := (SELECT count(*) FROM public.leads);
BEGIN
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(pg_temp.refusal($q$SELECT public.request_contact('no-such-firm', 'Pat', 'pat@visitor.test')$q$), 'PT404: No firm holds this address.', 'no firm');
  PERFORM pg_temp.is(split_part(pg_temp.refusal($q$SELECT public.request_contact('acme%', 'Pat', 'pat@visitor.test')$q$), ':', 1), 'PT404', 'a wildcard');
  PERFORM pg_temp.is(split_part(pg_temp.refusal($q$SELECT public.request_contact(NULL, 'Pat', 'pat@visitor.test')$q$), ':', 1), 'PT404', 'no address');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.leads), before, 'no lead was made');
END $$;

-- ---------- 6. A refused firm is an address no firm holds (D-31) ----------
-- Break caught: a look-alike firm Nevermore refused collects leads from visitors who find its address.
DO $$
DECLARE before int := (SELECT count(*) FROM public.leads);
BEGIN
  INSERT INTO public.firms (name, address, approved_at, decision, decided_at) VALUES ('Squat Brokers', 'squat-brokers', NULL, 'refused', now());
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(pg_temp.refusal($q$SELECT public.request_contact('squat-brokers', 'Pat', 'pat@visitor.test')$q$), 'PT404: No firm holds this address.', 'a refused firm');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.leads), before, 'no lead was made');
END $$;

-- ---------- 7. A closing firm takes nothing (ADR 0023) ----------
-- Break caught: a firm that is read-only while it closes still gets a lead written into its records.
DO $$
DECLARE before int := (SELECT count(*) FROM public.leads);
BEGIN
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (pg_temp.id('zenith'), pg_temp.id('zenith_owner'), now() + interval '30 days');
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(pg_temp.refusal($q$SELECT public.request_contact('zenith-benefits', 'Pat', 'pat@visitor.test')$q$), 'PT423: This firm is not taking requests right now.', 'a closing firm');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.leads), before, 'no lead was made');
END $$;

-- ---------- 8. A closed firm's address is an address no firm holds ----------
-- Break caught: a firm that has closed (its records deleted) answers a visitor as a closing one does, telling them the firm once was.
DO $$
DECLARE before int := (SELECT count(*) FROM public.leads);
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Gone Brokers', 'gone-brokers', now());
  INSERT INTO public.firm_closures (firm_id, asked_by, asked_at, closes_at, closed_at, deleted_counts)
  VALUES ((SELECT id FROM public.firms WHERE address = 'gone-brokers'), pg_temp.id('zenith_owner'), now() - interval '40 days', now() - interval '10 days', now() - interval '10 days', '{}'::jsonb);
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(pg_temp.refusal($q$SELECT public.request_contact('gone-brokers', 'Pat', 'pat@visitor.test')$q$), 'PT404: No firm holds this address.', 'a closed firm');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.leads), before, 'no lead was made');
END $$;

-- ---------- 9. Asking twice is one lead ----------
-- Break caught: one visitor pressing the button again (or a script repeating one address) piles up a lead for each press.
DO $$
BEGIN
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(public.request_contact('acme-brokers', 'Pat Again', ' PAT@visitor.test ', NULL, NULL, 'Second go'), 'taken', 'the visitor is told it is taken all the same');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.leads WHERE lower(email) = 'pat@visitor.test' AND firm_id = pg_temp.id('acme')), 1, 'but there is still the one lead');
END $$;

-- ---------- 10. With no message the lead still says why it exists ----------
-- Break caught: a request with no message makes a lead with an empty note (a lead nobody can tell from one typed in).
DO $$
BEGIN
  PERFORM pg_temp.as_service();
  PERFORM public.request_contact('acme-brokers', 'Quinn Quiet', NULL, '(503) 555-0199');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT note FROM public.leads WHERE name = 'Quinn Quiet'), 'Asked to be contacted.', 'the note');
  PERFORM pg_temp.is((SELECT phone FROM public.leads WHERE name = 'Quinn Quiet'), '(503) 555-0199', 'a phone alone is enough');
END $$;

-- ---------- 11. A message is at most 1,000 characters ----------
-- Break caught: an anonymous visitor writes a note of the size a lead's own note allows (5,000), or past it and into a table error.
DO $$
DECLARE before int := (SELECT count(*) FROM public.leads);
BEGIN
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.request_contact('acme-brokers', 'Long Lou', 'lou@visitor.test', NULL, NULL, %L)$q$, repeat('x', 1001))),
    '22023: A message is at most 1,000 characters.', 'too long');
  PERFORM pg_temp.is(public.request_contact('acme-brokers', 'Long Lou', 'lou@visitor.test', NULL, NULL, repeat('x', 1000)), 'taken', 'exactly 1,000 is taken');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.leads), before + 1, 'only the one that fit was made');
END $$;

-- ---------- 12. A firm's link takes at most 20 requests an hour ----------
-- Break caught: a script posting made-up names fills one firm's Leads table without limit.
DO $$
DECLARE i int; answer text;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Birch Benefits', 'birch-benefits', now());
  PERFORM pg_temp.as_service();
  FOR i IN 1..20 LOOP
    PERFORM pg_temp.is(public.request_contact('birch-benefits', 'Visitor ' || i, 'v' || i || '@visitor.test'), 'taken', 'request ' || i);
  END LOOP;
  PERFORM pg_temp.is(public.request_contact('birch-benefits', 'Visitor 21', 'v21@visitor.test'), 'busy', 'the 21st in an hour is told to try later');
  PERFORM pg_temp.is(public.request_contact('acme-brokers', 'Other Firm Visitor', 'other@visitor.test'), 'taken', 'another firm''s link is not affected');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.leads WHERE firm_id = (SELECT id FROM public.firms WHERE address = 'birch-benefits')), 20, 'the 21st made no lead');
  -- Time passing: the guard keeps created_at fixed for everyone, so it is stood down for this one setup statement.
  ALTER TABLE public.leads DISABLE TRIGGER leads_guard;
  UPDATE public.leads SET created_at = now() - interval '2 hours' WHERE firm_id = (SELECT id FROM public.firms WHERE address = 'birch-benefits');
  ALTER TABLE public.leads ENABLE TRIGGER leads_guard;
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(public.request_contact('birch-benefits', 'Visitor 22', 'v22@visitor.test'), 'taken', 'an hour later it takes requests again');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 13. All the firms' links together take at most 200 requests an hour ----------
-- Break caught: a script spread over many firms' addresses is bounded by each firm's 20 alone, so the platform's Leads tables fill without limit.
DO $$
DECLARE i int; n int;
BEGIN
  -- Made as the superuser: the 200 that came in this hour, whatever firms they came to (some firms' own limits are not the point here).
  SELECT count(*) INTO n FROM public.leads WHERE source = 'firms_link' AND created_at > now() - interval '1 hour';
  FOR i IN 1..(200 - n) LOOP
    INSERT INTO public.leads (firm_id, name, email, source) VALUES (pg_temp.id('acme'), 'Bulk ' || i, 'bulk' || i || '@visitor.test', 'firms_link');
  END LOOP;
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(public.request_contact('birch-benefits', 'One Too Many', 'toomany@visitor.test'), 'busy', 'the 201st in an hour');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.leads WHERE email = 'toomany@visitor.test'), 0, 'made no lead');
  DELETE FROM public.leads WHERE name LIKE 'Bulk %';
END $$;

-- ---------- 14. Who finds it: the firm's owners ----------
-- Break caught: the lead from the firm's link is owned by whoever the table's default picks, or is visible to agents who can't change it (D-809: a lead with no owner is an owner's alone).
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.leads WHERE email = 'pat@visitor.test'), 1, 'an owner reads it');
  PERFORM pg_temp.is(((public.leads_list(p_firm_id => pg_temp.id('acme')))::jsonb -> 'rows' -> 0 ->> 'source'), 'firms_link', 'and the table lists it with its source');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.leads WHERE email = 'pat@visitor.test'), 0, 'an agent does not');
  PERFORM pg_temp.as_user('acme_lead', 'acme-brokers');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.leads WHERE email = 'pat@visitor.test'), 0, 'nor does a team lead');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 15. Who may call it ----------
-- Break caught: the function is open to PUBLIC, anon or a signed-in person (the captcha can be skipped by calling the database), or has no pinned search path, or is closed to the edge function.
DO $$
DECLARE r text;
BEGIN
  -- D-1673: only the contact-request function (the service role), after Turnstile has checked the visitor, may call it.
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    PERFORM pg_temp.is(has_function_privilege(r, 'public.request_contact(text, text, text, text, text, text)', 'EXECUTE'), false, r || ' may not ask: the captcha cannot be skipped');
  END LOOP;
  PERFORM pg_temp.is(has_function_privilege('service_role', 'public.request_contact(text, text, text, text, text, text)', 'EXECUTE'), true, 'the contact-request function may');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.refusal($q$SELECT public.request_contact('acme-brokers', 'Skip Sam', 'sam@visitor.test')$q$), '42501: permission denied for function request_contact', 'a visitor calling the database directly is refused');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal($q$SELECT public.request_contact('acme-brokers', 'Skip Sam', 'sam@visitor.test')$q$), '42501: permission denied for function request_contact', 'and so is a signed-in person');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT p.prosecdef FROM pg_proc p WHERE p.proname = 'request_contact'), true, 'it runs as its owner: the visitor has no grant on leads');
  PERFORM pg_temp.is((SELECT p.proconfig::text LIKE '%search_path%' FROM pg_proc p WHERE p.proname = 'request_contact'), true, 'its search path is pinned');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.refusal($q$SELECT count(*) FROM public.leads$q$), '42501: permission denied for table leads', 'and a visitor still reads no lead');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 16. Asking again a day later is a new ask ----------
-- Break caught (found by mutation: a window of a second passed every test): the repeat rule stops at the hour instead of the day, or never stops, so a person who asks
-- again the next week is told "taken" and never reaches the firm.
DO $$
BEGIN
  ALTER TABLE public.leads DISABLE TRIGGER leads_guard;
  UPDATE public.leads SET created_at = now() - interval '23 hours' WHERE email = 'lou@visitor.test';
  ALTER TABLE public.leads ENABLE TRIGGER leads_guard;
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(public.request_contact('acme-brokers', 'Long Lou', 'lou@visitor.test'), 'taken', 'asked again after 23 hours');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.leads WHERE email = 'lou@visitor.test'), 1, 'is still the one lead');
  ALTER TABLE public.leads DISABLE TRIGGER leads_guard;
  UPDATE public.leads SET created_at = now() - interval '25 hours' WHERE email = 'lou@visitor.test';
  ALTER TABLE public.leads ENABLE TRIGGER leads_guard;
  PERFORM pg_temp.as_service();
  PERFORM public.request_contact('acme-brokers', 'Long Lou', 'lou@visitor.test');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.leads WHERE email = 'lou@visitor.test'), 2, 'after 25 hours it is a second lead');
END $$;

-- ---------- 17. No grant to PUBLIC ----------
-- Break caught (found by mutation): the function is granted to PUBLIC, so any role the platform adds later can write a lead.
DO $$
BEGIN
  PERFORM pg_temp.is((SELECT count(*)::int FROM pg_proc p, aclexplode(p.proacl) a WHERE p.proname = 'request_contact' AND a.grantee = 0), 0, 'PUBLIC has no grant on it');
END $$;

-- ---------- 18. The owners are told, by email, in the same transaction (D-1670, D-1671) ----------
-- Break caught: a visitor asks to be contacted and no owner ever hears of it until they happen to open Leads.
DO $$
DECLARE e public.outbox_events; l public.leads;
BEGIN
  PERFORM pg_temp.as_service();
  PERFORM public.request_contact('acme-brokers', 'Alert Ann', 'ann@visitor.test', NULL, 'Ann Co', 'Call me.');
  PERFORM pg_temp.as_owner();
  SELECT * INTO l FROM public.leads WHERE email = 'ann@visitor.test';
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.outbox_events WHERE kind = 'lead_from_link' AND payload ->> 'lead_id' = l.id::text), 1, 'one email is queued for the lead');
  SELECT * INTO e FROM public.outbox_events WHERE kind = 'lead_from_link' AND payload ->> 'lead_id' = l.id::text;
  PERFORM pg_temp.is(e.firm_id, pg_temp.id('acme'), 'it belongs to the firm, not to an intake');
  PERFORM pg_temp.is(e.session_id, NULL::uuid, 'and has no intake');
END $$;

-- ---------- 19. What the email carries (D-1671) ----------
-- Break caught: the email's payload picks up the visitor's email, phone or message (it would sit in an outbox row and in an inbox), or loses the lead's id (no link to the lead).
DO $$
DECLARE e public.outbox_events; l public.leads;
BEGIN
  SELECT * INTO l FROM public.leads WHERE email = 'ann@visitor.test';
  SELECT * INTO e FROM public.outbox_events WHERE kind = 'lead_from_link' AND payload ->> 'lead_id' = l.id::text;
  PERFORM pg_temp.is((SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(e.payload) k), 'business,firm_name,lead_id,requested_at,visitor_name', 'only the visitor''s name, business, the firm''s name, the lead and when');
  PERFORM pg_temp.is(e.payload ->> 'visitor_name', 'Alert Ann', 'the name');
  PERFORM pg_temp.is(e.payload ->> 'business', 'Ann Co', 'the business');
  PERFORM pg_temp.is(e.payload ->> 'firm_name', 'Acme Brokers', 'the firm''s name');
  PERFORM pg_temp.is(e.dedupe_key, 'lead_from_link:' || l.id, 'deduplicated by the lead''s key');
  PERFORM pg_temp.is(e.payload ->> 'requested_at' ~ '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$', true, 'when, in UTC');
  PERFORM pg_temp.is(e.payload::text LIKE '%ann@visitor.test%' OR e.payload::text LIKE '%Call me%', false, 'no contact detail or message');
END $$;

-- ---------- 20. An ask that makes no lead tells nobody (D-1672) ----------
-- Break caught: the same email pressed twice (told "taken") or a request past the hour's limit (told "busy") emails the owners again, so a script can flood their inboxes though the Leads table is capped.
DO $$
DECLARE before_n int; r text;
BEGIN
  SELECT count(*)::int INTO before_n FROM public.outbox_events WHERE kind = 'lead_from_link';
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(public.request_contact('acme-brokers', 'Alert Ann', 'ann@visitor.test'), 'taken', 'asked again');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.outbox_events WHERE kind = 'lead_from_link'), before_n, 'asking again emails nobody');
  -- Fill the firm's hour (20 links' worth), then one more.
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Cedar Benefits', 'cedar-benefits', now());
  INSERT INTO public.leads (firm_id, name, email, source) SELECT (SELECT id FROM public.firms WHERE address = 'cedar-benefits'), 'Filler ' || g, 'f' || g || '@filler.test', 'firms_link' FROM generate_series(1, 20) g;
  SELECT count(*)::int INTO before_n FROM public.outbox_events WHERE kind = 'lead_from_link';
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(public.request_contact('cedar-benefits', 'Late Lee', 'lee@visitor.test'), 'busy', 'past the hour''s limit');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.outbox_events WHERE kind = 'lead_from_link'), before_n, 'a busy answer emails nobody');
  DELETE FROM public.leads WHERE email LIKE '%@filler.test';
END $$;

-- ---------- 21. It is a firm's alert, like export_alert (D-1670) ----------
-- Break caught: the email is not a firm's alert, so it is sent while the firm is suspended, a bounce suppresses an owner's address, or it is not ended when the firm closes.
DO $$
BEGIN
  PERFORM pg_temp.is(public.outbox_kind_is_firm_alert('lead_from_link'), true, 'the alert is a firm''s alert');
  PERFORM pg_temp.is(public.outbox_kind_is_firm_alert('export_alert') AND public.outbox_kind_is_firm_alert('member_left') AND public.outbox_kind_is_firm_alert('firm_closing')
    AND public.outbox_kind_is_firm_alert('advisor_notification') AND public.outbox_kind_is_firm_alert('peo_mail_arrived'), true, 'the older firm alerts still are');
  PERFORM pg_temp.is(public.outbox_kind_is_firm_alert('prospect_confirmation') OR public.outbox_kind_is_firm_alert('information_request')
    OR public.outbox_kind_is_firm_alert('draft_expiry_reminder') OR public.outbox_kind_is_firm_alert('conversation_message') OR public.outbox_kind_is_firm_alert('peo_message'), false, 'and the others are not');
END $$;

-- ---------- 22. It waits while the firm is suspended, and is sent once it is lifted (D-1670) ----------
-- Break caught: the owners' alert goes out while Nevermore holds the firm suspended (the dispatcher claims it), or is lost for good.
DO $$
DECLARE n int; acme uuid := pg_temp.id('acme');
BEGIN
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_suspend_firm(acme, 'testing the alert');
  PERFORM pg_temp.as_service();
  SELECT count(*)::int INTO n FROM public.claim_outbox_events(ARRAY['lead_from_link'], 500, 5, 600) c WHERE c.firm_id = acme;
  PERFORM pg_temp.is(n, 0, 'nothing of a suspended firm is claimed');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_lift_firm_suspension(acme);
  PERFORM pg_temp.as_service();
  SELECT count(*)::int INTO n FROM public.claim_outbox_events(ARRAY['lead_from_link'], 500, 5, 600) c WHERE c.firm_id = acme;
  PERFORM pg_temp.is(n > 0, true, 'once lifted the waiting alerts are claimed');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 23. It is about a firm and no intake ----------
-- Break caught: the kind is queued about an intake or about nothing (the dispatcher could not find the owners to tell).
DO $$
DECLARE intake uuid := pg_temp.intake('Link Intake Co', 'acme');
BEGIN
  PERFORM pg_temp.is(pg_temp.refusal(format($q$INSERT INTO public.outbox_events (kind, session_id, dedupe_key, payload) VALUES ('lead_from_link', %L, 'x', '{}')$q$, intake)) LIKE '23514:%', true, 'not about an intake');
  PERFORM pg_temp.is(pg_temp.refusal($q$INSERT INTO public.outbox_events (kind, dedupe_key, payload) VALUES ('lead_from_link', 'y', '{}')$q$) LIKE '23514:%', true, 'nor about no firm');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.outbox_events (kind, firm_id, dedupe_key, payload) VALUES ('lead_from_link', %L, 'z', '{}')$q$, pg_temp.id('acme'))), 'rows:1', 'about a firm it is accepted');
END $$;

SELECT 'request_contact: all passed';
