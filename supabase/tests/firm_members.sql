-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh firm_members
-- Removing and suspending a member of a firm (story CRM-P1.5; docs/BROKER_CRM_BUILD.md D-16, D-18, D-27, D-29, D-32, D-33, D-35;
-- 20261116220000_remove_or_suspend_a_member.sql). A current owner of a firm removes a member (the membership ends now, dated,
-- never deleted) or suspends one (the person is kept on a list and grants nothing until an owner lifts it). Who may do either
-- is the caller's own current ownership of that firm, read from the dated memberships (D-18); a platform admin who is no member
-- may do neither (D-16). A firm keeps one current, unsuspended owner, even when two owners remove each other at once.
-- Two firms are used throughout. Every migration is loaded, in filename order.
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
\i supabase/migrations/20261116210000_console_per_firm.sql
\i supabase/migrations/20261116210500_console_per_firm_fixes.sql
\i supabase/migrations/20261116220000_remove_or_suspend_a_member.sql
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
  PERFORM pg_temp.new_user('acme_agent'); PERFORM pg_temp.new_user('acme_agent_2');
  PERFORM pg_temp.new_user('zenith_owner'); PERFORM pg_temp.new_user('zenith_agent');
  PERFORM pg_temp.new_user('platform_admin'); PERFORM pg_temp.new_user('nobody');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES
    (acme, pg_temp.id('acme_owner'), 'owner'), (acme, pg_temp.id('acme_owner_2'), 'owner'), (acme, pg_temp.id('acme_lead'), 'lead'),
    (acme, pg_temp.id('acme_agent'), 'agent'), (acme, pg_temp.id('acme_agent_2'), 'agent'),
    (zenith, pg_temp.id('zenith_owner'), 'owner'), (zenith, pg_temp.id('zenith_agent'), 'agent');
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('platform_admin'), 'admin');
END $$;

-- ---------- removing a member ----------
-- Break caught: a removal that deletes the row (history lost), leaves the person a member, or dates it wrongly.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); before_rows bigint; m public.firm_memberships;
BEGIN
  SELECT count(*) INTO before_rows FROM public.firm_memberships WHERE firm_id = acme;
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.remove_member(acme, pg_temp.id('acme_agent'));
  RESET ROLE;
  SELECT * INTO m FROM public.firm_memberships WHERE firm_id = acme AND user_id = pg_temp.id('acme_agent');
  PERFORM pg_temp.is(m.valid_until IS NOT NULL AND m.valid_until <= now() AND m.valid_until >= now() - interval '1 minute', true, 'the membership ends now');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_memberships WHERE firm_id = acme), before_rows, 'the membership is kept, never deleted');
  PERFORM pg_temp.as_user('acme_agent');
  PERFORM pg_temp.is(public.is_firm_member(acme), false, 'the removed person is no longer a member');
  RESET ROLE;
  RAISE NOTICE 'firm_members: removal passed';
END $$;

-- ---------- who may remove ----------
-- Break caught: someone who is not a current owner of the firm removes a member; a platform admin or another firm's owner is let
-- in; a firm is taken from the caller's word; a person removes themself or a stranger; a member is removed twice.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); target uuid := pg_temp.id('acme_agent_2'); stmt text;
BEGIN
  stmt := format('SELECT public.remove_member(%L, %L)', acme, target);
  PERFORM pg_temp.as_user('acme_lead');
  PERFORM pg_temp.is(pg_temp.attempt(stmt), '42501', 'a lead can''t remove');
  PERFORM pg_temp.as_user('acme_agent');
  PERFORM pg_temp.is(pg_temp.attempt(stmt), '42501', 'a removed member (no longer an owner or member) can''t remove');
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM pg_temp.is(pg_temp.attempt(stmt), '42501', 'another firm''s owner can''t remove');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is(pg_temp.attempt(stmt), '42501', 'a platform admin who is not a member can''t remove (D-16)');
  PERFORM pg_temp.as_user('nobody');
  PERFORM pg_temp.is(pg_temp.attempt(stmt), '42501', 'a person with no firm can''t remove');
  PERFORM pg_temp.as_user('acme_owner', 'password');
  PERFORM pg_temp.is(pg_temp.attempt(stmt), '42501', 'an owner signed in with a password and no second factor can''t remove (D-19)');
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', false);
  SET LOCAL ROLE anon;
  PERFORM pg_temp.is(pg_temp.attempt(stmt), '42501', 'a signed-out caller can''t remove');
  RESET ROLE;
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(pg_temp.attempt(stmt), '42501', 'the service role isn''t a person: it can''t remove either');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_memberships WHERE user_id = target AND valid_until IS NULL), 1::bigint, 'nobody was removed by any of those');

  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.remove_member(%L, %L)', acme, pg_temp.id('acme_owner'))), 'PT409', 'an owner can''t remove themself here');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.remove_member(%L, %L)', acme, pg_temp.id('zenith_agent'))), 'PT404', 'a person of another firm is not this firm''s member to remove');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.remove_member(%L, %L)', acme, pg_temp.id('nobody'))), 'PT404', 'a stranger is not a member to remove');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.remove_member(%L, %L)', pg_temp.id('zenith'), pg_temp.id('zenith_agent'))), '42501', 'an owner of one firm can''t name another firm to act on');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.remove_member(%L, %L)', acme, pg_temp.id('acme_agent'))), 'PT404', 'someone already removed is not removed again');
  RESET ROLE;
  RAISE NOTICE 'firm_members: who may remove passed';
END $$;

-- ---------- the last owner stays ----------
-- Break caught: a firm is left with no owner that will last. An owner whose membership is already set to lapse does not count as
-- one that stays, so the only open-ended owner can't be removed by them (the rule of 20261116090000, reached through the new function).
DO $$
DECLARE acme uuid := pg_temp.id('acme'); r text;
BEGIN
  PERFORM pg_temp.new_user('lapsing_owner');
  INSERT INTO public.firm_memberships (firm_id, user_id, role, valid_from, valid_until)
  VALUES (acme, pg_temp.id('lapsing_owner'), 'owner', now() - interval '1 day', now() + interval '30 days');
  -- Make acme_owner the only open-ended owner: acme_owner_2 is removed first (allowed while acme_owner stays).
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.remove_member(acme, pg_temp.id('acme_owner_2'));
  RESET ROLE;
  PERFORM pg_temp.as_user('lapsing_owner');
  r := pg_temp.refusal(format('SELECT public.remove_member(%L, %L)', acme, pg_temp.id('acme_owner')));
  PERFORM pg_temp.is(r, '23514: The last owner of a firm can''t be removed. Make someone else an owner first.', 'the only owner that stays is not removed');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT valid_until IS NULL FROM public.firm_memberships WHERE firm_id = acme AND user_id = pg_temp.id('acme_owner')), true, 'and is still a member');
  -- put it back for the rest of the file
  DELETE FROM public.firm_memberships WHERE user_id = pg_temp.id('lapsing_owner');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (acme, pg_temp.id('acme_owner_2'), 'owner');
  RAISE NOTICE 'firm_members: last owner (single session) passed';
END $$;

-- ---------- two owners remove each other at the same moment (D-32) ----------
-- A firm keeps one current owner, but that can't be a constraint (it counts the other rows), so it is the firm row's lock inside
-- keep_firm_owner() that makes the two removals queue. Each transaction alone sees the other owner still there, so without the
-- lock both would pass and the firm would be left with none. Two real connections (dblink) race: the first removes the second
-- owner and holds its transaction open until the second, removing the first, is seen waiting on it; once the first commits the second must
-- see no one else and be refused.
CREATE SCHEMA race;
CREATE EXTENSION dblink SCHEMA race;
DO $$
DECLARE f uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Race Firm', 'race-firm', now()) RETURNING id INTO f;
  INSERT INTO fx VALUES ('race_firm', f);
  INSERT INTO public.firm_memberships (firm_id, user_id, role)
  VALUES (f, pg_temp.new_user('race_owner_1'), 'owner'), (f, pg_temp.new_user('race_owner_2'), 'owner');
END $$;

DO $$
DECLARE
  f uuid := pg_temp.id('race_firm');
  dsn text := format('dbname=%s user=%s port=%s host=%s', current_database(), session_user, current_setting('port'),
    split_part(current_setting('unix_socket_directories'), ',', 1));
  as_first text := format($q$SELECT set_config('request.jwt.claims', %L, true)$q$,
    jsonb_build_object('sub', pg_temp.id('race_owner_1'), 'role', 'authenticated', 'is_anonymous', false, 'email', 'race_owner_1@example.test')::text);
  as_second text := format($q$SELECT set_config('request.jwt.claims', %L, true)$q$,
    jsonb_build_object('sub', pg_temp.id('race_owner_2'), 'role', 'authenticated', 'is_anonymous', false, 'email', 'race_owner_2@example.test')::text);
  second_pid integer;
  tries integer := 0;
  s text;
  m text;
  current_owners bigint;
BEGIN
  PERFORM race.dblink_connect('race_first', dsn);
  PERFORM race.dblink_connect('race_second', dsn);
  PERFORM race.dblink_exec('race_second', 'SET lock_timeout = ''20s''');
  SELECT pid INTO second_pid FROM race.dblink('race_second', 'SELECT pg_backend_pid()') AS t(pid integer);
  PERFORM race.dblink_exec('race_first', 'BEGIN');
  PERFORM race.dblink_exec('race_first', 'SET LOCAL ROLE authenticated');
  PERFORM * FROM race.dblink('race_first', as_first) AS t(c text);
  PERFORM * FROM race.dblink('race_first', format($q$SELECT public.remove_member(%L, %L)::text$q$, f, pg_temp.id('race_owner_2'))) AS t(r text);
  PERFORM race.dblink_exec('race_second', 'BEGIN');
  PERFORM race.dblink_exec('race_second', 'SET LOCAL ROLE authenticated');
  PERFORM * FROM race.dblink('race_second', as_second) AS t(c text);
  PERFORM race.dblink_send_query('race_second', format($q$SELECT public.remove_member(%L, %L)::text$q$, f, pg_temp.id('race_owner_1')));
  WHILE cardinality(pg_blocking_pids(second_pid)) = 0 LOOP
    tries := tries + 1;
    IF tries > 400 THEN RAISE EXCEPTION 'FAIL: the second removal never waited for the first'; END IF;
    PERFORM pg_sleep(0.05);
  END LOOP;
  PERFORM race.dblink_exec('race_first', 'COMMIT');
  BEGIN
    PERFORM * FROM race.dblink_get_result('race_second') AS t(r text);
    RAISE EXCEPTION 'FAIL: both owners were removed';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT;
    IF s <> '23514' THEN RAISE EXCEPTION 'FAIL: the second removal gave % (%), expected 23514', s, m; END IF;
  END;
  PERFORM race.dblink_disconnect('race_first');
  BEGIN
    PERFORM race.dblink_exec('race_second', 'ROLLBACK');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  PERFORM race.dblink_disconnect('race_second');
  SELECT count(*) INTO current_owners FROM public.firm_memberships x
  -- Open-ended: this transaction began before the other session's end date, so "current by now()" would still count it.
  WHERE x.firm_id = f AND x.role = 'owner' AND x.valid_until IS NULL;
  PERFORM pg_temp.is(current_owners, 1::bigint, 'current owners of the firm after two owners removed each other at once');
  RAISE NOTICE 'firm_members: two-session owner race passed';
END $$;

-- ---------- suspending a member ----------
-- Break caught: a suspension that leaves the person able to act, that loses the person (no longer listed, so no one can lift it), that
-- is done by someone who is not an owner of the firm, or that lets the last owner go.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); stmt text; lead_id uuid := pg_temp.id('acme_lead'); rows_before bigint;
BEGIN
  SELECT count(*) INTO rows_before FROM public.firm_memberships WHERE firm_id = acme AND user_id = lead_id;
  stmt := format('SELECT public.suspend_member(%L, %L)', acme, lead_id);
  PERFORM pg_temp.as_user('acme_agent_2');
  PERFORM pg_temp.is(pg_temp.attempt(stmt), '42501', 'an agent can''t suspend');
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM pg_temp.is(pg_temp.attempt(stmt), '42501', 'another firm''s owner can''t suspend');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is(pg_temp.attempt(stmt), '42501', 'a platform admin who is not a member can''t suspend (D-16)');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.suspend_member(%L, %L)', acme, pg_temp.id('acme_owner'))), 'PT409', 'an owner can''t suspend themself');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.suspend_member(%L, %L)', acme, pg_temp.id('nobody'))), 'PT404', 'a stranger can''t be suspended');
  PERFORM public.suspend_member(acme, lead_id);
  PERFORM pg_temp.is(pg_temp.attempt(stmt), 'PT409', 'someone already suspended is not suspended again');

  PERFORM pg_temp.as_user('acme_lead');
  PERFORM pg_temp.is(public.is_firm_member(acme), false, 'the suspended person is not a member while suspended');
  PERFORM pg_temp.is(public.firm_role(acme), NULL::text, 'and has no role in the firm');
  PERFORM pg_temp.is((SELECT count(*) FROM public.my_firms()), 0::bigint, 'and no firm in my_firms()');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_memberships WHERE firm_id = acme AND user_id = lead_id), rows_before, 'no membership row was deleted or added');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_member_suspensions WHERE firm_id = acme AND user_id = lead_id AND ended_at IS NULL), 1::bigint, 'the suspension is kept');
  RAISE NOTICE 'firm_members: suspension passed';
END $$;

-- The last owner can't be suspended either, as they can't be removed: the lapsing owner is the caller, the only open-ended one the target.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); r text;
BEGIN
  -- lapsing_owner exists from the single-session test above.
  INSERT INTO public.firm_memberships (firm_id, user_id, role, valid_from, valid_until)
  VALUES (acme, pg_temp.id('lapsing_owner'), 'owner', now() - interval '1 day', now() + interval '30 days');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.remove_member(acme, pg_temp.id('acme_owner_2'));
  RESET ROLE;
  PERFORM pg_temp.as_user('lapsing_owner');
  r := pg_temp.refusal(format('SELECT public.suspend_member(%L, %L)', acme, pg_temp.id('acme_owner')));
  PERFORM pg_temp.is(r, '23514: The last owner of a firm can''t be suspended. Make someone else an owner first.', 'the only owner that stays is not suspended');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_member_suspensions WHERE user_id = pg_temp.id('acme_owner')), 0::bigint, 'and no suspension of them was kept');
  DELETE FROM public.firm_memberships WHERE user_id = pg_temp.id('lapsing_owner');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (acme, pg_temp.id('acme_owner_2'), 'owner');
  RAISE NOTICE 'firm_members: last owner suspension passed';
END $$;

-- ---------- who is listed ----------
-- Break caught: the list shows a removed person, hides a suspended one (so no one can lift it), shows another firm's people, or is read
-- by someone who is not an owner of the firm.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); got text;
BEGIN
  PERFORM pg_temp.as_user('acme_owner');
  SELECT string_agg(l.email || ':' || l.role || ':' || l.state || CASE WHEN l.is_you THEN ':you' ELSE '' END, ', ' ORDER BY l.email) INTO got
  FROM public.firm_members(acme) l;
  PERFORM pg_temp.is(got,
    'acme_agent_2@example.test:agent:current, acme_lead@example.test:lead:suspended, acme_owner@example.test:owner:current:you, acme_owner_2@example.test:owner:current',
    'current and suspended members of this firm, not the removed one, not another firm''s');
  PERFORM pg_temp.as_user('acme_agent_2');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT * FROM public.firm_members(%L)', acme)), '42501', 'an agent can''t read the list');
  PERFORM pg_temp.as_user('acme_lead');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT * FROM public.firm_members(%L)', acme)), '42501', 'a suspended owner or member can''t read the list');
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT * FROM public.firm_members(%L)', acme)), '42501', 'another firm''s owner can''t read the list');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT * FROM public.firm_members(%L)', acme)), '42501', 'a platform admin who is no member can''t read the list');
  PERFORM pg_temp.as_user('acme_owner', 'password');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT * FROM public.firm_members(%L)', acme)), '42501', 'an owner owing a second factor can''t read the list');
  RESET ROLE;
  RAISE NOTICE 'firm_members: list passed';
END $$;

-- ---------- lifting a suspension ----------
-- Break caught: lifting that gives back a different role or team, leaves two memberships, is done by the suspended person or a
-- non-owner, or can be done to someone who isn't suspended.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); lead_id uuid := pg_temp.id('acme_lead'); stmt text; team uuid := gen_random_uuid(); rows_before bigint;
BEGIN
  stmt := format('SELECT public.lift_member_suspension(%L, %L)', acme, lead_id);
  PERFORM pg_temp.as_user('acme_lead');
  PERFORM pg_temp.is(pg_temp.attempt(stmt), '42501', 'the suspended person can''t lift their own suspension');
  PERFORM pg_temp.as_user('acme_agent_2');
  PERFORM pg_temp.is(pg_temp.attempt(stmt), '42501', 'an agent can''t lift');
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM pg_temp.is(pg_temp.attempt(stmt), '42501', 'another firm''s owner can''t lift');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is(pg_temp.attempt(stmt), '42501', 'a platform admin who is no member can''t lift');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.lift_member_suspension(%L, %L)', acme, pg_temp.id('acme_agent_2'))), 'PT404', 'a member who is not suspended has nothing to lift');
  PERFORM public.lift_member_suspension(acme, lead_id);
  RESET ROLE;
  SELECT count(*) INTO rows_before FROM public.firm_memberships WHERE firm_id = acme AND user_id = lead_id;
  PERFORM pg_temp.is(rows_before, 2::bigint, 'the ended membership is kept and a new one begins');
  PERFORM pg_temp.is((SELECT role FROM public.firm_memberships WHERE firm_id = acme AND user_id = lead_id AND valid_until IS NULL), 'lead', 'with the role they had');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_member_suspensions WHERE firm_id = acme AND user_id = lead_id AND ended_at IS NULL), 0::bigint, 'the suspension is closed');
  PERFORM pg_temp.is((SELECT ended_how FROM public.firm_member_suspensions WHERE firm_id = acme AND user_id = lead_id), 'lifted', 'as lifted');
  PERFORM pg_temp.as_user('acme_lead');
  PERFORM pg_temp.is(public.firm_role(acme), 'lead', 'the person is a member again at once');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is((SELECT l.state FROM public.firm_members(acme) l WHERE l.email = 'acme_lead@example.test'), 'current', 'and listed as current');
  RESET ROLE;
  RAISE NOTICE 'firm_members: lifting passed';
END $$;

-- The team they were in comes back with them.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); team uuid := gen_random_uuid(); ag uuid := pg_temp.id('acme_agent_2');
BEGIN
  INSERT INTO public.firm_teams (id, firm_id, name) VALUES (team, acme, 'Sales');
  UPDATE public.firm_memberships SET valid_until = now() WHERE firm_id = acme AND user_id = ag;
  INSERT INTO public.firm_memberships (firm_id, user_id, role, team_id) VALUES (acme, ag, 'agent', team);
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.suspend_member(acme, ag);
  PERFORM public.lift_member_suspension(acme, ag);
  RESET ROLE;
  PERFORM pg_temp.is((SELECT team_id FROM public.firm_memberships WHERE firm_id = acme AND user_id = ag AND valid_until IS NULL), team, 'a lifted membership is back in its team');
END $$;

-- ---------- removing someone who is suspended ----------
-- Break caught: a suspended person can't be removed (the owner is stuck with them), or removing them leaves the suspension open.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); lead_id uuid := pg_temp.id('acme_lead');
BEGIN
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.suspend_member(acme, lead_id);
  PERFORM public.remove_member(acme, lead_id);
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_members(acme) l WHERE l.email = 'acme_lead@example.test'), 0::bigint, 'a removed person is not listed, suspended or otherwise');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT ended_how FROM public.firm_member_suspensions WHERE firm_id = acme AND user_id = lead_id ORDER BY id DESC LIMIT 1), 'removed', 'the suspension ends as removed');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_member_suspensions WHERE firm_id = acme AND user_id = lead_id AND ended_at IS NULL), 0::bigint, 'none is left open');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_memberships WHERE firm_id = acme AND user_id = lead_id AND valid_until IS NULL), 0::bigint, 'and they hold no membership');
  RAISE NOTICE 'firm_members: removing a suspended member passed';
END $$;

-- ---------- a suspended person is not added again by the back door ----------
-- Break caught: an invitation accepted, or a membership inserted, for someone who is suspended: it would end the suspension without an owner.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); ag uuid := pg_temp.id('acme_agent_2');
BEGIN
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.suspend_member(acme, ag);
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.refusal(format($q$INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (%L, %L, 'agent')$q$, acme, ag)),
    '42501: This person is suspended at this firm. An owner lifts the suspension.', 'a suspended person can''t be given a new membership');
  RAISE NOTICE 'firm_members: no back door passed';
END $$;

-- ---------- the firm's record ----------
-- Break caught: a removal, suspension or lifting that leaves no entry, names the wrong person, is written twice (a generic "ended a
-- membership" beside the specific one), or shows the owners a platform admin's name (D-33).
CREATE FUNCTION pg_temp.entries(fid uuid, after_id bigint) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE(string_agg(a.kind || ':' || COALESCE(au.email, 'system') || '>' || COALESCE(su.email, '-') || ':' || COALESCE(a.role, '-'), ' | ' ORDER BY a.id), '')
  FROM public.firm_activity a
  LEFT JOIN auth.users au ON au.id = a.actor_id LEFT JOIN auth.users su ON su.id = a.subject_user_id
  WHERE a.firm_id = fid AND a.id > after_id AND a.kind IN ('member_removed', 'member_suspended', 'member_restored', 'member_ended', 'owner_ended', 'member_added', 'owner_added')
$$;

DO $$
DECLARE fid uuid; got text; baseline bigint;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Record Firm', 'record-firm', now()) RETURNING id INTO fid;
  INSERT INTO fx VALUES ('record_firm', fid);
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES
    (fid, pg_temp.new_user('rec_owner'), 'owner'), (fid, pg_temp.new_user('rec_owner_2'), 'owner'),
    (fid, pg_temp.new_user('rec_lead'), 'lead'), (fid, pg_temp.new_user('rec_agent'), 'agent');
  -- Only what this story's functions write is looked at: the setup above wrote its own "added" entries.
  SELECT max(id) INTO baseline FROM public.firm_activity;
  PERFORM pg_temp.as_user('rec_owner');
  PERFORM public.remove_member(fid, pg_temp.id('rec_agent'));
  PERFORM public.suspend_member(fid, pg_temp.id('rec_lead'));
  PERFORM public.lift_member_suspension(fid, pg_temp.id('rec_lead'));
  PERFORM public.suspend_member(fid, pg_temp.id('rec_lead'));
  PERFORM public.remove_member(fid, pg_temp.id('rec_lead'));
  PERFORM public.suspend_member(fid, pg_temp.id('rec_owner_2'));
  PERFORM public.lift_member_suspension(fid, pg_temp.id('rec_owner_2'));
  PERFORM public.remove_member(fid, pg_temp.id('rec_owner_2'));
  RESET ROLE;
  got := pg_temp.entries(fid, baseline);
  PERFORM pg_temp.is(got,
    'member_removed:rec_owner@example.test>rec_agent@example.test:agent'
    || ' | member_suspended:rec_owner@example.test>rec_lead@example.test:lead'
    || ' | member_restored:rec_owner@example.test>rec_lead@example.test:lead'
    || ' | member_suspended:rec_owner@example.test>rec_lead@example.test:lead'
    || ' | member_removed:rec_owner@example.test>rec_lead@example.test:lead'
    || ' | member_suspended:rec_owner@example.test>rec_owner_2@example.test:owner'
    || ' | member_restored:rec_owner@example.test>rec_owner_2@example.test:owner'
    || ' | member_removed:rec_owner@example.test>rec_owner_2@example.test:owner',
    'each removal, suspension and lifting is one entry: who did it, to whom, in what role');
  -- the owners read them, with names
  PERFORM pg_temp.as_user('rec_owner');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity_list(fid, NULL, 'member_suspended')), 3::bigint, 'the owner reads the suspensions through the firm''s record');
  PERFORM pg_temp.is((SELECT bool_and(e.actor_email = 'rec_owner@example.test' AND NOT e.by_nevermore) FROM public.firm_activity_list(fid, NULL, 'member_removed') e), true, 'and sees who did it');
  RESET ROLE;
  RAISE NOTICE 'firm_members: firm record passed';
END $$;

-- A change made any other way is still written by the generic entry (the trigger of 20261116160001 is only held back for these functions).
DO $$
DECLARE fid uuid := pg_temp.id('record_firm'); got text;
BEGIN
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (fid, pg_temp.new_user('rec_other'), 'agent');
  UPDATE public.firm_memberships SET valid_until = now() WHERE firm_id = fid AND user_id = pg_temp.id('rec_other');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE firm_id = fid AND kind = 'member_ended' AND subject_user_id = pg_temp.id('rec_other')), 1::bigint,
    'an end made outside these functions is still recorded as an ended membership');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE firm_id = fid AND kind = 'member_ended' AND subject_user_id = pg_temp.id('rec_agent')), 0::bigint,
    'and a removal is not recorded as that as well');
END $$;

-- ---------- a stored mailbox ----------
-- Break caught: a removed person's mailbox stays stored (their credential outlives their access); it is deleted while they still belong
-- to another firm; a suspended person's is deleted (it can't be lifted back) or can still be used; the last end isn't seen when it is
-- the end of a suspended membership.
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
  acme uuid := pg_temp.id('acme'); zenith uuid := pg_temp.id('zenith');
BEGIN
  PERFORM pg_temp.new_user('mb_one'); PERFORM pg_temp.new_user('mb_two'); PERFORM pg_temp.new_user('mb_three'); PERFORM pg_temp.new_user('mb_four');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES
    (acme, pg_temp.id('mb_one'), 'agent'),
    (acme, pg_temp.id('mb_two'), 'agent'), (zenith, pg_temp.id('mb_two'), 'agent'),
    (acme, pg_temp.id('mb_three'), 'agent'),
    (acme, pg_temp.id('mb_four'), 'agent'), (zenith, pg_temp.id('mb_four'), 'agent');
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.store_mailbox('mb_one'); PERFORM pg_temp.store_mailbox('mb_two'); PERFORM pg_temp.store_mailbox('mb_three'); PERFORM pg_temp.store_mailbox('mb_four');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.usable('mb_one'), true, 'a member can use their mailbox');

  -- removed from their only firm: deleted
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.remove_member(acme, pg_temp.id('mb_one'));
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.stored('mb_one'), false, 'removed from their only firm: the stored mailbox is deleted');

  -- removed from one of two firms: kept, and still usable
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.remove_member(acme, pg_temp.id('mb_two'));
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.stored('mb_two'), true, 'removed from one of two firms: the mailbox is kept');
  PERFORM pg_temp.is(pg_temp.usable('mb_two'), true, 'and can be used for the firm they still belong to');
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM public.remove_member(zenith, pg_temp.id('mb_two'));
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.stored('mb_two'), false, 'removed from the last firm they belonged to: deleted');

  -- suspended: kept, but not usable; lifting makes it usable again
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.suspend_member(acme, pg_temp.id('mb_three'));
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.stored('mb_three'), true, 'suspended: the mailbox stays stored');
  PERFORM pg_temp.is(pg_temp.usable('mb_three'), false, 'but can''t be used while suspended');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.lift_member_suspension(acme, pg_temp.id('mb_three'));
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.usable('mb_three'), true, 'once the suspension is lifted it can be used again');

  -- suspended at one firm, removed from the other: still kept, as they still hold a (suspended) membership
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.suspend_member(acme, pg_temp.id('mb_four'));
  RESET ROLE;
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM public.remove_member(zenith, pg_temp.id('mb_four'));
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.stored('mb_four'), true, 'removed from one firm while suspended at the other: kept');
  PERFORM pg_temp.is(pg_temp.usable('mb_four'), false, 'but not usable');
  -- and removed while suspended: their last membership ends
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.remove_member(acme, pg_temp.id('mb_four'));
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.stored('mb_four'), false, 'removing someone who is suspended, their last membership: deleted');
  RAISE NOTICE 'firm_members: mailbox passed';
END $$;

-- ---------- what the person stops receiving, and what they leave behind ----------
-- Break caught: a removed or suspended person is still told of the firm's new submissions; an invitation they sent dies with them, or
-- they can still manage it; what they made leaves with them.
DO $$
DECLARE
  fid uuid; sid uuid; to_list text; inv uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Alert Firm', 'alert-firm', now()) RETURNING id INTO fid;
  INSERT INTO fx VALUES ('alert_firm', fid);
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES
    (fid, pg_temp.new_user('al_owner'), 'owner'), (fid, pg_temp.new_user('al_owner_2'), 'owner'), (fid, pg_temp.new_user('al_agent'), 'agent'),
    (fid, pg_temp.new_user('al_suspended'), 'agent'), (fid, pg_temp.new_user('al_removed'), 'agent');
  INSERT INTO public.chamber_sessions (user_id, firm_id) VALUES (pg_temp.new_user('al_prospect'), fid) RETURNING id INTO sid;
  PERFORM pg_temp.as_service();
  SELECT array_to_string(public.outbox_alert_recipients(sid), ',') INTO to_list;
  PERFORM pg_temp.is(to_list, 'al_agent@example.test,al_owner@example.test,al_owner_2@example.test,al_removed@example.test,al_suspended@example.test', 'before: every current member is told');
  RESET ROLE;

  -- an invitation sent by the owner who is then removed
  PERFORM pg_temp.as_user('al_owner_2');
  SELECT i.invitation_id INTO inv FROM public.invite_member(fid, 'al_newcomer@example.test', 'agent', NULL, encode(extensions.digest(convert_to(repeat('b', 64), 'UTF8'), 'sha256'), 'hex')) i;
  PERFORM pg_temp.as_user('al_owner');
  PERFORM public.remove_member(fid, pg_temp.id('al_owner_2'));
  PERFORM public.remove_member(fid, pg_temp.id('al_removed'));
  PERFORM public.suspend_member(fid, pg_temp.id('al_suspended'));
  RESET ROLE;

  PERFORM pg_temp.as_service();
  SELECT array_to_string(public.outbox_alert_recipients(sid), ',') INTO to_list;
  PERFORM pg_temp.is(to_list, 'al_agent@example.test,al_owner@example.test', 'after: a removed and a suspended person are no longer told, at once');
  RESET ROLE;

  -- the invitation stays valid
  PERFORM pg_temp.is((SELECT status FROM public.firm_invitations WHERE id = inv), 'pending', 'an invitation sent by someone since removed stays pending');
  -- but the person who sent it can no longer manage it
  PERFORM pg_temp.as_user('al_owner_2');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT * FROM public.firm_pending_invitations(%L)', fid)), '42501', 'the removed sender can''t list the firm''s invitations');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.cancel_invitation(%L)', inv)), '42501', 'or withdraw it');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT * FROM public.resend_invitation(%L, %L)', inv, repeat('c', 64))), '42501', 'or send it again');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT * FROM public.invite_member(%L, %L, %L, NULL, %L)', fid, 'x@example.test', 'agent', repeat('d', 64))), '42501', 'or invite anyone');
  RESET ROLE;
  PERFORM pg_temp.new_user('al_newcomer');
  PERFORM pg_temp.as_user('al_newcomer');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accept_invitation(encode(extensions.digest(convert_to(repeat('b', 64), 'UTF8'), 'sha256'), 'hex'), 'alert-firm')), 1::bigint, 'and can still be accepted');
  RESET ROLE;
  RAISE NOTICE 'firm_members: alerts and invitations passed';
END $$;
