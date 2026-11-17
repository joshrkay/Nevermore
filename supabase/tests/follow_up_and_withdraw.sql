-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh follow_up_and_withdraw
-- Following up and withdrawing (M-2.4, slice 6.9, #203; docs/BROKER_CRM_BUILD.md D-1620 to D-1629; 20261122190000_follow_up_and_withdraw.sql).
-- A follow-up on a PEO's thread (follow_up_peo, its fresh link joined by 6.6's attach_peo_link), a withdrawal (withdraw_from_peo), and the one
-- withdrawal offered when a submission is marked Won, Lost or Archived (close_submission_and_withdraw), with set_submission_status revoking the links
-- either way. Two firms. Every migration is loaded, in filename order (D-105), this slice's last.
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
\i supabase/migrations/20261123130000_new_quote_account.sql
\i supabase/migrations/20261123190000_intake_teaches_account.sql
\i supabase/migrations/20261123200000_employer_ends_access.sql
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

-- ---------- set up: two firms; Acme's agent with a mailbox, Acme's second agent with none; an intake of each firm, certified, PEOs authorized ----------
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
  UPDATE auth.users SET raw_user_meta_data = '{"full_name": "Sam Ortiz"}' WHERE id = pg_temp.id('acme_agent');
  PERFORM pg_temp.intake('reyes', 'acme', 'Reyes Bakery');
  PERFORM pg_temp.certify('reyes', 1, 'EAA-2026-0042');
  PERFORM pg_temp.authorize('reyes', 'Insperity', true);
  PERFORM pg_temp.authorize('reyes', 'TriNet', true);
  PERFORM pg_temp.authorize('reyes', 'Justworks', true);
  PERFORM pg_temp.intake('zed', 'zenith', 'Zed Tools');
  PERFORM pg_temp.certify('zed', 1, 'EAA-2026-0043');
  PERFORM pg_temp.authorize('zed', 'Justworks', true);
END $$;

-- A link for a quote request, issued (6.6b) for a version; answers {id, token, ...}.
CREATE FUNCTION pg_temp.link(q bigint, v integer DEFAULT 1, who text DEFAULT 'acme_agent', addr text DEFAULT 'acme-brokers') RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE l jsonb;
BEGIN
  PERFORM pg_temp.as_user(who, addr);
  l := public.issue_bundle_link(q, v, gen_random_uuid(), '[{"name": "packet.pdf", "what": "The packet"}]'::jsonb, '[]'::jsonb);
  PERFORM pg_temp.as_owner();
  RETURN l;
END $$;

-- 6.6's whole send (send_to_peo, its link, attach_peo_link), marked sent as send-mail would; answers the quote request's id.
CREATE FUNCTION pg_temp.sent(intake text, peo text, who text DEFAULT 'acme_agent', addr text DEFAULT 'acme-brokers') RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE r jsonb; l jsonb;
BEGIN
  PERFORM pg_temp.as_user(who, addr);
  r := public.send_to_peo(pg_temp.id(intake), peo, ARRAY['dana@' || lower(peo) || '.example'], 'Reyes Bakery: EAA-2026-0042, version 1', 'Hello Dana, here it is.');
  PERFORM pg_temp.as_owner();
  l := pg_temp.link((r ->> 'quote_request_id')::bigint, 1, who, addr);
  PERFORM pg_temp.as_user(who, addr);
  PERFORM public.attach_peo_link((r ->> 'message_id')::bigint, (l ->> 'id')::bigint, l ->> 'token');
  PERFORM pg_temp.as_owner();
  UPDATE public.quote_request_messages SET status = 'sent', sent_at = now() WHERE id = (r ->> 'message_id')::bigint;
  UPDATE public.outbox_events SET status = 'sent', payload = payload - 'link_token'
  WHERE kind = 'peo_message' AND (payload ->> 'message_id')::bigint = (r ->> 'message_id')::bigint;
  RETURN (r ->> 'quote_request_id')::bigint;
END $$;

-- A quote request of an intake by its PEO.
CREATE FUNCTION pg_temp.qr(intake text, peo text) RETURNS bigint LANGUAGE sql STABLE AS $$
  SELECT q.id FROM public.quote_requests q WHERE q.session_id = pg_temp.id(intake) AND q.peo_name = peo
$$;

-- A follow-up as Acme's agent, to Dana; answers follow_up_peo's answer.
CREATE FUNCTION pg_temp.follow_up(q bigint, who text DEFAULT 'acme_agent', addr text DEFAULT 'acme-brokers') RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user(who, addr);
  r := public.follow_up_peo(q, ARRAY['dana@insperity.example'], 'Re: Reyes Bakery: EAA-2026-0042, version 1', 'Hello Dana, checking in on Reyes Bakery.');
  PERFORM pg_temp.as_owner();
  RETURN r;
END $$;

DO $$ BEGIN PERFORM pg_temp.sent('reyes', 'Insperity'); END $$;

-- ---------- 1. A follow-up is recorded queued on the PEO's own thread, continuing it: In-Reply-To and References name the message before ----------
-- Catches: a follow-up that starts a new thread in the PEO's mail, or one recorded on no quote request.
DO $$
DECLARE first public.quote_request_messages; r jsonb; m public.quote_request_messages;
BEGIN
  SELECT * INTO first FROM public.quote_request_messages WHERE quote_request_id = pg_temp.qr('reyes', 'Insperity') AND direction = 'sent';
  r := pg_temp.follow_up(pg_temp.qr('reyes', 'Insperity'));
  SELECT * INTO m FROM public.quote_request_messages WHERE id = (r ->> 'message_id')::bigint;
  PERFORM pg_temp.is(m.quote_request_id, pg_temp.qr('reyes', 'Insperity'), 'on the PEO''s thread');
  PERFORM pg_temp.is(m.status, 'queued', 'queued before anything goes');
  PERFORM pg_temp.is(m.in_reply_to, first.message_id, 'In-Reply-To the message before');
  PERFORM pg_temp.is(m.message_references, ARRAY[first.message_id], 'References the thread so far');
END $$;


-- ---------- 2. A closing firm and a support session follow up with nobody (ADR 0023, ADR 0024) ----------
-- Catches: a follow-up that skips assert_firm_writable, so a firm in its read-only 30 days, or Nevermore support looking at it, still mails a PEO.
DO $$
DECLARE before integer := (SELECT count(*) FROM public.quote_request_messages);
BEGIN
  PERFORM pg_temp.new_user('platform_admin');
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('platform_admin'), 'admin');
  INSERT INTO public.support_sessions (firm_id, admin_id, admin_email, reason, started_at, ends_at)
  VALUES (pg_temp.id('acme'), pg_temp.id('platform_admin'), 'platform_admin@example.test', 'Looking at a stuck email', now(), now() + interval '1 hour');
  PERFORM pg_temp.as_user('platform_admin', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.follow_up_peo(%s, ARRAY['dana@insperity.example'], 'S', 'N')$s$, pg_temp.qr('reyes', 'Insperity'))),
    'PT423: Nevermore support can look, not change', 'a support session');
  PERFORM pg_temp.as_owner();
  DELETE FROM public.support_sessions WHERE firm_id = pg_temp.id('acme');
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (pg_temp.id('acme'), pg_temp.id('acme_agent'), now() + interval '30 days');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($s$SELECT public.follow_up_peo(%s, ARRAY['dana@insperity.example'], 'S', 'N')$s$, pg_temp.qr('reyes', 'Insperity'))), ':', 1),
    'PT423', 'a closing firm');
  PERFORM pg_temp.as_owner();
  DELETE FROM public.firm_closures WHERE firm_id = pg_temp.id('acme');
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.quote_request_messages), before, 'and nothing is recorded');
END $$;

-- ---------- 3. Only an advisor of the intake's own firm follows up; another firm's quote request is not there for them ----------
-- Catches: a member of one firm mailing another firm's PEO thread, or a prospect writing to a PEO as an advisor.
DO $$
DECLARE q bigint := pg_temp.qr('reyes', 'Insperity');
BEGIN
  PERFORM pg_temp.as_user('zenith_agent', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.follow_up_peo(%s, ARRAY['dana@insperity.example'], 'S', 'N')$s$, q)),
    'PT404: Quote request not found', 'another firm''s quote request');
  PERFORM pg_temp.as_user('p_reyes');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($s$SELECT public.follow_up_peo(%s, ARRAY['dana@insperity.example'], 'S', 'N')$s$, q)), ':', 1),
    '42501', 'the prospect');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 4. A follow-up to a PEO the employer withdrew is refused, as a send is (M-1.1), and nothing is recorded ----------
-- Catches: a follow-up that carries the packet's link to a PEO the employer no longer authorizes.
DO $$
DECLARE q bigint := pg_temp.sent('reyes', 'TriNet'); before integer := (SELECT count(*) FROM public.quote_request_messages);
BEGIN
  PERFORM pg_temp.authorize('reyes', 'TriNet', false);
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.follow_up_peo(%s, ARRAY['dana@trinet.example'], 'S', 'N')$s$, q)),
    '22023: The employer withdrew TriNet. Nothing more can be sent to it.', 'the employer withdrew it');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.quote_request_messages), before, 'and nothing is recorded');
  PERFORM pg_temp.authorize('reyes', 'TriNet', true);
END $$;

-- ---------- 5. An advisor with no connected mailbox follows up with nobody, and nothing is recorded (D-634) ----------
-- Catches: a follow-up recorded with no From, which could never go.
DO $$
DECLARE q bigint := pg_temp.qr('reyes', 'Insperity'); before integer := (SELECT count(*) FROM public.quote_request_messages);
BEGIN
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.follow_up_peo(%s, ARRAY['dana@insperity.example'], 'S', 'N')$s$, q)),
    'PT412: Connect your mailbox to send from here.', 'no mailbox');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.quote_request_messages), before, 'and nothing is recorded');
END $$;

-- ---------- 6. A follow-up is addressed to one to ten people, each a bare address by the one address rule (D-637) ----------
-- Catches: a follow-up to nobody, or an address that could split a header and add a recipient the advisor never chose.
DO $$
DECLARE q bigint := pg_temp.qr('reyes', 'Insperity');
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.follow_up_peo(%s, ARRAY[' '], 'S', 'N')$s$, q)),
    '22023: Address it to at least one person at Insperity.', 'nobody to send to');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.follow_up_peo(%s, ARRAY['dana@insperity.example, eve@evil.example'], 'S', 'N')$s$, q)),
    '22023: Enter each address like name@example.com.', 'an address with a comma in it');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.follow_up_peo(%s, array_fill('a@b.example'::text, ARRAY[11]), 'S', 'N')$s$, q)),
    '22023: Address it to at most 10 people.', 'more than ten');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 7. The subject and the note keep 6.2's limits (D-636) ----------
-- Catches: a subject with a line break, which would start another header, or a follow-up that says nothing.
DO $$
DECLARE q bigint := pg_temp.qr('reyes', 'Insperity');
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.follow_up_peo(%s, ARRAY['dana@insperity.example'], E'S\r\nBcc: eve@evil.example', 'N')$s$, q)),
    '22023: A subject is one line.', 'a subject of two lines');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.follow_up_peo(%s, ARRAY['dana@insperity.example'], 'S', '  ')$s$, q)),
    '22023: Write a message.', 'no note');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 8. A closed quote request is not followed up: the advisor sends again to reopen it ----------
-- Catches: a follow-up after a withdrawal or a closed submission, which would mail a PEO already told the employer went elsewhere.
DO $$
DECLARE q bigint := pg_temp.sent('reyes', 'Justworks');
BEGIN
  UPDATE public.quote_requests SET status = 'closed' WHERE id = q;
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.follow_up_peo(%s, ARRAY['dana@justworks.example'], 'S', 'N')$s$, q)),
    '22023: This quote request is closed. Send to Justworks again to reopen it.', 'a closed quote request');
  PERFORM pg_temp.as_owner();
  UPDATE public.quote_requests SET status = 'sent' WHERE id = q;
END $$;

-- ---------- 9. A follow-up carries a live link to the version already sent, even once a newer version is certified (D-1621) ----------
-- The token is kept only as its hash (D-640), so the earlier link can't be written again: the follow-up answers the version its fresh link is issued
-- for, and 6.6's attach_peo_link joins it under the note with its fixed block. Issuing it revokes the earlier link as replaced (6.6b).
-- Catches: a follow-up that links the newest certified version, which the PEO was never sent (that is an update, M-2.3), or one with no link at all.
DO $$
DECLARE q bigint := pg_temp.qr('reyes', 'Insperity'); r jsonb; l jsonb; earlier bigint; m public.quote_request_messages;
BEGIN
  SELECT b.id INTO earlier FROM public.bundle_links b WHERE b.quote_request_id = q AND b.revoked_at IS NULL;
  PERFORM pg_temp.certify('reyes', 2, 'EAA-2026-0042');
  r := pg_temp.follow_up(q);
  PERFORM pg_temp.is((r ->> 'version')::integer, 1, 'the version already sent');
  l := pg_temp.link(q, (r ->> 'version')::integer);
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.attach_peo_link((r ->> 'message_id')::bigint, (l ->> 'id')::bigint, l ->> 'token');
  PERFORM pg_temp.as_owner();
  SELECT * INTO m FROM public.quote_request_messages WHERE id = (r ->> 'message_id')::bigint;
  PERFORM pg_temp.is(position('The bundle: [the bundle link, sent in the email and not kept here]' IN m.body_text) > 0, true, 'the link goes under the note');
  PERFORM pg_temp.is(position('File ID EAA-2026-0042, version 1' IN m.body_text) > 0, true, 'for version 1');
  PERFORM pg_temp.is((SELECT revoked_reason FROM public.bundle_links WHERE id = earlier), 'replaced', 'the earlier link stops working');
  PERFORM pg_temp.is((SELECT payload ? 'link_token' FROM public.outbox_events WHERE kind = 'peo_message' AND (payload ->> 'message_id')::bigint = m.id), true,
    'and the event can go');
END $$;

-- ---------- 10. A link the advisor revoked stays revoked: no follow-up issues a new one (D-1622) ----------
-- Catches: a follow-up that quietly re-opens the packet to a PEO whose link the advisor stopped (sent to the wrong address, say).
DO $$
DECLARE q bigint := pg_temp.qr('reyes', 'Justworks'); before integer := (SELECT count(*) FROM public.quote_request_messages);
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.revoke_bundle_link(q);
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.follow_up_peo(%s, ARRAY['dana@justworks.example'], 'S', 'N')$s$, q)),
    '22023: You revoked the link to Justworks, so a follow-up can''t carry one. Send to Justworks again to issue a new link.', 'revoked by the advisor');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.quote_request_messages), before, 'and nothing is recorded');
END $$;

-- A withdrawal as Acme's agent, to Dana; answers withdraw_from_peo's answer.
CREATE FUNCTION pg_temp.withdraw(q bigint, reason text DEFAULT 'employer_went_elsewhere', who text DEFAULT 'acme_agent', addr text DEFAULT 'acme-brokers')
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user(who, addr);
  r := public.withdraw_from_peo(q, ARRAY['dana@trinet.example'], 'Re: Reyes Bakery: EAA-2026-0042, version 1', 'Hello Dana, please set Reyes Bakery aside.', reason);
  PERFORM pg_temp.as_owner();
  RETURN r;
END $$;

-- ---------- 11. A withdrawal closes the quote request, revokes its link (withdrawn), keeps its reason, and is queued on the thread with no link ----------
-- Catches: a withdrawal that leaves the PEO able to open the packet, a quote request still open after it, a reason lost, or one that starts a thread.
DO $$
DECLARE q bigint := pg_temp.qr('reyes', 'TriNet'); first public.quote_request_messages; r jsonb; m public.quote_request_messages; e public.outbox_events;
BEGIN
  SELECT * INTO first FROM public.quote_request_messages WHERE quote_request_id = q AND direction = 'sent' ORDER BY id DESC LIMIT 1;
  r := pg_temp.withdraw(q);
  PERFORM pg_temp.is((SELECT status FROM public.quote_requests WHERE id = q), 'closed', 'the quote request closes');
  PERFORM pg_temp.is((SELECT withdrawn_reason FROM public.quote_requests WHERE id = q), 'employer_went_elsewhere', 'with its reason');
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.bundle_links WHERE quote_request_id = q AND revoked_at IS NULL), 0, 'no live link is left');
  PERFORM pg_temp.is((SELECT revoked_reason FROM public.bundle_links WHERE quote_request_id = q ORDER BY id DESC LIMIT 1), 'withdrawn', 'revoked as withdrawn');
  SELECT * INTO m FROM public.quote_request_messages WHERE id = (r ->> 'message_id')::bigint;
  PERFORM pg_temp.is(m.quote_request_id, q, 'the message is on the PEO''s thread');
  PERFORM pg_temp.is(m.in_reply_to, first.message_id, 'In-Reply-To the message before');
  PERFORM pg_temp.is(m.status, 'queued', 'queued');
  PERFORM pg_temp.is(m.bundle_link_id, NULL::bigint, 'with no link');
  SELECT * INTO e FROM public.outbox_events WHERE kind = 'peo_message' AND (payload ->> 'message_id')::bigint = m.id;
  PERFORM pg_temp.is(e.payload -> 'without_link', 'true'::jsonb, 'its event goes without a link');
END $$;

-- ---------- 12. A closing firm and a support session withdraw nothing (ADR 0023, ADR 0024) ----------
-- Catches: a withdrawal that skips assert_firm_writable, closing a quote request and mailing a PEO from a read-only firm or a support session.
DO $$
DECLARE q bigint := pg_temp.qr('reyes', 'Insperity'); before integer := (SELECT count(*) FROM public.quote_request_messages);
BEGIN
  INSERT INTO public.support_sessions (firm_id, admin_id, admin_email, reason, started_at, ends_at)
  VALUES (pg_temp.id('acme'), pg_temp.id('platform_admin'), 'platform_admin@example.test', 'Looking at a stuck email', now(), now() + interval '1 hour');
  PERFORM pg_temp.as_user('platform_admin', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.withdraw_from_peo(%s, ARRAY['dana@insperity.example'], 'S', 'N', 'other')$s$, q)),
    'PT423: Nevermore support can look, not change', 'a support session');
  PERFORM pg_temp.as_owner();
  DELETE FROM public.support_sessions WHERE firm_id = pg_temp.id('acme');
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (pg_temp.id('acme'), pg_temp.id('acme_agent'), now() + interval '30 days');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($s$SELECT public.withdraw_from_peo(%s, ARRAY['dana@insperity.example'], 'S', 'N', 'other')$s$, q)), ':', 1),
    'PT423', 'a closing firm');
  PERFORM pg_temp.as_owner();
  DELETE FROM public.firm_closures WHERE firm_id = pg_temp.id('acme');
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.quote_request_messages), before, 'and nothing is recorded');
  PERFORM pg_temp.is((SELECT status FROM public.quote_requests WHERE id = q), 'sent', 'nor the quote request closed');
END $$;

-- ---------- 13. Only an advisor of the intake's own firm withdraws ----------
-- Catches: one firm closing another firm's quote request and mailing its PEO, or a prospect withdrawing as an advisor.
DO $$
DECLARE q bigint := pg_temp.qr('reyes', 'Insperity');
BEGIN
  PERFORM pg_temp.as_user('zenith_agent', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.withdraw_from_peo(%s, ARRAY['dana@insperity.example'], 'S', 'N', 'other')$s$, q)),
    'PT404: Quote request not found', 'another firm''s quote request');
  PERFORM pg_temp.as_user('p_reyes');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($s$SELECT public.withdraw_from_peo(%s, ARRAY['dana@insperity.example'], 'S', 'N', 'other')$s$, q)), ':', 1),
    '42501', 'the prospect');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT status FROM public.quote_requests WHERE id = q), 'sent', 'and the quote request is still open');
END $$;

-- ---------- 14. With no connected mailbox nothing is withdrawn: the quote request stays open and nothing is recorded (D-634) ----------
-- Catches: a quote request closed and its link revoked for a message that can never go, so the PEO is never told.
DO $$
DECLARE q bigint := pg_temp.qr('reyes', 'Insperity'); before integer := (SELECT count(*) FROM public.quote_request_messages);
BEGIN
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.withdraw_from_peo(%s, ARRAY['dana@insperity.example'], 'S', 'N', 'other')$s$, q)),
    'PT412: Connect your mailbox to send from here.', 'no mailbox');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.quote_request_messages), before, 'nothing is recorded');
  PERFORM pg_temp.is((SELECT status FROM public.quote_requests WHERE id = q), 'sent', 'the quote request is still open');
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.bundle_links WHERE quote_request_id = q AND revoked_at IS NULL), 1, 'and its link still works');
END $$;

-- ---------- 15. A withdrawal names one of the four reasons, and is not sent twice ----------
-- Catches: a reason outside the advisors' four, or a second withdrawal to a PEO already withdrawn (or closed), mailing it again.
DO $$
DECLARE q bigint := pg_temp.qr('reyes', 'Insperity');
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.withdraw_from_peo(%s, ARRAY['dana@insperity.example'], 'S', 'N', 'bored')$s$, q)),
    '22023: Choose why: the employer went elsewhere, the prospect withdrew this PEO, the PEO is not a fit, or other.', 'an unknown reason');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.withdraw_from_peo(%s, ARRAY['dana@trinet.example'], 'S', 'N', 'other')$s$, pg_temp.qr('reyes', 'TriNet'))),
    '22023: TriNet is already closed, so there is nothing to withdraw.', 'a closed quote request');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 16. A withdrawal is addressed by the one address rule, and nothing closes when an address is refused ----------
-- Catches: an address that could split a header, or a quote request closed for a withdrawal that was refused.
DO $$
DECLARE q bigint := pg_temp.qr('reyes', 'Insperity');
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.withdraw_from_peo(%s, ARRAY['dana@insperity.example, eve@evil.example'], 'S', 'N', 'other')$s$, q)),
    '22023: Enter each address like name@example.com.', 'an address with a comma in it');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT status FROM public.quote_requests WHERE id = q), 'sent', 'and the quote request is still open');
END $$;

-- ---------- 17. A withdrawal's subject and note keep 6.2's limits (D-636) ----------
-- Catches: a subject with a line break, which would start another header, or a withdrawal that says nothing.
DO $$
DECLARE q bigint := pg_temp.qr('reyes', 'Insperity');
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.withdraw_from_peo(%s, ARRAY['dana@insperity.example'], E'S\nBcc: eve@evil.example', 'N', 'other')$s$, q)),
    '22023: A subject is one line.', 'a subject of two lines');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.withdraw_from_peo(%s, ARRAY['dana@insperity.example'], 'S', ' ', 'other')$s$, q)),
    '22023: Write a message.', 'no note');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT status FROM public.quote_requests WHERE id = q), 'sent', 'and the quote request is still open');
END $$;

-- ---------- 18. A withdrawal's message is claimed by the send-mail function as written, with no link, however long it waited ----------
-- Catches: a withdrawal that waits forever for a link it never gets, or one ended after ten minutes as "the bundle link wasn't made".
DO $$
DECLARE m bigint; got record; n integer := 0;
BEGIN
  SELECT x.id INTO m FROM public.quote_request_messages x WHERE x.quote_request_id = pg_temp.qr('reyes', 'TriNet') ORDER BY x.id DESC LIMIT 1;
  UPDATE public.outbox_events SET created_at = now() - interval '11 minutes' WHERE kind = 'peo_message' AND (payload ->> 'message_id')::bigint = m;
  PERFORM pg_temp.as_service();
  FOR got IN SELECT * FROM public.claim_peo_mail(50, 5, 600) LOOP
    IF (got.message ->> 'id')::bigint = m THEN
      n := n + 1;
      PERFORM pg_temp.is(got.message ->> 'link_token', NULL::text, 'claimed with no token');
      PERFORM pg_temp.is(got.message ->> 'body_text', 'Hello Dana, please set Reyes Bakery aside.', 'the note as written');
    END IF;
  END LOOP;
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(n, 1, 'the withdrawal is claimed');
  PERFORM pg_temp.is((SELECT status FROM public.quote_request_messages WHERE id = m), 'queued', 'and is still queued, not failed');
END $$;

-- An intake at Ready for market, certified, with Insperity and Justworks authorized and each sent its bundle.
CREATE FUNCTION pg_temp.sent_intake(n text, company text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_temp.intake(n, 'acme', company);
  PERFORM pg_temp.certify(n, 1, 'EAA-2026-' || n);
  PERFORM pg_temp.authorize(n, 'Insperity', true);
  PERFORM pg_temp.authorize(n, 'Justworks', true);
  PERFORM pg_temp.sent(n, 'Insperity');
  PERFORM pg_temp.sent(n, 'Justworks');
END $$;

-- ---------- 19. Archiving a submission revokes the link of every PEO it closes, with no withdrawal sent (the advisor skipped it) ----------
-- D-1717: Won and Lost on an opportunity are marked on the opportunity (D-470), so the skipped-offer case is shown with Archived, which set_submission_status still allows.
-- Catches: an archived submission whose PEOs can still open the employer's packet because nobody wrote to them.
DO $$
BEGIN
  PERFORM pg_temp.sent_intake('bay', 'Bay Cafe');
  PERFORM pg_temp.fmove('bay', 'quoted');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.set_submission_status(pg_temp.id('bay'), 'archived');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.bundle_links WHERE session_id = pg_temp.id('bay') AND revoked_at IS NULL), 0, 'no live link is left');
  PERFORM pg_temp.is((SELECT array_agg(DISTINCT revoked_reason) FROM public.bundle_links WHERE session_id = pg_temp.id('bay')), ARRAY['submission_closed'],
    'each revoked as submission closed');
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.quote_request_messages WHERE session_id = pg_temp.id('bay') AND direction = 'sent' AND status = 'queued'), 0,
    'and nothing is sent');
END $$;

-- ---------- 20. Archiving a won search with the withdrawal (D-1717): one message, written once, queued on the thread of each PEO still open, never the winner's ----------
-- Catches: a closing withdrawal sent to the PEO the employer chose, one that starts a new thread, one with a link, or a PEO still open left untold.
DO $$
DECLARE r jsonb; jw bigint; ins bigint; m public.quote_request_messages; first public.quote_request_messages;
BEGIN
  PERFORM pg_temp.sent_intake('cove', 'Cove Dental');
  jw := pg_temp.qr('cove', 'Justworks'); ins := pg_temp.qr('cove', 'Insperity');
  UPDATE public.quote_requests SET status = 'quoted' WHERE id = jw;
  PERFORM pg_temp.fmove('cove', 'quoted');
  -- D-470: Won is marked on the opportunity, so here the search was won there (the winner is the submission's, as opportunity_mark_won leaves it) and the advisor now
  -- archives it (D-471, archived straight from Won), which set_submission_status still does and which closes the PEOs still open and tells each one.
  UPDATE public.submission_workflow SET status = 'won', won_quote_request_id = jw WHERE session_id = pg_temp.id('cove');
  SELECT * INTO first FROM public.quote_request_messages WHERE quote_request_id = ins AND direction = 'sent';
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  r := public.close_submission_and_withdraw(pg_temp.id('cove'), 'archived', NULL, jw, 'Cove Dental', 'Thank you for quoting Cove Dental; they have chosen another PEO.');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT status FROM public.submission_workflow WHERE session_id = pg_temp.id('cove')), 'archived', 'the submission is archived, with its winner kept');
  PERFORM pg_temp.is((SELECT won_quote_request_id FROM public.submission_workflow WHERE session_id = pg_temp.id('cove')), jw, 'and the winner is still named');
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.quote_request_messages WHERE quote_request_id = jw AND status = 'queued'), 0, 'nothing to the winner');
  SELECT * INTO m FROM public.quote_request_messages WHERE quote_request_id = ins AND status = 'queued';
  PERFORM pg_temp.is(m.body_text, 'Thank you for quoting Cove Dental; they have chosen another PEO.', 'the one note, as written');
  PERFORM pg_temp.is(m.to_addresses, first.to_addresses, 'to the people the PEO was sent to');
  PERFORM pg_temp.is(m.in_reply_to, first.message_id, 'on the PEO''s thread');
  PERFORM pg_temp.is(m.bundle_link_id, NULL::bigint, 'with no link');
  PERFORM pg_temp.is((SELECT revoked_reason FROM public.bundle_links WHERE quote_request_id = ins ORDER BY id DESC LIMIT 1), 'submission_closed', 'its link revoked');
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.bundle_links WHERE quote_request_id = jw AND revoked_at IS NULL), 1, 'the winner''s link still works');
  PERFORM pg_temp.is(r -> 'message_ids', jsonb_build_array(m.id), 'and it answers the messages it queued');
END $$;

-- ---------- 20b. Won or Lost on an opportunity is refused, and then nothing moves and nothing is sent (D-470, D-1717) ----------
-- Catches: close_submission_and_withdraw moving a submission to Won or Lost around its opportunity (no placement, no renewal, no commission, no lost reason),
-- or queuing the withdrawals of a move that was refused. Those are done on the opportunity's won/lost dialog (Epic 5, slice 5.0b), which then sends them.
DO $$
DECLARE jw bigint; before integer;
BEGIN
  PERFORM pg_temp.sent_intake('fern', 'Fern Bakery');
  jw := pg_temp.qr('fern', 'Justworks');
  UPDATE public.quote_requests SET status = 'quoted' WHERE id = jw;
  PERFORM pg_temp.fmove('fern', 'quoted');
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.opportunities WHERE intake_id = pg_temp.id('fern')), 1, 'the submission sits on an opportunity');
  before := (SELECT count(*) FROM public.quote_request_messages);
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.close_submission_and_withdraw(%L, 'won', NULL, %s, 'S', 'Thank you.')$s$, pg_temp.id('fern'), jw)),
    '22023: Mark it won or lost on its opportunity', 'won is refused');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.close_submission_and_withdraw(%L, 'lost', NULL, NULL, 'S', 'Thank you.')$s$, pg_temp.id('fern'))),
    '22023: Mark it won or lost on its opportunity', 'and so is lost');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT status FROM public.submission_workflow WHERE session_id = pg_temp.id('fern')), 'quoted', 'the submission did not move');
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.quote_request_messages), before, 'no withdrawal was queued');
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.bundle_links WHERE session_id = pg_temp.id('fern') AND revoked_at IS NULL), 2, 'and no link was revoked');
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.quote_requests WHERE session_id = pg_temp.id('fern') AND status = 'closed'), 0, 'or quote request closed');
END $$;

-- ---------- 21. With no connected mailbox the closing withdrawal is refused, and then nothing moves (D-634) ----------
-- Catches: a submission marked Lost while the withdrawal the advisor wrote is dropped (no From), so the PEOs are never told.
DO $$
DECLARE before integer;
BEGIN
  PERFORM pg_temp.sent_intake('dune', 'Dune Surf');
  PERFORM pg_temp.fmove('dune', 'quoted');
  before := (SELECT count(*) FROM public.quote_request_messages);
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.close_submission_and_withdraw(%L, 'archived', NULL, NULL, 'S', 'N')$s$, pg_temp.id('dune'))),
    'PT412: Connect your mailbox to send from here.', 'no mailbox');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT status FROM public.submission_workflow WHERE session_id = pg_temp.id('dune')), 'quoted', 'the submission did not move');
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.quote_request_messages), before, 'and nothing is recorded');
END $$;

-- ---------- 22. The closing withdrawal keeps 6.2's limits, and then nothing moves ----------
-- Catches: a submission marked Lost with a withdrawal that can never be sent (a subject of two lines, or no words).
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.close_submission_and_withdraw(%L, 'archived', NULL, NULL, E'S\nBcc: eve@evil.example', 'N')$s$, pg_temp.id('dune'))),
    '22023: A subject is one line.', 'a subject of two lines');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT status FROM public.submission_workflow WHERE session_id = pg_temp.id('dune')), 'quoted', 'the submission did not move');
END $$;

-- ---------- 23. Sending to a withdrawn PEO again reopens its quote request and clears the withdrawal's reason ----------
-- Catches: a reopened quote request still showing advisors "withdrawn: the employer went elsewhere" while the PEO is quoting again.
DO $$
DECLARE q bigint := pg_temp.qr('reyes', 'TriNet');
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.send_to_peo(pg_temp.id('reyes'), 'TriNet', ARRAY['dana@trinet.example'], 'Reyes Bakery', 'Hello Dana, back again.');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT status FROM public.quote_requests WHERE id = q), 'sent', 'reopened');
  PERFORM pg_temp.is((SELECT withdrawn_reason FROM public.quote_requests WHERE id = q), NULL::text, 'with no reason left');
END $$;
