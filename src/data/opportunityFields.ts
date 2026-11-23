import { z } from "zod";
import { dateRule, nameRule, wholeNumberRule } from "@/components/workspace/form/fieldRules";
import { MARKET_WORDS, QUOTE_LINES, type QuoteLine } from "@/data/lines";

// The rules of a new opportunity's own fields as the New opportunity form applies them (story CRM-A2.3, screen 25; D-438, D-439). The database asks the same rules
// (opportunity_input_error and opportunity_source_is_known, 20261120120000 and 20261120130000), so a form that takes a value is a form the database takes. The
// source list below is the one list the client keeps (D-439); schemaSync.test.ts holds it to the database's copy (`sync:begin opportunity_sources`).

/** What a source can be, in the story's order (D-439). A blank is no source. "Renewal" is also set by "Start the renewal" (CRM-A2.4). */
export const OPPORTUNITY_SOURCES = ["Referral", "Renewal", "Existing client", "Inbound", "Outbound", "Event", "Other"] as const;
export type OpportunitySource = (typeof OPPORTUNITY_SOURCES)[number];

export const OPPORTUNITY_NAME_MAX = 200;
export const OPPORTUNITY_NEXT_STEP_MAX = 2000;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * The name offered for a search from its target start (D-188, D-438): "January 2028 PEO search", or "PEO search" when no start is known. `targetStart` is a day as
 * a date field gives it ("2028-01-01"); anything that is not a day that exists is no start.
 */
export const suggestedOpportunityName = (targetStart: string, line: QuoteLine = "peo"): string => {
  // What the search is for, in the line's own words (ADR 0029): "PEO search", "workers' comp search".
  const search = MARKET_WORDS[line].search;
  const alone = search.charAt(0).toUpperCase() + search.slice(1);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(targetStart.trim());
  if (!m) return alone;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return alone;
  return `${MONTHS[month - 1]} ${year} ${search}`;
};

/**
 * The name Start the renewal offers (D-449): "January 2028 renewal" from the renewal's date. A date that is not a day that exists gives "Renewal"; the person can
 * type any name (D-438).
 */
export const suggestedRenewalName = (renewsOn: string): string => {
  const named = suggestedOpportunityName(renewsOn);
  return named === "PEO search" ? "Renewal" : named.replace(/ PEO search$/, " renewal");
};

const DOLLARS = /^\d+(\.\d{1,2})?$/;
const stripped = (v: string) => v.trim().replace(/^\$/, "").replace(/,/g, "").trim();

/** Dollars as typed ("$7,100", "7100.50") as a number; nothing for a blank or for text that is not dollars. */
export const dollarsOf = (v: string): number | null => {
  const s = stripped(v);
  return DOLLARS.test(s) ? Number(s) : null;
};

/** A value in dollars that may be left empty: digits with at most two decimals, an optional $ and commas, not negative, under a trillion. */
const valueRule = () =>
  z
    .string()
    .trim()
    .refine((v) => stripped(v) === "" || DOLLARS.test(stripped(v)), "Enter dollars, like $7,100. A value can't be negative.")
    .refine((v) => !DOLLARS.test(stripped(v)) || Number(stripped(v)) < 1_000_000_000_000, "Keep the value under a trillion dollars.");

/** The rules as the form applies them. The people and contacts chosen are ids the database checks; the source is held to the list here and there. */
export const newOpportunitySchema = z.object({
  name: nameRule("Give the opportunity a name.", OPPORTUNITY_NAME_MAX),
  target_start: dateRule(),
  employees: wholeNumberRule(),
  main_contact: z.string(),
  expected_close: dateRule(),
  value: valueRule(),
  source: z.string().refine((v) => v === "" || (OPPORTUNITY_SOURCES as readonly string[]).includes(v), "Choose a source from the list."),
  referral_partner: z.string(),
  owner: z.string(),
  next_step: z.string().trim().max(OPPORTUNITY_NEXT_STEP_MAX, "Use 2,000 characters or fewer."),
  // What is being quoted (ADR 0029): one of the lines. The form offers them and starts on a PEO search.
  line: z.string().refine((v) => (QUOTE_LINES as readonly string[]).includes(v), "Choose what is being quoted."),
});
