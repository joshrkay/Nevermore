import { createContext, useContext } from "react";
import type { ActivityItem, ActivityType } from "@/lib/activityApi";
import type { ContactRow } from "@/lib/accountPageApi";
import type { StartingRenewal } from "./NewOpportunityDialog";

// What a person can do to an account's calls, notes and tasks (story CRM-E1.5), offered to the places that draw them through one context
// (accountActions.tsx provides it). Without a provider (a Nevermore support session, an archived account) there are no actions.

export interface AccountActions {
  /** Whether something new can be added: false on an archived account (D-222), where a call or a task can still be changed and a task marked done. */
  canAdd: boolean;
  /** `contactId` and `opportunityId` are already chosen in the form when it is opened from a contact or an opportunity (CRM-O1.1b). */
  log: (kind: ActivityType, contactId?: string | null, opportunityId?: string | null) => void;
  edit: (item: ActivityItem) => void;
  addTo: (note: ActivityItem) => void;
  setDone: (task: ActivityItem, done: boolean) => Promise<void>;
  /** Opens the Add a contact form on this account (CRM-A2.2). Offered where `canAdd` is. */
  addContact: () => void;
  /** Opens the New opportunity form on this account (CRM-A2.3). Offered where `canAdd` is. */
  newOpportunity: () => void;
  /** Opens the New opportunity form filled in for a renewal, which saving links to it ("Start the renewal", CRM-A2.4b, D-449). Offered where `canAdd` is. */
  startRenewal: (renewal: StartingRenewal) => void;
  /** Whether a contact may be offered a move to another account: the person may change this account (the database asks the rest, D-209). */
  canMove: boolean;
  /** Opens Move on a contact of this account. */
  move: (contact: ContactRow) => void;
}

export const AccountActionsContext = createContext<AccountActions | null>(null);

/** The actions of the account being shown, or null where there are none. */
export const useAccountActions = (): AccountActions | null => useContext(AccountActionsContext);

