import { useState } from "react";
import type { ChamberData } from "@/data/chamberTypes";
import { sanitizeChamberPatch } from "@/data/chamberValidation";
import type { FieldAction, FieldProvenance } from "@/data/provenance";
import { cellInput, formatCell, ROW_LISTS, type RowListField } from "@/data/rowColumns";

interface RowsFieldProps {
  field: RowListField;
  rows: ChamberData[RowListField];
  provenance?: FieldProvenance;
  /** Omit to render read-only (the demo, Review). */
  onAction?: (action: FieldAction) => void;
  /** Shown under the title while the table is empty. */
  hint?: string;
}

type Draft = Record<string, string>[];

/**
 * An answer that is a table of rows (intake schema v3): shown as a table, and edited all at once. Saving runs
 * the rows through the same sanitiser every other source does; a cell it would drop is named, and nothing is
 * saved until it is fixed or cleared.
 */
const RowsField = ({ field, rows, provenance, onAction, hint }: RowsFieldProps) => {
  const { title, columns, max } = ROW_LISTS[field];
  const [draft, setDraft] = useState<Draft | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const blank = (): Record<string, string> => Object.fromEntries(columns.map((c) => [c.key, ""]));

  const startEdit = () => {
    const current = (rows as Record<string, unknown>[]).map((row) => Object.fromEntries(columns.map((c) => [c.key, cellInput(c, row[c.key])])));
    setDraft(current.length > 0 ? current : [blank()]);
    setProblem(null);
  };

  const save = () => {
    // A row with nothing typed in it is not a row.
    const typed = draft!
      .map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value !== "")))
      .filter((row) => Object.keys(row).length > 0);
    for (const [i, row] of typed.entries()) {
      const kept = (sanitizeChamberPatch({ [field]: [row] })[field] as Record<string, unknown>[] | undefined)?.[0] ?? {};
      const dropped = columns.find((c) => c.key in row && !(c.key in kept));
      if (dropped) {
        setProblem(`Row ${i + 1}: ${dropped.label} doesn't look right. Please check it or clear it.`);
        return;
      }
    }
    onAction!({ type: "edit", field, value: typed });
    setDraft(null);
  };

  const setCell = (i: number, key: string, value: string) => setDraft((d) => d!.map((row, at) => (at === i ? { ...row, [key]: value } : row)));
  const has = rows.length > 0;

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground">{title}</h4>
        {onAction && provenance?.status === "confirmed" && has && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-success/15 text-success">
            {provenance.source.kind === "prospect_edit" ? "Confirmed by you" : "Confirmed"}
          </span>
        )}
        {onAction && provenance?.status === "inferred" && has && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border border-warning/50 text-warning">Lenore captured this — please confirm</span>
        )}
      </div>

      {draft ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  {columns.map((c) => <th key={c.key} className="font-normal pr-2 pb-1">{c.label}</th>)}
                  <th />
                </tr>
              </thead>
              <tbody>
                {draft.map((row, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td key={c.key} className="pr-2 pb-1">
                        {c.kind === "boolean" ? (
                          <select
                            aria-label={`${c.label}, row ${i + 1}`}
                            value={row[c.key]}
                            onChange={(e) => setCell(i, c.key, e.target.value)}
                            className="bg-background border border-border rounded px-2 py-1"
                          >
                            <option value="">—</option>
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        ) : (
                          <input
                            aria-label={`${c.label}, row ${i + 1}`}
                            value={row[c.key]}
                            onChange={(e) => setCell(i, c.key, e.target.value)}
                            placeholder={c.placeholder}
                            inputMode={c.kind === "fein" || c.kind === "year" || c.kind === "count" ? "numeric" : c.kind === "percent" || c.kind === "decimal" || c.kind === "dollars" || c.kind === "money" ? "decimal" : undefined}
                            className="w-full min-w-24 bg-background border border-border rounded px-2 py-1"
                          />
                        )}
                      </td>
                    ))}
                    <td className="pb-1">
                      <button type="button" aria-label={`Remove row ${i + 1}`} onClick={() => setDraft((d) => d!.filter((_, at) => at !== i))} className="text-[10px] text-muted-foreground hover:text-destructive">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {draft.length < max && (
              <button type="button" onClick={() => setDraft((d) => [...d!, blank()])} className="text-[10px] font-medium px-2 py-1 rounded border border-border hover:bg-muted">
                Add a row
              </button>
            )}
            <button type="submit" className="text-[10px] font-medium px-2 py-1 rounded bg-primary text-primary-foreground">Save</button>
            <button type="button" onClick={() => setDraft(null)} className="text-[10px] px-2 py-1 rounded text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
          {problem && <p role="alert" className="text-[10px] text-destructive">{problem}</p>}
        </form>
      ) : (
        <>
          {has ? (
            <div className="overflow-x-auto">
              <table aria-label={title} className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    {columns.map((c) => <th key={c.key} className="font-normal pr-3 pb-1">{c.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {(rows as Record<string, unknown>[]).map((row, i) => (
                    <tr key={i} className="border-t border-border/50">
                      {columns.map((c) => <td key={c.key} className="pr-3 py-1 font-medium">{formatCell(c, row[c.key])}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{hint ?? "Nothing listed yet."}</p>
          )}
          {onAction && (
            <div className="flex flex-wrap gap-2">
              {has && provenance?.status === "inferred" && (
                <button type="button" onClick={() => onAction({ type: "confirm", field })} aria-label={`Confirm ${title}`} className="text-[10px] font-medium text-success hover:underline">
                  Confirm
                </button>
              )}
              <button type="button" onClick={startEdit} aria-label={`${has ? "Edit" : "Add"} ${title}`} className="text-[10px] text-muted-foreground hover:text-foreground hover:underline">
                {has ? "Edit" : "Add"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default RowsField;
