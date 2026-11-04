import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { handleScanRequest, type ScanClient } from "./handler.ts";

// Scans pending uploads on a schedule (every five minutes; migration 20261104130000_document_scanning.sql
// and docs/RUNBOOK.md). The request handling lives in handler.ts so it can be tested without Deno, the
// network or a scanner.
serve((req) =>
  handleScanRequest(req, {
    env: (name) => Deno.env.get(name),
    createClient: (url, key) =>
      createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) as unknown as ScanClient,
    scanner: {
      fetch: (input, init) => fetch(input, init),
      connect: ({ hostname, port, tls }) => (tls ? Deno.connectTls({ hostname, port }) : Deno.connect({ hostname, port })),
    },
    fetch: (input, init) => fetch(input, init),
    now: () => Date.now(),
    log: (line) => console.error(line),
  })
);
