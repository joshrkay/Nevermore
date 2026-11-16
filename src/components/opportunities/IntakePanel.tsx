import { Link } from "react-router-dom";
import { ListPanel, Pill } from "@/components/accounts/accountLists";
import { submissionPath } from "@/components/accounts/accountColumns";
import { formatDay } from "@/data/accountPage";
import { employeeCountWords, nextStepWords } from "@/data/opportunityPage";
import { FIELD_LABELS } from "@/data/provenance";
import type { IntakeSummary, OpportunityPage } from "@/lib/opportunityPageApi";

// The intake panel (screen 19, D-425, D-426): the summary of the intake the opportunity holds, with Open intake to the submission's page. "PEOs authorized" is off
// (D-402) and nothing here sends mail. Its states: no intake; under way (who is filling it in and how many answers, with no Remind, D-402); certified and nothing
// sent ("Ready to send", with Record a send opening the submission's page, D-403, in place of Choose PEOs); and certified and on its way, with the facts.
// Won or lost's banner is CRM-O1.3b's.

const linkClass = "text-sm text-primary underline underline-offset-2 hover:text-primary/90";

const Fact = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="mt-0.5 text-sm font-medium break-words">{children}</dd>
  </div>
);

/** The first open item as a person reads it: a required answer by its label, any other by the label of its field. */
const firstOpenItem = (i: IntakeSummary["openItems"]): string | null =>
  i.firstLabel ?? (i.firstField ? (FIELD_LABELS as Record<string, string>)[i.firstField] ?? i.firstField.replace(/_/g, " ") : null);

const answersWords = (n: number) => `${n} ${n === 1 ? "answer" : "answers"}`;

export function IntakePanel({ page }: { page: OpportunityPage }) {
  const { intake, opportunity, mainContact } = page;
  if (!intake) {
    const next = nextStepWords(opportunity.stage, null, null, mainContact?.name ?? null);
    return (
      <ListPanel id="opportunity-intake" heading="Intake">
        <p className="text-sm font-medium">No intake yet</p>
        {next && <p className="mt-1 text-sm text-muted-foreground">{next}</p>}
      </ListPanel>
    );
  }
  const certified = intake.certifiedAt !== null;
  const readyToSend = certified && opportunity.stage === "ready_to_send";
  const first = firstOpenItem(intake.openItems);
  const links = (
    <span className="flex items-center gap-4">
      {readyToSend && <Link to={submissionPath(intake.submissionId)} className={linkClass}>Record a send</Link>}
      <Link to={submissionPath(intake.submissionId)} className={linkClass}>Open intake</Link>
    </span>
  );
  return (
    <ListPanel id="opportunity-intake" heading="Intake" seeAll={links}>
      {certified ? (
        <>
          <p className="mb-3 flex items-center gap-3 text-sm">
            <Pill>Certified</Pill>
            {readyToSend && <span className="font-medium">Ready to send</span>}
          </p>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Fact label="File ID">{intake.fileId ?? "Not assigned"}</Fact>
            <Fact label="Certified by">{[intake.certifiedBy, intake.certifiedAt ? formatDay(intake.certifiedAt) : null].filter(Boolean).join(", ")}</Fact>
            <Fact label="Version">{intake.version ?? "Not recorded"}</Fact>
            <Fact label="Census">{intake.censusSize !== null ? employeeCountWords(intake.censusSize) : "Not provided"}</Fact>
            <Fact label="Open items">{intake.openItems.count === 0 ? "None" : first ? `${intake.openItems.count} · ${first}` : String(intake.openItems.count)}</Fact>
          </dl>
        </>
      ) : (
        <p className="text-sm">
          {`${intake.prospectName ?? "The prospect"} is filling it in${intake.answered !== null ? ` · ${answersWords(intake.answered)}` : ""}`}
        </p>
      )}
    </ListPanel>
  );
}
