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
    expect(section("Benefits")).toHaveTextContent("No retirement plan");
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
    // In the summary at the top, and beside the census itself.
    expect(screen.getAllByText("Recommended")).toHaveLength(2);
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
