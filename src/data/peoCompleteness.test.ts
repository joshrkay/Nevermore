import { describe, expect, it } from "vitest";
import type { ReviewedDocument } from "./advisor";
import { EMPTY_CHAMBER_DATA } from "./chamberTypes";
import type { PeoRecord } from "./peoCatalog";
import { groupByCompleteness, informationRequestDraft, lastCertifiedVersion, missingLine, peoCompleteness, type CertifiedIntake, type PeoCompleteness } from "./peoCompleteness";
import type { RequirementProfile } from "./peoProfiles";

const profile = (over: Partial<RequirementProfile> = {}): RequirementProfile => ({
  version: 3,
  neededToQuote: [],
  neededBeforeSigning: [],
  censusLayout: null,
  documents: [],
  rules: { minHeadcount: null, statesServed: null, excludedIndustries: null, excludedClassCodes: null, minEnrolmentPercent: null },
  extraQuestions: [],
  sources: {},
  publishedAt: "2026-11-01T00:00:00Z",
  ...over,
});

const confirmed = { status: "confirmed" as const, source: { kind: "prospect_edit" as const }, updated_at: "2026-10-01T00:00:00Z" };

const intake = (over: Partial<CertifiedIntake> = {}): CertifiedIntake => ({
  data: { ...EMPTY_CHAMBER_DATA, company_name: "Signed Co", pay_frequency: "Bi-weekly", states: ["CA"], payroll_vendor: "Gusto" },
  provenance: { company_name: confirmed, pay_frequency: confirmed, states: confirmed, payroll_vendor: confirmed },
  verified: new Set(),
  ...over,
});

const doc = (over: Partial<ReviewedDocument> = {}): ReviewedDocument => ({
  id: "d1", file_name: "loss-runs.pdf", file_size: "80 KB", category: "workers_comp_loss_runs", status: "extracted",
  storage_path: "p/loss-runs.pdf", created_at: "2026-10-01T00:00:00Z", scan_verdict: "clean", certification: "certified", ...over,
});

describe("peoCompleteness: whether the last certified version holds everything a PEO needs to quote", () => {
  it("is complete when every answer the PEO needs to quote is held and settled and every document it requires is on file", () => {
    const p = profile({
      neededToQuote: ["company_name", "states", "payroll_vendor"],
      documents: [{ category: "workers_comp_loss_runs", description: "Three years of loss runs" }],
    });
    expect(peoCompleteness(intake(), [doc()], p)).toEqual({ complete: true, toQuote: [], beforeSigning: [] });
  });

  it("lists each answer it needs to quote that isn't held, or is held but still an open item, with why, in the profile's order", () => {
    const p = profile({ neededToQuote: ["payroll_vendor", "hris_system", "current_carrier", "employee_count", "census", "company_name"] });
    const held = intake({
      data: { ...intake().data, current_carrier: "Aetna", employee_count: 12 },
      provenance: {
        ...intake().provenance,
        payroll_vendor: { ...confirmed, status: "inferred" },
        current_carrier: { ...confirmed, status: "conflicting" },
        employee_count: { ...confirmed, status: "incomplete" },
      },
    });
    const c = peoCompleteness(held, [], p);
    expect(c.complete).toBe(false);
    expect(c.toQuote).toEqual([
      { kind: "answer", field: "payroll_vendor", label: "Payroll vendor", reason: "Please confirm" },
      { kind: "answer", field: "hris_system", label: "HRIS system", reason: "Not provided" },
      { kind: "answer", field: "current_carrier", label: "Current carrier", reason: "Conflicting answers" },
      { kind: "answer", field: "employee_count", label: "Employee count", reason: "Incomplete" },
      { kind: "answer", field: "census", label: "Employee census", reason: "Document needed" },
    ]);
  });

  it("counts an answer the prospect marked as not applying, or an advisor verified, as settled, and one they don't know yet as missing", () => {
    const p = profile({ neededToQuote: ["current_carrier", "payroll_vendor", "hris_system"] });
    const c = peoCompleteness(intake({
      provenance: {
        ...intake().provenance,
        current_carrier: { ...confirmed, status: "not_applicable" },
        payroll_vendor: { ...confirmed, status: "inferred" },
        hris_system: { ...confirmed, status: "unknown" },
      },
      verified: new Set(["payroll_vendor"]),
    }), [], p);
    expect(c.toQuote).toEqual([{ kind: "answer", field: "hris_system", label: "HRIS system", reason: "Prospect to provide" }]);
  });

  it("lists the answers needed only before signing apart, and never counts them", () => {
    const p = profile({ neededToQuote: ["company_name"], neededBeforeSigning: ["hris_system", "payroll_vendor"] });
    expect(peoCompleteness(intake(), [], p)).toEqual({
      complete: true,
      toQuote: [],
      beforeSigning: [{ kind: "answer", field: "hris_system", label: "HRIS system", reason: "Not provided" }],
    });
  });

  it("needs each document the profile lists on file: certified, of that kind as certified, and through the virus check", () => {
    const p = profile({ documents: [{ category: "workers_comp_loss_runs", description: "Three years of loss runs" }] });
    const missing = (documents: ReviewedDocument[]) => peoCompleteness(intake(), documents, p).toQuote;
    const item = (reason: string) => [{ kind: "document", category: "workers_comp_loss_runs", label: "Workers' comp loss runs", description: "Three years of loss runs", reason }];
    expect(missing([doc()])).toEqual([]);
    // A file kept without a certification record, from before certifications kept their list, counts.
    expect(missing([doc({ certification: undefined })])).toEqual([]);
    // Unreadable is still on file: the advisor has it.
    expect(missing([doc({ status: "unreadable" })])).toEqual([]);
    expect(missing([doc({ scan_verdict: "skipped" })])).toEqual([]);
    // Certified as loss runs and re-categorised since: the certified version has loss runs.
    expect(missing([doc({ category: "other", certifiedCategory: "workers_comp_loss_runs" })])).toEqual([]);
    expect(missing([doc({ category: "workers_comp_loss_runs", certifiedCategory: "other" })])).toEqual(item("Not uploaded"));
    expect(missing([])).toEqual(item("Not uploaded"));
    expect(missing([doc({ category: "payroll_report" })])).toEqual(item("Not uploaded"));
    expect(missing([doc({ certification: "removed" })])).toEqual(item("Not uploaded"));
    expect(missing([doc({ status: "uploading", scan_verdict: "pending" })])).toEqual(item("Not uploaded"));
    expect(missing([doc({ certification: "added" })])).toEqual(item("Uploaded after certifying"));
    expect(missing([doc({ scan_verdict: "pending" })])).toEqual(item("Still being checked for viruses"));
    expect(missing([doc({ scan_verdict: "infected" })])).toEqual(item("Blocked by the virus check"));
    expect(missing([doc({ scan_verdict: "failed" })])).toEqual(item("Couldn't be checked for viruses"));
    // One file on file is enough, whatever else of that kind is held up.
    expect(missing([doc({ id: "d2", scan_verdict: "infected" }), doc()])).toEqual([]);
    // Of several held up, the one nearest to being on file says why.
    expect(missing([doc({ id: "d2", scan_verdict: "infected" }), doc({ id: "d3", scan_verdict: "pending" })])).toEqual(item("Still being checked for viruses"));
  });

  it("is not complete while a document it requires is missing, and lists answers before documents", () => {
    const p = profile({ neededToQuote: ["hris_system"], documents: [{ category: "benefits_summary", description: "Current plan summary" }] });
    const c = peoCompleteness(intake(), [doc()], p);
    expect(c.complete).toBe(false);
    expect(c.toQuote.map((i) => i.kind)).toEqual(["answer", "document"]);
  });
});

describe("groupByCompleteness: every listed PEO, by whether the certified version is complete for it", () => {
  const listed = (name: string, p: RequirementProfile | null, over: Partial<PeoRecord> = {}): PeoRecord => ({ name, listed: true, lastVerified: null, profile: p, ...over });
  const needsHris = profile({ neededToQuote: ["hris_system"] });

  it("groups complete, then something missing, then no profile yet, alphabetical in each, leaving out PEOs not listed", () => {
    const groups = groupByCompleteness(intake(), [], [
      listed("trinet", needsHris),
      listed("Insperity", null),
      listed("Justworks", profile()),
      listed("ADP TotalSource", needsHris),
      listed("Paychex", null, { listed: false }),
      listed("Oasis", profile(), { listed: false }),
      listed("Bambee", null),
      listed("Acme PEO", profile({ neededToQuote: ["company_name"] })),
    ]);
    expect(groups.complete.map((e) => e.peo.name)).toEqual(["Acme PEO", "Justworks"]);
    expect(groups.missing.map((e) => e.peo.name)).toEqual(["ADP TotalSource", "trinet"]);
    expect(groups.missing[0].completeness.toQuote).toEqual([{ kind: "answer", field: "hris_system", label: "HRIS system", reason: "Not provided" }]);
    expect(groups.noProfile.map((p) => p.name)).toEqual(["Bambee", "Insperity"]);
  });
});

describe("missingLine: what is missing for a PEO, in one line", () => {
  const answer = { kind: "answer" as const, field: "hris_system" as const, label: "HRIS system", reason: "Not provided" };
  const document = { kind: "document" as const, category: "benefits_summary" as const, label: "Benefits summary", description: "Plan summary", reason: "Not uploaded" };
  const line = (toQuote: PeoCompleteness["toQuote"], beforeSigning: PeoCompleteness["beforeSigning"] = []) => missingLine({ complete: toQuote.length === 0, toQuote, beforeSigning });

  it("counts the answers and documents missing to quote, and then those needed only before signing", () => {
    expect(line([answer, answer, answer, document])).toBe("3 answers and 1 document missing");
    expect(line([answer])).toBe("1 answer missing");
    expect(line([document, document])).toBe("2 documents missing");
    expect(line([answer], [answer, answer])).toBe("1 answer missing · 2 answers needed only before signing");
    expect(line([])).toBe("Everything it needs to quote is on file");
    expect(line([], [answer])).toBe("Everything it needs to quote is on file · 1 answer needed only before signing");
  });
});

// The prospect never sees which PEOs a submission goes to (GLOSSARY.md, Quote request), so the draft names none.
describe("informationRequestDraft: what a PEO still needs, as a draft request to the prospect, naming no PEO", () => {
  const answer = (field: "hris_system" | "payroll_vendor" | "census", label: string) => ({ kind: "answer" as const, field, label, reason: "Not provided" });
  const document = (description: string) => ({ kind: "document" as const, category: "benefits_summary" as const, label: "Benefits summary", description, reason: "Not uploaded" });

  it("names the answers missing to quote, then those needed before signing, and writes the documents into the message", () => {
    const draft = informationRequestDraft({
      complete: false,
      toQuote: [answer("hris_system", "HRIS system"), answer("census", "Employee census"), document("Current plan summary")],
      beforeSigning: [answer("payroll_vendor", "Payroll vendor")],
    });
    expect(draft.fields).toEqual(["hris_system", "census", "payroll_vendor"]);
    expect(draft.message).toBe([
      "We need a few more things from you to get a quote.",
      "",
      "Please upload these on the Upload tab of your intake:",
      "- Benefits summary: Current plan summary",
      "",
      "Please also answer or confirm the answers this request is about.",
    ].join("\n"));
  });

  it("leaves out what it doesn't need: no document list with none missing, no answers line with none", () => {
    expect(informationRequestDraft({ complete: false, toQuote: [answer("hris_system", "HRIS system")], beforeSigning: [] }).message)
      .toBe("We need a few more things from you to get a quote.\n\nPlease answer or confirm the answers this request is about.");
    const docsOnly = informationRequestDraft({ complete: false, toQuote: [document("Plan summary")], beforeSigning: [] });
    expect(docsOnly.fields).toEqual([]);
    expect(docsOnly.message).toBe("We need a few more things from you to get a quote.\n\nPlease upload these on the Upload tab of your intake:\n- Benefits summary: Plan summary");
  });

  it("stays within what a request can hold, saying how many documents it left out", () => {
    const many = Array.from({ length: 30 }, (_, i) => document(`Document ${i + 1} ${"x".repeat(60)}`));
    const draft = informationRequestDraft({ complete: false, toQuote: many, beforeSigning: [] });
    expect(draft.message.length).toBeLessThanOrEqual(1000);
    const listedCount = draft.message.split("\n").filter((l) => l.startsWith("- Benefits summary")).length;
    expect(listedCount).toBeGreaterThan(5);
    expect(draft.message.endsWith(`- and ${30 - listedCount} more documents`)).toBe(true);
  });
});

describe("lastCertifiedVersion: what each PEO's list is built from", () => {
  const current = { ...intake().data, company_name: "Changed Co" };
  const base = { certified: true, data: intake().data, provenance: intake().provenance, documents: [doc()], signed: null, currentVersion: 2 };
  const verified = new Set(["payroll_vendor"]);

  it("is the certified answers, their status and documents while the certification stands", () => {
    expect(lastCertifiedVersion(base, verified)).toEqual({
      intake: { data: intake().data, provenance: intake().provenance, verified }, documents: [doc()], version: 2, changedSince: false,
    });
  });

  it("is what was certified when the prospect has changed answers since, never their answers now", () => {
    const signed = { data: intake().data, signedAt: "2026-10-01T00:00:00Z", provenance: intake().provenance, documents: [doc({ certification: "certified" })] };
    expect(lastCertifiedVersion({ ...base, certified: false, data: current, provenance: {}, documents: [doc({ certification: undefined })], signed }, verified)).toEqual({
      intake: { data: intake().data, provenance: intake().provenance, verified }, documents: signed.documents, version: 2, changedSince: true,
    });
  });

  it("is nothing before the first certification", () => {
    expect(lastCertifiedVersion({ ...base, certified: false, signed: null, currentVersion: null }, verified)).toBeNull();
  });
});

