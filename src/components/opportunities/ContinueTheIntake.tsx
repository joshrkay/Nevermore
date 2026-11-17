import { Link, useLocation } from "react-router-dom";
import { NEW_QUOTE_PATH } from "@/components/workspace/menu";

/**
 * "Continue the intake" (D-1908): the way back into an intake the firm started and the client has not signed. The intake is worked in New quote's dialog (`/new-quote/<id>`): the
 * answers the firm enters, the invitation, Remind. That dialog was opened from the opportunity's page by Start the quote, and once it was closed, or the page reloaded, nothing led back.
 * Drawn over this page like New quote's other entries (D-1709). Only the door: the dialog is the existing one.
 */
export function ContinueTheIntake({ opportunityId }: { opportunityId: string }) {
  const location = useLocation();
  return (
    <Link to={`${NEW_QUOTE_PATH}/${opportunityId}`} state={{ backgroundLocation: location }} className="inline-flex min-h-11 items-center px-4 rounded-md border border-primary bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
      Continue the intake
    </Link>
  );
}
