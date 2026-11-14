-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh firm_suspension
-- Suspending a firm, and lifting the suspension (story CRM-P1.8; docs/BROKER_CRM_BUILD.md D-5, D-16, D-18, D-27, D-28, D-29,
-- D-31, D-32, D-33, D-34, D-35; 20261116230000_firm_suspension.sql). A platform admin, who belongs to no firm (D-16), suspends a
-- firm with a reason and later lifts it. Both are recorded in the firm's record of who did what (the firm sees "Nevermore", D-33)
-- and in the platform's own record of suspensions. While suspended, the firm's members are refused its data exactly as a
-- non-member is, nothing is deleted, and lifting restores everything.
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

CREATE FUNCTION pg_temp.as_user(n text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', false, 'email', n || '@example.test')::text, false);
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

-- ---------- set up: two approved firms, their people, an intake of the first, a platform admin ----------
DO $$
DECLARE fa uuid; fb uuid; s uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at, decision, decided_at) VALUES ('Alpha Brokers', 'alpha-brokers', now(), 'approved', now()) RETURNING id INTO fa;
  INSERT INTO public.firms (name, address, approved_at, decision, decided_at) VALUES ('Beta Benefits', 'beta-benefits', now(), 'approved', now()) RETURNING id INTO fb;
  INSERT INTO fx VALUES ('alpha', fa), ('beta', fb);
  PERFORM pg_temp.new_user('owner_a'); PERFORM pg_temp.new_user('agent_a'); PERFORM pg_temp.new_user('owner_b');
  PERFORM pg_temp.new_user('platform_admin'); PERFORM pg_temp.new_user('outsider'); PERFORM pg_temp.new_user('prospect_a');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES
    (fa, pg_temp.id('owner_a'), 'owner'), (fa, pg_temp.id('agent_a'), 'agent'), (fb, pg_temp.id('owner_b'), 'owner');
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('platform_admin'), 'admin'), (pg_temp.id('agent_a'), 'advisor');
  INSERT INTO public.chamber_sessions (user_id, firm_id, chamber_data) VALUES (pg_temp.id('prospect_a'), fa, '{}') RETURNING id INTO s;
  INSERT INTO fx VALUES ('intake_a', s);
END $$;

-- ---------- who may suspend and lift ----------
-- Break caught: a firm's own owner, an agent, a person with no role, a signed-out visitor, or a platform admin who is also a
-- member of the firm suspends or lifts (a firm's owner lifting their own suspension would make it no suspension at all).
DO $$
DECLARE fa uuid := pg_temp.id('alpha');
BEGIN
  PERFORM pg_temp.as_user('owner_a');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.admin_suspend_firm(%L, 'because')$q$, fa)), '42501', 'a firm''s owner may not suspend their own firm');
  PERFORM pg_temp.as_user('outsider');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.admin_suspend_firm(%L, 'because')$q$, fa)), '42501', 'a person with no role may not');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.admin_suspend_firm(%L, 'because')$q$, fa)), '42501', 'a signed-out visitor may not');
  PERFORM pg_temp.is(has_function_privilege('anon', 'public.admin_suspend_firm(uuid, text)', 'EXECUTE'), false, 'the signed-out role holds no right to call it');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_suspensions), 0::bigint, 'none of them suspended anything');
  RAISE NOTICE 'firm_suspension: who may suspend cases passed';
END $$;

-- ---------- suspending ----------
-- Break caught: suspending records nothing, the wrong firm, no reason, or the admin's own name is missing from the platform's record;
-- a blank reason is accepted; an unknown firm is accepted; a firm is suspended twice.
DO $$
DECLARE fa uuid := pg_temp.id('alpha');
BEGIN
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.admin_suspend_firm(%L, '')$q$, fa)), '22023', 'a reason is required');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.admin_suspend_firm(%L, '   ')$q$, fa)), '22023', 'a blank one is no reason');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.admin_suspend_firm(%L, %L)$q$, fa, repeat('x', 501))), '22023', 'one over 500 characters is refused');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.admin_suspend_firm(gen_random_uuid(), 'because')$q$), 'PT404', 'a firm that does not exist is refused');
  PERFORM public.admin_suspend_firm(fa, '  Unpaid invoice  ');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_suspensions), 1::bigint, 'one suspension is recorded');
  PERFORM pg_temp.is((SELECT firm_id FROM public.firm_suspensions), fa, 'for the firm named');
  PERFORM pg_temp.is((SELECT reason FROM public.firm_suspensions), 'Unpaid invoice', 'with the reason, trimmed');
  PERFORM pg_temp.is((SELECT suspended_by FROM public.firm_suspensions), pg_temp.id('platform_admin'), 'by the admin');
  PERFORM pg_temp.is((SELECT lifted_at IS NULL FROM public.firm_suspensions), true, 'and not lifted');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_suspensions WHERE firm_id = pg_temp.id('beta')), 0::bigint, 'the other firm is not suspended');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.admin_suspend_firm(%L, 'again')$q$, fa)), 'PT409', 'a suspended firm is not suspended again');
  RESET ROLE;
  RAISE NOTICE 'firm_suspension: suspending cases passed';
END $$;

-- Break caught: the one-open-suspension rule is only a check inside the function, so a second open row can be written some other
-- way (D-29: a constraint is the rule, and one session proves it by trying the second insert).
DO $$
BEGIN
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.firm_suspensions (firm_id, suspended_by, reason) VALUES (%L, %L, 'direct')$q$,
    pg_temp.id('alpha'), pg_temp.id('platform_admin'))), '23505', 'a second open suspension of a firm is refused by the table');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.firm_suspensions (firm_id, suspended_by, reason, lifted_at, lifted_by) VALUES (%L, %L, 'old', now(), %L)$q$,
    pg_temp.id('alpha'), pg_temp.id('platform_admin'), pg_temp.id('platform_admin'))), 'rows:1', 'a lifted one beside it is fine (a firm can be suspended more than once)');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.firm_suspensions (firm_id, suspended_by, reason, lifted_at) VALUES (%L, %L, 'back in time', now() - interval '1 day')$q$,
    pg_temp.id('beta'), pg_temp.id('platform_admin'))), '23514', 'a lift before the suspension began is refused');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.firm_suspensions (firm_id, suspended_by, reason) VALUES (%L, %L, '')$q$,
    pg_temp.id('beta'), pg_temp.id('platform_admin'))), '23514', 'an empty reason is refused by the table too');
  RAISE NOTICE 'firm_suspension: constraint cases passed';
END $$;

-- Break caught: the platform's record is readable through the API by the firm (the reason would reach it) or by anyone at all.
DO $$
BEGIN
  PERFORM pg_temp.as_user('owner_a');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.firm_suspensions'), '42501', 'a firm''s owner cannot read the platform''s record of suspensions');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.firm_suspensions'), '42501', 'nor can an admin, by the table: only through the functions');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.firm_suspensions'), '42501', 'nor a signed-out visitor');
  RESET ROLE;
  RAISE NOTICE 'firm_suspension: the platform record is closed';
END $$;

-- ---------- the firm's record of who did what ----------
-- Break caught: suspending or lifting is not in the firm's activity, or shows the admin's identity to the firm (D-33), or puts the
-- reason into the firm's record (the record holds no content).
DO $$
DECLARE fa uuid := pg_temp.id('alpha');
BEGIN
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE firm_id = fa AND kind = 'firm_suspended'), 1::bigint, 'suspending is in the firm''s record');
  PERFORM pg_temp.is((SELECT actor_is_staff FROM public.firm_activity WHERE firm_id = fa AND kind = 'firm_suspended'), true, 'as done by Nevermore''s staff (D-33)');
  PERFORM pg_temp.is((SELECT record_type || '/' || record_id FROM public.firm_activity WHERE firm_id = fa AND kind = 'firm_suspended'), 'firm/' || fa, 'about the firm');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE firm_id = pg_temp.id('beta') AND kind IN ('firm_suspended', 'firm_restored')), 0::bigint, 'and not in another firm''s');
  RAISE NOTICE 'firm_suspension: the activity record holds the suspension';
END $$;

-- ---------- lifting ----------
-- Break caught: a firm's owner lifts; the lift is not recorded; a firm that is not suspended is "lifted"; the suspension row is deleted
-- instead of closed (the history is gone); the firm is not suspended again after a lift.
DO $$
DECLARE fa uuid := pg_temp.id('alpha');
BEGIN
  PERFORM pg_temp.as_user('owner_a');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.admin_lift_firm_suspension(%L)$q$, fa)), '42501', 'a firm''s owner cannot lift their own firm''s suspension');
  PERFORM pg_temp.as_user('agent_a');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.admin_lift_firm_suspension(%L)$q$, fa)), '42501', 'nor can an agent, though they hold the advisor role');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.admin_lift_firm_suspension(%L)$q$, pg_temp.id('beta'))), 'PT409', 'a firm that is not suspended has nothing to lift');
  PERFORM public.admin_lift_firm_suspension(fa);
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_suspensions WHERE firm_id = fa AND lifted_at IS NULL), 0::bigint, 'after a lift no suspension is open');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_suspensions WHERE firm_id = fa AND reason = 'Unpaid invoice' AND lifted_at IS NOT NULL
                       AND lifted_by = pg_temp.id('platform_admin')), 1::bigint, 'the suspension is kept, closed, with who lifted it');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE firm_id = fa AND kind = 'firm_restored' AND actor_is_staff), 1::bigint, 'the lift is in the firm''s record, as Nevermore''s');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.admin_lift_firm_suspension(%L)$q$, fa)), 'PT409', 'a lifted suspension is not lifted twice');
  PERFORM public.admin_suspend_firm(fa, 'Second time');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_suspensions WHERE firm_id = fa AND lifted_at IS NULL), 1::bigint, 'a lifted firm can be suspended again');
  RAISE NOTICE 'firm_suspension: lifting cases passed';
END $$;

-- ---------- a suspended firm's members are refused as non-members are ----------
-- The firm is suspended here (the second suspension above). Break caught: a member of a suspended firm still passes the membership
-- question, so every policy and function that asks it still lets them read or write the firm's data; or the refusal reaches the
-- other firm; or the role in user_roles (an advisor) is enough by itself.
DO $$
DECLARE fa uuid := pg_temp.id('alpha'); fb uuid := pg_temp.id('beta'); s uuid := pg_temp.id('intake_a');
BEGIN
  PERFORM pg_temp.as_user('owner_a');
  PERFORM pg_temp.is(public.firm_role(fa), NULL::text, 'an owner of a suspended firm has no role in it');
  PERFORM pg_temp.is(public.is_firm_member(fa), false, 'and is no member of it');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_sessions), 0::bigint, 'they read none of its intakes');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firms), 0::bigint, 'nor the firm row');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_memberships), 0::bigint, 'nor their own membership');
  PERFORM pg_temp.is((SELECT count(*) FROM public.my_firms()), 0::bigint, 'the console lists no firm for them');
  PERFORM pg_temp.is((SELECT count(*) FROM public.my_owner_firms()), 0::bigint, 'and no firm they own');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT entry_key FROM public.firm_activity'), 'rows:0', 'nor the firm''s record');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.firm_activity_list(%L)$q$, fa)), '42501', 'nor by the function that lists it');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.firm_pending_invitations(%L)$q$, fa)), '42501', 'nor its invitations');
  PERFORM pg_temp.as_user('agent_a');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_sessions), 0::bigint, 'an agent who also holds the advisor role reads none of its intakes');
  PERFORM pg_temp.is((SELECT count(*) FROM public.advisor_list_submissions(NULL, NULL, 500, 0, NULL, NULL, NULL)), 0::bigint, 'the queue lists none of them');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.advisor_notes (session_id, author_id, body) VALUES (%L, %L, 'hi')$q$, s, pg_temp.id('agent_a'))), '42501', 'and they write no note on one');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.open_submission(%L)$q$, s)), 'rows:0', 'opening one hands over nothing');
  PERFORM pg_temp.as_user('owner_b');
  PERFORM pg_temp.is(public.firm_role(fb), 'owner', 'the other firm is untouched');
  PERFORM pg_temp.is((SELECT count(*) FROM public.my_firms()), 1::bigint, 'its owner still has a firm');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_sessions WHERE firm_id = fa), 1::bigint, 'nothing was deleted: the intake is still there');
  RAISE NOTICE 'firm_suspension: members refused cases passed';
END $$;

-- Break caught: the member of a suspended firm who holds no platform role is let into the console's first line.
DO $$
BEGIN
  PERFORM pg_temp.as_user('owner_a');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.advisor_list_submissions(NULL, NULL, 25, 0, NULL, NULL, NULL)'), '42501', 'a suspended firm''s owner with no platform role is refused at the console''s first line');
  PERFORM pg_temp.is(public.advisor_needs_second_factor(), false, 'and is not sent to a second factor for a firm they cannot open');
  RESET ROLE;
  RAISE NOTICE 'firm_suspension: console first line cases passed';
END $$;

-- ---------- lifting restores everything ----------
-- Break caught: lifting leaves a member still refused, or the firm's data changed.
DO $$
DECLARE fa uuid := pg_temp.id('alpha');
BEGIN
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_lift_firm_suspension(fa);
  PERFORM pg_temp.as_user('owner_a');
  PERFORM pg_temp.is(public.firm_role(fa), 'owner', 'after the lift an owner is an owner again');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_sessions), 1::bigint, 'and reads the firm''s intake');
  PERFORM pg_temp.is((SELECT count(*) FROM public.my_firms()), 1::bigint, 'the console lists the firm');
  PERFORM pg_temp.as_user('agent_a');
  PERFORM pg_temp.is((SELECT count(*) FROM public.advisor_list_submissions(NULL, NULL, 500, 0, NULL, NULL, NULL)), 1::bigint, 'the queue lists the intake again');
  RESET ROLE;
  RAISE NOTICE 'firm_suspension: lifting restores cases passed';
END $$;

-- ---------- invitations ----------
-- Break caught: a suspended firm invites, sends an invitation again or withdraws one; or an invitation made before the suspension is
-- accepted during it (the invited person would join, and the firm would take a new member while suspended); or the refusal
-- spends the invitation, so the lifted firm has lost it. An invitation opened at another firm's address still learns nothing (D-34).
DO $$
DECLARE fa uuid := pg_temp.id('alpha'); inv uuid; hash text := encode(extensions.digest('suspended-link', 'sha256'), 'hex');
  members_before bigint;
BEGIN
  PERFORM pg_temp.new_user('invitee');
  PERFORM pg_temp.as_user('owner_a');
  inv := (SELECT invitation_id FROM public.invite_member(fa, 'invitee@example.test', 'agent', NULL, hash));
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_suspend_firm(fa, 'Under review');
  PERFORM pg_temp.as_user('owner_a');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.invite_member(%L, 'other@example.test', 'agent', NULL, %L)$q$, fa, encode(extensions.digest('x1', 'sha256'), 'hex'))), '42501', 'a suspended firm cannot invite');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.resend_invitation(%L, %L)$q$, inv, encode(extensions.digest('x2', 'sha256'), 'hex'))), '42501', 'or send an invitation again');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.cancel_invitation(%L)$q$, inv)), '42501', 'or withdraw one');
  RESET ROLE;
  members_before := (SELECT count(*) FROM public.firm_memberships WHERE firm_id = fa);
  PERFORM pg_temp.as_user('invitee');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.accept_invitation(%L, 'alpha-brokers')$q$, hash)), 'PT403', 'an invitation to a suspended firm is not accepted');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.accept_invitation(%L, 'beta-benefits')$q$, hash)), 'PT422', 'at another firm''s address it still says only that it belongs to another address');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_memberships WHERE firm_id = fa), members_before, 'nobody joined');
  PERFORM pg_temp.is((SELECT status FROM public.firm_invitations WHERE id = inv), 'pending', 'and the invitation was not spent');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_lift_firm_suspension(fa);
  PERFORM pg_temp.as_user('invitee');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.accept_invitation(%L, 'alpha-brokers')$q$, hash)), 'rows:1', 'once the suspension is lifted the same invitation is accepted');
  RESET ROLE;
  RAISE NOTICE 'firm_suspension: invitation cases passed';
END $$;

-- ---------- what a suspended firm's address shows ----------
-- Break caught: the address of a suspended firm reads as no firm's (its name and sign-in vanish: D-27 says a suspended firm shows
-- them as a waiting one does), or a member is not told the firm is suspended, or a stranger is told (or learns it), or a member is
-- told "not a member" instead.
DO $$
DECLARE fa uuid := pg_temp.id('alpha');
BEGIN
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_suspend_firm(fa, 'Under review again');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(public.firm_public_name('alpha-brokers'), 'Alpha Brokers', 'a suspended firm still shows its name to a visitor');
  PERFORM pg_temp.as_user('owner_a');
  PERFORM pg_temp.is(public.is_member_of_firm_address('alpha-brokers'), true, 'its member is still a member at its address, so is not told they are not');
  PERFORM pg_temp.is(public.my_suspended_firm_at_address('alpha-brokers'), true, 'and is told the firm is suspended');
  PERFORM pg_temp.is(public.my_suspended_firm_at_address('beta-benefits'), false, 'not that another firm is');
  PERFORM pg_temp.as_user('owner_b');
  PERFORM pg_temp.is(public.my_suspended_firm_at_address('alpha-brokers'), false, 'a member of another firm is not told either');
  PERFORM pg_temp.as_user('outsider');
  PERFORM pg_temp.is(public.my_suspended_firm_at_address('alpha-brokers'), false, 'nor is a stranger');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(has_function_privilege('anon', 'public.my_suspended_firm_at_address(text)', 'EXECUTE'), false, 'a signed-out visitor holds no right to ask');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_lift_firm_suspension(fa);
  PERFORM pg_temp.as_user('owner_a');
  PERFORM pg_temp.is(public.my_suspended_firm_at_address('alpha-brokers'), false, 'once lifted the member is not told it any more');
  RESET ROLE;
  RAISE NOTICE 'firm_suspension: address cases passed';
END $$;

-- ---------- the firm's alerts ----------
-- Break caught: a suspended firm's members are still sent its alert (the recipients function names them); a retry of an alert that was
-- prepared before the suspension is claimed and sent during it (D-35); the alert is dropped or killed instead of waiting, so lifting
-- does not restore it; the employer's own confirmation is held back with it though it is not the firm's.
DO $$
DECLARE fa uuid := pg_temp.id('alpha'); s uuid := pg_temp.id('intake_a'); claimed text; r text[];
BEGIN
  RESET ROLE;
  INSERT INTO public.outbox_events (kind, session_id, dedupe_key, payload, status, attempts, pending_send, next_attempt_at) VALUES
    ('advisor_notification', s, 'alert-1', '{}', 'pending', 1,
     '{"key":"k1","attempt":1,"frozen_at":"2026-11-13T00:00:00.000Z","message":{"from":"a@x.test","to":["owner_a@example.test"],"subject":"s","text":"t","html":"h"}}'::jsonb, now() - interval '1 minute'),
    ('peo_mail_arrived', s, 'alert-2', '{}', 'pending', 0, NULL, now() - interval '1 minute'),
    ('prospect_confirmation', s, 'confirm-1', '{"recipient_email":"prospect@example.test"}', 'pending', 0, NULL, now() - interval '1 minute');
  SET LOCAL ROLE service_role;
  PERFORM pg_temp.is(array_to_string(public.outbox_alert_recipients(s), ','), 'agent_a@example.test,owner_a@example.test', 'before the suspension the alert goes to the firm''s two members');
  RESET ROLE;
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_suspend_firm(fa, 'Review of alerts');
  RESET ROLE;
  SET LOCAL ROLE service_role;
  PERFORM pg_temp.is(array_to_string(public.outbox_alert_recipients(s), ','), '', 'while it is suspended the alert has no recipients');
  SELECT string_agg(c.dedupe_key, ',' ORDER BY c.dedupe_key) INTO claimed
  FROM public.claim_outbox_events(ARRAY['advisor_notification', 'prospect_confirmation', 'peo_mail_arrived'], 10, 5, 600) c;
  PERFORM pg_temp.is(claimed, 'confirm-1', 'the dispatcher claims neither the retried alert nor the new one, only the employer''s confirmation');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.outbox_events WHERE dedupe_key IN ('alert-1', 'alert-2') AND status = 'pending' AND attempts IN (0, 1)), 2::bigint,
    'both alerts wait, pending, with no attempt used up');
  PERFORM pg_temp.is((SELECT pending_send IS NOT NULL FROM public.outbox_events WHERE dedupe_key = 'alert-1'), true, 'and the retry keeps what was prepared');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_lift_firm_suspension(fa);
  RESET ROLE;
  SET LOCAL ROLE service_role;
  SELECT string_agg(c.dedupe_key, ',' ORDER BY c.dedupe_key) INTO claimed
  FROM public.claim_outbox_events(ARRAY['advisor_notification', 'prospect_confirmation', 'peo_mail_arrived'], 10, 5, 600) c;
  PERFORM pg_temp.is(claimed, 'alert-1,alert-2', 'once lifted both alerts are claimed and go out');
  PERFORM pg_temp.is(array_to_string(public.outbox_alert_recipients(s), ','), 'agent_a@example.test,owner_a@example.test', 'to the members again');
  RESET ROLE;
  RAISE NOTICE 'firm_suspension: alert cases passed';
END $$;

-- ---------- a member's mailbox, and held mail ----------
-- Break caught: while the firm is suspended a member's mailbox can still be read for sending or connected anew; a member moves mail off
-- a thread of the suspended firm; an admin assigns mail held for the firm to a thread (it must stay held) or assigns other held mail
-- onto the suspended firm's thread; the refusal outlives the suspension.
DO $$
DECLARE fa uuid := pg_temp.id('alpha'); s uuid := pg_temp.id('intake_a'); q bigint; m_thread bigint; m_held bigint; m_nobody bigint; agent uuid := pg_temp.id('agent_a');
  admin uuid := pg_temp.id('platform_admin');
BEGIN
  RESET ROLE;
  INSERT INTO public.quote_requests (session_id, peo_name, status) VALUES (s, 'Probe PEO', 'sent') RETURNING id INTO q;
  INSERT INTO public.quote_request_messages (provider_message_id, quote_request_id, session_id, direction, from_address)
    VALUES ('susp-thread', q, s, 'received', 'peo@example.test') RETURNING id INTO m_thread;
  INSERT INTO public.quote_request_messages (provider_message_id, firm_id, held_reason, direction, from_address)
    VALUES ('susp-held', fa, 'revoked_address', 'received', 'peo@example.test') RETURNING id INTO m_held;
  INSERT INTO public.broker_mailboxes (user_id, provider, address, scope, token_ciphertext, token_iv)
    VALUES (agent, 'google', 'agent_a@mailbox.test', 'gmail.send', 'ciphertext', 'iv');

  SET LOCAL ROLE service_role;
  PERFORM pg_temp.is(public.mailbox_secret(agent) IS NOT NULL, true, 'before the suspension the sending function reads the member''s mailbox');
  RESET ROLE;
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_suspend_firm(fa, 'Review of mail');
  RESET ROLE;
  SET LOCAL ROLE service_role;
  PERFORM pg_temp.is(public.mailbox_secret(agent) IS NULL, true, 'while it is suspended the sending function reads none: nothing is sent as them');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.mailbox_store(%L, 'google', 'x@example.test', 'gmail.send', 'c', 'i')$q$, agent)), '42501', 'and no mailbox is connected for them');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.apply_mail_move(%s, NULL, %L, NULL)$q$, m_thread, agent)), '42501', 'a member cannot move mail off a thread of the firm');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.plan_mail_move(%s, NULL, %L)$q$, m_thread, agent)), '42501', 'nor plan to');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.apply_mail_move(%s, %s, %L, NULL)$q$, m_held, q, admin)), '55000', 'mail held for the firm stays held: an admin cannot assign it');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.plan_mail_move(%s, %s, %L)$q$, m_held, q, admin)), '55000', 'nor plan to');
  RESET ROLE;
  INSERT INTO public.quote_request_messages (provider_message_id, held_reason, direction, from_address)
    VALUES ('susp-nobody', 'revoked_address', 'received', 'peo@example.test') RETURNING id INTO m_nobody;
  SET LOCAL ROLE service_role;
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.apply_mail_move(%s, %s, %L, NULL)$q$, m_nobody, q, admin)), '55000', 'mail held for no firm is not put onto the suspended firm''s thread either');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT quote_request_id IS NULL FROM public.quote_request_messages WHERE id = m_held), true, 'it is still on the holding list');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quote_request_messages WHERE id = m_thread AND quote_request_id = q), 1::bigint, 'and the mail on the thread is where it was');
  PERFORM pg_temp.as_user('agent_a');
  PERFORM pg_temp.is((public.my_mailbox() ->> 'connected')::boolean, false, 'the member is told their mailbox is not connected, not that it was removed');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.broker_mailboxes WHERE user_id = agent), 1::bigint, 'the mailbox itself is kept');

  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_lift_firm_suspension(fa);
  RESET ROLE;
  SET LOCAL ROLE service_role;
  PERFORM pg_temp.is(public.mailbox_secret(agent) IS NOT NULL, true, 'once lifted the mailbox works again');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.plan_mail_move(%s, %s, %L)$q$, m_held, q, admin)), 'rows:1', 'and held mail can be assigned again');
  RESET ROLE;
  RAISE NOTICE 'firm_suspension: mailbox and held mail cases passed';
END $$;

-- ---------- the admin's page: every firm, its state, and whether it is suspended ----------
-- Break caught: a firm's member (or anyone but a platform admin) reads the list or a suspension's reason; the list shows a suspended
-- firm as not suspended or a lifted one as still suspended; the approval decision is lost or overwritten by suspending (a waiting
-- firm stays waiting, still in the approvals list and still approvable, and a refused one stays refused); a firm is missing.
DO $$
DECLARE fa uuid := pg_temp.id('alpha'); fb uuid := pg_temp.id('beta'); fc uuid; fd uuid; got record; all_firms bigint;
BEGIN
  RESET ROLE;
  INSERT INTO public.firms (name, address) VALUES ('Gamma Group', 'gamma-group') RETURNING id INTO fc;
  INSERT INTO public.firms (name, address, decision, decided_at) VALUES ('Delta Dealers', 'delta-dealers', 'refused', now()) RETURNING id INTO fd;
  SELECT count(*) INTO all_firms FROM public.firms;
  PERFORM pg_temp.as_user('owner_a');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.admin_firm_states()'), '42501', 'a firm''s owner cannot list every firm');
  PERFORM pg_temp.as_user('agent_a');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.admin_firm_states()'), '42501', 'nor can an agent who holds the advisor role');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.admin_firm_states()'), '42501', 'nor a signed-out visitor');

  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_suspend_firm(fc, 'Looks like a PEO');
  SELECT * INTO got FROM public.admin_firm_states() s WHERE s.firm_id = fc;
  PERFORM pg_temp.is(got.state, 'waiting', 'a firm waiting for approval stays waiting when it is suspended');
  PERFORM pg_temp.is(got.suspended, true, 'and is shown as suspended');
  PERFORM pg_temp.is(got.suspension_reason, 'Looks like a PEO', 'with the reason, for the admin');
  PERFORM pg_temp.is(got.suspended_at IS NOT NULL, true, 'and when');
  PERFORM pg_temp.is((SELECT count(*) FROM public.admin_waiting_firms() w WHERE w.firm_id = fc), 1::bigint, 'it is still in the approvals list');
  PERFORM public.admin_decide_firm(fc, true, NULL);
  SELECT * INTO got FROM public.admin_firm_states() s WHERE s.firm_id = fc;
  PERFORM pg_temp.is(got.state, 'approved', 'approving it while it is suspended records the decision');
  PERFORM pg_temp.is(got.suspended, true, 'and it is still suspended');
  PERFORM public.admin_suspend_firm(fd, 'Refused and suspended');
  SELECT * INTO got FROM public.admin_firm_states() s WHERE s.firm_id = fd;
  PERFORM pg_temp.is(got.state, 'refused', 'a refused firm stays refused');
  SELECT * INTO got FROM public.admin_firm_states() s WHERE s.firm_id = fa;
  PERFORM pg_temp.is(got.suspended, false, 'a firm whose suspension was lifted is not shown as suspended');
  PERFORM pg_temp.is(got.suspension_reason, NULL::text, 'and no reason hangs on it');
  SELECT * INTO got FROM public.admin_firm_states() s WHERE s.firm_id = fb;
  PERFORM pg_temp.is(got.state || '/' || got.suspended::text, 'approved/false', 'an approved firm that was never suspended');
  PERFORM pg_temp.is((SELECT count(*) FROM public.admin_firm_states()), all_firms, 'every firm is listed, the default firm too');
  RESET ROLE;
  RAISE NOTICE 'firm_suspension: the admin''s list cases passed';
END $$;

-- ---------- an admin who is also a member of the firm, and a refused firm ----------
-- Break caught: a platform admin who also belongs to a firm suspends it or lifts its suspension (D-16: an admin acts on firms they do
-- not belong to, as when deciding on one); a member of a refused firm that is also suspended is told it is suspended (a refused firm
-- behaves as an address no firm holds, D-31).
DO $$
DECLARE fe uuid; fd uuid := (SELECT id FROM public.firms WHERE address = 'delta-dealers');
BEGIN
  RESET ROLE;
  INSERT INTO public.firms (name, address, approved_at, decision, decided_at) VALUES ('Echo Eaters', 'echo-eaters', now(), 'approved', now()) RETURNING id INTO fe;
  PERFORM pg_temp.new_user('dual');
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('dual'), 'admin');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (fe, pg_temp.id('dual'), 'owner');
  PERFORM pg_temp.as_user('dual');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.admin_suspend_firm(%L, 'my own')$q$, fe)), '42501', 'an admin who belongs to the firm does not suspend it');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_suspend_firm(fe, 'Review');
  PERFORM pg_temp.as_user('dual');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.admin_lift_firm_suspension(%L)$q$, fe)), '42501', 'nor lift the suspension of a firm they belong to');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_suspensions WHERE firm_id = fe AND lifted_at IS NULL), 1::bigint, 'it is still suspended');

  -- Delta Dealers is refused and suspended (the block above). Its member is told nothing of its state.
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (fd, pg_temp.id('outsider'), 'owner');
  PERFORM pg_temp.as_user('outsider');
  PERFORM pg_temp.is(public.my_suspended_firm_at_address('delta-dealers'), false, 'a member of a refused firm is not told it is suspended');
  RESET ROLE;
  UPDATE public.firms SET decision = 'approved', approved_at = now() WHERE id = fd;
  PERFORM pg_temp.as_user('outsider');
  PERFORM pg_temp.is(public.my_suspended_firm_at_address('delta-dealers'), true, 'the same member of the same firm once it is not refused is (the control)');
  RESET ROLE;
  RAISE NOTICE 'firm_suspension: admin member and refused firm cases passed';
END $$;
