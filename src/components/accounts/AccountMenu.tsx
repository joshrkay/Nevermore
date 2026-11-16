import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MoreHorizontal } from "lucide-react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { listFirmMembers } from "@/lib/accountsApi";
import { archiveAccount, changeAccountOwner, deleteAccount } from "@/lib/accountActionsApi";
import { restoreWithWords, wordsOf, type ActionAccount } from "./restoreWithWords";
import { AccountError } from "@/lib/accountPageApi";

// Archive, restore, delete and change the owner of one account (story CRM-A1.1c), from a row of the Accounts table and from the account's page. The database
// decides who may (the level rule, D-209), a closing firm and Nevermore support, and an account that has an opportunity (it can only be archived); every refusal
// comes back in words and is shown in the dialog that asked. Selecting rows and doing this to many is CRM-S3.7's.

/** What happened, for the screen to refresh from: the account's page reloads, the table asks again, a deleted account is left. */
export type { ActionAccount };
export type ActionDone = "archived" | "restored" | "deleted" | "owner";

type Asking = null | "archive" | "delete" | "owner";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The actions of one account as a menu: Change owner, Archive or Restore, Delete. `label` names the menu to a screen reader. The dialogs are drawn here, so a
 * row's menu and the page's are the same.
 */
export function AccountMenu({ firmId, account, onDone, label }: { firmId: string; account: ActionAccount; onDone: (what: ActionDone) => void; label?: string }) {
  const [asking, setAsking] = useState<Asking>(null);
  const close = () => setAsking(null);
  const restore = async () => {
    if (await restoreWithWords(firmId, account)) onDone("restored");
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={label ?? `Actions for ${account.name}`} className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setAsking("owner")}>Change owner</DropdownMenuItem>
          {account.archived ? <DropdownMenuItem onSelect={() => void restore()}>Restore</DropdownMenuItem> : <DropdownMenuItem onSelect={() => setAsking("archive")}>Archive</DropdownMenuItem>}
          <DropdownMenuItem onSelect={() => setAsking("delete")} className="text-destructive focus:text-destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {asking === "archive" && <ArchiveDialog firmId={firmId} account={account} onClose={close} onDone={onDone} />}
      {asking === "delete" && <DeleteDialog firmId={firmId} account={account} onClose={close} onDone={onDone} onArchiveInstead={() => setAsking("archive")} />}
      {asking === "owner" && <OwnerDialog firmId={firmId} account={account} onClose={close} onDone={onDone} />}
    </>
  );
}

interface DialogProps {
  firmId: string;
  account: ActionAccount;
  onClose: () => void;
  onDone: (what: ActionDone) => void;
}

function Problem({ message }: { message: string | null }) {
  return message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null;
}

function ArchiveDialog({ firmId, account, onClose, onDone }: DialogProps) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await archiveAccount(firmId, account.id);
      toast({ title: `${account.name} is archived.` });
      onClose();
      onDone("archived");
    } catch (e) {
      setProblem(wordsOf(e, "Couldn't archive the account. Try again."));
      setBusy(false);
    }
  };
  return (
    <AlertDialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive {account.name}?</AlertDialogTitle>
          <AlertDialogDescription>It leaves every view but Archived, and nothing can be added to it. You can restore it at any time.</AlertDialogDescription>
        </AlertDialogHeader>
        <Problem message={problem} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button onClick={() => void run()} disabled={busy}>Archive</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteDialog({ firmId, account, onClose, onDone, onArchiveInstead }: DialogProps & { onArchiveInstead: () => void }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [hasOpportunities, setHoldsIntake] = useState(false);
  const run = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await deleteAccount(firmId, account.id);
      toast({ title: `${account.name} is deleted.` });
      onClose();
      onDone("deleted");
    } catch (e) {
      setHoldsIntake(e instanceof AccountError && e.kind === "hasOpportunities");
      setProblem(wordsOf(e, "Couldn't delete the account. Try again."));
      setBusy(false);
    }
  };
  return (
    <AlertDialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {account.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes the account with its contacts, calls, notes, tasks, placements and renewals, and cannot be undone. An account that has opportunities can only be archived.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Problem message={problem} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          {hasOpportunities && !account.archived ? (
            <Button onClick={onArchiveInstead}>Archive instead</Button>
          ) : (
            <Button variant="destructive" onClick={() => void run()} disabled={busy || hasOpportunities}>Delete</Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function OwnerDialog({ firmId, account, onClose, onDone }: DialogProps) {
  const people = useQuery({ queryKey: ["account-owner-choices", firmId], queryFn: () => listFirmMembers(firmId), retry: false, staleTime: 60_000 });
  // Nobody is chosen at first: starting on the current owner would let Change owner hand every open opportunity to the owner it already has.
  const [owner, setOwner] = useState("");
  const [withOpen, setWithOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // Offered unless the account is known to have no open opportunity.
  const offer = account.openOpportunities !== 0;
  const run = async () => {
    if (!owner) {
      setProblem("Choose who will own this account.");
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const done = await changeAccountOwner(firmId, account.id, owner, offer && withOpen);
      const left = done.opportunitiesSkipped > 0 ? ` ${plural(done.opportunitiesSkipped, "open opportunity was", "open opportunities were")} left as ${done.opportunitiesSkipped === 1 ? "it was" : "they were"} because you can't change ${done.opportunitiesSkipped === 1 ? "it" : "them"}.` : "";
      toast({
        title: `${account.name} now belongs to ${done.ownerName ?? "the new owner"}.`,
        description: ((done.opportunitiesChanged > 0 ? `${plural(done.opportunitiesChanged, "open opportunity", "open opportunities")} changed too.` : "") + left).trim() || undefined,
      });
      onClose();
      onDone("owner");
    } catch (e) {
      setProblem(wordsOf(e, "Couldn't change the owner. Try again."));
      setBusy(false);
    }
  };
  return (
    <AlertDialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Change owner of {account.name}</AlertDialogTitle>
          <AlertDialogDescription>Choose who owns this account from now on.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          <div>
            <label htmlFor="account-new-owner" className="mb-1 block text-sm font-medium">New owner</label>
            <select
              id="account-new-owner"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              disabled={busy || people.isPending}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{people.isPending ? "Loading people" : "Choose a person"}</option>
              {(people.data ?? []).filter((p) => p.value !== account.ownerId).map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            {people.isError && <p role="alert" className="mt-1 text-sm text-destructive">Couldn't load the firm's people. Try again.</p>}
          </div>
          {offer && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={withOpen} onChange={(e) => setWithOpen(e.target.checked)} disabled={busy} className="mt-1" />
              <span>
                {account.openOpportunities
                  ? `Also change the owner of its ${plural(account.openOpportunities, "open opportunity", "open opportunities")}`
                  : "Also change the owner of its open opportunities"}
              </span>
            </label>
          )}
          <Problem message={problem} />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button onClick={() => void run()} disabled={busy || !owner || owner === account.ownerId}>Change owner</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
