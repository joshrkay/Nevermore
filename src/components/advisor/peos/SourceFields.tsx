import type { ReactNode } from "react";
import type { ProfileProblem } from "@/data/peoEditor";
import { inputClass, problemAt, type SourceDraft } from "./shared";

/** A labelled input with its problem in plain words right under it, tied to it for screen readers. */
export const Field = ({ id, label, hint, problem, children }: { id: string; label: string; hint?: string; problem?: string; children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode }) => {
  const describedBy = [hint ? `${id}-hint` : null, problem ? `${id}-problem` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1 min-w-0">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      {hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
      {children({ id, "aria-invalid": !!problem, "aria-describedby": describedBy })}
      {problem && <p id={`${id}-problem`} className="text-xs text-destructive">{problem}</p>}
    </div>
  );
};

/**
 * Where one part was checked, and when: a document (its title, with a link when there is one) or a named person at
 * the PEO (their name and role). `allowNone` offers "Not checked yet" for a draft.
 */
export const SourceFields = ({ id, label, value, onChange, problems, path, allowNone = true }: {
  id: string;
  label: string;
  value: SourceDraft;
  onChange: (next: SourceDraft) => void;
  problems: readonly ProfileProblem[];
  /** The problems' path for this source, such as "sources.min_headcount". */
  path: string;
  allowNone?: boolean;
}) => {
  const set = (patch: Partial<SourceDraft>) => onChange({ ...value, ...patch });
  const kinds: { kind: SourceDraft["kind"]; text: string }[] = [
    ...(allowNone ? [{ kind: "none" as const, text: "Not checked yet" }] : []),
    { kind: "document", text: "A document" },
    { kind: "person", text: "A person at the PEO" },
  ];
  const whole = problemAt(problems, path);
  return (
    <fieldset className="border border-border rounded-lg p-3 space-y-3">
      <legend className="text-sm font-medium px-1">{label}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1" role="radiogroup" aria-label={`${label}: kind of source`}>
        {kinds.map((k) => (
          <label key={k.kind} className="flex items-center gap-2 min-h-11 text-sm">
            <input type="radio" name={`${id}-kind`} checked={value.kind === k.kind} onChange={() => set({ kind: k.kind })} />
            {k.text}
          </label>
        ))}
      </div>
      {whole && <p className="text-xs text-destructive">{whole}</p>}
      {value.kind !== "none" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id={`${id}-name`} label={value.kind === "document" ? "Document title" : "Their name"} problem={problemAt(problems, `${path}.name`)}>
            {(p) => <input {...p} value={value.name} onChange={(e) => set({ name: e.target.value })} className={inputClass} />}
          </Field>
          {value.kind === "person" ? (
            <Field id={`${id}-role`} label="Their role" hint="Such as Broker desk manager" problem={problemAt(problems, `${path}.role`)}>
              {(p) => <input {...p} value={value.role} onChange={(e) => set({ role: e.target.value })} className={inputClass} />}
            </Field>
          ) : (
            <Field id={`${id}-link`} label="Link (optional)" problem={problemAt(problems, `${path}.link`)}>
              {(p) => <input {...p} type="url" value={value.link} onChange={(e) => set({ link: e.target.value })} className={inputClass} />}
            </Field>
          )}
          <Field id={`${id}-checked`} label="Checked on" problem={problemAt(problems, `${path}.checkedOn`)}>
            {(p) => <input {...p} type="date" value={value.checkedOn} onChange={(e) => set({ checkedOn: e.target.value })} className={inputClass} />}
          </Field>
        </div>
      )}
    </fieldset>
  );
};
