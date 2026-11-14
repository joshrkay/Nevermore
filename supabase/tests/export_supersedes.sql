-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh export_supersedes
-- Epic 3's export supersedes main's (founder, 2026-11-14; docs/BROKER_CRM_BUILD.md "Superseded by Epic 3"; D-218), on a database that
-- already holds exports made by main's export_table (20261118170000 to 20261118171000, which may be applied in production). The
-- exports it recorded and the owners' alert it queued survive 20261118180000_epic3_export_supersedes.sql, Epic 3's
-- 20261119090000_export.sql and 20261119090500_epic3_export_carried.sql, in Epic 3's shape: each entry with the same number, key, time,
-- actor, table and count, under Epic 3's rule that ties a count to an export; the alert with the table in words, as Epic 3's dispatcher
-- reads it. main's functions are gone and Epic 3's work on the carried entries. An export main's export_table is making while the upgrade
-- starts (two more connections) is carried too, and the upgrade leaves the record's guard on and the holding table closed to the API.
-- Every migration loads in filename order; the exports are made between main's last and the supersedes migration.
\set ON_ERROR_STOP 1
SET client_min_messages = warning;
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
\i supabase/migrations/20261118170500_export_fixes.sql
\i supabase/migrations/20261118171000_export_fixes_again.sql

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

-- Signs in as a person at a firm's address (D-40), an hour ago, by a provider (no second factor owed).
CREATE FUNCTION pg_temp.as_user(n text, addr text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', false,
    'email', n || '@example.test', 'aal', 'aal1',
    'amr', jsonb_build_array(jsonb_build_object('method', 'oauth', 'timestamp', floor(extract(epoch FROM now() - interval '1 hour'))::bigint)))::text, false);
  PERFORM set_config('request.headers', jsonb_build_object('x-firm-address', addr)::text, false);
  SET LOCAL ROLE authenticated;
END $$;

CREATE FUNCTION pg_temp.is(got anyelement, want anyelement, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION 'FAIL: % gave %, expected %', label, got, want; END IF;
END $$;

-- ---------- under main: two firms, their partners, and exports made by main's export_table ----------
DO $$
DECLARE acme uuid; zenith uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Acme Brokers', 'acme-brokers', now()) RETURNING id INTO acme;
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Zenith Benefits', 'zenith-benefits', now()) RETURNING id INTO zenith;
  INSERT INTO fx VALUES ('acme', acme), ('zenith', zenith);
  PERFORM pg_temp.new_user('acme_owner'); PERFORM pg_temp.new_user('acme_agent'); PERFORM pg_temp.new_user('zenith_owner');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES
    (acme, pg_temp.id('acme_owner'), 'owner'), (acme, pg_temp.id('acme_agent'), 'agent'), (zenith, pg_temp.id('zenith_owner'), 'owner');
  INSERT INTO public.referral_partners (firm_id, code, name, kind) VALUES
    (acme, 'acme-cfo', 'Acme CFO', 'accounting'), (acme, 'bay-law', 'Bay Law', 'law_firm'), (acme, 'zz-event', 'Autumn Summit', 'event'),
    (zenith, 'zen-cpa', 'Zenith CPA', 'accounting');
END $$;

-- The agent exports the partners three times within the hour (the third queues the owners' alert), the owner exports the firm's
-- record, and the other firm's owner exports its partners twice: six entries, in two firms, by three people, of both tables.
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_agent', 'acme-brokers');
  PERFORM pg_temp.is((public.export_table(pg_temp.id('acme'), 'referral_partners', '["code","name"]') ->> 'row_count')::int, 3, 'main: the whole table');
  PERFORM pg_temp.is((public.export_table(pg_temp.id('acme'), 'referral_partners', '["name"]', '[]', '["bay-law"]') ->> 'row_count')::int, 1, 'main: a selection');
  PERFORM pg_temp.is((public.export_table(pg_temp.id('acme'), 'referral_partners', '["name"]', '[{"field":"kind","op":"any_of","value":["accounting","event"]}]') ->> 'row_count')::int, 2,
    'main: a filter, the third in the hour');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is((public.export_table(pg_temp.id('acme'), 'firm_activity', '["at","kind","rows"]') ->> 'row_count')::int, 5, 'main: the record, its two members joining and the three exports');
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  PERFORM pg_temp.is((public.export_table(pg_temp.id('zenith'), 'referral_partners', '["code"]') ->> 'row_count')::int, 1, 'main: the other firm');
  PERFORM pg_temp.is((public.export_table(pg_temp.id('zenith'), 'referral_partners', '["code"]', '[]', '["zen-cpa"]') ->> 'row_count')::int, 1, 'main: the other firm again');
  RESET ROLE;
END $$;

-- What main recorded and queued, as the superuser, to compare with after the upgrade. The six were made in one transaction, so they
-- share a time; they are told apart by their number.
CREATE TEMP TABLE main_entries AS
  SELECT id, entry_key, firm_id, at, actor_id, actor_is_staff, kind, record_type, record_id, subject_user_id, role, row_count
  FROM public.firm_activity WHERE kind = 'export_made';
CREATE TEMP TABLE main_alerts AS SELECT id, kind, firm_id, dedupe_key, status, payload FROM public.outbox_events WHERE kind = 'export_alert';

DO $$
BEGIN
  PERFORM pg_temp.is((SELECT count(*) FROM main_entries), 6::bigint, 'main recorded six exports');
  PERFORM pg_temp.is((SELECT string_agg(record_id || ':' || row_count, ' ' ORDER BY id) FROM main_entries),
    'referral_partners:3 referral_partners:1 referral_partners:2 firm_activity:5 referral_partners:1 referral_partners:1', 'main recorded each table and count');
  PERFORM pg_temp.is((SELECT count(*) FROM main_alerts), 1::bigint, 'main queued one alert, for the third export in the hour');
  PERFORM pg_temp.is((SELECT payload ->> 'table' FROM main_alerts), 'referral_partners', 'main''s alert names the table by its name');
  PERFORM pg_temp.is((SELECT payload ? 'table_label' FROM main_alerts), false, 'main''s alert has no words for the table');
END $$;

-- ---------- the upgrade starts while main's export_table is making two exports ----------
-- Break caught: the supersedes migration reads the record before it locks it, so an export written and not yet committed when it starts
-- is not copied, then loses its count with the column; Epic 3's rule then refuses the record (20261119090000 fails: "firm_activity_export_check
-- ... is violated by some row"), leaving main's entries held and no export function. Two more real connections (dblink) each make an
-- export and hold its transaction open while this connection runs the migration, which must wait for both and copy both: the other firm's
-- owner's third export in the hour (its entry and the owners' alert), committed two seconds on, and the acme owner's second (an entry and
-- no alert), committed three seconds on. The second is the one only the lock on the record waits for: an export that writes no alert
-- holds nothing in the outbox.
CREATE SCHEMA race;
CREATE EXTENSION dblink SCHEMA race;
-- Makes an export as `n` at the firm's address on connection `conn`, leaves it uncommitted, and has the connection commit `secs` later.
CREATE FUNCTION pg_temp.export_held(conn text, n text, addr text, firm text, secs integer) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  dsn text := format('dbname=%s user=%s port=%s host=%s', current_database(), session_user, current_setting('port'), split_part(current_setting('unix_socket_directories'), ',', 1));
  claims text := jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', false, 'email', n || '@example.test',
    'aal', 'aal1', 'amr', jsonb_build_array(jsonb_build_object('method', 'oauth', 'timestamp', floor(extract(epoch FROM now() - interval '1 hour'))::bigint)))::text;
  answer text;
BEGIN
  PERFORM race.dblink_connect(conn, dsn);
  PERFORM race.dblink_exec(conn, 'BEGIN');
  PERFORM race.dblink_exec(conn, 'SET LOCAL ROLE authenticated');
  PERFORM race.dblink_exec(conn, format('SET LOCAL request.jwt.claims = %L', claims));
  PERFORM race.dblink_exec(conn, format('SET LOCAL request.headers = %L', jsonb_build_object('x-firm-address', addr)::text));
  SELECT r INTO answer FROM race.dblink(conn, format($q$SELECT public.export_table(%L, 'referral_partners', '["name"]')::text$q$, pg_temp.id(firm))) AS t(r text);
  PERFORM race.dblink_send_query(conn, format('SELECT pg_sleep(%s); COMMIT', secs));
  RETURN (answer::jsonb ->> 'row_count')::integer;
END $$;
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.export_held('zenith_exporting', 'zenith_owner', 'zenith-benefits', 'zenith', 2), 1, 'the other firm''s concurrent export is made');
  PERFORM pg_temp.is(pg_temp.export_held('acme_exporting', 'acme_owner', 'acme-brokers', 'acme', 3), 3, 'and the acme owner''s');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'export_made'), 6::bigint, 'neither committed: this connection sees neither');
  PERFORM pg_temp.is((SELECT count(*) FROM public.outbox_events WHERE kind = 'export_alert'), 1::bigint, 'nor the alert');
END $$;

-- ---------- the upgrade: the supersedes migration, Epic 3's export, the carried entries, and what follows ----------
\i supabase/migrations/20261118180000_epic3_export_supersedes.sql

DO $$
DECLARE conn text;
BEGIN
  -- Each concurrent connection's two results (the sleep, the commit), then nothing.
  FOREACH conn IN ARRAY ARRAY['zenith_exporting', 'acme_exporting'] LOOP
    WHILE (SELECT count(*) FROM race.dblink_get_result(conn) AS t(r text)) > 0 LOOP END LOOP;
    PERFORM race.dblink_disconnect(conn);
  END LOOP;
END $$;
DROP SCHEMA race CASCADE;

-- Break caught: the supersedes migration leaves the record's append-only guard off, or the holding table readable by an API role
-- (Supabase grants every new table in public to them) or without row security.
DO $$
BEGIN
  PERFORM pg_temp.is((SELECT tgenabled FROM pg_trigger WHERE tgrelid = 'public.firm_activity'::regclass AND tgname = 'firm_activity_append_only'), 'O'::"char",
    'the record''s append-only guard is on again');
  PERFORM pg_temp.is((SELECT string_agg(r, ' ') FROM unnest(ARRAY['public', 'anon', 'authenticated', 'service_role']) r
    WHERE has_table_privilege(r, 'public.epic3_carried_exports', 'SELECT') OR has_any_column_privilege(r, 'public.epic3_carried_exports', 'SELECT')), NULL,
    'no API role can read the holding table');
  PERFORM pg_temp.is((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.epic3_carried_exports'::regclass), true, 'and it has row security');
  PERFORM pg_temp.is((SELECT count(*) FROM public.epic3_carried_exports), 8::bigint, 'it holds every export, the two concurrent ones too');
END $$;

\i supabase/migrations/20261119090000_export.sql
\i supabase/migrations/20261119090500_epic3_export_carried.sql
\i supabase/migrations/20261119100000_crm_records.sql
\i supabase/migrations/20261119110000_chain_at_certification.sql
\i supabase/migrations/20261119120000_bring_submissions_in.sql
\i supabase/migrations/20261119140000_account_page.sql
\i supabase/migrations/20261119145000_account_tab.sql

-- ---------- after: every entry main recorded is in the record, unchanged, in Epic 3's shape ----------
-- Break caught: the supersedes migration drops main's entries (or the column with their counts) instead of setting them aside; the carried
-- migration is missing, puts back fewer, renumbers them, or loses a column; Epic 3's rule is not the one checking them.
DO $$
BEGIN
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'export_made'), 8::bigint, 'the eight exports are in the record');
  PERFORM pg_temp.is((
    SELECT count(*) FROM main_entries m JOIN public.firm_activity a
      ON a.id = m.id AND a.entry_key = m.entry_key AND a.firm_id = m.firm_id AND a.at = m.at AND a.actor_id IS NOT DISTINCT FROM m.actor_id
     AND a.actor_is_staff = m.actor_is_staff AND a.kind = m.kind AND a.record_type = m.record_type AND a.record_id = m.record_id
     AND a.subject_user_id IS NOT DISTINCT FROM m.subject_user_id AND a.role IS NOT DISTINCT FROM m.role AND a.row_count = m.row_count), 6::bigint,
    'each with the same number, key, firm, time, actor, table and count');
  PERFORM pg_temp.is((SELECT string_agg(f.name || ':' || a.record_id || ':' || a.row_count, ' ' ORDER BY f.name) FROM public.firm_activity a JOIN fx f ON f.id = a.actor_id
    WHERE a.kind = 'export_made' AND NOT EXISTS (SELECT 1 FROM main_entries m WHERE m.id = a.id)),
    'acme_owner:referral_partners:3 zenith_owner:referral_partners:1', 'and the two made while the upgrade started, with their counts');
  PERFORM pg_temp.is(to_regclass('public.epic3_carried_exports'), NULL::regclass, 'the holding table is gone');
  PERFORM pg_temp.is((SELECT convalidated FROM pg_constraint WHERE conrelid = 'public.firm_activity'::regclass AND conname = 'firm_activity_export_check'), true,
    'Epic 3''s rule ties the count to the kind, validated over every entry');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_constraint WHERE conrelid = 'public.firm_activity'::regclass AND conname LIKE '%export%'), 1::bigint,
    'and it is the only rule about exports');
END $$;

-- Break caught: main's alert is left naming the table by its name, which Epic 3's dispatcher (parseExportAlert) refuses, so the owners are
-- never told; or the rewrite changes anything else of it.
DO $$
BEGIN
  PERFORM pg_temp.is((SELECT count(*) FROM public.outbox_events WHERE kind = 'export_alert'), 2::bigint, 'main''s alert is still queued, and the concurrent one''s');
  PERFORM pg_temp.is((SELECT e.payload FROM public.outbox_events e JOIN main_alerts m ON m.id = e.id AND m.dedupe_key = e.dedupe_key AND m.status = e.status AND m.firm_id = e.firm_id),
    (SELECT (payload - 'table') || '{"table_label":"Referral partners"}'::jsonb FROM main_alerts),
    'in Epic 3''s shape: the table in words, and nothing else changed');
  PERFORM pg_temp.is((SELECT count(*) FROM public.outbox_events e WHERE e.kind = 'export_alert'
    AND (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(e.payload) k) = ARRAY['exported_at', 'exports_in_hour', 'firm_name', 'large', 'member_email', 'row_count', 'table_label']),
    2::bigint, 'each with the keys Epic 3''s export_rows writes');
  PERFORM pg_temp.is((SELECT string_agg(e.payload ->> 'firm_name' || ':' || (e.payload ->> 'table_label'), ' ' ORDER BY e.payload ->> 'firm_name') FROM public.outbox_events e WHERE e.kind = 'export_alert'),
    'Acme Brokers:Referral partners Zenith Benefits:Referral partners', 'the table in words in both');
END $$;

-- Break caught: main's functions are left beside Epic 3's (two ways to export, one of them unrecorded by Epic 3's rules and tests).
DO $$
BEGIN
  PERFORM pg_temp.is((SELECT string_agg(p.oid::regprocedure::text, ' ' ORDER BY p.oid::regprocedure::text) FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND (p.proname LIKE 'export%' OR p.proname IN ('signed_in_within', 'caller_last_sign_in_at'))),
    'caller_last_sign_in_at() export_limits() export_rows(uuid,text,jsonb,jsonb) export_source_firm_activity(uuid,jsonb,jsonb,integer) '
    'export_source_referral_partners(uuid,jsonb,jsonb,integer) export_table_registry()', 'only Epic 3''s export functions are left');
END $$;

-- Break caught: the carried entries can't be read or exported the way Epic 3's own are (the count not returned, or not exported).
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is((SELECT string_agg(l.record_id || ':' || l.row_count, ' ' ORDER BY l.record_id || ':' || l.row_count) FROM public.firm_activity_list(pg_temp.id('acme'), p_kind => 'export_made') l),
    'firm_activity:5 referral_partners:1 referral_partners:2 referral_partners:3 referral_partners:3', 'the owners read each carried export with its count');
  r := public.export_rows(pg_temp.id('acme'), 'firm_activity', '{"kind":"export_made"}');
  PERFORM pg_temp.is((SELECT string_agg((x ->> 'record_id') || ':' || (x ->> 'row_count'), ' ' ORDER BY (x ->> 'record_id') || ':' || (x ->> 'row_count')) FROM jsonb_array_elements(r -> 'rows') x),
    'firm_activity:5 referral_partners:1 referral_partners:2 referral_partners:3 referral_partners:3', 'and Epic 3''s export of the record carries them, with their counts');
  -- That export is recorded by Epic 3's export_rows after the carried ones, numbered after them.
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'export_made' AND firm_id = pg_temp.id('acme')), 6::bigint, 'Epic 3 records its own export beside them');
  PERFORM pg_temp.is((SELECT max(id) FROM public.firm_activity WHERE kind = 'export_made' AND record_id = 'firm_activity') > (SELECT max(id) FROM public.firm_activity WHERE kind = 'export_made' AND record_id = 'referral_partners'),
    true, 'numbered after the carried ones');
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity_list(pg_temp.id('zenith'), p_kind => 'export_made')), 3::bigint, 'each firm reads only its own');
  RESET ROLE;
END $$;

\echo 'export_supersedes: all assertions passed'
