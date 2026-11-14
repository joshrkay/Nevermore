-- Fixes to where column choices and saved views are kept (stories CRM-S3.1b and CRM-S3.4b, after review;
-- 20261117120000_table_settings.sql, which is merged and is not edited). What changes:
--
-- 1. Views are told apart by their id, never their name. A person's private view may carry the name of a view someone else
--    shared (refusing it when the other is shared would tell an owner that a private name exists); nothing here changes for
--    that, the page passes each view's id where the query's counts ask for a name.
-- 2. A change locks a view only once the caller may read it: the membership and visibility condition is in the locking
--    select, so another firm's caller who knows an id neither waits on the row (learning it exists) nor holds its lock.
-- 3. Stored filters may hold 64 KB, not 16 (the queue accepts an "any of" filter of 100 values of 200 characters, about
--    20 KB), and a refusal for size says it is the size.
-- 4. A shared view is the firm's while it is shared: its saver changes, renames or deletes it only while a current owner.
--    An owner made an agent can't; once an owner unshares it, it is its saver's again. The list's can_change says so.
-- 5. Names: no whitespace of any kind at either end and no control, zero-width or other format character anywhere; case is
--    folded by the ICU root collation "und-x-icu" in both unique indexes, so the rule is the same whatever the database's
--    collation (under C, "Équipe" and "équipe" were two names).
-- 6. Forgetting a column choice removes the caller's own row whether or not the view can still be read (it may have been
--    unshared), with the same answer for a view that never existed.
--
-- Rows saved under the first migration's rules are kept as they are, never renamed and never deleted, and the migration
-- does not fail on them:
--   * a name the stricter rule refuses (a no-break space around it, a zero-width character in it) stays. The rule is now
--     checked when a name is written (a trigger on insert and on a change of the name) rather than by a check constraint,
--     which would be asked again on every change to the row and so would stop its saver changing its filters or sharing
--     it. Renaming it must meet the rule;
--   * two names that only the new case folding makes equal: the oldest keeps its place in the unique index and each later
--     one is marked name_clash_kept, which leaves it out of both indexes. Renaming it clears the mark (the new name must be
--     free); it can't be shared until it is renamed. A new view can't take a name already held, as before.

-- The collation names are folded by. Stock Postgres and Supabase are built with ICU; without it this stops here rather
-- than fall back to the database's own folding.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_collation WHERE collname = 'und-x-icu' AND collnamespace = 'pg_catalog'::regnamespace) THEN
    RAISE EXCEPTION 'The ICU collation "und-x-icu" is missing: saved view names can''t be compared ignoring case';
  END IF;
END $$;

-- Whether a view's name is one that can be kept: 1 to 60 characters, no whitespace of any kind at either end (ASCII, no-break,
-- the Unicode spaces, line and paragraph separators, the byte order mark), and no control, zero-width or other format
-- character anywhere (soft hyphen, bidirectional marks and isolates, joiners, word joiner, tags), so two names that look
-- the same are the same name.
CREATE OR REPLACE FUNCTION public.saved_view_name_ok(p_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT p_name IS NOT NULL AND char_length(p_name) BETWEEN 1 AND 60
    AND p_name !~ '^[[:space:]\u0085   -​    　﻿]'
    AND p_name !~ '[[:space:]\u0085   -​    　﻿]$'
    AND p_name !~ '[[:cntrl:]\u007F-\u009F­؀-؅؜۝܏᠎​-‏‪-‮⁠-⁤⁦-⁯﻿￹-￻\U000E0001\U000E0020-\U000E007F]'
$$;

-- The name rule moves from a check constraint to a trigger on writing a name (see the top of this file).
ALTER TABLE public.saved_views DROP CONSTRAINT saved_views_name_check;

CREATE FUNCTION public.saved_view_name_written()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- An empty name is left to the column's NOT NULL.
  IF NEW.name IS NOT NULL AND NOT public.saved_view_name_ok(NEW.name) THEN
    RAISE EXCEPTION 'new row for relation "saved_views" violates the name rule' USING ERRCODE = '23514', CONSTRAINT = 'saved_views_name_check';
  END IF;
  -- A name newly written is checked against every other by the unique indexes again.
  NEW.name_clash_kept := false;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.saved_view_name_written() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.saved_views ADD COLUMN name_clash_kept boolean NOT NULL DEFAULT false;

CREATE TRIGGER saved_views_name_rule
  BEFORE INSERT OR UPDATE OF name ON public.saved_views
  FOR EACH ROW EXECUTE FUNCTION public.saved_view_name_written();

-- Names already kept that the ICU folding makes equal: all but the oldest of each person's, then all but the oldest of the
-- firm's shared ones, are marked and left out of the indexes.
UPDATE public.saved_views s SET name_clash_kept = true
FROM (
  SELECT v.id, row_number() OVER (PARTITION BY v.firm_id, v.user_id, v.table_name, lower(v.name COLLATE "und-x-icu") ORDER BY v.created_at, v.id) AS n
  FROM public.saved_views v
) d
WHERE d.id = s.id AND d.n > 1;
UPDATE public.saved_views s SET name_clash_kept = true
FROM (
  SELECT v.id, row_number() OVER (PARTITION BY v.firm_id, v.table_name, lower(v.name COLLATE "und-x-icu") ORDER BY v.created_at, v.id) AS n
  FROM public.saved_views v
  WHERE v.shared AND NOT v.name_clash_kept
) d
WHERE d.id = s.id AND d.n > 1;

DROP INDEX public.saved_views_one_name_per_person;
DROP INDEX public.saved_views_one_shared_name;
CREATE UNIQUE INDEX saved_views_one_name_per_person ON public.saved_views (firm_id, user_id, table_name, lower(name COLLATE "und-x-icu"))
  WHERE NOT name_clash_kept;
CREATE UNIQUE INDEX saved_views_one_shared_name ON public.saved_views (firm_id, table_name, lower(name COLLATE "und-x-icu"))
  WHERE shared AND NOT name_clash_kept;

-- Whether filters are a list the queue's query can read: at most 20 objects of {field, op, value} (value optional), a field
-- of 1 to 64 characters, an operator of 1 to 32, at most 64 KB of JSON. What a filter's value means is the query's to judge.
CREATE OR REPLACE FUNCTION public.saved_view_filters_ok(p_filters jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE f jsonb;
BEGIN
  IF p_filters IS NULL OR jsonb_typeof(p_filters) <> 'array' OR jsonb_array_length(p_filters) > 20
     OR octet_length(p_filters::text) > 65536 THEN
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

-- What a caller sent for a view, checked with the table's own rules so a refusal reads plainly. The table's rules (the
-- check constraints, and the trigger on a name) stay the rule: a direct write is refused by them.
CREATE OR REPLACE FUNCTION public.saved_view_input_check(p_name text, p_filters jsonb, p_sort jsonb, p_columns jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_name IS NOT NULL AND NOT public.saved_view_name_ok(p_name) THEN
    RAISE EXCEPTION 'A view''s name is 1 to 60 characters, with no space around it and no invisible character in it' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_filters) = 'array' AND octet_length(p_filters::text) > 65536 THEN
    RAISE EXCEPTION 'A view''s filters can hold at most 64 KB' USING ERRCODE = '22023';
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

-- A view the caller may read, for the functions below: one of a firm the caller is a current member of, and their own or
-- shared. Anything else (another firm's, another person's private one, one that does not exist) is the same refusal, so
-- nobody learns that a view exists. The row is locked for the change that follows, and only a row the caller may read is
-- locked: the condition is in the locking select, so another firm's caller never waits on, or holds, a lock on the row.
-- It runs as whoever calls it: only the functions below, which run as the owner, can (the API roles hold no right to it or
-- to the table).
CREATE OR REPLACE FUNCTION public.saved_view_for_caller(p_view_id uuid)
RETURNS public.saved_views
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE v public.saved_views;
BEGIN
  SELECT * INTO v FROM public.saved_views s
  WHERE s.id = p_view_id AND public.firm_role(s.firm_id) IS NOT NULL AND (s.shared OR s.user_id = auth.uid())
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That view isn''t available' USING ERRCODE = 'PT404';
  END IF;
  RETURN v;
END;
$$;

-- The views of a table a current member may open: their own and the firm's shared ones, oldest first, each saying whether it
-- is the caller's, and whether the caller may change it, share it or unshare it (oldest first, then by name). Anyone else
-- is refused (42501).
CREATE OR REPLACE FUNCTION public.list_saved_views(p_firm_id uuid, p_table text)
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
         v.user_id = auth.uid() AND (NOT v.shared OR my_role = 'owner'),
         my_role = 'owner' AND v.user_id = auth.uid() AND NOT v.shared,
         my_role = 'owner' AND v.shared,
         v.updated_at
  FROM public.saved_views v
  WHERE v.firm_id = p_firm_id AND v.table_name = t AND (v.user_id = auth.uid() OR v.shared)
  ORDER BY v.created_at, lower(v.name), v.id;
END;
$$;

-- Renames the caller's own view (a shared one only while they are a current owner).
CREATE OR REPLACE FUNCTION public.rename_saved_view(p_view_id uuid, p_name text)
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
  IF v.shared AND public.firm_role(v.firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'A shared view is the firm''s: only an owner can rename it' USING ERRCODE = '42501';
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

-- Replaces the caller's own view's filters, sort and columns (all three: what the page shows is what is kept); a shared
-- one only while they are a current owner.
CREATE OR REPLACE FUNCTION public.change_saved_view(p_view_id uuid, p_filters jsonb, p_sort jsonb, p_columns jsonb)
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
  IF v.shared AND public.firm_role(v.firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'A shared view is the firm''s: only an owner can change it' USING ERRCODE = '42501';
  END IF;
  PERFORM public.saved_view_input_check(NULL, kept_filters, p_sort, p_columns);
  UPDATE public.saved_views s SET filters = kept_filters, sort = p_sort, columns = p_columns, updated_at = now() WHERE s.id = v.id;
END;
$$;

-- Deletes the caller's own view, with everyone's own column choices on it; a shared one only while they are a current owner.
CREATE OR REPLACE FUNCTION public.delete_saved_view(p_view_id uuid)
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
  IF v.shared AND public.firm_role(v.firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'A shared view is the firm''s: only an owner can delete it' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.saved_views s WHERE s.id = v.id;
END;
$$;

-- Shares a view with the firm: a current owner, and a view they saved (another person's private view is one they can't
-- read, so it is refused as not there). Sharing one already shared changes nothing.
CREATE OR REPLACE FUNCTION public.share_saved_view(p_view_id uuid)
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
  -- A view kept under the old rules beside another of the same name (see the top of this file) is shared only once renamed.
  IF v.name_clash_kept THEN
    RAISE EXCEPTION 'Another of your views has this name: rename it before sharing it' USING ERRCODE = 'PT409';
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

-- Keeps a current member's own columns for a table (no view), or for a saved view they may read. Empty columns forget the
-- choice, so the next one down applies.
CREATE OR REPLACE FUNCTION public.set_my_table_columns(p_firm_id uuid, p_table text, p_view_id uuid, p_columns jsonb)
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
  -- Forgetting removes only the caller's own row, and answers the same whether or not the view exists or can still be read:
  -- a choice kept on a view that has since been unshared can still be cleared.
  IF p_columns IS NULL THEN
    DELETE FROM public.table_preferences p
    WHERE p.firm_id = p_firm_id AND p.user_id = auth.uid() AND p.table_name = t AND p.saved_view_id IS NOT DISTINCT FROM p_view_id;
    RETURN;
  END IF;
  IF p_view_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.saved_views s
       WHERE s.id = p_view_id AND s.firm_id = p_firm_id AND s.table_name = t AND (s.shared OR s.user_id = auth.uid())
     ) THEN
    RAISE EXCEPTION 'That view isn''t available' USING ERRCODE = 'PT404';
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
