import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The headers Vercel adds to every page (vercel.json). Without them any site could frame the Chamber or the
// Advisor Console (clickjacking a certification or a status change), and nothing limited where scripts load from.
interface HeaderRule { source: string; headers: { key: string; value: string }[] }
const config = JSON.parse(readFileSync("vercel.json", "utf8")) as { headers: HeaderRule[] };
const projectRef = /project_id\s*=\s*"([a-z0-9]+)"/.exec(readFileSync("supabase/config.toml", "utf8"))?.[1];

const everyPage = config.headers.find((rule) => rule.source === "/(.*)");
const header = (name: string) => everyPage?.headers.find((h) => h.key.toLowerCase() === name.toLowerCase())?.value;
const directives = (policy: string | undefined) =>
  Object.fromEntries((policy ?? "").split(";").map((d) => d.trim().split(/\s+/)).filter((d) => d[0]).map(([name, ...values]) => [name, values]));

describe("security headers (vercel.json)", () => {
  it("refuses to be framed by another site, and stops content-type sniffing", () => {
    expect(header("X-Frame-Options")).toBe("DENY");
    expect(directives(header("Content-Security-Policy"))["frame-ancestors"]).toEqual(["'none'"]);
    expect(header("X-Content-Type-Options")).toBe("nosniff");
  });

  it("enforces only the directives that can't break a page: no plugins, no <base> from elsewhere", () => {
    const enforced = directives(header("Content-Security-Policy"));
    expect(enforced["object-src"]).toEqual(["'none'"]);
    expect(enforced["base-uri"]).toEqual(["'self'"]);
    expect(enforced["script-src"]).toBeUndefined();
  });

  it("reports what a full policy would block, allowing only the app, Supabase, Turnstile, Google Fonts and voice", () => {
    const policy = directives(header("Content-Security-Policy-Report-Only"));
    expect(policy["default-src"]).toEqual(["'self'"]);
    expect(policy["script-src"]).not.toContain("'unsafe-inline'");
    expect(policy["script-src"]).not.toContain("'unsafe-eval'");
    expect(policy["script-src"]).toContain("https://challenges.cloudflare.com");
    expect(policy["connect-src"]).toContain(`https://${projectRef}.supabase.co`);
    expect(policy["connect-src"]).toContain("wss://api.elevenlabs.io");
    expect(policy["frame-ancestors"]).toEqual(["'none'"]);
  });

  it("keeps the microphone for this site alone, for voice, and turns off what the app never uses", () => {
    const permissions = header("Permissions-Policy") ?? "";
    expect(permissions).toContain("microphone=(self)");
    for (const feature of ["camera=()", "geolocation=()", "payment=()"]) expect(permissions).toContain(feature);
  });

  it("sends only the origin to other sites", () => {
    expect(header("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("still caches the hashed assets for a year", () => {
    const assets = config.headers.find((rule) => rule.source === "/assets/(.*)");
    expect(assets?.headers).toContainEqual({ key: "Cache-Control", value: "public, max-age=31536000, immutable" });
  });
});
