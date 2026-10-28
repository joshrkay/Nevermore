// An in-process stand-in for the model provider. chamber-extract takes its `fetch` as a dependency,
// so the real handler talks to this instead of the internet, and an unexpected outbound call fails
// loudly rather than reaching a real provider.
import { FALLBACK_REPLY, INTAKE_EXTRACTION, INTAKE_MESSAGE } from "./intake-script.mjs";

// The two adapters in supabase/functions/_shared/ai/providers.ts, keyed by the URL each one posts to.
const ADAPTERS = {
  "https://ai.gateway.lovable.dev/v1/chat/completions": "lovable",
  "https://api.anthropic.com/v1/messages": "anthropic",
};

/** The handler ends the user prompt with JSON.stringify(message), after either of two fixed labels. */
const PROMPT_MESSAGE = /(?:New user message|User message): ("(?:[^"\\]|\\.)*")$/s;

export function messageFromPrompt(prompt) {
  const quoted = PROMPT_MESSAGE.exec(prompt)?.[1];
  return quoted === undefined ? null : JSON.parse(quoted);
}

/** What the model's forced tool call carries: the scripted extraction for the intake message, a plain reply otherwise. */
function toolArguments(message) {
  return message === INTAKE_MESSAGE ? structuredClone(INTAKE_EXTRACTION) : { reply: FALLBACK_REPLY };
}

const requestUrl = (input) => (typeof input === "string" ? input : input instanceof URL ? input.href : input.url);

/**
 * `calls` records each model call (adapter and the prospect's message, null if the prompt did not
 * match the expected shape). `refused` records the requests the fake turned away; the handler turns
 * the thrown error into a generic 502, so `log` is where the offending URL stays visible.
 */
export function createFakeAi({ log = () => {} } = {}) {
  const calls = [];
  const refused = [];

  async function fakeFetch(input, init = {}) {
    const url = requestUrl(input);
    const adapter = ADAPTERS[url];
    if (!adapter || (init.method ?? "GET") !== "POST") {
      const attempted = `${init.method ?? "GET"} ${url}`;
      refused.push(attempted);
      log(`FAKE_AI_REFUSED: unexpected outbound call ${attempted}`);
      throw new Error(`fake AI provider: refusing unexpected outbound call ${attempted}`);
    }

    const body = JSON.parse(init.body);
    // Both providers are forced to call one tool; answer with a call to that same tool.
    const toolName = adapter === "lovable" ? body.tool_choice.function.name : body.tool_choice.name;
    const prompt = body.messages.find((m) => m.role === "user").content;
    const message = messageFromPrompt(prompt);
    calls.push({ adapter, message });
    const args = toolArguments(message);

    if (adapter === "lovable") {
      // OpenAI-style: the arguments travel as a JSON string, not an object.
      return Response.json({
        id: "chatcmpl-e2e",
        object: "chat.completion",
        model: body.model,
        choices: [{
          index: 0,
          finish_reason: "tool_calls",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{ id: "call_e2e", type: "function", function: { name: toolName, arguments: JSON.stringify(args) } }],
          },
        }],
      });
    }
    return Response.json({
      id: "msg_e2e",
      type: "message",
      role: "assistant",
      model: body.model,
      stop_reason: "tool_use",
      content: [{ type: "tool_use", id: "toolu_e2e", name: toolName, input: args }],
      usage: { input_tokens: 1, output_tokens: 1 },
    });
  }

  return { fetch: fakeFetch, calls, refused };
}
