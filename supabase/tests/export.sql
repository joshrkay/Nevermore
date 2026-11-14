-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh export
-- Export in the database (story CRM-S3.8b; docs/BROKER_CRM_BUILD.md D-48, D-128, D-200 to D-214; 20261118170000_export.sql). An export
-- holds only records the person may see and never an intake's answers, a census or a FEIN; it is recorded (who, when, which table, how
-- many rows) in the same step that returns the rows; a large or repeated export tells the firm's owners; a whole-table export needs a
-- recent sign-in. Two firms throughout. Every migration is loaded, in filename order (D-105), this story's last.
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
\i supabase/migrations/20261118090500_leave_a_firm_fixes.sql
\i supabase/migrations/20261118100000_join_by_organisation.sql
\i supabase/migrations/20261118100500_join_by_organisation_fixes.sql
\i supabase/migrations/20261118110000_close_a_firm.sql
\i supabase/migrations/20261118110500_close_a_firm_fixes.sql
\i supabase/migrations/20261118111000_close_a_firm_races.sql
\i supabase/migrations/20261118120000_help_from_nevermore.sql
\i supabase/migrations/20261118120500_help_from_nevermore_fixes.sql
\i supabase/migrations/20261118130000_record_history.sql
\i supabase/migrations/20261118130500_record_history_fixes.sql
\i supabase/migrations/20261118140000_menu_counts.sql
\i supabase/migrations/20261118140500_menu_counts_fixes.sql
\i supabase/migrations/20261118150000_queue_sort_collation.sql
\i supabase/migrations/20261118160000_record_version.sql
\i supabase/migrations/20261118160500_record_version_fixes.sql
\i supabase/migrations/20261118170000_export.sql
SET client_min_messages = notice;

CREATE TEMP TABLE fx (name text PRIMARY KEY, id uuid NOT NULL);
GRANT SELECT ON fx TO anon, authenticated, service_role;
CREATE FUNCTION pg_temp.id(n text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM fx WHERE name = n $$;

CREATE FUNCTION pg_temp.new_user(n text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', n || '@example.test', now(), false, now(), now());
  INSERT INTO fx VALUES (n, uid);
  RETURN uid;
END $$;

-- The claims of a person's sign-in. `signed` is how long ago it was made (the token's amr timestamp); NULL gives a token with no amr.
-- `how` 'password' is a password sign-in that owes its second factor (aal1).
CREATE FUNCTION pg_temp.claims(n text, signed interval DEFAULT interval '1 hour', how text DEFAULT 'oauth') RETURNS text LANGUAGE sql AS $$
  SELECT (jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', false, 'email', n || '@example.test')
     || CASE WHEN signed IS NULL THEN '{}'::jsonb
             ELSE jsonb_build_object('amr', jsonb_build_array(jsonb_build_object('method', how, 'timestamp', floor(extract(epoch FROM now() - signed))::bigint)),
                                     'aal', 'aal1') END)::text
$$;

-- Signs in as a person, at a firm's address when one is named (D-40).
CREATE FUNCTION pg_temp.as_user(n text, addr text DEFAULT NULL, signed interval DEFAULT interval '1 hour', how text DEFAULT 'oauth') RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', pg_temp.claims(n, signed, how), false);
  PERFORM set_config('request.headers', CASE WHEN addr IS NULL THEN '' ELSE jsonb_build_object('x-firm-address', addr)::text END, false);
  SET LOCAL ROLE authenticated;
END $$;

CREATE FUNCTION pg_temp.as_anon() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', false);
  PERFORM set_config('request.headers', '', false);
  SET LOCAL ROLE anon;
END $$;

CREATE FUNCTION pg_temp.is(got anyelement, want anyelement, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION 'FAIL: % gave %, expected %', label, got, want; END IF;
END $$;

-- The SQLSTATE and message a statement raised, or 'ok' when it did not. Nothing is rolled back.
CREATE FUNCTION pg_temp.refusal(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE s text; m text;
BEGIN
  BEGIN
    EXECUTE stmt;
    RETURN 'ok';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT;
    RETURN s || ': ' || m;
  END;
END $$;

-- The SQLSTATE alone, or 'ok'.
CREATE FUNCTION pg_temp.code(stmt text) RETURNS text LANGUAGE sql AS $$ SELECT split_part(pg_temp.refusal(stmt), ':', 1) $$;

-- An export as the caller, as text: 'n|row;row', each row's values joined by ',' (no value is '~').
CREATE FUNCTION pg_temp.export(fid uuid, t text, cols jsonb, filters jsonb DEFAULT '[]', keys jsonb DEFAULT NULL) RETURNS text LANGUAGE sql AS $$
  SELECT (r ->> 'row_count') || '|' || COALESCE((
    SELECT string_agg((SELECT string_agg(COALESCE(v #>> '{}', '~'), ',' ORDER BY i) FROM jsonb_array_elements(x) WITH ORDINALITY AS y(v, i)), ';' ORDER BY j)
    FROM jsonb_array_elements(r -> 'rows') WITH ORDINALITY AS z(x, j)), '')
  FROM (SELECT public.export_table(fid, t, cols, filters, keys) AS r) q
$$;

-- The exports the record holds of a firm, read as the superuser: 'who:table:rows', oldest first.
CREATE FUNCTION pg_temp.exports(fid uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE(string_agg(COALESCE(f.name, a.actor_id::text, 'system') || ':' || a.record_type || '/' || a.record_id || ':' || a.row_count, ' ' ORDER BY a.at, a.id), '')
  FROM public.firm_activity a LEFT JOIN fx f ON f.id = a.actor_id WHERE a.firm_id = fid AND a.kind = 'export_made'
$$;

CREATE FUNCTION pg_temp.alerts(fid uuid) RETURNS bigint LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*) FROM public.outbox_events WHERE kind = 'export_alert' AND firm_id = fid
$$;

-- Each case starts with no exports and no alerts: the record is append-only, so this runs as the superuser with its guard set aside.
CREATE FUNCTION pg_temp.clear() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  SET LOCAL session_replication_role = replica;
  DELETE FROM public.firm_activity WHERE kind = 'export_made';
  DELETE FROM public.outbox_events WHERE kind = 'export_alert';
  SET LOCAL session_replication_role = origin;
END $$;

-- ---------- set up: two firms with partners; owners and an agent; a former and a suspended member; a platform admin; nobody ----------
DO $$
DECLARE acme uuid; zenith uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Acme Brokers', 'acme-brokers', now()) RETURNING id INTO acme;
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Zenith Benefits', 'zenith-benefits', now()) RETURNING id INTO zenith;
  INSERT INTO fx VALUES ('acme', acme), ('zenith', zenith);
  PERFORM pg_temp.new_user('acme_owner'); PERFORM pg_temp.new_user('acme_owner2'); PERFORM pg_temp.new_user('acme_agent');
  PERFORM pg_temp.new_user('acme_removed'); PERFORM pg_temp.new_user('acme_suspended'); PERFORM pg_temp.new_user('acme_admin_member');
  PERFORM pg_temp.new_user('zenith_owner'); PERFORM pg_temp.new_user('platform_admin'); PERFORM pg_temp.new_user('nobody');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES
    (acme, pg_temp.id('acme_owner'), 'owner'), (acme, pg_temp.id('acme_owner2'), 'owner'), (acme, pg_temp.id('acme_agent'), 'agent'),
    (acme, pg_temp.id('acme_suspended'), 'agent'), (acme, pg_temp.id('acme_admin_member'), 'agent'), (zenith, pg_temp.id('zenith_owner'), 'owner');
  INSERT INTO public.firm_memberships (firm_id, user_id, role, valid_from, valid_until)
  VALUES (acme, pg_temp.id('acme_removed'), 'agent', now() - interval '3 days', now() - interval '1 day');
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('platform_admin'), 'admin'), (pg_temp.id('acme_admin_member'), 'admin');
  INSERT INTO public.referral_partners (firm_id, code, name, kind) VALUES
    (acme, 'acme-cfo', 'Acme CFO', 'accounting'), (acme, 'bay-law', 'Bay Law', 'law_firm'), (acme, 'zz-event', 'Autumn Summit', 'event'),
    (zenith, 'zen-cpa', 'Zenith CPA', 'accounting');
END $$;
-- The suspended member is suspended the way the product does it.
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM public.suspend_member(pg_temp.id('acme'), pg_temp.id('acme_suspended'));
  RESET ROLE;
END $$;

-- ---------- a support session exports nothing, and is refused before anything is read or recorded ----------
-- Break caught: the export does not call refuse_support_session, calls it with NULL, or calls it after checking the table or columns
-- (a support session would then learn which tables and columns exist, or be refused for the wrong reason); a refused export is recorded.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); sid uuid;
BEGIN
  PERFORM pg_temp.as_user('platform_admin', 'acme-brokers');
  SELECT s.session_id INTO sid FROM public.start_support_session(acme, 'helping with partners') s;
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.export_table(%L, 'referral_partners', '["name"]', '[{"field":"name","op":"contains","value":"a"}]')$q$, acme)),
    'PT423: Nevermore support can look, not change', 'a support session at the firm''s address can''t export what it can read');
  PERFORM pg_temp.is(pg_temp.code(format($q$SELECT public.export_table(%L, 'x', '{}', '{}', '{}', 'x')$q$, acme)), 'PT423',
    'and is refused before the table, the columns or the filters are looked at');
  PERFORM pg_temp.is(pg_temp.code(format($q$SELECT public.export_table(%L, 'firm_activity', '["who"]')$q$, acme)), 'PT423', 'nor the firm''s record, which it reads as an owner');
  PERFORM public.end_support_session(sid);
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.exports(acme), '', 'nothing was recorded as exported');
  RAISE NOTICE 'export: support session passed';
END $$;

-- ---------- who may export: a current member at the firm's address, nobody else ----------
-- Break caught: the membership check is dropped or asks the wrong firm; the address does not narrow it (D-40); a former, suspended or
-- second-factor-owing person is let in; a refusal is recorded.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); stmt text; who text;
BEGIN
  stmt := format($q$SELECT public.export_table(%L, 'referral_partners', '["name"]', '[{"field":"kind","op":"any_of","value":["accounting"]}]')$q$, acme);
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.code(stmt), '42501', 'a signed-out caller can''t export');
  FOREACH who IN ARRAY ARRAY['nobody', 'zenith_owner', 'acme_removed', 'acme_suspended', 'platform_admin'] LOOP
    PERFORM pg_temp.as_user(who, 'acme-brokers');
    PERFORM pg_temp.is(pg_temp.refusal(stmt), '42501: Only a member of this firm can export its records', who || ' at the firm''s address is refused');
  END LOOP;
  -- The address narrows (D-40): a member asking at another firm's address is no member here. (The bare domain names no firm, so it
  -- narrows nothing, as for every member read.)
  PERFORM pg_temp.as_user('acme_agent', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.code(stmt), '42501', 'a member at another firm''s address is refused: the address narrows (D-40)');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers', interval '1 hour', 'password');
  PERFORM pg_temp.is(pg_temp.code(stmt), '42501', 'and with a password sign-in that owes its second factor (D-19)');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.code($q$SELECT public.export_table(NULL, 'referral_partners', '["name"]')$q$), '42501', 'and for no firm at all');
  PERFORM pg_temp.is(pg_temp.code(stmt), 'ok', 'while the same member at the firm''s address may');
  PERFORM pg_temp.as_user('acme_admin_member', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.code(stmt), 'ok', 'as may a platform admin who is a member, acting as one');
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.export(pg_temp.id('zenith'), 'referral_partners', '["code"]', '[{"field":"kind","op":"any_of","value":["accounting"]}]'), '1|zen-cpa',
    'and each firm''s member gets their own firm''s rows');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.exports(acme), 'acme_agent:table/referral_partners:1 acme_admin_member:table/referral_partners:1',
    'only the two exports that ran are recorded, each as who made it');
  PERFORM pg_temp.is((SELECT bool_or(actor_is_staff) FROM public.firm_activity WHERE kind = 'export_made'), false, 'an admin acting as a member is recorded as themselves (D-33)');
  PERFORM pg_temp.clear();
  RAISE NOTICE 'export: who passed';
END $$;

-- ---------- what can be exported: two tables, their listed columns, nothing of an intake ----------
-- Break caught: the queue or any other table becomes exportable; a column outside the list (an intake's answers, a census, a FEIN, a file,
-- who wrote a partner) can be asked for under any table name; a table or column name reaches SQL. Every table and column name in the
-- database is tried, so a table added later can't become reachable by its name.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); t text; c text; tables text := ''; cols text := '';
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.export_table(%L, 'submissions', '["company_name"]')$q$, acme)),
    '22023: The queue can''t be exported: its columns are an intake''s answers', 'the queue is never exported (D-48)');
  FOR t IN SELECT DISTINCT table_name FROM information_schema.tables WHERE table_schema IN ('public', 'storage', 'auth') ORDER BY 1 LOOP
    IF pg_temp.code(format($q$SELECT public.export_table(%L, %L, '["name"]', '[{"field":"name","op":"is","value":"none"}]')$q$, acme, t)) <> '22023'
       OR t IN ('referral_partners', 'firm_activity') THEN
      tables := tables || t || ' ';
    END IF;
  END LOOP;
  PERFORM pg_temp.is(tables, 'firm_activity referral_partners ', 'of every table in the database, only these two names are accepted');
  FOREACH t IN ARRAY ARRAY['referral_partners', 'firm_activity'] LOOP
    FOR c IN SELECT DISTINCT column_name FROM information_schema.columns WHERE table_schema IN ('public', 'storage', 'auth')
             UNION SELECT unnest(ARRAY['answers', 'census', 'fein', 'chamber_data', 'transcript', 'who', 'subject', 'rows', 'payload', 'email'])
             ORDER BY 1 LOOP
      IF pg_temp.code(format($q$SELECT public.export_table(%L, %L, %L::jsonb, '[{"field":"kind","op":"is_empty"}]')$q$, acme, t, jsonb_build_array(c)::text)) <> '22023' THEN
        cols := cols || t || '.' || c || ' ';
      END IF;
    END LOOP;
  END LOOP;
  PERFORM pg_temp.is(cols,
    'referral_partners.code referral_partners.created_at referral_partners.kind referral_partners.name referral_partners.updated_at '
    || 'firm_activity.at firm_activity.kind firm_activity.record_id firm_activity.record_type firm_activity.role firm_activity.rows firm_activity.subject firm_activity.who ',
    'of every column name in the database and the names of an intake''s content, only the listed columns are accepted');
  PERFORM pg_temp.clear();
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.export_table(%L, 'referral_partners', '["created_by_email"]')$q$, acme)),
    '22023: The table "referral_partners" has no column "created_by_email" to export', 'who wrote a partner is not exported (D-33)');
  PERFORM pg_temp.is(pg_temp.code(format($q$SELECT public.export_table(%L, 'referral_partners', '["name","name"]')$q$, acme)), '22023', 'a column named twice is refused');
  PERFORM pg_temp.is(pg_temp.code(format($q$SELECT public.export_table(%L, 'referral_partners', '[]')$q$, acme)), '22023', 'and no columns');
  PERFORM pg_temp.is(pg_temp.code(format($q$SELECT public.export_table(%L, 'referral_partners', '["name"]', '[{"field":"created_by_email","op":"is_empty"}]')$q$, acme)),
    '22023', 'a filter on a field the table does not list is refused');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.exports(acme), '', 'no refused export is recorded');
  RAISE NOTICE 'export: what can be exported passed';
END $$;

-- ---------- referral partners: the rows that match, in the columns asked, recorded with their count ----------
-- Break caught: another firm's rows leak in; a filter, the selection or the column order is ignored; the rows are not in the table's
-- order; the count returned or recorded is not the count of rows; the record names the wrong person or table; owners can't read it.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); r jsonb; l text;
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.export(acme, 'referral_partners', '["name","code","kind"]'),
    '3|Acme CFO,acme-cfo,accounting;Autumn Summit,zz-event,event;Bay Law,bay-law,law_firm', 'every partner of the firm, by name, in the columns asked');
  PERFORM pg_temp.is(pg_temp.export(acme, 'referral_partners', '["code"]', '[{"field":"kind","op":"any_of","value":["Accounting","law_firm"]}]'),
    '2|acme-cfo;bay-law', 'a choice filter keeps its kinds');
  PERFORM pg_temp.is(pg_temp.export(acme, 'referral_partners', '["code"]', '[{"field":"name","op":"contains","value":"LAW"}]'), '1|bay-law', 'a text filter, ignoring case');
  PERFORM pg_temp.is(pg_temp.export(acme, 'referral_partners', '["code"]',
    '[{"field":"name","op":"contains","value":"a"},{"field":"kind","op":"none_of","value":["event"]}]'), '2|acme-cfo;bay-law', 'filters together are "and"');
  PERFORM pg_temp.is(pg_temp.export(acme, 'referral_partners', '["code"]', '[{"field":"created_at","op":"in_next_days","value":3}]'), '3|acme-cfo;zz-event;bay-law',
    'a date filter, by the caller''s day');
  PERFORM pg_temp.is(pg_temp.export(acme, 'referral_partners', '["code"]', '[{"field":"created_at","op":"before","value":"2000-01-01"}]'), '0|', 'and one that keeps none');
  PERFORM pg_temp.is(pg_temp.export(acme, 'referral_partners', '["code","name"]', '[]', '["bay-law","zen-cpa","made-up"]'), '1|bay-law,Bay Law',
    'a selection keeps only the firm''s own rows it names: another firm''s code is not found');
  PERFORM pg_temp.is(pg_temp.code(format($q$SELECT public.export_table(%L, 'referral_partners', '["code"]', '[{"field":"kind","op":"any_of","value":["nope"]}]')$q$, acme)),
    '22023', 'a kind that is not a kind is refused');
  PERFORM pg_temp.is(pg_temp.code(format($q$SELECT public.export_table(%L, 'referral_partners', '["code"]', '[]', '"bay-law"')$q$, acme)), '22023', 'a selection must be a list');
  r := public.export_table(acme, 'referral_partners', '["kind","code"]', '[{"field":"code","op":"is","value":"acme-cfo"}]');
  PERFORM pg_temp.is(r -> 'columns', '["kind", "code"]'::jsonb, 'the answer names its columns in the order asked');
  PERFORM pg_temp.is(r -> 'rows', '[["accounting", "acme-cfo"]]'::jsonb, 'each row is its values in that order');
  PERFORM pg_temp.is(concat_ws(',', r ->> 'row_count', r ->> 'whole_table', r ->> 'table'), '1,false,referral_partners', 'with its count, whether it is the whole table, and the table');
  PERFORM pg_temp.is((r ->> 'exported_at') ~ '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$', true, 'and when, in UTC');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.exports(acme),
    'acme_agent:table/referral_partners:3 acme_agent:table/referral_partners:2 acme_agent:table/referral_partners:1 acme_agent:table/referral_partners:2 '
    || 'acme_agent:table/referral_partners:3 acme_agent:table/referral_partners:0 acme_agent:table/referral_partners:1 acme_agent:table/referral_partners:1',
    'every export that ran is one entry with the count it returned, and a refused one is none');
  PERFORM pg_temp.is(pg_temp.exports(pg_temp.id('zenith')), '', 'and it is the firm''s own record, not another firm''s');
  -- The owners read it in the record, with the count; a member who is no owner doesn't (the record's own rule, CRM-P2.3).
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  SELECT string_agg(DISTINCT concat_ws(',', x.actor_email, x.record_type, x.record_id), ' ') || ':' || count(*) || ':' || sum(x.row_count) INTO l
  FROM public.firm_activity_list(acme, NULL, 'export_made', 100) x;
  PERFORM pg_temp.is(l, 'acme_agent@example.test,table,referral_partners:8:13',
    'an owner reads who exported, which table and how many rows');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.code(format($q$SELECT * FROM public.firm_activity_list(%L)$q$, acme)), '42501', 'the agent who exported can''t read the record');
  PERFORM pg_temp.is(pg_temp.code('SELECT row_count FROM public.firm_activity'), 'ok', 'the count is a column of the record an owner may read');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity), 0::bigint, 'and the agent sees no row of it');
  RESET ROLE;
  PERFORM pg_temp.clear();
  RAISE NOTICE 'export: referral partners passed';
END $$;

-- ---------- the record can't be written without an export ----------
-- Break caught: an export entry can be written with no count, or a count put on another kind of entry, so the record could say an export
-- happened that returned nothing, or hide one.
DO $$
DECLARE acme uuid := pg_temp.id('acme');
BEGIN
  PERFORM pg_temp.is(pg_temp.code(format($q$INSERT INTO public.firm_activity (firm_id, kind, record_type, record_id) VALUES (%L, 'export_made', 'table', 'referral_partners')$q$, acme)),
    '23514', 'an export entry without a count is refused');
  PERFORM pg_temp.is(pg_temp.code(format($q$INSERT INTO public.firm_activity (firm_id, kind, record_type, record_id, row_count) VALUES (%L, 'sign_in', 'firm', %L, 3)$q$, acme, acme)),
    '23514', 'and a count on an entry that is not an export');
  PERFORM pg_temp.is(pg_temp.code(format($q$INSERT INTO public.firm_activity (firm_id, kind, record_type, record_id, row_count) VALUES (%L, 'export_made', 'firm', %L, 3)$q$, acme, acme)),
    '23514', 'and an export that is not of a table');
  RAISE NOTICE 'export: the record''s shape passed';
END $$;

-- ---------- a whole-table export needs a sign-in within 12 hours ----------
-- Break caught: the check is dropped, reads the wrong claim, has the wrong window or the wrong direction; a filter that keeps every row
-- passes as "not everything"; a refused export is recorded; an export of part of a table is held to it.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); everything text;
BEGIN
  everything := format($q$SELECT public.export_table(%L, 'referral_partners', '["code"]')$q$, acme);
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers', interval '13 hours');
  PERFORM pg_temp.is(pg_temp.refusal(everything), 'PT428: Sign in again to export the whole table: you last signed in more than 12 hours ago',
    'a sign-in 13 hours old can''t export every partner');
  PERFORM pg_temp.is(pg_temp.code(format($q$SELECT public.export_table(%L, 'referral_partners', '["code"]', '[{"field":"created_at","op":"after","value":"2000-01-01"}]')$q$, acme)),
    'PT428', 'nor with a filter that keeps every row: what counts is what the export holds');
  PERFORM pg_temp.is(pg_temp.code(format($q$SELECT public.export_table(%L, 'referral_partners', '["code"]', '[]', '["acme-cfo","bay-law","zz-event"]')$q$, acme)),
    'PT428', 'nor by selecting every row');
  PERFORM pg_temp.is(pg_temp.export(acme, 'referral_partners', '["code"]', '[{"field":"kind","op":"any_of","value":["event"]}]'), '1|zz-event', 'part of the table needs no recent sign-in');
  PERFORM pg_temp.is(pg_temp.export(acme, 'referral_partners', '["code"]', '[]', '["made-up"]'), '0|', 'nor an export that holds nothing');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers', NULL);
  PERFORM pg_temp.is(pg_temp.code(everything), 'PT428', 'a token that says nothing of when it signed in is not recent');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers', interval '11 hours 59 minutes');
  PERFORM pg_temp.is(pg_temp.export(acme, 'referral_partners', '["code"]'), '3|acme-cfo;zz-event;bay-law', 'a sign-in within 12 hours exports the whole table');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(public.export_table(acme, 'referral_partners', '["code"]') ->> 'whole_table', 'true', 'and says it was the whole table');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.exports(acme),
    'acme_agent:table/referral_partners:1 acme_agent:table/referral_partners:0 acme_agent:table/referral_partners:3 acme_agent:table/referral_partners:3',
    'the refused whole-table exports are not recorded');
  PERFORM pg_temp.clear();
  RAISE NOTICE 'export: recent sign-in passed';
END $$;

-- ---------- the firm's record: its owners only, Nevermore shown as Nevermore ----------
-- Break caught: a member who is no owner exports the record; another firm's entries leak in; a person of Nevermore's is shown by email
-- or id (D-33); the system is shown as a person; the count of an export is lost.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); got text;
BEGIN
  RESET ROLE;
  INSERT INTO public.firm_activity (firm_id, kind, record_type, record_id) VALUES (acme, 'sign_in', 'firm', acme::text);
  INSERT INTO public.firm_activity (firm_id, kind, record_type, record_id) VALUES (pg_temp.id('zenith'), 'sign_in', 'firm', pg_temp.id('zenith')::text);
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.export_table(%L, 'firm_activity', '["who"]', '[{"field":"kind","op":"any_of","value":["sign_in"]}]')$q$, acme)),
    '42501: Only a firm''s owners can export its record', 'an agent can''t export the firm''s record');
  PERFORM pg_temp.is(pg_temp.export(acme, 'referral_partners', '["code"]', '[{"field":"code","op":"is","value":"bay-law"}]'), '1|bay-law', 'the agent exports a partner');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.export(acme, 'firm_activity', '["who","kind","record_type","record_id","rows"]', '[{"field":"kind","op":"any_of","value":["export_made"]}]'),
    '1|acme_agent@example.test,export_made,table,referral_partners,1', 'an owner exports who exported what, and how many rows');
  PERFORM pg_temp.is(pg_temp.export(acme, 'firm_activity', '["who","kind"]', '[{"field":"kind","op":"any_of","value":["sign_in"]}]'), '1|System,sign_in',
    'an entry the system made is "System", and another firm''s entries are not there');
  got := pg_temp.export(acme, 'firm_activity', '["who","kind","record_type","subject"]',
    '[{"field":"kind","op":"any_of","value":["support_access"]},{"field":"record_type","op":"any_of","value":["support_session"]}]');
  PERFORM pg_temp.is(got, '1|Nevermore,support_access,support_session,~', 'a person of Nevermore''s is "Nevermore"');
  PERFORM pg_temp.is(position('platform_admin' IN got) + position(pg_temp.id('platform_admin')::text IN got), 0, 'with no email and no id');
  PERFORM pg_temp.is(pg_temp.export(acme, 'firm_activity', '["who"]', '[{"field":"who","op":"is","value":"nevermore"}]'), '2|Nevermore;Nevermore', 'and can be filtered by who');
  PERFORM pg_temp.is(pg_temp.code(format($q$SELECT public.export_table(%L, 'firm_activity', '["who"]', '[{"field":"role","op":"any_of","value":["boss"]}]')$q$, acme)),
    '22023', 'a role that is not a role is refused');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.exports(acme),
    'acme_agent:table/referral_partners:1 acme_owner:table/firm_activity:1 acme_owner:table/firm_activity:1 acme_owner:table/firm_activity:1 acme_owner:table/firm_activity:2',
    'exporting the record is recorded in it too');
  PERFORM pg_temp.clear();
  RAISE NOTICE 'export: the firm''s record passed';
END $$;

-- ---------- the cap: 10,000 rows, refused past it, never cut short ----------
-- Break caught: the cap is dropped or off by one; a larger export is cut to the cap and recorded as if whole; a refused one is recorded.
DO $$
DECLARE zenith uuid := pg_temp.id('zenith'); keys jsonb;
BEGIN
  RESET ROLE;
  SET LOCAL session_replication_role = replica;
  INSERT INTO public.referral_partners (firm_id, code, name, kind)
    SELECT zenith, 'bulk-' || lpad(i::text, 5, '0'), 'Bulk ' || lpad(i::text, 5, '0'), 'other' FROM generate_series(1, 10000) i;
  SET LOCAL session_replication_role = origin;
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.export_table(%L, 'referral_partners', '["code"]')$q$, zenith)),
    '54000: This export would hold 10001 rows; the most one export holds is 10000. Narrow it with a filter.', 'an export of 10,001 rows is refused');
  PERFORM pg_temp.is(split_part(pg_temp.export(zenith, 'referral_partners', '["code"]', '[{"field":"kind","op":"any_of","value":["other"]}]'), '|', 1), '10000',
    'one of exactly 10,000 is not');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.exports(zenith), 'zenith_owner:table/referral_partners:10000', 'only the export that ran is recorded');
  RAISE NOTICE 'export: the cap passed';
END $$;

-- ---------- the owners' alert: more than 500 rows ----------
-- Break caught: the alert is not queued, is queued at 500, goes to an intake instead of the firm, carries something more than who, which
-- firm, which table, how many rows and when, or is queued for a refused export.
DO $$
DECLARE zenith uuid := pg_temp.id('zenith'); e public.outbox_events;
BEGIN
  PERFORM pg_temp.clear();
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  PERFORM pg_temp.export(zenith, 'referral_partners', '["code"]', '[]', (SELECT jsonb_agg('bulk-' || lpad(i::text, 5, '0')) FROM generate_series(1, 500) i));
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.alerts(zenith), 0::bigint, 'an export of 500 rows tells no one');
  PERFORM pg_temp.clear();
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  PERFORM pg_temp.export(zenith, 'referral_partners', '["code"]', '[]', (SELECT jsonb_agg('bulk-' || lpad(i::text, 5, '0')) FROM generate_series(1, 501) i));
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.alerts(zenith), 1::bigint, 'an export of 501 rows tells the owners');
  SELECT * INTO e FROM public.outbox_events WHERE kind = 'export_alert' AND firm_id = zenith;
  PERFORM pg_temp.is(concat_ws(',', e.session_id IS NULL, e.firm_id = zenith, e.status), 't,t,pending', 'as one firm-level email, waiting to be sent');
  PERFORM pg_temp.is((SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(e.payload) k), 'exported_at,exports_in_hour,firm_name,large,member_email,row_count,table',
    'that holds only who, which firm, which table, how many rows, when and why');
  PERFORM pg_temp.is(concat_ws(',', e.payload ->> 'member_email', e.payload ->> 'firm_name', e.payload ->> 'table', e.payload ->> 'row_count', e.payload ->> 'large', e.payload ->> 'exports_in_hour'),
    'zenith_owner@example.test,Zenith Benefits,referral_partners,501,true,1', 'with those values');
  PERFORM pg_temp.is(public.outbox_kind_is_firm_alert('export_alert'), true, 'it is a firm''s alert: held while suspended, never suppressed by a bounce, ended once closed (D-118)');
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits', interval '20 hours');
  PERFORM pg_temp.code(format($q$SELECT public.export_table(%L, 'referral_partners', '["code"]')$q$, zenith));
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.alerts(zenith), 1::bigint, 'a refused large export tells no one');
  PERFORM pg_temp.clear();
  RAISE NOTICE 'export: large alert passed';
END $$;

-- ---------- the owners' alert: a member's third export within an hour ----------
-- Break caught: the alert is not queued at the third; it is queued at the first or second, or again at the fourth; exports older than an
-- hour, or another member's, are counted.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); one text;
BEGIN
  one := format($q$SELECT public.export_table(%L, 'referral_partners', '["code"]', '[{"field":"kind","op":"any_of","value":["event"]}]')$q$, acme);
  -- Two exports by this member more than an hour ago, and two by another member just now.
  RESET ROLE;
  INSERT INTO public.firm_activity (firm_id, actor_id, at, kind, record_type, record_id, row_count) VALUES
    (acme, pg_temp.id('acme_agent'), now() - interval '61 minutes', 'export_made', 'table', 'referral_partners', 1),
    (acme, pg_temp.id('acme_agent'), now() - interval '2 hours', 'export_made', 'table', 'referral_partners', 1),
    (acme, pg_temp.id('acme_owner'), now() - interval '5 minutes', 'export_made', 'table', 'referral_partners', 1),
    (acme, pg_temp.id('acme_owner'), now() - interval '4 minutes', 'export_made', 'table', 'referral_partners', 1);
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.code(one), 'ok', 'a first export');
  PERFORM pg_temp.is(pg_temp.code(one), 'ok', 'a second');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.alerts(acme), 0::bigint, 'two within the hour tell no one: older ones and another member''s are not counted');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.code(one), 'ok', 'a third');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.alerts(acme), 1::bigint, 'the third within the hour tells the owners');
  PERFORM pg_temp.is((SELECT concat_ws(',', payload ->> 'exports_in_hour', payload ->> 'large', payload ->> 'member_email') FROM public.outbox_events WHERE kind = 'export_alert' AND firm_id = acme),
    '3,false,acme_agent@example.test', 'saying it was the third in an hour, not a large one, and by whom');
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.code(one), 'ok', 'a fourth');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.alerts(acme), 1::bigint, 'the fourth tells no one again');
  PERFORM pg_temp.clear();
  RAISE NOTICE 'export: repeated alert passed';
END $$;

-- ---------- a closing firm may export, and its owners are still told ----------
-- Break caught: the export asks assert_firm_writable, so a closing firm's owners can't take the full export they are offered (PRD 8.5).
DO $$
DECLARE zenith uuid := pg_temp.id('zenith');
BEGIN
  RESET ROLE;
  SET LOCAL session_replication_role = replica;
  DELETE FROM public.referral_partners WHERE firm_id = zenith AND code > 'bulk-00600';
  SET LOCAL session_replication_role = origin;
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  PERFORM public.request_firm_closure(zenith, 'Zenith Benefits');
  PERFORM pg_temp.is(pg_temp.code(format($q$SELECT public.advisor_add_referral_partner('closing-new', 'New', 'other', %L)$q$, zenith)), 'PT423', 'the closing firm is read-only');
  PERFORM pg_temp.is(split_part(pg_temp.export(zenith, 'referral_partners', '["code","name","kind","created_at","updated_at"]'), '|', 1), '600',
    'and its owner exports every partner');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.alerts(zenith), 1::bigint, 'and the owners are told of it');
  PERFORM pg_temp.clear();
  RAISE NOTICE 'export: closing firm passed';
END $$;

-- ---------- grants ----------
-- Break caught: a helper (the rows, the checks, the limits) can be run by a browser and so read rows past the checks, or a signed-out
-- caller can run the export.
DO $$
DECLARE f text;
BEGIN
  PERFORM pg_temp.is(has_function_privilege('anon', 'public.export_table(uuid, text, jsonb, jsonb, jsonb, text)', 'EXECUTE'), false, 'signed out, nobody can run it');
  PERFORM pg_temp.is(has_function_privilege('authenticated', 'public.export_table(uuid, text, jsonb, jsonb, jsonb, text)', 'EXECUTE'), true, 'a signed-in person can');
  FOREACH f IN ARRAY ARRAY['public.export_visible_rows(uuid, text)', 'public.export_columns(text)', 'public.export_columns_checked(text, jsonb)',
                           'public.export_filters_checked(text, jsonb, date)', 'public.export_keys_checked(jsonb)', 'public.export_row_passes(text, jsonb, jsonb, text)',
                           'public.export_field_kind(text, text)', 'public.export_row_cap()', 'public.export_alert_rows()', 'public.export_alert_repeats()',
                           'public.export_fresh_sign_in()', 'public.export_moment(timestamptz)'] LOOP
    PERFORM pg_temp.is(has_function_privilege('authenticated', f, 'EXECUTE') OR has_function_privilege('anon', f, 'EXECUTE'), false, f || ' is internal');
  END LOOP;
  RAISE NOTICE 'export: grants passed';
END $$;

-- ---------- two exports at once: the third in the hour is still seen ----------
-- Break caught: the per-member lock is removed, so two exports made at the same moment each count only the committed ones and neither is
-- the third (D-32: the lock stays because this goes red without it).
CREATE SCHEMA race;
CREATE EXTENSION dblink SCHEMA race;
-- The member's one export ten minutes ago, committed before the two connections start.
DO $$
BEGIN
  PERFORM pg_temp.clear();
  INSERT INTO public.firm_activity (firm_id, actor_id, at, kind, record_type, record_id, row_count)
  VALUES (pg_temp.id('acme'), pg_temp.id('acme_agent'), now() - interval '10 minutes', 'export_made', 'table', 'referral_partners', 1);
END $$;
DO $$
DECLARE
  acme uuid := pg_temp.id('acme');
  dsn text := format('dbname=%s user=%s port=%s host=%s', current_database(), session_user, current_setting('port'),
    split_part(current_setting('unix_socket_directories'), ',', 1));
  stmt text := format($q$DO $d$ BEGIN PERFORM public.export_table(%L, 'referral_partners', '["code"]', '[{"field":"kind","op":"any_of","value":["event"]}]'); END $d$ $q$, acme);
  setup text := format('SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = %L; SET LOCAL request.headers = %L',
    pg_temp.claims('acme_agent'), jsonb_build_object('x-firm-address', 'acme-brokers')::text);
  b_pid integer; tries integer := 0; waited boolean := false;
BEGIN
  PERFORM race.dblink_connect('ra', dsn);
  PERFORM race.dblink_connect('rb', dsn);
  SELECT pid INTO b_pid FROM race.dblink('rb', 'SELECT pg_backend_pid()') AS t(pid integer);
  PERFORM race.dblink_exec('ra', 'BEGIN; ' || setup);
  PERFORM race.dblink_exec('ra', stmt);
  PERFORM race.dblink_exec('rb', 'BEGIN; ' || setup);
  PERFORM race.dblink_send_query('rb', stmt);
  WHILE tries < 60 LOOP
    IF cardinality(pg_blocking_pids(b_pid)) > 0 THEN waited := true; EXIT; END IF;
    IF race.dblink_is_busy('rb') = 0 THEN EXIT; END IF;
    tries := tries + 1;
    PERFORM pg_sleep(0.05);
  END LOOP;
  PERFORM race.dblink_exec('ra', 'COMMIT');
  PERFORM * FROM race.dblink_get_result('rb') AS t(r text);
  PERFORM * FROM race.dblink_get_result('rb') AS t(r text);
  PERFORM race.dblink_exec('rb', 'COMMIT');
  PERFORM race.dblink_disconnect('ra');
  PERFORM race.dblink_disconnect('rb');
  PERFORM pg_temp.is(waited, true, 'the second export waits for the first');
  PERFORM pg_temp.is(pg_temp.alerts(acme), 1::bigint, 'and, seeing it, is the third in the hour and tells the owners');
  RAISE NOTICE 'export: two at once passed';
END $$;
