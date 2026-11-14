import { createContext } from "react";

// Kept apart from useWorkspace.ts so a small part (a download control) can ask who the person is without loading the sign-in and the database client.
export type FirmRoleLabel = "Owner" | "Lead" | "Agent" | "Nevermore support";

export interface Workspace {
  /** The firm the page is showing, or null until known (or when the person has none to show). */
  firm: { id: string; name: string; address: string } | null;
  role: FirmRoleLabel | null;
  isOwner: boolean;
  /** Whether the person is a platform admin looking at the firm on a support session (story CRM-P2.4): they can read and nothing else. */
  isSupport: boolean;
  /** When the support session ends, for the banner; null when the person is not on one. */
  supportEndsAt: string | null;
  /** The support session's id, for "End now"; null when the person is not on one. */
  supportSessionId: string | null;
  /** Whether the database says the person is a platform admin; false until known or when it can't be asked (D-37). */
  isPlatformAdmin: boolean;
  /** The person's name, or their email when they have no name (D-42). */
  person: string;
}

/** Exported so a test can stand in for the shell; the app reads it only through `useWorkspace` and `useDownloadsOff`. */
export const WorkspaceContext = createContext<Workspace | null>(null);

