import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const auth = { user: null as { id: string } | null, loading: false, isAnonymous: false };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
const toast = { error: vi.fn(), success: vi.fn() };
vi.mock("sonner", () => ({ toast }));
const startBrokerSignIn = vi.fn();
vi.mock("@/lib/brokerAuth", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/brokerAuth")>()), startBrokerSignIn: (...a: unknown[]) => startBrokerSignIn(...a) }));

const { default: BrokerSignInPage } = await import("./BrokerSignInPage");

const renderPage = (state?: Record<string, unknown>) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/broker/sign-in", state }]}>
      <Routes>
        <Route path="/broker/sign-in" element={<BrokerSignInPage />} />
        <Route path="/advisor" element={<p>Advisor queue</p>} />
        <Route path="/advisor/held" element={<p>Held mail</p>} />
        <Route path="/login" element={<p>Password sign in</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe("BrokerSignInPage", () => {
  beforeEach(() => {
    auth.user = null;
    auth.loading = false;
    auth.isAnonymous = false;
    startBrokerSignIn.mockReset().mockResolvedValue(undefined);
    toast.error.mockReset();
  });

  it("offers Google and Microsoft and says what signing in lets the product do", () => {
    renderPage();
    expect(screen.getByRole("button", { name: "Sign in with Google" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in with Microsoft" })).toBeInTheDocument();
    expect(screen.getByText(/send email as you/)).toBeInTheDocument();
    expect(screen.getByText(/never reads your mail/)).toBeInTheDocument();
    expect(screen.getByText(/untick the send permission/)).toBeInTheDocument();
  });

  it("starts the chosen provider's sign-in, and returns to the page the broker was sent from", async () => {
    renderPage({ from: { pathname: "/advisor/held", search: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in with Microsoft" }));
    await waitFor(() => expect(startBrokerSignIn).toHaveBeenCalledWith("microsoft", "/advisor/held"));
  });

  it("says so, and lets the broker try again, when the sign-in can't start", async () => {
    startBrokerSignIn.mockRejectedValue(new Error("down"));
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Sign in with Google" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Google")));
    expect(screen.getByRole("button", { name: "Sign in with Google" })).not.toBeDisabled();
  });

  it("keeps the password sign-in for those who have one", () => {
    renderPage();
    expect(screen.getByRole("link", { name: "Sign in with email and password" })).toHaveAttribute("href", "/login");
  });

  it("sends someone already signed in to the console, but not a guest", () => {
    auth.user = { id: "u1" };
    renderPage();
    expect(screen.getByText("Advisor queue")).toBeInTheDocument();
  });

  it("stays for a guest session", () => {
    auth.user = { id: "g1" };
    auth.isAnonymous = true;
    renderPage();
    expect(screen.getByRole("button", { name: "Sign in with Google" })).toBeInTheDocument();
  });
});
