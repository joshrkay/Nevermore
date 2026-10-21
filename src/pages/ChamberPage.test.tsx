import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import type { IntakeState } from "@/data/provenance";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));

const session = {
  sessionId: "s1",
  resumeFailed: false,
  startNew: vi.fn(),
  chamberData: EMPTY_CHAMBER_DATA,
  provenance: {},
  messages: [] as unknown[],
  isLoading: false,
  setChamberData: vi.fn(),
  updateIntake: vi.fn(),
  addMessage: vi.fn(),
  submit: vi.fn(),
  certification: { status: "none" },
};
vi.mock("@/hooks/useChamberSession", () => ({ useChamberSession: () => session }));
vi.mock("@/hooks/useLenoreVoice", () => ({ useLenoreVoice: () => ({ startVoice: vi.fn(), isConnected: false, hasAgentId: false }) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/components/chamber/VoiceOrb", () => ({ default: () => null }));
vi.mock("@/components/chamber/workspace/LiveWorkspace", () => ({ default: () => null }));

let send: (text: string) => void;
let notice: React.ReactNode;
vi.mock("@/components/chamber/TranscriptPanel", () => ({
  default: (props: { onSendMessage: (text: string) => void; notice?: React.ReactNode }) => {
    send = props.onSendMessage;
    notice = props.notice;
    return <div data-testid="transcript">{props.notice}</div>;
  },
}));

const { default: ChamberPage } = await import("./ChamberPage");

const renderPage = () =>
  render(
    <MemoryRouter>
      <ChamberPage />
    </MemoryRouter>,
  );

describe("ChamberPage chat", () => {
  beforeEach(() => {
    invoke.mockReset();
    session.addMessage.mockReset();
    session.updateIntake.mockReset();
  });

  it("records the prospect's message and keeps it as the source of what Lenore extracted", async () => {
    invoke.mockResolvedValue({
      data: { extracted: { employee_count: 12 }, reply: "Twelve.", field_status: { employee_count: "confirmed" } },
      error: null,
    });
    renderPage();
    await act(async () => { send("We have 12 staff"); });

    const user = session.addMessage.mock.calls[0][0];
    expect(user).toMatchObject({ sender: "user", text: "We have 12 staff" });
    expect(session.addMessage.mock.calls[1][0]).toMatchObject({ sender: "lenore", text: "Twelve." });

    expect(session.updateIntake).toHaveBeenCalledTimes(1);
    const next = session.updateIntake.mock.calls[0][0]({ data: EMPTY_CHAMBER_DATA, provenance: {} }) as IntakeState;
    expect(next.data.employee_count).toBe(12);
    expect(next.provenance.employee_count?.source).toMatchObject({ kind: "transcript", message_id: user.id });
  });

  it("says so, and offers to retry, when Lenore can't answer, rather than replying as if she had", async () => {
    invoke.mockRejectedValue(new TypeError("Failed to fetch"));
    renderPage();
    await act(async () => { send("We have 12 staff"); });

    await waitFor(() => expect(screen.getByTestId("transcript")).toHaveTextContent(/Try again/i));
    expect(session.addMessage).toHaveBeenCalledTimes(1);
    expect(session.updateIntake).not.toHaveBeenCalled();
    expect(notice).toBeTruthy();
  });
});
