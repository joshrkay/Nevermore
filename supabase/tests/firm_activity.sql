-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh firm_activity
-- The record of who did what (story CRM-P2.3 with Q-3.1; docs/BROKER_CRM_BUILD.md D-16, D-24;
-- 20261116160000_firm_activity.sql). Two firms, each with an owner, and the first with a lead and an agent; a platform
-- admin who belongs to neither. Proves: an entry says who, when, what kind of thing and which record, and never holds
-- content; the function that writes one works out the firm and the actor itself and can't be told otherwise; it is
-- wired to a submission opened, a document or packet downloaded, a send recorded and every membership change; nobody
-- changes or deletes an entry, an admin included; only a firm's owners read their own firm's record, by person and by
-- kind, newest first and in pages; entries older than the window are pruned by the one job allowed to.
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
\i supabase/migrations/20261116140000_firm_address_lookup.sql
\i supabase/migrations/20261116150000_second_factor_for_password_sign_ins.sql
\i supabase/migrations/20261116160000_firm_activity.sql
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

-- The entries of one firm as the table holds them (read as the table's owner, to check what was written), oldest first.
CREATE FUNCTION pg_temp.entries(firm uuid) RETURNS TABLE (actor text, kind text, record_type text, record_id text) LANGUAGE sql AS $$
  SELECT (SELECT n.name FROM fx n WHERE n.id = a.actor_id), a.kind, a.record_type, a.record_id
  FROM public.firm_activity a WHERE a.firm_id = firm ORDER BY a.id;
$$;

-- ---------- two firms ----------
-- Firm A is Edgar Allan Advisory, which the firms migration created. Firm B is another brokerage.
DO $$
DECLARE
  n text;
  sid uuid;
BEGIN
  FOREACH n IN ARRAY ARRAY['owner_a', 'lead_a', 'agent_a', 'owner_b', 'agent_b', 'platform_admin', 'prospect_a', 'prospect_b'] LOOP
    PERFORM pg_temp.new_user(n);
  END LOOP;
  INSERT INTO fx VALUES ('firm_a', public.default_firm_id());
  INSERT INTO fx VALUES ('firm_b', gen_random_uuid());
  INSERT INTO public.firms (id, name, address, approved_at) VALUES (pg_temp.id('firm_b'), 'Beta Brokers', 'beta-brokers', now());
  INSERT INTO public.user_roles (user_id, role) VALUES
    (pg_temp.id('platform_admin'), 'admin'), (pg_temp.id('owner_a'), 'advisor'), (pg_temp.id('lead_a'), 'advisor'),
    (pg_temp.id('agent_a'), 'advisor'), (pg_temp.id('owner_b'), 'advisor'), (pg_temp.id('agent_b'), 'advisor');
  -- One submission in each firm.
  FOREACH n IN ARRAY ARRAY['a', 'b'] LOOP
    INSERT INTO public.chamber_sessions (user_id, firm_id, chamber_data)
    VALUES (pg_temp.id('prospect_' || n), pg_temp.id('firm_' || n), jsonb_build_object('company_name', 'Co ' || n))
    RETURNING id INTO sid;
    INSERT INTO fx VALUES ('intake_' || n, sid);
  END LOOP;
END $$;

-- Memberships are added after the migration, so each one is recorded. They are added as the service does it (the
-- table's owner): nobody writes memberships through the API.
SELECT pg_temp.as_owner();
INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES
  (pg_temp.id('firm_a'), pg_temp.id('owner_a'), 'owner'),
  (pg_temp.id('firm_a'), pg_temp.id('lead_a'), 'lead'),
  (pg_temp.id('firm_a'), pg_temp.id('agent_a'), 'agent'),
  (pg_temp.id('firm_b'), pg_temp.id('owner_b'), 'owner'),
  (pg_temp.id('firm_b'), pg_temp.id('agent_b'), 'agent');

-- ---------- 1. A person opening a submission is recorded, in the submission's firm, as that person ----------
SELECT pg_temp.as_user('agent_a');
SELECT public.record_member_activity('submission_viewed', 'submission', pg_temp.id('intake_a')::text);
SELECT pg_temp.as_owner();
SELECT pg_temp.is((SELECT count(*) FROM pg_temp.entries(pg_temp.id('firm_a')) WHERE actor = 'agent_a' AND kind = 'submission_viewed'
  AND record_type = 'submission' AND record_id = pg_temp.id('intake_a')::text), 1::bigint, 'an opened submission is recorded in its firm as the person who opened it');


-- ---------- 2. Membership changes are recorded, whoever makes them ----------
-- The memberships added in the set-up above each wrote an entry about themselves; the service made them, so no person.
SELECT pg_temp.as_owner();
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'owner_added' AND firm_id = pg_temp.id('firm_a')
  AND subject_user_id = pg_temp.id('owner_a') AND role = 'owner' AND actor_id IS NULL AND record_type = 'membership'), 1::bigint,
  'a new owner is recorded as an ownership change, about that person, with no person behind a change the service made');
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'member_added' AND firm_id = pg_temp.id('firm_a')
  AND subject_user_id = pg_temp.id('lead_a') AND role = 'lead'), 1::bigint, 'a new lead is recorded with their role');

-- Ending a membership as a function acting for an owner records that owner as the actor.
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.id('owner_a'), 'role', 'authenticated')::text, false);
UPDATE public.firm_memberships SET valid_until = now() + interval '1 day' WHERE user_id = pg_temp.id('agent_a');
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'member_ended' AND subject_user_id = pg_temp.id('agent_a')
  AND actor_id = pg_temp.id('owner_a') AND role = 'agent'), 1::bigint, 'ending a membership records who ended it');
-- A role change is an end and an add; the old owner ending is an ownership change too.
INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (pg_temp.id('firm_b'), pg_temp.id('lead_a'), 'owner');
UPDATE public.firm_memberships SET valid_until = now() + interval '1 hour' WHERE user_id = pg_temp.id('owner_b');
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'owner_ended' AND subject_user_id = pg_temp.id('owner_b')
  AND firm_id = pg_temp.id('firm_b')), 1::bigint, 'an owner ending is recorded as an ownership change');
-- Touching a membership without ending it records nothing.
DO $$
DECLARE before_count bigint := (SELECT count(*) FROM public.firm_activity);
BEGIN
  UPDATE public.firm_memberships SET valid_until = valid_until WHERE user_id = pg_temp.id('lead_a') AND firm_id = pg_temp.id('firm_a');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity), before_count, 'an update that ends nothing is not a change');
END $$;
-- Removing an account removes its memberships; the record of them stays, once, and only for those still current.
DELETE FROM auth.users WHERE id = pg_temp.id('agent_b');
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'member_ended' AND subject_user_id = pg_temp.id('agent_b')
  AND firm_id = pg_temp.id('firm_b')), 1::bigint, 'a membership removed with its account is recorded');
SELECT pg_temp.new_user('former_a');
INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (pg_temp.id('firm_a'), pg_temp.id('former_a'), 'agent');
UPDATE public.firm_memberships SET valid_until = now() WHERE user_id = pg_temp.id('former_a');
DELETE FROM auth.users WHERE id = pg_temp.id('former_a');
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'member_ended' AND subject_user_id = pg_temp.id('former_a')), 1::bigint,
  'removing the account of someone whose membership had already ended records no second end');
SELECT pg_temp.as_owner();

-- ---------- 3. A recorded send is recorded ----------
DO $$
DECLARE
  uid uuid := pg_temp.new_user('prospect_c');
  sid uuid;
  q jsonb;
BEGIN
  PERFORM pg_temp.as_user('prospect_c');
  PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, jsonb_build_object('company_name', 'Gamma Co', 'states', jsonb_build_array('NY'),
    'pay_frequency', 'bi-weekly', 'employee_count', 12, 'start_month', 'April')) RETURNING id INTO sid;
  UPDATE public.chamber_sessions SET status = 'submitted', submission = jsonb_build_object('signer_name', 'Jo Doe', 'signer_title', 'CEO',
    'signed_at', '2026-11-04T12:00:00Z', 'consent_version', '2026-10-draft-1', 'consent_text', '["I certify."]'::jsonb, 'chamber_data', chamber_data)
  WHERE id = sid;
  INSERT INTO fx VALUES ('intake_c', sid);
  PERFORM pg_temp.as_user('agent_a');
  PERFORM public.set_submission_status(sid, 'under_review', NULL);
  PERFORM public.set_submission_status(sid, 'ready_for_market', NULL);
  q := public.advisor_record_quote_send(sid, 'TriNet', '2026-11-10');
  PERFORM set_config('test.quote_request', q ->> 'id', false);
END $$;
SELECT pg_temp.as_owner();
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'send_recorded' AND firm_id = pg_temp.id('firm_a')
  AND actor_id = pg_temp.id('agent_a') AND record_type = 'quote_request' AND record_id = current_setting('test.quote_request')), 1::bigint,
  'a recorded send is recorded in the submission''s firm as the advisor who recorded it');

-- ---------- 4. A document or a packet downloaded is recorded; no one reports for a firm they don't belong to ----------
DO $$
DECLARE
  doc uuid;
  ms uuid;
BEGIN
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, category, size_bytes, mime_type)
  VALUES (pg_temp.id('prospect_a'), pg_temp.id('intake_a'), 'census.csv', '1 KB', 'a/census.csv', 'employee_census', 1024, 'text/csv')
  RETURNING id INTO doc;
  INSERT INTO public.manuscript_versions (session_id, version, file_id, storage_path, pdf_sha256, certified_data_hash, certified_signed_at, generated_by)
  VALUES (pg_temp.id('intake_a'), 1, 'EAA-2026-000001', 'a/1.pdf', repeat('a', 64), 'h', now(), pg_temp.id('agent_a'))
  RETURNING id INTO ms;
  INSERT INTO fx VALUES ('doc_a', doc), ('manuscript_a', ms);
END $$;

SELECT pg_temp.as_user('lead_a');
SELECT public.record_member_activity('document_downloaded', 'document', pg_temp.id('doc_a')::text);
SELECT public.record_member_activity('packet_downloaded', 'manuscript', pg_temp.id('manuscript_a')::text);
SELECT pg_temp.as_owner();
SELECT pg_temp.is((SELECT count(*) FROM pg_temp.entries(pg_temp.id('firm_a')) WHERE actor = 'lead_a' AND kind = 'document_downloaded'
  AND record_type = 'document' AND record_id = pg_temp.id('doc_a')::text), 1::bigint, 'a document download is recorded in its firm');
SELECT pg_temp.is((SELECT count(*) FROM pg_temp.entries(pg_temp.id('firm_a')) WHERE actor = 'lead_a' AND kind = 'packet_downloaded'
  AND record_type = 'manuscript' AND record_id = pg_temp.id('manuscript_a')::text), 1::bigint, 'a packet download is recorded in its firm');

-- A member of the other firm, a platform admin who belongs to no firm, and a guest can't write an entry about firm A's records.
SELECT pg_temp.as_user('agent_b');
SELECT pg_temp.expect(format('SELECT public.record_member_activity(%L, %L, %L)', 'submission_viewed', 'submission', pg_temp.id('intake_a')),
  '42501', 'another firm''s member reporting a view of this firm''s submission');
SELECT pg_temp.as_user('platform_admin');
SELECT pg_temp.expect(format('SELECT public.record_member_activity(%L, %L, %L)', 'submission_viewed', 'submission', pg_temp.id('intake_a')),
  '42501', 'a platform admin who is no member reporting a view');
-- A browser can't write the kinds the system writes, nor call the writer behind them directly.
SELECT pg_temp.as_user('owner_a');
SELECT pg_temp.expect(format('SELECT public.record_member_activity(%L, %L, %L)', 'member_added', 'firm', pg_temp.id('firm_a')),
  '42501', 'a browser reporting a membership change');
SELECT pg_temp.expect(format('SELECT public.record_firm_activity(%L, %L, %L)', 'submission_viewed', 'submission', pg_temp.id('intake_a')),
  '42501', 'a browser calling the writer');
SELECT pg_temp.expect(format('INSERT INTO public.firm_activity (firm_id, kind, record_type, record_id) VALUES (%L, %L, %L, %L)',
  pg_temp.id('firm_a'), 'submission_viewed', 'submission', 'x'), '42501', 'inserting an entry straight into the table');
SELECT pg_temp.as_owner();
UPDATE auth.users SET is_anonymous = true WHERE id = pg_temp.id('prospect_b');
SELECT pg_temp.as_user('prospect_b');
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.id('prospect_b'), 'role', 'authenticated', 'is_anonymous', true)::text, false);
SELECT pg_temp.expect(format('SELECT public.record_member_activity(%L, %L, %L)', 'submission_viewed', 'submission', pg_temp.id('intake_b')),
  '42501', 'a guest token reporting a view');
SELECT pg_temp.as_owner();

-- A browser reports only the pairs of kind and record that can happen: a mismatched pair is a false entry.
SELECT pg_temp.as_user('agent_a');
SELECT pg_temp.expect(format('SELECT public.record_member_activity(%L, %L, %L)', 'document_downloaded', 'membership',
  (SELECT m.id FROM public.firm_memberships m WHERE m.user_id = pg_temp.id('owner_a'))), '42501', 'a download of a membership');
SELECT pg_temp.expect(format('SELECT public.record_member_activity(%L, %L, %L)', 'submission_viewed', 'firm', pg_temp.id('firm_a')),
  '42501', 'a view of a firm');
SELECT pg_temp.expect(format('SELECT public.record_member_activity(%L, %L, %L)', 'packet_downloaded', 'document', pg_temp.id('doc_a')),
  '42501', 'a packet download of a document');
SELECT pg_temp.expect(format('SELECT public.record_member_activity(%L, %L, %L)', 'submission_viewed', 'document', pg_temp.id('doc_a')),
  '42501', 'a view of a document');
-- A file attached to a PEO's mail is a document download against the quote request it came in on.
SELECT public.record_member_activity('document_downloaded', 'quote_request', current_setting('test.quote_request'));
SELECT pg_temp.expect(format('SELECT public.record_member_activity(%L, %L, %L)', 'packet_downloaded', 'quote_request', current_setting('test.quote_request')),
  '42501', 'a packet download of a quote request');
SELECT pg_temp.as_owner();
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'document_downloaded' AND record_type = 'quote_request'
  AND record_id = current_setting('test.quote_request') AND actor_id = pg_temp.id('agent_a') AND firm_id = pg_temp.id('firm_a')), 1::bigint,
  'a mail attachment opened is recorded against its quote request, in its firm');
SELECT pg_temp.as_user('agent_a');
-- A download of the submission's own files (census, answers, applications, bundle) is a document download of the submission.
SELECT public.record_member_activity('document_downloaded', 'submission', pg_temp.id('intake_a')::text);
SELECT pg_temp.as_owner();
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'document_downloaded' AND record_type = 'submission'
  AND actor_id = pg_temp.id('agent_a')), 1::bigint, 'a file of a submission downloaded is recorded against the submission');
-- The same person reporting the same thing again straight away is one entry, so a loop can't flood the record.
SELECT pg_temp.as_user('agent_a');
SELECT public.record_member_activity('document_downloaded', 'submission', pg_temp.id('intake_a')::text);
SELECT public.record_member_activity('document_downloaded', 'submission', pg_temp.id('intake_a')::text);
SELECT pg_temp.as_owner();
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'document_downloaded' AND record_type = 'submission'
  AND actor_id = pg_temp.id('agent_a')), 1::bigint, 'reporting the same download again within moments adds nothing');
-- Past the half minute the same report is a new entry: an owner must see a member open the same file a second time.
SELECT pg_temp.as_owner();
ALTER TABLE public.firm_activity DISABLE TRIGGER firm_activity_append_only;
UPDATE public.firm_activity SET at = now() - interval '31 seconds' WHERE kind = 'document_downloaded' AND record_type = 'submission'
  AND actor_id = pg_temp.id('agent_a');
ALTER TABLE public.firm_activity ENABLE TRIGGER firm_activity_append_only;
SELECT pg_temp.as_user('agent_a');
SELECT public.record_member_activity('document_downloaded', 'submission', pg_temp.id('intake_a')::text);
SELECT pg_temp.as_owner();
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'document_downloaded' AND record_type = 'submission'
  AND actor_id = pg_temp.id('agent_a')), 2::bigint, 'reporting the same download again after the half minute is a second entry');
SELECT pg_temp.as_user('lead_a');
SELECT public.record_member_activity('document_downloaded', 'submission', pg_temp.id('intake_a')::text);
SELECT pg_temp.as_owner();
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'document_downloaded' AND record_type = 'submission'
  AND actor_id = pg_temp.id('lead_a')), 1::bigint, 'someone else reporting the same download is their own entry, not hidden by the first');
-- A browser is not told the number of the entry it wrote: numbering is shared by every firm.
SELECT pg_temp.is((SELECT prorettype::regtype::text FROM pg_proc WHERE proname = 'record_member_activity'), 'void',
  'the browser function hands back nothing, so ids cannot be used to count other firms'' entries');

-- The only writer other code calls works out the actor itself: there is no second writer that is handed one.
SELECT pg_temp.is(to_regprocedure('public.record_firm_activity_as(uuid, text, text, text)') IS NULL, true, 'no writer takes an actor from a server function');
SELECT pg_temp.is((SELECT count(*) FROM pg_proc p WHERE p.proname LIKE 'record\_%activity%' AND p.pronamespace = 'public'::regnamespace), 3::bigint,
  'the writers are record_firm_activity, record_member_activity and the send trigger function');

-- The service writes any kind and is no one: its entry has no actor, and it can't name one.
SELECT pg_temp.as_service();
SELECT public.record_firm_activity('export_made', 'firm', pg_temp.id('firm_a')::text);
SELECT pg_temp.as_owner();
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'export_made' AND firm_id = pg_temp.id('firm_a') AND actor_id IS NULL), 1::bigint,
  'a server function writes an export entry for the firm of the record, with no actor of its own');
SELECT pg_temp.is((SELECT count(*) FROM pg_proc p WHERE p.proname IN ('record_firm_activity', 'record_member_activity')
  AND p.proargnames && ARRAY['p_actor_id', 'p_actor', 'p_firm_id', 'p_user_id']), 0::bigint, 'no writer takes an actor or a firm as an argument');

SELECT pg_temp.as_service();
SELECT pg_temp.expect(format('INSERT INTO public.firm_activity (firm_id, actor_id, kind, record_type, record_id) VALUES (%L, %L, %L, %L, %L)',
  pg_temp.id('firm_a'), pg_temp.id('owner_a'), 'export_made', 'firm', 'x'), '42501', 'a server function naming an actor by writing the table itself');
SELECT pg_temp.as_owner();

-- ---------- 5. An entry holds no content ----------
SELECT pg_temp.as_service();
SELECT pg_temp.expect(format('SELECT public.record_firm_activity(%L, %L, %L)', 'export_made', 'firm', 'jane@acme.test'), '22P02', 'an email address as a record id');
SELECT pg_temp.as_owner();
SELECT pg_temp.expect(format('INSERT INTO public.firm_activity (firm_id, kind, record_type, record_id) VALUES (%L, %L, %L, %L)',
  pg_temp.id('firm_a'), 'submission_viewed', 'submission', 'Acme Co, 12 employees'), '23514', 'free text as a record id');
SELECT pg_temp.expect(format('INSERT INTO public.firm_activity (firm_id, kind, record_type, record_id) VALUES (%L, %L, %L, %L)',
  pg_temp.id('firm_a'), 'something_else', 'submission', 'x'), '23514', 'a kind nobody defined');
SELECT pg_temp.is((SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'firm_activity'
  AND column_name IN ('detail', 'details', 'note', 'body', 'message', 'content', 'email', 'name', 'payload')), 0::bigint, 'the table has no column for content');

-- ---------- 6. Nobody changes or deletes an entry ----------
SELECT pg_temp.as_owner();
CREATE TEMP TABLE one_entry AS SELECT min(id) AS id FROM public.firm_activity WHERE firm_id = pg_temp.id('firm_a');
GRANT SELECT ON one_entry TO authenticated, service_role;
DO $$
DECLARE
  who text;
BEGIN
  FOREACH who IN ARRAY ARRAY['owner_a', 'platform_admin', 'agent_a', 'service', 'table owner'] LOOP
    IF who = 'service' THEN PERFORM pg_temp.as_service();
    ELSIF who = 'table owner' THEN PERFORM pg_temp.as_owner();
    ELSE PERFORM pg_temp.as_user(who);
    END IF;
    PERFORM pg_temp.expect('UPDATE public.firm_activity SET kind = ''sign_in'' WHERE id = (SELECT id FROM one_entry)',
      '42501', 'update by ' || who);
    PERFORM pg_temp.expect('DELETE FROM public.firm_activity WHERE id = (SELECT id FROM one_entry)', '42501', 'delete by ' || who);
    PERFORM pg_temp.expect('TRUNCATE public.firm_activity', '42501', 'truncate by ' || who);
  END LOOP;
  -- Saying a prune is under way changes nothing for anyone but the retention job's own function.
  PERFORM pg_temp.as_user('owner_a');
  PERFORM set_config('eaa.pruning_firm_activity', 'on', false);
  PERFORM pg_temp.expect('DELETE FROM public.firm_activity WHERE id = (SELECT id FROM one_entry)', '42501', 'delete by an owner who says it is a prune');
  PERFORM set_config('eaa.pruning_firm_activity', '', false);
  PERFORM pg_temp.as_owner();
  PERFORM set_config('eaa.pruning_firm_activity', 'on', false);
  PERFORM pg_temp.expect('DELETE FROM public.firm_activity WHERE id = (SELECT id FROM one_entry)', '42501', 'delete by the table owner who says it is a prune');
  PERFORM pg_temp.as_service();
  PERFORM set_config('eaa.pruning_firm_activity', 'on', false);
  PERFORM pg_temp.expect('DELETE FROM public.firm_activity WHERE id = (SELECT id FROM one_entry)', '42501', 'delete by the service who says it is a prune');
  PERFORM pg_temp.as_owner();
  PERFORM set_config('eaa.pruning_firm_activity', 'on', false);
  PERFORM pg_temp.expect('UPDATE public.firm_activity SET kind = ''sign_in'' WHERE id = (SELECT id FROM one_entry)', '42501', 'an update, whatever is said');
  PERFORM set_config('eaa.pruning_firm_activity', '', false);
END $$;
SELECT pg_temp.as_owner();

-- ---------- 7. A firm's owners read their firm's record, filtered and paged, newest first ----------
CREATE FUNCTION pg_temp.ids(p_firm text, p_person text DEFAULT NULL, p_kind text DEFAULT NULL, lim integer DEFAULT 50, after_id bigint DEFAULT NULL)
RETURNS bigint[] LANGUAGE sql AS $$
  SELECT COALESCE(array_agg(e.id ORDER BY ord), '{}') FROM public.firm_activity_list(pg_temp.id(p_firm),
    CASE WHEN p_person IS NULL THEN NULL ELSE pg_temp.id(p_person) END, p_kind, lim,
    (SELECT c.at FROM public.firm_activity c WHERE c.id = after_id), after_id) WITH ORDINALITY AS e(id, at, actor_id, actor_email, kind, record_type,
    record_id, subject_user_id, subject_email, role, ord);
$$;
CREATE FUNCTION pg_temp.truth(p_firm text, p_person text DEFAULT NULL, p_kind text DEFAULT NULL) RETURNS bigint[] LANGUAGE sql AS $$
  SELECT COALESCE(array_agg(a.id ORDER BY a.at DESC, a.id DESC), '{}') FROM public.firm_activity a
  WHERE a.firm_id = pg_temp.id(p_firm) AND (p_person IS NULL OR a.actor_id = pg_temp.id(p_person)) AND (p_kind IS NULL OR a.kind = p_kind);
$$;
GRANT EXECUTE ON FUNCTION pg_temp.ids(text, text, text, integer, bigint), pg_temp.truth(text, text, text) TO authenticated;
-- Entries at known times, so "newest first" is not just the order they were inserted in.
SELECT pg_temp.as_owner();
ALTER TABLE public.firm_activity DISABLE TRIGGER firm_activity_append_only;
UPDATE public.firm_activity SET at = now() - interval '10 days' WHERE kind = 'submission_viewed' AND firm_id = pg_temp.id('firm_a');
UPDATE public.firm_activity SET at = now() - interval '9 days' WHERE kind = 'document_downloaded';
UPDATE public.firm_activity SET at = now() - interval '40 days' WHERE kind = 'packet_downloaded';
ALTER TABLE public.firm_activity ENABLE TRIGGER firm_activity_append_only;

SELECT pg_temp.as_user('owner_a');
SELECT pg_temp.is(pg_temp.ids('firm_a'), pg_temp.truth('firm_a'), 'an owner reads every entry of their firm, newest first');
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity_list(pg_temp.id('firm_a')) WHERE record_id = pg_temp.id('intake_b')::text), 0::bigint,
  'the other firm''s entries are not among them');
SELECT pg_temp.is(pg_temp.ids('firm_a', 'agent_a'), pg_temp.truth('firm_a', 'agent_a'), 'filtered by person');
SELECT pg_temp.is(cardinality(pg_temp.ids('firm_a', 'agent_a')) > 0 AND cardinality(pg_temp.ids('firm_a', 'agent_a')) < cardinality(pg_temp.ids('firm_a')), true,
  'the person filter keeps some entries and drops others');
SELECT pg_temp.is(pg_temp.ids('firm_a', NULL, 'document_downloaded'), pg_temp.truth('firm_a', NULL, 'document_downloaded'), 'filtered by kind');
SELECT pg_temp.is(pg_temp.ids('firm_a', 'lead_a', 'packet_downloaded'), pg_temp.truth('firm_a', 'lead_a', 'packet_downloaded'), 'filtered by person and kind');
SELECT pg_temp.is(cardinality(pg_temp.ids('firm_a', 'agent_a', 'packet_downloaded')), 0, 'a person and kind that never met match nothing');
SELECT pg_temp.is((SELECT at FROM public.firm_activity_list(pg_temp.id('firm_a'), NULL, NULL, 1, NULL, NULL)), (SELECT max(at) FROM public.firm_activity), 'the newest entry is first');
SELECT pg_temp.is((SELECT l.kind FROM public.firm_activity_list(pg_temp.id('firm_a')) l ORDER BY l.at ASC LIMIT 1), 'packet_downloaded', 'an old entry made late sorts by when it happened, not by when it was written');
SELECT pg_temp.is(pg_temp.ids('firm_a', NULL, NULL, 1, (pg_temp.truth('firm_a'))[cardinality(pg_temp.truth('firm_a')) - 1]),
  ARRAY[(pg_temp.truth('firm_a'))[cardinality(pg_temp.truth('firm_a'))]], 'the oldest entry is last');
SELECT pg_temp.is(pg_temp.ids('firm_a', NULL, NULL, 2) || pg_temp.ids('firm_a', NULL, NULL, 2, (pg_temp.ids('firm_a', NULL, NULL, 2))[2]),
  (pg_temp.truth('firm_a'))[1:4], 'pages follow one another without a gap or a repeat');
-- Entries that arrive between two pages change neither: the next page starts after the last entry the reader saw.
SELECT set_config('test.page_one', pg_temp.ids('firm_a', NULL, NULL, 2)::text, false);
SELECT set_config('test.page_rest', (pg_temp.truth('firm_a'))[3:4]::text, false);
SELECT pg_temp.as_owner();
INSERT INTO public.firm_activity (firm_id, kind, record_type, record_id) VALUES (pg_temp.id('firm_a'), 'invitation_sent', 'firm', pg_temp.id('firm_a')::text);
SELECT pg_temp.as_user('owner_a');
SELECT pg_temp.is(pg_temp.ids('firm_a', NULL, NULL, 2, (current_setting('test.page_one')::bigint[])[2])::text, current_setting('test.page_rest'),
  'an entry arriving between two pages makes the next page neither repeat nor skip a row');
-- Two entries with the very same time are told apart by their ids: a page can end between them.
SELECT pg_temp.as_owner();
INSERT INTO public.firm_activity (firm_id, kind, record_type, record_id, at) VALUES
  (pg_temp.id('firm_a'), 'support_access', 'firm', pg_temp.id('firm_a')::text, now() - interval '5 days'),
  (pg_temp.id('firm_a'), 'support_access', 'firm', pg_temp.id('firm_a')::text, now() - interval '5 days');
SELECT pg_temp.as_user('owner_a');
SELECT pg_temp.is(pg_temp.ids('firm_a', NULL, 'support_access', 1, (pg_temp.ids('firm_a', NULL, 'support_access', 1))[1]),
  ARRAY[(pg_temp.truth('firm_a', NULL, 'support_access'))[2]], 'a page ending between two entries of the same time continues with the other');
SELECT pg_temp.expect(format('SELECT * FROM public.firm_activity_list(%L, NULL, NULL, 101, NULL, NULL)', pg_temp.id('firm_a')), '22023', 'a page of more than 100');
SELECT pg_temp.expect(format('SELECT * FROM public.firm_activity_list(%L, NULL, NULL, 10, now(), NULL)', pg_temp.id('firm_a')), '22023', 'a cursor with a time and no id');
SELECT pg_temp.expect(format('SELECT * FROM public.firm_activity_list(%L, NULL, NULL, 10, NULL, 5)', pg_temp.id('firm_a')), '22023', 'a cursor with an id and no time');
SELECT pg_temp.is((SELECT actor_email FROM public.firm_activity_list(pg_temp.id('firm_a'), pg_temp.id('lead_a'), 'packet_downloaded')), 'lead_a@example.test',
  'an entry names its person');
SELECT pg_temp.is((SELECT array_agg(email ORDER BY email) FROM public.firm_activity_people(pg_temp.id('firm_a'))),
  ARRAY['agent_a@example.test', 'lead_a@example.test', 'owner_a@example.test'], 'the people in the filter are those who appear in the firm''s record');
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity), (SELECT count(*) FROM public.firm_activity WHERE firm_id = pg_temp.id('firm_a')),
  'reading the table directly shows only their own firm''s rows');

-- Which firms a signed-in person may read the record of: those they currently own, none for anyone else. The firm to read is
-- always named by the caller, and the read checks they own that one, so an owner of two firms reaches both.
SELECT pg_temp.as_owner();
SELECT pg_temp.new_user('owner_ab');
INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES
  (pg_temp.id('firm_a'), pg_temp.id('owner_ab'), 'owner'), (pg_temp.id('firm_b'), pg_temp.id('owner_ab'), 'owner');
SELECT pg_temp.as_user('owner_a');
SELECT pg_temp.is((SELECT array_agg(firm_id) FROM public.my_owner_firms()), ARRAY[pg_temp.id('firm_a')], 'an owner is told their firm');
SELECT pg_temp.as_user('owner_ab');
SELECT pg_temp.is((SELECT array_agg(firm_id) FROM public.my_owner_firms()), ARRAY[pg_temp.id('firm_b'), pg_temp.id('firm_a')],
  'an owner of two firms is told both, in the order of their names (Beta Brokers, Edgar Allan Advisory)');
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity_list(pg_temp.id('firm_a'))) > 0, true, 'an owner of two firms reads the first firm''s record');
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity_list(pg_temp.id('firm_b'))) > 0, true, 'and the second firm''s');
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity_list(pg_temp.id('firm_b')) WHERE record_id = pg_temp.id('intake_a')::text), 0::bigint,
  'each firm''s read holds only that firm''s entries');
SELECT pg_temp.as_user('agent_a');
SELECT pg_temp.is((SELECT count(*) FROM public.my_owner_firms()), 0::bigint, 'an agent is told no firm');
SELECT pg_temp.as_user('platform_admin');
SELECT pg_temp.is((SELECT count(*) FROM public.my_owner_firms()), 0::bigint, 'a platform admin who is no owner is told no firm');
SELECT pg_temp.as_user('lead_a');
SELECT pg_temp.is((SELECT array_agg(firm_id) FROM public.my_owner_firms()), ARRAY[pg_temp.id('firm_b')], 'a lead in one firm and owner of another is told the one they own');
SELECT pg_temp.expect('SELECT public.my_owner_firm()', '42883', 'the old function that picked a firm for the caller is gone');
SELECT pg_temp.as_owner();
RESET ROLE;
SELECT set_config('role', 'anon', false);
SELECT pg_temp.expect('SELECT * FROM public.my_owner_firms()', '42501', 'someone signed out asking which firms they own');
SELECT pg_temp.as_user('owner_a');

-- A password sign-in that hasn't completed a second factor reads nothing, as for a platform role (D-19), and is told it
-- is held back for that, whether or not the owner has a platform role (owner_ab has none).
CREATE FUNCTION pg_temp.as_password_user(n text, level text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', false,
    'amr', jsonb_build_array(jsonb_build_object('method', 'password')), 'aal', level)::text, false);
  PERFORM set_config('role', 'authenticated', false);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.as_password_user(text, text) TO authenticated;
SELECT pg_temp.as_password_user('owner_ab', 'aal1');
SELECT pg_temp.is((SELECT count(*) FROM public.my_owner_firms()), 0::bigint, 'an owner holding only a password sign-in is told no firm');
SELECT pg_temp.expect(format('SELECT * FROM public.firm_activity_list(%L)', pg_temp.id('firm_a')), '42501', 'an owner holding only a password sign-in reading the record');
SELECT pg_temp.expect(format('SELECT * FROM public.firm_activity_people(%L)', pg_temp.id('firm_a')), '42501', 'an owner holding only a password sign-in reading who is in it');
SELECT pg_temp.expect(format('SELECT public.record_member_activity(%L, %L, %L)', 'submission_viewed', 'submission', pg_temp.id('intake_a')),
  '42501', 'an owner holding only a password sign-in reporting a view');
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity), 0::bigint, 'an owner holding only a password sign-in reads no row of the table either');
SELECT pg_temp.is(public.advisor_needs_second_factor(), true, 'an owner with no platform role is held back for the second factor');
SELECT pg_temp.as_password_user('owner_ab', 'aal2');
SELECT pg_temp.is((SELECT count(*) FROM public.my_owner_firms()), 2::bigint, 'with the second factor done the owner is told both firms');
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity_list(pg_temp.id('firm_a'))) > 0, true, 'and reads the record');
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity) > 0, true, 'and reads the table');
SELECT pg_temp.is(public.advisor_needs_second_factor(), false, 'and is no longer held back');
SELECT pg_temp.as_password_user('prospect_a', 'aal1');
SELECT pg_temp.is(public.advisor_needs_second_factor(), false, 'someone who belongs to no firm and has no role is never asked');
SELECT pg_temp.as_user('owner_ab');
SELECT pg_temp.is(public.advisor_needs_second_factor(), false, 'a sign-in that wasn''t by password is never asked');

-- Role is per firm: lead_a is an owner of firm B and only a lead in firm A.
SELECT pg_temp.as_user('lead_a');
SELECT pg_temp.expect(format('SELECT * FROM public.firm_activity_list(%L)', pg_temp.id('firm_a')), '42501', 'a lead reading their firm''s record');
SELECT pg_temp.expect(format('SELECT * FROM public.firm_activity_people(%L)', pg_temp.id('firm_a')), '42501', 'a lead reading who is in their firm''s record');
SELECT pg_temp.is(pg_temp.ids('firm_b'), pg_temp.truth('firm_b'), 'the same person, an owner of the other firm, reads that firm''s record');
SELECT pg_temp.as_user('agent_a');
SELECT pg_temp.expect(format('SELECT * FROM public.firm_activity_list(%L)', pg_temp.id('firm_a')), '42501', 'an agent reading their firm''s record');
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity), 0::bigint, 'an agent reads no row of the table');
SELECT pg_temp.as_user('owner_b');
SELECT pg_temp.expect(format('SELECT * FROM public.firm_activity_list(%L)', pg_temp.id('firm_a')), '42501', 'an owner of another firm reading this firm''s record');
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE firm_id = pg_temp.id('firm_a')), 0::bigint, 'an owner of another firm reads none of its rows');
SELECT pg_temp.as_user('platform_admin');
SELECT pg_temp.expect(format('SELECT * FROM public.firm_activity_list(%L)', pg_temp.id('firm_a')), '42501', 'a platform admin reading a firm''s record');
SELECT pg_temp.expect(format('SELECT * FROM public.firm_activity_list(%L)', pg_temp.id('firm_b')), '42501', 'a platform admin reading the other firm''s record');
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity), 0::bigint, 'a platform admin reads no row of the table');
SELECT pg_temp.as_service();
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity) > 0, true, 'the service reads the table, to count what a member did');
RESET ROLE;
SELECT set_config('role', 'anon', false);
SELECT pg_temp.expect(format('SELECT * FROM public.firm_activity_list(%L)', pg_temp.id('firm_a')), '42501', 'someone signed out reading a firm''s record');
SELECT pg_temp.as_owner();

-- ---------- 8. Entries are kept for the window operational events have, then only the retention job removes them ----------
SELECT pg_temp.as_owner();
INSERT INTO public.firm_activity (firm_id, kind, record_type, record_id, at) VALUES
  (pg_temp.id('firm_a'), 'sign_in', 'firm', pg_temp.id('firm_a')::text, now() - interval '91 days'),
  (pg_temp.id('firm_a'), 'sign_in', 'firm', pg_temp.id('firm_a')::text, now() - interval '89 days');
SELECT pg_temp.as_user('owner_a');
SELECT pg_temp.expect('SELECT public.prune_firm_activity()', '42501', 'an owner pruning the record');
SELECT pg_temp.as_service();
SELECT pg_temp.is(public.prune_firm_activity(), 1, 'the retention job removes the entry past the window and reports how many');
SELECT pg_temp.as_owner();
SELECT pg_temp.is((SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE proname = 'prune_firm_activity')::text, 'firm_activity_pruner',
  'the retention function runs as the role that alone may delete');
SELECT pg_temp.is((SELECT rolcanlogin OR rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = 'firm_activity_pruner'), false, 'and that role cannot sign in');
SELECT pg_temp.is((SELECT count(*) FROM pg_auth_members WHERE roleid = 'firm_activity_pruner'::regrole AND member IN
  (SELECT oid FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role'))), 0::bigint, 'no API role is a member of it');
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'sign_in' AND at < now() - interval '90 days'), 0::bigint, 'nothing past the window is left');
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'sign_in' AND at > now() - interval '90 days'), 1::bigint, 'an entry inside the window is kept');
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind <> 'sign_in'), (SELECT count(*) FROM public.firm_activity WHERE kind <> 'sign_in' AND at > now() - interval '90 days'), 'the job left everything else');
SELECT pg_temp.expect('DELETE FROM public.firm_activity WHERE true', '42501', 'a delete after the job has run');

-- ---------- 9. What later stories record against a membership, and a send made again ----------
SELECT pg_temp.as_service();
SELECT public.record_firm_activity('member_removed', 'membership', (SELECT m.id::text FROM public.firm_memberships m WHERE m.user_id = pg_temp.id('lead_a') AND m.firm_id = pg_temp.id('firm_a')));
SELECT pg_temp.as_owner();
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'member_removed' AND subject_user_id = pg_temp.id('lead_a') AND role = 'lead'
  AND firm_id = pg_temp.id('firm_a')), 1::bigint, 'a removal recorded against a membership is about that person, in their role, in the membership''s firm');
SELECT pg_temp.as_user('agent_a');
SELECT public.advisor_record_quote_send(pg_temp.id('intake_c'), 'TriNet', '2026-11-11');
SELECT pg_temp.as_owner();
SELECT pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'send_recorded' AND record_id = current_setting('test.quote_request')), 2::bigint,
  'sending to the same PEO again is another send recorded');
SELECT pg_temp.as_user('lead_a');
SELECT pg_temp.is((SELECT array_agg(email) FROM public.firm_activity_people(pg_temp.id('firm_b'))), ARRAY['owner_a@example.test'],
  'the people offered are those in the firm''s own record, not another firm''s');
SELECT pg_temp.as_owner();
\echo firm_activity: ok
