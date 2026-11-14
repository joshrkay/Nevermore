import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Closing a firm from Settings (story CRM-P1.7). The page is rendered with the real workspace and the real api module; only the database is
// replaced, by a small one that answers the way request_firm_closure, withdraw_firm_closure and my_firm_closure do: only an owner asks, the
// firm's name must be typed, one request is open at a time, and an open request is shown to the firm's members with when it closes.
const auth = { user: { id: "u1", email: "sam@acme.example" }, session: { access_token: "tok" }, loading: false, isAnonymous: false, sessionEnded: null, signOut: vi.fn() };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
let firmAddress: { status: "none" } | { status: "known"; address: string; name: string } = { status: "none" };
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => firmAddress }));
vi.mock("@/lib/monitoring", () => ({ reportOpsEvent: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const db = {
  firms: [] as { firm_id: string; name: string; address: string; role: string }[],
  closesAt: null as string | null,
  fail: null as { code?: string; message: string } | "pending" | null,
  calls: [] as [string, Record<string, unknown>][],
};
const rpc = vi.fn(async (fn: string, args: Record<string, unknown> = {}) => {
  db.calls.push([fn, args]);
  switch (fn) {
    case "my_firms": return { data: db.firms, error: null };
    case "has_role": return { data: false, error: null };
    case "advisor_needs_second_factor": return { data: false, error: null };
    case "my_firm_closure": return { data: db.closesAt ? [{ asked_at: "2026-11-18T10:00:00Z", closes_at: db.closesAt }] : [], error: null };
    case "request_firm_closure": {
      if (db.fail === "pending") return new Promise(() => undefined);
      if (db.fail) return { data: null, error: db.fail };
      if (String(args.p_firm_name).trim().toLowerCase() !== "acme brokers") return { data: null, error: { code: "22023", message: "Type the firm's name exactly to confirm" } };
      db.closesAt = "2026-12-18T10:00:00Z";
      return { data: db.closesAt, error: null };
    }
    case "withdraw_firm_closure": {
      if (db.fail) return { data: null, error: db.fail };
      db.closesAt = null;
      return { data: null, error: null };
    }
    default: throw new Error(`the page asked the database for ${fn}`);
  }
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: [string, Record<string, unknown>?]) => rpc(...a) } }));

const { clearMyFirms, clearOwnedFirms } = await import("@/hooks/useOwnedFirms");
const { clearFirmClosure } = await import("@/hooks/useFirmClosure");
const { default: AdvisorSettingsPage } = await import("./AdvisorSettingsPage");
const { WorkspaceProvider } = await import("@/components/workspace/useWorkspace");

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const renderPage = async () => {
  render(<MemoryRouter><WorkspaceProvider><AdvisorSettingsPage /></WorkspaceProvider></MemoryRouter>);
  await settle();
};
const openDialog = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "Close this firm" }));
  return within(await screen.findByRole("alertdialog"));
};
const calls = (name: string) => db.calls.filter(([fn]) => fn === name);

describe("closing a firm from Settings", () => {
  beforeEach(() => {
    clearMyFirms();
    clearOwnedFirms();
    clearFirmClosure();
    rpc.mockClear();
    db.calls = [];
    db.fail = null;
    db.closesAt = null;
    firmAddress = { status: "none" };
    db.firms = [{ firm_id: "f1", name: "Acme Brokers", address: "acme", role: "owner" }];
  });

  // Catches: closing is offered to people who can't do it (a lead, an agent) or who have no firm.
  it("offers Close this firm to an owner only", async () => {
    await renderPage();
    expect(await screen.findByRole("button", { name: "Close this firm" })).toBeInTheDocument();
    for (const role of ["agent", "lead"]) {
      document.body.innerHTML = "";
      clearMyFirms();
      clearFirmClosure();
      db.firms = [{ firm_id: "f1", name: "Acme Brokers", address: "acme", role }];
      await renderPage();
      expect(await screen.findByRole("button", { name: "Leave this firm" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Close this firm" })).not.toBeInTheDocument();
    }
  });

  // Catches: the owner is asked to confirm without being told what will happen and when, or it is asked on the first click, or the
  // button works before the firm's name is typed.
  it("says in plain words what will happen and when, and asks for the firm's name before it does anything", async () => {
    await renderPage();
    const dialog = await openDialog();
    expect(dialog.getByText("Close Acme Brokers?")).toBeInTheDocument();
    const body = dialog.getByText(/read-only/).textContent ?? "";
    expect(body).toContain("For the next 30 days Acme Brokers is read-only");
    expect(body).toContain("nothing can be changed, added, sent or deleted");
    expect(body).toContain("Any owner can withdraw the request until then");
    expect(body).toContain("After 30 days the firm's own working data is deleted for good");
    expect(body).toContain("Every member's access ends");
    expect(body).toContain("Submissions that employers started are not deleted");
    expect(body).toContain("can't be used by another firm for 12 months");
    expect(body).toContain("The firm's owners are emailed now");
    expect(body).not.toMatch(/export/i);
    const confirm = dialog.getByRole("button", { name: "Close Acme Brokers in 30 days" });
    expect(confirm).toBeDisabled();
    fireEvent.change(dialog.getByLabelText(/Type the firm's name to confirm/), { target: { value: "Acme" } });
    expect(confirm).toBeDisabled();
    expect(calls("request_firm_closure")).toEqual([]);
    fireEvent.click(dialog.getByRole("button", { name: "Keep the firm" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(calls("request_firm_closure")).toEqual([]);
  });

  // Catches: the firm sent is not the page's own, or the name sent is not what was typed, or the page does not then show that the
  // firm is closing and how to take it back.
  it("asks for the page's own firm with the name typed, then shows the date and a way to withdraw", async () => {
    await renderPage();
    const dialog = await openDialog();
    fireEvent.change(dialog.getByLabelText(/Type the firm's name to confirm/), { target: { value: "  acme brokers " } });
    fireEvent.click(dialog.getByRole("button", { name: "Close Acme Brokers in 30 days" }));
    await waitFor(() => expect(calls("request_firm_closure")).toEqual([["request_firm_closure", { p_firm_id: "f1", p_firm_name: "  acme brokers " }]]));
    const heading = await screen.findByRole("heading", { name: "This firm is closing" });
    expect(heading.closest("section")).toHaveTextContent("Acme Brokers closes on December 18, 2026");
    expect(screen.queryByRole("button", { name: "Close this firm" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Withdraw the request to close" })).toBeEnabled();
  });

  // Catches: withdrawing is not offered while a request is open, or does not put the page back.
  it("withdraws the request and puts the page back as it was", async () => {
    db.closesAt = "2026-12-18T10:00:00Z";
    await renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Withdraw the request to close" }));
    await waitFor(() => expect(calls("withdraw_firm_closure")).toEqual([["withdraw_firm_closure", { p_firm_id: "f1" }]]));
    expect(await screen.findByRole("button", { name: "Close this firm" })).toBeEnabled();
    expect(screen.queryByRole("heading", { name: "This firm is closing" })).not.toBeInTheDocument();
  });

  // Catches: a refusal is shown as the database's text or hides that nothing was asked; the dialog closes as if it had worked.
  it("keeps the dialog open and says why when the database refuses", async () => {
    db.fail = { code: "PT409", message: "This firm is already closing" };
    await renderPage();
    const dialog = await openDialog();
    fireEvent.change(dialog.getByLabelText(/Type the firm's name to confirm/), { target: { value: "Acme Brokers" } });
    fireEvent.click(dialog.getByRole("button", { name: "Close Acme Brokers in 30 days" }));
    expect((await screen.findAllByRole("alert"))[0]).toHaveTextContent("This firm is already closing");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    db.fail = { code: "XX000", message: "relation firm_closures exploded" };
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Close Acme Brokers in 30 days" }));
    await waitFor(() => expect(screen.getAllByRole("alert")[0]).toHaveTextContent("Couldn't ask to close the firm. Try again."));
    expect(document.body.textContent).not.toContain("exploded");
  });

  // Catches: a second click while the first is in flight asks twice, or the dialog closes before the answer.
  it("holds the dialog open and the buttons off while it is asking", async () => {
    db.fail = "pending";
    await renderPage();
    const dialog = await openDialog();
    fireEvent.change(dialog.getByLabelText(/Type the firm's name to confirm/), { target: { value: "Acme Brokers" } });
    fireEvent.click(dialog.getByRole("button", { name: "Close Acme Brokers in 30 days" }));
    await waitFor(() => expect(dialog.getByRole("button", { name: "Keep the firm" })).toBeDisabled());
    expect(dialog.getByRole("button", { name: "Close Acme Brokers in 30 days" })).toBeDisabled();
    expect(calls("request_firm_closure")).toHaveLength(1);
  });
});
