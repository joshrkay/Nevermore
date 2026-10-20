import { describe, expect, it } from "vitest";
import { EXTRACT_TOOL } from "./schema";
import { createAnthropicAdapter, createLovableAdapter, selectAdapter } from "./providers";

const request = { system: "SYSTEM PROMPT", user: "USER MESSAGE" };

describe("lovable adapter", () => {
  const adapter = createLovableAdapter({ apiKey: "lov-key", model: "google/test-model" });

  it("builds an OpenAI-style chat request that forces the extraction tool", () => {
    const { url, headers, body } = adapter.buildRequest(request);
    expect(url).toBe("https://ai.gateway.lovable.dev/v1/chat/completions");
    expect(headers.Authorization).toBe("Bearer lov-key");
    expect(body).toMatchObject({
      model: "google/test-model",
      messages: [{ role: "system", content: "SYSTEM PROMPT" }, { role: "user", content: "USER MESSAGE" }],
      tool_choice: { type: "function", function: { name: "extract_chamber_data" } },
    });
    expect((body as { tools: { function: { parameters: unknown } }[] }).tools[0].function.parameters).toEqual(EXTRACT_TOOL.parameters);
  });

  it("reads the tool call's arguments", () => {
    const json = { choices: [{ message: { tool_calls: [{ function: { arguments: '{"company_name":"Acme","reply":"Hi"}' } }] } }] };
    expect(adapter.parseResponse(json)).toEqual({ company_name: "Acme", reply: "Hi" });
  });

  it("returns null when the model made no tool call", () => {
    expect(adapter.parseResponse({ choices: [{ message: { content: "hello" } }] })).toBeNull();
    expect(adapter.parseResponse({ choices: [] })).toBeNull();
  });

  it("rejects arguments that aren't a JSON object", () => {
    const wrap = (args: string) => ({ choices: [{ message: { tool_calls: [{ function: { arguments: args } }] } }] });
    expect(() => adapter.parseResponse(wrap("not json"))).toThrow();
    expect(() => adapter.parseResponse(wrap("[1,2]"))).toThrow();
  });
});

describe("anthropic adapter", () => {
  const adapter = createAnthropicAdapter({ apiKey: "ant-key", model: "claude-test" });

  it("builds a Messages API request that forces the extraction tool", () => {
    const { url, headers, body } = adapter.buildRequest(request);
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(headers).toMatchObject({ "x-api-key": "ant-key", "anthropic-version": "2023-06-01", "content-type": "application/json" });
    expect(body).toMatchObject({
      model: "claude-test",
      system: "SYSTEM PROMPT",
      messages: [{ role: "user", content: "USER MESSAGE" }],
      tool_choice: { type: "tool", name: "extract_chamber_data" },
    });
    const sent = body as { max_tokens: number; tools: { name: string; input_schema: unknown }[] };
    expect(sent.max_tokens).toBeGreaterThan(0);
    expect(sent.tools[0]).toMatchObject({ name: "extract_chamber_data", input_schema: EXTRACT_TOOL.parameters });
  });

  it("reads the tool_use block's input", () => {
    const json = { content: [{ type: "text", text: "Sure." }, { type: "tool_use", name: "extract_chamber_data", input: { company_name: "Acme", reply: "Hi" } }] };
    expect(adapter.parseResponse(json)).toEqual({ company_name: "Acme", reply: "Hi" });
  });

  it("returns null when there is no tool_use block", () => {
    expect(adapter.parseResponse({ content: [{ type: "text", text: "hello" }] })).toBeNull();
    expect(adapter.parseResponse({ content: [] })).toBeNull();
  });

  it("rejects a tool_use whose input isn't an object", () => {
    expect(() => adapter.parseResponse({ content: [{ type: "tool_use", name: "extract_chamber_data", input: "oops" }] })).toThrow();
  });
});

describe("selectAdapter", () => {
  const env = (vars: Record<string, string>) => (name: string) => vars[name];

  it("keeps the current provider by default, so nothing changes until the owner opts in", () => {
    const result = selectAdapter(env({ LOVABLE_API_KEY: "k" }));
    expect(result).toMatchObject({ ok: true, adapter: { name: "lovable" } });
  });

  it("uses Anthropic when asked, with a sensible default model and an override", () => {
    const base = env({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k" });
    const chosen = selectAdapter(base);
    expect(chosen).toMatchObject({ ok: true, adapter: { name: "anthropic" } });
    if (chosen.ok) expect((chosen.adapter.buildRequest(request).body as { model: string }).model).toBe("claude-haiku-5-5");

    const overridden = selectAdapter(env({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k", AI_MODEL: "claude-other" }));
    if (overridden.ok) expect((overridden.adapter.buildRequest(request).body as { model: string }).model).toBe("claude-other");
  });

  it("names the missing secret instead of guessing", () => {
    expect(selectAdapter(env({}))).toEqual({ ok: false, problem: "LOVABLE_API_KEY is not set" });
    expect(selectAdapter(env({ AI_PROVIDER: "anthropic" }))).toEqual({ ok: false, problem: "ANTHROPIC_API_KEY is not set" });
  });

  it("refuses an unknown provider name", () => {
    expect(selectAdapter(env({ AI_PROVIDER: "mystery", LOVABLE_API_KEY: "k" }))).toEqual({ ok: false, problem: 'AI_PROVIDER "mystery" is not supported' });
  });
});
