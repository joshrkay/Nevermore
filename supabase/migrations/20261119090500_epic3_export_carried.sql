-- The exports main recorded, put back in Epic 3's shape (founder, 2026-11-14; docs/BROKER_CRM_BUILD.md "Superseded by Epic 3"; D-218).
--
-- 20261118180000_epic3_export_supersedes.sql set main's export entries aside (main's export_table wrote them, 20261118170000 to
-- 20261118171000) so that 20261119090000_export.sql could add firm_activity.row_count and its rule as written. Each comes back now with
-- every column it had: the same number, key, time, actor, table and count, so the record reads as if the export had been made by Epic 3's
-- export_rows, and the outbox alerts that name an entry by its key still name it. Epic 3's rule (firm_activity_export_check: an export_made
-- entry, and only one, carries a count and is about a table) checks each as it is inserted, so an entry that does not fit fails here,
-- loudly, rather than being dropped or changed. The record is append-only and is only added to here; no row of it is changed.

SET lock_timeout = '5s';

INSERT INTO public.firm_activity (id, entry_key, firm_id, at, actor_id, actor_is_staff, kind, record_type, record_id, subject_user_id, role, row_count)
OVERRIDING SYSTEM VALUE
SELECT c.id, c.entry_key, c.firm_id, c.at, c.actor_id, c.actor_is_staff, c.kind, c.record_type, c.record_id, c.subject_user_id, c.role, c.row_count
FROM public.epic3_carried_exports c
ORDER BY c.id;

DROP TABLE public.epic3_carried_exports;
