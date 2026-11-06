import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null, loading: false, isAnonymous: false }) }));
const { default: Navbar } = await import("./Navbar");

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
    expect(menu).toHaveTextContent("Sample Manuscript");
  });
});
