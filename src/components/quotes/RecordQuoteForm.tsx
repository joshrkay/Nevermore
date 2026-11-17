import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { QuoteLinesField, type LineColumn } from "@/components/quotes/QuoteLinesField";
import { SaveFailed, useOfflineSave, useSaveFailure } from "@/components/workspace/form";
import { QUOTE_ADMIN_FEE_BASES, QUOTE_KINDS, QUOTE_KIND_LABELS, QUOTE_NOTE_MAX, QUOTE_TIERS, type QuoteTier, type QuoteAdminFeeBasis, type QuoteKind } from "@/data/quoteRequests";
import { recordQuote, type QuoteRequestRow } from "@/lib/advisorApi";

const inputClass = "w-full bg-muted border border-border rounded-md px-3 py-2 text-sm";
const FEE_BASIS_LABELS: Record<QuoteAdminFeeBasis, string> = { per_employee_per_month: "Per employee per month ($)", percent_of_payroll: "Percent of payroll (%)" };

type Lines = Record<string, string>[];
const ONE_OFF_COLUMNS: LineColumn[] = [{ key: "name", label: "Name" }, { key: "amount", label: "Amount", type: "number" }];

const WORKERS_COMP_COLUMNS: LineColumn[] = [{ key: "state", label: "State" }, { key: "class_code", label: "Class code" }, { key: "rate", label: "Rate per $100 of payroll", type: "number" }];

const UNEMPLOYMENT_COLUMNS: LineColumn[] = [
  { key: "state", label: "State" },
  { key: "charge", label: "How it is charged", options: [{ value: "employer_rate", label: "The employer's own rate" }, { value: "peo_rate", label: "The PEO's rate" }] },
  { key: "rate", label: "Percent of taxable wages", type: "number", when: (l) => l.charge === "peo_rate" },
];

const TIER_LABELS: Record<QuoteTier, string> = { employee_only: "Employee only", employee_spouse: "Employee and spouse", employee_children: "Employee and children", family: "Family" };
const MEDICAL_COLUMNS: LineColumn[] = [
  { key: "plan", label: "Plan" },
  { key: "tier", label: "Tier", options: QUOTE_TIERS.map((t) => ({ value: t, label: TIER_LABELS[t] })) },
  { key: "monthly", label: "Monthly rate per employee", type: "number" },
];

/** The form that records what a PEO quoted (CRM-Q3.3, screen 12). Nothing is saved until the agent saves. */
export function RecordQuoteForm({ request, onRecorded, onCancel }: { request: QuoteRequestRow; onRecorded: () => void; onCancel: () => void }) {
  const id = `record-quote-${request.id}`;
  const [kind, setKind] = useState<QuoteKind | "">("");
  const [fee, setFee] = useState("");
  const [basis, setBasis] = useState<QuoteAdminFeeBasis | "">("");
  const [receivedOn, setReceivedOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [startOn, setStartOn] = useState("");
  const [oneOff, setOneOff] = useState<Lines>([]);
  const [workersComp, setWorkersComp] = useState<Lines>([]);
  const [unemployment, setUnemployment] = useState<Lines>([]);
  const [medical, setMedical] = useState<Lines>([]);
  const [note, setNote] = useState("");
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const failure = useSaveFailure("The quote wasn't recorded. Check your connection and try again. What you typed is still here.");
  const offlineSave = useOfflineSave();
  const save = async () => {
    if (kind === "") {
      setMissing(true);
      return;
    }
    setMissing(false);
    setSaving(true);
    failure.clear();
    try {
      await recordQuote(request.id, {
        kind,
        receivedOn: receivedOn || null,
        expiresOn: expiresOn || null,
        startOn: startOn || null,
        adminFee: fee.trim() !== "" ? Number(fee) : null,
        adminFeeBasis: basis || null,
        oneOffFees: oneOff.length > 0 ? oneOff.map((l) => ({ name: (l.name ?? "").trim(), amount: Number(l.amount) })) : null,
        workersComp: workersComp.length > 0 ? workersComp.map((l) => ({ state: (l.state ?? "").trim().toUpperCase(), class_code: (l.class_code ?? "").trim(), rate: Number(l.rate) })) : null,
        unemployment: unemployment.length > 0 ? unemployment.map((l) => (l.charge === "peo_rate" ? { state: (l.state ?? "").trim().toUpperCase(), charge: "peo_rate" as const, rate: Number(l.rate) } : { state: (l.state ?? "").trim().toUpperCase(), charge: "employer_rate" as const })) : null,
        medical: medical.length > 0 ? medical.map((l) => ({ plan: (l.plan ?? "").trim(), tier: l.tier as QuoteTier, monthly: Number(l.monthly) })) : null,
        note: note.trim() || null,
      });
      toast.success(`Recorded ${request.peo_name}'s quote.`);
      onRecorded();
    } catch (err) {
      failure.failed(err);
    } finally {
      setSaving(false);
    }
  };
  return (
    <form
      aria-label={`Record the quote from ${request.peo_name}`}
      className="w-full max-w-xl space-y-2 border border-border rounded-md p-3 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        void offlineSave.guard(save)();
      }}
    >
      <label htmlFor={`${id}-kind`} className="block text-xs text-muted-foreground">Estimate or firm offer</label>
      <select id={`${id}-kind`} value={kind} onChange={(e) => setKind(e.target.value as QuoteKind | "")} className={inputClass}>
        <option value="">Choose one</option>
        {QUOTE_KINDS.map((k) => <option key={k} value={k}>{QUOTE_KIND_LABELS[k]}</option>)}
      </select>
      {missing && kind === "" && <p role="alert" className="text-xs text-destructive">Say whether this is an estimate or a firm offer.</p>}
      <label htmlFor={`${id}-fee`} className="block text-xs text-muted-foreground">Admin fee</label>
      <input id={`${id}-fee`} type="number" min={0} step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} className={inputClass} />
      <label htmlFor={`${id}-basis`} className="block text-xs text-muted-foreground">Admin fee basis</label>
      <select id={`${id}-basis`} value={basis} onChange={(e) => setBasis(e.target.value as QuoteAdminFeeBasis | "")} className={inputClass}>
        <option value="">Not quoted</option>
        {QUOTE_ADMIN_FEE_BASES.map((b) => <option key={b} value={b}>{FEE_BASIS_LABELS[b]}</option>)}
      </select>
      <QuoteLinesField title="One-off fees" noun="one-off fee" columns={ONE_OFF_COLUMNS} lines={oneOff} onChange={setOneOff} />
      <QuoteLinesField title="Workers' comp rates" noun="workers' comp rate" columns={WORKERS_COMP_COLUMNS} lines={workersComp} onChange={setWorkersComp} />
      <QuoteLinesField title="Unemployment tax" noun="unemployment line" article="an" columns={UNEMPLOYMENT_COLUMNS} lines={unemployment} onChange={setUnemployment} />
      <QuoteLinesField title="Medical rates" noun="medical rate" columns={MEDICAL_COLUMNS} lines={medical} onChange={setMedical} />
      <label htmlFor={`${id}-received`} className="block text-xs text-muted-foreground">Received on</label>
      <input id={`${id}-received`} type="date" value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} className={inputClass} />
      <label htmlFor={`${id}-expires`} className="block text-xs text-muted-foreground">Expires on</label>
      <input id={`${id}-expires`} type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className={inputClass} />
      <label htmlFor={`${id}-start`} className="block text-xs text-muted-foreground">Proposed start</label>
      <input id={`${id}-start`} type="date" value={startOn} onChange={(e) => setStartOn(e.target.value)} className={inputClass} />
      <label htmlFor={`${id}-note`} className="block text-xs text-muted-foreground">Note</label>
      <textarea id={`${id}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={QUOTE_NOTE_MAX} rows={2} className={inputClass} />
      <SaveFailed message={failure.message} className="text-xs" />
      {offlineSave.reason}
      <div className="flex gap-2">
        <button type="submit" {...offlineSave.buttonProps} disabled={saving} className="min-h-11 px-4 inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Save the quote
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className="min-h-11 px-4 rounded-md border border-border">Cancel</button>
      </div>
    </form>
  );
}
