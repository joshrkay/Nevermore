import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { dateRule, Field, FormActions, SaveRefused, SelectInput, useWorkspaceForm, WorkspaceForm } from "@/components/workspace/form";
import { formatDay, formatWhen, STAGE_LABELS } from "@/data/accountPage";
import { isConflict } from "@/lib/recordVersion";
import { adminFeeWords } from "@/data/opportunityPage";
import { COMMISSION_BASES, commissionArithmetic, expectedCommissionYearly, LOST_REASONS, renewalAfter } from "@/data/opportunityClose";
import {
  markOpportunityLost, markOpportunityWon, OpportunityError, type OpportunityCloseConflict, type OpportunityClosed, type OpportunityQuote, type PlacementCommission,
} from "@/lib/opportunityPageApi";

// Mark won or lost (story CRM-O1.3b, screen 26; D-461 to D-468). One dialog, opened from the opportunity's header and from the console's stage control (D-470). It
// offers only the quotes the employer could have taken (D-463), lists what a win will do before it is done (D-464), defaults the dates, broker and commission as
// D-465 and D-466 say, and asks a lost search for its reason (D-468). The database decides every rule; its refusals are said in its own words beside the button. If
// someone changed the opportunity first nothing is done, and the dialog says who changed what and offers a reload (D-46).

const MONEY = /^\d+(\.\d{1,2})?$/;

/** The dialog's rules, in words, before anything is sent. The database asks the same and says the rest. */
export const closeSchema = z.object({
  outcome: z.string(),
  quote: z.string(),
  start_date: dateRule(),
  renewal_date: dateRule(),
  broker: z.string().trim(),
  commission_basis: z.string(),
  commission_rate: z.string().trim(),
  commission_yearly: z.string().trim(),
  reason: z.string(),
  note: z.string().trim(),
}).superRefine((v, ctx) => {
  const say = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  if (v.outcome !== "won" && v.outcome !== "lost") return say("outcome", "Choose won or lost.");
  if (v.outcome === "lost") {
    if (v.reason === "") say("reason", "Choose why the search was lost.");
    else if (v.reason === "other" && v.note === "") say("note", "Say what happened. Other needs a note.");
    if (v.note.length > 500) say("note", "Keep the note to 500 characters.");
    return;
  }
  if (v.quote === "") say("quote", "Choose the quote the employer took.");
  if (v.start_date === "") say("start_date", "Give the start date.");
  if (v.renewal_date === "") say("renewal_date", "Give the renewal date.");
  else if (v.start_date !== "" && v.renewal_date <= v.start_date) say("renewal_date", "The renewal must come after the start.");
  if (v.broker === "") say("broker", "Say who the broker of record is.");
  else if (v.broker.length > 120) say("broker", "Keep the broker of record to 120 characters.");
  if (v.commission_basis !== "") {
    const rate = Number(v.commission_rate);
    if (!MONEY.test(v.commission_rate) || rate <= 0) say("commission_rate", "Enter the commission's number, like 20.");
    else if (v.commission_basis === "share" && rate > 100) say("commission_rate", "A share is a percent: 100 at most.");
  }
  if (v.commission_yearly !== "" && !MONEY.test(v.commission_yearly)) say("commission_yearly", "Enter the expected commission in dollars, like 7650.");
});

export interface CloseTarget {
  id: string;
  /** The version the page loaded: the close is made from it, and refused as a conflict if someone saved first (D-46). */
  version: number;
  name: string;
  targetStart: string | null;
  /** The opportunity's employees, else the certified census size: what the expected commission is worked from (D-466). */
  employees: number | null;
}

/** Words the database's column names for the stale notice. */
const fieldWords = (field: string) => field.replace(/_/g, " ");

export function CloseOpportunityDialog({ firmId, target, accountName, quotes, proposedStarts, brokerDefault, initial, onClose, onDone }: {
  firmId: string;
  target: CloseTarget;
  accountName: string;
  quotes: readonly OpportunityQuote[];
  /** By quote request id: the start the PEO proposed, the win's default start (D-465). */
  proposedStarts: Readonly<Record<number, string | null>>;
  /** The firm's name, offered as the broker of record (D-465). */
  brokerDefault: string;
  /** What the person chose to do: "" lets them choose (Won first when a quote can be taken). */
  initial: "won" | "lost" | "";
  onClose: () => void;
  /** The close went through (or the person asked to reload): the page asks the database again. */
  onDone: (closed: OpportunityClosed | null) => void;
}) {
  const quoted = quotes.filter((q) => q.status === "quoted");
  const canWin = quoted.length > 0;
  const noQuote = "Won needs a quote the employer took. None of this opportunity's quotes is quoted yet";
  // Lost when asked for; Won when asked for (or not asked) and a quote can be taken; otherwise the person chooses.
  const start = initial === "lost" ? "lost" : canWin ? "won" : "";
  const defaults = {
    outcome: start, quote: quoted.length === 1 ? String(quoted[0].id) : "", start_date: "", renewal_date: "", broker: brokerDefault, commission_basis: "", commission_rate: "",
    commission_yearly: "", reason: "", note: "",
  };
  const startFor = (quoteId: string) => (quoteId === "" ? "" : proposedStarts[Number(quoteId)] ?? target.targetStart ?? "");
  const [conflict, setConflict] = useState<OpportunityCloseConflict | null>(null);

  const api = useWorkspaceForm({
    schema: closeSchema,
    defaultValues: { ...defaults, start_date: startFor(defaults.quote), renewal_date: renewalAfter(startFor(defaults.quote)) },
    version: target.version,
    save: async (v, started): Promise<OpportunityClosed | OpportunityCloseConflict> => {
      if (started.version === undefined) throw new SaveRefused("Couldn't save. Reload the page and try again.");
      try {
        if (v.outcome === "lost") return await markOpportunityLost(firmId, target.id, { reason: v.reason, note: v.note }, started.version);
        const commission: PlacementCommission | null = v.commission_basis === "" ? null : {
          basis: v.commission_basis as PlacementCommission["basis"], rate: Number(v.commission_rate), expectedYearly: v.commission_yearly === "" ? null : Number(v.commission_yearly),
        };
        return await markOpportunityWon(firmId, target.id, { quoteRequestId: Number(v.quote), startDate: v.start_date, renewalDate: v.renewal_date, brokerOfRecord: v.broker, commission }, started.version);
      } catch (e) {
        if (e instanceof OpportunityError && e.kind !== "failed") throw new SaveRefused(e.message);
        throw e;
      }
    },
    savedValues: (_r, values) => values,
    onSaved: (result, values) => {
      if (isConflict(result)) {
        setConflict(result);
        return;
      }
      toast.success(values.outcome === "won" ? "Marked won" : "Marked lost");
      onDone(result);
      onClose();
    },
    failureMessage: "Couldn't save. Check your connection and try again.",
    onCancel: onClose,
  });

  const { form } = api;
  const outcome = form.watch("outcome") as string;
  const quoteId = form.watch("quote") as string;
  const startDay = form.watch("start_date") as string;
  const basis = form.watch("commission_basis") as string;
  const rate = form.watch("commission_rate") as string;
  const chosen = quoted.find((q) => String(q.id) === quoteId) ?? null;

  // What the person typed is kept: a default only fills a field they have not touched.
  const typed = useRef({ start: false, renewal: false, yearly: false });
  useEffect(() => {
    if (!typed.current.start) form.setValue("start_date", startFor(quoteId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId]);
  useEffect(() => {
    if (!typed.current.renewal) form.setValue("renewal_date", renewalAfter(startDay));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDay]);
  const figures = { basis, rate: Number(rate), adminFeePepm: chosen?.adminFeePepm ?? null, employees: target.employees };
  const worked = MONEY.test(rate) ? expectedCommissionYearly(figures) : null;
  useEffect(() => {
    if (!typed.current.yearly) form.setValue("commission_yearly", worked === null ? "" : String(worked));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worked]);

  const renewal = form.watch("renewal_date") as string;
  const closing = outcome === "won" ? quotes.filter((q) => q.id !== chosen?.id && (q.status === "sent" || q.status === "quoted")) : [];
  const basisNow = COMMISSION_BASES.find((b) => b.value === basis);
  const arithmetic = MONEY.test(rate) ? commissionArithmetic(figures) : null;

  return (
    <Dialog open onOpenChange={(open) => {
      if (open) return;
      if (conflict) onClose();
      else api.cancel?.();
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Close this opportunity</DialogTitle>
          <DialogDescription>{target.name} · {accountName}</DialogDescription>
        </DialogHeader>
        {conflict ? (
          <div className="space-y-3">
            <h3 className="font-medium">Someone else changed this opportunity</h3>
            <p className="text-sm">It is now {STAGE_LABELS[conflict.stage]}. Nothing was saved.</p>
            {conflict.changed.length > 0 && (
              <ul className="space-y-1 text-sm text-muted-foreground">
                {conflict.changed.map((c) => <li key={c.field}>{fieldWords(c.field)} changed by {c.who}, {formatWhen(c.at)}</li>)}
              </ul>
            )}
            <div className="flex justify-end">
              <Button type="button" onClick={() => { onDone(null); onClose(); }}>Reload the opportunity</Button>
            </div>
          </div>
        ) : (
          <WorkspaceForm
            api={api}
            aria-label="Close this opportunity"
            actions={<FormActions submitLabel={outcome === "won" ? "Mark won" : outcome === "lost" ? "Mark lost" : "Close opportunity"} savingLabel="Saving…" />}
          >
            <Field name="outcome" label="Outcome" required>
              {(field) => (
                <div role="radiogroup" aria-label="Outcome" className="grid gap-2 sm:grid-cols-2">
                  <label className={`flex items-center gap-2 rounded-md border p-3 text-sm ${canWin ? "" : "opacity-60"}`}>
                    <input type="radio" name="outcome" value="won" checked={field.value === "won"} disabled={!canWin} aria-describedby={canWin ? undefined : "won-needs-a-quote"} onChange={() => field.onChange("won")} />
                    <span><strong className="font-medium">Won</strong> · the employer took a quote</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
                    <input type="radio" name="outcome" value="lost" checked={field.value === "lost"} onChange={() => field.onChange("lost")} />
                    <span><strong className="font-medium">Lost</strong> · the search ended without one</span>
                  </label>
                </div>
              )}
            </Field>
            {!canWin && <p id="won-needs-a-quote" className="text-sm text-muted-foreground">{noQuote}</p>}

            {outcome === "won" && (
              <>
                <Field name="quote" label="Which quote did they take?" required>
                  {(field) => (
                    <div role="radiogroup" aria-label="Which quote did they take?" className="space-y-2">
                      {quoted.map((q) => (
                        <label key={q.id} className="flex items-center gap-2 rounded-md border p-3 text-sm">
                          <input type="radio" name="quote" value={q.id} checked={field.value === String(q.id)} onChange={() => field.onChange(String(q.id))} />
                          <span className="flex-1"><strong className="font-medium">{q.peoName}</strong>{q.adminFeePepm !== null && <> · {adminFeeWords(q.adminFeePepm)}</>}</span>
                          <span className="rounded bg-primary/10 px-2 py-0.5 text-xs">Quoted</span>
                        </label>
                      ))}
                    </div>
                  )}
                </Field>
                <h3 className="pt-1 text-sm font-medium text-muted-foreground">The placement</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field name="start_date" label="Start date" required>
                    {(field) => <Input {...field} type="date" onChange={(e) => { typed.current.start = true; field.onChange(e); }} />}
                  </Field>
                  <Field name="renewal_date" label="Renewal date" required>
                    {(field) => <Input {...field} type="date" onChange={(e) => { typed.current.renewal = true; field.onChange(e); }} />}
                  </Field>
                  <Field name="broker" label="Broker of record" required>{(field) => <Input {...field} maxLength={200} />}</Field>
                </div>
                <h3 className="pt-1 text-sm font-medium text-muted-foreground">Commission (optional)</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field name="commission_basis" label="Commission basis">
                    {(field) => (
                      <SelectInput {...field}>
                        <option value="">None recorded</option>
                        {COMMISSION_BASES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                      </SelectInput>
                    )}
                  </Field>
                  {basisNow && <Field name="commission_rate" label={basisNow.numberLabel}>{(field) => <Input {...field} inputMode="decimal" />}</Field>}
                  {basisNow && (
                    <Field name="commission_yearly" label="Expected commission, a year" help={arithmetic}>
                      {(field) => <Input {...field} inputMode="decimal" onChange={(e) => { typed.current.yearly = true; field.onChange(e); }} />}
                    </Field>
                  )}
                </div>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground" aria-label="What marking it won does">
                  {chosen && <li>{accountName} becomes a client.</li>}
                  {closing.map((q) => <li key={q.id}>{q.peoName}'s open quote is closed.</li>)}
                  {chosen && renewal !== "" && <li>A renewal for {formatDay(renewal)} is added to the account.</li>}
                </ul>
              </>
            )}

            {outcome === "lost" && (
              <>
                <Field name="reason" label="Reason" required>
                  {(field) => (
                    <SelectInput {...field}>
                      <option value="">Choose a reason</option>
                      {LOST_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </SelectInput>
                  )}
                </Field>
                <Field name="note" label="Note" help="Up to 500 characters. Other needs a note.">{(field) => <Textarea {...field} rows={3} />}</Field>
              </>
            )}
          </WorkspaceForm>
        )}
      </DialogContent>
    </Dialog>
  );
}
