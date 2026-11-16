-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh firm_link
-- A firm's link (slice 5.2, P-2.1; docs/BROKER_CRM_BUILD.md D-1704, D-1713, D-101, D-121, D-1740..D-1749;
-- 20261123110000_firm_link.sql). An intake a prospect starts at a firm's address (the request header x-firm-address, which the
-- browser sets from the host it is at) belongs to that firm: the database resolves the address, and the browser never sends a firm id.
-- An intake started with no address stays with the default firm. An address that names no firm, a refused, suspended, closing or
-- closed firm starts nothing. The firm of an intake can't be changed afterwards by the browser's roles.
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
\i supabase/migrations/20261123090000_opportunity_close_withdraw.sql
\i supabase/migrations/20261123110000_firm_link.sql
SET client_min_messages = notice;

CREATE FUNCTION pg_temp.is(got anyelement, want anyelement, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION 'FAIL: % gave %, expected %', label, got, want; END IF;
END $$;

CREATE TEMP TABLE fx (name text PRIMARY KEY, id uuid NOT NULL);
GRANT SELECT ON fx TO anon, authenticated, service_role;
CREATE FUNCTION pg_temp.id(n text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM fx WHERE name = n $$;

CREATE FUNCTION pg_temp.new_user(n text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', n || '@example.test', false, now(), now());
  INSERT INTO fx VALUES (n, uid);
  RETURN uid;
END $$;

-- The request as PostgREST hands it to the database: the caller's token and, at a firm's address, the x-firm-address header.
CREATE FUNCTION pg_temp.as_prospect(n text, address text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', false, 'email', n || '@example.test')::text, false);
  PERFORM set_config('request.headers', CASE WHEN address IS NULL THEN '{"accept":"application/json"}'
    ELSE jsonb_build_object('accept', 'application/json', 'x-firm-address', address)::text END, false);
  PERFORM set_config('role', 'authenticated', false);
END $$;

CREATE FUNCTION pg_temp.as_owner() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', false);
  PERFORM set_config('request.headers', '', false);
END $$;

-- A new intake as the prospect's browser writes it (no firm in it), after the intake consent. Returns its id.
CREATE FUNCTION pg_temp.start_intake(n text, address text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE sid uuid;
BEGIN
  PERFORM pg_temp.as_prospect(n, address);
  PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (pg_temp.id(n), '{"company_name":"Link Co"}') RETURNING id INTO sid;
  PERFORM pg_temp.as_owner();
  RETURN sid;
END $$;

-- The SQLSTATE a new intake at an address fails with, or 'ok'; always rolled back.
CREATE FUNCTION pg_temp.start_state(n text, address text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE s text;
BEGIN
  BEGIN
    PERFORM pg_temp.start_intake(n, address);
    RAISE EXCEPTION USING ERRCODE = 'ZZ999';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE;
    PERFORM pg_temp.as_owner();
    RETURN CASE WHEN s = 'ZZ999' THEN 'ok' ELSE s END;
  END;
END $$;

DO $$
DECLARE n text;
BEGIN
  FOREACH n IN ARRAY ARRAY['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11', 'p12'] LOOP PERFORM pg_temp.new_user(n); END LOOP;
  INSERT INTO fx VALUES ('alpha', gen_random_uuid()), ('bravo', gen_random_uuid());
  INSERT INTO public.firms (id, name, address, approved_at, visibility) VALUES
    (pg_temp.id('alpha'), 'Alpha Advisory', 'alpha-advisory', now(), 'everyone'),
    (pg_temp.id('bravo'), 'Bravo Brokers', 'bravo-brokers', now(), 'everyone');
END $$;

-- 1. An intake started at a firm's address belongs to that firm.
-- Break caught: keep_intake_firm still forces every intake into the default firm.
DO $$
DECLARE sid uuid := pg_temp.start_intake('p1', 'alpha-advisory');
BEGIN
  PERFORM pg_temp.is((SELECT firm_id FROM public.chamber_sessions WHERE id = sid), pg_temp.id('alpha'), 'an intake started at Alpha''s address is Alpha''s');
END $$;

-- 2. An intake started with no firm address stays with the default firm (D-121). So does one at the default firm's own address.
-- Break caught: the default is lost when an address is looked for (a bare-domain intake lands in no firm or the wrong one).
DO $$
DECLARE
  bare uuid := pg_temp.start_intake('p2');
  own uuid := pg_temp.start_intake('p3', 'edgar-allan-advisory');
BEGIN
  PERFORM pg_temp.is((SELECT firm_id FROM public.chamber_sessions WHERE id = bare), public.default_firm_id(), 'an intake started with no address is the default firm''s');
  PERFORM pg_temp.is((SELECT firm_id FROM public.chamber_sessions WHERE id = own), public.default_firm_id(), 'and so is one at the default firm''s own address');
END $$;

-- 3. An address no firm holds starts nothing: the intake is never filed in the default firm or in no firm instead.
-- Break caught: an unresolved address falls through to the default firm (or to a null firm), so a typo'd link files a stranger's answers somewhere.
SELECT pg_temp.is(pg_temp.start_state('p4', 'no-such-firm'), 'PT404', 'an address no firm holds starts no intake');
SELECT pg_temp.is(pg_temp.start_state('p4', '%'), 'PT404', 'a wildcard is no address');

-- 4. A refused firm's link starts nothing (D-31: a refused firm's address is no firm's), while a firm still waiting for approval takes intakes
-- (its members work before approval; approval gates sending, not receiving).
-- Break caught: the decision isn't looked at, so a refused firm collects intakes nobody may read.
DO $$
BEGIN
  INSERT INTO fx VALUES ('refused', gen_random_uuid()), ('waiting', gen_random_uuid());
  INSERT INTO public.firms (id, name, address, visibility, decision, decided_at) VALUES
    (pg_temp.id('refused'), 'Refused Brokers', 'refused-brokers', 'everyone', 'refused', now());
  INSERT INTO public.firms (id, name, address, visibility) VALUES (pg_temp.id('waiting'), 'Waiting Brokers', 'waiting-brokers', 'everyone');
END $$;
SELECT pg_temp.is(pg_temp.start_state('p4', 'refused-brokers'), 'PT404', 'a refused firm''s link starts no intake');
DO $$
DECLARE sid uuid := pg_temp.start_intake('p5', 'waiting-brokers');
BEGIN
  PERFORM pg_temp.is((SELECT firm_id FROM public.chamber_sessions WHERE id = sid), pg_temp.id('waiting'), 'a firm waiting for approval takes intakes at its address');
END $$;

-- 5. A suspended firm's link starts nothing until the suspension is lifted (D-1741).
-- Break caught: suspension isn't looked at, so Nevermore suspends a firm and its link keeps collecting employers' answers.
DO $$
BEGIN
  INSERT INTO fx VALUES ('suspended', gen_random_uuid());
  INSERT INTO public.firms (id, name, address, approved_at, visibility) VALUES (pg_temp.id('suspended'), 'Suspended Brokers', 'suspended-brokers', now(), 'everyone');
  INSERT INTO public.firm_suspensions (firm_id, reason) VALUES (pg_temp.id('suspended'), 'Looking into a complaint');
END $$;
SELECT pg_temp.is(pg_temp.start_state('p4', 'suspended-brokers'), 'PT404', 'a suspended firm''s link starts no intake');
UPDATE public.firm_suspensions SET lifted_at = now() WHERE firm_id = pg_temp.id('suspended');
SELECT pg_temp.is(pg_temp.start_state('p4', 'suspended-brokers'), 'ok', 'and starts one again once the suspension is lifted');
UPDATE public.firm_suspensions SET lifted_at = NULL WHERE firm_id = pg_temp.id('suspended');

-- 6. A firm that has asked to close takes no new intakes from its link, from the day it asks (it is read-only, ADR 0023), and takes them again if
-- it withdraws the request (D-1741).
-- Break caught: a closing firm's link keeps starting intakes into a firm that is about to delete everything it holds.
DO $$
BEGIN
  INSERT INTO fx VALUES ('closing', gen_random_uuid());
  INSERT INTO public.firms (id, name, address, approved_at, visibility) VALUES (pg_temp.id('closing'), 'Closing Brokers', 'closing-brokers', now(), 'everyone');
  INSERT INTO public.firm_closures (firm_id, asked_at, closes_at) VALUES (pg_temp.id('closing'), now() - interval '1 day', now() + interval '29 days');
END $$;
SELECT pg_temp.is(pg_temp.start_state('p4', 'closing-brokers'), 'PT404', 'a closing firm''s link starts no intake');
UPDATE public.firm_closures SET withdrawn_at = now() WHERE firm_id = pg_temp.id('closing');
SELECT pg_temp.is(pg_temp.start_state('p4', 'closing-brokers'), 'ok', 'and starts one again when the closing is withdrawn');

-- 7. A closed firm's link starts nothing either.
-- Break caught: only "closing" is asked, and a firm that has closed (its data deleted) takes new intakes.
DO $$
BEGIN
  INSERT INTO fx VALUES ('closed', gen_random_uuid());
  INSERT INTO public.firms (id, name, address, approved_at, visibility) VALUES (pg_temp.id('closed'), 'Closed Brokers', 'closed-brokers', now(), 'everyone');
  INSERT INTO public.firm_closures (firm_id, asked_at, closes_at, closed_at, address, deleted_counts)
  VALUES (pg_temp.id('closed'), now() - interval '40 days', now() - interval '10 days', now() - interval '10 days', 'closed-brokers', '{}'::jsonb);
END $$;
SELECT pg_temp.is(pg_temp.start_state('p4', 'closed-brokers'), 'PT404', 'a closed firm''s link starts no intake');

-- 8. The browser's word never chooses the firm: a firm id sent with the intake is ignored (the address decides), and an intake can't be moved to
-- another firm afterwards, by an update of its firm or by starting it again at another address.
-- Break caught: the firm id in the insert, or in an update, is believed.
DO $$
DECLARE sid uuid;
BEGIN
  PERFORM pg_temp.as_prospect('p6', 'alpha-advisory');
  PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');
  INSERT INTO public.chamber_sessions (user_id, chamber_data, firm_id) VALUES (pg_temp.id('p6'), '{}', pg_temp.id('bravo')) RETURNING id INTO sid;
  PERFORM pg_temp.is((SELECT firm_id FROM public.chamber_sessions WHERE id = sid), pg_temp.id('alpha'), 'a firm id sent with the intake is ignored: the address decides');
  UPDATE public.chamber_sessions SET firm_id = pg_temp.id('bravo') WHERE id = sid;
  PERFORM pg_temp.is((SELECT firm_id FROM public.chamber_sessions WHERE id = sid), pg_temp.id('alpha'), 'the firm of an intake can''t be changed by the browser');
  PERFORM pg_temp.as_prospect('p6', 'bravo-brokers');
  UPDATE public.chamber_sessions SET firm_id = pg_temp.id('bravo') WHERE id = sid;
  PERFORM pg_temp.is((SELECT firm_id FROM public.chamber_sessions WHERE id = sid), pg_temp.id('alpha'), 'nor by writing it at another firm''s address');
  PERFORM pg_temp.as_owner();
END $$;

-- 9. A visitor can ask, before agreeing to anything, whether a firm's link takes intakes: a yes or no for an address, and nothing else about the firm.
-- Break caught: the answer isn't the trigger's (a page offers "Get a quote" for a link that then refuses), or it says why or whose.
SELECT pg_temp.as_prospect('p7');
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.is(public.firm_takes_intakes('alpha-advisory'), true, 'a signed-out visitor is told a firm''s link takes intakes');
SELECT pg_temp.is(public.firm_takes_intakes(' Alpha-Advisory '), true, 'whatever the capitals or spaces');
SELECT pg_temp.is(public.firm_takes_intakes('waiting-brokers'), true, 'a firm waiting for approval takes them');
SELECT pg_temp.is(public.firm_takes_intakes('no-such-firm'), false, 'an address no firm holds takes none');
SELECT pg_temp.is(public.firm_takes_intakes('refused-brokers'), false, 'nor a refused firm''s');
SELECT pg_temp.is(public.firm_takes_intakes('suspended-brokers'), false, 'nor a suspended firm''s');
SELECT pg_temp.is(public.firm_takes_intakes('closing-brokers'), true, 'a firm that withdrew its closing does');
SELECT pg_temp.is(public.firm_takes_intakes('closed-brokers'), false, 'nor a closed firm''s');
SELECT pg_temp.is(public.firm_takes_intakes(NULL), false, 'no address takes none');
SELECT pg_temp.is(public.firm_takes_intakes('%'), false, 'a wildcard matches nothing');
RESET ROLE;

-- 10. A referral partner's link works at every firm, and a code is matched to a partner only within the intake's own firm (D-101): two firms
-- may hold the same code for different partners, and a code only another firm holds names no partner in this one.
-- Break caught: the funnel matches a code to any firm's partner, so one firm's report names another firm's partner.
DO $$
DECLARE n text;
BEGIN
  PERFORM pg_temp.new_user('adv');
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('adv'), 'advisor');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (pg_temp.id('alpha'), pg_temp.id('adv'), 'owner');
  INSERT INTO public.referral_partners (firm_id, code, name, kind) VALUES
    (pg_temp.id('alpha'), 'cfo', 'Alpha CFO Partners', 'accounting'),
    (pg_temp.id('bravo'), 'cfo', 'Bravo CFO Partners', 'accounting'),
    (pg_temp.id('bravo'), 'bravo-only', 'Bravo Only Partners', 'accounting');
  FOREACH n IN ARRAY ARRAY['p8', 'p9'] LOOP
    PERFORM pg_temp.as_prospect(n, 'alpha-advisory');
    PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');
    INSERT INTO public.chamber_sessions (user_id, chamber_data, referral_code)
    VALUES (pg_temp.id(n), '{}', CASE n WHEN 'p8' THEN 'cfo' ELSE 'bravo-only' END);
  END LOOP;
  PERFORM pg_temp.as_owner();
END $$;
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.id('adv'), 'role', 'authenticated', 'is_anonymous', false, 'email', 'adv@example.test',
  'aal', 'aal1', 'amr', jsonb_build_array(jsonb_build_object('method', 'oauth', 'timestamp', 1)))::text, false);
SELECT set_config('request.headers', '{"x-firm-address":"alpha-advisory"}', false);
SET ROLE authenticated;
SELECT pg_temp.is((SELECT partner_name FROM public.advisor_intake_sources(now() - interval '1 day', now() + interval '1 day', pg_temp.id('alpha')) WHERE referral_code = 'cfo'),
  'Alpha CFO Partners', 'a code at Alpha''s link names Alpha''s partner, not Bravo''s with the same code');
SELECT pg_temp.is((SELECT count(*) FROM public.advisor_intake_sources(now() - interval '1 day', now() + interval '1 day', pg_temp.id('alpha')) WHERE referral_code = 'bravo-only' AND partner_name IS NULL),
  1::bigint, 'a code only Bravo holds names no partner at Alpha');
RESET ROLE;

-- 11. The chain at certification (D-226) is made in the intake's own firm: an intake started at Alpha's link, then certified by the employer, puts the
-- account, contact and opportunity in Alpha, and none in the default firm.
-- Break caught: the chain reads the default firm (or the certifier's address) instead of the intake's firm.
DO $$
DECLARE sid uuid;
BEGIN
  UPDATE auth.users SET email_confirmed_at = now() WHERE id = pg_temp.id('p10');
  sid := pg_temp.start_intake('p10', 'alpha-advisory');
  UPDATE public.chamber_sessions SET chamber_data = jsonb_build_object('company_name', 'Linked Dental Partners', 'hq_state', 'TX', 'states', jsonb_build_array('TX'),
    'employee_count', 12, 'pay_frequency', 'bi-weekly', 'industry', 'Dental practice', 'street_address', '500 Harbor Street, Austin, TX 78701',
    'start_month', 'March 2027', 'in_peo', false) WHERE id = sid;
  INSERT INTO fx VALUES ('i_link', sid);
  PERFORM pg_temp.as_prospect('p10', 'alpha-advisory');
  UPDATE public.chamber_sessions SET status = 'submitted', submission = jsonb_build_object(
    'signer_name', 'Jo Doe', 'signer_title', 'CEO', 'signed_at', '2026-11-01T12:00:00Z', 'consent_version', '2026-10-draft-1',
    'consent_text', '["I certify."]'::jsonb, 'chamber_data', chamber_data) WHERE id = sid;
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT o.firm_id FROM public.opportunities o WHERE o.intake_id = sid), pg_temp.id('alpha'), 'the opportunity of a certified link intake is Alpha''s');
  PERFORM pg_temp.is((SELECT a.firm_id FROM public.accounts a JOIN public.opportunities o ON o.account_id = a.id WHERE o.intake_id = sid), pg_temp.id('alpha'), 'and so is its account');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE firm_id = public.default_firm_id() AND intake_id = sid), 0::bigint, 'and the default firm holds none of it');
END $$;
