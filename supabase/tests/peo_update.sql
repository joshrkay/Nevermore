-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh peo_update
-- Sending an update to a PEO (M-2.3, slice 6.8, #202; docs/BROKER_CRM_BUILD.md D-1610 to D-1619; 20261122180000_peo_update.sql).
-- A PEO holding an older certified version is sent the newer one on the same thread (send_peo_update): what changed named by label and the census by
-- count, never a value; the old link revoked as newer_version and a new one issued; a quote kept and marked as given on the older version. Two firms.
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
\i supabase/migrations/20261121090000_leads.sql
\i supabase/migrations/20261121100000_create_lead.sql
\i supabase/migrations/20261121110000_leads_table_query.sql
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

-- The update, as Acme's agent (or whoever is named), to Dana at the PEO, with the advisor's note; answers send_peo_update's answer.
CREATE FUNCTION pg_temp.update(intake text, peo text, who text DEFAULT 'acme_agent', addr text DEFAULT 'acme-brokers') RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user(who, addr);
  r := public.send_peo_update(pg_temp.id(intake), peo, ARRAY['dana@' || lower(peo) || '.example'], 'Reyes Bakery: EAA-2026-0042, version 2',
                              'Dana, the employer certified again.');
  PERFORM pg_temp.as_owner();
  RETURN r;
END $$;

-- ---------- set up: two firms; Acme's agent with a mailbox; Reyes Bakery certified as version 1 and sent to Insperity and TriNet, then certified
-- again as version 2 with its pay frequency and states changed and its census changed (one person left, one changed, two joined) ----------
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
  UPDATE public.chamber_sessions SET chamber_data = chamber_data || jsonb_build_object(
    'pay_frequency', 'weekly', 'states', jsonb_build_array('CA'), 'payroll_vendor', 'Gusto',
    'census', jsonb_build_array(
      jsonb_build_object('id', 'e1', 'first_name', 'Ana', 'annual_salary', 50000),
      jsonb_build_object('id', 'e2', 'first_name', 'Ben', 'annual_salary', 61000),
      jsonb_build_object('id', 'e3', 'first_name', 'Cy', 'annual_salary', 72000)))
  WHERE id = pg_temp.id('reyes');
  PERFORM pg_temp.certify('reyes', 1, 'EAA-2026-0042');
  PERFORM pg_temp.authorize('reyes', 'Insperity', true);
  PERFORM pg_temp.authorize('reyes', 'TriNet', true);
  PERFORM pg_temp.sent('reyes', 'Insperity');
  PERFORM pg_temp.sent('reyes', 'TriNet');
  UPDATE public.chamber_sessions SET chamber_data = chamber_data || jsonb_build_object(
    'pay_frequency', 'biweekly', 'states', jsonb_build_array('CA', 'TX'),
    'census', jsonb_build_array(
      jsonb_build_object('id', 'e1', 'first_name', 'Ana', 'annual_salary', 50000),
      jsonb_build_object('id', 'e2', 'first_name', 'Ben', 'annual_salary', 64000),
      jsonb_build_object('id', 'e4', 'first_name', 'Di', 'annual_salary', 81000),
      jsonb_build_object('id', 'e5', 'first_name', 'Ed', 'annual_salary', 92000)))
  WHERE id = pg_temp.id('reyes');
  PERFORM pg_temp.certify('reyes', 2, 'EAA-2026-0042');
  PERFORM pg_temp.intake('zed', 'zenith', 'Zed Tools');
  PERFORM pg_temp.certify('zed', 1, 'EAA-2026-0043');
  PERFORM pg_temp.authorize('zed', 'Justworks', true);
END $$;

-- ---------- 1. An update is queued on the PEO's own thread: the same quote request, the newer version, In-Reply-To the message before ----------
-- Catches: an update that starts a new thread (a new quote request, or no In-Reply-To), that records the old version as sent, or that forgets which
-- version the PEO held.
DO $$
DECLARE r jsonb; q public.quote_requests; m public.quote_request_messages; first public.quote_request_messages;
BEGIN
  SELECT * INTO first FROM public.quote_request_messages x
  WHERE x.direction = 'sent' AND x.quote_request_id = (SELECT id FROM public.quote_requests WHERE peo_name = 'Insperity');
  r := pg_temp.update('reyes', 'Insperity');
  SELECT * INTO q FROM public.quote_requests WHERE id = (r ->> 'quote_request_id')::bigint;
  PERFORM pg_temp.is(q.id, first.quote_request_id, 'the same quote request');
  PERFORM pg_temp.is(q.sent_version, 2, 'the newer version is the one sent');
  SELECT * INTO m FROM public.quote_request_messages WHERE id = (r ->> 'message_id')::bigint;
  PERFORM pg_temp.is(m.status, 'queued', 'queued, nothing sent yet');
  PERFORM pg_temp.is(m.in_reply_to, first.message_id, 'In-Reply-To the first message');
  PERFORM pg_temp.is(m.message_references, ARRAY[first.message_id], 'References continue the thread');
  PERFORM pg_temp.is(m.update_from_version, 1, 'the version the PEO held');
END $$;

-- ---------- 2. The update says what changed: the fields by label, the census by count, never a value ----------
-- Catches: an update that tells the PEO nothing changed, or one that puts the employer's answers (a pay frequency, a state, a salary, a name) in the
-- email or in the body every member of the firm reads.
DO $$
DECLARE r jsonb; m public.quote_request_messages;
BEGIN
  r := pg_temp.update('reyes', 'TriNet');
  SELECT * INTO m FROM public.quote_request_messages WHERE id = (r ->> 'message_id')::bigint;
  PERFORM pg_temp.is(m.body_text,
    E'Dana, the employer certified again.\n\n'
    || E'Changed since version 1: States of operation, Pay frequency.\n'
    || 'Census: 2 added, 1 removed, 1 changed.', 'the note, then what changed');
  PERFORM pg_temp.is(m.body_text ~ '(weekly|\mTX\M|64000|81000|\mDi\M|\mEd\M|\mCy\M)', false, 'and no answer''s value');
END $$;

-- ---------- 3. A PEO that already holds the latest certified version has no update to send ----------
-- Catches: the same version mailed to a PEO twice as an "update", with a summary of changes that did not happen and its live link revoked for nothing.
DO $$
DECLARE before integer := (SELECT count(*) FROM public.quote_request_messages);
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.send_peo_update(%L, 'Insperity', ARRAY['dana@insperity.example'], 'S', 'N')$s$, pg_temp.id('reyes'))),
    'PT409: Insperity already has version 2, the latest certified.', 'the latest version, already sent');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.quote_request_messages), before, 'and nothing is recorded');
END $$;

-- ---------- 4. A PEO never sent to has no update: its first send is a send ----------
-- Catches: an "update" that opens a new thread for a PEO that never had the bundle, telling it what changed since a version it never saw.
DO $$
BEGIN
  PERFORM pg_temp.authorize('reyes', 'Oasis', true);
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.send_peo_update(%L, 'Oasis', ARRAY['ola@oasis.example'], 'S', 'N')$s$, pg_temp.id('reyes'))),
    'PT409: Nothing was sent to Oasis yet, so there is no update. Send it the bundle.', 'never sent to');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.quote_requests WHERE peo_name = 'Oasis'), 0, 'and no quote request is made');
END $$;

-- ---------- 5. Only a PEO still open on the submission gets an update: one that declined, or whose quote request is closed, does not ----------
-- Catches: an update to a PEO that declined or was withdrawn, which reopens nothing and says what changed to a PEO no longer quoting. The queue counts
-- only open quote requests (sent or quoted) as holding an older version, and so does this.
DO $$
DECLARE qid bigint;
BEGIN
  qid := (pg_temp.sent('reyes', 'Oasis') ->> 'quote_request_id')::bigint;
  UPDATE public.quote_requests SET sent_version = 1, status = 'declined' WHERE id = qid;
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.send_peo_update(%L, 'Oasis', ARRAY['ola@oasis.example'], 'S', 'N')$s$, pg_temp.id('reyes'))),
    'PT409: Oasis declined, so there is no update to send. Send it the bundle to ask again.', 'declined');
  PERFORM pg_temp.as_owner();
  UPDATE public.quote_requests SET status = 'closed' WHERE id = qid;
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($s$SELECT public.send_peo_update(%L, 'Oasis', ARRAY['ola@oasis.example'], 'S', 'N')$s$, pg_temp.id('reyes'))),
    'PT409: Oasis''s quote request is closed, so there is no update to send. Send it the bundle to reopen it.', 'closed');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 6. The new version's link revokes the old one as newer_version; another link for the same version still replaces it ----------
-- Catches: a PEO left with a live link to the version it should no longer quote on, or a revoke that the change log can't tell from a re-issue.
DO $$
DECLARE qid bigint := (SELECT id FROM public.quote_requests WHERE peo_name = 'TriNet'); old_link bigint; l jsonb; l2 jsonb;
BEGIN
  SELECT id INTO old_link FROM public.bundle_links WHERE quote_request_id = qid AND revoked_at IS NULL;
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  l := public.issue_bundle_link(qid, 2, gen_random_uuid(), '[{"name": "packet.pdf", "what": "The packet"}]'::jsonb, '[]'::jsonb);
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT revoked_reason FROM public.bundle_links WHERE id = old_link), 'newer_version', 'the version 1 link is revoked as newer_version');
  PERFORM pg_temp.is((SELECT version FROM public.bundle_links WHERE quote_request_id = qid AND revoked_at IS NULL), 2, 'the live link is version 2''s');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  l2 := public.issue_bundle_link(qid, 2, gen_random_uuid(), '[{"name": "packet.pdf", "what": "The packet"}]'::jsonb, '[]'::jsonb);
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT revoked_reason FROM public.bundle_links WHERE id = (l ->> 'id')::bigint), 'replaced', 'a second link for version 2 replaces the first');
END $$;

-- ---------- 7. The queue's "older version sent" clears once every PEO holding an older version has the newer one ----------
-- Catches: an update that leaves the queue saying a PEO has an older version, or a flag that clears when only one of two PEOs was updated.
CREATE FUNCTION pg_temp.older(intake text) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE r boolean;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  SELECT l.sent_older_version INTO r FROM public.advisor_list_submissions(NULL, NULL, NULL, 0, NULL, NULL, NULL) l WHERE l.session_id = pg_temp.id(intake);
  PERFORM pg_temp.as_owner();
  RETURN r;
END $$;

DO $$
BEGIN
  PERFORM pg_temp.intake('bay', 'acme', 'Bay Cafe');
  PERFORM pg_temp.certify('bay', 1, 'EAA-2026-0050');
  PERFORM pg_temp.authorize('bay', 'Insperity', true);
  PERFORM pg_temp.authorize('bay', 'TriNet', true);
  PERFORM pg_temp.sent('bay', 'Insperity');
  PERFORM pg_temp.sent('bay', 'TriNet');
  PERFORM pg_temp.is(pg_temp.older('bay'), false, 'both PEOs hold the latest');
  PERFORM pg_temp.certify('bay', 2, 'EAA-2026-0050');
  PERFORM pg_temp.is(pg_temp.older('bay'), true, 'certified again: both hold an older version');
  PERFORM pg_temp.update('bay', 'Insperity');
  PERFORM pg_temp.is(pg_temp.older('bay'), true, 'one updated, TriNet still holds version 1');
  PERFORM pg_temp.update('bay', 'TriNet');
  PERFORM pg_temp.is(pg_temp.older('bay'), false, 'every PEO has version 2: the flag clears');
END $$;

-- ---------- 8. A quote request that was quoted stays quoted, and its quote is marked as given on the older version ----------
-- Catches: an update that throws away the PEO's quote (back to sent), or that lets the quote read as given on the version just sent.
CREATE FUNCTION pg_temp.quote(intake text, peo text, received date, fee numeric, note text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.advisor_update_quote_request(
    (SELECT id FROM public.quote_requests WHERE session_id = pg_temp.id(intake) AND peo_name = peo), 'quoted', received, received + 30, NULL, fee, note);
  PERFORM pg_temp.as_owner();
END $$;

DO $$
DECLARE q public.quote_requests;
BEGIN
  PERFORM pg_temp.intake('cove', 'acme', 'Cove Dental');
  PERFORM pg_temp.certify('cove', 1, 'EAA-2026-0060');
  PERFORM pg_temp.authorize('cove', 'Insperity', true);
  PERFORM pg_temp.sent('cove', 'Insperity');
  PERFORM pg_temp.quote('cove', 'Insperity', DATE '2026-11-10', 120);
  PERFORM pg_temp.is((SELECT quoted_version FROM public.quote_requests WHERE session_id = pg_temp.id('cove')), 1, 'the quote is given on version 1');
  PERFORM pg_temp.certify('cove', 2, 'EAA-2026-0060');
  PERFORM pg_temp.update('cove', 'Insperity');
  SELECT * INTO q FROM public.quote_requests WHERE session_id = pg_temp.id('cove');
  PERFORM pg_temp.is(q.status, 'quoted', 'still quoted after the update');
  PERFORM pg_temp.is(q.admin_fee_pepm, 120::numeric, 'with its quote');
  PERFORM pg_temp.is(q.sent_version, 2, 'version 2 sent');
  PERFORM pg_temp.is(q.quoted_version, 1, 'and the quote marked as given on version 1');
END $$;

-- ---------- 9. Until the advisor records a new answer: a new quote marks it given on the version sent; a note alone does not ----------
-- Catches: a quote stuck on the older version after the PEO answered the newer one, or one that reads as answering the newer version because the
-- advisor only corrected its note.
DO $$
BEGIN
  PERFORM pg_temp.quote('cove', 'Insperity', DATE '2026-11-10', 120, 'Waiting on their medical rates.');
  PERFORM pg_temp.is((SELECT quoted_version FROM public.quote_requests WHERE session_id = pg_temp.id('cove')), 1, 'a note alone: still version 1''s quote');
  PERFORM pg_temp.quote('cove', 'Insperity', DATE '2026-11-20', 118);
  PERFORM pg_temp.is((SELECT quoted_version FROM public.quote_requests WHERE session_id = pg_temp.id('cove')), 2, 'a new answer: given on version 2');
END $$;

-- ---------- 10. An update is refused as a send is (M-2.1): the employer's authorization, a closing firm, a support session, the mailbox ----------
-- Catches: an update that skips a check a first send makes, so a PEO the employer withdrew gets the newer version, a firm in its read-only 30 days or
-- Nevermore support mails a PEO, another firm's member updates this firm's PEO, or a message is recorded with no mailbox to send it from.
CREATE FUNCTION pg_temp.refused_update(intake text, peo text, who text, addr text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  PERFORM pg_temp.as_user(who, addr);
  r := pg_temp.refusal(format($s$SELECT public.send_peo_update(%L, %L, ARRAY['dana@insperity.example'], 'S', 'N')$s$, pg_temp.id(intake), peo));
  PERFORM pg_temp.as_owner();
  RETURN r;
END $$;

DO $$
DECLARE before integer;
BEGIN
  PERFORM pg_temp.intake('dune', 'acme', 'Dune Surf');
  PERFORM pg_temp.certify('dune', 1, 'EAA-2026-0070');
  PERFORM pg_temp.authorize('dune', 'Insperity', true);
  PERFORM pg_temp.sent('dune', 'Insperity');
  PERFORM pg_temp.certify('dune', 2, 'EAA-2026-0070');
  before := (SELECT count(*) FROM public.quote_request_messages);
  -- Nevermore support, looking at Acme.
  PERFORM pg_temp.new_user('platform_admin');
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('platform_admin'), 'admin');
  INSERT INTO public.support_sessions (firm_id, admin_id, admin_email, reason, started_at, ends_at)
  VALUES (pg_temp.id('acme'), pg_temp.id('platform_admin'), 'platform_admin@example.test', 'Looking at a stuck email', now(), now() + interval '1 hour');
  PERFORM pg_temp.is(pg_temp.refused_update('dune', 'Insperity', 'platform_admin', 'acme-brokers'), 'PT423: Nevermore support can look, not change', 'a support session');
  -- The guard comes before anything is read: support is told it can't change, not whether the PEO has an update.
  PERFORM pg_temp.is(pg_temp.refused_update('reyes', 'Insperity', 'platform_admin', 'acme-brokers'), 'PT423: Nevermore support can look, not change',
    'a support session, on a PEO with no update');
  DELETE FROM public.support_sessions WHERE firm_id = pg_temp.id('acme');
  -- Acme closing.
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (pg_temp.id('acme'), pg_temp.id('acme_agent'), now() + interval '30 days');
  PERFORM pg_temp.is(split_part(pg_temp.refused_update('dune', 'Insperity', 'acme_agent', 'acme-brokers'), ':', 1), 'PT423', 'a closing firm');
  DELETE FROM public.firm_closures WHERE firm_id = pg_temp.id('acme');
  -- Another firm's member, and the prospect.
  PERFORM pg_temp.is(pg_temp.refused_update('dune', 'Insperity', 'zenith_agent', 'zenith-benefits'), 'PT404: Submission not found', 'another firm''s intake');
  PERFORM pg_temp.is(split_part(pg_temp.refused_update('dune', 'Insperity', 'p_dune', NULL), ':', 1), '42501', 'the prospect');
  -- No connected mailbox.
  PERFORM pg_temp.is(pg_temp.refused_update('dune', 'Insperity', 'acme_agent2', 'acme-brokers'), 'PT412: Connect your mailbox to send from here.', 'no mailbox');
  -- The prospect changed an answer since certifying version 2.
  PERFORM pg_temp.answer_changed('dune');
  PERFORM pg_temp.is(pg_temp.refused_update('dune', 'Insperity', 'acme_agent', 'acme-brokers'),
    '22023: The prospect changed an answer since certifying. Sending waits until they certify again.', 'answers changed since certifying');
  -- The employer withdrew Insperity.
  PERFORM pg_temp.certify('dune', 3, 'EAA-2026-0070');
  PERFORM pg_temp.authorize('dune', 'Insperity', false);
  PERFORM pg_temp.is(pg_temp.refused_update('dune', 'Insperity', 'acme_agent', 'acme-brokers'),
    '22023: The employer withdrew Insperity. Nothing more can be sent to it.', 'the employer withdrew the PEO');
  PERFORM pg_temp.is((SELECT count(*)::integer FROM public.quote_request_messages), before, 'and nothing is recorded');
  PERFORM pg_temp.is((SELECT sent_version FROM public.quote_requests WHERE session_id = pg_temp.id('dune')), 1, 'nor the version sent moved');
END $$;

SELECT 'peo_update: all passed';
