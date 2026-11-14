import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ActivityError, setTaskDone, type ActivityItem, type ActivityType, type Logged } from "@/lib/activityApi";
import { AccountActionsContext, type AccountActions } from "./useAccountActions";
import { AddToNoteDialog } from "./AddToNoteDialog";
import { LogActivityDialog } from "./LogActivityDialog";
import { accountKey } from "./useAccountQueries";

// What a person can do to an account's calls, notes and tasks (story CRM-E1.5), offered to the places that draw them (the header's buttons, a contact's
// row, an entry of the Activity tab) through one context, so each place asks for an action and the dialogs and their refresh live here once. Without a
// provider (a Nevermore support session, an archived account) there are no actions and nothing is drawn for them.

type Open = { mode: "log"; kind: ActivityType; contactId: string | null } | { mode: "edit"; item: ActivityItem } | { mode: "add"; item: ActivityItem } | null;

const SAVED_WORDS: Record<ActivityType, string> = { call: "Call logged", note: "Note added", task: "Task added" };

export function AccountActionsProvider({ firmId, accountId, accountName, userId, children }: {
  firmId: string; accountId: string; accountName: string; userId: string | null; children: ReactNode;
}) {
  const [open, setOpen] = useState<Open>(null);
  const queryClient = useQueryClient();
  // Every list of the account is asked again: a new row belongs in the Activity tab, its count and the Overview, and a task's state in each.
  const refresh = useCallback(() => void queryClient.invalidateQueries({ queryKey: accountKey(firmId, accountId) }), [queryClient, firmId, accountId]);
  const actions = useMemo<AccountActions>(() => ({
    log: (kind, contactId = null) => setOpen({ mode: "log", kind, contactId }),
    edit: (item) => setOpen({ mode: "edit", item }),
    addTo: (item) => setOpen({ mode: "add", item }),
    setDone: async (task, done) => {
      try {
        await setTaskDone(firmId, task.id, done);
        refresh();
      } catch (err) {
        toast.error(err instanceof ActivityError ? err.message : "Couldn't update the task. Check your connection and try again.");
      }
    },
  }), [firmId, refresh]);
  const close = () => setOpen(null);
  return (
    <AccountActionsContext.Provider value={actions}>
      {children}
      {open?.mode === "log" && (
        <LogActivityDialog
          firmId={firmId} accountId={accountId} accountName={accountName} kind={open.kind} contactId={open.contactId} userId={userId} onClose={close}
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
      {open?.mode === "add" && (
        <AddToNoteDialog firmId={firmId} note={open.item} onClose={close} onSaved={() => { toast.success("Added to the note"); close(); refresh(); }} />
      )}
    </AccountActionsContext.Provider>
  );
}
