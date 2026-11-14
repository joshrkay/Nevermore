-- CRM-P1.7 review fixes, on top of 20261118110000_close_a_firm.sql (which is merged and not edited).
--
--  1. The default firm can't be closed (D-121): every intake is stamped with it until an intake can belong to another firm (D-101).
--  2. Writes the guard missed: the manuscript storage policies, record_manuscript_version, and the three intake functions an admin who
--     is also a member could use. The standing test now covers policies as well as functions.
--  3. A suspended firm is not closed; lifting a suspension gives its owners seven days; a platform admin can stop a closing.
--  4. A firm that fails to close is an ops event, not only a warning.
--  5. A released address is given a placeholder no sign-up can take.
--  6. The firm-row locks in asking, withdrawing and closing are removed (the closure row's lock and the time conditions order them,
--     and a two-session test proves the one that matters).
--  7. who asked, withdrew or stopped is kept when an account is deleted.
--  8. A closed firm can't be suspended or decided on.
--  9. A closed firm's waiting alerts end, and none is queued for it afterwards.

-- 0. One more kind in the firm's record: Nevermore stopping a closing.
ALTER TABLE public.firm_activity DROP CONSTRAINT IF EXISTS firm_activity_kind_check;
ALTER TABLE public.firm_activity ADD CONSTRAINT firm_activity_kind_check CHECK (kind IN (
    -- sync:begin firm_activity_kinds
    'sign_in', 'submission_viewed', 'document_downloaded', 'packet_downloaded', 'send_recorded',
    'member_added', 'member_ended', 'owner_added', 'owner_ended',
    'export_made', 'invitation_sent', 'member_removed', 'support_access',
    'firm_signed_up', 'firm_approved', 'firm_refused', 'invitation_withdrawn',
    'member_suspended', 'member_restored',
    'firm_suspended', 'firm_restored',
    'member_left',
    'organisation_listed', 'organisation_removed', 'join_asked', 'join_declined',
    'closure_asked', 'closure_withdrawn', 'closure_stopped'
    -- sync:end firm_activity_kinds
  ));

-- 1. The record: who asked, withdrew or stopped is kept as an id when an account is deleted (the id alone is not content), so the
-- foreign keys that would erase it are dropped. A stop by Nevermore is a withdrawal with no person (every rule that asks "is the request
-- over" already reads withdrawn_at) that also says who at Nevermore and why: the platform's record, never shown to the firm (D-33).
ALTER TABLE public.firm_closures DROP CONSTRAINT firm_closures_asked_by_fkey;
ALTER TABLE public.firm_closures DROP CONSTRAINT firm_closures_withdrawn_by_fkey;
ALTER TABLE public.firm_closures ADD COLUMN stopped_by uuid;
ALTER TABLE public.firm_closures ADD COLUMN stop_reason text;
ALTER TABLE public.firm_closures ADD CONSTRAINT firm_closures_stop_is_whole CHECK (
  (stopped_by IS NULL) = (stop_reason IS NULL)
  AND (stopped_by IS NULL OR (withdrawn_at IS NOT NULL AND btrim(stop_reason) <> '' AND char_length(stop_reason) <= 500)));

CREATE FUNCTION public.firm_closing_grace() RETURNS interval LANGUAGE sql IMMUTABLE AS $$ SELECT interval '7 days' $$;
REVOKE ALL ON FUNCTION public.firm_closing_grace() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.firm_closing_grace() TO service_role;

-- 2. A released address is given a placeholder that is not an ordinary address: a dot, which no sign-up may contain (sign_up_firm now
-- refuses anything but an ordinary address itself). The check accepts it, and only it, beside the ordinary rule.
ALTER TABLE public.firms DROP CONSTRAINT firms_address_check;
ALTER TABLE public.firms ADD CONSTRAINT firms_address_check CHECK (
  (((char_length(address) >= 3) AND (char_length(address) <= 40))
   AND (address ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$')
   AND (address <> ALL (ARRAY['www', 'app', 'api', 'mail', 'admin', 'status', 'quotes']))
   AND (POSITION('nevermore' IN replace(address, '-', '')) = 0))
  OR address ~ '^x\.[0-9a-f]{32}$');

-- 3. What a member of a closing firm can't do with a storage object: the two firm-member policies on the manuscripts bucket, with every
-- condition they had and one more. The question answers about the caller's own firm only.
CREATE FUNCTION public.intake_folder_firm_read_only(p_folder text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.intake_folder_in_my_firm(p_folder)
     AND EXISTS (SELECT 1 FROM public.chamber_sessions s WHERE s.id::text = p_folder AND public.firm_is_read_only(s.firm_id))
$$;

REVOKE ALL ON FUNCTION public.intake_folder_firm_read_only(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.intake_folder_firm_read_only(text) TO authenticated;

DROP POLICY "Firm members can store generated manuscripts" ON storage.objects;
CREATE POLICY "Firm members can store generated manuscripts" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'manuscripts' AND public.intake_folder_in_my_firm((storage.foldername(name))[1])
              AND public.intake_accepts_files((storage.foldername(name))[1])
              AND NOT public.intake_folder_firm_read_only((storage.foldername(name))[1]));

DROP POLICY "Firm members can remove unrecorded manuscript uploads" ON storage.objects;
CREATE POLICY "Firm members can remove unrecorded manuscript uploads" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'manuscripts' AND public.intake_folder_in_my_firm((storage.foldername(name))[1])
         AND NOT EXISTS (SELECT 1 FROM public.manuscript_versions v WHERE v.storage_path = objects.name)
         AND NOT public.intake_folder_firm_read_only((storage.foldername(name))[1]));

-- 4. Alerts: a closed firm's alert is ended the moment it is queued (as a cancelled reminder is), so none waits for good.
CREATE FUNCTION public.end_alert_of_closed_firm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.outbox_kind_is_firm_alert(NEW.kind)
     AND public.firm_is_closed(COALESCE(NEW.firm_id, (SELECT cs.firm_id FROM public.chamber_sessions cs WHERE cs.id = NEW.session_id))) THEN
    NEW.status := 'suppressed';
    NEW.last_error := 'cancelled: the firm closed';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.end_alert_of_closed_firm() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER outbox_events_closed_firm BEFORE INSERT ON public.outbox_events
  FOR EACH ROW EXECUTE FUNCTION public.end_alert_of_closed_firm();

-- 5. What a member's banner and Settings need: when the firm closes (null when it is not closing), and whether an owner may ask to
-- close it (an owner of a firm that is not refused, not the default firm, and not already closing). The database tells the page, so the
-- default firm's id is not written twice. One row for a current member of the firm, none for anyone else.
DROP FUNCTION public.my_firm_closure(uuid);
CREATE FUNCTION public.my_firm_closure(p_firm_id uuid)
RETURNS TABLE (asked_at timestamptz, closes_at timestamptz, can_ask boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT c.asked_at, c.closes_at,
         (c.id IS NULL AND public.firm_role(p_firm_id) = 'owner' AND f.decision IS DISTINCT FROM 'refused' AND f.id <> public.default_firm_id())
  FROM public.firms f
  LEFT JOIN public.firm_closures c ON c.firm_id = f.id AND c.withdrawn_at IS NULL AND c.closed_at IS NULL
  WHERE f.id = p_firm_id AND public.firm_role(p_firm_id) IS NOT NULL
$$;

REVOKE ALL ON FUNCTION public.my_firm_closure(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_firm_closure(uuid) TO authenticated;

-- 6. Nevermore stops a closing. A platform admin who is not a member of the firm ends its open request with a reason, any time before
-- it closes, including while the firm is suspended (when its owners can't withdraw). It is recorded in the firm's record as Nevermore's
-- (D-33), in the platform's record with the reason, and the owners are emailed without the reason or the person. A platform admin still
-- can't ask to close a firm or withdraw for its owners.
CREATE FUNCTION public.admin_stop_firm_closure(p_firm_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  clean_reason text := btrim(COALESCE(p_reason, ''));
  c public.firm_closures;
  f public.firms;
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF clean_reason = '' OR char_length(clean_reason) > 500 THEN
    RAISE EXCEPTION 'Give a reason of 1 to 500 characters' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO f FROM public.firms x WHERE x.id = p_firm_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That firm does not exist' USING ERRCODE = 'PT404';
  END IF;
  IF public.admin_belongs_to_firm(p_firm_id) THEN
    RAISE EXCEPTION 'An admin does not stop the closing of a firm they belong to' USING ERRCODE = '42501';
  END IF;
  UPDATE public.firm_closures x
  SET withdrawn_at = now(), stopped_by = auth.uid(), stop_reason = clean_reason
  WHERE x.firm_id = p_firm_id AND x.withdrawn_at IS NULL AND x.closed_at IS NULL
  RETURNING * INTO c;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This firm is not waiting to close' USING ERRCODE = 'PT409';
  END IF;
  PERFORM public.firm_activity_append(p_firm_id, 'closure_stopped', 'firm', p_firm_id::text);
  INSERT INTO public.outbox_events (kind, firm_id, dedupe_key, payload)
  VALUES ('firm_closing', p_firm_id, 'firm_closing:stopped:' || c.id, jsonb_build_object('event', 'stopped', 'firm_name', f.name))
  ON CONFLICT (kind, dedupe_key) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_stop_firm_closure(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_stop_firm_closure(uuid, text) TO authenticated;

-- 7. The daily step: a suspended firm is left as the suspension leaves it, and a firm that fails to close is an ops event (a code and the
-- firm's id, no content) so one that fails every day shows on the monitoring page, not only in the database's log.
CREATE OR REPLACE FUNCTION public.close_due_firms()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  due record;
  closed integer := 0;
BEGIN
  FOR due IN
    SELECT x.firm_id FROM public.firm_closures x
    WHERE x.withdrawn_at IS NULL AND x.closed_at IS NULL AND x.closes_at <= now()
      AND NOT public.firm_is_suspended(x.firm_id)
    ORDER BY x.closes_at, x.id
  LOOP
    BEGIN
      PERFORM public.close_firm_now(due.firm_id);
      closed := closed + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'closing firm % failed (%): %', due.firm_id, SQLSTATE, SQLERRM;
      BEGIN
        -- The firm's id goes in the event's id column for intakes, which has no foreign key and is how an admin finds the firm: the
        -- monitoring page masks any long run of digits or letters in the detail, so an id written there would be unreadable.
        PERFORM public.record_ops_event('app_error', 'close-firms', 'firm_close_failed', 'could not close a firm', NULL, due.firm_id);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'closing firm %: the ops event could not be written (%)', due.firm_id, SQLSTATE;
      END;
    END;
  END LOOP;
  RETURN closed;
END;
$$;

-- 8. The latest definition of each function below, with the one change named at it.
CREATE OR REPLACE FUNCTION public.record_manuscript_version(p_session_id uuid, p_version integer, p_storage_path text, p_pdf_sha256 text, p_review_event_id bigint, p_corrections_applied integer, p_sensitive_revealed boolean, p_certified_data_hash text, p_certified_at timestamp with time zone)
 RETURNS manuscript_versions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s public.chamber_sessions;
  latest_event bigint;
  next_version integer;
  result public.manuscript_versions;
BEGIN
  -- Closing firms are read-only (CRM-P1.7): a member of one changes nothing, whatever other role they hold.
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.chamber_sessions zs WHERE zs.id = p_session_id));
  PERFORM public.require_advisor();
  PERFORM public.require_intake_in_my_firm(p_session_id, 'P0002');

  SELECT * INTO s FROM public.chamber_sessions WHERE id = p_session_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'P0002';
  END IF;
  IF s.status IS DISTINCT FROM 'submitted' OR s.submission IS NULL THEN
    RAISE EXCEPTION 'Only a certified intake can become a packet' USING ERRCODE = '23514';
  END IF;
  IF p_certified_data_hash IS DISTINCT FROM (s.submission ->> 'data_sha256')
     OR p_certified_at IS DISTINCT FROM (s.submission ->> 'certified_at')::timestamptz THEN
    RAISE EXCEPTION 'The prospect certified their intake again while this packet was being generated; generate it again'
      USING ERRCODE = 'PT409';
  END IF;
  IF p_storage_path IS NULL OR p_storage_path NOT LIKE p_session_id::text || '/%' THEN
    RAISE EXCEPTION 'The file must be stored under its submission' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'manuscripts' AND name = p_storage_path) THEN
    RAISE EXCEPTION 'The packet file was not uploaded' USING ERRCODE = '22023';
  END IF;

  -- One version number at a time per submission.
  PERFORM pg_advisory_xact_lock(hashtext('manuscript_versions:' || p_session_id::text));

  SELECT COALESCE(max(id), 0) INTO latest_event FROM public.advisor_review_events WHERE session_id = p_session_id;
  IF p_review_event_id IS DISTINCT FROM latest_event THEN
    RAISE EXCEPTION 'The review changed while this packet was being generated; generate it again'
      USING ERRCODE = 'PT409';
  END IF;
  SELECT COALESCE(max(version), 0) + 1 INTO next_version FROM public.manuscript_versions WHERE session_id = p_session_id;
  IF p_version IS DISTINCT FROM next_version THEN
    RAISE EXCEPTION 'Another version was generated meanwhile; generate it again' USING ERRCODE = 'PT409';
  END IF;

  INSERT INTO public.manuscript_versions
    (session_id, version, file_id, storage_path, pdf_sha256, certified_data_hash, certified_signed_at, certified_at,
     review_event_id, corrections_applied, sensitive_revealed, generated_by, generated_by_email)
  VALUES
    (p_session_id, next_version,
     COALESCE(NULLIF(s.submission ->> 'file_id', ''), 'EAA-' || upper(left(replace(p_session_id::text, '-', ''), 8))),
     p_storage_path, lower(p_pdf_sha256),
     COALESCE(s.submission ->> 'data_sha256', encode(sha256(convert_to(s.chamber_data::text, 'UTF8')), 'hex')),
     (s.submission ->> 'signed_at')::timestamptz,
     (s.submission ->> 'certified_at')::timestamptz,
     latest_event, GREATEST(COALESCE(p_corrections_applied, 0), 0), COALESCE(p_sensitive_revealed, false),
     auth.uid(), auth.jwt() ->> 'email')
  RETURNING * INTO result;
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.request_intake_deletion(p_session_id uuid, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  intake public.chamber_sessions;
  clean_reason constant text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  deletion_id uuid;
BEGIN
  -- Closing firms are read-only (CRM-P1.7): a member of one changes nothing, whatever other role they hold.
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.chamber_sessions zs WHERE zs.id = p_session_id));
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF clean_reason IS NULL OR length(clean_reason) > 500 THEN
    RAISE EXCEPTION 'A reason of 1 to 500 characters is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO intake FROM public.chamber_sessions WHERE id = p_session_id AND public.intake_in_my_firm(id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Intake not found' USING ERRCODE = 'PT404';
  END IF;

  INSERT INTO public.intake_deletions (session_id, user_id, trigger, reason, requested_by, requested_by_email)
  VALUES (intake.id, intake.user_id, 'request', clean_reason, auth.uid(), auth.jwt() ->> 'email')
  ON CONFLICT (session_id) WHERE status <> 'done' DO NOTHING
  RETURNING id INTO deletion_id;

  IF deletion_id IS NULL THEN
    SELECT d.id INTO deletion_id FROM public.intake_deletions d WHERE d.session_id = intake.id AND d.status <> 'done';
  END IF;
  RETURN deletion_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_chamber_session(p_session_id uuid, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  intake public.chamber_sessions;
  clean_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
BEGIN
  -- Closing firms are read-only (CRM-P1.7): a member of one changes nothing, whatever other role they hold.
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.chamber_sessions zs WHERE zs.id = p_session_id));
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF clean_reason IS NULL OR length(clean_reason) > 2000 THEN
    RAISE EXCEPTION 'A reason of 1 to 2000 characters is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO intake FROM public.chamber_sessions WHERE id = p_session_id AND public.intake_in_my_firm(id) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Intake not found' USING ERRCODE = 'PT404';
  END IF;
  IF intake.status = 'revoked' THEN
    RETURN 'revoked';
  END IF;
  IF intake.status NOT IN ('in_progress', 'expired')
     OR EXISTS (SELECT 1 FROM public.chamber_certifications c WHERE c.session_id = intake.id) THEN
    RAISE EXCEPTION 'Only a draft that was never certified can be revoked (this intake is %)', intake.status
      USING ERRCODE = '55000';
  END IF;

  UPDATE public.chamber_sessions SET status = 'revoked' WHERE id = intake.id;
  INSERT INTO public.intake_lifecycle_events (session_id, user_id, from_status, to_status, reason, actor_id, actor_email)
  VALUES (intake.id, intake.user_id, intake.status, 'revoked', clean_reason, auth.uid(), auth.jwt() ->> 'email');
  RETURN 'revoked';
END;
$function$;

CREATE OR REPLACE FUNCTION public.retry_intake_deletion(p_deletion_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Closing firms are read-only (CRM-P1.7): a member of one changes nothing, whatever other role they hold.
  PERFORM public.assert_firm_writable((SELECT zd.firm_id FROM public.intake_deletions zd WHERE zd.id = p_deletion_id));
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.intake_deletions
  SET status = 'pending', attempts = 0, next_attempt_at = now(), locked_until = NULL
  WHERE id = p_deletion_id AND status = 'failed' AND public.is_firm_member(firm_id);
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.request_firm_closure(p_firm_id uuid, p_firm_name text)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  f public.firms;
  c public.firm_closures;
BEGIN
  IF public.firm_role(p_firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can do that' USING ERRCODE = '42501';
  END IF;
    SELECT * INTO f FROM public.firms x WHERE x.id = p_firm_id;
  IF NOT FOUND OR f.decision = 'refused' THEN
    RAISE EXCEPTION 'Only an owner of the firm can do that' USING ERRCODE = '42501';
  END IF;
  -- The default firm takes the intakes people start on Nevermore (D-101): closing it would send every later intake to a firm nobody
  -- reads. It can't be closed until an intake can belong to another firm (D-121; New quote revisits this).
  IF p_firm_id = public.default_firm_id() THEN
    RAISE EXCEPTION 'This firm takes the intakes people start on Nevermore, so it can''t be closed' USING ERRCODE = 'PT403';
  END IF;
  IF lower(btrim(COALESCE(p_firm_name, ''))) <> lower(btrim(f.name)) THEN
    RAISE EXCEPTION 'Type the firm''s name exactly to confirm' USING ERRCODE = '22023';
  END IF;
  BEGIN
    INSERT INTO public.firm_closures (firm_id, asked_by, closes_at)
    VALUES (p_firm_id, auth.uid(), now() + public.firm_closing_period())
    RETURNING * INTO c;
  EXCEPTION WHEN unique_violation THEN
    -- The unique index firm_closures_one_open is the rule (D-29); this only gives its usual message.
    RAISE EXCEPTION 'This firm is already closing' USING ERRCODE = 'PT409';
  END;
  PERFORM public.firm_activity_append(p_firm_id, 'closure_asked', 'firm', p_firm_id::text);
  INSERT INTO public.outbox_events (kind, firm_id, dedupe_key, payload)
  SELECT 'firm_closing', p_firm_id, 'firm_closing:asked:' || c.id,
         jsonb_build_object('event', 'asked', 'by_email', lower(btrim(u.email)), 'firm_name', f.name,
                            'closes_at', to_char(c.closes_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
  FROM auth.users u WHERE u.id = auth.uid()
  ON CONFLICT (kind, dedupe_key) DO NOTHING;
  RETURN c.closes_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.withdraw_firm_closure(p_firm_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  f public.firms;
  c public.firm_closures;
BEGIN
  IF public.firm_role(p_firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can do that' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO f FROM public.firms x WHERE x.id = p_firm_id;
  -- One statement closes the open row: two withdrawals at once see the second find nothing, and a firm the job is closing is not
  -- withdrawn from under it.
  UPDATE public.firm_closures x SET withdrawn_at = now(), withdrawn_by = auth.uid()
  WHERE x.firm_id = p_firm_id AND x.withdrawn_at IS NULL AND x.closed_at IS NULL AND x.closes_at > now()
  RETURNING * INTO c;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This firm is not waiting to close' USING ERRCODE = 'PT409';
  END IF;
  PERFORM public.firm_activity_append(p_firm_id, 'closure_withdrawn', 'firm', p_firm_id::text);
  INSERT INTO public.outbox_events (kind, firm_id, dedupe_key, payload)
  SELECT 'firm_closing', p_firm_id, 'firm_closing:withdrawn:' || c.id,
         jsonb_build_object('event', 'withdrawn', 'by_email', lower(btrim(u.email)), 'firm_name', f.name)
  FROM auth.users u WHERE u.id = auth.uid()
  ON CONFLICT (kind, dedupe_key) DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public.close_firm_now(p_firm_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  c public.firm_closures;
  step record;
  m record;
  counts jsonb := '{}'::jsonb;
  n integer;
  ended integer := 0;
  boxes_before integer;
  boxes_after integer;
BEGIN
  PERFORM 1 FROM public.firms f WHERE f.id = p_firm_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That firm does not exist' USING ERRCODE = 'PT404';
  END IF;
  -- Never the default firm, whatever a request row says (D-121).
  IF p_firm_id = public.default_firm_id() THEN
    RAISE EXCEPTION 'This firm takes the intakes people start on Nevermore, so it can''t be closed' USING ERRCODE = 'PT403';
  END IF;
  SELECT * INTO c FROM public.firm_closures x WHERE x.firm_id = p_firm_id AND x.withdrawn_at IS NULL AND x.closed_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That firm has no request to close' USING ERRCODE = 'PT404';
  END IF;
  IF c.closes_at > now() THEN
    RAISE EXCEPTION 'The 30 days have not ended' USING ERRCODE = '55000';
  END IF;
  -- A suspended firm is not closed: the request stays open and the firm stays as the suspension leaves it.
  IF public.firm_is_suspended(p_firm_id) THEN
    RAISE EXCEPTION 'A suspended firm is not closed' USING ERRCODE = '55000';
  END IF;
  PERFORM set_config('nevermore.closing_firm', p_firm_id::text, true);

  SELECT count(*) INTO boxes_before FROM public.broker_mailboxes b
  WHERE b.user_id IN (SELECT x.user_id FROM public.firm_memberships x WHERE x.firm_id = p_firm_id);

  UPDATE public.firm_memberships x SET team_id = NULL WHERE x.firm_id = p_firm_id AND x.team_id IS NOT NULL;
  UPDATE public.firm_member_suspensions x SET team_id = NULL WHERE x.firm_id = p_firm_id AND x.team_id IS NOT NULL;

  FOR step IN SELECT p.src, p.firm_column FROM public.firm_closing_plan() p WHERE p.action = 'delete' ORDER BY p.ord, p.src LOOP
    EXECUTE format('DELETE FROM public.%I WHERE %I = $1', substr(step.src, length('public.') + 1), step.firm_column) USING p_firm_id;
    GET DIAGNOSTICS n = ROW_COUNT;
    counts := counts || jsonb_build_object(substr(step.src, length('public.') + 1), n);
  END LOOP;

  -- Every member's access ends. The ending is the one every other path uses (end_membership_now); the last owner's rule is waived
  -- for this firm and this moment only (keep_firm_owner).
  FOR m IN
    SELECT x.id, x.valid_from, public.membership_is_current(x.valid_from, x.valid_until) AS is_current
    FROM public.firm_memberships x
    WHERE x.firm_id = p_firm_id AND (x.valid_until IS NULL OR x.valid_until > now())
    ORDER BY x.id
  LOOP
    IF m.is_current THEN
      PERFORM public.end_membership_now(m.id, 'The last owner of a firm can''t be removed');
    ELSE
      PERFORM set_config('nevermore.membership_change', 'on', true);
      UPDATE public.firm_memberships x SET valid_until = x.valid_from WHERE x.id = m.id;
      PERFORM set_config('nevermore.membership_change', 'off', true);
    END IF;
    ended := ended + 1;
  END LOOP;
  counts := counts || jsonb_build_object('memberships_ended', ended);

  UPDATE public.firm_member_suspensions x SET ended_at = now(), ended_how = 'removed' WHERE x.firm_id = p_firm_id AND x.ended_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  counts := counts || jsonb_build_object('member_suspensions_ended', n);

  SELECT count(*) INTO boxes_after FROM public.broker_mailboxes b
  WHERE b.user_id IN (SELECT x.user_id FROM public.firm_memberships x WHERE x.firm_id = p_firm_id);
  counts := counts || jsonb_build_object('broker_mailboxes', boxes_before - boxes_after);

  -- The firm's alerts that are still waiting have no one to go to: they end, as a cancelled reminder does, so nothing waits for good.
  UPDATE public.outbox_events e
  SET status = 'suppressed', last_error = 'cancelled: the firm closed', claimed_at = NULL, locked_until = NULL, pending_send = NULL
  WHERE e.status IN ('pending', 'claimed') AND public.outbox_kind_is_firm_alert(e.kind)
    AND COALESCE(e.firm_id, (SELECT cs.firm_id FROM public.chamber_sessions cs WHERE cs.id = e.session_id)) = p_firm_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  counts := counts || jsonb_build_object('alerts_cancelled', n);

  UPDATE public.firm_closures x
  SET closed_at = now(), deleted_counts = counts, address = (SELECT f.address FROM public.firms f WHERE f.id = p_firm_id)
  WHERE x.id = c.id;
  PERFORM set_config('nevermore.closing_firm', '', true);
  RETURN counts;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_lift_firm_suspension(p_firm_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  lifted integer;
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.firms f WHERE f.id = p_firm_id) THEN
    RAISE EXCEPTION 'That firm does not exist' USING ERRCODE = 'PT404';
  END IF;
  IF public.admin_belongs_to_firm(p_firm_id) THEN
    RAISE EXCEPTION 'An admin does not lift the suspension of a firm they belong to' USING ERRCODE = '42501';
  END IF;
  -- Closing the open row is one statement: two lifts at once see the second find nothing to close.
  UPDATE public.firm_suspensions s SET lifted_at = now(), lifted_by = auth.uid() WHERE s.firm_id = p_firm_id AND s.lifted_at IS NULL;
  GET DIAGNOSTICS lifted = ROW_COUNT;
  IF lifted = 0 THEN
    RAISE EXCEPTION 'That firm is not suspended' USING ERRCODE = 'PT409';
  END IF;
  -- A request to close that waited out the suspension is not decided the moment it is lifted: its owners get seven days, at least, to
  -- withdraw it, and the date they are shown is the later one.
  UPDATE public.firm_closures x SET closes_at = greatest(x.closes_at, now() + public.firm_closing_grace())
  WHERE x.firm_id = p_firm_id AND x.withdrawn_at IS NULL AND x.closed_at IS NULL;
  PERFORM public.record_firm_event(p_firm_id, 'firm_restored', auth.uid(), '{}'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_suspend_firm(p_firm_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  clean_reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF clean_reason = '' OR char_length(clean_reason) > 500 THEN
    RAISE EXCEPTION 'Give a reason of 1 to 500 characters' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.firms f WHERE f.id = p_firm_id) THEN
    RAISE EXCEPTION 'That firm does not exist' USING ERRCODE = 'PT404';
  END IF;
  IF public.firm_is_closed(p_firm_id) THEN
    RAISE EXCEPTION 'That firm is closed' USING ERRCODE = '55000';
  END IF;
  -- An admin does not act on a firm they belong to (as when deciding on one).
  IF public.admin_belongs_to_firm(p_firm_id) THEN
    RAISE EXCEPTION 'An admin does not suspend a firm they belong to' USING ERRCODE = '42501';
  END IF;
  BEGIN
    INSERT INTO public.firm_suspensions (firm_id, suspended_by, reason) VALUES (p_firm_id, auth.uid(), clean_reason);
  EXCEPTION WHEN unique_violation THEN
    -- The unique index firm_suspensions_one_open is the rule (D-29); this only gives its usual message.
    RAISE EXCEPTION 'That firm is suspended already' USING ERRCODE = 'PT409';
  END;
  PERFORM public.record_firm_event(p_firm_id, 'firm_suspended', auth.uid(), '{}'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_decide_firm(p_firm_id uuid, p_approve boolean, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  f public.firms;
  note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_approve IS NULL THEN
    RAISE EXCEPTION 'Approve the firm or refuse it' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO f FROM public.firms WHERE id = p_firm_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That firm does not exist' USING ERRCODE = 'PT404';
  END IF;
  IF public.firm_is_closed(p_firm_id) THEN
    RAISE EXCEPTION 'That firm is closed' USING ERRCODE = '55000';
  END IF;
  -- An admin does not decide on a firm they belong to.
  IF EXISTS (SELECT 1 FROM public.current_member_firm_ids() c WHERE c.firm_id = p_firm_id) THEN
    RAISE EXCEPTION 'An admin does not decide on a firm they belong to' USING ERRCODE = '42501';
  END IF;
  IF f.approved_at IS NOT NULL OR f.decision IS NOT NULL THEN
    RAISE EXCEPTION 'That firm has been decided already' USING ERRCODE = '55000';
  END IF;
  UPDATE public.firms
  SET approved_at = CASE WHEN p_approve THEN now() END,
      decision = CASE WHEN p_approve THEN 'approved' ELSE 'refused' END,
      decided_at = now(), decided_by = auth.uid(), decision_note = note
  WHERE id = p_firm_id;
  PERFORM public.record_firm_event(p_firm_id, CASE WHEN p_approve THEN 'firm_approved' ELSE 'firm_refused' END,
                                   auth.uid(), jsonb_build_object('address', f.address, 'note', note));
END;
$function$;

CREATE OR REPLACE FUNCTION public.sign_up_firm(p_name text, p_address text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  fid uuid;
  clean_name text := btrim(COALESCE(p_name, ''));
  violated text;
BEGIN
  -- A signed-in person, not a guest, whose email the provider or the confirmation link has verified. Anyone else
  -- gets the same refusal, so the call tells nothing about which accounts exist.
  IF NOT public.is_signed_in_person() OR NOT EXISTS (
       SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'Sign in with a verified email to sign up a firm' USING ERRCODE = '42501';
  END IF;
  IF char_length(clean_name) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'A firm''s name is 1 to 80 characters' USING ERRCODE = '23514';
  END IF;
  -- One firm waiting at a time per person (D-30): nobody can hold addresses they have no use for, or fill the admin's
  -- list. The unique index firms_one_waiting_per_signer is the rule; this check only gives the usual message early.
  IF EXISTS (SELECT 1 FROM public.firms f WHERE f.signed_up_by = auth.uid() AND f.decision IS NULL) THEN
    RAISE EXCEPTION 'You already have a firm waiting for approval' USING ERRCODE = 'PT409';
  END IF;
  -- Only an ordinary address can be asked for. The placeholder a released address is given below is not one, so no sign-up can ever
  -- take it, and releasing an address can never collide with a new firm.
  IF lower(btrim(COALESCE(p_address, ''))) !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' THEN
    RAISE EXCEPTION 'new row for relation "firms" violates check constraint "firms_address_check"'
      USING ERRCODE = '23514', SCHEMA = 'public', TABLE = 'firms', CONSTRAINT = 'firms_address_check';
  END IF;
  -- A closed firm's address is held for twelve months from the day it closed (CRM-P1.7). After that it is free: the old row is kept (its
  -- record stays) and gives the address up, so the new firm can take it. Inside the twelve months nothing changes and the insert below
  -- is refused as for any taken address.
  UPDATE public.firms f
  SET address = 'x.' || replace(f.id::text, '-', '')
  WHERE f.address = lower(btrim(COALESCE(p_address, '')))
    AND EXISTS (SELECT 1 FROM public.firm_closures c WHERE c.firm_id = f.id AND c.closed_at IS NOT NULL AND c.closed_at + public.firm_address_hold() <= now());
  BEGIN
    INSERT INTO public.firms (name, address, signed_up_by) VALUES (clean_name, lower(btrim(p_address)), auth.uid()) RETURNING id INTO fid;
  EXCEPTION WHEN unique_violation THEN
    -- Two sign-ups from one person at the same moment both pass the check; the index refuses the second, which sees
    -- the same message as the check gives. Any other unique violation (a taken address) stays as it is.
    GET STACKED DIAGNOSTICS violated = CONSTRAINT_NAME;
    IF violated = 'firms_one_waiting_per_signer' THEN
      RAISE EXCEPTION 'You already have a firm waiting for approval' USING ERRCODE = 'PT409';
    END IF;
    RAISE;
  END;
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (fid, auth.uid(), 'owner');
  PERFORM public.record_firm_event(fid, 'firm_signed_up', auth.uid(), jsonb_build_object('address', lower(btrim(p_address))));
  RETURN fid;
END;
$function$;
