import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LegalLinks from "./LegalLinks";

const renderLinks = (props: Parameters<typeof LegalLinks>[0] = {}) =>
  render(
    <MemoryRouter>
      <LegalLinks {...props} />
    </MemoryRouter>,
  );

describe("LegalLinks", () => {
  it("links to the Privacy Policy and Terms of Use", () => {
    renderLinks();
    const nav = screen.getByRole("navigation", { name: "Legal" });
    expect(within(nav).getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
    expect(within(nav).getByRole("link", { name: "Terms of Use" })).toHaveAttribute("href", "/terms");
    expect(nav).not.toHaveTextContent("©");
  });

  it("keeps the full names for assistive technology when the labels are short", () => {
    renderLinks({ compact: true });
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveTextContent(/^Privacy$/);
    expect(screen.getByRole("link", { name: "Terms of Use" })).toHaveTextContent(/^Terms$/);
  });

  it("adds the copyright line when asked", () => {
    renderLinks({ copyright: true });
    expect(screen.getByRole("navigation", { name: "Legal" })).toHaveTextContent("© Edgar Allan Advisory");
  });
});
