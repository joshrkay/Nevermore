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
