import { describe, expect, it } from "vitest";
import { canStartRenewal, daysAwayWords, isOverdue, isRenewalDone, renewalStateWords } from "./renewals";

describe("renewal words (D-448, D-449)", () => {
  // Catches: a count of days that reads the wrong way round, or says "1 days".
  it.each([
    [45, "in 45 days"], [1, "in 1 day"], [0, "today"], [-1, "1 day ago"], [-12, "12 days ago"],
  ])("says %i days away as %s", (days, words) => {
    expect(daysAwayWords(days)).toBe(words);
  });

  // Catches: a fraction of a day passing as a count.
  it("refuses a day that is not whole", () => {
    expect(() => daysAwayWords(1.5)).toThrow();
  });

  // Catches: a renewal that is done, or due today, shown in the warning colour.
  it("is overdue only when past and not done", () => {
    expect(isOverdue(-3, false)).toBe(true);
    expect(isOverdue(-3, true)).toBe(false);
    expect(isOverdue(0, false)).toBe(false);
    expect(isOverdue(12, false)).toBe(false);
  });

  // Catches: the wrong words under a renewal, or "Start the renewal" offered while an opportunity is working it or after it is done.
  it("says what each state shows and when Start the renewal is offered", () => {
    expect(renewalStateWords("open", null)).toBeNull();
    expect(renewalStateWords("working", "January 2027 renewal")).toBe("January 2027 renewal");
    expect(renewalStateWords("lost", "January 2027 renewal")).toBe("January 2027 renewal, lost");
    expect(renewalStateWords("renewed", "x")).toBe("Renewed");
    expect(renewalStateWords("not_renewed", null)).toBe("Didn't renew");
    expect(canStartRenewal("open")).toBe(true);
    expect(canStartRenewal("lost")).toBe(true);
    expect(canStartRenewal("working")).toBe(false);
    expect(canStartRenewal("renewed")).toBe(false);
    expect(canStartRenewal("not_renewed")).toBe(false);
    expect(isRenewalDone("renewed") && isRenewalDone("not_renewed")).toBe(true);
    expect(isRenewalDone("open") || isRenewalDone("working") || isRenewalDone("lost")).toBe(false);
  });
});
