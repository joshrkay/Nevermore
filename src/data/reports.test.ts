import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  cappedWords, customRangeProblem, daysWords, declineReasonsWords, lostReasonWords, money, monthWords, REPORT_LIMITS, reportCsv, reportFileName, reportRange, share,
  type Reports,
} from "./reports";

const reports = (over: Partial<Reports> = {}): Reports => ({
  whose: "everyone", whoseChoices: ["mine", "everyone"], line: null, from: "2026-10-01", to: "2026-11-24", today: "2026-11-24",
  pipeline: { count: 0, value: 0, stages: [], owners: [], rows: [] },
  markets: { sent: 0, quoted: 0, declined: 0, won: 0, markets: [], rows: [] },
  wonLost: { won: 0, lost: 0, valueWon: 0, owners: [], sources: [], reasons: [], rows: [] },
  renewals: { months: [], kept: 0, lost: 0, open: 0, rows: [] },
  commission: null, ...over,
});

describe("a report's period", () => {
  const now = new Date(2026, 10, 24, 15, 0, 0); // 24 Nov 2026, the person's own afternoon

  it("starts each named period on its first day and ends it today", () => {
    expect(reportRange("month", now)).toEqual({ from: "2026-11-01", to: "2026-11-24" });
    expect(reportRange("quarter", now)).toEqual({ from: "2026-10-01", to: "2026-11-24" });
    expect(reportRange("year", now)).toEqual({ from: "2026-01-01", to: "2026-11-24" });
    expect(reportRange("12m", now)).toEqual({ from: "2025-11-25", to: "2026-11-24" });
    expect(reportRange("quarter", new Date(2026, 0, 5))).toEqual({ from: "2026-01-01", to: "2026-01-05" });
  });

  it("says what is wrong with two typed dates, by the limit the database keeps", () => {
    expect(customRangeProblem("", "2026-11-24")).toBe("Enter both dates.");
    expect(customRangeProblem("2026-11-25", "2026-11-24")).toBe("The first date is after the second.");
    expect(customRangeProblem("2020-01-01", "2026-11-24")).toBe("A report covers at most three years.");
    expect(customRangeProblem("2026-11-24", "2026-11-24")).toBeNull();
    const sql = readFileSync("supabase/migrations/20261204090000_reports.sql", "utf8");
    const block = sql.slice(sql.indexOf("-- sync:begin report_limits"), sql.indexOf("-- sync:end report_limits"));
    expect(Object.fromEntries([...block.matchAll(/'(\w+)', (\d+)/g)].map((m) => [m[1], Number(m[2])]))).toEqual(REPORT_LIMITS);
  });
});

describe("a report's words", () => {
  it("says money, days, shares and months plainly", () => {
    expect(money(12000)).toBe("$12,000");
    expect(money(null)).toBe("");
    expect([daysWords(1), daysWords(4), daysWords(2.5), daysWords(null)]).toEqual(["1 day", "4 days", "2.5 days", ""]);
    expect([share(1, 3), share(0, 0)]).toEqual(["33%", "-"]);
    expect(monthWords("2026-11")).toBe("Nov 2026");
    expect([lostReasonWords("price"), lostReasonWords(null), lostReasonWords("not_said")]).toEqual(["Price", "Not said", "Not said"]);
    expect(declineReasonsWords({ not_said: 1 })).toBe("Not said (1)");
    expect([cappedWords(50, 80), cappedWords(3, 3)]).toEqual(["Showing 50 of 80.", null]);
  });
});

describe("a report as a file", () => {
  it("holds the table the panel shows, named for the report and its period", () => {
    const r = reports({
      markets: {
        sent: 3, quoted: 2, declined: 1, won: 1, rows: [],
        markets: [{ market: "Harbor PEO", sent: 2, quoted: 2, declined: 0, won: 1, medianDays: 4, declineReasons: {} }, { market: "Slow, PEO", sent: 1, quoted: 0, declined: 1, won: 0, medianDays: null, declineReasons: { not_said: 1 } }],
      },
    });
    expect(reportFileName("markets", r)).toBe("markets-2026-10-01-to-2026-11-24.csv");
    expect(reportFileName("won_lost", r)).toBe("won-lost-2026-10-01-to-2026-11-24.csv");
    expect(reportCsv("markets", r)).toBe(
      "PEO or carrier,Sent,Quoted,Declined,Placed,Win rate,Median days to a quote,Declined because\r\n" +
      "Harbor PEO,2,2,0,1,50%,4,\r\n" +
      "\"Slow, PEO\",1,0,1,0,,,Not said (1)\r\n",
    );
  });

  // Break caught: a cell a spreadsheet would run as a formula (an account named by someone else).
  it("keeps a name that starts like a formula as text", () => {
    const r = reports({ wonLost: { won: 1, lost: 0, valueWon: 0, owners: [], sources: [], reasons: [], rows: [{ id: "o1", name: "=HYPERLINK(1)", account: "Reyes", outcome: "won", on: "2026-11-01", value: null, reason: null, owner: null }] } });
    expect(reportCsv("won_lost", r)).toContain("'=HYPERLINK(1),Reyes,Won,2026-11-01,,,");
  });

  it("has no commission rows for someone who is given none", () => {
    expect(reportCsv("commission", reports())).toBe("Account,PEO or carrier,Expected,Received\r\n");
  });
});
