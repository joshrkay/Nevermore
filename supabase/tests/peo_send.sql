-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh peo_send
-- Sending the bundle to a PEO (M-2.1, slice 6.6, #200; docs/BROKER_CRM_BUILD.md D-602, D-609, D-670 to D-679; 20261122140000_peo_send.sql).
-- An advisor's send (send_to_peo), the bundle link joined to it (attach_peo_link), what the composer reads (peo_send_context), and the send-mail
-- function's own claim, completion and failure for it (claim_peo_mail, complete_peo_mail, fail_peo_mail). Two firms. Every migration is loaded,
-- in filename order (D-105), this slice's last.
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
\i supabase/migrations/20261122220000_lead_page.sql
\i supabase/migrations/20261122230000_request_contact.sql
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

-- ---------- set up: two firms; Acme's agent with a mailbox, Acme's second agent with none; an intake of each firm, certified, Insperity authorized ----------
DO $$
DECLARE acme uuid; zenith uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Acme Brokers', 'acme-brokers', now()) RETURNING id INTO acme;
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Zenith Benefits', 'zenith-benefits', now()) RETURNING id INTO zenith;
  INSERT INTO fx VALUES ('acme', acme), ('zenith', zenith);
  PERFORM pg_temp.new_user('acme_agent'); PERFORM pg_temp.new_user('acme_agent2'); PERFORM pg_temp.new_user('zenith_agent');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES
    (acme, pg_temp.id('acme_agent'), 'agent'), (acme, pg_temp.id('acme_agent2'), 'agent'), (zenith, pg_temp.id('zenith_agent'), 'agent');
  PERFORM pg_temp.mailbox('acme_agent', 'sam@acme.example');
  PERFORM pg_temp.mailbox('zenith_agent', 'zoe@zenith.example');
  PERFORM pg_temp.intake('reyes', 'acme', 'Reyes Bakery');
  PERFORM pg_temp.certify('reyes', 1, 'EAA-2026-0042');
  PERFORM pg_temp.authorize('reyes', 'Insperity', true);
  PERFORM pg_temp.intake('zed', 'zenith', 'Zed Tools');
  PERFORM pg_temp.certify('zed', 1, 'EAA-2026-0043');
  PERFORM pg_temp.authorize('zed', 'Justworks', true);
END $$;

-- A send as Acme's agent to Insperity, to Dana, with the advisor's note; answers send_to_peo's answer.
CREATE FUNCTION pg_temp.send(intake text, peo text, who text DEFAULT 'acme_agent', addr text DEFAULT 'acme-brokers') RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user(who, addr);
  r := public.send_to_peo(pg_temp.id(intake), peo, ARRAY['dana@insperity.example'], 'Reyes Bakery: EAA-2026-0042', 'Dana, here is Reyes Bakery for a quote.');
  PERFORM pg_temp.as_owner();
  RETURN r;
END $$;

-- ---------- 1. A send creates the PEO's quote request with the version sent, records the message queued on its thread, and queues it ----------
-- Catches: a send that records nothing before it goes (D-602), a quote request without the version sent, or a message the outbox never carries.
DO $$
DECLARE r jsonb; q public.quote_requests; m public.quote_request_messages; e public.outbox_events;
BEGIN
  r := pg_temp.send('reyes', 'Insperity');
  SELECT * INTO q FROM public.quote_requests WHERE id = (r ->> 'quote_request_id')::bigint;
  PERFORM pg_temp.is(q.peo_name, 'Insperity', 'the quote request is Insperity''s');
  PERFORM pg_temp.is(q.sent_version, 1, 'the version sent is the latest certified');
  PERFORM pg_temp.is(q.status, 'sent', 'and it is sent');
  SELECT * INTO m FROM public.quote_request_messages WHERE id = (r ->> 'message_id')::bigint;
  PERFORM pg_temp.is(m.quote_request_id, q.id, 'the message is on its thread');
  PERFORM pg_temp.is(m.direction, 'sent', 'sent by the product');
  PERFORM pg_temp.is(m.status, 'queued', 'queued before anything is sent');
  PERFORM pg_temp.is(m.from_address, 'sam@acme.example', 'from the advisor''s own mailbox');
  PERFORM pg_temp.is(m.to_addresses, ARRAY['dana@insperity.example'], 'to the person at the PEO');
  SELECT * INTO e FROM public.outbox_events WHERE kind = 'peo_message' AND (payload ->> 'message_id')::bigint = m.id;
  PERFORM pg_temp.is(e.session_id, pg_temp.id('reyes'), 'queued on the outbox, as the intake''s');
END $$;

-- ---------- 2. The database refuses a send to a PEO the employer hasn't authorized, or withdrew, and records nothing ----------
-- Catches: a send to a PEO without the employer's live authorization (M-1.1: the database refuses it, not only the screen).
DO $$
DECLARE r text; before integer := (SELECT count(*) FROM public.quote_request_messages);
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  r := pg_temp.refusal(format($s$SELECT public.send_to_peo(%L, 'TriNet', ARRAY['ann@trinet.example'], 'S', 'N')$s$, pg_temp.id('reyes')));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(r, '22023: The employer hasn''t authorized TriNet to receive their packet. Ask them to add it.', 'a PEO never authorized is refused');
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.quote_request_messages), before, 'and nothing is recorded');
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.quote_requests WHERE peo_name = 'TriNet'), 0, 'nor a quote request made');
END $$;

-- ---------- 3. A closing firm and a support session send nothing (ADR 0023, ADR 0024) ----------
-- Catches: a send that skips assert_firm_writable, so a firm in its read-only 30 days, or Nevermore support looking at it, still mails a PEO.
DO $$
DECLARE before integer := (SELECT count(*) FROM public.quote_request_messages);
BEGIN
  PERFORM pg_temp.new_user('platform_admin');
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('platform_admin'), 'admin');
  INSERT INTO public.support_sessions (firm_id, admin_id, admin_email, reason, started_at, ends_at)
  VALUES (pg_temp.id('acme'), pg_temp.id('platform_admin'), 'platform_admin@example.test', 'Looking at a stuck email', now(), now() + interval '1 hour');
  PERFORM pg_temp.as_user('platform_admin', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.send_to_peo(%L, 'Insperity', ARRAY['dana@insperity.example'], 'S', 'N')$s$, pg_temp.id('reyes'))),
    'PT423: Nevermore support can look, not change', 'a support session');
  PERFORM pg_temp.as_owner();
  DELETE FROM public.support_sessions WHERE firm_id = pg_temp.id('acme');
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (pg_temp.id('zenith'), pg_temp.id('zenith_agent'), now() + interval '30 days');
  PERFORM pg_temp.as_user('zenith_agent', 'zenith-benefits');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($s$SELECT public.send_to_peo(%L, 'Justworks', ARRAY['jo@justworks.example'], 'S', 'N')$s$, pg_temp.id('zed'))), ':', 1),
    'PT423', 'a closing firm');
  PERFORM pg_temp.as_owner();
  DELETE FROM public.firm_closures WHERE firm_id = pg_temp.id('zenith');
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.quote_request_messages), before, 'and nothing is recorded');
END $$;

-- ---------- 4. Only an advisor of the intake's own firm sends; another firm's intake is not there for them ----------
-- Catches: a member of one firm mailing another firm's employer's packet to a PEO, or a prospect sending as an advisor.
DO $$
BEGIN
  PERFORM pg_temp.as_user('zenith_agent', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.send_to_peo(%L, 'Insperity', ARRAY['dana@insperity.example'], 'S', 'N')$s$, pg_temp.id('reyes'))),
    'PT404: Submission not found', 'another firm''s intake');
  PERFORM pg_temp.as_user('p_reyes');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($s$SELECT public.send_to_peo(%L, 'Insperity', ARRAY['dana@insperity.example'], 'S', 'N')$s$, pg_temp.id('reyes'))), ':', 1),
    '42501', 'the prospect');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 5. While an answer has changed and isn't certified again, sending waits ----------
-- Catches: a send of a version the prospect's answers no longer match (M-2.1: only the latest certified version can be sent).
DO $$
BEGIN
  PERFORM pg_temp.intake('bay', 'acme', 'Bay Cafe');
  PERFORM pg_temp.certify('bay', 1, 'EAA-2026-0050');
  PERFORM pg_temp.authorize('bay', 'Insperity', true);
  PERFORM pg_temp.answer_changed('bay');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.send_to_peo(%L, 'Insperity', ARRAY['dana@insperity.example'], 'S', 'N')$s$, pg_temp.id('bay'))),
    '22023: The prospect changed an answer since certifying. Sending waits until they certify again.', 'answers changed since certifying');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.quote_requests WHERE session_id = pg_temp.id('bay')), 0, 'and no quote request is made');
END $$;

-- ---------- 6. An advisor with no connected mailbox sends nothing, and nothing is recorded (D-634) ----------
-- Catches: a message recorded with no From, which could never go, or a quote request moved for a send that never happens.
DO $$
DECLARE before integer := (SELECT count(*) FROM public.quote_request_messages);
BEGIN
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.send_to_peo(%L, 'Insperity', ARRAY['dana@insperity.example'], 'S', 'N')$s$, pg_temp.id('reyes'))),
    'PT412: Connect your mailbox to send from here.', 'no mailbox');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.quote_request_messages), before, 'and nothing is recorded');
END $$;

-- ---------- 7. A send is addressed to one to ten people at the PEO, each a bare address by the one address rule (D-637) ----------
-- Catches: a send to nobody, or an address that could split a header and add a recipient the advisor never chose.
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.send_to_peo(%L, 'Insperity', ARRAY[' '], 'S', 'N')$s$, pg_temp.id('reyes'))),
    '22023: Address it to at least one person at Insperity.', 'nobody to send to');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.send_to_peo(%L, 'Insperity', ARRAY['dana@insperity.example, eve@evil.example'], 'S', 'N')$s$, pg_temp.id('reyes'))),
    '22023: Enter each address like name@example.com.', 'an address with a comma in it');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.send_to_peo(%L, 'Insperity', array_fill('a@b.example'::text, ARRAY[11]), 'S', 'N')$s$, pg_temp.id('reyes'))),
    '22023: Address it to at most 10 people.', 'more than ten');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 8. The subject and the cover note keep 6.2's limits (D-636) ----------
-- Catches: a subject with a line break, which would start another header, or a send with no note at all.
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.send_to_peo(%L, 'Insperity', ARRAY['dana@insperity.example'], E'S\r\nBcc: eve@evil.example', 'N')$s$, pg_temp.id('reyes'))),
    '22023: A subject is one line.', 'a subject of two lines');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.send_to_peo(%L, 'Insperity', ARRAY['dana@insperity.example'], 'S', '  ')$s$, pg_temp.id('reyes'))),
    '22023: Write a message.', 'no cover note');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 9. A send waits for Ready for market, as a send recorded by hand does ----------
-- Catches: a packet mailed to a PEO while the submission is still under review.
DO $$
BEGIN
  PERFORM pg_temp.intake('early', 'acme', 'Early Birds');
  PERFORM pg_temp.fmove('early', 'under_review');
  PERFORM pg_temp.certify('early', 1, 'EAA-2026-0051');
  PERFORM pg_temp.authorize('early', 'Insperity', true);
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.send_to_peo(%L, 'Insperity', ARRAY['dana@insperity.example'], 'S', 'N')$s$, pg_temp.id('early'))),
    '22023: Move this submission to Ready for market first. It is under review', 'under review');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 10. The send moves Ready for market to Sent to PEOs, in its own transaction (ADR 0026) ----------
-- Catches: a submission left at Ready for market after its packet went to a PEO, as a send recorded by hand would move it.
DO $$
BEGIN
  PERFORM pg_temp.is((SELECT status FROM public.submission_workflow WHERE session_id = pg_temp.id('reyes')), 'sent_to_carrier', 'Reyes Bakery is Sent to PEOs');
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.submission_status_history WHERE session_id = pg_temp.id('reyes') AND to_status = 'sent_to_carrier'), 1,
    'with one entry in its history');
END $$;

-- ---------- 11. A second send continues the PEO's quote request and its thread: In-Reply-To and References name the message before ----------
-- Catches: a second quote request for the same PEO, or a send that starts a new thread in the PEO's mail instead of continuing the one it has.
DO $$
DECLARE first public.quote_request_messages; r jsonb; m public.quote_request_messages;
BEGIN
  SELECT * INTO first FROM public.quote_request_messages WHERE session_id = pg_temp.id('reyes') AND direction = 'sent' ORDER BY id LIMIT 1;
  UPDATE public.quote_requests SET status = 'closed' WHERE id = first.quote_request_id;
  r := pg_temp.send('reyes', 'Insperity');
  PERFORM pg_temp.is((r ->> 'quote_request_id')::bigint, first.quote_request_id, 'the same quote request');
  PERFORM pg_temp.is((SELECT status FROM public.quote_requests WHERE id = first.quote_request_id), 'sent', 'reopened by the send');
  SELECT * INTO m FROM public.quote_request_messages WHERE id = (r ->> 'message_id')::bigint;
  PERFORM pg_temp.is(m.message_id ~ '^<[0-9a-f-]{36}@acme\.example>$', true, 'its own Message-ID, at the From domain');
  PERFORM pg_temp.is(m.in_reply_to, first.message_id, 'In-Reply-To the message before');
  PERFORM pg_temp.is(m.message_references, ARRAY[first.message_id], 'References the thread so far');
END $$;

-- ---------- 12. After the PEO replies, the next send answers the reply: In-Reply-To its Message-ID, References its References and it ----------
-- Catches: a send that answers the advisor's own last message and skips the PEO's reply, splitting the thread in the PEO's mail.
DO $$
DECLARE q bigint; r jsonb; m public.quote_request_messages;
BEGIN
  SELECT id INTO q FROM public.quote_requests WHERE session_id = pg_temp.id('reyes') AND peo_name = 'Insperity';
  INSERT INTO public.quote_request_messages (provider_message_id, quote_request_id, session_id, direction, from_address, body_text, headers, recorded_at)
  VALUES ('inbound_1', q, pg_temp.id('reyes'), 'received', 'dana@insperity.example', 'Thanks, looking now.',
          '{"message-id": "<r1@insperity.example>", "references": "<a@acme.example> <b@acme.example>"}', now() + interval '1 minute');
  r := pg_temp.send('reyes', 'Insperity');
  SELECT * INTO m FROM public.quote_request_messages WHERE id = (r ->> 'message_id')::bigint;
  PERFORM pg_temp.is(m.in_reply_to, '<r1@insperity.example>', 'In-Reply-To the PEO''s reply');
  PERFORM pg_temp.is(m.message_references, ARRAY['<a@acme.example>', '<b@acme.example>', '<r1@insperity.example>'], 'References its thread and it');
END $$;

-- A send, then its bundle link issued for the quote request (6.6b), as Acme's agent; answers {message_id, quote_request_id, link_id, token}.
CREATE FUNCTION pg_temp.send_with_link(intake text, peo text, open_items jsonb DEFAULT '["Loss runs", "HRIS system"]') RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb; l jsonb;
BEGIN
  r := pg_temp.send(intake, peo);
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  l := public.issue_bundle_link((r ->> 'quote_request_id')::bigint, 1, gen_random_uuid(),
         '[{"name": "EAA-2026-0042-packet-v1.pdf", "what": "The packet"}]'::jsonb, open_items);
  PERFORM pg_temp.as_owner();
  RETURN jsonb_build_object('message_id', r -> 'message_id', 'quote_request_id', r -> 'quote_request_id', 'link_id', l -> 'id', 'token', l -> 'token');
END $$;

DO $$
BEGIN
  UPDATE auth.users SET raw_user_meta_data = '{"full_name": "Sam Ortiz"}' WHERE id = pg_temp.id('acme_agent');
  UPDATE public.profiles SET phone = '(415) 555-0100' WHERE user_id = pg_temp.id('acme_agent');
END $$;

-- ---------- 13. The bundle link joins the message: under the note, a fixed block the advisor can't edit; the stored body never holds the token ----------
-- Catches: a block missing what M-2.1 lists (the link, File ID and version, the open items, the advisor's name, firm and phone, the draft line), a
-- block the advisor's own text could replace, or the token kept in a body every member of the firm reads.
DO $$
DECLARE s jsonb; m public.quote_request_messages;
BEGIN
  s := pg_temp.send_with_link('reyes', 'Insperity');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.attach_peo_link((s ->> 'message_id')::bigint, (s ->> 'link_id')::bigint, s ->> 'token');
  PERFORM pg_temp.as_owner();
  SELECT * INTO m FROM public.quote_request_messages WHERE id = (s ->> 'message_id')::bigint;
  PERFORM pg_temp.is(m.body_text,
    E'Dana, here is Reyes Bakery for a quote.\n\n-- \n'
    || E'The bundle: [the bundle link, sent in the email and not kept here]\n'
    || 'The link stops working on ' || to_char((SELECT expires_at FROM public.bundle_links WHERE id = (s ->> 'link_id')::bigint) AT TIME ZONE 'UTC', 'FMMonth FMDD, YYYY') || E'.\n'
    || E'File ID EAA-2026-0042, version 1\n'
    || E'Open items: Loss runs; HRIS system\n'
    || E'Sam Ortiz, Acme Brokers, (415) 555-0100\n'
    || public.peo_send_notice(),
    'the note, then the fixed block');
  PERFORM pg_temp.is(m.bundle_link_id, (s ->> 'link_id')::bigint, 'the message names its link');
  PERFORM pg_temp.is(position(s ->> 'token' IN m::text), 0, 'and the token is nowhere in it');
END $$;

-- ---------- 14. Only the message's own quote request's live link joins it, by its own token ----------
-- Catches: a message sent with a link the PEO can't open (another token, a link revoked by a newer one), or one PEO's message carrying another's link.
DO $$
DECLARE s jsonb; t jsonb;
BEGIN
  PERFORM pg_temp.authorize('reyes', 'Justworks', true);
  s := pg_temp.send_with_link('reyes', 'Insperity');
  t := pg_temp.send_with_link('reyes', 'Justworks');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.attach_peo_link(%s, %s, %L)', s ->> 'message_id', s ->> 'link_id', t ->> 'token')),
    '22023: That bundle link isn''t this message''s.', 'another link''s token');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.attach_peo_link(%s, %s, %L)', s ->> 'message_id', t ->> 'link_id', t ->> 'token')),
    '22023: That bundle link isn''t this message''s.', 'another PEO''s link');
  PERFORM pg_temp.as_owner();
  UPDATE public.bundle_links SET revoked_at = now(), revoked_reason = 'revoked_by_advisor' WHERE id = (s ->> 'link_id')::bigint;
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.attach_peo_link(%s, %s, %L)', s ->> 'message_id', s ->> 'link_id', s ->> 'token')),
    '22023: That bundle link isn''t this message''s.', 'a revoked link');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT bundle_link_id FROM public.quote_request_messages WHERE id = (s ->> 'message_id')::bigint), NULL::bigint, 'and none joined');
END $$;

-- ---------- 15. Only the advisor who wrote the message joins its link, once, while it waits ----------
-- Catches: another member, or another firm, changing the body of a message written in someone else's name; or a link joined to a message already gone.
DO $$
DECLARE s jsonb;
BEGIN
  s := pg_temp.send_with_link('reyes', 'Insperity');
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.attach_peo_link(%s, %s, %L)', s ->> 'message_id', s ->> 'link_id', s ->> 'token')),
    'PT409: Only the advisor who wrote this message can send it.', 'another member of the firm');
  PERFORM pg_temp.as_user('zenith_agent', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.attach_peo_link(%s, %s, %L)', s ->> 'message_id', s ->> 'link_id', s ->> 'token')),
    'PT404: Message not found', 'another firm');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.attach_peo_link((s ->> 'message_id')::bigint, (s ->> 'link_id')::bigint, s ->> 'token');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.attach_peo_link(%s, %s, %L)', s ->> 'message_id', s ->> 'link_id', s ->> 'token')),
    'PT409: This message already has its link.', 'a second time');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 16. The send-mail function claims a PEO message only once its link has joined it, with its reply address and the link's token ----------
-- Catches: a message sent before it carries its link (an email with no bundle), or one sent without the quote request's reply address to come back to.
DO $$
DECLARE s jsonb; waiting jsonb; got record; n integer := 0;
BEGIN
  s := pg_temp.send_with_link('reyes', 'Insperity');
  waiting := pg_temp.send('reyes', 'Insperity');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.attach_peo_link((s ->> 'message_id')::bigint, (s ->> 'link_id')::bigint, s ->> 'token');
  PERFORM pg_temp.as_service();
  FOR got IN SELECT * FROM public.claim_peo_mail(50, 5, 600) LOOP
    PERFORM pg_temp.is((got.message ->> 'id')::bigint = (waiting ->> 'message_id')::bigint, false, 'a message with no link is not claimed');
    CONTINUE WHEN (got.message ->> 'id')::bigint <> (s ->> 'message_id')::bigint;
    n := n + 1;
    PERFORM pg_temp.is(got.message ->> 'link_token', s ->> 'token', 'with the token for the email');
    PERFORM pg_temp.is(got.message ->> 'reply_address',
      (SELECT a.local_part FROM public.quote_request_addresses a WHERE a.quote_request_id = (s ->> 'quote_request_id')::bigint AND a.revoked_at IS NULL),
      'and the quote request''s reply address');
    PERFORM pg_temp.is(got.message ->> 'from_address', 'sam@acme.example', 'from the advisor''s mailbox');
  END LOOP;
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(n, 1, 'the one with its link is claimed');
END $$;

-- A PEO message with its link, claimed by the send-mail function; answers {message_id, event_id, attempt, token}.
CREATE FUNCTION pg_temp.claimed_peo_message() RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE s jsonb; got record; out jsonb;
BEGIN
  s := pg_temp.send_with_link('reyes', 'Insperity');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.attach_peo_link((s ->> 'message_id')::bigint, (s ->> 'link_id')::bigint, s ->> 'token');
  PERFORM pg_temp.as_service();
  FOR got IN SELECT * FROM public.claim_peo_mail(50, 5, 600) LOOP
    IF (got.message ->> 'id')::bigint = (s ->> 'message_id')::bigint THEN
      out := jsonb_build_object('message_id', s -> 'message_id', 'event_id', got.event_id, 'attempt', got.attempt, 'token', s -> 'token');
    END IF;
  END LOOP;
  PERFORM pg_temp.as_owner();
  RETURN out;
END $$;

-- ---------- 17. A send that went: the message is sent on the thread with the provider's id, and the token leaves the outbox ----------
-- Catches: a thread that still says queued after the email went, no provider id recorded (M-2.1), or a live token kept on the outbox after it is used.
DO $$
DECLARE c jsonb; m public.quote_request_messages; e public.outbox_events;
BEGIN
  c := pg_temp.claimed_peo_message();
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(public.complete_peo_mail((c ->> 'event_id')::uuid, (c ->> 'attempt')::integer, 'gmail-18c2f'), true, 'the claim of that attempt records it');
  PERFORM pg_temp.as_owner();
  SELECT * INTO m FROM public.quote_request_messages WHERE id = (c ->> 'message_id')::bigint;
  PERFORM pg_temp.is(m.status, 'sent', 'the message is sent');
  PERFORM pg_temp.is(m.provider_message_id, 'gmail-18c2f', 'with Gmail''s id');
  PERFORM pg_temp.is(m.sent_at IS NOT NULL, true, 'and when');
  SELECT * INTO e FROM public.outbox_events WHERE id = (c ->> 'event_id')::uuid;
  PERFORM pg_temp.is(e.status, 'sent', 'the event is sent');
  PERFORM pg_temp.is(e.payload ? 'link_token', false, 'and no longer holds the token');
END $$;

-- ---------- 18. A send that did not go: retried after a delay while queued, or final, failed on the thread with its kind and reason ----------
-- Catches: a failure the thread never shows, a retried send already marked failed, or the provider's words kept where an address could be in them.
DO $$
DECLARE c jsonb; m public.quote_request_messages; e public.outbox_events;
BEGIN
  c := pg_temp.claimed_peo_message();
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(public.fail_peo_mail((c ->> 'event_id')::uuid, (c ->> 'attempt')::integer, 'unavailable', 'Busy.', 60), true, 'a retry recorded');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT status FROM public.quote_request_messages WHERE id = (c ->> 'message_id')::bigint), 'queued', 'the message waits for its retry');
  UPDATE public.outbox_events SET status = 'claimed', attempts = attempts + 1, next_attempt_at = now() WHERE id = (c ->> 'event_id')::uuid;
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(public.fail_peo_mail((c ->> 'event_id')::uuid, (c ->> 'attempt')::integer + 1, 'mailbox', 'Connect your mailbox again.', NULL), true, 'a final failure');
  PERFORM pg_temp.as_owner();
  SELECT * INTO m FROM public.quote_request_messages WHERE id = (c ->> 'message_id')::bigint;
  PERFORM pg_temp.is(m.status, 'failed', 'the message failed');
  PERFORM pg_temp.is(m.failure_kind, 'mailbox', 'for a mailbox reason');
  PERFORM pg_temp.is(m.failure_reason, 'Connect your mailbox again.', 'in the advisor''s words');
  SELECT * INTO e FROM public.outbox_events WHERE id = (c ->> 'event_id')::uuid;
  PERFORM pg_temp.is(e.status, 'dead', 'the event is dead, for the Outbox page''s retry');
  PERFORM pg_temp.is(e.last_error, 'mailbox', 'keeping the kind alone');
END $$;

-- ---------- 19. A failed send shows on the Outbox page, named by company and File ID, and its retry puts the message back in the queue ----------
-- Catches: a PEO send that fails where no one sees it (M-2.1: on the Outbox page with a retry, as other emails), or a retry that leaves the thread
-- saying failed while it is being sent again.
DO $$
DECLARE dead_id uuid; row record; m public.quote_request_messages;
BEGIN
  SELECT e.id INTO dead_id FROM public.outbox_events e WHERE e.kind = 'peo_message' AND e.status = 'dead' ORDER BY e.created_at DESC LIMIT 1;
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  SELECT * INTO row FROM public.advisor_list_outbox_events('dead', 100) l WHERE l.id = dead_id;
  PERFORM pg_temp.is(row.kind, 'peo_message', 'the Outbox page lists it');
  PERFORM pg_temp.is(row.company_name, 'Reyes Bakery', 'by the company');
  PERFORM pg_temp.is(row.reference, 'EAA-2026-0042', 'and its File ID');
  PERFORM pg_temp.is(public.advisor_requeue_outbox_event(dead_id), true, 'its retry');
  PERFORM pg_temp.as_owner();
  SELECT * INTO m FROM public.quote_request_messages WHERE id = (SELECT (payload ->> 'message_id')::bigint FROM public.outbox_events WHERE id = dead_id);
  PERFORM pg_temp.is(m.status, 'queued', 'puts the message back in the queue');
  PERFORM pg_temp.is(m.failure_kind, NULL::text, 'with no failure on it');
  PERFORM pg_temp.is((SELECT payload ? 'link_token' FROM public.outbox_events WHERE id = dead_id), true, 'and its link still to send');
END $$;

-- ---------- 20. A worker lost on the last attempt leaves its message failed as uncertain: it may have gone (D-632) ----------
-- Catches: a message the outbox's reaper ended that the thread still shows as queued, forever.
DO $$
DECLARE c jsonb; m public.quote_request_messages;
BEGIN
  c := pg_temp.claimed_peo_message();
  -- What the outbox's reaper does to an event whose worker of its last attempt was lost.
  UPDATE public.outbox_events SET status = 'dead', last_error = 'worker_lost_maybe_sent' WHERE id = (c ->> 'event_id')::uuid;
  SELECT * INTO m FROM public.quote_request_messages WHERE id = (c ->> 'message_id')::bigint;
  PERFORM pg_temp.is(m.status, 'failed', 'the message failed');
  PERFORM pg_temp.is(m.failure_kind, 'uncertain', 'as uncertain');
  PERFORM pg_temp.is(m.failure_reason, 'This message may have been sent. Look in your Sent folder before sending again.', 'telling the advisor where to look');
END $$;

-- ---------- 21. A message whose link never joined it (the page closed between the two steps) fails after ten minutes, and nothing is sent ----------
-- Catches: a message left queued forever on the thread, or one sent with no bundle in it.
DO $$
DECLARE r jsonb; e public.outbox_events; m public.quote_request_messages;
BEGIN
  r := pg_temp.send('reyes', 'Insperity');
  UPDATE public.outbox_events SET created_at = now() - interval '11 minutes'
  WHERE kind = 'peo_message' AND (payload ->> 'message_id')::bigint = (r ->> 'message_id')::bigint;
  PERFORM pg_temp.as_service();
  PERFORM count(*) FROM public.claim_peo_mail(50, 5, 600);
  PERFORM pg_temp.as_owner();
  SELECT * INTO e FROM public.outbox_events WHERE kind = 'peo_message' AND (payload ->> 'message_id')::bigint = (r ->> 'message_id')::bigint;
  PERFORM pg_temp.is(e.status, 'dead', 'its event ends');
  PERFORM pg_temp.is(e.attempts, 0, 'never tried');
  SELECT * INTO m FROM public.quote_request_messages WHERE id = (r ->> 'message_id')::bigint;
  PERFORM pg_temp.is(m.status, 'failed', 'the message failed');
  PERFORM pg_temp.is(m.failure_kind, 'refused', 'as not sent');
  PERFORM pg_temp.is(m.failure_reason, 'The bundle link wasn''t made, so nothing was sent. Send it again.', 'saying why');
END $$;

-- ---------- 22. A message whose link stopped working before it went (revoked: the employer withdrew the PEO, a newer link) is never sent ----------
-- Catches: a PEO mailed a link that opens nothing, or mailed at all after the employer withdrew it (M-1.1).
DO $$
DECLARE s jsonb; e public.outbox_events; m public.quote_request_messages; got record;
BEGIN
  s := pg_temp.send_with_link('reyes', 'Insperity');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.attach_peo_link((s ->> 'message_id')::bigint, (s ->> 'link_id')::bigint, s ->> 'token');
  PERFORM pg_temp.as_owner();
  UPDATE public.bundle_links SET revoked_at = now(), revoked_reason = 'authorization_withdrawn' WHERE id = (s ->> 'link_id')::bigint;
  PERFORM pg_temp.as_service();
  FOR got IN SELECT * FROM public.claim_peo_mail(50, 5, 600) LOOP
    PERFORM pg_temp.is((got.message ->> 'id')::bigint = (s ->> 'message_id')::bigint, false, 'it is not claimed');
  END LOOP;
  PERFORM pg_temp.as_owner();
  SELECT * INTO e FROM public.outbox_events WHERE kind = 'peo_message' AND (payload ->> 'message_id')::bigint = (s ->> 'message_id')::bigint;
  PERFORM pg_temp.is(e.status, 'dead', 'its event ends');
  PERFORM pg_temp.is(e.payload ? 'link_token', false, 'without the token');
  SELECT * INTO m FROM public.quote_request_messages WHERE id = (s ->> 'message_id')::bigint;
  PERFORM pg_temp.is(m.status, 'failed', 'the message failed');
  PERFORM pg_temp.is(m.failure_reason, 'The bundle link stopped working before this went, so nothing was sent.', 'saying why');
END $$;

-- ---------- 23. The employer withdrawing the PEO after the send was written stops it before it goes (M-1.1) ----------
-- Catches: a queued message mailed to a PEO the employer withdrew while it waited (6.6a revokes a link by peo_authorized, not by its row).
DO $$
DECLARE s jsonb; got record;
BEGIN
  PERFORM pg_temp.authorize('reyes', 'Oasis', true);
  s := pg_temp.send_with_link('reyes', 'Oasis');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.attach_peo_link((s ->> 'message_id')::bigint, (s ->> 'link_id')::bigint, s ->> 'token');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.authorize('reyes', 'Oasis', false);
  PERFORM pg_temp.as_service();
  FOR got IN SELECT * FROM public.claim_peo_mail(50, 5, 600) LOOP
    PERFORM pg_temp.is((got.message ->> 'id')::bigint = (s ->> 'message_id')::bigint, false, 'it is not claimed');
  END LOOP;
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT failure_reason FROM public.quote_request_messages WHERE id = (s ->> 'message_id')::bigint),
    'The employer withdrew Oasis before this went, so nothing was sent.', 'the message failed, saying why');
END $$;

-- ---------- 24. What the composer reads: the advisor's mailbox, the PEO's contacts with an email from its profile in use, and the reply address ----------
-- Catches: a composer offering to send with no mailbox, contacts from a draft profile nobody published, or the contacts of another PEO.
DO $$
DECLARE pid bigint; vid bigint; c jsonb;
BEGIN
  SELECT id INTO pid FROM public.peos WHERE lower(name) = 'insperity';
  PERFORM set_config('session_replication_role', 'replica', true);
  INSERT INTO public.peo_profile_versions (peo_id, version, status, published_at) VALUES (pid, 90, 'published', now()) RETURNING id INTO vid;
  INSERT INTO public.peo_contacts (profile_version_id, position, name, role, email) VALUES
    (vid, 1, 'Dana Lee', 'Underwriter', 'dana@insperity.example'), (vid, 2, 'Front desk', NULL, NULL);
  SELECT id INTO vid FROM public.peo_profile_versions WHERE peo_id = pid AND status = 'draft';
  IF vid IS NULL THEN INSERT INTO public.peo_profile_versions (peo_id, version, status) VALUES (pid, 91, 'draft') RETURNING id INTO vid; END IF;
  INSERT INTO public.peo_contacts (profile_version_id, position, name, email) VALUES (vid, 1, 'Draft Person', 'draft@insperity.example');
  PERFORM set_config('session_replication_role', 'origin', true);
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  c := public.peo_send_context(pg_temp.id('reyes'), 'Insperity');
  PERFORM pg_temp.is(c -> 'mailbox', '{"connected": true, "address": "sam@acme.example"}'::jsonb, 'the advisor''s mailbox');
  PERFORM pg_temp.is(c -> 'contacts', '[{"name": "Dana Lee", "role": "Underwriter", "email": "dana@insperity.example"}]'::jsonb, 'the contacts in use with an email');
  PERFORM pg_temp.is(c ->> 'reply_address',
    (SELECT a.local_part FROM public.quote_request_addresses a JOIN public.quote_requests q ON q.id = a.quote_request_id
     WHERE q.session_id = pg_temp.id('reyes') AND q.peo_name = 'Insperity' AND a.revoked_at IS NULL), 'the quote request''s reply address');
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  PERFORM pg_temp.is(public.peo_send_context(pg_temp.id('reyes'), 'Insperity') -> 'mailbox', '{"connected": false, "address": null}'::jsonb, 'no mailbox');
  PERFORM pg_temp.as_user('zenith_agent', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.peo_send_context(%L, 'Insperity')$s$, pg_temp.id('reyes'))), 'PT404: Submission not found', 'another firm');
  PERFORM pg_temp.as_owner();
END $$;
