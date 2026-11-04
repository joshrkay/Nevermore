import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { handleRequest } from "./handler.ts";

// Carries out intake deletions on a schedule (hourly; migration 20261104092000_data_retention_and_deletion.sql
// and docs/DATA_HANDLING.md). The request handling lives in handler.ts so it can be tested without Deno or
// the network.
serve((req) =>
  handleRequest(req, {
    env: (name) => Deno.env.get(name),
    createClient: (url, key) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
    fetch: (input, init) => fetch(input, init),
    now: () => Date.now(),
    log: (line) => (line.startsWith("DELETION_DONE") ? console.log(line) : console.error(line)),
  })
);
