import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildUserPrompt } from "../../chamber-extract/prompt";
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
    // 5: Lenore points to the census template on the Upload tab whenever the roster comes up (US-2.3d).
    5: "2773869d220805289bddade61199df5b03010e1140e24841de36a685e9a4977c",
    // 6: "unknown" only on the prospect's own words of not knowing; never claims the intake is finished while a field is
    // unsettled; re-asks an unanswered question; prospect_stopping (QA F4, F11).
    6: "bae67521577c29fa4c236450d5ae9c4fd65dcd3f4e2bd45fd7decd429920520b",
    // 7: a field an advisor asked about is marked in "Not yet settled", and Lenore says the advisor asked, reads back what
    // the intake holds and asks for a confirmation or correction (information requests).
    7: "d56d02c03a29f8d3992b20279f2ff52c8b9414c0fe210c03c3f7b811f2e1f9ec",
    // 8: the Nevermore rebrand. Lenore is Nevermore's intake assistant, warm, quick and plain-spoken (no longer the gothic,
    // literary advisor), and the app, not the Chamber, says when the intake is ready. The extraction rules are unchanged.
    8: "97b83efde81d83cf10958b734560d4e583396a21dd782fc37a98f2c0f37a4ea7",
    // 9: intake schema v3 (Epic K): the common questions join the fields, the FEIN and the legal entities are never
    // taken in chat, and Lenore says where the answers entered in the workspace go.
    9: "113f501fa24d200b0bc323cd66eb488ba490256bcb7b7a5aa4b69b0307ffc0fd",
  } as Record<number, string>,
  "document-extract": {
    1: "744ca691694607cec176b5b8b3d868fa3345204572e88411123dc6e27bb9f526",
    // 2: intake schema v3 (Epic K): the common questions a document can state, and never a FEIN.
    2: "0a9317b51abfa5ee3dbe535af36cb35e1b538bfe1a049b59e44cc68d2b9e1394",
  } as Record<number, string>,
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
  // From version 7: the fields an advisor asked about come first, marked.
  buildUserPrompt({ message: "<message>", context: { pay_frequency: "<value>" }, statuses: { pay_frequency: "confirmed" }, requested: ["pay_frequency", "census"] }),
];
const USER_TURN_KNOWN: Record<number, string> = {
  // 1 and B-1.1's 2: the captured answers and the message, rendered by the earlier buildUserPrompt(message, context).
  1: "3896da3494d25d62cd3728e082826d3fb5ce09e598736c25e65f626047d8656a",
  2: "3896da3494d25d62cd3728e082826d3fb5ce09e598736c25e65f626047d8656a",
  // 3: the answers, their statuses, what isn't settled and the recent conversation (US-2.1b), shared with the eval.
  3: "09db07ee0c4748efff56941a37f763ef8e51bb213111ee8e4cb9bae97a6b7c82",
  // 4: the ready and census lines (US-2.3a). Rendered here with a third turn that has a census.
  4: "9b021814414e815258f2934dc7ee157aa9642ca343c3c9be222c618a5c63746d",
  // 5: unchanged from 4 (US-2.3d changed only the system prompt).
  5: "9b021814414e815258f2934dc7ee157aa9642ca343c3c9be222c618a5c63746d",
  // 6: unchanged from 5 (QA F4 and F11 changed the system prompt and the tool).
  6: "9b021814414e815258f2934dc7ee157aa9642ca343c3c9be222c618a5c63746d",
  // 7: the fields an advisor asked about first in "Not yet settled", marked. Rendered with a fourth turn that has some.
  7: "720e99e10e619db28c25b43a612ac07584636a08e8ef91a65bc5763fb264bb5b",
  // 8: unchanged from 7 (the rebrand changed only the system prompt and the tool).
  8: "720e99e10e619db28c25b43a612ac07584636a08e8ef91a65bc5763fb264bb5b",
  // 9: the "Entered in the workspace" line (K-1.1), and v3's fields in "Not yet settled".
  9: "f3d31341c3e2389aafdb30fe4792e3c5163164a0e306e87a00972566c736344d",
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
