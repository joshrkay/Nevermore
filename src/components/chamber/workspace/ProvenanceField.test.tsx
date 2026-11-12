import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { DEMO_CHAMBER_DATA, EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import { applyExtraction, applyFieldAction, type FieldProvenance, type IntakeState } from "@/data/provenance";
import CompanyTab from "./CompanyTab";
import ProvenanceField from "./ProvenanceField";
import ReviewTab from "./ReviewTab";
import { VerifiedFieldsContext } from "./VerifiedFieldsContext";

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
    expect(screen.getByText("Lenore captured this — please confirm")).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getAllByText("From your message: “about 40 of us at Acme”")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Confirm Business Name" })).not.toBeInTheDocument();
  });

  it("confirms an inferred value", () => {
    render(<Harness initial={inferred} tab="company" />);
    fireEvent.click(screen.getByRole("button", { name: "Confirm Employee Count" }));
    expect(screen.queryByText("Lenore captured this — please confirm")).not.toBeInTheDocument();
    expect(screen.getByText("You confirmed this")).toBeInTheDocument();
    // Told apart from a value Lenore heard stated outright, which stays "Confirmed".
    expect(screen.getByText("Confirmed by you")).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
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
    // The other required items are answered, so the conflict is the only thing listed.
    const answered = { ...conflict, data: { ...conflict.data, states: ["CA"], pay_frequency: "Weekly", census: DEMO_CHAMBER_DATA.census } };
    render(<Harness initial={answered} tab="review" />);
    const list = screen.getByText(/Needs your review — 1 item/).parentElement!;
    expect(within(list).getAllByText("Conflicting answers").length).toBeGreaterThan(0);
    fireEvent.click(within(list).getByRole("button", { name: "Use 45 for Employee count" }));
    // The conflict is settled. What is left to confirm was worked out from the census just then: whether any
    // employee is under 16 or over 60 (K-3.4).
    expect(screen.queryByText("Conflicting answers")).not.toBeInTheDocument();
    expect(screen.getByText(/Needs your review — 1 item/)).toBeInTheDocument();
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
    expect(screen.queryByText("Lenore captured this — please confirm")).not.toBeInTheDocument();
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
    expect(needed()).toHaveTextContent("Still needed before your packet can be generated: 3");

    fireEvent.click(screen.getByRole("button", { name: "Add Company legal name" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Company legal name" }), { target: { value: "Acme Bindery" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(needed()).toHaveTextContent("Still needed before your packet can be generated: 2");
    expect(needed()).not.toHaveTextContent("Company legal name");
    const company = screen.getByRole("region", { name: "Company" });
    expect(within(company).getByText("Acme Bindery")).toBeInTheDocument();
    expect(within(company).getByText("You confirmed this")).toBeInTheDocument();
  });
});


// B-2.1: an advisor's verification settles a field for the prospect too, and a value Lenore heard from another
// source (the ladder's loser, B-1.2) is shown beside the one kept.
describe("advisor verification and what else was heard", () => {
  const at = "2026-05-01T00:00:00Z";
  const said = { kind: "transcript" as const, message_id: "m1", quote: "about 40 of us" };
  const register = { kind: "document" as const, document_id: "d1", document_name: "Payroll.xlsx" };
  const entry = (over: Partial<FieldProvenance> = {}): FieldProvenance => ({ status: "inferred", source: said, updated_at: at, ...over });

  // `onAction: null` renders the row read-only, as the demo does.
  const field = (
    provenance: FieldProvenance | undefined,
    { verified = [] as string[], onAction = vi.fn() as ((a: never) => void) | null, display = "40" as string | null } = {},
  ) =>
    render(
      <VerifiedFieldsContext.Provider value={new Set(verified)}>
        <ProvenanceField label="Employee Count" field="employee_count" display={display} raw={display === null ? null : 40} provenance={provenance} onAction={onAction ?? undefined} />
      </VerifiedFieldsContext.Provider>,
    );

  it("shows 'Verified by your advisor' in place of the please-confirm badge, with nothing left to confirm", () => {
    field(entry(), { verified: ["employee_count"] });
    expect(screen.getByText("Verified by your advisor")).toBeInTheDocument();
    expect(screen.queryByText("Lenore captured this — please confirm")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm Employee Count" })).not.toBeInTheDocument();
    // The prospect can still change it.
    expect(screen.getByRole("button", { name: "Edit Employee Count" })).toBeInTheDocument();
  });

  it("keeps the rival answers of a REQUIRED conflict, which still blocks certification whoever verified it", () => {
    render(
      <VerifiedFieldsContext.Provider value={new Set(["company_name"])}>
        <ProvenanceField
          label="Company legal name"
          field="company_name"
          display="Acme Bindery"
          raw="Acme Bindery"
          provenance={entry({ status: "conflicting", candidates: [{ value: "Acme Bindery", source: said }, { value: "Acme Press", source: register }] })}
          onAction={vi.fn()}
        />
      </VerifiedFieldsContext.Provider>,
    );
    expect(screen.getByText("Conflicting answers")).toBeInTheDocument();
    expect(screen.queryByText("Verified by your advisor")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use Acme Press for Company legal name" })).toBeInTheDocument();
  });

  it("settles an incomplete answer the same way", () => {
    field(entry({ status: "incomplete" }), { verified: ["employee_count"] });
    expect(screen.getByText("Verified by your advisor")).toBeInTheDocument();
    expect(screen.queryByText("Incomplete")).not.toBeInTheDocument();
  });

  it("doesn't offer the rival answers of a conflict the advisor settled", () => {
    field(
      entry({ status: "conflicting", candidates: [{ value: 40, source: said }, { value: 45, source: register }] }),
      { verified: ["employee_count"] },
    );
    expect(screen.getByText("Verified by your advisor")).toBeInTheDocument();
    expect(screen.queryByText("Conflicting answers")).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Answers for Employee Count" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Use / })).not.toBeInTheDocument();
  });

  it("keeps what the prospect already confirmed, and every field the advisor hasn't verified", () => {
    const { unmount } = field(entry({ status: "confirmed", source: { kind: "prospect_edit" } }), { verified: ["employee_count"] });
    expect(screen.getByText("Confirmed by you")).toBeInTheDocument();
    expect(screen.queryByText("Verified by your advisor")).not.toBeInTheDocument();
    unmount();
    field(entry(), { verified: ["company_name"] });
    expect(screen.getByText("Lenore captured this — please confirm")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm Employee Count" })).toBeInTheDocument();
  });

  it("lists what else was heard, from the conversation or a document, beside the answer kept", () => {
    field(entry({ also_heard: [{ value: 45, source: register }, { value: 38, source: { ...said, quote: "closer to 38" } }] }));
    expect(screen.getByText("Also heard: 45 — From Payroll.xlsx")).toBeInTheDocument();
    expect(screen.getByText("Also heard: 38 — From your message: “closer to 38”")).toBeInTheDocument();
  });

  it("says nothing about what else was heard when there is none, or in a read-only view", () => {
    const { unmount } = field(entry());
    expect(screen.queryByText(/Also heard/)).not.toBeInTheDocument();
    unmount();
    field(entry({ also_heard: [{ value: 45, source: register }] }), { onAction: null });
    expect(screen.queryByText(/Also heard/)).not.toBeInTheDocument();
  });

  it("shows no note for a field with no answer yet, or while the answer is being edited", () => {
    const heard = entry({ also_heard: [{ value: 45, source: register }] });
    const { unmount } = field(heard, { display: null });
    expect(screen.queryByText(/Also heard/)).not.toBeInTheDocument();
    unmount();
    field(heard);
    expect(screen.getByText(/Also heard: 45/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit Employee Count" }));
    expect(screen.queryByText(/Also heard/)).not.toBeInTheDocument();
  });

  it("doesn't repeat as also heard an answer the conflict already offers", () => {
    field(entry({
      status: "conflicting",
      candidates: [{ value: 40, source: said }, { value: 45, source: register }],
      also_heard: [{ value: 40, source: said }, { value: 38, source: { ...said, quote: "closer to 38" } }],
    }));
    expect(screen.getByRole("list", { name: "Answers for Employee Count" })).toBeInTheDocument();
    expect(screen.queryByText(/^Also heard: 40 /)).not.toBeInTheDocument();
    expect(screen.getByText("Also heard: 38 — From your message: “closer to 38”")).toBeInTheDocument();
  });

  it("still shows a note that repeats a rival answer when the advisor's verification hides the rival answers", () => {
    field(entry({
      status: "conflicting",
      candidates: [{ value: 40, source: said }, { value: 45, source: register }],
      also_heard: [{ value: 45, source: register }],
    }), { verified: ["employee_count"] });
    expect(screen.getByText("Verified by your advisor")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Answers for Employee Count" })).not.toBeInTheDocument();
    expect(screen.getByText("Also heard: 45 — From Payroll.xlsx")).toBeInTheDocument();
  });

  it("badges a verified value that has no provenance, such as one typed before provenance existed", () => {
    const { unmount } = field(undefined, { verified: ["employee_count"] });
    expect(screen.getByText("Verified by your advisor")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Employee Count" })).toBeInTheDocument();
    unmount();
    field(undefined);
    expect(screen.queryByText("Verified by your advisor")).not.toBeInTheDocument();
  });

  it("drops the also-heard note once the prospect confirms the answer", () => {
    const heard: IntakeState = {
      data: inferred.data,
      provenance: { ...inferred.provenance, employee_count: { ...inferred.provenance.employee_count!, also_heard: [{ value: 45, source: register }] } },
    };
    render(<Harness initial={heard} tab="company" />);
    expect(screen.getByText("Also heard: 45 — From Payroll.xlsx")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm Employee Count" }));
    expect(screen.queryByText(/Also heard/)).not.toBeInTheDocument();
  });
});
