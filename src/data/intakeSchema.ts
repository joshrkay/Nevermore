// The intake schema lives beside the edge functions so chamber-extract and the app check answers against
// the same rules. See supabase/functions/_shared/intakeSchema.ts.
export {
  FIELD_SECTIONS,
  INTAKE_FIELDS,
  INTAKE_SCHEMA,
  INTAKE_SCHEMA_VERSION,
  REQUIRED_FIELDS,
  SECTION_LABELS,
  validateChamberData,
  validateIntakeField,
} from "../../supabase/functions/_shared/intakeSchema.ts";
export type { FieldSection, IntakeFieldMeta, IntakeIssue } from "../../supabase/functions/_shared/intakeSchema.ts";
