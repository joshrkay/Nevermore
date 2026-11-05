// Builds the outbox's emails from a row's payload: the two submission emails, an advisor's request for
// information, and the reminder before an idle draft closes. No imports, so it runs under Deno (the edge
// function) and under Vitest alike.
//
// Payloads are read through the parsers below, which keep only the named fields: anything else a
// row carries is never rendered, so these emails cannot pick up census, payroll or document
// content by accident. Every value is prospect-entered text (or, for a request, an advisor's): it is
// flattened to one line (a request's message keeps its line breaks), capped, and HTML-escaped before it
// reaches a message.

export type OutboxKind = "advisor_notification" | "prospect_confirmation" | "information_request" | "draft_expiry_reminder";

/** The kinds sent to the prospect's own address; the database's public.outbox_kind_reaches_prospect agrees. */
export const PROSPECT_KINDS: readonly OutboxKind[] = ["prospect_confirmation", "information_request", "draft_expiry_reminder"];

export interface AdvisorNotification {
  /** The intake's File ID. Named `reference` in the queued payload, which rows already queued keep. */
  reference: string;
  companyName: string | null;
  /** The profile's contact name; only the fallback for the signer on alerts queued before `signer_name` existed. */
  contactName: string | null;
  /** The signed-in account's own address. */
  contactEmail: string | null;
  contactPhone: string | null;
  /** Who certified, and in what role. */
  signerName: string | null;
  signerTitle: string | null;
  /** A whole number, or null when the intake did not state one. */
  employeeCount: number | null;
  /** A two-letter state code. */
  hqState: string | null;
  /** When the database recorded the certification, as `YYYY-MM-DDTHH:MM:SSZ` (UTC). */
  certifiedAt: string | null;
  /** The intake was certified again after its answers changed. */
  resubmission: boolean;
}

export interface ProspectConfirmation {
  /** The intake's File ID (see AdvisorNotification.reference). */
  reference: string;
  companyName: string | null;
  recipientName: string | null;
  recipientEmail: string;
}

/** An advisor's request for more information (public.advisor_request_information). */
export interface InformationRequest {
  /** The intake's File ID. */
  reference: string;
  companyName: string | null;
  recipientName: string | null;
  recipientEmail: string;
  /** What the advisor wrote, line by line: each line flattened and capped, no blank runs. */
  message: string[];
  /** The intake fields the request is about, by key; the email names them by label. */
  fields: string[];
}

/** The reminder before an idle draft closes (public.queue_draft_expiry_reminders). */
export interface DraftExpiryReminder {
  companyName: string | null;
  recipientName: string | null;
  recipientEmail: string;
  /** When the draft closes, as `YYYY-MM-DDTHH:MM:SSZ` (UTC). */
  expiresAt: string;
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

const MAX_HEADCOUNT = 10_000_000;
const CERTIFIED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/** The advisor alert's fields, or null if the payload has no usable reference. */
export function parseAdvisorNotification(raw: unknown): AdvisorNotification | null {
  const p = asObject(raw);
  const reference = p && oneLine(p.reference, 64);
  if (!p || !reference) return null;
  const count = p.employee_count;
  const state = oneLine(p.hq_state, 2);
  const certifiedAt = oneLine(p.certified_at, 20);
  return {
    reference,
    companyName: oneLine(p.company_name, 200),
    contactName: oneLine(p.contact_name, 200),
    contactEmail: asEmail(p.contact_email),
    contactPhone: oneLine(p.contact_phone, 50),
    signerName: oneLine(p.signer_name, 200),
    signerTitle: oneLine(p.signer_title, 200),
    employeeCount: typeof count === "number" && Number.isInteger(count) && count >= 0 && count <= MAX_HEADCOUNT ? count : null,
    hqState: state !== null && /^[A-Za-z]{2}$/.test(state) ? state.toUpperCase() : null,
    certifiedAt: certifiedAt !== null && CERTIFIED_AT.test(certifiedAt) && Number.isFinite(Date.parse(certifiedAt)) ? certifiedAt : null,
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

const MESSAGE_MAX = 1000;
const MAX_FIELDS = 40;
const FIELD_KEY = /^[a-z][a-z0-9_]{0,63}$/;

/** Text that keeps its line breaks: each line as `oneLine` leaves it, no leading, trailing or repeated blank lines. */
export function lines(value: unknown, max: number): string[] {
  if (typeof value !== "string") return [];
  const out: string[] = [];
  let used = 0;
  for (const raw of value.split(/\r\n|\r|\n/)) {
    const line = oneLine(raw, max);
    if (line === null) {
      if (out.length > 0 && out[out.length - 1] !== "") out.push("");
      continue;
    }
    if (used >= max) break;
    const kept = oneLine(line, max - used)!;
    out.push(kept);
    used += Array.from(kept).length;
  }
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out;
}

/** A request's fields, or null without a usable File ID, recipient and message. */
export function parseInformationRequest(raw: unknown): InformationRequest | null {
  const p = asObject(raw);
  const reference = p && oneLine(p.reference, 64);
  const recipientEmail = p && asEmail(p.recipient_email);
  const message = p ? lines(p.message, MESSAGE_MAX) : [];
  if (!p || !reference || !recipientEmail || message.length === 0) return null;
  const fields = Array.isArray(p.fields)
    ? [...new Set(p.fields.filter((f): f is string => typeof f === "string" && FIELD_KEY.test(f)))].slice(0, MAX_FIELDS)
    : [];
  return {
    reference,
    companyName: oneLine(p.company_name, 200),
    recipientName: oneLine(p.recipient_name, 200),
    recipientEmail,
    message,
    fields,
  };
}

const UTC_STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/** The reminder's fields, or null without a usable recipient and closing time. */
export function parseDraftExpiryReminder(raw: unknown): DraftExpiryReminder | null {
  const p = asObject(raw);
  const recipientEmail = p && asEmail(p.recipient_email);
  const expiresAt = p && oneLine(p.expires_at, 20);
  if (!p || !recipientEmail || !expiresAt || !UTC_STAMP.test(expiresAt) || !Number.isFinite(Date.parse(expiresAt))) return null;
  return {
    companyName: oneLine(p.company_name, 200),
    recipientName: oneLine(p.recipient_name, 200),
    recipientEmail,
    expiresAt,
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

/** The shared branded frame. `bodyHtml` must already be escaped; `title` is the subject, as the document's title. */
function layout(title: string, preheader: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(title)}</title>
</head>
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

// Label and value pairs are data, so the label is a row header rather than a layout cell: a screen
// reader announces "Phone: 555-0100" instead of two unrelated cells.
const row = (label: string, value: string) =>
  `<tr><th scope="row" style="padding:4px 16px 4px 0;color:#6b6b72;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:normal;text-align:left;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</th><td style="padding:4px 0;">${escapeHtml(value)}</td></tr>`;

const NO_COMPANY = "Company name not provided";

export interface AdvisorContext {
  /** Where the advisor opens the submission; behind advisor sign-in. */
  reviewUrl: string;
}

const NOT_PROVIDED = "Not provided";

/** `2026-05-01T12:00:00Z` as `2026-05-01 12:00 UTC`: no locale or time zone for the reader to guess at. */
const utcStamp = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;

/**
 * The alert for the advisory team: who certified, the headline facts, which File ID, where to
 * look. Every listed detail is always shown, "Not provided" when empty, so a blank is never
 * mistaken for an omission. Never intake contents beyond those named facts.
 */
export function renderAdvisorNotification(n: AdvisorNotification, ctx: AdvisorContext): RenderedEmail {
  const company = n.companyName ?? NO_COMPANY;
  const headline = n.resubmission ? "An intake was updated and certified again." : "A new intake was certified.";
  const subject = `${n.resubmission ? "Updated Intake" : "New Intake Certified"}: ${company} (${n.reference})`;

  const details: [string, string][] = [
    ["Company Legal Name", n.companyName ?? NOT_PROVIDED],
    ["Primary Signer", n.signerName ?? n.contactName ?? NOT_PROVIDED],
    ["Title", n.signerTitle ?? NOT_PROVIDED],
    ["Work Email", n.contactEmail ?? NOT_PROVIDED],
    ["Phone", n.contactPhone ?? NOT_PROVIDED],
    ["Employee Count", n.employeeCount === null ? NOT_PROVIDED : String(n.employeeCount)],
    ["HQ State", n.hqState ?? NOT_PROVIDED],
    ["File ID", n.reference],
    ["Certified", n.certifiedAt === null ? NOT_PROVIDED : utcStamp(n.certifiedAt)],
  ];

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
    subject,
    `${headline} ${company}, ${n.reference}`,
    `<p style="margin:0 0 16px;">${escapeHtml(headline)}</p>
<table style="border-collapse:collapse;margin:0 0 20px;">${details.map(([l, v]) => row(l, v)).join("")}</table>
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

/** The prospect's receipt: what we have, the File ID, what happens next. Never intake contents. */
export function renderProspectConfirmation(c: ProspectConfirmation, ctx: ProspectContext): RenderedEmail {
  const company = c.companyName ?? "your company";
  const subject = `We received your intake (${c.reference})`;
  const greeting = c.recipientName ? `Hello ${c.recipientName},` : "Hello,";
  const received = `Thank you. Edgar Allan Advisory received the intake you certified for ${company}.`;
  const next = `An Edgar Allan Advisory advisor will review it and follow up by email if we need anything else. We aim to respond within ${ctx.responseTime}.`;
  const support = `Questions? Reply to this email or write to ${ctx.supportEmail}, and quote your File ID.`;
  const privacy = "For your security, this email does not include your census, payroll or document details.";

  const text = [
    greeting,
    "",
    received,
    "",
    `File ID: ${c.reference}`,
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
    subject,
    `We received your intake for ${company}. File ID ${c.reference}.`,
    `<p style="margin:0 0 16px;">${escapeHtml(greeting)}</p>
<p style="margin:0 0 16px;">${escapeHtml(received)}</p>
<table style="border-collapse:collapse;margin:0 0 20px;">${row("File ID", c.reference)}</table>
<p style="margin:0 0 4px;font-weight:bold;">What happens next</p>
<p style="margin:0 0 16px;">${escapeHtml(next)}</p>
<p style="margin:0 0 16px;">${escapeHtml(support)}</p>
<p style="margin:0;font-size:13px;color:#6b6b72;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(privacy)}</p>`,
  );
  return { subject, text, html };
}

export interface ProspectLinkContext {
  supportEmail: string;
  /** Where the prospect opens the intake. Sign-in is required: the link alone opens nothing. */
  intakeUrl: string;
}

export interface InformationRequestContext extends ProspectLinkContext {
  /** The labels of the fields the request names, in its order. */
  fieldLabels: string[];
}

const SUPPORT_LINE = (supportEmail: string, reference: string | null) =>
  `Questions? Reply to this email or write to ${supportEmail}${reference ? ", and quote your File ID" : ""}.`;

const button = (href: string, label: string) =>
  `<p style="margin:0 0 20px;"><a href="${escapeHtml(href)}" style="display:inline-block;background:${CRIMSON};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:4px;font-family:Arial,Helvetica,sans-serif;font-size:14px;">${escapeHtml(label)}</a></p>`;

const small = (text: string) =>
  `<p style="margin:0;font-size:13px;color:#6b6b72;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(text)}</p>`;

/**
 * An advisor's request for more information: what they asked, which answers it is about (by label), the File ID,
 * and where to answer it. Never an answer, the census, payroll or document contents.
 */
export function renderInformationRequest(r: InformationRequest, ctx: InformationRequestContext): RenderedEmail {
  const company = r.companyName ?? "your company";
  const subject = `Your advisor needs a little more information (${r.reference})`;
  const greeting = r.recipientName ? `Hello ${r.recipientName},` : "Hello,";
  const intro = `An Edgar Allan Advisory advisor reviewing the intake you certified for ${company} needs a little more information.`;
  const howTo = "Open your intake to answer: update your answers there and certify again in The Reckoning. If nothing needs to change, reply to this email instead.";
  const signIn = "You'll be asked to sign in with the email this was sent to.";
  const privacy = "For your security, this email does not include your answers, census, payroll or document details.";

  const text = [
    greeting,
    "",
    intro,
    "",
    "Their request",
    ...r.message,
    ...(ctx.fieldLabels.length > 0 ? ["", "What it's about", ...ctx.fieldLabels.map((l) => `- ${l}`)] : []),
    "",
    `File ID: ${r.reference}`,
    "",
    howTo,
    ctx.intakeUrl,
    signIn,
    "",
    SUPPORT_LINE(ctx.supportEmail, r.reference),
    "",
    privacy,
    "",
    "Edgar Allan Advisory",
  ].join("\n");

  const messageHtml = r.message.map((l) => (l === "" ? "" : escapeHtml(l))).join("<br>");
  const html = layout(
    subject,
    `Your advisor asked for more information about ${company}. File ID ${r.reference}.`,
    `<p style="margin:0 0 16px;">${escapeHtml(greeting)}</p>
<p style="margin:0 0 16px;">${escapeHtml(intro)}</p>
<p style="margin:0 0 4px;font-weight:bold;">Their request</p>
<blockquote style="margin:0 0 16px;padding:8px 16px;border-left:3px solid ${CRIMSON};background:#faf8f6;">${messageHtml}</blockquote>
${ctx.fieldLabels.length > 0 ? `<p style="margin:0 0 4px;font-weight:bold;">What it's about</p>
<ul style="margin:0 0 16px;padding-left:20px;">${ctx.fieldLabels.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>` : ""}
<table style="border-collapse:collapse;margin:0 0 20px;">${row("File ID", r.reference)}</table>
<p style="margin:0 0 16px;">${escapeHtml(howTo)}</p>
${button(ctx.intakeUrl, "Open your intake")}
<p style="margin:0 0 16px;font-size:14px;">${escapeHtml(signIn)}</p>
<p style="margin:0 0 16px;">${escapeHtml(SUPPORT_LINE(ctx.supportEmail, r.reference))}</p>
${small(privacy)}`,
  );
  return { subject, text, html };
}

export interface DraftReminderContext extends ProspectLinkContext {
  /** Where the prospect turns reminders off (sign-in required). */
  profileUrl: string;
}

/** What the prospect ticked to ask for reminders, and unticks to stop them (src/components/DraftReminderToggle.tsx). */
export const DRAFT_REMINDER_SETTING = "Email me before an unfinished intake closes";

/** `2026-05-01T12:00:00Z` as `1 May 2026`: the day a draft closes, in words no reader can misread. */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const longDate = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

/**
 * The reminder that an idle draft will close: when, where to pick it up, and how to stop these. Sent only to a
 * prospect who asked for it. Never an answer.
 */
export function renderDraftExpiryReminder(r: DraftExpiryReminder, ctx: DraftReminderContext): RenderedEmail {
  const company = r.companyName ?? "your company";
  const closes = longDate(r.expiresAt);
  const subject = `Your intake for ${company} closes on ${closes}`;
  const greeting = r.recipientName ? `Hello ${r.recipientName},` : "Hello,";
  const saved = `Your Edgar Allan Advisory intake for ${company} is saved, but it hasn't been certified. Intakes close after a period with no changes, and this one will close on ${closes} (UTC).`;
  const next = "Pick up where you left off: any change keeps it open. Once it closes, its answers can't be opened again and are deleted later, as our Privacy Policy describes.";
  const nothing = "If you no longer need it, you don't need to do anything.";
  const why = `You're getting this because you asked us to remind you. To stop these reminders, untick "${DRAFT_REMINDER_SETTING}" on your profile, or reply to this email and ask us to stop.`;
  const signIn = "You'll be asked to sign in with the email this was sent to.";
  const privacy = "For your security, this email does not include your answers, census, payroll or document details.";

  const text = [
    greeting,
    "",
    saved,
    "",
    next,
    ctx.intakeUrl,
    signIn,
    "",
    nothing,
    "",
    why,
    ctx.profileUrl,
    "",
    SUPPORT_LINE(ctx.supportEmail, null),
    "",
    privacy,
    "",
    "Edgar Allan Advisory",
  ].join("\n");

  const html = layout(
    subject,
    `Your intake for ${company} closes on ${closes}.`,
    `<p style="margin:0 0 16px;">${escapeHtml(greeting)}</p>
<p style="margin:0 0 16px;">${escapeHtml(saved)}</p>
<p style="margin:0 0 16px;">${escapeHtml(next)}</p>
${button(ctx.intakeUrl, "Continue your intake")}
<p style="margin:0 0 16px;font-size:14px;">${escapeHtml(signIn)}</p>
<p style="margin:0 0 16px;">${escapeHtml(nothing)}</p>
<p style="margin:0 0 16px;font-size:14px;">${escapeHtml(why)} <a href="${escapeHtml(ctx.profileUrl)}">Your profile</a></p>
<p style="margin:0 0 16px;">${escapeHtml(SUPPORT_LINE(ctx.supportEmail, null))}</p>
${small(privacy)}`,
  );
  return { subject, text, html };
}
