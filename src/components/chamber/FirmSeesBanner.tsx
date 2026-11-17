import { useEffect, useState } from "react";
import { DRAFT_WORDING_NOTICE, firmSeesAnswersText } from "@/data/legalWording";
import { listMyIntakeFirms, type MyIntakeFirm } from "@/lib/peoAuthorizationsApi";

/**
 * What the employer reads above their own intake when a firm can see it (CRM-Q2.3, D-1880): which firm, who in it invited them, and that the firm sees their answers. The
 * database says it (`my_intake_firms`): an employer can read neither a firm nor its invitations. The wording is the one legal-wording module's, in draft (D-12).
 */
const FirmSeesBanner = ({ sessionId }: { sessionId: string }) => {
  const [seen, setSeen] = useState<MyIntakeFirm | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listMyIntakeFirms().then(
      (rows) => !cancelled && setSeen(rows.find((r) => r.id === sessionId) ?? null),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (!seen) return null;
  return (
    <div role="note" className="border-b border-border bg-muted/40 px-4 py-2 text-sm space-y-0.5">
      <p className="font-medium">{seen.invitedBy ? `You were invited by ${seen.invitedBy} of ${seen.firm}.` : `This intake is with ${seen.firm}.`}</p>
      <p className="text-muted-foreground">{firmSeesAnswersText(seen.firm)}</p>
      <p className="text-xs text-muted-foreground">{DRAFT_WORDING_NOTICE}</p>
    </div>
  );
};

export default FirmSeesBanner;
