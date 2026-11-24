import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { daysAwayWords, HOME_COUNTS, HOME_DAYS, needKindWords, needWhenWords, recordPath, sendBlockWords } from "./home";

describe("Home's words", () => {
  // Break caught: the page saying "the next 14 days" while the database lists by another number (BR-3.1: 14 for a quote, 7 for an intake and a lead).
  it("goes by the day counts the database goes by", () => {
    const sql = readFileSync("supabase/migrations/20261128090000_home.sql", "utf8");
    const block = sql.slice(sql.indexOf("-- sync:begin home_days"), sql.indexOf("-- sync:end home_days"));
    const inSql = Object.fromEntries([...block.matchAll(/'([a-z_]+)', (\d+)/g)].map((m) => [m[1], Number(m[2])]));
    expect(inSql).toEqual({ ...HOME_DAYS });
    expect(HOME_DAYS).toMatchObject({ quote_expiring: 14, intake_quiet: 7, lead_quiet: 7 });
  });

  it("opens each line on the record it is about, and new mail on the inbox", () => {
    expect([recordPath("inbox", "t1"), recordPath("opportunity", "o1"), recordPath("quote", "7"), recordPath("lead", "l1"), recordPath("account", "a1")])
      .toEqual(["/inbox", "/opportunities/o1", "/quotes/7", "/leads/l1", "/accounts/a1"]);
  });

  it("says a task is due today or overdue, by the reader's own day", () => {
    const now = new Date(2026, 10, 24, 9, 0);
    expect(needKindWords({ kind: "task_due", at: new Date(2026, 10, 24, 0, 0).toISOString() }, now)).toBe("Task due today");
    expect(needKindWords({ kind: "task_due", at: new Date(2026, 10, 22, 0, 0).toISOString() }, now)).toBe("Task overdue");
    expect(needKindWords({ kind: "new_mail", at: now.toISOString() }, now)).toBe("New mail");
  });

  it("says when in the words of each kind", () => {
    const at = new Date(2026, 11, 4, 12, 0).toISOString();
    expect(["quote_expiring", "task_due", "intake_certified", "intake_quiet", "lead_quiet", "new_mail"].map((kind) => needWhenWords({ kind: kind as never, at }))).toEqual([
      "Expires Dec 4", "Due Dec 4", "Certified Dec 4", "Nothing new since Dec 4", "No activity since Dec 4", "Received Dec 4",
    ]);
  });

  it("says how far off a day is, one day in the singular", () => {
    expect([0, 1, 5, -1, -3].map(daysAwayWords)).toEqual(["today", "in 1 day", "in 5 days", "1 day overdue", "3 days overdue"]);
  });

  it("says nothing stops a send when nothing does", () => {
    expect(sendBlockWords(null)).toBeNull();
    expect(sendBlockWords("no_mailbox")).toContain("Connect your mailbox");
  });

  it("has five counts, the renewals one worded with its number of days", () => {
    expect(HOME_COUNTS.map((c) => c.label)).toEqual(["Open leads", "Open opportunities", "Quotes waiting on a PEO", "Renewals in the next 120 days", "Won this quarter"]);
  });
});
