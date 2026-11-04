import { Blob as NodeBlob } from "node:buffer";
import { describe, expect, it } from "vitest";
import { EMPTY_CHAMBER_DATA } from "./chamberTypes";
import {
  ADVISOR_SETTABLE_STATUSES,
  applyAdvisorReview,
  completenessOf,
  formatStates,
  isCurrentVersion,
  isStaleRefusal,
  manuscriptStoragePath,
  parseCorrection,
  PIPELINE_STATUSES,
  prospectStatusAfter,
  reconcileDocuments,
  prospectStatusMessage,
  referenceOf,
  reviewMap,
  sha256Hex,
  verifiedFieldsOf,
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

  it("leaves what else was heard for a field as it is when verifying it", () => {
    const heard = [{ value: "Acme Holdings", source: { kind: "document" as const, document_id: "d1" } }];
    const packet = applyAdvisorReview(data, { company_name: { ...provenance.company_name!, also_heard: heard } }, reviewMap([review({ field: "company_name", review_state: "verified" })]));
    expect(packet.provenance.company_name).toMatchObject({ status: "confirmed", also_heard: heard });
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

describe("verifiedFieldsOf", () => {
  it("names the fields marked verified, the census under its current name, as the prospect is told them", () => {
    const reviews = reviewMap([
      review({ field: "company_name", review_state: "verified" }),
      review({ field: "pay_frequency", review_state: "follow_up" }),
      review({ field: "states", review_state: null }),
      review({ field: "employees" as never, review_state: "verified" }),
    ]);
    expect([...verifiedFieldsOf(reviews)].sort()).toEqual(["census", "company_name"]);
    expect(verifiedFieldsOf({}).size).toBe(0);
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

describe("isStaleRefusal", () => {
  it("is the database's refusal of a change based on answers, a review or a version that moved on", () => {
    expect(isStaleRefusal({ code: "PT409", message: "The prospect certified their intake again" })).toBe(true);
  });

  it("is nothing else", () => {
    for (const err of [{ code: "42501" }, { code: "P0002" }, new Error("Network request failed"), null, undefined, "PT409"]) {
      expect(isStaleRefusal(err)).toBe(false);
    }
  });
});

describe("prospectStatusAfter", () => {
  const h = (...statuses: string[]) => statuses.map((to_status) => ({ to_status }));

  it("shows a shared status as it is", () => {
    expect(prospectStatusAfter("under_review", h("submitted"))).toBe("under_review");
    expect(prospectStatusAfter("information_requested", h("under_review"))).toBe("information_requested");
  });

  it("leaves the last shared status in place for an internal one", () => {
    expect(prospectStatusAfter("lost", h("lost", "under_review", "submitted", "draft"))).toBe("under_review");
  });

  it("never leaves the prospect being asked for information once the advisor has moved on", () => {
    expect(prospectStatusAfter("sent_to_carrier", h("information_requested", "submitted"))).toBe("under_review");
  });

  it("is nothing when nothing was ever shared", () => {
    expect(prospectStatusAfter("archived", h("draft"))).toBeNull();
  });
});

describe("reconcileDocuments", () => {
  const doc = (id: string, over: Record<string, string> = {}) => ({
    id, file_name: `${id}.pdf`, file_size: "1 KB", category: "other", status: "uploaded",
    storage_path: `u/s/${id}.pdf`, created_at: `2026-10-0${id.slice(-1)}T00:00:00Z`, ...over,
  });

  it("leaves the live list as it is when there's no certified list", () => {
    expect(reconcileDocuments([doc("d1")], undefined)).toEqual([doc("d1")]);
  });

  it("marks certified, removed and added documents, newest first", () => {
    const out = reconcileDocuments([doc("d1"), doc("d3")], [doc("d1"), doc("d2")]);
    expect(out.map((d) => [d.id, d.certification])).toEqual([["d3", "added"], ["d2", "removed"], ["d1", "certified"]]);
    // A removed document keeps what it was certified with, so its kept file can still be opened.
    expect(out.find((d) => d.id === "d2")).toMatchObject({ storage_path: "u/s/d2.pdf", file_name: "d2.pdf" });
  });

  it("says what a certified document was certified as, when it has changed since", () => {
    const [d] = reconcileDocuments([doc("d1", { category: "other", file_name: "new.pdf" })], [doc("d1", { category: "employee_census" })]);
    expect(d).toMatchObject({ certification: "certified", category: "other", certifiedCategory: "employee_census", certifiedFileName: "d1.pdf" });
    const [same] = reconcileDocuments([doc("d1")], [doc("d1")]);
    expect(same).not.toHaveProperty("certifiedCategory");
    expect(same).not.toHaveProperty("certifiedFileName");
  });

  it("ignores entries in the certified list it can't use", () => {
    expect(reconcileDocuments([], [null, "x", { id: 1 }, { id: "d9" }, doc("d2")]).map((d) => d.id)).toEqual(["d2"]);
  });
});

describe("reconcileDocuments: a certified document is the certified one only with the certified file", () => {
  const doc = (over: Record<string, string | null> = {}) => ({
    id: "d1", file_name: "payroll.pdf", file_size: "10 KB", category: "payroll_report", status: "uploaded",
    storage_path: "u/s/orig.pdf", created_at: "2026-10-01T00:00:00Z", file_sha256: "1".repeat(64), ...over,
  });

  it("shows a row re-created under the same id with another file as the certified one removed and a new one added", () => {
    const out = reconcileDocuments([doc({ storage_path: "u/s/swapped.pdf", file_sha256: "2".repeat(64) })], [doc()]);
    expect(out.map((d) => [d.certification, d.storage_path])).toEqual([["removed", "u/s/orig.pdf"], ["added", "u/s/swapped.pdf"]]);
  });

  it("does the same when only the bytes differ", () => {
    const out = reconcileDocuments([doc({ file_sha256: "2".repeat(64) })], [doc()]);
    expect(out.map((d) => d.certification)).toEqual(["removed", "added"]);
  });

  it("keeps a document restored under its id with the same file as the certified one", () => {
    expect(reconcileDocuments([doc()], [doc()]).map((d) => d.certification)).toEqual(["certified"]);
    // A hash missing on either side doesn't count as a difference.
    expect(reconcileDocuments([doc({ file_sha256: null })], [doc()]).map((d) => d.certification)).toEqual(["certified"]);
  });
});

describe("isCurrentVersion", () => {
  const submission = { certified_at: "2026-10-01T12:00:05.123456+00:00", signed_at: "2026-10-01T12:00:00Z", data_sha256: "h" };
  const v = { certified_at: "2026-10-01T12:00:05.123456+00:00", certified_signed_at: "2026-10-01T12:00:00+00:00", certified_data_hash: "h" };

  it("is current when built from this certification, whatever the timestamp format", () => {
    expect(isCurrentVersion(v, submission)).toBe(true);
  });

  it("isn't when the prospect certified again", () => {
    expect(isCurrentVersion(v, { ...submission, certified_at: "2026-10-02T12:00:05+00:00" })).toBe(false);
    expect(isCurrentVersion(v, { ...submission, data_sha256: "other" })).toBe(false);
    expect(isCurrentVersion(v, null)).toBe(false);
  });

  it("matches a version recorded before certified_at existed by its signing time and data", () => {
    expect(isCurrentVersion({ ...v, certified_at: null }, submission)).toBe(true);
    expect(isCurrentVersion({ ...v, certified_at: null }, { ...submission, signed_at: "2026-10-02T12:00:00Z" })).toBe(false);
  });
});
