import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { handleHeldMailRequest, type HeldMailClient } from "./handler.ts";

// The holding list's file work (joshrkay/Nevermore#92, story M-3.3): moving a message's files with it and removing
// them when it is discarded or expires. The gateway checks the caller's JWT; handler.ts checks who they are and the
// database checks their role. The handling lives in handler.ts so it can be tested without Deno or the network.
serve((req) =>
  handleHeldMailRequest(req, {
    env: (name) => Deno.env.get(name),
    createClient: (url, key, options) =>
      createClient(url, key, { ...options, auth: { persistSession: false, autoRefreshToken: false } }) as unknown as HeldMailClient,
    log: (line) => (line.startsWith("HELD_MAIL_DISCARDED") || line.startsWith("HELD_MAIL_MOVED") ? console.log(line) : console.error(line)),
  })
);
