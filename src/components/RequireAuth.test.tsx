import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const auth = {
  user: null as { id: string } | null,
  loading: false,
  signInAnonymously: vi.fn(),
};
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));

const { default: RequireAuth } = await import("./RequireAuth");

const renderGuarded = () =>
  render(
    <MemoryRouter initialEntries={["/start"]}>
      <Routes>
        <Route path="/start" element={<RequireAuth><p>The Chamber</p></RequireAuth>} />
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe("RequireAuth", () => {
  beforeEach(() => {
    auth.user = null;
    auth.loading = false;
    auth.signInAnonymously = vi.fn().mockResolvedValue({ error: null });
  });

  it("gives a signed-out visitor a guest session instead of sending them to log in", async () => {
    renderGuarded();
    await waitFor(() => expect(auth.signInAnonymously).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Login page")).not.toBeInTheDocument();
    expect(screen.queryByText("The Chamber")).not.toBeInTheDocument();
  });

  it("shows the Chamber once the guest session exists, without starting another", () => {
    auth.user = { id: "guest-1" };
    renderGuarded();
    expect(screen.getByText("The Chamber")).toBeInTheDocument();
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("falls back to the login page when guest sessions aren't available", async () => {
    auth.signInAnonymously = vi.fn().mockResolvedValue({ error: new Error("Anonymous sign-ins are disabled") });
    renderGuarded();
    expect(await screen.findByText("Login page")).toBeInTheDocument();
  });

  it("asks for a guest session only once while it is being created", async () => {
    const { rerender } = renderGuarded();
    rerender(
      <MemoryRouter initialEntries={["/start"]}>
        <Routes>
          <Route path="/start" element={<RequireAuth><p>The Chamber</p></RequireAuth>} />
          <Route path="/login" element={<p>Login page</p>} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(auth.signInAnonymously).toHaveBeenCalledTimes(1));
  });
});
