import { PIPELINE_LABELS, type PipelineStatus } from "@/data/advisor";

const CLASS: Record<PipelineStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-primary/15 text-primary",
  under_review: "bg-primary/15 text-primary",
  information_requested: "bg-warning/15 text-warning",
  sent_to_carrier: "bg-primary/15 text-primary",
  quoted: "bg-primary/15 text-primary",
  won: "bg-success/15 text-success",
  lost: "bg-destructive/15 text-destructive",
  archived: "bg-muted text-muted-foreground",
};

export const PipelineBadge = ({ status }: { status: PipelineStatus }) => (
  <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${CLASS[status]}`}>{PIPELINE_LABELS[status]}</span>
);
