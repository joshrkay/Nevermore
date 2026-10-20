import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import { applyExtraction, applyFieldAction, type IntakeState } from "@/data/provenance";
import CompanyTab from "./CompanyTab";
import ReviewTab from "./ReviewTab";

const inferred = applyExtraction(
  { data: EMPTY_CHAMBER_DATA, provenance: {} },
  { employee_count: 40, company_name: "Acme" },
  {
    source: { kind: "transcript", message_id: "m1", quote: "about 40 of us at Acme" },
    statuses: { company_name: "confirmed" },
  },
);

// Wires the tabs to the same reducer ChamberPage uses.
function Harness({ initial, tab }: { initial: IntakeState; tab: "company" | "review" }) {
  const [state, setState] = useState(initial);
  const onAction = (a: Parameters<typeof applyFieldAction>[1]) => setState((s) => applyFieldAction(s, a));
  return tab === "company"
    ? <CompanyTab data={state.data} isDemo={false} provenance={state.provenance} onAction={onAction} />
    : <ReviewTab data={state.data} provenance={state.provenance} onAction={onAction} onProceed={() => {}} />;
}

describe("provenance in the workspace", () => {
  it("distinguishes inferred from confirmed values and shows where each came from", () => {
    render(<Harness initial={inferred} tab="company" />);
    expect(screen.getByText("Lenore inferred this")).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getAllByText("From your message: “about 40 of us at Acme”")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Confirm Business Name" })).not.toBeInTheDocument();
  });

  it("confirms an inferred value", () => {
    render(<Harness initial={inferred} tab="company" />);
    fireEvent.click(screen.getByRole("button", { name: "Confirm Employee Count" }));
    expect(screen.queryByText("Lenore inferred this")).not.toBeInTheDocument();
    expect(screen.getByText("You confirmed this")).toBeInTheDocument();
  });

  it("edits a value, superseding the AI value, and rejects an invalid one", () => {
    render(<Harness initial={inferred} tab="company" />);
    fireEvent.click(screen.getByRole("button", { name: "Add HQ State" }));
    fireEvent.change(screen.getByLabelText("HQ State"), { target: { value: "California" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("doesn't look right");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    fireEvent.click(screen.getByRole("button", { name: "Edit Employee Count" }));
    fireEvent.change(screen.getByLabelText("Employee Count"), { target: { value: "42" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("You confirmed this")).toBeInTheDocument();
  });

  it("adds a value Lenore hasn't captured", () => {
    render(<Harness initial={inferred} tab="company" />);
    fireEvent.click(screen.getByRole("button", { name: "Add Industry" }));
    fireEvent.change(screen.getByLabelText("Industry"), { target: { value: "Retail" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Retail")).toBeInTheDocument();
  });

  it("lists fields needing review and resolves a conflict", () => {
    const conflict = applyExtraction(inferred, { employee_count: 45 }, { source: { kind: "transcript", message_id: "m2" } });
    render(<Harness initial={conflict} tab="review" />);
    const list = screen.getByText(/Needs your review — 1 item/).parentElement!;
    expect(within(list).getAllByText("Conflicting answers").length).toBeGreaterThan(0);
    fireEvent.click(within(list).getByRole("button", { name: "Use 45 for Employee count" }));
    expect(screen.queryByText(/Needs your review/)).not.toBeInTheDocument();
  });

  it("is read-only without an action handler", () => {
    render(<CompanyTab data={inferred.data} isDemo={true} provenance={inferred.provenance} onAction={() => {}} />);
    expect(screen.queryByRole("button", { name: /Confirm|Edit|Add/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Lenore inferred this")).not.toBeInTheDocument();
  });
});
