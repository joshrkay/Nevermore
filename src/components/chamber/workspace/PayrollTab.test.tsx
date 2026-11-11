import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { EMPTY_CHAMBER_DATA, type ChamberData } from "@/data/chamberTypes";
import { applyFieldAction, type IntakeState } from "@/data/provenance";
import PayrollTab from "./PayrollTab";

function Harness({ data = {} }: { data?: Partial<ChamberData> }) {
  const [state, setState] = useState<IntakeState>({ data: { ...EMPTY_CHAMBER_DATA, ...data }, provenance: {} });
  return (
    <>
      <PayrollTab data={state.data} provenance={state.provenance} onAction={(a) => setState((s) => applyFieldAction(s, a))} />
      <output data-testid="held">{JSON.stringify(state.data.suta_rates)}</output>
    </>
  );
}

// K-4.2
describe("state unemployment rates in the Payroll tab", () => {
  it("lets the prospect enter a rate and its effective year for a state", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Add State unemployment tax rates" }));
    fireEvent.change(screen.getByLabelText("State, row 1"), { target: { value: "ca" } });
    fireEvent.change(screen.getByLabelText("Rate %, row 1"), { target: { value: "3.4" } });
    fireEvent.change(screen.getByLabelText("Effective year, row 1"), { target: { value: "2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(JSON.parse(screen.getByTestId("held").textContent!)).toEqual([{ state: "CA", rate: 3.4, year: 2026 }]);
    expect(within(screen.getByRole("table", { name: "State unemployment tax rates" })).getAllByRole("row")[1]).toHaveTextContent("CA3.4%2026");
  });

  it("starts the table with a row for each state of operation that has no rate yet", () => {
    render(<Harness data={{ states: ["CA", "TX"], suta_rates: [{ state: "TX", rate: 2.7 }] }} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit State unemployment tax rates" }));
    expect(screen.getByLabelText("State, row 1")).toHaveValue("TX");
    expect(screen.getByLabelText("State, row 2")).toHaveValue("CA");
    expect(screen.getByLabelText("Rate %, row 2")).toHaveValue("");
  });

  it("names a state that isn't one", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Add State unemployment tax rates" }));
    fireEvent.change(screen.getByLabelText("State, row 1"), { target: { value: "Atlantis" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Row 1: State doesn't look right");
  });
});
