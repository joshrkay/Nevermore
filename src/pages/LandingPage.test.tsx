import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));

const { default: Navbar } = await import("@/components/Navbar");
const { default: LandingPage } = await import("./LandingPage");

// framer-motion's whileInView needs an IntersectionObserver, which jsdom lacks.
beforeAll(() => {
  class NoopObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", NoopObserver);
});

const renderLanding = (entry = "/") =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Navbar />
      <LandingPage />
    </MemoryRouter>,
  );

describe("landing page links", () => {
  it("points every in-page link at a section that exists", () => {
    const { container } = renderLanding();
    const anchors = [...container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
    expect(anchors.length).toBeGreaterThan(0);
    for (const anchor of anchors) {
      const id = anchor.getAttribute("href")!.slice(1);
      expect(document.getElementById(id), `${anchor.textContent} -> #${id}`).not.toBeNull();
    }
  });

  it("has a For PEO Partners section that the navbar link reaches", () => {
    renderLanding();
    const link = screen.getAllByRole("link", { name: "For PEO Partners" })[0];
    expect(link).toHaveAttribute("href", "#peo-partners");
    const section = document.getElementById("peo-partners")!;
    expect(section).toHaveTextContent("For PEO Partners");
    expect(section.querySelector('a[href="/manuscript/demo"]')).not.toBeNull();
  });

  it("scrolls to the section named in the address when the page loads", () => {
    const scrolled: string[] = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.id);
    };
    try {
      renderLanding("/#peo-partners");
      expect(scrolled).toEqual(["peo-partners"]);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it("ignores a hash that is an auth redirect, not a section", () => {
    const scrolled: string[] = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.id);
    };
    try {
      renderLanding("/#error=access_denied&error_code=otp_expired");
      renderLanding("/#%E0%A4%A");
      expect(scrolled).toEqual([]);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });
});
