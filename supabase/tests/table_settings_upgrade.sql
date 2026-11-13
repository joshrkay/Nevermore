-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh table_settings_upgrade
-- The fixes to saved views (20261117120500_table_settings_fixes.sql) on a database that already holds views saved under
-- the first migration's rules (20261117120000_table_settings.sql). Such rows are kept as they are, never renamed or deleted,
-- and the migration does not fail on them:
--   * a name the stricter rule refuses stays, and its saver can still change the view; a rename must meet the rule;
--   * of two names that only the new case folding makes equal, the oldest keeps its place in the unique index and the later
--     one is marked name_clash_kept, left out of the indexes until it is renamed, and can't be shared until then.
-- Every migration loads in filename order; the rows are written between the two.
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
\i supabase/migrations/20261116210000_console_per_firm.sql
\i supabase/migrations/20261116210500_console_per_firm_fixes.sql
\i supabase/migrations/20261116210600_mailbox_kept_for_members.sql
\i supabase/migrations/20261117100000_queue_query.sql
\i supabase/migrations/20261117120000_table_settings.sql
SET client_min_messages = notice;

CREATE TEMP TABLE fx (name text PRIMARY KEY, id uuid NOT NULL);
GRANT SELECT ON fx TO anon, authenticated, service_role;
CREATE FUNCTION pg_temp.id(n text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM fx WHERE name = n $$;

-- ---------- views saved under the first migration's rules ----------
-- The first migration's name indexes folded case by the database's collation. Here they are rebuilt as they behave on a
-- database created with C collation, where only ASCII letters fold, so these rows can be saved whatever this database's
-- collation is.
DROP INDEX public.saved_views_one_name_per_person;
DROP INDEX public.saved_views_one_shared_name;
CREATE UNIQUE INDEX saved_views_one_name_per_person ON public.saved_views (firm_id, user_id, table_name, lower(name COLLATE "C"));
CREATE UNIQUE INDEX saved_views_one_shared_name ON public.saved_views (firm_id, table_name, lower(name COLLATE "C")) WHERE shared;

DO $$
DECLARE acme uuid; u uuid; n text;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Acme Brokers', 'acme-brokers', now()) RETURNING id INTO acme;
  INSERT INTO fx VALUES ('acme', acme);
  FOREACH n IN ARRAY ARRAY['owner', 'owner_2', 'agent'] LOOP
    u := gen_random_uuid();
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, is_anonymous, created_at, updated_at)
    VALUES (u, 'authenticated', 'authenticated', n || '@example.test', now(), false, now(), now());
    INSERT INTO fx VALUES (n, u);
    INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (acme, u, CASE WHEN n = 'agent' THEN 'agent' ELSE 'owner' END);
  END LOOP;
  INSERT INTO public.saved_views (id, firm_id, user_id, table_name, name, created_at, shared, shared_by, shared_at) VALUES
    ('00000000-0000-4000-8000-000000000001', acme, pg_temp.id('agent'), 'submissions', 'Équipe', now() - interval '3 days', false, NULL, NULL),
    ('00000000-0000-4000-8000-000000000002', acme, pg_temp.id('agent'), 'submissions', 'équipe', now() - interval '2 days', false, NULL, NULL),
    ('00000000-0000-4000-8000-000000000003', acme, pg_temp.id('agent'), 'submissions', E'Hot ', now() - interval '2 days', false, NULL, NULL),
    ('00000000-0000-4000-8000-000000000004', acme, pg_temp.id('agent'), 'submissions', E'Ho​t', now() - interval '2 days', false, NULL, NULL),
    ('00000000-0000-4000-8000-000000000005', acme, pg_temp.id('owner'), 'submissions', 'Œuvre', now() - interval '3 days', true, pg_temp.id('owner'), now()),
    ('00000000-0000-4000-8000-000000000006', acme, pg_temp.id('owner_2'), 'submissions', 'œuvre', now() - interval '2 days', true, pg_temp.id('owner_2'), now()),
    ('00000000-0000-4000-8000-000000000007', acme, pg_temp.id('agent'), 'submissions', 'Plain', now() - interval '1 day', false, NULL, NULL);
END $$;

-- ---------- the fixes, over those rows ----------
\i supabase/migrations/20261117120500_table_settings_fixes.sql

CREATE FUNCTION pg_temp.as_user(n text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', false, 'email', n || '@example.test')::text, false);
  SET LOCAL ROLE authenticated;
END $$;

CREATE FUNCTION pg_temp.is(got anyelement, want anyelement, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION 'FAIL: % gave %, expected %', label, got, want; END IF;
END $$;

-- A statement as the caller, rolled back: 'ok:<value>' or the SQLSTATE it raised.
CREATE FUNCTION pg_temp.value_of(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text; s text; m text;
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

-- Break caught: the migration fails on rows the new rules refuse; or it renames or deletes them; or it marks the wrong one of
-- two names the new folding makes equal (the later one is marked, the oldest keeps its place); or a marked view can be shared,
-- or blocks nothing new; or an old name the rule now refuses stops its saver changing the view; or renaming doesn't clear the mark.
DO $$
DECLARE acme uuid := pg_temp.id('acme');
BEGIN
  RESET ROLE;
  PERFORM pg_temp.is((SELECT string_agg(to_json(name)::text || ':' || name_clash_kept, ', ' ORDER BY id) FROM public.saved_views),
    '"Équipe":false, "équipe":true, "Hot ":false, "Ho​t":false, "Œuvre":false, "œuvre":true, "Plain":false',
    'every row is kept with its name; the later of each clashing pair is marked');
  PERFORM pg_temp.is((SELECT indexdef LIKE '%und-x-icu%WHERE (NOT name_clash_kept)' FROM pg_indexes WHERE indexname = 'saved_views_one_name_per_person'), true, 'the person index folds by ICU and leaves marked rows out');

  PERFORM pg_temp.as_user('agent');
  PERFORM pg_temp.is((SELECT count(*) FROM public.list_saved_views(acme, 'submissions') WHERE mine), 5::bigint, 'the agent still lists their five views');
  PERFORM pg_temp.is(pg_temp.value_of($q$SELECT public.change_saved_view('00000000-0000-4000-8000-000000000003', '[{"field":"status","op":"is_empty"}]', NULL, NULL)::text$q$), 'ok:',
    'a view whose old name the rule now refuses can still be changed');
  PERFORM pg_temp.is(pg_temp.value_of($q$SELECT public.change_saved_view('00000000-0000-4000-8000-000000000004', '[]', NULL, '["status"]')::text$q$), 'ok:',
    'so can one with a zero-width character in its old name');
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.rename_saved_view(%L, %L)::text', '00000000-0000-4000-8000-000000000004', E'Ho​t')), '22023',
    'renaming it to a name the rule refuses is refused');
  PERFORM pg_temp.is(pg_temp.value_of($q$SELECT public.rename_saved_view('00000000-0000-4000-8000-000000000003', 'Hot')::text$q$), 'ok:', 'renaming it to a good name works');
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.save_view(%L, ''submissions'', ''ÉQUIPE'', NULL, NULL, NULL)::text', acme)), 'PT409',
    'a new view can''t take a name the oldest of the pair holds');
  PERFORM pg_temp.is(pg_temp.value_of($q$SELECT public.rename_saved_view('00000000-0000-4000-8000-000000000002', 'équipe')::text$q$), 'PT409',
    'renaming the marked view to its own name checks it again, and it is taken');
  PERFORM public.rename_saved_view('00000000-0000-4000-8000-000000000002', 'Team');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT name_clash_kept FROM public.saved_views WHERE id = '00000000-0000-4000-8000-000000000002'), false, 'renaming clears the mark');
  PERFORM pg_temp.as_user('agent');
  PERFORM pg_temp.is(pg_temp.value_of($q$SELECT public.rename_saved_view('00000000-0000-4000-8000-000000000002', 'ÉQUIPE')::text$q$), 'PT409',
    'and the renamed view is in the index again');

  -- The shared pair: the later one is marked; it stays shared until an owner unshares it, and is shared again only once renamed.
  PERFORM pg_temp.as_user('owner');
  PERFORM public.unshare_saved_view('00000000-0000-4000-8000-000000000006');
  PERFORM pg_temp.as_user('owner_2');
  PERFORM pg_temp.is(pg_temp.value_of($q$SELECT public.share_saved_view('00000000-0000-4000-8000-000000000006')::text$q$), 'PT409', 'a marked view can''t be shared');
  PERFORM public.rename_saved_view('00000000-0000-4000-8000-000000000006', 'Works');
  PERFORM pg_temp.is(pg_temp.value_of($q$SELECT public.share_saved_view('00000000-0000-4000-8000-000000000006')::text$q$), 'ok:', 'once renamed it can');
  RESET ROLE;
  RAISE NOTICE 'table_settings_upgrade: views saved under the old rules cases passed';
END $$;

\echo 'table_settings_upgrade: all cases passed'
