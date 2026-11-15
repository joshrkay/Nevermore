import { createContext, useContext } from "react";
import type { ActivityItem, ActivityType } from "@/lib/activityApi";
import type { ContactRow } from "@/lib/accountPageApi";

// What a person can do to an account's calls, notes and tasks (story CRM-E1.5), offered to the places that draw them through one context
// (accountActions.tsx provides it). Without a provider (a Nevermore support session, an archived account) there are no actions.

export interface AccountActions {
  /** Whether something new can be added: false on an archived account (D-222), where a call or a task can still be changed and a task marked done. */
  canAdd: boolean;
  log: (kind: ActivityType, contactId?: string | null) => void;
  edit: (item: ActivityItem) => void;
  addTo: (note: ActivityItem) => void;
  setDone: (task: ActivityItem, done: boolean) => Promise<void>;
  /** Opens the Add a contact form on this account (CRM-A2.2). Offered where `canAdd` is. */
  addContact: () => void;
  /** Whether a contact may be offered a move to another account: the person may change this account (the database asks the rest, D-209). */
  canMove: boolean;
  /** Opens Move on a contact of this account. */
  move: (contact: ContactRow) => void;
}

export const AccountActionsContext = createContext<AccountActions | null>(null);

/** The actions of the account being shown, or null where there are none. */
export const useAccountActions = (): AccountActions | null => useContext(AccountActionsContext);

