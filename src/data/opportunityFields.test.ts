import { describe, expect, it } from "vitest";
import { OPPORTUNITY_SOURCES, dollarsOf, newOpportunitySchema, suggestedOpportunityName } from "./opportunityFields";

const ok = {
  name: "January 2028 PEO search", target_start: "2028-01-01", employees: "45", main_contact: "", expected_close: "2027-12-10", value: "$7,100", source: "Referral",
  referral_partner: "", owner: "u1", next_step: "",
};
const issues = (v: unknown) => {
  const r = newOpportunitySchema.safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};

describe("suggestedOpportunityName (D-188, D-438)", () => {
  // Catches: the offered name using another month, another year, or another shape than "<Month YYYY> PEO search".
  it("names a search for its start month and year", () => {
    expect(suggestedOpportunityName("2028-01-01")).toBe("January 2028 PEO search");
    expect(suggestedOpportunityName("2027-03-15")).toBe("March 2027 PEO search");
    expect(suggestedOpportunityName("2026-12-31")).toBe("December 2026 PEO search");
  });
  // Catches: a start that is not known giving "undefined PEO search" or an empty name.
  it("is just \"PEO search\" when no start is known or it is not a day", () => {
    expect(suggestedOpportunityName("")).toBe("PEO search");
    expect(suggestedOpportunityName("2028-13-40")).toBe("PEO search");
    expect(suggestedOpportunityName("soon")).toBe("PEO search");
  });
});

describe("OPPORTUNITY_SOURCES (D-439)", () => {
  // Catches: the list the form offers drifting from the story's seven words and their order (the database's copy is held to this one by schemaSync.test.ts).
  it("is the story's list, in its order", () => {
    expect([...OPPORTUNITY_SOURCES]).toEqual(["Referral", "Renewal", "Existing client", "Inbound", "Outbound", "Event", "Other"]);
  });
});

describe("dollarsOf", () => {
  // Catches: the screen's "$7,100" sent as text the database cannot read, a cent dropped, or a blank sent as zero.
  it("reads dollars as typed, with or without a sign, commas or cents", () => {
    expect(dollarsOf("$7,100")).toBe(7100);
    expect(dollarsOf(" 7100.50 ")).toBe(7100.5);
    expect(dollarsOf("0")).toBe(0);
    expect(dollarsOf("")).toBeNull();
    expect(dollarsOf("  ")).toBeNull();
  });
});

describe("newOpportunitySchema (D-438)", () => {
  // Catches: the form taken with no name (the screen marks it Required), or a name of spaces.
  it("requires a name, in words, and trims it", () => {
    expect(issues({ ...ok, name: "   " })).toEqual(["name: Give the opportunity a name."]);
    expect(newOpportunitySchema.parse({ ...ok, name: " X " }).name).toBe("X");
  });
  // Catches: lengths the database refuses reaching it (200 and 2,000).
  it("keeps the name to 200 characters and the next step to 2,000", () => {
    expect(issues({ ...ok, name: "a".repeat(201) })).toEqual(["name: Use 200 characters or fewer."]);
    expect(issues({ ...ok, name: "a".repeat(200) })).toEqual([]);
    expect(issues({ ...ok, next_step: "a".repeat(2001) })).toEqual(["next_step: Use 2,000 characters or fewer."]);
    expect(issues({ ...ok, next_step: "a".repeat(2000) })).toEqual([]);
  });
  // Catches: a date that does not exist, or a count that is not a whole number, taken by the form and refused by the database.
  it("checks the dates and the count", () => {
    expect(issues({ ...ok, target_start: "2028-02-30" })).toEqual(["target_start: Enter a date like 2027-01-15."]);
    expect(issues({ ...ok, expected_close: "tomorrow" })).toEqual(["expected_close: Enter a date like 2027-01-15."]);
    expect(issues({ ...ok, employees: "forty" })).toEqual(["employees: Enter a whole number, like 45."]);
    expect(issues({ ...ok, target_start: "", expected_close: "", employees: "" })).toEqual([]);
  });
  // Catches: a negative or malformed value accepted (the story: dollars, not negative), or the database's trillion limit met as a failed save.
  it("takes the value as dollars, not negative, under a trillion", () => {
    expect(issues({ ...ok, value: "-5" })).toEqual(["value: Enter dollars, like $7,100. A value can't be negative."]);
    expect(issues({ ...ok, value: "lots" })).toEqual(["value: Enter dollars, like $7,100. A value can't be negative."]);
    expect(issues({ ...ok, value: "1.234" })).toEqual(["value: Enter dollars, like $7,100. A value can't be negative."]);
    expect(issues({ ...ok, value: "1000000000000" })).toEqual(["value: Keep the value under a trillion dollars."]);
    expect(issues({ ...ok, value: "" })).toEqual([]);
    expect(issues({ ...ok, value: "0" })).toEqual([]);
  });
  // Catches: a source that is not on the list reaching the database.
  it("takes a source from the list, or none", () => {
    expect(issues({ ...ok, source: "Cold call" })).toEqual(["source: Choose a source from the list."]);
    expect(issues({ ...ok, source: "" })).toEqual([]);
  });
});
