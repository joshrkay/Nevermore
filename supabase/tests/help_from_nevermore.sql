-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh help_from_nevermore
-- Help from Nevermore (story CRM-P2.4; docs/BROKER_CRM_BUILD.md D-16, D-18, D-19, D-24, D-29, D-33, D-40, D-104, D-105, D-115, D-122;
-- 20261118120000_help_from_nevermore.sql, ADR 0024). A platform admin, who is no member of any firm, gives a reason and for one hour can
-- open one firm's workspace at its address and READ what a member reads. They change nothing, export nothing, send nothing and open no
-- file link. The firm's owners see each use as "Nevermore", with the reason; the admin's own identity is kept for the platform only.
-- Two firms are used throughout, and every migration is loaded in filename order (D-105), this story's last.
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
-- Stand-in for pg_cron (as supabase/tests/leave_a_firm.sql has it), holding the daily job of the firm's record as 20261116160001 made it, so
-- the later migrations can be seen to add their steps to that same job, this story's last.
CREATE SCHEMA cron;
CREATE TABLE cron.job (jobid serial PRIMARY KEY, jobname text UNIQUE, schedule text NOT NULL, command text NOT NULL);
CREATE FUNCTION cron.schedule(job_name text, schedule text, command text) RETURNS bigint LANGUAGE sql AS $$
  INSERT INTO cron.job (jobname, schedule, command) VALUES (job_name, schedule, command)
  ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command
  RETURNING jobid::bigint
$$;
INSERT INTO cron.job (jobname, schedule, command) VALUES ('prune-firm-activity', '53 3 * * *', 'select public.prune_firm_activity();');
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

-- Signs in as a person, at a firm's address when one is named (the browser sends it on every request, D-40) and on the bare domain when not.
CREATE FUNCTION pg_temp.as_user(n text, addr text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', false, 'email', n || '@example.test')::text, false);
  PERFORM set_config('request.headers', CASE WHEN addr IS NULL THEN '' ELSE jsonb_build_object('x-firm-address', addr)::text END, false);
  SET LOCAL ROLE authenticated;
END $$;

-- A password sign-in that has not done its second factor.
CREATE FUNCTION pg_temp.as_password_user_without_second_factor(n text, addr text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', false, 'email', n || '@example.test', 'aal', 'aal1',
      'amr', jsonb_build_array(jsonb_build_object('method', 'password', 'timestamp', 1)))::text, false);
  PERFORM set_config('request.headers', CASE WHEN addr IS NULL THEN '' ELSE jsonb_build_object('x-firm-address', addr)::text END, false);
  SET LOCAL ROLE authenticated;
END $$;

CREATE FUNCTION pg_temp.as_anon() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', false);
  PERFORM set_config('request.headers', '', false);
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

-- The SQLSTATE and message a statement raised, or 'ok' when it did not. The statement's own work is rolled back either way.
CREATE FUNCTION pg_temp.refusal(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE s text; m text;
BEGIN
  BEGIN
    EXECUTE stmt;
    RAISE EXCEPTION USING ERRCODE = 'ZZ999', MESSAGE = 'ok';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT;
    IF s = 'ZZ999' THEN RETURN 'ok'; END IF;
    RETURN s || ': ' || m;
  END;
END $$;

CREATE FUNCTION pg_temp.hash(t text) RETURNS text LANGUAGE sql AS $$ SELECT encode(extensions.digest(t, 'sha256'), 'hex') $$;

-- A count of what the firm holds that a member could change, as the table owner: every write below must leave it as it was.
CREATE FUNCTION pg_temp.held(fid uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE step record; n bigint; res jsonb := '{}'::jsonb;
BEGIN
  FOR step IN SELECT p.src, p.firm_column FROM public.firm_closing_plan() p WHERE p.action = 'delete' ORDER BY p.ord LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %I = $1', substr(step.src, 8), step.firm_column) INTO n USING fid;
    res := res || jsonb_build_object(substr(step.src, 8), n);
  END LOOP;
  RETURN res || jsonb_build_object('firm_activity', (SELECT count(*) FROM public.firm_activity WHERE firm_id = fid),
    'notes', (SELECT count(*) FROM public.advisor_notes), 'thread_reads', (SELECT count(*) FROM public.quote_request_thread_reads),
    'memberships', (SELECT count(*) FROM public.firm_memberships WHERE firm_id = fid),
    'workflow', (SELECT string_agg(w.status || w.needs_action::text, ',' ORDER BY w.session_id) FROM public.submission_workflow w),
    'outbox', (SELECT string_agg(e.status || e.attempts::text, ',' ORDER BY e.id) FROM public.outbox_events e),
    'deletions', (SELECT string_agg(d.status || d.attempts::text, ',' ORDER BY d.id) FROM public.intake_deletions d),
    'intakes', (SELECT string_agg(c.status, ',' ORDER BY c.id) FROM public.chamber_sessions c), 'quote_requests', (SELECT string_agg(q.status, ',' ORDER BY q.id) FROM public.quote_requests q),
    'messages', (SELECT count(*) FROM public.quote_request_messages), 'manuscripts', (SELECT count(*) FROM public.manuscript_versions));
END $$;

-- ---------- set up ----------
-- alpha: owner_a, agent_a (also an advisor), admin_member (a platform admin who is also an agent of alpha). beta: the same kinds of rows.
-- sigma is suspended, rho refused, omega waiting for approval, zeta closes later. platform_admin and admin2 are platform admins, members of nothing.
DO $$
DECLARE fa uuid; fb uuid; fs uuid; fr uuid; fo uuid; fz uuid; s uuid; sb uuid; q bigint; sv uuid; m bigint;
BEGIN
  INSERT INTO public.firms (name, address, approved_at, decision, decided_at) VALUES ('Alpha Brokers', 'alpha-brokers', now(), 'approved', now()) RETURNING id INTO fa;
  INSERT INTO public.firms (name, address, approved_at, decision, decided_at) VALUES ('Beta Benefits', 'beta-benefits', now(), 'approved', now()) RETURNING id INTO fb;
  INSERT INTO public.firms (name, address, approved_at, decision, decided_at) VALUES ('Sigma Suspended', 'sigma-suspended', now(), 'approved', now()) RETURNING id INTO fs;
  INSERT INTO public.firms (name, address, decision, decided_at) VALUES ('Rho Refused', 'rho-refused', 'refused', now()) RETURNING id INTO fr;
  INSERT INTO public.firms (name, address) VALUES ('Omega Partners', 'omega-partners') RETURNING id INTO fo;
  INSERT INTO public.firms (name, address, approved_at, decision, decided_at) VALUES ('Zeta Zone', 'zeta-zone', now(), 'approved', now()) RETURNING id INTO fz;
  INSERT INTO fx VALUES ('alpha', fa), ('beta', fb), ('sigma', fs), ('rho', fr), ('omega', fo), ('zeta', fz);
  PERFORM pg_temp.new_user(n) FROM unnest(ARRAY['owner_a', 'agent_a', 'admin_member', 'owner_b', 'agent_b', 'owner_s', 'owner_r', 'owner_o', 'owner_z',
    'platform_admin', 'admin2', 'admin3', 'outsider', 'prospect_a', 'prospect_b', 'invitee']) AS n;
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES
    (fa, pg_temp.id('owner_a'), 'owner'), (fa, pg_temp.id('agent_a'), 'agent'), (fa, pg_temp.id('admin_member'), 'agent'),
    (fb, pg_temp.id('owner_b'), 'owner'), (fb, pg_temp.id('agent_b'), 'agent'),
    (fs, pg_temp.id('owner_s'), 'owner'), (fr, pg_temp.id('owner_r'), 'owner'), (fo, pg_temp.id('owner_o'), 'owner'), (fz, pg_temp.id('owner_z'), 'owner');
  INSERT INTO public.user_roles (user_id, role) VALUES
    (pg_temp.id('platform_admin'), 'admin'), (pg_temp.id('admin2'), 'admin'), (pg_temp.id('admin3'), 'admin'), (pg_temp.id('admin_member'), 'admin'),
    (pg_temp.id('agent_a'), 'advisor'), (pg_temp.id('agent_b'), 'advisor'), (pg_temp.id('owner_a'), 'advisor');
  INSERT INTO public.chamber_sessions (user_id, firm_id, chamber_data) VALUES (pg_temp.id('prospect_a'), fa, '{}') RETURNING id INTO s;
  INSERT INTO public.chamber_sessions (user_id, firm_id, chamber_data) VALUES (pg_temp.id('prospect_b'), fb, '{}') RETURNING id INTO sb;
  INSERT INTO fx VALUES ('intake_a', s), ('intake_b', sb);
  INSERT INTO public.quote_requests (session_id, peo_name, status) VALUES (s, 'Probe PEO', 'sent') RETURNING id INTO q;
  PERFORM set_config('test.quote_a', q::text, false);
  INSERT INTO public.quote_request_messages (provider_message_id, quote_request_id, session_id, direction, from_address)
    VALUES ('thread-1', q, s, 'received', 'peo@example.test') RETURNING id INTO m;
  PERFORM set_config('test.message_a', m::text, false);
  INSERT INTO public.outbox_events (kind, session_id, dedupe_key, payload, status) VALUES ('advisor_notification', s, 'alert-a', '{}', 'pending');
  INSERT INTO public.referral_partners (firm_id, code, name, kind) VALUES (fa, 'existing', 'Existing', 'accounting'), (fb, 'existing', 'Existing', 'accounting');
  INSERT INTO public.firm_organisations (firm_id, provider, org_id, label) VALUES (fa, 'google', 'alpha.example', 'Alpha');
  INSERT INTO public.firm_invitations (firm_id, email, role, token_hash, expires_at) VALUES (fa, 'invitee@example.test', 'agent', pg_temp.hash('invite-a'), now() + interval '7 days');
  INSERT INTO public.saved_views (firm_id, user_id, table_name, name) VALUES (fa, pg_temp.id('agent_a'), 'submissions', 'Mine') RETURNING id INTO sv;
  INSERT INTO fx VALUES ('view_a', sv);
  INSERT INTO public.saved_views (firm_id, user_id, table_name, name) VALUES (fa, pg_temp.id('owner_a'), 'submissions', 'Owner''s') RETURNING id INTO sv;
  INSERT INTO fx VALUES ('view_o', sv);
  INSERT INTO public.broker_mailboxes (user_id, provider, address, scope, token_ciphertext, token_iv) VALUES
    (pg_temp.id('agent_a'), 'google', 'agent_a@mailbox.test', 'gmail.send', 'secret-token-a', 'i'),
    (pg_temp.id('agent_b'), 'google', 'agent_b@mailbox.test', 'gmail.send', 'secret-token-b', 'i'),
    (pg_temp.id('platform_admin'), 'google', 'admin@mailbox.test', 'gmail.send', 'secret-token-admin', 'i');
  -- The files: a document, a generated packet and a PEO attachment, each as a row and as a stored object.
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, scan_verdict)
    VALUES (pg_temp.id('prospect_a'), s, 'census.pdf', '1', pg_temp.id('prospect_a') || '/' || s || '/census.pdf', 'clean');
  INSERT INTO storage.objects (bucket_id, name) VALUES ('documents', pg_temp.id('prospect_a') || '/' || s || '/census.pdf'), ('manuscripts', s || '/v1.pdf'),
    ('peo-mail', s || '/' || m || '/quote.pdf');
  INSERT INTO public.quote_request_message_attachments (message_id, provider_attachment_id, file_name, size_bytes, status, scan_verdict, storage_bucket, storage_path)
    VALUES (m, 'att-1', 'quote.pdf', 1, 'stored', 'clean', 'peo-mail', s || '/' || m || '/quote.pdf');
  INSERT INTO public.chamber_sessions (user_id, firm_id, chamber_data) VALUES (pg_temp.id('invitee'), fa, '{}') RETURNING id INTO sv;
  INSERT INTO public.intake_deletions (session_id, user_id, trigger, reason, status) VALUES (sv, pg_temp.id('invitee'), 'request', 'probe', 'failed') RETURNING id INTO sv;
  INSERT INTO fx VALUES ('deletion_a', sv);
END $$;

-- A note on alpha's quote request by its agent, as the firm's own people make one.
DO $$
DECLARE note jsonb;
BEGIN
  PERFORM pg_temp.as_user('agent_a');
  note := public.advisor_add_quote_request_note(current_setting('test.quote_a')::bigint, 'other', current_date, 'a note');
  PERFORM set_config('test.note_a', note ->> 'id', false);
  RESET ROLE;
  RAISE NOTICE 'help_from_nevermore: set up';
END $$;

-- ---------- starting: who may, and what a session is ----------
-- Break caught: anyone but a platform admin starts one (an agent, an owner, a stranger, a signed-out visitor, an admin whose password
-- sign-in has not done its second factor); an admin starts one on a firm they belong to; a reason is not required, is blank or is
-- unbounded; a refused or closed firm takes one; a session lasts longer or shorter than an hour of the server's clock, or the browser
-- chooses its end; two are open for one admin and firm at once.
DO $$
DECLARE fa uuid := pg_temp.id('alpha'); fb uuid := pg_temp.id('beta'); s record;
BEGIN
  PERFORM pg_temp.as_user('agent_a', 'alpha-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.start_support_session(%L, 'because')$q$, fa)), '42501: Admin access required', 'an agent cannot start support access');
  PERFORM pg_temp.as_user('owner_a');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.start_support_session(%L, 'because')$q$, fa)), '42501: Admin access required', 'an owner cannot, even for their own firm');
  PERFORM pg_temp.as_user('outsider');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.start_support_session(%L, 'because')$q$, fa)), '42501: Admin access required', 'a stranger cannot');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.start_support_session(%L, 'because')$q$, fa)), '42501', 'nor a signed-out visitor');
  PERFORM pg_temp.as_password_user_without_second_factor('platform_admin');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.start_support_session(%L, 'because')$q$, fa)), '42501: Admin access required', 'nor an admin whose password sign-in owes its second factor (D-19)');
  PERFORM pg_temp.as_user('admin_member');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.start_support_session(%L, 'because')$q$, fa)), '42501: An admin does not use support access on a firm they belong to', 'an admin cannot use it on a firm they belong to');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.start_support_session(%L, NULL)$q$, fa)), '22023: Give a reason of 1 to 500 characters', 'a reason is required');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.start_support_session(%L, '   ')$q$, fa)), '22023: Give a reason of 1 to 500 characters', 'a blank one is not a reason');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.start_support_session(%L, %L)$q$, fa, repeat('x', 501))), '22023: Give a reason of 1 to 500 characters', 'a reason has a maximum');
  PERFORM pg_temp.is(pg_temp.refusal($q$SELECT public.start_support_session(gen_random_uuid(), 'because')$q$), 'PT404: That firm does not exist', 'a firm that does not exist');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.start_support_session(%L, 'because')$q$, pg_temp.id('rho'))), '55000: That firm is refused or closed, so there is nothing to look at', 'a refused firm takes none');
  RESET ROLE;
  INSERT INTO public.firm_closures (firm_id, asked_at, closes_at, closed_at, deleted_counts) VALUES (pg_temp.id('zeta'), now() - interval '40 days', now() - interval '10 days', now() - interval '1 day', '{}');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.start_support_session(%L, 'because')$q$, pg_temp.id('zeta'))), '55000: That firm is refused or closed, so there is nothing to look at', 'nor a closed one');
  RESET ROLE;
  DELETE FROM public.firm_closures WHERE firm_id = pg_temp.id('zeta');
  PERFORM pg_temp.is((SELECT count(*) FROM public.support_sessions), 0::bigint, 'none of those left a session behind');

  -- A session: a waiting firm, a suspended firm and an ordinary one all take it; it lasts exactly one hour from the server's clock.
  PERFORM pg_temp.as_user('platform_admin');
  SELECT * INTO s FROM public.start_support_session(fa, '  Customer asked for help with a stuck quote  ');
  RESET ROLE;
  PERFORM set_config('test.session_a', s.session_id::text, false);
  PERFORM pg_temp.is(s.firm_name, 'Alpha Brokers', 'the answer names the firm');
  PERFORM pg_temp.is(s.firm_address, 'alpha-brokers', 'and its address');
  PERFORM pg_temp.is((SELECT x.ends_at - x.started_at FROM public.support_sessions x WHERE x.id = s.session_id), interval '1 hour', 'it lasts one hour');
  PERFORM pg_temp.is((SELECT x.started_at = now() FROM public.support_sessions x WHERE x.id = s.session_id), true, 'from the server''s clock (this transaction''s now)');
  PERFORM pg_temp.is((SELECT x.reason FROM public.support_sessions x WHERE x.id = s.session_id), 'Customer asked for help with a stuck quote', 'the reason is kept, trimmed');
  PERFORM pg_temp.is((SELECT x.admin_email FROM public.support_sessions x WHERE x.id = s.session_id), 'platform_admin@example.test', 'and the platform keeps who, for its own record');
  PERFORM pg_temp.is(pg_temp.attempt($q$INSERT INTO public.support_sessions (firm_id, admin_id, admin_email, reason, started_at, ends_at)
    VALUES (pg_temp.id('beta'), pg_temp.id('admin2'), 'x', 'y', now(), now() + interval '5 hours')$q$), '23514', 'a session cannot be made to last longer than an hour');
  -- The one-open rule is a constraint (D-29): the second insert for the same admin and firm is refused by the index itself.
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.support_sessions (firm_id, admin_id, admin_email, reason, ends_at)
    VALUES (%L, %L, 'x', 'again', now() + interval '1 hour')$q$, fa, pg_temp.id('platform_admin'))), '23505', 'a second open session for the same admin and firm is refused by the table');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.start_support_session(%L, 'again')$q$, fa)), 'PT409: You already have support access open for that firm', 'and starting it says so in words');
  PERFORM public.start_support_session(fb, 'for beta');
  PERFORM pg_temp.as_user('admin2');
  PERFORM public.start_support_session(fa, 'my own look');
  PERFORM public.start_support_session(pg_temp.id('omega'), 'a waiting firm');
  RESET ROLE;
  INSERT INTO public.firm_suspensions (firm_id, reason) VALUES (pg_temp.id('sigma'), 'probe');
  PERFORM pg_temp.as_user('admin2');
  PERFORM public.start_support_session(pg_temp.id('sigma'), 'a suspended firm');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.support_sessions WHERE ended_at IS NULL), 5::bigint,
    'one admin has one open for two firms, another admin has their own for the same firm, a waiting firm and a suspended one take it too');
  RAISE NOTICE 'help_from_nevermore: starting passed';
END $$;

-- ---------- what a session gives: the read side, at that firm's address, to that admin ----------
-- Break caught: a session reads nothing (the doorway is shut), or reads too much: another firm's rows; the firm's rows on the bare domain
-- or at another firm's address; for another admin, a member of another firm, a stranger or an admin without a session; the role is not told
-- apart from an owner's, lead's or agent's; a member of the firm reads less than before.
DO $$
DECLARE fa uuid := pg_temp.id('alpha'); fb uuid := pg_temp.id('beta'); s uuid := pg_temp.id('intake_a'); q bigint := current_setting('test.quote_a')::bigint;
BEGIN
  PERFORM pg_temp.as_user('platform_admin', 'alpha-brokers');
  PERFORM pg_temp.is(public.firm_role(fa), 'support', 'at the firm''s address the admin''s role is support, a value nobody else holds');
  PERFORM pg_temp.is(public.firm_role(fb), NULL::text, 'and they have none in another firm');
  PERFORM pg_temp.is(public.is_firm_member(fa), true, 'the read side asks "is a member" and is let through');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_sessions), 2::bigint, 'they read the firm''s intakes (and not beta''s)');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_sessions WHERE firm_id = fb), 0::bigint, 'nothing of another firm');
  PERFORM pg_temp.is((SELECT count(*) FROM public.queue_list_submissions() ), 1::bigint, 'the queue answers');
  PERFORM pg_temp.is((SELECT count(*) FROM public.advisor_list_submissions(NULL, NULL, 500, 0, NULL, NULL, NULL)), 2::bigint, 'with the firm''s submissions');
  PERFORM pg_temp.is((SELECT count(*) FROM public.open_submission(s)), 1::bigint, 'a submission opens');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quote_requests), 1::bigint, 'its quote requests read');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quote_request_messages), 1::bigint, 'and the mail thread');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quote_request_notes), 1::bigint, 'the notes');
  PERFORM pg_temp.is((SELECT count(*) FROM public.referral_partners), 1::bigint, 'the referral partners');
  PERFORM pg_temp.is((SELECT count(*) FROM public.documents), 1::bigint, 'the documents'' rows');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firms), 1::bigint, 'the firm''s own row');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_members(fa)), 3::bigint, 'who is in the firm, as an owner reads it');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity_list(fa, NULL, NULL, 50, NULL, NULL, false)) > 0, true, 'and the firm''s record');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity_people(fa)) > 0, true, 'with the people in it');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_support_sessions(fa)), 2::bigint, 'and each use of support, with the reason');
  PERFORM pg_temp.is((SELECT c.can_ask FROM public.my_firm_closure(fa) c), false, 'closing is not theirs to ask');
  PERFORM pg_temp.is((SELECT c.cannot_ask_because FROM public.my_firm_closure(fa) c), 'not_owner', 'they are told it is an owner''s');

  -- On the bare domain, and at another firm's address, the same admin reads nothing of alpha.
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is(public.firm_role(fa), NULL::text, 'on the bare domain the session gives no role');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_sessions), 0::bigint, 'and reads no intake');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.firm_members(%L)$q$, fa)), '42501: Only an owner of the firm can do that', 'nor the members');
  PERFORM pg_temp.as_user('platform_admin', 'beta-benefits');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_sessions), 1::bigint, 'at beta''s address they read beta, for which they also hold a session');
  PERFORM pg_temp.as_user('platform_admin', 'zeta-zone');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_sessions), 0::bigint, 'and at a firm they hold no session for, nothing');
  PERFORM pg_temp.as_user('platform_admin', 'rho-refused');
  PERFORM pg_temp.is(public.firm_role(pg_temp.id('rho')), NULL::text, 'and at a refused firm''s address, nothing');

  -- It is the admin's own sign-in: it gives nothing to anyone else.
  PERFORM pg_temp.as_user('admin2', 'beta-benefits');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_sessions), 0::bigint, 'another admin with no session for beta reads nothing there, though platform_admin has one');
  PERFORM pg_temp.as_user('owner_b', 'alpha-brokers');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_sessions), 0::bigint, 'a member of another firm at alpha''s address reads nothing');
  PERFORM pg_temp.as_user('outsider', 'alpha-brokers');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_sessions), 0::bigint, 'nor does a stranger');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_sessions), 0::bigint, 'nor a signed-out visitor');
  PERFORM pg_temp.as_password_user_without_second_factor('platform_admin', 'alpha-brokers');
  PERFORM pg_temp.is(public.firm_role(fa), NULL::text, 'a password sign-in that owes its second factor reads nothing, even with a session (D-19)');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_sessions), 0::bigint, 'including no intake');

  -- The firm's own people read exactly what they did.
  PERFORM pg_temp.as_user('agent_a', 'alpha-brokers');
  PERFORM pg_temp.is(public.firm_role(fa), 'agent', 'an agent is an agent');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_sessions), 2::bigint, 'and reads what they read');
  PERFORM pg_temp.as_user('owner_a', 'alpha-brokers');
  PERFORM pg_temp.is(public.firm_role(fa), 'owner', 'an owner is an owner');
  -- A member who is also a platform admin is a member: the member's role is theirs and no session changes it.
  PERFORM pg_temp.as_user('admin_member', 'alpha-brokers');
  PERFORM pg_temp.is(public.firm_role(fa), 'agent', 'an admin who is a member of the firm is an agent there');
  RESET ROLE;
  RAISE NOTICE 'help_from_nevermore: the read side passed';
END $$;

-- ---------- what support reads is what an owner reads, and not what is a secret ----------
-- Break caught: support reads who is waiting to join (invitations, requests, listed organisations), asks to close the firm, reads a
-- mailbox or its token, an invitation's hash, a platform table, or who at Nevermore acted (an actor's id on an entry of the firm's record).
DO $$
DECLARE fa uuid := pg_temp.id('alpha');
BEGIN
  PERFORM pg_temp.as_user('platform_admin', 'alpha-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.firm_pending_invitations(%L)$q$, fa)), '42501: Only an owner of the firm can do that', 'support does not read the pending invitations');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.firm_join_requests(%L)$q$, fa)), '42501', 'nor the requests to join');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.firm_organisations(%L)$q$, fa)), '42501', 'nor the listed organisations');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.request_firm_closure(%L, 'Alpha Brokers')$q$, fa)), '42501', 'nor can it ask to close the firm');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.withdraw_firm_closure(%L)$q$, fa)), '42501', 'or withdraw a request');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.firm_invitations'), '42501', 'the invitations table is closed to the API');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.broker_mailboxes'), '42501', 'so is the mailboxes table, tokens and all');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.support_sessions'), '42501', 'so is the platform''s record of sessions');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT actor_id FROM public.firm_activity'), '42501', 'and the actor of an entry of the firm''s record is not a column anyone can read');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.mailbox_secret(%L)$q$, pg_temp.id('agent_a'))), '42501', 'no one signed in as a person can read a mailbox''s token');
  PERFORM pg_temp.is((SELECT public.my_mailbox() ->> 'connected'), 'false', 'and the admin has no mailbox to send from: it reports none connected, though a row exists for them');
  RESET ROLE;
  RAISE NOTICE 'help_from_nevermore: the level passed';
END $$;

-- ---------- support can change nothing ----------
-- Break caught: any one of the paths that change a firm's data still works for a support session (each is tried below, as the admin who
-- holds one, at the firm's address, with the message they should see); one is refused for a reason that is not the session (each is
-- tried again after the session ends, and the support message must be gone: the refusal was the session and nothing else); a path
-- changed something before it refused.
CREATE TEMP TABLE writes (label text PRIMARY KEY, stmt text NOT NULL, refusal text NOT NULL);
DO $$
DECLARE fa uuid := pg_temp.id('alpha'); s uuid := pg_temp.id('intake_a'); q bigint := current_setting('test.quote_a')::bigint; note bigint := current_setting('test.note_a')::bigint;
  v uuid := pg_temp.id('view_a'); vo uuid := pg_temp.id('view_o'); org uuid; req uuid; inv uuid; ev uuid; support_msg text := 'PT423: Nevermore support can look, not change';
BEGIN
  RESET ROLE;
  SELECT id INTO org FROM public.firm_organisations WHERE firm_id = fa;
  INSERT INTO public.join_requests (firm_id, user_id, provider, org_id, org_label) VALUES (fa, pg_temp.id('outsider'), 'google', 'alpha.example', 'Alpha');
  SELECT id INTO req FROM public.join_requests WHERE firm_id = fa;
  SELECT id INTO inv FROM public.firm_invitations WHERE firm_id = fa;
  SELECT id INTO ev FROM public.outbox_events WHERE dedupe_key = 'alert-a';
  INSERT INTO writes VALUES
    ('add a referral partner', format($q$SELECT public.advisor_add_referral_partner('new-code', 'New', 'accounting', %L)$q$, fa), support_msg),
    ('change a referral partner', format($q$SELECT public.advisor_update_referral_partner('existing', 'Renamed', 'accounting', %L)$q$, fa), support_msg),
    ('invite a member', format($q$SELECT public.invite_member(%L, 'new@example.test', 'agent', NULL, %L)$q$, fa, pg_temp.hash('x1')), support_msg),
    ('send an invitation again', format($q$SELECT public.resend_invitation(%L, %L)$q$, inv, pg_temp.hash('x2')), support_msg),
    ('withdraw an invitation', format($q$SELECT public.cancel_invitation(%L)$q$, inv), support_msg),
    ('list an organisation', format($q$SELECT public.add_firm_organisation(%L, 'google', 'new.example', 'New')$q$, fa), support_msg),
    ('remove an organisation', format($q$SELECT public.remove_firm_organisation(%L)$q$, org), support_msg),
    ('approve a request to join', format($q$SELECT public.approve_join_request(%L, 'agent')$q$, req), support_msg),
    ('decline a request to join', format($q$SELECT public.decline_join_request(%L)$q$, req), support_msg),
    ('remove a member', format($q$SELECT public.remove_member(%L, %L)$q$, fa, pg_temp.id('agent_a')), support_msg),
    ('suspend a member', format($q$SELECT public.suspend_member(%L, %L)$q$, fa, pg_temp.id('agent_a')), support_msg),
    ('lift a member''s suspension', format($q$SELECT public.lift_member_suspension(%L, %L)$q$, fa, pg_temp.id('agent_a')), support_msg),
    ('save a view', format($q$SELECT public.save_view(%L, 'submissions', 'Another', '{}'::jsonb, '{}'::jsonb, '[]'::jsonb)$q$, fa), support_msg),
    ('choose columns', format($q$SELECT public.set_my_table_columns(%L, 'submissions', NULL, '["a"]'::jsonb)$q$, fa), support_msg),
    ('review a submission field', format($q$SELECT public.review_submission_field(%L, 'company_name', 'verified')$q$, s), support_msg),
    ('set a submission''s status', format($q$SELECT public.set_submission_status(%L, 'under_review')$q$, s), support_msg),
    ('mark a submission as needing action', format($q$SELECT public.set_submission_needs_action(%L, true, NULL)$q$, s), support_msg),
    ('ask the prospect for information', format($q$SELECT public.advisor_request_information(%L, 'Please send the census')$q$, s), support_msg),
    ('record a send', format($q$SELECT public.advisor_record_quote_send(%L, 'Probe PEO')$q$, s), support_msg),
    ('update a quote request', format($q$SELECT public.advisor_update_quote_request(%s, 'quoted')$q$, q), support_msg),
    ('add a note to a quote request', format($q$SELECT public.advisor_add_quote_request_note(%s, 'other', current_date, 'x')$q$, q), support_msg),
    ('note an underwriter''s question', format($q$SELECT public.advisor_note_underwriter_question(%s, 'why?')$q$, q), support_msg),
    ('correct a note', format($q$SELECT public.advisor_correct_quote_request_note(%s, 'other', current_date, 'y')$q$, note), support_msg),
    ('issue a new reply address', format($q$SELECT public.advisor_reissue_quote_request_address(%s)$q$, q), support_msg),
    ('retry a send', format($q$SELECT public.advisor_requeue_outbox_event(%L)$q$, ev), support_msg),
    ('record a packet', format($q$SELECT public.record_manuscript_version(%L, 1, %L, 'x', NULL, 0, false, 'h', now())$q$, s, s || '/p.pdf'), support_msg),
    ('ask for an intake to be deleted', format($q$SELECT public.request_intake_deletion(%L, 'probe')$q$, s), support_msg),
    ('revoke an intake', format($q$SELECT public.revoke_chamber_session(%L, 'probe')$q$, s), support_msg),
    ('retry an intake''s deletion', format($q$SELECT public.retry_intake_deletion(%L)$q$, pg_temp.id('deletion_a')), support_msg),
    ('write a note on an intake', format($q$INSERT INTO public.advisor_notes (session_id, author_id, body) VALUES (%L, %L, 'hi')$q$, s, pg_temp.id('platform_admin')), support_msg),
    ('write a sign-in to the firm''s record', format($q$SELECT public.record_member_activity('sign_in', 'firm', %L)$q$, fa), support_msg),
    ('write a download to the firm''s record', format($q$SELECT public.record_member_activity('document_downloaded', 'submission', %L)$q$, s), support_msg),
    -- Refused by something else that is still true of a support session; each is also refused with no session, so these say what stops them.
    ('change a view of a member''s', format($q$SELECT public.change_saved_view(%L, '{}'::jsonb, '{}'::jsonb, '[]'::jsonb)$q$, v), 'PT404: That view isn''t available'),
    ('rename a view of a member''s', format($q$SELECT public.rename_saved_view(%L, 'New name')$q$, v), 'PT404: That view isn''t available'),
    ('delete a view of a member''s', format($q$SELECT public.delete_saved_view(%L)$q$, v), 'PT404: That view isn''t available'),
    ('share a view of an owner''s', format($q$SELECT public.share_saved_view(%L)$q$, vo), 'PT404: That view isn''t available'),
    ('stop sharing a view of an owner''s', format($q$SELECT public.unshare_saved_view(%L)$q$, vo), 'PT404: That view isn''t available'),
    ('accept an invitation addressed to someone else', format($q$SELECT public.accept_invitation(%L, 'alpha-brokers')$q$, pg_temp.hash('invite-a')),
      'PT403: This invitation was sent to a different email address than the one you are signed in with'),
    ('add a referral partner without naming a firm', $q$SELECT public.advisor_add_referral_partner('new-code', 'New', 'accounting')$q$, '42501: Not a member of a firm'),
    ('leave a firm they are not in', format($q$SELECT public.leave_firm(%L)$q$, fa), 'PT404: You are not a member of this firm'),
    ('ask to close the firm', format($q$SELECT public.request_firm_closure(%L, 'Alpha Brokers')$q$, fa), '42501: Only an owner of the firm can do that'),
    ('withdraw the request to close the firm', format($q$SELECT public.withdraw_firm_closure(%L)$q$, fa), '42501: Only an owner of the firm can do that');
  RAISE NOTICE 'help_from_nevermore: % write paths listed', (SELECT count(*) FROM writes);
END $$;

DO $$
DECLARE w record; got text; n integer := 0; before jsonb := pg_temp.held(pg_temp.id('alpha'));
BEGIN
  FOR w IN SELECT * FROM writes ORDER BY label LOOP
    PERFORM pg_temp.as_user('platform_admin', 'alpha-brokers');
    got := pg_temp.refusal(w.stmt);
    RESET ROLE;
    PERFORM pg_temp.is(got, w.refusal, 'with a support session: ' || w.label);
    n := n + 1;
  END LOOP;
  PERFORM pg_temp.is(n >= 40, true, 'the list of write paths has not been emptied');
  PERFORM pg_temp.is(pg_temp.held(pg_temp.id('alpha')), before, 'and nothing of the firm''s was changed');
  PERFORM pg_temp.is(pg_temp.held(pg_temp.id('beta'))->>'referral_partners', '1', 'nor of another firm''s');
  RAISE NOTICE 'help_from_nevermore: every write path is refused for a support session';
END $$;

-- The same paths, with no session (admin3, who never started one): refused for ordinary reasons, and never with the
-- support message, so that message means a session and nothing else. The one thing that is not refused, asking to join, changes nothing.
DO $$
DECLARE w record; got text; before jsonb := pg_temp.held(pg_temp.id('alpha'));
BEGIN
  FOR w IN SELECT * FROM writes ORDER BY label LOOP
    PERFORM pg_temp.as_user('admin3', 'alpha-brokers');
    got := pg_temp.refusal(w.stmt);
    RESET ROLE;
    PERFORM pg_temp.is(got NOT LIKE '%support can look%', true, 'with no session the support message is not the answer: ' || w.label);
    -- Retrying a send or a deletion answers false, and changes nothing (held, below), for one of a firm the caller is not in.
    PERFORM pg_temp.is(got <> 'ok' OR w.label IN ('retry a send', 'retry an intake''s deletion'), true, 'and the path is still closed to an admin who is no member: ' || w.label);
  END LOOP;
  PERFORM pg_temp.is(pg_temp.held(pg_temp.id('alpha')), before, 'and nothing changed');
  PERFORM pg_temp.as_user('platform_admin', 'alpha-brokers');
  PERFORM pg_temp.is(pg_temp.refusal($q$SELECT public.ask_to_join_firm('alpha-brokers')$q$), 'ok', 'asking to join answers (it never lets a platform admin ask, D-110)');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.join_requests WHERE user_id = pg_temp.id('platform_admin')), 0::bigint, 'and records no request');
  RAISE NOTICE 'help_from_nevermore: the support message means a session';
END $$;

-- The notes trigger, the manuscripts' two storage policies and the three buckets' reads. Break caught: a support session stores or removes a
-- generated file; reads a document, a packet or a PEO's attachment (a downloaded file leaves the product and the hour); a member can no
-- longer read their own firm's files, or the notes trigger stops a member's own note.
DO $$
DECLARE s uuid := pg_temp.id('intake_a'); doc text; m text := current_setting('test.message_a');
BEGIN
  RESET ROLE;
  doc := pg_temp.id('prospect_a') || '/' || s || '/census.pdf';
  INSERT INTO storage.objects (bucket_id, name) VALUES ('manuscripts', s || '/unrecorded.pdf');
  PERFORM pg_temp.as_user('agent_a', 'alpha-brokers');
  PERFORM pg_temp.is((SELECT count(*) FROM storage.objects WHERE bucket_id = 'documents' AND name = doc), 1::bigint, 'a member reads the firm''s document file');
  PERFORM pg_temp.is((SELECT count(*) FROM storage.objects WHERE bucket_id = 'manuscripts' AND name = s || '/v1.pdf'), 1::bigint, 'and its packet');
  PERFORM pg_temp.is((SELECT count(*) FROM storage.objects WHERE bucket_id = 'peo-mail'), 1::bigint, 'and a PEO''s attachment');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.advisor_notes (session_id, author_id, body) VALUES (%L, %L, 'hi')$q$, s, pg_temp.id('agent_a'))), 'rows:1', 'and writes a note');
  PERFORM pg_temp.as_user('platform_admin', 'alpha-brokers');
  PERFORM pg_temp.is((SELECT count(*) FROM storage.objects WHERE bucket_id = 'documents'), 0::bigint, 'a support session reads no document file');
  PERFORM pg_temp.is((SELECT count(*) FROM storage.objects WHERE bucket_id = 'manuscripts'), 0::bigint, 'no packet');
  PERFORM pg_temp.is((SELECT count(*) FROM storage.objects WHERE bucket_id = 'peo-mail'), 0::bigint, 'no PEO attachment');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quote_request_message_attachments), 1::bigint, 'though it reads that an attachment is there (the row)');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO storage.objects (bucket_id, name) VALUES ('manuscripts', %L)$q$, s || '/new.pdf')), '42501', 'it cannot store a generated file');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$DELETE FROM storage.objects WHERE bucket_id = 'manuscripts' AND name = %L$q$, s || '/unrecorded.pdf')), 'rows:0', 'nor remove an unrecorded one');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$DELETE FROM storage.objects WHERE bucket_id = 'documents' AND name = %L$q$, doc)), 'rows:0', 'nor a document file');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM storage.objects WHERE bucket_id = 'manuscripts' AND name = s || '/unrecorded.pdf'), 1::bigint, 'it is still there');
  RAISE NOTICE 'help_from_nevermore: files passed';
END $$;

-- The paths that are exempt from the closing guard because they are a person's own or the platform's (supabase/tests/close_a_firm.sql),
-- each looked at again for a support session: none of them lets one change a firm's data.
-- Break caught: the "employer's own intake" or "the person's own profile" exemption lets a support session change someone else's row; a
-- thread opened by support marks it read with the admin's email, which the firm's members would then read (D-33).
DO $$
DECLARE s uuid := pg_temp.id('intake_a'); q bigint := current_setting('test.quote_a')::bigint; before bigint;
BEGIN
  PERFORM pg_temp.as_user('platform_admin', 'alpha-brokers');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.chamber_sessions SET chamber_data = '{"x":1}' WHERE id = %L$q$, s)), 'rows:0', 'support cannot update a prospect''s intake: the "own intake" rule is the prospect''s');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.archive_chamber_session(%L)$q$, s)), 'PT404', 'or archive it');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path) VALUES (%L, %L, 'x', '1', 'p')$q$, pg_temp.id('prospect_a'), s)), '42501', 'or add a document to it');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.documents SET file_name = 'x' WHERE session_id = %L$q$, s)), 'rows:0', 'or change one');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$DELETE FROM public.documents WHERE session_id = %L$q$, s)), 'rows:0', 'or delete one');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.profiles (user_id, company_name) VALUES (%L, 'Probe')$q$, pg_temp.id('prospect_a'))), '42501', 'or write a prospect''s profile');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.profiles SET company_name = 'Probe' WHERE user_id = %L$q$, pg_temp.id('prospect_a'))), 'rows:0', 'or change one');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.record_intake_consent(public.intake_consent_version(), 'I agree.')$q$)), 'rows:1', 'its own consent is its own (and an admin has no intake of this firm)');
  RESET ROLE;
  before := (SELECT count(*) FROM public.quote_request_thread_reads);
  PERFORM pg_temp.as_user('agent_a', 'alpha-brokers');
  PERFORM public.advisor_open_quote_request_thread(q);
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.quote_request_thread_reads), before + 1, 'a member opening a thread marks it read, as before');
  DELETE FROM public.quote_request_thread_reads;
  PERFORM pg_temp.as_user('platform_admin', 'alpha-brokers');
  PERFORM pg_temp.is(public.advisor_open_quote_request_thread(q), '{}'::jsonb, 'a support session opens the thread and marks nothing');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quote_requests WHERE id = q), 1::bigint, 'and reads it');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.quote_request_thread_reads), 0::bigint, 'no read mark exists, so no admin email is left for the firm');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quote_request_thread_reads WHERE last_opened_by_email LIKE '%platform_admin%'), 0::bigint, 'in particular');
  RAISE NOTICE 'help_from_nevermore: the exemptions were re-examined';
END $$;

-- ---------- nothing is sent as anyone ----------
-- Break caught: a support session reads a member's mailbox token or connects one, or the mailbox function is handed the admin as a firm's
-- member (its door is the caller's own membership, so an admin with no membership must get nothing); a send path other than the ones in
-- the list above exists for a support session (each of them is a guarded write, refused there: recording a send, retrying one, asking the
-- prospect, invitations).
DO $$
DECLARE admin uuid := pg_temp.id('platform_admin');
BEGIN
  PERFORM pg_temp.as_user('platform_admin', 'alpha-brokers');
  PERFORM pg_temp.is((SELECT count(*) FROM public.my_firms()), 0::bigint, 'the mailbox function asks my_firms: a support session is in no firm there, so it can''t be handed a firm''s sending');
  RESET ROLE;
  PERFORM pg_temp.is(public.person_is_member_of_a_firm_in_good_standing(admin), false, 'the admin is no member of a firm in good standing');
  SET LOCAL ROLE service_role;
  PERFORM pg_temp.is(public.mailbox_secret(admin) IS NULL, true, 'so the mailbox function reads no token for them, though a mailbox row exists in their name');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.mailbox_store(%L, 'google', 'x@example.test', 'gmail.send', 'c', 'i')$q$, admin)), '42501: Only a member of a firm can connect a mailbox', 'and no mailbox can be connected for them');
  PERFORM pg_temp.is(public.mailbox_secret(pg_temp.id('agent_a')) IS NOT NULL, true, 'while a member''s is read for the member (the mailbox function does that with the service key)');
  RESET ROLE;
  RAISE NOTICE 'help_from_nevermore: sending passed';
END $$;

-- ---------- nothing is exported ----------
-- Break caught: the refusal an export calls does not refuse a support session, or refuses someone else, or lets a NULL firm through (a
-- call that names no firm must refuse anyone who holds ANY open session, so a function that passes NULL fails closed); a function with
-- "export" in its name that a support session can run (CRM-S3.8b must call refuse_support_session(firm) first: ADR 0024, BROKER_CRM_BUILD.md
-- D-24); the detector itself goes soft again (it once only looked for the helper's name in the text, which a call with NULL passes).
--
-- The detector: every function the API roles can run whose name contains "export" is CALLED as the support session at that firm's address,
-- with fixture arguments (a uuid is the firm's id, text is 'x', numbers 1 ...) and must raise PT423. Only a function whose arguments cannot
-- be guessed (an array, a row type) falls back to its text, which must call the helper with an argument that is not NULL. A call with a
-- literal NULL is refused in the text too: it tells the helper nothing about which firm, so it only works while the caller has a session.
CREATE FUNCTION pg_temp.export_functions_that_do_not_refuse(firm uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE p record; args text; guessable boolean; got text; bad text[] := '{}';
BEGIN
  FOR p IN
    SELECT f.oid, f.proname, f.prosrc, f.proargtypes::oid[] AS types
    FROM pg_proc f
    WHERE f.pronamespace = 'public'::regnamespace AND f.prokind = 'f' AND f.proname LIKE '%export%'
      AND (has_function_privilege('authenticated', f.oid, 'EXECUTE') OR has_function_privilege('anon', f.oid, 'EXECUTE'))
    ORDER BY f.proname
  LOOP
    SELECT string_agg(CASE t.typname WHEN 'uuid' THEN format('%L::uuid', firm) WHEN 'text' THEN '''x''' WHEN 'varchar' THEN '''x''' WHEN 'int4' THEN '1' WHEN 'int8' THEN '1'
                   WHEN 'bool' THEN 'false' WHEN 'jsonb' THEN '''{}''::jsonb' WHEN 'timestamptz' THEN 'now()' WHEN 'date' THEN 'current_date' END, ', ' ORDER BY a.n),
           COALESCE(bool_and(t.typname IN ('uuid', 'text', 'varchar', 'int4', 'int8', 'bool', 'jsonb', 'timestamptz', 'date')), true)
      INTO args, guessable
    FROM unnest(p.types) WITH ORDINALITY a(oid, n) JOIN pg_type t ON t.oid = a.oid;
    IF guessable THEN
      got := pg_temp.refusal(format('SELECT public.%I(%s)', p.proname, COALESCE(args, '')));
      IF got NOT LIKE 'PT423:%' THEN bad := bad || (p.proname || ' (' || left(got, 40) || ')'); END IF;
    ELSIF p.prosrc !~* 'refuse_support_session\(\s*[^)[:space:]]' THEN
      bad := bad || (p.proname || ' (never calls the refusal)');
    END IF;
    IF p.prosrc ~* 'refuse_support_session\(\s*null\M' THEN bad := bad || (p.proname || ' (calls the refusal with NULL)'); END IF;
  END LOOP;
  RETURN array_to_string(bad, ', ');
END $$;
DO $$
DECLARE fa uuid := pg_temp.id('alpha');
BEGIN
  PERFORM pg_temp.as_user('platform_admin', 'alpha-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.refuse_support_session(%L)$q$, fa)), 'PT423: Nevermore support can look, not change', 'the refusal an export calls refuses a support session');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.refuse_support_session(%L)$q$, pg_temp.id('zeta'))), 'ok', 'only for the firm it holds a session for');
  PERFORM pg_temp.is(pg_temp.refusal('SELECT public.refuse_support_session(NULL)'), 'PT423: Nevermore support can look, not change', 'and a NULL refuses a caller who holds any open session, so passing NULL fails closed');
  PERFORM pg_temp.as_user('owner_a', 'alpha-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.refuse_support_session(%L)$q$, fa)), 'ok', 'and none for an owner');
  PERFORM pg_temp.is(pg_temp.refusal('SELECT public.refuse_support_session(NULL)'), 'ok', 'nor a NULL for an owner');
  PERFORM pg_temp.as_user('agent_a', 'alpha-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.refuse_support_session(%L)$q$, fa)), 'ok', 'nor an agent');
  PERFORM pg_temp.as_user('admin3', 'alpha-brokers');
  PERFORM pg_temp.is(pg_temp.refusal('SELECT public.refuse_support_session(NULL)'), 'ok', 'nor a NULL for an admin who holds no session');
  PERFORM pg_temp.as_user('platform_admin', 'alpha-brokers');
  PERFORM pg_temp.is(pg_temp.export_functions_that_do_not_refuse(fa), '', 'every export function refuses a support session (there are none yet)');
  -- The detector finds the ones that do not, and passes the one that does.
  RESET ROLE;
  CREATE FUNCTION public.export_never_refuses(p_firm uuid) RETURNS integer LANGUAGE sql AS 'SELECT 1';
  CREATE FUNCTION public.export_refuses_nobody(p_firm uuid) RETURNS integer LANGUAGE plpgsql AS 'BEGIN PERFORM public.refuse_support_session(NULL); RETURN 1; END';
  CREATE FUNCTION public.firm_data_export_ok(p_firm uuid) RETURNS integer LANGUAGE plpgsql AS 'BEGIN PERFORM public.refuse_support_session(p_firm); RETURN 1; END';
  CREATE FUNCTION public.export_odd_arguments(p_firms uuid[]) RETURNS integer LANGUAGE plpgsql AS 'BEGIN PERFORM public.refuse_support_session(p_firms[1]); RETURN 1; END';
  CREATE FUNCTION public.export_odd_never(p_firms uuid[]) RETURNS integer LANGUAGE sql AS 'SELECT 1';
  GRANT EXECUTE ON FUNCTION public.export_never_refuses(uuid), public.export_refuses_nobody(uuid), public.firm_data_export_ok(uuid), public.export_odd_arguments(uuid[]), public.export_odd_never(uuid[]) TO authenticated;
  PERFORM pg_temp.as_user('platform_admin', 'alpha-brokers');
  PERFORM pg_temp.is(pg_temp.export_functions_that_do_not_refuse(fa),
    'export_never_refuses (ok), export_odd_never (never calls the refusal), export_refuses_nobody (calls the refusal with NULL)',
    'a function that never calls the refusal and one that calls it with NULL are found, wherever "export" is in the name; one that does call it, by call or by text, is not');
  RESET ROLE;
  DROP FUNCTION public.export_never_refuses(uuid), public.export_refuses_nobody(uuid), public.firm_data_export_ok(uuid), public.export_odd_arguments(uuid[]), public.export_odd_never(uuid[]);
  RAISE NOTICE 'help_from_nevermore: exports passed';
END $$;

-- ---------- ending, running out, and the firm ending ----------
-- Break caught: a session goes on after the admin ends it, after the hour, or after the firm is closed or refused; ending is not written to
-- the firm's record or is written twice; another admin ends someone's session; a session that ran out and was never looked at blocks the
-- admin's next one; a session is recorded as ended at the time someone looked and not at its end; a suspended firm cannot be looked at.
DO $$
DECLARE fa uuid := pg_temp.id('alpha'); sess uuid := current_setting('test.session_a')::uuid; before bigint;
BEGIN
  PERFORM pg_temp.as_user('admin2');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.end_support_session(%L)$q$, sess)), 'PT404: Support session not found', 'an admin cannot end another admin''s session');
  PERFORM pg_temp.as_user('agent_a');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.end_support_session(%L)$q$, sess)), '42501: Admin access required', 'nor can anyone else');
  RESET ROLE;
  before := (SELECT count(*) FROM public.firm_activity WHERE firm_id = fa AND record_type = 'support_session_end');
  PERFORM pg_temp.as_user('platform_admin', 'alpha-brokers');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_sessions), 2::bigint, 'before ending, the session reads');
  PERFORM public.end_support_session(sess);
  PERFORM pg_temp.is(public.firm_role(fa), NULL::text, 'the moment it is ended the role is gone');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_sessions), 0::bigint, 'and so is every row');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.end_support_session(%L)$q$, sess)), 'ok', 'ending it again is not an error');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE firm_id = fa AND record_type = 'support_session_end'), before + 1, 'and writes one entry, not two');
  PERFORM pg_temp.is((SELECT ended_how FROM public.support_sessions WHERE id = sess), 'ended', 'the platform''s record says it was ended');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE firm_id = fa AND record_type = 'support_session_end' AND record_id = sess::text AND actor_is_staff AND kind = 'support_access'), 1::bigint,
    'the end is in the firm''s record as Nevermore''s');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is((SELECT count(*) FROM public.my_support_session_here()), 0::bigint, 'on the bare domain the page is told nothing');
  PERFORM pg_temp.as_user('agent_a', 'alpha-brokers');
  PERFORM pg_temp.is((SELECT count(*) FROM public.my_support_session_here()), 0::bigint, 'and a member who is no platform admin is told nothing either');
  PERFORM pg_temp.as_password_user_without_second_factor('platform_admin', 'alpha-brokers');
  PERFORM pg_temp.is((SELECT s.second_factor_pending FROM public.my_support_session_here() s), true, 'a password sign-in that owes its second step is told so, so the page sends it there');
  PERFORM pg_temp.is(public.firm_role(fa), NULL::text, 'and the session grants it nothing until that step is done');
  PERFORM pg_temp.as_user('platform_admin', 'alpha-brokers');
  PERFORM pg_temp.is((SELECT s.is_open FROM public.my_support_session_here() s), false, 'at the address it is told the session is over');
  PERFORM public.start_support_session(fa, 'again, after ending');
  PERFORM pg_temp.is(public.firm_role(fa), 'support', 'and the admin can start another');
  RESET ROLE;
  RAISE NOTICE 'help_from_nevermore: ending passed';
END $$;

DO $$
DECLARE fa uuid := pg_temp.id('alpha'); fs uuid := pg_temp.id('sigma'); fo uuid := pg_temp.id('omega'); fz uuid := pg_temp.id('zeta'); sid uuid; ended record; n integer; ends timestamptz;
BEGIN
  -- Running out: the hour passes for admin2's session on alpha, and nobody looks at it.
  RESET ROLE;
  SELECT id INTO sid FROM public.support_sessions WHERE admin_id = pg_temp.id('admin2') AND firm_id = fa AND ended_at IS NULL;
  UPDATE public.support_sessions SET started_at = now() - interval '2 hours', ends_at = now() - interval '1 hour' WHERE id = sid;
  PERFORM pg_temp.as_user('admin2', 'alpha-brokers');
  PERFORM pg_temp.is(public.firm_role(fa), NULL::text, 'a session that has run out gives no role, though nothing has recorded it');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_sessions), 0::bigint, 'and reads nothing: it stops by itself');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.advisor_add_referral_partner('x', 'X', 'accounting', %L)$q$, fa)), '42501: Not a member of that firm', 'and a write is refused as it is for any admin who is no member');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.firm_support_sessions(%L)$q$, fa)), '42501: Only a firm''s owners can read its record', 'and it no longer reads the firm''s record of uses');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT ended_at FROM public.support_sessions WHERE id = sid), NULL::timestamptz, 'nobody has recorded its end yet');
  ends := (SELECT s.ends_at FROM public.support_sessions s WHERE s.id = sid);
  PERFORM pg_temp.as_user('owner_a', 'alpha-brokers');
  PERFORM pg_temp.is((SELECT x.ended_at FROM public.firm_support_sessions(fa) x WHERE x.session_id = sid), ends, 'the owners are already told it ended, at its end time');
  -- Seeing it records it, at its end time and not the time someone looked.
  PERFORM pg_temp.as_user('admin2', 'alpha-brokers');
  PERFORM pg_temp.is((SELECT s.is_open FROM public.my_support_session_here() s), false, 'the admin''s page is told the hour has ended');
  RESET ROLE;
  SELECT * INTO ended FROM public.support_sessions WHERE id = sid;
  PERFORM pg_temp.is(ended.ended_how, 'ran_out', 'looking recorded it as run out');
  PERFORM pg_temp.is(ended.ended_at, ended.ends_at, 'at its end time');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE record_type = 'support_session_end' AND record_id = sid::text AND at = ended.ends_at AND actor_is_staff), 1::bigint,
    'one entry in the firm''s record, at its end time, as Nevermore''s');
  PERFORM pg_temp.as_user('admin2', 'alpha-brokers');
  PERFORM pg_temp.is((SELECT s.is_open FROM public.my_support_session_here() s), false, 'looking again records nothing more');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE record_type = 'support_session_end' AND record_id = sid::text), 1::bigint, 'one entry only');

  -- A session that ran out and was never looked at does not block the next: starting records it first.
  SELECT id INTO sid FROM public.support_sessions WHERE admin_id = pg_temp.id('admin2') AND firm_id = fs AND ended_at IS NULL;
  UPDATE public.support_sessions SET started_at = now() - interval '3 hours', ends_at = now() - interval '2 hours' WHERE id = sid;
  PERFORM pg_temp.as_user('admin2');
  PERFORM public.start_support_session(fs, 'a second look');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.support_sessions WHERE admin_id = pg_temp.id('admin2') AND firm_id = fs AND ended_at IS NULL), 1::bigint, 'an admin starts a new session over one that ran out unrecorded');
  PERFORM pg_temp.is((SELECT ended_how FROM public.support_sessions WHERE id = sid), 'ran_out', 'which was recorded as having run out');
  -- A suspended firm: the session reads (that is what it is for) and still changes nothing. The firm's own members are told nothing.
  PERFORM pg_temp.as_user('admin2', 'sigma-suspended');
  PERFORM pg_temp.is(public.firm_role(fs), 'support', 'a suspended firm can be looked at');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firms), 1::bigint, 'it reads the firm');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.advisor_add_referral_partner('x', 'X', 'accounting', %L)$q$, fs)), 'PT423: Nevermore support can look, not change', 'and changes nothing');
  PERFORM pg_temp.as_user('owner_s', 'sigma-suspended');
  PERFORM pg_temp.is(public.firm_role(fs), NULL::text, 'while the firm''s own owner still reads nothing of it');
  RESET ROLE;

  -- The daily job records what nobody looked at, for every admin.
  SELECT id INTO sid FROM public.support_sessions WHERE admin_id = pg_temp.id('admin2') AND firm_id = fo AND ended_at IS NULL;
  UPDATE public.support_sessions SET started_at = now() - interval '5 hours', ends_at = now() - interval '4 hours' WHERE id = sid;
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.settle_support_sessions()$q$), '42501', 'nobody signed in as a person runs the daily job');
  RESET ROLE;
  SET LOCAL ROLE service_role;
  n := public.settle_support_sessions();
  RESET ROLE;
  PERFORM pg_temp.is(n, 1::integer, 'the daily job records the one that ran out');
  PERFORM pg_temp.is((SELECT ended_how FROM public.support_sessions WHERE id = sid), 'ran_out', 'as run out');
  SET LOCAL ROLE service_role;
  PERFORM pg_temp.is(public.settle_support_sessions(), 0::integer, 'and a second run finds nothing to do');
  RESET ROLE;

  -- The firm ends: closed, or refused. The session stops working then, and is recorded as ended by the firm.
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.start_support_session(fz, 'looking at zeta');
  PERFORM public.start_support_session(fo, 'looking at omega');
  PERFORM pg_temp.as_user('platform_admin', 'zeta-zone');
  PERFORM pg_temp.is(public.firm_role(fz), 'support', 'a session on a firm that is open');
  RESET ROLE;
  INSERT INTO public.firm_closures (firm_id, asked_at, closes_at, closed_at, deleted_counts) VALUES (fz, now() - interval '40 days', now() - interval '10 days', now(), '{}');
  UPDATE public.firms SET decision = 'refused', decided_at = now() WHERE id = fo;
  PERFORM pg_temp.as_user('platform_admin', 'zeta-zone');
  PERFORM pg_temp.is(public.firm_role(fz), NULL::text, 'stops the moment the firm is closed');
  PERFORM pg_temp.as_user('platform_admin', 'omega-partners');
  PERFORM pg_temp.is(public.firm_role(fo), NULL::text, 'and the moment it is refused');
  PERFORM pg_temp.is((SELECT count(*) FROM public.my_support_session_here()), 0::bigint, 'the address of a closed or refused firm is no firm''s, so the page is told nothing');
  RESET ROLE;
  SET LOCAL ROLE service_role;
  PERFORM public.settle_support_sessions();
  RESET ROLE;
  PERFORM pg_temp.is((SELECT string_agg(ended_how, ',' ORDER BY firm_id::text) FROM public.support_sessions WHERE admin_id = pg_temp.id('platform_admin') AND firm_id IN (fz, fo)), 'firm_ended,firm_ended', 'both are recorded as ended by the firm');
  RAISE NOTICE 'help_from_nevermore: running out and the firm ending passed';
END $$;

-- ---------- the firm's record, the platform's page and the monitoring (D-33) ----------
-- Break caught: the firm learns who at Nevermore looked (a name, an email or an id anywhere any reading function returns: the list, the
-- person filter, the people, the sessions); the reason is not shown to the owners, or is shown to a member who is not an owner; a use is
-- missing from the record or from the platform's own table; the admin's own opening of a submission is not in the record; the platform
-- page is readable by anyone but a platform admin; the monitoring table does not hear of a start.
DO $$
DECLARE fa uuid := pg_temp.id('alpha'); admin uuid := pg_temp.id('platform_admin'); admin2 uuid := pg_temp.id('admin2'); everything text; r record;
BEGIN
  -- The admin opens a submission, as support does.
  PERFORM pg_temp.as_user('platform_admin', 'alpha-brokers');
  PERFORM pg_temp.is((SELECT count(*) FROM public.open_submission(pg_temp.id('intake_a'))), 1::bigint, 'support opens a submission');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE firm_id = fa AND kind = 'submission_viewed' AND actor_id = admin AND actor_is_staff), 1::bigint,
    'which the firm''s record holds as Nevermore''s');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE firm_id = fa AND record_type = 'support_session' AND kind = 'support_access' AND actor_is_staff), 3::bigint, 'three uses of support on alpha are in its record');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE firm_id = fa AND record_type = 'support_session_end' AND kind = 'support_access' AND actor_is_staff), 2::bigint, 'and two endings');
  PERFORM pg_temp.is((SELECT count(*) FROM public.ops_events WHERE kind = 'support_access' AND code = 'started'), 9::bigint, 'the monitoring table has every start, for all firms (9)');
  PERFORM pg_temp.is((SELECT count(*) FROM public.support_sessions), 9::bigint, 'and the platform''s table has the same nine, with who and why');

  -- What an owner reads: entries as Nevermore, with the reason, and not one trace of who.
  PERFORM pg_temp.as_user('owner_a', 'alpha-brokers');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity_list(fa, NULL, 'support_access', 50, NULL, NULL, false)), 5::bigint, 'an owner reads the five support entries');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity_list(fa, NULL, 'support_access', 50, NULL, NULL, false) l WHERE l.by_nevermore AND l.actor_id IS NULL AND l.actor_email IS NULL), 5::bigint, 'each as Nevermore, with no id and no email');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity_list(fa, NULL, NULL, 50, NULL, NULL, true) l WHERE l.kind = 'submission_viewed'), 1::bigint, 'the filter "Nevermore" finds what support did');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity_list(fa, admin, NULL, 50, NULL, NULL, false)), 0::bigint, 'and filtering by the admin''s id finds nothing: no id works as a person');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity_people(fa) p WHERE p.is_nevermore), 1::bigint, 'the people are one entry for Nevermore');
  PERFORM pg_temp.is((SELECT string_agg(x.reason, '|' ORDER BY x.started_at) FROM public.firm_support_sessions(fa) x), 'my own look|Customer asked for help with a stuck quote|again, after ending',
    'the owners read the reason each use was given, written for them');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_support_sessions(fa) x WHERE x.ended_at IS NULL), 1::bigint, 'and which one is still open');
  everything := COALESCE((SELECT string_agg(l::text, ' ') FROM public.firm_activity_list(fa, NULL, NULL, 100, NULL, NULL, false) l), '')
    || COALESCE((SELECT string_agg(p::text, ' ') FROM public.firm_activity_people(fa) p), '')
    || COALESCE((SELECT string_agg(x::text, ' ') FROM public.firm_support_sessions(fa) x), '')
    || COALESCE((SELECT string_agg(m::text, ' ') FROM public.firm_members(fa) m), '')
    || COALESCE((SELECT string_agg(f.name || f.address, ' ') FROM public.firms f), '')
    || COALESCE((SELECT string_agg(t::text, ' ') FROM public.quote_request_thread_reads t), '');
  PERFORM pg_temp.is(length(everything) > 500, true, 'and there is a good deal of it to check');
  RESET ROLE;
  PERFORM pg_temp.is(everything LIKE '%platform_admin%' OR everything LIKE '%admin2%' OR everything LIKE '%' || admin::text || '%' OR everything LIKE '%' || admin2::text || '%', false,
    'nothing an owner can read names either admin: no email, no id');
  PERFORM pg_temp.as_user('agent_a', 'alpha-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.firm_support_sessions(%L)$q$, fa)), '42501: Only a firm''s owners can read its record', 'a member who is not an owner does not read the reasons');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT entry_key FROM public.firm_activity'), 'rows:0', 'nor the record');
  PERFORM pg_temp.as_user('owner_b', 'beta-benefits');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.firm_support_sessions(%L)$q$, fa)), '42501: Only a firm''s owners can read its record', 'another firm''s owner reads nothing of alpha''s');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_support_sessions(pg_temp.id('beta'))), 1::bigint, 'and reads their own firm''s');

  -- The platform's page.
  PERFORM pg_temp.as_user('agent_a');
  PERFORM pg_temp.is(pg_temp.refusal($q$SELECT * FROM public.admin_support_sessions()$q$), '42501: Admin access required', 'no member reads the platform''s page');
  PERFORM pg_temp.as_user('owner_a');
  PERFORM pg_temp.is(pg_temp.refusal($q$SELECT * FROM public.admin_support_sessions()$q$), '42501: Admin access required', 'not even an owner');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is((SELECT count(*) FROM public.admin_support_sessions()), 9::bigint, 'an admin reads every session');
  PERFORM pg_temp.is((SELECT s.is_open FROM public.admin_support_sessions() s ORDER BY (NOT s.is_open), s.started_at LIMIT 1), true, 'open ones first');
  PERFORM pg_temp.is((SELECT count(*) FROM public.admin_support_sessions() s WHERE s.is_mine), 5::bigint, 'with which are their own (alpha twice, beta, zeta, omega)');
  PERFORM pg_temp.is((SELECT count(*) FROM public.admin_support_sessions() s WHERE s.admin_email = 'admin2@example.test' AND NOT s.is_mine), 4::bigint, 'and whose are another''s');
  RESET ROLE;
  RAISE NOTICE 'help_from_nevermore: the record passed';
END $$;

-- ---------- the daily job records what ran out ----------
-- Break caught: the sessions that ran out are recorded only when somebody happens to look; or the step is a second scheduler beside the
-- firm record's daily job, or it replaced a step the job already had.
DO $$
BEGIN
  PERFORM pg_temp.is((SELECT command FROM cron.job WHERE jobname = 'prune-firm-activity'),
    'select public.prune_firm_activity(); select public.prune_firm_outbox_events(); select public.close_due_firms(); select public.settle_support_sessions();',
    'the firm record''s daily job also records the support sessions that ran out, and kept its other steps');
  PERFORM pg_temp.is((SELECT count(*) FROM cron.job), 1::bigint, 'and no second job was made');
  RAISE NOTICE 'help_from_nevermore: the daily job passed';
END $$;

-- ---------- support sees a firm's records as an owner does ----------
-- Break caught: can_see_firm_record gives 'support' less than an owner (once leads and accounts use it, the default visibility 'by_level'
-- would show support none of them); or gives it more (a record at another firm's address, or with no session); or the fix widens what an
-- agent or a lead sees. Cases: owner, lead (in no team), agent and support, a record owned by another agent, one the caller owns and one
-- nobody owns, at both settings of the firm's visibility.
DO $$
DECLARE
  fa uuid := pg_temp.id('alpha');
  who text; vis text; r boolean; want boolean;
  cases text[][] := ARRAY[
    -- who, visibility, record owner, expected
    ['owner_a', 'by_level', 'agent_a', 't'], ['owner_a', 'everyone', 'agent_a', 't'], ['owner_a', 'by_level', 'nobody', 't'],
    ['lead_v', 'by_level', 'agent_a', 'f'], ['lead_v', 'everyone', 'agent_a', 't'], ['lead_v', 'by_level', 'lead_v', 't'],
    ['agent_v', 'by_level', 'agent_a', 'f'], ['agent_v', 'everyone', 'agent_a', 't'], ['agent_v', 'by_level', 'agent_v', 't'],
    ['agent_v', 'by_level', 'nobody', 'f'],
    ['platform_admin', 'by_level', 'agent_a', 't'], ['platform_admin', 'everyone', 'agent_a', 't'], ['platform_admin', 'by_level', 'nobody', 't'],
    ['platform_admin', 'by_level', 'platform_admin', 't']];
  i integer;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.new_user('lead_v');
  PERFORM pg_temp.new_user('agent_v');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (fa, pg_temp.id('lead_v'), 'lead'), (fa, pg_temp.id('agent_v'), 'agent');
  FOR i IN 1 .. array_length(cases, 1) LOOP
    who := cases[i][1]; vis := cases[i][2]; want := cases[i][4] = 't';
    RESET ROLE;
    UPDATE public.firms SET visibility = vis WHERE id = fa;
    PERFORM pg_temp.as_user(who, 'alpha-brokers');
    r := public.can_see_firm_record(fa, CASE cases[i][3] WHEN 'nobody' THEN NULL ELSE pg_temp.id(cases[i][3]) END);
    PERFORM pg_temp.is(r, want, format('%s sees a record owned by %s at visibility %s', who, cases[i][3], vis));
  END LOOP;
  -- Not wider than the session: another firm's address, and no session at all.
  PERFORM pg_temp.as_user('platform_admin', 'beta-benefits');
  PERFORM pg_temp.is(public.can_see_firm_record(fa, pg_temp.id('agent_a')), false, 'a session at another firm''s address sees no record of this one');
  PERFORM pg_temp.as_user('admin3', 'alpha-brokers');
  PERFORM pg_temp.is(public.can_see_firm_record(fa, pg_temp.id('agent_a')), false, 'an admin with no session sees none');
  RESET ROLE;
  UPDATE public.firms SET visibility = 'by_level' WHERE id = fa;
  RAISE NOTICE 'help_from_nevermore: records passed';
END $$;

-- ---------- becoming a member ends the session ----------
-- Break caught: an admin who accepts an invitation to the firm during their own open session, or whom an owner approves from a request to join,
-- holds 'owner' (or the role given) but every write is refused for the rest of the hour, because the guard refuses an open session first; the
-- session is not recorded as ended, or not in the firm's record, or ends someone else's session, or one at another firm.
DO $$
DECLARE
  fa uuid := pg_temp.id('alpha'); fb uuid := pg_temp.id('beta'); s_a uuid; s_b uuid; s_other uuid; req uuid; ended_before bigint;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.new_user('admin_inv');
  PERFORM pg_temp.new_user('admin_req');
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('admin_inv'), 'admin'), (pg_temp.id('admin_req'), 'admin');
  INSERT INTO public.firm_invitations (firm_id, email, role, token_hash, expires_at) VALUES (fa, 'admin_inv@example.test', 'owner', pg_temp.hash('invite-admin'), now() + interval '7 days');
  PERFORM pg_temp.as_user('admin_inv');
  SELECT x.session_id INTO s_a FROM public.start_support_session(fa, 'looking before joining') x;
  SELECT x.session_id INTO s_other FROM public.start_support_session(fb, 'and at another firm') x;
  PERFORM pg_temp.as_user('admin_inv', 'alpha-brokers');
  PERFORM pg_temp.is(public.firm_role(fa), 'support', 'before accepting, the admin reads as support');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.start_support_session(%L, 'again')$q$, fa)), 'PT409: You already have support access open for that firm', 'with a session open');
  RESET ROLE;
  ended_before := (SELECT count(*) FROM public.firm_activity WHERE firm_id = fa AND record_type = 'support_session_end');
  PERFORM pg_temp.as_user('admin_inv', 'alpha-brokers');
  PERFORM public.accept_invitation(pg_temp.hash('invite-admin'), 'alpha-brokers');
  PERFORM pg_temp.is(public.firm_role(fa), 'owner', 'accepting makes them an owner');
  PERFORM pg_temp.is(public.is_support_session(fa), false, 'and the session is over in the same moment');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.advisor_add_referral_partner('joined', 'Joined', 'accounting', %L)$q$, fa)), 'ok', 'so a write is not refused for the rest of the hour');
  PERFORM pg_temp.is(public.is_support_session(fb), true, 'while the session at another firm is untouched');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT ended_how FROM public.support_sessions WHERE id = s_a), 'became_member', 'the platform''s record says why it ended: they became a member');
  PERFORM pg_temp.is((SELECT ended_at IS NOT NULL FROM public.support_sessions WHERE id = s_a), true, 'with the time');
  PERFORM pg_temp.is((SELECT ended_at IS NULL FROM public.support_sessions WHERE id = s_other), true, 'and the other firm''s session stays open');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE firm_id = fa AND record_type = 'support_session_end' AND record_id = s_a::text AND actor_is_staff AND kind = 'support_access'), 1::bigint,
    'the end is in the firm''s record as Nevermore''s, once');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE firm_id = fa AND record_type = 'support_session_end'), ended_before + 1, 'and nothing else was written');
  -- An owner approves an admin's request to join, during that admin's own session.
  PERFORM pg_temp.as_user('admin_req');
  SELECT x.session_id INTO s_b FROM public.start_support_session(fa, 'looking before asking') x;
  RESET ROLE;
  INSERT INTO public.join_requests (firm_id, user_id, provider, org_id, org_label) VALUES (fa, pg_temp.id('admin_req'), 'google', 'alpha.example', 'Alpha') RETURNING id INTO req;
  PERFORM pg_temp.as_user('owner_a', 'alpha-brokers');
  PERFORM public.approve_join_request(req, 'agent');
  PERFORM pg_temp.as_user('admin_req', 'alpha-brokers');
  PERFORM pg_temp.is(public.firm_role(fa), 'agent', 'an approved request makes them an agent');
  PERFORM pg_temp.is(public.is_support_session(fa), false, 'and ends their session at the same moment');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.advisor_add_referral_partner('approved', 'Approved', 'accounting', %L)$q$, fa)), 'ok', 'so their writes work');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT ended_how FROM public.support_sessions WHERE id = s_b), 'became_member', 'recorded as ended because they became a member');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE firm_id = fa AND record_type = 'support_session_end' AND record_id = s_b::text), 1::bigint, 'and in the firm''s record once');
  -- Still refused to start one on a firm they belong to.
  PERFORM pg_temp.as_user('admin_req');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.start_support_session(%L, 'now a member')$q$, fa)), '42501: An admin does not use support access on a firm they belong to', 'and a member still cannot start one');
  RESET ROLE;
  RAISE NOTICE 'help_from_nevermore: becoming a member passed';
END $$;

-- ---------- every function and policy that asks a membership helper is classified ----------
-- Break caught: a function or policy that asks who is a member, the caller's role or the firm of a record is added (or restated) and
-- nobody decides whether a support session may use it: it must be listed here as a read (support is let through, and only reads), a write
-- (refused by the one guard), an owner-only action (the role is asked for by name, and support is not 'owner'), or the caller's own or the
-- platform's. A listed write whose source stops asking the guard fails (D-104: a restatement from an older definition drops rules silently).
DO $$
DECLARE
  helpers text[] := ARRAY['firm_role', 'is_firm_member', 'can_see_firm_record', 'can_read_firm_activity', 'can_read_peo_mail', 'colleague_in_my_firm',
    'intake_folder_firm_read_only', 'intake_folder_in_my_firm', 'intake_in_my_firm', 'intake_owner_in_my_firm', 'quote_request_in_my_firm',
    'is_support_session', 'support_reads_firm', 'refuse_support_session'];
  reads text[] := ARRAY['advisor_email_problems', 'advisor_intake_funnel', 'advisor_intake_sources', 'advisor_list_outbox_events', 'advisor_list_submissions',
    'advisor_needs_second_factor', 'advisor_open_quote_request_thread', 'advisor_outbox_summary', 'firm_activity_list', 'firm_activity_people', 'firm_members',
    'firm_support_sessions', 'list_saved_views', 'my_firm_at_address', 'menu_counts', 'my_firm_closure', 'my_mailbox', 'my_table_columns', 'open_submission',
    'queue_list_submissions', 'queue_view_counts', 'record_history_list', 'retention_review_due', 'session_verified_fields'];
  writes text[] := ARRAY['add_firm_organisation', 'advisor_add_quote_request_note', 'advisor_add_referral_partner', 'advisor_correct_quote_request_note',
    'advisor_note_underwriter_question', 'advisor_record_quote_send', 'advisor_reissue_quote_request_address', 'advisor_request_information',
    'advisor_requeue_outbox_event', 'advisor_update_quote_request', 'advisor_update_referral_partner', 'approve_join_request', 'cancel_invitation',
    'change_saved_view', 'decline_join_request', 'delete_saved_view', 'invite_member', 'lift_member_suspension', 'record_manuscript_version',
    'record_member_activity', 'remove_firm_organisation', 'remove_member', 'rename_saved_view', 'request_intake_deletion', 'resend_invitation',
    'retry_intake_deletion', 'review_submission_field', 'revoke_chamber_session', 'save_view', 'set_my_table_columns', 'set_submission_needs_action',
    'set_submission_status', 'share_saved_view', 'suspend_member', 'unshare_saved_view'];
  -- A write that reaches the guard through another function it calls.
  delegates text[] := ARRAY['advisor_note_underwriter_question'];
  owner_only text[] := ARRAY['firm_join_requests', 'firm_organisations', 'firm_pending_invitations', 'request_firm_closure', 'withdraw_firm_closure'];
  own_or_platform text[] := ARRAY['admin_decide_firm', 'ask_to_join_firm', 'leave_firm', 'report_client_event'];
  unplaced text; stale text; lost text; weak text;
BEGIN
  RESET ROLE;
  -- Transitive: a function that calls a function that asks a helper asks it too (record_history_list reaches is_firm_member through
  -- record_history_can_see, which no API role can run, so a source-only scan never saw it).
  WITH RECURSIVE asks (name) AS (
    SELECT p.proname FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
      AND p.prosrc ~ ('\m(' || array_to_string(helpers || ARRAY['firm_to_act_for', 'current_member_firm_ids', 'caller_is_firm_member', 'require_advisor', 'require_intake_in_my_firm'], '|') || ')\M')
    UNION
    SELECT p.proname FROM pg_proc p JOIN asks a ON p.prosrc ~ ('\m' || a.name || '\M')
    WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
  )
  SELECT string_agg(DISTINCT p.proname, ', ' ORDER BY p.proname) INTO unplaced
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
    AND (has_function_privilege('authenticated', p.oid, 'EXECUTE') OR has_function_privilege('anon', p.oid, 'EXECUTE'))
    AND p.proname IN (SELECT name FROM asks)
    AND p.proname <> ALL (helpers || reads || writes || owner_only || own_or_platform);
  PERFORM pg_temp.is(unplaced, NULL::text, 'every function that asks a membership helper is classified (read, write, owner-only, or the caller''s own)');
  SELECT string_agg(k, ', ' ORDER BY k) INTO stale FROM unnest(helpers || reads || writes || owner_only || own_or_platform) k
  WHERE NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = k);
  PERFORM pg_temp.is(stale, NULL::text, 'and the lists name no function that is gone');
  -- Writes: each asks the one guard (or the refusal an export calls), or delegates to a function that does.
  SELECT string_agg(w, ', ' ORDER BY w) INTO lost FROM unnest(writes) w
  WHERE w <> ALL (delegates) AND NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = w
    AND (p.prosrc LIKE '%assert_firm_writable%' OR p.prosrc LIKE '%refuse_support_session%'));
  PERFORM pg_temp.is(lost, NULL::text, 'every write still asks the guard that refuses a support session');
  -- Owner-only: each names the role.
  SELECT string_agg(w, ', ' ORDER BY w) INTO weak FROM unnest(owner_only) w
  WHERE NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = w AND p.prosrc ~ '''owner''');
  PERFORM pg_temp.is(weak, NULL::text, 'every owner-only action still asks for the owner role by name');
  -- Nothing that asks for a role by name lets support in, and nothing hands the value out as one of the three roles.
  PERFORM pg_temp.is((SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prosrc ~ '''support''' AND p.proname NOT IN ('firm_role', 'can_read_firm_activity', 'firm_members', 'can_see_firm_record')), 0::bigint,
    'only firm_role, and the three reads that let it through as an owner does (the firm''s record, its members, and the records an owner sees), say the word support: no other function lists it as a role');

  -- Policies. Every one that asks a helper is a read, except the three that write; the file buckets refuse support.
  SELECT string_agg(p.schemaname || '.' || p.tablename || ' | ' || p.policyname || ' (' || p.cmd || ')', '; ' ORDER BY p.tablename, p.policyname) INTO unplaced
  FROM pg_policies p
  WHERE coalesce(p.qual, '') || coalesce(p.with_check, '') ~ ('\m(' || array_to_string(helpers, '|') || ')\M')
    AND p.cmd <> 'SELECT'
    AND (p.schemaname || '.' || p.tablename || ' | ' || p.policyname) NOT IN (
      'public.advisor_notes | Firm members can add notes as themselves',
      'storage.objects | Firm members can store generated manuscripts',
      'storage.objects | Firm members can remove unrecorded manuscript uploads');
  PERFORM pg_temp.is(unplaced, NULL::text, 'no write policy asks a membership helper except the three that are guarded (the notes trigger, the manuscripts'' two policies)');
  SELECT string_agg(p.policyname, '; ' ORDER BY p.policyname) INTO unplaced
  FROM pg_policies p
  WHERE p.schemaname = 'storage' AND p.tablename = 'objects' AND p.cmd = 'SELECT'
    AND coalesce(p.qual, '') ~ ('\m(' || array_to_string(helpers, '|') || ')\M')
    AND coalesce(p.qual, '') !~ 'intake_folder_in_my_firm|is_support_session';
  PERFORM pg_temp.is(unplaced, NULL::text, 'every file read that asks a membership helper also refuses a support session');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_trigger g WHERE g.tgrelid = 'public.advisor_notes'::regclass AND g.tgname = 'advisor_notes_firm_not_closing' AND NOT g.tgisinternal), 1::bigint,
    'the notes trigger that calls the guard is still there');
  RAISE NOTICE 'help_from_nevermore: everything that asks a helper is classified';
END $$;

-- ---------- a write path nobody thought about, looked at for support ----------
-- Break caught: a later story adds a function that changes data and nobody asks whether a support session may use it; or restates one of the
-- guarded functions below from an older definition and drops the guard. Every function the API roles can run that inserts, updates or
-- deletes is either guarded (its source asks the guard that refuses a support session), or listed as exempt with why a support session
-- cannot use it to change a firm's data. The list of functions is the one supabase/tests/close_a_firm.sql keeps for the closing guard.
DO $$
DECLARE
  guarded text[] := ARRAY['accept_invitation', 'add_firm_organisation', 'advisor_add_quote_request_note', 'advisor_add_referral_partner', 'advisor_correct_quote_request_note',
    'advisor_record_quote_send', 'advisor_reissue_quote_request_address', 'advisor_request_information', 'advisor_requeue_outbox_event', 'advisor_update_quote_request',
    'advisor_update_referral_partner', 'approve_join_request', 'ask_to_join_firm', 'cancel_invitation', 'change_saved_view', 'decline_join_request', 'delete_saved_view',
    'invite_member', 'lift_member_suspension', 'remove_firm_organisation', 'remove_member', 'rename_saved_view', 'resend_invitation', 'review_submission_field',
    'save_view', 'set_my_table_columns', 'set_submission_needs_action', 'set_submission_status', 'share_saved_view', 'suspend_member', 'unshare_saved_view',
    'plan_mail_move', 'apply_mail_move', 'record_manuscript_version', 'request_intake_deletion', 'retry_intake_deletion', 'revoke_chamber_session'];
  -- These do not ask the guard, and the reason a support session still cannot change a firm's data with them.
  exempt jsonb := jsonb_build_object(
    'admin_add_peo', 'a platform admin''s, open to every admin with or without a session; the PEO list is the same for every firm',
    'admin_decide_firm', 'a platform admin''s decision, open to every admin with or without a session; a session adds nothing to it',
    'admin_discard_peo_draft', 'a platform admin''s; the PEO list is the same for every firm',
    'admin_lift_firm_suspension', 'a platform admin''s, open to every admin with or without a session',
    'admin_publish_peo_profile', 'a platform admin''s; the PEO list is the same for every firm',
    'admin_recheck_peo_profile', 'a platform admin''s; the PEO list is the same for every firm',
    'admin_register_census_template', 'a platform admin''s; the same for every firm',
    'admin_save_peo_profile', 'a platform admin''s; the PEO list is the same for every firm',
    'admin_set_peo_listed', 'a platform admin''s; the PEO list is the same for every firm',
    'admin_stop_firm_closure', 'a platform admin''s, open to every admin with or without a session',
    'admin_suspend_firm', 'a platform admin''s, open to every admin with or without a session',
    'advisor_open_quote_request_thread', 'marks a thread read: for a support session it marks nothing (tested above), so no email is left for the firm',
    'archive_chamber_session', 'changes the caller''s own intake only (user_id is the caller); a support session has no intake of the firm''s prospects',
    'consume_ai_quota', 'the caller''s own allowance',
    'end_support_session', 'the doorway itself: the admin''s own session, in the platform''s table and the firm''s record of the use',
    'leave_firm', 'ends the caller''s own membership: a support session has none, so it answers "not a member"',
    'record_intake_consent', 'the caller''s own agreement as an employer; writes a row with the caller''s id',
    'report_client_event', 'the platform''s monitoring: a row with the caller''s own id, read by platform admins only',
    'request_firm_closure', 'asks for the owner role by name; a support session is not an owner (tested above)',
    'sign_up_firm', 'makes a new firm; touches no firm that exists',
    'start_support_session', 'the doorway itself: an admin''s, writes the platform''s table and the firm''s record of the use',
    'withdraw_firm_closure', 'asks for the owner role by name; a support session is not an owner (tested above)');
  lost text; unplaced text; stale text;
BEGIN
  RESET ROLE;
  SELECT string_agg(g, ', ' ORDER BY g) INTO lost FROM unnest(guarded) g
  WHERE g NOT IN ('accept_invitation', 'ask_to_join_firm', 'plan_mail_move', 'apply_mail_move')
    AND NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = g AND p.prosrc LIKE '%assert_firm_writable%');
  PERFORM pg_temp.is(lost, NULL::text, 'every guarded function still asks the guard');
  SELECT string_agg(DISTINCT p.proname, ', ' ORDER BY p.proname) INTO unplaced
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
    AND (has_function_privilege('authenticated', p.oid, 'EXECUTE') OR has_function_privilege('anon', p.oid, 'EXECUTE'))
    AND p.prosrc ~* '(insert into|update public|update [a-z_.]+ +(set|as)|delete from)'
    AND p.proname <> ALL (guarded) AND NOT exempt ? p.proname;
  PERFORM pg_temp.is(unplaced, NULL::text, 'no function that changes data is left out of the lists (add it to guarded, or to exempt with why a support session cannot use it)');
  SELECT string_agg(k, ', ' ORDER BY k) INTO stale FROM jsonb_object_keys(exempt) k
  WHERE NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = k);
  PERFORM pg_temp.is(stale, NULL::text, 'and the exempt list names no function that is gone');
  RAISE NOTICE 'help_from_nevermore: every writing function is accounted for';
END $$;

SELECT 'help_from_nevermore: all cases passed' AS result;
