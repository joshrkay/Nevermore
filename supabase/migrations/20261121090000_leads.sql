-- Leads (story CRM-L1.3a, slice 8.1, #188; docs/BROKER_CRM_BUILD.md D-803 to D-809; supabase/tests/leads.sql).
-- A lead is its own record (D-803): a person and their business that the firm is not quoting yet. It is not in the chain (CRM-Q1.1): it has no
-- account, contact or opportunity until it is converted (CRM-L2.2, slice 8.6), which copies it into them.

-- ---------- 1. The table ----------
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  -- The record owner (CRM-S5.1). Nobody, or someone who has left, is an owner's alone. A deleted person clears it.
  owner_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  -- The person's name, or the business's when no person is known (CRM-L1.2).
  name text NOT NULL CONSTRAINT leads_name_check CHECK (btrim(name) <> '' AND char_length(name) <= 200),
  title text CONSTRAINT leads_title_check CHECK (char_length(title) <= 200),
  business text CONSTRAINT leads_business_check CHECK (char_length(business) <= 200),
  email text CONSTRAINT leads_email_check CHECK (char_length(email) <= 320),
  phone text CONSTRAINT leads_phone_check CHECK (char_length(phone) <= 40),
  city text CONSTRAINT leads_city_check CHECK (char_length(city) <= 100),
  state text CONSTRAINT leads_state_check CHECK (public.is_us_state_code(state) OR state IS NULL),
  employees integer CONSTRAINT leads_employees_check CHECK (employees >= 0),
  current_provider text CONSTRAINT leads_current_provider_check CHECK (char_length(current_provider) <= 200),
  note text CONSTRAINT leads_note_check CHECK (char_length(note) <= 5000),
  -- Where it came from (D-804). No default, so a step that makes a lead says where from.
  source text NOT NULL CONSTRAINT leads_source_check CHECK (source IN ('added_by_hand', 'import', 'referral_partner', 'firms_link')),
  -- New, Working, Converted or Not a fit (CRM-L1.3, D-808).
  status text NOT NULL DEFAULT 'new' CONSTRAINT leads_status_check CHECK (status IN ('new', 'working', 'converted', 'not_fit')),
  -- Why it is Not a fit, from the short list; only then, and always then.
  not_fit_reason text CONSTRAINT leads_not_fit_reason_check CHECK (not_fit_reason IN ('too_small', 'wrong_industry', 'not_interested', 'bad_contact_details', 'other')),
  -- What converting made (CRM-L2.2), set by converting alone. The account, contact or opportunity can later be deleted; the lead stays Converted.
  converted_account_id uuid,
  converted_contact_id uuid,
  converted_opportunity_id uuid,
  converted_at timestamptz,
  -- In the bin (D-806): in no view but Deleted, removed for good 30 days after.
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leads_firm_id_id_key UNIQUE (firm_id, id),
  CONSTRAINT leads_not_fit_has_reason CHECK ((status = 'not_fit') = (not_fit_reason IS NOT NULL)),
  CONSTRAINT leads_converted_has_when CHECK ((status = 'converted') = (converted_at IS NOT NULL)),
  CONSTRAINT leads_made_only_when_converted CHECK (status = 'converted' OR (converted_account_id IS NULL AND converted_contact_id IS NULL AND converted_opportunity_id IS NULL)),
  -- A converted lead can't be deleted (CRM-L1.1).
  CONSTRAINT leads_converted_not_in_bin CHECK (status <> 'converted' OR deleted_at IS NULL),
  -- What it made is of its own firm, and the contact and opportunity are of the account it made (the pairs contacts and opportunities keep for that).
  CONSTRAINT leads_converted_account_fkey FOREIGN KEY (firm_id, converted_account_id) REFERENCES public.accounts (firm_id, id) ON DELETE SET NULL (converted_account_id),
  CONSTRAINT leads_converted_contact_fkey FOREIGN KEY (converted_account_id, converted_contact_id) REFERENCES public.contacts (account_id, id) ON DELETE SET NULL (converted_contact_id),
  CONSTRAINT leads_converted_opportunity_fkey FOREIGN KEY (converted_account_id, converted_opportunity_id) REFERENCES public.opportunities (account_id, id) ON DELETE SET NULL (converted_opportunity_id)
);

CREATE INDEX leads_owner_idx ON public.leads (firm_id, owner_id);

COMMENT ON TABLE public.leads IS 'A person and their business the firm is not quoting yet (glossary: Lead). Converting copies it into an account, a contact and an opportunity.';

CREATE TRIGGER leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- A lead's source is the product's, as an account's is (D-211): an update keeps what the row had, whoever sends it. So it is in no history.
CREATE FUNCTION public.keep_lead_source()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.source := OLD.source;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.keep_lead_source() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER leads_keep_source BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.keep_lead_source();

-- ---------- 2. Converted is for good ----------
-- Whoever writes: a lead becomes Converted only with the account it made, and a converted lead never changes again, but for what it made being deleted
-- (the links clear themselves). Its firm never changes.
CREATE FUNCTION public.leads_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.firm_id IS DISTINCT FROM OLD.firm_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'A lead can''t be moved to another firm' USING ERRCODE = '42501';
  END IF;
  IF OLD.status = 'converted' THEN
    IF (to_jsonb(NEW) - ARRAY['converted_account_id', 'converted_contact_id', 'converted_opportunity_id', 'updated_at', 'version'])
       IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['converted_account_id', 'converted_contact_id', 'converted_opportunity_id', 'updated_at', 'version'])
       OR (NEW.converted_account_id IS DISTINCT FROM OLD.converted_account_id AND NEW.converted_account_id IS NOT NULL)
       OR (NEW.converted_contact_id IS DISTINCT FROM OLD.converted_contact_id AND NEW.converted_contact_id IS NOT NULL)
       OR (NEW.converted_opportunity_id IS DISTINCT FROM OLD.converted_opportunity_id AND NEW.converted_opportunity_id IS NOT NULL) THEN
      RAISE EXCEPTION 'A converted lead can''t be changed' USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.status = 'converted' AND NEW.converted_account_id IS NULL THEN
    RAISE EXCEPTION 'A lead is converted only into an account' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.leads_guard() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER leads_guard BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.leads_guard();

-- ---------- 3. Row security ----------
-- Nobody writes through the API: the functions of later slices do. A lead is seen by its owner's level (can_see_firm_record, D-809: a current member of a
-- firm that shows everyone everything; otherwise an owner every lead, a lead their teams', an agent their own; a lead with no owner is an owner's alone;
-- support reads what an owner reads). A lead in the bin is seen only by those who see the firm's every lead: its owners and support (D-806).
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.leads FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.leads TO authenticated, service_role;

CREATE POLICY leads_visible ON public.leads FOR SELECT TO authenticated
  USING (public.can_see_firm_record(firm_id, owner_id)
         AND (deleted_at IS NULL OR public.firm_role(firm_id) = 'owner' OR public.is_support_session(firm_id)));

-- ---------- 4. History and version (D-45, D-46) ----------
-- The history's list of tables, with leads.
ALTER DOMAIN public.record_history_table DROP CONSTRAINT record_history_table_known;
ALTER DOMAIN public.record_history_table ADD CONSTRAINT record_history_table_known
  CHECK (VALUE IN ('referral_partners', 'accounts', 'contacts', 'opportunities', 'leads'));

-- A lead's own fields, its status and reason among them, so every status change is one entry (D-808). Not its stamps, its source (the product's), or the
-- links converting sets; not the version, which the trigger owns.
SELECT public.record_track('public.leads', 'leads', ARRAY['id'], ARRAY[
  'owner_id', 'name', 'title', 'business', 'email', 'phone', 'city', 'state', 'employees', 'current_provider', 'note', 'status', 'not_fit_reason',
  'deleted_at']);

CREATE OR REPLACE FUNCTION public.record_history_can_see(p_firm_id uuid, p_table public.record_history_table, p_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_firm_id IS NULL OR p_key IS NULL THEN
    RETURN false;
  END IF;
  IF p_table = 'referral_partners' THEN
    RETURN public.is_firm_member(p_firm_id)
      AND EXISTS (SELECT 1 FROM public.referral_partners r WHERE r.firm_id = p_firm_id AND r.code = p_key);
  ELSIF p_table = 'accounts' THEN
    RETURN EXISTS (SELECT 1 FROM public.accounts a WHERE a.firm_id = p_firm_id AND a.id = public.record_history_key_uuid(p_key) AND public.can_see_firm_record(a.firm_id, a.owner_id));
  ELSIF p_table = 'contacts' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.contacts c JOIN public.accounts a ON a.id = c.account_id
      WHERE c.firm_id = p_firm_id AND c.id = public.record_history_key_uuid(p_key) AND public.can_see_firm_record(a.firm_id, a.owner_id));
  ELSIF p_table = 'opportunities' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.opportunities o JOIN public.accounts a ON a.id = o.account_id
      WHERE o.firm_id = p_firm_id AND o.id = public.record_history_key_uuid(p_key) AND public.can_see_firm_record(a.firm_id, a.owner_id));
  ELSIF p_table = 'leads' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.firm_id = p_firm_id AND l.id = public.record_history_key_uuid(p_key) AND public.can_see_firm_record(l.firm_id, l.owner_id)
        AND (l.deleted_at IS NULL OR public.firm_role(l.firm_id) = 'owner' OR public.is_support_session(l.firm_id)));
  END IF;
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.record_history_can_see(uuid, public.record_history_table, text) FROM PUBLIC, anon, authenticated, service_role;

-- Whether a record still exists, per table (20261119100000, restated with leads). A table nobody has taught this function counts as still there.
CREATE OR REPLACE FUNCTION public.record_history_record_exists(p_firm_id uuid, p_table public.record_history_table, p_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_table = 'referral_partners' THEN
    RETURN EXISTS (SELECT 1 FROM public.referral_partners r WHERE r.firm_id = p_firm_id AND r.code = p_key);
  ELSIF p_table = 'accounts' THEN
    RETURN EXISTS (SELECT 1 FROM public.accounts a WHERE a.firm_id = p_firm_id AND a.id = public.record_history_key_uuid(p_key));
  ELSIF p_table = 'contacts' THEN
    RETURN EXISTS (SELECT 1 FROM public.contacts c WHERE c.firm_id = p_firm_id AND c.id = public.record_history_key_uuid(p_key));
  ELSIF p_table = 'opportunities' THEN
    RETURN EXISTS (SELECT 1 FROM public.opportunities o WHERE o.firm_id = p_firm_id AND o.id = public.record_history_key_uuid(p_key));
  ELSIF p_table = 'leads' THEN
    RETURN EXISTS (SELECT 1 FROM public.leads l WHERE l.firm_id = p_firm_id AND l.id = public.record_history_key_uuid(p_key));
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_history_record_exists(uuid, public.record_history_table, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_history_record_exists(uuid, public.record_history_table, text) TO record_history_remover;


-- ---------- 5. Calls, notes and tasks on a lead (D-807) ----------
-- A row belongs to exactly one of an account or a lead, of its own firm. A lead's call, note or task names no contact or opportunity: it has none until it is
-- converted, which moves its rows onto the account (CRM-L2.2). Removing a lead for good removes them (D-806). Added to, nothing replaced (ADR 0007).
ALTER TABLE public.activities ALTER COLUMN account_id DROP NOT NULL;
ALTER TABLE public.activities ADD COLUMN lead_id uuid;
ALTER TABLE public.activities
  ADD CONSTRAINT activities_lead_fkey FOREIGN KEY (firm_id, lead_id) REFERENCES public.leads (firm_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT activities_on_account_or_lead CHECK ((account_id IS NULL) <> (lead_id IS NULL)),
  ADD CONSTRAINT activities_lead_names_no_record CHECK (lead_id IS NULL OR (contact_id IS NULL AND opportunity_id IS NULL));

CREATE INDEX activities_lead_idx ON public.activities (lead_id, at DESC, id DESC) WHERE lead_id IS NOT NULL;
CREATE INDEX activities_lead_activity_idx ON public.activities (lead_id, activity_at DESC) WHERE lead_id IS NOT NULL;

COMMENT ON TABLE public.activities IS 'A call, a note or a task on an account or a lead (glossary: Call, Note, Task). Written only by log_activity, update_activity, add_to_note and set_task_done.';

-- Seen by whoever may see its account (20261119180000), or its lead as the lead's row is (section 3).
DROP POLICY activities_visible ON public.activities;
CREATE POLICY activities_visible ON public.activities FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = activities.account_id AND public.can_see_firm_record(a.firm_id, a.owner_id))
    OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = activities.lead_id AND public.can_see_firm_record(l.firm_id, l.owner_id)
               AND (l.deleted_at IS NULL OR public.firm_role(l.firm_id) = 'owner' OR public.is_support_session(l.firm_id))));

-- ---------- 6. Labels on leads (D-805) ----------
-- A label from the firm's one list (glossary: Label) on a lead, as account_labels holds them on accounts. Of one firm; removing the lead or the label takes
-- its rows with it. Closed to the API: the bulk functions of slice 8.4 write and read it.
CREATE TABLE public.lead_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  label_id uuid NOT NULL,
  added_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_labels_lead_label_key UNIQUE (lead_id, label_id),
  CONSTRAINT lead_labels_lead_fkey FOREIGN KEY (firm_id, lead_id) REFERENCES public.leads (firm_id, id) ON DELETE CASCADE,
  CONSTRAINT lead_labels_label_fkey FOREIGN KEY (firm_id, label_id) REFERENCES public.labels (firm_id, id) ON DELETE CASCADE
);

CREATE INDEX lead_labels_label_idx ON public.lead_labels (firm_id, label_id);

COMMENT ON TABLE public.lead_labels IS 'A label on a lead (glossary: Label). Written only by the leads'' bulk functions.';

ALTER TABLE public.lead_labels ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lead_labels FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.lead_labels TO service_role;

-- ---------- 7. Closing a firm deletes them (D-803) ----------
-- The closing's one list (20261119230000), restated with every line it had, and leads and the labels on them, after the calls, notes and tasks that stand on
-- them (ord 58, which takes a lead's with the rest).
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
    (56, 'public.recent_records', 'delete', 'firm_id', 'each person''s last opened records, for the search box'),
    (56, 'public.bulk_change_records', 'delete', 'firm_id', 'what each bulk change did to each record, kept for ten minutes'' undo'),
    (57, 'public.bulk_changes', 'delete', 'firm_id', 'bulk changes, kept for ten minutes'' undo'),
    (60, 'public.referral_partners', 'delete', 'firm_id', 'referral partners'),
    (58, 'public.activities', 'delete', 'firm_id', 'calls, notes and tasks on the firm''s accounts, contacts and leads; before the opportunities, contacts and accounts they stand on'),
    (59, 'public.account_labels', 'delete', 'firm_id', 'the labels on the firm''s accounts; before the accounts they stand on'),
    (59, 'public.lead_labels', 'delete', 'firm_id', 'the labels on the firm''s leads; before the leads they stand on'),
    (60, 'public.leads', 'delete', 'firm_id', 'leads, the people and businesses the firm is not quoting yet, the bin with them; after their calls, notes and tasks'),
    (61, 'public.opportunities', 'delete', 'firm_id', 'opportunities (each is one search for one account); before the contacts and accounts they stand on'),
    (62, 'public.contacts', 'delete', 'firm_id', 'contacts, the people at the firm''s accounts'),
    (63, 'public.accounts', 'delete', 'firm_id', 'accounts, the businesses the firm quotes for; the intakes on their opportunities stay with their employers (below)'),
    (64, 'public.labels', 'delete', 'firm_id', 'the firm''s own list of labels; after the accounts that carried them'),
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
