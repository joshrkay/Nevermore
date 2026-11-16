import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { handleContactRequest, type ContactRequestClient } from "./handler.ts";

// The "contact me" form on a firm's public link (slice 8.7b, D-1670 to D-1679). No sign-in: the gateway checks no JWT (supabase/config.toml); this function checks a
// Cloudflare Turnstile token and then works as the service role, the one caller the database lets make a lead from a visitor's words. The handling lives in
// handler.ts so it can be tested without Deno or the network.
serve((req) =>
  handleContactRequest(req, {
    env: (name) => Deno.env.get(name),
    createClient: (url, key) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) as unknown as ContactRequestClient,
    fetch: (url, init) => fetch(url, init),
    log: (line) => console.error(line),
  })
);
