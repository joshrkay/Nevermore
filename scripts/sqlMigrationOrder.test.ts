import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkSqlTestLoadLists, loadedMigrations, loadListProblems } from "./sqlMigrationOrder";

const ALL = ["20260101_a.sql", "20260102_b.sql", "20260103_c.sql"];

describe("loadListProblems", () => {
  it("accepts a list in filename order that holds every migration", () => {
    expect(loadListProblems("t", ALL, ALL)).toEqual([]);
  });

  it("names a migration loaded before one that sorts earlier", () => {
    const problems = loadListProblems("t", ["20260101_a.sql", "20260103_c.sql", "20260102_b.sql"], ALL);
    expect(problems).toEqual(["t loads 20260102_b.sql after 20260103_c.sql; load lists must be in ascending filename order"]);
  });

  it("names a migration left out of a list that reaches the newest one", () => {
    expect(loadListProblems("t", ["20260101_a.sql", "20260103_c.sql"], ALL)).toEqual([
      "t reaches 20260103_c.sql but does not load 20260102_b.sql",
    ]);
  });

  it("names the first migration when a whole-suite list leaves it out, though the list reaches the newest one", () => {
    expect(loadListProblems("t", ["20260102_b.sql", "20260103_c.sql"], ALL)).toEqual([
      "t reaches 20260103_c.sql but does not load 20260101_a.sql",
    ]);
  });

  it("lets a list that stops early load only the migrations its story needs", () => {
    expect(loadListProblems("t", ["20260101_a.sql", "20260102_b.sql"], ALL)).toEqual([]);
  });
});

describe("loadedMigrations", () => {
  it("counts a migration loaded again to prove it can be re-run once, where it was first loaded", () => {
    const sql = "\\i supabase/migrations/20260101_a.sql\n-- x\n\\i supabase/migrations/20260102_b.sql\n\\i supabase/migrations/20260101_a.sql\n";
    expect(loadedMigrations(sql)).toEqual(["20260101_a.sql", "20260102_b.sql"]);
  });
});

describe("the SQL tests in this repository", () => {
  it("load their migrations in filename order, and the whole-suite lists load every migration", () => {
    expect(checkSqlTestLoadLists(path.resolve(__dirname, ".."))).toEqual([]);
  });
});
