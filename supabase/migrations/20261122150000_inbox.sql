-- The inbox (story CRM-E1.4, slice 6.5, #199; docs/BROKER_CRM_BUILD.md D-607, D-690 to D-699; supabase/tests/inbox.sql).
--
-- A view of the product's own threads, worked out in the database on the workspace's table frame as the leads table is (20261121110500_leads_table_query.sql):
-- every message, both directions, on the quote requests' PEO threads and the conversations with contacts and leads the caller may see, newest first. It
-- reads only the product's own tables: never the agent's mailbox (ADR 0005), which the product can't read.
--
-- As every table's query does it, no SQL is built from what the caller sends (D-44): no EXECUTE, no format(); a field's name chooses a branch of a fixed CASE.

SET lock_timeout = '5s';

-- ---------- 1. One row of the inbox ----------
--   id               the message: 'c:<uuid>' for a conversation's message, 'q:<id>' for a PEO thread's, so the two stores never share an id
--   kind             'contact', 'lead' or 'peo': whose thread it is on
--   thread_id        the conversation's id, or the quote request's
--   direction        'received' (to the firm) or 'sent' (by the firm: through the product, or by hand from a person's own mail)
--   first_line       the first line of the body with words in it, at most 200 characters; never the body
--   at               when the product recorded it: the moment "new" is measured against (D-665)
CREATE TYPE public.inbox_row AS (
  id text,
  kind text,
  thread_id text,
  direction text,
  is_new boolean,
  is_automatic boolean,
  from_address text,
  from_name text,
  subject text,
  first_line text,
  at timestamptz,
  account_id uuid,
  account_name text,
  contact_id uuid,
  contact_name text,
  lead_id uuid,
  lead_name text,
  peo_name text,
  session_id uuid,
  owner uuid,
  owner_name text
);

-- The first line of a message with words in it, cut to 200 characters. Internal.
CREATE FUNCTION public.inbox_first_line(p_body text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT left(btrim(l), 200) FROM regexp_split_to_table(COALESCE(p_body, ''), E'\r?\n') WITH ORDINALITY AS t (l, n)
  WHERE btrim(l) <> '' ORDER BY n LIMIT 1
$$;

-- ---------- 1b. The inbox's fields ----------
-- The fields a filter may name, and the kind of each. Nothing else is a field (src/lib/inboxApi.ts holds the same list; src/lib/inboxApi.test.ts compares them).
CREATE FUNCTION public.inbox_field_kind(p_field text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_field
    -- sync:begin inbox_fields
    WHEN 'kind' THEN 'choice'
    WHEN 'direction' THEN 'choice'
    WHEN 'is_new' THEN 'yes_no'
    WHEN 'owner' THEN 'person'
    WHEN 'account' THEN 'text'
    -- sync:end inbox_fields
  END
$$;

-- The values a choice field holds.
CREATE FUNCTION public.inbox_field_choices(p_field text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_field
    WHEN 'kind' THEN ARRAY[
      -- sync:begin inbox_kinds
      'contact', 'lead', 'peo'
      -- sync:end inbox_kinds
    ]
    WHEN 'direction' THEN ARRAY[
      -- sync:begin inbox_directions
      'received', 'sent'
      -- sync:end inbox_directions
    ]
  END
$$;

-- The filters of one call, checked as the leads table checks its own: at most 20, each on a listed field, each read by workspace_filter_check. Reads no mail.
CREATE FUNCTION public.inbox_filters_checked(p_firm_id uuid, p_filters jsonb, p_today date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  f jsonb;
  field text;
  kind text;
  checked jsonb;
  people uuid[];
  out jsonb := '[]'::jsonb;
BEGIN
  IF p_filters IS NULL OR p_filters = 'null'::jsonb THEN
    RETURN out;
  END IF;
  IF jsonb_typeof(p_filters) <> 'array' THEN
    RAISE EXCEPTION 'Filters are a list' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_filters) > 20 THEN
    RAISE EXCEPTION 'A table takes at most 20 filters' USING ERRCODE = '22023';
  END IF;
  FOR f IN SELECT e FROM jsonb_array_elements(p_filters) e LOOP
    IF jsonb_typeof(f) <> 'object' OR jsonb_typeof(f -> 'field') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'A filter is an object that names a field' USING ERRCODE = '22023';
    END IF;
    field := f ->> 'field';
    kind := public.inbox_field_kind(field);
    IF kind IS NULL THEN
      RAISE EXCEPTION 'The inbox has no field "%" to filter by', left(field, 64) USING ERRCODE = '22023';
    END IF;
    checked := public.workspace_filter_check(kind, f, public.inbox_field_choices(field), p_today);
    -- "Me" and "my team" worked out into the people they are, as the leads table does.
    IF kind = 'person' AND checked ->> 'op' = 'me' THEN
      checked := jsonb_build_object('op', 'any_of', 'vs', jsonb_build_array(auth.uid()::text));
    ELSIF kind = 'person' AND checked ->> 'op' = 'my_team' THEN
      WITH RECURSIVE my_teams (id) AS (
        SELECT m.team_id
        FROM public.firm_memberships m
        WHERE m.firm_id = p_firm_id AND m.user_id = auth.uid() AND m.team_id IS NOT NULL AND public.membership_is_current(m.valid_from, m.valid_until)
        UNION
        SELECT t.id FROM public.firm_teams t JOIN my_teams ON t.parent_team_id = my_teams.id
      )
      SELECT COALESCE(array_agg(DISTINCT o.user_id), '{}') INTO people
      FROM public.firm_memberships o
      WHERE o.firm_id = p_firm_id AND public.membership_is_current(o.valid_from, o.valid_until) AND o.team_id IN (SELECT id FROM my_teams);
      checked := jsonb_build_object('op', 'any_of', 'vs', to_jsonb(ARRAY(SELECT p::text FROM unnest(people) p ORDER BY p::text)));
    END IF;
    out := out || jsonb_build_array(checked || jsonb_build_object('field', field));
  END LOOP;
  RETURN out;
END;
$$;

-- Whether one row passes every checked filter ("and").
CREATE FUNCTION public.inbox_row_passes(r public.inbox_row, p_checked jsonb, p_time_zone text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_checked) f
    WHERE NOT COALESCE(CASE f ->> 'field'
      WHEN 'kind' THEN public.workspace_filter_match_choice(r.kind, f)
      WHEN 'direction' THEN public.workspace_filter_match_choice(r.direction, f)
      WHEN 'is_new' THEN public.workspace_filter_match_yes_no(r.is_new, f)
      WHEN 'owner' THEN public.workspace_filter_match_person(r.owner, f)
      WHEN 'account' THEN public.workspace_filter_match_text(r.account_name, f)
    END, false)
  )
$$;

-- Whether one message is new mail (D-607, D-665): written by a person to the firm (received, not automatic; the firm's own copy is sent, not received) and
-- recorded after its thread was last opened. The same test as conversation_has_new_mail and quote_requests_with_new_peo_mail, one message at a time, so a
-- thread has new mail exactly when one of its rows here is new (supabase/tests/inbox.sql compares them). Internal.
CREATE FUNCTION public.inbox_message_is_new(p_received boolean, p_automatic boolean, p_recorded_at timestamptz, p_last_opened_at timestamptz)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT p_received AND NOT p_automatic AND p_recorded_at > COALESCE(p_last_opened_at, '-infinity'::timestamptz)
$$;

-- Every message of the firm the caller may see that the search matches, each with its columns: the one definition of a row, which the list reads. Reads as its owner, so the
-- visibility is decided here: a contact's conversation by its account (the level rule, as conversation_for).
CREATE FUNCTION public.inbox_rows(p_firm_id uuid, p_search text DEFAULT NULL)
RETURNS SETOF public.inbox_row
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  terms text[] := ARRAY(SELECT lower(t) FROM regexp_split_to_table(left(btrim(COALESCE(p_search, '')), 200), '\s+') AS t WHERE t <> '');
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      'c:' || m.id::text AS id, 'contact'::text AS kind, v.id::text AS thread_id,
      CASE WHEN m.direction = 'inbound' THEN 'received' ELSE 'sent' END AS direction,
      public.inbox_message_is_new(m.direction = 'inbound', m.is_automatic, m.recorded_at, v.last_opened_at) AS is_new, m.is_automatic,
      m.from_address, m.from_name, m.subject, public.inbox_first_line(m.body_text) AS first_line, m.recorded_at AS at,
      a.id AS account_id, a.name AS account_name, k.id AS contact_id, NULLIF(btrim(concat_ws(' ', k.first_name, k.last_name)), '') AS contact_name,
      NULL::uuid AS lead_id, NULL::text AS lead_name, NULL::text AS peo_name, NULL::uuid AS session_id,
      -- Whose it is: the account's owner, whose level rule decides who sees the conversation.
      a.owner_id
    FROM public.conversation_messages m
    JOIN public.conversations v ON v.id = m.conversation_id
    JOIN public.contacts k ON k.id = v.contact_id
    JOIN public.accounts a ON a.id = k.account_id
    WHERE m.firm_id = p_firm_id AND v.firm_id = p_firm_id AND public.can_see_firm_record(a.firm_id, a.owner_id)
    UNION ALL
    -- A lead's conversation by its lead, as open_conversation sees it: by the level rule, and one in the bin by an owner (or support) only.
    SELECT
      'c:' || m.id::text, 'lead', v.id::text,
      CASE WHEN m.direction = 'inbound' THEN 'received' ELSE 'sent' END,
      public.inbox_message_is_new(m.direction = 'inbound', m.is_automatic, m.recorded_at, v.last_opened_at), m.is_automatic,
      m.from_address, m.from_name, m.subject, public.inbox_first_line(m.body_text), m.recorded_at,
      -- A lead has no account until it is converted: its business stands for one (D-693), linked to nothing.
      NULL::uuid, NULLIF(btrim(l.business), ''), NULL::uuid, NULL::text, l.id, l.name, NULL::text, NULL::uuid,
      l.owner_id
    FROM public.conversation_messages m
    JOIN public.conversations v ON v.id = m.conversation_id
    JOIN public.leads l ON l.id = v.lead_id
    WHERE m.firm_id = p_firm_id AND v.firm_id = p_firm_id AND public.can_see_firm_record(l.firm_id, l.owner_id)
      AND (l.deleted_at IS NULL OR public.firm_role(l.firm_id) = 'owner' OR public.is_support_session(l.firm_id))
    UNION ALL
    -- A PEO thread's message: on a quote request of an intake the queue lists (its workflow row, not an empty guest draft it hides), which every member of
    -- the firm reads, as the queue and the thread do (D-690). Held mail is on no quote request, so in no row. What it is about: the PEO, and the account of
    -- the intake's opportunity when the caller may see that account, else the company the intake names; whose it is, the opportunity's owner.
    SELECT
      'q:' || x.id::text, 'peo', q.id::text,
      CASE WHEN x.direction = 'received' THEN 'received' ELSE 'sent' END,
      public.inbox_message_is_new(x.direction = 'received', x.is_automatic, x.recorded_at, rd.last_opened_at), x.is_automatic,
      x.from_address, x.from_name, x.subject, public.inbox_first_line(x.body_text), x.recorded_at,
      opp.account_id, COALESCE(opp.account_name, NULLIF(btrim(s.chamber_data ->> 'company_name'), '')), NULL::uuid, NULL::text, NULL::uuid, NULL::text,
      q.peo_name, s.id,
      opp.owner_id
    FROM public.quote_request_messages x
    JOIN public.quote_requests q ON q.id = x.quote_request_id
    JOIN public.chamber_sessions s ON s.id = q.session_id
    JOIN public.submission_workflow w ON w.session_id = s.id
    LEFT JOIN public.quote_request_thread_reads rd ON rd.quote_request_id = q.id
    LEFT JOIN LATERAL (
      SELECT o.owner_id,
        CASE WHEN public.can_see_firm_record(a.firm_id, a.owner_id) THEN a.id END AS account_id,
        CASE WHEN public.can_see_firm_record(a.firm_id, a.owner_id) THEN a.name END AS account_name
      FROM public.opportunities o JOIN public.accounts a ON a.id = o.account_id
      WHERE o.intake_id = s.id AND o.firm_id = p_firm_id
      LIMIT 1
    ) opp ON true
    WHERE s.firm_id = p_firm_id
      AND NOT public.queue_hides_empty_guest_draft(s.id, (SELECT u.is_anonymous FROM auth.users u WHERE u.id = s.user_id),
                                                  s.chamber_data, s.field_provenance, s.transcript, s.chosen_peo)
  )
  SELECT (ROW(
    b.id, b.kind, b.thread_id, b.direction, b.is_new, b.is_automatic, b.from_address, b.from_name, b.subject, b.first_line, b.at,
    b.account_id, b.account_name, b.contact_id, b.contact_name, b.lead_id, b.lead_name, b.peo_name, b.session_id,
    mem.user_id, mem.name
  )::public.inbox_row).*
  FROM base b
  -- The owner only while they are a current member of the firm: a record whose owner left reads as owned by no one, as the leads table has it.
  LEFT JOIN LATERAL (
    SELECT fm.user_id, public.person_display_name(u.raw_user_meta_data, u.email::text) AS name
    FROM public.firm_memberships fm
    JOIN auth.users u ON u.id = fm.user_id
    WHERE fm.firm_id = p_firm_id AND fm.user_id = b.owner_id AND public.membership_is_current(fm.valid_from, fm.valid_until)
    LIMIT 1
  ) mem ON true
  -- Search: every word somewhere in the sender (address or name), the subject or the account, ignoring case. Never the body (CRM-E1.4).
  WHERE NOT EXISTS (
    SELECT 1 FROM unnest(terms) AS w (term)
    WHERE strpos(lower(concat_ws(E'\n', b.from_address, b.from_name, b.subject, b.account_name)), w.term) = 0
  );
END;
$$;

-- ---------- 2. What the browser calls ----------
-- One page of the inbox, newest first, 50 a page, with how many match in all: {"rows": [...], "total": n, "page": p, "page_size": 50}. One firm at a time:
-- the firm named, or (NULL) the caller's only firm at this address (firm_to_act_for).
CREATE FUNCTION public.inbox_list(
  p_firm_id uuid,
  p_filters jsonb DEFAULT '[]'::jsonb,
  p_sort text DEFAULT NULL,
  p_direction text DEFAULT 'desc',
  p_page integer DEFAULT 1,
  p_search text DEFAULT NULL,
  p_time_zone text DEFAULT 'UTC'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  page_size constant integer := 50;
  firm uuid;
  pg integer := COALESCE(p_page, 1);
  tz text;
  checked jsonb;
  result jsonb;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  tz := public.workspace_time_zone(p_time_zone);
  checked := public.inbox_filters_checked(firm, p_filters, (now() AT TIME ZONE tz)::date);
  WITH matched AS MATERIALIZED (
    SELECT r FROM public.inbox_rows(firm, p_search) r WHERE public.inbox_row_passes(r, checked, tz)
  ),
  ordered AS (
    SELECT m.r, row_number() OVER (ORDER BY (m.r).at DESC, (m.r).id) AS pos FROM matched m
  )
  SELECT jsonb_build_object(
    'rows', COALESCE((
      SELECT jsonb_agg(to_jsonb(o.r) ORDER BY o.pos)
      FROM ordered o
      WHERE o.pos > (pg - 1)::bigint * page_size AND o.pos <= pg::bigint * page_size
    ), '[]'::jsonb),
    'total', (SELECT count(*) FROM matched),
    'page', pg,
    'page_size', page_size
  ) INTO result;
  RETURN result;
END;
$$;

-- The count for each view's tab: `p_views` is a list of {"name": text, "filters": [...]}, at most 20, names unique; one row per view in the order given, each
-- counting what inbox_list would total for those filters and the search, for the same firm and person. One refused filter refuses the call, naming the view.
CREATE FUNCTION public.inbox_view_counts(p_firm_id uuid, p_views jsonb, p_search text DEFAULT NULL, p_time_zone text DEFAULT 'UTC')
RETURNS TABLE (view_name text, total bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  tz text;
  today date;
  v jsonb;
  names text[] := '{}';
  sets jsonb[] := '{}';
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  tz := public.workspace_time_zone(p_time_zone);
  today := (now() AT TIME ZONE tz)::date;
  IF p_views IS NULL OR jsonb_typeof(p_views) <> 'array' OR jsonb_array_length(p_views) NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'Views are a list of 1 to 20' USING ERRCODE = '22023';
  END IF;
  FOR v IN SELECT e FROM jsonb_array_elements(p_views) e LOOP
    IF jsonb_typeof(v) <> 'object' OR jsonb_typeof(v -> 'name') IS DISTINCT FROM 'string'
       OR EXISTS (SELECT 1 FROM jsonb_object_keys(v) k WHERE k NOT IN ('name', 'filters')) THEN
      RAISE EXCEPTION 'A view is an object with a name and its filters' USING ERRCODE = '22023';
    END IF;
    IF btrim(v ->> 'name') = '' OR char_length(v ->> 'name') > 100 THEN
      RAISE EXCEPTION 'A view''s name is 1 to 100 characters' USING ERRCODE = '22023';
    END IF;
    IF (v ->> 'name') = ANY (names) THEN
      RAISE EXCEPTION 'Two views are named "%"', v ->> 'name' USING ERRCODE = '22023';
    END IF;
    BEGIN
      sets := sets || public.inbox_filters_checked(firm, COALESCE(v -> 'filters', '[]'::jsonb), today);
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'View "%": %', v ->> 'name', SQLERRM USING ERRCODE = SQLSTATE;
    END;
    names := names || (v ->> 'name');
  END LOOP;

  RETURN QUERY
  WITH visible AS MATERIALIZED (
    SELECT r FROM public.inbox_rows(firm, p_search) r
  )
  SELECT w.name, (SELECT count(*) FROM visible x WHERE public.inbox_row_passes(x.r, w.filters, tz))
  FROM unnest(names, sets) WITH ORDINALITY AS w(name, filters, ord)
  ORDER BY w.ord;
END;
$$;

REVOKE ALL ON FUNCTION public.inbox_view_counts(uuid, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inbox_view_counts(uuid, jsonb, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.inbox_first_line(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.inbox_message_is_new(boolean, boolean, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.inbox_rows(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.inbox_field_kind(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.inbox_field_choices(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.inbox_filters_checked(uuid, jsonb, date) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.inbox_row_passes(public.inbox_row, jsonb, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.inbox_list(uuid, jsonb, text, text, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inbox_list(uuid, jsonb, text, text, integer, text, text) TO authenticated;

-- ---------- 3. The menu's Inbox count (CRM-S1.1c, D-695) ----------
-- menu_counts (20261121110500_leads_table_query.sql), restated with every count it had (quotes, inbox, leads). `inbox` was the intakes with new PEO mail; it is
-- now the threads with new mail the caller may see, PEO threads and conversations with contacts and leads: the threads the inbox's New view lists, read from
-- the inbox's own rows so the two can't disagree. The queue's own "has new PEO mail" filter is unchanged (D-8).
CREATE OR REPLACE FUNCTION public.menu_counts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  quotes bigint;
  inbox bigint;
  leads bigint;
BEGIN
  PERFORM public.require_advisor();
  -- The firms to look in: those the caller has a membership or an open support session for. This only narrows where to look;
  -- is_firm_member is the lock (current member, this address's firm, not suspended, past the second factor, or support's read).
  -- The rows are the queue's: an intake with its workflow row that the queue does not hide (queue_hides_empty_guest_draft).
  WITH mine AS (
    SELECT m.firm_id FROM public.firm_memberships m WHERE m.user_id = auth.uid()
    UNION
    SELECT s.firm_id FROM public.support_sessions s WHERE s.admin_id = auth.uid() AND s.ended_at IS NULL
  ), allowed AS MATERIALIZED (
    SELECT t.firm_id FROM mine t WHERE public.is_firm_member(t.firm_id)
  ), requests AS MATERIALIZED (
    SELECT q.id, q.session_id, q.status
    FROM public.chamber_sessions s
    JOIN public.submission_workflow w ON w.session_id = s.id
    JOIN public.quote_requests q ON q.session_id = s.id
    WHERE s.firm_id IN (SELECT a.firm_id FROM allowed a)
      -- The guest flag is read one session at a time, by key: joining the whole user table to the firm's sessions was a scan of every user.
      AND NOT public.queue_hides_empty_guest_draft(s.id, (SELECT u.is_anonymous FROM auth.users u WHERE u.id = s.user_id),
                                                  s.chamber_data, s.field_provenance, s.transcript, s.chosen_peo)
  )
  SELECT count(*) FILTER (WHERE r.status = 'sent') INTO quotes FROM requests r;
  -- The threads with new mail, in the same firms: one per PEO thread or conversation, however many new messages it has.
  SELECT count(DISTINCT (a.firm_id, r.kind, r.thread_id)) INTO inbox
  FROM (
    SELECT m.firm_id FROM public.firm_memberships m WHERE m.user_id = auth.uid()
    UNION
    SELECT s.firm_id FROM public.support_sessions s WHERE s.admin_id = auth.uid() AND s.ended_at IS NULL) a
  CROSS JOIN LATERAL public.inbox_rows(a.firm_id) r
  WHERE public.is_firm_member(a.firm_id) AND r.is_new;
  -- Open leads (New or Working) the caller may see by the level rule, the bin left out (CRM-S1.1, CRM-L1.1a), in the same firms.
  SELECT count(*) INTO leads
  FROM public.leads l
  WHERE l.firm_id IN (
      SELECT m.firm_id FROM public.firm_memberships m WHERE m.user_id = auth.uid()
      UNION
      SELECT s.firm_id FROM public.support_sessions s WHERE s.admin_id = auth.uid() AND s.ended_at IS NULL)
    AND public.is_firm_member(l.firm_id)
    AND l.status IN ('new', 'working') AND l.deleted_at IS NULL
    AND public.can_see_firm_record(l.firm_id, l.owner_id);
  RETURN jsonb_build_object('quotes', quotes, 'inbox', inbox, 'leads', leads);
END;
$$;
