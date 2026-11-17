import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuoteComparison as Comparison } from "@/lib/quoteComparisonApi";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ signOut: vi.fn() }) }));
const getQuoteComparison = vi.fn();
const addComparisonNote = vi.fn();
vi.mock("@/lib/quoteComparisonApi", async () => ({
  ...(await vi.importActual<object>("@/lib/quoteComparisonApi")),
  getQuoteComparison: (...a: unknown[]) => getQuoteComparison(...a),
  addComparisonNote: (...a: unknown[]) => addComparisonNote(...a),
}));

const { QuoteComparisonPanel } = await import("./QuoteComparisonPanel");
const { OpportunityError } = await import("@/lib/opportunityPageApi");

// The comparison on its own, asked of the database and drawn (N-3.1, N-3.2, slice 7.7). The comparison's own drawing is QuoteComparison.test.tsx; this holds that the
// panel asks for the right opportunity, says what is happening while it waits and when it fails, and shows a saved note.

const loaded: Comparison = {
  canAdd: true,
  columns: [{ quoteRequestId: 1, peoName: "Insperity", status: "sent", quote: null }],
  notes: [],
};

const draw = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><QuoteComparisonPanel firmId="f1" opportunityId="o1" /></QueryClientProvider>);
};

beforeEach(() => {
  getQuoteComparison.mockReset();
  addComparisonNote.mockReset();
});

describe("the panel", () => {
  // Catches: the comparison asked of another opportunity or no firm, so a broker sees another prospect's prices.
  it("asks for this firm's opportunity and draws what comes back", async () => {
    getQuoteComparison.mockResolvedValue(loaded);
    draw();
    expect(await screen.findByRole("columnheader", { name: "Insperity" })).toBeInTheDocument();
    expect(getQuoteComparison).toHaveBeenCalledWith("f1", "o1");
  });
});

describe("while it loads and when it fails", () => {
  // Catches: a blank space where the comparison will be while it loads, so the broker can't tell loading from nothing to compare.
  it("shows its heading with grey lines while it waits", () => {
    getQuoteComparison.mockReturnValue(new Promise(() => {}));
    draw();
    expect(screen.getByRole("heading", { name: "Compare quotes" })).toBeInTheDocument();
  });

  // Catches: "Try again" offered for an opportunity that is not there or not theirs, which no retry can change.
  it("says an opportunity that isn't available isn't, with no Try again", async () => {
    getQuoteComparison.mockRejectedValue(new OpportunityError("notFound", "That opportunity isn't available."));
    draw();
    expect(await screen.findByText("That opportunity isn't available.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  // Catches: a failed read drawn as an empty comparison ("No quotes to compare yet") when quotes may well exist, or with no way to ask again.
  it("says it couldn't load the comparison and asks again on Try again", async () => {
    getQuoteComparison.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(loaded);
    draw();
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't load the comparison");
    expect(screen.queryByText(/No quotes to compare yet/)).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("columnheader", { name: "Insperity" })).toBeInTheDocument();
  });
});

describe("adding a note", () => {
  // Catches: a note saved but not shown (the list is not read again), so the broker adds it a second time.
  it("sends the note for this opportunity and shows the list as the database now has it", async () => {
    getQuoteComparison.mockResolvedValueOnce(loaded).mockResolvedValue({
      ...loaded, notes: [{ id: 1, quoteRequestId: null, area: null, visibility: "internal", body: "Ask about the waiver", author: null, createdAt: "2026-11-11T10:00:00+00:00" }],
    });
    addComparisonNote.mockResolvedValue(undefined);
    draw();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Note"), "Ask about the waiver");
    await user.click(screen.getByRole("button", { name: "Add note" }));
    expect(addComparisonNote).toHaveBeenCalledWith("f1", "o1", { quoteRequestId: null, area: null, visibility: "internal", body: "Ask about the waiver" });
    await waitFor(() => expect(screen.getByText("Ask about the waiver", { selector: "p" })).toBeInTheDocument());
  });
});

