// How a field's status and source read to the prospect, wherever an answer is shown: the workspace's fields and a
// PEO's extra questions alike.
import type { FieldProvenance, FieldSource } from "@/data/provenance";

export const BADGES: Record<FieldProvenance["status"], { text: string; color: string }> = {
  confirmed: { text: "Confirmed", color: "bg-success/15 text-success" },
  inferred: { text: "Lenore captured this — please confirm", color: "border border-warning/50 text-warning" },
  incomplete: { text: "Incomplete", color: "bg-warning/15 text-warning" },
  conflicting: { text: "Conflicting answers", color: "bg-destructive/15 text-destructive" },
  unknown: { text: "Not known yet", color: "border border-warning/50 text-warning" },
  not_applicable: { text: "Doesn't apply", color: "bg-muted text-muted-foreground" },
};

// Prospect-facing wording; the Manuscript uses describeSource() for advisors.
export function sourceLine(source: FieldSource): string {
  switch (source.kind) {
    case "transcript":
      return source.quote ? `From your message: “${source.quote}”` : "From your conversation with Lenore";
    case "document":
      return `From ${source.document_name ?? "an uploaded document"}${source.location ? ` (${source.location})` : ""}`;
    case "prospect_edit":
      return "You confirmed this";
  }
}
