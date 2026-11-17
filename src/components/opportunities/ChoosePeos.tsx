import { useState } from "react";
import SendToSeveralPeos from "@/components/advisor/SendToSeveralPeos";
import type { useStillNeeds } from "./useStillNeeds";

/**
 * "Choose PEOs" on the opportunity's quotes panel (D-1727): 6.7's send to several PEOs, given the submission the page has read. Clicking asks the page to read the submission
 * (it is read for the quotes anyway, or now) and opens the component once it is here.
 */
export function ChoosePeos({ needs, onChoose, returnTo, onSent, startChosen = false, alreadySent }: {
  needs: ReturnType<typeof useStillNeeds>;
  /** Asks the page to read the submission now, when it was not read for the quotes. */
  onChoose: () => void;
  returnTo: string;
  onSent: () => void;
  /** Already chosen when drawn (New quote's step 4 opens at the choosing, D-1763). */
  startChosen?: boolean;
  /** The PEOs already sent to and the day (CRM-Q3.4): marked in the choosing step. */
  alreadySent?: Readonly<Record<string, string>>;
}) {
  const [chosen, setChosen] = useState(startChosen);
  if (!chosen) {
    return (
      <button type="button" onClick={() => { setChosen(true); onChoose(); }} className="min-h-11 px-4 rounded-md border border-primary text-primary text-sm font-medium">
        Choose PEOs
      </button>
    );
  }
  if (needs.status === "failed") {
    return (
      <p role="alert" className="text-sm text-destructive">
        We couldn't read this submission, so PEOs can't be chosen yet.{" "}
        <button type="button" onClick={needs.retry} className="underline underline-offset-2">Try again</button>
      </p>
    );
  }
  const { detail, certified } = needs;
  if (certified?.cantTell) return <p role="status" className="text-sm text-muted-foreground">This certification can't say what it held, so nothing can be sent from here. Open the submission to send.</p>;
  if (!detail || !certified || !detail.submission) return null;
  return (
    <SendToSeveralPeos
      sessionId={detail.id}
      certified={certified}
      catalog={needs.catalog}
      submission={detail.submission}
      fileId={detail.fileId ?? "No File ID"}
      companyName={certified.intake.data.company_name ?? "Company not provided"}
      returnTo={returnTo}
      onSent={onSent}
      startOpen
      alreadySent={alreadySent}
      openLabel="Choose PEOs"
    />
  );
}
