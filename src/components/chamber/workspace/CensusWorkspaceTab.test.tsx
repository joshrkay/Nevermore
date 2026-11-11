import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import CensusWorkspaceTab from "./CensusWorkspaceTab";

const census = [{ id: "e1", first_name: "Ada", last_name: "L", work_state: "NY", compensation_type: "salary" as const, employment_type: "full_time" as const, classification: "w2" as const }];

describe("CensusWorkspaceTab", () => {
  it("shows where the census came from and lets the prospect confirm it, as for any answer (US-2.2a)", () => {
    const onAction = vi.fn();
    render(
      <CensusWorkspaceTab
        data={{ ...EMPTY_CHAMBER_DATA, census }}
        isDemo={false}
        provenance={{ census: { status: "inferred", source: { kind: "document", document_id: "d1", document_name: "census.xlsx" }, updated_at: "2026-11-04T00:00:00Z" } }}
        onAction={onAction}
      />,
    );
    expect(screen.getByText("1 person")).toBeInTheDocument();
    expect(screen.getByText("Lenore captured this — please confirm")).toBeInTheDocument();
    expect(screen.getByText("From census.xlsx")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm Census" }));
    expect(onAction).toHaveBeenCalledWith({ type: "confirm", field: "census" });
  });

  it("says the roster comes only from an upload when there is none", () => {
    render(<CensusWorkspaceTab data={EMPTY_CHAMBER_DATA} isDemo={false} />);
    expect(screen.getByText(/comes only from a file/)).toBeInTheDocument();
  });

  // K-2.1: what a health underwriter rates the group on, shown per person.
  it("shows each person's gender, hire date, COBRA status and home state, and a dash where the census doesn't say", () => {
    render(
      <CensusWorkspaceTab
        data={{ ...EMPTY_CHAMBER_DATA, census: [{ ...census[0], gender: "F", hire_date: "2019-04-01", cobra: true, home_state: "NJ" }, { ...census[0], id: "e2", first_name: "Bo", cobra: false }] }}
        isDemo
      />,
    );
    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(expect.arrayContaining(["Gender", "Hired", "COBRA", "Home"]));
    const cells = (row: number) => {
      const all = within(within(table).getAllByRole("row")[row]).getAllByRole("cell").map((c) => c.textContent);
      return ["Gender", "Hired", "COBRA", "Home"].map((h) => all[headers.indexOf(h)]);
    };
    expect(cells(1)).toEqual(["F", "2019-04-01", "Yes", "NJ"]);
    expect(cells(2)).toEqual(["—", "—", "No", "—"]);
  });

  // K-2.2
  it("shows where each person works, and who works remotely or travels", () => {
    render(
      <CensusWorkspaceTab
        data={{ ...EMPTY_CHAMBER_DATA, census: [{ ...census[0], worksite: "Oakland warehouse", remote: false, travels: true }, { ...census[0], id: "e2", first_name: "Bo", remote: true }, { ...census[0], id: "e3", first_name: "Cy" }] }}
        isDemo
      />,
    );
    const table = screen.getByRole("table");
    const column = within(table).getAllByRole("columnheader").findIndex((h) => h.textContent === "Worksite");
    const cell = (row: number) => within(within(table).getAllByRole("row")[row]).getAllByRole("cell")[column].textContent;
    expect([cell(1), cell(2), cell(3)]).toEqual(["Oakland warehouse · travels", "Remote", "—"]);
  });
});
