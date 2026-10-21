import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } } }));

const { dispatchOutbox } = await import("./dispatchOutbox");

// Lets the promise callbacks inside dispatchOutbox run.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("dispatchOutbox", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  beforeEach(() => {
    invoke.mockReset();
    warn.mockClear();
  });

  it("asks the dispatch-outbox function to run", async () => {
    invoke.mockResolvedValue({ data: {}, error: null });
    dispatchOutbox();
    await flush();
    expect(invoke).toHaveBeenCalledWith("dispatch-outbox");
    expect(warn).not.toHaveBeenCalled();
  });

  it("only logs when the function reports an error", async () => {
    invoke.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    expect(() => dispatchOutbox()).not.toThrow();
    await flush();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("only logs when the call itself fails", async () => {
    invoke.mockRejectedValue(new Error("offline"));
    expect(() => dispatchOutbox()).not.toThrow();
    await flush();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
