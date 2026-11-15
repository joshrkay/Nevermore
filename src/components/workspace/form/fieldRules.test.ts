import { describe, expect, it } from "vitest";
import { dateRule, phoneRule, stateRule, wholeNumberRule } from "./fieldRules";

const message = (result: { success: boolean; error?: { issues: { message: string }[] } }) => (result.success ? null : result.error?.issues[0].message);

describe("phoneRule", () => {
  const PHONE_WORDS = "Enter a phone number like (503) 555-0142, with its area code. An extension can follow, like x12.";
  it.each(["(503) 555-0142", "503-555-0142", "503.555.0142", "+1 503 555 0142", "5035550142", "503 555 0142 x12", "503 555 0142 ext. 345", "+44 20 7946 0958"])(
    "takes %s",
    (typed) => expect(phoneRule().safeParse(typed).success).toBe(true),
  );
  it.each(["call me", "555-0142", "12345678901234567", "503+555+0142", "(503) 555-0142 ext", "503-555-0142 x1234567", "++15035550142"])(
    "refuses %s in words",
    (typed) => expect(message(phoneRule().safeParse(typed))).toBe(PHONE_WORDS),
  );
  it("may be left empty, and trims what is typed", () => {
    expect(phoneRule().parse("")).toBe("");
    expect(phoneRule().parse("   ")).toBe("");
    expect(phoneRule().parse(" (503) 555-0142 ")).toBe("(503) 555-0142");
  });
});

describe("stateRule", () => {
  it("takes a state code in either case, or nothing", () => {
    expect(stateRule().parse("OR")).toBe("OR");
    expect(stateRule().parse("or")).toBe("OR");
    expect(stateRule().parse("")).toBe("");
  });
  it("refuses what is not a state, in words", () => {
    expect(message(stateRule().safeParse("ZZ"))).toBe("Choose a state from the list.");
    expect(message(stateRule().safeParse("Oregon"))).toBe("Choose a state from the list.");
  });
});

describe("dateRule", () => {
  it("takes a real day or nothing", () => {
    expect(dateRule().parse("2027-01-15")).toBe("2027-01-15");
    expect(dateRule().parse("")).toBe("");
    expect(dateRule().parse("2028-02-29")).toBe("2028-02-29");
  });
  it.each(["01/15/2027", "2027-13-01", "2027-02-30", "2027-1-5", "soon"])("refuses %s in words", (typed) => {
    expect(message(dateRule().safeParse(typed))).toBe("Enter a date like 2027-01-15.");
  });
});

describe("wholeNumberRule", () => {
  it("takes digits or nothing", () => {
    expect(wholeNumberRule().parse("45")).toBe("45");
    expect(wholeNumberRule().parse("")).toBe("");
  });
  it.each(["-3", "4.5", "forty", "1,000"])("refuses %s in words", (typed) => expect(message(wholeNumberRule().safeParse(typed))).toBe("Enter a whole number, like 45."));
});
