import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

// CRM-S3.8a: a session ended to sign in again for an export sends the person to sign in and back to the page they were on, with its address.
let sessionEnded: string | null = "step_up";
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null, loading: false, isAnonymous: false, signOut: vi.fn(), sessionEnded }) }));
vi.mock("@/lib/advisorApi", () => ({ fetchNeedsSecondFactor: vi.fn() }));
vi.mock("@/lib/monitoring", () => ({ reportOpsEvent: vi.fn() }));

const { default: RequireAccess } = await import("./RequireAccess");

const Login = () => {
  const state = useLocation().state as { from?: { pathname: string; search: string }; reason?: string; audience?: string } | null;
  return <p data-testid="login">{JSON.stringify({ from: state?.from ? `${state.from.pathname}${state.from.search}` : null, reason: state?.reason, audience: state?.audience })}</p>;
};
const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/advisor/activity" element={<RequireAccess check={async () => true} denied={() => null} deniedCode="x"><p>Page</p></RequireAccess>} />
      </Routes>
    </MemoryRouter>,
  );

describe("RequireAccess after a sign-in is asked for again to export", () => {
  it("sends the person to sign in, remembers the page with its filters, and says why", () => {
    sessionEnded = "step_up";
    renderAt("/advisor/activity?person=u2&kind=send_recorded");
    expect(JSON.parse(screen.getByTestId("login").textContent ?? "{}")).toEqual({ from: "/advisor/activity?person=u2&kind=send_recorded", reason: "step_up", audience: "advisor" });
  });
});
