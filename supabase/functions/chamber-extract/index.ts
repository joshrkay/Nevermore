import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { handleRequest } from "./handler.ts";

// The request handling lives in handler.ts so it can be tested without Deno or the network.
serve((req) =>
  handleRequest(req, {
    env: (name) => Deno.env.get(name),
    createClient,
    fetch: (input, init) => fetch(input, init),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => Date.now(),
    logError: (line) => console.error(line),
    newRequestId: () => crypto.randomUUID(),
  })
);
