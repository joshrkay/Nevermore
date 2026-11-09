import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  captureIntakeSource,
  cleanSourceCode,
  intakeSourceColumns,
  recalledSource,
  rememberSource,
  SOURCE_KEY,
  SOURCE_MAX_AGE_MS,
  sourceFromSearch,
} from "./intakeSource";

const NOW = new Date("2026-11-06T12:00:00Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("cleanSourceCode", () => {
  it.each([
    ["acme-cfo", "acme-cfo"],
    ["  Acme CFO Partners ", "acme-cfo-partners"],
    ["Spring Sale 2027", "spring-sale-2027"],
    ["newsletter_v2.1", "newsletter_v2.1"],
    ["Çafé", "cafe"],
    ["--lead-in", "lead-in"],
    ["a  --  b", "a-b"],
    ["jo@example.com", "joexample.com"],
    ["https://x.test/path", "httpsx.testpath"],
  ])("keeps %j as %j", (raw, code) => {
    expect(cleanSourceCode(raw)).toBe(code);
  });

  it("drops what leaves nothing usable, and cuts at 64 characters", () => {
    for (const raw of ["", "   ", "---", "@@@", "日本", null, undefined, 42, {}]) expect(cleanSourceCode(raw)).toBeNull();
    expect(cleanSourceCode("a".repeat(80))).toBe("a".repeat(64));
  });
});

describe("sourceFromSearch", () => {
  it("reads the referral code and campaign tags from a page address", () => {
    expect(sourceFromSearch("?ref=Acme-CFO&utm_source=newsletter&utm_medium=email&utm_campaign=Renewals+2027&other=1")).toEqual({
      referral_code: "acme-cfo",
      utm_source: "newsletter",
      utm_medium: "email",
      utm_campaign: "renewals-2027",
    });
    expect(sourceFromSearch("?utm_source=linkedin")).toEqual({ referral_code: null, utm_source: "linkedin", utm_medium: null, utm_campaign: null });
  });

  it("finds nothing in an address with no usable code", () => {
    expect(sourceFromSearch("")).toBeNull();
    expect(sourceFromSearch("?session=abc&period=30d")).toBeNull();
    expect(sourceFromSearch("?ref=%40%40&utm_source=")).toBeNull();
  });
});

describe("keeping the source in this browser", () => {
  it("keeps the last tagged link for 30 days", () => {
    captureIntakeSource("?ref=acme-cfo", NOW);
    expect(recalledSource(later(SOURCE_MAX_AGE_MS - 1))?.referral_code).toBe("acme-cfo");
    // A later link with any code replaces it, whole.
    captureIntakeSource("?utm_source=linkedin", later(1000));
    expect(recalledSource(later(2000))).toEqual({ referral_code: null, utm_source: "linkedin", utm_medium: null, utm_campaign: null });
    // A visit with no codes changes nothing.
    captureIntakeSource("?session=abc", later(3000));
    expect(recalledSource(later(4000))?.utm_source).toBe("linkedin");
  });

  it("forgets a copy that is too old, from the future or unreadable", () => {
    rememberSource({ referral_code: "acme-cfo", utm_source: null, utm_medium: null, utm_campaign: null }, NOW);
    expect(recalledSource(later(SOURCE_MAX_AGE_MS + 1))).toBeNull();
    expect(localStorage.getItem(SOURCE_KEY)).toBeNull();

    rememberSource({ referral_code: "acme-cfo", utm_source: null, utm_medium: null, utm_campaign: null }, later(60_000));
    expect(recalledSource(NOW)).toBeNull();

    for (const raw of ["not json", "[1]", JSON.stringify({ referral_code: "acme", savedAt: "soon" })]) {
      localStorage.setItem(SOURCE_KEY, raw);
      expect(recalledSource(NOW)).toBeNull();
      expect(localStorage.getItem(SOURCE_KEY)).toBeNull();
    }
  });

  it("reads the stored copy as untrusted, dropping anything that isn't a well-formed code", () => {
    localStorage.setItem(
      SOURCE_KEY,
      JSON.stringify({ referral_code: "Acme CFO", utm_source: "newsletter", utm_medium: 7, utm_campaign: "<b>x</b>", savedAt: NOW.toISOString() }),
    );
    expect(recalledSource(NOW)).toEqual({ referral_code: null, utm_source: "newsletter", utm_medium: null, utm_campaign: null });
  });

  it("does nothing, quietly, when the browser refuses storage", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => captureIntakeSource("?ref=acme-cfo", NOW)).not.toThrow();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(recalledSource(NOW)).toBeNull();
  });
});

describe("intakeSourceColumns", () => {
  it("sends only the codes there are, and nothing for an intake with no source", () => {
    expect(intakeSourceColumns(null)).toEqual({});
    expect(intakeSourceColumns({ referral_code: "acme-cfo", utm_source: null, utm_medium: "email", utm_campaign: null })).toEqual({
      referral_code: "acme-cfo",
      utm_medium: "email",
    });
  });
});
