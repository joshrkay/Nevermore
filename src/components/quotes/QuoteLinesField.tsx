const inputClass = "w-full bg-muted border border-border rounded-md px-3 py-2 text-sm";

/** One column of a cost area's lines: a text or number box, or a choice. */
export interface LineColumn {
  key: string;
  label: string;
  type?: "text" | "number";
  /** A choice instead of a box: value and words. */
  options?: readonly { value: string; label: string }[];
  /** Shown only for the lines where this is true (an unemployment line's percent is only for the PEO's rate). */
  when?: (line: Record<string, string>) => boolean;
}

/**
 * The lines of one cost area of a quote (N-2.1): a line is added with the button and each box is labelled with its line's number. A cost area with no lines is "Not quoted"
 * (D-721), so nothing is drawn but the button until a line is added.
 */
export function QuoteLinesField({ title, noun, columns, lines, onChange }: {
  title: string;
  /** "one-off fee": the add button reads "Add a one-off fee", each box "One-off fee 1 name". */
  noun: string;
  columns: readonly LineColumn[];
  lines: readonly Record<string, string>[];
  onChange: (lines: Record<string, string>[]) => void;
}) {
  const heading = noun.charAt(0).toUpperCase() + noun.slice(1);
  const set = (at: number, key: string, value: string) => onChange(lines.map((l, i) => (i === at ? { ...l, [key]: value } : l)));
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs text-muted-foreground">{title}</legend>
      {lines.length === 0 && <p className="text-xs text-muted-foreground">Not quoted</p>}
      {lines.map((line, at) => (
        <div key={at} className="flex flex-wrap items-end gap-2">
          {columns.filter((c) => !c.when || c.when(line)).map((c) => {
            const label = `${heading} ${at + 1} ${c.label.toLowerCase()}`;
            return c.options ? (
              <select key={c.key} aria-label={label} value={line[c.key] ?? ""} onChange={(e) => set(at, c.key, e.target.value)} className={`${inputClass} w-auto`}>
                <option value="">{c.label}</option>
                {c.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input key={c.key} aria-label={label} placeholder={c.label} type={c.type ?? "text"} min={c.type === "number" ? 0 : undefined} step={c.type === "number" ? "any" : undefined} value={line[c.key] ?? ""} onChange={(e) => set(at, c.key, e.target.value)} className={`${inputClass} w-auto`} />
            );
          })}
          <button type="button" aria-label={`Remove ${noun} ${at + 1}`} onClick={() => onChange(lines.filter((_, i) => i !== at))} className="min-h-11 px-3 rounded-md border border-border text-xs">Remove</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...lines, {}])} className="min-h-11 px-3 rounded-md border border-border text-xs">{`Add a ${noun}`}</button>
    </fieldset>
  );
}
