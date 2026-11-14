-- Exports pause while main's are set aside (founder, 2026-11-14; docs/BROKER_CRM_BUILD.md "Superseded by Epic 3"; D-218).
--
-- 20261118180000_epic3_export_supersedes.sql takes the exports main recorded out of the firm's record, into public.epic3_carried_exports, and
-- 20261119090500_epic3_export_carried.sql puts them back. Each migration is its own transaction, so between 20261119090000_export.sql (which
-- grants Epic 3's export_rows) and 20261119090500 a person can export from a record that lacks main's entries: the member's exports in the
-- hour are counted without them, so the owners' alert of a third can be missed, and an owner's export of the record comes out short.
-- Neither of those migrations is changed (rule 5, D-221), and export_rows does not exist yet here, so nothing can be revoked from it. So,
-- while the holding table exists, a new export's entry is refused instead: the export rolls back whole, gives no file and queues no alert,
-- and the page says it couldn't export (55000, in words). The entries 20261119090500 puts back keep the ids they had, which the holding table
-- lists, so they go in. Once 20261119090500 has dropped the table, the pause lets every export by; 20261119090600_epic3_export_pause_end.sql
-- takes it out. On a database where 20261119090500 already ran, the table is gone and the pause does nothing from the start.
--
-- A trigger only on an export's entry (WHEN kind = 'export_made'): every other entry of the record goes in as before, without the function
-- being called. An export whose entry waits for the holding table while 20261119090500 drops it fails on the missing table, and is refused
-- all the same, recording nothing. Nothing reads the holding table but this and 20261119090500, as the owner, so no API role is given it.

CREATE FUNCTION public.epic3_export_pause()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Two steps: the table is named only once it is known to exist.
  IF to_regclass('public.epic3_carried_exports') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.epic3_carried_exports c WHERE c.id = NEW.id) THEN
      RAISE EXCEPTION 'Exports are paused for a minute while the firm''s record is upgraded. Try again in a minute.' USING ERRCODE = '55000';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.epic3_export_pause() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER firm_activity_export_pause
  BEFORE INSERT ON public.firm_activity
  FOR EACH ROW
  WHEN (NEW.kind = 'export_made')
  EXECUTE FUNCTION public.epic3_export_pause();
