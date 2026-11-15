import { Profiler } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen, within, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { BulkOutcome } from "@/lib/bulkChangeApi";

// The bulk dialog on its own (story CRM-S3.7a): what it does while it sits open, and what it keeps when the person switches between adding and removing a label.
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), auth: {} } }));
const previewBulkChange = vi.fn();
vi.mock("@/lib/accountsApi", async (original) => ({ ...(await original<typeof import("@/lib/accountsApi")>()), listFirmMembers: async () => [{ value: "u2", label: "Marcus Hale" }] }));
vi.mock("@/lib/bulkChangeApi", async (original) => ({
  ...(await original<typeof import("@/lib/bulkChangeApi")>()),
  previewBulkChange: (...a: unknown[]) => previewBulkChange(...a),
  applyBulkChange: vi.fn(),
  firmLabels: async () => [{ id: "l1", name: "Hot lead" }],
}));
const { BulkChangeDialog } = await import("./BulkChangeDialog");

const outcome = (over: Partial<BulkOutcome> = {}): BulkOutcome => ({
  selected: 2, tooMany: false, changed: 2, unchanged: 0, unavailable: 0, skipped: [], ownerName: "Marcus Hale", label: null, opportunities: null, changeId: null, undoUntil: null, ...over,
});
const open = (kind: "owner" | "label", onRender: () => void = () => undefined) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Profiler id="d" onRender={onRender}>
        <BulkChangeDialog firmId="f1" kind={kind} selection={{ ids: ["a1", "a2"] }} count={2} onClose={() => undefined} onMade={() => undefined} />
      </Profiler>
    </QueryClientProvider>,
  );
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => previewBulkChange.mockResolvedValue(outcome()));
afterEach(() => { cleanup(); previewBulkChange.mockReset(); });

describe("an open dialog", () => {
  // Catches: the debounce restarted by a new object on every render, so a dialog left open draws again every 350 ms and keeps asking for the same preview.
  it("sits still once it has answered: no more drawing and one preview", async () => {
    const user = userEvent.setup();
    let draws = 0;
    open("owner", () => { draws += 1; });
    await user.selectOptions(await screen.findByLabelText("New owner"), "Marcus Hale");
    await screen.findByText("This will change the owner to Marcus Hale on 2 accounts.");
    await pause(100);
    const settled = draws;
    await pause(1500);
    expect(draws).toBe(settled);
    expect(previewBulkChange).toHaveBeenCalledTimes(1);
  });
});

describe("the label dialog", () => {
  // Catches: a word typed to add staying behind a "Choose a label" that shows nothing chosen, and then being removed.
  it("starts the label empty when switching from Add to Remove", async () => {
    const user = userEvent.setup();
    open("label");
    const d = await screen.findByRole("dialog");
    fireEvent.change(within(d).getByLabelText("Label"), { target: { value: "hot lead" } });
    await within(d).findByText(/This will add the label/);
    await user.selectOptions(within(d).getByLabelText("Change"), "Remove a label");
    expect(within(d).getByLabelText("Label")).toHaveValue("");
    await pause(600);
    expect(previewBulkChange.mock.calls.some((c) => (c[1] as { action: string } | undefined)?.action === "label_remove")).toBe(false);
    expect(within(d).queryByText(/This will remove/)).toBeNull();
  });

  // Catches: the sentence repeating what was typed ("hot LEAD") when the database keeps the firm's spelling.
  it("words the label as the firm has it, from the answer", async () => {
    previewBulkChange.mockResolvedValue(outcome({ label: "Hot lead" }));
    open("label");
    const d = await screen.findByRole("dialog");
    fireEvent.change(within(d).getByLabelText("Label"), { target: { value: "hot LEAD" } });
    expect(await within(d).findByText('This will add the label "Hot lead" to 2 accounts.')).toBeInTheDocument();
  });
});
