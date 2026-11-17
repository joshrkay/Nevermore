-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh broker_intake
-- A broker starts an intake for a client (slice 5.3, P-2.2, P-2.4; docs/BROKER_CRM_BUILD.md D-1703, D-1710, D-1711, D-1750..D-1759;
-- 20261123120000_broker_intake.sql). The intake is in the broker's firm and on the opportunity (ADR 0025) with no employer user until an invitee
-- accepts; what the broker enters carries its own source; the invite is a one-use link, valid 14 days, and Remind replaces it; only the employer certifies.
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
\i supabase/migrations/20261123120000_broker_intake.sql
\i supabase/migrations/20261123120100_broker_intake_columns.sql
\i supabase/migrations/20261123130000_new_quote_account.sql
\i supabase/migrations/20261123180000_quotes_table.sql
\i supabase/migrations/20261123190000_intake_teaches_account.sql
\i supabase/migrations/20261123200000_employer_ends_access.sql
\i supabase/migrations/20261124090000_firm_signup_emails.sql
\i supabase/migrations/20261124100000_new_quote_intake.sql
\i supabase/migrations/20261124110000_employer_sees_firm.sql
\i supabase/migrations/20261124130000_quote_decline_reason.sql
\i supabase/migrations/20261124140000_quote_offer.sql
\i supabase/migrations/20261124150000_opportunity_activity_intake.sql
\i supabase/migrations/20261124160000_firm_approval_gates_sending.sql
\i supabase/migrations/20261124170000_leads_can_convert.sql
\i supabase/migrations/20261125090000_quote_document.sql
\i supabase/migrations/20261125100000_reply_suggestions.sql
\i supabase/migrations/20261125110000_quote_comparison.sql
\i supabase/migrations/20261125120000_question_requests.sql
\i supabase/migrations/20261125130000_broker_save_whole_form.sql
\i supabase/migrations/20261125140000_opportunity_intake_started_by_firm.sql
\i supabase/migrations/20261125150000_firm_started_intakes_do_not_expire.sql
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

-- Signs in as a person (the request as PostgREST hands it over), at a firm's address when one is named.
CREATE FUNCTION pg_temp.as_user(n text, addr text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', false, 'email', n || '@example.test')::text, false);
  PERFORM set_config('request.headers', CASE WHEN addr IS NULL THEN '' ELSE jsonb_build_object('x-firm-address', addr)::text END, false);
  PERFORM set_config('role', 'authenticated', false);
END $$;

CREATE FUNCTION pg_temp.as_anon(addr text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', false);
  PERFORM set_config('request.headers', CASE WHEN addr IS NULL THEN '' ELSE jsonb_build_object('x-firm-address', addr)::text END, false);
  PERFORM set_config('role', 'anon', false);
END $$;

CREATE FUNCTION pg_temp.as_owner() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', false);
  PERFORM set_config('request.headers', '', false);
  PERFORM set_config('role', 'none', false);
END $$;

CREATE FUNCTION pg_temp.is(got anyelement, want anyelement, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION 'FAIL: % gave %, expected %', label, got, want; END IF;
END $$;

-- The SQLSTATE a statement raises as a person, or 'ok'. Nothing is rolled back.
CREATE FUNCTION pg_temp.state_as(who text, addr text, stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE s text;
BEGIN
  PERFORM pg_temp.as_user(who, addr);
  BEGIN
    EXECUTE stmt;
    PERFORM pg_temp.as_owner();
    RETURN 'ok';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE;
    PERFORM pg_temp.as_owner();
    RETURN s;
  END;
END $$;

-- set up: two firms; Alpha has an owner and two agents, Bravo an owner; an account and an open opportunity (no intake) at each.
DO $$
DECLARE n text;
BEGIN
  FOREACH n IN ARRAY ARRAY['a_owner', 'a_agent', 'a_agent2', 'b_owner', 'outsider', 'client', 'client2'] LOOP PERFORM pg_temp.new_user(n); END LOOP;
  INSERT INTO fx VALUES ('alpha', gen_random_uuid()), ('bravo', gen_random_uuid());
  INSERT INTO public.firms (id, name, address, approved_at, visibility) VALUES
    (pg_temp.id('alpha'), 'Alpha Advisory', 'alpha-advisory', now(), 'everyone'),
    (pg_temp.id('bravo'), 'Bravo Brokers', 'bravo-brokers', now(), 'everyone');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES
    (pg_temp.id('alpha'), pg_temp.id('a_owner'), 'owner'), (pg_temp.id('alpha'), pg_temp.id('a_agent'), 'agent'), (pg_temp.id('alpha'), pg_temp.id('a_agent2'), 'agent'),
    (pg_temp.id('bravo'), pg_temp.id('b_owner'), 'owner');
END $$;

-- An account and an open opportunity (no intake) of a firm, made as the superuser, owned by the named person.
CREATE FUNCTION pg_temp.opp(n text, firm text, owner text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE a uuid; o uuid;
BEGIN
  INSERT INTO public.accounts (source, firm_id, owner_id, name) VALUES ('added_by_hand', pg_temp.id(firm), pg_temp.id(owner), n || ' Co') RETURNING id INTO a;
  INSERT INTO public.opportunities (firm_id, account_id, owner_id, name) VALUES (pg_temp.id(firm), a, pg_temp.id(owner), n || ' PEO search') RETURNING id INTO o;
  INSERT INTO fx VALUES (n, o);
  RETURN o;
END $$;
SELECT pg_temp.opp('opp1', 'alpha', 'a_agent');
SELECT pg_temp.opp('opp_b', 'bravo', 'b_owner');

-- 1. A broker starts an intake on an opportunity of their firm: it is in the broker's firm, has no employer user (D-1703), records who started it, and is linked to the
-- opportunity in the same step (ADR 0025), so the chain rule holds from the start.
-- Break caught: the intake is filed in the default firm, is given the broker as its owner, or is left unlinked from the opportunity.
SELECT pg_temp.as_user('a_agent', 'alpha-advisory');
SELECT public.start_broker_intake(pg_temp.id('opp1')) ->> 'intake_id' AS made \gset
SELECT pg_temp.as_owner();
SELECT pg_temp.is((SELECT firm_id FROM public.chamber_sessions WHERE id = :'made'::uuid), pg_temp.id('alpha'), 'the intake is in the broker''s firm');
SELECT pg_temp.is((SELECT user_id FROM public.chamber_sessions WHERE id = :'made'::uuid), NULL::uuid, 'it has no employer user');
SELECT pg_temp.is((SELECT started_by FROM public.chamber_sessions WHERE id = :'made'::uuid), pg_temp.id('a_agent'), 'it records the member who started it');
SELECT pg_temp.is((SELECT intake_id FROM public.opportunities WHERE id = pg_temp.id('opp1')), :'made'::uuid, 'the opportunity holds the intake from the start');
INSERT INTO fx VALUES ('intake1', :'made'::uuid);

-- 2. An opportunity of another firm, or one that does not exist, is not available: one answer for both (PT404), and no intake is left behind.
-- Break caught: the opportunity is looked up by id alone, so a broker starts (or probes for) another firm's opportunity.
SELECT pg_temp.is(pg_temp.state_as('a_agent', 'alpha-advisory', format('SELECT public.start_broker_intake(%L)', pg_temp.id('opp_b'))), 'PT404', 'another firm''s opportunity is not available');
SELECT pg_temp.is(pg_temp.state_as('a_agent', 'alpha-advisory', format('SELECT public.start_broker_intake(%L)', gen_random_uuid())), 'PT404', 'nor is one that does not exist');
SELECT pg_temp.is((SELECT count(*) FROM public.chamber_sessions WHERE started_by IS NOT NULL), 1::bigint, 'no intake was left behind by a refusal');

-- 3. A broker who may not see the opportunity's account can't start its intake (the firm's visibility rule, D-422): the same refusal as one that is not there.
-- Break caught: visibility is not asked, so any agent of a by-level firm starts intakes on colleagues' accounts.
SELECT pg_temp.opp('opp2', 'alpha', 'a_agent');
UPDATE public.firms SET visibility = 'by_level' WHERE id = pg_temp.id('alpha');
SELECT pg_temp.is(pg_temp.state_as('a_agent2', 'alpha-advisory', format('SELECT public.start_broker_intake(%L)', pg_temp.id('opp2'))), 'PT404', 'an agent who may not see the account is told it is not available');
SELECT pg_temp.is(pg_temp.state_as('a_owner', 'alpha-advisory', format('SELECT public.start_broker_intake(%L)', pg_temp.id('opp2'))), 'ok', 'the firm''s owner may start it');
UPDATE public.firms SET visibility = 'everyone' WHERE id = pg_temp.id('alpha');
UPDATE public.opportunities SET intake_id = NULL WHERE id = pg_temp.id('opp2');
DELETE FROM public.chamber_sessions WHERE started_by = pg_temp.id('a_owner');

-- 4. An opportunity holds one intake: starting a second is refused (PT409), and the first is untouched.
-- Break caught: a second start replaces the opportunity's intake (the first one, and what was typed into it, is orphaned).
SELECT pg_temp.is(pg_temp.state_as('a_agent', 'alpha-advisory', format('SELECT public.start_broker_intake(%L)', pg_temp.id('opp1'))), 'PT409', 'a second start on the same opportunity is refused');
SELECT pg_temp.is((SELECT intake_id FROM public.opportunities WHERE id = pg_temp.id('opp1')), pg_temp.id('intake1'), 'the first intake is still the opportunity''s');

-- 5. An archived account takes no new intake (55000), as it takes no new opportunity (D-222).
-- Break caught: archiving an account doesn't stop a broker starting work on it.
SELECT pg_temp.opp('opp3', 'alpha', 'a_agent');
UPDATE public.accounts SET archived_at = now() WHERE id = (SELECT account_id FROM public.opportunities WHERE id = pg_temp.id('opp3'));
SELECT pg_temp.is(pg_temp.state_as('a_agent', 'alpha-advisory', format('SELECT public.start_broker_intake(%L)', pg_temp.id('opp3'))), '55000', 'an archived account takes no intake');

-- 6. A closing firm is read-only (ADR 0023): its members start no intake, and a Nevermore support session can look, not change (ADR 0024).
-- Break caught: the start writes without asking the one guard every firm write asks.
SELECT pg_temp.opp('opp4', 'bravo', 'b_owner');
INSERT INTO public.firm_closures (firm_id, asked_at, closes_at) VALUES (pg_temp.id('bravo'), now() - interval '1 day', now() + interval '29 days');
SELECT pg_temp.is(pg_temp.state_as('b_owner', 'bravo-brokers', format('SELECT public.start_broker_intake(%L)', pg_temp.id('opp4'))), 'PT423', 'a closing firm starts no intake');
DELETE FROM public.firm_closures WHERE firm_id = pg_temp.id('bravo');

-- 7. The browser never sets who started an intake, nor takes a firm member's start for its own: a direct insert (not through the function) names no starter, and an update
-- can't change one.
-- Break caught: started_by is whatever the browser sends, so anyone can pose as a firm's member on an intake, or forge the firm of an intake that skips the link.
SELECT pg_temp.as_user('client', 'alpha-advisory');
SELECT public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');
INSERT INTO public.chamber_sessions (user_id, chamber_data, started_by) VALUES (pg_temp.id('client'), '{}', pg_temp.id('a_owner'));
SELECT pg_temp.as_owner();
SELECT pg_temp.is((SELECT started_by FROM public.chamber_sessions WHERE user_id = pg_temp.id('client')), NULL::uuid, 'a browser insert names no starter');
SELECT pg_temp.as_user('client', 'alpha-advisory');
UPDATE public.chamber_sessions SET started_by = pg_temp.id('a_owner') WHERE user_id = pg_temp.id('client');
SELECT pg_temp.as_owner();
SELECT pg_temp.is((SELECT started_by FROM public.chamber_sessions WHERE user_id = pg_temp.id('client')), NULL::uuid, 'and an update can''t set one');
UPDATE public.chamber_sessions SET status = 'archived' WHERE user_id = pg_temp.id('client');

-- 8. The chamber's own save by a member of the firm, as the founder directed (D-1751), is the broker's way to enter answers: no function writes them. (The helper pg_temp.chamber_save is defined
-- with the tests of the chamber below; the first save is test 50.)
-- The intake1 state the next tests build on: a broker's name and states entered the way the chamber saves them.
CREATE FUNCTION pg_temp.chamber_save(who text, intake uuid, answers jsonb, source jsonb DEFAULT '{"kind": "prospect_edit"}', st text DEFAULT 'confirmed') RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint; s text;
BEGIN
  PERFORM pg_temp.as_user(who, 'alpha-advisory');
  BEGIN
    UPDATE public.chamber_sessions SET chamber_data = chamber_data || answers,
      field_provenance = field_provenance || (SELECT jsonb_object_agg(k, jsonb_build_object('status', st, 'source', source, 'updated_at', '2026-11-20T10:00:00.000Z')) FROM jsonb_object_keys(answers) k)
    WHERE id = intake;
    GET DIAGNOSTICS n = ROW_COUNT;
    PERFORM pg_temp.as_owner();
    RETURN 'rows:' || n;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE;
    PERFORM pg_temp.as_owner();
    RETURN s;
  END;
END $$;
SELECT pg_temp.is(pg_temp.chamber_save('a_agent', pg_temp.id('intake1'), '{"company_name": "Acme Robotics", "states": ["TX", "CA"]}'), 'rows:1', 'a member''s save of intake1 goes through');

-- 9. Only a member of the intake's own firm saves it: another firm's member, a stranger and an intake that is not there change nothing (row security shows them no such row).
-- Break caught: the policy lets anyone who can name an intake write into it.
SELECT pg_temp.is(pg_temp.chamber_save('b_owner', pg_temp.id('intake1'), '{"industry": "Bakery"}'), 'rows:0', 'another firm''s member changes nothing');
SELECT pg_temp.is(pg_temp.chamber_save('outsider', pg_temp.id('intake1'), '{"industry": "Bakery"}'), 'rows:0', 'nor does a stranger');
SELECT pg_temp.is(pg_temp.chamber_save('a_agent', gen_random_uuid(), '{"industry": "Bakery"}'), 'rows:0', 'nor does anyone on an intake that is not there');
SELECT pg_temp.is((SELECT chamber_data ->> 'industry' FROM public.chamber_sessions WHERE id = pg_temp.id('intake1')), NULL, 'nothing was written');

-- 10. An intake an employer started is theirs: a member of the firm saves nothing into it.
-- Break caught: the member's policy reads an employer's own draft as one to fill in.
DO $$
DECLARE sid uuid;
BEGIN
  PERFORM pg_temp.as_user('client2', 'alpha-advisory');
  PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (pg_temp.id('client2'), '{"company_name":"Own Co"}') RETURNING id INTO sid;
  PERFORM pg_temp.as_owner();
  INSERT INTO fx VALUES ('employer_intake', sid);
END $$;
SELECT pg_temp.is(pg_temp.chamber_save('a_agent', pg_temp.id('employer_intake'), '{"industry": "Bakery"}'), 'rows:0', 'an employer''s own intake takes no broker save');

-- 11. The FEIN is typed into the workspace by the employer only (ADR 0006; CRM-Q2.2 "type on any tab but FEIN"): a broker's save that changes it is refused (42501), and nothing in the same save is kept.
-- Break caught: a broker types the FEIN, which then travels in an answer the employer never saw typed.
SELECT pg_temp.is(pg_temp.chamber_save('a_agent', pg_temp.id('intake1'), '{"fein": "123456789", "industry": "Bakery"}'), '42501', 'the FEIN is refused');
SELECT pg_temp.is((SELECT chamber_data ->> 'industry' FROM public.chamber_sessions WHERE id = pg_temp.id('intake1')), NULL, 'and the rest of that save was not kept');

-- 12. A broker never overwrites what the employer answered (D-1710: an answer the employer changes becomes theirs): a field holding the employer's own typed answer, one they closed as
-- "Doesn't apply", and one holding an answer from anyone but a broker keep what they held; a broker's own earlier entry is replaced by a newer one.
-- Break caught: a late broker save replaces what the employer typed.
UPDATE public.chamber_sessions SET
  chamber_data = chamber_data || '{"pay_frequency": "Weekly", "hris_system": "Gusto"}',
  field_provenance = field_provenance || jsonb_build_object(
    'pay_frequency', jsonb_build_object('status', 'confirmed', 'source', jsonb_build_object('kind', 'prospect_edit'), 'updated_at', '2026-11-20T10:00:00Z'),
    'hris_system', jsonb_build_object('status', 'inferred', 'source', jsonb_build_object('kind', 'transcript', 'message_id', 'm1'), 'updated_at', '2026-11-20T10:00:00Z'),
    'has_401k', jsonb_build_object('status', 'not_applicable', 'source', jsonb_build_object('kind', 'prospect_edit'), 'updated_at', '2026-11-20T10:00:00Z'))
WHERE id = pg_temp.id('intake1');
SELECT pg_temp.is(pg_temp.chamber_save('a_agent', pg_temp.id('intake1'), '{"pay_frequency": "Monthly", "hris_system": "ADP", "has_401k": true, "key_challenges": "Growth", "company_name": "Acme Robotics Inc"}'), 'rows:1', 'the member''s save goes through');
SELECT pg_temp.is((SELECT chamber_data ->> 'pay_frequency' FROM public.chamber_sessions WHERE id = pg_temp.id('intake1')), 'Weekly', 'the employer''s typed answer stands');
SELECT pg_temp.is((SELECT chamber_data ->> 'hris_system' FROM public.chamber_sessions WHERE id = pg_temp.id('intake1')), 'Gusto', 'so does one the employer gave Lenore');
SELECT pg_temp.is((SELECT chamber_data -> 'has_401k' FROM public.chamber_sessions WHERE id = pg_temp.id('intake1')), NULL::jsonb, 'and a field the employer closed stays closed');
SELECT pg_temp.is((SELECT chamber_data ->> 'company_name' FROM public.chamber_sessions WHERE id = pg_temp.id('intake1')), 'Acme Robotics Inc', 'a broker''s own earlier entry is replaced');
SELECT pg_temp.is((SELECT chamber_data ->> 'key_challenges' FROM public.chamber_sessions WHERE id = pg_temp.id('intake1')), 'Growth', 'and a new answer is kept');

-- 13. Only an intake still being worked takes a broker's save: one that is archived, expired or revoked (and, below, one that has been certified) changes nothing.
-- Break caught: an answer is written into a closed intake, so a certified record changes under the employer's signature.
UPDATE public.chamber_sessions SET status = 'archived' WHERE id = pg_temp.id('intake1');
SELECT pg_temp.is(pg_temp.chamber_save('a_agent', pg_temp.id('intake1'), '{"industry": "Bakery"}'), 'rows:0', 'an archived intake takes no save');
UPDATE public.chamber_sessions SET status = 'in_progress' WHERE id = pg_temp.id('intake1');

-- 14. A closing firm's members save nothing (ADR 0023), whoever started the intake.
-- Break caught: the save is kept without the guard every firm write asks.
INSERT INTO public.firm_closures (firm_id, asked_at, closes_at) VALUES (pg_temp.id('alpha'), now() - interval '1 day', now() + interval '29 days');
SELECT pg_temp.is(pg_temp.chamber_save('a_agent', pg_temp.id('intake1'), '{"industry": "Bakery"}'), 'PT423', 'a closing firm takes no save');
DELETE FROM public.firm_closures WHERE firm_id = pg_temp.id('alpha');

-- 15. A member's save changes the answers and the conversation, nothing else: the employer (user_id) and the PEO choice stay as they were.
-- Break caught: a broker hands the intake to someone else, or picks the PEO for the employer, through the same update.
SELECT pg_temp.as_user('a_agent', 'alpha-advisory');
UPDATE public.chamber_sessions SET user_id = pg_temp.id('client'), chosen_peo = 'Probe PEO' WHERE id = pg_temp.id('intake1');
SELECT pg_temp.as_owner();
SELECT pg_temp.is((SELECT user_id FROM public.chamber_sessions WHERE id = pg_temp.id('intake1')), NULL::uuid, 'the employer can''t be set by the member');
SELECT pg_temp.is((SELECT chosen_peo FROM public.chamber_sessions WHERE id = pg_temp.id('intake1')), NULL, 'nor the PEO');

-- 16. What the chamber writes from a message is kept with its message and words (P-2.4): an answer saved with a transcript source keeps that message and quote in the broker-entry source, so
-- "Your broker told Lenore ..." has something behind it; a quote the readers would drop is cut or left out, so the entry stays one both read.
-- Break caught: the message and the words are thrown away, or a long quote makes the entry unreadable.
SELECT pg_temp.is(pg_temp.chamber_save('a_agent', pg_temp.id('intake1'), '{"industry": "Bakery"}', jsonb_build_object('kind', 'transcript', 'message_id', 'm9', 'quote', repeat('x', 150))), 'rows:1', 'the member''s save goes through');
SELECT pg_temp.is((SELECT field_provenance -> 'industry' -> 'source' ->> 'message_id' FROM public.chamber_sessions WHERE id = pg_temp.id('intake1')), 'm9', 'the message is kept');
SELECT pg_temp.is((SELECT char_length(field_provenance -> 'industry' -> 'source' ->> 'quote') FROM public.chamber_sessions WHERE id = pg_temp.id('intake1')), 150, 'and the words');
SELECT pg_temp.is((SELECT public.provenance_entry_status(field_provenance -> 'industry') FROM public.chamber_sessions WHERE id = pg_temp.id('intake1')), 'inferred', 'the entry is one the readers keep');

-- 17. The database reads a broker entry as a valid source, so the required items count it as unconfirmed, never as the employer's settled answer (D-1710).
-- Break caught: provenance_source_is_valid drops the unknown kind, and an item the broker typed reads as one with no provenance at all, which is the employer's own.
SELECT pg_temp.is((SELECT e ->> 'state' FROM public.chamber_sessions s, jsonb_array_elements(public.intake_required_items(s.chamber_data, s.field_provenance, '{}')) e WHERE s.id = pg_temp.id('intake1') AND e ->> 'item' = 'company_name'), 'unconfirmed', 'a company name a broker entered is unconfirmed');
SELECT pg_temp.is((SELECT e ->> 'state' FROM public.chamber_sessions s, jsonb_array_elements(public.intake_required_items(s.chamber_data, s.field_provenance, '{}')) e WHERE s.id = pg_temp.id('intake1') AND e ->> 'item' = 'pay_frequency'), 'settled', 'and one the employer typed is settled');

-- 18. A broker invites the client to finish and certify (D-1711): the invitation is for an email address, valid 14 days from now, records when it was made, and is kept only as the
-- hash of its token. The call answers what the email needs (the firm's name and address, the client's name), never the hash.
-- Break caught: the link lasts another time, the invitation isn't tied to the intake, or the token itself is stored.
SELECT pg_temp.as_user('a_agent', 'alpha-advisory');
SELECT * FROM public.invite_intake_client(pg_temp.id('intake1'), ' Lucia@Client.Test ', 'Lucia Perez', repeat('a', 64)) \gset inv_
SELECT pg_temp.as_owner();
SELECT pg_temp.is(:'inv_email'::text, 'lucia@client.test', 'the address is kept as the sign-in compares it');
SELECT pg_temp.is(:'inv_firm_name'::text, 'Alpha Advisory', 'the answer names the firm for the email');
SELECT pg_temp.is(:'inv_firm_address'::text, 'alpha-advisory', 'and its address, where the link points');
SELECT pg_temp.is(:'inv_contact_name'::text, 'Lucia Perez', 'and who it is for');
SELECT pg_temp.is((SELECT expires_at - created_at FROM public.intake_invitations WHERE id = :'inv_invitation_id'::uuid), interval '14 days', 'the link lasts 14 days');
SELECT pg_temp.is((SELECT intake_id FROM public.intake_invitations WHERE id = :'inv_invitation_id'::uuid), pg_temp.id('intake1'), 'it is the intake''s');
SELECT pg_temp.is((SELECT invited_by FROM public.intake_invitations WHERE id = :'inv_invitation_id'::uuid), pg_temp.id('a_agent'), 'it records who invited');
SELECT pg_temp.is((SELECT token_hash FROM public.intake_invitations WHERE id = :'inv_invitation_id'::uuid), repeat('a', 64), 'only the hash is kept');

-- 19. Only a member of the intake's firm invites, and only for a broker-started intake: another firm's member, a stranger, an intake that is not there and an employer's own intake all get
-- the same answer (PT404).
-- Break caught: the intake is found by id alone, so anyone who can name one sends an invitation in a firm's name.
SELECT pg_temp.is(pg_temp.state_as('b_owner', 'bravo-brokers', format('SELECT * FROM public.invite_intake_client(%L, %L, NULL, %L)', pg_temp.id('intake1'), 'x@client.test', repeat('b', 64))), 'PT404', 'another firm''s member can''t invite');
SELECT pg_temp.is(pg_temp.state_as('outsider', NULL, format('SELECT * FROM public.invite_intake_client(%L, %L, NULL, %L)', pg_temp.id('intake1'), 'x@client.test', repeat('b', 64))), 'PT404', 'nor can a stranger');
SELECT pg_temp.is(pg_temp.state_as('a_agent', 'alpha-advisory', format('SELECT * FROM public.invite_intake_client(%L, %L, NULL, %L)', pg_temp.id('employer_intake'), 'x@client.test', repeat('b', 64))), 'PT404', 'nor an employer''s own intake can be invited about');

-- 20. An intake has one live invitation: inviting again while one is waiting is refused (PT409, "Remind instead"), and the waiting one is untouched.
-- Break caught: a second invitation is made beside the first, so two links open the same intake.
SELECT pg_temp.is(pg_temp.state_as('a_agent', 'alpha-advisory', format('SELECT * FROM public.invite_intake_client(%L, %L, NULL, %L)', pg_temp.id('intake1'), 'other@client.test', repeat('c', 64))), 'PT409', 'a second invitation is refused');
SELECT pg_temp.is((SELECT count(*) FROM public.intake_invitations WHERE intake_id = pg_temp.id('intake1') AND status = 'pending'), 1::bigint, 'one link is waiting');

-- 21. An address that could never be emailed is refused in words (22023) before anything is made, so it can't block the corrected one.
-- Break caught: the table's check refuses it with a bare constraint error (23514), or a bad address is kept as the waiting invitation.
SELECT pg_temp.opp('opp5', 'alpha', 'a_agent');
SELECT pg_temp.as_user('a_agent', 'alpha-advisory');
SELECT public.start_broker_intake(pg_temp.id('opp5')) ->> 'intake_id' AS made5 \gset
SELECT pg_temp.as_owner();
INSERT INTO fx VALUES ('intake5', :'made5'::uuid);
SELECT pg_temp.is(pg_temp.state_as('a_agent', 'alpha-advisory', format('SELECT * FROM public.invite_intake_client(%L, %L, NULL, %L)', pg_temp.id('intake5'), 'not an address', repeat('d', 64))), '22023', 'a malformed address is refused in words');

-- 22. A closing firm sends no invitation (ADR 0023).
-- Break caught: the invitation is made, and its email sent, from a firm that is read-only.
INSERT INTO public.firm_closures (firm_id, asked_at, closes_at) VALUES (pg_temp.id('alpha'), now() - interval '1 day', now() + interval '29 days');
SELECT pg_temp.is(pg_temp.state_as('a_agent', 'alpha-advisory', format('SELECT * FROM public.invite_intake_client(%L, %L, NULL, %L)', pg_temp.id('intake5'), 'z@client.test', repeat('d', 64))), 'PT423', 'a closing firm invites no one');
DELETE FROM public.firm_closures WHERE firm_id = pg_temp.id('alpha');

-- 23. A closed intake (archived, expired, revoked or certified) is not invited about (55000).
-- Break caught: an invitation is sent for an intake nobody can finish.
UPDATE public.chamber_sessions SET status = 'archived' WHERE id = pg_temp.id('intake5');
SELECT pg_temp.is(pg_temp.state_as('a_agent', 'alpha-advisory', format('SELECT * FROM public.invite_intake_client(%L, %L, NULL, %L)', pg_temp.id('intake5'), 'z@client.test', repeat('d', 64))), '55000', 'a closed intake is not invited about');
UPDATE public.chamber_sessions SET status = 'in_progress' WHERE id = pg_temp.id('intake5');

-- 24. An intake whose employer has accepted is the employer's: no new invitation is made for it (55000).
-- Break caught: the firm invites someone else into an intake that already belongs to an employer.
UPDATE public.chamber_sessions SET user_id = pg_temp.id('client') WHERE id = pg_temp.id('intake5');
SELECT pg_temp.is(pg_temp.state_as('a_agent', 'alpha-advisory', format('SELECT * FROM public.invite_intake_client(%L, %L, NULL, %L)', pg_temp.id('intake5'), 'z@client.test', repeat('d', 64))), '55000', 'an intake that has its employer is not invited about');
UPDATE public.chamber_sessions SET user_id = NULL WHERE id = pg_temp.id('intake5');

-- 25. Remind sends a fresh link and revokes the old one (D-1711): the old row is marked replaced, the new one is waiting for another 14 days, and the first invitation's time and the
-- count of sends carry over, so the broker's step shows when the client was first invited.
-- Break caught: Remind leaves the old link working, restarts "invited at", or forgets how many times the client was written to.
SELECT created_at AS first_at, id AS first_id FROM public.intake_invitations WHERE intake_id = pg_temp.id('intake1') AND status = 'pending' \gset
SELECT pg_temp.as_user('a_agent', 'alpha-advisory');
SELECT * FROM public.remind_intake_invite(pg_temp.id('intake1'), repeat('e', 64)) \gset rem_
SELECT pg_temp.as_owner();
SELECT pg_temp.is((SELECT status FROM public.intake_invitations WHERE id = :'first_id'::uuid), 'replaced', 'the old link is replaced');
SELECT pg_temp.is((SELECT status FROM public.intake_invitations WHERE id = :'rem_invitation_id'::uuid), 'pending', 'the new one is waiting');
SELECT pg_temp.is((SELECT count(*) FROM public.intake_invitations WHERE intake_id = pg_temp.id('intake1') AND status = 'pending'), 1::bigint, 'and is the only one');
SELECT pg_temp.is((SELECT invited_at FROM public.intake_invitations WHERE id = :'rem_invitation_id'::uuid), :'first_at'::timestamptz, 'the client was first invited when the first link was made');
SELECT pg_temp.is((SELECT send_count FROM public.intake_invitations WHERE id = :'rem_invitation_id'::uuid), 2, 'the new link is the second send');
SELECT pg_temp.is((SELECT email FROM public.intake_invitations WHERE id = :'rem_invitation_id'::uuid), 'lucia@client.test', 'it goes to the same address');
SELECT pg_temp.is(:'rem_firm_name'::text, 'Alpha Advisory', 'the answer names the firm for the email');

-- 26. Remind needs an invitation waiting: an intake never invited about, or whose client has already accepted, has nothing to remind (PT404), and nothing is made.
-- Break caught: Remind on an intake with no invitation fails with a null error, or makes a link out of nothing.
SELECT pg_temp.is(pg_temp.state_as('a_agent', 'alpha-advisory', format('SELECT * FROM public.remind_intake_invite(%L, %L)', pg_temp.id('intake5'), repeat('f', 64))), 'PT404', 'an intake never invited about has nothing to remind');
SELECT pg_temp.is((SELECT count(*) FROM public.intake_invitations WHERE intake_id = pg_temp.id('intake5')), 0::bigint, 'and no link was made');

-- 27. A closing firm sends no reminder (ADR 0023), and the waiting link is left as it was.
-- Break caught: Remind writes and mails from a read-only firm.
INSERT INTO public.firm_closures (firm_id, asked_at, closes_at) VALUES (pg_temp.id('alpha'), now() - interval '1 day', now() + interval '29 days');
SELECT pg_temp.is(pg_temp.state_as('a_agent', 'alpha-advisory', format('SELECT * FROM public.remind_intake_invite(%L, %L)', pg_temp.id('intake1'), repeat('9', 64))), 'PT423', 'a closing firm sends no reminder');
DELETE FROM public.firm_closures WHERE firm_id = pg_temp.id('alpha');
SELECT pg_temp.is((SELECT token_hash FROM public.intake_invitations WHERE intake_id = pg_temp.id('intake1') AND status = 'pending'), repeat('e', 64), 'the waiting link is untouched');

-- 28. Opening the link (D-1711): a signed-out visitor, at the firm's address, is told whose invitation it is (the firm's name and who it is for) and nothing else, and the opening is recorded
-- as "last opened" for the broker's step 3.
-- Break caught: the opening isn't recorded, or the page learns the invited email address.
SELECT pg_temp.is((SELECT last_opened_at FROM public.intake_invitations WHERE intake_id = pg_temp.id('intake1') AND status = 'pending'), NULL::timestamptz, 'not opened yet');
SELECT pg_temp.as_anon('alpha-advisory');
SELECT * FROM public.peek_intake_invite(repeat('e', 64), 'alpha-advisory') \gset peek_
SELECT pg_temp.as_owner();
SELECT pg_temp.is(:'peek_firm_name'::text, 'Alpha Advisory', 'the page can say which firm invited them');
SELECT pg_temp.is(:'peek_contact_name'::text, 'Lucia Perez', 'and who it is for');
SELECT pg_temp.is((SELECT last_opened_at IS NOT NULL FROM public.intake_invitations WHERE intake_id = pg_temp.id('intake1') AND status = 'pending'), true, 'the opening is recorded');

-- 29. A link that is no link is refused (PT404), and learns nothing: a hash nobody holds.
-- Break caught: a guess is told anything.
SELECT pg_temp.is(pg_temp.state_as('outsider', 'alpha-advisory', format('SELECT * FROM public.peek_intake_invite(%L, %L)', repeat('0', 64), 'alpha-advisory')), 'PT404', 'a hash nobody holds is not a link');

-- 29a. A link opened at another firm's address is refused (PT422), though the link is a real, waiting one.
-- Break caught: a link works at the wrong firm's address.
SELECT pg_temp.is(pg_temp.state_as('outsider', 'bravo-brokers', format('SELECT * FROM public.peek_intake_invite(%L, %L)', repeat('e', 64), 'bravo-brokers')), 'PT422', 'a link opened at another firm''s address is refused');

-- 29b. A link opened at another firm's address learns nothing of the link's state: a link Remind replaced is refused as PT422, not PT410.
-- Break caught: the address is checked after the link's state, so a guess at another firm's address learns that a link was replaced.
SELECT pg_temp.is(pg_temp.state_as('outsider', 'bravo-brokers', format('SELECT * FROM public.peek_intake_invite(%L, %L)', repeat('a', 64), 'bravo-brokers')), 'PT422', 'a replaced link opened at another firm''s address says nothing of its state');

-- 30. A link Remind replaced says so (PT410), and does not count as an opening of the invitation; an expired link says so too (PT410).
-- Break caught: the old link of a reminded invitation still opens (Remind revokes nothing), or its opening is counted.
SELECT last_opened_at AS before_old FROM public.intake_invitations WHERE intake_id = pg_temp.id('intake1') AND status = 'pending' \gset
SELECT pg_temp.is(pg_temp.state_as('outsider', 'alpha-advisory', format('SELECT * FROM public.peek_intake_invite(%L, %L)', repeat('a', 64), 'alpha-advisory')), 'PT410', 'the old link says it was replaced');
SELECT pg_temp.is((SELECT last_opened_at FROM public.intake_invitations WHERE intake_id = pg_temp.id('intake1') AND status = 'pending'), :'before_old'::timestamptz, 'and opening it is not an opening of the new one');
UPDATE public.intake_invitations SET expires_at = now() - interval '1 second', created_at = now() - interval '15 days' WHERE intake_id = pg_temp.id('intake1') AND status = 'pending';
SELECT pg_temp.is(pg_temp.state_as('outsider', 'alpha-advisory', format('SELECT * FROM public.peek_intake_invite(%L, %L)', repeat('e', 64), 'alpha-advisory')), 'PT410', 'an expired link says so');

-- 31. Accepting the invitation (D-1703, D-1711): the person signed in with the invited address opens the link and the intake becomes theirs: they are its user, the invitation is used, and
-- the intake is the firm's no longer to write as the owner. The answer says which intake and where it is.
-- Break caught: the intake is left without an employer (the person can't open it), or the link stays usable.
SELECT pg_temp.as_user('a_agent', 'alpha-advisory');
SELECT * FROM public.invite_intake_client(pg_temp.id('intake5'), 'client@example.test', 'Carla Client', repeat('5', 64)) \gset inv5_
SELECT pg_temp.chamber_save('a_agent', pg_temp.id('intake5'), '{"company_name": "Carla Co", "states": ["TX"], "pay_frequency": "Weekly"}');
SELECT pg_temp.as_user('client', 'alpha-advisory');
SELECT public.accept_intake_invite(repeat('5', 64), 'alpha-advisory') ->> 'intake_id' AS accepted5 \gset
SELECT pg_temp.as_owner();
SELECT pg_temp.is(:'accepted5'::uuid, pg_temp.id('intake5'), 'the answer names the intake');
SELECT pg_temp.is((SELECT user_id FROM public.chamber_sessions WHERE id = pg_temp.id('intake5')), pg_temp.id('client'), 'the intake is the person''s now');
SELECT pg_temp.is((SELECT status FROM public.intake_invitations WHERE id = :'inv5_invitation_id'::uuid), 'accepted', 'the invitation is used');
SELECT pg_temp.is((SELECT accepted_by FROM public.intake_invitations WHERE id = :'inv5_invitation_id'::uuid), pg_temp.id('client'), 'by them');

-- A broker-started intake of Alpha with a link waiting for an address: made as the member, named in fx, its token's hash a repeat of one character.
CREATE FUNCTION pg_temp.broker_invite(n text, email text, ch text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE sid uuid;
BEGIN
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.opp('o_' || n, 'alpha', 'a_agent');
  PERFORM pg_temp.as_user('a_agent', 'alpha-advisory');
  sid := (public.start_broker_intake(pg_temp.id('o_' || n)) ->> 'intake_id')::uuid;
  PERFORM public.invite_intake_client(sid, email, 'Pat ' || n, repeat(ch, 64));
  PERFORM pg_temp.as_owner();
  INSERT INTO fx VALUES (n, sid);
  RETURN sid;
END $$;

-- 32. The link is for the address it was sent to: someone signed in with another address is refused (PT403) and nothing changes: the intake stays the firm's and the link stays waiting.
-- Break caught: whoever holds the link, forwarded or leaked, takes the employer's place.
SELECT pg_temp.broker_invite('intake6', 'client2@example.test', '6');
SELECT pg_temp.is(pg_temp.state_as('client', 'alpha-advisory', format('SELECT public.accept_intake_invite(%L, %L)', repeat('6', 64), 'alpha-advisory')), 'PT403', 'another address can''t accept');
SELECT pg_temp.is((SELECT user_id FROM public.chamber_sessions WHERE id = pg_temp.id('intake6')), NULL::uuid, 'the intake is still the firm''s');
SELECT pg_temp.is((SELECT status FROM public.intake_invitations WHERE intake_id = pg_temp.id('intake6')), 'pending', 'and the link is still waiting');

-- 33. Accepting needs a person signed in with a verified email (42501), not a guest and not an address nobody has proved to be theirs.
-- Break caught: a sign-up with the invited address that was never verified takes the intake, so anyone can sign up as the invited address and claim it.
INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at) VALUES (gen_random_uuid(), 'authenticated', 'authenticated', 'unverified@example.test', false, now(), now());
INSERT INTO fx SELECT 'unverified', id FROM auth.users WHERE email = 'unverified@example.test';
SELECT pg_temp.broker_invite('intake7', 'unverified@example.test', '7');
SELECT pg_temp.is(pg_temp.state_as('unverified', 'alpha-advisory', format('SELECT public.accept_intake_invite(%L, %L)', repeat('7', 64), 'alpha-advisory')), '42501', 'an unverified address can''t accept');
SELECT pg_temp.is((SELECT user_id FROM public.chamber_sessions WHERE id = pg_temp.id('intake7')), NULL::uuid, 'the intake is still the firm''s');

-- 34. A hash nobody holds is not a link (PT404).
-- Break caught: a guess is told anything.
SELECT pg_temp.is(pg_temp.state_as('client2', 'alpha-advisory', format('SELECT public.accept_intake_invite(%L, %L)', repeat('0', 64), 'alpha-advisory')), 'PT404', 'a hash nobody holds is not a link');

-- 34a. A link accepted at another firm's address is refused (PT422).
-- Break caught: a link works at the wrong firm's address.
SELECT pg_temp.is(pg_temp.state_as('client2', 'bravo-brokers', format('SELECT public.accept_intake_invite(%L, %L)', repeat('6', 64), 'bravo-brokers')), 'PT422', 'a link accepted at another firm''s address is refused');

-- 34b. A link accepted at another firm's address learns nothing of the link's state: a link Remind replaced is refused as PT422, not PT410.
-- Break caught: the address is checked after the link's state, so a guess at another firm's address learns that a link was replaced.
SELECT pg_temp.is(pg_temp.state_as('client2', 'bravo-brokers', format('SELECT public.accept_intake_invite(%L, %L)', repeat('a', 64), 'bravo-brokers')), 'PT422', 'a replaced link accepted at another firm''s address says nothing of its state');

-- 35. A link works once, for 14 days, and only while it is the latest: a used link, a link Remind replaced and an expired link are each refused (PT410) and change nothing.
-- Break caught: a link opens the intake twice, a replaced link still works, or an old link never ends.
SELECT pg_temp.is(pg_temp.state_as('client', 'alpha-advisory', format('SELECT public.accept_intake_invite(%L, %L)', repeat('5', 64), 'alpha-advisory')), 'PT410', 'a used link is refused');
SELECT pg_temp.is(pg_temp.state_as('client', 'alpha-advisory', format('SELECT public.accept_intake_invite(%L, %L)', repeat('a', 64), 'alpha-advisory')), 'PT410', 'a replaced link is refused');
SELECT pg_temp.is(pg_temp.state_as('client', 'alpha-advisory', format('SELECT public.accept_intake_invite(%L, %L)', repeat('e', 64), 'alpha-advisory')), 'PT410', 'an expired link is refused');
SELECT pg_temp.is((SELECT user_id FROM public.chamber_sessions WHERE id = pg_temp.id('intake1')), NULL::uuid, 'and the intake behind them is still the firm''s');

-- 36. A member of the firm can't take the employer's place (D-1703): accepting as one of the firm's own people, even at an address they were sent a link for, is refused (PT403).
-- Break caught: a broker invites a colleague (or themselves) and accepts, so the firm owns the answers and certifies them.
SELECT pg_temp.broker_invite('intake8', 'a_agent2@example.test', '8');
SELECT pg_temp.is(pg_temp.state_as('a_agent2', 'alpha-advisory', format('SELECT public.accept_intake_invite(%L, %L)', repeat('8', 64), 'alpha-advisory')), 'PT403', 'a member of the firm can''t accept');
SELECT pg_temp.is((SELECT user_id FROM public.chamber_sessions WHERE id = pg_temp.id('intake8')), NULL::uuid, 'the intake stays without an employer');

-- 37. A person keeps one open intake (20261104102000): someone who already has one in progress is told so (PT409) rather than given a second, and the invitation stays waiting for when they've finished or archived it.
-- Break caught: accepting skips the one-open-draft rule, which only guards inserts, and the person ends up with two open intakes.
SELECT pg_temp.broker_invite('intake9', 'client2@example.test', '9');
SELECT pg_temp.is(pg_temp.state_as('client2', 'alpha-advisory', format('SELECT public.accept_intake_invite(%L, %L)', repeat('9', 64), 'alpha-advisory')), 'PT409', 'a person with an open intake is told so');
SELECT pg_temp.is((SELECT status FROM public.intake_invitations WHERE intake_id = pg_temp.id('intake9')), 'pending', 'and the link stays waiting');

-- 38. The broker's step 3 reads where the invitation stands (CRM-Q2.4): not invited, waiting (with when they were invited and last opened it), expired, or accepted; never the link or its hash.
-- Break caught: the step can't say when the client was invited or last opened the link, or reports a lapsed link as waiting.
SELECT pg_temp.as_user('a_agent', 'alpha-advisory');
SELECT public.intake_invite_status(pg_temp.id('intake6')) AS waiting \gset
SELECT public.intake_invite_status(pg_temp.id('intake1')) AS lapsed \gset
SELECT public.intake_invite_status(pg_temp.id('intake5')) AS used \gset
SELECT pg_temp.as_owner();
SELECT pg_temp.is(:'waiting'::jsonb ->> 'state', 'waiting', 'a link nobody has used is waiting');
SELECT pg_temp.is(:'waiting'::jsonb ->> 'email', 'client2@example.test', 'it says who it was sent to');
SELECT pg_temp.is(:'waiting'::jsonb ->> 'contact_name', 'Pat intake6', 'and who it is for');
SELECT pg_temp.is((:'waiting'::jsonb ->> 'invited_at')::timestamptz, (SELECT invited_at FROM public.intake_invitations WHERE intake_id = pg_temp.id('intake6')), 'and when they were invited');
SELECT pg_temp.is(:'waiting'::jsonb -> 'last_opened_at', 'null'::jsonb, 'nobody has opened it');
SELECT pg_temp.is(:'lapsed'::jsonb ->> 'state', 'expired', 'an old link is expired');
SELECT pg_temp.is((:'lapsed'::jsonb ->> 'last_opened_at') IS NOT NULL, true, 'and says when it was last opened');
SELECT pg_temp.is(:'used'::jsonb ->> 'state', 'accepted', 'a used link is accepted');
SELECT pg_temp.is(:'waiting'::jsonb ? 'token_hash', false, 'the hash is never given');

-- 39. The server function that emails the link records how the send went (service role only), against that link: a result for a link that was since replaced is dropped, so the step never
-- reports an old send as the current one.
-- Break caught: a late result of the old link is written onto the new one, or a signed-in member can write delivery results themselves.
SELECT public.record_intake_invite_delivery(:'inv5_invitation_id'::uuid, repeat('5', 64), 'sent', NULL) AS rec_ok \gset
SELECT pg_temp.is(:'rec_ok'::boolean, false, 'a link that was accepted records nothing more');
SELECT id AS pend6 FROM public.intake_invitations WHERE intake_id = pg_temp.id('intake6') AND status = 'pending' \gset
SELECT public.record_intake_invite_delivery(:'pend6'::uuid, repeat('6', 64), 'failed', 'rejected') AS rec6 \gset
SELECT pg_temp.is(:'rec6'::boolean, true, 'a waiting link records its result');
SELECT pg_temp.is((SELECT email_outcome || ':' || email_error FROM public.intake_invitations WHERE id = :'pend6'::uuid), 'failed:rejected', 'the outcome and its kind are kept');
SELECT public.record_intake_invite_delivery(:'pend6'::uuid, repeat('7', 64), 'sent', NULL) AS rec_stale \gset
SELECT pg_temp.is(:'rec_stale'::boolean, false, 'a result for another link than the current one is dropped');
SELECT pg_temp.is(pg_temp.state_as('a_agent', 'alpha-advisory', format('SELECT public.record_intake_invite_delivery(%L, %L, %L, NULL)', :'pend6', repeat('6', 64), 'sent')), '42501', 'a member can''t record a result');

-- The certification of an intake as a person writes it: the signature on the saved answers, at the firm's address. Raises what the database raises.
CREATE FUNCTION pg_temp.certify(who text, intake text, addr text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_temp.as_user(who, addr);
  UPDATE public.chamber_sessions SET status = 'submitted', submission = jsonb_build_object(
    'signer_name', 'Signer Person', 'signer_title', 'CEO', 'signed_at', '2026-11-20T12:00:00Z', 'consent_version', '2026-10-draft-1',
    'consent_text', '["I certify."]'::jsonb, 'chamber_data', chamber_data) WHERE id = pg_temp.id(intake);
  PERFORM pg_temp.as_owner();
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.as_owner();
  RAISE;
END $$;

-- 40. Only the employer certifies (D-1703, P-2.2, CRM-Q2.3): the database refuses a certification from a member of the intake's firm, even for an intake that is theirs on paper, and nothing is certified.
-- Break caught: the firm's own people can sign the employer's certification (a broker who was handed the intake, or joined the firm after accepting).
INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (pg_temp.id('a_agent2'), '{"company_name": "Member Co", "states": ["TX"], "pay_frequency": "Weekly"}');
UPDATE public.chamber_sessions SET firm_id = pg_temp.id('alpha') WHERE user_id = pg_temp.id('a_agent2');
INSERT INTO fx SELECT 'member_intake', id FROM public.chamber_sessions WHERE user_id = pg_temp.id('a_agent2');
SELECT pg_temp.is(pg_temp.state_as('a_agent2', 'alpha-advisory', format('SELECT pg_temp.certify(%L, %L, %L)', 'a_agent2', 'member_intake', 'alpha-advisory')), '42501', 'a member of the firm can''t certify');
SELECT pg_temp.is((SELECT status FROM public.chamber_sessions WHERE id = pg_temp.id('member_intake')), 'in_progress', 'and the intake is not certified');

-- 41. The employer certifies the broker-started intake once they have accepted: it is certified, and the chain rule held from the start (ADR 0025): the certification makes no second account or
-- opportunity, the intake is still on the opportunity the broker started it on.
-- Break caught: certifying a broker-started intake makes a second account and opportunity beside the broker's, or fails for want of the employer's profile.
SELECT count(*) AS accounts_before FROM public.accounts \gset
SELECT count(*) AS opps_before FROM public.opportunities \gset
SELECT pg_temp.certify('client', 'intake5', 'alpha-advisory');
SELECT pg_temp.is((SELECT status FROM public.chamber_sessions WHERE id = pg_temp.id('intake5')), 'submitted', 'the employer certified');
SELECT pg_temp.is((SELECT count(*) FROM public.accounts), :'accounts_before'::bigint, 'no second account was made');
SELECT pg_temp.is((SELECT count(*) FROM public.opportunities), :'opps_before'::bigint, 'nor a second opportunity');
SELECT pg_temp.is((SELECT intake_id FROM public.opportunities WHERE id = pg_temp.id('opp5')), pg_temp.id('intake5'), 'the intake is still on the broker''s opportunity');

-- 42. Certifying confirms the broker's entries as the employer's (D-1710): each entry still says a broker entered it (so the step can show what the employer changed from them), is now
-- confirmed, and carries when the employer confirmed it. An answer the employer changed is not touched: it is theirs.
-- Break caught: a broker's entry stays "inferred" after the employer signed for it (the required items still call it unconfirmed), or loses the mark that it was the broker's.
SELECT pg_temp.is((SELECT field_provenance -> 'company_name' ->> 'status' FROM public.chamber_sessions WHERE id = pg_temp.id('intake5')), 'confirmed', 'a broker''s entry is confirmed by the certification');
SELECT pg_temp.is((SELECT field_provenance -> 'company_name' -> 'source' ->> 'kind' FROM public.chamber_sessions WHERE id = pg_temp.id('intake5')), 'broker_entry', 'and still says a broker entered it');
SELECT pg_temp.is((SELECT field_provenance -> 'company_name' ->> 'employer_confirmed_at' IS NOT NULL FROM public.chamber_sessions WHERE id = pg_temp.id('intake5')), true, 'with when the employer confirmed it');

-- 43. The employer can't write a broker's name on an answer: a save from the employer's browser that gives a field a broker-entry source the intake did not already hold for it is refused (42501).
-- The employer may change what a broker entered (the answer then carries the employer's own source and certification leaves it alone), or drop it.
-- Break caught: the employer's browser can mark answers as the broker's (the record then names a member who entered what they did not), or certification re-marks an answer the employer changed.
UPDATE public.chamber_sessions SET status = 'archived' WHERE id = pg_temp.id('employer_intake');
SELECT pg_temp.as_user('a_agent', 'alpha-advisory');
SELECT pg_temp.chamber_save('a_agent', pg_temp.id('intake9'), '{"company_name": "Nine Co", "states": ["CA"], "pay_frequency": "Monthly", "industry": "Bakery"}');
SELECT pg_temp.as_user('client2', 'alpha-advisory');
SELECT public.accept_intake_invite(repeat('9', 64), 'alpha-advisory');
SELECT pg_temp.as_owner();
SELECT pg_temp.is(pg_temp.state_as('client2', 'alpha-advisory', format($q$UPDATE public.chamber_sessions SET field_provenance = field_provenance || jsonb_build_object('hris_system',
  jsonb_build_object('status', 'inferred', 'source', jsonb_build_object('kind', 'broker_entry', 'member_id', %L), 'updated_at', '2026-11-20T10:00:00Z')),
  chamber_data = chamber_data || '{"hris_system": "ADP"}' WHERE id = %L$q$, pg_temp.id('a_agent')::text, pg_temp.id('intake9'))), '42501', 'the employer can''t give an answer a broker''s source');
-- The employer changes the company name (their own source) and keeps the rest; then certifies.
SELECT pg_temp.as_user('client2', 'alpha-advisory');
UPDATE public.chamber_sessions SET chamber_data = chamber_data || '{"company_name": "Nine Company LLC"}',
  field_provenance = field_provenance || jsonb_build_object('company_name', jsonb_build_object('status', 'confirmed', 'source', jsonb_build_object('kind', 'prospect_edit'), 'updated_at', '2026-11-21T10:00:00Z'))
WHERE id = pg_temp.id('intake9');
SELECT pg_temp.as_owner();
SELECT pg_temp.certify('client2', 'intake9', 'alpha-advisory');
SELECT pg_temp.is((SELECT field_provenance -> 'company_name' -> 'source' ->> 'kind' FROM public.chamber_sessions WHERE id = pg_temp.id('intake9')), 'prospect_edit', 'an answer the employer changed is theirs after certifying');
SELECT pg_temp.is((SELECT field_provenance -> 'industry' ->> 'status' FROM public.chamber_sessions WHERE id = pg_temp.id('intake9')), 'confirmed', 'and one they left is confirmed as theirs');
SELECT pg_temp.is((SELECT field_provenance -> 'industry' -> 'source' ->> 'kind' FROM public.chamber_sessions WHERE id = pg_temp.id('intake9')), 'broker_entry', 'while still saying who entered it');

-- 45. The browser and the database read a broker's entry alike: every case of src/data/requiredItems.brokerCases.json (which the browser's tests run through requiredItems) gives the same
-- states through public.intake_required_items, including the sources both sides drop.
-- Break caught: the two readers of a stored source drift apart, so the page calls an answer the employer's own that the database holds unconfirmed (or the reverse).
\set bcases `cat src/data/requiredItems.brokerCases.json`
CREATE TEMP TABLE broker_cases AS SELECT value AS spec FROM jsonb_array_elements((:'bcases'::jsonb) -> 'cases');
DO $$
DECLARE
  c record;
  got jsonb;
  seen integer := 0;
BEGIN
  FOR c IN SELECT * FROM broker_cases LOOP
    SELECT jsonb_object_agg(i ->> 'field', i ->> 'state') INTO got
    FROM jsonb_array_elements(public.intake_required_items(c.spec -> 'data', c.spec -> 'provenance', ARRAY(SELECT jsonb_array_elements_text(c.spec -> 'verified')))) i;
    IF got IS DISTINCT FROM c.spec -> 'expected' THEN
      RAISE EXCEPTION 'FAIL: "%" gave %, expected %', c.spec ->> 'name', got, c.spec -> 'expected';
    END IF;
    seen := seen + 1;
  END LOOP;
  IF seen < 4 THEN RAISE EXCEPTION 'FAIL: only % broker-entry cases were read', seen; END IF;
END $$;

-- 46. chamber-extract asks whether the caller may talk to Lenore as the broker in an intake (P-2.4): yes for a member of the firm in an intake the firm started that is still being worked, no for
-- anyone else, an employer's own intake, a closed one and one in a firm that is closing. A yes or no, never a refusal, so the function can answer "not found" as it does for any intake that
-- isn't the caller's.
-- Break caught: Lenore takes a broker's words as the broker's in an intake that isn't the firm's to fill in, or as the employer's.
SELECT pg_temp.as_user('a_agent', 'alpha-advisory');
SELECT public.broker_may_enter_intake(pg_temp.id('intake6')) AS may_yes \gset
SELECT public.broker_may_enter_intake(pg_temp.id('employer_intake')) AS may_employer \gset
SELECT public.broker_may_enter_intake(pg_temp.id('intake5')) AS may_certified \gset
SELECT public.broker_may_enter_intake(gen_random_uuid()) AS may_missing \gset
SELECT pg_temp.as_user('b_owner', 'bravo-brokers');
SELECT public.broker_may_enter_intake(pg_temp.id('intake6')) AS may_other_firm \gset
SELECT pg_temp.as_owner();
SELECT pg_temp.is(:'may_yes'::boolean, true, 'a member may in a broker-started intake being worked');
SELECT pg_temp.is(:'may_employer'::boolean, false, 'not in an employer''s own intake');
SELECT pg_temp.is(:'may_certified'::boolean, false, 'not in one that is certified');
SELECT pg_temp.is(:'may_missing'::boolean, false, 'not in one that is not there');
SELECT pg_temp.is(:'may_other_firm'::boolean, false, 'not another firm''s member');
INSERT INTO public.firm_closures (firm_id, asked_at, closes_at) VALUES (pg_temp.id('alpha'), now() - interval '1 day', now() + interval '29 days');
SELECT pg_temp.as_user('a_agent', 'alpha-advisory');
SELECT public.broker_may_enter_intake(pg_temp.id('intake6')) AS may_closing \gset
SELECT pg_temp.as_owner();
DELETE FROM public.firm_closures WHERE firm_id = pg_temp.id('alpha');
SELECT pg_temp.is(:'may_closing'::boolean, false, 'not in a firm that is closing');

-- 48. Remind says an intake is closed before it looks for an invitation (55000): an intake that is archived or certified has nothing to remind the client of, whatever was sent before.
-- Break caught: Remind on a closed intake mails the client a link into something nobody can finish, or says only that no invitation is waiting.
UPDATE public.chamber_sessions SET status = 'archived' WHERE id = pg_temp.id('intake6');
SELECT pg_temp.is(pg_temp.state_as('a_agent', 'alpha-advisory', format('SELECT * FROM public.remind_intake_invite(%L, %L)', pg_temp.id('intake6'), repeat('8', 64))), '55000', 'a closed intake is not reminded about');
UPDATE public.chamber_sessions SET status = 'in_progress' WHERE id = pg_temp.id('intake6');

-- 49. An intake nobody was invited about reads "none", and an intake of another firm or an employer's own is not available (PT404).
-- Break caught: step 3 offers "Waiting for ..." for an intake with no invitation, or answers a stranger something about an intake that isn't theirs.
SELECT pg_temp.opp('opp_none', 'alpha', 'a_agent');
SELECT pg_temp.as_user('a_agent', 'alpha-advisory');
SELECT public.start_broker_intake(pg_temp.id('opp_none')) ->> 'intake_id' AS none_intake \gset
SELECT public.intake_invite_status(:'none_intake'::uuid) AS none_state \gset
SELECT pg_temp.as_owner();
SELECT pg_temp.is(:'none_state'::jsonb ->> 'state', 'none', 'an intake nobody was invited about has no invitation');
SELECT pg_temp.is(pg_temp.state_as('b_owner', 'bravo-brokers', format('SELECT public.intake_invite_status(%L)', :'none_intake')), 'PT404', 'another firm''s member is told it is not available');
SELECT pg_temp.is(pg_temp.state_as('a_agent', 'alpha-advisory', format('SELECT public.intake_invite_status(%L)', pg_temp.id('employer_intake'))), 'PT404', 'and so is anyone about an employer''s own intake');

-- 50. A member of the firm saves a broker-started intake through the chamber's own save, and what they entered is marked as theirs: the answer is kept, its source is a broker entry naming the member
-- (whatever source the chamber wrote), and its status is inferred, never confirmed (D-1710).
-- Break caught: the member can't save at all (the chamber is closed to them), or the answer is saved as the employer's own.
SELECT pg_temp.opp('opp_save', 'alpha', 'a_agent');
SELECT pg_temp.as_user('a_agent', 'alpha-advisory');
SELECT public.start_broker_intake(pg_temp.id('opp_save')) ->> 'intake_id' AS save_intake \gset
SELECT pg_temp.as_owner();
INSERT INTO fx VALUES ('save_intake', :'save_intake'::uuid);
SELECT pg_temp.is(pg_temp.chamber_save('a_agent', pg_temp.id('save_intake'), '{"company_name": "Saved Co", "states": ["TX"]}'), 'rows:1', 'the member''s save goes through');
SELECT pg_temp.is((SELECT chamber_data ->> 'company_name' FROM public.chamber_sessions WHERE id = pg_temp.id('save_intake')), 'Saved Co', 'the answer is kept');
SELECT pg_temp.is((SELECT field_provenance -> 'company_name' -> 'source' ->> 'kind' FROM public.chamber_sessions WHERE id = pg_temp.id('save_intake')), 'broker_entry', 'its source is a broker entry, not what the chamber wrote');
SELECT pg_temp.is((SELECT field_provenance -> 'company_name' -> 'source' ->> 'member_id' FROM public.chamber_sessions WHERE id = pg_temp.id('save_intake')), pg_temp.id('a_agent')::text, 'naming the member');
SELECT pg_temp.is((SELECT field_provenance -> 'states' ->> 'status' FROM public.chamber_sessions WHERE id = pg_temp.id('save_intake')), 'inferred', 'and the status is not confirmed');

-- 51. A member's direct update of the intake's extra_answers is refused (D-1759a). The chamber's own save sends extra_answers as they stand, so a save that leaves them alone goes through
-- (below); a crafted update that writes them is refused, the whole save, as the FEIN is (42501): the answers to a PEO's own questions are the employer's, and nothing in them can be marked as the broker's.
-- Break caught: a broker writes the employer's answers to a PEO's questions through a direct update that the chamber's trigger never looks at.
SELECT pg_temp.opp('opp_hole', 'alpha', 'a_agent');
SELECT pg_temp.as_user('a_agent', 'alpha-advisory');
SELECT public.start_broker_intake(pg_temp.id('opp_hole')) ->> 'intake_id' AS hole_intake \gset
SELECT pg_temp.as_owner();
INSERT INTO fx VALUES ('hole_intake', :'hole_intake'::uuid);
SELECT pg_temp.is(pg_temp.state_as('a_agent', 'alpha-advisory', format($q$UPDATE public.chamber_sessions SET extra_answers = %L WHERE id = %L$q$,
  '{"7": {"q1": {"question": "Q?", "kind": "text", "value": "typed by the broker", "status": "confirmed", "source": {"kind": "prospect_edit"}, "updated_at": "2026-11-20T10:00:00.000Z"}}}', pg_temp.id('hole_intake'))),
  '42501', 'a member''s update of the extra answers is refused');

-- 52. The chamber's own save still goes through: it sends the answers, the provenance, the conversation, the PEO choice and the extra answers as they stand, and only the first three change.
-- Break caught: the refusal reads every save that mentions the extra answers as one that writes them, and the broker can't save in the chamber at all.
SELECT pg_temp.is(pg_temp.state_as('a_agent', 'alpha-advisory', format($q$UPDATE public.chamber_sessions SET chamber_data = chamber_data || '{"industry": "Bakery"}', field_provenance = field_provenance,
  transcript = transcript, chosen_peo = chosen_peo, extra_answers = extra_answers WHERE id = %L$q$, pg_temp.id('hole_intake'))), 'ok', 'a save that leaves the extra answers alone is not refused');
SELECT pg_temp.is((SELECT chamber_data ->> 'industry' FROM public.chamber_sessions WHERE id = pg_temp.id('hole_intake')), 'Bakery', 'and the answer is kept');

-- 53. A member's update of the submission is refused (D-1759a): the submission is what certifying records, written by the database, never by a member.
-- Break caught: a broker writes the record of what the employer certified.
SELECT pg_temp.is(pg_temp.state_as('a_agent', 'alpha-advisory', format($q$UPDATE public.chamber_sessions SET submission = '{"forged": true}' WHERE id = %L$q$, pg_temp.id('hole_intake'))), '42501', 'a member''s update of the submission is refused');

-- 54. A member's update of the intake's expiry is refused (D-1759a): when an idle draft closes is the database's to keep.
-- Break caught: a broker keeps an employer's draft open (or closes it early) by writing its expiry.
SELECT pg_temp.is(pg_temp.state_as('a_agent', 'alpha-advisory', format($q$UPDATE public.chamber_sessions SET expires_at = now() + interval '900 days' WHERE id = %L$q$, pg_temp.id('hole_intake'))), '42501', 'a member''s update of the expiry is refused');

-- 55. A member's update of the intake's firm is refused (D-1759a): an intake stays with the firm that started it.
-- Break caught: a broker moves an intake to another firm.
SELECT pg_temp.is(pg_temp.state_as('a_agent', 'alpha-advisory', format($q$UPDATE public.chamber_sessions SET firm_id = %L WHERE id = %L$q$, pg_temp.id('bravo'), pg_temp.id('hole_intake'))), '42501', 'a member''s update of the firm is refused');

-- 56. A member's update of who started the intake is refused (D-1759a): the starter is set by the database alone (D-1750).
-- Break caught: a broker names another member as the starter, or clears it so the firm's policy stops covering the intake.
SELECT pg_temp.is(pg_temp.state_as('a_agent', 'alpha-advisory', format($q$UPDATE public.chamber_sessions SET started_by = NULL WHERE id = %L$q$, pg_temp.id('hole_intake'))), '42501', 'a member''s update of the starter is refused');

-- 57. A member's update of the intake's consent record is refused (D-1759a): the agreement is the employer's (D-1751), never the firm's to point at.
-- Break caught: a broker attaches a consent to an intake whose employer never gave one.
SELECT pg_temp.is(pg_temp.state_as('a_agent', 'alpha-advisory', format($q$UPDATE public.chamber_sessions SET intake_consent_id = gen_random_uuid() WHERE id = %L$q$, pg_temp.id('hole_intake'))), '42501', 'a member''s update of the consent is refused');

-- 58. A member's update of how the intake began (its referral code and campaign tags) is refused (D-1759a).
-- Break caught: a broker rewrites where an intake came from.
SELECT pg_temp.is(pg_temp.state_as('a_agent', 'alpha-advisory', format($q$UPDATE public.chamber_sessions SET referral_code = 'forged-code' WHERE id = %L$q$, pg_temp.id('hole_intake'))), '42501', 'a member''s update of the referral code is refused');

-- 59. A member's update of the intake's File ID is refused (D-1759a): the File ID is how the advisor and the employer name the intake.
-- Break caught: a broker renames an intake to another's File ID.
SELECT pg_temp.is(pg_temp.state_as('a_agent', 'alpha-advisory', format($q$UPDATE public.chamber_sessions SET file_id = 'EAA-FORGED' WHERE id = %L$q$, pg_temp.id('hole_intake'))), '42501', 'a member''s update of the File ID is refused');

-- 60. A member's update of the intake's schema version is refused (D-1759a): which questions the intake was answered against is the database's to keep.
-- Break caught: a broker moves an intake to another version of the questions, so its answers are read against the wrong ones.
SELECT pg_temp.is(pg_temp.state_as('a_agent', 'alpha-advisory', format($q$UPDATE public.chamber_sessions SET schema_version = schema_version + 1 WHERE id = %L$q$, pg_temp.id('hole_intake'))), '42501', 'a member''s update of the schema version is refused');

-- 61. A member's update of the intake's status is refused (D-1759a): archiving or closing an intake is the employer's act, or the database's.
-- Break caught: a broker archives or certifies an intake through a direct update.
SELECT pg_temp.is(pg_temp.state_as('a_agent', 'alpha-advisory', format($q$UPDATE public.chamber_sessions SET status = 'archived' WHERE id = %L$q$, pg_temp.id('hole_intake'))), '42501', 'a member''s update of the status is refused');
SELECT pg_temp.is((SELECT status FROM public.chamber_sessions WHERE id = pg_temp.id('hole_intake')), 'in_progress', 'the intake is still being worked');

-- 62. A member's update of the intake's version is refused (D-1759a): the version is what the browser's saves check against, moved on by the database.
-- Break caught: a broker sets the version so another tab's save no longer matches, or matches when it shouldn't.
SELECT pg_temp.is(pg_temp.state_as('a_agent', 'alpha-advisory', format($q$UPDATE public.chamber_sessions SET data_version = data_version + 5 WHERE id = %L$q$, pg_temp.id('hole_intake'))), '42501', 'a member''s update of the version is refused');

-- 63..68. A member's save the way the browser makes it (D-1906). The chamber saves the whole form, not just what changed: every answer not given is a JSON null (or an empty list),
-- and what the member entered is marked as a broker entry already (markBrokerEntries), the way it is drawn on screen. The database keeps its own marks, so neither may stop the save.
-- Break caught: every save by a member of the firm refused ("The FEIN is typed by the employer" for the empty FEIN the form carries, "Only the firm's members enter answers as the broker" for the mark
-- the chamber already made), so what a broker types or tells Lenore is shown on screen and never kept; and, once past those, a hundred empty answers marked as the broker's.
CREATE FUNCTION pg_temp.form_save(who text, intake uuid, answers jsonb, enterer uuid DEFAULT NULL) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint; s text;
BEGIN
  PERFORM pg_temp.as_user(who, 'alpha-advisory');
  BEGIN
    UPDATE public.chamber_sessions SET
      chamber_data = '{"fein": null, "entity_type": null, "website": null, "industry": null, "states": [], "census": [], "pto_types": []}'::jsonb || chamber_data || answers,
      field_provenance = field_provenance || COALESCE((SELECT jsonb_object_agg(k, jsonb_build_object('status', 'inferred', 'source', jsonb_build_object('kind', 'broker_entry', 'member_id', COALESCE(enterer, auth.uid())), 'updated_at', '2026-11-20T10:00:00.000Z')) FROM jsonb_object_keys(answers) k), '{}')
    WHERE id = intake;
    GET DIAGNOSTICS n = ROW_COUNT;
    PERFORM pg_temp.as_owner();
    RETURN 'rows:' || n;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE;
    PERFORM pg_temp.as_owner();
    RETURN s;
  END;
END $$;
SELECT pg_temp.opp('opp_form', 'alpha', 'a_agent');
SELECT pg_temp.as_user('a_agent', 'alpha-advisory');
SELECT public.start_broker_intake(pg_temp.id('opp_form')) ->> 'intake_id' AS form_intake \gset
SELECT pg_temp.as_owner();
INSERT INTO fx VALUES ('form_intake', :'form_intake'::uuid);
SELECT pg_temp.is(pg_temp.form_save('a_agent', pg_temp.id('form_intake'), '{"company_name": "Form Co", "employee_count": 12}'), 'rows:1', '63: a member''s whole-form save, empty answers and the chamber''s own broker marks included, goes through');
SELECT pg_temp.is((SELECT chamber_data ->> 'company_name' FROM public.chamber_sessions WHERE id = pg_temp.id('form_intake')), 'Form Co', 'and the answer is kept');
SELECT pg_temp.is((SELECT field_provenance -> 'company_name' -> 'source' ->> 'member_id' FROM public.chamber_sessions WHERE id = pg_temp.id('form_intake')), pg_temp.id('a_agent')::text, 'marked as a broker entry naming the member');
SELECT pg_temp.is((SELECT field_provenance -> 'company_name' ->> 'status' FROM public.chamber_sessions WHERE id = pg_temp.id('form_intake')), 'inferred', 'never confirmed');
SELECT pg_temp.is((SELECT count(*)::text FROM public.chamber_sessions s, jsonb_object_keys(s.field_provenance) WHERE s.id = pg_temp.id('form_intake')), '2', '64: only the two answers given are marked: no empty answer is marked as the broker''s');
SELECT pg_temp.is((SELECT (chamber_data ? 'fein' OR chamber_data ? 'states' OR chamber_data ? 'census')::text FROM public.chamber_sessions WHERE id = pg_temp.id('form_intake')), 'false', 'and no empty answer is written into the intake');
-- 65. A second whole-form save that adds one answer and carries the first as it was: the first keeps its mark and time.
SELECT pg_temp.is(pg_temp.form_save('a_agent', pg_temp.id('form_intake'), '{"industry": "Bakery"}'), 'rows:1', '65: a second whole-form save adds an answer');
SELECT pg_temp.is((SELECT field_provenance -> 'company_name' ->> 'updated_at' FROM public.chamber_sessions WHERE id = pg_temp.id('form_intake')) = (SELECT field_provenance -> 'employee_count' ->> 'updated_at' FROM public.chamber_sessions WHERE id = pg_temp.id('form_intake')) AND (SELECT field_provenance -> 'industry' -> 'source' ->> 'kind' FROM public.chamber_sessions WHERE id = pg_temp.id('form_intake')) = 'broker_entry', 'true', 'the earlier answers are as they were and the new one is a broker entry');
-- 66. The member's own mark is the database's: a save that names another member as the enterer is kept as the caller's.
SELECT pg_temp.is(pg_temp.form_save('a_agent', pg_temp.id('form_intake'), '{"website": "form.example"}', pg_temp.id('b_owner')), 'rows:1', '66: a member naming another person as the enterer is not refused...');
SELECT pg_temp.is((SELECT field_provenance -> 'website' -> 'source' ->> 'member_id' FROM public.chamber_sessions WHERE id = pg_temp.id('form_intake')), pg_temp.id('a_agent')::text, '...and the answer is marked as the caller''s, whatever the save said');
-- 67. The FEIN is still the employer's: a member's whole-form save that gives one is refused, and so is one that blanks the one the employer typed; nothing in either is kept.
SELECT pg_temp.is(pg_temp.form_save('a_agent', pg_temp.id('form_intake'), '{"fein": "123456789", "industry": "Cafe"}'), '42501', '67: a whole-form save that gives a FEIN is still refused');
UPDATE public.chamber_sessions SET chamber_data = chamber_data || '{"fein": "987654321"}' WHERE id = pg_temp.id('form_intake');
SELECT pg_temp.is(pg_temp.form_save('a_agent', pg_temp.id('form_intake'), '{"fein": null, "industry": "Cafe"}'), '42501', 'and one that blanks the FEIN the employer typed');
SELECT pg_temp.is((SELECT chamber_data ->> 'industry' FROM public.chamber_sessions WHERE id = pg_temp.id('form_intake')), 'Bakery', 'nothing of either save is kept');
-- 68. Whoever is not a member still cannot give an answer a broker's mark, whole form or not (test 55 above says it for the employer; this is the same save from a stranger's account).
SELECT pg_temp.is(pg_temp.form_save('client', pg_temp.id('form_intake'), '{"industry": "Forged"}'), 'rows:0', '68: a stranger''s whole-form save changes nothing (row security shows them no such row)');

-- 69. The opportunity's page says whether the firm started the intake it holds (D-1908). The screen offers "Continue the intake" only for one the firm started: that is the intake a member can enter
-- answers in and invite the client from, and the dialog that does it opens only for it. An employer's own intake, certified or not, is not the firm's to continue.
-- Break caught: the link offered on an employer's intake (a dialog that has nothing to show), or never offered on the firm's (a broker who closed the dialog has no way back to the invitation).
SELECT pg_temp.as_user('a_agent', 'alpha-advisory');
SELECT COALESCE(public.opportunity_page(pg_temp.id('alpha'), pg_temp.id('opp_form')) -> 'intake' ->> 'started_by_firm', 'missing') AS firm_started \gset
SELECT pg_temp.as_owner();
SELECT pg_temp.is(:'firm_started'::text, 'true', '69: an intake the firm started is marked as the firm''s on the opportunity''s page');
SELECT pg_temp.new_user('emp69');
SELECT pg_temp.opp('opp_employer', 'alpha', 'a_agent');
INSERT INTO public.chamber_sessions (user_id, firm_id, chamber_data) VALUES (pg_temp.id('emp69'), pg_temp.id('alpha'), '{}') RETURNING id AS employer_session \gset
UPDATE public.opportunities SET intake_id = :'employer_session' WHERE id = pg_temp.id('opp_employer');
SELECT pg_temp.as_user('a_agent', 'alpha-advisory');
SELECT COALESCE(public.opportunity_page(pg_temp.id('alpha'), pg_temp.id('opp_employer')) -> 'intake' ->> 'started_by_firm', 'missing') AS employer_started \gset
SELECT pg_temp.as_owner();
SELECT pg_temp.is(:'employer_started'::text, 'false', 'and an intake the employer started is not');

-- 70. A draft the firm started does not expire from sitting idle (D-1911). It is the firm's working file, not a prospect's abandoned draft: a broker who leaves one for a month and comes back to it
-- (through Continue the intake, D-1908) must find it as it was, not "expired" with the invitation, the answers and the way back gone. An employer's own idle draft still expires, as it always did.
-- Break caught: the 30-day job ending a firm-started intake the day after a long weekend of nobody touching it, a quote started and lost.
UPDATE public.chamber_sessions SET expires_at = now() - interval '1 day' WHERE id IN (pg_temp.id('form_intake'), :'employer_session'::uuid);
SELECT public.expire_idle_intakes() AS moved \gset
SELECT pg_temp.is((SELECT status FROM public.chamber_sessions WHERE id = :'employer_session'::uuid), 'expired', '70: an employer''s own draft, idle past its time, still expires');
SELECT pg_temp.is((SELECT status FROM public.chamber_sessions WHERE id = pg_temp.id('form_intake')), 'in_progress', 'and the draft the firm started, idle past the same time, does not');
-- 71. Nor is the reminder that a draft is about to close sent for one the firm started, whoever has it now: the client who accepted the invitation owns the intake, asked for reminders and has a verified
-- email, and nothing is going to close it. The same client's own draft is still reminded.
-- Break caught: "your draft closes in a few days" emailed to a client about a file that never closes, and the link in it sending them to a dead end.
SELECT pg_temp.new_user('rem71');
UPDATE public.profiles SET draft_reminders_at = now() WHERE user_id = pg_temp.id('rem71');
UPDATE public.chamber_sessions SET user_id = pg_temp.id('rem71'), expires_at = now() + interval '1 day', chamber_data = chamber_data || '{"company_name": "Form Co"}' WHERE id = pg_temp.id('form_intake');
INSERT INTO public.chamber_sessions (user_id, firm_id, chamber_data, expires_at) VALUES (pg_temp.id('rem71'), pg_temp.id('alpha'), '{"company_name": "Own Co"}', now() + interval '1 day') RETURNING id AS own_session \gset
SELECT public.queue_draft_expiry_reminders() AS queued \gset
SELECT pg_temp.is((SELECT count(*)::text FROM public.outbox_events WHERE kind = 'draft_expiry_reminder' AND session_id = :'own_session'::uuid), '1', '71: the client''s own draft is reminded');
SELECT pg_temp.is((SELECT count(*)::text FROM public.outbox_events WHERE kind = 'draft_expiry_reminder' AND session_id = pg_temp.id('form_intake')), '0', 'and the draft the firm started, which the client now owns, is not');
-- 72. The job does not stop on an intake with no user at all: a firm-started one whose starter's account was deleted (started_by goes null) and which no client has taken over.
-- Break caught: the whole statement failing, hourly, on the one row it cannot write an event for, and no intake expiring anywhere until someone found it.
INSERT INTO public.chamber_sessions (user_id, firm_id, chamber_data, expires_at) VALUES (NULL, pg_temp.id('alpha'), '{}', now() - interval '1 day') RETURNING id AS orphan_session \gset
SELECT public.expire_idle_intakes() AS moved \gset
SELECT pg_temp.is((SELECT status FROM public.chamber_sessions WHERE id = :'orphan_session'::uuid), 'in_progress', '72: an idle intake with no user and no starter is left alone, and the job still runs');

-- 73. The send panel reads whether its firm is approved to send (D-1910) with a plain read of the firm's own row as the signed-in member: an agent, not only an owner, sees whether their firm is approved, and
-- sees nothing of another firm's. Break caught: a panel that cannot read it (the column not granted, or the row hidden from an agent) and so never says the firm isn't approved, or one that reads another firm's.
SELECT pg_temp.as_user('a_agent', 'alpha-advisory');
SELECT COALESCE((SELECT (approved_at IS NOT NULL)::text FROM public.firms WHERE id = pg_temp.id('alpha')), 'unreadable') AS own_firm \gset
SELECT COALESCE((SELECT (approved_at IS NOT NULL)::text FROM public.firms WHERE id = pg_temp.id('bravo')), 'hidden') AS other_firm \gset
SELECT pg_temp.as_owner();
SELECT pg_temp.is(:'own_firm'::text, 'true', '73: an agent reads that their own, approved, firm is approved to send');
SELECT pg_temp.is(:'other_firm'::text, 'hidden', 'and reads nothing of another firm');
UPDATE public.firms SET approved_at = NULL WHERE id = pg_temp.id('alpha');
SELECT pg_temp.as_user('a_agent', 'alpha-advisory');
SELECT COALESCE((SELECT (approved_at IS NOT NULL)::text FROM public.firms WHERE id = pg_temp.id('alpha')), 'unreadable') AS own_firm_waiting \gset
SELECT pg_temp.as_owner();
SELECT pg_temp.is(:'own_firm_waiting'::text, 'false', 'and reads that a firm still waiting for approval is not');
UPDATE public.firms SET approved_at = now() WHERE id = pg_temp.id('alpha');
