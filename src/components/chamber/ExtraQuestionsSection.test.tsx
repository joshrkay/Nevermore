import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import type { ExtraAnswers } from "@/data/extraAnswers";
import type { ExtraQuestion } from "@/data/peoProfiles";
import ExtraQuestionsSection from "./ExtraQuestionsSection";

const QUESTIONS: ExtraQuestion[] = [
  { key: "vehicles", text: "Do employees drive for work?", kind: "yes_no" },
  { key: "fleet_size", text: "How many company vehicles?", kind: "number" },
  { key: "union", text: "Which union, if any?", kind: "choice", choices: ["None", "Teamsters"] },
  { key: "notes", text: "Anything else we should know?", kind: "text" },
];
const NOW = new Date("2026-11-13T10:00:00Z");
const confirmed = { status: "confirmed" as const, source: { kind: "prospect_edit" as const }, updated_at: NOW.toISOString() };

/** The section with its answers held as the intake holds them, so typing reads back what was saved. */
const Harness = ({ initial = {}, onChange }: { initial?: ExtraAnswers; onChange?: (a: ExtraAnswers) => void }) => {
  const [answers, setAnswers] = useState<ExtraAnswers>(initial);
  return (
    <ExtraQuestionsSection
      peo={{ id: 3, name: "TriNet" }}
      questions={QUESTIONS}
      answers={answers}
      now={() => NOW}
      onChange={(update) => setAnswers((prev) => { const next = update(prev); onChange?.(next); return next; })}
    />
  );
};

describe("ExtraQuestionsSection: Questions from <PEO>", () => {
  it("says whose questions they are, that they go only to that PEO and never block certifying, and how many are answered", () => {
    render(<Harness initial={{ "3": { vehicles: { question: QUESTIONS[0].text, kind: "yes_no", value: true, ...confirmed } } }} />);
    const section = screen.getByRole("region", { name: "Questions from TriNet" });
    expect(section).toHaveTextContent("TriNet asks these on top of the usual questions. Your answers go only to TriNet. You can certify without them, and come back to them later.");
    expect(section).toHaveTextContent("1 of 4 answered");
    expect(within(section).getByRole("progressbar", { name: "Questions from TriNet answered" })).toHaveAttribute("aria-valuenow", "1");
    expect(section).toHaveTextContent("Changing an answer after you certify means certifying again.");
    expect(section).not.toHaveTextContent(/required/i);
  });

  it("gives each question the control its kind takes, and saves each answer as it is typed", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const yesNo = screen.getByRole("radiogroup", { name: "Do employees drive for work?" });
    fireEvent.click(within(yesNo).getByRole("radio", { name: "Yes" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "How many company vehicles?" }), { target: { value: "4" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Which union, if any?" }), { target: { value: "Teamsters" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Anything else we should know?" }), { target: { value: "We run night shifts" } });
    expect(onChange).toHaveBeenLastCalledWith({ "3": {
      vehicles: { question: "Do employees drive for work?", kind: "yes_no", value: true, ...confirmed },
      fleet_size: { question: "How many company vehicles?", kind: "number", value: 4, ...confirmed },
      union: { question: "Which union, if any?", kind: "choice", value: "Teamsters", ...confirmed },
      notes: { question: "Anything else we should know?", kind: "text", value: "We run night shifts", ...confirmed },
    } });
    expect(screen.getByRole("region", { name: "Questions from TriNet" })).toHaveTextContent("4 of 4 answered");
  });

  it("keeps a number being typed that isn't one yet without saving it, and clears an answer emptied", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} initial={{ "3": { fleet_size: { question: QUESTIONS[1].text, kind: "number", value: 4, ...confirmed } } }} />);
    const fleet = screen.getByRole("spinbutton", { name: "How many company vehicles?" });
    expect(fleet).toHaveValue(4);
    fireEvent.change(fleet, { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith({});
  });

  it("asks the prospect to confirm what Lenore heard, and to choose between answers that disagree", () => {
    const heard = { kind: "transcript" as const, message_id: "m1", quote: "we have four vans" };
    render(<Harness initial={{ "3": {
      fleet_size: { question: QUESTIONS[1].text, kind: "number", value: 4, status: "inferred", source: heard, updated_at: "2026-11-13T09:00:00Z" },
      vehicles: { question: QUESTIONS[0].text, kind: "yes_no", value: true, status: "conflicting", source: heard, updated_at: "2026-11-13T09:00:00Z",
        candidates: [{ value: true, source: heard }, { value: false, source: { kind: "transcript", message_id: "m2" } }] },
    } }} />);
    const fleet = screen.getByRole("group", { name: "How many company vehicles?" });
    expect(fleet).toHaveTextContent("Lenore captured this — please confirm");
    expect(fleet).toHaveTextContent("From your message: “we have four vans”");
    fireEvent.click(within(fleet).getByRole("button", { name: "Confirm How many company vehicles?" }));
    expect(within(screen.getByRole("group", { name: "How many company vehicles?" })).queryByText("Lenore captured this — please confirm")).not.toBeInTheDocument();
    const vehicles = screen.getByRole("group", { name: "Do employees drive for work?" });
    expect(vehicles).toHaveTextContent("Conflicting answers");
    fireEvent.click(within(vehicles).getByRole("button", { name: "Use No" }));
    expect(within(screen.getByRole("radiogroup", { name: "Do employees drive for work?" })).getByRole("radio", { name: "No" })).toBeChecked();
  });

  it("shows a reworded question as unanswered: an answer is never read against other wording", () => {
    render(<Harness initial={{ "3": { vehicles: { question: "Do any staff drive?", kind: "yes_no", value: true, ...confirmed } } }} />);
    expect(screen.getByRole("region", { name: "Questions from TriNet" })).toHaveTextContent("0 of 4 answered");
    expect(within(screen.getByRole("radiogroup", { name: "Do employees drive for work?" })).getByRole("radio", { name: "Yes" })).not.toBeChecked();
  });

  it("reads only, with nothing to change, when it can't be answered here", () => {
    render(<ExtraQuestionsSection peo={{ id: 3, name: "TriNet" }} questions={QUESTIONS} answers={{}} />);
    expect(within(screen.getByRole("radiogroup", { name: "Do employees drive for work?" })).getByRole("radio", { name: "Yes" })).toBeDisabled();
  });
});
