// Reads and validates the dispatcher's function secrets, per kind of email. A kind whose
// configuration is incomplete is simply not sent (its events stay queued and no attempts are
// spent), so finishing setup later releases them. No imports, so it runs under Deno and Vitest
// alike.

import { EMAIL_PATTERN, oneLine } from "./messages.ts";

export type Readiness<T> = ({ ok: true } & T) | { ok: false; problems: string[] };

export interface DispatchConfig {
  advisor: Readiness<{ from: string; to: string[]; appBaseUrl: string }>;
  prospect: Readiness<{ from: string; supportEmail: string; responseTime: string }>;
}

type Env = (name: string) => string | undefined;

/** `Name <address>` or a bare address. A display name cannot carry line breaks or brackets. */
function parseFrom(value: string | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  const named = v.match(/^([^<>\r\n]{1,100})<([^<>\s]+)>$/);
  if (named) return EMAIL_PATTERN.test(named[2]) ? `${named[1].trim()} <${named[2]}>` : null;
  return EMAIL_PATTERN.test(v) ? v : null;
}

/** A comma-separated list of addresses (the advisory distribution list may be several). */
function parseRecipients(value: string | undefined): string[] | null {
  const parts = (value ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length > 0 && parts.every((p) => EMAIL_PATTERN.test(p)) ? parts : null;
}

/** An https origin (plain http only for localhost), without a trailing slash. */
function parseBaseUrl(value: string | undefined): string | null {
  try {
    const url = new URL((value ?? "").trim());
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) return null;
    if (url.username || url.password) return null;
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

export function readDispatchConfig(env: Env): DispatchConfig {
  const from = parseFrom(env("EMAIL_FROM"));
  const advisorTo = parseRecipients(env("ADVISORY_NOTIFY_EMAIL"));
  const appBaseUrl = parseBaseUrl(env("APP_BASE_URL"));
  const supportEmail = oneLine(env("SUPPORT_EMAIL"), 254);
  const responseTime = oneLine(env("PROSPECT_RESPONSE_TIME"), 80);

  const fromProblem = from ? [] : ["EMAIL_FROM is not set to a valid sender address"];
  const advisorProblems = [
    ...fromProblem,
    ...(advisorTo ? [] : ["ADVISORY_NOTIFY_EMAIL is not set to valid address(es)"]),
    ...(appBaseUrl ? [] : ["APP_BASE_URL is not set to an https URL"]),
  ];
  const prospectProblems = [
    ...fromProblem,
    ...(supportEmail && EMAIL_PATTERN.test(supportEmail) ? [] : ["SUPPORT_EMAIL is not set to a valid address"]),
    ...(responseTime ? [] : ["PROSPECT_RESPONSE_TIME is not set"]),
  ];

  return {
    advisor:
      advisorProblems.length === 0
        ? { ok: true, from: from!, to: advisorTo!, appBaseUrl: appBaseUrl! }
        : { ok: false, problems: advisorProblems },
    prospect:
      prospectProblems.length === 0
        ? { ok: true, from: from!, supportEmail: supportEmail!, responseTime: responseTime! }
        : { ok: false, problems: prospectProblems },
  };
}
