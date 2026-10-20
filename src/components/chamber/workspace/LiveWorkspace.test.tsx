import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DEMO_CHAMBER_DATA, EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import LiveWorkspace from "./LiveWorkspace";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const TABS = [
  ["① Upload", "Drop your documents here."],
  ["② Company", "Company Profile"],
  ["③ Payroll", "Payroll & Time"],
  ["④ Benefits", "Benefits"],
  ["⑤ Your Team", "Employee Census"],
  ["⑥ Dependents", "Dependents"],
  ["⑦ Review", "Review"],
  ["⑧ PEO Match", "PEO Match"],
  ["⑨ The Reckoning", "The Reckoning"],
] as const;

describe("LiveWorkspace", () => {
  it.each([
    ["demo data", DEMO_CHAMBER_DATA],
    ["empty data", EMPTY_CHAMBER_DATA],
  ])("renders every tab with %s", (_label, data) => {
    render(
      <MemoryRouter>
        <LiveWorkspace data={data} isDemo={false} sessionId="s1" onSubmit={async () => true} />
      </MemoryRouter>,
    );
    for (const [tab, heading] of TABS) {
      fireEvent.click(screen.getByRole("button", { name: tab }));
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
  });

  it("moves from Review to PEO Match to The Reckoning", () => {
    render(
      <MemoryRouter>
        <LiveWorkspace data={DEMO_CHAMBER_DATA} isDemo={false} sessionId="s1" onSubmit={async () => true} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "⑦ Review" }));
    fireEvent.click(screen.getByRole("button", { name: "See Your PEO Matches →" }));
    expect(screen.getByRole("heading", { name: "PEO Match" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Proceed with .+ →$/ }));
    expect(screen.getByRole("heading", { name: "The Reckoning" })).toBeInTheDocument();
  });

  it("carries the chosen PEO into The Reckoning", () => {
    render(
      <MemoryRouter>
        <LiveWorkspace data={DEMO_CHAMBER_DATA} isDemo={false} sessionId="s1" onSubmit={async () => true} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "⑧ PEO Match" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose Rippling" }));
    expect(screen.getByText("✓ Selected").closest("div.rounded-xl")).toHaveTextContent("Rippling");
    fireEvent.click(screen.getByRole("button", { name: "Proceed with Rippling →" }));
    expect(screen.getByText(/ships to Rippling/)).toBeInTheDocument();
    expect(screen.getByText(/obtain a quote from Rippling/)).toBeInTheDocument();
    expect(screen.queryByText(/TriNet/)).not.toBeInTheDocument();
  });
});
