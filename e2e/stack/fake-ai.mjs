// An in-process stand-in for the model provider. chamber-extract takes its `fetch` as a dependency,
// so the real handler talks to this instead of the internet, and an unexpected outbound call fails
// loudly rather than reaching a real provider.
import { FALLBACK_REPLY, INTAKE_EXTRACTION, INTAKE_MESSAGE } from "./intake-script.mjs";

// The one adapter in supabase/functions/_shared/ai/providers.ts (Anthropic, decision D11), by the URL it posts to.
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

/** The handler ends the user prompt with JSON.stringify(message), after either of two fixed labels. */
const PROMPT_MESSAGE = /(?:New user message|User message): ("(?:[^"\\]|\\.)*")$/s;

function messageFromPrompt(prompt) {
  const quoted = PROMPT_MESSAGE.exec(prompt)?.[1];
  return quoted === undefined ? null : JSON.parse(quoted);
}

/** What the model's forced tool call carries: the scripted extraction for the intake message, a plain reply otherwise. */
function toolArguments(message) {
  return message === INTAKE_MESSAGE ? structuredClone(INTAKE_EXTRACTION) : { reply: FALLBACK_REPLY };
}

const requestUrl = (input) => (typeof input === "string" ? input : input instanceof URL ? input.href : input.url);

/** The handler turns a refused call's thrown error into a generic 502, so `log` is where the offending URL stays visible. */
export function createFakeAi({ log = () => {} } = {}) {

  async function fakeFetch(input, init = {}) {
    const url = requestUrl(input);
    if (url !== ANTHROPIC_URL || (init.method ?? "GET") !== "POST") {
      const attempted = `${init.method ?? "GET"} ${url}`;
      log(`FAKE_AI_REFUSED: unexpected outbound call ${attempted}`);
      throw new Error(`fake AI provider: refusing unexpected outbound call ${attempted}`);
    }

    const body = JSON.parse(init.body);
    // The model is forced to call one tool; answer with a call to that same tool.
    const toolName = body.tool_choice.name;
    const prompt = body.messages.find((m) => m.role === "user").content;
    const message = messageFromPrompt(prompt);
    if (message === null) log("FAKE_AI_UNRECOGNIZED_PROMPT: answering with FALLBACK_REPLY");
    const args = toolArguments(message);

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

  return { fetch: fakeFetch };
}
