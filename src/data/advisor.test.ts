import { Blob as NodeBlob } from "node:buffer";
import { describe, expect, it } from "vitest";
import { EMPTY_CHAMBER_DATA } from "./chamberTypes";
import {
  ADVISOR_SETTABLE_STATUSES,
  applyAdvisorReview,
  completenessOf,
  formatStates,
  manuscriptStoragePath,
  matchesSearch,
  parseCorrection,
  PIPELINE_STATUSES,
  prospectStatusMessage,
  referenceOf,
  reviewMap,
  sha256Hex,
  type FieldReview,
} from "./advisor";
import type { ProvenanceMap } from "./provenance";

const review = (over: Partial<FieldReview> & Pick<FieldReview, "field">): FieldReview => ({
  review_state: null,
  has_correction: false,
  corrected_value: null,
  reason: null,
  updated_by_email: "adv@example.com",
  updated_at: "2026-10-22T00:00:00Z",
  ...over,
});

describe("pipeline statuses", () => {
  it("covers every status the workflow needs", () => {
    expect(PIPELINE_STATUSES).toEqual([
      "draft", "submitted", "under_review", "information_requested", "sent_to_carrier", "quoted", "won", "lost", "archived",
    ]);
  });

  it("doesn't let advisors move a submission back to draft", () => {
    expect(ADVISOR_SETTABLE_STATUSES).not.toContain("draft");
  });

  it("only has prospect wording for statuses we share", () => {
    expect(prospectStatusMessage("under_review")).toMatch(/reviewing/);
    for (const internal of ["draft", "sent_to_carrier", "quoted", "won", "lost", "archived", "bogus", null]) {
      expect(prospectStatusMessage(internal)).toBeNull();
    }
  });
});

describe("completenessOf", () => {
  it("puts missing required items first", () => {
    const c = completenessOf({ missing_required: ["Pay frequency"], open_fields: 2, flagged_fields: 0 });
    expect(c.state).toBe("missing_required");
    expect(c.detail).toBe("Pay frequency");
  });

  it("needs review while fields are unconfirmed or flagged", () => {
    const c = completenessOf({ missing_required: [], open_fields: 1, flagged_fields: 2 });
    expect(c).toMatchObject({ state: "needs_review", detail: "1 unconfirmed, 2 flagged by an advisor" });
  });

  it("is complete otherwise", () => {
    expect(completenessOf({ missing_required: [], open_fields: 0, flagged_fields: 0 }).state).toBe("complete");
  });
});

describe("applyAdvisorReview", () => {
  const data = { ...EMPTY_CHAMBER_DATA, company_name: "Acme", employee_count: 12, states: ["CA"] };
  const provenance: ProvenanceMap = {
    company_name: { status: "inferred", source: { kind: "transcript", message_id: "m1" }, updated_at: "x" },
  };

  it("applies a correction only once its field is verified, without touching the prospect's data", () => {
    const reviews = reviewMap([
      review({ field: "company_name", review_state: "verified", has_correction: true, corrected_value: "Acme LLC", reason: "W-9" }),
      review({ field: "employee_count", review_state: "follow_up", has_correction: true, corrected_value: 14, reason: "payroll" }),
    ]);
    const packet = applyAdvisorReview(data, provenance, reviews);
    expect(packet.data.company_name).toBe("Acme LLC");
    expect(packet.data.employee_count).toBe(12);
    expect(packet.corrections).toEqual([
      { field: "company_name", label: "Company legal name", prospectValue: "Acme", advisorValue: "Acme LLC", reason: "W-9" },
    ]);
    expect(packet.followUps).toEqual(["Employee count — advisor follow-up needed"]);
    expect(packet.provenance.company_name?.status).toBe("confirmed");
    expect(data.company_name).toBe("Acme");
    expect(provenance.company_name?.status).toBe("inferred");
  });

  it("lists fields an advisor marked incomplete as open items", () => {
    const packet = applyAdvisorReview(data, {}, reviewMap([review({ field: "census", review_state: "incomplete" })]));
    expect(packet.followUps).toEqual(["Employee census — marked incomplete by an advisor"]);
  });

  it("reads a census review stored under the roster's old name, preferring a current one", () => {
    const legacy = review({ field: "employees" as never, review_state: "incomplete" });
    expect(reviewMap([legacy]).census?.review_state).toBe("incomplete");
    expect(reviewMap([review({ field: "census", review_state: "verified" }), legacy]).census?.review_state).toBe("verified");
  });

  it("ignores a stored correction that isn't a valid value for its field", () => {
    const reviews = reviewMap([review({ field: "employee_count", review_state: "verified", has_correction: true, corrected_value: "lots" })]);
    const packet = applyAdvisorReview(data, {}, reviews);
    expect(packet.data.employee_count).toBe(12);
    expect(packet.corrections).toEqual([]);
  });
});

describe("parseCorrection", () => {
  it("parses each kind of field", () => {
    expect(parseCorrection("company_name", "  Acme LLC ")).toEqual({ value: "Acme LLC" });
    expect(parseCorrection("employee_count", "14")).toEqual({ value: 14 });
    expect(parseCorrection("has_401k", "no")).toEqual({ value: false });
    expect(parseCorrection("states", "CA, TX")).toEqual({ value: ["CA", "TX"] });
  });

  it("refuses values that don't fit the field", () => {
    expect(parseCorrection("employee_count", "about 14")).toBeNull();
    expect(parseCorrection("has_401k", "maybe")).toBeNull();
    expect(parseCorrection("census", "[]")).toBeNull();
  });
});

describe("manuscript storage", () => {
  it("files each version under its submission", () => {
    expect(manuscriptStoragePath("s-1", 3, "abc")).toBe("s-1/v3-abc.pdf");
  });

  it("hashes the file", async () => {
    // jsdom's Blob predates arrayBuffer(); browsers and Node have it.
    expect(await sha256Hex(new NodeBlob(["abc"]) as unknown as Blob)).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("referenceOf", () => {
  it("uses the certified file id", () => {
    expect(referenceOf({ session_id: "a1b2c3d4-0000-0000-0000-000000000000", file_id: "EAA-2026-TEST", created_at: "2026-03-01T12:00:00Z" })).toBe("EAA-2026-TEST");
  });

  it("derives the same id the detail page shows for an intake that isn't certified yet", () => {
    expect(referenceOf({ session_id: "a1b2c3d4-0000-0000-0000-000000000000", file_id: null, created_at: "2026-03-01T12:00:00Z" })).toBe("EAA-2026-A1B2C3D4");
  });
});

describe("matchesSearch", () => {
  const row = {
    session_id: "a1b2c3d4-0000-0000-0000-000000000000",
    company_name: "Acme Holdings LLC",
    contact_name: "Pat Prospect",
    file_id: "EAA-2026-A1B2C3D4",
    created_at: "2026-03-01T12:00:00Z",
  };

  it("matches everything when there is no search", () => {
    expect(matchesSearch(row, "")).toBe(true);
    expect(matchesSearch(row, "   ")).toBe(true);
  });

  it("finds a row by company, contact or reference, ignoring case", () => {
    expect(matchesSearch(row, "acme")).toBe(true);
    expect(matchesSearch(row, "PROSPECT")).toBe(true);
    expect(matchesSearch(row, "eaa-2026-a1b2")).toBe(true);
    expect(matchesSearch(row, "a1b2c3d4")).toBe(true);
  });

  it("needs every word to match, in any of the three fields", () => {
    expect(matchesSearch(row, "acme pat")).toBe(true);
    expect(matchesSearch(row, "acme  a1b2")).toBe(true);
    expect(matchesSearch(row, "acme nobody")).toBe(false);
  });

  it("matches a draft by the reference the app derives for it", () => {
    expect(matchesSearch({ ...row, file_id: null }, "EAA-2026-A1B2C3D4")).toBe(true);
  });

  it("copes with missing company and contact", () => {
    const blank = { ...row, company_name: null, contact_name: null };
    expect(matchesSearch(blank, "acme")).toBe(false);
    expect(matchesSearch(blank, "a1b2")).toBe(true);
  });

  it("doesn't search anything a row doesn't show, such as the session id's other digits", () => {
    expect(matchesSearch(row, "0000-0000")).toBe(false);
  });
});

describe("formatStates", () => {
  it("is null when no state is known", () => {
    expect(formatStates([])).toBeNull();
  });

  it("lists a short footprint in full", () => {
    expect(formatStates(["CA", "NY", "TX"])).toBe("CA, NY, TX");
  });

  it("lists a footprint exactly as long as the limit in full, without a count", () => {
    expect(formatStates(["AZ", "CA", "CO", "FL"])).toBe("AZ, CA, CO, FL");
  });

  it("summarises a long one", () => {
    expect(formatStates(["AZ", "CA", "CO", "FL", "NY", "TX", "WA"])).toBe("AZ, CA, CO, FL +3 more");
  });
});
