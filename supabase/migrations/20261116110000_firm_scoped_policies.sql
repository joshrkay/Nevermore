-- Every table and storage rule scoped to the caller's firm (story CRM-P2.1a, with CRM-S5.1).

-- May the caller see a record of this firm that this person owns? The one question every firm-owned table asks (leads,
-- accounts, opportunities and quotes, when they exist: D-24). A current member only; then by level.
CREATE FUNCTION public.can_see_firm_record(p_firm_id uuid, p_owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.firm_role(p_firm_id) = 'owner', false)
    OR (public.is_firm_member(p_firm_id) AND EXISTS (SELECT 1 FROM public.firms f WHERE f.id = p_firm_id AND f.visibility = 'everyone'))
    OR (public.is_firm_member(p_firm_id) AND p_owner_id IS NOT DISTINCT FROM auth.uid())
    OR (
      public.firm_role(p_firm_id) = 'lead'
      AND EXISTS (
        WITH RECURSIVE my_teams (id) AS (
          SELECT m.team_id
          FROM public.firm_memberships m
          WHERE m.firm_id = p_firm_id AND m.user_id = auth.uid() AND m.team_id IS NOT NULL
            AND m.valid_from <= now() AND (m.valid_until IS NULL OR m.valid_until > now())
          UNION
          SELECT t.id FROM public.firm_teams t JOIN my_teams ON t.parent_team_id = my_teams.id
        )
        SELECT 1
        FROM public.firm_memberships o
        WHERE o.firm_id = p_firm_id AND o.user_id = p_owner_id
          AND o.valid_from <= now() AND (o.valid_until IS NULL OR o.valid_until > now())
          AND o.team_id IN (SELECT id FROM my_teams)
      )
    )
$$;

REVOKE ALL ON FUNCTION public.can_see_firm_record(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_firm_record(uuid, uuid) TO authenticated;
