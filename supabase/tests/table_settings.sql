-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh table_settings
-- Where column choices and saved views are kept (stories CRM-S3.1b and CRM-S3.4b; docs/BROKER_CRM_BUILD.md D-5, D-16, D-18,
-- D-19, D-28, D-29, D-32, D-43; 20261117120000_table_settings.sql). A current member keeps their own columns per table and
-- per saved view, and saves views of a table (a name, filters, a sort, columns); a current owner shares one with the firm or
-- stops sharing one. Nobody else reads, counts, changes or deletes any of it: not the other firm's members, not a person whose
-- membership has ended, not a platform admin who belongs to no firm, not a guest token, not a password sign-in without its
-- second factor. Two firms are used throughout.
-- Every migration loads, in filename order (this story's and its fixes, 20261117120500_table_settings_fixes.sql, among them).
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
\i supabase/migrations/20261117120500_table_settings_fixes.sql
SET client_min_messages = notice;

CREATE TEMP TABLE fx (name text PRIMARY KEY, id uuid NOT NULL);
GRANT SELECT ON fx TO anon, authenticated, service_role;
GRANT INSERT ON fx TO authenticated;
CREATE FUNCTION pg_temp.id(n text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM fx WHERE name = n $$;

CREATE FUNCTION pg_temp.new_user(n text, guest boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', CASE WHEN guest THEN NULL ELSE n || '@example.test' END,
          CASE WHEN NOT guest THEN now() END, guest, now(), now());
  INSERT INTO fx VALUES (n, uid);
  RETURN uid;
END $$;

-- Acts as a signed-in person. `how` 'password' is a password sign-in with no second factor (D-19); 'guest' the account
-- presenting a guest token.
CREATE FUNCTION pg_temp.as_user(n text, how text DEFAULT 'google') RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    (jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', how = 'guest',
      'email', CASE WHEN how = 'guest' THEN NULL ELSE n || '@example.test' END)
     || CASE WHEN how = 'password'
          THEN jsonb_build_object('amr', jsonb_build_array(jsonb_build_object('method', 'password', 'timestamp', 1)), 'aal', 'aal1')
          ELSE '{}'::jsonb END)::text, false);
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

-- Runs stmt and always rolls it back: 'rows:<n>' for the rows it touched (1 for a SELECT of one value), or the SQLSTATE it raised.
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

-- A statement's single value, run as the caller and rolled back: 'ok:<value>' or the SQLSTATE it raised.
-- The message a statement raised, as the caller, rolled back; NULL when it raised nothing.
CREATE FUNCTION pg_temp.message_of(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE m text;
BEGIN
  BEGIN
    EXECUTE stmt;
    RAISE EXCEPTION USING ERRCODE = 'ZZ999', MESSAGE = 'no error';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS m = MESSAGE_TEXT;
    RETURN NULLIF(m, 'no error');
  END;
END $$;

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

-- The views of a table as the caller lists them, by name, in order: 'name[flags]' where the flags are m (mine), s (shared),
-- c (may change), h (may share), u (may unshare).
CREATE FUNCTION pg_temp.listed(firm uuid, tbl text DEFAULT 'submissions') RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(string_agg(l.name || '[' || CASE WHEN l.mine THEN 'm' ELSE '' END || CASE WHEN l.shared THEN 's' ELSE '' END
    || CASE WHEN l.can_change THEN 'c' ELSE '' END || CASE WHEN l.can_share THEN 'h' ELSE '' END || CASE WHEN l.can_unshare THEN 'u' ELSE '' END || ']',
    ', '), '')
  FROM public.list_saved_views(firm, tbl) l
$$;

-- What a view is, read as the superuser.
CREATE FUNCTION pg_temp.view_row(vid uuid) RETURNS public.saved_views LANGUAGE sql AS $$ SELECT * FROM public.saved_views WHERE id = vid $$;

-- ---------- set up: two firms, each with owners, a lead and agents; a platform admin; people with no firm ----------
DO $$
DECLARE acme uuid; zenith uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Acme Brokers', 'acme-brokers', now()) RETURNING id INTO acme;
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Zenith Benefits', 'zenith-benefits', now()) RETURNING id INTO zenith;
  INSERT INTO fx VALUES ('acme', acme), ('zenith', zenith);
  PERFORM pg_temp.new_user('acme_owner'); PERFORM pg_temp.new_user('acme_owner_2'); PERFORM pg_temp.new_user('acme_lead');
  PERFORM pg_temp.new_user('acme_agent'); PERFORM pg_temp.new_user('acme_agent_2'); PERFORM pg_temp.new_user('acme_leaver');
  PERFORM pg_temp.new_user('zenith_owner'); PERFORM pg_temp.new_user('zenith_agent');
  PERFORM pg_temp.new_user('both_firms');
  PERFORM pg_temp.new_user('platform_admin'); PERFORM pg_temp.new_user('nobody');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES
    (acme, pg_temp.id('acme_owner'), 'owner'), (acme, pg_temp.id('acme_owner_2'), 'owner'), (acme, pg_temp.id('acme_lead'), 'lead'),
    (acme, pg_temp.id('acme_agent'), 'agent'), (acme, pg_temp.id('acme_agent_2'), 'agent'), (acme, pg_temp.id('acme_leaver'), 'owner'),
    (acme, pg_temp.id('both_firms'), 'agent'),
    (zenith, pg_temp.id('zenith_owner'), 'owner'), (zenith, pg_temp.id('zenith_agent'), 'agent'), (zenith, pg_temp.id('both_firms'), 'agent');
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('platform_admin'), 'admin'), (pg_temp.id('acme_agent'), 'advisor');
END $$;

-- ---------- a person saves their own view and reads it back ----------
-- Break caught: a saved view is not kept, or is kept for the wrong person, firm or table; its filters, sort or columns change
-- on the way in; the list leaves out the caller's own view, or tells them they may share it when they are no owner.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); vid uuid; r record;
BEGIN
  PERFORM pg_temp.as_user('acme_agent');
  vid := public.save_view(acme, 'submissions', '  Waiting on PEOs  ', '[{"field":"status","op":"any_of","value":["sent"]}]',
    '{"field":"submitted_at","direction":"desc"}', '["company_name","status"]');
  INSERT INTO fx VALUES ('agent_view', vid);
  SELECT * INTO r FROM public.list_saved_views(acme, 'submissions');
  PERFORM pg_temp.is(r.view_id, vid, 'the agent lists the view they saved');
  PERFORM pg_temp.is(r.name, 'Waiting on PEOs', 'with its name, without the spaces around it');
  PERFORM pg_temp.is(r.filters, '[{"field":"status","op":"any_of","value":["sent"]}]'::jsonb, 'its filters');
  PERFORM pg_temp.is(r.sort, '{"field":"submitted_at","direction":"desc"}'::jsonb, 'its sort');
  PERFORM pg_temp.is(r.columns, '["company_name","status"]'::jsonb, 'and its columns, in order');
  PERFORM pg_temp.is(pg_temp.listed(acme), 'Waiting on PEOs[mc]', 'it is theirs and they may change it, but not share it (no owner)');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT (firm_id, user_id, table_name::text, shared) FROM public.saved_views WHERE id = vid)::text,
    (acme, pg_temp.id('acme_agent'), 'submissions', false)::text, 'it is kept as the agent''s, of Acme, of the queue, private');
  -- A view with no filters, sort or columns of its own.
  PERFORM pg_temp.as_user('acme_agent');
  vid := public.save_view(acme, 'submissions', 'Everything', NULL, NULL, NULL);
  RESET ROLE;
  PERFORM pg_temp.is((SELECT (filters, sort, columns)::text FROM public.saved_views WHERE id = vid), ('[]'::jsonb, NULL::jsonb, NULL::jsonb)::text,
    'a view with nothing chosen keeps no filters, no sort and no columns of its own');
  INSERT INTO fx VALUES ('agent_view_2', vid);
  RAISE NOTICE 'table_settings: saving and listing cases passed';
END $$;

-- ---------- within a firm: another person's private view is not there for anyone else ----------
-- Break caught: a colleague, a lead or an owner reads, renames, changes, deletes, shares or reads the columns of another
-- person's private view; or the refusal for it differs from the one for a view that does not exist, so its existence leaks.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); vid uuid := pg_temp.id('agent_view'); who text; ghost uuid := gen_random_uuid(); stmt text;
BEGIN
  FOREACH who IN ARRAY ARRAY['acme_agent_2', 'acme_lead', 'acme_owner'] LOOP
    PERFORM pg_temp.as_user(who);
    PERFORM pg_temp.is(pg_temp.listed(acme), '', who || ' lists none of the agent''s private views');
    FOREACH stmt IN ARRAY ARRAY[
      'SELECT public.rename_saved_view(%L, ''Mine now'')::text', 'SELECT public.change_saved_view(%L, ''[]'', NULL, NULL)::text',
      'SELECT public.delete_saved_view(%L)::text', 'SELECT public.share_saved_view(%L)::text', 'SELECT public.unshare_saved_view(%L)::text',
      format('SELECT count(*)::text FROM public.my_table_columns(%L, ''submissions'', %%L)', acme),
      format('SELECT public.set_my_table_columns(%L, ''submissions'', %%L, ''["company_name"]'')::text', acme)] LOOP
      PERFORM pg_temp.is(pg_temp.value_of(format(stmt, vid)), 'PT404', who || ': ' || stmt || ' on another person''s private view');
      PERFORM pg_temp.is(pg_temp.value_of(format(stmt, ghost)), 'PT404', who || ': ' || stmt || ' on a view that does not exist (the same answer)');
    END LOOP;
  END LOOP;
  RESET ROLE;
  PERFORM pg_temp.is((SELECT (name, shared)::text FROM public.saved_views WHERE id = vid), ('Waiting on PEOs', false)::text, 'and the view is as it was');
  RAISE NOTICE 'table_settings: private view cases passed';
END $$;

-- ---------- sharing: only a current owner, and then everyone in the firm reads it and nobody else changes it ----------
-- Break caught: an agent or a lead shares a view; an owner cannot; an owner shares a view someone else saved; a shared view is
-- not read by the rest of the firm, or is renamed, changed, deleted or unshared by a colleague who is no owner; another owner
-- cannot unshare it, or can delete it; unsharing loses the view rather than giving it back to its saver.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); mine uuid := pg_temp.id('agent_view'); ov uuid; who text;
BEGIN
  PERFORM pg_temp.as_user('acme_agent');
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.share_saved_view(%L)::text', mine)), '42501', 'an agent can''t share their own view');
  PERFORM pg_temp.as_user('acme_lead');
  ov := public.save_view(acme, 'submissions', 'Lead view', NULL, NULL, NULL);
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.share_saved_view(%L)::text', ov)), '42501', 'a lead can''t share their own view');
  PERFORM pg_temp.as_user('acme_owner');
  ov := public.save_view(acme, 'submissions', 'Firm queue', '[{"field":"status","op":"is_empty"}]', NULL, '["company_name"]');
  INSERT INTO fx VALUES ('owner_view', ov);
  PERFORM pg_temp.is(pg_temp.listed(acme), 'Firm queue[mch]', 'an owner may share their own private view');
  PERFORM public.share_saved_view(ov);
  PERFORM pg_temp.is(pg_temp.listed(acme), 'Firm queue[mscu]', 'once shared it is still theirs, and an owner may unshare it');
  PERFORM public.share_saved_view(ov);
  PERFORM pg_temp.is(pg_temp.listed(acme), 'Firm queue[mscu]', 'sharing it again changes nothing');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT shared_by FROM public.saved_views WHERE id = ov), pg_temp.id('acme_owner'), 'who shared it is kept');

  PERFORM pg_temp.as_user('acme_agent_2');
  PERFORM pg_temp.is(pg_temp.listed(acme), 'Firm queue[s]', 'another agent reads the shared view, as not theirs and not theirs to change');
  PERFORM pg_temp.is((SELECT columns FROM public.my_table_columns(acme, 'submissions', ov)), '["company_name"]'::jsonb, 'and sees its columns');
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.rename_saved_view(%L, ''Taken'')::text', ov)), '42501', 'but can''t rename it');
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.change_saved_view(%L, ''[]'', NULL, NULL)::text', ov)), '42501', 'or change it');
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.delete_saved_view(%L)::text', ov)), '42501', 'or delete it');
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.unshare_saved_view(%L)::text', ov)), '42501', 'or unshare it');
  PERFORM pg_temp.as_user('acme_lead');
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.unshare_saved_view(%L)::text', ov)), '42501', 'nor can a lead unshare it');
  PERFORM pg_temp.is(pg_temp.listed(acme), 'Firm queue[s], Lead view[mc]', 'the lead lists their own view and the shared one');

  -- The other owner: may unshare it, may not delete or change it, may not share a private view someone else saved.
  PERFORM pg_temp.as_user('acme_owner_2');
  PERFORM pg_temp.is(pg_temp.listed(acme), 'Firm queue[su]', 'another owner reads it and may unshare it, not change it');
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.delete_saved_view(%L)::text', ov)), '42501', 'another owner can''t delete a view someone else saved');
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.rename_saved_view(%L, ''Mine'')::text', ov)), '42501', 'or rename it');
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.share_saved_view(%L)::text', mine)), 'PT404', 'and can''t share an agent''s private view (it isn''t there for them)');
  PERFORM public.unshare_saved_view(ov);
  PERFORM pg_temp.is(pg_temp.listed(acme), '', 'once unshared, the other owner no longer reads it');
  PERFORM pg_temp.as_user('acme_agent_2');
  PERFORM pg_temp.is(pg_temp.listed(acme), '', 'nor does the agent');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(pg_temp.listed(acme), 'Firm queue[mch]', 'it is back to being its saver''s private view');
  PERFORM public.share_saved_view(ov);
  RESET ROLE;
  RAISE NOTICE 'table_settings: sharing cases passed';
END $$;

-- ---------- the saver changes, renames and deletes their own ----------
-- Break caught: the saver can't change or rename their own view, or renaming a shared view to a name the firm already shares
-- is let through; deleting a view leaves people's own column choices on it behind.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); ov uuid := pg_temp.id('owner_view'); tmp uuid;
BEGIN
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.change_saved_view(ov, '[{"field":"status","op":"any_of","value":["sent","declined"]}]', '{"field":"company_name","direction":"asc"}', '["company_name","status"]');
  PERFORM public.rename_saved_view(ov, 'Firm queue ');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT (name, filters, sort, columns)::text FROM public.saved_views WHERE id = ov),
    ('Firm queue', '[{"field":"status","op":"any_of","value":["sent","declined"]}]'::jsonb, '{"field":"company_name","direction":"asc"}'::jsonb, '["company_name","status"]'::jsonb)::text,
    'the saver changes the filters, sort and columns of their shared view, and renames it');
  -- A view to delete, with someone's own choice of columns on it.
  PERFORM pg_temp.as_user('acme_owner');
  tmp := public.save_view(acme, 'submissions', 'Short lived', NULL, NULL, NULL);
  PERFORM public.share_saved_view(tmp);
  PERFORM pg_temp.as_user('acme_agent_2');
  PERFORM public.set_my_table_columns(acme, 'submissions', tmp, '["status"]');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.delete_saved_view(tmp);
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.saved_views WHERE id = tmp), 0::bigint, 'the saver deletes their own shared view');
  PERFORM pg_temp.is((SELECT count(*) FROM public.table_preferences WHERE saved_view_id = tmp), 0::bigint, 'and the column choices on it go with it');
  RAISE NOTICE 'table_settings: change, rename and delete cases passed';
END $$;

-- ---------- the other firm: reads, counts, changes and deletes nothing, by the table or by any function ----------
-- Break caught: a member of another firm (owner or agent) lists, counts, reads the columns of, renames, changes, deletes,
-- shares or unshares a view of Acme, saves into Acme or keeps columns for Acme, or reaches the tables directly; or a call by
-- id answers differently for Acme's view than for one that does not exist; or a view of Acme is reached through Zenith's id.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); zenith uuid := pg_temp.id('zenith'); ov uuid := pg_temp.id('owner_view'); vid uuid := pg_temp.id('agent_view');
  who text; stmt text; ghost uuid := gen_random_uuid();
BEGIN
  -- Acme's agent keeps a column choice for the queue, for the probes below to find.
  PERFORM pg_temp.as_user('acme_agent');
  PERFORM public.set_my_table_columns(acme, 'submissions', NULL, '["company_name"]');
  FOREACH who IN ARRAY ARRAY['zenith_owner', 'zenith_agent'] LOOP
    PERFORM pg_temp.as_user(who);
    PERFORM pg_temp.is(pg_temp.value_of(format('SELECT count(*)::text FROM public.list_saved_views(%L, ''submissions'')', acme)), '42501', who || ' lists Acme''s views');
    PERFORM pg_temp.is(pg_temp.value_of(format('SELECT count(*)::text FROM public.my_table_columns(%L, ''submissions'', NULL)', acme)), '42501', who || ' reads columns in Acme');
    PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.set_my_table_columns(%L, ''submissions'', NULL, ''["x"]'')::text', acme)), '42501', who || ' keeps columns in Acme');
    PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.save_view(%L, ''submissions'', ''Theirs'', NULL, NULL, NULL)::text', acme)), '42501', who || ' saves a view into Acme');
    FOREACH stmt IN ARRAY ARRAY[
      'SELECT public.rename_saved_view(%L, ''Mine now'')::text', 'SELECT public.change_saved_view(%L, ''[]'', NULL, NULL)::text',
      'SELECT public.delete_saved_view(%L)::text', 'SELECT public.share_saved_view(%L)::text', 'SELECT public.unshare_saved_view(%L)::text',
      format('SELECT count(*)::text FROM public.my_table_columns(%L, ''submissions'', %%L)', zenith),
      format('SELECT public.set_my_table_columns(%L, ''submissions'', %%L, ''["company_name"]'')::text', zenith)] LOOP
      PERFORM pg_temp.is(pg_temp.value_of(format(stmt, ov)), 'PT404', who || ': ' || stmt || ' on Acme''s shared view');
      PERFORM pg_temp.is(pg_temp.value_of(format(stmt, vid)), 'PT404', who || ': ' || stmt || ' on Acme''s private view');
      PERFORM pg_temp.is(pg_temp.value_of(format(stmt, ghost)), 'PT404', who || ': ' || stmt || ' on a view that does not exist');
    END LOOP;
    PERFORM pg_temp.is(pg_temp.listed(zenith), '', who || ' lists none of Acme''s views in their own firm');
  END LOOP;
  -- By the tables: nobody signed in reaches either, Acme's own members included.
  FOREACH who IN ARRAY ARRAY['zenith_owner', 'acme_owner', 'acme_agent'] LOOP
    PERFORM pg_temp.as_user(who);
    FOREACH stmt IN ARRAY ARRAY['SELECT count(*) FROM public.saved_views', 'SELECT count(*) FROM public.table_preferences',
      'UPDATE public.saved_views SET name = ''x''', 'DELETE FROM public.saved_views', 'UPDATE public.table_preferences SET columns = ''["x"]''',
      'DELETE FROM public.table_preferences',
      format('INSERT INTO public.saved_views (firm_id, user_id, table_name, name) VALUES (%L, %L, ''submissions'', ''Direct'')', acme, pg_temp.id(who)),
      format('INSERT INTO public.table_preferences (firm_id, user_id, table_name, columns) VALUES (%L, %L, ''submissions'', ''["x"]'')', acme, pg_temp.id(who))] LOOP
      PERFORM pg_temp.is(pg_temp.attempt(stmt), '42501', who || ' by the table: ' || stmt);
    END LOOP;
  END LOOP;
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt('SELECT count(*) FROM public.saved_views'), '42501', 'signed out, by the table');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.saved_views WHERE firm_id = zenith), 0::bigint, 'nothing was saved into Zenith from Acme''s views');
  PERFORM pg_temp.is((SELECT count(*) FROM public.table_preferences WHERE firm_id = zenith), 0::bigint, 'nor any column choice');
  RAISE NOTICE 'table_settings: other firm cases passed';
END $$;

-- ---------- nobody who is not a current member: a platform admin, a guest token, a password sign-in without its second factor,
-- a person with no firm, signed out ----------
-- Break caught: a platform role (D-16), a guest token, a sign-in short of its second factor (D-19) or no sign-in at all opens a
-- firm's views or columns.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); ov uuid := pg_temp.id('owner_view'); who text; how text; stmt text; pair text[];
BEGIN
  FOREACH pair SLICE 1 IN ARRAY ARRAY[['platform_admin', 'google'], ['nobody', 'google'], ['acme_agent', 'guest'], ['acme_owner', 'password'], ['', 'anon']] LOOP
    who := pair[1];
    how := pair[2];
    IF how = 'anon' THEN PERFORM pg_temp.as_anon(); ELSE PERFORM pg_temp.as_user(who, how); END IF;
    FOREACH stmt IN ARRAY ARRAY[
      format('SELECT count(*)::text FROM public.list_saved_views(%L, ''submissions'')', acme),
      format('SELECT count(*)::text FROM public.my_table_columns(%L, ''submissions'', NULL)', acme),
      format('SELECT public.set_my_table_columns(%L, ''submissions'', NULL, ''["x"]'')::text', acme),
      format('SELECT public.save_view(%L, ''submissions'', ''Theirs'', NULL, NULL, NULL)::text', acme)] LOOP
      PERFORM pg_temp.is(pg_temp.value_of(stmt), '42501', who || ' (' || how || '): ' || stmt);
    END LOOP;
    FOREACH stmt IN ARRAY ARRAY['SELECT public.rename_saved_view(%L, ''x'')::text', 'SELECT public.unshare_saved_view(%L)::text',
      'SELECT public.delete_saved_view(%L)::text'] LOOP
      PERFORM pg_temp.is(pg_temp.value_of(format(stmt, ov)), CASE how WHEN 'anon' THEN '42501' ELSE 'PT404' END, who || ' (' || how || '): ' || stmt || ' on Acme''s shared view');
    END LOOP;
  END LOOP;
  RESET ROLE;
  RAISE NOTICE 'table_settings: non-member cases passed';
END $$;

-- ---------- a person who leaves loses everything at once ----------
-- Break caught: once a membership ends, its holder still lists, reads, changes, renames, deletes or unshares their own views,
-- reads or keeps their columns, or reads the firm's shared views, until something cleans up after them. What they shared
-- stays the firm's, and an owner can still unshare it.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); mine uuid; shared_one uuid; ov uuid := pg_temp.id('owner_view'); stmt text;
BEGIN
  PERFORM pg_temp.as_user('acme_leaver');
  mine := public.save_view(acme, 'submissions', 'Leaver private', NULL, NULL, NULL);
  shared_one := public.save_view(acme, 'submissions', 'Leaver shared', NULL, NULL, NULL);
  PERFORM public.share_saved_view(shared_one);
  PERFORM public.set_my_table_columns(acme, 'submissions', NULL, '["status"]');
  PERFORM public.set_my_table_columns(acme, 'submissions', ov, '["status"]');
  PERFORM pg_temp.is(pg_temp.listed(acme), 'Firm queue[su], Leaver private[mch], Leaver shared[mscu]', 'the leaver, while a member, reads their own and the shared views');
  INSERT INTO fx VALUES ('leaver_shared', shared_one);
  -- The membership ends now: no job, no trigger, no cleanup runs.
  RESET ROLE;
  UPDATE public.firm_memberships SET valid_until = now() WHERE user_id = pg_temp.id('acme_leaver') AND firm_id = acme;
  PERFORM pg_temp.as_user('acme_leaver');
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT count(*)::text FROM public.list_saved_views(%L, ''submissions'')', acme)), '42501', 'the leaver lists nothing');
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT count(*)::text FROM public.my_table_columns(%L, ''submissions'', NULL)', acme)), '42501', 'reads none of their columns');
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.set_my_table_columns(%L, ''submissions'', NULL, NULL)::text', acme)), '42501', 'and can''t clear them');
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.save_view(%L, ''submissions'', ''Late'', NULL, NULL, NULL)::text', acme)), '42501', 'saves nothing');
  FOREACH stmt IN ARRAY ARRAY['SELECT public.rename_saved_view(%L, ''x'')::text', 'SELECT public.change_saved_view(%L, ''[]'', NULL, NULL)::text',
    'SELECT public.delete_saved_view(%L)::text', 'SELECT public.unshare_saved_view(%L)::text', 'SELECT public.share_saved_view(%L)::text'] LOOP
    PERFORM pg_temp.is(pg_temp.value_of(format(stmt, mine)), 'PT404', 'the leaver: ' || stmt || ' on their own former private view');
    PERFORM pg_temp.is(pg_temp.value_of(format(stmt, shared_one)), 'PT404', 'the leaver: ' || stmt || ' on the view they shared');
    PERFORM pg_temp.is(pg_temp.value_of(format(stmt, ov)), 'PT404', 'the leaver: ' || stmt || ' on another''s shared view');
  END LOOP;
  -- The firm still reads what they shared; their private view is nobody's to read.
  PERFORM pg_temp.as_user('acme_agent_2');
  PERFORM pg_temp.is(pg_temp.listed(acme), 'Firm queue[s], Leaver shared[s]', 'the firm keeps the shared view of a person who left, and nobody reads their private one');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.unshare_saved_view(shared_one);
  PERFORM pg_temp.is(pg_temp.listed(acme), 'Firm queue[mscu]', 'an owner can unshare it, and then nobody reads it');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.saved_views WHERE user_id = pg_temp.id('acme_leaver')), 2::bigint, 'the rows are still there: access ended without a cleanup');
  RAISE NOTICE 'table_settings: leaver cases passed';
END $$;

-- ---------- a person in two firms keeps each firm's apart ----------
-- Break caught: a member of two firms sees, in one, the views or columns they keep in the other; one firm's name blocks the
-- same name in the other; a choice of columns for one firm overwrites the other's.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); zenith uuid := pg_temp.id('zenith'); a uuid; z uuid;
BEGIN
  PERFORM pg_temp.as_user('both_firms');
  a := public.save_view(acme, 'submissions', 'My view', NULL, NULL, '["company_name"]');
  z := public.save_view(zenith, 'submissions', 'My view', NULL, NULL, '["status"]');
  PERFORM public.set_my_table_columns(acme, 'submissions', NULL, '["a_column"]');
  PERFORM public.set_my_table_columns(zenith, 'submissions', NULL, '["z_column"]');
  PERFORM pg_temp.is((SELECT string_agg(view_id::text, ',') FROM public.list_saved_views(acme, 'submissions') WHERE mine), a::text, 'in Acme, only the view kept in Acme');
  PERFORM pg_temp.is((SELECT string_agg(view_id::text, ',') FROM public.list_saved_views(zenith, 'submissions') WHERE mine), z::text, 'in Zenith, only the one kept in Zenith');
  PERFORM pg_temp.is((SELECT columns FROM public.my_table_columns(acme, 'submissions')), '["a_column"]'::jsonb, 'Acme''s columns');
  PERFORM pg_temp.is((SELECT columns FROM public.my_table_columns(zenith, 'submissions')), '["z_column"]'::jsonb, 'Zenith''s columns');
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT count(*)::text FROM public.my_table_columns(%L, ''submissions'', %L)', zenith, a)), 'PT404', 'Acme''s view is not reached through Zenith');
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.set_my_table_columns(%L, ''submissions'', %L, ''["x"]'')::text', zenith, a)), 'PT404', 'nor are columns kept on it through Zenith');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.table_preferences WHERE user_id = pg_temp.id('both_firms')), 2::bigint, 'two rows: one per firm');
  RAISE NOTICE 'table_settings: two firm member cases passed';
END $$;

-- ---------- which columns a person sees: their choice for a view, the view's, their choice for the table, the defaults ----------
-- Break caught: a person's own choice on a shared view changes it for everyone; the view's own columns are not used; with no
-- view the person's table choice is not used; clearing a choice does not fall back to the next one.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); ov uuid := pg_temp.id('owner_view'); bare uuid := pg_temp.id('agent_view_2'); r record;
BEGIN
  PERFORM pg_temp.as_user('acme_agent');
  -- Their choice for the table was kept above: ["company_name"].
  SELECT * INTO r FROM public.my_table_columns(acme, 'submissions');
  PERFORM pg_temp.is((r.columns, r.source)::text, ('["company_name"]'::jsonb, 'mine')::text, 'no view: the person''s choice for the table');
  SELECT * INTO r FROM public.my_table_columns(acme, 'submissions', ov);
  PERFORM pg_temp.is((r.columns, r.source)::text, ('["company_name", "status"]'::jsonb, 'view')::text, 'a shared view: the view''s own columns');
  PERFORM public.set_my_table_columns(acme, 'submissions', ov, '["status","company_name"]');
  SELECT * INTO r FROM public.my_table_columns(acme, 'submissions', ov);
  PERFORM pg_temp.is((r.columns, r.source)::text, ('["status", "company_name"]'::jsonb, 'mine_for_view')::text, 'their own choice on the view wins for them');
  PERFORM public.set_my_table_columns(acme, 'submissions', ov, '["status"]');
  SELECT * INTO r FROM public.my_table_columns(acme, 'submissions', ov);
  PERFORM pg_temp.is(r.columns, '["status"]'::jsonb, 'keeping it again replaces it (one row per person per view)');
  SELECT * INTO r FROM public.my_table_columns(acme, 'submissions', bare);
  PERFORM pg_temp.is((r.columns, r.source)::text, ('["company_name"]'::jsonb, 'mine')::text, 'a view with no columns of its own: the person''s choice for the table');
  PERFORM pg_temp.as_user('acme_agent_2');
  SELECT * INTO r FROM public.my_table_columns(acme, 'submissions', ov);
  PERFORM pg_temp.is((r.columns, r.source)::text, ('["company_name", "status"]'::jsonb, 'view')::text, 'a colleague still sees the view''s own columns');
  SELECT * INTO r FROM public.my_table_columns(acme, 'submissions');
  PERFORM pg_temp.is((r.columns, r.source)::text, (NULL::jsonb, 'default')::text, 'someone with no choice gets the table''s defaults');
  PERFORM pg_temp.as_user('acme_agent');
  PERFORM public.set_my_table_columns(acme, 'submissions', ov, NULL);
  SELECT * INTO r FROM public.my_table_columns(acme, 'submissions', ov);
  PERFORM pg_temp.is(r.source, 'view', 'forgetting the choice on the view falls back to the view''s own');
  PERFORM public.set_my_table_columns(acme, 'submissions', NULL, NULL);
  SELECT * INTO r FROM public.my_table_columns(acme, 'submissions');
  PERFORM pg_temp.is(r.source, 'default', 'forgetting the choice for the table falls back to the defaults');
  PERFORM public.set_my_table_columns(acme, 'submissions', NULL, '["company_name"]');
  RESET ROLE;
  RAISE NOTICE 'table_settings: column precedence cases passed';
END $$;

-- ---------- one of each, by constraint (D-29) ----------
-- Break caught: any of the four rules is only a check inside a function, so a second row inserted straight into the table is
-- kept: two views of one name for a person on a table (in other capitals too); two shared views of one name in a firm on a
-- table; two column choices for a person on a table; two for a person on a view. And the rules reach too far: the same name
-- for another person, another table's name, another firm's, or a private view beside a shared one of that name is refused.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); zenith uuid := pg_temp.id('zenith'); ag uuid := pg_temp.id('acme_agent'); ag2 uuid := pg_temp.id('acme_agent_2');
  ow uuid := pg_temp.id('acme_owner'); ow2 uuid := pg_temp.id('acme_owner_2'); ov uuid := pg_temp.id('owner_view');
BEGIN
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.saved_views (firm_id, user_id, table_name, name) VALUES (%L, %L, 'submissions', 'WAITING ON PEOs')$q$, acme, ag)),
    '23505', 'the table refuses a second view of the same name for a person on a table, in other capitals');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.saved_views (firm_id, user_id, table_name, name) VALUES (%L, %L, 'submissions', 'Waiting on PEOs')$q$, acme, ag2)),
    'rows:1', 'another person may use the same name');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.saved_views (firm_id, user_id, table_name, name) VALUES (%L, %L, 'submissions', 'Waiting on PEOs')$q$, zenith, ag)),
    'rows:1', 'the same person may use it in another firm');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.saved_views (firm_id, user_id, table_name, name, shared, shared_at) VALUES (%L, %L, 'submissions', 'firm QUEUE', true, now())$q$, acme, ow2)),
    '23505', 'the table refuses a second shared view of the same name in a firm on a table');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.saved_views (firm_id, user_id, table_name, name) VALUES (%L, %L, 'submissions', 'Firm queue')$q$, acme, ow2)),
    'rows:1', 'a private view may share a name with a shared one');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.saved_views (firm_id, user_id, table_name, name, shared, shared_at) VALUES (%L, %L, 'submissions', 'Firm queue', true, now())$q$, zenith, ow2)),
    'rows:1', 'another firm may share the same name');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.table_preferences (firm_id, user_id, table_name, columns) VALUES (%L, %L, 'submissions', '["x"]')$q$, acme, ag)),
    '23505', 'the table refuses a second column choice for a person on a table');
  INSERT INTO public.table_preferences (firm_id, user_id, table_name, saved_view_id, columns) VALUES (acme, ag2, 'submissions', ov, '["x"]');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.table_preferences (firm_id, user_id, table_name, saved_view_id, columns) VALUES (%L, %L, 'submissions', %L, '["y"]')$q$, acme, ag2, ov)),
    '23505', 'the table refuses a second column choice for a person on a view');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.table_preferences (firm_id, user_id, table_name, saved_view_id, columns) VALUES (%L, %L, 'submissions', %L, '["y"]')$q$, zenith, ag, ov)),
    '23503', 'a column choice can''t name a view of another firm');
  DELETE FROM public.table_preferences WHERE user_id = ag2 AND saved_view_id = ov;
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.saved_views (firm_id, user_id, table_name, name, shared) VALUES (%L, %L, 'submissions', 'Half shared', true)$q$, acme, ow)),
    '23514', 'a shared view says when it was shared');

  -- Through the functions, the same rules read as plain messages.
  PERFORM pg_temp.as_user('acme_agent');
  PERFORM pg_temp.is(pg_temp.value_of(format($q$SELECT public.save_view(%L, 'submissions', 'waiting on peos', NULL, NULL, NULL)::text$q$, acme)), 'PT409', 'saving a second view of a name the person has');
  PERFORM pg_temp.is(pg_temp.value_of(format($q$SELECT public.rename_saved_view(%L, 'Everything')::text$q$, pg_temp.id('agent_view'))), 'PT409', 'renaming onto a name the person has');
  PERFORM pg_temp.as_user('acme_owner_2');
  PERFORM public.save_view(acme, 'submissions', 'firm queue', NULL, NULL, NULL);
  PERFORM pg_temp.is(pg_temp.value_of(format($q$SELECT public.share_saved_view(v.view_id)::text FROM public.list_saved_views(%L, 'submissions') v WHERE v.mine$q$, acme)),
    'PT409', 'sharing a view under a name the firm already shares');
  RESET ROLE;
  RAISE NOTICE 'table_settings: constraint cases passed';
END $$;

-- ---------- what can be kept: names, filters, sort, columns and tables ----------
-- Break caught: an empty or blank name, a name over 60 characters or with a control character, filters that are not a list
-- of {field, op, value} or are too many or too large, a sort that is not {field, direction asc or desc}, columns that are not
-- a list of 1 to 60 different names, or a table not on the list, is kept: through a function, or written straight into the
-- table (the constraints are the rule; the functions' checks only word the refusal).
DO $$
DECLARE acme uuid := pg_temp.id('acme'); ag uuid := pg_temp.id('acme_agent'); v text; vid uuid := pg_temp.id('agent_view');
  fine_filters text := (SELECT jsonb_agg(jsonb_build_object('field', 'f' || n, 'op', 'is', 'value', 'v')) FROM generate_series(1, 20) n)::text;
  many_filters text := (SELECT jsonb_agg(jsonb_build_object('field', 'f' || n, 'op', 'is', 'value', 'v')) FROM generate_series(1, 21) n)::text;
  fine_columns text := (SELECT jsonb_agg('c' || n) FROM generate_series(1, 60) n)::text;
  many_columns text := (SELECT jsonb_agg('c' || n) FROM generate_series(1, 61) n)::text;
BEGIN
  -- Names.
  FOREACH v IN ARRAY ARRAY['', '   ', repeat('n', 61), E'Tab\there', E'Line\nbreak', NULL] LOOP
    PERFORM pg_temp.as_user('acme_agent');
    PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.save_view(%L, ''submissions'', %L, NULL, NULL, NULL)::text', acme, v)), '22023', format('saving a view named %L', v));
    PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.rename_saved_view(%L, %L)::text', vid, v)), '22023', format('renaming a view to %L', v));
    RESET ROLE;
    PERFORM pg_temp.is(pg_temp.attempt(format('INSERT INTO public.saved_views (firm_id, user_id, table_name, name) VALUES (%L, %L, ''submissions'', %L)', acme, ag, v)),
      CASE WHEN v IS NULL THEN '23502' ELSE '23514' END, format('the table keeping a view named %L', v));
  END LOOP;
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.attempt(format('INSERT INTO public.saved_views (firm_id, user_id, table_name, name) VALUES (%L, %L, ''submissions'', '' Spaced'')', acme, ag)),
    '23514', 'the table keeping a name with a space around it');
  PERFORM pg_temp.is(pg_temp.attempt(format('INSERT INTO public.saved_views (firm_id, user_id, table_name, name) VALUES (%L, %L, ''submissions'', %L)', acme, ag, repeat('n', 60))),
    'rows:1', 'a name of 60 characters is kept');

  -- Filters.
  FOREACH v IN ARRAY ARRAY['{}', '"status"', '[1]', '["status"]', '[{"field":"status"}]', '[{"op":"is","value":"x"}]', '[{"field":1,"op":"is"}]',
    '[{"field":"status","op":2}]', '[{"field":"","op":"is"}]', '[{"field":"status","op":""}]', '[{"field":"status","op":"is","value":"x","extra":true}]',
    format('[{"field":"%s","op":"is"}]', repeat('f', 65)), format('[{"field":"status","op":"%s"}]', repeat('o', 33)), many_filters,
    (SELECT jsonb_agg(jsonb_build_object('field', 'f' || n, 'op', 'any_of', 'value', (SELECT jsonb_agg(repeat('x', 200)) FROM generate_series(1, 100)))) FROM generate_series(1, 4) n)::text] LOOP
    PERFORM pg_temp.as_user('acme_agent');
    PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.save_view(%L, ''submissions'', ''Bad'', %L, NULL, NULL)::text', acme, v)), '22023', 'saving filters ' || left(v, 80));
    PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.change_saved_view(%L, %L, NULL, NULL)::text', vid, v)), '22023', 'changing to filters ' || left(v, 80));
    RESET ROLE;
    PERFORM pg_temp.is(pg_temp.attempt(format('INSERT INTO public.saved_views (firm_id, user_id, table_name, name, filters) VALUES (%L, %L, ''submissions'', ''Bad'', %L)', acme, ag, v)),
      '23514', 'the table keeping filters ' || left(v, 80));
  END LOOP;
  PERFORM pg_temp.is(pg_temp.attempt(format('INSERT INTO public.saved_views (firm_id, user_id, table_name, name, filters) VALUES (%L, %L, ''submissions'', ''Null filters'', NULL)', acme, ag)),
    '23502', 'the table keeping no filters at all (an empty list is none)');
  FOREACH v IN ARRAY ARRAY['[]', fine_filters, '[{"field":"status","op":"is_empty"}]', '[{"field":"n","op":"between","value":[1,2]}]',
    format('[{"field":"f","op":"any_of","value":%s}]', (SELECT jsonb_agg(repeat('x', 200)) FROM generate_series(1, 100)))] LOOP
    PERFORM pg_temp.as_user('acme_agent');
    PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.change_saved_view(%L, %L, NULL, NULL)::text', vid, v)), 'ok:', 'keeping filters ' || left(v, 80));
  END LOOP;

  -- Sort.
  FOREACH v IN ARRAY ARRAY['"status"', '[]', '{}', '{"field":"status"}', '{"direction":"asc"}', '{"field":"status","direction":"up"}', '{"field":"","direction":"asc"}',
    '{"field":"status","direction":"asc","then":"x"}', '{"field":1,"direction":"asc"}', format('{"field":"%s","direction":"asc"}', repeat('f', 65))] LOOP
    PERFORM pg_temp.as_user('acme_agent');
    PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.save_view(%L, ''submissions'', ''Bad'', NULL, %L, NULL)::text', acme, v)), '22023', 'saving sort ' || v);
    RESET ROLE;
    PERFORM pg_temp.is(pg_temp.attempt(format('INSERT INTO public.saved_views (firm_id, user_id, table_name, name, sort) VALUES (%L, %L, ''submissions'', ''Bad'', %L)', acme, ag, v)),
      '23514', 'the table keeping sort ' || left(v, 80));
  END LOOP;

  -- Columns, on a view and as a person's choice.
  FOREACH v IN ARRAY ARRAY['[]', '{}', '"status"', '[1]', '["status","status"]', '[""]', format('["%s"]', repeat('c', 65)), many_columns] LOOP
    PERFORM pg_temp.as_user('acme_agent');
    PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.save_view(%L, ''submissions'', ''Bad'', NULL, NULL, %L)::text', acme, v)), '22023', 'saving columns ' || left(v, 80));
    PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.set_my_table_columns(%L, ''submissions'', NULL, %L)::text', acme, v)), '22023', 'keeping columns ' || left(v, 80));
    RESET ROLE;
    PERFORM pg_temp.is(pg_temp.attempt(format('INSERT INTO public.saved_views (firm_id, user_id, table_name, name, columns) VALUES (%L, %L, ''submissions'', ''Bad'', %L)', acme, ag, v)),
      '23514', 'the table keeping a view''s columns ' || left(v, 80));
    PERFORM pg_temp.is(pg_temp.attempt(format('INSERT INTO public.table_preferences (firm_id, user_id, table_name, columns) VALUES (%L, %L, ''submissions'', %L)', acme, pg_temp.id('acme_lead'), v)),
      '23514', 'the table keeping a person''s columns ' || left(v, 80));
  END LOOP;
  PERFORM pg_temp.as_user('acme_agent');
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.set_my_table_columns(%L, ''submissions'', NULL, %L)::text', acme, fine_columns)), 'ok:', '60 columns are kept');

  -- Tables: only the ones on the list.
  FOREACH v IN ARRAY ARRAY['accounts', 'Submissions', 'submissions ', '', NULL] LOOP
    PERFORM pg_temp.as_user('acme_agent');
    PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.save_view(%L, %L, ''Other'', NULL, NULL, NULL)::text', acme, v)), '22023', format('saving a view of table %L', v));
    PERFORM pg_temp.is(pg_temp.value_of(format('SELECT count(*)::text FROM public.list_saved_views(%L, %L)', acme, v)), '22023', format('listing the views of table %L', v));
    PERFORM pg_temp.is(pg_temp.value_of(format('SELECT count(*)::text FROM public.my_table_columns(%L, %L)', acme, v)), '22023', format('reading columns of table %L', v));
    PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.set_my_table_columns(%L, %L, NULL, ''["x"]'')::text', acme, v)), '22023', format('keeping columns of table %L', v));
    RESET ROLE;
    PERFORM pg_temp.is(pg_temp.attempt(format('INSERT INTO public.saved_views (firm_id, user_id, table_name, name) VALUES (%L, %L, %L, ''Other'')', acme, ag, v)),
      CASE WHEN v IS NULL THEN '23502' ELSE '23514' END, format('the table keeping a view of table %L', v));
    PERFORM pg_temp.is(pg_temp.attempt(format('INSERT INTO public.table_preferences (firm_id, user_id, table_name, columns) VALUES (%L, %L, %L, ''["x"]'')', acme, pg_temp.id('acme_lead'), v)),
      CASE WHEN v IS NULL THEN '23502' ELSE '23514' END, format('the table keeping columns of table %L', v));
  END LOOP;
  -- A view's own table: a person's choice on a view is of that view's table.
  PERFORM pg_temp.as_user('acme_agent');
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.set_my_table_columns(%L, ''submissions'', %L, ''["x"]'')::text', acme, vid)), 'ok:', 'columns kept on a view of that table');
  RESET ROLE;
  RAISE NOTICE 'table_settings: shape and limit cases passed';
END $$;

-- ---------- review: a private view may share its name with someone else's shared one ----------
-- Break caught: the list hides one of two views of the same name (the person's own private one and a view someone else
-- shared), or gives them the same id, so the page could not tell their tabs or their counts apart. Views are told apart by
-- view_id everywhere; refusing the name when a view is shared would tell the owner a private name exists.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); ov uuid := pg_temp.id('owner_view'); own_one uuid; n bigint;
BEGIN
  PERFORM pg_temp.as_user('acme_agent_2');
  own_one := public.save_view(acme, 'submissions', 'Firm queue', NULL, NULL, NULL);
  SELECT count(DISTINCT l.view_id) INTO n FROM public.list_saved_views(acme, 'submissions') l WHERE l.name = 'Firm queue';
  PERFORM pg_temp.is(n, 2::bigint, 'the person lists both "Firm queue" views, each with its own id');
  PERFORM pg_temp.is((SELECT string_agg(CASE WHEN l.mine THEN 'mine' ELSE 'shared' END, ',' ORDER BY l.mine) FROM public.list_saved_views(acme, 'submissions') l WHERE l.name = 'Firm queue'),
    'shared,mine', 'one is the firm''s shared view and one their own');
  PERFORM pg_temp.is((SELECT bool_and(l.view_id IN (ov, own_one)) FROM public.list_saved_views(acme, 'submissions') l WHERE l.name = 'Firm queue'), true, 'by their own ids');
  PERFORM public.delete_saved_view(own_one);
  RESET ROLE;
  RAISE NOTICE 'table_settings: same-name cases passed';
END $$;

-- ---------- review: filters up to 64 KB, and a size refusal that says so ----------
-- Break caught: a filter the queue's query accepts (an "any of" with 100 values of 200 characters, about 20 KB) can't be
-- kept; or filters over 64 KB are kept; or the refusal for size talks about how many filters there are.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); vid uuid := pg_temp.id('agent_view'); one text; huge text;
BEGIN
  one := format('[{"field":"f","op":"any_of","value":%s}]', (SELECT jsonb_agg(repeat('x', 200)) FROM generate_series(1, 100)));
  huge := (SELECT jsonb_agg(jsonb_build_object('field', 'f' || n, 'op', 'any_of', 'value', (SELECT jsonb_agg(repeat('x', 200)) FROM generate_series(1, 100)))) FROM generate_series(1, 4) n)::text;
  PERFORM pg_temp.as_user('acme_agent');
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.change_saved_view(%L, %L, NULL, NULL)::text', vid, one)), 'ok:', 'a 100-value filter of 200-character values is kept');
  PERFORM pg_temp.is(octet_length(huge) > 65536, true, '(the large list is over 64 KB)');
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.change_saved_view(%L, %L, NULL, NULL)::text', vid, huge)), '22023', 'filters over 64 KB are refused');
  PERFORM pg_temp.is(pg_temp.message_of(format('SELECT public.change_saved_view(%L, %L, NULL, NULL)::text', vid, huge)), 'A view''s filters can hold at most 64 KB',
    'and the refusal says it is the size');
  PERFORM pg_temp.is(pg_temp.message_of(format('SELECT public.save_view(%L, ''submissions'', ''Big'', %L, NULL, NULL)::text', acme, huge)), 'A view''s filters can hold at most 64 KB',
    'saving says the same');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.attempt(format('INSERT INTO public.saved_views (firm_id, user_id, table_name, name, filters) VALUES (%L, %L, ''submissions'', ''Big'', %L)', acme, pg_temp.id('acme_agent'), huge)),
    '23514', 'the table refuses filters over 64 KB');
  RAISE NOTICE 'table_settings: filter size cases passed';
END $$;

-- ---------- review: a shared view is the firm's while it is shared ----------
-- Break caught: an owner who shared a view and is then made an agent can still change, rename or delete it (or the list
-- says they may); or they lose their own private views; or, once an owner unshares it, its saver can't change it again.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); sv uuid; pv uuid; stmt text;
BEGIN
  PERFORM pg_temp.new_user('acme_demoted');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (acme, pg_temp.id('acme_demoted'), 'owner');
  PERFORM pg_temp.as_user('acme_demoted');
  sv := public.save_view(acme, 'submissions', 'Demoted shared', NULL, NULL, NULL);
  pv := public.save_view(acme, 'submissions', 'Demoted private', NULL, NULL, NULL);
  PERFORM public.share_saved_view(sv);
  PERFORM pg_temp.is((SELECT string_agg(l.name || ':' || l.can_change, ',' ORDER BY l.name) FROM public.list_saved_views(acme, 'submissions') l WHERE l.mine),
    'Demoted private:true,Demoted shared:true', 'while an owner, they may change both');
  -- Made an agent: the owner membership ends and an agent one begins.
  RESET ROLE;
  UPDATE public.firm_memberships SET valid_until = now() WHERE user_id = pg_temp.id('acme_demoted') AND firm_id = acme AND valid_until IS NULL;
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (acme, pg_temp.id('acme_demoted'), 'agent');
  PERFORM pg_temp.as_user('acme_demoted');
  PERFORM pg_temp.is((SELECT string_agg(l.name || ':' || l.can_change, ',' ORDER BY l.name) FROM public.list_saved_views(acme, 'submissions') l WHERE l.mine),
    'Demoted private:true,Demoted shared:false', 'as an agent, the list says the shared one is no longer theirs to change');
  FOREACH stmt IN ARRAY ARRAY['SELECT public.rename_saved_view(%L, ''Taken back'')::text', 'SELECT public.change_saved_view(%L, ''[]'', NULL, ''["x"]'')::text',
    'SELECT public.delete_saved_view(%L)::text'] LOOP
    PERFORM pg_temp.is(pg_temp.value_of(format(stmt, sv)), '42501', 'the demoted saver: ' || stmt || ' on the view they shared');
    PERFORM pg_temp.is(pg_temp.value_of(format(stmt, pv)), 'ok:', 'the demoted saver: ' || stmt || ' on their private view');
  END LOOP;
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.unshare_saved_view(sv);
  PERFORM pg_temp.as_user('acme_demoted');
  PERFORM pg_temp.is((SELECT l.can_change FROM public.list_saved_views(acme, 'submissions') l WHERE l.view_id = sv), true, 'unshared, it is its saver''s to change again');
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.rename_saved_view(%L, ''Mine again'')::text', sv)), 'ok:', 'and they rename it');
  RESET ROLE;
  RAISE NOTICE 'table_settings: demoted owner cases passed';
END $$;

-- ---------- review: names: no whitespace of any kind around them, no invisible characters, case folded the same anywhere ----------
-- Break caught: a name with a non-breaking or other Unicode space around it, or a zero-width or other format character in it,
-- is kept (two names that look the same would be two names); or "Équipe" and "équipe" are two names because case is folded by
-- the database's collation (under C only ASCII letters fold). The rule is the same on a C and a UTF-8 collated database.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); ag uuid := pg_temp.id('acme_agent'); v text; e uuid;
BEGIN
  FOREACH v IN ARRAY ARRAY[E' Hot', E'Hot ', E'　Hot', E'Hot ', E'Hot ', E'
Hot', E'Ho​t', E'Hot‍', E'﻿Hot',
    E'Ho‏t', E'Ho‮t', E'Ho⁠t', E'Ho­t', E'Ho⁦t'] LOOP
    PERFORM pg_temp.as_user('acme_agent');
    PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.save_view(%L, ''submissions'', %L, NULL, NULL, NULL)::text', acme, v)), '22023',
      format('saving a view named %s', to_json(v)));
    RESET ROLE;
    PERFORM pg_temp.is(pg_temp.attempt(format('INSERT INTO public.saved_views (firm_id, user_id, table_name, name) VALUES (%L, %L, ''submissions'', %L)', acme, ag, v)),
      '23514', format('the table keeping a view named %s', to_json(v)));
  END LOOP;
  PERFORM pg_temp.as_user('acme_agent');
  e := public.save_view(acme, 'submissions', 'Équipe', NULL, NULL, NULL);
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.save_view(%L, ''submissions'', ''équipe'', NULL, NULL, NULL)::text', acme)), 'PT409',
    format('"équipe" beside "Équipe" (database collation %s)', (SELECT datcollate FROM pg_database WHERE datname = current_database())));
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.save_view(%L, ''submissions'', ''Café Grande'', NULL, NULL, NULL)::text', acme)) LIKE 'ok:%', true, 'an accented name is kept');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.attempt(format('INSERT INTO public.saved_views (firm_id, user_id, table_name, name) VALUES (%L, %L, ''submissions'', ''ÉQUIPE'')', acme, ag)),
    '23505', 'the table refuses "ÉQUIPE" beside "Équipe" for one person');
  INSERT INTO public.saved_views (firm_id, user_id, table_name, name, shared, shared_at) VALUES (acme, pg_temp.id('acme_owner'), 'submissions', 'Œuvre', true, now());
  PERFORM pg_temp.is(pg_temp.attempt(format('INSERT INTO public.saved_views (firm_id, user_id, table_name, name, shared, shared_at) VALUES (%L, %L, ''submissions'', ''œuvre'', true, now())', acme, pg_temp.id('acme_owner_2'))),
    '23505', 'the table refuses a shared "œuvre" beside a shared "Œuvre" in one firm');
  DELETE FROM public.saved_views WHERE name = 'Œuvre';
  DELETE FROM public.saved_views WHERE id = e OR (user_id = ag AND name = 'Café Grande');
  RAISE NOTICE 'table_settings: name character and case cases passed';
END $$;

-- ---------- review: forgetting a column choice on a view the person can no longer read ----------
-- Break caught: once a shared view is unshared, a person's own column choice on it can't be cleared (it stays behind); or
-- forgetting tells apart a view that exists from one that never did; or it reaches a row of another firm or person.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); zenith uuid := pg_temp.id('zenith'); tv uuid;
BEGIN
  PERFORM pg_temp.as_user('acme_owner');
  tv := public.save_view(acme, 'submissions', 'Briefly shared', NULL, NULL, NULL);
  PERFORM public.share_saved_view(tv);
  PERFORM pg_temp.as_user('acme_agent_2');
  PERFORM public.set_my_table_columns(acme, 'submissions', tv, '["status"]');
  PERFORM pg_temp.as_user('both_firms');
  PERFORM public.set_my_table_columns(acme, 'submissions', tv, '["status"]');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.unshare_saved_view(tv);
  PERFORM pg_temp.as_user('acme_agent_2');
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.set_my_table_columns(%L, ''submissions'', %L, ''["x"]'')::text', acme, tv)), 'PT404', 'a choice can''t be kept on it now');
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.set_my_table_columns(%L, ''submissions'', %L, NULL)::text', acme, tv)), 'ok:', 'but it can be forgotten');
  PERFORM public.set_my_table_columns(acme, 'submissions', tv, NULL);
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.set_my_table_columns(%L, ''submissions'', %L, NULL)::text', acme, gen_random_uuid())), 'ok:',
    'with the same answer as for a view that never existed');
  -- The member of two firms names Zenith: their Acme row stays.
  PERFORM pg_temp.as_user('both_firms');
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.set_my_table_columns(%L, ''submissions'', %L, NULL)::text', zenith, tv)), 'ok:', 'forgetting through another firm says nothing');
  PERFORM public.set_my_table_columns(zenith, 'submissions', tv, NULL);
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.set_my_table_columns(%L, ''submissions'', %L, NULL)::text', acme, tv)), '42501', 'another firm''s member is no member here');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.table_preferences WHERE saved_view_id = tv AND user_id = pg_temp.id('acme_agent_2')), 0::bigint, 'the agent''s row is gone');
  PERFORM pg_temp.is((SELECT count(*) FROM public.table_preferences WHERE saved_view_id = tv AND user_id = pg_temp.id('both_firms')), 1::bigint,
    'the other person''s row, named through the wrong firm, is untouched');
  DELETE FROM public.saved_views WHERE id = tv;
  RAISE NOTICE 'table_settings: forgetting cases passed';
END $$;

-- ---------- at most thirty views per person per table ----------
-- Break caught: a person keeps more than thirty views of one table in a firm; or the ceiling counts other tables', other
-- firms' or other people's views; or deleting one does not make room.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); zenith uuid := pg_temp.id('zenith'); n integer; have integer; last_one uuid;
BEGIN
  PERFORM pg_temp.as_user('both_firms');
  SELECT count(*) INTO have FROM public.list_saved_views(acme, 'submissions') WHERE mine;
  FOR n IN have + 1 .. 30 LOOP
    last_one := public.save_view(acme, 'submissions', 'View ' || n, NULL, NULL, NULL);
  END LOOP;
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.save_view(%L, ''submissions'', ''View 31'', NULL, NULL, NULL)::text', acme)), 'PT422', 'a thirty-first view of the queue in Acme');
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.save_view(%L, ''submissions'', ''View 31'', NULL, NULL, NULL)::text', zenith)) LIKE 'ok:%', true,
    'the same person''s views in another firm are counted apart');
  PERFORM pg_temp.as_user('acme_agent_2');
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.save_view(%L, ''submissions'', ''View 31'', NULL, NULL, NULL)::text', acme)) LIKE 'ok:%', true,
    'another person''s are counted apart');
  PERFORM pg_temp.as_user('both_firms');
  PERFORM public.delete_saved_view(last_one);
  PERFORM pg_temp.is(pg_temp.value_of(format('SELECT public.save_view(%L, ''submissions'', ''View 31'', NULL, NULL, NULL)::text', acme)) LIKE 'ok:%', true,
    'deleting one makes room');
  RESET ROLE;
  RAISE NOTICE 'table_settings: ceiling cases passed';
END $$;

-- ---------- two saves at the same moment (D-32) ----------
-- The ceiling counts rows, so it can't be a constraint: saving takes a lock on the person's views of that table before it
-- counts. A person with twenty-nine views saves two at once from two connections (dblink): the first holds its transaction
-- open until the second is seen waiting on it; once the first commits, the second must count thirty and be refused. Without
-- the lock both would count twenty-nine and the person would keep thirty-one.
CREATE SCHEMA race;
CREATE EXTENSION dblink SCHEMA race;
DO $$
DECLARE acme uuid := pg_temp.id('acme'); n integer;
BEGIN
  PERFORM pg_temp.new_user('racer');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (acme, pg_temp.id('racer'), 'agent');
  PERFORM pg_temp.as_user('racer');
  FOR n IN 1..29 LOOP
    PERFORM public.save_view(acme, 'submissions', 'Race ' || n, NULL, NULL, NULL);
  END LOOP;
  RESET ROLE;
END $$;

DO $$
DECLARE
  acme uuid := pg_temp.id('acme');
  dsn text := format('dbname=%s user=%s port=%s host=%s', current_database(), session_user, current_setting('port'),
    split_part(current_setting('unix_socket_directories'), ',', 1));
  as_racer text := format($q$SELECT set_config('request.jwt.claims', %L, true)$q$,
    jsonb_build_object('sub', pg_temp.id('racer'), 'role', 'authenticated', 'is_anonymous', false, 'email', 'racer@example.test')::text);
  second_pid integer;
  tries integer := 0;
  s text;
  kept bigint;
BEGIN
  PERFORM race.dblink_connect('race_first', dsn);
  PERFORM race.dblink_connect('race_second', dsn);
  PERFORM race.dblink_exec('race_second', 'SET lock_timeout = ''20s''');
  SELECT pid INTO second_pid FROM race.dblink('race_second', 'SELECT pg_backend_pid()') AS t(pid integer);
  PERFORM race.dblink_exec('race_first', 'BEGIN');
  PERFORM race.dblink_exec('race_first', 'SET LOCAL ROLE authenticated');
  PERFORM * FROM race.dblink('race_first', as_racer) AS t(c text);
  PERFORM * FROM race.dblink('race_first', format($q$SELECT public.save_view(%L, 'submissions', 'Race 30', NULL, NULL, NULL)::text$q$, acme)) AS t(r text);
  PERFORM race.dblink_exec('race_second', 'BEGIN');
  PERFORM race.dblink_exec('race_second', 'SET LOCAL ROLE authenticated');
  PERFORM * FROM race.dblink('race_second', as_racer) AS t(c text);
  PERFORM race.dblink_send_query('race_second', format($q$SELECT public.save_view(%L, 'submissions', 'Race 31', NULL, NULL, NULL)::text$q$, acme));
  WHILE cardinality(pg_blocking_pids(second_pid)) = 0 LOOP
    tries := tries + 1;
    IF tries > 400 THEN RAISE EXCEPTION 'FAIL: the second save never waited for the first'; END IF;
    PERFORM pg_sleep(0.05);
  END LOOP;
  PERFORM race.dblink_exec('race_first', 'COMMIT');
  BEGIN
    PERFORM * FROM race.dblink_get_result('race_second') AS t(r text);
    RAISE EXCEPTION 'FAIL: the thirty-first view was saved too';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE;
    IF s <> 'PT422' THEN RAISE EXCEPTION 'FAIL: the second save gave %, expected PT422', s; END IF;
  END;
  PERFORM race.dblink_disconnect('race_first');
  BEGIN
    PERFORM race.dblink_exec('race_second', 'ROLLBACK');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  PERFORM race.dblink_disconnect('race_second');
  SELECT count(*) INTO kept FROM public.saved_views WHERE user_id = pg_temp.id('racer');
  PERFORM pg_temp.is(kept, 30::bigint, 'views kept after two were saved at once');
  RAISE NOTICE 'table_settings: two-session ceiling race passed';
END $$;

-- ---------- review: another firm's caller never waits on a view's lock ----------
-- Break caught: a change takes the view's row lock before asking whether the caller may read it, so a member of another
-- firm who knows an id waits while someone in the firm holds the view (learning that it exists) and then holds a lock on
-- another firm's row. One connection holds the view in an open change; another firm's owner, with a short lock timeout,
-- must get PT404 at once. A member of the firm, who may read it, does wait: the control that proves the lock was held.
DO $$
DECLARE
  ov uuid := pg_temp.id('owner_view');
  dsn text := format('dbname=%s user=%s port=%s host=%s', current_database(), session_user, current_setting('port'),
    split_part(current_setting('unix_socket_directories'), ',', 1));
  claims text;
  who text;
  s text;
BEGIN
  PERFORM race.dblink_connect('hold', dsn);
  PERFORM race.dblink_exec('hold', 'BEGIN');
  PERFORM race.dblink_exec('hold', 'SET LOCAL ROLE authenticated');
  PERFORM * FROM race.dblink('hold', format($q$SELECT set_config('request.jwt.claims', %L, true)$q$,
    jsonb_build_object('sub', pg_temp.id('acme_owner'), 'role', 'authenticated', 'is_anonymous', false, 'email', 'acme_owner@example.test')::text)) AS t(c text);
  PERFORM * FROM race.dblink('hold', format($q$SELECT public.rename_saved_view(%L, 'Firm queue')::text$q$, ov)) AS t(r text);
  FOREACH who IN ARRAY ARRAY['zenith_owner', 'acme_owner_2'] LOOP
    PERFORM race.dblink_connect('probe', dsn);
    PERFORM race.dblink_exec('probe', 'BEGIN');
    PERFORM race.dblink_exec('probe', 'SET LOCAL lock_timeout = ''1s''');
    PERFORM race.dblink_exec('probe', 'SET LOCAL ROLE authenticated');
    claims := jsonb_build_object('sub', pg_temp.id(who), 'role', 'authenticated', 'is_anonymous', false, 'email', who || '@example.test')::text;
    PERFORM * FROM race.dblink('probe', format($q$SELECT set_config('request.jwt.claims', %L, true)$q$, claims)) AS t(c text);
    BEGIN
      PERFORM * FROM race.dblink('probe', format($q$SELECT public.rename_saved_view(%L, 'Probe')::text$q$, ov)) AS t(r text);
      s := 'ok';
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE;
    END;
    PERFORM race.dblink_disconnect('probe');
    PERFORM pg_temp.is(s, CASE who WHEN 'zenith_owner' THEN 'PT404' ELSE '55P03' END,
      CASE who WHEN 'zenith_owner' THEN 'another firm''s owner is answered at once, without waiting on the lock'
               ELSE 'a member of the firm waits on it (the lock was held)' END);
  END LOOP;
  PERFORM race.dblink_exec('hold', 'ROLLBACK');
  PERFORM race.dblink_disconnect('hold');
  RAISE NOTICE 'table_settings: lock-before-check cases passed';
END $$;

\echo 'table_settings: all cases passed'
