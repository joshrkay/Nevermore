-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh firm_invitations
-- Inviting a member to a firm (story CRM-P1.2; docs/BROKER_CRM_BUILD.md D-5, D-16, D-18, D-19, D-20, D-28, D-29;
-- 20261116190000_firm_invitations.sql). A current owner of a firm invites an email address with a role; the invitation is a
-- single-use token that expires in seven days and is stored only as a hash. The invited person, signed in with that
-- email, verified, accepts it and becomes a current member with that role. An owner lists the pending invitations
-- and cancels or resends one. Who may do what is decided here, from the caller's own current membership (D-18), never
-- from an address; a platform admin who belongs to no firm may do none of it (D-16). Two firms are used throughout.
-- The list of earlier migrations is pinned on purpose to what existed before this story (the file loads this
-- story's migration itself after them).
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
\i supabase/migrations/20261116170000_firm_signup.sql
\i supabase/migrations/20261116190000_firm_invitations.sql
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

-- Acts as a signed-in person. `how` 'google' is a sign-in through a provider; 'password' one with a password and no second
-- factor; 'password_mfa' one with the second factor completed (D-19).
CREATE FUNCTION pg_temp.as_user(n text, guest boolean DEFAULT false, how text DEFAULT 'google') RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    (jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', guest,
      'email', CASE WHEN guest THEN NULL ELSE n || '@example.test' END)
     || CASE WHEN how IN ('password', 'password_mfa')
          THEN jsonb_build_object('amr', jsonb_build_array(jsonb_build_object('method', 'password', 'timestamp', 1)),
                                  'aal', CASE WHEN how = 'password' THEN 'aal1' ELSE 'aal2' END)
          ELSE '{}'::jsonb END)::text, false);
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

-- A token as the server function makes one, and the hash it gives the database: the database never sees the token itself.
CREATE FUNCTION pg_temp.hash_of(token text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(extensions.digest(convert_to(token, 'UTF8'), 'sha256'), 'hex')
$$;

-- The hook that CRM-P2.3 takes over records every invitation event here, so the tests can read what the story hands it.
CREATE TABLE public.test_firm_events (id bigint GENERATED ALWAYS AS IDENTITY, firm_id uuid, kind text, actor uuid, detail jsonb);
CREATE OR REPLACE FUNCTION public.record_firm_event(p_firm_id uuid, p_kind text, p_actor uuid, p_detail jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.test_firm_events (firm_id, kind, actor, detail) VALUES (p_firm_id, p_kind, p_actor, p_detail);
END $$;
REVOKE ALL ON FUNCTION public.record_firm_event(uuid, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- ---------- set up: two firms, each with an owner, a lead and an agent; a platform admin; people with no firm ----------
DO $$
DECLARE acme uuid; zenith uuid; team_acme uuid := gen_random_uuid(); team_zenith uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Acme Brokers', 'acme-brokers', now()) RETURNING id INTO acme;
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Zenith Benefits', 'zenith-benefits', now()) RETURNING id INTO zenith;
  INSERT INTO fx VALUES ('acme', acme), ('zenith', zenith), ('team_acme', team_acme), ('team_zenith', team_zenith);
  INSERT INTO public.firm_teams (id, firm_id, name) VALUES (team_acme, acme, 'Sales'), (team_zenith, zenith, 'Service');
  PERFORM pg_temp.new_user('acme_owner'); PERFORM pg_temp.new_user('acme_lead'); PERFORM pg_temp.new_user('acme_agent');
  PERFORM pg_temp.new_user('zenith_owner'); PERFORM pg_temp.new_user('zenith_agent');
  PERFORM pg_temp.new_user('platform_admin'); PERFORM pg_temp.new_user('nobody');
  PERFORM pg_temp.new_user('guest_visitor', true);
  PERFORM pg_temp.new_user('newcomer'); PERFORM pg_temp.new_user('other_person');
  PERFORM pg_temp.new_user('unverified', false, false);
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES
    (acme, pg_temp.id('acme_owner'), 'owner'), (acme, pg_temp.id('acme_lead'), 'lead'), (acme, pg_temp.id('acme_agent'), 'agent'),
    (zenith, pg_temp.id('zenith_owner'), 'owner'), (zenith, pg_temp.id('zenith_agent'), 'agent');
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('platform_admin'), 'admin');
END $$;

-- ---------- who may invite ----------
-- Break caught: anyone who is not a current owner of the firm can invite: a lead, an agent, an owner of the OTHER firm, a
-- platform admin who belongs to no firm (D-16), a person with no firm, a guest, a signed-out caller; or an owner's
-- invitation is not stored; or the firm is taken from anything but the caller's own membership.
DO $$
DECLARE r record; who text; acme uuid := pg_temp.id('acme');
BEGIN
  PERFORM pg_temp.as_user('acme_owner');
  SELECT * INTO r FROM public.invite_member(acme, 'newcomer@example.test', 'agent', NULL, pg_temp.hash_of('token-one'));
  PERFORM pg_temp.is(r.firm_name, 'Acme Brokers', 'the owner''s invitation names the firm, for the email');
  PERFORM pg_temp.is(r.firm_address, 'acme-brokers', 'and its address, where the link opens');
  PERFORM pg_temp.is(r.email, 'newcomer@example.test', 'and the email to send it to, as kept (lower case, no spaces)');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_invitations WHERE firm_id = acme), 1::bigint, 'one invitation is stored');
  PERFORM pg_temp.is((SELECT role FROM public.firm_invitations WHERE id = r.invitation_id), 'agent', 'with the role given');
  PERFORM pg_temp.is((SELECT status FROM public.firm_invitations WHERE id = r.invitation_id), 'pending', 'pending');
  FOREACH who IN ARRAY ARRAY['acme_lead', 'acme_agent', 'zenith_owner', 'zenith_agent', 'platform_admin', 'nobody'] LOOP
    PERFORM pg_temp.as_user(who);
    PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.invite_member(%L, %L, %L, NULL, %L)', acme, 'x-' || who || '@example.test', 'agent', pg_temp.hash_of('t-' || who))),
      '42501', who || ' may not invite to Acme');
  END LOOP;
  PERFORM pg_temp.as_user('guest_visitor', true);
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.invite_member(%L, %L, %L, NULL, %L)', acme, 'g@example.test', 'agent', pg_temp.hash_of('t-g'))), '42501', 'a guest may not');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.invite_member(%L, %L, %L, NULL, %L)', acme, 'a@example.test', 'agent', pg_temp.hash_of('t-a'))), '42501', 'a signed-out caller may not');
  PERFORM pg_temp.is(has_function_privilege('anon', 'public.invite_member(uuid, text, text, uuid, text)', 'EXECUTE'), false, 'and holds no right to call it');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_invitations WHERE firm_id = acme), 1::bigint, 'and none of them left an invitation behind');
  RAISE NOTICE 'firm_invitations: who may invite cases passed';
END $$;

-- ---------- one pending invitation per firm and email; not a current member ----------
-- Break caught (D-29): a second pending invitation for the same email at the same firm is made (the rule is only a
-- lock or a check, not a constraint: the second insert is tried straight at the table); the same email in other capitals
-- or with spaces is a different one; an email that already belongs to a current member is invited again; the same
-- email invited to the OTHER firm is wrongly refused.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); zenith uuid := pg_temp.id('zenith');
BEGIN
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.firm_invitations (firm_id, email, role, token_hash, expires_at)
    VALUES (%L, 'newcomer@example.test', 'lead', %L, now() + interval '7 days')$q$, acme, pg_temp.hash_of('t-second'))), '23505',
    'the table itself refuses a second pending invitation for the same firm and email');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.invite_member(%L, '  NewComer@Example.TEST ', 'agent', NULL, %L)$q$, acme, pg_temp.hash_of('t-caps'))),
    'PT409', 'the same email in other capitals and with spaces is the same invitation, and is refused with the usual message');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.invite_member(%L, 'acme_agent@example.test', 'agent', NULL, %L)$q$, acme, pg_temp.hash_of('t-member'))),
    'PT409', 'a current member of the firm is not invited again');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.invite_member(%L, 'ACME_OWNER@example.test', 'agent', NULL, %L)$q$, acme, pg_temp.hash_of('t-self'))),
    'PT409', 'nor is the owner themselves');
  RESET ROLE;
  -- A membership that has ended is not a current one: that person can be invited back.
  INSERT INTO public.firm_memberships (firm_id, user_id, role, valid_from, valid_until)
    VALUES (acme, pg_temp.id('other_person'), 'agent', now() - interval '30 days', now() - interval '1 day');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.invite_member(%L, 'other_person@example.test', 'agent', NULL, %L)$q$, acme, pg_temp.hash_of('t-former'))),
    'rows:1', 'a former member can be invited back');
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.invite_member(%L, 'newcomer@example.test', 'agent', NULL, %L)$q$, zenith, pg_temp.hash_of('t-zenith'))),
    'rows:1', 'the same email can be invited to the other firm');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_invitations WHERE firm_id = acme AND status = 'pending'), 1::bigint, 'Acme still has its one pending invitation (every attempt above was rolled back)');
  RAISE NOTICE 'firm_invitations: one pending per firm and email cases passed';
END $$;

-- ---------- what an invitation may hold ----------
-- Break caught: a role other than owner, lead or agent, a malformed email, a team of another firm, or a token hash that
-- is not a hash (the token itself passed by mistake) is accepted; or a refused invitation still leaves a row.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); before_count bigint;
BEGIN
  RESET ROLE;
  before_count := (SELECT count(*) FROM public.firm_invitations);
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.invite_member(%L, 'a@example.test', 'admin', NULL, %L)$q$, acme, pg_temp.hash_of('v1'))), '23514', 'the role admin is not a firm role');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.invite_member(%L, 'a@example.test', NULL, NULL, %L)$q$, acme, pg_temp.hash_of('v2'))), '23502', 'a role is required');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.invite_member(%L, 'not an email', 'agent', NULL, %L)$q$, acme, pg_temp.hash_of('v3'))), '23514', 'a malformed email is refused');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.invite_member(%L, NULL, 'agent', NULL, %L)$q$, acme, pg_temp.hash_of('v4'))), '23514', 'so is none');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.invite_member(%L, 'a@example.test', 'agent', %L, %L)$q$, acme, pg_temp.id('team_zenith'), pg_temp.hash_of('v5'))), '23503', 'a team of another firm is refused');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.invite_member(%L, 'a@example.test', 'agent', NULL, 'the-raw-token')$q$, acme)), '23514', 'a token passed instead of its hash is refused');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.invite_member(%L, 'a@example.test', 'agent', NULL, NULL)$q$, acme)), '23502', 'and so is no hash');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.invite_member(%L, 'a@example.test', 'agent', %L, %L)$q$, acme, pg_temp.id('team_acme'), pg_temp.hash_of('v6'))), 'rows:1', 'a team of the firm is fine');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.invite_member(%L, 'b@example.test', 'owner', NULL, %L)$q$, acme, pg_temp.hash_of('v7'))), 'rows:1', 'an owner can invite another owner');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.invite_member(%L, 'c@example.test', 'lead', NULL, %L)$q$, acme, pg_temp.hash_of('token-one'))), '23505', 'a token hash is used once: the same one for another invitation is refused');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_invitations), before_count + 0, 'refused invitations left nothing (the two good ones were rolled back by the check)');
  RAISE NOTICE 'firm_invitations: what an invitation may hold cases passed';
END $$;

-- ---------- the token is never stored ----------
-- Break caught: the raw token, not its hash, is written to the table, returned, or handed to the event record.
DO $$
DECLARE r record; acme uuid := pg_temp.id('acme'); inv_row text; event_text text;
BEGIN
  PERFORM pg_temp.as_user('acme_owner');
  SELECT * INTO r FROM public.invite_member(acme, 'tokenless@example.test', 'agent', NULL, pg_temp.hash_of('raw-secret-token'));
  RESET ROLE;
  SELECT row_to_json(i)::text INTO inv_row FROM public.firm_invitations i WHERE i.id = r.invitation_id;
  PERFORM pg_temp.is(position('raw-secret-token' IN inv_row), 0, 'the stored row does not contain the token');
  PERFORM pg_temp.is((SELECT token_hash FROM public.firm_invitations WHERE id = r.invitation_id), pg_temp.hash_of('raw-secret-token'), 'only its hash');
  SELECT string_agg(e.detail::text, ' ') INTO event_text FROM public.test_firm_events e;
  PERFORM pg_temp.is(position('raw-secret-token' IN event_text), 0, 'the event record never holds the token');
  PERFORM pg_temp.is(position(pg_temp.hash_of('raw-secret-token') IN event_text), 0, 'nor its hash');
  PERFORM pg_temp.is(r.expires_at > now() + interval '6 days 23 hours' AND r.expires_at <= now() + interval '7 days', true, 'the invitation lasts seven days');
  RAISE NOTICE 'firm_invitations: token never stored cases passed';
END $$;

-- ---------- the record ----------
-- Break caught: an invitation is made with no event handed to the hook, or the event misses who, the firm, the role or the email.
DO $$
DECLARE e record; acme uuid := pg_temp.id('acme');
BEGIN
  SELECT * INTO e FROM public.test_firm_events WHERE kind = 'member_invited' AND detail ->> 'email' = 'newcomer@example.test' AND firm_id = acme;
  PERFORM pg_temp.is(e.actor, pg_temp.id('acme_owner'), 'the event names who invited');
  PERFORM pg_temp.is(e.detail ->> 'role', 'agent', 'the role');
  PERFORM pg_temp.is(e.detail ->> 'invitation_id' IS NOT NULL, true, 'and the invitation');
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM public.invite_member(pg_temp.id('zenith'), 'zenith_hire@example.test', 'lead', NULL, pg_temp.hash_of('zenith-hire'));
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.test_firm_events WHERE kind = 'member_invited' AND firm_id = pg_temp.id('zenith')), 1::bigint, 'Zenith''s invitation is recorded against Zenith');
  PERFORM pg_temp.is((SELECT count(*) FROM public.test_firm_events WHERE kind = 'member_invited' AND firm_id = acme AND detail ->> 'email' = 'zenith_hire@example.test'), 0::bigint, 'and not against Acme');
  RAISE NOTICE 'firm_invitations: record cases passed';
END $$;

-- ---------- accepting ----------
-- Break caught: accepting makes no membership, or one with another role or team, or one that is not dated from today and
-- open-ended; the invitation can be used a second time; the acceptance is not recorded with who and the role; or the new
-- member does not become a member at the firm's address at once.
DO $$
DECLARE r record; acme uuid := pg_temp.id('acme'); m public.firm_memberships; i public.firm_invitations;
BEGIN
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.invite_member(acme, 'newcomer2@example.test', 'lead', pg_temp.id('team_acme'), pg_temp.hash_of('join-token'));
  RESET ROLE;
  PERFORM pg_temp.new_user('newcomer2');
  PERFORM pg_temp.as_user('newcomer2');
  PERFORM pg_temp.is(public.is_member_of_firm_address('acme-brokers'), false, 'before accepting, not a member');
  SELECT * INTO r FROM public.accept_invitation(pg_temp.hash_of('join-token'));
  PERFORM pg_temp.is(r.firm_address, 'acme-brokers', 'accepting answers the firm''s address');
  PERFORM pg_temp.is(r.role, 'lead', 'and the role');
  PERFORM pg_temp.is(public.is_member_of_firm_address('acme-brokers'), true, 'the person is a member at the firm''s address at once');
  PERFORM pg_temp.is(public.firm_role(acme), 'lead', 'with the invited role');
  RESET ROLE;
  SELECT * INTO m FROM public.firm_memberships WHERE firm_id = acme AND user_id = pg_temp.id('newcomer2');
  PERFORM pg_temp.is(m.role, 'lead', 'the membership holds the role');
  PERFORM pg_temp.is(m.team_id, pg_temp.id('team_acme'), 'and the team');
  PERFORM pg_temp.is(m.valid_from <= now() AND m.valid_from > now() - interval '1 minute', true, 'dated from now');
  PERFORM pg_temp.is(m.valid_until IS NULL, true, 'with no end date');
  SELECT * INTO i FROM public.firm_invitations WHERE token_hash = pg_temp.hash_of('join-token');
  PERFORM pg_temp.is(i.status, 'accepted', 'the invitation is used');
  PERFORM pg_temp.is(i.accepted_by, pg_temp.id('newcomer2'), 'by this person');
  PERFORM pg_temp.is(i.accepted_at IS NOT NULL, true, 'and when');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_memberships WHERE firm_id = acme AND user_id = pg_temp.id('newcomer2')), 1::bigint, 'exactly one membership');
  PERFORM pg_temp.is((SELECT e.actor FROM public.test_firm_events e WHERE e.kind = 'member_invitation_accepted' AND e.firm_id = acme), pg_temp.id('newcomer2'), 'the acceptance is recorded with who');
  PERFORM pg_temp.is((SELECT e.detail ->> 'role' FROM public.test_firm_events e WHERE e.kind = 'member_invitation_accepted' AND e.firm_id = acme), 'lead', 'and the role');
  RAISE NOTICE 'firm_invitations: accepting cases passed';
END $$;

-- Message of the refusal a statement raises, rolled back.
CREATE FUNCTION pg_temp.refusal(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE s text; m text;
BEGIN
  BEGIN
    EXECUTE stmt;
    RAISE EXCEPTION USING ERRCODE = 'ZZ999', MESSAGE = 'it ran';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT;
    RETURN s || ': ' || m;
  END;
END $$;

-- ---------- a link that cannot be used ----------
-- Break caught: a used link opens the firm for a second person, or the same person's second membership; an expired one is
-- accepted; a token nobody made is accepted or raises something other than "not valid"; the three refusals do not say
-- plainly why (used, expired); the words differ between an invitation whose email has an account and one whose email has
-- none, which would tell a stranger holding a link whether an email has an account.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); with_account text; without_account text; before_members bigint;
BEGIN
  PERFORM pg_temp.as_user('newcomer2');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.accept_invitation(%L)', pg_temp.hash_of('join-token'))),
    'PT410: This invitation has already been used', 'the same link used again by the same person says it was used');
  PERFORM pg_temp.as_user('other_person');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.accept_invitation(%L)', pg_temp.hash_of('join-token'))),
    'PT410: This invitation has already been used', 'and by anyone else');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.accept_invitation(%L)', pg_temp.hash_of('never-made'))),
    'PT404: This invitation link is not valid', 'a token nobody made is not valid');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_memberships WHERE firm_id = acme AND user_id = pg_temp.id('other_person') AND valid_until IS NULL), 0::bigint, 'and no one else became a member');

  -- Expired: seven days and a moment on; for an email that has an account (other_person) and one that has none.
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.invite_member(acme, 'other_person@example.test', 'agent', NULL, pg_temp.hash_of('expiring-one'));
  PERFORM public.invite_member(acme, 'no-account-yet@example.test', 'agent', NULL, pg_temp.hash_of('expiring-two'));
  RESET ROLE;
  UPDATE public.firm_invitations SET expires_at = now() - interval '1 second', created_at = now() - interval '8 days'
    WHERE token_hash IN (pg_temp.hash_of('expiring-one'), pg_temp.hash_of('expiring-two'));
  before_members := (SELECT count(*) FROM public.firm_memberships);
  PERFORM pg_temp.as_user('other_person');
  with_account := pg_temp.refusal(format('SELECT public.accept_invitation(%L)', pg_temp.hash_of('expiring-one')));
  without_account := pg_temp.refusal(format('SELECT public.accept_invitation(%L)', pg_temp.hash_of('expiring-two')));
  PERFORM pg_temp.is(with_account, 'PT410: This invitation has expired', 'an expired link says so');
  PERFORM pg_temp.is(without_account, with_account, 'in the same words whether or not the invited email has an account');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_memberships), before_members, 'and opens nothing');
  PERFORM pg_temp.is((SELECT status FROM public.firm_invitations WHERE token_hash = pg_temp.hash_of('expiring-one')), 'pending', 'an expired invitation stays on the owner''s list as pending, to be resent');
  RAISE NOTICE 'firm_invitations: unusable link cases passed';
END $$;

-- ---------- only with that email ----------
-- Break caught: someone signed in with a different email accepts the invitation; the refusal does not say it is about the
-- email; the refused attempt uses the link up or makes a membership; a guest, a signed-out caller or an account whose email
-- was never verified accepts (even one with the right email); an email in other capitals is not matched.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); zenith uuid := pg_temp.id('zenith'); r record;
BEGIN
  -- The expired invitation above is withdrawn (an owner does it with cancel_invitation) so the person can be invited afresh.
  UPDATE public.firm_invitations SET status = 'cancelled', cancelled_at = now() WHERE token_hash = pg_temp.hash_of('expiring-one');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.invite_member(acme, 'Other_Person@Example.test', 'agent', NULL, pg_temp.hash_of('for-other'));
  RESET ROLE;
  PERFORM pg_temp.is((SELECT email FROM public.firm_invitations WHERE token_hash = pg_temp.hash_of('for-other')), 'other_person@example.test', 'the invited email is stored in lower case');
  PERFORM pg_temp.as_user('nobody');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.accept_invitation(%L)', pg_temp.hash_of('for-other'))),
    'PT403: This invitation was sent to a different email address than the one you are signed in with', 'a different signed-in email is refused with a clear message');
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.accept_invitation(%L)', pg_temp.hash_of('for-other'))), 'PT403', 'an owner of another firm is just a different email');
  PERFORM pg_temp.as_user('guest_visitor', true);
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.accept_invitation(%L)', pg_temp.hash_of('for-other'))), '42501', 'a guest session may not accept');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(has_function_privilege('anon', 'public.accept_invitation(text)', 'EXECUTE'), false, 'a signed-out caller holds no right to');
  RESET ROLE;
  -- An account that holds the invited email but never verified it.
  UPDATE auth.users SET email_confirmed_at = NULL WHERE id = pg_temp.id('other_person');
  PERFORM pg_temp.as_user('other_person');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.accept_invitation(%L)', pg_temp.hash_of('for-other'))),
    '42501: Sign in with a verified email to accept an invitation', 'an account whose email is not verified may not, even with the invited email');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT status FROM public.firm_invitations WHERE token_hash = pg_temp.hash_of('for-other')), 'pending', 'none of the refused attempts used the link up');
  UPDATE auth.users SET email_confirmed_at = now() WHERE id = pg_temp.id('other_person');
  PERFORM pg_temp.as_user('other_person');
  SELECT * INTO r FROM public.accept_invitation(pg_temp.hash_of('for-other'));
  PERFORM pg_temp.is(r.firm_address, 'acme-brokers', 'the right person, verified, still can accept it afterwards, whatever the capitals of the email');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_memberships WHERE user_id = pg_temp.id('other_person') AND firm_id = zenith), 0::bigint, 'and only the firm that invited them');
  RAISE NOTICE 'firm_invitations: only with that email cases passed';
END $$;

-- ---------- already a member ----------
-- Break caught: a person who became a member another way (a second invitation to a different email of theirs, or a
-- direct add) and then opens a still-pending invitation to the same firm gets a second membership, or the refusal uses
-- the invitation up.
DO $$
DECLARE acme uuid := pg_temp.id('acme');
BEGIN
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.invite_member(acme, 'dual@example.test', 'agent', NULL, pg_temp.hash_of('dual-token'));
  RESET ROLE;
  PERFORM pg_temp.new_user('dual');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (acme, pg_temp.id('dual'), 'agent');
  PERFORM pg_temp.as_user('dual');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.accept_invitation(%L)', pg_temp.hash_of('dual-token'))),
    'PT409: You are already a member of this firm', 'an existing current member is told so');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_memberships WHERE firm_id = acme AND user_id = pg_temp.id('dual')), 1::bigint, 'and gets no second membership');
  RAISE NOTICE 'firm_invitations: already a member cases passed';
END $$;

-- ---------- the owner's list of pending invitations ----------
-- Break caught: the list shows accepted or withdrawn invitations, hides an expired one (the owner could not resend it),
-- leaves out what the owner needs (email, role, when it expires, whether it went out), shows the token's hash, or shows another
-- firm's invitations; a lead, an agent, a platform admin who belongs to no firm, another firm's owner, a guest or a signed-out
-- caller reads it.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); zenith uuid := pg_temp.id('zenith'); r record; who text;
BEGIN
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is((SELECT array_agg(p.email ORDER BY p.email) FROM public.firm_pending_invitations(acme) p),
    ARRAY['dual@example.test', 'newcomer@example.test', 'no-account-yet@example.test', 'tokenless@example.test'],
    'the owner sees the pending ones: not the accepted, not the withdrawn; the expired one is there');
  SELECT * INTO r FROM public.firm_pending_invitations(acme) p WHERE p.email = 'no-account-yet@example.test';
  PERFORM pg_temp.is(r.role, 'agent', 'with the role');
  PERFORM pg_temp.is(r.expired, true, 'saying it has expired');
  PERFORM pg_temp.is((SELECT p.expired FROM public.firm_pending_invitations(acme) p WHERE p.email = 'newcomer@example.test'), false, 'and not saying so of a live one');
  PERFORM pg_temp.is(r.invitation_id IS NOT NULL AND r.invited_at IS NOT NULL AND r.expires_at IS NOT NULL, true, 'with its id and dates');
  PERFORM pg_temp.is((SELECT count(*) FROM jsonb_object_keys(to_jsonb(r)) k WHERE k ILIKE '%hash%' OR k ILIKE '%token%'), 0::bigint, 'it carries neither the token nor its hash');
  FOREACH who IN ARRAY ARRAY['acme_lead', 'acme_agent', 'zenith_owner', 'zenith_agent', 'platform_admin', 'nobody'] LOOP
    PERFORM pg_temp.as_user(who);
    PERFORM pg_temp.is(pg_temp.attempt(format('SELECT * FROM public.firm_pending_invitations(%L)', acme)), '42501', who || ' may not read Acme''s pending invitations');
  END LOOP;
  PERFORM pg_temp.as_user('guest_visitor', true);
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT * FROM public.firm_pending_invitations(%L)', acme)), '42501', 'a guest may not');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(has_function_privilege('anon', 'public.firm_pending_invitations(uuid)', 'EXECUTE'), false, 'a signed-out caller holds no right to');
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM pg_temp.is((SELECT array_agg(p.email) FROM public.firm_pending_invitations(zenith) p), ARRAY['zenith_hire@example.test'], 'Zenith''s owner reads only Zenith''s');
  RESET ROLE;
  RAISE NOTICE 'firm_invitations: pending list cases passed';
END $$;

-- ---------- withdrawing ----------
-- Break caught: an invitation is withdrawn by anyone but an owner of ITS firm (another firm's owner, a lead, a platform admin);
-- withdrawing leaves the link working; the withdrawal is not recorded; an invitation used or withdrawn is withdrawn again;
-- the refusal for another firm's invitation differs from that for one that does not exist (which would tell an outsider
-- which ids exist); after withdrawing, the person can be invited afresh.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); inv uuid; who text; used uuid;
BEGIN
  RESET ROLE;
  SELECT id INTO inv FROM public.firm_invitations WHERE email = 'dual@example.test';
  SELECT id INTO used FROM public.firm_invitations WHERE email = 'newcomer2@example.test';
  FOREACH who IN ARRAY ARRAY['acme_lead', 'acme_agent', 'zenith_owner', 'platform_admin', 'nobody'] LOOP
    PERFORM pg_temp.as_user(who);
    PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.cancel_invitation(%L)', inv)), '42501: Only an owner of the firm can do that', who || ' may not withdraw Acme''s invitation');
  END LOOP;
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.cancel_invitation(%L)', gen_random_uuid())), '42501: Only an owner of the firm can do that',
    'an id that matches nothing gets the same refusal as another firm''s invitation');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(has_function_privilege('anon', 'public.cancel_invitation(uuid)', 'EXECUTE'), false, 'a signed-out caller holds no right to');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT status FROM public.firm_invitations WHERE id = inv), 'pending', 'and the invitation is still pending');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.cancel_invitation(inv);
  RESET ROLE;
  PERFORM pg_temp.is((SELECT status FROM public.firm_invitations WHERE id = inv), 'cancelled', 'the owner withdraws it');
  PERFORM pg_temp.is((SELECT cancelled_by FROM public.firm_invitations WHERE id = inv), pg_temp.id('acme_owner'), 'recording who');
  PERFORM pg_temp.is((SELECT cancelled_at IS NOT NULL FROM public.firm_invitations WHERE id = inv), true, 'and when');
  PERFORM pg_temp.is((SELECT e.actor FROM public.test_firm_events e WHERE e.kind = 'member_invitation_cancelled' AND (e.detail ->> 'invitation_id')::uuid = inv), pg_temp.id('acme_owner'), 'the withdrawal is recorded with who');
  PERFORM pg_temp.is((SELECT e.detail ->> 'role' FROM public.test_firm_events e WHERE e.kind = 'member_invitation_cancelled' AND (e.detail ->> 'invitation_id')::uuid = inv), 'agent', 'and the role');
  PERFORM pg_temp.as_user('dual');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.accept_invitation(%L)', pg_temp.hash_of('dual-token'))), 'PT410: This invitation was withdrawn', 'a withdrawn link says so and opens nothing');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.cancel_invitation(%L)', inv)), 'PT410: This invitation has already been used or withdrawn', 'withdrawing twice is told it is done');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.cancel_invitation(%L)', used)), 'PT410: This invitation has already been used or withdrawn', 'and so is withdrawing one already used');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.invite_member(%L, 'dual@example.test', 'agent', NULL, %L)$q$, acme, pg_temp.hash_of('dual-again'))), 'PT409', 'after withdrawing, the member case still applies: dual is a member now');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_pending_invitations(acme) p WHERE p.email = 'dual@example.test'), 0::bigint, 'a withdrawn invitation leaves the pending list');
  RESET ROLE;
  RAISE NOTICE 'firm_invitations: withdrawing cases passed';
END $$;

-- Break caught: after a withdrawal the same email cannot be invited again (the withdrawn one still counts as pending).
DO $$
DECLARE acme uuid := pg_temp.id('acme'); inv uuid;
BEGIN
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.invite_member(acme, 'again@example.test', 'agent', NULL, pg_temp.hash_of('again-1'));
  SELECT p.invitation_id INTO inv FROM public.firm_pending_invitations(acme) p WHERE p.email = 'again@example.test';
  PERFORM public.cancel_invitation(inv);
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.invite_member(%L, 'again@example.test', 'lead', NULL, %L)$q$, acme, pg_temp.hash_of('again-2'))), 'rows:1', 'a withdrawn email can be invited afresh');
  RESET ROLE;
  RAISE NOTICE 'firm_invitations: withdraw then invite again cases passed';
END $$;

-- ---------- resending ----------
-- Break caught: an invitation is resent by anyone but an owner of its firm; the old link still works after a resend (two live
-- links for one invitation); the new link does not work; an expired invitation is not revived (a new seven days); the
-- resend is not recorded; a used or withdrawn invitation is resent.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); inv uuid; canc uuid; r record; who text;
BEGIN
  PERFORM pg_temp.as_user('acme_owner');
  SELECT p.invitation_id INTO inv FROM public.firm_pending_invitations(acme) p WHERE p.email = 'no-account-yet@example.test';
  PERFORM pg_temp.is((SELECT p.expired FROM public.firm_pending_invitations(acme) p WHERE p.invitation_id = inv), true, 'the invitation has expired');
  FOREACH who IN ARRAY ARRAY['acme_lead', 'acme_agent', 'zenith_owner', 'platform_admin', 'nobody'] LOOP
    PERFORM pg_temp.as_user(who);
    PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.resend_invitation(%L, %L)', inv, pg_temp.hash_of('resent-by-' || who))), '42501: Only an owner of the firm can do that', who || ' may not resend');
  END LOOP;
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.resend_invitation(%L, %L)', gen_random_uuid(), pg_temp.hash_of('nothing'))), '42501: Only an owner of the firm can do that', 'an id that matches nothing is refused the same way');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(has_function_privilege('anon', 'public.resend_invitation(uuid, text)', 'EXECUTE'), false, 'a signed-out caller holds no right to');
  PERFORM pg_temp.as_user('acme_owner');
  SELECT * INTO r FROM public.resend_invitation(inv, pg_temp.hash_of('resent-token'));
  PERFORM pg_temp.is(r.firm_address, 'acme-brokers', 'the resend answers what the email needs: the firm''s address');
  PERFORM pg_temp.is(r.invitation_id, inv, 'and the same invitation');
  PERFORM pg_temp.is(r.email, 'no-account-yet@example.test', 'and whom to send it to');
  PERFORM pg_temp.is(r.expires_at > now() + interval '6 days 23 hours', true, 'with seven days from now, the expired invitation revived');
  PERFORM pg_temp.is((SELECT p.expired FROM public.firm_pending_invitations(acme) p WHERE p.invitation_id = inv), false, 'it no longer reads as expired');
  PERFORM pg_temp.is((SELECT p.resent_at IS NOT NULL FROM public.firm_pending_invitations(acme) p WHERE p.invitation_id = inv), true, 'and says it was resent');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_pending_invitations(acme) p WHERE p.email = 'no-account-yet@example.test'), 1::bigint, 'still one invitation, not two');
  PERFORM pg_temp.is((SELECT e.actor FROM public.test_firm_events e WHERE e.kind = 'member_invitation_resent' AND (e.detail ->> 'invitation_id')::uuid = inv), pg_temp.id('acme_owner'), 'the resend is recorded with who');
  RESET ROLE;
  PERFORM pg_temp.new_user('no-account-yet');
  PERFORM pg_temp.as_user('no-account-yet');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.accept_invitation(%L)', pg_temp.hash_of('expiring-two'))), 'PT404: This invitation link is not valid', 'the old link no longer works');
  SELECT * INTO r FROM public.accept_invitation(pg_temp.hash_of('resent-token'));
  PERFORM pg_temp.is(r.role, 'agent', 'the new link does');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.resend_invitation(%L, %L)', inv, pg_temp.hash_of('after-use'))), 'PT410: This invitation has already been used or withdrawn', 'a used invitation is not resent');
  RESET ROLE;
  SELECT id INTO canc FROM public.firm_invitations WHERE email = 'dual@example.test';
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.resend_invitation(%L, %L)', canc, pg_temp.hash_of('after-cancel'))), 'PT410: This invitation has already been used or withdrawn', 'nor is a withdrawn one');
  RESET ROLE;
  RAISE NOTICE 'firm_invitations: resending cases passed';
END $$;

-- ---------- the outcome of sending the email ----------
-- Break caught: the outcome is recordable by a signed-in person (an owner could mark an invitation as sent, or write what they
-- like into the error); a failure is not shown to the owner; a successful send keeps the earlier error; a long error is kept.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); inv uuid; who text;
BEGIN
  RESET ROLE;
  SELECT id INTO inv FROM public.firm_invitations WHERE email = 'tokenless@example.test';
  FOREACH who IN ARRAY ARRAY['acme_owner', 'zenith_owner', 'nobody'] LOOP
    PERFORM pg_temp.as_user(who);
    PERFORM pg_temp.is(has_function_privilege('authenticated', 'public.record_invitation_delivery(uuid, boolean, text)', 'EXECUTE'), false, 'signed-in people hold no right to record a delivery');
    PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.record_invitation_delivery(%L, true, NULL)', inv)), '42501', who || ' may not record a delivery');
  END LOOP;
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.record_invitation_delivery(%L, true, NULL)', inv)), '42501', 'nor may a signed-out caller');
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', false);
  SET LOCAL ROLE service_role;
  PERFORM public.record_invitation_delivery(inv, false, 'provider_error');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is((SELECT p.email_error FROM public.firm_pending_invitations(acme) p WHERE p.invitation_id = inv), 'provider_error', 'a failed send shows the owner a short kind');
  PERFORM pg_temp.is((SELECT p.email_sent_at IS NULL FROM public.firm_pending_invitations(acme) p WHERE p.invitation_id = inv), true, 'and no time sent');
  RESET ROLE;
  SET LOCAL ROLE service_role;
  PERFORM public.record_invitation_delivery(inv, true, 'ignored');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is((SELECT p.email_sent_at IS NOT NULL AND p.email_error IS NULL FROM public.firm_pending_invitations(acme) p WHERE p.invitation_id = inv), true, 'a good send shows the time and clears the error');
  RESET ROLE;
  SET LOCAL ROLE service_role;
  PERFORM public.record_invitation_delivery(inv, false, repeat('x', 200));
  RESET ROLE;
  PERFORM pg_temp.is((SELECT char_length(email_error) FROM public.firm_invitations WHERE id = inv), 40, 'an error longer than a short kind is cut');
  PERFORM pg_temp.is((SELECT email_sent_at IS NULL FROM public.firm_invitations WHERE id = inv), true, 'and a failure after a send takes the time back: the email is not known to have gone');
  RAISE NOTICE 'firm_invitations: delivery record cases passed';
END $$;

-- ---------- the second factor applies to the new member as to anyone (D-19) ----------
-- Break caught: accepting an invitation, or being invited, gives a password sign-in with no second factor the firm's data or an
-- owner's powers; or a password sign-in cannot even accept (it must be able to join, then add the factor); or a sign-in through
-- a provider, or a password one with the factor, is wrongly held back.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); r record;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.new_user('pw_owner');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.invite_member(acme, 'pw_owner@example.test', 'owner', NULL, pg_temp.hash_of('pw-token'));
  PERFORM pg_temp.as_user('pw_owner', false, 'password');
  SELECT * INTO r FROM public.accept_invitation(pg_temp.hash_of('pw-token'));
  PERFORM pg_temp.is(r.role, 'owner', 'a password sign-in without the factor can accept: the person must join before setting one up');
  PERFORM pg_temp.is(public.is_member_of_firm_address('acme-brokers'), true, 'and is a member at the address, to be sent to set the factor up');
  PERFORM pg_temp.is(public.firm_role(acme), NULL::text, 'but, as for any member, holds no role in the firm until the second factor is done');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.invite_member(%L, 'via-pw@example.test', 'agent', NULL, %L)$q$, acme, pg_temp.hash_of('pw-1'))), '42501', 'so an owner by password alone cannot invite');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.firm_pending_invitations(%L)$q$, acme)), '42501', 'or read the pending list');
  PERFORM pg_temp.as_user('pw_owner', false, 'password_mfa');
  PERFORM pg_temp.is(public.firm_role(acme), 'owner', 'with the second factor done they are the owner');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.invite_member(%L, 'via-pw@example.test', 'agent', NULL, %L)$q$, acme, pg_temp.hash_of('pw-1'))), 'rows:1', 'and can invite');
  PERFORM pg_temp.as_user('pw_owner', false, 'google');
  PERFORM pg_temp.is(public.firm_role(acme), 'owner', 'a provider sign-in needs none');
  RESET ROLE;
  RAISE NOTICE 'firm_invitations: second factor cases passed';
END $$;

-- ---------- the table is reached only through the functions ----------
-- Break caught: an owner (or anyone signed in) reads the table, with the token hashes, or writes to it directly, past the rules
-- the functions keep (the owner check, one pending per email, the role list).
DO $$
DECLARE acme uuid := pg_temp.id('acme'); who text;
BEGIN
  FOREACH who IN ARRAY ARRAY['acme_owner', 'zenith_owner', 'platform_admin'] LOOP
    PERFORM pg_temp.as_user(who);
    PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.firm_invitations'), '42501', who || ' cannot read the table');
    PERFORM pg_temp.is(pg_temp.attempt('SELECT token_hash FROM public.firm_invitations'), '42501', who || ' cannot read the hashes');
    PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.firm_invitations (firm_id, email, role, token_hash, expires_at) VALUES (%L, 'direct@example.test', 'owner', %L, now() + interval '1 day')$q$, acme, pg_temp.hash_of('direct'))), '42501', who || ' cannot insert into it');
    PERFORM pg_temp.is(pg_temp.attempt($q$UPDATE public.firm_invitations SET status = 'accepted'$q$), '42501', who || ' cannot change it');
    PERFORM pg_temp.is(pg_temp.attempt('DELETE FROM public.firm_invitations'), '42501', who || ' cannot delete from it');
  END LOOP;
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.firm_invitations'), '42501', 'a signed-out caller cannot read it');
  RESET ROLE;
  RAISE NOTICE 'firm_invitations: table closed cases passed';
END $$;
