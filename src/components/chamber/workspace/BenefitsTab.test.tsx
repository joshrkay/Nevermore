import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { EMPTY_CHAMBER_DATA, type ChamberData } from "@/data/chamberTypes";
import { applyFieldAction, type IntakeState } from "@/data/provenance";
import BenefitsTab from "./BenefitsTab";

function Harness({ data = {} }: { data?: Partial<ChamberData> }) {
  const [state, setState] = useState<IntakeState>({ data: { ...EMPTY_CHAMBER_DATA, ...data }, provenance: {} });
  return (
    <>
      <BenefitsTab data={state.data} provenance={state.provenance} onAction={(a) => setState((s) => applyFieldAction(s, a))} />
      <output data-testid="held">{JSON.stringify(state.data.medical_plans)}</output>
    </>
  );
}

// K-4.1
describe("current medical plans in the Benefits tab", () => {
  it("lets the prospect enter each plan's rates by tier, renewal rates, employer contribution and enrolment", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Add Current medical plans" }));
    const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(`${label}, row 1`), { target: { value } });
    type("Plan", "Gold PPO 500");
    type("Carrier", "Blue Shield");
    type("EE", "$612.40");
    type("Family", "1,837.20");
    type("Renewal EE", "685.89");
    type("Employer contribution", "75% of employee-only");
    type("Enrolled", "14");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(JSON.parse(screen.getByTestId("held").textContent!)).toEqual([
      { name: "Gold PPO 500", carrier: "Blue Shield", rate_ee: 612.4, rate_fam: 1837.2, renewal_rate_ee: 685.89, employer_contribution: "75% of employee-only", enrolled: 14 },
    ]);
    const cells = within(within(screen.getByRole("table", { name: "Current medical plans" })).getAllByRole("row")[1]).getAllByRole("cell").map((c) => c.textContent);
    expect(cells.slice(0, 6)).toEqual(["Gold PPO 500", "Blue Shield", "$612.40", "—", "—", "$1,837.20"]);
  });

  it("names a rate that isn't an amount", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Add Current medical plans" }));
    fireEvent.change(screen.getByLabelText("Plan, row 1"), { target: { value: "Gold PPO 500" } });
    fireEvent.change(screen.getByLabelText("EE, row 1"), { target: { value: "ask the broker" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Row 1: EE doesn't look right");
  });
});
