import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

const { AdvisorApiError, fetchIsAdvisor, listSubmissions } = await import("./advisorApi");

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
