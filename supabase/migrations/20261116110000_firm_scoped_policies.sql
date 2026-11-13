-- Every table and storage rule scoped to the caller's firm (story CRM-P2.1a, with CRM-S5.1).

-- A password sign-in without a second factor opens no firm's data (D-19, story CRM-P1.3b). Membership is what every firm's
-- policy asks, so the rule belongs to the membership check itself: firm_role() and is_firm_member() answer for the caller's
-- own token, and a sign-in that used a password answers "not a member" until a second factor is completed (aal2). Google and
-- Microsoft sign-ins, which rely on their provider, are not asked.
--
-- The rule is CRM-P1.3b's second_factor_rule_met(), in 20261116150000_second_factor_for_password_sign_ins.sql, which sorts
-- after this file and is the one that stays: it is created here the same way (and replaced there by the same text) so the
-- membership check can call it however the files are applied.
CREATE OR REPLACE FUNCTION public.second_factor_rule_met()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT NOT jsonb_path_exists(COALESCE(auth.jwt(), '{}'::jsonb), '$.amr[*] ? (@.method == "password")')
      OR COALESCE(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

REVOKE ALL ON FUNCTION public.second_factor_rule_met() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.second_factor_rule_met() TO anon, authenticated;

-- The caller's role in a firm today (20261116090000_firms.sql), now only for a sign-in that meets the second-factor rule.
CREATE OR REPLACE FUNCTION public.firm_role(p_firm_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.role
  FROM public.firm_memberships m
  WHERE auth.uid() IS NOT NULL
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    AND public.second_factor_rule_met()
    AND m.firm_id = p_firm_id
    AND m.user_id = auth.uid()
    AND public.membership_is_current(m.valid_from, m.valid_until)
$$;

-- May the caller see a record of this firm that this person owns? The one question every firm-owned table asks (leads,
-- accounts, opportunities and quotes, when they exist: D-24). A current member only; then by level.
CREATE FUNCTION public.can_see_firm_record(p_firm_id uuid, p_owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.firm_role(p_firm_id) = 'owner', false)
    OR (public.is_firm_member(p_firm_id) AND EXISTS (SELECT 1 FROM public.firms f WHERE f.id = p_firm_id AND f.visibility = 'everyone'))
    OR (public.is_firm_member(p_firm_id) AND p_owner_id IS NOT DISTINCT FROM auth.uid())
    OR (
      COALESCE(public.firm_role(p_firm_id) = 'lead', false)
      AND EXISTS (
        WITH RECURSIVE my_teams (id) AS (
          SELECT m.team_id
          FROM public.firm_memberships m
          WHERE m.firm_id = p_firm_id AND m.user_id = auth.uid() AND m.team_id IS NOT NULL
            AND public.membership_is_current(m.valid_from, m.valid_until)
          UNION
          SELECT t.id FROM public.firm_teams t JOIN my_teams ON t.parent_team_id = my_teams.id
        )
        SELECT 1
        FROM public.firm_memberships o
        WHERE o.firm_id = p_firm_id AND o.user_id = p_owner_id
          AND public.membership_is_current(o.valid_from, o.valid_until)
          AND o.team_id IN (SELECT id FROM my_teams)
      )
    )
$$;

REVOKE ALL ON FUNCTION public.can_see_firm_record(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_firm_record(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Every row-security policy that let an advisor or admin read firm data now asks for current membership of the row's firm
-- (D-15, D-16, D-18). The role in user_roles no longer opens any firm's data: a platform admin is not thereby a member of
-- any firm, and a member needs no advisor role to read their own firm's. Most tables reach the firm through their intake.
-- Left as they were, because they hold nothing of any firm's: the PEO list, its profiles, contacts and template workbooks
-- (the same for every firm, kept by platform admins; read by an advisor), ops_events and ops_alerts, allowed_organisations
-- and advisor_role_events (a platform admin's), and the policies that let a person read their own rows. The SECURITY DEFINER
-- functions are CRM-P2.1b's.
-- ---------------------------------------------------------------------------------------------------------------

-- Is this intake one of a firm the caller currently belongs to? The firm is the intake's own, never taken from the browser.
CREATE FUNCTION public.intake_in_my_firm(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chamber_sessions s
    WHERE s.id = p_session_id AND public.is_firm_member(s.firm_id)
  )
$$;

-- The same for the intake a storage folder names, which is text: anything that isn't an intake's id belongs to no firm.
CREATE FUNCTION public.intake_folder_in_my_firm(p_folder text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_folder ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.intake_in_my_firm(p_folder::uuid)
$$;

-- Is this quote request on an intake of the caller's firm?
CREATE FUNCTION public.quote_request_in_my_firm(p_quote_request_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.quote_requests q
    WHERE q.id = p_quote_request_id AND public.intake_in_my_firm(q.session_id)
  )
$$;

-- May the caller read a message of PEO mail? One on a quote request: its firm's members. Held mail belongs to no firm yet
-- (it is assigned to one by an admin, CRM-P2.1c): a platform admin's alone.
CREATE FUNCTION public.can_read_peo_mail(p_quote_request_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN p_quote_request_id IS NULL THEN public.has_role('admin') ELSE public.quote_request_in_my_firm(p_quote_request_id) END
$$;

-- Does this person own an intake of a firm the caller currently belongs to? (Their agreement and profile are the firm's to read.)
CREATE FUNCTION public.intake_owner_in_my_firm(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chamber_sessions s
    WHERE s.user_id = p_user_id AND public.is_firm_member(s.firm_id)
  )
$$;

-- Is this person a current member of a firm the caller currently belongs to?
CREATE FUNCTION public.colleague_in_my_firm(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.firm_memberships m
    WHERE m.user_id = p_user_id AND public.membership_is_current(m.valid_from, m.valid_until)
      AND public.is_firm_member(m.firm_id)
  )
$$;

REVOKE ALL ON FUNCTION public.intake_in_my_firm(uuid), public.intake_folder_in_my_firm(text), public.quote_request_in_my_firm(bigint),
  public.can_read_peo_mail(bigint), public.intake_owner_in_my_firm(uuid), public.colleague_in_my_firm(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.intake_in_my_firm(uuid), public.intake_folder_in_my_firm(text), public.quote_request_in_my_firm(bigint),
  public.can_read_peo_mail(bigint), public.intake_owner_in_my_firm(uuid), public.colleague_in_my_firm(uuid) TO authenticated;

-- A deletion record outlives its intake (it says what was deleted, when and on whose request, never the content), so it
-- carries its own firm, taken from the intake when the record is made. Every record made so far is Edgar Allan Advisory's,
-- as is every intake that existed before firms did, which is what the column starts as.
ALTER TABLE public.intake_deletions
  ADD COLUMN firm_id uuid NOT NULL DEFAULT public.default_firm_id() REFERENCES public.firms (id);

CREATE FUNCTION public.keep_deletion_firm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.firm_id := COALESCE((SELECT s.firm_id FROM public.chamber_sessions s WHERE s.id = NEW.session_id), NEW.firm_id);
  ELSE
    NEW.firm_id := OLD.firm_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.keep_deletion_firm() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER intake_deletions_firm
  BEFORE INSERT OR UPDATE OF firm_id ON public.intake_deletions
  FOR EACH ROW EXECUTE FUNCTION public.keep_deletion_firm();

-- Intake rows: a member reads their firm's intakes and what hangs off them.
DROP POLICY "Advisors can view all sessions" ON public.chamber_sessions;
CREATE POLICY "Firm members can view their firm's intakes" ON public.chamber_sessions
  FOR SELECT TO authenticated USING (public.is_firm_member(firm_id));

DROP POLICY "Advisors can view all certifications" ON public.chamber_certifications;
CREATE POLICY "Firm members can view their firm's certifications" ON public.chamber_certifications
  FOR SELECT TO authenticated USING (public.intake_in_my_firm(session_id));

DROP POLICY "Advisors can view all documents" ON public.documents;
CREATE POLICY "Firm members can view their firm's documents" ON public.documents
  FOR SELECT TO authenticated USING (public.intake_in_my_firm(session_id));

DROP POLICY "Advisors can view intake consents" ON public.intake_consents;
CREATE POLICY "Firm members can view their firm's intake consents" ON public.intake_consents
  FOR SELECT TO authenticated USING (public.intake_owner_in_my_firm(user_id));

DROP POLICY "Advisors can view all profiles" ON public.profiles;
CREATE POLICY "Firm members can view their firm's profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.intake_owner_in_my_firm(user_id) OR public.colleague_in_my_firm(user_id));

-- What advisors record about an intake.
DROP POLICY "Advisors can view field reviews" ON public.advisor_field_reviews;
CREATE POLICY "Firm members can view their firm's field reviews" ON public.advisor_field_reviews
  FOR SELECT TO authenticated USING (public.intake_in_my_firm(session_id));

DROP POLICY "Advisors can view notes" ON public.advisor_notes;
CREATE POLICY "Firm members can view their firm's notes" ON public.advisor_notes
  FOR SELECT TO authenticated USING (public.intake_in_my_firm(session_id));

DROP POLICY "Advisors can add notes as themselves" ON public.advisor_notes;
CREATE POLICY "Firm members can add notes as themselves" ON public.advisor_notes
  FOR INSERT TO authenticated WITH CHECK (public.intake_in_my_firm(session_id) AND author_id = auth.uid());

DROP POLICY "Advisors can view review events" ON public.advisor_review_events;
CREATE POLICY "Firm members can view their firm's review events" ON public.advisor_review_events
  FOR SELECT TO authenticated USING (public.intake_in_my_firm(session_id));

-- A call with no intake behind it isn't any firm's: the platform admin's.
DROP POLICY "Advisors can view extraction events" ON public.ai_extraction_events;
CREATE POLICY "Firm members can view their firm's extraction events" ON public.ai_extraction_events
  FOR SELECT TO authenticated
  USING (CASE WHEN session_id IS NULL THEN public.has_role('admin') ELSE public.intake_in_my_firm(session_id) END);

DROP POLICY "Advisors can view document events" ON public.document_events;
CREATE POLICY "Firm members can view their firm's document events" ON public.document_events
  FOR SELECT TO authenticated USING (public.intake_in_my_firm(session_id));

DROP POLICY information_requests_advisor_read ON public.information_requests;
CREATE POLICY information_requests_firm_read ON public.information_requests
  FOR SELECT TO authenticated USING (public.intake_in_my_firm(session_id));

DROP POLICY "Advisors can view intake deletions" ON public.intake_deletions;
CREATE POLICY "Firm members can view their firm's intake deletions" ON public.intake_deletions
  FOR SELECT TO authenticated USING (public.is_firm_member(firm_id));

DROP POLICY "Advisors can view intake lifecycle events" ON public.intake_lifecycle_events;
CREATE POLICY "Firm members can view their firm's intake lifecycle events" ON public.intake_lifecycle_events
  FOR SELECT TO authenticated USING (public.intake_in_my_firm(session_id));

DROP POLICY "Advisors can view manuscript versions" ON public.manuscript_versions;
CREATE POLICY "Firm members can view their firm's manuscript versions" ON public.manuscript_versions
  FOR SELECT TO authenticated USING (public.intake_in_my_firm(session_id));

DROP POLICY "Advisors can view status history" ON public.submission_status_history;
CREATE POLICY "Firm members can view their firm's status history" ON public.submission_status_history
  FOR SELECT TO authenticated USING (public.intake_in_my_firm(session_id));

DROP POLICY "Advisors can view pipeline status" ON public.submission_workflow;
CREATE POLICY "Firm members can view their firm's pipeline status" ON public.submission_workflow
  FOR SELECT TO authenticated USING (public.intake_in_my_firm(session_id));

-- Quote requests and the mail on them.
DROP POLICY quote_requests_advisor_read ON public.quote_requests;
CREATE POLICY quote_requests_firm_read ON public.quote_requests
  FOR SELECT TO authenticated USING (public.intake_in_my_firm(session_id));

DROP POLICY quote_request_events_advisor_read ON public.quote_request_events;
CREATE POLICY quote_request_events_firm_read ON public.quote_request_events
  FOR SELECT TO authenticated USING (public.quote_request_in_my_firm(quote_request_id));

DROP POLICY quote_request_notes_advisor_read ON public.quote_request_notes;
CREATE POLICY quote_request_notes_firm_read ON public.quote_request_notes
  FOR SELECT TO authenticated USING (public.quote_request_in_my_firm(quote_request_id));

DROP POLICY quote_request_addresses_advisor_read ON public.quote_request_addresses;
CREATE POLICY quote_request_addresses_firm_read ON public.quote_request_addresses
  FOR SELECT TO authenticated USING (public.quote_request_in_my_firm(quote_request_id));

DROP POLICY quote_request_thread_reads_advisor_read ON public.quote_request_thread_reads;
CREATE POLICY quote_request_thread_reads_firm_read ON public.quote_request_thread_reads
  FOR SELECT TO authenticated USING (public.quote_request_in_my_firm(quote_request_id));

DROP POLICY quote_request_messages_advisor_read ON public.quote_request_messages;
CREATE POLICY quote_request_messages_firm_read ON public.quote_request_messages
  FOR SELECT TO authenticated USING (public.can_read_peo_mail(quote_request_id));

DROP POLICY quote_request_message_attachments_read ON public.quote_request_message_attachments;
CREATE POLICY quote_request_message_attachments_firm_read ON public.quote_request_message_attachments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quote_request_messages m
    WHERE m.id = quote_request_message_attachments.message_id AND public.can_read_peo_mail(m.quote_request_id)
  ));

-- Referral partners have no firm column until CRM-P2.1c gives them one: until then they are Edgar Allan Advisory's, the
-- only firm that exists with them, and no other firm reads them.
DROP POLICY "Advisors can view referral partners" ON public.referral_partners;
CREATE POLICY referral_partners_firm_read ON public.referral_partners
  FOR SELECT TO authenticated USING (public.is_firm_member(public.default_firm_id()));

-- Storage: the same membership, through the intake a file's folder names.
DROP POLICY "Advisors can read PEO mail attachments" ON storage.objects;
CREATE POLICY "Firm members can read PEO mail attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'peo-mail'
    AND EXISTS (
      SELECT 1
      FROM public.quote_request_message_attachments a
      JOIN public.quote_request_messages m ON m.id = a.message_id
      WHERE a.storage_bucket = 'peo-mail' AND a.storage_path = objects.name AND a.status = 'stored'
        AND m.quote_request_id IS NOT NULL AND public.quote_request_in_my_firm(m.quote_request_id)
    )
  );

DROP POLICY "Advisors can read generated manuscripts" ON storage.objects;
CREATE POLICY "Firm members can read generated manuscripts" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'manuscripts' AND public.intake_folder_in_my_firm((storage.foldername(name))[1]));

DROP POLICY "Advisors can read uploaded documents" ON storage.objects;
CREATE POLICY "Firm members can read uploaded documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.intake_folder_in_my_firm((storage.foldername(name))[2])
    AND NOT public.is_withheld_document_file(name)
  );

DROP POLICY "Advisors can remove unrecorded manuscript uploads" ON storage.objects;
CREATE POLICY "Firm members can remove unrecorded manuscript uploads" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'manuscripts'
    AND public.intake_folder_in_my_firm((storage.foldername(name))[1])
    AND NOT EXISTS (SELECT 1 FROM public.manuscript_versions v WHERE v.storage_path = objects.name)
  );

DROP POLICY "Advisors can store generated manuscripts" ON storage.objects;
CREATE POLICY "Firm members can store generated manuscripts" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'manuscripts'
    AND public.intake_folder_in_my_firm((storage.foldername(name))[1])
    AND public.intake_accepts_files((storage.foldername(name))[1])
  );
