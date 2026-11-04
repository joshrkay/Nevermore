import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DEMO_CHAMBER_DATA, EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import type { ProvenanceMap } from "@/data/provenance";
import LiveWorkspace from "./LiveWorkspace";
import { expectEveryControlNamed } from "@/test/a11y";

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
      fireEvent.click(screen.getByRole("tab", { name: tab }));
      expect(screen.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tabpanel", { name: tab })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
  });

  it.each([
    ["demo data", DEMO_CHAMBER_DATA],
    ["empty data", EMPTY_CHAMBER_DATA],
  ])("names every control on every step with %s", (_label, data) => {
    render(
      <MemoryRouter>
        <LiveWorkspace data={data} isDemo={false} sessionId="s1" onSubmit={async () => true} onFieldAction={() => {}} />
      </MemoryRouter>,
    );
    for (const [tab] of TABS) {
      fireEvent.click(screen.getByRole("tab", { name: tab }));
      expectEveryControlNamed();
    }
  });

  it("is a tab list the keyboard reaches once and moves through with the arrows, Home and End", () => {
    render(
      <MemoryRouter>
        <LiveWorkspace data={EMPTY_CHAMBER_DATA} isDemo={false} sessionId="s1" onSubmit={async () => true} />
      </MemoryRouter>,
    );
    const list = screen.getByRole("tablist", { name: "Intake steps" });
    const tabs = within(list).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(TABS.map(([tab]) => tab));
    // One stop in the tab order: the selected step.
    expect(tabs.filter((t) => t.tabIndex === 0)).toEqual([screen.getByRole("tab", { name: "① Upload" })]);

    const upload = screen.getByRole("tab", { name: "① Upload" });
    upload.focus();
    fireEvent.keyDown(upload, { key: "ArrowRight" });
    const company = screen.getByRole("tab", { name: "② Company" });
    expect(company).toHaveFocus();
    expect(company).toHaveAttribute("aria-selected", "true");
    expect(company).toHaveAttribute("tabindex", "0");
    expect(upload).toHaveAttribute("aria-selected", "false");
    expect(upload).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("heading", { name: "Company Profile" })).toBeInTheDocument();

    fireEvent.keyDown(company, { key: "End" });
    expect(screen.getByRole("tab", { name: "⑨ The Reckoning" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("tab", { name: "⑨ The Reckoning" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "① Upload" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("tab", { name: "① Upload" }), { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: "⑨ The Reckoning" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("tab", { name: "⑨ The Reckoning" }), { key: "Home" });
    expect(screen.getByRole("tab", { name: "① Upload" })).toHaveFocus();
    expect(screen.getByRole("tabpanel", { name: "① Upload" })).toBeInTheDocument();
  });

  it("gives the Your Team tab the census's status and a Confirm button, as every other answer has", () => {
    const provenance: ProvenanceMap = {
      census: { status: "inferred", source: { kind: "document", document_id: "d1", document_name: "Roster.xlsx" }, updated_at: "2026-11-03T12:00:00Z" },
    };
    const onFieldAction = vi.fn();
    render(
      <MemoryRouter>
        <LiveWorkspace data={DEMO_CHAMBER_DATA} isDemo={false} sessionId="s1" onSubmit={async () => true} provenance={provenance} onFieldAction={onFieldAction} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("tab", { name: "⑤ Your Team" }));
    expect(screen.getByText("From Roster.xlsx")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm Census" }));
    expect(onFieldAction).toHaveBeenCalledWith({ type: "confirm", field: "census" });
  });

  it("in Review, keeps a verified required conflict choosable, settles a verified optional answer and shows what else was heard", () => {
    const at = "2026-11-03T12:00:00Z";
    const said = (id: string) => ({ kind: "transcript" as const, message_id: id });
    const provenance: ProvenanceMap = {
      company_name: {
        status: "conflicting",
        source: said("m1"),
        updated_at: at,
        candidates: [{ value: "Acme Bindery", source: said("m1") }, { value: "Acme Press", source: said("m2") }],
      },
      employee_count: {
        status: "inferred",
        source: said("m3"),
        updated_at: at,
        also_heard: [{ value: 45, source: { kind: "document", document_id: "d1", document_name: "Payroll.xlsx" } }],
      },
    };
    render(
      <MemoryRouter>
        <LiveWorkspace
          data={{ ...DEMO_CHAMBER_DATA, company_name: "Acme Bindery", employee_count: 40 }}
          isDemo={false}
          sessionId="s1"
          onSubmit={async () => true}
          provenance={provenance}
          verified={new Set(["company_name", "employee_count"])}
          onFieldAction={() => {}}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("tab", { name: "⑦ Review" }));
    // The required conflict blocks certification whoever verified it, so its rival answers stay choosable.
    expect(screen.getAllByRole("button", { name: /^Use Acme Press for / }).length).toBeGreaterThan(0);
    // The optional answer is settled by the advisor: badged, not offered for confirmation, and its note is shown.
    expect(screen.getAllByText("Verified by your advisor")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /^Confirm Employee/ })).not.toBeInTheDocument();
    expect(screen.getByText("Also heard: 45 — From Payroll.xlsx")).toBeInTheDocument();
  });

  it("moves from Review to PEO Match to The Reckoning", () => {
    render(
      <MemoryRouter>
        <LiveWorkspace data={DEMO_CHAMBER_DATA} isDemo={false} sessionId="s1" onSubmit={async () => true} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("tab", { name: "⑦ Review" }));
    fireEvent.click(screen.getByRole("button", { name: "See Your PEO Matches →" }));
    expect(screen.getByRole("heading", { name: "PEO Match" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue without choosing a PEO →" }));
    expect(screen.getByRole("heading", { name: "The Reckoning" })).toBeInTheDocument();
  });

  it("carries the chosen PEO into The Reckoning", () => {
    render(
      <MemoryRouter>
        <LiveWorkspace data={DEMO_CHAMBER_DATA} isDemo={false} sessionId="s1" onSubmit={async () => true} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("tab", { name: "⑧ PEO Match" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose Rippling" }));
    expect(screen.getByText("✓ Selected").closest("div.rounded-xl")).toHaveTextContent("Rippling");
    fireEvent.click(screen.getByRole("button", { name: "Proceed with Rippling →" }));
    expect(screen.getByText(/prepared for Rippling/)).toBeInTheDocument();
    expect(screen.getByText(/send to Rippling myself/)).toBeInTheDocument();
    expect(screen.queryByText(/TriNet/)).not.toBeInTheDocument();
  });

  it("carries a PEO the prospect typed in, not just the listed ones, into The Reckoning", () => {
    render(
      <MemoryRouter>
        <LiveWorkspace data={DEMO_CHAMBER_DATA} isDemo={false} sessionId="s1" onSubmit={async () => true} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("tab", { name: "⑧ PEO Match" }));
    fireEvent.change(screen.getByLabelText("Another PEO"), { target: { value: "Acme PEO" } });
    fireEvent.click(screen.getByRole("button", { name: "Use this PEO" }));
    fireEvent.click(screen.getByRole("button", { name: "Proceed with Acme PEO →" }));
    expect(screen.getByText(/prepared for Acme PEO/)).toBeInTheDocument();
    expect(screen.getByText(/send to Acme PEO myself/)).toBeInTheDocument();
  });

  it("shows the PEO kept with the intake, and hands a new choice back to be saved", () => {
    const onChoosePeo = vi.fn();
    const { rerender } = render(
      <MemoryRouter>
        <LiveWorkspace data={DEMO_CHAMBER_DATA} isDemo={false} sessionId="s1" onSubmit={async () => true} chosenPeo="Insperity" onChoosePeo={onChoosePeo} />
      </MemoryRouter>,
    );
    // Opened straight on The Reckoning, as after a reload: the saved choice is already there.
    fireEvent.click(screen.getByRole("tab", { name: "⑨ The Reckoning" }));
    expect(screen.getByText(/prepared for Insperity/)).toBeInTheDocument();
    expect(screen.getByText(/send to Insperity myself/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "⑧ PEO Match" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose TriNet" }));
    expect(onChoosePeo).toHaveBeenCalledWith("TriNet");
    // What is shown is what the intake holds, not a copy kept here.
    expect(screen.getByText("✓ Selected").closest("div.rounded-xl")).toHaveTextContent("Insperity");
    rerender(
      <MemoryRouter>
        <LiveWorkspace data={DEMO_CHAMBER_DATA} isDemo={false} sessionId="s1" onSubmit={async () => true} chosenPeo="TriNet" onChoosePeo={onChoosePeo} />
      </MemoryRouter>,
    );
    expect(screen.getByText("✓ Selected").closest("div.rounded-xl")).toHaveTextContent("TriNet");
  });

  it("goes from The Reckoning back to Review to add a missing answer", () => {
    render(
      <MemoryRouter>
        <LiveWorkspace data={{ ...DEMO_CHAMBER_DATA, pay_frequency: null }} isDemo={false} sessionId="s1" onSubmit={async () => true} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("tab", { name: "⑨ The Reckoning" }));
    fireEvent.click(screen.getByRole("button", { name: "Go to Review" }));
    expect(screen.getByRole("heading", { name: "Review" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Still needed" })).toHaveTextContent("Pay frequency");
  });

  it("opens Review with the keyboard on it when the prospect chooses to fill the intake in themselves", () => {
    const view = (openReview: number) => (
      <MemoryRouter>
        <LiveWorkspace data={DEMO_CHAMBER_DATA} isDemo={false} sessionId="s1" onSubmit={async () => true} openReview={openReview} />
      </MemoryRouter>
    );
    const { rerender } = render(view(0));
    expect(screen.queryByRole("heading", { name: "Review" })).not.toBeInTheDocument();
    rerender(view(1));
    expect(screen.getByRole("heading", { name: "Review" })).toHaveFocus();
    // Asking again after moving elsewhere brings it back.
    fireEvent.click(screen.getByRole("tab", { name: "② Company" }));
    rerender(view(2));
    expect(screen.getByRole("heading", { name: "Review" })).toHaveFocus();
  });

  it("reaches The Reckoning with no PEO chosen without naming or inventing one", () => {
    render(
      <MemoryRouter>
        <LiveWorkspace data={DEMO_CHAMBER_DATA} isDemo={false} sessionId="s1" onSubmit={async () => true} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("tab", { name: "⑨ The Reckoning" }));
    expect(screen.getByText(/prepared for your PEO/)).toBeInTheDocument();
    expect(screen.getByText(/send to the PEO I choose myself/)).toBeInTheDocument();
    expect(screen.queryByText(/null|undefined|TriNet|Justworks|Rippling/)).not.toBeInTheDocument();
  });

  it("treats the fields an advisor verified as settled in Review", () => {
    const provenance: ProvenanceMap = {
      company_name: { status: "inferred", source: { kind: "transcript", message_id: "m1" }, updated_at: "2026-11-03T12:00:00Z" },
    };
    const mount = (verified?: ReadonlySet<string>) => (
      <MemoryRouter>
        <LiveWorkspace data={DEMO_CHAMBER_DATA} isDemo={false} sessionId="s1" onSubmit={async () => true} provenance={provenance} verified={verified} />
      </MemoryRouter>
    );
    const { rerender } = render(mount());
    fireEvent.click(screen.getByRole("tab", { name: "⑦ Review" }));
    expect(screen.getByText("Needs your review — 1 item")).toBeInTheDocument();
    rerender(mount(new Set(["company_name"])));
    expect(screen.queryByText(/^Needs your review/)).not.toBeInTheDocument();
  });

  it("badges a field the advisor verified as such in the Review tab's Company section", () => {
    const provenance: ProvenanceMap = {
      company_name: { status: "inferred", source: { kind: "transcript", message_id: "m1" }, updated_at: "2026-11-03T12:00:00Z" },
    };
    const mount = (verified?: ReadonlySet<string>) => (
      <MemoryRouter>
        <LiveWorkspace data={{ ...DEMO_CHAMBER_DATA, company_name: "Acme Bindery" }} isDemo={false} sessionId="s1" onSubmit={async () => true} provenance={provenance} verified={verified} onFieldAction={() => {}} />
      </MemoryRouter>
    );
    const { rerender } = render(mount());
    fireEvent.click(screen.getByRole("tab", { name: "⑦ Review" }));
    expect(screen.queryByText("Verified by your advisor")).not.toBeInTheDocument();
    // Listed under Needs your review and in the Company section.
    expect(screen.getAllByRole("button", { name: /^Confirm / })).toHaveLength(2);
    rerender(mount(new Set(["company_name"])));
    // Settled, so it is no longer listed for review, and the Company section's row carries the badge.
    expect(screen.getAllByText("Verified by your advisor")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /^Confirm / })).not.toBeInTheDocument();
  });
});
