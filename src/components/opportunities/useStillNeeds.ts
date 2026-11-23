import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { findPeo } from "@/data/peoCatalog";
import { counted, lastCertifiedVersion, peoCompleteness, type NeededItem } from "@/data/peoCompleteness";
import { verifiedFieldsOf } from "@/data/advisor";
import type { QuoteLine } from "@/data/lines";
import { usePeoCatalog } from "@/hooks/usePeoCatalog";
import { loadSubmission } from "@/lib/advisorApi";

/** "Nothing", the first missing item or, for more than one, how many of what (D-424: "2 of its own questions"). */
export const stillNeedsWords = (items: readonly NeededItem[]): string => (items.length === 0 ? "Nothing" : items.length === 1 ? items[0].label : counted(items));

/**
 * What each of the quote requests' PEOs still needs, worked out in the browser by `peoCompleteness` against the last certified version, through the same reads the
 * submission's page makes for its PEO needs panel (D-424): the submission (read without opening it, so no opening is recorded in the firm's record) and the PEOs'
 * requirement profiles. `of(peo)` is the words for one PEO, matched to its profile by name ignoring case; "Not known" when the PEO has no profile or when the
 * certified version cannot say what it held. Nothing is read unless `enabled` (there are quote requests to speak for).
 */
export function useStillNeeds(firmId: string | null, submissionId: string | null, enabled: boolean, line: QuoteLine = "peo") {
  const on = enabled && submissionId !== null && firmId !== null;
  // The markets of the opportunity's own line (ADR 0029): PEOs for a PEO search, carriers for a workers' comp search.
  const catalog = usePeoCatalog(on, line);
  // Kept apart from the page's own queries: it is the submission's whole read, asked again when the window gets focus but not with every note added.
  const submission = useQuery({ queryKey: ["opportunity-needs", firmId, submissionId], queryFn: () => loadSubmission(submissionId as string, false), enabled: on, retry: false, staleTime: 30_000 });
  const retrySubmission = submission.refetch;
  const retryCatalog = catalog.retry;
  const submissionFailed = submission.isError;
  const catalogFailed = catalog.status === "failed";
  const retry = useCallback(() => {
    if (submissionFailed) void retrySubmission();
    if (catalogFailed) retryCatalog();
  }, [submissionFailed, retrySubmission, catalogFailed, retryCatalog]);

  const status: "loading" | "ready" | "failed" = !on ? "ready" : submissionFailed || catalogFailed ? "failed" : submission.data === undefined || catalog.status === "loading" ? "loading" : "ready";
  const certified = submission.data ? lastCertifiedVersion(submission.data, verifiedFieldsOf(submission.data.reviews)) : null;
  const of = (peoName: string): string => {
    if (!certified || certified.cantTell) return "Not known";
    const peo = findPeo(catalog.peos, peoName);
    if (!peo?.profile) return "Not known";
    return stillNeedsWords(peoCompleteness(certified.intake, certified.documents, peo.profile, peo.id).toQuote);
  };
  /** The mail on the quote requests' threads, read with the submission: who the product wrote to, for the close's withdrawal (D-1722). */
  const messages = submission.data?.quoteRequestMessages ?? [];
  return { status, of, retry, messages, detail: submission.data, certified, catalog: catalog.peos };
}
