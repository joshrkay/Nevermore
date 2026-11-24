-- Merging two leads (docs/BROKER_READINESS_PRD.md BR-5.4; story CRM-S4.3: "two accounts, two contacts or two leads can be merged"; docs/BROKER_CRM_BUILD.md
-- "## Leads catch up", D-2360 on; supabase/tests/merge_leads.sql). The account and contact merge (20261121100000_merge_records.sql) left leads out
-- (D-649). This is the same merge by the same rules (D-640, D-643, D-644): the person says which lead is kept and, for each field that differs, whose
-- value; everything on the removed lead moves to the kept one; the removed lead's history is copied and its old address leads to the kept lead.

SET lock_timeout = '5s';

-- ---------- 1. A lead's old address ----------
ALTER TABLE public.merged_records DROP CONSTRAINT merged_records_kind_check;
ALTER TABLE public.merged_records ADD CONSTRAINT merged_records_kind_check CHECK (kind IN ('account', 'contact', 'lead'));

-- ---------- 2. Why two leads cannot be merged by this caller, in words, or NULL ----------
-- The caller has already shown both are leads of the firm that the person may see. Internal.
CREATE FUNCTION public.crm_merge_leads_problem(k public.leads, r public.leads)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN k.id = r.id THEN 'Choose two different leads.'
    -- A converted lead is its account now: what it held is there, and a converted lead can't be changed.
    WHEN k.status = 'converted' THEN format('%s is converted. Merge the account it became instead.', k.name)
    WHEN r.status = 'converted' THEN format('%s is converted. Merge the account it became instead.', r.name)
    WHEN NOT public.can_change_firm_record(k.firm_id, k.owner_id) THEN format('You can''t change %s. %s', k.name, public.lead_change_words(k.owner_id))
    WHEN NOT public.can_change_firm_record(r.firm_id, r.owner_id) THEN format('You can''t change %s. %s', r.name, public.lead_change_words(r.owner_id))
  END
$$;

REVOKE ALL ON FUNCTION public.crm_merge_leads_problem(public.leads, public.leads) FROM PUBLIC, anon, authenticated, service_role;

-- The fields of a lead a merge chooses between, in the order the screen lists them.
CREATE FUNCTION public.merge_lead_fields()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT ARRAY[
    -- sync:begin merge_lead_fields
    'name', 'title', 'business', 'email', 'phone', 'city', 'state', 'employees', 'current_provider', 'note', 'status', 'owner'
    -- sync:end merge_lead_fields
  ]
$$;

REVOKE ALL ON FUNCTION public.merge_lead_fields() FROM PUBLIC, anon, authenticated;

-- ---------- 3. What a merge of two leads would do, before it is done ----------
-- Answers {problem, differs, kept, removed, moves}: why this person can't merge them (or null), the fields that differ, each lead's fields with its owner's
-- name and its version, and how much moves. Refused: not a member (42501); either lead not there, in the bin, or not the caller's to see (PT404).
CREATE FUNCTION public.merge_leads_preview(p_firm_id uuid, p_kept_id uuid, p_removed_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  k public.leads;
  r public.leads;
  differs text[];
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  SELECT * INTO k FROM public.leads x WHERE x.id = p_kept_id AND x.firm_id = firm AND x.deleted_at IS NULL;
  SELECT * INTO r FROM public.leads x WHERE x.id = p_removed_id AND x.firm_id = firm AND x.deleted_at IS NULL;
  IF k.id IS NULL OR r.id IS NULL OR NOT public.can_see_firm_record(firm, k.owner_id) OR NOT public.can_see_firm_record(firm, r.owner_id) THEN
    RAISE EXCEPTION 'That lead isn''t available' USING ERRCODE = 'PT404';
  END IF;
  SELECT COALESCE(array_agg(d.f ORDER BY d.n), '{}') INTO differs FROM (VALUES
    (1, 'name', k.name IS DISTINCT FROM r.name), (2, 'title', k.title IS DISTINCT FROM r.title), (3, 'business', k.business IS DISTINCT FROM r.business),
    (4, 'email', k.email IS DISTINCT FROM r.email), (5, 'phone', k.phone IS DISTINCT FROM r.phone), (6, 'city', k.city IS DISTINCT FROM r.city),
    (7, 'state', k.state IS DISTINCT FROM r.state), (8, 'employees', k.employees IS DISTINCT FROM r.employees),
    (9, 'current_provider', k.current_provider IS DISTINCT FROM r.current_provider), (10, 'note', k.note IS DISTINCT FROM r.note),
    (11, 'status', (k.status, k.not_fit_reason) IS DISTINCT FROM (r.status, r.not_fit_reason)), (12, 'owner', k.owner_id IS DISTINCT FROM r.owner_id)) AS d (n, f, different)
  WHERE d.different;
  RETURN jsonb_build_object(
    'problem', public.crm_merge_leads_problem(k, r), 'differs', to_jsonb(differs),
    'kept', public.crm_lead_fields(k) || jsonb_build_object('owner', CASE WHEN k.owner_id IS NULL THEN NULL ELSE jsonb_build_object('id', k.owner_id, 'name', public.crm_person_name(k.owner_id)) END),
    'removed', public.crm_lead_fields(r) || jsonb_build_object('owner', CASE WHEN r.owner_id IS NULL THEN NULL ELSE jsonb_build_object('id', r.owner_id, 'name', public.crm_person_name(r.owner_id)) END),
    'moves', jsonb_build_object(
      'activities', (SELECT count(*) FROM public.activities a WHERE a.lead_id = r.id),
      'emails', (SELECT count(*) FROM public.conversation_messages m JOIN public.conversations c ON c.id = m.conversation_id WHERE c.lead_id = r.id),
      'labels', (SELECT count(*) FROM public.lead_labels l WHERE l.lead_id = r.id AND NOT EXISTS (SELECT 1 FROM public.lead_labels y WHERE y.lead_id = k.id AND y.label_id = l.label_id))));
END;
$$;

REVOKE ALL ON FUNCTION public.merge_leads_preview(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_leads_preview(uuid, uuid, uuid) TO authenticated;

-- ---------- 4. Merging two leads ----------
-- Answers {record: <the kept lead's fields>, removed: {id, name}, moved: {activities, emails, labels}}.
-- p_choices: {"phone": "removed", ...} among merge_lead_fields(); a field not named keeps the kept lead's value, or takes the removed one's when the kept one
-- is blank (D-640). "status" carries the reason a lead is not a fit with it. The owner is the kept lead's unless the removed one's is chosen. Where the lead
-- came from stays the kept lead's.
-- Refused, in this order: not a member (42501); a closing firm or Nevermore support (PT423); either lead not there, in the bin or not the caller's to see
-- (PT404); the same lead twice or a converted lead (22023), or a lead the caller may not change (42501), each in words; choices that make no sense (22023);
-- no version, or a version either lead is no longer at (22023, 40001); a value no lead may hold (22023).
-- Locks: both leads FOR UPDATE, lowest id first, so a merge of A into B and one of B into A order themselves and a save of either waits.
CREATE FUNCTION public.merge_leads(
  p_kept_id uuid, p_removed_id uuid, p_choices jsonb DEFAULT '{}'::jsonb, p_kept_version integer DEFAULT NULL, p_removed_version integer DEFAULT NULL, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  k public.leads;
  r public.leads;
  said text;
  ch jsonb := COALESCE(p_choices, '{}'::jsonb);
  v public.leads;
  take_status boolean;
  acts integer;
  mails integer := 0;
  labs integer;
  k_conv uuid;
  r_conv uuid;
  done public.leads;
  who uuid := auth.uid();
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  PERFORM 1 FROM public.leads x WHERE x.firm_id = firm AND x.id IN (p_kept_id, p_removed_id) ORDER BY x.id FOR UPDATE;
  SELECT * INTO k FROM public.leads x WHERE x.id = p_kept_id AND x.firm_id = firm AND x.deleted_at IS NULL;
  SELECT * INTO r FROM public.leads x WHERE x.id = p_removed_id AND x.firm_id = firm AND x.deleted_at IS NULL;
  IF k.id IS NULL OR r.id IS NULL OR NOT public.can_see_firm_record(firm, k.owner_id) OR NOT public.can_see_firm_record(firm, r.owner_id) THEN
    RAISE EXCEPTION 'That lead isn''t available' USING ERRCODE = 'PT404';
  END IF;
  said := public.crm_merge_leads_problem(k, r);
  IF said IS NOT NULL THEN
    RAISE EXCEPTION '%', said USING ERRCODE = CASE WHEN k.id = r.id OR 'converted' IN (k.status, r.status) THEN '22023' ELSE '42501' END;
  END IF;
  said := public.crm_merge_choices_error(ch, public.merge_lead_fields());
  IF said IS NOT NULL THEN
    RAISE EXCEPTION '%', said USING ERRCODE = '22023';
  END IF;
  IF p_kept_version IS NULL OR p_removed_version IS NULL THEN
    RAISE EXCEPTION 'This merge did not say which version of each lead it started from, so it was refused. Reload the page and try again.' USING ERRCODE = '22023';
  END IF;
  IF p_kept_version <> k.version OR p_removed_version <> r.version THEN
    RAISE EXCEPTION 'One of these leads was changed while you were choosing. Reload the page and choose again.' USING ERRCODE = '40001';
  END IF;

  v := k;
  v.name := CASE WHEN public.crm_merge_takes_removed(ch, 'name', false) THEN r.name ELSE k.name END;
  v.title := CASE WHEN public.crm_merge_takes_removed(ch, 'title', k.title IS NULL) THEN r.title ELSE k.title END;
  v.business := CASE WHEN public.crm_merge_takes_removed(ch, 'business', k.business IS NULL) THEN r.business ELSE k.business END;
  v.email := CASE WHEN public.crm_merge_takes_removed(ch, 'email', k.email IS NULL) THEN r.email ELSE k.email END;
  v.phone := CASE WHEN public.crm_merge_takes_removed(ch, 'phone', k.phone IS NULL) THEN r.phone ELSE k.phone END;
  v.city := CASE WHEN public.crm_merge_takes_removed(ch, 'city', k.city IS NULL) THEN r.city ELSE k.city END;
  v.state := CASE WHEN public.crm_merge_takes_removed(ch, 'state', k.state IS NULL) THEN r.state ELSE k.state END;
  v.employees := CASE WHEN public.crm_merge_takes_removed(ch, 'employees', k.employees IS NULL) THEN r.employees ELSE k.employees END;
  v.current_provider := CASE WHEN public.crm_merge_takes_removed(ch, 'current_provider', k.current_provider IS NULL) THEN r.current_provider ELSE k.current_provider END;
  v.note := CASE WHEN public.crm_merge_takes_removed(ch, 'note', k.note IS NULL) THEN r.note ELSE k.note END;
  take_status := public.crm_merge_takes_removed(ch, 'status', false);
  v.status := CASE WHEN take_status THEN r.status ELSE k.status END;
  v.not_fit_reason := CASE WHEN take_status THEN r.not_fit_reason ELSE k.not_fit_reason END;
  v.owner_id := CASE WHEN public.crm_merge_takes_removed(ch, 'owner', false) THEN r.owner_id ELSE k.owner_id END;
  said := public.lead_input_error(NULLIF(btrim(v.name), ''), v.title, v.business, v.email, v.phone, v.city, v.state, v.employees, v.current_provider, v.note);
  IF said IS NOT NULL THEN
    RAISE EXCEPTION '%', said USING ERRCODE = '22023';
  END IF;
  -- A different owner is a current member of the firm, whose membership is held until the end of the transaction, as a save of the lead holds it.
  IF v.owner_id IS DISTINCT FROM k.owner_id THEN
    IF v.owner_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.firm_memberships m WHERE m.firm_id = firm AND m.user_id = v.owner_id AND public.membership_is_current(m.valid_from, m.valid_until) FOR SHARE) THEN
      RAISE EXCEPTION 'Choose one of the firm''s people as the owner.' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Calls, notes and tasks follow the lead.
  UPDATE public.activities SET lead_id = k.id WHERE lead_id = r.id AND firm_id = firm;
  GET DIAGNOSTICS acts = ROW_COUNT;
  -- Emails: a lead has one conversation. The removed lead's becomes the kept lead's when it has none; when both have one, its messages join the kept
  -- lead's and it goes (a reply sent later to its own address is held as mail for nobody, as any address that is gone).
  SELECT c.id INTO k_conv FROM public.conversations c WHERE c.lead_id = k.id AND c.firm_id = firm FOR UPDATE;
  SELECT c.id INTO r_conv FROM public.conversations c WHERE c.lead_id = r.id AND c.firm_id = firm FOR UPDATE;
  IF r_conv IS NOT NULL THEN
    SELECT count(*) INTO mails FROM public.conversation_messages m WHERE m.conversation_id = r_conv;
    IF k_conv IS NULL THEN
      UPDATE public.conversations SET lead_id = k.id WHERE id = r_conv;
    ELSE
      UPDATE public.conversation_messages SET conversation_id = k_conv WHERE conversation_id = r_conv AND firm_id = firm;
      DELETE FROM public.conversations WHERE id = r_conv;
    END IF;
  END IF;
  -- Labels: the ones the kept lead lacks; one both carry stays once.
  INSERT INTO public.lead_labels (firm_id, lead_id, label_id, added_by)
  SELECT l.firm_id, k.id, l.label_id, l.added_by FROM public.lead_labels l
  WHERE l.lead_id = r.id AND NOT EXISTS (SELECT 1 FROM public.lead_labels y WHERE y.lead_id = k.id AND y.label_id = l.label_id);
  GET DIAGNOSTICS labs = ROW_COUNT;
  -- Its old address leads to the kept lead, and its history is copied there with the kept lead's own "merged" entry (D-643, D-644), before it goes.
  INSERT INTO public.merged_records (firm_id, kind, removed_id, kept_id, removed_name, merged_by) VALUES (firm, 'lead', r.id, k.id, r.name, who);
  PERFORM public.crm_merge_history(firm, 'leads', k.id::text, r.id::text, r.name, k.version);
  DELETE FROM public.leads WHERE id = r.id;
  UPDATE public.leads SET
    name = v.name, title = v.title, business = v.business, email = v.email, phone = v.phone, city = v.city, state = v.state, employees = v.employees,
    current_provider = v.current_provider, note = v.note, status = v.status, not_fit_reason = v.not_fit_reason, owner_id = v.owner_id
  WHERE id = k.id
  RETURNING * INTO done;
  RETURN jsonb_build_object('record', public.crm_lead_fields(done), 'removed', jsonb_build_object('id', r.id, 'name', r.name),
                            'moved', jsonb_build_object('activities', acts, 'emails', mails, 'labels', labs));
END;
$$;

REVOKE ALL ON FUNCTION public.merge_leads(uuid, uuid, jsonb, integer, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_leads(uuid, uuid, jsonb, integer, integer, uuid) TO authenticated;

-- ---------- 5. Where a merged lead's old address leads ----------
-- The lead a removed lead was merged into, following the chain (A into B, B later into C leads A to C): {id, name}, only to a person who may see it, and
-- nothing otherwise, the same as for an id never merged (D-644).
CREATE FUNCTION public.resolve_merged_lead(p_firm_id uuid, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  cur uuid := p_id;
  nxt uuid;
  hops integer := 0;
  l public.leads;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  LOOP
    SELECT m.kept_id INTO nxt FROM public.merged_records m WHERE m.firm_id = firm AND m.kind = 'lead' AND m.removed_id = cur;
    EXIT WHEN nxt IS NULL OR hops >= 50;
    cur := nxt;
    hops := hops + 1;
  END LOOP;
  IF hops = 0 THEN
    RETURN NULL;
  END IF;
  SELECT * INTO l FROM public.leads x WHERE x.id = cur AND x.firm_id = firm AND x.deleted_at IS NULL;
  IF l.id IS NULL OR NOT public.can_see_firm_record(firm, l.owner_id) THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object('id', l.id, 'name', l.name);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_merged_lead(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_merged_lead(uuid, uuid) TO authenticated;
