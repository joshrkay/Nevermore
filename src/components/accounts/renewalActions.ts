import { toast } from "sonner";
import { RenewalError, undoNotRenewed, type Renewal } from "@/lib/renewalsApi";

// What a person does to a renewal without a form (story CRM-A2.4b): the words when someone else changed it first, whether Start the renewal is offered, and the undo.

export const NOT_THEIRS = "Someone else changed this renewal. It is shown as it is now.";

/** Whether Start the renewal is offered (D-449): not done, and no open opportunity works it (none, or the one that did was lost). */
export const canStart = (r: Renewal) => !r.done && (r.opportunity === null || r.opportunity.stage === "lost");

/** Undo "Didn't renew": the renewal, and the placement it came from, are back. Says what happened as a toast. */
export async function undoNotRenewedWithWords(firmId: string, renewal: Renewal): Promise<void> {
  try {
    const answer = await undoNotRenewed(firmId, renewal.id, renewal.version);
    if (answer.conflict) toast.error(NOT_THEIRS);
    else toast.success("Renewal reopened");
  } catch (e) {
    toast.error(e instanceof RenewalError ? e.message : "Couldn't reopen the renewal. Check your connection and try again.");
  }
}

