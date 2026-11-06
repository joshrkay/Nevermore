import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classesStoredIn, DATA_CLASSES, RETENTION, RETENTION_RULES, SENSITIVITY } from "@/data/dataPolicy";
import { DRAFT_RETENTION_DAYS } from "@/data/intakeLifecycle";

// "Every stored data class has a rule" (H-1.1), checked against the schema rather than by eye: every table
// and storage bucket the migrations create must belong to a classified data class, and every place a class
// says it is stored must exist. A new table that holds anything fails here until it is classified.
const sql = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(`supabase/migrations/${f}`, "utf8"))
  .join("\n");

const tables = new Set([...sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?public\.(\w+)/gi)].map((m) => m[1]));
for (const m of sql.matchAll(/DROP TABLE (?:IF EXISTS )?public\.(\w+)/gi)) tables.delete(m[1]);
const buckets = new Set(
  [...sql.matchAll(/INSERT INTO storage\.buckets\s*\([^)]*\)\s*VALUES\s*\('([^']+)'/gi)].map((m) => m[1]),
);

describe("data classification against the schema", () => {
  it("finds the tables and buckets it checks", () => {
    expect(tables.size).toBeGreaterThanOrEqual(22);
    expect([...buckets].sort()).toEqual(["documents", "manuscripts", "quarantine"]);
  });

  it.each([...tables].sort())("classifies the table %s", (table) => {
    expect(classesStoredIn({ table }).map((c) => c.id), `${table} is stored but belongs to no data class`).not.toEqual([]);
  });

  it.each([...buckets].sort())("classifies the bucket %s", (bucket) => {
    expect(classesStoredIn({ bucket }).length, `${bucket} is stored but belongs to no data class`).toBeGreaterThan(0);
  });

  it("names only tables and buckets that exist", () => {
    for (const c of DATA_CLASSES) {
      for (const t of c.stored.tables) expect(tables.has(t), `${c.id} names table ${t}`).toBe(true);
      for (const b of c.stored.buckets) expect(buckets.has(b), `${c.id} names bucket ${b}`).toBe(true);
    }
  });

  it("gives each bucket the sensitivity of the most sensitive thing it holds", () => {
    // Every bucket holds census data, so every one is restricted.
    for (const bucket of buckets) {
      expect(classesStoredIn({ bucket }).some((c) => c.sensitivity === "restricted"), bucket).toBe(true);
    }
  });
});

describe("the classes the business asked for", () => {
  const byId = new Map(DATA_CLASSES.map((c) => [c.id, c]));

  it.each([
    ["contact", "confidential"],
    ["census", "restricted"],
    ["payroll", "restricted"],
    ["workers_comp", "restricted"],
    ["documents", "restricted"],
    ["transcripts", "restricted"],
    ["manuscripts", "restricted"],
  ])("classifies %s as %s", (id, level) => {
    expect(byId.get(id)?.sensitivity).toBe(level);
  });

  it("gives every class a known level, a retention rule and a deletion rule, under a unique id", () => {
    expect(new Set(DATA_CLASSES.map((c) => c.id)).size).toBe(DATA_CLASSES.length);
    for (const c of DATA_CLASSES) {
      expect(Object.keys(SENSITIVITY)).toContain(c.sensitivity);
      expect(c.retention.trim(), c.id).not.toBe("");
      expect(c.deletion.trim(), c.id).not.toBe("");
      expect(c.examples.trim(), c.id).not.toBe("");
    }
  });

  it("says how each level is handled", () => {
    for (const level of Object.values(SENSITIVITY)) expect(level.handling.length).toBeGreaterThan(0);
  });
});

describe("retention rules shown to prospects", () => {
  it.each([
    ["drafts", /^Draft intakes/],
    ["submitted records", /^Submitted records/],
    ["documents", /^Uploaded documents/],
    ["transcripts", /transcripts/i],
    ["generated PDFs", /packet PDFs/],
  ])("has a period for %s", (_what, pattern) => {
    const rule = RETENTION_RULES.find((r) => pattern.test(r.record));
    expect(rule, String(pattern)).toBeDefined();
    expect(rule!.period.trim()).not.toBe("");
    expect(rule!.then.trim()).not.toBe("");
  });

  it("states the windows the database enforces", () => {
    expect(RETENTION.draftDays).toBe(DRAFT_RETENTION_DAYS);
    const drafts = RETENTION_RULES.find((r) => r.record.startsWith("Draft intakes"))!;
    expect(drafts.period).toContain(`${RETENTION.draftDays} days`);
    expect(drafts.then).toContain(`${RETENTION.closedDraftDays} days`);
    expect(RETENTION_RULES.find((r) => r.record.startsWith("Submitted records"))!.period).toContain(`${RETENTION.submittedYears} years`);
    expect(RETENTION.browserBackupDays).toBe(7);
  });
});
