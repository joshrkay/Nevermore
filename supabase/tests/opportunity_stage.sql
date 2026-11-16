-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh opportunity_stage
-- What an opportunity's stage is (story CRM-O1.2; docs/BROKER_CRM_BUILD.md D-10, D-408 to D-417; ADR 0026; 20261120090000_opportunity_stage.sql).
-- Lost with no intake kept on the opportunity and refused an intake; a send recorded at Ready for market moves the submission to Sent to PEOs and a quote
-- recorded at Sent to PEOs moves it to Quoted, in the same transaction and nowhere else, with its cause and the person who recorded it in the status
-- history; the opportunity's history also reads the submission's stage changes, never copied into record_history. Two firms are used throughout.
-- Every migration is loaded, in filename order (D-105), this story's last.
\set ON_ERROR_STOP 1
-- filename order (D-105), this story's last.
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

-- ---------- Lost with no intake is kept on the opportunity (D-408) ----------
-- Break caught: the opportunity has nowhere to keep that it was lost (lost_at, lost_by); an opportunity with no intake and marked lost still reads
-- Qualifying; one never marked lost stops reading Qualifying; reopening (clearing lost_at) does not bring it back to Qualifying; the stage is stored
-- instead of worked out; the stage of an opportunity WITH an intake stops following its submission; a lost mark with no person's stamp or a stamp with
-- no mark is let through.
DO $$
DECLARE o_open uuid; o_lost uuid; o_intake uuid;
BEGIN
  PERFORM pg_temp.account('a1', 'acme', 'acme_owner');
  o_open := pg_temp.opportunity('o_open', 'a1', 'acme_owner');
  o_lost := pg_temp.opportunity('o_lost', 'a1', 'acme_owner');
  PERFORM pg_temp.intake('i1', 'acme');
  o_intake := pg_temp.opportunity('o_intake', 'a1', 'acme_owner', 'i1');
  PERFORM pg_temp.is((SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'opportunities' AND column_name IN ('lost_at', 'lost_by', 'lost_reason', 'lost_note')), 'lost_at,lost_by,lost_note,lost_reason',
    'the opportunity keeps lost_at and lost_by, and (from CRM-O1.3, the won/lost migration) also carries the lost reason and its note');
  PERFORM pg_temp.is(public.opportunity_stage(o_open), 'qualifying', 'no intake and not marked lost is Qualifying');
  UPDATE public.opportunities SET lost_at = now(), lost_by = pg_temp.id('acme_agent') WHERE id = o_lost;
  PERFORM pg_temp.is(public.opportunity_stage(o_lost), 'lost', 'no intake, marked lost: Lost');
  PERFORM pg_temp.is(public.opportunity_stage(o_open), 'qualifying', 'and its sibling is still Qualifying');
  PERFORM pg_temp.is(public.opportunity_stage(o_intake), 'intake_under_way', 'an opportunity with an intake still follows its submission');
  UPDATE public.opportunities SET lost_at = NULL, lost_by = NULL WHERE id = o_lost;
  PERFORM pg_temp.is(public.opportunity_stage(o_lost), 'qualifying', 'reopened, with no intake, it is Qualifying again');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.opportunities SET lost_by = %L WHERE id = %L$q$, pg_temp.id('acme_agent'), o_lost)), '23514',
    'a person who marked it lost, with no time it was marked, is refused');
  PERFORM pg_temp.is(public.opportunity_stage_of(NULL), 'qualifying', 'the mapping of a pipeline stage alone still answers no intake as Qualifying');
  -- D-216 is untouched: archived from won stays Won.
  PERFORM pg_temp.is(public.account_status(pg_temp.id('a1')), 'prospect', 'a lost-with-no-intake opportunity does not make a client');
  RAISE NOTICE 'opportunity_stage: lost with no intake passed';
END $$;

-- ---------- An opportunity marked lost is refused an intake (D-410) ----------
-- Break caught: a lost opportunity is given an intake (so it would have two truths: lost on itself and the stage of its submission); the refusal is
-- in other words than the ones D-410 settles; an opportunity with an intake can be marked lost on itself; reopening does not let it have an intake.
DO $$
DECLARE o_lost uuid; i uuid;
BEGIN
  o_lost := pg_temp.opportunity('o_lost2', 'a1', 'acme_owner');
  i := pg_temp.intake('i2', 'acme');
  UPDATE public.opportunities SET lost_at = now(), lost_by = pg_temp.id('acme_agent') WHERE id = o_lost;
  PERFORM pg_temp.is(pg_temp.refusal(format($q$UPDATE public.opportunities SET intake_id = %L WHERE id = %L$q$, i, o_lost)),
    '22023: This opportunity was marked lost. Reopen it before starting a quote.', 'giving a lost opportunity an intake');
  PERFORM pg_temp.is((SELECT intake_id FROM public.opportunities WHERE id = o_lost), NULL::uuid, 'and it has no intake');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$INSERT INTO public.opportunities (firm_id, account_id, name, intake_id, lost_at) SELECT firm_id, id, 'x', %L, now() FROM public.accounts WHERE id = %L$q$, i, pg_temp.id('a1'))),
    '22023: This opportunity was marked lost. Reopen it before starting a quote.', 'making one lost and with an intake in one statement');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$UPDATE public.opportunities SET lost_at = now() WHERE id = %L$q$, pg_temp.id('o_intake'))),
    '22023: This opportunity has an intake, so it is lost through its submission.', 'marking an opportunity that has an intake lost on itself');
  UPDATE public.opportunities SET lost_at = NULL, lost_by = NULL WHERE id = o_lost;
  UPDATE public.opportunities SET intake_id = i WHERE id = o_lost;
  PERFORM pg_temp.is(public.opportunity_stage(o_lost), 'intake_under_way', 'reopened, it takes an intake and follows it');
  RAISE NOTICE 'opportunity_stage: refusing an intake passed';
END $$;

-- ---------- Lost and reopened with no intake are tracked fields (D-413) ----------
-- Break caught: lost_at or lost_by is not in the opportunity's history and version (so a save started before it would overwrite it unseen); who marked it
-- is shown as an id or not at all; the version does not rise.
DO $$
DECLARE o uuid; v1 integer; got text;
BEGIN
  o := pg_temp.opportunity('o_tracked', 'a1', 'acme_owner');
  v1 := (SELECT version FROM public.opportunities WHERE id = o);
  PERFORM pg_temp.claims_of('acme_agent');
  UPDATE public.opportunities SET lost_at = '2026-11-20 10:00+00', lost_by = pg_temp.id('acme_agent') WHERE id = o;
  PERFORM pg_temp.is((SELECT version FROM public.opportunities WHERE id = o), v1 + 1, 'marking it lost raises its version');
  UPDATE public.opportunities SET lost_at = NULL, lost_by = NULL WHERE id = o;
  PERFORM pg_temp.is((SELECT version FROM public.opportunities WHERE id = o), v1 + 2, 'and reopening raises it again');
  PERFORM pg_temp.as_owner();
  SELECT string_agg(field || ':' || CASE WHEN old_value IS NULL THEN 'none' ELSE 'set' END || '>' || CASE WHEN new_value IS NULL THEN 'none' ELSE 'set' END, ' ' ORDER BY id) INTO got
    FROM public.record_history WHERE table_name = 'opportunities' AND record_key = o::text AND kind = 'changed';
  PERFORM pg_temp.is(got, 'lost_at:none>set lost_by:none>set lost_at:set>none lost_by:set>none', 'lost and reopened are history entries');
  PERFORM pg_temp.is((SELECT new_value #>> '{}' FROM public.record_history WHERE table_name = 'opportunities' AND record_key = o::text AND field = 'lost_by' AND new_value IS NOT NULL),
    pg_temp.id('acme_agent')::text, 'the one who marked it is the value (the reader turns an id into a name; the history never shows one)');
  RAISE NOTICE 'opportunity_stage: tracked fields passed';
END $$;

-- ---------- A send and a quote move the pipeline stage forward (D-411, D-412, ADR 0026) ----------
-- The superuser moves a fixture the way an old move was made (a pipeline row and a history row, no cause); the people then act through the real functions.
CREATE FUNCTION pg_temp.fmove(intake text, to_status text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE from_status text;
BEGIN
  SELECT w.status INTO from_status FROM public.submission_workflow w WHERE w.session_id = pg_temp.id(intake);
  UPDATE public.submission_workflow SET status = to_status WHERE session_id = pg_temp.id(intake);
  INSERT INTO public.submission_status_history (session_id, from_status, to_status) VALUES (pg_temp.id(intake), from_status, to_status);
END $$;

-- The employer's authorization of a PEO (M-1.1, 20261122100000), written as the superuser so the sends below are allowed; the PEO is listed first if
-- it is not (Paychex is not one of the five).
CREATE FUNCTION pg_temp.authorize(sid uuid, peo text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.peos (name) SELECT peo WHERE NOT EXISTS (SELECT 1 FROM public.peos p WHERE lower(p.name) = lower(peo));
  INSERT INTO public.peo_authorizations (session_id, peo_id, peo_name, authorized, wording_version, wording_text, signed_by)
  SELECT sid, p.id, p.name, true, public.peo_authorization_version(), 'I authorize ' || p.name || '.', s.user_id
  FROM public.peos p, public.chamber_sessions s WHERE lower(p.name) = lower(peo) AND s.id = sid;
END $$;

-- An intake of a firm at Ready for market, certified as far as the pipeline is concerned, with its opportunity, and the PEOs this test sends to
-- authorized by its employer.
CREATE FUNCTION pg_temp.ready(n text, firm text, p_account text DEFAULT 'a1') RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE sid uuid := pg_temp.intake(n, firm); peo text;
BEGIN
  PERFORM pg_temp.fmove(n, 'submitted');
  PERFORM pg_temp.fmove(n, 'under_review');
  PERFORM pg_temp.fmove(n, 'ready_for_market');
  PERFORM pg_temp.opportunity('o_' || n, p_account, 'acme_owner', n);
  FOREACH peo IN ARRAY ARRAY['TriNet', 'Justworks', 'Insperity', 'Paychex'] LOOP PERFORM pg_temp.authorize(sid, peo); END LOOP;
  RETURN sid;
END $$;

CREATE FUNCTION pg_temp.pipeline(n text) RETURNS text LANGUAGE sql STABLE AS $$ SELECT status FROM public.submission_workflow WHERE session_id = pg_temp.id(n) $$;

-- The moves with a cause on a submission, oldest first, as 'from>to:cause:quote request' text, and who made each (by email local part).
CREATE FUNCTION pg_temp.caused(n text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(string_agg(h.from_status || '>' || h.to_status || ':' || h.cause || ':' || COALESCE(q.peo_name, '?') || ':' || split_part(h.changed_by_email, '@', 1), ' ' ORDER BY h.id), '')
  FROM public.submission_status_history h LEFT JOIN public.quote_requests q ON q.id = h.cause_quote_request_id
  WHERE h.session_id = pg_temp.id(n) AND h.cause IS NOT NULL
$$;

CREATE FUNCTION pg_temp.qid(n text, peo text) RETURNS bigint LANGUAGE sql STABLE AS $$
  SELECT id FROM public.quote_requests WHERE session_id = pg_temp.id(n) AND peo_name = peo
$$;

-- Break caught: a send at Ready for market leaves the submission there (the opportunity sits at Ready to send while its quotes are out, the
-- failure ADR 0026 names); the move is made in another transaction than the send; the move is not in the status history or has no cause, no quote request,
-- or not the person who recorded the send; a send at any other stage moves it (backward from Quoted, or past Sent to PEOs); a refused send moves it.
DO $$
DECLARE i uuid; o uuid; req jsonb; before_rows bigint;
BEGIN
  i := pg_temp.ready('send1', 'acme');
  o := pg_temp.id('o_send1');
  PERFORM pg_temp.is(public.opportunity_stage(o), 'ready_to_send', 'before the send the opportunity is at Ready to send');

  -- A refused send moves nothing, and a prospect, a stranger and another firm's owner are refused before anything is read.
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.advisor_record_quote_send(pg_temp.id('send1'), '   ', NULL)$q$), '22023', 'a send with no PEO is refused');
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.advisor_record_quote_send(pg_temp.id('send1'), 'TriNet', NULL)$q$), 'PT404', 'another firm''s owner is told it is not found');
  PERFORM pg_temp.as_user('nobody');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.advisor_record_quote_send(pg_temp.id('send1'), 'TriNet', NULL)$q$), '42501', 'a stranger is refused');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.pipeline('send1'), 'ready_for_market', 'none of those moved it');
  PERFORM pg_temp.is((SELECT count(*) FROM public.submission_status_history WHERE session_id = i AND cause IS NOT NULL), 0::bigint, 'and none wrote a caused move');

  -- The send.
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  req := public.advisor_record_quote_send(i, 'TriNet', NULL);
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.pipeline('send1'), 'sent_to_carrier', 'a send at Ready for market moves the submission to Sent to PEOs');
  PERFORM pg_temp.is(public.opportunity_stage(o), 'in_market', 'so the opportunity is In market');
  PERFORM pg_temp.is(pg_temp.caused('send1'), 'ready_for_market>sent_to_carrier:quote_send:TriNet:acme_owner', 'the move is in the status history, caused by the send, by the person who recorded it');
  PERFORM pg_temp.is((SELECT w.updated_by FROM public.submission_workflow w WHERE w.session_id = i), pg_temp.id('acme_owner'), 'the pipeline row says who moved it');
  PERFORM pg_temp.is((SELECT h.cause_quote_request_id FROM public.submission_status_history h WHERE h.session_id = i AND h.cause = 'quote_send'), (req ->> 'id')::bigint, 'and which quote request');
  PERFORM pg_temp.is((SELECT h.changed_by FROM public.submission_status_history h WHERE h.session_id = i AND h.cause = 'quote_send'), pg_temp.id('acme_owner'), 'changed_by is that person''s id');
  PERFORM pg_temp.is((SELECT h.note FROM public.submission_status_history h WHERE h.session_id = i AND h.cause = 'quote_send'), NULL::text, 'with no note of its own (the cause says it)');

  -- Only from that exact stage: more sends move nothing, at Sent to PEOs and at Quoted.
  before_rows := (SELECT count(*) FROM public.submission_status_history WHERE session_id = i);
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.advisor_record_quote_send(i, 'Justworks', NULL);
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.pipeline('send1'), 'sent_to_carrier', 'a send at Sent to PEOs leaves it there');
  PERFORM pg_temp.is((SELECT count(*) FROM public.submission_status_history WHERE session_id = i), before_rows, 'and writes no history row');
  PERFORM pg_temp.fmove('send1', 'quoted');
  before_rows := (SELECT count(*) FROM public.submission_status_history WHERE session_id = i);
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM public.advisor_record_quote_send(i, 'Insperity', NULL);
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.pipeline('send1'), 'quoted', 'a send at Quoted never moves it backward');
  PERFORM pg_temp.is((SELECT count(*) FROM public.submission_status_history WHERE session_id = i), before_rows, 'and writes no history row');
  RAISE NOTICE 'opportunity_stage: a send moves the stage passed';
END $$;

-- Break caught: a quote recorded at Sent to PEOs leaves the submission there; a decline or a closing moves it; a quote recorded at any other stage moves
-- it (at Ready for market, at Quoted again); a submission put back to Sent to PEOs after a quote does not move to Quoted with the next one (D-411: the rule
-- is the stage, not "first"); the move has no cause, no quote request or not the person who recorded the quote; one person's move is written with a cause
-- (a person's own move has none).
DO $$
DECLARE i uuid; o uuid; trinet bigint; justworks bigint; n bigint;
BEGIN
  i := pg_temp.ready('quote1', 'acme');
  o := pg_temp.id('o_quote1');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM public.advisor_record_quote_send(i, 'TriNet', NULL);
  PERFORM public.advisor_record_quote_send(i, 'Justworks', NULL);
  PERFORM pg_temp.as_owner();
  trinet := pg_temp.qid('quote1', 'TriNet');
  justworks := pg_temp.qid('quote1', 'Justworks');
  PERFORM pg_temp.is(pg_temp.pipeline('quote1'), 'sent_to_carrier', 'two sends: Sent to PEOs');

  -- A decline and a closing are not a quote.
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM public.advisor_update_quote_request(trinet, 'declined');
  PERFORM public.advisor_update_quote_request(justworks, 'closed');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.pipeline('quote1'), 'sent_to_carrier', 'a decline and a closing move nothing');
  -- A refused answer moves nothing: the quote needs its fee in range.
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.advisor_update_quote_request(%s, 'quoted', NULL, NULL, NULL, -1)$q$, trinet)), '22023', 'a quote with a bad fee is refused');
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.advisor_update_quote_request(%s, 'quoted')$q$, trinet)), 'PT404', 'another firm''s owner is told it is not found');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.pipeline('quote1'), 'sent_to_carrier', 'neither moved it');

  -- The quote.
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.advisor_update_quote_request(trinet, 'quoted', '2026-11-14', '2026-12-14', '2027-04-01', 145.50, NULL);
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.pipeline('quote1'), 'quoted', 'a quote at Sent to PEOs moves the submission to Quoted');
  PERFORM pg_temp.is(public.opportunity_stage(o), 'quoted', 'so the opportunity is Quoted');
  PERFORM pg_temp.is(pg_temp.caused('quote1'), 'ready_for_market>sent_to_carrier:quote_send:TriNet:acme_owner sent_to_carrier>quoted:quote_recorded:TriNet:acme_agent', 'the quote''s move (after the send''s) is caused by the quote, by the person who recorded it');
  PERFORM pg_temp.is((SELECT w.updated_by FROM public.submission_workflow w WHERE w.session_id = i), pg_temp.id('acme_agent'), 'the pipeline row says who moved it');

  -- Another quote, at Quoted: nothing more.
  n := (SELECT count(*) FROM public.submission_status_history WHERE session_id = i);
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM public.advisor_update_quote_request(trinet, 'quoted', '2026-11-15', '2026-12-15', '2027-04-01', 140, 'Revised');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*) FROM public.submission_status_history WHERE session_id = i), n, 'a quote at Quoted writes no move');

  -- Put back by a person to send to another PEO: that move has no cause; the next quote moves it to Quoted again.
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM public.set_submission_status(i, 'sent_to_carrier', 'to send to Paychex');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT h.cause FROM public.submission_status_history h WHERE h.session_id = i AND h.to_status = 'sent_to_carrier' AND h.note = 'to send to Paychex'), NULL::text,
    'a person''s own move has no cause');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM public.advisor_record_quote_send(i, 'Paychex', NULL);
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.pipeline('quote1'), 'sent_to_carrier', 'a send at Sent to PEOs after a quote moves nothing');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM public.advisor_update_quote_request(pg_temp.qid('quote1', 'Paychex'), 'quoted', '2026-11-16', '2026-12-16', '2027-04-01', 150, NULL);
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.pipeline('quote1'), 'quoted', 'the next quote moves it to Quoted again (the rule is the stage, not the first)');
  PERFORM pg_temp.is(pg_temp.caused('quote1'),
    'ready_for_market>sent_to_carrier:quote_send:TriNet:acme_owner sent_to_carrier>quoted:quote_recorded:TriNet:acme_agent sent_to_carrier>quoted:quote_recorded:Paychex:acme_owner', 'each quote''s move is caused by its own quote');

  -- A quote recorded at other stages moves nothing.
  PERFORM pg_temp.fmove('quote1', 'ready_for_market');
  n := (SELECT count(*) FROM public.submission_status_history WHERE session_id = i);
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM public.advisor_update_quote_request(justworks, 'closed');
  PERFORM public.advisor_update_quote_request(pg_temp.qid('quote1', 'Paychex'), 'quoted', '2026-11-17', '2026-12-17', '2027-04-01', 151, NULL);
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.pipeline('quote1'), 'ready_for_market', 'a quote recorded at Ready for market moves nothing (not even to Sent to PEOs)');
  PERFORM pg_temp.is((SELECT count(*) FROM public.submission_status_history WHERE session_id = i), n, 'and writes no row');
  PERFORM pg_temp.fmove('quote1', 'under_review');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM public.advisor_update_quote_request(pg_temp.qid('quote1', 'Paychex'), 'quoted', '2026-11-18', '2026-12-18', '2027-04-01', 152, NULL);
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.pipeline('quote1'), 'under_review', 'nor at Under review');
  RAISE NOTICE 'opportunity_stage: a quote moves the stage passed';
END $$;

-- ---------- The cause columns (D-412) ----------
-- Break caught: any word can be written as a cause; a quote request is named with no cause; the columns are readable or writable by an API role beyond
-- what the table allowed; history rows stop being append-only; the history of a person's move gains a cause.
DO $$
DECLARE i uuid;
BEGIN
  i := pg_temp.id('send1');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.submission_status_history (session_id, from_status, to_status, cause) VALUES (%L, 'a', 'b', 'because')$q$, i)), '23514', 'a cause is quote_send or quote_recorded');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.submission_status_history (session_id, from_status, to_status, cause_quote_request_id) VALUES (%L, 'a', 'b', 1)$q$, i)), '23514', 'a quote request with no cause is refused');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.submission_status_history (session_id, from_status, to_status, cause) VALUES (%L, 'a', 'b', 'quote_send')$q$, i)), 'rows:1', 'a cause with no quote request is allowed (the request may be gone with the intake)');
  PERFORM pg_temp.is(pg_temp.attempt($q$UPDATE public.submission_status_history SET cause = 'quote_send'$q$), '42501', 'the history is still append-only');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.attempt($q$INSERT INTO public.submission_status_history (session_id, from_status, to_status, cause) VALUES (gen_random_uuid(), 'a', 'b', 'quote_send')$q$), '42501', 'a member cannot write it');
  PERFORM pg_temp.is((SELECT count(*) FROM public.submission_status_history WHERE session_id = i AND cause IS NOT NULL) > 0, true, 'a member reads the cause with the move');
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  PERFORM pg_temp.is((SELECT count(*) FROM public.submission_status_history WHERE session_id = i), 0::bigint, 'another firm''s owner reads none of it');
  PERFORM pg_temp.as_owner();
  RAISE NOTICE 'opportunity_stage: the cause passed';
END $$;

-- ---------- The opportunity's history reads its submission's stage changes (D-413) ----------
-- A status-history row at a time of the test's choosing (clock_timestamp() when none is given, so a row written now sorts after an earlier one).
CREATE FUNCTION pg_temp.hist(intake text, from_s text, to_s text, who text DEFAULT NULL, p_cause text DEFAULT NULL, p_req bigint DEFAULT NULL, p_at timestamptz DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE r bigint;
BEGIN
  INSERT INTO public.submission_status_history (session_id, from_status, to_status, changed_by, changed_by_email, cause, cause_quote_request_id, changed_at)
  VALUES (pg_temp.id(intake), from_s, to_s, pg_temp.id(who), who || '@example.test', p_cause, p_req, COALESCE(p_at, clock_timestamp())) RETURNING id INTO r;
  RETURN r;
END $$;

-- What the opportunity's history says, newest first, one text per entry: kind, field, from>to, who, cause and PEO.
CREATE FUNCTION pg_temp.shown(o text, p_limit integer DEFAULT 100) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(string_agg(h.kind || ':' || COALESCE(h.field, '-') || ':'
      || CASE WHEN h.kind = 'stage_changed' THEN (h.from_value #>> '{}') || '>' || (h.to_value #>> '{}') ELSE '' END
      || ':' || h.who || ':' || COALESCE(h.cause, '-') || ':' || COALESCE(h.cause_peo, '-'), ' | ' ORDER BY h.at DESC, h.entry_key DESC), '')
  FROM public.record_history_list(pg_temp.id('acme'), 'opportunities', pg_temp.id(o)::text, p_limit) h
$$;

-- Break caught: a move that changes the stage is missing from the opportunity's history, or one inside a stage (submitted to under review, needs action,
-- a stage to itself) or the row that starts a submission is shown as a change; the cause, the PEO or the person is missing or shown as an id; the
-- entries of another opportunity's submission are shown; archived from won is shown as a change to Lost (D-216), or reopening it as a move from Lost;
-- the stage entries are copied into record_history (D-130); the entries of the record's own fields stop being returned with them, in time order.
DO $$
DECLARE i uuid; o uuid; req bigint; before_rows bigint;
BEGIN
  PERFORM pg_temp.account('a3', 'acme', 'acme_owner');
  i := pg_temp.intake('h1', 'acme');
  o := pg_temp.opportunity('oh1', 'a3', 'acme_owner', 'h1');
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_on) VALUES (i, 'TriNet', 'sent', '2026-11-10') RETURNING id INTO req;
  before_rows := (SELECT count(*) FROM public.record_history WHERE table_name = 'opportunities' AND record_key = o::text);

  PERFORM pg_temp.hist('h1', NULL, 'draft');                                           -- the row that starts a submission: not a move
  PERFORM pg_temp.hist('h1', 'draft', 'submitted', 'acme_agent');                      -- inside Intake under way
  PERFORM pg_temp.hist('h1', 'submitted', 'under_review', 'acme_agent');               -- inside Intake under way
  PERFORM pg_temp.hist('h1', 'under_review', 'under_review', 'acme_agent');            -- "needs action": a stage to itself
  PERFORM pg_temp.hist('h1', 'under_review', 'ready_for_market', 'acme_agent');        -- a change
  UPDATE public.opportunities SET next_step = 'Call Dana' WHERE id = o;                -- one of the record's own fields, between two stage changes
  PERFORM pg_temp.hist('h1', 'ready_for_market', 'sent_to_carrier', 'acme_owner', 'quote_send', req);
  PERFORM pg_temp.hist('h1', 'sent_to_carrier', 'quoted', 'acme_agent', 'quote_recorded', req);
  PERFORM pg_temp.hist('h1', 'quoted', 'sent_to_carrier', 'acme_owner');               -- put back by a person: no cause
  PERFORM pg_temp.hist('h1', 'sent_to_carrier', 'information_requested', 'acme_owner');-- back to Intake under way
  PERFORM pg_temp.hist('h1', 'information_requested', 'under_review');                 -- inside, and by the system
  PERFORM pg_temp.hist('h1', 'under_review', 'archived', 'acme_owner');                -- archived from another stage: Lost
  PERFORM pg_temp.hist('h1', 'archived', 'archived', 'acme_owner');                    -- needs action on an archived one
  PERFORM pg_temp.hist('h1', 'archived', 'submitted', 'acme_owner');                   -- reopened: from Lost

  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.shown('oh1'),
    'stage_changed:stage:lost>intake_under_way:acme_owner@example.test:-:- | '
    || 'stage_changed:stage:intake_under_way>lost:acme_owner@example.test:-:- | '
    || 'stage_changed:stage:in_market>intake_under_way:acme_owner@example.test:-:- | '
    || 'stage_changed:stage:quoted>in_market:acme_owner@example.test:-:- | '
    || 'stage_changed:stage:in_market>quoted:acme_agent@example.test:quote_recorded:TriNet | '
    || 'stage_changed:stage:ready_to_send>in_market:acme_owner@example.test:quote_send:TriNet | '
    || 'changed:next_step::System:-:- | '
    || 'stage_changed:stage:intake_under_way>ready_to_send:acme_agent@example.test:-:-'
    || ' | created:-::System:-:-',
    'the stage changes, each with who and its cause, among the record''s own entries, newest first; none inside a stage');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE table_name = 'opportunity_stage' OR field = 'stage'), 0::bigint, 'no stage entry is in record_history');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE table_name = 'opportunities' AND record_key = o::text), before_rows + 1, 'only the field change was written there (D-130)');
  RAISE NOTICE 'opportunity_stage: stage changes in the history passed';
END $$;

-- Break caught: a move from won to archived is shown as Won to Lost; reopening it as a move from Lost; a move out of Won to anything else is missed.
DO $$
DECLARE o uuid;
BEGIN
  PERFORM pg_temp.intake('h2', 'acme');
  o := pg_temp.opportunity('oh2', 'a3', 'acme_owner', 'h2');
  PERFORM pg_temp.hist('h2', 'quoted', 'won', 'acme_owner');
  PERFORM pg_temp.hist('h2', 'won', 'archived', 'acme_owner');
  PERFORM pg_temp.hist('h2', 'archived', 'archived', 'acme_owner');
  PERFORM pg_temp.hist('h2', 'archived', 'submitted', 'acme_owner');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.shown('oh2'),
    'stage_changed:stage:won>intake_under_way:acme_owner@example.test:-:- | stage_changed:stage:quoted>won:acme_owner@example.test:-:- | created:-::System:-:-',
    'archived from won is not a change (it stays Won), and reopening it is a move from Won');
  PERFORM pg_temp.as_owner();
  RAISE NOTICE 'opportunity_stage: archived from won passed';
END $$;

-- Break caught: the entries of another opportunity's submission, of an opportunity with no intake or of another record kind show stage changes; a lost
-- opportunity with no intake shows its own fields; the cause names a quote request of another submission; a gone quote request breaks the read.
DO $$
DECLARE other_req bigint;
BEGIN
  PERFORM pg_temp.opportunity('oh3', 'a3', 'acme_owner');
  UPDATE public.opportunities SET lost_at = clock_timestamp(), lost_by = pg_temp.id('acme_agent') WHERE id = pg_temp.id('oh3');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is((SELECT string_agg(h.kind || ':' || COALESCE(h.field, '-'), ' ' ORDER BY h.at DESC, h.entry_key DESC)
    FROM public.record_history_list(pg_temp.id('acme'), 'opportunities', pg_temp.id('oh3')::text) h), 'changed:lost_by changed:lost_at created:-',
    'with no intake there are only its own entries, and marking it lost is one of them');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history_list(pg_temp.id('acme'), 'accounts', pg_temp.id('a3')::text) h WHERE h.kind = 'stage_changed' OR h.cause IS NOT NULL OR h.cause_peo IS NOT NULL), 0::bigint,
    'an account''s history has no stage entries');
  PERFORM pg_temp.as_owner();
  -- A cause naming a quote request of another submission shows no PEO; a quote request that is gone shows none either.
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_on) VALUES (pg_temp.id('h2'), 'OtherPEO', 'sent', '2026-11-10') RETURNING id INTO other_req;
  PERFORM pg_temp.hist('h1', 'quoted', 'sent_to_carrier', 'acme_owner', 'quote_recorded', other_req);
  PERFORM pg_temp.hist('h1', 'sent_to_carrier', 'quoted', 'acme_owner', 'quote_recorded', 999999999);
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is((SELECT string_agg(COALESCE(h.cause_peo, '-'), ',' ORDER BY h.at DESC, h.entry_key DESC) FROM public.record_history_list(pg_temp.id('acme'), 'opportunities', pg_temp.id('oh1')::text, 2) h),
    '-,-', 'a quote request of another submission, or one that is gone, names no PEO');
  PERFORM pg_temp.as_owner();
  RAISE NOTICE 'opportunity_stage: boundaries passed';
END $$;

-- Break caught: the stage entries break the cursor contract: a page repeats or skips an entry that shares a time, the key is not stable between calls, or
-- is not the one worked out from the status row's id; the two kinds of entry are not ordered together.
DO $$
DECLARE o uuid; same timestamptz := '2027-01-05 12:00:00+00'; ids bigint[]; page record; seen uuid[] := '{}'; total integer; last_at timestamptz; last_key uuid; n integer; pages integer := 0;
BEGIN
  PERFORM pg_temp.intake('h4', 'acme');
  o := pg_temp.opportunity('oh4', 'a3', 'acme_owner', 'h4');
  -- Five moves at one instant (one transaction wrote them), then two later ones.
  ids := ARRAY[pg_temp.hist('h4', 'draft', 'ready_for_market', 'acme_owner', p_at => same), pg_temp.hist('h4', 'ready_for_market', 'sent_to_carrier', 'acme_owner', p_at => same),
               pg_temp.hist('h4', 'sent_to_carrier', 'quoted', 'acme_owner', p_at => same), pg_temp.hist('h4', 'quoted', 'sent_to_carrier', 'acme_owner', p_at => same),
               pg_temp.hist('h4', 'sent_to_carrier', 'information_requested', 'acme_owner', p_at => same),
               pg_temp.hist('h4', 'information_requested', 'ready_for_market', 'acme_owner', p_at => same + interval '1 day'),
               pg_temp.hist('h4', 'ready_for_market', 'sent_to_carrier', 'acme_owner', p_at => same + interval '2 days')];
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  total := (SELECT count(*) FROM public.record_history_list(pg_temp.id('acme'), 'opportunities', o::text, 100));
  PERFORM pg_temp.is(total, 8, 'seven stage changes and the creation');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history_list(pg_temp.id('acme'), 'opportunities', o::text, 100) h WHERE h.entry_key = md5('submission_status_history:' || ids[2])::uuid), 1::bigint,
    'a stage entry''s key is worked out from its status row''s id');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history_list(pg_temp.id('acme'), 'opportunities', o::text, 100) h
    WHERE h.kind = 'stage_changed' AND h.entry_key = ANY (SELECT md5('submission_status_history:' || x)::uuid FROM unnest(ids) x)), 7::bigint, 'every stage entry''s key is the one worked out from its row''s id');
  PERFORM pg_temp.is((SELECT bool_and(a.at >= b.at) FROM (SELECT h.at, row_number() OVER (ORDER BY h.at DESC, h.entry_key DESC) rn FROM public.record_history_list(pg_temp.id('acme'), 'opportunities', o::text, 100) h) a
    JOIN (SELECT h.at, row_number() OVER (ORDER BY h.at DESC, h.entry_key DESC) rn FROM public.record_history_list(pg_temp.id('acme'), 'opportunities', o::text, 100) h) b ON b.rn = a.rn + 1), true, 'newest first');
  -- Walk it a page of three at a time: every entry once, none skipped, though five share a time.
  last_at := NULL; last_key := NULL;
  LOOP
    n := 0;
    FOR page IN SELECT * FROM public.record_history_list(pg_temp.id('acme'), 'opportunities', o::text, 3, last_at, last_key) LOOP
      PERFORM pg_temp.is(page.entry_key = ANY (seen), false, 'a page repeated an entry');
      seen := seen || page.entry_key;
      last_at := page.at; last_key := page.entry_key; n := n + 1;
    END LOOP;
    pages := pages + 1;
    EXIT WHEN n < 3;
  END LOOP;
  PERFORM pg_temp.is(cardinality(seen), total, 'paging by a cursor of three reads every entry once');
  PERFORM pg_temp.is(pages, 3, 'in three pages');
  -- A cursor on the tied time, taken from a one-entry page, still continues without a skip.
  last_at := NULL; last_key := NULL; seen := '{}';
  LOOP
    n := 0;
    FOR page IN SELECT * FROM public.record_history_list(pg_temp.id('acme'), 'opportunities', o::text, 1, last_at, last_key) LOOP
      seen := seen || page.entry_key; last_at := page.at; last_key := page.entry_key; n := n + 1;
    END LOOP;
    EXIT WHEN n = 0;
  END LOOP;
  PERFORM pg_temp.is(cardinality(seen), total, 'one entry at a time reads them all once, through the five that share a time');
  PERFORM pg_temp.as_owner();
  RAISE NOTICE 'opportunity_stage: the cursor passed';
END $$;

-- Break caught: the stage entries leak across people, firms or kinds: an agent who may not see the account reads its opportunity's stage changes, another
-- firm reads them under its own or the other's address, an API caller sees an id or an email column, a signed-out caller reads at all.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); o uuid := pg_temp.id('oh1'); cols text;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, 'opportunities', %L)$q$, acme, o::text)), 'PT404', 'an agent who may not see the account is refused, as for its fields');
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, 'opportunities', %L)$q$, acme, o::text)), 'PT404', 'another firm''s owner is refused');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, 'opportunities', %L)$q$, pg_temp.id('zenith'), o::text)), 'PT404', 'and finds nothing under their own firm');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, 'opportunities', %L)$q$, acme, o::text)), '42501', 'a signed-out caller is refused');
  PERFORM pg_temp.as_owner();
  SELECT string_agg(a, ',' ORDER BY a) INTO cols FROM (SELECT unnest(p.proargnames[(p.pronargs + 1):]) a FROM pg_proc p WHERE p.oid = 'public.record_history_list(uuid,text,text,integer,timestamptz,uuid)'::regprocedure) x;
  PERFORM pg_temp.is(cols, 'at,cause,cause_peo,change_id,entry_key,field,from_value,kind,merged_from,to_value,who,who_kind', 'the columns are the history''s, with the cause and its PEO and the merged-away record it came from, and no actor id or email');
  RAISE NOTICE 'opportunity_stage: reading it passed';
END $$;

-- ---------- The rules the writers had still hold ----------
-- Break caught: a closing firm (ADR 0023) or a support session (ADR 0024) can record a send or a quote, so the stage moves in a firm that is read-only;
-- a refusal leaves a half-made record or move; the move is made by the support person; the writers fall open to the API roles' defaults.
DO $$
DECLARE zr uuid; req bigint; r text; i uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Closing Co', 'closing-co', now()) RETURNING id INTO zr;
  INSERT INTO fx VALUES ('closing', zr);
  PERFORM pg_temp.new_user('closing_owner');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (zr, pg_temp.id('closing_owner'), 'owner');
  i := pg_temp.intake('c1', 'closing');
  PERFORM pg_temp.account('ca', 'closing', 'closing_owner'); PERFORM pg_temp.opportunity('o_c1', 'ca', 'closing_owner', 'c1');
  PERFORM pg_temp.fmove('c1', 'submitted'); PERFORM pg_temp.fmove('c1', 'under_review'); PERFORM pg_temp.fmove('c1', 'ready_for_market');
  -- Before it closes: a quote request exists at Sent to PEOs, so a quote can be tried while closing.
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_on) VALUES (i, 'TriNet', 'sent', '2026-11-10') RETURNING id INTO req;
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (zr, pg_temp.id('closing_owner'), now() + interval '30 days');
  PERFORM pg_temp.as_user('closing_owner', 'closing-co');
  r := pg_temp.refusal(format($q$SELECT public.advisor_record_quote_send(%L, 'TriNet', NULL)$q$, i));
  PERFORM pg_temp.is(r, 'PT423: This firm is closing and can''t be changed', 'a send in a closing firm is refused');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.fmove('c1', 'sent_to_carrier');
  PERFORM pg_temp.as_user('closing_owner', 'closing-co');
  r := pg_temp.refusal(format($q$SELECT public.advisor_update_quote_request(%s, 'quoted', '2026-11-14', '2026-12-14', '2027-04-01', 100, NULL)$q$, req));
  PERFORM pg_temp.is(r, 'PT423: This firm is closing and can''t be changed', 'a quote in a closing firm is refused');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.pipeline('c1'), 'sent_to_carrier', 'and the stage did not move');
  PERFORM pg_temp.is((SELECT count(*) FROM public.submission_status_history WHERE session_id = i AND cause IS NOT NULL), 0::bigint, 'nor was a caused move written');
  PERFORM pg_temp.is((SELECT status FROM public.quote_requests WHERE id = req), 'sent', 'nor the quote');

  -- A support session: the platform admin at the firm's address looks, and changes nothing.
  PERFORM pg_temp.new_user('support_admin');
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('support_admin'), 'admin');
  PERFORM pg_temp.fmove('send1', 'ready_for_market');
  INSERT INTO public.support_sessions (firm_id, admin_id, admin_email, reason, started_at, ends_at)
  VALUES (pg_temp.id('acme'), pg_temp.id('support_admin'), 'support_admin@example.test', 'Looking at a stuck quote', now(), now() + interval '1 hour');
  PERFORM pg_temp.as_user('support_admin', 'acme-brokers');
  r := pg_temp.refusal(format($q$SELECT public.advisor_record_quote_send(%L, 'Gusto', NULL)$q$, pg_temp.id('send1')));
  PERFORM pg_temp.is(r, 'PT423: Nevermore support can look, not change', 'a send in a support session is refused');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.pipeline('send1'), 'ready_for_market', 'and nothing moved');
  DELETE FROM public.support_sessions WHERE firm_id = pg_temp.id('acme');
  RAISE NOTICE 'opportunity_stage: closing and support passed';
END $$;

-- Break caught: the move function, the opportunity's trigger function or the stage functions are open to an API role.
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.submission_move_for_cause(pg_temp.id('send1'), 'ready_for_market', 'sent_to_carrier', 'quote_send', NULL)$q$), '42501', 'a member may not move a submission by cause');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.opportunity_stage(%L)$q$, pg_temp.id('o_send1'))), '42501', 'nor ask the stage by id (D-416)');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.opportunities SET lost_at = now() WHERE id = %L$q$, pg_temp.id('o_lost'))), '42501', 'nor mark an opportunity lost on the table');
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.submission_move_for_cause(gen_random_uuid(), 'a', 'b', 'quote_send', NULL)$q$), '42501', 'nor the service role');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.advisor_record_quote_send(gen_random_uuid(), 'TriNet', NULL)$q$), '42501', 'a signed-out caller cannot record a send');
  PERFORM pg_temp.as_owner();
  RAISE NOTICE 'opportunity_stage: grants passed';
END $$;

-- ---------- Who made a move is decided when it is made (D-33, review of #179) ----------
-- Break caught: whether a stage change was made by Nevermore staff is worked out from today's roles and memberships each time the history is read, so a
-- member who later becomes an admin and leaves the firm turns their old moves into "Nevermore"; a new status row is written without its stamp.
DO $$
DECLARE o uuid := pg_temp.id('o_quote1'); kinds text;
BEGIN
  PERFORM pg_temp.is((SELECT bool_and(h.actor_is_staff IS NOT NULL) FROM public.submission_status_history h), true, 'every status row has its staff stamp');
  -- acme_agent recorded quote1's quote as a member. Later they become an admin and their membership ends.
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('acme_agent'), 'admin') ON CONFLICT DO NOTHING;
  UPDATE public.firm_memberships SET valid_until = now()
  WHERE user_id = pg_temp.id('acme_agent') AND firm_id = (SELECT firm_id FROM public.opportunities WHERE id = o) AND valid_until IS NULL;
  PERFORM pg_temp.is(public.firm_actor_is_staff(pg_temp.id('acme_agent'), (SELECT firm_id FROM public.opportunities WHERE id = o)), true,
    'today acme_agent would count as staff');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  SELECT string_agg(l.who_kind, ',' ORDER BY l.at) INTO kinds
  FROM public.record_history_list((SELECT firm_id FROM public.opportunities WHERE id = o), 'opportunities', o::text, 100) l
  WHERE l.kind = 'stage_changed' AND l.cause = 'quote_recorded';
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(kinds, 'member,member', 'both quotes'' moves are still the member''s, as it was when it was made');
  RAISE NOTICE 'opportunity_stage: who made a move is kept passed';
END $$;

-- ---------- Recording a quote takes the locks in the same order as a won, lost or archived move (review of #179) ----------
-- Break caught: advisor_update_quote_request locks the quote request before the submission's pipeline row while set_submission_status locks the
-- pipeline row and then closes the quote requests, so the two at once on one submission deadlock (each holds one row and waits for the other).
-- Shown with two sessions: while the second holds the pipeline row, the first's quote waits before it takes the quote request, so the second can still
-- take the quote request within two seconds.
CREATE SCHEMA race;
CREATE EXTENSION dblink SCHEMA race;
-- The submission and its sent quote request, committed first, so the two other sessions below can see them.
DO $$
DECLARE i uuid;
BEGIN
  i := pg_temp.ready('lock1', 'acme');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM public.advisor_record_quote_send(i, 'Insperity', NULL);
  PERFORM pg_temp.as_owner();
END $$;
DO $$
DECLARE
  dsn text := format('dbname=%s user=%s port=%s host=%s', current_database(), session_user, current_setting('port'),
    split_part(current_setting('unix_socket_directories'), ',', 1));
  i uuid := pg_temp.id('lock1'); q bigint := pg_temp.qid('lock1', 'Insperity'); a_pid integer; b_pid integer; tries integer := 0; got text;
BEGIN
  PERFORM race.dblink_connect('qa', dsn);
  PERFORM race.dblink_connect('qb', dsn);
  SELECT pid INTO a_pid FROM race.dblink('qa', 'SELECT pg_backend_pid()') AS t(pid integer);
  SELECT pid INTO b_pid FROM race.dblink('qb', 'SELECT pg_backend_pid()') AS t(pid integer);
  -- The second holds the pipeline row, as set_submission_status does before it closes the quote requests.
  PERFORM race.dblink_exec('qb', 'BEGIN');
  PERFORM race.dblink_exec('qb', format('DO $do$ BEGIN PERFORM 1 FROM public.submission_workflow WHERE session_id = %L FOR UPDATE; END $do$', i));
  -- The first records a quote as a member.
  PERFORM race.dblink_exec('qa', 'BEGIN');
  PERFORM race.dblink_exec('qa', 'SET LOCAL ROLE authenticated');
  PERFORM race.dblink_exec('qa', format('SET LOCAL request.jwt.claims = %L', jsonb_build_object('sub', pg_temp.id('acme_owner'), 'role', 'authenticated',
    'is_anonymous', false, 'email', 'acme_owner@example.test')::text));
  PERFORM race.dblink_exec('qa', format('SET LOCAL request.headers = %L', jsonb_build_object('x-firm-address', 'acme-brokers')::text));
  PERFORM race.dblink_send_query('qa', format($q$SELECT public.advisor_update_quote_request(%s, 'quoted', '2026-11-15', '2026-12-15', '2027-04-01', 120, NULL)::text$q$, q));
  WHILE tries < 100 AND NOT (b_pid = ANY (pg_blocking_pids(a_pid))) LOOP
    tries := tries + 1;
    PERFORM pg_sleep(0.05);
  END LOOP;
  PERFORM pg_temp.is(b_pid = ANY (pg_blocking_pids(a_pid)), true, 'the quote waits on the pipeline row');
  -- While the quote waits, the second can still take the quote request: the quote has not taken it first.
  BEGIN
    PERFORM race.dblink_exec('qb', format('SET LOCAL lock_timeout = %L; DO $do$ BEGIN PERFORM 1 FROM public.quote_requests WHERE id = %s FOR UPDATE; END $do$', '2s', q));
    got := 'ok';
  EXCEPTION WHEN OTHERS THEN
    got := SQLSTATE;
  END;
  PERFORM race.dblink_exec('qb', 'ROLLBACK');
  PERFORM * FROM race.dblink_get_result('qa') AS t(r text);
  PERFORM * FROM race.dblink_get_result('qa') AS t(r text);
  PERFORM race.dblink_exec('qa', 'COMMIT');
  PERFORM race.dblink_disconnect('qa');
  PERFORM race.dblink_disconnect('qb');
  PERFORM pg_temp.is(got, 'ok', 'the quote request was free while the quote waited: the locks are taken pipeline row first');
  PERFORM pg_temp.is(pg_temp.pipeline('lock1'), 'quoted', 'and the quote then went through and moved the submission');
  RAISE NOTICE 'opportunity_stage: lock order passed';
END $$;
