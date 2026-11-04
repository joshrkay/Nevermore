import { describe, expect, it } from "vitest";
import { authErrorMessage, authRateLimit, authRateLimitMessage } from "./authRateLimit";

const authError = (message: string, fields: { code?: string; status?: number } = {}) => Object.assign(new Error(message), fields);

describe("authRateLimit", () => {
  it("tells the one-address cooldown apart from the project's hourly email quota", () => {
    // Supabase uses the same code for both; only the wording differs, and only one clears in a minute.
    const cooldown = authError("For security purposes, you can only request this after 60 seconds", { code: "over_email_send_rate_limit", status: 429 });
    const quota = authError("email rate limit exceeded", { code: "over_email_send_rate_limit", status: 429 });
    expect(authRateLimit(cooldown)).toBe("cooldown");
    expect(authRateLimit(quota)).toBe("quota");
  });

  it("recognises the email quota from its wording alone, when no code came with it", () => {
    expect(authRateLimit(authError("email rate limit exceeded"))).toBe("quota");
    expect(authRateLimit(authError("For security purposes, you can only request this after 12 seconds"))).toBe("cooldown");
  });

  it("recognises the per-network request limit and any other 429", () => {
    expect(authRateLimit(authError("Request rate limit reached", { code: "over_request_rate_limit", status: 429 }))).toBe("requests");
    expect(authRateLimit(authError("slow down", { status: 429 }))).toBe("requests");
    expect(authRateLimit(authError("Too many requests"))).toBe("requests");
  });

  it("leaves every other failure alone, so a bad address or password still gets its own message", () => {
    expect(authRateLimit(authError("Password should be at least 6 characters.", { code: "weak_password", status: 422 }))).toBeNull();
    expect(authRateLimit(authError("Invalid login credentials", { status: 400 }))).toBeNull();
    expect(authRateLimit(authError("Error sending confirmation email", { code: "unexpected_failure", status: 500 }))).toBeNull();
    expect(authRateLimit(null)).toBeNull();
    expect(authRateLimit(undefined)).toBeNull();
    expect(authRateLimit("email rate limit exceeded")).toBeNull();
  });
});

describe("authErrorMessage", () => {
  it("explains a rate limit, and otherwise keeps Supabase's own words", () => {
    expect(authErrorMessage(authError("email rate limit exceeded", { code: "over_email_send_rate_limit", status: 429 }))).toMatch(/lot of emails/);
    expect(authErrorMessage(authError("Password should be at least 6 characters."))).toBe("Password should be at least 6 characters.");
    expect(authErrorMessage(authError(""), "We couldn't do that.")).toBe("We couldn't do that.");
  });
});

describe("authRateLimitMessage", () => {
  it("says to wait a minute for the cooldown, but not for the quota, which a minute doesn't clear", () => {
    expect(authRateLimitMessage("cooldown")).toMatch(/wait a minute/i);
    expect(authRateLimitMessage("quota")).not.toMatch(/a minute/i);
    expect(authRateLimitMessage("quota")).toMatch(/lot of emails/i);
    expect(authRateLimitMessage("requests")).toMatch(/too many attempts/i);
  });
});
