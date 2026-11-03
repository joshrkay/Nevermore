// Writes docs/intake-schema.v2.json from supabase/functions/_shared/intakeSchema.ts, the one source of the
// intake schema. Run after changing the schema:  npm run schema:intake
// (src/data/intakeSchema.test.ts fails while the two differ). Node 22.18 or later loads the .ts directly.
// docs/intake-schema.v1.json is version 1 as published, and is never rewritten.
import { writeFileSync } from "node:fs";
import { INTAKE_SCHEMA, INTAKE_SCHEMA_VERSION } from "../supabase/functions/_shared/intakeSchema.ts";

const target = new URL(`../docs/intake-schema.v${INTAKE_SCHEMA_VERSION}.json`, import.meta.url);
writeFileSync(target, `${JSON.stringify(INTAKE_SCHEMA, null, 2)}\n`);
console.log(`wrote ${target.pathname}`);
