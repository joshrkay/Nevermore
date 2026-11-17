-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh peo_registrations
-- The registration record and the warning about a second submission (Q-2.1, Q-2.2, slice 6.10, #204; docs/BROKER_CRM_BUILD.md D-604, D-1630 to
-- D-1639; 20261122200000_peo_registrations.sql). Every send to a PEO writes an append-only registration; a firm reads a statement of its own; before
-- a send the advisor is told another firm registered the same employer with the same PEO, and when, never who. Two firms. Every migration is
-- loaded, in filename order (D-105), this slice's last.
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

-- The intake's answers, set as the superuser with its triggers off (the FEIN, the company's name, its headquarters' state), before it is certified.
CREATE FUNCTION pg_temp.answers(n text, data jsonb) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);
  UPDATE public.chamber_sessions SET chamber_data = chamber_data || data WHERE id = pg_temp.id(n);
  PERFORM set_config('session_replication_role', 'origin', true);
END $$;

-- ---------- set up: two firms, each an agent with a mailbox; the same employer (FEIN 123456789) is an intake of each, certified, Insperity authorized ----------
DO $$
DECLARE acme uuid; zenith uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Acme Brokers', 'acme-brokers', now()) RETURNING id INTO acme;
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Zenith Benefits', 'zenith-benefits', now()) RETURNING id INTO zenith;
  INSERT INTO fx VALUES ('acme', acme), ('zenith', zenith);
  PERFORM pg_temp.new_user('acme_agent'); PERFORM pg_temp.new_user('zenith_agent');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (acme, pg_temp.id('acme_agent'), 'agent'), (zenith, pg_temp.id('zenith_agent'), 'agent');
  PERFORM pg_temp.mailbox('acme_agent', 'sam@acme.example');
  PERFORM pg_temp.mailbox('zenith_agent', 'zoe@zenith.example');
  PERFORM pg_temp.intake('reyes', 'acme', 'Reyes Bakery');
  PERFORM pg_temp.answers('reyes', '{"fein": "123456789", "hq_state": "CA"}');
  PERFORM pg_temp.certify('reyes', 1, 'EAA-2026-0042');
  PERFORM pg_temp.authorize('reyes', 'Insperity', true);
  PERFORM pg_temp.intake('reyes_z', 'zenith', 'Reyes Bakery LLC');
  PERFORM pg_temp.answers('reyes_z', '{"fein": "123456789", "hq_state": "CA"}');
  PERFORM pg_temp.certify('reyes_z', 1, 'EAA-2026-0043');
  PERFORM pg_temp.authorize('reyes_z', 'Insperity', true);
END $$;

-- A send as a firm's agent; answers send_to_peo's answer.
CREATE FUNCTION pg_temp.send(intake text, peo text, who text DEFAULT 'acme_agent', addr text DEFAULT 'acme-brokers') RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user(who, addr);
  r := public.send_to_peo(pg_temp.id(intake), peo, ARRAY['dana@insperity.example'], 'A submission', 'Dana, here is a submission for a quote.');
  PERFORM pg_temp.as_owner();
  RETURN r;
END $$;

-- ---------- 1. A send writes a registration in its own transaction: the firm, the PEO, the employer's FEIN, the version and the time ----------
-- Catches: a send that leaves no proof of when the firm submitted the employer to the PEO (Q-2.1).
DO $$
DECLARE g public.peo_registrations;
BEGIN
  PERFORM pg_temp.send('reyes', 'Insperity');
  SELECT * INTO STRICT g FROM public.peo_registrations WHERE firm_id = pg_temp.id('acme');
  PERFORM pg_temp.is(g.peo_name, 'Insperity', 'the PEO');
  PERFORM pg_temp.is(g.fein, '123456789', 'the employer''s FEIN');
  PERFORM pg_temp.is(g.version, 1, 'the version sent');
  PERFORM pg_temp.is(g.registered_at, now(), 'when, the send''s own moment');
END $$;

-- ---------- 2. Where the employer has no FEIN, the registration names it by its name and state ----------
-- Catches: a registration that says nothing of who the employer was when the prospect gave no FEIN.
DO $$
DECLARE g public.peo_registrations;
BEGIN
  PERFORM pg_temp.intake('bay', 'acme', 'Bay Cafe');
  PERFORM pg_temp.answers('bay', '{"hq_state": "TX"}');
  PERFORM pg_temp.certify('bay', 1, 'EAA-2026-0050');
  PERFORM pg_temp.authorize('bay', 'Insperity', true);
  PERFORM pg_temp.send('bay', 'Insperity');
  SELECT * INTO STRICT g FROM public.peo_registrations WHERE file_id = 'EAA-2026-0050';
  PERFORM pg_temp.is(g.fein, NULL::text, 'no FEIN');
  PERFORM pg_temp.is(g.employer_name, 'Bay Cafe', 'the employer''s name');
  PERFORM pg_temp.is(g.employer_state, 'TX', 'and its state');
END $$;

-- ---------- 3. Nobody changes or deletes a registration: not a member, not an admin, not the table's owner ----------
-- Catches: proof of a submission that can be backdated, moved to another firm or removed after the fact (Q-2.1's second criterion).
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.refusal($s$UPDATE public.peo_registrations SET registered_at = now() - interval '1 year'$s$),
    '42501: peo_registrations records cannot be changed or deleted', 'a change, as the superuser');
  PERFORM pg_temp.is(pg_temp.refusal($s$DELETE FROM public.peo_registrations$s$),
    '42501: peo_registrations records cannot be changed or deleted', 'a delete, as the superuser');
  PERFORM pg_temp.is(pg_temp.refusal($s$TRUNCATE public.peo_registrations$s$),
    '42501: peo_registrations records cannot be changed or deleted', 'emptying the table, as the superuser');
END $$;

-- ---------- 4. The table is closed to the API: no one reads it or writes it but through its functions ----------
-- Catches: a member reading the FEINs other firms registered straight from the table, or writing a registration no send made.
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal('SELECT count(*) FROM public.peo_registrations'), '42501: permission denied for table peo_registrations', 'a member reads');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($s$INSERT INTO public.peo_registrations (firm_id, peo_id, peo_name, file_id, version) VALUES (%L, 1, 'Insperity', 'X', 1)$s$,
    pg_temp.id('acme'))), ':', 1), '42501', 'a member writes');
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(pg_temp.refusal('SELECT count(*) FROM public.peo_registrations'), '42501: permission denied for table peo_registrations', 'the service role reads');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 4b. The writer is the send's alone: no API role calls it ----------
-- Catches: a member forging a registration (an earlier date for an employer they never sent) by calling the writer the send uses.
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.register_peo_send(%L, 'Insperity', 1)$s$, pg_temp.id('reyes'))),
    '42501: permission denied for function register_peo_send', 'a member');
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.register_peo_send(%L, 'Insperity', 1)$s$, pg_temp.id('reyes'))),
    '42501: permission denied for function register_peo_send', 'the service role');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 5. Before a send, another firm's registration of the same employer (same FEIN) with the same PEO is told: that one exists and when ----------
-- Catches: an advisor who sends an employer another firm already submitted to the PEO without being told (Q-2.2), or a warning that names the firm.
DO $$
DECLARE r jsonb; first_at timestamptz := (SELECT registered_at FROM public.peo_registrations WHERE firm_id = pg_temp.id('acme') AND fein = '123456789');
BEGIN
  PERFORM pg_temp.as_user('zenith_agent', 'zenith-benefits');
  r := public.peo_registered_elsewhere(pg_temp.id('reyes_z'));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(r, jsonb_build_array(jsonb_build_object('peo', 'Insperity', 'registered_at', first_at)), 'Insperity, and when; nothing of who');
END $$;

-- ---------- 6. The warning answers only for an intake of the caller's own firm, and only to its advisors ----------
-- Catches: a firm probing for employers it doesn't hold by asking about another firm's intake, or a prospect asking about their own intake.
DO $$
BEGIN
  PERFORM pg_temp.as_user('zenith_agent', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.peo_registered_elsewhere(%L)', pg_temp.id('reyes'))), 'PT404: Submission not found', 'another firm''s intake');
  PERFORM pg_temp.as_user('p_reyes_z');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format('SELECT public.peo_registered_elsewhere(%L)', pg_temp.id('reyes_z'))), ':', 1), '42501', 'the prospect');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format('SELECT public.peo_registered_elsewhere(%L)', pg_temp.id('reyes_z'))), ':', 1), '42501', 'signed out');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 7. With no FEIN, the same employer is the same name (case, spaces and punctuation aside) in the same state ----------
-- Catches: no warning for an employer that gave no FEIN, or a warning for a namesake in another state.
DO $$
BEGIN
  PERFORM pg_temp.intake('bay_z', 'zenith', 'BAY  CAFE.');
  PERFORM pg_temp.answers('bay_z', '{"hq_state": "TX"}');
  PERFORM pg_temp.certify('bay_z', 1, 'EAA-2026-0060');
  PERFORM pg_temp.intake('bay_nv', 'zenith', 'Bay Cafe');
  PERFORM pg_temp.answers('bay_nv', '{"hq_state": "NV"}');
  PERFORM pg_temp.certify('bay_nv', 1, 'EAA-2026-0061');
  PERFORM pg_temp.as_user('zenith_agent', 'zenith-benefits');
  PERFORM pg_temp.is(jsonb_path_query_array(public.peo_registered_elsewhere(pg_temp.id('bay_z')), '$[*].peo'), '["Insperity"]'::jsonb, 'the same name in the same state');
  PERFORM pg_temp.is(public.peo_registered_elsewhere(pg_temp.id('bay_nv')), '[]'::jsonb, 'not a namesake in another state');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 8. The warning never blocks: the second firm's send goes, and is registered too; a firm's own registrations never warn it ----------
-- Catches: a send refused because another firm was first (D-604: who owns an intake is QP-D4's, not code's), or a firm warned about itself.
DO $$
DECLARE r jsonb; told jsonb; zenith_at timestamptz;
BEGIN
  r := pg_temp.send('reyes_z', 'Insperity', 'zenith_agent', 'zenith-benefits');
  PERFORM pg_temp.is(r ? 'message_id', true, 'Zenith''s send goes');
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.peo_registrations WHERE fein = '123456789'), 2, 'and both firms'' registrations are kept');
  PERFORM pg_temp.as_user('zenith_agent', 'zenith-benefits');
  PERFORM pg_temp.is(jsonb_array_length(public.peo_registered_elsewhere(pg_temp.id('reyes_z'))), 1, 'Zenith is told of Acme''s alone, not its own');
  -- Acme's own registration is the earlier one: were a firm's own counted, Acme would be told of it, not of Zenith's.
  PERFORM pg_temp.as_owner();
  zenith_at := (SELECT registered_at FROM public.peo_registrations WHERE firm_id = pg_temp.id('zenith'));
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  told := public.peo_registered_elsewhere(pg_temp.id('reyes'));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((told -> 0 ->> 'registered_at')::timestamptz, zenith_at, 'Acme is told of Zenith''s, not its own earlier one');
END $$;

-- ---------- 9. A firm's statement: its own registrations, oldest first, dated, the FEIN by its last four digits ----------
-- Catches: a firm with no proof it can hand over, a statement that lists another firm's registrations, or one that carries a whole FEIN (D-48).
DO $$
DECLARE s jsonb; first_row jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  s := public.peo_registration_statement();
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(s ->> 'firm', 'Acme Brokers', 'the firm''s name');
  PERFORM pg_temp.is((s ->> 'as_of')::timestamptz, now(), 'dated');
  PERFORM pg_temp.is(jsonb_array_length(s -> 'rows'), 2, 'Acme''s two, not Zenith''s');
  first_row := s -> 'rows' -> 0;
  PERFORM pg_temp.is(first_row, jsonb_build_object(
    'registered_at', (SELECT registered_at FROM public.peo_registrations WHERE file_id = 'EAA-2026-0042'),
    'peo', 'Insperity', 'employer', 'Reyes Bakery', 'state', 'CA', 'fein_last_four', '6789', 'file_id', 'EAA-2026-0042', 'version', 1), 'the first, as it was sent');
  PERFORM pg_temp.is(s::text LIKE '%123456789%', false, 'no whole FEIN anywhere in it');
END $$;

-- ---------- 10. Only the firm's own members take its statement; Nevermore support takes none (D-128) ----------
-- Catches: one firm's member reading another's statement at its address, or a support session taking a firm's file out.
DO $$
BEGIN
  PERFORM pg_temp.as_user('zenith_agent', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal('SELECT public.peo_registration_statement()'), ':', 1), '42501', 'another firm''s member at Acme''s address');
  PERFORM pg_temp.as_user('zenith_agent', 'zenith-benefits');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format('SELECT public.peo_registration_statement(%L)', pg_temp.id('acme'))), ':', 1), '42501', 'naming Acme');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.new_user('platform_admin');
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('platform_admin'), 'admin');
  INSERT INTO public.support_sessions (firm_id, admin_id, admin_email, reason, started_at, ends_at)
  VALUES (pg_temp.id('acme'), pg_temp.id('platform_admin'), 'platform_admin@example.test', 'Looking at a stuck email', now(), now() + interval '1 hour');
  PERFORM pg_temp.as_user('platform_admin', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal('SELECT public.peo_registration_statement()'), 'PT423: Nevermore support can look, not change', 'a support session');
  PERFORM pg_temp.as_owner();
  DELETE FROM public.support_sessions WHERE firm_id = pg_temp.id('acme');
END $$;

-- ---------- 11. Deleting the intake keeps its registrations: they are the firm's proof of a send that happened (D-1634) ----------
-- Catches: an intake's deletion that fails on the append-only rule, or one that takes the firm's evidence of when it submitted the employer with it.
DO $$
DECLARE d uuid;
BEGIN
  INSERT INTO public.intake_deletions (session_id, user_id, trigger, reason, status, firm_id)
  VALUES (pg_temp.id('bay'), pg_temp.id('p_bay'), 'request', 'the employer asked', 'claimed', pg_temp.id('acme')) RETURNING id INTO d;
  PERFORM public.complete_intake_deletion(d, 0);
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.chamber_sessions WHERE id = pg_temp.id('bay')), 0, 'the intake is gone');
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.peo_registrations WHERE file_id = 'EAA-2026-0050'), 1, 'its registration is kept');
END $$;
