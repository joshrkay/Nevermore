-- PEOs and their requirement profiles (joshrkay/Nevermore#91, L-1.1, docs/adr/0003): each PEO's ask is dated,
-- versioned data, so adding a PEO or changing what one asks is not a code change.
--
-- * public.peos: the PEOs we hold a profile for, by name (compared ignoring case). The five the app listed in
--   src/data/peoCatalog.ts are seeded here, each with an empty draft: no fact about a PEO is guessed.
-- * public.peo_profile_versions: a PEO's requirement profile, one row per version. What the PEO needs to quote and
--   needs only before signing (intake field keys), its census columns, the documents it asks for, its eligibility
--   rules (each null until sourced), its extra questions, and, part by part (each rule, and each other section),
--   the source it was checked against (a document, by title with a link when there is one, or a named person at
--   the PEO, with their role) and the date. Staleness is read from the oldest sourced part.
--   A version is a draft until an admin publishes it. Publishing freezes it: a published version is never changed
--   or deleted (a trigger refuses it, whoever writes), and the newest published version is the one in use. A
--   change after that is a new version. peo_profile_version_error() refuses a profile that breaks the shape,
--   whoever writes it.
-- * public.peo_contacts: the people at a PEO a profile version names, in a table of their own, frozen with it.
-- * admin_add_peo(), admin_save_peo_profile(), admin_publish_peo_profile(), admin_set_peo_listed(): the only
--   writers, for admins. A PEO is never deleted (a trigger refuses it): one no longer offered is marked not listed,
--   and keeps its profile history.
-- * peo_catalog(): every PEO, alphabetically, whether it is listed, and the profile in use, for anyone signed in.
--   Never the contacts, and never which admin wrote or published a version. For anyone but an advisor it also
--   leaves out the contacts' source and the name of any person at the PEO a source names (their role and the date
--   stay).
--
-- Advisors read the PEOs, the published versions and their contacts directly; admins also read drafts. Signed-in
-- prospects (guests included) read no table here: peo_catalog() is their only way in, so a person at the PEO and
-- an admin's id never reach them. Signed-out callers read nothing: public pages never name a PEO.
--
-- Nothing here belongs to an intake, so deleting an intake leaves it alone.
--
-- Deploy this migration before the front end that reads PEOs from the database (src/lib/peoCatalog.ts): it calls
-- peo_catalog(). The older front end keeps its own list and never reads these tables.

SET lock_timeout = '5s';

CREATE TABLE public.peos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  -- A PEO is never deleted. One that is not listed isn't offered to prospects or in readiness; its profile history
  -- stays, so old packets and quote requests still read against it.
  listed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

-- As long as the PEO a prospect names or a packet went to (PEO_NAME_MAX; schemaSync compares them).
ALTER TABLE public.peos ADD CONSTRAINT peos_name_check CHECK (
  name = btrim(name) AND char_length(name) BETWEEN
  -- sync:begin peo_name_limits
  1 AND 80
  -- sync:end peo_name_limits
);

-- One PEO per name, whatever the capitalisation.
CREATE UNIQUE INDEX peos_one_per_name ON public.peos (lower(name));

CREATE TABLE public.peo_profile_versions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  peo_id bigint NOT NULL REFERENCES public.peos (id),
  version integer NOT NULL CHECK (version >= 1),
  status text NOT NULL DEFAULT 'draft',
  -- Intake field keys (docs/intake-schema.v2.json) the PEO needs before it will quote, and those it needs only
  -- before the client signs.
  needed_to_quote text[] NOT NULL DEFAULT '{}',
  needed_before_signing text[] NOT NULL DEFAULT '{}',
  -- The PEO's census layout: { format, template_file, columns: [{ header, from }] }; null until sourced.
  census_layout jsonb,
  -- The documents the PEO asks for: [{ category, description }].
  documents jsonb NOT NULL DEFAULT '[]',
  -- Eligibility rules, each null until sourced (null is "can't tell yet", never "no rule").
  min_headcount integer,
  states_served text[],
  excluded_industries text[],
  excluded_class_codes text[],
  min_enrolment_percent numeric(5, 2),
  -- Questions only this PEO asks: [{ key, text, kind, choices? }].
  extra_questions jsonb NOT NULL DEFAULT '[]',
  -- Where each part was checked, and when, part by part (each eligibility rule, and the answers, the census layout,
  -- the documents, the extra questions and the contacts): { <part>: { kind, name, role?, link?, checked_on } }. A
  -- document is named by its title, with a link when there is one; a person at the PEO by their name and role.
  sources jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  published_at timestamptz,
  published_by uuid,
  UNIQUE (peo_id, version)
);

ALTER TABLE public.peo_profile_versions ADD CONSTRAINT peo_profile_versions_status_check CHECK (status IN (
  -- sync:begin peo_profile_statuses
  'draft', 'published'
  -- sync:end peo_profile_statuses
));

-- At most one draft per PEO: the version an admin is working on.
CREATE UNIQUE INDEX peo_profile_versions_one_draft ON public.peo_profile_versions (peo_id) WHERE status = 'draft';

-- The people at a PEO a profile version names. Their own table, so that only advisors read them.
CREATE TABLE public.peo_contacts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_version_id bigint NOT NULL REFERENCES public.peo_profile_versions (id) ON DELETE CASCADE,
  position integer NOT NULL,
  name text NOT NULL,
  role text,
  email text,
  phone text,
  UNIQUE (profile_version_id, position)
);

-- ---------- The shape of a profile ----------
-- The first rule a profile version breaks, in words an admin can act on; null when it is acceptable. The lists and
-- caps are the browser's too (src/data/peoProfiles.ts); src/data/schemaSync.test.ts keeps them equal.
CREATE OR REPLACE FUNCTION public.peo_profile_version_error(v public.peo_profile_versions)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  -- sync:begin peo_profile_caps
  max_census_columns constant integer := 200;
  max_documents constant integer := 30;
  max_extra_questions constant integer := 30;
  max_choices constant integer := 20;
  max_list_items constant integer := 100;
  max_header constant integer := 100;
  max_text constant integer := 500;
  max_source_name constant integer := 300;
  max_link constant integer := 2000;
  max_headcount constant integer := 100000;
  -- sync:end peo_profile_caps
  census_columns constant text[] := ARRAY[
    -- sync:begin peo_census_columns
    'first_name', 'last_name', 'dob', 'work_state', 'zip_code', 'job_title', 'annual_salary', 'compensation_type',
    'employment_type', 'classification', 'coverage_tier', 'class_code'
    -- sync:end peo_census_columns
  ];
  census_formats constant text[] := ARRAY[
    -- sync:begin peo_census_formats
    'csv', 'xlsx'
    -- sync:end peo_census_formats
  ];
  document_categories constant text[] := ARRAY[
    -- sync:begin peo_document_categories
    'employee_census', 'benefits_summary', 'payroll_report', 'workers_comp_loss_runs', 'peo_invoice', 'prior_proposal', 'other'
    -- sync:end peo_document_categories
  ];
  question_kinds constant text[] := ARRAY[
    -- sync:begin peo_question_kinds
    'text', 'yes_no', 'number', 'choice'
    -- sync:end peo_question_kinds
  ];
  profile_parts constant text[] := ARRAY[
    -- sync:begin peo_profile_parts
    'answers', 'census_layout', 'documents', 'extra_questions', 'contacts',
    'min_headcount', 'states_served', 'excluded_industries', 'excluded_class_codes', 'min_enrolment_percent'
    -- sync:end peo_profile_parts
  ];
  source_kinds constant text[] := ARRAY[
    -- sync:begin peo_source_kinds
    'document', 'person'
    -- sync:end peo_source_kinds
  ];
  layout jsonb := v.census_layout;
  item jsonb;
  bad text;
  part text;
  checked date;
  missing text;
BEGIN
  -- The answers it needs: intake fields (the roster's old name isn't one), each once, to quote or before signing.
  SELECT f INTO bad FROM unnest(v.needed_to_quote || v.needed_before_signing) f
  WHERE f IS NULL OR f = 'employees' OR public.chamber_data_field_kind(f) IS NULL LIMIT 1;
  IF FOUND THEN RETURN format('%s isn''t an answer the intake asks for', COALESCE(bad, 'An empty name')); END IF;
  IF cardinality(v.needed_to_quote || v.needed_before_signing) <> (SELECT count(DISTINCT f) FROM unnest(v.needed_to_quote || v.needed_before_signing) f) THEN
    RETURN 'Each answer is listed once: needed to quote, or needed only before signing';
  END IF;

  -- The census layout: a format we make, an optional template file, and 1 to 200 columns, each with its own
  -- header, filled from one of our census columns or left blank.
  IF layout IS NOT NULL THEN
    IF jsonb_typeof(layout) <> 'object' OR EXISTS (SELECT 1 FROM jsonb_object_keys(layout) k WHERE k NOT IN ('format', 'template_file', 'columns')) THEN
      RETURN 'A census layout has a format, a template file and columns, and nothing else';
    END IF;
    IF NOT COALESCE(layout ->> 'format' = ANY (census_formats), false) THEN
      RETURN 'A census file is CSV or xlsx';
    END IF;
    IF jsonb_typeof(layout -> 'template_file') NOT IN ('null', 'string')
       OR char_length(btrim(COALESCE(layout ->> 'template_file', 'x'))) NOT BETWEEN 1 AND max_source_name THEN
      RETURN format('A template file is named by its path, up to %s characters, or not at all', max_source_name);
    END IF;
    IF jsonb_typeof(layout -> 'columns') IS DISTINCT FROM 'array' OR jsonb_array_length(layout -> 'columns') NOT BETWEEN 1 AND max_census_columns THEN
      RETURN format('A census layout has 1 to %s columns', max_census_columns);
    END IF;
    FOR item IN SELECT c FROM jsonb_array_elements(layout -> 'columns') c LOOP
      IF jsonb_typeof(item) <> 'object' OR EXISTS (SELECT 1 FROM jsonb_object_keys(item) k WHERE k NOT IN ('header', 'from'))
         OR jsonb_typeof(item -> 'header') IS DISTINCT FROM 'string'
         OR char_length(btrim(item ->> 'header')) NOT BETWEEN 1 AND max_header THEN
        RETURN format('Each census column has a header of 1 to %s characters, and a census column it is filled from or none', max_header);
      END IF;
      IF jsonb_typeof(item -> 'from') IS DISTINCT FROM 'null' AND NOT COALESCE(item ->> 'from' = ANY (census_columns), false) THEN
        RETURN format('%s isn''t one of our census columns', item -> 'from');
      END IF;
    END LOOP;
    IF (SELECT count(DISTINCT lower(btrim(c ->> 'header'))) FROM jsonb_array_elements(layout -> 'columns') c) <> jsonb_array_length(layout -> 'columns') THEN
      RETURN 'Each census column has a header of its own';
    END IF;
  END IF;

  -- The documents: up to 30, each a kind of document we take and what exactly the PEO wants.
  IF jsonb_typeof(v.documents) <> 'array' OR jsonb_array_length(v.documents) > max_documents THEN
    RETURN format('A profile lists up to %s documents', max_documents);
  END IF;
  FOR item IN SELECT d FROM jsonb_array_elements(v.documents) d LOOP
    IF jsonb_typeof(item) <> 'object' OR EXISTS (SELECT 1 FROM jsonb_object_keys(item) k WHERE k NOT IN ('category', 'description'))
       OR NOT COALESCE(item ->> 'category' = ANY (document_categories), false) THEN
      RETURN 'Each document is one of the kinds of document the intake takes';
    END IF;
    IF jsonb_typeof(item -> 'description') IS DISTINCT FROM 'string' OR char_length(btrim(item ->> 'description')) NOT BETWEEN 1 AND max_text THEN
      RETURN format('Each document says what the PEO wants, in 1 to %s characters', max_text);
    END IF;
  END LOOP;

  -- The eligibility rules, each null until sourced.
  IF v.min_headcount IS NOT NULL AND v.min_headcount NOT BETWEEN 1 AND max_headcount THEN
    RETURN 'A minimum headcount is a whole number of employees from 1 to 100,000';
  END IF;
  IF v.states_served IS NOT NULL AND (cardinality(v.states_served) = 0
       OR EXISTS (SELECT 1 FROM unnest(v.states_served) st WHERE NOT public.is_us_state_code(st))
       OR cardinality(v.states_served) <> (SELECT count(DISTINCT st) FROM unnest(v.states_served) st)) THEN
    RETURN 'The states served are US state or territory codes such as CA, each once, and at least one';
  END IF;
  IF cardinality(v.excluded_industries) > max_list_items
     OR EXISTS (SELECT 1 FROM unnest(v.excluded_industries) i WHERE char_length(btrim(COALESCE(i, ''))) NOT BETWEEN 1 AND max_header OR i <> btrim(i)) THEN
    RETURN format('Up to %s excluded industries, each named in 1 to %s characters', max_list_items, max_header);
  END IF;
  IF cardinality(v.excluded_class_codes) > max_list_items
     OR EXISTS (SELECT 1 FROM unnest(v.excluded_class_codes) c WHERE c IS NULL OR c !~ '^[0-9]{4}$') THEN
    RETURN format('Up to %s excluded class codes, each four digits', max_list_items);
  END IF;
  IF v.min_enrolment_percent IS NOT NULL AND (v.min_enrolment_percent <= 0 OR v.min_enrolment_percent > 100) THEN
    RETURN 'A minimum enrolment is a percentage above 0 and up to 100';
  END IF;

  -- The extra questions: up to 30, each with a key of its own, its text and a kind; a choice has 2 to 20 choices.
  IF jsonb_typeof(v.extra_questions) <> 'array' OR jsonb_array_length(v.extra_questions) > max_extra_questions THEN
    RETURN format('A profile has up to %s extra questions', max_extra_questions);
  END IF;
  FOR item IN SELECT q FROM jsonb_array_elements(v.extra_questions) q LOOP
    IF jsonb_typeof(item) <> 'object' OR EXISTS (SELECT 1 FROM jsonb_object_keys(item) k WHERE k NOT IN ('key', 'text', 'kind', 'choices'))
       OR NOT COALESCE(item ->> 'key' ~ '^[a-z][a-z0-9_]{0,39}$', false) THEN
      RETURN 'Each extra question has a key of lower-case letters, digits and underscores, starting with a letter, up to 40 characters';
    END IF;
    IF jsonb_typeof(item -> 'text') IS DISTINCT FROM 'string' OR char_length(btrim(item ->> 'text')) NOT BETWEEN 1 AND max_text THEN
      RETURN format('Each extra question is 1 to %s characters', max_text);
    END IF;
    IF NOT COALESCE(item ->> 'kind' = ANY (question_kinds), false) THEN
      RETURN 'An extra question is answered as text, yes or no, a number, or a choice';
    END IF;
    IF (item ->> 'kind' = 'choice') <> (item ? 'choices') THEN
      RETURN 'A choice question lists its choices, and only a choice question has them';
    END IF;
    IF item ? 'choices' AND (jsonb_typeof(item -> 'choices') <> 'array'
         OR jsonb_array_length(item -> 'choices') NOT BETWEEN 2 AND max_choices
         OR EXISTS (SELECT 1 FROM jsonb_array_elements(item -> 'choices') c
                    WHERE jsonb_typeof(c) <> 'string' OR char_length(btrim(c #>> '{}')) NOT BETWEEN 1 AND max_header)
         OR (SELECT count(DISTINCT lower(btrim(c #>> '{}'))) FROM jsonb_array_elements(item -> 'choices') c) <> jsonb_array_length(item -> 'choices')) THEN
      RETURN format('A choice question has 2 to %s different choices, each 1 to %s characters', max_choices, max_header);
    END IF;
  END LOOP;
  IF (SELECT count(DISTINCT q ->> 'key') FROM jsonb_array_elements(v.extra_questions) q) <> jsonb_array_length(v.extra_questions) THEN
    RETURN 'Each extra question has a key of its own';
  END IF;

  -- Where each part was checked, and when. Each source belongs to a part the profile has; a rule or a census layout
  -- that is null is not sourced, so it has no source. A section with nothing in it can be sourced: the PEO asks for
  -- none.
  IF jsonb_typeof(v.sources) <> 'object' THEN
    RETURN 'The sources are one per part of the profile';
  END IF;
  FOR part, item IN SELECT key, value FROM jsonb_each(v.sources) LOOP
    IF NOT part = ANY (profile_parts) THEN
      RETURN format('A profile has no part called %s to source', part);
    END IF;
    IF (part = 'census_layout' AND v.census_layout IS NULL)
       OR (part = 'min_headcount' AND v.min_headcount IS NULL) OR (part = 'states_served' AND v.states_served IS NULL)
       OR (part = 'excluded_industries' AND v.excluded_industries IS NULL)
       OR (part = 'excluded_class_codes' AND v.excluded_class_codes IS NULL)
       OR (part = 'min_enrolment_percent' AND v.min_enrolment_percent IS NULL) THEN
      RETURN format('%s isn''t set, so it has no source', replace(part, '_', ' '));
    END IF;
    IF jsonb_typeof(item) <> 'object' OR EXISTS (SELECT 1 FROM jsonb_object_keys(item) k WHERE k NOT IN ('kind', 'name', 'role', 'link', 'checked_on'))
       OR NOT COALESCE(item ->> 'kind' = ANY (source_kinds), false) THEN
      RETURN 'A source is a document, or a named person at the PEO';
    END IF;
    IF jsonb_typeof(item -> 'name') IS DISTINCT FROM 'string' OR char_length(btrim(item ->> 'name')) NOT BETWEEN 1 AND max_source_name
       OR item ->> 'name' <> btrim(item ->> 'name') THEN
      RETURN format('A source is named, by its title or the person''s name, in 1 to %s characters', max_source_name);
    END IF;
    -- A document: its title, with a link when there is one. A person at the PEO: their name and role.
    IF item ->> 'kind' = 'person' AND (item ? 'link'
         OR jsonb_typeof(item -> 'role') IS DISTINCT FROM 'string' OR char_length(btrim(item ->> 'role')) NOT BETWEEN 1 AND max_header) THEN
      RETURN format('A person at the PEO is named with their role, of 1 to %s characters, and has no link', max_header);
    END IF;
    IF item ->> 'kind' = 'document' AND (item ? 'role' OR (item ? 'link' AND (jsonb_typeof(item -> 'link') <> 'string'
         OR item ->> 'link' !~ '^https?://[^\s]+$' OR char_length(item ->> 'link') > max_link))) THEN
      RETURN 'A document has no role, and its link, when it has one, is a web address starting http:// or https://';
    END IF;
    IF NOT COALESCE(item ->> 'checked_on' ~ '^\d{4}-\d{2}-\d{2}$', false) THEN
      RETURN 'Each source has the date it was checked, as YYYY-MM-DD';
    END IF;
    BEGIN
      checked := (item ->> 'checked_on')::date;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
      RETURN format('%s isn''t a date', item ->> 'checked_on');
    END;
    -- One day of grace: an admin ahead of the database's clock enters their own today.
    IF checked > current_date
      -- sync:begin peo_check_grace_days
      + 1
      -- sync:end peo_check_grace_days
    THEN
      RETURN 'A source can''t be checked on a date that hasn''t come';
    END IF;
  END LOOP;

  -- A published version says where every part it holds came from, and holds something.
  IF v.status = 'published' THEN
    SELECT h.part INTO missing FROM (VALUES
      ('answers', cardinality(v.needed_to_quote || v.needed_before_signing) > 0),
      ('census_layout', v.census_layout IS NOT NULL),
      ('documents', jsonb_array_length(v.documents) > 0),
      ('extra_questions', jsonb_array_length(v.extra_questions) > 0),
      ('contacts', EXISTS (SELECT 1 FROM public.peo_contacts c WHERE c.profile_version_id = v.id)),
      ('min_headcount', v.min_headcount IS NOT NULL),
      ('states_served', v.states_served IS NOT NULL),
      ('excluded_industries', v.excluded_industries IS NOT NULL),
      ('excluded_class_codes', v.excluded_class_codes IS NOT NULL),
      ('min_enrolment_percent', v.min_enrolment_percent IS NOT NULL)
    ) AS h(part, holds)
    WHERE h.holds AND NOT v.sources ? h.part
    LIMIT 1;
    IF missing IS NOT NULL THEN
      RETURN format('Name where the %s came from, and when it was checked, before publishing', replace(missing, '_', ' '));
    END IF;
    IF v.sources = '{}'::jsonb THEN
      RETURN 'A profile with nothing sourced has nothing to publish';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_peo_profile_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  problem text := public.peo_profile_version_error(NEW);
BEGIN
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER peo_profile_versions_shape
  BEFORE INSERT OR UPDATE ON public.peo_profile_versions
  FOR EACH ROW EXECUTE FUNCTION public.check_peo_profile_version();

-- A contact's first problem; null when acceptable. A check constraint calls it too, so no writer stores a bad one.
CREATE OR REPLACE FUNCTION public.peo_contact_error(p_name text, p_role text, p_email text, p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    -- sync:begin peo_contact_limits
    WHEN char_length(btrim(COALESCE(p_name, ''))) NOT BETWEEN 1 AND 200 OR p_name <> btrim(p_name) THEN 'Each contact has a name of 1 to 200 characters'
    WHEN char_length(p_role) > 100 THEN 'A contact''s role is up to 100 characters'
    WHEN p_email IS NOT NULL AND (char_length(p_email) > 254 OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN 'A contact''s email must be an email address'
    WHEN char_length(p_phone) > 40 THEN 'A contact''s phone number is up to 40 characters'
    -- sync:end peo_contact_limits
  END;
$$;

ALTER TABLE public.peo_contacts ADD CONSTRAINT peo_contacts_shape_check CHECK (public.peo_contact_error(name, role, email, phone) IS NULL);

-- ---------- A published version is frozen ----------
-- A published version is in use, or was: it is never changed, unpublished or deleted, and nor are its contacts.
-- A trigger, so the rule holds whoever writes, the table's owner included. A draft changes freely.
CREATE OR REPLACE FUNCTION public.freeze_published_peo_profile()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  version_id bigint;
BEGIN
  IF TG_TABLE_NAME = 'peo_profile_versions' THEN
    IF OLD.status = 'published' THEN
      RAISE EXCEPTION 'Version % of this profile is published, so it never changes. Save a new version instead', OLD.version
        USING ERRCODE = '55000';
    END IF;
  ELSE
    FOR version_id IN SELECT (CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.profile_version_id END)
                      UNION SELECT (CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.profile_version_id END) LOOP
      IF EXISTS (SELECT 1 FROM public.peo_profile_versions v WHERE v.id = version_id AND v.status = 'published') THEN
        RAISE EXCEPTION 'This contact belongs to a published profile version, so it never changes. Save a new version instead'
          USING ERRCODE = '55000';
      END IF;
    END LOOP;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER peo_profile_versions_frozen_once_published
  BEFORE UPDATE OR DELETE ON public.peo_profile_versions
  FOR EACH ROW EXECUTE FUNCTION public.freeze_published_peo_profile();
CREATE TRIGGER peo_contacts_frozen_once_published
  BEFORE INSERT OR UPDATE OR DELETE ON public.peo_contacts
  FOR EACH ROW EXECUTE FUNCTION public.freeze_published_peo_profile();

-- ---------- Writing ----------
-- A jsonb list of strings as text[]; null stays null. Anything else is refused, naming the list.
CREATE OR REPLACE FUNCTION public.peo_profile_text_list(v jsonb, label text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF v IS NULL OR jsonb_typeof(v) = 'null' THEN
    RETURN NULL;
  END IF;
  IF jsonb_typeof(v) <> 'array' OR EXISTS (SELECT 1 FROM jsonb_array_elements(v) e WHERE jsonb_typeof(e) <> 'string') THEN
    RAISE EXCEPTION '% must be a list of text', label USING ERRCODE = '22023';
  END IF;
  RETURN ARRAY(SELECT jsonb_array_elements_text(v));
END;
$$;

-- A jsonb number, a whole one when asked; null stays null.
CREATE OR REPLACE FUNCTION public.peo_profile_number(v jsonb, label text, whole boolean)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF v IS NULL OR jsonb_typeof(v) = 'null' THEN
    RETURN NULL;
  END IF;
  IF jsonb_typeof(v) <> 'number' OR (whole AND (v #>> '{}')::numeric <> trunc((v #>> '{}')::numeric)) THEN
    RAISE EXCEPTION '% must be a % number', label, CASE WHEN whole THEN 'whole' ELSE 'plain' END USING ERRCODE = '22023';
  END IF;
  RETURN (v #>> '{}')::numeric;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_add_peo(p_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  peo public.peos;
  clean text := btrim(COALESCE(p_name, ''));
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF clean = '' OR char_length(clean) > 80 THEN
    RAISE EXCEPTION 'A PEO''s name is 1 to 80 characters' USING ERRCODE = '22023';
  END IF;
  BEGIN
    INSERT INTO public.peos (name, created_by) VALUES (clean, auth.uid()) RETURNING * INTO peo;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION '% is already listed', clean USING ERRCODE = '23505';
  END;
  RETURN to_jsonb(peo);
END;
$$;

-- Saves a PEO's draft profile from the whole profile as the editor holds it, contacts included: the draft is
-- replaced, or, when the PEO has none, a new one is made as its next version, recording the admin who started it.
-- A published version is never touched.
CREATE OR REPLACE FUNCTION public.admin_save_peo_profile(p_peo_id bigint, p_profile jsonb)
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
    'sources', 'contacts');
  IF unknown IS NOT NULL THEN
    RAISE EXCEPTION 'A profile has no %', unknown USING ERRCODE = '22023';
  END IF;
  -- Hold the PEO still, so two saves can't both make its next version.
  PERFORM 1 FROM public.peos WHERE id = p_peo_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEO not found' USING ERRCODE = 'PT404';
  END IF;

  SELECT * INTO draft FROM public.peo_profile_versions WHERE peo_id = p_peo_id AND status = 'draft';
  IF NOT FOUND THEN
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
      excluded_class_codes = public.peo_profile_text_list(p_profile -> 'excluded_class_codes', 'The excluded class codes'),
      min_enrolment_percent = public.peo_profile_number(p_profile -> 'min_enrolment_percent', 'The minimum enrolment', false),
      extra_questions = COALESCE(NULLIF(p_profile -> 'extra_questions', 'null'::jsonb), '[]'::jsonb),
      sources = COALESCE(NULLIF(p_profile -> 'sources', 'null'::jsonb), '{}'::jsonb),
      -- The admin who started the draft stays its creator; a seeded draft takes the first admin to save it.
      created_by = COALESCE(created_by, auth.uid())
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

-- Publishes a PEO's draft: from now on it is the profile in use, and it never changes.
CREATE OR REPLACE FUNCTION public.admin_publish_peo_profile(p_peo_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v public.peo_profile_versions;
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.peo_profile_versions
  SET status = 'published', published_at = now(), published_by = auth.uid()
  WHERE peo_id = p_peo_id AND status = 'draft'
  RETURNING * INTO v;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This PEO has no draft to publish' USING ERRCODE = 'PT404';
  END IF;
  RETURN to_jsonb(v);
END;
$$;

-- Lists a PEO, or stops listing it. Nothing else about it changes.
CREATE OR REPLACE FUNCTION public.admin_set_peo_listed(p_peo_id bigint, p_listed boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  peo public.peos;
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.peos SET listed = COALESCE(p_listed, true) WHERE id = p_peo_id RETURNING * INTO peo;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEO not found' USING ERRCODE = 'PT404';
  END IF;
  RETURN to_jsonb(peo);
END;
$$;

-- A PEO is never deleted, by anyone: one that is no longer offered is marked not listed.
CREATE OR REPLACE FUNCTION public.keep_peo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'A PEO is never deleted. Mark % not listed instead', OLD.name USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER peos_never_deleted
  BEFORE DELETE ON public.peos
  FOR EACH ROW EXECUTE FUNCTION public.keep_peo();

-- ---------- Reading ----------
-- Every PEO, listed or not, alphabetically, with whether it is listed and its profile in use: the newest published
-- version, or null when none is. Never a draft, the contacts, or which admin wrote or published a version. Runs as
-- its owner, because prospects read no table here: for anyone but an advisor (or admin) it leaves out the contacts'
-- source and the name of any person at the PEO a source names, keeping their role and the date checked.
CREATE OR REPLACE FUNCTION public.peo_catalog()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH reader AS (SELECT public.is_advisor() AS advisor)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'listed', p.listed, 'profile', (
    SELECT to_jsonb(v) - 'peo_id' - 'status' - 'created_at' - 'created_by' - 'published_by'
      || jsonb_build_object('sources', CASE WHEN r.advisor THEN v.sources ELSE (
        SELECT COALESCE(jsonb_object_agg(s.key, CASE WHEN s.value ->> 'kind' = 'person' THEN s.value - 'name' ELSE s.value END), '{}'::jsonb)
        FROM jsonb_each(v.sources - 'contacts') s
      ) END)
    FROM public.peo_profile_versions v
    WHERE v.peo_id = p.id AND v.status = 'published'
    ORDER BY v.version DESC
    LIMIT 1
  )) ORDER BY lower(p.name), p.name), '[]'::jsonb)
  FROM public.peos p CROSS JOIN reader r;
$$;

-- ---------- Who reads what ----------
ALTER TABLE public.peos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peo_profile_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peo_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.peos, public.peo_profile_versions, public.peo_contacts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.peos, public.peo_profile_versions, public.peo_contacts TO authenticated;

-- Advisors only: a PEO row names the admin who added it, and a version names the people at the PEO it was checked
-- with and the admins who wrote and published it. Everyone else reads peo_catalog().
CREATE POLICY peos_advisor_read ON public.peos
  FOR SELECT TO authenticated USING ((SELECT public.is_advisor()));
CREATE POLICY peo_profile_versions_advisor_read ON public.peo_profile_versions
  FOR SELECT TO authenticated USING ((SELECT public.has_role('admin')) OR (status = 'published' AND (SELECT public.is_advisor())));
-- Advisors read the contacts of published versions; admins read every version's.
CREATE POLICY peo_contacts_advisor_read ON public.peo_contacts
  FOR SELECT TO authenticated USING (
    (SELECT public.has_role('admin'))
    -- Row security on the versions limits this to published ones for anyone but an admin.
    OR ((SELECT public.is_advisor()) AND EXISTS (SELECT 1 FROM public.peo_profile_versions v WHERE v.id = profile_version_id))
  );

-- ---------- The five PEOs ----------
-- The names src/data/peoCatalog.ts listed, each with an empty draft profile: nothing about them is sourced yet.
WITH added AS (
  INSERT INTO public.peos (name)
  VALUES ('ADP TotalSource'), ('Insperity'), ('Justworks'), ('Rippling'), ('TriNet')
  RETURNING id
)
INSERT INTO public.peo_profile_versions (peo_id, version)
SELECT id, 1 FROM added;

-- ---------- Who may call what ----------
REVOKE ALL ON FUNCTION public.peo_catalog() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.peo_catalog() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_add_peo(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_add_peo(text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_save_peo_profile(bigint, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_peo_profile(bigint, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_set_peo_listed(bigint, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_peo_listed(bigint, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.keep_peo() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_publish_peo_profile(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_publish_peo_profile(bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.check_peo_profile_version() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.peo_profile_version_error(public.peo_profile_versions) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.peo_contact_error(text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.freeze_published_peo_profile() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.peo_profile_text_list(jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.peo_profile_number(jsonb, text, boolean) FROM PUBLIC, anon, authenticated;
