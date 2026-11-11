import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { CENSUS_TEMPLATE_COLUMNS } from "@/data/census";
import { DOCUMENT_CATEGORIES } from "@/data/documentCategories";
import { ANSWER_FIELDS, EXTRA_QUESTION_LABELS, profileProblems, type EditableProfile, type ProfileProblem } from "@/data/peoEditor";
import { EXTRA_QUESTION_KINDS, type ProfilePart } from "@/data/peoProfiles";
import { FIELD_LABELS } from "@/data/provenance";
import { savePeoDraft } from "@/lib/advisorApi";
import { buttonClass, columnLabel, inputClass, primaryClass, problemAt, RULE_ROWS, sourceDraft, sourceFrom, suggestQuestionKey, type SectionKey, type SourceDraft } from "./shared";
import { Field, SourceFields } from "./SourceFields";

/** The problems' paths that belong to each section, so a section's editor shows only its own. */
const SECTION_PATHS: Record<SectionKey, string[]> = {
  rules: ["rules.", ...RULE_ROWS.map((r) => `sources.${r.part}`)],
  answers: ["neededToQuote", "neededBeforeSigning", "sources.answers"],
  census: ["censusLayout", "sources.census_layout"],
  documents: ["documents", "sources.documents"],
  questions: ["extraQuestions", "sources.extra_questions"],
  contacts: ["contacts", "sources.contacts"],
};
const belongsTo = (section: SectionKey) => (p: ProfileProblem) => SECTION_PATHS[section].some((prefix) => p.path.startsWith(prefix));

export interface EditorProps {
  peoId: number;
  /** What the draft starts from: the PEO's draft, else its profile in use, else an empty profile. */
  base: EditableProfile;
  today: string;
  onSaved: () => void;
  onCancel: () => void;
}

/**
 * Saves a section into the PEO's draft: the whole profile, this section as edited and every other part as the draft
 * (or the version in use) holds it. The database's rules are checked first, next to each field; a failed save keeps
 * everything typed.
 */
const EditorShell = ({ section, peoId, today, build, onSaved, onCancel, problems, setProblems, children }: {
  section: SectionKey;
  peoId: number;
  today: string;
  build: () => EditableProfile;
  onSaved: () => void;
  onCancel: () => void;
  problems: readonly ProfileProblem[];
  setProblems: (p: ProfileProblem[]) => void;
  children: ReactNode;
}) => {
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const save = async () => {
    const next = build();
    const found = profileProblems(next, today).filter(belongsTo(section));
    setProblems(found);
    setFailed(null);
    if (found.length > 0) return;
    setSaving(true);
    try {
      await savePeoDraft(peoId, next);
      toast.success("Saved to the draft. Publish it when it's ready.");
      onSaved();
    } catch (err) {
      setFailed(`${(err as Error).message} Nothing you typed is lost: try again.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {problems.length > 0 && (
        <p role="alert" className="text-sm rounded-md bg-destructive/10 text-destructive px-3 py-2">
          Fix the {problems.length === 1 ? "field" : `${problems.length} fields`} marked below, then save again.
        </p>
      )}
      {failed && <p role="alert" className="text-sm rounded-md bg-destructive/10 text-destructive px-3 py-2">{failed}</p>}
      {children}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => void save()} disabled={saving} className={primaryClass}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Save to draft
        </button>
        <button onClick={onCancel} disabled={saving} className={buttonClass}>Cancel</button>
      </div>
    </div>
  );
};

const srcId = (peoId: number, part: ProfilePart) => `peo-${peoId}-src-${part}`;
const words = (text: string) => text.split(/[\s,]+/).map((w) => w.trim()).filter(Boolean);
const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

/** Sources edited in a section, put back into the profile: one left "Not checked yet" is dropped. */
function withSources(profile: EditableProfile, edited: Partial<Record<ProfilePart, SourceDraft>>): EditableProfile {
  const sources = { ...profile.sources };
  for (const [part, draft] of Object.entries(edited) as [ProfilePart, SourceDraft][]) {
    const source = sourceFrom(draft);
    if (source) sources[part] = source;
    else delete sources[part];
  }
  return { ...profile, sources };
}

// ---------- What it won't take on ----------

type RuleKey = keyof EditableProfile["rules"];

const RULE_INPUT: Record<RuleKey, { hint: string; multiline?: boolean; show: (v: never) => string; read: (text: string, sourced: boolean) => unknown }> = {
  minHeadcount: { hint: "Employees. Leave it empty if not checked yet.", show: (v: number) => String(v), read: (t) => (t.trim() === "" ? null : Number(t)) },
  statesServed: { hint: "State codes, such as CA, NY. Leave it empty if not checked yet.", show: (v: string[]) => v.join(", "), read: (t, sourced) => (t.trim() === "" ? (sourced ? [] : null) : words(t).map((w) => w.toUpperCase())) },
  excludedIndustries: { hint: "In the PEO's own words, one per line. Leave it empty and give a source if it excludes none.", multiline: true, show: (v: string[]) => v.join("\n"), read: (t, sourced) => (t.trim() === "" ? (sourced ? [] : null) : lines(t)) },
  excludedClassCodes: { hint: "Workers' comp class codes, four digits each. Leave it empty and give a source if it excludes none.", show: (v: string[]) => v.join(", "), read: (t, sourced) => (t.trim() === "" ? (sourced ? [] : null) : words(t)) },
  minEnrolmentPercent: { hint: "Percent of eligible employees. Leave it empty if not checked yet.", show: (v: number) => String(v), read: (t) => (t.trim() === "" ? null : Number(t)) },
};

export const RulesEditor = ({ peoId, base, today, onSaved, onCancel }: EditorProps) => {
  const [values, setValues] = useState(() => Object.fromEntries(RULE_ROWS.map((r) => [r.key, base.rules[r.key] === null ? "" : RULE_INPUT[r.key].show(base.rules[r.key] as never)])) as Record<RuleKey, string>);
  const [sources, setSources] = useState(() => Object.fromEntries(RULE_ROWS.map((r) => [r.part, sourceDraft(base.sources[r.part], today)])) as Record<ProfilePart, SourceDraft>);
  const [problems, setProblems] = useState<ProfileProblem[]>([]);

  const build = (): EditableProfile => {
    const rules = { ...base.rules };
    for (const r of RULE_ROWS) (rules as Record<RuleKey, unknown>)[r.key] = RULE_INPUT[r.key].read(values[r.key], sources[r.part].kind !== "none");
    return withSources({ ...base, rules }, sources);
  };

  return (
    <EditorShell section="rules" peoId={peoId} today={today} build={build} onSaved={onSaved} onCancel={onCancel} problems={problems} setProblems={setProblems}>
      {RULE_ROWS.map((r) => {
        const input = RULE_INPUT[r.key];
        const id = `peo-${peoId}-rule-${r.key}`;
        return (
          <div key={r.key} className="space-y-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
            <Field id={id} label={r.label} hint={input.hint} problem={problemAt(problems, `rules.${r.key}`)}>
              {(p) => input.multiline
                ? <textarea {...p} rows={3} value={values[r.key]} onChange={(e) => setValues({ ...values, [r.key]: e.target.value })} className={inputClass} />
                : <input {...p} inputMode={r.key === "minHeadcount" || r.key === "minEnrolmentPercent" ? "decimal" : undefined} value={values[r.key]} onChange={(e) => setValues({ ...values, [r.key]: e.target.value })} className={inputClass} />}
            </Field>
            <SourceFields
              id={srcId(peoId, r.part)}
              label={`Where the ${r.label.toLowerCase()} ${r.key === "minHeadcount" || r.key === "minEnrolmentPercent" ? "was" : "were"} checked`}
              value={sources[r.part]}
              onChange={(next) => setSources({ ...sources, [r.part]: next })}
              problems={problems}
              path={`sources.${r.part}`}
            />
          </div>
        );
      })}
    </EditorShell>
  );
};

// ---------- Answers it needs ----------

export const AnswersEditor = ({ peoId, base, today, onSaved, onCancel }: EditorProps) => {
  const [toQuote, setToQuote] = useState<string[]>(base.neededToQuote);
  const [beforeSigning, setBeforeSigning] = useState<string[]>(base.neededBeforeSigning);
  const [adding, setAdding] = useState({ quote: "", signing: "" });
  const [source, setSource] = useState(() => sourceDraft(base.sources.answers, today));
  const [problems, setProblems] = useState<ProfileProblem[]>([]);
  const listed = new Set([...toQuote, ...beforeSigning]);
  const label = (f: string) => FIELD_LABELS[f as keyof typeof FIELD_LABELS] ?? f;

  const build = (): EditableProfile =>
    withSources({ ...base, neededToQuote: toQuote as EditableProfile["neededToQuote"], neededBeforeSigning: beforeSigning as EditableProfile["neededBeforeSigning"] }, { answers: source });

  const group = (which: "quote" | "signing", title: string, list: string[], setList: (l: string[]) => void, path: string) => (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">{title}</h4>
      {list.length === 0 ? <p className="text-sm text-muted-foreground">None yet</p> : (
        <ul className="space-y-1">
          {list.map((f, i) => (
            <li key={f} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {label(f)}
                {problemAt(problems, `${path}.${i}`) && <span className="block text-xs text-destructive">{problemAt(problems, `${path}.${i}`)}</span>}
              </span>
              <button onClick={() => setList(list.filter((x) => x !== f))} className={buttonClass} aria-label={`Remove ${label(f)}`}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-48">
          <Field id={`peo-${peoId}-add-${which}`} label={`Add an answer needed ${which === "quote" ? "to quote" : "only before signing"}`}>
            {(p) => (
              <select {...p} value={adding[which]} onChange={(e) => setAdding({ ...adding, [which]: e.target.value })} className={inputClass}>
                <option value="">Choose an answer</option>
                {ANSWER_FIELDS.filter((f) => !listed.has(f)).map((f) => <option key={f} value={f}>{label(f)}</option>)}
              </select>
            )}
          </Field>
        </div>
        <button
          onClick={() => { setList([...list, adding[which]]); setAdding({ ...adding, [which]: "" }); }}
          disabled={!adding[which]}
          className={buttonClass}
        >
          {which === "quote" ? "Add to quote" : "Add to before signing"}
        </button>
      </div>
    </div>
  );

  return (
    <EditorShell section="answers" peoId={peoId} today={today} build={build} onSaved={onSaved} onCancel={onCancel} problems={problems} setProblems={setProblems}>
      {group("quote", "To quote", toQuote, setToQuote, "neededToQuote")}
      {group("signing", "Only before signing", beforeSigning, setBeforeSigning, "neededBeforeSigning")}
      <SourceFields id={srcId(peoId, "answers")} label="Where the answers were checked" value={source} onChange={setSource} problems={problems} path="sources.answers" />
    </EditorShell>
  );
};

// ---------- Census layout ----------

let rowSeq = 0;
const rowKey = () => ++rowSeq;

export const CensusEditor = ({ peoId, base, today, onSaved, onCancel }: EditorProps) => {
  const layout = base.censusLayout;
  const [held, setHeld] = useState(layout !== null);
  const [format, setFormat] = useState<string>(layout?.format ?? "xlsx");
  const [templateFile, setTemplateFile] = useState(layout?.templateFile ?? "");
  const [columns, setColumns] = useState(() => (layout?.columns ?? [{ header: "", from: null }]).map((c) => ({ key: rowKey(), header: c.header, from: c.from as string | null })));
  const [source, setSource] = useState(() => sourceDraft(base.sources.census_layout, today));
  const [problems, setProblems] = useState<ProfileProblem[]>([]);
  const headerInputs = useRef(new Map<number, HTMLInputElement>());
  const [focusKey, setFocusKey] = useState<number | null>(null);

  useEffect(() => {
    if (focusKey !== null) headerInputs.current.get(focusKey)?.focus();
  }, [focusKey, columns]);

  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= columns.length) return;
    const next = [...columns];
    [next[i], next[j]] = [next[j], next[i]];
    setColumns(next);
    setFocusKey(next[j].key);
  };

  const build = (): EditableProfile =>
    withSources({
      ...base,
      censusLayout: held
        ? { peo: layout?.peo ?? null, format: format as "csv" | "xlsx", templateFile: templateFile.trim() === "" ? null : templateFile.trim(), columns: columns.map((c) => ({ header: c.header.trim(), from: (c.from || null) as never })) }
        : null,
    } as EditableProfile, { census_layout: held ? source : { ...source, kind: "none" } });

  return (
    <EditorShell section="census" peoId={peoId} today={today} build={build} onSaved={onSaved} onCancel={onCancel} problems={problems} setProblems={setProblems}>
      <div className="flex flex-wrap gap-x-4" role="radiogroup" aria-label="Census layout">
        <label className="flex items-center gap-2 min-h-11 text-sm"><input type="radio" checked={!held} onChange={() => setHeld(false)} /> Not checked yet (our own layout)</label>
        <label className="flex items-center gap-2 min-h-11 text-sm"><input type="radio" checked={held} onChange={() => setHeld(true)} /> The PEO's own layout</label>
      </div>
      {held && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id={`peo-${peoId}-census-format`} label="File" problem={problemAt(problems, "censusLayout.format")}>
              {(p) => (
                <select {...p} value={format} onChange={(e) => setFormat(e.target.value)} className={inputClass}>
                  <option value="xlsx">xlsx (a spreadsheet)</option>
                  <option value="csv">CSV</option>
                </select>
              )}
            </Field>
            <Field id={`peo-${peoId}-census-template`} label="The PEO's template file (optional)" hint="Where the file we fill is kept, when the PEO has one." problem={problemAt(problems, "censusLayout.templateFile")}>
              {(p) => <input {...p} value={templateFile} onChange={(e) => setTemplateFile(e.target.value)} className={inputClass} />}
            </Field>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Columns, in the PEO's order</h4>
            <p className="text-xs text-muted-foreground">Copy each header as the PEO's form writes it. Alt and the up or down arrow moves the column you are in.</p>
            {problemAt(problems, "censusLayout.columns") && <p className="text-xs text-destructive">{problemAt(problems, "censusLayout.columns")}</p>}
            <ol className="space-y-2">
              {columns.map((c, i) => {
                const name = c.header.trim() || `column ${i + 1}`;
                return (
                  <li key={c.key} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-start border border-border rounded-lg p-2">
                    <Field id={`peo-${peoId}-col-${c.key}-header`} label={`Column ${i + 1} header`} problem={problemAt(problems, `censusLayout.columns.${i}.header`)}>
                      {(p) => (
                        <input
                          {...p}
                          ref={(el) => { if (el) headerInputs.current.set(c.key, el); else headerInputs.current.delete(c.key); }}
                          value={c.header}
                          onChange={(e) => setColumns(columns.map((x) => (x.key === c.key ? { ...x, header: e.target.value } : x)))}
                          onKeyDown={(e) => {
                            if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                              e.preventDefault();
                              move(i, e.key === "ArrowUp" ? -1 : 1);
                            }
                          }}
                          className={inputClass}
                        />
                      )}
                    </Field>
                    <Field id={`peo-${peoId}-col-${c.key}-from`} label={`Column ${i + 1} filled from`} problem={problemAt(problems, `censusLayout.columns.${i}.from`)}>
                      {(p) => (
                        <select {...p} value={c.from ?? ""} onChange={(e) => setColumns(columns.map((x) => (x.key === c.key ? { ...x, from: e.target.value || null } : x)))} className={inputClass}>
                          <option value="">Left blank (we don't collect it)</option>
                          {CENSUS_TEMPLATE_COLUMNS.map((col) => <option key={col} value={col}>{columnLabel(col)}</option>)}
                        </select>
                      )}
                    </Field>
                    <div className="flex gap-1 sm:pt-6">
                      <button onClick={() => move(i, -1)} disabled={i === 0} className={buttonClass} aria-label={`Move ${name} up`}><ArrowUp className="w-4 h-4" aria-hidden="true" /></button>
                      <button onClick={() => move(i, 1)} disabled={i === columns.length - 1} className={buttonClass} aria-label={`Move ${name} down`}><ArrowDown className="w-4 h-4" aria-hidden="true" /></button>
                      <button onClick={() => setColumns(columns.filter((x) => x.key !== c.key))} className={buttonClass} aria-label={`Remove ${name}`}><X className="w-4 h-4" aria-hidden="true" /></button>
                    </div>
                  </li>
                );
              })}
            </ol>
            <button
              onClick={() => { const key = rowKey(); setColumns([...columns, { key, header: "", from: null }]); setFocusKey(key); }}
              className={buttonClass}
            >
              <Plus className="w-4 h-4" aria-hidden="true" /> Add a column
            </button>
          </div>
          <SourceFields id={srcId(peoId, "census_layout")} label="Where the census layout was checked" value={source} onChange={setSource} problems={problems} path="sources.census_layout" />
        </>
      )}
    </EditorShell>
  );
};

// ---------- Documents ----------

export const DocumentsEditor = ({ peoId, base, today, onSaved, onCancel }: EditorProps) => {
  const [docs, setDocs] = useState(() => base.documents.map((d) => ({ key: rowKey(), category: d.category as string, description: d.description })));
  const [source, setSource] = useState(() => sourceDraft(base.sources.documents, today));
  const [problems, setProblems] = useState<ProfileProblem[]>([]);
  const build = (): EditableProfile =>
    withSources({ ...base, documents: docs.map((d) => ({ category: d.category as never, description: d.description.trim() })) }, { documents: source });

  return (
    <EditorShell section="documents" peoId={peoId} today={today} build={build} onSaved={onSaved} onCancel={onCancel} problems={problems} setProblems={setProblems}>
      {problemAt(problems, "documents") && <p className="text-xs text-destructive">{problemAt(problems, "documents")}</p>}
      <p className="text-xs text-muted-foreground">With none listed and a source given, the PEO asks for no documents.</p>
      <ol className="space-y-2">
        {docs.map((d, i) => (
          <li key={d.key} className="grid gap-2 sm:grid-cols-[14rem_1fr_auto] items-start border border-border rounded-lg p-2">
            <Field id={`peo-${peoId}-doc-${d.key}-kind`} label={`Document ${i + 1} kind`} problem={problemAt(problems, `documents.${i}.category`)}>
              {(p) => (
                <select {...p} value={d.category} onChange={(e) => setDocs(docs.map((x) => (x.key === d.key ? { ...x, category: e.target.value } : x)))} className={inputClass}>
                  <option value="">Choose a kind</option>
                  {DOCUMENT_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              )}
            </Field>
            <Field id={`peo-${peoId}-doc-${d.key}-what`} label={`Document ${i + 1}: what the PEO wants`} problem={problemAt(problems, `documents.${i}.description`)}>
              {(p) => <input {...p} value={d.description} onChange={(e) => setDocs(docs.map((x) => (x.key === d.key ? { ...x, description: e.target.value } : x)))} className={inputClass} />}
            </Field>
            <div className="sm:pt-6">
              <button onClick={() => setDocs(docs.filter((x) => x.key !== d.key))} className={buttonClass} aria-label={`Remove document ${i + 1}`}><X className="w-4 h-4" aria-hidden="true" /></button>
            </div>
          </li>
        ))}
      </ol>
      <button onClick={() => setDocs([...docs, { key: rowKey(), category: "", description: "" }])} className={buttonClass}>
        <Plus className="w-4 h-4" aria-hidden="true" /> Add a document
      </button>
      <SourceFields id={srcId(peoId, "documents")} label="Where the documents were checked" value={source} onChange={setSource} problems={problems} path="sources.documents" />
    </EditorShell>
  );
};

// ---------- Its own questions ----------

export const QuestionsEditor = ({ peoId, base, today, onSaved, onCancel }: EditorProps) => {
  const [questions, setQuestions] = useState(() => base.extraQuestions.map((q) => ({ key: rowKey(), id: q.key, idTyped: true, text: q.text, kind: q.kind as string, choices: (q.choices ?? []).join("\n") })));
  const [source, setSource] = useState(() => sourceDraft(base.sources.extra_questions, today));
  const [problems, setProblems] = useState<ProfileProblem[]>([]);
  const update = (key: number, patch: Partial<(typeof questions)[number]>) => setQuestions(questions.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  const build = (): EditableProfile =>
    withSources({
      ...base,
      extraQuestions: questions.map((q) => ({
        key: q.id.trim(),
        text: q.text.trim(),
        kind: q.kind as never,
        ...(q.kind === "choice" ? { choices: lines(q.choices) } : {}),
      })),
    }, { extra_questions: source });

  return (
    <EditorShell section="questions" peoId={peoId} today={today} build={build} onSaved={onSaved} onCancel={onCancel} problems={problems} setProblems={setProblems}>
      {problemAt(problems, "extraQuestions") && <p className="text-xs text-destructive">{problemAt(problems, "extraQuestions")}</p>}
      <ol className="space-y-3">
        {questions.map((q, i) => (
          <li key={q.key} className="space-y-2 border border-border rounded-lg p-3">
            <Field id={`peo-${peoId}-q-${q.key}-text`} label={`Question ${i + 1}`} hint="As the PEO's form asks it." problem={problemAt(problems, `extraQuestions.${i}.text`)}>
              {(p) => (
                <textarea {...p} rows={2} value={q.text} className={inputClass}
                  onChange={(e) => update(q.key, { text: e.target.value, ...(q.idTyped ? {} : { id: suggestQuestionKey(e.target.value) }) })} />
              )}
            </Field>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field id={`peo-${peoId}-q-${q.key}-kind`} label={`Question ${i + 1} answered as`} problem={problemAt(problems, `extraQuestions.${i}.kind`)}>
                {(p) => (
                  <select {...p} value={q.kind} onChange={(e) => update(q.key, { kind: e.target.value })} className={inputClass}>
                    {EXTRA_QUESTION_KINDS.map((k) => <option key={k} value={k}>{EXTRA_QUESTION_LABELS[k]}</option>)}
                  </select>
                )}
              </Field>
              <Field id={`peo-${peoId}-q-${q.key}-key`} label={`Question ${i + 1} key`} hint="Names the answer. Lower-case letters, digits and underscores." problem={problemAt(problems, `extraQuestions.${i}.key`)}>
                {(p) => <input {...p} value={q.id} onChange={(e) => update(q.key, { id: e.target.value, idTyped: true })} className={inputClass} />}
              </Field>
            </div>
            {q.kind === "choice" && (
              <Field id={`peo-${peoId}-q-${q.key}-choices`} label={`Question ${i + 1} choices`} hint="One per line." problem={problemAt(problems, `extraQuestions.${i}.choices`)}>
                {(p) => <textarea {...p} rows={3} value={q.choices} onChange={(e) => update(q.key, { choices: e.target.value })} className={inputClass} />}
              </Field>
            )}
            <button onClick={() => setQuestions(questions.filter((x) => x.key !== q.key))} className={buttonClass} aria-label={`Remove question ${i + 1}`}>Remove</button>
          </li>
        ))}
      </ol>
      <button onClick={() => setQuestions([...questions, { key: rowKey(), id: "", idTyped: false, text: "", kind: "text", choices: "" }])} className={buttonClass}>
        <Plus className="w-4 h-4" aria-hidden="true" /> Add a question
      </button>
      <SourceFields id={srcId(peoId, "extra_questions")} label="Where the questions were checked" value={source} onChange={setSource} problems={problems} path="sources.extra_questions" />
    </EditorShell>
  );
};

// ---------- Contacts ----------

export const ContactsEditor = ({ peoId, base, today, onSaved, onCancel }: EditorProps) => {
  const [contacts, setContacts] = useState(() => base.contacts.map((c) => ({ key: rowKey(), name: c.name, role: c.role ?? "", email: c.email ?? "", phone: c.phone ?? "" })));
  const [source, setSource] = useState(() => sourceDraft(base.sources.contacts, today));
  const [problems, setProblems] = useState<ProfileProblem[]>([]);
  const orNull = (s: string) => (s.trim() === "" ? null : s.trim());
  const build = (): EditableProfile =>
    withSources({ ...base, contacts: contacts.map((c) => ({ name: c.name.trim(), role: orNull(c.role), email: orNull(c.email), phone: orNull(c.phone) })) }, { contacts: source });
  const fields = [["name", "name"], ["role", "role"], ["email", "email"], ["phone", "phone"]] as const;

  return (
    <EditorShell section="contacts" peoId={peoId} today={today} build={build} onSaved={onSaved} onCancel={onCancel} problems={problems} setProblems={setProblems}>
      <p className="text-xs text-muted-foreground">Advisors see these; prospects never do.</p>
      {problemAt(problems, "contacts") && <p className="text-xs text-destructive">{problemAt(problems, "contacts")}</p>}
      <ol className="space-y-2">
        {contacts.map((c, i) => (
          <li key={c.key} className="grid gap-2 sm:grid-cols-2 border border-border rounded-lg p-2">
            {fields.map(([field, word]) => (
              <Field key={field} id={`peo-${peoId}-contact-${c.key}-${field}`} label={`Contact ${i + 1} ${word}`} problem={problemAt(problems, `contacts.${i}.${field}`)}>
                {(p) => (
                  <input {...p} type={field === "email" ? "email" : field === "phone" ? "tel" : "text"} value={c[field]} className={inputClass}
                    onChange={(e) => setContacts(contacts.map((x) => (x.key === c.key ? { ...x, [field]: e.target.value } : x)))} />
                )}
              </Field>
            ))}
            <button onClick={() => setContacts(contacts.filter((x) => x.key !== c.key))} className={buttonClass} aria-label={`Remove ${c.name.trim() || `contact ${i + 1}`}`}>Remove</button>
          </li>
        ))}
      </ol>
      <button onClick={() => setContacts([...contacts, { key: rowKey(), name: "", role: "", email: "", phone: "" }])} className={buttonClass}>
        <Plus className="w-4 h-4" aria-hidden="true" /> Add a contact
      </button>
      <SourceFields id={srcId(peoId, "contacts")} label="Where the contacts were checked" value={source} onChange={setSource} problems={problems} path="sources.contacts" />
    </EditorShell>
  );
};
