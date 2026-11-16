import { describe, expect, it } from "vitest";
import { splitName, stepToOpenAt } from "./newQuote";

describe("a contact's one name box", () => {
  // Catches: a one-word name ("Lucia") kept as a first name with no last name, which the contact record refuses (a last name is required).
  it("keeps a one-word name as the last name, and splits a longer one at its first space", () => {
    expect(splitName("Lucia")).toEqual({ firstName: "", lastName: "Lucia" });
    expect(splitName("  Lucia  de la Cruz ")).toEqual({ firstName: "Lucia", lastName: "de la Cruz" });
  });
});

describe("the step New quote opens at, worked out from the data (D-1702)", () => {
  // Catches: a New quote with no opportunity yet opening past the account step (every later step names an opportunity, D-1709).
  it("is step 1 while there is no opportunity", () => {
    expect(stepToOpenAt(null)).toBe(1);
  });

  // Catches: a half-done New quote with an opportunity and no intake reopening at the account step (D-1702: no intake, step 2).
  it("is step 2 when the opportunity has no intake", () => {
    expect(stepToOpenAt({ intake: null, quotesSent: 0 })).toBe(2);
  });

  // Catches: an intake the employer has not certified reopening at step 2 or step 4 (D-1702: not certified, step 3).
  it("is step 3 when the intake is not certified", () => {
    expect(stepToOpenAt({ intake: { certified: false }, quotesSent: 0 })).toBe(3);
  });

  // Catches: a certified intake with nothing sent reopening before the choice of PEOs (D-1702: certified and nothing sent, step 4).
  it("is step 4 when the intake is certified and nothing has been sent", () => {
    expect(stepToOpenAt({ intake: { certified: true }, quotesSent: 0 })).toBe(4);
  });
});
