-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh merge_records
-- Merging in the database (story CRM-S4.3b; docs/BROKER_CRM_BUILD.md D-195, D-203, D-209, D-210, D-222, D-231, D-233; 20261119220000_merge_records.sql).
-- Two accounts made one (everything attached moves, labels are a union, the history moves marked, the fields the person picks), two contacts of one account made
-- one, "keep separate", the old address that leads to the record kept (who may follow it), the level rule on both records, the refusals (not a member, another
-- firm, a closing firm, Nevermore support, an archived account), all or none, and the races (two sessions: a merge against a merge, a move, a bulk change, a call
-- being logged, a quote request being recorded, a certification's chain). Two firms: Acme sees by level, Zenith shows everyone everything.
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
\i supabase/migrations/20261119220000_merge_records.sql
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

CREATE FUNCTION pg_temp.put_label(acct text, n text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE f uuid; l uuid;
BEGIN
  SELECT firm_id INTO f FROM public.accounts WHERE id = pg_temp.id(acct);
  INSERT INTO public.labels (firm_id, name) VALUES (f, n) ON CONFLICT DO NOTHING;
  SELECT x.id INTO l FROM public.labels x WHERE x.firm_id = f AND lower(x.name) = lower(n);
  INSERT INTO public.account_labels (firm_id, account_id, label_id) VALUES (f, pg_temp.id(acct), l);
END $$;

CREATE FUNCTION pg_temp.labels_of(n text) RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(string_agg(l.name, ',' ORDER BY l.name), '') FROM public.account_labels al JOIN public.labels l ON l.id = al.label_id WHERE al.account_id = pg_temp.id(n)
$$;

-- Merges as a person. Versions default to the records' current ones. Answers the text or "STATE: words".
CREATE FUNCTION pg_temp.macc(who text, keep text, rem text, take text[] DEFAULT '{}', firm text DEFAULT 'acme', kv integer DEFAULT NULL, rv integer DEFAULT NULL) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.run(who, format('SELECT public.merge_accounts(%L, %L, %L, %L, %s, %s)::text', pg_temp.id(firm), pg_temp.id(keep), pg_temp.id(rem), take::text,
    COALESCE(kv, (SELECT version FROM public.accounts WHERE id = pg_temp.id(keep))), COALESCE(rv, (SELECT version FROM public.accounts WHERE id = pg_temp.id(rem)))))
$$;
CREATE FUNCTION pg_temp.pacc(who text, keep text, rem text, firm text DEFAULT 'acme') RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.run(who, format('SELECT public.merge_accounts_preview(%L, %L, %L)::text', pg_temp.id(firm), pg_temp.id(keep), pg_temp.id(rem)))
$$;
CREATE FUNCTION pg_temp.mcon(who text, keep text, rem text, take text[] DEFAULT '{}', firm text DEFAULT 'acme', kv integer DEFAULT NULL, rv integer DEFAULT NULL) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.run(who, format('SELECT public.merge_contacts(%L, %L, %L, %L, %s, %s)::text', pg_temp.id(firm), pg_temp.id(keep), pg_temp.id(rem), take::text,
    COALESCE(kv, (SELECT version FROM public.contacts WHERE id = pg_temp.id(keep))), COALESCE(rv, (SELECT version FROM public.contacts WHERE id = pg_temp.id(rem)))))
$$;
CREATE FUNCTION pg_temp.follow(who text, kind text, n text, firm text DEFAULT 'acme') RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.run(who, format('SELECT public.follow_merged_record(%L, %L, %L)::text', pg_temp.id(firm), kind, pg_temp.id(n)))
$$;
CREATE FUNCTION pg_temp.gone(tbl text, n text) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE r boolean;
BEGIN
  EXECUTE format('SELECT NOT EXISTS (SELECT 1 FROM public.%I WHERE id = $1)', tbl) INTO r USING pg_temp.id(n);
  RETURN r;
END $$;
CREATE FUNCTION pg_temp.hist(n text, fld text) RETURNS bigint LANGUAGE sql AS $$
  SELECT count(*) FROM public.record_history h WHERE h.record_key = pg_temp.id(n)::text AND h.field = fld
$$;

-- A standard pair, as the superuser. Kept: <p>k; removed: <p>r. Each holds what a merge moves; the fields differ.
--   <p>k: owner agent1, "Kept <p>", kept.example, OR, 10 employees, main contact <p>kmain, an opportunity <p>ko, a note <p>knote, labels Hot and OnlyK-<p>
--   <p>r: owner agent1, "Removed <p>", removed.example, WA, 20 employees, main contact <p>rmain, another contact <p>rc2, opportunities <p>ro1 (an intake with a quote
--         request) and <p>ro2 (main contact <p>rmain), a call <p>rcall (with <p>rmain), a note on the account alone <p>rnote, a task <p>rtask (about <p>ro2), labels Hot
--         and OnlyR-<p>
CREATE FUNCTION pg_temp.pair(p text, owner_k text DEFAULT 'acme_agent1', owner_r text DEFAULT 'acme_agent1', firm text DEFAULT 'acme') RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_temp.account(p || 'k', firm, owner_k, 'Kept ' || p, 'https://kept.example/' || p);
  PERFORM pg_temp.account(p || 'r', firm, owner_r, 'Removed ' || p, 'https://removed.example/' || p);
  UPDATE public.accounts SET state = 'OR', employees = 10, phone = '(503) 555-0101', industry = 'Dental' WHERE id = pg_temp.id(p || 'k');
  UPDATE public.accounts SET state = 'WA', employees = 20, phone = '(206) 555-0102', city = 'Seattle', industry = 'Dental' WHERE id = pg_temp.id(p || 'r');
  PERFORM pg_temp.contact(p || 'kmain', p || 'k', owner_k, p || 'kmain@e.example', NULL, true);
  PERFORM pg_temp.contact(p || 'rmain', p || 'r', owner_r, p || 'rmain@e.example', NULL, true);
  PERFORM pg_temp.contact(p || 'rc2', p || 'r', owner_r, p || 'rc2@e.example');
  PERFORM pg_temp.opportunity(p || 'ko', p || 'k', owner_k);
  PERFORM pg_temp.intake(p || 'ri', firm);
  PERFORM pg_temp.opportunity(p || 'ro1', p || 'r', owner_r, p || 'ri');
  INSERT INTO public.quote_requests (session_id, peo_name, status) VALUES (pg_temp.id(p || 'ri'), 'PEO ' || p, 'sent');
  PERFORM pg_temp.opportunity(p || 'ro2', p || 'r', owner_r, NULL, p || 'rmain');
  PERFORM pg_temp.activity(p || 'rcall', 'call', p || 'r', p || 'rmain');
  PERFORM pg_temp.activity(p || 'rnote', 'note', p || 'r', NULL);
  PERFORM pg_temp.activity(p || 'rtask', 'task', p || 'r', NULL, p || 'ro2');
  PERFORM pg_temp.activity(p || 'knote', 'note', p || 'k', NULL);
  PERFORM pg_temp.put_label(p || 'k', 'Hot'); PERFORM pg_temp.put_label(p || 'k', 'OnlyK-' || p);
  PERFORM pg_temp.put_label(p || 'r', 'Hot'); PERFORM pg_temp.put_label(p || 'r', 'OnlyR-' || p);
END $$;

-- ---------- merging two accounts: everything attached moves, nothing is lost ----------
-- Break caught: an attached record stays behind or is deleted with the removed account (a contact, an opportunity, a call, a note on the account alone, a task, a
-- label, a history entry); an opportunity loses its intake or its quote request is left on no opportunity; the kept account takes a field nobody picked, or does
-- not take one that was picked; the removed account is left standing; the merge is not under the person's name or is not in the kept record's history.
DO $$
DECLARE r text; j jsonb; ro1 uuid; intake uuid; had bigint;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.pair('a');
  ro1 := pg_temp.id('aro1'); intake := pg_temp.id('ari');
  had := (SELECT count(*) FROM public.record_history WHERE record_key = pg_temp.id('ar')::text);
  PERFORM pg_temp.is(had > 3, true, 'fixture: the removed account has its own history');
  r := pg_temp.macc('acme_agent1', 'ak', 'ar', ARRAY['city', 'employees']);
  PERFORM pg_temp.is(left(r, 1), '{', 'the merge is answered: ' || r);
  j := r::jsonb;
  PERFORM pg_temp.is(pg_temp.gone('accounts', 'ar'), true, 'the removed account is gone');
  PERFORM pg_temp.is(j #>> '{merged_from,name}', 'Removed a', 'the answer names it');
  PERFORM pg_temp.is((j #>> '{record,id}')::uuid, pg_temp.id('ak'), 'and the account kept');
  PERFORM pg_temp.is((SELECT name FROM public.accounts WHERE id = pg_temp.id('ak')), 'Kept a', 'a field nobody picked stays as the kept account has it');
  PERFORM pg_temp.is((SELECT website FROM public.accounts WHERE id = pg_temp.id('ak')), 'https://kept.example/a', 'the website too');
  PERFORM pg_temp.is((SELECT employees FROM public.accounts WHERE id = pg_temp.id('ak')), 20, 'a field that was picked is the removed account''s');
  PERFORM pg_temp.is((SELECT city FROM public.accounts WHERE id = pg_temp.id('ak')), 'Seattle', 'another picked field, which the kept account had none of');
  PERFORM pg_temp.is((SELECT state FROM public.accounts WHERE id = pg_temp.id('ak')), 'OR', 'a differing field not picked stays');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = pg_temp.id('ak')), 3::bigint, 'all three contacts are on the account kept');
  PERFORM pg_temp.is((SELECT is_main FROM public.contacts WHERE id = pg_temp.id('akmain')), true, 'the kept account''s main contact is still its main contact');
  PERFORM pg_temp.is((SELECT is_main FROM public.contacts WHERE id = pg_temp.id('armain')), false, 'and the removed account''s main contact arrives as nobody''s');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE account_id = pg_temp.id('ak')), 3::bigint, 'all three opportunities');
  PERFORM pg_temp.is((SELECT intake_id FROM public.opportunities WHERE id = ro1), intake, 'an opportunity keeps its intake');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE intake_id = intake), 1::bigint, 'and the intake is on one opportunity');
  PERFORM pg_temp.is((SELECT main_contact_id FROM public.opportunities WHERE id = pg_temp.id('aro2')), pg_temp.id('armain'), 'an opportunity keeps its main contact');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quote_requests WHERE session_id = intake), 1::bigint, 'the quote request is still there');
  PERFORM pg_temp.is(pg_temp.acct_of('activities', 'arcall'), pg_temp.id('ak'), 'the call moved');
  PERFORM pg_temp.is(pg_temp.acct_of('activities', 'arnote'), pg_temp.id('ak'), 'the note on the account alone moved');
  PERFORM pg_temp.is(pg_temp.acct_of('activities', 'artask'), pg_temp.id('ak'), 'the task moved');
  PERFORM pg_temp.is((SELECT contact_id FROM public.activities WHERE id = pg_temp.id('arcall')), pg_temp.id('armain'), 'a call is still with its contact');
  PERFORM pg_temp.is((SELECT opportunity_id FROM public.activities WHERE id = pg_temp.id('artask')), pg_temp.id('aro2'), 'and a task about its opportunity');
  PERFORM pg_temp.is(pg_temp.labels_of('ak'), 'Hot,OnlyK-a,OnlyR-a', 'the labels are the union');
  PERFORM pg_temp.is((SELECT count(*) FROM public.account_labels al JOIN public.labels l ON l.id = al.label_id WHERE al.account_id = pg_temp.id('ak') AND l.name = 'Hot'), 1::bigint, 'a label both had is on it once');
  PERFORM pg_temp.is((j #>> '{moved,contacts}')::int, 2, 'the answer counts the contacts moved');
  PERFORM pg_temp.is((j #>> '{moved,opportunities}')::int, 2, 'the opportunities');
  PERFORM pg_temp.is((j #>> '{moved,quotes}')::int, 1, 'the quotes');
  PERFORM pg_temp.is((j #>> '{moved,calls}')::int + (j #>> '{moved,notes}')::int + (j #>> '{moved,tasks}')::int, 3, 'and the calls, notes and tasks');
  PERFORM pg_temp.is((j #>> '{moved,labels}')::int, 1, 'and only the label the kept account lacked');
  -- The history: the removed account's entries are on the kept account, marked; the merge is one entry under the person.
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE record_key = pg_temp.id('ar')::text), 0::bigint, 'no history is left under the removed account');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE record_key = pg_temp.id('ak')::text AND merged_from_key = pg_temp.id('ar')::text AND field IS DISTINCT FROM 'merged'), had,
    'every entry of it is on the kept account, each marked as from it');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE record_key = pg_temp.id('ak')::text AND merged_from_name = 'Removed a' AND kind = 'created'), 1::bigint, 'its creation among them, as it was');
  PERFORM pg_temp.is(pg_temp.hist('ak', 'merged'), 1::bigint, 'the merge is one entry of the kept record');
  PERFORM pg_temp.is((SELECT new_value FROM public.record_history WHERE record_key = pg_temp.id('ak')::text AND field = 'merged'), to_jsonb('Removed a'::text), 'naming the account merged in');
  PERFORM pg_temp.is((SELECT actor_id FROM public.record_history WHERE record_key = pg_temp.id('ak')::text AND field = 'merged'), pg_temp.id('acme_agent1'), 'under the person who merged');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE record_key = pg_temp.id('ak')::text AND field IN ('employees', 'city') AND actor_id = pg_temp.id('acme_agent1')), 2::bigint, 'and each picked field is a change under them');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE record_key = pg_temp.id('ak')::text AND merged_from_key IS NULL AND kind = 'created'), 1::bigint, 'the kept account''s own creation is its own');
  RAISE NOTICE 'merge_records: merging two accounts passed';
END $$;

-- ---------- the preview ----------
-- Break caught: the preview changes something; it lists a field that does not differ or leaves out one that does; it counts what will not move; or it does not
-- refuse as the merge does.
DO $$
DECLARE j jsonb; before_n bigint;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.pair('b');
  before_n := (SELECT count(*) FROM public.accounts);
  j := pg_temp.pacc('acme_agent1', 'bk', 'br')::jsonb;
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts), before_n, 'a preview changes nothing');
  PERFORM pg_temp.is((SELECT string_agg(f ->> 'field', ',' ORDER BY ord) FROM jsonb_array_elements(j -> 'fields') WITH ORDINALITY AS t (f, ord)), 'name,website,phone,city,state,employees',
    'it lists the fields that differ, in the screen''s order');
  PERFORM pg_temp.is(j #>> '{fields,0,keep}', 'Kept b', 'each with the kept account''s value');
  PERFORM pg_temp.is(j #>> '{fields,0,remove}', 'Removed b', 'and the removed account''s');
  PERFORM pg_temp.is((j #>> '{keep,version}')::int, (SELECT version FROM public.accounts WHERE id = pg_temp.id('bk')), 'it gives the version to send back');
  PERFORM pg_temp.is(j #>> '{keep,owner,name}', 'acme_agent1@example.test', 'and the owner by name');
  PERFORM pg_temp.is(j -> 'moves', jsonb_build_object('contacts', 2, 'opportunities', 2, 'quotes', 1, 'calls', 1, 'notes', 1, 'tasks', 1, 'labels', 1, 'history', (SELECT count(*) FROM public.record_history WHERE record_key = pg_temp.id('br')::text)), 'it counts what will move');
  PERFORM pg_temp.is(left(pg_temp.pacc('acme_agent2', 'bk', 'br'), 5), 'PT404', 'it is refused as the merge is: to someone who may not see them');
  PERFORM pg_temp.is(left(pg_temp.pacc('acme_agent1', 'bk', 'bk'), 5), '22023', 'for the same account twice');
  RAISE NOTICE 'merge_records: the preview passed';
END $$;

-- ---------- who may merge (D-203, D-209) ----------
-- Break caught: someone merges two accounts when the level rule does not let them change both (an agent with a colleague's account, a lead with another team's,
-- anyone with an ownerless account), or an owner is refused; an account the caller may not see is told apart from one that is not there; the refusals come in
-- another order or are not in words; nothing is rolled back when refused.
DO $$
DECLARE r text; n bigint;
BEGIN
  RESET ROLE;
  -- agent1's and agent2's accounts (agent2 is in Sales, whose lead is acme_lead): an agent changes only their own.
  PERFORM pg_temp.pair('c', 'acme_agent1', 'acme_agent2');
  n := (SELECT count(*) FROM public.accounts);
  r := pg_temp.macc('acme_agent1', 'ck', 'cr');
  PERFORM pg_temp.is(left(r, 5), 'PT404', 'an agent may not see a colleague''s account (Acme sees by level): ' || r);
  r := pg_temp.macc('acme_agent2', 'cr', 'ck');
  PERFORM pg_temp.is(left(r, 5), 'PT404', 'the same from the other side');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts), n, 'nothing was merged');
  -- Zenith shows everyone everything: an agent sees a colleague's account but may not change it (42501, in words).
  PERFORM pg_temp.pair('z', 'zenith_agent', 'zenith_agent2', 'zenith');
  r := pg_temp.macc('zenith_agent', 'zk', 'zr', '{}', 'zenith');
  PERFORM pg_temp.is(left(r, 5), '42501', 'an agent who sees both but changes one is refused: ' || r);
  PERFORM pg_temp.is(r LIKE '%You can''t merge these accounts, because you can''t change Removed z.%Only the account''s owner%', true, 'in words that name the account');
  r := pg_temp.macc('zenith_agent2', 'zr', 'zk', '{}', 'zenith');
  PERFORM pg_temp.is(r LIKE '42501: You can''t merge these accounts, because you can''t change Kept z.%', true, 'and from the other side it names the other one: ' || r);
  PERFORM pg_temp.is(left(pg_temp.macc('zenith_lead', 'zk', 'zr', '{}', 'zenith'), 5), '42501', 'a lead with no team has no one''s account to change');
  PERFORM pg_temp.is(left(pg_temp.macc('zenith_owner', 'zk', 'zr', '{}', 'zenith'), 1), '{', 'an owner of the firm merges anyone''s');
  -- A lead merges the accounts of their team and of the teams under it; not one outside.
  PERFORM pg_temp.pair('d', 'acme_agent2', 'acme_west');
  PERFORM pg_temp.is(left(pg_temp.macc('acme_lead', 'dk', 'dr'), 1), '{', 'a lead merges accounts of their team and a team under it');
  PERFORM pg_temp.pair('e', 'acme_agent2', 'acme_agent1');
  PERFORM pg_temp.is(left(pg_temp.macc('acme_lead', 'ek', 'er'), 5), 'PT404', 'a lead may not see an account of someone outside their teams');
  -- An account with no owner is an owner's alone.
  PERFORM pg_temp.account('fk', 'acme', NULL, 'Ownerless kept');
  PERFORM pg_temp.account('fr', 'acme', NULL, 'Ownerless removed');
  PERFORM pg_temp.is(left(pg_temp.macc('acme_lead', 'fk', 'fr'), 5), 'PT404', 'nobody below an owner sees an ownerless account');
  PERFORM pg_temp.is(left(pg_temp.macc('acme_owner', 'fk', 'fr'), 1), '{', 'an owner of the firm merges ownerless accounts');
  -- Another firm, a person with no firm, and a former member.
  PERFORM pg_temp.pair('g');
  PERFORM pg_temp.is(left(pg_temp.macc('zenith_owner', 'gk', 'gr', '{}', 'acme'), 5), '42501', 'a member of another firm naming this firm is refused');
  PERFORM pg_temp.is(left(pg_temp.macc('zenith_owner', 'gk', 'gr', '{}', 'zenith'), 5), 'PT404', 'and naming their own, these are not there');
  PERFORM pg_temp.is(left(pg_temp.macc('nobody', 'gk', 'gr'), 5), '42501', 'someone with no firm is refused');
  PERFORM pg_temp.is(left(pg_temp.macc('acme_removed', 'gk', 'gr'), 5), '42501', 'a former member is refused');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE id IN (pg_temp.id('gk'), pg_temp.id('gr'))), 2::bigint, 'and nothing was merged');
  RAISE NOTICE 'merge_records: who may merge passed';
END $$;

-- ---------- the rules of the two accounts ----------
-- Break caught: an archived account is merged onto; an archived account cannot be merged away; a version that moved is overwritten; a field that is not one is
-- accepted; an owner is cleared, or a departed one given; the merge says nothing of what it did not say; a merge that fails half way keeps half.
DO $$
DECLARE r text; before_state text;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.pair('h');
  UPDATE public.accounts SET archived_at = now() WHERE id = pg_temp.id('hk');
  r := pg_temp.macc('acme_agent1', 'hk', 'hr');
  PERFORM pg_temp.is(left(r, 5), '55000', 'nothing is moved onto an archived account: ' || r);
  PERFORM pg_temp.is(r LIKE '%Kept h is archived%Restore it first, or keep the other account.', true, 'in words');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = pg_temp.id('hr')), 2::bigint, 'and nothing moved');
  -- The other way round: an archived account is merged away into a live one.
  PERFORM pg_temp.is(left(pg_temp.macc('acme_agent1', 'hr', 'hk'), 1), '{', 'an archived account can be merged away into a live one');
  PERFORM pg_temp.is((SELECT archived_at IS NULL FROM public.accounts WHERE id = pg_temp.id('hr')), true, 'which stays live');
  -- Versions.
  PERFORM pg_temp.pair('i2');
  UPDATE public.accounts SET industry = 'Changed since' WHERE id = pg_temp.id('i2k');
  r := pg_temp.macc('acme_agent1', 'i2k', 'i2r', '{}', 'acme', (SELECT version - 1 FROM public.accounts WHERE id = pg_temp.id('i2k')), NULL);
  PERFORM pg_temp.is(left(r, 5), 'PT409', 'a merge started from a version that has moved is refused: ' || r);
  PERFORM pg_temp.is(pg_temp.gone('accounts', 'i2r'), false, 'and nothing was merged');
  r := pg_temp.run('acme_agent1', format('SELECT public.merge_accounts(%L, %L, %L, ''{}'', NULL, NULL)::text', pg_temp.id('acme'), pg_temp.id('i2k'), pg_temp.id('i2r')));
  PERFORM pg_temp.is(left(r, 5), '22023', 'a merge that names no version is refused: ' || r);
  r := pg_temp.run('acme_agent1', format('SELECT public.merge_accounts(%L, %L, %L, ''{}'', 1, 1)::text', pg_temp.id('acme'), pg_temp.id('i2k'), pg_temp.id('i2r')));
  PERFORM pg_temp.is(left(r, 5), 'PT409', 'a version that does not match is refused whatever it is');
  -- Fields.
  PERFORM pg_temp.is(left(pg_temp.macc('acme_agent1', 'i2k', 'i2r', ARRAY['source']), 5), '22023', 'a field that is not one of the account''s picks is refused (the source is the product''s)');
  PERFORM pg_temp.is(left(pg_temp.macc('acme_agent1', 'i2k', 'i2r', ARRAY['archived_at']), 5), '22023', 'nor the archiving');
  PERFORM pg_temp.is(left(pg_temp.macc('acme_agent1', 'i2k', 'i2r', ARRAY['name; DROP TABLE accounts']), 5), '22023', 'nor text that is a field only by looking like one');
  -- Owners.
  PERFORM pg_temp.pair('j', 'acme_agent1', 'acme_agent1');
  UPDATE public.accounts SET owner_id = pg_temp.id('acme_gone') WHERE id = pg_temp.id('jr');
  r := pg_temp.macc('acme_owner', 'jk', 'jr', ARRAY['owner_id']);
  PERFORM pg_temp.is(r LIKE '22023: The owner of Removed j is no longer in the firm. Keep the owner of Kept j.', true, 'a departed owner is not given an account: ' || r);
  UPDATE public.accounts SET owner_id = NULL WHERE id = pg_temp.id('jr');
  r := pg_temp.macc('acme_owner', 'jk', 'jr', ARRAY['owner_id']);
  PERFORM pg_temp.is(r LIKE '22023: Removed j has no owner to take.%', true, 'an owner is never cleared by a pick: ' || r);
  UPDATE public.accounts SET owner_id = pg_temp.id('acme_agent2') WHERE id = pg_temp.id('jr');
  r := pg_temp.macc('acme_owner', 'jk', 'jr', ARRAY['owner_id', 'name']);
  PERFORM pg_temp.is(left(r, 1), '{', 'a current member''s ownership is taken when picked: ' || r);
  PERFORM pg_temp.is((SELECT owner_id FROM public.accounts WHERE id = pg_temp.id('jk')), pg_temp.id('acme_agent2'), 'the kept account has the new owner');
  PERFORM pg_temp.is((SELECT name FROM public.accounts WHERE id = pg_temp.id('jk')), 'Removed j', 'and the picked name');
  -- All or none: a phone that fails today's rule cannot be written, and the merge keeps nothing of what went before it.
  PERFORM pg_temp.pair('k');
  ALTER TABLE public.accounts DISABLE TRIGGER accounts_phone_valid;
  UPDATE public.accounts SET phone = 'call me' WHERE id = pg_temp.id('kr');
  ALTER TABLE public.accounts ENABLE TRIGGER accounts_phone_valid;
  r := pg_temp.macc('acme_agent1', 'kk', 'kr', ARRAY['employees', 'phone']);
  PERFORM pg_temp.is(left(r, 5), '22023', 'a picked phone that fails the phone rule refuses the merge: ' || r);
  PERFORM pg_temp.is((SELECT employees FROM public.accounts WHERE id = pg_temp.id('kk')), 10, 'the field picked before it was not kept');
  PERFORM pg_temp.is(pg_temp.gone('accounts', 'kr'), false, 'the removed account is still there');
  PERFORM pg_temp.is((SELECT count(*) FROM public.merged_records WHERE from_id = pg_temp.id('kr')), 0::bigint, 'and no old address was written');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = pg_temp.id('kr')), 2::bigint, 'and its contacts stayed');
  PERFORM pg_temp.is(pg_temp.labels_of('kk'), 'Hot,OnlyK-k', 'and no label was added');
  RAISE NOTICE 'merge_records: the rules of the two accounts passed';
END $$;

-- ---------- main contact, prospect, calls, notes and tasks on the account alone ----------
-- Break caught: the removed account's main contact displaces the kept account's, or is lost when the kept account has none; a person who is a contact of both
-- (from the same prospect) makes the merge fail on the unique index; a note on the account alone stays on a deleted account (deleted with it); the guard lets
-- anyone else change an activity's account.
DO $$
DECLARE r text; pu uuid;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.pair('m');
  UPDATE public.contacts SET is_main = false WHERE id = pg_temp.id('mkmain');
  r := pg_temp.macc('acme_agent1', 'mk', 'mr');
  PERFORM pg_temp.is(left(r, 1), '{', 'merged: ' || r);
  PERFORM pg_temp.is((SELECT is_main FROM public.contacts WHERE id = pg_temp.id('mrmain')), true, 'the removed account''s main contact stays main when the kept account has none');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = pg_temp.id('mk') AND is_main), 1::bigint, 'and the account has one main contact');
  -- The same person is a contact of both accounts.
  PERFORM pg_temp.pair('n');
  pu := pg_temp.new_user('prospect_n');
  UPDATE public.contacts SET prospect_user_id = pu WHERE id IN (pg_temp.id('nkmain'), pg_temp.id('nrmain'));
  r := pg_temp.macc('acme_agent1', 'nk', 'nr');
  PERFORM pg_temp.is(left(r, 1), '{', 'a person who is a contact of both is no failure: ' || r);
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = pg_temp.id('nk')), 3::bigint, 'both contacts are on the account kept');
  PERFORM pg_temp.is((SELECT prospect_user_id FROM public.contacts WHERE id = pg_temp.id('nkmain')), pu, 'the kept account''s one still stands for the prospect');
  PERFORM pg_temp.is((SELECT prospect_user_id IS NULL FROM public.contacts WHERE id = pg_temp.id('nrmain')), true, 'the one that arrived stands for nobody, so it can be merged by hand');
  -- Only a merge moves an activity to another account without its contact or opportunity.
  PERFORM pg_temp.pair('o');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.activities SET account_id = %L WHERE id = %L$q$, pg_temp.id('ok'), pg_temp.id('ornote'))), '42501',
    'a note on one account alone can not be moved to another by anything else');
  PERFORM pg_temp.is(left(pg_temp.macc('acme_agent1', 'ok', 'or'), 1), '{', 'but a merge moves it');
  PERFORM pg_temp.is(pg_temp.acct_of('activities', 'ornote'), pg_temp.id('ok'), 'to the account kept');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.activities SET account_id = %L WHERE id = %L$q$, pg_temp.id('mk'), pg_temp.id('ornote'))), '42501',
    'and once it has, the same address does not open the door again');
  RAISE NOTICE 'merge_records: main contact, prospect and activities passed';
END $$;

-- ---------- possible duplicates: marks that follow the merge, and keeping separate ----------
-- Break caught: an account marked a duplicate of the removed one loses its mark (the foreign key sets it null) instead of pointing at the kept one; the kept
-- account stays marked a duplicate of an account that no longer exists; keeping separate by someone who may not change it; clearing a mark that is not there
-- is an error; the banner offers a merge the caller would be refused.
DO $$
DECLARE r text; j jsonb;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.pair('p');
  PERFORM pg_temp.account('pthird', 'acme', 'acme_agent1', 'Third p');
  UPDATE public.accounts SET possible_duplicate_of = pg_temp.id('pr') WHERE id = pg_temp.id('pthird');
  UPDATE public.accounts SET possible_duplicate_of = pg_temp.id('pr') WHERE id = pg_temp.id('pk');
  PERFORM pg_temp.account('pz', 'acme', 'acme_agent1', 'Zed p');
  UPDATE public.accounts SET possible_duplicate_of = pg_temp.id('pz') WHERE id = pg_temp.id('pr');
  r := pg_temp.macc('acme_agent1', 'pk', 'pr');
  PERFORM pg_temp.is(left(r, 1), '{', 'merged: ' || r);
  PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE id = pg_temp.id('pthird')), pg_temp.id('pk'), 'an account marked a duplicate of the removed one is now marked one of the kept one');
  PERFORM pg_temp.is((SELECT possible_duplicate_of IS NULL FROM public.accounts WHERE id = pg_temp.id('pk')), true, 'the kept account is not a possible duplicate of the one it absorbed');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE record_key = pg_temp.id('pthird')::text AND field = 'possible_duplicate_of' AND new_value = to_jsonb(pg_temp.id('pk')::text) AND actor_id = pg_temp.id('acme_agent1')), 1::bigint,
    'and it is in that account''s history, under the person');
  -- The banner.
  PERFORM pg_temp.is(pg_temp.run('acme_agent1', format('SELECT public.account_duplicate_mark(%L, %L)::text', pg_temp.id('acme'), pg_temp.id('pk'))), NULL, 'no banner on an account with no mark');
  j := pg_temp.run('acme_agent1', format('SELECT public.account_duplicate_mark(%L, %L)::text', pg_temp.id('acme'), pg_temp.id('pthird')))::jsonb;
  PERFORM pg_temp.is(j #>> '{other,name}', 'Kept p', 'the banner names the account it is marked a duplicate of');
  PERFORM pg_temp.is((j ->> 'can_merge')::boolean, true, 'and the owner may merge them');
  PERFORM pg_temp.is((j ->> 'can_keep_separate')::boolean, true, 'or keep them separate');
  PERFORM pg_temp.account('pagent2', 'acme', 'acme_agent2', 'Agent two''s');
  UPDATE public.accounts SET possible_duplicate_of = pg_temp.id('pagent2') WHERE id = pg_temp.id('pz');
  UPDATE public.accounts SET owner_id = pg_temp.id('acme_agent2') WHERE id = pg_temp.id('pz');
  j := pg_temp.run('acme_agent2', format('SELECT public.account_duplicate_mark(%L, %L)::text', pg_temp.id('acme'), pg_temp.id('pz')))::jsonb;
  PERFORM pg_temp.is((j ->> 'can_merge')::boolean, true, 'an agent with both accounts of their own');
  UPDATE public.accounts SET possible_duplicate_of = pg_temp.id('pk') WHERE id = pg_temp.id('pz');
  j := pg_temp.run('acme_agent2', format('SELECT public.account_duplicate_mark(%L, %L)::text', pg_temp.id('acme'), pg_temp.id('pz')))::jsonb;
  PERFORM pg_temp.is(j -> 'other', 'null'::jsonb, 'the banner does not name an account the person may not see');
  PERFORM pg_temp.is((j ->> 'can_merge')::boolean, false, 'nor offer to merge it');
  PERFORM pg_temp.is((j ->> 'can_keep_separate')::boolean, true, 'but the person may keep them separate');
  -- Keep separate.
  PERFORM pg_temp.is(left(pg_temp.run('acme_agent1', format('SELECT public.keep_accounts_separate(%L, %L)::text', pg_temp.id('acme'), pg_temp.id('pthird'))), 15), '{"record": {"id', 'keep separate answers');
  PERFORM pg_temp.is((SELECT possible_duplicate_of IS NULL FROM public.accounts WHERE id = pg_temp.id('pthird')), true, 'and clears the mark');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE id IN (pg_temp.id('pk'), pg_temp.id('pthird'))), 2::bigint, 'and nothing is merged or deleted');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE record_key = pg_temp.id('pthird')::text AND field = 'possible_duplicate_of' AND new_value IS NULL AND actor_id = pg_temp.id('acme_agent1')), 1::bigint, 'it is one entry in the history, under the person');
  PERFORM pg_temp.is((pg_temp.run('acme_agent1', format('SELECT public.keep_accounts_separate(%L, %L)::text', pg_temp.id('acme'), pg_temp.id('pthird')))::jsonb ->> 'changed')::boolean, false, 'again changes nothing');
  PERFORM pg_temp.is(left(pg_temp.run('acme_agent1', format('SELECT public.keep_accounts_separate(%L, %L)::text', pg_temp.id('acme'), pg_temp.id('pz'))), 5), 'PT404', 'an account the person may not see is not there');
  UPDATE public.accounts SET possible_duplicate_of = pg_temp.id('pk') WHERE id = pg_temp.id('pthird');
  PERFORM pg_temp.is(left(pg_temp.run('acme_agent3', format('SELECT public.keep_accounts_separate(%L, %L)::text', pg_temp.id('acme'), pg_temp.id('pthird'))), 5), 'PT404', 'nor one a colleague owns');
  PERFORM pg_temp.is(left(pg_temp.run('zenith_owner', format('SELECT public.keep_accounts_separate(%L, %L)::text', pg_temp.id('acme'), pg_temp.id('pthird'))), 5), '42501', 'and another firm''s member is refused');
  PERFORM pg_temp.pair('q', 'zenith_agent', 'zenith_agent2', 'zenith');
  UPDATE public.accounts SET possible_duplicate_of = pg_temp.id('qk') WHERE id = pg_temp.id('qr');
  r := pg_temp.run('zenith_agent', format('SELECT public.keep_accounts_separate(%L, %L)::text', pg_temp.id('zenith'), pg_temp.id('qr')));
  PERFORM pg_temp.is(left(r, 5), '42501', 'someone who sees an account but may not change it can not keep it separate: ' || r);
  RAISE NOTICE 'merge_records: possible duplicates passed';
END $$;

-- ---------- a pending bulk change's undo ----------
-- Break caught: the undo of a change that named the removed account fails or names it; the undo of one that named the kept account is called "changed since"
-- because of an entry the merge moved from the removed account (which is not the kept account's own change); a merge that changed the same field is not seen.
DO $$
DECLARE c1 text; c2 text; c3 text; u jsonb;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.pair('s');
  c1 := pg_temp.run('acme_agent1', format($q$SELECT public.bulk_accounts_change(%L, 'owner', %L, NULL, %L)::text$q$, pg_temp.id('acme'),
    jsonb_build_object('owner_id', pg_temp.id('acme_agent3'))::text, jsonb_build_array(pg_temp.id('sk')::text)::text));
  c2 := pg_temp.run('acme_agent1', format($q$SELECT public.bulk_accounts_change(%L, 'owner', %L, NULL, %L)::text$q$, pg_temp.id('acme'),
    jsonb_build_object('owner_id', pg_temp.id('acme_agent3'))::text, jsonb_build_array(pg_temp.id('sr')::text)::text));
  PERFORM pg_temp.is(left(c1, 1), '{', 'fixture: a bulk change of the kept account: ' || c1);
  PERFORM pg_temp.is(left(pg_temp.macc('acme_owner', 'sk', 'sr'), 1), '{', 'merged by an owner');
  PERFORM pg_temp.is((SELECT owner_id FROM public.accounts WHERE id = pg_temp.id('sk')), pg_temp.id('acme_agent3'), 'fixture: the kept account is agent3''s');
  u := pg_temp.run('acme_agent1', format('SELECT public.bulk_accounts_undo(%L, %L)::text', c1::jsonb ->> 'change_id', pg_temp.id('acme')))::jsonb;
  PERFORM pg_temp.is((u ->> 'restored')::int, 1, 'the undo of a change of the kept account puts it back, the entry moved from the removed account being none of its changes: ' || u::text);
  PERFORM pg_temp.is((SELECT owner_id FROM public.accounts WHERE id = pg_temp.id('sk')), pg_temp.id('acme_agent1'), 'to its owner');
  u := pg_temp.run('acme_agent1', format('SELECT public.bulk_accounts_undo(%L, %L)::text', c2::jsonb ->> 'change_id', pg_temp.id('acme')))::jsonb;
  PERFORM pg_temp.is((u ->> 'restored')::int, 0, 'the undo of a change of the removed account restores nothing');
  PERFORM pg_temp.is((u ->> 'gone')::int, 1, 'and counts it gone');
  -- A merge that itself changes the field the change set: "changed since".
  PERFORM pg_temp.pair('t');
  UPDATE public.accounts SET owner_id = pg_temp.id('acme_agent2') WHERE id = pg_temp.id('tr');
  c3 := pg_temp.run('acme_agent1', format($q$SELECT public.bulk_accounts_change(%L, 'archive', '{}', NULL, %L)::text$q$, pg_temp.id('acme'), jsonb_build_array(pg_temp.id('tk')::text)::text));
  UPDATE public.accounts SET archived_at = NULL WHERE id = pg_temp.id('tk');
  c3 := pg_temp.run('acme_agent1', format($q$SELECT public.bulk_accounts_change(%L, 'owner', %L, NULL, %L)::text$q$, pg_temp.id('acme'),
    jsonb_build_object('owner_id', pg_temp.id('acme_agent3'))::text, jsonb_build_array(pg_temp.id('tk')::text)::text));
  UPDATE public.accounts SET owner_id = pg_temp.id('acme_agent2') WHERE id = pg_temp.id('tr');
  PERFORM pg_temp.is(left(pg_temp.macc('acme_owner', 'tk', 'tr', ARRAY['owner_id']), 1), '{', 'merged, taking the removed account''s owner');
  u := pg_temp.run('acme_agent1', format('SELECT public.bulk_accounts_undo(%L, %L)::text', c3::jsonb ->> 'change_id', pg_temp.id('acme')))::jsonb;
  PERFORM pg_temp.is((u ->> 'restored')::int, 0, 'the undo of an owner change the merge then changed is not made: ' || u::text);
  PERFORM pg_temp.is(u #>> '{skipped,0,reason}', 'It has been changed since.', 'it names the account as changed since');
  RAISE NOTICE 'merge_records: a pending bulk change passed';
END $$;

-- ---------- the old address ----------
-- Break caught: an old id leads nowhere, or to a record the person may not see (a link that names a record's existence), or into another firm; a second merge
-- breaks the first one's address (the record kept is merged away in turn); a deleted record kept still answers; a person with no firm, a former member or a
-- member of another firm follows; the answer for a record never made differs from one the person may not see.
DO $$
DECLARE r text; j jsonb;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.pair('u');
  PERFORM pg_temp.is(left(pg_temp.macc('acme_agent1', 'uk', 'ur'), 1), '{', 'fixture: merged');
  j := pg_temp.follow('acme_agent1', 'account', 'ur')::jsonb;
  PERFORM pg_temp.is((j ->> 'id')::uuid, pg_temp.id('uk'), 'the old address of an account leads to the account kept');
  PERFORM pg_temp.is((j ->> 'merged')::boolean, true, 'and says it was merged');
  PERFORM pg_temp.is(j ->> 'from_name', 'Removed u', 'by the name it had');
  PERFORM pg_temp.is(j ->> 'name', 'Kept u', 'into the one kept');
  PERFORM pg_temp.is((pg_temp.follow('acme_agent1', 'account', 'uk')::jsonb ->> 'merged')::boolean, false, 'the account kept answers as itself');
  -- Contacts: the id of a contact does not change when its account is merged, so the old one still opens.
  PERFORM pg_temp.is((pg_temp.follow('acme_agent1', 'contact', 'urmain')::jsonb ->> 'account_id')::uuid, pg_temp.id('uk'), 'a contact''s address now names the account it is on');
  -- Who may follow.
  PERFORM pg_temp.is(left(pg_temp.follow('acme_agent2', 'account', 'ur'), 5), 'PT404', 'someone who may not see the record kept gets the answer for none');
  PERFORM pg_temp.is(pg_temp.follow('acme_agent2', 'account', 'ur'), pg_temp.run('acme_agent2', format('SELECT public.follow_merged_record(%L, ''account'', %L)::text', pg_temp.id('acme'), gen_random_uuid())), 'the same words as for an id that was never made');
  PERFORM pg_temp.is(left(pg_temp.follow('acme_owner', 'account', 'ur'), 1), '{', 'an owner of the firm follows it');
  PERFORM pg_temp.is(left(pg_temp.follow('acme_lead', 'account', 'ur'), 5), 'PT404', 'a lead outside the records'' team does not');
  PERFORM pg_temp.is(left(pg_temp.follow('zenith_owner', 'account', 'ur', 'acme'), 5), '42501', 'a member of another firm naming this firm is refused');
  PERFORM pg_temp.is(left(pg_temp.follow('zenith_owner', 'account', 'ur', 'zenith'), 5), 'PT404', 'and naming theirs finds nothing: an id is only an address in its own firm');
  PERFORM pg_temp.is(left(pg_temp.follow('nobody', 'account', 'ur'), 5), '42501', 'a person with no firm is refused');
  PERFORM pg_temp.is(left(pg_temp.follow('acme_removed', 'account', 'ur'), 5), '42501', 'and a former member');
  PERFORM pg_temp.is(left(pg_temp.follow('acme_agent1', 'lead', 'ur'), 5), '22023', 'only an account or a contact is followed');
  -- A second merge: the record kept is merged away in turn.
  PERFORM pg_temp.account('uk2', 'acme', 'acme_agent1', 'Kept again');
  PERFORM pg_temp.is(left(pg_temp.macc('acme_agent1', 'uk2', 'uk'), 1), '{', 'the record kept is merged into another');
  PERFORM pg_temp.is((pg_temp.follow('acme_agent1', 'account', 'ur')::jsonb ->> 'id')::uuid, pg_temp.id('uk2'), 'the first old address leads to the last record kept, in one step');
  PERFORM pg_temp.is(pg_temp.follow('acme_agent1', 'account', 'uk')::jsonb ->> 'from_name', 'Kept u', 'and the second to it');
  PERFORM pg_temp.is((SELECT count(*) FROM public.merged_records WHERE into_account_id = pg_temp.id('uk2')), 2::bigint, 'both are one step from it');
  -- The record kept is deleted: nothing leads anywhere.
  PERFORM pg_temp.account('wk', 'acme', 'acme_agent1', 'Kept w');
  PERFORM pg_temp.account('wr', 'acme', 'acme_agent1', 'Removed w');
  PERFORM pg_temp.is(left(pg_temp.macc('acme_agent1', 'wk', 'wr'), 1), '{', 'fixture: two accounts with no opportunity merged');
  PERFORM pg_temp.is((pg_temp.follow('acme_agent1', 'account', 'wr')::jsonb ->> 'id')::uuid, pg_temp.id('wk'), 'followed');
  DELETE FROM public.accounts WHERE id = pg_temp.id('wk');
  PERFORM pg_temp.is(left(pg_temp.follow('acme_agent1', 'account', 'wr'), 5), 'PT404', 'a record kept that is deleted later leaves nothing to follow to');
  PERFORM pg_temp.is((SELECT count(*) FROM public.merged_records WHERE into_account_id = pg_temp.id('wk')), 0::bigint, 'and the pointers went with it');
  -- Closed to the API.
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.merged_records'), '42501', 'the table is closed to a member');
  PERFORM pg_temp.is(pg_temp.attempt('DELETE FROM public.merged_records'), '42501', 'and can not be changed by one');
  RESET ROLE;
  RAISE NOTICE 'merge_records: the old address passed';
END $$;

-- ---------- the history is still nobody's to edit ----------
-- Break caught: the merger role, or a member, or the owner of the table changes a history entry's value, time or author; the move works for a record that was
-- not merged; the history of a merge is not in the history list marked.
DO $$
DECLARE r text; want bigint; own bigint;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.pair('v');
  PERFORM pg_temp.is(left(pg_temp.macc('acme_agent1', 'vk', 'vr'), 1), '{', 'fixture: merged');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.record_history SET new_value = '"x"' WHERE record_key = %L$q$, pg_temp.id('vk')::text)), '42501', 'the table''s owner can not change a value');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.record_history SET record_key = 'x' WHERE record_key = %L$q$, pg_temp.id('vk')::text)), '42501', 'nor a key');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$DELETE FROM public.record_history WHERE record_key = %L$q$, pg_temp.id('vk')::text)), '42501', 'nor delete one');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.record_history_move(%L, 'accounts', %L, %L, 'x')$q$, pg_temp.id('acme'), pg_temp.id('vk')::text, pg_temp.id('zenith')::text)), '42501',
    'moving a history is refused when no merge was recorded');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.record_history_move(%L, 'accounts', 'a', 'b', 'x')$q$, pg_temp.id('acme'))), '42501', 'and no API role can call the function');
  RESET ROLE;
  GRANT SELECT ON fx TO record_history_merger;
  SET LOCAL ROLE record_history_merger;
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.record_history SET at = now() WHERE record_key = %L$q$, pg_temp.id('vk')::text)), '42501', 'the merger role can change no column but the three: not the time');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.record_history SET new_value = '"x"' WHERE record_key = %L$q$, pg_temp.id('vk')::text)), '42501', 'not a value');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.record_history SET actor_id = NULL WHERE record_key = %L$q$, pg_temp.id('vk')::text)), '42501', 'not the author');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$DELETE FROM public.record_history WHERE record_key = %L$q$, pg_temp.id('vk')::text)), '42501', 'and deletes nothing');
  RESET ROLE;
  -- The list a reader gets names where an entry came from.
  want := (SELECT count(*) FROM public.record_history WHERE record_key = pg_temp.id('vk')::text AND merged_from_name = 'Removed v');
  own := (SELECT count(*) FROM public.record_history WHERE record_key = pg_temp.id('vk')::text AND merged_from_key IS NULL);
  PERFORM pg_temp.as_user('acme_agent1');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history_list(pg_temp.id('acme'), 'accounts', pg_temp.id('vk')::text, 100) WHERE merged_from = 'Removed v'), want,
    'the history list says which entries came from the removed account');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history_list(pg_temp.id('acme'), 'accounts', pg_temp.id('vk')::text, 100) WHERE merged_from IS NULL), own, 'and the kept account''s own entries have none');
  RESET ROLE;
  -- The Activity tab carries the same.
  PERFORM pg_temp.is((SELECT count(*) FROM jsonb_array_elements(public.account_tab_rows(pg_temp.id('vk'), 'activity_changes', 100, 0) -> 'rows') x WHERE x ->> 'merged_from' = 'Removed v'),
    (SELECT count(*) FROM public.record_history WHERE record_key = pg_temp.id('vk')::text AND merged_from_name = 'Removed v'), 'the Activity tab marks them too');
  RAISE NOTICE 'merge_records: the history is nobody''s to edit passed';
END $$;

-- ---------- merging two contacts of one account (D-210) ----------
-- Break caught: the removed contact's calls, notes and tasks stay on a deleted contact (their contact is cleared); an opportunity loses its main contact; the main
-- place, a request not to be emailed or the prospect link is lost; two contacts of two accounts are merged; the level rule is asked of the account and not of the
-- contacts; a contact is left with no way to reach it; a merge that fails half way keeps half.
DO $$
DECLARE r text; j jsonb; pu uuid; want bigint;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.account('xa', 'acme', 'acme_agent1', 'Contacts account');
  PERFORM pg_temp.account('xb', 'acme', 'acme_agent1', 'Other account');
  PERFORM pg_temp.contact('x1', 'xa', 'acme_agent1', 'x1@e.example');
  PERFORM pg_temp.contact('x2', 'xa', 'acme_agent1', NULL, '(503) 555-0199', true);
  PERFORM pg_temp.contact('x3', 'xb', 'acme_agent1', 'x3@e.example');
  UPDATE public.contacts SET do_not_email = true, title = 'Owner', mobile = '(503) 555-0123' WHERE id = pg_temp.id('x2');
  pu := pg_temp.new_user('prospect_x');
  UPDATE public.contacts SET prospect_user_id = pu WHERE id = pg_temp.id('x2');
  PERFORM pg_temp.opportunity('xo', 'xa', 'acme_agent1', NULL, 'x2');
  PERFORM pg_temp.activity('x2call', 'call', 'xa', 'x2');
  PERFORM pg_temp.activity('x2task', 'task', 'xa', 'x2', 'xo');
  PERFORM pg_temp.activity('x1note', 'note', 'xa', 'x1');
  want := (SELECT count(*) FROM public.record_history WHERE record_key = pg_temp.id('x2')::text);
  -- The preview.
  j := pg_temp.run('acme_agent1', format('SELECT public.merge_contacts_preview(%L, %L, %L)::text', pg_temp.id('acme'), pg_temp.id('x1'), pg_temp.id('x2')))::jsonb;
  PERFORM pg_temp.is((SELECT string_agg(f ->> 'field', ',' ORDER BY o) FROM jsonb_array_elements(j -> 'fields') WITH ORDINALITY AS t (f, o)), 'first_name,last_name,title,email,phone,mobile', 'the preview lists the fields that differ');
  PERFORM pg_temp.is(j -> 'moves', jsonb_build_object('activities', 2, 'opportunities', 1, 'history', want), 'and what will move');
  PERFORM pg_temp.is((j ->> 'do_not_email')::boolean, true, 'and says the merged contact is not to be emailed');
  -- The merge, taking the title, phone and mobile.
  r := pg_temp.mcon('acme_agent1', 'x1', 'x2', ARRAY['title', 'phone', 'mobile']);
  PERFORM pg_temp.is(left(r, 1), '{', 'merged: ' || r);
  j := r::jsonb;
  PERFORM pg_temp.is(pg_temp.gone('contacts', 'x2'), true, 'the removed contact is gone');
  PERFORM pg_temp.is((SELECT contact_id FROM public.activities WHERE id = pg_temp.id('x2call')), pg_temp.id('x1'), 'its call is with the contact kept');
  PERFORM pg_temp.is((SELECT contact_id FROM public.activities WHERE id = pg_temp.id('x2task')), pg_temp.id('x1'), 'and its task');
  PERFORM pg_temp.is((SELECT opportunity_id FROM public.activities WHERE id = pg_temp.id('x2task')), pg_temp.id('xo'), 'which is still about its opportunity');
  PERFORM pg_temp.is((SELECT main_contact_id FROM public.opportunities WHERE id = pg_temp.id('xo')), pg_temp.id('x1'), 'the opportunity''s main contact is the contact kept');
  PERFORM pg_temp.is((SELECT count(*) FROM public.activities WHERE contact_id = pg_temp.id('x1')), 3::bigint, 'the kept contact has all three');
  PERFORM pg_temp.is((SELECT is_main FROM public.contacts WHERE id = pg_temp.id('x1')), true, 'the kept contact is the main contact, as the removed one was');
  PERFORM pg_temp.is((SELECT do_not_email FROM public.contacts WHERE id = pg_temp.id('x1')), true, 'and not to be emailed');
  PERFORM pg_temp.is((SELECT prospect_user_id FROM public.contacts WHERE id = pg_temp.id('x1')), pu, 'and stands for the prospect, so the chain does not add the person again');
  PERFORM pg_temp.is((SELECT title || '|' || phone || '|' || mobile || '|' || email FROM public.contacts WHERE id = pg_temp.id('x1')), 'Owner|(503) 555-0199|(503) 555-0123|x1@e.example', 'with the fields that were picked and the rest as it was');
  PERFORM pg_temp.is((j #>> '{moved,activities}')::int, 2, 'the answer counts what moved');
  PERFORM pg_temp.is((j #>> '{moved,opportunities}')::int, 1, 'and the opportunities');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE record_key = pg_temp.id('x1')::text AND merged_from_key = pg_temp.id('x2')::text AND field IS DISTINCT FROM 'merged'), want, 'its history is on the contact kept, marked');
  PERFORM pg_temp.is(pg_temp.hist('x1', 'merged'), 1::bigint, 'and the merge is one entry');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE record_key = pg_temp.id('x2')::text), 0::bigint, 'none is left under the removed one');
  PERFORM pg_temp.is((pg_temp.follow('acme_agent1', 'contact', 'x2')::jsonb ->> 'id')::uuid, pg_temp.id('x1'), 'the old address of the contact leads to the contact kept');
  PERFORM pg_temp.is((pg_temp.follow('acme_agent1', 'contact', 'x2')::jsonb ->> 'account_id')::uuid, pg_temp.id('xa'), 'with its account');
  PERFORM pg_temp.is(left(pg_temp.follow('acme_agent1', 'account', 'x2'), 5), 'PT404', 'an id of a contact is not the address of an account');
  -- Two contacts of two accounts.
  r := pg_temp.mcon('acme_agent1', 'x1', 'x3');
  PERFORM pg_temp.is(left(r, 5), '22023', 'two contacts of two accounts are not merged: ' || r);
  PERFORM pg_temp.is(r LIKE '%Move one of them to the other''s account first.', true, 'the words say to move one first');
  PERFORM pg_temp.is(left(pg_temp.mcon('acme_agent1', 'x1', 'x1'), 5), '22023', 'a contact is not merged with itself');
  RAISE NOTICE 'merge_records: merging two contacts passed';
END $$;

-- ---------- who may merge two contacts, and when not ----------
DO $$
DECLARE r text;
BEGIN
  RESET ROLE;
  -- Zenith shows everyone everything. agent: their own contact; agent2: a colleague's on the same account.
  PERFORM pg_temp.account('ya', 'zenith', 'zenith_agent', 'Zenith contacts');
  PERFORM pg_temp.contact('y1', 'ya', 'zenith_agent', 'y1@e.example');
  PERFORM pg_temp.contact('y2', 'ya', 'zenith_agent2', 'y2@e.example');
  PERFORM pg_temp.contact('y3', 'ya', NULL, 'y3@e.example');
  PERFORM pg_temp.contact('y4', 'ya', 'zenith_agent', 'y4@e.example');
  r := pg_temp.mcon('zenith_agent', 'y1', 'y2', '{}', 'zenith');
  PERFORM pg_temp.is(left(r, 5), '42501', 'a contact that is a colleague''s is not the person''s to merge: ' || r);
  PERFORM pg_temp.is(r LIKE '%because you can''t change First y2 Last y2. Only the contact''s owner%', true, 'in words that name it');
  r := pg_temp.mcon('zenith_agent', 'y1', 'y3', '{}', 'zenith');
  PERFORM pg_temp.is(r LIKE '42501: %A contact with no owner can only be changed by an owner of the firm.', true, 'a contact with no owner is an owner''s alone: ' || r);
  PERFORM pg_temp.is(left(pg_temp.mcon('zenith_owner', 'y1', 'y3', '{}', 'zenith'), 1), '{', 'an owner of the firm merges them');
  PERFORM pg_temp.is(left(pg_temp.mcon('zenith_agent', 'y1', 'y4', '{}', 'zenith'), 1), '{', 'and a person merges two of their own');
  -- Not seen: Acme's agent2 sees nothing of agent1's account.
  PERFORM pg_temp.account('za', 'acme', 'acme_agent1', 'Acme contacts');
  PERFORM pg_temp.contact('z1', 'za', 'acme_agent1', 'z1@e.example');
  PERFORM pg_temp.contact('z2', 'za', 'acme_agent1', 'z2@e.example');
  PERFORM pg_temp.is(left(pg_temp.mcon('acme_agent2', 'z1', 'z2'), 5), 'PT404', 'contacts of an account the person may not see are not there');
  PERFORM pg_temp.is(left(pg_temp.mcon('zenith_owner', 'z1', 'z2', '{}', 'acme'), 5), '42501', 'another firm''s member is refused');
  PERFORM pg_temp.is(left(pg_temp.mcon('zenith_owner', 'z1', 'z2', '{}', 'zenith'), 5), 'PT404', 'and finds none in their own');
  -- Archived.
  UPDATE public.accounts SET archived_at = now() WHERE id = pg_temp.id('za');
  PERFORM pg_temp.is(left(pg_temp.mcon('acme_agent1', 'z1', 'z2'), 5), '55000', 'the contacts of an archived account are not merged until it is restored');
  UPDATE public.accounts SET archived_at = NULL WHERE id = pg_temp.id('za');
  -- Versions, fields, a contact left with no way to reach it, all or none.
  PERFORM pg_temp.is(left(pg_temp.mcon('acme_agent1', 'z1', 'z2', '{}', 'acme', 99, NULL), 5), 'PT409', 'a version that moved is refused');
  PERFORM pg_temp.is(left(pg_temp.mcon('acme_agent1', 'z1', 'z2', ARRAY['do_not_email']), 5), '22023', 'a field that is not one of the contact''s picks is refused');
  PERFORM pg_temp.is(left(pg_temp.mcon('acme_agent1', 'z1', 'z2', ARRAY['is_main']), 5), '22023', 'the main place is not a pick');
  PERFORM pg_temp.contact('z3', 'za', 'acme_agent1', NULL, '(503) 555-0150');
  UPDATE public.contacts SET email = 'z1@e.example', phone = NULL WHERE id = pg_temp.id('z1');
  r := pg_temp.mcon('acme_agent1', 'z1', 'z3', ARRAY['email']);
  PERFORM pg_temp.is(r LIKE '22023: Enter an email or a phone number.', true, 'a pick that leaves no email or phone is refused in words: ' || r);
  UPDATE public.contacts SET phone = 'call me' WHERE id = pg_temp.id('z3');
  r := pg_temp.mcon('acme_agent1', 'z1', 'z3', ARRAY['title', 'phone']);
  PERFORM pg_temp.is(left(r, 5), '22023', 'a picked phone that fails the phone rule is refused: ' || r);
  PERFORM pg_temp.is(pg_temp.gone('contacts', 'z3'), false, 'and nothing was merged');
  PERFORM pg_temp.is((SELECT count(*) FROM public.merged_records WHERE from_id = pg_temp.id('z3')), 0::bigint, 'no old address was written');
  -- An old phone that fails the rule may stay when it is not picked.
  UPDATE public.contacts SET phone = 'call me' WHERE id = pg_temp.id('z1');
  UPDATE public.contacts SET phone = NULL, email = 'z3@e.example' WHERE id = pg_temp.id('z3');
  PERFORM pg_temp.is(left(pg_temp.mcon('acme_agent1', 'z1', 'z3'), 1), '{', 'an old phone the rule would refuse stays as it is when nobody picked it');
  -- Owners.
  PERFORM pg_temp.contact('z4', 'za', 'acme_agent1', 'z4@e.example');
  PERFORM pg_temp.contact('z5', 'za', 'acme_agent1', 'z5@e.example');
  UPDATE public.contacts SET owner_id = NULL WHERE id = pg_temp.id('z5');
  PERFORM pg_temp.is(pg_temp.mcon('acme_owner', 'z4', 'z5', ARRAY['owner_id']) LIKE '22023: First z5 Last z5 has no owner to take.%', true, 'a contact''s owner is never cleared by a pick');
  PERFORM pg_temp.contact('z6', 'za', 'acme_agent2', 'z6@e.example');
  PERFORM pg_temp.is(left(pg_temp.mcon('acme_owner', 'z4', 'z6', ARRAY['owner_id']), 1), '{', 'a current member''s ownership is taken when picked');
  PERFORM pg_temp.is((SELECT owner_id FROM public.contacts WHERE id = pg_temp.id('z4')), pg_temp.id('acme_agent2'), 'and is the contact kept''s');
  RAISE NOTICE 'merge_records: who may merge two contacts passed';
END $$;

-- ---------- two sessions ----------
-- Each case is two real connections (dblink): A begins and does its part without committing, B starts and is seen WAITING (or not, as the case says), A commits,
-- B's answer is read. The records are committed first, so both sessions see them. The statement a person's session runs is given as text, and each connection
-- is signed in as a named person (null: the superuser).
CREATE SCHEMA race;
CREATE EXTENSION dblink SCHEMA race;

CREATE FUNCTION pg_temp.claims_stmt(who text) RETURNS text LANGUAGE sql AS $$
  SELECT format('SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = %L', jsonb_build_object('sub', pg_temp.id(who), 'role', 'authenticated', 'is_anonymous', false, 'email', who || '@example.test')::text)
$$;

-- 'waited|<A's second statement: ok or SQLSTATE>|<B's answer, or SQLSTATE>'. a_late runs in A after B has started and is seen waiting (or finished): a second call of a
-- person's transaction that needs what B might hold, to prove B holds nothing A needs (no ring).
CREATE FUNCTION pg_temp.race_x(a_as text, a1 text, a_late text, b_as text, b1 text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  dsn text := format('dbname=%s user=%s port=%s host=%s', current_database(), session_user, current_setting('port'), split_part(current_setting('unix_socket_directories'), ',', 1));
  b_pid integer; tries integer := 0; waited boolean := false; ra2 text := 'none'; rb text;
BEGIN
  PERFORM race.dblink_connect('ra', dsn);
  PERFORM race.dblink_connect('rb', dsn);
  PERFORM race.dblink_exec('ra', 'SET lock_timeout = ''20s''');
  PERFORM race.dblink_exec('rb', 'SET lock_timeout = ''20s''');
  SELECT pid INTO b_pid FROM race.dblink('rb', 'SELECT pg_backend_pid()') AS t(pid integer);
  PERFORM race.dblink_exec('ra', 'BEGIN');
  IF a_as IS NOT NULL THEN PERFORM race.dblink_exec('ra', pg_temp.claims_stmt(a_as)); END IF;
  PERFORM race.dblink_exec('rb', 'BEGIN');
  IF b_as IS NOT NULL THEN PERFORM race.dblink_exec('rb', pg_temp.claims_stmt(b_as)); END IF;
  PERFORM * FROM race.dblink('ra', a1) AS t(r text);
  PERFORM race.dblink_send_query('rb', b1);
  WHILE tries < 80 LOOP
    IF cardinality(pg_blocking_pids(b_pid)) > 0 THEN waited := true; EXIT; END IF;
    IF race.dblink_is_busy('rb') = 0 THEN EXIT; END IF;
    tries := tries + 1;
    PERFORM pg_sleep(0.05);
  END LOOP;
  IF a_late IS NOT NULL THEN
    BEGIN
      PERFORM * FROM race.dblink('ra', a_late) AS t(r text);
      ra2 := 'ok';
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS ra2 = RETURNED_SQLSTATE;
    END;
  END IF;
  PERFORM race.dblink_exec('ra', 'COMMIT');
  BEGIN
    SELECT r INTO rb FROM race.dblink_get_result('rb') AS t(r text);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS rb = RETURNED_SQLSTATE;
  END;
  BEGIN PERFORM * FROM race.dblink_get_result('rb') AS t(r text); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM race.dblink_exec('rb', 'COMMIT'); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM race.dblink_disconnect('ra');
  PERFORM race.dblink_disconnect('rb');
  RETURN CASE WHEN waited THEN 'waited' ELSE 'did not wait' END || '|' || ra2 || '|' || COALESCE(rb, '<null>');
END $$;

-- The text of a merge as the connection runs it: versions read when it runs.
CREATE FUNCTION pg_temp.merge_stmt(keep text, rem text, take text[] DEFAULT '{}') RETURNS text LANGUAGE sql AS $$
  SELECT format('SELECT public.merge_accounts(%L, %L, %L, %L, (SELECT version FROM public.accounts WHERE id = %L), (SELECT version FROM public.accounts WHERE id = %L))::text',
    pg_temp.id('acme'), pg_temp.id(keep), pg_temp.id(rem), take::text, pg_temp.id(keep), pg_temp.id(rem))
$$;

-- Three accounts in id order, committed: lo < mid < hi (their names say which).
DO $$
BEGIN
  RESET ROLE;
  PERFORM pg_temp.pair('ra1'); PERFORM pg_temp.pair('ra2'); PERFORM pg_temp.pair('ra3'); PERFORM pg_temp.pair('ra4');
  PERFORM pg_temp.account('ra3q', 'acme', 'acme_agent1', 'Third account');
  PERFORM pg_temp.contact('ra4q1', 'ra3q', 'acme_agent1', 'q1@e.example');
END $$;

DO $$
BEGIN
  RESET ROLE;
  PERFORM pg_temp.pair('rb1'); PERFORM pg_temp.pair('rb2'); PERFORM pg_temp.pair('rc1'); PERFORM pg_temp.pair('rd1'); PERFORM pg_temp.pair('rd2'); PERFORM pg_temp.pair('rf1'); PERFORM pg_temp.pair('rf2');
  PERFORM pg_temp.contact('rc1c3', 'rc1r', 'acme_agent1', 'rc1c3@e.example');
  PERFORM pg_temp.activity('rc1call2', 'call', 'rc1r', 'rc1rmain');
END $$;

DO $$
BEGIN
  RESET ROLE;
  PERFORM pg_temp.pair('rg1'); PERFORM pg_temp.pair('rg2'); PERFORM pg_temp.pair('rh1'); PERFORM pg_temp.pair('rh2');
  PERFORM pg_temp.account('rjacct', 'acme', 'acme_agent1', 'Contacts race');
  PERFORM pg_temp.contact('rj1', 'rjacct', 'acme_agent1', 'rj1@e.example');
  PERFORM pg_temp.contact('rj2', 'rjacct', 'acme_agent1', 'rj2@e.example');
  PERFORM pg_temp.contact('rj3', 'rjacct', 'acme_agent1', 'rj3@e.example');
  PERFORM pg_temp.contact('rj4', 'rjacct', 'acme_agent1', 'rj4@e.example');
  PERFORM pg_temp.contact('rj5', 'rjacct', 'acme_agent1', 'rj5@e.example');
  PERFORM pg_temp.contact('rj6', 'rjacct', 'acme_agent1', 'rj6@e.example');
  PERFORM pg_temp.account('rjother', 'acme', 'acme_agent1', 'Contacts race other');
  PERFORM pg_temp.new_user('rj_new_owner');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (pg_temp.id('acme'), pg_temp.id('rj_new_owner'), 'agent');
  PERFORM pg_temp.pair('ri1');
  UPDATE public.accounts SET owner_id = pg_temp.id('rj_new_owner') WHERE id = pg_temp.id('ri1r');
END $$;

DO $$
BEGIN
  RESET ROLE;
  PERFORM pg_temp.account('rkacct', 'acme', 'acme_agent1', 'Contacts lock race');
  FOR i IN 1..4 LOOP
    PERFORM pg_temp.contact('rk' || i, 'rkacct', 'acme_agent1', 'rk' || i || '@e.example');
    PERFORM pg_temp.activity('rka' || i, 'call', 'rkacct', 'rk' || i);
  END LOOP;
  FOR i IN 1..4 LOOP
    PERFORM pg_temp.account('rl' || i, 'acme', 'acme_agent1', 'Delete race ' || i);
  END LOOP;
  -- The lower id of each pair is marked a possible duplicate of the higher.
  UPDATE public.accounts SET possible_duplicate_of = (SELECT id FROM public.accounts WHERE id IN (pg_temp.id('rl1'), pg_temp.id('rl2')) ORDER BY id DESC LIMIT 1)
    WHERE id = (SELECT id FROM public.accounts WHERE id IN (pg_temp.id('rl1'), pg_temp.id('rl2')) ORDER BY id LIMIT 1);
  UPDATE public.accounts SET possible_duplicate_of = (SELECT id FROM public.accounts WHERE id IN (pg_temp.id('rl3'), pg_temp.id('rl4')) ORDER BY id DESC LIMIT 1)
    WHERE id = (SELECT id FROM public.accounts WHERE id IN (pg_temp.id('rl3'), pg_temp.id('rl4')) ORDER BY id LIMIT 1);
END $$;

-- ---------- two merges over the same accounts ----------
-- Break caught: the two accounts are locked in the order the person named them (kept first), so two merges of the same two accounts in opposite directions hold
-- one each and wait for the other (a ring: 40P01, or the 20-second timeout above). Locked in id order the second waits at the first account and holds nothing,
-- and then finds the removed account gone (PT404).
DO $$
DECLARE r text; lo text; hi text;
BEGIN
  RESET ROLE;
  SELECT CASE WHEN pg_temp.id('ra1k') < pg_temp.id('ra1r') THEN 'ra1k' ELSE 'ra1r' END, CASE WHEN pg_temp.id('ra1k') < pg_temp.id('ra1r') THEN 'ra1r' ELSE 'ra1k' END INTO lo, hi;
  r := pg_temp.race_x('acme_agent1', pg_temp.merge_stmt(lo, hi), 'SELECT 1::text', 'acme_agent1', pg_temp.merge_stmt(hi, lo));
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'the second merge waits for the first');
  PERFORM pg_temp.is(split_part(r, '|', 2), 'ok', 'and the first is not held up by it');
  PERFORM pg_temp.is(split_part(r, '|', 3) LIKE 'PT404%' OR split_part(r, '|', 3) = 'PT404', true, 'and then finds the account gone: ' || r);
  PERFORM pg_temp.is(pg_temp.gone('accounts', hi), true, 'one merge happened');
  PERFORM pg_temp.is(pg_temp.gone('accounts', lo), false, 'and the other did not, as the first''s account was the second''s removed one');
  RAISE NOTICE 'merge_records: two merges in opposite directions passed';
END $$;


-- Three sessions: C holds something; then B, then A, start a statement and are seen waiting; C commits. Answers 'B:<answer>|A:<answer>' (each cut to 12 characters).
CREATE FUNCTION pg_temp.race_three(c1 text, b_as text, b1 text, a_as text, a1 text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  dsn text := format('dbname=%s user=%s port=%s host=%s', current_database(), session_user, current_setting('port'), split_part(current_setting('unix_socket_directories'), ',', 1));
  tries integer; res text; ans text; who text; pid integer;
BEGIN
  FOREACH who IN ARRAY ARRAY['rc', 'rb', 'ra'] LOOP
    PERFORM race.dblink_connect(who, dsn);
    PERFORM race.dblink_exec(who, 'SET lock_timeout = ''20s''');
    PERFORM race.dblink_exec(who, 'BEGIN');
  END LOOP;
  PERFORM race.dblink_exec('rb', pg_temp.claims_stmt(b_as));
  PERFORM race.dblink_exec('ra', pg_temp.claims_stmt(a_as));
  PERFORM * FROM race.dblink('rc', c1) AS t(r text);
  FOREACH who IN ARRAY ARRAY['rb', 'ra'] LOOP
    SELECT x.p INTO pid FROM race.dblink(who, 'SELECT pg_backend_pid()') AS x(p integer);
    PERFORM race.dblink_send_query(who, CASE who WHEN 'rb' THEN b1 ELSE a1 END);
    tries := 0;
    WHILE tries < 100 LOOP
      IF cardinality(pg_blocking_pids(pid)) > 0 THEN EXIT; END IF;
      tries := tries + 1;
      PERFORM pg_sleep(0.05);
    END LOOP;
  END LOOP;
  PERFORM race.dblink_exec('rc', 'COMMIT');
  FOREACH who IN ARRAY ARRAY['rb', 'ra'] LOOP
    BEGIN
      SELECT r INTO res FROM race.dblink_get_result(who) AS t(r text);
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS res = RETURNED_SQLSTATE;
    END;
    BEGIN PERFORM * FROM race.dblink_get_result(who) AS t(r text); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN PERFORM race.dblink_exec(who, 'COMMIT'); EXCEPTION WHEN OTHERS THEN NULL; END;
    ans := COALESCE(ans || '|', '') || CASE who WHEN 'rb' THEN 'B:' ELSE 'A:' END || COALESCE(left(res, 12), '<null>');
  END LOOP;
  FOREACH who IN ARRAY ARRAY['rc', 'rb', 'ra'] LOOP PERFORM race.dblink_disconnect(who); END LOOP;
  RETURN ans;
END $$;

-- ---------- two merges that each want what the other holds ----------
-- Break caught: the merge locks the account kept and then the account removed, in two statements. C holds the higher account. B (kept: the higher, removed: the
-- lower) starts first and A (kept: the lower, removed: the higher) second. In id order B takes the lower at once, A waits for B at the lower and B waits for C at the
-- higher; when C commits B finishes and A is then told the account is gone. Locked kept first, B waits for C holding nothing and A takes the lower and waits for the
-- higher; when C commits B gets the higher and asks for the lower, which A holds, while A waits for B: a ring (40P01).
DO $$
DECLARE r text; lo text; hi text;
BEGIN
  RESET ROLE;
  SELECT CASE WHEN pg_temp.id('rg1k') < pg_temp.id('rg1r') THEN 'rg1k' ELSE 'rg1r' END, CASE WHEN pg_temp.id('rg1k') < pg_temp.id('rg1r') THEN 'rg1r' ELSE 'rg1k' END INTO lo, hi;
  r := pg_temp.race_three(format('SELECT 1::text FROM public.accounts WHERE id = %L FOR UPDATE', pg_temp.id(hi)),
    'acme_agent1', pg_temp.merge_stmt(hi, lo), 'acme_agent1', pg_temp.merge_stmt(lo, hi));
  PERFORM pg_temp.is(split_part(r, '|', 1), 'B:{"moved": {"', 'the merge that started first completes: ' || r);
  PERFORM pg_temp.is(split_part(r, '|', 2), 'A:PT404', 'and the other is told the account is gone, with no deadlock: ' || r);
  RAISE NOTICE 'merge_records: two merges that each want what the other holds passed';
END $$;

-- ---------- a merge and a bulk change over the same accounts ----------
-- Break caught: the merge takes the accounts in another order than a bulk change (one statement, in id order), so each holds one the other wants. Also: the merge,
-- waiting for a bulk change that is putting a label on both accounts, then sees the label and carries it (it does not merge on what it read before).
DO $$
DECLARE r text; lo text; hi text; firm uuid := pg_temp.id('acme');
BEGIN
  RESET ROLE;
  SELECT CASE WHEN pg_temp.id('ra2k') < pg_temp.id('ra2r') THEN 'ra2k' ELSE 'ra2r' END, CASE WHEN pg_temp.id('ra2k') < pg_temp.id('ra2r') THEN 'ra2r' ELSE 'ra2k' END INTO lo, hi;
  r := pg_temp.race_x('acme_agent1',
    format($q$SELECT public.bulk_accounts_change(%L, 'label_add', '{"name":"Raced"}', NULL, %L)::text$q$, firm, jsonb_build_array(pg_temp.id(hi)::text, pg_temp.id(lo)::text)::text),
    format($q$SELECT public.bulk_accounts_change(%L, 'label_add', '{"name":"Raced"}', NULL, %L)::text$q$, firm, jsonb_build_array(pg_temp.id('ra3k')::text)::text),
    'acme_agent1', pg_temp.merge_stmt('ra2k', 'ra2r'));
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'the merge waits for the bulk change at the first account they share');
  PERFORM pg_temp.is(split_part(r, '|', 2), 'ok', 'the bulk change, asking for another account meanwhile, is not held up by the merge: no ring');
  PERFORM pg_temp.is(left(split_part(r, '|', 3), 1), '{', 'and the merge completes after it: ' || r);
  PERFORM pg_temp.is(pg_temp.labels_of('ra2k') LIKE '%Raced%', true, 'carrying the label the bulk change put on');
  PERFORM pg_temp.is(pg_temp.gone('accounts', 'ra2r'), true, 'and the account is merged');
  RAISE NOTICE 'merge_records: a merge against a bulk change passed';
END $$;

-- ---------- a merge and a move of a contact ----------
-- Break caught: the merge does not wait for a contact being moved onto or off one of its accounts (that contact is then lost with the removed account or left
-- on a deleted one), or a move does not wait for a merge of the account it is going to (it joins a deleted account).
DO $$
DECLARE r text; firm uuid := pg_temp.id('acme');
BEGIN
  RESET ROLE;
  -- A: a contact of the removed account is being moved off it to a third account; B: the merge.
  r := pg_temp.race_x('acme_agent1',
    format($q$SELECT public.move_contact(%L, %L, false, %L)::text$q$, pg_temp.id('ra3rc2'), pg_temp.id('ra3q'), firm), 'SELECT 1::text',
    'acme_agent1', pg_temp.merge_stmt('ra3k', 'ra3r'));
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'the merge waits for a contact being moved off one of its accounts');
  PERFORM pg_temp.is(left(split_part(r, '|', 3), 1), '{', 'and then completes: ' || r);
  PERFORM pg_temp.is(pg_temp.acct_of('contacts', 'ra3rc2'), pg_temp.id('ra3q'), 'the contact that was moved is where it was moved to, not lost');
  PERFORM pg_temp.is(pg_temp.acct_of('contacts', 'ra3rmain'), pg_temp.id('ra3k'), 'the other contact went with the merge');
  -- A: the merge (open); B: a contact moved onto the removed account.
  r := pg_temp.race_x('acme_agent1', pg_temp.merge_stmt('ra4k', 'ra4r'), NULL, 'acme_agent1',
    format($q$SELECT public.move_contact(%L, %L, false, %L)::text$q$, pg_temp.id('ra4q1'), pg_temp.id('ra4r'), firm));
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'a move onto an account being merged away waits for the merge');
  PERFORM pg_temp.is(split_part(r, '|', 3), 'PT404', 'and finds the account gone: ' || r);
  PERFORM pg_temp.is(pg_temp.acct_of('contacts', 'ra4q1'), pg_temp.id('ra3q'), 'the contact stayed where it was');
  RAISE NOTICE 'merge_records: a merge against a move passed';
END $$;

-- ---------- a merge and a call being logged ----------
-- Break caught: a call logged on the removed account at the same moment is deleted with it (the merge moves what it saw, and the account's delete takes the rest).
-- A call logged after the merge holds the account is refused by the key to the account (23503, which the client words), not lost.
DO $$
DECLARE r text; firm uuid := pg_temp.id('acme'); calls bigint;
BEGIN
  RESET ROLE;
  -- A: a call is being logged on the removed account (in flight); B: the merge waits for it and then moves it too.
  r := pg_temp.race_x('acme_agent1',
    format($q$SELECT public.log_activity('call', %L, NULL, NULL, NULL, 'spoke', 'In flight', NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('rb1r'), firm), NULL,
    'acme_agent1', pg_temp.merge_stmt('rb1k', 'rb1r'));
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'the merge waits for a call that is being logged on the removed account');
  PERFORM pg_temp.is(left(split_part(r, '|', 3), 1), '{', 'and then completes: ' || r);
  PERFORM pg_temp.is((SELECT count(*) FROM public.activities WHERE account_id = pg_temp.id('rb1k') AND body = 'In flight'), 1::bigint, 'the call is on the account kept, not lost');
  -- A: the merge (open); B: a call logged on the removed account waits and is then refused (the account is gone), never lost silently.
  r := pg_temp.race_x('acme_agent1', pg_temp.merge_stmt('rb2k', 'rb2r'), NULL, 'acme_agent1',
    format($q$SELECT public.log_activity('call', %L, NULL, NULL, NULL, 'spoke', 'Too late', NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('rb2r'), firm));
  calls := (SELECT count(*) FROM public.activities WHERE body = 'Too late');
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'a call logged on an account being merged away waits for the merge');
  PERFORM pg_temp.is(split_part(r, '|', 3), '23503', 'and is then refused by the foreign key to the account, which is gone: ' || r);
  PERFORM pg_temp.is(calls, 0::bigint, 'and no call is left on nothing');
  RAISE NOTICE 'merge_records: a merge against a call passed';
END $$;

-- ---------- a merge and an edit of a call ----------
-- Break caught: the merge holds the removed account's contacts before its calls, so a call being pointed at another contact of the account holds the call and
-- waits for the contact while the merge holds the contact and waits for the call (a ring). The merge waits at the call and holds no contact: other contacts of the
-- account can be locked without waiting while the merge waits (checked by locking them with NOWAIT). The call is pointed at the contact with the highest id, so a
-- merge that locked contacts first would hold the two others by then.
DO $$
DECLARE r text; firm uuid := pg_temp.id('acme'); hi text; o1 text; o2 text;
BEGIN
  RESET ROLE;
  SELECT string_agg(n, ',' ORDER BY id DESC) INTO hi FROM (SELECT n, pg_temp.id(n) AS id FROM unnest(ARRAY['rc1rc2', 'rc1c3', 'rc1rmain']) n) x;
  o1 := split_part(hi, ',', 2); o2 := split_part(hi, ',', 3); hi := split_part(hi, ',', 1);
  r := pg_temp.race_x('acme_agent1',
    format($q$SELECT public.update_activity(%L, %L, NULL, NULL, 'spoke', 'moved', NULL, NULL, NULL, %L)::text$q$, pg_temp.id('rc1rcall'), pg_temp.id(hi), firm),
    format($q$RESET ROLE; SELECT count(*)::text FROM (SELECT 1 FROM public.contacts WHERE id IN (%L, %L) FOR UPDATE NOWAIT) x$q$, pg_temp.id(o1), pg_temp.id(o2)),
    'acme_agent1', pg_temp.merge_stmt('rc1k', 'rc1r'));
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'the merge waits for a call being edited');
  PERFORM pg_temp.is(split_part(r, '|', 2), 'ok', 'while it waits the merge holds no contact of the account: the activities come first, so no ring: ' || r);
  PERFORM pg_temp.is(left(split_part(r, '|', 3), 1), '{', 'and the merge completes: ' || r);
  PERFORM pg_temp.is((SELECT contact_id FROM public.activities WHERE id = pg_temp.id('rc1rcall')), pg_temp.id(hi), 'the edit is kept');
  PERFORM pg_temp.is(pg_temp.acct_of('activities', 'rc1rcall'), pg_temp.id('rc1k'), 'on the account kept');
  RAISE NOTICE 'merge_records: a merge against an edit passed';
END $$;

-- ---------- a quote request being recorded ----------
-- Break caught (the note "For rows 13 and 21" in decisions-pending): a quote request recorded while its opportunity is being moved by a merge is left on no
-- opportunity. A merge never deletes or unlinks an opportunity, so the quote request is not refused and not orphaned, whichever is first.
DO $$
DECLARE r text; intake uuid;
BEGIN
  RESET ROLE;
  intake := pg_temp.id('rd1ri');
  -- A: the merge (open); B: a quote request is recorded on the intake of an opportunity the merge is moving.
  r := pg_temp.race_x('acme_agent1', pg_temp.merge_stmt('rd1k', 'rd1r'), NULL, NULL,
    format($q$WITH x AS (INSERT INTO public.quote_requests (session_id, peo_name, status) VALUES (%L, 'Late PEO', 'sent') RETURNING id) SELECT count(*)::text FROM x$q$, intake));
  PERFORM pg_temp.is(split_part(r, '|', 3), '1', 'a quote request recorded while the merge is open is recorded: ' || r);
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE intake_id = intake), 1::bigint, 'and its intake is still on an opportunity');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quote_requests WHERE session_id = intake AND peo_name = 'Late PEO'), 1::bigint, 'it is there');
  PERFORM pg_temp.is((SELECT a.name FROM public.opportunities o JOIN public.accounts a ON a.id = o.account_id WHERE o.intake_id = intake), 'Kept rd1', 'on the account kept');
  -- A: a quote request is being recorded (open); B: the merge goes through, and the quote request is on the opportunity after it.
  intake := pg_temp.id('rd2ri');
  r := pg_temp.race_x(NULL, format($q$WITH x AS (INSERT INTO public.quote_requests (session_id, peo_name, status) VALUES (%L, 'Early PEO', 'sent') RETURNING id) SELECT count(*)::text FROM x$q$, intake),
    NULL, 'acme_agent1', pg_temp.merge_stmt('rd2k', 'rd2r'));
  PERFORM pg_temp.is(left(split_part(r, '|', 3), 1), '{', 'a merge while a quote request is being recorded goes through: ' || r);
  PERFORM pg_temp.is((SELECT count(*) FROM public.quote_requests q JOIN public.opportunities o ON o.intake_id = q.session_id WHERE q.session_id = intake), 2::bigint, 'and both quote requests are on the opportunity');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities o WHERE o.intake_id = intake), 1::bigint, 'which is one');
  RAISE NOTICE 'merge_records: a merge against a quote request passed';
END $$;

-- ---------- a merge and the chain at a certification ----------
-- Break caught: a certification's chain, finding the removed account as the earlier one, makes its new account name it as its possible duplicate while the merge
-- deletes it, and the certification fails on the foreign key. The merge holds the chain's lock shared: the chain waits, then matches the account kept.
CREATE FUNCTION pg_temp.new_prospect(n text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  RESET ROLE;
  INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', n || '@example.test', now(), false, now(), now());
  INSERT INTO fx VALUES (n, uid);
  PERFORM pg_temp.as_user(n);
  PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');
  RESET ROLE;
  RETURN uid;
END $$;

CREATE FUNCTION pg_temp.answers(p_company text, p_state text DEFAULT 'TX', p_extra jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'company_name', p_company, 'hq_state', p_state, 'states', jsonb_build_array(p_state, 'CA'), 'employee_count', 12, 'pay_frequency', 'bi-weekly',
    'industry', 'Dental practice', 'street_address', '500 Harbor Street, Suite 300, Austin, TX 78701', 'website', 'https://www.Harborview.example/about',
    'start_month', 'March 2027', 'in_peo', true, 'current_peo', 'Paychex PEO', 'fein', '123456789')
  || p_extra
$$;

DO $$
DECLARE sid uuid;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.pair('re1');
  UPDATE public.accounts SET website = 'https://dupe-chain.example/about' WHERE id = pg_temp.id('re1r');
  PERFORM pg_temp.new_prospect('chain_p1');
  PERFORM pg_temp.as_user('chain_p1');
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (pg_temp.id('chain_p1'), pg_temp.answers('Chain Raced Inc', 'TX', '{"website": "https://dupe-chain.example/about"}')) RETURNING id INTO sid;
  RESET ROLE;
  UPDATE public.chamber_sessions SET firm_id = pg_temp.id('acme') WHERE id = sid;
  INSERT INTO fx VALUES ('chain_i1', sid);
END $$;

DO $$
DECLARE r text;
BEGIN
  RESET ROLE;
  r := pg_temp.race_x('acme_agent1', pg_temp.merge_stmt('re1k', 're1r', ARRAY['website']), NULL, 'chain_p1',
    format($q$UPDATE public.chamber_sessions SET status = 'submitted', submission = jsonb_build_object('signer_name', 'Jo Doe', 'signer_title', 'CEO', 'signed_at', '2026-11-01T12:00:00Z',
      'consent_version', '2026-10-draft-1', 'consent_text', '["I certify."]'::jsonb, 'chamber_data', chamber_data) WHERE id = %L RETURNING 'ok'$q$, pg_temp.id('chain_i1')));
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'a certification''s chain waits for a merge in flight: ' || r);
  PERFORM pg_temp.is(split_part(r, '|', 3), 'ok', 'and then goes through, not failing on the account it matched: ' || r);
  PERFORM pg_temp.is((SELECT a.possible_duplicate_of FROM public.accounts a JOIN public.opportunities o ON o.account_id = a.id WHERE o.intake_id = pg_temp.id('chain_i1')), pg_temp.id('re1k'),
    'its new account is marked a possible duplicate of the account kept, which now holds the website');
  RAISE NOTICE 'merge_records: a merge against a certification''s chain passed';
END $$;


-- ---------- the owner taken by a merge ----------
-- Break caught: the owner a merge takes is looked at and not held, so a member removed at that moment still becomes the account's owner. The merge waits for the
-- removal (the membership is held FOR SHARE) and is then refused in words.
DO $$
DECLARE r text;
BEGIN
  RESET ROLE;
  r := pg_temp.race_x(NULL, format($q$UPDATE public.firm_memberships SET valid_until = now() WHERE user_id = %L RETURNING 'ok'$q$, pg_temp.id('rj_new_owner')),
    NULL, 'acme_owner', pg_temp.merge_stmt('ri1k', 'ri1r', ARRAY['owner_id']));
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'a merge taking an owner waits for that member''s removal in flight');
  PERFORM pg_temp.is(split_part(r, '|', 3), '22023', 'and is then refused: ' || r);
  PERFORM pg_temp.is((SELECT owner_id FROM public.accounts WHERE id = pg_temp.id('ri1k')), pg_temp.id('acme_agent1'), 'the account kept has the owner it had');
  PERFORM pg_temp.is(pg_temp.gone('accounts', 'ri1r'), false, 'and nothing was merged');
  RAISE NOTICE 'merge_records: an owner taken against a removal passed';
END $$;

-- ---------- two contacts, against an archiving and a move ----------
-- Break caught: two contacts are merged on an account whose archiving is in flight; a contact being moved to another account is merged away on the account it has
-- left (a contact is lost with the removed one, or the merge acts on a contact of another account); a move of a contact being merged away puts it on an account
-- as a deleted contact.
CREATE FUNCTION pg_temp.mcon_stmt(keep text, rem text) RETURNS text LANGUAGE sql AS $$
  SELECT format('SELECT public.merge_contacts(%L, %L, %L, ''{}'', (SELECT version FROM public.contacts WHERE id = %L), (SELECT version FROM public.contacts WHERE id = %L))::text',
    pg_temp.id('acme'), pg_temp.id(keep), pg_temp.id(rem), pg_temp.id(keep), pg_temp.id(rem))
$$;

DO $$
DECLARE r text; firm uuid := pg_temp.id('acme');
BEGIN
  RESET ROLE;
  r := pg_temp.race_x(NULL, format($q$UPDATE public.accounts SET archived_at = now() WHERE id = %L RETURNING 'ok'$q$, pg_temp.id('rjacct')), NULL, 'acme_agent1', pg_temp.mcon_stmt('rj1', 'rj2'));
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'merging two contacts waits for an archiving in flight');
  PERFORM pg_temp.is(split_part(r, '|', 3), '55000', 'and is then refused: ' || r);
  UPDATE public.accounts SET archived_at = NULL WHERE id = pg_temp.id('rjacct');
  RAISE NOTICE 'merge_records: two contacts against an archiving passed';
END $$;

DO $$
DECLARE r text; firm uuid := pg_temp.id('acme');
BEGIN
  RESET ROLE;
  -- A: a contact is being moved off the account; B: it is merged away.
  r := pg_temp.race_x('acme_agent1', format($q$SELECT public.move_contact(%L, %L, false, %L)::text$q$, pg_temp.id('rj4'), pg_temp.id('rjother'), firm), NULL,
    'acme_agent1', pg_temp.mcon_stmt('rj3', 'rj4'));
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'merging a contact waits for it being moved');
  PERFORM pg_temp.is(split_part(r, '|', 3), '40001', 'and is then told it moved, never merged on an account it is no longer on: ' || r);
  PERFORM pg_temp.is(pg_temp.acct_of('contacts', 'rj4'), pg_temp.id('rjother'), 'the contact is on the account it was moved to');
  -- A: two contacts are being merged; B: the one removed is moved.
  r := pg_temp.race_x('acme_agent1', pg_temp.mcon_stmt('rj5', 'rj6'), NULL, 'acme_agent1',
    format($q$SELECT public.move_contact(%L, %L, false, %L)::text$q$, pg_temp.id('rj6'), pg_temp.id('rjother'), firm));
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'moving a contact waits for its merge');
  PERFORM pg_temp.is(split_part(r, '|', 3), 'PT404', 'and finds it gone: ' || r);
  PERFORM pg_temp.is(pg_temp.gone('contacts', 'rj6'), true, 'the contact was merged away');
  RAISE NOTICE 'merge_records: two contacts against an archiving and a move passed';
END $$;

-- ---------- the guard does not rest on the role's grants ----------
-- Break caught: the history guard lets the merging role change any column, relying on the column grants alone; a grant widened by mistake would then let it edit a
-- history. The guard itself refuses.
DO $$
BEGIN
  RESET ROLE;
  GRANT UPDATE ON public.record_history TO record_history_merger;
  GRANT SELECT ON fx TO record_history_merger;
  SET LOCAL ROLE record_history_merger;
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.record_history SET new_value = '"x"' WHERE record_key = %L$q$, pg_temp.id('vk')::text)), '42501', 'with every column granted the role still can not change a value');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.record_history SET record_key = record_key WHERE record_key = %L$q$, pg_temp.id('vk')::text)), 'rows:' || (SELECT count(*) FROM public.record_history WHERE record_key = pg_temp.id('vk')::text), 'and may still write its own three columns');
  RESET ROLE;
  REVOKE UPDATE ON public.record_history FROM record_history_merger;
  GRANT UPDATE (record_key, merged_from_key, merged_from_name) ON public.record_history TO record_history_merger;
  RAISE NOTICE 'merge_records: the guard passed';
END $$;

-- ---------- an account marked a duplicate while the merge was starting ----------
-- Break caught: the accounts a merge repoints are read once, before the lock, so one marked a possible duplicate of the removed account in that moment is repointed
-- outside the order the others are held in. The merge asks again once the accounts are held and, finding one it did not lock, asks the person to try again (40001).
DO $$
DECLARE r text;
BEGIN
  RESET ROLE;
  r := pg_temp.race_x(NULL,
    format($q$SELECT 1::text FROM public.accounts WHERE id = %L FOR NO KEY UPDATE; INSERT INTO public.accounts (firm_id, source, name, possible_duplicate_of) VALUES (%L, 'added_by_hand', 'Late duplicate', %L); SELECT 'ok'$q$,
      pg_temp.id('rh1r'), pg_temp.id('acme'), pg_temp.id('rh1r')),
    NULL, 'acme_agent1', pg_temp.merge_stmt('rh1k', 'rh1r'));
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'the merge waits for a change to the removed account in flight');
  PERFORM pg_temp.is(split_part(r, '|', 3), '40001', 'and, finding an account marked a duplicate of it that it did not hold, asks to be tried again: ' || r);
  PERFORM pg_temp.is(pg_temp.gone('accounts', 'rh1r'), false, 'nothing was merged');
  PERFORM pg_temp.is(left(pg_temp.macc('acme_agent1', 'rh1k', 'rh1r'), 1), '{', 'and trying again merges');
  PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE name = 'Late duplicate'), pg_temp.id('rh1k'), 'the late account is marked a duplicate of the account kept');
  RAISE NOTICE 'merge_records: a duplicate marked while a merge starts passed';
END $$;

-- ---------- two contacts being merged, and a call being pointed at the one kept ----------
-- Break caught (review): both contacts held FOR UPDATE. A call naming the contact removed is pointed at the contact kept: update_activity holds the call and wants
-- KEY SHARE on the contact kept, which the merge holds FOR UPDATE while it waits for that call: a ring (40P01). The contact kept is held FOR NO KEY UPDATE, which a key
-- share does not wait for. Both orders of the two ids. A takes the call (as update_activity does first), B (the merge) is seen waiting at it, then A points the call at
-- the contact kept.
CREATE FUNCTION pg_temp.point_call(call_n text, contact_n text) RETURNS text LANGUAGE sql AS $$
  SELECT format('UPDATE public.activities SET contact_id = %L WHERE id = %L RETURNING ''ok''', pg_temp.id(contact_n), pg_temp.id(call_n))
$$;
CREATE FUNCTION pg_temp.call_race(keep text, rem text, call_n text) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.race_x(NULL, format('SELECT 1::text FROM public.activities WHERE id = %L FOR NO KEY UPDATE', pg_temp.id(call_n)), pg_temp.point_call(call_n, keep),
    'acme_agent1', pg_temp.mcon_stmt(keep, rem))
$$;
DO $$
DECLARE r text; lo text; hi text;
BEGIN
  RESET ROLE;
  SELECT CASE WHEN pg_temp.id('rk1') < pg_temp.id('rk2') THEN 'rk1' ELSE 'rk2' END, CASE WHEN pg_temp.id('rk1') < pg_temp.id('rk2') THEN 'rk2' ELSE 'rk1' END INTO lo, hi;
  r := pg_temp.call_race(lo, hi, 'rka' || right(hi, 1));
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'the merge waits for the call');
  PERFORM pg_temp.is(split_part(r, '|', 2), 'ok', 'the call is pointed at the contact kept without waiting for the merge (the kept contact has the lower id): ' || r);
  PERFORM pg_temp.is(left(split_part(r, '|', 3), 1), '{', 'and the merge completes, with no deadlock: ' || r);
  PERFORM pg_temp.is((SELECT contact_id FROM public.activities WHERE id = pg_temp.id('rka' || right(hi, 1))), pg_temp.id(lo), 'the call is with the contact kept');
  RAISE NOTICE 'merge_records: a call pointed at the contact kept (lower id) passed';
END $$;

DO $$
DECLARE r text; lo text; hi text;
BEGIN
  RESET ROLE;
  SELECT CASE WHEN pg_temp.id('rk3') < pg_temp.id('rk4') THEN 'rk3' ELSE 'rk4' END, CASE WHEN pg_temp.id('rk3') < pg_temp.id('rk4') THEN 'rk4' ELSE 'rk3' END INTO lo, hi;
  r := pg_temp.call_race(hi, lo, 'rka' || right(lo, 1));
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'the merge waits for the call');
  PERFORM pg_temp.is(split_part(r, '|', 2), 'ok', 'the call is pointed at the contact kept without waiting for the merge (the kept contact has the higher id): ' || r);
  PERFORM pg_temp.is(left(split_part(r, '|', 3), 1), '{', 'and the merge completes, with no deadlock: ' || r);
  PERFORM pg_temp.is((SELECT contact_id FROM public.activities WHERE id = pg_temp.id('rka' || right(lo, 1))), pg_temp.id(hi), 'the call is with the contact kept');
  RAISE NOTICE 'merge_records: a call pointed at the contact kept (higher id) passed';
END $$;

-- ---------- deleting an account against a merge and a bulk change ----------
-- Break caught (review): delete_account held the account and then, through the foreign key action that clears their possible-duplicate mark, the accounts marked a
-- duplicate of it, in the order the action met them. X (lower id) is marked a duplicate of D (higher). C holds X; B starts first and asks for X (a merge of D into X, or a
-- bulk change of both); A starts second and deletes D. Locked in id order A waits for X holding nothing, B takes X and D and finishes, and A is then told D is gone. In the old
-- order A holds D and waits for X; when C commits B gets X and asks for D: a ring (40P01).
DO $$
DECLARE r text; lo text; hi text; firm uuid := pg_temp.id('acme');
BEGIN
  RESET ROLE;
  SELECT CASE WHEN pg_temp.id('rl1') < pg_temp.id('rl2') THEN 'rl1' ELSE 'rl2' END, CASE WHEN pg_temp.id('rl1') < pg_temp.id('rl2') THEN 'rl2' ELSE 'rl1' END INTO lo, hi;
  r := pg_temp.race_three(format('SELECT 1::text FROM public.accounts WHERE id = %L FOR UPDATE', pg_temp.id(lo)),
    'acme_agent1', pg_temp.merge_stmt(lo, hi), 'acme_agent1', format('SELECT public.delete_account(%L, %L)::text', pg_temp.id(hi), firm));
  PERFORM pg_temp.is(split_part(r, '|', 1), 'B:{"moved": {"', 'the merge completes: ' || r);
  PERFORM pg_temp.is(split_part(r, '|', 2), 'A:PT404', 'and the delete is told the account is gone, with no deadlock: ' || r);
  RAISE NOTICE 'merge_records: a delete against a merge passed';
END $$;

DO $$
DECLARE r text; lo text; hi text; firm uuid := pg_temp.id('acme');
BEGIN
  RESET ROLE;
  SELECT CASE WHEN pg_temp.id('rl3') < pg_temp.id('rl4') THEN 'rl3' ELSE 'rl4' END, CASE WHEN pg_temp.id('rl3') < pg_temp.id('rl4') THEN 'rl4' ELSE 'rl3' END INTO lo, hi;
  r := pg_temp.race_three(format('SELECT 1::text FROM public.accounts WHERE id = %L FOR UPDATE', pg_temp.id(lo)),
    'acme_agent1', format($q$SELECT public.bulk_accounts_change(%L, 'field', '{"field":"city","value":"Raced"}', NULL, %L)::text$q$, firm, jsonb_build_array(pg_temp.id(lo)::text, pg_temp.id(hi)::text)::text),
    'acme_agent1', format('SELECT public.delete_account(%L, %L)::text', pg_temp.id(hi), firm));
  PERFORM pg_temp.is(split_part(r, '|', 1) LIKE 'B:{%', true, 'the bulk change completes: ' || r);
  PERFORM pg_temp.is(split_part(r, '|', 2) LIKE 'A:{%', true, 'and the delete after it, with no deadlock: ' || r);
  PERFORM pg_temp.is(pg_temp.gone('accounts', hi), true, 'the account is deleted');
  PERFORM pg_temp.is((SELECT possible_duplicate_of IS NULL FROM public.accounts WHERE id = pg_temp.id(lo)), true, 'and the mark of the account that named it is cleared');
  RAISE NOTICE 'merge_records: a delete against a bulk change passed';
END $$;

-- ---------- two merges that do not meet ----------
-- Break caught: the merges of a firm are made to wait for each other by one lock (the chain's advisory lock taken exclusive): two merges of different accounts
-- run side by side.
DO $$
DECLARE r text;
BEGIN
  RESET ROLE;
  r := pg_temp.race_x('acme_agent1', pg_temp.merge_stmt('rf1k', 'rf1r'), NULL, 'acme_agent1', pg_temp.merge_stmt('rf2k', 'rf2r'));
  PERFORM pg_temp.is(split_part(r, '|', 1), 'did not wait', 'two merges of different accounts of one firm do not wait for each other');
  PERFORM pg_temp.is(left(split_part(r, '|', 3), 1), '{', 'and both are made: ' || r);
  RAISE NOTICE 'merge_records: two merges of different accounts passed';
END $$;
