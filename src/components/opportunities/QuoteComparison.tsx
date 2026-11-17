import { useState } from "react";
import { EmptyLine, ListPanel } from "@/components/accounts/accountLists";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { quoteKindLabel } from "@/data/quoteRequests";
import { formatDay, quoteStatusLabel, today } from "@/data/accountPage";
import { COMPARISON_AREAS, type ComparisonArea, ComparisonColumn, ComparisonNote, NewComparisonNote, QuoteComparison as Comparison } from "@/lib/quoteComparisonApi";

// The broker's comparison of an opportunity's quotes (N-3.1, slice 7.7): one column for each PEO, one row for each cost area, the same rows for every PEO.

/** What a quote leaves out reads this, never 0 or blank (D-721). */
const NOT_QUOTED = <span className="text-muted-foreground">Not quoted</span>;

const dollars = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** The administrative fee with the basis it is charged on (D-723). A waived fee is a real 0. */
const feeWords = (fee: number, basis: string | null) => (basis === "percent_of_payroll" ? `${fee}% of payroll` : `${dollars(fee)} per employee per month`);

const TIER_WORDS: Record<string, string> = { employee_only: "employee only", employee_spouse: "employee and spouse", employee_children: "employee and children", family: "family" };

/** A list of lines in one cell, or Not quoted when the quote leaves the area out (null, never an empty list). */
const lines = <T,>(items: T[] | null | undefined, words: (item: T) => string) =>
  items ? <ul className="space-y-1">{items.map((item) => <li key={words(item)}>{words(item)}</li>)}</ul> : NOT_QUOTED;

const AREA_WORDS: Record<ComparisonArea, string> = {
  admin_fee: "administrative fee", one_off_fees: "one-off fees", workers_comp: "workers' comp", unemployment: "unemployment tax", medical: "medical",
};

const AREA_LABELS: Record<ComparisonArea, string> = {
  admin_fee: "Administrative fee", one_off_fees: "One-off fees", workers_comp: "Workers' comp", unemployment: "Unemployment tax", medical: "Medical",
};

/** What a note is about: a PEO, and within it a cost area, or the comparison as a whole. */
const aboutWords = (n: ComparisonNote, columns: ComparisonColumn[]) => {
  const peo = columns.find((c) => c.quoteRequestId === n.quoteRequestId)?.peoName;
  return [peo ?? (n.area ? null : "The comparison"), n.area ? AREA_WORDS[n.area] : null].filter(Boolean).join(", ");
};

type Row = { label: string; cell: (c: ComparisonColumn) => React.ReactNode };

const ROWS: Row[] = [
  { label: "Status", cell: (c) => (c.quote ? quoteKindLabel(c.quote.kind) : quoteStatusLabel(c.status)) },
  {
    label: "Expires",
    cell: (c) => {
      if (!c.quote) return <span className="text-muted-foreground">Not yet quoted</span>;
      if (!c.quote.expiresOn) return <span className="text-muted-foreground">Not given</span>;
      // An expired quote is marked so it is not compared as if it still stood.
      return c.quote.expiresOn < today() ? <span className="font-medium text-destructive">Expired {formatDay(c.quote.expiresOn)}</span> : formatDay(c.quote.expiresOn);
    },
  },
  { label: "Administrative fee", cell: (c) => (c.quote?.adminFee != null ? feeWords(c.quote.adminFee, c.quote.adminFeeBasis) : NOT_QUOTED) },
  { label: "One-off fees", cell: (c) => lines(c.quote?.oneOffFees, (f) => `${f.name}: ${dollars(f.amount)}`) },
  { label: "Workers' comp", cell: (c) => lines(c.quote?.workersComp, (w) => `${w.state} ${w.classCode}: ${dollars(w.rate)} per $100 of payroll`) },
  {
    label: "Unemployment tax",
    cell: (c) => lines(c.quote?.unemployment, (u) => (u.charge === "peo_rate" ? `${u.state}: the PEO's rate, ${u.rate}% of taxable wages` : `${u.state}: the employer's own rate`)),
  },
  { label: "Medical", cell: (c) => lines(c.quote?.medical, (m) => `${m.plan}, ${TIER_WORDS[m.tier] ?? m.tier}: ${dollars(m.monthly)} a month`) },
];

/** The form for a note (N-3.2). Internal unless the broker marks it for the client. */
function NoteForm({ columns, onAddNote }: { columns: ComparisonColumn[]; onAddNote: (note: NewComparisonNote) => Promise<void> }) {
  const [body, setBody] = useState("");
  const [peo, setPeo] = useState<number | null>(null);
  const [area, setArea] = useState<ComparisonArea | null>(null);
  const [visibility, setVisibility] = useState<"internal" | "client">("internal");
  const [refused, setRefused] = useState<string | null>(null);
  const select = "block w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm";
  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        setRefused(null);
        onAddNote({ quoteRequestId: peo, area, visibility, body: body.trim() }).then(
          () => setBody(""),
          (err: unknown) => setRefused(err instanceof Error ? err.message : "The note couldn't be added. Try again."),
        );
      }}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label htmlFor="comparison-note-peo" className="block text-xs text-muted-foreground">About</label>
          <select id="comparison-note-peo" className={select} value={peo ?? ""} onChange={(e) => setPeo(e.target.value === "" ? null : Number(e.target.value))}>
            <option value="">The whole comparison</option>
            {columns.map((c) => <option key={c.quoteRequestId} value={c.quoteRequestId}>{c.peoName}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="comparison-note-area" className="block text-xs text-muted-foreground">Cost area</label>
          <select id="comparison-note-area" className={select} value={area ?? ""} onChange={(e) => setArea(e.target.value === "" ? null : (e.target.value as ComparisonArea))}>
            <option value="">No particular area</option>
            {COMPARISON_AREAS.map((a) => <option key={a} value={a}>{AREA_LABELS[a]}</option>)}
          </select>
        </div>
      </div>
      <fieldset className="flex gap-4 text-sm">
        <legend className="sr-only">Who may read it</legend>
        <label className="flex items-center gap-1.5"><input type="radio" name="comparison-note-visibility" checked={visibility === "internal"} onChange={() => setVisibility("internal")} />Internal</label>
        <label className="flex items-center gap-1.5"><input type="radio" name="comparison-note-visibility" checked={visibility === "client"} onChange={() => setVisibility("client")} />For the client</label>
      </fieldset>
      <label htmlFor="comparison-note" className="block text-xs text-muted-foreground">Note</label>
      <Textarea id="comparison-note" value={body} rows={3} maxLength={2000} onChange={(e) => setBody(e.target.value)} />
      {refused && <p role="alert" className="text-sm text-destructive">{refused}</p>}
      <Button type="submit" disabled={body.trim() === ""}>Add note</Button>
    </form>
  );
}

export function QuoteComparison({ comparison, onAddNote, noNotesBecause }: {
  comparison: Comparison;
  onAddNote: (note: NewComparisonNote) => Promise<void>;
  /** Why no note can be added when the account itself takes notes (a Nevermore support session changes nothing, ADR 0024); said in place of the form. */
  noNotesBecause?: string;
}) {
  return (
    <ListPanel id="quote-comparison" heading="Compare quotes">
      {comparison.columns.length === 0 ? (
        <EmptyLine>No quotes to compare yet. Quotes appear here once the opportunity is sent to a PEO.</EmptyLine>
      ) : (
      <>
        {comparison.columns.every((c) => c.quote === null) && <p className="mb-3 text-sm text-muted-foreground">No quotes are back yet.</p>}
        {comparison.columns.filter((c) => c.quote !== null).length === 1 && <p className="mb-3 text-sm text-muted-foreground">Only one quote is back, so there is nothing to compare it with yet.</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <caption className="sr-only">Quotes side by side</caption>
          <thead>
            <tr>
              <th scope="col" className="py-2 pr-4 text-left text-xs font-normal text-muted-foreground">Cost area</th>
              {comparison.columns.map((c) => <th key={c.quoteRequestId} scope="col" className="py-2 pr-4 text-left font-medium">{c.peoName}</th>)}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label} className="border-t border-border/60 align-top">
                <th scope="row" className="py-2 pr-4 text-left font-normal text-muted-foreground">{row.label}</th>
                {comparison.columns.map((c) => <td key={c.quoteRequestId} className="py-2 pr-4">{row.cell(c)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>
      )}
      <section aria-labelledby="comparison-notes" className="mt-5">
        <h3 id="comparison-notes" className="mb-2 text-sm font-medium">Notes</h3>
        <ul className="space-y-2 text-sm">
          {comparison.notes.map((n) => (
            <li key={n.id} className="rounded-md border border-border/60 p-3">
              <p>{n.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {n.visibility === "client" ? "For the client" : "Internal"} · {aboutWords(n, comparison.columns)}{n.author ? ` · ${n.author}` : ""}
              </p>
            </li>
          ))}
        </ul>
        {comparison.canAdd && !noNotesBecause ? (
          <NoteForm columns={comparison.columns} onAddNote={onAddNote} />
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{noNotesBecause ?? "This account is archived, so notes can't be added."}</p>
        )}
      </section>
    </ListPanel>
  );
}
