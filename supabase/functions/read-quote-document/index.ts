import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { readDocument } from "../document-extract/read.ts";
import { handleReadQuoteDocument, type QuoteReadClient } from "./handler.ts";

// The request handling lives in handler.ts so it can be tested without Deno, the network or the file readers. The real client does what QuoteReadClient describes, but its
// query-builder generics are too deep for tsc to compare structurally (TS2589), so it is adapted here.
const client = (url: string, key: string, options?: { global?: { headers: Record<string, string> } }) =>
  createClient(url, key, options) as unknown as QuoteReadClient;

serve((req) =>
  handleReadQuoteDocument(req, {
    env: (name) => Deno.env.get(name),
    createClient: client,
    readDocument,
    fetch: (input, init) => fetch(input, init),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => Date.now(),
    logError: (line) => console.error(line),
    newRequestId: () => crypto.randomUUID(),
  })
);
