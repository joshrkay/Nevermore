import { describe, expect, it } from "vitest";
import { suggestedRenewalName } from "./opportunityFields";
import { addRenewalSchema, daysAwayWords, daysFromToday, editRenewalSchema, notRenewedSchema } from "./renewals";

describe("daysAwayWords (D-448)", () => {
  // Catches: the story's own examples worded another way ("in 45 days", "today", "12 days ago"), or a one day gap pluralised.
  it.each([[45, "in 45 days"], [1, "in 1 day"], [0, "today"], [-1, "1 day ago"], [-12, "12 days ago"]])("says %i as %s", (n, words) => {
    expect(daysAwayWords(n)).toBe(words);
  });
});

describe("daysFromToday", () => {
  const today = new Date(2026, 10, 16, 23, 30);
  // Catches: a day counted from the moment rather than the day (late in the evening a renewal tomorrow would be "today"), or the wrong sign for a past day.
  it("counts whole days from the person's own day", () => {
    expect(daysFromToday("2026-11-16", today)).toBe(0);
    expect(daysFromToday("2026-11-17", today)).toBe(1);
    expect(daysFromToday("2026-11-04", today)).toBe(-12);
    expect(daysFromToday("2027-01-05", today)).toBe(50);
  });
  // Catches: a clock change (a 23 or 25 hour day) making a day count one short or long.
  it("is not moved by a clock change in between", () => {
    expect(daysFromToday("2026-11-02", new Date(2026, 9, 31, 12))).toBe(2);
  });
});

describe("suggestedRenewalName (D-449)", () => {
  // Catches: the renewal's name offered as a PEO search, or with no month, or from a date that does not exist.
  it("is '<Month YYYY> renewal' from the renewal's date", () => {
    expect(suggestedRenewalName("2027-01-01")).toBe("January 2027 renewal");
    expect(suggestedRenewalName("2027-12-31")).toBe("December 2027 renewal");
    expect(suggestedRenewalName("")).toBe("Renewal");
    expect(suggestedRenewalName("2027-02-30")).toBe("Renewal");
  });
});

describe("the renewal forms' rules", () => {
  const ok = { kind: "peo_placement", with_whom: " Justworks ", renews_on: "2027-06-01", placement_start: "" };
  // Catches: a value the form takes that the database refuses (with whom over 80, no date, a kind outside the two), or one it refuses that the database takes (a blank start date).
  it("takes what the database takes and trims it", () => {
    expect(addRenewalSchema.parse(ok)).toEqual({ ...ok, with_whom: "Justworks" });
    expect(addRenewalSchema.safeParse({ ...ok, with_whom: "x".repeat(81) }).success).toBe(false);
    expect(addRenewalSchema.safeParse({ ...ok, with_whom: "   " }).success).toBe(false);
    expect(addRenewalSchema.safeParse({ ...ok, renews_on: "" }).success).toBe(false);
    expect(addRenewalSchema.safeParse({ ...ok, renews_on: "2027-02-30" }).success).toBe(false);
    expect(addRenewalSchema.safeParse({ ...ok, kind: "policy" }).success).toBe(false);
    expect(addRenewalSchema.safeParse({ ...ok, with_whom: "x".repeat(80), kind: "current_plan" }).success).toBe(true);
    expect(editRenewalSchema.safeParse({ with_whom: "Aetna", renews_on: "" }).success).toBe(false);
    expect(notRenewedSchema.safeParse({ not_renewed_on: "" }).success).toBe(false);
    expect(notRenewedSchema.safeParse({ not_renewed_on: "2026-12-01" }).success).toBe(true);
  });
});
