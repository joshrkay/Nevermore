-- Which of a page of leads the caller may convert (CRM-L1.1's row action "Convert"; joshrkay/Nevermore#190).
--
-- docs/BROKER_CRM_STORIES.md lists "Row action: Convert" for the leads table. D-1659 and D-1688 left it off ("no dead buttons", D-402) until a lead could be
-- converted, and then it was never added back. The table must offer Convert only where the database would allow it, as the accounts table offers its row
-- actions only on the accounts accounts_can_change names (D-24). This is that question for leads, asked once for a page (the 50 rows it draws, at most 100 ids).
--
-- A lead can be converted when the caller may see it and change it by the level rule (lead_to_change: D-809), it is New or Working and not in the bin
-- (lead_read_only_reason: a converted lead, one that is Not a fit, which is reopened first, and one in the bin are read, not converted, D-1651), and the firm
-- is not closing and the caller is not a Nevermore support session (assert_firm_writable: ADR 0023, ADR 0024). It reads exactly what convert_lead reads before
-- it changes anything, so the button and the database cannot disagree. Reads nothing of another firm: a member of the firm the call acts for only
-- (firm_to_act_for: 42501). Asked again at each page; it changes nothing.

SET lock_timeout = '5s';

CREATE FUNCTION public.leads_can_convert(p_firm_id uuid, p_ids uuid[])
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  IF p_ids IS NULL THEN
    RETURN '{}';
  END IF;
  IF cardinality(p_ids) > 100 THEN
    RAISE EXCEPTION 'Ask about 100 leads at most' USING ERRCODE = '22023';
  END IF;
  -- A closing firm and a support session change nothing: no lead of theirs is convertible (the refusal is PT423, as assert_firm_writable raises it).
  BEGIN
    PERFORM public.assert_firm_writable(firm);
  EXCEPTION WHEN SQLSTATE 'PT423' THEN
    RETURN '{}';
  END;
  RETURN COALESCE((
    SELECT array_agg(l.id ORDER BY l.id) FROM public.leads l
    WHERE l.firm_id = firm AND l.id = ANY (p_ids)
      AND public.lead_visible(l)
      AND public.can_change_firm_record(l.firm_id, l.owner_id)
      AND public.lead_read_only_reason(l) IS NULL), '{}');
END;
$$;

REVOKE ALL ON FUNCTION public.leads_can_convert(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leads_can_convert(uuid, uuid[]) TO authenticated;
