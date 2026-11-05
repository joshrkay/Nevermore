#!/usr/bin/env node
// Sets up a Supabase project for this app and checks the result: migrations, function secrets, the
// edge functions, auth settings, the schedules and (later) advisor roles. Every step can be
// run again. Keys stay on this machine: the script reads them from the Supabase API and the secrets
// file and never prints them. See docs/SUPABASE_SETUP.md.
//
//   SUPABASE_ACCESS_TOKEN=... node scripts/supabase-setup.mjs --project-ref <ref>
//   SUPABASE_ACCESS_TOKEN=... node scripts/supabase-setup.mjs --project-ref <ref> --check
//   SUPABASE_ACCESS_TOKEN=... node scripts/supabase-setup.mjs --project-ref <ref> --grant-advisor you@example.com

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  advisorSql, APPLIED_MIGRATIONS_SQL, authConfigPatch, checkSecrets, cliCommands, DOCKER_NEEDED, envFileLine, EXPIRY_SCHEDULE_SQL, REMINDER_SCHEDULE_SQL,
  EXTENSIONS_SQL, FUNCTIONS, functionScheduleSql, interpretChecks, isProjectRef, migrationVersions, newMigrations, parseCliVersion,
  parseEnvFile, publicKeyFrom, resendKeyVerdict, RETENTION_SCHEDULE_SQL, rowsFrom, SCHEDULED_FUNCTIONS, serviceRoleKeyFrom,
  setupComplete, smtpKeyNote, STATUS_QUERIES, summaryLines, vaultSecretSql,
} from "./supabase-setup-lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Overridable so the script can be exercised against stand-ins; real runs leave these unset.
const API_URL = process.env.SETUP_API_URL ?? "https://api.supabase.com";
const SUPABASE_BIN = process.env.SETUP_SUPABASE_BIN ?? "supabase";
const DOCKER_BIN = process.env.SETUP_DOCKER_BIN ?? "docker";
const RESEND_URL = process.env.SETUP_RESEND_URL ?? "https://api.resend.com";

const USAGE = `Usage: SUPABASE_ACCESS_TOKEN=... node scripts/supabase-setup.mjs --project-ref <ref> [options]

  --check                 Only check the project; change nothing
  --grant-advisor <email> Give an existing account the advisor role, then check
  --secrets-file <path>   Function secrets (default supabase/.env.production; see supabase/env.production.example)
  --yes                   Don't ask before changing the project

Needs the Supabase CLI (3.x; 2.x still works) and, to change the project, Docker running: the CLI bundles the
functions with it.`;

class StepError extends Error {}

const say = (line = "") => console.log(line);
const step = (line) => say(`\n→ ${line}`);
const fail = (line) => { throw new StepError(line); };

function parseCli() {
  try {
    const { values } = parseArgs({
      options: {
        "project-ref": { type: "string" },
        check: { type: "boolean", default: false },
        "grant-advisor": { type: "string" },
        "secrets-file": { type: "string", default: "supabase/.env.production" },
        yes: { type: "boolean", default: false },
        help: { type: "boolean", default: false },
      },
    });
    return values;
  } catch (e) {
    console.error(`${e.message}\n\n${USAGE}`);
    process.exit(2);
  }
}

// ---- Supabase Management API -------------------------------------------------------------------

function api(token) {
  return async function call(method, pathname, body) {
    let res;
    try {
      res = await fetch(`${API_URL}${pathname}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (e) {
      return { ok: false, status: 0, body: null, message: `could not reach ${API_URL} (${e.cause?.code ?? e.message})` };
    }
    const text = await res.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
    const message = parsed?.message ?? parsed?.error ?? text.slice(0, 300);
    return { ok: res.ok, status: res.status, body: parsed, message };
  };
}

// ---- Supabase CLI ------------------------------------------------------------------------------

/** Runs the CLI attached to this terminal, so it can ask for the database password or a confirmation. */
function cliInteractive(args) {
  const r = spawnSync(SUPABASE_BIN, args, { cwd: ROOT, stdio: "inherit" });
  if (r.error) fail(`could not run \`${SUPABASE_BIN}\`: ${r.error.message}`);
  return r.status === 0;
}

/** Runs the CLI and returns its output. Used for output that can hold keys, so nothing is echoed. */
function cliCapture(args) {
  const r = spawnSync(SUPABASE_BIN, args, { cwd: ROOT, encoding: "utf8" });
  if (r.error || r.status !== 0) return null;
  return r.stdout;
}

function parseJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

/** Whether the Docker daemon answers. `functions deploy` bundles with it (DOCKER_NEEDED says why). */
function dockerRunning() {
  const r = spawnSync(DOCKER_BIN, ["info"], { stdio: "ignore", timeout: 30_000 });
  return !r.error && r.status === 0;
}

// ---- Resend ------------------------------------------------------------------------------------

/**
 * Tries RESEND_API_KEY on Resend with an empty email, which Resend refuses after reading the key, so nothing is sent
 * (resendKeyVerdict reads the answer). Only the status and Resend's error code are kept: never the key.
 */
async function tryResendKey(key) {
  try {
    const res = await fetch(`${RESEND_URL}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(20_000),
    });
    return resendKeyVerdict({ status: res.status, name: parseJson(await res.text())?.name });
  } catch {
    return resendKeyVerdict({ status: 0 });
  }
}

// ---- Steps -------------------------------------------------------------------------------------

async function apiKeys(call, ref) {
  const res = await call("GET", `/v1/projects/${ref}/api-keys?reveal=true`);
  if (res.ok && Array.isArray(res.body)) return res.body;
  const out = cliCapture(["projects", "api-keys", "--project-ref", ref, "-o", "json"]);
  return out ? parseJson(out) : null;
}

async function secretNames(call, ref) {
  const res = await call("GET", `/v1/projects/${ref}/secrets`);
  if (res.ok && Array.isArray(res.body)) return res.body.map((s) => s.name);
  const out = cliCapture(["secrets", "list", "--project-ref", ref, "-o", "json"]);
  const list = out ? parseJson(out) : null;
  return Array.isArray(list) ? list.map((s) => s.name) : null;
}

async function runSql(call, ref, query) {
  return await call("POST", `/v1/projects/${ref}/database/query`, { query });
}

/** The applied migration versions, [] on a project that has none yet, or null when they can't be read. */
async function appliedMigrations(call, ref) {
  const res = await runSql(call, ref, APPLIED_MIGRATIONS_SQL);
  if (res.ok) return migrationVersions(rowsFrom(res.body));
  // A new project has no migration history table until the first push.
  return /does not exist/i.test(String(res.message ?? "")) ? [] : null;
}

/** Writes the secrets to a private temporary file for `supabase secrets set`, and removes it afterwards. */
function setSecrets(cli, secrets) {
  const dir = mkdtempSync(path.join(tmpdir(), "supabase-setup-"));
  const file = path.join(dir, "secrets.env");
  try {
    const lines = Object.entries(secrets).map(([name, value]) => envFileLine(name, value));
    writeFileSync(file, `${lines.join("\n")}\n`, { mode: 0o600 });
    return cliInteractive(cli.secretsSet(file));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Prints what the setup applied, set and deployed (secret names only). */
function printSummary(title, done) {
  step(title);
  for (const line of summaryLines(done)) say(`  ${line}`);
}

/** Runs the setup steps, then prints the summary; when a step fails, prints what was done before it and stops. */
async function setup(call, ref, secretsFile, env, cli) {
  const done = { migrations: undefined, secrets: [], functions: [] };
  try {
    await setupSteps(call, ref, secretsFile, env, cli, done);
  } catch (e) {
    if (e instanceof StepError) printSummary("Done before it stopped", done);
    throw e;
  }
  printSummary("Summary", done);
}

async function setupSteps(call, ref, secretsFile, env, cli, done) {
  // First, because it needs only the Management API: a failure in a later step (database password,
  // migration, Docker) must not leave the Site URL at Supabase's default, which breaks every sign-up link.
  step("Auth: guest sign-in, email confirmation, Site URL and redirects, the sign-up, email-change and sign-in messages, sign-in email delivery");
  const current = await call("GET", `/v1/projects/${ref}/config/auth`);
  // Without the current settings the patch would replace the Redirect URLs list, so stop instead.
  if (!current.ok || !current.body) fail(`Reading the auth settings failed (${current.status}); nothing was changed. Check the access token can manage this project, then run this again.`);
  const { patch, notes } = authConfigPatch(current.body, env);
  if (Object.keys(patch).length === 0) say("  Already set.");
  else {
    const res = await call("PATCH", `/v1/projects/${ref}/config/auth`, patch);
    if (!res.ok) fail(`Updating auth settings failed (${res.status}). Set them in the dashboard (Authentication → Sign In / Providers, URL Configuration, Emails); docs/SUPABASE_SETUP.md lists them.`);
    say(`  Updated: ${Object.keys(patch).filter((k) => k !== "smtp_pass").join(", ")}`);
  }
  for (const note of notes) say(`  Note: ${note}`);
  const smtpNote = smtpKeyNote(current.body, patch, env.RESEND_API_KEY);
  if (smtpNote) say(`  ${smtpNote}.`);

  step("Linking this folder to the project (the CLI may ask for the database password)");
  if (!cliInteractive(cli.link)) fail("`supabase link` failed. Reset the database password in the dashboard (Project Settings → Database) if you don't have it, or set SUPABASE_DB_PASSWORD.");

  step("Applying database migrations");
  const before = await appliedMigrations(call, ref);
  if (!cliInteractive(cli.dbPush)) fail("`supabase db push` failed; nothing after it was changed. Fix the error above and run the script again.");
  const after = await appliedMigrations(call, ref);
  const localFiles = readdirSync(path.join(ROOT, "supabase", "migrations")).filter((f) => f.endsWith(".sql")).sort();
  done.migrations = newMigrations(before, after, localFiles);

  step(`Setting function secrets from ${path.relative(ROOT, secretsFile)}`);
  const secrets = Object.fromEntries(Object.entries(env).filter(([, v]) => v.trim() !== ""));
  const existing = await secretNames(call, ref);
  if (!secrets.IP_HASH_SECRET && !existing?.includes("IP_HASH_SECRET")) {
    secrets.IP_HASH_SECRET = randomBytes(32).toString("hex");
    say("  Generated IP_HASH_SECRET (used to hash caller addresses for the AI limits).");
  }
  if (!setSecrets(cli, secrets)) fail("`supabase secrets set` failed.");
  done.secrets = Object.keys(secrets);

  for (const fn of FUNCTIONS) {
    step(`Deploying ${fn}`);
    if (!cliInteractive(cli.deploy(fn))) fail(`Deploying ${fn} failed. Check Docker is still running (the CLI bundles the functions with it), then run this again.`);
    done.functions.push(fn);
  }

  step("Schedules: pg_cron, pg_net, the service-role key in Vault, dispatch-outbox every minute, purge-intakes hourly, ops-monitor every five minutes, draft expiry and reminders hourly and retention daily");
  const ext = await runSql(call, ref, EXTENSIONS_SQL);
  if (!ext.ok) fail(`Enabling pg_cron and pg_net failed (${ext.status}): ${ext.message}`);
  const keys = await apiKeys(call, ref);
  const serviceRoleKey = serviceRoleKeyFrom(keys);
  if (!serviceRoleKey) fail("Couldn't read the project's legacy service_role key. If legacy API keys are disabled (Project Settings → API Keys), re-enable them: the scheduled functions (dispatch-outbox, purge-intakes, ops-monitor) authenticate the schedule with it.");
  // The statement embeds the key, so its error text is not printed.
  const vault = await runSql(call, ref, vaultSecretSql(serviceRoleKey));
  if (!vault.ok) fail(`Storing the service-role key in Vault failed (${vault.status}).`);
  for (const job of SCHEDULED_FUNCTIONS) {
    const cron = await runSql(call, ref, functionScheduleSql(ref, job.fn, job.schedule));
    if (!cron.ok) fail(`Scheduling ${job.fn} failed (${cron.status}): ${cron.message}`);
  }
  const expiry = await runSql(call, ref, EXPIRY_SCHEDULE_SQL);
  if (!expiry.ok) fail(`Scheduling expire-idle-intakes failed (${expiry.status}): ${expiry.message}`);
  const reminders = await runSql(call, ref, REMINDER_SCHEDULE_SQL);
  if (!reminders.ok) fail(`Scheduling remind-idle-intakes failed (${reminders.status}): ${reminders.message}`);
  const retention = await runSql(call, ref, RETENTION_SCHEDULE_SQL);
  if (!retention.ok) fail(`Scheduling run-retention failed (${retention.status}): ${retention.message}`);
  say("  Scheduled.");
}

async function grantAdvisor(call, ref, email) {
  step(`Granting the advisor role to ${email}`);
  const res = await runSql(call, ref, advisorSql(email));
  if (!res.ok) fail(`The grant failed (${res.status}): ${res.message}`);
  const row = rowsFrom(res.body)[0] ?? {};
  if (!row.accounts) say("  No account has that email yet: sign up on the site's /login page, confirm the email, then run this again.");
  else if (row.newly_granted) say("  Granted. They see the advisor queue at /advisor after signing in again.");
  else say("  They already had it.");
}

async function check(call, ref, appBaseUrl, resend) {
  step("Checking the project");
  const status = {};
  for (const [name, query] of Object.entries(STATUS_QUERIES)) {
    const res = await runSql(call, ref, query);
    const n = res.ok ? rowsFrom(res.body)[0]?.n : undefined;
    status[name] = typeof n === "number" ? n : undefined;
  }

  const projectUrl = process.env.SETUP_PROJECT_URL ?? `https://${ref}.supabase.co`;
  const publicKey = publicKeyFrom(await apiKeys(call, ref));
  let auth = null;
  const functions = {};
  if (publicKey) {
    try {
      const res = await fetch(`${projectUrl}/auth/v1/settings`, { headers: { apikey: publicKey }, signal: AbortSignal.timeout(30_000) });
      if (res.ok) auth = await res.json();
    } catch { /* reported as unreadable */ }
    for (const fn of FUNCTIONS) {
      try {
        // Signed in as nobody: a deployed function answers with its own 401.
        const res = await fetch(`${projectUrl}/functions/v1/${fn}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${publicKey}`, apikey: publicKey, "Content-Type": "application/json" },
          body: "{}",
          signal: AbortSignal.timeout(30_000),
        });
        const body = parseJson(await res.text());
        functions[fn] = { status: res.status, ourError: body?.error === "Unauthorized" };
      } catch {
        functions[fn] = { status: 0, ourError: false };
      }
    }
  }
  const authConfigRes = await call("GET", `/v1/projects/${ref}/config/auth`);

  const localMigrations = readdirSync(path.join(ROOT, "supabase", "migrations")).filter((f) => f.endsWith(".sql")).length;
  const checks = interpretChecks({
    status,
    auth,
    authConfig: authConfigRes.ok ? authConfigRes.body : null,
    functions,
    secretNames: await secretNames(call, ref),
    resend,
  }, { localMigrations, appBaseUrl });

  for (const c of checks) say(`  ${c.ok ? "✓" : c.required ? "✗" : "…"} ${c.name}: ${c.detail}`);
  return checks;
}

// ---- Main --------------------------------------------------------------------------------------

async function main() {
  const opts = parseCli();
  if (opts.help) { say(USAGE); return 0; }

  const ref = opts["project-ref"];
  if (!isProjectRef(ref)) { console.error(`--project-ref must be the 20-letter project ref (from the project's URL).\n\n${USAGE}`); return 2; }
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) { console.error("Set SUPABASE_ACCESS_TOKEN to a personal access token (Supabase dashboard → Account → Access Tokens)."); return 2; }
  const call = api(token);

  const project = await call("GET", `/v1/projects/${ref}`);
  if (!project.ok) {
    console.error(project.status === 401 || project.status === 403
      ? "The access token was refused, or it can't see this project."
      : `Couldn't read project ${ref} (${project.status}): ${project.message}`);
    return 1;
  }
  say(`Project: ${project.body?.name ?? ref} (${ref}), ${project.body?.region ?? "unknown region"}, ${project.body?.status ?? "unknown status"}`);
  if (project.body?.status && project.body.status !== "ACTIVE_HEALTHY") say("Warning: the project isn't ACTIVE_HEALTHY. A paused project has to be restored in the dashboard first.");

  const writes = !opts.check;
  const secretsFile = path.resolve(ROOT, opts["secrets-file"]);
  // --check reads the file too when it is there, to compare the auth Site URL with APP_BASE_URL.
  const env = existsSync(secretsFile) ? parseEnvFile(readFileSync(secretsFile, "utf8")) : null;
  // Tried once, before anything changes, and reported again with the checks. Not with whitespace in it: checkSecrets
  // stops the setup on that, and the check would only say Resend refused it.
  const resendKey = env?.RESEND_API_KEY ?? "";
  const resend = resendKey.trim() && !/\s/.test(resendKey) && !opts["grant-advisor"] ? await tryResendKey(resendKey) : undefined;
  let version = null;
  if (writes && !opts["grant-advisor"]) {
    if (!env) {
      console.error(`No secrets file at ${path.relative(ROOT, secretsFile)}. Copy supabase/env.production.example there and fill it in.`);
      return 2;
    }
    const { errors, warnings } = checkSecrets(env);
    for (const w of warnings) say(`Note: ${w}`);
    // Every value must fit the env file `supabase secrets set` reads; find out now, before changing anything.
    for (const [name, value] of Object.entries(env)) {
      if (value.trim() === "") continue;
      try { envFileLine(name, value); } catch (e) { errors.push(e.message); }
    }
    if (errors.length > 0) { for (const e of errors) console.error(`✗ ${e}`); return 2; }
    // Everything the run needs on this machine is checked now, so a missing piece stops it before any change
    // rather than partway (QA H3).
    const versionText = cliCapture(["--version"]);
    if (!versionText) { console.error(`The Supabase CLI isn't installed (\`${SUPABASE_BIN} --version\` failed). See docs/SUPABASE_SETUP.md.`); return 2; }
    version = parseCliVersion(versionText);
    say(`Supabase CLI ${version ? version.join(".") : "(version unreadable; using the current CLI's flags)"}`);
    if (!dockerRunning()) { console.error(`✗ ${DOCKER_NEEDED}`); return 2; }
    // A refused key would be stored as the function secret and the SMTP password, and break every email (QA H5).
    if (resend?.ok === false) { console.error(`✗ RESEND_API_KEY: ${resend.detail}. Nothing was changed.`); return 2; }
    if (resend?.ok === null) say(`Warning: RESEND_API_KEY: ${resend.detail}. Emails fail if it is wrong; run --check once Resend answers.`);
    else if (resend?.ok) say("RESEND_API_KEY: Resend accepted it.");

    if (!opts.yes) {
      say(`\nThis applies migrations, sets secrets, deploys ${FUNCTIONS.join(", ")}, changes auth settings and schedules email delivery, deletions, retention and alerts on ${ref}.`);
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const answer = (await rl.question(`Type the project ref to continue: `)).trim();
      rl.close();
      if (answer !== ref) { say("Stopped; nothing was changed."); return 1; }
    }
    await setup(call, ref, secretsFile, env, cliCommands(version, ref));
  } else if (writes) {
    await grantAdvisor(call, ref, opts["grant-advisor"]);
  }

  const checks = await check(call, ref, env?.APP_BASE_URL?.trim() || null, resend);
  if (setupComplete(checks)) {
    say("\nThe project is set up. Items marked … are optional to-dos.");
    return 0;
  }
  say("\nSome checks failed (✗). Fix what they name and run this again; every step is safe to repeat.");
  return 1;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(`\n✗ ${e instanceof StepError ? e.message : e?.stack ?? e}`);
    process.exit(1);
  },
);
