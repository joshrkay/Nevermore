-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh leave_a_firm
-- Leaving a firm (story CRM-P1.6; docs/BROKER_CRM_BUILD.md D-16, D-18, D-33, D-35, D-102, D-105;
-- 20261118090000_leave_a_firm.sql). A current member of a firm, whatever their role, ends their own membership now. It does what
-- an owner removing them does (the same step: dated, kept, never deleted; their stored mailbox deleted with their last membership;
-- what they created stays), is written to the firm's record as "member_left", and queues one email to the firm's owners that
-- names who left and when. The last owner of a firm cannot leave. Two firms are used throughout. Every migration is loaded, in
-- filename order (D-105), this story's last.
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
SET client_min_messages = notice;

CREATE TEMP TABLE fx (name text PRIMARY KEY, id uuid NOT NULL);
GRANT SELECT ON fx TO anon, authenticated, service_role;
CREATE FUNCTION pg_temp.id(n text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM fx WHERE name = n $$;

CREATE FUNCTION pg_temp.new_user(n text, guest boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', CASE WHEN guest THEN NULL ELSE n || '@example.test' END,
          CASE WHEN NOT guest THEN now() END, guest, now(), now());
  INSERT INTO fx VALUES (n, uid);
  RETURN uid;
END $$;

-- Acts as a signed-in person. `how` 'google' is a sign-in through a provider; 'password' one with a password and no second
-- factor; 'password_mfa' one with the second factor completed (D-19).
CREATE FUNCTION pg_temp.as_user(n text, how text DEFAULT 'google') RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    (jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', false, 'email', n || '@example.test')
     || CASE WHEN how IN ('password', 'password_mfa')
          THEN jsonb_build_object('amr', jsonb_build_array(jsonb_build_object('method', 'password', 'timestamp', 1)),
                                  'aal', CASE WHEN how = 'password' THEN 'aal1' ELSE 'aal2' END)
          ELSE '{}'::jsonb END)::text, false);
  SET LOCAL ROLE authenticated;
END $$;

CREATE FUNCTION pg_temp.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', false);
  SET LOCAL ROLE service_role;
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

-- What the firm's record holds, read as the table's owner so the tests see every firm's entries.
CREATE FUNCTION pg_temp.acts(fid uuid, k text) RETURNS SETOF public.firm_activity LANGUAGE sql SECURITY DEFINER AS $$
  SELECT * FROM public.firm_activity WHERE firm_id = fid AND kind = k
$$;


-- ---------- set up: two firms; each has owners, a lead and agents; a platform admin; a person with no firm ----------
DO $$
DECLARE acme uuid; zenith uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Acme Brokers', 'acme-brokers', now()) RETURNING id INTO acme;
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Zenith Benefits', 'zenith-benefits', now()) RETURNING id INTO zenith;
  INSERT INTO fx VALUES ('acme', acme), ('zenith', zenith);
  PERFORM pg_temp.new_user('acme_owner'); PERFORM pg_temp.new_user('acme_owner_2'); PERFORM pg_temp.new_user('acme_lead');
  PERFORM pg_temp.new_user('acme_agent'); PERFORM pg_temp.new_user('acme_agent_2'); PERFORM pg_temp.new_user('acme_agent_3');
  PERFORM pg_temp.new_user('zenith_owner'); PERFORM pg_temp.new_user('zenith_agent');
  PERFORM pg_temp.new_user('platform_admin'); PERFORM pg_temp.new_user('nobody');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES
    (acme, pg_temp.id('acme_owner'), 'owner'), (acme, pg_temp.id('acme_owner_2'), 'owner'), (acme, pg_temp.id('acme_lead'), 'lead'),
    (acme, pg_temp.id('acme_agent'), 'agent'), (acme, pg_temp.id('acme_agent_2'), 'agent'), (acme, pg_temp.id('acme_agent_3'), 'agent'),
    (zenith, pg_temp.id('zenith_owner'), 'owner'), (zenith, pg_temp.id('zenith_agent'), 'agent');
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('platform_admin'), 'admin');
END $$;

-- ---------- leaving ----------
-- Break caught: leaving deletes the membership row (history lost), leaves the person a member, or dates the end wrongly.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); before_rows bigint; m public.firm_memberships;
BEGIN
  SELECT count(*) INTO before_rows FROM public.firm_memberships WHERE firm_id = acme;
  PERFORM pg_temp.as_user('acme_agent');
  PERFORM public.leave_firm(acme);
  RESET ROLE;
  SELECT * INTO m FROM public.firm_memberships WHERE firm_id = acme AND user_id = pg_temp.id('acme_agent');
  PERFORM pg_temp.is(m.valid_until IS NOT NULL AND m.valid_until <= now() AND m.valid_until >= now() - interval '1 minute', true, 'the membership ends now');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_memberships WHERE firm_id = acme), before_rows, 'the membership is kept, never deleted');
  PERFORM pg_temp.as_user('acme_agent');
  PERFORM pg_temp.is(public.is_firm_member(acme), false, 'the person who left is no longer a member');
  PERFORM pg_temp.is((SELECT count(*) FROM public.my_firms()), 0::bigint, 'they keep their sign-in and see no firm');
  RESET ROLE;
  RAISE NOTICE 'leave_a_firm: leaving passed';
END $$;

-- ---------- the firm's record ----------
-- Break caught: leaving is written as a removal (or as nothing, or twice), so the owners can't tell who chose to go; the entry names
-- someone else as the actor; or a platform admin who is also a member is shown as "Nevermore" (D-33).
DO $$
DECLARE acme uuid := pg_temp.id('acme'); a public.firm_activity; mid bigint;
BEGIN
  PERFORM pg_temp.as_user('acme_agent_2');
  PERFORM public.leave_firm(acme);
  RESET ROLE;
  SELECT id INTO mid FROM public.firm_memberships WHERE firm_id = acme AND user_id = pg_temp.id('acme_agent_2');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.acts(acme, 'member_left') WHERE subject_user_id = pg_temp.id('acme_agent_2')), 1::bigint, 'leaving is written once, as its own kind');
  SELECT * INTO a FROM pg_temp.acts(acme, 'member_left') WHERE subject_user_id = pg_temp.id('acme_agent_2');
  PERFORM pg_temp.is(a.actor_id, pg_temp.id('acme_agent_2'), 'the person who left is the actor');
  PERFORM pg_temp.is(a.role, 'agent', 'with the role they held');
  PERFORM pg_temp.is(a.record_type || ':' || a.record_id, 'membership:' || mid, 'about their membership');
  PERFORM pg_temp.is(a.actor_is_staff, false, 'and not Nevermore staff');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.acts(acme, 'member_removed') WHERE subject_user_id = pg_temp.id('acme_agent_2')), 0::bigint, 'it is not recorded as a removal');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.acts(acme, 'member_ended') WHERE subject_user_id = pg_temp.id('acme_agent_2')), 0::bigint, 'nor as a second, generic ending');

  -- A platform admin who is also a member acts as a member when they leave: shown as themselves, not as Nevermore.
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (acme, pg_temp.id('platform_admin'), 'agent');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.leave_firm(acme);
  RESET ROLE;
  PERFORM pg_temp.is((SELECT actor_is_staff FROM pg_temp.acts(acme, 'member_left') WHERE subject_user_id = pg_temp.id('platform_admin')), false, 'a member who also holds a platform role is shown as themselves (D-33)');
  RAISE NOTICE 'leave_a_firm: record passed';
END $$;

-- ---------- who may leave ----------
-- Break caught: a person leaves a firm they don't belong to, or a firm taken from someone else's word; a signed-out caller, the
-- service role, a platform admin who is no member, or a password sign-in with no second factor is let through; someone who already
-- left leaves again (a second entry in the record, a second email).
DO $$
DECLARE acme uuid := pg_temp.id('acme'); stmt text := format('SELECT public.leave_firm(%L)', pg_temp.id('acme'));
BEGIN
  PERFORM pg_temp.as_user('zenith_agent');
  PERFORM pg_temp.is(pg_temp.attempt(stmt), '42501', 'another firm''s member can''t leave this firm');
  PERFORM pg_temp.as_user('nobody');
  PERFORM pg_temp.is(pg_temp.attempt(stmt), '42501', 'a person with no firm has nothing to leave');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is(pg_temp.attempt(stmt), '42501', 'a platform admin who is not a member has nothing to leave (D-16)');
  PERFORM pg_temp.as_user('acme_lead', 'password');
  PERFORM pg_temp.is(pg_temp.attempt(stmt), '42501', 'a member signed in with a password and no second factor can''t act as one (D-19)');
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', false);
  SET LOCAL ROLE anon;
  PERFORM pg_temp.is(pg_temp.attempt(stmt), '42501', 'a signed-out caller can''t leave');
  RESET ROLE;
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(pg_temp.attempt(stmt), '42501', 'the service role isn''t a person');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_memberships WHERE firm_id = acme AND valid_until IS NULL AND user_id IN (pg_temp.id('zenith_agent'), pg_temp.id('acme_lead'))), 1::bigint, 'none of those ended anyone''s membership');

  -- someone who already left
  PERFORM pg_temp.as_user('acme_agent');
  PERFORM pg_temp.is(pg_temp.attempt(stmt), '42501', 'someone who already left leaves nothing a second time');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.acts(acme, 'member_left') WHERE subject_user_id = pg_temp.id('acme_agent')), 1::bigint, 'and the record holds one entry');
  RAISE NOTICE 'leave_a_firm: who may leave passed';
END $$;

-- ---------- the last owner stays ----------
-- Break caught: a firm is left with no owner; the refusal is in database words, not plain ones; the refused attempt still changes
-- something (a membership ended, an entry in the record, an email queued) because the steps were not one.
DO $$
DECLARE
  acme uuid := pg_temp.id('acme'); r text; entries bigint; mails bigint;
BEGIN
  PERFORM pg_temp.new_user('lapsing_owner');
  INSERT INTO public.firm_memberships (firm_id, user_id, role, valid_from, valid_until)
  VALUES (acme, pg_temp.id('lapsing_owner'), 'owner', now() - interval '1 day', now() + interval '30 days');
  -- acme_owner_2 leaves while acme_owner stays: allowed.
  PERFORM pg_temp.as_user('acme_owner_2');
  PERFORM public.leave_firm(acme);
  RESET ROLE;
  PERFORM pg_temp.is((SELECT valid_until IS NOT NULL FROM public.firm_memberships WHERE firm_id = acme AND user_id = pg_temp.id('acme_owner_2')), true, 'one of two owners can leave');
  SELECT count(*) INTO entries FROM public.firm_activity WHERE firm_id = acme;
  SELECT count(*) INTO mails FROM public.outbox_events WHERE kind = 'member_left';
  -- acme_owner is now the only owner that lasts (lapsing_owner's membership has an end date): they can't leave.
  PERFORM pg_temp.as_user('acme_owner');
  r := pg_temp.refusal(format('SELECT public.leave_firm(%L)', acme));
  PERFORM pg_temp.is(r, '23514: You are the last owner of this firm, so you can''t leave it. Make someone else an owner first.', 'the last owner is told why they can''t leave');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT valid_until IS NULL FROM public.firm_memberships WHERE firm_id = acme AND user_id = pg_temp.id('acme_owner')), true, 'and is still a member');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE firm_id = acme), entries, 'nothing was written to the firm''s record');
  PERFORM pg_temp.is((SELECT count(*) FROM public.outbox_events WHERE kind = 'member_left'), mails, 'and no email was queued');
  -- put the firm back for the rest of the file
  DELETE FROM public.firm_memberships WHERE user_id = pg_temp.id('lapsing_owner');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (acme, pg_temp.id('acme_owner_2'), 'owner');
  RAISE NOTICE 'leave_a_firm: last owner passed';
END $$;

-- ---------- a stored mailbox, and what they made ----------
-- Break caught: a person who leaves their only firm keeps their stored mailbox (their credential outlives their access); one who
-- leaves one of two firms loses it for the firm they stay in; what they made leaves with them.
CREATE FUNCTION pg_temp.store_mailbox(n text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.mailbox_store(pg_temp.id(n), 'google', n || '@gmail.example', 'scope', 'CIPHERTEXT', 'IV');
END $$;
CREATE FUNCTION pg_temp.stored(n text) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.broker_mailboxes WHERE user_id = pg_temp.id(n))
$$;
CREATE FUNCTION pg_temp.usable(n text) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE r boolean;
BEGIN
  PERFORM pg_temp.as_service();
  r := public.mailbox_secret(pg_temp.id(n)) IS NOT NULL;
  PERFORM pg_temp.as_user(n);
  RETURN r AND COALESCE((public.my_mailbox() ->> 'connected')::boolean, false);
END $$;

DO $$
DECLARE
  acme uuid := pg_temp.id('acme'); zenith uuid := pg_temp.id('zenith'); sid uuid;
BEGIN
  PERFORM pg_temp.new_user('mb_one'); PERFORM pg_temp.new_user('mb_two');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES
    (acme, pg_temp.id('mb_one'), 'agent'),
    (acme, pg_temp.id('mb_two'), 'agent'), (zenith, pg_temp.id('mb_two'), 'agent');
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.store_mailbox('mb_one'); PERFORM pg_temp.store_mailbox('mb_two');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.usable('mb_one'), true, 'a member can use their mailbox');

  PERFORM pg_temp.as_user('mb_one');
  PERFORM public.leave_firm(acme);
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.stored('mb_one'), false, 'left their only firm: the stored mailbox is deleted');

  PERFORM pg_temp.as_user('mb_two');
  PERFORM public.leave_firm(acme);
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.stored('mb_two'), true, 'left one of two firms: the mailbox is kept');
  PERFORM pg_temp.is(pg_temp.usable('mb_two'), true, 'and still works for the firm they stay in');
  PERFORM pg_temp.as_user('mb_two');
  PERFORM public.leave_firm(zenith);
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.stored('mb_two'), false, 'left the second firm too: now it is deleted');

  -- What they made stays with the firm: an intake they started for the firm is still the firm's.
  INSERT INTO public.chamber_sessions (user_id, firm_id) VALUES (pg_temp.id('mb_one'), acme) RETURNING id INTO sid;
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_sessions WHERE id = sid), 1::bigint, 'what a person made stays with the firm after they leave');
  RESET ROLE;
  RAISE NOTICE 'leave_a_firm: mailbox passed';
END $$;

-- ---------- telling the owners ----------
-- Leaving queues one email to the firm's owners, through the outbox the firm's alerts already use, in the same step as the leaving.
-- It names who left and when and carries nothing else (no role, no reason, nothing the person made). The owners are looked up when the
-- email is sent (D-35): a current owner only, never the person who left, never another firm's owners, nobody while the firm is suspended.
-- Break caught: nobody is told; the email is queued outside the step (a leave that fails still tells, or a told leave is lost); it is
-- queued twice; it carries more than the person and the time; it reaches the leaver, a member who isn't an owner, or another firm's
-- owners; it is sent for a suspended firm; a bounce on an owner's address suppresses it for good.
-- Whether the dispatcher claims this event when it asks for 'member_left' mail. Every such event is put back first, so each question is fresh.
CREATE FUNCTION pg_temp.claims_it(ev uuid) RETURNS boolean AS $$
DECLARE r boolean;
BEGIN
  UPDATE public.outbox_events SET status = 'pending', attempts = 0, locked_until = NULL, claimed_at = NULL, next_attempt_at = now() WHERE kind = 'member_left';
  PERFORM pg_temp.as_service();
  SELECT EXISTS (SELECT 1 FROM public.claim_outbox_events(ARRAY['member_left'], 100, 5, 600) c WHERE c.id = ev) INTO r;
  RESET ROLE;
  RETURN r;
END $$ LANGUAGE plpgsql;

CREATE FUNCTION pg_temp.owners_of(fid uuid) RETURNS text AS $$
DECLARE r text;
BEGIN
  PERFORM pg_temp.as_service();
  SELECT COALESCE(string_agg(e, ',' ORDER BY e COLLATE "C"), '') INTO r FROM unnest(public.outbox_owner_recipients(fid)) AS e;
  RESET ROLE;
  RETURN r;
END $$ LANGUAGE plpgsql;

DO $$
DECLARE
  zenith uuid := pg_temp.id('zenith'); ev public.outbox_events; before_at timestamptz := now(); owners_before text;
BEGIN
  PERFORM pg_temp.new_user('zenith_agent_2');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (zenith, pg_temp.id('zenith_agent_2'), 'agent');
  PERFORM pg_temp.is(pg_temp.owners_of(zenith), 'zenith_owner@example.test', 'before: the owners are the firm''s owner and nobody else');

  PERFORM pg_temp.as_user('zenith_agent_2');
  PERFORM public.leave_firm(zenith);
  RESET ROLE;

  PERFORM pg_temp.is((SELECT count(*) FROM public.outbox_events WHERE kind = 'member_left' AND firm_id = zenith AND payload ->> 'member_email' = 'zenith_agent_2@example.test'), 1::bigint, 'one email is queued for the firm''s owners');
  SELECT * INTO ev FROM public.outbox_events WHERE kind = 'member_left' AND firm_id = zenith AND payload ->> 'member_email' = 'zenith_agent_2@example.test';
  PERFORM pg_temp.is(ev.session_id IS NULL, true, 'it belongs to the firm, not to an intake');
  PERFORM pg_temp.is(ev.status, 'pending', 'and waits to be sent');
  PERFORM pg_temp.is((SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(ev.payload) k), ARRAY['firm_name', 'left_at', 'member_email'], 'it carries who left, when, and the firm''s name, and nothing else');
  PERFORM pg_temp.is(ev.payload ->> 'member_email', 'zenith_agent_2@example.test', 'who left');
  PERFORM pg_temp.is(ev.payload ->> 'firm_name', 'Zenith Benefits', 'from which firm');
  PERFORM pg_temp.is((ev.payload ->> 'left_at')::timestamptz BETWEEN before_at - interval '1 second' AND now() + interval '1 second', true, 'and when');
  PERFORM pg_temp.is((SELECT date_trunc('second', valid_until) FROM public.firm_memberships WHERE firm_id = zenith AND user_id = pg_temp.id('zenith_agent_2')), (ev.payload ->> 'left_at')::timestamptz, 'the time told is the time the membership ended');

  -- who it goes to, asked when it is sent
  PERFORM pg_temp.is(pg_temp.owners_of(zenith), 'zenith_owner@example.test', 'it goes to the firm''s owners only: not the member who left, not another firm''s owners');
  PERFORM pg_temp.is(pg_temp.owners_of(pg_temp.id('acme')), 'acme_owner@example.test,acme_owner_2@example.test', 'each firm has its own owners');
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.outbox_owner_recipients(%L)', zenith)), '42501', 'a person can''t ask who the owners are: only the dispatcher can');
  RESET ROLE;

  -- the dispatcher claims it (it is a firm's alert, so not while the firm is suspended)
  PERFORM pg_temp.is(pg_temp.claims_it(ev.id), true, 'the dispatcher claims it');
  INSERT INTO public.firm_suspensions (firm_id, suspended_by, reason) VALUES (zenith, pg_temp.id('platform_admin'), 'test');
  PERFORM pg_temp.is(pg_temp.owners_of(zenith), '', 'a suspended firm has nobody to tell');
  PERFORM pg_temp.is(pg_temp.claims_it(ev.id), false, 'and the email waits while the firm is suspended');
  UPDATE public.firm_suspensions SET lifted_at = now() WHERE firm_id = zenith;
  PERFORM pg_temp.is(pg_temp.claims_it(ev.id), true, 'and goes when it is lifted');

  -- a bounce on an owner's address never suppresses it
  UPDATE public.outbox_events SET provider_message_id = 'prov_left_1', status = 'sent' WHERE id = ev.id;
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(public.record_email_delivery_event('evt_left_1', 'email.bounced', 'prov_left_1', ARRAY['zenith_owner@example.test'], 'Permanent', NULL, now(), ARRAY[]::text[]) ->> 'outcome', 'protected', 'a bounce on an owner''s address is recorded but protected');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.email_suppressions WHERE address = 'zenith_owner@example.test'), 0::bigint, 'and suppresses nothing');

  -- queued in the same step: a failure to queue undoes the leaving
  CREATE FUNCTION pg_temp.refuse_outbox() RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN RAISE EXCEPTION 'outbox is down'; END $f$;
  CREATE TRIGGER refuse_outbox BEFORE INSERT ON public.outbox_events FOR EACH ROW EXECUTE FUNCTION pg_temp.refuse_outbox();
  PERFORM pg_temp.as_user('acme_agent_3');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.leave_firm(%L)', pg_temp.id('acme'))), 'P0001', 'when the email can''t be queued the person has not left');
  RESET ROLE;
  DROP TRIGGER refuse_outbox ON public.outbox_events;
  PERFORM pg_temp.is((SELECT valid_until IS NULL FROM public.firm_memberships WHERE firm_id = pg_temp.id('acme') AND user_id = pg_temp.id('acme_agent_3')), true, 'still a member');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.acts(pg_temp.id('acme'), 'member_left') WHERE subject_user_id = pg_temp.id('acme_agent_3')), 0::bigint, 'and nothing is written to the record');
  RAISE NOTICE 'leave_a_firm: owners told passed';
END $$;

-- Break caught: a member who is not an owner is mailed when someone leaves; a removal tells the owners as if the person chose to go.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.outbox_events WHERE kind = 'member_left';
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.remove_member(acme, pg_temp.id('acme_agent_3'));
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.outbox_events WHERE kind = 'member_left'), n, 'an owner removing someone queues no "left" email');
  PERFORM pg_temp.is(pg_temp.owners_of(acme) !~ 'lead|agent', true, 'a lead or an agent is never among the owners told');
  RAISE NOTICE 'leave_a_firm: removal tells no one passed';
END $$;

-- ---------- removing is still removing (it now shares the ending with leaving) ----------
-- firm_members.sql proves CRM-P1.5 up to the migration that moved the ending into end_membership_now; this proves it after.
-- Break caught: the shared ending dates a removal wrongly or not at all; a removal is written as a leaving; the last owner can be
-- removed, or is refused in the leaving's words instead of the removal's.
DO $$
DECLARE
  zenith uuid := pg_temp.id('zenith'); m public.firm_memberships;
BEGIN
  PERFORM pg_temp.new_user('rm_agent');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (zenith, pg_temp.id('rm_agent'), 'agent');
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM public.remove_member(zenith, pg_temp.id('rm_agent'));
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.remove_member(%L, %L)', zenith, pg_temp.id('zenith_owner'))), 'PT409: You can''t remove yourself', 'an owner still can''t remove themself');
  RESET ROLE;
  SELECT * INTO m FROM public.firm_memberships WHERE firm_id = zenith AND user_id = pg_temp.id('rm_agent');
  PERFORM pg_temp.is(m.valid_until IS NOT NULL AND m.valid_until <= now() AND m.valid_until >= now() - interval '1 minute', true, 'a removal ends the membership now');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.acts(zenith, 'member_removed') WHERE subject_user_id = pg_temp.id('rm_agent')), 1::bigint, 'and is written once, as a removal');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.acts(zenith, 'member_left') WHERE subject_user_id = pg_temp.id('rm_agent')), 0::bigint, 'never as a leaving');

  -- a second owner so the first can be removed, then the last owner can't be
  PERFORM pg_temp.new_user('rm_owner');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (zenith, pg_temp.id('rm_owner'), 'owner');
  PERFORM pg_temp.as_user('rm_owner');
  PERFORM public.remove_member(zenith, pg_temp.id('zenith_owner'));
  RESET ROLE;
  PERFORM pg_temp.new_user('rm_helper');
  INSERT INTO public.firm_memberships (firm_id, user_id, role, valid_from, valid_until)
  VALUES (zenith, pg_temp.id('rm_helper'), 'owner', now() - interval '1 day', now() + interval '30 days');
  PERFORM pg_temp.as_user('rm_helper');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.remove_member(%L, %L)', zenith, pg_temp.id('rm_owner'))), '23514: The last owner of a firm can''t be removed. Make someone else an owner first.', 'the last owner is refused in the removal''s own words');
  RESET ROLE;
  RAISE NOTICE 'leave_a_firm: removal after the shared ending passed';
END $$;

-- ---------- firm-level outbox rows are kept ninety days, like the firm's record (D-106) ----------
-- A "member left" email holds the leaver's address, the firm's name and the owners' addresses. It is deleted 90 days after it was queued,
-- by the daily job that prunes the firm's record. Intake-bound rows are not touched: they go with their intake.
-- Break caught: firm-level rows live for ever; the window is not the firm record's; an intake's queued email is deleted by it; a person
-- can run it; it is a second scheduler instead of part of the existing daily job.
DO $$
DECLARE
  acme uuid := pg_temp.id('acme'); sid uuid; removed integer;
BEGIN
  INSERT INTO public.chamber_sessions (user_id, firm_id) VALUES (pg_temp.new_user('prune_prospect'), acme) RETURNING id INTO sid;
  INSERT INTO public.outbox_events (kind, firm_id, dedupe_key, payload, created_at) VALUES
    ('member_left', acme, 'prune-old', '{}', now() - interval '91 days'),
    ('member_left', acme, 'prune-new', '{}', now() - interval '89 days');
  INSERT INTO public.outbox_events (kind, session_id, dedupe_key, payload, created_at)
  VALUES ('advisor_notification', sid, 'prune-intake-old', '{"reference":"x"}', now() - interval '200 days');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT public.prune_firm_outbox_events()'), '42501', 'a person can''t run the clean-up');
  RESET ROLE;
  PERFORM pg_temp.as_service();
  removed := public.prune_firm_outbox_events();
  RESET ROLE;
  PERFORM pg_temp.is(removed, 1, 'it reports how many it removed');
  PERFORM pg_temp.is((SELECT count(*) FROM public.outbox_events WHERE dedupe_key = 'prune-old'), 0::bigint, 'a firm-level row older than 90 days is deleted');
  PERFORM pg_temp.is((SELECT count(*) FROM public.outbox_events WHERE dedupe_key = 'prune-new'), 1::bigint, 'a newer one is kept');
  PERFORM pg_temp.is((SELECT count(*) FROM public.outbox_events WHERE dedupe_key = 'prune-intake-old'), 1::bigint, 'an intake-bound row is left alone, however old');
  PERFORM pg_temp.is((SELECT interval '90 days' = public.firm_activity_retention()), true, 'the window is the firm record''s');
  PERFORM pg_temp.is((SELECT command FROM cron.job WHERE jobname = 'prune-firm-activity'), 'select public.prune_firm_activity(); select public.prune_firm_outbox_events(); select public.close_due_firms(); select public.settle_support_sessions();', 'it runs in the firm record''s daily job, which CRM-P1.7 gave one more step (closing the firms whose 30 days have passed) and CRM-P2.4 another (recording the support sessions that ran out)');
  PERFORM pg_temp.is((SELECT count(*) FROM cron.job), 1::bigint, 'and no second job was made');
  RAISE NOTICE 'leave_a_firm: outbox retention passed';
END $$;

-- ---------- an index on the firm of an outbox row ----------
-- Break caught: deleting a firm, or the clean-up above, scans every outbox row.
DO $$
BEGIN
  PERFORM pg_temp.is(EXISTS (
    SELECT 1 FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
    WHERE i.indrelid = 'public.outbox_events'::regclass AND a.attname = 'firm_id'), true, 'outbox_events is indexed by firm_id');
  RAISE NOTICE 'leave_a_firm: outbox firm index passed';
END $$;

-- ---------- leaving twice at once (D-32) ----------
-- The row lock in leave_firm makes a second leave by the same person wait and then find the membership already ended, so it gets the
-- plain "You are not a member of this firm" (PT404). Without the lock it runs its own update on the ended row, and the history trigger
-- refuses it in database words (42501, "A membership is never changed").
-- Break caught: the lock is removed.
CREATE SCHEMA race;
CREATE EXTENSION dblink SCHEMA race;
-- The person is made in a block of its own, so it is committed before the other sessions look.
DO $$
BEGIN
  PERFORM pg_temp.new_user('dbl_agent');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (pg_temp.id('acme'), pg_temp.id('dbl_agent'), 'agent');
END $$;
DO $$
DECLARE
  f uuid := pg_temp.id('acme');
  dsn text := format('dbname=%s user=%s port=%s host=%s', current_database(), session_user, current_setting('port'),
    split_part(current_setting('unix_socket_directories'), ',', 1));
  claims text;
  second_pid integer;
  tries integer := 0;
  s text;
  m text;
BEGIN
  claims := format($q$SELECT set_config('request.jwt.claims', %L, true)$q$,
    jsonb_build_object('sub', pg_temp.id('dbl_agent'), 'role', 'authenticated', 'is_anonymous', false, 'email', 'dbl_agent@example.test')::text);
  PERFORM race.dblink_connect('race_first', dsn);
  PERFORM race.dblink_connect('race_second', dsn);
  PERFORM race.dblink_exec('race_second', 'SET lock_timeout = ''20s''');
  SELECT pid INTO second_pid FROM race.dblink('race_second', 'SELECT pg_backend_pid()') AS t(pid integer);
  PERFORM race.dblink_exec('race_first', 'BEGIN');
  PERFORM race.dblink_exec('race_first', 'SET LOCAL ROLE authenticated');
  PERFORM * FROM race.dblink('race_first', claims) AS t(c text);
  PERFORM * FROM race.dblink('race_first', format($q$SELECT public.leave_firm(%L)::text$q$, f)) AS t(r text);
  PERFORM race.dblink_exec('race_second', 'BEGIN');
  PERFORM race.dblink_exec('race_second', 'SET LOCAL ROLE authenticated');
  PERFORM * FROM race.dblink('race_second', claims) AS t(c text);
  PERFORM race.dblink_send_query('race_second', format($q$SELECT public.leave_firm(%L)::text$q$, f));
  WHILE cardinality(pg_blocking_pids(second_pid)) = 0 AND race.dblink_is_busy('race_second') = 1 LOOP
    tries := tries + 1;
    IF tries > 100 THEN EXIT; END IF;
    PERFORM pg_sleep(0.05);
  END LOOP;
  PERFORM race.dblink_exec('race_first', 'COMMIT');
  BEGIN
    PERFORM * FROM race.dblink_get_result('race_second') AS t(r text);
    RAISE EXCEPTION 'FAIL: the person left twice';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT;
    IF m LIKE 'FAIL:%' THEN RAISE; END IF;
    IF m NOT LIKE '%You are not a member of this firm%' THEN RAISE EXCEPTION 'FAIL: the second leave gave % (%), expected the plain refusal', s, m; END IF;
  END;
  PERFORM race.dblink_disconnect('race_first');
  BEGIN
    PERFORM race.dblink_exec('race_second', 'ROLLBACK');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  PERFORM race.dblink_disconnect('race_second');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.acts(f, 'member_left') WHERE subject_user_id = pg_temp.id('dbl_agent')), 1::bigint, 'one leaving in the record');
  RAISE NOTICE 'leave_a_firm: two-session double leave passed';
END $$;
