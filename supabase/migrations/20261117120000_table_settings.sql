-- Where a table's column choices and saved views are kept (stories CRM-S3.1b and CRM-S3.4b; docs/BROKER_CRM_BUILD.md D-5,
-- D-16, D-18, D-28, D-29, D-32, D-43, D-44).
--
-- D-43: page, sort, filters, view and search live in the page's address; a person's column choices are a row per firm,
-- person and table; saved views are rows a firm's owner can share; built-in views live in code (they are not rows here, so
-- nothing can delete them). Nothing is kept in the browser's storage: "per person" means on any device.
--
-- How it is reached. As the newest firm table (firm_invitations) is: both tables are closed to the API, and the functions
-- below are the only way in. Each asks the caller's current role in the row's firm through firm_role(), at the moment of the
-- call, so the rule is written once per function and nothing depends on a cleanup: a person whose membership has ended, a
-- platform admin who belongs to no firm (D-16), a guest token and a password sign-in without its second factor (D-19) are
-- all no member, and see and change nothing, their own former rows included. Closed tables also mean the list can say, per
-- row, whether the caller may change, share or unshare it, which a plain select could not.
--
-- The rules where the stories are silent:
--   * A person reads their own views and the firm's shared ones, and creates, renames, changes and deletes only their own,
--     shared or not. Another person's private view is answered as a view that isn't there (PT404), exactly as a view of
--     another firm, or one that never existed, is: nobody learns that a view exists unless they may read it.
--   * Only a current owner shares or unshares. An owner shares a view they saved (another person's private view is one they
--     cannot read). An owner may unshare any shared view of the firm, another owner's included: it goes back to being its
--     saver's private view, so nothing is lost. An owner may not delete a view another person saved.
--   * A person who leaves the firm: their views stay, as the firm's rows, and they reach none of them. Their private views
--     are read by nobody; a view they shared stays shared until an owner unshares it (then it is read by nobody either). If
--     they rejoin, they find their own views again. Closing a firm (CRM-P1.7) deletes them with the firm's other data.
--   * Columns per saved view (CRM-S3.1 "kept per person per table and per saved view"): a saved view carries its own
--     columns, which is what anyone who opens it sees; a person may keep their own choice on a view they can read, which
--     wins for them alone (a row of table_preferences that names the view). With no view, and on a built-in view, a person's
--     choice for the table applies (the row that names no view). What a person sees on a saved view is, in order: their own
--     choice for that view, the view's columns, their choice for the table, the table's defaults (in code).
--
-- The limits, chosen to stop abuse without getting in a real firm's way:
--   * a view's name: 1 to 60 characters, no spaces around it, no control characters;
--   * one name per person per table, ignoring case, and one shared name per firm per table (constraints, D-29);
--   * at most 30 views per person per table in a firm (counted under a lock: it counts rows, so it can't be a constraint);
--   * filters: a list of at most 20 (the queue's own ceiling), each {field, op, value} (value may be left out), with a field
--     of 1 to 64 characters and an operator of 1 to 32, and at most 16 KB of JSON in all (a 100-value choice filter of long
--     values fits);
--   * a sort: none, or {field, direction} with a field of 1 to 64 characters and a direction 'asc' or 'desc';
--   * columns: a list of 1 to 60 different column keys of 1 to 64 characters each.
-- Field and column names are not checked here: the query function refuses an unknown field when the view is used (D-44).
--
-- Which tables: one of a fixed list, the domain workspace_table. Today only the submissions queue ('submissions'); adding
-- accounts, leads, quotes, the inbox or a list inside a record is one small migration that drops and adds the domain's
-- check with the longer list. A name that is not on it is refused.

CREATE DOMAIN public.workspace_table AS text
  CONSTRAINT workspace_table_known CHECK (VALUE IN ('submissions'));

-- A table name a caller sent, as the domain: a name not on the list is refused with a plain message.
CREATE FUNCTION public.workspace_table_named(p_table text)
RETURNS public.workspace_table
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_table IS NULL THEN
    RAISE EXCEPTION 'Name a table' USING ERRCODE = '22023';
  END IF;
  RETURN p_table::public.workspace_table;
EXCEPTION WHEN check_violation THEN
  RAISE EXCEPTION 'There is no table called "%"', left(p_table, 64) USING ERRCODE = '22023';
END;
$$;

REVOKE ALL ON FUNCTION public.workspace_table_named(text) FROM PUBLIC, anon, authenticated;

-- Whether a view's name is one that can be kept: trimmed, 1 to 60 characters, no control characters.
CREATE FUNCTION public.saved_view_name_ok(p_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT p_name IS NOT NULL AND p_name = btrim(p_name) AND char_length(p_name) BETWEEN 1 AND 60 AND p_name !~ '[[:cntrl:]]'
$$;

-- Whether filters are a list the queue's query can read: at most 20 objects of {field, op, value} (value optional), a field
-- of 1 to 64 characters, an operator of 1 to 32, at most 16 KB of JSON. What a filter's value means is the query's to judge.
CREATE FUNCTION public.saved_view_filters_ok(p_filters jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE f jsonb;
BEGIN
  IF p_filters IS NULL OR jsonb_typeof(p_filters) <> 'array' OR jsonb_array_length(p_filters) > 20
     OR octet_length(p_filters::text) > 16384 THEN
    RETURN false;
  END IF;
  FOR f IN SELECT e FROM jsonb_array_elements(p_filters) e LOOP
    IF jsonb_typeof(f) <> 'object'
       OR EXISTS (SELECT 1 FROM jsonb_object_keys(f) k WHERE k NOT IN ('field', 'op', 'value'))
       OR jsonb_typeof(f -> 'field') IS DISTINCT FROM 'string' OR char_length(f ->> 'field') NOT BETWEEN 1 AND 64
       OR jsonb_typeof(f -> 'op') IS DISTINCT FROM 'string' OR char_length(f ->> 'op') NOT BETWEEN 1 AND 32 THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

-- Whether a sort is none, or {field, direction} with a field of 1 to 64 characters and 'asc' or 'desc'.
CREATE FUNCTION public.saved_view_sort_ok(p_sort jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_sort IS NULL THEN
    RETURN true;
  END IF;
  IF jsonb_typeof(p_sort) <> 'object' THEN
    RETURN false;
  END IF;
  -- A key that is missing reads as empty, never as "unknown": a check that answers NULL would let the row through.
  RETURN COALESCE(NOT EXISTS (SELECT 1 FROM jsonb_object_keys(p_sort) k WHERE k NOT IN ('field', 'direction'))
    AND jsonb_typeof(p_sort -> 'field') = 'string' AND char_length(p_sort ->> 'field') BETWEEN 1 AND 64
    AND jsonb_typeof(p_sort -> 'direction') = 'string' AND (p_sort ->> 'direction') IN ('asc', 'desc'), false);
END;
$$;

-- Whether columns are a list of 1 to 60 different column keys of 1 to 64 characters each.
CREATE FUNCTION public.table_columns_ok(p_columns jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_columns IS NULL OR jsonb_typeof(p_columns) <> 'array' OR jsonb_array_length(p_columns) NOT BETWEEN 1 AND 60 THEN
    RETURN false;
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_columns) c WHERE jsonb_typeof(c) <> 'string' OR char_length(c #>> '{}') NOT BETWEEN 1 AND 64) THEN
    RETURN false;
  END IF;
  RETURN (SELECT count(DISTINCT c) FROM jsonb_array_elements(p_columns) c) = jsonb_array_length(p_columns);
END;
$$;

REVOKE ALL ON FUNCTION public.saved_view_name_ok(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.saved_view_filters_ok(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.saved_view_sort_ok(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.table_columns_ok(jsonb) FROM PUBLIC, anon, authenticated;

CREATE TABLE public.saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  -- The person who saved it. Only they rename, change or delete it.
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  table_name public.workspace_table NOT NULL,
  name text NOT NULL CONSTRAINT saved_views_name_check CHECK (public.saved_view_name_ok(name)),
  filters jsonb NOT NULL DEFAULT '[]'::jsonb CONSTRAINT saved_views_filters_check CHECK (public.saved_view_filters_ok(filters)),
  sort jsonb CONSTRAINT saved_views_sort_check CHECK (public.saved_view_sort_ok(sort)),
  -- The view's own columns; empty when it has none, and then the person's choice for the table applies.
  columns jsonb CONSTRAINT saved_views_columns_check CHECK (columns IS NULL OR public.table_columns_ok(columns)),
  shared boolean NOT NULL DEFAULT false,
  shared_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  shared_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saved_views_shared_is_whole CHECK (shared = (shared_at IS NOT NULL)),
  -- What a person's own choice for a view refers to: a view of the same firm and table.
  CONSTRAINT saved_views_firm_table_id UNIQUE (firm_id, table_name, id)
);

-- One name per person per table in a firm, ignoring case, shared or not (D-29); and one shared name per firm per table, so
-- nobody's tabs show two shared views of the same name. The functions turn a clash into a plain message; these are the rule.
CREATE UNIQUE INDEX saved_views_one_name_per_person ON public.saved_views (firm_id, user_id, table_name, lower(name));
CREATE UNIQUE INDEX saved_views_one_shared_name ON public.saved_views (firm_id, table_name, lower(name)) WHERE shared;

CREATE TABLE public.table_preferences (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  table_name public.workspace_table NOT NULL,
  -- Empty: the person's choice for the table (and its built-in views). A view: their own choice on that saved view, gone
  -- with the view.
  saved_view_id uuid,
  columns jsonb NOT NULL CONSTRAINT table_preferences_columns_check CHECK (public.table_columns_ok(columns)),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT table_preferences_view FOREIGN KEY (firm_id, table_name, saved_view_id)
    REFERENCES public.saved_views (firm_id, table_name, id) ON DELETE CASCADE
);

-- One choice per person per table in a firm, and one per person per saved view (D-29).
CREATE UNIQUE INDEX table_preferences_one_per_table ON public.table_preferences (firm_id, user_id, table_name) WHERE saved_view_id IS NULL;
CREATE UNIQUE INDEX table_preferences_one_per_view ON public.table_preferences (user_id, saved_view_id) WHERE saved_view_id IS NOT NULL;

ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.saved_views FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.table_preferences FROM PUBLIC, anon, authenticated;

-- What a caller sent for a view, checked with the constraints' own rules so a refusal reads plainly. The constraints stay
-- the rule: a direct write is refused by them.
CREATE FUNCTION public.saved_view_input_check(p_name text, p_filters jsonb, p_sort jsonb, p_columns jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_name IS NOT NULL AND NOT public.saved_view_name_ok(p_name) THEN
    RAISE EXCEPTION 'A view''s name is 1 to 60 characters' USING ERRCODE = '22023';
  END IF;
  IF NOT public.saved_view_filters_ok(p_filters) THEN
    RAISE EXCEPTION 'A view''s filters are a list of at most 20, each with a field, an operator and a value' USING ERRCODE = '22023';
  END IF;
  IF NOT public.saved_view_sort_ok(p_sort) THEN
    RAISE EXCEPTION 'A view''s sort is a field and a direction, asc or desc' USING ERRCODE = '22023';
  END IF;
  IF p_columns IS NOT NULL AND NOT public.table_columns_ok(p_columns) THEN
    RAISE EXCEPTION 'Columns are a list of 1 to 60 different column names' USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.saved_view_input_check(text, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;

-- A view the caller may read, for the functions below: one of a firm the caller is a current member of, and their own or
-- shared. Anything else (another firm's, another person's private one, one that does not exist) is the same refusal, so
-- nobody learns that a view exists. The row is locked for the change that follows. It runs as whoever calls it: only the
-- functions below, which run as the owner, can (the API roles hold no right to it or to the table).
CREATE FUNCTION public.saved_view_for_caller(p_view_id uuid)
RETURNS public.saved_views
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE v public.saved_views;
BEGIN
  SELECT * INTO v FROM public.saved_views s WHERE s.id = p_view_id FOR UPDATE;
  IF NOT FOUND OR public.firm_role(v.firm_id) IS NULL OR NOT (v.shared OR v.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'That view isn''t available' USING ERRCODE = 'PT404';
  END IF;
  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.saved_view_for_caller(uuid) FROM PUBLIC, anon, authenticated;

-- A unique index's refusal in plain words. Any other unique violation stays as it is.
CREATE FUNCTION public.saved_view_name_clash(p_constraint text, p_name text)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_constraint = 'saved_views_one_name_per_person' THEN
    RAISE EXCEPTION 'You already have a view called "%" on this table', p_name USING ERRCODE = 'PT409';
  ELSIF p_constraint = 'saved_views_one_shared_name' THEN
    RAISE EXCEPTION 'The firm already shares a view called "%" on this table', p_name USING ERRCODE = 'PT409';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.saved_view_name_clash(text, text) FROM PUBLIC, anon, authenticated;

-- The views of a table a current member may open: their own and the firm's shared ones, oldest first, each saying whether it
-- is the caller's, and whether the caller may change it, share it or unshare it (oldest first, then by name). Anyone else
-- is refused (42501).
CREATE FUNCTION public.list_saved_views(p_firm_id uuid, p_table text)
RETURNS TABLE (view_id uuid, name text, filters jsonb, sort jsonb, columns jsonb, shared boolean, mine boolean,
               can_change boolean, can_share boolean, can_unshare boolean, updated_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  my_role text := public.firm_role(p_firm_id);
  t public.workspace_table;
BEGIN
  IF my_role IS NULL THEN
    RAISE EXCEPTION 'Only a member of the firm can do that' USING ERRCODE = '42501';
  END IF;
  t := public.workspace_table_named(p_table);
  RETURN QUERY
  SELECT v.id, v.name, v.filters, v.sort, v.columns, v.shared, v.user_id = auth.uid(),
         v.user_id = auth.uid(),
         my_role = 'owner' AND v.user_id = auth.uid() AND NOT v.shared,
         my_role = 'owner' AND v.shared,
         v.updated_at
  FROM public.saved_views v
  WHERE v.firm_id = p_firm_id AND v.table_name = t AND (v.user_id = auth.uid() OR v.shared)
  ORDER BY v.created_at, lower(v.name), v.id;
END;
$$;

REVOKE ALL ON FUNCTION public.list_saved_views(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_saved_views(uuid, text) TO authenticated;

-- Saves the caller's own view of a table, private. Returns its id. The thirty-view ceiling counts rows, so it is read under a
-- lock on the caller's views of that table in that firm: two saves at once would otherwise each count twenty-nine (D-32).
CREATE FUNCTION public.save_view(p_firm_id uuid, p_table text, p_name text, p_filters jsonb, p_sort jsonb, p_columns jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  t public.workspace_table;
  clean_name text := btrim(COALESCE(p_name, ''));
  kept_filters jsonb := COALESCE(p_filters, '[]'::jsonb);
  vid uuid;
  violated text;
BEGIN
  IF public.firm_role(p_firm_id) IS NULL THEN
    RAISE EXCEPTION 'Only a member of the firm can do that' USING ERRCODE = '42501';
  END IF;
  t := public.workspace_table_named(p_table);
  PERFORM public.saved_view_input_check(clean_name, kept_filters, p_sort, p_columns);
  PERFORM pg_advisory_xact_lock(hashtextextended('saved_views:' || p_firm_id::text || ':' || auth.uid()::text || ':' || t, 0));
  IF (SELECT count(*) FROM public.saved_views v WHERE v.firm_id = p_firm_id AND v.user_id = auth.uid() AND v.table_name = t) >= 30 THEN
    RAISE EXCEPTION 'You can keep at most 30 views of a table. Delete one first.' USING ERRCODE = 'PT422';
  END IF;
  BEGIN
    INSERT INTO public.saved_views (firm_id, user_id, table_name, name, filters, sort, columns)
    VALUES (p_firm_id, auth.uid(), t, clean_name, kept_filters, p_sort, p_columns)
    RETURNING id INTO vid;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS violated = CONSTRAINT_NAME;
    PERFORM public.saved_view_name_clash(violated, clean_name);
    RAISE;
  END;
  RETURN vid;
END;
$$;

REVOKE ALL ON FUNCTION public.save_view(uuid, text, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_view(uuid, text, text, jsonb, jsonb, jsonb) TO authenticated;

-- Renames the caller's own view.
CREATE FUNCTION public.rename_saved_view(p_view_id uuid, p_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v public.saved_views := public.saved_view_for_caller(p_view_id);
  clean_name text := btrim(COALESCE(p_name, ''));
  violated text;
BEGIN
  IF v.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the person who saved a view can rename it' USING ERRCODE = '42501';
  END IF;
  PERFORM public.saved_view_input_check(clean_name, '[]'::jsonb, NULL, NULL);
  BEGIN
    UPDATE public.saved_views s SET name = clean_name, updated_at = now() WHERE s.id = v.id;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS violated = CONSTRAINT_NAME;
    PERFORM public.saved_view_name_clash(violated, clean_name);
    RAISE;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.rename_saved_view(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rename_saved_view(uuid, text) TO authenticated;

-- Replaces the caller's own view's filters, sort and columns (all three: what the page shows is what is kept).
CREATE FUNCTION public.change_saved_view(p_view_id uuid, p_filters jsonb, p_sort jsonb, p_columns jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v public.saved_views := public.saved_view_for_caller(p_view_id);
  kept_filters jsonb := COALESCE(p_filters, '[]'::jsonb);
BEGIN
  IF v.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the person who saved a view can change it' USING ERRCODE = '42501';
  END IF;
  PERFORM public.saved_view_input_check(NULL, kept_filters, p_sort, p_columns);
  UPDATE public.saved_views s SET filters = kept_filters, sort = p_sort, columns = p_columns, updated_at = now() WHERE s.id = v.id;
END;
$$;

REVOKE ALL ON FUNCTION public.change_saved_view(uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_saved_view(uuid, jsonb, jsonb, jsonb) TO authenticated;

-- Deletes the caller's own view, shared or not, with everyone's own column choices on it.
CREATE FUNCTION public.delete_saved_view(p_view_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v public.saved_views := public.saved_view_for_caller(p_view_id);
BEGIN
  IF v.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the person who saved a view can delete it' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.saved_views s WHERE s.id = v.id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_saved_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_saved_view(uuid) TO authenticated;

-- Shares a view with the firm: a current owner, and a view they saved (another person's private view is one they can't
-- read, so it is refused as not there). Sharing one already shared changes nothing.
CREATE FUNCTION public.share_saved_view(p_view_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v public.saved_views := public.saved_view_for_caller(p_view_id);
  violated text;
BEGIN
  IF public.firm_role(v.firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can share a view' USING ERRCODE = '42501';
  END IF;
  IF v.shared THEN
    RETURN;
  END IF;
  BEGIN
    UPDATE public.saved_views s SET shared = true, shared_by = auth.uid(), shared_at = now(), updated_at = now() WHERE s.id = v.id;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS violated = CONSTRAINT_NAME;
    PERFORM public.saved_view_name_clash(violated, v.name);
    RAISE;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.share_saved_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.share_saved_view(uuid) TO authenticated;

-- Stops sharing a view: a current owner, any shared view of the firm. It goes back to being its saver's private view.
-- Unsharing one that isn't shared changes nothing.
CREATE FUNCTION public.unshare_saved_view(p_view_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v public.saved_views := public.saved_view_for_caller(p_view_id);
BEGIN
  IF public.firm_role(v.firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can stop sharing a view' USING ERRCODE = '42501';
  END IF;
  IF NOT v.shared THEN
    RETURN;
  END IF;
  UPDATE public.saved_views s SET shared = false, shared_by = NULL, shared_at = NULL, updated_at = now() WHERE s.id = v.id;
END;
$$;

REVOKE ALL ON FUNCTION public.unshare_saved_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unshare_saved_view(uuid) TO authenticated;

-- The columns a current member sees on a table, and where the choice came from: on a saved view (p_view_id), their own
-- choice for it ('mine_for_view'), else the view's own ('view'); then their choice for the table ('mine'); else no columns
-- and 'default' (the table's defaults, in code). A view they may not read is refused as one that isn't there.
CREATE FUNCTION public.my_table_columns(p_firm_id uuid, p_table text, p_view_id uuid DEFAULT NULL)
RETURNS TABLE (columns jsonb, source text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  t public.workspace_table;
  v public.saved_views;
  found_columns jsonb;
BEGIN
  IF public.firm_role(p_firm_id) IS NULL THEN
    RAISE EXCEPTION 'Only a member of the firm can do that' USING ERRCODE = '42501';
  END IF;
  t := public.workspace_table_named(p_table);
  IF p_view_id IS NOT NULL THEN
    SELECT * INTO v FROM public.saved_views s
    WHERE s.id = p_view_id AND s.firm_id = p_firm_id AND s.table_name = t AND (s.shared OR s.user_id = auth.uid());
    IF NOT FOUND THEN
      RAISE EXCEPTION 'That view isn''t available' USING ERRCODE = 'PT404';
    END IF;
    SELECT p.columns INTO found_columns FROM public.table_preferences p WHERE p.user_id = auth.uid() AND p.saved_view_id = v.id;
    IF found_columns IS NOT NULL THEN
      RETURN QUERY SELECT found_columns, 'mine_for_view'::text;
      RETURN;
    END IF;
    IF v.columns IS NOT NULL THEN
      RETURN QUERY SELECT v.columns, 'view'::text;
      RETURN;
    END IF;
  END IF;
  SELECT p.columns INTO found_columns FROM public.table_preferences p
  WHERE p.firm_id = p_firm_id AND p.user_id = auth.uid() AND p.table_name = t AND p.saved_view_id IS NULL;
  IF found_columns IS NOT NULL THEN
    RETURN QUERY SELECT found_columns, 'mine'::text;
    RETURN;
  END IF;
  RETURN QUERY SELECT NULL::jsonb, 'default'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.my_table_columns(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_table_columns(uuid, text, uuid) TO authenticated;

-- Keeps a current member's own columns for a table (no view), or for a saved view they may read. Empty columns forget the
-- choice, so the next one down applies.
CREATE FUNCTION public.set_my_table_columns(p_firm_id uuid, p_table text, p_view_id uuid, p_columns jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE t public.workspace_table;
BEGIN
  IF public.firm_role(p_firm_id) IS NULL THEN
    RAISE EXCEPTION 'Only a member of the firm can do that' USING ERRCODE = '42501';
  END IF;
  t := public.workspace_table_named(p_table);
  IF p_view_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.saved_views s
       WHERE s.id = p_view_id AND s.firm_id = p_firm_id AND s.table_name = t AND (s.shared OR s.user_id = auth.uid())
     ) THEN
    RAISE EXCEPTION 'That view isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF p_columns IS NULL THEN
    DELETE FROM public.table_preferences p
    WHERE p.firm_id = p_firm_id AND p.user_id = auth.uid() AND p.table_name = t AND p.saved_view_id IS NOT DISTINCT FROM p_view_id;
    RETURN;
  END IF;
  PERFORM public.saved_view_input_check(NULL, '[]'::jsonb, NULL, p_columns);
  IF p_view_id IS NULL THEN
    INSERT INTO public.table_preferences (firm_id, user_id, table_name, columns)
    VALUES (p_firm_id, auth.uid(), t, p_columns)
    ON CONFLICT (firm_id, user_id, table_name) WHERE saved_view_id IS NULL
    DO UPDATE SET columns = EXCLUDED.columns, updated_at = now();
  ELSE
    INSERT INTO public.table_preferences (firm_id, user_id, table_name, saved_view_id, columns)
    VALUES (p_firm_id, auth.uid(), t, p_view_id, p_columns)
    ON CONFLICT (user_id, saved_view_id) WHERE saved_view_id IS NOT NULL
    DO UPDATE SET columns = EXCLUDED.columns, updated_at = now();
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_table_columns(uuid, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_table_columns(uuid, text, uuid, jsonb) TO authenticated;
