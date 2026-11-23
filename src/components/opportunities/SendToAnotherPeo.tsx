import { Link, useLocation } from "react-router-dom";
import { NEW_QUOTE_PATH } from "@/components/workspace/menu";
import { MARKET_WORDS, type QuoteLine } from "@/data/lines";

/**
 * "Send to another PEO" (CRM-Q3.4, D-1890): the opportunity's way into step 4 of New quote, drawn over this page like New quote's other entries (D-1709). Step 4 is
 * the existing choosing step (D-1780); this is only the door to it, so no screen of its own is built.
 */
export function SendToAnotherPeo({ opportunityId, line = "peo" }: { opportunityId: string; /** What the opportunity is a search for: a PEO search unless said. */ line?: QuoteLine }) {
  const location = useLocation();
  return (
    <Link to={`${NEW_QUOTE_PATH}/${opportunityId}`} state={{ backgroundLocation: location }} className="inline-flex min-h-11 items-center px-4 rounded-md border border-primary text-primary text-sm font-medium">
      {`Send to another ${MARKET_WORDS[line].one}`}
    </Link>
  );
}
