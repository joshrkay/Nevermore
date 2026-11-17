import { Link, useLocation } from "react-router-dom";
import { NEW_QUOTE_PATH } from "@/components/workspace/menu";

/**
 * "Start the quote" (CRM-Q2.1, D-426, D-1763): the opportunity's way into New quote's intake step, drawn over this page like New quote's other entries (D-1709). That step
 * (`/new-quote/<id>`, OpportunitySaved) shows "Start the intake" for an opportunity with none; this is only the door to it, so no screen of its own is built. Step 1's "Save and
 * close" lands on the opportunity's page, and without this the intake step had no way in for an opportunity that has no quote yet.
 */
export function StartTheQuote({ opportunityId }: { opportunityId: string }) {
  const location = useLocation();
  return (
    <Link to={`${NEW_QUOTE_PATH}/${opportunityId}`} state={{ backgroundLocation: location }} className="inline-flex min-h-11 items-center px-4 rounded-md border border-primary bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
      Start the quote
    </Link>
  );
}
