// Pure helpers for scripts/supabase-setup.mjs: parsing, validation, the SQL it runs and how it
// reads the results. No I/O, so they are unit-tested (scripts/supabase-setup-lib.test.ts).

export const FUNCTIONS = ["chamber-extract", "document-extract", "dispatch-outbox", "resend-webhook"];

/** Secrets the email notifications need. Without them emails wait in the queue; nothing is lost. */
export const EMAIL_SECRETS = ["RESEND_API_KEY", "EMAIL_FROM", "ADVISORY_NOTIFY_EMAIL", "SUPPORT_EMAIL", "PROSPECT_RESPONSE_TIME"];

/** Supabase sets these for every function itself, and refuses to let you set names starting with SUPABASE_. */
const PLATFORM_PREFIX = "SUPABASE_";

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

  const provider = set("AI_PROVIDER") ? env.AI_PROVIDER : "lovable";
  if (provider !== "lovable" && provider !== "anthropic") errors.push(`AI_PROVIDER must be "lovable" or "anthropic", not "${provider}"`);
  else if (provider === "anthropic" && !set("ANTHROPIC_API_KEY")) errors.push("ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic");
  else if (provider === "lovable" && !set("LOVABLE_API_KEY")) errors.push("LOVABLE_API_KEY is required (or set AI_PROVIDER=anthropic and ANTHROPIC_API_KEY)");

  if (!set("APP_BASE_URL")) errors.push("APP_BASE_URL is required (the site's address, e.g. https://nevermore-gamma.vercel.app)");
  else {
    let url;
    try { url = new URL(env.APP_BASE_URL); } catch { /* reported below */ }
    const local = url && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
    if (!url || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) errors.push("APP_BASE_URL must be an https:// address");
    else if (url.pathname !== "/" || url.search || url.hash) errors.push("APP_BASE_URL must be just the site's origin, with no path");
  }

  const missingEmail = EMAIL_SECRETS.filter((name) => !set(name));
  if (missingEmail.length > 0) warnings.push(`Emails stay queued until these are set: ${missingEmail.join(", ")}`);
  // Sending works without it, so it is not one of the email secrets; only the bounces are lost.
  if (set("RESEND_API_KEY") && !set("RESEND_WEBHOOK_SECRET")) {
    warnings.push("Bounces and spam complaints are not processed until RESEND_WEBHOOK_SECRET is set: the signing secret of a Resend webhook pointed at the resend-webhook function (docs/NOTIFICATIONS.md)");
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

/** `Edgar Allan Advisory <intake@mail.example.com>` or a bare address, as the sender name and address. */
export function parseSender(from) {
  const v = (from ?? "").trim();
  const named = v.match(/^([^<>\r\n]{1,100})<([^<>\s]+@[^<>\s]+)>$/);
  if (named) return { name: named[1].trim(), email: named[2] };
  return /^[^<>\s]+@[^<>\s]+$/.test(v) ? { name: "", email: v } : null;
}

const RESEND_SMTP_HOST = "smtp.resend.com";

/** The email-change message a guest gets when they add an email: it must carry the 6-digit code `VerifyEmailGate` asks for. */
export const EMAIL_CODE_SUBJECT = "Your verification code";
export const EMAIL_CODE_TEMPLATE = [
  "<h2>Confirm your email</h2>",
  "<p>Enter this code to confirm {{ .NewEmail }} and continue your intake:</p>",
  "<p style=\"font-size:24px;font-weight:bold;letter-spacing:4px\">{{ .Token }}</p>",
  "<p>If you didn't ask for this, you can ignore this email.</p>",
].join("\n");

/**
 * The auth settings to change, given the current ones (`null` when they couldn't be read). Only what
 * differs is sent, and nothing already customised is overwritten: extra redirect URLs are kept, a
 * template that already has the code stays, and SMTP that isn't Resend's is left alone. Resend's SMTP
 * settings are sent every time, so a rotated RESEND_API_KEY is picked up (the API doesn't return the
 * current password to compare). `notes` explain what was left as is. The patch can hold the SMTP
 * password: never print it.
 */
export function authConfigPatch(current, env) {
  const c = current ?? {};
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

  const sender = parseSender(env.EMAIL_FROM);
  const resendKey = (env.RESEND_API_KEY ?? "").trim();
  if (!resendKey || !sender) {
    notes.push("Sign-in emails use Supabase's built-in mailer, which only delivers to your team's addresses: set RESEND_API_KEY and EMAIL_FROM so prospects get their codes");
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
  return { patch, notes };
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
    `    perform vault.create_secret(${sqlLiteral(serviceRoleKey)}, 'service_role_key', 'Bearer token the dispatch-outbox schedule sends');`,
    "  end if;",
    "end $$;",
  ].join("\n");
}

/** Runs dispatch-outbox every minute (docs/NOTIFICATIONS.md). Scheduling the same name again replaces the job. */
export function cronScheduleSql(projectRef) {
  if (!isProjectRef(projectRef)) throw new Error("invalid project ref");
  const url = `https://${projectRef}.supabase.co/functions/v1/dispatch-outbox`;
  return [
    "select cron.schedule('dispatch-outbox', '* * * * *', $job$",
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
  buckets: "select count(*)::int as n from storage.buckets where id in ('documents', 'manuscripts');",
  extensions: "select count(*)::int as n from pg_extension where extname in ('pg_cron', 'pg_net');",
  vault_secret: "select count(*)::int as n from vault.secrets where name = 'service_role_key';",
  schedule: "select count(*)::int as n from cron.job where jobname = 'dispatch-outbox' and schedule = '* * * * *';",
  role_grants: "select count(*)::int as n from public.user_roles;",
};

/** The Management API's query endpoint returns rows; accept the shapes it might wrap them in. */
export function rowsFrom(body) {
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.result)) return body.result;
  if (body && Array.isArray(body.rows)) return body.rows;
  return [];
}

/**
 * Turns everything the checks saw into lines. `seen` holds the status counts, the public auth
 * settings, the Management API's auth config, each function's probe and the secret names, any of
 * which may be missing. A check marked
 * `required: false` is a to-do (emails, advisor accounts), not a failed setup.
 */
export function interpretChecks(seen, { localMigrations }) {
  const s = seen.status ?? {};
  const checks = [];
  const add = (name, ok, detail, required = true) => checks.push({ name, ok, detail, required });

  add("Migrations applied", s.migrations === localMigrations, `${s.migrations ?? "?"} of ${localMigrations}`);
  add("App tables exist", s.intake_table === 1, s.intake_table === 1 ? "chamber_sessions found" : "chamber_sessions missing");
  add("Signed-in users can reach the tables", s.table_grants === 1, s.table_grants === 1 ? "authenticated has select, insert, update" : "the API roles lack table grants");
  add("Storage buckets", s.buckets === 2, `${s.buckets ?? "?"} of 2 (documents, manuscripts)`);
  add("pg_cron and pg_net", s.extensions === 2, `${s.extensions ?? "?"} of 2 enabled`);
  add("Service-role key in Vault", s.vault_secret === 1, s.vault_secret === 1 ? "stored" : "missing");
  add("Email schedule", s.schedule === 1, s.schedule === 1 ? "dispatch-outbox every minute" : "not scheduled");

  const auth = seen.auth;
  add("Guest (anonymous) sign-in", auth?.external?.anonymous_users === true, auth ? `anonymous_users=${auth.external?.anonymous_users}` : "settings unreadable");
  add("Email confirmation required", auth ? auth.mailer_autoconfirm === false : false, auth ? `mailer_autoconfirm=${auth.mailer_autoconfirm}` : "settings unreadable");

  const ac = seen.authConfig;
  const codeOk = !!ac && ac.mailer_otp_length === 6 && String(ac.mailer_templates_email_change_content ?? "").includes(".Token");
  add("Email code message", codeOk, ac ? (codeOk ? "6-digit code in the email-change template" : "the email-change template must send a 6-digit {{ .Token }}") : "auth config unreadable");
  add("Sign-in emails reach prospects", !!ac?.smtp_host, ac ? (ac.smtp_host ? `custom SMTP (${ac.smtp_host})` : "built-in mailer: only your team's addresses get emails") : "auth config unreadable");

  for (const fn of FUNCTIONS) {
    const p = seen.functions?.[fn];
    // A 401 with our own {"error":"Unauthorized"} body proves the function deployed and started:
    // the gateway answers 404 for a missing function and 5xx for one that can't boot.
    const ok = !!p && p.status === 401 && p.ourError === true;
    add(`Function ${fn}`, ok, p ? `answered ${p.status}${p.ourError ? " from the function itself" : ""}` : "not probed");
  }

  const names = seen.secretNames ?? null;
  if (names) {
    const missing = ["IP_HASH_SECRET", "APP_BASE_URL"].filter((n) => !names.includes(n));
    if (!names.includes("LOVABLE_API_KEY") && !names.includes("ANTHROPIC_API_KEY")) missing.push("an AI provider key");
    add("Function secrets", missing.length === 0, missing.length === 0 ? "AI key, IP_HASH_SECRET and APP_BASE_URL set" : `missing: ${missing.join(", ")}`);
    const emailMissing = EMAIL_SECRETS.filter((n) => !names.includes(n));
    add("Email secrets", emailMissing.length === 0, emailMissing.length === 0 ? "all set" : `missing: ${emailMissing.join(", ")} (emails wait in the queue)`, false);
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
