import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Link, MemoryRouter } from "react-router-dom";

const auth = {
  user: null as { id: string; email?: string; last_sign_in_at?: string } | null,
  loading: false,
  isAnonymous: false,
  signOut: vi.fn(),
};
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
const fetchFirmName = vi.fn();
const fetchIsMemberOfFirmAddress = vi.fn();
const recordFirmSignIn = vi.fn();
const fetchIsMySuspendedFirmAtAddress = vi.fn();
vi.mock("@/lib/firmApi", () => ({
  fetchIsMySuspendedFirmAtAddress: (...a: unknown[]) => fetchIsMySuspendedFirmAtAddress(...a),
  fetchFirmName: (...a: unknown[]) => fetchFirmName(...a),
  fetchIsMemberOfFirmAddress: (...a: unknown[]) => fetchIsMemberOfFirmAddress(...a),
  recordFirmSignIn: (...a: unknown[]) => recordFirmSignIn(...a),
}));

const fetchMySupportSessionHere = vi.fn();
vi.mock("@/lib/supportApi", () => ({ fetchMySupportSessionHere: (...a: unknown[]) => fetchMySupportSessionHere(...a) }));

const askToJoinFirm = vi.fn();
vi.mock("@/lib/joinByOrganisationApi", () => ({ askToJoinFirm: (...a: unknown[]) => askToJoinFirm(...a) }));

const { FirmAddressProvider } = await import("@/hooks/useFirmAddress");
const { default: FirmAddressGate } = await import("./FirmAddressGate");
const { notifyMembershipChanged } = await import("@/lib/membershipChanged");

// The firm address (story CRM-P1.3a): the host picks the firm; after sign-in only a member gets past this gate. A
// person who isn't a member sees one sentence and a way to sign out, whichever firm they belong to.
const renderAt = (hostname: string, path = "/") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <FirmAddressProvider hostname={hostname}>
        <FirmAddressGate>
          <p>The console</p>
        </FirmAddressGate>
      </FirmAddressProvider>
    </MemoryRouter>,
  );

describe("the firm address gate", () => {
  beforeEach(() => {
    auth.user = null;
    auth.loading = false;
    auth.isAnonymous = false;
    auth.signOut.mockReset();
    fetchFirmName.mockReset().mockResolvedValue("Acme Brokers");
    fetchIsMemberOfFirmAddress.mockReset().mockResolvedValue(true);
    recordFirmSignIn.mockReset().mockResolvedValue(true);
    fetchIsMySuspendedFirmAtAddress.mockReset().mockResolvedValue(false);
    askToJoinFirm.mockReset().mockResolvedValue("none");
    fetchMySupportSessionHere.mockReset().mockResolvedValue(null);
    try { window.localStorage.clear(); } catch { /* no storage here */ }
  });

  it("changes nothing on the bare domain or www: no question is asked, whoever is signed in", async () => {
    auth.user = { id: "u1" };
    renderAt("nevermorepeo.com");
    expect(await screen.findByText("The console")).toBeInTheDocument();
    renderAt("www.nevermorepeo.com");
    expect(await screen.findAllByText("The console")).toHaveLength(2);
    expect(fetchFirmName).not.toHaveBeenCalled();
    expect(fetchIsMemberOfFirmAddress).not.toHaveBeenCalled();
  });

  it("shows a plain not-found page to a signed-out visitor at an address no firm holds: no sign-in is offered and nothing is asked about membership", async () => {
    fetchFirmName.mockResolvedValue(null);
    renderAt("no-such-firm.nevermorepeo.com", "/advisor");
    expect(await screen.findByText("Oops! Page not found")).toBeInTheDocument();
    expect(screen.queryByText("The console")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
    expect(fetchIsMemberOfFirmAddress).not.toHaveBeenCalled();
  });

  it("does not mount the sign-in callback pages at an address no firm holds", async () => {
    fetchFirmName.mockResolvedValue(null);
    for (const path of ["/broker/callback", "/auth/callback"]) {
      const view = renderAt("no-such-firm.nevermorepeo.com", path);
      expect(await screen.findByText("Oops! Page not found"), path).toBeInTheDocument();
      expect(screen.queryByText("The console"), path).not.toBeInTheDocument();
      view.unmount();
    }
  });

  it("shows the same not-found page, with a working Sign out, to a signed-in person at an address no firm holds, even a member elsewhere", async () => {
    fetchFirmName.mockResolvedValue(null);
    auth.user = { id: "u1" };
    renderAt("no-such-firm.nevermorepeo.com");
    expect(await screen.findByText("Oops! Page not found")).toBeInTheDocument();
    expect(screen.queryByText("The console")).not.toBeInTheDocument();
    expect(fetchIsMemberOfFirmAddress).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it("names the firm and lets a signed-out visitor through to its sign-in even when the firm is still waiting for approval", async () => {
    // The lookup returns a name for any firm that exists (D-27): the gate does not know or care whether it is approved.
    fetchFirmName.mockResolvedValue("Waiting Firm");
    renderAt("waiting-firm.nevermorepeo.com");
    expect(await screen.findByText("The console")).toBeInTheDocument();
    expect(screen.queryByText("Oops! Page not found")).not.toBeInTheDocument();
  });

  it("lets a signed-in member of a firm still waiting for approval work at its address", async () => {
    fetchFirmName.mockResolvedValue("Waiting Firm");
    auth.user = { id: "u1" };
    renderAt("waiting-firm.nevermorepeo.com");
    expect(await screen.findByText("The console")).toBeInTheDocument();
    expect(fetchIsMemberOfFirmAddress).toHaveBeenCalledWith("waiting-firm");
  });

  it("lets a signed-out visitor through to the sign-in screens of a firm that exists", async () => {
    renderAt("acme-brokers.nevermorepeo.com");
    expect(await screen.findByText("The console")).toBeInTheDocument();
    expect(fetchIsMemberOfFirmAddress).not.toHaveBeenCalled();
  });

  it("lets a current member through", async () => {
    auth.user = { id: "u1" };
    renderAt("acme-brokers.nevermorepeo.com");
    expect(await screen.findByText("The console")).toBeInTheDocument();
    expect(fetchIsMemberOfFirmAddress).toHaveBeenCalledWith("acme-brokers");
  });

  it("tells a signed-in person who is not a member so, and shows nothing else", async () => {
    fetchIsMemberOfFirmAddress.mockResolvedValue(false);
    auth.user = { id: "u1", email: "pat@birch.example" };
    const { container } = renderAt("acme-brokers.nevermorepeo.com");
    expect(await screen.findByRole("heading", { name: "You aren't a member of this firm" })).toBeInTheDocument();
    expect(screen.queryByText("The console")).not.toBeInTheDocument();
    // Nothing about the firm, nor the person's own firm, nor the account is on the page.
    expect(container.textContent).not.toContain("Acme Brokers");
    expect(container.textContent).not.toContain("pat@birch.example");
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("offers a way to sign out, so they can come back as someone else", async () => {
    fetchIsMemberOfFirmAddress.mockResolvedValue(false);
    auth.user = { id: "u1" };
    renderAt("acme-brokers.nevermorepeo.com");
    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  // Joining by organisation (CRM-P1.4): a person who is not a member, signed in from an organisation the firm lists, is told they
  // have asked to join. Anyone else is told what they were told before.
  describe("a person who is not a member", () => {
    // Catches: the person is asked nothing about joining, or is shown the plain refusal though an owner is waiting to decide.
    it("is told they have asked to join, and that an owner must approve them, when the database holds their request", async () => {
      fetchIsMemberOfFirmAddress.mockResolvedValue(false);
      askToJoinFirm.mockResolvedValue("asked");
      auth.user = { id: "u1" };
      renderAt("acme-brokers.nevermorepeo.com");
      expect(await screen.findByRole("heading", { name: "You've asked to join Acme Brokers" })).toBeInTheDocument();
      expect(screen.getByText(/An owner of Acme Brokers has to approve you before you can use it/)).toBeInTheDocument();
      expect(askToJoinFirm).toHaveBeenCalledWith("acme-brokers");
      expect(screen.queryByText("The console")).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "You aren't a member of this firm" })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
      expect(auth.signOut).toHaveBeenCalledTimes(1);
    });

    // Catches: the person has to reload to find out an owner approved them.
    it("can check again, and gets in once an owner has approved them", async () => {
      let member = false;
      fetchIsMemberOfFirmAddress.mockImplementation(async () => member);
      askToJoinFirm.mockResolvedValue("asked");
      auth.user = { id: "u1" };
      renderAt("acme-brokers.nevermorepeo.com");
      fireEvent.click(await screen.findByRole("button", { name: "Check again" }));
      expect(screen.queryByText("The console")).not.toBeInTheDocument();
      member = true;
      fireEvent.click(await screen.findByRole("button", { name: "Check again" }));
      expect(await screen.findByText("The console")).toBeInTheDocument();
    });

    // Catches: a person from no listed organisation sees anything new (a hint that the firm lists organisations), or the ask changes
    // what they were shown.
    it("sees exactly what they saw before when the database holds no request for them", async () => {
      fetchIsMemberOfFirmAddress.mockResolvedValue(false);
      askToJoinFirm.mockResolvedValue("none");
      auth.user = { id: "u1" };
      const { container } = renderAt("acme-brokers.nevermorepeo.com");
      expect(await screen.findByRole("heading", { name: "You aren't a member of this firm" })).toBeInTheDocument();
      expect(askToJoinFirm).toHaveBeenCalledWith("acme-brokers");
      expect(container.textContent).not.toMatch(/asked to join|approve/i);
      expect(screen.getAllByRole("button")).toHaveLength(1);
    });

    // Catches: a member, a signed-out visitor or a guest is sent through the asking, which is for someone who is not a member.
    it("is the only one asked about joining: not a member, not a signed-out visitor, not a guest", async () => {
      auth.user = { id: "u1" };
      renderAt("acme-brokers.nevermorepeo.com");
      await screen.findByText("The console");
      auth.user = null;
      renderAt("acme-brokers.nevermorepeo.com");
      auth.user = { id: "g1" };
      auth.isAnonymous = true;
      renderAt("acme-brokers.nevermorepeo.com");
      await waitFor(() => expect(fetchFirmName).toHaveBeenCalled());
      expect(askToJoinFirm).not.toHaveBeenCalled();
    });
  });

  it("shows the console to no one while it is still checking", async () => {
    let answer: (v: boolean) => void = () => {};
    fetchIsMemberOfFirmAddress.mockReturnValue(new Promise<boolean>((resolve) => (answer = resolve)));
    auth.user = { id: "u1" };
    renderAt("acme-brokers.nevermorepeo.com");
    await waitFor(() => expect(fetchIsMemberOfFirmAddress).toHaveBeenCalled());
    expect(screen.queryByText("The console")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "You aren't a member of this firm" })).not.toBeInTheDocument();
    answer(true);
    expect(await screen.findByText("The console")).toBeInTheDocument();
  });

  it("leaves the pages a sign-in lands on mounted while the new session is checked, so their one-time code is spent once", async () => {
    let answer: (v: boolean) => void = () => {};
    fetchIsMemberOfFirmAddress.mockReturnValue(new Promise<boolean>((resolve) => (answer = resolve)));
    auth.user = { id: "u1" };
    for (const path of ["/broker/callback", "/auth/callback"]) {
      const view = renderAt("acme-brokers.nevermorepeo.com", path);
      expect(await screen.findByText("The console")).toBeInTheDocument();
      view.unmount();
    }
    answer(false);
  });

  it("keeps a callback page mounted, never unmounted and remounted, from a signed-in member's arrival through the membership check at an existing firm's address", async () => {
    let answer: (v: boolean) => void = () => {};
    fetchIsMemberOfFirmAddress.mockReturnValue(new Promise<boolean>((resolve) => (answer = resolve)));
    auth.user = { id: "u1" };
    const events: string[] = [];
    const Callback = () => {
      useEffect(() => {
        events.push("mounted");
        return () => { events.push("unmounted"); };
      }, []);
      return <p>The callback</p>;
    };
    render(
      <MemoryRouter initialEntries={["/broker/callback?code=one-time"]}>
        <FirmAddressProvider hostname="acme-brokers.nevermorepeo.com">
          <FirmAddressGate><Callback /></FirmAddressGate>
        </FirmAddressProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText("The callback")).toBeInTheDocument();
    await waitFor(() => expect(fetchIsMemberOfFirmAddress).toHaveBeenCalled());
    expect(screen.getByText("The callback")).toBeInTheDocument();
    await act(async () => answer(true));
    expect(screen.getByText("The callback")).toBeInTheDocument();
    expect(events).toEqual(["mounted"]);
  });

  it("does not stop a guest (an employer's session) with the membership question", async () => {
    auth.user = { id: "g1" };
    auth.isAnonymous = true;
    renderAt("acme-brokers.nevermorepeo.com");
    expect(await screen.findByText("The console")).toBeInTheDocument();
    expect(fetchIsMemberOfFirmAddress).not.toHaveBeenCalled();
  });

  it("does not open the console when it can't tell whether the person is a member", async () => {
    fetchIsMemberOfFirmAddress.mockRejectedValue(new Error("down"));
    auth.user = { id: "u1" };
    renderAt("acme-brokers.nevermorepeo.com");
    expect(await screen.findByText("We couldn't check your access")).toBeInTheDocument();
    expect(screen.queryByText("The console")).not.toBeInTheDocument();
    fetchIsMemberOfFirmAddress.mockResolvedValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("The console")).toBeInTheDocument();
  });

  it("does not say the firm is missing when the lookup itself fails", async () => {
    fetchFirmName.mockRejectedValue(new Error("down"));
    renderAt("acme-brokers.nevermorepeo.com");
    expect(await screen.findByText("We couldn't load this page")).toBeInTheDocument();
    expect(screen.queryByText("Oops! Page not found")).not.toBeInTheDocument();
    expect(screen.queryByText("The console")).not.toBeInTheDocument();
    // The person tries again after the blip, and the lookup now answers.
    fetchFirmName.mockResolvedValue("Acme Brokers");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("The console")).toBeInTheDocument();
    expect(fetchFirmName).toHaveBeenCalledTimes(2);
  });

  it("does not mount a callback page when the firm lookup itself fails: it says so instead", async () => {
    fetchFirmName.mockRejectedValue(new Error("down"));
    auth.user = { id: "u1" };
    renderAt("acme-brokers.nevermorepeo.com", "/broker/callback");
    expect(await screen.findByText("We couldn't load this page")).toBeInTheDocument();
    expect(screen.queryByText("The console")).not.toBeInTheDocument();
  });

  it("shows only the checking spinner, and no Sign out, at an address no firm holds while the session is still being read", async () => {
    fetchFirmName.mockResolvedValue(null);
    auth.user = { id: "u1" };
    auth.loading = true;
    renderAt("no-such-firm.nevermorepeo.com");
    await waitFor(() => expect(fetchFirmName).toHaveBeenCalled());
    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Oops! Page not found")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });

  it("holds the console back while the session is still being read", async () => {
    auth.loading = true;
    renderAt("acme-brokers.nevermorepeo.com");
    await waitFor(() => expect(fetchFirmName).toHaveBeenCalled());
    expect(screen.queryByText("The console")).not.toBeInTheDocument();
  });

  it("never shows the console to the next person to sign in, even for a moment, before it has checked them", async () => {
    const seen: string[] = [];
    const Spy = () => {
      seen.push(auth.user?.id ?? "nobody");
      return <p>The console</p>;
    };
    const tree = () => (
      <MemoryRouter>
        <FirmAddressProvider hostname="acme-brokers.nevermorepeo.com">
          <FirmAddressGate><Spy /></FirmAddressGate>
        </FirmAddressProvider>
      </MemoryRouter>
    );
    fetchIsMemberOfFirmAddress.mockImplementation(async () => auth.user?.id === "member");
    auth.user = { id: "member" };
    const { rerender } = render(tree());
    expect(await screen.findByText("The console")).toBeInTheDocument();
    seen.length = 0;
    auth.user = { id: "outsider" };
    rerender(tree());
    expect(await screen.findByRole("heading", { name: "You aren't a member of this firm" })).toBeInTheDocument();
    expect(seen).not.toContain("outsider");
  });

  // An invitation's link is opened by someone who is not a member yet (story CRM-P1.2): the page must be reachable to accept it.
  // The link is `/join` with its secret after the #, so the path names no token (D-34).
  it("lets a signed-in person who is not a member open an invitation's link, and only that: any other page still refuses them", async () => {
    auth.user = { id: "u1" };
    fetchIsMemberOfFirmAddress.mockResolvedValue(false);
    renderAt("acme-brokers.nevermorepeo.com", "/join");
    expect(await screen.findByText("The console")).toBeInTheDocument();
    expect(screen.queryByText("You aren't a member of this firm")).not.toBeInTheDocument();
    for (const path of ["/joined", "/advisor/join", "/join/some-token", "/join/"]) {
      const view = renderAt("acme-brokers.nevermorepeo.com", path);
      expect(await screen.findByText("You aren't a member of this firm"), path).toBeInTheDocument();
      view.unmount();
    }
  });

  // The answer to "is this person a member" was asked while they were not, and kept: after joining, leaving the join page showed
  // "You aren't a member of this firm" until a reload.
  it("asks again after a person has joined, so leaving the join page lets them in without a reload", async () => {
    auth.user = { id: "u1" };
    let member = false;
    fetchIsMemberOfFirmAddress.mockImplementation(async () => member);
    render(
      <MemoryRouter initialEntries={["/join"]}>
        <FirmAddressProvider hostname="acme-brokers.nevermorepeo.com">
          <FirmAddressGate>
            <Link to="/advisor">Continue</Link>
            <p>The console</p>
          </FirmAddressGate>
        </FirmAddressProvider>
      </MemoryRouter>,
    );
    await screen.findByRole("link", { name: "Continue" });
    await waitFor(() => expect(fetchIsMemberOfFirmAddress).toHaveBeenCalledTimes(1));
    member = true;
    await act(async () => { notifyMembershipChanged(); });
    await waitFor(() => expect(fetchIsMemberOfFirmAddress).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("link", { name: "Continue" }));
    expect(await screen.findByText("The console")).toBeInTheDocument();
    expect(screen.queryByText("You aren't a member of this firm")).not.toBeInTheDocument();
  });

  // A sign-in to a firm's console is one entry in the firm's record (CRM-P2.3), written once the person is known to be a
  // member of the firm the address names, and once for each sign-in rather than for each page they open.
  describe("the sign-in recorded in the firm's record", () => {
    it("is reported once, for the firm the address names, when a current member reaches the console", async () => {
      auth.user = { id: "u1", last_sign_in_at: "2026-11-13T09:00:00Z" };
      renderAt("acme-brokers.nevermorepeo.com");
      expect(await screen.findByText("The console")).toBeInTheDocument();
      await waitFor(() => expect(recordFirmSignIn).toHaveBeenCalledWith("acme-brokers"));
      expect(recordFirmSignIn).toHaveBeenCalledTimes(1);
    });

    it("is not reported again for the same sign-in, on another page or after a reload, but is for the next sign-in", async () => {
      auth.user = { id: "u1", last_sign_in_at: "2026-11-13T10:00:00Z" };
      const first = renderAt("acme-brokers.nevermorepeo.com", "/advisor");
      await waitFor(() => expect(recordFirmSignIn).toHaveBeenCalledTimes(1));
      first.unmount();
      renderAt("acme-brokers.nevermorepeo.com", "/advisor/outbox");
      expect(await screen.findByText("The console")).toBeInTheDocument();
      await act(async () => {});
      expect(recordFirmSignIn).toHaveBeenCalledTimes(1);
      auth.user = { id: "u1", last_sign_in_at: "2026-11-14T10:00:00Z" };
      renderAt("acme-brokers.nevermorepeo.com");
      await waitFor(() => expect(recordFirmSignIn).toHaveBeenCalledTimes(2));
    });

    it("is tried again on the next page when it could not be written, and not marked as done", async () => {
      recordFirmSignIn.mockResolvedValueOnce(false);
      auth.user = { id: "u1", last_sign_in_at: "2026-11-13T11:00:00Z" };
      const first = renderAt("acme-brokers.nevermorepeo.com");
      await waitFor(() => expect(recordFirmSignIn).toHaveBeenCalledTimes(1));
      await act(async () => {});
      first.unmount();
      renderAt("acme-brokers.nevermorepeo.com");
      await waitFor(() => expect(recordFirmSignIn).toHaveBeenCalledTimes(2));
    });

    it("is never reported for someone who isn't a member, a signed-out visitor, a guest, an address no firm holds or the bare domain", async () => {
      const cases: [string, () => void][] = [
        ["acme-brokers.nevermorepeo.com", () => { fetchIsMemberOfFirmAddress.mockResolvedValue(false); auth.user = { id: "u1", last_sign_in_at: "t1" }; }],
        ["acme-brokers.nevermorepeo.com", () => { auth.user = null; }],
        ["acme-brokers.nevermorepeo.com", () => { auth.user = { id: "g1", last_sign_in_at: "t2" }; auth.isAnonymous = true; }],
        ["no-such-firm.nevermorepeo.com", () => { fetchFirmName.mockResolvedValue(null); auth.user = { id: "u1", last_sign_in_at: "t3" }; }],
        ["nevermorepeo.com", () => { auth.user = { id: "u1", last_sign_in_at: "t4" }; }],
      ];
      for (const [host, arrange] of cases) {
        arrange();
        const view = renderAt(host);
        await act(async () => {});
        await act(async () => {});
        view.unmount();
        auth.isAnonymous = false;
        fetchFirmName.mockResolvedValue("Acme Brokers");
        fetchIsMemberOfFirmAddress.mockResolvedValue(true);
      }
      expect(recordFirmSignIn).not.toHaveBeenCalled();
    });
  });
  // Help from Nevermore (story CRM-P2.4): a platform admin is no member, and is let in only while their own support session for this
  // firm is open; once the hour is over the page says so, and links back to the platform's firms page.
  describe("a platform admin on a support session", () => {
    const session = (over: Record<string, unknown> = {}) => ({ id: "s1", firmId: "f1", firmName: "Acme Brokers", firmAddress: "acme-brokers", endsAt: "2026-11-18T16:00:00Z", endedAt: null, isOpen: true, secondFactorPending: false, ...over });
    beforeEach(() => {
      auth.user = { id: "admin1", email: "admin@nevermore.example" };
      fetchIsMemberOfFirmAddress.mockResolvedValue(false);
    });

    // Catches: an admin with an open session is told "You aren't a member", or is let in as a member (their sign-in written to the firm's record as theirs).
    it("lets an admin with an open session through, as support, and records no sign-in for them", async () => {
      fetchMySupportSessionHere.mockResolvedValue(session());
      renderAt("acme-brokers.nevermorepeo.com", "/advisor");
      expect(await screen.findByText("The console")).toBeInTheDocument();
      expect(askToJoinFirm).not.toHaveBeenCalled();
      expect(recordFirmSignIn).not.toHaveBeenCalled();
    });

    // Catches: an expired session still opens the firm, or the admin is left on a blank "not a member" page with no way back.
    it("says the hour has ended once it is over, and links back to the firms page", async () => {
      fetchMySupportSessionHere.mockResolvedValue(session({ isOpen: false, endedAt: "2026-11-18T16:00:00Z" }));
      renderAt("acme-brokers.nevermorepeo.com", "/advisor");
      expect(await screen.findByRole("heading", { name: "The support hour has ended" })).toBeInTheDocument();
      expect(screen.queryByText("The console")).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Back to the firms page" })).toHaveAttribute("href", expect.stringMatching(/\/advisor\/firms$/));
    });

    // Catches: an admin whose password sign-in still owes its second step is told they are no member and can never reach the step that would let them in.
    it("lets an admin whose password sign-in owes its second step through to that step, with a session held", async () => {
      fetchMySupportSessionHere.mockResolvedValue(session({ secondFactorPending: true }));
      renderAt("acme-brokers.nevermorepeo.com", "/advisor");
      expect(await screen.findByText("The console")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "You aren't a member of this firm" })).not.toBeInTheDocument();
    });

    // Catches: a person with no session is told anything about support, or never asked to join where their sign-in lists the firm.
    it("treats an admin with no session as any other person who is not a member", async () => {
      renderAt("acme-brokers.nevermorepeo.com", "/advisor");
      expect(await screen.findByRole("heading", { name: "You aren't a member of this firm" })).toBeInTheDocument();
      expect(askToJoinFirm).toHaveBeenCalledWith("acme-brokers");
    });
  });

  // A suspended firm (story CRM-P1.8): its members can still sign in at its address and are told it is suspended, with a way to
  // sign out, and nothing of the firm: no console, no lists, no counts. The firm's name still shows (D-27) before sign-in.
  describe("a suspended firm", () => {
    beforeEach(() => {
      fetchIsMySuspendedFirmAtAddress.mockResolvedValue(true);
      auth.user = { id: "u1", email: "pat@acme.example", last_sign_in_at: "t1" };
    });

    it("tells its member it is suspended and to contact Nevermore, and shows nothing of the firm's console", async () => {
      const { container } = renderAt("acme-brokers.nevermorepeo.com", "/advisor");
      expect(await screen.findByRole("heading", { name: "Acme Brokers is suspended" })).toBeInTheDocument();
      expect(screen.getByText(/contact Nevermore/i)).toBeInTheDocument();
      expect(screen.queryByText("The console")).not.toBeInTheDocument();
      expect(container.textContent).not.toContain("pat@acme.example");
      expect(fetchIsMySuspendedFirmAtAddress).toHaveBeenCalledWith("acme-brokers");
    });

    it("has a Sign out that works", async () => {
      renderAt("acme-brokers.nevermorepeo.com");
      fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
      expect(auth.signOut).toHaveBeenCalledTimes(1);
    });

    it("closes every page of the firm to its member, not only the first they open", async () => {
      for (const path of ["/advisor", "/advisor/activity", "/advisor/submissions/abc", "/advisor/firms"]) {
        const view = renderAt("acme-brokers.nevermorepeo.com", path);
        expect(await screen.findByRole("heading", { name: "Acme Brokers is suspended" }), path).toBeInTheDocument();
        expect(screen.queryByText("The console"), path).not.toBeInTheDocument();
        view.unmount();
      }
    });

    it("is not recorded as a sign-in to the firm: nothing of the firm is written for them", async () => {
      renderAt("acme-brokers.nevermorepeo.com");
      await screen.findByRole("heading", { name: "Acme Brokers is suspended" });
      await act(async () => {});
      expect(recordFirmSignIn).not.toHaveBeenCalled();
    });

    it("is asked only of a member: a person who is not one is told so and nothing is asked about the firm's state", async () => {
      fetchIsMemberOfFirmAddress.mockResolvedValue(false);
      renderAt("acme-brokers.nevermorepeo.com");
      expect(await screen.findByRole("heading", { name: "You aren't a member of this firm" })).toBeInTheDocument();
      expect(fetchIsMySuspendedFirmAtAddress).not.toHaveBeenCalled();
    });

    it("still shows a signed-out visitor the firm's sign-in", async () => {
      auth.user = null;
      renderAt("acme-brokers.nevermorepeo.com");
      expect(await screen.findByText("The console")).toBeInTheDocument();
      expect(fetchIsMySuspendedFirmAtAddress).not.toHaveBeenCalled();
    });

    it("says it couldn't check, with a retry, when the state can't be read, rather than showing the console", async () => {
      fetchIsMySuspendedFirmAtAddress.mockRejectedValueOnce(new Error("boom"));
      renderAt("acme-brokers.nevermorepeo.com");
      expect(await screen.findByRole("heading", { name: "We couldn't check your access" })).toBeInTheDocument();
      expect(screen.queryByText("The console")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      expect(await screen.findByRole("heading", { name: "Acme Brokers is suspended" })).toBeInTheDocument();
    });

    it("gives the console back when the suspension is lifted and the page is asked again", async () => {
      const view = renderAt("acme-brokers.nevermorepeo.com");
      await screen.findByRole("heading", { name: "Acme Brokers is suspended" });
      view.unmount();
      fetchIsMySuspendedFirmAtAddress.mockResolvedValue(false);
      renderAt("acme-brokers.nevermorepeo.com");
      expect(await screen.findByText("The console")).toBeInTheDocument();
    });
  });

});
