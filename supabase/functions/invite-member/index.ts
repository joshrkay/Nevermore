import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { newInvitationToken } from "../_shared/invitationToken.ts";
import { handleInviteRequest, type InviteClient } from "./handler.ts";

// Invites a member to a firm, or sends an invitation again (story CRM-P1.2). The gateway checks the caller's JWT; the
// database checks that they own the firm. The handling lives in handler.ts so it can be tested without Deno or the network.
// Only the kind of a failure is logged: never the token, an email address or the provider's reply.
serve((req) =>
  handleInviteRequest(req, {
    env: (name) => Deno.env.get(name),
    createClient: (url, key, options) =>
      createClient(url, key, { ...options, auth: { persistSession: false, autoRefreshToken: false } }) as unknown as InviteClient,
    fetch,
    newToken: newInvitationToken,
    log: (line) => (line.startsWith("INVITE_REFUSED") ? console.log(line) : console.error(line)),
  })
);
