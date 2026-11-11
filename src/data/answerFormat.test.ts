import { describe, expect, it } from "vitest";
import { formatAnswer, formatFein, maskFein } from "./answerFormat";

describe("how an answer reads (K-1.1)", () => {
  it("writes a FEIN the way a FEIN is written", () => {
    expect(formatFein("841234567")).toBe("84-1234567");
  });

  it("masks a FEIN to its last four digits for everyone who doesn't need all nine", () => {
    expect(maskFein("841234567")).toBe("**-***4567");
  });

  it("shows each answer as a person would write it", () => {
    expect(formatAnswer("fein", "841234567")).toBe("84-1234567");
    expect(formatAnswer("entity_type", "s_corporation")).toBe("S corporation");
    expect(formatAnswer("entity_type", "llc")).toBe("LLC");
    expect(formatAnswer("year_founded", 2014)).toBe("2014");
    // K-1.2: a NAICS code reads with its industry's title.
    expect(formatAnswer("naics_code", "541430")).toBe("541430 · Graphic Design Services");
    expect(formatAnswer("entities", [{ legal_name: "Meridian Creative LLC", fein: "841234567" }, { legal_name: "Meridian Studios Inc" }, { fein: "841234568" }]))
      .toBe("Meridian Creative LLC (FEIN 84-1234567); Meridian Studios Inc; FEIN 84-1234568");
  });

  it("leaves every other answer as it was shown before", () => {
    expect(formatAnswer("company_name", "Acme")).toBe("Acme");
    expect(formatAnswer("has_401k", false)).toBe("No");
    expect(formatAnswer("states", ["CA", "TX"])).toBe("CA, TX");
    expect(formatAnswer("fein", null)).toBe("—");
    expect(formatAnswer("entities", [])).toBe("—");
  });
});
