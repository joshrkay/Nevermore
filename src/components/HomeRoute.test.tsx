import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = { user: null as { id: string } | null, isAnonymous: false };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
let firmAddress: { status: "none" } | { status: "known"; address: string; name: string } = { status: "none" };
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => firmAddress }));
vi.mock("@/components/Navbar", () => ({ default: () => <p>Navbar</p> }));
vi.mock("@/pages/LandingPage", () => ({ default: () => <p>Landing page</p> }));

const { default: HomeRoute } = await import("./HomeRoute");
const renderHome = () =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/advisor" element={<p>The workspace</p>} />
      </Routes>
    </MemoryRouter>,
  );
const atFirm = { status: "known", address: "alpha", name: "Alpha" } as const;

// D-52: at a firm's address `/` is the workspace for a member; everyone else's `/` is as it was.
describe("the home address", () => {
  beforeEach(() => { auth.user = null; auth.isAnonymous = false; firmAddress = { status: "none" }; });

  it("sends a signed-in person at a firm's address to the workspace", () => {
    auth.user = { id: "u1" };
    firmAddress = atFirm;
    renderHome();
    expect(screen.getByText("The workspace")).toBeInTheDocument();
  });

  it("keeps the landing page on the bare domain, even for a signed-in person", () => {
    auth.user = { id: "u1" };
    renderHome();
    expect(screen.getByText("Landing page")).toBeInTheDocument();
  });

  it("keeps the landing page at a firm's address for someone signed out, and for a guest's anonymous session", () => {
    firmAddress = atFirm;
    renderHome();
    expect(screen.getByText("Landing page")).toBeInTheDocument();
    auth.user = { id: "guest" };
    auth.isAnonymous = true;
    renderHome();
    expect(screen.getAllByText("Landing page")).toHaveLength(2);
  });
});
