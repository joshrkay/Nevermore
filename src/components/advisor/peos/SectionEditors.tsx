import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { CENSUS_TEMPLATE_COLUMNS } from "@/data/census";
import { DOCUMENT_CATEGORIES } from "@/data/documentCategories";
import { ANSWER_FIELDS, EXTRA_QUESTION_LABELS, isStaleDraftError, PROFILE_PART_TABLE, profileProblems, RULE_PARTS, samePart, whereChecked, type DraftBasis, type EditableProfile, type ProfileProblem } from "@/data/peoEditor";
import { EXTRA_QUESTION_KINDS, PROFILE_PARTS, utcToday, type ProfilePart } from "@/data/peoProfiles";
import { FIELD_LABELS } from "@/data/provenance";
import { savePeoDraft } from "@/lib/advisorApi";
import { listTemplateWorkbooks, TEMPLATE_WORKBOOK_STATUS_WORDS, templateWorkbookProblem, uploadTemplateWorkbook, type TemplateWorkbookRecord } from "@/lib/templateWorkbooks";
import { buttonClass, columnLabel, inputClass, primaryClass, problemAt, sourceDraft, sourceFrom, suggestQuestionKey, type SectionKey, type SourceDraft } from "./shared";
import { Field, SourceFields } from "./SourceFields";
import { failureWords } from "@/components/workspace/form";

/** The problems' paths that belong to a section (its parts' fields and sources), so its editor shows only its own. */
const sectionPaths = (section: SectionKey) =>
  PROFILE_PARTS.filter((part) => PROFILE_PART_TABLE[part].section === section).flatMap((part) => [...PROFILE_PART_TABLE[part].fields, `sources.${part}`]);
const belongsTo = (section: SectionKey) => (p: ProfileProblem) => sectionPaths(section).some((prefix) => p.path.startsWith(prefix));

export interface EditorProps {
  peoId: number;
  /** What the draft starts from: the PEO's draft, else its profile in use, else an empty profile. */
  base: EditableProfile;
  /** What `base` is: the draft's revision, or no draft and the version in use. The save names it. */
  basis: DraftBasis;
  today: string;
  onSaved: () => void;
  onCancel: () => void;
  /** Reads the PEO again, leaving this editor open with what was typed. */
  onReload: () => void;
}

/**
 * Saves a section into the PEO's draft: the whole profile, this section as edited and every other part as the draft
 * (or the version in use) holds it. The database's rules are checked first, next to each field; a failed save keeps
 * everything typed.
 */
const EditorShell = ({ section, peoId, basis, build, onSaved, onCancel, onReload, problems, setProblems, children }: {
  section: SectionKey;
  peoId: number;
  basis: DraftBasis;
  build: () => EditableProfile;
  onSaved: () => void;
  onCancel: () => void;
  onReload: () => void;
  problems: readonly ProfileProblem[];
  setProblems: (p: ProfileProblem[]) => void;
  children: ReactNode;
}) => {
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  // The draft changed since this editor opened (another admin, or another tab): reload, keeping what was typed.
  const [stale, setStale] = useState(false);

  const save = async () => {
    const next = build();
    const found = profileProblems(next, utcToday()).filter(belongsTo(section));
    setProblems(found);
    setFailed(null);
    setStale(false);
    if (found.length > 0) return;
    setSaving(true);
    try {
      await savePeoDraft(peoId, next, basis);
      toast.success("Saved to the draft. Publish it when it's ready.");
      onSaved();
    } catch (err) {
      if (isStaleDraftError(err)) setStale(true);
      else setFailed(`${failureWords(err, "That wasn't saved. Check your connection and try again.")} Nothing you typed is lost: try again.`);
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
      {stale && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm rounded-md bg-warning/10 text-warning px-3 py-2">
          <p className="flex-1 min-w-48">This draft changed since you opened it. Reload to see the latest, your typing is kept.</p>
          <button onClick={() => { setStale(false); onReload(); }} className={buttonClass}>Reload</button>
        </div>
      )}
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

let rowSeq = 0;
/** A key for a row the admin adds, removes or moves, so React keeps each row's inputs with it. */
const rowKey = () => ++rowSeq;

const srcId = (peoId: number, part: ProfilePart) => `peo-${peoId}-src-${part}`;
const words = (text: string) => text.split(/[\s,]+/).map((w) => w.trim()).filter(Boolean);
const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

/**
 * A value the admin edits, read from the base until they change it. When the base is read again (Reload, after the
 * draft changed elsewhere), what they changed is kept and the rest follows the new base.
 */
function useEdited<T>(fromBase: () => T, base: EditableProfile): [T, (next: T) => void] {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initial = useMemo(fromBase, [base]);
  const [edited, setEdited] = useState<{ value: T } | null>(null);
  return [edited ? edited.value : initial, (value) => setEdited({ value })];
}

/** The parts' sources as the editor shows them: a part whose content changed is dated today unless the admin set the date. */
function datedSources(base: EditableProfile, next: EditableProfile, edited: Partial<Record<ProfilePart, SourceDraft>>, today: string) {
  return Object.fromEntries(Object.entries(edited).map(([part, draft]) => [
    part,
    draft!.dateSet || samePart(part as ProfilePart, base, next) ? draft! : { ...draft!, checkedOn: today },
  ])) as Partial<Record<ProfilePart, SourceDraft>>;
}

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

/**
 * A section's content and its sources as the editor holds them: `content` builds the profile with the section as
 * edited; `shown` is each source as the form shows it (dated today when its part changed); `build` is what is saved.
 */
function useSectionSources(base: EditableProfile, today: string, parts: readonly ProfilePart[], content: () => EditableProfile) {
  const [edited, setEdited] = useEdited(
    () => Object.fromEntries(parts.map((part) => [part, sourceDraft(base.sources[part], today)])) as Record<ProfilePart, SourceDraft>,
    base,
  );
  const shown = datedSources(base, content(), edited, today) as Record<ProfilePart, SourceDraft>;
  const set = (part: ProfilePart) => (next: SourceDraft) => setEdited({ ...edited, [part]: next });
  const build = (override?: Partial<Record<ProfilePart, SourceDraft>>) => withSources(content(), { ...shown, ...override });
  return { shown, set, build };
}

// ---------- What it won't take on ----------

type RuleKey = keyof EditableProfile["rules"];
type Rule = (typeof RULE_PARTS)[number];

/** A rule's value as its input holds it: a number, or words joined by commas. */
const ruleText = (r: Rule, rules: EditableProfile["rules"]) => {
  const value = rules[r.key];
  if (value === null || value === undefined) return "";
  return r.input === "number" ? String(value) : (value as string[]).join(", ");
};

/** What a rule's input says: empty is "not checked yet", or, with a source, none excluded. */
const readRule = (r: Rule, text: string, sourced: boolean): unknown => {
  if (text.trim() === "") return r.input === "number" || !sourced ? null : [];
  if (r.input === "number") return Number(text);
  return words(text).map((w) => (r.upperCase ? w.toUpperCase() : w));
};

/** One excluded industry as the editor holds it: the PEO's wording in one field, the class codes it covers in another. */
interface IndustryRow {
  key: number;
  wording: string;
  codes: string;
}

const industryRows = (rules: EditableProfile["rules"]): IndustryRow[] =>
  (rules.excludedIndustries ?? []).map((wording) => ({ key: rowKey(), wording, codes: (rules.excludedIndustryCodes?.[wording] ?? []).join(", ") }));

/**
 * What the industry rows say: each row's wording, as typed, and the codes typed beside it. A row left wholly empty is
 * dropped. No rows is "not checked yet", or, with a source, none excluded.
 */
const readIndustryRows = (rows: readonly IndustryRow[], sourced: boolean) => {
  const kept = rows.filter((r) => r.wording.trim() !== "" || r.codes.trim() !== "");
  const codes = Object.fromEntries(kept.filter((r) => r.codes.trim() !== "").map((r) => [r.wording.trim(), words(r.codes)]));
  return { industries: kept.length === 0 && !sourced ? null : kept.map((r) => r.wording.trim()), codes };
};

/** The excluded industries: one row each, the PEO's own words and the class codes it covers in fields of their own. */
const IndustriesFields = ({ id, hint, problem, rows, onChange }: { id: string; hint: string; problem?: string; rows: IndustryRow[]; onChange: (next: IndustryRow[]) => void }) => {
  const set = (key: number, patch: Partial<IndustryRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const describedBy = [`${id}-hint`, problem ? `${id}-problem` : null].filter(Boolean).join(" ");
  return (
    <fieldset className="space-y-2 min-w-0" aria-describedby={describedBy}>
      <legend className="text-sm font-medium">Excluded industries</legend>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>
      {problem && <p id={`${id}-problem`} className="text-xs text-destructive">{problem}</p>}
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">None listed.</p> : (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.key} className="grid gap-2 sm:grid-cols-[1fr_12rem_auto] items-start border border-border rounded-lg p-2">
              <Field id={`${id}-${r.key}-wording`} label={`Industry ${i + 1}, in the PEO's words`}>
                {(p) => <input {...p} aria-invalid={!!problem} value={r.wording} onChange={(e) => set(r.key, { wording: e.target.value })} className={inputClass} />}
              </Field>
              <Field id={`${id}-${r.key}-codes`} label={`Industry ${i + 1} class codes`} hint="Four digits each, such as 5551, 5645. Empty if none are mapped yet.">
                {(p) => <input {...p} aria-invalid={!!problem} inputMode="numeric" value={r.codes} onChange={(e) => set(r.key, { codes: e.target.value })} className={inputClass} />}
              </Field>
              <div className="sm:pt-6">
                <button onClick={() => onChange(rows.filter((x) => x.key !== r.key))} className={buttonClass} aria-label={`Remove industry ${i + 1}${r.wording.trim() ? `, ${r.wording.trim()}` : ""}`}>
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <button onClick={() => onChange([...rows, { key: rowKey(), wording: "", codes: "" }])} className={buttonClass}>
        <Plus className="w-4 h-4" aria-hidden="true" /> Add an industry
      </button>
    </fieldset>
  );
};

export const RulesEditor = ({ peoId, base, basis, today, onSaved, onCancel, onReload }: EditorProps) => {
  // Each rule is its own edit, so a reload keeps the rules typed and takes the others from the newer draft.
  const [typed, setTyped] = useState<Partial<Record<RuleKey, string>>>({});
  const [industries, setIndustries] = useEdited(() => industryRows(base.rules), base);
  const values = Object.fromEntries(RULE_PARTS.map((r) => [r.key, typed[r.key] ?? ruleText(r, base.rules)])) as Record<RuleKey, string>;
  const [sourceEdits, setSourceEdits] = useState<Partial<Record<ProfilePart, SourceDraft>>>({});
  const drafts = Object.fromEntries(RULE_PARTS.map((r) => [r.part, sourceEdits[r.part] ?? sourceDraft(base.sources[r.part], today)])) as Record<ProfilePart, SourceDraft>;
  const [problems, setProblems] = useState<ProfileProblem[]>([]);

  const content = (): EditableProfile => {
    const rules = { ...base.rules };
    for (const r of RULE_PARTS) {
      if (r.input !== "industries") (rules as Record<RuleKey, unknown>)[r.key] = readRule(r, values[r.key], drafts[r.part].kind !== "none");
    }
    // The excluded industries, and the class codes each covers, come from their rows.
    const read = readIndustryRows(industries, drafts.excluded_industries.kind !== "none");
    rules.excludedIndustries = read.industries;
    const codes = read.codes;
    if (Object.keys(codes).length > 0) rules.excludedIndustryCodes = codes;
    else delete rules.excludedIndustryCodes;
    return { ...base, rules };
  };
  const shown = datedSources(base, content(), drafts, today) as Record<ProfilePart, SourceDraft>;
  const build = () => withSources(content(), shown);

  return (
    <EditorShell section="rules" peoId={peoId} basis={basis} build={build} onSaved={onSaved} onCancel={onCancel} onReload={onReload} problems={problems} setProblems={setProblems}>
      {RULE_PARTS.map((r) => {
        const id = `peo-${peoId}-rule-${r.key}`;
        const onChange = (e: { target: { value: string } }) => setTyped({ ...typed, [r.key]: e.target.value });
        return (
          <div key={r.key} className="space-y-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
            {r.input === "industries"
              ? <IndustriesFields id={id} hint={r.hint} problem={problemAt(problems, `rules.${r.key}`)} rows={industries} onChange={setIndustries} />
              : (
                <Field id={id} label={r.label} hint={r.hint} problem={problemAt(problems, `rules.${r.key}`)}>
                  {(p) => <input {...p} inputMode={r.input === "number" ? "decimal" : undefined} value={values[r.key]} onChange={onChange} className={inputClass} />}
                </Field>
              )}
            <SourceFields
              id={srcId(peoId, r.part)}
              label={whereChecked(r.part)}
              value={shown[r.part]}
              onChange={(next) => setSourceEdits({ ...sourceEdits, [r.part]: next })}
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

export const AnswersEditor = ({ peoId, base, basis, today, onSaved, onCancel, onReload }: EditorProps) => {
  const [answers, setAnswers] = useEdited(() => ({ quote: base.neededToQuote as string[], signing: base.neededBeforeSigning as string[] }), base);
  const [adding, setAdding] = useState({ quote: "", signing: "" });
  const [problems, setProblems] = useState<ProfileProblem[]>([]);
  const listed = new Set([...answers.quote, ...answers.signing]);
  const label = (f: string) => FIELD_LABELS[f as keyof typeof FIELD_LABELS] ?? f;
  const sources = useSectionSources(base, today, ["answers"], () => ({
    ...base, neededToQuote: answers.quote as EditableProfile["neededToQuote"], neededBeforeSigning: answers.signing as EditableProfile["neededBeforeSigning"],
  }));

  const group = (which: "quote" | "signing", title: string, path: string) => {
    const list = answers[which];
    const setList = (next: string[]) => setAnswers({ ...answers, [which]: next });
    return (
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
  };

  return (
    <EditorShell section="answers" peoId={peoId} basis={basis} build={() => sources.build()} onSaved={onSaved} onCancel={onCancel} onReload={onReload} problems={problems} setProblems={setProblems}>
      {group("quote", "To quote", "neededToQuote")}
      {group("signing", "Only before signing", "neededBeforeSigning")}
      <SourceFields id={srcId(peoId, "answers")} label={whereChecked("answers")} value={sources.shown.answers} onChange={sources.set("answers")} problems={problems} path="sources.answers" />
    </EditorShell>
  );
};

// ---------- Census layout ----------

type TemplateFields = { templateId: string; sheet: string; headerRow: string; firstRow: string };

/**
 * The PEO template workbook the census fills, when it has one (L-3.1): one uploaded for this PEO, or a new upload, which
 * is checked for viruses as every upload is (docs/adr/0002); and where in it the census goes. A template that isn't
 * clean is never used, and this says why.
 */
const TemplatePicker = ({ peoId, value, onChange, problem }: { peoId: number; value: TemplateFields; onChange: (patch: Partial<TemplateFields>) => void; problem?: string }) => {
  const [list, setList] = useState<TemplateWorkbookRecord[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProblem, setUploadProblem] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setList(await listTemplateWorkbooks(peoId));
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, [peoId]);
  useEffect(() => { void load(); }, [load]);
  const chosen = list?.find((t) => String(t.id) === value.templateId);
  const status = chosen ? templateWorkbookProblem(chosen.status) : null;
  const id = `peo-${peoId}-census-template`;

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setUploadProblem(null);
    try {
      const added = await uploadTemplateWorkbook(peoId, file);
      await load();
      onChange({ templateId: String(added.id) });
    } catch (err) {
      setUploadProblem(failureWords(err, "The file wasn't uploaded. Check your connection and try again."));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3 border border-border rounded-lg p-3">
      <Field id={id} label="The PEO template workbook" hint="Only when the PEO wants its own spreadsheet filled in. Its headers must match the columns below." problem={problem}>
        {(p) => (
          <select {...p} value={value.templateId} onChange={(e) => onChange({ templateId: e.target.value })} className={inputClass}>
            <option value="">None: we write the file</option>
            {(list ?? []).map((t) => (
              <option key={t.id} value={String(t.id)}>{`${t.fileName}${TEMPLATE_WORKBOOK_STATUS_WORDS[t.status].tag ? ` (${TEMPLATE_WORKBOOK_STATUS_WORDS[t.status].tag})` : ""}`}</option>
            ))}
          </select>
        )}
      </Field>
      {loadFailed && <p role="alert" className="text-xs text-destructive">The PEO's template workbooks couldn't be loaded. <button type="button" onClick={() => void load()} className="underline min-h-11">Try again</button></p>}
      {status && <p className="text-xs text-warning">{status}</p>}
      <div className="space-y-1">
        <label htmlFor={`${id}-upload`} className="block text-sm font-medium">Upload the PEO template workbook (.xlsx)</label>
        <input
          id={`${id}-upload`}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={uploading}
          onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }}
          className="block w-full text-sm min-h-11"
        />
        <p className="text-xs text-muted-foreground">It is checked for viruses before anyone can use it.</p>
        {uploading && <p aria-live="polite" className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> Uploading and checking it…</p>}
        {uploadProblem && <p role="alert" className="text-xs text-destructive">{uploadProblem}</p>}
      </div>
      {value.templateId !== "" && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field id={`${id}-sheet`} label="Sheet">
            {(p) => <input {...p} value={value.sheet} onChange={(e) => onChange({ sheet: e.target.value })} className={inputClass} />}
          </Field>
          <Field id={`${id}-header-row`} label="Row the headers are on">
            {(p) => <input {...p} type="number" min={1} value={value.headerRow} onChange={(e) => onChange({ headerRow: e.target.value })} className={inputClass} />}
          </Field>
          <Field id={`${id}-first-row`} label="First row of data">
            {(p) => <input {...p} type="number" min={2} value={value.firstRow} onChange={(e) => onChange({ firstRow: e.target.value })} className={inputClass} />}
          </Field>
        </div>
      )}
    </div>
  );
};

export const CensusEditor = ({ peoId, base, basis, today, onSaved, onCancel, onReload }: EditorProps) => {
  const [census, setCensus] = useEdited(() => {
    const layout = base.censusLayout;
    return {
      held: layout !== null,
      format: (layout?.format ?? "xlsx") as string,
      templateId: layout?.template ? String(layout.template.id) : "",
      sheet: layout?.template?.sheet ?? "",
      headerRow: layout?.template ? String(layout.template.headerRow) : "1",
      firstRow: layout?.template ? String(layout.template.firstRow) : "2",
      columns: (layout?.columns ?? [{ header: "", from: null }]).map((c) => ({ key: rowKey(), header: c.header, from: c.from as string | null })),
    };
  }, base);
  const { held, format, templateId, sheet, headerRow, firstRow, columns } = census;
  const set = (patch: Partial<typeof census>) => setCensus({ ...census, ...patch });
  const setColumns = (next: typeof columns) => set({ columns: next });
  const [problems, setProblems] = useState<ProfileProblem[]>([]);
  const headerInputs = useRef(new Map<number, HTMLInputElement>());
  const [focusKey, setFocusKey] = useState<number | null>(null);
  const sources = useSectionSources(base, today, ["census_layout"], () => ({
    ...base,
    censusLayout: held
      ? {
          peo: base.censusLayout?.peo ?? null,
          format: format as "csv" | "xlsx",
          template: templateId === "" ? null : { id: Number(templateId), sheet: sheet.trim(), headerRow: Number(headerRow), firstRow: Number(firstRow) },
          columns: columns.map((c) => ({ header: c.header.trim(), from: (c.from || null) as never })),
        }
      : null,
  } as EditableProfile));

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

  const build = () => sources.build(held ? undefined : { census_layout: { ...sources.shown.census_layout, kind: "none" } });

  return (
    <EditorShell section="census" peoId={peoId} basis={basis} build={build} onSaved={onSaved} onCancel={onCancel} onReload={onReload} problems={problems} setProblems={setProblems}>
      <div className="flex flex-wrap gap-x-4" role="radiogroup" aria-label="Census layout">
        <label className="flex items-center gap-2 min-h-11 text-sm"><input type="radio" checked={!held} onChange={() => set({ held: false })} /> Not checked yet (our own layout)</label>
        <label className="flex items-center gap-2 min-h-11 text-sm"><input type="radio" checked={held} onChange={() => set({ held: true })} /> The PEO's own layout</label>
      </div>
      {held && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id={`peo-${peoId}-census-format`} label="File" problem={problemAt(problems, "censusLayout.format")}>
              {(p) => (
                <select {...p} value={format} onChange={(e) => set({ format: e.target.value })} className={inputClass}>
                  <option value="xlsx">xlsx (a spreadsheet)</option>
                  <option value="csv">CSV</option>
                </select>
              )}
            </Field>
          </div>
          <TemplatePicker
            peoId={peoId}
            value={{ templateId, sheet, headerRow, firstRow }}
            // A template is an xlsx file filled in, so choosing one makes the file xlsx.
            onChange={(patch) => set({ ...patch, ...(patch.templateId ? { format: "xlsx" } : {}) })}
            problem={problemAt(problems, "censusLayout.template")}
          />
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
          <SourceFields id={srcId(peoId, "census_layout")} label={whereChecked("census_layout")} value={sources.shown.census_layout} onChange={sources.set("census_layout")} problems={problems} path="sources.census_layout" />
        </>
      )}
    </EditorShell>
  );
};

// ---------- Documents ----------

export const DocumentsEditor = ({ peoId, base, basis, today, onSaved, onCancel, onReload }: EditorProps) => {
  const [docs, setDocs] = useEdited(() => base.documents.map((d) => ({ key: rowKey(), category: d.category as string, description: d.description })), base);
  const [problems, setProblems] = useState<ProfileProblem[]>([]);
  const sources = useSectionSources(base, today, ["documents"], () =>
    ({ ...base, documents: docs.map((d) => ({ category: d.category as never, description: d.description.trim() })) }));

  return (
    <EditorShell section="documents" peoId={peoId} basis={basis} build={() => sources.build()} onSaved={onSaved} onCancel={onCancel} onReload={onReload} problems={problems} setProblems={setProblems}>
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
      <SourceFields id={srcId(peoId, "documents")} label={whereChecked("documents")} value={sources.shown.documents} onChange={sources.set("documents")} problems={problems} path="sources.documents" />
    </EditorShell>
  );
};

// ---------- Its own questions ----------

export const QuestionsEditor = ({ peoId, base, basis, today, onSaved, onCancel, onReload }: EditorProps) => {
  const [questions, setQuestions] = useEdited(
    () => base.extraQuestions.map((q) => ({ key: rowKey(), id: q.key, idTyped: true, text: q.text, kind: q.kind as string, choices: (q.choices ?? []).join("\n") })),
    base,
  );
  const [problems, setProblems] = useState<ProfileProblem[]>([]);
  const update = (key: number, patch: Partial<(typeof questions)[number]>) => setQuestions(questions.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  const sources = useSectionSources(base, today, ["extra_questions"], () => ({
    ...base,
    extraQuestions: questions.map((q) => ({
      key: q.id.trim(),
      text: q.text.trim(),
      kind: q.kind as never,
      ...(q.kind === "choice" ? { choices: lines(q.choices) } : {}),
    })),
  }));

  return (
    <EditorShell section="questions" peoId={peoId} basis={basis} build={() => sources.build()} onSaved={onSaved} onCancel={onCancel} onReload={onReload} problems={problems} setProblems={setProblems}>
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
      <SourceFields id={srcId(peoId, "extra_questions")} label={whereChecked("extra_questions")} value={sources.shown.extra_questions} onChange={sources.set("extra_questions")} problems={problems} path="sources.extra_questions" />
    </EditorShell>
  );
};

// ---------- Contacts ----------

export const ContactsEditor = ({ peoId, base, basis, today, onSaved, onCancel, onReload }: EditorProps) => {
  const [contacts, setContacts] = useEdited(() => base.contacts.map((c) => ({ key: rowKey(), name: c.name, role: c.role ?? "", email: c.email ?? "", phone: c.phone ?? "" })), base);
  const [problems, setProblems] = useState<ProfileProblem[]>([]);
  const orNull = (s: string) => (s.trim() === "" ? null : s.trim());
  const sources = useSectionSources(base, today, ["contacts"], () =>
    ({ ...base, contacts: contacts.map((c) => ({ name: c.name.trim(), role: orNull(c.role), email: orNull(c.email), phone: orNull(c.phone) })) }));
  const fields = [["name", "name"], ["role", "role"], ["email", "email"], ["phone", "phone"]] as const;

  return (
    <EditorShell section="contacts" peoId={peoId} basis={basis} build={() => sources.build()} onSaved={onSaved} onCancel={onCancel} onReload={onReload} problems={problems} setProblems={setProblems}>
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
      <SourceFields id={srcId(peoId, "contacts")} label={whereChecked("contacts")} value={sources.shown.contacts} onChange={sources.set("contacts")} problems={problems} path="sources.contacts" />
    </EditorShell>
  );
};
