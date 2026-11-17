-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh employer_ends_access
-- The employer ends a firm's access to their intake (story CRM-P2.5 / P-2.3, slice 5.13; docs/BROKER_CRM_BUILD.md D-1714, D-1703, D-1820 to D-1829;
-- 20261123200000_employer_ends_access.sql). Only the intake's own employer; the intake leaves the firm for the default firm (no outside firm) and
-- its opportunity goes back to Qualifying; no further send; live bundle links revoked; what was sent, the account, its contacts and the firm's notes stay.
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
\i supabase/migrations/20261123130000_new_quote_account.sql
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


CREATE FUNCTION pg_temp.end_access(who text, intake text, addr text DEFAULT NULL) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  PERFORM pg_temp.as_user(who, addr);
  r := pg_temp.refusal(format('SELECT public.employer_end_firm_access(%L)', pg_temp.id(intake)));
  PERFORM pg_temp.as_owner();
  RETURN r;
END $$;

-- ---------- 1. Only the intake's own employer ----------
-- Catches: a firm's agent (or another employer) ending an intake's access, so the firm's own member, or a stranger, can detach any employer's intake.
SELECT pg_temp.is(pg_temp.end_access('acme_agent', 'reyes', 'acme-brokers'), '42501: Only the employer can end a firm''s access to their intake.', 'a member of the firm');
SELECT pg_temp.is(pg_temp.end_access('p_zed', 'reyes'), '42501: Only the employer can end a firm''s access to their intake.', 'another employer');
SELECT pg_temp.is((SELECT firm_id FROM public.chamber_sessions WHERE id = pg_temp.id('reyes')), pg_temp.id('acme'), 'the intake stays with its firm');

-- A certified intake of Acme, with its PEOs authorized, as the fixtures above make one.
CREATE FUNCTION pg_temp.fresh(n text, company text, file_id text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_temp.intake(n, 'acme', company);
  PERFORM pg_temp.certify(n, 1, file_id);
  PERFORM pg_temp.authorize(n, 'Insperity', true);
  PERFORM pg_temp.authorize(n, 'TriNet', true);
END $$;

-- ---------- 2. The employer ends it: the intake leaves the firm ----------
-- Catches: ending access that changes nothing about whose intake it is, so the firm still sees the employer's answers.
DO $$
BEGIN
  PERFORM pg_temp.fresh('ann', 'Ann Co', 'EAA-2026-0101');
  PERFORM pg_temp.is(pg_temp.end_access('p_ann', 'ann'), 'ok', 'the employer ends it');
  PERFORM pg_temp.is((SELECT firm_id FROM public.chamber_sessions WHERE id = pg_temp.id('ann')), public.default_firm_id(), 'the intake is with no outside firm');
END $$;

-- ---------- 3. The firm's opportunity goes back to Qualifying and keeps the account and contacts ----------
-- Catches: the opportunity still holding the employer's intake (and showing its stage), or the account and its contacts going with the intake.
DO $$
DECLARE o uuid := (SELECT id FROM public.opportunities WHERE name = 'Ann Co – PEO search');
BEGIN
  PERFORM pg_temp.is((SELECT intake_id IS NULL FROM public.opportunities WHERE id = o), true, 'the opportunity no longer holds the intake');
  PERFORM pg_temp.is(public.opportunity_stage(o), 'qualifying', 'the opportunity is back to Qualifying');
  PERFORM pg_temp.is((SELECT a.firm_id FROM public.accounts a JOIN public.opportunities x ON x.account_id = a.id WHERE x.id = o), pg_temp.id('acme'), 'the account stays with the firm');
END $$;

-- ---------- 4. The ending is recorded, for the firm: who ended it, when, which intake and opportunity ----------
-- Catches: an ending that leaves no trace the firm can read, so a firm can't tell why an opportunity lost its intake.
DO $$
DECLARE r public.intake_access_ends;
BEGIN
  SELECT * INTO r FROM public.intake_access_ends WHERE session_id = pg_temp.id('ann');
  PERFORM pg_temp.is(r.firm_id, pg_temp.id('acme'), 'the record is the firm''s');
  PERFORM pg_temp.is(r.firm_name, 'Acme Brokers', 'it names the firm as it was');
  PERFORM pg_temp.is(r.ended_by, pg_temp.id('p_ann'), 'it names the employer');
  PERFORM pg_temp.is(r.opportunity_id, (SELECT id FROM public.opportunities WHERE name = 'Ann Co – PEO search'), 'it names the opportunity that held the intake');
END $$;

-- ---------- 5. The record is only appended ----------
-- Catches: a record of an ending that can be edited or deleted, by anyone, the table's owner included.
SELECT pg_temp.is(left(pg_temp.refusal(format('UPDATE public.intake_access_ends SET firm_name = %L WHERE session_id = %L', 'Other', pg_temp.id('ann'))), 5), '42501', 'it can''t be changed');
SELECT pg_temp.is(left(pg_temp.refusal(format('DELETE FROM public.intake_access_ends WHERE session_id = %L', pg_temp.id('ann'))), 5), '42501', 'or deleted');

-- A send as an agent of a firm: send_to_peo, the whole of 6.6's first step.
CREATE FUNCTION pg_temp.send_try(who text, addr text, intake text, peo text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  PERFORM pg_temp.as_user(who, addr);
  r := pg_temp.refusal(format('SELECT public.send_to_peo(%L, %L, ARRAY[%L], %L, %L)', pg_temp.id(intake), peo, 'dana@' || lower(peo) || '.example',
    'Ann Co: EAA-2026-0101, version 1', 'Hello Dana, here it is.'));
  PERFORM pg_temp.as_owner();
  RETURN CASE WHEN r = 'ok' THEN 'ok' ELSE r END;
END $$;

-- ---------- 6. No further send, by the firm that lost the intake or by anyone ----------
-- Catches: a send to a PEO still going out for an intake whose employer ended the firm's access (the firm, or the default firm that now holds it).
DO $$
BEGIN
  PERFORM pg_temp.new_user('edgar_agent');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (public.default_firm_id(), pg_temp.id('edgar_agent'), 'agent');
  PERFORM pg_temp.mailbox('edgar_agent', 'ed@edgar.example');
  PERFORM pg_temp.is(pg_temp.send_try('acme_agent', 'acme-brokers', 'ann', 'Insperity'), 'PT404: Submission not found', 'the firm that lost the intake can''t find it to send');
  PERFORM pg_temp.is(pg_temp.send_try('edgar_agent', NULL, 'ann', 'Insperity'), '22023: The employer ended a firm''s access to this intake. Nothing more can be sent for it.', 'nor can the firm that holds it now');
END $$;

-- ---------- 7. Live bundle links are revoked ----------
-- Catches: a PEO still opening the employer's packet through a link the firm sent before the access ended.
DO $$
BEGIN
  PERFORM pg_temp.sent('reyes', 'Insperity');
  PERFORM pg_temp.sent('reyes', 'TriNet');
  PERFORM pg_temp.is((SELECT count(*) FROM public.bundle_links WHERE quote_request_id IN (pg_temp.qr('reyes', 'Insperity'), pg_temp.qr('reyes', 'TriNet')) AND revoked_at IS NULL), 2::bigint, 'setup: two live links');
  PERFORM pg_temp.is(pg_temp.end_access('p_reyes', 'reyes'), 'ok', 'the employer ends Acme''s access');
  PERFORM pg_temp.is((SELECT count(*) FROM public.bundle_links WHERE quote_request_id IN (pg_temp.qr('reyes', 'Insperity'), pg_temp.qr('reyes', 'TriNet')) AND revoked_reason = 'access_ended'), 2::bigint, 'both links are revoked, for that reason');
END $$;

-- ---------- 8. The firm keeps a note of what was sent, on the opportunity ----------
-- Catches: the opportunity losing the intake and with it every trace of which PEOs the firm had sent the packet to.
DO $$
DECLARE o uuid;
BEGIN
  PERFORM pg_temp.fresh('cy', 'Cy Co', 'EAA-2026-0102');
  PERFORM pg_temp.sent('cy', 'Insperity');
  PERFORM pg_temp.sent('cy', 'TriNet');
  o := (SELECT id FROM public.opportunities WHERE name = 'Cy Co – PEO search');
  PERFORM pg_temp.is(pg_temp.end_access('p_cy', 'cy'), 'ok', 'the employer ends it');
  PERFORM pg_temp.is((SELECT count(*) FROM public.activities WHERE opportunity_id = o AND kind = 'note' AND body LIKE 'The employer ended Acme Brokers''s access to their intake%'), 1::bigint, 'one note on the opportunity says so');
  PERFORM pg_temp.is((SELECT body LIKE '%Sent to Insperity%' AND body LIKE '%Sent to TriNet%' FROM public.activities WHERE opportunity_id = o AND kind = 'note'), true, 'and says what was sent');
END $$;

-- ---------- 9. The firm's own notes on the submission are kept with the firm ----------
-- Catches: advisor notes (append-only, so they stay with the intake) being the firm's only copy of its notes, left for the default firm to read.
DO $$
DECLARE o uuid;
BEGIN
  PERFORM pg_temp.fresh('dee', 'Dee Co', 'EAA-2026-0103');
  INSERT INTO public.advisor_notes (session_id, author_id, body) VALUES (pg_temp.id('dee'), pg_temp.id('acme_agent'), 'Call back after the 15th about the renewal date.');
  o := (SELECT id FROM public.opportunities WHERE name = 'Dee Co – PEO search');
  PERFORM pg_temp.is(pg_temp.end_access('p_dee', 'dee'), 'ok', 'the employer ends it');
  PERFORM pg_temp.is((SELECT body LIKE '%Call back after the 15th about the renewal date.%' FROM public.activities WHERE opportunity_id = o AND kind = 'note'), true, 'the firm''s note on the submission is on the opportunity');
END $$;

-- ---------- 10. Nothing to end when no outside firm sees the intake ----------
-- Catches: ending twice (a second record and a second note), or "ending" an intake that was never an outside firm's.
DO $$
DECLARE before_n bigint := (SELECT count(*) FROM public.intake_access_ends);
BEGIN
  PERFORM pg_temp.is(pg_temp.end_access('p_ann', 'ann'), '22023: No firm sees this intake, so there is nothing to end.', 'ended already');
  PERFORM pg_temp.is(pg_temp.end_access('p_zed', 'zed', 'zenith-benefits'), 'ok', 'setup: Zenith''s employer ends theirs');
  PERFORM pg_temp.new_user('p_own');
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (pg_temp.id('p_own'), '{"company_name": "Own Co"}');
  INSERT INTO fx SELECT 'own', id FROM public.chamber_sessions WHERE user_id = pg_temp.id('p_own');
  PERFORM pg_temp.is(pg_temp.end_access('p_own', 'own'), '22023: No firm sees this intake, so there is nothing to end.', 'an intake that was always the default firm''s');
  PERFORM pg_temp.is((SELECT count(*) FROM public.intake_access_ends), before_n + 1, 'only the one real ending is recorded');
END $$;

-- ---------- 11. A closing firm can't stop it: the employer's own say ----------
-- Catches: a firm that has asked to close (read-only, ADR 0023) holding an intake the employer wants out of it.
DO $$
DECLARE o uuid;
BEGIN
  INSERT INTO fx VALUES ('closer', gen_random_uuid());
  INSERT INTO public.firms (id, name, address, approved_at) VALUES (pg_temp.id('closer'), 'Closer Brokers', 'closer-brokers', now());
  PERFORM pg_temp.intake('eve', 'closer', 'Eve Co');
  PERFORM pg_temp.certify('eve', 1, 'EAA-2026-0104');
  INSERT INTO public.firm_closures (firm_id, asked_at, closes_at) VALUES (pg_temp.id('closer'), now() - interval '1 day', now() + interval '29 days');
  PERFORM pg_temp.is(pg_temp.end_access('p_eve', 'eve'), 'ok', 'the employer ends a closing firm''s access');
  PERFORM pg_temp.is((SELECT firm_id FROM public.chamber_sessions WHERE id = pg_temp.id('eve')), public.default_firm_id(), 'the intake is with no outside firm');
END $$;

-- ---------- 12. A draft nobody has certified leaves with no chain made ----------
-- Catches: an unfinished intake getting an account, contact and opportunity in the default firm when it leaves (the rule asks them of submissions only).
DO $$
DECLARE sid uuid;
BEGIN
  PERFORM pg_temp.new_user('p_draft');
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (pg_temp.id('p_draft'), '{"company_name": "Draft Co"}') RETURNING id INTO sid;
  UPDATE public.chamber_sessions SET firm_id = pg_temp.id('acme') WHERE id = sid;
  INSERT INTO fx VALUES ('draft', sid);
  PERFORM pg_temp.is(pg_temp.end_access('p_draft', 'draft'), 'ok', 'the employer ends it');
  PERFORM pg_temp.is((SELECT firm_id FROM public.chamber_sessions WHERE id = sid), public.default_firm_id(), 'it is with no outside firm');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE intake_id = sid), 0::bigint, 'and sits on no opportunity, as no draft does');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE name = 'Draft Co'), 0::bigint, 'nor made an account');
END $$;

-- ---------- 13. The employer is shown which firm sees each of their intakes ----------
-- Catches: the profile having no way to name the firm (a firm's name is not readable by an employer), or naming a firm for an intake it no longer sees,
-- or another person's intake.
CREATE FUNCTION pg_temp.my_firms(who text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  PERFORM pg_temp.as_user(who);
  SELECT COALESCE(string_agg(f.session_id::text || '=' || f.firm_name || '/' || COALESCE(f.company, ''), ',' ORDER BY f.firm_name), '') INTO r FROM public.my_intake_firms() f;
  PERFORM pg_temp.as_owner();
  RETURN r;
END $$;

DO $$
BEGIN
  PERFORM pg_temp.fresh('fay', 'Fay Co', 'EAA-2026-0105');
  PERFORM pg_temp.is(pg_temp.my_firms('p_fay'), pg_temp.id('fay')::text || '=Acme Brokers/Fay Co', 'the employer sees the firm that sees their intake');
  PERFORM pg_temp.is(pg_temp.my_firms('p_ann'), '', 'none once it is ended');
  PERFORM pg_temp.is(pg_temp.my_firms('acme_agent'), '', 'a firm''s agent is shown none of the employers'' intakes');
END $$;

-- ---------- 14. What was already sent, the account, its contacts and the firm's notes stay ----------
-- Catches: ending access deleting or changing what the firm already holds: the quote requests and their mail, the account, a contact, an earlier note.
DO $$
DECLARE o uuid; a uuid;
BEGIN
  PERFORM pg_temp.fresh('gus', 'Gus Co', 'EAA-2026-0106');
  o := (SELECT id FROM public.opportunities WHERE name = 'Gus Co – PEO search');
  a := (SELECT account_id FROM public.opportunities WHERE id = o);
  INSERT INTO public.contacts (firm_id, account_id, first_name, last_name, email, is_main) VALUES (pg_temp.id('acme'), a, 'Gus', 'Reyes', 'gus@gus.example', true);
  INSERT INTO public.activities (firm_id, account_id, opportunity_id, kind, body) VALUES (pg_temp.id('acme'), a, o, 'note', 'Spoke on the phone; wants Insperity.');
  PERFORM pg_temp.sent('gus', 'Insperity');
  PERFORM pg_temp.is(pg_temp.end_access('p_gus', 'gus'), 'ok', 'the employer ends it');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quote_requests WHERE session_id = pg_temp.id('gus') AND status = 'sent'), 1::bigint, 'the quote request is as it was');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quote_request_messages WHERE session_id = pg_temp.id('gus') AND direction = 'sent'), 1::bigint, 'the message sent to the PEO is kept');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE id = a AND firm_id = pg_temp.id('acme')), 1::bigint, 'the account stays with the firm');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = a AND firm_id = pg_temp.id('acme')), 1::bigint, 'and its contact');
  PERFORM pg_temp.is((SELECT count(*) FROM public.activities WHERE opportunity_id = o AND body = 'Spoke on the phone; wants Insperity.'), 1::bigint, 'and the firm''s own note');
END $$;
