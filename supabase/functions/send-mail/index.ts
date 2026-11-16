import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { handleSendMailRequest, type SendMailClient } from "./handler.ts";

// Sends the messages agents write to contacts and leads through their own connected mailbox (story CRM-E1.2a). The handling lives in handler.ts so it
// can be tested without Deno or the network.
serve((req) =>
  handleSendMailRequest(req, {
    env: (name) => Deno.env.get(name),
    createClient: (url, key, options) =>
      createClient(url, key, { ...options, auth: { persistSession: false, autoRefreshToken: false } }) as unknown as SendMailClient,
    fetch: (input, init) => fetch(input, init),
    now: () => new Date(),
    log: (line) => (line.startsWith("SEND_MAIL_FAILED") || line.startsWith("SEND_MAIL_CONFIG") || line.startsWith("SEND_MAIL_CLAIM") ? console.error(line) : console.log(line)),
  })
);
