// Reports failures the browser sees to public.report_client_event (US-6.4), so they are counted and alerted
// on (docs/RUNBOOK.md) instead of ending as a console line on someone else's screen.
//
// What a report may carry: a kind, a short machine code, a redacted one-line detail, the page's path and the
// intake's id. Never contents: no answers, file names, messages, addresses or links. The detail is redacted
// here and again by the database (public.ops_redact), which is the copy that is trusted.
//
// Reporting must never break or slow the page: every call is fire-and-forget, never throws, and a page sends
// at most MAX_REPORTS_PER_PAGE reports and one per kind and code a minute. The Supabase client is loaded
// only when there is something to send, so importing this module never needs it configured.

export type OpsKind = "app_error" | "upload_failed" | "ai_failed" | "auth_denied";

export interface OpsReport {
  /** A short machine code: letters, digits and _ : . - (anything else is dropped). */
  code?: string | null;
  /** One line about what failed. Redacted before it is sent. */
  detail?: string | null;
  /** The intake the failure happened in, when there is one. */
  sessionId?: string | null;
}

export const MAX_REPORTS_PER_PAGE = 20;
export const REPEAT_WINDOW_MS = 60_000;

/** The same rules as public.ops_redact: links, addresses, long ids and runs of four or more digits go. */
export function redactForReport(text: string, max = 300): string {
  return text
    .replace(/[a-zA-Z][a-zA-Z0-9+.-]*:\/\/\S+/g, "[link]")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/[A-Za-z0-9_-]{24,}/g, "[id]")
    .replace(/[0-9][0-9 ().-]{3,}[0-9]|[0-9]{4,}/g, "[number]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function cleanCode(code: string | null | undefined): string | null {
  const clean = (code ?? "").replace(/[^A-Za-z0-9_:.-]/g, "").slice(0, 80);
  return clean || null;
}

/** "TypeError: x is undefined", redacted: what kind of error, without what it was about. */
export function errorDetail(error: unknown): string {
  if (error instanceof Error) return redactForReport(`${error.name}: ${error.message}`);
  if (typeof error === "string") return redactForReport(error);
  return "unknown";
}

/**
 * The code for a failed edge-function call that the function could not have recorded itself, or null when
 * it could have. A function that answered 502, 503 or 504 reached the AI provider (or found it unconfigured)
 * and records that failure on the server; a 4xx is a refusal (signed out, rate limited, bad input), not a
 * failure. What is left is the function crashing (another 5xx) or not being reached at all.
 */
export function unrecordedFunctionFailure(prefix: string, error: unknown): string | null {
  const status = (error as { context?: { status?: unknown } } | null)?.context?.status;
  if (typeof status === "number") return status >= 500 && ![502, 503, 504].includes(status) ? `${prefix}:${status}` : null;
  return `${prefix}_unreachable`;
}

let sent = 0;
const lastSent = new Map<string, number>();
let client: Promise<typeof import("@/integrations/supabase/client")> | null = null;
const loadClient = () => (client ??= import("@/integrations/supabase/client"));

/** Forgets what this page has sent. Tests only. */
export function resetMonitoringForTests() {
  sent = 0;
  lastSent.clear();
}

export function reportOpsEvent(kind: OpsKind, report: OpsReport = {}, now = Date.now()): void {
  try {
    const code = cleanCode(report.code);
    const key = `${kind}:${code ?? ""}`;
    const last = lastSent.get(key);
    if (sent >= MAX_REPORTS_PER_PAGE || (last !== undefined && now - last < REPEAT_WINDOW_MS)) return;
    lastSent.set(key, now);
    sent += 1;
    const args = {
      p_kind: kind,
      p_code: code,
      p_detail: (report.detail && redactForReport(report.detail)) || null,
      // The path only: a query string or fragment can carry a token.
      p_route: typeof window === "undefined" ? null : window.location.pathname.slice(0, 120),
      p_session_id: report.sessionId ?? null,
    };
    void loadClient()
      .then(({ supabase }) => supabase.rpc("report_client_event", args))
      .then(({ error }) => {
        if (error) console.warn("Couldn't report a failure:", error.code ?? error.message);
      })
      .catch(() => undefined);
  } catch {
    // Monitoring is never a reason for the page to fail.
  }
}

// Noise browsers raise that says nothing about this app.
const IGNORED_ERRORS = [/ResizeObserver loop/i, /^Script error\.?$/i];

/** Reports uncaught errors and unhandled promise rejections. Returns a function that stops it. */
export function installGlobalErrorReporting(target: Window = window): () => void {
  const onError = (event: ErrorEvent) => {
    const detail = errorDetail(event.error ?? event.message);
    if (IGNORED_ERRORS.some((p) => p.test(event.message ?? ""))) return;
    reportOpsEvent("app_error", { code: "window_error", detail });
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    reportOpsEvent("app_error", { code: "unhandled_rejection", detail: errorDetail(event.reason) });
  };
  target.addEventListener("error", onError);
  target.addEventListener("unhandledrejection", onRejection);
  return () => {
    target.removeEventListener("error", onError);
    target.removeEventListener("unhandledrejection", onRejection);
  };
}
