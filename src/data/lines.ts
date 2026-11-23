// A line says what is being quoted (ADR 0029; 20261126090000_lines.sql). The one place the browser knows what differs between a PEO search and a
// workers' comp search: the lines, what a quote of each holds, and the words for who it is sent to. The database holds the same lists
// (public.quote_lines, public.quote_line_areas); src/data/schemaSync.test.ts keeps the two equal. Everything else about an opportunity, a send, a reply
// and a quote is the same for every line and asks nothing here.

import { DOLLARS_MAX, EXPERIENCE_MOD_MAX } from "@/data/chamberValidation";

/** The lines, in the order a choice of them is offered. */
export const QUOTE_LINES = ["peo", "workers_comp"] as const;
export type QuoteLine = (typeof QUOTE_LINES)[number];

/** A cost area of a quote: what one row of a comparison is about. */
export type QuoteArea = "admin_fee" | "one_off_fees" | "workers_comp" | "unemployment" | "medical" | "annual_premium" | "experience_mod" | "minimum_premium";

/**
 * What a quote of each line holds: its cost areas, in the order its comparison shows them. A quote holds nothing of another line's (the database refuses
 * it), and an area a quote leaves out is "Not quoted", never 0 (D-721). The workers' comp rates and the fees are part of both.
 */
export const QUOTE_LINE_AREAS: Record<QuoteLine, readonly QuoteArea[]> = {
  peo: ["admin_fee", "one_off_fees", "workers_comp", "unemployment", "medical"],
  workers_comp: ["annual_premium", "workers_comp", "experience_mod", "minimum_premium", "one_off_fees"],
};

/** The most a workers' comp quote's annual premium or minimum premium can be, in dollars: the intake's own limit for a premium. */
export const QUOTE_PREMIUM_MAX = DOLLARS_MAX;
/** The most an experience modification can be: the intake's own limit for one. */
export const QUOTE_EXPERIENCE_MOD_MAX = EXPERIENCE_MOD_MAX;

/**
 * The line a value read from the database names. A PEO search when it names none or one this build does not know: every opportunity was a PEO search
 * before lines, and the site can be deployed before the migration that adds them is pushed.
 */
export const lineOf = (value: unknown): QuoteLine => ((QUOTE_LINES as readonly unknown[]).includes(value) ? (value as QuoteLine) : "peo");

/** What each line is called on a screen. */
export const LINE_LABELS: Record<QuoteLine, string> = { peo: "PEO", workers_comp: "Workers' comp" };

/**
 * Who a quote request of a line is sent to (glossary: Market), in the words a screen uses: a PEO for a PEO search, a carrier for a workers' comp search.
 * A PEO is never called a carrier, and a carrier never a PEO.
 */
export const MARKET_WORDS: Record<QuoteLine, { one: string; many: string; a: string; search: string }> = {
  peo: { one: "PEO", many: "PEOs", a: "a PEO", search: "PEO search" },
  workers_comp: { one: "carrier", many: "carriers", a: "a carrier", search: "workers' comp search" },
};
