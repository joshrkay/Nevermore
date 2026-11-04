import { describe, expect, it } from "vitest";
import { eventRow, recordAiEvent, type AiEvent, type EventWriter } from "./events";

const base: AiEvent = {
  requestId: "11111111-1111-4111-8111-111111111111",
  functionName: "chamber-extract",
  userId: "22222222-2222-4222-8222-222222222222",
  sessionId: "33333333-3333-4333-8333-333333333333",
  httpStatus: 200,
  errorCode: null,
};

const writer = (result: { error: { code?: string } | null } | Error) => {
  const rows: Record<string, unknown>[] = [];
  const w: EventWriter = {
    from: (table) => ({
      insert: async (row) => {
        expect(table).toBe("ai_extraction_events");
        rows.push(row);
        if (result instanceof Error) throw result;
        return result;
      },
    }),
  };
  return { w, rows };
};

describe("eventRow", () => {
  it("records an ok call with its fields, refused paths, versions, provider and timing", () => {
    expect(eventRow({
      ...base,
      fields: ["company_name", "states"],
      refusedPaths: ["states[1]", "census[0].dependents[2].relationship"],
      promptVersion: 1,
      contractVersion: 2,
      provider: "lovable",
      model: "google/gemini-3-flash-preview",
      attempts: 1,
      latencyMs: 840.4,
    })).toEqual({
      request_id: base.requestId,
      function_name: "chamber-extract",
      user_id: base.userId,
      session_id: base.sessionId,
      document_id: null,
      outcome: "ok",
      error_code: null,
      http_status: 200,
      document_status: null,
      fields: ["company_name", "states"],
      refused_paths: ["states[1]", "census[0].dependents[2].relationship"],
      prompt_version: 1,
      contract_version: 2,
      provider: "lovable",
      model: "google/gemini-3-flash-preview",
      attempts: 1,
      latency_ms: 840,
    });
  });

  it("marks a call with a code as an error", () => {
    expect(eventRow({ ...base, httpStatus: 429, errorCode: "rate_limited" })).toMatchObject({ outcome: "error", error_code: "rate_limited", http_status: 429 });
  });

  it("drops anything that isn't a field name or a schema path, so no prospect words get in", () => {
    const row = eventRow({
      ...base,
      fields: ["company_name", "Acme Inc", "company_name: Acme", "x".repeat(121), "states", "states"],
      refusedPaths: ["states[1]", "states[1] = CA", "we have 40 people", "census[0].dob"],
    });
    expect(row.fields).toEqual(["company_name", "states"]);
    expect(row.refused_paths).toEqual(["states[1]", "census[0].dob"]);
  });

  it("caps the lists and the provider and model names to what the table holds", () => {
    const row = eventRow({
      ...base,
      fields: Array.from({ length: 150 }, (_, i) => `f${i}`),
      refusedPaths: Array.from({ length: 80 }, (_, i) => `states[${i}]`),
      provider: "p".repeat(60),
      model: "m".repeat(150),
    });
    expect((row.fields as string[]).length).toBe(100);
    expect((row.refused_paths as string[]).length).toBe(50);
    expect((row.provider as string).length).toBe(40);
    expect((row.model as string).length).toBe(100);
  });
});

describe("recordAiEvent", () => {
  it("writes one row", async () => {
    const { w, rows } = writer({ error: null });
    const logs: string[] = [];
    await recordAiEvent(w, base, (l) => logs.push(l));
    expect(rows).toHaveLength(1);
    expect(logs).toEqual([]);
  });

  it("never throws: a refused write or a thrown one is logged by request id and code only", async () => {
    const logs: string[] = [];
    await recordAiEvent(writer({ error: { code: "23514" } }).w, base, (l) => logs.push(l));
    await recordAiEvent(writer(new TypeError("fetch failed: secret detail")).w, base, (l) => logs.push(l));
    await recordAiEvent(null, base, (l) => logs.push(l));
    expect(logs).toEqual([
      `AI_EVENT_NOT_RECORDED request=${base.requestId} reason=23514`,
      `AI_EVENT_NOT_RECORDED request=${base.requestId} reason=TypeError`,
      `AI_EVENT_NOT_RECORDED request=${base.requestId} reason=no_service_role`,
    ]);
  });
});
