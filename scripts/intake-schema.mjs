// Writes docs/intake-schema.v3.json (the current version) from supabase/functions/_shared/intakeSchema.ts, the one source of the
// intake schema. Run after changing the schema:  npm run schema:intake
// (src/data/intakeSchema.test.ts fails while the two differ). Node 22.18 or later loads the .ts directly.
// docs/intake-schema.v1.json and v2.json are those versions as published, and are never rewritten.
// It also rewrites the field table in docs/intake-schema.md ("### Fields") from the same schema
// (src/data/intakeSchemaDoc.test.ts fails while that table differs).
import { readFileSync, writeFileSync } from "node:fs";
import { CHAT_CANNOT_TAKE } from "../supabase/functions/_shared/followUp.ts";
import { INTAKE_FIELDS, INTAKE_SCHEMA, INTAKE_SCHEMA_VERSION, LIMITS, SECTION_LABELS } from "../supabase/functions/_shared/intakeSchema.ts";
import { DOCUMENT_FIELDS } from "../supabase/functions/document-extract/parse.ts";

const target = new URL(`../docs/intake-schema.v${INTAKE_SCHEMA_VERSION}.json`, import.meta.url);
writeFileSync(target, `${JSON.stringify(INTAKE_SCHEMA, null, 2)}\n`);
console.log(`wrote ${target.pathname}`);

// ---------- The field table in docs/intake-schema.md ----------

// The kind names of the doc's "Rules by kind" table.
const kindOf = (rule) => {
  const types = [].concat(rule.type);
  if (types.includes("array")) {
    const ref = rule.items.$ref;
    return ref === "#/$defs/stateCode" ? "state list" : ref === "#/$defs/censusRow" ? "census" : ref ? "list of rows" : "text list";
  }
  if (rule.enum) return rule.enum.includes("CA") ? "state" : "choice";
  if (types.includes("number")) return "experience mod";
  if (types.includes("integer")) return rule.maximum === LIMITS.dollars ? "dollars" : rule.maximum === LIMITS.yearMax ? "year" : "count";
  if (types.includes("boolean")) return "boolean";
  if (rule.pattern === "^[0-9]{9}$") return "FEIN";
  return "text";
};

const docPath = new URL("../docs/intake-schema.md", import.meta.url);
const doc = readFileSync(docPath, "utf8");
const header = "| Section | Key | Label | Kind | Required | Rank | Writers |\n| --- | --- | --- | --- | --- | --- | --- |\n";
const start = doc.indexOf(header);
if (start < 0) throw new Error("docs/intake-schema.md has no field table");
const end = doc.indexOf("\n\n", start);
// A row's writers and the note after its kind are written by hand: both are kept for a field already listed.
const listed = new Map(
  [...doc.slice(start + header.length, end).matchAll(/^\| [^|]+ \| `(\w+)` \| [^|]+ \| ([^|]+) \| [^|]+ \| \d+ \| ([^|]+) \|$/gm)]
    .map((m) => [m[1], { note: /(\s*\(.*\))$/.exec(m[2].trim())?.[1] ?? "", writers: m[3].trim() }]),
);
const writersOf = (key) => [CHAT_CANNOT_TAKE.has(key) ? "" : "C", DOCUMENT_FIELDS.includes(key) ? "D" : "", "E"].filter(Boolean).join(" ");
const sectionOrder = Object.keys(SECTION_LABELS);
const rows = [...INTAKE_FIELDS]
  .sort((a, b) => sectionOrder.indexOf(a.section) - sectionOrder.indexOf(b.section) || a.rank - b.rank)
  .map((f) => {
    const was = listed.get(f.key);
    return `| ${SECTION_LABELS[f.section]} | \`${f.key}\` | ${f.label} | ${kindOf(INTAKE_SCHEMA.properties[f.key])}${was?.note ?? ""} | ${f.required ? "Required" : "Recommended"} | ${f.rank} | ${was?.writers ?? writersOf(f.key)} |`;
  });
writeFileSync(docPath, `${doc.slice(0, start)}${header}${rows.join("\n")}${doc.slice(end)}`);
console.log(`rewrote the field table in ${docPath.pathname}`);
