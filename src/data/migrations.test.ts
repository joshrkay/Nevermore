import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

// `supabase db push` records each migration by the number before its first underscore. When two files
// share that number it applies the first, then fails on the second ("duplicate key value violates unique
// constraint schema_migrations_pkey"), and nothing after it is applied. So every file needs its own number.
const files = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();

describe("migration files", () => {
  it("are named <14-digit version>_<name>.sql", () => {
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((f) => !/^\d{14}_[a-z0-9_-]+\.sql$/.test(f))).toEqual([]);
  });

  it("each have a version of their own", () => {
    const byVersion = new Map<string, string[]>();
    for (const f of files) byVersion.set(f.slice(0, 14), [...(byVersion.get(f.slice(0, 14)) ?? []), f]);
    expect([...byVersion.values()].filter((names) => names.length > 1)).toEqual([]);
  });

  // Two branches that renumber the same file to different versions merge into two copies of it, and
  // `db push` then runs that migration twice ("column ... already exists"). A repeated name or a repeated
  // body is such a copy.
  it("hold each migration once", () => {
    const groups = new Map<string, string[]>();
    for (const f of files) {
      for (const key of [`name ${f.slice(15)}`, `sql ${readFileSync(`supabase/migrations/${f}`, "utf8")}`]) {
        groups.set(key, [...(groups.get(key) ?? []), f]);
      }
    }
    expect([...groups.values()].filter((names) => names.length > 1)).toEqual([]);
  });
});
