-- A PEO's own census template (joshrkay/Nevermore#91, L-3.1).
--
-- Some PEOs want the census in their own spreadsheet. An admin uploads it to the census layout section of a draft
-- profile on /advisor/peos, and the layout names it (census_layout.template_file, checked in
-- 20261111090000: { id, sheet, header_row, first_row }); the census is then written under its headers. The template
-- is an upload like any other (docs/adr/0002): scanned before anyone can use it.
--
-- * public.peo_census_templates: one row per uploaded template, never edited or deleted, as the profile versions
--   that name it are kept for good. Recorded pending by admin_register_census_template(), which census-template-upload
--   calls as the admin; record_census_template_scan() (the service role, after the scan) marks it clean, blocked
--   (malware found, the file kept in quarantine) or failed (the scanner couldn't check it), once.
-- * The peo-templates bucket holds clean templates, at "<peo id>/<template id>.xlsx". Anyone signed in reads a clean
--   template's file (a PEO's blank form, nothing about an intake): prospects fill their chosen PEO's from their
--   packet page. Nobody but the service role stores one; a template not yet clean is in quarantine, which has no
--   policies (20261104130000).
-- * A profile version's census layout names a template of its own PEO, and is published (or re-checked into a new
--   version) only once that template is clean: a template still held, blocked or failed is never used.
--
-- Advisors read the templates' records (the PEOs page says why one isn't used); prospects don't.
--
-- Deploy this migration before the front end that uploads templates or fills them, and before
-- census-template-upload.

SET lock_timeout = '5s';

CREATE TABLE public.peo_census_templates (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  peo_id bigint NOT NULL REFERENCES public.peos (id),
  -- The file's name as uploaded, for people to recognise it; never a storage key.
  file_name text NOT NULL CHECK (char_length(btrim(file_name)) BETWEEN 1 AND 300),
  size_bytes integer NOT NULL CHECK (size_bytes > 0),
  file_sha256 text NOT NULL CHECK (file_sha256 ~ '^[0-9a-f]{64}$'),
  storage_path text NOT NULL UNIQUE,
  scan_status text NOT NULL DEFAULT 'pending' CHECK (scan_status IN (
    -- sync:begin census_template_statuses
    'pending', 'clean', 'blocked', 'failed'
    -- sync:end census_template_statuses
  )),
  -- The malware signature of a blocked template; nothing else.
  scan_signature text CHECK ((scan_status = 'blocked') = (scan_signature IS NOT NULL)),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid,
  scanned_at timestamptz
);

COMMENT ON TABLE public.peo_census_templates IS
  'A PEO''s own census template an admin uploaded (L-3.1): pending until scanned, then clean, blocked or failed. Only a clean one is used.';

CREATE INDEX peo_census_templates_peo ON public.peo_census_templates (peo_id);

-- Kept for good, and changed only from pending to its scan's verdict, once (record_census_template_scan).
CREATE OR REPLACE FUNCTION public.peo_census_templates_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'A census template is kept with the profile versions that name it' USING ERRCODE = '42501';
  END IF;
  IF OLD.scan_status <> 'pending' OR NEW.scan_status = 'pending'
     OR (to_jsonb(NEW) - 'scan_status' - 'scan_signature' - 'scanned_at') IS DISTINCT FROM (to_jsonb(OLD) - 'scan_status' - 'scan_signature' - 'scanned_at') THEN
    RAISE EXCEPTION 'A census template''s record changes only once, when it is scanned' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.peo_census_templates_guard() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER peo_census_templates_guard
  BEFORE UPDATE OR DELETE ON public.peo_census_templates
  FOR EACH ROW EXECUTE FUNCTION public.peo_census_templates_guard();

ALTER TABLE public.peo_census_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.peo_census_templates FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.peo_census_templates TO authenticated;
CREATE POLICY peo_census_templates_advisor_read ON public.peo_census_templates
  FOR SELECT TO authenticated USING ((SELECT public.is_advisor()));

-- ---------- Uploading ----------

-- An admin's upload, recorded pending before its scan: the new record's id and where its file is stored. Called by
-- census-template-upload as the admin, so only an admin can.
CREATE OR REPLACE FUNCTION public.admin_register_census_template(p_peo_id bigint, p_file_name text, p_size_bytes integer, p_sha256 text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_id bigint;
  t public.peo_census_templates;
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Only an admin uploads a PEO''s template' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.peos WHERE id = p_peo_id) THEN
    RAISE EXCEPTION 'PEO not found' USING ERRCODE = 'P0002';
  END IF;
  IF char_length(btrim(COALESCE(p_file_name, ''))) NOT BETWEEN 1 AND 300 OR COALESCE(p_size_bytes, 0) <= 0
     OR COALESCE(p_sha256, '') !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'A template is a named file of at least one byte, with its SHA-256' USING ERRCODE = '22023';
  END IF;
  -- Stored under the PEO and the record's id, never under what the admin called the file.
  new_id := nextval(pg_get_serial_sequence('public.peo_census_templates', 'id'));
  INSERT INTO public.peo_census_templates (id, peo_id, file_name, size_bytes, file_sha256, storage_path, uploaded_by)
  OVERRIDING SYSTEM VALUE
  VALUES (new_id, p_peo_id, btrim(p_file_name), p_size_bytes, p_sha256, p_peo_id || '/' || new_id || '.xlsx', auth.uid())
  RETURNING * INTO t;
  RETURN jsonb_build_object('id', t.id, 'storage_path', t.storage_path);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_register_census_template(bigint, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_register_census_template(bigint, text, integer, text) TO authenticated;

-- The scan's verdict, recorded once by census-template-upload (the service role): clean, blocked with the malware's
-- signature, or failed when the scanner couldn't check it (the admin uploads it again).
CREATE OR REPLACE FUNCTION public.record_census_template_scan(p_template_id bigint, p_verdict text, p_signature text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_verdict NOT IN ('clean', 'blocked', 'failed') OR (p_verdict = 'blocked') <> (NULLIF(btrim(COALESCE(p_signature, '')), '') IS NOT NULL) THEN
    RAISE EXCEPTION 'A scan is clean, failed, or blocked with the signature found' USING ERRCODE = '22023';
  END IF;
  UPDATE public.peo_census_templates
  SET scan_status = p_verdict, scan_signature = CASE WHEN p_verdict = 'blocked' THEN left(btrim(p_signature), 200) END, scanned_at = now()
  WHERE id = p_template_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.record_census_template_scan(bigint, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_census_template_scan(bigint, text, text) TO service_role;

-- ---------- The files ----------

INSERT INTO storage.buckets (id, name, public)
VALUES ('peo-templates', 'peo-templates', false)
ON CONFLICT (id) DO NOTHING;

-- Stored as application/octet-stream, as documents are, so a signed link always downloads (20261104130000).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'storage' AND table_name = 'buckets' AND column_name = 'allowed_mime_types'
  ) THEN
    UPDATE storage.buckets
    SET file_size_limit = 20 * 1024 * 1024, allowed_mime_types = ARRAY['application/octet-stream']
    WHERE id = 'peo-templates';
  END IF;
END $$;

-- Whether `p_name` is a clean template's file. Its own function: a prospect can't read the records themselves.
CREATE OR REPLACE FUNCTION public.is_clean_census_template_file(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.peo_census_templates t WHERE t.storage_path = p_name AND t.scan_status = 'clean');
$$;

REVOKE ALL ON FUNCTION public.is_clean_census_template_file(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_clean_census_template_file(text) TO authenticated;

-- Read by anyone signed in, a clean template only. No policy writes: only the service role stores one.
DROP POLICY IF EXISTS "Signed-in readers read clean census templates" ON storage.objects;
CREATE POLICY "Signed-in readers read clean census templates"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'peo-templates' AND public.is_clean_census_template_file(name));

-- ---------- A layout names its own PEO's template, used only once clean ----------

-- Runs on every saved or published version: the template a census layout names is one of this PEO's, and a version
-- is published (by admin_publish_peo_profile, or a re-check's new version) only when that template is clean.
CREATE OR REPLACE FUNCTION public.peo_profile_template_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  wanted text := NEW.census_layout #>> '{template_file,id}';
  t public.peo_census_templates;
BEGIN
  IF wanted IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO t FROM public.peo_census_templates WHERE id = wanted::bigint AND peo_id = NEW.peo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That template file isn''t one uploaded for this PEO' USING ERRCODE = '22023';
  END IF;
  IF NEW.status = 'published' AND t.scan_status <> 'clean' THEN
    RAISE EXCEPTION '%', CASE t.scan_status
      WHEN 'pending' THEN 'The PEO''s template file is still being checked for viruses, so it can''t be published yet'
      WHEN 'blocked' THEN 'The PEO''s template file was blocked by the virus check, so it can''t be used. Upload a clean copy'
      ELSE 'The PEO''s template file couldn''t be checked for viruses, so it can''t be used. Upload it again'
    END USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.peo_profile_template_check() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS peo_profile_versions_template_check ON public.peo_profile_versions;
CREATE TRIGGER peo_profile_versions_template_check
  BEFORE INSERT OR UPDATE ON public.peo_profile_versions
  FOR EACH ROW EXECUTE FUNCTION public.peo_profile_template_check();
