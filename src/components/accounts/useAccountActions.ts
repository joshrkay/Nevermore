import { createContext, useContext } from "react";
import type { ActivityItem, ActivityType } from "@/lib/activityApi";

// What a person can do to an account's calls, notes and tasks (story CRM-E1.5), offered to the places that draw them through one context
// (accountActions.tsx provides it). Without a provider (a Nevermore support session, an archived account) there are no actions.

export interface AccountActions {
  log: (kind: ActivityType, contactId?: string | null) => void;
  edit: (item: ActivityItem) => void;
  addTo: (note: ActivityItem) => void;
  setDone: (task: ActivityItem, done: boolean) => Promise<void>;
}

export const AccountActionsContext = createContext<AccountActions | null>(null);

/** The actions of the account being shown, or null where there are none. */
export const useAccountActions = (): AccountActions | null => useContext(AccountActionsContext);

