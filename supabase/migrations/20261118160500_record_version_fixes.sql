-- The version for the conflict check, review fixes (story CRM-S2.4b; docs/BROKER_CRM_BUILD.md D-46, D-104, D-152 to D-157; 20261118160000).
--
--   A save that names a version HIGHER than the partner's current one is refused (22023, a plain sentence). It used to be answered with a conflict
--   with nothing in `changed`, which said "someone else changed this" when nobody had. A missing, zero or negative version was already refused.
--   The order of checks is unchanged: advisor, firm, write guard, input, version present, then the update, "no such code", and now this.
-- advisor_update_referral_partner is restated from its latest definition (20261118160000) with every rule it had and its grants.

CREATE OR REPLACE FUNCTION public.advisor_update_referral_partner(p_code text, p_name text, p_kind text, p_firm_id uuid DEFAULT NULL::uuid, p_version integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  problem text := public.referral_partner_input_error(p_name, p_kind);
  firm uuid;
  code_in text := lower(btrim(COALESCE(p_code, '')));
  changed public.referral_partners;
  cur public.referral_partners;
BEGIN
  PERFORM public.require_advisor();
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  IF p_version IS NULL OR p_version < 1 THEN
    RAISE EXCEPTION 'This save did not say which version of the partner it started from, so it was refused. Reload the page and try again.'
      USING ERRCODE = '22023';
  END IF;
  -- The one statement that orders two saves: it touches the row only if it is still at the version the person started from. A second save
  -- from the same version waits for the first's row, then finds the version moved and touches nothing.
  UPDATE public.referral_partners
  SET name = btrim(p_name), kind = p_kind, updated_at = now(), updated_by_email = auth.jwt() ->> 'email'
  WHERE firm_id = firm AND code = code_in AND version = p_version
  RETURNING * INTO changed;
  IF changed.code IS NOT NULL THEN
    RETURN jsonb_build_object('conflict', false, 'record', to_jsonb(changed));
  END IF;
  SELECT * INTO cur FROM public.referral_partners r WHERE r.firm_id = firm AND r.code = code_in;
  IF cur.code IS NULL THEN
    RAISE EXCEPTION 'No partner has that code' USING ERRCODE = 'PT404';
  END IF;
  -- A version the partner has never had is not "someone else changed it": nobody did. Refused like a missing or negative one. Only a person
  -- the checks above let through gets here, so it says nothing to anyone else.
  IF p_version > cur.version THEN
    RAISE EXCEPTION 'This save names a version of the partner that does not exist, so it was refused. Reload the page and try again.'
      USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object(
    'conflict', true,
    'currentVersion', cur.version,
    'current', jsonb_build_object('name', cur.name, 'kind', cur.kind),
    'changed', public.record_version_changes(firm, 'referral_partners', cur.code, p_version, cur.version));
END;
$function$;

REVOKE ALL ON FUNCTION public.advisor_update_referral_partner(text, text, text, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_update_referral_partner(text, text, text, uuid, integer) TO authenticated;
