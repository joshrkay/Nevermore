import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DEMO_CHAMBER_DATA, EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import type { ProvenanceMap } from "@/data/provenance";
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

describe("ReviewTab needs your review", () => {
  const at = "2026-11-03T12:00:00Z";
  const said = (id: string) => ({ kind: "transcript" as const, message_id: id });
  const data = { ...EMPTY_CHAMBER_DATA, company_name: "Acme", pay_frequency: "Weekly", industry: "Retail", employee_count: 40 };
  const provenance: ProvenanceMap = {
    company_name: { status: "inferred", source: said("m1"), updated_at: at },
    pay_frequency: {
      status: "conflicting",
      source: said("m1"),
      updated_at: at,
      candidates: [
        { value: "Weekly", source: said("m1") },
        { value: "Bi-weekly", source: said("m2") },
      ],
    },
    industry: { status: "inferred", source: said("m1"), updated_at: at },
    employee_count: { status: "incomplete", source: said("m3"), updated_at: at },
  };
  // Each listed item reads as its reason, then its label, then its value and source.
  const expectListed = (expected: [reason: string, label: string][]) => {
    const section = screen.getByText(/^Needs your review/).parentElement!;
    const items = [...section.children].slice(1).map((item) => item.textContent ?? "");
    expect(items).toHaveLength(expected.length);
    expected.forEach(([reason, label], i) => expect(items[i]).toMatch(new RegExp(`^${reason}${label}`)));
  };

  it("lists the unsettled required items first, in order, then the other open fields, each once", () => {
    render(<ReviewTab data={data} provenance={provenance} onAction={() => {}} onProceed={() => {}} />);
    expect(screen.getByText("Needs your review — 6 items")).toBeInTheDocument();
    expectListed([
      ["Please confirm", "Company legal name"],
      ["Not provided", "States of operation"],
      ["Conflicting answers", "Pay frequency"],
      ["Not provided", "Employee census"],
      ["Incomplete", "Employee count"],
      ["Please confirm", "Industry"],
    ]);
    // A missing answer is offered to fill in, not shown as a value.
    expect(screen.getByRole("button", { name: "Add States of operation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use Bi-weekly for Pay frequency" })).toBeInTheDocument();
  });

  it("never lists a field an advisor verified", () => {
    render(
      <ReviewTab data={data} provenance={provenance} verified={new Set(["company_name", "industry"])} onAction={() => {}} onProceed={() => {}} />,
    );
    expect(screen.getByText("Needs your review — 4 items")).toBeInTheDocument();
    expectListed([
      ["Not provided", "States of operation"],
      ["Conflicting answers", "Pay frequency"],
      ["Not provided", "Employee census"],
      ["Incomplete", "Employee count"],
    ]);
  });

  it("still lists a required item that was never given, even if an advisor verified its field", () => {
    render(<ReviewTab data={EMPTY_CHAMBER_DATA} verified={new Set(["company_name", "census"])} onProceed={() => {}} />);
    expectListed([
      ["Not provided", "Company legal name"],
      ["Not provided", "States of operation"],
      ["Not provided", "Pay frequency"],
      ["Not provided", "Employee census"],
    ]);
  });

  it("leaves States of operation to the census's own item while only the census names states", () => {
    const census = [{ ...DEMO_CHAMBER_DATA.census[0], work_state: "OR" }];
    render(
      <ReviewTab
        data={{ ...data, census, states: [] }}
        provenance={{ ...provenance, census: { status: "inferred", source: said("m4"), updated_at: at } }}
        onAction={() => {}}
        onProceed={() => {}}
      />,
    );
    expectListed([
      ["Please confirm", "Company legal name"],
      ["Conflicting answers", "Pay frequency"],
      ["Please confirm", "Employee census"],
      ["Incomplete", "Employee count"],
      ["Please confirm", "Industry"],
    ]);
  });

  it("asks nothing when every required item is settled and nothing else is open", () => {
    render(<ReviewTab data={DEMO_CHAMBER_DATA} onProceed={() => {}} />);
    expect(screen.queryByText(/^Needs your review/)).not.toBeInTheDocument();
  });
});
