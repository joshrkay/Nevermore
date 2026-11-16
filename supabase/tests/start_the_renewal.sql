-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh start_the_renewal
-- Start the renewal (story CRM-A2.4b; docs/BROKER_CRM_BUILD.md D-449, D-452, D-437; 20261121160000_start_the_renewal.sql). opportunity_create takes the renewal it
-- starts and links the new opportunity to it in the same transaction. Every migration is loaded, in filename order (D-105), this story's last.
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



CREATE FUNCTION pg_temp.as_call(who text, addr text, stmt text) RETURNS text LANGUAGE plpgsql AS $$
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

-- A renewal of the employer's current plan, made as the superuser (add_renewal has its own test).
CREATE FUNCTION pg_temp.renewal(n text, p_account text, p_on date DEFAULT current_date + 60) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r uuid;
BEGIN
  INSERT INTO public.renewals (firm_id, account_id, kind, with_whom, renews_on)
  SELECT a.firm_id, a.id, 'current_plan', 'Aetna', p_on FROM public.accounts a WHERE a.id = pg_temp.id(p_account) RETURNING id INTO r;
  INSERT INTO fx VALUES (n, r);
  RETURN r;
END $$;

-- opportunity_create as the renewal's story calls it: the name, source Renewal, and the renewal.
CREATE FUNCTION pg_temp.start(who text, firm text, p_account text, p_name text, p_renewal uuid) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.as_call(who, CASE WHEN firm = 'zenith' THEN 'zenith-benefits' ELSE 'acme-brokers' END, format(
    $q$SELECT public.opportunity_create(%L, %L, NULL, NULL, NULL, NULL, NULL, 'Renewal', NULL, NULL, NULL, %L, %L)::text$q$,
    pg_temp.id(p_account), p_name, pg_temp.id(firm), p_renewal))
$$;

DO $$
DECLARE acme uuid; zenith uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Acme Brokers', 'acme-brokers', now()) RETURNING id INTO acme;
  INSERT INTO public.firms (name, address, approved_at, visibility) VALUES ('Zenith Benefits', 'zenith-benefits', now(), 'everyone') RETURNING id INTO zenith;
  INSERT INTO fx VALUES ('acme', acme), ('zenith', zenith);
  PERFORM pg_temp.new_user('acme_owner'); PERFORM pg_temp.new_user('acme_agent1'); PERFORM pg_temp.new_user('acme_agent2');
  PERFORM pg_temp.new_user('zenith_owner'); PERFORM pg_temp.new_user('zenith_agent'); PERFORM pg_temp.new_user('zenith_agent2');
  INSERT INTO public.firm_memberships (firm_id, user_id, role, team_id) VALUES
    (acme, pg_temp.id('acme_owner'), 'owner', NULL), (acme, pg_temp.id('acme_agent1'), 'agent', NULL), (acme, pg_temp.id('acme_agent2'), 'agent', NULL),
    (zenith, pg_temp.id('zenith_owner'), 'owner', NULL), (zenith, pg_temp.id('zenith_agent'), 'agent', NULL), (zenith, pg_temp.id('zenith_agent2'), 'agent', NULL);
  PERFORM pg_temp.account('a1', 'acme', 'acme_agent1');
  PERFORM pg_temp.account('a2', 'acme', 'acme_agent1');
  PERFORM pg_temp.account('z1', 'zenith', 'zenith_agent');
  PERFORM pg_temp.renewal('r_ok', 'a1');
  PERFORM pg_temp.renewal('r_other', 'a2');
  PERFORM pg_temp.renewal('r_done', 'a1');
  PERFORM pg_temp.renewal('r_lost', 'a1');
  PERFORM pg_temp.renewal('r_worked', 'a1');
  PERFORM pg_temp.renewal('r_race', 'a1');
  PERFORM pg_temp.renewal('zr1', 'z1');
  UPDATE public.renewals SET not_renewed_on = current_date WHERE id = pg_temp.id('r_done');
END $$;

-- ---------- the link ----------
-- Break caught: Start the renewal's opportunity is made but the renewal does not name it (so the renewal keeps offering Start the renewal and the opportunity
-- is orphaned, D-449); the link is a second call that can fail after the opportunity is made; the link is not tracked (its version and history do not move);
-- an opportunity made without a renewal changes some renewal.
DO $$
DECLARE r text; opp uuid;
BEGIN
  r := pg_temp.start('acme_agent1', 'acme', 'a1', 'January 2027 renewal', pg_temp.id('r_ok'));
  PERFORM pg_temp.is(left(r, 1), '{', 'the opportunity is made: ' || r);
  opp := (r::jsonb -> 'record' ->> 'id')::uuid;
  PERFORM pg_temp.is((SELECT opportunity_id FROM public.renewals WHERE id = pg_temp.id('r_ok')), opp, 'and the renewal names it');
  PERFORM pg_temp.is((SELECT version FROM public.renewals WHERE id = pg_temp.id('r_ok')), 2, 'the renewal''s version moved');
  PERFORM pg_temp.is((SELECT string_agg(field, ',') FROM public.record_history h WHERE h.table_name = 'renewals' AND h.record_key = pg_temp.id('r_ok')::text AND h.kind = 'changed'),
    'opportunity_id', 'and its history says the opportunity was named');
  PERFORM pg_temp.is(r::jsonb -> 'record' ->> 'name', 'January 2027 renewal', 'the opportunity is as asked');
  r := pg_temp.as_call('acme_agent1', 'acme-brokers', format($q$SELECT public.opportunity_create(%L, 'No renewal', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('a1'), pg_temp.id('acme')));
  PERFORM pg_temp.is(left(r, 1), '{', 'an opportunity made without a renewal still works: ' || r);
  PERFORM pg_temp.is((SELECT count(*) FROM public.renewals WHERE opportunity_id IS NOT NULL AND id <> pg_temp.id('r_ok')), 0::bigint, 'and links no renewal');
END $$;

-- ---------- refusals ----------
-- Break caught: a renewal of another account, a missing one or another firm's is linked (22023); a renewal marked "Didn't renew" is started again (PT409); one
-- worked by an open opportunity takes a second (PT409, naming it); a person who sees the account but may not change it links a renewal (42501, D-452); a refused
-- start leaves an opportunity behind.
DO $$
DECLARE r text; before_n bigint;
BEGIN
  SELECT count(*) INTO before_n FROM public.opportunities;
  PERFORM pg_temp.is(pg_temp.start('acme_agent1', 'acme', 'a1', 'X', pg_temp.id('r_other')), '22023: Choose a renewal of this account.', 'a renewal of another account');
  PERFORM pg_temp.is(pg_temp.start('acme_agent1', 'acme', 'a1', 'X', gen_random_uuid()), '22023: Choose a renewal of this account.', 'a renewal that is not there');
  PERFORM pg_temp.is(pg_temp.start('acme_agent1', 'acme', 'a1', 'X', pg_temp.id('zr1')), '22023: Choose a renewal of this account.', 'another firm''s renewal');
  PERFORM pg_temp.is(pg_temp.start('acme_agent1', 'acme', 'a1', 'X', pg_temp.id('r_done')), 'PT409: This renewal is marked as not renewed, so there is no renewal to start.', 'a renewal marked as not renewed');
  PERFORM pg_temp.is(pg_temp.start('acme_agent1', 'acme', 'a1', 'Second', pg_temp.id('r_ok')), 'PT409: Its renewal is being worked by January 2027 renewal', 'a renewal an open opportunity works, naming it');
  PERFORM pg_temp.is(pg_temp.start('zenith_agent2', 'zenith', 'z1', 'X', pg_temp.id('zr1')), '42501: Only the account''s owner, a lead of the owner''s team or an owner of the firm can change its renewals.', 'someone who sees the account and may not change it');
  PERFORM pg_temp.is(pg_temp.start('acme_agent2', 'acme', 'a1', 'X', pg_temp.id('r_ok')), 'PT404: That account isn''t available', 'someone who cannot see the account is refused first, as before');
  PERFORM pg_temp.is(pg_temp.start('acme_agent1', 'acme', 'a1', '', pg_temp.id('r_lost')), '22023: Give the opportunity a name.', 'a bad field is refused before the renewal is looked at');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities), before_n, 'and no refusal left an opportunity behind');
  PERFORM pg_temp.is((SELECT opportunity_id FROM public.renewals WHERE id = pg_temp.id('r_lost')), NULL::uuid, 'or a link');
END $$;

-- ---------- linking again after a loss (D-449) ----------
-- Break caught: a renewal whose opportunity was lost cannot be started again, or the new one does not replace the lost one on the renewal.
DO $$
DECLARE r text; first_opp uuid; second_opp uuid;
BEGIN
  r := pg_temp.start('acme_agent1', 'acme', 'a1', 'First try', pg_temp.id('r_lost'));
  first_opp := (r::jsonb -> 'record' ->> 'id')::uuid;
  PERFORM pg_temp.is(pg_temp.start('acme_agent1', 'acme', 'a1', 'Too soon', pg_temp.id('r_lost')), 'PT409: Its renewal is being worked by First try', 'while it is open the renewal is worked');
  r := pg_temp.as_call('acme_agent1', 'acme-brokers', format($q$SELECT public.opportunity_mark_lost(%L, 'price', NULL, %L, 1)::text$q$, first_opp, pg_temp.id('acme')));
  PERFORM pg_temp.is(left(r, 1), '{', 'the first is marked lost: ' || r);
  r := pg_temp.start('acme_agent1', 'acme', 'a1', 'Second try', pg_temp.id('r_lost'));
  PERFORM pg_temp.is(left(r, 1), '{', 'the renewal is started again: ' || r);
  second_opp := (r::jsonb -> 'record' ->> 'id')::uuid;
  PERFORM pg_temp.is((SELECT opportunity_id FROM public.renewals WHERE id = pg_temp.id('r_lost')), second_opp, 'and names the new one');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE id = first_opp), 1::bigint, 'the lost one is kept');
END $$;

-- ---------- two sessions at once ----------
-- Break caught: two saves of Start the renewal on one renewal both link (the renewal names one and the other opportunity is orphaned), or deadlock on the
-- account. The first holds its save uncommitted; the second waits on it; once the first commits the second is refused (PT409), nothing made.
CREATE SCHEMA race;
CREATE EXTENSION dblink SCHEMA race;
DO $$
DECLARE
  dsn text := format('dbname=%s user=%s port=%s host=%s', current_database(), session_user, current_setting('port'),
    split_part(current_setting('unix_socket_directories'), ',', 1));
  a_pid integer; b_pid integer; tries integer; got text;
  open_as text := format('SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = %L; SET LOCAL request.headers = %L',
    jsonb_build_object('sub', pg_temp.id('acme_agent1'), 'role', 'authenticated', 'is_anonymous', false, 'email', 'acme_agent1@example.test')::text,
    jsonb_build_object('x-firm-address', 'acme-brokers')::text);
  save_a text := format($q$SELECT public.opportunity_create(%L, 'Racer A', NULL, NULL, NULL, NULL, NULL, 'Renewal', NULL, NULL, NULL, %L, %L)::text$q$, pg_temp.id('a1'), pg_temp.id('acme'), pg_temp.id('r_race'));
  save_b text := replace(save_a, 'Racer A', 'Racer B');
BEGIN
  PERFORM race.dblink_connect('ra', dsn);
  PERFORM race.dblink_connect('rb', dsn);
  SELECT pid INTO a_pid FROM race.dblink('ra', 'SELECT pg_backend_pid()') AS t(pid integer);
  SELECT pid INTO b_pid FROM race.dblink('rb', 'SELECT pg_backend_pid()') AS t(pid integer);
  PERFORM race.dblink_exec('ra', 'BEGIN');
  PERFORM race.dblink_exec('ra', open_as);
  PERFORM race.dblink_exec('ra', 'DO $do$ BEGIN ' || replace(replace(save_a, 'SELECT ', 'PERFORM '), '::text', '') || '; END $do$');
  PERFORM race.dblink_exec('rb', 'BEGIN');
  PERFORM race.dblink_exec('rb', open_as);
  PERFORM race.dblink_send_query('rb', save_b);
  tries := 0;
  WHILE tries < 100 AND NOT (a_pid = ANY (pg_blocking_pids(b_pid))) LOOP
    tries := tries + 1;
    PERFORM pg_sleep(0.05);
  END LOOP;
  PERFORM pg_temp.is(a_pid = ANY (pg_blocking_pids(b_pid)), true, 'the second start waits behind the first');
  PERFORM race.dblink_exec('ra', 'COMMIT');
  BEGIN
    PERFORM * FROM race.dblink_get_result('rb') AS t(r text);
    got := 'ok';
  EXCEPTION WHEN OTHERS THEN
    got := SQLSTATE || ': ' || SQLERRM;
  END;
  PERFORM * FROM race.dblink_get_result('rb') AS t(r text);
  PERFORM race.dblink_exec('rb', 'ROLLBACK');
  PERFORM race.dblink_disconnect('ra');
  PERFORM race.dblink_disconnect('rb');
  PERFORM pg_temp.is(got, 'PT409: Its renewal is being worked by Racer A', 'the second is refused once the first has committed');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE name IN ('Racer A', 'Racer B')), 1::bigint, 'and made nothing');
  PERFORM pg_temp.is((SELECT o.name FROM public.renewals r JOIN public.opportunities o ON o.id = r.opportunity_id WHERE r.id = pg_temp.id('r_race')), 'Racer A', 'the renewal names the first');
  RAISE NOTICE 'start_the_renewal: passed';
END $$;
