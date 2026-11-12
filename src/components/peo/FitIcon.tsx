import { AlertTriangle, Check, Minus } from "lucide-react";
import { FIT_WORDS, type FitStatus } from "@/data/peoCatalog";

// Each outcome has its own icon shape beside its words, so colour is never the only sign. The one table of both.
const ICONS: Record<FitStatus, typeof Check> = { meets: Check, does_not_meet: AlertTriangle, unknown: Minus };
const TONE: Record<FitStatus, string> = { meets: "text-success", does_not_meet: "text-warning", unknown: "text-muted-foreground" };

/** An eligibility check's outcome as an icon: a tick, a warning triangle or a dash, always beside its words. */
const FitIcon = ({ status, className = "w-4 h-4 shrink-0 mt-0.5" }: { status: FitStatus; className?: string }) => {
  const Icon = ICONS[status];
  return <Icon className={`${className} ${TONE[status]}`} aria-hidden="true" />;
};

/** An eligibility check's outcome in words ("Meets", "Doesn't meet", "Can't tell yet"), in its icon's colour. */
export const FitWords = ({ status, className = "font-medium" }: { status: FitStatus; className?: string }) => (
  <span className={`${className} ${TONE[status]}`}>{FIT_WORDS[status]}</span>
);

export default FitIcon;
