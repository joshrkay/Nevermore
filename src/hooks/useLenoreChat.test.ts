import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } } }));

const { CHAT_TIMEOUT_MS, useLenoreChat } = await import("./useLenoreChat");

const httpError = (status: number, body: Record<string, unknown> = {}) =>
  new FunctionsHttpError(new Response(JSON.stringify(body), { status, headers: { "X-Request-Id": "req-from-header" } }));

const setup = (intakeId?: string | null) => {
  const addUserMessage = vi.fn((text: string) => ({ id: "m1", text }));
  const addLenoreMessage = vi.fn();
  const onExtracted = vi.fn();
  const onOrbStateChange = vi.fn();
  const data = { ...EMPTY_CHAMBER_DATA, company_name: "Acme", census: [{ id: "e1", first_name: "Ada", last_name: "L", dob: "1990-01-01", work_state: "TX", job_title: "Eng", annual_salary: 1, compensation_type: "salary" as const, employment_type: "full_time" as const, classification: "w2" as const }] };
  const hook = renderHook(() =>
    useLenoreChat({ intakeId, chamberData: data, addUserMessage, addLenoreMessage, onOrbStateChange, onExtracted }),
  );
  return { ...hook, addUserMessage, addLenoreMessage, onExtracted, onOrbStateChange };
};

describe("useLenoreChat", () => {
  beforeEach(() => { invoke.mockReset(); });

  it("records the prospect's message, hands what Lenore extracted to onExtracted with it, and shows her reply", async () => {
    const response = { extracted: { employee_count: 12 }, field_status: { employee_count: "confirmed" }, reply: "Twelve — lovely." };
    invoke.mockResolvedValue({ data: response, error: null });
    const { result, addUserMessage, addLenoreMessage, onExtracted } = setup();
    await act(async () => { await result.current.send("We have 12 staff"); });

    expect(addUserMessage).toHaveBeenCalledWith("We have 12 staff");
    expect(addLenoreMessage).toHaveBeenCalledWith("Twelve — lovely.");
    expect(onExtracted).toHaveBeenCalledTimes(1);
    expect(onExtracted).toHaveBeenCalledWith({ employee_count: 12 }, response, { id: "m1", text: "We have 12 staff" });
    expect(result.current.failure).toBeNull();
  });

  it("hands nothing on when Lenore extracted nothing", async () => {
    invoke.mockResolvedValue({ data: { reply: "Tell me more." }, error: null });
    const { result, addLenoreMessage, onExtracted } = setup();
    await act(async () => { await result.current.send("hello"); });
    expect(onExtracted).not.toHaveBeenCalled();
    expect(addLenoreMessage).toHaveBeenCalledWith("Tell me more.");
  });

  it("removes a Social Security number before the message is kept or sent", async () => {
    invoke.mockResolvedValue({ data: { extracted: {}, reply: "ok" }, error: null });
    const { result, addUserMessage } = setup();
    await act(async () => { await result.current.send("My SSN is 123-45-6789"); });
    expect(addUserMessage).toHaveBeenCalledWith("My SSN is [redacted]");
    expect(invoke.mock.calls[0][1].body.message).toBe("My SSN is [redacted]");
  });

  it("keeps the roster out of what it sends to the model", async () => {
    invoke.mockResolvedValue({ data: { extracted: {}, reply: "ok" }, error: null });
    const { result } = setup();
    await act(async () => { await result.current.send("hello"); });
    const body = invoke.mock.calls[0][1].body;
    expect(body.message).toBe("hello");
    expect(body.context.company_name).toBe("Acme");
    expect(body.context).not.toHaveProperty("census");
  });

  it("names the intake the message belongs to, so the function can check it and record it", async () => {
    invoke.mockResolvedValue({ data: { extracted: {}, reply: "ok" }, error: null });
    const withIntake = setup("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    await act(async () => { await withIntake.result.current.send("hello"); });
    expect(invoke.mock.calls[0][1].body.session_id).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(invoke.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    const without = setup(null);
    await act(async () => { await without.result.current.send("hello"); });
    expect(invoke.mock.calls[1][1].body).not.toHaveProperty("session_id");
  });

  it.each([
    [429, "rate_limited", "rate_limited"],
    [503, "daily_cap", "daily_cap"],
    [504, "timeout", "timeout"],
    [503, "unavailable", "unavailable"],
    [502, "provider_error", "unavailable"],
    [502, "invalid_response", "failed"],
    [500, "internal", "failed"],
  ] as const)("tells a %i %s apart from other failures, as %s, and keeps the request id", async (status, code, kind) => {
    invoke.mockResolvedValue({ data: null, error: httpError(status, { error: "x", code, request_id: "req-1" }) });
    const { result } = setup();
    await act(async () => { await result.current.send("hi"); });
    expect(result.current.failure).toEqual({ text: "hi", kind, requestId: "req-1" });
  });

  it("falls back to the response header for the request id", async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(502, { code: "provider_error" }) });
    const { result } = setup();
    await act(async () => { await result.current.send("hi"); });
    expect(result.current.failure?.requestId).toBe("req-from-header");
  });

  it("calls a request that couldn't reach Lenore at all unavailable", async () => {
    invoke.mockResolvedValue({ data: null, error: new FunctionsFetchError(new TypeError("Failed to fetch")) });
    const { result } = setup();
    await act(async () => { await result.current.send("hi"); });
    expect(result.current.failure).toEqual({ text: "hi", kind: "unavailable" });
  });

  it(`gives up after ${CHAT_TIMEOUT_MS / 1000} seconds with no answer, keeps the message and offers to try again`, async () => {
    vi.useFakeTimers();
    try {
      // A request that only ends when the browser aborts it, as supabase-js reports an aborted fetch.
      invoke.mockImplementation((_name: string, opts: { signal: AbortSignal }) =>
        new Promise((resolve) => opts.signal.addEventListener("abort", () => resolve({ data: null, error: new FunctionsFetchError(new Error("aborted")) }))));
      const { result, onOrbStateChange } = setup();
      let sent!: Promise<void>;
      act(() => { sent = result.current.send("are you there?"); });
      expect(result.current.pending).toBe(true);
      await act(async () => { await vi.advanceTimersByTimeAsync(CHAT_TIMEOUT_MS - 1); });
      expect(result.current.failure).toBeNull();
      await act(async () => { await vi.advanceTimersByTimeAsync(1); await sent; });
      expect(result.current.failure).toEqual({ text: "are you there?", kind: "timeout" });
      expect(result.current.pending).toBe(false);
      expect(onOrbStateChange).toHaveBeenLastCalledWith("idle");
    } finally {
      vi.useRealTimers();
    }
  });

  it("says it couldn't respond, instead of pretending it understood, and keeps the message", async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(502) });
    const { result, addUserMessage, addLenoreMessage, onOrbStateChange } = setup();
    await act(async () => { await result.current.send("We have 12 staff"); });

    expect(addUserMessage).toHaveBeenCalledTimes(1);
    expect(addLenoreMessage).not.toHaveBeenCalled();
    expect(result.current.failure).toMatchObject({ text: "We have 12 staff", kind: "failed" });
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
    expect(result.current.failure).toMatchObject({ text: "x", kind: "failed" });
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
    const { result } = renderHook(() =>
      useLenoreChat({ chamberData: EMPTY_CHAMBER_DATA, addUserMessage, addLenoreMessage: vi.fn(), onOrbStateChange: vi.fn(), onExtracted }),
    );
    await act(async () => { await result.current.send("We have 12 staff"); });
    await act(async () => { await result.current.retry(); });
    expect(addUserMessage).toHaveBeenCalledTimes(1);
    expect(onExtracted).toHaveBeenCalledTimes(1);
    expect(onExtracted).toHaveBeenCalledWith({ employee_count: 12 }, expect.anything(), { id: "m1", text: "We have 12 staff" });
  });

  it("cites the message each answer belongs to when sends overlap", async () => {
    const resolvers: ((v: unknown) => void)[] = [];
    invoke.mockImplementation(() => new Promise((r) => resolvers.push(r)));
    const onExtracted = vi.fn();
    let n = 0;
    const addUserMessage = vi.fn((text: string) => ({ id: `m${++n}`, text }));
    const { result } = renderHook(() =>
      useLenoreChat({ chamberData: EMPTY_CHAMBER_DATA, addUserMessage, addLenoreMessage: vi.fn(), onOrbStateChange: vi.fn(), onExtracted }),
    );
    let first!: Promise<void>, second!: Promise<void>;
    act(() => { first = result.current.send("We have 12 staff"); });
    act(() => { second = result.current.send("We have 12 staff"); }); // same text, sent again before the first answer
    await act(async () => {
      resolvers[0]({ data: { extracted: { employee_count: 12 }, reply: "a" }, error: null });
      resolvers[1]({ data: { extracted: { employee_count: 13 }, reply: "b" }, error: null });
      await Promise.all([first, second]);
    });
    expect(onExtracted).toHaveBeenCalledWith({ employee_count: 12 }, expect.anything(), { id: "m1", text: "We have 12 staff" });
    expect(onExtracted).toHaveBeenCalledWith({ employee_count: 13 }, expect.anything(), { id: "m2", text: "We have 12 staff" });
  });
});

// "Start over" (or another person signing in) replaces the conversation while Lenore may still be answering.
describe("useLenoreChat when the conversation is replaced", () => {
  beforeEach(() => { invoke.mockReset(); });

  const mount = () => {
    const addLenoreMessage = vi.fn();
    const onExtracted = vi.fn();
    const hook = renderHook(({ epoch }) =>
      useLenoreChat({
        epoch, chamberData: EMPTY_CHAMBER_DATA, addLenoreMessage, onOrbStateChange: vi.fn(), onExtracted,
        addUserMessage: (text) => ({ id: "m1", text }),
      }), { initialProps: { epoch: 0 } });
    return { ...hook, addLenoreMessage, onExtracted };
  };

  it("drops an answer that arrives after the conversation was replaced", async () => {
    let answer!: (value: unknown) => void;
    invoke.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
    const { result, rerender, addLenoreMessage, onExtracted } = mount();
    let sending!: Promise<void>;
    act(() => { sending = result.current.send("We're Acme, 12 people"); });
    rerender({ epoch: 1 });
    await act(async () => {
      answer({ data: { extracted: { company_name: "Acme", employee_count: 12 }, reply: "Twelve, then." }, error: null });
      await sending;
    });
    expect(addLenoreMessage).not.toHaveBeenCalled();
    expect(onExtracted).not.toHaveBeenCalled();
    expect(result.current.pending).toBe(false);
    expect(result.current.failure).toBeNull();
  });

  it("doesn't offer to resend a message from the old conversation", async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(500) });
    const { result, rerender } = mount();
    await act(async () => { await result.current.send("We're Acme"); });
    expect(result.current.failure).not.toBeNull();
    rerender({ epoch: 1 });
    expect(result.current.failure).toBeNull();
  });

  it("doesn't report a failure that arrives after the conversation was replaced", async () => {
    // The call itself fails (a network error), rather than answering with an error.
    let fail!: (reason: unknown) => void;
    invoke.mockReturnValue(new Promise((_, reject) => { fail = reject; }));
    const { result, rerender } = mount();
    let sending!: Promise<void>;
    act(() => { sending = result.current.send("We're Acme"); });
    rerender({ epoch: 1 });
    await act(async () => { fail(new TypeError("Failed to fetch")); await sending; });
    expect(result.current.failure).toBeNull();
  });

  it("still answers when the conversation stays the same", async () => {
    invoke.mockResolvedValue({ data: { reply: "Noted." }, error: null });
    const { result, rerender, addLenoreMessage } = mount();
    rerender({ epoch: 0 });
    await act(async () => { await result.current.send("Hi"); });
    expect(addLenoreMessage).toHaveBeenCalledWith("Noted.");
  });
});
