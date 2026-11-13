-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh firm_visibility
-- Who may see a record of a firm (stories CRM-S5.1 and CRM-P2.1a; docs/BROKER_CRM_BUILD.md D-5, D-15, D-16, D-18):
-- can_see_firm_record(firm, owner) answers for the caller alone. No table holds an owned record yet (leads,
-- accounts, opportunities and quotes come later, D-24), so the helper is called here with owners the test names.
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
\i supabase/migrations/20261116150000_second_factor_for_password_sign_ins.sql
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

-- Act as a named person until the next as_user() or RESET ROLE; a guest token when guest.
CREATE FUNCTION pg_temp.as_user(n text, guest boolean DEFAULT false, method text DEFAULT NULL, level text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    (jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', guest,
      'email', n || '@example.test')
     || CASE WHEN method IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('amr', jsonb_build_array(jsonb_build_object('method', method, 'timestamp', 1)), 'aal', level) END)::text, false);
  SET LOCAL ROLE authenticated;
END $$;

-- The answer the caller gets for a record of a firm owned by someone ('nobody' is a record with no owner).
CREATE FUNCTION pg_temp.sees(who text, firm text, owner text) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE r boolean;
BEGIN
  PERFORM pg_temp.as_user(who);
  SELECT public.can_see_firm_record(pg_temp.id(firm), CASE WHEN owner = 'nobody' THEN NULL ELSE pg_temp.id(owner) END) INTO r;
  RESET ROLE;
  RETURN r;
END $$;

CREATE FUNCTION pg_temp.is(got anyelement, want anyelement, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION 'FAIL: % gave %, expected %', label, got, want; END IF;
END $$;

-- ---------- two firms: one that sees by level, one that doesn't need to ----------
-- by_level firm "north": owner_n; team "sales" with lead_n; team "sales_east" under sales, with agent_east; agent_sales in
-- sales; agent_support in team "support" (its own root) under lead_support; agent_loose with no team.
-- Firm "south" holds one owner and one agent.
DO $$
DECLARE
  north uuid := gen_random_uuid();
  south uuid := gen_random_uuid();
  sales uuid := gen_random_uuid();
  sales_east uuid := gen_random_uuid();
  support uuid := gen_random_uuid();
  n text;
BEGIN
  FOREACH n IN ARRAY ARRAY['owner_n', 'lead_n', 'agent_east', 'agent_sales', 'lead_support', 'agent_support', 'agent_loose', 'owner_s', 'agent_s', 'platform_admin'] LOOP
    PERFORM pg_temp.new_user(n);
  END LOOP;
  INSERT INTO fx VALUES ('north', north), ('south', south);
  INSERT INTO public.firms (id, name, address, visibility, approved_at)
  VALUES (north, 'North', 'north-brokers', 'by_level', now()), (south, 'South', 'south-brokers', 'by_level', now());
  INSERT INTO public.firm_teams (id, firm_id, name, parent_team_id) VALUES (sales, north, 'Sales', NULL), (support, north, 'Support', NULL);
  INSERT INTO public.firm_teams (id, firm_id, name, parent_team_id) VALUES (sales_east, north, 'Sales East', sales);
  INSERT INTO public.firm_memberships (firm_id, user_id, role, team_id) VALUES
    (north, pg_temp.id('owner_n'), 'owner', NULL),
    (north, pg_temp.id('lead_n'), 'lead', sales),
    (north, pg_temp.id('agent_east'), 'agent', sales_east),
    (north, pg_temp.id('agent_sales'), 'agent', sales),
    (north, pg_temp.id('lead_support'), 'lead', support),
    (north, pg_temp.id('agent_support'), 'agent', support),
    (north, pg_temp.id('agent_loose'), 'agent', NULL),
    (south, pg_temp.id('owner_s'), 'owner', NULL),
    (south, pg_temp.id('agent_s'), 'agent', NULL);
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('platform_admin'), 'admin');
  INSERT INTO fx VALUES ('sales', sales), ('sales_east', sales_east), ('support', support);
END $$;

-- ---------- an agent sees what they own, and nothing a colleague or another firm owns ----------
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.sees('agent_sales', 'north', 'agent_sales'), true, 'an agent seeing their own record');
  PERFORM pg_temp.is(pg_temp.sees('agent_sales', 'north', 'agent_support'), false, 'an agent seeing a colleague''s record outside their level');
  PERFORM pg_temp.is(pg_temp.sees('agent_sales', 'north', 'nobody'), false, 'an agent seeing a record with no owner');
  PERFORM pg_temp.is(pg_temp.sees('agent_s', 'north', 'agent_sales'), false, 'another firm''s agent seeing this firm''s record');
  PERFORM pg_temp.is(pg_temp.sees('agent_sales', 'south', 'agent_s'), false, 'an agent seeing another firm''s record');
  RAISE NOTICE 'firm_visibility: agent cases passed';
END $$;

-- ---------- an owner sees the firm's ----------
DO $$
DECLARE o text;
BEGIN
  FOREACH o IN ARRAY ARRAY['owner_n', 'lead_n', 'agent_east', 'agent_support', 'agent_loose', 'nobody'] LOOP
    PERFORM pg_temp.is(pg_temp.sees('owner_n', 'north', o), true, 'an owner seeing a record owned by ' || o);
  END LOOP;
  -- A record whose owner has left the firm (or never was in it) is still the firm's: its owners see it.
  PERFORM pg_temp.is(pg_temp.sees('owner_n', 'north', 'agent_s'), true, 'an owner seeing a record whose owner isn''t a member');
  -- Owning a firm is owning that firm only.
  PERFORM pg_temp.is(pg_temp.sees('owner_n', 'south', 'agent_s'), false, 'one firm''s owner seeing another firm''s record');
  PERFORM pg_temp.is(pg_temp.sees('owner_s', 'north', 'agent_sales'), false, 'another firm''s owner seeing this firm''s record');
  RAISE NOTICE 'firm_visibility: owner cases passed';
END $$;

-- ---------- a lead sees their team's and everything under it ----------
DO $$
DECLARE
  north constant uuid := pg_temp.id('north');
BEGIN
  PERFORM pg_temp.is(pg_temp.sees('lead_n', 'north', 'lead_n'), true, 'a lead seeing their own record');
  PERFORM pg_temp.is(pg_temp.sees('lead_n', 'north', 'agent_sales'), true, 'a lead seeing a record owned by someone in their team');
  PERFORM pg_temp.is(pg_temp.sees('lead_n', 'north', 'agent_east'), true, 'a lead seeing a record owned by someone in a team under theirs');
  PERFORM pg_temp.is(pg_temp.sees('lead_n', 'north', 'agent_support'), false, 'a lead seeing a record of a team that isn''t theirs');
  PERFORM pg_temp.is(pg_temp.sees('lead_n', 'north', 'lead_support'), false, 'a lead seeing another team lead''s record');
  PERFORM pg_temp.is(pg_temp.sees('lead_n', 'north', 'agent_loose'), false, 'a lead seeing the record of someone with no team');
  PERFORM pg_temp.is(pg_temp.sees('lead_n', 'north', 'owner_n'), false, 'a lead seeing the owner''s record');
  PERFORM pg_temp.is(pg_temp.sees('lead_n', 'north', 'nobody'), false, 'a lead seeing a record with no owner');
  -- Only down the tree: a lead of a team under another sees none of the team above.
  PERFORM pg_temp.is(pg_temp.sees('agent_east', 'north', 'agent_sales'), false, 'an agent seeing the team above theirs');
  -- Only a lead sees down the tree: an agent in a team with another under it sees none of what is under theirs.
  PERFORM pg_temp.is(pg_temp.sees('agent_sales', 'north', 'agent_east'), false, 'an agent seeing the record of a team under theirs');
  -- The same lead in another firm is nothing there.
  PERFORM pg_temp.is(pg_temp.sees('lead_n', 'south', 'agent_s'), false, 'a lead seeing another firm''s record');

  -- The records of a member whose membership in the team has ended are no longer the team's: the lead doesn't see them, an owner does.
  PERFORM pg_temp.new_user('agent_gone');
  INSERT INTO public.firm_memberships (firm_id, user_id, role, team_id, valid_from, valid_until)
  VALUES (north, pg_temp.id('agent_gone'), 'agent', pg_temp.id('sales'), now() - interval '2 days', now() - interval '1 day');
  PERFORM pg_temp.is(pg_temp.sees('lead_n', 'north', 'agent_gone'), false, 'a lead seeing a record of someone who has left their team');
  PERFORM pg_temp.is(pg_temp.sees('owner_n', 'north', 'agent_gone'), true, 'an owner seeing a record of someone who has left');

  -- A lead with no team sees their own only.
  RESET ROLE;
  PERFORM pg_temp.new_user('lead_loose');
  INSERT INTO public.firm_memberships (firm_id, user_id, role, team_id) VALUES (north, pg_temp.id('lead_loose'), 'lead', NULL);
  PERFORM pg_temp.is(pg_temp.sees('lead_loose', 'north', 'agent_loose'), false, 'a lead with no team seeing a colleague with no team');
  PERFORM pg_temp.is(pg_temp.sees('lead_loose', 'north', 'lead_loose'), true, 'a lead with no team seeing their own');

  -- A team moved under another is seen by that team's lead at once: sales_east now sits under support.
  UPDATE public.firm_teams SET parent_team_id = pg_temp.id('support') WHERE id = pg_temp.id('sales_east');
  PERFORM pg_temp.is(pg_temp.sees('lead_support', 'north', 'agent_east'), true, 'the new parent team''s lead seeing a moved team');
  PERFORM pg_temp.is(pg_temp.sees('lead_n', 'north', 'agent_east'), false, 'the old parent team''s lead still seeing a moved team');
  UPDATE public.firm_teams SET parent_team_id = pg_temp.id('sales') WHERE id = pg_temp.id('sales_east');
  RAISE NOTICE 'firm_visibility: lead cases passed';
END $$;

-- ---------- a firm set to "everyone sees everything" ----------
DO $$
DECLARE o text;
BEGIN
  UPDATE public.firms SET visibility = 'everyone' WHERE id = pg_temp.id('north');
  FOREACH o IN ARRAY ARRAY['agent_sales', 'agent_support', 'lead_support', 'owner_n', 'nobody'] LOOP
    PERFORM pg_temp.is(pg_temp.sees('agent_loose', 'north', o), true, 'an agent of an everyone-sees-everything firm seeing a record owned by ' || o);
  END LOOP;
  -- Still only current members of that firm.
  PERFORM pg_temp.is(pg_temp.sees('agent_s', 'north', 'agent_sales'), false, 'another firm''s agent seeing an everyone-sees-everything firm''s record');
  PERFORM pg_temp.is(pg_temp.sees('platform_admin', 'north', 'agent_sales'), false, 'a platform admin seeing an everyone-sees-everything firm''s record');
  -- Switching it back puts the levels back at once.
  UPDATE public.firms SET visibility = 'by_level' WHERE id = pg_temp.id('north');
  PERFORM pg_temp.is(pg_temp.sees('agent_loose', 'north', 'agent_sales'), false, 'an agent seeing a colleague''s record once the firm sees by level again');
  RAISE NOTICE 'firm_visibility: everyone-sees-everything cases passed';
END $$;

-- ---------- only a current member asks, and only as themselves ----------
DO $$
DECLARE
  north constant uuid := pg_temp.id('north');
  r boolean;
  s text;
BEGIN
  -- An owner whose membership has ended, or begins tomorrow, sees nothing; so does a lead.
  PERFORM pg_temp.new_user('owner_gone');
  PERFORM pg_temp.new_user('lead_gone');
  PERFORM pg_temp.new_user('owner_soon');
  INSERT INTO public.firm_memberships (firm_id, user_id, role, team_id, valid_from, valid_until) VALUES
    (north, pg_temp.id('owner_gone'), 'owner', NULL, now() - interval '2 days', now() - interval '1 day'),
    (north, pg_temp.id('lead_gone'), 'lead', pg_temp.id('sales'), now() - interval '2 days', now() - interval '1 day'),
    (north, pg_temp.id('owner_soon'), 'owner', NULL, now() + interval '1 day', NULL);
  PERFORM pg_temp.is(pg_temp.sees('owner_gone', 'north', 'agent_sales'), false, 'a former owner seeing the firm''s record');
  PERFORM pg_temp.is(pg_temp.sees('lead_gone', 'north', 'agent_sales'), false, 'a former lead seeing their old team''s record');
  PERFORM pg_temp.is(pg_temp.sees('owner_soon', 'north', 'agent_sales'), false, 'a future owner seeing the firm''s record');
  PERFORM pg_temp.is(pg_temp.sees('owner_gone', 'north', 'owner_gone'), false, 'a former member seeing a record they once owned');

  -- A member's account presenting a guest token is a guest: it sees nothing.
  PERFORM pg_temp.as_user('owner_n', true);
  r := public.can_see_firm_record(north, pg_temp.id('agent_sales'));
  RESET ROLE;
  PERFORM pg_temp.is(r, false, 'an owner''s account behind a guest token seeing the firm''s record');

  -- A platform admin is not thereby a member of any firm (D-16).
  PERFORM pg_temp.is(pg_temp.sees('platform_admin', 'north', 'agent_sales'), false, 'a platform admin seeing a firm''s record');
  PERFORM pg_temp.is(pg_temp.sees('platform_admin', 'north', 'nobody'), false, 'a platform admin seeing a record with no owner');

  -- A firm that doesn't exist is nobody's.
  PERFORM pg_temp.as_user('owner_n');
  r := public.can_see_firm_record(gen_random_uuid(), pg_temp.id('owner_n'));
  RESET ROLE;
  PERFORM pg_temp.is(r, false, 'a record of a firm that doesn''t exist');

  -- Signed out, the helper can't be called (policies for signed-out callers don't use it).
  SET LOCAL ROLE anon;
  PERFORM set_config('request.jwt.claims', '', false);
  BEGIN
    PERFORM public.can_see_firm_record(north, NULL);
    s := 'allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    s := 'refused';
  END;
  RESET ROLE;
  PERFORM pg_temp.is(s, 'refused', 'a signed-out caller calling the helper');
  RAISE NOTICE 'firm_visibility: membership date and caller cases passed';
END $$;
-- ---------- a password sign-in without a second factor opens no firm's records (D-19; CRM-P1.3b) ----------
DO $$
DECLARE
  north constant uuid := pg_temp.id('north');
  r boolean;
  method text;
  level text;
  who text;
BEGIN
  FOREACH who IN ARRAY ARRAY['owner_n', 'lead_n', 'agent_sales'] LOOP
    FOREACH method IN ARRAY ARRAY['password', 'oauth'] LOOP
      FOREACH level IN ARRAY ARRAY['aal1', 'aal2'] LOOP
        PERFORM pg_temp.as_user(who, false, method, level);
        r := public.can_see_firm_record(north, pg_temp.id(who))
             AND (who <> 'owner_n' OR public.can_see_firm_record(north, pg_temp.id('agent_sales')))
             AND (who <> 'lead_n' OR public.can_see_firm_record(north, pg_temp.id('agent_sales')));
        RESET ROLE;
        -- Only a password sign-in that never completed a second factor is held back.
        PERFORM pg_temp.is(r, NOT (method = 'password' AND level = 'aal1'), format('%s signed in by %s at %s asking for the firm''s records', who, method, level));
      END LOOP;
    END LOOP;
  END LOOP;
  -- The firm's membership questions answer the same way, so every policy built on them does.
  PERFORM pg_temp.as_user('owner_n', false, 'password', 'aal1');
  PERFORM pg_temp.is(public.is_firm_member(north), false, 'is_firm_member for a password sign-in without a second factor');
  PERFORM pg_temp.is(public.firm_role(north), NULL::text, 'firm_role for a password sign-in without a second factor');
  PERFORM pg_temp.as_user('owner_n', false, 'password', 'aal2');
  PERFORM pg_temp.is(public.is_firm_member(north), true, 'is_firm_member for a password sign-in with a second factor');
  RESET ROLE;
  RAISE NOTICE 'firm_visibility: second factor cases passed';
END $$;
\echo 'firm_visibility: all cases passed'
