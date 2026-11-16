import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Seam 2 (D-13): an advisor sends the bundle to a PEO from the submission page (M-2.1), with the database faked at its API modules and the
// mailbox check at advisorApi, as useFirstSend (6.1) reads it.
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const fetchMyMailbox = vi.fn();
vi.mock("@/lib/advisorApi", () => ({ fetchMyMailbox: () => fetchMyMailbox() }));
vi.mock("@/lib/brokerAuth", () => ({ startBrokerSignIn: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const loadPeoSendContext = vi.fn();
const sendToPeo = vi.fn();
vi.mock("@/lib/peoSendApi", () => ({
  loadPeoSendContext: (...a: unknown[]) => loadPeoSendContext(...a),
  sendToPeo: (...a: unknown[]) => sendToPeo(...a),
}));

const { default: SendToPeo } = await import("./SendToPeo");

const CONNECTED = { mailbox: { connected: true, address: "sam@acme.example" }, contacts: [{ name: "Dana Lee", role: "Underwriter", email: "dana@insperity.example" }], reply_address: null };
const issueLink = vi.fn();

const props = {
  sessionId: "s1", peo: "Insperity", companyName: "Reyes Bakery", fileId: "EAA-2026-0042", version: 3, openItems: ["Loss runs"],
  returnTo: "/advisor/submissions/s1", issueLink, onSent: vi.fn(), onSendYourself: vi.fn(),
};

describe("SendToPeo", () => {
  beforeEach(() => {
    fetchMyMailbox.mockReset();
    loadPeoSendContext.mockReset();
    sendToPeo.mockReset();
  });

  // Break caught: a send that goes to nobody the advisor chose, without their note, or skips the bundle link; or a contact picked and a typed
  // address where only one reaches the PEO.
  it("sends to the people picked from the PEO's contacts and typed, with the cover note and the bundle link", async () => {
    loadPeoSendContext.mockResolvedValue(CONNECTED);
    fetchMyMailbox.mockResolvedValue({ connected: true, provider: "google", address: "sam@acme.example" });
    sendToPeo.mockResolvedValue({ quoteRequestId: 7, messageId: 41 });
    render(<SendToPeo {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Send to Insperity" }));
    const form = await screen.findByRole("form", { name: "Send to Insperity" });
    fireEvent.click(within(form).getByRole("checkbox", { name: /Dana Lee/ }));
    fireEvent.change(within(form).getByLabelText("Other addresses"), { target: { value: "quotes@insperity.example" } });
    fireEvent.change(within(form).getByLabelText("Your note"), { target: { value: "Dana, here is Reyes Bakery." } });
    fireEvent.click(within(form).getByRole("button", { name: "Send" }));
    await waitFor(() => expect(sendToPeo).toHaveBeenCalledTimes(1));
    expect(sendToPeo.mock.calls[0][0]).toEqual({
      sessionId: "s1", peo: "Insperity", to: ["dana@insperity.example", "quotes@insperity.example"], subject: "Reyes Bakery: EAA-2026-0042, version 3",
      note: "Dana, here is Reyes Bakery.", issueLink,
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Queued to Insperity from sam@acme.example");
  });

  // Break caught: an advisor with no mailbox (or whose permission was taken back) sends anyway and nothing goes, or is left with no way on: told
  // so with a way to connect, the send recorded nothing, and they can send from their own mail with the reply address in CC and record it.
  it("with no mailbox, says so with a way to connect, sends nothing, and offers to send it from their own mail with the reply address in CC", async () => {
    loadPeoSendContext.mockResolvedValue({ ...CONNECTED, mailbox: { connected: false, address: null }, reply_address: "eaa-2026-0042.insperity.0123456789abcdef" });
    fetchMyMailbox.mockResolvedValue({ connected: false });
    vi.stubEnv("VITE_QUOTE_REPLY_DOMAIN", "replies.nevermore.example");
    const onSendYourself = vi.fn();
    render(<SendToPeo {...props} onSendYourself={onSendYourself} />);
    fireEvent.click(await screen.findByRole("button", { name: "Send to Insperity" }));
    const form = await screen.findByRole("form", { name: "Send to Insperity" });
    expect(await within(form).findByRole("region", { name: "Your mailbox" })).toHaveTextContent(/connect/i);
    fireEvent.change(within(form).getByLabelText("Your note"), { target: { value: "Dana, here it is." } });
    fireEvent.click(within(form).getByRole("button", { name: "Send" }));
    const dialog = await screen.findByRole("dialog");
    expect(sendToPeo).not.toHaveBeenCalled();
    expect(dialog).toHaveTextContent("eaa-2026-0042.insperity.0123456789abcdef@replies.nevermore.example");
    fireEvent.click(within(dialog).getByRole("button", { name: "Send from your own mail" }));
    expect(onSendYourself).toHaveBeenCalledTimes(1);
  });
  // M-2.3. Break caught: a PEO holding an older version offered a plain first send, so nothing tells the advisor it is an update, or the update sent
  // as a first send (no "what changed", the old link replaced rather than revoked as a newer version); or anything sent before the advisor sends it.
  it("offers a PEO holding an older version the update, and sends nothing until the advisor sends it", async () => {
    loadPeoSendContext.mockResolvedValue(CONNECTED);
    fetchMyMailbox.mockResolvedValue({ connected: true, provider: "google", address: "sam@acme.example" });
    sendToPeo.mockResolvedValue({ quoteRequestId: 7, messageId: 42 });
    render(<SendToPeo {...props} updateFrom={2} />);
    expect(screen.getByText("Insperity has version 2. Version 3 is certified.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send version 3 to Insperity" }));
    const form = await screen.findByRole("form", { name: "Send version 3 to Insperity" });
    expect(within(form).getByRole("region", { name: "Added under your note" })).toHaveTextContent(
      "What changed since version 2: each answer by its name and the census by count, never a value",
    );
    expect(sendToPeo).not.toHaveBeenCalled();
    fireEvent.click(within(form).getByRole("checkbox", { name: /Dana Lee/ }));
    fireEvent.change(within(form).getByLabelText("Your note"), { target: { value: "Dana, they certified again." } });
    fireEvent.click(within(form).getByRole("button", { name: "Send" }));
    await waitFor(() => expect(sendToPeo).toHaveBeenCalledTimes(1));
    expect(sendToPeo.mock.calls[0][0]).toMatchObject({ peo: "Insperity", to: ["dana@insperity.example"], note: "Dana, they certified again.", update: true });
  });
});
