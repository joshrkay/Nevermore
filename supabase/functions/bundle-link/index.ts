import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { handleBundleLinkRequest, type BundleLinkClient } from "./handler.ts";

// The page a PEO opens from an advisor's send, /b/<token> (M-2.1, slice 6.6b; ADR 0003). No sign-in: the gateway checks no JWT
// (supabase/config.toml) and this function works as the service role, asking the database only with the token's hash. The handling
// lives in handler.ts so it can be tested without Deno or the network.
serve((req) =>
  handleBundleLinkRequest(req, {
    env: (name) => Deno.env.get(name),
    createClient: (url, key) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) as unknown as BundleLinkClient,
    fetch: (url) => fetch(url),
    log: (line) => console.error(line),
  })
);
