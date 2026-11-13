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
\i supabase/migrations/20261116160001_firm_activity.sql
\i supabase/migrations/20261116170000_firm_signup.sql
\i supabase/migrations/20261116170001_firm_events_recorded.sql
\i supabase/migrations/20261116190000_firm_invitations.sql
\i supabase/migrations/20261116190500_invitation_fixes.sql
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

-- What the firm's record holds (the real record_firm_event of CRM-P2.3, not a stand-in: a kind the record refuses would fail
-- every invitation). Read as the table's owner, so the tests see every firm's entries; the actor is the caller's own sign-in.
CREATE FUNCTION pg_temp.acts(fid uuid, k text) RETURNS SETOF public.firm_activity LANGUAGE sql SECURITY DEFINER AS $$
  SELECT * FROM public.firm_activity WHERE firm_id = fid AND kind = k
$$;

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
  SELECT string_agg(to_jsonb(e)::text, ' ') INTO event_text FROM public.firm_activity e;
  PERFORM pg_temp.is(position('raw-secret-token' IN event_text), 0, 'the event record never holds the token');
  PERFORM pg_temp.is(position(pg_temp.hash_of('raw-secret-token') IN event_text), 0, 'nor its hash');
  PERFORM pg_temp.is(r.expires_at > now() + interval '6 days 23 hours' AND r.expires_at <= now() + interval '7 days', true, 'the invitation lasts seven days');
  RAISE NOTICE 'firm_invitations: token never stored cases passed';
END $$;

-- ---------- the record ----------
-- Break caught: an invitation is made with no event handed to the hook, or the event misses who, the firm, the role or the email.
DO $$
DECLARE acme uuid := pg_temp.id('acme');
BEGIN
  PERFORM pg_temp.is((SELECT count(*) > 0 FROM pg_temp.acts(acme, 'invitation_sent') a WHERE a.record_type = 'firm' AND a.record_id = acme::text), true, 'an invitation is an entry in the firm''s record');
  PERFORM pg_temp.is((SELECT count(DISTINCT a.actor_id) FROM pg_temp.acts(acme, 'invitation_sent') a), 1::bigint, 'by one person');
  PERFORM pg_temp.is((SELECT DISTINCT a.actor_id FROM pg_temp.acts(acme, 'invitation_sent') a), pg_temp.id('acme_owner'), 'the owner who invited');
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM public.invite_member(pg_temp.id('zenith'), 'zenith_hire@example.test', 'lead', NULL, pg_temp.hash_of('zenith-hire'));
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.acts(pg_temp.id('zenith'), 'invitation_sent')), 1::bigint, 'Zenith''s invitation is recorded against Zenith');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.acts(acme, 'invitation_sent') a WHERE a.actor_id = pg_temp.id('zenith_owner')), 0::bigint, 'and not against Acme');
  PERFORM pg_temp.is((SELECT DISTINCT a.role FROM pg_temp.acts(pg_temp.id('zenith'), 'invitation_sent') a), 'lead', 'and it records the role that was offered');
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
  SELECT * INTO r FROM public.accept_invitation(pg_temp.hash_of('join-token'), 'acme-brokers');
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
  PERFORM pg_temp.is((SELECT a.actor_id FROM pg_temp.acts(acme, 'member_added') a WHERE a.subject_user_id = pg_temp.id('newcomer2')), pg_temp.id('newcomer2'), 'the joining is recorded with who, as a member added');
  PERFORM pg_temp.is((SELECT a.role FROM pg_temp.acts(acme, 'member_added') a WHERE a.subject_user_id = pg_temp.id('newcomer2')), 'lead', 'and the role');
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
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.accept_invitation(%L, %L)', pg_temp.hash_of('join-token'), 'acme-brokers')),
    'PT410: This invitation has already been used', 'the same link used again by the same person says it was used');
  PERFORM pg_temp.as_user('other_person');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.accept_invitation(%L, %L)', pg_temp.hash_of('join-token'), 'acme-brokers')),
    'PT410: This invitation has already been used', 'and by anyone else');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.accept_invitation(%L, %L)', pg_temp.hash_of('never-made'), 'acme-brokers')),
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
  with_account := pg_temp.refusal(format('SELECT public.accept_invitation(%L, %L)', pg_temp.hash_of('expiring-one'), 'acme-brokers'));
  without_account := pg_temp.refusal(format('SELECT public.accept_invitation(%L, %L)', pg_temp.hash_of('expiring-two'), 'acme-brokers'));
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
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.accept_invitation(%L, %L)', pg_temp.hash_of('for-other'), 'acme-brokers')),
    'PT403: This invitation was sent to a different email address than the one you are signed in with', 'a different signed-in email is refused with a clear message');
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.accept_invitation(%L, %L)', pg_temp.hash_of('for-other'), 'acme-brokers')), 'PT403', 'an owner of another firm is just a different email');
  PERFORM pg_temp.as_user('guest_visitor', true);
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.accept_invitation(%L, %L)', pg_temp.hash_of('for-other'), 'acme-brokers')), '42501', 'a guest session may not accept');
  -- A verified account with the right email, presenting a guest token (as the advisor behind a guest token is treated elsewhere).
  PERFORM pg_temp.as_user('other_person', true);
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.accept_invitation(%L, %L)', pg_temp.hash_of('for-other'), 'acme-brokers')), '42501', 'nor may a verified account presenting a guest token');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(has_function_privilege('anon', 'public.accept_invitation(text, text)', 'EXECUTE'), false, 'a signed-out caller holds no right to');
  RESET ROLE;
  -- An account that holds the invited email but never verified it.
  UPDATE auth.users SET email_confirmed_at = NULL WHERE id = pg_temp.id('other_person');
  PERFORM pg_temp.as_user('other_person');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.accept_invitation(%L, %L)', pg_temp.hash_of('for-other'), 'acme-brokers')),
    '42501: Sign in with a verified email to accept an invitation', 'an account whose email is not verified may not, even with the invited email');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT status FROM public.firm_invitations WHERE token_hash = pg_temp.hash_of('for-other')), 'pending', 'none of the refused attempts used the link up');
  UPDATE auth.users SET email_confirmed_at = now() WHERE id = pg_temp.id('other_person');
  PERFORM pg_temp.as_user('other_person');
  SELECT * INTO r FROM public.accept_invitation(pg_temp.hash_of('for-other'), 'acme-brokers');
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
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.accept_invitation(%L, %L)', pg_temp.hash_of('dual-token'), 'acme-brokers')),
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
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.acts(pg_temp.id('acme'), 'invitation_withdrawn') a WHERE a.actor_id = pg_temp.id('acme_owner')), 1::bigint, 'the withdrawal is recorded with who');
  PERFORM pg_temp.is((SELECT a.role FROM pg_temp.acts(pg_temp.id('acme'), 'invitation_withdrawn') a WHERE a.actor_id = pg_temp.id('acme_owner')), (SELECT i.role FROM public.firm_invitations i WHERE i.id = inv), 'and the role that was withdrawn');
  PERFORM pg_temp.as_user('dual');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.accept_invitation(%L, %L)', pg_temp.hash_of('dual-token'), 'acme-brokers')), 'PT410: This invitation was withdrawn', 'a withdrawn link says so and opens nothing');
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
DECLARE acme uuid := pg_temp.id('acme'); inv uuid; canc uuid; r record; who text; before_sent bigint;
BEGIN
  SELECT count(*) INTO before_sent FROM pg_temp.acts(acme, 'invitation_sent');
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
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.acts(acme, 'invitation_sent') a WHERE a.actor_id = pg_temp.id('acme_owner')) > before_sent, true, 'the resend is recorded with who, as another invitation sent');
  PERFORM pg_temp.is((SELECT a.role FROM pg_temp.acts(acme, 'invitation_sent') a ORDER BY a.id DESC LIMIT 1), (SELECT i.role FROM public.firm_invitations i WHERE i.id = inv), 'with the role of the invitation');
  PERFORM pg_temp.new_user('no-account-yet');
  PERFORM pg_temp.as_user('no-account-yet');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.accept_invitation(%L, %L)', pg_temp.hash_of('expiring-two'), 'acme-brokers')), 'PT404: This invitation link is not valid', 'the old link no longer works');
  SELECT * INTO r FROM public.accept_invitation(pg_temp.hash_of('resent-token'), 'acme-brokers');
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
-- like into the error); a failure is not shown to the owner; a successful send keeps the earlier error; a long error is kept;
-- a result that is not sent, failed or unknown is kept; an outcome of "unknown" (the mail provider may have accepted it) is
-- shown as a plain failure or as a success; or a result is recorded against a link that is no longer the current one: two
-- overlapping resends finishing out of order mark the current link delivered when its email failed, or the reverse.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); inv uuid; who text; h text := pg_temp.hash_of('raw-secret-token'); h2 text := pg_temp.hash_of('second-generation');
  p record;
BEGIN
  RESET ROLE;
  SELECT id INTO inv FROM public.firm_invitations WHERE email = 'tokenless@example.test';
  FOREACH who IN ARRAY ARRAY['acme_owner', 'zenith_owner', 'nobody'] LOOP
    PERFORM pg_temp.as_user(who);
    PERFORM pg_temp.is(has_function_privilege('authenticated', 'public.record_invitation_delivery(uuid, text, text, text)', 'EXECUTE'), false, 'signed-in people hold no right to record a delivery');
    PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.record_invitation_delivery(%L, %L, %L, NULL)', inv, h, 'sent')), '42501', who || ' may not record a delivery');
  END LOOP;
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.record_invitation_delivery(%L, %L, %L, NULL)', inv, h, 'sent')), '42501', 'nor may a signed-out caller');
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', false);
  SET LOCAL ROLE service_role;
  PERFORM public.record_invitation_delivery(inv, h, 'failed', 'provider_error');
  PERFORM pg_temp.as_user('acme_owner');
  SELECT * INTO p FROM public.firm_pending_invitations(acme) x WHERE x.invitation_id = inv;
  PERFORM pg_temp.is(p.email_error, 'provider_error', 'a failed send shows the owner a short kind');
  PERFORM pg_temp.is(p.email_sent_at IS NULL, true, 'and no time sent');
  PERFORM pg_temp.is(p.email_outcome, 'failed', 'and that it failed');
  RESET ROLE;
  SET LOCAL ROLE service_role;
  PERFORM public.record_invitation_delivery(inv, h, 'sent', 'ignored');
  PERFORM pg_temp.as_user('acme_owner');
  SELECT * INTO p FROM public.firm_pending_invitations(acme) x WHERE x.invitation_id = inv;
  PERFORM pg_temp.is(p.email_sent_at IS NOT NULL AND p.email_error IS NULL AND p.email_outcome = 'sent', true, 'a good send shows the time and clears the error');
  RESET ROLE;
  SET LOCAL ROLE service_role;
  PERFORM public.record_invitation_delivery(inv, h, 'failed', repeat('x', 200));
  RESET ROLE;
  PERFORM pg_temp.is((SELECT char_length(email_error) FROM public.firm_invitations WHERE id = inv), 40, 'an error longer than a short kind is cut');
  PERFORM pg_temp.is((SELECT email_sent_at IS NULL FROM public.firm_invitations WHERE id = inv), true, 'and a failure after a send takes the time back: the email is not known to have gone');
  SET LOCAL ROLE service_role;
  PERFORM public.record_invitation_delivery(inv, h, 'unknown', 'timeout');
  PERFORM pg_temp.as_user('acme_owner');
  SELECT * INTO p FROM public.firm_pending_invitations(acme) x WHERE x.invitation_id = inv;
  PERFORM pg_temp.is(p.email_outcome, 'unknown', 'a send the provider may have accepted is shown as unknown, not as failed or sent');
  PERFORM pg_temp.is(p.email_sent_at IS NULL, true, 'with no time sent');
  PERFORM pg_temp.is(p.email_error, 'timeout', 'and the kind of trouble');
  RESET ROLE;
  SET LOCAL ROLE service_role;
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.record_invitation_delivery(%L, %L, %L, NULL)', inv, h, 'delivered')), '23514', 'any other outcome is refused');
  -- Generations: a resend makes a new link; the result of the earlier send is then not the current link's.
  RESET ROLE;
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.resend_invitation(inv, h2);
  RESET ROLE;
  PERFORM pg_temp.is((SELECT email_outcome IS NULL AND email_sent_at IS NULL AND email_error IS NULL FROM public.firm_invitations WHERE id = inv), true, 'a resend starts with nothing recorded');
  SET LOCAL ROLE service_role;
  PERFORM pg_temp.is(public.record_invitation_delivery(inv, h, 'sent', NULL), false, 'a result for the replaced link is not recorded');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT email_outcome IS NULL FROM public.firm_invitations WHERE id = inv), true, 'so a late success of the old link does not mark the new one delivered');
  SET LOCAL ROLE service_role;
  PERFORM pg_temp.is(public.record_invitation_delivery(inv, h2, 'failed', 'network'), true, 'the current link''s result is recorded');
  PERFORM pg_temp.is(public.record_invitation_delivery(inv, h, 'sent', NULL), false, 'and a late success of the old link no longer hides it');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT email_outcome FROM public.firm_invitations WHERE id = inv), 'failed', 'the new link stays failed');
  SET LOCAL ROLE service_role;
  PERFORM public.record_invitation_delivery(inv, h2, 'sent', NULL);
  PERFORM pg_temp.is(public.record_invitation_delivery(inv, h, 'failed', 'network'), false, 'a late failure of the old link does not undo the new one''s success');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT email_outcome FROM public.firm_invitations WHERE id = inv), 'sent', 'it stays sent');
  -- A withdrawn invitation takes no result: its link opens nothing, and nothing about its email is news to anyone.
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.cancel_invitation(inv);
  RESET ROLE;
  SET LOCAL ROLE service_role;
  PERFORM pg_temp.is(public.record_invitation_delivery(inv, h2, 'failed', 'network'), false, 'a result for a withdrawn invitation is not recorded');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT email_outcome FROM public.firm_invitations WHERE id = inv), 'sent', 'and changes nothing');
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
  SELECT * INTO r FROM public.accept_invitation(pg_temp.hash_of('pw-token'), 'acme-brokers');
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

-- ---------- accepted only at the firm's own address (D-34) ----------
-- Break caught: the token alone authorises the acceptance, so an Acme link opened at Zenith's address (or at an address no
-- firm holds, or with no address) joins Acme and confirms the wrong firm; or the refusal still joins, or spends the link; or
-- a used link opened at the wrong address says anything about its state; or the right address in other capitals is refused.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); r record; wrong text;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.new_user('addr_person');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.invite_member(acme, 'addr_person@example.test', 'agent', NULL, pg_temp.hash_of('addr-token'));
  PERFORM pg_temp.as_user('addr_person');
  FOREACH wrong IN ARRAY ARRAY['zenith-benefits', 'no-such-firm', ''] LOOP
    PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.accept_invitation(%L, %L)', pg_temp.hash_of('addr-token'), wrong)),
      'PT422: This invitation belongs to another firm''s address', 'the link opened at ''' || wrong || ''' is refused with its own message');
  END LOOP;
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.accept_invitation(%L, NULL)', pg_temp.hash_of('addr-token'))), 'PT422', 'and so is a call with no address');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_memberships WHERE user_id = pg_temp.id('addr_person')), 0::bigint, 'none of them joined any firm');
  PERFORM pg_temp.is((SELECT status FROM public.firm_invitations WHERE token_hash = pg_temp.hash_of('addr-token')), 'pending', 'and none spent the link');
  PERFORM pg_temp.as_user('addr_person');
  SELECT * INTO r FROM public.accept_invitation(pg_temp.hash_of('addr-token'), '  Acme-Brokers ');
  PERFORM pg_temp.is(r.firm_address, 'acme-brokers', 'at the firm''s own address (capitals and spaces aside) it joins');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.accept_invitation(%L, %L)', pg_temp.hash_of('addr-token'), 'zenith-benefits')), 'PT422',
    'a used link opened at the wrong address still says only that it is not for that address');
  RESET ROLE;
  RAISE NOTICE 'firm_invitations: only at the firm''s address cases passed';
END $$;

-- ---------- what the firm's approval decision lets it do (D-34) ----------
-- Break caught: a firm waiting for approval cannot invite or be joined (its people must work before approval, D-27); or it can
-- hold more than five pending invitations, so an unapproved sign-up sends Nevermore's mail in bulk; or the cap counts used or
-- withdrawn invitations, or other firms' ones, or still binds once the firm is approved; or a refused firm can invite or
-- resend, or a pending invitation to a refused firm can be accepted (D-31); or a refused firm's owner is stopped from
-- withdrawing an invitation.
DO $$
DECLARE wf uuid; rf uuid; n integer; inv uuid; r record;
BEGIN
  RESET ROLE;
  INSERT INTO public.firms (name, address) VALUES ('Waiting Firm', 'waiting-firm') RETURNING id INTO wf;
  INSERT INTO public.firms (name, address, decision, decided_at) VALUES ('Refused Firm', 'refused-firm', 'refused', now()) RETURNING id INTO rf;
  INSERT INTO fx VALUES ('waiting', wf), ('refused', rf);
  PERFORM pg_temp.new_user('waiting_owner'); PERFORM pg_temp.new_user('refused_owner'); 
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (wf, pg_temp.id('waiting_owner'), 'owner'), (rf, pg_temp.id('refused_owner'), 'owner');

  PERFORM pg_temp.as_user('waiting_owner');
  FOR n IN 1..5 LOOP
    PERFORM public.invite_member(wf, 'wait' || n || '@example.test', 'agent', NULL, pg_temp.hash_of('wait-' || n));
  END LOOP;
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.invite_member(%L, 'wait6@example.test', 'agent', NULL, %L)$q$, wf, pg_temp.hash_of('wait-6'))),
    'PT409: A firm waiting for approval can hold at most five pending invitations', 'a firm waiting for approval cannot hold a sixth pending invitation');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_invitations WHERE firm_id = wf), 5::bigint, 'and the refused one left nothing');

  -- It still resends the ones it holds, withdraws one, and then has room for one more.
  RESET ROLE;
  SELECT id INTO inv FROM public.firm_invitations WHERE token_hash = pg_temp.hash_of('wait-1');
  PERFORM pg_temp.as_user('waiting_owner');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT * FROM public.resend_invitation(%L, %L)', inv, pg_temp.hash_of('wait-1b'))), 'rows:1', 'a waiting firm resends an invitation it holds');
  PERFORM public.cancel_invitation(inv);
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.invite_member(%L, 'wait6@example.test', 'agent', NULL, %L)$q$, wf, pg_temp.hash_of('wait-6'))), 'rows:1',
    'a withdrawn invitation no longer counts towards the five');
  -- Its invitations can be accepted, so its people can join before approval.
  RESET ROLE;
  PERFORM pg_temp.new_user('wait2');
  PERFORM pg_temp.as_user('wait2');
  SELECT * INTO r FROM public.accept_invitation(pg_temp.hash_of('wait-2'), 'waiting-firm');
  PERFORM pg_temp.is(r.role, 'agent', 'a person invited to a firm waiting for approval can join it');
  RESET ROLE;
  -- The other firms' pending invitations do not count against it, and its own do not count against theirs.
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.invite_member(%L, 'cap-free@example.test', 'agent', NULL, %L)$q$, pg_temp.id('acme'), pg_temp.hash_of('cap-free'))), 'rows:1', 'an approved firm has no cap');
  RESET ROLE;
  -- Once approved, the cap is gone.
  UPDATE public.firms SET approved_at = now(), decision = 'approved', decided_at = now() WHERE id = wf;
  PERFORM pg_temp.as_user('waiting_owner');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.invite_member(%L, 'after-approval@example.test', 'agent', NULL, %L)$q$, wf, pg_temp.hash_of('after-approval'))), 'rows:1', 'once approved the firm can hold more');
  RESET ROLE;
  UPDATE public.firms SET approved_at = NULL, decision = NULL, decided_at = NULL WHERE id = wf;
  RAISE NOTICE 'firm_invitations: waiting firm cap cases passed';
END $$;

-- ---------- a waiting firm is limited by what is pending, not by what it has sent (D-34) ----------
-- Break caught: a count of emails sent, withdrawn invitations included, refuses a waiting firm for good although nothing is
-- pending; D-34 limits only the invitations held pending at once (five), and approval lifts it.
DO $$
DECLARE sf uuid; n integer; inv uuid;
BEGIN
  RESET ROLE;
  INSERT INTO public.firms (name, address) VALUES ('Spam Firm', 'spam-firm') RETURNING id INTO sf;
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (sf, pg_temp.new_user('spam_owner'), 'owner');
  PERFORM pg_temp.as_user('spam_owner');
  FOR n IN 1..10 LOOP
    SELECT r.invitation_id INTO inv FROM public.invite_member(sf, 'spam' || n || '@example.test', 'agent', NULL, pg_temp.hash_of('spam-' || n)) r;
    PERFORM public.cancel_invitation(inv);
  END LOOP;
  SELECT r.invitation_id INTO inv FROM public.invite_member(sf, 'spam11@example.test', 'agent', NULL, pg_temp.hash_of('spam-11')) r;
  PERFORM pg_temp.is(inv IS NOT NULL, true, 'a waiting firm with nothing pending can invite again, however many it has invited and withdrawn before');
  FOR n IN 1..3 LOOP
    PERFORM pg_temp.is(pg_temp.attempt(format('SELECT * FROM public.resend_invitation(%L, %L)', inv, pg_temp.hash_of('spam-11-' || n))), 'rows:1', 'and resend, which is not a new pending invitation');
  END LOOP;
  RESET ROLE;
  RAISE NOTICE 'firm_invitations: waiting firm pending-only limit cases passed';
END $$;

-- ---------- a waiting firm sends at most twenty invitation emails in any twenty-four hours (D-36) ----------
-- Break caught: no rate limit (a waiting firm sends in bulk by resending); a limit counted from the firm's first email, or for
-- life, instead of a rolling twenty-four hours; one that counts only first sends or only resends; a refusal that does not say when
-- the firm can send again; a limit that still binds once the firm is approved; or one that stops a firm whose invitations were
-- accepted from inviting again.
DO $$
DECLARE rf uuid; n integer; inv uuid; invs uuid[] := '{}'; msg text; first_at timestamptz;
  head text := 'PT409: A firm waiting for approval can send at most twenty invitation emails in 24 hours. It can send again at ';
BEGIN
  RESET ROLE;
  INSERT INTO public.firms (name, address) VALUES ('Rate Firm', 'rate-firm') RETURNING id INTO rf;
  INSERT INTO fx VALUES ('rate_firm', rf);
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (rf, pg_temp.new_user('rate_owner'), 'owner');
  PERFORM pg_temp.as_user('rate_owner');
  FOR n IN 1..5 LOOP
    SELECT r.invitation_id INTO inv FROM public.invite_member(rf, 'rate' || n || '@example.test', 'agent', NULL, pg_temp.hash_of('rate-' || n)) r;
    invs := invs || inv;
  END LOOP;
  FOR n IN 1..15 LOOP
    PERFORM public.resend_invitation(invs[1 + n % 5], pg_temp.hash_of('rate-r' || n));
  END LOOP;
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.acts(rf, 'invitation_sent')), 20::bigint, 'twenty emails, first sends and resends together, are in the record');
  SELECT min(a.at) INTO first_at FROM pg_temp.acts(rf, 'invitation_sent') a;
  PERFORM pg_temp.as_user('rate_owner');
  msg := pg_temp.refusal(format('SELECT * FROM public.resend_invitation(%L, %L)', invs[1], pg_temp.hash_of('rate-r21')));
  PERFORM pg_temp.is(left(msg, length(head)), head, 'the twenty-first email is refused, saying when it can send again');
  PERFORM public.cancel_invitation(invs[2]);
  PERFORM pg_temp.is(left(pg_temp.refusal(format($q$SELECT public.invite_member(%L, 'rate6@example.test', 'agent', NULL, %L)$q$, rf, pg_temp.hash_of('rate-6'))), 40),
    left(head, 40), 'a first send is refused as well');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT send_count FROM public.firm_invitations WHERE id = invs[1]), 4, 'a refused resend changed nothing');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_invitations WHERE firm_id = rf), 5::bigint, 'and a refused invitation left nothing');
  -- The oldest email is first twenty-three and a half hours old, still inside the window, then just over twenty-four hours old
  -- (the record is append-only: the test lifts the guard to age it).
  ALTER TABLE public.firm_activity DISABLE TRIGGER firm_activity_append_only;
  UPDATE public.firm_activity SET at = at - interval '23 hours 30 minutes'
  WHERE entry_key = (SELECT a.entry_key FROM pg_temp.acts(rf, 'invitation_sent') a ORDER BY a.at, a.entry_key LIMIT 1);
  PERFORM pg_temp.as_user('rate_owner');
  PERFORM pg_temp.is(left(pg_temp.refusal(format('SELECT * FROM public.resend_invitation(%L, %L)', invs[1], pg_temp.hash_of('rate-r21b'))), 40),
    left(head, 40), 'an email 23 and a half hours after the first is still refused');
  RESET ROLE;
  UPDATE public.firm_activity SET at = at - interval '31 minutes'
  WHERE entry_key = (SELECT a.entry_key FROM pg_temp.acts(rf, 'invitation_sent') a ORDER BY a.at, a.entry_key LIMIT 1);
  ALTER TABLE public.firm_activity ENABLE TRIGGER firm_activity_append_only;
  PERFORM pg_temp.as_user('rate_owner');
  PERFORM public.invite_member(rf, 'rate6@example.test', 'agent', NULL, pg_temp.hash_of('rate-6'));
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_invitations WHERE firm_id = rf AND email = 'rate6@example.test'), 1::bigint,
    'an email just over 24 hours after the first is allowed');
  PERFORM pg_temp.as_user('rate_owner');
  PERFORM pg_temp.is(left(pg_temp.refusal(format('SELECT * FROM public.resend_invitation(%L, %L)', invs[1], pg_temp.hash_of('rate-r22'))), 40),
    left(head, 40), 'and the window rolls on: twenty in the last 24 hours refuse the next');
  RESET ROLE;
  -- Approval is the time it was approved, with or without a recorded decision (a firm approved before decisions were kept has none).
  UPDATE public.firms SET approved_at = now() WHERE id = rf;
  PERFORM pg_temp.as_user('rate_owner');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT * FROM public.resend_invitation(%L, %L)', invs[1], pg_temp.hash_of('rate-r22'))), 'rows:1', 'an approved firm is not limited: it resends');
  RESET ROLE;
  UPDATE public.firms SET decision = 'approved', decided_at = now() WHERE id = rf;
  PERFORM pg_temp.as_user('rate_owner');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.invite_member(%L, 'rate7@example.test', 'agent', NULL, %L)$q$, rf, pg_temp.hash_of('rate-7'))), 'rows:1', 'and invites');
  RESET ROLE;
  -- A waiting firm whose five invitations were accepted can invite again.
  INSERT INTO public.firms (name, address) VALUES ('Accepted Firm', 'accepted-firm') RETURNING id INTO rf;
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (rf, pg_temp.new_user('acc_owner'), 'owner');
  PERFORM pg_temp.as_user('acc_owner');
  FOR n IN 1..5 LOOP
    PERFORM public.invite_member(rf, 'acc' || n || '@example.test', 'agent', NULL, pg_temp.hash_of('acc-' || n));
  END LOOP;
  RESET ROLE;
  UPDATE public.firm_invitations SET status = 'accepted', accepted_at = now() WHERE firm_id = rf;
  PERFORM pg_temp.as_user('acc_owner');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.invite_member(%L, 'acc6@example.test', 'agent', NULL, %L)$q$, rf, pg_temp.hash_of('acc-6'))), 'rows:1',
    'a waiting firm whose five invitations were accepted can invite again');
  RESET ROLE;
  RAISE NOTICE 'firm_invitations: waiting firm rate limit cases passed';
END $$;

-- ---------- the time the refusal advertises is one the firm can really send at ----------
-- Break caught: a time shown to the minute that is earlier than the moment sending is allowed (an oldest email at 09:30:45 turned
-- away "until 09:30" while sending stays refused until 09:30:45); one that is later than the next minute boundary, or that moves
-- a time that is already on a whole minute.
DO $$
DECLARE rf uuid; n integer; inv uuid; invs uuid[] := '{}'; msg text; oldest timestamptz; shown timestamptz; allowed timestamptz;
  head text := 'PT409: A firm waiting for approval can send at most twenty invitation emails in 24 hours. It can send again at ';
BEGIN
  RESET ROLE;
  INSERT INTO public.firms (name, address) VALUES ('Round Firm', 'round-firm') RETURNING id INTO rf;
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (rf, pg_temp.new_user('round_owner'), 'owner');
  PERFORM pg_temp.as_user('round_owner');
  FOR n IN 1..5 LOOP
    SELECT r.invitation_id INTO inv FROM public.invite_member(rf, 'round' || n || '@example.test', 'agent', NULL, pg_temp.hash_of('round-' || n)) r;
    invs := invs || inv;
  END LOOP;
  FOR n IN 1..15 LOOP
    PERFORM public.resend_invitation(invs[1 + n % 5], pg_temp.hash_of('round-r' || n));
  END LOOP;
  RESET ROLE;
  -- The oldest email was sent at a time with seconds in it (the record is append-only: the test lifts the guard to age it).
  ALTER TABLE public.firm_activity DISABLE TRIGGER firm_activity_append_only;
  UPDATE public.firm_activity SET at = date_trunc('minute', now()) - interval '23 hours 40 minutes' + interval '45 seconds'
  WHERE entry_key = (SELECT a.entry_key FROM pg_temp.acts(rf, 'invitation_sent') a ORDER BY a.at, a.entry_key LIMIT 1);
  ALTER TABLE public.firm_activity ENABLE TRIGGER firm_activity_append_only;
  SELECT min(a.at) INTO oldest FROM pg_temp.acts(rf, 'invitation_sent') a;
  allowed := oldest + interval '24 hours';
  PERFORM pg_temp.as_user('round_owner');
  msg := pg_temp.refusal(format('SELECT * FROM public.resend_invitation(%L, %L)', invs[1], pg_temp.hash_of('round-r21')));
  RESET ROLE;
  PERFORM pg_temp.is(left(msg, length(head)), head, 'the twenty-first email is refused');
  shown := (substr(msg, length(head) + 1, 16) || ' UTC')::timestamptz;
  PERFORM pg_temp.is(shown >= allowed, true, 'the time advertised is not before sending is allowed');
  PERFORM pg_temp.is(shown - allowed < interval '1 minute', true, 'and is the next whole minute, not later');
  -- At exactly the advertised time the send goes through: move every email back by the wait, which is the same as waiting.
  ALTER TABLE public.firm_activity DISABLE TRIGGER firm_activity_append_only;
  UPDATE public.firm_activity SET at = at - (shown - now()) WHERE firm_id = rf AND kind = 'invitation_sent';
  ALTER TABLE public.firm_activity ENABLE TRIGGER firm_activity_append_only;
  PERFORM pg_temp.as_user('round_owner');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT * FROM public.resend_invitation(%L, %L)', invs[1], pg_temp.hash_of('round-r21'))), 'rows:1',
    'a send at exactly the advertised time succeeds');
  RESET ROLE;
  -- A time already on a whole minute is shown as it is.
  ALTER TABLE public.firm_activity DISABLE TRIGGER firm_activity_append_only;
  UPDATE public.firm_activity SET at = date_trunc('minute', now()) - interval '23 hours 40 minutes'
  WHERE firm_id = rf AND kind = 'invitation_sent';
  UPDATE public.firm_activity SET at = date_trunc('minute', now()) - interval '10 minutes' WHERE firm_id = rf AND kind = 'invitation_sent'
    AND entry_key NOT IN (SELECT a.entry_key FROM pg_temp.acts(rf, 'invitation_sent') a ORDER BY a.at, a.entry_key LIMIT 1);
  ALTER TABLE public.firm_activity ENABLE TRIGGER firm_activity_append_only;
  SELECT min(a.at) INTO oldest FROM pg_temp.acts(rf, 'invitation_sent') a;
  PERFORM pg_temp.as_user('round_owner');
  msg := pg_temp.refusal(format('SELECT * FROM public.resend_invitation(%L, %L)', invs[1], pg_temp.hash_of('round-r22')));
  RESET ROLE;
  PERFORM pg_temp.is(substr(msg, length(head) + 1), to_char((oldest + interval '24 hours') AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI "UTC"'),
    'a time on a whole minute is not moved');
  RAISE NOTICE 'firm_invitations: advertised time cases passed';
END $$;

-- ---------- a database that ran the activity migration before the invitations story edited it ----------
-- Break caught: the migration that fixes invitations only works on a database whose kinds check already lists 'invitation_withdrawn'
-- (one that ran the edited activity migration); on one that ran the original it leaves the check as it was, and withdrawing an
-- invitation fails. The check is put back as the original migration built it, then this story's migration is run again.
DO $$
DECLARE rf uuid; inv uuid;
BEGIN
  RESET ROLE;
  INSERT INTO public.firms (name, address) VALUES ('Old Check Firm', 'old-check-firm') RETURNING id INTO rf;
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (rf, pg_temp.new_user('old_owner'), 'owner');
  PERFORM pg_temp.as_user('old_owner');
  SELECT r.invitation_id INTO inv FROM public.invite_member(rf, 'old1@example.test', 'agent', NULL, pg_temp.hash_of('old-1')) r;
  RESET ROLE;
  INSERT INTO fx VALUES ('old_inv', inv);
  ALTER TABLE public.firm_activity DROP CONSTRAINT firm_activity_kind_check;
  ALTER TABLE public.firm_activity ADD CONSTRAINT firm_activity_kind_check CHECK (kind IN (
    'sign_in', 'submission_viewed', 'document_downloaded', 'packet_downloaded', 'send_recorded',
    'member_added', 'member_ended', 'owner_added', 'owner_ended',
    'export_made', 'invitation_sent', 'member_removed', 'support_access',
    'firm_signed_up', 'firm_approved', 'firm_refused'
  )) NOT VALID;
  PERFORM pg_temp.as_user('old_owner');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.cancel_invitation(%L)', inv)) LIKE 'rows:%', false,
    'on the original check, withdrawing an invitation fails (the starting state is the old one)');
  RESET ROLE;
END $$;

\i supabase/migrations/20261116190500_invitation_fixes.sql

DO $$
DECLARE inv uuid := pg_temp.id('old_inv');
BEGIN
  PERFORM pg_temp.as_user('old_owner');
  PERFORM public.cancel_invitation(inv);
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.acts((SELECT firm_id FROM public.firm_invitations WHERE id = inv), 'invitation_withdrawn')), 1::bigint,
    'after this migration, withdrawing an invitation works on a database that ran the original activity migration, and is in the firm''s record');
  RAISE NOTICE 'firm_invitations: old activity check cases passed';
END $$;

DO $$
DECLARE rf uuid := pg_temp.id('refused'); inv uuid;
BEGIN
  RESET ROLE;
  -- An invitation the firm made while it was waiting, before it was refused.
  INSERT INTO public.firm_invitations (firm_id, email, role, token_hash, expires_at)
  VALUES (rf, 'refused_hire@example.test', 'agent', pg_temp.hash_of('refused-token'), now() + interval '7 days') RETURNING id INTO inv;
  PERFORM pg_temp.new_user('refused_hire');
  PERFORM pg_temp.as_user('refused_owner');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.invite_member(%L, 'new@example.test', 'agent', NULL, %L)$q$, rf, pg_temp.hash_of('refused-new'))),
    'PT403: This firm can''t invite people', 'a refused firm cannot invite');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT * FROM public.resend_invitation(%L, %L)', inv, pg_temp.hash_of('refused-resend'))),
    'PT403: This firm can''t invite people', 'or resend');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.cancel_invitation(%L)', inv)), 'rows:1', 'but its owner can still withdraw what is pending');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT token_hash FROM public.firm_invitations WHERE id = inv), pg_temp.hash_of('refused-token'), 'a refused resend changed nothing');
  PERFORM pg_temp.as_user('refused_hire');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.accept_invitation(%L, %L)', pg_temp.hash_of('refused-token'), 'refused-firm')),
    'PT404: This invitation link is not valid', 'a pending invitation to a refused firm cannot be accepted, and the link reads as no link');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_memberships WHERE user_id = pg_temp.id('refused_hire')), 0::bigint, 'and joins nothing');
  RAISE NOTICE 'firm_invitations: refused firm cases passed';
END $$;

-- ---------- two owners of a waiting firm invite at the same moment (D-32) ----------
-- The cap of five cannot be a constraint, so inviting takes the firm's row lock before it counts. Each transaction alone sees
-- four pending invitations, so without the lock both would pass and the firm would hold six. Two real connections (dblink) race:
-- the first makes the fifth invitation and holds its transaction open until the second, making the sixth, is seen waiting on
-- it; once the first commits the second must count five and be refused.
CREATE SCHEMA race;
CREATE EXTENSION dblink SCHEMA race;
DO $$
DECLARE f uuid; n integer;
BEGIN
  INSERT INTO public.firms (name, address) VALUES ('Race Firm', 'race-firm') RETURNING id INTO f;
  INSERT INTO fx VALUES ('race_firm', f);
  INSERT INTO public.firm_memberships (firm_id, user_id, role)
  VALUES (f, pg_temp.new_user('race_owner_1'), 'owner'), (f, pg_temp.new_user('race_owner_2'), 'owner');
  PERFORM pg_temp.as_user('race_owner_1');
  FOR n IN 1..4 LOOP
    PERFORM public.invite_member(f, 'race' || n || '@example.test', 'agent', NULL, pg_temp.hash_of('race-' || n));
  END LOOP;
  RESET ROLE;
END $$;

DO $$
DECLARE
  f uuid := pg_temp.id('race_firm');
  dsn text := format('dbname=%s user=%s port=%s host=%s', current_database(), session_user, current_setting('port'),
    split_part(current_setting('unix_socket_directories'), ',', 1));
  as_owner text := format($q$SELECT set_config('request.jwt.claims', %L, true)$q$,
    jsonb_build_object('sub', pg_temp.id('race_owner_2'), 'role', 'authenticated', 'is_anonymous', false, 'email', 'race_owner_2@example.test')::text);
  as_first text := format($q$SELECT set_config('request.jwt.claims', %L, true)$q$,
    jsonb_build_object('sub', pg_temp.id('race_owner_1'), 'role', 'authenticated', 'is_anonymous', false, 'email', 'race_owner_1@example.test')::text);
  second_pid integer;
  tries integer := 0;
  s text;
  pending bigint;
BEGIN
  PERFORM race.dblink_connect('race_first', dsn);
  PERFORM race.dblink_connect('race_second', dsn);
  PERFORM race.dblink_exec('race_second', 'SET lock_timeout = ''20s''');
  SELECT pid INTO second_pid FROM race.dblink('race_second', 'SELECT pg_backend_pid()') AS t(pid integer);
  PERFORM race.dblink_exec('race_first', 'BEGIN');
  PERFORM race.dblink_exec('race_first', 'SET LOCAL ROLE authenticated');
  PERFORM * FROM race.dblink('race_first', as_first) AS t(c text);
  PERFORM * FROM race.dblink('race_first', format($q$SELECT public.invite_member(%L, 'race5@example.test', 'agent', NULL, %L)::text$q$, f, pg_temp.hash_of('race-5'))) AS t(r text);
  PERFORM race.dblink_exec('race_second', 'BEGIN');
  PERFORM race.dblink_exec('race_second', 'SET LOCAL ROLE authenticated');
  PERFORM * FROM race.dblink('race_second', as_owner) AS t(c text);
  PERFORM race.dblink_send_query('race_second', format($q$SELECT public.invite_member(%L, 'race6@example.test', 'agent', NULL, %L)::text$q$, f, pg_temp.hash_of('race-6')));
  WHILE cardinality(pg_blocking_pids(second_pid)) = 0 LOOP
    tries := tries + 1;
    IF tries > 400 THEN RAISE EXCEPTION 'FAIL: the second invitation never waited for the first'; END IF;
    PERFORM pg_sleep(0.05);
  END LOOP;
  PERFORM race.dblink_exec('race_first', 'COMMIT');
  BEGIN
    PERFORM * FROM race.dblink_get_result('race_second') AS t(r text);
    RAISE EXCEPTION 'FAIL: the sixth pending invitation was made too';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE;
    IF s <> 'PT409' THEN RAISE EXCEPTION 'FAIL: the second invitation gave %, expected PT409', s; END IF;
  END;
  PERFORM race.dblink_disconnect('race_first');
  BEGIN
    PERFORM race.dblink_exec('race_second', 'ROLLBACK');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  PERFORM race.dblink_disconnect('race_second');
  SELECT count(*) INTO pending FROM public.firm_invitations WHERE firm_id = f AND status = 'pending';
  PERFORM pg_temp.is(pending, 5::bigint, 'pending invitations of the waiting firm after two were made at once');
  RAISE NOTICE 'firm_invitations: two-session cap race passed';
END $$;

-- ---------- two owners of a waiting firm send at the same moment (D-32, D-36) ----------
-- The twenty emails a day of a waiting firm are counted under the firm's row lock, as the five pending invitations are. The firm has
-- sent nineteen emails (four invitations, one resent fifteen times); without the lock two sends at once would each see nineteen
-- and make twenty-one.
DO $$
DECLARE f uuid; a uuid; b uuid; n integer;
BEGIN
  INSERT INTO public.firms (name, address) VALUES ('Resend Race Firm', 'resend-race-firm') RETURNING id INTO f;
  INSERT INTO fx VALUES ('resend_race_firm', f);
  INSERT INTO public.firm_memberships (firm_id, user_id, role)
  VALUES (f, pg_temp.new_user('rr_owner_1'), 'owner'), (f, pg_temp.new_user('rr_owner_2'), 'owner');
  PERFORM pg_temp.as_user('rr_owner_1');
  SELECT r.invitation_id INTO a FROM public.invite_member(f, 'rr-a@example.test', 'agent', NULL, pg_temp.hash_of('rr-a-0')) r;
  SELECT r.invitation_id INTO b FROM public.invite_member(f, 'rr-b@example.test', 'agent', NULL, pg_temp.hash_of('rr-b-0')) r;
  PERFORM public.invite_member(f, 'rr-c@example.test', 'agent', NULL, pg_temp.hash_of('rr-c-0'));
  PERFORM public.invite_member(f, 'rr-d@example.test', 'agent', NULL, pg_temp.hash_of('rr-d-0'));
  FOR n IN 1..15 LOOP
    PERFORM public.resend_invitation(a, pg_temp.hash_of('rr-a-' || n));
  END LOOP;
  RESET ROLE;
  INSERT INTO fx VALUES ('rr_a', a), ('rr_b', b);
END $$;

DO $$
DECLARE
  f uuid := pg_temp.id('resend_race_firm');
  dsn text := format('dbname=%s user=%s port=%s host=%s', current_database(), session_user, current_setting('port'),
    split_part(current_setting('unix_socket_directories'), ',', 1));
  as_second text := format($q$SELECT set_config('request.jwt.claims', %L, true)$q$,
    jsonb_build_object('sub', pg_temp.id('rr_owner_2'), 'role', 'authenticated', 'is_anonymous', false, 'email', 'rr_owner_2@example.test')::text);
  as_first text := format($q$SELECT set_config('request.jwt.claims', %L, true)$q$,
    jsonb_build_object('sub', pg_temp.id('rr_owner_1'), 'role', 'authenticated', 'is_anonymous', false, 'email', 'rr_owner_1@example.test')::text);
  second_pid integer;
  tries integer := 0;
  s text;
BEGIN
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.acts(f, 'invitation_sent')), 19::bigint, 'emails of the waiting firm before the race');
  PERFORM race.dblink_connect('rr_first', dsn);
  PERFORM race.dblink_connect('rr_second', dsn);
  PERFORM race.dblink_exec('rr_second', 'SET lock_timeout = ''20s''');
  SELECT pid INTO second_pid FROM race.dblink('rr_second', 'SELECT pg_backend_pid()') AS t(pid integer);
  PERFORM race.dblink_exec('rr_first', 'BEGIN');
  PERFORM race.dblink_exec('rr_first', 'SET LOCAL ROLE authenticated');
  PERFORM * FROM race.dblink('rr_first', as_first) AS t(c text);
  PERFORM * FROM race.dblink('rr_first', format($q$SELECT public.resend_invitation(%L, %L)::text$q$, pg_temp.id('rr_a'), pg_temp.hash_of('rr-a-16'))) AS t(r text);
  PERFORM race.dblink_exec('rr_second', 'BEGIN');
  PERFORM race.dblink_exec('rr_second', 'SET LOCAL ROLE authenticated');
  PERFORM * FROM race.dblink('rr_second', as_second) AS t(c text);
  PERFORM race.dblink_send_query('rr_second', format($q$SELECT public.resend_invitation(%L, %L)::text$q$, pg_temp.id('rr_b'), pg_temp.hash_of('rr-b-1')));
  WHILE cardinality(pg_blocking_pids(second_pid)) = 0 LOOP
    tries := tries + 1;
    IF tries > 400 THEN RAISE EXCEPTION 'FAIL: the second resend never waited for the first'; END IF;
    PERFORM pg_sleep(0.05);
  END LOOP;
  PERFORM race.dblink_exec('rr_first', 'COMMIT');
  BEGIN
    PERFORM * FROM race.dblink_get_result('rr_second') AS t(r text);
    RAISE EXCEPTION 'FAIL: the twenty-first email was allowed too';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE;
    IF s <> 'PT409' THEN RAISE EXCEPTION 'FAIL: the second resend gave %, expected PT409', s; END IF;
  END;
  PERFORM race.dblink_disconnect('rr_first');
  BEGIN
    PERFORM race.dblink_exec('rr_second', 'ROLLBACK');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  PERFORM race.dblink_disconnect('rr_second');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.acts(f, 'invitation_sent')), 20::bigint, 'emails of the waiting firm after two sends were made at once');
  RAISE NOTICE 'firm_invitations: two-session email rate race passed';
END $$;

-- ---------- an address that could never be emailed is not kept ----------
-- Break caught: the table accepts an address the mail sender refuses (quotes, commas, angle brackets, brackets, semicolons,
-- parentheses, a backslash), so a direct caller leaves a pending invitation that can never be sent and that blocks the corrected
-- one for the same firm and email; or the rule that applies is looser than the sender's.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); bad text;
BEGIN
  PERFORM pg_temp.as_user('acme_owner');
  FOREACH bad IN ARRAY ARRAY['a"b@example.test', 'a,b@example.test', 'a<b@example.test', 'a>b@example.test', 'a;b@example.test',
                             'a(b@example.test', 'a)b@example.test', 'a[b@example.test', 'a]b@example.test', E'a\\b@example.test'] LOOP
    PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.invite_member(%L, %L, 'agent', NULL, %L)$q$, acme, bad, pg_temp.hash_of('bad-' || bad))), '23514',
      'the address ' || bad || ' is refused');
  END LOOP;
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.invite_member(%L, 'fine.name+tag@example.test', 'agent', NULL, %L)$q$, acme, pg_temp.hash_of('good-addr'))), 'rows:1', 'an ordinary address with a plus sign is fine');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.firm_invitations (firm_id, email, role, token_hash, expires_at) VALUES (%L, 'a"b@example.test', 'agent', %L, now() + interval '1 day')$q$, acme, pg_temp.hash_of('bad-direct'))), '23514',
    'and the table itself refuses one, whoever writes to it');
  RAISE NOTICE 'firm_invitations: mailable address cases passed';
END $$;
