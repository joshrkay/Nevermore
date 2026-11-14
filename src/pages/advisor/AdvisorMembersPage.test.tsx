import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The page is rendered through the real route guard (RequireFirm as an owner) and the real api modules; only the database is
// replaced, by a small in-memory one that answers the way the functions do: a firm keeps its last owner, only an owner of the
// firm lists or changes its members, a removed person is no longer listed, a suspended one is, until lifted.
const auth = { user: { id: "u-owner", email: "owner@acme.example" }, session: { access_token: "tok-1" }, loading: false, isAnonymous: false, sessionEnded: null, signOut: vi.fn() };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
let firmAddress: { status: "none" } | { status: "known"; address: string; name: string } = { status: "none" };
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => firmAddress }));
vi.mock("@/lib/monitoring", () => ({ reportOpsEvent: vi.fn() }));

type Member = { user_id: string; email: string; role: string; state: "current" | "suspended"; since: string };
const db = {
  firms: [] as { firm_id: string; name: string; address: string; role: string }[],
  members: [] as Member[],
  isAdmin: false,
  /** What the next call of a function answers instead, as the database's error. */
  fail: {} as Record<string, { code?: string; message: string } | "pending">,
  calls: [] as [string, Record<string, unknown>][],
  /** Runs when a function is called, before it answers: lets a test change what a later call answers. */
  onCall: {} as Record<string, () => void>,
};
const rpc = vi.fn(async (fn: string, args: Record<string, unknown> = {}) => {
  db.calls.push([fn, args]);
  db.onCall[fn]?.();
  const failure = db.fail[fn];
  if (failure === "pending") return new Promise(() => undefined);
  if (failure) return { data: null, error: failure };
  switch (fn) {
    case "my_firms": return { data: db.firms, error: null };
    case "has_role": return { data: db.isAdmin, error: null };
    case "advisor_needs_second_factor": return { data: false, error: null };
    case "firm_members": return { data: db.members.map((m) => ({ ...m, is_you: m.user_id === "u-owner" })), error: null };
    case "remove_member": db.members = db.members.filter((m) => m.user_id !== args.p_user_id); return { data: null, error: null };
    case "suspend_member": db.members = db.members.map((m) => (m.user_id === args.p_user_id ? { ...m, state: "suspended" as const } : m)); return { data: null, error: null };
    case "lift_member_suspension": db.members = db.members.map((m) => (m.user_id === args.p_user_id ? { ...m, state: "current" as const } : m)); return { data: null, error: null };
    default: throw new Error(`the page asked the database for ${fn}`);
  }
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: [string, Record<string, unknown>?]) => rpc(...a) } }));

const { clearMyFirms, clearOwnedFirms } = await import("@/hooks/useOwnedFirms");
const { default: RequireFirm } = await import("@/components/RequireFirm");
const { default: AdvisorMembersPage } = await import("./AdvisorMembersPage");

const member = (user_id: string, email: string, role: string, state: "current" | "suspended" = "current"): Member =>
  ({ user_id, email, role, state, since: "2026-11-02T10:00:00Z" });

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/advisor/members"]}>
      <Routes>
        <Route path="/advisor/members" element={<RequireFirm as="owner" ownersOnly="see and change its members"><AdvisorMembersPage /></RequireFirm>} />
        <Route path="/choose-firm" element={<p>Choose a firm page</p>} />
      </Routes>
    </MemoryRouter>,
  );

const row = (email: string) => screen.getByRole("row", { name: new RegExp(email.replace(".", "\\.")) });

describe("the members page", () => {
  beforeEach(() => {
    clearMyFirms();
    clearOwnedFirms();
    rpc.mockClear();
    db.calls = [];
    db.fail = {};
    db.onCall = {};
    auth.signOut.mockClear();
    db.isAdmin = false;
    firmAddress = { status: "none" };
    auth.user = { id: "u-owner", email: "owner@acme.example" };
    db.firms = [{ firm_id: "f1", name: "Acme Brokers", address: "acme", role: "owner" }];
    db.members = [
      member("u-owner", "owner@acme.example", "owner"),
      member("u-lead", "lead@acme.example", "lead"),
      member("u-agent", "agent@acme.example", "agent"),
      member("u-held", "held@acme.example", "agent", "suspended"),
    ];
  });

  it("lists the firm's members with their role and whether they are members or suspended", async () => {
    renderPage();
    const table = await screen.findByRole("table", { name: "Members" });
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Person", "Role", "State", "Since", "Actions"]);
    expect(row("owner@acme.example")).toHaveTextContent(/Owner.*Member/);
    expect(row("lead@acme.example")).toHaveTextContent(/Lead.*Member/);
    expect(row("agent@acme.example")).toHaveTextContent(/Agent.*Member/);
    expect(row("held@acme.example")).toHaveTextContent(/Agent.*Suspended/);
    expect(db.calls).toContainEqual(["firm_members", { p_firm_id: "f1" }]);
  });

  it("offers remove and suspend for a member, lift and remove for a suspended one, and nothing for the owner's own row", async () => {
    renderPage();
    await screen.findByRole("table", { name: "Members" });
    expect(within(row("owner@acme.example")).queryByRole("button")).not.toBeInTheDocument();
    expect(within(row("owner@acme.example")).getByText("You")).toBeInTheDocument();
    expect(within(row("lead@acme.example")).getAllByRole("button").map((b) => b.textContent)).toEqual(["Suspend", "Remove"]);
    expect(within(row("held@acme.example")).getAllByRole("button").map((b) => b.textContent)).toEqual(["Lift suspension", "Remove"]);
  });

  it("asks before removing, says in plain words what removing does, and removes nothing when the owner cancels", async () => {
    renderPage();
    await screen.findByRole("table", { name: "Members" });
    fireEvent.click(within(row("agent@acme.example")).getByRole("button", { name: "Remove agent@acme.example" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Remove agent@acme.example from Acme Brokers?")).toBeInTheDocument();
    expect(dialog).toHaveTextContent("They lose access to Acme Brokers at once and stop receiving its alerts.");
    expect(dialog).toHaveTextContent("What they created stays with the firm.");
    expect(dialog).toHaveTextContent("a mailbox they connected is deleted");
    expect(db.calls.map(([fn]) => fn)).not.toContain("remove_member");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(db.calls.map(([fn]) => fn)).not.toContain("remove_member");
    expect(row("agent@acme.example")).toBeInTheDocument();
  });

  it("removes the person once the owner confirms, and the list no longer shows them", async () => {
    renderPage();
    await screen.findByRole("table", { name: "Members" });
    fireEvent.click(within(row("agent@acme.example")).getByRole("button", { name: "Remove agent@acme.example" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove agent@acme.example" }));
    await waitFor(() => expect(screen.queryByText("agent@acme.example")).not.toBeInTheDocument());
    expect(db.calls).toContainEqual(["remove_member", { p_firm_id: "f1", p_user_id: "u-agent" }]);
    expect(screen.getByText("agent@acme.example was removed from Acme Brokers.")).toBeInTheDocument();
  });

  it("asks before suspending, says the person stays on the list, and shows them suspended afterwards with a way to lift it", async () => {
    renderPage();
    await screen.findByRole("table", { name: "Members" });
    fireEvent.click(within(row("lead@acme.example")).getByRole("button", { name: "Suspend lead@acme.example" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Suspend lead@acme.example?")).toBeInTheDocument();
    expect(dialog).toHaveTextContent("They lose access at once and stop receiving the firm's alerts, but stay on this list as a lead until you lift the suspension.");
    expect(db.calls.map(([fn]) => fn)).not.toContain("suspend_member");
    fireEvent.click(within(dialog).getByRole("button", { name: "Suspend lead@acme.example" }));
    await waitFor(() => expect(row("lead@acme.example")).toHaveTextContent("Suspended"));
    expect(db.calls).toContainEqual(["suspend_member", { p_firm_id: "f1", p_user_id: "u-lead" }]);
    expect(within(row("lead@acme.example")).getByRole("button", { name: "Lift the suspension of lead@acme.example" })).toBeInTheDocument();
    expect(screen.getByText("lead@acme.example is suspended.")).toBeInTheDocument();
  });

  it("names an agent with the right article in the suspend question", async () => {
    renderPage();
    await screen.findByRole("table", { name: "Members" });
    fireEvent.click(within(row("agent@acme.example")).getByRole("button", { name: "Suspend agent@acme.example" }));
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("stay on this list as an agent until you lift the suspension.");
  });

  it("asks before lifting a suspension, and gives the person their access back as a member once confirmed", async () => {
    renderPage();
    await screen.findByRole("table", { name: "Members" });
    fireEvent.click(within(row("held@acme.example")).getByRole("button", { name: "Lift the suspension of held@acme.example" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Lift the suspension of held@acme.example?")).toBeInTheDocument();
    expect(dialog).toHaveTextContent("They get access to Acme Brokers again at once, as an agent.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Lift suspension" }));
    await waitFor(() => expect(row("held@acme.example")).toHaveTextContent("Member"));
    expect(db.calls).toContainEqual(["lift_member_suspension", { p_firm_id: "f1", p_user_id: "u-held" }]);
    expect(screen.getByText("held@acme.example's suspension is lifted.")).toBeInTheDocument();
  });

  it("removes a suspended person too", async () => {
    renderPage();
    await screen.findByRole("table", { name: "Members" });
    fireEvent.click(within(row("held@acme.example")).getByRole("button", { name: "Remove held@acme.example" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove held@acme.example" }));
    await waitFor(() => expect(screen.queryByText("held@acme.example")).not.toBeInTheDocument());
    expect(db.calls).toContainEqual(["remove_member", { p_firm_id: "f1", p_user_id: "u-held" }]);
  });

  it("tells the owner when the firm keeps its last owner, leaves the list as it was, and does not say it worked", async () => {
    db.fail.remove_member = { code: "23514", message: "The last owner of a firm can't be removed. Make someone else an owner first." };
    renderPage();
    await screen.findByRole("table", { name: "Members" });
    fireEvent.click(within(row("lead@acme.example")).getByRole("button", { name: "Remove lead@acme.example" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove lead@acme.example" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The last owner of a firm can't be removed. Make someone else an owner first.");
    expect(row("lead@acme.example")).toBeInTheDocument();
    expect(screen.queryByText(/was removed from/)).not.toBeInTheDocument();
  });

  // The change was made: the database committed it. A list that fails to reload afterwards is a list problem, and says so as one.
  it("does not report a committed change as failed when the list can't be reloaded afterwards: it says so, and offers to try again", async () => {
    db.onCall.remove_member = () => { db.fail.firm_members = { message: "boom" }; };
    renderPage();
    await screen.findByRole("table", { name: "Members" });
    fireEvent.click(within(row("agent@acme.example")).getByRole("button", { name: "Remove agent@acme.example" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove agent@acme.example" }));
    expect(await screen.findByText(/We couldn't load the members/)).toBeInTheDocument();
    expect(screen.getByText("agent@acme.example was removed from Acme Brokers.")).toBeInTheDocument();
    expect(screen.queryByText("Couldn't do that. Try again.")).not.toBeInTheDocument();
    delete db.fail.firm_members;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("table", { name: "Members" })).toBeInTheDocument();
    expect(screen.queryByText("agent@acme.example")).not.toBeInTheDocument();
  });

  it("signs the owner out when their session has expired while the list loads", async () => {
    db.fail.firm_members = { code: "PGRST301", message: "JWT expired" };
    renderPage();
    expect(await screen.findByText("Your session has expired.")).toBeInTheDocument();
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledWith("expired"));
  });

  it("signs the owner out when their session has expired as they change someone", async () => {
    db.fail.remove_member = { code: "PGRST301", message: "JWT expired" };
    renderPage();
    await screen.findByRole("table", { name: "Members" });
    fireEvent.click(within(row("agent@acme.example")).getByRole("button", { name: "Remove agent@acme.example" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove agent@acme.example" }));
    expect(await screen.findByText("Your session has expired.")).toBeInTheDocument();
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledWith("expired"));
    expect(screen.queryByText(/was removed from/)).not.toBeInTheDocument();
  });

  it("shows that it is loading until the members arrive", async () => {
    db.fail.firm_members = "pending";
    renderPage();
    expect(await screen.findByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("says it couldn't load, and tries again when asked", async () => {
    db.fail.firm_members = { message: "boom" };
    renderPage();
    expect(await screen.findByText(/We couldn't load the members/)).toBeInTheDocument();
    delete db.fail.firm_members;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("table", { name: "Members" })).toBeInTheDocument();
  });

  it("says no one else belongs to the firm yet, when the owner is the only one", async () => {
    db.members = [member("u-owner", "owner@acme.example", "owner")];
    renderPage();
    expect(await screen.findByText("No one else belongs to your firm yet. People you invite appear here once they accept.")).toBeInTheDocument();
    expect(row("owner@acme.example")).toBeInTheDocument();
  });

  it("says it is not allowed, when the database refuses the list although the guard let the person in", async () => {
    db.fail.firm_members = { code: "42501", message: "Only an owner of the firm can do that" };
    renderPage();
    expect(await screen.findByText("Only a firm's owners can see and change its members.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("says it is not allowed, when the database refuses a change (the person was removed or suspended while the page was open)", async () => {
    db.fail.suspend_member = { code: "42501", message: "Only an owner of the firm can do that" };
    renderPage();
    await screen.findByRole("table", { name: "Members" });
    fireEvent.click(within(row("lead@acme.example")).getByRole("button", { name: "Suspend lead@acme.example" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Suspend lead@acme.example" }));
    expect(await screen.findByText("Only a firm's owners can see and change its members.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("does not ask the database for the list when the person is no owner of the current firm, whatever put them on the page", async () => {
    db.firms = [{ firm_id: "f1", name: "Acme Brokers", address: "acme", role: "agent" }];
    render(<MemoryRouter><AdvisorMembersPage /></MemoryRouter>);
    expect(await screen.findByText("Only a firm's owners can see and change its members.")).toBeInTheDocument();
    expect(db.calls.map(([fn]) => fn)).not.toContain("firm_members");
  });

  describe("who reaches it, through the route guard", () => {
    it("keeps out a member who is not an owner: they are told it is for owners, and nothing is asked of the members list", async () => {
      db.firms = [{ firm_id: "f1", name: "Acme Brokers", address: "acme", role: "agent" }];
      renderPage();
      expect(await screen.findByRole("heading", { name: "For a firm's owners" })).toBeInTheDocument();
      expect(screen.getByText("Only a firm's owners can see and change its members.")).toBeInTheDocument();
      expect(db.calls.map(([fn]) => fn)).not.toContain("firm_members");
    });

    it("keeps out a platform admin who is no member of any firm (D-16)", async () => {
      db.firms = [];
      db.isAdmin = true;
      renderPage();
      expect(await screen.findByRole("heading", { name: "For a firm's owners" })).toBeInTheDocument();
      expect(db.calls.map(([fn]) => fn)).not.toContain("firm_members");
    });

    it("keeps out a person who no longer belongs to any firm (a removed or suspended member), and asks nothing of the list", async () => {
      db.firms = [];
      renderPage();
      expect(await screen.findByRole("heading", { name: "For a firm's owners" })).toBeInTheDocument();
      expect(db.calls.map(([fn]) => fn)).not.toContain("firm_members");
    });

    it("at a firm's address it is that firm: its members, by its id", async () => {
      firmAddress = { status: "known", address: "acme", name: "Acme Brokers" };
      renderPage();
      await screen.findByRole("table", { name: "Members" });
      expect(db.calls).toContainEqual(["firm_members", { p_firm_id: "f1" }]);
      expect(screen.getByText("Acme Brokers", { selector: "span.font-medium" })).toBeInTheDocument();
    });

    it("at another firm's address an owner of a different firm gets nothing: the address is not their firm's", async () => {
      firmAddress = { status: "known", address: "zenith", name: "Zenith Benefits" };
      renderPage();
      expect(await screen.findByRole("heading", { name: "For a firm's owners" })).toBeInTheDocument();
      expect(db.calls.map(([fn]) => fn)).not.toContain("firm_members");
    });

    it("at the address of the firm the owner owns, with another firm they belong to as an agent, acts for the address's firm and no other", async () => {
      db.firms = [
        { firm_id: "f1", name: "Acme Brokers", address: "acme", role: "owner" },
        { firm_id: "f2", name: "Zenith Benefits", address: "zenith", role: "agent" },
      ];
      firmAddress = { status: "known", address: "acme", name: "Acme Brokers" };
      renderPage();
      // The page names the firm in every call, so it is let in as the owner of the firm at the address (ADR 0015).
      await screen.findByRole("table", { name: "Members" });
      expect(db.calls.filter(([fn]) => fn === "firm_members")).toEqual([["firm_members", { p_firm_id: "f1" }]]);
    });

    it("at the address of a firm where the owner is only an agent, though they own another, they are kept out", async () => {
      db.firms = [
        { firm_id: "f1", name: "Acme Brokers", address: "acme", role: "owner" },
        { firm_id: "f2", name: "Zenith Benefits", address: "zenith", role: "agent" },
      ];
      firmAddress = { status: "known", address: "zenith", name: "Zenith Benefits" };
      renderPage();
      expect(await screen.findByRole("heading", { name: "For a firm's owners" })).toBeInTheDocument();
      expect(db.calls.map(([fn]) => fn)).not.toContain("firm_members");
    });

    it("on the bare domain a member of several firms has no current firm, and is sent to choose one (D-40)", async () => {
      db.firms = [
        { firm_id: "f1", name: "Acme Brokers", address: "acme", role: "owner" },
        { firm_id: "f2", name: "Zenith Benefits", address: "zenith", role: "owner" },
      ];
      renderPage();
      expect(await screen.findByText("Choose a firm page")).toBeInTheDocument();
      expect(db.calls.map(([fn]) => fn)).not.toContain("firm_members");
    });
  });
});
