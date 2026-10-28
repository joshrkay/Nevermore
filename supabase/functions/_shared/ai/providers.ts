import type { ExtractionTool, ProviderAdapter } from "./model.ts";

const asObject = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("expected an object");
  return value as Record<string, unknown>;
};

interface AdapterOptions {
  apiKey: string;
  model: string;
  /** The tool the model is forced to call; each function brings its own. */
  tool: ExtractionTool;
}

/** The Lovable AI gateway (OpenAI-style chat completions), which is how the functions worked originally. */
export function createLovableAdapter(opts: AdapterOptions): ProviderAdapter {
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
        tools: [{ type: "function", function: opts.tool }],
        tool_choice: { type: "function", function: { name: opts.tool.name } },
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

const DEFAULT_MAX_TOKENS = 1024;

/** Anthropic's Messages API, forcing the extraction tool. `maxTokens` caps the reply, and a tool whose result is long needs more than the default. */
export function createAnthropicAdapter(opts: AdapterOptions & { maxTokens?: number }): ProviderAdapter {
  return {
    name: "anthropic",
    buildRequest: ({ system, user }) => ({
      url: "https://api.anthropic.com/v1/messages",
      headers: { "x-api-key": opts.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: {
        model: opts.model,
        max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
        system,
        messages: [{ role: "user", content: user }],
        tools: [{ name: opts.tool.name, description: opts.tool.description, input_schema: opts.tool.parameters }],
        tool_choice: { type: "tool", name: opts.tool.name },
      },
    }),
    parseResponse: (json) => {
      const blocks = (json as { content?: { type?: string; name?: string; input?: unknown }[] }).content ?? [];
      const toolUse = blocks.find((b) => b.type === "tool_use" && b.name === opts.tool.name);
      if (!toolUse) return null;
      return asObject(toolUse.input);
    },
  };
}

const DEFAULT_MODELS = { lovable: "google/gemini-3-flash-preview", anthropic: "claude-haiku-5-5" } as const;

export type AdapterChoice = { ok: true; adapter: ProviderAdapter } | { ok: false; problem: string };

/**
 * Picks the provider from function secrets, shared by every function that calls the model.
 * Defaults to the existing gateway so nothing changes until the owner sets AI_PROVIDER, e.g. after
 * signing the provider's data-processing terms.
 */
export function selectAdapter(
  env: (name: string) => string | undefined,
  tool: ExtractionTool,
  options: { maxTokens?: number } = {},
): AdapterChoice {
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
    adapter: provider === "anthropic"
      ? createAnthropicAdapter({ apiKey, model, tool, maxTokens: options.maxTokens })
      : createLovableAdapter({ apiKey, model, tool }),
  };
}
