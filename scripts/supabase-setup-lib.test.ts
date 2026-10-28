import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  advisorSql, authConfigPatch, checkSecrets, cronScheduleSql, envFileLine, FUNCTIONS, interpretChecks,
  isProjectRef, parseEnvFile, parseSender, publicKeyFrom, rowsFrom, serviceRoleKeyFrom, setupComplete,
  sqlLiteral, vaultSecretSql,
} from "./supabase-setup-lib.mjs";

const REF = "dvfwrjpkltqdkfudbahe";

const goodEnv = {
  LOVABLE_API_KEY: "lov_key",
  APP_BASE_URL: "https://nevermore-gamma.vercel.app",
  RESEND_API_KEY: "re_key",
  EMAIL_FROM: "Edgar Allan Advisory <intake@mail.example.com>",
  ADVISORY_NOTIFY_EMAIL: "advisors@example.com",
  SUPPORT_EMAIL: "help@example.com",
  PROSPECT_RESPONSE_TIME: "two business days",
};

describe("isProjectRef", () => {
  it("accepts a 20-letter ref and nothing else", () => {
    expect(isProjectRef(REF)).toBe(true);
    expect(isProjectRef("short")).toBe(false);
    expect(isProjectRef(`${REF}; drop`)).toBe(false);
    expect(isProjectRef(undefined)).toBe(false);
  });
});

describe("parseEnvFile", () => {
  it("reads KEY=value lines, skipping comments and blanks, stripping export and quotes", () => {
    const env = parseEnvFile([
      "# comment",
      "",
      "A=1",
      "export B = two words ",
      `C="quoted # not a comment"`,
      "D='single'",
      "not a line",
      "E=",
    ].join("\n"));
    expect(env).toEqual({ A: "1", B: "two words", C: "quoted # not a comment", D: "single", E: "" });
  });
});

describe("checkSecrets", () => {
  it("passes a complete file", () => {
    expect(checkSecrets(goodEnv)).toEqual({ errors: [], warnings: [] });
  });

  it("refuses SUPABASE_* names, which the platform sets", () => {
    expect(checkSecrets({ ...goodEnv, SUPABASE_SERVICE_ROLE_KEY: "x" }).errors[0]).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("needs the key for the chosen AI provider", () => {
    expect(checkSecrets({ ...goodEnv, LOVABLE_API_KEY: "" }).errors[0]).toMatch(/LOVABLE_API_KEY/);
    expect(checkSecrets({ ...goodEnv, AI_PROVIDER: "anthropic" }).errors[0]).toMatch(/ANTHROPIC_API_KEY/);
    expect(checkSecrets({ ...goodEnv, AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "sk" }).errors).toEqual([]);
    expect(checkSecrets({ ...goodEnv, AI_PROVIDER: "openai" }).errors[0]).toMatch(/AI_PROVIDER/);
  });

  it("needs APP_BASE_URL as an https origin", () => {
    expect(checkSecrets({ ...goodEnv, APP_BASE_URL: "" }).errors[0]).toMatch(/required/);
    expect(checkSecrets({ ...goodEnv, APP_BASE_URL: "http://example.com" }).errors[0]).toMatch(/https/);
    expect(checkSecrets({ ...goodEnv, APP_BASE_URL: "https://example.com/start" }).errors[0]).toMatch(/no path/);
    expect(checkSecrets({ ...goodEnv, APP_BASE_URL: "http://localhost:8080" }).errors).toEqual([]);
  });

  it("reads the template as a valid file that only lacks its keys", () => {
    const template = parseEnvFile(readFileSync(path.resolve(__dirname, "../supabase/env.production.example"), "utf8"));
    const { errors, warnings } = checkSecrets(template);
    expect(errors).toEqual(["LOVABLE_API_KEY is required (or set AI_PROVIDER=anthropic and ANTHROPIC_API_KEY)"]);
    expect(warnings).toHaveLength(1);
  });

    it("warns, without stopping, when email secrets are missing", () => {
    const { errors, warnings } = checkSecrets({ LOVABLE_API_KEY: "k", APP_BASE_URL: "https://example.com" });
    expect(errors).toEqual([]);
    expect(warnings[0]).toMatch(/RESEND_API_KEY, EMAIL_FROM/);
  });
});

describe("envFileLine", () => {
  it("single-quotes values so nothing in them is expanded", () => {
    expect(envFileLine("K", "a $b c")).toBe("K='a $b c'");
  });

  it("double-quotes a value with a single quote when that stays literal", () => {
    expect(envFileLine("K", "O'Brien <a@b.co>")).toBe(`K="O'Brien <a@b.co>"`);
  });

  it("refuses what it can't write literally", () => {
    expect(() => envFileLine("K", "it's $x")).toThrow(/dashboard/);
    expect(() => envFileLine("K", "two\nlines")).toThrow(/one line/);
  });
});

describe("parseSender", () => {
  it("splits a named sender and accepts a bare address", () => {
    expect(parseSender("Edgar Allan Advisory <intake@mail.example.com>")).toEqual({ name: "Edgar Allan Advisory", email: "intake@mail.example.com" });
    expect(parseSender("intake@mail.example.com")).toEqual({ name: "", email: "intake@mail.example.com" });
    expect(parseSender("not an address")).toBeNull();
    expect(parseSender(undefined)).toBeNull();
  });
});

describe("authConfigPatch", () => {
  it("sets everything on a fresh project, sending auth email through Resend", () => {
    const { patch, notes } = authConfigPatch(null, goodEnv);
    expect(patch).toMatchObject({
      external_anonymous_users_enabled: true,
      mailer_autoconfirm: false,
      site_url: "https://nevermore-gamma.vercel.app",
      uri_allow_list: "https://nevermore-gamma.vercel.app/**",
      mailer_otp_length: 6,
      smtp_host: "smtp.resend.com",
      smtp_port: "465",
      smtp_user: "resend",
      smtp_pass: "re_key",
      smtp_admin_email: "intake@mail.example.com",
      smtp_sender_name: "Edgar Allan Advisory",
    });
    expect(patch.mailer_templates_email_change_content).toContain("{{ .Token }}");
    expect(notes).toEqual([]);
  });

  it("only resends the SMTP settings once the rest is set", () => {
    const { patch } = authConfigPatch(null, goodEnv);
    const again = authConfigPatch({ ...patch }, goodEnv).patch;
    expect(Object.keys(again).every((k) => k.startsWith("smtp_"))).toBe(true);
    expect(authConfigPatch({ ...patch }, { ...goodEnv, RESEND_API_KEY: "" }).patch).toEqual({});
  });

  it("keeps redirect URLs, templates and SMTP someone set by hand", () => {
    const current = {
      uri_allow_list: "https://preview.example.com/**",
      mailer_templates_email_change_content: "Your code: {{ .Token }}",
      smtp_host: "smtp.sendgrid.net",
    };
    const { patch, notes } = authConfigPatch(current, goodEnv);
    expect(patch.uri_allow_list).toBe("https://preview.example.com/**,https://nevermore-gamma.vercel.app/**");
    expect(patch).not.toHaveProperty("mailer_templates_email_change_content");
    expect(patch).not.toHaveProperty("smtp_host");
    expect(notes[0]).toMatch(/smtp\.sendgrid\.net/);
  });

  it("says so when prospects can't get sign-in emails yet", () => {
    const { patch, notes } = authConfigPatch(null, { ...goodEnv, RESEND_API_KEY: "" });
    expect(patch).not.toHaveProperty("smtp_host");
    expect(notes[0]).toMatch(/only delivers to your team/);
  });
});

describe("API keys", () => {
  const keys = [
    { name: "anon", api_key: "eyJanon", type: "legacy" },
    { name: "service_role", api_key: "eyJservice", type: "legacy" },
    { name: "default", api_key: "sb_publishable_x", type: "publishable" },
  ];

  it("picks the legacy service-role JWT dispatch-outbox compares against", () => {
    expect(serviceRoleKeyFrom(keys)).toBe("eyJservice");
    expect(serviceRoleKeyFrom([{ name: "service_role", api_key: "sb_secret_x" }])).toBeNull();
    expect(serviceRoleKeyFrom(null)).toBeNull();
  });

  it("picks the anon key for the checks, else a publishable key", () => {
    expect(publicKeyFrom(keys)).toBe("eyJanon");
    expect(publicKeyFrom(keys.slice(2))).toBe("sb_publishable_x");
    expect(publicKeyFrom(undefined)).toBeNull();
  });
});

describe("SQL", () => {
  it("escapes literals", () => {
    expect(sqlLiteral("o'brien")).toBe("'o''brien'");
  });

  it("stores the key in Vault without breaking out of the literal", () => {
    const sql = vaultSecretSql("ab'c");
    expect(sql).toContain("'ab''c'");
    expect(sql).toContain("vault.update_secret");
    expect(sql).toContain("vault.create_secret");
  });

  it("schedules dispatch-outbox on the project's own URL every minute", () => {
    const sql = cronScheduleSql(REF);
    expect(sql).toContain(`'https://${REF}.supabase.co/functions/v1/dispatch-outbox'`);
    expect(sql).toContain("cron.schedule('dispatch-outbox', '* * * * *'");
    expect(() => cronScheduleSql("bad'ref")).toThrow();
  });

  it("grants the advisor role by email, escaped", () => {
    const sql = advisorSql("o'brien@example.com");
    expect(sql).toContain("lower('o''brien@example.com')");
    expect(sql).toContain("on conflict do nothing");
  });

  it("reads rows from the shapes the query endpoint might return", () => {
    expect(rowsFrom([{ n: 1 }])).toEqual([{ n: 1 }]);
    expect(rowsFrom({ result: [{ n: 2 }] })).toEqual([{ n: 2 }]);
    expect(rowsFrom({ rows: [{ n: 3 }] })).toEqual([{ n: 3 }]);
    expect(rowsFrom(null)).toEqual([]);
  });
});

describe("interpretChecks", () => {
  const allSet = {
    status: { migrations: 16, intake_table: 1, table_grants: 1, buckets: 2, extensions: 2, vault_secret: 1, schedule: 1, role_grants: 0 },
    auth: { external: { anonymous_users: true }, mailer_autoconfirm: false },
    authConfig: { mailer_otp_length: 6, mailer_templates_email_change_content: "{{ .Token }}", smtp_host: "smtp.resend.com" },
    functions: Object.fromEntries(FUNCTIONS.map((fn) => [fn, { status: 401, ourError: true }])),
    secretNames: ["LOVABLE_API_KEY", "IP_HASH_SECRET", "APP_BASE_URL"],
  };

  it("passes a finished project, leaving emails and advisors as to-dos", () => {
    const checks = interpretChecks(allSet, { localMigrations: 16 });
    expect(setupComplete(checks)).toBe(true);
    expect(checks.filter((c) => !c.ok).map((c) => c.name)).toEqual(["Email secrets", "Advisor accounts"]);
    expect(checks.find((c) => c.name === "Advisor accounts")?.detail).toContain("--grant-advisor");
  });

  it("fails an empty project on every required check", () => {
    const checks = interpretChecks({}, { localMigrations: 16 });
    expect(setupComplete(checks)).toBe(false);
    expect(checks.filter((c) => c.required).every((c) => !c.ok)).toBe(true);
  });

  it("counts a function as deployed only when the function itself answered", () => {
    const gateway = { ...allSet, functions: { ...allSet.functions, "chamber-extract": { status: 401, ourError: false } } };
    const missing = { ...allSet, functions: { ...allSet.functions, "dispatch-outbox": { status: 404, ourError: false } } };
    expect(setupComplete(interpretChecks(gateway, { localMigrations: 16 }))).toBe(false);
    expect(setupComplete(interpretChecks(missing, { localMigrations: 16 }))).toBe(false);
  });

  it("fails when migrations are behind or the email code isn't in the template", () => {
    expect(setupComplete(interpretChecks(allSet, { localMigrations: 17 }))).toBe(false);
    const noCode = { ...allSet, authConfig: { ...allSet.authConfig, mailer_templates_email_change_content: "{{ .ConfirmationURL }}" } };
    expect(setupComplete(interpretChecks(noCode, { localMigrations: 16 }))).toBe(false);
  });

  it("fails when prospects can't receive sign-in emails", () => {
    const builtIn = { ...allSet, authConfig: { ...allSet.authConfig, smtp_host: "" } };
    expect(setupComplete(interpretChecks(builtIn, { localMigrations: 16 }))).toBe(false);
  });
});
