-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh quote_request_addresses
-- Reply addresses (joshrkay/Nevermore#92 story M-3.1, 20261111100000_quote_request_addresses.sql): each quote
-- request has one live address, issued when its send is recorded, readable at a glance and unguessable. A second
-- send and a closure keep it; an advisor can revoke it and issue a new one, which is logged; deleting an intake
-- deletes its addresses. Prospects see none. The migration is loaded after one send is recorded, to test that
-- quote requests from before it get an address.
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
SET client_min_messages = notice;

-- ---------- helpers ----------
CREATE FUNCTION pg_temp.as_user(uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', uid, 'is_anonymous', false, 'role', 'authenticated', 'email', uid || '@example.test')::text, false);
END $$;

CREATE FUNCTION pg_temp.new_user() RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', uid || '@example.test', false, now(), now());
  RETURN uid;
END $$;

CREATE FUNCTION pg_temp.answers(company text, employees integer DEFAULT 12) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('company_name', company, 'states', jsonb_build_array('NY'), 'pay_frequency', 'bi-weekly',
    'employee_count', employees, 'start_month', 'April');
$$;

CREATE FUNCTION pg_temp.cert(data jsonb, signed_at text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'signer_name', 'Jo Doe', 'signer_title', 'CEO', 'signed_at', signed_at,
    'consent_version', '2026-10-draft-1', 'consent_text', '["I certify."]'::jsonb, 'chamber_data', data);
$$;

-- A new intake of its own prospect, certified unless told not to. Runs as that prospect.
CREATE FUNCTION pg_temp.new_intake(company text, certify boolean DEFAULT true) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  uid uuid := pg_temp.new_user();
  sid uuid;
BEGIN
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, pg_temp.answers(company)) RETURNING id INTO sid;
  IF certify THEN
    UPDATE public.chamber_sessions
    SET status = 'submitted', submission = pg_temp.cert(pg_temp.answers(company), '2026-11-04T12:00:00Z')
    WHERE id = sid;
  END IF;
  RESET ROLE;
  RETURN sid;
END $$;

-- The prospect changes an answer and certifies again: the submission's next version.
CREATE FUNCTION pg_temp.recertify(sid uuid, employees integer) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  uid uuid := (SELECT user_id FROM public.chamber_sessions WHERE id = sid);
  company text := (SELECT chamber_data ->> 'company_name' FROM public.chamber_sessions WHERE id = sid);
BEGIN
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  UPDATE public.chamber_sessions SET chamber_data = pg_temp.answers(company, employees) WHERE id = sid;
  UPDATE public.chamber_sessions
  SET status = 'submitted', submission = pg_temp.cert(pg_temp.answers(company, employees), '2026-11-05T12:00:00Z')
  WHERE id = sid;
  RESET ROLE;
END $$;

-- Runs stmt as `who` and returns its single value as jsonb.
CREATE FUNCTION pg_temp.run(who uuid, stmt text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb;
BEGIN
  PERFORM pg_temp.as_user(who);
  SET LOCAL ROLE authenticated;
  EXECUTE stmt INTO result;
  RESET ROLE;
  RETURN result;
END $$;

-- How many rows `who` reads from a source; -1 when they can't read it at all.
CREATE FUNCTION pg_temp.count_as(who uuid, src text) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  PERFORM pg_temp.as_user(who);
  SET LOCAL ROLE authenticated;
  BEGIN
    EXECUTE 'SELECT count(*) FROM ' || src INTO n;
  EXCEPTION WHEN insufficient_privilege THEN
    n := -1;
  END;
  RESET ROLE;
  RETURN n;
END $$;

-- Fails the run unless stmt, run as `who`, raises exactly `state`.
CREATE FUNCTION pg_temp.must_raise(who uuid, stmt text, state text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE raised text := NULL;
BEGIN
  PERFORM pg_temp.as_user(who);
  SET LOCAL ROLE authenticated;
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    raised := SQLSTATE;
  END;
  RESET ROLE;
  IF raised IS NULL THEN RAISE EXCEPTION 'FAIL: % was allowed', label; END IF;
  IF raised <> state THEN RAISE EXCEPTION 'FAIL: % raised % instead of %', label, raised, state; END IF;
END $$;

-- Moves the pipeline as an advisor, one allowed step at a time.
CREATE FUNCTION pg_temp.move(advisor uuid, sid uuid, VARIADIC stages text[]) RETURNS void LANGUAGE plpgsql AS $$
DECLARE st text;
BEGIN
  FOREACH st IN ARRAY stages LOOP
    PERFORM pg_temp.as_user(advisor);
    SET LOCAL ROLE authenticated;
    PERFORM public.set_submission_status(sid, st, NULL);
    RESET ROLE;
  END LOOP;
END $$;

CREATE FUNCTION pg_temp.send(advisor uuid, sid uuid, peo text, sent_on date DEFAULT '2026-11-10') RETURNS jsonb LANGUAGE sql AS $$
  SELECT pg_temp.run(advisor, format('SELECT public.advisor_record_quote_send(%L, %L, %L)', sid, peo, sent_on));
$$;

-- Sets a quote request's status and quote, as the panel's form sends them.
CREATE FUNCTION pg_temp.answer(advisor uuid, id bigint, status text, received date DEFAULT NULL, expires date DEFAULT NULL,
    starts date DEFAULT NULL, fee numeric DEFAULT NULL, note text DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
  SELECT pg_temp.run(advisor, format('SELECT public.advisor_update_quote_request(%s, %L, %L, %L, %L, %L, %L)',
    id, status, received, expires, starts, fee, note));
$$;

CREATE FUNCTION pg_temp.qr(id bigint) RETURNS public.quote_requests LANGUAGE sql AS $$
  SELECT * FROM public.quote_requests WHERE quote_requests.id = qr.id;
$$;


-- ---------- Before the migration: a send with no address ----------
CREATE TABLE pg_temp.before (advisor uuid, intake uuid, prospect uuid, request bigint);
DO $$
DECLARE
  advisor uuid := pg_temp.new_user();
  a uuid := pg_temp.new_intake('Alpha Co');
  q bigint;
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (advisor, 'advisor');
  PERFORM pg_temp.move(advisor, a, 'under_review', 'ready_for_market');
  q := (pg_temp.send(advisor, a, 'TriNet') ->> 'id')::bigint;
  INSERT INTO pg_temp.before VALUES (advisor, a, (SELECT user_id FROM public.chamber_sessions WHERE id = a), q);
END $$;

-- A migration runs with nobody signed in.
SELECT set_config('request.jwt.claims', '', false) \gset
\i supabase/migrations/20261111100000_quote_request_addresses.sql

-- The live address of a quote request.
CREATE FUNCTION pg_temp.live(id bigint) RETURNS public.quote_request_addresses LANGUAGE sql AS $$
  SELECT * FROM public.quote_request_addresses a WHERE a.quote_request_id = live.id AND a.revoked_at IS NULL;
$$;

DO $$
DECLARE
  advisor uuid := (SELECT b.advisor FROM pg_temp.before b);
  a uuid := (SELECT b.intake FROM pg_temp.before b);
  prospect uuid := (SELECT b.prospect FROM pg_temp.before b);
  q bigint := (SELECT b.request FROM pg_temp.before b);
  file_part text := (SELECT lower(s.file_id) FROM public.chamber_sessions s WHERE s.id = a);
  addr public.quote_request_addresses;
  first_local text;
  result jsonb;
  q2 bigint;
  q3 bigint;
  q4 bigint;
BEGIN
  IF file_part IS NULL OR file_part !~ '^eaa-[0-9]{4}-[0-9a-z]+$' THEN
    RAISE EXCEPTION 'FAIL: the test expects a File ID like EAA-2026-0001, not %', file_part;
  END IF;

  -- ---------- A quote request from before the migration has an address ----------
  addr := pg_temp.live(q);
  IF addr.local_part IS NULL OR addr.local_part !~ ('^' || file_part || '\.trinet\.[0-9a-f]{16}$')
     OR addr.session_id IS DISTINCT FROM a OR addr.issued_by IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: the earlier quote request''s address is %', to_jsonb(addr);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.quote_request_events e WHERE e.quote_request_id = q AND e.field = 'reply_address'
                 AND e.old_value IS NULL AND e.new_value = addr.local_part) THEN
    RAISE EXCEPTION 'FAIL: issuing the earlier quote request''s address wasn''t logged';
  END IF;
  first_local := addr.local_part;

  -- ---------- Recording a send issues one; a second send and a closure keep it ----------
  q2 := (pg_temp.send(advisor, a, '  Acme & Sons, Inc.  ') ->> 'id')::bigint;
  addr := pg_temp.live(q2);
  IF addr.local_part !~ ('^' || file_part || '\.acmesonsinc\.[0-9a-f]{16}$') OR addr.issued_by IS DISTINCT FROM advisor
     OR addr.issued_by_email IS DISTINCT FROM advisor || '@example.test' THEN
    RAISE EXCEPTION 'FAIL: a new send''s address is %', to_jsonb(addr);
  END IF;
  IF addr.local_part = first_local THEN
    RAISE EXCEPTION 'FAIL: two quote requests share an address';
  END IF;
  PERFORM pg_temp.send(advisor, a, 'acme & sons, inc.', '2026-11-12');
  IF (pg_temp.live(q2)).local_part <> addr.local_part OR (SELECT count(*) FROM public.quote_request_addresses WHERE quote_request_id = q2) <> 1 THEN
    RAISE EXCEPTION 'FAIL: a second send to the same PEO changed its address';
  END IF;
  PERFORM pg_temp.answer(advisor, q2, 'closed', note => 'Withdrawn');
  IF (pg_temp.live(q2)).local_part IS DISTINCT FROM addr.local_part THEN
    RAISE EXCEPTION 'FAIL: closing a quote request revoked its address';
  END IF;
  PERFORM pg_temp.send(advisor, a, 'Acme & Sons, Inc.', '2026-11-13');
  IF (pg_temp.qr(q2)).status <> 'sent' OR (pg_temp.live(q2)).local_part IS DISTINCT FROM addr.local_part THEN
    RAISE EXCEPTION 'FAIL: reopening a quote request changed its address';
  END IF;

  -- A PEO's name is reduced to letters and digits, cut to 20, and "peo" when nothing is left.
  q3 := (pg_temp.send(advisor, a, '***') ->> 'id')::bigint;
  IF (pg_temp.live(q3)).local_part !~ ('^' || file_part || '\.peo\.[0-9a-f]{16}$') THEN
    RAISE EXCEPTION 'FAIL: a PEO with no letters got the address %', (pg_temp.live(q3)).local_part;
  END IF;
  q4 := (pg_temp.send(advisor, a, 'The Very Long Professional Employer Organization of America') ->> 'id')::bigint;
  IF (pg_temp.live(q4)).local_part !~ ('^' || file_part || '\.theverylongprofessio\.[0-9a-f]{16}$') OR char_length((pg_temp.live(q4)).local_part) > 64 THEN
    RAISE EXCEPTION 'FAIL: a long PEO name got the address %', (pg_temp.live(q4)).local_part;
  END IF;

  -- ---------- Revoking and reissuing ----------
  result := pg_temp.run(advisor, format('SELECT public.advisor_reissue_quote_request_address(%s)', q));
  addr := pg_temp.live(q);
  IF addr.local_part = first_local OR addr.local_part <> (result ->> 'local_part')
     OR addr.local_part !~ ('^' || file_part || '\.trinet\.[0-9a-f]{16}$') OR addr.issued_by IS DISTINCT FROM advisor THEN
    RAISE EXCEPTION 'FAIL: the reissued address is %', to_jsonb(addr);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.quote_request_addresses x WHERE x.quote_request_id = q AND x.local_part = first_local
                 AND x.revoked_at IS NOT NULL AND x.revoked_by = advisor) THEN
    RAISE EXCEPTION 'FAIL: the old address wasn''t kept as revoked';
  END IF;
  IF (SELECT count(*) FROM public.quote_request_addresses x WHERE x.quote_request_id = q AND x.revoked_at IS NULL) <> 1 THEN
    RAISE EXCEPTION 'FAIL: a quote request has more than one live address';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.quote_request_events e WHERE e.quote_request_id = q AND e.field = 'reply_address'
                 AND e.old_value = first_local AND e.new_value = addr.local_part AND e.changed_by = advisor) THEN
    RAISE EXCEPTION 'FAIL: reissuing wasn''t logged with the old address';
  END IF;
  -- Reissuing leaves the quote request itself alone.
  IF (pg_temp.qr(q)).status <> 'sent' THEN
    RAISE EXCEPTION 'FAIL: reissuing changed the quote request''s status';
  END IF;
  PERFORM pg_temp.must_raise(advisor, 'SELECT public.advisor_reissue_quote_request_address(999999)', 'PT404', 'reissuing for a quote request that doesn''t exist');
  PERFORM pg_temp.must_raise(prospect, format('SELECT public.advisor_reissue_quote_request_address(%s)', q), '42501', 'a prospect reissuing an address');

  -- ---------- Who reads and writes addresses ----------
  IF pg_temp.count_as(advisor, 'public.quote_request_addresses') <> 5 THEN
    RAISE EXCEPTION 'FAIL: an advisor read % addresses, not the four live and one revoked', pg_temp.count_as(advisor, 'public.quote_request_addresses');
  END IF;
  IF pg_temp.count_as(prospect, 'public.quote_request_addresses') <> 0 THEN
    RAISE EXCEPTION 'FAIL: the prospect read the addresses on their own submission';
  END IF;
  PERFORM pg_temp.must_raise(advisor, format('INSERT INTO public.quote_request_addresses (quote_request_id, session_id, local_part) VALUES (%s, %L, ''mine'')', q, a), '42501', 'an advisor inserting an address');
  PERFORM pg_temp.must_raise(advisor, format('UPDATE public.quote_request_addresses SET revoked_at = NULL WHERE quote_request_id = %s', q), '42501', 'an advisor restoring a revoked address');
  PERFORM pg_temp.must_raise(advisor, format('DELETE FROM public.quote_request_addresses WHERE quote_request_id = %s', q), '42501', 'an advisor deleting an address');
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.issue_quote_request_address(%s)', q), '42501', 'an advisor calling the issuing function directly');
  -- An address is never issued twice, and holds only what a mail system accepts.
  BEGIN
    INSERT INTO public.quote_request_addresses (quote_request_id, session_id, local_part) VALUES (q2, a, first_local);
    RAISE EXCEPTION 'FAIL: a revoked address was issued again';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.quote_request_addresses (quote_request_id, session_id, local_part) VALUES (q2, a, 'Has Spaces');
    RAISE EXCEPTION 'FAIL: an address with spaces and capitals was stored';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  RAISE NOTICE 'quote_request_addresses: all cases passed';
END $$;

-- ---------- Deleting an intake deletes its addresses ----------
DO $$
DECLARE
  advisor uuid := (SELECT b.advisor FROM pg_temp.before b);
  del uuid := pg_temp.new_intake('Deleted Co');
  q bigint;
  d uuid;
  removed jsonb;
BEGIN
  PERFORM pg_temp.move(advisor, del, 'under_review', 'ready_for_market');
  q := (pg_temp.send(advisor, del, 'TriNet') ->> 'id')::bigint;
  PERFORM pg_temp.run(advisor, format('SELECT public.advisor_reissue_quote_request_address(%s)', q));
  PERFORM set_config('request.jwt.claims', '', false);

  INSERT INTO public.intake_deletions (session_id, user_id, trigger, reason, status)
  VALUES (del, (SELECT user_id FROM public.chamber_sessions WHERE id = del), 'request', 'x', 'claimed') RETURNING id INTO d;
  SET LOCAL ROLE service_role;
  removed := public.complete_intake_deletion(d, 0);
  RESET ROLE;
  IF EXISTS (SELECT 1 FROM public.quote_request_addresses WHERE session_id = del) OR EXISTS (SELECT 1 FROM public.quote_requests WHERE session_id = del) THEN
    RAISE EXCEPTION 'FAIL: the deleted intake''s addresses remain';
  END IF;
  IF (removed ->> 'quote_request_addresses')::int IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'FAIL: the deletion reported %', removed;
  END IF;
  RAISE NOTICE 'quote_request_addresses: deletion cases passed';
END $$;
