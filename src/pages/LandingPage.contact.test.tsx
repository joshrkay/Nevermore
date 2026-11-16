import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const firm = { current: { status: "none" } as { status: string; address?: string; name?: string } };
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => firm.current }));

const takes = vi.fn();
vi.mock("@/lib/firmApi", async () => ({ ...(await vi.importActual<object>("@/lib/firmApi")), fetchFirmTakesIntakes: (a: string) => takes(a) }));

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
  takes.mockReset();
  takes.mockResolvedValue(true);
  vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "site-key-123");
  document.head.querySelectorAll("script").forEach((s) => s.remove());
});

afterEach(() => {
  vi.unstubAllEnvs();
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
  it("offers the form at a firm's address, naming the firm, and not on the bare domain", async () => {
    // Break caught as well: Cloudflare's script is loaded for every visitor to the landing page (the bare domain included), not only where the form is.
    const turnstileScripts = () => [...document.head.querySelectorAll("script")].filter((s) => s.src.startsWith("https://challenges.cloudflare.com/"));
    renderLanding();
    expect(screen.queryByRole("button", { name: /to contact me/ })).toBeNull();
    expect(turnstileScripts()).toHaveLength(0);
    firm.current = { status: "known", address: "acme-brokers", name: "Acme Brokers" };
    renderLanding();
    expect(screen.getByRole("button", { name: "Ask Acme Brokers to contact me" })).toBeTruthy();
    await vi.waitFor(() => expect(turnstileScripts()).toHaveLength(1));
  });

  // Break caught: with no site key the form is offered anyway (open without the check), or the visitor is left with nothing said.
  it("says asking to be contacted isn't available, and offers no form, when there is no site key", () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "");
    firm.current = { status: "known", address: "acme-brokers", name: "Acme Brokers" };
    renderLanding();
    expect(screen.getByText("Asking to be contacted isn't available right now")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /to contact me/ })).toBeNull();
  });
});

// The firm's public page has two actions (D-1713, D-1830): "Get a quote" (slice 5.2's GetAQuote) and "Ask to be contacted".
describe("the landing page, getting a quote from a firm", () => {
  // Break caught: slice 5.2's "Get a quote" is built but never placed, so a firm's public page offers no way to start a quote.
  it("offers Get a quote at a firm's address, starting an intake there", async () => {
    firm.current = { status: "known", address: "acme-brokers", name: "Acme Brokers" };
    renderLanding();
    const links = await screen.findAllByRole("link", { name: "Get a quote" });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "/start");
  });

  // Break caught: a firm's page still carries the generic "Start chatting" (the second call to action), so a visitor has two different ways in, one of them bypassing the firm's switch for intakes.
  it("replaces every generic Start chatting with Get a quote at a firm's address, and keeps Start chatting on the bare domain", async () => {
    renderLanding();
    expect(screen.getAllByRole("link", { name: /Start chatting/ }).length).toBe(2);
    cleanup();
    firm.current = { status: "known", address: "acme-brokers", name: "Acme Brokers" };
    renderLanding();
    await screen.findAllByRole("link", { name: "Get a quote" });
    expect(screen.queryByRole("link", { name: /Start chatting/ })).toBeNull();
  });
});
