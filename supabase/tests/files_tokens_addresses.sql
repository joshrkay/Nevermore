-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh files_tokens_addresses
-- Files, tokens and reply addresses (story CRM-P2.2; docs/BROKER_CRM_BUILD.md D-16, D-18, D-24, D-28; 20261116240000_held_mail_to_the_right_firm.sql).
-- Two firms. Proves, as each caller the product has (a member and an owner of each firm, a platform admin, a former and a suspended
-- member, a prospect, a guest and a signed-out caller):
--   1. mail for a reply address that belongs to no live record is held for the one firm its address belonged to, and for the platform
--      when no firm can be known (an address nobody held, or addresses of two firms on one message); never for another firm;
--   2. a reply address's last part is 64 random bits, and nothing about it follows from the quote request or its File ID;
--   3. a mailbox token is stored only as the function's ciphertext, and no caller, table policy, view or function returns it.
-- Stored files open only through a signed link made after the same membership check as the table policies: that check is proven for
-- every caller and bucket in supabase/tests/data_isolation.sql (the matrix and 4c), and src/lib/fileLinks.test.ts holds the code to it.
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
\i supabase/migrations/20261118160500_record_version_fixes.sql
\i supabase/migrations/20261118170000_export.sql
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



-- ---------- two firms, with one quote request each ----------
-- Firm A is Edgar Allan Advisory (the firms migration made it). Each firm's intake has a quote request with a live reply address.
CREATE TEMP TABLE fx_qr (name text PRIMARY KEY, id bigint NOT NULL);
CREATE FUNCTION pg_temp.local_of(n text) RETURNS text LANGUAGE sql AS $$
  SELECT a.local_part FROM public.quote_request_addresses a WHERE a.quote_request_id = (SELECT id FROM fx_qr WHERE name = n) ORDER BY a.id DESC LIMIT 1
$$;

DO $$
DECLARE
  n text;
  f text;
  sid uuid;
  qid bigint;
BEGIN
  FOREACH n IN ARRAY ARRAY['owner_a', 'agent_a', 'owner_b', 'agent_b', 'platform_admin', 'former_a', 'suspended_a', 'prospect_a', 'prospect_b'] LOOP
    PERFORM pg_temp.new_user(n);
  END LOOP;
  INSERT INTO fx VALUES ('firm_a', public.default_firm_id());
  INSERT INTO fx VALUES ('firm_b', gen_random_uuid());
  INSERT INTO public.firms (id, name, address, approved_at) VALUES (pg_temp.id('firm_b'), 'Beta Brokers', 'beta-brokers', now());
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('platform_admin'), 'admin');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES
    (pg_temp.id('firm_a'), pg_temp.id('owner_a'), 'owner'), (pg_temp.id('firm_a'), pg_temp.id('agent_a'), 'agent'),
    (pg_temp.id('firm_b'), pg_temp.id('owner_b'), 'owner'), (pg_temp.id('firm_b'), pg_temp.id('agent_b'), 'agent');
  INSERT INTO public.firm_memberships (firm_id, user_id, role, valid_from, valid_until)
  VALUES (pg_temp.id('firm_a'), pg_temp.id('former_a'), 'agent', now() - interval '10 days', now() - interval '1 day'),
         (pg_temp.id('firm_a'), pg_temp.id('suspended_a'), 'agent', now() - interval '10 days', now() - interval '1 day');
  FOREACH f IN ARRAY ARRAY['a', 'b'] LOOP
    INSERT INTO public.chamber_sessions (user_id, firm_id, chamber_data)
    VALUES (pg_temp.id('prospect_' || f), pg_temp.id('firm_' || f), jsonb_build_object('company_name', 'Co ' || f)) RETURNING id INTO sid;
    INSERT INTO fx VALUES ('intake_' || f, sid);
    -- Two quote requests per firm: one whose address stays live and one whose address is revoked.
    FOREACH n IN ARRAY ARRAY['live', 'old'] LOOP
      INSERT INTO public.quote_requests (session_id, peo_name, status) VALUES (sid, 'Harbor PEO ' || n, 'sent') RETURNING id INTO qid;
      PERFORM public.issue_quote_request_address(qid);
      INSERT INTO fx_qr VALUES (f || '_' || n, qid);
    END LOOP;
    UPDATE public.quote_request_addresses SET revoked_at = now() WHERE quote_request_id = (SELECT id FROM fx_qr WHERE name = f || '_old');
  END LOOP;
END $$;
GRANT SELECT ON fx_qr TO authenticated, service_role;

-- ---------- 1. mail for an address that belongs to no live record ----------
-- Mail arrives as the receive-mail function records it: as the service role, naming every local part the message was sent to.
CREATE FUNCTION pg_temp.arrive(id text, locals text[]) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_service();
  SELECT public.record_inbound_mail(id, locals, 'peo@example.test', 'PEO', '{}', '{}', 'Re: quote', 'Hello', false, '{}', false, '2026-11-10T15:00:00Z') INTO r;
  PERFORM pg_temp.as_owner();
  RETURN r;
END $$;

-- The firm a held message was filed under (null when it belongs to the platform alone), and where it sits.
CREATE FUNCTION pg_temp.held_firm(mid bigint) RETURNS uuid LANGUAGE sql AS $$ SELECT firm_id FROM public.quote_request_messages WHERE id = mid $$;
CREATE FUNCTION pg_temp.held_reason(mid bigint) RETURNS text LANGUAGE sql AS $$ SELECT held_reason FROM public.quote_request_messages WHERE id = mid $$;
-- How many held messages the caller reads.
CREATE FUNCTION pg_temp.reads_held(who text, mid bigint) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  PERFORM pg_temp.as_user(who);
  SELECT count(*) INTO n FROM public.quote_request_messages WHERE id = mid AND quote_request_id IS NULL;
  PERFORM pg_temp.as_owner();
  RETURN n;
END $$;

DO $$
DECLARE
  m bigint;
BEGIN
  -- An address nobody ever held belongs to no firm: the platform's list, and no firm's member reads it.
  m := (pg_temp.arrive('m-unknown', ARRAY['nobody.held.this0000000000000']) ->> 'message_id')::bigint;
  PERFORM pg_temp.is(pg_temp.held_reason(m), 'unknown_address', 'an address nobody held is unknown');
  PERFORM pg_temp.is(pg_temp.held_firm(m), NULL::uuid, 'unknown mail belongs to no firm');
  PERFORM pg_temp.is(pg_temp.reads_held('owner_a', m), 0::bigint, 'an owner of firm A reads none of it');
  PERFORM pg_temp.is(pg_temp.reads_held('agent_b', m), 0::bigint, 'a member of firm B reads none of it');

  -- A revoked address goes to its own firm's list, which that firm's members read and the other firm's do not.
  m := (pg_temp.arrive('m-revoked-a', ARRAY[pg_temp.local_of('a_old')]) ->> 'message_id')::bigint;
  PERFORM pg_temp.is(pg_temp.held_reason(m), 'revoked_address', 'a revoked address is held as revoked');
  PERFORM pg_temp.is(pg_temp.held_firm(m), pg_temp.id('firm_a'), 'revoked mail is held for the firm the address belonged to');
  PERFORM pg_temp.is(pg_temp.reads_held('owner_a', m), 1::bigint, 'an owner of that firm reads it');
  PERFORM pg_temp.is(pg_temp.reads_held('agent_a', m), 1::bigint, 'an agent of that firm reads it');
  PERFORM pg_temp.is(pg_temp.reads_held('owner_b', m), 0::bigint, 'the other firm''s owner reads none of it');
  PERFORM pg_temp.is(pg_temp.reads_held('platform_admin', m), 0::bigint, 'a platform admin reads none of it from the table (D-16)');
  PERFORM pg_temp.is(pg_temp.reads_held('former_a', m), 0::bigint, 'a former member reads none of it');

  -- The same message also sent to an address nobody held, which sorts first: the firm is still known.
  m := (pg_temp.arrive('m-revoked-a-plus-unknown', ARRAY['aaaa.nobody.0000000000000000', pg_temp.local_of('a_old')]) ->> 'message_id')::bigint;
  PERFORM pg_temp.is(pg_temp.held_firm(m), pg_temp.id('firm_a'), 'an unknown address beside a revoked one does not hide the firm');
  -- The platform's list shows such a message by the address that was once a quote request's: its PEO, and never who wrote it or what.
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is((SELECT h.peo_name FROM public.admin_held_mail() h WHERE h.message_id = m), 'Harbor PEO old', 'a platform admin sees the PEO of the address the message was held for');
  PERFORM pg_temp.is((SELECT h.peo_name FROM public.admin_held_mail() h WHERE h.message_id = (SELECT id FROM public.quote_request_messages WHERE provider_message_id = 'm-unknown')), NULL::text, 'and no PEO for an address nobody held');
  PERFORM pg_temp.as_owner();

  -- One message sent to the revoked addresses of two firms can't be said to belong to either: the platform's list, whichever sorts first.
  m := (pg_temp.arrive('m-two-firms', ARRAY[pg_temp.local_of('a_old'), pg_temp.local_of('b_old')]) ->> 'message_id')::bigint;
  PERFORM pg_temp.is(pg_temp.held_firm(m), NULL::uuid, 'a message to two firms'' revoked addresses belongs to neither');
  PERFORM pg_temp.is(pg_temp.reads_held('owner_a', m) + pg_temp.reads_held('owner_b', m), 0::bigint, 'and neither firm reads it');
  m := (pg_temp.arrive('m-two-firms-rev', ARRAY[pg_temp.local_of('b_old'), pg_temp.local_of('a_old')]) ->> 'message_id')::bigint;
  PERFORM pg_temp.is(pg_temp.held_firm(m), NULL::uuid, 'in either order');
END $$;

-- Two live addresses on one message are ambiguous: held for their firm when it is one firm's, for the platform when it is two.
DO $$
DECLARE
  qid bigint;
  m bigint;
BEGIN
  INSERT INTO public.quote_requests (session_id, peo_name, status) VALUES (pg_temp.id('intake_a'), 'Harbor PEO second', 'sent') RETURNING id INTO qid;
  PERFORM public.issue_quote_request_address(qid);
  INSERT INTO fx_qr VALUES ('a_live2', qid);
  m := (pg_temp.arrive('m-two-live-a', ARRAY[pg_temp.local_of('a_live'), pg_temp.local_of('a_live2')]) ->> 'message_id')::bigint;
  PERFORM pg_temp.is(pg_temp.held_reason(m), 'ambiguous_address', 'two live addresses are ambiguous');
  PERFORM pg_temp.is(pg_temp.held_firm(m), pg_temp.id('firm_a'), 'held for the one firm they belong to');
  PERFORM pg_temp.is(pg_temp.reads_held('agent_a', m), 1::bigint, 'whose agent reads it');
  PERFORM pg_temp.is(pg_temp.reads_held('agent_b', m), 0::bigint, 'and the other firm''s does not');
  m := (pg_temp.arrive('m-two-live-ab', ARRAY[pg_temp.local_of('a_live'), pg_temp.local_of('b_live')]) ->> 'message_id')::bigint;
  PERFORM pg_temp.is(pg_temp.held_reason(m), 'ambiguous_address', 'live addresses of two firms are ambiguous');
  PERFORM pg_temp.is(pg_temp.held_firm(m), NULL::uuid, 'and belong to neither');
  -- A message to one live address is still the quote request's, in its own firm, however many other addresses it names.
  m := (pg_temp.arrive('m-live-a', ARRAY[pg_temp.local_of('b_old'), pg_temp.local_of('a_live'), 'zzz.unknown.00000000000000']) ->> 'message_id')::bigint;
  PERFORM pg_temp.is((SELECT quote_request_id FROM public.quote_request_messages WHERE id = m), (SELECT id FROM fx_qr WHERE name = 'a_live'), 'a live address wins');
  PERFORM pg_temp.is(pg_temp.held_firm(m), pg_temp.id('firm_a'), 'in the firm of its intake');
END $$;

-- ---------- 2. a reply address holds 64 random bits ----------
-- <File ID>.<PEO>.<16 hex characters from the database's random generator>. The first two parts are for an advisor to recognise the
-- address by; only the last is a secret, so only it counts: 16 hex characters are 64 bits. Nothing in it is the quote request's id, a
-- counter or a time.
DO $$
DECLARE
  n constant integer := 600;
  tails text[];
  addresses text[];
  distinct_tails integer;
  position_values integer;
  rising integer;
  p integer;
BEGIN
  SELECT array_agg(public.new_quote_request_address('EAA-2026-S1', 'Harbor PEO') ORDER BY g) INTO addresses FROM generate_series(1, n) g;
  SELECT array_agg(substr(a, length(a) - 15)) INTO tails FROM unnest(addresses) a;
  PERFORM pg_temp.is((SELECT count(*) FROM unnest(addresses) a WHERE a ~ '^eaa-2026-s1\.harborpeo\.[0-9a-f]{16}$'), n::bigint, 'every address is <File ID>.<PEO>.<16 hex characters>');
  SELECT count(DISTINCT t) INTO distinct_tails FROM unnest(tails) t;
  PERFORM pg_temp.is(distinct_tails, n, 'the same File ID and PEO never give the same address twice');
  -- Every hex position takes (nearly) every value: no fixed digit, no digit that only counts up, none a version or variant mark.
  FOR p IN 1..16 LOOP
    SELECT count(DISTINCT substr(t, p, 1)) INTO position_values FROM unnest(tails) t;
    IF position_values < 15 THEN RAISE EXCEPTION 'FAIL: position % of the random part took only % of 16 values in % addresses', p, position_values, n; END IF;
  END LOOP;
  -- Not a sequence, forwards or back: about half of the neighbouring pairs rise.
  SELECT count(*) INTO rising FROM generate_series(1, n - 1) i WHERE tails[i] < tails[i + 1];
  IF rising NOT BETWEEN n * 0.4 AND n * 0.6 THEN RAISE EXCEPTION 'FAIL: % of % neighbouring addresses rise: a sequence, not random', rising, n; END IF;
  -- What the database issues is that function's output: the live address of a request carries its own random part, whatever its id.
  PERFORM pg_temp.is((SELECT count(DISTINCT substr(a.local_part, length(a.local_part) - 15)) FROM public.quote_request_addresses a), (SELECT count(*) FROM public.quote_request_addresses), 'every issued address has its own random part');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quote_request_addresses a WHERE a.local_part !~ '\.[0-9a-f]{16}$'), 0::bigint, 'and every one ends in 16 hex characters');
END $$;

-- ---------- 3. a mailbox token is stored as ciphertext, and nobody but the sending function reads it ----------
-- The only third-party token the product stores today is a broker's mailbox refresh token (broker_mailboxes). A linked-CRM token
-- doesn't exist yet: the epic that adds linked CRMs registers its table in data_isolation.sql's secrets list (5e), which fails
-- until the table is closed to the API and its token column is out of every caller's reach.
CREATE FUNCTION pg_temp.as_guest() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'is_anonymous', true)::text, false);
  PERFORM set_config('role', 'authenticated', false);
END $$;
CREATE FUNCTION pg_temp.as_signed_out() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', false);
  PERFORM set_config('role', 'anon', false);
END $$;
-- Becomes a caller by name: a person, 'guest', 'signed_out' or 'service'.
CREATE FUNCTION pg_temp.become(who text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF who = 'guest' THEN PERFORM pg_temp.as_guest();
  ELSIF who = 'signed_out' THEN PERFORM pg_temp.as_signed_out();
  ELSIF who = 'service' THEN PERFORM pg_temp.as_service();
  ELSE PERFORM pg_temp.as_user(who);
  END IF;
END $$;

DO $$
DECLARE
  who text;
  callers constant text[] := ARRAY['owner_a', 'agent_a', 'owner_b', 'agent_b', 'platform_admin', 'former_a', 'suspended_a', 'prospect_a', 'guest', 'signed_out'];
  marker constant text := 'ZZ-TOKEN-MARKER-' || replace(gen_random_uuid()::text, '-', '');
  seen text;
  col text;
  cols constant text[] := ARRAY['token_ciphertext', 'token_iv', 'user_id', 'address'];
  tbl regclass;
  hits text[];
BEGIN
  -- An owner and an agent of firm A, neither with a platform role, each connect a mailbox: the function stores its ciphertext.
  PERFORM pg_temp.as_service();
  PERFORM public.mailbox_store(pg_temp.id('owner_a'), 'google', 'owner@alpha.example', 'https://www.googleapis.com/auth/gmail.send', marker || '-owner', 'IV-owner');
  PERFORM public.mailbox_store(pg_temp.id('agent_a'), 'microsoft', 'agent@alpha.example', 'Mail.Send', marker || '-agent', 'IV-agent');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*) FROM public.broker_mailboxes), 2::bigint, 'two mailboxes are connected');

  FOREACH who IN ARRAY callers LOOP
    PERFORM pg_temp.become(who);
    -- The table: not readable, as rows, as a column, as a whole row, or counted; not writable.
    PERFORM pg_temp.expect('SELECT count(*) FROM public.broker_mailboxes', '42501', who || ' counting the mailboxes');
    FOREACH col IN ARRAY cols LOOP
      PERFORM pg_temp.expect(format('SELECT %I FROM public.broker_mailboxes', col), '42501', who || ' reading ' || col);
    END LOOP;
    PERFORM pg_temp.expect('SELECT to_jsonb(m) FROM public.broker_mailboxes m', '42501', who || ' reading a mailbox row');
    PERFORM pg_temp.expect('SELECT 1 FROM public.broker_mailboxes WHERE token_ciphertext LIKE ''%a%''', '42501', who || ' probing a token with a filter');
    PERFORM pg_temp.expect('UPDATE public.broker_mailboxes SET address = address', '42501', who || ' changing a mailbox');
    PERFORM pg_temp.expect('DELETE FROM public.broker_mailboxes', '42501', who || ' deleting a mailbox');
    PERFORM pg_temp.expect(format('INSERT INTO public.broker_mailboxes (user_id, provider, address, scope, token_ciphertext, token_iv) VALUES (%L, ''google'', ''x@y.example'', ''s'', ''c'', ''i'')', gen_random_uuid()),
      '42501', who || ' adding a mailbox');
    -- The functions that read and write the token are the sending function's alone.
    PERFORM pg_temp.expect(format('SELECT public.mailbox_secret(%L)', pg_temp.id('agent_a')), CASE WHEN who = 'service' THEN 'rows:1' ELSE '42501' END, who || ' reading a token');
    PERFORM pg_temp.expect(format('SELECT public.mailbox_store(%L, ''google'', ''a@b.example'', ''s'', ''c'', ''i'')', pg_temp.id('agent_a')), '42501', who || ' storing a token');
    PERFORM pg_temp.expect(format('SELECT public.mailbox_delete(%L)', pg_temp.id('agent_a')), '42501', who || ' deleting a token');
  END LOOP;

  -- What a person is told of their own mailbox: that it is connected, to whom and since when; never the token, its iv or anything of it.
  FOREACH who IN ARRAY ARRAY['owner_a', 'agent_a'] LOOP
    PERFORM pg_temp.as_user(who);
    SELECT public.my_mailbox()::text INTO seen;
    PERFORM pg_temp.as_owner();
    IF seen NOT LIKE '%"connected": true%' THEN RAISE EXCEPTION 'FAIL: % is not told their mailbox is connected: %', who, seen; END IF;
    IF seen LIKE '%' || marker || '%' OR seen ~* 'token|cipher|"iv"|IV-' THEN RAISE EXCEPTION 'FAIL: my_mailbox told % of the token: %', who, seen; END IF;
  END LOOP;
  -- Nobody else is told of it, a colleague, the other firm and a platform admin included.
  FOREACH who IN ARRAY ARRAY['owner_b', 'agent_b', 'platform_admin', 'former_a', 'prospect_a'] LOOP
    PERFORM pg_temp.as_user(who);
    SELECT public.my_mailbox()::text INTO seen;
    PERFORM pg_temp.as_owner();
    IF seen <> '{"connected": false}' THEN RAISE EXCEPTION 'FAIL: % is told of a mailbox that is not theirs: %', who, seen; END IF;
  END LOOP;
  PERFORM pg_temp.as_guest();
  PERFORM pg_temp.expect('SELECT public.my_mailbox()', 'rows:1', 'a guest asking about a mailbox');
  PERFORM pg_temp.as_owner();

  -- The service role (the function that sends) gets the ciphertext and the iv, and only ever those.
  PERFORM pg_temp.as_service();
  SELECT public.mailbox_secret(pg_temp.id('agent_a'))::text INTO seen;
  PERFORM pg_temp.as_owner();
  IF seen NOT LIKE '%' || marker || '-agent%' OR seen NOT LIKE '%IV-agent%' THEN RAISE EXCEPTION 'FAIL: the sending function did not get the stored ciphertext: %', seen; END IF;

  -- No view, materialised view or function hands out the table's rows: nothing depends on its token columns, no function returns its row type,
  -- and it is in no publication that would stream it.
  PERFORM pg_temp.is((SELECT count(*) FROM pg_depend d JOIN pg_rewrite r ON r.oid = d.objid JOIN pg_class v ON v.oid = r.ev_class
    WHERE d.refobjid = 'public.broker_mailboxes'::regclass AND d.classid = 'pg_rewrite'::regclass AND v.relkind IN ('v', 'm')), 0::bigint, 'no view reads broker_mailboxes');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_proc p WHERE p.prorettype = 'public.broker_mailboxes'::regtype OR 'public.broker_mailboxes'::regtype = ANY (p.proargtypes::oid[])), 0::bigint, 'no function takes or returns a mailbox row');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_publication_tables WHERE schemaname = 'public' AND tablename = 'broker_mailboxes'), 0::bigint, 'no publication streams the mailboxes');

  -- The marker lives in broker_mailboxes alone, after connecting, replacing and disconnecting: no log, record or copy keeps a token.
  PERFORM public.mailbox_store(pg_temp.id('agent_a'), 'microsoft', 'agent@alpha.example', 'Mail.Send', marker || '-rotated', 'IV-rotated', true);
  FOR tbl IN SELECT c.oid::regclass FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname IN ('public', 'auth') AND c.relkind = 'r' AND c.oid <> 'public.broker_mailboxes'::regclass LOOP
    EXECUTE format('SELECT count(*) FROM %s t WHERE to_jsonb(t)::text LIKE %L', tbl, '%' || marker || '%') INTO seen;
    IF seen::integer <> 0 THEN hits := hits || tbl::text; END IF;
  END LOOP;
  IF hits IS NOT NULL THEN RAISE EXCEPTION 'FAIL: a mailbox token is also held by %', hits; END IF;
  PERFORM public.mailbox_delete(pg_temp.id('agent_a'));
  PERFORM public.mailbox_delete(pg_temp.id('owner_a'));
END $$;
