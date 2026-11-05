// The setup script and the edge functions read the same malware-scanner settings (ADR 0002): which MALWARE_SCANNER
// values exist, and which APP_ENV values allow MALWARE_SCANNER=none. Each side keeps its own copy (the script is plain
// Node, the functions are Deno), so this holds them together: if they drifted, setup could accept a `none` or a
// scanner name that the functions then refuse on every upload.
import { describe, expect, it, vi } from "vitest";
import { selectScanner, UNSCANNED_ENVIRONMENTS as FUNCTION_ENVIRONMENTS, type ScannerDeps } from "../supabase/functions/_shared/malwareScan.ts";
import { checkSecrets, MALWARE_SCANNERS, UNSCANNED_ENVIRONMENTS as SETUP_ENVIRONMENTS } from "./supabase-setup-lib.mjs";

const deps: ScannerDeps = { fetch: vi.fn() as unknown as typeof fetch, connect: vi.fn() };

// Settings that make each scanner complete, in both places.
const COMPLETE: Record<string, Record<string, string>> = {
  scanii: { SCANII_API_KEY: "0123abcd", SCANII_API_SECRET: "s3cret" },
  clamav: { CLAMAV_HOST: "scan.example.com" },
  http: { MALWARE_SCANNER_URL: "https://scan.example.com/v1/scan", MALWARE_SCANNER_TOKEN: "t" },
  none: { APP_ENV: "staging" },
};

describe("scanner settings, as setup checks them and the functions read them", () => {
  it("name the same environments where MALWARE_SCANNER=none is allowed", () => {
    expect([...SETUP_ENVIRONMENTS]).toEqual([...FUNCTION_ENVIRONMENTS]);
  });

  it("accept the same scanners: each one setup accepts, complete, is one the functions can use", () => {
    expect(Object.keys(COMPLETE).sort()).toEqual([...MALWARE_SCANNERS].sort());
    for (const name of MALWARE_SCANNERS) {
      const settings = { MALWARE_SCANNER: name, ...COMPLETE[name] };
      const setup = checkSecrets({ ANTHROPIC_API_KEY: "k", AI_PROVIDER: "anthropic", APP_BASE_URL: "https://nevermorepeo.com", ...settings });
      expect(setup.errors, name).toEqual([]);
      expect(selectScanner((key) => settings[key as keyof typeof settings], deps), name).toMatchObject({ ok: true });
    }
  });

  it("agree that none is refused outside those environments", () => {
    for (const env of [undefined, "production", "prod"]) {
      const settings: Record<string, string> = { MALWARE_SCANNER: "none", ...(env ? { APP_ENV: env } : {}) };
      expect(checkSecrets({ ANTHROPIC_API_KEY: "k", AI_PROVIDER: "anthropic", APP_BASE_URL: "https://nevermorepeo.com", ...settings }).errors.length, String(env)).toBeGreaterThan(0);
      expect(selectScanner((key) => settings[key], deps).ok, String(env)).toBe(false);
    }
  });
});
