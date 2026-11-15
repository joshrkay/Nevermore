import type { ReactNode } from "react";
import type { AccountDetails } from "@/lib/accountPageApi";
import { employeesWords, initialsOf, locationOf, STATUS_LABELS } from "@/data/accountPage";
import { Pill } from "./accountLists";
import { PlaceholderLine } from "@/components/workspace/states";
import { TAB_IDS, TAB_LABELS } from "./accountColumns";

/**
 * The top of an account's page (screen 17): its name and status, then one line of industry, location, employees, website and owner, whichever of them it has.
 * Email and New opportunity are not shown (D-186), and Log a call and Add a task come with CRM-E1.5: `data-account-actions` is the place they go, empty
 * until then, so nothing here is a button that does nothing (D-24).
 */
export function AccountHeader({ account, actions }: { account: AccountDetails; actions?: ReactNode }) {
  const facts = [
    account.industry,
    locationOf(account),
    employeesWords(account.employees),
    account.website,
    account.owner ? `Owner ${account.owner.name}` : "No owner",
  ].filter((f): f is string => !!f && f.trim() !== "");
  return (
    <header className="mb-6">
      <div className="flex items-start gap-4">
        <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-lg font-semibold text-primary">
          {initialsOf(account.name)}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-bold break-words">{account.name}</h1>
            <Pill>{STATUS_LABELS[account.status]}</Pill>
          </div>
          <p className="mt-1 text-sm text-muted-foreground break-words">{facts.join(" · ")}</p>
        </div>
        {actions && <div className="ml-auto shrink-0">{actions}</div>}
      </div>
      <div data-account-actions className="mt-4 flex flex-wrap gap-2 empty:hidden" />
    </header>
  );
}

/** The header and tabs as they are drawn while the account is on its way: the page's frame shows at once, with grey where the name and facts will be. */
export function AccountHeaderLoading() {
  return (
    <>
      <header aria-hidden="true" aria-busy="true" className="mb-6 flex items-start gap-4">
        <span className="h-14 w-14 shrink-0 rounded-lg bg-muted-foreground/30 motion-safe:animate-pulse" />
        <div className="space-y-2">
          <PlaceholderLine width="name" className="h-8 w-72" />
          <PlaceholderLine width="name" className="w-96" />
        </div>
      </header>
      <ul aria-hidden="true" className="mb-6 flex gap-4 overflow-x-auto border-b border-border text-sm text-muted-foreground">
        {TAB_IDS.map((t) => <li key={t} className="px-2 py-2.5">{TAB_LABELS[t]}</li>)}
      </ul>
    </>
  );
}
