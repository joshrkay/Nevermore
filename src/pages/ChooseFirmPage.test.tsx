import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const auth = {
  user: { id: "u1", email: "pat@example.com" } as { id: string; email?: string } | null,
  session: { access_token: "tok-1" } as { access_token: string } | null,
  loading: false,
  isAnonymous: false,
  sessionEnded: null as "signed_out" | "expired" | null,
  signOut: vi.fn(),
};
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
const fetchMyFirms = vi.fn();
const fetchNeedsSecondFactor = vi.fn();
vi.mock("@/lib/advisorApi", () => ({
  fetchMyFirms: () => fetchMyFirms(),
  fetchOwnedFirms: () => Promise.resolve([]),
  fetchNeedsSecondFactor: () => fetchNeedsSecondFactor(),
}));
vi.mock("@/lib/monitoring", () => ({ reportOpsEvent: vi.fn() }));
// Leaving for a firm's address is a page load the test can't make; it records where the page sent the person instead.
const openFirmAddress = vi.fn();
vi.mock("@/lib/firmHost", async (original) => ({ ...(await original<typeof import("@/lib/firmHost")>()), openFirmAddress: (url: string) => openFirmAddress(url) }));

const { clearMyFirms } = await import("@/hooks/useOwnedFirms");
const { default: ChooseFirmPage } = await import("./ChooseFirmPage");

const alpha = { firm_id: "f1", name: "Alpha Advisory", address: "alpha-advisory", role: "agent", refused: false };
const bravo = { firm_id: "f2", name: "Bravo Brokers", address: "bravo-brokers", role: "owner", refused: false };
const refusedFirm = { firm_id: "f3", name: "Refused Brokers", address: "refused-brokers", role: "owner", refused: true };

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/choose-firm"]}>
      <Routes>
        <Route path="/choose-firm" element={<ChooseFirmPage />} />
        <Route path="/login" element={<p>Login page</p>} />
        <Route path="/advisor/second-factor" element={<p>Second factor page</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  auth.user = { id: "u1", email: "pat@example.com" };
  auth.session = { access_token: "tok-1" };
  auth.loading = false;
  auth.isAnonymous = false;
  auth.signOut.mockReset();
  clearMyFirms();
  fetchMyFirms.mockReset();
  fetchNeedsSecondFactor.mockReset().mockResolvedValue(false);
  openFirmAddress.mockReset();
});

describe("Choose a firm (CRM-S1.1b, D-40)", () => {
  it("lists each of the person's firms as a link to the console at that firm's own address, where they sign in", async () => {
    fetchMyFirms.mockResolvedValue([alpha, bravo]);
    renderPage();
    expect(await screen.findByRole("heading", { name: "Choose a firm" })).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Your firms" });
    const links = await within(list).findAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual([expect.stringContaining("Alpha Advisory"), expect.stringContaining("Bravo Brokers")]);
    // The test page is served at localhost, so the links stay on this machine as the firm addresses do in development.
    const { protocol, port } = window.location;
    expect(links[0]).toHaveAttribute("href", `${protocol}//alpha-advisory.localhost${port ? `:${port}` : ""}/advisor`);
    expect(links[1]).toHaveAttribute("href", `${protocol}//bravo-brokers.localhost${port ? `:${port}` : ""}/advisor`);
    expect(screen.getByText(/pat@example.com/)).toBeInTheDocument();
  });

  it("carries the legal links, and a way to sign in with another account", async () => {
    fetchMyFirms.mockResolvedValue([alpha, bravo]);
    renderPage();
    await screen.findByRole("heading", { name: "Choose a firm" });
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Terms of Use" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign in with another account" }));
    expect(auth.signOut).toHaveBeenCalled();
  });

  it("leaves out a refused firm, whose address shows nothing (D-31)", async () => {
    fetchMyFirms.mockResolvedValue([alpha, refusedFirm, bravo]);
    renderPage();
    const list = await screen.findByRole("list", { name: "Your firms" });
    const links = await within(list).findAllByRole("link");
    expect(links).toHaveLength(2);
    expect(screen.queryByText("Refused Brokers")).not.toBeInTheDocument();
    expect(openFirmAddress).not.toHaveBeenCalled();
  });

  it("goes straight to the one firm left when the others were refused, as a member of one firm would", async () => {
    fetchMyFirms.mockResolvedValue([refusedFirm, bravo]);
    renderPage();
    const { protocol, port } = window.location;
    await vi.waitFor(() => expect(openFirmAddress).toHaveBeenCalledWith(`${protocol}//bravo-brokers.localhost${port ? `:${port}` : ""}/advisor`));
    expect(screen.queryByRole("list", { name: "Your firms" })).not.toBeInTheDocument();
  });

  it("tells a person whose only firms were refused that they aren't a member of any firm", async () => {
    fetchMyFirms.mockResolvedValue([refusedFirm]);
    renderPage();
    expect(await screen.findByRole("heading", { name: "You aren't a member of any firm" })).toBeInTheDocument();
    expect(openFirmAddress).not.toHaveBeenCalled();
  });

  it("tells a person who belongs to no firm so", async () => {
    fetchMyFirms.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByRole("heading", { name: "You aren't a member of any firm" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Choose a firm" })).not.toBeInTheDocument();
  });

  it("sends a password sign-in that owes its second factor there first (D-19)", async () => {
    fetchMyFirms.mockResolvedValue([]);
    fetchNeedsSecondFactor.mockResolvedValue(true);
    renderPage();
    expect(await screen.findByText("Second factor page")).toBeInTheDocument();
  });

  it("sends a signed-out visitor to sign in", () => {
    auth.user = null;
    renderPage();
    expect(screen.getByText("Login page")).toBeInTheDocument();
    expect(fetchMyFirms).not.toHaveBeenCalled();
  });
});
