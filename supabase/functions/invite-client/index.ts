import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { newInvitationToken } from "../_shared/invitationToken.ts";
import { handleInviteClientRequest, type InviteClientClient } from "./handler.ts";

// Emails the client of a broker-started intake the link to finish and certify it, or sends it again (slice 5.3, P-2.2). The gateway checks the caller's JWT; the database checks that they are
// a member of the intake's firm. The handling lives in handler.ts so it can be tested without Deno or the network. Only the kind of a failure is logged: never the token, an email
// address or the provider's reply.
serve((req) =>
  handleInviteClientRequest(req, {
    env: (name) => Deno.env.get(name),
    createClient: (url, key, options) =>
      createClient(url, key, { ...options, auth: { persistSession: false, autoRefreshToken: false } }) as unknown as InviteClientClient,
    fetch,
    newToken: newInvitationToken,
    log: (line) => (line.startsWith("INVITE_CLIENT_REFUSED") ? console.log(line) : console.error(line)),
  })
);
