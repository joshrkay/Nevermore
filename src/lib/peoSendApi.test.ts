import { beforeEach, describe, expect, it, vi } from "vitest";

// Seam 4 (D-13) at the browser's edge: the send's calls, with the database faked at the client.
const rpc = vi.fn();
const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));

const { sendToPeo } = await import("./peoSendApi");

describe("sendToPeo", () => {
  beforeEach(() => {
    rpc.mockReset();
    invoke.mockReset().mockResolvedValue({ data: null, error: null });
  });

  // M-2.3. Break caught: an update recorded as a first send, so the email doesn't say what changed since the version the PEO holds, or a refusal
  // only an update has (the PEO already holds the latest) never asked.
  it("sends an update through send_peo_update, then issues the link and joins it as a send does", async () => {
    rpc.mockImplementation((name: string) =>
      Promise.resolve(name === "send_peo_update" ? { data: { quote_request_id: 7, message_id: 42 }, error: null } : { data: { message_id: 42 }, error: null }));
    const issueLink = vi.fn().mockResolvedValue({ id: 9, token: "t" });
    const r = await sendToPeo({ sessionId: "s1", peo: "Insperity", to: ["dana@insperity.example"], subject: "S", note: "N", issueLink, update: true });
    expect(rpc.mock.calls[0]).toEqual(["send_peo_update", { p_session_id: "s1", p_peo: "Insperity", p_to: ["dana@insperity.example"], p_subject: "S", p_note: "N" }]);
    expect(issueLink).toHaveBeenCalledWith(7);
    expect(rpc.mock.calls[1]).toEqual(["attach_peo_link", { p_message_id: 42, p_link_id: 9, p_token: "t" }]);
    expect(r).toEqual({ quoteRequestId: 7, messageId: 42 });
  });
});
