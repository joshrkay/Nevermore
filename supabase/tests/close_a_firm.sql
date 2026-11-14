-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh close_a_firm
-- Closing a firm (story CRM-P1.7; docs/BROKER_CRM_BUILD.md D-16, D-18, D-24, D-27, D-29, D-31, D-33, D-45, D-104, D-105, D-106;
-- 20261118110000_close_a_firm.sql). An owner asks to close the firm. For 30 days it is read-only: members read, and every write path
-- of the firm's data is refused at the database with a plain message. Any owner can withdraw until the 30 days end. After them the
-- daily job (close_due_firms) deletes the firm's working data, ends every membership and the firm's access to its intakes, which stay
-- for their employers; the address is held for twelve months; and the platform keeps a record of what was deleted, without content.
-- Several firms are used throughout. Every migration is loaded, in filename order (D-105), this story's last.
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

-- The SQLSTATE and message a statement raised, or 'ok' when it did not. The statement's own work is kept when it succeeds.
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

-- How many rows of each table closing deletes a firm holds, as one object, read as the table owner.
CREATE FUNCTION pg_temp.held(fid uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE step record; n bigint; res jsonb := '{}'::jsonb;
BEGIN
  FOR step IN SELECT p.src, p.firm_column FROM public.firm_closing_plan() p WHERE p.action = 'delete' ORDER BY p.ord LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %I = $1', substr(step.src, 8), step.firm_column) INTO n USING fid;
    res := res || jsonb_build_object(substr(step.src, 8), n);
  END LOOP;
  RETURN res;
END $$;

-- Moves a firm's open request back in time, so its 30 days have passed.
CREATE FUNCTION pg_temp.age_request(fid uuid, days integer) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.firm_closures SET asked_at = asked_at - make_interval(days => days), closes_at = closes_at - make_interval(days => days)
  WHERE firm_id = fid AND withdrawn_at IS NULL AND closed_at IS NULL
$$;

CREATE FUNCTION pg_temp.hash(t text) RETURNS text LANGUAGE sql AS $$ SELECT encode(extensions.digest(t, 'sha256'), 'hex') $$;

-- A firm with an open request, for the cases that need one of their own: asked 31 days ago and due a day ago when `due`, else asked now.
CREATE FUNCTION pg_temp.make_closing_firm(n text, addr text, owner text, due boolean, decided boolean DEFAULT true) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE fid uuid;
BEGIN
  IF decided THEN
    INSERT INTO public.firms (name, address, approved_at, decision, decided_at) VALUES (n, addr, now(), 'approved', now()) RETURNING id INTO fid;
  ELSE
    INSERT INTO public.firms (name, address) VALUES (n, addr) RETURNING id INTO fid;
  END IF;
  INSERT INTO fx VALUES (lower(split_part(n, ' ', 1)), fid);
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (fid, pg_temp.id(owner), 'owner');
  IF due THEN
    INSERT INTO public.firm_closures (firm_id, asked_at, asked_by, closes_at) VALUES (fid, now() - interval '31 days', pg_temp.id(owner), now() - interval '1 day');
  ELSE
    INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (fid, pg_temp.id(owner), now() + interval '30 days');
  END IF;
  RETURN fid;
END $$;

-- ---------- set up ----------
-- alpha: the firm that closes. Two owners, an agent who also holds the advisor role, a member with a team and a mailbox, a member
-- who also belongs to beta, a suspended member, and a membership dated for later. beta: another firm with the same kinds of rows.
-- gamma: a second firm to close while suspended. omega waits for approval; rho is refused; sigma is suspended.
DO $$
DECLARE fa uuid; fb uuid; fg uuid; fo uuid; fr uuid; fs uuid; s uuid; sb uuid; q bigint; t1 uuid; t2 uuid; sv uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at, decision, decided_at) VALUES ('Alpha Brokers', 'alpha-brokers', now(), 'approved', now()) RETURNING id INTO fa;
  INSERT INTO public.firms (name, address, approved_at, decision, decided_at) VALUES ('Beta Benefits', 'beta-benefits', now(), 'approved', now()) RETURNING id INTO fb;
  INSERT INTO public.firms (name, address, approved_at, decision, decided_at) VALUES ('Gamma Group', 'gamma-group', now(), 'approved', now()) RETURNING id INTO fg;
  INSERT INTO public.firms (name, address) VALUES ('Omega Partners', 'omega-partners') RETURNING id INTO fo;
  INSERT INTO public.firms (name, address, decision, decided_at) VALUES ('Rho Refused', 'rho-refused', 'refused', now()) RETURNING id INTO fr;
  INSERT INTO public.firms (name, address, approved_at, decision, decided_at) VALUES ('Sigma Suspended', 'sigma-suspended', now(), 'approved', now()) RETURNING id INTO fs;
  INSERT INTO fx VALUES ('alpha', fa), ('beta', fb), ('gamma', fg), ('omega', fo), ('rho', fr), ('sigma', fs);
  PERFORM pg_temp.new_user(n) FROM unnest(ARRAY['owner_a', 'owner_a2', 'agent_a', 'teamed', 'both', 'susp', 'future', 'leaver', 'owner_b', 'agent_b',
    'owner_g', 'owner_w', 'owner_r', 'owner_s', 'platform_admin', 'outsider', 'prospect_a', 'prospect_b', 'invitee', 'joiner',
    'founder1', 'founder2', 'founder3', 'admin_member', 'prospect_a2', 'owner_d', 'owner_e', 'owner_dl', 'owner_z', 'owner_x']) AS n;
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES
    (fa, pg_temp.id('owner_a'), 'owner'), (fa, pg_temp.id('owner_a2'), 'owner'), (fa, pg_temp.id('agent_a'), 'agent'), (fa, pg_temp.id('both'), 'agent'),
    (fa, pg_temp.id('leaver'), 'agent'), (fa, pg_temp.id('susp'), 'agent'),
    (fb, pg_temp.id('owner_b'), 'owner'), (fb, pg_temp.id('both'), 'agent'), (fb, pg_temp.id('agent_b'), 'agent'),
    (fg, pg_temp.id('owner_g'), 'owner'), (fo, pg_temp.id('owner_w'), 'owner'), (fr, pg_temp.id('owner_r'), 'owner'), (fs, pg_temp.id('owner_s'), 'owner');
  INSERT INTO public.firm_teams (firm_id, name) VALUES (fa, 'Alpha team') RETURNING id INTO t1;
  INSERT INTO public.firm_teams (firm_id, name) VALUES (fb, 'Beta team') RETURNING id INTO t2;
  INSERT INTO public.firm_memberships (firm_id, user_id, role, team_id) VALUES (fa, pg_temp.id('teamed'), 'agent', t1);
  INSERT INTO public.firm_memberships (firm_id, user_id, role, valid_from) VALUES (fa, pg_temp.id('future'), 'agent', now() + interval '10 days');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (fa, pg_temp.id('admin_member'), 'agent'), (public.default_firm_id(), pg_temp.id('owner_d'), 'owner');
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('admin_member'), 'admin'), (pg_temp.id('platform_admin'), 'admin'), (pg_temp.id('agent_a'), 'advisor'), (pg_temp.id('agent_b'), 'advisor'),
    (pg_temp.id('owner_a'), 'advisor');
  -- Each firm's intake, and a quote request on alpha's with a mail thread, held mail and an open alert.
  INSERT INTO public.chamber_sessions (user_id, firm_id, chamber_data) VALUES (pg_temp.id('prospect_a'), fa, '{}') RETURNING id INTO s;
  INSERT INTO public.chamber_sessions (user_id, firm_id, chamber_data) VALUES (pg_temp.id('prospect_b'), fb, '{}') RETURNING id INTO sb;
  INSERT INTO fx VALUES ('intake_a', s), ('intake_b', sb);
  INSERT INTO public.quote_requests (session_id, peo_name, status) VALUES (s, 'Probe PEO', 'sent') RETURNING id INTO q;
  INSERT INTO public.quote_request_messages (provider_message_id, quote_request_id, session_id, direction, from_address)
    VALUES ('thread-1', q, s, 'received', 'peo@example.test');
  INSERT INTO public.quote_request_messages (provider_message_id, firm_id, held_reason, direction, from_address)
    VALUES ('held-1', fa, 'revoked_address', 'received', 'peo@example.test');
  INSERT INTO public.outbox_events (kind, session_id, dedupe_key, payload, status) VALUES ('advisor_notification', s, 'alert-a', '{}', 'pending');
  -- The firm's working data: for alpha and for beta alike.
  INSERT INTO public.referral_partners (firm_id, code, name, kind) VALUES (fa, 'existing', 'Existing', 'accounting'), (fb, 'existing', 'Existing', 'accounting');
  INSERT INTO public.firm_organisations (firm_id, provider, org_id, label) VALUES (fa, 'google', 'alpha.example', 'Alpha'), (fb, 'google', 'beta.example', 'Beta');
  INSERT INTO public.join_requests (firm_id, user_id, provider, org_id, org_label) VALUES (fa, pg_temp.id('joiner'), 'google', 'alpha.example', 'Alpha');
  INSERT INTO public.firm_invitations (firm_id, email, role, token_hash, expires_at)
    VALUES (fa, 'invitee@example.test', 'agent', pg_temp.hash('invite-a'), now() + interval '7 days'),
           (fb, 'someone@example.test', 'agent', pg_temp.hash('invite-b'), now() + interval '7 days');
  INSERT INTO public.saved_views (firm_id, user_id, table_name, name) VALUES (fa, pg_temp.id('agent_a'), 'submissions', 'Mine') RETURNING id INTO sv;
  INSERT INTO fx VALUES ('view_a', sv);
  INSERT INTO public.saved_views (firm_id, user_id, table_name, name) VALUES (fa, pg_temp.id('owner_a'), 'submissions', 'Owner''s') RETURNING id INTO sv;
  INSERT INTO fx VALUES ('view_o', sv);
  INSERT INTO public.saved_views (firm_id, user_id, table_name, name) VALUES (fb, pg_temp.id('agent_b'), 'submissions', 'Theirs');
  INSERT INTO public.table_preferences (firm_id, user_id, table_name, columns) VALUES (fa, pg_temp.id('agent_a'), 'submissions', '["a"]'), (fb, pg_temp.id('agent_b'), 'submissions', '["b"]');
  INSERT INTO public.broker_mailboxes (user_id, provider, address, scope, token_ciphertext, token_iv) VALUES
    (pg_temp.id('teamed'), 'google', 'teamed@mailbox.test', 'gmail.send', 'c', 'i'),
    (pg_temp.id('agent_a'), 'google', 'agent_a@mailbox.test', 'gmail.send', 'c', 'i'),
    (pg_temp.id('both'), 'google', 'both@mailbox.test', 'gmail.send', 'c', 'i'),
    (pg_temp.id('agent_b'), 'google', 'agent_b@mailbox.test', 'gmail.send', 'c', 'i');
  -- A failed deletion of a second intake of alpha (for retry_intake_deletion); the first intake must stay open to files.
  INSERT INTO public.chamber_sessions (user_id, firm_id, chamber_data) VALUES (pg_temp.id('prospect_a2'), fa, '{}') RETURNING id INTO sv;
  INSERT INTO public.intake_deletions (session_id, user_id, trigger, reason, status) VALUES (sv, pg_temp.id('prospect_a2'), 'request', 'probe', 'failed') RETURNING id INTO sv;
  INSERT INTO fx VALUES ('deletion_a', sv);
  INSERT INTO fx VALUES ('quote_a', gen_random_uuid());
  PERFORM set_config('test.quote_a', q::text, false);
END $$;

-- A note on alpha's quote request, and one suspended member, made as the firm's own people before anything closes.
DO $$
DECLARE q bigint := current_setting('test.quote_a')::bigint; fa uuid := pg_temp.id('alpha'); note jsonb;
BEGIN
  PERFORM pg_temp.as_user('agent_a');
  note := public.advisor_add_quote_request_note(q, 'other', current_date, 'a note');
  PERFORM set_config('test.note_a', note ->> 'id', false);
  PERFORM pg_temp.as_user('owner_a');
  PERFORM public.suspend_member(fa, pg_temp.id('susp'));
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_member_suspensions WHERE firm_id = fa AND ended_at IS NULL), 1::bigint, 'one member of alpha is suspended before the request');
  RAISE NOTICE 'close_a_firm: set up';
END $$;


-- ---------- who may ask ----------
-- Break caught: an agent, a member of another firm, a stranger, a signed-out visitor, a platform admin, the owner of a refused firm or of
-- a suspended one asks to close a firm; the name typed is not checked; a refusal leaves a request behind.
DO $$
DECLARE fa uuid := pg_temp.id('alpha'); fs uuid := pg_temp.id('sigma'); fr uuid := pg_temp.id('rho');
BEGIN
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_suspend_firm(fs, 'Under review');
  PERFORM pg_temp.as_user('agent_a');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.request_firm_closure(%L, 'Alpha Brokers')$q$, fa)), '42501', 'an agent of the firm cannot ask');
  PERFORM pg_temp.as_user('owner_b');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.request_firm_closure(%L, 'Alpha Brokers')$q$, fa)), '42501', 'another firm''s owner cannot');
  PERFORM pg_temp.as_user('outsider');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.request_firm_closure(%L, 'Alpha Brokers')$q$, fa)), '42501', 'a stranger cannot');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.request_firm_closure(%L, 'Alpha Brokers')$q$, fa)), '42501', 'a platform admin cannot close a firm on its behalf');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.request_firm_closure(%L, 'Alpha Brokers')$q$, fa)), '42501', 'a signed-out visitor cannot');
  PERFORM pg_temp.as_user('owner_r');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.request_firm_closure(%L, 'Rho Refused')$q$, fr)), '42501', 'the owner of a refused firm cannot');
  PERFORM pg_temp.as_user('owner_s');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.request_firm_closure(%L, 'Sigma Suspended')$q$, fs)), '42501', 'the owner of a suspended firm cannot (they get nothing)');
  PERFORM pg_temp.as_user('owner_a');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.request_firm_closure(%L, 'Beta Benefits')$q$, fa)), '22023', 'the wrong name is refused');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.request_firm_closure(%L, '   ')$q$, fa)), '22023', 'a blank name is refused');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.request_firm_closure(%L, NULL)$q$, fa)), '22023', 'no name is refused');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_closures), 0::bigint, 'none of them left a request behind');
  PERFORM pg_temp.is(has_function_privilege('anon', 'public.request_firm_closure(uuid, text)', 'EXECUTE'), false, 'the signed-out role holds no right to call it');
  RAISE NOTICE 'close_a_firm: who may ask cases passed';
END $$;

-- ---------- asking ----------
-- Break caught: the request is not made, or for the wrong firm, with the wrong end date (30 days), or without who asked; asking is not in
-- the firm's record or the owners are not emailed; the email holds more than who, which firm and when; a firm waiting for approval
-- cannot ask though its people work before approval (D-27); a second request is accepted while one is open (D-29: the index is the rule).
DO $$
DECLARE fa uuid := pg_temp.id('alpha'); fo uuid := pg_temp.id('omega'); got timestamptz; c public.firm_closures;
BEGIN
  PERFORM pg_temp.as_user('owner_a');
  got := public.request_firm_closure(fa, '  alpha BROKERS ');
  RESET ROLE;
  SELECT * INTO c FROM public.firm_closures WHERE firm_id = fa;
  PERFORM pg_temp.is(c.closes_at, got, 'the date it returns is the one it recorded');
  PERFORM pg_temp.is(c.closes_at - c.asked_at, interval '30 days', 'the firm closes 30 days after it was asked');
  PERFORM pg_temp.is(c.asked_by, pg_temp.id('owner_a'), 'by the owner who asked');
  PERFORM pg_temp.is(c.withdrawn_at IS NULL AND c.closed_at IS NULL, true, 'and it is open');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_closures), 1::bigint, 'only alpha is closing');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE firm_id = fa AND kind = 'closure_asked' AND actor_id = pg_temp.id('owner_a') AND NOT actor_is_staff
                       AND record_type = 'firm' AND record_id = fa::text), 1::bigint, 'asking is in the firm''s record, as the owner who asked');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE firm_id = pg_temp.id('beta') AND kind IN ('closure_asked', 'closure_withdrawn')), 0::bigint, 'and not in another firm''s');
  PERFORM pg_temp.is((SELECT count(*) FROM public.outbox_events WHERE kind = 'firm_closing' AND firm_id = fa AND session_id IS NULL AND status = 'pending'), 1::bigint,
    'the owners are emailed, as a firm''s email with no intake');
  PERFORM pg_temp.is((SELECT string_agg(k, ',' ORDER BY k) FROM public.outbox_events e, jsonb_object_keys(e.payload) k WHERE e.kind = 'firm_closing' AND e.firm_id = fa), 'by_email,closes_at,event,firm_name',
    'the email holds who asked, which firm, what happened and when it closes, and nothing else');
  PERFORM pg_temp.is((SELECT payload ->> 'event' FROM public.outbox_events WHERE kind = 'firm_closing' AND firm_id = fa), 'asked', 'it says it was asked');
  SET LOCAL ROLE service_role;
  PERFORM pg_temp.is(array_to_string(public.outbox_owner_recipients(fa), ','), 'owner_a2@example.test,owner_a@example.test', 'it goes to both owners and not to the agent');
  RESET ROLE;

  PERFORM pg_temp.as_user('owner_a2');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.request_firm_closure(%L, 'Alpha Brokers')$q$, fa)), 'PT409', 'a second owner cannot open a second request');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.firm_closures (firm_id, closes_at) VALUES (%L, now() + interval '30 days')$q$, fa)), '23505',
    'the table refuses a second open request itself (D-29)');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.firm_closures (firm_id, closes_at, withdrawn_at, asked_at) VALUES (%L, now(), now(), now() - interval '1 day')$q$, fa)), 'rows:1',
    'a withdrawn one beside it is fine');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.firm_closures (firm_id, closes_at, asked_at) VALUES (%L, now(), now())$q$, fa)), '23514', 'an end date that is not after the asking is refused');

  -- A firm waiting for approval can ask: it is theirs.
  PERFORM pg_temp.as_user('owner_w');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.request_firm_closure(%L, 'Omega Partners')$q$, fo)), 'ok', 'a firm waiting for approval can ask to close');
  RESET ROLE;
  RAISE NOTICE 'close_a_firm: asking cases passed';
END $$;

-- ---------- what a member is told ----------
-- Break caught: the banner's question answers for a firm that is not closing, for a person who is no member, for another firm's owner or
-- a suspended firm's (a closing state must not leak), or does not give the date.
DO $$
DECLARE fa uuid := pg_temp.id('alpha'); closes timestamptz := (SELECT closes_at FROM public.firm_closures WHERE firm_id = pg_temp.id('alpha'));
BEGIN
  PERFORM pg_temp.as_user('agent_a');
  PERFORM pg_temp.is((SELECT c.closes_at FROM public.my_firm_closure(fa) c), closes, 'an agent of the firm is told when it closes');
  PERFORM pg_temp.is((SELECT c.can_ask FROM public.my_firm_closure(fa) c), false, 'and may not ask: an agent is not an owner, and one request is open');
  PERFORM pg_temp.as_user('owner_a');
  PERFORM pg_temp.is((SELECT count(*) FROM public.my_firm_closure(fa)), 1::bigint, 'so is an owner');
  PERFORM pg_temp.is((SELECT count(*) FROM public.my_firm_closure(pg_temp.id('beta'))), 0::bigint, 'nobody is told about a firm that is not closing');
  PERFORM pg_temp.as_user('owner_b');
  PERFORM pg_temp.is((SELECT count(*) FROM public.my_firm_closure(fa)), 0::bigint, 'another firm''s owner is told nothing of it');
  PERFORM pg_temp.as_user('outsider');
  PERFORM pg_temp.is((SELECT count(*) FROM public.my_firm_closure(fa)), 0::bigint, 'nor is a stranger');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.my_firm_closure(%L)$q$, fa)), '42501', 'nor a signed-out visitor');
  RESET ROLE;
  RAISE NOTICE 'close_a_firm: banner cases passed';
END $$;

-- ---------- the default firm can't be closed (D-101, D-121) ----------
-- Break caught: the firm that takes every intake people start on Nevermore is asked to close (every later intake would go to a firm nobody
-- reads, and the platform's intake work would be read-only for 30 days); the closing deletes it anyway when a request row exists; the page
-- is told it may ask. The database tells the page, so the id is not written twice.
DO $$
DECLARE fd uuid := public.default_firm_id(); fa uuid := pg_temp.id('alpha');
BEGIN
  PERFORM pg_temp.as_user('owner_d');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.request_firm_closure(%L, 'Edgar Allan Advisory')$q$, fd)),
    'PT403: This firm takes the intakes people start on Nevermore, so it can''t be closed', 'the default firm cannot be asked to close, even by its owner');
  PERFORM pg_temp.is((SELECT c.can_ask FROM public.my_firm_closure(fd) c), false, 'and its owner is told they may not ask');
  PERFORM pg_temp.is((SELECT c.can_ask FROM public.my_firm_closure(fa) c), NULL::boolean, 'while they are told nothing of another firm');
  PERFORM pg_temp.as_user('owner_a2');
  PERFORM pg_temp.is((SELECT c.can_ask FROM public.my_firm_closure(fa) c), false, 'an owner of a firm with a request open is not offered another');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_closures WHERE firm_id = fd), 0::bigint, 'no request was made');
  -- Even with a due request row, the closing never closes it.
  INSERT INTO public.firm_closures (firm_id, asked_at, closes_at) VALUES (fd, now() - interval '31 days', now() - interval '1 day');
  SET LOCAL ROLE service_role;
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.close_firm_now(%L)$q$, fd)), 'PT403: This firm takes the intakes people start on Nevermore, so it can''t be closed', 'the closing refuses it');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_memberships WHERE firm_id = fd AND public.membership_is_current(valid_from, valid_until)), 1::bigint, 'and its owner is still a member');
  DELETE FROM public.firm_closures WHERE firm_id = fd;
  RAISE NOTICE 'close_a_firm: the default firm passed';
END $$;

-- ---------- every write path is refused while the firm is closing ----------
-- Break caught: any one of the paths that change a firm's data still works for a member while the firm is closing (each is tried below,
-- as the person who would use it, with the message they should see); or a path is refused for the wrong reason: each is tried again
-- after the request is withdrawn and must then no longer be refused for closing, so the refusal is the closing and nothing else.
CREATE TEMP TABLE writes (label text PRIMARY KEY, who text NOT NULL, stmt text NOT NULL, refusal text NOT NULL);
DO $$
DECLARE fa uuid := pg_temp.id('alpha'); s uuid := pg_temp.id('intake_a'); q bigint := current_setting('test.quote_a')::bigint; note bigint := current_setting('test.note_a')::bigint;
  v uuid := pg_temp.id('view_a'); vo uuid := pg_temp.id('view_o'); org uuid; req uuid; inv uuid; ev uuid; closing_msg text := 'PT423: This firm is closing and can''t be changed';
BEGIN
  RESET ROLE;
  SELECT id INTO org FROM public.firm_organisations WHERE firm_id = fa;
  SELECT id INTO req FROM public.join_requests WHERE firm_id = fa;
  SELECT id INTO inv FROM public.firm_invitations WHERE firm_id = fa;
  SELECT id INTO ev FROM public.outbox_events WHERE dedupe_key = 'alert-a';
  INSERT INTO writes VALUES
    ('add a referral partner', 'agent_a', format($q$SELECT public.advisor_add_referral_partner('new-code', 'New', 'accounting', %L)$q$, fa), closing_msg),
    ('change a referral partner', 'agent_a', format($q$SELECT public.advisor_update_referral_partner('existing', 'Renamed', 'accounting', %L)$q$, fa), closing_msg),
    ('invite a member', 'owner_a', format($q$SELECT public.invite_member(%L, 'new@example.test', 'agent', NULL, %L)$q$, fa, pg_temp.hash('x1')), closing_msg),
    ('send an invitation again', 'owner_a', format($q$SELECT public.resend_invitation(%L, %L)$q$, inv, pg_temp.hash('x2')), closing_msg),
    ('withdraw an invitation', 'owner_a', format($q$SELECT public.cancel_invitation(%L)$q$, inv), closing_msg),
    ('accept an invitation', 'invitee', format($q$SELECT public.accept_invitation(%L, 'alpha-brokers')$q$, pg_temp.hash('invite-a')),
      'PT423: This firm is closing, so it can''t take new members'),
    ('list an organisation', 'owner_a', format($q$SELECT public.add_firm_organisation(%L, 'google', 'new.example', 'New')$q$, fa), closing_msg),
    ('remove an organisation', 'owner_a', format($q$SELECT public.remove_firm_organisation(%L)$q$, org), closing_msg),
    ('approve a request to join', 'owner_a', format($q$SELECT public.approve_join_request(%L, 'agent')$q$, req), closing_msg),
    ('decline a request to join', 'owner_a', format($q$SELECT public.decline_join_request(%L)$q$, req), closing_msg),
    ('remove a member', 'owner_a', format($q$SELECT public.remove_member(%L, %L)$q$, fa, pg_temp.id('agent_a')), closing_msg),
    ('suspend a member', 'owner_a', format($q$SELECT public.suspend_member(%L, %L)$q$, fa, pg_temp.id('agent_a')), closing_msg),
    ('lift a member''s suspension', 'owner_a', format($q$SELECT public.lift_member_suspension(%L, %L)$q$, fa, pg_temp.id('susp')), closing_msg),
    ('save a view', 'agent_a', format($q$SELECT public.save_view(%L, 'submissions', 'Another', '{}'::jsonb, '{}'::jsonb, '[]'::jsonb)$q$, fa), closing_msg),
    ('change a view', 'agent_a', format($q$SELECT public.change_saved_view(%L, '{}'::jsonb, '{}'::jsonb, '[]'::jsonb)$q$, v), closing_msg),
    ('rename a view', 'agent_a', format($q$SELECT public.rename_saved_view(%L, 'New name')$q$, v), closing_msg),
    ('delete a view', 'agent_a', format($q$SELECT public.delete_saved_view(%L)$q$, v), closing_msg),
    ('share a view', 'owner_a', format($q$SELECT public.share_saved_view(%L)$q$, vo), closing_msg),
    ('stop sharing a view', 'owner_a', format($q$SELECT public.unshare_saved_view(%L)$q$, vo), closing_msg),
    ('choose columns', 'agent_a', format($q$SELECT public.set_my_table_columns(%L, 'submissions', NULL, '["a"]'::jsonb)$q$, fa), closing_msg),
    ('review a submission field', 'agent_a', format($q$SELECT public.review_submission_field(%L, 'company_name', 'verified')$q$, s), closing_msg),
    ('set a submission''s status', 'agent_a', format($q$SELECT public.set_submission_status(%L, 'under_review')$q$, s), closing_msg),
    ('mark a submission as needing action', 'agent_a', format($q$SELECT public.set_submission_needs_action(%L, true, NULL)$q$, s), closing_msg),
    ('ask the prospect for information', 'agent_a', format($q$SELECT public.advisor_request_information(%L, 'Please send the census')$q$, s), closing_msg),
    ('record a send', 'agent_a', format($q$SELECT public.advisor_record_quote_send(%L, 'Probe PEO')$q$, s), closing_msg),
    ('update a quote request', 'agent_a', format($q$SELECT public.advisor_update_quote_request(%s, 'quoted')$q$, q), closing_msg),
    ('add a note to a quote request', 'agent_a', format($q$SELECT public.advisor_add_quote_request_note(%s, 'other', current_date, 'x')$q$, q), closing_msg),
    ('note an underwriter''s question', 'agent_a', format($q$SELECT public.advisor_note_underwriter_question(%s, 'why?')$q$, q), closing_msg),
    ('correct a note', 'agent_a', format($q$SELECT public.advisor_correct_quote_request_note(%s, 'other', current_date, 'y')$q$, note), closing_msg),
    ('issue a new reply address', 'agent_a', format($q$SELECT public.advisor_reissue_quote_request_address(%s)$q$, q), closing_msg),
    ('retry a send', 'agent_a', format($q$SELECT public.advisor_requeue_outbox_event(%L)$q$, ev), closing_msg),
    ('record a packet', 'agent_a', format($q$SELECT public.record_manuscript_version(%L, 1, %L, 'x', NULL, 0, false, 'h', now())$q$, s, s || '/p.pdf'), closing_msg),
    ('ask for an intake to be deleted, as an admin who is also a member', 'admin_member', format($q$SELECT public.request_intake_deletion(%L, 'probe')$q$, s), closing_msg),
    ('revoke an intake, as an admin who is also a member', 'admin_member', format($q$SELECT public.revoke_chamber_session(%L, 'probe')$q$, s), closing_msg),
    ('retry an intake''s deletion, as an admin who is also a member', 'admin_member', format($q$SELECT public.retry_intake_deletion(%L)$q$, pg_temp.id('deletion_a')), closing_msg),
    ('write a note on an intake', 'agent_a', format($q$INSERT INTO public.advisor_notes (session_id, author_id, body) VALUES (%L, %L, 'hi')$q$, s, pg_temp.id('agent_a')), closing_msg);
  RAISE NOTICE 'close_a_firm: % write paths listed', (SELECT count(*) FROM writes);
END $$;

DO $$
DECLARE w record; got text; n integer := 0; before jsonb := pg_temp.held(pg_temp.id('alpha'));
BEGIN
  FOR w IN SELECT * FROM writes ORDER BY label LOOP
    PERFORM pg_temp.as_user(w.who);
    got := pg_temp.refusal(w.stmt);
    RESET ROLE;
    PERFORM pg_temp.is(got, w.refusal, 'while closing: ' || w.label);
    n := n + 1;
  END LOOP;
  PERFORM pg_temp.is(n >= 35, true, 'the list of write paths has not been emptied');
  PERFORM pg_temp.is(pg_temp.held(pg_temp.id('alpha')), before, 'and nothing of the firm''s working data changed');
  PERFORM pg_temp.is((SELECT count(*) FROM public.advisor_notes WHERE session_id = pg_temp.id('intake_a')), 0::bigint, 'no note was written');
  RAISE NOTICE 'close_a_firm: every write path is refused while closing';
END $$;

-- The two storage policies a firm's members use on the manuscripts bucket. Break caught: a member of a closing firm stores a generated
-- file in its intake's folder, or removes one that no packet records (a policy's refusal is a row it will not insert, or none deleted).
DO $$
DECLARE s uuid := pg_temp.id('intake_a');
BEGIN
  RESET ROLE;
  INSERT INTO storage.objects (bucket_id, name) VALUES ('manuscripts', s || '/unrecorded.pdf');
  PERFORM pg_temp.as_user('agent_a');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO storage.objects (bucket_id, name) VALUES ('manuscripts', %L)$q$, s || '/new.pdf')), '42501', 'a member of a closing firm cannot store a generated file');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$DELETE FROM storage.objects WHERE bucket_id = 'manuscripts' AND name = %L$q$, s || '/unrecorded.pdf')), 'rows:0', 'nor remove an unrecorded one');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM storage.objects WHERE bucket_id = 'manuscripts' AND name = s || '/unrecorded.pdf'), 1::bigint, 'it is still there');
END $$;

-- Break caught: a person who is no member of the closing firm is told it is closing by the refusal (the answer must be the one they get
-- for any firm), or the guard stops a member of another firm who acts on theirs.
DO $$
DECLARE fa uuid := pg_temp.id('alpha'); fb uuid := pg_temp.id('beta');
BEGIN
  PERFORM pg_temp.as_user('owner_b');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.invite_member(%L, 'new@example.test', 'agent', NULL, %L)$q$, fa, pg_temp.hash('y1'))), '42501: Only an owner of the firm can invite people',
    'another firm''s owner gets the ordinary refusal, not "closing"');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.invite_member(%L, 'new@example.test', 'agent', NULL, %L)$q$, fb, pg_temp.hash('y2'))), 'rows:1', 'and acts on their own firm as always');
  PERFORM pg_temp.as_user('both');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.advisor_add_referral_partner('both-code', 'Both', 'accounting', %L)$q$, fb)), 'rows:1',
    'a member of both firms can still change the firm that is not closing');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.advisor_add_referral_partner('both-code2', 'Both', 'accounting', %L)$q$, fa)), 'PT423: This firm is closing and can''t be changed',
    'and not the one that is');
  PERFORM pg_temp.as_user('outsider');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.advisor_add_referral_partner('x', 'X', 'accounting', %L)$q$, fa)), '42501: Advisor access required', 'a stranger gets the ordinary refusal');
  RESET ROLE;
  RAISE NOTICE 'close_a_firm: closing does not leak or spread';
END $$;

-- ---------- a mailbox, and held mail ----------
-- Break caught: while the firm is closing a member's mailbox is still read for sending, or one is connected anew (nothing is sent as a
-- member of a closing firm); a member moves mail off a thread of the firm, or an admin assigns mail held for it, or puts any held mail
-- onto its thread; a member of another firm too has their mailbox taken (they can still send as the firm that is open).
DO $$
DECLARE fa uuid := pg_temp.id('alpha'); q bigint := current_setting('test.quote_a')::bigint; agent uuid := pg_temp.id('agent_a'); admin uuid := pg_temp.id('platform_admin');
  m_thread bigint; m_held bigint; m_nobody bigint; closing_msg text := '55000: This firm is closing and can''t be changed';
BEGIN
  RESET ROLE;
  SELECT id INTO m_thread FROM public.quote_request_messages WHERE provider_message_id = 'thread-1';
  SELECT id INTO m_held FROM public.quote_request_messages WHERE provider_message_id = 'held-1';
  INSERT INTO public.quote_request_messages (provider_message_id, held_reason, direction, from_address)
    VALUES ('nobody-1', 'unknown_address', 'received', 'peo@example.test') RETURNING id INTO m_nobody;
  PERFORM set_config('test.m_thread', m_thread::text, false);
  PERFORM set_config('test.m_held', m_held::text, false);
  PERFORM set_config('test.m_nobody', m_nobody::text, false);
  SET LOCAL ROLE service_role;
  PERFORM pg_temp.is(public.mailbox_secret(agent) IS NULL, true, 'nothing is read to send as an agent of the closing firm');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.mailbox_store(%L, 'google', 'x@example.test', 'gmail.send', 'c', 'i')$q$, agent)), '42501: Only a member of a firm can connect a mailbox',
    'and no mailbox is connected for them');
  PERFORM pg_temp.is(public.mailbox_secret(pg_temp.id('both')) IS NOT NULL, true, 'a member of the closing firm and of another can still send as the other');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.apply_mail_move(%s, NULL, %L, NULL)$q$, m_thread, agent)), closing_msg, 'a member cannot move mail off a thread of the firm');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.plan_mail_move(%s, NULL, %L)$q$, m_thread, agent)), closing_msg, 'nor plan to');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.apply_mail_move(%s, %s, %L, NULL)$q$, m_held, q, admin, NULL)), closing_msg, 'mail held for the firm is not assigned by an admin');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.plan_mail_move(%s, %s, %L)$q$, m_held, q, admin)), closing_msg, 'nor planned to be');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.apply_mail_move(%s, %s, %L, NULL)$q$, m_nobody, q, admin)), closing_msg, 'mail held for no firm is not put onto the closing firm''s thread');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT quote_request_id IS NULL FROM public.quote_request_messages WHERE id = m_held), true, 'held mail is still held');
  PERFORM pg_temp.is((SELECT count(*) FROM public.broker_mailboxes WHERE user_id = agent), 1::bigint, 'the mailbox itself is kept');
  RAISE NOTICE 'close_a_firm: mailbox and held mail cases passed';
END $$;

-- ---------- what still works while the firm is closing ----------
-- Break caught: reading is refused or changed; a member's sign-in or opening of a submission is not written to the firm's record; a
-- member cannot leave; the last owner of a firm can leave by the closing's door; inbound PEO mail is no longer received.
DO $$
DECLARE fa uuid := pg_temp.id('alpha'); fo uuid := pg_temp.id('omega'); s uuid := pg_temp.id('intake_a'); q bigint := current_setting('test.quote_a')::bigint;
  local text; res jsonb; before bigint;
BEGIN
  PERFORM pg_temp.as_user('agent_a');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_sessions), 2::bigint, 'a member reads the firm''s intakes');
  PERFORM pg_temp.is((SELECT count(*) FROM public.advisor_list_submissions(NULL, NULL, 500, 0, NULL, NULL, NULL)), 2::bigint, 'the queue lists them');
  PERFORM pg_temp.is((SELECT count(*) FROM public.my_firms()), 1::bigint, 'the console lists the firm');
  PERFORM pg_temp.is((SELECT count(*) FROM public.referral_partners), 1::bigint, 'and the firm''s referral partners');
  PERFORM pg_temp.is((SELECT count(*) FROM public.list_saved_views(pg_temp.id('alpha'), 'submissions')), 1::bigint, 'and the saved views');
  PERFORM pg_temp.as_user('owner_a');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_members(fa)) > 0, true, 'an owner reads the members');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_pending_invitations(fa)), 1::bigint, 'the invitations');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity_list(fa, NULL, NULL, 50, NULL, NULL, false)) > 0, true, 'and the firm''s record');

  RESET ROLE;
  before := (SELECT count(*) FROM public.firm_activity WHERE firm_id = fa);
  PERFORM pg_temp.as_user('agent_a');
  PERFORM public.record_member_activity('sign_in', 'firm', fa::text);
  PERFORM pg_temp.is((SELECT count(*) FROM public.open_submission(s)), 1::bigint, 'a member opens a submission');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.advisor_open_quote_request_thread(%s)$q$, q)), 'rows:1', 'and a thread, which only marks it read');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE firm_id = fa), before + 2, 'the sign-in and the opening are written to the firm''s record');

  -- Inbound PEO mail is received and threaded as before.
  SET LOCAL ROLE service_role;
  local := (SELECT a.local_part FROM public.issue_quote_request_address(q) a);
  res := public.record_inbound_mail('inbound-1', ARRAY[local], 'peo@example.test', 'A PEO', ARRAY['x@example.test'], ARRAY[]::text[], 'Quote', 'text', false, '{}'::jsonb, false, now());
  RESET ROLE;
  PERFORM pg_temp.is((res ->> 'held')::boolean, false, 'mail from a PEO is still threaded onto the quote request');
  PERFORM pg_temp.is(res ->> 'quote_request_id', q::text, 'the right one');

  -- A member leaves a closing firm (CRM-P1.6): it is not a change the closing forbids, and the last owner still cannot go.
  PERFORM pg_temp.as_user('leaver');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.leave_firm(%L)$q$, fa)), 'ok', 'a member can leave a closing firm');
  PERFORM pg_temp.as_user('owner_w');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.leave_firm(%L)$q$, fo)), '23514: You are the last owner of this firm, so you can''t leave it. Make someone else an owner first.',
    'the last owner of a closing firm still cannot leave it');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE firm_id = fa AND kind = 'member_left'), 1::bigint, 'the leaving is in the firm''s record');
  PERFORM pg_temp.is((SELECT count(*) FROM public.outbox_events WHERE kind = 'member_left' AND firm_id = fa), 1::bigint, 'and the owners are told');
  RAISE NOTICE 'close_a_firm: what still works passed';
END $$;

-- ---------- withdrawing ----------
-- Break caught: an agent, another firm's owner, a stranger, a signed-out visitor or a platform admin withdraws the request; a withdrawal
-- by one owner is refused because another owner asked; it is not in the firm's record or the owners are not emailed; the firm is not as it
-- was afterwards (a write path still refused, or data changed); the same request is withdrawn twice; the firm cannot ask again later.
DO $$
DECLARE fa uuid := pg_temp.id('alpha'); before jsonb := pg_temp.held(pg_temp.id('alpha')); w record; got text; n integer := 0;
BEGIN
  PERFORM pg_temp.as_user('agent_a');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.withdraw_firm_closure(%L)$q$, fa)), '42501', 'an agent cannot withdraw it');
  PERFORM pg_temp.as_user('owner_b');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.withdraw_firm_closure(%L)$q$, fa)), '42501', 'nor another firm''s owner');
  PERFORM pg_temp.as_user('outsider');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.withdraw_firm_closure(%L)$q$, fa)), '42501', 'nor a stranger');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.withdraw_firm_closure(%L)$q$, fa)), '42501', 'nor a platform admin on its behalf');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.withdraw_firm_closure(%L)$q$, fa)), '42501', 'nor a signed-out visitor');
  PERFORM pg_temp.as_user('owner_b');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.withdraw_firm_closure(%L)$q$, pg_temp.id('beta'))), 'PT409', 'a firm that is not closing has nothing to withdraw');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_closures WHERE firm_id = fa AND withdrawn_at IS NULL AND closed_at IS NULL), 1::bigint, 'the request is still open');

  PERFORM pg_temp.as_user('owner_a2');
  PERFORM public.withdraw_firm_closure(fa);
  RESET ROLE;
  PERFORM pg_temp.is((SELECT withdrawn_by FROM public.firm_closures WHERE firm_id = fa AND asked_by IS NOT NULL), pg_temp.id('owner_a2'), 'another owner withdrew it, and the record says who');
  PERFORM pg_temp.is((SELECT asked_by FROM public.firm_closures WHERE firm_id = fa AND asked_by IS NOT NULL), pg_temp.id('owner_a'), 'and who asked');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE firm_id = fa AND kind = 'closure_withdrawn' AND actor_id = pg_temp.id('owner_a2')), 1::bigint, 'withdrawing is in the firm''s record');
  PERFORM pg_temp.is((SELECT count(*) FROM public.outbox_events WHERE kind = 'firm_closing' AND firm_id = fa AND payload ->> 'event' = 'withdrawn' AND status = 'pending'), 1::bigint, 'and the owners are emailed');
  PERFORM pg_temp.is((SELECT string_agg(k, ',' ORDER BY k) FROM public.outbox_events e, jsonb_object_keys(e.payload) k WHERE e.kind = 'firm_closing' AND e.firm_id = fa AND e.payload ->> 'event' = 'withdrawn'), 'by_email,event,firm_name',
    'the withdrawal email holds who, which firm and what happened');
  PERFORM pg_temp.is(public.firm_is_read_only(fa), false, 'the firm is no longer read-only');
  PERFORM pg_temp.as_user('owner_a2');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.withdraw_firm_closure(%L)$q$, fa)), 'PT409', 'a withdrawn request is not withdrawn twice');
  PERFORM pg_temp.is((SELECT count(*) FROM public.my_firm_closure(fa) c WHERE c.closes_at IS NOT NULL), 0::bigint, 'and no banner is shown');
  PERFORM pg_temp.is((SELECT c.can_ask FROM public.my_firm_closure(fa) c), true, 'and an owner may ask again');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.held(fa), before, 'nothing of the firm''s was deleted');

  -- The firm is as it was: every path refused above is no longer refused for closing.
  FOR w IN SELECT * FROM writes ORDER BY label LOOP
    PERFORM pg_temp.as_user(w.who);
    got := pg_temp.attempt(w.stmt);
    RESET ROLE;
    PERFORM pg_temp.is(got <> 'PT423', true, 'after withdrawing: ' || w.label || ' (gave ' || got || ')');
    n := n + 1;
  END LOOP;
  PERFORM pg_temp.as_user('agent_a');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO storage.objects (bucket_id, name) VALUES ('manuscripts', %L)$q$, pg_temp.id('intake_a') || '/new.pdf')), 'rows:1', 'after withdrawing a member stores a generated file again');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$DELETE FROM storage.objects WHERE bucket_id = 'manuscripts' AND name = %L$q$, pg_temp.id('intake_a') || '/unrecorded.pdf')), 'rows:1', 'and removes an unrecorded one');
  RESET ROLE;
  SET LOCAL ROLE service_role;
  PERFORM pg_temp.is(public.mailbox_secret(pg_temp.id('agent_a')) IS NOT NULL, true, 'a member''s mailbox is read for sending again');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.plan_mail_move(%s, NULL, %L)$q$, current_setting('test.m_thread'), pg_temp.id('agent_a'))), 'rows:1', 'and mail can be moved again');
  RESET ROLE;
  RAISE NOTICE 'close_a_firm: withdrawing passed (% paths tried again)', n;
END $$;

-- Break caught: asking to join a closing firm records a request nobody can act on (it must answer "none", as for a suspended firm); the
-- same person asking once the firm is open again is not listed (the control).
DO $$
DECLARE fa uuid := pg_temp.id('alpha'); joiner uuid := pg_temp.id('joiner'); res text;
BEGIN
  RESET ROLE;
  DELETE FROM public.join_requests WHERE firm_id = fa;
  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
    VALUES (gen_random_uuid()::text, joiner, '{"email": "joiner@alpha.example", "email_verified": true, "hd": "alpha.example"}', 'google', now(), now());
  PERFORM pg_temp.as_user('joiner');
  PERFORM pg_temp.is(public.ask_to_join_firm('alpha-brokers'), 'asked', 'control: an open firm takes a request from a listed organisation');
  RESET ROLE;
  DELETE FROM public.join_requests WHERE firm_id = fa;
  PERFORM pg_temp.as_user('owner_a');
  PERFORM public.request_firm_closure(fa, 'Alpha Brokers');
  PERFORM pg_temp.as_user('joiner');
  PERFORM pg_temp.is(public.ask_to_join_firm('alpha-brokers'), 'none', 'a closing firm takes none');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.join_requests WHERE firm_id = fa), 0::bigint, 'and none is recorded');
  RAISE NOTICE 'close_a_firm: asking to join passed';
END $$;

-- ---------- the last owner's rule outside the closing ----------
-- Break caught: the exception that lets a closing end its last owner is reachable some other way: by a person leaving, by an owner
-- removing the last owner, by the raw update, or by naming a firm that is closing but is not yet due.
DO $$
DECLARE fb uuid := pg_temp.id('beta'); fa uuid := pg_temp.id('alpha');
BEGIN
  PERFORM pg_temp.as_user('owner_b');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.leave_firm(%L)$q$, fb)), '23514: You are the last owner of this firm, so you can''t leave it. Make someone else an owner first.',
    'the last owner of a firm that is not closing cannot leave');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.firm_memberships SET valid_until = now() WHERE firm_id = %L AND role = 'owner'$q$, fb)), '23514', 'nor be ended by an update');
  -- Naming the firm in the setting does nothing without a due, open request.
  PERFORM set_config('nevermore.closing_firm', fb::text, true);
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.firm_memberships SET valid_until = now() WHERE firm_id = %L AND role = 'owner'$q$, fb)), '23514',
    'not even with the closing''s setting named for the firm: it has no request');
  PERFORM set_config('nevermore.closing_firm', fa::text, true);
  PERFORM pg_temp.is(public.firm_is_being_closed(fa), false, 'a firm whose 30 days have not ended is not being closed, whatever the setting says');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.firm_memberships SET valid_until = now() WHERE firm_id = %L AND role = 'owner'$q$, fa)), '23514',
    'so its last owners cannot be ended before the day either');
  PERFORM set_config('nevermore.closing_firm', '', true);
  RAISE NOTICE 'close_a_firm: last owner cases passed';
END $$;

-- ---------- closing, before and after the 30 days ----------
-- Break caught: a firm is closed before its 30 days end, by the job or by a direct call; a platform admin or a firm's owner can call the
-- closing; a suspended firm's request does not run out (the clock keeps running, and its owners can't withdraw: they get nothing); the
-- job closes a firm that is not due.
DO $$
DECLARE fa uuid := pg_temp.id('alpha'); fg uuid := pg_temp.id('gamma'); fo uuid := pg_temp.id('omega');
BEGIN
  PERFORM pg_temp.as_user('owner_g');
  PERFORM public.request_firm_closure(fg, 'Gamma Group');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_suspend_firm(fg, 'Unpaid invoice');
  PERFORM pg_temp.as_user('owner_g');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.withdraw_firm_closure(%L)$q$, fg)), '42501', 'the owner of a closing firm that is suspended cannot withdraw (they get nothing while it is suspended)');
  RESET ROLE;
  SET LOCAL ROLE service_role;
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.close_firm_now(%L)$q$, fa)), '55000', 'a firm is not closed before its 30 days end');
  PERFORM pg_temp.is(public.close_due_firms(), 0, 'and the daily job closes none that is not due');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.close_firm_now(%L)$q$, pg_temp.id('beta'))), 'PT404', 'a firm with no request is not closed');
  RESET ROLE;
  PERFORM pg_temp.is(has_function_privilege('authenticated', 'public.close_firm_now(uuid)', 'EXECUTE'), false, 'no signed-in person can call the closing');
  PERFORM pg_temp.is(has_function_privilege('anon', 'public.close_firm_now(uuid)', 'EXECUTE'), false, 'nor a visitor');
  PERFORM pg_temp.is(has_function_privilege('authenticated', 'public.close_due_firms()', 'EXECUTE'), false, 'nor the daily step');
  PERFORM pg_temp.is(has_function_privilege('service_role', 'public.close_due_firms()', 'EXECUTE'), true, 'the service role can');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.firm_closures'), 'rows:' || (SELECT count(*) FROM public.firm_closures), 'control: the table owner reads it');
  PERFORM pg_temp.as_user('owner_a');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.firm_closures'), '42501', 'the platform''s record is closed to the API: a firm''s owner reads none of it');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.firm_closures'), '42501', 'an admin reads it through the function only');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.firm_closures SET closes_at = now() WHERE firm_id = %L$q$, fa)), '42501', 'and changes none of it');
  RESET ROLE;
  RAISE NOTICE 'close_a_firm: before the 30 days passed';
END $$;

-- Before the day: what alpha holds, and what beta holds (it must be untouched after).
CREATE TEMP TABLE snap (k text PRIMARY KEY, v jsonb);
DO $$
DECLARE fa uuid := pg_temp.id('alpha'); fb uuid := pg_temp.id('beta'); s uuid := pg_temp.id('intake_a');
BEGIN
  RESET ROLE;
  INSERT INTO snap VALUES ('alpha_held', pg_temp.held(fa)), ('beta_held', pg_temp.held(fb));
  INSERT INTO snap VALUES ('intakes_a', to_jsonb((SELECT count(*) FROM public.chamber_sessions WHERE firm_id = fa))),
    ('quotes_a', to_jsonb((SELECT count(*) FROM public.quote_requests WHERE session_id = s))),
    ('messages_a', to_jsonb((SELECT count(*) FROM public.quote_request_messages WHERE session_id = s OR firm_id = fa))),
    ('memberships_a', to_jsonb((SELECT count(*) FROM public.firm_memberships WHERE firm_id = fa))),
    ('activity_a', to_jsonb((SELECT count(*) FROM public.firm_activity WHERE firm_id = fa)));
  -- Both of alpha's due requests are now past their 30 days (omega's is not).
  PERFORM pg_temp.age_request(fa, 31);
  PERFORM pg_temp.age_request(pg_temp.id('gamma'), 31);
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_closures WHERE withdrawn_at IS NULL AND closed_at IS NULL AND closes_at <= now()), 2::bigint, 'two requests are due');
END $$;

-- Between the 30 days ending and the job running the firm stays read-only, and withdrawing is too late.
-- Break caught: the firm is changeable again once the date passes though the job has not run; an owner withdraws after the 30 days.
DO $$
DECLARE fa uuid := pg_temp.id('alpha');
BEGIN
  PERFORM pg_temp.as_user('owner_a');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.withdraw_firm_closure(%L)$q$, fa)), 'PT409', 'an owner cannot withdraw once the 30 days have ended');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.advisor_add_referral_partner('late', 'Late', 'accounting', %L)$q$, fa)), 'PT423: This firm is closing and can''t be changed', 'and the firm is still read-only until the job runs');
  PERFORM pg_temp.is((SELECT count(*) FROM public.my_firm_closure(fa)), 1::bigint, 'with its banner');
  RESET ROLE;
  RAISE NOTICE 'close_a_firm: the gap before the job passed';
END $$;

-- ---------- the daily job ----------
-- Break caught: the job closes the wrong firms (omega is not due; beta has no request); it closes a firm that is suspended (the firm
-- would be deleted mid-investigation, with its owners unable to withdraw); it closes one and stops.
DO $$
DECLARE closed integer;
BEGIN
  SET LOCAL ROLE service_role;
  closed := public.close_due_firms();
  RESET ROLE;
  PERFORM pg_temp.is(closed, 1, 'the job closes the one due firm that is not suspended');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_closures WHERE closed_at IS NOT NULL), 1::bigint, 'and no others');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_closures WHERE firm_id = pg_temp.id('omega') AND closed_at IS NULL AND withdrawn_at IS NULL), 1::bigint, 'omega is still waiting out its 30 days');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_closures WHERE firm_id = pg_temp.id('gamma') AND closed_at IS NULL AND withdrawn_at IS NULL), 1::bigint, 'gamma, due but suspended, is not closed and its request stays open');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_memberships WHERE firm_id = pg_temp.id('gamma') AND public.membership_is_current(valid_from, valid_until)), 1::bigint, 'and its owner is still a member, as the suspension left it');
  SET LOCAL ROLE service_role;
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.close_firm_now(%L)$q$, pg_temp.id('gamma'))), '55000: A suspended firm is not closed', 'closing it by hand is refused too');
  PERFORM pg_temp.is(public.close_due_firms(), 0, 'running the job again closes nothing');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.close_firm_now(%L)$q$, pg_temp.id('alpha'))), 'PT404', 'and a closed firm is not closed twice');
  RESET ROLE;
  RAISE NOTICE 'close_a_firm: the job passed';
END $$;

-- ---------- lifting a suspension gives the owners seven days ----------
-- Break caught: lifting a suspension of a firm whose request is overdue lets the job close it that night, before its owners can see the banner;
-- the date is moved even when it was later already; the grace is given to a firm with no request.
DO $$
DECLARE fg uuid := pg_temp.id('gamma'); before_date timestamptz; later timestamptz;
BEGIN
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_lift_firm_suspension(fg);
  RESET ROLE;
  PERFORM pg_temp.is((SELECT closes_at >= now() + interval '7 days' - interval '1 minute' FROM public.firm_closures WHERE firm_id = fg AND closed_at IS NULL AND withdrawn_at IS NULL), true,
    'the date is seven days from the lift');
  SET LOCAL ROLE service_role;
  PERFORM pg_temp.is(public.close_due_firms(), 0, 'so the job does not close it that night');
  RESET ROLE;
  PERFORM pg_temp.as_user('owner_g');
  PERFORM pg_temp.is((SELECT c.closes_at >= now() + interval '7 days' - interval '1 minute' FROM public.my_firm_closure(fg) c), true, 'and its owner is shown that date');
  RESET ROLE;
  -- A request whose date was already later keeps it.
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_suspend_firm(fg, 'Again');
  RESET ROLE;
  UPDATE public.firm_closures SET closes_at = now() + interval '20 days' WHERE firm_id = fg AND closed_at IS NULL AND withdrawn_at IS NULL;
  before_date := (SELECT closes_at FROM public.firm_closures WHERE firm_id = fg AND closed_at IS NULL AND withdrawn_at IS NULL);
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_lift_firm_suspension(fg);
  RESET ROLE;
  later := (SELECT closes_at FROM public.firm_closures WHERE firm_id = fg AND closed_at IS NULL AND withdrawn_at IS NULL);
  PERFORM pg_temp.is(later, before_date, 'a date already later than seven days off is kept');
  -- A firm with no request gets nothing written.
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_suspend_firm(pg_temp.id('beta'), 'Brief');
  PERFORM public.admin_lift_firm_suspension(pg_temp.id('beta'));
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_closures WHERE firm_id = pg_temp.id('beta') AND closed_at IS NULL AND withdrawn_at IS NULL), 0::bigint, 'lifting a suspension of a firm that is not closing starts no request');
  -- Its owner can withdraw now; do, so gamma is open for the rest.
  PERFORM pg_temp.as_user('owner_g');
  PERFORM public.withdraw_firm_closure(fg);
  RESET ROLE;
  PERFORM pg_temp.is(public.firm_is_read_only(fg), false, 'and the owner then withdrew it');
  RAISE NOTICE 'close_a_firm: the grace after a suspension passed';
END $$;

-- ---------- a firm that fails to close is seen ----------
-- Break caught: the job logs a warning nobody reads, so a firm that fails every day goes unseen: it must write an ops event with a code and
-- the firm's id and no content; it leaves half a closing behind after the failure; a failure stops the other firms.
CREATE FUNCTION pg_temp.refuse_team_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced failure'; END $$;
DO $$
DECLARE fe uuid; closed integer;
BEGIN
  RESET ROLE;
  fe := pg_temp.make_closing_firm('Epsilon Partners', 'epsilon-partners', 'owner_e', true, false);
  INSERT INTO public.firm_teams (firm_id, name) VALUES (fe, 'Epsilon team');
  CREATE TRIGGER force_failure BEFORE DELETE ON public.firm_teams FOR EACH ROW EXECUTE FUNCTION pg_temp.refuse_team_delete();
  SET LOCAL ROLE service_role;
  closed := public.close_due_firms();
  RESET ROLE;
  PERFORM pg_temp.is(closed, 0, 'a firm that fails is not counted as closed');
  PERFORM pg_temp.is((SELECT count(*) FROM public.ops_events WHERE kind = 'app_error' AND source = 'close-firms' AND code = 'firm_close_failed' AND detail = 'could not close a firm' AND session_id = fe), 1::bigint,
    'it is an ops event with a code and the firm, for the monitoring page');
  PERFORM pg_temp.is((SELECT length(detail) FROM public.ops_events WHERE code = 'firm_close_failed'), length('could not close a firm'), 'with nothing else in it');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_memberships WHERE firm_id = fe AND public.membership_is_current(valid_from, valid_until)), 1::bigint, 'nothing was left half done');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_closures WHERE firm_id = fe AND closed_at IS NULL AND withdrawn_at IS NULL), 1::bigint, 'and the request is still open, to be tried tomorrow');
  DROP TRIGGER force_failure ON public.firm_teams;
  SET LOCAL ROLE service_role;
  PERFORM pg_temp.is(public.close_due_firms(), 1, 'tomorrow it closes');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.ops_events WHERE code = 'firm_close_failed'), 1::bigint, 'with no further event');
  -- A closed firm that was never approved can't be decided on afterwards, and no closed firm is suspended.
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.admin_decide_firm(%L, true, NULL)$q$, fe)), '55000: That firm is closed', 'an admin cannot approve a closed firm');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.admin_suspend_firm(%L, 'late')$q$, fe)), '55000: That firm is closed', 'nor suspend it');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.admin_suspend_firm(%L, 'late')$q$, pg_temp.id('beta'))), 'ok', 'control: a firm that is not closed can still be suspended');
  PERFORM public.admin_lift_firm_suspension(pg_temp.id('beta'));
  RESET ROLE;
  RAISE NOTICE 'close_a_firm: a failing firm is seen';
END $$;

-- ---------- Nevermore stops a closing ----------
-- Break caught: a firm suspended for investigation is deleted because its owners can't withdraw and nobody else can stop it; the stop is
-- possible for someone who is not a platform admin, or for a firm the admin belongs to; it is not in the firm's record as Nevermore's,
-- or shows who at Nevermore or why; the owners are not told, or told the reason; the firm stays read-only; a platform admin could ask.
DO $$
DECLARE fd uuid; c public.firm_closures;
BEGIN
  RESET ROLE;
  fd := pg_temp.make_closing_firm('Delta Dealers Co', 'delta-dealers-co', 'owner_dl', false);
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_suspend_firm(fd, 'Under investigation');
  PERFORM pg_temp.as_user('owner_dl');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.withdraw_firm_closure(%L)$q$, fd)), '42501', 'the owner of a suspended firm cannot withdraw');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.admin_stop_firm_closure(%L, 'mine')$q$, fd)), '42501', 'nor stop it: not a platform admin');
  PERFORM pg_temp.as_user('agent_a');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.admin_stop_firm_closure(%L, 'x')$q$, fd)), '42501', 'nor an agent of another firm');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.admin_stop_firm_closure(%L, 'x')$q$, fd)), '42501', 'nor a visitor');
  RESET ROLE;
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (fd, pg_temp.id('admin_member'), 'agent');
  PERFORM pg_temp.as_user('admin_member');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.admin_stop_firm_closure(%L, 'x')$q$, fd)), '42501', 'an admin does not stop the closing of a firm they belong to');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.admin_stop_firm_closure(%L, '  ')$q$, fd)), '22023', 'a reason is required');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.admin_stop_firm_closure(gen_random_uuid(), 'x')$q$), 'PT404', 'for a firm that exists');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.admin_stop_firm_closure(%L, 'x')$q$, pg_temp.id('beta'))), 'PT409', 'and that is closing');
  PERFORM public.admin_stop_firm_closure(fd, '  Under investigation  ');
  RESET ROLE;
  SELECT * INTO c FROM public.firm_closures WHERE firm_id = fd;
  PERFORM pg_temp.is(c.withdrawn_at IS NOT NULL AND c.closed_at IS NULL, true, 'the request is over');
  PERFORM pg_temp.is(c.withdrawn_by IS NULL AND c.stopped_by = pg_temp.id('platform_admin') AND c.stop_reason = 'Under investigation', true, 'as stopped by Nevermore: who and why are the platform''s record');
  PERFORM pg_temp.is(public.firm_is_read_only(fd), false, 'the firm is not read-only any more');
  PERFORM pg_temp.is((SELECT actor_is_staff FROM public.firm_activity WHERE firm_id = fd AND kind = 'closure_stopped'), true, 'the firm''s record shows it as Nevermore''s (D-33)');
  PERFORM pg_temp.is((SELECT string_agg(k, ',' ORDER BY k) FROM public.outbox_events e, jsonb_object_keys(e.payload) k WHERE e.firm_id = fd AND e.payload ->> 'event' = 'stopped'), 'event,firm_name',
    'the owners are emailed that it was stopped, with no person and no reason');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.admin_stop_firm_closure(%L, 'again')$q$, fd)), 'PT409', 'a stopped request is not stopped twice');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.request_firm_closure(%L, 'Delta Dealers Co')$q$, fd)), '42501', 'a platform admin still cannot ask to close it');
  PERFORM public.admin_lift_firm_suspension(fd);
  PERFORM pg_temp.as_user('owner_dl');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.advisor_add_referral_partner('delta', 'Delta', 'accounting', %L)$q$, fd)), 'rows:1', 'its owner can change the firm again');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.request_firm_closure(%L, 'Delta Dealers Co')$q$, fd)), 'rows:1', 'and ask again later');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is((SELECT count(*) FROM public.admin_firm_states() s WHERE s.firm_id = fd AND s.closing_on IS NULL), 1::bigint, 'the platform page no longer shows it as closing');
  RESET ROLE;
  RAISE NOTICE 'close_a_firm: stopping a closing passed';
END $$;

-- ---------- withdrawing and closing at the same moment (D-32) ----------
-- The firm's row lock (taken first by the withdrawal and by the closing) and the time conditions order a withdrawal against the closing. A request whose 30 days end in two seconds is
-- withdrawn in one session, which holds its transaction open past that moment; the job's closing, in another, then must wait and find the
-- request withdrawn: nothing is deleted. Without the lock the closing does its deleting first and is only stopped at the end by a
-- check constraint, with a different error. (The other orderings on the firm's row are tested in close_a_firm_races.sql.)
CREATE SCHEMA race;
CREATE EXTENSION dblink SCHEMA race;
DO $$
DECLARE fz uuid;
BEGIN
  RESET ROLE;
  INSERT INTO public.firms (name, address, approved_at, decision, decided_at) VALUES ('Zeta Race Co', 'zeta-race-co', now(), 'approved', now()) RETURNING id INTO fz;
  INSERT INTO fx VALUES ('zeta', fz);
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (fz, pg_temp.id('owner_z'), 'owner');
  INSERT INTO public.firm_invitations (firm_id, email, role, token_hash, expires_at) VALUES (fz, 'z@example.test', 'agent', pg_temp.hash('zeta'), now() + interval '7 days');
  INSERT INTO public.firm_closures (firm_id, asked_at, asked_by, closes_at) VALUES (fz, now() - interval '1 day', pg_temp.id('owner_z'), now() + interval '2 seconds');
END $$;

DO $$
DECLARE
  fz uuid := pg_temp.id('zeta');
  dsn text := format('dbname=%s user=%s port=%s host=%s', current_database(), session_user, current_setting('port'),
    split_part(current_setting('unix_socket_directories'), ',', 1));
  as_owner text := format($q$SELECT set_config('request.jwt.claims', %L, true)$q$,
    jsonb_build_object('sub', pg_temp.id('owner_z'), 'role', 'authenticated', 'is_anonymous', false, 'email', 'owner_z@example.test')::text);
  second_pid integer; tries integer := 0; s text; m text;
BEGIN
  PERFORM race.dblink_connect('race_withdraw', dsn);
  PERFORM race.dblink_connect('race_close', dsn);
  PERFORM race.dblink_exec('race_close', 'SET lock_timeout = ''20s''');
  SELECT pid INTO second_pid FROM race.dblink('race_close', 'SELECT pg_backend_pid()') AS t(pid integer);
  PERFORM race.dblink_exec('race_withdraw', 'BEGIN');
  PERFORM race.dblink_exec('race_withdraw', 'SET LOCAL ROLE authenticated');
  PERFORM * FROM race.dblink('race_withdraw', as_owner) AS t(c text);
  PERFORM * FROM race.dblink('race_withdraw', format($q$SELECT public.withdraw_firm_closure(%L)::text$q$, fz)) AS t(r text);
  PERFORM pg_sleep(2.5);
  PERFORM race.dblink_exec('race_close', 'BEGIN');
  PERFORM race.dblink_send_query('race_close', format($q$SELECT public.close_firm_now(%L)::text$q$, fz));
  WHILE cardinality(pg_blocking_pids(second_pid)) = 0 LOOP
    tries := tries + 1;
    IF tries > 400 THEN RAISE EXCEPTION 'FAIL: the closing never waited for the withdrawal'; END IF;
    PERFORM pg_sleep(0.05);
  END LOOP;
  PERFORM race.dblink_exec('race_withdraw', 'COMMIT');
  BEGIN
    PERFORM * FROM race.dblink_get_result('race_close') AS t(r text);
    RAISE EXCEPTION 'FAIL: the firm was closed after its request was withdrawn';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT;
    IF s <> 'PT404' THEN RAISE EXCEPTION 'FAIL: the closing gave % (%), expected PT404', s, m; END IF;
  END;
  PERFORM race.dblink_disconnect('race_withdraw');
  BEGIN PERFORM race.dblink_exec('race_close', 'ROLLBACK'); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM race.dblink_disconnect('race_close');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_invitations WHERE firm_id = fz), 1::bigint, 'nothing of the firm was deleted');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_closures WHERE firm_id = fz AND withdrawn_at IS NOT NULL AND closed_at IS NULL), 1::bigint, 'and the request is withdrawn, not closed');
  RAISE NOTICE 'close_a_firm: two-session withdraw and close race passed';
END $$;

-- ---------- what was deleted ----------
-- Break caught: something of the firm's is left behind (each table the closing deletes is checked, from the same list the closing reads);
-- something of the other firm is deleted with it; a count in the record is wrong.
DO $$
DECLARE fa uuid := pg_temp.id('alpha'); fb uuid := pg_temp.id('beta'); c public.firm_closures; step record; zero jsonb := '{}'::jsonb;
BEGIN
  RESET ROLE;
  FOR step IN SELECT p.src FROM public.firm_closing_plan() p WHERE p.action = 'delete' LOOP
    zero := zero || jsonb_build_object(substr(step.src, 8), 0);
  END LOOP;
  PERFORM pg_temp.is(pg_temp.held(fa), zero, 'every table the closing deletes holds nothing of the firm''s now');
  PERFORM pg_temp.is(pg_temp.held(fb), (SELECT v FROM snap WHERE k = 'beta_held'), 'the other firm''s are as they were');
  SELECT * INTO c FROM public.firm_closures WHERE firm_id = fa AND closed_at IS NOT NULL;
  PERFORM pg_temp.is(c.closed_at IS NOT NULL AND c.withdrawn_at IS NULL, true, 'the request is closed');
  PERFORM pg_temp.is(c.asked_by, pg_temp.id('owner_a'), 'it still says who asked');
  PERFORM pg_temp.is(c.address, 'alpha-brokers', 'and which address the firm held');
  PERFORM pg_temp.is(c.deleted_counts, jsonb_build_object(
    'firm_invitations', 1, 'firm_organisations', 1, 'join_requests', 0, 'table_preferences', 1, 'saved_views', 2, 'record_history', 1, 'referral_partners', 1, 'firm_teams', 1,
    'memberships_ended', 7, 'member_suspensions_ended', 1, 'broker_mailboxes', 2, 'alerts_cancelled', 7), 'a count per table of what was deleted');
  PERFORM pg_temp.is(7::bigint, (SELECT count(*) FROM public.outbox_events e WHERE e.last_error = 'cancelled: the firm closed' AND e.dedupe_key <> 'late-alert'
    AND COALESCE(e.firm_id, (SELECT cs.firm_id FROM public.chamber_sessions cs WHERE cs.id = e.session_id)) = fa), 'and the count is the alerts that were waiting: the one alert, three of the owners'' emails, the leaving notice and two mail notices');
  PERFORM pg_temp.is((SELECT bool_and(jsonb_typeof(v) = 'number') FROM jsonb_each(c.deleted_counts) AS e(k, v)), true, 'and only numbers: no names, no content');
  PERFORM pg_temp.is((SELECT count(*) FROM public.broker_mailboxes WHERE address IN ('teamed@mailbox.test', 'agent_a@mailbox.test')), 0::bigint, 'the mailboxes of people whose last firm this was are deleted');
  PERFORM pg_temp.is((SELECT count(*) FROM public.broker_mailboxes WHERE address = 'both@mailbox.test'), 1::bigint, 'the mailbox of a person who belongs to another firm is kept');
  PERFORM pg_temp.is((SELECT count(*) FROM public.broker_mailboxes WHERE address = 'agent_b@mailbox.test'), 1::bigint, 'and the other firm''s');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_teams WHERE firm_id = fb), 1::bigint, 'the other firm''s team is kept');
  RAISE NOTICE 'close_a_firm: the deletion passed';
END $$;

-- ---------- every member's access ends ----------
-- Break caught: a member (an owner, the last owner, the one with a team, the one dated for later, the suspended one) can still get in;
-- the rows are deleted instead of ended (the record of who belonged is gone); a member of another firm loses theirs.
DO $$
DECLARE fa uuid := pg_temp.id('alpha'); fb uuid := pg_temp.id('beta'); who text;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_memberships m WHERE m.firm_id = fa AND public.membership_is_current(m.valid_from, m.valid_until)), 0::bigint, 'no membership of the firm is current');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_memberships m WHERE m.firm_id = fa AND (m.valid_until IS NULL OR (m.valid_until > now() AND m.valid_until > m.valid_from))), 0::bigint, 'none is open, and the one dated to start later never will');
  PERFORM pg_temp.is((SELECT valid_until = valid_from FROM public.firm_memberships WHERE firm_id = fa AND user_id = pg_temp.id('future')), true, 'it is ended before it begins');
  PERFORM pg_temp.is(to_jsonb((SELECT count(*) FROM public.firm_memberships WHERE firm_id = fa)), (SELECT v FROM snap WHERE k = 'memberships_a'), 'the rows are kept, ended, as the record of who belonged');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_memberships WHERE firm_id = fa AND team_id IS NOT NULL), 0::bigint, 'and name no team: the teams are gone');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_member_suspensions WHERE firm_id = fa AND ended_at IS NULL), 0::bigint, 'the suspended person''s suspension is ended too');
  FOREACH who IN ARRAY ARRAY['owner_a', 'owner_a2', 'agent_a', 'teamed', 'both', 'susp', 'future', 'leaver'] LOOP
    PERFORM pg_temp.as_user(who);
    PERFORM pg_temp.is(public.firm_role(fa), NULL::text, who || ' has no role in the firm');
    PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_sessions WHERE firm_id = fa), 0::bigint, who || ' reads none of its intakes');
    PERFORM pg_temp.is((SELECT count(*) FROM public.my_firms() f WHERE f.firm_id = fa), 0::bigint, who || ' is offered no such firm');
  END LOOP;
  PERFORM pg_temp.as_user('both');
  PERFORM pg_temp.is((SELECT count(*) FROM public.my_firms()), 1::bigint, 'a member of two firms keeps the other one');
  PERFORM pg_temp.as_user('owner_b');
  PERFORM pg_temp.is(public.firm_role(fb), 'owner', 'the other firm''s owner is untouched');
  RESET ROLE;
  RAISE NOTICE 'close_a_firm: access ended';
END $$;

-- ---------- intakes stay ----------
-- Break caught: the closing deletes an intake or what belongs to it (its documents' record, quote requests, mail threads, held mail, submission
-- records); the employer cannot read their own intake; a former member reads one through the firm; mail that arrives later is lost or
-- read by someone.
DO $$
DECLARE fa uuid := pg_temp.id('alpha'); s uuid := pg_temp.id('intake_a'); q bigint := current_setting('test.quote_a')::bigint; local text; res jsonb;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.is(to_jsonb((SELECT count(*) FROM public.chamber_sessions WHERE firm_id = fa)), (SELECT v FROM snap WHERE k = 'intakes_a'), 'the intake is still there');
  PERFORM pg_temp.is(to_jsonb((SELECT count(*) FROM public.quote_requests WHERE session_id = s)), (SELECT v FROM snap WHERE k = 'quotes_a'), 'with its quote request');
  PERFORM pg_temp.is(to_jsonb((SELECT count(*) FROM public.quote_request_messages WHERE session_id = s OR firm_id = fa)), (SELECT v FROM snap WHERE k = 'messages_a'),
    'its mail and the mail held for the firm');
  PERFORM pg_temp.is((SELECT count(*) FROM public.submission_workflow WHERE session_id = s), 1::bigint, 'and its submission record');
  PERFORM pg_temp.as_user('prospect_a');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_sessions), 1::bigint, 'the employer still opens their own intake');
  PERFORM pg_temp.as_user('owner_a');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_sessions), 0::bigint, 'a former owner reads none');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.advisor_list_submissions(NULL, NULL, 25, 0, NULL, NULL, NULL)'), 'rows:0', 'and finds the queue empty');
  PERFORM pg_temp.as_user('owner_a2');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.advisor_list_submissions(NULL, NULL, 25, 0, NULL, NULL, NULL)'), '42501', 'a former owner with no platform role is refused at its first line');
  PERFORM pg_temp.as_user('owner_a');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quote_request_messages), 0::bigint, 'nor any mail of it');
  PERFORM pg_temp.as_user('agent_a');
  PERFORM pg_temp.is((SELECT count(*) FROM public.advisor_list_submissions(NULL, NULL, 500, 0, NULL, NULL, NULL)), 0::bigint, 'a former agent who holds the advisor role finds the queue empty');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.open_submission(%L)$q$, s)), 'rows:0', 'and opens nothing');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.advisor_update_quote_request(%s, 'quoted')$q$, q)), 'PT404: Quote request not found', 'nor changes its quote request');
  RESET ROLE;
  -- Mail that arrives later for the closed firm's reply address is received and threaded onto the intake as before; nobody reads it.
  SET LOCAL ROLE service_role;
  local := (SELECT a.local_part FROM public.quote_request_addresses a WHERE a.quote_request_id = q AND a.revoked_at IS NULL LIMIT 1);
  res := public.record_inbound_mail('inbound-late', ARRAY[local], 'peo@example.test', 'A PEO', ARRAY['x@example.test'], ARRAY[]::text[], 'Late', 'text', false, '{}'::jsonb, false, now());
  RESET ROLE;
  PERFORM pg_temp.is((res ->> 'held')::boolean, false, 'mail for the closed firm''s reply address is still received and threaded onto the intake');
  PERFORM pg_temp.as_user('owner_a2');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quote_request_messages), 0::bigint, 'and no former member reads it');
  RESET ROLE;
  SET LOCAL ROLE service_role;
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.plan_mail_move(%s, %s, %L)$q$, current_setting('test.m_held'), q, pg_temp.id('platform_admin'))),
    '55000: This firm is closing and can''t be changed', 'held mail is not assigned onto a closed firm''s thread');
  RESET ROLE;
  RAISE NOTICE 'close_a_firm: intakes stay';
END $$;

-- ---------- what the address shows afterwards (D-27) ----------
-- Break caught: a closed firm's address still shows its name or a sign-in, or a former member is told the firm exists or is closed.
DO $$
BEGIN
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(public.firm_public_name('alpha-brokers'), NULL::text, 'a closed firm''s address shows no name to a visitor');
  PERFORM pg_temp.is(public.firm_public_name('beta-benefits'), 'Beta Benefits', 'control: another firm''s does');
  PERFORM pg_temp.as_user('owner_a');
  PERFORM pg_temp.is(public.firm_public_name('alpha-brokers'), NULL::text, 'nor to a former owner');
  PERFORM pg_temp.is(public.is_member_of_firm_address('alpha-brokers'), false, 'who is no member there');
  PERFORM pg_temp.is(public.my_suspended_firm_at_address('alpha-brokers'), false, 'and is told nothing of its state');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firms WHERE address = 'alpha-brokers'), 0::bigint, 'and reads no such firm row');
  RESET ROLE;
  RAISE NOTICE 'close_a_firm: the address shows nothing';
END $$;

-- ---------- the firm's record, the platform's page, and alerts ----------
-- Break caught: the firm's own record is deleted with it (D-45: it goes by its own job); the platform page shows a closed firm as open or
-- hides when it closes; a non-admin reads it; an alert of a closed firm is claimed for people who are gone; the firm that was suspended
-- and closing did not close.
DO $$
DECLARE fa uuid := pg_temp.id('alpha'); fg uuid := pg_temp.id('gamma'); got record; claimed text;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.is(to_jsonb((SELECT count(*) FROM public.firm_activity WHERE firm_id = fa)), (SELECT v FROM snap WHERE k = 'activity_a'), 'the firm''s own record is left to its own job');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firms WHERE id = fa), 1::bigint, 'the firm''s row stays');
  PERFORM pg_temp.as_user('owner_b');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.admin_firm_states()'), '42501', 'a firm''s owner cannot read the platform page');
  PERFORM pg_temp.as_user('platform_admin');
  SELECT * INTO got FROM public.admin_firm_states() s WHERE s.firm_id = fa;
  PERFORM pg_temp.is(got.closed_on IS NOT NULL AND got.closing_on IS NULL, true, 'the platform page shows alpha as closed, with the date');
  PERFORM pg_temp.is(got.address, 'alpha-brokers', 'at the address it held');
  PERFORM pg_temp.is(got.closure_asked_by, pg_temp.id('owner_a'), 'asked by');
  PERFORM pg_temp.is(got.closure_deleted ->> 'saved_views', '2', 'with a count per table');
  SELECT * INTO got FROM public.admin_firm_states() s WHERE s.firm_id = fg;
  PERFORM pg_temp.is(got.closed_on IS NULL AND got.closing_on IS NULL AND NOT got.suspended, true, 'gamma, which was suspended while closing and whose owner then withdrew, is neither closing nor closed');
  SELECT * INTO got FROM public.admin_firm_states() s WHERE s.firm_id = pg_temp.id('omega');
  PERFORM pg_temp.is(got.closing_on IS NOT NULL AND got.closed_on IS NULL, true, 'omega is shown as closing, with its date');
  SELECT * INTO got FROM public.admin_firm_states() s WHERE s.firm_id = pg_temp.id('beta');
  PERFORM pg_temp.is(got.closing_on IS NULL AND got.closed_on IS NULL AND got.closure_deleted IS NULL, true, 'beta is neither');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.request_firm_closure(%L, 'Alpha Brokers')$q$, fa)), '42501', 'and the platform admin still cannot close or withdraw on a firm''s behalf');
  RESET ROLE;
  SET LOCAL ROLE service_role;
  SELECT string_agg(c.dedupe_key, ',') INTO claimed FROM public.claim_outbox_events(ARRAY['advisor_notification', 'firm_closing', 'member_left'], 10, 5, 600) c;
  PERFORM pg_temp.is(claimed IS NULL OR claimed NOT LIKE '%alert-a%', true, 'an alert of the closed firm is not claimed: nobody is left to tell');
  PERFORM pg_temp.is(array_to_string(public.outbox_owner_recipients(fa), ','), '', 'and its owners have no addresses left');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT status || '/' || last_error FROM public.outbox_events WHERE dedupe_key = 'alert-a'), 'suppressed/cancelled: the firm closed', 'the alert that was waiting at closing was ended, as a cancelled reminder is');
  PERFORM pg_temp.is((SELECT count(*) FROM public.outbox_events e WHERE e.firm_id = fa AND e.status IN ('pending', 'claimed')), 0::bigint, 'and so were the firm''s own emails: nothing waits for good');
  INSERT INTO public.outbox_events (kind, session_id, dedupe_key, payload) VALUES ('peo_mail_arrived', pg_temp.id('intake_a'), 'late-alert', '{}');
  PERFORM pg_temp.is((SELECT status || '/' || last_error FROM public.outbox_events WHERE dedupe_key = 'late-alert'), 'suppressed/cancelled: the firm closed', 'an alert queued afterwards, for mail that arrives later, is ended the moment it is queued');
  INSERT INTO public.outbox_events (kind, session_id, dedupe_key, payload) VALUES ('prospect_confirmation', pg_temp.id('intake_a'), 'late-confirm', '{"recipient_email":"p@example.test"}');
  PERFORM pg_temp.is((SELECT status FROM public.outbox_events WHERE dedupe_key = 'late-confirm'), 'pending', 'while the employer''s own email is not touched');
  SET LOCAL ROLE service_role;
  RESET ROLE;
  RAISE NOTICE 'close_a_firm: record and platform page passed';
END $$;

-- ---------- the address is held for twelve months ----------
-- Break caught: a closed firm's address is taken the day it closes, or eleven months later, or by anyone while the firm is only closing; or
-- it is never released (a firm's row stays for ever, so without the release the address would be lost for good); or releasing it loses
-- the old firm's record.
DO $$
DECLARE fa uuid := pg_temp.id('alpha'); new_id uuid;
BEGIN
  PERFORM pg_temp.as_user('founder1');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.sign_up_firm('New Alpha', 'alpha-brokers')$q$), '23505', 'the day it closes the address cannot be taken');
  RESET ROLE;
  UPDATE public.firm_closures SET closed_at = now() - interval '11 months 29 days' WHERE firm_id = fa AND closed_at IS NOT NULL;
  PERFORM pg_temp.as_user('founder1');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.sign_up_firm('New Alpha', 'alpha-brokers')$q$), '23505', 'eleven months and 29 days later it still cannot');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.sign_up_firm('New Beta', 'beta-benefits')$q$), '23505', 'an address of a firm that is not closed is never released');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.sign_up_firm('New Omega', 'omega-partners')$q$), '23505', 'nor one of a firm that is only closing');
  RESET ROLE;
  UPDATE public.firm_closures SET closed_at = now() - interval '12 months' WHERE firm_id = fa AND closed_at IS NOT NULL;
  PERFORM pg_temp.as_user('founder1');
  new_id := public.sign_up_firm('New Alpha', 'alpha-brokers');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT address FROM public.firms WHERE id = new_id), 'alpha-brokers', 'after twelve months another firm takes the address');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firms WHERE id = fa), 1::bigint, 'the closed firm''s row stays');
  PERFORM pg_temp.is((SELECT address <> 'alpha-brokers' FROM public.firms WHERE id = fa), true, 'under another address, so it no longer holds this one');
  PERFORM pg_temp.is((SELECT address = 'x.' || replace(fa::text, '-', '') FROM public.firms WHERE id = fa), true, 'a placeholder with a dot, which is not an address anyone can ask for');
  -- Nobody who knows the firm's id can take the placeholder first: a sign-up takes ordinary addresses only, and the table's rule agrees.
  PERFORM pg_temp.as_user('founder2');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.sign_up_firm('Squatter', %L)$q$, 'x.' || replace(fa::text, '-', ''))), '23514', 'the placeholder is refused as an address');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.sign_up_firm('Squatter', 'has.dot')$q$), '23514', 'and so is any address with a dot');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.sign_up_firm('Squatter', 'x.00000000000000000000000000000000')$q$), '23514', 'whatever its digits');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.attempt($q$INSERT INTO public.firms (name, address) VALUES ('Direct', 'x.zz')$q$), '23514', 'and the table refuses a placeholder that is not the exact shape');
  PERFORM pg_temp.is((SELECT address FROM public.firm_closures WHERE firm_id = fa AND closed_at IS NOT NULL), 'alpha-brokers', 'the record is as it was');
  PERFORM pg_temp.is((SELECT address FROM public.firm_closures WHERE firm_id = fa AND closed_at IS NOT NULL), 'alpha-brokers', 'the platform''s record still says which address it held');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE firm_id = fa), 0::bigint + (SELECT (v #>> '{}')::bigint FROM snap WHERE k = 'activity_a'), 'and its record is intact');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_sessions WHERE firm_id = fa), 2::bigint, 'and its intakes stay with it');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is((SELECT count(*) FROM public.admin_firm_states() s WHERE s.address = 'alpha-brokers'), 2::bigint, 'the platform page lists the new firm and the closed one, each at the address it held');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(public.firm_public_name('alpha-brokers'), 'New Alpha', 'and the address now shows the new firm');
  RESET ROLE;
  RAISE NOTICE 'close_a_firm: the address hold passed';
END $$;

-- ---------- who asked is kept when the account is deleted ----------
-- Break caught: deleting the account of the owner who asked (or withdrew) erases "on whose request" from the platform's record, or is refused
-- because of it.
DO $$
DECLARE fa uuid := pg_temp.id('alpha'); asker uuid := pg_temp.id('owner_a');
BEGIN
  RESET ROLE;
  DELETE FROM auth.users WHERE id = asker;
  PERFORM pg_temp.is((SELECT count(*) FROM auth.users WHERE id = asker), 0::bigint, 'the account is deleted');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_closures WHERE firm_id = fa AND asked_by = asker), 2::bigint, 'and the platform''s record still says whose requests they were (the id alone)');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_closures WHERE firm_id = fa AND withdrawn_by = pg_temp.id('owner_a2')), 1::bigint, 'and who withdrew one');
  RAISE NOTICE 'close_a_firm: who asked is kept';
END $$;

-- ---------- what closing deletes is one list, and it is complete ----------
-- Break caught: the closing names a table or column that does not exist; a later story adds a table and forgets to say what closing does with
-- it (data_isolation.sql fails the build for any table registered as a firm's data that is in neither list, using the same function).
DO $$
DECLARE step record;
BEGIN
  RESET ROLE;
  FOR step IN SELECT * FROM public.firm_closing_plan() p WHERE p.action = 'delete' LOOP
    PERFORM pg_temp.is(step.src ~ '^public\.[a-z_]+$', true, step.src || ' is a plain table of the public schema');
    PERFORM pg_temp.is((SELECT count(*) FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = substr(step.src, 8) AND c.column_name = step.firm_column), 1::bigint,
      step.src || ' has the column ' || step.firm_column);
  END LOOP;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_closing_plan() p WHERE p.action NOT IN ('delete', 'keep')), 0::bigint, 'every entry deletes or keeps');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_closing_plan() p WHERE p.action = 'keep' AND btrim(p.why) = ''), 0::bigint, 'and every kept one says why');
  PERFORM pg_temp.is((SELECT count(*) FROM (SELECT p.src FROM public.firm_closing_plan() p GROUP BY p.src HAVING count(*) > 1) d), 0::bigint, 'and none is listed twice');
  RAISE NOTICE 'close_a_firm: the plan is well formed';
END $$;

-- ---------- a write path nobody thought about ----------
-- Break caught: a later story adds a function that changes a firm's data and forgets that a closing firm is read-only; or restates one of
-- the functions below from an older definition and drops the guard (D-104: this has happened to other rules). Every function the API roles
-- can run that inserts, updates or deletes is either listed here as guarded (and its source still asks the guard), or listed as exempt
-- with the reason. A function in neither list fails, so whoever adds one has to decide.
DO $$
DECLARE
  guarded text[] := ARRAY['accept_invitation', 'add_firm_organisation', 'advisor_add_quote_request_note', 'advisor_add_referral_partner', 'advisor_correct_quote_request_note',
    'advisor_record_quote_send', 'advisor_reissue_quote_request_address', 'advisor_request_information', 'advisor_requeue_outbox_event', 'advisor_update_quote_request',
    'advisor_update_referral_partner', 'approve_join_request', 'ask_to_join_firm', 'cancel_invitation', 'change_saved_view', 'decline_join_request', 'delete_saved_view',
    'invite_member', 'lift_member_suspension', 'remove_firm_organisation', 'remove_member', 'rename_saved_view', 'resend_invitation', 'review_submission_field',
    'save_view', 'set_my_table_columns', 'set_submission_needs_action', 'set_submission_status', 'share_saved_view', 'suspend_member', 'unshare_saved_view',
    'plan_mail_move', 'apply_mail_move', 'record_manuscript_version', 'request_intake_deletion', 'retry_intake_deletion', 'revoke_chamber_session'];
  -- Not a member's change to a firm's data, with why.
  exempt jsonb := jsonb_build_object(
    'admin_add_peo', 'a platform admin''s: the PEO list is the same for every firm',
    'admin_decide_firm', 'a platform admin''s',
    'admin_discard_peo_draft', 'a platform admin''s',
    'admin_lift_firm_suspension', 'a platform admin''s',
    'admin_publish_peo_profile', 'a platform admin''s',
    'admin_recheck_peo_profile', 'a platform admin''s',
    'admin_register_census_template', 'a platform admin''s',
    'admin_save_peo_profile', 'a platform admin''s',
    'admin_set_peo_listed', 'a platform admin''s',
    'admin_stop_firm_closure', 'a platform admin''s, who is no member of the firm',
    'admin_suspend_firm', 'a platform admin''s',
    'advisor_open_quote_request_thread', 'marks a thread read, which is what reading is; allowed while a firm is closing',
    'archive_chamber_session', 'the employer''s own intake: not the firm''s to freeze',
    'consume_ai_quota', 'the caller''s own allowance',
    'end_support_session', 'a platform admin''s own support session (CRM-P2.4): no member''s change to the firm''s data, and a support session itself is refused every guarded write',
    'leave_firm', 'a member''s way out, allowed while a firm is closing (CRM-P1.6)',
    'record_intake_consent', 'the employer''s own agreement',
    'record_history_capture', 'the trigger that writes a record''s history (CRM-S5.2): it runs inside a write that already asked the guard (referral partners are written only by the two guarded partner functions) and no API role can run it or write the table; the history table has no write grant or policy for an API role at all',
        'report_client_event', 'the platform''s monitoring',
    'request_firm_closure', 'the closing''s own door',
        'sign_up_firm', 'a new firm',
    'start_support_session', 'a platform admin''s doorway to read a firm (CRM-P2.4), who is no member of it; what it opens is read-only (supabase/tests/help_from_nevermore.sql)',
    'withdraw_firm_closure', 'the closing''s own way back');
  lost text; unplaced text; stale text;
BEGIN
  RESET ROLE;
  SELECT string_agg(g, ', ' ORDER BY g) INTO lost FROM unnest(guarded) g
  WHERE NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = g
                    AND (p.prosrc LIKE '%assert_firm_writable%' OR p.prosrc LIKE '%firm_is_read_only%'));
  PERFORM pg_temp.is(lost, NULL::text, 'every guarded function still asks whether the firm is closing');
  SELECT string_agg(DISTINCT p.proname, ', ' ORDER BY p.proname) INTO unplaced
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
    AND (has_function_privilege('authenticated', p.oid, 'EXECUTE') OR has_function_privilege('anon', p.oid, 'EXECUTE'))
    AND p.prosrc ~* '(insert into|update public|update [a-z_.]+ +(set|as)|delete from)'
    AND p.proname <> ALL (guarded) AND NOT exempt ? p.proname;
  PERFORM pg_temp.is(unplaced, NULL::text, 'no function that changes data is left out of the closing''s read-only list (add it to guarded, or to exempt with the reason)');
  SELECT string_agg(k, ', ' ORDER BY k) INTO stale FROM jsonb_object_keys(exempt) k
  WHERE NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = k);
  PERFORM pg_temp.is(stale, NULL::text, 'and the exempt list names no function that is gone');
  RAISE NOTICE 'close_a_firm: every writing function is accounted for';
END $$;

-- ---------- a write policy nobody thought about ----------
-- Break caught: the same, for a table or storage policy, which no function guards: a policy that lets a member write (insert, update or
-- delete) on a table of the public schema or on storage.objects must carry the read-only condition, or the table must have the trigger that
-- refuses it, or it is listed here with the true reason it is not a member's change to a firm's data. The list is of every such policy.
DO $$
DECLARE
  by_trigger text[] := ARRAY['public.advisor_notes'];
  exempt jsonb := jsonb_build_object(
    'public.chamber_sessions | Users can insert their own sessions', 'the employer''s own intake (user_id is the caller), not a member''s',
    'public.chamber_sessions | Users can update their own sessions', 'the employer''s own intake',
    'public.documents | Users can insert documents into their own sessions', 'the employer''s own documents in their own intake',
    'public.documents | Users can update documents in their own sessions', 'the employer''s own documents',
    'public.documents | Users can delete documents in their own sessions', 'the employer''s own documents',
    'public.profiles | Users can insert their own profile', 'a person''s own profile',
    'public.profiles | Users can update their own profile', 'a person''s own profile',
    'public.record_history | record_history_remover_delete', 'the removing role (no login, no API role belongs to it) that deletes a record''s history once the record is gone and a firm''s while it closes (ADR 0012)',
    'public.firm_activity | firm_activity_pruner_delete', 'the retention role (no login) that prunes the firm''s record after ninety days',
    'storage.objects | Users can delete documents in their own sessions', 'the employer''s own folder in the documents bucket');
  unplaced text; lost text; stale text;
BEGIN
  RESET ROLE;
  SELECT string_agg(p.schemaname || '.' || p.tablename || ' | ' || p.policyname || ' (' || p.cmd || ')', '; ' ORDER BY p.tablename, p.policyname) INTO unplaced
  FROM pg_policies p
  WHERE p.cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL') AND (p.schemaname = 'public' OR (p.schemaname = 'storage' AND p.tablename = 'objects'))
    AND coalesce(p.qual, '') || coalesce(p.with_check, '') !~ 'read_only'
    AND (p.schemaname || '.' || p.tablename) <> ALL (by_trigger)
    AND NOT exempt ? (p.schemaname || '.' || p.tablename || ' | ' || p.policyname);
  PERFORM pg_temp.is(unplaced, NULL::text, 'every write policy asks whether the firm is closing, or is listed as exempt with the reason');
  SELECT string_agg(k, ', ') INTO lost FROM unnest(by_trigger) k
  WHERE NOT EXISTS (SELECT 1 FROM pg_trigger g WHERE g.tgrelid = k::regclass AND g.tgname LIKE '%firm_not_closing' AND NOT g.tgisinternal);
  PERFORM pg_temp.is(lost, NULL::text, 'and a table guarded by a trigger still has it');
  SELECT string_agg(k, ', ') INTO stale FROM jsonb_object_keys(exempt) k
  WHERE NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname || '.' || p.tablename || ' | ' || p.policyname = k);
  PERFORM pg_temp.is(stale, NULL::text, 'and the exempt list names no policy that is gone');
  RAISE NOTICE 'close_a_firm: every write policy is accounted for';
END $$;

SELECT 'close_a_firm: all cases passed' AS result;
