import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// A session belongs to one firm address (story CRM-P1.3a). Browsers keep storage per origin, so each address
// (acme.nevermorepeo.com, birch.nevermorepeo.com) has its own and a sign-in at one is not a sign-in at another. That
// holds only while nothing moves a session between origins: no cookie that spans the domain, no broker that copies
// it. These checks keep it that way.
const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.(test|guard\.test)\.tsx?$/.test(entry.name) ? [path] : [];
  });

describe("a session belongs to one firm address", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is kept in the browser's own storage for the address, not in a cookie that other addresses of the domain would send", () => {
    const withCookies = sources("src").filter((file) => /document\.cookie|cookieOptions|createBrowserClient|;\s*domain=/i.test(readFileSync(file, "utf8")));
    // The sidebar's open/closed preference is the one cookie, and it names no domain, so only its own address gets it.
    expect(withCookies).toEqual([join("src", "components", "ui", "sidebar.tsx")]);
    expect(readFileSync(join("src", "components", "ui", "sidebar.tsx"), "utf8")).not.toMatch(/domain=/i);
  });

  it("uses the page's own localStorage for the session at a firm's address", async () => {
    for (const host of ["acme-brokers.nevermorepeo.com", "birch-benefits.nevermorepeo.com", "acme-brokers.localhost", "nevermorepeo.com"]) {
      vi.stubGlobal("location", { hostname: host });
      const { brokeredPreviewStorage } = await import("@/integrations/supabase/previewAuthStorage");
      expect(brokeredPreviewStorage(), host).toBe(window.localStorage);
    }
  });
});
