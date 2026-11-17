import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const toast = { success: vi.fn(), error: vi.fn() };
vi.mock("sonner", () => ({ toast }));
const api = { requestInformation: vi.fn(), askAboutQuestion: vi.fn() };
vi.mock("@/lib/advisorApi", () => api);

const { default: InformationRequestPanel } = await import("./InformationRequestPanel");

const panel = (over: Record<string, unknown> = {}) => {
  const onChanged = vi.fn();
  render(
    <InformationRequestPanel
      sessionId="s1" prospectUserId="p1" status="sent_to_carrier" certifiedOnce intakeStatus="submitted" reviews={{}} requests={[]} onChanged={onChanged} {...over}
    />,
  );
  return onChanged;
};

describe("InformationRequestPanel, about an underwriter's question (N-1.3)", () => {
  beforeEach(() => {
    cleanup();
    for (const fn of [...Object.values(api), toast.success, toast.error]) fn.mockReset();
  });

  // Break caught: a request about a PEO's question sent as a plain request, so nothing ties it to the question and the thread can't say it is waiting or answered.
  it("sends through the question's own function, with the agent's words and the answers it names", async () => {
    api.askAboutQuestion.mockResolvedValue(undefined);
    const onChanged = panel({ aboutQuestionOf: 7, initialFields: ["census"] });
    fireEvent.change(screen.getByLabelText("What do you need from them?"), { target: { value: "How many of your 12 employees are part time?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(api.askAboutQuestion).toHaveBeenCalledWith(7, "How many of your 12 employees are part time?", ["census"], []));
    expect(api.requestInformation).not.toHaveBeenCalled();
    expect(onChanged).toHaveBeenCalled();
  });
});
