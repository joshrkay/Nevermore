import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { handleTemplateUpload, type TemplateClient } from "./handler.ts";

// The request handling lives in handler.ts so it can be tested without Deno, the network or a scanner. The real
// client does what TemplateClient describes, but its generics are too deep for tsc to compare (TS2589), so it is
// adapted here, as in document-upload.
const client = (url: string, key: string, options?: { global?: { headers: Record<string, string> } }) =>
  createClient(url, key, { ...options, auth: { persistSession: false, autoRefreshToken: false } }) as unknown as TemplateClient;

serve((req) =>
  handleTemplateUpload(req, {
    env: (name) => Deno.env.get(name),
    createClient: client,
    scanner: {
      fetch: (input, init) => fetch(input, init),
      connect: ({ hostname, port, tls }) => (tls ? Deno.connectTls({ hostname, port }) : Deno.connect({ hostname, port })),
    },
    fetch: (input, init) => fetch(input, init),
    log: (line) => console.error(line),
    newRequestId: () => crypto.randomUUID(),
  })
);
