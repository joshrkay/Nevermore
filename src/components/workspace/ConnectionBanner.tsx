import { WifiOff } from "lucide-react";
import { useOnline } from "./useOnline";

/**
 * Shown on every page of the workspace while the browser has no connection (CRM-S2.4a, D-182): what is on screen stays readable but may be out of
 * date, and nothing can be saved. The live region is on the page from the first draw and only its words come and go, so the words are announced
 * once, when the connection goes, and not again by a poll or a second offline event; it says nothing when the connection is back (the banner just
 * goes, and the lists ask again by themselves). It does not stop anything: the database refuses a save it cannot receive, and each form says why its
 * Save is not usable.
 */
const ConnectionBanner = () => {
  const online = useOnline();
  return (
    <div role="status" aria-label="Connection">
      {!online && (
        <p className="flex items-center gap-2 border-b border-border bg-muted px-6 py-3 text-sm">
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span><strong>You're offline.</strong> What's on screen may be out of date, and nothing can be saved until you're back online.</span>
        </p>
      )}
    </div>
  );
};

export default ConnectionBanner;
