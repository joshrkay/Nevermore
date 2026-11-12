import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { handleMailboxRequest, type MailboxClient } from "./handler.ts";

// Connects, checks and disconnects a broker's own mailbox (joshrkay/Nevermore#92, story M-4.3). The gateway checks the
// caller's JWT; handler.ts checks who they are and the database checks their role. The handling lives in handler.ts so
// it can be tested without Deno or the network.
serve((req) =>
  handleMailboxRequest(req, {
    env: (name) => Deno.env.get(name),
    createClient: (url, key, options) =>
      createClient(url, key, { ...options, auth: { persistSession: false, autoRefreshToken: false } }) as unknown as MailboxClient,
    fetch: (input, init) => fetch(input, init),
    log: (line) => (line.startsWith("MAILBOX_CONNECTED") || line.startsWith("MAILBOX_DISCONNECTED") ? console.log(line) : console.error(line)),
  })
);
