-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh new_quote_intake
-- New quote step 2, the intake with Lenore (slice 5.5, CRM-Q2.2; docs/BROKER_CRM_BUILD.md D-1870..D-1879; 20261124100000_new_quote_intake.sql): what the account holds is
-- written into the broker-started intake as the agent's entry before the agent types anything.
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
\i supabase/migrations/20261126090000_lines.sql
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

-- An account that holds facts, and an open opportunity on it.
UPDATE public.accounts SET industry = 'Retail', employees = 23, states_of_operation = ARRAY['CA','TX'], current_provider = 'Summit Employer Services', street = '500 Harbor Street', state = 'CA', website = 'opp1.example'
  WHERE id = (SELECT account_id FROM public.opportunities WHERE id = pg_temp.id('opp1'));

-- 1. A broker starts the intake: what the account holds is already in it, as the member's entry (CRM-Q2.2, D-1870), before anything is typed.
-- Break caught: the intake starts empty, so the agent retypes what the account knows; or the facts carry no source, so they read as the employer's own.
SELECT pg_temp.as_user('a_agent', 'alpha-advisory');
SELECT public.start_broker_intake(pg_temp.id('opp1')) ->> 'intake_id' AS made \gset
SELECT pg_temp.as_owner();
SELECT pg_temp.is((SELECT chamber_data ->> 'company_name' FROM public.chamber_sessions WHERE id = :'made'::uuid), 'opp1 Co', 'the account''s name is the company name');
SELECT pg_temp.is((SELECT field_provenance -> 'company_name' -> 'source' ->> 'kind' FROM public.chamber_sessions WHERE id = :'made'::uuid), 'broker_entry', 'it is a broker entry');
SELECT pg_temp.is((SELECT field_provenance -> 'company_name' -> 'source' ->> 'member_id' FROM public.chamber_sessions WHERE id = :'made'::uuid), pg_temp.id('a_agent')::text, 'naming the member who started it');
SELECT pg_temp.is((SELECT field_provenance -> 'company_name' ->> 'status' FROM public.chamber_sessions WHERE id = :'made'::uuid), 'inferred', 'not confirmed: the employer confirms at certification');

-- 2. The rest of what the account holds goes in the same way: industry, employees, states of operation, headquarters state, street, website and the current provider (CRM-Q2.2).
-- Break caught: only the name is carried over, so the agent retypes the rest; the provider is written as an answer although the account holds none (in_peo false would be lost).
SELECT pg_temp.is((SELECT chamber_data ->> 'industry' FROM public.chamber_sessions WHERE id = :'made'::uuid), 'Retail', 'the industry');
SELECT pg_temp.is((SELECT (chamber_data ->> 'employee_count')::int FROM public.chamber_sessions WHERE id = :'made'::uuid), 23, 'the employee count, as a number');
SELECT pg_temp.is((SELECT chamber_data -> 'states' FROM public.chamber_sessions WHERE id = :'made'::uuid), '["CA","TX"]'::jsonb, 'the states of operation');
SELECT pg_temp.is((SELECT chamber_data ->> 'hq_state' FROM public.chamber_sessions WHERE id = :'made'::uuid), 'CA', 'the headquarters state');
SELECT pg_temp.is((SELECT chamber_data ->> 'street_address' FROM public.chamber_sessions WHERE id = :'made'::uuid), '500 Harbor Street', 'the street');
SELECT pg_temp.is((SELECT chamber_data ->> 'website' FROM public.chamber_sessions WHERE id = :'made'::uuid), 'opp1.example', 'the website');
SELECT pg_temp.is((SELECT chamber_data ->> 'current_peo' FROM public.chamber_sessions WHERE id = :'made'::uuid), 'Summit Employer Services', 'the current provider');
SELECT pg_temp.is((SELECT (chamber_data -> 'in_peo')::text FROM public.chamber_sessions WHERE id = :'made'::uuid), 'true', 'and that they are with a PEO');
SELECT pg_temp.is((SELECT count(*) FROM public.chamber_sessions s, jsonb_each(s.field_provenance) e WHERE s.id = :'made'::uuid AND e.value -> 'source' ->> 'kind' = 'broker_entry'), 9::bigint, 'each of the nine is the member''s entry');

-- 3. An account that holds only a name seeds only the name: nothing blank, no empty list, no "in a PEO" claim.
-- Break caught: blanks and an empty states list are written as answers (the chamber then counts them as given), or in_peo is written true with no provider.
SELECT pg_temp.opp('opp2', 'alpha', 'a_agent');
SELECT pg_temp.as_user('a_agent', 'alpha-advisory');
SELECT public.start_broker_intake(pg_temp.id('opp2')) ->> 'intake_id' AS made2 \gset
SELECT pg_temp.as_owner();
SELECT pg_temp.is((SELECT chamber_data FROM public.chamber_sessions WHERE id = :'made2'::uuid), '{"company_name":"opp2 Co"}'::jsonb, 'only the name is written');

-- 4. A field holding only spaces is no answer: it is left out like a blank.
-- Break caught: the account's whitespace-only industry, street or provider is written in as an answer, so the chamber counts a blank as given and the agent never sees it is still needed.
SELECT pg_temp.opp('opp3', 'alpha', 'a_agent');
UPDATE public.accounts SET industry = '   ', street = '  ', website = ' ', current_provider = '  ' WHERE id = (SELECT account_id FROM public.opportunities WHERE id = pg_temp.id('opp3'));
SELECT pg_temp.as_user('a_agent', 'alpha-advisory');
SELECT public.start_broker_intake(pg_temp.id('opp3')) ->> 'intake_id' AS made3 \gset
SELECT pg_temp.as_owner();
SELECT pg_temp.is((SELECT chamber_data FROM public.chamber_sessions WHERE id = :'made3'::uuid), '{"company_name":"opp3 Co"}'::jsonb, 'spaces are not an answer');
