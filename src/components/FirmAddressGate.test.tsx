import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const auth = {
  user: null as { id: string; email?: string } | null,
  loading: false,
  isAnonymous: false,
  signOut: vi.fn(),
};
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
const fetchFirmName = vi.fn();
const fetchIsMemberOfFirmAddress = vi.fn();
vi.mock("@/lib/firmApi", () => ({
  fetchFirmName: (...a: unknown[]) => fetchFirmName(...a),
  fetchIsMemberOfFirmAddress: (...a: unknown[]) => fetchIsMemberOfFirmAddress(...a),
}));

const { FirmAddressProvider } = await import("@/hooks/useFirmAddress");
const { default: FirmAddressGate } = await import("./FirmAddressGate");

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
});
