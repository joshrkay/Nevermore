-- What has no submission behind it is scoped to the firm (story CRM-P2.1c).
--
-- CRM-P2.1a scoped the tables that hang off an intake, and CRM-P2.1b the functions over them. Four kinds of data are
-- reached through no intake, so neither story could scope them by the intake's firm: a firm's referral partners, who is
-- told about a new submission, held mail (inbound mail that matched no quote request) and the broker's own mailbox. Each
-- is given its firm here, and every function over it asks the caller's membership of that firm (D-18), taking the firm
-- from the row and never from the browser. The new-mail mark (quote_request_thread_reads) is the firm's, shared by its
-- members as the thread is (CRM-H1: "opening the record clears a new-mail line for everyone who can see it"), and is
-- scoped by its quote request already (CRM-P2.1a, CRM-P2.1b), so nothing here changes it.

-- The firm a function acts for. A call may name the firm; the caller must be a current member of it. A call that names
-- none acts for the caller's only current firm, and a caller with none, or with several, is told so: the database never
-- guesses a firm for a person who belongs to more than one. Called by functions that run as their owner, never through the API.
CREATE FUNCTION public.firm_to_act_for(p_firm_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  firms uuid[];
BEGIN
  IF p_firm_id IS NOT NULL THEN
    IF NOT public.is_firm_member(p_firm_id) THEN
      RAISE EXCEPTION 'Not a member of that firm' USING ERRCODE = '42501';
    END IF;
    RETURN p_firm_id;
  END IF;
  SELECT array_agg(DISTINCT m.firm_id) INTO firms
  FROM public.firm_memberships m
  WHERE m.user_id = auth.uid() AND public.is_firm_member(m.firm_id);
  IF firms IS NULL THEN
    RAISE EXCEPTION 'Not a member of a firm' USING ERRCODE = '42501';
  END IF;
  IF cardinality(firms) > 1 THEN
    RAISE EXCEPTION 'You belong to more than one firm: say which' USING ERRCODE = '22023';
  END IF;
  RETURN firms[1];
END;
$$;
REVOKE ALL ON FUNCTION public.firm_to_act_for(uuid) FROM PUBLIC, anon, authenticated;

-- ---------- 1. Referral partners ----------
-- A partner and its link code are a firm's own. Every partner so far is Edgar Allan Advisory's (every intake was, before
-- P-1.1). A code is unique within a firm, never across firms: a firm is not told another firm has a partner under a code.
ALTER TABLE public.referral_partners ADD COLUMN firm_id uuid REFERENCES public.firms (id);
UPDATE public.referral_partners SET firm_id = public.default_firm_id();
ALTER TABLE public.referral_partners ALTER COLUMN firm_id SET NOT NULL;
ALTER TABLE public.referral_partners DROP CONSTRAINT referral_partners_pkey;
ALTER TABLE public.referral_partners ADD PRIMARY KEY (firm_id, code);

DROP POLICY referral_partners_firm_read ON public.referral_partners;
CREATE POLICY referral_partners_firm_read ON public.referral_partners
  FOR SELECT TO authenticated USING (public.is_firm_member(firm_id));

DROP FUNCTION public.advisor_add_referral_partner(text, text, text);
CREATE FUNCTION public.advisor_add_referral_partner(p_code text, p_name text, p_kind text, p_firm_id uuid DEFAULT NULL)
RETURNS public.referral_partners
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code_in text := lower(btrim(COALESCE(p_code, '')));
  problem text := public.referral_partner_input_error(p_name, p_kind);
  firm uuid;
  added public.referral_partners;
BEGIN
  PERFORM public.require_advisor();
  firm := public.firm_to_act_for(p_firm_id);
  IF NOT COALESCE(public.is_source_code(code_in), false) THEN
    RAISE EXCEPTION 'A referral code is 1 to 64 lowercase letters, digits, dots, hyphens or underscores, starting with a letter or digit.'
      USING ERRCODE = '22023';
  END IF;
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.referral_partners (firm_id, code, name, kind, created_by_email, updated_by_email)
  VALUES (firm, code_in, btrim(p_name), p_kind, auth.jwt() ->> 'email', auth.jwt() ->> 'email')
  ON CONFLICT (firm_id, code) DO NOTHING
  RETURNING * INTO added;
  IF added.code IS NULL THEN
    RAISE EXCEPTION 'The code % is already a partner''s. Choose another.', code_in USING ERRCODE = '23505', DETAIL = code_in;
  END IF;
  RETURN added;
END;
$$;
REVOKE ALL ON FUNCTION public.advisor_add_referral_partner(text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_add_referral_partner(text, text, text, uuid) TO authenticated;

DROP FUNCTION public.advisor_update_referral_partner(text, text, text);
CREATE FUNCTION public.advisor_update_referral_partner(p_code text, p_name text, p_kind text, p_firm_id uuid DEFAULT NULL)
RETURNS public.referral_partners
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  problem text := public.referral_partner_input_error(p_name, p_kind);
  firm uuid;
  changed public.referral_partners;
BEGIN
  PERFORM public.require_advisor();
  firm := public.firm_to_act_for(p_firm_id);
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  UPDATE public.referral_partners
  SET name = btrim(p_name), kind = p_kind, updated_at = now(), updated_by_email = auth.jwt() ->> 'email'
  WHERE firm_id = firm AND code = lower(btrim(COALESCE(p_code, '')))
  RETURNING * INTO changed;
  IF changed.code IS NULL THEN
    RAISE EXCEPTION 'No partner has that code' USING ERRCODE = 'PT404';
  END IF;
  RETURN changed;
END;
$$;
REVOKE ALL ON FUNCTION public.advisor_update_referral_partner(text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_update_referral_partner(text, text, text, uuid) TO authenticated;

-- The funnel by source names the partner behind a code: the firm's own partner, never another firm's under the same code.
CREATE OR REPLACE FUNCTION public.advisor_intake_sources(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS TABLE(referral_code text, partner_name text, utm_source text, utm_medium text, utm_campaign text, started bigint, answered bigint, document_uploaded bigint, census_provided bigint, ready_to_certify bigint, email_verified bigint, certified bigint, manuscript_downloaded bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
BEGIN
  PERFORM public.require_advisor();
  IF p_from IS NULL OR p_to IS NULL OR p_from >= p_to THEN
    RAISE EXCEPTION 'The period must start before it ends' USING ERRCODE = '22023';
  END IF;
  IF p_to - p_from > interval '366 days' THEN
    RAISE EXCEPTION 'The funnel covers at most a year at once' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT m.referral_code, p.name, m.utm_source, m.utm_medium, m.utm_campaign,
           count(*) FILTER (WHERE m.milestone = 'started'),
           count(*) FILTER (WHERE m.milestone = 'answered'),
           count(*) FILTER (WHERE m.milestone = 'document_uploaded'),
           count(*) FILTER (WHERE m.milestone = 'census_provided'),
           count(*) FILTER (WHERE m.milestone = 'ready_to_certify'),
           count(*) FILTER (WHERE m.milestone = 'email_verified'),
           count(*) FILTER (WHERE m.milestone = 'certified'),
           count(*) FILTER (WHERE m.milestone = 'manuscript_downloaded')
    FROM public.intake_milestones m
    LEFT JOIN public.referral_partners p ON p.code = m.referral_code AND p.firm_id = m.firm_id
    WHERE m.started_at >= p_from AND m.started_at < p_to AND public.is_firm_member(m.firm_id)
    GROUP BY m.referral_code, p.name, m.utm_source, m.utm_medium, m.utm_campaign
    ORDER BY count(*) FILTER (WHERE m.milestone = 'started') DESC,
             m.referral_code NULLS LAST, m.utm_source NULLS LAST, m.utm_medium NULLS LAST, m.utm_campaign NULLS LAST
    LIMIT 200;
END;
$function$;

-- ---------- 2. Held mail ----------
-- Inbound mail that matched no live quote request is held. Held mail is addressed to a firm when its address once belonged to
-- one (a revoked reply address) or when one of the firm's own members moved it off a thread; mail to an address nobody ever
-- held belongs to no firm, and so is read by no one (a platform admin sees only its File ID and PEO, D-16, below).
-- Every message carries its firm. A message on a quote request has the firm of that request's intake, whatever the writer says;
-- held mail keeps the firm it had, and mail held for a revoked address takes the address's.
ALTER TABLE public.quote_request_messages ADD COLUMN firm_id uuid REFERENCES public.firms (id);

UPDATE public.quote_request_messages m SET firm_id = s.firm_id
FROM public.chamber_sessions s WHERE s.id = m.session_id;
UPDATE public.quote_request_messages m SET firm_id = s.firm_id
FROM public.quote_requests q JOIN public.chamber_sessions s ON s.id = q.session_id
WHERE m.quote_request_id IS NULL AND m.moved_from_quote_request_id = q.id;
UPDATE public.quote_request_messages m SET firm_id = s.firm_id
FROM public.quote_request_addresses a JOIN public.chamber_sessions s ON s.id = a.session_id
WHERE m.quote_request_id IS NULL AND m.firm_id IS NULL AND m.held_reason = 'revoked_address' AND a.local_part = lower(m.address_local_part);

ALTER TABLE public.quote_request_messages ADD CONSTRAINT quote_request_messages_firm_check
  CHECK (quote_request_id IS NULL OR firm_id IS NOT NULL);
CREATE INDEX quote_request_messages_by_firm_held ON public.quote_request_messages (firm_id) WHERE quote_request_id IS NULL;

CREATE FUNCTION public.stamp_message_firm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  by_address uuid;
BEGIN
  IF NEW.quote_request_id IS NOT NULL THEN
    SELECT s.firm_id INTO NEW.firm_id
    FROM public.quote_requests q JOIN public.chamber_sessions s ON s.id = q.session_id
    WHERE q.id = NEW.quote_request_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Held mail keeps the firm it had, including a message moved off a thread.
    NEW.firm_id := OLD.firm_id;
  ELSE
    -- New held mail: the firm of the revoked address it was sent to. A writer that names a firm (only the service role writes
    -- here) is believed when no address says otherwise; the API roles can't insert.
    IF NEW.held_reason = 'revoked_address' THEN
      SELECT s.firm_id INTO by_address
      FROM public.quote_request_addresses a JOIN public.chamber_sessions s ON s.id = a.session_id
      WHERE a.local_part = lower(NEW.address_local_part);
      NEW.firm_id := COALESCE(by_address, NEW.firm_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.stamp_message_firm() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER quote_request_messages_stamp_firm
  BEFORE INSERT OR UPDATE ON public.quote_request_messages
  FOR EACH ROW EXECUTE FUNCTION public.stamp_message_firm();

-- May the caller read a message of PEO mail? One on a quote request: that request's firm's members. Held mail: the members of the
-- firm it is addressed to; held mail addressed to no firm is read by nobody (a platform admin gets admin_held_mail() instead).
DROP POLICY quote_request_messages_firm_read ON public.quote_request_messages;
DROP POLICY quote_request_message_attachments_firm_read ON public.quote_request_message_attachments;
DROP FUNCTION public.can_read_peo_mail(bigint);
CREATE FUNCTION public.can_read_peo_mail(p_quote_request_id bigint, p_firm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN p_quote_request_id IS NULL THEN COALESCE(public.is_firm_member(p_firm_id), false)
              ELSE public.quote_request_in_my_firm(p_quote_request_id) END
$$;
REVOKE ALL ON FUNCTION public.can_read_peo_mail(bigint, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_peo_mail(bigint, uuid) TO authenticated;

CREATE POLICY quote_request_messages_firm_read ON public.quote_request_messages
  FOR SELECT TO authenticated USING (public.can_read_peo_mail(quote_request_id, firm_id));
CREATE POLICY quote_request_message_attachments_firm_read ON public.quote_request_message_attachments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quote_request_messages m
    WHERE m.id = quote_request_message_attachments.message_id AND public.can_read_peo_mail(m.quote_request_id, m.firm_id)
  ));

-- A held message's files sit under held/<message>/: the firm's members read them as they read the message.
DROP POLICY "Firm members can read PEO mail attachments" ON storage.objects;
CREATE POLICY "Firm members can read PEO mail attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'peo-mail'
    AND EXISTS (
      SELECT 1
      FROM public.quote_request_message_attachments a
      JOIN public.quote_request_messages m ON m.id = a.message_id
      WHERE a.storage_bucket = 'peo-mail' AND a.storage_path = objects.name AND a.status = 'stored'
        AND public.can_read_peo_mail(m.quote_request_id, m.firm_id)
    )
  );

-- Moving a message off a thread asks the actor's current membership of the message's firm (an advisor role alone, or a platform
-- admin's, opens no firm's mail: D-16). Assigning held mail is a platform admin's, who belongs to no firm and sees only File IDs
-- and PEOs (admin_held_mail), so mail addressed to a firm may go only to that firm's own quote request: another firm's is
-- answered as a quote request that isn't there. Mail addressed to no firm may go to any.
CREATE OR REPLACE FUNCTION public.plan_mail_move(p_message_id bigint, p_target bigint, p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  msg public.quote_request_messages;
  target public.quote_requests;
  target_firm uuid;
  prefix text;
BEGIN
  SELECT * INTO msg FROM public.quote_request_messages WHERE id = p_message_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found' USING ERRCODE = 'PT404';
  END IF;
  IF p_target IS NULL THEN
    IF NOT public.held_mail_actor_has(p_actor, 'advisor') OR NOT EXISTS (
      SELECT 1 FROM public.firm_memberships f
      WHERE f.user_id = p_actor AND f.firm_id = msg.firm_id AND public.membership_is_current(f.valid_from, f.valid_until)
    ) THEN
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
    SELECT s.firm_id INTO target_firm FROM public.chamber_sessions s WHERE s.id = target.session_id;
    IF NOT FOUND OR (msg.firm_id IS NOT NULL AND msg.firm_id IS DISTINCT FROM target_firm) THEN
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

CREATE OR REPLACE FUNCTION public.apply_mail_move(p_message_id bigint, p_target bigint, p_actor uuid, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  msg public.quote_request_messages;
  target public.quote_requests;
  target_firm uuid;
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
    IF NOT public.held_mail_actor_has(p_actor, 'advisor') OR NOT EXISTS (
      SELECT 1 FROM public.firm_memberships f
      WHERE f.user_id = p_actor AND f.firm_id = msg.firm_id AND public.membership_is_current(f.valid_from, f.valid_until)
    ) THEN
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
    SELECT s.firm_id INTO target_firm FROM public.chamber_sessions s WHERE s.id = target.session_id;
    IF NOT FOUND OR (msg.firm_id IS NOT NULL AND msg.firm_id IS DISTINCT FROM target_firm) THEN
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

-- What a platform admin, who is a member of no firm, sees of the holding list (D-16): which message, why it is held, since when, and
-- the File ID and PEO of the quote request its address belonged to (null when it belonged to none). Never a sender, subject,
-- text, address or file name.
CREATE FUNCTION public.admin_held_mail()
RETURNS TABLE (message_id bigint, held_reason text, held_at timestamptz, file_id text, peo_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT m.id, m.held_reason, m.held_at, s.file_id, q.peo_name
    FROM public.quote_request_messages m
    LEFT JOIN public.quote_request_addresses a ON m.held_reason = 'revoked_address' AND a.local_part = lower(m.address_local_part)
    LEFT JOIN public.quote_requests q ON q.id = COALESCE(m.moved_from_quote_request_id, a.quote_request_id)
    LEFT JOIN public.chamber_sessions s ON s.id = q.session_id
    WHERE m.quote_request_id IS NULL
    ORDER BY m.held_at, m.id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_held_mail() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_held_mail() TO authenticated;

-- The quote requests a platform admin may assign held mail to, by File ID and PEO alone (D-16).
CREATE FUNCTION public.admin_assignable_quote_requests()
RETURNS TABLE (quote_request_id bigint, file_id text, peo_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT q.id, s.file_id, q.peo_name
    FROM public.quote_requests q JOIN public.chamber_sessions s ON s.id = q.session_id
    WHERE q.status <> 'closed'
    ORDER BY q.id DESC
    LIMIT 1000;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_assignable_quote_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assignable_quote_requests() TO authenticated;
