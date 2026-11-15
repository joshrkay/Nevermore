import type { PipelineStatus } from "@/data/advisor";

// What would move an opportunity's stage on, in the words under the stage (CRM-O1.2, D-414). Worked out in the browser from the stage the database
// gave (opportunity_stage(), D-408) and, while the intake is under way, the submission's pipeline stage, which says what the intake waits on. The
// words are guidance, never a button: what a later epic builds stays off the screen until it is built (D-402).

/** The stages the database gives an opportunity (D-415 names them on screen: Qualifying, Intake under way, Ready to send, In market, Quoted, Won, Lost). */
export type OpportunityStage = "qualifying" | "intake_under_way" | "ready_to_send" | "in_market" | "quoted" | "won" | "lost";

export type WhatMovesItOnInput = {
  stage: OpportunityStage;
  /** The submission's pipeline stage; needed while the intake is under way, which is where it says what the intake waits on. */
  pipelineStatus?: PipelineStatus | null;
  /** The prospect's first name, as the intake gives it. */
  prospectFirstName?: string | null;
  /** The opportunity's main contact's first name, used when the prospect's is not known. */
  mainContactFirstName?: string | null;
};

const clean = (name: string | null | undefined) => (name ?? "").trim();

/**
 * One line, or null when there is nothing to say: a won or a lost opportunity (the banner says it), and an intake under way whose step is not known
 * (better no line than one that may be false). <name> is the prospect's first name, else the main contact's, else "the employer".
 */
export function whatMovesItOn({ stage, pipelineStatus, prospectFirstName, mainContactFirstName }: WhatMovesItOnInput): string | null {
  const name = clean(prospectFirstName) || clean(mainContactFirstName) || "the employer";
  switch (stage) {
    case "qualifying":
      return "Start the quote to move to Intake under way";
    case "intake_under_way":
      switch (pipelineStatus) {
        case "draft":
          return `Waiting for ${name} to certify`;
        case "submitted":
        case "under_review":
          return "Waiting for the review to finish";
        case "information_requested":
          return `Waiting for ${name} to answer`;
        default:
          return null;
      }
    case "ready_to_send":
      return "Send to a PEO to move to In market";
    case "in_market":
      return "Waiting for a PEO to quote";
    case "quoted":
      return "Mark won or lost when the employer decides";
    case "won":
    case "lost":
      return null;
  }
}
