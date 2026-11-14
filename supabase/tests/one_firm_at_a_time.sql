-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh one_firm_at_a_time
-- One firm at a time (story CRM-S1.1b; docs/BROKER_CRM_BUILD.md D-18, D-27, D-31, D-40; ADR 0016;
-- 20261117090000_one_firm_at_a_time.sql). At a firm's address the browser sends that address in the request header
-- x-firm-address, which PostgREST hands the database as request.headers, and the membership helpers then also require
-- that a row's firm is that address's firm. The address only narrows: membership is still the lock.
--
-- One person, `two`, is a current member of two firms (an agent of Alpha, the owner of Bravo). Proves, by what each caller
-- reads, counts, changes and writes and never by a policy's text:
--   1. with no address, a member of two firms reads both firms' rows, as before this story;
--   2. at each firm's address, only that firm's rows, table by table and through the functions;
--   3. a header with no address in it (empty, {}, other headers only, an empty value) is no address;
--   4. a header that is not JSON is refused, never read as no address;
--   5. an address no firm holds, or one in a form no firm has, shows nothing;
--   6. an address of a firm the caller doesn't belong to shows nothing of that firm and nothing of their own: a header grants
--      nothing, and changes, deletes and writes nothing;
--   7. a refused firm's address shows nothing, even to its members (D-27, D-31); a waiting firm's members work there;
--   8. letter case and surrounding spaces don't matter;
--   9. a caller who is no person (signed out, the service role, a job with no request) is not touched by it, and a person's
--      own rows (a prospect's own intake) are not narrowed;
--  10. a write "for the caller's firm" (firm_to_act_for) at firm B's address is for B, never A, and one naming A there is refused;
--  11. a platform admin gains nothing from an address (D-16), and an admin who belongs to a firm can't decide on it by sending
--      another firm's address;
--  12. the list of a person's own firms is not narrowed; the list of the firms they own is (so a page at an address offers
--      only that address's firm);
--  13. the helper is STABLE, run with a fixed search_path, builds no SQL and is not callable through the API.
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
SET client_min_messages = notice;

-- ---------- helpers ----------
CREATE TEMP TABLE fx (name text PRIMARY KEY, id uuid NOT NULL);
GRANT SELECT ON fx TO anon, authenticated, service_role;

CREATE FUNCTION pg_temp.id(n text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM fx WHERE name = n $$;

CREATE FUNCTION pg_temp.new_user(n text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', n || '@example.test', false, now(), now());
  INSERT INTO fx VALUES (n, uid);
  RETURN uid;
END $$;

-- The request's headers as PostgREST hands them to the database: a JSON object, header names in lower case. NULL sends a
-- request with no firm address at all (the bare domain).
CREATE FUNCTION pg_temp.at(address text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.headers',
    CASE WHEN address IS NULL THEN '{"accept":"application/json"}'
         ELSE jsonb_build_object('accept', 'application/json', 'x-firm-address', address)::text END, false);
END $$;

-- The headers exactly as given, for the shapes a header can arrive in.
CREATE FUNCTION pg_temp.raw_headers(raw text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.headers', raw, false);
END $$;

-- Act as a signed-in person (a sign-in through Google or Microsoft unless said otherwise), at an address or none.
CREATE FUNCTION pg_temp.as_user(n text, address text DEFAULT NULL, method text DEFAULT 'oauth', level text DEFAULT 'aal1') RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', false, 'email', n || '@example.test',
      'aal', level, 'amr', jsonb_build_array(jsonb_build_object('method', method, 'timestamp', 1)))::text, false);
  PERFORM pg_temp.at(address);
  PERFORM set_config('role', 'authenticated', false);
END $$;

-- The caller's token and headers with the superuser's privileges: how a function that runs as its owner sees the caller, for
-- the internal helpers the API can't call directly.
CREATE FUNCTION pg_temp.acting_as(n text, address text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_temp.as_user(n, address);
  RESET ROLE;
END $$;

CREATE FUNCTION pg_temp.as_owner() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', false);
  PERFORM set_config('request.headers', '', false);
END $$;

-- Runs stmt and always rolls it back: 'rows:<n>' for the rows it touched (1 for a SELECT of one value), or the SQLSTATE it raised.
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

-- The value of a one-value query, rolled back, as 'ok:<value>', or the SQLSTATE it raised.
CREATE FUNCTION pg_temp.value(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v text;
  s text;
  m text;
BEGIN
  BEGIN
    EXECUTE stmt INTO v;
    RAISE EXCEPTION USING ERRCODE = 'ZZ999', MESSAGE = COALESCE(v, '<null>');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT;
    IF s = 'ZZ999' THEN RETURN 'ok:' || m; END IF;
    RETURN s;
  END;
END $$;

CREATE FUNCTION pg_temp.expect(stmt text, expected text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r text := pg_temp.value(stmt);
BEGIN
  IF r IS DISTINCT FROM expected THEN RAISE EXCEPTION 'FAIL: % gave %, expected %', label, r, expected; END IF;
END $$;

CREATE FUNCTION pg_temp.is(got anyelement, want anyelement, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION 'FAIL: % gave %, expected %', label, got, want; END IF;
END $$;

-- Which of the two firms' rows the caller can see in each firm table, as one line: 'table:a+b' per table, a firm's letter
-- present when at least one of its rows is visible. The rows are found by the firm they hang off, as the superuser, and
-- counted as the caller, so a policy that showed a row of the wrong firm would show up as that firm's letter.
CREATE TEMP TABLE firm_rows (src text, firm text, ids text[], PRIMARY KEY (src, firm));
GRANT SELECT ON firm_rows TO authenticated, anon, service_role;

CREATE FUNCTION pg_temp.sight() RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  r record;
  out text := '';
  seen text;
BEGIN
  FOR r IN SELECT DISTINCT src FROM firm_rows ORDER BY src LOOP
    seen := '';
    IF pg_temp.count_of(r.src, 'a') > 0 THEN seen := seen || 'a'; END IF;
    IF pg_temp.count_of(r.src, 'b') > 0 THEN seen := seen || 'b'; END IF;
    out := out || r.src || ':' || CASE WHEN seen = '' THEN '-' ELSE seen END || ' ';
  END LOOP;
  RETURN btrim(out);
END $$;

-- How many of one firm's rows of a table the caller sees. A table the caller may not read at all counts as none.
CREATE FUNCTION pg_temp.count_of(src text, firm text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE format('SELECT count(*) FROM %s WHERE ctid::text = ANY (%L)', src, (SELECT ids FROM firm_rows f WHERE f.src = count_of.src AND f.firm = count_of.firm)) INTO n;
  RETURN n;
EXCEPTION WHEN insufficient_privilege THEN RETURN 0;
END $$;

-- What a caller who sees every firm table of both firms is shown, of one firm, and of none.
CREATE FUNCTION pg_temp.all_of(firms text) RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(src || ':' || firms, ' ' ORDER BY src) FROM (SELECT DISTINCT src FROM firm_rows) t
$$;

-- ---------- firms, people and rows ----------
-- Alpha and Bravo are approved; Waiting is waiting for approval; Refused was refused (D-31). `two` is an agent of Alpha and the
-- owner of Bravo. `only_a` belongs to Alpha alone; `only_b` to Bravo alone. `admin_w` is a platform admin who also owns
-- Waiting; `platform_admin` belongs to no firm (D-16). `founder_r` owns Refused; `former_b` left Bravo yesterday.
DO $$
DECLARE
  n text;
  sid uuid;
  qr bigint;
BEGIN
  FOREACH n IN ARRAY ARRAY['two', 'only_a', 'only_b', 'admin_w', 'platform_admin', 'founder_r', 'founder_w', 'former_b', 'prospect'] LOOP
    PERFORM pg_temp.new_user(n);
  END LOOP;
  INSERT INTO fx VALUES ('alpha', gen_random_uuid()), ('bravo', gen_random_uuid()), ('waiting', gen_random_uuid()), ('refused', gen_random_uuid());
  INSERT INTO public.firms (id, name, address, approved_at, visibility) VALUES
    (pg_temp.id('alpha'), 'Alpha Advisory', 'alpha-advisory', now(), 'everyone'),
    (pg_temp.id('bravo'), 'Bravo Brokers', 'bravo-brokers', now(), 'everyone');
  INSERT INTO public.firms (id, name, address, visibility) VALUES (pg_temp.id('waiting'), 'Waiting Brokers', 'waiting-brokers', 'everyone');
  INSERT INTO public.firms (id, name, address, visibility, decision, decided_at) VALUES
    (pg_temp.id('refused'), 'Refused Brokers', 'refused-brokers', 'everyone', 'refused', now());
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('admin_w'), 'admin'), (pg_temp.id('platform_admin'), 'admin');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES
    (pg_temp.id('alpha'), pg_temp.id('two'), 'agent'),
    (pg_temp.id('bravo'), pg_temp.id('two'), 'owner'),
    (pg_temp.id('alpha'), pg_temp.id('only_a'), 'owner'),
    (pg_temp.id('bravo'), pg_temp.id('only_b'), 'agent'),
    (pg_temp.id('waiting'), pg_temp.id('founder_w'), 'owner'),
    (pg_temp.id('waiting'), pg_temp.id('admin_w'), 'agent'),
    (pg_temp.id('refused'), pg_temp.id('founder_r'), 'owner');
  INSERT INTO public.firm_memberships (firm_id, user_id, role, valid_from, valid_until)
  VALUES (pg_temp.id('bravo'), pg_temp.id('former_b'), 'agent', now() - interval '10 days', now() - interval '1 day');
  -- An intake of each firm, owned by one prospect, with a quote request, a note, a referral partner and a team.
  FOREACH n IN ARRAY ARRAY['alpha', 'bravo', 'waiting', 'refused'] LOOP
    INSERT INTO public.chamber_sessions (user_id, firm_id, chamber_data)
    VALUES (pg_temp.id('prospect'), pg_temp.id(n), jsonb_build_object('company_name', initcap(n) || ' Co'))
    RETURNING id INTO sid;
    INSERT INTO fx VALUES ('intake_' || n, sid);
    INSERT INTO public.quote_requests (session_id, peo_name, status) VALUES (sid, 'Probe PEO', 'sent') RETURNING id INTO qr;
    INSERT INTO public.advisor_notes (session_id, author_id, body) VALUES (sid, pg_temp.id('prospect'), 'A note on ' || n);
    INSERT INTO public.quote_request_notes (quote_request_id, session_id, kind, noted_on, body, created_by)
    VALUES (qr, sid, 'call', current_date, 'A call for ' || n, pg_temp.id('prospect'));
    INSERT INTO public.referral_partners (firm_id, code, name, kind) VALUES (pg_temp.id(n), 'cfo-' || n, 'CFO of ' || n, 'accounting');
    INSERT INTO public.firm_teams (firm_id, name) VALUES (pg_temp.id(n), 'Team ' || n);
  END LOOP;
END $$;

-- The firm tables the two firms' rows are counted in, each row found by the firm it hangs off.
INSERT INTO firm_rows
SELECT t.src, f.k, t.ids
FROM (VALUES ('a', 'alpha'), ('b', 'bravo')) f (k, firm),
LATERAL (
  SELECT 'public.chamber_sessions', array_agg(s.ctid::text) FROM public.chamber_sessions s WHERE s.firm_id = pg_temp.id(f.firm)
  UNION ALL SELECT 'public.quote_requests', array_agg(q.ctid::text) FROM public.quote_requests q JOIN public.chamber_sessions s ON s.id = q.session_id WHERE s.firm_id = pg_temp.id(f.firm)
  UNION ALL SELECT 'public.advisor_notes', array_agg(x.ctid::text) FROM public.advisor_notes x JOIN public.chamber_sessions s ON s.id = x.session_id WHERE s.firm_id = pg_temp.id(f.firm)
  UNION ALL SELECT 'public.quote_request_notes', array_agg(x.ctid::text) FROM public.quote_request_notes x JOIN public.chamber_sessions s ON s.id = x.session_id WHERE s.firm_id = pg_temp.id(f.firm)
  UNION ALL SELECT 'public.submission_workflow', array_agg(x.ctid::text) FROM public.submission_workflow x JOIN public.chamber_sessions s ON s.id = x.session_id WHERE s.firm_id = pg_temp.id(f.firm)
  UNION ALL SELECT 'public.referral_partners', array_agg(x.ctid::text) FROM public.referral_partners x WHERE x.firm_id = pg_temp.id(f.firm)
  UNION ALL SELECT 'public.firm_teams', array_agg(x.ctid::text) FROM public.firm_teams x WHERE x.firm_id = pg_temp.id(f.firm)
  UNION ALL SELECT 'public.firm_memberships', array_agg(x.ctid::text) FROM public.firm_memberships x WHERE x.firm_id = pg_temp.id(f.firm)
) t (src, ids);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM firm_rows WHERE ids IS NULL OR cardinality(ids) = 0) THEN
    RAISE EXCEPTION 'FAIL: a firm table holds no row of one of the two firms, so the test proves nothing for it: %',
      (SELECT string_agg(src || '/' || firm, ', ') FROM firm_rows WHERE ids IS NULL OR cardinality(ids) = 0);
  END IF;
END $$;

-- What the funnel counts of Alpha's alone: its intakes' recorded steps.
CREATE TEMP TABLE alpha_steps AS
  SELECT count(*) AS n FROM public.intake_milestones m WHERE m.firm_id = pg_temp.id('alpha') AND m.started_at >= now() - interval '1 day';
GRANT SELECT ON alpha_steps TO authenticated;
SELECT pg_temp.is((SELECT n FROM alpha_steps) > 0, true, 'Alpha has steps for the funnel to count');

-- ---------- 1. no address: as before this story, a member of two firms reads both ----------
SELECT pg_temp.as_user('two');
SELECT pg_temp.is(pg_temp.sight(), pg_temp.all_of('ab'), 'with no address, a member of two firms reads both firms'' rows (as before)');
SELECT pg_temp.as_user('only_a');
SELECT pg_temp.is(pg_temp.sight(), pg_temp.all_of('a'), 'with no address, a member of one firm reads that firm''s rows');

-- ---------- 2. at each firm's address, only that firm ----------
SELECT pg_temp.as_user('two', 'alpha-advisory');
SELECT pg_temp.is(pg_temp.sight(), pg_temp.all_of('a'), 'at Alpha''s address, a member of two firms reads only Alpha''s rows');
SELECT pg_temp.is((SELECT array_agg(id) FROM public.chamber_sessions), ARRAY[pg_temp.id('intake_alpha')], 'and of the intakes only Alpha''s');
SELECT pg_temp.is(public.is_firm_member(pg_temp.id('bravo')), false, 'and is no member of Bravo there');
SELECT pg_temp.is(public.firm_role(pg_temp.id('bravo')), NULL::text, 'and holds no role in Bravo there');
SELECT pg_temp.is(public.firm_role(pg_temp.id('alpha')), 'agent', 'but is Alpha''s agent');
SELECT pg_temp.is(public.can_see_firm_record(pg_temp.id('bravo'), NULL), false, 'the visibility helper shows none of Bravo''s records there');
SELECT pg_temp.is(public.can_see_firm_record(pg_temp.id('alpha'), NULL), true, 'and Alpha''s');
SELECT pg_temp.is((SELECT count(*) FROM public.open_submission(pg_temp.id('intake_bravo'))), 0::bigint, 'Bravo''s submission does not open there');
SELECT pg_temp.is((SELECT count(*) FROM public.open_submission(pg_temp.id('intake_alpha'))), 1::bigint, 'Alpha''s does');
SELECT pg_temp.is((SELECT COALESCE(sum(intakes), 0)::bigint FROM public.advisor_intake_funnel(now() - interval '1 day', now() + interval '1 day')),
  (SELECT n FROM alpha_steps), 'the funnel counts Alpha''s intakes only');
SELECT pg_temp.expect($$SELECT count(*)::text FROM public.firm_activity_list('$$ || pg_temp.id('bravo') || $$')$$, '42501',
  'the owner of Bravo reads none of Bravo''s record of who did what at Alpha''s address');
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity), 0::bigint, 'nor any of it through the table');

SELECT pg_temp.as_user('two', 'bravo-brokers');
SELECT pg_temp.is(pg_temp.sight(), pg_temp.all_of('b'), 'at Bravo''s address, a member of two firms reads only Bravo''s rows');
SELECT pg_temp.is((SELECT array_agg(id) FROM public.chamber_sessions), ARRAY[pg_temp.id('intake_bravo')], 'and of the intakes only Bravo''s');
SELECT pg_temp.is(public.firm_role(pg_temp.id('bravo')), 'owner', 'and is Bravo''s owner there');
SELECT pg_temp.is(public.firm_role(pg_temp.id('alpha')), NULL::text, 'and holds no role in Alpha there');
SELECT pg_temp.is((SELECT count(*) FROM public.open_submission(pg_temp.id('intake_alpha'))), 0::bigint, 'Alpha''s submission does not open there');
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE firm_id = pg_temp.id('bravo')) > 0, true, 'and the owner reads Bravo''s record');
SELECT pg_temp.is(pg_temp.value($$SELECT (count(*) > 0)::text FROM public.firm_activity_list('$$ || pg_temp.id('bravo') || $$')$$), 'ok:true',
  'through the reading function too');

-- ---------- 3. a header with no address in it is no address ----------
DO $$
DECLARE
  h text;
BEGIN
  FOREACH h IN ARRAY ARRAY['', '{}', '{"accept":"application/json"}', '{"x-firm-address":""}', '{"x-firm-address":"   "}',
                           '{"x-firm-address":null}', '{"X-Firm-Address":"alpha-advisory"}', '[]', '"alpha-advisory"'] LOOP
    PERFORM pg_temp.as_user('two');
    PERFORM pg_temp.raw_headers(h);
    IF pg_temp.sight() IS DISTINCT FROM pg_temp.all_of('ab') THEN
      RAISE EXCEPTION 'FAIL: the headers % should be no address (both firms), gave %', h, pg_temp.sight();
    END IF;
  END LOOP;
END $$;

-- ---------- 4. headers that are not JSON are refused, never read as no address ----------
SELECT pg_temp.as_user('two');
SELECT pg_temp.raw_headers('{"x-firm-address": "alpha-advisory"');
SELECT pg_temp.expect('SELECT count(*)::text FROM public.chamber_sessions', '22P02', 'headers that are not JSON: the read is refused');
SELECT pg_temp.expect('SELECT count(*)::text FROM public.firm_memberships', '22P02', 'every firm read is');
-- Not even when the text does not mention the address: whether headers can be read is never guessed from their text.
SELECT pg_temp.raw_headers('{not json at all');
SELECT pg_temp.expect('SELECT count(*)::text FROM public.chamber_sessions', '22P02', 'headers that are not JSON and name no address: refused too');

-- ---------- 5. an address no firm holds shows nothing ----------
DO $$
DECLARE
  a text;
BEGIN
  FOREACH a IN ARRAY ARRAY['nowhere-at-all', 'alpha-advisory.bravo-brokers', 'alpha', 'alpha-advisory-x', '%', 'alpha_advisory', '42'] LOOP
    PERFORM pg_temp.as_user('two', a);
    IF pg_temp.sight() IS DISTINCT FROM pg_temp.all_of('-') THEN
      RAISE EXCEPTION 'FAIL: at the address %, which no firm holds, a member of two firms should see nothing, gave %', a, pg_temp.sight();
    END IF;
  END LOOP;
END $$;
SELECT pg_temp.as_user('two');
SELECT pg_temp.raw_headers('{"x-firm-address": 5}');
SELECT pg_temp.is(pg_temp.sight(), pg_temp.all_of('-'), 'an address that is a number names no firm');

-- ---------- 6. another firm's address: nothing of that firm, nothing of one's own; it changes and writes nothing ----------
SELECT pg_temp.as_user('only_a', 'bravo-brokers');
SELECT pg_temp.is(pg_temp.sight(), pg_temp.all_of('-'), 'a member of Alpha alone, at Bravo''s address, reads nothing of Bravo''s and nothing of Alpha''s');
SELECT pg_temp.is(public.my_firm_at_address('bravo-brokers'), NULL::uuid, 'and is told no firm at that address');
SELECT pg_temp.is(public.my_firm_at_address('alpha-advisory'), NULL::uuid, 'nor their own firm, asked by name, while at another''s');
SELECT pg_temp.expect($$SELECT public.set_submission_status('$$ || pg_temp.id('intake_bravo') || $$', 'under_review', 'x')::text$$, 'P0002',
  'changes no status of Bravo''s');
SELECT pg_temp.expect($$SELECT public.set_submission_status('$$ || pg_temp.id('intake_alpha') || $$', 'under_review', 'x')::text$$, 'P0002',
  'nor of Alpha''s, their own firm, while at Bravo''s address');
SELECT pg_temp.expect($$INSERT INTO public.advisor_notes (session_id, author_id, body) VALUES ('$$ || pg_temp.id('intake_alpha') || $$', auth.uid(), 'x') RETURNING 1$$,
  '42501', 'adds no note to their own firm''s intake there');
SELECT pg_temp.expect($$INSERT INTO public.advisor_notes (session_id, author_id, body) VALUES ('$$ || pg_temp.id('intake_bravo') || $$', auth.uid(), 'x') RETURNING 1$$,
  '42501', 'nor to Bravo''s');
SELECT pg_temp.acting_as('only_a', 'bravo-brokers');
SELECT pg_temp.expect('SELECT public.firm_to_act_for(NULL)::text', '42501', 'acts for no firm, theirs or Bravo''s');
SELECT pg_temp.expect($$SELECT public.firm_to_act_for('$$ || pg_temp.id('alpha') || $$')::text$$, '42501', 'not even named');
SELECT pg_temp.as_user('only_a', 'bravo-brokers');
SELECT pg_temp.expect($$SELECT public.invite_member('$$ || pg_temp.id('alpha') || $$', 'new@example.test', 'agent', NULL, repeat('c', 64))::text$$, '42501',
  'and, though Alpha''s owner, invites no one to Alpha from Bravo''s address');
SELECT pg_temp.expect($$SELECT count(*)::text FROM public.firm_pending_invitations('$$ || pg_temp.id('alpha') || $$')$$, '42501',
  'nor reads their own firm''s pending invitations there');
SELECT pg_temp.expect('WITH d AS (DELETE FROM public.advisor_notes RETURNING 1) SELECT count(*)::text FROM d', '42501', 'deletes no note');
SELECT pg_temp.expect('WITH u AS (UPDATE public.referral_partners SET name = ''Changed'' RETURNING 1) SELECT count(*)::text FROM u', '42501', 'changes no partner');
SELECT pg_temp.as_user('only_b', 'alpha-advisory');
SELECT pg_temp.is(pg_temp.sight(), pg_temp.all_of('-'), 'a member of Bravo alone, at Alpha''s address, reads nothing either');
SELECT pg_temp.as_user('former_b', 'bravo-brokers');
SELECT pg_temp.is(pg_temp.sight(), pg_temp.all_of('-'), 'a former member at their former firm''s address reads nothing');
SELECT pg_temp.as_user('prospect');
CREATE TEMP TABLE prospect_sight AS SELECT pg_temp.sight() AS s;
GRANT SELECT ON prospect_sight TO authenticated;
SELECT pg_temp.as_user('prospect', 'bravo-brokers');
SELECT pg_temp.is(pg_temp.sight(), (SELECT s FROM prospect_sight), 'a person with no membership gains nothing from an address: what they read is what they read with none');

-- ---------- 7. a refused firm's address is no firm's; a waiting firm's members work at theirs ----------
SELECT pg_temp.as_user('founder_r', 'refused-brokers');
SELECT pg_temp.is((SELECT count(*) FROM public.chamber_sessions), 0::bigint, 'a refused firm''s founder reads none of its intakes at its address (D-31)');
SELECT pg_temp.as_user('founder_r');
SELECT pg_temp.is((SELECT array_agg(id) FROM public.chamber_sessions), ARRAY[pg_temp.id('intake_refused')], 'with no address, membership answers as before');
SELECT pg_temp.as_user('founder_w', 'waiting-brokers');
SELECT pg_temp.is((SELECT array_agg(id) FROM public.chamber_sessions), ARRAY[pg_temp.id('intake_waiting')], 'a waiting firm''s owner works at its address (D-27)');

-- ---------- 8. letter case and spaces ----------
SELECT pg_temp.as_user('two', '  Bravo-BROKERS ');
SELECT pg_temp.is(pg_temp.sight(), pg_temp.all_of('b'), 'an address in capitals, with spaces around it, is the same address');

-- ---------- 9. callers who are no person; a person's own rows ----------
SELECT pg_temp.as_owner();
SELECT pg_temp.is(public.address_admits_firm(pg_temp.id('bravo')) AND public.address_admits_firm(pg_temp.id('alpha')), true,
  'a job with no request has no address: every firm is admitted, as before');
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false), pg_temp.at('alpha-advisory'), set_config('role', 'service_role', false);
SELECT pg_temp.is((SELECT count(*) FROM public.chamber_sessions) >= 4, true, 'the service role reads every firm''s intakes whatever address is sent');
SELECT pg_temp.is(public.outbox_alert_recipients(pg_temp.id('intake_bravo')),
  ARRAY['only_b@example.test', 'two@example.test'], 'and a firm''s alert still goes to all its current members');
SELECT pg_temp.as_owner();
SELECT set_config('request.jwt.claims', '', false), pg_temp.at('bravo-brokers'), set_config('role', 'anon', false);
SELECT pg_temp.is(public.firm_public_name('alpha-advisory'), 'Alpha Advisory', 'signed out, a firm''s public name is shown whatever address is sent');
SELECT pg_temp.is(pg_temp.sight(), pg_temp.all_of('-'), 'and no firm''s row, as before');
SELECT pg_temp.as_user('prospect', 'alpha-advisory');
SELECT pg_temp.is((SELECT count(*) FROM public.chamber_sessions), 4::bigint, 'a prospect reads all four of their own intakes at any address: their own rows are not a firm''s to narrow');
SELECT pg_temp.as_user('two', 'bravo-brokers', 'password', 'aal1');
SELECT pg_temp.is(pg_temp.sight(), pg_temp.all_of('-'), 'a password sign-in still owes its second factor at an address (D-19)');
SELECT pg_temp.as_user('two', 'bravo-brokers', 'password', 'aal2');
SELECT pg_temp.is(pg_temp.sight(), pg_temp.all_of('b'), 'and reads its firm once it is done');

-- ---------- 10. a write for "the caller's firm" lands in the address's firm ----------
-- firm_to_act_for() is the one place a function picks "the caller's firm" when the call names none (20261116200000; the
-- referral-partner functions call it). It runs inside its callers, as their owner, with the caller's token and headers.
SELECT pg_temp.acting_as('two');
SELECT pg_temp.expect('SELECT public.firm_to_act_for(NULL)::text', '22023', 'with no address, a member of two firms is asked which firm');
SELECT pg_temp.acting_as('two', 'bravo-brokers');
SELECT pg_temp.expect('SELECT public.firm_to_act_for(NULL)::text', 'ok:' || pg_temp.id('bravo'), 'at Bravo''s address, a write naming no firm is for Bravo');
SELECT pg_temp.expect($$SELECT public.firm_to_act_for('$$ || pg_temp.id('alpha') || $$')::text$$, '42501', 'and one that names Alpha is refused there');
SELECT pg_temp.acting_as('two', 'alpha-advisory');
SELECT pg_temp.expect('SELECT public.firm_to_act_for(NULL)::text', 'ok:' || pg_temp.id('alpha'), 'at Alpha''s address, for Alpha');
SELECT pg_temp.acting_as('two', 'nowhere-at-all');
SELECT pg_temp.expect('SELECT public.firm_to_act_for(NULL)::text', '42501', 'at an address no firm holds, for none');
SELECT pg_temp.as_user('two', 'bravo-brokers');
SELECT pg_temp.expect($$INSERT INTO public.advisor_notes (session_id, author_id, body) VALUES ('$$ || pg_temp.id('intake_alpha') || $$', auth.uid(), 'x') RETURNING 1$$,
  '42501', 'a note on Alpha''s intake is refused there');
SELECT pg_temp.expect($$INSERT INTO public.advisor_notes (session_id, author_id, body) VALUES ('$$ || pg_temp.id('intake_bravo') || $$', auth.uid(), 'x') RETURNING 1$$,
  'ok:1', 'and one on Bravo''s is taken');
SELECT pg_temp.as_user('two', 'alpha-advisory');
SELECT pg_temp.expect($$SELECT public.invite_member('$$ || pg_temp.id('bravo') || $$', 'new@example.test', 'agent', NULL, repeat('c', 64))::text$$, '42501',
  'and Bravo''s owner invites no one to Bravo from Alpha''s address');

-- ---------- 11. platform admins ----------
SELECT pg_temp.as_user('platform_admin');
CREATE TEMP TABLE admin_waiting AS SELECT count(*) AS n FROM public.admin_waiting_firms();
GRANT SELECT ON admin_waiting TO authenticated;
SELECT pg_temp.as_user('platform_admin', 'alpha-advisory');
SELECT pg_temp.is(pg_temp.sight(), pg_temp.all_of('-'), 'a platform admin who belongs to no firm reads nothing of a firm at its address (D-16)');
SELECT pg_temp.is((SELECT count(*) FROM public.my_firms()), 0::bigint, 'and is told of no firm');
SELECT pg_temp.is((SELECT count(*) FROM public.admin_waiting_firms()), (SELECT n FROM admin_waiting), 'and their own list of waiting firms is the same at any address');
SELECT pg_temp.as_user('admin_w', 'alpha-advisory');
SELECT pg_temp.expect($$SELECT public.admin_decide_firm('$$ || pg_temp.id('waiting') || $$', true)::text$$, '42501',
  'a platform admin who belongs to a waiting firm can''t approve it by sending another firm''s address');
SELECT pg_temp.as_user('admin_w', 'nowhere-at-all');
SELECT pg_temp.expect($$SELECT public.admin_decide_firm('$$ || pg_temp.id('waiting') || $$', true)::text$$, '42501', 'nor an address no firm holds');
SELECT pg_temp.as_user('admin_w');
SELECT pg_temp.expect($$SELECT public.admin_decide_firm('$$ || pg_temp.id('waiting') || $$', true)::text$$, '42501', 'nor with no address, as before');
SELECT pg_temp.as_user('platform_admin', 'alpha-advisory');
SELECT pg_temp.expect($$SELECT public.admin_decide_firm('$$ || pg_temp.id('waiting') || $$', true)::text$$, 'ok:', 'an admin who isn''t a member decides it at any address');

-- ---------- 12. the person's own firms, and the firms they own ----------
SELECT pg_temp.as_user('two', 'alpha-advisory');
SELECT pg_temp.is((SELECT array_agg(firm_id ORDER BY name) FROM public.my_firms()), ARRAY[pg_temp.id('alpha'), pg_temp.id('bravo')],
  'the list of a person''s own firms is not narrowed: at Alpha''s address it still names both');
SELECT pg_temp.is(public.is_member_of_firm_address('bravo-brokers'), true, 'and asked about Bravo''s address, the answer is about that address');
SELECT pg_temp.is((SELECT count(*) FROM public.my_owner_firms()), 0::bigint, 'the firms they own, at Alpha''s address where they own none: none');
SELECT pg_temp.as_user('two', 'bravo-brokers');
SELECT pg_temp.is((SELECT array_agg(firm_id) FROM public.my_owner_firms()), ARRAY[pg_temp.id('bravo')], 'at Bravo''s: Bravo');
SELECT pg_temp.is(public.my_firm_at_address('bravo-brokers'), pg_temp.id('bravo'), 'and the firm at the address is Bravo');
SELECT pg_temp.as_user('two');
SELECT pg_temp.is((SELECT array_agg(firm_id) FROM public.my_owner_firms()), ARRAY[pg_temp.id('bravo')], 'with no address: Bravo, as before');
SELECT pg_temp.as_user('two', 'nowhere-at-all');
SELECT pg_temp.is((SELECT count(*) FROM public.my_firms()), 2::bigint, 'at an address no firm holds, the person''s own firms are still listed');

-- A refused firm is still the person's (its address stays taken, D-31), but its address shows nothing, so "Choose a firm"
-- leaves it out: my_firms says which of the person's firms were refused.
SELECT pg_temp.as_user('founder_r');
SELECT pg_temp.is((SELECT array_agg(refused) FROM public.my_firms()), ARRAY[true], 'my_firms says a refused firm was refused');
SELECT pg_temp.as_user('two');
SELECT pg_temp.is((SELECT array_agg(refused) FROM public.my_firms()), ARRAY[false, false], 'and that approved firms were not');
SELECT pg_temp.as_user('founder_w');
SELECT pg_temp.is((SELECT array_agg(refused) FROM public.my_firms()), ARRAY[false], 'nor a firm still waiting for approval');

-- ---------- 13. the helper ----------
SELECT pg_temp.as_owner();
DO $$
DECLARE
  f record;
BEGIN
  FOR f IN SELECT p.oid, p.proname, p.provolatile, p.prosecdef, p.proconfig, p.prosrc
           FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'address_admits_firm' LOOP
    IF f.provolatile <> 's' THEN RAISE EXCEPTION 'FAIL: % is not STABLE', f.proname; END IF;
    IF NOT EXISTS (SELECT 1 FROM unnest(f.proconfig) c WHERE c LIKE 'search_path=%') THEN RAISE EXCEPTION 'FAIL: % has no fixed search_path', f.proname; END IF;
    IF f.prosrc ~* '\mexecute\M|format\s*\(' THEN RAISE EXCEPTION 'FAIL: % builds SQL', f.proname; END IF;
    IF has_function_privilege('anon', f.oid, 'EXECUTE') OR has_function_privilege('authenticated', f.oid, 'EXECUTE')
       OR has_function_privilege('service_role', f.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL: % is callable through the API', f.proname;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'address_admits_firm') <> 1 THEN
    RAISE EXCEPTION 'FAIL: the helper is not there';
  END IF;
END $$;
\echo one_firm_at_a_time: ok
