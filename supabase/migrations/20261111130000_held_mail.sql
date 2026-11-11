-- The holding list (joshrkay/Nevermore#92, story M-3.3; docs/adr/0004-peo-mail-is-received-before-the-product-sends.md).
--
-- Mail that matches no live quote request is already held (20261111110000_quote_request_messages.sql). This adds
-- what happens to it:
--
-- * An advisor can move a message off a thread to the holding list (reason `moved_by_advisor`, with who moved it,
--   from which quote request and an optional note). An admin assigns a held message to a quote request or discards
--   it. A message nobody deals with is deleted 30 days after it was held. Its sender gets no reply.
-- * One ops alert (kind `held_mail`) is raised when the list stops being empty, not one per message: the event is
--   recorded only by the message that finds the list empty.
-- * A message's files follow it: a held message's files sit under `held/<message>/`, a message on a quote request's
--   under `<intake>/<message>/`. Moving a message swaps that first part of each stored file's path. The held-mail
--   function moves the files in storage between the plan and the apply below, and removes them before the
--   database drops the rows of a discarded or expired message, so a row never outlives its file in the other
--   direction either.
-- * Every function here is for the service role only. The held-mail function checks who is asking (an advisor to
--   move off, an admin to assign or discard, the schedule to purge) and passes the person's id; each function
--   checks the role again, so nothing relies on the caller alone.
-- * An assignment and a move off are logged on the quote request they touch (quote_request_events, append-only),
--   with the message's id and nothing from its content. A discard is not logged beyond the rows going.
--
-- Deploy this migration before the held-mail function.

SET lock_timeout = '5s';

-- ---------- What a held message remembers ----------
ALTER TABLE public.quote_request_messages
  ADD COLUMN held_at timestamptz,
  ADD COLUMN moved_by uuid,
  ADD COLUMN moved_by_email text,
  ADD COLUMN moved_from_quote_request_id bigint,
  ADD COLUMN moved_note text;

UPDATE public.quote_request_messages SET held_at = recorded_at WHERE quote_request_id IS NULL;

ALTER TABLE public.quote_request_messages DROP CONSTRAINT quote_request_messages_shape_check;
ALTER TABLE public.quote_request_messages ADD CONSTRAINT quote_request_messages_shape_check CHECK (
  direction IN ('received', 'sent_by_hand')
  AND (quote_request_id IS NULL) = (held_reason IS NOT NULL)
  AND (quote_request_id IS NULL) = (session_id IS NULL)
  AND (quote_request_id IS NULL) = (held_at IS NOT NULL)
  AND (held_reason IS NULL OR held_reason IN ('revoked_address', 'unknown_address', 'ambiguous_address', 'moved_by_advisor'))
  AND (moved_note IS NULL OR char_length(moved_note) <= 500)
  AND (held_reason = 'moved_by_advisor' OR (moved_by IS NULL AND moved_from_quote_request_id IS NULL AND moved_note IS NULL))
);

CREATE INDEX quote_request_messages_held ON public.quote_request_messages (held_at) WHERE quote_request_id IS NULL;

-- A message that joins the holding list is stamped when it did, however it got there.
CREATE FUNCTION public.stamp_held_mail()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.quote_request_id IS NULL AND NEW.held_at IS NULL THEN
    NEW.held_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER quote_request_messages_stamp_held
  BEFORE INSERT OR UPDATE ON public.quote_request_messages
  FOR EACH ROW EXECUTE FUNCTION public.stamp_held_mail();

-- ---------- The alert: the list stops being empty ----------
ALTER TABLE public.ops_events DROP CONSTRAINT IF EXISTS ops_events_kind_check;
ALTER TABLE public.ops_events ADD CONSTRAINT ops_events_kind_check CHECK (kind IN (
  'app_error', 'upload_failed', 'ai_failed', 'auth_denied', 'deletion_failed', 'voice_failed', 'malware_detected', 'scan_failed',
  'held_mail'
));

-- As in 20261104130000_document_scanning.sql, plus held mail: one event is enough.
CREATE OR REPLACE FUNCTION public.ops_alert_rules()
RETURNS TABLE (kind text, window_minutes integer, threshold integer, cooldown_minutes integer)
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  VALUES
    -- sync:begin ops_alert_rules
    ('app_error'::text, 15, 10, 60),
    ('upload_failed', 15, 5, 60),
    ('ai_failed', 15, 5, 60),
    ('auth_denied', 15, 20, 60),
    ('deletion_failed', 60, 1, 60),
    ('voice_failed', 15, 5, 60),
    ('malware_detected', 60, 1, 60),
    ('scan_failed', 60, 1, 60),
    ('held_mail', 60, 1, 60)
    -- sync:end ops_alert_rules
$$;

REVOKE ALL ON FUNCTION public.ops_alert_rules() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ops_alert_rules() TO authenticated, service_role;

-- A message that finds the holding list empty records the one event; one that joins a list already holding mail
-- records nothing. The lock makes two first messages at once record one (and the alert's cooldown would merge them).
CREATE FUNCTION public.note_held_mail()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('held_mail_list'));
  IF NOT EXISTS (SELECT 1 FROM public.quote_request_messages m WHERE m.quote_request_id IS NULL AND m.id <> NEW.id) THEN
    INSERT INTO public.ops_events (kind, source, code) VALUES ('held_mail', 'receive-mail', 'list_not_empty');
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER quote_request_messages_note_held_insert
  AFTER INSERT ON public.quote_request_messages
  FOR EACH ROW WHEN (NEW.quote_request_id IS NULL) EXECUTE FUNCTION public.note_held_mail();
CREATE TRIGGER quote_request_messages_note_held_update
  AFTER UPDATE ON public.quote_request_messages
  FOR EACH ROW WHEN (NEW.quote_request_id IS NULL AND OLD.quote_request_id IS NOT NULL) EXECUTE FUNCTION public.note_held_mail();

-- ---------- Who is asking ----------
CREATE FUNCTION public.held_mail_actor_has(p_actor uuid, p_role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = p_actor AND (r.role::text = p_role OR (p_role = 'advisor' AND r.role::text = 'admin'))
  );
$$;

-- Where a stored file goes when its message moves: the first part of its path (`held`, or the intake's id) swapped.
CREATE FUNCTION public.held_mail_path(p_path text, p_prefix text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$
  SELECT p_prefix || substr(p_path, position('/' IN p_path));
$$;

-- ---------- Moving a message: plan, then apply ----------
-- p_target is the quote request to assign a held message to, or NULL to move a message off its thread.
-- Returns the stored files to move, as {attachment_id, from, to}. Changes nothing.
CREATE FUNCTION public.plan_mail_move(p_message_id bigint, p_target bigint, p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  msg public.quote_request_messages;
  target public.quote_requests;
  prefix text;
BEGIN
  SELECT * INTO msg FROM public.quote_request_messages WHERE id = p_message_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found' USING ERRCODE = 'PT404';
  END IF;
  IF p_target IS NULL THEN
    IF NOT public.held_mail_actor_has(p_actor, 'advisor') THEN
      RAISE EXCEPTION 'Advisor access required' USING ERRCODE = '42501';
    END IF;
    IF msg.quote_request_id IS NULL THEN
      RAISE EXCEPTION 'That message is already on the holding list' USING ERRCODE = '55000';
    END IF;
    prefix := 'held';
  ELSE
    IF NOT public.held_mail_actor_has(p_actor, 'admin') THEN
      RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
    END IF;
    IF msg.quote_request_id IS NOT NULL THEN
      RAISE EXCEPTION 'Only a held message can be assigned' USING ERRCODE = '55000';
    END IF;
    SELECT * INTO target FROM public.quote_requests WHERE id = p_target;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Quote request not found' USING ERRCODE = 'PT404';
    END IF;
    prefix := target.session_id::text;
  END IF;
  RETURN jsonb_build_object('moves', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('attachment_id', a.id, 'from', a.storage_path, 'to', public.held_mail_path(a.storage_path, prefix)) ORDER BY a.id)
    FROM public.quote_request_message_attachments a
    WHERE a.message_id = msg.id AND a.status = 'stored' AND a.storage_path IS NOT NULL
      AND split_part(a.storage_path, '/', 1) <> prefix
  ), '[]'::jsonb));
END;
$$;

-- Moves the message once its files are in place. Locks the message, so two admins assigning it at once get one
-- winner; the other is refused and the function puts its files back.
CREATE FUNCTION public.apply_mail_move(p_message_id bigint, p_target bigint, p_actor uuid, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  msg public.quote_request_messages;
  target public.quote_requests;
  actor_email text;
  prefix text;
  fresh boolean := false;
  clean_note text := NULLIF(left(btrim(COALESCE(p_note, '')), 500), '');
BEGIN
  SELECT * INTO msg FROM public.quote_request_messages WHERE id = p_message_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found' USING ERRCODE = 'PT404';
  END IF;
  SELECT u.email INTO actor_email FROM auth.users u WHERE u.id = p_actor;

  IF p_target IS NULL THEN
    IF NOT public.held_mail_actor_has(p_actor, 'advisor') THEN
      RAISE EXCEPTION 'Advisor access required' USING ERRCODE = '42501';
    END IF;
    IF msg.quote_request_id IS NULL THEN
      RAISE EXCEPTION 'That message is already on the holding list' USING ERRCODE = '55000';
    END IF;
    prefix := 'held';
    UPDATE public.quote_request_messages
    SET quote_request_id = NULL, session_id = NULL, held_reason = 'moved_by_advisor', held_at = now(),
        moved_by = p_actor, moved_by_email = actor_email, moved_from_quote_request_id = msg.quote_request_id, moved_note = clean_note,
        new_sender = false
    WHERE id = msg.id;
    INSERT INTO public.quote_request_events (quote_request_id, session_id, field, new_value, changed_by, changed_by_email)
    VALUES (msg.quote_request_id, msg.session_id, 'mail_moved_off', msg.id::text, p_actor, actor_email);
  ELSE
    IF NOT public.held_mail_actor_has(p_actor, 'admin') THEN
      RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
    END IF;
    IF msg.quote_request_id IS NOT NULL THEN
      RAISE EXCEPTION 'Only a held message can be assigned' USING ERRCODE = '55000';
    END IF;
    SELECT * INTO target FROM public.quote_requests WHERE id = p_target;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Quote request not found' USING ERRCODE = 'PT404';
    END IF;
    prefix := target.session_id::text;
    IF msg.direction = 'received' AND NOT msg.is_automatic THEN
      fresh := NOT EXISTS (
        SELECT 1 FROM public.quote_request_messages m
        WHERE m.quote_request_id = target.id
          AND (m.from_address = msg.from_address OR msg.from_address = ANY (m.to_addresses) OR msg.from_address = ANY (m.cc_addresses))
      );
    END IF;
    -- It joins the thread now, so it counts as mail nobody has opened yet (recorded_at is what "new" is measured by).
    UPDATE public.quote_request_messages
    SET quote_request_id = target.id, session_id = target.session_id, held_reason = NULL, held_at = NULL,
        moved_by = NULL, moved_by_email = NULL, moved_from_quote_request_id = NULL, moved_note = NULL,
        new_sender = fresh, recorded_at = now()
    WHERE id = msg.id;
    INSERT INTO public.quote_request_events (quote_request_id, session_id, field, new_value, changed_by, changed_by_email)
    VALUES (target.id, target.session_id, 'mail_assigned', msg.id::text, p_actor, actor_email);
  END IF;

  UPDATE public.quote_request_message_attachments a
  SET storage_path = public.held_mail_path(a.storage_path, prefix), updated_at = now()
  WHERE a.message_id = msg.id AND a.status = 'stored' AND a.storage_path IS NOT NULL;

  RETURN jsonb_build_object('message_id', msg.id, 'quote_request_id', p_target, 'held', p_target IS NULL);
END;
$$;

-- ---------- Discarding and expiring ----------
-- The stored files of a held message to remove before its rows go. An admin may discard any held message; with no
-- actor, only one held for the full period (the schedule), and never one on a quote request.
CREATE FUNCTION public.plan_held_mail_discard(p_message_id bigint, p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  msg public.quote_request_messages;
BEGIN
  SELECT * INTO msg FROM public.quote_request_messages WHERE id = p_message_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found' USING ERRCODE = 'PT404';
  END IF;
  IF msg.quote_request_id IS NOT NULL THEN
    RAISE EXCEPTION 'Only a held message can be discarded' USING ERRCODE = '55000';
  END IF;
  IF p_actor IS NULL THEN
    IF msg.held_at > now() - public.held_mail_retention() THEN
      RAISE EXCEPTION 'That message has not been held long enough to expire' USING ERRCODE = '55000';
    END IF;
  ELSIF NOT public.held_mail_actor_has(p_actor, 'admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object('paths', COALESCE((
    SELECT jsonb_agg(a.storage_path ORDER BY a.id)
    FROM public.quote_request_message_attachments a
    WHERE a.message_id = msg.id AND a.storage_path IS NOT NULL
  ), '[]'::jsonb));
END;
$$;

-- Deletes the message and its attachments' rows. Refuses while any stored file is still listed in storage, so a
-- file is never left behind without its row.
CREATE FUNCTION public.finish_held_mail_discard(p_message_id bigint, p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  msg public.quote_request_messages;
  n integer;
BEGIN
  SELECT * INTO msg FROM public.quote_request_messages WHERE id = p_message_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('message_id', p_message_id, 'deleted', false);
  END IF;
  IF msg.quote_request_id IS NOT NULL THEN
    RAISE EXCEPTION 'Only a held message can be discarded' USING ERRCODE = '55000';
  END IF;
  IF p_actor IS NULL THEN
    IF msg.held_at > now() - public.held_mail_retention() THEN
      RAISE EXCEPTION 'That message has not been held long enough to expire' USING ERRCODE = '55000';
    END IF;
  ELSIF NOT public.held_mail_actor_has(p_actor, 'admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  SELECT count(*)::integer INTO n FROM storage.objects o
  WHERE o.bucket_id = 'peo-mail' AND o.name IN (
    SELECT a.storage_path FROM public.quote_request_message_attachments a WHERE a.message_id = msg.id AND a.storage_path IS NOT NULL);
  IF n > 0 THEN
    RAISE EXCEPTION 'The message still has % stored file(s); remove them first', n USING ERRCODE = 'EA006', DETAIL = n::text;
  END IF;
  DELETE FROM public.quote_request_message_attachments WHERE message_id = msg.id;
  DELETE FROM public.quote_request_messages WHERE id = msg.id;
  RETURN jsonb_build_object('message_id', msg.id, 'deleted', true);
END;
$$;

-- How long a message waits on the list. One place to change it.
CREATE FUNCTION public.held_mail_retention()
RETURNS interval LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT
    -- sync:begin held_mail_retention
    interval '30 days'
    -- sync:end held_mail_retention
$$;

-- The held messages that have waited the full period, oldest first, for the schedule to discard.
CREATE FUNCTION public.held_mail_due(p_limit integer DEFAULT 20)
RETURNS TABLE (message_id bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT m.id FROM public.quote_request_messages m
  WHERE m.quote_request_id IS NULL AND m.held_at <= now() - public.held_mail_retention()
  ORDER BY m.held_at, m.id
  LIMIT GREATEST(LEAST(COALESCE(p_limit, 20), 100), 1);
$$;

-- ---------- Who may call what ----------
REVOKE ALL ON FUNCTION public.held_mail_actor_has(uuid, text), public.held_mail_path(text, text), public.held_mail_retention(),
  public.plan_mail_move(bigint, bigint, uuid), public.apply_mail_move(bigint, bigint, uuid, text),
  public.plan_held_mail_discard(bigint, uuid), public.finish_held_mail_discard(bigint, uuid), public.held_mail_due(integer),
  public.stamp_held_mail(), public.note_held_mail()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.plan_mail_move(bigint, bigint, uuid), public.apply_mail_move(bigint, bigint, uuid, text),
  public.plan_held_mail_discard(bigint, uuid), public.finish_held_mail_discard(bigint, uuid), public.held_mail_due(integer)
  TO service_role;

-- ---------- Schedule ----------
-- held-mail purges once a day (03:23; the job is named for the function, as the setup script names them), from the database, the same way ops-monitor is scheduled
-- (20261104091000_ops_monitoring.sql): Vault holds the project URL and service-role key, the job does nothing
-- until both exist, an existing job of the same name is left alone, and a database without pg_cron or pg_net gets
-- a notice, never a failed migration.
DO $$
BEGIN
  IF to_regprocedure('cron.schedule(text,text,text)') IS NULL THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'held mail: pg_cron is not available (%); schedule held-mail another way (docs/RUNBOOK.md)', SQLERRM;
      RETURN;
    END;
  END IF;

  IF to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') IS NULL THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'held mail: pg_net is not available (%); schedule held-mail another way (docs/RUNBOOK.md)', SQLERRM;
      RETURN;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'held-mail') THEN
    RAISE NOTICE 'held mail: a held-mail job already exists; leaving it as it is';
    RETURN;
  END IF;

  PERFORM cron.schedule('held-mail', '23 3 * * *', $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/held-mail',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
        'Content-Type', 'application/json'),
      body := '{"action":"purge"}'::jsonb
    )
    where exists (select 1 from vault.decrypted_secrets where name = 'project_url')
      and exists (select 1 from vault.decrypted_secrets where name = 'service_role_key');
  $job$);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'held mail: could not schedule held-mail (%); schedule it another way (docs/RUNBOOK.md)', SQLERRM;
END $$;
