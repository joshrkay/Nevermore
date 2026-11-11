-- The class codes each of a PEO's excluded industries covers (joshrkay/Nevermore#91, L-2.1, docs/adr/0003): the
-- eligibility check compares them with the census's workers' comp class codes. A PEO words its industry exclusions
-- in its own way ("Roofing", "Cannabis dispensaries"); that wording stays in excluded_industries for people to read,
-- and the intake's industry, which is free text, is never matched against it. An industry with no codes mapped is
-- "can't tell yet".
--
-- * peo_profile_versions.excluded_industry_codes: { <industry, as excluded_industries words it>: [<class code>] },
--   empty until an admin maps one. It is part of the excluded industries rule, so it shares that rule's source and
--   date, and it is frozen with the version like everything else in it.
-- * peo_industry_codes_error() refuses a mapping that breaks the shape, whoever writes it: each key one of the
--   version's excluded industries, each value 1 to 100 different four-digit class codes.
-- * admin_save_peo_profile() takes it; admin_recheck_peo_profile() carries it into the new version. peo_catalog()
--   already returns every column of the version in use.
--
-- Deploy this migration before the front end that sends or reads excluded_industry_codes (src/data/peoEditor.ts,
-- src/data/peoProfiles.ts). The older front end never sends it, and saves with an empty mapping.

SET lock_timeout = '5s';

ALTER TABLE public.peo_profile_versions ADD COLUMN excluded_industry_codes jsonb NOT NULL DEFAULT '{}';

-- The first rule a mapping breaks, in words an admin can act on; null when it is acceptable.
CREATE OR REPLACE FUNCTION public.peo_industry_codes_error(v public.peo_profile_versions)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN jsonb_typeof(v.excluded_industry_codes) <> 'object' THEN 'The class codes are mapped to each excluded industry by name'
    WHEN EXISTS (SELECT 1 FROM jsonb_object_keys(v.excluded_industry_codes) k WHERE NOT k = ANY (COALESCE(v.excluded_industries, '{}')))
      THEN 'Class codes are mapped only to an industry the PEO excludes, as it is worded'
    WHEN EXISTS (SELECT 1 FROM jsonb_each(v.excluded_industry_codes) e
                 WHERE jsonb_typeof(e.value) <> 'array'
                    OR jsonb_array_length(e.value) NOT BETWEEN 1 AND
                      -- sync:begin peo_industry_codes_max
                      100
                      -- sync:end peo_industry_codes_max
                    OR EXISTS (SELECT 1 FROM jsonb_array_elements(e.value) c WHERE jsonb_typeof(c) <> 'string' OR c #>> '{}' !~ '^[0-9]{4}$')
                    OR (SELECT count(DISTINCT c) FROM jsonb_array_elements(e.value) c) <> jsonb_array_length(e.value))
      THEN 'Each excluded industry maps to 1 to 100 different class codes, each four digits'
  END;
$$;

CREATE OR REPLACE FUNCTION public.check_peo_industry_codes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  problem text := public.peo_industry_codes_error(NEW);
BEGIN
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER peo_profile_versions_industry_codes
  BEFORE INSERT OR UPDATE ON public.peo_profile_versions
  FOR EACH ROW EXECUTE FUNCTION public.check_peo_industry_codes();

-- As 20261111090000 wrote it, taking the mapping too.
CREATE OR REPLACE FUNCTION public.admin_save_peo_profile(p_peo_id bigint, p_profile jsonb, p_draft_revision uuid, p_in_use_version integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  draft public.peo_profile_versions;
  unknown text;
  contact jsonb;
  problem text;
  n integer := 0;
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_profile) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'A profile is an object' USING ERRCODE = '22023';
  END IF;
  SELECT string_agg(k, ', ' ORDER BY k) INTO unknown FROM jsonb_object_keys(p_profile) k
  WHERE k NOT IN ('needed_to_quote', 'needed_before_signing', 'census_layout', 'documents', 'min_headcount',
    'states_served', 'excluded_industries', 'excluded_class_codes', 'min_enrolment_percent', 'extra_questions',
    'sources', 'contacts', 'excluded_industry_codes');
  IF unknown IS NOT NULL THEN
    RAISE EXCEPTION 'A profile has no %', unknown USING ERRCODE = '22023';
  END IF;
  -- Hold the PEO still, so two saves can't both make its next version.
  PERFORM 1 FROM public.peos WHERE id = p_peo_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEO not found' USING ERRCODE = 'PT404';
  END IF;

  SELECT * INTO draft FROM public.peo_profile_versions WHERE peo_id = p_peo_id AND status = 'draft';
  IF (FOUND AND p_draft_revision IS DISTINCT FROM draft.revision)
     OR (NOT FOUND AND (p_draft_revision IS NOT NULL OR p_in_use_version IS DISTINCT FROM
       (SELECT max(version) FROM public.peo_profile_versions WHERE peo_id = p_peo_id AND status = 'published'))) THEN
    RAISE EXCEPTION 'This draft changed since you opened it. Reload to see the latest' USING ERRCODE = 'PT409';
  END IF;
  IF draft.id IS NULL THEN
    INSERT INTO public.peo_profile_versions (peo_id, version, created_by)
    VALUES (p_peo_id, (SELECT COALESCE(max(version), 0) + 1 FROM public.peo_profile_versions WHERE peo_id = p_peo_id), auth.uid())
    RETURNING * INTO draft;
  END IF;

  UPDATE public.peo_profile_versions
  SET needed_to_quote = COALESCE(public.peo_profile_text_list(p_profile -> 'needed_to_quote', 'The answers needed to quote'), '{}'),
      needed_before_signing = COALESCE(public.peo_profile_text_list(p_profile -> 'needed_before_signing', 'The answers needed before signing'), '{}'),
      census_layout = NULLIF(p_profile -> 'census_layout', 'null'::jsonb),
      documents = COALESCE(NULLIF(p_profile -> 'documents', 'null'::jsonb), '[]'::jsonb),
      min_headcount = public.peo_profile_number(p_profile -> 'min_headcount', 'The minimum headcount', true),
      states_served = public.peo_profile_text_list(p_profile -> 'states_served', 'The states served'),
      excluded_industries = public.peo_profile_text_list(p_profile -> 'excluded_industries', 'The excluded industries'),
      excluded_industry_codes = COALESCE(NULLIF(p_profile -> 'excluded_industry_codes', 'null'::jsonb), '{}'::jsonb),
      excluded_class_codes = public.peo_profile_text_list(p_profile -> 'excluded_class_codes', 'The excluded class codes'),
      min_enrolment_percent = public.peo_profile_number(p_profile -> 'min_enrolment_percent', 'The minimum enrolment', false),
      extra_questions = COALESCE(NULLIF(p_profile -> 'extra_questions', 'null'::jsonb), '[]'::jsonb),
      sources = COALESCE(NULLIF(p_profile -> 'sources', 'null'::jsonb), '{}'::jsonb),
      -- The admin who started the draft stays its creator; a seeded draft takes the first admin to save it.
      created_by = COALESCE(created_by, auth.uid()),
      revision = gen_random_uuid()
  WHERE id = draft.id
  RETURNING * INTO draft;

  DELETE FROM public.peo_contacts WHERE profile_version_id = draft.id;
  IF p_profile ? 'contacts' AND jsonb_typeof(p_profile -> 'contacts') <> 'null' THEN
    IF jsonb_typeof(p_profile -> 'contacts') <> 'array'
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_profile -> 'contacts') c WHERE jsonb_typeof(c) <> 'object') THEN
      RAISE EXCEPTION 'The contacts must be a list of people' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(p_profile -> 'contacts') >
      -- sync:begin peo_max_contacts
      20
      -- sync:end peo_max_contacts
    THEN
      RAISE EXCEPTION 'A profile names up to 20 contacts' USING ERRCODE = '22023';
    END IF;
    FOR contact IN SELECT c FROM jsonb_array_elements(p_profile -> 'contacts') c LOOP
      n := n + 1;
      problem := public.peo_contact_error(btrim(COALESCE(contact ->> 'name', '')), NULLIF(btrim(COALESCE(contact ->> 'role', '')), ''),
        NULLIF(btrim(COALESCE(contact ->> 'email', '')), ''), NULLIF(btrim(COALESCE(contact ->> 'phone', '')), ''));
      IF problem IS NOT NULL THEN
        RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.peo_contacts (profile_version_id, position, name, role, email, phone)
      VALUES (draft.id, n, btrim(COALESCE(contact ->> 'name', '')), NULLIF(btrim(COALESCE(contact ->> 'role', '')), ''),
        NULLIF(btrim(COALESCE(contact ->> 'email', '')), ''), NULLIF(btrim(COALESCE(contact ->> 'phone', '')), ''));
    END LOOP;
  END IF;
  RETURN to_jsonb(draft);
END;
$$;

-- As 20261111100000 wrote it, carrying the mapping into the new version.
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
    documents, min_headcount, states_served, excluded_industries, excluded_industry_codes, excluded_class_codes,
    min_enrolment_percent, extra_questions, sources, created_by)
  VALUES (p_peo_id, in_use.version + 1, in_use.needed_to_quote, in_use.needed_before_signing, in_use.census_layout,
    in_use.documents, in_use.min_headcount, in_use.states_served, in_use.excluded_industries, in_use.excluded_industry_codes,
    in_use.excluded_class_codes,
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

REVOKE ALL ON FUNCTION public.peo_industry_codes_error(public.peo_profile_versions) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_peo_industry_codes() FROM PUBLIC, anon, authenticated;
