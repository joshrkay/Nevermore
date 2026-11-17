-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh quote_offer
-- A quote that holds the whole offer (N-2.1, slice 7.2; docs/BROKER_CRM_BUILD.md D-720 to D-729; 20261124140000_quote_offer.sql). One row of `quotes` for each quote a
-- PEO returned on a quote request: the administrative fee and its basis, one-off fees, workers' comp rates by state and class code, unemployment tax by state, medical
-- rates by plan and tier, an expiry and a proposed start, marked an estimate or a firm offer. A cost area a quote leaves out is absent, never zero. Two firms.
-- Every migration is loaded, in filename order (D-105), this slice's last.
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

-- The employer's say over a PEO (M-1.1, slice 6.6a's peo_authorizations), recorded as the superuser: an appended row, authorized or withdrawn.
CREATE FUNCTION pg_temp.authorize(intake text, peo text, yes boolean) RETURNS void LANGUAGE plpgsql AS $$
DECLARE pid bigint;
BEGIN
  SELECT p.id INTO pid FROM public.peos p WHERE lower(p.name) = lower(peo);
  IF pid IS NULL THEN INSERT INTO public.peos (name) VALUES (peo) RETURNING id INTO pid; END IF;
  INSERT INTO public.peo_authorizations (session_id, peo_id, peo_name, authorized, wording_version, wording_text, signed_by)
  SELECT s.id, pid, peo, yes, 'draft-1', 'I authorize this PEO to receive my packet.', s.user_id FROM public.chamber_sessions s WHERE s.id = pg_temp.id(intake);
END $$;

-- A connected mailbox, placed as the superuser (the mailbox function stores it; the token is opaque here).
CREATE FUNCTION pg_temp.mailbox(p_user text, p_address text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.broker_mailboxes (user_id, provider, address, scope, token_ciphertext, token_iv)
  VALUES (pg_temp.id(p_user), 'google', p_address, 'https://www.googleapis.com/auth/gmail.send', 'sealed', 'iv')
$$;

CREATE FUNCTION pg_temp.fmove(intake text, to_status text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE from_status text;
BEGIN
  SELECT w.status INTO from_status FROM public.submission_workflow w WHERE w.session_id = pg_temp.id(intake);
  UPDATE public.submission_workflow SET status = to_status WHERE session_id = pg_temp.id(intake);
  INSERT INTO public.submission_status_history (session_id, from_status, to_status) VALUES (pg_temp.id(intake), from_status, to_status);
END $$;

-- An intake of a firm at Ready for market, on an opportunity of an account of its firm (CRM-Q1.1).
CREATE FUNCTION pg_temp.intake(n text, firm text, company text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := pg_temp.new_user('p_' || n); sid uuid;
BEGIN
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, jsonb_build_object('company_name', company)) RETURNING id INTO sid;
  UPDATE public.chamber_sessions SET firm_id = pg_temp.id(firm) WHERE id = sid;
  WITH a AS (INSERT INTO public.accounts (source, firm_id, name) VALUES ('added_by_hand', pg_temp.id(firm), company) RETURNING id, firm_id)
  INSERT INTO public.opportunities (firm_id, account_id, name, intake_id) SELECT a.firm_id, a.id, company || ' – PEO search', sid FROM a;
  INSERT INTO fx VALUES (n, sid);
  PERFORM pg_temp.fmove(n, 'submitted');
  PERFORM pg_temp.fmove(n, 'under_review');
  PERFORM pg_temp.fmove(n, 'ready_for_market');
  RETURN sid;
END $$;

-- A certification of an intake, as the superuser with its triggers off: version v, the File ID; any earlier one superseded.
CREATE FUNCTION pg_temp.certify(n text, v integer, p_file_id text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);
  UPDATE public.chamber_certifications SET superseded_at = now(), superseded_reason = 'recertified' WHERE session_id = pg_temp.id(n) AND superseded_at IS NULL;
  INSERT INTO public.chamber_certifications (session_id, user_id, signer_name, signer_title, consent_version, consent_text, signed_at, data_sha256, file_id, version, chamber_data)
  SELECT s.id, s.user_id, 'Lucia Reyes', 'Owner', 'v1', 'I certify.', now(), 'h' || v, p_file_id, v, s.chamber_data
  FROM public.chamber_sessions s WHERE s.id = pg_temp.id(n);
  PERFORM set_config('session_replication_role', 'origin', true);
END $$;

-- The prospect changed an answer after certifying: the certification no longer covers the answers (record_certification's 'data_changed').
CREATE FUNCTION pg_temp.answer_changed(n text) RETURNS void LANGUAGE sql AS $$
  UPDATE public.chamber_certifications SET superseded_at = now(), superseded_reason = 'data_changed' WHERE session_id = pg_temp.id(n) AND superseded_at IS NULL
$$;

-- A whole send as Acme's agent: send_to_peo, the bundle link issued for the version sent, joined to the message. Answers {message_id, quote_request_id,
-- link_id}.
CREATE FUNCTION pg_temp.sent(intake text, peo text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb; l jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  r := public.send_to_peo(pg_temp.id(intake), peo, ARRAY['dana@' || lower(peo) || '.example'], 'Reyes Bakery: EAA-2026-0042', 'Dana, here is Reyes Bakery.');
  l := public.issue_bundle_link((r ->> 'quote_request_id')::bigint,
         (SELECT sent_version FROM public.quote_requests WHERE id = (r ->> 'quote_request_id')::bigint), gen_random_uuid(),
         '[{"name": "packet.pdf", "what": "The packet"}]'::jsonb, '[]'::jsonb);
  PERFORM public.attach_peo_link((r ->> 'message_id')::bigint, (l ->> 'id')::bigint, l ->> 'token');
  PERFORM pg_temp.as_owner();
  RETURN r || jsonb_build_object('link_id', l -> 'id');
END $$;

-- ---------- set up: two firms; Acme's agent with a mailbox; Reyes Bakery certified and sent to Insperity, TriNet and Justworks ----------
DO $$
DECLARE acme uuid; zenith uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Acme Brokers', 'acme-brokers', now()) RETURNING id INTO acme;
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Zenith Benefits', 'zenith-benefits', now()) RETURNING id INTO zenith;
  INSERT INTO fx VALUES ('acme', acme), ('zenith', zenith);
  PERFORM pg_temp.new_user('acme_agent'); PERFORM pg_temp.new_user('zenith_agent');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES
    (acme, pg_temp.id('acme_agent'), 'agent'), (zenith, pg_temp.id('zenith_agent'), 'agent');
  PERFORM pg_temp.mailbox('acme_agent', 'sam@acme.example');
  PERFORM pg_temp.intake('reyes', 'acme', 'Reyes Bakery');
  PERFORM pg_temp.certify('reyes', 1, 'EAA-2026-0042');
  PERFORM pg_temp.authorize('reyes', 'Insperity', true);
  PERFORM pg_temp.authorize('reyes', 'TriNet', true);
  PERFORM pg_temp.authorize('reyes', 'Justworks', true);
  PERFORM pg_temp.sent('reyes', 'Insperity');
  PERFORM pg_temp.sent('reyes', 'TriNet');
  PERFORM pg_temp.sent('reyes', 'Justworks');
END $$;

CREATE FUNCTION pg_temp.qr(peo text) RETURNS bigint LANGUAGE sql AS $$
  SELECT id FROM public.quote_requests WHERE session_id = pg_temp.id('reyes') AND peo_name = peo $$;

-- ---------- 1. An agent records a quote with its administrative fee and the basis it is charged on ----------
-- Catches: a quote that keeps one bare number with no basis, so $42.50 per employee per month and 4.2% of payroll can't be told apart.
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  r := public.record_quote(p_quote_request_id => pg_temp.qr('Insperity'), p_kind => 'firm_offer', p_admin_fee => 42.5, p_admin_fee_basis => 'per_employee_per_month');
  PERFORM pg_temp.is(r ->> 'kind', 'firm_offer', 'the answer is the quote');
  PERFORM pg_temp.is((SELECT q.admin_fee FROM public.quotes q WHERE q.id = (r ->> 'id')::bigint), 42.5::numeric, 'the fee');
  PERFORM pg_temp.is((SELECT q.admin_fee_basis FROM public.quotes q WHERE q.id = (r ->> 'id')::bigint), 'per_employee_per_month', 'and its basis');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 2. Recording a quote keeps the quote request's own figures in step ----------
-- Catches: a quote recorded here that leaves the quotes table, the opportunity page and "Mark quoted" showing another status, dates or per-month fee than the quote holds.
DO $$
DECLARE r jsonb; qr public.quote_requests;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  r := public.record_quote(p_quote_request_id => pg_temp.qr('TriNet'), p_kind => 'estimate', p_received_on => current_date, p_expires_on => current_date + 30,
    p_start_on => current_date + 45, p_admin_fee => 38, p_admin_fee_basis => 'per_employee_per_month', p_note => 'By phone');
  PERFORM pg_temp.as_owner();
  SELECT * INTO qr FROM public.quote_requests WHERE id = pg_temp.qr('TriNet');
  PERFORM pg_temp.is(qr.status, 'quoted', 'the quote request is quoted');
  PERFORM pg_temp.is(qr.quote_received_on, current_date, 'received');
  PERFORM pg_temp.is(qr.quote_expires_on, current_date + 30, 'expires');
  PERFORM pg_temp.is(qr.proposed_start_on, current_date + 45, 'proposed start');
  PERFORM pg_temp.is(qr.admin_fee_pepm, 38::numeric, 'the per-month fee');
  PERFORM pg_temp.is(qr.note, 'By phone', 'the note');
  PERFORM pg_temp.is((SELECT q.expires_on FROM public.quotes q WHERE q.id = (r ->> 'id')::bigint), current_date + 30, 'and the quote holds the same expiry');
END $$;

-- ---------- 3. A fee that is a percent of payroll is not stored as a per-month fee on the quote request ----------
-- Catches: 4.2 (percent) written into quote_requests.admin_fee_pepm, so the quotes table shows "$4.20 per employee per month" for a percent-of-payroll quote.
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  r := public.record_quote(p_quote_request_id => pg_temp.qr('Justworks'), p_kind => 'estimate', p_admin_fee => 4.2, p_admin_fee_basis => 'percent_of_payroll');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT q.admin_fee FROM public.quotes q WHERE q.id = (r ->> 'id')::bigint), 4.2::numeric, 'the quote holds 4.2');
  PERFORM pg_temp.is((SELECT q.admin_fee_basis FROM public.quotes q WHERE q.id = (r ->> 'id')::bigint), 'percent_of_payroll', 'as a percent of payroll');
  PERFORM pg_temp.is((SELECT x.admin_fee_pepm IS NULL FROM public.quote_requests x WHERE x.id = pg_temp.qr('Justworks')), true, 'the quote request has no per-month fee');
  PERFORM pg_temp.is((SELECT x.status FROM public.quote_requests x WHERE x.id = pg_temp.qr('Justworks')), 'quoted', 'but is quoted');
END $$;

-- A second employer, Bella Cafe, sent to Paychex, Oasis and Rippling: nothing quoted yet.
DO $$
BEGIN
  PERFORM pg_temp.intake('bella', 'acme', 'Bella Cafe');
  PERFORM pg_temp.certify('bella', 1, 'EAA-2026-0044');
  PERFORM pg_temp.authorize('bella', 'Paychex', true);
  PERFORM pg_temp.authorize('bella', 'Oasis', true);
  PERFORM pg_temp.authorize('bella', 'Rippling', true);
  PERFORM pg_temp.sent('bella', 'Paychex');
  PERFORM pg_temp.sent('bella', 'Oasis');
  PERFORM pg_temp.sent('bella', 'Rippling');
END $$;
CREATE FUNCTION pg_temp.bqr(peo text) RETURNS bigint LANGUAGE sql AS $$
  SELECT id FROM public.quote_requests WHERE session_id = pg_temp.id('bella') AND peo_name = peo $$;
CREATE FUNCTION pg_temp.bstatus(peo text) RETURNS text LANGUAGE sql AS $$ SELECT status FROM public.quote_requests WHERE id = pg_temp.bqr(peo) $$;
CREATE FUNCTION pg_temp.nquotes(qr bigint) RETURNS bigint LANGUAGE sql AS $$ SELECT count(*) FROM public.quotes WHERE quote_request_id = qr $$;

-- ---------- 4. A quote is marked an estimate or a firm offer, and nothing else ----------
-- Catches: a quote with no mark, or an invented one, so the comparison can't say which figures a PEO stands behind.
DO $$
DECLARE k text;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  FOREACH k IN ARRAY ARRAY['guess', ''] LOOP
    PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.record_quote(p_quote_request_id => %s, p_kind => %L, p_admin_fee => 40, p_admin_fee_basis => 'per_employee_per_month')$s$, pg_temp.bqr('Paychex'), k)),
      '22023: A quote is marked an estimate or a firm offer', 'kind ' || k);
  END LOOP;
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.record_quote(p_quote_request_id => %s, p_kind => NULL, p_admin_fee => 40, p_admin_fee_basis => 'per_employee_per_month')$s$, pg_temp.bqr('Paychex'))),
    '22023: A quote is marked an estimate or a firm offer', 'no kind');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.bstatus('Paychex'), 'sent', 'the quote request did not move');
  PERFORM pg_temp.is(pg_temp.nquotes(pg_temp.bqr('Paychex')), 0::bigint, 'and holds no quote');
END $$;

-- ---------- 5. The table itself refuses a kind that is not an estimate or a firm offer ----------
-- Catches: a second writer (a later function, a repair script) storing a quote with an invented mark; the table is the last line, not only record_quote.
DO $$
BEGIN
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($s$INSERT INTO public.quotes (quote_request_id, session_id, kind) VALUES (%s, pg_temp.id('bella'), 'guess')$s$, pg_temp.bqr('Oasis'))), ':', 1),
    '23514', 'an invented kind');
END $$;

-- ---------- 6. An administrative fee and its basis come together ----------
-- Catches: a fee with no basis (is 40 per head per month, or 40 percent?), and a basis with no fee, both recorded and then compared as if they meant something.
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.record_quote(p_quote_request_id => %s, p_kind => 'estimate', p_admin_fee => 40)$s$, pg_temp.bqr('Paychex'))),
    '22023: An administrative fee comes with its basis: per employee per month, or percent of payroll', 'a fee with no basis');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.record_quote(p_quote_request_id => %s, p_kind => 'estimate', p_admin_fee_basis => 'percent_of_payroll')$s$, pg_temp.bqr('Paychex'))),
    '22023: An administrative fee comes with its basis: per employee per month, or percent of payroll', 'a basis with no fee');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.record_quote(p_quote_request_id => %s, p_kind => 'estimate', p_admin_fee => 40, p_admin_fee_basis => 'weekly')$s$, pg_temp.bqr('Paychex'))),
    '22023: An administrative fee comes with its basis: per employee per month, or percent of payroll', 'a basis that is neither');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.bstatus('Paychex'), 'sent', 'nothing moved');
END $$;

-- ---------- 7. The table refuses a fee with no basis, a basis with no fee and a basis that is neither ----------
-- Catches: the rule held only in record_quote, so any other writer stores a fee nobody can read.
DO $$
DECLARE v text;
BEGIN
  FOREACH v IN ARRAY ARRAY['40, NULL', 'NULL, ''percent_of_payroll''', '40, ''weekly'''] LOOP
    PERFORM pg_temp.is(split_part(pg_temp.refusal(format($s$INSERT INTO public.quotes (quote_request_id, session_id, kind, admin_fee, admin_fee_basis) VALUES (%s, pg_temp.id('bella'), 'estimate', %s)$s$, pg_temp.bqr('Oasis'), v)), ':', 1),
      '23514', 'fee, basis: ' || v);
  END LOOP;
END $$;

-- ---------- 8. The fee has bounds that depend on its basis ----------
-- Catches: a percent of payroll over 100 (a typo for 4.2 as 420), a negative fee, and a per-month fee beyond any real one.
DO $$
DECLARE v text;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  FOREACH v IN ARRAY ARRAY['-1|per_employee_per_month', '100001|per_employee_per_month', '100.01|percent_of_payroll', '-0.5|percent_of_payroll'] LOOP
    PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.record_quote(p_quote_request_id => %s, p_kind => 'estimate', p_admin_fee => %s, p_admin_fee_basis => %L)$s$, pg_temp.bqr('Paychex'), split_part(v, '|', 1), split_part(v, '|', 2))),
      '22023: The administrative fee is 0 to 100000 per employee per month, or 0 to 100 percent of payroll', 'fee ' || v);
  END LOOP;
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.bstatus('Paychex'), 'sent', 'nothing moved');
END $$;

-- ---------- 9. The table holds the same fee bounds ----------
-- Catches: bounds only in record_quote; any other writer could store 420 percent of payroll.
DO $$
DECLARE v text;
BEGIN
  FOREACH v IN ARRAY ARRAY['-1, ''per_employee_per_month''', '100001, ''per_employee_per_month''', '100.01, ''percent_of_payroll'''] LOOP
    PERFORM pg_temp.is(split_part(pg_temp.refusal(format($s$INSERT INTO public.quotes (quote_request_id, session_id, kind, admin_fee, admin_fee_basis) VALUES (%s, pg_temp.id('bella'), 'estimate', %s)$s$, pg_temp.bqr('Oasis'), v)), ':', 1),
      '23514', 'fee ' || v);
  END LOOP;
END $$;

-- ---------- 10. A quote holds its one-off fees, and a quote with none says nothing, which is not zero ----------
-- Catches: one-off fees dropped, or a quote with none stored as an empty list or $0 so it reads "quoted at nothing" instead of "Not quoted".
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  r := public.record_quote(p_quote_request_id => pg_temp.bqr('Oasis'), p_kind => 'estimate',
    p_one_off_fees => '[{"name": "Implementation", "amount": 1500}, {"name": "Onboarding per employee", "amount": 25.5}]');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT q.one_off_fees FROM public.quotes q WHERE q.id = (r ->> 'id')::bigint),
    '[{"name": "Implementation", "amount": 1500}, {"name": "Onboarding per employee", "amount": 25.5}]'::jsonb, 'the one-off fees');
  PERFORM pg_temp.is((SELECT q.one_off_fees IS NULL FROM public.quotes q WHERE q.quote_request_id = pg_temp.qr('Insperity')), true, 'a quote with none holds nothing');
END $$;

-- ---------- 11. One-off fees are a list of a name and an amount, or absent ----------
-- Catches: an empty list or an object stored for "none" (reads as quoted), an amount that is text or negative, a fee with no name, the same fee twice, and keys nobody reads.
DO $$
DECLARE v text; msg text := '22023: One-off fees are a list of a name and an amount from 0 to 10000000, each name once; leave them out when the quote has none';
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  FOREACH v IN ARRAY ARRAY['[]', '{"name": "X", "amount": 1}', '[{"name": "X"}]', '[{"name": "X", "amount": -1}]', '[{"name": "X", "amount": "5"}]',
    '[{"name": "X", "amount": 10000001}]', '[{"name": "X", "amount": 1, "waived": true}]', '[{"name": " ", "amount": 1}]', '[{"name": "X", "amount": 1}, {"name": "x", "amount": 2}]',
    '[{"name": "' || repeat('n', 81) || '", "amount": 1}]', '"none"', 'null'] LOOP
    PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.record_quote(p_quote_request_id => %s, p_kind => 'estimate', p_one_off_fees => %L::jsonb)$s$, pg_temp.bqr('Rippling'), v)),
      msg, 'one-off fees ' || left(v, 40));
    PERFORM pg_temp.as_owner();
    PERFORM pg_temp.is(split_part(pg_temp.refusal(format($s$INSERT INTO public.quotes (quote_request_id, session_id, kind, one_off_fees) VALUES (%s, pg_temp.id('bella'), 'estimate', %L::jsonb)$s$, pg_temp.bqr('Rippling'), v)), ':', 1),
      '23514', 'the table, one-off fees ' || left(v, 40));
    PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  END LOOP;
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.record_quote(p_quote_request_id => %s, p_kind => 'estimate', p_one_off_fees => '[{"name": "Waived setup", "amount": 0}]')$s$, pg_temp.bqr('Rippling'))), 'ok', 'a fee stated as zero is a fee');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 12. A quote holds workers' comp rates for each class code in each state ----------
-- Catches: one workers' comp number for the whole quote, so a bakery in California (8058) and an office in Texas (8810) can't be priced on their own class codes.
DO $$
DECLARE r jsonb;
  wc jsonb := '[{"state": "CA", "class_code": "8058", "rate": 3.12}, {"state": "CA", "class_code": "8810", "rate": 0.21}, {"state": "TX", "class_code": "8810", "rate": 0.18}]';
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  r := public.record_quote(p_quote_request_id => pg_temp.bqr('Paychex'), p_kind => 'firm_offer', p_workers_comp => wc);
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT q.workers_comp FROM public.quotes q WHERE q.id = (r ->> 'id')::bigint), wc, 'the rates by state and class code');
  PERFORM pg_temp.is((SELECT q.workers_comp IS NULL FROM public.quotes q WHERE q.quote_request_id = pg_temp.qr('Insperity')), true, 'a quote that gave none holds nothing');
END $$;

-- ---------- 13. Workers' comp rates are a list of a state, a class code and a rate, each state and class code once, or absent ----------
-- Catches: an empty list stored for "none", a state that is no state, a class code that is blank or a sentence, a rate that is text, negative or absurd, the same class code twice
-- in a state (two rates, no way to say which), and keys nobody reads. The table refuses the same shapes.
DO $$
DECLARE v text; msg text := '22023: Workers'' comp rates are a list of a state, a class code and a rate per 100 dollars of payroll from 0 to 1000, each state and class code once; leave them out when the quote has none';
BEGIN
  FOREACH v IN ARRAY ARRAY['[]', '{"state": "CA", "class_code": "8810", "rate": 1}', '[{"state": "CA", "class_code": "8810"}]', '[{"state": "ca", "class_code": "8810", "rate": 1}]',
    '[{"state": "ZZ", "class_code": "8810", "rate": 1}]', '[{"state": "CA", "class_code": "", "rate": 1}]', '[{"state": "CA", "class_code": "clerical office work", "rate": 1}]',
    '[{"state": "CA", "class_code": "8810", "rate": "1"}]', '[{"state": "CA", "class_code": "8810", "rate": -0.1}]', '[{"state": "CA", "class_code": "8810", "rate": 1000.01}]',
    '[{"state": "CA", "class_code": "8810", "rate": 1}, {"state": "CA", "class_code": "8810", "rate": 2}]', '[{"state": "CA", "class_code": "8810", "rate": 1, "mod": 0.9}]', 'null'] LOOP
    PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
    PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.record_quote(p_quote_request_id => %s, p_kind => 'estimate', p_workers_comp => %L::jsonb)$s$, pg_temp.bqr('Rippling'), v)),
      msg, 'workers comp ' || left(v, 50));
    PERFORM pg_temp.as_owner();
    PERFORM pg_temp.is(split_part(pg_temp.refusal(format($s$INSERT INTO public.quotes (quote_request_id, session_id, kind, workers_comp) VALUES (%s, pg_temp.id('bella'), 'estimate', %L::jsonb)$s$, pg_temp.bqr('Rippling'), v)), ':', 1),
      '23514', 'the table, workers comp ' || left(v, 50));
  END LOOP;
  PERFORM pg_temp.is((SELECT count(*) FROM public.quotes WHERE quote_request_id = pg_temp.bqr('Rippling') AND workers_comp IS NOT NULL), 0::bigint, 'nothing stored');
END $$;

-- ---------- 14. A quote holds how unemployment tax is charged in each state ----------
-- Catches: no place for unemployment tax at all, or one number for every state: some PEOs charge the employer's own state rate at cost, others their pooled rate.
DO $$
DECLARE r jsonb;
  ut jsonb := '[{"state": "CA", "charge": "employer_rate"}, {"state": "TX", "charge": "peo_rate", "rate": 2.7}]';
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  r := public.record_quote(p_quote_request_id => pg_temp.bqr('Paychex'), p_kind => 'firm_offer', p_unemployment => ut);
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT q.unemployment FROM public.quotes q WHERE q.id = (r ->> 'id')::bigint), ut, 'the charge by state');
  PERFORM pg_temp.is((SELECT q.unemployment IS NULL FROM public.quotes q WHERE q.quote_request_id = pg_temp.qr('Insperity')), true, 'a quote that gave none holds nothing');
END $$;

-- ---------- 15. Unemployment tax is charged at the employer's own rate or at the PEO's rate (which names it), once per state, or absent ----------
-- Catches: a PEO rate with no rate (nothing to compare), an employer-rate line that carries one (a rate nobody applies), a way of charging that is neither, a state twice, a rate out of
-- 0 to 100 percent, and an empty list for "none". The table refuses the same shapes.
DO $$
DECLARE v text; msg text := '22023: Unemployment tax is a list of a state and how it is charged, the employer''s own rate or the PEO''s rate with its percent of taxable wages from 0 to 100, each state once; leave it out when the quote has none';
BEGIN
  FOREACH v IN ARRAY ARRAY['[]', '{"state": "CA", "charge": "employer_rate"}', '[{"state": "CA", "charge": "peo_rate"}]', '[{"state": "CA", "charge": "employer_rate", "rate": 2}]',
    '[{"state": "CA", "charge": "flat"}]', '[{"state": "CA", "charge": "peo_rate", "rate": -1}]', '[{"state": "CA", "charge": "peo_rate", "rate": 100.5}]',
    '[{"state": "CA", "charge": "peo_rate", "rate": "2"}]', '[{"state": "ZZ", "charge": "employer_rate"}]', '[{"state": "CA", "charge": "employer_rate"}, {"state": "CA", "charge": "peo_rate", "rate": 2}]',
    '[{"charge": "employer_rate"}]', 'null'] LOOP
    PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
    PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.record_quote(p_quote_request_id => %s, p_kind => 'estimate', p_unemployment => %L::jsonb)$s$, pg_temp.bqr('Rippling'), v)),
      msg, 'unemployment ' || left(v, 50));
    PERFORM pg_temp.as_owner();
    PERFORM pg_temp.is(split_part(pg_temp.refusal(format($s$INSERT INTO public.quotes (quote_request_id, session_id, kind, unemployment) VALUES (%s, pg_temp.id('bella'), 'estimate', %L::jsonb)$s$, pg_temp.bqr('Rippling'), v)), ':', 1),
      '23514', 'the table, unemployment ' || left(v, 50));
  END LOOP;
END $$;

-- ---------- 16. Words where a number belongs get the same refusal, not a database error ----------
-- Catches: a rate of "abc" reaching a numeric cast and raising 22P02 (an unreadable error, and a 500 for the screen) instead of the refusal that names the rule.
DO $$
DECLARE v text; area text; msg text;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  FOR area, v IN SELECT * FROM (VALUES
    ('p_one_off_fees', '[{"name": "X", "amount": "abc"}]'),
    ('p_workers_comp', '[{"state": "CA", "class_code": "8810", "rate": "abc"}]'),
    ('p_unemployment', '[{"state": "CA", "charge": "peo_rate", "rate": "abc"}]')) AS t (a, b) LOOP
    msg := pg_temp.refusal(format($s$SELECT public.record_quote(p_quote_request_id => %s, p_kind => 'estimate', %s => %L::jsonb)$s$, pg_temp.bqr('Rippling'), area, v));
    PERFORM pg_temp.is(left(msg, 6), '22023:', area || ' with a word for a number: ' || msg);
  END LOOP;
END $$;

-- ---------- 17. A quote holds medical rates for each plan and tier ----------
-- Catches: one medical number per quote, so a PPO and an HSA plan, and employee-only against family cover, can't sit on their own lines in the comparison.
DO $$
DECLARE r jsonb;
  med jsonb := '[{"plan": "Gold PPO", "tier": "employee_only", "monthly": 612.4}, {"plan": "Gold PPO", "tier": "employee_spouse", "monthly": 1290}, {"plan": "Gold PPO", "tier": "employee_children", "monthly": 1105.75}, {"plan": "Gold PPO", "tier": "family", "monthly": 1840}, {"plan": "Silver HSA", "tier": "employee_only", "monthly": 480}]';
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  r := public.record_quote(p_quote_request_id => pg_temp.bqr('Paychex'), p_kind => 'firm_offer', p_medical => med);
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT q.medical FROM public.quotes q WHERE q.id = (r ->> 'id')::bigint), med, 'the rates by plan and tier');
  PERFORM pg_temp.is((SELECT q.medical IS NULL FROM public.quotes q WHERE q.quote_request_id = pg_temp.qr('Insperity')), true, 'a quote that gave none holds nothing');
END $$;

-- ---------- 18. Medical rates are a list of a plan, a tier and a monthly rate, each plan and tier once, or absent ----------
-- Catches: an empty list for "none", a tier that is none of the four, a plan with no name, a monthly rate that is a word, negative or absurd, the same plan and tier twice (two
-- rates, no way to say which), and keys nobody reads. The table refuses the same shapes.
DO $$
DECLARE v text; msg text := '22023: Medical rates are a list of a plan, a tier (employee_only, employee_spouse, employee_children or family) and a monthly rate per employee from 0 to 100000, each plan and tier once; leave them out when the quote has none';
BEGIN
  FOREACH v IN ARRAY ARRAY['[]', '{"plan": "Gold", "tier": "family", "monthly": 1}', '[{"plan": "Gold", "tier": "family"}]', '[{"plan": "Gold", "tier": "single", "monthly": 1}]',
    '[{"plan": " ", "tier": "family", "monthly": 1}]', '[{"plan": "Gold", "tier": "family", "monthly": "abc"}]', '[{"plan": "Gold", "tier": "family", "monthly": -1}]',
    '[{"plan": "Gold", "tier": "family", "monthly": 100001}]', '[{"plan": "Gold", "tier": "family", "monthly": 1}, {"plan": "gold", "tier": "family", "monthly": 2}]',
    '[{"plan": "Gold", "tier": "family", "monthly": 1, "carrier": "Aetna"}]', 'null'] LOOP
    PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
    PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.record_quote(p_quote_request_id => %s, p_kind => 'estimate', p_medical => %L::jsonb)$s$, pg_temp.bqr('Rippling'), v)),
      msg, 'medical ' || left(v, 50));
    PERFORM pg_temp.as_owner();
    PERFORM pg_temp.is(split_part(pg_temp.refusal(format($s$INSERT INTO public.quotes (quote_request_id, session_id, kind, medical) VALUES (%s, pg_temp.id('bella'), 'estimate', %L::jsonb)$s$, pg_temp.bqr('Rippling'), v)), ':', 1),
      '23514', 'the table, medical ' || left(v, 50));
  END LOOP;
END $$;

-- ---------- 19. Only an advisor of the quote request's own firm records a quote, and who may is decided before anything else is said ----------
-- Catches: another firm's agent, the employer, or nobody signed in recording a quote, or learning what is wrong with their request before being refused (a refusal that names
-- a validation rule tells a stranger the quote request exists).
DO $$
DECLARE q bigint := pg_temp.bqr('Rippling'); n bigint := pg_temp.nquotes(pg_temp.bqr('Rippling'));
  call text := format($s$SELECT public.record_quote(p_quote_request_id => %s, p_kind => %%L, p_admin_fee => 40, p_admin_fee_basis => 'per_employee_per_month')$s$, q);
BEGIN
  PERFORM pg_temp.as_user('zenith_agent', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.refusal(format(call, 'estimate')), 'PT404: Quote request not found', 'another firm''s agent');
  PERFORM pg_temp.is(pg_temp.refusal(format(call, 'guess')), 'PT404: Quote request not found', 'another firm''s agent, with an invalid quote');
  PERFORM pg_temp.as_user('p_bella');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format(call, 'estimate')), ':', 1), '42501', 'the employer');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format(call, 'guess')), ':', 1), '42501', 'the employer, with an invalid quote');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format(call, 'estimate')), ':', 1), '42501', 'nobody signed in');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format(call, 'guess')), ':', 1), '42501', 'nobody signed in, with an invalid quote');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.nquotes(q), n, 'and nothing was stored');
END $$;

-- ---------- 20. A closing firm and a support session record nothing, whatever the quote says (ADR 0023, ADR 0024) ----------
-- Catches: a quote recorded in a firm's read-only 30 days, or by Nevermore support while it is only looking; or the refusal depending on the figures being valid.
DO $$
DECLARE q bigint := pg_temp.bqr('Rippling'); n bigint := pg_temp.nquotes(pg_temp.bqr('Rippling'));
  call text := format($s$SELECT public.record_quote(p_quote_request_id => %s, p_kind => %%L, p_admin_fee => 40, p_admin_fee_basis => 'per_employee_per_month')$s$, q);
BEGIN
  PERFORM pg_temp.new_user('platform_admin');
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('platform_admin'), 'admin');
  INSERT INTO public.support_sessions (firm_id, admin_id, admin_email, reason, started_at, ends_at)
  VALUES (pg_temp.id('acme'), pg_temp.id('platform_admin'), 'platform_admin@example.test', 'Looking at a stuck email', now(), now() + interval '1 hour');
  PERFORM pg_temp.as_user('platform_admin', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format(call, 'estimate')), 'PT423: Nevermore support can look, not change', 'a support session');
  PERFORM pg_temp.is(pg_temp.refusal(format(call, 'guess')), 'PT423: Nevermore support can look, not change', 'a support session, with an invalid quote');
  PERFORM pg_temp.as_owner();
  DELETE FROM public.support_sessions WHERE firm_id = pg_temp.id('acme');
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (pg_temp.id('acme'), pg_temp.id('acme_agent'), now() + interval '30 days');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format(call, 'estimate')), ':', 1), 'PT423', 'a closing firm');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format(call, 'guess')), ':', 1), 'PT423', 'a closing firm, with an invalid quote');
  PERFORM pg_temp.as_owner();
  DELETE FROM public.firm_closures WHERE firm_id = pg_temp.id('acme');
  PERFORM pg_temp.is(pg_temp.nquotes(q), n, 'and nothing was stored');
END $$;

-- ---------- 21. A closed quote request takes no quote, and a refused quote leaves nothing behind ----------
-- Catches: a quote row stored beside a quote request that refused it (the quotes table showing a quote the request never took), or a quote recorded on a request nothing is expected from.
DO $$
DECLARE q bigint := pg_temp.bqr('Rippling'); n bigint := pg_temp.nquotes(pg_temp.bqr('Rippling'));
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.advisor_update_quote_request(q, 'closed');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.record_quote(p_quote_request_id => %s, p_kind => 'estimate', p_admin_fee => 40, p_admin_fee_basis => 'per_employee_per_month')$s$, q)),
    '22023: This quote request is closed. Record a send to Rippling to reopen it', 'a closed quote request');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.nquotes(q), n, 'no quote row');
  PERFORM pg_temp.is(pg_temp.bstatus('Rippling'), 'closed', 'still closed');
END $$;

-- ---------- 22. Quotes are read by the quote request's own firm only, and written by nobody but record_quote ----------
-- Catches: another firm, the employer or a signed-out visitor reading a PEO's figures, or an API role writing a row of its own (a quote with no check by an advisor).
DO $$
DECLARE n bigint := (SELECT count(*) FROM public.quotes WHERE session_id = pg_temp.id('reyes'));
BEGIN
  PERFORM pg_temp.is(n > 0, true, 'Reyes Bakery has quotes');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quotes WHERE session_id = pg_temp.id('reyes')), n, 'its own firm reads them');
  PERFORM pg_temp.as_user('zenith_agent', 'zenith-benefits');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quotes), 0::bigint, 'another firm reads none');
  PERFORM pg_temp.as_user('p_reyes');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quotes), 0::bigint, 'the employer reads none');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(split_part(pg_temp.refusal('SELECT count(*) FROM public.quotes'), ':', 1), '42501', 'nobody signed in');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($s$INSERT INTO public.quotes (quote_request_id, session_id, kind) VALUES (%s, pg_temp.id('reyes'), 'estimate')$s$, pg_temp.qr('Insperity'))), ':', 1),
    '42501', 'a firm''s agent can not write a row');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($s$UPDATE public.quotes SET kind = 'firm_offer' WHERE session_id = pg_temp.id('reyes')$s$)), ':', 1), '42501', 'or change one');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($s$DELETE FROM public.quotes WHERE session_id = pg_temp.id('reyes')$s$)), ':', 1), '42501', 'or delete one');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 23. Mark quoted still works with no offer; a later quote is a second row and the newest is the one the quote request shows ----------
-- Catches: "Mark quoted" (advisor_update_quote_request) starting to create or demand an offer, and a revised quote overwriting the first (7.3 needs the earlier one kept) or leaving
-- the quote request on the older fee.
DO $$
DECLARE r1 jsonb; r2 jsonb; q bigint := pg_temp.qr('Insperity');
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.advisor_update_quote_request(pg_temp.bqr('Paychex'), 'quoted', current_date, current_date + 20, current_date + 40, 31);
  PERFORM pg_temp.is(pg_temp.nquotes(pg_temp.bqr('Paychex')), 3::bigint, 'Mark quoted adds no row to the offers Paychex already has');
  PERFORM pg_temp.is((SELECT admin_fee_pepm FROM public.quote_requests WHERE id = pg_temp.bqr('Paychex')), 31::numeric, 'and sets the quote request''s fee as before');
  r1 := (SELECT to_jsonb(x) FROM public.quotes x WHERE x.quote_request_id = q);
  r2 := public.record_quote(p_quote_request_id => q, p_kind => 'estimate', p_expires_on => current_date + 60, p_admin_fee => 44, p_admin_fee_basis => 'per_employee_per_month');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.nquotes(q), 2::bigint, 'two quotes on the quote request');
  PERFORM pg_temp.is((SELECT to_jsonb(x) FROM public.quotes x WHERE x.id = (r1 ->> 'id')::bigint), r1, 'the first is as it was');
  PERFORM pg_temp.is((SELECT x.admin_fee_pepm FROM public.quote_requests x WHERE x.id = q), 44::numeric, 'the quote request shows the newest fee');
  PERFORM pg_temp.is((SELECT x.quote_expires_on FROM public.quote_requests x WHERE x.id = q), current_date + 60, 'and the newest expiry');
END $$;
