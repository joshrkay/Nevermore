#!/usr/bin/env node
// Sets up a Supabase project for this app and checks the result: migrations, function secrets, the
// three edge functions, auth settings, the email schedule and (later) advisor roles. Every step can be
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
  advisorSql, authConfigPatch, checkSecrets, cronScheduleSql, envFileLine, EXTENSIONS_SQL, FUNCTIONS, probeHeaders,
  interpretChecks, isProjectRef, parseEnvFile, publicKeyFrom, rowsFrom, serviceRoleKeyFrom, setupComplete,
  STATUS_QUERIES, vaultSecretSql,
} from "./supabase-setup-lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Overridable so the script can be exercised against stand-ins; real runs leave these unset.
const API_URL = process.env.SETUP_API_URL ?? "https://api.supabase.com";
const SUPABASE_BIN = process.env.SETUP_SUPABASE_BIN ?? "supabase";

const USAGE = `Usage: SUPABASE_ACCESS_TOKEN=... node scripts/supabase-setup.mjs --project-ref <ref> [options]

  --check                 Only check the project; change nothing
  --grant-advisor <email> Give an existing account the advisor role, then check
  --secrets-file <path>   Function secrets (default supabase/.env.production; see supabase/env.production.example)
  --yes                   Don't ask before changing the project`;

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

/** Writes the secrets to a private temporary file for `supabase secrets set`, and removes it afterwards. */
function setSecrets(ref, secrets) {
  const dir = mkdtempSync(path.join(tmpdir(), "supabase-setup-"));
  const file = path.join(dir, "secrets.env");
  try {
    const lines = Object.entries(secrets).map(([name, value]) => envFileLine(name, value));
    writeFileSync(file, `${lines.join("\n")}\n`, { mode: 0o600 });
    return cliInteractive(["secrets", "set", "--env-file", file, "--project-ref", ref]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function setup(call, ref, secretsFile, env) {
  step("Linking this folder to the project (the CLI may ask for the database password)");
  if (!cliInteractive(["link", "--project-ref", ref])) fail("`supabase link` failed. Reset the database password in the dashboard (Project Settings → Database) if you don't have it, or set SUPABASE_DB_PASSWORD.");

  step("Applying database migrations");
  if (!cliInteractive(["db", "push"])) fail("`supabase db push` failed; nothing after it was changed. Fix the error above and run the script again.");

  step(`Setting function secrets from ${path.relative(ROOT, secretsFile)}`);
  const secrets = Object.fromEntries(Object.entries(env).filter(([, v]) => v.trim() !== ""));
  const existing = await secretNames(call, ref);
  if (!secrets.IP_HASH_SECRET && !existing?.includes("IP_HASH_SECRET")) {
    secrets.IP_HASH_SECRET = randomBytes(32).toString("hex");
    say("  Generated IP_HASH_SECRET (used to hash caller addresses for the AI limits).");
  }
  if (!setSecrets(ref, secrets)) fail("`supabase secrets set` failed.");

  for (const fn of FUNCTIONS) {
    step(`Deploying ${fn}`);
    if (!cliInteractive(["functions", "deploy", fn, "--project-ref", ref])) fail(`Deploying ${fn} failed. If the CLI asked for Docker, update it or run \`supabase functions deploy ${fn} --use-api --project-ref ${ref}\`, then run this again.`);
  }

  step("Auth: guest sign-in, email confirmation, redirect URL, the email code and sign-in email delivery");
  const current = await call("GET", `/v1/projects/${ref}/config/auth`);
  const { patch, notes } = authConfigPatch(current.ok ? current.body : null, env);
  if (Object.keys(patch).length === 0) say("  Already set.");
  else {
    const res = await call("PATCH", `/v1/projects/${ref}/config/auth`, patch);
    if (!res.ok) fail(`Updating auth settings failed (${res.status}). Set them in the dashboard (Authentication → Sign In / Providers, URL Configuration, Emails); docs/SUPABASE_SETUP.md lists them.`);
    say(`  Updated: ${Object.keys(patch).filter((k) => k !== "smtp_pass").join(", ")}`);
  }
  for (const note of notes) say(`  Note: ${note}`);

  step("Email schedule: pg_cron, pg_net, the service-role key in Vault, and a run every minute");
  const ext = await runSql(call, ref, EXTENSIONS_SQL);
  if (!ext.ok) fail(`Enabling pg_cron and pg_net failed (${ext.status}): ${ext.message}`);
  const keys = await apiKeys(call, ref);
  const serviceRoleKey = serviceRoleKeyFrom(keys);
  if (!serviceRoleKey) fail("Couldn't read the project's legacy service_role key. If legacy API keys are disabled (Project Settings → API Keys), re-enable them: dispatch-outbox authenticates the schedule with it.");
  // The statement embeds the key, so its error text is not printed.
  const vault = await runSql(call, ref, vaultSecretSql(serviceRoleKey));
  if (!vault.ok) fail(`Storing the service-role key in Vault failed (${vault.status}).`);
  const cron = await runSql(call, ref, cronScheduleSql(ref));
  if (!cron.ok) fail(`Scheduling dispatch-outbox failed (${cron.status}): ${cron.message}`);
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

async function check(call, ref) {
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
        // Signed in as nobody: a deployed function answers with its own 401. A function an outside
        // service calls is probed with no credentials at all, as that service calls it.
        const res = await fetch(`${projectUrl}/functions/v1/${fn}`, {
          method: "POST",
          headers: probeHeaders(fn, publicKey),
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
  }, { localMigrations });

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
  if (writes && !opts["grant-advisor"]) {
    const secretsFile = path.resolve(ROOT, opts["secrets-file"]);
    if (!existsSync(secretsFile)) {
      console.error(`No secrets file at ${path.relative(ROOT, secretsFile)}. Copy supabase/env.production.example there and fill it in.`);
      return 2;
    }
    const env = parseEnvFile(readFileSync(secretsFile, "utf8"));
    const { errors, warnings } = checkSecrets(env);
    for (const w of warnings) say(`Note: ${w}`);
    // Every value must fit the env file `supabase secrets set` reads; find out now, before changing anything.
    for (const [name, value] of Object.entries(env)) {
      if (value.trim() === "") continue;
      try { envFileLine(name, value); } catch (e) { errors.push(e.message); }
    }
    if (errors.length > 0) { for (const e of errors) console.error(`✗ ${e}`); return 2; }
    if (!cliCapture(["--version"])) { console.error(`The Supabase CLI isn't installed (\`${SUPABASE_BIN} --version\` failed). See docs/SUPABASE_SETUP.md.`); return 2; }

    if (!opts.yes) {
      say(`\nThis applies migrations, sets secrets, deploys ${FUNCTIONS.join(", ")}, changes auth settings and schedules email delivery on ${ref}.`);
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const answer = (await rl.question(`Type the project ref to continue: `)).trim();
      rl.close();
      if (answer !== ref) { say("Stopped; nothing was changed."); return 1; }
    }
    await setup(call, ref, secretsFile, env);
  } else if (writes) {
    await grantAdvisor(call, ref, opts["grant-advisor"]);
  }

  const checks = await check(call, ref);
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
