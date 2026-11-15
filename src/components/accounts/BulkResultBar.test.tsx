import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { BulkOutcome, UndoOutcome } from "@/lib/bulkChangeApi";

// The line over the Accounts table after a bulk change (story CRM-S3.7a): what changed, what was left, Undo for ten minutes and what an undo did.
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), auth: {} } }));
const undoBulkChange = vi.fn();
vi.mock("@/lib/bulkChangeApi", async (original) => ({ ...(await original<typeof import("@/lib/bulkChangeApi")>()), undoBulkChange: (...a: unknown[]) => undoBulkChange(...a) }));
const { BulkResultBar } = await import("./BulkResultBar");
const { BulkChangeError } = await import("@/lib/bulkChangeApi");

const outcome = (over: Partial<BulkOutcome> = {}): BulkOutcome => ({
  selected: 3, tooMany: false, changed: 2, unchanged: 0, unavailable: 0, skipped: [], ownerName: "Marcus Hale", label: null, opportunities: { changed: 2, skipped: 0 },
  changeId: "chg1", undoUntil: new Date(Date.now() + 600_000).toISOString(), ...over,
});
const undone = (over: Partial<UndoOutcome> = {}): UndoOutcome => ({ restored: 2, skipped: [], gone: 0, opportunities: { restored: 0, skipped: 0, gone: 0 }, ...over });
const show = (o: BulkOutcome, withOpportunities = true) =>
  render(<BulkResultBar firmId="f1" made={{ action: { action: "owner", ownerId: "u2", changeOpenOpportunities: true }, outcome: o, withOpportunities }} onUndone={() => undefined} onDismiss={() => undefined} />);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  undoBulkChange.mockReset();
});

describe("what the change left alone", () => {
  // Catches (D-235): open opportunities the person can't change vanishing from the result, when the dialog had shown them.
  it("says how many open opportunities were left because the person can't change them", () => {
    show(outcome({ opportunities: { changed: 2, skipped: 1 } }));
    expect(screen.getByText("1 open opportunity was left as it is, because you can't change it.")).toBeInTheDocument();
  });

  it("says nothing of opportunities that were not taken along", () => {
    show(outcome({ opportunities: { changed: 0, skipped: 1 } }), false);
    expect(screen.queryByText(/left as it is, because you can't change/)).toBeNull();
  });
});

describe("what an undo left alone", () => {
  // Catches: a reason the database never gave (it counts opportunities only), such as "changed since" for an owner who has left.
  it("gives no reason for open opportunities it left, since the database gives only a count", async () => {
    undoBulkChange.mockResolvedValue(undone({ opportunities: { restored: 1, skipped: 2, gone: 0 } }));
    show(outcome());
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByText("2 open opportunities were left as they are.")).toBeInTheDocument();
    expect(screen.queryByText(/because it changed/)).toBeNull();
  });

  // Catches: an Undo kept for a retry that cannot work (the firm started closing, or the person may no longer change).
  it.each([
    ["readOnly", "This firm is closing, so nothing in it can be changed.", "PT423"],
    ["notAllowed", "You can't change accounts in this firm.", "42501"],
  ] as const)("takes Undo away and keeps the words when the undo is refused as %s", async (kind, words, code) => {
    undoBulkChange.mockRejectedValue(new BulkChangeError(kind, words, code));
    show(outcome());
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    const region = screen.getByRole("region", { name: "What the change did" });
    expect(await within(region).findByText(words)).toBeInTheDocument();
    expect(within(region).queryByRole("button", { name: "Undo" })).toBeNull();
  });
});

describe("the ten minutes", () => {
  // Catches: the end judged by this browser's clock against the database's `undo_until`: a clock an hour fast would offer no Undo at all, one an hour slow would offer it for ever.
  it("counts ten minutes from the answer whatever this clock says", () => {
    vi.useFakeTimers();
    const server = Date.now();
    vi.setSystemTime(server + 3_600_000); // this browser's clock is an hour ahead of the database's
    show(outcome({ undoUntil: new Date(server + 600_000).toISOString() }));
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(599_000); });
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(2_000); });
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    expect(screen.getByText("The ten minutes to undo this have passed.")).toBeInTheDocument();
  });

  it("does not end early when this clock is an hour behind", () => {
    vi.useFakeTimers();
    const server = Date.now();
    vi.setSystemTime(server - 3_600_000);
    show(outcome({ undoUntil: new Date(server + 600_000).toISOString() }));
    act(() => { vi.advanceTimersByTime(300_000); });
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  });
});
