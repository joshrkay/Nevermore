import { formatDay } from "@/data/accountPage";
import type { LeadPage } from "@/lib/leadPageApi";

const STEPS = [
  { status: "new", label: "New", began: (s: LeadPage["stages"]) => s.new },
  { status: "working", label: "Working", began: (s: LeadPage["stages"]) => s.working },
  { status: "converted", label: "Converted", began: (s: LeadPage["stages"]) => s.converted },
] as const;

/**
 * The status bar of a lead's page (story CRM-L2.1): New, Working and Converted, each with the date it began (the database reads Working's from the lead's
 * history, D-808), the lead's own status marked as the current step. A Not a fit lead marks none: its banner says so.
 */
export function LeadStatusBar({ status, stages }: { status: string; stages: LeadPage["stages"] }) {
  return (
    <ol aria-label="Status" className="mb-6 grid grid-cols-3 overflow-hidden rounded-xl border border-border text-sm">
      {STEPS.map((step) => {
        const began = step.began(stages);
        const current = status === step.status;
        return (
          <li
            key={step.status}
            aria-current={current ? "step" : undefined}
            className={`px-4 py-2 ${current ? "bg-primary text-primary-foreground" : began ? "bg-primary/10" : "text-muted-foreground"}`}
          >
            <span className="block font-medium">{step.label}</span>
            <span className="block text-xs">{began ? formatDay(began) : "Not yet"}</span>
          </li>
        );
      })}
    </ol>
  );
}
