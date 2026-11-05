import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import type { FieldProvenance } from "@/data/provenance";
import FieldReviewPanel from "./FieldReviewPanel";

vi.mock("@/lib/advisorApi", () => ({ reviewField: vi.fn() }));

const at = "2026-05-01T00:00:00Z";
const said = { kind: "transcript" as const, message_id: "m1", quote: "about 40 of us" };

const panel = (provenance: FieldProvenance | undefined) =>
  render(
    <FieldReviewPanel
      sessionId="s1"
      data={{ ...EMPTY_CHAMBER_DATA, employee_count: 40 }}
      storedAnswers={{}}
      provenance={provenance ? { employee_count: provenance } : {}}
      reviews={{}}
      messageIds={new Set(["m1"])}
      onShowMessage={() => {}}
      onChanged={() => {}}
    />,
  );

// B-2.1: the advisor sees what else was heard for a field, beside the answer the packet will use.
describe("FieldReviewPanel: what else was heard", () => {
  it("lists each other answer with where it came from", () => {
    panel({
      status: "confirmed",
      source: { kind: "document", document_id: "d1", document_name: "Payroll.xlsx" },
      updated_at: at,
      also_heard: [{ value: 38, source: { ...said, quote: "closer to 38" } }],
    });
    const row = screen.getByTestId("field-employee_count");
    expect(within(row).getByText("Also heard: 38 — From the conversation: “closer to 38”")).toBeInTheDocument();
  });

  it("doesn't repeat an answer that is already one of the conflicting ones", () => {
    panel({
      status: "conflicting",
      source: said,
      updated_at: at,
      candidates: [{ value: 40, source: said }, { value: 45, source: { kind: "document", document_id: "d1", document_name: "Payroll.xlsx" } }],
      also_heard: [{ value: 40, source: said }, { value: 38, source: { ...said, quote: "closer to 38" } }],
    });
    const row = screen.getByTestId("field-employee_count");
    expect(within(row).getByText(/Conflicting answers: 40 vs 45/)).toBeInTheDocument();
    expect(within(row).queryByText(/^Also heard: 40 /)).not.toBeInTheDocument();
    expect(within(row).getByText("Also heard: 38 — From the conversation: “closer to 38”")).toBeInTheDocument();
  });

  it("shows nothing extra for a field with no other answers", () => {
    panel({ status: "inferred", source: said, updated_at: at });
    expect(screen.queryByText(/Also heard/)).not.toBeInTheDocument();
    panel(undefined);
    expect(screen.queryByText(/Also heard/)).not.toBeInTheDocument();
  });
});

// QA F11: a field with no answer shows its status alone, never a quote, whatever its stored provenance says.
describe("FieldReviewPanel: a field with no answer", () => {
  it("shows its status without a source or a link to the transcript", () => {
    render(
      <FieldReviewPanel
        sessionId="s1"
        data={{ ...EMPTY_CHAMBER_DATA, employee_count: 40 }}
        storedAnswers={{}}
        provenance={{
          employee_count: { status: "confirmed", source: said, updated_at: at },
          fein_count: { status: "unknown", source: { ...said, quote: "Bi-weekly. We have 12 employees." }, updated_at: at },
        }}
        reviews={{}}
        messageIds={new Set(["m1"])}
        onShowMessage={() => {}}
        onChanged={() => {}}
      />,
    );
    const answered = screen.getByTestId("field-employee_count");
    expect(within(answered).getByText("From the conversation: “about 40 of us”")).toBeInTheDocument();
    const unanswered = screen.getByTestId("field-fein_count");
    expect(within(unanswered).getByText("Not known yet")).toBeInTheDocument();
    expect(within(unanswered).queryByText(/From the conversation/)).not.toBeInTheDocument();
    expect(within(unanswered).queryByRole("button", { name: "View in transcript" })).not.toBeInTheDocument();
  });
});
