import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../..");
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

// The provider holds no Supabase login, so the gateway's JWT check must be off for this function:
// left on, every webhook is refused before the function sees it, and bounces silently stop
// being processed. The function checks the webhook's own signature instead.
describe("how the webhook function is deployed", () => {
  it("has the gateway's JWT check turned off in supabase/config.toml", () => {
    expect(read("supabase/config.toml")).toMatch(/\[functions\.resend-webhook\]\s*\n\s*verify_jwt\s*=\s*false/);
  });

  // Break caught (found by mutation): a gateway that checks a JWT refuses every visitor before the function sees them, so the "contact me" form never works.
  it("has the gateway's JWT check turned off for the contact-request function, which checks a Turnstile token instead", () => {
    expect(read("supabase/config.toml")).toMatch(/\[functions\.contact-request\]\s*\n\s*verify_jwt\s*=\s*false/);
  });

  it("leaves it on for every other function", () => {
    const toml = read("supabase/config.toml");
    const sections = [...toml.matchAll(/\[functions\.([a-z-]+)\]/g)].map((m) => m[1]);
    // The two the email provider calls with a signature instead of a login, and the bundle link a PEO opens with no sign-in (ADR 0003),
    // which answers only a live link's token.
    // And the file link a contact opens from an agent's message (D-605), which answers only a live link's token too.
    // And the "contact me" form a visitor on a firm's link posts (slice 8.7b): nobody signs in, so the function checks a Turnstile token instead of a JWT.
    expect(sections).toEqual(["resend-webhook", "receive-mail", "bundle-link", "message-file", "contact-request"]);
  });

  it("is checked on a signed-out call by the setup, which relies on its own 401", () => {
    const lib = read("scripts/supabase-setup-lib.mjs");
    expect(lib).toMatch(/FUNCTIONS = \[[^\]]*"resend-webhook"/);
    expect(read("supabase/functions/resend-webhook/handler.ts")).toContain('respond(401, { error: "Unauthorized" })');
  });

  it("is documented where the secret is set", () => {
    expect(read("supabase/env.production.example")).toContain("RESEND_WEBHOOK_SECRET=");
  });
});
