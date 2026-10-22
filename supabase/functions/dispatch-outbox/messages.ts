// Builds the two submission emails from an outbox row's payload. No imports, so it runs under
// Deno (the edge function) and under Vitest alike.
//
// Payloads are read through the parsers below, which keep only the named fields: anything else a
// row carries is never rendered, so these emails cannot pick up census, payroll or document
// content by accident. Every value is prospect-entered text: it is flattened to one line, capped,
// and HTML-escaped before it reaches a message.

export type OutboxKind = "advisor_notification" | "prospect_confirmation";

export interface AdvisorNotification {
  reference: string;
  companyName: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  /** The intake was certified again after its answers changed. */
  resubmission: boolean;
}

export interface ProspectConfirmation {
  reference: string;
  companyName: string | null;
  recipientName: string | null;
  recipientEmail: string;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

/** An address with no spaces, quotes, commas or angle brackets: safe to put in `to` and in prose. */
export const EMAIL_PATTERN = /^[^\s@<>,;"()[\]\\]+@[^\s@<>,;"()[\]\\]+\.[^\s@<>,;"()[\]\\]+$/;

// Control characters, line/paragraph separators and invisible or bidi-override characters.
// eslint-disable-next-line no-control-regex
const INVISIBLE = /[\u0000-\u001f\u007f\u200b-\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069\ufeff]+/g;

// A UTF-16 surrogate with no partner. Without the `u` flag the pattern reads code units, which is
// what makes it able to see one.
const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g;

/**
 * Prospect-entered text as a single capped line, or null if nothing is left. `max` counts code
 * points, and a stray surrogate is dropped like any other invisible character: the line ends up in
 * the frozen message, and Postgres refuses jsonb text with a lone surrogate (or NUL), which would
 * leave the event impossible to freeze.
 */
export function oneLine(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const flat = value.replace(LONE_SURROGATE, " ").replace(INVISIBLE, " ").replace(/\s+/g, " ").trim();
  if (!flat) return null;
  const points = Array.from(flat);
  return points.length > max ? `${points.slice(0, max - 1).join("")}…` : flat;
}

const asObject = (raw: unknown): Record<string, unknown> | null =>
  typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;

const asEmail = (value: unknown): string | null => {
  const s = oneLine(value, 254);
  return s !== null && EMAIL_PATTERN.test(s) ? s : null;
};

/** The advisor alert's fields, or null if the payload has no usable reference. */
export function parseAdvisorNotification(raw: unknown): AdvisorNotification | null {
  const p = asObject(raw);
  const reference = p && oneLine(p.reference, 64);
  if (!p || !reference) return null;
  return {
    reference,
    companyName: oneLine(p.company_name, 200),
    contactName: oneLine(p.contact_name, 200),
    contactEmail: asEmail(p.contact_email),
    contactPhone: oneLine(p.contact_phone, 50),
    resubmission: p.resubmission === true,
  };
}

/** The confirmation's fields, or null without a usable reference and recipient address. */
export function parseProspectConfirmation(raw: unknown): ProspectConfirmation | null {
  const p = asObject(raw);
  const reference = p && oneLine(p.reference, 64);
  const recipientEmail = p && asEmail(p.recipient_email);
  if (!p || !reference || !recipientEmail) return null;
  return {
    reference,
    companyName: oneLine(p.company_name, 200),
    recipientName: oneLine(p.recipient_name, 200),
    recipientEmail,
  };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Brand colours from the app's theme tokens (--primary, --background, --foreground).
const CRIMSON = "#c21e3a";
const INK = "#0a0c10";
const PARCHMENT = "#f1ede8";

/** The shared branded frame. `bodyHtml` must already be escaped. */
function layout(preheader: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f6f4f1;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<div style="max-width:560px;margin:0 auto;padding:24px 16px;font-family:Georgia,'Times New Roman',serif;color:#1c1c1f;">
<div style="background:${INK};color:${PARCHMENT};padding:18px 24px;border-bottom:3px solid ${CRIMSON};font-size:20px;letter-spacing:0.04em;">Edgar Allan Advisory</div>
<div style="background:#ffffff;padding:24px;font-size:16px;line-height:1.55;">
${bodyHtml}
</div>
<div style="padding:16px 24px;font-size:12px;color:#6b6b72;font-family:Arial,Helvetica,sans-serif;">Edgar Allan Advisory</div>
</div>
</body>
</html>`;
}

const row = (label: string, value: string) =>
  `<tr><td style="padding:4px 16px 4px 0;color:#6b6b72;font-family:Arial,Helvetica,sans-serif;font-size:13px;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:4px 0;">${escapeHtml(value)}</td></tr>`;

const NO_COMPANY = "Company name not provided";

export interface AdvisorContext {
  /** Where the advisor opens the submission; behind advisor sign-in. */
  reviewUrl: string;
}

/** The alert for the advisory team: who, which reference, where to look. Never intake contents. */
export function renderAdvisorNotification(n: AdvisorNotification, ctx: AdvisorContext): RenderedEmail {
  const company = n.companyName ?? NO_COMPANY;
  const headline = n.resubmission ? "An intake was updated and certified again." : "A new intake was submitted.";
  const subject = `${n.resubmission ? "Updated intake" : "New intake submitted"}: ${company} (${n.reference})`;

  const details: [string, string][] = [["Company", company]];
  if (n.contactName) details.push(["Contact", n.contactName]);
  if (n.contactEmail) details.push(["Contact email", n.contactEmail]);
  if (n.contactPhone) details.push(["Contact phone", n.contactPhone]);
  details.push(["Reference", n.reference]);

  const footnote = "Census, payroll and document contents are not included in this alert.";
  const text = [
    headline,
    "",
    ...details.map(([label, value]) => `${label}: ${value}`),
    "",
    "Review it securely (advisor sign-in required):",
    ctx.reviewUrl,
    "",
    footnote,
  ].join("\n");

  const html = layout(
    `${headline} ${company}, ${n.reference}`,
    `<p style="margin:0 0 16px;">${escapeHtml(headline)}</p>
<table role="presentation" style="border-collapse:collapse;margin:0 0 20px;">${details.map(([l, v]) => row(l, v)).join("")}</table>
<p style="margin:0 0 20px;"><a href="${escapeHtml(ctx.reviewUrl)}" style="display:inline-block;background:${CRIMSON};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:4px;font-family:Arial,Helvetica,sans-serif;font-size:14px;">Open the secure review</a></p>
<p style="margin:0;font-size:13px;color:#6b6b72;font-family:Arial,Helvetica,sans-serif;">Advisor sign-in is required. ${escapeHtml(footnote)}</p>`,
  );
  return { subject, text, html };
}

export interface ProspectContext {
  supportEmail: string;
  /** How long a response normally takes, as a phrase that follows "within", e.g. "2 business days". */
  responseTime: string;
}

/** The prospect's receipt: what we have, the reference, what happens next. Never intake contents. */
export function renderProspectConfirmation(c: ProspectConfirmation, ctx: ProspectContext): RenderedEmail {
  const company = c.companyName ?? "your company";
  const subject = `We received your intake (${c.reference})`;
  const greeting = c.recipientName ? `Hello ${c.recipientName},` : "Hello,";
  const received = `Thank you. Edgar Allan Advisory received the intake you certified for ${company}.`;
  const next = `An Edgar Allan Advisory advisor will review it and follow up by email if we need anything else. We aim to respond within ${ctx.responseTime}.`;
  const support = `Questions? Reply to this email or write to ${ctx.supportEmail}, and quote your reference.`;
  const privacy = "For your security, this email does not include your census, payroll or document details.";

  const text = [
    greeting,
    "",
    received,
    "",
    `Submission reference: ${c.reference}`,
    "",
    "What happens next",
    next,
    "",
    support,
    "",
    privacy,
    "",
    "Edgar Allan Advisory",
  ].join("\n");

  const html = layout(
    `We received your intake for ${company}. Reference ${c.reference}.`,
    `<p style="margin:0 0 16px;">${escapeHtml(greeting)}</p>
<p style="margin:0 0 16px;">${escapeHtml(received)}</p>
<table role="presentation" style="border-collapse:collapse;margin:0 0 20px;">${row("Submission reference", c.reference)}</table>
<p style="margin:0 0 4px;font-weight:bold;">What happens next</p>
<p style="margin:0 0 16px;">${escapeHtml(next)}</p>
<p style="margin:0 0 16px;">${escapeHtml(support)}</p>
<p style="margin:0;font-size:13px;color:#6b6b72;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(privacy)}</p>`,
  );
  return { subject, text, html };
}
