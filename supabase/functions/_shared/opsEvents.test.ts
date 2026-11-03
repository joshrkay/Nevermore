import { describe, expect, it, vi } from "vitest";
import { aiFailureCode, recordOpsEvent, type OpsRpcClient } from "./opsEvents";

const client = (answer: () => Promise<{ data: unknown; error: unknown }>) => {
  const rpc = vi.fn((_fn: string, _args: Record<string, unknown>) => answer());
  return { rpc } satisfies OpsRpcClient;
};

describe("aiFailureCode", () => {
  it("is the failure kind and HTTP status, or - without one", () => {
    expect(aiFailureCode({ kind: "provider_error", httpStatus: 503 })).toBe("provider_error:503");
    expect(aiFailureCode({ kind: "timeout", httpStatus: null })).toBe("timeout:-");
  });
});

describe("recordOpsEvent", () => {
  it("calls record_ops_event with the named fields and no detail", async () => {
    const c = client(async () => ({ data: null, error: null }));
    expect(await recordOpsEvent(c, { kind: "ai_failed", source: "chamber-extract", code: "timeout:-", userId: "u1" })).toBe(true);
    expect(c.rpc).toHaveBeenCalledWith("record_ops_event", {
      p_kind: "ai_failed",
      p_source: "chamber-extract",
      p_code: "timeout:-",
      p_detail: null,
      p_user_id: "u1",
      p_session_id: null,
    });
  });

  it("does nothing without a client", async () => {
    expect(await recordOpsEvent(null, { kind: "ai_failed", source: "x", code: null })).toBe(false);
  });

  it("reports a refused call by its code only, and never throws", async () => {
    const logs: string[] = [];
    const refused = client(async () => ({ data: null, error: { code: "42501", message: "permission denied for bob@example.com" } }));
    expect(await recordOpsEvent(refused, { kind: "ai_failed", source: "x", code: null }, { log: (l) => logs.push(l) })).toBe(false);
    const thrown = client(async () => { throw new Error("network down"); });
    expect(await recordOpsEvent(thrown, { kind: "ai_failed", source: "x", code: null }, { log: (l) => logs.push(l) })).toBe(false);
    expect(logs).toEqual([
      "OPS_EVENT_NOT_RECORDED kind=ai_failed source=x reason=rpc:42501",
      "OPS_EVENT_NOT_RECORDED kind=ai_failed source=x reason=unexpected",
    ]);
  });

  it("gives up after its timeout instead of holding up the function", async () => {
    const logs: string[] = [];
    const hung = client(() => new Promise(() => {}));
    const started = Date.now();
    expect(await recordOpsEvent(hung, { kind: "ai_failed", source: "x", code: null }, { timeoutMs: 20, log: (l) => logs.push(l) })).toBe(false);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(logs).toEqual(["OPS_EVENT_NOT_RECORDED kind=ai_failed source=x reason=timeout"]);
  });
});
