import { describe, expect, it } from "vitest";
import { answeredBy, outstandingRequestedFields, parseInformationRequest } from "./informationRequest";
import type { ChamberSubmission } from "./manuscript";

const raw = { message: "  Please confirm your pay frequency.  ", fields: ["pay_frequency", "employees", "census", "nonsense", 3], requested_at: "2026-11-05T12:00:00+00:00" };

describe("parseInformationRequest", () => {
  it("reads the database's answer: the message, known fields each once (the census's older name as the census), and when", () => {
    expect(parseInformationRequest(raw)).toEqual({
      message: "Please confirm your pay frequency.",
      fields: ["pay_frequency", "census"],
      extraQuestions: [],
      requestedAt: "2026-11-05T12:00:00+00:00",
    });
  });

  it("reads the PEOs' own questions it names, by PEO, key and wording, leaving out anything else", () => {
    const drives = { peo_id: 5, key: "vehicles", question: "Do employees drive for work?" };
    expect(parseInformationRequest({ ...raw, extra_questions: [drives, { peo_id: "5", key: "x", question: "y" }, null] })?.extraQuestions).toEqual([drives]);
  });

  it("is null for no request, or anything that isn't one", () => {
    expect(parseInformationRequest(null)).toBeNull();
    expect(parseInformationRequest([])).toBeNull();
    expect(parseInformationRequest({ ...raw, message: "  " })).toBeNull();
    expect(parseInformationRequest({ ...raw, requested_at: "soon" })).toBeNull();
    expect(parseInformationRequest({ ...raw, fields: "pay_frequency" })).toEqual(expect.objectContaining({ fields: [] }));
  });
});

describe("answeredBy", () => {
  const request = parseInformationRequest(raw)!;
  const submission = (certified_at: string) => ({ signer_name: "Jo", signed_at: certified_at, certified_at }) as unknown as ChamberSubmission;

  it("is answered by a certification after the request, not one before it, nor a withdrawn one", () => {
    expect(answeredBy(request, { status: "certified", submission: submission("2026-11-05T12:30:00Z") })).toBe(true);
    expect(answeredBy(request, { status: "certified", submission: submission("2026-11-04T12:00:00Z") })).toBe(false);
    expect(answeredBy(request, { status: "stale", submission: submission("2026-11-05T12:30:00Z") })).toBe(false);
    expect(answeredBy(request, { status: "none" })).toBe(false);
  });
});

describe("outstandingRequestedFields", () => {
  const request = parseInformationRequest({ ...raw, fields: ["pay_frequency", "hq_state", "states"] })!;

  it("keeps the fields whose status hasn't changed since the request", () => {
    expect(outstandingRequestedFields(request, {
      pay_frequency: { status: "confirmed", source: { kind: "prospect_edit" }, updated_at: "2026-11-05T12:00:01Z" },
      hq_state: { status: "inferred", source: { kind: "prospect_edit" }, updated_at: "2026-11-05T11:59:59Z" },
    })).toEqual(["hq_state", "states"]);
  });

  it("is nothing without a request", () => {
    expect(outstandingRequestedFields(null, {})).toEqual([]);
  });
});
