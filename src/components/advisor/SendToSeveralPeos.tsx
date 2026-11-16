import { useEffect, useId, useState } from "react";
import { Loader2 } from "lucide-react";
import MailboxForWriting from "@/components/mailbox/MailboxForWriting";
import { useFirstSend } from "@/components/mailbox/useFirstSend";
import { failureWords } from "@/components/workspace/form";
import { FIT_WORDS, NOT_MET_NOTE, peoFit, type PeoRecord } from "@/data/peoCatalog";
import { groupByCompleteness, type CertifiedVersion, type PeoCompletenessEntry } from "@/data/peoCompleteness";
import { localToday } from "@/data/peoProfiles";
import { peoGreeting, peoSendSubject } from "@/data/peoSend";
import type { ChamberSubmission } from "@/data/manuscript";
import { bundleSummary, planBundle, type BundleSource } from "@/data/submissionBundle";
import { peoLinkIssuer } from "@/lib/peoLinkIssuer";
import { loadPeoSendContext, sendToPeo, type PeoSendContext } from "@/lib/peoSendApi";
import { loadPeoAuthorizations, type PeoAuthorizationState } from "@/lib/peoAuthorizationsApi";

export interface SendToSeveralPeosProps {
  sessionId: string;
  /** The last certified version, which each PEO's completeness, checks and bundle are worked out from. */
  certified: CertifiedVersion;
  catalog: readonly PeoRecord[];
  /** The certification on record, which each PEO's packet is stamped with. */
  submission: ChamberSubmission;
  fileId: string;
  companyName: string;
  /** This page, to come back to after connecting a mailbox. */
  returnTo: string;
  /** After the sends, once any went. */
  onSent: () => void;
}

/** A PEO as the choosing step lists it: what it still needs to quote and the eligibility checks it doesn't meet, either of which makes it not ready. */
interface Choice {
  peo: string;
  entry: PeoCompletenessEntry;
  missing: string[];
  notMet: string[];
  ready: boolean;
}

type Step = "choose" | "review" | "done";

/** How each chosen PEO's send went: sent, or not sent with the reason. */
interface Outcome {
  peo: string;
  sent: boolean;
  words: string;
}

/**
 * Send to several PEOs at once (M-2.2): every listed PEO with a profile, ticked when it is ready (nothing missing to quote and no eligibility check
 * not met) and unticked, with what it is missing, when it isn't. The advisor writes one note; a review shows each chosen PEO's recipients, greeting,
 * files and gaps; then each is sent its own message by 6.6's per-PEO send, to its own people only, with its own link from its own plan.
 */
const SendToSeveralPeos = (p: SendToSeveralPeosProps) => {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("choose");
  // Each PEO's composer read (peo_send_context): its people with an email; "failed" when it couldn't be read, which stops that PEO alone.
  const [contexts, setContexts] = useState<Record<string, PeoSendContext | "failed">>({});
  const [subject, setSubject] = useState(peoSendSubject(p.companyName, p.fileId, p.certified.version));
  const [note, setNote] = useState("");
  const [authorizations, setAuthorizations] = useState<PeoAuthorizationState[] | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [busy, setBusy] = useState(false);
  // No "Send from your own mail" here: each PEO has its own reply address to put in CC, so that is done one PEO at a time, on its card (D-1604).
  const { beforeSend, choice } = useFirstSend({ returnTo: p.returnTo });
  const today = localToday();
  const groups = groupByCompleteness(p.certified.intake, p.certified.documents, p.catalog);
  const choices: Choice[] = [...groups.complete, ...groups.missing]
    .map((entry) => {
      const missing = entry.completeness.toQuote.map((i) => i.label);
      const notMet = peoFit(p.certified.intake.data, entry.peo, today).filter((c) => c.status === "does_not_meet").map((c) => `${FIT_WORDS[c.status]} · ${c.label}`);
      return { peo: entry.peo.name, entry, missing, notMet, ready: missing.length + notMet.length === 0 };
    })
    .sort((a, b) => a.peo.localeCompare(b.peo));
  const [ticked, setTicked] = useState<string[]>(() => choices.filter((c) => c.ready).map((c) => c.peo));
  const toggle = (peo: string) => setTicked((now) => (now.includes(peo) ? now.filter((x) => x !== peo) : [...now, peo]));
  const chosen = choices.filter((c) => ticked.includes(c.peo));
  const peoNames = choices.map((c) => c.peo).join("\n");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // The employer's say for each PEO (M-1.1). Unread, the database still refuses a send without it, and the result says so.
    loadPeoAuthorizations(p.sessionId).then((rows) => !cancelled && setAuthorizations(rows), () => undefined);
    for (const peo of peoNames.split("\n").filter(Boolean)) {
      loadPeoSendContext(p.sessionId, peo).then(
        (c) => !cancelled && setContexts((now) => ({ ...now, [peo]: c })),
        () => !cancelled && setContexts((now) => ({ ...now, [peo]: "failed" })),
      );
    }
    return () => {
      cancelled = true;
    };
  }, [open, p.sessionId, peoNames]);

  // Each PEO's advisor bundle, from the last certified version: what its link carries and the open items its message lists.
  const sourceOf = (c: Choice): BundleSource => ({
    audience: "advisor", peo: c.entry.peo, catalog: p.catalog, intake: p.certified.intake, documents: p.certified.documents,
    submission: p.submission, fileId: p.fileId, version: p.certified.version, changedSince: p.certified.changedSince, today,
  });
  const peopleOf = (c: Choice) => {
    const read = contexts[c.peo];
    return read && read !== "failed" ? read.contacts : [];
  };
  const greetingOf = (c: Choice) => peoGreeting(peopleOf(c).map((x) => x.name));

  // What stops this PEO alone, in the database's own words (assert_peo_authorized, D-625); the rest still go.
  const stopOf = (c: Choice): string | null => {
    const state = authorizations?.find((a) => a.peo.toLowerCase() === c.peo.toLowerCase())?.state;
    if (state === "withdrawn") return `The employer withdrew ${c.peo}. Nothing more can be sent to it.`;
    if (authorizations && state !== "authorized") return `The employer hasn't authorized ${c.peo} to receive their packet. Ask them to add it.`;
    if (contexts[c.peo] === "failed") return `We couldn't load ${c.peo}'s contacts. Close this and open it again to try again.`;
    if (contexts[c.peo] && peopleOf(c).length === 0) return `${c.peo}'s profile has no contact with an email, so there is nobody to send it to.`;
    return null;
  };
  const going = chosen.filter((c) => stopOf(c) === null);

  const send = async () => {
    const done: Outcome[] = [];
    for (const c of chosen) {
      const stop = stopOf(c);
      if (stop) {
        done.push({ peo: c.peo, sent: false, words: stop });
        continue;
      }
      // One at a time, as each send locks the submission's pipeline row; a refusal stops this PEO alone.
      try {
        await sendToPeo({
          sessionId: p.sessionId,
          peo: c.peo,
          to: peopleOf(c).map((x) => x.email),
          subject,
          note: `${greetingOf(c)}\n\n${note}`,
          issueLink: peoLinkIssuer(sourceOf(c)),
        });
        done.push({ peo: c.peo, sent: true, words: `It is on the ${c.peo} thread.` });
      } catch (err) {
        done.push({ peo: c.peo, sent: false, words: failureWords(err, "The send didn't go through. Check your connection and try again.") });
      }
    }
    setOutcomes(done);
    setStep("done");
    if (done.some((o) => o.sent)) p.onSent();
  };

  // Opening again starts over: the choosing step, and each PEO's contacts and the employer's say read afresh.
  const close = () => {
    setOpen(false);
    setStep("choose");
    setContexts({});
    setAuthorizations(null);
    setOutcomes([]);
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-11 px-4 rounded-md border border-primary text-primary text-sm font-medium">
        Send to several PEOs
      </button>
    );
  }
  return (
    <section aria-label="Send to several PEOs" className="border border-border rounded-md p-3 space-y-3 text-sm">
      {step !== "done" && <MailboxForWriting returnTo={p.returnTo} />}
      {step === "choose" ? (
        <>
          <ul className="space-y-2">
            {choices.map((c) => (
              <li key={c.peo} className="space-y-0.5">
                <label className="flex items-center gap-2 min-h-11">
                  <input type="checkbox" checked={ticked.includes(c.peo)} onChange={() => toggle(c.peo)} />
                  <span className="font-medium">{c.peo}</span>
                </label>
                <p className="text-xs text-muted-foreground">{c.ready ? "Ready" : `Not ready: ${[...c.missing, ...c.notMet].join("; ")}`}</p>
              </li>
            ))}
          </ul>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Subject</span>
            <input value={subject} maxLength={300} onChange={(e) => setSubject(e.target.value)} className="w-full min-h-11 bg-muted border border-border rounded-md px-3" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Your note</span>
            <textarea value={note} maxLength={50000} rows={5} onChange={(e) => setNote(e.target.value)} className="w-full bg-muted border border-border rounded-md px-3 py-2" />
          </label>
          <button type="button" onClick={() => setStep("review")} className="min-h-11 px-4 rounded-md bg-primary text-primary-foreground font-medium">Review</button>
        </>
      ) : step === "done" ? (
        <ul aria-label="What was sent" className="space-y-1">
          {outcomes.map((o) => (
            <li key={o.peo} className={o.sent ? "" : "text-destructive"}>{`${o.peo}: ${o.sent ? "Sent" : "Not sent"}. ${o.words}`}</li>
          ))}
        </ul>
      ) : (
        <>
          <ul className="space-y-2">
            {chosen.map((c) => {
              const plan = planBundle(sourceOf(c));
              const items = plan.missing.map((m) => m.label);
              const stop = stopOf(c);
              return (
                <li key={c.peo}>
                  <article aria-labelledby={`${id}-${c.entry.peo.id ?? c.peo}`} className="rounded-md bg-muted p-2 space-y-0.5">
                    <h4 id={`${id}-${c.entry.peo.id ?? c.peo}`} className="font-medium">{c.peo}</h4>
                    <p>{`To: ${peopleOf(c).map((x) => `${x.name}${x.role ? `, ${x.role}` : ""} (${x.email})`).join(", ")}`}</p>
                    <p className="text-xs text-muted-foreground">{`Opens with "${greetingOf(c)}", then your note.`}</p>
                    <p className="text-xs">{bundleSummary(plan)}</p>
                    <p className="text-xs">{`Open items: ${items.length > 0 ? items.join("; ") : "none"}`}</p>
                    {c.notMet.length > 0 && <p className="text-xs text-warning">{`${c.notMet.join("; ")}. ${NOT_MET_NOTE}`}</p>}
                    {stop && <p className="text-xs text-destructive">{`Won't be sent: ${stop}`}</p>}
                  </article>
                </li>
              );
            })}
          </ul>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || going.length === 0}
              onClick={() => {
                setBusy(true);
                void beforeSend(send).finally(() => setBusy(false));
              }}
              className="min-h-11 px-4 inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-60"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {`Send to ${going.length} PEO${going.length === 1 ? "" : "s"}`}
            </button>
            <button type="button" disabled={busy} onClick={() => setStep("choose")} className="min-h-11 px-4 rounded-md border border-border">Back</button>
          </div>
        </>
      )}
      <button type="button" disabled={busy} onClick={close} className="min-h-11 px-4 rounded-md border border-border">Close</button>
      {choice}
    </section>
  );
};

export default SendToSeveralPeos;
