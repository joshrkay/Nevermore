// The quotes' bulk actions as the bar names them, in the story's order (CRM-Q4.1): change owner (the opportunity's), close (one reason for all). Export is the
// shared export, after them. A quote's status, figures and dates are never changed in bulk: each is recorded on its own quote.
export const QUOTE_BULK_KINDS = ["owner", "close"] as const;
export type QuoteBulkKind = (typeof QUOTE_BULK_KINDS)[number];

export const QUOTE_BULK_TITLES: Record<QuoteBulkKind, string> = {
  owner: "Change owner",
  close: "Close",
};

/** "1 quote", "42 quotes". */
export const quotesWords = (n: number): string => `${n.toLocaleString("en-US")} ${n === 1 ? "quote" : "quotes"}`;

/** "1 opportunity", "3 opportunities". */
export const opportunitiesWords = (n: number): string => `${n.toLocaleString("en-US")} ${n === 1 ? "opportunity" : "opportunities"}`;

/** "1 quote request", "3 quote requests". */
export const quoteRequestsWords = (n: number): string => `${n.toLocaleString("en-US")} ${n === 1 ? "quote request" : "quote requests"}`;
