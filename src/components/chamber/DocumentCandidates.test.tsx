import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import DocumentCandidates from "./DocumentCandidates";

const extraction = {
  message: null,
  notes: [],
  applied: {},
  candidates: [
    { field: "pay_frequency" as const, value: "Bi-weekly", location: "Page 2" },
    { field: "current_carrier" as const, value: "Aetna", location: "Page 1" },
    { field: "payroll_vendor" as const, value: "ADP", location: "Page 2" },
  ],
};
const data = { ...EMPTY_CHAMBER_DATA, payroll_vendor: "Gusto" };

describe("DocumentCandidates", () => {
  it("labels candidates with their document and location", () => {
    render(<DocumentCandidates fileName="sbc.pdf" extraction={extraction} data={data} onApply={() => {}} />);
    expect(screen.getByLabelText("Found in sbc.pdf")).toBeInTheDocument();
    expect(screen.getByText(/Current carrier/)).toHaveTextContent("· Page 1");
    expect(screen.getByText("Your intake has: Gusto")).toBeInTheDocument();
  });

  it("applies all new values without touching an existing answer", () => {
    const onApply = vi.fn();
    render(<DocumentCandidates fileName="sbc.pdf" extraction={extraction} data={data} onApply={onApply} />);
    fireEvent.click(screen.getByRole("button", { name: "Apply all new (2)" }));
    expect(onApply.mock.calls[0][0].map((c: { field: string }) => c.field)).toEqual(["pay_frequency", "current_carrier"]);
    expect(onApply.mock.calls[0][1]).toEqual({ replace: false });
  });

  it("replaces an existing answer only through its own button", () => {
    const onApply = vi.fn();
    render(<DocumentCandidates fileName="sbc.pdf" extraction={extraction} data={data} onApply={onApply} />);
    fireEvent.click(screen.getByRole("button", { name: "Replace Payroll vendor" }));
    expect(onApply).toHaveBeenCalledWith([extraction.candidates[2]], { replace: true });
  });

  it("shows applied candidates as applied", () => {
    render(
      <DocumentCandidates
        fileName="sbc.pdf"
        extraction={{ ...extraction, applied: { pay_frequency: "2026-10-20T00:00:00Z" } }}
        data={data}
        onApply={() => {}}
      />,
    );
    expect(screen.getByText("Applied")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Apply all new/ })).not.toBeInTheDocument();
  });
});
