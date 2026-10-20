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
});
