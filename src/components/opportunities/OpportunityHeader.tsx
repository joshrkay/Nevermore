import { Link } from "react-router-dom";
import { Pill } from "@/components/accounts/accountLists";
import { contactPath } from "@/components/accounts/accountColumns";
import { PlaceholderLine } from "@/components/workspace/states";
import { formatDay, STAGE_LABELS } from "@/data/accountPage";
import { employeeCountWords, nextStepWords, stageBar } from "@/data/opportunityPage";
import type { OpportunityPage } from "@/lib/opportunityPageApi";

/**
 * The top of the opportunity's page (screen 19, D-431): "Opportunity", the name with its stage, one line of target start, employees, main contact and owner,
 * the stage bar and, under it, what would move it on (D-414). Email the contact and Send to a PEO are off (D-402) and Mark won or lost is CRM-O1.3b's, so none
 * is drawn: nothing here is a button that does nothing (D-24). The trail is drawn by the page.
 */
export function OpportunityHeader({ page }: { page: OpportunityPage }) {
  const { opportunity: o, mainContact, owner, intake } = page;
  const guidance = nextStepWords(o.stage, intake?.pipelineStatus ?? null, intake?.prospectName ?? null, mainContact?.name ?? null);
  const places = stageBar(o.stage);
  return (
    <header className="mb-6">
      <p className="text-sm text-muted-foreground">Opportunity</p>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold break-words">{o.name}</h1>
        <Pill>{STAGE_LABELS[o.stage]}</Pill>
      </div>
      <p className="mt-1 text-sm text-muted-foreground break-words">
        {o.targetStart && <>Target start {formatDay(o.targetStart)} · </>}
        {o.employees !== null && <>{employeeCountWords(o.employees)} · </>}
        {mainContact
          ? <>Main contact <Link to={contactPath(mainContact.id)} className="text-primary underline underline-offset-2 hover:text-primary/90">{mainContact.name}</Link></>
          : "No main contact"}
        {" · "}
        {owner ? `Owner ${owner.name}` : "No owner"}
      </p>
      <ol aria-label="Stage" className="mt-4 grid grid-cols-3 gap-1 text-sm sm:grid-cols-6">
        {places.map((p) => (
          <li
            key={p.stage}
            aria-current={p.current ? "step" : undefined}
            className={`rounded-md px-3 py-2 ${p.current ? "bg-primary font-medium text-primary-foreground" : p.done ? "bg-primary/10 text-foreground" : "bg-muted text-muted-foreground"}`}
          >
            {p.label}
          </li>
        ))}
      </ol>
      {guidance && <p className="mt-2 text-sm text-muted-foreground">{guidance}</p>}
    </header>
  );
}

/** The header as it is drawn while the opportunity is on its way: the page's frame shows at once, with grey where the name and facts will be. */
export function OpportunityHeaderLoading() {
  return (
    <header aria-hidden="true" aria-busy="true" className="mb-6 space-y-2">
      <PlaceholderLine width="name" className="h-8 w-72" />
      <PlaceholderLine width="name" className="w-96" />
      <PlaceholderLine width="full" className="h-9" />
    </header>
  );
}
