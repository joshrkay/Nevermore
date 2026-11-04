import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildUserPrompt, serializeContext } from "../../chamber-extract/prompt";
import * as chat from "../../chamber-extract/schema";
import * as documents from "../../document-extract/schema";

// Every extraction event records the prompt version that produced it (US-2.4a). These fingerprints
// make a change to a prompt or its tool fail here until its PROMPT_VERSION is raised; then add the
// new version's fingerprint below, keeping the old ones so the history reads.
const fingerprint = (prompt: string, tool: unknown) => createHash("sha256").update(`${prompt}\n${JSON.stringify(tool)}`).digest("hex");

const KNOWN = {
  "chamber-extract": {
    1: "89db609d8c6914c5db41973ad37c4869602bb24d1c3facfce87e81cd84ed5231",
    // 2: every top-level intake field but the census (US-2.1b). The B-1.1 branch built its own 2 at the same
    // time (9353e3ba7b62efffdcbdf7d58d28c910f1d2d545532a50bbece21cefbd2b52e8), never on main by itself.
    2: "df5be12a55b4b2732660a15192245b18ca8d663a4cc58acbac0486bb6073e75d",
    // 3: the two merged: US-2.1b's fields and guide with B-1.1's definitions and caps.
    3: "3ac5338acfc6e8e95733f47435620ab76a25ed020ae86f92cc1647a3ac30bcb5",
    // 4: how Lenore replies (the next unsettled field, wrapping up, never claiming readiness) and the user turn's
    // ready and census lines (US-2.3a).
    4: "560743bff947177c3d747a7b67f0dab8c77dc9d9d18e2f0dd93211626927245b",
  } as Record<number, string>,
  "document-extract": { 1: "744ca691694607cec176b5b8b3d868fa3345204572e88411123dc6e27bb9f526" } as Record<number, string>,
};

// chamber-extract's user turn (prompt.ts, shared with the extraction eval) is part of its contract too
// (B-1.4), so its wording, rendered for fixed inputs with and without context and with a census, is fingerprinted
// per version.
const USER_TURNS = [
  buildUserPrompt({ message: "<message>" }),
  buildUserPrompt({
    message: "<message>",
    context: { company_name: "<value>" },
    statuses: { company_name: "inferred" },
    recent: [{ sender: "lenore", text: "<question>" }, { sender: "user", text: "<answer>" }],
  }),
  buildUserPrompt({ message: "<message>", census: { rows: 2, workStates: true } }),
];
const USER_TURN_KNOWN: Record<number, string> = {
  1: "3896da3494d25d62cd3728e082826d3fb5ce09e598736c25e65f626047d8656a",
  2: "3896da3494d25d62cd3728e082826d3fb5ce09e598736c25e65f626047d8656a",
  // 3: the answers, their statuses, what isn't settled and the recent conversation (US-2.1b), shared with the eval.
  3: "09db07ee0c4748efff56941a37f763ef8e51bb213111ee8e4cb9bae97a6b7c82",
  // 4: the ready and census lines (US-2.3a). Rendered here with a third turn that has a census.
  4: "9b021814414e815258f2934dc7ee157aa9642ca343c3c9be222c618a5c63746d",
};

describe("prompt versions", () => {
  it.each([
    ["chamber-extract", chat.PROMPT_VERSION, chat.SYSTEM_PROMPT, chat.EXTRACT_TOOL],
    ["document-extract", documents.PROMPT_VERSION, documents.SYSTEM_PROMPT, documents.REPORT_TOOL],
  ] as const)("%s: version %i is the prompt and tool it was recorded as", (name, version, prompt, tool) => {
    expect(fingerprint(prompt, tool), `${name} changed: raise PROMPT_VERSION and record the new fingerprint`).toBe(KNOWN[name][version]);
  });

  it("chamber-extract: its version's user turn is the wording it was recorded as", () => {
    const turn = createHash("sha256").update(JSON.stringify(USER_TURNS)).digest("hex");
    expect(turn, "chamber-extract's user turn changed: raise PROMPT_VERSION and record the new fingerprints").toBe(USER_TURN_KNOWN[chat.PROMPT_VERSION]);
  });
});
