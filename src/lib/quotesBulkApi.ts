import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { WithdrawalReason } from "@/data/quoteRequests";
import { BulkChangeError, refusal, type BulkSelection } from "@/lib/bulkChangeApi";

// What a bulk change to quotes asks the database (story CRM-Q4.1, slice 5.11; 20261123180000_quotes_table.sql). The database decides every rule, as it does for
// accounts and leads (bulkChangeApi.ts, whose refusals these share): the selection, the 1,000 cap, the level rule on the opportunity's owner, a won or lost
// opportunity, an archived account, a closing firm and Nevermore support. A quote's status, figures and dates are recorded on its own quote, never in bulk.

/** What a bulk change of quotes does: change the owner of each row's opportunity, or close each row's quote request with one reason (M-2.4's four). */
export type QuoteBulkAction = { action: "owner"; ownerId: string } | { action: "close"; reason: QuoteCloseReason };

// The reasons a PEO is withdrawn are the reasons a quote request closes (D-1801): one list, WITHDRAWAL_REASONS, which schemaSync.test.ts compares with the database.
export type QuoteCloseReason = WithdrawalReason;

/** What a change did. `skipped` are the rows the person may see and not change, named with the reason; `unavailable` the keys that were no row they may see. */
export interface QuoteBulkOutcome {
  selected: number;
  requested: number;
  unavailable: number;
  changed: number;
  unchanged: number;
  skipped: { key: string; name: string | null; code: string; reason: string }[];
}

const count = z.number().int().min(0);
const outcomeSchema = z.object({
  selected: count, requested: count, unavailable: count, changed: count, unchanged: count,
  skipped: z.array(z.object({ key: z.string(), name: z.string().nullable(), code: z.string(), reason: z.string() })),
});

const params = (change: QuoteBulkAction): Json => (change.action === "owner" ? { owner_id: change.ownerId } : { reason: change.reason });

/** Makes the change to the quotes the person may change; the others come back named in `skipped`. Over the limit it throws `tooMany`. */
export async function applyQuotesBulk(firmId: string, change: QuoteBulkAction, selected: BulkSelection): Promise<QuoteBulkOutcome> {
  const { data, error } = await supabase.rpc("bulk_quotes_change", {
    p_firm_id: firmId,
    p_action: change.action,
    p_params: params(change),
    p_filters: "filters" in selected ? (selected.filters as unknown as Json) : null,
    p_ids: "ids" in selected ? selected.ids : null,
  });
  if (error) throw refusal(error, "Couldn't make that change. Try again.");
  const parsed = outcomeSchema.safeParse(data);
  if (!parsed.success) throw new BulkChangeError("failed", "Couldn't make that change. Try again.");
  return parsed.data as QuoteBulkOutcome;
}
