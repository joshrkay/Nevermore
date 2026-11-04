import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildUserPrompt, userTurnParts } from "../../chamber-extract/prompt";
import * as chat from "../../chamber-extract/schema";
import * as documents from "../../document-extract/schema";

// Every extraction event records the prompt version that produced it (US-2.4a). These fingerprints
// make a change to a prompt or its tool fail here until its PROMPT_VERSION is raised; then add the
// new version's fingerprint below, keeping the old ones so the history reads.
const fingerprint = (prompt: string, tool: unknown) => createHash("sha256").update(`${prompt}\n${JSON.stringify(tool)}`).digest("hex");

const KNOWN = {
  "chamber-extract": { 1: "89db609d8c6914c5db41973ad37c4869602bb24d1c3facfce87e81cd84ed5231", 2: "df5be12a55b4b2732660a15192245b18ca8d663a4cc58acbac0486bb6073e75d", 3: "e4058341346f016579ef6241be045dc8d9d93176062a215f6344164e8513d0f0" } as Record<number, string>,
  "document-extract": { 1: "744ca691694607cec176b5b8b3d868fa3345204572e88411123dc6e27bb9f526" } as Record<number, string>,
};

// chamber-extract's user turn (prompt.ts, shared with the extraction eval) is part of its contract too
// (B-1.4), so its wording, rendered for fixed inputs (empty, and with answers, a status, a message and a
// field still to settle), is fingerprinted per version. Recorded from version 3, when the turn took
// D22's statuses and recent conversation; earlier versions' turns aren't rendered by today's builder.
const USER_TURNS = [
  buildUserPrompt("<message>", userTurnParts(undefined, {}, []), []),
  buildUserPrompt(
    "<message>",
    userTurnParts({ company_name: "<value>" }, { company_name: "inferred" }, [{ sender: "lenore", text: "<question>" }]),
    [{ key: "<field>", label: "<label>" }],
  ),
];
const USER_TURN_KNOWN: Record<number, string> = {
  3: "ce6711f6c7922a56b9ad548c83a82b5d15d0317dee621fa658bcdf81a0a462b6",
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
