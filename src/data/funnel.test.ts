import { describe, expect, it } from "vitest";
import { formatDuration, formatShare, FUNNEL_STEPS, funnelRange, funnelRows, isFunnelPeriod } from "./funnel";

describe("funnelRows", () => {
  it("lists every step in order, each as a share of the intakes that started, a missing step at zero", () => {
    const rows = funnelRows([
      { milestone: "certified", intakes: 5, median_minutes: 2880 },
      { milestone: "started", intakes: 20, median_minutes: null },
      { milestone: "answered", intakes: "16", median_minutes: "3.5" },
    ]);
    expect(rows.map((r) => r.step)).toEqual([...FUNNEL_STEPS]);
    expect(rows[0]).toEqual({ step: "started", label: "Started an intake", intakes: 20, ofStarted: 1, medianMinutes: null, measuredFrom: "start" });
    expect(rows[1]).toMatchObject({ intakes: 16, ofStarted: 0.8, medianMinutes: 3.5 });
    expect(rows.find((r) => r.step === "certified")).toMatchObject({ intakes: 5, ofStarted: 0.25, medianMinutes: 2880 });
    expect(rows.find((r) => r.step === "census_provided")).toMatchObject({ intakes: 0, ofStarted: 0, medianMinutes: null });
  });

  it("has no shares when nothing started, and never reads a bad number as one", () => {
    const rows = funnelRows([{ milestone: "started", intakes: 0, median_minutes: null }, { milestone: "answered", intakes: -3, median_minutes: "soon" }]);
    expect(rows.every((r) => r.ofStarted === null)).toBe(true);
    expect(rows[1]).toMatchObject({ intakes: 0, medianMinutes: null });
  });
});

describe("formatting", () => {
  it("shows a median in the unit that reads best", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(0.4)).toBe("under a minute");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(600)).toBe("10 h");
    expect(formatDuration(4 * 24 * 60)).toBe("4 days");
    expect(formatShare(0.256)).toBe("26%");
    expect(formatShare(null)).toBe("—");
  });

  it("turns a period into the range the database takes, ending now", () => {
    const now = new Date("2026-11-05T12:00:00Z");
    expect(funnelRange("7d", now)).toEqual({ from: new Date("2026-10-29T12:00:00Z"), to: now });
    expect(isFunnelPeriod("90d")).toBe(true);
    expect(isFunnelPeriod("2y")).toBe(false);
  });
});
