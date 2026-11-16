import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AddToNoteDialog } from "@/components/accounts/AddToNoteDialog";
import { LogActivityDialog } from "@/components/accounts/LogActivityDialog";
import { AccountActionsContext, type AccountActions } from "@/components/accounts/useAccountActions";
import { ActivityError, setTaskDone, type ActivityItem, type ActivityType, type Logged } from "@/lib/activityApi";
import { leadKey } from "./useLeadQueries";

// What a person can do to a lead's calls, notes and tasks (story CRM-L2.1; D-807), offered through the account's own actions context so the rows, columns and
// buttons that draw an account's calls, notes and tasks draw a lead's unchanged: log one, change it, add to a note, mark a task done. A lead has no contacts to
// add or move, so those are never offered. Without a provider (a Nevermore support session) there are no actions and nothing is drawn for them.

type Open = { mode: "log"; kind: ActivityType } | { mode: "edit"; item: ActivityItem } | { mode: "add"; item: ActivityItem } | null;

const SAVED_WORDS: Record<ActivityType, string> = { call: "Call logged", note: "Note added", task: "Task added" };

/** The actions on one lead: `canAdd` is false on a lead that is read, not changed (the database's `can_add`). */
export function LeadActionsProvider({ firmId, leadId, leadName, userId, canAdd, children }: {
  firmId: string; leadId: string; leadName: string; userId: string | null; canAdd: boolean; children: ReactNode;
}) {
  const [open, setOpen] = useState<Open>(null);
  const queryClient = useQueryClient();
  // Every list of the lead is asked again: a new row belongs in its list and its count, and a call can make it Working (D-808), which the header shows.
  const refresh = useCallback(() => void queryClient.invalidateQueries({ queryKey: leadKey(firmId, leadId) }), [queryClient, firmId, leadId]);
  const actions = useMemo<AccountActions>(() => ({
    canAdd,
    log: (kind) => setOpen({ mode: "log", kind }),
    edit: (item) => setOpen({ mode: "edit", item }),
    addTo: (item) => setOpen({ mode: "add", item }),
    addContact: () => undefined,
    canMove: false,
    move: () => undefined,
    setDone: async (task, done) => {
      try {
        await setTaskDone(firmId, task.id, done);
        refresh();
      } catch (err) {
        toast.error(err instanceof ActivityError ? err.message : "Couldn't update the task. Check your connection and try again.");
      }
    },
  }), [firmId, refresh, canAdd]);
  const close = () => setOpen(null);
  return (
    <AccountActionsContext.Provider value={actions}>
      {children}
      {open?.mode === "log" && (
        <LogActivityDialog
          firmId={firmId} leadId={leadId} accountName={leadName} kind={open.kind} userId={userId} onClose={close}
          onSaved={(logged: Logged | { activity: ActivityItem; followUp: null }) => {
            toast.success(logged.followUp ? `${SAVED_WORDS[logged.activity.type]}, with its follow-up task` : SAVED_WORDS[logged.activity.type]);
            close();
            refresh();
          }}
        />
      )}
      {open?.mode === "edit" && (
        <LogActivityDialog
          firmId={firmId} leadId={leadId} accountName={leadName} kind={open.item.type} item={open.item} userId={userId} onClose={close}
          onSaved={() => { toast.success("Saved"); close(); refresh(); }}
        />
      )}
      {open?.mode === "add" && (
        <AddToNoteDialog firmId={firmId} note={open.item} onClose={close} onSaved={() => { toast.success("Added to the note"); close(); refresh(); }} />
      )}
    </AccountActionsContext.Provider>
  );
}
