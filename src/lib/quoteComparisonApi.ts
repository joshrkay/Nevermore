import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lineOf, QUOTE_LINE_AREAS, type QuoteArea, type QuoteLine } from "@/data/lines";
import type { QuoteAdminFeeBasis, QuoteKind } from "@/data/quoteRequests";
import { OpportunityError } from "@/lib/opportunityPageApi";

// The comparison of an opportunity's quotes and the notes on it (N-3.1, N-3.2, slice 7.7; 20261125110000_quote_comparison.sql). One read, `opportunity_quote_comparison`,
// answers one column for each PEO (or, on a workers' comp search, each carrier: ADR 0029) with its current quote; a cost area a quote leaves out is null, never an
// empty list or 0 (D-721), and stays null here. The comparison says its opportunity's line, and the screen draws that line's areas (QUOTE_LINE_AREAS).

export interface OneOffFee { name: string; amount: number }
export interface WorkersCompRate { state: string; classCode: string; rate: number }
export interface UnemploymentLine { state: string; charge: "employer_rate" | "peo_rate"; rate?: number }
export interface MedicalRate { plan: string; tier: string; monthly: number }

/** A PEO's current quote: the newest row of its quote request (D-720). */
export interface ComparedQuote {
  id: number;
  kind: QuoteKind;
  receivedOn: string | null;
  expiresOn: string | null;
  proposedStartOn: string | null;
  adminFee: number | null;
  adminFeeBasis: QuoteAdminFeeBasis | null;
  oneOffFees: OneOffFee[] | null;
  workersComp: WorkersCompRate[] | null;
  unemployment: UnemploymentLine[] | null;
  medical: MedicalRate[] | null;
  note: string | null;
  /** A workers' comp quote's figures (ADR 0029): the estimated annual premium and the minimum premium in dollars, and the experience modification applied. */
  annualPremium: number | null;
  experienceMod: number | null;
  minimumPremium: number | null;
}

export interface ComparisonColumn { quoteRequestId: number; peoName: string; status: string; quote: ComparedQuote | null }

/** What a note can be about: one of the cost areas of the comparison's own line (the database refuses any other). */
export type ComparisonArea = QuoteArea;
/** Every area any line's quote holds, for reading a note's area whatever the comparison's line. */
const EVERY_AREA = [...new Set(Object.values(QUOTE_LINE_AREAS).flat())] as [QuoteArea, ...QuoteArea[]];

export interface ComparisonNote {
  id: number;
  quoteRequestId: number | null;
  area: ComparisonArea | null;
  visibility: "internal" | "client";
  body: string;
  author: string | null;
  createdAt: string;
}

export interface QuoteComparison {
  /** What the opportunity is a search for: a PEO search when the answer names no line (a database that has no lines yet). */
  line: QuoteLine;
  canAdd: boolean;
  columns: ComparisonColumn[];
  notes: ComparisonNote[];
}

// The app is not compiled with strict null checks, so zod infers each key of an object as optional; the shapes below require each one, and the casts say so.
const text = z.string().nullable();
const quoteShape = z.object({
  id: z.number().int(), kind: z.enum(["estimate", "firm_offer"]), received_on: text, expires_on: text, proposed_start_on: text,
  admin_fee: z.number().nullable(), admin_fee_basis: z.enum(["per_employee_per_month", "percent_of_payroll"]).nullable(),
  one_off_fees: z.array(z.object({ name: z.string(), amount: z.number() })).nullable(),
  workers_comp: z.array(z.object({ state: z.string(), class_code: z.string(), rate: z.number() })).nullable(),
  unemployment: z.array(z.object({ state: z.string(), charge: z.enum(["employer_rate", "peo_rate"]), rate: z.number().optional() })).nullable(),
  medical: z.array(z.object({ plan: z.string(), tier: z.string(), monthly: z.number() })).nullable(),
  note: text,
  // Missing in an answer from a database that has no lines yet: read as left out.
  annual_premium: z.number().nullish(), experience_mod: z.number().nullish(), minimum_premium: z.number().nullish(),
});
const answerShape = z.object({
  line: z.string().nullish(),
  can_add: z.boolean(),
  columns: z.array(z.object({ quote_request_id: z.number().int(), peo_name: z.string(), status: z.string(), quote: quoteShape.nullable() })),
  notes: z.array(z.object({
    id: z.number().int(), quote_request_id: z.number().int().nullable(), area: z.enum(EVERY_AREA).nullable(), visibility: z.enum(["internal", "client"]),
    body: z.string(), author: text, created_at: z.string(),
  })),
});

const FALLBACK = "Couldn't load the comparison. Try again.";

/** A refusal in the screen's shape: the database's one answer for an opportunity that isn't there or isn't theirs is `notFound`. */
function refusal(error: { code?: string; message?: string }): Error {
  if (error.code === "PT404") return new OpportunityError("notFound", "That opportunity isn't available.", error.code);
  if (error.code === "PT423" || error.code === "55000") return new OpportunityError("readOnly", error.message || "This can't be changed right now.", error.code);
  if (error.code === "22023") return new OpportunityError("invalid", error.message || FALLBACK, error.code);
  return new OpportunityError("failed", FALLBACK, error.code);
}

export interface NewComparisonNote { quoteRequestId: number | null; area: ComparisonArea | null; visibility: "internal" | "client"; body: string }

/** Adds a note to the comparison (N-3.2): about a PEO's column, and within it a cost area, or about the whole comparison; marked internal or for the client. */
export async function addComparisonNote(firmId: string, opportunityId: string, note: NewComparisonNote): Promise<void> {
  const { error } = await supabase.rpc("add_comparison_note", {
    p_firm_id: firmId, p_opportunity_id: opportunityId, p_quote_request_id: note.quoteRequestId, p_area: note.area, p_visibility: note.visibility, p_body: note.body,
  });
  if (error) throw refusal(error);
}

export async function getQuoteComparison(firmId: string, opportunityId: string): Promise<QuoteComparison> {
  const { data, error } = await supabase.rpc("opportunity_quote_comparison", { p_firm_id: firmId, p_opportunity_id: opportunityId });
  if (error) throw refusal(error);
  const parsed = answerShape.safeParse(data);
  if (!parsed.success) throw new OpportunityError("failed", FALLBACK);
  const a = parsed.data;
  return {
    line: lineOf(a.line),
    canAdd: a.can_add,
    columns: a.columns.map((c) => ({
      quoteRequestId: c.quote_request_id, peoName: c.peo_name, status: c.status,
      quote: c.quote && {
        id: c.quote.id, kind: c.quote.kind, receivedOn: c.quote.received_on, expiresOn: c.quote.expires_on, proposedStartOn: c.quote.proposed_start_on,
        adminFee: c.quote.admin_fee, adminFeeBasis: c.quote.admin_fee_basis, oneOffFees: c.quote.one_off_fees as OneOffFee[] | null,
        workersComp: c.quote.workers_comp && c.quote.workers_comp.map((w) => ({ state: w.state as string, classCode: w.class_code as string, rate: w.rate as number })),
        unemployment: c.quote.unemployment as UnemploymentLine[] | null, medical: c.quote.medical as MedicalRate[] | null, note: c.quote.note,
        annualPremium: c.quote.annual_premium ?? null, experienceMod: c.quote.experience_mod ?? null, minimumPremium: c.quote.minimum_premium ?? null,
      },
    })),
    notes: a.notes.map((n) => ({ id: n.id, quoteRequestId: n.quote_request_id, area: n.area, visibility: n.visibility, body: n.body, author: n.author, createdAt: n.created_at })),
  };
}
