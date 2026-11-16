import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Seam 2 (D-13): on the advisor's submission page, who may receive the packet (M-1.1, D-608), with the database faked at its API module.
const loadPeoAuthorizations = vi.fn();
vi.mock("@/lib/peoAuthorizationsApi", () => ({ loadPeoAuthorizations: (...a: unknown[]) => loadPeoAuthorizations(...a) }));

const { default: PacketRecipientsPanel } = await import("./PacketRecipientsPanel");

const states = [
  { peo: "Insperity", state: "not_asked", signedAt: null, wordingVersion: null },
  { peo: "Justworks", state: "withdrawn", signedAt: "2026-11-15T10:00:00Z", wordingVersion: "2026-11-draft-1" },
  { peo: "TriNet", state: "authorized", signedAt: "2026-11-14T10:00:00Z", wordingVersion: "2026-11-draft-1" },
];

describe("PacketRecipientsPanel", () => {
  beforeEach(() => loadPeoAuthorizations.mockReset());

  // Break caught: the advisor can't see which PEOs the employer authorized before recording a send, or a withdrawn PEO reads as never asked.
  it("lists who may receive the packet, who was withdrawn and who was never authorized", async () => {
    loadPeoAuthorizations.mockResolvedValue(states);
    render(<PacketRecipientsPanel sessionId="s1" onAsk={vi.fn()} />);
    const panel = await screen.findByRole("region", { name: "Who may receive the packet" });
    expect(await within(panel).findByText("TriNet")).toBeInTheDocument();
    expect(within(panel).getByText("TriNet").closest("li")).toHaveTextContent("May receive it");
    expect(within(panel).getByText("Justworks").closest("li")).toHaveTextContent("Withdrawn by the employer");
    expect(within(panel).getByText("Insperity").closest("li")).toHaveTextContent("Not authorized");
    expect(loadPeoAuthorizations).toHaveBeenCalledWith("s1");
  });

  // Break caught: an advisor who wants another PEO has no way to ask but to send it anyway; the ask is offered for a PEO already authorized; the
  // draft does not name the PEO, or tells the employer to do anything but add it themselves.
  it("offers to ask the employer to add each PEO not authorized, with a draft naming it", async () => {
    loadPeoAuthorizations.mockResolvedValue(states);
    const onAsk = vi.fn();
    render(<PacketRecipientsPanel sessionId="s1" onAsk={onAsk} />);
    fireEvent.click(await screen.findByRole("button", { name: "Ask the employer to add Insperity" }));
    expect(onAsk).toHaveBeenCalledWith(
      "We'd like to send your packet to Insperity. If you agree, tick Insperity under \"Who can receive my packet\" on your profile. Nothing goes to Insperity until you do.",
    );
    expect(screen.getByRole("button", { name: "Ask the employer to add Justworks" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ask the employer to add TriNet" })).not.toBeInTheDocument();
  });

  // Break caught: a failed load reads as "no PEO may receive it" (and the rejection goes unhandled).
  it("says when who may receive the packet could not be loaded", async () => {
    loadPeoAuthorizations.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(states);
    render(<PacketRecipientsPanel sessionId="s1" onAsk={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load who may receive the packet.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("May receive it")).toBeInTheDocument();
  });
});
