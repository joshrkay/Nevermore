import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
    expect(screen.getByRole("region", { name: "Documents — 2 uploaded" })).toHaveTextContent("Incomplete");
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

describe("ReviewTab sections", () => {
  const complete = { ...EMPTY_CHAMBER_DATA, company_name: "Acme", states: ["NY", "NJ"], pay_frequency: "bi-weekly" };
  const section = (name: string) => screen.getByRole("region", { name });

  it("shows company, workforce, locations, payroll and benefits, each with what was captured", () => {
    render(
      <ReviewTab
        data={{
          ...complete,
          industry: "Bookbinding",
          employee_count: 0,
          hq_state: "NY",
          payroll_vendor: "Gusto",
          funding_days: 3,
          pto_types: ["Vacation", "Sick"],
          current_carrier: "Aetna",
          ancillary_benefits: ["Dental"],
          has_401k: false,
        }}
        onProceed={() => {}}
      />,
    );
    for (const name of ["Company", "Workforce", "Locations", "Payroll", "Benefits"]) expect(section(name)).toBeInTheDocument();
    expect(section("Company")).toHaveTextContent("Bookbinding");
    expect(section("Workforce")).toHaveTextContent("Employee count0"); // zero is an answer, not a dash
    expect(section("Locations")).toHaveTextContent("NY, NJ");
    expect(section("Payroll")).toHaveTextContent("Gusto");
    expect(section("Payroll")).toHaveTextContent("3 days");
    expect(section("Payroll")).toHaveTextContent("Vacation, Sick");
    expect(section("Benefits")).toHaveTextContent("Aetna");
    expect(section("Benefits")).toHaveTextContent("Retirement planNo");
    for (const name of ["Workers' comp", "Operations & HR"]) expect(section(name)).toBeInTheDocument();
  });

  it("lists every intake field in its section, with the same grouping as The Manuscript", () => {
    render(<ReviewTab data={EMPTY_CHAMBER_DATA} onProceed={() => {}} onAction={() => {}} />);
    for (const field of Object.keys(EMPTY_CHAMBER_DATA)) {
      if (field === "census") continue;
      expect(document.getElementById(`review-field-${field}`), `${field} is not in the Review`).not.toBeNull();
    }
    expect(within(section("Workers' comp")).getByText("Workers' comp carrier")).toBeInTheDocument();
    expect(within(section("Operations & HR")).getByText("Business goals")).toBeInTheDocument();
    expect(within(section("Workforce")).getByText(/Employee census/)).toBeInTheDocument();
  });

  it("shows each section's status, and lets the prospect jump to one", () => {
    const at = "2026-11-04T00:00:00Z";
    render(
      <ReviewTab
        data={{ ...complete, industry: "Bookbinding", wc_carrier: null }}
        provenance={{
          company_name: { status: "confirmed", source: { kind: "prospect_edit" }, updated_at: at },
          states: { status: "confirmed", source: { kind: "prospect_edit" }, updated_at: at },
          industry: { status: "inferred", source: { kind: "transcript", message_id: "m1" }, updated_at: at },
          pay_frequency: { status: "confirmed", source: { kind: "prospect_edit" }, updated_at: at },
          current_carrier: { status: "unknown", source: { kind: "transcript", message_id: "m1" }, updated_at: at },
          wc_carrier: { status: "not_applicable", source: { kind: "prospect_edit" }, updated_at: at },
          wc_renewal_date: { status: "not_applicable", source: { kind: "prospect_edit" }, updated_at: at },
          wc_experience_mod: { status: "not_applicable", source: { kind: "prospect_edit" }, updated_at: at },
          wc_annual_premium: { status: "not_applicable", source: { kind: "prospect_edit" }, updated_at: at },
        }}
        onProceed={() => {}}
        onAction={() => {}}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Sections" });
    const chip = (name: string) => within(nav).getByRole("button", { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) });
    expect(chip("Company")).toHaveTextContent("Needs confirmation"); // the inferred industry
    expect(chip("Locations")).toHaveTextContent("Complete");
    expect(chip("Payroll")).toHaveTextContent("Complete");
    expect(chip("Benefits")).toHaveTextContent("Incomplete"); // the carrier the prospect doesn't know yet
    expect(chip("Workers' comp")).toHaveTextContent("Not applicable");
    expect(chip("Workforce")).toHaveTextContent("Incomplete"); // the recommended census
    expect(screen.getByRole("status", { name: "Ready to certify" })).toBeInTheDocument();

    fireEvent.click(chip("Benefits"));
    expect(section("Benefits").querySelector("button")).toHaveFocus();
    const review = screen.getByRole("region", { name: "Needs your review" });
    expect(review).toHaveTextContent("Current carrier");
    expect(review).toHaveTextContent("You said you didn't know this yet");
    expect(review).toHaveTextContent("Industry");
    expect(review).toHaveTextContent("Lenore took this from the conversation");
  });

  it("lets the prospect mark an answer that doesn't apply, and never a required one", () => {
    const onAction = vi.fn();
    render(<ReviewTab data={complete} onProceed={() => {}} onAction={onAction} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Workers' comp carrier as not applicable" }));
    expect(onAction).toHaveBeenCalledWith({ type: "not_applicable", field: "wc_carrier" });
    expect(screen.queryByRole("button", { name: "Mark Company legal name as not applicable" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark Pay frequency as not applicable" })).not.toBeInTheDocument();
  });

  it("blocks certification on a required answer that is conflicting or incomplete, and says what to do", () => {
    const at = "2026-11-04T00:00:00Z";
    render(
      <ReviewTab
        data={complete}
        provenance={{ company_name: { status: "conflicting", source: { kind: "transcript", message_id: "m1" }, updated_at: at, candidates: [] } }}
        onProceed={() => {}}
        onAction={() => {}}
      />,
    );
    const needed = section("Still needed");
    expect(needed).toHaveTextContent("Still needed before The Manuscript can be generated: 1");
    expect(needed).toHaveTextContent("Company legal name");
    expect(needed).toHaveTextContent("Two different answers were given. Choose the right one.");
  });

  it("marks the required answers wherever they sit, and only those", () => {
    render(<ReviewTab data={EMPTY_CHAMBER_DATA} onProceed={() => {}} />);
    const marked = (name: string) => [...section(name).querySelectorAll("p")].filter((p) => p.textContent?.endsWith("Required")).map((p) => p.textContent);
    expect(marked("Company")).toEqual(["Company legal nameRequired"]);
    expect(marked("Locations")).toEqual(["States of operationRequired"]);
    expect(marked("Payroll")).toEqual(["Pay frequencyRequired"]);
    expect(marked("Workforce")).toEqual([]);
    expect(marked("Benefits")).toEqual([]);
    expect(section("Workforce")).toHaveTextContent("Employee censusRecommended");
  });

  it("lists what's still needed, says why, and says so once nothing is", () => {
    const { rerender } = render(<ReviewTab data={{ ...complete, pay_frequency: null }} onProceed={() => {}} />);
    const needed = section("Still needed");
    expect(needed).toHaveTextContent("Still needed before The Manuscript can be generated: 1");
    expect(needed).toHaveTextContent("Pay frequency");
    expect(needed).toHaveTextContent("How often employees are paid");
    expect(needed).not.toHaveTextContent("Company legal name");
    expect(screen.getByText(/You can choose a PEO now/)).toBeInTheDocument();

    rerender(<ReviewTab data={complete} onProceed={() => {}} />);
    expect(screen.queryByRole("region", { name: "Still needed" })).not.toBeInTheDocument();
    expect(screen.getByText(/Every required answer is here/)).toBeInTheDocument();
    expect(screen.queryByText(/You can choose a PEO now/)).not.toBeInTheDocument();
  });

  it("never lists the census as needed, only as recommended", () => {
    render(<ReviewTab data={complete} onProceed={() => {}} />);
    expect(screen.getByText(/Every required answer is here/)).toBeInTheDocument();
    // Beside the census itself, and as a non-blocking item in the review list.
    expect(screen.getAllByText("Recommended")).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Needs your review" })).toHaveTextContent("Employee census");
    expect(screen.getByText(/Upload a census on the Upload tab/)).toBeInTheDocument();
  });

  it("takes you to a missing answer, ready to add it", () => {
    render(<ReviewTab data={EMPTY_CHAMBER_DATA} onProceed={() => {}} onAction={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Go to pay frequency" }));
    expect(screen.getByRole("button", { name: "Add Pay frequency" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Go to states of operation" }));
    expect(screen.getByRole("button", { name: "Add States of operation" })).toHaveFocus();
  });

  it("edits an answer in place, with no need to restart the conversation", () => {
    const onAction = vi.fn();
    render(<ReviewTab data={{ ...complete, pay_frequency: null }} onProceed={() => {}} onAction={onAction} />);
    fireEvent.click(screen.getByRole("button", { name: "Add Pay frequency" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Pay frequency" }), { target: { value: "weekly" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onAction).toHaveBeenCalledWith({ type: "edit", field: "pay_frequency", value: "weekly" });

    fireEvent.click(within(section("Benefits")).getByRole("button", { name: "Add Current carrier" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Current carrier" }), { target: { value: "Aetna" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onAction).toHaveBeenLastCalledWith({ type: "edit", field: "current_carrier", value: "Aetna" });
  });

  it("is read-only without an edit handler", () => {
    render(<ReviewTab data={EMPTY_CHAMBER_DATA} onProceed={() => {}} />);
    expect(screen.queryByRole("button", { name: /^Add / })).not.toBeInTheDocument();
  });
});
