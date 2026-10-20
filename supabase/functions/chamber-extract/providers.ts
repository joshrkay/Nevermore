import type { ProviderAdapter } from "./model.ts";
import { EXTRACT_TOOL } from "./schema.ts";

const asObject = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("expected an object");
  return value as Record<string, unknown>;
};

/** The Lovable AI gateway (OpenAI-style chat completions), which is how the function worked originally. */
export function createLovableAdapter(opts: { apiKey: string; model: string }): ProviderAdapter {
  return {
    name: "lovable",
    buildRequest: ({ system, user }) => ({
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
      body: {
        model: opts.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        tools: [{ type: "function", function: EXTRACT_TOOL }],
        tool_choice: { type: "function", function: { name: EXTRACT_TOOL.name } },
      },
    }),
    parseResponse: (json) => {
      const choices = (json as { choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[] }).choices;
      const args = choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (args === undefined) return null;
      return asObject(JSON.parse(args));
    },
  };
}

/** Anthropic's Messages API, forcing the extraction tool. */
export function createAnthropicAdapter(opts: { apiKey: string; model: string }): ProviderAdapter {
  return {
    name: "anthropic",
    buildRequest: ({ system, user }) => ({
      url: "https://api.anthropic.com/v1/messages",
      headers: { "x-api-key": opts.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: {
        model: opts.model,
        max_tokens: 1024,
        system,
        messages: [{ role: "user", content: user }],
        tools: [{ name: EXTRACT_TOOL.name, description: EXTRACT_TOOL.description, input_schema: EXTRACT_TOOL.parameters }],
        tool_choice: { type: "tool", name: EXTRACT_TOOL.name },
      },
    }),
    parseResponse: (json) => {
      const blocks = (json as { content?: { type?: string; name?: string; input?: unknown }[] }).content ?? [];
      const toolUse = blocks.find((b) => b.type === "tool_use" && b.name === EXTRACT_TOOL.name);
      if (!toolUse) return null;
      return asObject(toolUse.input);
    },
  };
}

const DEFAULT_MODELS = { lovable: "google/gemini-3-flash-preview", anthropic: "claude-haiku-5-5" } as const;

export type AdapterChoice = { ok: true; adapter: ProviderAdapter } | { ok: false; problem: string };

/**
 * Picks the provider from function secrets. Defaults to the existing gateway so nothing changes
 * until the owner sets AI_PROVIDER, e.g. after signing the provider's data-processing terms.
 */
export function selectAdapter(env: (name: string) => string | undefined): AdapterChoice {
  const provider = env("AI_PROVIDER") || "lovable";
  if (provider !== "lovable" && provider !== "anthropic") {
    return { ok: false, problem: `AI_PROVIDER "${provider}" is not supported` };
  }
  const keyName = provider === "anthropic" ? "ANTHROPIC_API_KEY" : "LOVABLE_API_KEY";
  const apiKey = env(keyName);
  if (!apiKey) return { ok: false, problem: `${keyName} is not set` };
  const model = env("AI_MODEL") || DEFAULT_MODELS[provider];
  return {
    ok: true,
    adapter: provider === "anthropic" ? createAnthropicAdapter({ apiKey, model }) : createLovableAdapter({ apiKey, model }),
  };
}
