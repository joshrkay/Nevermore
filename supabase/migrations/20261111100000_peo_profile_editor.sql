-- The PEOs page's admin actions (joshrkay/Nevermore#91, L-1.2, docs/adr/0003): what the editor needs besides saving
-- and publishing a draft (20261111090000_peo_requirement_profiles.sql).
--
-- * admin_recheck_peo_profile(): "Checked again, nothing changed". A re-check is a new version (published versions
--   are never edited, dates included): it copies the profile in use, contacts and all, gives the parts re-checked
--   their new source and date, and publishes it at once. Every other part keeps its source. Refused while the PEO has
--   a draft, which would otherwise lose its version number: publish or discard the draft first.
-- * admin_discard_peo_draft(): drops a PEO's draft and its contacts. A draft was never used, so nothing is lost; a
--   published version is never touched.
--
-- Both are for admins only, SECURITY DEFINER with a pinned search_path, and refuse everyone else (42501).
--
-- Deploy this migration before the front end that calls them (src/pages/advisor/AdvisorPeosPage.tsx). The older
-- front end never calls them.

SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.admin_recheck_peo_profile(p_peo_id bigint, p_sources jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  in_use public.peo_profile_versions;
  v public.peo_profile_versions;
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_sources) IS DISTINCT FROM 'object' OR p_sources = '{}'::jsonb THEN
    RAISE EXCEPTION 'Name at least one part you checked again, with where and when' USING ERRCODE = '22023';
  END IF;
  -- Hold the PEO still, so a save can't make a draft (or another re-check a version) at the same time.
  PERFORM 1 FROM public.peos WHERE id = p_peo_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEO not found' USING ERRCODE = 'PT404';
  END IF;
  SELECT * INTO in_use FROM public.peo_profile_versions
  WHERE peo_id = p_peo_id AND status = 'published' ORDER BY version DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This PEO has no profile in use to check again' USING ERRCODE = 'PT404';
  END IF;
  IF EXISTS (SELECT 1 FROM public.peo_profile_versions WHERE peo_id = p_peo_id AND status = 'draft') THEN
    RAISE EXCEPTION 'This PEO has a draft. Publish or discard it before recording a re-check' USING ERRCODE = '55000';
  END IF;

  -- The same content as the version in use, as the next version; the shape check refuses a source for a part it
  -- doesn't hold, an unknown part or a bad source.
  INSERT INTO public.peo_profile_versions (peo_id, version, needed_to_quote, needed_before_signing, census_layout,
    documents, min_headcount, states_served, excluded_industries, excluded_class_codes, min_enrolment_percent,
    extra_questions, sources, created_by)
  VALUES (p_peo_id, in_use.version + 1, in_use.needed_to_quote, in_use.needed_before_signing, in_use.census_layout,
    in_use.documents, in_use.min_headcount, in_use.states_served, in_use.excluded_industries, in_use.excluded_class_codes,
    in_use.min_enrolment_percent, in_use.extra_questions, in_use.sources || p_sources, auth.uid())
  RETURNING * INTO v;
  INSERT INTO public.peo_contacts (profile_version_id, position, name, role, email, phone)
  SELECT v.id, position, name, role, email, phone FROM public.peo_contacts WHERE profile_version_id = in_use.id;

  UPDATE public.peo_profile_versions
  SET status = 'published', published_at = now(), published_by = auth.uid()
  WHERE id = v.id
  RETURNING * INTO v;
  RETURN to_jsonb(v);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_discard_peo_draft(p_peo_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  -- Its contacts go with it (ON DELETE CASCADE); the freeze triggers let a draft go.
  DELETE FROM public.peo_profile_versions WHERE peo_id = p_peo_id AND status = 'draft';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This PEO has no draft to discard' USING ERRCODE = 'PT404';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_recheck_peo_profile(bigint, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_recheck_peo_profile(bigint, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_discard_peo_draft(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_discard_peo_draft(bigint) TO authenticated;
