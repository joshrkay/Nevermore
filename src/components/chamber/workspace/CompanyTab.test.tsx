import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { EMPTY_CHAMBER_DATA, type ChamberData } from "@/data/chamberTypes";
import { applyFieldAction, type IntakeState } from "@/data/provenance";
import CompanyTab from "./CompanyTab";

// Wires the tab to the same reducer ChamberPage uses, and shows what the intake then holds.
function Harness({ data = {} }: { data?: Partial<ChamberData> }) {
  const [state, setState] = useState<IntakeState>({ data: { ...EMPTY_CHAMBER_DATA, ...data }, provenance: {} });
  return (
    <>
      <CompanyTab data={state.data} isDemo={false} provenance={state.provenance} onAction={(a) => setState((s) => applyFieldAction(s, a))} />
      <output data-testid="held">{JSON.stringify({ fein: state.data.fein, entity_type: state.data.entity_type, year_founded: state.data.year_founded, entities: state.data.entities })}</output>
    </>
  );
}
const held = () => JSON.parse(screen.getByTestId("held").textContent ?? "{}");

describe("company identity in the Company tab (K-1.1)", () => {
  it("takes the FEIN typed the way a FEIN is written, shows it in full, and holds its nine digits", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Add FEIN" }));
    fireEvent.change(screen.getByLabelText("FEIN"), { target: { value: "84-1234567" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("84-1234567")).toBeInTheDocument();
    expect(held().fein).toBe("841234567");
    // Editing it again starts from the way it is written.
    fireEvent.click(screen.getByRole("button", { name: "Edit FEIN" }));
    expect(screen.getByLabelText("FEIN")).toHaveValue("84-1234567");
  });

  it("refuses a number written the way a Social Security number is, and keeps the box open", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Add FEIN" }));
    fireEvent.change(screen.getByLabelText("FEIN"), { target: { value: "123-45-6789" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("That doesn't look right");
    expect(held().fein).toBeNull();
  });

  it("offers the entity types to choose from", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Add Entity Type" }));
    const select = screen.getByLabelText("Entity Type");
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Not sure", "Sole proprietorship", "Partnership", "LLC", "C corporation", "S corporation", "Nonprofit", "Other",
    ]);
    fireEvent.change(select, { target: { value: "s_corporation" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("S corporation")).toBeInTheDocument();
    expect(held().entity_type).toBe("s_corporation");
  });

  it("takes the year founded, street address and website", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Add Year Founded" }));
    fireEvent.change(screen.getByLabelText("Year Founded"), { target: { value: "2014" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(held().year_founded).toBe(2014);
    expect(screen.getByRole("button", { name: "Add Street Address" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Website" })).toBeInTheDocument();
  });

  it("asks for each legal entity only once the employer is more than one", () => {
    render(<Harness />);
    expect(screen.queryByRole("heading", { name: "Legal entities" })).not.toBeInTheDocument();
  });

  it("lets the prospect list each entity's legal name and FEIN when the employer has more than one", () => {
    render(<Harness data={{ multiple_entities: true, fein_count: 2 }} />);
    expect(screen.getByRole("heading", { name: "Legal entities" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add Legal entities" }));
    fireEvent.change(screen.getByLabelText("Legal name, row 1"), { target: { value: "Meridian Creative LLC" } });
    fireEvent.change(screen.getByLabelText("FEIN, row 1"), { target: { value: "84-1234567" } });
    fireEvent.click(screen.getByRole("button", { name: "Add a row" }));
    fireEvent.change(screen.getByLabelText("Legal name, row 2"), { target: { value: "Meridian Studios Inc" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(held().entities).toEqual([{ legal_name: "Meridian Creative LLC", fein: "841234567" }, { legal_name: "Meridian Studios Inc" }]);
    const table = screen.getByRole("table", { name: "Legal entities" });
    expect(within(table).getAllByRole("row").map((r) => r.textContent)).toEqual(["Legal nameFEIN", "Meridian Creative LLC84-1234567", "Meridian Studios Inc—"]);
  });

  it("removes a row, and refuses to save a row whose FEIN isn't one", () => {
    render(<Harness data={{ multiple_entities: true, entities: [{ legal_name: "Meridian Creative LLC" }, { legal_name: "Meridian Studios Inc" }] }} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Legal entities" }));
    fireEvent.change(screen.getByLabelText("FEIN, row 2"), { target: { value: "123-45-6789" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Row 2: FEIN doesn't look right");
    expect(held().entities).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Remove row 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(held().entities).toEqual([{ legal_name: "Meridian Creative LLC" }]);
  });

  it("is read-only in the demo", () => {
    render(<CompanyTab data={{ ...EMPTY_CHAMBER_DATA, multiple_entities: true, entities: [{ legal_name: "Meridian Creative LLC" }] }} isDemo provenance={{}} />);
    expect(screen.queryByRole("button", { name: "Edit Legal entities" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add FEIN" })).not.toBeInTheDocument();
  });
});
