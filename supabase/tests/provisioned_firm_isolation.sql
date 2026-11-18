-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh provisioned_firm_isolation
-- Two firms provisioned the way a broker provisions one, then the whole quoting path in one of them, read from the other.
-- Every other test here inserts its firms and memberships as the superuser. This one makes them only through
-- `sign_up_firm` and `admin_decide_firm` (CRM-P1.1 with Q-1.2), so it holds what those two functions leave behind to the
-- same promise data_isolation.sql holds inserted firms to: the founder of a provisioned firm works its CRM records and
-- its quotes, and the founder of another provisioned firm reads none of them, by a table, by a list, by a page or by id.
-- Every migration is loaded, in filename order (D-105).
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
\i supabase/migrations/20261124150000_opportunity_activity_intake.sql
\i supabase/migrations/20261124160000_firm_approval_gates_sending.sql
\i supabase/migrations/20261124170000_leads_can_convert.sql
\i supabase/migrations/20261125090000_quote_document.sql
\i supabase/migrations/20261125100000_reply_suggestions.sql
\i supabase/migrations/20261125110000_quote_comparison.sql
\i supabase/migrations/20261125120000_question_requests.sql
\i supabase/migrations/20261125130000_broker_save_whole_form.sql
\i supabase/migrations/20261125140000_opportunity_intake_started_by_firm.sql
\i supabase/migrations/20261125150000_firm_started_intakes_do_not_expire.sql
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

-- What a call (a statement of the form SELECT f(...)) gave its caller: the SQLSTATE it raised, 'nothing' when it answered null, 'ok' when it answered anything.
CREATE FUNCTION pg_temp.state(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  BEGIN
    EXECUTE format('SELECT (%s)::text', substr(stmt, 8)) INTO v;
    RETURN CASE WHEN v IS NULL THEN 'nothing' ELSE 'ok' END;
  EXCEPTION WHEN OTHERS THEN
    RETURN SQLSTATE;
  END;
END $$;

-- How many rows a person reads from a table at an address: row security alone decides.
CREATE FUNCTION pg_temp.reads(who text, addr text, tbl text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  PERFORM pg_temp.as_user(who, addr);
  EXECUTE format('SELECT count(*) FROM public.%I', tbl) INTO n;
  PERFORM pg_temp.as_owner();
  RETURN n;
END $$;

-- ---------- 1. Two firms are provisioned by their founders and approved by a platform admin: nothing is inserted for them ----------
-- Catches: a sign-up that makes the firm but leaves its founder without the membership every rule below asks for.
DO $$
DECLARE fid uuid;
BEGIN
  PERFORM pg_temp.new_user('platform_admin');
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('platform_admin'), 'admin');
  PERFORM pg_temp.new_user('ada'); PERFORM pg_temp.new_user('zed');

  PERFORM pg_temp.as_user('ada');
  fid := public.sign_up_firm('Acme Brokers', 'acme-brokers');
  PERFORM pg_temp.as_owner();
  INSERT INTO fx VALUES ('acme', fid);
  PERFORM pg_temp.as_user('zed');
  fid := public.sign_up_firm('Zenith Benefits', 'zenith-benefits');
  PERFORM pg_temp.as_owner();
  INSERT INTO fx VALUES ('zenith', fid);

  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_decide_firm(pg_temp.id('acme'), true, NULL);
  PERFORM public.admin_decide_firm(pg_temp.id('zenith'), true, NULL);
  PERFORM pg_temp.as_owner();

  PERFORM pg_temp.is((SELECT string_agg(f.name || ':' || m.role, ',' ORDER BY f.name) FROM public.firm_memberships m JOIN public.firms f ON f.id = m.firm_id
                      WHERE m.user_id IN (pg_temp.id('ada'), pg_temp.id('zed')) AND m.valid_until IS NULL),
    'Acme Brokers:owner,Zenith Benefits:owner', 'each founder is the owner of their own firm and of no other');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firms WHERE id IN (pg_temp.id('acme'), pg_temp.id('zenith')) AND approved_at IS NOT NULL), 2::bigint, 'both are approved');
  RAISE NOTICE 'provisioned_firm_isolation: provisioning passed';
END $$;

-- ---------- 2. Acme's founder works the whole path: an account, a lead, an intake sent to two PEOs, a quote from each, the comparison ----------
-- Catches: a provisioned owner refused somewhere an inserted member is let through (a rule that asks for the advisor role, say, which sign-up does not grant).
CREATE FUNCTION pg_temp.qr(peo text) RETURNS bigint LANGUAGE sql AS $$
  SELECT id FROM public.quote_requests WHERE session_id = pg_temp.id('reyes') AND peo_name = peo $$;

DO $$
DECLARE r jsonb; l jsonb; sid uuid; pid bigint; peo text; from_status text; to_status text;
BEGIN
  -- The account and a lead, through the functions the pages call.
  PERFORM pg_temp.as_user('ada', 'acme-brokers');
  r := public.create_account('Reyes Bakery', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 24, '{}'::text[], NULL, pg_temp.id('ada'), pg_temp.id('acme'), 'added_by_hand');
  PERFORM pg_temp.as_owner();
  INSERT INTO fx VALUES ('reyes_account', (r ->> 'id')::uuid);
  INSERT INTO public.leads (firm_id, name, owner_id, source) VALUES (pg_temp.id('acme'), 'Marlow Dental', pg_temp.id('ada'), 'added_by_hand');

  -- The employer's intake on an opportunity of that account, certified and at Ready for market, as quote_comparison.sql places one.
  PERFORM pg_temp.new_user('lucia');
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (pg_temp.id('lucia'), jsonb_build_object('company_name', 'Reyes Bakery')) RETURNING id INTO sid;
  UPDATE public.chamber_sessions SET firm_id = pg_temp.id('acme') WHERE id = sid;
  INSERT INTO fx VALUES ('reyes', sid);
  INSERT INTO public.opportunities (firm_id, account_id, name, intake_id) VALUES (pg_temp.id('acme'), pg_temp.id('reyes_account'), 'Reyes Bakery – PEO search', sid);
  FOREACH to_status IN ARRAY ARRAY['submitted', 'under_review', 'ready_for_market'] LOOP
    SELECT w.status INTO from_status FROM public.submission_workflow w WHERE w.session_id = sid;
    UPDATE public.submission_workflow SET status = to_status WHERE session_id = sid;
    INSERT INTO public.submission_status_history (session_id, from_status, to_status) VALUES (sid, from_status, to_status);
  END LOOP;
  PERFORM set_config('session_replication_role', 'replica', true);
  INSERT INTO public.chamber_certifications (session_id, user_id, signer_name, signer_title, consent_version, consent_text, signed_at, data_sha256, file_id, version, chamber_data)
  SELECT s.id, s.user_id, 'Lucia Reyes', 'Owner', 'v1', 'I certify.', now(), 'h1', 'EAA-2026-0042', 1, s.chamber_data FROM public.chamber_sessions s WHERE s.id = sid;
  PERFORM set_config('session_replication_role', 'origin', true);
  FOREACH peo IN ARRAY ARRAY['Insperity', 'TriNet'] LOOP
    SELECT p.id INTO pid FROM public.peos p WHERE lower(p.name) = lower(peo);
    IF pid IS NULL THEN INSERT INTO public.peos (name) VALUES (peo) RETURNING id INTO pid; END IF;
    INSERT INTO public.peo_authorizations (session_id, peo_id, peo_name, authorized, wording_version, wording_text, signed_by)
    VALUES (sid, pid, peo, true, 'draft-1', 'I authorize this PEO to receive my packet.', pg_temp.id('lucia'));
  END LOOP;
  INSERT INTO public.broker_mailboxes (user_id, provider, address, scope, token_ciphertext, token_iv)
  VALUES (pg_temp.id('ada'), 'google', 'ada@acme.example', 'https://www.googleapis.com/auth/gmail.send', 'sealed', 'iv');

  -- The founder sends to each PEO and records what each quoted.
  FOREACH peo IN ARRAY ARRAY['Insperity', 'TriNet'] LOOP
    PERFORM pg_temp.as_user('ada', 'acme-brokers');
    r := public.send_to_peo(sid, peo, ARRAY['dana@' || lower(peo) || '.example'], 'Reyes Bakery: EAA-2026-0042', 'Dana, here is Reyes Bakery.');
    l := public.issue_bundle_link((r ->> 'quote_request_id')::bigint,
           (SELECT sent_version FROM public.quote_requests WHERE id = (r ->> 'quote_request_id')::bigint), gen_random_uuid(),
           '[{"name": "packet.pdf", "what": "The packet"}]'::jsonb, '[]'::jsonb);
    PERFORM public.attach_peo_link((r ->> 'message_id')::bigint, (l ->> 'id')::bigint, l ->> 'token');
    PERFORM public.record_quote(p_quote_request_id => (r ->> 'quote_request_id')::bigint, p_kind => 'firm_offer', p_admin_fee => 40, p_admin_fee_basis => 'per_employee_per_month');
    PERFORM pg_temp.as_owner();
  END LOOP;
  INSERT INTO fx SELECT 'reyes_opp', o.id FROM public.opportunities o WHERE o.intake_id = sid;

  PERFORM pg_temp.as_user('ada', 'acme-brokers');
  PERFORM pg_temp.is((public.accounts_list(pg_temp.id('acme')) ->> 'total')::int, 1, 'the founder lists the account');
  PERFORM pg_temp.is((public.leads_list(pg_temp.id('acme')) ->> 'total')::int, 1, 'and the lead');
  PERFORM pg_temp.is((public.quotes_list(pg_temp.id('acme')) ->> 'total')::int, 2, 'and a quote row for each PEO');
  r := public.opportunity_quote_comparison(pg_temp.id('acme'), pg_temp.id('reyes_opp'));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT jsonb_agg(c ->> 'peo_name') FROM jsonb_array_elements(r -> 'columns') c), '["Insperity", "TriNet"]'::jsonb, 'the comparison has a column for each PEO');
  PERFORM pg_temp.is((SELECT count(*) FROM jsonb_array_elements(r -> 'columns') c WHERE c -> 'quote' ->> 'kind' = 'firm_offer'), 2::bigint, 'each with its quote');
  RAISE NOTICE 'provisioned_firm_isolation: the quoting path passed';
END $$;

-- ---------- 3. Zenith's founder reads none of it from a table: at their own address, at Acme's, and on the bare domain ----------
-- Catches: a policy that lets any firm's owner read (the role without the firm), or that trusts the address the browser names (D-18).
DO $$
DECLARE t text; addr text; theirs bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY['accounts', 'leads', 'opportunities', 'chamber_sessions', 'chamber_certifications', 'quote_requests', 'quote_request_messages', 'quotes',
                           'peo_authorizations', 'bundle_links', 'firm_memberships', 'firm_activity'] LOOP
    -- The superuser sees Acme's rows, so a zero below is the rule's doing and not an empty table.
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO theirs;
    IF theirs = 0 THEN RAISE EXCEPTION 'FAIL: % holds nothing, so reading none of it proves nothing', t; END IF;
    FOREACH addr IN ARRAY ARRAY['zenith-benefits', 'acme-brokers', ''] LOOP
      PERFORM pg_temp.as_user('zed', NULLIF(addr, ''));
      BEGIN
        EXECUTE format('SELECT count(*) FROM public.%I x WHERE to_jsonb(x) ->> ''firm_id'' IS DISTINCT FROM %L AND NOT (to_jsonb(x) ? ''user_id'' AND to_jsonb(x) ->> ''user_id'' = %L)',
                       t, pg_temp.id('zenith'), pg_temp.id('zed')) INTO theirs;
      EXCEPTION WHEN insufficient_privilege THEN
        theirs := 0; -- a table no browser's role is granted at all (bundle_links) is read by nobody
      END;
      PERFORM pg_temp.as_owner();
      PERFORM pg_temp.is(theirs, 0::bigint, format('rows of %s that are not Zenith''s, read by Zenith''s founder at "%s"', t, addr));
    END LOOP;
  END LOOP;
  RAISE NOTICE 'provisioned_firm_isolation: tables passed';
END $$;

-- ---------- 4. Nor through a list, a page or an id: naming Acme is refused, and their own lists are empty ----------
-- Catches: a function that runs with the definer's rights and takes the firm or the record from its caller without asking whether the caller belongs to it.
DO $$
DECLARE stmt text; got text;
BEGIN
  PERFORM pg_temp.as_user('zed', 'zenith-benefits');
  PERFORM pg_temp.is((public.accounts_list(pg_temp.id('zenith')) ->> 'total')::int, 0, 'Zenith lists no account');
  PERFORM pg_temp.is((public.leads_list(pg_temp.id('zenith')) ->> 'total')::int, 0, 'no lead');
  PERFORM pg_temp.is((public.quotes_list(pg_temp.id('zenith')) ->> 'total')::int, 0, 'and no quote');
  PERFORM pg_temp.is(jsonb_array_length(public.search_records(pg_temp.id('zenith'), 'reyes') -> 'accounts' -> 'rows'), 0, 'searching for Acme''s account finds nothing');
  PERFORM pg_temp.as_owner();

  FOREACH stmt IN ARRAY ARRAY[
    format('SELECT public.accounts_list(%L)', pg_temp.id('acme')),
    format('SELECT public.leads_list(%L)', pg_temp.id('acme')),
    format('SELECT public.quotes_list(%L)', pg_temp.id('acme')),
    format('SELECT public.inbox_list(%L)', pg_temp.id('acme')),
    format('SELECT public.search_records(%L, %L)', pg_temp.id('acme'), 'reyes'),
    format('SELECT public.account_page(%L, %L)', pg_temp.id('acme'), pg_temp.id('reyes_account')),
    format('SELECT public.account_page(%L, %L)', pg_temp.id('zenith'), pg_temp.id('reyes_account')),
    format('SELECT public.opportunity_page(%L, %L)', pg_temp.id('acme'), pg_temp.id('reyes_opp')),
    format('SELECT public.opportunity_page(%L, %L)', pg_temp.id('zenith'), pg_temp.id('reyes_opp')),
    format('SELECT public.opportunity_quote_comparison(%L, %L)', pg_temp.id('acme'), pg_temp.id('reyes_opp')),
    format('SELECT public.opportunity_quote_comparison(%L, %L)', pg_temp.id('zenith'), pg_temp.id('reyes_opp')),
    format('SELECT public.send_to_peo(%L, %L, ARRAY[%L], %L, %L)', pg_temp.id('reyes'), 'Justworks', 'x@justworks.example', 'Subject', 'Body'),
    format('SELECT public.record_quote(p_quote_request_id => %s, p_kind => %L, p_admin_fee => 1, p_admin_fee_basis => %L)', pg_temp.qr('Insperity'), 'estimate', 'per_employee_per_month')
  ] LOOP
    -- At their own address and at Acme's: the address a browser names opens nothing (D-18). Each is refused (42501), not found (PT404) or answers nothing at all.
    PERFORM pg_temp.as_user('zed', 'zenith-benefits');
    got := pg_temp.state(stmt);
    PERFORM pg_temp.as_owner();
    IF got NOT IN ('42501', 'PT404', 'nothing') THEN RAISE EXCEPTION 'FAIL: Zenith''s founder ran % and got %', stmt, got; END IF;
    PERFORM pg_temp.as_user('zed', 'acme-brokers');
    got := pg_temp.state(stmt);
    PERFORM pg_temp.as_owner();
    IF got NOT IN ('42501', 'PT404', 'nothing') THEN RAISE EXCEPTION 'FAIL: at Acme''s address Zenith''s founder ran % and got %', stmt, got; END IF;
  END LOOP;
  PERFORM pg_temp.is((SELECT count(*) FROM public.quotes), 2::bigint, 'and nothing was written: Acme still holds its two quotes');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quote_requests), 2::bigint, 'and its two quote requests');
  RAISE NOTICE 'provisioned_firm_isolation: functions passed';
END $$;

-- ---------- 5. The platform admin who approved both firms reads neither (D-16) ----------
-- Catches: approval, or the admin role, working as a way into a firm's records.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['accounts', 'leads', 'opportunities', 'quote_requests', 'quotes'] LOOP
    PERFORM pg_temp.is(pg_temp.reads('platform_admin', NULL, t), 0::bigint, format('%s read by the platform admin', t));
    PERFORM pg_temp.is(pg_temp.reads('platform_admin', 'acme-brokers', t), 0::bigint, format('%s read by the platform admin at Acme''s address', t));
  END LOOP;
  RAISE NOTICE 'provisioned_firm_isolation: the platform admin passed';
END $$;

SELECT 'provisioned_firm_isolation: all passed';
