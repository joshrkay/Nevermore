import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { handleReceiveRequest, logLevel, type ReceiveClient } from "./handler.ts";

// Receives the email provider's `email.received` webhooks for the receiving subdomain and records each message
// against the quote request whose reply address it was sent to (joshrkay/Nevermore#92, story M-3.2). The provider
// holds no Supabase login, so the gateway's JWT check is off for it (supabase/config.toml) and the request is
// trusted only if its signature verifies against RESEND_INBOUND_WEBHOOK_SECRET. The handling lives in handler.ts so
// it can be tested without Deno, the network or a scanner.
const log = (line: string) => console[logLevel(line)](line);

serve((req) =>
  handleReceiveRequest(req, {
    env: (name) => Deno.env.get(name),
    createClient: (url, key) =>
      createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) as unknown as ReceiveClient,
    fetch: (input, init) => fetch(input, init),
    scanner: {
      fetch: (input, init) => fetch(input, init),
      connect: ({ hostname, port, tls }) => (tls ? Deno.connectTls({ hostname, port }) : Deno.connect({ hostname, port })),
    },
    now: () => Date.now(),
    log,
  })
);
