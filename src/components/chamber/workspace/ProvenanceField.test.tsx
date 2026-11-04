import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import { applyExtraction, applyFieldAction, type IntakeState } from "@/data/provenance";
import CompanyTab from "./CompanyTab";
import ProvenanceField from "./ProvenanceField";
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
    const list = () => screen.getByRole("region", { name: "Needs your review" });
    expect(list()).toHaveTextContent("Employee count");
    expect(list()).toHaveTextContent("Two different answers were given. Choose the right one.");
    fireEvent.click(within(list()).getByRole("button", { name: "Go to employee count" }));
    // The jump lands on the answer's first control: the first of the two candidates.
    expect(screen.getByRole("button", { name: "Use 40 for Employee count" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Use 45 for Employee count" }));
    // Settled: only the recommended census is left in the list.
    expect(list()).not.toHaveTextContent("Employee count");
    expect(list()).toHaveTextContent("Employee census");
  });

  it("shows a field the prospect doesn't know yet, or that doesn't apply, in place of an answer", () => {
    const at = "2026-11-03T12:00:00.000Z";
    const { unmount } = render(
      <ProvenanceField label="Experience mod" field="wc_experience_mod" display={null} raw={null} onAction={() => {}}
        provenance={{ status: "unknown", source: { kind: "transcript", message_id: "m1" }, updated_at: at }} />,
    );
    expect(screen.getByText("Not known yet")).toBeInTheDocument();
    expect(screen.queryByText(/Lenore will fill this in/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm Experience mod" })).not.toBeInTheDocument();
    unmount();
    render(
      <ProvenanceField label="Experience mod" field="wc_experience_mod" display={null} raw={null} onAction={() => {}}
        provenance={{ status: "not_applicable", source: { kind: "prospect_edit" }, updated_at: at }} />,
    );
    expect(screen.getByText("Doesn't apply")).toBeInTheDocument();
  });

  it("offers Doesn't apply on a recommended answer, and Undo once it is marked", () => {
    let action: unknown;
    const { unmount } = render(<ProvenanceField label="Experience mod" field="wc_experience_mod" display={null} raw={null} onAction={(a) => { action = a; }} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Experience mod as not applicable" }));
    expect(action).toEqual({ type: "not_applicable", field: "wc_experience_mod" });
    unmount();
    render(
      <ProvenanceField label="Experience mod" field="wc_experience_mod" display={null} raw={null} onAction={(a) => { action = a; }}
        provenance={{ status: "not_applicable", source: { kind: "prospect_edit" }, updated_at: "2026-11-03T12:00:00.000Z" }} />,
    );
    expect(screen.queryByRole("button", { name: "Mark Experience mod as not applicable" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Experience mod applies after all" }));
    expect(action).toEqual({ type: "applies", field: "wc_experience_mod" });
  });

  it("never offers Doesn't apply on a required answer", () => {
    render(<ProvenanceField label="Pay frequency" field="pay_frequency" display={null} raw={null} onAction={() => {}} />);
    expect(screen.queryByRole("button", { name: /not applicable/ })).not.toBeInTheDocument();
  });

  it("takes a fractional experience mod", () => {
    let action: unknown;
    render(<ProvenanceField label="Experience mod" field="wc_experience_mod" display={null} raw={null} onAction={(a) => { action = a; }} />);
    fireEvent.click(screen.getByRole("button", { name: "Add Experience mod" }));
    const input = screen.getByLabelText("Experience mod");
    expect(input).toHaveAttribute("step", "0.01");
    fireEvent.change(input, { target: { value: "0.92" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(action).toEqual({ type: "edit", field: "wc_experience_mod", value: "0.92" });
  });

  it("is read-only without an action handler", () => {
    render(<CompanyTab data={inferred.data} isDemo={true} provenance={inferred.provenance} onAction={() => {}} />);
    expect(screen.queryByRole("button", { name: /Confirm|Edit|Add/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Lenore inferred this")).not.toBeInTheDocument();
  });
});

describe("required answers", () => {
  it("are marked in the Company tab, and say they're needed while empty", () => {
    render(<Harness initial={{ data: EMPTY_CHAMBER_DATA, provenance: {} }} tab="company" />);
    expect(screen.getByText("Business Name").textContent).toBe("Business NameRequired");
    expect(screen.getByText("Industry").textContent).toBe("Industry");
    expect(screen.getAllByText("Not provided yet. Needed before you can certify.")).toHaveLength(2); // name, states
  });

  it("drop off the Review's still-needed list the moment they're answered there", () => {
    render(<Harness initial={{ data: EMPTY_CHAMBER_DATA, provenance: {} }} tab="review" />);
    const needed = () => screen.getByRole("region", { name: "Still needed" });
    expect(needed()).toHaveTextContent("Still needed before The Manuscript can be generated: 3");

    fireEvent.click(screen.getByRole("button", { name: "Add Company legal name" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Company legal name" }), { target: { value: "Acme Bindery" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(needed()).toHaveTextContent("Still needed before The Manuscript can be generated: 2");
    expect(needed()).not.toHaveTextContent("Company legal name");
    const company = screen.getByRole("region", { name: "Company" });
    expect(within(company).getByText("Acme Bindery")).toBeInTheDocument();
    expect(within(company).getByText("You confirmed this")).toBeInTheDocument();
  });
});

