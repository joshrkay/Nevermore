import { describe, expect, it, vi } from "vitest";
import { ensureSignerToken, isGuestCertificationRefusal, tokenIsGuest, type SignerAuth } from "./signerToken";

// An access token as Supabase Auth mints it, base64url without padding; only its claims matter here.
const token = (claims: Record<string, unknown>) => {
  const utf8 = String.fromCharCode(...new TextEncoder().encode(JSON.stringify(claims)));
  return `eyJhbGciOiJIUzI1NiJ9.${btoa(utf8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}.signature`;
};
const GUEST = token({ sub: "u1", is_anonymous: true });
const VERIFIED = token({ sub: "u1", is_anonymous: false, email: "jo@acme.com" });

const authWith = (held: string | null, refreshed: string | null | Error = null) => {
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: held ? { access_token: held } : null } })),
    refreshSession: vi.fn(async () => {
      if (refreshed instanceof Error) throw refreshed;
      return refreshed ? { data: { session: { access_token: refreshed } }, error: null } : { data: { session: null }, error: { message: "Invalid Refresh Token" } };
    }),
  } satisfies SignerAuth;
  return auth;
};

describe("tokenIsGuest", () => {
  it("reads the is_anonymous claim", () => {
    expect(tokenIsGuest(GUEST)).toBe(true);
    expect(tokenIsGuest(VERIFIED)).toBe(false);
  });

  it("reads a claim set whose base64url needs - and _ and padding", () => {
    // A name long enough, and with characters, that the encoding uses - or _ and drops its padding.
    expect(tokenIsGuest(token({ is_anonymous: false, name: "Jö Dœ ~~~ ???>>>" }))).toBe(false);
  });

  it("can't tell from a token without the claim, or one that isn't a token", () => {
    expect(tokenIsGuest(token({ sub: "u1" }))).toBeNull();
    expect(tokenIsGuest("not-a-token")).toBeNull();
    expect(tokenIsGuest("a.%%%.b")).toBeNull();
  });
});

describe("ensureSignerToken", () => {
  it("takes a verified account's token as it is", async () => {
    const auth = authWith(VERIFIED);
    expect(await ensureSignerToken(auth)).toBe("verified");
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  // QA F2: verified in another tab, this one still held the guest's token, and the database refused it.
  it("refreshes a guest's token, and goes on with the verified account's that replaces it", async () => {
    const auth = authWith(GUEST, VERIFIED);
    expect(await ensureSignerToken(auth)).toBe("verified");
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it("says guest when the refreshed token is still a guest's", async () => {
    expect(await ensureSignerToken(authWith(GUEST, GUEST))).toBe("guest");
  });

  it("leaves it to the database when it can't tell: no session, a failed refresh or an unreadable token", async () => {
    expect(await ensureSignerToken(authWith(null))).toBe("unknown");
    expect(await ensureSignerToken(authWith(GUEST, null))).toBe("unknown");
    expect(await ensureSignerToken(authWith(GUEST, new Error("offline")))).toBe("unknown");
    expect(await ensureSignerToken(authWith("garbage"))).toBe("unknown");
  });
});

describe("isGuestCertificationRefusal", () => {
  it("knows block_guest_submission's refusal, and nothing else that shares its code", () => {
    expect(isGuestCertificationRefusal({ code: "42501", message: "An email-verified account is required to certify an intake" })).toBe(true);
    expect(isGuestCertificationRefusal({ code: "42501", message: "chamber_certifications records cannot be deleted" })).toBe(false);
    expect(isGuestCertificationRefusal({ code: "EA003", message: "An email-verified account is required to certify an intake" })).toBe(false);
    expect(isGuestCertificationRefusal(null)).toBe(false);
  });
});
