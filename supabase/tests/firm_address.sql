-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh firm_address
-- The firm address before and after sign-in (story CRM-P1.3a; docs/BROKER_CRM_BUILD.md D-17, D-18;
-- 20261116140000_firm_address_lookup.sql). Before sign-in anyone, a signed-out visitor included, may ask what name
-- an address shows, and gets the name of any firm that exists, approved or still waiting for approval (D-27), or
-- nothing when no firm holds the address. After sign-in the caller may ask whether they themselves are a current member of
-- the firm at an address. Neither function is the lock (D-18): row security and the membership helpers still
-- decide who reads what; the screen only chooses what to show.
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
\i supabase/migrations/20261116140000_firm_address_lookup.sql
SET client_min_messages = notice;

CREATE TEMP TABLE fx (name text PRIMARY KEY, id uuid NOT NULL);
GRANT SELECT ON fx TO anon, authenticated, service_role;
CREATE FUNCTION pg_temp.id(n text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM fx WHERE name = n $$;

CREATE FUNCTION pg_temp.new_user(n text, guest boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', CASE WHEN guest THEN NULL ELSE n || '@example.test' END, guest, now(), now());
  INSERT INTO fx VALUES (n, uid);
  RETURN uid;
END $$;

CREATE FUNCTION pg_temp.as_user(n text, guest boolean DEFAULT false) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', guest,
      'email', CASE WHEN guest THEN NULL ELSE n || '@example.test' END)::text, false);
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

-- ---------- set up: two approved firms, one waiting for approval, and the people in them ----------
DO $$
DECLARE acme uuid; birch uuid; waiting uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Acme Brokers', 'acme-brokers', now()) RETURNING id INTO acme;
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Birch Benefits', 'birch-benefits', now()) RETURNING id INTO birch;
  INSERT INTO public.firms (name, address) VALUES ('Waiting Firm', 'waiting-firm') RETURNING id INTO waiting;
  INSERT INTO fx VALUES ('acme', acme), ('birch', birch), ('waiting', waiting);

  PERFORM pg_temp.new_user('acme_owner');
  PERFORM pg_temp.new_user('acme_agent');
  PERFORM pg_temp.new_user('birch_owner');
  PERFORM pg_temp.new_user('waiting_owner');
  PERFORM pg_temp.new_user('nobody');
  PERFORM pg_temp.new_user('former_acme');
  PERFORM pg_temp.new_user('future_acme');
  PERFORM pg_temp.new_user('guest_visitor', true);
  INSERT INTO public.firm_memberships (firm_id, user_id, role, valid_from, valid_until) VALUES
    (acme, pg_temp.id('acme_owner'), 'owner', now() - interval '2 days', NULL),
    (acme, pg_temp.id('acme_agent'), 'agent', now() - interval '2 days', NULL),
    (birch, pg_temp.id('birch_owner'), 'owner', now() - interval '2 days', NULL),
    (waiting, pg_temp.id('waiting_owner'), 'owner', now() - interval '2 days', NULL),
    (acme, pg_temp.id('former_acme'), 'agent', now() - interval '10 days', now() - interval '1 day'),
    (acme, pg_temp.id('future_acme'), 'agent', now() + interval '1 day', NULL);
END $$;

-- ---------- before sign-in: what an address shows ----------
-- Break caught: the page shows nothing for a real firm.
DO $$
BEGIN
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(public.firm_public_name('acme-brokers'), 'Acme Brokers', 'a signed-out visitor is told the approved firm''s name');
  PERFORM pg_temp.is(public.firm_public_name('birch-benefits'), 'Birch Benefits', 'and the other firm''s');
  PERFORM pg_temp.is(public.firm_public_name('edgar-allan-advisory'), 'Edgar Allan Advisory', 'Edgar Allan Advisory is a firm like any other');
  -- Break caught: an address a person typed in capitals (a host is case-blind) finds nothing.
  PERFORM pg_temp.is(public.firm_public_name('Acme-Brokers'), 'Acme Brokers', 'the address is read without regard to capitals');
  PERFORM pg_temp.is(public.firm_public_name(' acme-brokers '), 'Acme Brokers', 'and without surrounding spaces');
  RAISE NOTICE 'firm_address: name for an approved firm cases passed';
END $$;

-- Break caught: a firm waiting for approval shows nothing (D-27: it shows its name, because its members can work
-- before approval), an address nobody holds shows something, or a wildcard or empty input lists firms.
DO $$
BEGIN
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(public.firm_public_name('waiting-firm'), 'Waiting Firm', 'a firm waiting for approval shows its name');
  PERFORM pg_temp.is(public.firm_public_name('no-such-firm'), NULL::text, 'an address nobody holds shows nothing');
  PERFORM pg_temp.is(public.firm_public_name('%'), NULL::text, 'a wildcard matches nothing');
  PERFORM pg_temp.is(public.firm_public_name('acme%'), NULL::text, 'a prefix matches nothing');
  PERFORM pg_temp.is(public.firm_public_name(''), NULL::text, 'an empty address matches nothing');
  PERFORM pg_temp.is(public.firm_public_name(NULL), NULL::text, 'no address matches nothing');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.firm_public_name('waiting-firm')$q$), 'rows:1', 'a waiting firm is no error');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.firm_public_name('no-such-firm')$q$), 'rows:1', 'nor is an unknown address');
  -- Approval changes nothing about what the address shows.
  RESET ROLE;
  UPDATE public.firms SET approved_at = now() WHERE address = 'waiting-firm';
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(public.firm_public_name('waiting-firm'), 'Waiting Firm', 'approval does not change the name shown');
  RESET ROLE;
  UPDATE public.firms SET approved_at = NULL WHERE address = 'waiting-firm';
  RAISE NOTICE 'firm_address: waiting and unknown cases passed';
END $$;

-- Break caught: the function reveals more than a name (an id, the visibility setting, the owner) or can be changed
-- by the caller; or only some of the API roles may call it.
DO $$
DECLARE r record;
BEGIN
  PERFORM pg_temp.is((SELECT pg_get_function_result(p.oid) FROM pg_proc p WHERE p.proname = 'firm_public_name'), 'text', 'it returns one text value, the name');
  FOR r IN SELECT unnest(ARRAY['anon', 'authenticated']) AS who LOOP
    PERFORM pg_temp.is(has_function_privilege(r.who, 'public.firm_public_name(text)', 'EXECUTE'), true, r.who || ' may ask');
  END LOOP;
  PERFORM pg_temp.is(
    (SELECT p.proconfig::text FROM pg_proc p WHERE p.proname = 'firm_public_name') LIKE '%search_path%', true, 'its search path is pinned');
  -- The firms table itself stays closed to a signed-out visitor (P-1.1).
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.firms'), '42501', 'a signed-out visitor still cannot read firms');
  PERFORM pg_temp.as_user('nobody');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.firms WHERE address = ''acme-brokers'''), 'rows:0', 'a signed-in non-member still reads no firm row');
  RESET ROLE;
  RAISE NOTICE 'firm_address: what the name function reveals cases passed';
END $$;

-- ---------- after sign-in: is the caller a member of the firm at this address ----------
-- Break caught: a member is turned away, or someone who is not a member (another firm's owner, a former or future
-- member, a guest) is let in.
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(public.is_member_of_firm_address('acme-brokers'), true, 'an owner is a member at their firm''s address');
  PERFORM pg_temp.is(public.is_member_of_firm_address('Acme-Brokers'), true, 'whatever the capitals');
  PERFORM pg_temp.is(public.is_member_of_firm_address('birch-benefits'), false, 'and not at another firm''s address, though they are signed in');
  PERFORM pg_temp.as_user('acme_agent');
  PERFORM pg_temp.is(public.is_member_of_firm_address('acme-brokers'), true, 'an agent is a member too');
  PERFORM pg_temp.as_user('birch_owner');
  PERFORM pg_temp.is(public.is_member_of_firm_address('acme-brokers'), false, 'another firm''s owner is not a member');
  PERFORM pg_temp.is(public.is_member_of_firm_address('birch-benefits'), true, 'but is at their own');
  PERFORM pg_temp.as_user('nobody');
  PERFORM pg_temp.is(public.is_member_of_firm_address('acme-brokers'), false, 'someone in no firm is not a member');
  PERFORM pg_temp.as_user('former_acme');
  PERFORM pg_temp.is(public.is_member_of_firm_address('acme-brokers'), false, 'a membership that has ended does not count');
  PERFORM pg_temp.as_user('future_acme');
  PERFORM pg_temp.is(public.is_member_of_firm_address('acme-brokers'), false, 'nor one that has not begun');
  PERFORM pg_temp.as_user('guest_visitor', true);
  PERFORM pg_temp.is(public.is_member_of_firm_address('acme-brokers'), false, 'a guest session is no member');
  RAISE NOTICE 'firm_address: membership at an address cases passed';
END $$;

-- Break caught: a member of a firm waiting for approval is turned away from its address, an address nobody holds has
-- members, or the function lists what firm the caller belongs to.
DO $$
BEGIN
  PERFORM pg_temp.as_user('waiting_owner');
  PERFORM pg_temp.is(public.is_member_of_firm_address('waiting-firm'), true, 'an owner of a firm not yet approved is a member at its address (approval blocks sending, not working)');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(public.is_member_of_firm_address('waiting-firm'), false, 'another firm''s member is no member at a firm not yet approved');
  PERFORM pg_temp.as_user('nobody');
  PERFORM pg_temp.is(public.is_member_of_firm_address('waiting-firm'), false, 'someone in no firm is no member at a firm not yet approved');
  PERFORM pg_temp.as_user('waiting_owner');
  PERFORM pg_temp.is(public.is_member_of_firm_address('no-such-firm'), false, 'an unknown address has no members');
  PERFORM pg_temp.is(public.is_member_of_firm_address(NULL), false, 'no address has no members');
  PERFORM pg_temp.is(public.is_member_of_firm_address('%'), false, 'a wildcard matches nothing');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.is_member_of_firm_address('acme-brokers')$q$), 'rows:1', 'it never errors for a non-member');
  RESET ROLE;
  RAISE NOTICE 'firm_address: unknown address for a signed-in caller cases passed';
END $$;

-- Break caught: a signed-out visitor may call the membership question (it answers about the caller only, and a
-- signed-out caller has nothing to ask).
DO $$
BEGIN
  PERFORM pg_temp.is(has_function_privilege('anon', 'public.is_member_of_firm_address(text)', 'EXECUTE'), false, 'signed-out visitors cannot ask');
  PERFORM pg_temp.is(has_function_privilege('authenticated', 'public.is_member_of_firm_address(text)', 'EXECUTE'), true, 'signed-in people can');
  RAISE NOTICE 'firm_address: all cases passed';
END $$;
