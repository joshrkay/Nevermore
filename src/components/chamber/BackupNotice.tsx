import { History } from "lucide-react";
import type { BackupOffer } from "@/hooks/useChamberSession";

interface BackupNoticeProps {
  offer: BackupOffer;
  onRestore: () => void;
  onDiscard: () => void;
}

const linkButton = "font-medium text-foreground underline underline-offset-2 hover:text-primary transition-colors";

const when = (iso: string) =>
  new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Offers back answers this browser kept from an earlier visit because they never reached the server. */
const BackupNotice = ({ offer, onRestore, onDiscard }: BackupNoticeProps) => (
  <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-muted/60 px-4 py-2 text-xs">
    <span className="flex items-center gap-1.5">
      <History className="w-3.5 h-3.5 shrink-0 text-primary" aria-hidden="true" />
      Changes you made on {when(offer.savedAt)} didn't reach our server. This browser kept a copy.
      {offer.savedElsewhereSince && " This intake has been saved from somewhere else since; restoring replaces those changes."}
    </span>
    <span className="flex items-center gap-3 ml-auto">
      <button type="button" onClick={onRestore} className={linkButton}>Restore my changes</button>
      <button type="button" onClick={onDiscard} className={linkButton}>Discard them</button>
    </span>
  </div>
);

export default BackupNotice;
