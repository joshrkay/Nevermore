import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
});
