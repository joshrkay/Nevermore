import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { QuoteRequestRow } from "@/lib/advisorApi";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const setStatus = vi.fn();
vi.mock("@/lib/advisorApi", () => ({ setStatus: (...a: unknown[]) => setStatus(...a) }));

const { default: StatusPanel } = await import("./StatusPanel");

const quote = (id: number, peo_name: string, status: string): QuoteRequestRow => ({
  id, session_id: "s1", peo_name, status, sent_version: 1, sent_on: "2026-11-10", quote_received_on: null,
  quote_expires_on: null, proposed_start_on: null, admin_fee_pepm: status === "quoted" ? 150 : null, note: null,
});

const panel = (quoteRequests: QuoteRequestRow[]) => {
  const onChanged = vi.fn();
  render(
    <StatusPanel
      sessionId="s1"
      prospectUserId="p1"
      status="quoted"
      certified
      certifiedOnce
      history={[]}
      quoteRequests={quoteRequests}
      onChanged={onChanged}
    />,
  );
  return onChanged;
};

describe("StatusPanel: marking a submission won", () => {
  beforeEach(() => setStatus.mockReset().mockResolvedValue(undefined));

  it("asks which quote the employer took, from the PEOs that quoted, and sends it with the move", async () => {
    const onChanged = panel([quote(7, "TriNet", "quoted"), quote(8, "Justworks", "declined"), quote(9, "Insperity", "quoted")]);
    fireEvent.change(screen.getByLabelText("Change status to"), { target: { value: "won" } });
    const update = screen.getByRole("button", { name: "Update status" });
    expect(update).toBeDisabled();
    const winner = screen.getByLabelText("Which quote did the employer take?");
    expect([...(winner as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(["Choose a PEO", "TriNet", "Insperity"]);
    fireEvent.change(winner, { target: { value: "9" } });
    fireEvent.click(update);
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith("s1", "won", "", 9));
    expect(onChanged).toHaveBeenCalled();
  });

  it("asks no winner for any other move", async () => {
    panel([quote(7, "TriNet", "quoted")]);
    fireEvent.change(screen.getByLabelText("Change status to"), { target: { value: "lost" } });
    expect(screen.queryByLabelText("Which quote did the employer take?")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Update status" }));
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith("s1", "lost", ""));
  });
});
