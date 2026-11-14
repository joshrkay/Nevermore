-- Help from Nevermore (story CRM-P2.4; docs/BROKER_CRM_BUILD.md D-16, D-18, D-19, D-24, D-29, D-33, D-40, D-104, D-115, D-122; ADR 0024).
--
-- A platform admin is no member of any firm and reads none of their data (D-16). This is the one doorway, and it is narrow: the admin
-- gives a reason, and for ONE HOUR (the database's clock) can open that firm's workspace at the firm's address and READ what a
-- member can read. They can change nothing, export nothing, send nothing and open no file link. The firm's owners see each use in
-- the firm's record as "Nevermore", with the reason; the admin's own name is kept in a platform table only (D-33).
--
-- How the database knows. The role a membership helper reports (firm_role) gains one more value, 'support', for a caller who has an
-- open, unexpired support session for that firm AND whose request names that firm's address AND who is a signed-in platform admin
-- who has done their second factor. Nothing that checks for a role by name ('owner', 'lead', 'agent') lets 'support' through, so
-- every owner-only action stays closed to it without being touched. What does let it through is everything that only asks "is a
-- member" (is_firm_member: firm_role IS NOT NULL): the reads. The writes among those are refused in the one place they share
-- (assert_firm_writable, the notes trigger, the storage helper), which now also refuses a support session. supabase/tests/
-- help_from_nevermore.sql classifies every function and policy that asks a membership helper.
--
--   1. support_sessions            the platform's record: who, which firm, why, when it started and ended. Closed to the API.
--   2. is_support_session,         the one question "does the caller have an open support session for this firm", asked by every
--      support_reads_firm,         refusal; and the stricter one that grants the read side.
--      refuse_support_session
--   3. firm_role                   restated from 20261117160000 with every rule it has, plus 'support'.
--   4. assert_firm_writable        restated from 20261118111000 with every rule and lock it has, plus the refusal of a support session.
--   5. intake_folder_in_my_firm    a support session opens no file (a download leaves the product and the hour).
--      and the PEO mail storage policy
--   6. what support reads in addition to a member: members (firm_members) and the record (can_read_firm_activity), as an owner does.
--   7. record_member_activity and advisor_open_quote_request_thread: the two "reads" that write; refused / skipped for support.
--   8. starting, ending and listing sessions; the firm's owners read each use without who.
--   9. the activity record's two new kinds of record, the ops event kind, the closing list, the daily job.

-- 1. The platform's record. Its own firm_id, closed to the API, no foreign key on who (D-116): deleting an account neither erases nor
-- blocks the record. admin_email is the platform's own record of who: it is never returned by a function the firm can call.
CREATE TABLE public.support_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id     uuid NOT NULL REFERENCES public.firms (id),
  admin_id    uuid NOT NULL,
  admin_email text NOT NULL,
  reason      text NOT NULL,
  started_at  timestamptz NOT NULL DEFAULT now(),
  ends_at     timestamptz NOT NULL,
  ended_at    timestamptz,
  ended_how   text,
  CONSTRAINT support_sessions_reason_check CHECK (btrim(reason) <> '' AND char_length(reason) <= 500),
  CONSTRAINT support_sessions_one_hour CHECK (ends_at = started_at + interval '1 hour'),
  CONSTRAINT support_sessions_ended_whole CHECK ((ended_at IS NULL) = (ended_how IS NULL) AND (ended_how IS NULL OR ended_how IN ('ended', 'ran_out', 'firm_ended'))),
  CONSTRAINT support_sessions_ended_after_start CHECK (ended_at IS NULL OR ended_at >= started_at)
);
-- One open session per admin per firm is a constraint, not a lock (D-29). "Open" is "not yet recorded as ended": a session that has run
-- out is recorded as ended the next time it is seen (starting another, ending, the Firms page, the firm's address) or by the daily job.
CREATE UNIQUE INDEX support_sessions_one_open ON public.support_sessions (admin_id, firm_id) WHERE ended_at IS NULL;
CREATE INDEX support_sessions_firm_idx ON public.support_sessions (firm_id, started_at DESC);
ALTER TABLE public.support_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_sessions FROM PUBLIC, anon, authenticated;

-- 2. The questions. is_support_session is asked by every refusal, so it is as wide as it can safely be: the caller has an open,
-- unexpired session for the firm, whatever address the request names and whatever else is true of them. Refusing too much is harmless
-- (the caller is a platform admin with no membership), refusing too little would not be.
CREATE FUNCTION public.is_support_session(p_firm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_firm_id IS NOT NULL AND auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.support_sessions s
    WHERE s.firm_id = p_firm_id AND s.admin_id = auth.uid() AND s.ended_at IS NULL AND s.ends_at > now())
$$;

-- What grants the read side is stricter: a signed-in platform admin past their second factor (D-19), whose request names this firm's
-- address (so the bare domain gives nothing, D-40), at a firm that is not refused and not closed. A suspended firm is allowed: that is
-- when it needs looking at, and it is reads only.
CREATE FUNCTION public.support_reads_firm(p_firm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_support_session(p_firm_id)
    AND public.has_role('admin')
    AND EXISTS (
      SELECT 1 FROM public.firms f
      WHERE f.id = p_firm_id
        AND f.address = lower(btrim((COALESCE(NULLIF(current_setting('request.headers', true), ''), '{}')::jsonb) ->> 'x-firm-address'))
        AND f.decision IS DISTINCT FROM 'refused'
        AND NOT public.firm_is_closed(f.id))
$$;

-- The refusal a function that exports or sends calls first. CRM-S3.8b's export function must call it (supabase/tests/
-- help_from_nevermore.sql fails on an export_ function that does not).
CREATE FUNCTION public.refuse_support_session(p_firm_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.is_support_session(p_firm_id) THEN
    RAISE EXCEPTION 'Nevermore support can look, not change' USING ERRCODE = 'PT423';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.is_support_session(uuid), public.support_reads_firm(uuid), public.refuse_support_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_support_session(uuid), public.support_reads_firm(uuid), public.refuse_support_session(uuid) TO authenticated;

-- 3. A member's role in a firm (20261117160000): at this address's firm only, not while the firm is suspended, past the second factor.
-- Unchanged for a member. A caller with no membership of the firm who has an open support session for it is 'support'.
CREATE OR REPLACE FUNCTION public.firm_role(p_firm_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT m.role
     FROM public.firm_memberships m
     WHERE auth.uid() IS NOT NULL
       AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
       AND public.second_factor_rule_met()
       AND m.firm_id = p_firm_id
       AND m.user_id = auth.uid()
       AND public.membership_is_current(m.valid_from, m.valid_until)
       AND public.address_admits_firm(p_firm_id)
       AND NOT public.firm_is_suspended(p_firm_id)),
    CASE WHEN public.support_reads_firm(p_firm_id) THEN 'support' END)
$$;

-- 4. The one guard every write path shares (20261118111000), with every rule and lock it had. A support session is refused first, with its
-- own message; for everyone else it reads exactly as before.
CREATE OR REPLACE FUNCTION public.assert_firm_writable(p_firm_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_firm_id IS NOT NULL AND public.is_support_session(p_firm_id) THEN
    RAISE EXCEPTION 'Nevermore support can look, not change' USING ERRCODE = 'PT423';
  END IF;
  IF p_firm_id IS NOT NULL AND public.admin_belongs_to_firm(p_firm_id) THEN
    PERFORM 1 FROM public.firms f WHERE f.id = p_firm_id FOR KEY SHARE;
    IF public.firm_is_read_only(p_firm_id) THEN
      RAISE EXCEPTION 'This firm is closing and can''t be changed' USING ERRCODE = 'PT423';
    END IF;
  END IF;
END;
$$;

-- 5. Files. Support reads what a member reads, but a downloaded file leaves the product and the hour, so a support session opens no
-- file link: the storage policies for documents and manuscripts ask this (and it is what the two manuscript write policies ask too).
CREATE OR REPLACE FUNCTION public.intake_folder_in_my_firm(p_folder text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_folder ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.intake_in_my_firm(p_folder::uuid)
    AND NOT EXISTS (SELECT 1 FROM public.chamber_sessions s WHERE s.id = p_folder::uuid AND public.is_support_session(s.firm_id))
$$;

-- A PEO's attachments (20261116200000): the message rows are read, the files are not.
DROP POLICY "Firm members can read PEO mail attachments" ON storage.objects;
CREATE POLICY "Firm members can read PEO mail attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'peo-mail'
    AND EXISTS (
      SELECT 1
      FROM public.quote_request_message_attachments a
      JOIN public.quote_request_messages m ON m.id = a.message_id
      WHERE a.storage_bucket = 'peo-mail' AND a.storage_path = objects.name AND a.status = 'stored'
        AND public.can_read_peo_mail(m.quote_request_id, m.firm_id)
        AND NOT public.is_support_session(m.firm_id)
    )
  );

-- 6. What support reads beyond what any member does: who is in the firm and the firm's record of who did what, as an owner does.
-- Not the invitations, the requests to join or the listed organisations (people who are not members yet), and no secret: a mailbox's
-- token is read only by the mailbox function for a member in good standing, and an invitation's token is never kept, only its hash.
CREATE OR REPLACE FUNCTION public.can_read_firm_activity(p_firm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(public.firm_role(p_firm_id) IN ('owner', 'support'), false) AND public.second_factor_rule_met()
$$;

CREATE OR REPLACE FUNCTION public.firm_members(p_firm_id uuid)
RETURNS TABLE (user_id uuid, email text, role text, state text, since timestamptz, is_you boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF COALESCE(public.firm_role(p_firm_id), '') NOT IN ('owner', 'support') THEN
    RAISE EXCEPTION 'Only an owner of the firm can do that' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT l.user_id, u.email::text, l.role, l.state, l.since, l.user_id = auth.uid()
  FROM (
    SELECT m.user_id, m.role, 'current'::text AS state, m.valid_from AS since
    FROM public.firm_memberships m
    WHERE m.firm_id = p_firm_id AND public.membership_is_current(m.valid_from, m.valid_until)
    UNION ALL
    SELECT s.user_id, s.role, 'suspended', s.suspended_at
    FROM public.firm_member_suspensions s
    WHERE s.firm_id = p_firm_id AND s.ended_at IS NULL
  ) l
  JOIN auth.users u ON u.id = l.user_id
  ORDER BY CASE l.role WHEN 'owner' THEN 0 WHEN 'lead' THEN 1 ELSE 2 END, lower(u.email), l.user_id;
END;
$$;

-- 7. Two functions that look like reads and write. A browser reports a download or a sign-in to the firm's record as the person
-- who did it (20261116160001): a support session has done neither, and writes nothing there on its own word. Everything else this
-- function does is as it was.
CREATE OR REPLACE FUNCTION public.record_member_activity(p_kind text, p_record_type text, p_record_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r record;
BEGIN
  IF NOT public.is_signed_in_person() OR NOT public.second_factor_rule_met() THEN
    RAISE EXCEPTION 'Sign in to continue' USING ERRCODE = '42501';
  END IF;
  IF (p_kind, p_record_type) NOT IN (
       -- sync:begin firm_activity_browser_pairs
       ('document_downloaded', 'document'),
       ('document_downloaded', 'submission'), ('document_downloaded', 'quote_request'), ('packet_downloaded', 'manuscript'),
       ('sign_in', 'firm')
       -- sync:end firm_activity_browser_pairs
       ) THEN
    RAISE EXCEPTION 'A browser can''t record that' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.firm_activity_resolve(p_record_type, p_record_id);
  IF NOT FOUND OR NOT public.is_firm_member(r.firm_id) THEN
    RAISE EXCEPTION 'You are not a member of that record''s firm' USING ERRCODE = '42501';
  END IF;
  PERFORM public.refuse_support_session(r.firm_id);
  PERFORM public.firm_activity_append_once(auth.uid(), r.firm_id, p_kind, p_record_type, r.canonical_id);
END;
$$;

-- Opening a thread marks it read, with the opener's email, in a table the firm's members read. A support session marks nothing (that
-- would show a member the admin's email, D-33, and change the firm's "new mail" marks); it reads the thread all the same.
CREATE OR REPLACE FUNCTION public.advisor_open_quote_request_thread(p_quote_request_id bigint, p_seen_through timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  seen timestamptz := LEAST(COALESCE(p_seen_through, now()), now());
  r public.quote_request_thread_reads;
BEGIN
  PERFORM public.require_advisor();
  IF NOT EXISTS (SELECT 1 FROM public.quote_requests WHERE id = p_quote_request_id AND public.quote_request_in_my_firm(id)) THEN
    RAISE EXCEPTION 'Quote request not found' USING ERRCODE = 'PT404';
  END IF;
  IF EXISTS (SELECT 1 FROM public.quote_requests q JOIN public.chamber_sessions s ON s.id = q.session_id
             WHERE q.id = p_quote_request_id AND public.is_support_session(s.firm_id)) THEN
    RETURN '{}'::jsonb;
  END IF;
  INSERT INTO public.quote_request_thread_reads AS t (quote_request_id, last_opened_at, last_opened_by, last_opened_by_email)
  VALUES (p_quote_request_id, seen, auth.uid(), auth.jwt() ->> 'email')
  ON CONFLICT (quote_request_id) DO UPDATE
    SET last_opened_at = GREATEST(t.last_opened_at, EXCLUDED.last_opened_at),
        last_opened_by = CASE WHEN EXCLUDED.last_opened_at > t.last_opened_at THEN EXCLUDED.last_opened_by ELSE t.last_opened_by END,
        last_opened_by_email = CASE WHEN EXCLUDED.last_opened_at > t.last_opened_at THEN EXCLUDED.last_opened_by_email ELSE t.last_opened_by_email END
  RETURNING * INTO r;
  RETURN to_jsonb(r);
END;
$$;

-- 8. The record's two new kinds of record: a use of support and the end of one. The entry's record_id is the session's id.
ALTER TABLE public.firm_activity DROP CONSTRAINT firm_activity_record_check;
ALTER TABLE public.firm_activity ADD CONSTRAINT firm_activity_record_check CHECK (
  record_type IN (
    -- sync:begin firm_activity_record_types
    'submission', 'document', 'manuscript', 'quote_request', 'membership', 'firm', 'support_session', 'support_session_end'
    -- sync:end firm_activity_record_types
  )
  AND record_id ~ '^[A-Za-z0-9_-]{1,64}$');

-- The monitoring table gains one kind, so the platform sees every use in one place. It has no alert rule: a use is not a failure.
ALTER TABLE public.ops_events DROP CONSTRAINT IF EXISTS ops_events_kind_check;
ALTER TABLE public.ops_events ADD CONSTRAINT ops_events_kind_check CHECK (kind IN (
  'app_error', 'upload_failed', 'ai_failed', 'auth_denied', 'deletion_failed', 'voice_failed', 'malware_detected', 'scan_failed',
  'held_mail', 'support_access'
));

-- One entry in the firm's record, written as Nevermore's whatever the admin is by then (D-33: stamped true here, because the admin may
-- have lost their role by the time a session that ran out is recorded). The real actor is kept for the platform's own record.
CREATE FUNCTION public.support_activity_append(p_firm_id uuid, p_admin uuid, p_kind_of_record text, p_session uuid, p_at timestamptz)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.firm_activity (firm_id, at, actor_id, actor_is_staff, kind, record_type, record_id)
  VALUES (p_firm_id, p_at, p_admin, true, 'support_access', p_kind_of_record, p_session::text)
$$;
REVOKE ALL ON FUNCTION public.support_activity_append(uuid, uuid, text, uuid, timestamptz) FROM PUBLIC, anon, authenticated;

-- Records the end of every session that is over: ran out, or its firm was closed or refused since (it stopped working then). Sessions
-- are recorded as ended when next seen or by the daily job, never by a timer of their own: what stops a session is the clock in
-- is_support_session, so a session nobody has looked at stops working all the same. With an admin, only theirs.
CREATE FUNCTION public.settle_support_sessions(p_admin uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r record;
  n integer := 0;
  ended timestamptz;
  how text;
BEGIN
  FOR r IN
    SELECT s.id, s.firm_id, s.admin_id, s.started_at, s.ends_at, k.closed_at, f.decision
    FROM public.support_sessions s
    JOIN public.firms f ON f.id = s.firm_id
    LEFT JOIN public.firm_closures k ON k.firm_id = s.firm_id AND k.closed_at IS NOT NULL
    WHERE s.ended_at IS NULL AND (p_admin IS NULL OR s.admin_id = p_admin)
      AND (s.ends_at <= now() OR k.id IS NOT NULL OR f.decision = 'refused')
  LOOP
    how := CASE WHEN r.ends_at <= now() AND (r.closed_at IS NULL OR r.closed_at >= r.ends_at) THEN 'ran_out' ELSE 'firm_ended' END;
    ended := GREATEST(r.started_at, LEAST(r.ends_at, COALESCE(r.closed_at, now())));
    -- The row's own update decides who records it: a second caller finds it ended and writes nothing.
    UPDATE public.support_sessions SET ended_at = ended, ended_how = how WHERE id = r.id AND ended_at IS NULL;
    IF FOUND THEN
      PERFORM public.support_activity_append(r.firm_id, r.admin_id, 'support_session_end', r.id, ended);
      n := n + 1;
    END IF;
  END LOOP;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.settle_support_sessions(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_support_sessions(uuid) TO service_role;

-- Starts a session: the firm's owners will read the reason. Platform admins only, past their second factor; not for a firm they belong
-- to, nor a refused or closed one. A waiting or suspended firm is allowed.
CREATE FUNCTION public.start_support_session(p_firm_id uuid, p_reason text)
RETURNS TABLE (session_id uuid, firm_name text, firm_address text, ends_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  clean_reason text := btrim(COALESCE(p_reason, ''));
  f public.firms;
  s public.support_sessions;
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
  IF f.decision = 'refused' OR public.firm_is_closed(f.id) THEN
    RAISE EXCEPTION 'That firm is refused or closed, so there is nothing to look at' USING ERRCODE = '55000';
  END IF;
  -- An admin who belongs to a firm needs no doorway to it, and one who held both would be a member and support at once.
  IF public.admin_belongs_to_firm(f.id) THEN
    RAISE EXCEPTION 'An admin does not use support access on a firm they belong to' USING ERRCODE = '42501';
  END IF;
  -- A session of theirs that ran out and was never recorded would block the new one: record it first.
  PERFORM public.settle_support_sessions(auth.uid());
  BEGIN
    INSERT INTO public.support_sessions (firm_id, admin_id, admin_email, reason, ends_at)
    VALUES (f.id, auth.uid(), COALESCE(auth.jwt() ->> 'email', ''), clean_reason, now() + interval '1 hour')
    RETURNING * INTO s;
  EXCEPTION WHEN unique_violation THEN
    -- The unique index support_sessions_one_open is the rule (D-29); this only gives its usual message.
    RAISE EXCEPTION 'You already have support access open for that firm' USING ERRCODE = 'PT409';
  END;
  PERFORM public.support_activity_append(f.id, auth.uid(), 'support_session', s.id, s.started_at);
  PERFORM public.record_ops_event('support_access', 'support-access', 'started', 'firm ' || f.id::text, auth.uid(), NULL);
  RETURN QUERY SELECT s.id, f.name, f.address, s.ends_at;
END;
$$;

-- Ends the admin's own session now. Ending one that is already over (or that ran out unrecorded) is not an error.
CREATE FUNCTION public.end_support_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  s public.support_sessions;
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  PERFORM public.settle_support_sessions(auth.uid());
  SELECT * INTO s FROM public.support_sessions x WHERE x.id = p_session_id AND x.admin_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Support session not found' USING ERRCODE = 'PT404';
  END IF;
  UPDATE public.support_sessions SET ended_at = now(), ended_how = 'ended' WHERE id = s.id AND ended_at IS NULL;
  IF FOUND THEN
    PERFORM public.support_activity_append(s.firm_id, s.admin_id, 'support_session_end', s.id, now());
  END IF;
END;
$$;

-- The caller's latest session for the firm at the address the request names: open, or the one that has just ended, so the page can say
-- the hour has ended. Seeing it is what records a session that ran out. Only the caller's own, and only for a platform admin. It answers
-- before the second factor too, saying so (second_factor_pending), so a password sign-in is sent to its second step and not told it is
-- no member; the session itself grants nothing until that step is done (support_reads_firm asks has_role).
CREATE FUNCTION public.my_support_session_here()
RETURNS TABLE (session_id uuid, firm_id uuid, firm_name text, firm_address text, ends_at timestamptz, ended_at timestamptz, is_open boolean,
               second_factor_pending boolean)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  wanted text := lower(btrim((COALESCE(NULLIF(current_setting('request.headers', true), ''), '{}')::jsonb) ->> 'x-firm-address'));
BEGIN
  IF wanted IS NULL OR NOT public.is_signed_in_person()
     OR NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin') THEN
    RETURN;
  END IF;
  PERFORM public.settle_support_sessions(auth.uid());
  RETURN QUERY
  SELECT s.id, f.id, f.name, f.address, s.ends_at, s.ended_at, s.ended_at IS NULL AND s.ends_at > now(), NOT public.second_factor_rule_met()
  FROM public.firms f
  JOIN public.support_sessions s ON s.firm_id = f.id AND s.admin_id = auth.uid()
  WHERE f.address = wanted AND f.decision IS DISTINCT FROM 'refused' AND NOT public.firm_is_closed(f.id)
  ORDER BY s.started_at DESC
  LIMIT 1;
END;
$$;

-- The platform's page: every session, open ones first, with who and why. Platform admins only; the firm never reaches this.
CREATE FUNCTION public.admin_support_sessions()
RETURNS TABLE (session_id uuid, firm_id uuid, firm_name text, firm_address text, admin_email text, reason text, started_at timestamptz,
               ends_at timestamptz, ended_at timestamptz, ended_how text, is_open boolean, is_mine boolean)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  PERFORM public.settle_support_sessions();
  RETURN QUERY
  SELECT s.id, f.id, f.name, f.address, s.admin_email, s.reason, s.started_at, s.ends_at, s.ended_at, s.ended_how,
         s.ended_at IS NULL, s.admin_id = auth.uid()
  FROM public.support_sessions s
  JOIN public.firms f ON f.id = s.firm_id
  ORDER BY (s.ended_at IS NULL) DESC, s.started_at DESC, s.id
  LIMIT 200;
END;
$$;

-- What a firm's owners read about each use, in the window the firm's record is kept: the reason the admin gave for them, and the
-- times. Never who (D-33): no name, no email, no id. When a session has run out and nobody has looked yet, it reads as ended at its end time.
CREATE FUNCTION public.firm_support_sessions(p_firm_id uuid)
RETURNS TABLE (session_id uuid, reason text, started_at timestamptz, ends_at timestamptz, ended_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.can_read_firm_activity(p_firm_id) THEN
    RAISE EXCEPTION 'Only a firm''s owners can read its record' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT s.id, s.reason, s.started_at, s.ends_at, COALESCE(s.ended_at, CASE WHEN s.ends_at <= now() THEN s.ends_at END)
  FROM public.support_sessions s
  WHERE s.firm_id = p_firm_id AND s.started_at > now() - public.firm_activity_retention()
  ORDER BY s.started_at DESC, s.id
  LIMIT 500;
END;
$$;

REVOKE ALL ON FUNCTION public.start_support_session(uuid, text), public.end_support_session(uuid), public.my_support_session_here(),
  public.admin_support_sessions(), public.firm_support_sessions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_support_session(uuid, text), public.end_support_session(uuid), public.my_support_session_here(),
  public.admin_support_sessions(), public.firm_support_sessions(uuid) TO authenticated;

-- 9. Closing a firm deletes by one list (20261118110000); the platform's record of support stays.
CREATE OR REPLACE FUNCTION public.firm_closing_plan()
RETURNS TABLE (ord integer, src text, action text, firm_column text, why text)
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT * FROM (VALUES
    -- Deleted: the firm's own working data.
    (10, 'public.firm_invitations', 'delete', 'firm_id', 'pending and past invitations to join'),
    (20, 'public.firm_organisations', 'delete', 'firm_id', 'the listed Google domains and Microsoft tenants'),
    (30, 'public.join_requests', 'delete', 'firm_id', 'requests to join'),
    (40, 'public.table_preferences', 'delete', 'firm_id', 'each person''s column choices'),
    (50, 'public.saved_views', 'delete', 'firm_id', 'saved views'),
    (60, 'public.referral_partners', 'delete', 'firm_id', 'referral partners'),
    (70, 'public.firm_teams', 'delete', 'firm_id', 'teams (the memberships that named one are cleared first)'),
    -- Kept, and why.
    (900, 'public.firms', 'keep', NULL, 'the row stays: its address stays taken for twelve months and its record must still exist'),
    (900, 'public.firm_memberships', 'keep', NULL, 'every membership is ended, not deleted: a membership is the dated record of who belonged (it is never changed)'),
    (900, 'public.firm_member_suspensions', 'keep', NULL, 'each open one is ended; the rows are the dated record of who was suspended'),
    (900, 'public.firm_activity', 'keep', NULL, 'the firm''s own record is pruned after ninety days by its own job (D-45)'),
    (900, 'public.firm_suspensions', 'keep', NULL, 'the platform''s record of suspensions'),
    (900, 'public.firm_closures', 'keep', NULL, 'the platform''s record of this: when it was asked, by whom, when it closed, and what was deleted, without content'),
    (900, 'public.support_sessions', 'keep', NULL, 'the platform''s record of each time Nevermore looked at the firm: who, why, when it started and ended (a session ends when the firm closes)'),
    (900, 'public.advisor_field_reviews', 'keep', NULL, 'an intake''s: it stays for its employer under the intake retention rules'),
    (900, 'public.advisor_notes', 'keep', NULL, 'an intake''s'),
    (900, 'public.advisor_review_events', 'keep', NULL, 'an intake''s'),
    (900, 'public.ai_extraction_events', 'keep', NULL, 'an intake''s'),
    (900, 'public.chamber_certifications', 'keep', NULL, 'an intake''s'),
    (900, 'public.chamber_sessions', 'keep', NULL, 'the intakes: they belong to the employer who made them and are not the firm''s to delete'),
    (900, 'public.document_events', 'keep', NULL, 'an intake''s'),
    (900, 'public.documents', 'keep', NULL, 'an intake''s'),
    (900, 'public.information_requests', 'keep', NULL, 'an intake''s'),
    (900, 'public.intake_consents', 'keep', NULL, 'the employer''s own agreement'),
    (900, 'public.intake_deletions', 'keep', NULL, 'the record that an intake was deleted, kept after it'),
    (900, 'public.intake_lifecycle_events', 'keep', NULL, 'an intake''s'),
    (900, 'public.manuscript_versions', 'keep', NULL, 'an intake''s'),
    (900, 'public.profiles', 'keep', NULL, 'the employer''s own profile'),
    (900, 'public.quote_request_addresses', 'keep', NULL, 'a quote request''s: quote requests belong to an intake'),
    (900, 'public.quote_request_events', 'keep', NULL, 'a quote request''s'),
    (900, 'public.quote_request_message_attachments', 'keep', NULL, 'a quote request''s'),
    (900, 'public.quote_request_messages', 'keep', NULL, 'a quote request''s mail thread with a PEO'),
    (900, 'public.quote_request_messages WHERE quote_request_id IS NULL', 'keep', NULL, 'held mail from a PEO: held for the platform once the firm has no members, and discarded by the holding list''s own schedule'),
    (900, 'public.quote_request_notes', 'keep', NULL, 'a quote request''s'),
    (900, 'public.quote_request_thread_reads', 'keep', NULL, 'a quote request''s'),
    (900, 'public.quote_requests', 'keep', NULL, 'an intake''s'),
    (900, 'public.submission_status_history', 'keep', NULL, 'an intake''s'),
    (900, 'public.submission_workflow', 'keep', NULL, 'an intake''s'),
    (900, 'storage.objects WHERE bucket_id = ''documents''', 'keep', NULL, 'an intake''s files'),
    (900, 'storage.objects WHERE bucket_id = ''manuscripts''', 'keep', NULL, 'an intake''s files'),
    (900, 'storage.objects WHERE bucket_id = ''peo-mail''', 'keep', NULL, 'an intake''s files')
  ) AS t (ord, src, action, firm_column, why)
$$;

-- The firm record's daily job (20261116160001, 20261118090500, 20261118110000) also records the sessions that ran out: no second
-- scheduler. Where the job does not exist (no pg_cron) this does nothing and says so; run public.settle_support_sessions() every day
-- another way.
DO $$
BEGIN
  IF to_regprocedure('cron.schedule(text,text,text)') IS NULL OR NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-firm-activity') THEN
    RAISE NOTICE 'support access: the prune-firm-activity job does not exist; run public.settle_support_sessions() every day another way';
    RETURN;
  END IF;
  PERFORM cron.schedule('prune-firm-activity', '53 3 * * *',
    'select public.prune_firm_activity(); select public.prune_firm_outbox_events(); select public.close_due_firms(); select public.settle_support_sessions();');
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'support access: could not add it to the daily job (%); run public.settle_support_sessions() every day another way', SQLERRM;
END $$;
