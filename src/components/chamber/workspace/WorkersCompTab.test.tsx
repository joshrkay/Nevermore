import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { EMPTY_CHAMBER_DATA, type ChamberData } from "@/data/chamberTypes";
import { applyFieldAction, type IntakeState } from "@/data/provenance";
import WorkersCompTab from "./WorkersCompTab";

function Harness({ data = {}, show }: { data?: Partial<ChamberData>; show: (d: ChamberData) => unknown }) {
  const [state, setState] = useState<IntakeState>({ data: { ...EMPTY_CHAMBER_DATA, ...data }, provenance: {} });
  return (
    <>
      <WorkersCompTab data={state.data} isDemo={false} provenance={state.provenance} onAction={(a) => setState((s) => applyFieldAction(s, a))} />
      <output data-testid="held">{JSON.stringify(show(state.data))}</output>
    </>
  );
}
const held = () => JSON.parse(screen.getByTestId("held").textContent ?? "null");

describe("the Workers' comp tab", () => {
  it("holds the workers' comp answers the intake already had, each editable", () => {
    render(<Harness show={(d) => d.wc_carrier} />);
    for (const label of ["Workers' Comp Carrier", "Renewal Date", "Experience Mod", "Annual Premium"]) {
      expect(screen.getByRole("button", { name: `Add ${label}` })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: "Add Workers' Comp Carrier" }));
    fireEvent.change(screen.getByLabelText("Workers' Comp Carrier"), { target: { value: "Pinnacle Mutual" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(held()).toBe("Pinnacle Mutual");
  });

  // K-3.1
  it("lets the prospect list each owner and officer with title, share, duties and whether they are covered", () => {
    render(<Harness show={(d) => d.owners_officers} />);
    fireEvent.click(screen.getByRole("button", { name: "Add Owners and officers" }));
    fireEvent.change(screen.getByLabelText("Name, row 1"), { target: { value: "Dana Reyes" } });
    fireEvent.change(screen.getByLabelText("Title, row 1"), { target: { value: "President" } });
    fireEvent.change(screen.getByLabelText("Ownership %, row 1"), { target: { value: "60" } });
    fireEvent.change(screen.getByLabelText("Duties, row 1"), { target: { value: "Runs sales; no field work" } });
    fireEvent.change(screen.getByLabelText("Covered by workers' comp, row 1"), { target: { value: "no" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(held()).toEqual([{ name: "Dana Reyes", title: "President", ownership_percent: 60, duties: "Runs sales; no field work", covered: false }]);
    const row = within(screen.getByRole("table", { name: "Owners and officers" })).getAllByRole("row")[1];
    expect(within(row).getAllByRole("cell").map((c) => c.textContent)).toEqual(["Dana Reyes", "President", "60%", "Runs sales; no field work", "No"]);
  });

  it("offers yes, no or not said for whether someone is covered, and starts an edit from what is held", () => {
    render(<Harness data={{ owners_officers: [{ name: "Sam Okafor", ownership_percent: 12.5, covered: true }] }} show={(d) => d.owners_officers} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Owners and officers" }));
    const covered = screen.getByLabelText("Covered by workers' comp, row 1");
    expect(within(covered).getAllByRole("option").map((o) => o.textContent)).toEqual(["—", "Yes", "No"]);
    expect(covered).toHaveValue("yes");
    expect(screen.getByLabelText("Ownership %, row 1")).toHaveValue("12.5");
  });

  it("names a share that isn't a percentage, and saves nothing until it is fixed", () => {
    render(<Harness show={(d) => d.owners_officers} />);
    fireEvent.click(screen.getByRole("button", { name: "Add Owners and officers" }));
    fireEvent.change(screen.getByLabelText("Name, row 1"), { target: { value: "Dana Reyes" } });
    fireEvent.change(screen.getByLabelText("Ownership %, row 1"), { target: { value: "150" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Row 1: Ownership % doesn't look right");
    expect(held()).toEqual([]);
  });

  it("stops offering another row at 20 people", () => {
    render(<Harness data={{ owners_officers: Array.from({ length: 20 }, (_, i) => ({ name: `Owner ${i + 1}` })) }} show={(d) => d.owners_officers.length} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Owners and officers" }));
    expect(screen.queryByRole("button", { name: "Add a row" })).not.toBeInTheDocument();
  });

  // K-3.2
  it("shows payroll by class code and state, worked out from the census, with nothing to edit", () => {
    const emp = (over: object) => ({ id: Math.random().toString(36).slice(2), first_name: "A", last_name: "B", work_state: "CA", compensation_type: "salary" as const, employment_type: "full_time" as const, classification: "w2" as const, ...over });
    render(<Harness data={{ census: [emp({ class_code: "8810", annual_salary: 100000 }), emp({ annual_salary: 40000, employment_type: "part_time" })] }} show={() => null} />);
    const table = screen.getByRole("table", { name: "Payroll by class code and state" });
    expect(within(table).getAllByRole("row").map((r) => r.textContent)).toEqual([
      "StateClass codeFull timePart timeAnnual payroll", "CA881010$100,000", "CANo class code yet01$40,000",
    ]);
    expect(screen.queryByRole("button", { name: /Payroll by class code/ })).not.toBeInTheDocument();
    expect(screen.getByText(/It changes only when your census does/)).toBeInTheDocument();
  });

  it("says the table comes from the census while there is none", () => {
    render(<Harness show={() => null} />);
    expect(screen.queryByRole("table", { name: "Payroll by class code and state" })).not.toBeInTheDocument();
    expect(screen.getByText(/Upload a census and this table fills itself in/)).toBeInTheDocument();
  });
});
