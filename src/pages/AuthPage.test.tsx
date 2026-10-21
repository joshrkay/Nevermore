import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const auth = {
  user: null as { id: string } | null,
  loading: false,
  isAnonymous: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
};
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { default: AuthPage } = await import("./AuthPage");

const renderLogin = (state?: Record<string, unknown>) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/login", state }]}>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/advisor" element={<p>Advisor queue</p>} />
        <Route path="/advisor/submissions/:id" element={<p>One submission</p>} />
        <Route path="/start" element={<p>The Chamber</p>} />
      </Routes>
    </MemoryRouter>,
  );

const signInAs = (email: string) => {
  fireEvent.change(screen.getByPlaceholderText("you@company.com"), { target: { value: email } });
  fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "hunter22" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
};

describe("AuthPage", () => {
  beforeEach(() => {
    auth.user = null;
    auth.loading = false;
    auth.isAnonymous = false;
    auth.signIn.mockReset().mockResolvedValue({ error: null });
  });

  it("says so when an advisor's session expired", () => {
    renderLogin({ audience: "advisor", reason: "expired", from: { pathname: "/advisor" } });
    expect(screen.getByRole("status")).toHaveTextContent("Your session expired. Sign in again to continue.");
    expect(screen.getByRole("heading", { name: "Advisor Sign In" })).toBeInTheDocument();
  });

  it("confirms a deliberate sign-out", () => {
    renderLogin({ audience: "advisor", reason: "signed_out" });
    expect(screen.getByRole("status")).toHaveTextContent("You've been signed out.");
  });

  it("shows no notice for an ordinary visit", () => {
    renderLogin({ audience: "advisor", from: { pathname: "/advisor" } });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    renderLogin();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("returns an advisor to the page they were on", async () => {
    renderLogin({ audience: "advisor", reason: "expired", from: { pathname: "/advisor/submissions/s1", search: "" } });
    signInAs("adv@example.com");
    expect(await screen.findByText("One submission")).toBeInTheDocument();
  });

  it("takes an advisor with no remembered page to the queue, not the prospect intake", async () => {
    renderLogin({ audience: "advisor", reason: "signed_out" });
    signInAs("adv@example.com");
    await waitFor(() => expect(screen.getByText("Advisor queue")).toBeInTheDocument());
    expect(screen.queryByText("The Chamber")).not.toBeInTheDocument();
  });

  it("still takes a prospect to the Chamber", async () => {
    renderLogin();
    signInAs("pat@example.com");
    expect(await screen.findByText("The Chamber")).toBeInTheDocument();
  });
});
