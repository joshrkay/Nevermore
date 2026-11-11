import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { DEMO_CHAMBER_DATA, EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import { applyFieldAction, FIELD_LABELS, type FieldKey, type IntakeState, type ProvenanceMap } from "@/data/provenance";
import ReviewTab from "./ReviewTab";
import { REVIEW_FIELDS } from "@/data/reviewFields";

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
  const stillNeeded = () =>
    [...screen.getByRole("region", { name: "Still needed" }).querySelectorAll("li")].map((li) => li.querySelector("span")?.textContent);

  it("puts required answers that block certification under still needed, and the unsettled ones first in review, each once", () => {
    render(<ReviewTab data={data} provenance={provenance} onAction={() => {}} onProceed={() => {}} />);
    // Missing and conflicting both hold certification back; the census is only recommended.
    expect(stillNeeded()).toEqual(["States of operation", "Pay frequency"]);
    expect(screen.getByRole("region", { name: "Still needed" })).toHaveTextContent("You've given two different answers");
    expect(screen.queryByText(/Every required answer is here/)).not.toBeInTheDocument();
    expect(screen.getByText("Needs your review — 3 items")).toBeInTheDocument();
    expectListed([
      ["Please confirm", "Company legal name"],
      ["Incomplete", "Employee count"],
      ["Please confirm", "Industry"],
    ]);
    // The conflict is resolved where the answer sits.
    expect(screen.getByRole("button", { name: "Use Bi-weekly for Pay frequency" })).toBeInTheDocument();
  });

  it("never lists a field an advisor verified", () => {
    render(
      <ReviewTab data={data} provenance={provenance} verified={new Set(["company_name", "industry"])} onAction={() => {}} onProceed={() => {}} />,
    );
    expect(screen.getByText("Needs your review — 1 item")).toBeInTheDocument();
    expectListed([["Incomplete", "Employee count"]]);
  });

  it("still needs a required answer in conflict, even if an advisor verified its field, as the database refuses it", () => {
    render(<ReviewTab data={data} provenance={provenance} verified={new Set(["pay_frequency"])} onAction={() => {}} onProceed={() => {}} />);
    expect(stillNeeded()).toEqual(["States of operation", "Pay frequency"]);
    expect(screen.getByRole("button", { name: "Choose pay frequency" })).toBeInTheDocument();
  });

  it("still needs a required answer that was never given, even if an advisor verified its field", () => {
    render(<ReviewTab data={EMPTY_CHAMBER_DATA} verified={new Set(["company_name", "census"])} onProceed={() => {}} />);
    expect(stillNeeded()).toEqual(["Company legal name", "States of operation", "Pay frequency"]);
    expect(screen.queryByText(/^Needs your review/)).not.toBeInTheDocument();
  });

  it("asks for the census to be confirmed while only the census names states", () => {
    const census = [{ ...DEMO_CHAMBER_DATA.census[0], work_state: "OR" }];
    render(
      <ReviewTab
        data={{ ...data, census, states: [] }}
        provenance={{ ...provenance, census: { status: "inferred", source: said("m4"), updated_at: at } }}
        onAction={() => {}}
        onProceed={() => {}}
      />,
    );
    expect(stillNeeded()).toEqual(["Pay frequency"]);
    expectListed([
      ["Please confirm", "Company legal name"],
      ["Please confirm", "Employee census"],
      ["Incomplete", "Employee count"],
      ["Please confirm", "Industry"],
    ]);
  });

  it("says the census's conflict holds the states back when the census alone names them", () => {
    const census = [{ ...DEMO_CHAMBER_DATA.census[0], work_state: "OR" }];
    const conflicting = { status: "conflicting" as const, source: said("m4"), updated_at: at, candidates: [] };
    render(<ReviewTab data={{ ...data, census, states: [] }} provenance={{ census: conflicting }} onProceed={() => {}} />);
    expect(stillNeeded()).toEqual(["States of operation"]);
    expect(screen.getByRole("region", { name: "Still needed" })).toHaveTextContent("The census's answers conflict");
    expect(screen.getByRole("button", { name: "Go to employee census" })).toBeInTheDocument();
    expect(screen.queryByText(/^Needs your review/)).not.toBeInTheDocument();
  });

  it("asks nothing when every required answer is settled and nothing else is open", () => {
    render(<ReviewTab data={DEMO_CHAMBER_DATA} onProceed={() => {}} />);
    expect(screen.queryByText(/^Needs your review/)).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Still needed" })).not.toBeInTheDocument();
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
  });

  describe("an answer an advisor verified, in its section's progress", () => {
    const at = "2026-11-04T00:00:00Z";
    const said = { kind: "transcript" as const, message_id: "m1" };
    // How many of a section's answers are settled, with these answers and verifications.
    const settled = (id: string, data: typeof complete, provenance: ProvenanceMap, verified: string[]) => {
      const { unmount } = render(<ReviewTab data={data} provenance={provenance} verified={new Set(verified)} onAction={() => {}} onProceed={() => {}} />);
      const count = Number(/^(\d+) of/.exec(screen.getByTestId(id).textContent ?? "")?.[1]);
      unmount();
      expect(count, `${id} says how many are settled`).not.toBeNaN(); // two NaNs would compare equal
      return count;
    };

    it("counts as settled", () => {
      const incomplete: ProvenanceMap = { pay_frequency: { status: "incomplete", source: said, updated_at: at } };
      expect(settled("progress-payroll", complete, incomplete, ["pay_frequency"])).toBe(settled("progress-payroll", complete, incomplete, []) + 1);
    });

    it("doesn't count one in required conflict: certification still needs it chosen", () => {
      const conflict: ProvenanceMap = {
        company_name: { status: "conflicting", source: said, updated_at: at, candidates: [{ value: "Acme", source: said }, { value: "Acme Press", source: said }] },
      };
      expect(settled("progress-company", complete, conflict, ["company_name"])).toBe(settled("progress-company", complete, conflict, []));
    });

    it("doesn't count one with no answer: verifying never supplies one", () => {
      // The status is one verification would settle, so only the missing answer keeps it open.
      const blank = { ...complete, pay_frequency: "" };
      const incomplete: ProvenanceMap = { pay_frequency: { status: "incomplete", source: said, updated_at: at } };
      expect(settled("progress-payroll", blank, incomplete, ["pay_frequency"])).toBe(settled("progress-payroll", blank, incomplete, []));
    });
  });

  it("lists every answer in the intake schema, each with its badge, and says how much of each section is settled (D28)", () => {
    const fields = Object.keys(FIELD_LABELS).filter((f) => f !== "census") as FieldKey[];
    expect(Object.values(REVIEW_FIELDS).flat().sort()).toEqual([...fields].sort());
    const inferred: ProvenanceMap = Object.fromEntries(
      fields.map((f) => [f, { status: "inferred", source: { kind: "transcript", message_id: "m1" }, updated_at: "2026-11-04T00:00:00Z" }]),
    );
    const data = { ...complete, industry: "Print", employee_count: 3, wc_carrier: "Hartford", has_handbook: true } as typeof complete;
    render(<ReviewTab data={data} provenance={inferred} onAction={() => {}} onProceed={() => {}} />);
    for (const name of ["Workers' comp", "Operations & HR"]) expect(section(name)).toBeInTheDocument();
    for (const f of ["company_name", "industry", "employee_count", "wc_carrier", "has_handbook"] as FieldKey[]) {
      const row = document.getElementById(`review-field-${f}`)!;
      expect(row, f).not.toBeNull();
      expect(within(row).getByText("Lenore captured this — please confirm"), f).toBeInTheDocument();
    }
    expect(screen.getByTestId("progress-company")).toHaveTextContent("2 of 16 settled");
    expect(screen.getByTestId("progress-locations")).toHaveTextContent("1 of 2 settled");
    expect(screen.getByTestId("progress-workforce")).toHaveTextContent("1 of 7 settled");
  });

  it("lets the prospect say an unanswered field doesn't apply, which closes it, and take that back", () => {
    function Harness() {
      const [state, setState] = useState<IntakeState>({ data: complete, provenance: {} });
      return (
        <ReviewTab
          data={state.data}
          provenance={state.provenance}
          onAction={(a) => setState((s) => applyFieldAction(s, a))}
          onProceed={() => {}}
        />
      );
    }
    render(<Harness />);
    // Not offered for an answer certification needs, nor for one already given.
    expect(screen.queryByRole("button", { name: "Pay frequency doesn't apply" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Company legal name doesn't apply" })).not.toBeInTheDocument();
    expect(screen.getByTestId("progress-workers_comp")).toHaveTextContent(`0 of ${REVIEW_FIELDS.workers_comp.length} settled`);

    fireEvent.click(screen.getByRole("button", { name: "Workers' comp carrier doesn't apply" }));
    const row = document.getElementById("review-field-wc_carrier")!;
    expect(within(row).getByText("Doesn't apply")).toBeInTheDocument();
    expect(screen.getByTestId("progress-workers_comp")).toHaveTextContent(`1 of ${REVIEW_FIELDS.workers_comp.length} settled`);

    fireEvent.click(screen.getByRole("button", { name: "Undo: Workers' comp carrier doesn't apply" }));
    expect(screen.queryByRole("button", { name: "Undo: Workers' comp carrier doesn't apply" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Workers' comp carrier doesn't apply" })).toBeInTheDocument();
    expect(screen.getByTestId("progress-workers_comp")).toHaveTextContent(`0 of ${REVIEW_FIELDS.workers_comp.length} settled`);
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
    expect(needed).toHaveTextContent("Still needed before your packet can be generated: 1");
    expect(needed).toHaveTextContent("Pay frequency");
    expect(needed).toHaveTextContent("How often employees are paid");
    expect(needed).not.toHaveTextContent("Company legal name");
    expect(screen.getByText(/You can choose a PEO now/)).toBeInTheDocument();

    rerender(<ReviewTab data={complete} onProceed={() => {}} />);
    expect(screen.queryByRole("region", { name: "Still needed" })).not.toBeInTheDocument();
    expect(screen.getByText(/Every required answer is here/)).toBeInTheDocument();
    expect(screen.queryByText(/You can choose a PEO now/)).not.toBeInTheDocument();
  });

  it("lists a required answer given two ways as still needed, and takes you to choose", () => {
    const conflict = {
      status: "conflicting" as const,
      source: { kind: "transcript" as const, message_id: "m1" },
      updated_at: "2026-11-01T12:00:00Z",
      candidates: [
        { value: "Acme", source: { kind: "transcript" as const, message_id: "m1" } },
        { value: "Acme LLC", source: { kind: "document" as const, document_id: "d1" } },
      ],
    };
    render(<ReviewTab data={complete} provenance={{ company_name: conflict, industry: conflict }} onProceed={() => {}} onAction={() => {}} />);
    const needed = section("Still needed");
    expect(needed).toHaveTextContent("Still needed before your packet can be generated: 1");
    expect(needed).toHaveTextContent("Company legal name");
    expect(needed).toHaveTextContent("You've given two different answers");
    // A recommended field in conflict stays in "Needs your review", never in what's needed.
    expect(needed).not.toHaveTextContent("Industry");
    expect(screen.queryByText(/Every required answer is here/)).not.toBeInTheDocument();
    expect(screen.getByText(/You can choose a PEO now/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Choose company legal name" }));
    expect(document.activeElement?.closest("#review-field-company_name")).not.toBeNull();
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

describe("ReviewTab section status and nav (C-1)", () => {
  const complete = { ...EMPTY_CHAMBER_DATA, company_name: "Acme", states: ["NY"], pay_frequency: "bi-weekly" };
  const at = "2026-11-04T00:00:00Z";
  const inferred = { status: "inferred" as const, source: { kind: "transcript" as const, message_id: "m1" }, updated_at: at };

  it("says where each section stands, in words, beside how much of it is settled", () => {
    render(<ReviewTab data={{ ...complete, industry: "Retail", census: DEMO_CHAMBER_DATA.census }} provenance={{ industry: inferred }} onProceed={() => {}} />);
    expect(screen.getByTestId("status-company")).toHaveTextContent("Needs confirmation");
    expect(screen.getByTestId("status-workforce")).toHaveTextContent("Complete");
    expect(screen.getByTestId("status-benefits")).toHaveTextContent("Complete");
    render(<ReviewTab data={EMPTY_CHAMBER_DATA} onProceed={() => {}} />);
    expect(screen.getAllByTestId("status-company").some((chip) => chip.textContent === "Incomplete")).toBe(true);
  });

  it("lets the prospect jump to a section from the list of sections", () => {
    render(<ReviewTab data={EMPTY_CHAMBER_DATA} provenance={{}} onAction={() => {}} onProceed={() => {}} />);
    const nav = screen.getByRole("navigation", { name: "Sections" });
    fireEvent.click(within(nav).getByRole("button", { name: /Payroll/ }));
    expect(document.activeElement?.closest("#review-section-payroll")).not.toBeNull();
    // Pay frequency is a required answer, so Payroll is incomplete; an empty recommended section owes nothing.
    expect(within(nav).getByRole("button", { name: /Payroll/ })).toHaveTextContent("Incomplete");
    expect(within(nav).getByRole("button", { name: /Workers' comp/ })).toHaveTextContent("Complete");
  });

  it("calls a section not applicable once every answer in it is marked so", () => {
    const na = { status: "not_applicable" as const, source: { kind: "prospect_edit" as const }, updated_at: at };
    const provenance = Object.fromEntries(REVIEW_FIELDS.workers_comp.map((field) => [field, na]));
    render(<ReviewTab data={complete} provenance={provenance} onProceed={() => {}} />);
    expect(screen.getByTestId("status-workers_comp")).toHaveTextContent("Not applicable");
  });
});

// K-2.1: a census without the columns PEOs ask for is accepted; Review says which are missing, once each.
describe("ReviewTab: columns the census lacks", () => {
  const complete = { ...EMPTY_CHAMBER_DATA, company_name: "Acme", states: ["NY"], pay_frequency: "bi-weekly" };
  const person = { id: "e1", first_name: "Ada", last_name: "L", work_state: "NY", compensation_type: "salary" as const, employment_type: "full_time" as const, classification: "w2" as const };

  it("lists each missing column under Recommended with how many people lack it, and still lets the prospect certify", () => {
    render(<ReviewTab data={{ ...complete, census: [{ ...person, gender: "F" }, { ...person, id: "e2", first_name: "Bo" }] }} provenance={{}} onProceed={() => {}} />);
    const recommended = screen.getByText("Recommended", { selector: "p" }).parentElement!;
    expect([...recommended.querySelectorAll("p")].slice(1).map((p) => p.textContent)).toEqual([
      "Gender on the census Missing for 1 of 2 people. Add it to your census file and upload the file again. You can certify without it.",
      "Hire date on the census Missing for 2 of 2 people. Add it to your census file and upload the file again. You can certify without it.",
      "COBRA status on the census Missing for 2 of 2 people. Add it to your census file and upload the file again. You can certify without it.",
      "Home state on the census Missing for 2 of 2 people. Add it to your census file and upload the file again. You can certify without it.",
    ]);
    expect(screen.getByRole("status")).toHaveTextContent("Every required answer is here");
  });

  it("lists none once every person has them", () => {
    render(<ReviewTab data={{ ...complete, census: [{ ...person, gender: "F", hire_date: "2019-04-01", cobra: false, home_state: "NY" }] }} provenance={{}} onProceed={() => {}} />);
    expect(screen.queryByText(/on the census/)).not.toBeInTheDocument();
  });
});

// K-3.1: a table of rows is read in Review and edited on its own tab.
describe("ReviewTab: tables of rows", () => {
  const complete = { ...EMPTY_CHAMBER_DATA, company_name: "Acme", states: ["NY"], pay_frequency: "bi-weekly" };

  it("shows each owner and officer in the workers' comp section, with no editor of its own", () => {
    render(<ReviewTab data={{ ...complete, owners_officers: [{ name: "Dana Reyes", ownership_percent: 60, covered: false }] }} provenance={{}} onAction={() => {}} onProceed={() => {}} />);
    const table = within(screen.getByRole("region", { name: "Workers' comp" })).getByRole("table", { name: "Owners and officers" });
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent("Dana Reyes—60%—No");
    expect(screen.queryByRole("button", { name: "Edit Owners and officers" })).not.toBeInTheDocument();
  });

  it("shows no table while none is listed", () => {
    render(<ReviewTab data={complete} provenance={{}} onProceed={() => {}} />);
    expect(screen.queryByRole("table", { name: "Owners and officers" })).not.toBeInTheDocument();
  });
});
