-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh firms
-- Firms, teams and dated memberships (story P-1.1; docs/BROKER_CRM_BUILD.md D-5, D-6, D-15, D-18, D-20;
-- 20261116090000_firms.sql). Today's people and intakes are set up before the migration runs, so the test sees
-- what it does to a database already in use: Edgar Allan Advisory is the first firm, set to "everyone sees
-- everything"; today's admins are its owners and today's advisors its agents; every intake is its. Then: the
-- firm address rules, teams that stay inside their firm, memberships that are dated and never overwritten, a
-- firm that always keeps a current owner, and the helpers later stories call to ask whether the caller is a
-- current member of a firm, and with what role.
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
SET client_min_messages = notice;

-- ---------- helpers ----------
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

-- Act as a named person (with a guest token when guest) until the next as_user() or RESET ROLE.
CREATE FUNCTION pg_temp.as_user(n text, guest boolean DEFAULT false) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', guest,
      'email', CASE WHEN guest THEN NULL ELSE n || '@example.test' END)::text, false);
  SET LOCAL ROLE authenticated;
END $$;

CREATE FUNCTION pg_temp.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', false);
  SET LOCAL ROLE service_role;
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

-- ---------- today, before firms exist ----------
-- Two admins (one of them also an advisor), two advisors, and prospects with a draft and a certified intake.
DO $$
DECLARE
  who text;
  sid uuid;
BEGIN
  PERFORM pg_temp.new_user('admin_1');
  PERFORM pg_temp.new_user('admin_and_advisor');
  PERFORM pg_temp.new_user('advisor_1');
  PERFORM pg_temp.new_user('advisor_2');
  PERFORM pg_temp.new_user('prospect_a');
  PERFORM pg_temp.new_user('prospect_b');
  PERFORM pg_temp.new_user('guest_a', true);
  INSERT INTO public.user_roles (user_id, role) VALUES
    (pg_temp.id('admin_1'), 'admin'), (pg_temp.id('admin_and_advisor'), 'admin'), (pg_temp.id('admin_and_advisor'), 'advisor'),
    (pg_temp.id('advisor_1'), 'advisor'), (pg_temp.id('advisor_2'), 'advisor');

  FOREACH who IN ARRAY ARRAY['prospect_a', 'prospect_b'] LOOP
    PERFORM pg_temp.as_user(who);
    PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');
    INSERT INTO public.chamber_sessions (user_id, chamber_data)
    VALUES (pg_temp.id(who), jsonb_build_object('company_name', who || ' Co', 'states', jsonb_build_array('CA'),
      'pay_frequency', 'Bi-weekly', 'employee_count', 3))
    RETURNING id INTO sid;
    RESET ROLE;
    INSERT INTO fx VALUES (who || '_intake', sid);
  END LOOP;
  -- Prospect A's is certified: a submission.
  PERFORM pg_temp.as_user('prospect_a');
  UPDATE public.chamber_sessions
  SET status = 'submitted',
      submission = jsonb_build_object('signer_name', 'Pat A', 'signer_title', 'CEO', 'signed_at', '2026-11-01T12:00:00Z',
        'consent_version', 'v1', 'consent_text', 'I certify.', 'chamber_data', chamber_data)
  WHERE id = pg_temp.id('prospect_a_intake');
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', false);
END $$;

\i supabase/migrations/20261116090000_firms.sql

-- ---------- Edgar Allan Advisory ----------
DO $$
BEGIN
  PERFORM pg_temp.is((SELECT count(*) FROM public.firms WHERE name = 'Edgar Allan Advisory'), 1::bigint, 'Edgar Allan Advisory is a firm');
  PERFORM pg_temp.is((SELECT visibility FROM public.firms WHERE name = 'Edgar Allan Advisory'), 'everyone', 'Edgar Allan Advisory''s visibility');
  -- Approved, so nothing it does later waits for a platform admin's approval (Q-1.2).
  PERFORM pg_temp.is((SELECT approved_at IS NOT NULL FROM public.firms WHERE name = 'Edgar Allan Advisory'), true, 'Edgar Allan Advisory is approved');
  -- D-15: today's admins are its owners and today's advisors its agents; someone who is both is an owner, once.
  -- Prospects and guests are members of nothing.
  PERFORM pg_temp.is((
    SELECT string_agg(f.name || ':' || m.role, ',' ORDER BY f.name)
    FROM public.firm_memberships m JOIN fx f ON f.id = m.user_id
    WHERE m.firm_id = (SELECT id FROM public.firms WHERE name = 'Edgar Allan Advisory') AND m.valid_until IS NULL),
    'admin_1:owner,admin_and_advisor:owner,advisor_1:agent,advisor_2:agent', 'Edgar Allan Advisory''s members');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_memberships), 4::bigint, 'memberships after the migration');
  -- Every intake already there, draft or submission, is its.
  PERFORM pg_temp.is((
    SELECT string_agg(f.name || ':' || COALESCE(fm.name, 'none'), ',' ORDER BY f.name)
    FROM public.chamber_sessions s JOIN fx f ON f.id = s.id LEFT JOIN public.firms fm ON fm.id = s.firm_id),
    'prospect_a_intake:Edgar Allan Advisory,prospect_b_intake:Edgar Allan Advisory', 'the firm of each intake already there');
  RAISE NOTICE 'firms: Edgar Allan Advisory cases passed';
END $$;

-- A second firm, as later stories will create one (CRM-P1.1); here written as the superuser.
INSERT INTO public.firms (name, address) VALUES ('Acme Brokers', 'acme');
INSERT INTO fx SELECT 'acme', id FROM public.firms WHERE address = 'acme';
INSERT INTO fx SELECT 'eaa', id FROM public.firms WHERE name = 'Edgar Allan Advisory';

-- ---------- new intakes ----------
-- An intake started without a firm is Edgar Allan Advisory's. The browser never chooses or changes an intake's firm
-- (CRM-P2.1: nothing takes the firm from the browser); a server function, as the service role, may.
DO $$
DECLARE sid uuid;
BEGIN
  PERFORM pg_temp.as_user('guest_a', true);
  PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (pg_temp.id('guest_a'), '{"company_name":"Guest Co"}') RETURNING id INTO sid;
  RESET ROLE;
  PERFORM pg_temp.is((SELECT firm_id FROM public.chamber_sessions WHERE id = sid), pg_temp.id('eaa'), 'a new intake started without a firm');

  -- A browser that names another firm still starts an intake of Edgar Allan Advisory's.
  PERFORM pg_temp.as_user('prospect_b');
  PERFORM public.archive_chamber_session(pg_temp.id('prospect_b_intake'));
  INSERT INTO public.chamber_sessions (user_id, firm_id, chamber_data)
  VALUES (pg_temp.id('prospect_b'), pg_temp.id('acme'), '{"company_name":"Chooser Co"}') RETURNING id INTO sid;
  RESET ROLE;
  PERFORM pg_temp.is((SELECT firm_id FROM public.chamber_sessions WHERE id = sid), pg_temp.id('eaa'), 'a new intake whose browser named another firm');

  -- Nor can the prospect move their own intake to another firm.
  PERFORM pg_temp.as_user('prospect_b');
  UPDATE public.chamber_sessions SET firm_id = pg_temp.id('acme') WHERE id = sid;
  RESET ROLE;
  PERFORM pg_temp.is((SELECT firm_id FROM public.chamber_sessions WHERE id = sid), pg_temp.id('eaa'), 'an intake whose browser moved it to another firm');

  -- A server function may.
  PERFORM pg_temp.as_service();
  UPDATE public.chamber_sessions SET firm_id = pg_temp.id('acme') WHERE id = sid;
  RESET ROLE;
  PERFORM pg_temp.is((SELECT firm_id FROM public.chamber_sessions WHERE id = sid), pg_temp.id('acme'), 'an intake the service role moved');
  UPDATE public.chamber_sessions SET firm_id = pg_temp.id('eaa') WHERE id = sid;
  RAISE NOTICE 'firms: new intake cases passed';
END $$;

-- ---------- the firm address ----------
-- CRM-P1.1: 3 to 40 letters, digits or hyphens; refused when taken, a system word, or reading as Nevermore or a
-- listed PEO. Kept in lower case, since a host name's case means nothing, and never starting or ending with a
-- hyphen, which a host name can't.
DO $$
DECLARE word text;
BEGIN
  PERFORM pg_temp.expect($q$INSERT INTO public.firms (name, address) VALUES ('Short', 'ab')$q$, '23514', 'a two-letter address');
  PERFORM pg_temp.expect($q$INSERT INTO public.firms (name, address) VALUES ('Long', repeat('a', 41))$q$, '23514', 'a 41-letter address');
  PERFORM pg_temp.expect($q$INSERT INTO public.firms (name, address) VALUES ('Long', repeat('a', 40))$q$, 'rows:1', 'a 40-letter address');
  PERFORM pg_temp.expect($q$INSERT INTO public.firms (name, address) VALUES ('Under', 'under_score')$q$, '23514', 'an address with an underscore');
  PERFORM pg_temp.expect($q$INSERT INTO public.firms (name, address) VALUES ('Upper', 'Upper')$q$, '23514', 'an address in capitals');
  PERFORM pg_temp.expect($q$INSERT INTO public.firms (name, address) VALUES ('Hyphen', '-hyphen')$q$, '23514', 'an address starting with a hyphen');
  PERFORM pg_temp.expect($q$INSERT INTO public.firms (name, address) VALUES ('Hyphen', 'hyphen-')$q$, '23514', 'an address ending with a hyphen');
  PERFORM pg_temp.expect($q$INSERT INTO public.firms (name, address) VALUES ('Taken', 'acme')$q$, '23505', 'an address another firm has');
  -- The system words, and the reply addresses' subdomain (QUOTE_REPLY_DOMAIN, quotes.nevermorepeo.com).
  FOREACH word IN ARRAY ARRAY['www', 'app', 'api', 'mail', 'admin', 'status', 'quotes'] LOOP
    PERFORM pg_temp.expect(format($q$INSERT INTO public.firms (name, address) VALUES ('System', %L)$q$, word), '23514', 'the address ' || word);
  END LOOP;
  -- Anything that reads as Nevermore.
  PERFORM pg_temp.expect($q$INSERT INTO public.firms (name, address) VALUES ('Brand', 'nevermore-brokers')$q$, '23514', 'an address naming Nevermore');
  PERFORM pg_temp.expect($q$INSERT INTO public.firms (name, address) VALUES ('Brand', 'never-more')$q$, '23514', 'an address spelling Nevermore with a hyphen');
  -- Anything that reads as a listed PEO.
  PERFORM pg_temp.expect($q$INSERT INTO public.firms (name, address) VALUES ('PEO', 'trinet-partners')$q$, '23514', 'an address naming TriNet');
  PERFORM pg_temp.expect($q$INSERT INTO public.firms (name, address) VALUES ('PEO', 'adp-totalsource')$q$, '23514', 'an address naming ADP TotalSource');
  PERFORM pg_temp.expect($q$UPDATE public.firms SET address = 'insperity' WHERE address = 'acme'$q$, '23514', 'a firm changing its address to Insperity');
  -- A PEO that is no longer listed (a name, not an offer) doesn't hold a name back.
  UPDATE public.peos SET listed = false WHERE name = 'Justworks';
  PERFORM pg_temp.expect($q$INSERT INTO public.firms (name, address) VALUES ('PEO', 'justworks-fans')$q$, 'rows:1', 'an address naming a PEO no longer listed');
  UPDATE public.peos SET listed = true WHERE name = 'Justworks';
  RAISE NOTICE 'firms: firm address cases passed';
END $$;

-- ---------- what a firm holds ----------
DO $$
BEGIN
  -- CRM-S5.1: a firm sees by level (an agent what they own, a lead their team's, an owner everything) unless it
  -- switches to "everyone sees everything". A new firm sees by level, and has not been approved (Q-1.2).
  PERFORM pg_temp.is((SELECT visibility FROM public.firms WHERE address = 'acme'), 'by_level', 'a new firm''s visibility');
  PERFORM pg_temp.is((SELECT approved_at FROM public.firms WHERE address = 'acme'), NULL::timestamptz, 'a new firm''s approval');
  PERFORM pg_temp.expect($q$UPDATE public.firms SET visibility = 'everyone' WHERE address = 'acme'$q$, 'rows:1', 'switching to everyone sees everything');
  PERFORM pg_temp.expect($q$UPDATE public.firms SET visibility = 'nobody' WHERE address = 'acme'$q$, '23514', 'a visibility that isn''t one');
  -- D-6: a firm can name a parent firm, which must be a firm. Nothing reads it yet.
  PERFORM pg_temp.expect(format($q$UPDATE public.firms SET parent_firm_id = %L WHERE address = 'acme'$q$, pg_temp.id('eaa')), 'rows:1', 'a parent firm');
  PERFORM pg_temp.expect(format($q$UPDATE public.firms SET parent_firm_id = %L WHERE address = 'acme'$q$, gen_random_uuid()), '23503', 'a parent that is no firm');
  RAISE NOTICE 'firms: firm cases passed';
END $$;

-- ---------- teams ----------
-- D-20: a firm's teams, each with a name, an optional parent team and a lead. No screen shows them until CRM-X1.1.
DO $$
DECLARE
  sales uuid;
  west uuid;
  acme_team uuid;
BEGIN
  INSERT INTO public.firm_teams (firm_id, name, lead_user_id) VALUES (pg_temp.id('eaa'), 'Sales', pg_temp.id('advisor_1')) RETURNING id INTO sales;
  INSERT INTO public.firm_teams (firm_id, name, parent_team_id) VALUES (pg_temp.id('eaa'), 'West', sales) RETURNING id INTO west;
  INSERT INTO public.firm_teams (firm_id, name) VALUES (pg_temp.id('acme'), 'Acme team') RETURNING id INTO acme_team;
  INSERT INTO fx VALUES ('sales', sales), ('west', west), ('acme_team', acme_team);
  -- A team sits under a team of its own firm only, or "everything under a lead" would reach into another firm.
  PERFORM pg_temp.expect(format($q$INSERT INTO public.firm_teams (firm_id, name, parent_team_id) VALUES (%L, 'Stray', %L)$q$, pg_temp.id('acme'), sales),
    '23503', 'a team under another firm''s team');
  -- Nor under itself, however far down: a loop would make "everything under it" endless.
  PERFORM pg_temp.expect(format($q$UPDATE public.firm_teams SET parent_team_id = %L WHERE id = %L$q$, west, sales), '23514', 'a team under its own team');
  PERFORM pg_temp.expect(format($q$UPDATE public.firm_teams SET parent_team_id = %L WHERE id = %L$q$, sales, sales), '23514', 'a team directly under itself');
  PERFORM pg_temp.expect(format($q$INSERT INTO public.firm_teams (id, firm_id, name, parent_team_id) VALUES (%1$L, %2$L, 'Self', %1$L)$q$, gen_random_uuid(), pg_temp.id('eaa')), '23514', 'a new team under itself');
  RAISE NOTICE 'firms: team cases passed';
END $$;

-- ---------- memberships ----------
-- Dated, never overwritten (docs/BROKER_CRM_PRD.md 8.4): a change ends one row and adds another, so who could see a
-- record on a given day can always be answered. Roles are owner, lead and agent (D-5).
DO $$
DECLARE acme_owner uuid := pg_temp.new_user('acme_owner');
BEGIN
  PERFORM pg_temp.expect(format($q$INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (%L, %L, 'member')$q$,
    pg_temp.id('acme'), acme_owner), '23514', 'the role member');
  -- A member's team is one of their firm's.
  PERFORM pg_temp.expect(format($q$INSERT INTO public.firm_memberships (firm_id, user_id, role, team_id) VALUES (%L, %L, 'owner', %L)$q$,
    pg_temp.id('acme'), acme_owner, pg_temp.id('sales')), '23503', 'a member in another firm''s team');
  -- Acme's first owner. A person holds one membership of a firm at a time: a second that overlaps it is refused.
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (pg_temp.id('acme'), acme_owner, 'owner');
  PERFORM pg_temp.expect(format($q$INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (%L, %L, 'agent')$q$,
    pg_temp.id('acme'), acme_owner), '23P01', 'a second current membership of the same firm');
  -- A membership is never changed in place: not its role, team, person, firm or start.
  PERFORM pg_temp.expect(format($q$UPDATE public.firm_memberships SET role = 'lead' WHERE user_id = %L$q$, pg_temp.id('advisor_1')), '42501', 'changing a role in place');
  PERFORM pg_temp.expect(format($q$UPDATE public.firm_memberships SET team_id = %L WHERE user_id = %L$q$, pg_temp.id('sales'), pg_temp.id('advisor_1')), '42501', 'changing a team in place');
  PERFORM pg_temp.expect(format($q$UPDATE public.firm_memberships SET valid_from = now() - interval '1 year' WHERE user_id = %L$q$, pg_temp.id('advisor_1')), '42501', 'backdating a membership');
  PERFORM pg_temp.expect(format($q$UPDATE public.firm_memberships SET user_id = %L WHERE user_id = %L$q$, pg_temp.id('prospect_a'), pg_temp.id('advisor_1')), '42501', 'handing a membership to someone else');
  PERFORM pg_temp.expect(format($q$UPDATE public.firm_memberships SET firm_id = %L WHERE user_id = %L$q$, pg_temp.id('acme'), pg_temp.id('advisor_1')), '42501', 'moving a membership to another firm');
  -- Ending one is the only change, and once.
  UPDATE public.firm_memberships SET valid_until = now() WHERE user_id = pg_temp.id('advisor_2');
  PERFORM pg_temp.expect(format($q$UPDATE public.firm_memberships SET valid_until = NULL WHERE user_id = %L$q$, pg_temp.id('advisor_2')), '42501', 'reopening an ended membership');
  -- An end before the start is refused.
  PERFORM pg_temp.expect(format($q$UPDATE public.firm_memberships SET valid_until = now() - interval '1 day' WHERE user_id = %L$q$, pg_temp.id('advisor_1')), '23514', 'ending a membership before it began');
  RAISE NOTICE 'firms: membership cases passed';
END $$;
