import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { handleUploadRequest, type UploadClient } from "./handler.ts";

// The request handling lives in handler.ts so it can be tested without Deno, the network or a scanner. The
// real client does what UploadClient describes, but its query-builder generics are too deep for tsc to
// compare structurally (TS2589), so it is adapted here.
const client = (url: string, key: string, options?: { global?: { headers: Record<string, string> } }) =>
  createClient(url, key, { ...options, auth: { persistSession: false, autoRefreshToken: false } }) as unknown as UploadClient;

serve((req) =>
  handleUploadRequest(req, {
    env: (name) => Deno.env.get(name),
    createClient: client,
    scanner: {
      fetch: (input, init) => fetch(input, init),
      connect: ({ hostname, port, tls }) => (tls ? Deno.connectTls({ hostname, port }) : Deno.connect({ hostname, port })),
    },
    fetch: (input, init) => fetch(input, init),
    log: (line) => console.error(line),
    newRequestId: () => crypto.randomUUID(),
    newId: () => crypto.randomUUID(),
  })
);
