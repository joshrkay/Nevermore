import { supabase } from "@/integrations/supabase/client";
import { loadSubmission, type QuoteRequestRow, type SubmissionDetail } from "@/lib/advisorApi";
import { getOpportunityOfSubmission, getOpportunityPage, type OpportunityPage } from "@/lib/opportunityPageApi";

/** A quote's page (CRM-Q3.2, D-185): the quote request, its submission with every thread, and its opportunity's page (the account for the trail, the figures). */
export interface QuotePage {
  request: QuoteRequestRow;
  detail: SubmissionDetail;
  opportunity: OpportunityPage;
}

/** The quote request, read through the reads that already exist. Null for one the person cannot read. */
export async function getQuotePage(firmId: string, quoteRequestId: string): Promise<QuotePage | null> {
  // A quote request's number is a whole number from 1 (fifteen digits at most, which a browser holds exactly): anything else is not one.
  if (!/^[1-9]\d{0,14}$/.test(quoteRequestId)) return null;
  const row = await supabase.from("quote_requests").select("session_id").eq("id", Number(quoteRequestId)).maybeSingle();
  const sessionId = row.data?.session_id;
  if (!sessionId) return null;
  const found = await getOpportunityOfSubmission(sessionId);
  if (!found) return null;
  const [opportunity, detail] = await Promise.all([getOpportunityPage(firmId, found.id), loadSubmission(sessionId, false)]);
  const request = detail?.quoteRequests.find((q) => q.id === Number(quoteRequestId));
  return detail && opportunity && request ? { request, detail, opportunity } : null;
}
