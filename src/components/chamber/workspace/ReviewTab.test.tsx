import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import ReviewTab from "./ReviewTab";

describe("ReviewTab documents", () => {
  it("lists uploaded files with their status and the helpful ones still missing", () => {
    render(
      <ReviewTab
        data={EMPTY_CHAMBER_DATA}
        onProceed={() => {}}
        documents={[
          { id: "1", file_name: "census.xlsx", category: "census", status: "extracted" },
          { id: "2", file_name: "sbc.pdf", category: "benefits", status: "encrypted" },
        ]}
      />,
    );
    expect(screen.getByText("Documents — 2 uploaded")).toBeInTheDocument();
    expect(screen.getByText("census.xlsx").closest("li")).toHaveTextContent("Employee census");
    expect(screen.getByText("sbc.pdf").closest("li")).toHaveTextContent("Password-protected");
    expect(screen.getByText(/Helpful if you have them: payroll report, workers' comp\./)).toBeInTheDocument();
  });

  it("never blocks moving on when documents are missing", () => {
    const onProceed = vi.fn();
    render(<ReviewTab data={EMPTY_CHAMBER_DATA} onProceed={onProceed} documents={[]} />);
    expect(screen.getByText(/No documents uploaded/)).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "See Your PEO Matches →" });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onProceed).toHaveBeenCalled();
  });
});
