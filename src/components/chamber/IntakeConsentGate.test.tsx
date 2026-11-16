import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { INTAKE_CONSENT_AGREEMENT, INTAKE_CONSENT_SECTIONS, INTAKE_CONSENT_VERSION, intakeConsentText } from "@/data/intakeConsent";
import type { FirmAddress } from "@/hooks/useFirmAddress";

const auth = { user: { id: "u1" } as { id: string } | null };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));

// The firm the page is at: none on the bare domain.
let firmAddress: FirmAddress = { status: "none" };
vi.mock("@/hooks/useFirmAddress", () => ({ useFirmAddress: () => firmAddress }));
const alpha: FirmAddress = { status: "known", address: "alpha-advisory", name: "Alpha Advisory" };

// The lookup and the agreement, as the gate makes them.
const lookups: { user: unknown; version: unknown }[] = [];
let lookup: () => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc = vi.fn();
// What the database says of the link at the firm's address.
let takesIntakes = true;
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
    firmAddress = { status: "none" };
    lookups.length = 0;
    lookup = async () => ({ data: null, error: null });
    rpc.mockReset();
    takesIntakes = true;
    rpc.mockImplementation(async (name: string) =>
      name === "firm_takes_intakes" ? { data: takesIntakes, error: null } : { data: "2026-11-04T10:00:00Z", error: null });
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

  // Break caught: a firm's link opens the same first screen as the bare domain's, so the employer never learns whose link it is (P-2.1, D-1713).
  it("at a firm's address says who invited them", async () => {
    firmAddress = alpha;
    renderGate();
    expect(await screen.findByText("You were invited by Alpha Advisory")).toBeInTheDocument();
  });

  // Break caught: the consent never says the firm will see the answers, so an employer agrees without knowing who reads what they enter (D-1713).
  it("at a firm's address says in a section that the firm will see the answers, in draft wording", async () => {
    firmAddress = alpha;
    renderGate();
    expect(await screen.findByRole("heading", { name: "Who will see your answers" })).toBeInTheDocument();
    expect(screen.getByText(/Alpha Advisory will see everything you enter in this intake: your answers, your employees' personal information and the documents you upload/)).toBeInTheDocument();
    expect(screen.getByText("Draft wording, not yet reviewed by counsel")).toBeInTheDocument();
  });

  // Break caught: a closing, suspended or refused firm's link still shows the agreement, and the employer types answers that can't be saved (D-1741).
  it("at a link that takes no intakes says so, shows no agreement and asks nothing to be recorded", async () => {
    firmAddress = alpha;
    takesIntakes = false;
    renderGate();
    expect(await screen.findByRole("heading", { name: "This link isn't taking new intakes" })).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith("firm_takes_intakes", { p_address: "alpha-advisory" });
    expect(screen.queryByRole("heading", { name: "Before you start" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Agree and start" })).not.toBeInTheDocument();
    expect(screen.queryByText("The Chamber")).not.toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalledWith("record_intake_consent", expect.anything());
  });

  // Break caught: the agreement shows, and can be ticked, for the moment before the link's answer comes, at a link that then turns out to take none.
  it("at a firm's address shows nothing of the agreement until the link's answer has come", async () => {
    firmAddress = alpha;
    let answer: (v: { data: boolean; error: null }) => void = () => undefined;
    rpc.mockImplementation((name: string) =>
      name === "firm_takes_intakes" ? new Promise((resolve) => (answer = resolve)) : Promise.resolve({ data: "2026-11-04T10:00:00Z", error: null }));
    renderGate();
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("firm_takes_intakes", { p_address: "alpha-advisory" }));
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Before you start" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    await act(async () => answer({ data: false, error: null }));
    expect(await screen.findByRole("heading", { name: "This link isn't taking new intakes" })).toBeInTheDocument();
  });

  // Break caught: a link whose answer can't be had leaves the employer on a spinner for good, or is refused for a lookup that failed (the database refuses a start the link can't take anyway).
  it("at a firm's address carries on to the agreement when the link's answer can't be had", async () => {
    firmAddress = alpha;
    rpc.mockImplementation(async (name: string) =>
      name === "firm_takes_intakes" ? { data: null, error: { message: "timeout" } } : { data: "2026-11-04T10:00:00Z", error: null });
    renderGate();
    expect(await screen.findByRole("heading", { name: "Before you start" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "This link isn't taking new intakes" })).not.toBeInTheDocument();
  });

  // Break caught: an employer who already agreed, and has an intake open, is shut out of it when the firm's link stops taking new ones (D-1745).
  it("at a firm's address opens the Chamber for an account that already agreed, without asking about the link", async () => {
    firmAddress = alpha;
    takesIntakes = false;
    lookup = async () => ({ data: { accepted_at: "2026-11-01T00:00:00Z" }, error: null });
    renderGate();
    expect(await screen.findByText("The Chamber")).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });

  // Break caught: the bare domain shows an invitation from nobody, or a section about a firm that isn't there.
  it("on the bare domain shows no invitation and no firm section", async () => {
    renderGate();
    expect(await screen.findByRole("heading", { name: "Before you start" })).toBeInTheDocument();
    expect(screen.queryByText(/You were invited by/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Who will see your answers" })).not.toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("records the exact wording and version, then opens the Chamber", async () => {
    renderGate();
    fireEvent.click(await screen.findByRole("checkbox", { name: INTAKE_CONSENT_AGREEMENT }));
    fireEvent.click(screen.getByRole("button", { name: "Agree and start" }));
    expect(await screen.findByText("The Chamber")).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith("record_intake_consent", { p_version: INTAKE_CONSENT_VERSION, p_text: intakeConsentText() });
  });

  // Break caught: the agreement is recorded with the bare wording, so the record doesn't show the employer was told the firm would see the answers.
  it("at a firm's address records the firm's line with the agreement, exactly as it was shown", async () => {
    firmAddress = alpha;
    renderGate();
    fireEvent.click(await screen.findByRole("checkbox", { name: INTAKE_CONSENT_AGREEMENT }));
    fireEvent.click(screen.getByRole("button", { name: "Agree and start" }));
    expect(await screen.findByText("The Chamber")).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith("record_intake_consent", {
      p_version: INTAKE_CONSENT_VERSION,
      p_text: `${intakeConsentText()}\n\nWho will see your answers: Alpha Advisory invited you, so Alpha Advisory will see everything you enter in this intake: your answers, your employees' personal information and the documents you upload.`,
    });
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
