// The SQL tests build their database by loading migrations with psql `\i` lines. A list in the wrong order builds a
// database no deployment has (a migration that replaces a function runs before the one that dropped it), so a test can
// pass on a schema that is never real. This reads the test files' text and reports lists that are not in filename order,
// and lists that reach the newest migration yet leave one out.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const LOAD = /^\\i\s+supabase\/migrations\/(\S+\.sql)\s*$/gm;

/** The migration files a SQL test loads, in the order it loads them. A file loaded a second time (to prove a migration can be re-run) counts once, where it was first loaded. */
export function loadedMigrations(testSql: string): string[] {
  const seen: string[] = [];
  for (const m of testSql.matchAll(LOAD)) if (!seen.includes(m[1])) seen.push(m[1]);
  return seen;
}

export function loadListProblems(name: string, loaded: string[], allMigrations: string[]): string[] {
  const problems: string[] = [];
  if (loaded.length === 0) return problems;
  for (let i = 1; i < loaded.length; i++) {
    if (loaded[i - 1] > loaded[i]) {
      problems.push(`${name} loads ${loaded[i]} after ${loaded[i - 1]}; load lists must be in ascending filename order`);
    }
  }
  const newest = [...allMigrations].sort().at(-1);
  if (newest && loaded.includes(newest)) {
    for (const file of allMigrations.filter((f) => f >= loaded[0]).sort()) {
      if (!loaded.includes(file)) problems.push(`${name} reaches ${newest} but does not load ${file}`);
    }
  }
  return problems;
}

export function checkSqlTestLoadLists(root: string): string[] {
  const migrations = readdirSync(path.join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql"));
  const testsDir = path.join(root, "supabase/tests");
  return readdirSync(testsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .flatMap((f) => loadListProblems(f, loadedMigrations(readFileSync(path.join(testsDir, f), "utf8")), migrations));
}
