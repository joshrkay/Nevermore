import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PanelFailed, RefreshFailed } from "@/components/workspace/states";
import { formatDay } from "@/data/accountPage";
import { daysAwayWords, kindLabel } from "@/data/renewals";
import type { Renewal } from "@/lib/renewalsApi";
import { opportunityPath } from "./accountColumns";
import { EmptyLine, ListPanel, ListRowsLoading, Pill, Rows, SeeAll, type Column } from "./accountLists";
import { AddRenewalDialog, DeleteRenewalDialog, EditRenewalDialog, NotRenewedDialog } from "./RenewalDialogs";
import { canStart, undoNotRenewedWithWords } from "./renewalActions";
import { accountKey, useAccountRenewalsQuery } from "./useAccountQueries";
import { useAccountActions } from "./useAccountActions";

// An account's renewals (story CRM-A2.4b, screen 17; D-446 to D-455): the Renewals tab with every renewal and what can be done to it, and the Overview's first five.
// Which renewal is done, how far away it is and who may change it are the database's answers (`account_renewals`); this draws them. Add a renewal is offered to anyone
// who may add to the account (not in a support session, not on an archived account); Edit, Delete, Didn't renew and Start the renewal to whoever may change it.

const linkClass = "text-primary underline underline-offset-2 hover:text-primary/90";
const muted = (words: string) => <span className="text-muted-foreground">{words}</span>;

/** The renewal's opportunity: its name opens its page; one that was lost says so (D-449, the renewal then offers Start the renewal again). */
const workedIn = (r: Renewal) => (r.opportunity ? (
  <Link to={opportunityPath(r.opportunity.id)} className={linkClass}>{r.opportunity.stage === "lost" ? `${r.opportunity.name}, lost` : r.opportunity.name}</Link>
) : muted("Not started"));

/** How far away it is, or how it ended (D-448, D-449): a past renewal that is not done is in the warning colour. */
const inWords = (r: Renewal) => {
  if (r.outcome === "renewed") return <Pill>Renewed</Pill>;
  if (r.outcome === "not_renewed") return <span><Pill>Didn't renew</Pill>{r.notRenewedOn && <span className="ml-2 text-xs text-muted-foreground">{formatDay(r.notRenewedOn)}</span>}</span>;
  return <span className={r.daysAway < 0 ? "font-medium text-warning" : undefined}>{daysAwayWords(r.daysAway)}</span>;
};

const baseColumns: Column<Renewal>[] = [
  { header: "What renews", cell: (r) => <span className="font-medium">{kindLabel(r.kind)}</span> },
  { header: "With", cell: (r) => r.withWhom },
  { header: "Renewal date", cell: (r) => formatDay(r.renewsOn), className: "whitespace-nowrap" },
  { header: "In", cell: inWords, className: "whitespace-nowrap" },
  { header: "Being worked in", cell: workedIn },
];

type Dialog = { mode: "add" } | { mode: "edit" | "notRenewed" | "delete"; renewal: Renewal } | null;

const linkButton = "min-h-9 text-sm text-primary underline underline-offset-2 hover:text-primary/90";

/** The Renewals tab, or (`first`) the Overview's first five rows with "See all". */
export function RenewalsPanel({ firmId, accountId, first = false }: { firmId: string; accountId: string; first?: boolean }) {
  const query = useAccountRenewalsQuery(firmId, accountId);
  const queryClient = useQueryClient();
  const actions = useAccountActions();
  const [dialog, setDialog] = useState<Dialog>(null);
  const data = query.data;
  const id = first ? "overview-renewals" : "account-renewals-heading";
  const refresh = () => void queryClient.invalidateQueries({ queryKey: accountKey(firmId, accountId) });
  const close = () => setDialog(null);
  const done = () => { close(); refresh(); };

  // Writes are offered only where the database will take them: with the page's actions (not in a Nevermore support session, ADR 0024) and, for a change, to whoever may change the account.
  const canAdd = !!actions?.canAdd;
  const canChange = actions !== null && (data?.canChange ?? false);
  // With none on file the empty line carries the one "Add a renewal" (CRM-A2.1); with some, the button over the list.
  const add = canAdd && (data?.count ?? 0) > 0 ? <Button type="button" size="sm" onClick={() => setDialog({ mode: "add" })}>Add a renewal</Button> : null;

  if (!data) {
    return (
      <ListPanel id={id} heading="Renewals" seeAll={add}>
        {query.isError ? <PanelFailed what="the renewals" error={query.error as Error} onRetry={() => void query.refetch()} /> : query.isPending ? <ListRowsLoading /> : <EmptyLine>This account isn't available.</EmptyLine>}
      </ListPanel>
    );
  }

  const rows = first ? data.rows.slice(0, 5) : data.rows;
  const rowActions: Column<Renewal> = {
    header: "Actions",
    cell: (r) => (
      <span className="flex flex-wrap gap-x-3">
        {canChange && actions?.canAdd && canStart(r) && (
          <button type="button" className={linkButton} onClick={() => actions.startRenewal({ id: r.id, renewsOn: r.renewsOn })}>
            Start the renewal<span className="sr-only"> with {r.withWhom}</span>
          </button>
        )}
        {canChange && <button type="button" className={linkButton} onClick={() => setDialog({ mode: "edit", renewal: r })}>Edit<span className="sr-only"> the renewal with {r.withWhom}</span></button>}
        {canChange && !r.done && <button type="button" className={linkButton} onClick={() => setDialog({ mode: "notRenewed", renewal: r })}>Didn't renew<span className="sr-only"> with {r.withWhom}</span></button>}
        {canChange && r.outcome === "not_renewed" && (
          <button type="button" className={linkButton} onClick={() => void undoNotRenewedWithWords(firmId, r).then(refresh)}>Undo<span className="sr-only"> didn't renew with {r.withWhom}</span></button>
        )}
        {canChange && !r.madeByWin && <button type="button" className={linkButton} onClick={() => setDialog({ mode: "delete", renewal: r })}>Delete<span className="sr-only"> the renewal with {r.withWhom}</span></button>}
      </span>
    ),
  };
  const columns = first || !canChange ? baseColumns : [...baseColumns, rowActions];
  const seeAll = first
    ? <span className="flex items-center gap-3">{data.count > 0 && <SeeAll to="?tab=renewals" noun="renewals" />}{add}</span>
    : add;

  return (
    <>
      <ListPanel id={id} heading="Renewals" count={data.count} seeAll={seeAll}>
        <RefreshFailed what="the renewals" failed={query.isError} onRetry={() => void query.refetch()} retrying={query.isFetching} />
        {rows.length === 0 ? (
          <EmptyLine>
            No renewal on file.
            {canAdd && <>{" "}<button type="button" className={linkButton} onClick={() => setDialog({ mode: "add" })}>Add a renewal</button></>}
          </EmptyLine>
        ) : (
          <Rows caption={first ? "The first renewals" : "The account's renewals"} columns={columns} rows={rows} rowKey={(r) => r.id} />
        )}
      </ListPanel>
      {dialog?.mode === "add" && <AddRenewalDialog firmId={firmId} accountId={accountId} onClose={close} onAdded={done} />}
      {dialog?.mode === "edit" && <EditRenewalDialog key={dialog.renewal.id} firmId={firmId} renewal={dialog.renewal} onClose={close} onSaved={done} />}
      {dialog?.mode === "notRenewed" && <NotRenewedDialog key={dialog.renewal.id} firmId={firmId} renewal={dialog.renewal} onClose={close} onSaved={done} />}
      {dialog?.mode === "delete" && <DeleteRenewalDialog firmId={firmId} renewal={dialog.renewal} onClose={close} onDeleted={done} />}
    </>
  );
}
