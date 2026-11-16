import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Seam 2 (D-13): "Who can receive my packet" on the employer's profile (M-1.1, D-608), the database faked at its API module and each intake's boxes
// (tested on their own) stubbed.
const auth = { user: { id: "u1" } as { id: string } | null };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
const listMyCertifiedIntakes = vi.fn();
vi.mock("@/lib/peoAuthorizationsApi", () => ({ listMyCertifiedIntakes: (...a: unknown[]) => listMyCertifiedIntakes(...a) }));
vi.mock("@/components/PacketRecipients", () => ({
  default: ({ sessionId, heading }: { sessionId: string; heading: string }) => <section aria-label={heading} data-session={sessionId} />,
}));

const { default: MyPacketRecipients } = await import("./MyPacketRecipients");

describe("MyPacketRecipients", () => {
  beforeEach(() => listMyCertifiedIntakes.mockReset());

  // Break caught: an employer with a certified intake can't add or withdraw a PEO for it from their profile; one with two intakes sees only one.
  it("offers the boxes of each certified intake, by its company", async () => {
    listMyCertifiedIntakes.mockResolvedValue([{ id: "s1", company: "Acme Co" }, { id: "s2", company: "Beta Co" }]);
    render(<MyPacketRecipients />);
    expect(await screen.findByRole("region", { name: "Acme Co" })).toHaveAttribute("data-session", "s1");
    expect(screen.getByRole("region", { name: "Beta Co" })).toHaveAttribute("data-session", "s2");
    // Break caught: the intakes of someone other than the signed-in employer are asked for.
    expect(listMyCertifiedIntakes).toHaveBeenCalledWith("u1");
  });

  // Break caught: an employer with nothing certified sees an empty heading and can't tell why there is nothing to choose.
  it("says when there is no certified packet yet", async () => {
    listMyCertifiedIntakes.mockResolvedValue([]);
    render(<MyPacketRecipients />);
    expect(await screen.findByText("Once you certify your intake, you can choose here which PEOs may receive its packet.")).toBeInTheDocument();
  });

  // Break caught: a failed load reads as "nothing certified yet" (and the rejection goes unhandled).
  it("says when the certified intakes could not be loaded", async () => {
    listMyCertifiedIntakes.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<MyPacketRecipients />);
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load your packets. Reload the page to try again.");
    expect(screen.queryByText(/Once you certify your intake/)).not.toBeInTheDocument();
  });
});
