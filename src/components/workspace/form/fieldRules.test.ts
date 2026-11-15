import { describe, expect, it } from "vitest";
import { dateRule, phoneRule, stateRule, wholeNumberRule } from "./fieldRules";

const message = (result: { success: boolean; error?: { issues: { message: string }[] } }) => (result.success ? null : result.error?.issues[0].message);

describe("phoneRule", () => {
  const PHONE_WORDS = "Enter a phone number like (503) 555-0142. An extension can follow, like x12.";
  it.each(["(503) 555-0142", "503-555-0142", "503.555.0142", "+1 503 555 0142", "5035550142", "503 555 0142 x12", "503 555 0142 ext. 345", "+44 20 7946 0958", "555-0142", "5550142", "123456789012345", "503" + " ".repeat(40) + "5550142"])(
    "takes %s",
    (typed) => expect(phoneRule().safeParse(typed).success).toBe(true),
  );
  it.each(["call me", "555014", "1234567890123456", "503" + " ".repeat(41) + "5550142", "503+555+0142", "(503) 555-0142 ext", "503-555-0142 x1234567", "++15035550142"])(
    "refuses %s in words",
    (typed) => expect(message(phoneRule().safeParse(typed))).toBe(PHONE_WORDS),
  );
  // Catches: a phone the person did not touch being judged again, so an account with an older-format phone could not save another field.
  it("takes the phone the record already had, whatever it looks like, and judges a different one", () => {
    expect(phoneRule("call me").safeParse("call me").success).toBe(true);
    expect(phoneRule("call me").safeParse(" call me ").success).toBe(true);
    expect(message(phoneRule("call me").safeParse("call us"))).toBe(PHONE_WORDS);
    expect(phoneRule("call me").safeParse("555-0142").success).toBe(true);
  });
  it("takes the kept phone when it differs only by spaces at the ends", () => {
    expect(phoneRule(" call me ").safeParse("call me").success).toBe(true);
  });
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
  // Catches: a count too big for the database's integer passing the form and failing as a connection error.
  it("takes up to 2,147,483,647 and refuses more in words", () => {
    expect(wholeNumberRule().parse("2147483647")).toBe("2147483647");
    expect(wholeNumberRule().parse("0002147483647")).toBe("0002147483647");
    for (const typed of ["2147483648", "9999999999", "99999999999999999999"]) {
      expect(message(wholeNumberRule().safeParse(typed))).toBe("Enter a number up to 2,147,483,647.");
    }
  });
});
