-- Required items and verified fields (B-2.2), on top of the readiness gate (US-1.2,
-- 20261103110000_certification_readiness.sql). Decision D2: three answers are required, in this order:
-- the company legal name (company_name), the states of operation (states, or a work state on the census)
-- and the pay frequency (pay_frequency). The employee census is recommended: it is listed after them, never
-- blocks certification and never holds an intake back from being complete. There is no "Not applicable".
--
-- * One presence rule. public.intake_answers_present(data) says which answers an intake holds, and both
--   public.intake_missing_required (the certification gate, redefined here on top of it with the same keys,
--   order and sync block; its trigger, chamber_sessions_certification_ready and EA003, is untouched) and
--   public.intake_required_items read it. src/data/readiness.ts holds the browser's copy of the same
--   presence rule, and src/data/requiredItems.ts builds the item states on it.
-- * Present means text with something other than whitespace (trimmed as the browser's String.trim trims,
--   so a blank answer is blank on both sides), a state list with a state code in it, a census row with a
--   work state that is a code (or `state`, on a roster saved before the census contract), or a census with
--   a row. Values are read as the browser loads them: a state counts only when it is a state or territory
--   code (any case, whitespace around it ignored). Since 20261027 the database refuses any other state on
--   write, so this only tightens how the gate reads rosters saved before then (a `state` such as 'NA').
--   The census is `census`, or its older name `employees` when the intake has no `census` key.
-- * public.intake_required_items(data, provenance, verified) says where each item stands: missing,
--   conflicting, incomplete, unconfirmed or settled, with whether it is required. A present item is settled
--   when its field is confirmed (whoever confirmed it: the model, a document the prospect applied, or the
--   prospect), when an advisor verified it, or when it has no provenance at all. Every AI value carries
--   provenance, so a value without any was typed by the prospect or predates provenance. Otherwise the
--   item takes its field's status, with inferred read as unconfirmed. A provenance entry counts only when
--   the browser's parseProvenance would keep it (provenance_entry_status): nothing on the server checks
--   field_provenance. States of operation is settled by `states`, or by a settled census whose rows name a
--   work state; otherwise it takes the state of `states` when that holds anything, or else the census's
--   state when only the census names states. Both sides are tested against src/data/requiredItems.cases.json.
-- * The advisor queue's missing_required is the labels of the required items intake_required_items reports
--   missing (the rule was written out in 20261022090000, 20261024100000 and 20261029091000 before). A
--   missing census is no longer listed there: it is recommended, not required.
-- * public.session_verified_fields(id) gives the names of the fields an advisor verified on an intake to
--   its owner, under the owner's read rule on chamber_sessions (never an archived or revoked intake), and
--   to advisors. Nothing else of the review: no notes, reviewer, other review states or corrected values.
--   advisor_field_reviews itself stays advisor-only.
--
-- Nothing stored changes. Deploy order: this migration, then the front end that calls
-- session_verified_fields. The old front end keeps working against it.

-- ---------- Reading provenance as the browser does ----------

-- A provenance source parseProvenance keeps (src/data/provenance.ts, sourceSchema). A quote is at most
-- 200 UTF-16 code units, as JavaScript counts them: a character beyond U+FFFF counts twice.
CREATE OR REPLACE FUNCTION public.provenance_source_is_valid(p_source jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(jsonb_typeof(p_source) = 'object' AND CASE p_source ->> 'kind'
    WHEN 'transcript' THEN
      jsonb_typeof(p_source -> 'message_id') = 'string' AND p_source ->> 'message_id' <> ''
      AND (NOT p_source ? 'quote' OR (
        jsonb_typeof(p_source -> 'quote') = 'string'
        AND char_length(p_source ->> 'quote')
          + char_length(regexp_replace(p_source ->> 'quote', '[^\U00010000-\U0010FFFF]', '', 'g')) <= 200))
    WHEN 'document' THEN
      jsonb_typeof(p_source -> 'document_id') = 'string' AND p_source ->> 'document_id' <> ''
      AND (NOT p_source ? 'document_name' OR jsonb_typeof(p_source -> 'document_name') = 'string')
      AND (NOT p_source ? 'location' OR jsonb_typeof(p_source -> 'location') = 'string')
    WHEN 'prospect_edit' THEN true
    ELSE false
  END, false);
$$;

-- A stored provenance entry's status, or null when parseProvenance drops the entry (provenanceSchema):
-- a known status, a string updated_at, a valid source, and candidates, if any, each with a valid source.
-- also_heard is only notes, so it never drops an entry.
CREATE OR REPLACE FUNCTION public.provenance_entry_status(p_entry jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT p_entry ->> 'status'
  WHERE jsonb_typeof(p_entry) = 'object'
    AND p_entry ->> 'status' IN ('confirmed', 'inferred', 'incomplete', 'conflicting')
    AND jsonb_typeof(p_entry -> 'updated_at') = 'string'
    AND public.provenance_source_is_valid(p_entry -> 'source')
    AND (NOT p_entry ? 'candidates' OR jsonb_typeof(p_entry -> 'candidates') = 'array')
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_entry -> 'candidates') = 'array' THEN p_entry -> 'candidates' ELSE '[]'::jsonb END) c
      WHERE NOT COALESCE(jsonb_typeof(c) = 'object' AND public.provenance_source_is_valid(c -> 'source'), false)
    );
$$;

-- ---------- Presence: one rule for the gate and the items ----------

-- Which answers an intake holds: {company_name, states, census_states, pay_frequency, census}, each a
-- boolean. `states` is the state list naming a state; `census_states` a census row naming one.
CREATE OR REPLACE FUNCTION public.intake_answers_present(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
DECLARE
  -- What String.prototype.trim removes.
  ws constant text := E' \t\n\x0B\f\r\u00A0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF';
  d constant jsonb := CASE WHEN jsonb_typeof(p_data) = 'object' THEN p_data ELSE '{}'::jsonb END;
  roster jsonb;
BEGIN
  -- A `census` key, even one that isn't a list, wins over the older `employees`, as the browser loads it.
  roster := CASE
    WHEN d ? 'census' THEN CASE WHEN jsonb_typeof(d -> 'census') = 'array' THEN d -> 'census' ELSE '[]'::jsonb END
    WHEN jsonb_typeof(d -> 'employees') = 'array' THEN d -> 'employees'
    ELSE '[]'::jsonb
  END;
  RETURN jsonb_build_object(
    'company_name', COALESCE(jsonb_typeof(d -> 'company_name') = 'string' AND btrim(d ->> 'company_name', ws) <> '', false),
    'states', EXISTS (
      SELECT 1
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(d -> 'states') = 'array' THEN d -> 'states' ELSE '[]'::jsonb END) s
      WHERE jsonb_typeof(s) = 'string' AND public.is_us_state_code(upper(btrim(s #>> '{}', ws)))
    ),
    -- A row's work state, or `state` on a roster saved before the census contract, when it is a code. The
    -- browser's normalizeState also reads a full name ("Oregon"); the app has only ever stored codes.
    'census_states', EXISTS (
      SELECT 1 FROM jsonb_array_elements(roster) e
      WHERE jsonb_typeof(e) = 'object' AND public.is_us_state_code(upper(btrim(COALESCE(e ->> 'work_state', e ->> 'state'), ws)))
    ),
    'pay_frequency', COALESCE(jsonb_typeof(d -> 'pay_frequency') = 'string' AND btrim(d ->> 'pay_frequency', ws) <> '', false),
    'census', jsonb_array_length(roster) > 0
  );
END;
$$;

-- The certification gate (20261103110000_certification_readiness.sql), now on the one presence rule: the
-- same keys in the same order, which src/data/schemaSync.test.ts compares with REQUIRED_ITEMS.
CREATE OR REPLACE FUNCTION public.intake_missing_required(d jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT array_remove(ARRAY[
    -- sync:begin required_items
    CASE WHEN NOT (p ->> 'company_name')::boolean THEN 'company_name' END,
    CASE WHEN NOT ((p ->> 'states')::boolean OR (p ->> 'census_states')::boolean) THEN 'states' END,
    CASE WHEN NOT (p ->> 'pay_frequency')::boolean THEN 'pay_frequency' END
    -- sync:end required_items
  ], NULL)
  FROM (SELECT public.intake_answers_present(d) AS p) present
$$;

-- ---------- The items ----------

CREATE OR REPLACE FUNCTION public.intake_required_items(p_data jsonb, p_provenance jsonb, p_verified text[])
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
DECLARE
  prov constant jsonb := CASE WHEN jsonb_typeof(p_provenance) = 'object' THEN p_provenance ELSE '{}'::jsonb END;
  verified constant text[] := COALESCE(p_verified, '{}'::text[]);
  present constant jsonb := public.intake_answers_present(p_data);
  f text;
  entry jsonb;
  status text;
  field_state jsonb := '{}'::jsonb;
  states_item text;
BEGIN
  FOREACH f IN ARRAY ARRAY['company_name', 'states', 'pay_frequency', 'census'] LOOP
    entry := prov -> CASE WHEN f = 'census' AND NOT prov ? 'census' THEN 'employees' ELSE f END;
    status := public.provenance_entry_status(entry);
    field_state := field_state || jsonb_build_object(f, CASE
      WHEN NOT (present ->> f)::boolean THEN 'missing'
      WHEN status IS NULL OR status = 'confirmed' OR f = ANY (verified) THEN 'settled'
      WHEN status = 'inferred' THEN 'unconfirmed'
      ELSE status
    END);
  END LOOP;

  states_item := CASE
    WHEN field_state ->> 'states' = 'settled' THEN 'settled'
    WHEN field_state ->> 'census' = 'settled' AND (present ->> 'census_states')::boolean THEN 'settled'
    WHEN field_state ->> 'states' <> 'missing' THEN field_state ->> 'states'
    WHEN (present ->> 'census_states')::boolean THEN field_state ->> 'census'
    ELSE 'missing'
  END;

  RETURN jsonb_build_array(
    jsonb_build_object('item', 'company_name', 'label', 'Company legal name', 'field', 'company_name', 'required', true, 'state', field_state ->> 'company_name'),
    jsonb_build_object('item', 'states', 'label', 'States of operation', 'field', 'states', 'required', true, 'state', states_item),
    jsonb_build_object('item', 'pay_frequency', 'label', 'Pay frequency', 'field', 'pay_frequency', 'required', true, 'state', field_state ->> 'pay_frequency'),
    jsonb_build_object('item', 'census', 'label', 'Employee census', 'field', 'census', 'required', false, 'state', field_state ->> 'census')
  );
END;
$$;

COMMENT ON FUNCTION public.intake_answers_present(jsonb) IS
  'Which answers an intake holds, as the browser reads them: the one presence rule behind intake_missing_required and intake_required_items.';
COMMENT ON FUNCTION public.intake_required_items(jsonb, jsonb, text[]) IS
  'The three required items (decision D2) then the recommended census, each {item, label, field, required, state}. Mirrored by src/data/requiredItems.ts.';

-- Pure, but they call is_us_state_code, which only signed-in callers may. intake_missing_required keeps
-- the privileges 20261103110000 gave it; the gate's trigger runs as the signed-in prospect.
REVOKE ALL ON FUNCTION public.provenance_source_is_valid(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.provenance_entry_status(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.intake_answers_present(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.intake_required_items(jsonb, jsonb, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provenance_source_is_valid(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.provenance_entry_status(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.intake_answers_present(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.intake_required_items(jsonb, jsonb, text[]) TO authenticated, service_role;

-- ---------- Verified fields, for the prospect ----------

-- A census review recorded under the census's older name counts as the census's, unless the census
-- has a review under its current name (as the advisor page reads them, src/data/advisor.ts reviewMap).
CREATE OR REPLACE FUNCTION public.session_verified_fields(p_session_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT v.field ORDER BY v.field), '{}'::text[])
  FROM (
    SELECT CASE WHEN r.field = 'employees' THEN 'census' ELSE r.field END AS field
    FROM public.advisor_field_reviews r
    JOIN public.chamber_sessions s ON s.id = r.session_id
    WHERE r.session_id = p_session_id
      AND r.review_state = 'verified'
      AND (
        (s.user_id = auth.uid() AND s.status NOT IN ('archived', 'revoked'))
        OR public.is_advisor()
      )
      AND (r.field <> 'employees' OR NOT EXISTS (
        SELECT 1 FROM public.advisor_field_reviews c WHERE c.session_id = r.session_id AND c.field = 'census'
      ))
  ) v;
$$;

REVOKE ALL ON FUNCTION public.session_verified_fields(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.session_verified_fields(uuid) TO authenticated;

-- ---------- Advisor queue ----------

-- Unchanged from 20261029091000_census_advisor_review.sql (same arguments and columns) except that
-- missing_required is the required items intake_required_items reports missing (not the census).
CREATE OR REPLACE FUNCTION public.advisor_list_submissions(p_status text DEFAULT NULL)
RETURNS TABLE (
  session_id uuid,
  company_name text,
  contact_name text,
  employee_count integer,
  pipeline_status text,
  intake_status text,
  signer_name text,
  submitted_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  missing_required text[],
  open_fields integer,
  flagged_fields integer,
  verified_fields integer,
  -- The certified file id; null until certified (the app derives the same id for drafts).
  file_id text,
  -- Every state named as operating or as a census work state, upper-cased, sorted, distinct.
  states text[]
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  PERFORM public.require_advisor();
  RETURN QUERY
  WITH base AS (
    SELECT
      s.id,
      s.user_id,
      s.status,
      s.created_at,
      s.updated_at,
      s.submission,
      s.field_provenance,
      CASE WHEN jsonb_typeof(s.chamber_data) = 'object' THEN s.chamber_data ELSE '{}'::jsonb END AS d,
      w.status AS pipeline,
      CASE WHEN s.status = 'submitted' THEN (s.submission ->> 'certified_at')::timestamptz END AS certified_at,
      -- The census, or the roster an intake saved before the census contract.
      CASE
        WHEN jsonb_typeof(s.chamber_data -> 'census') = 'array' THEN s.chamber_data -> 'census'
        WHEN jsonb_typeof(s.chamber_data -> 'employees') = 'array' THEN s.chamber_data -> 'employees'
        ELSE '[]'::jsonb
      END AS roster
    FROM public.chamber_sessions s
    JOIN public.submission_workflow w ON w.session_id = s.id
    WHERE p_status IS NULL OR w.status = p_status
  )
  SELECT
    b.id,
    COALESCE(NULLIF(btrim(b.d ->> 'company_name'), ''), NULLIF(btrim(p.company_name), '')),
    COALESCE(NULLIF(btrim(p.contact_name), ''), NULLIF(btrim(b.submission ->> 'signer_name'), '')),
    CASE WHEN jsonb_typeof(b.d -> 'employee_count') = 'number' THEN (b.d ->> 'employee_count')::numeric::integer END,
    b.pipeline,
    b.status,
    b.submission ->> 'signer_name',
    b.certified_at,
    b.created_at,
    b.updated_at,
    -- The required items still missing, in order: what the gate refuses a certification for. The
    -- recommended census isn't one. An advisor's verification never supplies a missing value, so the
    -- verified fields aren't read.
    ARRAY(
      SELECT ri.item ->> 'label'
      FROM jsonb_array_elements(public.intake_required_items(b.d, b.field_provenance, '{}'::text[]))
        WITH ORDINALITY AS ri(item, ord)
      WHERE ri.item ->> 'state' = 'missing' AND (ri.item ->> 'required')::boolean
      ORDER BY ri.ord
    ),
    -- Fields still inferred, incomplete or conflicting that no advisor has verified.
    (SELECT count(*)::integer
       FROM jsonb_each(CASE WHEN jsonb_typeof(b.field_provenance) = 'object' THEN b.field_provenance ELSE '{}'::jsonb END) fp
      WHERE fp.value ->> 'status' IN ('inferred', 'incomplete', 'conflicting')
        AND NOT EXISTS (
          SELECT 1 FROM public.advisor_field_reviews r
          WHERE r.session_id = b.id AND r.field = fp.key AND r.review_state = 'verified'
        )),
    (SELECT count(*)::integer FROM public.advisor_field_reviews r
      WHERE r.session_id = b.id AND r.review_state IN ('incomplete', 'follow_up')),
    (SELECT count(*)::integer FROM public.advisor_field_reviews r
      WHERE r.session_id = b.id AND r.review_state = 'verified'),
    NULLIF(btrim(b.submission ->> 'file_id'), ''),
    ARRAY(
      SELECT DISTINCT upper(btrim(x.st)) AS abbr
      FROM (
        SELECT st FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(b.d -> 'states') = 'array' THEN b.d -> 'states' ELSE '[]'::jsonb END) AS st
        UNION ALL
        SELECT COALESCE(e ->> 'work_state', e ->> 'state') FROM jsonb_array_elements(b.roster) AS e
      ) x
      WHERE btrim(COALESCE(x.st, '')) <> ''
      ORDER BY abbr
    )
  FROM base b
  LEFT JOIN public.profiles p ON p.user_id = b.user_id
  -- Certified is the intake's status; its date only orders the group. Rows submitted before the
  -- server stamped certifications have no certified_at: they stay in the group, after the stamped ones.
  ORDER BY (b.status = 'submitted') DESC, b.certified_at DESC NULLS LAST, b.updated_at DESC, b.id;
END;
$$;

REVOKE ALL ON FUNCTION public.advisor_list_submissions(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_list_submissions(text) TO authenticated;
