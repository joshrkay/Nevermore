import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
  // Whether a profile is out of date goes by the reader's today: pinned, so every test reads the same day.
  beforeEach(() => {
  });
  afterEach(() => vi.useRealTimers());

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

  it("says for each rule that it can't tell yet, instead of guessing at fit", () => {
    renderTab();
    const checks = within(screen.getByRole("list", { name: "Eligibility checks for TriNet" })).getAllByRole("listitem");
    expect(checks.map((c) => c.textContent)).toEqual([
      "Can't tell yet · Minimum headcount: TriNet's minimum headcount isn't checked yet.",
      "Can't tell yet · States served: TriNet's states served aren't checked yet.",
      "Can't tell yet · Excluded industries: TriNet's excluded industries aren't checked yet.",
      "Can't tell yet · Excluded class codes: TriNet's excluded class codes aren't checked yet.",
      "Can't tell yet · Minimum participation: TriNet's minimum participation isn't checked yet.",
    ]);
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

  const sourced = (name: string, rules: Record<string, unknown>, checked = "2026-11-02") => ({
    id: name.length, name,
    profile: { version: 1, ...rules, sources: Object.fromEntries(Object.keys(rules).map((r) => [r, { kind: "document", name: "Broker guide", checked_on: checked }])) },
  });

  it("shows each check with its icon, its outcome in words, the PEO's fact against the employer's, and when the rule was checked", () => {
    const catalog = parsePeoCatalog([sourced("Alpha PEO", { min_headcount: 50, states_served: ["CA", "TX"] }), sourced("Beta PEO", { min_headcount: 5 }, "2026-04-01")]);
    render(<PEOMatchTab data={{ ...DEMO_CHAMBER_DATA, employee_count: 8, states: ["CA"] }} selectedPeo={null} onSelect={vi.fn()} onProceed={vi.fn()} catalog={catalog} catalogStatus="ready" />);
    const alpha = within(screen.getByRole("list", { name: "Eligibility checks for Alpha PEO" })).getAllByRole("listitem");
    expect(alpha[0]).toHaveTextContent("Doesn't meet · Minimum headcount: Alpha PEO takes groups of 50 or more employees; this employer has 8.checked 2 Nov 2026");
    expect(alpha[0].querySelector("svg.lucide-triangle-alert")).not.toBeNull();
    expect(alpha[1]).toHaveTextContent("Meets · States served: Alpha PEO serves CA, TX; this employer operates in CA.checked 2 Nov 2026");
    expect(alpha[1].querySelector("svg.lucide-check")).not.toBeNull();
    expect(alpha[2]).toHaveTextContent("Can't tell yet · Excluded industries");
    expect(alpha[2].querySelector("svg.lucide-minus")).not.toBeNull();
    expect(alpha[2]).not.toHaveTextContent(/checked \d/);
    // A rule checked more than 180 days ago still counts, and says it may be out of date.
    const beta = within(screen.getByRole("list", { name: "Eligibility checks for Beta PEO" })).getAllByRole("listitem");
    expect(beta[0]).toHaveTextContent("Meets · Minimum headcount: Beta PEO takes groups of 5 or more employees; this employer has 8.checked 1 Apr 2026 · may be out of date");
  });

  it("warns about a check that isn't met and still offers the PEO, grouped by outcome and alphabetical in each group", () => {
    const catalog = parsePeoCatalog([sourced("Alpha PEO", { min_headcount: 50 }), { id: 9, name: "Beta PEO", profile: null }, sourced("Gamma PEO", { min_headcount: 60 })]);
    const onSelect = vi.fn();
    render(<PEOMatchTab data={{ ...DEMO_CHAMBER_DATA, employee_count: 8 }} selectedPeo={null} onSelect={onSelect} onProceed={vi.fn()} catalog={catalog} catalogStatus="ready" />);
    expect(screen.getByText("Alphabetical in each group. Nothing here is a ranking.")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Some checks can't be told yet · 1", "Beta PEO", "A check isn't met · 2", "Alpha PEO", "Gamma PEO", "Another PEO",
    ]);
    expect(within(screen.getByRole("list", { name: "Eligibility checks for Alpha PEO" }).parentElement!).getByText("A check that isn't met is a warning. You can still choose Alpha PEO.")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Eligibility checks for Beta PEO" }).parentElement!).queryByText(/isn't met is a warning/)).not.toBeInTheDocument();
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
    const profile = (checked: string) => ({ version: 1, min_headcount: 5, sources: { min_headcount: { kind: "document", name: "Broker guide", checked_on: checked } } });
    const catalog = parsePeoCatalog([
      { id: 1, name: "Justworks", profile: profile("2026-05-15") },
      { id: 2, name: "TriNet", profile: profile("2026-05-01") },
    ]);
    render(<PEOMatchTab data={DEMO_CHAMBER_DATA} selectedPeo={null} onSelect={vi.fn()} onProceed={vi.fn()} catalog={catalog} catalogStatus="ready" />);
    expect(screen.getByRole("button", { name: "Choose TriNet" })).toBeInTheDocument();
    expect(screen.getByText("TriNet's profile was last checked 1 May 2026 and may be out of date.")).toBeInTheDocument();
    // Justworks was checked 180 days ago: not yet stale.
    expect(screen.queryByText(/Justworks's profile was last checked/)).not.toBeInTheDocument();
  });
});
