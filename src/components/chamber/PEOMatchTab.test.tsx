import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DEMO_CHAMBER_DATA } from "@/data/chamberTypes";
import PEOMatchTab from "./PEOMatchTab";

const renderTab = (selectedPeo: string | null = null) => {
  const onSelect = vi.fn();
  const onProceed = vi.fn();
  render(<PEOMatchTab data={DEMO_CHAMBER_DATA} selectedPeo={selectedPeo} onSelect={onSelect} onProceed={onProceed} />);
  return { onSelect, onProceed };
};

describe("PEOMatchTab", () => {
  it("shows a headcount of 0 as 0, and only a missing one as a dash", () => {
    const summary = (employee_count: number | null, census = DEMO_CHAMBER_DATA.census) => {
      const { unmount } = render(<PEOMatchTab data={{ ...DEMO_CHAMBER_DATA, employee_count, census }} selectedPeo={null} onSelect={vi.fn()} onProceed={vi.fn()} />);
      const value = screen.getByText("Total EEs").parentElement!.textContent;
      unmount();
      return value;
    };
    expect(summary(0)).toContain("0");
    expect(summary(0)).not.toContain("—");
    expect(summary(null, [])).toContain("—");
    expect(summary(null)).toContain(String(DEMO_CHAMBER_DATA.census.length));
  });

  it("offers every listed PEO alphabetically, with none preselected or ranked above another", () => {
    renderTab();
    const choices = screen.getAllByRole("button", { name: /^Choose / }).map((b) => b.textContent);
    expect(choices).toEqual(["Choose ADP TotalSource", "Choose Insperity", "Choose Justworks", "Choose Rippling", "Choose TriNet"]);
    expect(screen.queryByText("✓ Selected")).not.toBeInTheDocument();
  });

  it("shows no scores, prices, or marketing claims about any PEO", () => {
    renderTab();
    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/PEPM|Estimated|per employee per month/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Best Match|Strong Match|Good Match|best-in-class|white-glove/i)).not.toBeInTheDocument();
  });

  it("says what is not yet confirmed instead of guessing at fit", () => {
    renderTab();
    expect(screen.getAllByText(/Not yet confirmed/).length).toBeGreaterThan(0);
  });

  it("selects the PEO the prospect chooses", () => {
    const { onSelect } = renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Choose Justworks" }));
    expect(onSelect).toHaveBeenCalledWith("Justworks");
  });

  it("lets the prospect name a PEO that isn't listed", () => {
    const { onSelect } = renderTab();
    const use = screen.getByRole("button", { name: "Use this PEO" });
    expect(use).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Another PEO"), { target: { value: "  Acme PEO " } });
    fireEvent.click(use);
    expect(onSelect).toHaveBeenCalledWith("Acme PEO");
  });

  it("lets the prospect continue without choosing, and names the choice when there is one", () => {
    const first = renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Continue without choosing a PEO →" }));
    expect(first.onProceed).toHaveBeenCalled();
  });

  it("proceeds with the selected PEO and marks it selected", () => {
    const { onProceed } = renderTab("Acme PEO");
    expect(screen.getByText("✓ Selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Proceed with Acme PEO →" }));
    expect(onProceed).toHaveBeenCalled();
  });

  it("warns about a PEO whose sourced facts don't fit, naming the fact, and still offers it in its place", () => {
    const catalog = [
      { name: "Alpha PEO", minHeadcount: 50, statesServed: null, excludedClassCodes: null, lastVerified: "2026-11-01",
        sources: { minHeadcount: "https://alpha.example/minimums" } },
      { name: "Beta PEO", minHeadcount: null, statesServed: null, excludedClassCodes: null, lastVerified: null },
    ];
    const onSelect = vi.fn();
    render(<PEOMatchTab data={{ ...DEMO_CHAMBER_DATA, employee_count: 8 }} selectedPeo={null} onSelect={onSelect} onProceed={vi.fn()} catalog={catalog} />);
    const warning = screen.getByRole("alert");
    expect(warning).toHaveTextContent("Alpha PEO lists a 50-employee minimum; you have 8");
    expect(screen.getAllByRole("button", { name: /^Choose / }).map((b) => b.textContent)).toEqual(["Choose Alpha PEO", "Choose Beta PEO"]);
    fireEvent.click(screen.getByRole("button", { name: "Choose Alpha PEO" }));
    expect(onSelect).toHaveBeenCalledWith("Alpha PEO");
  });
});
