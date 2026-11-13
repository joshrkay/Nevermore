-- The funnel by source names the firm of each row. A referral code is unique within a firm, not across firms, so a member of two
-- firms that both use a code would otherwise see one merged row for it. Each row is now one firm's, and the console keys a partner's
-- counts by (firm, code). The new column is last, so every caller that reads the others by name is unchanged. Who may call it and
-- what it counts are as before.
DROP FUNCTION public.advisor_intake_sources(timestamp with time zone, timestamp with time zone);
CREATE FUNCTION public.advisor_intake_sources(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS TABLE(referral_code text, partner_name text, utm_source text, utm_medium text, utm_campaign text, started bigint, answered bigint, document_uploaded bigint, census_provided bigint, ready_to_certify bigint, email_verified bigint, certified bigint, manuscript_downloaded bigint, firm_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
BEGIN
  PERFORM public.require_advisor();
  IF p_from IS NULL OR p_to IS NULL OR p_from >= p_to THEN
    RAISE EXCEPTION 'The period must start before it ends' USING ERRCODE = '22023';
  END IF;
  IF p_to - p_from > interval '366 days' THEN
    RAISE EXCEPTION 'The funnel covers at most a year at once' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT m.referral_code, p.name, m.utm_source, m.utm_medium, m.utm_campaign,
           count(*) FILTER (WHERE m.milestone = 'started'),
           count(*) FILTER (WHERE m.milestone = 'answered'),
           count(*) FILTER (WHERE m.milestone = 'document_uploaded'),
           count(*) FILTER (WHERE m.milestone = 'census_provided'),
           count(*) FILTER (WHERE m.milestone = 'ready_to_certify'),
           count(*) FILTER (WHERE m.milestone = 'email_verified'),
           count(*) FILTER (WHERE m.milestone = 'certified'),
           count(*) FILTER (WHERE m.milestone = 'manuscript_downloaded'),
           m.firm_id
    FROM public.intake_milestones m
    LEFT JOIN public.referral_partners p ON p.code = m.referral_code AND p.firm_id = m.firm_id
    WHERE m.started_at >= p_from AND m.started_at < p_to AND public.is_firm_member(m.firm_id)
    GROUP BY m.firm_id, m.referral_code, p.name, m.utm_source, m.utm_medium, m.utm_campaign
    ORDER BY count(*) FILTER (WHERE m.milestone = 'started') DESC,
             m.referral_code NULLS LAST, m.utm_source NULLS LAST, m.utm_medium NULLS LAST, m.utm_campaign NULLS LAST
    LIMIT 200;
END;
$function$;
REVOKE ALL ON FUNCTION public.advisor_intake_sources(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_intake_sources(timestamptz, timestamptz) TO authenticated;
