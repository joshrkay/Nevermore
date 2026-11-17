// What the model proposes from a quote document (N-2.3), shaped to what record_quote takes and held to the same checks the database applies. The model's answer is
// untrusted: anything outside the fixed shape is dropped, and a figure it did not find is left out, never 0 (D-721). No remote imports, so it runs under Deno and Vitest alike.

/** The figures proposed, in the shape of src/lib/advisorApi.ts's QuoteOffer. A key that is absent was not found in the document. */
export interface QuoteDraft {
  kind?: "estimate" | "firm_offer";
  receivedOn?: string;
  expiresOn?: string;
  startOn?: string;
  /** The fee and its basis come together (D-723). */
  adminFee?: number;
  adminFeeBasis?: "per_employee_per_month" | "percent_of_payroll";
  oneOffFees?: { name: string; amount: number }[];
  workersComp?: { state: string; class_code: string; rate: number }[];
  unemployment?: UnemploymentLine[];
  medical?: { plan: string; tier: (typeof TIERS)[number]; monthly: number }[];
}

/** QUOTE_TIERS in src/data/quoteRequests.ts. */
const TIERS = ["employee_only", "employee_spouse", "employee_children", "family"] as const;

type UnemploymentLine = { state: string; charge: "employer_rate" } | { state: string; charge: "peo_rate"; rate: number };

/** A figure that carries its page: the fee and its basis are one figure. */
export type FigureKey = Exclude<keyof QuoteDraft, "adminFeeBasis">;

export interface QuoteProposal {
  draft: QuoteDraft;
  /** For each proposed figure, the section of the document it was read on ("Page 2"). */
  sources: Partial<Record<FigureKey, string>>;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function realDate(v: unknown): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : v;
}

/** The 50 states, DC and the five inhabited territories: is_us_state_code's list (20261027090000_intake_validation_and_versioning.sql). */
const STATES = new Set(
  "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC AS GU MP PR VI".split(" "),
);
const stateOf = (v: unknown): string | null => {
  const code = typeof v === "string" ? v.trim().toUpperCase() : "";
  return STATES.has(code) ? code : null;
};
const num =(v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const text = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim().length >= 1 && v.trim().length <= max ? v.trim() : null);

/** The lines of a cost area the database would accept, each cleaned to its fixed keys, a repeated line (by `keyOf`) dropped; an area with no line left is left out (null), never an empty list (D-721). */
function lines<T>(v: unknown, max: number, line: (e: Record<string, unknown>) => T | null, keyOf: (t: T) => string): T[] | null {
  if (!Array.isArray(v)) return null;
  const seen = new Set<string>();
  const kept: T[] = [];
  for (const e of v) {
    const t = isObject(e) ? line(e) : null;
    if (t === null || seen.has(keyOf(t)) || kept.length >= max) continue;
    seen.add(keyOf(t));
    kept.push(t);
  }
  return kept.length > 0 ? kept : null;
}

export function shapeQuoteProposal(args: unknown, sections: readonly string[]): QuoteProposal {
  const draft: QuoteDraft = {};
  const sources: QuoteProposal["sources"] = {};
  if (!isObject(args)) return { draft, sources };
  // The model cites a section by its number (buildPromptText's [[Section N]]); a label the document has is accepted too. Any other citation names no page.
  const sourceOf = (entry: Record<string, unknown>) => {
    if (typeof entry.source === "number") return Number.isInteger(entry.source) ? sections[entry.source - 1] ?? null : null;
    return typeof entry.source === "string" && sections.includes(entry.source) ? entry.source : null;
  };
  // One figure: its value is parsed by the rule for its field, and kept (with its page) only when it passes.
  const take = (name: string, key: FigureKey, parse: (v: unknown) => QuoteDraft | null) => {
    const entry = args[name];
    const part = isObject(entry) ? parse(entry.value) : null;
    if (!isObject(entry) || part === null) return;
    Object.assign(draft, part);
    const source = sourceOf(entry);
    if (source) sources[key] = source;
  };
  const date = (key: "receivedOn" | "expiresOn" | "startOn") => (v: unknown) => { const d = realDate(v); return d === null ? null : { [key]: d }; };
  take("kind", "kind", (v) => (v === "estimate" || v === "firm_offer" ? { kind: v } : null));
  take("received_on", "receivedOn", date("receivedOn"));
  take("expires_on", "expiresOn", date("expiresOn"));
  take("start_on", "startOn", date("startOn"));
  take("admin_fee", "adminFee", (v) => {
    if (!isObject(v) || typeof v.amount !== "number" || !Number.isFinite(v.amount)) return null;
    if (v.basis !== "per_employee_per_month" && v.basis !== "percent_of_payroll") return null;
    if (v.amount < 0 || v.amount > (v.basis === "percent_of_payroll" ? 100 : 100000)) return null;
    return { adminFee: v.amount, adminFeeBasis: v.basis };
  });
  take("one_off_fees", "oneOffFees", (v) => {
    const oneOffFees = lines(v, 20, (e) => {
      const name = text(e.name, 80);
      return name !== null && num(e.amount, 0, 10_000_000) ? { name, amount: e.amount } : null;
    }, (f) => f.name.toLowerCase());
    return oneOffFees && { oneOffFees };
  });
  take("workers_comp", "workersComp", (v) => {
    const workersComp = lines(v, 200, (e) => {
      const state = stateOf(e.state);
      return state !== null && typeof e.class_code === "string" && /^[0-9A-Za-z-]{1,10}$/.test(e.class_code) && num(e.rate, 0, 1000)
        ? { state, class_code: e.class_code, rate: e.rate }
        : null;
    }, (l) => `${l.state}|${l.class_code.toLowerCase()}`);
    return workersComp && { workersComp };
  });
  take("unemployment", "unemployment", (v) => {
    const unemployment = lines<UnemploymentLine>(v, 51, (e) => {
      const state = stateOf(e.state);
      if (state === null) return null;
      if (e.charge === "employer_rate") return { state, charge: "employer_rate" };
      return e.charge === "peo_rate" && num(e.rate, 0, 100) ? { state, charge: "peo_rate", rate: e.rate } : null;
    }, (l) => l.state);
    return unemployment && { unemployment };
  });
  take("medical", "medical", (v) => {
    const medical = lines(v, 200, (e) => {
      const plan = text(e.plan, 80);
      const tier = TIERS.find((t) => t === e.tier);
      return plan !== null && tier !== undefined && num(e.monthly, 0, 100_000) ? { plan, tier, monthly: e.monthly } : null;
    }, (l) => `${l.plan.toLowerCase()}|${l.tier}`);
    return medical && { medical };
  });
  return { draft, sources };
}
