-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh firm_signup
-- Signing up a firm, and a platform admin approving or refusing it (story CRM-P1.1 with Q-1.2; docs/BROKER_CRM_BUILD.md
-- D-5, D-16, D-18, D-21, D-26, D-27; 20261116170000_firm_signup.sql). A signed-in person with a verified email signs a
-- firm up: a name, an address (the rules of the firm address already in the table apply, and the address is read the
-- way every firm address is: without capitals or surrounding spaces) and they become its first owner. The firm
-- starts waiting for approval. A platform admin, who is no member of any firm (D-16), sees the waiting firms and
-- approves or refuses one; the decision, who made it and when, is recorded, and a decided firm is not decided again.
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
\i supabase/migrations/20261116150000_second_factor_for_password_sign_ins.sql
\i supabase/migrations/20261116170000_firm_signup.sql
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


-- ---------- set up: people, a platform admin, an existing firm ----------
DO $$
DECLARE acme uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Acme Brokers', 'acme-brokers', now()) RETURNING id INTO acme;
  INSERT INTO fx VALUES ('acme', acme);
  PERFORM pg_temp.new_user('founder');
  PERFORM pg_temp.new_user('founder2');
  PERFORM pg_temp.new_user('founder3');
  PERFORM pg_temp.new_user('acme_owner');
  PERFORM pg_temp.new_user('platform_admin');
  PERFORM pg_temp.new_user('plain_advisor');
  PERFORM pg_temp.new_user('nobody_here');
  PERFORM pg_temp.new_user('unverified', false, false);
  PERFORM pg_temp.new_user('guest_visitor', true);
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (acme, pg_temp.id('acme_owner'), 'owner');
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('platform_admin'), 'admin'), (pg_temp.id('plain_advisor'), 'advisor');
END $$;

-- ---------- signing up ----------
-- Break caught: signing up makes no firm, or makes one the person doesn't own, or one that is already approved, or
-- one that can't be found at its address.
DO $$
DECLARE fid uuid;
BEGIN
  PERFORM pg_temp.as_user('founder');
  fid := public.sign_up_firm('Fresh Benefits', 'fresh-benefits');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT name FROM public.firms WHERE id = fid), 'Fresh Benefits', 'the firm has the name given');
  PERFORM pg_temp.is((SELECT address FROM public.firms WHERE id = fid), 'fresh-benefits', 'and the address given');
  PERFORM pg_temp.is((SELECT approved_at IS NULL FROM public.firms WHERE id = fid), true, 'a new firm waits for approval');
  PERFORM pg_temp.is((SELECT visibility FROM public.firms WHERE id = fid), 'by_level', 'and sees by level');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_memberships WHERE firm_id = fid), 1::bigint, 'it has exactly one member');
  PERFORM pg_temp.is((SELECT role FROM public.firm_memberships WHERE firm_id = fid AND user_id = pg_temp.id('founder')), 'owner', 'the person who signed up is its owner');
  PERFORM pg_temp.is((SELECT valid_until IS NULL FROM public.firm_memberships WHERE firm_id = fid), true, 'with no end date');
  PERFORM pg_temp.as_user('founder');
  PERFORM pg_temp.is(public.is_member_of_firm_address('fresh-benefits'), true, 'so they are a member at their firm''s address at once');
  PERFORM pg_temp.is(public.firm_role(fid), 'owner', 'and an owner');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(public.firm_public_name('fresh-benefits'), 'Fresh Benefits', 'a waiting firm shows its name at its address (D-27)');
  RESET ROLE;
  RAISE NOTICE 'firm_signup: signing up cases passed';
END $$;

-- ---------- who may sign a firm up ----------
-- Break caught: a guest session, a signed-out visitor, or an account whose email was never verified signs a firm up.
DO $$
DECLARE before_count bigint := (SELECT count(*) FROM public.firms);
BEGIN
  PERFORM pg_temp.as_user('guest_visitor', true);
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.sign_up_firm('Guest Firm', 'guest-firm')$q$), '42501', 'a guest session may not sign a firm up');
  PERFORM pg_temp.as_user('unverified');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.sign_up_firm('Unverified Firm', 'unverified-firm')$q$), '42501', 'an account whose email is not verified may not');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.sign_up_firm('Anon Firm', 'anon-firm')$q$), '42501', 'a signed-out visitor may not');
  PERFORM pg_temp.is(has_function_privilege('anon', 'public.sign_up_firm(text, text)', 'EXECUTE'), false, 'the signed-out role holds no right to call it');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firms), before_count, 'and none of them left a firm behind');
  RAISE NOTICE 'firm_signup: who may sign up cases passed';
END $$;

-- Break caught: a blank or absurdly long name is accepted, so a firm shows as nothing at its address.
DO $$
BEGIN
  PERFORM pg_temp.as_user('founder2');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.sign_up_firm('', 'blank-name')$q$), '23514', 'an empty name is refused');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.sign_up_firm('   ', 'blank-name')$q$), '23514', 'so is one of spaces');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.sign_up_firm(NULL, 'blank-name')$q$), '23514', 'and no name');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.sign_up_firm(%L, 'long-name')$q$, repeat('x', 81))), '23514', 'a name over 80 characters is refused');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.sign_up_firm(%L, 'long-name-ok')$q$, repeat('x', 80))), 'rows:1', 'one of exactly 80 is fine');
  RESET ROLE;
  RAISE NOTICE 'firm_signup: name cases passed';
END $$;

-- ---------- the address ----------
-- Break caught: the address is stored as typed (capitals, spaces), so the firm can't be found at its own address;
-- or the same address in other capitals is let in as a second firm.
DO $$
DECLARE fid uuid;
BEGIN
  PERFORM pg_temp.as_user('founder2');
  fid := public.sign_up_firm('Capital Brokers', '  Capital-Brokers ');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT address FROM public.firms WHERE id = fid), 'capital-brokers', 'the address is kept in lower case, without surrounding spaces');
  PERFORM pg_temp.as_user('founder3');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.sign_up_firm('Copycat', 'CAPITAL-BROKERS')$q$), '23505', 'the same address in capitals is taken');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.sign_up_firm('Copycat', 'acme-brokers')$q$), '23505', 'an address another firm holds is taken');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.sign_up_firm('Copycat', 'edgar-allan-advisory')$q$), '23505', 'so is Edgar Allan Advisory''s');
  RESET ROLE;
  RAISE NOTICE 'firm_signup: address normalisation and taken cases passed';
END $$;

-- Break caught: an address the firm address rules refuse (3 to 40 letters, digits or hyphens; a system word; one that
-- reads as Nevermore; one that is exactly a listed PEO's, D-26) gets through sign-up, or a refused one still leaves
-- a firm or an owner behind.
DO $$
DECLARE r record; firms_before bigint; members_before bigint;
BEGIN
  RESET ROLE;
  firms_before := (SELECT count(*) FROM public.firms);
  members_before := (SELECT count(*) FROM public.firm_memberships);
  PERFORM pg_temp.as_user('founder3');
  FOR r IN SELECT * FROM (VALUES
      ('ab', 'too short'), (repeat('a', 41), 'too long'), ('-fresh', 'starts with a hyphen'), ('fresh-', 'ends with a hyphen'),
      ('fresh_firm', 'an underscore'), ('fresh.firm', 'a dot'), ('fresh firm', 'a space inside'), ('frésh', 'an accent'), ('', 'empty'),
      ('www', 'a system word'), ('app', 'a system word'), ('api', 'a system word'), ('mail', 'a system word'), ('admin', 'a system word'),
      ('status', 'a system word'), ('quotes', 'the reply-address subdomain'), ('ADMIN', 'a system word in capitals'),
      ('nevermore', 'Nevermore'), ('never-more-benefits', 'reads as Nevermore'), ('my-nevermore', 'ends in Nevermore'),
      ('justworks', 'a listed PEO'), ('Just-Works', 'a listed PEO with a hyphen and capitals')) AS t(addr, why)
  LOOP
    PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.sign_up_firm(%L, %L)', 'Some Firm', r.addr)), '23514', r.why || ' (' || r.addr || ') is refused');
  END LOOP;
  -- D-26: only an exact match is a PEO's: a name that merely contains a PEO's is the firm's own.
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.sign_up_firm('Justworks Partners', 'justworks-partners')$q$), 'rows:1', 'a name that only contains a PEO''s is fine');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firms), firms_before + 0, 'a refused address left no firm behind');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_memberships), members_before + 0, 'and no owner');
  RAISE NOTICE 'firm_signup: address rule cases passed';
END $$;

-- ---------- a platform admin sees the waiting firms ----------
-- Break caught: the list shows an approved firm, hides a waiting one, leaves out who signed it up, or an admin has to
-- be a firm member to see it (D-16).
DO $$
DECLARE r record; fresh uuid := (SELECT id FROM public.firms WHERE address = 'fresh-benefits');
BEGIN
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_memberships WHERE user_id = pg_temp.id('platform_admin')), 0::bigint, 'the platform admin is no member of any firm');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firms), 0::bigint, 'so reads no firm through the table (D-16)');
  PERFORM pg_temp.is((SELECT array_agg(w.address ORDER BY w.address) FROM public.admin_waiting_firms() w),
    ARRAY['capital-brokers', 'fresh-benefits'], 'but sees the two firms waiting, and neither Acme nor Edgar Allan Advisory');
  SELECT * INTO r FROM public.admin_waiting_firms() w WHERE w.address = 'fresh-benefits';
  PERFORM pg_temp.is(r.name, 'Fresh Benefits', 'with the firm''s name');
  PERFORM pg_temp.is(r.signed_up_by_email, 'founder@example.test', 'and the email of the person who signed it up');
  PERFORM pg_temp.is(r.firm_id, fresh, 'and its id');
  PERFORM pg_temp.is(r.signed_up_at IS NOT NULL AND r.signed_up_at <= now(), true, 'and when it signed up');
  RESET ROLE;
  RAISE NOTICE 'firm_signup: admin list cases passed';
END $$;

-- Break caught: the list is not oldest first, or names a member who is not the owner (an agent who joined earlier)
-- as the person who signed the firm up.
DO $$
DECLARE
  fresh uuid := (SELECT id FROM public.firms WHERE address = 'fresh-benefits');
  capital uuid := (SELECT id FROM public.firms WHERE address = 'capital-brokers');
  was_fresh timestamptz; was_capital timestamptz;
BEGIN
  RESET ROLE;
  SELECT created_at INTO was_fresh FROM public.firms WHERE id = fresh;
  SELECT created_at INTO was_capital FROM public.firms WHERE id = capital;
  UPDATE public.firms SET created_at = now() - interval '2 days' WHERE id = capital;
  UPDATE public.firms SET created_at = now() - interval '1 day' WHERE id = fresh;
  PERFORM pg_temp.new_user('earlier_agent');
  INSERT INTO public.firm_memberships (firm_id, user_id, role, valid_from)
    VALUES (fresh, pg_temp.id('earlier_agent'), 'agent', now() - interval '3 days');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is((SELECT array_agg(w.address) FROM public.admin_waiting_firms() w),
    ARRAY['capital-brokers', 'fresh-benefits'], 'the oldest waiting firm is first');
  PERFORM pg_temp.is((SELECT w.signed_up_by_email FROM public.admin_waiting_firms() w WHERE w.firm_id = fresh), 'founder@example.test',
    'the person named is the owner, not an agent who joined earlier');
  RESET ROLE;
  DELETE FROM public.firm_memberships WHERE firm_id = fresh AND user_id = pg_temp.id('earlier_agent');
  UPDATE public.firms SET created_at = was_capital WHERE id = capital;
  UPDATE public.firms SET created_at = was_fresh WHERE id = fresh;
  RAISE NOTICE 'firm_signup: admin list order and owner cases passed';
END $$;

-- Break caught: ownership passes to someone else while approval is pending (the new owner added, the first owner's
-- membership ended), and the list names the replacement as the person who signed the firm up.
DO $$
DECLARE transfer_firm uuid; founder_email text;
BEGIN
  PERFORM pg_temp.new_user('first_founder');
  PERFORM pg_temp.new_user('replacement_owner');
  SELECT email::text INTO founder_email FROM auth.users WHERE id = pg_temp.id('first_founder');
  PERFORM pg_temp.as_user('first_founder');
  transfer_firm := public.sign_up_firm('Handover Brokers', 'handover-brokers');
  RESET ROLE;
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (transfer_firm, pg_temp.id('replacement_owner'), 'owner');
  UPDATE public.firm_memberships SET valid_until = now()
    WHERE firm_id = transfer_firm AND user_id = pg_temp.id('first_founder');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is((SELECT w.signed_up_by_email FROM public.admin_waiting_firms() w WHERE w.firm_id = transfer_firm),
    founder_email, 'the person who signed the firm up is still named after ownership has passed to another');
  RESET ROLE;
  -- Clean up: the owner guard would keep the last owner, so it is switched off for this one deletion.
  ALTER TABLE public.firm_memberships DISABLE TRIGGER USER;
  DELETE FROM public.firm_memberships WHERE firm_id = transfer_firm;
  ALTER TABLE public.firm_memberships ENABLE TRIGGER USER;
  DELETE FROM public.firms WHERE id = transfer_firm;
  RAISE NOTICE 'firm_signup: ownership transfer cases passed';
END $$;

-- Break caught: the list, or a decision, is open to someone who isn't a platform admin: an advisor, a firm's owner
-- (the waiting firm's own included), a guest, or a signed-out caller.
DO $$
DECLARE fresh uuid := (SELECT id FROM public.firms WHERE address = 'fresh-benefits'); who text;
BEGIN
  FOREACH who IN ARRAY ARRAY['plain_advisor', 'founder', 'acme_owner', 'nobody_here'] LOOP
    PERFORM pg_temp.as_user(who);
    PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.admin_waiting_firms()'), '42501', who || ' may not list waiting firms');
    PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.admin_decide_firm(%L, true, NULL)', fresh)), '42501', who || ' may not approve');
    PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.admin_decide_firm(%L, false, NULL)', fresh)), '42501', who || ' may not refuse');
  END LOOP;
  PERFORM pg_temp.as_user('guest_visitor', true);
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.admin_waiting_firms()'), '42501', 'a guest may not list');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.admin_decide_firm(%L, true, NULL)', fresh)), '42501', 'or approve');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.admin_waiting_firms()'), '42501', 'a signed-out caller may not list');
  PERFORM pg_temp.is(has_function_privilege('anon', 'public.admin_waiting_firms()', 'EXECUTE'), false, 'and holds no right to call it');
  PERFORM pg_temp.is(has_function_privilege('anon', 'public.admin_decide_firm(uuid, boolean, text)', 'EXECUTE'), false, 'nor to decide');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT approved_at IS NULL FROM public.firms WHERE id = fresh), true, 'and the firm still waits');
  RAISE NOTICE 'firm_signup: admin-only cases passed';
END $$;

-- ---------- approving and refusing ----------
-- Break caught: approval doesn't approve; the decision isn't recorded (who, when, why); an approved firm stays on
-- the waiting list; or approving changes anything else about the firm.
DO $$
DECLARE fresh uuid := (SELECT id FROM public.firms WHERE address = 'fresh-benefits'); f public.firms;
BEGIN
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_decide_firm(fresh, true, 'Known broker');
  RESET ROLE;
  SELECT * INTO f FROM public.firms WHERE id = fresh;
  PERFORM pg_temp.is(f.approved_at IS NOT NULL AND f.approved_at <= now(), true, 'the firm is approved');
  PERFORM pg_temp.is(f.decision, 'approved', 'the decision is recorded as approved');
  PERFORM pg_temp.is(f.decided_by, pg_temp.id('platform_admin'), 'with who made it');
  PERFORM pg_temp.is(f.decided_at = f.approved_at, true, 'and when, the moment it was approved');
  PERFORM pg_temp.is(f.decision_note, 'Known broker', 'and the note');
  PERFORM pg_temp.is(concat_ws('|', f.name, f.address, f.visibility), 'Fresh Benefits|fresh-benefits|by_level', 'nothing else about the firm changed');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is((SELECT array_agg(w.address) FROM public.admin_waiting_firms() w), ARRAY['capital-brokers'], 'it is no longer waiting');
  RESET ROLE;
  RAISE NOTICE 'firm_signup: approval cases passed';
END $$;

-- Break caught: a refusal approves the firm, isn't recorded, or leaves the firm on the waiting list; a refused
-- firm vanishes from its own address; or a note is required or kept untrimmed.
DO $$
DECLARE capital uuid := (SELECT id FROM public.firms WHERE address = 'capital-brokers'); f public.firms;
BEGIN
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_decide_firm(capital, false, '  Looks like a look-alike  ');
  RESET ROLE;
  SELECT * INTO f FROM public.firms WHERE id = capital;
  PERFORM pg_temp.is(f.approved_at IS NULL, true, 'a refused firm is not approved');
  PERFORM pg_temp.is(f.decision, 'refused', 'the decision is recorded as refused');
  PERFORM pg_temp.is(f.decided_by, pg_temp.id('platform_admin'), 'with who made it');
  PERFORM pg_temp.is(f.decided_at IS NOT NULL AND f.decided_at <= now(), true, 'and when');
  PERFORM pg_temp.is(f.decision_note, 'Looks like a look-alike', 'and the note, trimmed');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is((SELECT count(*) FROM public.admin_waiting_firms()), 0::bigint, 'it is no longer waiting');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(public.firm_public_name('capital-brokers'), NULL::text, 'a refused firm shows no name at its address, so a look-alike is not shown to visitors');
  PERFORM pg_temp.as_user('founder2');
  PERFORM pg_temp.is(public.is_member_of_firm_address('capital-brokers'), false, 'and its founder is not taken for a member there');
  RESET ROLE;
  RAISE NOTICE 'firm_signup: refusal cases passed';
END $$;

-- Break caught: a decided firm is decided again (a refusal turned into an approval by a second click, an approval
-- overwritten), an unknown firm is silently accepted, Edgar Allan Advisory is "approved" again, or an admin decides
-- on a firm they belong to.
DO $$
DECLARE fresh uuid := (SELECT id FROM public.firms WHERE address = 'fresh-benefits');
        capital uuid := (SELECT id FROM public.firms WHERE address = 'capital-brokers');
        own uuid; before_row jsonb;
BEGIN
  SELECT to_jsonb(f) INTO before_row FROM public.firms f WHERE id = capital;
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.admin_decide_firm(%L, true, NULL)', capital)), '55000', 'a refused firm is not approved afterwards');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.admin_decide_firm(%L, false, NULL)', fresh)), '55000', 'an approved firm is not refused afterwards');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.admin_decide_firm(%L, true, NULL)', fresh)), '55000', 'nor approved twice');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.admin_decide_firm(%L, true, NULL)', public.default_firm_id())), '55000', 'Edgar Allan Advisory, approved from the start, is not decided');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.admin_decide_firm(%L, true, NULL)', gen_random_uuid())), 'PT404', 'a firm that does not exist is said not to');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.admin_decide_firm(%L, NULL, NULL)', fresh)), '22023', 'a decision is approve or refuse, never neither');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT to_jsonb(f) FROM public.firms f WHERE id = capital), before_row, 'a refused firm is untouched by all that');
  -- Separation of duties: an admin who owns a waiting firm does not decide it.
  PERFORM pg_temp.as_user('platform_admin');
  own := public.sign_up_firm('Admin Own Firm', 'admin-own-firm');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.admin_decide_firm(%L, true, NULL)', own)), '42501', 'an admin cannot approve a firm they belong to');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.admin_decide_firm(%L, false, NULL)', own)), '42501', 'or refuse it');
  RESET ROLE;
  RAISE NOTICE 'firm_signup: decided-once cases passed';
END $$;

-- Break caught: a firm's own owner, through the table, approves it, or rewrites the decision.
DO $$
DECLARE own uuid := (SELECT id FROM public.firms WHERE address = 'admin-own-firm');
BEGIN
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is(pg_temp.attempt(format('UPDATE public.firms SET approved_at = now() WHERE id = %L', own)), '42501', 'nobody approves a firm by writing the table');
  PERFORM pg_temp.is(pg_temp.attempt(format('UPDATE public.firms SET decision = %L WHERE id = %L', 'approved', own)), '42501', 'or writes the decision');
  PERFORM pg_temp.is(pg_temp.attempt('INSERT INTO public.firms (name, address) VALUES (''Sneaky'', ''sneaky'')'), '42501', 'or makes a firm that way');
  RESET ROLE;
  RAISE NOTICE 'firm_signup: table writes cases passed';
END $$;

-- ---------- the event hook ----------
-- Every sign-up and decision goes through record_firm_event, so the story that builds the record of who did what
-- (CRM-P2.3) takes it over by replacing that one function. Break caught: a sign-up or a decision bypasses it, or
-- hands it the wrong firm, kind or person, or the API can call it to write an event of its own.
DO $$
DECLARE fid uuid; fid2 uuid; ev record;
BEGIN
  PERFORM pg_temp.is(has_function_privilege('authenticated', 'public.record_firm_event(uuid, text, uuid, jsonb)', 'EXECUTE'), false, 'a signed-in caller can not record an event of their own');
  PERFORM pg_temp.is(has_function_privilege('anon', 'public.record_firm_event(uuid, text, uuid, jsonb)', 'EXECUTE'), false, 'nor a signed-out one');
  -- Stand in for the record, as CRM-P2.3 will, with a function that keeps what it is given.
  CREATE TEMP TABLE seen_events (firm_id uuid, kind text, actor uuid, detail jsonb);
  GRANT ALL ON seen_events TO PUBLIC;
  CREATE OR REPLACE FUNCTION public.record_firm_event(p_firm_id uuid, p_kind text, p_actor uuid, p_detail jsonb)
  RETURNS void LANGUAGE sql SECURITY DEFINER AS $f$ INSERT INTO pg_temp.seen_events VALUES (p_firm_id, p_kind, p_actor, p_detail) $f$;
  PERFORM pg_temp.as_user('founder3');
  fid := public.sign_up_firm('Hooked Firm', 'hooked-firm');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_decide_firm(fid, true, 'ok');
  RESET ROLE;
  SELECT * INTO ev FROM seen_events WHERE kind = 'firm_signed_up';
  PERFORM pg_temp.is(ev.firm_id, fid, 'the sign-up is recorded against the new firm');
  PERFORM pg_temp.is(ev.actor, pg_temp.id('founder3'), 'by the person who signed up');
  PERFORM pg_temp.is(ev.detail ->> 'address', 'hooked-firm', 'with its address');
  SELECT * INTO ev FROM seen_events WHERE kind = 'firm_approved';
  PERFORM pg_temp.is(ev.firm_id, fid, 'the approval is recorded against the firm');
  PERFORM pg_temp.is(ev.actor, pg_temp.id('platform_admin'), 'by the admin');
  PERFORM pg_temp.is(ev.detail ->> 'note', 'ok', 'with the note');
  PERFORM pg_temp.as_user('founder');
  fid2 := public.sign_up_firm('Hooked Two', 'hooked-two');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_decide_firm(fid2, false, 'no');
  RESET ROLE;
  SELECT * INTO ev FROM seen_events WHERE kind = 'firm_refused';
  PERFORM pg_temp.is(ev.firm_id, fid2, 'a refusal is recorded against its firm');
  PERFORM pg_temp.is(ev.actor, pg_temp.id('platform_admin'), 'by the admin');
  PERFORM pg_temp.is(ev.detail ->> 'note', 'no', 'with the note');
  PERFORM pg_temp.is((SELECT count(*) FROM seen_events), 4::bigint, 'and nothing else was recorded: two sign-ups, an approval and a refusal');
  RAISE NOTICE 'firm_signup: event hook cases passed';
END $$;

-- ---------- what a refusal changes, and what a firm may read ----------
-- Break caught: a refused firm still shows its name to visitors and still lets its founder in at its address; the
-- firm's own members read the admin's note and who decided; or one person signs up firm after firm.
DO $$
DECLARE fid uuid; fid2 uuid;
BEGIN
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(public.firm_public_name('fresh-benefits'), 'Fresh Benefits', 'an approved firm still shows its name');
  PERFORM pg_temp.is(public.firm_public_name('admin-own-firm'), 'Admin Own Firm', 'so does a waiting one');
  -- The firm's members read the firm, not the admin's side of the decision (D-16).
  PERFORM pg_temp.as_user('founder');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT decision_note FROM public.firms'), '42501', 'a member can not read the decision note');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT decided_by FROM public.firms'), '42501', 'nor who decided');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT signed_up_by FROM public.firms'), '42501', 'nor who signed the firm up');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT id, name, address, visibility, approved_at, parent_firm_id, created_at, decision FROM public.firms'), 'rows:2', 'but reads the firm and whether it was decided');
  PERFORM pg_temp.is(public.is_member_of_firm_address('fresh-benefits'), true, 'and is a member of an approved firm');
  -- One firm waiting per person.
  RESET ROLE;
  PERFORM pg_temp.new_user('squatter');
  PERFORM pg_temp.as_user('squatter');
  fid := public.sign_up_firm('Squat One', 'squat-one');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.sign_up_firm('Squat Two', 'squat-two')$q$), 'PT409', 'a person with a firm still waiting can not sign up another, and the refusal has its own code');
  RESET ROLE;
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_decide_firm(fid, false, 'squatting');
  PERFORM pg_temp.as_user('squatter');
  fid2 := public.sign_up_firm('Squat Two', 'squat-two');
  PERFORM pg_temp.is(fid2 IS NOT NULL, true, 'once the first is decided they may sign up another');
  PERFORM pg_temp.is(public.is_member_of_firm_address('squat-one'), false, 'a refused firm lets its founder in no longer');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(public.firm_public_name('squat-one'), NULL::text, 'and shows visitors no name');
  RESET ROLE;
  RAISE NOTICE 'firm_signup: refusal visibility, column reads and one-waiting-firm cases passed';
END $$;
