import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const rpc = vi.fn(async (..._args: unknown[]) => ({ error: null as { code?: string; message: string } | null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

const {
  cleanCode,
  errorDetail,
  installGlobalErrorReporting,
  isUnanswered,
  MAX_REPORTS_PER_PAGE,
  newErrorCode,
  redactForReport,
  reportFailure,
  reportOpsEvent,
  REPEAT_WINDOW_MS,
  resetMonitoringForTests,
  unrecordedFunctionFailure,
} = await import("./monitoring");

// The dynamic import and the rpc promise settle on later ticks.
const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

describe("redactForReport", () => {
  it.each([
    ["Failed for pat@example.com", "Failed for [email]"],
    ["GET https://x.supabase.co/storage/v1/object/sign/documents/a.csv?token=abc failed", "GET [link] failed"],
    ["SSN 123-45-6789, salary 85000, DOB 1985-03-12", "SSN [number], salary [number], DOB [number]"],
    ["phone (555) 123-4567", "phone ([number]"],
    ["token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 here", "token [id] here"],
    ["session 7916ade0-1b89-4e99-ba87-c520483d7fd2", "session [id]"],
    ["status 503 and 42", "status 503 and 42"],
    ["  TypeError:\n  x is   undefined ", "TypeError: x is undefined"],
  ])("%s", (input, expected) => {
    expect(redactForReport(input)).toBe(expected);
  });

  it("cuts the result to the limit", () => {
    expect(redactForReport("a".repeat(10) + " " + "b ".repeat(400))).toHaveLength(300);
    expect(redactForReport("abcdef", 3)).toBe("abc");
  });

  it("follows the same rules as the database's copy, in the same order", () => {
    // public.ops_redact is the trusted copy; the patterns here must not drift from it.
    const sql = readFileSync("supabase/migrations/20261104091000_ops_monitoring.sql", "utf8");
    for (const pattern of [
      "[a-zA-Z][a-zA-Z0-9+.-]*://[^[:space:]]+",
      "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}",
      "[A-Za-z0-9_-]{24,}",
      "[0-9][0-9 ().-]{3,}[0-9]|[0-9]{4,}",
    ]) {
      expect(sql).toContain(pattern);
    }
  });
});

describe("cleanCode and errorDetail", () => {
  it("keeps only code characters", () => {
    expect(cleanCode("storage_upload:500")).toBe("storage_upload:500");
    expect(cleanCode("render error <b>")).toBe("rendererrorb");
    expect(cleanCode("")).toBeNull();
    expect(cleanCode(null)).toBeNull();
    expect(cleanCode("x".repeat(100))).toHaveLength(80);
  });

  it("describes an error by its kind and redacted message", () => {
    expect(errorDetail(new TypeError("Cannot read x of pat@example.com"))).toBe("TypeError: Cannot read x of [email]");
    expect(errorDetail("plain text 12345")).toBe("plain text [number]");
    expect(errorDetail({ weird: true })).toBe("unknown");
  });

  // QA F2: a PostgREST or auth error is a plain object, which a console printed as `Object`.
  it("reads a database or auth error that isn't an Error by its code and message", () => {
    // A five-digit SQLSTATE goes as any run of digits does; report it as the event's code.
    expect(errorDetail({ code: "EA003", message: "permission denied for pat@example.com", details: null })).toBe("EA003: permission denied for [email]");
    expect(errorDetail({ status: 500, message: "Error sending email change email" })).toBe("500: Error sending email change email");
    expect(errorDetail({ message: "no code" })).toBe("no code");
    expect(errorDetail({ message: "TypeError: fetch failed", details: "", hint: "", code: "" })).toBe("TypeError: fetch failed");
    expect(errorDetail(Object.assign(new Error("Error sending email change email"), { name: "AuthApiError", code: "unexpected_failure", status: 500 }))).toBe(
      "AuthApiError (unexpected_failure): Error sending email change email",
    );
  });
});

describe("newErrorCode", () => {
  it("is eight letters that redaction keeps, from random bytes", () => {
    const code = newErrorCode();
    expect(code).toMatch(/^[A-Z]{8}$/);
    expect(code).not.toMatch(/[OIL]/);
    expect(redactForReport(`error code ${code}`)).toBe(`error code ${code}`);
    expect(newErrorCode(() => new Uint8Array([0, 1, 2, 3, 22, 23, 24, 255]))).toBe("ABCDZABC");
  });
});

describe("isUnanswered", () => {
  it("tells a request that got no answer from one that was answered no", () => {
    expect(isUnanswered(new TypeError("Failed to fetch"))).toBe(true);
    expect(isUnanswered({ message: "TypeError: NetworkError when attempting to fetch resource.", code: "" })).toBe(true);
    expect(isUnanswered(Object.assign(new Error("Failed to fetch"), { name: "AuthRetryableFetchError", status: 0 }))).toBe(true);
    expect(isUnanswered("Load failed")).toBe(true);
    // What supabase-js handed back for a stopped server in the verify harness (Node's fetch).
    expect(isUnanswered({ message: "TypeError: fetch failed", details: "", hint: "", code: "" })).toBe(true);
    expect(isUnanswered({ code: "XX000", message: "internal error" })).toBe(false);
    expect(isUnanswered(Object.assign(new Error("Error sending email change email"), { status: 500 }))).toBe(false);
    expect(isUnanswered(null)).toBe(false);
  });
});

// One way to show, log and report a failure's error code, wherever a person is told one (code review: three copies, and
// the Reckoning's never reported).
describe("reportFailure", () => {
  beforeEach(() => {
    resetMonitoringForTests();
    rpc.mockClear();
    rpc.mockImplementation(async () => ({ error: null }));
  });

  it("logs one line with the error code and reports it as an app_error, then returns the code", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const code = reportFailure("Failed to submit session", { code: "XX000", message: "internal error for pat@example.com" }, { code: "certify_failed:XX000", sessionId: "s1" });
    expect(code).toMatch(/^[A-Z]{8}$/);
    expect(consoleError).toHaveBeenCalledWith(`Failed to submit session (error code ${code}): XX000: internal error for [email]`);
    await settle();
    expect(rpc).toHaveBeenCalledWith("report_client_event", expect.objectContaining({
      p_kind: "app_error",
      p_code: "certify_failed:XX000",
      p_detail: `error code ${code}: XX000: internal error for [email]`,
      p_session_id: "s1",
    }));
    consoleError.mockRestore();
  });
});

describe("unrecordedFunctionFailure", () => {
  const http = (status: number) => ({ context: { status } });
  it("leaves any failure the function answered, which carries its request id, to the function", () => {
    for (const status of [500, 502, 503, 504, 400, 429]) expect(unrecordedFunctionFailure("chat", http(status), "req-1")).toBeNull();
  });
  it("leaves the gateway refusing the caller alone", () => {
    for (const status of [400, 401, 403, 413, 429]) expect(unrecordedFunctionFailure("chat", http(status))).toBeNull();
  });
  it("reports a function that crashed before answering, or never answered", () => {
    expect(unrecordedFunctionFailure("chat", http(500))).toBe("chat:500");
    expect(unrecordedFunctionFailure("chat", http(503), null)).toBe("chat:503");
    expect(unrecordedFunctionFailure("chat", new Error("Failed to fetch"))).toBe("chat_unreachable");
    expect(unrecordedFunctionFailure("document_read", null)).toBe("document_read_unreachable");
  });
});

describe("reportOpsEvent", () => {
  beforeEach(() => {
    resetMonitoringForTests();
    rpc.mockClear();
    rpc.mockImplementation(async () => ({ error: null }));
  });

  it("sends the kind, a clean code, a redacted detail, the path only and the intake", async () => {
    window.history.replaceState(null, "", "/start?session=abc#t=secret");
    reportOpsEvent("upload_failed", { code: "storage_upload:500!", detail: "for pat@example.com", sessionId: "s1" });
    await settle();
    expect(rpc).toHaveBeenCalledWith("report_client_event", {
      p_kind: "upload_failed",
      p_code: "storage_upload:500",
      p_detail: "for [email]",
      p_route: "/start",
      p_session_id: "s1",
    });
  });

  it("sends one report per kind and code a minute, and at most a page's worth", async () => {
    const t = 1_000_000;
    reportOpsEvent("app_error", { code: "a" }, t);
    reportOpsEvent("app_error", { code: "a" }, t + 1000);
    reportOpsEvent("app_error", { code: "a" }, t + REPEAT_WINDOW_MS);
    await settle();
    expect(rpc).toHaveBeenCalledTimes(2);

    for (let i = 0; i < MAX_REPORTS_PER_PAGE * 2; i++) reportOpsEvent("app_error", { code: `c${i}` }, t);
    await settle();
    expect(rpc).toHaveBeenCalledTimes(MAX_REPORTS_PER_PAGE);
  });

  it("never throws or rejects when reporting fails", async () => {
    rpc.mockImplementation(async () => {
      throw new Error("network down");
    });
    expect(() => reportOpsEvent("ai_failed", { code: "chat_unreachable" })).not.toThrow();
    await settle();
    rpc.mockImplementation(async () => ({ error: { code: "42501", message: "nope" } }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    reportOpsEvent("ai_failed", { code: "other" });
    await settle();
    expect(warn).toHaveBeenCalledWith("Couldn't report a failure:", "42501");
    warn.mockRestore();
  });
});

describe("installGlobalErrorReporting", () => {
  beforeEach(() => {
    resetMonitoringForTests();
    rpc.mockClear();
  });

  it("reports uncaught errors and rejections until it is removed", async () => {
    const target = new EventTarget() as unknown as Window;
    const stop = installGlobalErrorReporting(target);
    target.dispatchEvent(Object.assign(new Event("error"), { error: new RangeError("bad 123456"), message: "bad 123456" }));
    target.dispatchEvent(Object.assign(new Event("unhandledrejection"), { reason: new Error("lost") }));
    target.dispatchEvent(Object.assign(new Event("error"), { message: "ResizeObserver loop completed with undelivered notifications." }));
    await settle();
    expect(rpc.mock.calls.map((c) => (c[1] as { p_code: string; p_detail: string }))).toEqual([
      expect.objectContaining({ p_code: "window_error", p_detail: "RangeError: bad [number]" }),
      expect.objectContaining({ p_code: "unhandled_rejection", p_detail: "Error: lost" }),
    ]);

    stop();
    resetMonitoringForTests();
    target.dispatchEvent(Object.assign(new Event("error"), { error: new Error("after"), message: "after" }));
    await settle();
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
