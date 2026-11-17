-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh peo_authorizations
-- The employer authorizes each PEO (story M-1.1, slice 6.6a; docs/BROKER_CRM_BUILD.md D-600, D-608, D-620 to D-629;
-- 20261122100000_peo_authorizations.sql). An append-only record per intake and listed PEO, written only by the intake's own employer; no send recorded
-- without a live one; withdrawing a PEO already sent to closes its quote request and marks the submission Needs advisor action.
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

-- An intake of a firm, started by its own prospect (p_<name>), placed by the superuser.
CREATE FUNCTION pg_temp.intake(n text, firm text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := pg_temp.new_user('p_' || n); sid uuid;
BEGIN
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, jsonb_build_object('company_name', n)) RETURNING id INTO sid;
  UPDATE public.chamber_sessions SET firm_id = pg_temp.id(firm) WHERE id = sid;
  INSERT INTO fx VALUES (n, sid);
  RETURN sid;
END $$;

CREATE FUNCTION pg_temp.fmove(intake text, to_status text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE from_status text;
BEGIN
  SELECT w.status INTO from_status FROM public.submission_workflow w WHERE w.session_id = pg_temp.id(intake);
  UPDATE public.submission_workflow SET status = to_status WHERE session_id = pg_temp.id(intake);
  INSERT INTO public.submission_status_history (session_id, from_status, to_status) VALUES (pg_temp.id(intake), from_status, to_status);
END $$;

-- An intake of a firm at Ready for market.
CREATE FUNCTION pg_temp.ready(n text, firm text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE sid uuid := pg_temp.intake(n, firm);
BEGIN
  PERFORM pg_temp.fmove(n, 'submitted');
  PERFORM pg_temp.fmove(n, 'under_review');
  PERFORM pg_temp.fmove(n, 'ready_for_market');
  -- Every submission sits on one opportunity of an account of its firm (CRM-Q1.1).
  WITH a AS (INSERT INTO public.accounts (source, firm_id, name) VALUES ('added_by_hand', pg_temp.id(firm), 'Account ' || n) RETURNING id, firm_id)
  INSERT INTO public.opportunities (firm_id, account_id, name, intake_id) SELECT a.firm_id, a.id, 'PEO search ' || n, sid FROM a;
  RETURN sid;
END $$;

-- The employer of intake n authorizes (true) or withdraws (false) a PEO under the wording in force, as the screens send it.
CREATE FUNCTION pg_temp.say(n text, peo text, yes boolean) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  RETURN pg_temp.say_as('p_' || n, n, peo, yes);
END $$;

-- The same, said by someone else.
CREATE FUNCTION pg_temp.say_as(who text, n text, peo text, yes boolean) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  IF who = 'anon' THEN PERFORM pg_temp.as_anon(); ELSE PERFORM pg_temp.as_user(who); END IF;
  r := pg_temp.refusal(format('SELECT public.set_peo_authorization(%L, %L, %L, public.peo_authorization_version(), %L)',
    pg_temp.id(n), peo, yes, 'I authorize ' || peo || ' to receive my packet.'));
  PERFORM pg_temp.as_owner();
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
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('acme_owner'), 'advisor'), (pg_temp.id('acme_agent'), 'advisor'), (pg_temp.id('zenith_owner'), 'advisor');
END $$;

-- ---------- The employer authorizes a listed PEO ----------
-- Break caught: there is no way for the employer to say a PEO may receive the packet, or what they said is not what the check reads.
DO $$
BEGIN
  PERFORM pg_temp.intake('i1', 'acme');
  PERFORM pg_temp.is(public.peo_authorized(pg_temp.id('i1'), 'TriNet'), false, 'before the employer says anything, TriNet is not authorized');
  PERFORM pg_temp.is(pg_temp.say('i1', 'TriNet', true), 'ok', 'the employer authorizes TriNet');
  PERFORM pg_temp.is(public.peo_authorized(pg_temp.id('i1'), 'TriNet'), true, 'then TriNet is authorized');
  PERFORM pg_temp.is(public.peo_authorized(pg_temp.id('i1'), 'Justworks'), false, 'and Justworks, never named, is not');
  RAISE NOTICE 'peo_authorizations: authorizing passed';
END $$;

-- ---------- Withdrawing ----------
-- Break caught: a withdrawal is not recorded, or the check reads the first thing said rather than the latest, so a withdrawn PEO still reads authorized;
-- authorizing again after a withdrawal does not bring it back.
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.say('i1', 'TriNet', false), 'ok', 'the employer withdraws TriNet');
  PERFORM pg_temp.is(public.peo_authorized(pg_temp.id('i1'), 'TriNet'), false, 'a withdrawn PEO is not authorized');
  PERFORM pg_temp.is(pg_temp.say('i1', 'TriNet', true), 'ok', 'the employer authorizes TriNet again');
  PERFORM pg_temp.is(public.peo_authorized(pg_temp.id('i1'), 'TriNet'), true, 'and it is authorized again');
  PERFORM pg_temp.is((SELECT string_agg(authorized::text, ',' ORDER BY id) FROM public.peo_authorizations WHERE session_id = pg_temp.id('i1')), 'true,false,true',
    'each change is its own row, appended');
  RAISE NOTICE 'peo_authorizations: withdrawing passed';
END $$;

-- ---------- Only PEOs on the product's list (L-1.1) ----------
-- Break caught: a PEO the product doesn't list (never added, or no longer listed) is authorized, or "any PEO my advisor chooses" gets in as a name; the
-- refusal is not in plain words. The name is matched ignoring case and outer spaces, and the record keeps the list's spelling.
DO $$
DECLARE pid bigint;
BEGIN
  PERFORM pg_temp.intake('i2', 'acme');
  PERFORM pg_temp.is(pg_temp.say('i2', 'Acme PEO', true), '22023: Acme PEO is not on the list of PEOs. Ask your advisor to have it added first.', 'a PEO not on the list');
  PERFORM pg_temp.is(pg_temp.say('i2', 'Any PEO my advisor chooses', true), '22023: Any PEO my advisor chooses is not on the list of PEOs. Ask your advisor to have it added first.', 'no catch-all');
  PERFORM pg_temp.is(pg_temp.say('i2', '   ', true), '22023: Name the PEO.', 'no PEO named');
  SELECT id INTO pid FROM public.peos WHERE name = 'Rippling';
  UPDATE public.peos SET listed = false WHERE id = pid;
  PERFORM pg_temp.is(pg_temp.say('i2', 'Rippling', true), '22023: Rippling is not on the list of PEOs. Ask your advisor to have it added first.', 'a PEO no longer listed');
  UPDATE public.peos SET listed = true WHERE id = pid;
  PERFORM pg_temp.is(pg_temp.say('i2', '  justWORKS ', true), 'ok', 'a listed PEO in other capitals and spaces');
  PERFORM pg_temp.is((SELECT peo_name FROM public.peo_authorizations WHERE session_id = pg_temp.id('i2')), 'Justworks', 'the record keeps the list''s spelling');
  PERFORM pg_temp.is(public.peo_authorized(pg_temp.id('i2'), ' JUSTWORKS  '), true, 'and the check matches ignoring case and outer spaces');
  PERFORM pg_temp.is((SELECT count(*) FROM public.peo_authorizations WHERE session_id = pg_temp.id('i2')), 1::bigint, 'nothing was recorded for the refusals');
  RAISE NOTICE 'peo_authorizations: the list passed';
END $$;

-- ---------- Only the employer writes it ----------
-- Break caught: a member of the intake's firm, another firm's member, another employer, someone with no firm or a signed-out caller authorizes or
-- withdraws a PEO for an employer; a refused attempt still leaves a row.
DO $$
DECLARE who text;
BEGIN
  PERFORM pg_temp.intake('i3', 'acme');
  PERFORM pg_temp.intake('other', 'acme');
  FOREACH who IN ARRAY ARRAY['acme_owner', 'acme_agent', 'zenith_owner', 'nobody', 'p_other'] LOOP
    PERFORM pg_temp.is(pg_temp.say_as(who, 'i3', 'TriNet', true), '42501: Only the employer can choose who receives their packet.', who || ' authorizing for the employer');
    PERFORM pg_temp.is(pg_temp.say_as(who, 'i3', 'TriNet', false), '42501: Only the employer can choose who receives their packet.', who || ' withdrawing for the employer');
  END LOOP;
  PERFORM pg_temp.is(pg_temp.say_as('anon', 'i3', 'TriNet', true), '42501: permission denied for function set_peo_authorization', 'a signed-out caller');
  PERFORM pg_temp.is(pg_temp.say_as('p_i3', 'other', 'TriNet', true), '42501: Only the employer can choose who receives their packet.', 'an employer on another employer''s intake');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.set_peo_authorization(%L, ''TriNet'', true, public.peo_authorization_version(), ''x'')', gen_random_uuid())),
    '42501: Only the employer can choose who receives their packet.', 'an intake that does not exist, as the superuser with no one signed in');
  PERFORM pg_temp.is((SELECT count(*) FROM public.peo_authorizations WHERE session_id IN (pg_temp.id('i3'), pg_temp.id('other'))), 0::bigint, 'none of them left a row');
  RAISE NOTICE 'peo_authorizations: only the employer passed';
END $$;

-- ---------- The wording and its version, who signed and when ----------
-- Break caught: an authorization is recorded against wording the page no longer shows (an older version), or with no wording at all; the row does
-- not keep the exact wording, its version, who signed or when the server received it (a time from the browser would be trusted).
DO $$
DECLARE r public.peo_authorizations;
BEGIN
  PERFORM pg_temp.intake('i4', 'acme');
  PERFORM pg_temp.as_user('p_i4');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.set_peo_authorization(%L, 'TriNet', true, '2026-01-draft-0', 'I authorize TriNet.')$q$, pg_temp.id('i4'))),
    'EA005: This wording is out of date. Reload the page to read the current version.', 'an older wording''s version');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.set_peo_authorization(%L, 'TriNet', true, public.peo_authorization_version(), '   ')$q$, pg_temp.id('i4'))),
    '22023: The wording shown is required (1 to 20000 characters).', 'no wording');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.set_peo_authorization(%L, 'TriNet', NULL, public.peo_authorization_version(), 'x')$q$, pg_temp.id('i4'))),
    '22023: Say whether the PEO may receive your packet.', 'neither authorize nor withdraw');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*) FROM public.peo_authorizations WHERE session_id = pg_temp.id('i4')), 0::bigint, 'nothing recorded for those');
  PERFORM pg_temp.is(pg_temp.say('i4', 'TriNet', true), 'ok', 'the wording in force');
  SELECT * INTO r FROM public.peo_authorizations WHERE session_id = pg_temp.id('i4');
  PERFORM pg_temp.is(r.wording_version, public.peo_authorization_version(), 'the row keeps the version');
  PERFORM pg_temp.is(r.wording_text, 'I authorize TriNet to receive my packet.', 'and the exact wording');
  PERFORM pg_temp.is(r.signed_by, pg_temp.id('p_i4'), 'and who signed');
  PERFORM pg_temp.is(r.signed_at, now(), 'and when the server received it');
  RAISE NOTICE 'peo_authorizations: the wording passed';
END $$;

-- ---------- Never updated or deleted, even by the table's owner ----------
-- Break caught: a row is edited or deleted after it is written, by the employer, a firm member or the database owner itself, so what was signed can be
-- rewritten; an API role writes the table directly instead of through the function.
DO $$
DECLARE who text;
BEGIN
  PERFORM pg_temp.is(pg_temp.refusal(format('UPDATE public.peo_authorizations SET authorized = false WHERE session_id = %L', pg_temp.id('i4'))),
    '42501: peo_authorizations records cannot be changed or deleted', 'the owner updating a row');
  PERFORM pg_temp.is(pg_temp.refusal(format('DELETE FROM public.peo_authorizations WHERE session_id = %L', pg_temp.id('i4'))),
    '42501: peo_authorizations records cannot be changed or deleted', 'the owner deleting a row');
  FOREACH who IN ARRAY ARRAY['p_i4', 'acme_owner'] LOOP
    PERFORM pg_temp.as_user(who);
    PERFORM pg_temp.is(left(pg_temp.refusal(format('UPDATE public.peo_authorizations SET authorized = false WHERE session_id = %L', pg_temp.id('i4'))), 5), '42501', who || ' updating');
    PERFORM pg_temp.is(left(pg_temp.refusal(format('DELETE FROM public.peo_authorizations WHERE session_id = %L', pg_temp.id('i4'))), 5), '42501', who || ' deleting');
    PERFORM pg_temp.is(left(pg_temp.refusal(format($q$INSERT INTO public.peo_authorizations (session_id, peo_id, peo_name, authorized, wording_version, wording_text, signed_by)
      SELECT %L, id, name, true, 'v', 't', auth.uid() FROM public.peos LIMIT 1$q$, pg_temp.id('i4'))), 5), '42501', who || ' inserting directly');
    PERFORM pg_temp.as_owner();
  END LOOP;
  PERFORM pg_temp.is((SELECT string_agg(authorized::text, ',') FROM public.peo_authorizations WHERE session_id = pg_temp.id('i4')), 'true', 'the row is as it was signed');
  RAISE NOTICE 'peo_authorizations: append-only passed';
END $$;

-- ---------- Deleted with its intake ----------
-- Break caught: deleting an intake is blocked by the append-only rule, or leaves the employer's authorizations behind, or the deletion record does not
-- say how many it removed.
DO $$
DECLARE d uuid; removed jsonb;
BEGIN
  PERFORM pg_temp.intake('gone', 'acme');
  PERFORM pg_temp.say('gone', 'TriNet', true);
  PERFORM pg_temp.say('gone', 'TriNet', false);
  INSERT INTO public.intake_deletions (session_id, user_id, trigger, reason, status, firm_id)
  VALUES (pg_temp.id('gone'), pg_temp.id('p_gone'), 'request', 'the employer asked', 'claimed', pg_temp.id('acme')) RETURNING id INTO d;
  removed := public.complete_intake_deletion(d, 0);
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_sessions WHERE id = pg_temp.id('gone')), 0::bigint, 'the intake is gone');
  PERFORM pg_temp.is((SELECT count(*) FROM public.peo_authorizations WHERE session_id = pg_temp.id('gone')), 0::bigint, 'and its authorizations with it');
  PERFORM pg_temp.is(removed ->> 'peo_authorizations', '2', 'the deletion record counts them');
  RAISE NOTICE 'peo_authorizations: deleted with the intake passed';
END $$;

-- ---------- Certifying again leaves it in place ----------
-- Break caught: an authorization is tied to a packet version, so the employer certifying a new version drops the PEOs they authorized.
CREATE FUNCTION pg_temp.certify(n text, employees integer) RETURNS void LANGUAGE plpgsql AS $$
DECLARE data jsonb := jsonb_build_object('company_name', n, 'states', jsonb_build_array('NY'), 'pay_frequency', 'bi-weekly', 'employee_count', employees, 'start_month', 'April');
BEGIN
  UPDATE public.chamber_sessions SET chamber_data = data WHERE id = pg_temp.id(n);
  UPDATE public.chamber_sessions SET status = 'submitted', submission = jsonb_build_object(
    'signer_name', 'Jo Doe', 'signer_title', 'CEO', 'signed_at', now()::text,
    'consent_version', '2026-10-draft-1', 'consent_text', '["I certify."]'::jsonb, 'chamber_data', data) WHERE id = pg_temp.id(n);
END $$;

DO $$
BEGIN
  PERFORM pg_temp.intake('i5', 'acme');
  PERFORM pg_temp.certify('i5', 12);
  PERFORM pg_temp.say('i5', 'Insperity', true);
  PERFORM pg_temp.certify('i5', 14);
  PERFORM pg_temp.is((SELECT max(version) FROM public.chamber_certifications WHERE session_id = pg_temp.id('i5')), 2, 'setup: the employer certified a second version');
  PERFORM pg_temp.is(public.peo_authorized(pg_temp.id('i5'), 'Insperity'), true, 'Insperity is still authorized after certifying again');
  PERFORM pg_temp.is((SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'peo_authorizations' AND column_name ~ 'version' AND column_name <> 'wording_version'),
    0::bigint, 'the record names no packet version');
  RAISE NOTICE 'peo_authorizations: certifying again passed';
END $$;

-- ---------- Each PEO's current state ----------
-- Break caught: the screens can't tell which PEOs the employer authorized, withdrew or never answered; a PEO withdrawn reads as never asked; a PEO no
-- longer listed that the employer had authorized disappears from what they see; the list is not alphabetical.
CREATE FUNCTION pg_temp.states(who text, n text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  PERFORM pg_temp.as_user(who, CASE WHEN who LIKE 'acme%' THEN 'acme-brokers' WHEN who LIKE 'zenith%' THEN 'zenith-benefits' END);
  BEGIN
    SELECT string_agg(s.peo || ':' || s.state, ' ' ORDER BY s.peo) INTO r FROM public.peo_authorization_states(pg_temp.id(n)) s;
  EXCEPTION WHEN OTHERS THEN r := SQLSTATE || ': ' || SQLERRM;
  END;
  PERFORM pg_temp.as_owner();
  RETURN r;
END $$;

DO $$
BEGIN
  PERFORM pg_temp.intake('i6', 'acme');
  PERFORM pg_temp.say('i6', 'TriNet', true);
  PERFORM pg_temp.say('i6', 'Justworks', true);
  PERFORM pg_temp.say('i6', 'Justworks', false);
  PERFORM pg_temp.is(pg_temp.states('p_i6', 'i6'),
    'ADP TotalSource:not_asked Insperity:not_asked Justworks:withdrawn Rippling:not_asked TriNet:authorized', 'the employer reads each listed PEO''s state');
  UPDATE public.peos SET listed = false WHERE name = 'TriNet';
  PERFORM pg_temp.is(pg_temp.states('p_i6', 'i6'),
    'ADP TotalSource:not_asked Insperity:not_asked Justworks:withdrawn Rippling:not_asked TriNet:authorized', 'a PEO no longer listed that has a record still shows');
  UPDATE public.peos SET listed = false WHERE name = 'Rippling';
  PERFORM pg_temp.is(pg_temp.states('p_i6', 'i6'),
    'ADP TotalSource:not_asked Insperity:not_asked Justworks:withdrawn TriNet:authorized', 'and one no longer listed with no record is not offered');
  UPDATE public.peos SET listed = true WHERE name IN ('TriNet', 'Rippling');
  PERFORM pg_temp.as_user('p_i6');
  PERFORM pg_temp.is((SELECT signed_at IS NOT NULL AND wording_version = public.peo_authorization_version() FROM public.peo_authorization_states(pg_temp.id('i6')) WHERE peo = 'TriNet'),
    true, 'each state says when and under which wording');
  PERFORM pg_temp.as_owner();
  RAISE NOTICE 'peo_authorizations: the current state passed';
END $$;

-- ---------- Who reads the state ----------
-- Break caught: another firm's member, a person in no firm or another employer reads which PEOs an employer chose (the function runs as its owner, so
-- row security does not stop it); the intake's own firm's members are refused it, so the advisor can't see who may receive the packet.
DO $$
DECLARE who text; want constant text := 'ADP TotalSource:not_asked Insperity:not_asked Justworks:withdrawn Rippling:not_asked TriNet:authorized';
BEGIN
  PERFORM pg_temp.is(pg_temp.states('acme_owner', 'i6'), want, 'the firm''s owner reads it');
  PERFORM pg_temp.is(pg_temp.states('acme_agent', 'i6'), want, 'and its agent');
  FOREACH who IN ARRAY ARRAY['zenith_owner', 'nobody', 'p_other'] LOOP
    PERFORM pg_temp.is(pg_temp.states(who, 'i6'), 'PT404: Submission not found', who || ' reading another''s state');
  END LOOP;
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT count(*) FROM public.peo_authorization_states(%L)', pg_temp.id('i6'))),
    '42501: permission denied for function peo_authorization_states', 'a signed-out caller');
  PERFORM pg_temp.as_owner();
  RAISE NOTICE 'peo_authorizations: who reads the state passed';
END $$;

-- ---------- The guard other slices call ----------
-- Break caught: assert_peo_authorized lets through a PEO never authorized or one withdrawn, or refuses one that is authorized; its refusal is not in plain
-- words (or does not say which of the two it was); the PEO is not matched ignoring case and outer spaces.
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.assert_peo_authorized(%L, ' trinet ')$q$, pg_temp.id('i6'))), 'ok', 'an authorized PEO passes');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.assert_peo_authorized(%L, 'Insperity')$q$, pg_temp.id('i6'))),
    '22023: The employer hasn''t authorized Insperity to receive their packet. Ask them to add it.', 'a PEO never authorized');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.assert_peo_authorized(%L, 'justworks')$q$, pg_temp.id('i6'))),
    '22023: The employer withdrew Justworks. Nothing more can be sent to it.', 'a PEO withdrawn');
  RAISE NOTICE 'peo_authorizations: the guard passed';
END $$;

-- ---------- Neither check is the API's ----------
-- Break caught: anyone signed in (or signed out) can ask whether an employer authorized a PEO, by guessing intake ids; the checks are the database's own,
-- for the functions that send.
DO $$
DECLARE who text;
BEGIN
  FOREACH who IN ARRAY ARRAY['p_i6', 'acme_owner', 'nobody', 'anon'] LOOP
    IF who = 'anon' THEN PERFORM pg_temp.as_anon(); ELSE PERFORM pg_temp.as_user(who); END IF;
    PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.peo_authorized(%L, 'TriNet')$q$, pg_temp.id('i6'))),
      '42501: permission denied for function peo_authorized', who || ' asking peo_authorized');
    PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.assert_peo_authorized(%L, 'TriNet')$q$, pg_temp.id('i6'))),
      '42501: permission denied for function assert_peo_authorized', who || ' asking assert_peo_authorized');
    PERFORM pg_temp.as_owner();
  END LOOP;
  PERFORM pg_temp.is(has_function_privilege('service_role', 'public.peo_authorized(uuid, text)', 'EXECUTE'), false, 'nor the service role');
  RAISE NOTICE 'peo_authorizations: the checks are not the API''s passed';
END $$;

-- ---------- No send recorded without a live authorization ----------
-- Break caught: an advisor records a send by hand (advisor_record_quote_send) to a PEO the employer never authorized, or withdrew; the database leaves it
-- to the screen. A refused send makes no quote request and moves nothing.
CREATE FUNCTION pg_temp.send(who text, n text, peo text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  PERFORM pg_temp.as_user(who, CASE WHEN who LIKE 'acme%' THEN 'acme-brokers' WHEN who LIKE 'zenith%' THEN 'zenith-benefits' END);
  r := pg_temp.refusal(format('SELECT public.advisor_record_quote_send(%L, %L, NULL)', pg_temp.id(n), peo));
  PERFORM pg_temp.as_owner();
  RETURN r;
END $$;

DO $$
BEGIN
  PERFORM pg_temp.ready('s1', 'acme');
  PERFORM pg_temp.is(pg_temp.send('acme_owner', 's1', 'TriNet'), '22023: The employer hasn''t authorized TriNet to receive their packet. Ask them to add it.', 'a send to a PEO never authorized');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quote_requests WHERE session_id = pg_temp.id('s1')), 0::bigint, 'made no quote request');
  PERFORM pg_temp.is((SELECT status FROM public.submission_workflow WHERE session_id = pg_temp.id('s1')), 'ready_for_market', 'and moved nothing');
  PERFORM pg_temp.say('s1', 'TriNet', true);
  PERFORM pg_temp.is(pg_temp.send('acme_owner', 's1', ' trinet '), 'ok', 'once authorized, the send is recorded');
  PERFORM pg_temp.say('s1', 'Insperity', true);
  PERFORM pg_temp.say('s1', 'Insperity', false);
  PERFORM pg_temp.is(pg_temp.send('acme_agent', 's1', 'Insperity'), '22023: The employer withdrew Insperity. Nothing more can be sent to it.', 'a send to a PEO withdrawn');
  RAISE NOTICE 'peo_authorizations: no send without one passed';
END $$;

-- ---------- Quote requests recorded before this shipped ----------
-- Break caught: shipping this closes, or hides, a quote request recorded before any authorization existed; or a further send to that PEO goes through
-- with no authorization because a quote request is already open.
DO $$
DECLARE q bigint;
BEGIN
  PERFORM pg_temp.ready('before', 'acme');
  -- As it was recorded before this migration: no authorization behind it.
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_on) VALUES (pg_temp.id('before'), 'Justworks', 'quoted', '2026-11-01') RETURNING id INTO q;
  PERFORM pg_temp.is((SELECT status FROM public.quote_requests WHERE id = q), 'quoted', 'the earlier quote request stays as it was');
  PERFORM pg_temp.is(pg_temp.send('acme_owner', 'before', 'Justworks'), '22023: The employer hasn''t authorized Justworks to receive their packet. Ask them to add it.',
    'a further send to that PEO is refused');
  PERFORM pg_temp.say('before', 'Justworks', true);
  PERFORM pg_temp.is(pg_temp.send('acme_owner', 'before', 'Justworks'), 'ok', 'until the employer authorizes it');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quote_requests WHERE session_id = pg_temp.id('before')), 1::bigint, 'on the same quote request');
  RAISE NOTICE 'peo_authorizations: earlier quote requests passed';
END $$;

-- ---------- Withdrawing a PEO already sent to ----------
-- Break caught: withdrawing a PEO the packet already went to leaves its quote request open (so a quote could still be recorded on it, and the advisor
-- would never know); the submission is not marked Needs advisor action, or the note does not name the PEO; the product sends the PEO something.
DO $$
DECLARE q bigint; outbox_before bigint;
BEGIN
  PERFORM pg_temp.ready('w1', 'acme');
  PERFORM pg_temp.say('w1', 'TriNet', true);
  PERFORM pg_temp.send('acme_owner', 'w1', 'TriNet');
  SELECT id INTO q FROM public.quote_requests WHERE session_id = pg_temp.id('w1') AND peo_name = 'TriNet';
  outbox_before := (SELECT count(*) FROM public.outbox_events);
  PERFORM pg_temp.is(pg_temp.say('w1', 'TriNet', false), 'ok', 'the employer withdraws TriNet after it was sent to');
  PERFORM pg_temp.is((SELECT status FROM public.quote_requests WHERE id = q), 'closed', 'its quote request is closed');
  PERFORM pg_temp.is((SELECT needs_action FROM public.submission_workflow WHERE session_id = pg_temp.id('w1')), true, 'the submission needs advisor action');
  PERFORM pg_temp.is((SELECT needs_action_note FROM public.submission_workflow WHERE session_id = pg_temp.id('w1')),
    'The employer withdrew TriNet. Tell TriNet not to use the packet; nothing was sent to it.', 'naming the PEO');
  PERFORM pg_temp.is((SELECT count(*) FROM public.outbox_events), outbox_before, 'and nothing is queued to send');
  PERFORM pg_temp.is((SELECT changed_by FROM public.quote_request_events WHERE quote_request_id = q AND field = 'status' AND new_value = 'closed'), pg_temp.id('p_w1'),
    'the closing is logged like any change, as the employer''s');
  RAISE NOTICE 'peo_authorizations: withdrawing after a send passed';
END $$;

-- ---------- A won quote is kept ----------
-- Break caught: the employer withdrawing the PEO whose quote the submission was won with closes that quote request, so the win names a closed quote and
-- the placement loses its quote; or the advisor is not told.
DO $$
DECLARE q bigint;
BEGIN
  PERFORM pg_temp.ready('won', 'acme');
  PERFORM pg_temp.say('won', 'Insperity', true);
  PERFORM pg_temp.send('acme_owner', 'won', 'Insperity');
  SELECT id INTO q FROM public.quote_requests WHERE session_id = pg_temp.id('won');
  UPDATE public.quote_requests SET status = 'quoted', admin_fee_pepm = 120 WHERE id = q;
  UPDATE public.submission_workflow SET status = 'won', won_quote_request_id = q WHERE session_id = pg_temp.id('won');
  PERFORM pg_temp.is(pg_temp.say('won', 'Insperity', false), 'ok', 'the employer withdraws the PEO they went with');
  PERFORM pg_temp.is((SELECT status FROM public.quote_requests WHERE id = q), 'quoted', 'the won quote is kept');
  PERFORM pg_temp.is((SELECT won_quote_request_id FROM public.submission_workflow WHERE session_id = pg_temp.id('won')), q, 'and still names the win');
  PERFORM pg_temp.is((SELECT needs_action_note FROM public.submission_workflow WHERE session_id = pg_temp.id('won')),
    'The employer withdrew Insperity, whose quote they took. The quote is kept; talk to the employer.', 'the advisor is told');
  RAISE NOTICE 'peo_authorizations: a won quote passed';
END $$;

-- ---------- Withdrawing a PEO never sent to ----------
-- Break caught: withdrawing a PEO the packet never went to (or whose quote request is already closed) raises Needs advisor action with nothing to tell
-- anyone, or overwrites a note an advisor wrote.
DO $$
BEGIN
  PERFORM pg_temp.ready('w2', 'acme');
  PERFORM pg_temp.say('w2', 'Rippling', true);
  PERFORM pg_temp.say('w2', 'Rippling', false);
  PERFORM pg_temp.is((SELECT needs_action FROM public.submission_workflow WHERE session_id = pg_temp.id('w2')), false, 'never sent to: nothing to tell');
  PERFORM pg_temp.say('w2', 'TriNet', true);
  PERFORM pg_temp.send('acme_owner', 'w2', 'TriNet');
  UPDATE public.quote_requests SET status = 'closed' WHERE session_id = pg_temp.id('w2');
  PERFORM pg_temp.say('w2', 'TriNet', false);
  PERFORM pg_temp.is((SELECT needs_action FROM public.submission_workflow WHERE session_id = pg_temp.id('w2')), false, 'already closed: nothing to tell');
  RAISE NOTICE 'peo_authorizations: withdrawing a PEO never sent to passed';
END $$;

-- ---------- Saying the same again, and withdrawing what was never given ----------
-- Break caught: a second click on a box already ticked appends a second authorization (so the record reads as two signings); a withdrawal of a PEO the
-- employer never authorized is recorded as if something had been withdrawn.
DO $$
DECLARE before bigint;
BEGIN
  PERFORM pg_temp.intake('i7', 'acme');
  PERFORM pg_temp.say('i7', 'TriNet', true);
  before := (SELECT count(*) FROM public.peo_authorizations WHERE session_id = pg_temp.id('i7'));
  PERFORM pg_temp.is(pg_temp.say('i7', 'TriNet', true), 'ok', 'authorizing an authorized PEO again is fine');
  PERFORM pg_temp.is((SELECT count(*) FROM public.peo_authorizations WHERE session_id = pg_temp.id('i7')), before, 'and appends nothing');
  PERFORM pg_temp.is(pg_temp.say('i7', 'Insperity', false), '22023: Insperity is not authorized, so there is nothing to withdraw.', 'withdrawing a PEO never authorized');
  PERFORM pg_temp.say('i7', 'TriNet', false);
  PERFORM pg_temp.is(pg_temp.say('i7', 'TriNet', false), '22023: TriNet is not authorized, so there is nothing to withdraw.', 'withdrawing it twice');
  PERFORM pg_temp.is((SELECT count(*) FROM public.peo_authorizations WHERE session_id = pg_temp.id('i7')), before + 1, 'only the one withdrawal is recorded');
  RAISE NOTICE 'peo_authorizations: saying the same again passed';
END $$;

-- ---------- Who reads the record ----------
-- Break caught: the intake's firm can't read what the employer signed (it is kept like intake_consents, to be shown in a dispute); the employer can't
-- read their own; another firm, a person in no firm or another employer reads it.
CREATE FUNCTION pg_temp.rows_seen(who text, n text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  PERFORM pg_temp.as_user(who, CASE WHEN who LIKE 'acme%' THEN 'acme-brokers' WHEN who LIKE 'zenith%' THEN 'zenith-benefits' END);
  BEGIN
    EXECUTE format('SELECT count(*)::text FROM public.peo_authorizations WHERE session_id = %L', pg_temp.id(n)) INTO r;
  EXCEPTION WHEN insufficient_privilege THEN r := 'denied';
  END;
  PERFORM pg_temp.as_owner();
  RETURN r;
END $$;

DO $$
DECLARE who text;
BEGIN
  PERFORM pg_temp.is(pg_temp.rows_seen('p_i7', 'i7'), '2', 'the employer reads their own');
  PERFORM pg_temp.is(pg_temp.rows_seen('acme_owner', 'i7'), '2', 'the firm''s owner reads them');
  PERFORM pg_temp.is(pg_temp.rows_seen('acme_agent', 'i7'), '2', 'and its agent');
  FOREACH who IN ARRAY ARRAY['zenith_owner', 'nobody', 'p_other'] LOOP
    PERFORM pg_temp.is(pg_temp.rows_seen(who, 'i7'), '0', who || ' reads none');
  END LOOP;
  RAISE NOTICE 'peo_authorizations: who reads the record passed';
END $$;

--CYCLES--

SELECT 'peo_authorizations: all cases passed' AS result;
