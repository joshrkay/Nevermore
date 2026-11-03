import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { handleRequest, type SupabaseLike } from "./handler.ts";

// The request handling lives in handler.ts so it can be tested without Deno or the network.
// The real client does what SupabaseLike describes, but its query-builder generics are too deep for
// tsc to compare structurally (TS2589), so it is adapted here; the e2e suite runs the handler against
// the real client.
const client = (url: string, key: string, options?: { global?: { headers: Record<string, string> } }) =>
  createClient(url, key, options) as unknown as SupabaseLike;

serve((req) =>
  handleRequest(req, {
    env: (name) => Deno.env.get(name),
    createClient: client,
    fetch: (input, init) => fetch(input, init),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => Date.now(),
    logError: (line) => console.error(line),
    newRequestId: () => crypto.randomUUID(),
  })
);
