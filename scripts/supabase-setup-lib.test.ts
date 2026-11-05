import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  advisorSql, authConfigPatch, authUrlProblems, checkSecrets, cliCommands, cronScheduleSql, envFileLine, EXPIRY_SCHEDULE_SQL, FUNCTIONS, functionScheduleSql, interpretChecks,
  MIN_AUTH_EMAILS_PER_HOUR, migrationVersions, newMigrations, parseCliVersion, REMINDER_SCHEDULE_SQL, resendKeyVerdict, RETENTION_SCHEDULE_SQL, SCHEDULED_FUNCTIONS,
  isProjectRef, parseEnvFile, parseSender, publicKeyFrom, rowsFrom, serviceRoleKeyFrom, setupComplete, smtpKeyNote, summaryLines,
  sqlLiteral, vaultSecretSql,
} from "./supabase-setup-lib.mjs";

const REF = "dvfwrjpkltqdkfudbahe";

const goodEnv = {
  ANTHROPIC_API_KEY: "sk-ant-key",
  APP_BASE_URL: "https://nevermorepeo.com",
  RESEND_API_KEY: "re_key",
  EMAIL_FROM: "Edgar Allan Advisory <intake@mail.example.com>",
  ADVISORY_NOTIFY_EMAIL: "advisors@example.com",
  SUPPORT_EMAIL: "help@example.com",
  PROSPECT_RESPONSE_TIME: "two business days",
  RESEND_WEBHOOK_SECRET: "whsec_c2VjcmV0",
  MALWARE_SCANNER: "clamav",
  CLAMAV_HOST: "scan.example.com",
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

  // Decision D11: Anthropic is the only AI provider.
  it("needs ANTHROPIC_API_KEY, and refuses any AI_PROVIDER but anthropic", () => {
    expect(checkSecrets({ ...goodEnv, ANTHROPIC_API_KEY: "" }).errors).toEqual(["ANTHROPIC_API_KEY is required (Anthropic is the only AI provider)"]);
    expect(checkSecrets({ ...goodEnv, AI_PROVIDER: "anthropic" }).errors).toEqual([]);
    for (const provider of ["openai", "lovable"]) {
      expect(checkSecrets({ ...goodEnv, AI_PROVIDER: provider }).errors).toEqual([expect.stringMatching(/^AI_PROVIDER must be "anthropic" or unset/)]);
    }
  });

  it("says a leftover LOVABLE_API_KEY is unused, without stopping, and doesn't take it for the AI key", () => {
    const { errors, warnings } = checkSecrets({ ...goodEnv, LOVABLE_API_KEY: "lov_key" });
    expect(errors).toEqual([]);
    expect(warnings).toEqual([expect.stringMatching(/^LOVABLE_API_KEY is no longer used/)]);
    const { ANTHROPIC_API_KEY: _ant, ...lovableOnly } = goodEnv;
    expect(checkSecrets({ ...lovableOnly, LOVABLE_API_KEY: "lov_key" }).errors).toEqual(["ANTHROPIC_API_KEY is required (Anthropic is the only AI provider)"]);
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
    expect(errors).toEqual(["ANTHROPIC_API_KEY is required (Anthropic is the only AI provider)"]);
    // Emails stay queued, and uploads are refused until a malware scanner is set.
    expect(warnings).toHaveLength(2);
  });

  it("warns, without stopping, that bounces are not processed when sending is set up but the webhook secret is not", () => {
    const { errors, warnings } = checkSecrets({ ...goodEnv, RESEND_WEBHOOK_SECRET: "" });
    expect(errors).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/RESEND_WEBHOOK_SECRET/);
    expect(warnings[0]).toMatch(/Bounces and spam complaints/);
    // Not a second warning on top of "emails stay queued" when sending itself is not set up.
    expect(checkSecrets({ ANTHROPIC_API_KEY: "k", APP_BASE_URL: "https://example.com", MALWARE_SCANNER: "clamav", CLAMAV_HOST: "h" }).warnings).toHaveLength(1);
  });

  it("stops on a key with something pasted after it, which would be stored whole and refused on every call", () => {
    // The QA outage: a Resend key that Resend refused. A comment after the value is part of the value in this file.
    expect(checkSecrets({ ...goodEnv, RESEND_API_KEY: "re_key # prod" }).errors).toEqual([expect.stringMatching(/^RESEND_API_KEY has a space/)]);
    expect(checkSecrets({ ...goodEnv, RESEND_API_KEY: "re_key " }).errors).toEqual([expect.stringMatching(/^RESEND_API_KEY has a space/)]);
    expect(checkSecrets({ ...goodEnv, AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "sk-ant key" }).errors).toEqual([expect.stringMatching(/^ANTHROPIC_API_KEY has a space/)]);
    expect(checkSecrets({ ...goodEnv, RESEND_WEBHOOK_SECRET: "whsec_a\tb" }).errors).toEqual([expect.stringMatching(/^RESEND_WEBHOOK_SECRET/)]);
    // Text values may hold spaces.
    expect(checkSecrets({ ...goodEnv, PROSPECT_RESPONSE_TIME: "two business days" }).errors).toEqual([]);
  });

  it("warns, without stopping, when RESEND_API_KEY doesn't look like a Resend key; Resend itself has the last word", () => {
    const { errors, warnings } = checkSecrets({ ...goodEnv, RESEND_API_KEY: "sk_live_123" });
    expect(errors).toEqual([]);
    expect(warnings).toEqual([expect.stringMatching(/doesn't look like a Resend API key/)]);
    expect(checkSecrets({ ...goodEnv, RESEND_API_KEY: "re_AbC_123" }).warnings).toEqual([]);
  });

  it("lists the webhook function among those it deploys and checks", () => {
    expect(FUNCTIONS).toContain("resend-webhook");
  });

  it("deploys and checks the upload and scan functions", () => {
    expect(FUNCTIONS).toEqual(expect.arrayContaining(["document-upload", "document-scan"]));
  });

  it("checks the malware scanner's settings: unset refuses uploads, an incomplete one stops the setup", () => {
    const base = { ...goodEnv };
    delete (base as Record<string, string>).MALWARE_SCANNER;
    // A warning, not a stop: the scanner is the owner's choice, and the rest of the setup shouldn't wait for it.
    expect(checkSecrets(base).errors).toEqual([]);
    expect(checkSecrets(base).warnings.some((w) => /census included, are refused until MALWARE_SCANNER is set/.test(w))).toBe(true);
    expect(checkSecrets(base).warnings.some((w) => /or none on this/.test(w))).toBe(false);
    expect(checkSecrets({ ...base, APP_ENV: "staging" }).warnings.some((w) => /or none on this staging project/.test(w))).toBe(true);
    expect(checkSecrets({ ...goodEnv, MALWARE_SCANNER: "clamscan" }).errors).toEqual([expect.stringMatching(/clamav, http or none/)]);
    expect(checkSecrets({ ...goodEnv, MALWARE_SCANNER: "clamav", CLAMAV_HOST: "" }).errors).toEqual([expect.stringMatching(/CLAMAV_HOST/)]);
    expect(checkSecrets({ ...goodEnv, MALWARE_SCANNER: "clamav", CLAMAV_HOST: "scan.example.com" }).errors).toEqual([]);
    expect(checkSecrets({ ...goodEnv, MALWARE_SCANNER: "http", MALWARE_SCANNER_URL: "https://scan.example.com" }).errors)
      .toEqual([expect.stringMatching(/MALWARE_SCANNER_TOKEN/)]);
    expect(checkSecrets({ ...goodEnv, MALWARE_SCANNER: "http", MALWARE_SCANNER_URL: "http://scan.example.com", MALWARE_SCANNER_TOKEN: "t" }).errors)
      .toEqual([expect.stringMatching(/https/)]);
    expect(checkSecrets({ ...goodEnv, MALWARE_SCANNER: "none", APP_ENV: "demo" }).warnings.some((w) => /not scanned/.test(w))).toBe(true);
    expect(checkSecrets({ ...goodEnv, MALWARE_SCANNER: "none", APP_ENV: "demo" }).errors).toEqual([]);
  });

  // D13: production scans with Scanii (ADR 0002). Its key and secret are HTTP Basic auth's user and password.
  it("needs Scanii's key and secret with MALWARE_SCANNER=scanii, and an https SCANII_API_URL when one is set", () => {
    const scanii = { ...goodEnv, MALWARE_SCANNER: "scanii", SCANII_API_KEY: "0123abcd", SCANII_API_SECRET: "s3cret" };
    expect(checkSecrets(scanii)).toMatchObject({ errors: [] });
    expect(checkSecrets({ ...scanii, MALWARE_SCANNER: " Scanii " }).errors).toEqual([]);
    expect(checkSecrets({ ...scanii, SCANII_API_SECRET: "" }).errors).toEqual([expect.stringMatching(/SCANII_API_KEY and SCANII_API_SECRET are required/)]);
    expect(checkSecrets({ ...scanii, SCANII_API_KEY: "" }).errors).toEqual([expect.stringMatching(/SCANII_API_KEY and SCANII_API_SECRET are required/)]);
    expect(checkSecrets({ ...scanii, SCANII_API_KEY: "ab:cd" }).errors).toEqual([expect.stringMatching(/can't hold a colon/)]);
    expect(checkSecrets({ ...scanii, SCANII_API_URL: "http://api-eu1.scanii.com" }).errors).toEqual([expect.stringMatching(/SCANII_API_URL must be an https/)]);
    expect(checkSecrets({ ...scanii, SCANII_API_URL: "https://api-eu1.scanii.com" }).errors).toEqual([]);
    // A secret with a space in it is a secret with something pasted after it (QA H5).
    expect(checkSecrets({ ...scanii, SCANII_API_SECRET: "s3cret # prod" }).errors).toEqual([expect.stringMatching(/^SCANII_API_SECRET has a space/)]);
    expect(checkSecrets({ ...goodEnv, MALWARE_SCANNER: "clamscan" }).errors).toEqual([expect.stringMatching(/scanii, clamav, http or none/)]);
  });

  // QA H4, ADR 0002: production never runs unscanned, and the functions won't honour none there.
  it("stops on MALWARE_SCANNER=none unless APP_ENV names a non-production project, and on an APP_ENV it doesn't know", () => {
    expect(checkSecrets({ ...goodEnv, MALWARE_SCANNER: "none" }).errors).toEqual([expect.stringMatching(/MALWARE_SCANNER=none is allowed only when APP_ENV is development, demo, staging.*unset \(production\)/)]);
    expect(checkSecrets({ ...goodEnv, MALWARE_SCANNER: "none", APP_ENV: "production" }).errors).toEqual([expect.stringMatching(/"production"/)]);
    expect(checkSecrets({ ...goodEnv, MALWARE_SCANNER: "none", APP_ENV: " Staging " }).errors).toEqual([]);
    const typo = checkSecrets({ ...goodEnv, APP_ENV: "prod" }).errors;
    expect(typo).toEqual([expect.stringMatching(/APP_ENV must be development, demo, staging, production or unset/)]);
    expect(checkSecrets({ ...goodEnv, APP_ENV: "production" }).errors).toEqual([]);
  });

    it("warns, without stopping, when email secrets are missing", () => {
    const { errors, warnings } = checkSecrets({ ANTHROPIC_API_KEY: "k", APP_BASE_URL: "https://example.com" });
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
    const { patch, notes } = authConfigPatch({}, goodEnv);
    expect(patch).toMatchObject({
      external_anonymous_users_enabled: true,
      mailer_autoconfirm: false,
      site_url: "https://nevermorepeo.com",
      uri_allow_list: "https://nevermorepeo.com/**",
      mailer_otp_length: 6,
      smtp_host: "smtp.resend.com",
      smtp_port: "465",
      smtp_user: "resend",
      smtp_pass: "re_key",
      smtp_admin_email: "intake@mail.example.com",
      smtp_sender_name: "Edgar Allan Advisory",
    });
    expect(patch.mailer_templates_email_change_content).toContain("{{ .Token }}");
    expect(patch.mailer_templates_magic_link_content).toContain("{{ .Token }}");
    expect(patch.mailer_subjects_magic_link).toBe("Your sign-in code");
    expect(patch.mailer_templates_confirmation_content).toContain("{{ .Token }}");
    // Back to the address the app asked for (the deployment signed up on, with its next), token in the fragment.
    expect(patch.mailer_templates_confirmation_content).toContain('href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}&type=email"');
    expect(patch.mailer_templates_confirmation_content).not.toContain("ConfirmationURL");
    expect(notes).toEqual([]);
  });

  it("replaces Supabase's default sign-up link, which a mail scanner can use up, but keeps a template that's already safe", () => {
    const fresh = authConfigPatch({ mailer_templates_confirmation_content: '<a href="{{ .ConfirmationURL }}">Confirm your mail</a>' }, goodEnv).patch;
    expect(fresh.mailer_templates_confirmation_content).toContain("{{ .TokenHash }}");
    const custom = '<p>Code: {{ .Token }}</p><a href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}&type=email">Go</a>';
    expect(authConfigPatch({ mailer_templates_confirmation_content: custom }, goodEnv).patch).not.toHaveProperty("mailer_templates_confirmation_content");
  });

  it("doesn't count a link to Supabase's verify endpoint as scanner-safe, since any GET confirms it", () => {
    const verifyLink = '<p>{{ .Token }}</p><a href="https://abc.supabase.co/auth/v1/verify?token={{ .TokenHash }}&type=signup&redirect_to={{ .RedirectTo }}">Go</a>';
    expect(authConfigPatch({ mailer_templates_confirmation_content: verifyLink }, goodEnv).patch.mailer_templates_confirmation_content).toContain("#token_hash=");
  });

  it("refuses to build a patch without the current settings, which would replace the Redirect URLs", () => {
    expect(() => authConfigPatch(null, goodEnv)).toThrow(/current auth settings/);
  });

  it("only resends the SMTP settings once the rest is set", () => {
    const { patch } = authConfigPatch({}, goodEnv);
    const again = authConfigPatch({ ...patch }, goodEnv).patch;
    expect(Object.keys(again).every((k) => k.startsWith("smtp_"))).toBe(true);
    expect(authConfigPatch({ ...patch }, { ...goodEnv, RESEND_API_KEY: "" }).patch).toEqual({});
  });

  it("replaces a magic-link template that sends only the token hash, not the 6-digit code", () => {
    const linkOnly = { mailer_templates_magic_link_content: '<a href="{{ .SiteURL }}/auth/callback#token_hash={{ .TokenHash }}">Sign in</a>' };
    const { patch } = authConfigPatch(linkOnly, goodEnv);
    expect(patch.mailer_templates_magic_link_content).toContain("{{ .Token }}");
    expect(authConfigPatch({ mailer_templates_magic_link_content: "Code: {{.Token}}" }, goodEnv).patch).not.toHaveProperty("mailer_templates_magic_link_content");
  });

  it("keeps redirect URLs, templates and SMTP someone set by hand", () => {
    const current = {
      uri_allow_list: "https://preview.example.com/**",
      mailer_templates_email_change_content: "Your code: {{ .Token }}",
      mailer_templates_magic_link_content: "Sign in with {{ .Token }}",
      smtp_host: "smtp.sendgrid.net",
    };
    const { patch, notes } = authConfigPatch(current, goodEnv);
    expect(patch.uri_allow_list).toBe("https://preview.example.com/**,https://nevermorepeo.com/**");
    expect(patch).not.toHaveProperty("mailer_templates_email_change_content");
    expect(patch).not.toHaveProperty("mailer_templates_magic_link_content");
    expect(patch).not.toHaveProperty("smtp_host");
    expect(notes[0]).toMatch(/smtp\.sendgrid\.net/);
  });

  it("says so when prospects can't get sign-in emails yet", () => {
    const { patch, notes } = authConfigPatch({}, { ...goodEnv, RESEND_API_KEY: "" });
    expect(patch).not.toHaveProperty("smtp_host");
    expect(notes[0]).toMatch(/only delivers to your team/);
  });

  describe("the hourly cap on auth emails", () => {
    // Every prospect shares it: a sign-up confirmation, a code, a resend each count. Left at Supabase's
    // default, a launch day answers 429 "email rate limit exceeded" to the next person who tries.
    it("has a floor that is a real number, so the checks below can't pass on `undefined`", () => {
      expect(Number.isInteger(MIN_AUTH_EMAILS_PER_HOUR)).toBe(true);
      expect(MIN_AUTH_EMAILS_PER_HOUR).toBeGreaterThanOrEqual(100);
    });

    it("raises it on a fresh project that sends through Resend", () => {
      expect(authConfigPatch({}, goodEnv).patch.rate_limit_email_sent).toBe(MIN_AUTH_EMAILS_PER_HOUR);
    });

    it("raises a lower figure, but never lowers a higher one someone chose", () => {
      expect(authConfigPatch({ smtp_host: "smtp.resend.com", rate_limit_email_sent: 30 }, goodEnv).patch.rate_limit_email_sent).toBe(MIN_AUTH_EMAILS_PER_HOUR);
      expect(authConfigPatch({ smtp_host: "smtp.resend.com", rate_limit_email_sent: 500 }, goodEnv).patch).not.toHaveProperty("rate_limit_email_sent");
      expect(authConfigPatch({ smtp_host: "smtp.resend.com", rate_limit_email_sent: MIN_AUTH_EMAILS_PER_HOUR }, goodEnv).patch).not.toHaveProperty("rate_limit_email_sent");
    });

    it("raises it for SMTP someone else set up, which is left otherwise as it is", () => {
      const { patch } = authConfigPatch({ smtp_host: "smtp.sendgrid.net", rate_limit_email_sent: 30 }, goodEnv);
      expect(patch.rate_limit_email_sent).toBe(MIN_AUTH_EMAILS_PER_HOUR);
      expect(patch).not.toHaveProperty("smtp_host");
    });

    it("leaves it alone on Supabase's built-in mailer, where a refused change would stop the whole run", () => {
      const { patch, notes } = authConfigPatch({}, { ...goodEnv, RESEND_API_KEY: "" });
      expect(patch).not.toHaveProperty("rate_limit_email_sent");
      expect(notes[0]).toMatch(/hourly email limit/);
    });

    it("sends it again if the project doesn't report one, rather than guessing it is fine", () => {
      expect(authConfigPatch({ smtp_host: "smtp.resend.com" }, goodEnv).patch.rate_limit_email_sent).toBe(MIN_AUTH_EMAILS_PER_HOUR);
    });
  });
});

describe("smtpKeyNote", () => {
  const resendSmtp = { smtp_host: "smtp.resend.com" };

  it("says the key was set when Supabase doesn't return the stored password", () => {
    const { patch } = authConfigPatch({}, goodEnv);
    expect(smtpKeyNote({}, patch, "re_key")).toMatch(/is set to RESEND_API_KEY \(Supabase doesn't return the stored one/);
    // A masked value can't be compared either.
    expect(smtpKeyNote({ ...resendSmtp, smtp_pass: "********" }, patch, "re_key")).toMatch(/is set to RESEND_API_KEY/);
  });

  it("compares a readable password with the key, and says when it replaced a different one", () => {
    const { patch } = authConfigPatch(resendSmtp, goodEnv);
    expect(smtpKeyNote({ ...resendSmtp, smtp_pass: "re_key" }, patch, "re_key")).toBe("Supabase Auth's SMTP password is RESEND_API_KEY");
    expect(smtpKeyNote({ ...resendSmtp, smtp_pass: "re_old" }, patch, "re_key")).toMatch(/was a different Resend key; it now uses RESEND_API_KEY/);
  });

  it("reminds that it must match when the setup can't set it (no sender), and warns when it can see it differs", () => {
    const noSender = { ...goodEnv, EMAIL_FROM: "" };
    const { patch } = authConfigPatch(resendSmtp, noSender);
    expect(patch).not.toHaveProperty("smtp_pass");
    expect(smtpKeyNote(resendSmtp, patch, "re_key")).toMatch(/couldn't be read: it must be RESEND_API_KEY/);
    expect(smtpKeyNote({ ...resendSmtp, smtp_pass: "re_old" }, patch, "re_key")).toMatch(/different Resend key from RESEND_API_KEY/);
    expect(smtpKeyNote({ ...resendSmtp, smtp_pass: "re_key" }, patch, "re_key")).toBe("Supabase Auth's SMTP password is RESEND_API_KEY");
  });

  it("has nothing to say without a Resend key or for another provider's SMTP, and never repeats a key", () => {
    expect(smtpKeyNote({}, {}, "")).toBeNull();
    const other = { smtp_host: "smtp.sendgrid.net", smtp_pass: "SG.secret" };
    expect(smtpKeyNote(other, authConfigPatch(other, goodEnv).patch, "re_key")).toBeNull();
    for (const note of [smtpKeyNote({ ...resendSmtp, smtp_pass: "re_old" }, {}, "re_key"), smtpKeyNote({}, { smtp_pass: "re_key" }, "re_key")]) {
      expect(note).not.toContain("re_key");
      expect(note).not.toContain("re_old");
    }
  });
});

describe("the Supabase CLI", () => {
  it("reads the version from `supabase --version`, whatever surrounds it", () => {
    expect(parseCliVersion("3.0.0\n")).toEqual([3, 0, 0]);
    expect(parseCliVersion("2.33.7\nA new version of Supabase CLI is available: v3.0.0")).toEqual([2, 33, 7]);
    expect(parseCliVersion("")).toBeNull();
    expect(parseCliVersion(null)).toBeNull();
  });

  it("pushes to the remote project with CLI 3, which targets the local database otherwise, and confirms every change", () => {
    const cli = cliCommands([3, 0, 0], REF);
    expect(cli.link).toEqual(["link", "--project-ref", REF]);
    expect(cli.dbPush).toEqual(["db", "push", "--remote", "--yes"]);
    expect(cli.secretsSet("/tmp/s.env")).toEqual(["secrets", "set", "--env-file", "/tmp/s.env", `--remote=${REF}`, "--yes"]);
    // Bundled with Docker: Supabase's server-side bundler can't fetch document-extract's SheetJS import.
    expect(cli.deploy("document-extract")).toEqual(["functions", "deploy", "document-extract", `--remote=${REF}`, "--yes"]);
    expect(cli.deploy("document-extract")).not.toContain("--use-api");
    // An unreadable version is taken as the current CLI.
    expect(cliCommands(null, REF)).toEqual(expect.objectContaining({ dbPush: cli.dbPush }));
  });

  it("keeps CLI 2's calls", () => {
    const cli = cliCommands([2, 33, 7], REF);
    expect(cli.dbPush).toEqual(["db", "push"]);
    expect(cli.secretsSet("/tmp/s.env")).toEqual(["secrets", "set", "--env-file", "/tmp/s.env", "--project-ref", REF]);
    expect(cli.deploy("chamber-extract")).toEqual(["functions", "deploy", "chamber-extract", "--project-ref", REF]);
  });
});

describe("resendKeyVerdict", () => {
  it("takes Resend refusing the empty email as the key accepted", () => {
    expect(resendKeyVerdict({ status: 422, name: "missing_required_field" })).toEqual({ ok: true, detail: "Resend accepted the key" });
    expect(resendKeyVerdict({ status: 400, name: "validation_error" }).ok).toBe(true);
  });

  it("refuses a key Resend refuses, naming its code", () => {
    const refused = resendKeyVerdict({ status: 401, name: "invalid_api_key" });
    expect(refused.ok).toBe(false);
    expect(refused.detail).toMatch(/^Resend refused the key \(401 invalid_api_key\): sign-in codes and every app email fail with it/);
    expect(resendKeyVerdict({ status: 403, name: "restricted_api_key" }).ok).toBe(false);
  });

  it("leaves the key unverified when Resend can't say, and shows only a code-shaped name", () => {
    expect(resendKeyVerdict({ status: 429, name: "rate_limit_exceeded" })).toEqual({ ok: null, detail: "Resend answered 429 rate_limit_exceeded, so the key wasn't verified" });
    expect(resendKeyVerdict({ status: 0 })).toEqual({ ok: null, detail: "Resend couldn't be reached, so the key wasn't verified" });
    expect(resendKeyVerdict({ status: 500, name: "Bearer re_secret <b>" }).detail).toBe("Resend answered 500, so the key wasn't verified");
  });
});

describe("the summary", () => {
  const files = ["20261001000000_a.sql", "20261002000000_b.sql", "20261003000000_c.sql"];

  it("names the migration files the push applied", () => {
    expect(migrationVersions([{ version: "20261001000000" }, { version: 20261002000000 }, { other: 1 }])).toEqual(["20261001000000", "20261002000000"]);
    expect(newMigrations(["20261001000000"], ["20261001000000", "20261002000000", "20261003000000"], files)).toEqual(["20261002000000_b.sql", "20261003000000_c.sql"]);
    expect(newMigrations([], ["20261001000000", "20269999000000"], files)).toEqual(["20261001000000_a.sql", "20269999000000"]);
    expect(newMigrations(null, ["20261001000000"], files)).toBeNull();
  });

  it("lists migrations, secret names (sorted) and functions, and says what wasn't run or can't be known", () => {
    expect(summaryLines({ migrations: ["20261002000000_b.sql"], secrets: ["RESEND_API_KEY", "APP_BASE_URL"], functions: ["chamber-extract"] })).toEqual([
      "Migrations applied: 1 (20261002000000_b.sql)",
      "Secrets set (names only): 2 (APP_BASE_URL, RESEND_API_KEY)",
      "Functions deployed: 1 (chamber-extract)",
    ]);
    expect(summaryLines({ migrations: [], secrets: [], functions: [] })[0]).toBe("Migrations applied: none new (the project was up to date)");
    expect(summaryLines({ migrations: null, secrets: [], functions: [] })[0]).toMatch(/couldn't be read/);
    expect(summaryLines({ migrations: undefined, secrets: [], functions: [] })).toEqual(["Migrations applied: not run", "Secrets set (names only): none", "Functions deployed: none"]);
  });

  it("shortens a long migration list to the first and the last", () => {
    const many = Array.from({ length: 12 }, (_, i) => `2026100${String(i).padStart(2, "0")}_m.sql`);
    expect(summaryLines({ migrations: many, secrets: [], functions: [] })[0]).toBe(`Migrations applied: 12 (${many[0]} … ${many[11]})`);
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

  it("schedules draft expiry exactly as the migration does", () => {
    const migration = readFileSync("supabase/migrations/20261103090000_intake_lifecycle.sql", "utf8");
    const scheduled = /PERFORM cron\.schedule\(('[^']+'), ('[^']+'), ('[^']+')\)/.exec(migration);
    expect(scheduled).not.toBeNull();
    expect(EXPIRY_SCHEDULE_SQL).toBe(`select cron.schedule(${scheduled![1]}, ${scheduled![2]}, ${scheduled![3]});`);
  });

  it("schedules draft reminders exactly as the migration does", () => {
    const migration = readFileSync("supabase/migrations/20261105091000_draft_expiry_reminders.sql", "utf8");
    const scheduled = /PERFORM cron\.schedule\(('[^']+'), ('[^']+'), ('[^']+')\)/.exec(migration);
    expect(scheduled).not.toBeNull();
    expect(REMINDER_SCHEDULE_SQL).toBe(`select cron.schedule(${scheduled![1]}, ${scheduled![2]}, ${scheduled![3]});`);
  });

  it("schedules each scheduled function on the project's own URL, as often as its migration does", () => {
    const migrations = readdirSync("supabase/migrations").map((f) => readFileSync(`supabase/migrations/${f}`, "utf8")).join("\n");
    expect(SCHEDULED_FUNCTIONS.map((j) => j.fn)).toEqual(["dispatch-outbox", "purge-intakes", "ops-monitor", "document-scan"]);
    for (const job of SCHEDULED_FUNCTIONS) {
      expect(FUNCTIONS).toContain(job.fn);
      const sql = functionScheduleSql(REF, job.fn, job.schedule);
      expect(sql).toContain(`'https://${REF}.supabase.co/functions/v1/${job.fn}'`);
      expect(sql).toContain(`cron.schedule('${job.fn}', '${job.schedule}'`);
      expect(sql).toContain("vault.decrypted_secrets where name = 'service_role_key'");
      expect(migrations).toContain(`cron.schedule('${job.fn}', '${job.schedule}'`);
    }
    expect(cronScheduleSql(REF)).toBe(functionScheduleSql(REF, "dispatch-outbox", "* * * * *"));
    expect(() => functionScheduleSql(REF, "x'; drop", "* * * * *")).toThrow();
    expect(() => functionScheduleSql(REF, "ops-monitor", "'; drop")).toThrow();
  });

  it("schedules the retention job exactly as the migration does", () => {
    const migration = readFileSync("supabase/migrations/20261104092000_data_retention_and_deletion.sql", "utf8");
    const scheduled = /PERFORM cron\.schedule\(('run-retention'), ('[^']+'), ('[^']+')\)/.exec(migration);
    expect(scheduled).not.toBeNull();
    expect(RETENTION_SCHEDULE_SQL).toBe(`select cron.schedule(${scheduled![1]}, ${scheduled![2]}, ${scheduled![3]});`);
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
    status: {
      migrations: 16, intake_table: 1, table_grants: 1, buckets: 3, extensions: 2, vault_secret: 1, schedule: 1, expiry_schedule: 1, reminder_schedule: 1,
      purge_schedule: 1, monitor_schedule: 1, scan_schedule: 1, retention_schedule: 1, role_grants: 0,
    },
    auth: { external: { anonymous_users: true }, mailer_autoconfirm: false },
    authConfig: {
      mailer_otp_length: 6, mailer_templates_email_change_content: "{{ .Token }}", mailer_templates_magic_link_content: "{{ .Token }}", smtp_host: "smtp.resend.com",
      rate_limit_email_sent: MIN_AUTH_EMAILS_PER_HOUR,
      site_url: "https://nevermorepeo.com", uri_allow_list: "https://nevermorepeo.com/**",
      mailer_templates_confirmation_content: "{{ .Token }} {{ .RedirectTo }}#token_hash={{ .TokenHash }}&type=email",
    },
    functions: Object.fromEntries(FUNCTIONS.map((fn) => [fn, { status: 401, ourError: true }])),
    secretNames: ["ANTHROPIC_API_KEY", "IP_HASH_SECRET", "APP_BASE_URL"],
  };

  it("passes a finished project, leaving emails and advisors as to-dos", () => {
    const checks = interpretChecks(allSet, { localMigrations: 16 });
    expect(setupComplete(checks)).toBe(true);
    expect(checks.filter((c) => !c.ok).map((c) => c.name)).toEqual(["Email secrets", "Engineering alerts", "Malware scanner", "Advisor accounts"]);
    expect(checks.find((c) => c.name === "Advisor accounts")?.detail).toContain("--grant-advisor");
  });

  // Decision D11: a project still holding only the Lovable key has Lenore and document reading unavailable.
  it("fails a project whose secrets hold no ANTHROPIC_API_KEY, a leftover Lovable key included", () => {
    const checks = interpretChecks({ ...allSet, secretNames: ["LOVABLE_API_KEY", "IP_HASH_SECRET", "APP_BASE_URL"] }, { localMigrations: 16 });
    expect(setupComplete(checks)).toBe(false);
    expect(checks.find((c) => c.name === "Function secrets")).toMatchObject({ ok: false, detail: "missing: ANTHROPIC_API_KEY" });
  });

  it("fails the setup on a Resend key Resend refused, lists an unverified one as a to-do, and says nothing without one", () => {
    const refused = interpretChecks({ ...allSet, resend: resendKeyVerdict({ status: 401 }) }, { localMigrations: 16 });
    expect(setupComplete(refused)).toBe(false);
    expect(refused.find((c) => c.name === "Resend key")).toMatchObject({ ok: false, required: true });
    const unverified = interpretChecks({ ...allSet, resend: resendKeyVerdict({ status: 0 }) }, { localMigrations: 16 });
    expect(setupComplete(unverified)).toBe(true);
    expect(unverified.find((c) => c.name === "Resend key")).toMatchObject({ ok: false, required: false });
    expect(interpretChecks({ ...allSet, resend: resendKeyVerdict({ status: 422 }) }, { localMigrations: 16 }).find((c) => c.name === "Resend key")?.ok).toBe(true);
    expect(interpretChecks(allSet, { localMigrations: 16 }).some((c) => c.name === "Resend key")).toBe(false);
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
    const hashOnly = { ...allSet, authConfig: { ...allSet.authConfig, mailer_templates_magic_link_content: "{{ .RedirectTo }}#token_hash={{ .TokenHash }}" } };
    expect(setupComplete(interpretChecks(hashOnly, { localMigrations: 16 }))).toBe(false);
    const linkOnly = { ...allSet, authConfig: { ...allSet.authConfig, mailer_templates_magic_link_content: "{{ .ConfirmationURL }}" } };
    const checks = interpretChecks(linkOnly, { localMigrations: 16 });
    expect(setupComplete(checks)).toBe(false);
    expect(checks.find((c) => c.name === "Sign-in code message")?.detail).toMatch(/magic-link template/);
  });

  it("fails when idle drafts would never expire", () => {
    const unscheduled = { ...allSet, status: { ...allSet.status, expiry_schedule: 0 } };
    const checks = interpretChecks(unscheduled, { localMigrations: 16 });
    expect(setupComplete(checks)).toBe(false);
    expect(checks.find((c) => c.name === "Draft expiry schedule")?.detail).toMatch(/never expire/);
  });

  it("fails while deletions, retention or alerts would never run", () => {
    for (const [status, name, says] of [
      ["purge_schedule", "Deletion schedule", /deletions never run/],
      ["retention_schedule", "Retention schedule", /never deleted/],
      ["monitor_schedule", "Alert schedule", /nobody is alerted/],
    ] as const) {
      const unscheduled = { ...allSet, status: { ...allSet.status, [status]: 0 } };
      const checks = interpretChecks(unscheduled, { localMigrations: 16 });
      expect(setupComplete(checks), status).toBe(false);
      expect(checks.find((c) => c.name === name)?.detail).toMatch(says);
    }
  });

  it("leaves the alert webhook as a to-do, and says what it covers", () => {
    const withAlerts = { ...allSet, secretNames: [...allSet.secretNames, "ENGINEERING_ALERT_WEBHOOK_URL"] };
    expect(interpretChecks(withAlerts, { localMigrations: 16 }).find((c) => c.name === "Engineering alerts")?.ok).toBe(true);
    const without = interpretChecks(allSet, { localMigrations: 16 }).find((c) => c.name === "Engineering alerts");
    expect(without).toMatchObject({ ok: false, required: false });
    expect(without?.detail).toMatch(/only logged/);
  });

  it("fails while the sign-up email is Supabase's default link", () => {
    const fresh = { ...allSet, authConfig: { ...allSet.authConfig, mailer_templates_confirmation_content: '<a href="{{ .ConfirmationURL }}">Confirm</a>' } };
    const checks = interpretChecks(fresh, { localMigrations: 16 });
    expect(setupComplete(checks)).toBe(false);
    expect(checks.find((c) => c.name === "Sign-up email survives mail scanners")?.ok).toBe(false);
  });

  describe("Sign-in email limit", () => {
    const limitCheck = (authConfig: Record<string, unknown>) =>
      interpretChecks({ ...allSet, authConfig: { ...allSet.authConfig, ...authConfig } }, { localMigrations: 16 }).find((c) => c.name === "Sign-in email limit");

    it("passes when the hourly cap is at or above the floor", () => {
      expect(limitCheck({ rate_limit_email_sent: MIN_AUTH_EMAILS_PER_HOUR })?.ok).toBe(true);
      expect(limitCheck({ rate_limit_email_sent: 1000 })?.ok).toBe(true);
    });

    it("is a to-do, not a failure, when the cap is low or unreported, and says what happens", () => {
      for (const authConfig of [{ rate_limit_email_sent: 30 }, { rate_limit_email_sent: undefined }]) {
        const check = limitCheck(authConfig);
        expect(check?.ok).toBe(false);
        expect(check?.required).toBe(false);
        expect(check?.detail).toMatch(/429/);
      }
      const checks = interpretChecks({ ...allSet, authConfig: { ...allSet.authConfig, rate_limit_email_sent: 30 } }, { localMigrations: 16 });
      expect(setupComplete(checks)).toBe(true);
    });

    it("points at SMTP first on the built-in mailer, where the cap can't be raised", () => {
      expect(limitCheck({ smtp_host: "", rate_limit_email_sent: 2 })?.detail).toMatch(/custom SMTP/);
    });
  });

  it("fails when prospects can't receive sign-in emails", () => {
    const builtIn = { ...allSet, authConfig: { ...allSet.authConfig, smtp_host: "" } };
    expect(setupComplete(interpretChecks(builtIn, { localMigrations: 16 }))).toBe(false);
  });

  it("fails when confirmation links would not come back to the site", () => {
    const fresh = { ...allSet, authConfig: { ...allSet.authConfig, site_url: "http://localhost:3000", uri_allow_list: "" } };
    const checks = interpretChecks(fresh, { localMigrations: 16 });
    expect(setupComplete(checks)).toBe(false);
    expect(checks.find((c) => c.name === "Email links return to the site")?.detail).toContain("http://localhost:3000");
  });

  it("compares the Site URL with APP_BASE_URL when it is known", () => {
    expect(setupComplete(interpretChecks(allSet, { localMigrations: 16, appBaseUrl: "https://nevermorepeo.com" }))).toBe(true);
    expect(setupComplete(interpretChecks(allSet, { localMigrations: 16, appBaseUrl: "https://intake.example.com" }))).toBe(false);
  });
});

describe("authUrlProblems", () => {
  const site = "https://nevermorepeo.com";

  it("accepts the site as Site URL, with or without a Redirect URLs entry for it", () => {
    expect(authUrlProblems({ site_url: site, uri_allow_list: `http://localhost:8080/**, ${site}/**` }, site)).toEqual([]);
    // A trailing slash on the Site URL is the same origin.
    expect(authUrlProblems({ site_url: `${site}/`, uri_allow_list: `${site}/**` }, site)).toEqual([]);
    // Supabase always allows the Site URL's own host, so the list isn't needed for it.
    expect(authUrlProblems({ site_url: site, uri_allow_list: "" }, site)).toEqual([]);
    expect(authUrlProblems({ site_url: site, uri_allow_list: `${site}/start` }, site)).toEqual([]);
  });

  it("names a Site URL left at Supabase's default", () => {
    expect(authUrlProblems({ site_url: "http://localhost:3000", uri_allow_list: "" }, null)).toEqual([
      "Site URL is http://localhost:3000: confirmation links send people there",
    ]);
    expect(authUrlProblems({ site_url: "http://localhost:3000", uri_allow_list: "" }, site)).toEqual([
      `Site URL is http://localhost:3000, not ${site}`,
      `Redirect URLs lack ${site}/**`,
    ]);
    // A wrong Site URL with the site on the list still sends links home, but the Site URL is still named.
    expect(authUrlProblems({ site_url: "http://localhost:3000", uri_allow_list: `${site}/**` }, site)).toEqual([
      `Site URL is http://localhost:3000, not ${site}`,
    ]);
  });

  it("names a missing Site URL and an unreadable config", () => {
    expect(authUrlProblems({ site_url: "", uri_allow_list: `${site}/**` }, site)).toEqual(["Site URL is not set (Authentication → URL Configuration)"]);
    expect(authUrlProblems(null, site)).toEqual(["auth config unreadable"]);
  });

  it("says so when APP_BASE_URL can't be compared, instead of passing quietly", () => {
    expect(authUrlProblems({ site_url: "https://old-preview.lovable.app", uri_allow_list: "" }, "nevermorepeo.com")).toEqual([
      "APP_BASE_URL (nevermorepeo.com) isn't a URL, so the Site URL wasn't compared with it",
    ]);
  });
});

