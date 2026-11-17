-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh opportunity_close_withdraw
-- Closing an opportunity (slice 5.0y; docs/BROKER_CRM_BUILD.md D-1720 to D-1729; 20261123090000_opportunity_close_withdraw.sql): marking it Won or Lost revokes the live
-- bundle links of the quote requests it closes, and the _and_withdraw wrappers tell the PEOs still open, all or none. Two firms. Every migration is loaded, in filename
-- order (D-105), this slice's last.
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
\i supabase/migrations/20261124160000_reply_suggestions.sql
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


-- ---------- fixtures of this slice: an owner of Acme, three PEOs sent to, two of them quoted, the submission at Quoted ----------
DO $$
BEGIN
  PERFORM pg_temp.new_user('acme_owner');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (pg_temp.id('acme'), pg_temp.id('acme_owner'), 'owner');
  PERFORM pg_temp.mailbox('acme_owner', 'olive@acme.example');
  PERFORM pg_temp.sent('reyes', 'Insperity');
  PERFORM pg_temp.sent('reyes', 'TriNet');
  PERFORM pg_temp.sent('reyes', 'Justworks');
  UPDATE public.quote_requests SET status = 'quoted' WHERE session_id = pg_temp.id('reyes') AND peo_name IN ('Insperity', 'TriNet');
  PERFORM pg_temp.fmove('reyes', 'quoted');
END $$;

CREATE FUNCTION pg_temp.opp_version(intake text) RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT o.version FROM public.opportunities o WHERE o.intake_id = pg_temp.id(intake)
$$;
CREATE FUNCTION pg_temp.opp(intake text) RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT o.id FROM public.opportunities o WHERE o.intake_id = pg_temp.id(intake)
$$;

-- ---------- 1. Marking won revokes the live link of every quote request it closes, never the winner's ----------
-- Catches: a win that closes the other PEOs but leaves their bundle links live, so a PEO that lost can still open the employer's packet.
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM public.opportunity_mark_won(pg_temp.opp('reyes'), pg_temp.qr('reyes', 'Insperity'), '2027-01-01', NULL, 'Acme Brokers',
                                      pg_temp.id('acme'), pg_temp.opp_version('reyes'));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT revoked_reason FROM public.bundle_links WHERE quote_request_id = pg_temp.qr('reyes', 'TriNet')), 'submission_closed', 'a quoted PEO that lost');
  PERFORM pg_temp.is((SELECT revoked_reason FROM public.bundle_links WHERE quote_request_id = pg_temp.qr('reyes', 'Justworks')), 'submission_closed', 'a PEO still only sent to');
  PERFORM pg_temp.is((SELECT revoked_at IS NULL FROM public.bundle_links WHERE quote_request_id = pg_temp.qr('reyes', 'Insperity')), true, 'the winner keeps its link');
END $$;

-- A second search, Bay Shop, sent to Insperity (quoted) and TriNet (only sent to), for the Lost tests.
CREATE FUNCTION pg_temp.bay() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_temp.intake('bay', 'acme', 'Bay Shop');
  PERFORM pg_temp.certify('bay', 1, 'EAA-2026-0044');
  PERFORM pg_temp.authorize('bay', 'Insperity', true);
  PERFORM pg_temp.authorize('bay', 'TriNet', true);
  PERFORM pg_temp.sent('bay', 'Insperity');
  PERFORM pg_temp.sent('bay', 'TriNet');
  UPDATE public.quote_requests SET status = 'quoted' WHERE id = pg_temp.qr('bay', 'Insperity');
  PERFORM pg_temp.fmove('bay', 'quoted');
END $$;
DO $$ BEGIN PERFORM pg_temp.bay(); END $$;

-- ---------- 2. Marking lost revokes every live link: a lost search has no winner ----------
-- Catches: a loss that closes the PEOs (search ended) but leaves their packet links live.
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM public.opportunity_mark_lost(pg_temp.opp('bay'), 'price', NULL, pg_temp.id('acme'), pg_temp.opp_version('bay'));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT array_agg(revoked_reason ORDER BY quote_request_id) FROM public.bundle_links WHERE session_id = pg_temp.id('bay')),
    ARRAY['submission_closed', 'submission_closed'], 'both PEOs lose their link');
END $$;

-- A search sent to Insperity, TriNet and Justworks, the first two quoted, at Quoted, as acme_agent sent it. Named n; company c; its File ID f.
CREATE FUNCTION pg_temp.search(n text, c text, f text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_temp.intake(n, 'acme', c);
  PERFORM pg_temp.certify(n, 1, f);
  PERFORM pg_temp.authorize(n, 'Insperity', true);
  PERFORM pg_temp.authorize(n, 'TriNet', true);
  PERFORM pg_temp.authorize(n, 'Justworks', true);
  PERFORM pg_temp.sent(n, 'Insperity');
  PERFORM pg_temp.sent(n, 'TriNet');
  PERFORM pg_temp.sent(n, 'Justworks');
  UPDATE public.quote_requests SET status = 'quoted' WHERE session_id = pg_temp.id(n) AND peo_name IN ('Insperity', 'TriNet');
  PERFORM pg_temp.fmove(n, 'quoted');
END $$;
DO $$ BEGIN PERFORM pg_temp.search('cove', 'Cove Cafe', 'EAA-2026-0045'); END $$;

-- The messages on a quote request's thread the product has queued or sent.
CREATE FUNCTION pg_temp.sent_count(q bigint) RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT count(*)::integer FROM public.quote_request_messages m WHERE m.quote_request_id = q AND m.direction = 'sent'
$$;

-- ---------- 3. Won and withdraw: each PEO still open but the winner is sent the one note on its own thread ----------
-- Catches: a wrapper that marks the win and tells nobody, tells the winner, or writes on a thread that is not the PEO's own.
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  r := public.opportunity_mark_won_and_withdraw(pg_temp.opp('cove'), pg_temp.qr('cove', 'Insperity'), '2027-01-01', NULL, 'Acme Brokers',
                                                pg_temp.id('acme'), pg_temp.opp_version('cove'), NULL, NULL, NULL, 'UTC', 'Re: Cove Cafe', 'The employer chose another PEO. Thank you.');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(r #>> '{record,stage}', 'won', 'the win');
  PERFORM pg_temp.is(pg_temp.sent_count(pg_temp.qr('cove', 'TriNet')), 2, 'TriNet is written to on its own thread');
  PERFORM pg_temp.is(pg_temp.sent_count(pg_temp.qr('cove', 'Justworks')), 2, 'Justworks too');
  PERFORM pg_temp.is(pg_temp.sent_count(pg_temp.qr('cove', 'Insperity')), 1, 'the winner is not');
  PERFORM pg_temp.is((SELECT m.body_text FROM public.quote_request_messages m WHERE m.quote_request_id = pg_temp.qr('cove', 'TriNet') AND m.direction = 'sent'
                      ORDER BY m.id DESC LIMIT 1), 'The employer chose another PEO. Thank you.', 'the note');
END $$;

-- ---------- 4. A PEO already closed is not written to ----------
-- Catches: a withdrawal sent to a PEO the advisor had already withdrawn from or that had closed, which tells it twice.
DO $$
BEGIN
  PERFORM pg_temp.search('dune', 'Dune Dental', 'EAA-2026-0046');
  UPDATE public.quote_requests SET status = 'closed' WHERE id = pg_temp.qr('dune', 'Justworks');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM public.opportunity_mark_won_and_withdraw(pg_temp.opp('dune'), pg_temp.qr('dune', 'Insperity'), '2027-01-01', NULL, 'Acme Brokers',
                                                   pg_temp.id('acme'), pg_temp.opp_version('dune'), NULL, NULL, NULL, 'UTC', 'Re: Dune Dental', 'Thank you.');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.sent_count(pg_temp.qr('dune', 'Justworks')), 1, 'the closed PEO is not written to');
  PERFORM pg_temp.is(pg_temp.sent_count(pg_temp.qr('dune', 'TriNet')), 2, 'the open one is');
END $$;

-- ---------- 5. A PEO whose send was recorded by hand has no thread and is not written to ----------
-- Catches: a withdrawal aimed at a PEO the product never wrote to, which has no address to send to and would make the whole close fail.
DO $$
BEGIN
  PERFORM pg_temp.search('elm', 'Elm Florist', 'EAA-2026-0047');
  DELETE FROM public.quote_request_messages WHERE quote_request_id = pg_temp.qr('elm', 'Justworks');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM public.opportunity_mark_won_and_withdraw(pg_temp.opp('elm'), pg_temp.qr('elm', 'Insperity'), '2027-01-01', NULL, 'Acme Brokers',
                                                   pg_temp.id('acme'), pg_temp.opp_version('elm'), NULL, NULL, NULL, 'UTC', 'Re: Elm Florist', 'Thank you.');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.sent_count(pg_temp.qr('elm', 'Justworks')), 0, 'the hand-recorded PEO is not written to');
  PERFORM pg_temp.is(pg_temp.sent_count(pg_temp.qr('elm', 'TriNet')), 2, 'the other is');
END $$;

-- A second owner of Acme who has not connected a mailbox.
DO $$
BEGIN
  PERFORM pg_temp.new_user('acme_owner2');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (pg_temp.id('acme'), pg_temp.id('acme_owner2'), 'owner');
END $$;

-- ---------- 6. With no mailbox connected the close is refused (PT412) and nothing moves ----------
-- Catches: a win that goes through and tells nobody because the advisor has no mailbox to send from, or a half-done close.
DO $$
BEGIN
  PERFORM pg_temp.search('fig', 'Fig Grocer', 'EAA-2026-0048');
  PERFORM pg_temp.as_user('acme_owner2', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.opportunity_mark_won_and_withdraw(%L, %s, '2027-01-01', NULL, 'Acme Brokers', %L, %s, NULL, NULL, NULL, 'UTC', 'Re: Fig', 'Thanks')$s$,
      pg_temp.opp('fig'), pg_temp.qr('fig', 'Insperity'), pg_temp.id('acme'), pg_temp.opp_version('fig'))),
    'PT412: Connect your mailbox to send from here.', 'no mailbox');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(public.opportunity_stage(pg_temp.opp('fig')), 'quoted', 'the opportunity did not move');
  PERFORM pg_temp.is((SELECT revoked_at IS NULL FROM public.bundle_links WHERE quote_request_id = pg_temp.qr('fig', 'TriNet')), true, 'no link was revoked');
END $$;

-- ---------- 7. A closing firm and a support session are refused first, before the mailbox is asked (PT423; ADR 0023, ADR 0024) ----------
-- Catches: a wrapper that asks the mailbox (or reads anything) before the one write guard, so a read-only firm is told "connect your mailbox" instead of "can't change".
DO $$
DECLARE stmt text;
BEGIN
  PERFORM pg_temp.search('gum', 'Gum Tree', 'EAA-2026-0049');
  stmt := format($s$SELECT public.opportunity_mark_won_and_withdraw(%L, %s, '2027-01-01', NULL, 'Acme Brokers', %L, %s, NULL, NULL, NULL, 'UTC', 'Re: Gum', 'Thanks')$s$,
    pg_temp.opp('gum'), pg_temp.qr('gum', 'Insperity'), pg_temp.id('acme'), pg_temp.opp_version('gum'));
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (pg_temp.id('acme'), pg_temp.id('acme_owner'), now() + interval '30 days');
  PERFORM pg_temp.as_user('acme_owner2', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(stmt), ':', 1), 'PT423', 'a closing firm');
  PERFORM pg_temp.as_owner();
  DELETE FROM public.firm_closures WHERE firm_id = pg_temp.id('acme');
  PERFORM pg_temp.new_user('platform_admin');
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('platform_admin'), 'admin');
  INSERT INTO public.support_sessions (firm_id, admin_id, admin_email, reason, started_at, ends_at)
  VALUES (pg_temp.id('acme'), pg_temp.id('platform_admin'), 'platform_admin@example.test', 'Looking', now(), now() + interval '1 hour');
  PERFORM pg_temp.as_user('platform_admin', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(stmt), 'PT423: Nevermore support can look, not change', 'a support session');
  PERFORM pg_temp.as_owner();
  DELETE FROM public.support_sessions WHERE firm_id = pg_temp.id('acme');
  PERFORM pg_temp.is(public.opportunity_stage(pg_temp.opp('gum')), 'quoted', 'nothing moved');
END $$;

-- ---------- 8. Someone who is not a member of the firm is refused (42501) before the mailbox is asked ----------
-- Catches: a close that tells a non-member "connect your mailbox" (and so confirms the opportunity is there), or lets them past, for another firm's opportunity.
DO $$
DECLARE stmt text;
BEGIN
  PERFORM pg_temp.new_user('nobody');
  PERFORM pg_temp.search('hop', 'Hop Brewery', 'EAA-2026-0050');
  stmt := format($s$SELECT public.opportunity_mark_won_and_withdraw(%L, %s, '2027-01-01', NULL, 'Acme Brokers', %L, %s, NULL, NULL, NULL, 'UTC', 'Re: Hop', 'Thanks')$s$,
    pg_temp.opp('hop'), pg_temp.qr('hop', 'Insperity'), pg_temp.id('acme'), pg_temp.opp_version('hop'));
  PERFORM pg_temp.as_user('nobody');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(stmt), ':', 1), '42501', 'a stranger');
  PERFORM pg_temp.as_user('zenith_agent', 'zenith-benefits');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(stmt), ':', 1), '42501', 'another firm''s agent');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(split_part(pg_temp.refusal(stmt), ':', 1), '42501', 'anon');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(public.opportunity_stage(pg_temp.opp('hop')), 'quoted', 'nothing moved');
END $$;

-- ---------- 9. A conflict (someone saved first) comes back as the plain function gives it and sends nothing (D-46) ----------
-- Catches: a stale page that, told "someone else changed this", still writes the withdrawal to every PEO.
DO $$
DECLARE v integer; r jsonb;
BEGIN
  PERFORM pg_temp.search('ivy', 'Ivy Studio', 'EAA-2026-0051');
  v := pg_temp.opp_version('ivy');
  UPDATE public.opportunities SET name = name || ' (renamed)' WHERE id = pg_temp.opp('ivy');
  PERFORM pg_temp.is(pg_temp.opp_version('ivy') > v, true, 'the fixture moved the version');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  r := public.opportunity_mark_won_and_withdraw(pg_temp.opp('ivy'), pg_temp.qr('ivy', 'Insperity'), '2027-01-01', NULL, 'Acme Brokers',
                                                pg_temp.id('acme'), v, NULL, NULL, NULL, 'UTC', 'Re: Ivy', 'Thanks');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((r ->> 'conflict')::boolean, true, 'a conflict');
  PERFORM pg_temp.is(pg_temp.sent_count(pg_temp.qr('ivy', 'TriNet')), 1, 'TriNet is told nothing');
END $$;

-- ---------- 10. A subject or note outside 6.2's limits is refused (22023) and nothing moves ----------
-- Catches: a wrapper that checks the limits only after the win, or never, so the opportunity is won and the PEOs are never told.
DO $$
DECLARE stmt text;
BEGIN
  PERFORM pg_temp.search('jet', 'Jet Wash', 'EAA-2026-0052');
  stmt := format($s$SELECT public.opportunity_mark_won_and_withdraw(%L, %s, '2027-01-01', NULL, 'Acme Brokers', %L, %s, NULL, NULL, NULL, 'UTC', ' ', 'Thanks')$s$,
    pg_temp.opp('jet'), pg_temp.qr('jet', 'Insperity'), pg_temp.id('acme'), pg_temp.opp_version('jet'));
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(stmt), ':', 1), '22023', 'an empty subject');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(public.opportunity_stage(pg_temp.opp('jet')), 'quoted', 'nothing moved');
END $$;

-- ---------- 11. Lost and withdraw: every PEO still open is sent the note, there being no winner ----------
-- Catches: a loss that tells nobody, or spares a PEO as if it had won.
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.search('kiln', 'Kiln Pottery', 'EAA-2026-0053');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  r := public.opportunity_mark_lost_and_withdraw(pg_temp.opp('kiln'), 'price', NULL, pg_temp.id('acme'), pg_temp.opp_version('kiln'), 'Re: Kiln Pottery', 'The employer is not going ahead.');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(r #>> '{record,stage}', 'lost', 'the loss');
  PERFORM pg_temp.is((SELECT array_agg(pg_temp.sent_count(pg_temp.qr('kiln', p)) ORDER BY p) FROM unnest(ARRAY['Insperity', 'Justworks', 'TriNet']) p), ARRAY[2, 2, 2], 'all three told');
END $$;

-- ---------- 12. (pinning) Lost carries the same refusals as Won: no mailbox is PT412 and nothing moves; a stale version sends nothing ----------
-- Catches: the loss wrapper skipping the shared checks the win wrapper makes. It passes on first run because both wrappers call the same two internal halves;
-- it is here because the mutation "the loss wrapper does not call opportunity_withdrawal_start" is otherwise undetected.
DO $$
DECLARE v integer; r jsonb;
BEGIN
  PERFORM pg_temp.search('lark', 'Lark Bakery', 'EAA-2026-0054');
  PERFORM pg_temp.as_user('acme_owner2', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.opportunity_mark_lost_and_withdraw(%L, 'price', NULL, %L, %s, 'Re: Lark', 'Thanks')$s$,
      pg_temp.opp('lark'), pg_temp.id('acme'), pg_temp.opp_version('lark'))), 'PT412: Connect your mailbox to send from here.', 'no mailbox');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(public.opportunity_stage(pg_temp.opp('lark')), 'quoted', 'nothing moved');
  v := pg_temp.opp_version('lark');
  UPDATE public.opportunities SET name = name || ' (renamed)' WHERE id = pg_temp.opp('lark');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  r := public.opportunity_mark_lost_and_withdraw(pg_temp.opp('lark'), 'price', NULL, pg_temp.id('acme'), v, 'Re: Lark', 'Thanks');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((r ->> 'conflict')::boolean, true, 'a conflict');
  PERFORM pg_temp.is(pg_temp.sent_count(pg_temp.qr('lark', 'TriNet')), 1, 'nobody told');
END $$;

-- ---------- 13. Won and lost close, and tell, a PEO that acknowledged or has a question open, as they do one still sent (5.1, D-1737) ----------
-- Catches: the closes and the withdrawal reading open as only 'sent', which leaves an acknowledging or questioning PEO open on a closed search.
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.search('mint', 'Mint Dental', 'EAA-2026-0055');
  UPDATE public.quote_requests SET status = 'acknowledged' WHERE id = pg_temp.qr('mint', 'Justworks');
  UPDATE public.quote_requests SET status = 'question_open' WHERE id = pg_temp.qr('mint', 'TriNet');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  r := public.opportunity_mark_lost_and_withdraw(pg_temp.opp('mint'), 'price', NULL, pg_temp.id('acme'), pg_temp.opp_version('mint'), 'Re: Mint Dental', 'The employer is not going ahead.');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT array_agg(q.status ORDER BY q.peo_name) FROM public.quote_requests q WHERE q.session_id = (SELECT intake_id FROM public.opportunities WHERE id = pg_temp.opp('mint'))),
    ARRAY['closed', 'closed', 'closed'], 'every open PEO closed, acknowledged and question open included');
  PERFORM pg_temp.is((SELECT array_agg(pg_temp.sent_count(pg_temp.qr('mint', p)) ORDER BY p) FROM unnest(ARRAY['Insperity', 'Justworks', 'TriNet']) p), ARRAY[2, 2, 2], 'and every one told');
END $$;
