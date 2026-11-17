-- The opportunity's page says whether the firm started the intake it holds (D-1908). The intake a firm member starts from New quote is worked in a dialog (answers, the invitation, Remind) that
-- opened from no screen once it was closed; the opportunity's Intake panel now offers "Continue the intake" for it, and for it only, since the dialog has nothing to show for an employer's own
-- intake. The function is restated from its only definition (20261120120000), every line kept, with one field added.

CREATE OR REPLACE FUNCTION public.opportunity_intake_summary(p_intake_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'submission_id', s.id, 'file_id', NULLIF(btrim(s.file_id), ''), 'pipeline_status', w.status,
    -- Whether a member of the firm started this intake (D-1908): the one a member can enter answers in and invite the client from, so the one the page offers "Continue the intake" on.
    'started_by_firm', s.started_by IS NOT NULL,
    'certified_by', NULLIF(btrim(c.signer_name), ''), 'certified_at', c.recorded_at, 'version', c.version,
    'census_size', CASE WHEN c.id IS NULL THEN NULL
                        WHEN jsonb_typeof(c.chamber_data -> 'census') = 'array' THEN jsonb_array_length(c.chamber_data -> 'census')
                        WHEN jsonb_typeof(c.chamber_data -> 'employees') = 'array' THEN jsonb_array_length(c.chamber_data -> 'employees') END,
    -- While the draft is live (not certified): how many answers it holds, counted as the queue tells an intake that holds nothing from one that holds something
    -- (intake_holds_nothing, 20261104133000: an answer is any value that is not null, blank text, an empty list or an empty object, so an explicit false is
    -- one), and the name the prospect gave (the profile's contact name, as the chain names the contact made from them), never their email or id (D-33).
    'answered', CASE WHEN s.status = 'submitted' THEN NULL ELSE (
      SELECT count(*)::integer FROM jsonb_each(CASE WHEN jsonb_typeof(s.chamber_data) = 'object' THEN s.chamber_data ELSE '{}'::jsonb END) a
      WHERE NOT (jsonb_typeof(a.value) = 'null' OR (jsonb_typeof(a.value) = 'string' AND (a.value #>> '{}') ~ '^[[:space:]]*$')
                 OR a.value IN ('[]'::jsonb, '{}'::jsonb))) END,
    'prospect_name', CASE WHEN s.status = 'submitted' THEN NULL ELSE (SELECT NULLIF(btrim(p.contact_name), '') FROM public.profiles p WHERE p.user_id = s.user_id) END,
    -- first_field names the first open item whatever it is (a required answer first, then the other open items by field key), first_label its label when
    -- it is a required answer (the queue's own label), so the page can always name one.
    'open_items', jsonb_build_object('count', COALESCE(cardinality(i.missing_required), 0) + COALESCE(i.open_fields, 0), 'first_label', i.missing_required[1],
                                     'first_field', COALESCE(i.missing_fields[1], i.open_field_keys[1])))
  FROM public.chamber_sessions s
  LEFT JOIN public.submission_workflow w ON w.session_id = s.id
  LEFT JOIN LATERAL (
    SELECT x.* FROM public.chamber_certifications x WHERE x.session_id = s.id ORDER BY x.recorded_at DESC, x.version DESC, x.id DESC LIMIT 1) c ON true
  CROSS JOIN LATERAL public.intake_open_items(s.id) i
  WHERE s.id = p_intake_id
$$;

REVOKE ALL ON FUNCTION public.opportunity_intake_summary(uuid) FROM PUBLIC, anon, authenticated, service_role;
