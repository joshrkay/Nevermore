import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import type { BundleLinkClient } from "../bundle-link/handler.ts";
import { handleMessageFileRequest } from "./handler.ts";

// A file link on a message to a contact, /f#<token> (story CRM-E1.2b, slice 6.3; D-605). No sign-in: the gateway checks no JWT (supabase/config.toml)
// and this function works as the service role, asking the database only with the token's hash. The handling lives in handler.ts so it can be tested
// without Deno or the network.
serve((req) =>
  handleMessageFileRequest(req, {
    env: (name) => Deno.env.get(name),
    createClient: (url, key) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) as unknown as BundleLinkClient,
    fetch: (url) => fetch(url),
    log: (line) => console.error(line),
  })
);
