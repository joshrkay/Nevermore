import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = { user: { id: "u1" } as { id: string } | null, isAnonymous: false };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
const readDraftReminders = vi.fn();
const setDraftReminders = vi.fn();
vi.mock("@/lib/draftReminders", () => ({
  readDraftReminders: (...a: unknown[]) => readDraftReminders(...a),
  setDraftReminders: (...a: unknown[]) => setDraftReminders(...a),
}));

const { default: DraftReminderToggle } = await import("./DraftReminderToggle");
const { toast } = await import("sonner");

describe("DraftReminderToggle", () => {
  beforeEach(() => {
    auth.user = { id: "u1" };
    auth.isAnonymous = false;
    readDraftReminders.mockReset();
    setDraftReminders.mockReset();
  });

  it("is off until the prospect asks, and saves their choice", async () => {
    readDraftReminders.mockResolvedValue(false);
    setDraftReminders.mockResolvedValue(true);
    render(<DraftReminderToggle />);
    const box = screen.getByRole("checkbox", { name: "Email me before an unfinished intake closes" });
    await waitFor(() => expect(box).toBeEnabled());
    expect(box).not.toBeChecked();
    fireEvent.click(box);
    await waitFor(() => expect(box).toBeChecked());
    expect(setDraftReminders).toHaveBeenCalledWith("u1", true);
  });

  it("stops them when unticked, and says so when that couldn't be saved", async () => {
    readDraftReminders.mockResolvedValue(true);
    setDraftReminders.mockResolvedValue(false);
    render(<DraftReminderToggle />);
    const box = screen.getByRole("checkbox");
    await waitFor(() => expect(box).toBeChecked());
    fireEvent.click(box);
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(setDraftReminders).toHaveBeenCalledWith("u1", false);
    expect(box).toBeChecked();
  });

  it("offers nothing to a guest, who has no verified email to write to", () => {
    auth.isAnonymous = true;
    render(<DraftReminderToggle />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(readDraftReminders).not.toHaveBeenCalled();
  });
});
