import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { INTAKE_CONSENT_AGREEMENT, INTAKE_CONSENT_SECTIONS, INTAKE_CONSENT_VERSION, intakeConsentText } from "@/data/intakeConsent";

const auth = { user: { id: "u1" } as { id: string } | null };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));

// The lookup and the agreement, as the gate makes them.
const lookups: { user: unknown; version: unknown }[] = [];
let lookup: () => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      expect(table).toBe("intake_consents");
      const filters: Record<string, unknown> = {};
      const chain = {
        select: () => chain,
        eq: (col: string, val: unknown) => {
          filters[col] = val;
          return chain;
        },
        maybeSingle: () => {
          lookups.push({ user: filters.user_id, version: filters.consent_version });
          return lookup();
        },
      };
      return chain;
    },
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));

const { default: IntakeConsentGate } = await import("./IntakeConsentGate");

const renderGate = () =>
  render(
    <MemoryRouter>
      <IntakeConsentGate>
        <p>The Chamber</p>
      </IntakeConsentGate>
    </MemoryRouter>,
  );

describe("IntakeConsentGate", () => {
  beforeEach(() => {
    auth.user = { id: "u1" };
    lookups.length = 0;
    lookup = async () => ({ data: null, error: null });
    rpc.mockReset();
    rpc.mockResolvedValue({ data: "2026-11-04T10:00:00Z", error: null });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("opens the Chamber straight away for an account that already agreed to this version", async () => {
    lookup = async () => ({ data: { accepted_at: "2026-11-01T00:00:00Z" }, error: null });
    renderGate();
    expect(await screen.findByText("The Chamber")).toBeInTheDocument();
    expect(lookups).toEqual([{ user: "u1", version: INTAKE_CONSENT_VERSION }]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("shows who we are and what is collected, and keeps the Chamber closed until the prospect agrees", async () => {
    renderGate();
    expect(await screen.findByRole("heading", { name: "Before you start" })).toBeInTheDocument();
    for (const section of INTAKE_CONSENT_SECTIONS) {
      expect(screen.getByRole("heading", { name: section.heading })).toBeInTheDocument();
      expect(screen.getByText(section.body)).toBeInTheDocument();
    }
    expect(screen.getByText(/not a PEO, an insurance carrier or an insurance agency/)).toBeInTheDocument();
    expect(screen.getByText(/Draft wording, pending legal review/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Terms of Use" })).toHaveAttribute("href", "/terms");
    expect(screen.queryByText("The Chamber")).not.toBeInTheDocument();

    const agree = screen.getByRole("button", { name: "Agree and start" });
    expect(agree).toBeDisabled();
    fireEvent.click(agree);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("records the exact wording and version, then opens the Chamber", async () => {
    renderGate();
    fireEvent.click(await screen.findByRole("checkbox", { name: INTAKE_CONSENT_AGREEMENT }));
    fireEvent.click(screen.getByRole("button", { name: "Agree and start" }));
    expect(await screen.findByText("The Chamber")).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith("record_intake_consent", { p_version: INTAKE_CONSENT_VERSION, p_text: intakeConsentText() });
  });

  it("stays closed and says why when the agreement isn't recorded", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "EA005", message: "out of date" } });
    renderGate();
    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Agree and start" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This page is out of date. Reload it");
    expect(screen.queryByText("The Chamber")).not.toBeInTheDocument();

    rpc.mockResolvedValueOnce({ data: null, error: { code: "08006", message: "network" } });
    fireEvent.click(screen.getByRole("button", { name: "Agree and start" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't record your agreement");
    expect(screen.queryByText("The Chamber")).not.toBeInTheDocument();
  });

  it("keeps the Chamber closed when the lookup fails, and tries again on request", async () => {
    lookup = async () => ({ data: null, error: { message: "timeout" } });
    renderGate();
    expect(await screen.findByRole("heading", { name: "We couldn't open your intake" })).toBeInTheDocument();
    lookup = async () => ({ data: { accepted_at: "2026-11-01T00:00:00Z" }, error: null });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("The Chamber")).toBeInTheDocument();
  });

  it("asks again when a different person signs in", async () => {
    lookup = async () => ({ data: { accepted_at: "2026-11-01T00:00:00Z" }, error: null });
    const view = renderGate();
    expect(await screen.findByText("The Chamber")).toBeInTheDocument();

    lookup = async () => ({ data: null, error: null });
    auth.user = { id: "u2" };
    await act(async () => {
      view.rerender(
        <MemoryRouter>
          <IntakeConsentGate>
            <p>The Chamber</p>
          </IntakeConsentGate>
        </MemoryRouter>,
      );
    });
    await waitFor(() => expect(screen.getByRole("heading", { name: "Before you start" })).toBeInTheDocument());
    expect(screen.queryByText("The Chamber")).not.toBeInTheDocument();
    expect(lookups.at(-1)).toEqual({ user: "u2", version: INTAKE_CONSENT_VERSION });
  });

  it("waits, showing nothing of the Chamber, while there is no signed-in user yet", () => {
    auth.user = null;
    renderGate();
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(screen.queryByText("The Chamber")).not.toBeInTheDocument();
    expect(lookups).toEqual([]);
  });
});

describe("intakeConsentText", () => {
  it("is every section, then the agreement, as stored", () => {
    const text = intakeConsentText();
    for (const section of INTAKE_CONSENT_SECTIONS) expect(text).toContain(`${section.heading}: ${section.body}`);
    expect(text.endsWith(INTAKE_CONSENT_AGREEMENT)).toBe(true);
    expect(text.length).toBeLessThanOrEqual(20000);
  });
});
