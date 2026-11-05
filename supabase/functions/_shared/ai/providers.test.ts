import { describe, expect, it } from "vitest";
import type { ExtractionTool } from "./model";
import { createAnthropicAdapter, DEFAULT_MODEL, selectAdapter } from "./providers";

const request = { system: "SYSTEM PROMPT", user: "USER MESSAGE" };

// Each function brings its own tool; the adapters only need it to be forced and read back by name.
const tool: ExtractionTool = {
  name: "report_things",
  description: "Report the things",
  parameters: { type: "object", properties: { thing: { type: "string" } }, additionalProperties: false },
};
const otherTool: ExtractionTool = { ...tool, name: "report_other_things", description: "Report other things" };

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

  // Reading what a cut-off reply holds would keep some answers and silently lose the rest.
  it("rejects a reply cut off at its token cap, even one with a tool_use block in it", () => {
    const toolUse = { type: "tool_use", name: "report_things", input: { thing: "Acme" } };
    expect(() => adapter.parseResponse({ stop_reason: "max_tokens", content: [toolUse] })).toThrow();
    expect(adapter.parseResponse({ stop_reason: "tool_use", content: [toolUse] })).toEqual({ thing: "Acme" });
  });
});

describe("selectAdapter", () => {
  const env = (vars: Record<string, string>) => (name: string) => vars[name];

  // Decision D11: Anthropic is the only provider.
  it("uses Anthropic, with AI_PROVIDER unset or set to anthropic", () => {
    for (const vars of [{ ANTHROPIC_API_KEY: "k" }, { AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k" }]) {
      expect(selectAdapter(env(vars), tool)).toMatchObject({ ok: true, adapter: { name: "anthropic" } });
    }
  });

  it("hands the tool to the adapter", () => {
    const chosen = selectAdapter(env({ ANTHROPIC_API_KEY: "k" }), otherTool);
    if (!chosen.ok) throw new Error("expected an adapter");
    expect(JSON.stringify(chosen.adapter.buildRequest(request).body)).toContain("report_other_things");
  });

  it("uses a sensible default model and an override", () => {
    const chosen = selectAdapter(env({ ANTHROPIC_API_KEY: "k" }), tool);
    if (chosen.ok) expect((chosen.adapter.buildRequest(request).body as { model: string }).model).toBe(DEFAULT_MODEL);
    expect(DEFAULT_MODEL).toBe("claude-haiku-5-5");
    const overridden = selectAdapter(env({ ANTHROPIC_API_KEY: "k", AI_MODEL: "claude-other" }), tool);
    if (overridden.ok) expect((overridden.adapter.buildRequest(request).body as { model: string }).model).toBe("claude-other");
  });

  it("passes a larger reply cap through", () => {
    const chosen = selectAdapter(env({ ANTHROPIC_API_KEY: "k" }), tool, { maxTokens: 4096 });
    if (chosen.ok) expect((chosen.adapter.buildRequest(request).body as { max_tokens: number }).max_tokens).toBe(4096);
  });

  it("names the missing secret instead of guessing, and a leftover Lovable key is no substitute", () => {
    expect(selectAdapter(env({}), tool)).toEqual({ ok: false, problem: "ANTHROPIC_API_KEY is not set" });
    expect(selectAdapter(env({ LOVABLE_API_KEY: "k" }), tool)).toEqual({ ok: false, problem: "ANTHROPIC_API_KEY is not set" });
  });

  it("refuses any other provider name, the old lovable included", () => {
    for (const provider of ["mystery", "lovable"]) {
      expect(selectAdapter(env({ AI_PROVIDER: provider, ANTHROPIC_API_KEY: "k" }), tool)).toEqual({
        ok: false,
        problem: `AI_PROVIDER "${provider}" is not supported: Anthropic is the only AI provider (D11)`,
      });
    }
  });
});
