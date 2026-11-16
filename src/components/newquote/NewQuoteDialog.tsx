import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AccountStep } from "./AccountStep";
import { OpportunitySaved } from "./OpportunitySaved";

// New quote (story CRM-Q2.1, screen 4; D-1709, D-1763): a full-height dialog drawn over the page it was opened from. Without an opportunity it is step 1, the account;
// with one (its own address names it) step 1 is done. The intake that follows is the existing /start chamber, not a screen of this dialog.

/** What New quote closes with: the opportunity it was working on, when there is one. */
export interface NewQuoteClosed {
  opportunityId?: string;
}

export function NewQuoteDialog({ firmId, opportunityId, onClose }: { firmId: string; person: string; opportunityId?: string; onClose: (closed?: NewQuoteClosed) => void }) {
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="h-[100dvh] max-h-[100dvh] w-screen max-w-none overflow-y-auto rounded-none sm:rounded-none">
        <DialogTitle className="font-display text-xl font-bold">New quote</DialogTitle>
        <DialogDescription className="sr-only">Start a quote for a business.</DialogDescription>
        {opportunityId ? (
          <OpportunitySaved firmId={firmId} opportunityId={opportunityId} onClose={() => onClose({ opportunityId })} />
        ) : (
          <AccountStep firmId={firmId} onSaved={(done) => onClose(done)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
