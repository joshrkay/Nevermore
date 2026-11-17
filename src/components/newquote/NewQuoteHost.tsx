import { useQueryClient } from "@tanstack/react-query";
import { opportunityPath } from "@/components/accounts/accountColumns";
import { opportunityKey } from "@/components/opportunities/useOpportunityQueries";
import { NEW_QUOTE_PATH } from "@/components/workspace/menu";
import { useWorkspace } from "@/components/workspace/useWorkspace";
import { NewQuoteDialog } from "./NewQuoteDialog";
import { backgroundOf, useRealLocation } from "./BackgroundRoutes";
import { useNavigate } from "react-router-dom";

// Draws New quote when the browser's address is its own (D-1709). It sits in the workspace shell, beside the page, so it has the firm; the page beneath is whatever
// the routes were matched with (BackgroundRoutes).

/** Where New quote goes when it closes with no page beneath it and no opportunity made: the Quotes queue, where a half-done quote is listed (D-1702). */
const QUEUE_PATH = "/advisor";

/** The opportunity the address names, `null` for step 1's own address, `undefined` when the address is not New quote's. */
const opportunityOf = (pathname: string): string | null | undefined => {
  if (pathname === NEW_QUOTE_PATH) return null;
  return pathname.startsWith(`${NEW_QUOTE_PATH}/`) ? decodeURIComponent(pathname.slice(NEW_QUOTE_PATH.length + 1)) : undefined;
};

export function NewQuoteHost() {
  const real = useRealLocation();
  const { pathname } = real;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { firm, person } = useWorkspace();
  const opportunity = opportunityOf(pathname);
  if (opportunity === undefined || !firm) return null;
  return <NewQuoteDialog firmId={firm.id} person={person} opportunityId={opportunity ?? undefined} onClose={(closed) => {
    // The dialog reads the opportunity under its own query keys, so what it did to it (an intake started, PEOs chosen) isn't on the page beneath until that page asks again: closed without a reload,
    // the opportunity's page would still say "No intake yet" and offer Start the quote. The opportunity is the one step 1 made, else the one the address names.
    const touched = closed?.opportunityId ?? opportunity;
    if (touched) void queryClient.invalidateQueries({ queryKey: opportunityKey(firm.id, touched) });
    const back = backgroundOf(real);
    if (back) navigate(back, { replace: true });
    else navigate(closed?.opportunityId ? opportunityPath(closed.opportunityId) : QUEUE_PATH, { replace: true });
  }} />;
}
