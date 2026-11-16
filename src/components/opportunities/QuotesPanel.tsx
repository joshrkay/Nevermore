import { Link } from "react-router-dom";
import { EmptyLine, ListPanel, Pill, Rows, type Column } from "@/components/accounts/accountLists";
import { quotePath } from "@/components/accounts/accountColumns";
import { PanelFailed, PlaceholderLine } from "@/components/workspace/states";
import { formatDay, quoteStatusLabel, today } from "@/data/accountPage";
import { quoteCloseWords } from "@/data/opportunityClose";
import { adminFeeWords, quoteStatusWords } from "@/data/opportunityPage";
import type { OpportunityPage, OpportunityQuote } from "@/lib/opportunityPageApi";
import type { useStillNeeds } from "./useStillNeeds";

// The quotes panel (screen 19, D-424): one row per quote request of the opportunity's intake. Each PEO opens the quote's own page (CRM-Q3.2, D-1796)
// The Emails column, Compare and Send to another PEO are off (D-402). What a PEO still needs loads as the panel's own read, not inside the
// opportunity's page, which stays a summary; a failure of it keeps the rows and says so with its own Try again.

const muted = (words: string) => <span className="text-muted-foreground">{words}</span>;
const notYet = muted("Not yet");
const linkClass = "text-primary underline underline-offset-2 hover:text-primary/90";

export function QuotesPanel({ page, needs, action, closeReasons = {} }: {
  page: OpportunityPage;
  /** The page's one read of the submission (D-1726). */
  needs: ReturnType<typeof useStillNeeds>;
  /** What sits beside the heading: Choose PEOs (D-1727). */
  action?: React.ReactNode;
  /** By quote request id: why a closed quote closed (D-424, CRM-O1.3b). Empty until it is read. */
  closeReasons?: Readonly<Record<number, string | null>>;
}) {
  const { quotes, intake } = page;
  const day = today();
  const columns: Column<OpportunityQuote>[] = [
    { header: "PEO", cell: (q) => <Link to={quotePath(q.id)} className={linkClass}>{q.peoName}</Link> },
    {
      header: "Status",
      cell: (q) => {
        const why = q.status === "closed" ? quoteCloseWords(closeReasons[q.id] ?? null) : null;
        return <><Pill>{quoteStatusWords(q.status, quoteStatusLabel(q.status), q.sentOn, day)}</Pill>{why && <span className="ml-2 text-xs text-muted-foreground">{why}</span>}</>;
      },
    },
    { header: "Sent", cell: (q) => (q.sentOn ? formatDay(q.sentOn) : notYet), className: "whitespace-nowrap" },
    { header: "Admin fee", cell: (q) => (q.adminFeePepm !== null ? adminFeeWords(q.adminFeePepm) : notYet) },
    { header: "Expires", cell: (q) => (q.quoteExpiresOn ? formatDay(q.quoteExpiresOn) : notYet), className: "whitespace-nowrap" },
    {
      header: "Still needs",
      cell: (q) => (needs.status === "loading" ? <PlaceholderLine width="name" /> : needs.status === "failed" ? muted("Not checked") : needs.of(q.peoName)),
    },
  ];
  return (
    <ListPanel id="opportunity-quotes" heading="Quotes" count={quotes.length} seeAll={action}>
      {quotes.length === 0 ? (
        <EmptyLine>{intake ? "No quotes yet. Quotes appear when the opportunity is sent to a PEO." : "No quotes yet."}</EmptyLine>
      ) : (
        <>
          <Rows caption="The opportunity's quote requests" columns={columns} rows={quotes} rowKey={(q) => String(q.id)} />
          {needs.status === "failed" && <PanelFailed what="what each PEO still needs" message="We couldn't check what each PEO still needs." onRetry={needs.retry} className="mt-3 text-sm space-y-1" />}
        </>
      )}
    </ListPanel>
  );
}
