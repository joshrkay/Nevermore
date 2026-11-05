import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authCodeFailureKind, authCodeFailureMessage } from "./authCodeFailure";
import { resetMonitoringForTests } from "./monitoring";

const rpc = vi.fn(async () => ({ error: null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

const authError = (message: string, fields: { code?: string; status?: number; name?: string } = {}) => Object.assign(new Error(message), fields);
// What Supabase Auth answered in the QA run, with a key Resend refused.
const SEND_FAILED = authError("Error sending email change email", { code: "unexpected_failure", status: 500 });

describe("authCodeFailureKind", () => {
  it("tells a rate limit, what was typed and a failure on our side apart", () => {
    expect(authCodeFailureKind(authError("email rate limit exceeded", { code: "over_email_send_rate_limit", status: 429 }))).toBe("rate_limit");
    expect(authCodeFailureKind(authError("Unable to validate email address: invalid format", { code: "email_address_invalid", status: 400 }))).toBe("input");
    expect(authCodeFailureKind(authError("Token has expired or is invalid", { code: "otp_expired", status: 403 }))).toBe("input");
    expect(authCodeFailureKind(SEND_FAILED)).toBe("server");
    expect(authCodeFailureKind(authError("Failed to fetch", { name: "AuthRetryableFetchError", status: 0 }))).toBe("server");
    expect(authCodeFailureKind(new TypeError("Failed to fetch"))).toBe("server");
    // No status at all is what was typed, as it always was.
    expect(authCodeFailureKind(new Error("something"))).toBe("input");
  });
});

describe("authCodeFailureMessage", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    resetMonitoringForTests();
    rpc.mockClear();
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => consoleError.mockRestore());

  // QA F3: the email service failed (500), and the prospect was told to check the address.
  it("says a failure to send is ours, with an error code that is logged and reported", async () => {
    const message = authCodeFailureMessage(SEND_FAILED, "send", "verify_email");
    expect(message).toMatch(/^We couldn't send the email right now\. Try again in a minute\. \(Error code [A-Z]{8}\.\)$/);
    expect(message).not.toMatch(/address/);
    const errorCode = /Error code ([A-Z]{8})/.exec(message)![1];
    expect(consoleError).toHaveBeenCalledWith(`Couldn't send a verify_email code (status 500) (error code ${errorCode}): Error (unexpected_failure): Error sending email change email`);
    await vi.waitFor(() => expect(rpc).toHaveBeenCalledWith("report_client_event", expect.objectContaining({
      p_kind: "app_error",
      p_code: "send_code:verify_email:500",
      p_detail: `error code ${errorCode}: Error (unexpected_failure): Error sending email change email`,
    })));
  });

  it("blames the address only for a 4xx about it, and logs nothing", () => {
    expect(authCodeFailureMessage(authError("Unable to validate email address: invalid format", { status: 400 }), "send", "sign_in")).toBe(
      "We couldn't send a code to that address. Check the address and try again.",
    );
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("says how long to wait for a rate limit", () => {
    expect(authCodeFailureMessage(authError("For security purposes, you can only request this after 45 seconds", { status: 429 }), "send", "verify_email")).toContain(
      "Please wait 45 seconds",
    );
  });

  it("tells a wrong code from a check that failed on our side", () => {
    expect(authCodeFailureMessage(authError("Token has expired or is invalid", { status: 403 }), "check", "sign_in")).toBe(
      "That code didn't work. Check it and try again, or send a new one.",
    );
    expect(authCodeFailureMessage(authError("Database error", { status: 500 }), "check", "sign_in")).toMatch(
      /^We couldn't check the code right now\. Try again in a minute\. \(Error code [A-Z]{8}\.\)$/,
    );
  });
});
