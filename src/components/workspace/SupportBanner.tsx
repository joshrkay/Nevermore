import { useState } from "react";
import { toast } from "sonner";
import { clearMyFirms } from "@/hooks/useOwnedFirms";
import { openFirmAddress, platformFirmsUrl } from "@/lib/firmHost";
import { endSupportSession, endTime } from "@/lib/supportApi";
import { useWorkspace } from "./useWorkspace";
import { failureWords } from "@/components/workspace/form/failureWords";

/**
 * Shown on every page of the workspace while a platform admin looks at the firm on a support session (story CRM-P2.4): who they are
 * looking at, that nothing can be changed, when it ends, and how to end it now. The database refuses every change itself; this only
 * says so.
 */
const SupportBanner = () => {
  const { firm, isSupport, supportEndsAt, supportSessionId } = useWorkspace();
  const [ending, setEnding] = useState(false);
  if (!isSupport || !firm || !supportEndsAt || !supportSessionId) return null;

  const endNow = async () => {
    setEnding(true);
    try {
      await endSupportSession(supportSessionId);
      clearMyFirms();
      openFirmAddress(platformFirmsUrl());
    } catch (error) {
      toast.error(failureWords(error, "That didn't go through. Check your connection and try again."));
      setEnding(false);
    }
  };

  return (
    <div role="status" aria-label="Nevermore support" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-primary/40 bg-primary/10 px-6 py-3 text-sm">
      <p className="min-w-0 flex-1">
        <strong>Nevermore support:</strong> you are looking at {firm.name}. You can't change anything. Ends at {endTime(supportEndsAt)}.
      </p>
      <button type="button" onClick={() => void endNow()} disabled={ending} className="min-h-11 rounded-md border border-border px-4 hover:bg-muted disabled:opacity-50">
        End now
      </button>
    </div>
  );
};

/** What the page says once the hour is over: it ended, and the way back to the platform's firms page. */
export const SupportEnded = () => (
  <div role="status" className="px-6 py-12 text-center">
    <h1 className="font-display mb-3 text-2xl font-bold">The support hour has ended</h1>
    <p className="mb-4 text-muted-foreground">Nevermore support access to this firm has ended, so there is nothing more to see here. Start another from the firms page if you need to.</p>
    <a href={platformFirmsUrl()} className="text-primary underline hover:text-primary/90">Back to the firms page</a>
  </div>
);

export default SupportBanner;
