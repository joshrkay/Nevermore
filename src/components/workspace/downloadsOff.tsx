import { useContext } from "react";
import { WorkspaceContext } from "./workspaceContext";

/**
 * Whether files are off for this person (story CRM-P2.4): true for a platform admin on a support session, in the firm's workspace.
 * The one place every download control in the workspace asks, whether it builds its file in the browser or opens a stored one. Outside
 * the workspace shell (the employer's own pages) there is no support session, so the answer is no and nothing changes there.
 *
 * It is a rule of the screen: a person with the rows in front of them can still copy them. What the database holds firm is that no
 * stored file opens for a support session (intake_folder_in_my_firm, the PEO attachment policy).
 */
export function useDownloadsOff(): boolean {
  return useContext(WorkspaceContext)?.isSupport ?? false;
}

export const DOWNLOADS_OFF_LINE = "Downloads are off during Nevermore support.";

/** The one plain line that stands where a group of download controls was. It shows nothing to anyone else. */
export const DownloadsOffNotice = ({ className = "text-xs text-muted-foreground" }: { className?: string }) =>
  useDownloadsOff() ? <p className={className} role="status">{DOWNLOADS_OFF_LINE}</p> : null;
