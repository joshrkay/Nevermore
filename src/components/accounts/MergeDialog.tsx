import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FormActions, SaveRefused, useWorkspaceForm, WorkspaceForm } from "@/components/workspace/form";
import {
  ACCOUNT_MERGE_FIELDS, CONTACT_MERGE_FIELDS, MERGE_FIELD_LABELS, mergeWarning, type AccountMergeField, type ContactMergeField, type MergeChoice, type MergeKind,
} from "@/data/merge";
import { defaultMergeChoice, mergedWords, mergeMovesWords, mergeRecordName, mergeValueWords } from "@/data/mergeWords";
import { MergeError, mergeAccounts, mergeContacts, previewMerge, type MergePreview } from "@/lib/mergeApi";

// Merging two records on screen (story CRM-S4.3a, screen 37; D-203, D-210, D-640 to D-649, D-660 to D-669), the dialog for two accounts and for two contacts of one
// account. It asks the database's own preview (`merge_preview`) for both records with their versions, the fields that differ and what would move, shows them side by
// side with one choice for each field that differs, says exactly what will happen (and that there is no undo) before anything changes, and merges from the versions it
// showed. Who may merge them is the database's: when the preview says why the person may not, that is shown instead of the button. Fields use the shared form kit.

export interface MergedRecords {
  kind: MergeKind;
  kept: { id: string; name: string };
  removed: { id: string; name: string };
}

const FIELDS: Record<MergeKind, readonly (AccountMergeField | ContactMergeField)[]> = { account: ACCOUNT_MERGE_FIELDS, contact: CONTACT_MERGE_FIELDS };
const schema = z.object({ choices: z.record(z.string(), z.enum(["kept", "removed"])) });
const NOUN: Record<MergeKind, string> = { account: "account", contact: "contact" };

export function MergeDialog({ firmId, kind, keptId, removedId, onClose, onMerged }: {
  firmId: string;
  kind: MergeKind;
  /** The record the merge starts by keeping; the dialog lets the person keep the other one instead. */
  keptId: string;
  removedId: string;
  onClose: () => void;
  onMerged: (merged: MergedRecords) => void;
}) {
  const queryClient = useQueryClient();
  const [pair, setPair] = useState({ kept: keptId, removed: removedId });
  // Said above the choices when both records were asked again because one changed while the person was choosing.
  const [reloaded, setReloaded] = useState<string | null>(null);
  const key = ["merge-preview", firmId, kind, pair.kept, pair.removed];
  const preview = useQuery({ queryKey: key, queryFn: () => previewMerge(firmId, kind, pair.kept, pair.removed), retry: false, gcTime: 0, staleTime: 0, refetchOnWindowFocus: false });
  const data: MergePreview | null = preview.data ?? null;
  const keptName = data ? mergeRecordName(kind, data.kept) : "";
  const removedName = data ? mergeRecordName(kind, data.removed) : "";
  const differing = data ? FIELDS[kind].filter((f) => data.differs.includes(f)) : [];

  const api = useWorkspaceForm({
    schema,
    defaultValues: { choices: {} as Record<string, MergeChoice> },
    save: async (values) => {
      if (!data || data.problem) throw new SaveRefused("These can't be merged.");
      // Every field that differs is sent with the choice on screen, so what is merged is what the person was shown.
      const overrides = values.choices as Record<string, MergeChoice>;
      const choices = Object.fromEntries(differing.map((f) => [f, overrides[f] ?? defaultMergeChoice(f, data.kept, data.removed)]));
      const versions = { kept: data.kept.version, removed: data.removed.version };
      try {
        if (kind === "account") {
          const done = await mergeAccounts(firmId, data.kept.id, data.removed.id, choices, versions);
          return { done, words: mergedWords(kind, keptName, removedName, done.moved) };
        }
        const done = await mergeContacts(firmId, data.kept.id, data.removed.id, choices, versions);
        return { done, words: mergedWords(kind, keptName, removedName, { activities: done.moved.activities }) };
      } catch (e) {
        if (e instanceof MergeError && e.kind === "changed") {
          // Nothing was merged. Both are asked again, and the choices start over from what they hold now.
          setReloaded("Both are shown again as they are now. Check your choices before merging.");
          api.form.reset({ choices: {} });
          void queryClient.invalidateQueries({ queryKey: key });
          throw new SaveRefused(e.message);
        }
        if (e instanceof MergeError) throw new SaveRefused(e.message);
        throw e;
      }
    },
    onSaved: ({ words }) => {
      toast.success(words);
      onMerged({ kind, kept: { id: data?.kept.id ?? pair.kept, name: keptName }, removed: { id: data?.removed.id ?? pair.removed, name: removedName } });
    },
    failureMessage: "Couldn't merge. Check your connection and try again.",
    onCancel: onClose,
  });

  const overrides = (api.form.watch("choices") ?? {}) as Record<string, MergeChoice>;
  const chosen = (f: string): MergeChoice => (data ? overrides[f] ?? defaultMergeChoice(f, data.kept, data.removed) : "kept");
  const choose = (f: string, c: MergeChoice) => api.form.setValue("choices", { ...overrides, [f]: c }, { shouldDirty: true });
  const swap = () => {
    setPair((p) => ({ kept: p.removed, removed: p.kept }));
    setReloaded(null);
    api.form.reset({ choices: {} });
  };

  const title = `Merge two ${NOUN[kind]}s`;
  return (
    <Dialog open onOpenChange={(next) => { if (!next) api.requestClose(onClose); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogTitle className="font-display text-xl font-bold">{title}</DialogTitle>
        <DialogDescription>
          Choose which {NOUN[kind]} to keep, then which value to keep for each field that differs. Nothing changes until you press Merge.
        </DialogDescription>
        {preview.isPending && <p role="status" className="text-sm text-muted-foreground">Loading both {NOUN[kind]}s…</p>}
        {preview.isError && (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-destructive">{(preview.error as Error).message}</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => void preview.refetch()}>Try again</Button>
              <Button type="button" onClick={onClose}>Close</Button>
            </div>
          </div>
        )}
        {data && (
          <WorkspaceForm
            api={api}
            aria-label={title}
            actions={data.problem ? <div className="flex justify-end"><Button type="button" onClick={onClose}>Close</Button></div> : <FormActions submitLabel="Merge" savingLabel="Merging…" />}
          >
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/40 p-3 text-sm">
              <p className="flex-1">
                <span className="text-muted-foreground">Keeping </span><strong className="font-semibold">{keptName}</strong>
                <span className="text-muted-foreground">. </span><strong className="font-semibold">{removedName}</strong><span className="text-muted-foreground"> will be removed.</span>
              </p>
              <Button type="button" variant="outline" size="sm" disabled={api.saving} onClick={swap}>Keep {removedName} instead</Button>
            </div>
            {reloaded && <p role="alert" className="text-sm text-warning">{reloaded}</p>}
            {data.problem ? (
              <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{data.problem}</p>
            ) : (
              <>
                {differing.length === 0 ? (
                  <p className="text-sm">Nothing differs between them: every field is the same.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <div role="group" aria-label="Which value to keep" className="min-w-[32rem] space-y-1">
                      <div aria-hidden="true" className="grid grid-cols-[8rem_1fr_1fr] gap-3 px-2 text-xs font-medium text-muted-foreground">
                        <span />
                        <span>{keptName} (kept)</span>
                        <span>{removedName} (removed)</span>
                      </div>
                      {differing.map((f) => (
                        <fieldset key={f} className="grid grid-cols-[8rem_1fr_1fr] items-center gap-3 rounded-md border border-border p-2">
                          <legend className="sr-only">{MERGE_FIELD_LABELS[f]}</legend>
                          <span aria-hidden="true" className="text-sm font-medium">{MERGE_FIELD_LABELS[f]}</span>
                          {(["kept", "removed"] as const).map((side) => (
                            <label key={side} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-sm hover:bg-muted">
                              {/* Enter on a radio must not submit the form: a merge is made from the Merge button only. */}
                              <input type="radio" name={`merge-${f}`} checked={chosen(f) === side} onChange={() => choose(f, side)} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} />
                              <span className="break-words">{mergeValueWords(f, (side === "kept" ? data.kept : data.removed)[f])}<span className="sr-only">, {side}</span></span>
                            </label>
                          ))}
                        </fieldset>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-1 rounded-md border border-border bg-muted/40 p-3 text-sm">
                  <p className="font-semibold">What will happen</p>
                  <p>{mergeWarning(kind, keptName, removedName)}</p>
                  {mergeMovesWords(kind, data.moves, keptName).map((line) => <p key={line}>{line}</p>)}
                </div>
              </>
            )}
          </WorkspaceForm>
        )}
      </DialogContent>
    </Dialog>
  );
}
