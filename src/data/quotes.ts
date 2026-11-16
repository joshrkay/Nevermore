import { quoteStatusLabel, today as todayDay } from "@/data/accountPage";

// The quotes table's words (story CRM-Q4.1, slice 5.11). The database says the same in quotes_words (20261123180000_quotes_table.sql), for the export.

/** A row's status as a person reads it. "Not sent yet" is a New quote left half done (D-1702): no quote request, so no status of one. */
export const quoteRowStatusWords = (status: string): string => (status === "not_sent" ? "Not sent yet" : quoteStatusLabel(status));

/** Whether a quote is past its expiry (D-1705): only a quote that is back (Quoted) has one that counts, and it moves nothing by itself; it is read as Expired. `today` is a day, YYYY-MM-DD. */
export const quoteIsExpired = (row: { status: string; expires_on: string | null }, today: string): boolean =>
  row.status === "quoted" && row.expires_on !== null && row.expires_on < today;

/** Days a quote request has waited since it was sent (the days from the day sent to `today`, both YYYY-MM-DD); only an open request waits (sent, acknowledged, question open), else null. */
export const daysWaiting = (row: { status: string; sent_on: string | null }, today: string = todayDay()): number | null => {
  if (!row.sent_on || !["sent", "acknowledged", "question_open"].includes(row.status)) return null;
  return Math.max(0, Math.round((Date.parse(today) - Date.parse(row.sent_on)) / 86_400_000));
};
