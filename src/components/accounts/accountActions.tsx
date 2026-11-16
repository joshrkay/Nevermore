import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { ContactRow } from "@/lib/accountPageApi";
import { ActivityError, setTaskDone, type ActivityItem, type ActivityType, type Logged } from "@/lib/activityApi";
import { AccountActionsContext, type AccountActions } from "./useAccountActions";
import { AddContactDialog } from "./AddContactDialog";
import { AddToNoteDialog } from "./AddToNoteDialog";
import { LogActivityDialog } from "./LogActivityDialog";
import { MergeDialog, type MergedRecords } from "./MergeDialog";
import { MoveContactDialog } from "./MoveContactDialog";
import { NewOpportunityDialog } from "./NewOpportunityDialog";
import { PickContactDialog } from "./PickContactDialog";
import { accountKey } from "./useAccountQueries";

// What a person can do to an account's calls, notes and tasks (story CRM-E1.5), offered to the places that draw them (the header's buttons, a contact's
// row, an entry of the Activity tab) through one context, so each place asks for an action and the dialogs and their refresh live here once. Without a
// provider (a Nevermore support session, an archived account) there are no actions and nothing is drawn for them.

type Open =
  | { mode: "log"; kind: ActivityType; contactId: string | null; opportunityId: string | null }
  | { mode: "edit"; item: ActivityItem }
  | { mode: "add"; item: ActivityItem }
  | { mode: "contact" }
  | { mode: "opportunity" }
  | { mode: "move"; contact: ContactRow }
  | { mode: "pick"; contact: ContactRow }
  | { mode: "merge"; keptId: string; removedId: string }
  | null;

const SAVED_WORDS: Record<ActivityType, string> = { call: "Call logged", note: "Note added", task: "Task added" };

export function AccountActionsProvider({ firmId, accountId, accountName, userId, person, canAdd, canMove, canMerge = false, alsoRefresh, startWithContactForm = false, onStarted, onContactsMerged, children }: {
  firmId: string; accountId: string; accountName: string; userId: string | null; person?: string; canAdd: boolean;
  /** Whether a contact may be offered a move: the person may change the account. */
  canMove: boolean;
  /** Whether a contact may be offered a merge with another contact of this account (CRM-S4.3a). The database asks the rest (D-642). */
  canMerge?: boolean;
  /** Said after two contacts were merged, once the lists are asked again: a contact's page leaves the one that is gone. */
  onContactsMerged?: (merged: MergedRecords) => void;
  /** Another key whose queries are asked again with the account's own: a contact's page keeps its lists under the contact (CRM-C1.1), not under the account it is on now. */
  alsoRefresh?: readonly unknown[];
  /** Opens the Add a contact form as the page arrives ("Save and add a contact" on New account, CRM-A1.2), once; `onStarted` says it has been (the address is cleaned). */
  startWithContactForm?: boolean;
  onStarted?: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState<Open>(startWithContactForm && canAdd ? { mode: "contact" } : null);
  useEffect(() => {
    if (startWithContactForm) onStarted?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, as the page arrives
  }, []);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // Every list of the account is asked again: a new row belongs in the Activity tab, its count and the Overview, and a task's state in each.
  const alsoKey = alsoRefresh?.join("\u0000");
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: accountKey(firmId, accountId) });
    if (alsoRefresh) void queryClient.invalidateQueries({ queryKey: alsoRefresh });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key's own text stands for it
  }, [queryClient, firmId, accountId, alsoKey]);
  const actions = useMemo<AccountActions>(() => ({
    canAdd,
    log: (kind, contactId = null, opportunityId = null) => setOpen({ mode: "log", kind, contactId, opportunityId }),
    edit: (item) => setOpen({ mode: "edit", item }),
    addTo: (item) => setOpen({ mode: "add", item }),
    addContact: () => setOpen({ mode: "contact" }),
    newOpportunity: () => setOpen({ mode: "opportunity" }),
    canMove,
    move: (contact) => setOpen({ mode: "move", contact }),
    canMerge,
    merge: (contact) => setOpen({ mode: "pick", contact }),
    setDone: async (task, done) => {
      try {
        await setTaskDone(firmId, task.id, done);
        refresh();
      } catch (err) {
        toast.error(err instanceof ActivityError ? err.message : "Couldn't update the task. Check your connection and try again.");
      }
    },
  }), [firmId, refresh, canAdd, canMove, canMerge]);
  const close = () => setOpen(null);
  return (
    <AccountActionsContext.Provider value={actions}>
      {children}
      {open?.mode === "log" && (
        <LogActivityDialog
          firmId={firmId} accountId={accountId} accountName={accountName} kind={open.kind} contactId={open.contactId} opportunityId={open.opportunityId} userId={userId} onClose={close}
          onSaved={(logged: Logged | { activity: ActivityItem; followUp: null }) => {
            toast.success(logged.followUp ? `${SAVED_WORDS[logged.activity.type]}, with its follow-up task` : SAVED_WORDS[logged.activity.type]);
            close();
            refresh();
          }}
        />
      )}
      {open?.mode === "edit" && (
        <LogActivityDialog
          firmId={firmId} accountId={accountId} accountName={accountName} kind={open.item.type} item={open.item} userId={userId} onClose={close}
          onSaved={() => { toast.success("Saved"); close(); refresh(); }}
        />
      )}
      {open?.mode === "contact" && (
        <AddContactDialog firmId={firmId} accountId={accountId} person={person} onClose={close} onAdded={refresh} />
      )}
      {open?.mode === "opportunity" && (
        <NewOpportunityDialog
          firmId={firmId} accountId={accountId} person={person} onClose={close}
          // Saving opens the new opportunity's own page (D-442, CRM-O1.1b's route); the account's lists are asked again for when the person comes back.
          onCreated={(made) => { close(); refresh(); navigate(`/opportunities/${made.id}`); }}
        />
      )}
      {open?.mode === "move" && (
        <MoveContactDialog
          firmId={firmId}
          contact={{ id: open.contact.id, name: [open.contact.firstName, open.contact.lastName].filter(Boolean).join(" ") }}
          onClose={close}
          // The account the contact left and the one it joined both list it (and its calls, notes and tasks): each is asked again, not only the one on screen.
          onMoved={(moved) => {
            refresh();
            void queryClient.invalidateQueries({ queryKey: accountKey(firmId, moved.from.id) });
            void queryClient.invalidateQueries({ queryKey: accountKey(firmId, moved.to.id) });
          }}
        />
      )}
      {open?.mode === "pick" && (
        <PickContactDialog
          firmId={firmId}
          accountId={accountId}
          contact={{ id: open.contact.id, name: [open.contact.firstName, open.contact.lastName].filter(Boolean).join(" ") }}
          onClose={close}
          onPicked={(otherId) => setOpen({ mode: "merge", keptId: open.contact.id, removedId: otherId })}
        />
      )}
      {open?.mode === "merge" && (
        <MergeDialog
          firmId={firmId}
          kind="contact"
          keptId={open.keptId}
          removedId={open.removedId}
          onClose={close}
          onMerged={(merged) => {
            close();
            refresh();
            void queryClient.invalidateQueries({ queryKey: ["contact", firmId, merged.kept.id] });
            void queryClient.invalidateQueries({ queryKey: ["contact", firmId, merged.removed.id] });
            onContactsMerged?.(merged);
          }}
        />
      )}
      {open?.mode === "add" && (
        <AddToNoteDialog firmId={firmId} note={open.item} onClose={close} onSaved={() => { toast.success("Added to the note"); close(); refresh(); }} />
      )}
    </AccountActionsContext.Provider>
  );
}
