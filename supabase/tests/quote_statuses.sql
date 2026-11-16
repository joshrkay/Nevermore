-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh quote_statuses
-- More statuses for a quote request (N-1.2, slice 5.1; CRM-Q3.1's database half; docs/BROKER_CRM_BUILD.md D-1730 to D-1739; 20261123100000_quote_statuses.sql).
-- `acknowledged` and `question_open` join sent, quoted, declined and closed; an agent of the firm records the moves, mail never does, nothing moves by
-- itself, every change records who and when and can't be rewritten; the opportunity's stage and the places that count open quotes follow. Two firms.
-- Every migration is loaded, in filename order (D-105), this slice's last.
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
\i supabase/migrations/20261123100000_quote_statuses.sql
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
CREATE FUNCTION pg_temp.qstatus(peo text) RETURNS text LANGUAGE sql AS $$
  SELECT status FROM public.quote_requests WHERE id = pg_temp.qr(peo) $$;

-- ---------- 1. The database holds the two new statuses ----------
-- Catches: a status check that still lists four statuses, so recording an acknowledgement fails with a constraint error nobody can read.
DO $$
BEGIN
  UPDATE public.quote_requests SET status = 'acknowledged' WHERE id = pg_temp.qr('Insperity');
  PERFORM pg_temp.is(pg_temp.qstatus('Insperity'), 'acknowledged', 'Insperity acknowledged');
  UPDATE public.quote_requests SET status = 'question_open' WHERE id = pg_temp.qr('Insperity');
  PERFORM pg_temp.is(pg_temp.qstatus('Insperity'), 'question_open', 'Insperity has a question open');
  UPDATE public.quote_requests SET status = 'sent' WHERE id = pg_temp.qr('Insperity');
  PERFORM pg_temp.is(pg_temp.refusal($q$UPDATE public.quote_requests SET status = 'maybe' WHERE status = 'sent'$q$) LIKE '23514%', true, 'and no other word');
END $$;

-- The status of a quote request set as Acme's agent (or whoever is named); answers the function's answer.
CREATE FUNCTION pg_temp.setq(peo text, to_status text, who text DEFAULT 'acme_agent', addr text DEFAULT 'acme-brokers') RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user(who, addr);
  r := public.advisor_set_quote_request_status(pg_temp.qr(peo), to_status);
  PERFORM pg_temp.as_owner();
  RETURN r;
END $$;

-- ---------- 2. An agent records that a PEO acknowledged, or has a question open ----------
-- Catches: no way for an agent to record the two new statuses at all, or one that answers with nothing so the page can't show the new status.
DO $$
DECLARE r jsonb;
BEGIN
  r := pg_temp.setq('Insperity', 'acknowledged');
  PERFORM pg_temp.is(pg_temp.qstatus('Insperity'), 'acknowledged', 'Insperity acknowledged');
  PERFORM pg_temp.is(r ->> 'status', 'acknowledged', 'the answer is the quote request as it is now');
  PERFORM pg_temp.setq('Insperity', 'question_open');
  PERFORM pg_temp.is(pg_temp.qstatus('Insperity'), 'question_open', 'a question open');
  PERFORM pg_temp.setq('Insperity', 'sent');
  PERFORM pg_temp.is(pg_temp.qstatus('Insperity'), 'sent', 'and back to Sent once it is answered');
END $$;

-- ---------- 3. Only an advisor of the quote request's own firm records a status ----------
-- Catches: a status written by another firm's agent, by the employer, or by anyone signed out (a quote request is the broker's own record).
DO $$
DECLARE q bigint := pg_temp.qr('TriNet');
BEGIN
  PERFORM pg_temp.as_user('zenith_agent', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.advisor_set_quote_request_status(%s, 'acknowledged')$s$, q)),
    'PT404: Quote request not found', 'another firm''s agent');
  PERFORM pg_temp.as_user('p_reyes');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($s$SELECT public.advisor_set_quote_request_status(%s, 'acknowledged')$s$, q)), ':', 1),
    '42501', 'the employer');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($s$SELECT public.advisor_set_quote_request_status(%s, 'acknowledged')$s$, q)), ':', 1),
    '42501', 'nobody signed in');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.qstatus('TriNet'), 'sent', 'and nothing changed');
END $$;

-- ---------- 4. A closing firm and a support session record nothing (ADR 0023, ADR 0024) ----------
-- Catches: a status recorded in a firm's read-only 30 days, or by Nevermore support while it is only looking.
DO $$
BEGIN
  PERFORM pg_temp.new_user('platform_admin');
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('platform_admin'), 'admin');
  INSERT INTO public.support_sessions (firm_id, admin_id, admin_email, reason, started_at, ends_at)
  VALUES (pg_temp.id('acme'), pg_temp.id('platform_admin'), 'platform_admin@example.test', 'Looking at a stuck email', now(), now() + interval '1 hour');
  PERFORM pg_temp.as_user('platform_admin', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.advisor_set_quote_request_status(%s, 'acknowledged')$s$, pg_temp.qr('TriNet'))),
    'PT423: Nevermore support can look, not change', 'a support session');
  PERFORM pg_temp.as_owner();
  DELETE FROM public.support_sessions WHERE firm_id = pg_temp.id('acme');
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (pg_temp.id('acme'), pg_temp.id('acme_agent'), now() + interval '30 days');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($s$SELECT public.advisor_set_quote_request_status(%s, 'acknowledged')$s$, pg_temp.qr('TriNet'))), ':', 1),
    'PT423', 'a closing firm');
  PERFORM pg_temp.as_owner();
  DELETE FROM public.firm_closures WHERE firm_id = pg_temp.id('acme');
  PERFORM pg_temp.is(pg_temp.qstatus('TriNet'), 'sent', 'and nothing changed');
END $$;

-- ---------- 5. This records only the three open statuses; a quote, a decline and a close are recorded as they were ----------
-- Catches: a quote or a decline slipped in with no dates, fee or reason (and no move of the opportunity to Quoted), a close that skips advisor_update_quote_request, and a
-- word that is no status.
DO $$
DECLARE w text;
BEGIN
  FOREACH w IN ARRAY ARRAY['quoted', 'declined', 'closed'] LOOP
    PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT pg_temp.setq('TriNet', %L)$s$, w)),
      '22023: This records Sent, Acknowledged or Question open. A quote, a decline or a close is recorded with its own form', w || ' is recorded elsewhere');
  END LOOP;
  PERFORM pg_temp.is(split_part(pg_temp.refusal($s$SELECT pg_temp.setq('TriNet', 'maybe')$s$), ':', 1), '22023', 'a word that is no status');
  PERFORM pg_temp.is(split_part(pg_temp.refusal($s$SELECT pg_temp.setq('TriNet', NULL)$s$), ':', 1), '22023', 'nothing');
  PERFORM pg_temp.is(pg_temp.qstatus('TriNet'), 'sent', 'and nothing changed');
END $$;

-- A second employer, Bella Cafe, whose quote requests are brought to each status an agent can leave one in: Paychex quoted, Oasis declined, Rippling closed.
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
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.advisor_update_quote_request((SELECT id FROM public.quote_requests WHERE session_id = pg_temp.id('bella') AND peo_name = 'Paychex'), 'quoted',
    current_date, current_date + 30, current_date + 45, 42.5);
  PERFORM public.advisor_update_quote_request((SELECT id FROM public.quote_requests WHERE session_id = pg_temp.id('bella') AND peo_name = 'Oasis'), 'declined');
  PERFORM public.advisor_update_quote_request((SELECT id FROM public.quote_requests WHERE session_id = pg_temp.id('bella') AND peo_name = 'Rippling'), 'closed');
  PERFORM pg_temp.as_owner();
END $$;

CREATE FUNCTION pg_temp.bqr(peo text) RETURNS bigint LANGUAGE sql AS $$
  SELECT id FROM public.quote_requests WHERE session_id = pg_temp.id('bella') AND peo_name = peo $$;
CREATE FUNCTION pg_temp.bstatus(peo text) RETURNS text LANGUAGE sql AS $$
  SELECT status FROM public.quote_requests WHERE id = pg_temp.bqr(peo) $$;

-- ---------- 6. A quote, a decline and a close are not undone here; Acknowledged and Question open are for a request still open ----------
-- Catches: an agent moving a quoted quote back to Acknowledged (the opportunity says Quoted and the quote's figures are still there), reopening a
-- declined PEO, or reopening a closed one without sending again (which is the one way back, CRM-Q3.1).
DO $$
DECLARE peo text;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  FOREACH peo IN ARRAY ARRAY['Paychex', 'Oasis'] LOOP
    PERFORM pg_temp.is(split_part(pg_temp.refusal(format($s$SELECT public.advisor_set_quote_request_status(%s, 'acknowledged')$s$, pg_temp.bqr(peo))), ':', 1),
      '22023', peo || ' is not open any more');
  END LOOP;
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.advisor_set_quote_request_status(%s, 'sent')$s$, pg_temp.bqr('Rippling'))),
    '22023: This quote request is closed. Send to Rippling again to reopen it.', 'a closed one');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(ARRAY[pg_temp.bstatus('Paychex'), pg_temp.bstatus('Oasis'), pg_temp.bstatus('Rippling')], ARRAY['quoted', 'declined', 'closed'], 'and nothing changed');
END $$;

-- ---------- 7. Setting the status a quote request already has is refused ----------
-- Catches: a click that records "Acknowledged" again and writes nothing, so the agent believes something was recorded that was not.
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.refusal($s$SELECT pg_temp.setq('TriNet', 'sent')$s$), '22023: TriNet is already Sent.', 'Sent again');
  PERFORM pg_temp.setq('TriNet', 'acknowledged');
  PERFORM pg_temp.is(pg_temp.refusal($s$SELECT pg_temp.setq('TriNet', 'acknowledged')$s$), '22023: TriNet is already Acknowledged.', 'Acknowledged again');
  PERFORM pg_temp.setq('TriNet', 'sent');
END $$;

-- ---------- 8. Every change records who made it and when, and the record can't be rewritten (CRM-Q3.1) ----------
-- Catches: a status that changes with no entry on the quote request's timeline, an entry that names nobody, or one a person with access can rewrite.
DO $$
DECLARE e public.quote_request_events;
BEGIN
  PERFORM pg_temp.setq('Justworks', 'question_open');
  SELECT * INTO e FROM public.quote_request_events x WHERE x.quote_request_id = pg_temp.qr('Justworks') AND x.field = 'status' ORDER BY x.id DESC LIMIT 1;
  PERFORM pg_temp.is(ARRAY[e.old_value, e.new_value], ARRAY['sent', 'question_open'], 'from Sent to Question open');
  PERFORM pg_temp.is(e.changed_by, pg_temp.id('acme_agent'), 'by the agent');
  PERFORM pg_temp.is(e.changed_by_email, 'acme_agent@example.test', 'who is named');
  PERFORM pg_temp.is(e.changed_at > now() - interval '1 minute', true, 'and when');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format('UPDATE public.quote_request_events SET new_value = %L WHERE id = %s', 'sent', e.id)), ':', 1), '42501', 'rewritten');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format('DELETE FROM public.quote_request_events WHERE id = %s', e.id)), ':', 1), '42501', 'deleted');
  PERFORM pg_temp.setq('Justworks', 'sent');
END $$;

-- ---------- 9. The stage: In market while a quote is Sent, Acknowledged or Question open and none is Quoted; Quoted once one is (CRM-Q3.1) ----------
-- Catches: an acknowledgement or a question that moves the opportunity (to Quoted, or back to Ready to send), or a quote recorded while others are
-- Acknowledged or Question open that leaves the opportunity In market.
DO $$
DECLARE opp uuid := (SELECT id FROM public.opportunities WHERE intake_id = pg_temp.id('reyes'));
BEGIN
  PERFORM pg_temp.is(public.opportunity_stage(opp), 'in_market', 'three PEOs sent to: In market');
  PERFORM pg_temp.setq('Insperity', 'acknowledged');
  PERFORM pg_temp.setq('TriNet', 'question_open');
  PERFORM pg_temp.is(public.opportunity_stage(opp), 'in_market', 'Acknowledged, Question open and Sent: still In market');
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.submission_status_history WHERE session_id = pg_temp.id('reyes') AND to_status = 'quoted'), 0, 'and no move was recorded');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.advisor_update_quote_request(pg_temp.qr('Justworks'), 'quoted', current_date, current_date + 30, current_date + 45, 40);
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(public.opportunity_stage(opp), 'quoted', 'one quote recorded: Quoted');
  PERFORM pg_temp.setq('Insperity', 'question_open');
  PERFORM pg_temp.is(public.opportunity_stage(opp), 'quoted', 'a question on another PEO leaves it Quoted');
  PERFORM pg_temp.setq('Insperity', 'sent');
  PERFORM pg_temp.setq('TriNet', 'sent');
END $$;

-- ---------- 10. Sending again answers a question: Question open returns to Sent; Acknowledged stays (CRM-Q3.1) ----------
-- Catches: a PEO's question still showing as open after the agent sent it the answer, so Home keeps asking for an answer already given.
DO $$
BEGIN
  PERFORM pg_temp.setq('Insperity', 'question_open');
  PERFORM pg_temp.sent('reyes', 'Insperity');
  PERFORM pg_temp.is(pg_temp.qstatus('Insperity'), 'sent', 'sending again returns Question open to Sent');
  PERFORM pg_temp.setq('Insperity', 'acknowledged');
  PERFORM pg_temp.sent('reyes', 'Insperity');
  PERFORM pg_temp.is(pg_temp.qstatus('Insperity'), 'acknowledged', 'but an acknowledgement stays');
  PERFORM pg_temp.setq('Insperity', 'sent');
END $$;

-- ---------- 11. An arriving email never changes a status on its own (CRM-Q3.1) ----------
-- Catches: mail that says "we have a question", "received, thank you" or "attached is your quote" moving a quote request by itself; mail only ever suggests.
DO $$
DECLARE local text := (SELECT a.local_part FROM public.quote_request_addresses a WHERE a.quote_request_id = pg_temp.qr('TriNet') AND a.revoked_at IS NULL);
  before text[] := ARRAY[pg_temp.qstatus('Insperity'), pg_temp.qstatus('TriNet'), pg_temp.qstatus('Justworks')];
  words text;
BEGIN
  PERFORM pg_temp.as_service();
  FOREACH words IN ARRAY ARRAY['Got it, thank you. We will review.', 'Can you send the last three years of loss runs?', 'Attached is the quote. It expires in 30 days.'] LOOP
    PERFORM public.record_inbound_mail('re_' || md5(words), ARRAY[local], 'dana@trinet.example', 'Dana', ARRAY['x@y.example'], NULL, 'Re: Reyes Bakery', words, false, NULL, false, now());
  END LOOP;
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.quote_request_messages WHERE quote_request_id = pg_temp.qr('TriNet') AND direction = 'received'), 3, 'the three messages arrived');
  PERFORM pg_temp.is(ARRAY[pg_temp.qstatus('Insperity'), pg_temp.qstatus('TriNet'), pg_temp.qstatus('Justworks')], before, 'and no status moved');
END $$;

-- ---------- 12. Recording a send made outside the product answers a question the same way ----------
-- Catches: an agent who emailed the answer from their own mail and recorded it, with the PEO's question still shown open.
DO $$
BEGIN
  PERFORM pg_temp.setq('TriNet', 'question_open');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.advisor_record_quote_send(pg_temp.id('reyes'), 'TriNet');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.qstatus('TriNet'), 'sent', 'Question open returns to Sent');
  PERFORM pg_temp.setq('TriNet', 'acknowledged');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.advisor_record_quote_send(pg_temp.id('reyes'), 'TriNet');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.qstatus('TriNet'), 'acknowledged', 'an acknowledgement stays');
  PERFORM pg_temp.setq('TriNet', 'sent');
END $$;

-- ---------- 13. The menu's open quotes count follows the new statuses (D-1707) ----------
-- Catches: a PEO that acknowledged or asked a question dropping out of the menu's Quotes count, so the number says fewer quotes are open than are.
DO $$
DECLARE n integer;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  n := (public.menu_counts() ->> 'quotes')::integer;
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(n, 2, 'Insperity and TriNet are Sent');
  PERFORM pg_temp.setq('Insperity', 'acknowledged');
  PERFORM pg_temp.setq('TriNet', 'question_open');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  n := (public.menu_counts() ->> 'quotes')::integer;
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(n, 2, 'Acknowledged and Question open still count');
  PERFORM pg_temp.setq('Insperity', 'sent');
  PERFORM pg_temp.setq('TriNet', 'sent');
END $$;

-- A third employer, Cleo Co, with one PEO that acknowledged and nothing else: it is open only because of the new status.
DO $$
BEGIN
  PERFORM pg_temp.intake('cleo', 'acme', 'Cleo Co');
  PERFORM pg_temp.certify('cleo', 1, 'EAA-2026-0045');
  PERFORM pg_temp.authorize('cleo', 'Gusto', true);
  PERFORM pg_temp.sent('cleo', 'Gusto');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.advisor_set_quote_request_status((SELECT id FROM public.quote_requests WHERE session_id = pg_temp.id('cleo')), 'acknowledged');
  PERFORM pg_temp.as_owner();
END $$;

-- The queue's rows for Acme's agent, as the page asks for them: the companies waiting on a PEO (the filter), or every company with its flag.
CREATE FUNCTION pg_temp.queue(filters text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  r := public.queue_list_submissions(filters::jsonb, NULL, 'asc', 1, NULL, 'UTC') -> 'rows';
  PERFORM pg_temp.as_owner();
  RETURN r;
END $$;

-- ---------- 14. The queue's "Waiting on a PEO" follows the new statuses ----------
-- Catches: an employer whose only open quote is Acknowledged or has a question open vanishing from "Waiting on a PEO", or shown as not waiting.
DO $$
BEGIN
  PERFORM pg_temp.is((SELECT jsonb_agg(r ->> 'company_name' ORDER BY r ->> 'company_name') FROM jsonb_array_elements(pg_temp.queue('[{"field":"waiting_on_peo","op":"is","value":true}]')) r),
    '["Cleo Co", "Reyes Bakery"]'::jsonb, 'the filter lists Cleo Co (Acknowledged) and Reyes Bakery (Sent)');
  PERFORM pg_temp.is((SELECT (r ->> 'waiting_on_peo')::boolean FROM jsonb_array_elements(pg_temp.queue('[]')) r WHERE r ->> 'company_name' = 'Cleo Co'), true, 'and the row says it is waiting');
  PERFORM pg_temp.is((SELECT (r ->> 'waiting_on_peo')::boolean FROM jsonb_array_elements(pg_temp.queue('[]')) r WHERE r ->> 'company_name' = 'Bella Cafe'), false, 'where a quoted, declined and closed one is not');
END $$;

-- ---------- 15. The wait keeps counting while Acknowledged or Question open (CRM-Q3.1) ----------
-- Catches: the days a PEO has had the packet starting again at nothing, or a stale-version warning disappearing, when it acknowledges or asks.
DO $$
DECLARE row jsonb;
BEGIN
  UPDATE public.quote_requests SET sent_on = current_date - 9 WHERE session_id = pg_temp.id('cleo');
  SELECT r INTO row FROM jsonb_array_elements(pg_temp.queue('[]')) r WHERE r ->> 'company_name' = 'Cleo Co';
  PERFORM pg_temp.is((row ->> 'oldest_waiting_on')::date, current_date - 9, 'Acknowledged: waiting since the day it was sent');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.advisor_set_quote_request_status((SELECT id FROM public.quote_requests WHERE session_id = pg_temp.id('cleo')), 'question_open');
  PERFORM pg_temp.as_owner();
  SELECT r INTO row FROM jsonb_array_elements(pg_temp.queue('[]')) r WHERE r ->> 'company_name' = 'Cleo Co';
  PERFORM pg_temp.is((row ->> 'oldest_waiting_on')::date, current_date - 9, 'Question open: still since the day it was sent');
  PERFORM pg_temp.certify('cleo', 2, 'EAA-2026-0045');
  SELECT r INTO row FROM jsonb_array_elements(pg_temp.queue('[]')) r WHERE r ->> 'company_name' = 'Cleo Co';
  PERFORM pg_temp.is((row ->> 'sent_older_version')::boolean, true, 'and a PEO holding an older version is flagged');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.advisor_set_quote_request_status((SELECT id FROM public.quote_requests WHERE session_id = pg_temp.id('cleo')), 'acknowledged');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 16. The accounts table's "Waiting on a PEO" follows the new statuses ----------
-- Catches: an account whose open quote is Acknowledged or has a question open shown as not waiting on any PEO.
DO $$
DECLARE names jsonb;
BEGIN
  -- The firm's owner sees every account of the firm (an agent sees the accounts they own).
  PERFORM pg_temp.new_user('acme_owner');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (pg_temp.id('acme'), pg_temp.id('acme_owner'), 'owner');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  names := (SELECT jsonb_agg(r ->> 'name' ORDER BY r ->> 'name')
            FROM jsonb_array_elements(public.accounts_list(pg_temp.id('acme'), '[{"field":"waiting_on_peo","op":"is","value":true}]', NULL, 'asc', 1, NULL, 'UTC') -> 'rows') r);
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(names, '["Cleo Co", "Reyes Bakery"]'::jsonb, 'Cleo Co (Acknowledged) and Reyes Bakery (Sent) are waiting; Bella Cafe is not');
END $$;

-- ---------- 16b. The queue's other path (a sort the fast path can't answer) reads "waiting on a PEO" the same way ----------
-- Catches: the queue flag right when it is filtered and wrong when it is sorted by company, because the two paths each hold their own copy of the rule.
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is((SELECT (r ->> 'waiting_on_peo')::boolean FROM jsonb_array_elements(public.queue_list_submissions('[]'::jsonb, 'company_name', 'asc', 1, NULL, 'UTC') -> 'rows') r
                      WHERE r ->> 'company_name' = 'Cleo Co'), true, 'Cleo Co (Acknowledged), sorted by company: waiting');
  PERFORM pg_temp.is((SELECT (r ->> 'waiting_on_peo')::boolean FROM jsonb_array_elements(public.queue_list_submissions('[]'::jsonb, 'company_name', 'asc', 1, NULL, 'UTC') -> 'rows') r
                      WHERE r ->> 'company_name' = 'Bella Cafe'), false, 'Bella Cafe (quoted, declined, closed): not');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 17. Archiving a submission closes every open quote, the new statuses too ----------
-- Catches: a quote request left Acknowledged or Question open on an archived search, so it still counts as open and still sits under "Needs you".
DO $$
BEGIN
  PERFORM pg_temp.is((SELECT status FROM public.quote_requests WHERE session_id = pg_temp.id('cleo')), 'acknowledged', 'Gusto has acknowledged');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.set_submission_status(pg_temp.id('cleo'), 'archived');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT status FROM public.quote_requests WHERE session_id = pg_temp.id('cleo')), 'closed', 'archived: Gusto is closed');
END $$;

-- ---------- 18. Closing with a withdrawal tells the PEOs that are Acknowledged or have a question open, as it tells a Sent one ----------
-- Catches: a PEO that asked a question, or acknowledged, never told the search is over, because the withdrawal looked only for Sent and Quoted.
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.intake('dora', 'acme', 'Dora Dental');
  PERFORM pg_temp.certify('dora', 1, 'EAA-2026-0046');
  PERFORM pg_temp.authorize('dora', 'Paycom', true);
  PERFORM pg_temp.authorize('dora', 'Ceridian', true);
  PERFORM pg_temp.sent('dora', 'Paycom');
  PERFORM pg_temp.sent('dora', 'Ceridian');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.advisor_set_quote_request_status((SELECT id FROM public.quote_requests WHERE session_id = pg_temp.id('dora') AND peo_name = 'Paycom'), 'question_open');
  PERFORM public.advisor_set_quote_request_status((SELECT id FROM public.quote_requests WHERE session_id = pg_temp.id('dora') AND peo_name = 'Ceridian'), 'acknowledged');
  r := public.close_submission_and_withdraw(pg_temp.id('dora'), 'archived', NULL, NULL, 'Dora Dental', 'Thank you; they have chosen another PEO.');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(jsonb_array_length(r -> 'message_ids'), 2, 'a note to each of the two');
  PERFORM pg_temp.is((SELECT array_agg(status ORDER BY peo_name) FROM public.quote_requests WHERE session_id = pg_temp.id('dora')), ARRAY['closed', 'closed'], 'both closed');
END $$;

-- ---------- 19. The opportunity's activity shows an acknowledgement and a question as events, with who recorded them ----------
-- Catches: a PEO's question that the page says is open, with nothing in the activity to say when it was recorded or by whom.
DO $$
DECLARE rows jsonb; q bigint;
BEGIN
  PERFORM pg_temp.intake('eve', 'acme', 'Eve Events');
  PERFORM pg_temp.certify('eve', 1, 'EAA-2026-0047');
  PERFORM pg_temp.authorize('eve', 'Zenefits', true);
  PERFORM pg_temp.sent('eve', 'Zenefits');
  q := (SELECT id FROM public.quote_requests WHERE session_id = pg_temp.id('eve'));
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.advisor_set_quote_request_status(q, 'acknowledged');
  PERFORM public.advisor_set_quote_request_status(q, 'question_open');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  rows := public.opportunity_activity(pg_temp.id('acme'), (SELECT id FROM public.opportunities WHERE intake_id = pg_temp.id('eve')), 'all', 100, 0) -> 'rows';
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT array_agg(r ->> 'event' ORDER BY r ->> 'event') FROM jsonb_array_elements(rows) r WHERE r ->> 'type' = 'quote'),
    ARRAY['acknowledged', 'question_open', 'sent'], 'the send, the acknowledgement and the question');
  PERFORM pg_temp.is((SELECT r ->> 'who_kind' FROM jsonb_array_elements(rows) r WHERE r ->> 'event' = 'question_open'), 'member', 'recorded by a member of the firm');
END $$;

-- ---------- 20. From Acknowledged or Question open a PEO still quotes, declines or is closed, as from Sent (CRM-Q3.1) ----------
-- Catches: the record-a-quote, record-a-decline and close paths refusing a quote request because it is in one of the new statuses.
DO $$
DECLARE r jsonb; a bigint; b bigint; c bigint;
BEGIN
  PERFORM pg_temp.intake('flo', 'acme', 'Flo Florist');
  PERFORM pg_temp.certify('flo', 1, 'EAA-2026-0048');
  PERFORM pg_temp.authorize('flo', 'Alpha', true); PERFORM pg_temp.authorize('flo', 'Beta', true); PERFORM pg_temp.authorize('flo', 'Gamma', true);
  PERFORM pg_temp.sent('flo', 'Alpha'); PERFORM pg_temp.sent('flo', 'Beta'); PERFORM pg_temp.sent('flo', 'Gamma');
  SELECT id INTO a FROM public.quote_requests WHERE session_id = pg_temp.id('flo') AND peo_name = 'Alpha';
  SELECT id INTO b FROM public.quote_requests WHERE session_id = pg_temp.id('flo') AND peo_name = 'Beta';
  SELECT id INTO c FROM public.quote_requests WHERE session_id = pg_temp.id('flo') AND peo_name = 'Gamma';
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.advisor_set_quote_request_status(a, 'acknowledged');
  PERFORM public.advisor_set_quote_request_status(b, 'question_open');
  PERFORM public.advisor_set_quote_request_status(c, 'question_open');
  PERFORM public.advisor_update_quote_request(a, 'quoted', current_date, current_date + 30, current_date + 45, 38);
  PERFORM public.advisor_update_quote_request(b, 'declined');
  PERFORM public.advisor_update_quote_request(c, 'closed');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT array_agg(status ORDER BY peo_name) FROM public.quote_requests WHERE session_id = pg_temp.id('flo')), ARRAY['quoted', 'declined', 'closed'], 'quoted, declined, closed');
  PERFORM pg_temp.is(public.opportunity_stage((SELECT id FROM public.opportunities WHERE intake_id = pg_temp.id('flo'))), 'quoted', 'and the opportunity is Quoted');
END $$;

-- ---------- 21. A quote's expiry moves nothing (D-1705) ----------
-- Catches: a quote that expires by itself turning Closed (or the opportunity leaving Quoted) on a read, with nobody having decided; only an agent closes it.
DO $$
DECLARE events integer := (SELECT count(*) FROM public.quote_request_events);
BEGIN
  UPDATE public.quote_requests SET quote_expires_on = current_date - 3 WHERE id = pg_temp.bqr('Paychex');
  events := (SELECT count(*) FROM public.quote_request_events);
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.menu_counts();
  PERFORM public.queue_list_submissions('[]'::jsonb, NULL, 'asc', 1, NULL, 'UTC');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.bstatus('Paychex'), 'quoted', 'an expired quote is still Quoted');
  PERFORM pg_temp.is(public.opportunity_stage((SELECT id FROM public.opportunities WHERE intake_id = pg_temp.id('bella'))), 'quoted', 'and so is its opportunity');
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.quote_request_events), events::integer, 'and nothing was recorded');
END $$;

\echo quote_statuses: all passed
