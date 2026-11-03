// Editing the extraction prompt, the tool or the user-turn wording without a new PROMPT_VERSION fails
// here, so every stored value's version names the prompt that actually produced it.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildUserPrompt, serializeContext } from "./prompt";
import { EXTRACT_TOOL, PROMPT_VERSION, SYSTEM_PROMPT } from "./schema";

/** sha256 of the canonical JSON of the system prompt, tool schema and user turn, per contract version. Add a line per bump; never edit one once it has shipped. */
const CONTRACT_HASHES: Record<string, string> = {
  "2026-11-03.1": "6c080bb03bb64580c5ebb0a3991d75a2810c307349b064db5396e12dd774f729",
};

// Object keys sorted at every level, so the hash doesn't depend on property order.
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value !== "object" || value === null) return value;
  const obj = value as Record<string, unknown>;
  return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, canonical(obj[k])]));
};

// The user turn is hashed as rendered for fixed inputs, with and without context, so its wording counts too.
const USER_TURNS = [buildUserPrompt("<message>", ""), buildUserPrompt("<message>", serializeContext({ company_name: "<value>" }))];

const contractHash = () =>
  createHash("sha256").update(JSON.stringify(canonical({ SYSTEM_PROMPT, EXTRACT_TOOL, USER_TURNS }))).digest("hex");

describe("extraction contract version", () => {
  it("has a recorded hash for the prompt, tool schema and user turn under the current PROMPT_VERSION", () => {
    const hash = contractHash();
    const recorded = CONTRACT_HASHES[PROMPT_VERSION];
    const howTo =
      `Bump PROMPT_VERSION in supabase/functions/chamber-extract/schema.ts, add "<new version>": "${hash}" to ` +
      "CONTRACT_HASHES in schema.test.ts, and run the extraction eval (npm run eval:extraction, scripts/extraction-eval) " +
      "before merging: review its regressions, then record a new baseline with --update-baseline.";
    expect(
      recorded,
      recorded === undefined
        ? `No hash is recorded for PROMPT_VERSION "${PROMPT_VERSION}". ${howTo}`
        : `The extraction prompt, tool schema or user turn changed without a new PROMPT_VERSION ("${PROMPT_VERSION}" was recorded as ${recorded}). ${howTo}`,
    ).toBe(hash);
  });

  it("is a short date-and-sequence label the browser accepts", () => {
    expect(PROMPT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
  });

  it("doesn't depend on the order of keys", () => {
    expect(JSON.stringify(canonical({ b: [{ d: 1, c: 2 }], a: "x" }))).toBe('{"a":"x","b":[{"c":2,"d":1}]}');
  });
});
