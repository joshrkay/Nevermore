import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Seam 2 (D-13): the employer's boxes for which PEOs may receive their packet (M-1.1, D-608), with the database faked at its API module.
const loadPeoAuthorizations = vi.fn();
const setPeoAuthorization = vi.fn();
const loadIntakeLine = vi.fn();
vi.mock("@/lib/peoAuthorizationsApi", () => ({
  loadPeoAuthorizations: (...a: unknown[]) => loadPeoAuthorizations(...a),
  setPeoAuthorization: (...a: unknown[]) => setPeoAuthorization(...a),
  loadIntakeLine: (...a: unknown[]) => loadIntakeLine(...a),
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
    loadIntakeLine.mockReset();
    loadIntakeLine.mockResolvedValue("peo");
  });

  // ADR 0029. Break caught: an employer on a workers' comp intake asked "Which PEOs may receive your packet?" over a list of carriers, and told that ticking
  // records "the PEO you tick".
  it("asks about carriers on a workers' comp intake, in every line of its wording", async () => {
    loadIntakeLine.mockResolvedValue("workers_comp");
    loadPeoAuthorizations.mockResolvedValue([{ peo: "Granite Ridge Mutual", state: "not_asked", signedAt: null, wordingVersion: null }]);
    render(<PacketRecipients sessionId="s1" />);
    const group = await screen.findByRole("group", { name: "Which workers' comp carriers may receive your packet?" });
    expect(within(group).getByRole("checkbox", { name: "Granite Ridge Mutual" })).not.toBeChecked();
    expect(group.textContent).toMatch(/the carrier you tick/);
    expect(group.textContent).not.toMatch(/PEO/);
    expect(loadIntakeLine).toHaveBeenCalledWith("s1");
  });

  // Break caught: the PEO question lost on a PEO intake, or the whole list failing because the intake's line could not be read (a database with no lines yet).
  it("asks about PEOs on a PEO intake, and when the intake's line can't be read", async () => {
    loadPeoAuthorizations.mockResolvedValue(states);
    const first = render(<PacketRecipients sessionId="s1" />);
    expect(await screen.findByRole("group", { name: "Which PEOs may receive your packet?" })).toBeInTheDocument();
    first.unmount();
    loadIntakeLine.mockRejectedValue(new Error("column chamber_sessions.line does not exist"));
    render(<PacketRecipients sessionId="s1" />);
    const group = await screen.findByRole("group", { name: "Which PEOs may receive your packet?" });
    expect(await within(group).findByRole("checkbox", { name: "TriNet" })).toBeChecked();
  });

  // ADR 0029. Break caught: an employer on a workers' comp intake, whose list of carriers failed to load, told "We couldn't load the PEOs".
  it("says it couldn't load the carriers when a workers' comp intake's list can't be read", async () => {
    loadIntakeLine.mockResolvedValue("workers_comp");
    loadPeoAuthorizations.mockRejectedValue(new Error("down"));
    render(<PacketRecipients sessionId="s1" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load the carriers. Check your connection and try again.");
  });

  // ADR 0029. Break caught: the words of the last intake shown (a workers' comp one) kept for another intake whose line could not be read: an employer on a
  // PEO intake asked about carriers.
  it("goes back to a PEO intake's words for an intake whose line can't be read, after showing a workers' comp one", async () => {
    loadIntakeLine.mockResolvedValueOnce("workers_comp");
    loadPeoAuthorizations.mockResolvedValue(states);
    const shown = render(<PacketRecipients sessionId="s1" />);
    expect(await screen.findByRole("group", { name: "Which workers' comp carriers may receive your packet?" })).toBeInTheDocument();
    loadIntakeLine.mockRejectedValue(new Error("down"));
    shown.rerender(<PacketRecipients sessionId="s2" />);
    expect(await screen.findByRole("group", { name: "Which PEOs may receive your packet?" })).toBeInTheDocument();
  });

  // Break caught: the profile's boxes, one group for each company and headed by its name, all headed by the same question, so the employer can't tell
  // which company a box is for.
  it("is headed by the name the screen gives it, in place of the line's question", async () => {
    loadPeoAuthorizations.mockResolvedValue(states);
    render(<PacketRecipients sessionId="s1" heading="Reyes Bakery" />);
    expect(await screen.findByRole("group", { name: "Reyes Bakery" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Which PEOs may receive your packet?" })).toBeNull();
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
