import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DEMO_CHAMBER_DATA } from "@/data/chamberTypes";
import { parsePeoCatalog } from "@/data/peoProfiles";
import PEOMatchTab from "./PEOMatchTab";

// The five PEOs as the database seeds them (20261111090000): each with no published profile yet.
const CATALOG = parsePeoCatalog(["ADP TotalSource", "Insperity", "Justworks", "Rippling", "TriNet"].map((name, i) => ({ id: i + 1, name, profile: null })));

const renderTab = (selectedPeo: string | null = null) => {
  const onSelect = vi.fn();
  const onProceed = vi.fn();
  render(<PEOMatchTab data={DEMO_CHAMBER_DATA} selectedPeo={selectedPeo} onSelect={onSelect} onProceed={onProceed} catalog={CATALOG} catalogStatus="ready" />);
  return { onSelect, onProceed };
};

describe("PEOMatchTab", () => {
  it("shows a headcount of 0 as 0, and only a missing one as a dash", () => {
    const summary = (employee_count: number | null, census = DEMO_CHAMBER_DATA.census) => {
      const { unmount } = render(<PEOMatchTab data={{ ...DEMO_CHAMBER_DATA, employee_count, census }} selectedPeo={null} onSelect={vi.fn()} onProceed={vi.fn()} catalog={CATALOG} catalogStatus="ready" />);
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
      { name: "Alpha PEO", listed: true, minHeadcount: 50, statesServed: null, excludedClassCodes: null, lastVerified: "2026-11-01" },
      { name: "Beta PEO", listed: true, minHeadcount: null, statesServed: null, excludedClassCodes: null, lastVerified: null },
    ];
    const onSelect = vi.fn();
    render(<PEOMatchTab data={{ ...DEMO_CHAMBER_DATA, employee_count: 8 }} selectedPeo={null} onSelect={onSelect} onProceed={vi.fn()} catalog={catalog} catalogStatus="ready" />);
    const warning = screen.getByRole("alert");
    expect(warning).toHaveTextContent("Alpha PEO lists a 50-employee minimum; you have 8");
    expect(screen.getAllByRole("button", { name: /^Choose / }).map((b) => b.textContent)).toEqual(["Choose Alpha PEO", "Choose Beta PEO"]);
    fireEvent.click(screen.getByRole("button", { name: "Choose Alpha PEO" }));
    expect(onSelect).toHaveBeenCalledWith("Alpha PEO");
  });

  it("says when the PEOs are still loading or couldn't be read, and still lets the prospect name one", () => {
    const onSelect = vi.fn();
    const { rerender } = render(<PEOMatchTab data={DEMO_CHAMBER_DATA} selectedPeo={null} onSelect={onSelect} onProceed={vi.fn()} catalog={[]} catalogStatus="loading" />);
    expect(screen.getByText("Loading the PEOs…")).toBeInTheDocument();
    rerender(<PEOMatchTab data={DEMO_CHAMBER_DATA} selectedPeo={null} onSelect={onSelect} onProceed={vi.fn()} catalog={[]} catalogStatus="failed" />);
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load the list of PEOs. You can still name yours below.");
    expect(screen.queryAllByRole("button", { name: /^Choose / })).toEqual([]);
    fireEvent.change(screen.getByLabelText("Another PEO"), { target: { value: "TriNet" } });
    fireEvent.click(screen.getByRole("button", { name: "Use this PEO" }));
    expect(onSelect).toHaveBeenCalledWith("TriNet");
  });

  it("marks a listed PEO the prospect chose as selected, not as another PEO", () => {
    render(<PEOMatchTab data={DEMO_CHAMBER_DATA} selectedPeo="TriNet" onSelect={vi.fn()} onProceed={vi.fn()} catalog={CATALOG} catalogStatus="ready" />);
    expect(screen.getByRole("heading", { name: "TriNet" }).closest("div")!.parentElement).toHaveTextContent("✓ Selected");
    expect(screen.queryByText("Prepared for TriNet.")).not.toBeInTheDocument();
  });

  it("doesn't offer a PEO an admin stopped listing, and shows a prospect who chose it before that choice as their own", () => {
    const catalog = parsePeoCatalog([{ id: 1, name: "Insperity", profile: null }, { id: 5, name: "TriNet", listed: false, profile: null }]);
    render(<PEOMatchTab data={DEMO_CHAMBER_DATA} selectedPeo="TriNet" onSelect={vi.fn()} onProceed={vi.fn()} catalog={catalog} catalogStatus="ready" />);
    expect(screen.getAllByRole("button", { name: /^Choose / }).map((b) => b.textContent)).toEqual(["Choose Insperity"]);
    expect(screen.getByText("Prepared for TriNet.")).toBeInTheDocument();
  });

  it("still offers a PEO whose profile is out of date, with a warning that says when it was last checked", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 11, 12));
    const profile = (checked: string) => ({ version: 1, min_headcount: 5, sources: { min_headcount: { kind: "document", name: "Broker guide", checked_on: checked } } });
    const catalog = parsePeoCatalog([
      { id: 1, name: "Justworks", profile: profile("2026-05-15") },
      { id: 2, name: "TriNet", profile: profile("2026-05-01") },
    ]);
    render(<PEOMatchTab data={DEMO_CHAMBER_DATA} selectedPeo={null} onSelect={vi.fn()} onProceed={vi.fn()} catalog={catalog} catalogStatus="ready" />);
    vi.useRealTimers();
    expect(screen.getByRole("button", { name: "Choose TriNet" })).toBeInTheDocument();
    expect(screen.getByText("TriNet's profile was last checked 1 May 2026 and may be out of date.")).toBeInTheDocument();
    // Justworks was checked 180 days ago: not yet stale.
    expect(screen.queryByText(/Justworks's profile was last checked/)).not.toBeInTheDocument();
  });
});
