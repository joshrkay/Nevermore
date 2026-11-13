-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh console_per_firm
-- The console asks "is a member", not "is an advisor" (story P-1.4; docs/BROKER_CRM_BUILD.md D-15, D-16, D-18, D-19;
-- 20261116210000_console_per_firm.sql). Two firms; Edgar Allan Advisory's agent, an agent who holds no platform role (a
-- person who signed a firm up or was invited has none), a platform admin who belongs to no firm, an advisor-role holder
-- who belongs to none, and a person with nothing. Proves: my_firms() tells a signed-in person the firms they currently
-- belong to and their role in each, and nothing to a guest, a former member, a stranger or a password sign-in still owing
-- its second factor; a current member passes the console's role check whether or not they hold a platform role, and
-- sees only their own firm's rows; the second-factor redirect is owed by a member with no role as it is by one with one.
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
SET client_min_messages = notice;

-- ---------- helpers ----------
CREATE TEMP TABLE fx (name text PRIMARY KEY, id uuid NOT NULL);
GRANT SELECT ON fx TO anon, authenticated, service_role;
GRANT INSERT ON fx TO authenticated;

CREATE FUNCTION pg_temp.id(n text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM fx WHERE name = n $$;

CREATE FUNCTION pg_temp.new_user(n text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', n || '@example.test', false, now(), now());
  INSERT INTO fx VALUES (n, uid);
  RETURN uid;
END $$;

CREATE FUNCTION pg_temp.as_user(n text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', false, 'email', n || '@example.test')::text, false);
  PERFORM set_config('role', 'authenticated', false);
END $$;

CREATE FUNCTION pg_temp.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', false);
  PERFORM set_config('role', 'service_role', false);
END $$;

CREATE FUNCTION pg_temp.as_owner() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', false);
END $$;

-- Runs stmt and always rolls it back: 'rows:<n>' for the rows it touched, or the SQLSTATE it raised.
CREATE FUNCTION pg_temp.attempt(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  n bigint;
  s text;
  m text;
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

CREATE FUNCTION pg_temp.expect(stmt text, expected text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r text := pg_temp.attempt(stmt);
BEGIN
  IF r IS DISTINCT FROM expected THEN RAISE EXCEPTION 'FAIL: % gave %, expected %', label, r, expected; END IF;
END $$;

CREATE FUNCTION pg_temp.is(got anyelement, want anyelement, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION 'FAIL: % gave %, expected %', label, got, want; END IF;
END $$;



-- ---------- two firms ----------
-- Firm A is Edgar Allan Advisory, which the firms migration created. Firm B is another brokerage.

-- Signed-in claims for a sign-in method and assurance level (what Supabase Auth puts in a token).
CREATE FUNCTION pg_temp.as_user_with(n text, method text, level text, anon boolean DEFAULT false) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', anon, 'email', n || '@example.test',
      'aal', level, 'amr', jsonb_build_array(jsonb_build_object('method', method, 'timestamp', 1)))::text, false);
  PERFORM set_config('role', 'authenticated', false);
END $$;

-- ---------- two firms ----------
DO $$
DECLARE
  n text;
  sid uuid;
BEGIN
  FOREACH n IN ARRAY ARRAY['agent_a', 'roleless_a', 'owner_b', 'both', 'former_a', 'platform_admin', 'advisor_no_firm', 'nobody', 'prospect_a', 'prospect_b'] LOOP
    PERFORM pg_temp.new_user(n);
  END LOOP;
  INSERT INTO fx VALUES ('firm_a', public.default_firm_id());
  INSERT INTO fx VALUES ('firm_b', gen_random_uuid());
  INSERT INTO public.firms (id, name, address, approved_at) VALUES (pg_temp.id('firm_b'), 'Beta Brokers', 'beta-brokers', now());
  -- Roles: Edgar Allan Advisory's people hold the advisor role as they did before firms; roleless_a, owner_b and both do not.
  INSERT INTO public.user_roles (user_id, role) VALUES
    (pg_temp.id('platform_admin'), 'admin'), (pg_temp.id('agent_a'), 'advisor'), (pg_temp.id('advisor_no_firm'), 'advisor'),
    (pg_temp.id('former_a'), 'advisor');
  FOREACH n IN ARRAY ARRAY['a', 'b'] LOOP
    INSERT INTO public.chamber_sessions (user_id, firm_id, chamber_data)
    VALUES (pg_temp.id('prospect_' || n), pg_temp.id('firm_' || n), jsonb_build_object('company_name', 'Co ' || n))
    RETURNING id INTO sid;
    INSERT INTO fx VALUES ('intake_' || n, sid);
  END LOOP;
END $$;

SELECT pg_temp.as_owner();
INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES
  (pg_temp.id('firm_a'), pg_temp.id('agent_a'), 'agent'),
  (pg_temp.id('firm_a'), pg_temp.id('roleless_a'), 'lead'),
  (pg_temp.id('firm_b'), pg_temp.id('owner_b'), 'owner'),
  (pg_temp.id('firm_a'), pg_temp.id('both'), 'agent'),
  (pg_temp.id('firm_b'), pg_temp.id('both'), 'owner');
INSERT INTO public.firm_memberships (firm_id, user_id, role, valid_from, valid_until)
VALUES (pg_temp.id('firm_a'), pg_temp.id('former_a'), 'agent', now() - interval '10 days', now() - interval '1 day');

-- ---------- 1. my_firms: the firms a person currently belongs to, and their role in each ----------
SELECT pg_temp.as_user('agent_a');
SELECT pg_temp.is((SELECT array_agg(firm_id) FROM public.my_firms()), ARRAY[pg_temp.id('firm_a')], 'a member is told their firm');
SELECT pg_temp.is((SELECT role FROM public.my_firms()), 'agent', 'and their role in it');
SELECT pg_temp.is((SELECT address FROM public.my_firms()), (SELECT address FROM public.firms WHERE id = pg_temp.id('firm_a')), 'and its address');
SELECT pg_temp.as_user('both');
SELECT pg_temp.is((SELECT array_agg(firm_id ORDER BY name) FROM public.my_firms()), ARRAY[pg_temp.id('firm_b'), pg_temp.id('firm_a')], 'a member of two firms is told both');
SELECT pg_temp.as_user('platform_admin');
SELECT pg_temp.is((SELECT count(*) FROM public.my_firms()), 0::bigint, 'a platform admin who belongs to no firm is told none (D-16)');
SELECT pg_temp.as_user('advisor_no_firm');
SELECT pg_temp.is((SELECT count(*) FROM public.my_firms()), 0::bigint, 'the advisor role without a membership is told none');
SELECT pg_temp.as_user('former_a');
SELECT pg_temp.is((SELECT count(*) FROM public.my_firms()), 0::bigint, 'a former member is told none');
SELECT pg_temp.as_user('nobody');
SELECT pg_temp.is((SELECT count(*) FROM public.my_firms()), 0::bigint, 'a person with no membership is told none');
SELECT pg_temp.as_user_with('agent_a', 'anonymous', 'aal1', true);
SELECT pg_temp.is((SELECT count(*) FROM public.my_firms()), 0::bigint, 'a guest session is told none');
SELECT pg_temp.as_user_with('agent_a', 'password', 'aal1');
SELECT pg_temp.is((SELECT count(*) FROM public.my_firms()), 0::bigint, 'a password sign-in that has not done its second factor is told none (D-19)');
SELECT pg_temp.as_user_with('agent_a', 'password', 'aal2');
SELECT pg_temp.is((SELECT count(*) FROM public.my_firms()), 1::bigint, 'and once it has, its firm');
SELECT pg_temp.as_user_with('agent_a', 'oauth', 'aal1');
SELECT pg_temp.is((SELECT count(*) FROM public.my_firms()), 1::bigint, 'a Google or Microsoft sign-in needs no second factor');
RESET ROLE;
SELECT set_config('role', 'anon', false);
SELECT pg_temp.expect('SELECT * FROM public.my_firms()', '42501', 'a signed-out caller can''t ask');
SELECT pg_temp.as_owner();

-- ---------- 2. A current member passes the console functions' check, whether or not they hold a platform role ----------
-- is_advisor() stays the platform role (the PEO catalogue and its contacts are read through it); the console's functions ask
-- require_advisor(), which a current member passes too, and each of them filters by the row's firm.
SELECT pg_temp.as_user('roleless_a');
SELECT pg_temp.is(public.is_advisor(), false, 'a member with no platform role does not hold the platform role');
SELECT pg_temp.is((SELECT count(*) FROM public.advisor_list_submissions(NULL, NULL, 50, 0)), 1::bigint, 'but the console lists their firm''s submission');
SELECT pg_temp.is((SELECT count(*) FROM public.advisor_list_submissions(NULL, NULL, 50, 0) WHERE session_id = pg_temp.id('intake_b')), 0::bigint, 'and not the other firm''s');
SELECT pg_temp.is((SELECT count(*) FROM public.peos), 0::bigint, 'and reads no PEO of the platform''s catalogue');
SELECT pg_temp.is((SELECT firm_id FROM public.advisor_add_referral_partner('p1', 'A partner', 'accounting')), pg_temp.id('firm_a'), 'and adds a referral partner to their own firm, as CRM-P2.1c makes partners a firm''s own');
SELECT pg_temp.is((SELECT name FROM public.advisor_update_referral_partner('p1', 'Renamed partner', 'accounting')), 'Renamed partner', 'edits it');
SELECT pg_temp.as_owner();
INSERT INTO public.referral_partners (firm_id, code, name, kind) VALUES (pg_temp.id('firm_b'), 'b1', 'Other firm''s partner', 'accounting');
SELECT pg_temp.as_user('roleless_a');
SELECT pg_temp.is((SELECT string_agg(code, ',' ORDER BY code) FROM public.referral_partners), 'p1', 'lists their firm''s partners and none of the other firm''s');
SELECT pg_temp.expect('SELECT public.advisor_update_referral_partner(''b1'', ''Taken'', ''accounting'')', 'PT404', 'cannot edit the other firm''s partner by its code');
SELECT pg_temp.expect(format('SELECT public.advisor_update_referral_partner(''b1'', ''Taken'', ''accounting'', %L)', pg_temp.id('firm_b')), '42501', 'nor by naming that firm');
SELECT pg_temp.is((SELECT count(*)::int FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'advisor_add_referral_partner'), 1, 'only one way to add a partner exists: the three-argument version that ignores the firm is gone');
SELECT pg_temp.is((SELECT count(*)::int FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'advisor_update_referral_partner'), 1, 'and only one way to edit one');
SELECT pg_temp.as_user('owner_b');
SELECT pg_temp.is((SELECT count(*) FROM public.advisor_list_submissions(NULL, NULL, 50, 0)), 1::bigint, 'an owner of a firm with no platform role lists their firm''s submission');
SELECT pg_temp.is((SELECT count(*) FROM public.advisor_list_submissions(NULL, NULL, 50, 0) WHERE session_id = pg_temp.id('intake_a')), 0::bigint, 'and none of Edgar Allan Advisory''s');
SELECT pg_temp.as_user('nobody');
SELECT pg_temp.expect('SELECT * FROM public.advisor_list_submissions(NULL, NULL, 50, 0)', '42501', 'a person with no role and no membership is refused');
SELECT pg_temp.as_user('former_a');
SELECT pg_temp.is((SELECT count(*) FROM public.advisor_list_submissions(NULL, NULL, 50, 0)), 0::bigint, 'a former member who still holds the advisor role is answered with no rows');
SELECT pg_temp.as_owner();
DELETE FROM public.user_roles WHERE user_id = pg_temp.id('former_a');
SELECT pg_temp.as_user('former_a');
SELECT pg_temp.expect('SELECT * FROM public.advisor_list_submissions(NULL, NULL, 50, 0)', '42501', 'a former member with no role is refused');
SELECT pg_temp.as_user_with('roleless_a', 'password', 'aal1');
SELECT pg_temp.expect('SELECT * FROM public.advisor_list_submissions(NULL, NULL, 50, 0)', '42501', 'a member with no role is held back by the second factor like anyone');
SELECT pg_temp.as_user_with('roleless_a', 'password', 'aal2');
SELECT pg_temp.is((SELECT count(*) FROM public.advisor_list_submissions(NULL, NULL, 50, 0)), 1::bigint, 'and let in once it is done');
SELECT pg_temp.as_user_with('roleless_a', 'anonymous', 'aal1', true);
SELECT pg_temp.expect('SELECT * FROM public.advisor_list_submissions(NULL, NULL, 50, 0)', '42501', 'a guest session is no member');
SELECT pg_temp.as_user('advisor_no_firm');
SELECT pg_temp.is((SELECT count(*) FROM public.peos) > 0, true, 'the platform role still reads the PEO catalogue');
SELECT pg_temp.as_user('platform_admin');
SELECT pg_temp.is(public.is_advisor(), true, 'the admin role still passes the platform-wide check');
SELECT pg_temp.is((SELECT count(*) FROM public.advisor_list_submissions(NULL, NULL, 50, 0)), 0::bigint, 'but an admin who belongs to no firm lists no firm''s submission (D-16)');
SELECT pg_temp.as_owner();

-- ---------- 3. The second factor is owed by a member with no platform role too (D-19) ----------
SELECT pg_temp.as_user_with('roleless_a', 'password', 'aal1');
SELECT pg_temp.is(public.advisor_needs_second_factor(), true, 'a lead with no role who signed in with a password is sent to the second factor');
SELECT pg_temp.as_user_with('roleless_a', 'oauth', 'aal1');
SELECT pg_temp.is(public.advisor_needs_second_factor(), false, 'one who signed in with Google is not');
SELECT pg_temp.as_user_with('roleless_a', 'password', 'aal2');
SELECT pg_temp.is(public.advisor_needs_second_factor(), false, 'one who has done it is not');
SELECT pg_temp.as_user_with('nobody', 'password', 'aal1');
SELECT pg_temp.is(public.advisor_needs_second_factor(), false, 'a person with no role and no membership is never asked');
SELECT pg_temp.as_owner();
-- ---------- 4. A mailbox is a current member's, whether or not they hold a platform role ----------
-- The mailbox function stores for a person the edge function has already checked (their membership and the second factor,
-- through my_firms()); the database refuses anyone who is no current member of a firm, a platform role or not.
SELECT pg_temp.as_owner();
SELECT pg_temp.is(public.mailbox_store(pg_temp.id('roleless_a'), 'microsoft', 'pat@alpha.example', 'Mail.Send', 'cipher', 'iv')::text, '{"connected": true}', 'a member with no platform role connects a mailbox');
SELECT pg_temp.as_user('roleless_a');
SELECT pg_temp.is(public.my_mailbox() ->> 'connected', 'true', 'and is told it is connected');
SELECT pg_temp.as_owner();
SELECT pg_temp.is(public.mailbox_secret(pg_temp.id('roleless_a')) ->> 'address', 'pat@alpha.example', 'and it is sent through');
SELECT pg_temp.expect(format('SELECT public.mailbox_store(%L, ''microsoft'', ''x@y.example'', ''Mail.Send'', ''c'', ''i'')', pg_temp.id('platform_admin')), '42501', 'a platform admin who belongs to no firm connects none (D-16)');
SELECT pg_temp.expect(format('SELECT public.mailbox_store(%L, ''microsoft'', ''x@y.example'', ''Mail.Send'', ''c'', ''i'')', pg_temp.id('nobody')), '42501', 'nor does a person with no membership');
SELECT pg_temp.expect(format('SELECT public.mailbox_store(%L, ''microsoft'', ''x@y.example'', ''Mail.Send'', ''c'', ''i'')', pg_temp.id('former_a')), '42501', 'nor a former member');
-- Removing a platform role no longer disconnects a person who is still a current member of a firm: the mailbox is a member's.
SELECT pg_temp.as_owner();
SELECT pg_temp.is(public.mailbox_store(pg_temp.id('agent_a'), 'microsoft', 'agent@alpha.example', 'Mail.Send', 'cipher', 'iv')::text, '{"connected": true}', 'a member who holds the advisor role connects a mailbox');
DELETE FROM public.user_roles WHERE user_id = pg_temp.id('agent_a');
SELECT pg_temp.is((SELECT count(*) FROM public.broker_mailboxes WHERE user_id = pg_temp.id('agent_a')), 1::bigint, 'losing their last platform role leaves a current member''s mailbox connected');
SELECT pg_temp.is(public.mailbox_secret(pg_temp.id('agent_a')) ->> 'address', 'agent@alpha.example', 'and it still sends');
-- A person with no current membership keeps none once no platform role remains (their membership ending is CRM-P1.5's).
INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('advisor_no_firm'), 'advisor'), (pg_temp.id('former_a'), 'advisor') ON CONFLICT DO NOTHING;
INSERT INTO public.broker_mailboxes (user_id, provider, address, scope, token_ciphertext, token_iv) VALUES
  (pg_temp.id('advisor_no_firm'), 'microsoft', 'a@x.example', 'Mail.Send', 'c', 'i'), (pg_temp.id('former_a'), 'microsoft', 'f@x.example', 'Mail.Send', 'c', 'i');
DELETE FROM public.user_roles WHERE user_id = pg_temp.id('advisor_no_firm') AND role = 'advisor';
DELETE FROM public.user_roles WHERE user_id = pg_temp.id('former_a');
SELECT pg_temp.is((SELECT count(*) FROM public.broker_mailboxes WHERE user_id IN (pg_temp.id('advisor_no_firm'), pg_temp.id('former_a'))), 0::bigint, 'a person with no current membership and no platform role keeps no mailbox');
\echo console_per_firm: ok
