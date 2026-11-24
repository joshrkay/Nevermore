// The firm's producer number and licences on record (docs/BROKER_READINESS_PRD.md BR-2.2; src/lib/marketApi.ts). An owner keeps them, every member reads
// them, and a platform admin reads them and records that they were checked. A send to a carrier needs a property and casualty licence here that has not
// expired (ADR 0029); which states it must cover is counsel's to say, so the screen claims nothing about that.
import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  addFirmLicence, LICENCE_LINE_LABELS, loadAdminFirmLicenceRecord, loadFirmLicenceRecord, recordLicenceCheck, removeFirmLicence, setFirmNpn,
  type FirmLicence, type FirmLicenceRecord, type LicenceLine,
} from "@/lib/marketApi";
import { LoadFailed } from "@/components/workspace/states";
import { failureWords, SaveFailed } from "@/components/workspace/form";

const input = "w-full min-h-11 bg-muted border border-border rounded-md px-3 py-2 text-sm";
const button = "inline-flex items-center justify-center min-h-11 px-3 rounded-md border border-border text-sm hover:bg-muted disabled:opacity-50";
const primary = "inline-flex items-center justify-center min-h-11 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50";

const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

type Load = { kind: "loading" } | { kind: "error"; error: Error } | { kind: "ready"; record: FirmLicenceRecord };

function useRecord(read: () => Promise<FirmLicenceRecord>): [Load, () => void] {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoad((now) => (now.kind === "ready" ? now : { kind: "loading" }));
    read().then((record) => !cancelled && setLoad({ kind: "ready", record }), (error: Error) => !cancelled && setLoad({ kind: "error", error }));
    return () => { cancelled = true; };
  }, [read, attempt]);
  return [load, useCallback(() => setAttempt((n) => n + 1), [])];
}

/** How the check stands, in words: never checked, checked on a day, or changed since it was. */
function licenceCheckWords(record: Pick<FirmLicenceRecord, "checkedAt" | "changedSinceCheck">): string {
  if (!record.checkedAt) return "Nevermore has not checked these yet.";
  return record.changedSinceCheck ? `Changed since Nevermore checked them on ${day(record.checkedAt)}.` : `Nevermore checked these on ${day(record.checkedAt)}.`;
}

const LicenceLine_ = ({ licence }: { licence: FirmLicence }) => (
  <span className="flex-1 min-w-0">
    <span className="block font-medium">{licence.state} · {LICENCE_LINE_LABELS[licence.line]}</span>
    <span className={`block text-sm ${licence.expired ? "text-warning" : "text-muted-foreground"}`}>
      {licence.expired && <AlertTriangle className="inline w-3 h-3 mr-1 -mt-0.5" aria-hidden="true" />}
      {[licence.licenceNumber ? `Number ${licence.licenceNumber}` : null,
        licence.expiresOn ? `${licence.expired ? "Expired" : "Expires"} ${day(licence.expiresOn)}` : "No expiry given"].filter(Boolean).join(" · ")}
    </span>
  </span>
);

const Record_ = ({ record, onRemove, busy }: { record: FirmLicenceRecord; onRemove?: (l: FirmLicence) => void; busy?: boolean }) => (
  record.licences.length === 0 ? (
    <p className="text-sm text-muted-foreground">No licence on record.</p>
  ) : (
    <ul aria-label="Licences on record" className="divide-y divide-border border border-border rounded-lg">
      {record.licences.map((l) => (
        <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
          <LicenceLine_ licence={l} />
          {onRemove && <button type="button" disabled={busy} onClick={() => onRemove(l)} className={button} aria-label={`Remove the ${l.state} ${LICENCE_LINE_LABELS[l.line].toLowerCase()} licence`}>Remove</button>}
        </li>
      ))}
    </ul>
  )
);

/** The firm's own view, on Settings: an owner changes it, every other member reads it. */
export const FirmLicences = ({ firmId }: { firmId: string }) => {
  const id = useId();
  const read = useCallback(() => loadFirmLicenceRecord(firmId), [firmId]);
  const [load, again] = useRecord(read);
  const [npn, setNpn] = useState<string | null>(null);
  const empty = { state: "", line: "property_casualty" as LicenceLine, licenceNumber: "", expiresOn: "" };
  const [draft, setDraft] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const run = async (what: () => Promise<void>, done: string, fallback: string) => {
    setBusy(true);
    setProblem(null);
    try {
      await what();
      toast.success(done);
      again();
      return true;
    } catch (err) {
      setProblem(failureWords(err, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveNpn = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(() => setFirmNpn(firmId, npn ?? ""), "The producer number is saved.", "The number wasn't saved. Check your connection and try again.")) setNpn(null);
  };
  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(() => addFirmLicence(firmId, draft), "The licence is on record.", "That licence wasn't saved. Check your connection and try again.")) setDraft(empty);
  };

  if (load.kind === "loading") return <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading your firm's licences…</p>;
  if (load.kind === "error") return <LoadFailed error={load.error} what="your firm's licences" onRetry={again} />;
  const { record } = load;
  const hasPc = record.licences.some((l) => l.line === "property_casualty" && !l.expired);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        What Nevermore checks before approving a firm. Sending to a workers' comp carrier needs a property and casualty licence here that has not expired.
        {!record.canChange && " An owner of the firm keeps these."}
      </p>
      <p className="text-sm">{licenceCheckWords(record)}</p>
      {!hasPc && <p role="status" className="text-sm rounded-lg bg-warning/10 text-warning px-3 py-2">No property and casualty licence is on record, so nothing can be sent to a carrier yet.</p>}
      {record.canChange ? (
        <form onSubmit={(e) => void saveNpn(e)} className="flex flex-wrap items-end gap-2">
          <div className="space-y-1 flex-1 min-w-48">
            <label htmlFor={`${id}-npn`} className="text-sm font-medium">National Producer Number</label>
            <input id={`${id}-npn`} inputMode="numeric" maxLength={10} value={npn ?? record.npn ?? ""} onChange={(e) => setNpn(e.target.value)} className={input} autoComplete="off" />
          </div>
          <button type="submit" disabled={busy || npn === null} className={button}>Save the number</button>
        </form>
      ) : (
        <p className="text-sm">National Producer Number: {record.npn ?? "not on record"}</p>
      )}
      <Record_ record={record} busy={busy} onRemove={record.canChange ? (l) => void run(() => removeFirmLicence(firmId, l.id), "The licence is removed.", "That licence wasn't removed. Check your connection and try again.") : undefined} />
      {record.canChange && (
        <form onSubmit={(e) => void add(e)} className="space-y-3" aria-label="Add a licence">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <label htmlFor={`${id}-state`} className="text-sm font-medium">State (required)</label>
              <input id={`${id}-state`} required maxLength={2} placeholder="TX" value={draft.state} onChange={(e) => setDraft({ ...draft, state: e.target.value.toUpperCase() })} className={input} autoComplete="off" />
            </div>
            <div className="space-y-1">
              <label htmlFor={`${id}-line`} className="text-sm font-medium">Line</label>
              <select id={`${id}-line`} value={draft.line} onChange={(e) => setDraft({ ...draft, line: e.target.value as LicenceLine })} className={input}>
                {(Object.keys(LICENCE_LINE_LABELS) as LicenceLine[]).map((l) => <option key={l} value={l}>{LICENCE_LINE_LABELS[l]}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor={`${id}-number`} className="text-sm font-medium">Licence number</label>
              <input id={`${id}-number`} maxLength={40} value={draft.licenceNumber} onChange={(e) => setDraft({ ...draft, licenceNumber: e.target.value })} className={input} autoComplete="off" />
            </div>
            <div className="space-y-1">
              <label htmlFor={`${id}-expires`} className="text-sm font-medium">Expires</label>
              <input id={`${id}-expires`} type="date" value={draft.expiresOn} onChange={(e) => setDraft({ ...draft, expiresOn: e.target.value })} className={input} />
            </div>
          </div>
          <button type="submit" disabled={busy} className={primary}>Add licence</button>
        </form>
      )}
      <SaveFailed message={problem} className="font-normal" />
    </div>
  );
};

/** A platform admin's view of one firm's record, beside the decision on it (Q-1.1): read it, then record that it was checked. Opened on request. */
export const AdminFirmLicences = ({ firmId, firmName }: { firmId: string; firmName: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      {open ? <AdminFirmLicencesOpen firmId={firmId} firmName={firmName} /> : (
        <button type="button" className={button} onClick={() => setOpen(true)}>Show {firmName}'s licences</button>
      )}
    </div>
  );
};

const AdminFirmLicencesOpen = ({ firmId, firmName }: { firmId: string; firmName: string }) => {
  const read = useCallback(() => loadAdminFirmLicenceRecord(firmId), [firmId]);
  const [load, again] = useRecord(read);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const check = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await recordLicenceCheck(firmId);
      toast.success(`Recorded: you checked ${firmName}'s licences as they stand now.`);
      again();
    } catch (err) {
      setProblem(failureWords(err, "The check wasn't recorded. Check your connection and try again."));
    } finally {
      setBusy(false);
    }
  };

  if (load.kind === "loading") return <p role="status" className="text-sm text-muted-foreground">Loading {firmName}'s licences…</p>;
  if (load.kind === "error") return <LoadFailed error={load.error} what={`${firmName}'s licences`} onRetry={again} />;
  const { record } = load;
  return (
    <div className="space-y-3 rounded-lg border border-border p-3" role="group" aria-label={`${firmName}'s licences`}>
      <p className="text-sm">National Producer Number: {record.npn ?? "not on record"}</p>
      <Record_ record={record} />
      <p className="text-sm">{licenceCheckWords(record)}</p>
      <SaveFailed message={problem} className="font-normal" />
      <button type="button" disabled={busy} onClick={() => void check()} className={button}>Record that I checked these</button>
    </div>
  );
};
