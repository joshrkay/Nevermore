// The AI provider the functions call (chamber-extract, document-extract): Anthropic's Messages API, forcing each
// function's extraction tool. Anthropic is the only provider (decision D11); the Lovable AI gateway adapter was removed.
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

const DEFAULT_MAX_TOKENS = 1024;

/**
 * Anthropic's Messages API, forcing the extraction tool. `maxTokens` caps the reply, and a tool whose result is long needs
 * more than the default. A reply cut off at the cap is malformed: its tool input may be partial, so none of it is kept.
 */
export function createAnthropicAdapter(opts: AdapterOptions & { maxTokens?: number }): ProviderAdapter {
  return {
    name: "anthropic",
    model: opts.model,
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
      const reply = json as { stop_reason?: string; content?: { type?: string; name?: string; input?: unknown }[] };
      if (reply.stop_reason === "max_tokens") throw new Error("reply cut off at max_tokens");
      const blocks = reply.content ?? [];
      const toolUse = blocks.find((b) => b.type === "tool_use" && b.name === opts.tool.name);
      if (!toolUse) return null;
      return asObject(toolUse.input);
    },
  };
}

/** The model used unless AI_MODEL names another. */
export const DEFAULT_MODEL = "claude-haiku-5-5";

export type AdapterChoice = { ok: true; adapter: ProviderAdapter } | { ok: false; problem: string };

/**
 * The provider every function that calls the model uses: Anthropic, the only one (decision D11, 2026-11-05; the Lovable
 * AI gateway adapter was removed). AI_PROVIDER may be left unset or say "anthropic"; anything else is a mistake in the
 * secrets, reported rather than guessed at. AI_MODEL overrides the model.
 */
export function selectAdapter(
  env: (name: string) => string | undefined,
  tool: ExtractionTool,
  options: { maxTokens?: number } = {},
): AdapterChoice {
  const provider = env("AI_PROVIDER");
  if (provider && provider !== "anthropic") {
    return { ok: false, problem: `AI_PROVIDER "${provider}" is not supported: Anthropic is the only AI provider (D11)` };
  }
  const apiKey = env("ANTHROPIC_API_KEY");
  if (!apiKey) return { ok: false, problem: "ANTHROPIC_API_KEY is not set" };
  const model = env("AI_MODEL") || DEFAULT_MODEL;
  return { ok: true, adapter: createAnthropicAdapter({ apiKey, model, tool, maxTokens: options.maxTokens }) };
}
