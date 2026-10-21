import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const auth = {
  user: null as { id: string; email?: string } | null,
  loading: false,
  isAnonymous: false,
  sessionEnded: null as "signed_out" | "expired" | null,
  signOut: vi.fn(),
};
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
const fetchIsAdvisor = vi.fn();
vi.mock("@/lib/advisorApi", () => ({ fetchIsAdvisor: () => fetchIsAdvisor() }));

const { default: RequireAdvisor } = await import("./RequireAdvisor");

const Login = () => {
  const state = useLocation().state as { from?: { pathname: string }; audience: string; reason?: string };
  return (
    <p>
      Login page for {state.audience} returning to {state.from?.pathname ?? "nowhere"}
      {state.reason ? ` (${state.reason})` : ""}
    </p>
  );
};

const renderGuarded = () =>
  render(
    <MemoryRouter initialEntries={["/advisor/submissions/s1"]}>
      <Routes>
        <Route path="/advisor/submissions/:id" element={<RequireAdvisor><p>Advisor tools</p></RequireAdvisor>} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </MemoryRouter>,
  );

describe("RequireAdvisor", () => {
  beforeEach(() => {
    auth.user = { id: "u1", email: "pat@example.com" };
    auth.loading = false;
    auth.isAnonymous = false;
    auth.sessionEnded = null;
    fetchIsAdvisor.mockReset();
  });

  it("sends a signed-out visitor to sign in, remembering where they were going", () => {
    auth.user = null;
    renderGuarded();
    expect(screen.getByText("Login page for advisor returning to /advisor/submissions/s1")).toBeInTheDocument();
    expect(fetchIsAdvisor).not.toHaveBeenCalled();
  });

  it("tells the sign-in page when the session expired, and still returns to the same page", () => {
    auth.user = null;
    auth.sessionEnded = "expired";
    renderGuarded();
    expect(screen.getByText("Login page for advisor returning to /advisor/submissions/s1 (expired)")).toBeInTheDocument();
  });

  it("after a deliberate sign-out says so, and doesn't remember the page for the next person", () => {
    auth.user = null;
    auth.sessionEnded = "signed_out";
    renderGuarded();
    expect(screen.getByText("Login page for advisor returning to nowhere (signed_out)")).toBeInTheDocument();
  });

  it("treats a guest session as signed out", () => {
    auth.isAnonymous = true;
    renderGuarded();
    expect(screen.getByText(/Login page for advisor/)).toBeInTheDocument();
    expect(fetchIsAdvisor).not.toHaveBeenCalled();
  });

  it("shows nothing protected while access is being checked", () => {
    fetchIsAdvisor.mockReturnValue(new Promise(() => {}));
    renderGuarded();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Advisor tools")).not.toBeInTheDocument();
  });

  it("refuses a signed-in prospect", async () => {
    fetchIsAdvisor.mockResolvedValue(false);
    renderGuarded();
    expect(await screen.findByText("Advisor access required")).toBeInTheDocument();
    expect(screen.getByText(/pat@example.com isn't an advisor account/)).toBeInTheDocument();
    expect(screen.queryByText("Advisor tools")).not.toBeInTheDocument();
  });

  it("lets an advisor in", async () => {
    fetchIsAdvisor.mockResolvedValue(true);
    renderGuarded();
    expect(await screen.findByText("Advisor tools")).toBeInTheDocument();
  });

  it("offers a retry when access can't be checked", async () => {
    fetchIsAdvisor.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(true);
    renderGuarded();
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Advisor tools")).toBeInTheDocument();
  });
});
