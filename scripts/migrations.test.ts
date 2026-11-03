import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The Supabase CLI knows a migration by the number before its first underscore: it is the primary key
// of supabase_migrations.schema_migrations. Two files with the same number stop `supabase db push`, and
// so `npm run setup:supabase`, at the second, with "duplicate key value violates unique constraint
// schema_migrations_pkey". The e2e stack and the SQL tests apply files by name and never notice.
const files = readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).sort();

describe("supabase/migrations", () => {
  it("names every file <version>_<name>.sql, the way the CLI reads it", () => {
    expect(files.filter((name) => !/^\d+_.+\.sql$/.test(name))).toEqual([]);
  });

  it("gives every migration a version of its own", () => {
    const byVersion = new Map<string, string[]>();
    for (const name of files) {
      const version = name.slice(0, name.indexOf("_"));
      byVersion.set(version, [...(byVersion.get(version) ?? []), name]);
    }
    expect([...byVersion.values()].filter((names) => names.length > 1)).toEqual([]);
  });
});
