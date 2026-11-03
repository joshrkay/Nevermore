// The intake schema lives beside the edge functions so chamber-extract and the app check answers against
// the same rules. See supabase/functions/_shared/intakeSchema.ts.
export {
  INTAKE_SCHEMA_V1,
  INTAKE_SCHEMA_VERSION,
  validateChamberData,
  validateIntakeField,
} from "../../supabase/functions/_shared/intakeSchema.ts";
export type { IntakeIssue } from "../../supabase/functions/_shared/intakeSchema.ts";
