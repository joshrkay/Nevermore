-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh join_by_organisation
-- Join by organisation (story CRM-P1.4; docs/BROKER_CRM_BUILD.md D-18, D-23, D-27, D-29, D-31, D-33, D-34, D-40, D-105;
-- 20261118100000_join_by_organisation.sql). An owner lists the firm's Google domain or Microsoft tenant; a person who signs in at the
-- firm's address from a listed organisation, and is not a member, is listed for the owners as "asked to join"; nobody becomes a member
-- until an owner approves them with a role. The match is on what the provider vouches for, never the email text, and a free-mail
-- domain or a personal-account tenant can't be listed. This replaces the platform admin's list: the old functions are gone. Every
-- migration is loaded, in filename order (D-105), this story's last.
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



-- A sign-in as the provider's token would have recorded it (what the database reads to say what the provider vouches for).
CREATE FUNCTION pg_temp.signin(n text, provider text, data jsonb) RETURNS void LANGUAGE sql AS $$
  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
  VALUES (gen_random_uuid()::text, pg_temp.id(n), data, provider, now(), now());
$$;

-- ---------- set up ----------
-- Two firms in good standing; one waiting for approval (its people work before approval, D-27); one refused (D-31); one suspended.
-- Each has an owner. Acme also has a lead and an agent. A platform admin belongs to no firm. `nobody` has no firm.
DO $$
DECLARE acme uuid; zenith uuid; waiting uuid; refused uuid; suspended uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Acme Brokers', 'acme-brokers', now()) RETURNING id INTO acme;
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Zenith Benefits', 'zenith-benefits', now()) RETURNING id INTO zenith;
  INSERT INTO public.firms (name, address) VALUES ('Waiting Partners', 'waiting-partners') RETURNING id INTO waiting;
  INSERT INTO public.firms (name, address, decision, decided_at) VALUES ('Refused Group', 'refused-group', 'refused', now()) RETURNING id INTO refused;
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Suspended Advisors', 'suspended-advisors', now()) RETURNING id INTO suspended;
  INSERT INTO fx VALUES ('acme', acme), ('zenith', zenith), ('waiting', waiting), ('refused', refused), ('suspended', suspended);
  PERFORM pg_temp.new_user('acme_owner'); PERFORM pg_temp.new_user('acme_lead'); PERFORM pg_temp.new_user('acme_agent');
  PERFORM pg_temp.new_user('zenith_owner'); PERFORM pg_temp.new_user('waiting_owner'); PERFORM pg_temp.new_user('refused_owner');
  PERFORM pg_temp.new_user('suspended_owner'); PERFORM pg_temp.new_user('platform_admin'); PERFORM pg_temp.new_user('nobody');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES
    (acme, pg_temp.id('acme_owner'), 'owner'), (acme, pg_temp.id('acme_lead'), 'lead'), (acme, pg_temp.id('acme_agent'), 'agent'),
    (zenith, pg_temp.id('zenith_owner'), 'owner'), (waiting, pg_temp.id('waiting_owner'), 'owner'),
    (refused, pg_temp.id('refused_owner'), 'owner'), (suspended, pg_temp.id('suspended_owner'), 'owner');
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('platform_admin'), 'admin');
  INSERT INTO public.firm_suspensions (firm_id, reason, suspended_at) VALUES (suspended, 'fixture', now());
END $$;

-- ---------- what a sign-in vouches for (carried over from the retired list's test) ----------
-- Break caught: the match reads the email text, or a Google account whose email isn't verified, or a Microsoft token's issuer from
-- any host, so a tenant's administrator (who can put any address in a token) or a look-alike gets an organisation they don't hold.
DO $$
DECLARE tenant constant text := '0f9f1d5c-3a64-4d6e-9f47-1c2b8f7e5a10';
BEGIN
  PERFORM pg_temp.is(public.identity_organisation('google', '{"email_verified": true, "hd": "Advisory.Example"}'), 'advisory.example', 'google hosted domain');
  PERFORM pg_temp.is(public.identity_organisation('google', '{"email_verified": "true", "hd": "advisory.example"}'), 'advisory.example', 'google hosted domain with a text flag');
  PERFORM pg_temp.is(
    public.identity_organisation('google', '{"email_verified": false, "hd": "advisory.example"}') IS NULL
    AND public.identity_organisation('google', '{"hd": "advisory.example"}') IS NULL
    AND public.identity_organisation('google', '{"email_verified": true, "email": "x@advisory.example"}') IS NULL
    AND public.identity_organisation('google', '{"email_verified": true, "hd": "not a domain"}') IS NULL, true, 'google vouches only for a verified hosted domain');
  PERFORM pg_temp.is(
    public.identity_organisation('microsoft', format('{"tid": "%s"}', upper(tenant))::jsonb) = tenant
    AND public.identity_organisation('microsoft', format('{"custom_claims": {"tid": "%s"}}', tenant)::jsonb) = tenant
    AND public.identity_organisation('microsoft', format('{"iss": "https://login.microsoftonline.com/%s/v2.0"}', tenant)::jsonb) = tenant, true, 'microsoft tenant read');
  PERFORM pg_temp.is(
    public.identity_organisation('microsoft', '{"email": "x@advisory.example", "iss": "https://evil.example/0f9f1d5c-3a64-4d6e-9f47-1c2b8f7e5a10/v2.0"}') IS NULL
    AND public.identity_organisation('microsoft', '{"tid": "advisory.example"}') IS NULL
    AND public.identity_organisation('github', '{"hd": "advisory.example"}') IS NULL, true, 'microsoft and other providers vouch for nothing else');
  RAISE NOTICE 'join_by_organisation: what a sign-in vouches for passed';
END $$;

-- ---------- listing and removing an organisation ----------
-- Break caught: a non-owner (a lead, an agent, another firm's owner, a platform admin, a stranger) lists or removes one; a free-mail
-- domain or a personal-account tenant is listed (everyone with a free account would match); a Microsoft tenant is listed by domain or a
-- Google domain by address; a refused firm lists; the entry in the firm's record is missing.
DO $$
DECLARE
  acme uuid := pg_temp.id('acme');
  zenith uuid := pg_temp.id('zenith');
  tenant constant text := '0f9f1d5c-3a64-4d6e-9f47-1c2b8f7e5a10';
  org_id uuid;
  r text;
BEGIN
  -- Only a current owner of the firm may.
  FOREACH r IN ARRAY ARRAY['acme_lead', 'acme_agent', 'zenith_owner', 'platform_admin', 'nobody'] LOOP
    PERFORM pg_temp.as_user(r);
    PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.add_firm_organisation(%L, ''google'', ''advisory.example'', ''Advisory'')', acme)) LIKE '42501:%', true, r || ' listing an organisation');
    PERFORM pg_temp.is(pg_temp.refusal(format('SELECT * FROM public.firm_organisations(%L)', acme)) LIKE '42501:%', true, r || ' reading the list');
    RESET ROLE;
  END LOOP;
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(pg_temp.refusal('INSERT INTO public.firm_organisations (firm_id, provider, org_id, label) VALUES (''' || acme || ''', ''google'', ''x.example'', ''X'')') LIKE '42501:%', true, 'writing the table directly');
  PERFORM pg_temp.is(pg_temp.refusal('SELECT count(*) FROM public.firm_organisations') LIKE '42501:%', true, 'reading the table directly');
  -- What can never be listed.
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.add_firm_organisation(%L, ''google'', ''gmail.com'', ''Everyone'')', acme)) LIKE '22023:%', true, 'gmail.com');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.add_firm_organisation(%L, ''google'', ''Outlook.COM'', ''Everyone'')', acme)) LIKE '22023:%', true, 'outlook.com in capitals');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.add_firm_organisation(%L, ''microsoft'', ''9188040d-6c67-4c5b-b112-36a304b66dad'', ''Personal'')', acme)) LIKE '22023:%', true, 'Microsoft personal-account tenant');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.add_firm_organisation(%L, ''microsoft'', ''F8CDEF31-A31E-4B4A-93E4-5F571E91255A'', ''Personal'')', acme)) LIKE '22023:%', true, 'the other personal-account tenant');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.add_firm_organisation(%L, ''microsoft'', ''advisory.example'', ''By domain'')', acme)) LIKE '22023:%', true, 'a Microsoft organisation by domain');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.add_firm_organisation(%L, ''google'', ''person@advisory.example'', ''By address'')', acme)) LIKE '22023:%', true, 'a Google organisation by address');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.add_firm_organisation(%L, ''google'', ''advisory'', ''No dot'')', acme)) LIKE '22023:%', true, 'a bare word');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.add_firm_organisation(%L, ''yahoo'', ''advisory.example'', ''Other'')', acme)) LIKE '22023:%', true, 'another provider');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.add_firm_organisation(%L, ''google'', ''advisory.example'', '''')', acme)) LIKE '22023:%', true, 'no name');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_organisations), 0::bigint, 'a refused organisation was listed');
  -- A good one is trimmed and lower-cased, and written to the firm's record.
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.add_firm_organisation(acme, 'google', '  Advisory.Example ', '  Acme Brokers (Google)  ');
  PERFORM public.add_firm_organisation(acme, 'microsoft', upper(tenant), 'Acme Brokers (Microsoft)');
  PERFORM pg_temp.is((SELECT array_agg(f.org_id ORDER BY f.org_id) FROM public.firm_organisations(acme) f), ARRAY[tenant, 'advisory.example'], 'the list holds both, normalised');
  PERFORM pg_temp.is((SELECT f.label FROM public.firm_organisations(acme) f WHERE f.org_id = 'advisory.example'), 'Acme Brokers (Google)', 'the name is trimmed');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.add_firm_organisation(%L, ''google'', ''advisory.example'', ''Again'')', acme)) LIKE '23505:%', true, 'listing one twice in a firm');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.acts(acme, 'organisation_listed')), 2::bigint, 'each listing is in the firm''s record');
  PERFORM pg_temp.is((SELECT a.actor_id FROM pg_temp.acts(acme, 'organisation_listed') a LIMIT 1), pg_temp.id('acme_owner'), 'the owner is the actor');
  -- Another firm may list the same organisation : a listing grants nothing by itself, an owner approves each person.
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM public.add_firm_organisation(zenith, 'google', 'advisory.example', 'Zenith');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_organisations(zenith)), 1::bigint, 'the other firm lists the same organisation');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT * FROM public.firm_organisations(%L)', acme)) LIKE '42501:%', true, 'the other firm''s owner reads this firm''s list');
  RESET ROLE;
  RAISE NOTICE 'join_by_organisation: listing passed';
END $$;

-- ---------- removing an organisation, and the firm's state ----------
-- Break caught: another firm's owner removes a listing (or learns an id exists: the refusal must match a made-up id's); the removal
-- isn't recorded; a refused firm still lists or reads; a firm waiting for approval can't list (D-27); a suspended firm's owner can.
DO $$
DECLARE
  acme uuid := pg_temp.id('acme');
  zenith uuid := pg_temp.id('zenith');
  gid uuid;
  other uuid;
BEGIN
  SELECT o.id INTO gid FROM public.firm_organisations o WHERE o.firm_id = acme AND o.provider = 'google';
  SELECT o.id INTO other FROM public.firm_organisations o WHERE o.firm_id = zenith;
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.remove_firm_organisation(%L)', gid)), pg_temp.refusal('SELECT public.remove_firm_organisation(gen_random_uuid())'), 'another firm''s id and a made-up one are refused alike');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.remove_firm_organisation(%L)', gid)) LIKE '42501:%', true, 'another firm''s owner removing a listing');
  RESET ROLE;
  PERFORM pg_temp.as_user('acme_lead');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.remove_firm_organisation(%L)', gid)) LIKE '42501:%', true, 'a lead removing a listing');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_organisations WHERE firm_id = acme), 2::bigint, 'nothing was removed by the refused calls');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.remove_firm_organisation(gid);
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_organisations WHERE firm_id = acme), 1::bigint, 'the owner removed one');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_organisations WHERE firm_id = zenith), 1::bigint, 'the other firm''s listing is untouched');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.acts(acme, 'organisation_removed')), 1::bigint, 'the removal is in the firm''s record');
  -- The firm's state (D-27, D-31): waiting lists, refused does not, suspended is refused by firm_role.
  PERFORM pg_temp.as_user('waiting_owner');
  PERFORM public.add_firm_organisation(pg_temp.id('waiting'), 'google', 'waiting.example', 'Waiting Partners');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_organisations(pg_temp.id('waiting'))), 1::bigint, 'a firm waiting for approval lists and reads');
  RESET ROLE;
  PERFORM pg_temp.as_user('refused_owner');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.add_firm_organisation(%L, ''google'', ''refused.example'', ''Refused'')', pg_temp.id('refused'))) LIKE 'PT403:%', true, 'a refused firm lists');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT * FROM public.firm_organisations(%L)', pg_temp.id('refused'))) LIKE 'PT403:%', true, 'a refused firm reads its list');
  RESET ROLE;
  PERFORM pg_temp.as_user('suspended_owner');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.add_firm_organisation(%L, ''google'', ''suspended.example'', ''Suspended'')', pg_temp.id('suspended'))) LIKE '42501:%', true, 'a suspended firm''s owner lists');
  RESET ROLE;
  RAISE NOTICE 'join_by_organisation: removing and the firm''s state passed';
END $$;

-- ---------- asking to join ----------
-- What a person at a firm's address is told: 'asked' (they are from a listed organisation and an owner now has their request), or 'none'
-- (everyone else, whatever the reason, so nothing is learned about what the firm lists).
CREATE FUNCTION pg_temp.ask(who text, addr text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE res text;
BEGIN
  PERFORM pg_temp.as_user(who);
  res := public.ask_to_join_firm(addr);
  RESET ROLE;
  RETURN res;
END $$;

-- The requests a firm's owner sees, as 'email|organisation label' in the order asked.
CREATE FUNCTION pg_temp.waiting(owner text, fid uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE res text;
BEGIN
  PERFORM pg_temp.as_user(owner);
  SELECT COALESCE(string_agg(r.email || '|' || r.org_label, ',' ORDER BY r.asked_at, r.email), '') INTO res FROM public.firm_join_requests(fid) r;
  RESET ROLE;
  RETURN res;
END $$;

-- A request's id, read as the table's owner (the callers under test can't read the table).
CREATE FUNCTION pg_temp.req_of(fid uuid, uid uuid) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id FROM public.join_requests WHERE firm_id = fid AND user_id = uid ORDER BY asked_at DESC LIMIT 1
$$;

-- Break caught: the organisation is matched on the email text, on an unverified account, on a token from another tenant; a
-- person is matched against a firm that does not list their organisation; asking is open to a member, a guest, a signed-out caller;
-- the answer differs for an outsider depending on what the firm lists (it would reveal the list); asking twice makes two requests or
-- two entries in the record; a refused or suspended firm takes requests (D-31, D-27).
DO $$
DECLARE
  acme uuid := pg_temp.id('acme');
  zenith uuid := pg_temp.id('zenith');
  tenant constant text := '0f9f1d5c-3a64-4d6e-9f47-1c2b8f7e5a10';
  other_tenant constant text := '7a1d2c3e-4b5f-4a6b-8c7d-9e0f1a2b3c4d';
  anon uuid := gen_random_uuid();
BEGIN
  -- Acme lists its Google domain again (removed above) and its Microsoft tenant; Zenith lists the same Google domain.
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.add_firm_organisation(acme, 'google', 'advisory.example', 'Acme Brokers (Google)');
  RESET ROLE;
  -- Written as the table's owner: the refused and the suspended firm would never be able to list one themselves.
  INSERT INTO public.firm_organisations (firm_id, provider, org_id, label)
  VALUES (pg_temp.id('refused'), 'google', 'advisory.example', 'Refused Group'), (pg_temp.id('suspended'), 'google', 'advisory.example', 'Suspended Advisors'),
         (pg_temp.id('waiting'), 'google', 'advisory.example', 'Waiting Partners');

  PERFORM pg_temp.new_user('g_new'); PERFORM pg_temp.new_user('g_text_only'); PERFORM pg_temp.new_user('g_unverified'); PERFORM pg_temp.new_user('g_other');
  PERFORM pg_temp.new_user('m_new'); PERFORM pg_temp.new_user('m_wrong_tenant'); PERFORM pg_temp.new_user('m_no_tenant'); PERFORM pg_temp.new_user('plain');
  PERFORM pg_temp.signin('g_new', 'google', '{"email": "new@advisory.example", "email_verified": true, "hd": "advisory.example"}');
  PERFORM pg_temp.signin('g_text_only', 'google', '{"email": "sneaky@advisory.example", "email_verified": true}');
  PERFORM pg_temp.signin('g_unverified', 'google', '{"email": "x@advisory.example", "email_verified": false, "hd": "advisory.example"}');
  PERFORM pg_temp.signin('g_other', 'google', '{"email": "x@other.example", "email_verified": true, "hd": "other.example"}');
  PERFORM pg_temp.signin('m_new', 'azure', format('{"email": "ms@advisory.example", "tid": "%s"}', tenant)::jsonb);
  PERFORM pg_temp.signin('m_wrong_tenant', 'azure', format('{"email": "ceo@advisory.example", "tid": "%s"}', other_tenant)::jsonb);
  PERFORM pg_temp.signin('m_no_tenant', 'azure', '{"email": "ms3@advisory.example"}');

  -- A person from a listed organisation asks and is listed for the owner, with the organisation that vouched.
  PERFORM pg_temp.is(pg_temp.ask('g_new', 'acme-brokers'), 'asked', 'a Google Workspace member of a listed domain');
  PERFORM pg_temp.is(pg_temp.waiting('acme_owner', acme), 'g_new@example.test|Acme Brokers (Google)', 'the owner sees who asked and which organisation vouched');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.acts(acme, 'join_asked')), 1::bigint, 'the asking is in the firm''s record');
  PERFORM pg_temp.is((SELECT a.actor_id FROM pg_temp.acts(acme, 'join_asked') a), pg_temp.id('g_new'), 'the person who asked is the actor');
  PERFORM pg_temp.is((SELECT a.subject_user_id FROM pg_temp.acts(acme, 'join_asked') a), pg_temp.id('g_new'), 'and the subject');
  -- Asking again, even with the address in other letters, is the same request, written once.
  PERFORM pg_temp.is(pg_temp.ask('g_new', ' ACME-Brokers '), 'asked', 'asking again');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.acts(acme, 'join_asked')), 1::bigint, 'asking again writes nothing more');
  PERFORM pg_temp.is((SELECT count(*) FROM public.join_requests WHERE firm_id = acme AND user_id = pg_temp.id('g_new')), 1::bigint, 'and keeps one request');
  -- The same person asks at the other firm that lists the same organisation: its own request, for its own owners.
  PERFORM pg_temp.is(pg_temp.ask('g_new', 'zenith-benefits'), 'asked', 'two firms may list one organisation');
  PERFORM pg_temp.is(pg_temp.waiting('zenith_owner', zenith), 'g_new@example.test|Zenith', 'the other firm''s owner sees its own request');
  PERFORM pg_temp.is(pg_temp.waiting('acme_owner', acme), 'g_new@example.test|Acme Brokers (Google)', 'and the first firm''s is unchanged');
  -- A Microsoft tenant.
  PERFORM pg_temp.is(pg_temp.ask('m_new', 'acme-brokers'), 'asked', 'a member of a listed Microsoft tenant');

  -- Everyone else gets the same answer as someone at a firm that lists nothing.
  PERFORM pg_temp.is(pg_temp.ask('g_text_only', 'acme-brokers'), 'none', 'an email at the right domain with no hosted-domain claim is only text');
  PERFORM pg_temp.is(pg_temp.ask('g_unverified', 'acme-brokers'), 'none', 'an unverified email');
  PERFORM pg_temp.is(pg_temp.ask('g_other', 'acme-brokers'), 'none', 'an organisation the firm does not list');
  PERFORM pg_temp.is(pg_temp.ask('m_wrong_tenant', 'acme-brokers'), 'none', 'an email at the right domain from another tenant');
  PERFORM pg_temp.is(pg_temp.ask('m_no_tenant', 'acme-brokers'), 'none', 'a Microsoft sign-in with no tenant claim');
  PERFORM pg_temp.is(pg_temp.ask('plain', 'acme-brokers'), 'none', 'an account with no provider sign-in');
  PERFORM pg_temp.is(pg_temp.ask('g_other', 'zenith-benefits'), pg_temp.ask('g_other', 'acme-brokers'), 'an outsider is answered alike by any firm');
  PERFORM pg_temp.is((SELECT count(*) FROM public.join_requests), 3::bigint, 'only the three listed people have a request');

  -- The address decides the firm, and only a firm that can take people.
  PERFORM pg_temp.is(pg_temp.ask('g_other', 'no-such-firm'), 'none', 'an address no firm holds');
  PERFORM pg_temp.new_user('g_waiting'); PERFORM pg_temp.signin('g_waiting', 'google', '{"email": "w@advisory.example", "email_verified": true, "hd": "advisory.example"}');
  PERFORM pg_temp.is(pg_temp.ask('g_waiting', 'refused-group'), 'none', 'a refused firm (D-31)');
  PERFORM pg_temp.is(pg_temp.ask('g_waiting', 'suspended-advisors'), 'none', 'a suspended firm');
  PERFORM pg_temp.is(pg_temp.ask('g_waiting', 'waiting-partners'), 'asked', 'a firm waiting for approval takes requests (D-27)');
  PERFORM pg_temp.is((SELECT count(*) FROM public.join_requests WHERE firm_id IN (pg_temp.id('refused'), pg_temp.id('suspended'))), 0::bigint, 'nothing was recorded for the refused or the suspended firm');

  -- A member, a guest, someone whose email is not confirmed, and someone signed out.
  PERFORM pg_temp.signin('acme_agent', 'google', '{"email": "agent@advisory.example", "email_verified": true, "hd": "advisory.example"}');
  PERFORM pg_temp.is(pg_temp.ask('acme_agent', 'acme-brokers'), 'none', 'a member asks nothing');
  PERFORM pg_temp.new_user('g_unconfirmed');
  UPDATE auth.users SET email_confirmed_at = NULL WHERE id = pg_temp.id('g_unconfirmed');
  PERFORM pg_temp.signin('g_unconfirmed', 'google', '{"email": "u@advisory.example", "email_verified": true, "hd": "advisory.example"}');
  PERFORM pg_temp.is(pg_temp.ask('g_unconfirmed', 'acme-brokers'), 'none', 'an account whose email is not confirmed');
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at) VALUES (anon, 'authenticated', 'authenticated', NULL, true, now(), now());
  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
  VALUES (gen_random_uuid()::text, anon, '{"email_verified": true, "hd": "advisory.example"}', 'google', now(), now());
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', anon, 'is_anonymous', true, 'role', 'authenticated')::text, false);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.is(public.ask_to_join_firm('acme-brokers'), 'none', 'a guest session');
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', false);
  SET LOCAL ROLE anon;
  PERFORM pg_temp.is(pg_temp.refusal('SELECT public.ask_to_join_firm(''acme-brokers'')') LIKE '42501:%', true, 'a signed-out caller can''t call it');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.join_requests), 4::bigint, 'none of them made a request');

  -- A person suspended in the firm is not asked back in by this route.
  PERFORM pg_temp.new_user('g_suspended'); PERFORM pg_temp.signin('g_suspended', 'google', '{"email": "s@advisory.example", "email_verified": true, "hd": "advisory.example"}');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (acme, pg_temp.id('g_suspended'), 'agent');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.suspend_member(acme, pg_temp.id('g_suspended'));
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.ask('g_suspended', 'acme-brokers'), 'none', 'a suspended member');

  -- At most one open request per person and firm is a constraint (D-29).
  PERFORM pg_temp.is(pg_temp.attempt(format('INSERT INTO public.join_requests (firm_id, user_id, provider, org_id, org_label) VALUES (%L, %L, ''google'', ''advisory.example'', ''x'')', acme, pg_temp.id('g_new'))), '23505', 'a second open request is refused by the database');
  RAISE NOTICE 'join_by_organisation: asking passed';
END $$;

-- ---------- approving and declining ----------
-- Break caught: a lead, an agent, another firm's owner or a platform admin decides a request; approving makes no membership, or the
-- wrong role, or puts a team on it (D-20); approving writes its own entry as well as the membership's (double); a request is approved
-- twice; declining makes a member; a declined person is listed again by signing in again; an id of another firm is told apart from a
-- made-up one; a refused firm approves (D-31); a firm waiting for approval cannot (it can, D-27).
DO $$
DECLARE
  acme uuid := pg_temp.id('acme');
  zenith uuid := pg_temp.id('zenith');
  rid uuid;
  zid uuid;
  mrid uuid;
  oid uuid;
  m public.firm_memberships;
  r text;
BEGIN
  SELECT q.id INTO rid FROM public.join_requests q WHERE q.firm_id = acme AND q.user_id = pg_temp.id('g_new');
  SELECT q.id INTO zid FROM public.join_requests q WHERE q.firm_id = zenith AND q.user_id = pg_temp.id('g_new');
  SELECT q.id INTO mrid FROM public.join_requests q WHERE q.firm_id = acme AND q.user_id = pg_temp.id('m_new');
  FOREACH r IN ARRAY ARRAY['acme_lead', 'acme_agent', 'zenith_owner', 'platform_admin', 'nobody', 'g_new'] LOOP
    PERFORM pg_temp.as_user(r);
    PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.approve_join_request(%L, ''agent'')', rid)) LIKE '42501:%', true, r || ' approving');
    PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.decline_join_request(%L)', rid)) LIKE '42501:%', true, r || ' declining');
    PERFORM pg_temp.is(pg_temp.refusal(format('SELECT * FROM public.firm_join_requests(%L)', acme)) LIKE '42501:%', true, r || ' reading the requests');
    RESET ROLE;
  END LOOP;
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.approve_join_request(%L, ''agent'')', rid)), pg_temp.refusal('SELECT public.approve_join_request(gen_random_uuid(), ''agent'')'), 'another firm''s id and a made-up one are refused alike');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_memberships WHERE user_id = pg_temp.id('g_new')), 0::bigint, 'the refused calls made no member');
  PERFORM pg_temp.is((SELECT count(*) FROM public.join_requests WHERE status = 'open'), 4::bigint, 'and decided nothing');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.approve_join_request(%L, ''admin'')', rid)) LIKE '22023:%', true, 'a role that is not one of the three');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.approve_join_request(%L, NULL)', rid)) LIKE '22023:%', true, 'no role');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_memberships WHERE user_id = pg_temp.id('g_new')), 0::bigint, 'a bad role made no member');

  -- Approving: a member with the chosen role, no team, the request closed, one entry in the firm's record (the membership's own).
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.approve_join_request(rid, 'lead');
  PERFORM public.approve_join_request(mrid, 'owner');
  RESET ROLE;
  SELECT * INTO m FROM public.firm_memberships WHERE firm_id = acme AND user_id = pg_temp.id('g_new');
  PERFORM pg_temp.is(m.role, 'lead', 'the chosen role');
  PERFORM pg_temp.is(m.team_id IS NULL AND m.valid_until IS NULL, true, 'no team, and no end');
  PERFORM pg_temp.is((SELECT role FROM public.firm_memberships WHERE firm_id = acme AND user_id = pg_temp.id('m_new')), 'owner', 'an owner may be chosen');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.acts(acme, 'member_added') a WHERE a.subject_user_id = pg_temp.id('g_new') AND a.actor_id = pg_temp.id('acme_owner')), 1::bigint, 'the membership writes member_added once, by the owner who approved');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.acts(acme, 'owner_added') a WHERE a.subject_user_id = pg_temp.id('m_new')), 1::bigint, 'and owner_added for an owner');
  PERFORM pg_temp.is((SELECT q.status || ':' || q.decided_role || ':' || (q.decided_by = pg_temp.id('acme_owner'))::text FROM public.join_requests q WHERE q.id = rid), 'approved:lead:true', 'the request is closed with who decided and the role');
  PERFORM pg_temp.is(pg_temp.waiting('acme_owner', acme), '', 'nobody is waiting at the first firm now');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.approve_join_request(%L, ''agent'')', rid)) LIKE 'PT410:%', true, 'approving twice');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.decline_join_request(%L)', rid)) LIKE 'PT410:%', true, 'declining one that was approved');
  RESET ROLE;
  PERFORM pg_temp.as_user('g_new');
  PERFORM pg_temp.is(public.firm_role(acme), 'lead', 'the person now has the role at the firm');
  RESET ROLE;
  -- The other firm's request from the same person is its own: still open, untouched.
  PERFORM pg_temp.is(pg_temp.waiting('zenith_owner', zenith), 'g_new@example.test|Zenith', 'the other firm''s request is untouched');

  -- Declining: no member, an entry in the record, and the person is not listed again by signing in again.
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM public.decline_join_request(zid);
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_memberships WHERE firm_id = zenith AND user_id = pg_temp.id('g_new')), 0::bigint, 'declining made no member');
  PERFORM pg_temp.is((SELECT q.status FROM public.join_requests q WHERE q.id = zid), 'declined', 'the request is declined');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.acts(zenith, 'join_declined') a WHERE a.subject_user_id = pg_temp.id('g_new') AND a.actor_id = pg_temp.id('zenith_owner')), 1::bigint, 'the decline is in the firm''s record');
  PERFORM pg_temp.is(pg_temp.ask('g_new', 'zenith-benefits'), 'none', 'a declined person is not listed again by signing in again');
  PERFORM pg_temp.is(pg_temp.waiting('zenith_owner', zenith), '', 'nothing is waiting at the other firm');

  -- Removing a listing leaves a request already open, to be decided; later asks do not match it.
  oid := (SELECT o.id FROM public.firm_organisations o WHERE o.firm_id = acme AND o.provider = 'google');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.remove_firm_organisation(oid);
  RESET ROLE;
  PERFORM pg_temp.new_user('g_late'); PERFORM pg_temp.signin('g_late', 'google', '{"email": "late@advisory.example", "email_verified": true, "hd": "advisory.example"}');
  PERFORM pg_temp.is(pg_temp.ask('g_late', 'acme-brokers'), 'none', 'a removed listing no longer matches');
  -- A request already open when its listing is removed stays for the owner to decide.
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.add_firm_organisation(acme, 'google', 'advisory.example', 'Acme Brokers (Google)');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.ask('g_late', 'acme-brokers'), 'asked', 'listed again, they ask');
  oid := (SELECT o.id FROM public.firm_organisations o WHERE o.firm_id = acme AND o.provider = 'google');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.remove_firm_organisation(oid);
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.waiting('acme_owner', acme), 'g_late@example.test|Acme Brokers (Google)', 'the open request stays after its listing is removed, with the name it had');

  -- A person who became a member another way meanwhile has the request closed and keeps their role.
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (acme, pg_temp.id('g_late'), 'agent');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.approve_join_request(pg_temp.req_of(acme, pg_temp.id('g_late')), 'owner');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_memberships WHERE firm_id = acme AND user_id = pg_temp.id('g_late')), 1::bigint, 'no second membership');
  PERFORM pg_temp.is((SELECT role FROM public.firm_memberships WHERE firm_id = acme AND user_id = pg_temp.id('g_late')), 'agent', 'they keep the role they had');

  -- A request from someone who is suspended at the firm is not approved over the suspension.
  INSERT INTO public.join_requests (firm_id, user_id, provider, org_id, org_label) VALUES (acme, pg_temp.id('g_suspended'), 'google', 'advisory.example', 'x');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.approve_join_request(%L, ''agent'')', pg_temp.req_of(acme, pg_temp.id('g_suspended')))) LIKE 'PT409:%', true, 'approving over a suspension');
  RESET ROLE;

  -- A firm waiting for approval decides (D-27); a refused firm does not (D-31); a suspended firm's owners are refused.
  PERFORM pg_temp.as_user('waiting_owner');
  PERFORM public.approve_join_request(pg_temp.req_of(pg_temp.id('waiting'), pg_temp.id('g_waiting')), 'agent');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT role FROM public.firm_memberships WHERE firm_id = pg_temp.id('waiting') AND user_id = pg_temp.id('g_waiting')), 'agent', 'a firm waiting for approval approves');
  INSERT INTO public.join_requests (firm_id, user_id, provider, org_id, org_label) VALUES (pg_temp.id('refused'), pg_temp.id('g_other'), 'google', 'advisory.example', 'x'), (pg_temp.id('suspended'), pg_temp.id('g_other'), 'google', 'advisory.example', 'x');
  PERFORM pg_temp.as_user('refused_owner');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.approve_join_request(%L, ''agent'')', pg_temp.req_of(pg_temp.id('refused'), pg_temp.id('g_other')))) LIKE 'PT403:%', true, 'a refused firm approves');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.decline_join_request(%L)', pg_temp.req_of(pg_temp.id('refused'), pg_temp.id('g_other')))) LIKE 'PT403:%', true, 'a refused firm declines');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT * FROM public.firm_join_requests(%L)', pg_temp.id('refused'))) LIKE 'PT403:%', true, 'a refused firm reads');
  RESET ROLE;
  PERFORM pg_temp.as_user('suspended_owner');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.approve_join_request(%L, ''agent'')', pg_temp.req_of(pg_temp.id('suspended'), pg_temp.id('g_other')))) LIKE '42501:%', true, 'a suspended firm''s owner approves');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_memberships WHERE user_id = pg_temp.id('g_other')), 0::bigint, 'no refused or suspended firm took a member');
  RAISE NOTICE 'join_by_organisation: approving and declining passed';
END $$;

-- ---------- the table itself, and what is retired ----------
-- Break caught: either table is readable or writable through the API; the retired platform list still hands out the advisor role.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['acme_owner', 'platform_admin', 'nobody'] LOOP
    PERFORM pg_temp.as_user(r);
    PERFORM pg_temp.is(pg_temp.refusal('SELECT count(*) FROM public.join_requests') LIKE '42501:%', true, r || ' reading the requests table');
    PERFORM pg_temp.is(pg_temp.refusal('UPDATE public.join_requests SET status = ''approved''') LIKE '42501:%', true, r || ' changing the requests table');
    PERFORM pg_temp.is(pg_temp.refusal('DELETE FROM public.firm_organisations') LIKE '42501:%', true, r || ' deleting from the list');
    RESET ROLE;
  END LOOP;
  -- The platform admin's list is retired (D-23): its functions are gone, so nobody can still claim the advisor role by organisation.
  PERFORM pg_temp.is((SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                      WHERE n.nspname = 'public' AND p.proname IN ('claim_advisor_role_by_organisation', 'admin_add_allowed_organisation', 'admin_remove_allowed_organisation')),
                     0::bigint, 'the retired functions are gone');
  -- What stays of the old list is history, and the log of who was given the role stays append-only (carried over from the retired test).
  INSERT INTO public.advisor_role_events (kind, provider, org_id) VALUES ('role_granted', 'google', 'advisory.example');
  PERFORM pg_temp.is(pg_temp.attempt('UPDATE public.advisor_role_events SET org_id = ''x''') LIKE 'rows:%', false, 'the old log can be edited');
  PERFORM pg_temp.is(pg_temp.attempt('DELETE FROM public.advisor_role_events') LIKE 'rows:%', false, 'the old log can be deleted from');
  RAISE NOTICE 'join_by_organisation: the tables and the retirement passed';
END $$;

-- ---------- fixes after review: who the automatic ask is not for ----------
-- A sign-in with a given way of signing in (how: 'google' a provider sign-in, 'password', 'password_mfa').
CREATE FUNCTION pg_temp.ask_how(who text, how text, addr text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE res text;
BEGIN
  PERFORM pg_temp.as_user(who, how);
  res := public.ask_to_join_firm(addr);
  RESET ROLE;
  RETURN res;
END $$;

-- Break caught: a platform admin who signs in from a listed domain (a firm can list Nevermore's own) is put on the firm's list with their
-- email, shown as Nevermore's person in the record (D-33, D-16); a person whose membership of the firm ended (removed or left) is listed
-- again each time they sign in; a sign-in made with a password is vouched for by an old linked Google or Microsoft identity.
DO $$
DECLARE waiting uuid := pg_temp.id('waiting');
BEGIN
  PERFORM pg_temp.new_user('g_control'); PERFORM pg_temp.signin('g_control', 'google', '{"email": "c@advisory.example", "email_verified": true, "hd": "advisory.example"}');
  PERFORM pg_temp.signin('platform_admin', 'google', '{"email": "staff@advisory.example", "email_verified": true, "hd": "advisory.example"}');
  -- The same sign-in that lists a person who is not staff.
  PERFORM pg_temp.is(pg_temp.ask('platform_admin', 'waiting-partners'), 'none', 'a platform admin is answered like an outsider');
  PERFORM pg_temp.is((SELECT count(*) FROM public.join_requests WHERE user_id = pg_temp.id('platform_admin')), 0::bigint, 'no request is made for a platform admin');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.acts(waiting, 'join_asked') a WHERE a.actor_id = pg_temp.id('platform_admin') OR a.subject_user_id = pg_temp.id('platform_admin')), 0::bigint, 'and nothing is recorded naming them');
  PERFORM pg_temp.is(pg_temp.waiting('waiting_owner', waiting) NOT LIKE '%staff@%', true, 'their email is not on the firm''s list');
  PERFORM pg_temp.is(pg_temp.ask('g_control', 'waiting-partners'), 'asked', 'the same domain from someone who is not staff is listed');

  -- An ended membership of that firm blocks the automatic ask, as a decline does: an owner brings them back by invitation.
  PERFORM pg_temp.new_user('g_removed'); PERFORM pg_temp.signin('g_removed', 'google', '{"email": "r@advisory.example", "email_verified": true, "hd": "advisory.example"}');
  INSERT INTO public.firm_memberships (firm_id, user_id, role, valid_from, valid_until) VALUES (waiting, pg_temp.id('g_removed'), 'agent', now() - interval '2 days', now() - interval '1 day');
  PERFORM pg_temp.is(pg_temp.ask('g_removed', 'waiting-partners'), 'none', 'a person whose membership ended is not listed again');
  PERFORM pg_temp.is((SELECT count(*) FROM public.join_requests WHERE user_id = pg_temp.id('g_removed')), 0::bigint, 'and has no request');
  -- Their ended membership of another firm does not matter here.
  PERFORM pg_temp.is(pg_temp.ask('g_removed', 'zenith-benefits'), 'asked', 'an ended membership blocks only that firm');

  -- A session that signed in with a password is vouched for by no provider, even with a Google identity linked to the account.
  PERFORM pg_temp.new_user('g_password'); PERFORM pg_temp.signin('g_password', 'google', '{"email": "p@advisory.example", "email_verified": true, "hd": "advisory.example"}');
  PERFORM pg_temp.is(pg_temp.ask_how('g_password', 'password', 'waiting-partners'), 'none', 'a password sign-in');
  PERFORM pg_temp.is(pg_temp.ask_how('g_password', 'password_mfa', 'waiting-partners'), 'none', 'a password sign-in with its second factor');
  PERFORM pg_temp.is((SELECT count(*) FROM public.join_requests WHERE user_id = pg_temp.id('g_password')), 0::bigint, 'no request from a password sign-in');
  PERFORM pg_temp.is(pg_temp.ask_how('g_password', 'google', 'waiting-partners'), 'asked', 'the same person signing in with the provider is listed');
  RAISE NOTICE 'join_by_organisation: staff, ended memberships and password sign-ins passed';
END $$;

-- ---------- fixes after review: what approving returns ----------
-- Break caught: the owner is told the role they picked when the person already held another (they became a member by invitation meanwhile).
DO $$
DECLARE
  acme uuid := pg_temp.id('acme');
  got text;
BEGIN
  PERFORM pg_temp.new_user('g_ret1'); PERFORM pg_temp.new_user('g_ret2');
  INSERT INTO public.join_requests (firm_id, user_id, provider, org_id, org_label) VALUES (acme, pg_temp.id('g_ret1'), 'google', 'x.example', 'x'), (acme, pg_temp.id('g_ret2'), 'google', 'x.example', 'x');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (acme, pg_temp.id('g_ret2'), 'agent');
  PERFORM pg_temp.as_user('acme_owner');
  got := public.approve_join_request(pg_temp.req_of(acme, pg_temp.id('g_ret1')), 'lead');
  PERFORM pg_temp.is(got, 'lead', 'approving returns the role the person now holds');
  got := public.approve_join_request(pg_temp.req_of(acme, pg_temp.id('g_ret2')), 'owner');
  PERFORM pg_temp.is(got, 'agent', 'a person who already held a role is returned that one');
  RESET ROLE;
  RAISE NOTICE 'join_by_organisation: what approving returns passed';
END $$;

-- ---------- two sessions deciding at once (D-32) ----------
-- Approving and declining one request at the same moment end with one outcome that the request, the membership and the firm's record agree
-- on. What makes it so is the `status = 'open'` guard on the update that closes the request: the second to run waits for the first's row,
-- finds it decided and is refused (PT410), and its membership is rolled back with it. There is no row lock on the request because the guard
-- alone is enough (the test passes with only the guard and fails with neither). Two owners removing one listing at once: the lock in
-- remove_firm_organisation makes the second find nothing, so the removal is recorded once.
-- Break caught: the guard is removed (a member whose request reads declined, with a "declined" entry beside "member_added"); the removal lock is removed.
CREATE SCHEMA race;
CREATE EXTENSION dblink SCHEMA race;
-- Committed in blocks of their own so the other sessions see them.
DO $$
BEGIN
  PERFORM pg_temp.new_user('dbl_asker'); PERFORM pg_temp.new_user('dbl_asker_2');
  INSERT INTO public.join_requests (firm_id, user_id, provider, org_id, org_label)
  VALUES (pg_temp.id('acme'), pg_temp.id('dbl_asker'), 'google', 'x.example', 'x'), (pg_temp.id('acme'), pg_temp.id('dbl_asker_2'), 'google', 'x.example', 'x');
  INSERT INTO public.firm_organisations (firm_id, provider, org_id, label) VALUES (pg_temp.id('acme'), 'google', 'race.example', 'Race');
END $$;
CREATE FUNCTION pg_temp.race_pair(first_stmt text, second_stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  dsn text := format('dbname=%s user=%s port=%s host=%s', current_database(), session_user, current_setting('port'),
    split_part(current_setting('unix_socket_directories'), ',', 1));
  claims text;
  second_pid integer;
  tries integer := 0;
  s text;
  m text;
  outcome text := 'ok';
BEGIN
  claims := format($q$SELECT set_config('request.jwt.claims', %L, true)$q$,
    jsonb_build_object('sub', pg_temp.id('acme_owner'), 'role', 'authenticated', 'is_anonymous', false, 'email', 'acme_owner@example.test')::text);
  PERFORM race.dblink_connect('race_first', dsn);
  PERFORM race.dblink_connect('race_second', dsn);
  PERFORM race.dblink_exec('race_second', 'SET lock_timeout = ''20s''');
  SELECT pid INTO second_pid FROM race.dblink('race_second', 'SELECT pg_backend_pid()') AS t(pid integer);
  PERFORM race.dblink_exec('race_first', 'BEGIN');
  PERFORM race.dblink_exec('race_first', 'SET LOCAL ROLE authenticated');
  PERFORM * FROM race.dblink('race_first', claims) AS t(c text);
  PERFORM * FROM race.dblink('race_first', first_stmt) AS t(r text);
  PERFORM race.dblink_exec('race_second', 'BEGIN');
  PERFORM race.dblink_exec('race_second', 'SET LOCAL ROLE authenticated');
  PERFORM * FROM race.dblink('race_second', claims) AS t(c text);
  PERFORM race.dblink_send_query('race_second', second_stmt);
  -- The second is waiting on the first when it holds a lock the first has.
  WHILE cardinality(pg_blocking_pids(second_pid)) = 0 AND race.dblink_is_busy('race_second') = 1 LOOP
    tries := tries + 1;
    IF tries > 100 THEN EXIT; END IF;
    PERFORM pg_sleep(0.05);
  END LOOP;
  PERFORM race.dblink_exec('race_first', 'COMMIT');
  BEGIN
    PERFORM * FROM race.dblink_get_result('race_second') AS t(r text);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT;
    outcome := s;
  END;
  PERFORM race.dblink_disconnect('race_first');
  BEGIN
    PERFORM race.dblink_exec('race_second', 'ROLLBACK');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  PERFORM race.dblink_disconnect('race_second');
  RETURN outcome;
END $$;
DO $$
DECLARE
  acme uuid := pg_temp.id('acme');
  rid uuid := pg_temp.req_of(pg_temp.id('acme'), pg_temp.id('dbl_asker'));
  oid uuid := (SELECT o.id FROM public.firm_organisations o WHERE o.firm_id = pg_temp.id('acme') AND o.org_id = 'race.example');
  second text;
  st text;
  members bigint;
  declined bigint;
  removed_before bigint := (SELECT count(*) FROM pg_temp.acts(pg_temp.id('acme'), 'organisation_removed'));
BEGIN
  second := pg_temp.race_pair(format($q$SELECT public.approve_join_request(%L, 'agent')::text$q$, rid), format($q$SELECT public.decline_join_request(%L)::text$q$, rid));
  PERFORM pg_temp.is(second, 'PT410', 'the decline that came second is refused as already decided');
  SELECT q.status INTO st FROM public.join_requests q WHERE q.id = rid;
  SELECT count(*) INTO members FROM public.firm_memberships WHERE firm_id = acme AND user_id = pg_temp.id('dbl_asker');
  SELECT count(*) INTO declined FROM pg_temp.acts(acme, 'join_declined') a WHERE a.subject_user_id = pg_temp.id('dbl_asker');
  PERFORM pg_temp.is(st || ':' || members || ':' || declined, 'approved:1:0', 'the request, the membership and the record agree: approved');
  -- And the other way round: the decline first, the approval second leaves no member.
  rid := pg_temp.req_of(acme, pg_temp.id('dbl_asker_2'));
  second := pg_temp.race_pair(format($q$SELECT public.decline_join_request(%L)::text$q$, rid), format($q$SELECT public.approve_join_request(%L, 'agent')::text$q$, rid));
  PERFORM pg_temp.is(second, 'PT410', 'the approval that came second is refused as already decided');
  SELECT q.status INTO st FROM public.join_requests q WHERE q.id = rid;
  SELECT count(*) INTO members FROM public.firm_memberships WHERE firm_id = acme AND user_id = pg_temp.id('dbl_asker_2');
  PERFORM pg_temp.is(st || ':' || members, 'declined:0', 'the request and the membership agree: declined, no member');
  -- Two removals of one listing: recorded once, the second refused in plain words.
  second := pg_temp.race_pair(format($q$SELECT public.remove_firm_organisation(%L)::text$q$, oid), format($q$SELECT public.remove_firm_organisation(%L)::text$q$, oid));
  PERFORM pg_temp.is(second, '42501', 'the second removal finds nothing to remove');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.acts(acme, 'organisation_removed')), removed_before + 1, 'the two removals are one entry in the record');
  RAISE NOTICE 'join_by_organisation: two-session decisions passed';
END $$;
