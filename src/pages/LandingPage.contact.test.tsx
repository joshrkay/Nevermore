import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const firm = { current: { status: "none" } as { status: string; address?: string; name?: string } };
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => firm.current }));

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

beforeEach(() => {
  firm.current = { status: "none" };
});

const renderLanding = () =>
  render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );

// The firm's public link (story CRM-L1.2b): a visitor who would rather be called than start an intake can ask the firm at whose address they are.
describe("the landing page, asking a firm to make contact", () => {
  // Break caught: the form is missing at a firm's address (so no visitor can ask), or it shows on the bare domain, where no firm is named and a lead would have no firm.
  it("offers the form at a firm's address, naming the firm, and not on the bare domain", () => {
    renderLanding();
    expect(screen.queryByRole("button", { name: /to contact me/ })).toBeNull();
    firm.current = { status: "known", address: "acme-brokers", name: "Acme Brokers" };
    renderLanding();
    expect(screen.getByRole("button", { name: "Ask Acme Brokers to contact me" })).toBeTruthy();
  });
});
