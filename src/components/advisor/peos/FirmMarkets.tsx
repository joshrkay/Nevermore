// What a firm keeps and asks about the PEOs and carriers it sends to (docs/BROKER_READINESS_PRD.md BR-1.3, BR-1.4; src/lib/marketApi.ts): its own contacts at
// one of them, its requests for one that isn't listed, and, for a platform admin, every firm's requests to answer.
import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { LINE_LABELS, lineOf, MARKET_WORDS, QUOTE_LINES, type QuoteLine } from "@/data/lines";
import {
  addFirmMarketContact, answerMarketRequest, loadAdminMarketRequests, loadFirmMarketContacts, loadFirmMarketRequests, removeFirmMarketContact, requestMarket,
  type FirmMarketContact, type MarketRequest,
} from "@/lib/marketApi";
import { LoadFailed } from "@/components/workspace/states";
import { failureWords, SaveFailed } from "@/components/workspace/form";
import { buttonClass, inputClass, primaryClass } from "./shared";

type Load<T> = { kind: "loading" } | { kind: "error"; error: Error } | { kind: "ready"; rows: T[] };

/** Reads a list once and again whenever `again` is called; the list stays on screen while it is read again. */
function useRows<T>(read: () => Promise<T[]>): [Load<T>, () => void] {
  const [load, setLoad] = useState<Load<T>>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoad((now) => (now.kind === "ready" ? now : { kind: "loading" }));
    read().then((rows) => !cancelled && setLoad({ kind: "ready", rows }), (error: Error) => !cancelled && setLoad({ kind: "error", error }));
    return () => { cancelled = true; };
  }, [read, attempt]);
  return [load, useCallback(() => setAttempt((n) => n + 1), [])];
}

const Loading = ({ what }: { what: string }) => (
  <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading {what}…</p>
);

const STATUS_WORDS: Record<MarketRequest["status"], string> = { open: "Waiting for Nevermore", listed: "Listed", declined: "Not listed" };
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

/**
 * The firm's own contacts at one PEO or carrier (BR-1.3): the people it deals with there. No other firm sees them, and they are offered first when the firm
 * sends. Any member adds or removes one. `canChange` is false for a support session, which looks and changes nothing.
 */
export const FirmMarketContacts = ({ firmId, peoId, peoName, canChange }: { firmId: string; peoId: number; peoName: string; canChange: boolean }) => {
  const id = useId();
  const read = useCallback(() => loadFirmMarketContacts(firmId), [firmId]);
  const [load, again] = useRows<FirmMarketContact>(read);
  const [draft, setDraft] = useState({ name: "", role: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const here = load.kind === "ready" ? load.rows.filter((c) => c.peoId === peoId) : [];

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      await addFirmMarketContact(firmId, peoId, draft);
      setDraft({ name: "", role: "", email: "", phone: "" });
      toast.success(`${draft.name.trim()} is one of your firm's contacts at ${peoName}.`);
      again();
    } catch (err) {
      setProblem(failureWords(err, "That contact wasn't saved. Check your connection and try again."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: FirmMarketContact) => {
    setBusy(true);
    setProblem(null);
    try {
      await removeFirmMarketContact(firmId, c.id);
      toast.success(`${c.name} is no longer one of your firm's contacts at ${peoName}.`);
      again();
    } catch (err) {
      setProblem(failureWords(err, "That contact wasn't removed. Check your connection and try again."));
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof typeof draft, label: string, type = "text", required = false) => (
    <div className="space-y-1">
      <label htmlFor={`${id}-${key}`} className="text-sm font-medium">{label}{required ? " (required)" : ""}</label>
      <input id={`${id}-${key}`} type={type} required={required} value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} className={inputClass} autoComplete="off" />
    </div>
  );

  return (
    <section aria-labelledby={`${id}-heading`} className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-4 min-w-0">
      <div>
        <h2 id={`${id}-heading`} className="font-display text-xl font-bold">Your firm's contacts at {peoName}</h2>
        <p className="text-sm text-muted-foreground">The people your firm deals with there. Only your firm sees them, and they are offered first when you send to {peoName}.</p>
      </div>
      {load.kind === "loading" && <Loading what="your firm's contacts" />}
      {load.kind === "error" && <LoadFailed error={load.error} what="your firm's contacts" onRetry={again} />}
      {load.kind === "ready" && (here.length === 0 ? (
        <p className="text-sm text-muted-foreground">Your firm has no contact of its own at {peoName} yet.</p>
      ) : (
        <ul aria-label={`Your firm's contacts at ${peoName}`} className="divide-y divide-border border border-border rounded-lg">
          {here.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <span className="flex-1 min-w-0">
                <span className="block font-medium">{c.name}{c.role ? `, ${c.role}` : ""}</span>
                <span className="block text-sm text-muted-foreground break-all">{c.email}{c.phone ? ` · ${c.phone}` : ""}</span>
              </span>
              {canChange && <button type="button" disabled={busy} onClick={() => void remove(c)} className={buttonClass} aria-label={`Remove ${c.name}`}>Remove</button>}
            </li>
          ))}
        </ul>
      ))}
      {canChange && load.kind === "ready" && (
        <form onSubmit={(e) => void add(e)} className="space-y-3" aria-label={`Add a contact at ${peoName}`}>
          <div className="grid gap-3 sm:grid-cols-2">
            {field("name", "Name", "text", true)}
            {field("email", "Email", "email", true)}
            {field("role", "Role")}
            {field("phone", "Phone", "tel")}
          </div>
          <SaveFailed message={problem} className="font-normal" />
          <button type="submit" disabled={busy} className={primaryClass}>Add contact</button>
        </form>
      )}
    </section>
  );
};

/**
 * A firm asks for a PEO or carrier that isn't listed (BR-1.4), and reads what it has asked for and Nevermore's answer to each. Until one is listed, a quote
 * from it can still be recorded as sent by hand.
 */
export const AskForMarket = ({ firmId, canChange }: { firmId: string; canChange: boolean }) => {
  const id = useId();
  const read = useCallback(() => loadFirmMarketRequests(firmId), [firmId]);
  const [load, again] = useRows<MarketRequest>(read);
  const empty = { name: "", line: "peo" as QuoteLine, contactName: "", contactEmail: "", note: "" };
  const [draft, setDraft] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const ask = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      await requestMarket(firmId, draft);
      toast.success(`Nevermore has your request for ${draft.name.trim()}. The answer will show here.`);
      setDraft(empty);
      again();
    } catch (err) {
      setProblem(failureWords(err, "Your request wasn't sent. Check your connection and try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby={`${id}-heading`} className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-4 min-w-0">
      <div>
        <h2 id={`${id}-heading`} className="font-display text-xl font-bold">Ask for a PEO or carrier that isn't listed</h2>
        <p className="text-sm text-muted-foreground">Nevermore keeps the list and what each one asks for. Tell us who is missing and who you deal with there.</p>
      </div>
      {canChange && (
        <form onSubmit={(e) => void ask(e)} className="space-y-3" aria-label="Ask for a PEO or carrier">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor={`${id}-name`} className="text-sm font-medium">Its name (required)</label>
              <input id={`${id}-name`} required maxLength={80} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputClass} autoComplete="off" />
            </div>
            <div className="space-y-1">
              <label htmlFor={`${id}-line`} className="text-sm font-medium">What it quotes</label>
              <select id={`${id}-line`} value={draft.line} onChange={(e) => setDraft({ ...draft, line: e.target.value as QuoteLine })} className={inputClass}>
                {QUOTE_LINES.map((l) => <option key={l} value={l}>{l === "peo" ? "PEO" : `${LINE_LABELS[l]} (a carrier)`}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor={`${id}-contact`} className="text-sm font-medium">Who you deal with there</label>
              <input id={`${id}-contact`} maxLength={200} value={draft.contactName} onChange={(e) => setDraft({ ...draft, contactName: e.target.value })} className={inputClass} autoComplete="off" />
            </div>
            <div className="space-y-1">
              <label htmlFor={`${id}-email`} className="text-sm font-medium">Their email</label>
              <input id={`${id}-email`} type="email" value={draft.contactEmail} onChange={(e) => setDraft({ ...draft, contactEmail: e.target.value })} className={inputClass} autoComplete="off" />
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor={`${id}-note`} className="text-sm font-medium">Anything that helps us list it</label>
            <textarea id={`${id}-note`} maxLength={1000} rows={2} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} className={inputClass} />
          </div>
          <SaveFailed message={problem} className="font-normal" />
          <button type="submit" disabled={busy} className={primaryClass}>Send the request</button>
        </form>
      )}
      {load.kind === "loading" && <Loading what="your firm's requests" />}
      {load.kind === "error" && <LoadFailed error={load.error} what="your firm's requests" onRetry={again} />}
      {load.kind === "ready" && load.rows.length > 0 && (
        <ul aria-label="Your firm's requests" className="divide-y divide-border border border-border rounded-lg">
          {load.rows.map((r) => (
            <li key={r.id} className="px-4 py-3 text-sm">
              <span className="block font-medium">{r.name} <span className="font-normal text-muted-foreground">· {r.line === "peo" ? "PEO" : "Workers' comp carrier"}</span></span>
              <span className="block text-muted-foreground">{STATUS_WORDS[r.status]} · asked {day(r.createdAt)}{r.requestedBy ? ` by ${r.requestedBy}` : ""}</span>
              {r.answer && <span className="block mt-1">{r.answer}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

/**
 * Every firm's requests for a PEO or carrier, for a platform admin (BR-1.4): those waiting first. Each is answered once: listed, naming the market on the list
 * it now is (one of the request's line), or not, with the reason the firm will read.
 */
export const AdminMarketRequests = ({ markets }: { markets: { id: number; name: string; line?: string | null; listed: boolean }[] }) => {
  const id = useId();
  const read = useCallback(() => loadAdminMarketRequests(), []);
  const [load, again] = useRows<MarketRequest>(read);
  const [answers, setAnswers] = useState<Record<number, { peoId: string; answer: string }>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [problem, setProblem] = useState<{ id: number; message: string } | null>(null);

  const answer = async (r: MarketRequest, listed: boolean) => {
    const mine = answers[r.id] ?? { peoId: "", answer: "" };
    setBusy(r.id);
    setProblem(null);
    try {
      await answerMarketRequest(r.id, { listed, peoId: mine.peoId ? Number(mine.peoId) : null, answer: mine.answer });
      toast.success(listed ? `${r.firmName ?? "The firm"} is told ${r.name} is listed.` : `${r.firmName ?? "The firm"} is told why ${r.name} isn't listed.`);
      again();
    } catch (err) {
      setProblem({ id: r.id, message: failureWords(err, "That answer wasn't saved. Check your connection and try again.") });
    } finally {
      setBusy(null);
    }
  };

  if (load.kind === "ready" && load.rows.length === 0) return null;
  const waiting = load.kind === "ready" ? load.rows.filter((r) => r.status === "open") : [];
  const answered = load.kind === "ready" ? load.rows.filter((r) => r.status !== "open") : [];
  return (
    <section aria-labelledby={`${id}-heading`} className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-4 min-w-0 mb-6">
      <h2 id={`${id}-heading`} className="font-display text-xl font-bold">Requests from firms{waiting.length > 0 ? ` (${waiting.length} waiting)` : ""}</h2>
      {load.kind === "loading" && <Loading what="the requests" />}
      {load.kind === "error" && <LoadFailed error={load.error} what="the requests" onRetry={again} />}
      {waiting.length > 0 && (
        <ul aria-label="Requests waiting for an answer" className="space-y-4">
          {waiting.map((r) => {
            const mine = answers[r.id] ?? { peoId: "", answer: "" };
            const set = (next: Partial<typeof mine>) => setAnswers({ ...answers, [r.id]: { ...mine, ...next } });
            const choices = markets.filter((m) => m.listed && lineOf(m.line) === r.line);
            return (
              <li key={r.id} className="border border-border rounded-lg p-4 space-y-3 text-sm">
                <p>
                  <span className="font-medium">{r.name}</span> <span className="text-muted-foreground">· {r.line === "peo" ? "PEO" : "Workers' comp carrier"} · asked by {r.firmName} on {day(r.createdAt)}</span>
                </p>
                {(r.contactName || r.contactEmail) && <p>Their contact there: {[r.contactName, r.contactEmail].filter(Boolean).join(", ")}</p>}
                {r.note && <p>{r.note}</p>}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label htmlFor={`${id}-${r.id}-peo`} className="font-medium">Listed as</label>
                    <select id={`${id}-${r.id}-peo`} value={mine.peoId} onChange={(e) => set({ peoId: e.target.value })} className={inputClass}>
                      <option value="">Choose the {MARKET_WORDS[r.line].one} on the list</option>
                      {choices.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor={`${id}-${r.id}-answer`} className="font-medium">What the firm is told</label>
                    <input id={`${id}-${r.id}-answer`} maxLength={500} value={mine.answer} onChange={(e) => set({ answer: e.target.value })} className={inputClass} autoComplete="off" />
                  </div>
                </div>
                <SaveFailed message={problem?.id === r.id ? problem.message : null} className="font-normal" />
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy !== null || !mine.peoId} onClick={() => void answer(r, true)} className={primaryClass}>It is listed now</button>
                  <button type="button" disabled={busy !== null || mine.answer.trim() === ""} onClick={() => void answer(r, false)} className={buttonClass}>Not listing it</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {answered.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm min-h-11 inline-flex items-center">Answered ({answered.length})</summary>
          <ul aria-label="Answered requests" className="divide-y divide-border border border-border rounded-lg mt-2">
            {answered.map((r) => (
              <li key={r.id} className="px-4 py-3 text-sm">
                <span className="block font-medium">{r.name} <span className="font-normal text-muted-foreground">· {r.firmName} · {STATUS_WORDS[r.status]}</span></span>
                {r.answer && <span className="block">{r.answer}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
};
