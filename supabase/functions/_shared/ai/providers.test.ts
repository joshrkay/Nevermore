import { describe, expect, it } from "vitest";
import type { ExtractionTool } from "./model";
import { createAnthropicAdapter, createLovableAdapter, selectAdapter } from "./providers";

const request = { system: "SYSTEM PROMPT", user: "USER MESSAGE" };

// Each function brings its own tool; the adapters only need it to be forced and read back by name.
const tool: ExtractionTool = {
  name: "report_things",
  description: "Report the things",
  parameters: { type: "object", properties: { thing: { type: "string" } }, additionalProperties: false },
};
const otherTool: ExtractionTool = { ...tool, name: "report_other_things", description: "Report other things" };

describe("lovable adapter", () => {
  const adapter = createLovableAdapter({ apiKey: "lov-key", model: "google/test-model", tool });

  it("builds an OpenAI-style chat request that forces the tool it was given", () => {
    const { url, headers, body } = adapter.buildRequest(request);
    expect(url).toBe("https://ai.gateway.lovable.dev/v1/chat/completions");
    expect(headers.Authorization).toBe("Bearer lov-key");
    expect(body).toMatchObject({
      model: "google/test-model",
      messages: [{ role: "system", content: "SYSTEM PROMPT" }, { role: "user", content: "USER MESSAGE" }],
      tool_choice: { type: "function", function: { name: "report_things" } },
    });
    expect((body as { tools: { type: string; function: ExtractionTool }[] }).tools).toEqual([{ type: "function", function: tool }]);
  });

  it("forces a different tool when given a different one", () => {
    const { body } = createLovableAdapter({ apiKey: "k", model: "m", tool: otherTool }).buildRequest(request);
    expect(body).toMatchObject({ tool_choice: { function: { name: "report_other_things" } } });
  });

  it("reads the tool call's arguments", () => {
    const json = { choices: [{ message: { tool_calls: [{ function: { arguments: '{"thing":"Acme","reply":"Hi"}' } }] } }] };
    expect(adapter.parseResponse(json)).toEqual({ thing: "Acme", reply: "Hi" });
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
  const adapter = createAnthropicAdapter({ apiKey: "ant-key", model: "claude-test", tool });

  it("builds a Messages API request that forces the tool it was given", () => {
    const { url, headers, body } = adapter.buildRequest(request);
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(headers).toMatchObject({ "x-api-key": "ant-key", "anthropic-version": "2023-06-01", "content-type": "application/json" });
    expect(body).toMatchObject({
      model: "claude-test",
      system: "SYSTEM PROMPT",
      messages: [{ role: "user", content: "USER MESSAGE" }],
      tool_choice: { type: "tool", name: "report_things" },
    });
    const sent = body as { max_tokens: number; tools: { name: string; description: string; input_schema: unknown }[] };
    expect(sent.tools).toEqual([{ name: "report_things", description: "Report the things", input_schema: tool.parameters }]);
  });

  it("caps the reply at 1,024 tokens unless the caller asks for more", () => {
    expect((adapter.buildRequest(request).body as { max_tokens: number }).max_tokens).toBe(1024);
    const roomy = createAnthropicAdapter({ apiKey: "k", model: "m", tool, maxTokens: 4096 });
    expect((roomy.buildRequest(request).body as { max_tokens: number }).max_tokens).toBe(4096);
  });

  it("reads the tool_use block's input", () => {
    const json = { content: [{ type: "text", text: "Sure." }, { type: "tool_use", name: "report_things", input: { thing: "Acme", reply: "Hi" } }] };
    expect(adapter.parseResponse(json)).toEqual({ thing: "Acme", reply: "Hi" });
  });

  it("ignores a tool_use block for some other tool", () => {
    const json = { content: [{ type: "tool_use", name: "report_other_things", input: { thing: "Acme" } }] };
    expect(adapter.parseResponse(json)).toBeNull();
  });

  it("returns null when there is no tool_use block", () => {
    expect(adapter.parseResponse({ content: [{ type: "text", text: "hello" }] })).toBeNull();
    expect(adapter.parseResponse({ content: [] })).toBeNull();
  });

  it("rejects a tool_use whose input isn't an object", () => {
    expect(() => adapter.parseResponse({ content: [{ type: "tool_use", name: "report_things", input: "oops" }] })).toThrow();
  });
});

describe("selectAdapter", () => {
  const env = (vars: Record<string, string>) => (name: string) => vars[name];

  it("keeps the current provider by default, so nothing changes until the owner opts in", () => {
    const result = selectAdapter(env({ LOVABLE_API_KEY: "k" }), tool);
    expect(result).toMatchObject({ ok: true, adapter: { name: "lovable" } });
  });

  it("hands the tool to whichever adapter it picks", () => {
    for (const vars of [{ LOVABLE_API_KEY: "k" }, { AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k" }]) {
      const chosen = selectAdapter(env(vars), otherTool);
      if (!chosen.ok) throw new Error("expected an adapter");
      expect(JSON.stringify(chosen.adapter.buildRequest(request).body)).toContain("report_other_things");
    }
  });

  it("uses Anthropic when asked, with a sensible default model and an override", () => {
    const base = env({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k" });
    const chosen = selectAdapter(base, tool);
    expect(chosen).toMatchObject({ ok: true, adapter: { name: "anthropic" } });
    if (chosen.ok) expect((chosen.adapter.buildRequest(request).body as { model: string }).model).toBe("claude-haiku-5-5");

    const overridden = selectAdapter(env({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k", AI_MODEL: "claude-other" }), tool);
    if (overridden.ok) expect((overridden.adapter.buildRequest(request).body as { model: string }).model).toBe("claude-other");
  });

  it("passes a larger reply cap through to Anthropic and ignores it for the gateway", () => {
    const anthropic = selectAdapter(env({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k" }), tool, { maxTokens: 4096 });
    if (anthropic.ok) expect((anthropic.adapter.buildRequest(request).body as { max_tokens: number }).max_tokens).toBe(4096);
    const lovable = selectAdapter(env({ LOVABLE_API_KEY: "k" }), tool, { maxTokens: 4096 });
    if (lovable.ok) expect(lovable.adapter.buildRequest(request).body).not.toHaveProperty("max_tokens");
  });

  it("names the missing secret instead of guessing", () => {
    expect(selectAdapter(env({}), tool)).toEqual({ ok: false, problem: "LOVABLE_API_KEY is not set" });
    expect(selectAdapter(env({ AI_PROVIDER: "anthropic" }), tool)).toEqual({ ok: false, problem: "ANTHROPIC_API_KEY is not set" });
  });

  it("refuses an unknown provider name", () => {
    expect(selectAdapter(env({ AI_PROVIDER: "mystery", LOVABLE_API_KEY: "k" }), tool)).toEqual({ ok: false, problem: 'AI_PROVIDER "mystery" is not supported' });
  });
});
