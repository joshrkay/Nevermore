import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INTAKE_FIELDS, INTAKE_SCHEMA, LIMITS, SECTION_LABELS, type JsonSchema } from "../../supabase/functions/_shared/intakeSchema";

// docs/intake-schema.md documents every field with its section, kind, required status and rank (US-2.1).
// Those come from the schema's x-intake annotations, so the table must say what the schema says.
const doc = readFileSync("docs/intake-schema.md", "utf8");
const section = doc.slice(doc.indexOf("### Fields"), doc.indexOf("### Sections, required fields and rank"));
const rows = [...section.matchAll(/^\| ([^|]+) \| `(\w+)` \| ([^|]+) \| ([^|]+) \| (Required|Recommended) \| (\d+) \| [^|]+ \|$/gm)].map((m) => ({
  section: m[1].trim(),
  key: m[2],
  label: m[3].trim(),
  kind: m[4].replace(/\s*\(.*\)$/, "").trim(),
  required: m[5] === "Required",
  rank: Number(m[6]),
}));

// The kind names the "Rules by kind" table uses.
const kindOf = (schema: JsonSchema): string => {
  const types = ([] as unknown[]).concat(schema.type);
  if (types.includes("array")) {
    const ref = (schema.items as JsonSchema).$ref;
    return ref === "#/$defs/stateCode" ? "state list" : ref === "#/$defs/censusRow" ? "census" : ref ? "list of rows" : "text list";
  }
  if (schema.enum) return (schema.enum as unknown[]).includes("CA") ? "state" : "choice";
  if (types.includes("number")) return "experience mod";
  if (types.includes("integer")) return schema.maximum === LIMITS.dollars ? "dollars" : schema.minimum === 1600 ? "year" : "count";
  if (types.includes("boolean")) return "boolean";
  if (typeof schema.pattern === "string") return "FEIN";
  return "text";
};

describe("docs/intake-schema.md field table", () => {
  it("lists every field once, with the section, label, kind, required status and rank the schema gives it", () => {
    const props = INTAKE_SCHEMA.properties as Record<string, JsonSchema>;
    const expected = INTAKE_FIELDS.map((f) => ({
      section: SECTION_LABELS[f.section],
      key: f.key,
      label: f.label,
      kind: kindOf(props[f.key]),
      required: f.required,
      rank: f.rank,
    }));
    const byKey = (a: { key: string }, b: { key: string }) => a.key.localeCompare(b.key);
    expect([...rows].sort(byKey)).toEqual([...expected].sort(byKey));
  });

  it("documents every kind the table uses", () => {
    const rules = doc.slice(doc.indexOf("### Rules by kind"), doc.indexOf("### Fields"));
    for (const kind of new Set(rows.map((r) => r.kind))) expect(rules, kind).toMatch(new RegExp(`^\\| ${kind} \\|`, "m"));
  });
});
