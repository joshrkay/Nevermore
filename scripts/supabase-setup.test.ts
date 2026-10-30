// Runs scripts/supabase-setup.mjs end to end against a stand-in Management API, project and CLI.
import { spawn } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(ROOT, "scripts", "supabase-setup.mjs");
const REF = "abcdefghijklmnopqrst";
const MIGRATIONS = readdirSync(path.join(ROOT, "supabase", "migrations")).filter((f) => f.endsWith(".sql")).length;
const SERVICE_KEY = "eyJservice-role-secret";
const SECRETS = {
  LOVABLE_API_KEY: "lov_secret_value",
  RESEND_API_KEY: "re_secret_value",
};

interface Fake {
  auth: Record<string, unknown>;
  queries: string[];
  patches: Record<string, unknown>[];
  deployed: Set<string>;
  setUp: boolean;
}

let dir: string;
let server: Server;
let url: string;
let fake: Fake;

// The fake CLI logs each call; `secrets set` copies the file it was given, since the script deletes it.
const FAKE_CLI = `#!/usr/bin/env node
const fs = require("fs");
const args = process.argv.slice(2);
const entry = { args };
const i = args.indexOf("--env-file");
if (i >= 0) { entry.envFile = args[i + 1]; entry.secrets = fs.readFileSync(args[i + 1], "utf8"); entry.mode = fs.statSync(args[i + 1]).mode & 0o777; }
fs.appendFileSync(process.env.FAKE_CLI_LOG, JSON.stringify(entry) + "\\n");
if (args[0] === "--version") console.log("2.0.0");
`;

const cliCalls = () =>
  existsSync(path.join(dir, "cli.log"))
    ? readFileSync(path.join(dir, "cli.log"), "utf8").trim().split("\n").map((l) => JSON.parse(l))
    : [];

function countFor(query: string): number {
  if (!fake.setUp) return 0;
  if (query.includes("schema_migrations")) return MIGRATIONS;
  if (query.includes("storage.buckets") || query.includes("pg_extension")) return 2;
  if (query.includes("user_roles")) return 0;
  return 1;
}

function handle(req: IncomingMessage, body: string, res: ServerResponse) {
  const send = (status: number, value: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(value));
  };
  const u = new URL(req.url ?? "/", url);
  const p = u.pathname;
  if (p === `/v1/projects/${REF}`) return send(200, { name: "nevermore", region: "us-east-1", status: "ACTIVE_HEALTHY" });
  if (p === `/v1/projects/${REF}/api-keys`) {
    return send(200, [{ name: "anon", api_key: "eyJanon", type: "legacy" }, { name: "service_role", api_key: SERVICE_KEY, type: "legacy" }]);
  }
  if (p === `/v1/projects/${REF}/secrets`) {
    const set = cliCalls().filter((c) => c.secrets).flatMap((c) => c.secrets.split("\n").filter(Boolean).map((l: string) => l.split("=")[0]));
    return send(200, set.map((name: string) => ({ name, value: "digest" })));
  }
  if (p === `/v1/projects/${REF}/config/auth`) {
    if (req.method === "PATCH") {
      const patch = JSON.parse(body);
      fake.patches.push(patch);
      Object.assign(fake.auth, patch);
    }
    return send(200, fake.auth);
  }
  if (p === `/v1/projects/${REF}/database/query`) {
    const { query } = JSON.parse(body);
    fake.queries.push(query);
    if (query.includes("insert into public.user_roles")) return send(201, [{ accounts: 1, newly_granted: 1 }]);
    if (query.includes("vault.create_secret") || query.includes("cron.schedule")) fake.setUp = true;
    return send(201, query.startsWith("select count(*)") || query.includes("::int as n") ? [{ n: countFor(query) }] : []);
  }
  if (p === "/auth/v1/settings") {
    return send(200, { external: { anonymous_users: fake.auth.external_anonymous_users_enabled === true }, mailer_autoconfirm: fake.auth.mailer_autoconfirm ?? true });
  }
  const fn = p.match(/^\/functions\/v1\/(.+)$/)?.[1];
  if (fn) return fake.deployed.has(fn) ? send(401, { error: "Unauthorized" }) : send(404, { code: "NOT_FOUND" });
  send(404, { message: "unknown route" });
}

function run(args: string[], input = "") {
  return new Promise<{ code: number | null; out: string }>((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, ...args], {
      cwd: ROOT,
      env: {
        PATH: process.env.PATH,
        SUPABASE_ACCESS_TOKEN: "sbp_token",
        SETUP_API_URL: url,
        SETUP_PROJECT_URL: url,
        SETUP_SUPABASE_BIN: path.join(dir, "supabase"),
        FAKE_CLI_LOG: path.join(dir, "cli.log"),
      },
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.stdin.end(input);
    child.on("close", (code) => resolve({ code, out }));
  });
}

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "setup-test-"));
  writeFileSync(path.join(dir, "supabase"), FAKE_CLI);
  chmodSync(path.join(dir, "supabase"), 0o755);
  writeFileSync(path.join(dir, "secrets.env"), [
    "# test secrets",
    `LOVABLE_API_KEY=${SECRETS.LOVABLE_API_KEY}`,
    "APP_BASE_URL=https://app.example.com",
    `RESEND_API_KEY=${SECRETS.RESEND_API_KEY}`,
    'EMAIL_FROM="Edgar Allan Advisory <intake@mail.example.com>"',
    "ADVISORY_NOTIFY_EMAIL=advisors@example.com",
    "SUPPORT_EMAIL=help@example.com",
    "PROSPECT_RESPONSE_TIME=two business days",
    "RESEND_WEBHOOK_SECRET=whsec_c2VjcmV0",
    "AI_MODEL=",
  ].join("\n"));
  fake = { auth: {}, queries: [], patches: [], deployed: new Set(), setUp: false };
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      // The fake CLI can't reach this process, so a logged deploy marks the function as served.
      for (const c of cliCalls()) if (c.args[0] === "functions") fake.deployed.add(c.args[2]);
      handle(req, body, res);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  url = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
  rmSync(dir, { recursive: true, force: true });
});

describe("supabase-setup", () => {
  it("sets up a project end to end without printing a key", async () => {
    const { code, out } = await run(["--project-ref", REF, "--secrets-file", path.join(dir, "secrets.env"), "--yes"]);

    expect(out).toContain("The project is set up.");
    expect(code).toBe(0);

    const calls = cliCalls().map((c) => c.args.slice(0, 3).join(" "));
    expect(calls).toEqual([
      "--version",
      `link --project-ref ${REF}`,
      "db push",
      `secrets set --env-file`,
      `functions deploy chamber-extract`,
      `functions deploy document-extract`,
      `functions deploy dispatch-outbox`,
      `functions deploy resend-webhook`,
    ]);

    const secretsCall = cliCalls().find((c) => c.secrets);
    expect(secretsCall.mode).toBe(0o600);
    expect(existsSync(secretsCall.envFile)).toBe(false);
    expect(secretsCall.secrets).toContain(`LOVABLE_API_KEY='${SECRETS.LOVABLE_API_KEY}'`);
    expect(secretsCall.secrets).toContain("EMAIL_FROM='Edgar Allan Advisory <intake@mail.example.com>'");
    expect(secretsCall.secrets).not.toContain("AI_MODEL");
    const ipHashSecret = secretsCall.secrets.match(/IP_HASH_SECRET='([0-9a-f]{64})'/)?.[1];
    expect(ipHashSecret).toBeDefined();

    expect(fake.patches).toHaveLength(1);
    expect(fake.patches[0]).toMatchObject({
      external_anonymous_users_enabled: true,
      site_url: "https://app.example.com",
      uri_allow_list: "https://app.example.com/**",
      smtp_pass: SECRETS.RESEND_API_KEY,
    });
    expect(fake.queries.some((q) => q.includes("vault.create_secret") && q.includes(SERVICE_KEY))).toBe(true);
    expect(fake.queries.some((q) => q.includes(`https://${REF}.supabase.co/functions/v1/dispatch-outbox`))).toBe(true);

    for (const secret of [SERVICE_KEY, SECRETS.LOVABLE_API_KEY, SECRETS.RESEND_API_KEY, ipHashSecret!, "sbp_token"]) {
      expect(out).not.toContain(secret);
    }
  });

  it("changes nothing unless the project ref is typed back", async () => {
    const { code, out } = await run(["--project-ref", REF, "--secrets-file", path.join(dir, "secrets.env")], "wrongref\n");

    expect(code).toBe(1);
    expect(out).toContain("nothing was changed");
    expect(cliCalls().map((c) => c.args[0])).toEqual(["--version"]);
    expect(fake.patches).toEqual([]);
    expect(fake.queries).toEqual([]);
  });

  it("only reads in --check mode, and fails an empty project", async () => {
    const { code, out } = await run(["--project-ref", REF, "--check"]);

    expect(code).toBe(1);
    expect(out).toContain("✗ Migrations applied: 0 of");
    expect(out).toContain("✗ Function chamber-extract: answered 404");
    expect(cliCalls()).toEqual([]);
    expect(fake.patches).toEqual([]);
    expect(fake.queries.every((q) => q.trim().toLowerCase().startsWith("select"))).toBe(true);
  });

  it("grants the advisor role without needing the secrets file or the CLI", async () => {
    const { code, out } = await run(["--project-ref", REF, "--grant-advisor", "advisor@example.com"]);

    expect(out).toContain("Granted.");
    expect(code).toBe(1); // the stand-in project is otherwise empty
    expect(cliCalls()).toEqual([]);
    expect(fake.queries.filter((q) => !q.trim().startsWith("select"))).toEqual([expect.stringContaining("lower('advisor@example.com')")]);
  });

  it("stops before changing anything when the secrets file is incomplete", async () => {
    writeFileSync(path.join(dir, "secrets.env"), "APP_BASE_URL=https://app.example.com/start\n");
    const { code, out } = await run(["--project-ref", REF, "--secrets-file", path.join(dir, "secrets.env"), "--yes"]);

    expect(code).toBe(2);
    expect(out).toContain("LOVABLE_API_KEY is required");
    expect(out).toContain("no path");
    expect(cliCalls()).toEqual([]);

    writeFileSync(path.join(dir, "secrets.env"), `LOVABLE_API_KEY=k\nAPP_BASE_URL=https://app.example.com\nSUPPORT_EMAIL=it's $HOME\n`);
    const unwritable = await run(["--project-ref", REF, "--secrets-file", path.join(dir, "secrets.env"), "--yes"]);
    expect(unwritable.code).toBe(2);
    expect(unwritable.out).toContain("SUPPORT_EMAIL has both a single quote");
    expect(cliCalls()).toEqual([]);
  });
});
