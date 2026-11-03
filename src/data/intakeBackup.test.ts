import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_CHAMBER_DATA } from "./chamberTypes";
import {
  BACKUP_MAX_AGE_MS,
  BACKUP_PREFIX,
  browserStorageWorks,
  clearAllBackups,
  clearBackup,
  pruneBackups,
  readBackup,
  writeBackup,
} from "./intakeBackup";

const NOW = Date.parse("2026-11-03T12:00:00Z");
const entry = (over: Record<string, unknown> = {}) => ({
  userId: "u1",
  sessionId: "s1",
  baseVersion: 4,
  chamber_data: { ...DEMO_CHAMBER_DATA } as Record<string, unknown>,
  field_provenance: { company_name: { status: "confirmed" } },
  transcript: [{ id: "m1", sender: "user", text: "We're Meridian", timestamp: "" }],
  ...over,
});

describe("intake backup", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("keeps unsaved answers for the same person and intake, without the census", () => {
    expect(writeBackup(entry(), NOW)).toBe(true);
    const backup = readBackup("u1", "s1", NOW);
    expect(backup).toMatchObject({ userId: "u1", sessionId: "s1", baseVersion: 4, savedAt: "2026-11-03T12:00:00.000Z" });
    expect(backup?.chamber_data.company_name).toBe(DEMO_CHAMBER_DATA.company_name);
    expect(backup?.chamber_data).not.toHaveProperty("census");
    expect(localStorage.getItem(`${BACKUP_PREFIX}u1:s1`)).not.toContain("Sarah");
    expect(backup?.transcript).toHaveLength(1);
  });

  it("never writes the census under its older name either", () => {
    writeBackup(entry({ chamber_data: { company_name: "Acme", employees: [{ first_name: "Sarah" }] } }), NOW);
    expect(readBackup("u1", "s1", NOW)?.chamber_data).toEqual({ company_name: "Acme" });
  });

  it("offers nothing to another person or for another intake", () => {
    writeBackup(entry(), NOW);
    expect(readBackup("u2", "s1", NOW)).toBeNull();
    expect(readBackup("u1", "s2", NOW)).toBeNull();
    expect(readBackup("u1", "s1", NOW)).not.toBeNull();
  });

  it("discards a copy older than a week", () => {
    writeBackup(entry(), NOW);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(readBackup("u1", "s1", NOW + BACKUP_MAX_AGE_MS + 1)).toBeNull();
    expect(localStorage.getItem(`${BACKUP_PREFIX}u1:s1`)).toBeNull();
  });

  // Browser storage is input like any other: something else may have written to it, or changed it.
  it.each([
    ["not JSON", "{"],
    ["not an object", "[]"],
    ["for someone else", JSON.stringify({ ...entry({ userId: "u2" }), savedAt: "2026-11-03T11:00:00Z" })],
    ["without a time", JSON.stringify(entry())],
    ["without a transcript list", JSON.stringify({ ...entry({ transcript: "hi" }), savedAt: "2026-11-03T11:00:00Z" })],
    ["with a bad base version", JSON.stringify({ ...entry({ baseVersion: "4" }), savedAt: "2026-11-03T11:00:00Z" })],
    ["with answers the intake schema refuses", JSON.stringify({ ...entry({ chamber_data: { hq_state: "California", injected: true } }), savedAt: "2026-11-03T11:00:00Z" })],
  ])("discards a copy that is %s", (_name, stored) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.setItem(`${BACKUP_PREFIX}u1:s1`, stored);
    expect(readBackup("u1", "s1", NOW)).toBeNull();
    expect(localStorage.getItem(`${BACKUP_PREFIX}u1:s1`)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    // The reason names paths, never the values.
    expect(String(warn.mock.calls[0][0])).not.toContain("California");
  });

  it("removes one intake's copy, or every copy on sign-out, and leaves other site data alone", () => {
    writeBackup(entry(), NOW);
    writeBackup(entry({ sessionId: "s2" }), NOW);
    writeBackup(entry({ userId: "u2" }), NOW);
    localStorage.setItem("sb-auth-token", "keep");
    clearBackup("u1", "s1");
    expect(readBackup("u1", "s1", NOW)).toBeNull();
    expect(readBackup("u1", "s2", NOW)).not.toBeNull();
    clearAllBackups();
    expect(Object.keys(localStorage)).toEqual(["sb-auth-token"]);
  });

  it("prunes stale and unreadable copies, whoever wrote them", () => {
    writeBackup(entry(), NOW - BACKUP_MAX_AGE_MS - 1);
    writeBackup(entry({ userId: "u2" }), NOW);
    localStorage.setItem(`${BACKUP_PREFIX}junk`, "{");
    pruneBackups(NOW);
    expect(Object.keys(localStorage)).toEqual([`${BACKUP_PREFIX}u2:s1`]);
  });

  it("does nothing, and says so, when the browser won't store anything", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("quota", "QuotaExceededError"); });
    expect(browserStorageWorks()).toBe(false);
    expect(writeBackup(entry(), NOW)).toBe(false);
    vi.restoreAllMocks();
    expect(browserStorageWorks()).toBe(true);
  });

  it("does nothing when reading storage itself throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("denied", "SecurityError"); });
    expect(readBackup("u1", "s1", NOW)).toBeNull();
    expect(() => pruneBackups(NOW)).not.toThrow();
  });
});
