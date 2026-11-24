// The firm's own opening text for its messages to a PEO or carrier (BR-3.5, P-3.2). An owner keeps it; every agent's composer opens with it and the agent
// still edits before sending.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LoadFailed } from "@/components/workspace/states";
import { failureWords, SaveFailed } from "@/components/workspace/form";
import { TEMPLATE_FIELDS, TEMPLATE_KINDS, TEMPLATE_MAX, TEMPLATE_WORDS, type FirmTemplates, type TemplateKind } from "@/data/messageTemplates";
import { loadFirmTemplates, saveFirmTemplate } from "@/lib/templatesApi";

type Load = { kind: "loading" } | { kind: "error"; error: Error } | { kind: "ready"; saved: FirmTemplates };

export const MessageTemplates = ({ firmId }: { firmId: string }) => {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [drafts, setDrafts] = useState<FirmTemplates>({});
  const [busy, setBusy] = useState<TemplateKind | null>(null);
  const [problem, setProblem] = useState<{ kind: TemplateKind; words: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoad({ kind: "loading" });
    loadFirmTemplates(firmId).then(
      (saved) => { if (!cancelled) { setLoad({ kind: "ready", saved }); setDrafts(saved); } },
      (error: Error) => !cancelled && setLoad({ kind: "error", error }),
    );
    return () => { cancelled = true; };
  }, [firmId, attempt]);

  if (load.kind === "loading") return <p role="status" className="text-sm text-muted-foreground">Loading your templates…</p>;
  if (load.kind === "error") return <LoadFailed what="your templates" error={load.error} onRetry={() => setAttempt((n) => n + 1)} />;

  const save = async (kind: TemplateKind, body: string) => {
    setBusy(kind);
    setProblem(null);
    try {
      await saveFirmTemplate(firmId, kind, body);
      const clean = body.trim();
      const saved = { ...load.saved };
      if (clean) saved[kind] = clean; else delete saved[kind];
      setLoad({ kind: "ready", saved });
      setDrafts((d) => ({ ...d, [kind]: clean }));
      toast.success(clean ? `The ${TEMPLATE_WORDS[kind].label.toLowerCase()} template is saved.` : `The ${TEMPLATE_WORDS[kind].label.toLowerCase()} opens with our text again.`);
    } catch (err) {
      setProblem({ kind, words: failureWords(err, "The template wasn't saved. Check your connection and try again.") });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">
        What your firm's messages to a PEO or carrier open with. Whoever sends still edits the words first, and what we add under every message (the link and
        what it opens) is not part of a template.
      </p>
      <p className="text-xs text-muted-foreground">
        {"You can name: "}
        {TEMPLATE_FIELDS.map((f, i) => <span key={f.name}>{i > 0 && ", "}<code>{`{${f.name}}`}</code>{` ${f.means}`}</span>)}
        {". Each is filled in when the message is opened."}
      </p>
      {TEMPLATE_KINDS.map((kind) => {
        const draft = drafts[kind] ?? "";
        const saved = load.saved[kind] ?? "";
        return (
          <form key={kind} aria-label={`${TEMPLATE_WORDS[kind].label} template`} className="space-y-1" onSubmit={(e) => { e.preventDefault(); void save(kind, draft); }}>
            <label className="block space-y-1">
              <span className="font-medium">{TEMPLATE_WORDS[kind].label}</span>
              <span className="block text-xs text-muted-foreground">{TEMPLATE_WORDS[kind].help}</span>
              <textarea
                value={draft} rows={5} maxLength={TEMPLATE_MAX}
                placeholder="Ours is used until you write your own."
                onChange={(e) => setDrafts((d) => ({ ...d, [kind]: e.target.value }))}
                className="w-full bg-muted border border-border rounded-md px-3 py-2"
              />
            </label>
            <SaveFailed message={problem?.kind === kind ? problem.words : null} className="font-normal" />
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={busy !== null || draft.trim() === saved} className="min-h-11 px-4 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-60">Save</button>
              {saved && (
                <button type="button" disabled={busy !== null} onClick={() => void save(kind, "")} className="min-h-11 px-4 rounded-md border border-border disabled:opacity-60">Use ours again</button>
              )}
            </div>
          </form>
        );
      })}
    </div>
  );
};

export default MessageTemplates;
