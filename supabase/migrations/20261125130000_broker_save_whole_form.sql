-- A broker's save of the chamber, as the browser makes it (D-1906). Two rules refused every save a member of the firm made in an intake the firm started, so what a broker typed or told Lenore was shown
-- on screen and never kept ("Not saved. Retry", and a reload lost it):
--   * public.refuse_forged_broker_entries (20261123120000) refused the broker-entry marks the chamber had already put on what the member entered, though public.work_broker_started_intake
--     (20261123120100) throws away what a save says about sources and writes its own. A member's own save is no longer asked: a save by anyone else is still refused, as before.
--   * public.work_broker_started_intake read the empty FEIN the whole form carries ("fein": null) as a change of a FEIN that was no key at all in an intake started empty, and refused it ("The FEIN is typed by
--     the employer"); past that, it would have marked every empty answer in the form as the broker's. An answer not given (a JSON null, "" or an empty list, or no key) is now the same thing wherever it is
--     compared, and a FEIN that is given, changed or blanked is refused as it always was.
-- Both functions are restated from their newest definitions (20261123120000 and 20261123120100), every line kept, with the three additions marked D-1906.

CREATE OR REPLACE FUNCTION public.refuse_forged_broker_entries()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  k text;
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') OR jsonb_typeof(NEW.field_provenance) IS DISTINCT FROM 'object' THEN
    RETURN NEW;
  END IF;
  -- A member of the firm saving an intake the firm started is the broker's own save (D-1906). The chamber marks what they entered as a broker's already, as it is drawn on screen, and
  -- work_broker_started_intake (the trigger that runs after this one) discards what a save says about sources and writes its own, naming the caller: so the marks in this save change
  -- nothing, and refusing them stopped every save a broker made. The condition is the one that trigger starts from, so the two always agree on whose save this is.
  IF TG_OP = 'UPDATE' THEN
    IF current_setting('role', true) = 'authenticated' AND OLD.started_by IS NOT NULL AND OLD.user_id IS DISTINCT FROM auth.uid()
       AND EXISTS (SELECT 1 FROM public.firm_memberships m WHERE m.firm_id = OLD.firm_id AND m.user_id = auth.uid() AND public.membership_is_current(m.valid_from, m.valid_until)) THEN
      RETURN NEW;
    END IF;
  END IF;
  FOR k IN SELECT e.key FROM jsonb_each(NEW.field_provenance) e WHERE e.value -> 'source' ->> 'kind' = 'broker_entry' LOOP
    IF TG_OP = 'INSERT' OR (OLD.field_provenance -> k -> 'source') IS DISTINCT FROM (NEW.field_provenance -> k -> 'source') THEN
      RAISE EXCEPTION 'Only the firm''s members enter answers as the broker' USING ERRCODE = '42501';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

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
  -- An answer not given is a JSON null (or "" or an empty list) in the save and no key at all in an intake that was started empty: the same thing, never a change (D-1906).
  IF (CASE WHEN new_data -> 'fein' IN ('null'::jsonb, '""'::jsonb, '[]'::jsonb) THEN NULL ELSE new_data -> 'fein' END)
     IS DISTINCT FROM (CASE WHEN OLD.chamber_data -> 'fein' IN ('null'::jsonb, '""'::jsonb, '[]'::jsonb) THEN NULL ELSE OLD.chamber_data -> 'fein' END) THEN
    RAISE EXCEPTION 'The FEIN is typed by the employer' USING ERRCODE = '42501';
  END IF;
  -- The answers to a PEO's own questions are the employer's, and nothing in them can be marked as the broker's: a save that writes them is refused, the whole save, as the FEIN is (D-1759a).
  -- Every other column: the save sends the answers, the provenance, the conversation, the employer and the PEO choice (the last two are kept as they were, below) and nothing else changes. This compares
  -- the whole row but those five, so a column added later is guarded without anyone remembering to name it.
  IF (to_jsonb(NEW) - ARRAY['chamber_data', 'field_provenance', 'transcript', 'user_id', 'chosen_peo'])
     IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['chamber_data', 'field_provenance', 'transcript', 'user_id', 'chosen_peo']) THEN
    RAISE EXCEPTION 'A save by the firm changes the answers and the conversation, nothing else' USING ERRCODE = '42501';
  END IF;
  -- The chamber saves the whole form, so every answer not given is in the save as an empty value; one that was not held either is not a change, and is not marked as the broker's (D-1906).
  FOR k IN SELECT key FROM jsonb_object_keys(new_data) AS key
           WHERE new_data -> key IS DISTINCT FROM OLD.chamber_data -> key
             AND NOT ((new_data -> key IS NULL OR new_data -> key IN ('null'::jsonb, '""'::jsonb, '[]'::jsonb))
                      AND (OLD.chamber_data -> key IS NULL OR OLD.chamber_data -> key IN ('null'::jsonb, '""'::jsonb, '[]'::jsonb))) LOOP
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

REVOKE ALL ON FUNCTION public.refuse_forged_broker_entries() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.work_broker_started_intake() FROM PUBLIC, anon, authenticated;
