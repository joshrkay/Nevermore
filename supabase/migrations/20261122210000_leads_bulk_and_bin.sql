-- Bulk actions on leads with Undo, the bin with Restore, and the 30-day nightly removal (story CRM-L1.1b, slice 8.4; docs/BROKER_CRM_BUILD.md D-806, D-811,
-- D-1640 to D-1649; 20261119210000_bulk_changes.sql, whose shape this follows; supabase/tests/leads_bulk.sql).

-- ---------- 1. What a bulk change keeps, for leads too ----------
-- A bulk change of leads is kept as an accounts' one is (D-202): one row in bulk_changes, one in bulk_change_records per lead it changed, standing on the lead
-- by a foreign key, so removing a lead for good takes the names and values kept for its undo with it. Added to; nothing replaced (ADR 0007).
ALTER TABLE public.bulk_changes DROP CONSTRAINT bulk_changes_action_check;
ALTER TABLE public.bulk_changes ADD CONSTRAINT bulk_changes_action_check
  CHECK (action IN ('owner', 'archive', 'field', 'label_add', 'label_remove', 'delete', 'status', 'not_fit'));

ALTER TABLE public.bulk_change_records ADD COLUMN lead_id uuid;
ALTER TABLE public.bulk_change_records DROP CONSTRAINT bulk_change_records_one_record;
ALTER TABLE public.bulk_change_records DROP CONSTRAINT bulk_change_records_type_check;
ALTER TABLE public.bulk_change_records DROP COLUMN record_id;
ALTER TABLE public.bulk_change_records ADD COLUMN record_id uuid GENERATED ALWAYS AS (COALESCE(account_id, opportunity_id, lead_id)) STORED NOT NULL;
ALTER TABLE public.bulk_change_records ADD PRIMARY KEY (change_id, record_type, record_id);
ALTER TABLE public.bulk_change_records
  ADD CONSTRAINT bulk_change_records_type_check CHECK (record_type IN ('account', 'opportunity', 'lead')),
  ADD CONSTRAINT bulk_change_records_one_record CHECK ((record_type = 'account') = (account_id IS NOT NULL) AND (record_type = 'opportunity') = (opportunity_id IS NOT NULL)
    AND (record_type = 'lead') = (lead_id IS NOT NULL)),
  ADD CONSTRAINT bulk_change_records_lead_fkey FOREIGN KEY (firm_id, lead_id) REFERENCES public.leads (firm_id, id) ON DELETE CASCADE;

-- ---------- 1b. A lead's labels in its history ----------
-- A lead's labels, as the history shows them: their names, alphabetically, ignoring case (account_label_names, for a lead). Internal.
CREATE FUNCTION public.lead_label_names(p_lead_id uuid, p_plus uuid DEFAULT NULL, p_minus uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(jsonb_agg(n.name ORDER BY lower(n.name), n.name), '[]'::jsonb)
  FROM (
    SELECT l.name FROM public.lead_labels ll JOIN public.labels l ON l.id = ll.label_id
    WHERE ll.lead_id = p_lead_id AND ll.label_id IS DISTINCT FROM p_minus
    UNION
    SELECT l.name FROM public.labels l WHERE l.id = p_plus
  ) n
$$;

REVOKE ALL ON FUNCTION public.lead_label_names(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- The history of a lead takes its labels as one field, "labels", as an account's does (account_labels_history): one entry per label put on or taken off,
-- from the list of names before to the list after, by whoever did it. Written for a lead and a label that still exist.
CREATE FUNCTION public.lead_labels_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  ld public.leads;
  nm text;
  before_list jsonb;
  after_list jsonb;
  who uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO ld FROM public.leads x WHERE x.id = NEW.lead_id;
    IF ld.id IS NULL OR NOT EXISTS (SELECT 1 FROM public.labels l WHERE l.id = NEW.label_id) THEN
      RETURN NULL;
    END IF;
    after_list := public.lead_label_names(NEW.lead_id);
    before_list := public.lead_label_names(NEW.lead_id, NULL, NEW.label_id);
  ELSE
    SELECT * INTO ld FROM public.leads x WHERE x.id = OLD.lead_id;
    SELECT l.name INTO nm FROM public.labels l WHERE l.id = OLD.label_id;
    IF ld.id IS NULL OR nm IS NULL THEN
      RETURN NULL;
    END IF;
    after_list := public.lead_label_names(OLD.lead_id);
    before_list := public.lead_label_names(OLD.lead_id, OLD.label_id);
  END IF;
  INSERT INTO public.record_history (firm_id, table_name, record_key, change_id, kind, field, old_value, new_value, actor_id, actor_is_staff, version)
  VALUES (ld.firm_id, 'leads', ld.id::text, gen_random_uuid(), 'changed', 'labels', before_list, after_list, who, public.firm_actor_is_staff(who, ld.firm_id), ld.version);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.lead_labels_history() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER lead_labels_history AFTER INSERT OR DELETE ON public.lead_labels FOR EACH ROW EXECUTE FUNCTION public.lead_labels_history();

-- The firm has one list of labels for accounts and leads (D-805). bulk_accounts_undo takes a word its change made out of the list when no account carries it
-- (20261119210000) and does not know leads: a word a lead still carries is kept instead (the delete is skipped, so the rest of that undo goes on). The firm's
-- closing takes the leads' labels before the labels (firm_closing_plan), so nothing is kept from it.
CREATE FUNCTION public.labels_kept_while_on_a_lead()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.lead_labels ll WHERE ll.label_id = OLD.id) THEN
    RETURN NULL;
  END IF;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.labels_kept_while_on_a_lead() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER labels_kept_while_on_a_lead BEFORE DELETE ON public.labels FOR EACH ROW EXECUTE FUNCTION public.labels_kept_while_on_a_lead();

-- ---------- 2. What a bulk change asks for, checked ----------
-- The optional standard fields Set a field offers on a lead (D-1646): never the name (required), the status, its reason and the source (the product's, or
-- their own actions), the owner (its own action) or the note (a page's long text). Kept in step with src/lib/leadsBulkApi.ts.
CREATE FUNCTION public.lead_bulk_fields()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT ARRAY['title', 'business', 'email', 'phone', 'city', 'state', 'employees', 'current_provider']
$$;

REVOKE ALL ON FUNCTION public.lead_bulk_fields() FROM PUBLIC, anon, authenticated, service_role;

-- The lead's value of one of those fields, as JSON (null for none). Internal.
CREATE FUNCTION public.lead_field_json(l public.leads, p_field text)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(CASE p_field
    WHEN 'title' THEN to_jsonb(l.title)
    WHEN 'business' THEN to_jsonb(l.business)
    WHEN 'email' THEN to_jsonb(l.email)
    WHEN 'phone' THEN to_jsonb(l.phone)
    WHEN 'city' THEN to_jsonb(l.city)
    WHEN 'state' THEN to_jsonb(l.state)
    WHEN 'employees' THEN to_jsonb(l.employees)
    WHEN 'current_provider' THEN to_jsonb(l.current_provider)
  END, 'null'::jsonb)
$$;

REVOKE ALL ON FUNCTION public.lead_field_json(public.leads, text) FROM PUBLIC, anon, authenticated, service_role;

-- Writes one of those fields of one lead, one statement for each (as account_set_field does). Internal.
CREATE FUNCTION public.lead_set_field(p_lead_id uuid, p_field text, p_value jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v text := p_value #>> '{}';
BEGIN
  IF p_field = 'title' THEN UPDATE public.leads SET title = v WHERE id = p_lead_id;
  ELSIF p_field = 'business' THEN UPDATE public.leads SET business = v WHERE id = p_lead_id;
  ELSIF p_field = 'email' THEN UPDATE public.leads SET email = v WHERE id = p_lead_id;
  ELSIF p_field = 'phone' THEN UPDATE public.leads SET phone = v WHERE id = p_lead_id;
  ELSIF p_field = 'city' THEN UPDATE public.leads SET city = v WHERE id = p_lead_id;
  ELSIF p_field = 'state' THEN UPDATE public.leads SET state = v WHERE id = p_lead_id;
  ELSIF p_field = 'employees' THEN UPDATE public.leads SET employees = v::integer WHERE id = p_lead_id;
  ELSIF p_field = 'current_provider' THEN UPDATE public.leads SET current_provider = v WHERE id = p_lead_id;
  ELSE
    RAISE EXCEPTION 'That field can''t be set on many leads at once.' USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.lead_set_field(uuid, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- What a bulk change of leads asks for, checked and tidied, as bulk_params_checked checks the accounts': {owner_id} | {} for delete. Anything else is refused
-- (22023, in words). Internal.
CREATE FUNCTION public.bulk_lead_params_checked(p_action text, p_params jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  prm jsonb := COALESCE(NULLIF(p_params, 'null'::jsonb), '{}'::jsonb);
  allowed text[];
  k text;
  field text;
  val jsonb;
  s text;
  n numeric;
  n_emp integer;
  problem text;
BEGIN
  IF jsonb_typeof(prm) <> 'object' THEN
    RAISE EXCEPTION 'The change''s details are missing.' USING ERRCODE = '22023';
  END IF;
  allowed := CASE p_action
    WHEN 'owner' THEN ARRAY['owner_id']
    WHEN 'status' THEN ARRAY['status']
    WHEN 'not_fit' THEN ARRAY['reason']
    WHEN 'field' THEN ARRAY['field', 'value']
    WHEN 'label_add' THEN ARRAY['name']
    WHEN 'label_remove' THEN ARRAY['name']
    WHEN 'delete' THEN ARRAY[]::text[]
    ELSE NULL END;
  IF allowed IS NULL THEN
    RAISE EXCEPTION 'Choose what to change: the owner, the status, Not a fit, a field, a label or deleting.' USING ERRCODE = '22023';
  END IF;
  FOR k IN SELECT jsonb_object_keys(prm) LOOP
    IF NOT k = ANY (allowed) THEN
      RAISE EXCEPTION 'That change does not take "%".', left(k, 64) USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF p_action = 'owner' THEN
    IF jsonb_typeof(prm -> 'owner_id') IS DISTINCT FROM 'string' OR (prm ->> 'owner_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'Choose who will own these leads.' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('owner_id', lower(prm ->> 'owner_id'));
  END IF;
  IF p_action = 'status' THEN
    -- New or Working only: Converted is set by converting alone, and Not a fit has its own action with its reason (D-808, D-811).
    IF jsonb_typeof(prm -> 'status') IS DISTINCT FROM 'string' OR (prm ->> 'status') NOT IN ('new', 'working') THEN
      RAISE EXCEPTION 'Choose New or Working.' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('status', prm ->> 'status');
  END IF;
  IF p_action = 'not_fit' THEN
    -- One reason for all, from the short list (CRM-L1.3, D-811).
    IF jsonb_typeof(prm -> 'reason') IS DISTINCT FROM 'string'
       OR NOT (prm ->> 'reason') = ANY (ARRAY['too_small', 'wrong_industry', 'not_interested', 'bad_contact_details', 'other']) THEN
      RAISE EXCEPTION 'Choose why they are not a fit: too small, wrong industry, not interested, bad contact details or other.' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('reason', prm ->> 'reason');
  END IF;
  IF p_action IN ('label_add', 'label_remove') THEN
    -- A label's words, as bulk_params_checked takes them for accounts (D-198).
    s := CASE WHEN jsonb_typeof(prm -> 'name') = 'string' THEN public.label_name_clean(prm ->> 'name') END;
    IF s IS NULL THEN
      RAISE EXCEPTION 'Type a label.' USING ERRCODE = '22023';
    END IF;
    IF char_length(s) > 40 THEN
      RAISE EXCEPTION 'Keep a label to 40 characters.' USING ERRCODE = '22023';
    END IF;
    IF s ~ '[[:cntrl:]]' THEN
      RAISE EXCEPTION 'A label is plain text on one line.' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('name', s);
  END IF;
  IF p_action = 'field' THEN
    IF jsonb_typeof(prm -> 'field') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'Choose the field to set.' USING ERRCODE = '22023';
    END IF;
    field := prm ->> 'field';
    IF field = 'name' THEN
      RAISE EXCEPTION 'The name is required on every lead, so it can''t be set on many at once.' USING ERRCODE = '22023';
    END IF;
    IF NOT field = ANY (public.lead_bulk_fields()) THEN
      RAISE EXCEPTION 'That field can''t be set on many leads at once. Choose an optional field the lead''s form lets you edit.' USING ERRCODE = '22023';
    END IF;
    val := COALESCE(prm -> 'value', 'null'::jsonb);
    IF field = 'employees' THEN
      IF jsonb_typeof(val) = 'null' THEN
        n_emp := NULL;
      ELSIF jsonb_typeof(val) = 'number' THEN
        n := (val #>> '{}')::numeric;
        IF n <> trunc(n) OR n < 0 OR n > 2147483647 THEN
          RAISE EXCEPTION 'Employees must be a whole number, 0 or more.' USING ERRCODE = '22023';
        END IF;
        n_emp := n::integer;
      ELSE
        RAISE EXCEPTION 'Employees must be a whole number, 0 or more.' USING ERRCODE = '22023';
      END IF;
      RETURN jsonb_build_object('field', field, 'value', COALESCE(to_jsonb(n_emp), 'null'::jsonb));
    END IF;
    IF jsonb_typeof(val) NOT IN ('null', 'string') THEN
      RAISE EXCEPTION 'That field takes text.' USING ERRCODE = '22023';
    END IF;
    s := NULLIF(btrim(val #>> '{}'), '');
    IF field = 'state' THEN s := upper(s); END IF;
    -- The lead's own rules for each field, in its own words (the name is given as something: this is not the name's check).
    problem := public.lead_input_error('x',
      CASE WHEN field = 'title' THEN s END, CASE WHEN field = 'business' THEN s END, CASE WHEN field = 'email' THEN s END, CASE WHEN field = 'phone' THEN s END,
      CASE WHEN field = 'city' THEN s END, CASE WHEN field = 'state' THEN s END, NULL, CASE WHEN field = 'current_provider' THEN s END, NULL);
    IF problem IS NOT NULL THEN
      RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('field', field, 'value', COALESCE(to_jsonb(s), 'null'::jsonb));
  END IF;
  RETURN '{}'::jsonb;
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_lead_params_checked(text, jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 2b. The selection ----------
-- The leads a bulk change is for, as bulk_accounts_resolve finds accounts (CRM-S3.6's contract): `lead_ids` (in id order), `selected`, `requested` (for ids:
-- how many different ids were named; NULL for filters) and `too_many`. Only the firm's leads the caller may see and not in the bin (D-806: a lead in the bin
-- is in no view but Deleted, and is put back by Restore, not changed); an id that is not one (another firm's, made up, text) gives none. Internal.
CREATE FUNCTION public.bulk_leads_resolve(p_firm_id uuid, p_filters jsonb, p_ids jsonb, OUT lead_ids uuid[], OUT selected integer, OUT requested integer, OUT too_many boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  cap constant integer := 1000;
  f jsonb := NULLIF(p_filters, 'null'::jsonb);
  i jsonb := NULLIF(p_ids, 'null'::jsonb);
  tz text;
  checked jsonb;
  hits uuid[];
  named uuid[];
BEGIN
  too_many := false;
  requested := NULL;
  IF f IS NOT NULL AND i IS NOT NULL THEN
    RAISE EXCEPTION 'Choose the leads by their ids or by the table''s filters, not both.' USING ERRCODE = '22023';
  END IF;
  IF f IS NULL AND i IS NULL THEN
    RAISE EXCEPTION 'Choose the leads to change.' USING ERRCODE = '22023';
  END IF;
  IF i IS NOT NULL THEN
    IF jsonb_typeof(i) <> 'array' OR EXISTS (SELECT 1 FROM jsonb_array_elements(i) e WHERE jsonb_typeof(e) <> 'string') THEN
      RAISE EXCEPTION 'Name the leads as a list of ids.' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(i) = 0 THEN
      RAISE EXCEPTION 'Choose at least one lead.' USING ERRCODE = '22023';
    END IF;
    -- Cut before anything is looked up: a list of a million ids costs one length.
    IF jsonb_array_length(i) > cap THEN
      requested := jsonb_array_length(i);
      selected := requested;
      lead_ids := '{}';
      too_many := true;
      RETURN;
    END IF;
    SELECT count(DISTINCT lower(e)) INTO requested FROM jsonb_array_elements_text(i) e;
    named := ARRAY(SELECT e::uuid FROM jsonb_array_elements_text(i) e WHERE e ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
    SELECT COALESCE(array_agg(l.id ORDER BY l.id), '{}') INTO hits
    FROM public.leads l
    WHERE l.firm_id = p_firm_id AND l.id = ANY (named) AND l.deleted_at IS NULL AND public.can_see_firm_record(l.firm_id, l.owner_id);
  ELSE
    -- "Select all N that match": the table's own filters, search and time zone, matched by the leads query itself (D-44), the bin left out as the table leaves it.
    IF jsonb_typeof(f) IS DISTINCT FROM 'object'
       OR EXISTS (SELECT 1 FROM jsonb_object_keys(f) k WHERE k NOT IN ('filters', 'search', 'time_zone'))
       OR (f ? 'search' AND jsonb_typeof(f -> 'search') IS DISTINCT FROM 'string')
       OR (f ? 'time_zone' AND jsonb_typeof(f -> 'time_zone') IS DISTINCT FROM 'string')
       OR (f ? 'filters' AND jsonb_typeof(f -> 'filters') IS DISTINCT FROM 'array') THEN
      RAISE EXCEPTION 'Those filters don''t apply to this table' USING ERRCODE = '22023';
    END IF;
    tz := public.workspace_time_zone(f ->> 'time_zone');
    checked := public.leads_filters_checked(p_firm_id, COALESCE(f -> 'filters', '[]'::jsonb), (now() AT TIME ZONE tz)::date);
    SELECT COALESCE(array_agg(r.id ORDER BY r.id), '{}') INTO hits
    FROM public.leads_rows(p_firm_id, f ->> 'search') r
    WHERE public.leads_row_passes(r, checked, tz);
  END IF;
  selected := cardinality(hits);
  IF selected > cap THEN
    too_many := true;
    lead_ids := '{}';
  ELSE
    lead_ids := hits;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_leads_resolve(uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 3. What happens to one lead ----------
-- The words that refuse a change to a lead the level rule (D-809) does not give the caller, as account_change_words says them for an account. Internal.
CREATE FUNCTION public.lead_change_words(p_owner_id uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN p_owner_id IS NULL
    THEN 'A lead with no owner can only be changed by an owner of the firm.'
    ELSE 'Only the lead''s owner, a lead of the owner''s team or an owner of the firm can change it.' END
$$;

REVOKE ALL ON FUNCTION public.lead_change_words(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- What the change does to this lead, asked the same way by the preview and by the change (the change holds the lead row; the preview reads it):
--   skip    the caller may not change it; `code` says why and `reason` in words
--   change  it will change
-- Internal.
CREATE FUNCTION public.bulk_lead_outcome(l public.leads, p_action text, p_params jsonb, p_label_id uuid, OUT outcome text, OUT code text, OUT reason text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  has_label boolean;
BEGIN
  IF NOT public.can_change_firm_record(l.firm_id, l.owner_id) THEN
    outcome := 'skip';
    code := 'level';
    reason := public.lead_change_words(l.owner_id);
    RETURN;
  END IF;
  IF l.status = 'converted' THEN
    outcome := 'skip';
    code := 'converted';
    reason := 'It is converted, so it can be read but not changed or deleted.';
    RETURN;
  END IF;
  -- Not a fit is read, not worked (CRM-L1.1): it is reopened (a status of New or Working) or deleted, and nothing else.
  IF l.status = 'not_fit' AND p_action NOT IN ('status', 'delete') THEN
    outcome := 'skip';
    code := 'not_fit';
    reason := 'It is Not a fit, so it can be read but not changed. Reopen it first.';
    RETURN;
  END IF;
  IF p_action = 'owner' THEN
    outcome := CASE WHEN l.owner_id IS NOT DISTINCT FROM (p_params ->> 'owner_id')::uuid THEN 'same' ELSE 'change' END;
    RETURN;
  END IF;
  IF p_action = 'status' THEN
    outcome := CASE WHEN l.status = p_params ->> 'status' THEN 'same' ELSE 'change' END;
    RETURN;
  END IF;
  IF p_action IN ('label_add', 'label_remove') THEN
    has_label := p_label_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.lead_labels ll WHERE ll.lead_id = l.id AND ll.label_id = p_label_id);
    outcome := CASE WHEN has_label = (p_action = 'label_add') THEN 'same' ELSE 'change' END;
    RETURN;
  END IF;
  IF p_action = 'field' THEN
    outcome := CASE WHEN public.lead_field_json(l, p_params ->> 'field') = COALESCE(p_params -> 'value', 'null'::jsonb) THEN 'same' ELSE 'change' END;
    RETURN;
  END IF;
  IF p_action = 'not_fit' THEN
    -- A lead already Not a fit was skipped above.
    outcome := 'change';
    RETURN;
  END IF;
  outcome := 'change';
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_lead_outcome(public.leads, text, jsonb, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 4. The preview ----------
-- Answers {action, selected, requested, unavailable, limit, too_many, will_change, unchanged, skipped: [{id, name, code, reason}]}: what the change would do,
-- asked by the same rules (bulk_lead_outcome). It changes and locks nothing.
CREATE FUNCTION public.bulk_leads_preview(p_firm_id uuid, p_action text, p_params jsonb DEFAULT '{}'::jsonb, p_filters jsonb DEFAULT NULL, p_ids jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  firm uuid;
  sel record;
  l public.leads;
  oc record;
  n_change integer := 0;
  n_same integer := 0;
  seen integer := 0;
  skipped jsonb := '[]'::jsonb;
  params jsonb;
  lbl uuid;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  params := public.bulk_lead_params_checked(p_action, p_params);
  SELECT * INTO sel FROM public.bulk_leads_resolve(firm, p_filters, p_ids);
  IF p_action IN ('label_add', 'label_remove') THEN
    SELECT x.id INTO lbl FROM public.labels x WHERE x.firm_id = firm AND lower(x.name) = lower(params ->> 'name');
    IF p_action = 'label_remove' AND lbl IS NULL THEN
      RAISE EXCEPTION 'The firm has no label called "%".', params ->> 'name' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF sel.too_many THEN
    RETURN jsonb_build_object('action', p_action, 'selected', sel.selected, 'requested', sel.requested, 'limit', 1000, 'too_many', true,
      'unavailable', 0, 'will_change', 0, 'unchanged', 0, 'skipped', '[]'::jsonb);
  END IF;
  FOR l IN SELECT x.* FROM public.leads x WHERE x.firm_id = firm AND x.id = ANY (sel.lead_ids) ORDER BY x.id LOOP
    seen := seen + 1;
    SELECT * INTO oc FROM public.bulk_lead_outcome(l, p_action, params, lbl);
    IF oc.outcome = 'change' THEN
      n_change := n_change + 1;
    ELSIF oc.outcome = 'same' THEN
      n_same := n_same + 1;
    ELSE
      skipped := skipped || jsonb_build_object('id', l.id, 'name', l.name, 'code', oc.code, 'reason', oc.reason);
    END IF;
  END LOOP;
  RETURN jsonb_build_object('action', p_action, 'selected', sel.selected, 'requested', sel.requested, 'limit', 1000, 'too_many', sel.too_many,
    'unavailable', (cardinality(sel.lead_ids) - seen) + COALESCE(GREATEST(sel.requested - sel.selected, 0), 0),
    'will_change', n_change, 'unchanged', n_same, 'skipped', skipped);
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_leads_preview(uuid, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_leads_preview(uuid, text, jsonb, jsonb, jsonb) TO authenticated;

-- ---------- 5. The change ----------
CREATE FUNCTION public.bulk_leads_change(p_firm_id uuid, p_action text, p_params jsonb DEFAULT '{}'::jsonb, p_filters jsonb DEFAULT NULL, p_ids jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  firm uuid;
  l public.leads;
  chg uuid := gen_random_uuid();
  made boolean := false;
  n_change integer := 0;
  undo_by timestamptz := now() + interval '10 minutes';
  maker bigint;
  mark bigint;
  sel record;
  locked uuid[];
  n_unavailable integer := 0;
  oc record;
  skipped jsonb := '[]'::jsonb;
  params jsonb;
  new_owner uuid;
  n_same integer := 0;
  row_before jsonb;
  row_after jsonb;
  result jsonb;
  lbl uuid;
  ll_id uuid;
  old_ll public.lead_labels;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  params := public.bulk_lead_params_checked(p_action, p_params);
  SELECT m.id INTO maker FROM public.firm_memberships m WHERE m.firm_id = firm AND m.user_id = auth.uid() AND public.membership_is_current(m.valid_from, m.valid_until);
  SELECT * INTO sel FROM public.bulk_leads_resolve(firm, p_filters, p_ids);
  IF sel.too_many THEN
    RAISE EXCEPTION 'That is % leads. A bulk change takes at most 1,000: narrow the selection and try again.', sel.selected USING ERRCODE = 'PT413';
  END IF;
  -- Every lead of the selection, held in one statement in id order (the lock order of 20261119210000).
  SELECT COALESCE(array_agg(k.id ORDER BY k.id), '{}') INTO locked
  FROM (SELECT x.id FROM public.leads x WHERE x.firm_id = firm AND x.id = ANY (sel.lead_ids) AND x.deleted_at IS NULL ORDER BY x.id FOR NO KEY UPDATE) k;
  -- The new owner's membership, held FOR SHARE after the leads (the lock order of 20261119210000).
  IF p_action = 'owner' THEN
    new_owner := (params ->> 'owner_id')::uuid;
    PERFORM public.member_to_own(firm, new_owner);
  END IF;
  -- The label, looked up once the leads are held and kept FOR KEY SHARE to the end (bulk_accounts_change's reason).
  IF p_action IN ('label_add', 'label_remove') THEN
    SELECT x.id INTO lbl FROM public.labels x WHERE x.firm_id = firm AND lower(x.name) = lower(params ->> 'name') FOR KEY SHARE;
    IF p_action = 'label_remove' AND lbl IS NULL THEN
      RAISE EXCEPTION 'The firm has no label called "%".', params ->> 'name' USING ERRCODE = '22023';
    END IF;
  END IF;
  FOR l IN SELECT x.* FROM public.leads x WHERE x.firm_id = firm AND x.id = ANY (locked) ORDER BY x.id LOOP
    SELECT * INTO oc FROM public.bulk_lead_outcome(l, p_action, params, lbl);
    IF oc.outcome = 'skip' THEN
      skipped := skipped || jsonb_build_object('id', l.id, 'name', l.name, 'code', oc.code, 'reason', oc.reason);
      CONTINUE;
    ELSIF oc.outcome = 'same' THEN
      n_same := n_same + 1;
      CONTINUE;
    END IF;
    IF NOT made THEN
      INSERT INTO public.bulk_changes (id, firm_id, actor_id, actor_membership_id, action, detail, made_at, undo_until)
      VALUES (chg, firm, auth.uid(), maker, p_action, params, now(), undo_by);
      made := true;
    END IF;
    IF p_action = 'owner' THEN
      row_before := jsonb_build_object('owner_id', l.owner_id);
      row_after := jsonb_build_object('owner_id', new_owner);
      UPDATE public.leads SET owner_id = new_owner WHERE id = l.id;
    ELSIF p_action = 'status' THEN
      row_before := jsonb_build_object('status', l.status, 'not_fit_reason', l.not_fit_reason);
      row_after := jsonb_build_object('status', params ->> 'status', 'not_fit_reason', NULL);
      UPDATE public.leads SET status = params ->> 'status', not_fit_reason = NULL WHERE id = l.id;
    ELSIF p_action = 'not_fit' THEN
      row_before := jsonb_build_object('status', l.status, 'not_fit_reason', l.not_fit_reason);
      row_after := jsonb_build_object('status', 'not_fit', 'not_fit_reason', params ->> 'reason');
      UPDATE public.leads SET status = 'not_fit', not_fit_reason = params ->> 'reason' WHERE id = l.id;
    ELSIF p_action = 'field' THEN
      row_before := jsonb_build_object('field', params ->> 'field', 'value', public.lead_field_json(l, params ->> 'field'));
      row_after := jsonb_build_object('field', params ->> 'field', 'value', params -> 'value');
      PERFORM public.lead_set_field(l.id, params ->> 'field', params -> 'value');
    ELSIF p_action = 'label_add' THEN
      IF lbl IS NULL THEN
        -- Made by typing it (D-198), once: a second change of the same word finds it.
        INSERT INTO public.labels (firm_id, name, created_by) VALUES (firm, params ->> 'name', auth.uid())
        ON CONFLICT (firm_id, lower(name)) DO NOTHING RETURNING id INTO lbl;
        IF lbl IS NULL THEN
          SELECT x.id INTO lbl FROM public.labels x WHERE x.firm_id = firm AND lower(x.name) = lower(params ->> 'name');
        END IF;
      END IF;
      INSERT INTO public.lead_labels (firm_id, lead_id, label_id, added_by) VALUES (firm, l.id, lbl, auth.uid()) RETURNING id INTO ll_id;
      row_before := jsonb_build_object('label_id', lbl, 'present', false);
      row_after := jsonb_build_object('label_id', lbl, 'lead_label_id', ll_id);
    ELSIF p_action = 'label_remove' THEN
      DELETE FROM public.lead_labels WHERE lead_id = l.id AND label_id = lbl RETURNING * INTO old_ll;
      row_before := jsonb_build_object('label_id', lbl, 'present', true, 'added_by', old_ll.added_by, 'added_at', old_ll.added_at);
      row_after := jsonb_build_object('label_id', lbl, 'present', false);
    ELSE
      row_before := jsonb_build_object('deleted_at', NULL);
      row_after := jsonb_build_object('deleted_at', now());
      UPDATE public.leads SET deleted_at = now() WHERE id = l.id;
    END IF;
    -- The newest history entry of the lead once the change is done with it: an entry after it, by anyone, is a change made since (D-202).
    SELECT COALESCE(max(h.id), 0) INTO mark FROM public.record_history h WHERE h.firm_id = firm AND h.table_name = 'leads' AND h.record_key = l.id::text;
    INSERT INTO public.bulk_change_records (change_id, firm_id, record_type, lead_id, record_name, before, after, history_mark)
    VALUES (chg, firm, 'lead', l.id, l.name, row_before, row_after, mark);
    n_change := n_change + 1;
  END LOOP;
  IF made THEN
    UPDATE public.bulk_changes SET record_count = n_change WHERE id = chg;
  END IF;
  -- Named but not a lead the caller may see, or gone while the locks were taken: not available, so the counts add up to what was asked.
  n_unavailable := (cardinality(sel.lead_ids) - cardinality(locked)) + COALESCE(GREATEST(sel.requested - sel.selected, 0), 0);
  result := jsonb_build_object('action', p_action, 'selected', sel.selected, 'requested', sel.requested, 'limit', 1000, 'too_many', false,
    'unavailable', n_unavailable, 'will_change', n_change, 'changed', n_change, 'unchanged', n_same, 'skipped', skipped,
    'change_id', CASE WHEN made THEN chg END, 'undo_until', CASE WHEN made THEN undo_by END);
  IF p_action = 'owner' THEN
    result := result || jsonb_build_object('owner', jsonb_build_object('id', new_owner, 'name', public.crm_person_name(new_owner)));
  ELSIF p_action IN ('label_add', 'label_remove') THEN
    result := result || jsonb_build_object('label', COALESCE((SELECT x.name FROM public.labels x WHERE x.id = lbl), params ->> 'name'));
  END IF;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_leads_change(uuid, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_leads_change(uuid, text, jsonb, jsonb, jsonb) TO authenticated;

-- ---------- 6. Undo ----------
-- Puts back every lead of the change nobody has changed since, and answers {action, restored, skipped: [{id, name, code, reason}], gone}. The level rule is
-- not asked again (as bulk_accounts_undo, D-202): an agent who deleted leads no longer sees them in the bin, and the undo is theirs to make.
CREATE FUNCTION public.bulk_leads_undo(p_change_id uuid, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  firm uuid;
  ch public.bulk_changes;
  rec public.bulk_change_records;
  l public.leads;
  restored integer := 0;
  skipped jsonb := '[]'::jsonb;
  since boolean;
  prev uuid;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  SELECT * INTO ch FROM public.bulk_changes c WHERE c.id = p_change_id AND c.firm_id = firm FOR UPDATE;
  -- Only the person who made it, while the membership they made it under is still current (bulk_accounts_undo's rule).
  IF ch.id IS NULL OR ch.actor_id IS DISTINCT FROM auth.uid() OR ch.actor_membership_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.firm_memberships m WHERE m.id = ch.actor_membership_id AND m.firm_id = firm AND m.user_id = auth.uid() AND public.membership_is_current(m.valid_from, m.valid_until)) THEN
    RAISE EXCEPTION 'That change isn''t available to undo' USING ERRCODE = 'PT404';
  END IF;
  IF ch.undone_at IS NOT NULL THEN
    RAISE EXCEPTION 'That change was already undone.' USING ERRCODE = 'PT409';
  END IF;
  IF now() > ch.undo_until THEN
    RAISE EXCEPTION 'That change was made more than 10 minutes ago, so it can no longer be undone.' USING ERRCODE = 'PT410';
  END IF;
  FOR rec IN SELECT r.* FROM public.bulk_change_records r WHERE r.change_id = ch.id AND r.record_type = 'lead' ORDER BY r.record_id LOOP
    SELECT * INTO l FROM public.leads x WHERE x.id = rec.lead_id AND x.firm_id = firm FOR NO KEY UPDATE;
    -- Changed since: the lead's history has an entry for the field after the change finished with it, whoever made it (a value put back is a change too).
    since := EXISTS (SELECT 1 FROM public.record_history h WHERE h.firm_id = firm AND h.table_name = 'leads' AND h.record_key = l.id::text AND h.id > rec.history_mark
      AND h.field = CASE ch.action WHEN 'owner' THEN 'owner_id' WHEN 'status' THEN 'status' WHEN 'not_fit' THEN 'status' WHEN 'field' THEN rec.after ->> 'field' WHEN 'label_add' THEN 'labels' WHEN 'label_remove' THEN 'labels' ELSE 'deleted_at' END);
    IF since THEN
      skipped := skipped || jsonb_build_object('id', l.id, 'name', rec.record_name, 'code', 'changed_since', 'reason', 'It has been changed since.');
      CONTINUE;
    END IF;
    IF ch.action = 'owner' THEN
      prev := (rec.before ->> 'owner_id')::uuid;
      IF prev IS NOT NULL AND NOT public.crm_is_current_member(firm, prev) THEN
        skipped := skipped || jsonb_build_object('id', l.id, 'name', rec.record_name, 'code', 'owner_left', 'reason', 'Its previous owner is no longer a member of the firm.');
        CONTINUE;
      END IF;
      UPDATE public.leads SET owner_id = prev WHERE id = l.id;
    ELSIF ch.action = 'label_add' THEN
      DELETE FROM public.lead_labels WHERE id = (rec.after ->> 'lead_label_id')::uuid;
    ELSIF ch.action = 'label_remove' THEN
      INSERT INTO public.lead_labels (firm_id, lead_id, label_id, added_by, added_at)
      VALUES (firm, l.id, (rec.before ->> 'label_id')::uuid, (rec.before ->> 'added_by')::uuid, (rec.before ->> 'added_at')::timestamptz);
    ELSIF ch.action = 'field' THEN
      PERFORM public.lead_set_field(l.id, rec.before ->> 'field', COALESCE(rec.before -> 'value', 'null'::jsonb));
    ELSIF ch.action IN ('status', 'not_fit') THEN
      UPDATE public.leads SET status = rec.before ->> 'status', not_fit_reason = rec.before ->> 'not_fit_reason' WHERE id = l.id;
    ELSE
      UPDATE public.leads SET deleted_at = NULL WHERE id = l.id;
    END IF;
    restored := restored + 1;
  END LOOP;
  UPDATE public.bulk_changes SET undone_at = now() WHERE id = ch.id;
  -- `gone` is always 0 here: a lead leaves the database only by the nightly removal, 30 days in the bin (well past the ten minutes), or with its closing firm,
  -- which undoes nothing. Kept so the answer has the accounts' shape.
  RETURN jsonb_build_object('action', ch.action, 'restored', restored, 'skipped', skipped, 'gone', 0);
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_leads_undo(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_leads_undo(uuid, uuid) TO authenticated;

-- ---------- 7. The bin ----------
-- The Deleted view (D-806): the firm's leads in the bin, newest deleted first, 50 a page, for its owners (and Nevermore support, who reads what an owner reads);
-- anyone else is refused (42501). Each with when it was deleted and `removed_on`, the day the nightly removal takes it (30 days after, in UTC). Returns {"rows": [...], "total": n, "page": p, "page_size": 50}.
CREATE FUNCTION public.leads_bin(p_firm_id uuid, p_page integer DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  page_size constant integer := 50;
  firm uuid;
  pg integer := COALESCE(p_page, 1);
  result jsonb;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  IF public.firm_role(firm) IS DISTINCT FROM 'owner' AND NOT public.is_support_session(firm) THEN
    RAISE EXCEPTION 'Only an owner of the firm can see deleted leads.' USING ERRCODE = '42501';
  END IF;
  IF pg < 1 OR pg > 100000 THEN
    RAISE EXCEPTION 'A page number is 1 to 100000' USING ERRCODE = '22023';
  END IF;
  WITH binned AS MATERIALIZED (
    SELECT l.*, row_number() OVER (ORDER BY l.deleted_at DESC, l.id) AS pos
    FROM public.leads l
    WHERE l.firm_id = firm AND l.deleted_at IS NOT NULL
  )
  SELECT jsonb_build_object(
    'rows', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', b.id, 'name', b.name, 'business', b.business, 'email', b.email, 'phone', b.phone, 'status', b.status,
        'owner', CASE WHEN public.crm_is_current_member(firm, b.owner_id) THEN b.owner_id END,
        'owner_name', CASE WHEN public.crm_is_current_member(firm, b.owner_id) THEN public.crm_person_name(b.owner_id) END,
        'deleted_at', b.deleted_at, 'removed_on', to_char((b.deleted_at + interval '30 days')::date, 'YYYY-MM-DD')) ORDER BY b.pos)
      FROM binned b WHERE b.pos > (pg - 1)::bigint * page_size AND b.pos <= pg::bigint * page_size
    ), '[]'::jsonb),
    'total', (SELECT count(*) FROM binned),
    'page', pg,
    'page_size', page_size
  ) INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.leads_bin(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leads_bin(uuid, integer) TO authenticated;

-- Restore (D-806): an owner takes leads out of the bin, back to the views they were in (status and owner untouched). Answers {restored, unavailable}:
-- ids that are not the firm's leads in the bin (another firm's, made up, already restored) are counted, not named. At most 1,000 ids. Refused: anyone but an
-- owner (42501), a closing firm and Nevermore support (PT423). Each lead restored is one entry in its history (deleted_at back to nothing).
CREATE FUNCTION public.restore_leads(p_firm_id uuid, p_ids jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  firm uuid;
  named uuid[];
  requested integer;
  n integer;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  IF public.firm_role(firm) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can restore deleted leads.' USING ERRCODE = '42501';
  END IF;
  IF p_ids IS NULL OR jsonb_typeof(p_ids) <> 'array' OR jsonb_array_length(p_ids) = 0
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_ids) e WHERE jsonb_typeof(e) <> 'string') THEN
    RAISE EXCEPTION 'Choose the leads to restore.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_ids) > 1000 THEN
    RAISE EXCEPTION 'Restore at most 1,000 leads at once.' USING ERRCODE = 'PT413';
  END IF;
  SELECT count(DISTINCT lower(e)) INTO requested FROM jsonb_array_elements_text(p_ids) e;
  named := ARRAY(SELECT e::uuid FROM jsonb_array_elements_text(p_ids) e WHERE e ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
  WITH held AS (
    SELECT x.id FROM public.leads x WHERE x.firm_id = firm AND x.id = ANY (named) AND x.deleted_at IS NOT NULL ORDER BY x.id FOR NO KEY UPDATE
  ), done AS (
    UPDATE public.leads l SET deleted_at = NULL FROM held WHERE l.id = held.id RETURNING l.id
  )
  SELECT count(*)::integer INTO n FROM done;
  RETURN jsonb_build_object('restored', n, 'unavailable', GREATEST(requested - n, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.restore_leads(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_leads(uuid, jsonb) TO authenticated;

-- ---------- 8. The nightly removal (D-806) ----------
-- Removes, for good, every firm's leads that have been in the bin for more than 30 days, with what stands on them: their calls, notes and tasks, their labels,
-- what a bulk change kept for their undo (foreign keys that cascade) and their history (the capture trigger removes a deleted record's). Answers how many.
-- For the scheduler and the service role; no person calls it.
CREATE FUNCTION public.remove_binned_leads()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  n integer;
BEGIN
  DELETE FROM public.leads l WHERE l.deleted_at IS NOT NULL AND l.deleted_at < now() - interval '30 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_binned_leads() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_binned_leads() TO service_role;

-- Every night at 04:41 UTC, where pg_cron is there (as the other daily jobs are scheduled); where it is not, this says so and nothing else.
DO $$
BEGIN
  IF to_regprocedure('cron.schedule(text,text,text)') IS NULL THEN
    RAISE NOTICE 'the lead bin: pg_cron is not available; run public.remove_binned_leads() every night another way';
    RETURN;
  END IF;
  PERFORM cron.schedule('remove-binned-leads', '41 4 * * *', 'select public.remove_binned_leads();');
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'the lead bin: could not schedule remove-binned-leads (%); run public.remove_binned_leads() every night another way', SQLERRM;
END $$;
