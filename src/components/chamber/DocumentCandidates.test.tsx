import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { EMPTY_CHAMBER_DATA, type CensusEmployee } from "@/data/chamberTypes";
import type { DocumentExtraction } from "@/data/documentCandidates";
import DocumentCandidates from "./DocumentCandidates";

const extraction: DocumentExtraction = {
  message: null,
  notes: [],
  kept: {},
  applied: {},
  candidates: [
    { field: "pay_frequency", value: "Bi-weekly", location: "Page 2" },
    { field: "current_carrier", value: "Aetna", location: "Page 1" },
    { field: "payroll_vendor", value: "ADP", location: "Page 2" },
  ],
};
const data = { ...EMPTY_CHAMBER_DATA, payroll_vendor: "Gusto" };

const person = (id: string, first: string, over: Partial<CensusEmployee> = {}): CensusEmployee => ({
  id,
  first_name: first,
  last_name: "Lee",
  work_state: "CA",
  job_title: "Dev",
  annual_salary: 100000,
  compensation_type: "salary",
  employment_type: "full_time",
  classification: "w2",
  age: 40,
  ...over,
});

describe("DocumentCandidates", () => {
  it("labels candidates with their document and location", () => {
    render(<DocumentCandidates fileName="sbc.pdf" extraction={extraction} data={data} onResolve={() => {}} />);
    expect(screen.getByLabelText("Found in sbc.pdf")).toBeInTheDocument();
    expect(screen.getByText(/Current carrier/)).toHaveTextContent("· Page 1");
    expect(screen.getByText("Your intake has: Gusto")).toBeInTheDocument();
  });

  it("applies all new values without touching an existing answer", () => {
    const onResolve = vi.fn();
    render(<DocumentCandidates fileName="sbc.pdf" extraction={extraction} data={data} onResolve={onResolve} />);
    fireEvent.click(screen.getByRole("button", { name: "Apply all new (2)" }));
    const [resolution] = onResolve.mock.calls[0];
    expect(resolution.type).toBe("apply");
    expect(resolution.candidates.map((c: { field: string }) => c.field)).toEqual(["pay_frequency", "current_carrier"]);
  });

  it("settles a value that differs from the intake's only in the dialog, where nothing is chosen for them", () => {
    const onResolve = vi.fn();
    render(<DocumentCandidates fileName="sbc.pdf" extraction={extraction} data={data} onResolve={onResolve} />);
    fireEvent.click(screen.getByRole("button", { name: "Resolve Payroll vendor" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Gusto")).toBeInTheDocument();
    expect(within(dialog).getByText("ADP")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Confirm" })).toBeDisabled();
    expect(onResolve).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByLabelText(/ADP/));
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));
    expect(onResolve).toHaveBeenCalledWith({ type: "use_document", candidate: extraction.candidates[2] });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the prospect's own answer when they choose it, and cancelling changes nothing", () => {
    const onResolve = vi.fn();
    render(<DocumentCandidates fileName="sbc.pdf" extraction={extraction} data={data} onResolve={onResolve} />);
    fireEvent.click(screen.getByRole("button", { name: "Resolve Payroll vendor" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onResolve).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Resolve Payroll vendor" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByLabelText(/Gusto/));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onResolve).toHaveBeenCalledWith({ type: "keep_current", candidate: extraction.candidates[2] });
  });

  it("shows applied and kept values as settled", () => {
    render(
      <DocumentCandidates
        fileName="sbc.pdf"
        extraction={{ ...extraction, applied: { pay_frequency: "2026-10-20T00:00:00Z" }, kept: { payroll_vendor: "2026-10-20T00:00:00Z" } }}
        data={data}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByText("Applied")).toBeInTheDocument();
    expect(screen.getByText("Kept yours")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Apply all new/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Resolve/ })).not.toBeInTheDocument();
  });

  it("lists what was found read-only when the intake can't be edited from here", () => {
    render(<DocumentCandidates fileName="sbc.pdf" extraction={extraction} data={data} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("tells the prospect how the file was read, even when nothing was found", () => {
    render(
      <DocumentCandidates
        fileName="roster.csv"
        extraction={{ ...extraction, candidates: [], notes: ["The SSN column wasn't read."] }}
        data={data}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByLabelText("About this file")).toHaveTextContent("The SSN column wasn't read.");
  });
});

describe("DocumentCandidates: a census", () => {
  const rows = [person("a", "Ann"), person("b", "Bo", { age: undefined, work_state: "" }), ...["Cy", "Di", "Ed", "Flo"].map((n, i) => person(`c${i}`, n))];
  const census: DocumentExtraction = {
    ...extraction,
    candidates: [{ field: "census", value: rows, location: "Sheet Roster, rows 2–7" }],
  };

  it("previews the people found, flags rows missing underwriting details, and applies a new census directly", () => {
    const onResolve = vi.fn();
    render(<DocumentCandidates fileName="roster.xlsx" extraction={census} data={EMPTY_CHAMBER_DATA} onResolve={onResolve} />);
    const preview = screen.getByLabelText("Employees found");
    expect(within(preview).getByText("Ann Lee")).toBeInTheDocument();
    expect(within(preview).getByText("and 1 more")).toBeInTheDocument();
    expect(within(preview).getByText("1 of 6 is missing an age, work state, title, or salary.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Apply Employee census" }));
    expect(onResolve).toHaveBeenCalledWith({ type: "apply", candidates: [census.candidates[0]] });
  });

  it("compares with an existing census and merges by default, losing no one", () => {
    const onResolve = vi.fn();
    const existing = { ...EMPTY_CHAMBER_DATA, census: [person("x", "Ann", { job_title: "Designer" }), person("y", "Zed")] };
    render(<DocumentCandidates fileName="roster.xlsx" extraction={census} data={existing} onResolve={onResolve} />);
    fireEvent.click(screen.getByRole("button", { name: "Resolve Employee census" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Differences")).toHaveTextContent("1 in both, 1 with different details · 5 only in this file · 1 only in your intake");
    expect(within(dialog).getByLabelText("Differences")).toHaveTextContent("Ann Lee: title Designer → Dev");
    expect(within(dialog).getByLabelText("Differences")).toHaveTextContent("Only in your intake: Zed Lee");
    expect(within(dialog).getByLabelText(/Merge/)).toBeChecked();

    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));
    expect(onResolve).toHaveBeenCalledWith({ type: "merge_census", candidate: census.candidates[0] });
  });

  it("can replace the census with the file's, or keep the current one", () => {
    const onResolve = vi.fn();
    const existing = { ...EMPTY_CHAMBER_DATA, census: [person("y", "Zed")] };
    const { unmount } = render(<DocumentCandidates fileName="roster.xlsx" extraction={census} data={existing} onResolve={onResolve} />);
    fireEvent.click(screen.getByRole("button", { name: "Resolve Employee census" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByLabelText(/Replace/));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onResolve).toHaveBeenLastCalledWith({ type: "use_document", candidate: census.candidates[0] });
    unmount();

    render(<DocumentCandidates fileName="roster.xlsx" extraction={census} data={existing} onResolve={onResolve} />);
    fireEvent.click(screen.getByRole("button", { name: "Resolve Employee census" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByLabelText(/Keep my census/));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onResolve).toHaveBeenLastCalledWith({ type: "keep_current", candidate: census.candidates[0] });
  });
});
