-- Calls, notes and tasks on an account and a contact (story CRM-E1.5; docs/BROKER_CRM_BUILD.md D-24, D-28, D-29, D-33, D-44, D-200, D-201, D-204, D-209,
-- D-212; GLOSSARY.md "The broker's CRM"; ADR 0016, ADR 0023, ADR 0024; 20261119100000_crm_records.sql, 20261119140000_account_page.sql).
--
-- What this is. One table, `activities`, holds a firm's calls, notes and tasks. Each is on one account and may name a contact of that account (a call's
-- "With", or the contact a note or task is about) and an opportunity of that account (a call's "About"). Leads are not built yet: a lead's calls, notes and
-- tasks come with them (CRM-L1.x), on the same table.
--
--   * Who sees one: whoever may see its account (can_see_firm_record on the account's owner), which is also how a contact and an opportunity are seen, so a
--     change of the account's owner moves its calls, notes and tasks at once. Nobody writes the table through the API: every write is one of the
--     functions below, which ask in this order for a member of the firm the call acts for (firm_to_act_for), the one write guard (assert_firm_writable: a
--     closing firm and a Nevermore support session are refused, ADR 0023, ADR 0024) and then an account the caller may see (the one refusal, PT404, for an
--     account that is not there or not theirs).
--   * Adding one (log_activity) is open to anyone who may see the account (D-209). A call may add a follow-up task in the same step: both rows are written
--     or neither is.
--   * D-200, kept in the database and not only on screen: a note can be changed only by the person who wrote it and only for 24 hours; after that it is
--     fixed, and add_to_note appends a dated addition, which anyone who may see the account can make. A trigger guards this whatever function writes, and
--     keeps the additions append-only. A call or a task stays editable (update_activity): by whoever logged it, by the person a task is for, or by whoever
--     the level rule lets change the account (can_change_firm_record). Anyone who may see the account can mark a task done or open again (set_task_done).
--   * The Activity tab (D-212): account_tab_rows, the one place every tab's rows are built, gains the calls, notes and tasks in its 'activity' list, newest
--     first beside the record history, and four more tab names for the filters: 'activity_calls', 'activity_notes', 'activity_tasks', 'activity_changes'.
--   * Closing a firm deletes them (firm_closing_plan); deleting an account deletes them with it (D-204).
--
-- Deferred: an account's last activity (D-201) takes these rows in the next migration, once the accounts table's query exists (CRM-A1.1b).
-- A task due today shows on Home for the person it is for (Home is its own story); `activities_task_due_idx` is the index that list will use.

-- ---------- 1. The table ----------
-- An opportunity can be named by an activity only of its own account, so the pair is a key.
ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_account_id_id_key UNIQUE (account_id, id);

CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL,
  account_id uuid NOT NULL,
  kind text NOT NULL CONSTRAINT activities_kind_check CHECK (kind IN ('call', 'note', 'task')),
  contact_id uuid,
  opportunity_id uuid,
  -- Who logged it. Cleared if that person's account is deleted; never changed to someone else.
  author_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  -- When a call took place; when a note or a task was made.
  at timestamptz NOT NULL DEFAULT now(),
  -- A call: how it went. 'spoke', 'left_message', 'no_answer' or 'wrong_number'.
  outcome text CONSTRAINT activities_outcome_check CHECK (outcome IN ('spoke', 'left_message', 'no_answer', 'wrong_number')),
  -- A task: what is to be done.
  title text CONSTRAINT activities_title_check CHECK (char_length(title) <= 300),
  -- A call: what was said. A note: its text.
  body text CONSTRAINT activities_body_check CHECK (char_length(body) <= 5000),
  -- A note's dated additions, oldest first: [{at, by, text}]. Only ever appended to.
  additions jsonb NOT NULL DEFAULT '[]'::jsonb CONSTRAINT activities_additions_check CHECK (jsonb_typeof(additions) = 'array'),
  -- A task: who it is for (cleared if they leave the product), when it is due, and when and by whom it was done.
  assignee_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  due_on date,
  done_at timestamptz,
  done_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activities_account_fkey FOREIGN KEY (firm_id, account_id) REFERENCES public.accounts (firm_id, id) ON DELETE CASCADE,
  -- A contact and an opportunity of the same account. A deleted contact or opportunity leaves the activity on the account.
  CONSTRAINT activities_contact_fkey FOREIGN KEY (account_id, contact_id) REFERENCES public.contacts (account_id, id) ON DELETE SET NULL (contact_id),
  CONSTRAINT activities_opportunity_fkey FOREIGN KEY (account_id, opportunity_id) REFERENCES public.opportunities (account_id, id) ON DELETE SET NULL (opportunity_id),
  -- Each kind holds its own columns and none of the others'.
  CONSTRAINT activities_call_shape CHECK (kind <> 'call' OR (
    outcome IS NOT NULL AND title IS NULL AND additions = '[]'::jsonb AND assignee_id IS NULL AND due_on IS NULL AND done_at IS NULL AND done_by IS NULL)),
  CONSTRAINT activities_note_shape CHECK (kind <> 'note' OR (
    nullif(btrim(body), '') IS NOT NULL AND outcome IS NULL AND title IS NULL AND assignee_id IS NULL AND due_on IS NULL AND done_at IS NULL AND done_by IS NULL)),
  CONSTRAINT activities_task_shape CHECK (kind <> 'task' OR (
    nullif(btrim(title), '') IS NOT NULL AND due_on IS NOT NULL AND outcome IS NULL AND body IS NULL AND additions = '[]'::jsonb
    AND (done_by IS NULL OR done_at IS NOT NULL)))
);

CREATE INDEX activities_account_idx ON public.activities (account_id, at DESC, id DESC);
CREATE INDEX activities_firm_idx ON public.activities (firm_id, account_id);
CREATE INDEX activities_contact_idx ON public.activities (contact_id) WHERE contact_id IS NOT NULL;
-- What Home will ask: the open tasks a person has, by when they are due.
CREATE INDEX activities_task_due_idx ON public.activities (firm_id, assignee_id, due_on) WHERE kind = 'task' AND done_at IS NULL;

COMMENT ON TABLE public.activities IS 'A call, a note or a task on an account (glossary: Call, Note, Task). Written only by log_activity, update_activity, add_to_note and set_task_done.';

CREATE TRIGGER activities_updated_at BEFORE UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- 2. The note rule (D-200), whoever writes ----------
-- What may never change: the row's identity, its kind, its account and when it was made; its author may only be cleared. A note's text changes only in
-- the hands of the person who wrote it, within a day of writing it; its additions only grow at the end.
CREATE FUNCTION public.activities_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  n integer;
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.firm_id IS DISTINCT FROM OLD.firm_id OR NEW.account_id IS DISTINCT FROM OLD.account_id
     OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'A call, note or task can''t be moved to another account or made into another kind' USING ERRCODE = '42501';
  END IF;
  IF NEW.author_id IS DISTINCT FROM OLD.author_id AND NEW.author_id IS NOT NULL THEN
    RAISE EXCEPTION 'Who logged a call, note or task can''t be changed' USING ERRCODE = '42501';
  END IF;
  IF OLD.kind = 'note' THEN
    IF NEW.body IS DISTINCT FROM OLD.body OR NEW.at IS DISTINCT FROM OLD.at THEN
      IF OLD.author_id IS NULL OR OLD.author_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Only the person who wrote a note can change it' USING ERRCODE = '42501';
      END IF;
      IF now() >= OLD.created_at + interval '24 hours' THEN
        RAISE EXCEPTION 'A note can''t be changed after a day. Add to it instead.' USING ERRCODE = '42501';
      END IF;
    END IF;
    IF NEW.additions IS DISTINCT FROM OLD.additions THEN
      n := jsonb_array_length(OLD.additions);
      IF jsonb_array_length(NEW.additions) < n OR COALESCE((
           SELECT jsonb_agg(x.e ORDER BY x.i) FROM jsonb_array_elements(NEW.additions) WITH ORDINALITY AS x (e, i) WHERE x.i <= n), '[]'::jsonb)
         IS DISTINCT FROM OLD.additions THEN
        RAISE EXCEPTION 'What was added to a note can''t be changed or taken away' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.activities_guard() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER activities_guard BEFORE UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.activities_guard();

-- ---------- 3. Row security ----------
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.activities FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.activities TO authenticated, service_role;

CREATE POLICY activities_visible ON public.activities FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = activities.account_id AND public.can_see_firm_record(a.firm_id, a.owner_id)));

-- ---------- 4. Small pieces, internal ----------
-- Whether the caller may change THIS call, note or task as its own (the account is already known to be one they may see). A note: its writer, for 24 hours.
-- A call or a task: whoever logged it, the person a task is for, or whoever may change the account (the level rule, D-209). Marking a task done and
-- adding to a note are not changing, and need only sight of the account.
CREATE FUNCTION public.can_edit_activity(a public.activities)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE a.kind
    WHEN 'note' THEN a.author_id IS NOT NULL AND a.author_id = auth.uid() AND now() < a.created_at + interval '24 hours'
    ELSE (a.author_id IS NOT NULL AND a.author_id = auth.uid())
      OR (a.assignee_id IS NOT NULL AND a.assignee_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.accounts x WHERE x.id = a.account_id AND public.can_change_firm_record(x.firm_id, x.owner_id))
  END
$$;

REVOKE ALL ON FUNCTION public.can_edit_activity(public.activities) FROM PUBLIC, anon, authenticated, service_role;

-- One call, note or task as the Activity tab and a save answer it. The words of the people and records are looked up here, so a row is complete. Internal.
CREATE FUNCTION public.crm_activity_row(a public.activities)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'type', a.kind, 'id', a.id, 'entry_key', a.id, 'at', a.at, 'created_at', a.created_at, 'updated_at', a.updated_at,
    'who', public.crm_person_name(a.author_id), 'who_kind', 'member', 'author_id', a.author_id,
    'account_id', a.account_id,
    'contact', (SELECT jsonb_build_object('id', c.id, 'name', btrim(concat_ws(' ', c.first_name, c.last_name))) FROM public.contacts c WHERE c.id = a.contact_id),
    'opportunity', (SELECT jsonb_build_object('id', o.id, 'name', o.name) FROM public.opportunities o WHERE o.id = a.opportunity_id),
    'outcome', a.outcome, 'title', a.title, 'body', a.body,
    'additions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('at', e.v ->> 'at', 'who', public.crm_person_name(NULLIF(e.v ->> 'by', '')::uuid), 'text', e.v ->> 'text') ORDER BY e.i)
      FROM jsonb_array_elements(a.additions) WITH ORDINALITY AS e (v, i)), '[]'::jsonb),
    'assignee', CASE WHEN a.assignee_id IS NULL THEN NULL ELSE jsonb_build_object('id', a.assignee_id, 'name', public.crm_person_name(a.assignee_id)) END,
    'due_on', a.due_on, 'done_at', a.done_at, 'done_by', public.crm_person_name(a.done_by),
    'can_edit', public.can_edit_activity(a),
    'editable_until', CASE WHEN a.kind = 'note' THEN a.created_at + interval '24 hours' END)
$$;

REVOKE ALL ON FUNCTION public.crm_activity_row(public.activities) FROM PUBLIC, anon, authenticated, service_role;

-- The first thing wrong with what was sent for a call, a note or a task, in words, or NULL. Internal.
CREATE FUNCTION public.activity_input_error(p_kind text, p_outcome text, p_body text, p_title text, p_due_on date)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_kind
    WHEN 'call' THEN CASE
      WHEN p_outcome IS NULL OR p_outcome NOT IN ('spoke', 'left_message', 'no_answer', 'wrong_number') THEN 'Choose how the call went.'
      WHEN char_length(p_body) > 5000 THEN 'Keep what was said to 5,000 characters.' END
    WHEN 'note' THEN CASE
      WHEN p_body IS NULL THEN 'Write the note.'
      WHEN char_length(p_body) > 5000 THEN 'Keep the note to 5,000 characters.' END
    WHEN 'task' THEN CASE
      WHEN p_title IS NULL THEN 'Say what the task is.'
      WHEN char_length(p_title) > 300 THEN 'Keep the task to 300 characters.'
      WHEN p_due_on IS NULL THEN 'Choose when the task is due.' END
    ELSE 'Choose a call, a note or a task.'
  END
$$;

REVOKE ALL ON FUNCTION public.activity_input_error(text, text, text, text, date) FROM PUBLIC, anon, authenticated, service_role;

-- Whether a person is a current member of the firm, so a task can be for them. Internal.
CREATE FUNCTION public.crm_is_current_member(p_firm_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.firm_memberships m
                 WHERE m.firm_id = p_firm_id AND m.user_id = p_user_id AND public.membership_is_current(m.valid_from, m.valid_until))
$$;

REVOKE ALL ON FUNCTION public.crm_is_current_member(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 5. Logging ----------
-- Logs a call, a note or a task on an account, naming a contact and an opportunity of that account if it is with or about them. Answers
-- {activity: <the row>, follow_up: <the task row, or null>}. For a call, p_at is when it took place (now when not sent, and not in the future); a note or a
-- task is made now. A task's p_for is the person it is for (the caller when not sent), who must be a current member of the firm. A call may also carry a
-- follow-up task (p_follow_up_*), written in the same step: if either fails, neither is saved.
-- Refused, in this order: not a member of the firm (42501), a closing firm or Nevermore support (PT423), an account the caller may not see or that is not
-- there (PT404, one answer for both), what is wrong with what was sent (22023, in words).
CREATE FUNCTION public.log_activity(
  p_kind text, p_account_id uuid, p_contact_id uuid DEFAULT NULL, p_opportunity_id uuid DEFAULT NULL, p_at timestamptz DEFAULT NULL,
  p_outcome text DEFAULT NULL, p_body text DEFAULT NULL, p_title text DEFAULT NULL, p_due_on date DEFAULT NULL, p_for uuid DEFAULT NULL,
  p_follow_up_title text DEFAULT NULL, p_follow_up_due_on date DEFAULT NULL, p_follow_up_for uuid DEFAULT NULL, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  a public.accounts;
  body_in text := NULLIF(btrim(p_body), '');
  title_in text := NULLIF(btrim(p_title), '');
  fu_title text := NULLIF(btrim(p_follow_up_title), '');
  problem text;
  made public.activities;
  follow public.activities;
  who uuid := auth.uid();
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  IF p_kind IS NULL OR p_kind NOT IN ('call', 'note', 'task') THEN
    RAISE EXCEPTION 'Choose a call, a note or a task.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO a FROM public.accounts x WHERE x.id = p_account_id AND x.firm_id = firm;
  IF a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RAISE EXCEPTION 'That account isn''t available' USING ERRCODE = 'PT404';
  END IF;
  problem := public.activity_input_error(p_kind, p_outcome, body_in, title_in, p_due_on);
  IF problem IS NULL AND p_kind = 'call' AND p_at IS NOT NULL AND p_at > now() + interval '5 minutes' THEN
    problem := 'A call can''t be in the future.';
  END IF;
  IF problem IS NULL AND p_contact_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = p_contact_id AND c.account_id = a.id) THEN
    problem := 'Choose a contact of this account.';
  END IF;
  IF problem IS NULL AND p_opportunity_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = p_opportunity_id AND o.account_id = a.id) THEN
    problem := 'Choose an opportunity of this account.';
  END IF;
  IF problem IS NULL AND p_kind = 'task' AND p_for IS NOT NULL AND NOT public.crm_is_current_member(firm, p_for) THEN
    problem := 'Choose someone from the firm for the task.';
  END IF;
  IF problem IS NULL AND p_kind <> 'call' AND (fu_title IS NOT NULL OR p_follow_up_due_on IS NOT NULL OR p_follow_up_for IS NOT NULL) THEN
    problem := 'Only a call can add a follow-up task.';
  END IF;
  IF problem IS NULL AND (p_follow_up_due_on IS NOT NULL OR p_follow_up_for IS NOT NULL) AND fu_title IS NULL THEN
    problem := 'Say what the follow-up task is.';
  END IF;
  IF problem IS NULL AND fu_title IS NOT NULL THEN
    problem := public.activity_input_error('task', NULL, NULL, fu_title, p_follow_up_due_on);
    IF problem IS NOT NULL THEN problem := replace(problem, 'the task', 'the follow-up task'); END IF;
    IF problem IS NULL AND p_follow_up_for IS NOT NULL AND NOT public.crm_is_current_member(firm, p_follow_up_for) THEN
      problem := 'Choose someone from the firm for the follow-up task.';
    END IF;
  END IF;
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.activities (firm_id, account_id, kind, contact_id, opportunity_id, author_id, at, outcome, body, title, due_on, assignee_id)
  VALUES (firm, a.id, p_kind, p_contact_id, p_opportunity_id, who,
          CASE WHEN p_kind = 'call' THEN COALESCE(p_at, now()) ELSE now() END,
          CASE WHEN p_kind = 'call' THEN p_outcome END,
          CASE WHEN p_kind IN ('call', 'note') THEN body_in END,
          CASE WHEN p_kind = 'task' THEN title_in END,
          CASE WHEN p_kind = 'task' THEN p_due_on END,
          CASE WHEN p_kind = 'task' THEN COALESCE(p_for, who) END)
  RETURNING * INTO made;
  IF fu_title IS NOT NULL THEN
    INSERT INTO public.activities (firm_id, account_id, kind, contact_id, opportunity_id, author_id, title, due_on, assignee_id)
    VALUES (firm, a.id, 'task', p_contact_id, p_opportunity_id, who, fu_title, p_follow_up_due_on, COALESCE(p_follow_up_for, who))
    RETURNING * INTO follow;
  END IF;
  RETURN jsonb_build_object('activity', public.crm_activity_row(made), 'follow_up', CASE WHEN follow.id IS NULL THEN NULL ELSE public.crm_activity_row(follow) END);
END;
$$;

REVOKE ALL ON FUNCTION public.log_activity(text, uuid, uuid, uuid, timestamptz, text, text, text, date, uuid, text, date, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_activity(text, uuid, uuid, uuid, timestamptz, text, text, text, date, uuid, text, date, uuid, uuid) TO authenticated;

-- ---------- 6. Changing one ----------
-- Saves a call or a task as sent (every field is sent; a call's contact, opportunity and what was said may be blank), or a note's text. A note's other
-- fields are not its to send and are ignored. Answers the row. Refused, in this order: not a member (42501), a closing firm or Nevermore support (PT423),
-- an activity the caller may not see or that is not there (PT404), what is wrong with what was sent (22023), an activity the caller may not change (42501):
-- a note by anyone but its writer, or after a day (D-200); a call or a task by someone who did not log it, is not it's for and may not change the account.
CREATE FUNCTION public.update_activity(
  p_activity_id uuid, p_contact_id uuid DEFAULT NULL, p_opportunity_id uuid DEFAULT NULL, p_at timestamptz DEFAULT NULL, p_outcome text DEFAULT NULL,
  p_body text DEFAULT NULL, p_title text DEFAULT NULL, p_due_on date DEFAULT NULL, p_for uuid DEFAULT NULL, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  cur public.activities;
  acc public.accounts;
  body_in text := NULLIF(btrim(p_body), '');
  title_in text := NULLIF(btrim(p_title), '');
  problem text;
  saved public.activities;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  SELECT * INTO cur FROM public.activities x WHERE x.id = p_activity_id AND x.firm_id = firm FOR NO KEY UPDATE;
  SELECT * INTO acc FROM public.accounts x WHERE x.id = cur.account_id;
  IF cur.id IS NULL OR NOT public.can_see_firm_record(acc.firm_id, acc.owner_id) THEN
    RAISE EXCEPTION 'That isn''t available' USING ERRCODE = 'PT404';
  END IF;
  problem := public.activity_input_error(cur.kind, p_outcome, body_in, title_in, p_due_on);
  IF problem IS NULL AND cur.kind = 'call' AND p_at IS NOT NULL AND p_at > now() + interval '5 minutes' THEN
    problem := 'A call can''t be in the future.';
  END IF;
  IF problem IS NULL AND cur.kind <> 'note' AND p_contact_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = p_contact_id AND c.account_id = acc.id) THEN
    problem := 'Choose a contact of this account.';
  END IF;
  IF problem IS NULL AND cur.kind <> 'note' AND p_opportunity_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = p_opportunity_id AND o.account_id = acc.id) THEN
    problem := 'Choose an opportunity of this account.';
  END IF;
  IF problem IS NULL AND cur.kind = 'task' AND p_for IS NOT NULL AND p_for IS DISTINCT FROM cur.assignee_id AND NOT public.crm_is_current_member(firm, p_for) THEN
    problem := 'Choose someone from the firm for the task.';
  END IF;
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  IF NOT public.can_edit_activity(cur) THEN
    RAISE EXCEPTION '%', CASE
      WHEN cur.kind = 'note' AND cur.author_id IS NOT DISTINCT FROM auth.uid() THEN 'A note can''t be changed after a day. Add to it instead.'
      WHEN cur.kind = 'note' THEN 'Only the person who wrote a note can change it.'
      ELSE 'Only whoever logged it, whoever it is for, the account''s owner, a lead of the owner''s team or an owner of the firm can change it.' END
      USING ERRCODE = '42501';
  END IF;
  IF cur.kind = 'note' THEN
    UPDATE public.activities SET body = body_in WHERE id = cur.id RETURNING * INTO saved;
  ELSIF cur.kind = 'call' THEN
    UPDATE public.activities SET contact_id = p_contact_id, opportunity_id = p_opportunity_id, at = COALESCE(p_at, cur.at), outcome = p_outcome, body = body_in
    WHERE id = cur.id RETURNING * INTO saved;
  ELSE
    UPDATE public.activities SET contact_id = p_contact_id, opportunity_id = p_opportunity_id, title = title_in, due_on = p_due_on,
      assignee_id = COALESCE(p_for, cur.assignee_id)
    WHERE id = cur.id RETURNING * INTO saved;
  END IF;
  RETURN public.crm_activity_row(saved);
END;
$$;

REVOKE ALL ON FUNCTION public.update_activity(uuid, uuid, uuid, timestamptz, text, text, text, date, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_activity(uuid, uuid, uuid, timestamptz, text, text, text, date, uuid, uuid) TO authenticated;

-- Appends a dated addition to a note (D-200): "Add to note". Anyone who may see the account can, whenever, and it is dated and signed. Answers the row.
-- Refused as update_activity is, and with 22023 for something that is not a note or an empty addition.
CREATE FUNCTION public.add_to_note(p_activity_id uuid, p_text text, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  cur public.activities;
  acc public.accounts;
  text_in text := NULLIF(btrim(p_text), '');
  saved public.activities;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  SELECT * INTO cur FROM public.activities x WHERE x.id = p_activity_id AND x.firm_id = firm FOR NO KEY UPDATE;
  SELECT * INTO acc FROM public.accounts x WHERE x.id = cur.account_id;
  IF cur.id IS NULL OR NOT public.can_see_firm_record(acc.firm_id, acc.owner_id) THEN
    RAISE EXCEPTION 'That isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF cur.kind <> 'note' THEN
    RAISE EXCEPTION 'Only a note can be added to.' USING ERRCODE = '22023';
  END IF;
  IF text_in IS NULL THEN
    RAISE EXCEPTION 'Write what to add.' USING ERRCODE = '22023';
  END IF;
  IF char_length(text_in) > 5000 THEN
    RAISE EXCEPTION 'Keep what you add to 5,000 characters.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.activities SET additions = additions || jsonb_build_array(jsonb_build_object('at', now(), 'by', auth.uid(), 'text', text_in))
  WHERE id = cur.id RETURNING * INTO saved;
  RETURN public.crm_activity_row(saved);
END;
$$;

REVOKE ALL ON FUNCTION public.add_to_note(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_to_note(uuid, text, uuid) TO authenticated;

-- Marks a task done, or open again (p_done false). Anyone who may see its account can (D-200). It is the first time it was done that is kept: marking a
-- done task done again changes nothing. Answers the row.
CREATE FUNCTION public.set_task_done(p_activity_id uuid, p_done boolean, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  cur public.activities;
  acc public.accounts;
  saved public.activities;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  SELECT * INTO cur FROM public.activities x WHERE x.id = p_activity_id AND x.firm_id = firm FOR NO KEY UPDATE;
  SELECT * INTO acc FROM public.accounts x WHERE x.id = cur.account_id;
  IF cur.id IS NULL OR NOT public.can_see_firm_record(acc.firm_id, acc.owner_id) THEN
    RAISE EXCEPTION 'That isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF cur.kind <> 'task' THEN
    RAISE EXCEPTION 'Only a task can be marked done.' USING ERRCODE = '22023';
  END IF;
  IF p_done IS NULL THEN
    RAISE EXCEPTION 'Say whether the task is done.' USING ERRCODE = '22023';
  END IF;
  IF p_done AND cur.done_at IS NULL THEN
    UPDATE public.activities SET done_at = now(), done_by = auth.uid() WHERE id = cur.id RETURNING * INTO saved;
  ELSIF NOT p_done AND cur.done_at IS NOT NULL THEN
    UPDATE public.activities SET done_at = NULL, done_by = NULL WHERE id = cur.id RETURNING * INTO saved;
  ELSE
    saved := cur;
  END IF;
  RETURN public.crm_activity_row(saved);
END;
$$;

REVOKE ALL ON FUNCTION public.set_task_done(uuid, boolean, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_task_done(uuid, boolean, uuid) TO authenticated;

-- ---------- 7. What the log form offers ----------
-- {contacts: [{id, name, title}], opportunities: [{id, name}], people: [{id, name}]} for an account the caller may see: the contacts and opportunities a call
-- can be with or about (the first 200 of each), and the firm's current members a task can be for. NULL, as for an account that is not there, for anyone else.
CREATE FUNCTION public.account_activity_options(p_firm_id uuid, p_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  a public.accounts;
BEGIN
  IF p_firm_id IS NULL OR p_account_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT * INTO a FROM public.accounts x WHERE x.id = p_account_id AND x.firm_id = p_firm_id;
  IF a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'contacts', COALESCE((SELECT jsonb_agg(x.j ORDER BY x.o) FROM (
      SELECT row_number() OVER (ORDER BY c.is_main DESC, lower(c.last_name), lower(COALESCE(c.first_name, '')), c.id) AS o,
             jsonb_build_object('id', c.id, 'name', btrim(concat_ws(' ', c.first_name, c.last_name)), 'title', c.title) AS j
      FROM public.contacts c WHERE c.account_id = a.id
      ORDER BY c.is_main DESC, lower(c.last_name), lower(COALESCE(c.first_name, '')), c.id LIMIT 200) x), '[]'::jsonb),
    'opportunities', COALESCE((SELECT jsonb_agg(x.j ORDER BY x.o) FROM (
      SELECT row_number() OVER (ORDER BY o.target_start DESC NULLS LAST, o.created_at DESC, o.id) AS o, jsonb_build_object('id', o.id, 'name', o.name) AS j
      FROM public.opportunities o WHERE o.account_id = a.id
      ORDER BY o.target_start DESC NULLS LAST, o.created_at DESC, o.id LIMIT 200) x), '[]'::jsonb),
    'people', COALESCE((SELECT jsonb_agg(x.j ORDER BY lower(x.n), x.u) FROM (
      SELECT DISTINCT m.user_id AS u, public.crm_person_name(m.user_id) AS n, jsonb_build_object('id', m.user_id, 'name', public.crm_person_name(m.user_id)) AS j
      FROM public.firm_memberships m WHERE m.firm_id = a.firm_id AND public.membership_is_current(m.valid_from, m.valid_until)) x), '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.account_activity_options(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_activity_options(uuid, uuid) TO authenticated;

-- ---------- 8. The Activity tab: one list ----------
-- account_tab_rows (20261119140000), restated with every branch it had and the Activity branch changed (D-212). 'activity' is one list, newest first, of the
-- account's calls, notes and tasks and the record history of the account and of its contacts; 'activity_calls', 'activity_notes', 'activity_tasks' and
-- 'activity_changes' are the same list filtered. A call, note or task row is as crm_activity_row gives it; a history row keeps `type` 'change'. A call is
-- placed at when it took place, a note or a task at when it was made.
CREATE OR REPLACE FUNCTION public.account_tab_rows(p_account_id uuid, p_tab text, p_limit integer, p_offset integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  n bigint;
  r jsonb;
BEGIN
  IF p_limit IS NULL OR p_limit < 0 OR p_limit > 100 OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'A page is 0 to 100 rows, from a place that is not before the first' USING ERRCODE = '22023';
  END IF;
  IF p_tab = 'contacts' THEN
    SELECT count(*) INTO n FROM public.contacts c WHERE c.account_id = p_account_id;
    SELECT COALESCE(jsonb_agg(x.j ORDER BY x.o), '[]'::jsonb) INTO r FROM (
      SELECT row_number() OVER (ORDER BY c.is_main DESC, lower(c.last_name), lower(COALESCE(c.first_name, '')), c.id) AS o,
             jsonb_build_object('id', c.id, 'first_name', c.first_name, 'last_name', c.last_name, 'title', c.title, 'email', c.email, 'phone', c.phone,
                                'mobile', c.mobile, 'is_main', c.is_main, 'do_not_email', c.do_not_email) AS j
      FROM public.contacts c WHERE c.account_id = p_account_id
      ORDER BY c.is_main DESC, lower(c.last_name), lower(COALESCE(c.first_name, '')), c.id
      OFFSET p_offset LIMIT p_limit) x;
  ELSIF p_tab = 'opportunities' THEN
    SELECT count(*) INTO n FROM public.opportunities o WHERE o.account_id = p_account_id;
    SELECT COALESCE(jsonb_agg(x.j ORDER BY x.o), '[]'::jsonb) INTO r FROM (
      SELECT row_number() OVER (ORDER BY o.target_start DESC NULLS LAST, o.created_at DESC, o.id) AS o,
             jsonb_build_object('id', o.id, 'name', o.name, 'stage', public.opportunity_stage(o.id), 'target_start', o.target_start,
                                'submission_id', o.intake_id) AS j
      FROM public.opportunities o WHERE o.account_id = p_account_id
      ORDER BY o.target_start DESC NULLS LAST, o.created_at DESC, o.id
      OFFSET p_offset LIMIT p_limit) x;
  ELSIF p_tab = 'quotes' THEN
    SELECT count(*) INTO n FROM public.quote_requests q JOIN public.opportunities o ON o.intake_id = q.session_id WHERE o.account_id = p_account_id;
    SELECT COALESCE(jsonb_agg(x.j ORDER BY x.o), '[]'::jsonb) INTO r FROM (
      SELECT row_number() OVER (ORDER BY q.sent_on DESC NULLS LAST, q.id DESC) AS o,
             jsonb_build_object('id', q.id, 'submission_id', q.session_id, 'opportunity_id', o.id, 'opportunity_name', o.name, 'peo_name', q.peo_name,
                                'status', q.status, 'sent_on', q.sent_on, 'quote_received_on', q.quote_received_on, 'quote_expires_on', q.quote_expires_on) AS j
      FROM public.quote_requests q JOIN public.opportunities o ON o.intake_id = q.session_id WHERE o.account_id = p_account_id
      ORDER BY q.sent_on DESC NULLS LAST, q.id DESC
      OFFSET p_offset LIMIT p_limit) x;
  ELSIF p_tab = 'files' THEN
    SELECT count(*) INTO n FROM public.documents d JOIN public.opportunities o ON o.intake_id = d.session_id
    WHERE o.account_id = p_account_id AND d.scan_verdict = 'clean';
    SELECT COALESCE(jsonb_agg(x.j ORDER BY x.o), '[]'::jsonb) INTO r FROM (
      SELECT row_number() OVER (ORDER BY d.created_at DESC, d.id) AS o,
             jsonb_build_object('id', d.id, 'file_name', d.file_name, 'mime_type', d.mime_type, 'size_bytes', d.size_bytes, 'category', d.category,
                                'created_at', d.created_at, 'submission_id', d.session_id, 'storage_path', d.storage_path) AS j
      FROM public.documents d JOIN public.opportunities o ON o.intake_id = d.session_id
      WHERE o.account_id = p_account_id AND d.scan_verdict = 'clean'
      ORDER BY d.created_at DESC, d.id
      OFFSET p_offset LIMIT p_limit) x;
  ELSIF p_tab IN ('activity', 'activity_calls', 'activity_notes', 'activity_tasks', 'activity_changes') THEN
    WITH entries AS (
      -- The record history of the account and of its contacts.
      SELECT 'change'::text AS type, e.at, e.entry_key,
             jsonb_build_object('type', 'change', 'entry_key', e.entry_key, 'at', e.at, 'change_id', e.change_id, 'kind', e.kind,
                                'who', public.record_history_who(e.actor_id, e.actor_is_staff),
                                'who_kind', CASE WHEN e.actor_is_staff THEN 'nevermore' WHEN e.actor_id IS NULL THEN 'system' ELSE 'member' END,
                                'field', e.field, 'from_value', e.old_value, 'to_value', e.new_value,
                                'record_table', e.table_name::text, 'record_id', e.record_key, 'record_name', e.record_name) AS j
      FROM (
        SELECT h.*, a.name AS record_name
        FROM public.accounts a
        JOIN public.record_history h ON h.firm_id = a.firm_id AND h.table_name = 'accounts' AND h.record_key = a.id::text
        WHERE a.id = p_account_id
        UNION ALL
        SELECT h.*, btrim(concat_ws(' ', c.first_name, c.last_name))
        FROM public.contacts c
        JOIN public.record_history h ON h.firm_id = c.firm_id AND h.table_name = 'contacts' AND h.record_key = c.id::text
        WHERE c.account_id = p_account_id) e
      WHERE p_tab IN ('activity', 'activity_changes')
      UNION ALL
      -- Its calls, notes and tasks (and those on its contacts, which carry the account too).
      SELECT t.kind, t.at, t.id, public.crm_activity_row(t)
      FROM public.activities t
      WHERE t.account_id = p_account_id
        AND (p_tab = 'activity' OR t.kind = CASE p_tab WHEN 'activity_calls' THEN 'call' WHEN 'activity_notes' THEN 'note' WHEN 'activity_tasks' THEN 'task' END)
    )
    SELECT (SELECT count(*) FROM entries),
           COALESCE((SELECT jsonb_agg(x.j ORDER BY x.o) FROM (
             SELECT row_number() OVER (ORDER BY e.at DESC, e.entry_key DESC) AS o, e.j
             FROM entries e ORDER BY e.at DESC, e.entry_key DESC OFFSET p_offset LIMIT p_limit) x), '[]'::jsonb)
    INTO n, r;
  ELSE
    RAISE EXCEPTION 'An account has no tab called "%"', left(COALESCE(p_tab, ''), 40) USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object('count', n, 'rows', r);
END;
$$;

-- ---------- 9. Closing a firm deletes them ----------
-- The closing's one list (20261119100000), restated with every line it had and the calls, notes and tasks before the opportunities, contacts and accounts
-- they stand on.
CREATE OR REPLACE FUNCTION public.firm_closing_plan()
RETURNS TABLE (ord integer, src text, action text, firm_column text, why text)
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT * FROM (VALUES
    -- Deleted: the firm's own working data.
    (10, 'public.firm_invitations', 'delete', 'firm_id', 'pending and past invitations to join'),
    (20, 'public.firm_organisations', 'delete', 'firm_id', 'the listed Google domains and Microsoft tenants'),
    (30, 'public.join_requests', 'delete', 'firm_id', 'requests to join'),
    (40, 'public.table_preferences', 'delete', 'firm_id', 'each person''s column choices'),
    (50, 'public.saved_views', 'delete', 'firm_id', 'saved views'),
    (55, 'public.record_history', 'delete', 'firm_id', 'the history of each record: who created it and every change to its fields; it goes with the record'),
    (60, 'public.referral_partners', 'delete', 'firm_id', 'referral partners'),
    (58, 'public.activities', 'delete', 'firm_id', 'calls, notes and tasks on the firm''s accounts and contacts; before the opportunities, contacts and accounts they stand on'),
    (61, 'public.opportunities', 'delete', 'firm_id', 'opportunities (each is one search for one account); before the contacts and accounts they stand on'),
    (62, 'public.contacts', 'delete', 'firm_id', 'contacts, the people at the firm''s accounts'),
    (63, 'public.accounts', 'delete', 'firm_id', 'accounts, the businesses the firm quotes for; the intakes on their opportunities stay with their employers (below)'),
    (70, 'public.firm_teams', 'delete', 'firm_id', 'teams (the memberships that named one are cleared first)'),
    -- Kept, and why.
    (900, 'public.firms', 'keep', NULL, 'the row stays: its address stays taken for twelve months and its record must still exist'),
    (900, 'public.firm_memberships', 'keep', NULL, 'every membership is ended, not deleted: a membership is the dated record of who belonged (it is never changed)'),
    (900, 'public.firm_member_suspensions', 'keep', NULL, 'each open one is ended; the rows are the dated record of who was suspended'),
    (900, 'public.firm_activity', 'keep', NULL, 'the firm''s own record is pruned after ninety days by its own job (D-45)'),
    (900, 'public.firm_suspensions', 'keep', NULL, 'the platform''s record of suspensions'),
    (900, 'public.firm_closures', 'keep', NULL, 'the platform''s record of this: when it was asked, by whom, when it closed, and what was deleted, without content'),
    (900, 'public.support_sessions', 'keep', NULL, 'the platform''s record of each time Nevermore looked at the firm: who, why, when it started and ended (a session ends when the firm closes)'),
    (900, 'public.advisor_field_reviews', 'keep', NULL, 'an intake''s: it stays for its employer under the intake retention rules'),
    (900, 'public.advisor_notes', 'keep', NULL, 'an intake''s'),
    (900, 'public.advisor_review_events', 'keep', NULL, 'an intake''s'),
    (900, 'public.ai_extraction_events', 'keep', NULL, 'an intake''s'),
    (900, 'public.chamber_certifications', 'keep', NULL, 'an intake''s'),
    (900, 'public.chamber_sessions', 'keep', NULL, 'the intakes: they belong to the employer who made them and are not the firm''s to delete'),
    (900, 'public.document_events', 'keep', NULL, 'an intake''s'),
    (900, 'public.documents', 'keep', NULL, 'an intake''s'),
    (900, 'public.information_requests', 'keep', NULL, 'an intake''s'),
    (900, 'public.intake_consents', 'keep', NULL, 'the employer''s own agreement'),
    (900, 'public.intake_deletions', 'keep', NULL, 'the record that an intake was deleted, kept after it'),
    (900, 'public.intake_lifecycle_events', 'keep', NULL, 'an intake''s'),
    (900, 'public.manuscript_versions', 'keep', NULL, 'an intake''s'),
    (900, 'public.profiles', 'keep', NULL, 'the employer''s own profile'),
    (900, 'public.quote_request_addresses', 'keep', NULL, 'a quote request''s: quote requests belong to an intake'),
    (900, 'public.quote_request_events', 'keep', NULL, 'a quote request''s'),
    (900, 'public.quote_request_message_attachments', 'keep', NULL, 'a quote request''s'),
    (900, 'public.quote_request_messages', 'keep', NULL, 'a quote request''s mail thread with a PEO'),
    (900, 'public.quote_request_messages WHERE quote_request_id IS NULL', 'keep', NULL, 'held mail from a PEO: held for the platform once the firm has no members, and discarded by the holding list''s own schedule'),
    (900, 'public.quote_request_notes', 'keep', NULL, 'a quote request''s'),
    (900, 'public.quote_request_thread_reads', 'keep', NULL, 'a quote request''s'),
    (900, 'public.quote_requests', 'keep', NULL, 'an intake''s'),
    (900, 'public.submission_status_history', 'keep', NULL, 'an intake''s'),
    (900, 'public.submission_workflow', 'keep', NULL, 'an intake''s'),
    (900, 'storage.objects WHERE bucket_id = ''documents''', 'keep', NULL, 'an intake''s files'),
    (900, 'storage.objects WHERE bucket_id = ''manuscripts''', 'keep', NULL, 'an intake''s files'),
    (900, 'storage.objects WHERE bucket_id = ''peo-mail''', 'keep', NULL, 'an intake''s files')
  ) AS t (ord, src, action, firm_column, why)
$$;

-- ---------- 10. Last activity takes them in (D-201) ----------
-- account_activity_times (20261119130000), restated with every branch it had (the account's making; a status change of a quote request on one of its
-- opportunities' intakes) and one more: a call, a note or a task logged or completed on the account, which is also how one on its contacts or its
-- opportunities is found, since each carries the account. A call counts at when it took place, a note or a task at when it was made, a task again when it
-- was done, and a note again at each addition. Found by the firm and the account, so the (firm_id, account_id) index reads it and the accounts table's
-- query keeps reading a few rows. Editing a call, a task or a note's text, or opening a task again, is not activity.
CREATE OR REPLACE FUNCTION public.account_activity_times(p_firm_id uuid, p_account_id uuid)
RETURNS TABLE (at timestamptz)
LANGUAGE sql
STABLE
AS $$
  SELECT a.created_at FROM public.accounts a WHERE a.firm_id = p_firm_id AND a.id = p_account_id
  UNION ALL
  SELECT e.changed_at
  -- OFFSET 0: the account's own opportunities are found first (by the account), and only then their quote requests, by intake: left to itself the database
  -- may start from every firm's quote requests and look each one's opportunity up.
  FROM (SELECT o.intake_id FROM public.opportunities o WHERE o.firm_id = p_firm_id AND o.account_id = p_account_id AND o.intake_id IS NOT NULL OFFSET 0) o
  JOIN public.quote_requests q ON q.session_id = o.intake_id
  JOIN public.quote_request_events e ON e.quote_request_id = q.id AND e.field = 'status'
  UNION ALL
  SELECT x.at FROM public.activities x WHERE x.firm_id = p_firm_id AND x.account_id = p_account_id
  UNION ALL
  SELECT x.done_at FROM public.activities x WHERE x.firm_id = p_firm_id AND x.account_id = p_account_id AND x.done_at IS NOT NULL
  UNION ALL
  SELECT (ad ->> 'at')::timestamptz FROM public.activities x CROSS JOIN LATERAL jsonb_array_elements(x.additions) AS ad
  WHERE x.firm_id = p_firm_id AND x.account_id = p_account_id AND x.kind = 'note'
$$;
