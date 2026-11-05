// The label an intake field goes by, for the emails that name fields (an advisor's request for information).
// From the intake schema, the same labels the prospect sees, so the email names a field the way The Chamber does.
// Relative imports only, so it runs under Deno and Vitest alike.

import { INTAKE_FIELDS } from "../_shared/intakeSchema.ts";

const LABELS: ReadonlyMap<string, string> = new Map(INTAKE_FIELDS.map((f) => [f.key, f.label]));

/** The labels of `keys`, in order, each once; the census's older name reads as the census, and an unknown key is left out. */
export function fieldLabels(keys: readonly string[]): string[] {
  const out: string[] = [];
  for (const key of keys) {
    const label = LABELS.get(key === "employees" ? "census" : key);
    if (label && !out.includes(label)) out.push(label);
  }
  return out;
}
