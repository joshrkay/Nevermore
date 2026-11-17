import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const auth = { current: { user: null, loading: false, isAnonymous: false } as { user: object | null; loading: boolean; isAnonymous: boolean } };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth.current }));
const firm = { current: { status: "none" } as { status: string; address?: string; name?: string } };
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => firm.current }));
const owned = { current: null as { firm_id: string; name: string }[] | null };
vi.mock("@/hooks/useOwnedFirms", () => ({ useOwnedFirms: () => owned.current }));
const { default: Navbar } = await import("./Navbar");

const renderNavbar = () =>
  render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>,
  );

beforeEach(() => {
  auth.current = { user: null, loading: false, isAnonymous: false };
  firm.current = { status: "none" };
  owned.current = null;
});

describe("Navbar", () => {
  it("names the phone-width menu button and says whether the menu is open", () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );
    const toggle = screen.getByRole("button", { name: "Open menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    const close = screen.getByRole("button", { name: "Close menu" });
    expect(close).toHaveAttribute("aria-expanded", "true");
    const menu = document.getElementById(close.getAttribute("aria-controls") ?? "");
    expect(menu).not.toBeNull();
    expect(menu).toHaveTextContent("Sample packet");
  });

  // Break caught: a visitor on the homepage has no way to reach the sign-in page.
  it("links Sign in to /login", () => {
    renderNavbar();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });

  // Break caught: a brokerage firm that wants an account has no way in from the homepage.
  it("links Sign up your firm to /firms/new", () => {
    renderNavbar();
    expect(screen.getByRole("link", { name: "Sign up your firm" })).toHaveAttribute("href", "/firms/new");
  });

  // Break caught: a signed-in broker is still offered Sign in and Sign up your firm, and has no link to the workspace.
  it("gives a signed-in person a link to the workspace instead of Sign in and Sign up your firm", () => {
    auth.current = { user: { id: "u1" }, loading: false, isAnonymous: false };
    renderNavbar();
    expect(screen.getByRole("link", { name: "Your workspace" })).toHaveAttribute("href", "/advisor");
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Sign up your firm" })).toBeNull();
  });

  // Break caught: a prospect's guest session (anonymous) is treated as a signed-in broker, hiding Sign in and sending them to a workspace they cannot open.
  it("treats a guest session as a visitor", () => {
    auth.current = { user: { id: "g1" }, loading: false, isAnonymous: true };
    renderNavbar();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Sign up your firm" })).toHaveAttribute("href", "/firms/new");
    expect(screen.queryByRole("link", { name: "Your workspace" })).toBeNull();
  });

  // Break caught: at a firm's address the page offers to sign up another firm, or loses Sign in.
  it("at a firm's address keeps Sign in and does not offer Sign up your firm", () => {
    firm.current = { status: "known", address: "acme-brokers", name: "Acme Brokers" };
    renderNavbar();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("link", { name: "Sign up your firm" })).toBeNull();
  });

  // Break caught: at phone width the header's links are all hidden, so a visitor on a phone cannot sign in or sign up.
  it("offers Sign in and Sign up your firm in the phone-width menu, and Your workspace to a signed-in person", () => {
    renderNavbar();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const menu = document.getElementById("mobile-menu")!;
    expect(within(menu).getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(within(menu).getByRole("link", { name: /Sign up your firm/ })).toHaveAttribute("href", "/firms/new");
    cleanup();
    auth.current = { user: { id: "u1" }, loading: false, isAnonymous: false };
    renderNavbar();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(within(document.getElementById("mobile-menu")!).getByRole("link", { name: "Your workspace" })).toHaveAttribute("href", "/advisor");
  });

  // Break caught: a signed-in person with no firm yet (a broker who has just made an account) has no way to sign their firm up from the homepage.
  it("offers a signed-in person who owns no firm Sign up your firm beside Your workspace", () => {
    auth.current = { user: { id: "u1" }, loading: false, isAnonymous: false };
    owned.current = [];
    renderNavbar();
    expect(screen.getByRole("link", { name: "Sign up your firm" })).toHaveAttribute("href", "/firms/new");
    expect(screen.getByRole("link", { name: "Your workspace" })).toHaveAttribute("href", "/advisor");
  });

  // Break caught: a person who already owns a firm is offered to sign up another as the main action, instead of going to the one they have.
  it("offers a firm's owner Your firm, not Sign up your firm", () => {
    auth.current = { user: { id: "u1" }, loading: false, isAnonymous: false };
    owned.current = [{ firm_id: "f1", name: "Acme Brokers" }];
    renderNavbar();
    expect(screen.getByRole("link", { name: "Your firm" })).toHaveAttribute("href", "/advisor");
    expect(screen.queryByRole("link", { name: "Sign up your firm" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Your workspace" })).toBeNull();
  });

  // Break caught: the phone-width menu forgets who owns a firm.
  it("in the phone-width menu, offers a firm's owner Your firm and a signed-in person with no firm Sign up your firm", () => {
    auth.current = { user: { id: "u1" }, loading: false, isAnonymous: false };
    owned.current = [{ firm_id: "f1", name: "Acme Brokers" }];
    renderNavbar();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    let menu = within(document.getElementById("mobile-menu")!);
    expect(menu.getByRole("link", { name: "Your firm" })).toHaveAttribute("href", "/advisor");
    expect(menu.queryByRole("link", { name: "Sign up your firm" })).toBeNull();
    cleanup();
    owned.current = [];
    renderNavbar();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    menu = within(document.getElementById("mobile-menu")!);
    expect(menu.getByRole("link", { name: "Sign up your firm" })).toHaveAttribute("href", "/firms/new");
  });
});
