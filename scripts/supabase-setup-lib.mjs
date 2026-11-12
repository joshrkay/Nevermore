// Pure helpers for scripts/supabase-setup.mjs: parsing, validation, the SQL it runs and how it
// reads the results. No I/O, so they are unit-tested (scripts/supabase-setup-lib.test.ts).

export const FUNCTIONS = ["chamber-extract", "document-upload", "document-extract", "document-scan", "dispatch-outbox", "resend-webhook", "receive-mail", "held-mail", "mailbox", "purge-intakes", "ops-monitor"];

/** What MALWARE_SCANNER may be (supabase/functions/_shared/malwareScan.ts). */
export const MALWARE_SCANNERS = ["scanii", "clamav", "http", "none"];
// APP_ENV values (docs/adr/0002-uploads-need-a-scanner-in-production.md): unset is production. Only the non-production
// ones allow MALWARE_SCANNER=none; supabase/functions/_shared/malwareScan.ts reads the same names.
export const UNSCANNED_ENVIRONMENTS = ["development", "demo", "staging"];
export const APP_ENVIRONMENTS = [...UNSCANNED_ENVIRONMENTS, "production"];

/** Secrets the email notifications need. Without them emails wait in the queue; nothing is lost. */
export const EMAIL_SECRETS = ["RESEND_API_KEY", "EMAIL_FROM", "ADVISORY_NOTIFY_EMAIL", "SUPPORT_EMAIL", "PROSPECT_RESPONSE_TIME"];

/** Supabase sets these for every function itself, and refuses to let you set names starting with SUPABASE_. */
const PLATFORM_PREFIX = "SUPABASE_";

/** Secrets that are a single token (API keys, signing secrets), so whitespace in one is always a mistake. */
const SECRET_NAME = /_(API_KEY|SECRET|TOKEN)$/;
/** What a Resend API key looks like: re_ and a run of letters, digits and underscores. */
const RESEND_KEY_SHAPE = /^re_[A-Za-z0-9_]+$/;

export function isProjectRef(ref) {
  return typeof ref === "string" && /^[a-z]{20}$/.test(ref);
}

/** Reads KEY=value lines. Ignores blanks and comments; strips `export ` and matching quotes. */
export function parseEnvFile(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[m[1]] = value;
  }
  return out;
}

/**
 * What the secrets file is missing. `errors` stop the setup; `warnings` describe what won't work
 * until they're filled in.
 */
export function checkSecrets(env) {
  const errors = [];
  const warnings = [];
  const set = (name) => typeof env[name] === "string" && env[name].trim() !== "";

  for (const name of Object.keys(env)) {
    if (name.startsWith(PLATFORM_PREFIX)) errors.push(`${name}: Supabase provides SUPABASE_* values itself; remove it from the file`);
  }

  // Anthropic is the only AI provider (decision D11): the functions refuse any other AI_PROVIDER, and a leftover Lovable
  // key does nothing.
  if (set("AI_PROVIDER") && env.AI_PROVIDER.trim() !== "anthropic") {
    errors.push(`AI_PROVIDER must be "anthropic" or unset (Anthropic is the only AI provider), not "${env.AI_PROVIDER}"`);
  }
  if (!set("ANTHROPIC_API_KEY")) errors.push("ANTHROPIC_API_KEY is required (Anthropic is the only AI provider)");
  if (set("LOVABLE_API_KEY")) warnings.push("LOVABLE_API_KEY is no longer used (Anthropic is the only AI provider): delete it from the file, and from the project's secrets with `supabase secrets unset LOVABLE_API_KEY`");

  if (!set("APP_BASE_URL")) errors.push("APP_BASE_URL is required (the site's address, e.g. https://nevermorepeo.com)");
  else {
    let url;
    try { url = new URL(env.APP_BASE_URL); } catch { /* reported below */ }
    const local = url && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
    if (!url || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) errors.push("APP_BASE_URL must be an https:// address");
    else if (url.pathname !== "/" || url.search || url.hash) errors.push("APP_BASE_URL must be just the site's origin, with no path");
  }

  // A key with a space in it is a key with something pasted after it (an inline comment, a second word): the
  // file has no comments after a value. The function secret would hold all of it, so every call fails (QA H5).
  for (const name of Object.keys(env)) {
    if (SECRET_NAME.test(name) && set(name) && /\s/.test(env[name])) {
      errors.push(`${name} has a space or other whitespace in it: keep only the key on its line, with nothing after it (a # comment isn't allowed after a value)`);
    }
  }
  if (set("RESEND_API_KEY") && !/\s/.test(env.RESEND_API_KEY) && !RESEND_KEY_SHAPE.test(env.RESEND_API_KEY)) {
    warnings.push("RESEND_API_KEY doesn't look like a Resend API key (re_ followed by letters, digits and underscores); the check against Resend says whether it works");
  }

  const missingEmail = EMAIL_SECRETS.filter((name) => !set(name));
  if (missingEmail.length > 0) warnings.push(`Emails stay queued until these are set: ${missingEmail.join(", ")}`);
  // Sending works without it, so it is not one of the email secrets; only the bounces are lost.
  if (set("RESEND_API_KEY") && !set("RESEND_WEBHOOK_SECRET")) {
    warnings.push("Bounces and spam complaints are not processed until RESEND_WEBHOOK_SECRET is set: the signing secret of a Resend webhook pointed at the resend-webhook function (docs/NOTIFICATIONS.md)");
  }

  // The environment (ADR 0002): unset is production. A misspelt one would be read as production by the functions, so
  // MALWARE_SCANNER=none would silently stop working; say so here instead.
  const appEnv = set("APP_ENV") ? env.APP_ENV.trim().toLowerCase() : "production";
  if (!APP_ENVIRONMENTS.includes(appEnv)) errors.push(`APP_ENV must be ${APP_ENVIRONMENTS.join(", ")} or unset (production), not "${env.APP_ENV}"`);
  const production = !UNSCANNED_ENVIRONMENTS.includes(appEnv);

  // The malware scanner (E-4.3, decision D13: Scanii, ADR 0002). Unset refuses every upload, the census included;
  // set but incomplete is a mistake. Unset stays a warning, not a stop, so the rest of the setup isn't held up while
  // the scanner's account is opened. `none` on production is a stop: the functions won't honour it (QA H4).
  const scanner = set("MALWARE_SCANNER") ? env.MALWARE_SCANNER.trim().toLowerCase() : null;
  if (scanner === null) {
    warnings.push(
      `Uploads, the census included, are refused until MALWARE_SCANNER is set: scanii (SCANII_API_KEY and SCANII_API_SECRET), clamav (CLAMAV_HOST) or http (MALWARE_SCANNER_URL and MALWARE_SCANNER_TOKEN)${production ? "" : `, or none on this ${appEnv} project`}. document-scan alerts every five minutes until it is set (docs/SUPABASE_SETUP.md, "Malware scanning")`,
    );
  } else if (!MALWARE_SCANNERS.includes(scanner)) {
    errors.push(`MALWARE_SCANNER must be scanii, clamav, http or none, not "${env.MALWARE_SCANNER}"`);
  } else if (scanner === "scanii" && (!set("SCANII_API_KEY") || !set("SCANII_API_SECRET"))) {
    errors.push("SCANII_API_KEY and SCANII_API_SECRET are required when MALWARE_SCANNER=scanii (Scanii's API key and its secret)");
  } else if (scanner === "scanii" && env.SCANII_API_KEY.includes(":")) {
    errors.push("SCANII_API_KEY can't hold a colon: it is the user name of HTTP Basic auth");
  } else if (scanner === "scanii" && set("SCANII_API_URL") && !/^https:\/\//.test(env.SCANII_API_URL.trim())) {
    errors.push("SCANII_API_URL must be an https:// address (leave it unset for Scanii's US region)");
  } else if (scanner === "clamav" && !set("CLAMAV_HOST")) {
    errors.push("CLAMAV_HOST is required when MALWARE_SCANNER=clamav");
  } else if (scanner === "http" && (!set("MALWARE_SCANNER_URL") || !set("MALWARE_SCANNER_TOKEN"))) {
    errors.push("MALWARE_SCANNER_URL and MALWARE_SCANNER_TOKEN are required when MALWARE_SCANNER=http");
  } else if (scanner === "http" && !/^https:\/\//.test(env.MALWARE_SCANNER_URL.trim())) {
    errors.push("MALWARE_SCANNER_URL must be an https:// address");
  } else if (scanner === "none" && production) {
    errors.push(`MALWARE_SCANNER=none is allowed only when APP_ENV is ${UNSCANNED_ENVIRONMENTS.join(", ")}, and this file's APP_ENV is ${set("APP_ENV") ? `"${env.APP_ENV}"` : "unset (production)"}: the functions would refuse every upload. Set scanii, clamav or http`);
  } else if (scanner === "none") {
    warnings.push(`MALWARE_SCANNER=none: uploads are not scanned for malware on this ${appEnv} project. Never for real prospects' files (docs/adr/0002-uploads-need-a-scanner-in-production.md)`);
  }

  return { errors, warnings };
}

/** The legacy service-role key (a JWT) from `supabase projects api-keys -o json`. dispatch-outbox compares against it. */
export function serviceRoleKeyFrom(keys) {
  const list = Array.isArray(keys) ? keys : [];
  const key = list.find((k) => k && k.name === "service_role" && typeof k.api_key === "string");
  return key && key.api_key.startsWith("eyJ") ? key.api_key : null;
}

/** A browser-safe key for the checks: the legacy anon key, else a publishable key. */
export function publicKeyFrom(keys) {
  const list = Array.isArray(keys) ? keys : [];
  const anon = list.find((k) => k && k.name === "anon" && typeof k.api_key === "string");
  if (anon) return anon.api_key;
  const publishable = list.find((k) => k && k.type === "publishable" && typeof k.api_key === "string");
  return publishable ? publishable.api_key : null;
}

/**
 * One line of the env file handed to `supabase secrets set --env-file`. Single quotes keep the value
 * literal (no `$VAR` expansion); a value that itself has a single quote is double-quoted when that is
 * still literal, and refused otherwise.
 */
export function envFileLine(name, value) {
  const v = String(value);
  if (/[\r\n]/.test(v)) throw new Error(`${name} must be on one line`);
  if (!v.includes("'")) return `${name}='${v}'`;
  if (!/["$\\]/.test(v)) return `${name}="${v}"`;
  throw new Error(`${name} has both a single quote and one of " $ \\; set it in the dashboard instead`);
}

// ---- The Supabase CLI ----------------------------------------------------------------------------

/** The CLI's version from `supabase --version` (the first x.y.z in it), as [major, minor, patch], or null. */
export function parseCliVersion(text) {
  const m = String(text ?? "").match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/**
 * The CLI calls the setup makes, for the installed version. CLI 3 changed two things the setup relies on (QA H3):
 * `db push` targets the local database unless given `--remote`, and a change to a hosted project is refused in a
 * non-interactive run unless it carries `--yes`. The script asks once (the project ref typed back, or its own --yes)
 * before any of these run, so they all carry `--yes` and the run finishes unattended. `db push` uses the linked
 * project (`supabase link` runs first) so it connects the way the link set up; the others name the project. An
 * unreadable version is taken as current. CLI 2 keeps the calls it was run with before.
 */
export function cliCommands(version, ref) {
  const legacy = Array.isArray(version) && version[0] < 3;
  if (legacy) {
    return {
      link: ["link", "--project-ref", ref],
      dbPush: ["db", "push"],
      secretsSet: (file) => ["secrets", "set", "--env-file", file, "--project-ref", ref],
      deploy: (fn) => ["functions", "deploy", fn, "--project-ref", ref],
    };
  }
  const target = `--remote=${ref}`;
  return {
    link: ["link", "--project-ref", ref],
    dbPush: ["db", "push", "--remote", "--yes"],
    secretsSet: (file) => ["secrets", "set", "--env-file", file, target, "--yes"],
    // Bundled with Docker (no --use-api): Supabase's server-side bundler can't fetch document-extract's SheetJS
    // import from cdn.sheetjs.com.
    deploy: (fn) => ["functions", "deploy", fn, target, "--yes"],
  };
}

/** Why the setup needs Docker, for the message that stops it before anything changes when Docker isn't running. */
export const DOCKER_NEEDED =
  "Docker isn't running. `supabase functions deploy` bundles the functions with it: document-extract imports SheetJS from cdn.sheetjs.com, " +
  "which Supabase's server-side bundler (--use-api) can't fetch. Start Docker (Docker Desktop, or the docker service) and run this again; nothing was changed.";

// ---- Resend ------------------------------------------------------------------------------------

/**
 * What Resend's answer to an empty send says about RESEND_API_KEY (QA H5). The setup posts `{}` to /emails with the
 * key: 422 (or 400) is Resend refusing the empty email, so it read the key and accepted it; 401 or 403 is the key
 * refused, which would break sign-in codes and every app email, so the setup stops. Anything else (no answer, a rate
 * limit, Resend down) leaves the key unverified: `ok` is null and the setup goes on with a warning. `name` is Resend's
 * error code; nothing else from the answer is shown.
 */
export function resendKeyVerdict({ status, name }) {
  const code = typeof name === "string" && /^[a-z_]{1,40}$/.test(name) ? ` ${name}` : "";
  if (status === 422 || status === 400) return { ok: true, detail: "Resend accepted the key" };
  if (status === 401 || status === 403) {
    return {
      ok: false,
      detail: `Resend refused the key (${status}${code}): sign-in codes and every app email fail with it. Create a key with sending access at resend.com/api-keys, put it in the secrets file and run this again`,
    };
  }
  return { ok: null, detail: status ? `Resend answered ${status}${code}, so the key wasn't verified` : "Resend couldn't be reached, so the key wasn't verified" };
}

/** `Edgar Allan Advisory <intake@mail.example.com>` or a bare address, as the sender name and address. */
export function parseSender(from) {
  const v = (from ?? "").trim();
  const named = v.match(/^([^<>\r\n]{1,100})<([^<>\s]+@[^<>\s]+)>$/);
  if (named) return { name: named[1].trim(), email: named[2] };
  return /^[^<>\s]+@[^<>\s]+$/.test(v) ? { name: "", email: v } : null;
}

const RESEND_SMTP_HOST = "smtp.resend.com";

/**
 * The least the project's hourly cap on auth emails (`rate_limit_email_sent`) should be. Every prospect
 * shares it, and a sign-up confirmation, a sign-in or certify code and each resend all count, so a cap
 * left at Supabase's default answers 429 "email rate limit exceeded" to the next person on a busy day.
 * It is a floor: a higher figure someone chose is kept. It doesn't lift Resend's own plan quota, which
 * these emails also count against.
 */
export const MIN_AUTH_EMAILS_PER_HOUR = 100;

/** The email-change message a guest gets when they add an email: it must carry the 6-digit code `VerifyEmailGate` asks for. */
export const EMAIL_CODE_SUBJECT = "Your verification code";
export const EMAIL_CODE_TEMPLATE = [
  "<h2>Confirm your email</h2>",
  "<p>Enter this code to confirm {{ .NewEmail }} and continue your intake:</p>",
  "<p style=\"font-size:24px;font-weight:bold;letter-spacing:4px\">{{ .Token }}</p>",
  "<p>If you didn't ask for this, you can ignore this email.</p>",
].join("\n");

/**
 * The sign-up confirmation. Supabase's default is a single-use link to its own verify endpoint, which
 * a mail scanner (Defender Safe Links, Mimecast, Proofpoint) opening it first uses up. This one
 * carries a 6-digit code the sign-up page accepts, and a link to the app's callback page, which
 * verifies the token only when the person clicks "Confirm my email". The link is {{ .RedirectTo }}
 * (the callback address the app asked for, or the Site URL when Supabase didn't allow it), so it
 * returns to the deployment the person signed up on and keeps where they were headed. The token goes
 * in the fragment: that appends to any address, and never reaches a server or a Referer header.
 */
export const SIGNUP_CONFIRM_SUBJECT = "Confirm your email";
export const SIGNUP_CONFIRM_TEMPLATE = [
  "<h2>Confirm your email</h2>",
  "<p>Enter this code where you signed up (or sign in, and you'll be asked for it) to finish creating your account:</p>",
  "<p style=\"font-size:24px;font-weight:bold;letter-spacing:4px\">{{ .Token }}</p>",
  "<p>Or <a href=\"{{ .RedirectTo }}#token_hash={{ .TokenHash }}&type=email\">open this link</a> and click Confirm my email.</p>",
  "<p>If you didn't sign up, you can ignore this email.</p>",
].join("\n");

/** True when a template sends the 6-digit code itself: `{{ .Token }}`, not just `{{ .TokenHash }}`. */
export function sendsOtpCode(content) {
  return /\{\{\s*\.Token\s*\}\}/.test(String(content ?? ""));
}

/** True when a sign-up confirmation template carries both the code and a link that verifies only on a click. */
export function signupTemplateOk(content) {
  const text = String(content ?? "");
  return (
    /\{\{\s*\.Token\s*\}\}/.test(text) &&
    /token_hash=\{\{\s*\.TokenHash\s*\}\}/.test(text) &&
    !text.includes(".ConfirmationURL") &&
    !text.includes("/auth/v1/verify")
  );
}

/**
 * The sign-in message (Supabase's "magic link" template) a returning prospect gets when they ask the
 * Chamber to recover an intake from another browser: it must carry the 6-digit code `RecoverIntake` asks for.
 */
export const SIGN_IN_CODE_SUBJECT = "Your sign-in code";
export const SIGN_IN_CODE_TEMPLATE = [
  "<h2>Sign in to your intake</h2>",
  "<p>Enter this code to pick up your intake where you left off:</p>",
  "<p style=\"font-size:24px;font-weight:bold;letter-spacing:4px\">{{ .Token }}</p>",
  "<p>If you didn't ask for this, you can ignore this email.</p>",
].join("\n");

/**
 * The auth settings to change, given the current ones (`null` when they couldn't be read). Only what
 * differs is sent, and nothing already customised is overwritten: extra redirect URLs are kept, a
 * template that already has the code stays (for sign-up: the code and an app link, and no
 * {{ .ConfirmationURL }}), and SMTP that isn't Resend's is left alone. `current` must be the
 * project's settings: without them the patch would replace the Redirect URLs list. Resend's SMTP
 * settings are sent every time, so a rotated RESEND_API_KEY is picked up (the API doesn't return the
 * current password to compare). `notes` explain what was left as is. The patch can hold the SMTP
 * password: never print it.
 */
export function authConfigPatch(current, env) {
  if (!current) throw new Error("authConfigPatch needs the project's current auth settings");
  const c = current;
  const origin = new URL(env.APP_BASE_URL).origin;
  const patch = {};
  const notes = [];

  if (c.external_anonymous_users_enabled !== true) patch.external_anonymous_users_enabled = true;
  if (c.mailer_autoconfirm !== false) patch.mailer_autoconfirm = false;
  if (c.site_url !== origin) patch.site_url = origin;

  const allowList = String(c.uri_allow_list ?? "").split(",").map((u) => u.trim()).filter(Boolean);
  const redirect = `${origin}/**`;
  if (!allowList.includes(redirect)) patch.uri_allow_list = [...allowList, redirect].join(",");

  if (c.mailer_otp_length !== 6) patch.mailer_otp_length = 6;
  if (!String(c.mailer_templates_email_change_content ?? "").includes(".Token")) {
    patch.mailer_subjects_email_change = EMAIL_CODE_SUBJECT;
    patch.mailer_templates_email_change_content = EMAIL_CODE_TEMPLATE;
  }
  if (!sendsOtpCode(c.mailer_templates_magic_link_content)) {
    patch.mailer_subjects_magic_link = SIGN_IN_CODE_SUBJECT;
    patch.mailer_templates_magic_link_content = SIGN_IN_CODE_TEMPLATE;
  }
  if (!signupTemplateOk(c.mailer_templates_confirmation_content)) {
    patch.mailer_subjects_confirmation = SIGNUP_CONFIRM_SUBJECT;
    patch.mailer_templates_confirmation_content = SIGNUP_CONFIRM_TEMPLATE;
  }

  const sender = parseSender(env.EMAIL_FROM);
  const resendKey = (env.RESEND_API_KEY ?? "").trim();
  if (!resendKey || !sender) {
    notes.push("Sign-in emails use Supabase's built-in mailer, which only delivers to your team's addresses: set RESEND_API_KEY and EMAIL_FROM so prospects get their codes (the hourly email limit is left alone until then)");
  } else if (c.smtp_host && c.smtp_host !== RESEND_SMTP_HOST) {
    notes.push(`Sign-in emails already go through ${c.smtp_host}; left as is`);
  } else {
    Object.assign(patch, {
      smtp_host: RESEND_SMTP_HOST,
      smtp_port: "465",
      smtp_user: "resend",
      smtp_pass: resendKey,
      smtp_admin_email: sender.email,
      smtp_sender_name: sender.name || sender.email,
    });
  }

  // Only with custom SMTP, here or already: the built-in mailer's limit is Supabase's to set, and a
  // patch Supabase refuses stops the whole run (a failed PATCH fails the step).
  const customSmtp = Boolean(patch.smtp_host || c.smtp_host);
  if (customSmtp && !(c.rate_limit_email_sent >= MIN_AUTH_EMAILS_PER_HOUR)) patch.rate_limit_email_sent = MIN_AUTH_EMAILS_PER_HOUR;
  return { patch, notes };
}

/**
 * Whether Supabase Auth's SMTP password is RESEND_API_KEY, as it must be: sign-in codes go out through Resend's SMTP
 * with the key as the password, and the app's own emails through Resend's API with the same key, so after a rotation
 * one can work while the other fails (QA H5). `patch` is authConfigPatch's. The Management API may hide the stored
 * password; a value that isn't a Resend key (missing, masked) can't be compared, and then this says what was done or
 * what to check. Null when there is nothing to say: no Resend key, or another provider's SMTP (authConfigPatch's note
 * covers both). Never includes either key.
 */
export function smtpKeyNote(current, patch, resendKey) {
  const key = (resendKey ?? "").trim();
  const c = current ?? {};
  if (!key) return null;
  if (!patch.smtp_pass && c.smtp_host !== RESEND_SMTP_HOST) return null;
  const stored = typeof c.smtp_pass === "string" ? c.smtp_pass.trim() : "";
  const readable = stored.startsWith("re_");
  if (patch.smtp_pass === key) {
    if (!readable) return "Supabase Auth's SMTP password is set to RESEND_API_KEY (Supabase doesn't return the stored one to compare, so it is set on every run)";
    return stored === key ? "Supabase Auth's SMTP password is RESEND_API_KEY" : "Supabase Auth's SMTP password was a different Resend key; it now uses RESEND_API_KEY";
  }
  if (readable && stored === key) return "Supabase Auth's SMTP password is RESEND_API_KEY";
  if (readable) return "Supabase Auth's SMTP password is a different Resend key from RESEND_API_KEY, so sign-in codes and the app's emails use different keys. Set EMAIL_FROM and run this again, or change it under Authentication → Emails → SMTP Settings";
  return "Supabase Auth's SMTP password couldn't be read: it must be RESEND_API_KEY, or sign-in codes fail while the app's emails work. Set EMAIL_FROM and run this again, or set it under Authentication → Emails → SMTP Settings";
}

/** A SQL string literal. Single quotes are doubled, so any value is safe to embed. */
export function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

export const EXTENSIONS_SQL = [
  "create extension if not exists pg_cron with schema pg_catalog;",
  "create extension if not exists pg_net with schema extensions;",
].join("\n");

/** Stores the service-role key in Vault for the schedule, replacing an older copy so a rotated key is picked up. */
export function vaultSecretSql(serviceRoleKey) {
  return [
    "do $$",
    "begin",
    "  if exists (select 1 from vault.secrets where name = 'service_role_key') then",
    `    perform vault.update_secret((select id from vault.secrets where name = 'service_role_key'), ${sqlLiteral(serviceRoleKey)});`,
    "  else",
    `    perform vault.create_secret(${sqlLiteral(serviceRoleKey)}, 'service_role_key', 'Bearer token the scheduled functions send');`,
    "  end if;",
    "end $$;",
  ].join("\n");
}

/**
 * The edge functions the database calls on a schedule, with the service-role key from Vault. The
 * migrations schedule each one when pg_cron and pg_net exist as they run (reading the project URL from
 * Vault); the script schedules them on the project's own URL, which covers a project that only gets the
 * extensions from this script.
 * - dispatch-outbox every minute: submission emails, retries and healing (docs/NOTIFICATIONS.md).
 * - purge-intakes hourly: carries out intake deletions (docs/DATA_HANDLING.md).
 * - ops-monitor every five minutes: alerts on failures over their thresholds (docs/RUNBOOK.md).
 * - document-scan every five minutes: scans uploads that weren't settled when they arrived (docs/RUNBOOK.md).
 * - held-mail daily: deletes PEO mail that waited 30 days on the holding list, files first (docs/RUNBOOK.md).
 */
export const SCHEDULED_FUNCTIONS = [
  { fn: "dispatch-outbox", schedule: "* * * * *", status: "schedule", label: "Email schedule", every: "every minute", missing: "not scheduled" },
  { fn: "purge-intakes", schedule: "23 * * * *", status: "purge_schedule", label: "Deletion schedule", every: "hourly", missing: "not scheduled: requested and retention deletions never run" },
  { fn: "ops-monitor", schedule: "*/5 * * * *", status: "monitor_schedule", label: "Alert schedule", every: "every five minutes", missing: "not scheduled: failures are recorded but nobody is alerted" },
  { fn: "document-scan", schedule: "*/5 * * * *", status: "scan_schedule", label: "Malware scan schedule", every: "every five minutes", missing: "not scheduled: an upload the scanner couldn't check at once stays unreadable" },
  { fn: "held-mail", schedule: "23 3 * * *", status: "held_mail_schedule", label: "Held mail schedule", every: "daily", missing: "not scheduled: mail nobody assigned is never deleted" },
];

/** Runs one scheduled function on the project's own URL. Scheduling the same name again replaces the job. */
export function functionScheduleSql(projectRef, fn, schedule) {
  if (!isProjectRef(projectRef)) throw new Error("invalid project ref");
  if (!/^[a-z][a-z0-9-]*$/.test(fn) || !/^[0-9*/, -]+$/.test(schedule)) throw new Error("invalid schedule");
  const url = `https://${projectRef}.supabase.co/functions/v1/${fn}`;
  return [
    `select cron.schedule(${sqlLiteral(fn)}, ${sqlLiteral(schedule)}, $job$`,
    "  select net.http_post(",
    `    url := ${sqlLiteral(url)},`,
    "    headers := jsonb_build_object(",
    "      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),",
    "      'Content-Type', 'application/json'),",
    "    body := '{}'::jsonb",
    "  );",
    "$job$);",
  ].join("\n");
}

/** Runs dispatch-outbox every minute (docs/NOTIFICATIONS.md). Scheduling the same name again replaces the job. */
export function cronScheduleSql(projectRef) {
  return functionScheduleSql(projectRef, "dispatch-outbox", "* * * * *");
}

/**
 * Expires idle drafts hourly (A-1.5, migration 20261103090000). The migration schedules it when pg_cron
 * exists as it runs; this covers a project that only gets pg_cron from this script, which runs after
 * the migrations. Scheduling the same name again replaces the job.
 */
export const EXPIRY_SCHEDULE_SQL = "select cron.schedule('expire-idle-intakes', '17 * * * *', 'select public.expire_idle_intakes();');";

/**
 * Queues the draft reminder hourly, for owners who asked for it (migration 20261105091000). Scheduled by the
 * migration the same way as draft expiry; this covers a project that only gets pg_cron from this script.
 */
export const REMINDER_SCHEDULE_SQL = "select cron.schedule('remind-idle-intakes', '29 * * * *', 'select public.queue_draft_expiry_reminders();');";

/**
 * The daily retention job (US-6.1, migration 20261104092000): queues closed drafts for deletion and prunes
 * operational, email and AI rate-limit records. Scheduled by the migration the same way as draft expiry;
 * this covers a project that only gets pg_cron from this script.
 */
export const RETENTION_SCHEDULE_SQL = "select cron.schedule('run-retention', '41 3 * * *', 'select public.run_retention();');";

/** Grants the advisor role to an existing account, and reports whether that account exists. */
export function advisorSql(email) {
  return [
    "with target as (select id from auth.users where lower(email) = lower(" + sqlLiteral(email) + "))",
    ", granted as (insert into public.user_roles (user_id, role) select id, 'advisor' from target on conflict do nothing returning user_id)",
    "select (select count(*) from target)::int as accounts, (select count(*) from granted)::int as newly_granted;",
  ].join("\n");
}

/**
 * The database side of the setup, one small query each, so a missing piece (no cron schema yet, say)
 * reads as "not there" instead of failing every check. Each returns one row with a count `n`.
 */
export const STATUS_QUERIES = {
  migrations: "select count(*)::int as n from supabase_migrations.schema_migrations;",
  intake_table: "select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_name = 'chamber_sessions';",
  // The app's tables rely on the platform's default grants to the API roles (row security does the rest).
  table_grants: "select (has_table_privilege('authenticated', 'public.chamber_sessions', 'SELECT') and has_table_privilege('authenticated', 'public.chamber_sessions', 'INSERT') and has_table_privilege('authenticated', 'public.chamber_sessions', 'UPDATE'))::int as n;",
  buckets: "select count(*)::int as n from storage.buckets where id in ('documents', 'manuscripts', 'quarantine');",
  extensions: "select count(*)::int as n from pg_extension where extname in ('pg_cron', 'pg_net');",
  vault_secret: "select count(*)::int as n from vault.secrets where name = 'service_role_key';",
  schedule: "select count(*)::int as n from cron.job where jobname = 'dispatch-outbox' and schedule = '* * * * *';",
  expiry_schedule: "select count(*)::int as n from cron.job where jobname = 'expire-idle-intakes';",
  reminder_schedule: "select count(*)::int as n from cron.job where jobname = 'remind-idle-intakes';",
  purge_schedule: "select count(*)::int as n from cron.job where jobname = 'purge-intakes';",
  monitor_schedule: "select count(*)::int as n from cron.job where jobname = 'ops-monitor';",
  scan_schedule: "select count(*)::int as n from cron.job where jobname = 'document-scan';",
  held_mail_schedule: "select count(*)::int as n from cron.job where jobname = 'held-mail';",
  retention_schedule: "select count(*)::int as n from cron.job where jobname = 'run-retention';",
  role_grants: "select count(*)::int as n from public.user_roles;",
};

/** The versions of the migrations applied to the project; read before and after `db push` for the summary. */
export const APPLIED_MIGRATIONS_SQL = "select version from supabase_migrations.schema_migrations order by version;";

/** The applied versions from APPLIED_MIGRATIONS_SQL's rows. */
export function migrationVersions(rows) {
  return rows.flatMap((r) => (r && (typeof r.version === "string" || typeof r.version === "number") ? [String(r.version)] : []));
}

/**
 * The migration files `db push` applied: versions in `after` that weren't in `before`, as the local file that has
 * each version (a version with no local file is shown as it is). Null when either read failed, so the summary says
 * it doesn't know rather than "none".
 */
export function newMigrations(before, after, localFiles) {
  if (!before || !after) return null;
  const had = new Set(before);
  return after.filter((v) => !had.has(v)).map((v) => localFiles.find((f) => f.startsWith(`${v}_`)) ?? v);
}

/** A list for the summary: every item up to `max`, otherwise the first and the last (the count is shown beside it). */
function listed(items, max = 10) {
  if (items.length <= max) return items.join(", ");
  return `${items[0]} … ${items[items.length - 1]}`;
}

/**
 * The summary the setup prints when it ends, or stops (QA H3): the migrations it applied, the secrets it set (names
 * only, never values) and the functions it deployed. `done` holds what it got through: `migrations` is null when
 * that step didn't run or couldn't be read back, `secrets` and `functions` empty when nothing was done.
 */
export function summaryLines(done) {
  const m = done.migrations;
  const migrations = m === undefined
    ? "not run"
    : m === null
      ? "pushed, but the migration history couldn't be read to list them"
      : m.length === 0
        ? "none new (the project was up to date)"
        : `${m.length} (${listed(m)})`;
  const secrets = done.secrets.length > 0 ? `${done.secrets.length} (${[...done.secrets].sort().join(", ")})` : "none";
  const functions = done.functions.length > 0 ? `${done.functions.length} (${done.functions.join(", ")})` : "none";
  return [`Migrations applied: ${migrations}`, `Secrets set (names only): ${secrets}`, `Functions deployed: ${functions}`];
}

/** The Management API's query endpoint returns rows; accept the shapes it might wrap them in. */
export function rowsFrom(body) {
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.result)) return body.result;
  if (body && Array.isArray(body.rows)) return body.rows;
  return [];
}

/**
 * Why the links in sign-up and email-change emails would not come back to the site, or [] when they
 * would. Supabase sends a link's visitor to the redirect the app asked for when it is on the Site
 * URL's own scheme, host and port, or on the Redirect URLs list, and otherwise to the Site URL: a new
 * project's Site URL is http://localhost:3000, so an unset one turns every confirmation into a browser
 * error page. With the Site URL right, the list isn't needed for the site itself. `appBaseUrl`
 * (APP_BASE_URL) pins the expected origin when it is known.
 */
export function authUrlProblems(authConfig, appBaseUrl) {
  if (!authConfig) return ["auth config unreadable"];
  let site;
  try { site = new URL(String(authConfig.site_url ?? "")); } catch { return ["Site URL is not set (Authentication → URL Configuration)"]; }
  const local = site.hostname === "localhost" || site.hostname === "127.0.0.1";
  let expected = null;
  const problems = [];
  if (appBaseUrl) {
    try { expected = new URL(appBaseUrl).origin; } catch {
      problems.push(`APP_BASE_URL (${appBaseUrl}) isn't a URL, so the Site URL wasn't compared with it`);
    }
  }

  const siteWrong = expected ? site.origin !== expected : local || site.protocol !== "https:";
  if (!siteWrong) return problems;
  problems.push(expected ? `Site URL is ${authConfig.site_url}, not ${expected}` : `Site URL is ${authConfig.site_url}: confirmation links send people there`);
  // With the Site URL wrong, only a Redirect URLs entry brings links back to the site.
  const allowList = String(authConfig.uri_allow_list ?? "").split(",").map((u) => u.trim()).filter(Boolean);
  if (expected && !allowList.includes(`${expected}/**`)) problems.push(`Redirect URLs lack ${expected}/**`);
  return problems;
}

/**
 * Turns everything the checks saw into lines. `seen` holds the status counts, the public auth
 * settings, the Management API's auth config, each function's probe, the secret names and Resend's
 * verdict on the secrets file's key (resendKeyVerdict), any of which may be missing. A check marked
 * `required: false` is a to-do (emails, advisor accounts), not a failed setup.
 */
export function interpretChecks(seen, { localMigrations, appBaseUrl = null }) {
  const s = seen.status ?? {};
  const checks = [];
  const add = (name, ok, detail, required = true) => checks.push({ name, ok, detail, required });

  add("Migrations applied", s.migrations === localMigrations, `${s.migrations ?? "?"} of ${localMigrations}`);
  add("App tables exist", s.intake_table === 1, s.intake_table === 1 ? "chamber_sessions found" : "chamber_sessions missing");
  add("Signed-in users can reach the tables", s.table_grants === 1, s.table_grants === 1 ? "authenticated has select, insert, update" : "the API roles lack table grants");
  add("Storage buckets", s.buckets === 3, `${s.buckets ?? "?"} of 3 (documents, manuscripts, quarantine)`);
  add("pg_cron and pg_net", s.extensions === 2, `${s.extensions ?? "?"} of 2 enabled`);
  add("Service-role key in Vault", s.vault_secret === 1, s.vault_secret === 1 ? "stored" : "missing");
  for (const job of SCHEDULED_FUNCTIONS) {
    const ok = s[job.status] === 1;
    add(job.label, ok, ok ? `${job.fn} ${job.every}` : job.missing);
  }
  add("Draft expiry schedule", s.expiry_schedule === 1, s.expiry_schedule === 1 ? "expire-idle-intakes hourly" : "not scheduled: idle drafts never expire");
  add("Draft reminder schedule", s.reminder_schedule === 1, s.reminder_schedule === 1 ? "remind-idle-intakes hourly" : "not scheduled: nobody who asked is reminded before a draft closes");
  add("Retention schedule", s.retention_schedule === 1, s.retention_schedule === 1 ? "run-retention daily" : "not scheduled: closed drafts are never deleted and old records are never pruned");

  const auth = seen.auth;
  add("Guest (anonymous) sign-in", auth?.external?.anonymous_users === true, auth ? `anonymous_users=${auth.external?.anonymous_users}` : "settings unreadable");
  add("Email confirmation required", auth ? auth.mailer_autoconfirm === false : false, auth ? `mailer_autoconfirm=${auth.mailer_autoconfirm}` : "settings unreadable");

  const ac = seen.authConfig;
  const codeOk = !!ac && ac.mailer_otp_length === 6 && String(ac.mailer_templates_email_change_content ?? "").includes(".Token");
  const signupOk = !!ac && signupTemplateOk(ac.mailer_templates_confirmation_content);
  add("Sign-up email survives mail scanners", signupOk, ac ? (signupOk ? "6-digit code and a link that confirms on a click" : "the Confirm signup template must carry {{ .Token }} and an app link with {{ .TokenHash }}, not {{ .ConfirmationURL }}") : "auth config unreadable");
  add("Email code message", codeOk, ac ? (codeOk ? "6-digit code in the email-change template" : "the email-change template must send a 6-digit {{ .Token }}") : "auth config unreadable");
  const urlProblems = authUrlProblems(ac, appBaseUrl);
  add("Email links return to the site", urlProblems.length === 0, urlProblems.length === 0 ? `Site URL ${ac.site_url}, redirects allowed under it` : urlProblems.join("; "));
  const signInOk = !!ac && ac.mailer_otp_length === 6 && sendsOtpCode(ac.mailer_templates_magic_link_content);
  add("Sign-in code message", signInOk, ac ? (signInOk ? "6-digit code in the magic-link template" : "the magic-link template must send a 6-digit {{ .Token }} (returning prospects sign in with it)") : "auth config unreadable");
  add("Sign-in emails reach prospects", !!ac?.smtp_host, ac ? (ac.smtp_host ? `custom SMTP (${ac.smtp_host})` : "built-in mailer: only your team's addresses get emails") : "auth config unreadable");
  // A to-do, not a failure: a low cap only bites once enough prospects arrive in the same hour.
  const perHour = ac?.rate_limit_email_sent;
  const limitOk = !!ac?.smtp_host && perHour >= MIN_AUTH_EMAILS_PER_HOUR;
  add(
    "Sign-in email limit",
    limitOk,
    !ac
      ? "auth config unreadable"
      : limitOk
        ? `${perHour} auth emails an hour`
        : !ac.smtp_host
          ? "built-in mailer: set up custom SMTP first, then the hourly limit can be raised"
          : `${perHour ?? "unreported"} auth emails an hour: past it, sign-up and sign-in codes are refused with 429 until the hour turns. Run the setup again, or raise it under Authentication → Rate Limits`,
    false,
  );

  for (const fn of FUNCTIONS) {
    const p = seen.functions?.[fn];
    // A 401 with our own {"error":"Unauthorized"} body proves the function deployed and started:
    // the gateway answers 404 for a missing function and 5xx for one that can't boot.
    const ok = !!p && p.status === 401 && p.ourError === true;
    add(`Function ${fn}`, ok, p ? `answered ${p.status}${p.ourError ? " from the function itself" : ""}` : "not probed");
  }

  // Only when the secrets file has a key to try: a refused key breaks every email, so it fails the setup (QA H5).
  if (seen.resend) add("Resend key", seen.resend.ok === true, seen.resend.detail, seen.resend.ok === false);

  const names = seen.secretNames ?? null;
  if (names) {
    const missing = ["IP_HASH_SECRET", "APP_BASE_URL"].filter((n) => !names.includes(n));
    // Anthropic is the only AI provider: a project that still holds only a Lovable key has Lenore unavailable.
    if (!names.includes("ANTHROPIC_API_KEY")) missing.push("ANTHROPIC_API_KEY");
    add("Function secrets", missing.length === 0, missing.length === 0 ? "ANTHROPIC_API_KEY, IP_HASH_SECRET and APP_BASE_URL set" : `missing: ${missing.join(", ")}`);
    const emailMissing = EMAIL_SECRETS.filter((n) => !names.includes(n));
    add("Email secrets", emailMissing.length === 0, emailMissing.length === 0 ? "all set" : `missing: ${emailMissing.join(", ")} (emails wait in the queue)`, false);
    const alerts = names.includes("ENGINEERING_ALERT_WEBHOOK_URL");
    add("Engineering alerts", alerts, alerts ? "ENGINEERING_ALERT_WEBHOOK_URL set" : "ENGINEERING_ALERT_WEBHOOK_URL not set: dead emails, failed deletions, malware detections and failure spikes are only logged", false);
    const scanner = names.includes("MALWARE_SCANNER");
    add("Malware scanner", scanner, scanner ? "MALWARE_SCANNER set" : "MALWARE_SCANNER not set: every upload is refused until it is (scanii in production; none only on a demo, staging or development project)", false);
  } else {
    add("Function secrets", false, "could not list secret names");
  }

  const grants = s.role_grants ?? 0;
  add("Advisor accounts", grants > 0, grants > 0 ? `${grants} role grant(s)` : "none yet: sign up on the site, then run with --grant-advisor you@example.com", false);
  return checks;
}

/** True when every required check passed. */
export function setupComplete(checks) {
  return checks.every((c) => c.ok || !c.required);
}
