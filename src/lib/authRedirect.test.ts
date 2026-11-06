import { describe, expect, it } from "vitest";
import { authCallbackUrl, parseAuthRedirect, safeNext } from "./authRedirect";

const SITE = "https://nevermorepeo.com";

describe("parseAuthRedirect", () => {
  it("reads the error Supabase puts in the hash when a link is used up or expired", () => {
    expect(
      parseAuthRedirect(`${SITE}/start#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`),
    ).toEqual({ kind: "error", code: "otp_expired", description: "Email link is invalid or has expired" });
  });

  it("reads an error in the query too, and falls back to the error name without a code", () => {
    expect(parseAuthRedirect(`${SITE}/?error=server_error&error_description=Unable+to+exchange`)).toEqual({
      kind: "error",
      code: "server_error",
      description: "Unable to exchange",
    });
  });

  it("leaves a bare ?error= alone: Supabase always adds a code or a description", () => {
    expect(parseAuthRedirect(`${SITE}/start?error=card_declined`)).toBeNull();
  });

  it("reads a token for the app to verify", () => {
    expect(parseAuthRedirect(`${SITE}/auth/callback?token_hash=abc123&type=email`)).toEqual({
      kind: "token",
      tokenHash: "abc123",
      type: "email",
    });
  });

  it("reads the token from the fragment the sign-up email puts it in, next to the app's own query", () => {
    expect(parseAuthRedirect(`${SITE}/auth/callback?next=%2Fadvisor#token_hash=abc123&type=email`)).toEqual({
      kind: "token",
      tokenHash: "abc123",
      type: "email",
    });
    // Where Supabase fell back to the bare Site URL.
    expect(parseAuthRedirect(`${SITE}#token_hash=abc123&type=email`)).toEqual({ kind: "token", tokenHash: "abc123", type: "email" });
  });

  it("ignores a token of a type Supabase doesn't verify", () => {
    expect(parseAuthRedirect(`${SITE}/auth/callback?token_hash=abc123&type=sms`)).toBeNull();
  });

  it("takes only the token types our sign-up emails send, so a crafted link can't sign this browser in some other way", () => {
    expect(parseAuthRedirect(`${SITE}/auth/callback#token_hash=abc123&type=signup`)).toEqual({ kind: "token", tokenHash: "abc123", type: "signup" });
    for (const type of ["magiclink", "recovery", "invite", "email_change"]) {
      expect(parseAuthRedirect(`${SITE}/auth/callback#token_hash=abc123&type=${type}`)).toBeNull();
    }
  });

  it("recognises a session Supabase already granted", () => {
    expect(
      parseAuthRedirect(`${SITE}/start#access_token=a.b.c&expires_in=3600&refresh_token=r1&token_type=bearer&type=signup`),
    ).toEqual({ kind: "session", type: "signup" });
  });

  it("finds nothing in an ordinary address or a section link", () => {
    expect(parseAuthRedirect(`${SITE}/`)).toBeNull();
    expect(parseAuthRedirect(`${SITE}/#peo-partners`)).toBeNull();
    expect(parseAuthRedirect(`${SITE}/manuscript?session=123`)).toBeNull();
    expect(parseAuthRedirect("not a url")).toBeNull();
  });
});

describe("safeNext", () => {
  it("keeps a path on this site", () => {
    expect(safeNext("/start")).toBe("/start");
    expect(safeNext("/advisor/submissions/7?tab=notes")).toBe("/advisor/submissions/7?tab=notes");
  });

  it("refuses anything that could leave the site, and defaults to the Chamber", () => {
    for (const raw of [null, undefined, "", "start", "https://evil.example", "//evil.example", "/\\evil.example", "/\t/evil.example", "javascript:alert(1)"]) {
      expect(safeNext(raw)).toBe("/start");
    }
  });

  it("never sends the person back to the callback page", () => {
    expect(safeNext("/auth/callback")).toBe("/start");
    expect(safeNext("/auth/callback?next=/advisor")).toBe("/start");
  });
});

describe("authCallbackUrl", () => {
  it("points at the callback page, naming the destination only when it isn't the Chamber", () => {
    expect(authCallbackUrl(SITE)).toBe(`${SITE}/auth/callback`);
    expect(authCallbackUrl(SITE, "/start")).toBe(`${SITE}/auth/callback`);
    expect(authCallbackUrl(SITE, "/advisor")).toBe(`${SITE}/auth/callback?next=%2Fadvisor`);
    expect(authCallbackUrl(SITE, "https://evil.example")).toBe(`${SITE}/auth/callback`);
  });
});
