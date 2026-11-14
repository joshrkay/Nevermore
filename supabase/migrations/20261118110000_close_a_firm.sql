-- Close a firm (story CRM-P1.7; docs/BROKER_CRM_BUILD.md D-5, D-16, D-18, D-24, D-27, D-29, D-31, D-33, D-40, D-45, D-104, D-106).
--
-- An owner asks to close the firm. For the next 30 days the firm is READ-ONLY: every member still signs in and reads, and nothing of the
-- firm's can be changed, added, sent or deleted by a member, at the database. Any owner can withdraw the request until the 30 days
-- end, and the firm is then as it was. A daily job closes the firms whose 30 days have passed: the firm's own working data is deleted,
-- every membership ends, and the address stays taken for twelve months. Intakes are not deleted: they belong to the prospect who made
-- them and stay for them under the retention rules of 20261104092000_data_retention_and_deletion.sql; nobody reads them through the
-- firm any more, because nobody belongs to it.
--
-- It is the sibling of suspending a firm (20261116230000) and follows its shape: a state on the firm that a helper answers
-- (firm_is_read_only, as firm_is_suspended), a platform-side record closed to the API, entries in the firm's own record, and a page.
-- The difference is how it bites. A suspended firm's members are refused everything, so the one membership question (firm_role)
-- answers for it. A closing firm's members still read, so firm_role is left alone and every function and policy that WRITES a firm's
-- data asks assert_firm_writable() first. The list of those is in the section "Every write path" below and is proved, one by one, in
-- supabase/tests/close_a_firm.sql.

-- 0. The firm's record: two more kinds, for asking and for withdrawing. The list is the one 20261118100000_join_by_organisation.sql
-- states, with these added. src/data/firmActivity.ts (ENTRY_KINDS) is kept in step by src/data/schemaSync.test.ts, which reads the
-- list of the latest migration that holds it. Closing itself writes no entry: by then no owner is left to read it, and the platform's
-- record below says what happened.
ALTER TABLE public.firm_activity DROP CONSTRAINT IF EXISTS firm_activity_kind_check;
ALTER TABLE public.firm_activity ADD CONSTRAINT firm_activity_kind_check CHECK (kind IN (
    -- sync:begin firm_activity_kinds
    'sign_in', 'submission_viewed', 'document_downloaded', 'packet_downloaded', 'send_recorded',
    'member_added', 'member_ended', 'owner_added', 'owner_ended',
    'export_made', 'invitation_sent', 'member_removed', 'support_access',
    'firm_signed_up', 'firm_approved', 'firm_refused', 'invitation_withdrawn',
    'member_suspended', 'member_restored',
    'firm_suspended', 'firm_restored',
    'member_left',
    'organisation_listed', 'organisation_removed', 'join_asked', 'join_declined',
    'closure_asked', 'closure_withdrawn'
    -- sync:end firm_activity_kinds
  ));

-- 1. The period of a request, and how long a closed firm's address is held. Written once.
CREATE FUNCTION public.firm_closing_period() RETURNS interval LANGUAGE sql IMMUTABLE AS $$ SELECT interval '30 days' $$;
CREATE FUNCTION public.firm_address_hold() RETURNS interval LANGUAGE sql IMMUTABLE AS $$ SELECT interval '12 months' $$;
REVOKE ALL ON FUNCTION public.firm_closing_period() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.firm_address_hold() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.firm_closing_period() TO service_role;
GRANT EXECUTE ON FUNCTION public.firm_address_hold() TO service_role;

-- 2. The platform's record: one row for each request to close a firm. When it was asked and by whom; when it was withdrawn, or when the
-- firm closed with a count per table of what was deleted. No names, no row content (the counts are numbers under table names). Closed
-- to the API, so a firm never reads it (the functions below are the only way in), and nothing deletes it. At most one request of a firm
-- is open at a time, and a firm closes once (D-29): the partial unique indexes are the rule, and the functions only give their message.
CREATE TABLE public.firm_closures (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  asked_at timestamptz NOT NULL DEFAULT now(),
  asked_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  closes_at timestamptz NOT NULL,
  withdrawn_at timestamptz,
  withdrawn_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  closed_at timestamptz,
  -- The address the firm held, written when it closes: the firm gives the address up twelve months later (sign_up_firm), and this
  -- keeps the platform's page honest about which firm it was.
  address text,
  deleted_counts jsonb,
  CONSTRAINT firm_closures_closes_after_ask CHECK (closes_at > asked_at),
  CONSTRAINT firm_closures_one_ending CHECK (withdrawn_at IS NULL OR closed_at IS NULL),
  CONSTRAINT firm_closures_counts_with_closing CHECK ((closed_at IS NULL) = (deleted_counts IS NULL)),
  CONSTRAINT firm_closures_counts_are_numbers CHECK (deleted_counts IS NULL OR jsonb_typeof(deleted_counts) = 'object')
);

CREATE UNIQUE INDEX firm_closures_one_open ON public.firm_closures (firm_id) WHERE withdrawn_at IS NULL AND closed_at IS NULL;
CREATE UNIQUE INDEX firm_closures_one_closing ON public.firm_closures (firm_id) WHERE closed_at IS NOT NULL;

ALTER TABLE public.firm_closures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.firm_closures FROM PUBLIC, anon, authenticated;

-- 3. The questions everything asks. A firm is read-only from the day its owner asks until the request is withdrawn; once closed it
-- stays so. A firm is closed once the daily job has run for it. Internal: no API role calls these.
CREATE FUNCTION public.firm_is_read_only(p_firm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.firm_closures c WHERE c.firm_id = p_firm_id AND c.withdrawn_at IS NULL)
$$;

CREATE FUNCTION public.firm_is_closed(p_firm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.firm_closures c WHERE c.firm_id = p_firm_id AND c.closed_at IS NOT NULL)
$$;

REVOKE ALL ON FUNCTION public.firm_is_read_only(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.firm_is_closed(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.firm_is_read_only(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.firm_is_closed(uuid) TO service_role;

-- The one refusal. Every function that writes a firm's data calls it with the firm it is about. It refuses a current member of a firm
-- that is closing, with a plain message. For everyone else it does nothing: a person who is no member gets the refusal the function
-- already gives them, so nobody learns from this that a firm is closing, and the service role (no caller) is never stopped by it.
-- Not for what a closing firm's members still do: read, leave (leave_firm), withdraw (withdraw_firm_closure), sign in and have it
-- written to the firm's record.
CREATE FUNCTION public.assert_firm_writable(p_firm_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_firm_id IS NOT NULL AND public.firm_is_read_only(p_firm_id) AND public.admin_belongs_to_firm(p_firm_id) THEN
    RAISE EXCEPTION 'This firm is closing and can''t be changed' USING ERRCODE = 'PT423';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_firm_writable(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_firm_writable(uuid) TO service_role;

-- 4. Every write path. The functions below are each the latest definition of the function (searched across every migration, D-104)
-- with one line added at the top, or where the firm is first known: PERFORM public.assert_firm_writable(<the firm it is about>).
--   referral partners        advisor_add_referral_partner, advisor_update_referral_partner
--   invitations              invite_member, resend_invitation, cancel_invitation; accept_invitation refuses a new member
--   organisations, requests  add_firm_organisation, remove_firm_organisation, approve_join_request, decline_join_request;
--                            ask_to_join_firm answers "none" as for a suspended firm
--   members                  remove_member, suspend_member, lift_member_suspension
--   views, column choices    save_view, change_saved_view, rename_saved_view, delete_saved_view, share_saved_view,
--                            unshare_saved_view, set_my_table_columns
--   submissions              review_submission_field, set_submission_status, set_submission_needs_action, advisor_request_information,
--                            advisor_record_quote_send
--   quote requests           advisor_update_quote_request, advisor_add_quote_request_note (and so advisor_note_underwriter_question,
--                            which calls it), advisor_correct_quote_request_note, advisor_reissue_quote_request_address,
--                            advisor_requeue_outbox_event (retrying a send is a send)
--   notes on an intake       the table policy "Firm members can add notes as themselves", below
--   held mail                plan_mail_move, apply_mail_move
--   mailbox                  person_is_member_of_a_firm_in_good_standing, which mailbox_store and mailbox_secret ask: no mailbox is
--                            connected, and nothing is sent as a member, whose only firms are closing
-- Deliberately still allowed while a firm is closing, because they are not a change to the firm's data or are the way out of
-- the state: reading; leave_firm; withdraw_firm_closure; sign-in and the firm's record (firm_activity_append); a member opening a
-- quote request's thread (advisor_open_quote_request_thread: it only marks the thread read for the firm, which is what reading is);
-- inbound PEO mail, which is received and held or threaded as for a suspended firm.
-- Not a member's writes, so not guarded: the platform admin's (deciding on a firm, held mail assigned to a firm that is not closing,
-- suspending), the employer's own intake (chamber_sessions, documents and the prospect's functions), and the service role's.
--
CREATE OR REPLACE FUNCTION public.add_firm_organisation(p_firm_id uuid, p_provider text, p_org_id text, p_label text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  org text := lower(btrim(COALESCE(p_org_id, '')));
  lbl text := btrim(COALESCE(p_label, ''));
  row public.firm_organisations;
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable(p_firm_id);
  IF public.firm_role(p_firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can list organisations' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.firms f WHERE f.id = p_firm_id AND f.decision = 'refused') THEN
    RAISE EXCEPTION 'This firm can''t list organisations' USING ERRCODE = 'PT403';
  END IF;
  IF p_provider IS NULL OR p_provider NOT IN ('google', 'microsoft') THEN
    RAISE EXCEPTION 'The provider is Google or Microsoft' USING ERRCODE = '22023';
  END IF;
  IF char_length(lbl) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Name the organisation, in 80 characters or fewer' USING ERRCODE = '22023';
  END IF;
  IF p_provider = 'google' AND org !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' THEN
    RAISE EXCEPTION 'A Google organisation is its verified domain, such as advisory.example' USING ERRCODE = '22023';
  END IF;
  IF p_provider = 'microsoft' AND org !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'A Microsoft organisation is its tenant ID, a GUID, not a domain or an address' USING ERRCODE = '22023';
  END IF;
  IF public.is_consumer_organisation(p_provider, org) THEN
    RAISE EXCEPTION 'A free-mail domain or personal-account tenant can never be listed: it would match everyone with a free account' USING ERRCODE = '22023';
  END IF;
  BEGIN
    INSERT INTO public.firm_organisations (firm_id, provider, org_id, label, added_by)
    VALUES (p_firm_id, p_provider, org, lbl, auth.uid())
    RETURNING * INTO row;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'That organisation is already listed' USING ERRCODE = '23505';
  END;
  PERFORM public.firm_activity_append(p_firm_id, 'organisation_listed', 'firm', p_firm_id::text);
  RETURN jsonb_build_object('id', row.id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.remove_firm_organisation(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE row public.firm_organisations;
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zo.firm_id FROM public.firm_organisations zo WHERE zo.id = p_id));
  SELECT * INTO row FROM public.firm_organisations o WHERE o.id = p_id FOR UPDATE;
  IF NOT FOUND OR public.firm_role(row.firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can remove its organisations' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.firms f WHERE f.id = row.firm_id AND f.decision = 'refused') THEN
    RAISE EXCEPTION 'This firm can''t list organisations' USING ERRCODE = 'PT403';
  END IF;
  DELETE FROM public.firm_organisations o WHERE o.id = row.id;
  PERFORM public.firm_activity_append(row.firm_id, 'organisation_removed', 'firm', row.firm_id::text);
END;
$function$;

CREATE OR REPLACE FUNCTION public.approve_join_request(p_request_id uuid, p_role text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  req public.join_requests;
  have text;
  held text;
  closed integer;
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zr.firm_id FROM public.join_requests zr WHERE zr.id = p_request_id));
  SELECT * INTO req FROM public.join_requests r WHERE r.id = p_request_id;
  IF NOT FOUND OR public.firm_role(req.firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can approve a request' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.firms f WHERE f.id = req.firm_id AND f.decision = 'refused') THEN
    RAISE EXCEPTION 'This firm can''t take new members' USING ERRCODE = 'PT403';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('owner', 'lead', 'agent') THEN
    RAISE EXCEPTION 'Choose a role: owner, lead or agent' USING ERRCODE = '22023';
  END IF;
  IF req.status <> 'open' THEN
    RAISE EXCEPTION 'That request has already been decided' USING ERRCODE = 'PT410';
  END IF;
  IF EXISTS (SELECT 1 FROM public.firm_member_suspensions s WHERE s.firm_id = req.firm_id AND s.user_id = req.user_id AND s.ended_at IS NULL) THEN
    RAISE EXCEPTION 'That person is suspended at this firm. Lift the suspension instead.' USING ERRCODE = 'PT409';
  END IF;
  SELECT m.role INTO have FROM public.firm_memberships m
  WHERE m.firm_id = req.firm_id AND m.user_id = req.user_id AND public.membership_is_current(m.valid_from, m.valid_until) LIMIT 1;
  IF have IS NULL THEN
    INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (req.firm_id, req.user_id, p_role);
  END IF;
  held := COALESCE(have, p_role);
  -- Only an open request is closed. If someone decided it first (at the same moment), nothing is updated and the membership just made is
  -- rolled back with this refusal.
  UPDATE public.join_requests r
  SET status = 'approved', decided_by = auth.uid(), decided_at = now(), decided_role = held
  WHERE r.id = req.id AND r.status = 'open';
  GET DIAGNOSTICS closed = ROW_COUNT;
  IF closed = 0 THEN
    RAISE EXCEPTION 'That request has already been decided' USING ERRCODE = 'PT410';
  END IF;
  RETURN held;
END;
$function$;

CREATE OR REPLACE FUNCTION public.decline_join_request(p_request_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  req public.join_requests;
  closed integer;
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zr.firm_id FROM public.join_requests zr WHERE zr.id = p_request_id));
  SELECT * INTO req FROM public.join_requests r WHERE r.id = p_request_id;
  IF NOT FOUND OR public.firm_role(req.firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can decline a request' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.firms f WHERE f.id = req.firm_id AND f.decision = 'refused') THEN
    RAISE EXCEPTION 'This firm can''t take new members' USING ERRCODE = 'PT403';
  END IF;
  IF req.status <> 'open' THEN
    RAISE EXCEPTION 'That request has already been decided' USING ERRCODE = 'PT410';
  END IF;
  UPDATE public.join_requests r SET status = 'declined', decided_by = auth.uid(), decided_at = now() WHERE r.id = req.id AND r.status = 'open';
  GET DIAGNOSTICS closed = ROW_COUNT;
  IF closed = 0 THEN
    RAISE EXCEPTION 'That request has already been decided' USING ERRCODE = 'PT410';
  END IF;
  PERFORM public.firm_activity_append(req.firm_id, 'join_declined', 'firm', req.firm_id::text, req.user_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.invite_member(p_firm_id uuid, p_email text, p_role text, p_team_id uuid, p_token_hash text)
 RETURNS TABLE(invitation_id uuid, email text, firm_name text, firm_address text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  inv public.firm_invitations;
  f public.firms;
  clean_email text := lower(btrim(COALESCE(p_email, '')));
  violated text;
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable(p_firm_id);
  IF public.firm_role(p_firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can invite people' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO f FROM public.firms WHERE id = p_firm_id FOR NO KEY UPDATE;
  IF f.decision = 'refused' THEN
    RAISE EXCEPTION 'This firm can''t invite people' USING ERRCODE = 'PT403';
  END IF;
  IF f.approved_at IS NULL AND f.decision IS NULL
     AND (SELECT count(*) FROM public.firm_invitations i WHERE i.firm_id = p_firm_id AND i.status = 'pending') >= 5 THEN
    RAISE EXCEPTION 'A firm waiting for approval can hold at most five pending invitations' USING ERRCODE = 'PT409';
  END IF;
  PERFORM public.guard_invitation_mail_rate(f);
  -- Someone who is already a current member of the firm is not invited again. The owner is told, since it is their own firm.
  IF EXISTS (
       SELECT 1
       FROM public.firm_memberships m
       JOIN auth.users u ON u.id = m.user_id
       WHERE m.firm_id = p_firm_id AND lower(btrim(u.email)) = clean_email
         AND public.membership_is_current(m.valid_from, m.valid_until)
     ) THEN
    RAISE EXCEPTION 'That person is already a member of this firm' USING ERRCODE = 'PT409';
  END IF;
  BEGIN
    INSERT INTO public.firm_invitations (firm_id, email, role, team_id, token_hash, invited_by, expires_at)
    VALUES (p_firm_id, clean_email, p_role, p_team_id, p_token_hash, auth.uid(), now() + interval '7 days')
    RETURNING * INTO inv;
  EXCEPTION WHEN unique_violation THEN
    -- The unique index firm_invitations_one_pending is the rule (D-29); this only gives its usual message. Any other unique
    -- violation (a token hash used twice) stays as it is.
    GET STACKED DIAGNOSTICS violated = CONSTRAINT_NAME;
    IF violated = 'firm_invitations_one_pending' THEN
      RAISE EXCEPTION 'That email already has a pending invitation to this firm. Resend it instead.' USING ERRCODE = 'PT409';
    END IF;
    RAISE;
  END;
  PERFORM public.record_firm_event(p_firm_id, 'invitation_sent', auth.uid(),
    jsonb_build_object('invitation_id', inv.id, 'email', clean_email, 'role', p_role));
  RETURN QUERY SELECT inv.id, inv.email, f.name, f.address, inv.expires_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.resend_invitation(p_invitation_id uuid, p_token_hash text)
 RETURNS TABLE(invitation_id uuid, email text, firm_name text, firm_address text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  inv public.firm_invitations;
  f public.firms;
  fid uuid;
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zi.firm_id FROM public.firm_invitations zi WHERE zi.id = p_invitation_id));
  -- The firm's row is locked before the invitation's, as inviting does, so the count of a waiting firm's emails is read and
  -- spent by one caller at a time.
  SELECT i.firm_id INTO fid FROM public.firm_invitations i WHERE i.id = p_invitation_id;
  IF NOT FOUND OR public.firm_role(fid) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can do that' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO f FROM public.firms WHERE id = fid FOR NO KEY UPDATE;
  SELECT * INTO inv FROM public.firm_invitations i WHERE i.id = p_invitation_id FOR UPDATE;
  IF f.decision = 'refused' THEN
    RAISE EXCEPTION 'This firm can''t invite people' USING ERRCODE = 'PT403';
  END IF;
  IF inv.status <> 'pending' THEN
    RAISE EXCEPTION 'This invitation has already been used or withdrawn' USING ERRCODE = 'PT410';
  END IF;
  PERFORM public.guard_invitation_mail_rate(f);
  UPDATE public.firm_invitations i
  SET token_hash = p_token_hash, expires_at = now() + interval '7 days', resent_at = now(), send_count = i.send_count + 1,
      email_sent_at = NULL, email_error = NULL, email_outcome = NULL
  WHERE i.id = inv.id
  RETURNING * INTO inv;
  PERFORM public.record_firm_event(inv.firm_id, 'invitation_sent', auth.uid(),
    jsonb_build_object('invitation_id', inv.id, 'email', inv.email, 'role', inv.role));
  RETURN QUERY SELECT inv.id, inv.email, f.name, f.address, inv.expires_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_invitation(p_invitation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE inv public.firm_invitations;
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zi.firm_id FROM public.firm_invitations zi WHERE zi.id = p_invitation_id));
  SELECT * INTO inv FROM public.firm_invitations i WHERE i.id = p_invitation_id FOR UPDATE;
  IF NOT FOUND OR public.firm_role(inv.firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can do that' USING ERRCODE = '42501';
  END IF;
  IF inv.status <> 'pending' THEN
    RAISE EXCEPTION 'This invitation has already been used or withdrawn' USING ERRCODE = 'PT410';
  END IF;
  UPDATE public.firm_invitations i SET status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now() WHERE i.id = inv.id;
  PERFORM public.record_firm_event(inv.firm_id, 'invitation_withdrawn', auth.uid(),
    jsonb_build_object('invitation_id', inv.id, 'email', inv.email, 'role', inv.role));
END;
$function$;

CREATE OR REPLACE FUNCTION public.remove_member(p_firm_id uuid, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  m public.firm_memberships;
  s public.firm_member_suspensions;
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable(p_firm_id);
  IF public.firm_role(p_firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can do that' USING ERRCODE = '42501';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You can''t remove yourself' USING ERRCODE = 'PT409';
  END IF;
  SELECT * INTO m FROM public.firm_memberships x
  WHERE x.firm_id = p_firm_id AND x.user_id = p_user_id AND public.membership_is_current(x.valid_from, x.valid_until)
  FOR UPDATE;
  IF FOUND THEN
    -- Someone else ended this membership between this call starting and getting the row lock: it is already changed.
    IF m.valid_until IS NOT NULL AND m.valid_until <= clock_timestamp() THEN
      RAISE EXCEPTION 'That person is not a member of this firm' USING ERRCODE = 'PT404';
    END IF;
    PERFORM public.end_membership_now(m.id, 'The last owner of a firm can''t be removed. Make someone else an owner first.');
    PERFORM public.firm_activity_append(p_firm_id, 'member_removed', 'membership', m.id::text, m.user_id, m.role);
    RETURN;
  END IF;
  -- A suspended person has no current membership; removing them closes the suspension, and the membership stays ended.
  SELECT * INTO s FROM public.firm_member_suspensions x
  WHERE x.firm_id = p_firm_id AND x.user_id = p_user_id AND x.ended_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That person is not a member of this firm' USING ERRCODE = 'PT404';
  END IF;
  UPDATE public.firm_member_suspensions x SET ended_at = now(), ended_how = 'removed' WHERE x.id = s.id;
  PERFORM public.firm_activity_append(p_firm_id, 'member_removed', 'membership', s.membership_id::text, s.user_id, s.role);
END;
$function$;

CREATE OR REPLACE FUNCTION public.suspend_member(p_firm_id uuid, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE m public.firm_memberships;
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable(p_firm_id);
  IF public.firm_role(p_firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can do that' USING ERRCODE = '42501';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You can''t suspend yourself' USING ERRCODE = 'PT409';
  END IF;
  IF EXISTS (SELECT 1 FROM public.firm_member_suspensions s WHERE s.firm_id = p_firm_id AND s.user_id = p_user_id AND s.ended_at IS NULL) THEN
    RAISE EXCEPTION 'That person is already suspended' USING ERRCODE = 'PT409';
  END IF;
  SELECT * INTO m FROM public.firm_memberships x
  WHERE x.firm_id = p_firm_id AND x.user_id = p_user_id AND public.membership_is_current(x.valid_from, x.valid_until)
  FOR UPDATE;
  IF NOT FOUND OR (m.valid_until IS NOT NULL AND m.valid_until <= clock_timestamp()) THEN
    -- Not found, or someone else ended it between this call starting and getting the row lock.
    RAISE EXCEPTION 'That person is not a member of this firm' USING ERRCODE = 'PT404';
  END IF;
  BEGIN
    -- The suspension is written before the membership ends, so what reacts to the end (a stored mailbox) can see it is one.
    INSERT INTO public.firm_member_suspensions (firm_id, user_id, membership_id, role, team_id, suspended_by)
    VALUES (p_firm_id, p_user_id, m.id, m.role, m.team_id, auth.uid());
    PERFORM set_config('nevermore.membership_change', 'on', true);
    UPDATE public.firm_memberships x SET valid_until = now() WHERE x.id = m.id;
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'The last owner of a firm can''t be suspended. Make someone else an owner first.' USING ERRCODE = '23514';
  END;
  PERFORM set_config('nevermore.membership_change', 'off', true);
  PERFORM public.firm_activity_append(p_firm_id, 'member_suspended', 'membership', m.id::text, m.user_id, m.role);
END;
$function$;

CREATE OR REPLACE FUNCTION public.lift_member_suspension(p_firm_id uuid, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  s public.firm_member_suspensions;
  new_id bigint;
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable(p_firm_id);
  IF public.firm_role(p_firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can do that' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO s FROM public.firm_member_suspensions x
  WHERE x.firm_id = p_firm_id AND x.user_id = p_user_id AND x.ended_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That person is not suspended' USING ERRCODE = 'PT404';
  END IF;
  UPDATE public.firm_member_suspensions x SET ended_at = now(), ended_how = 'lifted' WHERE x.id = s.id;
  PERFORM set_config('nevermore.lifting_suspension', 'on', true);
  PERFORM set_config('nevermore.membership_change', 'on', true);
  INSERT INTO public.firm_memberships (firm_id, user_id, role, team_id) VALUES (p_firm_id, p_user_id, s.role, s.team_id)
  RETURNING id INTO new_id;
  PERFORM set_config('nevermore.lifting_suspension', 'off', true);
  PERFORM set_config('nevermore.membership_change', 'off', true);
  PERFORM public.firm_activity_append(p_firm_id, 'member_restored', 'membership', new_id::text, p_user_id, s.role);
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_view(p_firm_id uuid, p_table text, p_name text, p_filters jsonb, p_sort jsonb, p_columns jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  t public.workspace_table;
  clean_name text := btrim(COALESCE(p_name, ''));
  kept_filters jsonb := COALESCE(p_filters, '[]'::jsonb);
  vid uuid;
  violated text;
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable(p_firm_id);
  IF public.firm_role(p_firm_id) IS NULL THEN
    RAISE EXCEPTION 'Only a member of the firm can do that' USING ERRCODE = '42501';
  END IF;
  t := public.workspace_table_named(p_table);
  PERFORM public.saved_view_input_check(clean_name, kept_filters, p_sort, p_columns);
  PERFORM pg_advisory_xact_lock(hashtextextended('saved_views:' || p_firm_id::text || ':' || auth.uid()::text || ':' || t, 0));
  IF (SELECT count(*) FROM public.saved_views v WHERE v.firm_id = p_firm_id AND v.user_id = auth.uid() AND v.table_name = t) >= 30 THEN
    RAISE EXCEPTION 'You can keep at most 30 views of a table. Delete one first.' USING ERRCODE = 'PT422';
  END IF;
  BEGIN
    INSERT INTO public.saved_views (firm_id, user_id, table_name, name, filters, sort, columns)
    VALUES (p_firm_id, auth.uid(), t, clean_name, kept_filters, p_sort, p_columns)
    RETURNING id INTO vid;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS violated = CONSTRAINT_NAME;
    PERFORM public.saved_view_name_clash(violated, clean_name);
    RAISE;
  END;
  RETURN vid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_my_table_columns(p_firm_id uuid, p_table text, p_view_id uuid, p_columns jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE t public.workspace_table;
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable(p_firm_id);
  IF public.firm_role(p_firm_id) IS NULL THEN
    RAISE EXCEPTION 'Only a member of the firm can do that' USING ERRCODE = '42501';
  END IF;
  t := public.workspace_table_named(p_table);
  -- Forgetting removes only the caller's own row, and answers the same whether or not the view exists or can still be read:
  -- a choice kept on a view that has since been unshared can still be cleared.
  IF p_columns IS NULL THEN
    DELETE FROM public.table_preferences p
    WHERE p.firm_id = p_firm_id AND p.user_id = auth.uid() AND p.table_name = t AND p.saved_view_id IS NOT DISTINCT FROM p_view_id;
    RETURN;
  END IF;
  IF p_view_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.saved_views s
       WHERE s.id = p_view_id AND s.firm_id = p_firm_id AND s.table_name = t AND (s.shared OR s.user_id = auth.uid())
     ) THEN
    RAISE EXCEPTION 'That view isn''t available' USING ERRCODE = 'PT404';
  END IF;
  PERFORM public.saved_view_input_check(NULL, '[]'::jsonb, NULL, p_columns);
  IF p_view_id IS NULL THEN
    INSERT INTO public.table_preferences (firm_id, user_id, table_name, columns)
    VALUES (p_firm_id, auth.uid(), t, p_columns)
    ON CONFLICT (firm_id, user_id, table_name) WHERE saved_view_id IS NULL
    DO UPDATE SET columns = EXCLUDED.columns, updated_at = now();
  ELSE
    INSERT INTO public.table_preferences (firm_id, user_id, table_name, saved_view_id, columns)
    VALUES (p_firm_id, auth.uid(), t, p_view_id, p_columns)
    ON CONFLICT (user_id, saved_view_id) WHERE saved_view_id IS NOT NULL
    DO UPDATE SET columns = EXCLUDED.columns, updated_at = now();
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.change_saved_view(p_view_id uuid, p_filters jsonb, p_sort jsonb, p_columns jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v public.saved_views := public.saved_view_for_caller(p_view_id);
  kept_filters jsonb := COALESCE(p_filters, '[]'::jsonb);
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zv.firm_id FROM public.saved_views zv WHERE zv.id = p_view_id));
  IF v.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the person who saved a view can change it' USING ERRCODE = '42501';
  END IF;
  IF v.shared AND public.firm_role(v.firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'A shared view is the firm''s: only an owner can change it' USING ERRCODE = '42501';
  END IF;
  PERFORM public.saved_view_input_check(NULL, kept_filters, p_sort, p_columns);
  UPDATE public.saved_views s SET filters = kept_filters, sort = p_sort, columns = p_columns, updated_at = now() WHERE s.id = v.id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rename_saved_view(p_view_id uuid, p_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v public.saved_views := public.saved_view_for_caller(p_view_id);
  clean_name text := btrim(COALESCE(p_name, ''));
  violated text;
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zv.firm_id FROM public.saved_views zv WHERE zv.id = p_view_id));
  IF v.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the person who saved a view can rename it' USING ERRCODE = '42501';
  END IF;
  IF v.shared AND public.firm_role(v.firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'A shared view is the firm''s: only an owner can rename it' USING ERRCODE = '42501';
  END IF;
  PERFORM public.saved_view_input_check(clean_name, '[]'::jsonb, NULL, NULL);
  BEGIN
    UPDATE public.saved_views s SET name = clean_name, updated_at = now() WHERE s.id = v.id;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS violated = CONSTRAINT_NAME;
    PERFORM public.saved_view_name_clash(violated, clean_name);
    RAISE;
  END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_saved_view(p_view_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v public.saved_views := public.saved_view_for_caller(p_view_id);
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zv.firm_id FROM public.saved_views zv WHERE zv.id = p_view_id));
  IF v.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the person who saved a view can delete it' USING ERRCODE = '42501';
  END IF;
  IF v.shared AND public.firm_role(v.firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'A shared view is the firm''s: only an owner can delete it' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.saved_views s WHERE s.id = v.id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.share_saved_view(p_view_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v public.saved_views := public.saved_view_for_caller(p_view_id);
  violated text;
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zv.firm_id FROM public.saved_views zv WHERE zv.id = p_view_id));
  IF public.firm_role(v.firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can share a view' USING ERRCODE = '42501';
  END IF;
  IF v.shared THEN
    RETURN;
  END IF;
  -- A view kept under the old rules beside another of the same name (see the top of this file) is shared only once renamed.
  IF v.name_clash_kept THEN
    RAISE EXCEPTION 'Another of your views has this name: rename it before sharing it' USING ERRCODE = 'PT409';
  END IF;
  BEGIN
    UPDATE public.saved_views s SET shared = true, shared_by = auth.uid(), shared_at = now(), updated_at = now() WHERE s.id = v.id;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS violated = CONSTRAINT_NAME;
    PERFORM public.saved_view_name_clash(violated, v.name);
    RAISE;
  END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.unshare_saved_view(p_view_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v public.saved_views := public.saved_view_for_caller(p_view_id);
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zv.firm_id FROM public.saved_views zv WHERE zv.id = p_view_id));
  IF public.firm_role(v.firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can stop sharing a view' USING ERRCODE = '42501';
  END IF;
  IF NOT v.shared THEN
    RETURN;
  END IF;
  UPDATE public.saved_views s SET shared = false, shared_by = NULL, shared_at = NULL, updated_at = now() WHERE s.id = v.id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.review_submission_field(p_session_id uuid, p_field text, p_review_state text, p_correction text DEFAULT 'keep'::text, p_value jsonb DEFAULT NULL::jsonb, p_reason text DEFAULT NULL::text, p_answer jsonb DEFAULT NULL::jsonb)
 RETURNS advisor_field_reviews
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s public.chamber_sessions;
  prev public.advisor_field_reviews;
  next_row public.advisor_field_reviews;
  clean_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  next_has boolean;
  next_value jsonb;
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.chamber_sessions zs WHERE zs.id = p_session_id));
  PERFORM public.require_advisor();
  PERFORM public.require_intake_in_my_firm(p_session_id, 'P0002');
  IF NOT public.is_reviewable_field(p_field) THEN
    RAISE EXCEPTION 'Unknown field: %', p_field USING ERRCODE = '22023';
  END IF;
  IF p_review_state IS NOT NULL AND p_review_state NOT IN ('verified', 'incomplete', 'follow_up') THEN
    RAISE EXCEPTION 'Unknown review state: %', p_review_state USING ERRCODE = '22023';
  END IF;
  IF p_correction NOT IN ('keep', 'set', 'clear') THEN
    RAISE EXCEPTION 'Unknown correction action: %', p_correction USING ERRCODE = '22023';
  END IF;
  IF p_correction = 'set' AND p_field IN ('census', 'employees') THEN
    RAISE EXCEPTION 'The census is corrected with the prospect, not here' USING ERRCODE = '22023';
  END IF;
  IF p_correction <> 'keep' AND clean_reason IS NULL THEN
    RAISE EXCEPTION 'A correction needs a reason' USING ERRCODE = '22023';
  END IF;
  IF length(clean_reason) > 2000 THEN
    RAISE EXCEPTION 'Reasons are limited to 2000 characters' USING ERRCODE = '22023';
  END IF;
  IF p_answer IS NOT NULL AND jsonb_typeof(p_answer) <> 'object' THEN
    RAISE EXCEPTION 'The answer reviewed must be given as {"value": ...}' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO s FROM public.chamber_sessions WHERE id = p_session_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_answer IS NOT NULL
     AND (p_answer -> 'value') IS DISTINCT FROM (public.advisor_visible_answers(s.status, s.submission, s.chamber_data) -> p_field) THEN
    RAISE EXCEPTION 'The prospect changed this answer after the page was loaded; review the current answer'
      USING ERRCODE = 'PT409';
  END IF;

  SELECT * INTO prev FROM public.advisor_field_reviews
  WHERE session_id = p_session_id AND field = p_field FOR UPDATE;

  next_has := CASE p_correction WHEN 'set' THEN true WHEN 'clear' THEN false ELSE COALESCE(prev.has_correction, false) END;
  next_value := CASE p_correction WHEN 'set' THEN p_value WHEN 'clear' THEN NULL ELSE prev.corrected_value END;

  INSERT INTO public.advisor_field_reviews AS r
    (session_id, field, review_state, has_correction, corrected_value, reason, updated_by, updated_by_email, updated_at,
     answer_changed_at, answer_changed_from)
  VALUES
    (p_session_id, p_field, p_review_state, next_has, next_value,
     CASE WHEN p_correction = 'keep' THEN COALESCE(clean_reason, prev.reason) ELSE clean_reason END,
     auth.uid(), auth.jwt() ->> 'email', now(), NULL, NULL)
  ON CONFLICT (session_id, field) DO UPDATE SET
    review_state = EXCLUDED.review_state,
    has_correction = EXCLUDED.has_correction,
    corrected_value = EXCLUDED.corrected_value,
    reason = EXCLUDED.reason,
    updated_by = EXCLUDED.updated_by,
    updated_by_email = EXCLUDED.updated_by_email,
    updated_at = EXCLUDED.updated_at,
    answer_changed_at = NULL,
    answer_changed_from = NULL
  RETURNING * INTO next_row;

  INSERT INTO public.advisor_review_events
    (session_id, field, from_state, to_state, correction_changed, from_value, to_value,
     had_correction, has_correction, reason, actor_id, actor_email)
  VALUES
    (p_session_id, p_field, prev.review_state, next_row.review_state,
     COALESCE(prev.has_correction, false) IS DISTINCT FROM next_row.has_correction
       OR prev.corrected_value IS DISTINCT FROM next_row.corrected_value,
     prev.corrected_value, next_row.corrected_value,
     COALESCE(prev.has_correction, false), next_row.has_correction,
     clean_reason, auth.uid(), auth.jwt() ->> 'email');

  RETURN next_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_submission_status(p_session_id uuid, p_status text, p_note text DEFAULT NULL::text, p_won_quote_request_id bigint DEFAULT NULL::bigint)
 RETURNS submission_workflow
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_row public.submission_workflow;
  previous text;
  allowed text[];
  clean_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.chamber_sessions zs WHERE zs.id = p_session_id));
  PERFORM public.require_advisor();
  PERFORM public.require_intake_in_my_firm(p_session_id, 'P0002');
  IF p_status IS NULL OR p_status NOT IN (
    'submitted', 'under_review', 'information_requested', 'ready_for_market', 'sent_to_carrier', 'quoted', 'won', 'lost', 'archived'
  ) THEN
    RAISE EXCEPTION 'Not a status an advisor can set: %', p_status USING ERRCODE = '22023';
  END IF;
  IF length(clean_note) > 2000 THEN
    RAISE EXCEPTION 'Status notes are limited to 2000 characters' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO current_row FROM public.submission_workflow WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'P0002';
  END IF;
  IF current_row.status = p_status THEN
    RETURN current_row;
  END IF;
  IF p_status <> 'archived' AND NOT public.intake_ever_certified(p_session_id) THEN
    RAISE EXCEPTION 'The prospect hasn''t certified this intake yet, so it can only be archived' USING ERRCODE = '22023';
  END IF;
  allowed := public.pipeline_next_statuses(current_row.status);
  IF NOT p_status = ANY (allowed) THEN
    RAISE EXCEPTION 'A submission can''t move from % to %. From % it can move to: %',
      replace(current_row.status, '_', ' '), replace(p_status, '_', ' '), replace(current_row.status, '_', ' '),
      replace(array_to_string(allowed, ', '), '_', ' ')
      USING ERRCODE = '22023';
  END IF;
  IF p_status = 'won' AND NOT EXISTS (
    SELECT 1 FROM public.quote_requests q
    WHERE q.id = p_won_quote_request_id AND q.session_id = p_session_id AND q.status = 'quoted'
  ) THEN
    RAISE EXCEPTION 'To mark this won, name which of this submission''s quotes the employer took' USING ERRCODE = '22023';
  END IF;
  previous := current_row.status;

  UPDATE public.submission_workflow
  SET status = p_status, updated_at = now(), updated_by = auth.uid(),
      won_quote_request_id = CASE WHEN p_status = 'won' THEN p_won_quote_request_id ELSE won_quote_request_id END
  WHERE session_id = p_session_id
  RETURNING * INTO current_row;

  -- A submission that is won, lost or archived waits on no PEO: close every quote request still open, except the
  -- winner. A decline stays a decline.
  IF p_status IN ('won', 'lost', 'archived') THEN
    UPDATE public.quote_requests
    SET status = 'closed'
    WHERE session_id = p_session_id AND status IN ('sent', 'quoted')
      AND id IS DISTINCT FROM current_row.won_quote_request_id;
  END IF;

  INSERT INTO public.submission_status_history (session_id, from_status, to_status, note, changed_by, changed_by_email)
  VALUES (p_session_id, previous, p_status, clean_note, auth.uid(), auth.jwt() ->> 'email');
  RETURN current_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_submission_needs_action(p_session_id uuid, p_needs_action boolean, p_note text DEFAULT NULL::text)
 RETURNS submission_workflow
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_row public.submission_workflow;
  clean_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.chamber_sessions zs WHERE zs.id = p_session_id));
  PERFORM public.require_advisor();
  PERFORM public.require_intake_in_my_firm(p_session_id, 'P0002');
  IF p_needs_action IS NULL THEN
    RAISE EXCEPTION 'Say whether the submission needs advisor action' USING ERRCODE = '22023';
  END IF;
  IF length(clean_note) > 500 THEN
    RAISE EXCEPTION 'A needs-advisor-action note is limited to 500 characters' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO current_row FROM public.submission_workflow WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'P0002';
  END IF;
  -- Already as asked: nothing to record. Raising it again with another note replaces the note.
  IF current_row.needs_action = p_needs_action
     AND (NOT p_needs_action OR current_row.needs_action_note IS NOT DISTINCT FROM clean_note) THEN
    RETURN current_row;
  END IF;

  UPDATE public.submission_workflow
  SET needs_action = p_needs_action,
      needs_action_note = CASE WHEN p_needs_action THEN clean_note END,
      needs_action_at = now(),
      needs_action_by = auth.uid(),
      needs_action_by_email = auth.jwt() ->> 'email'
  WHERE session_id = p_session_id
  RETURNING * INTO current_row;

  INSERT INTO public.submission_status_history (session_id, from_status, to_status, note, changed_by, changed_by_email)
  VALUES (
    p_session_id, current_row.status, current_row.status,
    CASE WHEN p_needs_action THEN 'Marked as needing advisor action' ELSE 'Cleared: no longer needs advisor action' END
      || COALESCE(': ' || clean_note, ''),
    auth.uid(), auth.jwt() ->> 'email'
  );
  RETURN current_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.advisor_request_information(p_session_id uuid, p_message text, p_fields text[] DEFAULT '{}'::text[], p_extra_questions jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  s public.chamber_sessions;
  w public.submission_workflow;
  clean_message text := btrim(COALESCE(p_message, ''));
  clean_fields text[];
  unknown_fields text;
  recipient text;
  contact text;
  company text;
  req public.information_requests;
  questions jsonb := COALESCE(p_extra_questions, '[]'::jsonb);
  q jsonb;
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.chamber_sessions zs WHERE zs.id = p_session_id));
  PERFORM public.require_advisor();
  PERFORM public.require_intake_in_my_firm(p_session_id, 'PT404');

  IF clean_message = '' THEN
    RAISE EXCEPTION 'Write what you need from the prospect' USING ERRCODE = '22023';
  END IF;
  IF char_length(clean_message) > 1000 THEN
    RAISE EXCEPTION 'A request is limited to 1000 characters' USING ERRCODE = '22023';
  END IF;

  SELECT string_agg(DISTINCT f, ', ') INTO unknown_fields
  FROM unnest(COALESCE(p_fields, '{}'::text[])) AS f
  WHERE f IS NULL OR NOT public.is_reviewable_field(f);
  IF unknown_fields IS NOT NULL OR array_position(COALESCE(p_fields, '{}'::text[]), NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Not a field the prospect can be asked about: %', COALESCE(unknown_fields, 'an empty name') USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(array_agg(x.field ORDER BY x.first_at), '{}'::text[]) INTO clean_fields
  FROM (
    SELECT CASE WHEN u.f = 'employees' THEN 'census' ELSE u.f END AS field, min(u.ord) AS first_at
    FROM unnest(COALESCE(p_fields, '{}'::text[])) WITH ORDINALITY AS u(f, ord)
    GROUP BY 1
  ) x;
  IF cardinality(clean_fields) > 40 THEN
    RAISE EXCEPTION 'A request can name at most 40 fields' USING ERRCODE = '22023';
  END IF;

  -- The PEOs' own questions it names: each a question of a listed PEO's profile in use, by its key and as worded.
  IF jsonb_typeof(questions) <> 'array' THEN
    RAISE EXCEPTION 'A request names a PEO''s questions as a list' USING ERRCODE = '22023';
  END IF;
  -- sync:begin request_max_extra_questions
  IF jsonb_array_length(questions) > 60 THEN
  -- sync:end request_max_extra_questions
    RAISE EXCEPTION 'A request can name at most 60 of the PEOs'' own questions' USING ERRCODE = '22023';
  END IF;
  FOR q IN SELECT x FROM jsonb_array_elements(questions) x LOOP
    IF jsonb_typeof(q) <> 'object' OR EXISTS (SELECT 1 FROM jsonb_object_keys(q) k WHERE k NOT IN ('peo_id', 'key', 'question'))
       OR jsonb_typeof(q -> 'peo_id') IS DISTINCT FROM 'number' OR jsonb_typeof(q -> 'key') IS DISTINCT FROM 'string'
       OR jsonb_typeof(q -> 'question') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'Each of a PEO''s questions is named by the PEO, its key and its wording' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.peos p
      CROSS JOIN LATERAL (
        SELECT v.extra_questions FROM public.peo_profile_versions v
        WHERE v.peo_id = p.id AND v.status = 'published' ORDER BY v.version DESC LIMIT 1
      ) in_use
      CROSS JOIN LATERAL jsonb_array_elements(in_use.extra_questions) asked
      WHERE p.id = (q ->> 'peo_id')::numeric AND p.listed
        AND asked ->> 'key' = q ->> 'key' AND asked ->> 'text' = q ->> 'question'
    ) THEN
      RAISE EXCEPTION 'Not a question that PEO''s profile asks, as worded: %', q ->> 'question' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  -- The PEO compared as a number, so 5 and 5.0 are the same PEO.
  IF (SELECT count(*) FROM jsonb_array_elements(questions)) <> (SELECT count(DISTINCT ((x ->> 'peo_id')::numeric, x ->> 'key')) FROM jsonb_array_elements(questions) x) THEN
    RAISE EXCEPTION 'A request names each question once' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO w FROM public.submission_workflow WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'PT404';
  END IF;
  SELECT * INTO s FROM public.chamber_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'PT404';
  END IF;
  IF s.status IN ('archived', 'revoked', 'expired') THEN
    RAISE EXCEPTION 'This intake is closed (%), so the prospect can''t answer a request on it', s.status USING ERRCODE = '22023';
  END IF;
  IF NOT public.intake_ever_certified(p_session_id) THEN
    RAISE EXCEPTION 'The prospect hasn''t certified this intake yet, so there is nothing to ask them about' USING ERRCODE = '22023';
  END IF;
  IF w.status <> 'information_requested' AND NOT ('information_requested' = ANY (public.pipeline_next_statuses(w.status))) THEN
    RAISE EXCEPTION 'A submission can''t move from % to information requested', replace(w.status, '_', ' ') USING ERRCODE = '22023';
  END IF;

  SELECT NULLIF(btrim(u.email), '') INTO recipient
  FROM auth.users u
  WHERE u.id = s.user_id AND NOT COALESCE(u.is_anonymous, false);
  IF recipient IS NULL THEN
    RAISE EXCEPTION 'The prospect''s account has no email address to send this to' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.information_requests (session_id, message, fields, extra_questions, requested_by, requested_by_email)
  VALUES (p_session_id, clean_message, clean_fields, questions, auth.uid(), auth.jwt() ->> 'email')
  RETURNING * INTO req;

  IF w.status <> 'information_requested' THEN
    UPDATE public.submission_workflow
    SET status = 'information_requested', updated_at = now(), updated_by = auth.uid()
    WHERE session_id = p_session_id;
  END IF;
  INSERT INTO public.submission_status_history (session_id, from_status, to_status, note, changed_by, changed_by_email)
  VALUES (p_session_id, w.status, 'information_requested', left('Asked the prospect: ' || clean_message, 2000), auth.uid(), auth.jwt() ->> 'email');

  SELECT NULLIF(btrim(p.contact_name), '') INTO contact FROM public.profiles p WHERE p.user_id = s.user_id;
  company := NULLIF(btrim(s.chamber_data ->> 'company_name'), '');

  -- Unlike the certification emails, this one is the point of the call: a failure to queue it fails the request. It
  -- carries the fields' labels as before, and never a PEO's questions: the email names no PEO.
  INSERT INTO public.outbox_events (kind, session_id, dedupe_key, payload)
  VALUES (
    'information_request', p_session_id, 'request:' || req.id,
    jsonb_build_object(
      'reference', left(COALESCE(NULLIF(btrim(s.file_id), ''), NULLIF(btrim(s.submission ->> 'file_id'), '')), 64),
      'company_name', left(company, 200),
      'recipient_name', left(contact, 200),
      'recipient_email', recipient,
      'message', clean_message,
      'fields', to_jsonb(clean_fields),
      'requested_at', to_char(req.requested_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    )
  );

  RETURN jsonb_build_object('request_id', req.id, 'from_status', w.status, 'status', 'information_requested');
END;
$function$;

CREATE OR REPLACE FUNCTION public.advisor_record_quote_send(p_session_id uuid, p_peo text, p_sent_on date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  req public.quote_requests;
  stage text;
  peo text := btrim(COALESCE(p_peo, ''));
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.chamber_sessions zs WHERE zs.id = p_session_id));
  PERFORM public.require_advisor();
  PERFORM public.require_intake_in_my_firm(p_session_id, 'PT404');
  IF peo = '' THEN
    RAISE EXCEPTION 'Name the PEO the packet went to' USING ERRCODE = '22023';
  END IF;
  -- sync:begin quote_peo_length
  IF char_length(peo) > 80 THEN
  -- sync:end quote_peo_length
    RAISE EXCEPTION 'A PEO name is limited to 80 characters' USING ERRCODE = '22023';
  END IF;
  SELECT w.status INTO stage FROM public.submission_workflow w WHERE w.session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'PT404';
  END IF;
  IF stage NOT IN (
    -- sync:begin quote_sendable_stages
    'ready_for_market', 'sent_to_carrier', 'quoted'
    -- sync:end quote_sendable_stages
  ) THEN
    RAISE EXCEPTION 'Move this submission to Ready for market first. It is %', replace(stage, '_', ' ') USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_version, sent_on)
  VALUES (
    p_session_id, peo, 'sent',
    (SELECT max(c.version) FROM public.chamber_certifications c WHERE c.session_id = p_session_id),
    COALESCE(p_sent_on, current_date)
  )
  ON CONFLICT (session_id, lower(peo_name)) DO UPDATE
    SET sent_version = EXCLUDED.sent_version, sent_on = EXCLUDED.sent_on,
        status = CASE WHEN quote_requests.status = 'closed' THEN 'sent' ELSE quote_requests.status END
  RETURNING * INTO req;
  -- The address replies about this quote request are sent to; kept if it already has one.
  PERFORM public.issue_quote_request_address(req.id);
  RETURN to_jsonb(req);
END;
$function$;

CREATE OR REPLACE FUNCTION public.advisor_update_quote_request(p_quote_request_id bigint, p_status text, p_received_on date DEFAULT NULL::date, p_expires_on date DEFAULT NULL::date, p_start_on date DEFAULT NULL::date, p_admin_fee_pepm numeric DEFAULT NULL::numeric, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  req public.quote_requests;
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.quote_requests zq JOIN public.chamber_sessions zs ON zs.id = zq.session_id WHERE zq.id = p_quote_request_id));
  PERFORM public.require_advisor();
  IF p_status IS NULL OR p_status NOT IN ('quoted', 'declined', 'closed') THEN
    RAISE EXCEPTION 'A PEO''s answer is quoted, declined or closed, not %. Record a send to send it again', COALESCE(p_status, 'nothing')
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO req FROM public.quote_requests WHERE id = p_quote_request_id AND public.quote_request_in_my_firm(id) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote request not found' USING ERRCODE = 'PT404';
  END IF;
  IF char_length(btrim(COALESCE(p_note, ''))) > 2000 THEN
    RAISE EXCEPTION 'A note is limited to 2000 characters' USING ERRCODE = '22023';
  END IF;
  IF p_admin_fee_pepm < 0 OR p_admin_fee_pepm > 100000 THEN
    RAISE EXCEPTION 'The admin fee is per employee per month, from 0 to 100000' USING ERRCODE = '22023';
  END IF;
  IF req.status = 'closed' AND p_status <> 'closed' THEN
    RAISE EXCEPTION 'This quote request is closed. Record a send to % to reopen it', req.peo_name USING ERRCODE = '22023';
  END IF;
  IF p_status <> 'quoted' AND (p_received_on, p_expires_on, p_start_on, p_admin_fee_pepm) IS DISTINCT FROM (NULL::date, NULL::date, NULL::date, NULL::numeric) THEN
    RAISE EXCEPTION 'Only a quote has dates and a fee. Mark it quoted, or leave them empty' USING ERRCODE = '22023';
  END IF;
  UPDATE public.quote_requests
  SET status = p_status,
      quote_received_on = p_received_on,
      quote_expires_on = p_expires_on,
      proposed_start_on = p_start_on,
      admin_fee_pepm = p_admin_fee_pepm,
      note = NULLIF(btrim(COALESCE(p_note, '')), '')
  WHERE id = p_quote_request_id
  RETURNING * INTO req;
  RETURN to_jsonb(req);
END;
$function$;

CREATE OR REPLACE FUNCTION public.advisor_add_quote_request_note(p_quote_request_id bigint, p_kind text, p_noted_on date, p_body text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  req public.quote_requests;
  clean_body text;
  note public.quote_request_notes;
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.quote_requests zq JOIN public.chamber_sessions zs ON zs.id = zq.session_id WHERE zq.id = p_quote_request_id));
  PERFORM public.require_advisor();
  clean_body := public.check_quote_request_note(p_kind, p_noted_on, p_body);
  IF p_noted_on > current_date + 1 THEN
    RAISE EXCEPTION 'A note records something that has happened. Its date can''t be in the future' USING ERRCODE = '22023';
  END IF;
  -- Any status, a closed one included: a PEO that phones after its quote request closed can still be recorded.
  SELECT * INTO req FROM public.quote_requests WHERE id = p_quote_request_id AND public.quote_request_in_my_firm(id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote request not found' USING ERRCODE = 'PT404';
  END IF;
  INSERT INTO public.quote_request_notes (quote_request_id, session_id, kind, noted_on, body, created_by, created_by_email)
  VALUES (req.id, req.session_id, p_kind, p_noted_on, clean_body, auth.uid(), auth.jwt() ->> 'email')
  RETURNING * INTO note;
  RETURN to_jsonb(note);
END;
$function$;

CREATE OR REPLACE FUNCTION public.advisor_reissue_quote_request_address(p_quote_request_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  req public.quote_requests;
  old_local text;
  addr public.quote_request_addresses;
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.quote_requests zq JOIN public.chamber_sessions zs ON zs.id = zq.session_id WHERE zq.id = p_quote_request_id));
  PERFORM public.require_advisor();
  SELECT * INTO req FROM public.quote_requests WHERE id = p_quote_request_id AND public.quote_request_in_my_firm(id) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote request not found' USING ERRCODE = 'PT404';
  END IF;
  UPDATE public.quote_request_addresses
  SET revoked_at = now(), revoked_by = auth.uid(), revoked_by_email = auth.jwt() ->> 'email'
  WHERE quote_request_id = req.id AND revoked_at IS NULL
  RETURNING local_part INTO old_local;
  INSERT INTO public.quote_request_addresses (quote_request_id, session_id, local_part, issued_by, issued_by_email)
  VALUES (req.id, req.session_id,
          public.new_quote_request_address((SELECT s.file_id FROM public.chamber_sessions s WHERE s.id = req.session_id), req.peo_name),
          auth.uid(), auth.jwt() ->> 'email')
  RETURNING * INTO addr;
  INSERT INTO public.quote_request_events (quote_request_id, session_id, field, old_value, new_value, changed_by, changed_by_email)
  VALUES (req.id, req.session_id, 'reply_address', old_local, addr.local_part, auth.uid(), auth.jwt() ->> 'email');
  RETURN to_jsonb(addr);
END;
$function$;

CREATE OR REPLACE FUNCTION public.advisor_correct_quote_request_note(p_note_id bigint, p_kind text, p_noted_on date, p_body text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  clean_body text;
  note public.quote_request_notes;
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.quote_request_notes zn JOIN public.quote_requests zq ON zq.id = zn.quote_request_id JOIN public.chamber_sessions zs ON zs.id = zq.session_id WHERE zn.id = p_note_id));
  PERFORM public.require_advisor();
  clean_body := public.check_quote_request_note(p_kind, p_noted_on, p_body);
  IF p_noted_on > current_date + 1 THEN
    RAISE EXCEPTION 'A note records something that has happened. Its date can''t be in the future' USING ERRCODE = '22023';
  END IF;
  UPDATE public.quote_request_notes
  SET kind = p_kind, noted_on = p_noted_on, body = clean_body
  WHERE id = p_note_id AND public.quote_request_in_my_firm(quote_request_id)
  RETURNING * INTO note;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Note not found' USING ERRCODE = 'PT404';
  END IF;
  RETURN to_jsonb(note);
END;
$function$;

CREATE OR REPLACE FUNCTION public.advisor_requeue_outbox_event(event_id uuid, rebuild_payload boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.outbox_events ze JOIN public.chamber_sessions zs ON zs.id = ze.session_id WHERE ze.id = event_id));
  PERFORM public.require_advisor();
  IF event_id IS NULL THEN
    RAISE EXCEPTION 'an event id is required' USING ERRCODE = '22023';
  END IF;
  -- An email of another firm's intake is none the caller can see, so there is nothing to retry.
  IF NOT EXISTS (SELECT 1 FROM public.outbox_events e WHERE e.id = event_id AND public.intake_in_my_firm(e.session_id)) THEN
    RETURN false;
  END IF;
  RETURN public.requeue_outbox_event(event_id, COALESCE(rebuild_payload, false), auth.uid());
END;
$function$;

CREATE OR REPLACE FUNCTION public.advisor_add_referral_partner(p_code text, p_name text, p_kind text, p_firm_id uuid DEFAULT NULL::uuid)
 RETURNS referral_partners
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  code_in text := lower(btrim(COALESCE(p_code, '')));
  problem text := public.referral_partner_input_error(p_name, p_kind);
  firm uuid;
  added public.referral_partners;
BEGIN
  PERFORM public.require_advisor();
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
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
$function$;

CREATE OR REPLACE FUNCTION public.advisor_update_referral_partner(p_code text, p_name text, p_kind text, p_firm_id uuid DEFAULT NULL::uuid)
 RETURNS referral_partners
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  problem text := public.referral_partner_input_error(p_name, p_kind);
  firm uuid;
  changed public.referral_partners;
BEGIN
  PERFORM public.require_advisor();
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
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
$function$;

CREATE OR REPLACE FUNCTION public.accept_invitation(p_token_hash text, p_firm_address text)
 RETURNS TABLE(firm_id uuid, firm_address text, role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  inv public.firm_invitations;
  caller_email text;
  address text;
  decision text;
BEGIN
  SELECT lower(btrim(u.email)) INTO caller_email
  FROM auth.users u
  WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL;
  IF NOT public.is_signed_in_person() OR caller_email IS NULL THEN
    RAISE EXCEPTION 'Sign in with a verified email to accept an invitation' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO inv FROM public.firm_invitations i WHERE i.token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This invitation link is not valid' USING ERRCODE = 'PT404';
  END IF;
  SELECT f.address, f.decision INTO address, decision FROM public.firms f WHERE f.id = inv.firm_id;
  -- A refused firm is as good as no firm (D-31): its pending invitations read as links that are not valid.
  IF decision = 'refused' THEN
    RAISE EXCEPTION 'This invitation link is not valid' USING ERRCODE = 'PT404';
  END IF;
  IF address IS DISTINCT FROM lower(btrim(COALESCE(p_firm_address, ''))) THEN
    RAISE EXCEPTION 'This invitation belongs to another firm''s address' USING ERRCODE = 'PT422';
  END IF;
  IF public.firm_is_read_only(inv.firm_id) THEN
    RAISE EXCEPTION 'This firm is closing, so it can''t take new members' USING ERRCODE = 'PT423';
  END IF;
  IF public.firm_is_suspended(inv.firm_id) THEN
    RAISE EXCEPTION 'This firm is suspended, so it can''t take new members' USING ERRCODE = 'PT403';
  END IF;
  IF inv.status = 'accepted' THEN
    RAISE EXCEPTION 'This invitation has already been used' USING ERRCODE = 'PT410';
  ELSIF inv.status = 'cancelled' THEN
    RAISE EXCEPTION 'This invitation was withdrawn' USING ERRCODE = 'PT410';
  ELSIF inv.expires_at <= now() THEN
    RAISE EXCEPTION 'This invitation has expired' USING ERRCODE = 'PT410';
  END IF;
  IF inv.email <> caller_email THEN
    RAISE EXCEPTION 'This invitation was sent to a different email address than the one you are signed in with' USING ERRCODE = 'PT403';
  END IF;
  IF EXISTS (
       SELECT 1 FROM public.firm_memberships m
       WHERE m.firm_id = inv.firm_id AND m.user_id = auth.uid() AND public.membership_is_current(m.valid_from, m.valid_until)
     ) THEN
    RAISE EXCEPTION 'You are already a member of this firm' USING ERRCODE = 'PT409';
  END IF;
  INSERT INTO public.firm_memberships (firm_id, user_id, role, team_id) VALUES (inv.firm_id, auth.uid(), inv.role, inv.team_id);
  UPDATE public.firm_invitations i SET status = 'accepted', accepted_by = auth.uid(), accepted_at = now() WHERE i.id = inv.id;
  RETURN QUERY SELECT inv.firm_id, address, inv.role;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ask_to_join_firm(p_firm_address text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  uid uuid := auth.uid();
  f public.firms;
  ident record;
  prov text;
  org text;
  hit public.firm_organisations;
  made uuid;
BEGIN
  IF NOT public.is_signed_in_person() THEN
    RETURN 'none';
  END IF;
  -- A sign-in made with a password is vouched for by no provider.
  IF jsonb_path_exists(COALESCE(auth.jwt(), '{}'::jsonb), '$.amr[*] ? (@.method == "password")') THEN
    RETURN 'none';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = uid AND u.email_confirmed_at IS NOT NULL) THEN
    RETURN 'none';
  END IF;
  -- Nevermore's own people join a firm only by invitation (D-33): the role is read as the stamp on the firm's record reads it.
  IF EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = uid AND r.role = 'admin') THEN
    RETURN 'none';
  END IF;
  SELECT * INTO f FROM public.firms x WHERE x.address = lower(btrim(COALESCE(p_firm_address, ''))) AND x.decision IS DISTINCT FROM 'refused';
  IF NOT FOUND OR public.firm_is_suspended(f.id) OR public.firm_is_read_only(f.id) THEN
    RETURN 'none';
  END IF;
  -- A current member, a person suspended there, and anyone whose membership of this firm has ended.
  IF EXISTS (SELECT 1 FROM public.firm_memberships m
             WHERE m.firm_id = f.id AND m.user_id = uid AND (public.membership_is_current(m.valid_from, m.valid_until) OR m.valid_until <= now()))
     OR EXISTS (SELECT 1 FROM public.firm_member_suspensions s WHERE s.firm_id = f.id AND s.user_id = uid AND s.ended_at IS NULL) THEN
    RETURN 'none';
  END IF;
  IF EXISTS (SELECT 1 FROM public.join_requests r WHERE r.firm_id = f.id AND r.user_id = uid AND r.status = 'open') THEN
    RETURN 'asked';
  END IF;
  IF EXISTS (SELECT 1 FROM public.join_requests r WHERE r.firm_id = f.id AND r.user_id = uid AND r.status = 'declined') THEN
    RETURN 'none';
  END IF;
  FOR ident IN SELECT i.provider, i.identity_data FROM auth.identities i WHERE i.user_id = uid AND i.provider IN ('google', 'azure') ORDER BY i.created_at LOOP
    prov := CASE ident.provider WHEN 'google' THEN 'google' ELSE 'microsoft' END;
    org := public.identity_organisation(prov, ident.identity_data);
    CONTINUE WHEN org IS NULL;
    SELECT * INTO hit FROM public.firm_organisations o WHERE o.firm_id = f.id AND o.provider = prov AND o.org_id = org;
    CONTINUE WHEN NOT FOUND;
    INSERT INTO public.join_requests (firm_id, user_id, provider, org_id, org_label)
    VALUES (f.id, uid, prov, org, hit.label)
    ON CONFLICT (firm_id, user_id) WHERE status = 'open' DO NOTHING
    RETURNING id INTO made;
    IF made IS NOT NULL THEN
      PERFORM public.firm_activity_append(f.id, 'join_asked', 'firm', f.id::text, uid);
    END IF;
    RETURN 'asked';
  END LOOP;
  RETURN 'none';
END;
$function$;

CREATE OR REPLACE FUNCTION public.sign_up_firm(p_name text, p_address text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  fid uuid;
  clean_name text := btrim(COALESCE(p_name, ''));
  violated text;
BEGIN
  -- A signed-in person, not a guest, whose email the provider or the confirmation link has verified. Anyone else
  -- gets the same refusal, so the call tells nothing about which accounts exist.
  IF NOT public.is_signed_in_person() OR NOT EXISTS (
       SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'Sign in with a verified email to sign up a firm' USING ERRCODE = '42501';
  END IF;
  IF char_length(clean_name) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'A firm''s name is 1 to 80 characters' USING ERRCODE = '23514';
  END IF;
  -- One firm waiting at a time per person (D-30): nobody can hold addresses they have no use for, or fill the admin's
  -- list. The unique index firms_one_waiting_per_signer is the rule; this check only gives the usual message early.
  IF EXISTS (SELECT 1 FROM public.firms f WHERE f.signed_up_by = auth.uid() AND f.decision IS NULL) THEN
    RAISE EXCEPTION 'You already have a firm waiting for approval' USING ERRCODE = 'PT409';
  END IF;
  -- A closed firm's address is held for twelve months from the day it closed (CRM-P1.7). After that it is free: the old row is kept (its
  -- record stays) and gives the address up, so the new firm can take it. Inside the twelve months nothing changes and the insert below
  -- is refused as for any taken address.
  UPDATE public.firms f
  SET address = 'x' || replace(f.id::text, '-', '')
  WHERE f.address = lower(btrim(COALESCE(p_address, '')))
    AND EXISTS (SELECT 1 FROM public.firm_closures c WHERE c.firm_id = f.id AND c.closed_at IS NOT NULL AND c.closed_at + public.firm_address_hold() <= now());
  BEGIN
    INSERT INTO public.firms (name, address, signed_up_by) VALUES (clean_name, lower(btrim(p_address)), auth.uid()) RETURNING id INTO fid;
  EXCEPTION WHEN unique_violation THEN
    -- Two sign-ups from one person at the same moment both pass the check; the index refuses the second, which sees
    -- the same message as the check gives. Any other unique violation (a taken address) stays as it is.
    GET STACKED DIAGNOSTICS violated = CONSTRAINT_NAME;
    IF violated = 'firms_one_waiting_per_signer' THEN
      RAISE EXCEPTION 'You already have a firm waiting for approval' USING ERRCODE = 'PT409';
    END IF;
    RAISE;
  END;
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (fid, auth.uid(), 'owner');
  PERFORM public.record_firm_event(fid, 'firm_signed_up', auth.uid(), jsonb_build_object('address', lower(btrim(p_address))));
  RETURN fid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.plan_mail_move(p_message_id bigint, p_target bigint, p_actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
        AND NOT public.firm_is_suspended(f.firm_id)
    ) THEN
      RAISE EXCEPTION 'Advisor access required' USING ERRCODE = '42501';
    END IF;
    IF public.firm_is_read_only(msg.firm_id) THEN
      RAISE EXCEPTION 'This firm is closing and can''t be changed' USING ERRCODE = '55000';
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
    SELECT * INTO target FROM public.quote_requests WHERE id = p_target AND status <> 'closed';
    SELECT s.firm_id INTO target_firm FROM public.chamber_sessions s WHERE s.id = target.session_id;
    IF NOT FOUND OR (msg.firm_id IS NOT NULL AND msg.firm_id IS DISTINCT FROM target_firm) THEN
      RAISE EXCEPTION 'Quote request not found' USING ERRCODE = 'PT404';
    END IF;
    -- Mail held for a suspended firm stays held, and nothing is put onto a suspended firm's thread.
    IF public.firm_is_suspended(msg.firm_id) OR public.firm_is_suspended(target_firm) THEN
      RAISE EXCEPTION 'That firm is suspended' USING ERRCODE = '55000';
    END IF;
    -- Nor onto a closing or closed firm's thread, and mail held for one is not assigned away.
    IF public.firm_is_read_only(msg.firm_id) OR public.firm_is_read_only(target_firm) THEN
      RAISE EXCEPTION 'This firm is closing and can''t be changed' USING ERRCODE = '55000';
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
$function$;

CREATE OR REPLACE FUNCTION public.apply_mail_move(p_message_id bigint, p_target bigint, p_actor uuid, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
        AND NOT public.firm_is_suspended(f.firm_id)
    ) THEN
      RAISE EXCEPTION 'Advisor access required' USING ERRCODE = '42501';
    END IF;
    IF public.firm_is_read_only(msg.firm_id) THEN
      RAISE EXCEPTION 'This firm is closing and can''t be changed' USING ERRCODE = '55000';
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
    -- FOR UPDATE: a request being closed by another transaction is waited for, and the open check is read again afterwards, so the
    -- mail is never put on a request that closed between the check and this commit.
    SELECT * INTO target FROM public.quote_requests WHERE id = p_target AND status <> 'closed' FOR UPDATE;
    SELECT s.firm_id INTO target_firm FROM public.chamber_sessions s WHERE s.id = target.session_id;
    IF NOT FOUND OR (msg.firm_id IS NOT NULL AND msg.firm_id IS DISTINCT FROM target_firm) THEN
      RAISE EXCEPTION 'Quote request not found' USING ERRCODE = 'PT404';
    END IF;
    -- Mail held for a suspended firm stays held, and nothing is put onto a suspended firm's thread.
    IF public.firm_is_suspended(msg.firm_id) OR public.firm_is_suspended(target_firm) THEN
      RAISE EXCEPTION 'That firm is suspended' USING ERRCODE = '55000';
    END IF;
    -- Nor onto a closing or closed firm's thread, and mail held for one is not assigned away.
    IF public.firm_is_read_only(msg.firm_id) OR public.firm_is_read_only(target_firm) THEN
      RAISE EXCEPTION 'This firm is closing and can''t be changed' USING ERRCODE = '55000';
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
$function$;

CREATE OR REPLACE FUNCTION public.claim_outbox_events(p_kinds text[], p_batch integer, p_max_attempts integer, p_lock_seconds integer DEFAULT 600)
 RETURNS SETOF outbox_events
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.outbox_events e
  SET status = 'suppressed', last_error = left('suppressed: ' || s.reason, 200),
      claimed_at = NULL, locked_until = NULL, pending_send = NULL
  FROM public.email_suppressions s
  WHERE public.outbox_kind_reaches_prospect(e.kind)
    AND ((e.status = 'pending' AND e.next_attempt_at <= now()) OR (e.status = 'claimed' AND e.locked_until < now()))
    AND s.address = lower(btrim(e.payload ->> 'recipient_email'));

  -- A draft reminder whose reason has gone is not sent: its owner stopped reminders, or the draft no longer closes
  -- when it says (a change moved the closing time; certifying, archiving or expiry ended it).
  UPDATE public.outbox_events e
  SET status = 'suppressed',
      last_error = CASE WHEN p.draft_reminders_at IS NULL THEN 'cancelled: reminders turned off' ELSE 'cancelled: the draft changed' END,
      claimed_at = NULL, locked_until = NULL, pending_send = NULL
  FROM public.chamber_sessions s
  LEFT JOIN public.profiles p ON p.user_id = s.user_id
  WHERE e.kind = 'draft_expiry_reminder'
    AND ((e.status = 'pending' AND e.next_attempt_at <= now()) OR (e.status = 'claimed' AND e.locked_until < now()))
    AND s.id = e.session_id
    AND (p.draft_reminders_at IS NULL
         OR s.status <> 'in_progress'
         OR s.expires_at IS NULL
         OR to_char(s.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') IS DISTINCT FROM e.payload ->> 'expires_at');

  RETURN QUERY
  UPDATE public.outbox_events e
  SET status = 'claimed', attempts = e.attempts + 1, claimed_at = now(),
      locked_until = now() + make_interval(secs => p_lock_seconds)
  WHERE e.id IN (
    SELECT o.id
    FROM public.outbox_events o
    WHERE o.kind = ANY (p_kinds)
      AND o.attempts < p_max_attempts
      AND NOT (public.outbox_kind_is_firm_alert(o.kind)
               AND (public.firm_is_suspended(COALESCE(o.firm_id, (SELECT cs.firm_id FROM public.chamber_sessions cs WHERE cs.id = o.session_id)))
                   OR public.firm_is_closed(COALESCE(o.firm_id, (SELECT cs.firm_id FROM public.chamber_sessions cs WHERE cs.id = o.session_id)))))
      AND ((o.status = 'pending' AND o.next_attempt_at <= now()) OR (o.status = 'claimed' AND o.locked_until < now()))
    ORDER BY o.next_attempt_at, o.created_at
    LIMIT p_batch
    FOR UPDATE SKIP LOCKED
  )
  RETURNING e.*;
END;
$function$;

CREATE OR REPLACE FUNCTION public.firm_public_name(p_address text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT f.name
  FROM public.firms f
  WHERE f.address = lower(btrim(p_address)) AND f.decision IS DISTINCT FROM 'refused'
    AND NOT public.firm_is_closed(f.id)
$function$;

CREATE OR REPLACE FUNCTION public.address_admits_firm(p_firm_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  headers text := current_setting('request.headers', true);
  wanted text;
BEGIN
  IF headers IS NULL OR headers = '' THEN
    RETURN true;
  END IF;
  wanted := NULLIF(lower(btrim(headers::jsonb ->> 'x-firm-address')), '');
  IF wanted IS NULL THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.firms f
    WHERE f.id = p_firm_id
      AND f.address = wanted
      AND f.decision IS DISTINCT FROM 'refused'
      AND NOT public.firm_is_closed(f.id)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_member_of_firm_address(p_address text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.firms f
    JOIN public.firm_memberships m ON m.firm_id = f.id
    WHERE f.address = lower(btrim(p_address))
      AND f.decision IS DISTINCT FROM 'refused'
      AND NOT public.firm_is_closed(f.id)
      AND auth.uid() IS NOT NULL
      AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
      AND m.user_id = auth.uid()
      AND public.membership_is_current(m.valid_from, m.valid_until)
  )
$function$;

CREATE OR REPLACE FUNCTION public.my_suspended_firm_at_address(p_address text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE((
    SELECT public.firm_is_suspended(f.id) AND public.admin_belongs_to_firm(f.id)
    FROM public.firms f
    WHERE f.address = lower(btrim(p_address))
      AND f.decision IS DISTINCT FROM 'refused'
      AND NOT public.firm_is_closed(f.id)
      AND auth.uid() IS NOT NULL
      AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  ), false)
$function$;

-- 5. Notes on an intake: a table policy, not a function, lets a member add one (20261116110000), so the refusal is a trigger, which
-- also gives the plain message a policy can't. Insert only: no one changes or deletes a note by the API today.
CREATE FUNCTION public.refuse_note_on_closing_firm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.assert_firm_writable((SELECT s.firm_id FROM public.chamber_sessions s WHERE s.id = NEW.session_id));
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.refuse_note_on_closing_firm() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER advisor_notes_firm_not_closing BEFORE INSERT ON public.advisor_notes
  FOR EACH ROW EXECUTE FUNCTION public.refuse_note_on_closing_firm();

-- 6. A member's mailbox: connected, and used to send, only while a firm of the person's is open for change. 20261116230000's helper
-- (mailbox_store and mailbox_secret ask it) with one more condition. The mailbox itself is kept, so the person's mailbox works again
-- when the request is withdrawn; closing the firm deletes it with the person's last membership, as leaving does.
CREATE OR REPLACE FUNCTION public.person_is_member_of_a_firm_in_good_standing(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.firm_memberships f
    WHERE f.user_id = p_user_id AND public.membership_is_current(f.valid_from, f.valid_until)
      AND NOT public.firm_is_suspended(f.firm_id) AND NOT public.firm_is_read_only(f.firm_id))
$$;

-- 7. The email to a firm's owners when a request to close is made or withdrawn. It goes through the outbox like the leaving notice
-- (20261118090000): it belongs to the firm, not to an intake, and is a firm's alert, so it waits while the firm is suspended and a
-- bounce never suppresses an owner's address. One kind for both, with the event in the payload.
ALTER TABLE public.outbox_events DROP CONSTRAINT outbox_events_one_target;
ALTER TABLE public.outbox_events ADD CONSTRAINT outbox_events_one_target CHECK (
  CASE WHEN kind IN ('member_left', 'firm_closing') THEN session_id IS NULL AND firm_id IS NOT NULL ELSE session_id IS NOT NULL AND firm_id IS NULL END);

ALTER TABLE public.outbox_events DROP CONSTRAINT IF EXISTS outbox_events_kind_check;
ALTER TABLE public.outbox_events
  ADD CONSTRAINT outbox_events_kind_check CHECK (kind IN (
    -- sync:begin outbox_kinds
    'advisor_notification', 'prospect_confirmation', 'information_request', 'draft_expiry_reminder', 'peo_mail_arrived', 'member_left', 'firm_closing'
    -- sync:end outbox_kinds
  ));

CREATE OR REPLACE FUNCTION public.outbox_kind_is_firm_alert(p_kind text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$ SELECT p_kind IN ('advisor_notification', 'peo_mail_arrived', 'member_left', 'firm_closing') $$;

-- 8. What closing deletes, in one place. Every table registered in supabase/tests/data_isolation.sql as a firm's data is listed here,
-- either to be deleted when the firm closes (action 'delete', the column that holds the firm, and the order: a table that others
-- point at comes after them) or kept, with the reason. The closing reads this list and deletes exactly the tables it names, so a story
-- that adds a table adds one line here and nothing else; data_isolation.sql fails when a firm's table is in neither list.
-- Not yet existing, and added by the story that creates each (D-24): leads (CRM-L1.1), accounts (CRM-A1.1), contacts (CRM-A2.2 and
-- CRM-C1.1), opportunities (CRM-O1.1), activities and conversations with contacts and leads (CRM-X3.1 for custom fields and
-- CRM-E1.x for conversations), custom fields (CRM-X3.1) and imports (CRM-X4.1).
CREATE FUNCTION public.firm_closing_plan()
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
    (60, 'public.referral_partners', 'delete', 'firm_id', 'referral partners'),
    (70, 'public.firm_teams', 'delete', 'firm_id', 'teams (the memberships that named one are cleared first)'),
    -- Kept, and why.
    (900, 'public.firms', 'keep', NULL, 'the row stays: its address stays taken for twelve months and its record must still exist'),
    (900, 'public.firm_memberships', 'keep', NULL, 'every membership is ended, not deleted: a membership is the dated record of who belonged (it is never changed)'),
    (900, 'public.firm_member_suspensions', 'keep', NULL, 'each open one is ended; the rows are the dated record of who was suspended'),
    (900, 'public.firm_activity', 'keep', NULL, 'the firm''s own record is pruned after ninety days by its own job (D-45)'),
    (900, 'public.firm_suspensions', 'keep', NULL, 'the platform''s record of suspensions'),
    (900, 'public.firm_closures', 'keep', NULL, 'the platform''s record of this: when it was asked, by whom, when it closed, and what was deleted, without content'),
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

REVOKE ALL ON FUNCTION public.firm_closing_plan() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.firm_closing_plan() TO service_role;

-- 9. Closing ends every membership, and a firm keeps at least one owner (keep_firm_owner) and a membership is never changed
-- (keep_membership_history). Each keeps every rule it had, with one exception that exists only while close_firm_now runs for a firm
-- whose request is open and past its 30 days: the last owner's membership may end, and a membership may lose its team (teams are
-- deleted). Nothing else gets past: remove_member and leave_firm still refuse the last owner.
CREATE FUNCTION public.firm_is_being_closed(p_firm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(current_setting('nevermore.closing_firm', true), '') = p_firm_id::text
     AND EXISTS (SELECT 1 FROM public.firm_closures c
                 WHERE c.firm_id = p_firm_id AND c.withdrawn_at IS NULL AND c.closed_at IS NULL AND c.closes_at <= now())
$$;

REVOKE ALL ON FUNCTION public.firm_is_being_closed(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.firm_is_being_closed(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.keep_firm_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE r public.firm_memberships;
BEGIN
  r := CASE WHEN TG_OP = 'INSERT' THEN NEW ELSE OLD END;
  IF r.role <> 'owner' THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'INSERT' AND (r.valid_until IS NULL OR NOT public.membership_is_current(least(r.valid_from, now()), r.valid_until)) THEN
    RETURN NULL;
  END IF;
  IF TG_OP <> 'INSERT' AND NOT public.membership_is_current(r.valid_from, r.valid_until) THEN
    RETURN NULL;
  END IF;
  -- Closing a firm ends its last owner too (CRM-P1.7), and only that.
  IF public.firm_is_being_closed(r.firm_id) THEN
    RETURN NULL;
  END IF;
  PERFORM 1 FROM public.firms WHERE id = r.firm_id FOR NO KEY UPDATE;
  IF NOT EXISTS (
       SELECT 1 FROM public.firm_memberships m
       WHERE m.firm_id = r.firm_id AND m.role = 'owner' AND m.id <> r.id
         AND m.valid_until IS NULL AND public.membership_is_current(m.valid_from, m.valid_until)
     ) THEN
    RAISE EXCEPTION 'A firm keeps at least one current owner' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.keep_membership_history()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Closing a firm deletes its teams, so a membership may lose its team and nothing else (CRM-P1.7).
  IF NEW.team_id IS NULL AND OLD.team_id IS NOT NULL AND public.firm_is_being_closed(OLD.firm_id)
     AND (NEW.id, NEW.firm_id, NEW.user_id, NEW.role, NEW.valid_from, NEW.valid_until)
         IS NOT DISTINCT FROM (OLD.id, OLD.firm_id, OLD.user_id, OLD.role, OLD.valid_from, OLD.valid_until) THEN
    RETURN NEW;
  END IF;
  IF (NEW.id, NEW.firm_id, NEW.user_id, NEW.role, NEW.team_id, NEW.valid_from)
     IS DISTINCT FROM (OLD.id, OLD.firm_id, OLD.user_id, OLD.role, OLD.team_id, OLD.valid_from)
     OR (OLD.valid_until IS NOT NULL
         AND NOT (NEW.valid_until IS NOT NULL AND NEW.valid_until <= OLD.valid_until AND NEW.valid_until >= now())) THEN
    RAISE EXCEPTION 'A membership is never changed: end it and add another' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

-- 10. Asking to close. A current owner of the firm, at its address (firm_role: signed in, past the second factor, not suspended), and
-- only after typing the firm's name. A refused firm can't ask (it already behaves as no firm, D-31); a firm waiting for approval can:
-- it is theirs. The request, the entry in the firm's record and the email to the owners are one step.
CREATE FUNCTION public.request_firm_closure(p_firm_id uuid, p_firm_name text)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  f public.firms;
  c public.firm_closures;
BEGIN
  IF public.firm_role(p_firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can do that' USING ERRCODE = '42501';
  END IF;
  -- The firm's row lock orders this against withdrawing and closing, as inviting does.
  SELECT * INTO f FROM public.firms x WHERE x.id = p_firm_id FOR NO KEY UPDATE;
  IF NOT FOUND OR f.decision = 'refused' THEN
    RAISE EXCEPTION 'Only an owner of the firm can do that' USING ERRCODE = '42501';
  END IF;
  IF lower(btrim(COALESCE(p_firm_name, ''))) <> lower(btrim(f.name)) THEN
    RAISE EXCEPTION 'Type the firm''s name exactly to confirm' USING ERRCODE = '22023';
  END IF;
  BEGIN
    INSERT INTO public.firm_closures (firm_id, asked_by, closes_at)
    VALUES (p_firm_id, auth.uid(), now() + public.firm_closing_period())
    RETURNING * INTO c;
  EXCEPTION WHEN unique_violation THEN
    -- The unique index firm_closures_one_open is the rule (D-29); this only gives its usual message.
    RAISE EXCEPTION 'This firm is already closing' USING ERRCODE = 'PT409';
  END;
  PERFORM public.firm_activity_append(p_firm_id, 'closure_asked', 'firm', p_firm_id::text);
  INSERT INTO public.outbox_events (kind, firm_id, dedupe_key, payload)
  SELECT 'firm_closing', p_firm_id, 'firm_closing:asked:' || c.id,
         jsonb_build_object('event', 'asked', 'by_email', lower(btrim(u.email)), 'firm_name', f.name,
                            'closes_at', to_char(c.closes_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
  FROM auth.users u WHERE u.id = auth.uid()
  ON CONFLICT (kind, dedupe_key) DO NOTHING;
  RETURN c.closes_at;
END;
$$;

REVOKE ALL ON FUNCTION public.request_firm_closure(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_firm_closure(uuid, text) TO authenticated;

-- 11. Withdrawing. Any current owner of the firm, at any time before the 30 days end. The firm is then as it was: nothing was
-- deleted, and the record keeps that it was asked and withdrawn. A suspended firm's owners get nothing (firm_role), so they can't.
CREATE FUNCTION public.withdraw_firm_closure(p_firm_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  f public.firms;
  c public.firm_closures;
BEGIN
  IF public.firm_role(p_firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can do that' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO f FROM public.firms x WHERE x.id = p_firm_id FOR NO KEY UPDATE;
  -- One statement closes the open row: two withdrawals at once see the second find nothing, and a firm the job is closing is not
  -- withdrawn from under it.
  UPDATE public.firm_closures x SET withdrawn_at = now(), withdrawn_by = auth.uid()
  WHERE x.firm_id = p_firm_id AND x.withdrawn_at IS NULL AND x.closed_at IS NULL AND x.closes_at > now()
  RETURNING * INTO c;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This firm is not waiting to close' USING ERRCODE = 'PT409';
  END IF;
  PERFORM public.firm_activity_append(p_firm_id, 'closure_withdrawn', 'firm', p_firm_id::text);
  INSERT INTO public.outbox_events (kind, firm_id, dedupe_key, payload)
  SELECT 'firm_closing', p_firm_id, 'firm_closing:withdrawn:' || c.id,
         jsonb_build_object('event', 'withdrawn', 'by_email', lower(btrim(u.email)), 'firm_name', f.name)
  FROM auth.users u WHERE u.id = auth.uid()
  ON CONFLICT (kind, dedupe_key) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.withdraw_firm_closure(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_firm_closure(uuid) TO authenticated;

-- 12. What a member's banner needs: when the firm closes, only for a current member of a firm with an open request (firm_role, so
-- nothing for a suspended firm's members and nothing for anyone else).
CREATE FUNCTION public.my_firm_closure(p_firm_id uuid)
RETURNS TABLE (asked_at timestamptz, closes_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT c.asked_at, c.closes_at
  FROM public.firm_closures c
  WHERE c.firm_id = p_firm_id AND c.withdrawn_at IS NULL AND c.closed_at IS NULL
    AND public.firm_role(p_firm_id) IS NOT NULL
$$;

REVOKE ALL ON FUNCTION public.my_firm_closure(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_firm_closure(uuid) TO authenticated;

-- 13. Closing. Service role only, so the daily job runs it and the SQL test calls it with the time moved. For one firm whose open
-- request has passed its 30 days, in one transaction: clear the teams off the memberships, delete what firm_closing_plan() says to
-- delete, end every membership (current ones now, one dated for later never starts) with the one ending mechanism, end the open
-- member suspensions, and write the platform's record with a count per table. The mailbox of a person whose last membership this was
-- goes with it (the trigger on a membership's end). Returns the counts.
CREATE FUNCTION public.close_firm_now(p_firm_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c public.firm_closures;
  step record;
  m record;
  counts jsonb := '{}'::jsonb;
  n integer;
  ended integer := 0;
  boxes_before integer;
  boxes_after integer;
BEGIN
  PERFORM 1 FROM public.firms f WHERE f.id = p_firm_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That firm does not exist' USING ERRCODE = 'PT404';
  END IF;
  SELECT * INTO c FROM public.firm_closures x WHERE x.firm_id = p_firm_id AND x.withdrawn_at IS NULL AND x.closed_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That firm has no request to close' USING ERRCODE = 'PT404';
  END IF;
  IF c.closes_at > now() THEN
    RAISE EXCEPTION 'The 30 days have not ended' USING ERRCODE = '55000';
  END IF;
  PERFORM set_config('nevermore.closing_firm', p_firm_id::text, true);

  SELECT count(*) INTO boxes_before FROM public.broker_mailboxes b
  WHERE b.user_id IN (SELECT x.user_id FROM public.firm_memberships x WHERE x.firm_id = p_firm_id);

  UPDATE public.firm_memberships x SET team_id = NULL WHERE x.firm_id = p_firm_id AND x.team_id IS NOT NULL;
  UPDATE public.firm_member_suspensions x SET team_id = NULL WHERE x.firm_id = p_firm_id AND x.team_id IS NOT NULL;

  FOR step IN SELECT p.src, p.firm_column FROM public.firm_closing_plan() p WHERE p.action = 'delete' ORDER BY p.ord, p.src LOOP
    EXECUTE format('DELETE FROM public.%I WHERE %I = $1', substr(step.src, length('public.') + 1), step.firm_column) USING p_firm_id;
    GET DIAGNOSTICS n = ROW_COUNT;
    counts := counts || jsonb_build_object(substr(step.src, length('public.') + 1), n);
  END LOOP;

  -- Every member's access ends. The ending is the one every other path uses (end_membership_now); the last owner's rule is waived
  -- for this firm and this moment only (keep_firm_owner).
  FOR m IN
    SELECT x.id, x.valid_from, public.membership_is_current(x.valid_from, x.valid_until) AS is_current
    FROM public.firm_memberships x
    WHERE x.firm_id = p_firm_id AND (x.valid_until IS NULL OR x.valid_until > now())
    ORDER BY x.id
  LOOP
    IF m.is_current THEN
      PERFORM public.end_membership_now(m.id, 'The last owner of a firm can''t be removed');
    ELSE
      PERFORM set_config('nevermore.membership_change', 'on', true);
      UPDATE public.firm_memberships x SET valid_until = x.valid_from WHERE x.id = m.id;
      PERFORM set_config('nevermore.membership_change', 'off', true);
    END IF;
    ended := ended + 1;
  END LOOP;
  counts := counts || jsonb_build_object('memberships_ended', ended);

  UPDATE public.firm_member_suspensions x SET ended_at = now(), ended_how = 'removed' WHERE x.firm_id = p_firm_id AND x.ended_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  counts := counts || jsonb_build_object('member_suspensions_ended', n);

  SELECT count(*) INTO boxes_after FROM public.broker_mailboxes b
  WHERE b.user_id IN (SELECT x.user_id FROM public.firm_memberships x WHERE x.firm_id = p_firm_id);
  counts := counts || jsonb_build_object('broker_mailboxes', boxes_before - boxes_after);

  UPDATE public.firm_closures x
  SET closed_at = now(), deleted_counts = counts, address = (SELECT f.address FROM public.firms f WHERE f.id = p_firm_id)
  WHERE x.id = c.id;
  PERFORM set_config('nevermore.closing_firm', '', true);
  RETURN counts;
END;
$$;

REVOKE ALL ON FUNCTION public.close_firm_now(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_firm_now(uuid) TO service_role;

-- 14. The daily job's step: close every firm whose request is due. A firm that fails does not stop the others and is tried again the
-- next day; the failure is a warning in the database's log.
CREATE FUNCTION public.close_due_firms()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  due record;
  closed integer := 0;
BEGIN
  FOR due IN
    SELECT x.firm_id FROM public.firm_closures x
    WHERE x.withdrawn_at IS NULL AND x.closed_at IS NULL AND x.closes_at <= now()
    ORDER BY x.closes_at, x.id
  LOOP
    BEGIN
      PERFORM public.close_firm_now(due.firm_id);
      closed := closed + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'closing firm % failed (%): %', due.firm_id, SQLSTATE, SQLERRM;
    END;
  END LOOP;
  RETURN closed;
END;
$$;

REVOKE ALL ON FUNCTION public.close_due_firms() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_due_firms() TO service_role;

-- The firm record's daily job (20261116160001, 20261118090500) also runs it: no second scheduler. Where the job does not exist (no
-- pg_cron) this does nothing and says so; run all three functions every day another way.
DO $$
BEGIN
  IF to_regprocedure('cron.schedule(text,text,text)') IS NULL OR NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-firm-activity') THEN
    RAISE NOTICE 'closing firms: the prune-firm-activity job does not exist; run public.close_due_firms() every day another way';
    RETURN;
  END IF;
  PERFORM cron.schedule('prune-firm-activity', '53 3 * * *',
    'select public.prune_firm_activity(); select public.prune_firm_outbox_events(); select public.close_due_firms();');
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'closing firms: could not add it to the daily job (%); run public.close_due_firms() every day another way', SQLERRM;
END $$;

-- 15. The platform's page: every firm with its state, now also whether it is closing or closed (20261116230000's function, with
-- columns added, so it is dropped and made again). The record is the platform's: when it was asked and by whom, when it closed, and
-- a count per table of what was deleted, with no names and no content. A closed firm is shown at the address it held.
DROP FUNCTION public.admin_firm_states();
CREATE FUNCTION public.admin_firm_states()
RETURNS TABLE (firm_id uuid, name text, address text, state text, signed_up_at timestamptz,
               suspended boolean, suspended_at timestamptz, suspension_reason text,
               closing_on timestamptz, closed_on timestamptz, closure_asked_at timestamptz, closure_asked_by uuid,
               closure_deleted jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT f.id, f.name, COALESCE(k.address, f.address),
         CASE WHEN f.decision IS NOT NULL THEN f.decision WHEN f.approved_at IS NOT NULL THEN 'approved' ELSE 'waiting' END,
         f.created_at, o.id IS NOT NULL, o.suspended_at, o.reason,
         CASE WHEN k.closed_at IS NULL THEN k.closes_at END, k.closed_at, k.asked_at, k.asked_by, k.deleted_counts
  FROM public.firms f
  LEFT JOIN public.firm_suspensions o ON o.firm_id = f.id AND o.lifted_at IS NULL
  LEFT JOIN public.firm_closures k ON k.firm_id = f.id AND k.withdrawn_at IS NULL
  ORDER BY lower(f.name), f.id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_firm_states() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_firm_states() TO authenticated;
