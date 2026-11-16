-- The bundle link a PEO opens (M-2.1's third criterion, slice 6.6b; ADR 0003; docs/BROKER_CRM_BUILD.md D-609, D-640 to D-649;
-- supabase/tests/bundle_links.sql). An advisor's send (slice 6.6) carries a link, never a file: /b/<token> opens with no sign-in, through the
-- edge function bundle-link, and shows the employer, the File ID and version, each file with its own download, and the open items.

-- ---------- 1. The table ----------
-- One row per link issued. The token is never kept: only its SHA-256 in hex, which is what the edge function sends. A quote request has at most
-- one live link (not revoked); issuing again revokes the one before as 'replaced'.
CREATE TABLE public.bundle_links (
  id bigserial PRIMARY KEY,
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  quote_request_id bigint NOT NULL REFERENCES public.quote_requests (id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  version integer NOT NULL CONSTRAINT bundle_links_version_check CHECK (version > 0),
  token_hash text NOT NULL CONSTRAINT bundle_links_token_hash_key UNIQUE CONSTRAINT bundle_links_token_hash_check CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  -- The made files are stored at bundle-links/<quote request>/<folder>/<n>-<name>; a document is named by its id, not copied.
  folder uuid NOT NULL,
  files jsonb NOT NULL,
  open_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  issued_by uuid,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_reason text
);

-- Why a link was revoked (D-609): a newer link for the same PEO, a newer version sent (M-2.3), the quote request withdrawn (M-2.4), the
-- submission closed (Won, Lost, Archived), the employer withdrawing the PEO (M-1.1), or the advisor's own revoke.
ALTER TABLE public.bundle_links ADD CONSTRAINT bundle_links_revoked_check CHECK (
  (revoked_at IS NULL) = (revoked_reason IS NULL)
  AND (revoked_reason IS NULL OR revoked_reason IN ('replaced', 'newer_version', 'withdrawn', 'submission_closed', 'authorization_withdrawn', 'revoked_by_advisor')));

-- One live link per quote request.
CREATE UNIQUE INDEX bundle_links_one_live ON public.bundle_links (quote_request_id) WHERE revoked_at IS NULL;

COMMENT ON TABLE public.bundle_links IS 'A link a PEO opens to download a certified bundle, 30 days (glossary: Bundle link). Only the token''s hash is kept.';

-- Closed to the API, its own firm's members included: the functions below write it and the edge function reads it through them (slice 6.6 adds
-- what the advisor's screen reads).
ALTER TABLE public.bundle_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bundle_links FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.bundle_links_id_seq FROM PUBLIC, anon, authenticated, service_role;

-- Every link issued and every one revoked is on its quote request's timeline (quote_request_events, field bundle_link), with who did it when a
-- person did: whatever writes the row, so no link changes unlogged. Never the token or its hash.
CREATE FUNCTION public.log_bundle_link_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.quote_request_events (quote_request_id, session_id, field, new_value, changed_by, changed_by_email)
    VALUES (NEW.quote_request_id, NEW.session_id, 'bundle_link', 'Issued for version ' || NEW.version, auth.uid(), auth.jwt() ->> 'email');
  ELSIF OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL THEN
    INSERT INTO public.quote_request_events (quote_request_id, session_id, field, new_value, changed_by, changed_by_email)
    VALUES (NEW.quote_request_id, NEW.session_id, 'bundle_link', 'Revoked: ' || NEW.revoked_reason, auth.uid(), auth.jwt() ->> 'email');
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.log_bundle_link_change() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER bundle_links_log_change AFTER INSERT OR UPDATE ON public.bundle_links FOR EACH ROW EXECUTE FUNCTION public.log_bundle_link_change();

-- ---------- 2. Issuing a link ----------
CREATE FUNCTION public.issue_bundle_link(p_quote_request_id bigint, p_version integer, p_folder uuid, p_files jsonb, p_open_items jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  req public.quote_requests;
  firm uuid;
  token text := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
  link public.bundle_links;
BEGIN
  -- Closing firms are read-only (ADR 0023), and so is a support session (ADR 0024): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.quote_requests zq JOIN public.chamber_sessions zs ON zs.id = zq.session_id WHERE zq.id = p_quote_request_id));
  PERFORM public.require_advisor();
  -- Only a quote request of the caller's own firm; another firm's is not there for them. Locked, so two issues one after the other.
  SELECT q.* INTO req FROM public.quote_requests q WHERE q.id = p_quote_request_id AND public.quote_request_in_my_firm(q.id) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote request not found' USING ERRCODE = 'PT404';
  END IF;
  IF req.status = 'closed' THEN
    RAISE EXCEPTION 'This quote request is closed. Record a send to % to reopen it', req.peo_name USING ERRCODE = '22023';
  END IF;
  -- The database refuses a link for a PEO the employer has not authorized, or withdrew, as it refuses a send (M-1.1, slice 6.6a).
  PERFORM public.assert_peo_authorized(req.session_id, req.peo_name);
  IF p_version IS NULL OR NOT EXISTS (SELECT 1 FROM public.chamber_certifications c WHERE c.session_id = req.session_id AND c.version = p_version) THEN
    RAISE EXCEPTION 'Version % of this submission was never certified', COALESCE(p_version::text, '(none)') USING ERRCODE = '22023';
  END IF;
  -- What the page lists: one or more files, each a name that is one part of a storage path (no slash, no control character) and what it is;
  -- the open items a list.
  IF jsonb_typeof(p_files) IS DISTINCT FROM 'array' OR jsonb_array_length(p_files) = 0 OR jsonb_array_length(p_files) > 100
     OR jsonb_typeof(COALESCE(p_open_items, '[]'::jsonb)) <> 'array'
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_files) f
       WHERE jsonb_typeof(f) <> 'object' OR jsonb_typeof(f -> 'name') IS DISTINCT FROM 'string' OR jsonb_typeof(f -> 'what') IS DISTINCT FROM 'string'
          OR btrim(f ->> 'name') = '' OR char_length(f ->> 'name') > 120 OR f ->> 'name' ~ '[/\\[:cntrl:]]' OR f ->> 'name' IN ('.', '..')
          OR btrim(f ->> 'what') = '' OR char_length(f ->> 'what') > 200) THEN
    RAISE EXCEPTION 'A link lists one or more files, each with a name and what it is' USING ERRCODE = '22023';
  END IF;
  -- A document is named, not copied: only one of this intake whose scan passed (clean, or skipped where no scanner is set up), as a download
  -- of it is anywhere else in the product.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_files) f
    WHERE f ? 'document_id' AND NOT EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id::text = f ->> 'document_id' AND d.session_id = req.session_id AND d.scan_verdict IN ('clean', 'skipped'))) THEN
    RAISE EXCEPTION 'A link carries only this submission''s documents that passed their scan' USING ERRCODE = '22023';
  END IF;
  SELECT s.firm_id INTO firm FROM public.chamber_sessions s WHERE s.id = req.session_id;
  -- The link before, if any, stops working now (one live link per quote request).
  UPDATE public.bundle_links SET revoked_at = now(), revoked_reason = 'replaced' WHERE quote_request_id = req.id AND revoked_at IS NULL;
  INSERT INTO public.bundle_links (firm_id, quote_request_id, session_id, version, token_hash, folder, files, open_items, issued_by, expires_at)
  VALUES (firm, req.id, req.session_id, p_version, encode(extensions.digest(token, 'sha256'), 'hex'), p_folder, p_files, COALESCE(p_open_items, '[]'::jsonb),
          auth.uid(), now() + interval '30 days')
  RETURNING * INTO link;
  RETURN jsonb_build_object('id', link.id, 'token', token, 'expires_at', link.expires_at, 'version', link.version);
END;
$$;

REVOKE ALL ON FUNCTION public.issue_bundle_link(bigint, integer, uuid, jsonb, jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.issue_bundle_link(bigint, integer, uuid, jsonb, jsonb) TO authenticated;

-- ---------- 3. Revoking ----------
-- What the employer withdrawing a PEO (M-1.1), a newer version sent (M-2.3), a withdrawal and a submission closing (M-2.4) call, inside their
-- own write: revokes the quote request's live link, if any, with the reason, and answers how many it revoked (0 or 1). It asks no guard of its
-- own (not the closing guard either: the caller is already a guarded write, or the platform's), so no API role may call it.
CREATE FUNCTION public.bundle_link_revoke(p_quote_request_id bigint, p_reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  n integer;
BEGIN
  IF p_reason IS NULL OR p_reason NOT IN ('replaced', 'newer_version', 'withdrawn', 'submission_closed', 'authorization_withdrawn', 'revoked_by_advisor') THEN
    RAISE EXCEPTION 'A link is revoked for a known reason, not %', COALESCE(p_reason, 'none') USING ERRCODE = '22023';
  END IF;
  UPDATE public.bundle_links SET revoked_at = now(), revoked_reason = p_reason WHERE quote_request_id = p_quote_request_id AND revoked_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.bundle_link_revoke(bigint, text) FROM PUBLIC, anon, authenticated, service_role;

-- The advisor's own revoke (a link sent to the wrong address, say): a firm write, guarded as every one is (ADR 0023, 0024), for a quote request
-- of the caller's own firm. Answers how many it revoked (0 or 1).
CREATE FUNCTION public.revoke_bundle_link(p_quote_request_id bigint, p_reason text DEFAULT 'revoked_by_advisor')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.quote_requests zq JOIN public.chamber_sessions zs ON zs.id = zq.session_id WHERE zq.id = p_quote_request_id));
  PERFORM public.require_advisor();
  PERFORM 1 FROM public.quote_requests q WHERE q.id = p_quote_request_id AND public.quote_request_in_my_firm(q.id) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote request not found' USING ERRCODE = 'PT404';
  END IF;
  RETURN public.bundle_link_revoke(p_quote_request_id, COALESCE(p_reason, 'revoked_by_advisor'));
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_bundle_link(bigint, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_bundle_link(bigint, text) TO authenticated;

-- ---------- 4. Guessing ----------
-- Each token that opens nothing, by the hash of the address it came from (the edge function hashes it; no address and no token is kept). 20 in
-- an hour, and that address is refused for the hour, a live link too. A live link's own use is never one. Rows past the hour are removed as new
-- ones come. The platform's, not a firm's: closed to the API.
CREATE TABLE public.bundle_link_misses (
  id bigserial PRIMARY KEY,
  address_hash text NOT NULL CONSTRAINT bundle_link_misses_address_hash_check CHECK (address_hash ~ '^[0-9a-f]{64}$'),
  missed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bundle_link_misses_address_idx ON public.bundle_link_misses (address_hash, missed_at);
CREATE INDEX bundle_link_misses_at_idx ON public.bundle_link_misses (missed_at);

COMMENT ON TABLE public.bundle_link_misses IS 'A bundle link token that opened nothing, by the hash of the address it came from; kept one hour, for the guessing limit.';

ALTER TABLE public.bundle_link_misses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bundle_link_misses FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.bundle_link_misses_id_seq FROM PUBLIC, anon, authenticated, service_role;

-- Whether an address has used up its misses for the hour.
CREATE FUNCTION public.bundle_link_address_refused(p_address_hash text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT count(*) >= 20 FROM public.bundle_link_misses m WHERE m.address_hash = p_address_hash AND m.missed_at > now() - interval '1 hour'
$$;

REVOKE ALL ON FUNCTION public.bundle_link_address_refused(text) FROM PUBLIC, anon, authenticated, service_role;

-- Counts one miss for an address and clears what is past the hour.
CREATE FUNCTION public.bundle_link_miss(p_address_hash text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.bundle_link_misses WHERE missed_at <= now() - interval '1 hour';
  INSERT INTO public.bundle_link_misses (address_hash) VALUES (p_address_hash);
END;
$$;

REVOKE ALL ON FUNCTION public.bundle_link_miss(text) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 5. Opening a link: what the edge function bundle-link asks, as the service role ----------
-- The function hashes the token (and the caller's address) itself; the database never sees either as it is. The answer is what /b/<token>
-- shows: the employer's company name as certified in the version linked, the File ID and version, the PEO, when it stops working, each file
-- numbered (its download asks by number), the open items stored with the link. Never the intake's id, the quote request's, or a storage path.
CREATE FUNCTION public.bundle_link_open(p_token_hash text, p_address_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  link public.bundle_links;
  peo text;
  cert public.chamber_certifications;
BEGIN
  IF public.bundle_link_address_refused(p_address_hash) THEN
    RETURN jsonb_build_object('state', 'refused');
  END IF;
  -- Live: not revoked and not past its day. Anything else (expired, revoked, unknown) is one answer, naming nobody, and a miss.
  SELECT b.* INTO link FROM public.bundle_links b WHERE b.token_hash = p_token_hash AND b.revoked_at IS NULL AND b.expires_at > now();
  IF NOT FOUND THEN
    PERFORM public.bundle_link_miss(p_address_hash);
    RETURN jsonb_build_object('state', 'gone');
  END IF;
  SELECT q.peo_name INTO peo FROM public.quote_requests q WHERE q.id = link.quote_request_id;
  -- And only while the employer still authorizes that PEO (M-1.1): withdrawing revokes the link too, but this holds even before it does.
  IF NOT public.peo_authorized(link.session_id, peo) THEN
    RETURN jsonb_build_object('state', 'gone');
  END IF;
  SELECT c.* INTO cert FROM public.chamber_certifications c WHERE c.session_id = link.session_id AND c.version = link.version ORDER BY c.recorded_at DESC LIMIT 1;
  RETURN jsonb_build_object(
    'state', 'open',
    'company_name', cert.chamber_data ->> 'company_name',
    'file_id', cert.file_id,
    'version', link.version,
    'peo', peo,
    'expires_at', link.expires_at,
    'files', (SELECT jsonb_agg(jsonb_build_object('n', f.n, 'name', f.f ->> 'name', 'what', f.f ->> 'what') ORDER BY f.n)
              FROM jsonb_array_elements(link.files) WITH ORDINALITY AS f (f, n)),
    'open_items', link.open_items);
END;
$$;

REVOKE ALL ON FUNCTION public.bundle_link_open(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bundle_link_open(text, text) TO service_role;

-- ---------- 6. Downloading a file: what the edge function asks, as the service role ----------
-- Where file n of a live link is, for the function to sign for 60 seconds and pass on; the browser never sees it. A made file is in the link's
-- folder (bundle-links/<quote request>/<folder>/<n>-<name>); a document where the intake keeps it. Each download is on the quote request's
-- timeline: field bundle_download, "<what it is> (<file name>)", no person (whoever holds the link is not one we know).
CREATE FUNCTION public.bundle_link_file(p_token_hash text, p_n integer, p_address_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  link public.bundle_links;
  f jsonb;
  loc jsonb;
BEGIN
  -- Nothing for an address over its limit, a link that is not live (a miss, as opening one is), a PEO the employer no longer authorizes, or a
  -- file the link does not have. Nothing is logged for any of them.
  IF public.bundle_link_address_refused(p_address_hash) THEN
    RETURN NULL;
  END IF;
  SELECT b.* INTO link FROM public.bundle_links b WHERE b.token_hash = p_token_hash AND b.revoked_at IS NULL AND b.expires_at > now();
  IF NOT FOUND THEN
    PERFORM public.bundle_link_miss(p_address_hash);
    RETURN NULL;
  END IF;
  IF NOT public.peo_authorized(link.session_id, (SELECT q.peo_name FROM public.quote_requests q WHERE q.id = link.quote_request_id)) THEN
    RETURN NULL;
  END IF;
  IF p_n IS NULL OR p_n < 1 OR p_n > jsonb_array_length(link.files) THEN
    RETURN NULL;
  END IF;
  f := link.files -> (p_n - 1);
  IF f ? 'document_id' THEN
    SELECT jsonb_build_object('bucket', 'documents', 'path', d.storage_path, 'name', f ->> 'name') INTO loc
    FROM public.documents d WHERE d.id::text = f ->> 'document_id' AND d.session_id = link.session_id AND d.scan_verdict IN ('clean', 'skipped');
    IF loc IS NULL THEN
      RETURN NULL;
    END IF;
  ELSE
    loc := jsonb_build_object('bucket', 'bundle-links', 'path', link.quote_request_id || '/' || link.folder || '/' || p_n || '-' || (f ->> 'name'), 'name', f ->> 'name');
  END IF;
  INSERT INTO public.quote_request_events (quote_request_id, session_id, field, new_value)
  VALUES (link.quote_request_id, link.session_id, 'bundle_download', (f ->> 'what') || ' (' || (f ->> 'name') || ')');
  RETURN loc;
END;
$$;

REVOKE ALL ON FUNCTION public.bundle_link_file(text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bundle_link_file(text, integer, text) TO service_role;

-- ---------- 7. Where a link's made files are kept ----------
-- A private bucket. The advisor's browser stores a link's made files (the packet, the census file, the application data, the supplement, the
-- answers as JSON) at <quote request>/<folder>/<n>-<name> before it issues the link; documents stay where the intake keeps them. Nobody reads the
-- bucket through the API: the edge function signs a file for 60 seconds as the service role, after bundle_link_file.
INSERT INTO storage.buckets (id, name, public)
VALUES ('bundle-links', 'bundle-links', false)
ON CONFLICT (id) DO NOTHING;

-- Is this a place the caller may store a link's file? Its first folder is a quote request of their own firm, the second a folder's uuid, the
-- name has no deeper folder, and they are no support session (a support session stores nothing).
CREATE FUNCTION public.bundle_link_folder_in_my_firm(p_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  parts text[] := string_to_array(p_name, '/');
BEGIN
  IF array_length(parts, 1) IS DISTINCT FROM 3 OR parts[1] !~ '^[1-9][0-9]{0,17}$'
     OR parts[2] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR NOT public.quote_request_in_my_firm(parts[1]::bigint) THEN
    RETURN false;
  END IF;
  RETURN NOT EXISTS (
    SELECT 1 FROM public.quote_requests q JOIN public.chamber_sessions s ON s.id = q.session_id
    WHERE q.id = parts[1]::bigint AND public.is_support_session(s.firm_id));
END;
$$;

-- Is the firm of that quote request closing? Volatile, and it takes the firm row FOR KEY SHARE as the manuscripts' policies do
-- (intake_folder_firm_read_only, 20261118111000), so a request to close waits for a file being stored and one stored after it is refused.
CREATE FUNCTION public.bundle_link_folder_read_only(p_name text)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  fid uuid;
BEGIN
  IF NOT public.bundle_link_folder_in_my_firm(p_name) THEN
    RETURN false;
  END IF;
  SELECT s.firm_id INTO fid FROM public.quote_requests q JOIN public.chamber_sessions s ON s.id = q.session_id WHERE q.id = split_part(p_name, '/', 1)::bigint;
  PERFORM 1 FROM public.firms f WHERE f.id = fid FOR KEY SHARE;
  RETURN public.firm_is_read_only(fid);
END;
$$;

REVOKE ALL ON FUNCTION public.bundle_link_folder_in_my_firm(text), public.bundle_link_folder_read_only(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.bundle_link_folder_in_my_firm(text), public.bundle_link_folder_read_only(text) TO authenticated;

CREATE POLICY "Firm members can store a bundle link's files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bundle-links' AND public.bundle_link_folder_in_my_firm(name) AND NOT public.bundle_link_folder_read_only(name));

-- ---------- 8. Deleted with the intake ----------
-- intake_stored_files (20261111110000), restated with every bucket it had and the intake's link files: those under any of its quote requests.
-- The deletion job removes what it lists and completing refuses while any is left; the rows go with their quote request (ON DELETE CASCADE).
CREATE OR REPLACE FUNCTION public.intake_stored_files(p_session_id uuid, p_user_id uuid)
RETURNS TABLE (bucket text, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.bucket_id::text, o.name::text
  FROM storage.objects o
  WHERE (o.bucket_id IN ('documents', 'quarantine') AND p_user_id IS NOT NULL
         AND o.name LIKE p_user_id::text || '/' || p_session_id::text || '/%')
     OR (o.bucket_id IN ('manuscripts', 'peo-mail') AND o.name LIKE p_session_id::text || '/%')
     OR (o.bucket_id = 'bundle-links'
         AND split_part(o.name, '/', 1) IN (SELECT q.id::text FROM public.quote_requests q WHERE q.session_id = p_session_id))
  ORDER BY 1, 2;
$$;
REVOKE ALL ON FUNCTION public.intake_stored_files(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.intake_stored_files(uuid, uuid) TO service_role;

-- ---------- 9. Kept when a firm closes ----------
-- The closing's one list (20261122100000, slice 6.6a), restated with every line it had, and a link and its files kept: they are a quote request's, and a quote
-- request is an intake's, which stays with its employer; they are deleted with the intake (section 8).
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
    (900, 'public.peo_authorizations', 'keep', NULL, 'the employer''s own say over which PEOs may receive their packet; an intake''s'),
    (900, 'public.bundle_links', 'keep', NULL, 'a quote request''s links to its bundle: they go with the intake, under the intake retention rules'),
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
    (900, 'storage.objects WHERE bucket_id = ''bundle-links''', 'keep', NULL, 'an intake''s files: a bundle link''s made files, deleted with the intake'),
    (900, 'storage.objects WHERE bucket_id = ''documents''', 'keep', NULL, 'an intake''s files'),
    (900, 'storage.objects WHERE bucket_id = ''manuscripts''', 'keep', NULL, 'an intake''s files'),
    (900, 'storage.objects WHERE bucket_id = ''peo-mail''', 'keep', NULL, 'an intake''s files')
  ) AS t (ord, src, action, firm_column, why)
$$;
