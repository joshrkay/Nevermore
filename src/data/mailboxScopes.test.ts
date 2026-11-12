import { describe, expect, it } from "vitest";
import {
  ALLOWED_SCOPES, BROKER_PROVIDERS, brokerQueryParams, brokerScopes, GOOGLE_SEND_SCOPE, isBrokerProvider, MICROSOFT_SEND_SCOPE, SUPABASE_PROVIDER,
} from "./mailboxScopes";

describe("what a broker's sign-in asks for", () => {
  it("asks Google for the send permission and nothing else", () => {
    expect(brokerScopes("google").split(" ")).toEqual([GOOGLE_SEND_SCOPE]);
  });

  it("asks Microsoft for the send permission and offline access, nothing else", () => {
    expect(brokerScopes("microsoft").split(" ")).toEqual([MICROSOFT_SEND_SCOPE, "offline_access"]);
  });

  it("never asks to read, list or search a mailbox, whatever the provider", () => {
    // A deliberate change here also changes ADR 0005 and what the Privacy Policy tells people.
    for (const provider of BROKER_PROVIDERS) {
      for (const scope of brokerScopes(provider).split(" ")) {
        expect(ALLOWED_SCOPES, `${provider} asks for ${scope}`).toContain(scope);
        expect(scope).not.toMatch(/read|readonly|modify|compose|insert|labels|settings|full_access|mail\.google\.com|contacts|calendar|files|\.all$/i);
      }
    }
    expect(ALLOWED_SCOPES.filter((s) => /read|modify|full/i.test(s))).toEqual([]);
  });

  it("asks Google for offline access, with consent each time, so there is a refresh token to send with", () => {
    expect(brokerQueryParams("google")).toEqual({ access_type: "offline", prompt: "consent" });
    expect(brokerQueryParams("microsoft")).toBeUndefined();
  });

  it("names Supabase's provider for each, and recognises only these two", () => {
    expect(SUPABASE_PROVIDER).toEqual({ google: "google", microsoft: "azure" });
    expect(isBrokerProvider("google")).toBe(true);
    expect(isBrokerProvider("microsoft")).toBe(true);
    for (const other of ["github", "azure", "", null, undefined, 5]) expect(isBrokerProvider(other)).toBe(false);
  });
});
