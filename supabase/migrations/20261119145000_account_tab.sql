-- CRM-A2.1b: a tab of an account's page beyond its first five rows.
--
-- The page (account_page, 20261119140000) holds each tab's count and first five rows. The Contacts, Opportunities, Quotes and Activity tabs show the whole
-- list, so they ask for a page of rows from a place: this is the one function that gives it, the same wrapper account_files is for the Files tab. The rows
-- are built by account_tab_rows, the one internal function the page already uses, so the first five on the page and the rows of a tab are never two
-- different lists. Nothing here decides who may see what: the caller must be someone who may see the account (can_see_firm_record), and anyone else is
-- answered NULL, the same as for an account that is not there, at one firm at a time (the firm is named). It reads and changes nothing.

CREATE FUNCTION public.account_tab(p_firm_id uuid, p_account_id uuid, p_tab text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  a public.accounts;
BEGIN
  IF p_firm_id IS NULL OR p_account_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT * INTO a FROM public.accounts x WHERE x.id = p_account_id AND x.firm_id = p_firm_id;
  IF a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RETURN NULL;
  END IF;
  RETURN public.account_tab_rows(a.id, p_tab, p_limit, p_offset);
END;
$$;

REVOKE ALL ON FUNCTION public.account_tab(uuid, uuid, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_tab(uuid, uuid, text, integer, integer) TO authenticated;
