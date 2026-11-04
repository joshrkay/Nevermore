-- Security review fixes (US-6.3). docs/SECURITY_REVIEW.md has the findings; supabase/tests/data_isolation.sql
-- checks each of these and fails if a later migration undoes them.
--
-- None of these was reachable through the Data API as it is used today (PostgREST does not expose trigger
-- functions or TRUNCATE, and row security already refused the rest). Each removes a privilege nothing
-- legitimate uses, so a future mistake elsewhere can't turn it into a hole.
--
-- * SR-1: trigger functions were executable by anon and authenticated (Supabase grants EXECUTE on new
--   functions to the API roles by default). A trigger fires whatever its function's EXECUTE privilege is, so
--   revoking it changes nothing for the triggers; handle_new_user is SECURITY DEFINER, which made it the one
--   that mattered most.
-- * SR-2: require_advisor() was executable by signed-out callers. Signed-in callers keep it:
--   advisor_list_submissions() runs as the caller and calls it.
-- * SR-3: anon and authenticated held TRUNCATE, REFERENCES and TRIGGER on public tables. TRUNCATE ignores row
--   security entirely. Revoked from every existing table and from the defaults for tables created later.
-- * SR-4: the AI rate-limit tables granted INSERT, UPDATE, DELETE and SELECT to the API roles, refused only
--   by row security with no policy. Only SECURITY DEFINER functions touch them, so the grants are removed.
-- * SR-5: a prospect could still change their documents' rows (category, status, extraction) on an expired
--   intake, which the lifecycle (20261103090000) says can no longer be changed. Updates now need an open
--   intake, as uploads already do. Removing a document from an expired draft stays allowed: it only removes
--   the prospect's own data, ahead of the retention deletion.

-- ---------- SR-1: trigger functions ----------

DO $$
DECLARE
  f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
END $$;

-- ---------- SR-2: require_advisor ----------

REVOKE ALL ON FUNCTION public.require_advisor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.require_advisor() TO authenticated, service_role;

-- ---------- SR-3: TRUNCATE, REFERENCES, TRIGGER ----------

REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- Tables created later by the role running migrations. A role that may not change its defaults gets a
-- warning, never a failed deploy; the data_isolation test still catches a table that keeps them.
DO $$
BEGIN
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon, authenticated;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'security review: could not change the default table privileges (%); revoke TRUNCATE, REFERENCES and TRIGGER on each new table instead', SQLERRM;
END $$;

-- ---------- SR-4: AI rate-limit tables ----------

REVOKE ALL ON public.ai_request_log, public.ai_ip_log, public.ai_global_usage FROM anon, authenticated;

-- ---------- SR-5: document rows on a closed intake ----------

DROP POLICY IF EXISTS "Users can update documents in their own sessions" ON public.documents;
CREATE POLICY "Users can update documents in their own sessions"
ON public.documents FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.chamber_sessions s
    WHERE s.id = session_id AND s.user_id = auth.uid() AND s.status IN ('in_progress', 'submitted')
  )
)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.chamber_sessions s
    WHERE s.id = session_id AND s.user_id = auth.uid() AND s.status IN ('in_progress', 'submitted')
  )
);
