-- Leads in the menu's search (docs/BROKER_READINESS_PRD.md BR-5.4; docs/BROKER_CRM_BUILD.md "## Leads catch up", D-2343 on; supabase/tests/search_leads.sql).
-- The search box finds accounts, contacts, opportunities and quotes through search_records (20261119230000), which shares one budget across those kinds.
-- Leads are asked for beside it, in a read of their own, so that function stays as it is.

SET lock_timeout = '5s';

-- The firm's leads the caller may see whose name, business, email or phone holds every word typed: the five changed most lately, and whether there are
-- more. A lead in the bin is not found, and neither is one already converted (its account and contact are found instead). Under two characters finds none.
CREATE FUNCTION public.search_leads(p_firm_id uuid, p_query text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  page constant integer := 5;
  firm uuid;
  q text := left(btrim(COALESCE(p_query, '')), 200);
  pats text[];
  found jsonb;
  n integer;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  IF char_length(regexp_replace(q, '\s', '', 'g')) < 2 THEN
    RETURN jsonb_build_object('query', q, 'rows', '[]'::jsonb, 'more', false);
  END IF;
  -- Each word as a pattern that matches it anywhere, with what LIKE reads as a wildcard taken literally. A word of digits also matches a phone's digits.
  SELECT array_agg('%' || replace(replace(replace(lower(w), '\', '\\'), '%', '\%'), '_', '\_') || '%') INTO pats
  FROM regexp_split_to_table(q, '\s+') w WHERE w <> '';
  WITH hits AS (
    SELECT l.id, l.name, l.business, l.email, l.status, l.updated_at
    FROM public.leads l
    WHERE l.firm_id = firm AND l.deleted_at IS NULL AND l.converted_at IS NULL AND public.can_see_firm_record(firm, l.owner_id)
      AND NOT EXISTS (
        SELECT 1 FROM unnest(pats) p
        WHERE NOT (lower(concat_ws(' ', l.name, l.business, l.email, l.phone)) LIKE p
                   OR (p ~ '^%[0-9]{3,}%$' AND regexp_replace(COALESCE(l.phone, ''), '\D', '', 'g') LIKE p)))
    ORDER BY l.updated_at DESC, l.id
    LIMIT page + 1
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', h.id, 'name', h.name, 'business', h.business, 'email', h.email, 'status', h.status) ORDER BY h.updated_at DESC, h.id)
                  FILTER (WHERE h.rn <= page), '[]'::jsonb), count(*)
  INTO found, n
  FROM (SELECT hits.*, row_number() OVER (ORDER BY updated_at DESC, id) AS rn FROM hits) h;
  RETURN jsonb_build_object('query', q, 'rows', found, 'more', n > page);
END;
$$;

REVOKE ALL ON FUNCTION public.search_leads(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_leads(uuid, text) TO authenticated;
