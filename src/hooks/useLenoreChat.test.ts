import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } } }));

const { useLenoreChat } = await import("./useLenoreChat");

const httpError = (status: number) => new FunctionsHttpError(new Response("{}", { status }));

const setup = () => {
  const addUserMessage = vi.fn();
  const addLenoreMessage = vi.fn();
  const setChamberData = vi.fn();
  const onOrbStateChange = vi.fn();
  const data = { ...EMPTY_CHAMBER_DATA, company_name: "Acme", employees: [{ first_name: "Ada", last_name: "L", dob: "1990-01-01", state: "TX", title: "Eng", salary: 1, classification: "W2" as const, dependents: [] }] };
  const hook = renderHook(() =>
    useLenoreChat({ chamberData: data, setChamberData, addUserMessage, addLenoreMessage, onOrbStateChange }),
  );
  return { ...hook, addUserMessage, addLenoreMessage, setChamberData, onOrbStateChange };
};

describe("useLenoreChat", () => {
  beforeEach(() => invoke.mockReset());

  it("records the prospect's message, merges what Lenore extracted, and shows her reply", async () => {
    invoke.mockResolvedValue({ data: { extracted: { employee_count: 12 }, reply: "Twelve — lovely." }, error: null });
    const { result, addUserMessage, addLenoreMessage, setChamberData } = setup();
    await act(async () => { await result.current.send("We have 12 staff"); });

    expect(addUserMessage).toHaveBeenCalledWith("We have 12 staff");
    expect(addLenoreMessage).toHaveBeenCalledWith("Twelve — lovely.");
    expect(setChamberData).toHaveBeenCalledTimes(1);
    const merged = (setChamberData.mock.calls[0][0] as (prev: typeof EMPTY_CHAMBER_DATA) => typeof EMPTY_CHAMBER_DATA)(EMPTY_CHAMBER_DATA);
    expect(merged.employee_count).toBe(12);
    expect(result.current.failure).toBeNull();
  });

  it("keeps the roster out of what it sends to the model", async () => {
    invoke.mockResolvedValue({ data: { extracted: {}, reply: "ok" }, error: null });
    const { result } = setup();
    await act(async () => { await result.current.send("hello"); });
    const body = invoke.mock.calls[0][1].body;
    expect(body.message).toBe("hello");
    expect(body.context.company_name).toBe("Acme");
    expect(body.context).not.toHaveProperty("employees");
  });

  it("says it couldn't respond, instead of pretending it understood, and keeps the message", async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(502) });
    const { result, addUserMessage, addLenoreMessage, onOrbStateChange } = setup();
    await act(async () => { await result.current.send("We have 12 staff"); });

    expect(addUserMessage).toHaveBeenCalledTimes(1);
    expect(addLenoreMessage).not.toHaveBeenCalled();
    expect(result.current.failure).toEqual({ text: "We have 12 staff", kind: "failed" });
    expect(onOrbStateChange).toHaveBeenLastCalledWith("idle");
  });

  it("distinguishes being rate limited from other failures", async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(429) });
    const { result } = setup();
    await act(async () => { await result.current.send("a"); });
    expect(result.current.failure?.kind).toBe("rate_limited");
  });

  it("treats a thrown error (say, the network dropping) the same way as a returned one", async () => {
    invoke.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { result, addLenoreMessage } = setup();
    await act(async () => { await result.current.send("a"); });
    expect(result.current.failure).toEqual({ text: "a", kind: "failed" });
    expect(addLenoreMessage).not.toHaveBeenCalled();
  });

  it("retries the same message without adding it to the conversation again", async () => {
    invoke.mockRejectedValueOnce(httpError(504)).mockResolvedValueOnce({ data: { extracted: {}, reply: "Back now." }, error: null });
    const { result, addUserMessage, addLenoreMessage } = setup();
    await act(async () => { await result.current.send("We have 12 staff"); });
    await act(async () => { await result.current.retry(); });

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke.mock.calls[1][1].body.message).toBe("We have 12 staff");
    expect(addUserMessage).toHaveBeenCalledTimes(1);
    expect(addLenoreMessage).toHaveBeenCalledWith("Back now.");
    expect(result.current.failure).toBeNull();
  });

  it("keeps the failure up if the retry fails too", async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(502) });
    const { result } = setup();
    await act(async () => { await result.current.send("x"); });
    await act(async () => { await result.current.retry(); });
    expect(result.current.failure).toEqual({ text: "x", kind: "failed" });
  });

  it("lets the prospect carry on by hand, clearing the notice", async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(502) });
    const { result } = setup();
    await act(async () => { await result.current.send("x"); });
    act(() => result.current.dismissFailure());
    expect(result.current.failure).toBeNull();
  });

  it("clears an old failure when the prospect sends something new", async () => {
    invoke.mockRejectedValueOnce(httpError(502)).mockResolvedValueOnce({ data: { extracted: {}, reply: "ok" }, error: null });
    const { result } = setup();
    await act(async () => { await result.current.send("first"); });
    await act(async () => { await result.current.send("second"); });
    expect(result.current.failure).toBeNull();
  });

  it("reports when a request is in flight", async () => {
    let finish!: (v: unknown) => void;
    invoke.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { result } = setup();
    act(() => { void result.current.send("hello"); });
    await waitFor(() => expect(result.current.pending).toBe(true));
    await act(async () => { finish({ data: { extracted: {}, reply: "hi" }, error: null }); });
    await waitFor(() => expect(result.current.pending).toBe(false));
  });

  it("hands extracted values to onExtracted with the message they came from, and on retry too", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: httpError(502) });
    invoke.mockResolvedValueOnce({ data: { extracted: { employee_count: 12 }, reply: "ok" }, error: null });
    const onExtracted = vi.fn();
    const addUserMessage = vi.fn(() => ({ id: "m1", text: "We have 12 staff" }));
    const setChamberData = vi.fn();
    const { result } = renderHook(() =>
      useLenoreChat({ chamberData: EMPTY_CHAMBER_DATA, setChamberData, addUserMessage, addLenoreMessage: vi.fn(), onOrbStateChange: vi.fn(), onExtracted }),
    );
    await act(async () => { await result.current.send("We have 12 staff"); });
    await act(async () => { await result.current.retry(); });
    expect(onExtracted).toHaveBeenCalledWith({ employee_count: 12 }, expect.anything(), { id: "m1", text: "We have 12 staff" });
    expect(setChamberData).not.toHaveBeenCalled();
  });
});
