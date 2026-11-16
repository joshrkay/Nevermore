-- A broker starts an intake for a client (slice 5.3, P-2.2 and P-2.4; docs/BROKER_CRM_BUILD.md D-1703, D-1710, D-1711, D-1712, D-1750..D-1759; ADR 0025).
-- Built test-first, one behaviour at a time (TDD_LOG.md); each section below was written to pass the test of the same number in supabase/tests/broker_intake.sql.

-- ---------- 1. Starting an intake on an opportunity ----------
-- A broker-started intake has no employer user until an invitee accepts (D-1703): chamber_sessions.user_id may now be empty, and started_by says which member of
-- the firm started it. Row security reads user_id (auth.uid() = user_id), which an empty value never equals, so nobody reads or writes such an intake as its
-- owner; the firm's members read it as they read every intake of the firm (the existing firm policy).
ALTER TABLE public.chamber_sessions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.chamber_sessions ADD COLUMN started_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

-- started_by is the server's word, never the browser's: the browser's roles can neither set it on a new intake nor change it on an existing one. A statement run inside
-- a SECURITY DEFINER function runs as the function's owner, so this reads current_user (as keep_server_intake_columns does), not the role the API set.
-- Named to sort before chamber_sessions_firm, which lets a broker-started intake keep the firm its starter chose (below).
CREATE FUNCTION public.keep_intake_started_by()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.started_by := NULL;
    ELSE
      NEW.started_by := OLD.started_by;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.keep_intake_started_by() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER chamber_sessions_a_started_by BEFORE INSERT OR UPDATE ON public.chamber_sessions
  FOR EACH ROW EXECUTE FUNCTION public.keep_intake_started_by();

-- Restated: public.keep_intake_firm(), from 20261123110000_firm_link.sql (the newest definition on the base). Every line is kept, and one branch is added: an intake
-- a member of a firm started on the firm's own opportunity (started_by) is in the firm that function chose.
CREATE OR REPLACE FUNCTION public.keep_intake_firm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_address text;
  v_firm uuid;
BEGIN
  -- The service role and the superuser place an intake where they like. SECURITY DEFINER runs as the owner, so the caller's role is read
  -- from the role setting the API sets (SET LOCAL ROLE), which stays the caller's.
  IF current_setting('role', true) NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  -- A broker's start (start_broker_intake) names the firm itself: the opportunity's, which the caller is a member of.
  IF TG_OP = 'INSERT' AND NEW.started_by IS NOT NULL AND NEW.firm_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    -- The address as address_admits_firm() reads it (20261118110000): a header that isn't JSON raises, so such a request is refused.
    v_address := NULLIF(lower(btrim(NULLIF(current_setting('request.headers', true), '')::jsonb ->> 'x-firm-address')), '');
    IF v_address IS NULL THEN
      NEW.firm_id := public.default_firm_id();
    ELSE
      v_firm := public.firm_for_intake_link(v_address);
      -- A link that names no firm, or a firm that takes no intakes, starts nothing, and is never filed in the default firm instead (D-1741).
      IF v_firm IS NULL THEN
        RAISE EXCEPTION 'This link doesn''t start an intake' USING ERRCODE = 'PT404';
      END IF;
      NEW.firm_id := v_firm;
    END IF;
  ELSE
    NEW.firm_id := OLD.firm_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.keep_intake_firm() FROM PUBLIC, anon, authenticated;

-- Starts the intake of an opportunity (P-2.2, ADR 0025): an intake in the caller's firm with no employer user, linked to the opportunity in the same step.
-- Answers {intake_id}.
CREATE FUNCTION public.start_broker_intake(p_opportunity_id uuid, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  o public.opportunities;
  a public.accounts;
  made uuid;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  SELECT * INTO a FROM public.accounts x WHERE x.id = (SELECT p.account_id FROM public.opportunities p WHERE p.id = p_opportunity_id AND p.firm_id = firm) FOR SHARE;
  SELECT * INTO o FROM public.opportunities x WHERE x.id = p_opportunity_id AND x.firm_id = firm FOR UPDATE;
  IF o.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RAISE EXCEPTION 'That opportunity isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF a.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'This account is archived. Nothing can be added to it.' USING ERRCODE = '55000';
  END IF;
  IF o.intake_id IS NOT NULL THEN
    RAISE EXCEPTION 'This opportunity already has an intake' USING ERRCODE = 'PT409';
  END IF;
  INSERT INTO public.chamber_sessions (user_id, firm_id, started_by, chamber_data) VALUES (NULL, firm, auth.uid(), '{}'::jsonb) RETURNING id INTO made;
  UPDATE public.opportunities SET intake_id = made WHERE id = o.id;
  RETURN jsonb_build_object('intake_id', made);
END;
$$;

REVOKE ALL ON FUNCTION public.start_broker_intake(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_broker_intake(uuid, uuid) TO authenticated;

-- ---------- 2. Finding a broker-started intake ----------
-- The broker-started intake a member of its firm is working on, locked for the caller's write, or the one answer an outsider and a missing intake share (PT404): the id of an intake of
-- another firm, of an employer's own intake (no one started it as a member) and of one that is not there are told apart by nothing. Internal: no API role calls it.
CREATE FUNCTION public.broker_intake_for_member(p_intake_id uuid)
RETURNS public.chamber_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  i public.chamber_sessions;
BEGIN
  SELECT * INTO i FROM public.chamber_sessions s WHERE s.id = p_intake_id FOR UPDATE;
  IF i.id IS NULL OR i.started_by IS NULL OR NOT public.is_firm_member(i.firm_id) THEN
    RAISE EXCEPTION 'That intake isn''t available' USING ERRCODE = 'PT404';
  END IF;
  RETURN i;
END;
$$;

REVOKE ALL ON FUNCTION public.broker_intake_for_member(uuid) FROM PUBLIC, anon, authenticated;


-- ---------- 3. The database reads a broker entry as a source ----------
-- Restated: public.provenance_source_is_valid(), from 20261104103000_required_items.sql (the newest definition on the base). Every line is kept, and one kind is added:
-- "broker_entry", the member who entered the answer (a user id), with, when it was told to Lenore, the message it was said in and a quote of it, as a transcript source has.
-- src/data/provenance.ts (sourceSchema) keeps the same entries; src/data/requiredItems.cases.json holds both to it.
CREATE OR REPLACE FUNCTION public.provenance_source_is_valid(p_source jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(jsonb_typeof(p_source) = 'object' AND CASE p_source ->> 'kind'
    WHEN 'transcript' THEN
      jsonb_typeof(p_source -> 'message_id') = 'string' AND p_source ->> 'message_id' <> ''
      AND (NOT p_source ? 'quote' OR (
        jsonb_typeof(p_source -> 'quote') = 'string'
        AND char_length(p_source ->> 'quote')
          + char_length(regexp_replace(p_source ->> 'quote', '[^\U00010000-\U0010FFFF]', '', 'g')) <= 200))
    WHEN 'document' THEN
      jsonb_typeof(p_source -> 'document_id') = 'string' AND p_source ->> 'document_id' <> ''
      AND (NOT p_source ? 'document_name' OR jsonb_typeof(p_source -> 'document_name') = 'string')
      AND (NOT p_source ? 'location' OR jsonb_typeof(p_source -> 'location') = 'string')
    WHEN 'prospect_edit' THEN true
    WHEN 'broker_entry' THEN
      jsonb_typeof(p_source -> 'member_id') = 'string' AND p_source ->> 'member_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND (NOT p_source ? 'message_id' OR (jsonb_typeof(p_source -> 'message_id') = 'string' AND p_source ->> 'message_id' <> ''))
      AND (NOT p_source ? 'quote' OR (
        jsonb_typeof(p_source -> 'quote') = 'string'
        AND char_length(p_source ->> 'quote')
          + char_length(regexp_replace(p_source ->> 'quote', '[^\U00010000-\U0010FFFF]', '', 'g')) <= 200))
    ELSE false
  END, false);
$$;

-- ---------- 4. The invitation to finish and certify ----------
-- One row for each link sent (D-1711): the invitation of a broker-started intake to its employer. The link is single-use and lasts 14 days, and is kept only as the SHA-256 of its token (the
-- token is made by the server function that emails it, as a member invitation's is). Remind makes a new row and marks the old one replaced, so a replaced link says so; invited_at (the
-- first invitation's time) and last_opened_at carry over to the new row. Nobody reads or writes the table through the API: the functions below are the only way in, and none returns the hash.
CREATE TABLE public.intake_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  intake_id uuid NOT NULL,
  -- Lower case, without surrounding spaces; the mail sender's own rule, as firm_invitations has it.
  email text NOT NULL CHECK (email = lower(btrim(email)) AND char_length(email) <= 254 AND email ~ '^[^[:space:]@<>,;"()\[\]\\]+@[^[:space:]@<>,;"()\[\]\\]+\.[^[:space:]@<>,;"()\[\]\\]+$'),
  contact_name text CHECK (contact_name IS NULL OR (btrim(contact_name) <> '' AND char_length(contact_name) <= 200)),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  invited_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- When the client was first invited: the same on every link Remind makes.
  invited_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  -- When the client last opened a link of this intake's invitation.
  last_opened_at timestamptz,
  send_count integer NOT NULL DEFAULT 1 CHECK (send_count >= 1),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'replaced', 'withdrawn')),
  accepted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  accepted_at timestamptz,
  replaced_at timestamptz,
  -- How the email of this link fared: 'sent', 'failed' or 'unknown' (as firm_invitations), with a short kind of failure.
  email_outcome text CHECK (email_outcome IN ('sent', 'failed', 'unknown')),
  email_sent_at timestamptz,
  email_error text CHECK (char_length(email_error) <= 40),
  FOREIGN KEY (intake_id, firm_id) REFERENCES public.chamber_sessions (id, firm_id) ON DELETE CASCADE,
  CONSTRAINT intake_invitations_lasts CHECK (expires_at > created_at),
  CONSTRAINT intake_invitations_accepted_is_whole CHECK ((status = 'accepted') = (accepted_at IS NOT NULL))
);

-- At most one link works at a time for an intake: the constraint is the rule, the checks in the functions only give the usual message early.
CREATE UNIQUE INDEX intake_invitations_one_pending ON public.intake_invitations (intake_id) WHERE status = 'pending';
CREATE INDEX intake_invitations_by_firm ON public.intake_invitations (firm_id);

ALTER TABLE public.intake_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.intake_invitations FROM PUBLIC, anon, authenticated;

-- Invites the client of a broker-started intake to finish and certify it. The token is made by the server function that sends the email; the database is given its hash. Answers the
-- invitation and what the email needs.
CREATE FUNCTION public.invite_intake_client(p_intake_id uuid, p_email text, p_contact_name text, p_token_hash text)
RETURNS TABLE (invitation_id uuid, email text, contact_name text, firm_name text, firm_address text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  i public.chamber_sessions;
  f public.firms;
  inv public.intake_invitations;
  violated text;
BEGIN
  i := public.broker_intake_for_member(p_intake_id);
  PERFORM public.assert_firm_writable(i.firm_id);
  IF i.status IS DISTINCT FROM 'in_progress' THEN
    RAISE EXCEPTION 'This intake is closed' USING ERRCODE = '55000';
  END IF;
  IF i.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'This intake already belongs to its employer' USING ERRCODE = '55000';
  END IF;
  SELECT * INTO f FROM public.firms x WHERE x.id = i.firm_id;
  -- An address that could never be emailed (the same rule as the table's check) is refused in words, before anything is made.
  IF lower(btrim(COALESCE(p_email, ''))) !~ '^[^[:space:]@<>,;"()\[\]\\]+@[^[:space:]@<>,;"()\[\]\\]+\.[^[:space:]@<>,;"()\[\]\\]+$' OR char_length(btrim(p_email)) > 254 THEN
    RAISE EXCEPTION 'Check the email address' USING ERRCODE = '22023';
  END IF;
  BEGIN
    INSERT INTO public.intake_invitations (firm_id, intake_id, email, contact_name, token_hash, invited_by, expires_at)
    VALUES (i.firm_id, i.id, lower(btrim(p_email)), NULLIF(btrim(p_contact_name), ''), p_token_hash, auth.uid(), now() + interval '14 days')
    RETURNING * INTO inv;
  EXCEPTION WHEN unique_violation THEN
    -- The unique index intake_invitations_one_pending is the rule; this only gives its usual message. Any other unique violation (a token hash used twice) stays as it is.
    GET STACKED DIAGNOSTICS violated = CONSTRAINT_NAME;
    IF violated = 'intake_invitations_one_pending' THEN
      RAISE EXCEPTION 'This intake already has an invitation waiting. Remind them instead.' USING ERRCODE = 'PT409';
    END IF;
    RAISE;
  END;
  RETURN QUERY SELECT inv.id, inv.email, inv.contact_name, f.name, f.address, inv.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.invite_intake_client(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_intake_client(uuid, text, text, text) TO authenticated;

-- Remind: sends the client a fresh link and revokes the old one (D-1711). The old row is marked replaced (a replaced link says so when it is opened), the new row is waiting for 14 days from now,
-- and invited_at, last_opened_at and the count of sends carry over. The token is made by the server function that emails it; the database is given its hash.
CREATE FUNCTION public.remind_intake_invite(p_intake_id uuid, p_token_hash text)
RETURNS TABLE (invitation_id uuid, email text, contact_name text, firm_name text, firm_address text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  i public.chamber_sessions;
  f public.firms;
  old public.intake_invitations;
  inv public.intake_invitations;
BEGIN
  i := public.broker_intake_for_member(p_intake_id);
  PERFORM public.assert_firm_writable(i.firm_id);
  IF i.status IS DISTINCT FROM 'in_progress' THEN
    RAISE EXCEPTION 'This intake is closed' USING ERRCODE = '55000';
  END IF;
  SELECT * INTO f FROM public.firms x WHERE x.id = i.firm_id;
  SELECT * INTO old FROM public.intake_invitations v WHERE v.intake_id = i.id AND v.status = 'pending' FOR UPDATE;
  IF old.id IS NULL THEN
    RAISE EXCEPTION 'There is no invitation waiting to remind' USING ERRCODE = 'PT404';
  END IF;
  UPDATE public.intake_invitations v SET status = 'replaced', replaced_at = now() WHERE v.id = old.id;
  INSERT INTO public.intake_invitations (firm_id, intake_id, email, contact_name, token_hash, invited_by, invited_at, last_opened_at, send_count, expires_at)
  VALUES (old.firm_id, old.intake_id, old.email, old.contact_name, p_token_hash, auth.uid(), old.invited_at, old.last_opened_at, old.send_count + 1, now() + interval '14 days')
  RETURNING * INTO inv;
  RETURN QUERY SELECT inv.id, inv.email, inv.contact_name, f.name, f.address, inv.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.remind_intake_invite(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remind_intake_invite(uuid, text) TO authenticated;

-- Opening the link (D-1711): what the page shows a visitor, signed in or not, before it asks them to sign up or in: the firm's name, who the invitation is for and when it ends,
-- and nothing else (never the address it was sent to). Opening it is recorded as the invitation's last_opened_at, which the broker's step 3 shows. The link's token is never given to the
-- database, only its hash; a hash that is no link, and a link opened at another firm's address, are refused alike (see the tests for the rest).
CREATE FUNCTION public.peek_intake_invite(p_token_hash text, p_firm_address text)
RETURNS TABLE (firm_name text, contact_name text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  inv public.intake_invitations;
  f public.firms;
BEGIN
  SELECT * INTO inv FROM public.intake_invitations v WHERE v.token_hash = p_token_hash FOR UPDATE;
  IF inv.id IS NULL THEN
    RAISE EXCEPTION 'This invitation link is not valid' USING ERRCODE = 'PT404';
  END IF;
  SELECT * INTO f FROM public.firms x WHERE x.id = inv.firm_id;
  IF f.address IS DISTINCT FROM lower(btrim(COALESCE(p_firm_address, ''))) THEN
    RAISE EXCEPTION 'This invitation belongs to another firm''s address' USING ERRCODE = 'PT422';
  END IF;
  IF inv.status = 'replaced' THEN
    RAISE EXCEPTION 'This link was replaced by a newer one. Use the latest email.' USING ERRCODE = 'PT410';
  ELSIF inv.status = 'withdrawn' THEN
    RAISE EXCEPTION 'This invitation was withdrawn' USING ERRCODE = 'PT410';
  ELSIF inv.status = 'accepted' THEN
    RAISE EXCEPTION 'This invitation has already been used' USING ERRCODE = 'PT410';
  ELSIF inv.expires_at <= now() THEN
    RAISE EXCEPTION 'This invitation has expired' USING ERRCODE = 'PT410';
  END IF;
  UPDATE public.intake_invitations v SET last_opened_at = now() WHERE v.id = inv.id;
  RETURN QUERY SELECT f.name, inv.contact_name, inv.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.peek_intake_invite(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peek_intake_invite(text, text) TO anon, authenticated;

-- Accepting (D-1703, D-1711): the person signed in with the address the link was sent to opens it, and the intake becomes theirs: they are its user, the invitation is used. Answers
-- {intake_id, firm_address}. Bound to the firm's own address, as a member invitation is (D-34): it is checked first, so a link opened at another firm's address learns nothing.
CREATE FUNCTION public.accept_intake_invite(p_token_hash text, p_firm_address text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  inv public.intake_invitations;
  f public.firms;
  caller_email text;
BEGIN
  SELECT lower(btrim(u.email)) INTO caller_email FROM auth.users u WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL;
  IF NOT public.is_signed_in_person() OR caller_email IS NULL THEN
    RAISE EXCEPTION 'Sign in with a verified email to accept an invitation' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO inv FROM public.intake_invitations v WHERE v.token_hash = p_token_hash FOR UPDATE;
  IF inv.id IS NULL THEN
    RAISE EXCEPTION 'This invitation link is not valid' USING ERRCODE = 'PT404';
  END IF;
  SELECT * INTO f FROM public.firms x WHERE x.id = inv.firm_id;
  IF f.address IS DISTINCT FROM lower(btrim(COALESCE(p_firm_address, ''))) THEN
    RAISE EXCEPTION 'This invitation belongs to another firm''s address' USING ERRCODE = 'PT422';
  END IF;
  IF inv.status = 'replaced' THEN
    RAISE EXCEPTION 'This link was replaced by a newer one. Use the latest email.' USING ERRCODE = 'PT410';
  ELSIF inv.status = 'withdrawn' THEN
    RAISE EXCEPTION 'This invitation was withdrawn' USING ERRCODE = 'PT410';
  ELSIF inv.status = 'accepted' THEN
    RAISE EXCEPTION 'This invitation has already been used' USING ERRCODE = 'PT410';
  ELSIF inv.expires_at <= now() THEN
    RAISE EXCEPTION 'This invitation has expired' USING ERRCODE = 'PT410';
  END IF;
  IF inv.email <> caller_email THEN
    RAISE EXCEPTION 'This invitation was sent to a different email address than the one you are signed in with' USING ERRCODE = 'PT403';
  END IF;
  -- The employer owns the answers (D-1703): a person who belongs to the firm can't be the one the intake becomes. is_firm_member also reads the firm's address and a second factor, so
  -- the membership itself is read from the dated memberships.
  IF EXISTS (SELECT 1 FROM public.firm_memberships m WHERE m.firm_id = inv.firm_id AND m.user_id = auth.uid() AND public.membership_is_current(m.valid_from, m.valid_until)) THEN
    RAISE EXCEPTION 'A member of the firm can''t take the employer''s place' USING ERRCODE = 'PT403';
  END IF;
  -- A person keeps one open intake (refuse_second_open_draft, 20261104102000, which guards inserts only, so it can't see this update): the same lock and the same question. They
  -- finish or archive the one they have, and the link, still waiting, then works.
  PERFORM pg_advisory_xact_lock(hashtextextended('chamber_sessions open draft ' || auth.uid()::text, 0));
  IF EXISTS (SELECT 1 FROM public.chamber_sessions s WHERE s.user_id = auth.uid() AND s.status = 'in_progress' AND NOT EXISTS (SELECT 1 FROM public.chamber_certifications c WHERE c.session_id = s.id)) THEN
    RAISE EXCEPTION 'You already have an intake in progress' USING ERRCODE = 'PT409';
  END IF;
  UPDATE public.chamber_sessions SET user_id = auth.uid() WHERE id = inv.intake_id;
  UPDATE public.intake_invitations v SET status = 'accepted', accepted_by = auth.uid(), accepted_at = now() WHERE v.id = inv.id;
  RETURN jsonb_build_object('intake_id', inv.intake_id, 'firm_address', f.address);
END;
$$;

REVOKE ALL ON FUNCTION public.accept_intake_invite(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_intake_invite(text, text) TO authenticated;

-- Where an intake's invitation stands, for the broker's step 3 (CRM-Q2.4): {state: 'none' | 'waiting' | 'expired' | 'accepted', email, contact_name, invited_at, last_opened_at,
-- expires_at, send_count, accepted_at, email_outcome}, never the link or its hash. Read by the members of the intake's firm (an intake of another firm, an employer's own and one that is not there
-- are one answer, PT404). A link Remind replaced is not shown: the newest one stands for the invitation.
CREATE FUNCTION public.intake_invite_status(p_intake_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  i public.chamber_sessions;
  inv public.intake_invitations;
BEGIN
  SELECT * INTO i FROM public.chamber_sessions s WHERE s.id = p_intake_id;
  IF i.id IS NULL OR i.started_by IS NULL OR NOT public.is_firm_member(i.firm_id) THEN
    RAISE EXCEPTION 'That intake isn''t available' USING ERRCODE = 'PT404';
  END IF;
  SELECT * INTO inv FROM public.intake_invitations v WHERE v.intake_id = i.id AND v.status IN ('pending', 'accepted') ORDER BY v.created_at DESC, v.id LIMIT 1;
  IF inv.id IS NULL THEN
    RETURN jsonb_build_object('state', 'none');
  END IF;
  RETURN jsonb_build_object(
    'state', CASE WHEN inv.status = 'accepted' THEN 'accepted' WHEN inv.expires_at <= now() THEN 'expired' ELSE 'waiting' END,
    'email', inv.email, 'contact_name', inv.contact_name, 'invited_at', inv.invited_at, 'last_opened_at', inv.last_opened_at, 'expires_at', inv.expires_at,
    'send_count', inv.send_count, 'accepted_at', inv.accepted_at, 'email_outcome', inv.email_outcome);
END;
$$;

REVOKE ALL ON FUNCTION public.intake_invite_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.intake_invite_status(uuid) TO authenticated;

-- What the server function that emails the link records once it has tried: how the send went, against that link (a result that arrives after the link was replaced is not the current link's,
-- and is dropped). Only the service role calls it. A failure takes the sent time back, since the email is not known to have gone.
CREATE FUNCTION public.record_intake_invite_delivery(p_invitation_id uuid, p_token_hash text, p_outcome text, p_error text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE recorded integer;
BEGIN
  UPDATE public.intake_invitations v
  SET email_outcome = p_outcome,
      email_sent_at = CASE WHEN p_outcome = 'sent' THEN now() END,
      email_error = CASE WHEN p_outcome = 'sent' THEN NULL ELSE left(COALESCE(NULLIF(btrim(p_error), ''), 'unknown'), 40) END
  WHERE v.id = p_invitation_id AND v.token_hash = p_token_hash AND v.status = 'pending';
  GET DIAGNOSTICS recorded = ROW_COUNT;
  RETURN recorded > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.record_intake_invite_delivery(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_intake_invite_delivery(uuid, text, text, text) TO service_role;

-- ---------- 5. Only the employer certifies ----------
-- The database refuses a certification from a member of the intake's firm (D-1703, P-2.2, CRM-Q2.3): the employer owns the answers and signs for them. Only the browser's roles are asked
-- (the role the API set, anon or authenticated): the service role and jobs are not refused. A member of the intake's firm is a person with a current dated membership of
-- it, read from the memberships (not firm_role, which also asks for the address and a second factor: this is no sign-in question). A member of another firm may certify an intake of
-- their own at this firm's link, as any employer does. Named to sort before the other certification triggers, so the refusal comes first.
CREATE FUNCTION public.refuse_member_certification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- The role the API set (SET LOCAL ROLE), as keep_intake_firm reads it: this function runs as its owner, so current_user is no help.
  IF current_setting('role', true) NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'submitted'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'submitted' OR NEW.submission IS DISTINCT FROM OLD.submission)
     AND EXISTS (SELECT 1 FROM public.firm_memberships m
                 WHERE m.firm_id = NEW.firm_id AND m.user_id = auth.uid() AND public.membership_is_current(m.valid_from, m.valid_until)) THEN
    RAISE EXCEPTION 'Only the employer can certify an intake' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.refuse_member_certification() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER chamber_sessions_certification_by_employer BEFORE INSERT OR UPDATE ON public.chamber_sessions
  FOR EACH ROW EXECUTE FUNCTION public.refuse_member_certification();

-- ---------- 6. Certifying confirms the broker's entries ----------
-- When the employer certifies (the same test validate_certification asks), every answer that still carries a broker's entry as its source becomes confirmed, with employer_confirmed_at beside
-- it: the source stays (so the broker's step 3 can show what the employer changed from the broker's entries, CRM-Q2.4), and the status is what the required items and the packet read.
-- An answer the employer changed has the employer's own source and is not touched. A BEFORE trigger named to sort ahead of the certification triggers that read the provenance, so the
-- certified evidence (snapshot_certified_evidence) and the certification's record already see the confirmation.
CREATE FUNCTION public.confirm_broker_entries_at_certification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  k text;
  confirmed_at text := to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
BEGIN
  IF NEW.status = 'submitted'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'submitted' OR NEW.submission IS DISTINCT FROM OLD.submission)
     AND jsonb_typeof(NEW.field_provenance) = 'object' THEN
    FOR k IN SELECT e.key FROM jsonb_each(NEW.field_provenance) e
             WHERE e.value -> 'source' ->> 'kind' = 'broker_entry' AND e.value ->> 'status' IS DISTINCT FROM 'confirmed' LOOP
      NEW.field_provenance := jsonb_set(NEW.field_provenance, ARRAY[k], (NEW.field_provenance -> k) || jsonb_build_object('status', 'confirmed', 'employer_confirmed_at', confirmed_at));
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_broker_entries_at_certification() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER chamber_sessions_certification_confirm_broker BEFORE INSERT OR UPDATE ON public.chamber_sessions
  FOR EACH ROW EXECUTE FUNCTION public.confirm_broker_entries_at_certification();

-- ---------- 7. Only the firm writes a broker's name on an answer ----------
-- A save from the browser's roles may not give an answer a broker-entry source the intake did not already hold for that field (D-1710): the employer's browser resends the whole provenance on
-- every save, so entries it already holds pass; changing an answer replaces its entry with the employer's own source, and dropping one passes too. Only the source is compared, so the
-- confirmation certification adds (status, employer_confirmed_at) and the employer confirming an entry don't trip it. The caller is read as keep_intake_started_by reads it (current_user): the
-- broker functions run in the same request as the owner and are not asked.
CREATE FUNCTION public.refuse_forged_broker_entries()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  k text;
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') OR jsonb_typeof(NEW.field_provenance) IS DISTINCT FROM 'object' THEN
    RETURN NEW;
  END IF;
  FOR k IN SELECT e.key FROM jsonb_each(NEW.field_provenance) e WHERE e.value -> 'source' ->> 'kind' = 'broker_entry' LOOP
    IF TG_OP = 'INSERT' OR (OLD.field_provenance -> k -> 'source') IS DISTINCT FROM (NEW.field_provenance -> k -> 'source') THEN
      RAISE EXCEPTION 'Only the firm''s members enter answers as the broker' USING ERRCODE = '42501';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.refuse_forged_broker_entries() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER chamber_sessions_a_broker_entries BEFORE INSERT OR UPDATE ON public.chamber_sessions
  FOR EACH ROW EXECUTE FUNCTION public.refuse_forged_broker_entries();

-- ---------- 8. Talking to Lenore as the broker ----------
-- Whether the caller may enter answers into this intake as the broker (P-2.4): a current member of its firm, the firm started it, it is still being worked and the firm may be written to
-- (not closing, not a support session). A yes or no, never a refusal: chamber-extract answers "not found" for an intake that isn't the caller's, as it always has.
CREATE FUNCTION public.broker_may_enter_intake(p_intake_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chamber_sessions s
    WHERE s.id = p_intake_id AND s.started_by IS NOT NULL AND s.status = 'in_progress'
      AND public.is_firm_member(s.firm_id) AND NOT public.firm_is_read_only(s.firm_id) AND NOT public.is_support_session(s.firm_id))
$$;

REVOKE ALL ON FUNCTION public.broker_may_enter_intake(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.broker_may_enter_intake(uuid) TO authenticated;

-- ---------- 9. Closing a firm ----------
-- Restated: public.firm_closing_plan(), from 20261122200500_main_merged.sql (the newest definition on the base). Every line is kept, and one is added: a broker-started intake's invitations
-- are deleted with the firm (the link and who it was sent to are the firm's; the intake stays with its employer, as every intake does).
CREATE OR REPLACE FUNCTION public.firm_closing_plan()
RETURNS TABLE (ord integer, src text, action text, firm_column text, why text)
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT * FROM (VALUES
    -- Deleted: the firm's own working data.
    (10, 'public.firm_invitations', 'delete', 'firm_id', 'pending and past invitations to join'),
    (11, 'public.intake_invitations', 'delete', 'firm_id', 'the invitations of broker-started intakes to their employers (the link, never its token); the intakes stay with their employers'),
    (20, 'public.firm_organisations', 'delete', 'firm_id', 'the listed Google domains and Microsoft tenants'),
    (30, 'public.join_requests', 'delete', 'firm_id', 'requests to join'),
    (40, 'public.table_preferences', 'delete', 'firm_id', 'each person''s column choices'),
    (50, 'public.saved_views', 'delete', 'firm_id', 'saved views'),
    (55, 'public.record_history', 'delete', 'firm_id', 'the history of each record: who created it and every change to its fields; it goes with the record'),
    (56, 'public.recent_records', 'delete', 'firm_id', 'each person''s last opened records, for the search box'),
    (56, 'public.bulk_change_records', 'delete', 'firm_id', 'what each bulk change did to each record, kept for ten minutes'' undo'),
    (57, 'public.bulk_changes', 'delete', 'firm_id', 'bulk changes, kept for ten minutes'' undo'),
    (60, 'public.referral_partners', 'delete', 'firm_id', 'referral partners'),
    (54, 'public.commission_payments', 'delete', 'firm_id', 'commission payments (what the firm received for its placements); before the placements and accounts they stand on'),
    (56, 'public.renewals', 'delete', 'firm_id', 'renewals (the dates an account''s cover comes up); before the placements they come from and the opportunities working them'),
    (57, 'public.placements', 'delete', 'firm_id', 'placements (what the firm placed for its accounts); before the opportunities and accounts they stand on'),
    (57, 'public.merged_records', 'delete', 'firm_id', 'where each merged-away account or contact went, so its old address led to the kept one'),
    (58, 'public.activities', 'delete', 'firm_id', 'calls, notes and tasks on the firm''s accounts, contacts and leads; before the opportunities, contacts and accounts they stand on'),
    (58, 'public.conversation_file_downloads', 'delete', 'firm_id', 'each download of a file link on the firm''s contact mail; before the links they are of'),
    (58, 'public.conversation_message_files', 'delete', 'firm_id', 'the file links on the firm''s contact mail (the files stay with their intakes); before the messages they are on'),
    (58, 'public.conversation_message_attachments', 'delete', 'firm_id', 'the files received on the firm''s contact and lead mail, each one''s name, size and scan; before the messages they are on'),
    (58, 'public.conversation_messages', 'delete', 'firm_id', 'the mail with the firm''s contacts and leads; before the conversations they are on'),
    (58, 'public.conversations', 'delete', 'firm_id', 'the conversations with the firm''s contacts and leads, their reply addresses with them; before the contacts and leads they are with'),
    (59, 'public.account_labels', 'delete', 'firm_id', 'the labels on the firm''s accounts; before the accounts they stand on'),
    (59, 'public.lead_labels', 'delete', 'firm_id', 'the labels on the firm''s leads; before the leads they stand on'),
    (60, 'public.leads', 'delete', 'firm_id', 'leads, the people and businesses the firm is not quoting yet, the bin with them; after their calls, notes and tasks'),
    (61, 'public.opportunities', 'delete', 'firm_id', 'opportunities (each is one search for one account); before the contacts and accounts they stand on'),
    (62, 'public.contacts', 'delete', 'firm_id', 'contacts, the people at the firm''s accounts'),
    (63, 'public.accounts', 'delete', 'firm_id', 'accounts, the businesses the firm quotes for; the intakes on their opportunities stay with their employers (below)'),
    (64, 'public.labels', 'delete', 'firm_id', 'the firm''s own list of labels; after the accounts that carried them'),
    (70, 'public.firm_teams', 'delete', 'firm_id', 'teams (the memberships that named one are cleared first)'),
    -- Kept, and why.
    (900, 'public.bundle_links', 'keep', NULL, 'a quote request''s links to its bundle: they go with the intake, under the intake retention rules'),
    (900, 'storage.objects WHERE bucket_id = ''bundle-links''', 'keep', NULL, 'an intake''s files: a bundle link''s made files, deleted with the intake'),
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
    (900, 'public.peo_authorizations', 'keep', NULL, 'the employer''s own say over which PEOs may receive their packet; an intake''s'),
    (900, 'public.peo_registrations', 'keep', NULL, 'the firm''s proof of each send to a PEO (firm, PEO, the employer''s FEIN or name and state, version, time): appended only, so nobody deletes it, the closing included; it stays as the record that the send happened, and still warns another firm sending the same employer to that PEO (D-1635)'),
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
    (900, 'storage.objects WHERE bucket_id = ''contact-mail''', 'keep', NULL, 'the bytes of files received on the firm''s contact mail: unreadable once the closing deletes their rows (the bucket is read only through a stored attachment''s row), and not removable from SQL (D-667)'),
    (900, 'storage.objects WHERE bucket_id = ''peo-mail''', 'keep', NULL, 'an intake''s files')
  ) AS t (ord, src, action, firm_column, why)
$$;

-- ---------- 10. The existing chamber is the broker's workspace (D-1751) ----------
-- A member of the firm works a broker-started intake in the chamber that already exists (/start, Lenore and the tabs), saving through the chamber's own save: an update of the intake's
-- data, provenance and transcript. There is no separate answer-writing function. Row security lets a current member of the intake's firm update an intake the firm started while it is still
-- being worked (the employer, once they have accepted, goes on writing it under their own policy); the trigger below decides what the update may change and marks what it enters.
CREATE POLICY "Firm members can work an intake their firm started" ON public.chamber_sessions
  FOR UPDATE TO authenticated
  USING (started_by IS NOT NULL AND status = 'in_progress' AND user_id IS DISTINCT FROM auth.uid()
         AND EXISTS (SELECT 1 FROM public.firm_memberships m WHERE m.firm_id = chamber_sessions.firm_id AND m.user_id = auth.uid() AND public.membership_is_current(m.valid_from, m.valid_until)))
  WITH CHECK (started_by IS NOT NULL AND status = 'in_progress' AND user_id IS DISTINCT FROM auth.uid()
         AND EXISTS (SELECT 1 FROM public.firm_memberships m WHERE m.firm_id = chamber_sessions.firm_id AND m.user_id = auth.uid() AND public.membership_is_current(m.valid_from, m.valid_until)));

-- What a member's save does to the row, whatever the chamber wrote: what they entered is marked as theirs. Every answer whose value changed carries a broker-entry source naming the member (the
-- message and the words kept when the chamber wrote them from a message) and the status inferred, because nothing a broker enters counts as the employer's before they certify (D-1710).
CREATE FUNCTION public.work_broker_started_intake()
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

-- Named to sort first, so the validation and certification triggers see the row as it will be kept.
CREATE TRIGGER chamber_sessions_a_broker_work BEFORE UPDATE ON public.chamber_sessions
  FOR EACH ROW EXECUTE FUNCTION public.work_broker_started_intake();
