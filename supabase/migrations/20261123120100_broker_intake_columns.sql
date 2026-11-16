-- Slice 5.3b: close the hole D-1759 records (docs/BROKER_CRM_BUILD.md D-1759a). The trigger work_broker_started_intake (20261123120000) normalised only the chamber's three columns, so a member of the firm could
-- still write the intake's extra_answers through a direct update. The function is restated from its newest definition (20261123120000) with every line kept, and one check added after the FEIN's.

CREATE OR REPLACE FUNCTION public.work_broker_started_intake()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  k text;
  data jsonb := OLD.chamber_data;
  prov jsonb := OLD.field_provenance;
  new_data jsonb := NEW.chamber_data;
  new_prov jsonb := NEW.field_provenance;
  src jsonb;
  held jsonb;
BEGIN
  -- The role the API set (the broker's own request): a function of the owner, a job and the service role write as they like. The writer is a member who is not the intake's user.
  IF current_setting('role', true) <> 'authenticated' OR OLD.started_by IS NULL OR OLD.user_id IS NOT DISTINCT FROM auth.uid()
     OR NOT EXISTS (SELECT 1 FROM public.firm_memberships m WHERE m.firm_id = OLD.firm_id AND m.user_id = auth.uid() AND public.membership_is_current(m.valid_from, m.valid_until)) THEN
    RETURN NEW;
  END IF;
  PERFORM public.assert_firm_writable(OLD.firm_id);
  -- The FEIN is typed into the workspace by the employer only (ADR 0006): a save that changes it is refused, and nothing in it is kept.
  IF new_data -> 'fein' IS DISTINCT FROM OLD.chamber_data -> 'fein' THEN
    RAISE EXCEPTION 'The FEIN is typed by the employer' USING ERRCODE = '42501';
  END IF;
  -- The answers to a PEO's own questions are the employer's, and nothing in them can be marked as the broker's: a save that writes them is refused, the whole save, as the FEIN is (D-1759a).
  -- Every other column: the save sends the answers, the provenance, the conversation, the employer and the PEO choice (the last two are kept as they were, below) and nothing else changes. This compares
  -- the whole row but those five, so a column added later is guarded without anyone remembering to name it.
  IF (to_jsonb(NEW) - ARRAY['chamber_data', 'field_provenance', 'transcript', 'user_id', 'chosen_peo'])
     IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['chamber_data', 'field_provenance', 'transcript', 'user_id', 'chosen_peo']) THEN
    RAISE EXCEPTION 'A save by the firm changes the answers and the conversation, nothing else' USING ERRCODE = '42501';
  END IF;
  FOR k IN SELECT key FROM jsonb_object_keys(new_data) AS key WHERE new_data -> key IS DISTINCT FROM OLD.chamber_data -> key LOOP
    -- What the employer answered, closed or gave Lenore stays theirs (D-1710: an answer the employer changes becomes theirs): an answer held from any source but a broker's, the employer's own
    -- edit and a field they closed keep what they held.
    held := OLD.field_provenance -> k;
    IF held -> 'source' ->> 'kind' = 'prospect_edit' OR held ->> 'status' = 'not_applicable'
       OR (OLD.chamber_data -> k IS NOT NULL AND OLD.chamber_data -> k NOT IN ('null'::jsonb, '""'::jsonb, '[]'::jsonb)
           AND COALESCE(held -> 'source' ->> 'kind', '') <> 'broker_entry') THEN
      CONTINUE;
    END IF;
    src := jsonb_build_object('kind', 'broker_entry', 'member_id', auth.uid());
    -- What the chamber wrote from a message keeps the message and the words (P-2.4), when they are ones the readers keep: a message id that is a string, a quote cut to 200 characters.
    IF new_prov -> k -> 'source' ->> 'kind' IN ('transcript', 'broker_entry') THEN
      IF jsonb_typeof(new_prov -> k -> 'source' -> 'message_id') = 'string' AND new_prov -> k -> 'source' ->> 'message_id' <> '' THEN
        src := src || jsonb_build_object('message_id', left(new_prov -> k -> 'source' ->> 'message_id', 200));
      END IF;
      IF jsonb_typeof(new_prov -> k -> 'source' -> 'quote') = 'string'
         AND public.provenance_source_is_valid(src || jsonb_build_object('quote', left(new_prov -> k -> 'source' ->> 'quote', 200))) THEN
        src := src || jsonb_build_object('quote', left(new_prov -> k -> 'source' ->> 'quote', 200));
      END IF;
    END IF;
    data := data || jsonb_build_object(k, new_data -> k);
    prov := prov || jsonb_build_object(k, jsonb_build_object('status', 'inferred', 'source', src, 'updated_at', to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
  END LOOP;
  -- A member's save changes the answers and the conversation, nothing else: the employer, the PEO choice and the status stay as they were.
  NEW.user_id := OLD.user_id;
  NEW.chosen_peo := OLD.chosen_peo;
  NEW.chamber_data := data;
  NEW.field_provenance := prov;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.work_broker_started_intake() FROM PUBLIC, anon, authenticated;
