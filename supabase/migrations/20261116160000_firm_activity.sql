-- The record of who did what (story CRM-P2.3 with Q-3.1; docs/BROKER_CRM_BUILD.md D-16, D-24).
--
-- * One append-only table per the whole product, one row per thing that happened in a firm: who, when, what kind of
--   thing, and which record it was about. Never content: no answer, name, email body or file contents, only the kind
--   and the id of the record. A record id is a plain id (letters, digits, dashes), so free text can't be put in it.
-- * Nobody updates or deletes a row, an admin included. The one exception is the retention job (90 days, as other
--   operational events: docs/DATA_HANDLING.md), which removes entries past the window and nothing else.
-- * record_firm_activity() is the one function other code calls to write an entry. It works out the firm from the
--   record and the actor from the caller's own sign-in, so a caller can't name a different one. Database functions and
--   triggers call it; a server function calls it as the service, which has no person behind it, and an entry from
--   there has no actor (the system). Browsers can't call it: they call record_member_activity(), which accepts only the
--   kinds a browser sees happen (a submission opened, a file downloaded) and only for a firm the caller belongs to.
-- * A firm's owners (a current membership with the role owner) read their own firm's record; no one else does, and a
--   platform admin who is not an owner of the firm doesn't (D-16).
-- * Kinds that later stories write (export, invitation, removal, support access) are accepted now so they need no
--   schema change. Sign-in to a firm's console is accepted too but nothing writes it yet: which firm a sign-in is to is
--   decided by the firm address (story CRM-P1.3a), so that story calls record_firm_activity('sign_in', 'firm', <id>).
-- * Not built here, deferred under D-24 to the story that builds exports: the alert that emails owners about a large
--   or repeated export. This migration only makes 'export' a kind.

CREATE TABLE public.firm_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
    'sign_in', 'submission_viewed', 'document_downloaded', 'packet_downloaded', 'send_recorded',
    'member_added', 'member_ended', 'owner_added', 'owner_ended',
    'export_made', 'invitation_sent', 'member_removed', 'support_access')),
  CONSTRAINT firm_activity_record_check CHECK (
    record_type IN ('submission', 'document', 'manuscript', 'quote_request', 'membership', 'firm')
    AND record_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  CONSTRAINT firm_activity_role_check CHECK (role IS NULL OR role IN ('owner', 'lead', 'agent'))
);

CREATE INDEX firm_activity_firm_at_idx ON public.firm_activity (firm_id, at DESC, id DESC);
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

-- Nothing changes or deletes a row. Only the retention job's own function, which says so for the one statement it
-- runs, may delete, and only as the table's owner: the API roles never can, whatever they set.
CREATE FUNCTION public.guard_firm_activity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('eaa.pruning_firm_activity', true) = 'on'
     AND current_user NOT IN ('anon', 'authenticated', 'service_role') THEN
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
GRANT SELECT ON public.firm_activity TO authenticated, service_role;

CREATE POLICY firm_activity_owners_read ON public.firm_activity
  FOR SELECT TO authenticated USING (public.firm_role(firm_id) = 'owner');

-- The firm a record belongs to (and, for a membership, who it is about and in what role). Internal: the writers below
-- call it. A later story that records against a new kind of record adds it here.
CREATE FUNCTION public.firm_activity_resolve(p_record_type text, p_record_id text)
RETURNS TABLE (firm_id uuid, subject_user_id uuid, role text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_record_type = 'submission' THEN
    RETURN QUERY SELECT s.firm_id, NULL::uuid, NULL::text FROM public.chamber_sessions s WHERE s.id = p_record_id::uuid;
  ELSIF p_record_type = 'document' THEN
    RETURN QUERY SELECT s.firm_id, NULL::uuid, NULL::text FROM public.documents d
      JOIN public.chamber_sessions s ON s.id = d.session_id WHERE d.id = p_record_id::uuid;
  ELSIF p_record_type = 'manuscript' THEN
    RETURN QUERY SELECT s.firm_id, NULL::uuid, NULL::text FROM public.manuscript_versions v
      JOIN public.chamber_sessions s ON s.id = v.session_id WHERE v.id = p_record_id::uuid;
  ELSIF p_record_type = 'quote_request' THEN
    RETURN QUERY SELECT s.firm_id, NULL::uuid, NULL::text FROM public.quote_requests q
      JOIN public.chamber_sessions s ON s.id = q.session_id WHERE q.id = p_record_id::bigint;
  ELSIF p_record_type = 'membership' THEN
    RETURN QUERY SELECT m.firm_id, m.user_id, m.role FROM public.firm_memberships m WHERE m.id = p_record_id::bigint;
  ELSIF p_record_type = 'firm' THEN
    RETURN QUERY SELECT f.id, NULL::uuid, NULL::text FROM public.firms f WHERE f.id = p_record_id::uuid;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.firm_activity_resolve(text, text) FROM PUBLIC, anon, authenticated, service_role;

-- The only statement that inserts a row: the actor is always the caller's own sign-in (null for the service and for
-- scheduled work). Internal; record_firm_activity and the triggers below call it.
CREATE FUNCTION public.firm_activity_append(
  p_firm_id uuid, p_kind text, p_record_type text, p_record_id text, p_subject_user_id uuid DEFAULT NULL, p_role text DEFAULT NULL)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.firm_activity (firm_id, actor_id, kind, record_type, record_id, subject_user_id, role)
  VALUES (p_firm_id, auth.uid(), p_kind, p_record_type, p_record_id, p_subject_user_id, p_role)
  RETURNING id
$$;

REVOKE ALL ON FUNCTION public.firm_activity_append(uuid, text, text, text, uuid, text) FROM PUBLIC, anon, authenticated, service_role;

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
  RETURN public.firm_activity_append(r.firm_id, p_kind, p_record_type, p_record_id, r.subject_user_id, r.role);
END;
$$;

REVOKE ALL ON FUNCTION public.record_firm_activity(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_firm_activity(text, text, text) TO service_role;

-- What a browser may report: a submission opened or a file downloaded, about a record of a firm the caller belongs to.
CREATE FUNCTION public.record_member_activity(p_kind text, p_record_type text, p_record_id text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r record;
BEGIN
  IF auth.uid() IS NULL OR COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'Sign in to continue' USING ERRCODE = '42501';
  END IF;
  IF p_kind NOT IN ('submission_viewed', 'document_downloaded', 'packet_downloaded') THEN
    RAISE EXCEPTION 'A browser can''t record that kind of entry' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.firm_activity_resolve(p_record_type, p_record_id);
  IF NOT FOUND OR NOT public.is_firm_member(r.firm_id) THEN
    RAISE EXCEPTION 'You are not a member of that record''s firm' USING ERRCODE = '42501';
  END IF;
  RETURN public.record_firm_activity(p_kind, p_record_type, p_record_id);
END;
$$;

REVOKE ALL ON FUNCTION public.record_member_activity(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_member_activity(text, text, text) TO authenticated;

-- ---------- Wired to what exists today ----------

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

-- A page of a firm's record, newest first, for the firm's owners only. Filtered by the person who did it and by kind
-- (null keeps all); a page is at most 100 rows from p_offset. A platform admin who is not an owner of the firm is
-- refused like anyone else: the platform doesn't read a firm's record through this (D-16).
CREATE FUNCTION public.firm_activity_list(
  p_firm_id uuid, p_person uuid DEFAULT NULL, p_kind text DEFAULT NULL, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS TABLE (
  id bigint, at timestamptz, actor_id uuid, actor_email text, kind text, record_type text, record_id text,
  subject_user_id uuid, subject_email text, role text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.firm_role(p_firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only a firm''s owners can read its record' USING ERRCODE = '42501';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'A page is 1 to 100 entries from 0 or later' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT a.id, a.at, a.actor_id, u.email::text, a.kind, a.record_type, a.record_id, a.subject_user_id, su.email::text, a.role
    FROM public.firm_activity a
    LEFT JOIN auth.users u ON u.id = a.actor_id
    LEFT JOIN auth.users su ON su.id = a.subject_user_id
    WHERE a.firm_id = p_firm_id
      AND (p_person IS NULL OR a.actor_id = p_person)
      AND (p_kind IS NULL OR a.kind = p_kind)
    ORDER BY a.at DESC, a.id DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.firm_activity_list(uuid, uuid, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.firm_activity_list(uuid, uuid, text, integer, integer) TO authenticated;

-- The people who appear as the doer in a firm's record: what the person filter offers. For the firm's owners only.
CREATE FUNCTION public.firm_activity_people(p_firm_id uuid)
RETURNS TABLE (user_id uuid, email text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.firm_role(p_firm_id) IS DISTINCT FROM 'owner' THEN
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

-- Removes entries past the window and reports how many. The one statement that may delete a row: it says so for itself
-- and no one else can (guard_firm_activity also refuses the API roles whatever they say). Scheduled daily below.
CREATE FUNCTION public.prune_firm_activity()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  removed integer;
BEGIN
  PERFORM set_config('eaa.pruning_firm_activity', 'on', true);
  DELETE FROM public.firm_activity WHERE at < now() - public.firm_activity_retention();
  GET DIAGNOSTICS removed = ROW_COUNT;
  PERFORM set_config('eaa.pruning_firm_activity', '', true);
  RETURN removed;
END;
$$;

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
