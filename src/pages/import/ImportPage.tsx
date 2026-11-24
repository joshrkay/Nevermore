import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useWorkspace } from "@/components/workspace/useWorkspace";
import { LoadFailed } from "@/components/workspace/states";
import { failureWords, SaveFailed } from "@/components/workspace/form";
import {
  buildRows, IMPORT_FIELDS, IMPORT_KIND_LABELS, IMPORT_LIMITS, matchingProblem, proposeMatches, readImportFile, type ImportCounts, type ImportKind, type ImportProblem,
} from "@/data/import";
import { loadImportProblems, loadImports, reviewImport, runImport, undoImport, type ImportReview, type PastImport } from "@/lib/importApi";
import { csvField, csvLines } from "@/lib/csv";
import { downloadBlob } from "@/lib/downloadFile";

const panel = "rounded-xl border border-border bg-card p-4 sm:p-5 space-y-4 min-w-0";
const input = "w-full min-h-11 bg-muted border border-border rounded-md px-3 py-2 text-sm";
const button = "inline-flex items-center justify-center min-h-11 px-3 rounded-md border border-border text-sm hover:bg-muted disabled:opacity-50";
const primary = "inline-flex items-center justify-center min-h-11 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50";
const n = (x: number) => x.toLocaleString("en-US");
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

type File_ = { name: string; headers: string[]; rows: string[][] };
type Step =
  | { at: "choose" }
  | { at: "match" }
  | { at: "review"; review: ImportReview }
  | { at: "done"; counts: ImportCounts; importId: string };

/** The rows that made nothing, as a file to fix and import again: each row's number in the person's file, what happened and why. */
function problemsCsv(problems: ImportProblem[]): string {
  return csvLines([["Row", "What happened", "Why"].map(csvField), ...problems.map((p) => [p.row, p.outcome === "exists" ? "Already here" : "Not imported", p.reason ?? ""].map(csvField))]);
}

/**
 * Import (CRM-X4.1, BR-5.1): an owner or a lead brings a book in from a CSV. Choose leads or accounts with their contacts, match each column to a field, read
 * what the import would make, then run it. The file is read in the browser and never stored; the database decides what each row makes. Each import is listed
 * below with who ran it and can be undone as a whole for 30 days. An import contacts nobody.
 */
const ImportPage = () => {
  const id = useId();
  const { firm, isOwner, role } = useWorkspace();
  const mayImport = isOwner || role === "Lead";
  const firmId = firm?.id ?? null;
  const [kind, setKind] = useState<ImportKind>("accounts");
  const [file, setFile] = useState<File_ | null>(null);
  const [fileProblem, setFileProblem] = useState<string | null>(null);
  const [matches, setMatches] = useState<(string | null)[]>([]);
  const [step, setStep] = useState<Step>({ at: "choose" });
  const [busy, setBusy] = useState<{ what: "Checking" | "Importing"; done: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [past, setPast] = useState<{ kind: "loading" } | { kind: "error"; error: Error } | { kind: "ready"; imports: PastImport[] }>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!firmId || !mayImport) return;
    let cancelled = false;
    loadImports(firmId).then((imports) => !cancelled && setPast({ kind: "ready", imports }), (error: Error) => !cancelled && setPast({ kind: "error", error }));
    return () => { cancelled = true; };
  }, [firmId, mayImport, attempt]);

  const rows = useMemo(() => (file ? buildRows(file.rows, matches) : []), [file, matches]);
  const matching = file ? matchingProblem(kind, matches) : null;

  const choose = async (picked: File | undefined) => {
    setFileProblem(null);
    setProblem(null);
    setFile(null);
    setStep({ at: "choose" });
    if (!picked) return;
    const read = readImportFile(await picked.text());
    if ("problem" in read) { setFileProblem(read.problem); return; }
    setFile({ name: picked.name, headers: read.headers, rows: read.rows });
    setMatches(proposeMatches(kind, read.headers));
    setStep({ at: "match" });
  };

  const changeKind = (next: ImportKind) => {
    setKind(next);
    if (file) { setMatches(proposeMatches(next, file.headers)); setStep({ at: "match" }); }
  };

  const review = useCallback(async () => {
    if (!firmId) return;
    setProblem(null);
    setBusy({ what: "Checking", done: 0 });
    try {
      setStep({ at: "review", review: await reviewImport(firmId, kind, rows, (done) => setBusy({ what: "Checking", done })) });
    } catch (err) {
      setProblem(failureWords(err, "We couldn't check the file. Check your connection and try again."));
    } finally {
      setBusy(null);
    }
  }, [firmId, kind, rows]);

  const run = async () => {
    if (!firmId || !file) return;
    setProblem(null);
    setBusy({ what: "Importing", done: 0 });
    try {
      const made = await runImport(firmId, kind, file.name, rows, (done) => setBusy({ what: "Importing", done }));
      setStep({ at: "done", counts: made, importId: made.importId });
      toast.success(`${n(made.created)} ${made.created === 1 ? "record was" : "records were"} imported.`);
    } catch (err) {
      setProblem(failureWords(err, "The import didn't finish. Check your connection and try again."));
    } finally {
      setBusy(null);
      setAttempt((a) => a + 1);
    }
  };

  const undo = async (i: PastImport) => {
    if (!firmId) return;
    setProblem(null);
    try {
      const r = await undoImport(firmId, i.id);
      toast.success(r.kept > 0
        ? `Undone: ${n(r.removed)} removed. ${n(r.kept)} kept because ${r.kept === 1 ? "it has" : "they have"} moved on since (a converted lead, or an account with an opportunity).`
        : `Undone: ${n(r.removed)} removed.`);
    } catch (err) {
      setProblem(failureWords(err, "The import wasn't undone. Check your connection and try again."));
    } finally {
      setAttempt((a) => a + 1);
    }
  };

  const downloadProblems = async (importId: string | null, known?: ImportProblem[]) => {
    if (!firmId) return;
    try {
      const problems = known ?? (importId ? await loadImportProblems(firmId, importId) : []);
      downloadBlob(new Blob([problemsCsv(problems)], { type: "text/csv;charset=utf-8" }), "rows-not-imported.csv");
    } catch (err) {
      setProblem(failureWords(err, "Couldn't make that file. Try again."));
    }
  };

  if (!mayImport) {
    return (
      <main className="container mx-auto px-4 sm:px-6 py-8 max-w-3xl">
        <h1 className="font-display text-3xl font-bold mb-3">Import</h1>
        <p className="text-sm">Only an owner or a lead of the firm imports. You can add a lead or an account one at a time from <Link to="/leads" className="text-primary underline">Leads</Link> or <Link to="/accounts" className="text-primary underline">Accounts</Link>.</p>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 sm:px-6 py-8 max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold mb-1">Import</h1>
        <p className="text-sm text-muted-foreground">
          Bring your book in from a CSV: up to {n(IMPORT_LIMITS.max_rows)} rows a file. Nobody is contacted, and the file itself is not kept. An import can be undone as a whole for {IMPORT_LIMITS.undo_days} days.
        </p>
      </div>

      <section aria-labelledby={`${id}-choose`} className={panel}>
        <h2 id={`${id}-choose`} className="font-semibold">1. Choose what the file holds, and the file</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor={`${id}-kind`} className="text-sm font-medium">What the file holds</label>
            <select id={`${id}-kind`} value={kind} disabled={busy !== null} onChange={(e) => changeKind(e.target.value as ImportKind)} className={input}>
              {(Object.keys(IMPORT_KIND_LABELS) as ImportKind[]).map((k) => <option key={k} value={k}>{IMPORT_KIND_LABELS[k]}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor={`${id}-file`} className="text-sm font-medium">CSV file</label>
            <input id={`${id}-file`} type="file" accept=".csv,text/csv" disabled={busy !== null} onChange={(e) => void choose(e.target.files?.[0])} className={input} />
          </div>
        </div>
        <SaveFailed message={fileProblem} className="font-normal" />
      </section>

      {file && step.at !== "done" && (
        <section aria-labelledby={`${id}-match`} className={panel}>
          <h2 id={`${id}-match`} className="font-semibold">2. Match each column to a field</h2>
          <p className="text-sm text-muted-foreground">{`${file.name}: ${n(file.rows.length)} ${file.rows.length === 1 ? "row" : "rows"}. We proposed a field where a column's name reads as one; change any that are wrong.`}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border"><th scope="col" className="py-2 pr-4">Column in your file</th><th scope="col" className="py-2 pr-4">First value</th><th scope="col" className="py-2">Field</th></tr>
              </thead>
              <tbody>
                {file.headers.map((h, c) => (
                  <tr key={c} className="border-b border-border last:border-0">
                    <th scope="row" className="py-2 pr-4 font-medium align-middle">{h || `Column ${c + 1}`}</th>
                    <td className="py-2 pr-4 text-muted-foreground align-middle max-w-48 truncate">{file.rows.find((r) => (r[c] ?? "").trim() !== "")?.[c] ?? ""}</td>
                    <td className="py-2">
                      <select aria-label={`Field for ${h || `column ${c + 1}`}`} value={matches[c] ?? ""} disabled={busy !== null}
                        onChange={(e) => { setMatches(matches.map((m, i) => (i === c ? e.target.value || null : m))); setStep({ at: "match" }); }} className={input}>
                        <option value="">Don't import</option>
                        {IMPORT_FIELDS[kind].map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {matching && <p role="status" className="text-sm text-warning">{matching}</p>}
          <button type="button" className={primary} disabled={busy !== null || matching !== null} onClick={() => void review()}>Check the file</button>
        </section>
      )}

      {busy && (
        <p role="status" className="text-sm">
          {`${busy.what} ${n(busy.done)} of ${n(rows.length)} rows…`}
          {busy.what === "Importing" && " You can leave this page: what has been imported stays, and the import is listed below."}
        </p>
      )}
      <SaveFailed message={problem} className="font-normal" />

      {file && step.at === "review" && (
        <section aria-labelledby={`${id}-review`} className={panel}>
          <h2 id={`${id}-review`} className="font-semibold">3. Review, then import</h2>
          <ul aria-label="What the import will do" className="text-sm space-y-1">
            <li>{`${n(step.review.create)} ${step.review.create === 1 ? "row" : "rows"} will make a new ${kind === "leads" ? "lead" : "account"}.`}</li>
            <li>{`${n(step.review.exists)} already here, and will be left as they are.`}</li>
            <li>{`${n(step.review.failed)} can't be imported.`}</li>
          </ul>
          <Problems problems={step.review.problems} onDownload={() => void downloadProblems(null, step.review.problems)} />
          <button type="button" className={primary} disabled={busy !== null || step.review.create === 0} onClick={() => void run()}>
            {`Import ${n(step.review.create)} ${step.review.create === 1 ? "row" : "rows"}`}
          </button>
          {step.review.create === 0 && <p className="text-sm text-muted-foreground">Nothing in this file would make a new record.</p>}
        </section>
      )}

      {step.at === "done" && (
        <section aria-labelledby={`${id}-done`} className={panel}>
          <h2 id={`${id}-done`} className="font-semibold">Imported</h2>
          <p className="text-sm">{`${n(step.counts.created)} made, ${n(step.counts.exists)} already here, ${n(step.counts.failed)} not imported.`}</p>
          <div className="flex flex-wrap gap-2">
            <Link to={kind === "leads" ? "/leads" : "/accounts"} className={primary}>{kind === "leads" ? "Open Leads" : "Open Accounts"}</Link>
            {step.counts.exists + step.counts.failed > 0 && <button type="button" className={button} onClick={() => void downloadProblems(step.importId)}>Download the rows that weren't imported</button>}
          </div>
        </section>
      )}

      <section aria-labelledby={`${id}-past`} className={panel}>
        <h2 id={`${id}-past`} className="font-semibold">Imports</h2>
        {past.kind === "loading" && <p role="status" className="text-sm text-muted-foreground">Loading the imports…</p>}
        {past.kind === "error" && <LoadFailed error={past.error} what="the imports" onRetry={() => setAttempt((a) => a + 1)} />}
        {past.kind === "ready" && (past.imports.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing has been imported yet.</p>
        ) : (
          <ul aria-label="Imports" className="divide-y divide-border">
            {past.imports.map((i) => (
              <li key={i.id} className="py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <span className="flex-1 min-w-0">
                  <span className="block font-medium">{i.fileName ?? "A file"} <span className="font-normal text-muted-foreground">· {IMPORT_KIND_LABELS[i.kind]}</span></span>
                  <span className="block text-muted-foreground">
                    {`${day(i.createdAt)}${i.createdBy ? ` by ${i.createdBy}` : ""} · ${n(i.created)} made, ${n(i.exists)} already here, ${n(i.failed)} not imported`}
                    {i.undoneAt ? ` · Undone ${day(i.undoneAt)}` : ""}
                  </span>
                </span>
                {i.exists + i.failed > 0 && <button type="button" className={button} onClick={() => void downloadProblems(i.id)} aria-label={`Download the rows of ${i.fileName ?? "this import"} that weren't imported`}>Rows not imported</button>}
                {i.canUndo && <button type="button" className={button} onClick={() => void undo(i)} aria-label={`Undo the import of ${i.fileName ?? "this file"}`}>Undo</button>}
              </li>
            ))}
          </ul>
        ))}
      </section>
    </main>
  );
};

const SHOWN = 20;
const Problems = ({ problems, onDownload }: { problems: ImportProblem[]; onDownload: () => void }) => {
  if (problems.length === 0) return null;
  return (
    <div className="space-y-2">
      <ul aria-label="Rows that won't be imported" className="text-sm border border-border rounded-lg divide-y divide-border">
        {problems.slice(0, SHOWN).map((p) => (
          <li key={p.row} className="px-3 py-2"><span className="font-medium">{`Row ${n(p.row)}`}</span>{`: ${p.reason ?? (p.outcome === "exists" ? "Already here" : "Can't be imported")}`}</li>
        ))}
      </ul>
      {problems.length > SHOWN && <p className="text-sm text-muted-foreground">{`And ${n(problems.length - SHOWN)} more.`}</p>}
      <button type="button" className={button} onClick={onDownload}>Download these rows, to fix and import again</button>
    </div>
  );
};

export default ImportPage;
