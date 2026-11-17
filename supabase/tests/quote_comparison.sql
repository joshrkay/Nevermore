-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh quote_comparison
-- A quote that holds the whole offer (N-2.1, slice 7.2; docs/BROKER_CRM_BUILD.md D-720 to D-729; 20261124140000_quote_comparison.sql). One row of `quotes` for each quote a
-- The broker's comparison of an opportunity's quotes and the notes on it (N-3.1, N-3.2, slice 7.7; docs/BROKER_CRM_BUILD.md D-770 to D-779; 20261124170000_quote_comparison.sql). Two firms.
-- Every migration is loaded, in filename order (D-105), this slice's last.
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
\i supabase/migrations/20261124170000_quote_comparison.sql
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

-- ---------- 1. The comparison has one column for each PEO the opportunity was sent to, alphabetical, a PEO with no quote yet showing its status ----------
-- Catches: a comparison that lists only the PEOs that have quoted (the broker can't see who is still out), or lists them in the order they were sent.
-- Acme's agent owns Reyes Bakery's account, so sees it (D-422: whoever sees the account sees its opportunity).
UPDATE public.accounts SET owner_id = pg_temp.id('acme_agent') WHERE firm_id = pg_temp.id('acme');

CREATE FUNCTION pg_temp.opp(intake text) RETURNS uuid LANGUAGE sql AS $$ SELECT o.id FROM public.opportunities o WHERE o.intake_id = pg_temp.id(intake) $$;

DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  r := public.opportunity_quote_comparison(pg_temp.id('acme'), pg_temp.opp('reyes'));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT jsonb_agg(c ->> 'peo_name') FROM jsonb_array_elements(r -> 'columns') c), '["Insperity", "Justworks", "TriNet"]'::jsonb, 'the PEOs, alphabetical');
  PERFORM pg_temp.is(r -> 'columns' -> 0 ->> 'status', 'sent', 'a PEO with no quote shows its status');
  PERFORM pg_temp.is(r -> 'columns' -> 0 -> 'quote', 'null'::jsonb, 'and no quote');
END $$;

-- ---------- 2. A PEO's column shows its current quote: the newest row, the earlier one kept in the history ----------
-- Catches: the comparison reading the first quote a PEO sent, so a revised quote (N-2.4) never shows and the broker compares a figure the PEO has withdrawn.
DO $$
DECLARE r jsonb; first_id bigint; second_id bigint;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  first_id := (public.record_quote(p_quote_request_id => pg_temp.qr('Insperity'), p_kind => 'estimate', p_admin_fee => 45, p_admin_fee_basis => 'per_employee_per_month') ->> 'id')::bigint;
  second_id := (public.record_quote(p_quote_request_id => pg_temp.qr('Insperity'), p_kind => 'firm_offer', p_admin_fee => 40, p_admin_fee_basis => 'per_employee_per_month') ->> 'id')::bigint;
  r := public.opportunity_quote_comparison(pg_temp.id('acme'), pg_temp.opp('reyes'));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((r -> 'columns' -> 0 -> 'quote' ->> 'id')::bigint, second_id, 'the newer quote is the current one');
  PERFORM pg_temp.is(r -> 'columns' -> 0 -> 'quote' ->> 'kind', 'firm_offer', 'and says what it is');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quotes WHERE id = first_id), 1::bigint, 'the earlier quote is kept');
END $$;

-- ---------- 3. The column carries the quote's administrative fee with its basis, its dates and its note ----------
-- Catches: a fee shown with no basis ($40 a month and 40% of payroll look alike), or a quote with no expiry, so the broker can't tell it has lapsed.
DO $$
DECLARE r jsonb; q jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.record_quote(p_quote_request_id => pg_temp.qr('TriNet'), p_kind => 'estimate', p_received_on => current_date - 10, p_expires_on => current_date - 1,
    p_start_on => current_date + 30, p_admin_fee => 3.5, p_admin_fee_basis => 'percent_of_payroll', p_note => 'By phone');
  r := public.opportunity_quote_comparison(pg_temp.id('acme'), pg_temp.opp('reyes'));
  PERFORM pg_temp.as_owner();
  q := r -> 'columns' -> 2 -> 'quote';
  PERFORM pg_temp.is((q ->> 'admin_fee')::numeric, 3.5::numeric, 'the fee');
  PERFORM pg_temp.is(q ->> 'admin_fee_basis', 'percent_of_payroll', 'its basis');
  PERFORM pg_temp.is(q ->> 'expires_on', (current_date - 1)::text, 'the expiry');
  PERFORM pg_temp.is(q ->> 'received_on', (current_date - 10)::text, 'received');
  PERFORM pg_temp.is(q ->> 'proposed_start_on', (current_date + 30)::text, 'the proposed start');
  PERFORM pg_temp.is(q ->> 'note', 'By phone', 'the note');
END $$;

-- ---------- 4. A cost area a quote leaves out is null, a waived one is 0 and the lines of a quoted area come through ----------
-- Catches: an area left out coming back as [] or 0 (the screen would read "Not quoted" as "free"), or a waived fee of 0 coming back null (it would read "Not quoted").
DO $$
DECLARE r jsonb; q jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.record_quote(p_quote_request_id => pg_temp.qr('Justworks'), p_kind => 'firm_offer', p_admin_fee => 0, p_admin_fee_basis => 'per_employee_per_month',
    p_one_off_fees => '[{"name": "Setup", "amount": 500}]'::jsonb, p_workers_comp => '[{"state": "CA", "class_code": "8810", "rate": 0.42}]'::jsonb,
    p_unemployment => '[{"state": "CA", "charge": "employer_rate"}]'::jsonb);
  r := public.opportunity_quote_comparison(pg_temp.id('acme'), pg_temp.opp('reyes'));
  PERFORM pg_temp.as_owner();
  q := r -> 'columns' -> 1 -> 'quote';
  PERFORM pg_temp.is((q ->> 'admin_fee')::numeric, 0::numeric, 'a waived fee is 0');
  PERFORM pg_temp.is(q -> 'one_off_fees' -> 0 ->> 'name', 'Setup', 'one-off fees come through');
  PERFORM pg_temp.is((q -> 'workers_comp' -> 0 ->> 'rate')::numeric, 0.42::numeric, 'workers'' comp comes through');
  PERFORM pg_temp.is(q -> 'unemployment' -> 0 ->> 'charge', 'employer_rate', 'unemployment comes through');
  PERFORM pg_temp.is(q -> 'medical', 'null'::jsonb, 'medical, left out, is null');
  PERFORM pg_temp.is(r -> 'columns' -> 2 -> 'quote' -> 'one_off_fees', 'null'::jsonb, 'and so are another quote''s one-off fees, never an empty list');
END $$;

-- ---------- 5. Another firm's agent and a missing opportunity get the one refusal ----------
-- Catches: the comparison answering for an opportunity of another firm (a rival sees every PEO's price on a prospect), or telling "not yours" from "not there".
DO $$
DECLARE opp uuid := pg_temp.opp('reyes');
BEGIN
  PERFORM pg_temp.as_user('zenith_agent', 'zenith-benefits');
  PERFORM pg_temp.is(left(pg_temp.refusal(format('SELECT public.opportunity_quote_comparison(%L, %L)', pg_temp.id('zenith'), opp)), 6), 'PT404:', 'a stranger who names their own firm');
  PERFORM pg_temp.is(left(pg_temp.refusal(format('SELECT public.opportunity_quote_comparison(%L, %L)', pg_temp.id('acme'), opp)), 6), 'PT404:', 'a stranger who names the opportunity''s firm');
  PERFORM pg_temp.is(left(pg_temp.refusal(format('SELECT public.opportunity_quote_comparison(%L, %L)', pg_temp.id('acme'), gen_random_uuid())), 6), 'PT404:', 'an opportunity that is not there');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 6. A broker adds a note on a PEO's figure, marked internal or for the client, and the comparison lists it with who wrote it ----------
-- Catches: a note that loses what it is about (the PEO, the cost area) or who may read it, so an internal remark could later be shown to the client as one.
DO $$
DECLARE r jsonb; n jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  n := public.add_comparison_note(pg_temp.id('acme'), pg_temp.opp('reyes'), pg_temp.qr('Justworks'), 'admin_fee', 'internal', '  Waived only for the first year.  ');
  r := public.opportunity_quote_comparison(pg_temp.id('acme'), pg_temp.opp('reyes'));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(n ->> 'body', 'Waived only for the first year.', 'the writer answers with the note, trimmed');
  PERFORM pg_temp.is(jsonb_array_length(r -> 'notes'), 1, 'one note');
  PERFORM pg_temp.is(r -> 'notes' -> 0 ->> 'body', 'Waived only for the first year.', 'its words');
  PERFORM pg_temp.is(r -> 'notes' -> 0 ->> 'visibility', 'internal', 'who may read it');
  PERFORM pg_temp.is((r -> 'notes' -> 0 ->> 'quote_request_id')::bigint, pg_temp.qr('Justworks'), 'the PEO it is about');
  PERFORM pg_temp.is(r -> 'notes' -> 0 ->> 'area', 'admin_fee', 'the cost area it is about');
  PERFORM pg_temp.is(r -> 'notes' -> 0 ->> 'author', 'acme_agent@example.test', 'who wrote it');
END $$;

-- ---------- 7. Another firm's agent adds no note to this opportunity, whichever firm they name ----------
-- Catches: a writer that trusts the opportunity id it is sent (a rival writes onto a prospect's comparison, and that note could later be shown to the client).
CREATE FUNCTION pg_temp.nnotes() RETURNS bigint LANGUAGE sql AS $$ SELECT count(*) FROM public.quote_comparison_notes $$;

DO $$
DECLARE n bigint := pg_temp.nnotes(); opp uuid := pg_temp.opp('reyes');
BEGIN
  PERFORM pg_temp.as_user('zenith_agent', 'zenith-benefits');
  PERFORM pg_temp.is(left(pg_temp.refusal(format('SELECT public.add_comparison_note(%L, %L, NULL, NULL, %L, %L)', pg_temp.id('acme'), opp, 'internal', 'Hi')), 6), '42501:', 'naming the opportunity''s firm, which they are not in');
  PERFORM pg_temp.is(left(pg_temp.refusal(format('SELECT public.add_comparison_note(%L, %L, NULL, NULL, %L, %L)', pg_temp.id('zenith'), opp, 'internal', 'Hi')), 6), 'PT404:', 'naming their own firm');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.nnotes(), n, 'and nothing was stored');
END $$;

-- ---------- 8. A note is marked internal or for the client, nothing else ----------
-- Catches: a note stored with no mark, or a mistyped one, that the client's view (N-3.3) would have to guess about: an internal remark must never be taken for one for the client.
DO $$
DECLARE n bigint := pg_temp.nnotes(); opp uuid := pg_temp.opp('reyes');
  call text := format('SELECT public.add_comparison_note(%L, %L, NULL, NULL, %%L, %L)', pg_temp.id('acme'), opp, 'A note');
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(left(pg_temp.refusal(format(call, 'private')), 6), '22023:', 'a mistyped mark');
  PERFORM pg_temp.is(left(pg_temp.refusal(format(call, '')), 6), '22023:', 'an empty mark');
  PERFORM pg_temp.is(left(pg_temp.refusal(replace(format(call, 'x'), '''x''', 'NULL')), 6), '22023:', 'no mark');
  PERFORM pg_temp.is(left(pg_temp.refusal(format(call, 'client')), 3), 'ok', 'for the client is fine');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.nnotes(), n + 1, 'only the valid one was stored');
END $$;

-- ---------- 9. A note has words, at most 2000 characters ----------
-- Catches: an empty or whitespace-only note stored (a blank line on the client's page), or an unbounded one.
DO $$
DECLARE n bigint := pg_temp.nnotes(); opp uuid := pg_temp.opp('reyes');
  call text := format('SELECT public.add_comparison_note(%L, %L, NULL, NULL, %L, %%L)', pg_temp.id('acme'), opp, 'internal');
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(left(pg_temp.refusal(format(call, '   ')), 6), '22023:', 'blank');
  PERFORM pg_temp.is(left(pg_temp.refusal(format(call, repeat('x', 2001))), 6), '22023:', '2001 characters');
  PERFORM pg_temp.is(left(pg_temp.refusal(format(call, repeat('x', 2000))), 3), 'ok', '2000 characters');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.nnotes(), n + 1, 'only the valid one was stored');
END $$;

-- ---------- 10. A note's cost area is one of the comparison's rows ----------
-- Catches: a note about "premium" or a typo stored against no row, which the comparison would never draw.
DO $$
DECLARE n bigint := pg_temp.nnotes(); opp uuid := pg_temp.opp('reyes'); area text;
  call text := format('SELECT public.add_comparison_note(%L, %L, NULL, %%L, %L, %L)', pg_temp.id('acme'), opp, 'internal', 'A note');
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(left(pg_temp.refusal(format(call, 'premium')), 6), '22023:', 'an area the comparison does not have');
  FOREACH area IN ARRAY ARRAY['admin_fee', 'one_off_fees', 'workers_comp', 'unemployment', 'medical'] LOOP
    PERFORM pg_temp.is(left(pg_temp.refusal(format(call, area)), 3), 'ok', area);
  END LOOP;
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.nnotes(), n + 5, 'only the five valid ones were stored');
END $$;

-- A second employer, Bella Cafe, sent to Paychex; Acme's agent owns its account too.
DO $$
BEGIN
  PERFORM pg_temp.intake('bella', 'acme', 'Bella Cafe');
  PERFORM pg_temp.certify('bella', 1, 'EAA-2026-0044');
  PERFORM pg_temp.authorize('bella', 'Paychex', true);
  PERFORM pg_temp.sent('bella', 'Paychex');
  UPDATE public.accounts SET owner_id = pg_temp.id('acme_agent') WHERE firm_id = pg_temp.id('acme');
END $$;

-- ---------- 11. A note names a PEO of this opportunity, never one of another's ----------
-- Catches: a note pinned to another employer's PEO column, which shows under (and leaks into) the wrong comparison.
DO $$
DECLARE n bigint := pg_temp.nnotes(); opp uuid := pg_temp.opp('reyes');
  other bigint := (SELECT id FROM public.quote_requests WHERE session_id = pg_temp.id('bella'));
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(left(pg_temp.refusal(format('SELECT public.add_comparison_note(%L, %L, %s, NULL, %L, %L)', pg_temp.id('acme'), opp, other, 'internal', 'A note')), 6), '22023:', 'another opportunity''s PEO');
  PERFORM pg_temp.is(left(pg_temp.refusal(format('SELECT public.add_comparison_note(%L, %L, 0, NULL, %L, %L)', pg_temp.id('acme'), opp, 'internal', 'A note')), 6), '22023:', 'a PEO that is not there');
  PERFORM pg_temp.is(left(pg_temp.refusal(format('SELECT public.add_comparison_note(%L, %L, %s, NULL, %L, %L)', pg_temp.id('acme'), opp, pg_temp.qr('TriNet'), 'internal', 'A note')), 3), 'ok', 'this opportunity''s PEO');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.nnotes(), n + 1, 'only the valid one was stored');
END $$;

-- ---------- 12. A closing firm and a support session add no note, whatever the note says (ADR 0023, ADR 0024) ----------
-- Catches: a note added in a firm's read-only 30 days, or by Nevermore support while it is only looking.
DO $$
DECLARE n bigint := pg_temp.nnotes();
  call text := format('SELECT public.add_comparison_note(%L, %L, NULL, NULL, %%L, %L)', pg_temp.id('acme'), pg_temp.opp('reyes'), 'A note');
BEGIN
  PERFORM pg_temp.new_user('platform_admin');
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('platform_admin'), 'admin');
  INSERT INTO public.support_sessions (firm_id, admin_id, admin_email, reason, started_at, ends_at)
  VALUES (pg_temp.id('acme'), pg_temp.id('platform_admin'), 'platform_admin@example.test', 'Looking at a stuck email', now(), now() + interval '1 hour');
  PERFORM pg_temp.as_user('platform_admin', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format(call, 'internal')), 'PT423: Nevermore support can look, not change', 'a support session');
  PERFORM pg_temp.is(pg_temp.refusal(format(call, 'guess')), 'PT423: Nevermore support can look, not change', 'a support session, with an invalid note');
  PERFORM pg_temp.as_owner();
  DELETE FROM public.support_sessions WHERE firm_id = pg_temp.id('acme');
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (pg_temp.id('acme'), pg_temp.id('acme_agent'), now() + interval '30 days');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format(call, 'internal')), ':', 1), 'PT423', 'a closing firm');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format(call, 'guess')), ':', 1), 'PT423', 'a closing firm, with an invalid note');
  PERFORM pg_temp.as_owner();
  DELETE FROM public.firm_closures WHERE firm_id = pg_temp.id('acme');
  PERFORM pg_temp.is(pg_temp.nnotes(), n, 'and nothing was stored');
END $$;

-- ---------- 13. An archived account takes no note, and the comparison says so ----------
-- Catches: a note added under an archived account (D-432: nothing on it changes), or a screen offering Add a note it would refuse.
DO $$
DECLARE n bigint := pg_temp.nnotes(); opp uuid := pg_temp.opp('reyes'); r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is((public.opportunity_quote_comparison(pg_temp.id('acme'), opp) ->> 'can_add')::boolean, true, 'an open account can take a note');
  PERFORM pg_temp.as_owner();
  UPDATE public.accounts SET archived_at = now() WHERE id = (SELECT account_id FROM public.opportunities WHERE id = opp);
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(left(pg_temp.refusal(format('SELECT public.add_comparison_note(%L, %L, NULL, NULL, %L, %L)', pg_temp.id('acme'), opp, 'internal', 'A note')), 6), '55000:', 'the writer refuses');
  r := public.opportunity_quote_comparison(pg_temp.id('acme'), opp);
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((r ->> 'can_add')::boolean, false, 'the comparison says so');
  PERFORM pg_temp.is(jsonb_array_length(r -> 'columns'), 3, 'and still shows the quotes');
  UPDATE public.accounts SET archived_at = NULL WHERE id = (SELECT account_id FROM public.opportunities WHERE id = opp);
  PERFORM pg_temp.is(pg_temp.nnotes(), n, 'and nothing was stored');
END $$;
