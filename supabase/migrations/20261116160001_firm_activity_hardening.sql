-- The record of who did what, hardened after review (story CRM-P2.3; docs/BROKER_CRM_BUILD.md D-16, D-24). A second file,
-- because 20261116160000_firm_activity.sql is already in review as written.

-- ---------- A deleted membership is recorded only if it was current ----------
-- Removing an account removes its memberships (ON DELETE CASCADE), the ones that had already ended too. An ended
-- membership was recorded when it ended, so recording it again would make an old change look as if it just happened.
CREATE OR REPLACE FUNCTION public.record_membership_change()
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

-- ---------- One internal insert; the actor is the caller's sign-in, or a member a server function vouches for ----------
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

CREATE OR REPLACE FUNCTION public.firm_activity_append(
  p_firm_id uuid, p_kind text, p_record_type text, p_record_id text, p_subject_user_id uuid DEFAULT NULL, p_role text DEFAULT NULL)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.firm_activity_insert(auth.uid(), p_firm_id, p_kind, p_record_type, p_record_id, p_subject_user_id, p_role)
$$;

-- ---------- What a browser may report ----------
-- A browser reports only what it alone sees happen, and only the pairs that can happen: a submission opened, a file of
-- a submission or a document downloaded, a packet downloaded. Any other pair would be a false entry. It hands back
-- nothing (ids are numbered across every firm, so one would let a caller count other firms' entries), and the same
-- report from the same person within half a minute is one entry, so a loop can't flood the record.
DROP FUNCTION public.record_member_activity(text, text, text);

CREATE FUNCTION public.record_member_activity(p_kind text, p_record_type text, p_record_id text)
RETURNS void
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
  IF (p_kind, p_record_type) NOT IN (
       ('submission_viewed', 'submission'), ('document_downloaded', 'document'),
       ('document_downloaded', 'submission'), ('packet_downloaded', 'manuscript')) THEN
    RAISE EXCEPTION 'A browser can''t record that' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.firm_activity_resolve(p_record_type, p_record_id);
  IF NOT FOUND OR NOT public.is_firm_member(r.firm_id) THEN
    RAISE EXCEPTION 'You are not a member of that record''s firm' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
       SELECT 1 FROM public.firm_activity a
       WHERE a.firm_id = r.firm_id AND a.actor_id = auth.uid() AND a.kind = p_kind
         AND a.record_type = p_record_type AND a.record_id = p_record_id AND a.at > now() - interval '30 seconds') THEN
    RETURN;
  END IF;
  PERFORM public.firm_activity_insert(auth.uid(), r.firm_id, p_kind, p_record_type, p_record_id);
END;
$$;

REVOKE ALL ON FUNCTION public.record_member_activity(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_member_activity(text, text, text) TO authenticated;

-- A server function that has signed a link for a signed-in member records the download as that member. Only the service
-- calls it, and the member must currently belong to the record's firm: it can't write as a guest, as someone from
-- another firm, or as no one in particular.
CREATE FUNCTION public.record_firm_activity_as(p_member uuid, p_kind text, p_record_type text, p_record_id text)
RETURNS void
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
  IF p_member IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.firm_memberships m
       JOIN auth.users u ON u.id = m.user_id
       WHERE m.firm_id = r.firm_id AND m.user_id = p_member AND COALESCE(u.is_anonymous, false) = false
         AND public.membership_is_current(m.valid_from, m.valid_until)) THEN
    RAISE EXCEPTION 'That person is not a member of the record''s firm' USING ERRCODE = '42501';
  END IF;
  PERFORM public.firm_activity_insert(p_member, r.firm_id, p_kind, p_record_type, p_record_id, r.subject_user_id, r.role);
END;
$$;

REVOKE ALL ON FUNCTION public.record_firm_activity_as(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_firm_activity_as(uuid, text, text, text) TO service_role;

-- ---------- Who may delete: the retention role, not a setting anyone can make ----------
-- The first file let a delete through when a session setting said pruning was on, and any role but the three API roles
-- could set it, the table's owner among them. Now a delete is allowed for one role only, and only the retention function
-- runs as it: it has no login, no one is a member of it but the migration's own role, and it can do nothing but read and
-- delete this table.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'firm_activity_pruner') THEN
    CREATE ROLE firm_activity_pruner NOLOGIN NOINHERIT;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO firm_activity_pruner;
GRANT SELECT, DELETE ON public.firm_activity TO firm_activity_pruner;
GRANT EXECUTE ON FUNCTION public.firm_activity_retention() TO firm_activity_pruner;

CREATE POLICY firm_activity_pruner_select ON public.firm_activity FOR SELECT TO firm_activity_pruner USING (true);
CREATE POLICY firm_activity_pruner_delete ON public.firm_activity FOR DELETE TO firm_activity_pruner USING (true);

CREATE OR REPLACE FUNCTION public.guard_firm_activity()
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

CREATE OR REPLACE FUNCTION public.prune_firm_activity()
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

-- The function runs as the retention role (SECURITY DEFINER runs as its owner). Changing an owner needs the right to
-- become that role, which the migration's own role is given here.
DO $$
BEGIN
  IF NOT pg_has_role(current_user, 'firm_activity_pruner', 'USAGE') THEN
    EXECUTE format('GRANT firm_activity_pruner TO %I', current_user);
  END IF;
END $$;
ALTER FUNCTION public.prune_firm_activity() OWNER TO firm_activity_pruner;
REVOKE ALL ON FUNCTION public.prune_firm_activity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_firm_activity() TO service_role;

-- ---------- Reading: paged by a cursor, and the firm is named by the caller ----------
-- Paging by offset repeats or skips a row when an entry arrives between two pages. A page now starts after the last
-- entry the reader saw: the cursor is that entry's time and id, the same two the list is ordered by.
DROP FUNCTION public.firm_activity_list(uuid, uuid, text, integer, integer);

CREATE FUNCTION public.firm_activity_list(
  p_firm_id uuid, p_person uuid DEFAULT NULL, p_kind text DEFAULT NULL, p_limit integer DEFAULT 50,
  p_before_at timestamptz DEFAULT NULL, p_before_id bigint DEFAULT NULL)
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
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 OR (p_before_at IS NULL) <> (p_before_id IS NULL) THEN
    RAISE EXCEPTION 'A page is 1 to 100 entries, after an entry given by its time and id together' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT a.id, a.at, a.actor_id, u.email::text, a.kind, a.record_type, a.record_id, a.subject_user_id, su.email::text, a.role
    FROM public.firm_activity a
    LEFT JOIN auth.users u ON u.id = a.actor_id
    LEFT JOIN auth.users su ON su.id = a.subject_user_id
    WHERE a.firm_id = p_firm_id
      AND (p_person IS NULL OR a.actor_id = p_person)
      AND (p_kind IS NULL OR a.kind = p_kind)
      AND (p_before_at IS NULL OR (a.at, a.id) < (p_before_at, p_before_id))
    ORDER BY a.at DESC, a.id DESC
    LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.firm_activity_list(uuid, uuid, text, integer, timestamptz, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.firm_activity_list(uuid, uuid, text, integer, timestamptz, bigint) TO authenticated;

-- my_owner_firm() took the caller's earliest owner membership, so an owner of two firms was shown an arbitrary one and
-- couldn't reach the other. A page now says which firm it wants (the firm address will say it once firms have
-- addresses: story CRM-P1.3a) and firm_activity_list checks the caller currently owns that one. This lists the firms
-- the caller currently owns, to offer a choice when there is more than one.
DROP FUNCTION public.my_owner_firm();

CREATE FUNCTION public.my_owner_firms()
RETURNS TABLE (firm_id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT f.id, f.name
  FROM public.firm_memberships m
  JOIN public.firms f ON f.id = m.firm_id
  WHERE auth.uid() IS NOT NULL
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    AND m.user_id = auth.uid() AND m.role = 'owner'
    AND public.membership_is_current(m.valid_from, m.valid_until)
  ORDER BY f.name, f.id
$$;

REVOKE ALL ON FUNCTION public.my_owner_firms() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_owner_firms() TO authenticated;
