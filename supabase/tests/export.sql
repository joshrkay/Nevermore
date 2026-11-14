-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh export
-- Export in the database (story CRM-S3.8b; docs/BROKER_CRM_BUILD.md D-24, D-33, D-48, D-128; ADR 0023, ADR 0024; 20261119090000_export.sql).
-- An export runs through one function that returns the rows and records the export in the same step. Applied to referral partners (any
-- member) and, for owners, the firm's record. Two firms and their members are used throughout, with a closing firm, a suspended firm and a
-- firm of the size the alert and the limit need. Every migration is loaded, in filename order (D-105), this story's last.
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
-- Stand-in for pg_cron (same names and signature as supabase/tests/outbox_schedule.sql uses), holding the daily job of the firm's record
-- as 20261116160001 made it, so the fixes migration can be seen to add the outbox clean-up to that same job.
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
\i supabase/migrations/20261118150000_queue_sort_collation.sql
\i supabase/migrations/20261118160000_record_version.sql
\i supabase/migrations/20261118160500_record_version_fixes.sql
\i supabase/migrations/20261119090000_export.sql
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

-- Signs in as a person, at a firm's address when one is named (D-40). `ago` is how long ago they signed in, as the token's own `amr` says it
-- (GoTrue puts the time of each way in): 'google' is one sign-in with a provider; 'none' a token that says nothing of when; 'password_aal2' a
-- password sign-in `ago` plus twenty hours back with the second factor done `ago` ago; 'password' a password sign-in without its second factor.
CREATE FUNCTION pg_temp.as_user(n text, addr text DEFAULT NULL, ago interval DEFAULT interval '1 hour', how text DEFAULT 'google') RETURNS void LANGUAGE plpgsql AS $$
DECLARE amr jsonb;
BEGIN
  RESET ROLE;
  amr := CASE how
    WHEN 'google' THEN jsonb_build_array(jsonb_build_object('method', 'oauth', 'timestamp', floor(extract(epoch FROM now() - ago))::bigint))
    WHEN 'password_aal2' THEN jsonb_build_array(jsonb_build_object('method', 'password', 'timestamp', floor(extract(epoch FROM now() - ago - interval '20 hours'))::bigint),
                                               jsonb_build_object('method', 'totp', 'timestamp', floor(extract(epoch FROM now() - ago))::bigint))
    WHEN 'password' THEN jsonb_build_array(jsonb_build_object('method', 'password', 'timestamp', floor(extract(epoch FROM now() - ago))::bigint))
    END;
  PERFORM set_config('request.jwt.claims',
    (jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', false, 'email', n || '@example.test')
     || CASE WHEN amr IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('amr', amr) END
     || CASE how WHEN 'password_aal2' THEN '{"aal":"aal2"}'::jsonb WHEN 'password' THEN '{"aal":"aal1"}'::jsonb ELSE '{}'::jsonb END)::text, false);
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

-- One export, as whoever is signed in now: 'ok' or the refusal.
CREATE FUNCTION pg_temp.try(fid uuid, tbl text, filters text DEFAULT '{}', ids text DEFAULT NULL) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.refusal(format('SELECT public.export_rows(%L, %L, %L::jsonb, %L::jsonb)', fid, tbl, filters, ids))
$$;

-- One export's answer, as whoever is signed in now.
CREATE FUNCTION pg_temp.run(fid uuid, tbl text, filters text DEFAULT '{}', ids text DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.export_rows(fid, tbl, filters::jsonb, ids::jsonb)
$$;

-- What the record holds about exports of a firm, read as the superuser, oldest first: 'actor|table|rows'.
CREATE FUNCTION pg_temp.entries(fid uuid, tbl text DEFAULT NULL) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE(string_agg(COALESCE((SELECT u.email FROM auth.users u WHERE u.id = a.actor_id), '-') || '|' || a.record_id || '|' || a.row_count, ', ' ORDER BY a.id), '')
  FROM public.firm_activity a WHERE a.firm_id = fid AND a.kind = 'export_made' AND (tbl IS NULL OR a.record_id = tbl)
$$;
CREATE FUNCTION pg_temp.alerts(fid uuid) RETURNS bigint LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*) FROM public.outbox_events WHERE firm_id = fid AND kind = 'export_alert'
$$;

-- ---------- set up ----------
-- acme: owner, lead, two agents, an admin who is also an agent, a removed agent. zenith: an owner and an agent who belongs to both firms.
-- cinder is closing, sigma suspended, big holds many partners. platform_admin is a platform admin, a member of nothing, with an open support session at acme.
DO $$
DECLARE acme uuid; zenith uuid; cinder uuid; sigma uuid; big uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at, decision, decided_at) VALUES ('Acme Brokers', 'acme-brokers', now(), 'approved', now()) RETURNING id INTO acme;
  INSERT INTO public.firms (name, address, approved_at, decision, decided_at) VALUES ('Zenith Benefits', 'zenith-benefits', now(), 'approved', now()) RETURNING id INTO zenith;
  INSERT INTO public.firms (name, address, approved_at, decision, decided_at) VALUES ('Cinder Closing', 'cinder-closing', now(), 'approved', now()) RETURNING id INTO cinder;
  INSERT INTO public.firms (name, address, approved_at, decision, decided_at) VALUES ('Sigma Suspended', 'sigma-suspended', now(), 'approved', now()) RETURNING id INTO sigma;
  INSERT INTO public.firms (name, address, approved_at, decision, decided_at) VALUES ('Big Brokers', 'big-brokers', now(), 'approved', now()) RETURNING id INTO big;
  INSERT INTO fx VALUES ('acme', acme), ('zenith', zenith), ('cinder', cinder), ('sigma', sigma), ('big', big);
  PERFORM pg_temp.new_user(n) FROM unnest(ARRAY['acme_owner', 'acme_lead', 'acme_agent', 'acme_agent2', 'acme_admin_member', 'acme_removed', 'rep1', 'rep2', 'rep3', 'rep4',
    'zenith_owner', 'both', 'cinder_owner', 'cinder_agent', 'sigma_owner', 'big_owner', 'big_agent', 'platform_admin', 'nobody']) AS n;
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES
    (acme, pg_temp.id('acme_owner'), 'owner'), (acme, pg_temp.id('acme_lead'), 'lead'), (acme, pg_temp.id('acme_agent'), 'agent'), (acme, pg_temp.id('acme_agent2'), 'agent'),
    (acme, pg_temp.id('acme_admin_member'), 'agent'), (acme, pg_temp.id('rep1'), 'agent'), (acme, pg_temp.id('rep2'), 'agent'), (acme, pg_temp.id('rep3'), 'agent'), (acme, pg_temp.id('rep4'), 'agent'),
    (acme, pg_temp.id('both'), 'agent'), (zenith, pg_temp.id('both'), 'agent'), (zenith, pg_temp.id('zenith_owner'), 'owner'),
    (cinder, pg_temp.id('cinder_owner'), 'owner'), (cinder, pg_temp.id('cinder_agent'), 'agent'), (sigma, pg_temp.id('sigma_owner'), 'owner'),
    (big, pg_temp.id('big_owner'), 'owner'), (big, pg_temp.id('big_agent'), 'agent');
  INSERT INTO public.firm_memberships (firm_id, user_id, role, valid_from, valid_until) VALUES
    (acme, pg_temp.id('acme_removed'), 'agent', now() - interval '3 days', now() - interval '1 day');
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('platform_admin'), 'admin'), (pg_temp.id('acme_admin_member'), 'admin');
  INSERT INTO public.referral_partners (firm_id, code, name, kind) VALUES
    (acme, 'acme-cfo', 'Acme CFO', 'accounting'), (acme, 'acme-law', 'Acme Law', 'law_firm'), (acme, 'acme-event', 'Acme Event', 'event'),
    (zenith, 'zenith-cfo', 'Zenith CFO', 'accounting'), (zenith, 'zenith-law', 'Zenith Law', 'law_firm'),
    (cinder, 'cinder-cfo', 'Cinder CFO', 'accounting');
  -- A suspended firm and a support session, as the people who do them.
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_suspend_firm(sigma, 'testing');
  PERFORM public.start_support_session(acme, 'looking at a stuck quote');
  RESET ROLE;
  -- The closing firm asks to close.
  PERFORM pg_temp.as_user('cinder_owner', 'cinder-closing');
  PERFORM public.request_firm_closure(cinder, 'Cinder Closing');
  RESET ROLE;
END $$;

-- ---------- the record of an export: what it holds ----------
-- Break caught: the function is missing; the entry has no count, or a different one from the rows given; it names no one or the wrong person
-- or firm; another kind or record type; another kind of entry can claim a count, or an export one without; a count below zero.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); a jsonb; n bigint;
BEGIN
  -- The check that ties a count to an export, tried as the superuser (the only one that can insert at all).
  PERFORM pg_temp.is(pg_temp.refusal(format($q$INSERT INTO public.firm_activity (firm_id, kind, record_type, record_id) VALUES (%L, 'export_made', 'table', 'referral_partners')$q$, acme)) LIKE '23514:%', true, 'an export with no count is not a record');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$INSERT INTO public.firm_activity (firm_id, kind, record_type, record_id, row_count) VALUES (%L, 'export_made', 'table', 'referral_partners', -1)$q$, acme)) LIKE '23514:%', true, 'nor a negative one');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$INSERT INTO public.firm_activity (firm_id, kind, record_type, record_id, row_count) VALUES (%L, 'sign_in', 'firm', %L, 3)$q$, acme, acme::text)) LIKE '23514:%', true, 'a sign-in has no count');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$INSERT INTO public.firm_activity (firm_id, kind, record_type, record_id, row_count) VALUES (%L, 'export_made', 'firm', %L, 3)$q$, acme, acme::text)) LIKE '23514:%', true, 'an export is of a table');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$INSERT INTO public.firm_activity (firm_id, kind, record_type, record_id, row_count) VALUES (%L, 'sign_in', 'table', 'referral_partners', NULL)$q$, acme)) LIKE '23514:%', true, 'and only an export is');

  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  a := pg_temp.run(acme, 'referral_partners');
  RESET ROLE;
  PERFORM pg_temp.is((a ->> 'count')::int, 3, 'the answer counts the firm''s three partners');
  PERFORM pg_temp.is(jsonb_array_length(a -> 'rows'), 3, 'and holds them');
  PERFORM pg_temp.is(a ->> 'table', 'referral_partners', 'it says which table');
  PERFORM pg_temp.is(pg_temp.entries(acme, 'referral_partners'), 'acme_agent@example.test|referral_partners|3', 'one entry: who, which table, how many');
  SELECT count(*) INTO n FROM public.firm_activity WHERE firm_id = acme AND kind = 'export_made' AND record_type = 'table' AND actor_is_staff = false AND subject_user_id IS NULL AND role IS NULL
    AND at > now() - interval '1 minute';
  PERFORM pg_temp.is(n, 1::bigint, 'about a table, by a member, with no subject or role, dated now');
  RAISE NOTICE 'export: the record passed';
END $$;

-- ---------- what the export holds ----------
-- Break caught: another firm's partner is in the rows; a column the table does not list (an email, an id, the firm) is in them; the rows are
-- not in a stable order; the columns are not described; a partner is missing.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); a jsonb; keys text; cols text;
BEGIN
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  a := pg_temp.run(acme, 'referral_partners');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT string_agg(r ->> 'code', ',' ORDER BY ord) FROM jsonb_array_elements(a -> 'rows') WITH ORDINALITY x(r, ord)), 'acme-cfo,acme-event,acme-law', 'the firm''s partners by name, and no other firm''s');
  SELECT string_agg(k, ',' ORDER BY k) INTO keys FROM jsonb_object_keys(a -> 'rows' -> 0) k;
  SELECT string_agg(c ->> 'id', ',' ORDER BY ord) INTO cols FROM jsonb_array_elements(a -> 'columns') WITH ORDINALITY x(c, ord);
  PERFORM pg_temp.is(cols, 'code,name,kind,created_at,updated_at', 'the columns are described, in order');
  PERFORM pg_temp.is(keys, 'code,created_at,kind,name,updated_at', 'a row holds those and nothing else');
  PERFORM pg_temp.is((SELECT bool_and(c ->> 'label' IS NOT NULL AND c ->> 'label' <> '') FROM jsonb_array_elements(a -> 'columns') c), true, 'each with its words');
  PERFORM pg_temp.is(a -> 'rows' -> 0 ->> 'name', 'Acme CFO', 'the values are the firm''s');
  PERFORM pg_temp.is(a ->> 'label', 'Referral partners', 'the table has its words too');
  PERFORM pg_temp.is(a ->> 'skipped', '0', 'nothing is skipped when no selection was named');
  RAISE NOTICE 'export: the rows passed';
END $$;

-- ---------- filters, and a selection by ids ----------
-- Break caught: a filter is ignored (the whole table comes back and the record counts it); a filter is applied after the count; a filter
-- the table does not have is accepted; a selection returns a row that was not named, another firm's row, or counts the ones not found;
-- more ids than allowed are taken; a selection is asked to sign in again.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); a jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  a := pg_temp.run(acme, 'referral_partners', '{"kind":"law_firm"}');
  PERFORM pg_temp.is(a ->> 'count', '1', 'a kind narrows the rows');
  a := pg_temp.run(acme, 'referral_partners', '{"search":"event"}');
  PERFORM pg_temp.is((a -> 'rows' -> 0) ->> 'code', 'acme-event', 'a search matches the name, in any case');
  a := pg_temp.run(acme, 'referral_partners', '{"search":"ACME-LAW"}');
  PERFORM pg_temp.is(a ->> 'count', '1', 'and the code');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.entries(acme, 'referral_partners'), 'acme_agent@example.test|referral_partners|3, acme_agent2@example.test|referral_partners|3, acme_agent2@example.test|referral_partners|1, acme_agent2@example.test|referral_partners|1, acme_agent2@example.test|referral_partners|1',
    'each export is recorded with the rows it returned, not the rows of the table');
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.try(acme, 'referral_partners', '{"colour":"red"}'), '22023: Those filters don''t apply to this table', 'a filter the table does not have is refused');
  PERFORM pg_temp.is(pg_temp.try(acme, 'referral_partners', '{"kind":"nonsense"}'), '22023: Those filters don''t apply to this table', 'so is a value it does not take');
  PERFORM pg_temp.is(pg_temp.try(acme, 'referral_partners', '[]'), '22023: Those filters don''t apply to this table', 'and filters that are not a set of named filters');
  -- A selection: the ones named that are the firm's, in the table's order; the others are counted as skipped and are not told apart.
  a := pg_temp.run(acme, 'referral_partners', '{}', '["acme-law","zenith-cfo","nobody-has-this","acme-cfo","acme-law"]');
  PERFORM pg_temp.is(a ->> 'count', '2', 'a selection returns the firm''s rows among the ones named');
  PERFORM pg_temp.is(a ->> 'skipped', '2', 'and says how many ids it could not give (another firm''s and one that is not there look alike)');
  PERFORM pg_temp.is((SELECT string_agg(r ->> 'code', ',') FROM jsonb_array_elements(a -> 'rows') r), 'acme-cfo,acme-law', 'in the table''s order, each once');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT row_count FROM public.firm_activity WHERE kind = 'export_made' AND firm_id = acme ORDER BY id DESC LIMIT 1), 2, 'the record counts the rows given, not the ids named');
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers', interval '30 hours');
  PERFORM pg_temp.is(pg_temp.try(acme, 'referral_partners', '{}', '["acme-law"]'), 'ok', 'a selection needs no fresh sign-in');
  PERFORM pg_temp.is(pg_temp.try(acme, 'referral_partners', '{}', '[]'), 'ok', 'an empty selection is an export of nothing, not of everything');
  PERFORM pg_temp.is(pg_temp.run(acme, 'referral_partners', '{}', '[]') ->> 'count', '0', 'with no rows');
  PERFORM pg_temp.is(pg_temp.try(acme, 'referral_partners', '{}', '"acme-law"'), '22023: Name the records to export as a list', 'ids that are not a list are refused');
  PERFORM pg_temp.is(pg_temp.try(acme, 'referral_partners', '{}', '[1]'), '22023: Name the records to export as a list', 'so are ones that are not text');
  PERFORM pg_temp.is(pg_temp.try(acme, 'referral_partners', '{}', (SELECT jsonb_agg('c' || g)::text FROM generate_series(1, 1000) g)), 'ok', 'a thousand ids are the most');
  PERFORM pg_temp.is(pg_temp.try(acme, 'referral_partners', '{}', (SELECT jsonb_agg('c' || g)::text FROM generate_series(1, 1001) g)), '22023: Pick at most 1,000 records to export', 'one more is refused in words');
  RESET ROLE;
  RAISE NOTICE 'export: filters and selections passed';
END $$;

-- ---------- the fresh sign-in ----------
-- Break caught: a whole table is exported by someone who signed in more than twelve hours ago; the window is longer or shorter than twelve hours;
-- the oldest way of signing in decides, not the latest (a second factor done an hour ago is a sign-in an hour ago); a token that says nothing
-- of when passes; a refused export is still recorded; the refusal is not worded for the person.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); before_n bigint;
BEGIN
  SELECT count(*) INTO before_n FROM public.firm_activity WHERE kind = 'export_made' AND firm_id = acme;
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers', interval '13 hours');
  PERFORM pg_temp.is(pg_temp.try(acme, 'referral_partners'), 'PT401: Sign in again to export a whole table', 'a sign-in thirteen hours ago must be done again');
  PERFORM pg_temp.is(pg_temp.try(acme, 'referral_partners', '{"kind":"law_firm"}'), 'PT401: Sign in again to export a whole table', 'a filter does not make it a selection');
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers', interval '11 hours 59 minutes');
  PERFORM pg_temp.is(pg_temp.try(acme, 'referral_partners'), 'ok', 'a sign-in just inside twelve hours is fresh');
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers', interval '12 hours 1 minute');
  PERFORM pg_temp.is(pg_temp.try(acme, 'referral_partners'), 'PT401: Sign in again to export a whole table', 'and just outside it is not');
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers', interval '2 hours', 'password_aal2');
  PERFORM pg_temp.is(pg_temp.try(acme, 'referral_partners'), 'ok', 'a password sign-in twenty-two hours ago with the second factor two hours ago is fresh: the latest counts');
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers', interval '1 hour', 'none');
  PERFORM pg_temp.is(pg_temp.try(acme, 'referral_partners'), 'PT401: Sign in again to export a whole table', 'a token that says nothing of when the person signed in fails closed');
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers', interval '1 hour', 'password');
  PERFORM pg_temp.is(pg_temp.try(acme, 'referral_partners'), '42501: Not a member of that firm', 'a password sign-in that owes its second factor is no member yet (D-19), whatever the time');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'export_made' AND firm_id = acme), before_n + 2, 'only the two that were let through were recorded');
  RAISE NOTICE 'export: the fresh sign-in passed';
END $$;

-- ---------- who may export which table ----------
-- Break caught: a stranger, a former member, another firm's member or a platform admin who is no member gets rows; the record is exported by a
-- lead or an agent; a refusal leaves an entry; a signed-out caller reaches the function; an unknown table (an intake's answers, the queue, a
-- census) is exported; the table's name is built into SQL.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); zenith uuid := pg_temp.id('zenith'); before_n bigint; t text;
BEGIN
  SELECT count(*) INTO before_n FROM public.firm_activity WHERE kind = 'export_made';
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.try(acme, 'referral_partners'), 'ok', 'an owner exports partners');
  PERFORM pg_temp.as_user('acme_lead', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.try(acme, 'referral_partners'), 'ok', 'a lead does');
  PERFORM pg_temp.as_user('acme_admin_member', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.try(acme, 'referral_partners'), 'ok', 'an admin who is also an agent does, as a member');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT actor_is_staff FROM public.firm_activity WHERE kind = 'export_made' AND firm_id = acme ORDER BY id DESC LIMIT 1), false, 'and the entry is theirs as a member, not Nevermore''s');
  -- Everyone who is no member of acme.
  FOR t IN SELECT unnest(ARRAY['nobody', 'acme_removed', 'zenith_owner', 'sigma_owner']) LOOP
    PERFORM pg_temp.as_user(t);
    PERFORM pg_temp.is(pg_temp.try(acme, 'referral_partners'), '42501: Not a member of that firm', t || ' is refused');
    PERFORM pg_temp.is(pg_temp.try(acme, 'referral_partners', '{}', '["acme-cfo"]'), '42501: Not a member of that firm', t || ' is refused a selection too');
    PERFORM pg_temp.is(pg_temp.try(acme, 'firm_activity'), '42501: Not a member of that firm', t || ' is refused the record');
  END LOOP;
  PERFORM pg_temp.as_user('platform_admin', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.try(zenith, 'referral_partners'), '42501: Not a member of that firm', 'a platform admin with no session for that firm is refused, as a stranger is');
  PERFORM pg_temp.is(pg_temp.try(NULL, 'referral_partners'), 'PT423: Nevermore support can look, not change', 'and one who holds a session anywhere is refused a call that names no firm');
  -- Only an owner exports the record.
  FOR t IN SELECT unnest(ARRAY['acme_lead', 'acme_agent', 'acme_admin_member']) LOOP
    PERFORM pg_temp.as_user(t, 'acme-brokers');
    PERFORM pg_temp.is(pg_temp.try(acme, 'firm_activity'), '42501: Only an owner of the firm can export that', t || ' is refused the firm''s record');
  END LOOP;
  -- No other table.
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  FOREACH t IN ARRAY ARRAY['chamber_sessions', 'submissions', 'queue', 'census', 'referral_partners; DROP TABLE x', 'Referral_Partners', '', 'export_source_referral_partners'] LOOP
    PERFORM pg_temp.is(pg_temp.try(acme, t), '22023: Choose a table to export', 'the table ' || quote_literal(t) || ' is not one');
  END LOOP;
  PERFORM pg_temp.is(pg_temp.try(acme, NULL), '22023: Choose a table to export', 'no table is not one either');
  RESET ROLE;
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.export_rows(%L, 'referral_partners', '{}', NULL)$q$, acme)) LIKE '42501:%', true, 'a signed-out caller cannot run it');
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.export_rows(%L, 'referral_partners', '{}', NULL)$q$, acme)) LIKE '42501:%', true, 'nor the service role: an export is a person''s');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'export_made'), before_n + 3, 'only the three exports that worked were recorded');
  RAISE NOTICE 'export: who may passed';
END $$;

-- ---------- the firm's record, exported by an owner ----------
-- Break caught: another firm's entries are in it; the platform admin's name, email or id is in it (D-33); a column is missing; an actor who
-- has gone is shown as someone; a filter on person or kind is ignored; an export is missing from the next export of the record; the record's
-- own id numbers are given.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); zenith uuid := pg_temp.id('zenith'); a jsonb; b jsonb; txt text; cols text;
BEGIN
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  PERFORM pg_temp.run(zenith, 'referral_partners');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  a := pg_temp.run(acme, 'firm_activity');
  txt := a::text;
  RESET ROLE;
  SELECT string_agg(c ->> 'id', ',' ORDER BY ord) INTO cols FROM jsonb_array_elements(a -> 'columns') WITH ORDINALITY x(c, ord);
  PERFORM pg_temp.is(cols, 'at,who,kind,record_type,record_id,subject,role,row_count', 'the record''s columns, in order');
  PERFORM pg_temp.is((a ->> 'count')::int > 0, true, 'it holds the firm''s entries');
  PERFORM pg_temp.is(position('zenith_owner' IN txt), 0, 'and none of another firm''s');
  PERFORM pg_temp.is(position('platform_admin' IN txt), 0, 'nor the platform admin''s name or email');
  PERFORM pg_temp.is(position(pg_temp.id('platform_admin')::text IN txt), 0, 'nor id');
  PERFORM pg_temp.is((SELECT count(*) FROM jsonb_array_elements(a -> 'rows') r WHERE r ->> 'kind' = 'support_access' AND r ->> 'who' = 'Nevermore'), 1::bigint, 'the use of support is there, as Nevermore''s');
  PERFORM pg_temp.is((SELECT count(*) FROM jsonb_array_elements(a -> 'rows') r WHERE r ->> 'kind' = 'export_made' AND r ->> 'record_id' = 'referral_partners' AND r ->> 'who' = 'acme_agent@example.test'), 1::bigint, 'an earlier export is a row, with its table, who and how many');
  PERFORM pg_temp.is((SELECT r ->> 'row_count' FROM jsonb_array_elements(a -> 'rows') r WHERE r ->> 'kind' = 'export_made' AND r ->> 'who' = 'acme_agent@example.test' LIMIT 1), '3', 'the count');
  PERFORM pg_temp.is((SELECT bool_and(r ->> 'row_count' IS NULL) FROM jsonb_array_elements(a -> 'rows') r WHERE r ->> 'kind' <> 'export_made'), true, 'and only exports have one');
  PERFORM pg_temp.is((SELECT bool_and(jsonb_typeof(r -> 'at') = 'string') FROM jsonb_array_elements(a -> 'rows') r), true, 'each entry has its time');
  PERFORM pg_temp.is((SELECT r ->> 'at' FROM jsonb_array_elements(a -> 'rows') r ORDER BY (r ->> 'at')::timestamptz DESC LIMIT 1), (a -> 'rows' -> 0) ->> 'at', 'newest first, as the page shows it');
  PERFORM pg_temp.is(position('entry_key' IN (a -> 'rows')::text) + position('"id"' IN (a -> 'rows')::text), 0, 'no number or key of an entry leaves');
  -- Filters.
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  b := pg_temp.run(acme, 'firm_activity', '{"kind":"export_made"}');
  PERFORM pg_temp.is((SELECT bool_and(r ->> 'kind' = 'export_made') FROM jsonb_array_elements(b -> 'rows') r), true, 'a kind narrows it');
  PERFORM pg_temp.is((SELECT count(*) FROM jsonb_array_elements(b -> 'rows') r)::int, (b ->> 'count')::int, 'and the count is of what is given');
  b := pg_temp.run(acme, 'firm_activity', jsonb_build_object('person', pg_temp.id('acme_agent'))::text);
  PERFORM pg_temp.is((SELECT bool_and(r ->> 'who' = 'acme_agent@example.test') FROM jsonb_array_elements(b -> 'rows') r), true, 'a person narrows it');
  b := pg_temp.run(acme, 'firm_activity', '{"person":"nevermore"}');
  PERFORM pg_temp.is((SELECT bool_and(r ->> 'who' = 'Nevermore') FROM jsonb_array_elements(b -> 'rows') r) AND (b ->> 'count')::int >= 1, true, 'and so does Nevermore, as one');
  PERFORM pg_temp.is(pg_temp.try(acme, 'firm_activity', '{"person":"not-a-person"}'), '22023: Those filters don''t apply to this table', 'a person that is not an id is refused');
  PERFORM pg_temp.is(pg_temp.run(acme, 'firm_activity', '{"kind":"invented"}') ->> 'count', '0', 'a kind the record has none of gives none');
  -- A selection of entries by their key is not offered by the record's page, but the contract takes it: the keys the export gave.
  RESET ROLE;
  RAISE NOTICE 'export: the record passed';
END $$;

-- ---------- the export and its record are one step ----------
-- Break caught: the rows are given although the entry could not be written; the entry is written although the rows were not given; the
-- alert is queued although the export failed.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); before_n bigint; before_alerts bigint; got text;
BEGIN
  SELECT count(*) INTO before_n FROM public.firm_activity WHERE kind = 'export_made';
  before_alerts := pg_temp.alerts(acme);
  CREATE FUNCTION pg_temp.refuse_exports() RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN IF NEW.kind = 'export_made' THEN RAISE EXCEPTION 'the record is not writable' USING ERRCODE = 'ZZ001'; END IF; RETURN NEW; END $f$;
  CREATE TRIGGER zz_refuse_exports BEFORE INSERT ON public.firm_activity FOR EACH ROW EXECUTE FUNCTION pg_temp.refuse_exports();
  PERFORM pg_temp.as_user('rep1', 'acme-brokers');
  got := pg_temp.try(acme, 'referral_partners');
  RESET ROLE;
  DROP TRIGGER zz_refuse_exports ON public.firm_activity;
  PERFORM pg_temp.is(got, 'ZZ001: the record is not writable', 'when the record cannot be written the export fails and gives nothing');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'export_made'), before_n, 'with no entry');
  PERFORM pg_temp.is(pg_temp.alerts(acme), before_alerts, 'and no alert');
  RAISE NOTICE 'export: one step passed';
END $$;

-- ---------- Nevermore support ----------
-- Break caught: a support session exports (the refusal is not called, is called after the table is read, is called with NULL, or after the
-- record is written); the refusal names the wrong words; the refusal waits for the membership check, so a support session is told it is not a
-- member instead; an entry is written; an owner-only table is read by it.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); before_n bigint; t text;
BEGIN
  SELECT count(*) INTO before_n FROM public.firm_activity WHERE kind = 'export_made';
  PERFORM pg_temp.as_user('platform_admin', 'acme-brokers');
  FOREACH t IN ARRAY ARRAY['referral_partners', 'firm_activity', 'chamber_sessions'] LOOP
    PERFORM pg_temp.is(pg_temp.try(acme, t), 'PT423: Nevermore support can look, not change', 'a support session is refused ' || t);
    PERFORM pg_temp.is(pg_temp.try(acme, t, '{}', '["acme-cfo"]'), 'PT423: Nevermore support can look, not change', 'and a selection of it');
    PERFORM pg_temp.is(pg_temp.try(acme, t, '{"nonsense":1}', '"nonsense"'), 'PT423: Nevermore support can look, not change', 'before anything about the call is looked at');
  END LOOP;
  PERFORM pg_temp.is(pg_temp.try(NULL, 'referral_partners'), 'PT423: Nevermore support can look, not change', 'a call that names no firm is refused too: NULL fails closed');
  PERFORM pg_temp.is(pg_temp.try(pg_temp.id('zenith'), 'referral_partners'), '42501: Not a member of that firm', 'while another firm, where there is no session, is only one the admin is no member of');
  -- At the address too, and with a stale sign-in: the refusal comes before the fresh sign-in.
  PERFORM pg_temp.as_user('platform_admin', 'acme-brokers', interval '40 hours');
  PERFORM pg_temp.is(pg_temp.try(acme, 'referral_partners'), 'PT423: Nevermore support can look, not change', 'with a sign-in long ago, the refusal is still the first answer');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'export_made'), before_n, 'and nothing was recorded');
  -- A session that has ended is no session: the admin is only a stranger again.
  INSERT INTO fx SELECT 'support_session', id FROM public.support_sessions WHERE firm_id = acme AND ended_at IS NULL;
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.end_support_session(pg_temp.id('support_session'));
  PERFORM pg_temp.is(pg_temp.try(acme, 'referral_partners'), '42501: Not a member of that firm', 'once the session has ended, the admin is just not a member');
  PERFORM public.start_support_session(acme, 'looking again');
  RESET ROLE;
  RAISE NOTICE 'export: support passed';
END $$;

-- ---------- a closing firm, a suspended firm ----------
-- Break caught: a closing firm is refused its way out (a firm asked to close is offered its tables to take: P1.7) or is let write something
-- other than the record of the export; a suspended firm exports; the closing firm's alert goes nowhere.
DO $$
DECLARE cinder uuid := pg_temp.id('cinder'); sigma uuid := pg_temp.id('sigma'); a jsonb;
BEGIN
  PERFORM pg_temp.is(public.firm_is_read_only(cinder), true, 'the firm is closing: it is read-only');
  PERFORM pg_temp.as_user('cinder_agent', 'cinder-closing');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.advisor_add_referral_partner('late', 'Late', 'event', %L)$q$, cinder)), 'PT423: This firm is closing and can''t be changed', 'it can''t add a partner');
  a := pg_temp.run(cinder, 'referral_partners');
  PERFORM pg_temp.is(a ->> 'count', '1', 'but its members can still take their partners out: an export reads');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.entries(cinder), 'cinder_agent@example.test|referral_partners|1', 'and it is recorded in the firm''s record, as a closing firm''s record still is');
  PERFORM pg_temp.as_user('cinder_owner', 'cinder-closing');
  PERFORM pg_temp.is(pg_temp.try(cinder, 'firm_activity'), 'ok', 'an owner of a closing firm takes the record too');
  PERFORM pg_temp.as_user('sigma_owner', 'sigma-suspended');
  PERFORM pg_temp.is(pg_temp.try(sigma, 'referral_partners'), '42501: Not a member of that firm', 'a suspended firm''s members are no members until it is lifted: nothing is exported');
  RESET ROLE;
  RAISE NOTICE 'export: closing and suspended passed';
END $$;

-- ---------- one firm at a time ----------
-- Break caught: a person who belongs to two firms exports one firm's rows at the other's address, or gets both in one answer; a call that names
-- no firm guesses for a person with two; the address decides the firm for a call that names none.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); zenith uuid := pg_temp.id('zenith'); a jsonb;
BEGIN
  PERFORM pg_temp.as_user('both', 'acme-brokers');
  a := pg_temp.run(acme, 'referral_partners');
  PERFORM pg_temp.is(a ->> 'count', '3', 'at acme''s address, acme''s partners');
  PERFORM pg_temp.is(pg_temp.try(zenith, 'referral_partners'), '42501: Not a member of that firm', 'and zenith''s are not given there, though they are a member of zenith');
  PERFORM pg_temp.is(pg_temp.run(NULL, 'referral_partners') ->> 'count', '3', 'a call that names no firm acts for the firm at the address');
  PERFORM pg_temp.as_user('both', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.run(zenith, 'referral_partners') ->> 'count', '2', 'at zenith''s, zenith''s');
  PERFORM pg_temp.as_user('both');
  PERFORM pg_temp.is(pg_temp.run(zenith, 'referral_partners') ->> 'count', '2', 'on the bare domain the firm named');
  PERFORM pg_temp.is(pg_temp.try(NULL, 'referral_partners'), '22023: You belong to more than one firm: say which', 'and with none named, the database does not choose');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT string_agg(f.name, ',' ORDER BY f.name) FROM public.firm_activity a JOIN public.firms f ON f.id = a.firm_id WHERE a.kind = 'export_made' AND a.actor_id = pg_temp.id('both')), 'Acme Brokers,Acme Brokers,Zenith Benefits,Zenith Benefits', 'each export is in its own firm''s record');
  RAISE NOTICE 'export: one firm at a time passed';
END $$;

-- ---------- the owners' alert ----------
-- Break caught: a large export (more than 500 rows) is not told; exactly 500 is; the third export in an hour is not told, or the second is;
-- the fourth is told again; exports more than an hour apart are counted together; one member's exports are counted with another's; the alert
-- holds a row, or something the owners were not meant to see, or is not about the firm; two of the same member racing are not counted
-- together; a failed export tells the owners.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); big uuid := pg_temp.id('big'); p jsonb; n0 bigint;
BEGIN
  -- Three in an hour, by one member (rep1 has the one that failed above, which was not recorded).
  PERFORM pg_temp.as_user('rep1', 'acme-brokers');
  n0 := pg_temp.alerts(acme);
  PERFORM pg_temp.run(acme, 'referral_partners', '{}', '["acme-cfo"]');
  PERFORM pg_temp.run(acme, 'referral_partners', '{}', '["acme-cfo"]');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.alerts(acme), n0, 'two exports in an hour tell no one');
  PERFORM pg_temp.as_user('rep2', 'acme-brokers');
  PERFORM pg_temp.run(acme, 'referral_partners', '{}', '["acme-cfo"]');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.alerts(acme), n0, 'another member''s first is counted apart');
  PERFORM pg_temp.as_user('rep1', 'acme-brokers');
  PERFORM pg_temp.run(acme, 'referral_partners', '{}', '["acme-law"]');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.alerts(acme), n0 + 1, 'the third by one member tells the owners');
  SELECT payload INTO p FROM public.outbox_events WHERE firm_id = acme AND kind = 'export_alert' AND payload ->> 'member_email' = 'rep1@example.test';
  PERFORM pg_temp.is(p ->> 'member_email', 'rep1@example.test', 'it says who');
  PERFORM pg_temp.is(p ->> 'table_label', 'Referral partners', 'which table');
  PERFORM pg_temp.is(p ->> 'row_count', '1', 'how many rows');
  PERFORM pg_temp.is(p ->> 'exports_in_hour', '3', 'that it was the third in an hour');
  PERFORM pg_temp.is(p ->> 'large', 'false', 'and that it was not large');
  PERFORM pg_temp.is(p ->> 'firm_name', 'Acme Brokers', 'in which firm');
  PERFORM pg_temp.is((SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(p) k), 'exported_at,exports_in_hour,firm_name,large,member_email,row_count,table_label', 'and nothing else: no row, no name of a partner');
  PERFORM pg_temp.is((SELECT session_id IS NULL AND status = 'pending' FROM public.outbox_events WHERE firm_id = acme AND kind = 'export_alert' AND payload ->> 'member_email' = 'rep1@example.test'), true, 'it belongs to the firm, not an intake, and waits to be sent');
  PERFORM pg_temp.as_user('rep1', 'acme-brokers');
  PERFORM pg_temp.run(acme, 'referral_partners', '{}', '["acme-law"]');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.alerts(acme), n0 + 1, 'the fourth tells no one again');

  -- Exports an hour ago are not counted; two within the hour with one now are.
  INSERT INTO public.firm_activity (firm_id, actor_id, kind, record_type, record_id, row_count, at) VALUES
    (acme, pg_temp.id('rep3'), 'export_made', 'table', 'referral_partners', 1, now() - interval '61 minutes'),
    (acme, pg_temp.id('rep3'), 'export_made', 'table', 'referral_partners', 1, now() - interval '2 hours'),
    (acme, pg_temp.id('rep4'), 'export_made', 'table', 'referral_partners', 1, now() - interval '50 minutes'),
    (acme, pg_temp.id('rep4'), 'export_made', 'table', 'referral_partners', 1, now() - interval '10 minutes');
  n0 := pg_temp.alerts(acme);
  PERFORM pg_temp.as_user('rep3', 'acme-brokers');
  PERFORM pg_temp.run(acme, 'referral_partners', '{}', '["acme-cfo"]');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.alerts(acme), n0, 'two exports more than an hour ago, and one now, tell no one');
  PERFORM pg_temp.as_user('rep4', 'acme-brokers');
  PERFORM pg_temp.run(acme, 'referral_partners', '{}', '["acme-cfo"]');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.alerts(acme), n0 + 1, 'two within the last hour and one now do');

  -- A large export: 500 is not, 501 is.
  INSERT INTO public.referral_partners (firm_id, code, name, kind) SELECT big, 'p' || lpad(g::text, 6, '0'), 'Partner ' || g, 'accounting' FROM generate_series(1, 500) g;
  n0 := pg_temp.alerts(big);
  PERFORM pg_temp.as_user('big_agent', 'big-brokers');
  PERFORM pg_temp.is(pg_temp.run(big, 'referral_partners') ->> 'count', '500', 'five hundred rows are exported');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.alerts(big), n0, 'and tell no one');
  INSERT INTO public.referral_partners (firm_id, code, name, kind) VALUES (big, 'p000501', 'Partner 501', 'accounting');
  PERFORM pg_temp.as_user('big_owner', 'big-brokers');
  PERFORM pg_temp.is(pg_temp.run(big, 'referral_partners') ->> 'count', '501', 'five hundred and one are exported');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.alerts(big), n0 + 1, 'and tell the owners');
  SELECT payload INTO p FROM public.outbox_events WHERE firm_id = big AND kind = 'export_alert' AND payload ->> 'member_email' = 'big_owner@example.test';
  PERFORM pg_temp.is(p ->> 'large', 'true', 'as a large one');
  PERFORM pg_temp.is(p ->> 'row_count', '501', 'with its count');
  PERFORM pg_temp.is(p ->> 'exports_in_hour', '1', 'the first of the hour');
  PERFORM pg_temp.is((SELECT count(*) FROM public.outbox_events WHERE kind = 'export_alert' AND firm_id NOT IN (acme, big)), 0::bigint, 'no alert belongs to another firm');
  PERFORM pg_temp.is((SELECT count(DISTINCT dedupe_key) FROM public.outbox_events WHERE kind = 'export_alert'), (SELECT count(*) FROM public.outbox_events WHERE kind = 'export_alert'), 'each alert is its own: two exports are never one alert');
  RAISE NOTICE 'export: the alert passed';
END $$;

-- ---------- the most rows ----------
-- Break caught: an export of more than 50,000 rows is given (or recorded, or alerted) all the same; the limit counts what is not given; a
-- filter that brings it under the limit is refused.
DO $$
DECLARE big uuid := pg_temp.id('big'); before_n bigint;
BEGIN
  SET LOCAL session_replication_role = replica;
  INSERT INTO public.referral_partners (firm_id, code, name, kind) SELECT big, 'q' || lpad(g::text, 6, '0'), 'Other ' || g, 'other' FROM generate_series(1, 49499) g;
  RESET session_replication_role;
  PERFORM pg_temp.is((SELECT count(*) FROM public.referral_partners WHERE firm_id = big), 50000::bigint, 'the firm holds exactly 50,000 partners');
  PERFORM pg_temp.as_user('big_agent', 'big-brokers');
  PERFORM pg_temp.is(pg_temp.run(big, 'referral_partners', '{"kind":"other"}') ->> 'count', '49499', 'the most is not too many');
  RESET ROLE;
  SET LOCAL session_replication_role = replica;
  INSERT INTO public.referral_partners (firm_id, code, name, kind) VALUES (big, 'q999999', 'One too many', 'other');
  RESET session_replication_role;
  SELECT count(*) INTO before_n FROM public.firm_activity WHERE kind = 'export_made' AND firm_id = big;
  PERFORM pg_temp.as_user('big_agent', 'big-brokers');
  PERFORM pg_temp.is(pg_temp.try(big, 'referral_partners'), 'PT413: That is more than 50,000 rows. Narrow it with a filter and export again.', 'one more is refused in words');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'export_made' AND firm_id = big), before_n, 'and not recorded');
  PERFORM pg_temp.as_user('big_agent', 'big-brokers');
  PERFORM pg_temp.is(pg_temp.run(big, 'referral_partners', '{"kind":"accounting"}') ->> 'count', '501', 'a filter that brings it under is let through');
  RESET ROLE;
  RAISE NOTICE 'export: the most rows passed';
END $$;

-- ---------- reading the record of exports ----------
-- Break caught: the count is not given to the owners who read the record; an agent reads it; another firm's owner reads it; the record can be
-- changed after the fact.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); e record; n bigint;
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  SELECT * INTO e FROM public.firm_activity_list(acme, pg_temp.id('acme_agent'), 'export_made', 10) ORDER BY at LIMIT 1;
  PERFORM pg_temp.is(e.row_count, 3, 'the owner reads how many rows the entry says');
  PERFORM pg_temp.is(e.record_type || ':' || e.record_id, 'table:referral_partners', 'and which table');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity_list(acme, NULL, 'sign_in', 10) WHERE row_count IS NOT NULL), 0::bigint, 'an entry of another kind has none');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$UPDATE public.firm_activity SET row_count = 0 WHERE firm_id = %L$q$, acme)), '42501: permission denied for table firm_activity', 'an owner can''t change it');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.firm_activity_list(%L)$q$, acme)), '42501: Only a firm''s owners can read its record', 'an agent reads none of it');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity), 0::bigint, 'by the table either');
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'export_made' AND firm_id = acme), 0::bigint, 'another firm''s owner sees none of acme''s exports');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.refusal(format($q$UPDATE public.firm_activity SET row_count = 0 WHERE firm_id = %L$q$, acme)), '42501: firm_activity records cannot be changed or deleted', 'and nobody changes one afterwards, the superuser included');
  RAISE NOTICE 'export: reading the record passed';
END $$;

-- ---------- the table list and its readers ----------
-- Break caught: a table is listed that has no reader (the export would fail only when someone asked); a reader or the table list can be run by
-- a browser (a reader skips the checks the function makes); a reader exists that no list names; the registry names an intake's answers, a
-- census or a FEIN; the limits are not the ones the story names.
DO $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT * FROM public.export_table_registry() LOOP
    n := n + 1;
    PERFORM pg_temp.is(to_regprocedure(format('public.export_source_%s(uuid, jsonb, jsonb, integer)', r.name)) IS NOT NULL, true, r.name || ' has its reader');
    PERFORM pg_temp.is(has_function_privilege('authenticated', to_regprocedure(format('public.export_source_%s(uuid, jsonb, jsonb, integer)', r.name)), 'EXECUTE')
                       OR has_function_privilege('anon', to_regprocedure(format('public.export_source_%s(uuid, jsonb, jsonb, integer)', r.name)), 'EXECUTE'), false, r.name || '''s reader is closed to the API');
    PERFORM pg_temp.is(r.who IN ('member', 'owner'), true, r.name || ' says who may export it');
    PERFORM pg_temp.is(jsonb_typeof(r.columns), 'array', r.name || ' lists its columns');
    PERFORM pg_temp.is(r.name !~* '(session|intake|census|fein|answer|queue|submission)', true, r.name || ' is no intake, no census and no queue');
    PERFORM pg_temp.is(r.columns::text !~* '(fein|census|answers|chamber_data|ssn|tax_id)', true, r.name || ' lists no column of an intake''s answers, a census or a FEIN');
  END LOOP;
  PERFORM pg_temp.is(n, 2, 'two tables are listed today: referral partners, and for owners the firm''s record');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname LIKE 'export\_source\_%'), 2::bigint, 'and two readers exist: none that is not listed');
  PERFORM pg_temp.is((SELECT who FROM public.export_table_registry() WHERE name = 'firm_activity'), 'owner', 'the record is for owners');
  PERFORM pg_temp.is((SELECT who FROM public.export_table_registry() WHERE name = 'referral_partners'), 'member', 'partners for any member');
  PERFORM pg_temp.is(public.export_limits(), '{"sign_in_hours":12,"alert_rows":500,"alert_repeats":3,"alert_minutes":60,"most_rows":50000,"most_ids":1000}'::jsonb, 'the limits are written once, as the story says');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.export_source_referral_partners(%L, '{}', NULL, 10)$q$, pg_temp.id('acme'))) LIKE '42501:%', true, 'a reader cannot be run by a person');
  PERFORM pg_temp.is(pg_temp.refusal('SELECT public.export_table_registry()') LIKE '42501:%', true, 'nor the list');
  RESET ROLE;
  RAISE NOTICE 'export: the table list passed';
END $$;

-- ---------- the alert's email kind ----------
-- Break caught: the kind is not one the outbox knows; it is not a firm's alert (it would be sent while the firm is suspended, or a bounce would
-- suppress an owner); an alert can be made for an intake or with no firm.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); intake uuid;
BEGIN
  PERFORM pg_temp.is(public.outbox_kind_is_firm_alert('export_alert'), true, 'the alert is a firm''s alert');
  INSERT INTO public.chamber_sessions (user_id, firm_id, chamber_data) VALUES (pg_temp.id('nobody'), acme, '{}') RETURNING id INTO intake;
  PERFORM pg_temp.is(pg_temp.refusal(format($q$INSERT INTO public.outbox_events (kind, session_id, dedupe_key, payload) VALUES ('export_alert', %L, 'x', '{}')$q$, intake)) LIKE '23514:%', true, 'it can''t be about an intake');
  PERFORM pg_temp.is(pg_temp.refusal($q$INSERT INTO public.outbox_events (kind, dedupe_key, payload) VALUES ('export_alert', 'y', '{}')$q$) LIKE '23514:%', true, 'nor about no firm');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$INSERT INTO public.outbox_events (kind, firm_id, dedupe_key, payload) VALUES ('export_alert', %L, 'z', '{}')$q$, acme)), 'ok', 'it is about a firm');
  RAISE NOTICE 'export: the alert kind passed';
END $$;
