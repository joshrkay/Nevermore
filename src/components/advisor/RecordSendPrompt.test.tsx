import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RecordSendPrompt from "./RecordSendPrompt";

vi.mock("@/lib/advisorApi", () => ({ recordQuoteSend: vi.fn() }));
vi.mock("@/lib/certificationCheck", () => ({ unchangedSinceOpened: vi.fn().mockResolvedValue(true) }));

const prompt = (status: string) =>
  render(
    <RecordSendPrompt sessionId="s1" peo="TriNet" stage="sent_to_carrier" builtFrom={{ sessionId: "s1", status: "certified", dataSha256: "h", version: 1 }}
      existing={{ status, sent_on: "2026-11-10" }} onRecorded={vi.fn()} onClose={vi.fn()} />,
  );

// N-1.2. Break caught: an agent who emailed the answer to a PEO's question from their own mail, with no way to record that send because the PEO's quote request
// is no longer "sent"; recording it is what returns Question open to Sent (advisor_record_quote_send).
describe("RecordSendPrompt: recording a send again", () => {
  it("is offered while the PEO is Sent, Acknowledged or has a question open", () => {
    for (const status of ["sent", "acknowledged", "question_open"]) {
      const { unmount } = prompt(status);
      expect(screen.getByRole("button", { name: "Record it again as sent today" }), status).toBeInTheDocument();
      unmount();
    }
  });

  it("is not offered once the PEO quoted, declined or was closed", () => {
    for (const status of ["quoted", "declined", "closed"]) {
      const { unmount } = prompt(status);
      expect(screen.queryByRole("button", { name: "Record it again as sent today" }), status).not.toBeInTheDocument();
      unmount();
    }
  });
});
