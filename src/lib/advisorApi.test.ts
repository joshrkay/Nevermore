import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

const { AdvisorApiError, fetchIsAdvisor, listOutboxEvents, listSubmissions, outboxSummary, requeueOutboxEvent } = await import("./advisorApi");

const failWith = (error: { message: string; code?: string }) => rpc.mockResolvedValue({ data: null, error });
const caught = async (run: () => Promise<unknown>) => {
  try {
    await run();
  } catch (err) {
    return err as InstanceType<typeof AdvisorApiError>;
  }
  throw new Error("expected the call to fail");
};

describe("advisor API errors", () => {
  beforeEach(() => rpc.mockReset());

  it("reports a role check that comes back true or false", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });
    await expect(fetchIsAdvisor()).resolves.toBe(true);
    rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(fetchIsAdvisor()).resolves.toBe(false);
  });

  it("calls a database refusal a lack of advisor access", async () => {
    failWith({ code: "42501", message: "Advisor access required" });
    const err = await caught(() => listSubmissions(null));
    expect(err).toBeInstanceOf(AdvisorApiError);
    expect(err.forbidden).toBe(true);
    expect(err.unauthenticated).toBe(false);
    expect(err.message).toBe("You don't have advisor access.");
  });

  it.each([
    ["PostgREST's expired-token code", { code: "PGRST301", message: "JWT expired" }],
    ["an expired token reported without a code", { message: "JWT expired" }],
    ["an invalid token", { code: "PGRST303", message: "JWT cryptographic operation failed" }],
    ["storage's wording for an expired token", { message: "exp claim timestamp check failed" }],
    ["PostgREST's no-suitable-key code, whatever its wording", { code: "PGRST301", message: "No suitable key or wrong key type" }],
    ["PostgREST's anonymous-access code, whatever its wording", { code: "PGRST302", message: "Anonymous access is disabled" }],
  ])("calls %s an ended session", async (_label, error) => {
    failWith(error);
    const err = await caught(() => listSubmissions(null));
    expect(err.unauthenticated).toBe(true);
    expect(err.forbidden).toBe(false);
    expect(err.message).toBe("Your session has expired. Sign in again to continue.");
  });

  it("leaves any other failure as it was reported", async () => {
    failWith({ code: "57014", message: "canceling statement due to statement timeout" });
    const err = await caught(() => listSubmissions(null));
    expect(err.forbidden).toBe(false);
    expect(err.unauthenticated).toBe(false);
    expect(err.message).toBe("canceling statement due to statement timeout");
  });

  it("falls back to a plain message when the failure has none", async () => {
    failWith({ message: "" });
    const err = await caught(() => listSubmissions(null));
    expect(err.message).toBe("Couldn't load submissions.");
  });
});

describe("outbox API", () => {
  beforeEach(() => rpc.mockReset());

  it("lists the queue, all of it or one status, through the advisor-only function", async () => {
    rpc.mockResolvedValue({ data: [{ id: "e1" }], error: null });
    await expect(listOutboxEvents(null)).resolves.toEqual([{ id: "e1" }]);
    expect(rpc).toHaveBeenLastCalledWith("advisor_list_outbox_events", {});
    await listOutboxEvents("dead");
    expect(rpc).toHaveBeenLastCalledWith("advisor_list_outbox_events", { p_status: "dead" });
  });

  it("treats an empty answer as an empty queue", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(listOutboxEvents(null)).resolves.toEqual([]);
    await expect(outboxSummary()).resolves.toEqual([]);
  });

  it("reads the counts", async () => {
    rpc.mockResolvedValue({ data: [{ status: "dead", events: 2, oldest_due_at: null }], error: null });
    await expect(outboxSummary()).resolves.toEqual([{ status: "dead", events: 2, oldest_due_at: null }]);
    expect(rpc).toHaveBeenLastCalledWith("advisor_outbox_summary");
  });

  it("requeues by event id, with or without a rebuild, and reports whether it did", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });
    await expect(requeueOutboxEvent("e1", false)).resolves.toBe(true);
    expect(rpc).toHaveBeenLastCalledWith("advisor_requeue_outbox_event", { event_id: "e1", rebuild_payload: false });
    rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(requeueOutboxEvent("e1", true)).resolves.toBe(false);
    expect(rpc).toHaveBeenLastCalledWith("advisor_requeue_outbox_event", { event_id: "e1", rebuild_payload: true });
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(requeueOutboxEvent("e1", false)).resolves.toBe(false);
  });

  // The database answers a non-advisor with 42501, which PostgREST sends as HTTP 403.
  it.each([
    ["listing", () => listOutboxEvents(null)],
    ["counting", () => outboxSummary()],
    ["retrying", () => requeueOutboxEvent("e1", false)],
  ])("calls the database's refusal of a non-advisor %s a lack of advisor access", async (_what, run) => {
    failWith({ code: "42501", message: "Advisor access required" });
    const err = await caught(run);
    expect(err).toBeInstanceOf(AdvisorApiError);
    expect(err.forbidden).toBe(true);
    expect(err.message).toBe("You don't have advisor access.");
  });

  it("says the session ended, for a lapsed token, so the page can send the advisor to sign in", async () => {
    failWith({ code: "PGRST301", message: "JWT expired" });
    expect((await caught(() => requeueOutboxEvent("e1", false))).unauthenticated).toBe(true);
  });

  it("falls back to a specific message when a failure has none", async () => {
    failWith({ message: "" });
    expect((await caught(() => listOutboxEvents(null))).message).toBe("Couldn't load the outbox.");
    expect((await caught(() => outboxSummary())).message).toBe("Couldn't load the outbox counts.");
    expect((await caught(() => requeueOutboxEvent("e1", false))).message).toBe("Couldn't retry this notification.");
  });
});
