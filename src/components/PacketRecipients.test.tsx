import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Seam 2 (D-13): the employer's boxes for which PEOs may receive their packet (M-1.1, D-608), with the database faked at its API module.
const loadPeoAuthorizations = vi.fn();
const setPeoAuthorization = vi.fn();
vi.mock("@/lib/peoAuthorizationsApi", () => ({
  loadPeoAuthorizations: (...a: unknown[]) => loadPeoAuthorizations(...a),
  setPeoAuthorization: (...a: unknown[]) => setPeoAuthorization(...a),
}));

const { default: PacketRecipients } = await import("./PacketRecipients");

const states = [
  { peo: "Insperity", state: "not_asked", signedAt: null, wordingVersion: null },
  { peo: "Justworks", state: "withdrawn", signedAt: "2026-11-15T10:00:00Z", wordingVersion: "2026-11-draft-1" },
  { peo: "TriNet", state: "authorized", signedAt: "2026-11-14T10:00:00Z", wordingVersion: "2026-11-draft-1" },
];

describe("PacketRecipients", () => {
  beforeEach(() => {
    loadPeoAuthorizations.mockReset();
    setPeoAuthorization.mockReset();
  });

  // Break caught: the employer can't see which PEOs they authorized; a withdrawn PEO shows ticked; the wording is shown without saying it is a draft.
  it("shows a box per PEO, ticked for those authorized, with the wording marked as a draft", async () => {
    loadPeoAuthorizations.mockResolvedValue(states);
    render(<PacketRecipients sessionId="s1" heading="Which PEOs may receive your packet?" />);
    const group = await screen.findByRole("group", { name: "Which PEOs may receive your packet?" });
    expect(within(group).getByRole("checkbox", { name: "TriNet" })).toBeChecked();
    expect(within(group).getByRole("checkbox", { name: "Justworks" })).not.toBeChecked();
    expect(within(group).getByRole("checkbox", { name: "Insperity" })).not.toBeChecked();
    expect(screen.getByText("Draft wording, not yet reviewed by counsel")).toBeInTheDocument();
    expect(loadPeoAuthorizations).toHaveBeenCalledWith("s1");
  });

  // Break caught: a change is not saved as it is made (the employer leaves thinking they authorized a PEO, and nothing was recorded); unticking does not
  // withdraw; the box shows the new choice before the database has it.
  it("saves each change as it is made: ticking authorizes, unticking withdraws", async () => {
    loadPeoAuthorizations.mockResolvedValue(states);
    setPeoAuthorization.mockResolvedValue(undefined);
    render(<PacketRecipients sessionId="s1" heading="Which PEOs may receive your packet?" />);
    const insperity = await screen.findByRole("checkbox", { name: "Insperity" });
    fireEvent.click(insperity);
    await waitFor(() => expect(insperity).toBeChecked());
    expect(setPeoAuthorization).toHaveBeenLastCalledWith("s1", "Insperity", true);
    const trinet = screen.getByRole("checkbox", { name: "TriNet" });
    fireEvent.click(trinet);
    await waitFor(() => expect(trinet).not.toBeChecked());
    expect(setPeoAuthorization).toHaveBeenLastCalledWith("s1", "TriNet", false);
  });

  // Break caught: a change that the database refused (the wording changed, the connection dropped) shows as made; the employer is not told why in
  // plain words; the next try keeps the old failure on screen.
  it("says when a change could not be saved, and leaves the box as it was", async () => {
    loadPeoAuthorizations.mockResolvedValue(states);
    setPeoAuthorization.mockRejectedValueOnce(Object.assign(new Error("This wording is out of date. Reload the page to read the current version."), { code: "EA005" }));
    render(<PacketRecipients sessionId="s1" heading="Which PEOs may receive your packet?" />);
    const insperity = await screen.findByRole("checkbox", { name: "Insperity" });
    fireEvent.click(insperity);
    expect(await screen.findByRole("alert")).toHaveTextContent("This wording is out of date. Reload the page to read the current version.");
    expect(insperity).not.toBeChecked();
    setPeoAuthorization.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fireEvent.click(insperity);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("That didn't go through. Check your connection and try again."));
    setPeoAuthorization.mockResolvedValueOnce(undefined);
    fireEvent.click(insperity);
    await waitFor(() => expect(insperity).toBeChecked());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // Break caught: the employer thinks a PEO must be ticked to finish, or isn't told the packet carries their employees' information, or that a
  // choice can be changed later.
  it("says none has to be ticked, what the packet carries, and that it can be changed later", async () => {
    loadPeoAuthorizations.mockResolvedValue(states);
    render(<PacketRecipients sessionId="s1" heading="Which PEOs may receive your packet?" />);
    await screen.findByRole("checkbox", { name: "TriNet" });
    expect(screen.getByText(/You don't have to tick any: with none ticked, nothing is sent\./)).toBeInTheDocument();
    expect(screen.getByText(/your employees' personal information/)).toBeInTheDocument();
    expect(screen.getByText(/add or withdraw a PEO at any time from your profile/)).toBeInTheDocument();
  });

  // Break caught: the words recorded with a tick are words the employer never saw.
  it("shows the words a tick records", async () => {
    loadPeoAuthorizations.mockResolvedValue(states);
    render(<PacketRecipients sessionId="s1" heading="Which PEOs may receive your packet?" />);
    await screen.findByRole("checkbox", { name: "TriNet" });
    expect(screen.getByText(/I authorize the PEO you tick to receive my company's packet, including my employees' personal information/)).toBeInTheDocument();
  });

  // Break caught: a failed load leaves an empty list that reads as "no PEOs" (and the rejection goes unhandled), with no way to try again.
  it("says when the PEOs could not be loaded, and tries again on request", async () => {
    loadPeoAuthorizations.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(states);
    render(<PacketRecipients sessionId="s1" heading="Which PEOs may receive your packet?" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load the PEOs. Check your connection and try again.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("checkbox", { name: "TriNet" })).toBeChecked();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
