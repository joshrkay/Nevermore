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
          { id: "1", file_name: "census.xlsx", category: "employee_census", status: "extracted" },
          { id: "2", file_name: "sbc.pdf", category: "benefits_summary", status: "encrypted" },
        ]}
      />,
    );
    expect(screen.getByText("Documents — 2 uploaded")).toBeInTheDocument();
    expect(screen.getByText("census.xlsx").closest("li")).toHaveTextContent("Employee census");
    expect(screen.getByText("sbc.pdf").closest("li")).toHaveTextContent("Password-protected");
    expect(screen.getByText("Employee census, Benefits summary")).toBeInTheDocument();
    expect(screen.getByText("payroll report, workers' comp loss runs")).toBeInTheDocument();
  });

  it("summarizes zero, some, and all of the recommended categories", () => {
    const doc = (category: string, i: number) => ({ id: String(i), file_name: `${category}.pdf`, category, status: "uploaded" });
    const { rerender } = render(<ReviewTab data={EMPTY_CHAMBER_DATA} onProceed={() => {}} documents={[]} />);
    expect(screen.getByText("none yet")).toBeInTheDocument();
    expect(screen.getByText(/Still helpful, if you have them:/)).toBeInTheDocument();

    rerender(<ReviewTab data={EMPTY_CHAMBER_DATA} onProceed={() => {}} documents={["employee_census", "benefits_summary", "payroll_report", "workers_comp_loss_runs"].map(doc)} />);
    expect(screen.queryByText(/Still helpful, if you have them:/)).not.toBeInTheDocument();
    expect(screen.getByText("Employee census, Benefits summary, Payroll report, Workers' comp loss runs")).toBeInTheDocument();
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
