// The redaction rules live beside the edge functions so document-extract and the app apply the
// same ones. See supabase/functions/_shared/sensitive.ts.
export { REDACTED, hasSensitive, redactSensitive } from "../../supabase/functions/_shared/sensitive.ts";
