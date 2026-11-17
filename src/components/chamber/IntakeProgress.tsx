import { entrySummary } from "@/data/intakeEntries";
import type { ChamberData } from "@/data/chamberTypes";
import type { ProvenanceMap } from "@/data/provenance";

// How far a client's intake is, for the firm working it (CRM-Q2.2, D-1871): the answers in, who entered them, and what still holds certification back.

export function IntakeProgress({ data, provenance }: { data: ChamberData; provenance: ProvenanceMap }) {
  const s = entrySummary(data, provenance);
  const parts = [`${s.answered} ${s.answered === 1 ? "answer" : "answers"} in`, `${s.byFirm} entered by the firm`, `${s.byContact} by the contact`];
  if (s.stillNeeded.length > 0) parts.push(`Still needed: ${s.stillNeeded.join(", ")}`);
  return (
    <p role="status" aria-label="Intake progress" className="border-b border-border px-4 py-1.5 text-xs text-muted-foreground">
      {parts.join(" · ")}
    </p>
  );
}
