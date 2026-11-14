-- The pause on exports ends (founder, 2026-11-14; docs/BROKER_CRM_BUILD.md "Superseded by Epic 3"; D-218).
--
-- 20261118180500_epic3_export_pause.sql refused a new export's entry while main's exports were set aside. 20261119090500_epic3_export_carried.sql
-- has put them back and dropped the holding table, so the pause already lets every export by; its trigger and function go now, so the record
-- takes an export's entry as Epic 3's 20261119090000_export.sql wrote it, with nothing in between. Dropping the trigger locks the record,
-- so the wait for that lock is bounded, as in 20261118180000 and 20261119090500.

SET lock_timeout = '5s';

DROP TRIGGER firm_activity_export_pause ON public.firm_activity;
DROP FUNCTION public.epic3_export_pause();
