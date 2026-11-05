import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { handleRequest } from "./handler.ts";

// Alerts engineering when a failure kind crosses its threshold, every five minutes from the database's
// schedule (migration 20261104091000_ops_monitoring.sql, docs/RUNBOOK.md), and sends a test alert on
// request ({"test": true}). The request handling lives in handler.ts so it can be tested without Deno or
// the network.
serve((req) =>
  handleRequest(req, {
    env: (name) => Deno.env.get(name),
    createClient: (url, key) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
    fetch: (input, init) => fetch(input, init),
    log: (line) => console.error(line),
    now: () => Date.now(),
  })
);
