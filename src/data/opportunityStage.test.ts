import { describe, expect, it } from "vitest";
import { whatMovesItOn } from "./opportunityStage";

// D-50 says a helper like this is tested through the page that uses it. No page uses it yet (the opportunity's page is CRM-O1.1b), so it is tested
// here, on its own; CRM-O1.1b's page test then covers it again through the page.
describe("whatMovesItOn (D-414)", () => {
  it("says what starts a search that has no intake", () => {
    expect(whatMovesItOn({ stage: "qualifying" })).toBe("Start the quote to move to Intake under way");
  });

  // Break caught: the words of one pipeline stage under Intake under way are used for another (waiting on the review while the prospect has yet to certify).
  it("says what each step of the intake waits on", () => {
    expect(whatMovesItOn({ stage: "intake_under_way", pipelineStatus: "draft", prospectFirstName: "Lucia" })).toBe("Waiting for Lucia to certify");
    expect(whatMovesItOn({ stage: "intake_under_way", pipelineStatus: "submitted" })).toBe("Waiting for the review to finish");
    expect(whatMovesItOn({ stage: "intake_under_way", pipelineStatus: "under_review" })).toBe("Waiting for the review to finish");
    expect(whatMovesItOn({ stage: "intake_under_way", pipelineStatus: "information_requested", prospectFirstName: "Lucia" })).toBe("Waiting for Lucia to answer");
  });

  // Break caught: the name is the prospect's full name or the main contact's when the prospect's is known; "undefined" or a blank reaches the screen.
  it("names the prospect by first name, else the main contact, else the employer", () => {
    const draft = { stage: "intake_under_way", pipelineStatus: "draft" } as const;
    expect(whatMovesItOn({ ...draft, prospectFirstName: "Lucia", mainContactFirstName: "Omar" })).toBe("Waiting for Lucia to certify");
    expect(whatMovesItOn({ ...draft, prospectFirstName: "  ", mainContactFirstName: " Omar " })).toBe("Waiting for Omar to certify");
    expect(whatMovesItOn({ ...draft, prospectFirstName: null, mainContactFirstName: null })).toBe("Waiting for the employer to certify");
    expect(whatMovesItOn({ ...draft })).toBe("Waiting for the employer to certify");
    expect(whatMovesItOn({ stage: "intake_under_way", pipelineStatus: "information_requested" })).toBe("Waiting for the employer to answer");
  });

  it("says what moves the later stages on", () => {
    expect(whatMovesItOn({ stage: "ready_to_send" })).toBe("Send to a PEO to move to In market");
    expect(whatMovesItOn({ stage: "in_market" })).toBe("Waiting for a PEO to quote");
    expect(whatMovesItOn({ stage: "quoted" })).toBe("Mark won or lost when the employer decides");
  });

  // Break caught: a won or lost opportunity is told what to do next (the banner says it, D-414).
  it("says nothing of a won or a lost opportunity", () => {
    expect(whatMovesItOn({ stage: "won" })).toBeNull();
    expect(whatMovesItOn({ stage: "lost" })).toBeNull();
  });

  // Break caught: an intake under way with no known pipeline stage is given the review's words, which may be false.
  it("says nothing rather than guess when the intake's step is not known", () => {
    expect(whatMovesItOn({ stage: "intake_under_way" })).toBeNull();
    expect(whatMovesItOn({ stage: "intake_under_way", pipelineStatus: "quoted" })).toBeNull();
  });
});
