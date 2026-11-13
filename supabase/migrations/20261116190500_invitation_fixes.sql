-- Three fixes to the invitations story (CRM-P1.2) found in review after it was merged. Everything here is new: the migrations the
-- story builds on (20261116160001_firm_activity.sql, 20261116190000_firm_invitations.sql) have already run on databases and are not
-- edited, so a database that ran them and a fresh one end in the same state.

-- 1. Withdrawing an invitation is recorded as its own kind of entry. The kinds list belongs to 20261116160001_firm_activity.sql, which
-- databases have run without this kind: the check is dropped and added again here with it. src/data/firmActivity.ts (ENTRY_KINDS) is
-- kept in step by src/data/schemaSync.test.ts, which reads the list of the latest migration that holds it.
ALTER TABLE public.firm_activity DROP CONSTRAINT firm_activity_kind_check;
ALTER TABLE public.firm_activity ADD CONSTRAINT firm_activity_kind_check CHECK (kind IN (
    -- sync:begin firm_activity_kinds
    'sign_in', 'submission_viewed', 'document_downloaded', 'packet_downloaded', 'send_recorded',
    'member_added', 'member_ended', 'owner_added', 'owner_ended',
    'export_made', 'invitation_sent', 'member_removed', 'support_access',
    'firm_signed_up', 'firm_approved', 'firm_refused', 'invitation_withdrawn'
    -- sync:end firm_activity_kinds
  ));

-- 2. The firm's record carries the role of an invitation. record_firm_event (20261116170001) handed the entry over without the
-- detail that holds the role, so every invitation, resend and withdrawal was stored with no role. An invitation sent (or sent
-- again) and an invitation withdrawn now record the role that was offered, so the firm's owners see who was invited as what.
-- Nothing else in p_detail (the address, the note, the invited email) is written, and the actor is still the caller's own sign-in.
CREATE OR REPLACE FUNCTION public.record_firm_event(p_firm_id uuid, p_kind text, p_actor uuid, p_detail jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.firm_activity_append(p_firm_id, p_kind, 'firm', p_firm_id::text, NULL,
    CASE WHEN p_kind IN ('invitation_sent', 'invitation_withdrawn') THEN p_detail ->> 'role' END);
END;
$$;

REVOKE ALL ON FUNCTION public.record_firm_event(uuid, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
