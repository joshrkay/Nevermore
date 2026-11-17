-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh firm_signup_emails
-- Creating a firm end to end (docs/BROKER_CRM_BUILD.md "Creating a firm end to end", D-1860 on; 20261124090000_firm_signup_emails.sql).
-- A firm that signs up is a waiting firm: every platform admin is told by email (the outbox kind firm_waiting), and when an
-- admin approves or refuses it the person who signed it up is told the decision (the outbox kind firm_decision). The
-- database only queues the emails, in the same transaction as the change; the dispatch-outbox function sends them.
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
\i supabase/migrations/20261124110000_employer_sees_firm.sql
\i supabase/migrations/20261124140000_quote_offer.sql
SET client_min_messages = notice;

CREATE TEMP TABLE fx (name text PRIMARY KEY, id uuid NOT NULL);
GRANT SELECT ON fx TO anon, authenticated, service_role;
CREATE FUNCTION pg_temp.id(n text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM fx WHERE name = n $$;

CREATE FUNCTION pg_temp.new_user(n text, guest boolean DEFAULT false, verified boolean DEFAULT true) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', CASE WHEN guest THEN NULL ELSE n || '@example.test' END,
          CASE WHEN verified AND NOT guest THEN now() END, guest, now(), now());
  INSERT INTO fx VALUES (n, uid);
  RETURN uid;
END $$;

CREATE FUNCTION pg_temp.as_user(n text, guest boolean DEFAULT false) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', guest,
      'email', CASE WHEN guest THEN NULL ELSE n || '@example.test' END)::text, false);
  SET LOCAL ROLE authenticated;
END $$;

CREATE FUNCTION pg_temp.as_anon() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', false);
  SET LOCAL ROLE anon;
END $$;

CREATE FUNCTION pg_temp.is(got anyelement, want anyelement, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION 'FAIL: % gave %, expected %', label, got, want; END IF;
END $$;

-- Runs stmt and always rolls it back: 'rows:<n>' for the rows it touched, or the SQLSTATE it raised.
CREATE FUNCTION pg_temp.attempt(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint; s text; m text;
BEGIN
  BEGIN
    EXECUTE stmt;
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE EXCEPTION USING ERRCODE = 'ZZ999', MESSAGE = n::text;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT;
    IF s = 'ZZ999' THEN RETURN 'rows:' || m; END IF;
    RETURN s;
  END;
END $$;


-- ---------- set up: people, two platform admins, a plain advisor ----------
DO $$
BEGIN
  PERFORM pg_temp.new_user('founder');
  PERFORM pg_temp.new_user('platform_admin');
  PERFORM pg_temp.new_user('second_admin');
  PERFORM pg_temp.new_user('plain_advisor');
  INSERT INTO public.user_roles (user_id, role) VALUES
    (pg_temp.id('platform_admin'), 'admin'), (pg_temp.id('second_admin'), 'admin'), (pg_temp.id('plain_advisor'), 'advisor');
END $$;

-- ---------- 1. a firm that signs up is queued for the admins ----------
-- Break caught: a firm signs up and no email is queued, so the platform admins never hear it is waiting.
DO $$
DECLARE fid uuid;
BEGIN
  PERFORM pg_temp.as_user('founder');
  fid := public.sign_up_firm('Fresh Benefits', 'fresh-benefits');
  RESET ROLE;
  INSERT INTO fx VALUES ('fresh', fid);
  PERFORM pg_temp.is((SELECT count(*) FROM public.outbox_events WHERE kind = 'firm_waiting' AND firm_id = fid), 1::bigint, 'one email is queued for the admins');
  PERFORM pg_temp.is((SELECT session_id IS NULL FROM public.outbox_events WHERE kind = 'firm_waiting' AND firm_id = fid), true, 'it is about a firm, not an intake');
  RAISE NOTICE 'firm_signup_emails: queued for the admins';
END $$;

-- ---------- 2. what the admins' email says ----------
-- Break caught: the email names no firm, no address or no signer (the admin can't tell what is waiting), or carries
-- more than it needs, or is queued twice for one firm.
DO $$
DECLARE p jsonb := (SELECT payload FROM public.outbox_events WHERE kind = 'firm_waiting' AND firm_id = pg_temp.id('fresh'));
BEGIN
  PERFORM pg_temp.is(p, jsonb_build_object('firm_name', 'Fresh Benefits', 'address', 'fresh-benefits', 'signed_up_by_email', 'founder@example.test'),
    'the payload is the firm''s name, its address and who signed it up, and nothing else');
  PERFORM pg_temp.is((SELECT dedupe_key FROM public.outbox_events WHERE kind = 'firm_waiting' AND firm_id = pg_temp.id('fresh')),
    'firm_waiting:' || pg_temp.id('fresh'), 'it is keyed by the firm, so one firm queues one');
  RAISE NOTICE 'firm_signup_emails: the admins'' email';
END $$;

-- ---------- 3. only a firm someone signed up is announced ----------
-- Break caught: every firm inserted (a seeded firm, one made by an operator) mails the admins about a person it does not have.
DO $$
DECLARE seeded uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Seeded Brokers', 'seeded-brokers', now()) RETURNING id INTO seeded;
  PERFORM pg_temp.is((SELECT count(*) FROM public.outbox_events WHERE firm_id = seeded), 0::bigint, 'a firm with no signer queues nothing');
  RAISE NOTICE 'firm_signup_emails: seeded firms are not announced';
END $$;

-- ---------- 4. who the admins are ----------
-- Break caught: the email goes to an advisor who is no admin, to someone with no address, twice to one person, or is readable by a signed-in person.
DO $$
DECLARE nomail uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, created_at, updated_at) VALUES (nomail, 'authenticated', 'authenticated', NULL, now(), now());
  INSERT INTO public.user_roles (user_id, role) VALUES (nomail, 'admin');
  -- An admin who is also an advisor holds two roles and is one address.
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('second_admin'), 'advisor') ON CONFLICT DO NOTHING;
  PERFORM pg_temp.is(public.outbox_admin_recipients(), ARRAY['platform_admin@example.test', 'second_admin@example.test'],
    'every platform admin with an address, in order, and no advisor, and no empty entry for the one with none');
  -- Two accounts that differ only in capitals are one address.
  INSERT INTO auth.users (id, aud, role, email, created_at, updated_at) VALUES (gen_random_uuid(), 'authenticated', 'authenticated', 'SECOND_ADMIN@example.test', now(), now());
  INSERT INTO public.user_roles (user_id, role) SELECT id, 'admin' FROM auth.users WHERE email = 'SECOND_ADMIN@example.test';
  PERFORM pg_temp.is(public.outbox_admin_recipients(), ARRAY['platform_admin@example.test', 'second_admin@example.test'], 'an address is listed once, whatever the capitals');
  DELETE FROM public.user_roles WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'SECOND_ADMIN@example.test');
  DELETE FROM auth.users WHERE email = 'SECOND_ADMIN@example.test';
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT public.outbox_admin_recipients()'), '42501', 'not even a platform admin can ask: only the dispatcher can');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt('SELECT public.outbox_admin_recipients()'), '42501', 'nor a signed-out visitor');
  RESET ROLE;
  DELETE FROM public.user_roles WHERE user_id = nomail;
  DELETE FROM auth.users WHERE id = nomail;
  RAISE NOTICE 'firm_signup_emails: the admins as recipients';
END $$;

-- ---------- 5. approving tells the person who signed the firm up ----------
-- Break caught: an admin approves a firm and its founder is never told, so they wait on a page that says nothing.
DO $$
DECLARE fid uuid;
BEGIN
  PERFORM pg_temp.new_user('founder2');
  PERFORM pg_temp.as_user('founder2');
  fid := public.sign_up_firm('Second Benefits', 'second-benefits');
  RESET ROLE;
  INSERT INTO fx VALUES ('second', fid);
  PERFORM pg_temp.is((SELECT count(*) FROM public.outbox_events WHERE kind = 'firm_decision' AND firm_id = fid), 0::bigint, 'nothing is queued about a decision before there is one');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_decide_firm(fid, true, NULL);
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.outbox_events WHERE kind = 'firm_decision' AND firm_id = fid), 1::bigint, 'approving queues one email for the founder');
  PERFORM pg_temp.is((SELECT session_id IS NULL FROM public.outbox_events WHERE kind = 'firm_decision' AND firm_id = fid), true, 'it is about a firm, not an intake');
  RAISE NOTICE 'firm_signup_emails: approval queued';
END $$;

-- ---------- 6. what the approval email says ----------
-- Break caught: the email goes to nobody in particular (no address to send to), names no firm or address (so no link into it can be made),
-- or doesn't say which way the decision went.
DO $$
BEGIN
  PERFORM pg_temp.is((SELECT payload FROM public.outbox_events WHERE kind = 'firm_decision' AND firm_id = pg_temp.id('second')),
    jsonb_build_object('recipient_email', 'founder2@example.test', 'firm_name', 'Second Benefits', 'address', 'second-benefits', 'approved', true, 'note', NULL),
    'the payload is who it goes to, the firm''s name and address, the way it went and the note (none), and nothing else');
  PERFORM pg_temp.is((SELECT dedupe_key FROM public.outbox_events WHERE kind = 'firm_decision' AND firm_id = pg_temp.id('second')),
    'firm_decision:' || pg_temp.id('second'), 'it is keyed by the firm, so a firm''s decision is queued once');
  RAISE NOTICE 'firm_signup_emails: the approval email';
END $$;

-- ---------- 7. what the refusal email says ----------
-- Break caught: a refusal reads as an approval, or the admin's note is lost or kept when none was given (a blank note is no note).
DO $$
DECLARE fid uuid;
BEGIN
  PERFORM pg_temp.new_user('founder3');
  PERFORM pg_temp.as_user('founder3');
  fid := public.sign_up_firm('Third Benefits', 'third-benefits');
  RESET ROLE;
  INSERT INTO fx VALUES ('third', fid);
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_decide_firm(fid, false, '  We could not match this to a licensed agency.  ');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT payload FROM public.outbox_events WHERE kind = 'firm_decision' AND firm_id = fid),
    jsonb_build_object('recipient_email', 'founder3@example.test', 'firm_name', 'Third Benefits', 'address', 'third-benefits', 'approved', false,
                       'note', 'We could not match this to a licensed agency.'),
    'a refusal says it was refused and carries the admin''s note as the admin''s decision keeps it');
  PERFORM pg_temp.new_user('founder4');
  PERFORM pg_temp.as_user('founder4');
  fid := public.sign_up_firm('Fourth Benefits', 'fourth-benefits');
  RESET ROLE;
  INSERT INTO fx VALUES ('fourth', fid);
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_decide_firm(fid, false, '   ');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT payload -> 'note' FROM public.outbox_events WHERE kind = 'firm_decision' AND firm_id = fid), 'null'::jsonb, 'a refusal with a blank note has no note');
  RAISE NOTICE 'firm_signup_emails: the refusal email';
END $$;

-- ---------- 8. a decision that is refused queues nothing ----------
-- Break caught: deciding a firm twice, or a plain advisor's attempt, leaves a second email behind (the founder told twice, or told of a decision nobody made).
DO $$
BEGIN
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.admin_decide_firm(%L, false, %L)', pg_temp.id('second'), 'changed my mind')), '55000', 'a decided firm is not decided again');
  PERFORM pg_temp.as_user('plain_advisor');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.admin_decide_firm(%L, true, NULL)', pg_temp.id('fresh'))), '42501', 'a plain advisor may not decide a firm');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.outbox_events WHERE kind = 'firm_decision' AND firm_id = pg_temp.id('second')), 1::bigint, 'the founder is told once');
  PERFORM pg_temp.is((SELECT count(*) FROM public.outbox_events WHERE kind = 'firm_decision' AND firm_id = pg_temp.id('fresh')), 0::bigint, 'and a firm nobody decided has no decision email');
  RAISE NOTICE 'firm_signup_emails: refused decisions queue nothing';
END $$;

-- ---------- 9. nobody to tell ----------
-- Break caught: the founder's account is gone and the decision fails, or an email is queued with no address in it.
DO $$
DECLARE fid uuid;
BEGIN
  PERFORM pg_temp.new_user('founder5');
  PERFORM pg_temp.as_user('founder5');
  fid := public.sign_up_firm('Fifth Benefits', 'fifth-benefits');
  RESET ROLE;
  -- What deleting the account does to the firm's record of its signer (ON DELETE SET NULL); the account itself stays, as a firm keeps its last owner.
  UPDATE public.firms SET signed_up_by = NULL WHERE id = fid;
  PERFORM pg_temp.is((SELECT signed_up_by IS NULL FROM public.firms WHERE id = fid), true, 'the firm no longer has a signer');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_decide_firm(fid, true, NULL);
  RESET ROLE;
  PERFORM pg_temp.is((SELECT decision FROM public.firms WHERE id = fid), 'approved', 'the firm is decided all the same');
  PERFORM pg_temp.is((SELECT count(*) FROM public.outbox_events WHERE kind = 'firm_decision' AND firm_id = fid), 0::bigint, 'and no email is queued to nobody');
  RAISE NOTICE 'firm_signup_emails: no signer, no email';
END $$;

-- ---------- 10. neither email is a firm's alert ----------
-- Break caught: the emails are held back with a firm (a suspended or refused firm's signup mail never goes out, a firm that is not closed yet is
-- treated as closed), or a bounce on the admin's or founder's address silences them for other mail.
DO $$
DECLARE claimed text[];
BEGIN
  PERFORM pg_temp.is(public.outbox_kind_is_firm_alert('firm_waiting') OR public.outbox_kind_is_firm_alert('firm_decision'), false, 'neither is a firm''s alert (a firm still waiting or refused has no owners to tell)');
  PERFORM pg_temp.is(public.outbox_kind_reaches_prospect('firm_waiting') OR public.outbox_kind_reaches_prospect('firm_decision'), false, 'and neither is a prospect email: a bounce on a founder''s address is no reason to stop other mail to them');
  -- A suspended firm still has its decision told (the platform's own mail about the platform's own decision).
  INSERT INTO public.firm_suspensions (firm_id, suspended_by, reason) VALUES (pg_temp.id('second'), pg_temp.id('platform_admin'), 'checking');
  SELECT array_agg(kind || ':' || firm_id::text ORDER BY kind, firm_id::text) INTO claimed
  FROM public.claim_outbox_events(ARRAY['firm_waiting', 'firm_decision'], 100, 5, 600) e
  WHERE e.firm_id IN (pg_temp.id('fresh'), pg_temp.id('second'), pg_temp.id('third'));
  PERFORM pg_temp.is(claimed,
    ARRAY(SELECT k FROM unnest(ARRAY['firm_decision:' || pg_temp.id('second'), 'firm_decision:' || pg_temp.id('third'),
      'firm_waiting:' || pg_temp.id('fresh'), 'firm_waiting:' || pg_temp.id('second'), 'firm_waiting:' || pg_temp.id('third')]) k ORDER BY k),
    'the dispatcher claims every waiting email and both decisions, even those of a suspended firm');
  RAISE NOTICE 'firm_signup_emails: not firm alerts';
END $$;
