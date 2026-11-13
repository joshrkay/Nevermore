import { describe, expect, it } from "vitest";
import { readDispatchConfig } from "./config";

const full: Record<string, string> = {
  EMAIL_FROM: "Edgar Allan Advisory <intake@mail.example.com>",
  ADVISORY_NOTIFY_EMAIL: "advisors@example.com, ops@example.com",
  APP_BASE_URL: "https://app.example.com/",
  SUPPORT_EMAIL: "support@example.com",
  PROSPECT_RESPONSE_TIME: "2 business days",
};
const read = (overrides: Record<string, string | undefined> = {}) => {
  const env = { ...full, ...overrides };
  return readDispatchConfig((n) => env[n]);
};

describe("readDispatchConfig", () => {
  it("is ready for every kind when everything is set", () => {
    expect(read()).toEqual({
      advisor: { ok: true, from: "Edgar Allan Advisory <intake@mail.example.com>", appBaseUrl: "https://app.example.com" },
      prospect: { ok: true, from: "Edgar Allan Advisory <intake@mail.example.com>", supportEmail: "support@example.com", responseTime: "2 business days" },
      prospectLink: { ok: true, from: "Edgar Allan Advisory <intake@mail.example.com>", supportEmail: "support@example.com", appBaseUrl: "https://app.example.com" },
    });
  });

  it("holds back only the kind whose settings are missing", () => {
    const noSupport = read({ SUPPORT_EMAIL: undefined, PROSPECT_RESPONSE_TIME: undefined });
    expect(noSupport.advisor.ok).toBe(true);
    expect(noSupport.prospect).toEqual({
      ok: false,
      problems: ["SUPPORT_EMAIL is not set to a valid address", "PROSPECT_RESPONSE_TIME is not set"],
    });
  });

  it("does not take the advisor alert's recipients from a platform-wide list: the intake's firm's members are asked for per event", () => {
    const withList = read({ ADVISORY_NOTIFY_EMAIL: "everyone@platform.example" });
    expect(JSON.stringify(withList)).not.toContain("platform.example");
    // Without the list, or with a bad one, the advisor kinds are as ready as with it: nothing waits on it.
    expect(read({ ADVISORY_NOTIFY_EMAIL: undefined }).advisor).toEqual(withList.advisor);
    expect(read({ ADVISORY_NOTIFY_EMAIL: "ok@example.com, nope" }).advisor).toEqual(withList.advisor);
  });

  it("sends nothing without a sender", () => {
    const c = read({ EMAIL_FROM: undefined });
    expect(c.advisor.ok).toBe(false);
    expect(c.prospect.ok).toBe(false);
  });

  it("accepts a bare sender address", () => {
    const c = read({ EMAIL_FROM: "intake@mail.example.com" });
    expect(c.advisor.ok && c.advisor.from).toBe("intake@mail.example.com");
  });

  it.each([
    "not an address",
    "Name <not-an-address>",
    "Evil\r\nBcc: x@example.com <a@example.com>",
    "<a@example.com> <b@example.com>",
  ])("rejects the sender %j", (EMAIL_FROM) => {
    expect(read({ EMAIL_FROM }).advisor.ok).toBe(false);
  });

  it("requires an https app URL (http only for localhost) and drops a trailing slash", () => {
    expect(read({ APP_BASE_URL: "http://app.example.com" }).advisor.ok).toBe(false);
    expect(read({ APP_BASE_URL: "javascript:alert(1)" }).advisor.ok).toBe(false);
    expect(read({ APP_BASE_URL: "https://user:pw@app.example.com" }).advisor.ok).toBe(false);
    expect(read({ APP_BASE_URL: "not a url" }).advisor.ok).toBe(false);
    const local = read({ APP_BASE_URL: "http://localhost:8080/" }).advisor;
    expect(local.ok && local.appBaseUrl).toBe("http://localhost:8080");
    const nested = read({ APP_BASE_URL: "https://example.com/app/" }).advisor;
    expect(nested.ok && nested.appBaseUrl).toBe("https://example.com/app");
  });

  it("needs exactly one support address", () => {
    expect(read({ SUPPORT_EMAIL: "a@example.com, b@example.com" }).prospect.ok).toBe(false);
  });

  it("names the settings that are wrong, never their values", () => {
    const c = read({ EMAIL_FROM: "super-secret-looking-value" });
    expect(JSON.stringify(c)).not.toContain("super-secret-looking-value");
  });
});
