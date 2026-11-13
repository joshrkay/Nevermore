-- The record of who did what (story CRM-P2.3 with Q-3.1; docs/BROKER_CRM_BUILD.md D-16, D-24).
--
-- * One append-only table per the whole product, one row per thing that happened in a firm: who, when, what kind of
--   thing, and which record it was about. Never content: no answer, name, email body or file contents, only the kind
--   and the id of the record. A record id is a plain id (letters, digits, dashes), so free text can't be put in it.
-- * Nobody updates or deletes a row, an admin included. The one exception is the retention job (90 days, as other
--   operational events: docs/DATA_HANDLING.md), which removes entries past the window and nothing else. It runs as a
--   role of its own (firm_activity_pruner) that has no login and can do nothing but read and delete this table.
-- * record_firm_activity() is the one function other code calls to write an entry. It works out the firm from the
--   record and the actor from the caller's own sign-in, so a caller can't name a different one. Database functions and
--   triggers call it; a server function calls it as the service, which has no person behind it, and an entry from
--   there has no actor (the system). Browsers can't call it: they call record_member_activity(), which accepts only the
--   pairs of kind and record a browser sees happen (a submission opened, a file of a submission, a document or a
--   PEO's mail attachment downloaded, a packet downloaded, a sign-in to a firm's console), only for a firm the caller
--   belongs to, and collapses a repeat within 30 seconds. A submission opened is not one of them: the database writes
--   it itself, in open_submission(), the function that hands the submission over, so a browser can't report a view it
--   didn't make. What stays with the browser is what only the browser sees happen (a file built there, the storage link
--   it saved, a sign-in): a member can still report one of those that did not happen, which the glossary names.
--   No other function takes an actor as an argument: nothing can write an entry naming someone else.
-- * A firm's owners (a current membership with the role owner) read their own firm's record, once they have completed
--   the second factor (D-19), by the table or by firm_activity_list(); no one else does, and a platform admin who is not
--   an owner of the firm doesn't (D-16). A firm owner with no platform role is held back for the second factor too.
-- * Kinds that later stories write (export, invitation, removal, support access) are accepted now so they need no
--   schema change. A sign-in to a firm's console is written by the screen at the firm's address, once after each
--   sign-in, through record_member_activity('sign_in', 'firm', <the firm the address names>): it is the caller's own
--   sign-in, so the entry names the person, and the caller must be a current member of that firm.
-- * Not built here, deferred under D-24 to CRM-S3.8 (Export, epic 2), the story that builds exports: the alert that
--   emails owners about a large or repeated export (CRM-P2.3's export-alert criterion). This migration only makes
--   'export_made' a kind.
-- * Entries are numbered across every firm, so no id leaves the database for a reader: a reader's pages are told apart by
--   a random key (entry_key), never by the number, whose gaps would count what other firms did.

CREATE TABLE public.firm_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- What a reader pages by, with `at`. Random, so it says nothing about how much happened in other firms. `id` is never
  -- granted to a reader or returned by a function.
  entry_key uuid NOT NULL DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  at timestamptz NOT NULL DEFAULT now(),
  -- The signed-in person who did it; null when the system did (a scheduled job, a server function as the service).
  -- No foreign key on purpose: the record outlives the account, and a key's ON DELETE would change a row.
  actor_id uuid,
  kind text NOT NULL,
  record_type text NOT NULL,
  record_id text NOT NULL,
  -- For a membership: the person it was about, and the role. Null otherwise.
  subject_user_id uuid,
  role text,
  CONSTRAINT firm_activity_kind_check CHECK (kind IN (
    -- sync:begin firm_activity_kinds
    'sign_in', 'submission_viewed', 'document_downloaded', 'packet_downloaded', 'send_recorded',
    'member_added', 'member_ended', 'owner_added', 'owner_ended',
    'export_made', 'invitation_sent', 'member_removed', 'support_access',
    'firm_signed_up', 'firm_approved', 'firm_refused'
    -- sync:end firm_activity_kinds
  )),
  CONSTRAINT firm_activity_record_check CHECK (
    record_type IN (
      -- sync:begin firm_activity_record_types
      'submission', 'document', 'manuscript', 'quote_request', 'membership', 'firm'
      -- sync:end firm_activity_record_types
    )
    AND record_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  CONSTRAINT firm_activity_role_check CHECK (role IS NULL OR role IN ('owner', 'lead', 'agent'))
);

CREATE INDEX firm_activity_firm_at_idx ON public.firm_activity (firm_id, at DESC, entry_key DESC);
CREATE INDEX firm_activity_actor_idx ON public.firm_activity (firm_id, actor_id, at DESC) WHERE actor_id IS NOT NULL;

-- How long an entry is kept: the window for operational events (D4). One place to change it.
CREATE FUNCTION public.firm_activity_retention()
RETURNS interval
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT
    -- sync:begin firm_activity_retention
    interval '90 days'
    -- sync:end firm_activity_retention
$$;

REVOKE ALL ON FUNCTION public.firm_activity_retention() FROM PUBLIC, anon, authenticated;

-- Nothing changes or deletes a row, except the retention role, which only the retention function runs as: it has no
-- login, no one is a member of it but the migration's own role, and it can do nothing but read and delete this table.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'firm_activity_pruner') THEN
    CREATE ROLE firm_activity_pruner NOLOGIN NOINHERIT;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO firm_activity_pruner;
GRANT EXECUTE ON FUNCTION public.firm_activity_retention() TO firm_activity_pruner;

CREATE FUNCTION public.guard_firm_activity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_user = 'firm_activity_pruner' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'firm_activity records cannot be changed or deleted' USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.guard_firm_activity() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER firm_activity_append_only
  BEFORE UPDATE OR DELETE ON public.firm_activity
  FOR EACH ROW EXECUTE FUNCTION public.guard_firm_activity();

CREATE TRIGGER firm_activity_no_truncate
  BEFORE TRUNCATE ON public.firm_activity
  FOR EACH STATEMENT EXECUTE FUNCTION public.reject_audit_change();

ALTER TABLE public.firm_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.firm_activity FROM PUBLIC, anon, authenticated, service_role;
-- The service reads it (a later story's alert counts a member's exports) but writes only through record_firm_activity().
-- A reader gets every column but the global number (id): its gaps would count what other firms did.
GRANT SELECT ON public.firm_activity TO service_role;
GRANT SELECT (entry_key, firm_id, at, actor_id, kind, record_type, record_id, subject_user_id, role) ON public.firm_activity TO authenticated;
GRANT SELECT, DELETE ON public.firm_activity TO firm_activity_pruner;

-- Who may read a firm's record: its current owners, once they have done the second factor if their sign-in owes one
-- (D-19). The one place the rule is written: the policy below and the two reading functions call it.
CREATE FUNCTION public.can_read_firm_activity(p_firm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(public.firm_role(p_firm_id) = 'owner', false) AND public.second_factor_rule_met()
$$;

REVOKE ALL ON FUNCTION public.can_read_firm_activity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_firm_activity(uuid) TO authenticated;

-- An owner who signed in with a password and has not done the second factor reads nothing here, by the table or by
-- the functions below (D-19).
CREATE POLICY firm_activity_owners_read ON public.firm_activity
  FOR SELECT TO authenticated USING (public.can_read_firm_activity(firm_id));
CREATE POLICY firm_activity_pruner_select ON public.firm_activity FOR SELECT TO firm_activity_pruner USING (true);
CREATE POLICY firm_activity_pruner_delete ON public.firm_activity FOR DELETE TO firm_activity_pruner USING (true);

-- The firm a record belongs to (and, for a membership, who it is about and in what role), and the record's id in its
-- own canonical form, read from the record itself: an id in capitals or without dashes names the same record and is
-- stored, and compared for a repeat, as one id. Internal: the writers below call it. A later story that records against
-- a new kind of record adds it here.
CREATE FUNCTION public.firm_activity_resolve(p_record_type text, p_record_id text)
RETURNS TABLE (firm_id uuid, subject_user_id uuid, role text, canonical_id text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_record_type = 'submission' THEN
    RETURN QUERY SELECT s.firm_id, NULL::uuid, NULL::text, s.id::text FROM public.chamber_sessions s WHERE s.id = p_record_id::uuid;
  ELSIF p_record_type = 'document' THEN
    RETURN QUERY SELECT s.firm_id, NULL::uuid, NULL::text, d.id::text FROM public.documents d
      JOIN public.chamber_sessions s ON s.id = d.session_id WHERE d.id = p_record_id::uuid;
  ELSIF p_record_type = 'manuscript' THEN
    RETURN QUERY SELECT s.firm_id, NULL::uuid, NULL::text, v.id::text FROM public.manuscript_versions v
      JOIN public.chamber_sessions s ON s.id = v.session_id WHERE v.id = p_record_id::uuid;
  ELSIF p_record_type = 'quote_request' THEN
    RETURN QUERY SELECT s.firm_id, NULL::uuid, NULL::text, q.id::text FROM public.quote_requests q
      JOIN public.chamber_sessions s ON s.id = q.session_id WHERE q.id = p_record_id::bigint;
  ELSIF p_record_type = 'membership' THEN
    RETURN QUERY SELECT m.firm_id, m.user_id, m.role, m.id::text FROM public.firm_memberships m WHERE m.id = p_record_id::bigint;
  ELSIF p_record_type = 'firm' THEN
    RETURN QUERY SELECT f.id, NULL::uuid, NULL::text, f.id::text FROM public.firms f WHERE f.id = p_record_id::uuid;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.firm_activity_resolve(text, text) FROM PUBLIC, anon, authenticated, service_role;

-- The only statement that inserts a row. Internal. The actor is whoever the caller says here, so only functions in this
-- file call it, and only with the caller's own sign-in (firm_activity_append) or from a browser report.
CREATE FUNCTION public.firm_activity_insert(
  p_actor_id uuid, p_firm_id uuid, p_kind text, p_record_type text, p_record_id text,
  p_subject_user_id uuid DEFAULT NULL, p_role text DEFAULT NULL)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.firm_activity (firm_id, actor_id, kind, record_type, record_id, subject_user_id, role)
  VALUES (p_firm_id, p_actor_id, p_kind, p_record_type, p_record_id, p_subject_user_id, p_role)
  RETURNING id
$$;

REVOKE ALL ON FUNCTION public.firm_activity_insert(uuid, uuid, text, text, text, uuid, text) FROM PUBLIC, anon, authenticated, service_role;

-- Inserts as the caller's own sign-in (null for the service and for scheduled work). Internal; record_firm_activity and
-- the triggers below call it.
CREATE FUNCTION public.firm_activity_append(
  p_firm_id uuid, p_kind text, p_record_type text, p_record_id text, p_subject_user_id uuid DEFAULT NULL, p_role text DEFAULT NULL)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.firm_activity_insert(auth.uid(), p_firm_id, p_kind, p_record_type, p_record_id, p_subject_user_id, p_role)
$$;

REVOKE ALL ON FUNCTION public.firm_activity_append(uuid, text, text, text, uuid, text) FROM PUBLIC, anon, authenticated, service_role;

-- Inserts as the caller's own sign-in unless the same person already wrote the same entry within 30 seconds: the one place
-- that window is written. Internal; the browser report and the opening of a submission call it.
CREATE FUNCTION public.firm_activity_append_once(
  p_actor_id uuid, p_firm_id uuid, p_kind text, p_record_type text, p_record_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (
       SELECT 1 FROM public.firm_activity a
       WHERE a.firm_id = p_firm_id AND a.actor_id = p_actor_id AND a.kind = p_kind
         AND a.record_type = p_record_type AND a.record_id = p_record_id AND a.at > now() - interval '30 seconds') THEN
    RETURN;
  END IF;
  PERFORM public.firm_activity_insert(p_actor_id, p_firm_id, p_kind, p_record_type, p_record_id);
END;
$$;

REVOKE ALL ON FUNCTION public.firm_activity_append_once(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- The one function other code calls to write an entry. The firm comes from the record and the actor from the caller's
-- own sign-in, so neither is an argument and a caller can't name another.
CREATE FUNCTION public.record_firm_activity(p_kind text, p_record_type text, p_record_id text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r record;
BEGIN
  SELECT * INTO r FROM public.firm_activity_resolve(p_record_type, p_record_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That record doesn''t belong to a firm' USING ERRCODE = 'P0002';
  END IF;
  RETURN public.firm_activity_append(r.firm_id, p_kind, p_record_type, r.canonical_id, r.subject_user_id, r.role);
END;
$$;

REVOKE ALL ON FUNCTION public.record_firm_activity(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_firm_activity(text, text, text) TO service_role;

-- What a browser may report.
-- A browser reports only what it alone sees happen, and only the pairs that can happen: a file of
-- a submission, a document or a mail attachment (against its quote request) downloaded, a packet downloaded, a sign-in to
-- a firm's console. Any other pair would be a false entry. It hands back
-- nothing (ids are numbered across every firm, so one would let a caller count other firms' entries), and the same
-- report from the same person within half a minute is one entry, so a loop can't flood the record.
CREATE FUNCTION public.record_member_activity(p_kind text, p_record_type text, p_record_id text)
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
  PERFORM public.firm_activity_append_once(auth.uid(), r.firm_id, p_kind, p_record_type, r.canonical_id);
END;
$$;

REVOKE ALL ON FUNCTION public.record_member_activity(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_member_activity(text, text, text) TO authenticated;

-- A submission handed to a member: the one place a view is written, because it is the place the data leaves the
-- database. It returns the intake row the advisor's page opens on, only to a current member of the submission's firm
-- (the same rule as the table's policy: is_firm_member), writes 'submission_viewed' as the caller in that firm, and
-- collapses a repeat within 30 seconds. Anyone else gets no row and leaves no entry. Nothing here takes an actor or a
-- firm.
CREATE FUNCTION public.open_submission(p_session_id uuid)
RETURNS SETOF public.chamber_sessions
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_firm uuid;
BEGIN
  IF NOT public.is_signed_in_person() THEN
    RAISE EXCEPTION 'Sign in to continue' USING ERRCODE = '42501';
  END IF;
  SELECT s.firm_id INTO v_firm FROM public.chamber_sessions s WHERE s.id = p_session_id;
  IF v_firm IS NULL OR NOT public.is_firm_member(v_firm) THEN
    RETURN;
  END IF;
  PERFORM public.firm_activity_append_once(auth.uid(), v_firm, 'submission_viewed', 'submission', p_session_id::text);
  RETURN QUERY SELECT * FROM public.chamber_sessions s WHERE s.id = p_session_id;
END;
$$;

REVOKE ALL ON FUNCTION public.open_submission(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_submission(uuid) TO authenticated;

-- ---------- Wired to what exists today ----------

-- A membership entry is written when the change is made, not when it takes effect: an end given a date in the future is
-- recorded now, while the person is still a member, and nothing is written when the date arrives (glossary: Firm activity).

-- Every membership, role and ownership change. A membership is never changed, only ended and another added, so a role
-- change reads as an end and an add. An owner's change is its own kind. Written from the row itself, since a deleted row
-- (an account removed) can't be looked up afterwards.
CREATE FUNCTION public.record_membership_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  m public.firm_memberships;
  added boolean := TG_OP = 'INSERT';
BEGIN
  m := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  IF TG_OP = 'UPDATE' AND NEW.valid_until IS NOT DISTINCT FROM OLD.valid_until THEN
    RETURN NULL;
  END IF;
  -- Removing an account removes its memberships, the ones that had already ended too. An ended membership was recorded
  -- when it ended, so recording it again would make an old change look as if it just happened.
  IF TG_OP = 'DELETE' AND NOT public.membership_is_current(OLD.valid_from, OLD.valid_until) THEN
    RETURN NULL;
  END IF;
  PERFORM public.firm_activity_append(
    m.firm_id,
    CASE WHEN m.role = 'owner' THEN 'owner_' ELSE 'member_' END || CASE WHEN added THEN 'added' ELSE 'ended' END,
    'membership', m.id::text, m.user_id, m.role);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.record_membership_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER firm_memberships_record_activity
  AFTER INSERT OR DELETE OR UPDATE OF valid_until ON public.firm_memberships
  FOR EACH ROW EXECUTE FUNCTION public.record_membership_change();

-- A send recorded for a PEO: the quote request is made, or made again by a new send (which sets the date it went).
CREATE FUNCTION public.record_send_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.record_firm_activity('send_recorded', 'quote_request', NEW.id::text);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.record_send_activity() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER quote_requests_record_send
  AFTER INSERT OR UPDATE OF sent_on, sent_version ON public.quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.record_send_activity();

-- ---------- Reading ----------

-- A page of a firm's record, newest first, for the firm's owners only. Paging by offset repeats or skips a row when an
-- entry arrives between two pages. A page starts after the last entry the reader saw: the cursor is that entry's time and
-- key, the same two the list is ordered by. The key is random, not the table's number, which is shared by every firm.
CREATE FUNCTION public.firm_activity_list(
  p_firm_id uuid, p_person uuid DEFAULT NULL, p_kind text DEFAULT NULL, p_limit integer DEFAULT 50,
  p_before_at timestamptz DEFAULT NULL, p_before_key uuid DEFAULT NULL)
RETURNS TABLE (
  entry_key uuid, at timestamptz, actor_id uuid, actor_email text, kind text, record_type text, record_id text,
  subject_user_id uuid, subject_email text, role text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.can_read_firm_activity(p_firm_id) THEN
    RAISE EXCEPTION 'Only a firm''s owners can read its record' USING ERRCODE = '42501';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 OR (p_before_at IS NULL) <> (p_before_key IS NULL) THEN
    RAISE EXCEPTION 'A page is 1 to 100 entries, after an entry given by its time and key together' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT a.entry_key, a.at, a.actor_id, u.email::text, a.kind, a.record_type, a.record_id, a.subject_user_id, su.email::text, a.role
    FROM public.firm_activity a
    LEFT JOIN auth.users u ON u.id = a.actor_id
    LEFT JOIN auth.users su ON su.id = a.subject_user_id
    WHERE a.firm_id = p_firm_id
      AND (p_person IS NULL OR a.actor_id = p_person)
      AND (p_kind IS NULL OR a.kind = p_kind)
      AND (p_before_at IS NULL OR (a.at, a.entry_key) < (p_before_at, p_before_key))
    ORDER BY a.at DESC, a.entry_key DESC
    LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.firm_activity_list(uuid, uuid, text, integer, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.firm_activity_list(uuid, uuid, text, integer, timestamptz, uuid) TO authenticated;

-- The firms the caller currently owns, to offer a choice when there is more than one. A page says which firm it wants
-- (today by ?firm=<id>, or the only firm the caller owns) and firm_activity_list checks the caller currently owns that one. A platform admin who is not an owner is refused like anyone else (D-16).
-- The one place 'the caller currently owns this firm' is written for a membership (a current membership with the role
-- owner), whatever sign-in the caller holds: the reader (my_owner_firms) adds the second-factor rule, and the check that
-- holds an owner back for the second factor (advisor_needs_second_factor) must not. Internal.
CREATE FUNCTION public.current_owner_firm_ids()
RETURNS TABLE (firm_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT m.firm_id
  FROM public.firm_memberships m
  WHERE m.user_id = auth.uid() AND m.role = 'owner'
    AND public.membership_is_current(m.valid_from, m.valid_until)
$$;

REVOKE ALL ON FUNCTION public.current_owner_firm_ids() FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.my_owner_firms()
RETURNS TABLE (firm_id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT f.id, f.name
  FROM public.current_owner_firm_ids() o
  JOIN public.firms f ON f.id = o.firm_id
  WHERE public.is_signed_in_person()
    AND public.second_factor_rule_met()
  ORDER BY f.name, f.id
$$;

REVOKE ALL ON FUNCTION public.my_owner_firms() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_owner_firms() TO authenticated;

-- The firm at an address, for a caller who is a current member of it, so the screen at that address can report a sign-in
-- to it (record_member_activity('sign_in', 'firm', ...)). Null for anyone else, so it tells no one a firm's id.
CREATE FUNCTION public.my_firm_at_address(p_address text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT f.id FROM public.firms f
  WHERE f.address = lower(btrim(p_address)) AND public.is_signed_in_person() AND public.is_firm_member(f.id)
$$;

REVOKE ALL ON FUNCTION public.my_firm_at_address(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_firm_at_address(text) TO authenticated;

-- The people who appear as the doer in a firm's record: what the person filter offers, read under the same rule as the list.
CREATE FUNCTION public.firm_activity_people(p_firm_id uuid)
RETURNS TABLE (user_id uuid, email text)
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
    SELECT a.actor_id, u.email::text
    FROM (SELECT DISTINCT f.actor_id FROM public.firm_activity f WHERE f.firm_id = p_firm_id AND f.actor_id IS NOT NULL) a
    LEFT JOIN auth.users u ON u.id = a.actor_id
    ORDER BY u.email;
END;
$$;

REVOKE ALL ON FUNCTION public.firm_activity_people(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.firm_activity_people(uuid) TO authenticated;


-- ---------- Retention ----------

-- Removes entries past the window and reports how many. It runs as the retention role (SECURITY DEFINER runs as its
-- owner), the only role guard_firm_activity lets delete. Scheduled daily below.
CREATE FUNCTION public.prune_firm_activity()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  removed integer;
BEGIN
  DELETE FROM public.firm_activity WHERE at < now() - public.firm_activity_retention();
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

-- Handing a function to a new owner needs the right to become that role, and, for a role that is not a superuser (as on
-- hosted Supabase), CREATE on the function's schema for the new owner. Both are given only for this statement.
DO $$
BEGIN
  IF NOT pg_has_role(current_user, 'firm_activity_pruner', 'USAGE') THEN
    EXECUTE format('GRANT firm_activity_pruner TO %I', current_user);
  END IF;
END $$;
GRANT CREATE ON SCHEMA public TO firm_activity_pruner;
ALTER FUNCTION public.prune_firm_activity() OWNER TO firm_activity_pruner;
REVOKE CREATE ON SCHEMA public FROM firm_activity_pruner;
REVOKE ALL ON FUNCTION public.prune_firm_activity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_firm_activity() TO service_role;

-- Daily at 03:53 UTC, with the other retention jobs (20261104092000_data_retention_and_deletion.sql): needs pg_cron only.
-- Without it, run `select public.prune_firm_activity();` from any scheduler with the service role. A job of the same name
-- already there is left as it is.
DO $$
BEGIN
  IF to_regprocedure('cron.schedule(text,text,text)') IS NULL THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'firm activity: pg_cron is not available (%); run public.prune_firm_activity() another way', SQLERRM;
      RETURN;
    END;
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-firm-activity') THEN
    RAISE NOTICE 'firm activity: a prune-firm-activity job already exists; leaving it as it is';
    RETURN;
  END IF;
  PERFORM cron.schedule('prune-firm-activity', '53 3 * * *', 'select public.prune_firm_activity();');
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'firm activity: could not schedule prune-firm-activity (%); run public.prune_firm_activity() another way', SQLERRM;
END $$;

-- ---------- A firm's owner is held back for the second factor too ----------
-- A password sign-in that has not completed a second factor is held back (D-19) for a platform role, and now for a
-- current owner of a firm as well, who may have no platform role: the same sign-in screens then send them to set one up.
-- Anyone who holds neither a role nor a current ownership is never asked.
CREATE OR REPLACE FUNCTION public.advisor_needs_second_factor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_signed_in_person()
    AND NOT public.second_factor_rule_met()
    AND (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.current_owner_firm_ids())
    );
$$;
