-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh bundle_links
-- The bundle link a PEO opens (M-2.1, slice 6.6b; ADR 0003; docs/BROKER_CRM_BUILD.md D-609, D-640 to D-649; 20261122110000_bundle_links.sql).
-- Issuing a link (issue_bundle_link), revoking one (bundle_link_revoke, revoke_bundle_link), and what the edge function asks as the service role
-- to open one and to download a file from it (bundle_link_open, bundle_link_file), with the guessing limit. Two firms. Every migration is loaded,
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
\i supabase/migrations/20261123110000_firm_link.sql
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

-- The hash the edge function sends for a token or an address: SHA-256 of its text, in hex.
CREATE FUNCTION pg_temp.h(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT encode(extensions.digest(t, 'sha256'), 'hex') $$;

-- The employer's say over a PEO (M-1.1, slice 6.6a's peo_authorizations), recorded as the superuser: an appended row, authorized or withdrawn.
CREATE FUNCTION pg_temp.authorize(intake text, peo text, yes boolean) RETURNS void LANGUAGE plpgsql AS $$
DECLARE pid bigint;
BEGIN
  SELECT p.id INTO pid FROM public.peos p WHERE lower(p.name) = lower(peo);
  IF pid IS NULL THEN INSERT INTO public.peos (name) VALUES (peo) RETURNING id INTO pid; END IF;
  INSERT INTO public.peo_authorizations (session_id, peo_id, peo_name, authorized, wording_version, wording_text, signed_by)
  SELECT s.id, pid, peo, yes, 'draft-1', 'I authorize this PEO to receive my packet.', s.user_id FROM public.chamber_sessions s WHERE s.id = pg_temp.id(intake);
END $$;

-- ---------- set up: two firms, a member of each, an intake of each certified once, a quote request on each ----------
CREATE FUNCTION pg_temp.intake(n text, firm text, company text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := pg_temp.new_user('p_' || n); sid uuid;
BEGIN
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, jsonb_build_object('company_name', company)) RETURNING id INTO sid;
  UPDATE public.chamber_sessions SET firm_id = pg_temp.id(firm) WHERE id = sid;
  -- Every submission sits on an opportunity of an account (CRM-Q1.1).
  WITH a AS (INSERT INTO public.accounts (source, firm_id, name) VALUES ('added_by_hand', pg_temp.id(firm), company) RETURNING id, firm_id)
  INSERT INTO public.opportunities (firm_id, account_id, name, intake_id) SELECT a.firm_id, a.id, company || ' – PEO search', sid FROM a;
  INSERT INTO fx VALUES (n, sid);
  RETURN sid;
END $$;

-- A certification of an intake, as the superuser with its triggers off: version v, the company name as certified.
CREATE FUNCTION pg_temp.certify(n text, v integer, company text, p_file_id text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);
  INSERT INTO public.chamber_certifications (session_id, user_id, signer_name, signer_title, consent_version, consent_text, signed_at, data_sha256, file_id, version, chamber_data)
  SELECT s.id, s.user_id, 'Lucia Reyes', 'Owner', 'v1', 'I certify.', now(), 'h' || v, p_file_id, v, jsonb_build_object('company_name', company)
  FROM public.chamber_sessions s WHERE s.id = pg_temp.id(n);
  PERFORM set_config('session_replication_role', 'origin', true);
END $$;

-- A quote request, as the superuser. Its id is kept in qr.
CREATE TEMP TABLE qr (name text PRIMARY KEY, id bigint NOT NULL);
GRANT SELECT ON qr TO anon, authenticated, service_role;
CREATE FUNCTION pg_temp.qr(n text) RETURNS bigint LANGUAGE sql STABLE AS $$ SELECT id FROM qr WHERE name = n $$;
CREATE FUNCTION pg_temp.quote_request(n text, intake text, peo text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE r bigint;
BEGIN
  PERFORM pg_temp.authorize(intake, peo, true);
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_version) VALUES (pg_temp.id(intake), peo, 'sent', 1) RETURNING id INTO r;
  INSERT INTO qr VALUES (n, r);
  RETURN r;
END $$;

DO $$
DECLARE acme uuid; zenith uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Acme Brokers', 'acme-brokers', now()) RETURNING id INTO acme;
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Zenith Benefits', 'zenith-benefits', now()) RETURNING id INTO zenith;
  INSERT INTO fx VALUES ('acme', acme), ('zenith', zenith);
  PERFORM pg_temp.new_user('acme_agent'); PERFORM pg_temp.new_user('zenith_agent');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (acme, pg_temp.id('acme_agent'), 'agent'), (zenith, pg_temp.id('zenith_agent'), 'agent');
  PERFORM pg_temp.intake('reyes', 'acme', 'Reyes Bakery');
  PERFORM pg_temp.certify('reyes', 1, 'Reyes Bakery LLC', 'EAA-2026-0042');
  PERFORM pg_temp.quote_request('reyes_insperity', 'reyes', 'Insperity');
  PERFORM pg_temp.intake('zed', 'zenith', 'Zed Tools');
  PERFORM pg_temp.certify('zed', 1, 'Zed Tools Inc', 'EAA-2026-0043');
  PERFORM pg_temp.quote_request('zed_justworks', 'zed', 'Justworks');
END $$;

-- The two files every test link carries: the packet and the answers as JSON, both made files stored under the link's folder.
CREATE FUNCTION pg_temp.files() RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT '[{"name": "EAA-2026-0042-packet-v1.pdf", "what": "The packet"}, {"name": "EAA-2026-0042-answers-v1.json", "what": "The answers as JSON"}]'::jsonb
$$;

-- ---------- 1. An advisor issues a link: its id, a token of at least 244 random bits, when it stops working, the version ----------
-- Catches: a token too short to be unguessable, or an answer missing what the advisor's send needs.
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  r := public.issue_bundle_link(pg_temp.qr('reyes_insperity'), 1, gen_random_uuid(), pg_temp.files());
  PERFORM pg_temp.is((r ->> 'token') ~ '^[A-Za-z0-9_-]{43}$', true, 'the token is 43 base64url characters (256 bits)');
  PERFORM pg_temp.is((r ->> 'version')::int, 1, 'the version linked');
  PERFORM pg_temp.is((r ->> 'id') IS NOT NULL AND (r ->> 'expires_at') IS NOT NULL, true, 'its id and when it stops working');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 2. Only the token's hash is kept, and the link stops working 30 days after it is issued ----------
-- Catches: the token kept as it is (a database reader could open every link), or an expiry other than 30 days.
DO $$
DECLARE r jsonb; row jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  r := public.issue_bundle_link(pg_temp.qr('reyes_insperity'), 1, gen_random_uuid(), pg_temp.files());
  PERFORM pg_temp.as_owner();
  SELECT to_jsonb(b) INTO row FROM public.bundle_links b WHERE b.id = (r ->> 'id')::bigint;
  PERFORM pg_temp.is(row ->> 'token_hash', pg_temp.h(r ->> 'token'), 'the row keeps the token''s SHA-256');
  PERFORM pg_temp.is(position(r ->> 'token' IN row::text), 0, 'and nowhere the token itself');
  PERFORM pg_temp.is((row ->> 'expires_at')::timestamptz - (row ->> 'issued_at')::timestamptz, interval '30 days', '30 days after it is issued');
END $$;

-- ---------- 3. One live link per quote request: issuing again revokes the one before as replaced ----------
-- Catches: two live links to one PEO, so an older bundle stays downloadable after a new one is sent.
DO $$
DECLARE a jsonb; b jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  a := public.issue_bundle_link(pg_temp.qr('reyes_insperity'), 1, gen_random_uuid(), pg_temp.files());
  b := public.issue_bundle_link(pg_temp.qr('reyes_insperity'), 1, gen_random_uuid(), pg_temp.files());
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT revoked_reason FROM public.bundle_links WHERE id = (a ->> 'id')::bigint), 'replaced', 'the earlier link is revoked as replaced');
  PERFORM pg_temp.is((SELECT revoked_at IS NULL FROM public.bundle_links WHERE id = (b ->> 'id')::bigint), true, 'the new one is live');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.bundle_links WHERE quote_request_id = pg_temp.qr('reyes_insperity') AND revoked_at IS NULL), 1, 'one live link');
END $$;

-- ---------- 4. Another firm's quote request: not found, and no link made ----------
-- Catches: a member of one firm issuing a link to another firm's employer's bundle.
DO $$
DECLARE before int := (SELECT count(*) FROM public.bundle_links);
BEGIN
  PERFORM pg_temp.as_user('zenith_agent', 'zenith-benefits');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.issue_bundle_link(%s, 1, gen_random_uuid(), pg_temp.files())$q$, pg_temp.qr('reyes_insperity'))), ':', 1),
                     'PT404', 'another firm''s quote request');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.issue_bundle_link(%s, 1, gen_random_uuid(), pg_temp.files())$q$, pg_temp.qr('reyes_insperity'))), ':', 1),
                     '42501', 'a guest');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.bundle_links), before, 'no link was made');
END $$;

-- ---------- 5. A closed quote request gets no link ----------
-- Catches: a withdrawn PEO (M-2.4) sent a fresh link to the bundle.
DO $$
DECLARE c bigint;
BEGIN
  c := pg_temp.quote_request('reyes_closed', 'reyes', 'TriNet');
  UPDATE public.quote_requests SET status = 'closed' WHERE id = c;
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.issue_bundle_link(%s, 1, gen_random_uuid(), pg_temp.files())$q$, c)), ':', 1),
                     '22023', 'a closed quote request');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.bundle_links WHERE quote_request_id = c), 0, 'no link was made');
END $$;

-- ---------- 6. A version never certified gets no link ----------
-- Catches: a link to answers the employer never signed (version 2 of an intake certified once), or to no version.
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.issue_bundle_link(%s, 2, gen_random_uuid(), pg_temp.files())$q$, pg_temp.qr('reyes_insperity'))), ':', 1),
                     '22023', 'version 2, never certified');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.issue_bundle_link(%s, NULL, gen_random_uuid(), pg_temp.files())$q$, pg_temp.qr('reyes_insperity'))), ':', 1),
                     '22023', 'no version');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 7. A closing firm issues no link (ADR 0023) ----------
-- Catches: issuing that skips assert_firm_writable, so a firm in its read-only 30 days still sends an employer's bundle out.
DO $$
DECLARE omega uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Omega Partners', 'omega-partners', now()) RETURNING id INTO omega;
  INSERT INTO fx VALUES ('omega', omega);
  PERFORM pg_temp.new_user('omega_owner');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (omega, pg_temp.id('omega_owner'), 'owner');
  PERFORM pg_temp.intake('omicron', 'omega', 'Omicron Labs');
  PERFORM pg_temp.certify('omicron', 1, 'Omicron Labs', 'EAA-2026-0044');
  PERFORM pg_temp.quote_request('omicron_tri', 'omicron', 'TriNet');
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (omega, pg_temp.id('omega_owner'), now() + interval '30 days');
  PERFORM pg_temp.as_user('omega_owner', 'omega-partners');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.issue_bundle_link(%s, 1, gen_random_uuid(), pg_temp.files())$q$, pg_temp.qr('omicron_tri'))), ':', 1),
                     'PT423', 'a closing firm');
  PERFORM pg_temp.as_owner();
END $$;

-- A quote request recorded before M-1.1 shipped, for a PEO the employer never authorized (M-1.1: it stays open; nothing more is sent).
CREATE FUNCTION pg_temp.quote_request_unauthorized(n text, intake text, peo text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE r bigint;
BEGIN
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_version) VALUES (pg_temp.id(intake), peo, 'sent', 1) RETURNING id INTO r;
  INSERT INTO qr VALUES (n, r);
  RETURN r;
END $$;
-- ---------- 8. A PEO the employer has not authorized gets no link (M-1.1, ADR 0003) ----------
-- Catches: a link issued to a PEO the employer never chose, or withdrew.
DO $$
DECLARE c bigint := pg_temp.quote_request('reyes_adp', 'reyes', 'ADP TotalSource'); never bigint := pg_temp.quote_request_unauthorized('reyes_never', 'reyes', 'Oasis Advantage');
BEGIN
  PERFORM pg_temp.authorize('reyes', 'ADP TotalSource', false);
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  -- assert_peo_authorized's own refusal (slice 6.6a), as a send's: 22023 with the employer's words.
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.issue_bundle_link(%s, 1, gen_random_uuid(), pg_temp.files())$q$, c)),
                     '22023: The employer withdrew ADP TotalSource. Nothing more can be sent to it.', 'a PEO the employer withdrew');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.issue_bundle_link(%s, 1, gen_random_uuid(), pg_temp.files())$q$, never)),
                     '22023: The employer hasn''t authorized Oasis Advantage to receive their packet. Ask them to add it.', 'a PEO the employer never authorized');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.bundle_links WHERE quote_request_id = c), 0, 'no link was made');
END $$;

-- ---------- 9. A link names only documents of its own intake that passed their scan ----------
-- Catches: a link that serves another employer's document, or a file still unscanned or found infected.
CREATE FUNCTION pg_temp.document(n text, intake text, verdict text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r uuid;
BEGIN
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, scan_verdict)
  SELECT s.user_id, s.id, n || '.pdf', '1 KB', s.user_id || '/' || s.id || '/' || n || '.pdf', verdict FROM public.chamber_sessions s WHERE s.id = pg_temp.id(intake)
  RETURNING id INTO r;
  INSERT INTO fx VALUES (n, r);
  RETURN r;
END $$;
DO $$
DECLARE c record;
BEGIN
  PERFORM pg_temp.document('reyes_loss_runs', 'reyes', 'clean');
  PERFORM pg_temp.document('reyes_unscanned', 'reyes', 'pending');
  PERFORM pg_temp.document('zed_payroll', 'zed', 'clean');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.issue_bundle_link(%s, 1, gen_random_uuid(), pg_temp.files() || jsonb_build_array(jsonb_build_object('name', 'loss-runs.pdf', 'what', 'Loss runs', 'document_id', %L)))$q$,
                     pg_temp.qr('reyes_insperity'), pg_temp.id('reyes_loss_runs'))), 'ok', 'a clean document of its own intake');
  FOR c IN SELECT * FROM (VALUES ('zed_payroll', 'another intake''s document'), ('reyes_unscanned', 'a document not yet scanned clean')) AS v (doc, why) LOOP
    PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.issue_bundle_link(%s, 1, gen_random_uuid(), pg_temp.files() || jsonb_build_array(jsonb_build_object('name', 'x.pdf', 'what', 'X', 'document_id', %L)))$q$,
                       pg_temp.qr('reyes_insperity'), pg_temp.id(c.doc))), ':', 1), '22023', c.why);
  END LOOP;
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 10. What a link's list of files must be ----------
-- Catches: a name that climbs out of the link's folder in storage (a slash), a link with nothing to download, a file with no name or no
-- description, or open items that are not a list.
DO $$
DECLARE c record;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  FOR c IN SELECT * FROM (VALUES
    ($j$[{"name": "..\/other\/x.pdf", "what": "X"}]$j$, '[]', 'a name with a slash'),
    ($j$[]$j$, '[]', 'no files'),
    ($j${"name": "x.pdf", "what": "X"}$j$, '[]', 'not a list'),
    ($j$[{"name": "", "what": "X"}]$j$, '[]', 'an empty name'),
    ($j$[{"name": "x.pdf"}]$j$, '[]', 'no description'),
    ($j$[{"name": "x.pdf", "what": "X"}]$j$, '{"a": 1}', 'open items not a list')
  ) AS v (files, items, why) LOOP
    PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.issue_bundle_link(%s, 1, gen_random_uuid(), %L::jsonb, %L::jsonb)$q$, pg_temp.qr('reyes_insperity'), c.files, c.items)), ':', 1),
                       '22023', c.why);
  END LOOP;
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 11. Issuing is on the quote request's timeline, with who, and the link it replaced too ----------
-- Catches: a link issued (or one silently replaced) with no trace on the timeline the advisors read.
DO $$
DECLARE c bigint := pg_temp.quote_request('reyes_justworks', 'reyes', 'Justworks'); r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.issue_bundle_link(c, 1, gen_random_uuid(), pg_temp.files());
  r := public.issue_bundle_link(c, 1, gen_random_uuid(), pg_temp.files());
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT string_agg(e.new_value, ' | ' ORDER BY e.id) FROM public.quote_request_events e WHERE e.quote_request_id = c AND e.field = 'bundle_link'),
                     'Issued for version 1 | Revoked: replaced | Issued for version 1', 'issued, replaced, issued');
  PERFORM pg_temp.is((SELECT bool_and(e.changed_by = pg_temp.id('acme_agent')) FROM public.quote_request_events e WHERE e.quote_request_id = c AND e.field = 'bundle_link'),
                     true, 'each by the advisor');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.quote_request_events e WHERE e.quote_request_id = c AND position(r ->> 'token' IN e::text) > 0), 0, 'never the token');
END $$;

-- ---------- 12. bundle_link_revoke: what M-1.1, M-2.3 and M-2.4 call; no API role can ----------
-- Catches: a PEO's link left live after the employer withdraws it, a newer version is sent or the request is withdrawn; or a caller from outside
-- the database revoking (or probing) any firm's links.
DO $$
DECLARE c bigint := pg_temp.quote_request('reyes_paychex', 'reyes', 'Paychex'); r text;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.issue_bundle_link(c, 1, gen_random_uuid(), pg_temp.files());
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(public.bundle_link_revoke(c, 'authorization_withdrawn'), 1, 'the live link is revoked');
  PERFORM pg_temp.is((SELECT revoked_reason FROM public.bundle_links WHERE quote_request_id = c), 'authorization_withdrawn', 'with its reason');
  PERFORM pg_temp.is(public.bundle_link_revoke(c, 'withdrawn'), 0, 'again: none was live');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.bundle_link_revoke(%s, 'because')$q$, c)), ':', 1), '22023', 'a reason not on the list');
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    PERFORM pg_temp.is(has_function_privilege(r, 'public.bundle_link_revoke(bigint, text)', 'EXECUTE'), false, r || ' can''t call it');
  END LOOP;
END $$;

-- ---------- 13. revoke_bundle_link: an advisor stops their own firm's link ----------
-- Catches: an advisor who can't take back a link sent to the wrong address, another firm's member revoking it, or a closing firm changing it.
DO $$
DECLARE c bigint := pg_temp.quote_request('reyes_vensure', 'reyes', 'Vensure');
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM public.issue_bundle_link(c, 1, gen_random_uuid(), pg_temp.files());
  PERFORM pg_temp.as_user('zenith_agent', 'zenith-benefits');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.revoke_bundle_link(%s)$q$, c)), ':', 1), 'PT404', 'another firm''s member');
  PERFORM pg_temp.as_user('omega_owner', 'omega-partners');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.revoke_bundle_link(%s)$q$, pg_temp.qr('omicron_tri'))), ':', 1), 'PT423', 'a closing firm');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(public.revoke_bundle_link(c), 1, 'the advisor revokes it');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT revoked_reason FROM public.bundle_links WHERE quote_request_id = c), 'revoked_by_advisor', 'as revoked by the advisor');
  PERFORM pg_temp.is((SELECT changed_by FROM public.quote_request_events WHERE quote_request_id = c AND new_value = 'Revoked: revoked_by_advisor'), pg_temp.id('acme_agent'), 'on the timeline, by them');
END $$;

-- ---------- 14. Opening a live link (the edge function, as the service role) ----------
-- Catches: a page that names the employer as they are now rather than as certified, misses a file or the open items, or hands the browser the
-- intake's id or a storage path.
CREATE TEMP TABLE tok (name text PRIMARY KEY, token text NOT NULL);
GRANT SELECT ON tok TO anon, authenticated, service_role;
DO $$
DECLARE r jsonb; folder uuid := gen_random_uuid(); o jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  r := public.issue_bundle_link(pg_temp.qr('reyes_insperity'), 1, folder, pg_temp.files(), '["Loss runs for 2023", "A signed census"]'::jsonb);
  PERFORM pg_temp.as_owner();
  INSERT INTO tok VALUES ('reyes', r ->> 'token');
  PERFORM pg_temp.as_service();
  o := public.bundle_link_open(pg_temp.h(r ->> 'token'), pg_temp.h('203.0.113.7'));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(o ->> 'state', 'open', 'a live link opens');
  PERFORM pg_temp.is(o ->> 'company_name', 'Reyes Bakery LLC', 'the employer as certified');
  PERFORM pg_temp.is(o ->> 'file_id', 'EAA-2026-0042', 'the File ID');
  PERFORM pg_temp.is((o ->> 'version')::int, 1, 'the version');
  PERFORM pg_temp.is(o ->> 'peo', 'Insperity', 'the PEO');
  PERFORM pg_temp.is((o ->> 'expires_at')::timestamptz, (r ->> 'expires_at')::timestamptz, 'the day it stops working');
  PERFORM pg_temp.is(o -> 'files', '[{"n": 1, "name": "EAA-2026-0042-packet-v1.pdf", "what": "The packet"}, {"n": 2, "name": "EAA-2026-0042-answers-v1.json", "what": "The answers as JSON"}]'::jsonb, 'each file, numbered');
  PERFORM pg_temp.is(o -> 'open_items', '["Loss runs for 2023", "A signed census"]'::jsonb, 'the open items stored with the link');
  PERFORM pg_temp.is(position(pg_temp.id('reyes')::text IN o::text) + position(folder::text IN o::text), 0, 'neither the intake''s id nor the storage folder');
  PERFORM pg_temp.is(has_function_privilege('anon', 'public.bundle_link_open(text, text)', 'EXECUTE') OR has_function_privilege('authenticated', 'public.bundle_link_open(text, text)', 'EXECUTE'),
                     false, 'only the service role asks');
END $$;

-- ---------- 15. An expired, revoked or unknown link is gone, and says nothing more ----------
-- Catches: a link that still opens after 30 days or after it was revoked, or a "gone" answer that names the employer (so a guess learns whose
-- link it was).
DO $$
DECLARE c bigint := pg_temp.quote_request('reyes_old', 'reyes', 'Oasis'); old jsonb; revoked jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  old := public.issue_bundle_link(c, 1, gen_random_uuid(), pg_temp.files());
  PERFORM pg_temp.as_owner();
  UPDATE public.bundle_links SET issued_at = now() - interval '31 days', expires_at = now() - interval '1 day' WHERE id = (old ->> 'id')::bigint;
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  revoked := public.issue_bundle_link(pg_temp.qr('reyes_justworks'), 1, gen_random_uuid(), pg_temp.files());
  PERFORM public.revoke_bundle_link(pg_temp.qr('reyes_justworks'));
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(public.bundle_link_open(pg_temp.h(old ->> 'token'), pg_temp.h('198.51.100.1')), '{"state": "gone"}'::jsonb, 'expired');
  PERFORM pg_temp.is(public.bundle_link_open(pg_temp.h(revoked ->> 'token'), pg_temp.h('198.51.100.1')), '{"state": "gone"}'::jsonb, 'revoked');
  PERFORM pg_temp.is(public.bundle_link_open(pg_temp.h('no-such-token'), pg_temp.h('198.51.100.1')), '{"state": "gone"}'::jsonb, 'unknown');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 16. A live link of a PEO the employer no longer authorizes is gone (peo_authorized, M-1.1) ----------
-- Catches: a link that keeps serving the bundle in the moment between the employer withdrawing the PEO and the revoke reaching it.
DO $$
BEGIN
  PERFORM pg_temp.authorize('reyes', 'Insperity', false);
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(public.bundle_link_open(pg_temp.h((SELECT token FROM tok WHERE name = 'reyes')), pg_temp.h('203.0.113.7')), '{"state": "gone"}'::jsonb, 'withdrawn');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.authorize('reyes', 'Insperity', true);
END $$;

-- ---------- 17. Guessing: 20 misses in an hour from one address, then that address is refused for the hour ----------
-- Catches: an address that can try tokens without end, a limit shared by every address (one guesser locking out every PEO), or a PEO who opens
-- their own live link often being locked out by it.
DO $$
DECLARE live text := pg_temp.h((SELECT token FROM tok WHERE name = 'reyes')); i int;
BEGIN
  PERFORM pg_temp.as_service();
  FOR i IN 1..20 LOOP
    PERFORM pg_temp.is(public.bundle_link_open(pg_temp.h('guess-' || i), pg_temp.h('192.0.2.66')) ->> 'state', 'gone', 'miss ' || i);
  END LOOP;
  PERFORM pg_temp.is(public.bundle_link_open(live, pg_temp.h('192.0.2.66')) ->> 'state', 'refused', 'after 20 misses the address is refused, even a live link');
  PERFORM pg_temp.is(public.bundle_link_open(live, pg_temp.h('192.0.2.67')) ->> 'state', 'open', 'another address is not');
  FOR i IN 1..25 LOOP
    PERFORM public.bundle_link_open(live, pg_temp.h('192.0.2.68'));
  END LOOP;
  PERFORM pg_temp.is(public.bundle_link_open(live, pg_temp.h('192.0.2.68')) ->> 'state', 'open', 'a live link''s own use never counts');
  PERFORM pg_temp.as_owner();
  -- An hour later the misses no longer count.
  UPDATE public.bundle_link_misses SET missed_at = missed_at - interval '61 minutes' WHERE address_hash = pg_temp.h('192.0.2.66');
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(public.bundle_link_open(live, pg_temp.h('192.0.2.66')) ->> 'state', 'open', 'an hour later the address opens it again');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.bundle_link_misses WHERE position(pg_temp.h('guess-1') IN bundle_link_misses::text) > 0), 0, 'a miss keeps no token''s hash');
END $$;

-- ---------- 18. Downloading a made file: where the edge function finds it, and the download on the timeline ----------
-- Catches: a download that leaves no trace on the quote request's timeline, one recorded as some person's, or a file looked up anywhere but its
-- own link's folder.
DO $$
DECLARE c bigint := pg_temp.quote_request('reyes_trinet', 'reyes', 'Rippling PEO'); r jsonb; f jsonb; folder uuid := gen_random_uuid();
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  r := public.issue_bundle_link(c, 1, folder, pg_temp.files());
  PERFORM pg_temp.as_service();
  f := public.bundle_link_file(pg_temp.h(r ->> 'token'), 2, pg_temp.h('203.0.113.9'));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(f, jsonb_build_object('bucket', 'bundle-links', 'path', c || '/' || folder || '/2-EAA-2026-0042-answers-v1.json', 'name', 'EAA-2026-0042-answers-v1.json'), 'the second file, in the link''s folder');
  PERFORM pg_temp.is((SELECT e.new_value || ' by ' || COALESCE(e.changed_by::text, 'nobody') FROM public.quote_request_events e WHERE e.quote_request_id = c AND e.field = 'bundle_download'),
                     'The answers as JSON (EAA-2026-0042-answers-v1.json) by nobody', 'the download, on the timeline, no person');
  PERFORM pg_temp.is(has_function_privilege('anon', 'public.bundle_link_file(text, integer, text)', 'EXECUTE') OR has_function_privilege('authenticated', 'public.bundle_link_file(text, integer, text)', 'EXECUTE'),
                     false, 'only the service role asks');
END $$;

-- ---------- 19. Downloading a document: named, not copied, so it is found where the intake keeps it ----------
-- Catches: a document looked up in the link's folder, where it was never copied.
DO $$
DECLARE c bigint := pg_temp.quote_request('reyes_docs', 'reyes', 'Engage PEO'); r jsonb; f jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  r := public.issue_bundle_link(c, 1, gen_random_uuid(), pg_temp.files() || jsonb_build_array(jsonb_build_object('name', 'loss-runs.pdf', 'what', 'Loss runs', 'document_id', pg_temp.id('reyes_loss_runs'))));
  PERFORM pg_temp.as_service();
  f := public.bundle_link_file(pg_temp.h(r ->> 'token'), 3, pg_temp.h('203.0.113.9'));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(f, jsonb_build_object('bucket', 'documents', 'path', (SELECT storage_path FROM public.documents WHERE id = pg_temp.id('reyes_loss_runs')), 'name', 'loss-runs.pdf'),
                     'the document, where the intake keeps it');
END $$;

-- ---------- 20. A download from a link that does not open gives nothing and logs nothing ----------
-- Catches: a file still served from a revoked, expired or unknown link, for a PEO the employer withdrew, to an address over its limit, or for a
-- file number the link does not have; or a refused download recorded as if it happened.
DO $$
DECLARE live text := pg_temp.h((SELECT token FROM tok WHERE name = 'reyes')); c record; before int;
  expired text := (SELECT token_hash FROM public.bundle_links WHERE quote_request_id = pg_temp.qr('reyes_old'));
  revoked text := (SELECT token_hash FROM public.bundle_links WHERE quote_request_id = pg_temp.qr('reyes_vensure'));
BEGIN
  PERFORM pg_temp.as_owner();
  before := (SELECT count(*) FROM public.quote_request_events WHERE field = 'bundle_download');
  PERFORM pg_temp.as_service();
  FOR c IN SELECT * FROM (VALUES
    (pg_temp.h('no-such-token'), 1, '203.0.113.20', 'unknown'),
    (expired, 1, '203.0.113.20', 'expired'),
    (revoked, 1, '203.0.113.20', 'revoked'),
    (live, 3, '203.0.113.20', 'a file number the link does not have'),
    (live, 0, '203.0.113.20', 'file 0'),
    (live, 1, '192.0.2.99', 'an address over its limit')
  ) AS v (token_hash, n, address, why) LOOP
    IF c.address = '192.0.2.99' THEN
      PERFORM pg_temp.as_owner();
      INSERT INTO public.bundle_link_misses (address_hash) SELECT pg_temp.h('192.0.2.99') FROM generate_series(1, 20);
      PERFORM pg_temp.as_service();
    END IF;
    PERFORM pg_temp.is(public.bundle_link_file(c.token_hash, c.n, pg_temp.h(c.address)), NULL::jsonb, c.why);
  END LOOP;
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.authorize('reyes', 'Insperity', false);
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(public.bundle_link_file(live, 1, pg_temp.h('203.0.113.21')), NULL::jsonb, 'a PEO the employer withdrew');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.authorize('reyes', 'Insperity', true);
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.quote_request_events WHERE field = 'bundle_download'), before, 'none of them is on a timeline');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.bundle_link_misses WHERE address_hash = pg_temp.h('203.0.113.20')), 3, 'the unknown, expired and revoked tokens were misses');
END $$;

-- ---------- 21. A document that no longer passes its scan, or is gone, is not served ----------
-- Catches: a document found infected on a later scan still handed out by a link issued while it was clean; a deleted one logged as downloaded.
DO $$
DECLARE r text := (SELECT token_hash FROM public.bundle_links WHERE quote_request_id = pg_temp.qr('reyes_docs') AND revoked_at IS NULL); before int;
BEGIN
  UPDATE public.documents SET scan_verdict = 'infected' WHERE id = pg_temp.id('reyes_loss_runs');
  before := (SELECT count(*) FROM public.quote_request_events WHERE field = 'bundle_download');
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(public.bundle_link_file(r, 3, pg_temp.h('203.0.113.30')), NULL::jsonb, 'an infected document');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.quote_request_events WHERE field = 'bundle_download'), before, 'not logged');
  UPDATE public.documents SET scan_verdict = 'clean' WHERE id = pg_temp.id('reyes_loss_runs');
END $$;

-- ---------- 22. Both tables are closed to the API ----------
-- Catches: a token hash, a file list or a guesser's address hash readable or writable by a signed-in member, a guest, or the service role's
-- own table access (the function asks through the two functions above, nothing else).
DO $$
DECLARE r text; t text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    FOREACH t IN ARRAY ARRAY['public.bundle_links', 'public.bundle_link_misses'] LOOP
      PERFORM pg_temp.is(has_table_privilege(r, t, 'SELECT') OR has_table_privilege(r, t, 'INSERT') OR has_table_privilege(r, t, 'UPDATE') OR has_table_privilege(r, t, 'DELETE'),
                         false, r || ' on ' || t);
    END LOOP;
  END LOOP;
  PERFORM pg_temp.is((SELECT bool_and(c.relrowsecurity) FROM pg_class c WHERE c.oid IN ('public.bundle_links'::regclass, 'public.bundle_link_misses'::regclass)), true, 'row security on both');
END $$;

-- ---------- 23. The private bucket bundle-links: an advisor stores a link's files under their own firm's quote request; nobody reads them ----------
-- Catches: a public bucket, a file stored under another firm's quote request (or no quote request), or a member reading a link's files directly
-- instead of through the link.
DO $$
DECLARE folder text := gen_random_uuid()::text;
BEGIN
  PERFORM pg_temp.is((SELECT public FROM storage.buckets WHERE id = 'bundle-links'), false, 'the bucket is private');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$INSERT INTO storage.objects (bucket_id, name) VALUES ('bundle-links', %L)$q$, pg_temp.qr('reyes_insperity') || '/' || folder || '/1-packet.pdf')), 'ok',
                     'under their own firm''s quote request');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$INSERT INTO storage.objects (bucket_id, name) VALUES ('bundle-links', %L)$q$, pg_temp.qr('zed_justworks') || '/' || folder || '/1-packet.pdf')), ':', 1), '42501',
                     'under another firm''s');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$INSERT INTO storage.objects (bucket_id, name) VALUES ('bundle-links', %L)$q$, 'nothing/' || folder || '/1-packet.pdf')), ':', 1), '42501',
                     'under no quote request');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$INSERT INTO storage.objects (bucket_id, name) VALUES ('bundle-links', %L)$q$, pg_temp.qr('reyes_insperity') || '/not-a-folder/1-packet.pdf')), ':', 1), '42501',
                     'in no folder');
  PERFORM pg_temp.is((SELECT count(*)::int FROM storage.objects WHERE bucket_id = 'bundle-links'), 0, 'and reads none back');
  PERFORM pg_temp.as_user('omega_owner', 'omega-partners');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$INSERT INTO storage.objects (bucket_id, name) VALUES ('bundle-links', %L)$q$, pg_temp.qr('omicron_tri') || '/' || folder || '/1-packet.pdf')), ':', 1), '42501',
                     'a closing firm stores none');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 24. A link's files are deleted with the intake ----------
-- Catches: an intake deleted while copies of its packet and answers stay in the bundle-links bucket (the deletion job removes what
-- intake_stored_files lists, and completing refuses while any is left).
DO $$
DECLARE folder text := gen_random_uuid()::text;
BEGIN
  INSERT INTO storage.objects (bucket_id, name) VALUES ('bundle-links', pg_temp.qr('reyes_insperity') || '/' || folder || '/1-packet.pdf'),
                                                       ('bundle-links', pg_temp.qr('zed_justworks') || '/' || folder || '/1-packet.pdf');
  PERFORM pg_temp.is((SELECT string_agg(name, ',') FROM public.intake_stored_files(pg_temp.id('reyes'), pg_temp.id('p_reyes')) WHERE bucket = 'bundle-links' AND name LIKE '%/' || folder || '/%'),
                     pg_temp.qr('reyes_insperity') || '/' || folder || '/1-packet.pdf', 'the intake''s own link files, and not another''s');
END $$;

SELECT 'bundle_links: all passed';
