-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh required_items
-- Required items and verified fields (B-2.2, 20261104100000_required_items.sql): intake_required_items
-- against the cases src/data/requiredItems.test.ts runs through the browser's copy of the rule, provenance
-- read as the browser reads it, the advisor queue's missing_required read from the rule (same arguments
-- and columns as before), and session_verified_fields:
-- the owner and advisors get the verified field names, anyone else nothing, and signed-out callers can't
-- call it. run.sh runs from the repository root, which is where the case file is read from.
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
\i supabase/migrations/20261027090100_outbox_operations.sql
\i supabase/migrations/20261027100000_outbox_schedule.sql
\i supabase/migrations/20261028090000_email_delivery_events.sql
\i supabase/migrations/20261029090000_document_ingestion.sql
\i supabase/migrations/20261029091000_census_advisor_review.sql
\i supabase/migrations/20261029092000_census_in_intake_validation.sql
\i supabase/migrations/20261103090000_intake_lifecycle.sql
\i supabase/migrations/20261103091000_intake_schema_version.sql
\i supabase/migrations/20261103100000_chosen_peo.sql
\i supabase/migrations/20261103110000_certification_readiness.sql

-- The advisor queue as it was, to hold the new definition to the same arguments, columns and grants.
CREATE TEMP TABLE queue_before AS
SELECT pg_get_function_identity_arguments(p.oid) AS args, pg_get_function_result(p.oid) AS result,
       p.prosecdef, p.provolatile, p.proconfig, p.proacl
FROM pg_proc p WHERE p.oid = 'public.advisor_list_submissions(text)'::regprocedure;

\i supabase/migrations/20261104100000_required_items.sql
SET client_min_messages = notice;

-- ---------- helpers ----------
CREATE FUNCTION pg_temp.as_user(uid uuid, guest boolean DEFAULT false) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', uid, 'is_anonymous', guest, 'role', 'authenticated', 'email', uid || '@example.test')::text, false);
END $$;

CREATE FUNCTION pg_temp.signed_out() RETURNS void LANGUAGE sql AS
  $$ SELECT set_config('request.jwt.claims', '', false) $$;

CREATE FUNCTION pg_temp.new_user() RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', uid || '@example.test', false, now(), now());
  RETURN uid;
END $$;

-- Superuser only: an intake for uid holding data and provenance.
CREATE FUNCTION pg_temp.new_intake(uid uuid, data jsonb, provenance jsonb DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE sid uuid;
BEGIN
  INSERT INTO public.chamber_sessions (user_id, chamber_data, field_provenance) VALUES (uid, data, provenance) RETURNING id INTO sid;
  RETURN sid;
END $$;

-- The SQLSTATE stmt raises, or 'ok'.
CREATE FUNCTION pg_temp.state_of(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE s text;
BEGIN
  EXECUTE stmt;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE;
  RETURN s;
END $$;

-- Item -> state, from what intake_required_items returns.
CREATE FUNCTION pg_temp.states_of(items jsonb) RETURNS jsonb LANGUAGE sql AS
  $$ SELECT jsonb_object_agg(i ->> 'field', i ->> 'state') FROM jsonb_array_elements(items) i $$;

-- ---------- the shared cases (src/data/requiredItems.cases.json) ----------
\set cases `cat src/data/requiredItems.cases.json`
CREATE TEMP TABLE shared_cases AS
SELECT c.value AS spec, c.ordinality AS ord FROM jsonb_array_elements((:'cases'::jsonb) -> 'cases') WITH ORDINALITY AS c;

DO $$
DECLARE
  c record;
  got jsonb;
  seen integer := 0;
BEGIN
  FOR c IN SELECT * FROM shared_cases ORDER BY ord LOOP
    got := pg_temp.states_of(public.intake_required_items(
      c.spec -> 'data', c.spec -> 'provenance', ARRAY(SELECT jsonb_array_elements_text(c.spec -> 'verified'))));
    IF got IS DISTINCT FROM c.spec -> 'expected' THEN
      RAISE EXCEPTION 'FAIL: "%" gave %, expected %', c.spec ->> 'name', got, c.spec -> 'expected';
    END IF;
    seen := seen + 1;
  END LOOP;
  IF seen < 20 THEN RAISE EXCEPTION 'FAIL: only % shared cases were read', seen; END IF;
  RAISE NOTICE 'required_items: % shared cases passed', seen;
END $$;

-- ---------- one presence rule: the certification gate agrees with the items ----------
-- intake_missing_required (20261103110000_certification_readiness.sql, redefined on intake_answers_present)
-- names exactly the required items intake_required_items reports missing, for every shared case.
DO $$
DECLARE
  c record;
  gate text[];
  items text[];
BEGIN
  FOR c IN SELECT * FROM shared_cases ORDER BY ord LOOP
    gate := public.intake_missing_required(c.spec -> 'data');
    items := ARRAY(
      SELECT ri.item ->> 'item'
      FROM jsonb_array_elements(public.intake_required_items(c.spec -> 'data', c.spec -> 'provenance', '{}'::text[])) WITH ORDINALITY ri(item, ord)
      WHERE ri.item ->> 'state' = 'missing' AND (ri.item ->> 'required')::boolean
      ORDER BY ri.ord);
    IF gate IS DISTINCT FROM items THEN
      RAISE EXCEPTION 'FAIL: "%": the gate refuses for %, the items say % missing', c.spec ->> 'name', gate, items;
    END IF;
  END LOOP;
  -- The gate now trims as the browser does, and reads a state only when it is a code.
  IF public.intake_missing_required('{"company_name": "\u00a0", "states": ["ZZ"], "employees": [{"state": "NA"}], "pay_frequency": "\t"}')
       IS DISTINCT FROM ARRAY['company_name', 'states', 'pay_frequency'] THEN
    RAISE EXCEPTION 'FAIL: the gate read blank or invalid answers as given';
  END IF;
  RAISE NOTICE 'required_items: the gate agrees with the items';
END $$;

-- ---------- the rule's shape ----------
DO $$
DECLARE
  items jsonb;
BEGIN
  -- The three required items, then the recommended census, in the fixed order, with the readiness keys
  -- and labels (src/data/readiness.ts).
  items := public.intake_required_items('{}', '{}', '{}');
  IF items IS DISTINCT FROM '[
    {"item": "company_name", "label": "Company legal name", "field": "company_name", "required": true, "state": "missing"},
    {"item": "states", "label": "States of operation", "field": "states", "required": true, "state": "missing"},
    {"item": "pay_frequency", "label": "Pay frequency", "field": "pay_frequency", "required": true, "state": "missing"},
    {"item": "census", "label": "Employee census", "field": "census", "required": false, "state": "missing"}
  ]'::jsonb THEN
    RAISE EXCEPTION 'FAIL: the items were %', items;
  END IF;

  -- Nothing it is handed makes it fail: missing or malformed input is just missing.
  IF pg_temp.states_of(public.intake_required_items(NULL, NULL, NULL))
       IS DISTINCT FROM '{"company_name": "missing", "states": "missing", "pay_frequency": "missing", "census": "missing"}' THEN
    RAISE EXCEPTION 'FAIL: null input was not all missing';
  END IF;
  items := public.intake_required_items(
    '{"company_name": 5, "states": "CA", "pay_frequency": ["Weekly"], "census": {"first_name": "A"}, "employees": [{"state": "NV"}]}',
    '[]', '{}');
  IF pg_temp.states_of(items) IS DISTINCT FROM '{"company_name": "missing", "states": "missing", "pay_frequency": "missing", "census": "missing"}' THEN
    RAISE EXCEPTION 'FAIL: malformed answers were read as %', items;
  END IF;
  items := public.intake_required_items('"junk"', '"junk"', '{}');
  IF pg_temp.states_of(items) ->> 'census' <> 'missing' THEN RAISE EXCEPTION 'FAIL: a scalar intake was read as %', items; END IF;
  -- Rows that aren't objects name no state. (They are still rows: the database refuses them on write, and
  -- the browser drops them, so no stored intake holds one.)
  items := public.intake_required_items('{"census": ["junk", 5, {"work_state": " "}]}', '{}', '{}');
  IF pg_temp.states_of(items) IS DISTINCT FROM '{"company_name": "missing", "states": "missing", "pay_frequency": "missing", "census": "settled"}' THEN
    RAISE EXCEPTION 'FAIL: odd census rows were read as %', items;
  END IF;

  -- Provenance is read as the browser's parseProvenance reads it.
  IF public.provenance_entry_status('{"status": "conflicting", "source": {"kind": "document", "document_id": "d1", "location": "p. 2"}, "updated_at": "", "candidates": []}')
       IS DISTINCT FROM 'conflicting'
     OR public.provenance_entry_status('{"status": "confirmed", "source": {"kind": "prospect_edit", "extra": 1}, "updated_at": "x", "also_heard": 5}')
       IS DISTINCT FROM 'confirmed'
     OR public.provenance_entry_status('{"status": "inferred", "source": {"kind": "transcript", "message_id": ""}, "updated_at": "x"}') IS NOT NULL
     OR public.provenance_entry_status('{"status": "inferred", "source": {"kind": "transcript", "message_id": "m1", "quote": null}, "updated_at": "x"}') IS NOT NULL
     OR public.provenance_entry_status('{"status": "inferred", "source": {"kind": "document", "document_id": 7}, "updated_at": "x"}') IS NOT NULL
     OR public.provenance_entry_status('{"status": "inferred", "source": {"kind": "prospect_edit"}, "updated_at": 5}') IS NOT NULL
     OR public.provenance_entry_status('{"status": "inferred", "source": {"kind": "prospect_edit"}, "updated_at": "x", "candidates": [5]}') IS NOT NULL
     OR public.provenance_entry_status('{"status": "inferred", "source": {"kind": "prospect_edit"}, "updated_at": "x", "candidates": {}}') IS NOT NULL
     OR public.provenance_entry_status('[{"status": "inferred"}]') IS NOT NULL
     OR public.provenance_entry_status(NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: provenance_entry_status disagrees with parseProvenance';
  END IF;

  -- Pure, invoker-rights functions of their arguments, for signed-in callers (they call is_us_state_code).
  IF (SELECT provolatile FROM pg_proc WHERE oid = 'public.intake_required_items(jsonb, jsonb, text[])'::regprocedure) <> 'i'
     OR (SELECT prosecdef FROM pg_proc WHERE oid = 'public.intake_required_items(jsonb, jsonb, text[])'::regprocedure) THEN
    RAISE EXCEPTION 'FAIL: intake_required_items is not an immutable, invoker-rights function';
  END IF;
  IF has_function_privilege('anon', 'public.intake_required_items(jsonb, jsonb, text[])', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.intake_required_items(jsonb, jsonb, text[])', 'EXECUTE')
     OR has_function_privilege('anon', 'public.intake_answers_present(jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.intake_answers_present(jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.provenance_entry_status(jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.provenance_source_is_valid(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: the required-items functions are not for signed-in callers only';
  END IF;
  RAISE NOTICE 'required_items: shape cases passed';
END $$;

-- ---------- verified fields ----------
CREATE TEMP TABLE fx (name text PRIMARY KEY, id uuid);
GRANT SELECT ON fx TO authenticated;
DO $$
DECLARE
  prospect uuid := pg_temp.new_user();
  other uuid := pg_temp.new_user();
  advisor uuid := pg_temp.new_user();
  sid uuid;
  other_sid uuid;
  closed_sid uuid;
  expired_sid uuid;
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (advisor, 'advisor');
  sid := pg_temp.new_intake(prospect,
    '{"company_name": "Acme", "states": ["CA"], "pay_frequency": "Weekly", "employees": [{"first_name": "Ada", "last_name": "Lee", "state": "CA"}]}',
    '{"company_name": {"status": "inferred", "source": {"kind": "transcript", "message_id": "m1"}, "updated_at": "2026-11-03T12:00:00Z"},
      "pay_frequency": {"status": "inferred", "source": {"kind": "transcript", "message_id": "m1"}, "updated_at": "2026-11-03T12:00:00Z"}}');
  other_sid := pg_temp.new_intake(other, '{"company_name": "Other Co"}');
  closed_sid := pg_temp.new_intake(prospect, '{"company_name": "Started Over Co"}');
  expired_sid := pg_temp.new_intake(prospect, '{"company_name": "Idle Co"}');

  PERFORM pg_temp.as_user(advisor);
  PERFORM public.review_submission_field(sid, 'company_name', 'verified', 'set', '"Acme LLC"', 'Per W-9');
  PERFORM public.review_submission_field(sid, 'pay_frequency', 'follow_up');
  PERFORM public.review_submission_field(sid, 'states', 'verified');
  PERFORM public.review_submission_field(sid, 'employees', 'verified');
  PERFORM public.review_submission_field(other_sid, 'company_name', 'verified');
  PERFORM public.review_submission_field(closed_sid, 'company_name', 'verified');
  PERFORM public.review_submission_field(expired_sid, 'company_name', 'verified');
  INSERT INTO public.advisor_notes (session_id, body) VALUES (sid, 'Called the CFO.');

  -- Closed by the prospect ("Start over"), and expired by the job (a privileged write).
  PERFORM pg_temp.as_user(prospect);
  IF public.archive_chamber_session(closed_sid) <> 'archived' THEN RAISE EXCEPTION 'FAIL: setup could not archive'; END IF;
  UPDATE public.chamber_sessions SET status = 'expired' WHERE id = expired_sid;
  PERFORM pg_temp.signed_out();

  INSERT INTO fx VALUES ('prospect', prospect), ('other', other), ('advisor', advisor),
    ('sid', sid), ('other_sid', other_sid), ('closed_sid', closed_sid), ('expired_sid', expired_sid);
END $$;

DO $$
DECLARE
  prospect uuid := (SELECT id FROM fx WHERE name = 'prospect');
  other uuid := (SELECT id FROM fx WHERE name = 'other');
  advisor uuid := (SELECT id FROM fx WHERE name = 'advisor');
  sid uuid := (SELECT id FROM fx WHERE name = 'sid');
  other_sid uuid := (SELECT id FROM fx WHERE name = 'other_sid');
  closed_sid uuid := (SELECT id FROM fx WHERE name = 'closed_sid');
  expired_sid uuid := (SELECT id FROM fx WHERE name = 'expired_sid');
  got text[];
  oid_ regprocedure := 'public.session_verified_fields(uuid)'::regprocedure;
BEGIN
  SET LOCAL ROLE authenticated;

  -- The owner sees the names of the fields an advisor verified, sorted; the older census name reads as
  -- the census. Not the follow-up, the correction, the reviewer or the note.
  PERFORM pg_temp.as_user(prospect);
  got := public.session_verified_fields(sid);
  IF got IS DISTINCT FROM ARRAY['census', 'company_name', 'states'] THEN RAISE EXCEPTION 'FAIL: the owner got %', got; END IF;
  -- The reviews themselves stay advisor-only.
  IF (SELECT count(*) FROM public.advisor_field_reviews) <> 0 OR (SELECT count(*) FROM public.advisor_notes) <> 0 THEN
    RAISE EXCEPTION 'FAIL: the prospect can read advisor reviews or notes';
  END IF;
  -- Their own intakes under the owner's read rule: an expired one still answers, an archived one doesn't.
  got := public.session_verified_fields(expired_sid);
  IF got IS DISTINCT FROM ARRAY['company_name'] THEN RAISE EXCEPTION 'FAIL: the owner of an expired intake got %', got; END IF;
  got := public.session_verified_fields(closed_sid);
  IF got IS DISTINCT FROM '{}'::text[] THEN RAISE EXCEPTION 'FAIL: the owner of an archived intake got %', got; END IF;
  -- Someone else's intake, or one that doesn't exist: an empty list, not an error.
  got := public.session_verified_fields(other_sid);
  IF got IS DISTINCT FROM '{}'::text[] THEN RAISE EXCEPTION 'FAIL: a prospect read another intake''s verified fields: %', got; END IF;
  got := public.session_verified_fields(gen_random_uuid());
  IF got IS DISTINCT FROM '{}'::text[] THEN RAISE EXCEPTION 'FAIL: a missing intake gave %', got; END IF;

  PERFORM pg_temp.as_user(other);
  got := public.session_verified_fields(sid);
  IF got IS DISTINCT FROM '{}'::text[] THEN RAISE EXCEPTION 'FAIL: another user got %', got; END IF;
  -- A guest token for the owner's account is still the owner.
  PERFORM pg_temp.as_user(prospect, true);
  IF public.session_verified_fields(sid) IS DISTINCT FROM ARRAY['census', 'company_name', 'states'] THEN
    RAISE EXCEPTION 'FAIL: the owner signed in as a guest got %', public.session_verified_fields(sid);
  END IF;

  -- Advisors read any intake's, archived ones included.
  PERFORM pg_temp.as_user(advisor);
  got := public.session_verified_fields(sid);
  IF got IS DISTINCT FROM ARRAY['census', 'company_name', 'states'] THEN RAISE EXCEPTION 'FAIL: the advisor got %', got; END IF;
  IF public.session_verified_fields(closed_sid) IS DISTINCT FROM ARRAY['company_name'] THEN
    RAISE EXCEPTION 'FAIL: the advisor could not read an archived intake''s verified fields';
  END IF;
  -- A guest token on an advisor's account is not an advisor.
  PERFORM pg_temp.as_user(advisor, true);
  IF public.session_verified_fields(sid) IS DISTINCT FROM '{}'::text[] THEN RAISE EXCEPTION 'FAIL: an advisor''s guest token read verified fields'; END IF;

  -- A census review under the census's current name decides over one under its older name.
  RESET ROLE;
  PERFORM pg_temp.as_user(advisor);
  PERFORM public.review_submission_field(sid, 'census', 'follow_up');
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.as_user(prospect);
  got := public.session_verified_fields(sid);
  IF got IS DISTINCT FROM ARRAY['company_name', 'states'] THEN RAISE EXCEPTION 'FAIL: the census read as verified over its own review: %', got; END IF;
  RESET ROLE;
  PERFORM pg_temp.as_user(advisor);
  PERFORM public.review_submission_field(sid, 'census', 'verified');
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.as_user(prospect);
  IF public.session_verified_fields(sid) IS DISTINCT FROM ARRAY['census', 'company_name', 'states'] THEN
    RAISE EXCEPTION 'FAIL: a census verified under both names was listed as %', public.session_verified_fields(sid);
  END IF;

  -- Signed-out callers can't call it at all.
  RESET ROLE;
  PERFORM pg_temp.signed_out();
  SET LOCAL ROLE anon;
  IF pg_temp.state_of(format('SELECT public.session_verified_fields(%L)', sid)) <> '42501' THEN
    RAISE EXCEPTION 'FAIL: a signed-out caller could call session_verified_fields';
  END IF;
  RESET ROLE;

  IF has_function_privilege('anon', oid_, 'EXECUTE') OR NOT has_function_privilege('authenticated', oid_, 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: session_verified_fields is not open to signed-in users only';
  END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = oid_)
     OR (SELECT proconfig FROM pg_proc WHERE oid = oid_) IS DISTINCT FROM ARRAY['search_path=public']
     OR pg_get_function_result(oid_) <> 'text[]' THEN
    RAISE EXCEPTION 'FAIL: session_verified_fields is not a security-definer function with a fixed search_path returning text[]';
  END IF;
  RAISE NOTICE 'required_items: verified field cases passed';
END $$;

-- ---------- the advisor queue reads missing items from the rule ----------
DO $$
DECLARE
  owner uuid := (SELECT id FROM fx WHERE name = 'prospect');
  advisor uuid := (SELECT id FROM fx WHERE name = 'advisor');
  before_ record;
  after_ record;
  partial uuid;
  blank uuid;
  unconfirmed uuid;
  r record;
BEGIN
  -- Same arguments, columns, rights and settings as the definition it replaces.
  SELECT * INTO before_ FROM queue_before;
  SELECT pg_get_function_identity_arguments(p.oid) AS args, pg_get_function_result(p.oid) AS result,
         p.prosecdef, p.provolatile, p.proconfig, p.proacl
    INTO after_ FROM pg_proc p WHERE p.oid = 'public.advisor_list_submissions(text)'::regprocedure;
  IF after_ IS DISTINCT FROM before_ THEN RAISE EXCEPTION 'FAIL: the queue changed from % to %', before_, after_; END IF;

  -- States named only by the census, with nothing else given yet.
  partial := pg_temp.new_intake(owner,
    '{"company_name": "  ", "census": [{"id": "e1", "first_name": "Ada", "last_name": "Lee", "work_state": "WA", "compensation_type": "salary", "employment_type": "full_time", "classification": "w2"}]}',
    '{"census": {"status": "inferred", "source": {"kind": "document", "document_id": "d1"}, "updated_at": "2026-11-03T12:00:00Z"}}');
  blank := pg_temp.new_intake(owner, '{"states": [], "census": []}');
  -- Present but unconfirmed is not missing.
  unconfirmed := pg_temp.new_intake(owner,
    '{"company_name": "Acme", "states": ["CA"], "pay_frequency": "Weekly", "census": [{"id": "e1", "first_name": "Ada", "last_name": "Lee", "work_state": "", "compensation_type": "salary", "employment_type": "full_time", "classification": "w2"}]}',
    '{"company_name": {"status": "conflicting", "source": {"kind": "transcript", "message_id": "m1"}, "updated_at": "2026-11-03T12:00:00Z"},
      "states": {"status": "incomplete", "source": {"kind": "transcript", "message_id": "m1"}, "updated_at": "2026-11-03T12:00:00Z"},
      "pay_frequency": {"status": "inferred", "source": {"kind": "transcript", "message_id": "m1"}, "updated_at": "2026-11-03T12:00:00Z"}}');

  PERFORM pg_temp.as_user(advisor);
  SET LOCAL ROLE authenticated;
  SELECT * INTO r FROM public.advisor_list_submissions() l WHERE l.session_id = partial;
  IF r.missing_required IS DISTINCT FROM ARRAY['Company legal name', 'Pay frequency'] OR r.states IS DISTINCT FROM ARRAY['WA'] THEN
    RAISE EXCEPTION 'FAIL: the census-only intake listed % / %', r.missing_required, r.states;
  END IF;
  SELECT * INTO r FROM public.advisor_list_submissions() l WHERE l.session_id = blank;
  -- The census is recommended, so it is never listed as missing.
  IF r.missing_required IS DISTINCT FROM ARRAY['Company legal name', 'States of operation', 'Pay frequency'] THEN
    RAISE EXCEPTION 'FAIL: the blank intake listed %', r.missing_required;
  END IF;
  SELECT * INTO r FROM public.advisor_list_submissions() l WHERE l.session_id = unconfirmed;
  IF r.missing_required IS DISTINCT FROM '{}'::text[] OR r.open_fields <> 3 THEN
    RAISE EXCEPTION 'FAIL: the unconfirmed intake listed % missing and % open', r.missing_required, r.open_fields;
  END IF;
  -- The verified intake from above: the census under its older name counts, and its verification shows.
  SELECT * INTO r FROM public.advisor_list_submissions() l WHERE l.session_id = (SELECT id FROM fx WHERE name = 'sid');
  IF r.missing_required IS DISTINCT FROM '{}'::text[] OR r.open_fields <> 1 OR r.verified_fields <> 4 OR r.flagged_fields <> 1 THEN
    RAISE EXCEPTION 'FAIL: the reviewed intake''s row was %', r;
  END IF;
  -- Still advisors only.
  PERFORM pg_temp.as_user(owner);
  IF pg_temp.state_of('SELECT * FROM public.advisor_list_submissions()') <> '42501' THEN
    RAISE EXCEPTION 'FAIL: a prospect listed submissions';
  END IF;
  RESET ROLE;
  RAISE NOTICE 'required_items: advisor queue cases passed';
END $$;

DO $$ BEGIN RAISE NOTICE 'required_items: all cases passed'; END $$;
