-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh decline_reason
-- A decline keeps its reason (N-1.4, slice 7.1, joshrkay/Nevermore#206; the list and the rules are #88's decisions 5 and 6; 20261124130000_decline_reason.sql).
-- advisor_update_quote_request takes a decline reason: required when the answer is declined, refused for any other answer, one of six, logged like any change
-- (quote_request_events), and cleared when the request is answered some other way. The PEO's words stay in the request's own note. A request that was declined
-- before the reason existed reads as declined with no reason. Two firms. Every migration is loaded, in filename order (D-105), this one's last.
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
\i supabase/migrations/20261124100000_firm_approval_gates_sending.sql
\i supabase/migrations/20261124110000_leads_can_convert.sql
\i supabase/migrations/20261124120000_opportunity_activity_intake.sql
\i supabase/migrations/20261124130000_decline_reason.sql
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

-- ---------- set up: two firms; an agent of each; an intake of each, certified and authorized for Insperity, with a quote request sent ----------
DO $$
DECLARE acme uuid; zenith uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Acme Brokers', 'acme-brokers', now()) RETURNING id INTO acme;
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Zenith Benefits', 'zenith-benefits', now()) RETURNING id INTO zenith;
  INSERT INTO fx VALUES ('acme', acme), ('zenith', zenith);
  PERFORM pg_temp.new_user('acme_agent'); PERFORM pg_temp.new_user('zenith_agent');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (acme, pg_temp.id('acme_agent'), 'agent'), (zenith, pg_temp.id('zenith_agent'), 'agent');
  PERFORM pg_temp.intake('reyes', 'acme', 'Reyes Bakery');
  PERFORM pg_temp.certify('reyes', 1, 'EAA-2026-0042');
  PERFORM pg_temp.authorize('reyes', 'Insperity', true);
  PERFORM pg_temp.intake('zed', 'zenith', 'Zed Tools');
  PERFORM pg_temp.certify('zed', 1, 'EAA-2026-0043');
  PERFORM pg_temp.authorize('zed', 'Insperity', true);
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.advisor_record_quote_send(pg_temp.id('reyes'), 'Insperity');
  PERFORM pg_temp.as_owner();
END $$;

CREATE FUNCTION pg_temp.qr(intake text) RETURNS bigint LANGUAGE sql STABLE AS $$ SELECT id FROM public.quote_requests WHERE session_id = pg_temp.id(intake) $$;
CREATE FUNCTION pg_temp.row_of(intake text) RETURNS public.quote_requests LANGUAGE sql STABLE AS $$ SELECT q FROM public.quote_requests q WHERE q.session_id = pg_temp.id(intake) $$;

-- An answer as Acme's agent: the SQLSTATE and message when it is refused, else 'ok'.
CREATE FUNCTION pg_temp.answer(status text, reason text DEFAULT NULL, note text DEFAULT NULL, who text DEFAULT 'acme_agent', addr text DEFAULT 'acme-brokers', intake text DEFAULT 'reyes') RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text; q bigint := pg_temp.qr(intake);  -- read before the role changes: another firm's agent cannot see the request
BEGIN
  PERFORM pg_temp.as_user(who, addr);
  r := pg_temp.refusal(format($s$SELECT public.advisor_update_quote_request(%s, %L, NULL, NULL, NULL, NULL, %L, %L)$s$, q, status, note, reason));
  PERFORM pg_temp.as_owner();
  RETURN r;
END $$;

-- ---------- 1. A decline needs a reason ----------
-- Catches: a decline recorded with no reason (#88: "required when a quote request is marked declined"), so the funnel could never say why PEOs decline, or a refusal that
-- leaves the request half-changed.
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.answer('declined', NULL, 'Not a fit for us'),
    '22023: Say why it declined: below minimum headcount, a state not served, industry or class code excluded, claims or loss history, incomplete information, or other.',
    'a decline with no reason is refused, in words that name the choices');
  PERFORM pg_temp.is((pg_temp.row_of('reyes')).status, 'sent', 'and the quote request is as it was');
  PERFORM pg_temp.is((pg_temp.row_of('reyes')).note, NULL, 'its note too');
END $$;

-- ---------- 2. A reason is kept, beside the PEO's words ----------
-- Catches: the reason not stored, the PEO's words lost (the note is where they go, N-1.4), or an answer that does not say which reason it recorded.
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  r := public.advisor_update_quote_request(pg_temp.qr('reyes'), 'declined', NULL, NULL, NULL, NULL, 'Dana: "We do not write bakeries in Oregon."', 'state_not_served');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(r ->> 'status', 'declined', 'declined');
  PERFORM pg_temp.is(r ->> 'decline_reason', 'state_not_served', 'with its reason in the answer');
  PERFORM pg_temp.is((pg_temp.row_of('reyes')).decline_reason, 'state_not_served', 'and stored');
  PERFORM pg_temp.is((pg_temp.row_of('reyes')).note, 'Dana: "We do not write bakeries in Oregon."', 'beside the PEO''s words');
END $$;

-- ---------- 3. Each of the six reasons is accepted, and nothing else ----------
-- Catches: a reason of the list refused (a word typed differently here and on the screen), or one outside the list stored (a funnel that counts reasons nobody can name).
DO $$
DECLARE reason text;
BEGIN
  FOREACH reason IN ARRAY ARRAY['below_minimum_headcount', 'state_not_served', 'industry_or_class_code_excluded', 'claims_or_loss_history', 'incomplete_information', 'other'] LOOP
    PERFORM pg_temp.is(pg_temp.answer('declined', reason, 'again'), 'ok', reason || ' is accepted');
    PERFORM pg_temp.is((pg_temp.row_of('reyes')).decline_reason, reason, reason || ' is what is stored');
  END LOOP;
  PERFORM pg_temp.is(pg_temp.answer('declined', 'too_expensive', 'again'), '22023: Choose one of the reasons a PEO declines: below minimum headcount, a state not served, industry or class code excluded, claims or loss history, incomplete information, or other.',
    'a reason outside the list is refused');
  PERFORM pg_temp.is((pg_temp.row_of('reyes')).decline_reason, 'other', 'and the last one stands');
END $$;

-- ---------- 4. Only a decline has a reason ----------
-- Catches: a reason sent with a quote or a closing and kept (#88: "refused for any other status"), so a quoted request would carry a decline reason.
DO $$
DECLARE before_ jsonb := to_jsonb(pg_temp.row_of('reyes'));
BEGIN
  PERFORM pg_temp.is(pg_temp.answer('quoted', 'other'), '22023: Only a decline has a reason. Mark it declined, or leave the reason empty.', 'a quote with a reason');
  PERFORM pg_temp.is(pg_temp.answer('closed', 'other'), '22023: Only a decline has a reason. Mark it declined, or leave the reason empty.', 'a closing with a reason');
  PERFORM pg_temp.is(to_jsonb(pg_temp.row_of('reyes')), before_, 'and the quote request is untouched');
END $$;

-- ---------- 5. Every change of the reason is logged ----------
-- Catches: the reason changing unlogged (quote_request_events is the quote request's record of who changed what and when), or a log entry that names no one.
DO $$
DECLARE e public.quote_request_events;
BEGIN
  SELECT * INTO e FROM public.quote_request_events WHERE quote_request_id = pg_temp.qr('reyes') AND field = 'decline_reason' AND new_value = 'state_not_served';
  PERFORM pg_temp.is(e.old_value, NULL, 'the first reason is logged from nothing');
  PERFORM pg_temp.is(e.changed_by, pg_temp.id('acme_agent'), 'by the agent who recorded it');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.quote_request_events WHERE quote_request_id = pg_temp.qr('reyes') AND field = 'decline_reason'), 7,
    'one entry for each change: state not served, then the six reasons in turn, each different from the one before it');
END $$;

-- ---------- 6. Answering some other way clears the reason ----------
-- Catches: a request that was declined, then quoted, still carrying its old reason (it would be counted as a decline), or the clearing unlogged.
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  r := public.advisor_update_quote_request(pg_temp.qr('reyes'), 'quoted', current_date, current_date + 30, current_date + 60, 132, 'They came back with a quote');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(r ->> 'status', 'quoted', 'quoted after all');
  PERFORM pg_temp.is(r ->> 'decline_reason', NULL, 'the reason is gone');
  PERFORM pg_temp.is((pg_temp.row_of('reyes')).decline_reason, NULL, 'from the row');
  PERFORM pg_temp.is((SELECT e.old_value FROM public.quote_request_events e WHERE e.quote_request_id = pg_temp.qr('reyes') AND e.field = 'decline_reason' AND e.new_value IS NULL), 'other', 'and the clearing is in the log');
END $$;

-- ---------- 7. The calls that know nothing of the reason still work, and every rule the function had still holds ----------
-- Catches: the new argument breaking a caller that sends seven (the function is dropped and made again with the eighth defaulted), or a rule lost in the restating (D-104):
-- another firm's agent, a prospect, a closing firm, a note over 2000 characters, an answer of "sent", a fee on a decline.
DO $$
DECLARE q bigint := pg_temp.qr('reyes');
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.advisor_update_quote_request(q, 'quoted', current_date, current_date + 30, current_date + 60, 118, 'seven arguments');
  PERFORM pg_temp.is((pg_temp.row_of('reyes')).admin_fee_pepm, 118::numeric, 'seven arguments: a quote is recorded as before');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(split_part(pg_temp.answer('quoted', NULL, NULL, 'zenith_agent', 'zenith-benefits', 'reyes'), ':', 1), 'PT404', 'another firm''s agent: not found');
  PERFORM pg_temp.as_user('p_reyes');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($s$SELECT public.advisor_update_quote_request(%s, 'quoted')$s$, q)), ':', 1), '42501', 'a prospect');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(split_part(pg_temp.answer('sent'), ':', 1), '22023', 'an answer of sent');
  PERFORM pg_temp.is(split_part(pg_temp.answer('declined', 'other', repeat('x', 2001)), ':', 1), '22023', 'a note over 2000 characters');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($s$SELECT public.advisor_update_quote_request(%s, 'declined', NULL, NULL, NULL, 99, 'x', 'other')$s$, q)), ':', 1), '22023', 'a fee on a decline');
  PERFORM pg_temp.as_owner();
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (pg_temp.id('acme'), pg_temp.id('acme_agent'), now() + interval '30 days');
  PERFORM pg_temp.is(split_part(pg_temp.answer('declined', 'other'), ':', 1), 'PT423', 'a closing firm');
  DELETE FROM public.firm_closures WHERE firm_id = pg_temp.id('acme');
END $$;

-- ---------- 8. A request declined before the reason existed reads as declined with none, and cannot be saved declined without one ----------
-- Catches: the new rule breaking the requests already on file (a declined one with no reason must still be there and readable), or letting such a request be
-- re-saved as declined with no reason, which would carry the gap forward.
DO $$
BEGIN
  UPDATE public.quote_requests SET status = 'declined', decline_reason = NULL WHERE id = pg_temp.qr('reyes');
  PERFORM pg_temp.is((pg_temp.row_of('reyes')).status, 'declined', 'declined');
  PERFORM pg_temp.is((pg_temp.row_of('reyes')).decline_reason, NULL, 'with no reason');
  PERFORM pg_temp.is(split_part(pg_temp.answer('declined', NULL, 'edited note'), ':', 1), '22023', 'saving it declined again needs a reason');
  PERFORM pg_temp.is(pg_temp.answer('declined', 'incomplete_information', 'edited note'), 'ok', 'with one it is saved');
END $$;

-- ---------- 9. The column holds only the six, whatever writes it ----------
-- Catches: a write path that does not go through advisor_update_quote_request (a bulk close, a repair run by hand) storing a reason nobody can name.
DO $$
BEGIN
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($s$UPDATE public.quote_requests SET decline_reason = 'bogus' WHERE id = %s$s$, pg_temp.qr('reyes'))), ':', 1), '23514', 'a reason outside the list, written directly');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$UPDATE public.quote_requests SET decline_reason = 'other' WHERE id = %s$s$, pg_temp.qr('reyes'))), 'ok', 'one inside it');
END $$;

\echo PASS decline_reason
